"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { fmtEur, parseEurToCents } from "@/lib/format";
import { CampaignForm } from "@/components/dashboard/campaign-form";
import {
  getMyCampaign,
  updateCampaign,
  listTiers,
  createTier,
  deleteTier,
  listContributions,
  listPayouts,
  type MyCampaign,
  type Tier,
  type DashContribution,
  type Payout,
} from "@/lib/dashboard";

export default function ManageCampaignPage({ params }: { params: { id: string } }) {
  return (
    <AuthGate>
      <ManageInner id={params.id} />
    </AuthGate>
  );
}

function ManageInner({ id }: { id: string }) {
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
    return <div className="container-content py-16 text-inkMuted">Učitavam…</div>;
  }
  if (campaign === null) {
    return (
      <div className="container-content py-16">
        <p className="text-inkMuted">Kampanja nije pronađena.</p>
        <Link href="/dashboard" className="text-coral hover:underline">← Natrag</Link>
      </div>
    );
  }

  async function setState(state: string) {
    await updateCampaign(id, { state });
    reload();
  }

  return (
    <div className="container-content py-12">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">← Moje kampanje</Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md font-display font-semibold">{campaign.title}</h1>
          <p className="mt-1 text-sm text-inkMuted">
            /{campaign.slug} · stanje: <strong>{campaign.state}</strong> ·{" "}
            {fmtEur(campaign.total_raised_cents)} € · {campaign.contributor_count} podržavatelja{" "}
            {campaign.visibility === "public" && campaign.state !== "draft" ? (
              <>
                ·{" "}
                <Link href={`/c/${campaign.slug}`} className="text-coral hover:underline" target="_blank">
                  javna stranica ↗
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.state === "draft" || campaign.state === "closed" ? (
            <Button size="sm" onClick={() => setState("active")}>Aktiviraj</Button>
          ) : null}
          {campaign.state === "active" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setState("draft")}>Pauziraj</Button>
              <Button size="sm" variant="outline" onClick={() => setState("closed")}>Zatvori</Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-8 flex gap-1 border-b border-ink/8">
        {([
          ["edit", "Uredi"],
          ["tiers", `Nagrade (${tiers.length})`],
          ["contributions", `Doprinosi (${contribs.length})`],
          ["payouts", `Isplate (${payouts.length})`],
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
              submitLabel="Spremi promjene"
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

        {tab === "contributions" ? <ContributionsTab rows={contribs} /> : null}

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
        <p className="text-inkMuted">Nema nagrada/razina.</p>
      ) : (
        <ul className="space-y-2">
          {tiers.map((t) => (
            <li key={t.id} className="card-base flex items-center justify-between !py-3">
              <div>
                <p className="font-medium">{t.title} <span className="text-xs text-inkMuted">({t.kind})</span></p>
                <p className="text-xs text-inkMuted">
                  {fmtEur(t.price_cents)} €
                  {t.inventory_total !== null ? ` · ${t.inventory_claimed}/${t.inventory_total}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={async () => { await deleteTier(t.id); onChange(); }}>
                Obriši
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="card-base grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input className="rounded-lg border border-ink/15 px-3 py-2 text-sm sm:col-span-2" placeholder="Naziv nagrade" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="rounded-lg border border-ink/15 px-3 py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="reward">Nagrada</option>
          <option value="ticket">Ulaznica</option>
          <option value="token_tranche">Token tranša</option>
          <option value="none">Bez</option>
        </select>
        <input className="rounded-lg border border-ink/15 px-3 py-2 text-sm" inputMode="decimal" placeholder="Cijena €" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className="rounded-lg border border-ink/15 px-3 py-2 text-sm" inputMode="numeric" placeholder="Zaliha (prazno = ∞)" value={inv} onChange={(e) => setInv(e.target.value)} />
        <Button type="submit" disabled={busy} size="sm">Dodaj nagradu</Button>
      </form>
    </div>
  );
}

function ContributionsTab({ rows }: { rows: DashContribution[] }) {
  if (rows.length === 0) return <p className="text-inkMuted">Još nema doprinosa.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/8 text-left text-inkMuted">
            <th className="py-2 pr-4 font-medium">Datum</th>
            <th className="py-2 pr-4 font-medium">Ime</th>
            <th className="py-2 pr-4 font-medium">Iznos</th>
            <th className="py-2 pr-4 font-medium">Stanje</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ink/5">
              <td className="py-2 pr-4">{new Date(r.created_at).toLocaleDateString("hr")}</td>
              <td className="py-2 pr-4">{r.display_name?.trim() || "—"}</td>
              <td className="py-2 pr-4">{fmtEur(r.amount_received_cents ?? r.amount_cents)} €</td>
              <td className="py-2 pr-4">{r.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayoutsTab({ rows }: { rows: Payout[] }) {
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-inkMuted">
        EURe stiže izravno na odredišni Safe kampanje. Isplata (Monerium redeem u
        SEPA) pokreće se preko Safe-a / ops procesa — ovdje je povijest.
      </p>
      {rows.length === 0 ? (
        <p className="text-inkMuted">Nema zabilježenih isplata.</p>
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
