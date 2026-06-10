"use client";

import { useEffect, useState } from "react";
import { listPublicCampaigns, type Campaign } from "@/lib/pinka";
import { CampaignCard } from "@/components/campaign-card";
import { useI18n } from "@/lib/i18n";

export default function HomePage() {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    listPublicCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  return (
    <div className="container-content py-16">
      <div className="max-w-2xl">
        <span className="eyebrow">{t("home.eyebrow")}</span>
        <h1 className="mt-5 text-display-md font-display font-semibold">
          {t("home.title")}
        </h1>
        <p className="mt-4 leading-relaxed text-inkMuted">{t("home.subtitle")}</p>
      </div>

      {campaigns === null ? (
        <p className="mt-12 text-inkMuted">{t("common.loading")}</p>
      ) : campaigns.length === 0 ? (
        <div className="mt-12 card-base text-center text-inkMuted">
          {t("home.empty")}
        </div>
      ) : (
        <div className="mt-14 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
