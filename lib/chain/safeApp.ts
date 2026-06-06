// Safe App bridge — when pinka is loaded *inside* Safe{Wallet} (as a Safe App in
// an iframe), use the host Safe as the account/signer instead of the DOMOVINA
// wallet iframe. Same app, same URL, two runtimes:
//   • pinka.io opened directly        → DOMOVINA wallet  (see walletSdk.ts)
//   • pinka.io inside Safe{Wallet}     → this module
//
// Detection: @safe-global/safe-apps-sdk only answers `safe.getInfo()` when a Safe
// parent responds. A normal top-level visit isn't in an iframe at all, so we
// short-circuit on `window.top === window.self`; when we *are* framed we race
// getInfo() against a short timeout so a non-Safe embed still falls through.
//
// Listing/manifest plan: see funding/SAFE-APP-LISTING.md in bizops-automation-private.

import SafeAppsSDK from "@safe-global/safe-apps-sdk";
import { encodeFunctionData, parseUnits, type Address } from "viem";
import { GNOSIS_CHAIN_ID } from "./constants";

// Monerium EURe V2 proxy on Gnosis — same address contribute-panel.tsx uses.
const EURE_GNOSIS_V2 = "0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430" as const;

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

let sdk: SafeAppsSDK | null = null;
function getSdk(): SafeAppsSDK {
  if (!sdk) sdk = new SafeAppsSDK();
  return sdk;
}

export interface SafeContext {
  safeAddress: Address;
  chainId: number;
}

// Resolve the host Safe if pinka is running inside Safe{Wallet} on Gnosis, else
// null. Cached after the first probe. Off-Gnosis Safes return null so we never
// encode a Gnosis EURe transfer against a Safe on the wrong chain.
let cached: SafeContext | null | undefined;
export async function getSafeContext(timeoutMs = 400): Promise<SafeContext | null> {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined" || window.top === window.self) {
    cached = null; // not framed → standalone visit, no probe needed
    return cached;
  }
  try {
    const info = await Promise.race([
      getSdk().safe.getInfo(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("safe_probe_timeout")), timeoutMs),
      ),
    ]);
    cached =
      info.chainId === GNOSIS_CHAIN_ID
        ? { safeAddress: info.safeAddress as Address, chainId: info.chainId }
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function isInSafeApp(): Promise<boolean> {
  return (await getSafeContext()) !== null;
}

// Propose an EURe transfer to Safe{Wallet} for the user to confirm. Returns the
// safeTxHash (a Safe transaction id, not yet an on-chain hash — pinka's confirm
// edge fn resolves it to the settled transfer, same as the DOMOVINA path).
export async function sendEureViaSafe(
  to: string,
  amount: string,
): Promise<{ txHash: string }> {
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to as Address, parseUnits(amount, 18)],
  });
  const { safeTxHash } = await getSdk().txs.send({
    txs: [{ to: EURE_GNOSIS_V2, value: "0", data }],
  });
  return { txHash: safeTxHash };
}
