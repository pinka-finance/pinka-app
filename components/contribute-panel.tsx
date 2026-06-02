"use client";

import { useCallback, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Heart, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser, ensureSession } from "@/lib/supabase";
import { fmtEur, parseEurToCents } from "@/lib/format";

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

export function ContributePanel({
  campaignId,
  minContributionCents,
}: {
  campaignId: string;
  minContributionCents: number;
}) {
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
      pollRef.current = setInterval(async () => {
        attempts += 1;
        const { data } = await sb
          .schema("pinka_finance")
          .from("contributions")
          .select("state")
          .eq("id", contributionId)
          .maybeSingle();
        const state = (data as { state?: string } | null)?.state;
        if (state === "paid") {
          stopPoll();
          setPhase("paid");
        } else if (state === "failed" || state === "expired" || attempts > 100) {
          stopPoll();
        }
      }, 3000);
    },
    [stopPoll],
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

  async function submit() {
    setError(null);
    if (amountCents < minContributionCents) {
      setError(`Najmanji iznos je ${fmtEur(minContributionCents)} €`);
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
      setError("Neuspjelo kreiranje uplate. Pokušaj ponovno.");
    }
  }

  if (phase === "paid") {
    return (
      <div className="card-base text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-coral" />
        <h3 className="mt-3 text-xl font-display font-semibold">
          Hvala na podršci! 🙏
        </h3>
        <p className="mt-1 text-sm text-inkMuted">
          Plaćanje je potvrđeno na lancu.
        </p>
      </div>
    );
  }

  if (phase === "awaiting" && result) {
    return (
      <div className="card-base">
        <h3 className="text-center text-lg font-display font-semibold">
          Skeniraj u bankovnoj aplikaciji
        </h3>
        <p className="mt-1 text-center text-sm text-inkMuted">
          Iznos: {result.amount_eur} €
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
          <CopyRow label="IBAN" value={result.iban} />
          <CopyRow label="Primatelj" value={result.beneficiary_name} />
          <CopyRow label="Opis" value={result.memo} />
        </dl>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-inkMuted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Čekam potvrdu plaćanja…
        </div>
      </div>
    );
  }

  // idle / creating
  const creating = phase === "creating";
  return (
    <div className="card-base">
      <h3 className="flex items-center gap-2 text-lg font-display font-semibold">
        <Heart className="h-5 w-5 text-coral" /> Podrži ovu kampanju
      </h3>
      <p className="mt-1.5 text-sm text-inkMuted">
        Doniraj jednim skenom — SEPA, bez naknade.
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
          placeholder="Ostalo"
          className="w-24 rounded-full border border-ink/15 px-4 py-2 text-sm focus:border-ink/30 focus:outline-none"
        />
      </div>

      <div className="mt-4 space-y-2">
        <input
          type="text"
          value={displayName}
          maxLength={NAME_MAX}
          disabled={anonymous}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Ime ili nadimak (opcionalno)"
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-ink/30 focus:outline-none disabled:opacity-50"
        />
        <div>
          <textarea
            value={message}
            maxLength={MSG_MAX}
            disabled={anonymous}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Poruka uz podršku (opcionalno)"
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
          Doniraj anonimno (ne prikazuj me na zidu podrške)
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
        {creating ? "Pripremam…" : `Podrži s ${fmtEur(amountCents)} €`}
      </Button>
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
        aria-label={`Kopiraj ${label}`}
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
