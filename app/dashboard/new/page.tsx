"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";
import { AuthGate } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CampaignForm } from "@/components/dashboard/campaign-form";
import { createCampaign, getMyAccountId } from "@/lib/dashboard";
import { slugify } from "@/lib/format";
import { createPasskey, pubKeyOf, type PinkaPasskey } from "@/lib/chain/passkey";
import { deriveCampaignSafe, type CampaignSafe } from "@/lib/chain/safe";

const inputCls =
  "w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-ink/30 focus:outline-none";

export default function NewCampaignPage() {
  return (
    <AuthGate>
      <NewInner />
    </AuthGate>
  );
}

function NewInner() {
  const router = useRouter();
  const [draftId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [passkeyName, setPasskeyName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [passkey, setPasskey] = useState<PinkaPasskey | null>(null);
  const [safe, setSafe] = useState<CampaignSafe | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest a human-readable, unique passkey label from the campaign title.
  // Stays in sync until the user manually edits it. `pf-` prefix + short id make
  // it findable among many in iCloud Keychain / Google Password Manager.
  useEffect(() => {
    if (nameDirty) return;
    const s = slugify(title) || "kampanja";
    setPasskeyName(`pf-${s}-${draftId.slice(0, 4)}`);
  }, [title, nameDirty, draftId]);

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

  async function connect() {
    if (!title.trim()) {
      setError("Prvo upiši naziv kampanje.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const pk = await createPasskey(passkeyName.trim() || `pf-${draftId.slice(0, 8)}`);
      setPasskey(pk);
      await derive(pk);
    } catch (e) {
      console.error(e);
      setError("Passkey nije kreiran (otkazano ili nepodržano).");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="container-content max-w-4xl py-12">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">
        ← Natrag
      </Link>
      <h1 className="mt-3 text-display-md font-display font-semibold">Nova kampanja</h1>
      <p className="mt-2 text-sm text-inkMuted">
        Dva koraka: prvo naziv i <strong>novčanik kampanje</strong>, zatim detalji.
        Kampanja se kreira kao <strong>nacrt</strong> i ne prima uplate dok je ne aktiviraš.
      </p>

      {/* Korak 1 — naziv + passkey + Safe */}
      <div className="mt-8 card-base">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <ShieldCheck className="h-5 w-5 text-coral" /> 1. Naziv i novčanik (Safe)
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-2 md:grid-cols-[1fr_minmax(0,22rem)]">
          <div>
            <label className="mb-2 block text-sm font-medium">Naziv kampanje</label>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="npr. Nova sezona podcasta o ekonomiji"
              disabled={!!passkey}
            />
          </div>
          <div className="text-xs leading-relaxed text-inkMuted">
            Ovo ljudi vide na javnoj stranici. Upiši ga prvo — iz njega predlažemo ime passkeya.
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-2 md:grid-cols-[1fr_minmax(0,22rem)]">
          <div>
            <label className="mb-2 block text-sm font-medium">Naziv passkeya</label>
            <input
              className={inputCls + " font-mono"}
              value={passkeyName}
              onChange={(e) => {
                setNameDirty(true);
                setPasskeyName(e.target.value);
              }}
              disabled={!!passkey}
            />
          </div>
          <div className="text-xs leading-relaxed text-inkMuted">
            Tako će passkey izgledati u <strong>iCloud Keychainu / Google Password
            Manageru / LastPassu</strong>. Prefiks <code>pf-</code> + naziv kampanje znači da
            ga lako nađeš i kad ih imaš desetke (npr. jedan po epizodi).
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-inkMuted">
          Tvoj <strong>passkey</strong> (Face ID / Touch ID / sigurnosni ključ) postaje vlasnik
          Gnosis <strong>Safe</strong>-a u koji stižu donacije kao EURe. Bez lozinki, bez
          seed-fraza; kontrolu imaš samo ti.
        </p>

        {!passkey ? (
          <Button onClick={connect} disabled={connecting || !title.trim()} className="mt-4">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {connecting ? "Otvaram…" : "Poveži passkey"}
          </Button>
        ) : deriving || !safe ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-inkMuted">
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
              <strong>Counterfactual</strong>: adresa već prima EURe, a sam Safe se na blockchainu
              kreira tek pri prvoj isplati — tako ne plaćaš gas unaprijed.
            </p>
          </dl>
        )}
      </div>

      {/* Korak 2 — detalji */}
      <div className="mt-6 card-base">
        <h2 className="font-display font-semibold">2. Detalji kampanje</h2>
        <div className="mt-2">
          <CampaignForm
            submitLabel="Kreiraj kampanju"
            lockedTitle={title}
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
                    passkey_name: passkeyName.trim(),
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
