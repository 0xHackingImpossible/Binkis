import { NextResponse } from "next/server";
import { checkLoyaltyKey } from "@/lib/loyalty-api";
import { getLoyaltyStatus } from "@/lib/supabase/loyalty";

export const dynamic = "force-dynamic";

/**
 * GET /api/loyalty/status?email=cliente@correo.com
 * Header: x-api-key: <LOYALTY_API_KEY>
 *
 * Returns the customer's points, tier/level, unlocked benefits and eligibility
 * so the store can apply the corresponding discount / free product.
 */
export async function GET(request: Request) {
  if (!checkLoyaltyKey(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Parametro 'email' requerido" }, { status: 400 });
  }

  try {
    const status = await getLoyaltyStatus(email);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
