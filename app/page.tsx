"use client";

import { useEffect, useState } from "react";
import { listPublicCampaigns, type Campaign } from "@/lib/pinka";
import { CampaignCard } from "@/components/campaign-card";

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    listPublicCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  return (
    <div className="container-content py-14">
      <div className="max-w-2xl">
        <span className="eyebrow">pinka.finance</span>
        <h1 className="mt-4 text-display-md font-display font-semibold">
          Podrži kampanje jednim skenom
        </h1>
        <p className="mt-3 text-inkMuted">
          SEPA Instant + Monerium EURe. Bez kartičnih provizija, bez čekanja —
          sredstva idu izravno autoru, transparentno na Gnosis lancu.
        </p>
      </div>

      {campaigns === null ? (
        <p className="mt-12 text-inkMuted">Učitavam…</p>
      ) : campaigns.length === 0 ? (
        <div className="mt-12 card-base text-center text-inkMuted">
          Trenutno nema aktivnih kampanja.
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
