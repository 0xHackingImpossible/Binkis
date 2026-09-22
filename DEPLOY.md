# Binkis backend — Deploy & get the URL (runbook)

Goal: publish this Next.js backend to **Vercel** and hand MIMIC one **base URL**.
Everything is already coded and on GitHub; this is the only remaining step.

> Note: `binkis.xyz` now serves the **Shopify store**, so the API needs its **own**
> Vercel domain (e.g. `https://binkis-api.vercel.app`). MIMIC points the theme at it.

Anyone with a Vercel account + the Supabase keys can finish this in ~10 min.

---

## 0) Prerequisites (the only things you must have)
- A **Vercel account** (free is fine).
- The **Supabase credentials** (Supabase Dashboard → Project Settings → API):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- The Supabase database already has the schema applied (`supabase/schema.sql`). If a
  fresh DB: run that file once in Supabase → SQL Editor.

---

## Option A — Vercel Dashboard (easiest, web UI)
1. Go to vercel.com → **Add New → Project → Import Git Repository** →
   `justbeingkids/Binkis` (or fork/transfer to the Binkis account first).
2. Framework preset: **Next.js** (auto-detected). No build config needed.
3. **Environment Variables** → add the ones in the table below → **Deploy**.
4. Vercel prints the production URL, e.g. `https://binkis-api.vercel.app`. **That is the base URL.**
5. Set `NEXT_PUBLIC_BASE_URL` to that URL and **Redeploy** once.

## Option B — Vercel CLI (from this repo folder)
```bash
npx vercel login            # interactive (browser)
npx vercel --prod           # deploys; prints the URL
# add env vars (or do it in the dashboard), then redeploy:
npx vercel env add NEXT_PUBLIC_SUPABASE_URL      production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY     production
npx vercel env add NEXT_PUBLIC_BASE_URL          production   # = URL from step above
npx vercel env add LOYALTY_API_KEY               production   # any strong random string
npx vercel --prod
```

---

## Environment variables
| Variable | Required? | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ yes | from Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ yes | from Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ yes | from Supabase → Settings → API (secret) |
| `NEXT_PUBLIC_BASE_URL` | recommended | the Vercel URL of this deploy |
| `LOYALTY_API_KEY` | for keyed `/status` `/earn` only | any strong random string |
| `SHOPIFY_WEBHOOK_SECRET` | for the purchase webhook | Shopify webhook signing secret (MIMIC sends it) |
| `SESSION_SECRET` | optional | ≥16 chars; falls back to service-role key if unset |
| `NEXT_PUBLIC_BRAND_NAME` | optional | defaults to `BinKis` |
| `NEXT_PUBLIC_COLLECTION_NUMBER` | optional | defaults to `777` |

The public endpoints (below) work with just the 3 Supabase vars. `SHOPIFY_WEBHOOK_SECRET`
is only needed for the purchase webhook and can be added later without redeploying code.

---

## The URL to give MIMIC (once deployed, base = your Vercel URL)
- Loyalty dashboard / tier badge (no key): `GET  <BASE>/api/loyalty/public-status?email=cliente@correo.com`
- Hologram scan (no key): `GET  <BASE>/api/codes/validate?code=BNK-XXXX-XXXX`
- Purchase points (Shopify webhook): `POST <BASE>/api/webhooks/shopify-order`

`public-status` response shape:
```json
{
  "email": "cliente@correo.com",
  "points": 30,
  "tier": { "key": "elite", "name": "Elite Collector" },
  "unlockedBenefits": [ { "key": "collector", "name": "Collector", "points": 20, "benefit": "..." } ],
  "eligibility": { "collector": true, "elite": true, "founder": false },
  "next": { "key": "founder", "name": "Founder Reserve", "points": 40 },
  "pointsToNext": 10
}
```

## Shopify webhook (for earning points on purchase)
In Shopify → Settings → Notifications → Webhooks: create an **`orders/paid`** webhook
pointing to `POST <BASE>/api/webhooks/shopify-order`. Shopify shows a **signing secret** →
put it in `SHOPIFY_WEBHOOK_SECRET`. The endpoint verifies the HMAC and awards 1 point per
item (idempotent). The "complete collection = 13" bonus needs the collection product id/SKU.

## Quick test after deploy
```bash
curl "<BASE>/api/loyalty/public-status?email=test@example.com"   # -> JSON with points:0
curl "<BASE>/api/codes/validate?code=BNK-AAAA-AAAA"              # -> {"state":"invalid",...}
```
If those return JSON, the URL is live and ready for MIMIC.
