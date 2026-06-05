"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle2, Loader2, QrCode } from "lucide-react";
import { fmtEur, parseEurToCents } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

// Permanent, reusable campaign QR — one QR, many payments, each recorded as a
// distinct contribution. The amount is OPTIONAL: blank = free choice, or a
// prefilled value (e.g. €10 donation / €15 membership) that the payer can still
// override. Either way the SAME cmp: reference + Safe is used, and the actual
// settled amount is what gets recorded — the QR amount is only a prefill.
//   • On-chain: EIP-681 to the campaign Safe (amountless or with uint256 wei).
//   • SEPA: rail `cmp:` protocol — EPC with blank or prefilled amount; memo
//     cmp:0x<safe>?id=<campaignId> (see pinka-onchain-receipts-tokenization-plan.md).

const EURE_GNOSIS_V2 = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430";
const GNOSIS_CHAIN_ID = 100;
const RAIL_URL = process.env.NEXT_PUBLIC_RAIL_URL ?? "https://mpt.domovina.ai";
const PRESETS = [500, 1000, 1500]; // €5 / €10 / €15

// EIP-681 — amountless (payer enters) or with a uint256 wei prefill.
function eip681Permanent(destination: string, amountCents: number | null): string {
  const base = `ethereum:${EURE_GNOSIS_V2}@${GNOSIS_CHAIN_ID}/transfer?address=${destination}`;
  if (!amountCents) return base;
  const wei = (BigInt(amountCents) * 10n ** 16n).toString();
  return `${base}&uint256=${wei}`;
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
  // null = free choice (blank amount); a number = prefilled (overridable).
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [sepa, setSepa] = useState<CampaignQr | null | "error">(null);

  useEffect(() => {
    let alive = true;
    setSepa(null);
    let url =
      `${RAIL_URL}/api/intents/campaign-qr` +
      `?target=${encodeURIComponent(destinationAddress)}&id=${encodeURIComponent(campaignId)}`;
    if (amountCents) url += `&amount=${(amountCents / 100).toFixed(2)}`;
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
  }, [campaignId, destinationAddress, amountCents]);

  function pickFree() {
    setCustom("");
    setAmountCents(null);
  }
  function pickPreset(cents: number) {
    setCustom("");
    setAmountCents(cents);
  }
  function onCustom(v: string) {
    setCustom(v);
    const c = parseEurToCents(v);
    setAmountCents(c || null);
  }

  return (
    <div className="card-base">
      <h3 className="flex items-center gap-2 text-sm font-display font-semibold">
        <QrCode className="h-4 w-4 text-coral" /> {t("permanentQr.title")}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-inkMuted">
        {t("permanentQr.desc")}
      </p>

      {/* Amount selector — applies to both rails. Free = blank/overridable. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <AmtBtn active={amountCents === null && custom === ""} onClick={pickFree}>
          {t("permanentQr.free")}
        </AmtBtn>
        {PRESETS.map((c) => (
          <AmtBtn key={c} active={amountCents === c && custom === ""} onClick={() => pickPreset(c)}>
            {fmtEur(c)} €
          </AmtBtn>
        ))}
        <input
          inputMode="decimal"
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          placeholder={t("permanentQr.fixedAmount")}
          className="w-24 rounded-full border border-ink/15 px-3 py-1 text-sm focus:border-ink/30 focus:outline-none"
        />
      </div>
      {amountCents ? (
        <p className="mt-1.5 text-[11px] text-inkMuted">{t("permanentQr.prefillNote")}</p>
      ) : null}

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
              <QRCodeSVG
                value={eip681Permanent(destinationAddress, amountCents)}
                size={300}
                level="M"
                marginSize={4}
              />
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

function AmtBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-sm transition-colors " +
        (active ? "border-coral bg-coral text-cream" : "border-ink/15 hover:border-ink/30")
      }
    >
      {children}
    </button>
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
