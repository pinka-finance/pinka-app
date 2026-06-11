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
  campaignDates,
  setCampaignSafe,
  listTiers,
  createTier,
  deleteTier,
  listContributions,
  setContributionHidden,
  listMembers,
  cancelSubscription,
  listPayouts,
  type MyCampaign,
  type Tier,
  type DashContribution,
  type Member,
  type Payout,
} from "@/lib/dashboard";
import { connectWallet } from "@/lib/chain/walletSdk";
import { deriveCampaignSafeFromSigner } from "@/lib/chain/safe";
import { isSafeSet } from "@/lib/chain/constants";

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
  const [members, setMembers] = useState<Member[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [tab, setTab] = useState<"edit" | "tiers" | "contributions" | "members" | "payouts">("edit");

  const reload = useCallback(async () => {
    const c = await getMyCampaign(id);
    setCampaign(c);
    if (c) {
      const [t, ct, m, p] = await Promise.all([
        listTiers(id),
        listContributions(id),
        listMembers(id),
        listPayouts(id),
      ]);
      setTiers(t);
      setContribs(ct);
      setMembers(m);
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

  const safeSet = isSafeSet(campaign.destination_address);

  async function setState(state: string) {
    // Bez deriviranog Safe-a kampanja ne smije postati aktivna (donacije bi išle
    // na nultu adresu i spalile se). Drži je u draftu dok Safe nije postavljen.
    if (state === "active" && !safeSet) {
      alert(t("manage.safe.lockHint"));
      return;
    }
    await updateCampaign(id, { state });
    reload();
  }

  return (
    <div className="container-content py-14">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">← {t("common.myCampaigns")}</Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md font-display font-semibold">{campaign.title}</h1>
          <p className="mt-2 text-sm text-inkMuted">
            /{campaign.slug} · {t("manage.stateLabel")}{" "}
            <strong>{t(`states.${campaign.state}`)}</strong> ·{" "}
            {fmtEur(campaign.total_raised_cents)} € ·{" "}
            {t("units.supporters", { count: campaign.contributor_count })}{" "}
            {campaign.visibility === "public" && campaign.state !== "draft" ? (
              <>
                ·{" "}
                <Link href={`/c/${campaign.slug}`} className="text-coral hover:underline" target="_blank">
                  {t("manage.publicPage")}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
         <div className="flex gap-2">
          {campaign.state === "draft" || campaign.state === "closed" ? (
            <Button
              size="sm"
              onClick={() => setState("active")}
              disabled={!safeSet}
              title={safeSet ? undefined : t("manage.safe.lockHint")}
            >
              {t("manage.activate")}
            </Button>
          ) : null}
          {campaign.state === "active" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setState("draft")}>{t("manage.pause")}</Button>
              <Button size="sm" variant="outline" onClick={() => setState("closed")}>{t("manage.close")}</Button>
            </>
          ) : null}
         </div>
         {!safeSet && (campaign.state === "draft" || campaign.state === "closed") ? (
           <p className="text-xs text-amber-700">{t("manage.safe.lockHint")}</p>
         ) : null}
        </div>
      </div>

      <div className="mt-10 flex gap-1 border-b border-ink/8">
        {([
          ["edit", t("manage.tabs.edit")],
          ["tiers", `${t("manage.tabs.tiers")} (${tiers.length})`],
          ["contributions", `${t("manage.tabs.contributions")} (${contribs.length})`],
          ["members", `${t("manage.tabs.members")} (${members.length})`],
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

      <div className="mt-10">
        {tab === "edit" ? (
          <div className="max-w-2xl space-y-7">
            <SafeDerivePanel
              campaignId={id}
              destination={campaign.destination_address}
              onDerived={reload}
            />
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
                recurrence: campaign.recurrence,
                recurrenceAnchorDay: campaign.recurrence_anchor_day,
                latitude: campaign.latitude,
                longitude: campaign.longitude,
                locationName: campaign.location_name,
                coverImageUrl: campaign.cover_image_url,
                startsAt: campaign.starts_at,
                endsAt: campaign.ends_at,
              }}
              onSubmit={async (v) => {
                // Ne dopusti izlazak iz 'private' dok Safe (spremana adresa) nije
                // postavljen — inače bi javna/aktivna kampanja primala donacije na nultu adresu.
                if (v.visibility !== "private" && !isSafeSet(v.destinationAddress)) {
                  alert(t("manage.safe.blockPublic"));
                  return;
                }
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
                  recurrence: v.recurrence,
                  recurrence_anchor_day: v.recurrenceAnchorDay,
                  latitude: v.latitude,
                  longitude: v.longitude,
                  location_name: v.locationName,
                  cover_image_url: v.coverImageUrl,
                  starts_at: campaignDates.start(v.startsAt),
                  ends_at: campaignDates.end(v.endsAt),
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

        {tab === "members" ? <MembersTab rows={members} onChange={reload} /> : null}

        {tab === "payouts" ? <PayoutsTab rows={payouts} /> : null}
      </div>
    </div>
  );
}

// Derivira per-campaign Gnosis Safe iz korisnikovog passkey signera (Google/Apple
// preko DOMOVINA Wallet SDK-a) i upiše ga kao destination_address. Safe je
// deterministički iz campaign.id (salt = keccak256("pinka:campaign:{id}")), pa se
// poklapa s onim što relay kasnije deploya. Jedini client-side dio cijelog flowa.
function SafeDerivePanel({
  campaignId,
  destination,
  onDerived,
}: {
  campaignId: string;
  destination: string;
  onDerived: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [signer, setSigner] = useState<string | null>(null);

  const isSet = isSafeSet(destination);

  async function derive() {
    setBusy(true);
    setErr(null);
    try {
      const wallet = await connectWallet(); // passkey → ecosystem signer
      const safe = await deriveCampaignSafeFromSigner(
        wallet.signerAddress,
        campaignId,
      );
      await setCampaignSafe(campaignId, safe.safeAddress, {
        signer_address: safe.signerAddress,
        salt_nonce: safe.saltNonce,
        safe_version: "1.4.1",
        source: "dashboard-derive",
      });
      setSigner(safe.signerAddress);
      onDerived();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={"card-base " + (isSet ? "" : "border-amber-400 bg-amber-50/40")}>
      <h3 className="font-medium">{t("manage.safe.title")}</h3>
      <p className="mt-1 text-sm text-inkMuted">
        {isSet ? t("manage.safe.set") : t("manage.safe.unset")}
      </p>

      <div className="mt-3 break-all font-mono text-xs">
        {isSet ? destination : "0x0000…0000 (placeholder)"}
      </div>

      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      {signer ? (
        <p className="mt-2 text-xs text-inkMuted">
          signer: <span className="font-mono">{signer}</span>
        </p>
      ) : null}

      <div className="mt-4">
        <Button size="sm" onClick={derive} disabled={busy}>
          {busy
            ? t("common.loading")
            : isSet
              ? t("manage.safe.rederive")
              : t("manage.safe.derive")}
        </Button>
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
        <ul className="space-y-3">
          {tiers.map((tier) => (
            <li key={tier.id} className="card-base flex items-center justify-between !py-4">
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

function MembersTab({
  rows,
  onChange,
}: {
  rows: Member[];
  onChange: () => void;
}) {
  const { t, locale } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (rows.length === 0)
    return (
      <div className="max-w-2xl space-y-2">
        <p className="text-inkMuted">{t("manage.members.empty")}</p>
        <p className="text-xs text-inkMuted">{t("manage.members.intro")}</p>
      </div>
    );

  async function cancel(m: Member) {
    if (!confirm(t("manage.members.cancelConfirm"))) return;
    setBusyId(m.id);
    try {
      await cancelSubscription(m.id);
      onChange();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(locale) : "—";

  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-xs text-inkMuted">{t("manage.members.intro")}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/8 text-left text-inkMuted">
              <th className="py-2 pr-4 font-medium">{t("manage.members.cols.name")}</th>
              <th className="py-2 pr-4 font-medium">{t("manage.members.cols.status")}</th>
              <th className="py-2 pr-4 font-medium">{t("manage.members.cols.cadence")}</th>
              <th className="py-2 pr-4 font-medium">{t("manage.members.cols.count")}</th>
              <th className="py-2 pr-4 font-medium">{t("manage.members.cols.total")}</th>
              <th className="py-2 pr-4 font-medium">{t("manage.members.cols.last")}</th>
              <th className="py-2 pr-4 font-medium">{t("manage.members.cols.next")}</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-ink/5 align-top">
                <td className="py-2 pr-4">{m.display_name?.trim() || t("manage.members.anonymous")}</td>
                <td className="py-2 pr-4">
                  <MemberStatusPill status={m.effective_status} />
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">{t(`manage.members.cadences.${m.effective_cadence}`)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{m.contribution_count}×</td>
                <td className="py-2 pr-4 whitespace-nowrap">{fmtEur(m.total_cents)} €</td>
                <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(m.last_contribution_at)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {m.effective_status === "cancelled" ? "—" : fmtDate(m.next_expected_at)}
                </td>
                <td className="py-2">
                  {m.effective_status !== "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => cancel(m)}
                      disabled={busyId === m.id}
                      className="shrink-0 rounded-full border border-ink/15 px-2 py-0.5 text-xs hover:border-ink/30 disabled:opacity-50"
                    >
                      {busyId === m.id ? "…" : t("manage.members.cancel")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberStatusPill({ status }: { status: Member["effective_status"] }) {
  const { t } = useI18n();
  const cls =
    status === "active"
      ? "bg-teal-100 text-teal-800"
      : status === "lapsed"
        ? "bg-amber-100 text-amber-800"
        : "bg-ink/5 text-inkMuted";
  return (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + cls}>
      {t(`manage.members.statuses.${status}`)}
    </span>
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
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="card-base flex items-center justify-between !py-4">
              <span>{fmtEur(p.amount_cents)} € → <span className="font-mono text-xs">{p.destination}</span></span>
              <span className="text-xs text-inkMuted">{p.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
