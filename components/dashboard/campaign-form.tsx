"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { CampaignType } from "@/lib/pinka";
import { parseEurToCents } from "@/lib/format";
import { CoverUpload } from "@/components/dashboard/cover-upload";
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
  coverImageUrl: string | null;
  // "YYYY-MM-DD" date-input vrijednosti; null = bez vremenskog okvira
  startsAt: string | null;
  endsAt: string | null;
}

// Sirovo stanje forme (stringovi kako ih korisnik tipka) — autosave sprema OVO,
// pa se nedovršen unos ("1.50|") vraća vjerno, ne kroz parse/format round-trip.
interface RawState {
  title: string;
  type: CampaignType;
  description: string;
  goal: string;
  min: string;
  destination: string;
  subjectType: string;
  subjectRef: string;
  visibility: "private" | "unlisted" | "public";
  recurrence: Recurrence;
  anchorDay: string;
  locationName: string;
  coords: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string;
}

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

function centsToInput(cents: number | null | undefined): string {
  return cents != null ? String(cents / 100).replace(".", ",") : "";
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function initialToRaw(initial?: Partial<CampaignFormValues>): RawState {
  return {
    title: initial?.title ?? "",
    type: initial?.type ?? "donation",
    description: initial?.description ?? "",
    goal: centsToInput(initial?.goalCents ?? null),
    min: initial?.minContributionCents != null ? centsToInput(initial.minContributionCents) : "1",
    destination: initial?.destinationAddress ?? "",
    subjectType: initial?.subjectType ?? "generic",
    subjectRef: initial?.subjectRef ?? "",
    visibility: initial?.visibility ?? "public",
    recurrence: initial?.recurrence ?? "none",
    anchorDay: initial?.recurrenceAnchorDay != null ? String(initial.recurrenceAnchorDay) : "",
    locationName: initial?.locationName ?? "",
    coords:
      initial?.latitude != null && initial?.longitude != null
        ? `${initial.latitude}, ${initial.longitude}`
        : "",
    coverImageUrl: initial?.coverImageUrl ?? null,
    startsAt: isoToDateInput(initial?.startsAt ?? null),
    endsAt: isoToDateInput(initial?.endsAt ?? null),
  };
}

// Best-effort vrijednosti za live preview / checklist / AI export — nevaljani
// brojevi su null, NE error (strogu validaciju radi submit).
function rawToValues(r: RawState): CampaignFormValues {
  const loc = parseCoords(r.coords);
  const okLoc = loc !== "invalid" && loc !== null ? loc : null;
  const dayNum = parseInt(r.anchorDay, 10);
  return {
    title: r.title.trim(),
    type: r.type,
    description: r.description.trim(),
    goalCents: r.goal.trim() ? parseEurToCents(r.goal) : null,
    minContributionCents: parseEurToCents(r.min) ?? 0,
    destinationAddress: r.destination.trim(),
    subjectType: r.subjectType.trim() || "generic",
    subjectRef: r.subjectRef.trim() || null,
    visibility: r.visibility,
    recurrence: r.recurrence,
    recurrenceAnchorDay:
      r.recurrence === "monthly" && Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 31
        ? dayNum
        : null,
    latitude: okLoc?.lat ?? null,
    longitude: okLoc?.lng ?? null,
    locationName: r.locationName.trim() || null,
    coverImageUrl: r.coverImageUrl,
    startsAt: r.startsAt || null,
    endsAt: r.endsAt || null,
  };
}

type Errors = Partial<Record<string, string>>;

// Redoslijed za "skoči na prvu grešku"
const FIELD_ORDER = [
  "title", "description", "goal", "min", "anchorDay", "startsAt", "endsAt",
  "coords", "destination", "subjectType", "subjectRef",
] as const;

function inputCls(hasError: boolean): string {
  return (
    "w-full rounded-lg border bg-white/80 px-3.5 py-2.5 text-sm focus:outline-none " +
    (hasError
      ? "border-rust/60 focus:border-rust"
      : "border-ink/15 focus:border-ink/30")
  );
}

/// Red forme: label + kontrola + inline greška + kratki opis ispod.
function Field({
  id,
  label,
  desc,
  error,
  children,
}: {
  id: string;
  label: string;
  desc?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div id={`cf-${id}`} className="py-5 first:pt-1 last:pb-1">
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-xs leading-relaxed text-rust">{error}</p> : null}
      {desc ? <div className="mt-2 text-xs leading-relaxed text-inkMuted">{desc}</div> : null}
    </div>
  );
}

/// Sekcija = kartica s naslovom. U layout="wide" sekcije idu u 2 stupca
/// (span ih razvlači preko oba); u "narrow" se sve slaže u jedan stupac.
function Section({
  title,
  span,
  children,
}: {
  title: string;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={"card-base !p-6 " + (span ? "xl:col-span-2" : "")}>
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-inkSoft">
        {title}
      </h3>
      <div className="mt-2 divide-y divide-ink/5">{children}</div>
    </section>
  );
}

export function CampaignForm({
  initial,
  submitLabel,
  onSubmit,
  lockedDestination,
  pendingDestinationNote,
  lockedTitle,
  layout = "narrow",
  draftKey,
  onValuesChange,
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
  // "wide": sekcije u 2 stupca (desktop /dashboard/new); "narrow": jedan stupac
  layout?: "narrow" | "wide";
  // localStorage ključ za autosave sirovog unosa (debounced). `initial` ima
  // prednost pred draftom (npr. povratak iz wallet handoffa).
  draftKey?: string;
  // Emitira best-effort vrijednosti na svaku promjenu (live preview/checklist).
  onValuesChange?: (v: CampaignFormValues) => void;
}) {
  const { t } = useI18n();
  const [raw, setRaw] = useState<RawState>(() => initialToRaw(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [fromDraft, setFromDraft] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set(patch: Partial<RawState>) {
    setRaw((r) => ({ ...r, ...patch }));
  }

  // Vrati nedovršeni nacrt iz localStorage (samo kad nema `initial`; u effectu,
  // ne u initializeru — izbjegava SSG hydration mismatch).
  useEffect(() => {
    if (initial || !draftKey) return;
    try {
      const d = JSON.parse(window.localStorage.getItem(draftKey) ?? "null") as
        | Partial<RawState>
        | null;
      if (d && typeof d === "object" && (d.title || d.description || d.goal || d.coverImageUrl)) {
        setRaw((r) => ({ ...r, ...d }));
        setFromDraft(true);
      }
    } catch {
      /* pokvaren draft → kreni ispočetka */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (debounced) + emit za preview
  useEffect(() => {
    onValuesChange?.(rawToValues(raw));
    if (!draftKey) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(raw));
      } catch {
        /* quota — autosave je best-effort */
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  function discardDraft() {
    if (draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
    setRaw(initialToRaw(initial));
    setFromDraft(false);
    setErrors({});
  }

  // ── validacija ─────────────────────────────────────────────────────────────
  // Sve provjere na jednom mjestu; validateField (blur) i validateAll (submit)
  // dijele ista pravila. Vraća i18n KLJUČEVE, ne tekst.
  function check(r: RawState): Errors {
    const e: Errors = {};
    const title = (lockedTitle ?? r.title).trim();
    if (!title) e.title = "form.errTitleRequired";
    else if (title.length < 3) e.title = "form.errTitleShort";
    else if (title.length > 160) e.title = "form.errTitleLong";

    if (r.description.length > 20000) e.description = "form.errDescLong";

    const goalCents = r.goal.trim() ? parseEurToCents(r.goal) : null;
    if (r.goal.trim() && goalCents === null) e.goal = "form.errGoalInvalid";
    else if (goalCents !== null && (goalCents < 100 || goalCents > 10000000000))
      e.goal = "form.errGoalRange";

    const minCents = parseEurToCents(r.min);
    if (minCents === null) e.min = "form.errMinInvalid";
    else if (minCents > 1000000) e.min = "form.errMinTooBig";
    else if (goalCents !== null && minCents > goalCents) e.min = "form.errMinExceedsGoal";

    if (r.recurrence === "monthly" && r.anchorDay.trim()) {
      const d = Number(r.anchorDay.trim());
      if (!Number.isInteger(d) || d < 1 || d > 31) e.anchorDay = "form.errAnchorDay";
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (r.startsAt && r.endsAt && r.endsAt <= r.startsAt) e.endsAt = "form.errDatesOrder";
    else if (r.endsAt && r.endsAt <= todayStr) e.endsAt = "form.errEndsPast";

    if (parseCoords(r.coords) === "invalid") e.coords = "form.errLocationInvalid";
    if (r.locationName.trim().length > 160) e.coords = "form.errLocationNameLong";

    const st = r.subjectType.trim();
    if (st && !/^[a-z0-9_]{1,40}$/.test(st)) e.subjectType = "form.errSubjectType";
    if (r.subjectRef.trim().length > 200) e.subjectRef = "form.errSubjectRefLong";

    const destinationPending = !!pendingDestinationNote && !lockedDestination;
    const dest = (lockedDestination ?? r.destination).trim();
    if (!destinationPending && !ADDR_RE.test(dest)) {
      e.destination =
        lockedDestination !== undefined ? "form.errSafeNotDerived" : "form.errAddrRequired";
    }
    return e;
  }

  function validateField(...keys: string[]) {
    const all = check(raw);
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        if (all[k]) next[k] = all[k];
        else delete next[k];
      }
      return next;
    });
  }

  const err = (k: string): string | undefined =>
    errors[k] ? t(errors[k] as string) : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const all = check(raw);
    setErrors(all);
    const firstBad = FIELD_ORDER.find((k) => all[k]);
    if (firstBad) {
      document
        .getElementById(`cf-${firstBad === "coords" ? "location" : firstBad === "startsAt" || firstBad === "endsAt" ? "dates" : firstBad}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try {
      const v = rawToValues(raw);
      const dest = (lockedDestination ?? raw.destination).trim();
      await onSubmit({
        ...v,
        title: (lockedTitle ?? raw.title).trim(),
        destinationAddress: dest,
        minContributionCents: parseEurToCents(raw.min) ?? 100,
      });
      // uspjeh bez navigacije (manage) ili prije navigacije — draft više ne treba
      if (draftKey) {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error(err);
      const key = (err as Error)?.message;
      setError(
        key && key.startsWith("form.")
          ? t(key)
          : key && key.startsWith("server:")
            ? t(`form.serverErrors.${key.slice(7)}`)
            : t("form.errSaveFailed"),
      );
      setBusy(false);
    }
  }

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={submit}>
      {fromDraft ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal/30 bg-teal/5 px-4 py-3 text-sm">
          <span>{t("form.draft.restored")}</span>
          <button
            type="button"
            onClick={discardDraft}
            className="text-inkMuted underline underline-offset-2 hover:text-ink"
          >
            {t("form.draft.discard")}
          </button>
        </div>
      ) : null}

      <div className={"grid grid-cols-1 gap-5 " + (layout === "wide" ? "xl:grid-cols-2" : "")}>
        {/* ── Osnovno ── */}
        <Section title={t("form.sections.basics")} span>
          <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2">
            <div className="divide-y divide-ink/5">
              {lockedTitle === undefined ? (
                <Field
                  id="title"
                  label={t("form.titleLabel")}
                  desc={<Rich>{t("form.titleDesc")}</Rich>}
                  error={err("title")}
                >
                  <input
                    className={inputCls(!!errors.title)}
                    value={raw.title}
                    maxLength={160}
                    onChange={(e) => set({ title: e.target.value })}
                    onBlur={() => validateField("title")}
                  />
                </Field>
              ) : null}
              <Field
                id="type"
                label={t("form.typeLabel")}
                desc={
                  <>
                    <p>{t("form.typeDesc")}</p>
                    <p className="mt-2 rounded-lg bg-coral/5 px-3 py-2 text-inkSoft">
                      {t(`form.types.${raw.type}.blurb`)}
                    </p>
                  </>
                }
              >
                <select
                  className={inputCls(false)}
                  value={raw.type}
                  onChange={(e) => set({ type: e.target.value as CampaignType })}
                >
                  {TYPE_VALUES.map((v) => (
                    <option key={v} value={v}>{t(`form.types.${v}.label`)}</option>
                  ))}
                </select>
              </Field>
              <Field id="cover" label={t("form.cover.label")} desc={t("form.cover.desc")}>
                <CoverUpload
                  value={raw.coverImageUrl}
                  onChange={(url) => set({ coverImageUrl: url })}
                />
              </Field>
            </div>
            <div className="divide-y divide-ink/5">
              <Field
                id="description"
                label={t("form.descLabel")}
                desc={t("form.descDesc")}
                error={err("description")}
              >
                <textarea
                  className={inputCls(!!errors.description)}
                  rows={layout === "wide" ? 16 : 6}
                  value={raw.description}
                  onChange={(e) => set({ description: e.target.value })}
                  onBlur={() => validateField("description")}
                />
                <p className="mt-1 text-right text-[11px] text-inkMuted">
                  {raw.description.length.toLocaleString()} / 20.000
                </p>
              </Field>
            </div>
          </div>
        </Section>

        {/* ── Cilj i uplate ── */}
        <Section title={t("form.sections.finance")}>
          <Field
            id="goal"
            label={t("form.goalLabel")}
            desc={<Rich>{t("form.goalDesc")}</Rich>}
            error={err("goal")}
          >
            <input
              className={inputCls(!!errors.goal)}
              inputMode="decimal"
              value={raw.goal}
              onChange={(e) => set({ goal: e.target.value })}
              onBlur={() => validateField("goal", "min")}
              placeholder={t("form.goalPlaceholder")}
            />
          </Field>
          <Field id="min" label={t("form.minLabel")} desc={t("form.minDesc")} error={err("min")}>
            <input
              className={inputCls(!!errors.min)}
              inputMode="decimal"
              value={raw.min}
              onChange={(e) => set({ min: e.target.value })}
              onBlur={() => validateField("min")}
            />
          </Field>
          <Field
            id="dates"
            label={t("form.datesLabel")}
            desc={t("form.datesDesc")}
            error={err("startsAt") ?? err("endsAt")}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-inkSoft">
                  {t("form.startsLabel")}
                </label>
                <input
                  type="date"
                  className={inputCls(!!errors.startsAt)}
                  value={raw.startsAt}
                  onChange={(e) => set({ startsAt: e.target.value })}
                  onBlur={() => validateField("startsAt", "endsAt")}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-inkSoft">
                  {t("form.endsLabel")}
                </label>
                <input
                  type="date"
                  className={inputCls(!!errors.endsAt)}
                  value={raw.endsAt}
                  onChange={(e) => set({ endsAt: e.target.value })}
                  onBlur={() => validateField("startsAt", "endsAt")}
                />
              </div>
            </div>
          </Field>
        </Section>

        {/* ── Članarina ── */}
        <Section title={t("form.sections.membership")}>
          <Field
            id="recurrence"
            label={t("form.recurrenceLabel")}
            desc={
              <>
                <p><Rich>{t("form.recurrenceDesc")}</Rich></p>
                <p className="mt-2 rounded-lg bg-teal/5 px-3 py-2 text-inkSoft">
                  {t(`form.recurrences.${raw.recurrence}.blurb`)}
                </p>
              </>
            }
            error={err("anchorDay")}
          >
            <select
              className={inputCls(false)}
              value={raw.recurrence}
              onChange={(e) => set({ recurrence: e.target.value as Recurrence })}
            >
              {RECUR_VALUES.map((v) => (
                <option key={v} value={v}>{t(`form.recurrences.${v}.label`)}</option>
              ))}
            </select>
            {raw.recurrence === "monthly" ? (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-inkSoft">
                  {t("form.anchorDayLabel")}
                </label>
                <input
                  className={inputCls(!!errors.anchorDay)}
                  inputMode="numeric"
                  value={raw.anchorDay}
                  onChange={(e) => set({ anchorDay: e.target.value })}
                  onBlur={() => validateField("anchorDay")}
                  placeholder={t("form.anchorDayPlaceholder")}
                />
              </div>
            ) : null}
          </Field>
        </Section>

        {/* ── Vidljivost ── */}
        <Section title={t("form.sections.visibility")}>
          <Field
            id="visibility"
            label={t("form.visLabel")}
            desc={
              <>
                <p><Rich>{t("form.visDesc")}</Rich></p>
                <p className="mt-2 rounded-lg bg-teal/5 px-3 py-2 text-inkSoft">
                  {t(`form.visibility.${raw.visibility}.blurb`)}
                </p>
              </>
            }
          >
            <select
              className={inputCls(false)}
              value={raw.visibility}
              onChange={(e) =>
                set({ visibility: e.target.value as "private" | "unlisted" | "public" })
              }
            >
              {VIS_VALUES.map((v) => (
                <option key={v} value={v}>{t(`form.visibility.${v}.label`)}</option>
              ))}
            </select>
          </Field>
        </Section>

        {/* ── Lokacija ── */}
        <Section title={t("form.sections.location")}>
          <Field
            id="location"
            label={t("form.locationLabel")}
            desc={<Rich>{t("form.locationDesc")}</Rich>}
            error={err("coords") ?? geoError ?? undefined}
          >
            <div className="space-y-3">
              <input
                className={inputCls(false)}
                value={raw.locationName}
                maxLength={160}
                onChange={(e) => set({ locationName: e.target.value })}
                placeholder={t("form.locationNamePlaceholder")}
              />
              <div className="flex gap-2">
                <input
                  className={inputCls(!!errors.coords) + " font-mono"}
                  value={raw.coords}
                  onChange={(e) => set({ coords: e.target.value })}
                  onBlur={() => validateField("coords")}
                  placeholder={t("form.locationCoordsPlaceholder")}
                />
                <button
                  type="button"
                  disabled={locating}
                  onClick={() => {
                    setGeoError(null);
                    if (!navigator.geolocation) {
                      setGeoError(t("form.errGeoUnsupported"));
                      return;
                    }
                    setLocating(true);
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        set({
                          coords: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
                        });
                        setErrors((p) => {
                          const n = { ...p };
                          delete n.coords;
                          return n;
                        });
                        setLocating(false);
                      },
                      () => {
                        setGeoError(t("form.errGeoFailed"));
                        setLocating(false);
                      },
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
        </Section>

        {/* ── Račun kampanje ── */}
        <Section title={t("form.sections.account")} span>
          <Field
            id="destination"
            label={t("form.safeLabel")}
            error={err("destination")}
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
              <input
                className={inputCls(!!errors.destination) + " font-mono"}
                value={raw.destination}
                onChange={(e) => set({ destination: e.target.value })}
                onBlur={() => validateField("destination")}
                placeholder="0x…"
              />
            )}
          </Field>
        </Section>

        {/* ── Napredno ── */}
        <details
          className={
            "rounded-lg border border-ink/10 bg-white/40 px-5 py-4 " +
            (layout === "wide" ? "xl:col-span-2" : "")
          }
          open={raw.subjectType === "podcast_episode"}
        >
          <summary className="cursor-pointer text-sm font-medium">
            {t("form.advancedSummary")}{" "}
            {raw.subjectType === "podcast_episode"
              ? t("form.advancedLinked")
              : t("form.advancedOptional")}
          </summary>
          <p className="mt-3 text-xs leading-relaxed text-inkMuted">
            <Rich>{t("form.advancedDesc")}</Rich>
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div id="cf-subjectType">
              <label className="mb-1 block text-sm font-medium">{t("form.subjectTypeLabel")}</label>
              <input
                className={inputCls(!!errors.subjectType)}
                value={raw.subjectType}
                onChange={(e) => set({ subjectType: e.target.value })}
                onBlur={() => validateField("subjectType")}
                placeholder={t("form.subjectTypePlaceholder")}
              />
              {err("subjectType") ? (
                <p className="mt-1.5 text-xs text-rust">{err("subjectType")}</p>
              ) : null}
            </div>
            <div id="cf-subjectRef">
              <label className="mb-1 block text-sm font-medium">{t("form.subjectRefLabel")}</label>
              <input
                className={inputCls(!!errors.subjectRef)}
                value={raw.subjectRef}
                onChange={(e) => set({ subjectRef: e.target.value })}
                onBlur={() => validateField("subjectRef")}
                placeholder={t("form.subjectRefPlaceholder")}
              />
              {err("subjectRef") ? (
                <p className="mt-1.5 text-xs text-rust">{err("subjectRef")}</p>
              ) : null}
            </div>
          </div>
        </details>
      </div>

      {error ? <p className="mt-6 text-sm leading-relaxed text-rust">{error}</p> : null}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={busy}>
          {busy ? t("form.saving") : submitLabel}
        </Button>
        {errorCount > 0 ? (
          <p className="text-sm text-rust">{t("form.errFixFields", { count: errorCount })}</p>
        ) : null}
      </div>
    </form>
  );
}
