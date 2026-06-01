import { extractPasskeyData } from "@safe-global/protocol-kit";
import { rpId, RP_NAME } from "./constants";

// Minimal WebAuthn passkey layer for pinka creators. A passkey's P256 pubkey
// derives a counterfactual Safe owner (signer); the creator's campaigns route to
// Safes owned by that signer. Mirrors pay.domovina.ai/wallet/src/lib/passkey.ts
// (create ceremony + extractPasskeyData), trimmed to what the dashboard needs.

export type P256PublicKey = { x: bigint; y: bigint };

export interface PinkaPasskey {
  credentialId: string;
  pubKey: { x: string; y: string }; // stored as decimal strings (JSON-safe)
  rpId: string;
  createdAt: string;
}

const STORAGE_KEY = "pinka_creator_passkey";

export function loadPasskey(): PinkaPasskey | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PinkaPasskey;
  } catch {
    return null;
  }
}

export function pubKeyOf(p: PinkaPasskey): P256PublicKey {
  return { x: BigInt(p.pubKey.x), y: BigInt(p.pubKey.y) };
}

/// Create a new passkey (navigator.credentials.create) and persist it locally.
export async function createPasskey(label: string): Promise<PinkaPasskey> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const friendly = (label.trim() || "pinka kreator").slice(0, 64);

  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { id: rpId(), name: RP_NAME },
      user: { id: userId, name: friendly, displayName: friendly },
      challenge,
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256 (P-256) — what Safe uses
        { alg: -257, type: "public-key" }, // RS256 — silences Chromium warning
      ],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "required",
      },
      attestation: "none",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("passkey_cancelled");

  const data = await extractPasskeyData(cred);
  const credentialId = data.rawId.startsWith("0x")
    ? data.rawId.toLowerCase()
    : "0x" + data.rawId.toLowerCase();

  const record: PinkaPasskey = {
    credentialId,
    pubKey: {
      x: BigInt(data.coordinates.x).toString(),
      y: BigInt(data.coordinates.y).toString(),
    },
    rpId: rpId(),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}
