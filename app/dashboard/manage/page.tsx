"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthGate } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { fmtEur, parseEurToCents } from "@/lib/format";
import { CampaignForm } from "@/components/dashboard/campaign-form";
import { useI18n } from "@/lib/i18n";
import {
  getMyCampaign,
  updateCampaign,
  listTiers,
  createTier,
  deleteTier,
  listContributions,
  setContributionHidden,
  listPayouts,
  type MyCampaign,
  type Tier,
  type DashContribution,
  type Payout,
} from "@/lib/dashboard";

export default function ManageCampaignPage() {
  return (
    <Suspense>
      <ManageGate />
    </Suspense>
  );
}

function ManageGate() {
  const id = useSearchParams().get("id") ?? "";
  return (
    <AuthGate>
      <ManageInner id={id} />
    </AuthGate>
  );
}

function ManageInner({ id }: { id: string }) {
  const { t } = useI18n();
  const [campaign, setCampaign] = useState<MyCampaign | null | undefined>(undefined);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [contribs, setContribs] = useState<DashContribution[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [tab, setTab] = useState<"edit" | "tiers" | "contributions" | "payouts">("edit");

  const reload = useCallback(async () => {
    const c = await getMyCampaign(id);
    setCampaign(c);
    if (c) {
      const [t, ct, p] = await Promise.all([
        listTiers(id),
        listContributions(id),
        listPayouts(id),
      ]);
      setTiers(t);
      setContribs(ct);
      setPayouts(p);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (campaign === undefined) {
    return <div className="container-content py-16 text-inkMuted">{t("common.loading")}</div>;
  }
  if (campaign === null) {
    return (
      <div className="container-content py-16">
        <p className="text-inkMuted">{t("campaign.notFound")}</p>
        <Link href="/dashboard" className="text-coral hover:underline">← {t("common.back")}</Link>
      </div>
    );
  }

  async function setState(state: string) {
    await updateCampaign(id, { state });
    reload();
  }

  return (
    <div className="container-content py-12">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">← {t("common.myCampaigns")}</Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md font-display font-semibold">{campaign.title}</h1>
          <p className="mt-1 text-sm text-inkMuted">
            /{campaign.slug} · {t("manage.stateLabel")}{" "}
            <strong>{t(`states.${campaign.state}`)}</strong> ·{" "}
            {fmtEur(campaign.total_raised_cents)} € ·{" "}
            {t("units.supporters", { count: campaign.contributor_count })}{" "}
            {campaign.visibility === "public" && campaign.state !== "draft" ? (
              <>
                ·{" "}
                <Link href={`/c?slug=${campaign.slug}`} className="text-coral hover:underline" target="_blank">
                  {t("manage.publicPage")}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.state === "draft" || campaign.state === "closed" ? (
            <Button size="sm" onClick={() => setState("active")}>{t("manage.activate")}</Button>
          ) : null}
          {campaign.state === "active" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setState("draft")}>{t("manage.pause")}</Button>
              <Button size="sm" variant="outline" onClick={() => setState("closed")}>{t("manage.close")}</Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-8 flex gap-1 border-b border-ink/8">
        {([
          ["edit", t("manage.tabs.edit")],
          ["tiers", `${t("manage.tabs.tiers")} (${tiers.length})`],
          ["contributions", `${t("manage.tabs.contributions")} (${contribs.length})`],
          ["payouts", `${t("manage.tabs.payouts")} (${payouts.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              "px-4 py-2 text-sm -mb-px border-b-2 " +
              (tab === key
                ? "border-coral text-ink font-medium"
                : "border-transparent text-inkMuted hover:text-ink")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "edit" ? (
          <div className="max-w-2xl card-base">
            <CampaignForm
              submitLabel={t("manage.saveChanges")}
              initial={{
                title: campaign.title,
                type: campaign.type,
                description: campaign.description ?? "",
                goalCents: campaign.goal_cents,
                minContributionCents: campaign.min_contribution_cents,
                destinationAddress: campaign.destination_address,
                subjectType: campaign.subject_type,
                subjectRef: campaign.subject_ref,
                visibility: campaign.visibility as "private" | "unlisted" | "public",
              }}
              onSubmit={async (v) => {
                await updateCampaign(id, {
                  title: v.title,
                  type: v.type,
                  description: v.description || null,
                  goal_cents: v.goalCents,
                  min_contribution_cents: v.minContributionCents,
                  destination_address: v.destinationAddress,
                  subject_type: v.subjectType,
                  subject_ref: v.subjectRef,
                  visibility: v.visibility,
                });
                reload();
              }}
            />
          </div>
        ) : null}

        {tab === "tiers" ? (
          <TiersTab campaignId={id} tiers={tiers} onChange={reload} />
        ) : null}

        {tab === "contributions" ? <ContributionsTab rows={contribs} onChange={reload} /> : null}

        {tab === "payouts" ? <PayoutsTab rows={payouts} /> : null}
      </div>
    </div>
  );
}

function TiersTab({
  campaignId,
  tiers,
  onChange,
}: {
  campaignId: string;
  tiers: Tier[];
  onChange: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState("reward");
  const [inv, setInv] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createTier(campaignId, {
        title: title.trim(),
        description: "",
        kind,
        priceCents: parseEurToCents(price) ?? 0,
        inventoryTotal: inv.trim() ? Math.max(0, parseInt(inv, 10)) : null,
      });
      setTitle(""); setPrice(""); setInv("");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {tiers.length === 0 ? (
        <p className="text-inkMuted">{t("manage.tiers.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {tiers.map((tier) => (
            <li key={tier.id} className="card-base flex items-center justify-between !py-3">
              <div>
                <p className="font-medium">{tier.title} <span className="text-xs text-inkMuted">({tier.kind})</span></p>
                <p className="text-xs text-inkMuted">
                  {fmtEur(tier.price_cents)} €
                  {tier.inventory_total !== null ? ` · ${tier.inventory_claimed}/${tier.inventory_total}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={async () => { await deleteTier(tier.id); onChange(); }}>
                {t("manage.tiers.delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="card-base grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input className="rounded-lg border border-ink/15 px-3 py-2 text-sm sm:col-span-2" placeholder={t("manage.tiers.namePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="rounded-lg border border-ink/15 px-3 py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="reward">{t("manage.tiers.kinds.reward")}</option>
          <option value="ticket">{t("manage.tiers.kinds.ticket")}</option>
          <option value="token_tranche">{t("manage.tiers.kinds.token_tranche")}</option>
          <option value="none">{t("manage.tiers.kinds.none")}</option>
        </select>
        <input className="rounded-lg border border-ink/15 px-3 py-2 text-sm" inputMode="decimal" placeholder={t("manage.tiers.pricePlaceholder")} value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className="rounded-lg border border-ink/15 px-3 py-2 text-sm" inputMode="numeric" placeholder={t("manage.tiers.stockPlaceholder")} value={inv} onChange={(e) => setInv(e.target.value)} />
        <Button type="submit" disabled={busy} size="sm">{t("manage.tiers.add")}</Button>
      </form>
    </div>
  );
}

function ContributionsTab({
  rows,
  onChange,
}: {
  rows: DashContribution[];
  onChange: () => void;
}) {
  const { t, locale } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (rows.length === 0) return <p className="text-inkMuted">{t("manage.contribs.empty")}</p>;

  async function toggleHidden(r: DashContribution) {
    setBusyId(r.id);
    try {
      await setContributionHidden(r.id, !r.message_hidden);
      onChange();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/8 text-left text-inkMuted">
            <th className="py-2 pr-4 font-medium">{t("manage.contribs.cols.date")}</th>
            <th className="py-2 pr-4 font-medium">{t("manage.contribs.cols.name")}</th>
            <th className="py-2 pr-4 font-medium">{t("manage.contribs.cols.amount")}</th>
            <th className="py-2 pr-4 font-medium">{t("manage.contribs.cols.state")}</th>
            <th className="py-2 font-medium">{t("manage.contribs.cols.message")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ink/5 align-top">
              <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString(locale)}</td>
              <td className="py-2 pr-4">{r.display_name?.trim() || "—"}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{fmtEur(r.amount_received_cents ?? r.amount_cents)} €</td>
              <td className="py-2 pr-4">{r.state}</td>
              <td className="py-2">
                {r.message ? (
                  <div className="flex items-start gap-2">
                    <span
                      className={
                        "line-clamp-2 max-w-xs " +
                        (r.message_hidden ? "text-inkMuted line-through" : "text-ink")
                      }
                    >
                      {r.message}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleHidden(r)}
                      disabled={busyId === r.id}
                      className="shrink-0 rounded-full border border-ink/15 px-2 py-0.5 text-xs hover:border-ink/30 disabled:opacity-50"
                    >
                      {busyId === r.id ? "…" : r.message_hidden ? t("manage.contribs.show") : t("manage.contribs.hide")}
                    </button>
                  </div>
                ) : (
                  <span className="text-inkMuted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayoutsTab({ rows }: { rows: Payout[] }) {
  const { t } = useI18n();
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-inkMuted">{t("manage.payouts.intro")}</p>
      {rows.length === 0 ? (
        <p className="text-inkMuted">{t("manage.payouts.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id} className="card-base flex items-center justify-between !py-3">
              <span>{fmtEur(p.amount_cents)} € → <span className="font-mono text-xs">{p.destination}</span></span>
              <span className="text-xs text-inkMuted">{p.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
