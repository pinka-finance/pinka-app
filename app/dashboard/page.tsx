"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { fmtEur } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  getMyAccountId,
  listMyCampaigns,
  type MyCampaign,
} from "@/lib/dashboard";

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardInner />
    </AuthGate>
  );
}

function DashboardInner() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const [campaigns, setCampaigns] = useState<MyCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const acct = await getMyAccountId();
        if (!acct) {
          setCampaigns([]);
          return;
        }
        setCampaigns(await listMyCampaigns(acct));
      } catch (e) {
        console.error(e);
        setError("dashboard.loadFailed");
      }
    })();
  }, []);

  return (
    <div className="container-content py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-md font-display font-semibold">{t("dashboard.title")}</h1>
          <p className="mt-1 text-sm text-inkMuted">{user?.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href="/dashboard/new">{t("dashboard.newCampaign")}</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            {t("dashboard.signOut")}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-8 text-rust">{t(error)}</p> : null}

      {campaigns === null ? (
        <p className="mt-12 text-inkMuted">{t("common.loading")}</p>
      ) : campaigns.length === 0 ? (
        <div className="mt-12 card-base text-center text-inkMuted">
          {t("dashboard.empty")}
        </div>
      ) : (
        <div className="mt-10 space-y-3">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/manage?id=${c.id}`}
              className="card-base flex items-center justify-between !py-4 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-inkMuted">
                  /{c.slug} · <StateBadge state={c.state} /> · {c.visibility}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{fmtEur(c.total_raised_cents)} €</p>
                <p className="text-xs text-inkMuted">
                  {t("units.supporters", { count: c.contributor_count })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const { t } = useI18n();
  const known = ["draft", "active", "funded", "closed", "cancelled"];
  return (
    <span className="text-coral-700">
      {known.includes(state) ? t(`states.${state}`) : state}
    </span>
  );
}
