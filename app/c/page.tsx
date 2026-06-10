"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Landmark } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getCampaignBySlug,
  listCampaignContributions,
  type Campaign,
  type PublicContribution,
} from "@/lib/pinka";
import { fmtEur } from "@/lib/format";
import { ContributePanel } from "@/components/contribute-panel";
import { PermanentQr } from "@/components/permanent-qr";
import { useI18n } from "@/lib/i18n";

// EURe (Monerium) on Gnosis — the canonical proxy 0x420CA0f9 that the rail uses
// and that EMITS the Transfer events to the campaign Safe (verified on-chain).
// NB: 0xcB444e90 ("EUR emoney") is the implementation address; transfers don't
// show under its token page. Use the proxy for the public verification links.
const EURE_GNOSIS = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430";

export default function CampaignPage() {
  return (
    <Suspense>
      <CampaignInner />
    </Suspense>
  );
}

function CampaignInner() {
  const { t } = useI18n();
  // Pretty URL: /c/{slug} (route param). Backward-compat: /c?slug={slug}.
  // CF Pages servira out/c.html za /c/* (vidi public/_redirects), pa slug
  // čitamo iz pathname-a, a query je fallback za stare linkove.
  const search = useSearchParams();
  const pathname = usePathname();
  const pathSlug = pathname?.match(/^\/c\/(.+?)\/?$/)?.[1];
  const slug = pathSlug ? decodeURIComponent(pathSlug) : (search.get("slug") ?? "");
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [contributions, setContributions] = useState<PublicContribution[]>([]);
  // ids that just arrived → play the wall "arrive" animation once
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  // Re-fetch campaign (live stats) + contributions; flag newly-seen ids so the
  // wall can animate them in. Called on mount, on a 12s poll, and immediately
  // when the user's own contribution flips paid (ContributePanel onPaid).
  const refresh = useCallback(async () => {
    if (!slug) return;
    const c = await getCampaignBySlug(slug);
    if (!c) {
      setCampaign((prev) => (prev === undefined ? null : prev));
      return;
    }
    setCampaign(c);
    const list = await listCampaignContributions(c.id);
    setContributions(list);
    if (firstLoadRef.current) {
      list.forEach((x) => seenRef.current.add(x.id));
      firstLoadRef.current = false;
      return;
    }
    const fresh = list.filter((x) => !seenRef.current.has(x.id));
    if (fresh.length) {
      fresh.forEach((x) => seenRef.current.add(x.id));
      setFlashIds(new Set(fresh.map((x) => x.id)));
      setTimeout(() => setFlashIds(new Set()), 2400);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setCampaign(null);
      return;
    }
    void refresh();
    const t = setInterval(() => void refresh(), 12000);
    return () => clearInterval(t);
  }, [slug, refresh]);

  // Campaign pages own their document title (the campaign name) for SEO/sharing.
  useEffect(() => {
    if (campaign) document.title = `${campaign.title} · pinka`;
  }, [campaign]);

  if (campaign === undefined) {
    return <div className="container-content py-16 text-inkMuted">{t("common.loading")}</div>;
  }
  if (campaign === null) {
    return (
      <div className="container-content py-16">
        <p className="text-inkMuted">{t("campaign.notFound")}</p>
        <Link href="/" className="text-coral hover:underline">← {t("common.allCampaigns")}</Link>
      </div>
    );
  }

  const { stats, goal_cents } = campaign;
  const pct =
    goal_cents && goal_cents > 0
      ? Math.min(100, Math.round((stats.total_raised_cents / goal_cents) * 100))
      : null;

  return (
    <div className="container-content py-14">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">
        <div>
          {campaign.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={campaign.cover_image_url} alt="" className="mb-6 h-64 w-full rounded-lg object-cover" />
          ) : (
            <div className="mb-6 h-64 w-full rounded-lg bg-gradient-to-br from-coral-100 to-teal-100" />
          )}
          <span className="eyebrow">{t(campaignTypeKey(campaign.type))}</span>
          <h1 className="mt-5 text-display-md font-display font-semibold">{campaign.title}</h1>
          {campaign.description ? (
            <p className="mt-5 whitespace-pre-line leading-relaxed text-inkSoft">{campaign.description}</p>
          ) : null}

          {contributions.length > 0 ? (
            <section className="mt-14">
              <h2 className="text-lg font-display font-semibold">{t("campaign.supportWall")}</h2>
              <ul className="mt-5 space-y-4">
                {contributions.map((c) => (
                  <li
                    key={c.id}
                    className={"card-base !p-5 " + (flashIds.has(c.id) ? "pinka-arrive" : "")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        {c.display_name?.trim() || t("campaign.anonymous")}
                        {c.identity_double_verified ? (
                          <span
                            title={t("campaign.doubleVerifiedTitle")}
                            className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {t("campaign.doubleVerifiedBadge")}
                          </span>
                        ) : c.verified ? (
                          <span
                            title={t("campaign.verifiedTitle")}
                            className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {t("campaign.verifiedBadge")}
                          </span>
                        ) : c.bank_verified ? (
                          <span
                            title={t("campaign.bankVerifiedTitle")}
                            className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium text-inkSoft"
                          >
                            <Landmark className="h-3 w-3" />
                            {t("campaign.bankVerifiedBadge")}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-coral-700">{fmtEur(c.amount_cents)} €</span>
                    </div>
                    {c.message ? (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-inkMuted">
                        <Linkify text={c.message} />
                      </p>
                    ) : null}
                    {c.link_preview &&
                    (c.link_preview.title ||
                      c.link_preview.description ||
                      c.link_preview.image) ? (
                      <a
                        href={c.link_preview.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="mt-3 block overflow-hidden rounded-lg border border-ink/10 bg-white/70 transition-colors hover:border-coral/40"
                      >
                        {c.link_preview.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.link_preview.image}
                            alt=""
                            loading="lazy"
                            // Prikaži u stvarnom omjeru dobivenog og:image-a
                            // (bez fiksne visine/cropa). object-contain čuva omjer.
                            className="w-full h-auto object-contain"
                          />
                        ) : null}
                        <div className="p-3">
                          <p className="text-[11px] uppercase tracking-wide text-inkMuted">
                            {c.link_preview.siteName ?? t("campaign.linkFallback")} ↗
                          </p>
                          {c.link_preview.title ? (
                            <p className="mt-0.5 line-clamp-2 text-sm font-medium text-ink">
                              {c.link_preview.title}
                            </p>
                          ) : null}
                          {c.link_preview.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-inkMuted">
                              {c.link_preview.description}
                            </p>
                          ) : null}
                        </div>
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <div className="card-base">
            <p className="text-3xl font-display font-semibold">{fmtEur(stats.total_raised_cents)} €</p>
            {goal_cents ? (
              <>
                <p className="mt-1.5 text-sm text-inkMuted">{t("campaign.ofGoal", { goal: fmtEur(goal_cents) })}</p>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-sand">
                  <div className="h-full bg-coral" style={{ width: `${pct}%` }} />
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-inkMuted">{t("campaign.collected")}</p>
            )}
            <p className="mt-4 text-sm text-inkMuted">
              {t("units.supporters", { count: stats.contributor_count })} ·{" "}
              {t("units.contributions", { count: stats.contribution_count })}
            </p>
          </div>

          <ContributePanel
            campaignId={campaign.id}
            minContributionCents={campaign.min_contribution_cents}
            destinationAddress={campaign.destination_address}
            onPaid={refresh}
          />

          {campaign.destination_address ? (
            <PermanentQr
              campaignId={campaign.id}
              destinationAddress={campaign.destination_address}
            />
          ) : null}

          {campaign.destination_address ? (
            <div className="card-base">
              <h3 className="text-sm font-display font-semibold">{t("campaign.verifyTitle")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-inkMuted">
                {t("campaign.verifyDesc")}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={`https://gnosisscan.io/token/${EURE_GNOSIS}?a=${campaign.destination_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-coral-700 hover:underline"
                >
                  {t("campaign.eureBalance")}
                </a>
                <a
                  href={`https://gnosisscan.io/address/${campaign.destination_address}#tokentxns`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-coral-700 hover:underline"
                >
                  {t("campaign.inflowHistory")}
                </a>
              </div>
              <p className="mt-3 break-all font-mono text-[11px] text-inkMuted">
                {campaign.destination_address}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// Render plain-text message, turning http(s) URLs into safe external links.
// React escapes the text nodes; links get nofollow + noopener to avoid passing
// SEO/referrer juice or window.opener to arbitrary donor-supplied targets.
// (Rich OG previews are Phase B.)
function Linkify({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="break-all text-coral-700 underline"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

// Maps a campaign type to its i18n key under `campaign.types.*`.
function campaignTypeKey(type: string): string {
  switch (type) {
    case "donation": return "campaign.types.donation";
    case "crowdfund": return "campaign.types.crowdfund";
    case "tokenization": return "campaign.types.tokenization";
    case "tickets": return "campaign.types.tickets";
    case "realestate": return "campaign.types.realestate";
    default: return "campaign.types.generic";
  }
}
