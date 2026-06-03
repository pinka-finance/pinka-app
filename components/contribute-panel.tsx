"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Heart, Loader2, CheckCircle2, Wallet, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser, ensureSession } from "@/lib/supabase";
import { fmtEur, parseEurToCents } from "@/lib/format";
import { sendEure } from "@/lib/chain/walletSdk";
import { confirmOnchain } from "@/lib/pinka";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type Phase = "idle" | "creating" | "awaiting" | "paid";

interface ContributionResult {
  contribution_id: string;
  sid: string;
  amount_eur: string;
  memo: string;
  iban: string;
  beneficiary_name: string;
  bic: string;
  epc_qr_data: string;
}

const PRESETS = [200, 500, 1000, 2000];

// Monerium EURe V2 on Gnosis (proxy that emits Transfer events; the rail + the
// on-chain indexer use this). See docs/reference/monerium-contracts.md.
const EURE_GNOSIS_V2 = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430";
const GNOSIS_CHAIN_ID = 100;

// EIP-681 ERC-20 transfer URI for an EURe donation to the campaign Safe.
// EURe has 18 decimals; cents → wei = cents * 1e16.
function eip681(destination: string, amountCents: number): string {
  const wei = (BigInt(amountCents) * 10n ** 16n).toString();
  return `ethereum:${EURE_GNOSIS_V2}@${GNOSIS_CHAIN_ID}/transfer?address=${destination}&uint256=${wei}`;
}

export function ContributePanel({
  campaignId,
  minContributionCents,
  destinationAddress,
  onPaid,
}: {
  campaignId: string;
  minContributionCents: number;
  destinationAddress?: string | null;
  onPaid?: () => void;
}) {
  const { t } = useI18n();
  const { identity, signInWithCertilia } = useAuth();
  const verified = identity?.verified === true;
  const verifiedName = [identity?.first_name, identity?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const [certBusy, setCertBusy] = useState(false);
  const [certErr, setCertErr] = useState<string | null>(null);
  const prefilledRef = useRef(false);
  const [mode, setMode] = useState<"sepa" | "onchain">("sepa");
  const [phase, setPhase] = useState<Phase>("idle");
  const [amountCents, setAmountCents] = useState<number>(
    Math.max(500, minContributionCents),
  );
  const [custom, setCustom] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContributionResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [walletPhase, setWalletPhase] = useState<"idle" | "sending" | "confirming">("idle");
  const [walletErr, setWalletErr] = useState<string | null>(null);

  const NAME_MAX = 60;
  const MSG_MAX = 280;

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (contributionId: string) => {
      const sb = supabaseBrowser();
      let attempts = 0;
      stopPoll();
      const tick = async () => {
        attempts += 1;
        // SECURITY DEFINER RPC keyed by the (unguessable) contribution id —
        // a guest/anon session can't read its own contributions row via RLS
        // (no account → is_account_member fails), so a direct select never saw
        // 'paid'. The RPC returns only {state, paid_at}.
        const { data } = await sb
          .schema("pinka_finance")
          .rpc("contribution_status", { p_contribution_id: contributionId });
        const row = Array.isArray(data) ? data[0] : data;
        const state = (row as { state?: string } | null)?.state;
        if (state === "paid") {
          stopPoll();
          setPhase("paid");
          onPaid?.(); // let the wall refresh + animate the new entry immediately
        } else if (state === "failed" || state === "expired" || attempts > 300) {
          stopPoll();
        }
      };
      void tick(); // immediate first check, then every 3s (up to ~15 min)
      pollRef.current = setInterval(tick, 3000);
    },
    [stopPoll, onPaid],
  );

  function pickPreset(cents: number) {
    setCustom("");
    setAmountCents(cents);
  }

  function onCustom(v: string) {
    setCustom(v);
    const c = parseEurToCents(v);
    if (c) setAmountCents(c);
  }

  // Once verified, offer the real name as the wall display name (one-time, only
  // if the field is still empty — the contributor stays free to edit or clear).
  useEffect(() => {
    if (verified && verifiedName && !prefilledRef.current && displayName === "") {
      prefilledRef.current = true;
      setDisplayName(verifiedName);
    }
  }, [verified, verifiedName, displayName]);

  // eID login from inside the contribute flow: on success `identity` flips to
  // verified and the next contribution is snapshotted as verified server-side
  // (create_contribution reads identity_verifications for the signed-in user).
  async function doCertilia() {
    setCertBusy(true);
    setCertErr(null);
    try {
      await signInWithCertilia();
    } catch {
      setCertErr(t("contribute.verifyFailed"));
    } finally {
      setCertBusy(false);
    }
  }

  async function submit() {
    setError(null);
    if (amountCents < minContributionCents) {
      setError(t("contribute.minAmount", { amount: fmtEur(minContributionCents) }));
      return;
    }
    setPhase("creating");
    try {
      const sb = supabaseBrowser();
      await ensureSession(sb);
      const { data, error: invokeErr } = await sb.functions.invoke(
        "pinka-contribute",
        {
          body: {
            campaign_id: campaignId,
            amount_cents: amountCents,
            anonymous,
            // Only send identity/message when NOT anonymous (the public wall
            // hides anonymous contributions entirely).
            display_name: anonymous ? null : displayName.trim().slice(0, NAME_MAX) || null,
            message: anonymous ? null : message.trim().slice(0, MSG_MAX) || null,
          },
        },
      );
      if (invokeErr) throw invokeErr;
      const res = data as ContributionResult & { error?: string };
      if (res.error) throw new Error(res.error);
      setResult(res);
      setPhase("awaiting");
      startPolling(res.contribution_id);
    } catch (e) {
      console.error(e);
      setPhase("idle");
      setError(t("contribute.createFailed"));
    }
  }

  // In-app on-chain donation: send EURe from the DOMOVINA wallet (SDK), then
  // verify+credit the resulting tx (pinka-onchain-confirm) for an instant flip —
  // no waiting for the cron indexer.
  async function payFromWallet() {
    if (!destinationAddress) return;
    if (amountCents < minContributionCents) {
      setWalletErr(t("contribute.minAmount", { amount: fmtEur(minContributionCents) }));
      return;
    }
    setWalletErr(null);
    setWalletPhase("sending");
    try {
      const { txHash } = await sendEure(destinationAddress, (amountCents / 100).toFixed(2));
      setWalletPhase("confirming");
      // Poll the verifier until the tx mines + credits (~Gnosis 5s blocks).
      for (let i = 0; i < 20; i++) {
        const r = await confirmOnchain(campaignId, txHash);
        if (r.reverted) throw new Error("reverted");
        if (r.credited > 0) {
          setPhase("paid");
          onPaid?.();
          return;
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
      // Mined slowly or still settling — the cron indexer will catch it; show a soft note.
      setWalletErr(t("contribute.walletSentSoft"));
      setWalletPhase("idle");
    } catch (e) {
      console.error(e);
      setWalletPhase("idle");
      setWalletErr(t("contribute.walletFailed"));
    }
  }

  if (phase === "paid") {
    return (
      <div className="card-base text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-coral" />
        <h3 className="mt-3 text-xl font-display font-semibold">
          {t("contribute.thanksTitle")}
        </h3>
        <p className="mt-1 text-sm text-inkMuted">{t("contribute.thanksDesc")}</p>
      </div>
    );
  }

  if (phase === "awaiting" && result) {
    return (
      <div className="card-base">
        <h3 className="text-center text-lg font-display font-semibold">
          {t("contribute.scanTitle")}
        </h3>
        <p className="mt-1 text-center text-sm text-inkMuted">
          {t("contribute.amountLabel", { amount: result.amount_eur })}
        </p>
        <div className="mt-5 flex justify-center">
          <div className="rounded-lg bg-white p-4 shadow-soft">
            {/* 320px + 4-module quiet zone mirrors the wallet.domovina.ai QR
                (qr-code-styling @320, ECC M) that Revolut iOS scans reliably.
                The EPC v002 payload is dense (~v8-9, ~50 modules); at the old
                220px (~4px/module) Revolut's camera couldn't lock on even
                though lenient QR-reader apps decoded it fine. Same EPC string. */}
            <QRCodeSVG value={result.epc_qr_data} size={320} level="M" marginSize={4} />
          </div>
        </div>
        <dl className="mt-5 space-y-1.5 text-sm">
          <CopyRow label={t("contribute.iban")} value={result.iban} />
          <CopyRow label={t("contribute.beneficiary")} value={result.beneficiary_name} />
          <CopyRow label={t("contribute.description")} value={result.memo} />
        </dl>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-inkMuted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("contribute.awaiting")}
        </div>
      </div>
    );
  }

  // idle / creating
  const creating = phase === "creating";
  return (
    <div className="card-base">
      <h3 className="flex items-center gap-2 text-lg font-display font-semibold">
        <Heart className="h-5 w-5 text-coral" /> {t("contribute.heading")}
      </h3>

      {destinationAddress ? (
        <div className="mt-3 inline-flex rounded-full border border-ink/10 p-0.5 text-sm">
          {(["sepa", "onchain"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                "rounded-full px-3 py-1 transition-colors " +
                (mode === m ? "bg-coral text-cream" : "text-inkMuted hover:text-ink")
              }
            >
              {m === "sepa" ? t("contribute.tabSepa") : t("contribute.tabOnchain")}
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-2 text-sm text-inkMuted">
        {mode === "sepa"
          ? t("contribute.sepaBlurb")
          : t("contribute.onchainBlurb")}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((c) => {
          const active = amountCents === c && custom === "";
          return (
            <button
              key={c}
              type="button"
              onClick={() => pickPreset(c)}
              className={
                "rounded-full border px-4 py-2 text-sm transition-colors " +
                (active
                  ? "border-coral bg-coral text-cream"
                  : "border-ink/15 hover:border-ink/30")
              }
            >
              {fmtEur(c)} €
            </button>
          );
        })}
        <input
          inputMode="decimal"
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          placeholder={t("contribute.otherAmount")}
          className="w-24 rounded-full border border-ink/15 px-4 py-2 text-sm focus:border-ink/30 focus:outline-none"
        />
      </div>

      {mode === "sepa" ? (
      <>
      {verified ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            {verifiedName
              ? t("contribute.verifiedAs", { name: verifiedName })
              : t("contribute.verifiedAnon")}
          </span>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-ink/10 bg-sand/40 p-3">
          <button
            type="button"
            onClick={doCertilia}
            disabled={certBusy}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-teal-300 bg-white px-4 py-2.5 text-sm font-medium text-teal-800 transition-colors hover:border-teal-500 disabled:opacity-50"
          >
            {certBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {certBusy ? t("contribute.verifyOpening") : t("contribute.verifyCta")}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-inkMuted">
            {t("contribute.verifyDesc")}
          </p>
          {certErr ? <p className="mt-1.5 text-xs text-rust">{certErr}</p> : null}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <input
          type="text"
          value={displayName}
          maxLength={NAME_MAX}
          disabled={anonymous}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("contribute.namePlaceholder")}
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-ink/30 focus:outline-none disabled:opacity-50"
        />
        <div>
          <textarea
            value={message}
            maxLength={MSG_MAX}
            disabled={anonymous}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("contribute.messagePlaceholder")}
            rows={2}
            className="w-full resize-none rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-ink/30 focus:outline-none disabled:opacity-50"
          />
          {!anonymous && message.length > 0 ? (
            <p className="mt-0.5 text-right text-[11px] text-inkMuted">
              {message.length}/{MSG_MAX}
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-inkMuted">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 rounded border-ink/30 text-coral focus:ring-coral"
          />
          {t("contribute.anonymous")}
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-rust">{error}</p> : null}

      <Button
        onClick={submit}
        disabled={creating}
        className="mt-5 w-full"
      >
        {creating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className="h-4 w-4" />
        )}
        {creating
          ? t("contribute.preparing")
          : t("contribute.supportWith", { amount: fmtEur(amountCents) })}
      </Button>
      </>
      ) : (
        <div className="mt-5">
          <Button
            onClick={payFromWallet}
            disabled={walletPhase !== "idle"}
            className="w-full"
          >
            {walletPhase === "idle" ? (
              <Wallet className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {walletPhase === "sending"
              ? t("contribute.openingWallet")
              : walletPhase === "confirming"
                ? t("contribute.confirmingChain")
                : t("contribute.payFromWallet", { amount: fmtEur(amountCents) })}
          </Button>
          {walletErr ? (
            <p className="mt-2 text-center text-sm text-rust">{walletErr}</p>
          ) : null}

          <div className="my-4 flex items-center gap-3 text-xs text-inkMuted">
            <span className="h-px flex-1 bg-ink/10" />
            {t("contribute.orScanOther")}
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <div className="flex justify-center">
            <div className="rounded-lg bg-white p-4 shadow-soft">
              <QRCodeSVG
                value={eip681(destinationAddress ?? "", amountCents)}
                size={300}
                level="M"
                marginSize={4}
              />
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-inkMuted">
            {t("contribute.scanWithWallet", { amount: fmtEur(amountCents) })}
          </p>
          <dl className="mt-4 space-y-1.5 text-sm">
            <CopyRow label={t("contribute.beneficiary")} value={destinationAddress ?? ""} />
            <CopyRow label={t("contribute.token")} value="EURe · Monerium V2 · Gnosis" />
          </dl>
          <p className="mt-3 text-center text-xs text-inkMuted">
            {t("contribute.appearsOnWall")}
          </p>
        </div>
      )}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <dt className="w-20 shrink-0 text-inkMuted">{label}</dt>
      <dd className="flex-1 truncate font-mono text-xs">{value}</dd>
      <button
        type="button"
        aria-label={t("contribute.copyAria", { label })}
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
