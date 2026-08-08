#!/usr/bin/env node
// Self-test za pravni gate pri kreiranju kampanje (lib/legal.ts).
//
//   node scripts/test-legal.mjs
//
// Bundla lib/legal.ts esbuildom (kao test-campaign-config.mjs) pa vozi
// assertione nad istim kodom koji vrti produkcija. Pravila i citati:
// pinka-finance/landing/docs/pravni-okvir-primanja-sredstava.md

import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;
const outFile = join(mkdtempSync(join(tmpdir(), "pinka-legal-test-")), "bundle.mjs");
await build({
  stdin: { contents: 'export * from "./lib/legal";', resolveDir: root, loader: "ts" },
  bundle: true,
  format: "esm",
  outfile: outFile,
  tsconfig: join(root, "tsconfig.json"),
  logLevel: "silent",
});
const L = await import(pathToFileURL(outFile).href);

let fails = 0;
const ok = (cond, label) => {
  console.log(cond ? "  ok " : "  FAIL", label);
  if (!cond) fails++;
};
const decl = (o) => ({ ...L.EMPTY_DECLARATION, ...o });

console.log("\nP1 — tip primatelja je obavezan");
ok(!!L.checkLegal(decl({}), "donation").recipientType, "prazan primatelj → greška");
ok(
  L.checkLegal(decl({}), "donation").recipientType === "legal.errRecipientRequired",
  "greška nosi ispravan i18n ključ",
);
ok(
  Object.keys(L.checkLegal(decl({}), "donation")).length === 1,
  "dok se ne zna primatelj, ne gomilaju se ostale greške",
);

console.log("\nP2 — pravna osnova za donaciju fizičkoj osobi");
ok(
  L.requiresLegalBasis("individual", "donation") === true,
  "fizička osoba + donacija → osnova obavezna",
);
ok(
  L.requiresLegalBasis("individual", "crowdfund") === true,
  "fizička osoba + crowdfund → osnova obavezna",
);
ok(
  L.requiresLegalBasis("association", "donation") === false,
  "udruga → osnova nije obavezna (redovna djelatnost)",
);
ok(
  L.requiresLegalBasis("individual", "tickets") === false,
  "ulaznice nisu darovanje → nema osnove darovanja",
);
ok(
  !!L.checkLegal(decl({ recipientType: "individual" }), "donation").legalBasis,
  "fizička osoba bez osnove → greška",
);
ok(
  !L.basesFor("individual", "donation").includes("own_activity"),
  "fizičkoj osobi se NE nudi 'redovna djelatnost'",
);
ok(
  L.basesFor("association", "donation").includes("own_activity"),
  "udruzi se nudi 'redovna djelatnost'",
);
ok(
  L.checkLegal(
    decl({ recipientType: "individual", legalBasis: "own_activity", acknowledged: true }),
    "donation",
  ).legalBasis === "legal.errBasisInvalid",
  "nevaljana kombinacija osnove i primatelja se odbija",
);

console.log("\nP3 — blokada po čl. 23 ZHP-a");
const blocked = decl({
  recipientType: "individual",
  legalBasis: "humanitarian",
  selfOrFamily: "yes",
  permitRef: "UP/I-550-01/26-01/1",
  acknowledged: true,
});
ok(L.isBlocked(blocked) === true, "prikupljanje za sebe/obitelj → blokirano");
ok(
  L.checkLegal(blocked, "donation").selfOrFamily === "legal.errArticle23Blocked",
  "blokada se javlja kao greška polja, pa submit ne prolazi",
);
ok(
  L.isBlocked(decl({ ...blocked, selfOrFamily: "no" })) === false,
  "isti slučaj bez srodstva → prolazi",
);
ok(
  L.isBlocked(decl({ ...blocked, legalBasis: "public_action" })) === false,
  "javno oglašena akcija NIJE blokirana — ona upravo pretpostavlja račun osobe u potrebi",
);
ok(
  L.isBlocked(decl({ ...blocked, recipientType: "association" })) === false,
  "udruga smije organizirati akciju za treću osobu",
);
ok(
  !!L.checkLegal(
    decl({ recipientType: "individual", legalBasis: "humanitarian", acknowledged: true }),
    "donation",
  ).selfOrFamily,
  "neodgovoreno pitanje o srodstvu → greška",
);
ok(
  L.checkLegal(
    decl({
      recipientType: "individual",
      legalBasis: "humanitarian",
      selfOrFamily: "no",
      acknowledged: true,
    }),
    "donation",
  ).permitRef === "legal.errPermitRequired",
  "humanitarna akcija bez broja rješenja → greška",
);

console.log("\nPotvrda izjave i čisti prolaz");
ok(
  !!L.checkLegal(
    decl({ recipientType: "individual", legalBasis: "public_action" }),
    "donation",
  ).legalAck,
  "bez potvrde izjave → greška",
);
const clean = decl({
  recipientType: "individual",
  legalBasis: "public_action",
  acknowledged: true,
});
ok(Object.keys(L.checkLegal(clean, "donation")).length === 0, "ispravna deklaracija prolazi");
ok(
  Object.keys(L.checkLegal(decl({ recipientType: "association" }), "donation")).length === 0,
  "udruga bez osnove prolazi",
);

console.log("\nSerijalizacija u metadata i natrag");
const meta = L.toMetadata(clean, "2026-08-08T00:00:00.000Z");
ok(meta?.recipient_type === "individual", "recipient_type serijaliziran");
ok(meta?.legal_basis === "public_action", "legal_basis serijaliziran");
ok(meta?.permit_ref === null, "permit_ref je null kad osnova nije humanitarna");
ok(meta?.declared_at === "2026-08-08T00:00:00.000Z", "declared_at dolazi od pozivatelja");
ok(L.toMetadata(decl({}), "x") === null, "bez primatelja nema metadata zapisa");
const back = L.fromMetadata(meta);
ok(back.recipientType === "individual" && back.legalBasis === "public_action", "round-trip");
ok(L.fromMetadata(null).recipientType === "", "prazan metadata → prazna deklaracija");
ok(
  L.fromMetadata({ recipient_type: "hacker" }).recipientType === "",
  "nepoznat tip primatelja se odbacuje",
);
const humMeta = L.toMetadata(
  decl({
    recipientType: "individual",
    legalBasis: "humanitarian",
    selfOrFamily: "no",
    permitRef: "  UP/I-1  ",
    acknowledged: true,
  }),
  "t",
);
ok(humMeta?.permit_ref === "UP/I-1", "permit_ref se trimma");
ok(humMeta?.self_or_family === false, "self_or_family kao boolean");

console.log("\nNapomene");
ok(
  L.notesFor("company", "commercial", "donation").includes("legal.notes.companyTaxable"),
  "tvrtka dobiva upozorenje o oporezivosti",
);
ok(
  L.notesFor("association", "own_activity", "tickets").includes("legal.notes.tickets"),
  "ulaznice dobivaju upozorenje o računu i PDV-u",
);
ok(
  L.notesFor("individual", "public_action", "donation").includes("legal.notes.unspent"),
  "darovanja dobivaju upozorenje o neutrošenim sredstvima",
);

console.log(fails === 0 ? "\nSve prošlo.\n" : `\n${fails} FAIL(ova).\n`);
process.exit(fails === 0 ? 0 : 1);
