"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, ShieldCheck, Loader2, Circle, CheckCircle2 } from "lucide-react";
import { AuthGate, VerifiedGate } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CampaignForm, type CampaignFormValues } from "@/components/dashboard/campaign-form";
import { ConfigImport } from "@/components/dashboard/config-import";
import { CampaignCard } from "@/components/campaign-card";
import { createCampaign, getMyAccountId } from "@/lib/dashboard";
import type { Campaign } from "@/lib/pinka";
import {
  connectWallet,
  disconnectWallet,
  preloadWallet,
  supportsCampaignAccounts,
  createCampaignAccount,
} from "@/lib/chain/walletSdk";
import { deriveCampaignSafeFromSigner, type CampaignSafe } from "@/lib/chain/safe";
import { useI18n, Rich } from "@/lib/i18n";

// The create-account handoff is a FULL-PAGE round-trip to the wallet (same
// model as connect — see lib/chain/walletSdk.ts), so the form draft must
// survive a navigation: it's stashed in sessionStorage right before the
// handoff and consumed on return (dw_return=1&dw_account=…).
const DRAFT_KEY = "pinka.campaign_draft_v1";
// Kontinuirani autosave sirovog unosa (gubitak taba/crash) — čisti se nakon
// uspješnog kreiranja. Vidi CampaignForm draftKey.
const FORM_DRAFT_KEY = "pinka.campaign_form_draft_v1";

interface CampaignDraft {
  draftId: string;
  values: CampaignFormValues;
}

function loadDraft(): CampaignDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CampaignDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(d: CampaignDraft): void {
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}

function clearDrafts(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(FORM_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export default function NewCampaignPage() {
  return (
    <AuthGate>
      {/* Kreiranje kampanje SAMO uz Certilia Mobile ID (KYC/AML) — uz UI gate
          isto enforca i RLS na campaigns INSERT (is_identity_verified()). */}
      <VerifiedGate>
        <NewInner />
      </VerifiedGate>
    </AuthGate>
  );
}

// How the campaign's destination account comes to be:
//  - "account": the wallet opens a NEW named account (wallet-native derived
//    Safe) during creation — it shows up in the user's DOMOVINA wallet like a
//    separate bank account. Used when the loaded SDK supports it (≥ 0.10).
//  - "derive": legacy/fallback — pinka derives a 1/1 Safe from the connected
//    signer client-side (also the Safe{Wallet} Safe-App path).
type SafeMode = "account" | "derive";

function NewInner() {
  const { t } = useI18n();
  const router = useRouter();
  const [draftId] = useState(
    () => (typeof window !== "undefined" && loadDraft()?.draftId) || crypto.randomUUID(),
  );
  const [mode, setMode] = useState<SafeMode | null>(null);
  const [ecosystemSafe, setEcosystemSafe] = useState<`0x${string}` | null>(null);
  const [safe, setSafe] = useState<CampaignSafe | null>(null);
  const [restored, setRestored] = useState<Partial<CampaignFormValues> | undefined>(undefined);
  // remount forme nakon AI importa — initial se ponovno primijeni
  const [formKey, setFormKey] = useState(0);
  // live snapshot za preview/checklist/AI export (emitira CampaignForm)
  const [snapshot, setSnapshot] = useState<CampaignFormValues | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(opts?: { force?: boolean }) {
    setConnecting(true);
    setError(null);
    try {
      // First connect hands off full-page to the wallet and never resolves here
      // (the page navigates away, then returns); a cached connect resolves now.
      const { signerAddress, safeAddress } = await connectWallet(opts);
      setEcosystemSafe(safeAddress);
      if (await supportsCampaignAccounts()) {
        // The campaign account is opened IN the wallet at creation time — no
        // client-side derivation; the address arrives via the return params.
        setMode("account");
        setSafe(null);
      } else {
        setMode("derive");
        setSafe(await deriveCampaignSafeFromSigner(signerAddress, draftId));
      }
    } catch (e) {
      console.error(e);
      setError(t("dashboardNew.connectFailed"));
    } finally {
      setConnecting(false);
    }
  }

  // Pick a different wallet: drop the cached identity, then hand off again.
  async function changeWallet() {
    await disconnectWallet();
    void connect({ force: true });
  }

  // Account mode: open the named account in the wallet, then create the
  // campaign with the returned address. On a fresh handoff the first await
  // navigates away (the draft is already persisted); on return it resolves
  // synchronously from the URL params.
  async function finishWithAccount(draft: CampaignDraft): Promise<void> {
    const account = await createCampaignAccount(draft.values.title);
    const accountId = await getMyAccountId();
    if (!accountId) throw new Error("no_account");
    const v = draft.values;
    const id = await createCampaign({
      id: draft.draftId,
      accountId,
      title: v.title,
      type: v.type,
      description: v.description,
      goalCents: v.goalCents,
      minContributionCents: v.minContributionCents,
      destinationAddress: account.accountAddress,
      subjectType: v.subjectType,
      subjectRef: v.subjectRef,
      visibility: v.visibility,
      recurrence: v.recurrence,
      recurrenceAnchorDay: v.recurrenceAnchorDay,
      latitude: v.latitude,
      longitude: v.longitude,
      locationName: v.locationName,
      coverImageUrl: v.coverImageUrl,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      metadata: {
        safe: {
          signer_address: account.signerAddress,
          ...(account.saltNonce ? { salt_nonce: account.saltNonce } : {}),
          ecosystem_safe: account.safeAddress,
          source: "domovina-wallet-account",
          safe_version: "1.4.1",
        },
      },
    });
    clearDrafts();
    router.push(`/dashboard/manage?id=${id}`);
  }

  // Warm the wallet SDK on mount. Returning from a full-page wallet handoff
  // (dw_return=1) there are two cases: a create-account round-trip with a
  // pending draft → finish creating the campaign; otherwise re-run connect()
  // (the SDK resolves it from the CSRF-checked URL params).
  useEffect(() => {
    if (typeof window === "undefined") return;
    preloadWallet();
    const params = new URLSearchParams(window.location.search);
    if (params.get("dw_return") !== "1") return;
    const draft = loadDraft();
    if (draft && params.get("dw_account")) {
      setRestored(draft.values);
      setFinishing(true);
      finishWithAccount(draft)
        .catch((e) => {
          console.error(e);
          setError(t("dashboardNew.accountFailed"));
          setFinishing(false);
          void connect();
        })
        .then(() => {
          /* on success we navigate away; keep the spinner until then */
        });
      return;
    }
    if (draft) {
      // Came back without an account (cancelled/failed in the wallet) — keep
      // the user's input and let them retry.
      setRestored(draft.values);
      if (params.get("dw_error")) setError(t("dashboardNew.accountFailed"));
    }
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (finishing) {
    return (
      <div className="container-content max-w-4xl py-12">
        <div className="card-base flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-coral" />
          <p className="text-sm text-inkMuted">{t("dashboardNew.finishing")}</p>
        </div>
      </div>
    );
  }

  const connected = !!ecosystemSafe && mode !== null;

  return (
    // Namjerno šire od max-w-content: forma je data-heavy one-time desktop
    // zadatak — sekcije u 2 stupca + sticky preview rail, bez dugog scrolla.
    <div className="mx-auto w-full max-w-[1700px] px-5 py-12 sm:px-8 lg:px-12">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">
        ← {t("common.back")}
      </Link>
      <div className="max-w-3xl">
        <h1 className="mt-4 text-display-md font-display font-semibold">
          {t("dashboardNew.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-inkMuted">
          <Rich>{t("dashboardNew.intro")}</Rich>{" "}
          <Link href="/kako-radi" className="underline underline-offset-2 hover:text-ink">
            {t("dashboardNew.howItWorksLink")}
          </Link>
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,25rem)]">
        <div className="space-y-6">
          {/* ── Novčanik (bivši korak 1) ── */}
          <div className="card-base !p-6">
            <h2 className="flex items-center gap-2 font-display font-semibold">
              <ShieldCheck className="h-5 w-5 text-coral" /> {t("dashboardNew.step1Title")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-inkMuted">
              <Rich>{t("dashboardNew.step1Desc")}</Rich>
            </p>

            {!connected ? (
              <Button onClick={() => connect()} disabled={connecting} className="mt-5">
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                {connecting ? t("dashboardNew.openingWallet") : t("dashboardNew.connectWallet")}
              </Button>
            ) : (
              <dl className="mt-5 space-y-3 text-xs">
                <div>
                  <dt className="text-inkMuted">{t("dashboardNew.ecosystemWalletLabel")}</dt>
                  <dd className="break-all font-mono">{ecosystemSafe}</dd>
                </div>
                {mode === "derive" && safe ? (
                  <>
                    <div>
                      <dt className="text-inkMuted">{t("dashboardNew.campaignSafeLabel")}</dt>
                      <dd className="break-all font-mono text-coral-700">{safe.safeAddress}</dd>
                    </div>
                    <p className="pt-1 leading-relaxed text-inkMuted">
                      <Rich>{t("dashboardNew.counterfactualNote")}</Rich>
                    </p>
                  </>
                ) : (
                  <p className="pt-1 leading-relaxed text-inkMuted">
                    <Rich>{t("dashboardNew.walletAccountNote")}</Rich>
                  </p>
                )}
                <button
                  type="button"
                  onClick={changeWallet}
                  className="text-inkMuted underline underline-offset-2 hover:text-ink"
                >
                  {t("dashboardNew.changeWallet")}
                </button>
              </dl>
            )}
          </div>

          {/* ── AI asistent: predložak / uvoz / izvoz ── */}
          <ConfigImport
            current={snapshot}
            onApply={(patch) => {
              setRestored({ ...(snapshot ?? {}), ...patch });
              setFormKey((k) => k + 1);
            }}
          />

          {/* ── Detalji ── */}
          <CampaignForm
            key={formKey}
            layout="wide"
            draftKey={FORM_DRAFT_KEY}
            initial={restored}
            onValuesChange={setSnapshot}
            submitLabel={t("dashboardNew.createCampaign")}
            lockedDestination={safe?.safeAddress ?? null}
            pendingDestinationNote={
              mode === "account" ? t("form.safePendingAccount") : undefined
            }
            onSubmit={async (v) => {
              if (mode === "account") {
                // Persist the draft, then hand off — the wallet opens the
                // campaign's account and we finish on return.
                const draft: CampaignDraft = { draftId, values: v };
                saveDraft(draft);
                await finishWithAccount(draft);
                return;
              }
              if (!safe) throw new Error("safe_not_ready");
              const accountId = await getMyAccountId();
              if (!accountId) throw new Error("no_account");
              const id = await createCampaign({
                id: draftId,
                accountId,
                title: v.title,
                type: v.type,
                description: v.description,
                goalCents: v.goalCents,
                minContributionCents: v.minContributionCents,
                destinationAddress: safe.safeAddress,
                subjectType: v.subjectType,
                subjectRef: v.subjectRef,
                visibility: v.visibility,
                recurrence: v.recurrence,
                recurrenceAnchorDay: v.recurrenceAnchorDay,
                latitude: v.latitude,
                longitude: v.longitude,
                locationName: v.locationName,
                coverImageUrl: v.coverImageUrl,
                startsAt: v.startsAt,
                endsAt: v.endsAt,
                metadata: {
                  safe: {
                    signer_address: safe.signerAddress,
                    salt_nonce: safe.saltNonce,
                    ecosystem_safe: ecosystemSafe,
                    source: "domovina-wallet",
                    safe_version: "1.4.1",
                  },
                },
              });
              clearDrafts();
              router.push(`/dashboard/manage?id=${id}`);
            }}
          />

          {error ? <p className="text-sm leading-relaxed text-rust">{error}</p> : null}
        </div>

        {/* ── Sticky rail: live preview + checklist ── */}
        <aside className="hidden xl:block">
          <div className="sticky top-20 space-y-5">
            <PreviewRail snapshot={snapshot} connected={connected} />
          </div>
        </aside>
      </div>
    </div>
  );
}

// Sastavi fake Campaign iz snapshot-a forme za CampaignCard preview.
function toPreviewCampaign(s: CampaignFormValues, placeholderTitle: string): Campaign {
  return {
    id: "preview",
    slug: "",
    type: s.type,
    title: s.title || placeholderTitle,
    description: s.description || null,
    subject_type: s.subjectType,
    subject_ref: s.subjectRef,
    goal_cents: s.goalCents,
    min_contribution_cents: s.minContributionCents || 100,
    currency: "eur",
    cover_image_url: s.coverImageUrl,
    state: "draft",
    destination_address: s.destinationAddress || null,
    chain: "gnosis",
    latitude: s.latitude,
    longitude: s.longitude,
    location_name: s.locationName,
    stats: { total_raised_cents: 0, contribution_count: 0, contributor_count: 0 },
  };
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink/20" />
      )}
      <span className={done ? "text-ink" : "text-inkMuted"}>{label}</span>
    </li>
  );
}

function PreviewRail({
  snapshot,
  connected,
}: {
  snapshot: CampaignFormValues | null;
  connected: boolean;
}) {
  const { t } = useI18n();
  const s = snapshot;
  return (
    <>
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-inkSoft">
          {t("dashboardNew.preview.title")}
        </h3>
        <p className="mt-1 text-xs text-inkMuted">{t("dashboardNew.preview.desc")}</p>
        <div className="pointer-events-none mt-3" aria-hidden>
          {s ? (
            <CampaignCard campaign={toPreviewCampaign(s, t("dashboardNew.preview.placeholderTitle"))} />
          ) : null}
        </div>
      </div>

      <div className="card-base !p-5">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-inkSoft">
          {t("dashboardNew.checklist.title")}
        </h3>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-inkMuted">
          {t("dashboardNew.checklist.required")}
        </p>
        <ul className="mt-2 space-y-2 text-sm">
          <ChecklistItem
            done={(s?.title.length ?? 0) >= 3}
            label={t("dashboardNew.checklist.itemTitle")}
          />
          <ChecklistItem done={connected} label={t("dashboardNew.checklist.itemWallet")} />
        </ul>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-inkMuted">
          {t("dashboardNew.checklist.recommended")}
        </p>
        <ul className="mt-2 space-y-2 text-sm">
          <ChecklistItem
            done={(s?.description.length ?? 0) >= 100}
            label={t("dashboardNew.checklist.itemDesc")}
          />
          <ChecklistItem done={!!s?.coverImageUrl} label={t("dashboardNew.checklist.itemCover")} />
          <ChecklistItem done={s?.goalCents != null} label={t("dashboardNew.checklist.itemGoal")} />
          <ChecklistItem
            done={s?.latitude != null}
            label={t("dashboardNew.checklist.itemLocation")}
          />
        </ul>
      </div>
    </>
  );
}
