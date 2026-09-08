import { NextResponse } from "next/server";
import crypto from "crypto";
import { addPoints, hasTransaction } from "@/lib/supabase/loyalty";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/shopify-order  (Shopify "orders/paid" webhook)
 *
 * Shopify calls this server-to-server when an order is paid — no API key in the
 * browser. We verify Shopify's HMAC signature (X-Shopify-Hmac-Sha256) against
 * SHOPIFY_WEBHOOK_SECRET, then award points for the purchase.
 *
 * Points: 1 per item (sum of line-item quantities). The "colección completa =
 * 13 (8 + 5 bonus)" rule needs the collection product id — pending from MIMIC.
 * Idempotent: each order id is awarded at most once (Shopify retries webhooks).
 */
function verifyHmac(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface ShopifyOrder {
  id?: number | string;
  email?: string;
  customer?: { email?: string };
  line_items?: Array<{ quantity?: number }>;
}

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyHmac(rawBody, request.headers.get("x-shopify-hmac-sha256"), secret)) {
    return NextResponse.json({ error: "Firma invalida" }, { status: 401 });
  }

  let order: ShopifyOrder;
  try {
    order = JSON.parse(rawBody) as ShopifyOrder;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (order.email ?? order.customer?.email ?? "").trim().toLowerCase();
  const orderId = order.id != null ? String(order.id) : "";
  // Always ACK (200) so Shopify doesn't retry indefinitely on non-actionable orders.
  if (!email || !orderId) {
    return NextResponse.json({ ok: true, skipped: "sin email u orden" });
  }

  const reason = `shopify_order:${orderId}`;
  const points = (order.line_items ?? []).reduce((sum, li) => sum + (Number(li.quantity) || 0), 0);
  if (points <= 0) {
    return NextResponse.json({ ok: true, skipped: "sin puntos" });
  }

  try {
    // Idempotency: never award the same order twice on webhook retries.
    if (await hasTransaction(reason)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    await addPoints(email, points, reason);
    return NextResponse.json({ ok: true, email, points });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
