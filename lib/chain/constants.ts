import { defineChain } from "viem";

// Gnosis chain + Safe/WebAuthn contract addresses. Mirrors
// pay.domovina.ai/wallet/src/lib/constants.ts so derived Safe addresses are
// identical across the stack. See memory: reference_safe_passkey_gnosis.

export const GNOSIS_CHAIN_ID = 100;

// Nulta adresa = placeholder za kampanju kojoj per-campaign Safe još nije
// derivran. Kampanja s ovakvim destination_address NE smije biti aktivna/javna
// (donacije bi se spalile), niti se smije pojaviti u javnom listanju.
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** true ako je destination_address stvarni Safe (nije null/prazno/nulta adresa). */
export function isSafeSet(addr: string | null | undefined): boolean {
  return !!addr && addr.toLowerCase() !== ZERO_ADDRESS;
}

export const GNOSIS_RPC =
  process.env.NEXT_PUBLIC_GNOSIS_RPC ?? "https://rpc.gnosischain.com";

export const gnosis = defineChain({
  id: GNOSIS_CHAIN_ID,
  name: "Gnosis",
  nativeCurrency: { name: "xDAI", symbol: "xDAI", decimals: 18 },
  rpcUrls: { default: { http: [GNOSIS_RPC] } },
  blockExplorers: {
    default: { name: "Gnosisscan", url: "https://gnosisscan.io" },
  },
});

export const SAFE_WEBAUTHN_SIGNER_FACTORY =
  "0x1d31F259eE307358a26dFb23EB365939E8641195" as const;
export const DAIMO_P256_VERIFIER =
  "0xc2b78104907F722DABAc4C69f826a522B2754De4" as const;
export const P256_PRECOMPILE_ADDRESS =
  "0x0000000000000000000000000000000000000100" as const;

// WebAuthn Relying Party. On localhost → "localhost" (secure context); in prod
// → the app hostname. pinka.finance is a different eTLD+1 from domovina.ai, so
// these passkeys are pinka-scoped (no cross-domain sharing with the wallet).
export function rpId(): string {
  if (typeof window === "undefined") return "app.pinka.finance";
  return window.location.hostname;
}
export const RP_NAME = "pinka.finance";
