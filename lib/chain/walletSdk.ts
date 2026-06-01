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

const SDK_SRC =
  process.env.NEXT_PUBLIC_WALLET_SDK_URL ?? "https://wallet.domovina.ai/sdk.js";

interface DomovinaSdk {
  connect(): Promise<{ safeAddress: string; signerAddress: string; balance?: string }>;
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

/// Connect the DOMOVINA ecosystem wallet (Face ID inside the wallet iframe).
export async function connectWallet(): Promise<EcosystemWallet> {
  await loadSdk();
  if (!window.Domovina) throw new Error("wallet_sdk_unavailable");
  const r = await window.Domovina.connect();
  return {
    safeAddress: r.safeAddress as `0x${string}`,
    signerAddress: r.signerAddress as `0x${string}`,
  };
}
