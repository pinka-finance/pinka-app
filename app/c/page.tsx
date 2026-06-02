"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getCampaignBySlug,
  listCampaignContributions,
  type Campaign,
  type PublicContribution,
} from "@/lib/pinka";
import { fmtEur } from "@/lib/format";
import { ContributePanel } from "@/components/contribute-panel";

// EURe (Monerium) on Gnosis — used to deep-link the campaign Safe's on-chain
// balance so anyone can verify funds independently of our offchain status.
const EURE_GNOSIS = "0xcB444e90D8198415266c6a2724b7900fb12FC56E";

export default function CampaignPage() {
  return (
    <Suspense>
      <CampaignInner />
    </Suspense>
  );
}

function CampaignInner() {
  const slug = useSearchParams().get("slug") ?? "";
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [contributions, setContributions] = useState<PublicContribution[]>([]);

  useEffect(() => {
    if (!slug) {
      setCampaign(null);
      return;
    }
    getCampaignBySlug(slug).then(async (c) => {
      setCampaign(c);
      if (c) setContributions(await listCampaignContributions(c.id));
    });
  }, [slug]);

  if (campaign === undefined) {
    return <div className="container-content py-16 text-inkMuted">Učitavam…</div>;
  }
  if (campaign === null) {
    return (
      <div className="container-content py-16">
        <p className="text-inkMuted">Kampanja nije pronađena.</p>
        <Link href="/" className="text-coral hover:underline">← Sve kampanje</Link>
      </div>
    );
  }

  const { stats, goal_cents } = campaign;
  const pct =
    goal_cents && goal_cents > 0
      ? Math.min(100, Math.round((stats.total_raised_cents / goal_cents) * 100))
      : null;

  return (
    <div className="container-content py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          {campaign.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={campaign.cover_image_url} alt="" className="mb-6 h-64 w-full rounded-lg object-cover" />
          ) : (
            <div className="mb-6 h-64 w-full rounded-lg bg-gradient-to-br from-coral-100 to-teal-100" />
          )}
          <span className="eyebrow">{campaignTypeLabel(campaign.type)}</span>
          <h1 className="mt-4 text-display-md font-display font-semibold">{campaign.title}</h1>
          {campaign.description ? (
            <p className="mt-4 whitespace-pre-line text-inkSoft">{campaign.description}</p>
          ) : null}

          {contributions.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-lg font-display font-semibold">Zid podrške</h2>
              <ul className="mt-4 space-y-3">
                {contributions.map((c) => (
                  <li key={c.id} className="card-base !p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.display_name?.trim() || "Anoniman"}</span>
                      <span className="text-coral-700">{fmtEur(c.amount_cents)} €</span>
                    </div>
                    {c.message ? <p className="mt-1 text-sm text-inkMuted">{c.message}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="card-base">
            <p className="text-3xl font-display font-semibold">{fmtEur(stats.total_raised_cents)} €</p>
            {goal_cents ? (
              <>
                <p className="mt-1 text-sm text-inkMuted">od cilja {fmtEur(goal_cents)} €</p>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-sand">
                  <div className="h-full bg-coral" style={{ width: `${pct}%` }} />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-inkMuted">prikupljeno</p>
            )}
            <p className="mt-3 text-sm text-inkMuted">
              {stats.contributor_count} podržavatelja · {stats.contribution_count} uplata
            </p>
          </div>

          <ContributePanel
            campaignId={campaign.id}
            minContributionCents={campaign.min_contribution_cents}
          />

          {campaign.destination_address ? (
            <div className="card-base">
              <h3 className="text-sm font-display font-semibold">Provjeri na lancu</h3>
              <p className="mt-1 text-xs leading-relaxed text-inkMuted">
                Uplate stižu izravno na Safe kampanje (EURe na Gnosis lancu).
                Stanje može provjeriti bilo tko — neovisno o nama.
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                <a
                  href={`https://gnosisscan.io/token/${EURE_GNOSIS}?a=${campaign.destination_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-coral-700 hover:underline"
                >
                  EURe saldo na Gnosisscanu ↗
                </a>
                <a
                  href={`https://gnosisscan.io/address/${campaign.destination_address}#tokentxns`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-coral-700 hover:underline"
                >
                  Povijest priljeva (transferi) ↗
                </a>
              </div>
              <p className="mt-2 break-all font-mono text-[11px] text-inkMuted">
                {campaign.destination_address}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function campaignTypeLabel(type: string): string {
  switch (type) {
    case "donation": return "Donacija";
    case "crowdfund": return "Crowdfunding";
    case "tokenization": return "Tokenizacija";
    case "tickets": return "Ulaznice";
    case "realestate": return "Nekretnina";
    default: return "Kampanja";
  }
}
