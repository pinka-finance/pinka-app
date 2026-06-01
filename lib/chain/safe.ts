import Safe from "@safe-global/protocol-kit";
import {
  createPublicClient,
  http,
  keccak256,
  toBytes,
  type Address,
} from "viem";
import {
  gnosis,
  GNOSIS_RPC,
  SAFE_WEBAUTHN_SIGNER_FACTORY,
  DAIMO_P256_VERIFIER,
  P256_PRECOMPILE_ADDRESS,
} from "./constants";
import type { P256PublicKey } from "./passkey";

// Counterfactual Safe derivation — mirrors pay.domovina.ai/wallet/src/lib/safe.ts
// so addresses match what the relay would later deploy. Per-campaign Safes use a
// unique saltNonce derived from the campaign id → one deterministic Safe per
// campaign, all owned by the same creator passkey signer. Nothing is deployed
// here (0 gas); the Safe is initialized on-chain lazily on first withdrawal.

const publicClient = createPublicClient({ chain: gnosis, transport: http() });

function encodeVerifiers(): bigint {
  return (BigInt(P256_PRECOMPILE_ADDRESS) << 160n) | BigInt(DAIMO_P256_VERIFIER);
}

const FACTORY_ABI = [
  {
    inputs: [
      { name: "x", type: "uint256" },
      { name: "y", type: "uint256" },
      { name: "verifiers", type: "uint176" },
    ],
    name: "getSigner",
    outputs: [{ name: "signer", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/// Counterfactual WebAuthn signer proxy address for a passkey pubkey (view call).
export async function predictSignerAddress(pubKey: P256PublicKey): Promise<Address> {
  return publicClient.readContract({
    address: SAFE_WEBAUTHN_SIGNER_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getSigner",
    args: [pubKey.x, pubKey.y, encodeVerifiers()],
  });
}

/// uint256 saltNonce (as decimal string) deterministically derived from campaign id.
export function saltFromCampaignId(campaignId: string): string {
  return BigInt(keccak256(toBytes(`pinka:campaign:${campaignId}`))).toString();
}

/// Predict the counterfactual Safe 1/1 owned by signerAddress with the given salt.
export async function predictSafeAddress(
  signerAddress: Address,
  saltNonce: string,
): Promise<Address> {
  const kit = await Safe.init({
    provider: GNOSIS_RPC,
    predictedSafe: {
      safeAccountConfig: { owners: [signerAddress], threshold: 1 },
      safeDeploymentConfig: { saltNonce, safeVersion: "1.4.1" },
    },
  });
  return (await kit.getAddress()) as Address;
}

export interface CampaignSafe {
  signerAddress: Address;
  safeAddress: Address;
  saltNonce: string;
}

/// Full per-campaign derivation from a passkey pubkey (local-passkey path).
export async function deriveCampaignSafe(
  pubKey: P256PublicKey,
  campaignId: string,
): Promise<CampaignSafe> {
  const signerAddress = await predictSignerAddress(pubKey);
  return deriveCampaignSafeFromSigner(signerAddress, campaignId);
}

/// Per-campaign derivation from an already-known signer (ecosystem-wallet path
/// via the DOMOVINA Wallet SDK — see lib/chain/walletSdk.ts).
export async function deriveCampaignSafeFromSigner(
  signerAddress: Address,
  campaignId: string,
): Promise<CampaignSafe> {
  const saltNonce = saltFromCampaignId(campaignId);
  const safeAddress = await predictSafeAddress(signerAddress, saltNonce);
  return { signerAddress, safeAddress, saltNonce };
}
