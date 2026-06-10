"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { CampaignType } from "@/lib/pinka";
import { parseEurToCents } from "@/lib/format";
import { useI18n, Rich } from "@/lib/i18n";

export type Recurrence = "none" | "monthly" | "quarterly" | "yearly";

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
  recurrence: Recurrence;
  // fixed day-of-month the payment is expected (monthly only); null = anchor to
  // each member's own first-payment day
  recurrenceAnchorDay: number | null;
  // optional physical location — campaigns with coordinates show up as markers
  // on karta Hrvatske (gis.domovina.ai)
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
}

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-3.5 py-2.5 text-sm focus:border-ink/30 focus:outline-none";

/// Two-column field row: control on the left, description on the right
/// (stacked on mobile). Right column top-aligns with the label.
function Field({
  label,
  desc,
  children,
}: {
  label: string;
  desc: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-3 border-b border-ink/8 py-7 first:pt-2 last:border-0 md:grid-cols-[1fr_minmax(0,22rem)]">
      <div>
        <label className="mb-2 block text-sm font-medium">{label}</label>
        {children}
      </div>
      <div className="text-xs leading-relaxed text-inkMuted">{desc}</div>
    </div>
  );
}

// Labels/blurbs live in the i18n catalogue under form.types.* / form.visibility.*
const TYPE_VALUES: CampaignType[] = [
  "donation",
  "crowdfund",
  "tokenization",
  "tickets",
  "realestate",
];
const VIS_VALUES: ("public" | "unlisted" | "private")[] = [
  "public",
  "unlisted",
  "private",
];
const RECUR_VALUES: Recurrence[] = ["none", "monthly", "quarterly", "yearly"];

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

// "45.1603, 18.0156" (i varijante s razmakom/;) → {lat, lng}; "" → null;
// sve ostalo → "invalid" pa forma pokaže grešku umjesto da tiho odbaci unos.
function parseCoords(s: string): { lat: number; lng: number } | null | "invalid" {
  const txt = s.trim();
  if (!txt) return null;
  const parts = txt.split(/[,;\s]+/).filter(Boolean);
  if (parts.length !== 2) return "invalid";
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "invalid";
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return "invalid";
  return { lat, lng };
}

export function CampaignForm({
  initial,
  submitLabel,
  onSubmit,
  lockedDestination,
  pendingDestinationNote,
  lockedTitle,
}: {
  initial?: Partial<CampaignFormValues>;
  submitLabel: string;
  onSubmit: (v: CampaignFormValues) => Promise<void>;
  lockedDestination?: string | null;
  // When set (and there's no lockedDestination yet), the destination account is
  // opened in the user's wallet during creation: the note is shown in place of
  // the address and submit proceeds with an empty destinationAddress — the
  // caller fills it in from the wallet's return params.
  pendingDestinationNote?: string;
  // When set, the title is captured elsewhere (step 1) — the field is hidden.
  lockedTitle?: string;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<CampaignType>(initial?.type ?? "donation");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [goal, setGoal] = useState(initial?.goalCents ? String(initial.goalCents / 100) : "");
  const [min, setMin] = useState(initial?.minContributionCents ? String(initial.minContributionCents / 100) : "1");
  const [destination, setDestination] = useState(initial?.destinationAddress ?? "");
  const [subjectType, setSubjectType] = useState(initial?.subjectType ?? "generic");
  const [subjectRef, setSubjectRef] = useState(initial?.subjectRef ?? "");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">(initial?.visibility ?? "public");
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? "none");
  const [anchorDay, setAnchorDay] = useState(
    initial?.recurrenceAnchorDay ? String(initial.recurrenceAnchorDay) : "",
  );
  const [locationName, setLocationName] = useState(initial?.locationName ?? "");
  const [coords, setCoords] = useState(
    initial?.latitude != null && initial?.longitude != null
      ? `${initial.latitude}, ${initial.longitude}`
      : "",
  );
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedToEpisode = subjectType === "podcast_episode";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const effectiveTitle = (lockedTitle ?? title).trim();
    if (!effectiveTitle) return setError(t("form.errTitleRequired"));
    const dest = (lockedDestination ?? destination).trim();
    const destinationPending = !!pendingDestinationNote && !lockedDestination;
    if (!destinationPending && !ADDR_RE.test(dest)) {
      return setError(
        lockedDestination !== undefined
          ? t("form.errSafeNotDerived")
          : t("form.errAddrRequired"),
      );
    }
    const minCents = parseEurToCents(min) ?? 100;
    const goalCents = goal.trim() ? parseEurToCents(goal) : null;
    if (goal.trim() && goalCents === null) return setError(t("form.errGoalInvalid"));
    const loc = parseCoords(coords);
    if (loc === "invalid") return setError(t("form.errLocationInvalid"));
    setBusy(true);
    try {
      // anchor day applies to monthly only; clamp to 1..31
      const dayNum = parseInt(anchorDay, 10);
      const anchor =
        recurrence === "monthly" && Number.isFinite(dayNum)
          ? Math.min(31, Math.max(1, dayNum))
          : null;
      await onSubmit({
        title: effectiveTitle,
        type,
        description: description.trim(),
        goalCents,
        minContributionCents: minCents,
        destinationAddress: dest,
        subjectType: subjectType.trim() || "generic",
        subjectRef: subjectRef.trim() || null,
        visibility,
        recurrence,
        recurrenceAnchorDay: anchor,
        latitude: loc?.lat ?? null,
        longitude: loc?.lng ?? null,
        locationName: locationName.trim() || null,
      });
    } catch (err) {
      console.error(err);
      setError(t("form.errSaveFailed"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {lockedTitle === undefined ? (
        <Field
          label={t("form.titleLabel")}
          desc={<Rich>{t("form.titleDesc")}</Rich>}
        >
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      ) : null}

      <Field
        label={t("form.typeLabel")}
        desc={
          <>
            <p>{t("form.typeDesc")}</p>
            <p className="mt-2 rounded-lg bg-coral/5 px-3 py-2 text-inkSoft">
              {t(`form.types.${type}.blurb`)}
            </p>
          </>
        }
      >
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as CampaignType)}>
          {TYPE_VALUES.map((v) => (
            <option key={v} value={v}>{t(`form.types.${v}.label`)}</option>
          ))}
        </select>
      </Field>

      <Field
        label={t("form.descLabel")}
        desc={t("form.descDesc")}
      >
        <textarea className={inputCls} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <Field
        label={t("form.goalLabel")}
        desc={<Rich>{t("form.goalDesc")}</Rich>}
      >
        <input className={inputCls} inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t("form.goalPlaceholder")} />
      </Field>

      <Field label={t("form.minLabel")} desc={t("form.minDesc")}>
        <input className={inputCls} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
      </Field>

      <Field
        label={t("form.recurrenceLabel")}
        desc={
          <>
            <p><Rich>{t("form.recurrenceDesc")}</Rich></p>
            <p className="mt-2 rounded-lg bg-teal/5 px-3 py-2 text-inkSoft">
              {t(`form.recurrences.${recurrence}.blurb`)}
            </p>
          </>
        }
      >
        <select
          className={inputCls}
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Recurrence)}
        >
          {RECUR_VALUES.map((v) => (
            <option key={v} value={v}>{t(`form.recurrences.${v}.label`)}</option>
          ))}
        </select>
        {recurrence === "monthly" ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-inkSoft">
              {t("form.anchorDayLabel")}
            </label>
            <input
              className={inputCls}
              inputMode="numeric"
              value={anchorDay}
              onChange={(e) => setAnchorDay(e.target.value)}
              placeholder={t("form.anchorDayPlaceholder")}
            />
          </div>
        ) : null}
      </Field>

      <Field
        label={t("form.visLabel")}
        desc={
          <>
            <p><Rich>{t("form.visDesc")}</Rich></p>
            <p className="mt-2 rounded-lg bg-teal/5 px-3 py-2 text-inkSoft">
              {t(`form.visibility.${visibility}.blurb`)}
            </p>
          </>
        }
      >
        <select
          className={inputCls}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as "private" | "unlisted" | "public")}
        >
          {VIS_VALUES.map((v) => (
            <option key={v} value={v}>{t(`form.visibility.${v}.label`)}</option>
          ))}
        </select>
      </Field>

      <Field
        label={t("form.locationLabel")}
        desc={<Rich>{t("form.locationDesc")}</Rich>}
      >
        <div className="space-y-3">
          <input
            className={inputCls}
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder={t("form.locationNamePlaceholder")}
          />
          <div className="flex gap-2">
            <input
              className={inputCls + " font-mono"}
              value={coords}
              onChange={(e) => setCoords(e.target.value)}
              placeholder={t("form.locationCoordsPlaceholder")}
            />
            <button
              type="button"
              disabled={locating}
              onClick={() => {
                if (!navigator.geolocation) return;
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setCoords(
                      `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
                    );
                    setLocating(false);
                  },
                  () => setLocating(false),
                  { enableHighAccuracy: true, timeout: 10000 },
                );
              }}
              className="shrink-0 rounded-lg border border-ink/15 px-3 py-2 text-xs font-medium hover:border-ink/30 disabled:opacity-50"
            >
              {locating ? t("form.locationLocating") : t("form.locationUseMine")}
            </button>
          </div>
        </div>
      </Field>

      <Field
        label={t("form.safeLabel")}
        desc={
          lockedDestination !== undefined ? (
            <Rich>
              {pendingDestinationNote && !lockedDestination
                ? t("form.safeDescAccount")
                : t("form.safeDescLocked")}
            </Rich>
          ) : (
            <Rich>{t("form.safeDescManual")}</Rich>
          )
        }
      >
        {lockedDestination !== undefined ? (
          lockedDestination ? (
            <p className="rounded-lg border border-ink/10 bg-sand/40 px-3 py-2 font-mono text-xs break-all">
              {lockedDestination}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-ink/15 px-3 py-2 text-xs text-inkMuted">
              {pendingDestinationNote ?? t("form.safeLockedEmpty")}
            </p>
          )
        ) : (
          <input className={inputCls + " font-mono"} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="0x…" />
        )}
      </Field>

      {/* Napredno — full width ispod stupaca */}
      <details className="mt-8 rounded-lg border border-ink/10 bg-white/40 px-5 py-4">
        <summary className="cursor-pointer text-sm font-medium">
          {t("form.advancedSummary")}{" "}
          {linkedToEpisode ? t("form.advancedLinked") : t("form.advancedOptional")}
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-inkMuted">
          <Rich>{t("form.advancedDesc")}</Rich>
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("form.subjectTypeLabel")}</label>
            <input className={inputCls} value={subjectType} onChange={(e) => setSubjectType(e.target.value)} placeholder={t("form.subjectTypePlaceholder")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("form.subjectRefLabel")}</label>
            <input className={inputCls} value={subjectRef} onChange={(e) => setSubjectRef(e.target.value)} placeholder={t("form.subjectRefPlaceholder")} />
          </div>
        </div>
      </details>

      {error ? <p className="mt-6 text-sm leading-relaxed text-rust">{error}</p> : null}

      <Button type="submit" disabled={busy} className="mt-8">
        {busy ? t("form.saving") : submitLabel}
      </Button>
    </form>
  );
}
