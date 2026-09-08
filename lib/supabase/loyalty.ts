import { getAdminClient } from "./client";
import { TIERS, tierForPoints } from "@/lib/loyalty-tiers";

/** Add (or subtract) points for a customer; returns the new balance. */
export async function addPoints(email: string, delta: number, reason: string): Promise<number> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("add_loyalty_points", {
    p_email: email,
    p_delta: Math.trunc(delta),
    p_reason: reason,
  });
  if (error) throw new Error(`add_loyalty_points failed: ${error.message}`);
  return Number(data ?? 0);
}

export async function getBalance(email: string): Promise<number> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select("points")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`getBalance failed: ${error.message}`);
  return data ? Number((data as { points: number }).points) : 0;
}

/**
 * Whether a loyalty transaction with this exact reason already exists. Used to
 * make the Shopify webhook idempotent (Shopify retries deliveries, so we must
 * not award the same order twice). Pass a unique reason like "shopify_order:123".
 */
export async function hasTransaction(reason: string): Promise<boolean> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("id")
    .eq("reason", reason)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`hasTransaction failed: ${error.message}`);
  return !!data;
}

export interface LoyaltyStatus {
  email: string;
  points: number;
  tier: { key: string; name: string } | null;
  unlockedBenefits: { key: string; name: string; points: number; benefit: string }[];
  eligibility: Record<string, boolean>;
  next: { key: string; name: string; points: number } | null;
  pointsToNext: number | null;
}

/**
 * Full loyalty status for one customer email — the contract the store (Shopify)
 * reads to apply benefits: balance, tier/level, unlocked benefits, eligibility.
 */
export async function getLoyaltyStatus(email: string): Promise<LoyaltyStatus> {
  const clean = email.trim().toLowerCase();
  const points = await getBalance(clean);
  const s = tierForPoints(points);
  return {
    email: clean,
    points,
    tier: s.current ? { key: s.current.key, name: s.current.name } : null,
    unlockedBenefits: s.unlocked.map((t) => ({
      key: t.key,
      name: t.name,
      points: t.points,
      benefit: t.benefit,
    })),
    eligibility: Object.fromEntries(TIERS.map((t) => [t.key, points >= t.points])),
    next: s.next ? { key: s.next.key, name: s.next.name, points: s.next.points } : null,
    pointsToNext: s.pointsToNext,
  };
}

export interface LoyaltyAccountRow {
  email: string;
  points: number;
  updatedAt: string;
}

/** Every loyalty account (highest balance first), paginated past the 1k cap. */
export async function getLoyaltyAccounts(): Promise<LoyaltyAccountRow[]> {
  const supabase = getAdminClient();
  const pageSize = 1000;
  const rows: LoyaltyAccountRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("loyalty_accounts")
      .select("email,points,updated_at")
      .order("points", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`getLoyaltyAccounts failed: ${error.message}`);
    const batch = (data ?? []) as Array<{ email: string; points: number; updated_at: string }>;
    rows.push(
      ...batch.map((r) => ({ email: r.email, points: Number(r.points), updatedAt: r.updated_at }))
    );
    if (batch.length < pageSize) break;
  }
  return rows;
}
