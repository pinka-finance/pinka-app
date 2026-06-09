// DOMOVINA Wallet iframe SDK bridge.
//
// Loads wallet.domovina.ai/sdk.js, which mounts a hidden iframe at
// wallet.domovina.ai/embed and runs the WebAuthn passkey ceremony under RP ID
// `domovina.ai` — the SAME ecosystem identity used on domovina.ai,
// domovina.energy, etc. `connect()` returns the user's ecosystem signer; pinka
// derives a per-campaign Safe from it via saltNonce (see lib/chain/safe.ts).
//
// Why this and not a local passkey: a pinka.finance-scoped passkey is invisible
// on other registrable domains (WebAuthn RP-ID boundary). The iframe runs the
// ceremony under domovina.ai, so the Safe owner is shared ecosystem-wide.
// See pay.domovina.ai/docs/plans/cross-domain-wallet-passkey.md + ADR 0009.

import { getSafeContext, sendEureViaSafe } from "./safeApp";

const SDK_SRC =
  process.env.NEXT_PUBLIC_WALLET_SDK_URL ?? "https://wallet.domovina.ai/sdk.js";

interface DomovinaSdk {
  connect(opts?: {
    force?: boolean;
  }): Promise<{ safeAddress: string; signerAddress: string; credentialId?: string | null }>;
  /** Forget the cached connection so the next connect() re-picks a wallet. */
  disconnect?(): void;
  send(a: { to: string; amount: string }): Promise<{ txHash: string }>;
}

declare global {
  interface Window {
    Domovina?: DomovinaSdk;
  }
}

let loader: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.Domovina) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("wallet_sdk_load_failed"));
    document.head.appendChild(s);
  });
  return loader;
}

export interface EcosystemWallet {
  safeAddress: `0x${string}`; // user's main ecosystem Safe (saltNonce 0)
  signerAddress: `0x${string}`; // WebAuthn signer — owns per-campaign Safes too
}

/// Connect the user's wallet. Inside Safe{Wallet} (Safe App) the host Safe is the
/// account and owns the per-campaign Safes; otherwise resolve the DOMOVINA
/// ecosystem wallet. First connect on a device hands off full-page to
/// wallet.domovina.ai (native passkey create/open) and returns here; after that
/// it resolves instantly from the cached identity. NOTE: on a fresh connect this
/// navigates away and the returned promise never resolves — the page reloads on
/// return and `connect()` is re-run (see dashboard/new). Pass `{ force:true }` to
/// re-pick a different wallet.
export async function connectWallet(opts?: { force?: boolean }): Promise<EcosystemWallet> {
  const safeCtx = await getSafeContext();
  if (safeCtx) {
    // Host Safe is the signer/owner — campaign Safes derive from it via saltNonce.
    return { safeAddress: safeCtx.safeAddress, signerAddress: safeCtx.safeAddress };
  }
  await loadSdk();
  if (!window.Domovina) throw new Error("wallet_sdk_unavailable");
  const r = await window.Domovina.connect(opts);
  return {
    safeAddress: r.safeAddress as `0x${string}`,
    signerAddress: r.signerAddress as `0x${string}`,
  };
}

/// Forget the cached DOMOVINA wallet connection (host-side). The next
/// connectWallet() will hand off to the wallet again to pick a different one.
export async function disconnectWallet(): Promise<void> {
  if (typeof window !== "undefined") {
    await loadSdk().catch(() => undefined);
    window.Domovina?.disconnect?.();
  }
}

/// Warm the SDK script + Safe-App probe on the connect screen's mount so the
/// first connect()/send() click has them ready. (connect() is now a full-page
/// redirect — no in-page WebAuthn ceremony, so user activation is irrelevant;
/// this is just a cheap pre-warm of the Safe-App `getSafeContext` probe + script.)
export function preloadWallet(): void {
  if (typeof window === "undefined") return;
  void getSafeContext();
  void loadSdk().catch(() => undefined);
}

/// Send EURe to `to`. Inside Safe{Wallet} the transfer is proposed to the host
/// Safe (user confirms there); otherwise it goes through the DOMOVINA wallet
/// (in-iframe confirm + Face ID). `amount` is an EURe decimal string (e.g.
/// "5.00"). Returns the tx hash; pinka verifies+credits it via the
/// pinka-onchain-confirm edge fn.
export async function sendEure(to: string, amount: string): Promise<{ txHash: string }> {
  const safeCtx = await getSafeContext();
  if (safeCtx) return sendEureViaSafe(to, amount);
  await loadSdk();
  if (!window.Domovina) throw new Error("wallet_sdk_unavailable");
  return window.Domovina.send({ to, amount });
}
