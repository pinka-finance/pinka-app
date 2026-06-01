"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CampaignType } from "@/lib/pinka";
import { parseEurToCents } from "@/lib/format";

export interface CampaignFormValues {
  title: string;
  type: CampaignType;
  description: string;
  goalCents: number | null;
  minContributionCents: number;
  destinationAddress: string;
  subjectType: string;
  subjectRef: string | null;
  visibility: "private" | "unlisted" | "public";
}

const inputCls =
  "w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-ink/30 focus:outline-none";
const labelCls = "block text-sm font-medium mb-1";

const TYPES: { value: CampaignType; label: string }[] = [
  { value: "donation", label: "Donacija" },
  { value: "crowdfund", label: "Crowdfunding" },
  { value: "tokenization", label: "Tokenizacija (soft)" },
  { value: "tickets", label: "Ulaznice" },
  { value: "realestate", label: "Nekretnina" },
];

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

export function CampaignForm({
  initial,
  submitLabel,
  onSubmit,
  lockedDestination,
}: {
  initial?: Partial<CampaignFormValues>;
  submitLabel: string;
  onSubmit: (v: CampaignFormValues) => Promise<void>;
  // When set (e.g. a passkey-derived per-campaign Safe), the address field is
  // replaced by a read-only display and this value is used as the destination.
  lockedDestination?: string | null;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<CampaignType>(initial?.type ?? "donation");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [goal, setGoal] = useState(
    initial?.goalCents ? String(initial.goalCents / 100) : "",
  );
  const [min, setMin] = useState(
    initial?.minContributionCents ? String(initial.minContributionCents / 100) : "1",
  );
  const [destination, setDestination] = useState(initial?.destinationAddress ?? "");
  const [subjectType, setSubjectType] = useState(initial?.subjectType ?? "generic");
  const [subjectRef, setSubjectRef] = useState(initial?.subjectRef ?? "");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">(
    initial?.visibility ?? "public",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Naslov je obavezan.");
    const dest = (lockedDestination ?? destination).trim();
    if (!ADDR_RE.test(dest)) {
      return setError(
        lockedDestination
          ? "Safe kampanje još nije izveden — poveži passkey."
          : "Odredišna Gnosis adresa (0x… 40 hex) je obavezna.",
      );
    }
    const minCents = parseEurToCents(min) ?? 100;
    const goalCents = goal.trim() ? parseEurToCents(goal) : null;
    if (goal.trim() && goalCents === null) return setError("Neispravan cilj.");
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        type,
        description: description.trim(),
        goalCents,
        minContributionCents: minCents,
        destinationAddress: dest,
        subjectType: subjectType.trim() || "generic",
        subjectRef: subjectRef.trim() || null,
        visibility,
      });
    } catch (err) {
      console.error(err);
      setError("Spremanje nije uspjelo. Provjeri podatke i pokušaj ponovno.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={labelCls}>Naslov</label>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Tip</label>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as CampaignType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Vidljivost</label>
          <select
            className={inputCls}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "private" | "unlisted" | "public")}
          >
            <option value="public">Javna</option>
            <option value="unlisted">Skrivena (na poveznicu)</option>
            <option value="private">Privatna</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Opis</label>
        <textarea className={inputCls} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Cilj (€, prazno = bez cilja)</label>
          <input className={inputCls} inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="npr. 1000" />
        </div>
        <div>
          <label className={labelCls}>Najmanji doprinos (€)</label>
          <input className={inputCls} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
      </div>

      {lockedDestination !== undefined ? (
        <div>
          <label className={labelCls}>Safe kampanje (Gnosis)</label>
          {lockedDestination ? (
            <p className="rounded-lg border border-ink/10 bg-sand/40 px-3 py-2 font-mono text-xs break-all">
              {lockedDestination}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-ink/15 px-3 py-2 text-xs text-inkMuted">
              Poveži passkey iznad — Safe se izvodi automatski.
            </p>
          )}
          <p className="mt-1 text-xs text-inkMuted">
            Counterfactual adresa (0 gas). Inicijalizira se on-chain pri prvoj isplati.
          </p>
        </div>
      ) : (
        <div>
          <label className={labelCls}>Odredišni Safe / adresa (Gnosis)</label>
          <input className={inputCls + " font-mono"} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="0x…" />
          <p className="mt-1 text-xs text-inkMuted">
            EURe se prosljeđuje izravno na ovu adresu. Preporuka: Safe kampanje.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Subjekt (tip)</label>
          <input className={inputCls} value={subjectType} onChange={(e) => setSubjectType(e.target.value)} placeholder="podcast_episode / generic" />
        </div>
        <div>
          <label className={labelCls}>Subjekt (referenca)</label>
          <input className={inputCls} value={subjectRef} onChange={(e) => setSubjectRef(e.target.value)} placeholder="npr. youtubeId" />
        </div>
      </div>

      {error ? <p className="text-sm text-rust">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        {busy ? "Spremam…" : submitLabel}
      </Button>
    </form>
  );
}
