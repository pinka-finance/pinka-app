import { supabaseBrowser } from "@/lib/supabase";
import { slugify } from "@/lib/format";
import type { CampaignType } from "@/lib/pinka";

// Client-side mutacije/upiti za creator dashboard. RLS gating:
//   campaigns / campaign_tiers — vlasnik (has_role_on_account admin) smije pisati
//   contributions / payouts     — vlasnik smije čitati (write ide kroz rail/RPC)

export interface MyCampaign {
  id: string;
  slug: string;
  title: string;
  type: CampaignType;
  state: string;
  visibility: string;
  goal_cents: number | null;
  currency: string;
  destination_address: string;
  subject_type: string;
  subject_ref: string | null;
  description: string | null;
  min_contribution_cents: number;
  total_raised_cents: number;
  contributor_count: number;
}

export interface Tier {
  id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  kind: string;
  price_cents: number;
  inventory_total: number | null;
  inventory_claimed: number;
}

export interface DashContribution {
  id: string;
  amount_cents: number;
  amount_received_cents: number | null;
  state: string;
  display_name: string | null;
  message: string | null;
  message_hidden: boolean;
  created_at: string;
  paid_at: string | null;
}

export interface Payout {
  id: string;
  amount_cents: number;
  destination: string;
  state: string;
  tx_hash: string | null;
  created_at: string;
}

export interface NewCampaignInput {
  id?: string; // client-generated so the per-campaign Safe salt matches
  accountId: string;
  title: string;
  type: CampaignType;
  description: string;
  goalCents: number | null;
  minContributionCents: number;
  destinationAddress: string;
  subjectType: string;
  subjectRef: string | null;
  visibility: "private" | "unlisted" | "public";
  metadata?: Record<string, unknown>;
}

const SELECT =
  "id, slug, title, type, state, visibility, goal_cents, currency, " +
  "destination_address, subject_type, subject_ref, description, " +
  "min_contribution_cents, campaign_stats(total_raised_cents, contributor_count)";

function normalize(row: Record<string, unknown>): MyCampaign {
  const s = (row.campaign_stats ?? {}) as Record<string, number> | null;
  const stats = (Array.isArray(s) ? s[0] : s) ?? {};
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    type: row.type as CampaignType,
    state: row.state as string,
    visibility: row.visibility as string,
    goal_cents: (row.goal_cents as number) ?? null,
    currency: (row.currency as string) ?? "eur",
    destination_address: (row.destination_address as string) ?? "",
    subject_type: (row.subject_type as string) ?? "generic",
    subject_ref: (row.subject_ref as string) ?? null,
    description: (row.description as string) ?? null,
    min_contribution_cents: (row.min_contribution_cents as number) ?? 100,
    total_raised_cents: (stats as Record<string, number>).total_raised_cents ?? 0,
    contributor_count: (stats as Record<string, number>).contributor_count ?? 0,
  };
}

export async function getMyAccountId(): Promise<string | null> {
  const sb = supabaseBrowser();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data } = await sb
    .from("accounts")
    .select("id")
    .eq("primary_owner_user_id", u.user.id)
    .eq("is_personal_account", true)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

export async function listMyCampaigns(accountId: string): Promise<MyCampaign[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("campaigns")
    .select(SELECT)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as unknown as Record<string, unknown>));
}

export async function getMyCampaign(id: string): Promise<MyCampaign | null> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("campaigns")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data as unknown as Record<string, unknown>) : null;
}

export async function createCampaign(input: NewCampaignInput): Promise<string> {
  const sb = supabaseBrowser();
  const base = slugify(input.title) || "kampanja";
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`.slice(0, 62);
    const { data, error } = await sb
      .schema("pinka_finance")
      .from("campaigns")
      .insert({
        ...(input.id ? { id: input.id } : {}),
        account_id: input.accountId,
        slug,
        type: input.type,
        title: input.title,
        description: input.description || null,
        goal_cents: input.goalCents,
        min_contribution_cents: input.minContributionCents,
        destination_address: input.destinationAddress,
        subject_type: input.subjectType,
        subject_ref: input.subjectRef,
        visibility: input.visibility,
        state: "draft",
        ...(input.metadata ? { metadata: input.metadata } : {}),
      })
      .select("id")
      .single();
    if (!error && data) return (data as { id: string }).id;
    // 23505 = unique_violation (slug taken) → retry with suffix
    if ((error as { code?: string } | null)?.code !== "23505") {
      throw error;
    }
  }
  throw new Error("slug_collision");
}

export async function updateCampaign(
  id: string,
  patch: Partial<{
    title: string;
    type: CampaignType;
    description: string | null;
    goal_cents: number | null;
    min_contribution_cents: number;
    destination_address: string;
    subject_type: string;
    subject_ref: string | null;
    visibility: string;
    state: string;
    cover_image_url: string | null;
  }>,
): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb
    .schema("pinka_finance")
    .from("campaigns")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function listTiers(campaignId: string): Promise<Tier[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("campaign_tiers")
    .select("id, campaign_id, title, description, kind, price_cents, inventory_total, inventory_claimed")
    .eq("campaign_id", campaignId)
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tier[];
}

export async function createTier(
  campaignId: string,
  t: { title: string; description: string; kind: string; priceCents: number; inventoryTotal: number | null },
): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb
    .schema("pinka_finance")
    .from("campaign_tiers")
    .insert({
      campaign_id: campaignId,
      title: t.title,
      description: t.description || null,
      kind: t.kind,
      price_cents: t.priceCents,
      inventory_total: t.inventoryTotal,
    });
  if (error) throw error;
}

export async function deleteTier(id: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb
    .schema("pinka_finance")
    .from("campaign_tiers")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listContributions(campaignId: string): Promise<DashContribution[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("contributions")
    .select("id, amount_cents, amount_received_cents, state, display_name, message, message_hidden, created_at, paid_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as DashContribution[];
}

/// Owner moderation: hide/unhide a contribution's message + link preview on the
/// public wall. Gated server-side (set_contribution_message_hidden checks the
/// caller owns the campaign).
export async function setContributionHidden(contributionId: string, hidden: boolean): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb
    .schema("pinka_finance")
    .rpc("set_contribution_message_hidden", {
      p_contribution_id: contributionId,
      p_hidden: hidden,
    });
  if (error) throw error;
}

export async function listPayouts(campaignId: string): Promise<Payout[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("payouts")
    .select("id, amount_cents, destination, state, tx_hash, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Payout[];
}
