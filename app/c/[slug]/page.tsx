import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCampaignBySlug,
  listCampaignContributions,
} from "@/lib/pinka";
import { fmtEur } from "@/lib/format";
import { ContributePanel } from "@/components/contribute-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const campaign = await getCampaignBySlug(params.slug);
  if (!campaign) return { title: "Kampanja nije pronađena" };
  return {
    title: campaign.title,
    description: campaign.description ?? undefined,
  };
}

export default async function CampaignPage({
  params,
}: {
  params: { slug: string };
}) {
  const campaign = await getCampaignBySlug(params.slug);
  if (!campaign) notFound();

  const contributions = await listCampaignContributions(campaign.id);
  const { stats, goal_cents } = campaign;
  const pct =
    goal_cents && goal_cents > 0
      ? Math.min(100, Math.round((stats.total_raised_cents / goal_cents) * 100))
      : null;

  return (
    <div className="container-content py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        {/* glavni stupac */}
        <div>
          {campaign.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.cover_image_url}
              alt=""
              className="mb-6 h-64 w-full rounded-lg object-cover"
            />
          ) : (
            <div className="mb-6 h-64 w-full rounded-lg bg-gradient-to-br from-coral-100 to-teal-100" />
          )}
          <span className="eyebrow">{campaignTypeLabel(campaign.type)}</span>
          <h1 className="mt-4 text-display-md font-display font-semibold">
            {campaign.title}
          </h1>
          {campaign.description ? (
            <p className="mt-4 whitespace-pre-line text-inkSoft">
              {campaign.description}
            </p>
          ) : null}

          {contributions.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-lg font-display font-semibold">
                Zid podrške
              </h2>
              <ul className="mt-4 space-y-3">
                {contributions.map((c) => (
                  <li key={c.id} className="card-base !p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {c.display_name?.trim() || "Anoniman"}
                      </span>
                      <span className="text-coral-700">
                        {fmtEur(c.amount_cents)} €
                      </span>
                    </div>
                    {c.message ? (
                      <p className="mt-1 text-sm text-inkMuted">{c.message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* sidebar: napredak + doprinos */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="card-base">
            <p className="text-3xl font-display font-semibold">
              {fmtEur(stats.total_raised_cents)} €
            </p>
            {goal_cents ? (
              <>
                <p className="mt-1 text-sm text-inkMuted">
                  od cilja {fmtEur(goal_cents)} €
                </p>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className="h-full bg-coral"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-inkMuted">prikupljeno</p>
            )}
            <p className="mt-3 text-sm text-inkMuted">
              {stats.contributor_count} podržavatelja ·{" "}
              {stats.contribution_count} uplata
            </p>
          </div>

          <ContributePanel
            campaignId={campaign.id}
            minContributionCents={campaign.min_contribution_cents}
          />
        </aside>
      </div>
    </div>
  );
}

function campaignTypeLabel(type: string): string {
  switch (type) {
    case "donation":
      return "Donacija";
    case "crowdfund":
      return "Crowdfunding";
    case "tokenization":
      return "Tokenizacija";
    case "tickets":
      return "Ulaznice";
    case "realestate":
      return "Nekretnina";
    default:
      return "Kampanja";
  }
}
