"use client";

import { useI18n } from "@/lib/i18n";

// Build-time identifiers inlined by next.config.mjs (`env`). Lets users confirm
// which deploy they're looking at — useful given the SPA is served from
// Cloudflare's edge cache and may need a hard-refresh to update.
const REPO_URL = "https://github.com/pinka-finance/pinka-app";
const COMMIT = process.env.NEXT_PUBLIC_COMMIT ?? "unknown";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";

// The rest of the ITalk product family — same strip pinka.finance and mpt.hr
// carry, so the properties cross-reference each other consistently.
const FAMILY = [
  { label: "pinka.finance", href: "https://pinka.finance" },
  { label: "mpt.hr", href: "https://mpt.hr" },
  { label: "airkuna.com", href: "https://airkuna.com" },
  { label: "domovina.ai", href: "https://domovina.ai" },
] as const;

// This app has no legal pages of its own; privacy and terms live on the landing
// (same legal entity, same policies).
const LEGAL = [
  { key: "linkLanding", href: "https://pinka.finance" },
  { key: "linkPrivacy", href: "https://pinka.finance/privacy" },
  { key: "linkTerms", href: "https://pinka.finance/terms" },
] as const;

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
      <div className="container-content py-10 space-y-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <FooterCol
            title={t("footer.colFamily")}
            links={FAMILY.map((f) => ({ label: f.label, href: f.href }))}
          />
          <FooterCol
            title={t("footer.colLegal")}
            links={LEGAL.map((l) => ({ label: t(`footer.${l.key}`), href: l.href }))}
          />
          <p className="text-xs text-inkMuted sm:max-w-[14rem] sm:text-right">
            {t("footer.rail")}
          </p>
        </div>

        {/* Imprint mirrors mpt.hr and pinka.finance verbatim — same entity. */}
        <div className="space-y-3 border-t border-ink/8 pt-6 text-[11px] leading-relaxed text-inkMuted">
          <p>
            <span className="text-ink/70">{t("footer.imprintLead")}</span>{" "}
            {t("footer.imprint")}
          </p>
          <p>{t("footer.legalNote")}</p>
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </div>

      <div className="container-content pb-4 text-center text-[10px] text-inkMuted/70 select-none">
        v{APP_VERSION} ·{" "}
        <a
          href={`${REPO_URL}/commit/${COMMIT}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline-offset-2 hover:text-ink hover:underline"
          title={`Commit ${COMMIT} · built ${BUILD_TIME}`}
          aria-label={`Commit ${COMMIT} na GitHubu`}
        >
          {COMMIT}
        </a>
        {builtAt ? ` · ${builtAt}` : ""}
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-inkMuted font-medium">
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-inkSoft transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
