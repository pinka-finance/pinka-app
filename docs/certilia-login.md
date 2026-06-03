# Prijava eOsobnom (Certilia) → implicitni KYC/AML

Korisnik se prijavi hrvatskom e-osobnom (Certilia/NIAS eID). Backend ga verificira
protiv Certilia JWKS, sprema **šifrirani OIB** u `public.identity_verifications` i
otvara Supabase sesiju. Kad takav (verificiran) korisnik napravi uplatu, uplata se
**zamrzava kao verificirana** (`contributions.contributor_verified`) i na Zidu podrške
dobiva badge „Verificirano · eOsobna”.

Backend (Certilia edge fn + proxy + KYC tablica) je **dijeljen s domovina.ai** i već je
live — ovdje je samo dodan web-klijent (Next.js) i snapshot za AML trag.

## Arhitektura toka

```
pinka web (browser)
  └─ lib/certilia.ts
       1. GET  certilia.domovina.ai/api/auth/initialize     → authorization_url, session_id, state
       2. POST certilia.domovina.ai/api/auth/polling/start  → polling_id
       3. window.open(authorization_url)  → korisnik se prijavi eOsobnom
       4. poll GET .../polling/:id/status → { code, state }   (COOP → polling, ne postMessage)
       5. POST .../exchange               → { idToken }
  └─ sb.functions.invoke("certilia", { idToken })            (api.domovina.ai, CORS *)
       → verifikacija JWKS, upsert GoTrue usera (kyc_verified),
         OIB šifriran u identity_verifications, vrati email_otp
  └─ sb.auth.verifyOtp({ email, token: email_otp, type: "magiclink" })  → Supabase sesija
```

Uplata: `pinka-contribute` → `create_contribution` rezolvira `auth.uid()` → personal
account (`contributor_account_id`) i provjeri `identity_verifications` → upiše
`contributor_verified` snapshot. `public_contributions` view izlaže samo boolean
`verified` (OIB nikad ne izlazi).

Audit trag (za AML/regulatora): `contribution.contributor_account_id` →
`accounts.primary_owner_user_id` → `identity_verifications` (šifrirani OIB, ime, LoA).

## Deploy koraci

### 1. DB migracija (domovina-api)

Nova migracija: `supabase/migrations/20260603120000_pinka_finance_verified_contributions.sql`
(dodaje kolonu `contributor_verified`, ažurira `create_contribution`, rebuilda
`public_contributions` view). **Edge funkcije se NE diraju.**

```bash
cd /Users/ms/git/domovinatv/domovina-api
./scripts/db-migrate.sh          # primijeni nove migracije preko SSH+psql
# (ili Studio → SQL Editor → paste sadržaj migracije → Run)
```

Provjera:
```sql
select column_name from information_schema.columns
 where table_schema='pinka_finance' and table_name='contributions'
   and column_name='contributor_verified';        -- 1 red
select * from pinka_finance.public_contributions limit 1;   -- mora imati stupac `verified`
```

### 2. Certilia proxy — dopusti pinka origin (jedina env promjena)

certilia-server (`/Users/ms/git/stepanic/flutter_certilia/certilia-server`, zaseban
Coolify container) ima `ALLOWED_ORIGINS`. Dodaj pinka origine i restartaj **samo taj
container** (nije potreban full-stack redeploy):

```
ALLOWED_ORIGINS=https://domovina.ai,https://www.domovina.ai,https://app.pinka.finance,http://localhost:3007
```

```bash
# Coolify UI: certilia-server → Environment → uredi ALLOWED_ORIGINS → Save
# pa restart tog containera, npr.:
ssh <coolify-host> "docker restart <certilia-server-container>"
```

Bez ovoga browser na app.pinka.finance dobiva CORS grešku na `/api/auth/*`.

### 3. pinka frontend (Vercel)

Dodaj env i redeploy:
```
NEXT_PUBLIC_CERTILIA_SERVER_URL=https://certilia.domovina.ai
```

## Provjera (smoke test)

1. Otvori kampanju → contribute panel → „Prijavi se eOsobnom”.
2. Popup → eID prijava → panel pokaže „Verificirano kao {ime} · eOsobna”.
3. Napravi SEPA uplatu; kad sjedne (`paid`), na Zidu podrške se pojavi badge
   „Verificirano · eOsobna”.
4. Header pokazuje verificirani chip + odjavu.

## Napomene

- **Anonimna uplata** (checkbox) i dalje se uopće ne prikazuje na zidu — verified
  badge se odnosi samo na ne-anonimne uplate (ime/nadimak vidljiv). Osoba ostaje
  100% verificirana neovisno o tome prikazuje li puno ime.
- Snapshot se hvata u trenutku kreiranja doprinosa, pa je uplata mora biti napravljena
  **dok je korisnik prijavljen eOsobnom** (prijava prije uplate). Gost/anon uplate
  ostaju neverificirane.
- env varijable na domovina-api strani (`CERTILIA_CLIENT_ID`, `CERTILIA_ISSUER`,
  `KYC_ENCRYPTION_KEY`) već postoje (koristi ih domovina.ai) — ništa novo.
