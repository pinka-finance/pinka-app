"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";
import { AuthGate } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CampaignForm } from "@/components/dashboard/campaign-form";
import { createCampaign, getMyAccountId } from "@/lib/dashboard";
import {
  createPasskey,
  loadPasskey,
  pubKeyOf,
  type PinkaPasskey,
} from "@/lib/chain/passkey";
import { deriveCampaignSafe, type CampaignSafe } from "@/lib/chain/safe";

export default function NewCampaignPage() {
  return (
    <AuthGate>
      <NewInner />
    </AuthGate>
  );
}

function NewInner() {
  const router = useRouter();
  // Stable id up-front so the per-campaign Safe salt == the row we insert.
  const [draftId] = useState(() => crypto.randomUUID());
  const [passkey, setPasskey] = useState<PinkaPasskey | null>(null);
  const [safe, setSafe] = useState<CampaignSafe | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load any existing passkey after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    setPasskey(loadPasskey());
  }, []);

  const derive = useCallback(
    async (pk: PinkaPasskey) => {
      setDeriving(true);
      setError(null);
      try {
        setSafe(await deriveCampaignSafe(pubKeyOf(pk), draftId));
      } catch (e) {
        console.error(e);
        setError("Izvođenje Safe adrese nije uspjelo (RPC?). Pokušaj ponovno.");
      } finally {
        setDeriving(false);
      }
    },
    [draftId],
  );

  // Derive the campaign Safe whenever we have a passkey but no Safe yet.
  useEffect(() => {
    if (passkey && !safe && !deriving) void derive(passkey);
  }, [passkey, safe, deriving, derive]);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const pk = await createPasskey("pinka kreator");
      setPasskey(pk);
    } catch (e) {
      console.error(e);
      setError("Passkey nije kreiran (otkazano ili nepodržano).");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="container-content max-w-2xl py-12">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">
        ← Natrag
      </Link>
      <h1 className="mt-3 text-display-md font-display font-semibold">
        Nova kampanja
      </h1>
      <p className="mt-2 text-sm text-inkMuted">
        Dva koraka: prvo se izvede <strong>novčanik kampanje</strong>, zatim
        ispuniš detalje. Kampanja se kreira kao <strong>nacrt</strong> i ne prima
        uplate dok je ne aktiviraš.
      </p>

      {/* Korak 1 — passkey + Safe */}
      <div className="mt-8 card-base">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <ShieldCheck className="h-5 w-5 text-coral" /> 1. Novčanik kampanje (Safe)
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-inkMuted">
          Tvoj <strong>passkey</strong> (Face ID / Touch ID / sigurnosni ključ) je
          kriptografski ključ vezan uz ovaj uređaj. Iz njega izvodimo Gnosis{" "}
          <strong>Safe</strong> — multisig novčanik u koji stižu sve donacije kao
          EURe. Bez lozinki, bez seed-fraza; kontrolu imaš samo ti.
        </p>
        {!passkey ? (
          <Button onClick={connect} disabled={connecting} className="mt-4">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {connecting ? "Otvaram…" : "Poveži passkey"}
          </Button>
        ) : deriving || !safe ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-inkMuted">
            <Loader2 className="h-4 w-4 animate-spin" /> Izvodim adresu Safe-a (čitam s Gnosisa)…
          </p>
        ) : (
          <dl className="mt-4 space-y-2 text-xs">
            <div>
              <dt className="text-inkMuted">Vlasnik (signer) — izveden iz passkeya, kontrolira Safe</dt>
              <dd className="break-all font-mono">{safe.signerAddress}</dd>
            </div>
            <div>
              <dt className="text-inkMuted">Safe kampanje — adresa na koju stižu donacije</dt>
              <dd className="break-all font-mono text-coral-700">{safe.safeAddress}</dd>
            </div>
            <p className="pt-1 leading-relaxed text-inkMuted">
              <strong>Counterfactual</strong>: adresa već postoji i prima EURe, a sam Safe
              se na blockchainu kreira tek pri prvoj isplati — tako ne plaćaš gas unaprijed.
            </p>
          </dl>
        )}
      </div>

      {/* Korak 2 — detalji */}
      <div className="mt-6 card-base">
        <h2 className="font-display font-semibold">2. Detalji kampanje</h2>
        <div className="mt-4">
          <CampaignForm
            submitLabel="Kreiraj kampanju"
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
                    pubkey: passkey?.pubKey,
                    credential_id: passkey?.credentialId,
                    safe_version: "1.4.1",
                  },
                },
              });
              router.push(`/dashboard/c/${id}`);
            }}
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rust">{error}</p> : null}
    </div>
  );
}
