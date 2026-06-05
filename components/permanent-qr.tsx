"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle2, Loader2, QrCode } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Permanent, reusable campaign QR — one QR, many payments, each recorded as a
// distinct contribution. Two rails:
//   • On-chain: amountless EIP-681 to the campaign Safe. The on-chain indexer
//     already credits every EURe Transfer to the Safe as its own contribution.
//   • SEPA: the rail's `cmp:` protocol — a blank-amount EPC QR whose remittance
//     encodes cmp:0x<safe>?id=<campaignId>; each Monerium order → one
//     contribution (see pinka-onchain-receipts-tokenization-plan.md).

const EURE_GNOSIS_V2 = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430";
const GNOSIS_CHAIN_ID = 100;
const RAIL_URL = process.env.NEXT_PUBLIC_RAIL_URL ?? "https://mpt.domovina.ai";

// Amountless EIP-681 — the same QR works for any amount (wallet prompts).
function eip681Permanent(destination: string): string {
  return `ethereum:${EURE_GNOSIS_V2}@${GNOSIS_CHAIN_ID}/transfer?address=${destination}`;
}

interface CampaignQr {
  memo: string;
  iban: string;
  beneficiary_name: string;
  epc_qr_data: string;
}

export function PermanentQr({
  campaignId,
  destinationAddress,
}: {
  campaignId: string;
  destinationAddress: string;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"sepa" | "onchain">("sepa");
  const [sepa, setSepa] = useState<CampaignQr | null | "error">(null);

  useEffect(() => {
    let alive = true;
    const url =
      `${RAIL_URL}/api/intents/campaign-qr` +
      `?target=${encodeURIComponent(destinationAddress)}&id=${encodeURIComponent(campaignId)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: CampaignQr) => {
        if (alive) setSepa(d);
      })
      .catch(() => {
        if (alive) setSepa("error");
      });
    return () => {
      alive = false;
    };
  }, [campaignId, destinationAddress]);

  return (
    <div className="card-base">
      <h3 className="flex items-center gap-2 text-sm font-display font-semibold">
        <QrCode className="h-4 w-4 text-coral" /> {t("permanentQr.title")}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-inkMuted">
        {t("permanentQr.desc")}
      </p>

      <div className="mt-3 inline-flex rounded-full border border-ink/10 p-0.5 text-sm">
        {(["sepa", "onchain"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTab(m)}
            className={
              "rounded-full px-3 py-1 transition-colors " +
              (tab === m ? "bg-coral text-cream" : "text-inkMuted hover:text-ink")
            }
          >
            {m === "sepa" ? t("permanentQr.tabSepa") : t("permanentQr.tabOnchain")}
          </button>
        ))}
      </div>

      {tab === "sepa" ? (
        <div className="mt-4">
          {sepa === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-inkMuted">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("permanentQr.loading")}
            </div>
          ) : sepa === "error" ? (
            <p className="py-6 text-center text-sm text-inkMuted">
              {t("permanentQr.unavailable")}
            </p>
          ) : (
            <>
              <div className="flex justify-center">
                <div className="rounded-lg bg-white p-4 shadow-soft">
                  <QRCodeSVG value={sepa.epc_qr_data} size={300} level="M" marginSize={4} />
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-inkMuted">
                {t("permanentQr.sepaHint")}
              </p>
              <dl className="mt-4 space-y-1.5 text-sm">
                <CopyRow label={t("permanentQr.iban")} value={sepa.iban} />
                <CopyRow label={t("permanentQr.beneficiary")} value={sepa.beneficiary_name} />
                <CopyRow label={t("permanentQr.reference")} value={sepa.memo} />
              </dl>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex justify-center">
            <div className="rounded-lg bg-white p-4 shadow-soft">
              <QRCodeSVG value={eip681Permanent(destinationAddress)} size={300} level="M" marginSize={4} />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-inkMuted">
            {t("permanentQr.onchainHint")}
          </p>
          <dl className="mt-4 space-y-1.5 text-sm">
            <CopyRow label={t("permanentQr.onchainAddr")} value={destinationAddress} />
          </dl>
        </div>
      )}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <dt className="w-20 shrink-0 text-inkMuted">{label}</dt>
      <dd className="flex-1 truncate font-mono text-xs">{value}</dd>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="text-inkMuted hover:text-ink"
      >
        {copied ? (
          <CheckCircle2 className="h-4 w-4 text-coral" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
