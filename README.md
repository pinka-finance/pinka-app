# pinka.finance — app

Public campaign pages + EPC/SEPA checkout for **pinka.finance**, the onchain
group-funding platform (donations · crowdfunding · soft tokenization · tickets ·
real-estate) built on the Monerium → EURe → Gnosis rail.

This is the **application** (browse → campaign → donate by scanning an EPC QR →
live on-chain confirmation). The marketing site lives in the sibling repo
[`../landing`](../landing).

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

## Status / roadmap

Phase 2 (this repo): public campaign pages + checkout. **Next:** creator
dashboard (auth, campaign CRUD, tiers, payouts) — see plan doc §6.
