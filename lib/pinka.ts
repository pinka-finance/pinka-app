import { supabaseBrowser } from "./supabase";
import { ZERO_ADDRESS, isSafeSet } from "./chain/constants";

// Tipovi + upiti nad schemom pinka_finance. Vidi:
//   domovina-api/docs/pinka-finance-platform-plan.md (§3 ER model)

export type CampaignType =
  | "donation"
  | "crowdfund"
  | "tokenization"
  | "tickets"
  | "realestate";

export interface CampaignStats {
  total_raised_cents: number;
  contribution_count: number;
  contributor_count: number;
}

export interface Campaign {
  id: string;
  slug: string;
  type: CampaignType;
  title: string;
  description: string | null;
  subject_type: string;
  subject_ref: string | null;
  goal_cents: number | null;
  min_contribution_cents: number;
  currency: string;
  cover_image_url: string | null;
  state: string;
  destination_address: string | null; // campaign's on-chain Safe (public, verifiable)
  chain: string;
  // optional physical location → marker on karta (gis.domovina.ai)
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  stats: CampaignStats;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export interface PublicContribution {
  id: string;
  display_name: string | null;
  message: string | null;
  link_preview: LinkPreview | null;
  amount_cents: number;
  created_at: string;
  // true → contributor was Certilia/eID verified at payment time (implicit KYC).
  verified: boolean;
  // true → paid via SEPA by a named bank sender (bank-verified).
  bank_verified: boolean;
  // true → SEPA sender name matches the contributor's Certilia/eID name
  // (independent double verification).
  identity_double_verified: boolean;
}

const CAMPAIGN_SELECT =
  "id, slug, type, title, description, subject_type, subject_ref, " +
  "goal_cents, min_contribution_cents, currency, cover_image_url, state, " +
  "destination_address, chain, latitude, longitude, location_name, " +
  "campaign_stats(total_raised_cents, contribution_count, contributor_count)";

function normalize(row: Record<string, unknown>): Campaign {
  const s = (row.campaign_stats ?? {}) as Partial<CampaignStats> | null;
  const stats = (Array.isArray(s) ? s[0] : s) ?? {};
  return {
    id: row.id as string,
    slug: (row.slug as string) ?? "",
    type: (row.type as CampaignType) ?? "donation",
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? null,
    subject_type: (row.subject_type as string) ?? "generic",
    subject_ref: (row.subject_ref as string) ?? null,
    goal_cents: (row.goal_cents as number) ?? null,
    min_contribution_cents: (row.min_contribution_cents as number) ?? 100,
    currency: (row.currency as string) ?? "eur",
    cover_image_url: (row.cover_image_url as string) ?? null,
    state: (row.state as string) ?? "active",
    destination_address: (row.destination_address as string) ?? null,
    chain: (row.chain as string) ?? "gnosis",
    latitude: (row.latitude as number) ?? null,
    longitude: (row.longitude as number) ?? null,
    location_name: (row.location_name as string) ?? null,
    stats: {
      total_raised_cents: (stats as CampaignStats).total_raised_cents ?? 0,
      contribution_count: (stats as CampaignStats).contribution_count ?? 0,
      contributor_count: (stats as CampaignStats).contributor_count ?? 0,
    },
  };
}

export async function listPublicCampaigns(): Promise<Campaign[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("visibility", "public")
    .in("state", ["active", "funded"])
    // Ne izlistavaj kampanje bez deriviranog Safe-a (placeholder nulta adresa) —
    // donacije bi išle na praznu adresu. Server-side filter + client-side fallback.
    .neq("destination_address", ZERO_ADDRESS)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) {
    console.error("[pinka] listPublicCampaigns", error.message);
    return [];
  }
  return (data ?? [])
    .map((r) => normalize(r as unknown as Record<string, unknown>))
    .filter((c) => isSafeSet(c.destination_address));
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[pinka] getCampaignBySlug", error.message);
    return null;
  }
  if (!data) return null;
  return normalize(data as unknown as Record<string, unknown>);
}

export async function listCampaignContributions(
  campaignId: string,
): Promise<PublicContribution[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("public_contributions")
    .select("id, display_name, message, link_preview, amount_cents, created_at, verified, bank_verified, identity_double_verified")
    .eq("campaign_id", campaignId)
    .order("amount_cents", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[pinka] listCampaignContributions", error.message);
    return [];
  }
  return (data ?? []) as PublicContribution[];
}

export interface OnchainConfirm {
  mined: boolean;
  credited: number;
  reverted?: boolean;
}

/// Verify + credit an in-app DOMOVINA-wallet on-chain donation by its tx hash.
/// Returns mined=false while the tx is still pending (caller polls).
export async function confirmOnchain(
  campaignId: string,
  txHash: string,
): Promise<OnchainConfirm> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.functions.invoke("pinka-onchain-confirm", {
    body: { campaign_id: campaignId, tx_hash: txHash },
  });
  if (error) throw error;
  return data as OnchainConfirm;
}
