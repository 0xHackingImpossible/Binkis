import { NextResponse } from "next/server";
import { getLoyaltyStatus } from "@/lib/supabase/loyalty";

export const dynamic = "force-dynamic";

/**
 * GET /api/loyalty/public-status?email=cliente@correo.com
 *
 * Public, read-only version of /status with NO API key — safe to call from the
 * Shopify theme (client-side). It only returns loyalty data (points, tier,
 * benefits, eligibility) — never PII (no name/phone/address) — and modifies
 * nothing. A rate-limit can be layered on to deter mass enumeration.
 */
export async function GET(request: Request) {
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
