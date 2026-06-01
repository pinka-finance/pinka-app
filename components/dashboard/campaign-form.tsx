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
const labelCls = "block text-sm font-medium";
const helpCls = "mt-1 mb-2 text-xs leading-relaxed text-inkMuted";

const TYPES: { value: CampaignType; label: string; blurb: string }[] = [
  {
    value: "donation",
    label: "Donacija",
    blurb:
      "Podržavatelji daju jer žele — bez protučinidbe i bez roka. Idealno za trajnu podršku kreatoru ili udruzi.",
  },
  {
    value: "crowdfund",
    label: "Crowdfunding",
    blurb:
      "Skupljaš za konkretan projekt s ciljanim iznosom (npr. oprema, nova sezona). Postavi cilj niže.",
  },
  {
    value: "tokenization",
    label: "Tokenizacija (soft)",
    blurb:
      "Svaki podržavatelj dobije on-chain potvrdu doprinosa (badge/atestacija). NIJE prenosivi vrijednosni papir — nema dividendi ni preprodaje.",
  },
  {
    value: "tickets",
    label: "Ulaznice",
    blurb:
      "Prodaja ulaznica — svaka kupnja troši komad iz zalihe. Razine (ulaznice) definiraš nakon kreiranja kampanje.",
  },
  {
    value: "realestate",
    label: "Nekretnina",
    blurb:
      "Grupno financiranje nekretnine. Veći iznosi obično traže provjeru identiteta (KYC) — to dolazi u kasnijoj fazi.",
  },
];

const VISIBILITY: { value: "public" | "unlisted" | "private"; label: string; blurb: string }[] = [
  {
    value: "public",
    label: "Javna",
    blurb: "Vidi se na pinka.finance listi kampanja i preko izravne poveznice. Za pravu objavu.",
  },
  {
    value: "unlisted",
    label: "Skrivena (na poveznicu)",
    blurb: "Ne pojavljuje se u listi — otvara je samo tko ima link. Dobro za uži krug ili najavu.",
  },
  {
    value: "private",
    label: "Privatna",
    blurb: "Vidiš je samo ti. Za pripremu i testiranje prije objave.",
  },
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

  const typeInfo = TYPES.find((t) => t.value === type);
  const visInfo = VISIBILITY.find((v) => v.value === visibility);
  const linkedToEpisode = subjectType === "podcast_episode";

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
    <form onSubmit={submit} className="space-y-6">
      {/* Naslov */}
      <div>
        <label className={labelCls}>Naslov kampanje</label>
        <p className={helpCls}>
          Ovo ljudi prvo vide — u listi kampanja i na vrhu javne stranice. Drži ga
          kratkim i konkretnim (npr. „Nova sezona podcasta o ekonomiji”).
        </p>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      {/* Tip */}
      <div>
        <label className={labelCls}>Tip kampanje</label>
        <p className={helpCls}>
          Određuje logiku i kako se kampanja predstavlja. Možeš ga kasnije promijeniti dok je nacrt.
        </p>
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as CampaignType)}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {typeInfo ? (
          <p className="mt-2 rounded-lg bg-coral/5 px-3 py-2 text-xs leading-relaxed text-inkSoft">
            {typeInfo.blurb}
          </p>
        ) : null}
      </div>

      {/* Opis */}
      <div>
        <label className={labelCls}>Opis</label>
        <p className={helpCls}>
          Glavni tekst na javnoj stranici. Ispričaj priču: tko si, za što skupljaš i
          kamo točno ide novac. Više redaka je u redu — transparentnost diže povjerenje (i donacije).
        </p>
        <textarea className={inputCls} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {/* Cilj + minimum */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Cilj (€)</label>
          <p className={helpCls}>
            Koliko želiš skupiti. <strong>Ostavi prazno</strong> za otvorenu donaciju bez
            cilja. Kad se cilj dosegne, kampanja se označi „ispunjenom”, ali i dalje prima uplate.
          </p>
          <input className={inputCls} inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="npr. 1000 (ili prazno)" />
        </div>
        <div>
          <label className={labelCls}>Najmanji doprinos (€)</label>
          <p className={helpCls}>
            Donja granica jedne uplate. Spriječava sitne iznose. Tipično 1–5 €.
          </p>
          <input className={inputCls} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
      </div>

      {/* Vidljivost */}
      <div>
        <label className={labelCls}>Vidljivost</label>
        <p className={helpCls}>
          Tko može vidjeti kampanju. Bez brige — kreira se kao <strong>nacrt</strong> i
          ne prima uplate dok je ručno ne aktiviraš.
        </p>
        <select
          className={inputCls}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as "private" | "unlisted" | "public")}
        >
          {VISIBILITY.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
        {visInfo ? (
          <p className="mt-2 rounded-lg bg-teal/5 px-3 py-2 text-xs leading-relaxed text-inkSoft">
            {visInfo.blurb}
          </p>
        ) : null}
      </div>

      {/* Safe / odredište */}
      {lockedDestination !== undefined ? (
        <div>
          <label className={labelCls}>Safe kampanje (Gnosis)</label>
          <p className={helpCls}>
            Multisig novčanik u koji stižu sve donacije kao EURe (euro-stablecoin). Izveden je iz
            tvog passkeya — <strong>samo ti njime upravljaš</strong>. „Counterfactual” znači da
            adresa već prima novac, a sam novčanik se na lancu kreira tek pri prvoj isplati — pa
            ne plaćaš gas unaprijed.
          </p>
          {lockedDestination ? (
            <p className="rounded-lg border border-ink/10 bg-sand/40 px-3 py-2 font-mono text-xs break-all">
              {lockedDestination}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-ink/15 px-3 py-2 text-xs text-inkMuted">
              Poveži passkey u koraku 1 — Safe se izvodi automatski.
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className={labelCls}>Odredišna adresa (Gnosis)</label>
          <p className={helpCls}>
            EURe se prosljeđuje izravno na ovu adresu. Preporuka: Safe kojim sam upravljaš.
          </p>
          <input className={inputCls + " font-mono"} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="0x…" />
        </div>
      )}

      {/* Napredno: povezivanje sa sadržajem */}
      <details className="rounded-lg border border-ink/10 bg-white/40 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Napredno — povezivanje sa sadržajem {linkedToEpisode ? "· vezano uz epizodu" : "(opcionalno)"}
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-inkMuted">
          Kampanju možeš zalijepiti uz konkretan sadržaj. Za <strong>podcast epizodu</strong>{" "}
          upiši tip <code>podcast_episode</code> i kao referencu <strong>YouTube ID</strong> epizode —
          tada se panel „Podrži ovu epizodu” automatski pojavi na toj epizodi na domovina.ai. Za
          običnu kampanju ostavi <code>generic</code>.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Tip subjekta</label>
            <input className={inputCls} value={subjectType} onChange={(e) => setSubjectType(e.target.value)} placeholder="generic / podcast_episode" />
          </div>
          <div>
            <label className={labelCls}>Referenca</label>
            <input className={inputCls} value={subjectRef} onChange={(e) => setSubjectRef(e.target.value)} placeholder="npr. YouTube ID" />
          </div>
        </div>
      </details>

      {error ? <p className="text-sm text-rust">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        {busy ? "Spremam…" : submitLabel}
      </Button>
    </form>
  );
}
