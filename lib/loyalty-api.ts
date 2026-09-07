/**
 * Shared auth for the store-facing loyalty API (/api/loyalty/*).
 *
 * The store (Shopify / MIMIC) must send a secret key in the `x-api-key` header
 * that matches the `LOYALTY_API_KEY` env var. Server-to-server only — the key
 * must never be exposed in the browser. Fails closed if the env var is unset.
 */
export function checkLoyaltyKey(request: Request): boolean {
  const expected = process.env.LOYALTY_API_KEY;
  if (!expected) return false; // not configured => deny
  const provided = request.headers.get("x-api-key") ?? "";
  // Length check first so the comparison below doesn't leak length via timing.
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
