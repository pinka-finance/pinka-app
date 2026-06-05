"use client";

import type { Campaign } from "@/lib/pinka";
import { fmtEur } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { stats, goal_cents } = campaign;
  const pct =
    goal_cents && goal_cents > 0
      ? Math.min(100, Math.round((stats.total_raised_cents / goal_cents) * 100))
      : null;

  return (
    <a
      href={`/c/${campaign.slug}`}
      className="card-base block hover:-translate-y-0.5 hover:shadow-lift"
    >
      {campaign.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={campaign.cover_image_url}
          alt=""
          className="mb-4 h-40 w-full rounded-md object-cover"
        />
      ) : (
        <div className="mb-4 h-40 w-full rounded-md bg-gradient-to-br from-coral-100 to-teal-100" />
      )}
      <h3 className="text-lg font-display font-semibold leading-snug">
        {campaign.title}
      </h3>
      {campaign.description ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-inkMuted">
          {campaign.description}
        </p>
      ) : null}

      {pct !== null ? (
        <>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand">
            <div className="h-full bg-coral" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-inkMuted">
            {fmtEur(stats.total_raised_cents)} €{" "}
            {t("card.ofGoal", { goal: fmtEur(goal_cents!) })} ·{" "}
            {t("units.supporters", { count: stats.contributor_count })}
          </p>
        </>
      ) : (
        <p className="mt-4 text-xs text-inkMuted">
          {t("card.collected", { amount: fmtEur(stats.total_raised_cents) })} ·{" "}
          {t("units.supporters", { count: stats.contributor_count })}
        </p>
      )}
    </a>
  );
}
