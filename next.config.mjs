import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Build-time identifiers so the deployed SPA can show users which build they're
// looking at — confirms whether a hard-refresh actually picked up a fresh
// Cloudflare Pages deploy. Inlined into the client bundle via `env` below.
const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
})();
const buildTime = new Date().toISOString();
const appVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT: commit,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  // Static export → Cloudflare Pages (SPA). All data is read client-side via the
  // public anon key (RLS-gated), so no server runtime is needed. Public campaign
  // pages use ?slug= query params (no dynamic SSR routes) so export stays clean.
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
