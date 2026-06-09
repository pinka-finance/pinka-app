// Postbuild: write out/version.json so the deployed SPA can detect when a newer
// deploy exists than the bundle the user currently has loaded. pinka is a static
// export (NOT a PWA — no service worker), so the "Ažuriraj" banner can't rely on
// SW update events like the wallet does; instead the client polls this file and
// compares its `commit` to the NEXT_PUBLIC_COMMIT baked into the running bundle.
// `commit` here matches next.config.mjs (same HEAD); buildTime may differ by a
// few seconds (config runs at build start, this at the end) — the banner only
// ever compares `commit`.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
} catch {
  // no git in the build env → leave "unknown"; the banner stays disabled.
}

const version = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

const payload = { commit, version, buildTime: new Date().toISOString() };
writeFileSync(
  new URL("../out/version.json", import.meta.url),
  JSON.stringify(payload) + "\n",
);
console.log("[gen-version] wrote out/version.json", payload);
