"use client";

import { useI18n } from "@/lib/i18n";

// Build-time identifiers inlined by next.config.mjs (`env`). Lets users confirm
// which deploy they're looking at — useful given the SPA is served from
// Cloudflare's edge cache and may need a hard-refresh to update.
const REPO_URL = "https://github.com/pinka-finance/pinka-app";
const COMMIT = process.env.NEXT_PUBLIC_COMMIT ?? "unknown";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";

function formatBuildTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export function SiteFooter() {
  const { t } = useI18n();
  const builtAt = formatBuildTime(BUILD_TIME);
  return (
    <footer className="mt-24 border-t border-ink/8">
      <div className="container-content flex h-20 items-center justify-between text-sm text-inkMuted">
        <span>{t("footer.copyright")}</span>
        <span>{t("footer.rail")}</span>
      </div>
      <div className="container-content pb-4 text-center text-[10px] text-inkMuted/70 select-none">
        v{APP_VERSION} ·{" "}
        <a
          href={`${REPO_URL}/commit/${COMMIT}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline-offset-2 hover:text-ink hover:underline"
          title={`Commit ${COMMIT} · built ${BUILD_TIME}`}
        >
          {COMMIT}
        </a>
        {builtAt ? ` · ${builtAt}` : ""}
      </div>
    </footer>
  );
}
