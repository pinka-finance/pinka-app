"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, ShieldCheck, Loader2 } from "lucide-react";
import { AuthGate } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CampaignForm } from "@/components/dashboard/campaign-form";
import { createCampaign, getMyAccountId } from "@/lib/dashboard";
import { connectWallet } from "@/lib/chain/walletSdk";
import { deriveCampaignSafeFromSigner, type CampaignSafe } from "@/lib/chain/safe";
import { useI18n, Rich } from "@/lib/i18n";

export default function NewCampaignPage() {
  return (
    <AuthGate>
      <NewInner />
    </AuthGate>
  );
}

function NewInner() {
  const { t } = useI18n();
  const router = useRouter();
  const [draftId] = useState(() => crypto.randomUUID());
  const [ecosystemSafe, setEcosystemSafe] = useState<`0x${string}` | null>(null);
  const [safe, setSafe] = useState<CampaignSafe | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const { signerAddress, safeAddress } = await connectWallet();
      setEcosystemSafe(safeAddress);
      setSafe(await deriveCampaignSafeFromSigner(signerAddress, draftId));
    } catch (e) {
      console.error(e);
      setError(t("dashboardNew.connectFailed"));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="container-content max-w-4xl py-12">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">
        ← {t("common.back")}
      </Link>
      <h1 className="mt-3 text-display-md font-display font-semibold">{t("dashboardNew.title")}</h1>
      <p className="mt-2 text-sm text-inkMuted">
        <Rich>{t("dashboardNew.intro")}</Rich>
      </p>

      {/* Korak 1 — ecosystem wallet + per-campaign Safe */}
      <div className="mt-8 card-base">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <ShieldCheck className="h-5 w-5 text-coral" /> {t("dashboardNew.step1Title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-inkMuted">
          <Rich>{t("dashboardNew.step1Desc")}</Rich>
        </p>

        {!safe ? (
          <Button onClick={connect} disabled={connecting} className="mt-4">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {connecting ? t("dashboardNew.openingWallet") : t("dashboardNew.connectWallet")}
          </Button>
        ) : (
          <dl className="mt-4 space-y-2 text-xs">
            <div>
              <dt className="text-inkMuted">{t("dashboardNew.ecosystemWalletLabel")}</dt>
              <dd className="break-all font-mono">{ecosystemSafe}</dd>
            </div>
            <div>
              <dt className="text-inkMuted">{t("dashboardNew.campaignSafeLabel")}</dt>
              <dd className="break-all font-mono text-coral-700">{safe.safeAddress}</dd>
            </div>
            <p className="pt-1 leading-relaxed text-inkMuted">
              <Rich>{t("dashboardNew.counterfactualNote")}</Rich>
            </p>
          </dl>
        )}
      </div>

      {/* Korak 2 — detalji */}
      <div className="mt-6 card-base">
        <h2 className="font-display font-semibold">{t("dashboardNew.step2Title")}</h2>
        <div className="mt-2">
          <CampaignForm
            submitLabel={t("dashboardNew.createCampaign")}
            lockedDestination={safe?.safeAddress ?? null}
            onSubmit={async (v) => {
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
