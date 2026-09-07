import { NextResponse } from "next/server";
import { z } from "zod";
import { checkLoyaltyKey } from "@/lib/loyalty-api";
import { addPoints, getLoyaltyStatus } from "@/lib/supabase/loyalty";

export const dynamic = "force-dynamic";

/**
 * POST /api/loyalty/earn
 * Header: x-api-key: <LOYALTY_API_KEY>
 * Body:   { "email": "cliente@correo.com", "points": 1, "reason": "compra" }
 *
 * Adds (or subtracts) points for a customer — called by the store when a
 * purchase completes. Returns the updated loyalty status (new tier included).
 * `points` may be negative to redeem; the balance never drops below zero.
 */
const bodySchema = z.object({
  email: z.string().email("Correo invalido"),
  points: z.number().int("points debe ser entero"),
  reason: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  if (!checkLoyaltyKey(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    await addPoints(parsed.data.email, parsed.data.points, parsed.data.reason ?? "purchase");
    const status = await getLoyaltyStatus(parsed.data.email);
    return NextResponse.json({ ok: true, ...status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
