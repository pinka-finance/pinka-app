"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, ShieldCheck, Loader2 } from "lucide-react";
import { AuthGate } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CampaignForm, type CampaignFormValues } from "@/components/dashboard/campaign-form";
import { createCampaign, getMyAccountId } from "@/lib/dashboard";
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

function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export default function NewCampaignPage() {
  return (
    <AuthGate>
      <NewInner />
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
  const [restored, setRestored] = useState<CampaignFormValues | undefined>(undefined);
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
    clearDraft();
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
    <div className="container-content max-w-4xl py-12">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">
        ← {t("common.back")}
      </Link>
      <h1 className="mt-3 text-display-md font-display font-semibold">{t("dashboardNew.title")}</h1>
      <p className="mt-2 text-sm text-inkMuted">
        <Rich>{t("dashboardNew.intro")}</Rich>{" "}
        <Link href="/kako-radi" className="underline underline-offset-2 hover:text-ink">
          {t("dashboardNew.howItWorksLink")}
        </Link>
      </p>

      {/* Korak 1 — ecosystem wallet; kampanja dobiva vlastiti račun */}
      <div className="mt-8 card-base">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <ShieldCheck className="h-5 w-5 text-coral" /> {t("dashboardNew.step1Title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-inkMuted">
          <Rich>{t("dashboardNew.step1Desc")}</Rich>
        </p>

        {!connected ? (
          <Button onClick={() => connect()} disabled={connecting} className="mt-4">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {connecting ? t("dashboardNew.openingWallet") : t("dashboardNew.connectWallet")}
          </Button>
        ) : (
          <dl className="mt-4 space-y-2 text-xs">
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

      {/* Korak 2 — detalji */}
      <div className="mt-6 card-base">
        <h2 className="font-display font-semibold">{t("dashboardNew.step2Title")}</h2>
        <div className="mt-2">
          <CampaignForm
            initial={restored}
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
              router.push(`/dashboard/manage?id=${id}`);
            }}
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rust">{error}</p> : null}
    </div>
  );
}
