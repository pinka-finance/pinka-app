# pinka — app

Public campaign pages + EPC/SEPA checkout for **pinka**, the onchain
group-funding platform (donations · crowdfunding · soft tokenization · tickets ·
real-estate) built on the Monerium → EURe → Gnosis rail.

This is the **application** (browse → campaign → donate by scanning an EPC QR →
live on-chain confirmation). The marketing site lives in the sibling repo
[`../landing`](../landing).

> **Deploy domains.** This app currently deploys to **https://pinka.io** (apex).
> The marketing landing (`../landing`) is on **pinka.finance**. `app.pinka.finance`
> is a possible future alias for this app and is **not live yet**. The production
> domain is set via `NEXT_PUBLIC_SITE_URL` at build time (see `app/layout.tsx`).

## Where things live (cross-repo)

| Concern | Repo / path |
|---|---|
| **Platform plan + DB model (SSOT)** | `domovina-api/docs/pinka-finance-platform-plan.md` (Mermaid ER) |
| **Domain schema** `pinka_finance.*` | `domovina-api/supabase/migrations/20260530120100..300_pinka_finance_*` |
| **Edge functions** | `domovina-api/supabase/functions/pinka-contribute`, `pinka-webhook` |
| **Payment rail** (intents, Monerium, Safe routing, outbound webhook) | `pay.domovina.ai/backend` |
| **On-chain contracts** (Foundry) | `../pinka-finance-mvp` |
| **Marketing site + brand source** | `../landing` |

Brand tokens (`tailwind.config.ts`, fonts, `components/ui/button.tsx`,
`components/logo.tsx`, `globals.css`) mirror `../landing` — keep them in sync.

## Architecture

```
Browser (this app)
  │  anon Supabase session
  ▼
domovina-api edge fn  pinka-contribute
  │  create_contribution → pay-worker /api/intents → attach_intent
  ▼  returns sid + epc_qr_data
Browser renders EPC QR → user pays SEPA
  ▼
Monerium mints EURe → pay-worker forwards to campaign Safe
  ▼  outbound webhook → pinka-webhook → mark_contribution_paid
Browser polls pinka_finance.contributions → flips to "paid"
```

The app never holds secrets and never talks to the rail directly — the edge
function owns intent creation so the `contribution ↔ sid` link is trusted.
All reads are RLS-gated via the public anon key.

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind · `@supabase/supabase-js`
· `qrcode.react`. No own database — all data is the `pinka_finance` schema in
domovina-api.

## Develop

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Requires the `pinka_finance` migrations applied and the edge functions deployed
in domovina-api. A campaign only appears once a `pinka_finance.campaigns` row
exists with `state='active'`, `visibility='public'`.

## Routes

- `/` — public campaign directory
- `/c/[slug]` — campaign detail + contribute (EPC QR + live polling)
- `/dashboard` — creator: magic-link sign-in + my campaigns
- `/dashboard/new` — create campaign (draft)
- `/dashboard/c/[id]` — manage: edit · activate/pause/close · tiers · contributions · payouts

## Safe App (Safe{Wallet})

pinka doubles as a **Safe App**: the same deployment, loaded inside Safe{Wallet}'s
iframe, lets a user act from their **host Safe** instead of the DOMOVINA wallet.

- `public/manifest.json` (+ `public/_headers` CORS) makes the app discoverable as a
  Safe App; the icon is `public/pinka-icon.svg`.
- `lib/chain/safeApp.ts` detects the Safe context (`@safe-global/safe-apps-sdk`,
  Gnosis-only) and proposes EURe transfers to Safe{Wallet}.
- `lib/chain/walletSdk.ts` transparently routes `connectWallet`/`sendEure` through
  the host Safe when framed, and falls back to the DOMOVINA wallet otherwise — no
  changes needed in the campaign/contribute UI.

**Try it without a directory listing** (Safe paused new listings in 2026-06):
Safe{Wallet} → Apps → *Add custom Safe App* → paste `https://pinka.io`. The name +
icon resolve from the manifest. See `funding/SAFE-APP-LISTING.md` in the private
`bizops-automation` repo for the listing plan + verification checklist.

## Status / roadmap

Phase 2 (this repo): public campaign pages + checkout **and** creator dashboard
(email magic-link auth, campaign CRUD, reward/ticket tiers, read-only
contributions + payouts). **Next:** per-campaign Safe factory at create time
(currently the creator pastes a Gnosis destination); payout-request flow via RPC;
on-chain soft-token attestation surfacing. See plan doc §6.
