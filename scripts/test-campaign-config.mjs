#!/usr/bin/env node
// Self-test za "Ispuni uz AI asistenta" + domovina.ai link import.
//
//   node scripts/test-campaign-config.mjs          # deterministički testovi
//   node scripts/test-campaign-config.mjs --live   # + pravi cdn.domovina.ai
//
// Bundla lib/campaign-config.ts i lib/domovina-import.ts esbuildom (tsconfig
// paths rješava @/*; type-only importi se brišu) pa vozi assertione nad
// stvarnim parserom — istim kodom koji vrti produkcija.

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const LIVE = process.argv.includes("--live");
const root = new URL("..", import.meta.url).pathname;

const outDir = mkdtempSync(join(tmpdir(), "pinka-config-test-"));
const outFile = join(outDir, "bundle.mjs");
await build({
  stdin: {
    contents:
      'export * from "./lib/campaign-config";\nexport * from "./lib/domovina-import";\nexport { parseEurToCents } from "./lib/format";',
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: outFile,
  tsconfig: join(root, "tsconfig.json"),
  logLevel: "silent",
});
const lib = await import(pathToFileURL(outFile).href);

let fails = 0;
const ok = (cond, label) => {
  console.log(cond ? "  ok " : "  FAIL", label);
  if (!cond) fails++;
};
const section = (s) => console.log(`\n${s}`);

// ── parseEurToCents (hr/en zapisi) ──────────────────────────────────────────
section("parseEurToCents");
for (const [input, expected] of [
  ["12,50", 1250], ["12.50", 1250], ["10.000", 1000000], ["1.234,56", 123456],
  ["1,234.56", 123456], ["1 000", 100000], ["0,50", 50], ["abc", null],
  ["0", null], ["1.2345", null], ["1.000.000", 100000000],
]) {
  ok(lib.parseEurToCents(input) === expected, `"${input}" → ${expected}`);
}

// ── domovina.ai URL detekcija ───────────────────────────────────────────────
section("parseDomovinaUrl");
ok(
  JSON.stringify(lib.parseDomovinaUrl("https://domovina.ai/v/b-nls1ck8EE")) ===
    '{"kind":"episode","id":"b-nls1ck8EE"}',
  "epizoda",
);
ok(
  JSON.stringify(lib.parseDomovinaUrl(" domovina.ai/c/domovina-tv ")) ===
    '{"kind":"channel","slug":"domovina-tv","channelId":"domovina_tv"}',
  "kanal (bez https, slug→channelId)",
);
ok(lib.parseDomovinaUrl("https://example.com/v/abc") === null, "tuđa domena odbijena");
ok(lib.parseDomovinaUrl('{"version":"x"}') === null, "JSON nije URL");

// ── AI round-trip fixture: stvaran output Claude asistenta na naš predložak ─
section("AI fixture (Claude output) → parseCampaignConfig");
const AI_FIXTURE = `Evo konfiguracije:
\`\`\`json
{
  "version": "pinka.campaign.v1",
  "title": "Novi krov za dvoranu KUD-a Tomislav — Slavonski Brod",
  "type": "donation",
  "description": "Skupljamo 18.500 eura za potpunu obnovu krova.\\n\\nSvaki euro ide u materijal i radove.",
  "goal_eur": 18500,
  "min_contribution_eur": 2,
  "visibility": "public",
  "recurrence": "none",
  "recurrence_anchor_day": null,
  "location": { "name": "Slavonski Brod", "latitude": 45.16, "longitude": 18.015 },
  "starts_at": null,
  "ends_at": "2099-10-31",
  "destination_address": "0x1111111111111111111111111111111111111111",
  "state": "active"
}
\`\`\``;
const r = lib.parseCampaignConfig(AI_FIXTURE);
ok(r !== null && r.versionOk, "fenced JSON + version");
ok(
  r.ignoredKeys.includes("destination_address") && r.ignoredKeys.includes("state"),
  "SECURITY: destination_address i state se ignoriraju",
);
ok(r.fields.every((f) => f.patch === null || !("destinationAddress" in f.patch)), "nijedan patch ne dira adresu");
ok(r.fields.every((f) => f.patch !== null), "sva content polja valjana");
const get = (k) => r.fields.find((f) => f.key === k)?.patch;
ok(get("goal_eur")?.goalCents === 1850000, "18.500 € → 1850000 centi");
ok(get("min_contribution_eur")?.minContributionCents === 200, "2 € → 200 centi");
ok(get("location")?.latitude === 45.16, "lokacija");

// ── nevaljana polja se isključuju s razlogom ────────────────────────────────
section("nevaljana polja");
const bad = lib.parseCampaignConfig(
  '{"title":"ab","type":"loan","goal_eur":-5,"ends_at":"2020-01-01","cover_image_url":"http://insecure.example/x.png","location":{"latitude":95,"longitude":10}}',
);
ok(bad.fields.length === 6 && bad.fields.every((f) => f.patch === null), "svih 6 nevaljanih polja odbijeno");
ok(bad.fields.find((f) => f.key === "cover_image_url")?.errorKey === "form.errImportUrl", "http:// cover odbijen (samo https)");

// ── export → parse round-trip ───────────────────────────────────────────────
section("export round-trip");
const vals = {
  title: "Test kampanja", type: "crowdfund", description: "Opis", goalCents: 100000,
  minContributionCents: 100, destinationAddress: "", subjectType: "generic", subjectRef: null,
  visibility: "public", recurrence: "monthly", recurrenceAnchorDay: 15, latitude: 45.1,
  longitude: 18.0, locationName: "Brod", coverImageUrl: "https://cdn.domovina.ai/x.png",
  startsAt: null, endsAt: "2099-12-31",
};
const back = lib.parseCampaignConfig(lib.exportCampaignConfig(vals));
ok(back.versionOk && back.fields.every((f) => f.patch !== null), "export se parsira bez gubitka");
ok(lib.buildAiPrompt("hr", vals).includes("pinka.campaign.v1"), "AI prompt sadrži shemu");

// ── live CDN (opcionalno) ───────────────────────────────────────────────────
if (LIVE) {
  section("LIVE cdn.domovina.ai");
  const ep = await lib.fetchDomovinaConfig({ kind: "episode", id: "b-nls1ck8EE" });
  const epR = lib.parseCampaignConfig(JSON.stringify(ep));
  ok(epR.fields.every((f) => f.patch !== null), "epizoda: sva polja valjana");
  ok(epR.fields.some((f) => f.key === "subject_ref"), "epizoda: subject_ref");
  const ch = await lib.fetchDomovinaConfig({
    kind: "channel", slug: "domovina-tv", channelId: "domovina_tv",
  });
  const chR = lib.parseCampaignConfig(JSON.stringify(ch));
  ok(chR.fields.every((f) => f.patch !== null), "kanal: sva polja valjana");
  ok(chR.fields.some((f) => f.key === "recurrence" && f.patch.recurrence === "monthly"), "kanal: monthly");
}

console.log(fails === 0 ? "\n✅ ALL OK" : `\n❌ ${fails} FAILURES`);
process.exit(fails ? 1 : 0);
