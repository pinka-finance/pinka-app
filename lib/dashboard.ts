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
  recurrence: "none" | "monthly" | "quarterly" | "yearly";
  recurrence_anchor_day: number | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  cover_image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
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

// A recurring supporter (članarina). Recognised — never auto-charged — by
// grouping settled push-SEPA payments on payer_iban_hash per campaign. See
// migration 20260606120000_pinka_finance_subscriptions.sql.
export interface Member {
  id: string;
  display_name: string | null;
  effective_status: "active" | "lapsed" | "cancelled";
  // declared campaign cadence if set, else the observed/inferred one
  effective_cadence: "monthly" | "quarterly" | "yearly" | "irregular" | "unknown";
  declared: boolean;
  interval_days: number | null;
  contribution_count: number;
  total_cents: number;
  last_amount_cents: number | null;
  first_contribution_at: string | null;
  last_contribution_at: string | null;
  next_expected_at: string | null;
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
  recurrence?: "none" | "monthly" | "quarterly" | "yearly";
  recurrenceAnchorDay?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  coverImageUrl?: string | null;
  // "YYYY-MM-DD" date-input vrijednosti (konverzija u timestamptz je ovdje)
  startsAt?: string | null;
  endsAt?: string | null;
  metadata?: Record<string, unknown>;
}

// Server-side greške (RPC raise / RLS / mreža) → stabilni ključevi koje forma
// mapira na i18n poruke (form.serverErrors.*). Nepoznate greške se vraćaju
// netaknute pa forma padne na generični errSaveFailed.
function mapWriteError(error: { code?: string; message?: string } | null): Error {
  const msg = error?.message ?? "";
  if (msg.includes("campaign_rate_limited")) return new Error("server:rateLimited");
  if (msg.includes("campaign_destination_locked")) return new Error("server:destinationLocked");
  if (msg.includes("campaign_destination_missing")) return new Error("server:destinationMissing");
  if (msg.includes("campaign_exists")) return new Error("server:exists");
  if (msg.includes("min_exceeds_goal")) return new Error("form.errMinExceedsGoal");
  if (msg.includes("invalid_")) return new Error("server:invalid");
  if (error?.code === "42501" || msg.includes("row-level security"))
    return new Error("server:kycRequired");
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError"))
    return new Error("server:network");
  return error instanceof Error ? error : new Error(msg || "save_failed");
}

function dateToStartIso(d: string | null | undefined): string | null {
  return d ? new Date(d + "T00:00:00").toISOString() : null;
}
function dateToEndIso(d: string | null | undefined): string | null {
  return d ? new Date(d + "T23:59:59.999").toISOString() : null;
}

const SELECT =
  "id, slug, title, type, state, visibility, goal_cents, currency, " +
  "destination_address, subject_type, subject_ref, description, " +
  "min_contribution_cents, recurrence, recurrence_anchor_day, " +
  "latitude, longitude, location_name, cover_image_url, starts_at, ends_at, " +
  "campaign_stats(total_raised_cents, contributor_count)";

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
    recurrence: (row.recurrence as MyCampaign["recurrence"]) ?? "none",
    recurrence_anchor_day: (row.recurrence_anchor_day as number) ?? null,
    latitude: (row.latitude as number) ?? null,
    longitude: (row.longitude as number) ?? null,
    location_name: (row.location_name as string) ?? null,
    cover_image_url: (row.cover_image_url as string) ?? null,
    starts_at: (row.starts_at as string) ?? null,
    ends_at: (row.ends_at as string) ?? null,
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

// Kreiranje ide kroz create_campaign RPC (server-side validacija + slug +
// idempotencija po client-generated id-u — retry nakon prekida mreže vraća
// postojeću kampanju umjesto 23505). Dok migracija nije primijenjena (PGRST202
// = funkcija ne postoji) pada se na legacy direktni insert.
export async function createCampaign(input: NewCampaignInput): Promise<string> {
  const sb = supabaseBrowser();
  const id = input.id ?? crypto.randomUUID();
  const { data, error } = await sb
    .schema("pinka_finance")
    .rpc("create_campaign", {
      p_id: id,
      p_account_id: input.accountId,
      p_title: input.title,
      p_type: input.type,
      p_description: input.description || null,
      p_goal_cents: input.goalCents,
      p_min_contribution_cents: input.minContributionCents,
      p_destination_address: input.destinationAddress,
      p_subject_type: input.subjectType,
      p_subject_ref: input.subjectRef,
      p_visibility: input.visibility,
      p_recurrence: input.recurrence ?? "none",
      p_recurrence_anchor_day: input.recurrenceAnchorDay ?? null,
      p_latitude: input.latitude ?? null,
      p_longitude: input.longitude ?? null,
      p_location_name: input.locationName ?? null,
      p_cover_image_url: input.coverImageUrl ?? null,
      p_starts_at: dateToStartIso(input.startsAt),
      p_ends_at: dateToEndIso(input.endsAt),
      p_metadata: input.metadata ?? {},
    });
  if (!error) return (data as { id: string }).id;
  if (error.code === "PGRST202") return createCampaignLegacy({ ...input, id });
  throw mapWriteError(error);
}

async function createCampaignLegacy(input: NewCampaignInput): Promise<string> {
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
        recurrence: input.recurrence ?? "none",
        recurrence_anchor_day: input.recurrenceAnchorDay ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        location_name: input.locationName ?? null,
        cover_image_url: input.coverImageUrl ?? null,
        starts_at: dateToStartIso(input.startsAt),
        ends_at: dateToEndIso(input.endsAt),
        state: "draft",
        ...(input.metadata ? { metadata: input.metadata } : {}),
      })
      .select("id")
      .single();
    if (!error && data) return (data as { id: string }).id;
    if ((error as { code?: string } | null)?.code !== "23505") {
      throw mapWriteError(error);
    }
    // 23505 može biti i pkey (insert je prošao, a odgovor se izgubio pa je ovo
    // retry) — ako kampanja s našim id-em postoji, gotovi smo.
    if (input.id) {
      const existing = await getMyCampaign(input.id).catch(() => null);
      if (existing) return existing.id;
    }
    // inače: slug zauzet → retry sa sufiksom
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
    recurrence: "none" | "monthly" | "quarterly" | "yearly";
    recurrence_anchor_day: number | null;
    latitude: number | null;
    longitude: number | null;
    location_name: string | null;
    cover_image_url: string | null;
    starts_at: string | null;
    ends_at: string | null;
    metadata: Record<string, unknown>;
  }>,
): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb
    .schema("pinka_finance")
    .from("campaigns")
    .update(patch)
    .eq("id", id);
  if (error) throw mapWriteError(error);
}

/// "YYYY-MM-DD" | null → timestamptz ISO za update patch (početak/kraj dana).
export const campaignDates = { start: dateToStartIso, end: dateToEndIso };

// Postavi per-campaign Safe na postojeću kampanju: upiše destination_address i
// spoji safe metadata u postojeći metadata (ne kloberira yield itd.). Adresa se
// derivira client-side iz passkey signera (vidi lib/chain/safe.ts) — jedini dio
// koji mora ostati u browseru (passkey ↔ Google/Apple).
export async function setCampaignSafe(
  id: string,
  destinationAddress: string,
  safeMeta: Record<string, unknown>,
): Promise<void> {
  const sb = supabaseBrowser();
  const { data: cur } = await sb
    .schema("pinka_finance")
    .from("campaigns")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();
  const existing = (cur?.metadata as Record<string, unknown> | null) ?? {};
  const { error } = await sb
    .schema("pinka_finance")
    .from("campaigns")
    .update({
      destination_address: destinationAddress,
      metadata: { ...existing, safe: safeMeta },
    })
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

// Recurring supporters for a campaign. Reads the subscriptions_view (adds the
// live effective_status); RLS lets only the campaign admin see the full list.
// Ordered by recurring members first (most contributions), then recent activity.
export async function listMembers(campaignId: string): Promise<Member[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .schema("pinka_finance")
    .from("subscriptions_view")
    .select(
      "id, display_name, effective_status, effective_cadence, declared, interval_days, " +
        "contribution_count, total_cents, last_amount_cents, " +
        "first_contribution_at, last_contribution_at, next_expected_at",
    )
    .eq("campaign_id", campaignId)
    .gte("contribution_count", 2) // recurring = paid ≥ 2×; one-timers aren't members yet
    .order("contribution_count", { ascending: false })
    .order("last_contribution_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Member[];
}

// Mark a subscription cancelled (sticky). A later payment auto-reactivates it.
// Server RPC authorises campaign admin or the subscriber themselves.
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb
    .schema("pinka_finance")
    .rpc("cancel_subscription", { p_subscription_id: subscriptionId });
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
