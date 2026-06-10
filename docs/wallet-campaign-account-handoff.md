# Campaign account handoff — wallet-side spec (SDK ≥ 0.10)

**Status:** pinka side SHIPPED (feature-detected, falls back to legacy derive);
wallet side TO BE IMPLEMENTED in `pay.domovina.ai/wallet`.

## Why

Today pinka derives a per-campaign Safe client-side: 1-of-1, owner = the
connected WebAuthn signer, `saltNonce = keccak256("pinka:campaign:{id}")`
(`lib/chain/safe.ts`). That Safe is invisible in the DOMOVINA wallet: it's not
in the wallet's account list, the wallet's Embed/relay refuse to sign for it,
and it has no recovery owner.

Decision (2026-06-10): instead of teaching the wallet to "watch" external
Safes, the **wallet opens the campaign account itself** as a native derived
account (ADR 0013: passkey = identity, Safe = account (many)). The campaign
then behaves like any other wallet account — named after the campaign, listed
in `WalletSwitcherSheet`, balance via Multicall3, activity via getLogs, signing
via the existing derived-account relay path, 1-of-2 with the recovery owner,
cross-device sync via the backend registry. Zero new display/signing concepts.

Existing campaigns keep their legacy 1-of-1 addresses (still controlled by the
passkey signer; recoverable via `/recover`). The new scheme applies to new
campaigns once the wallet ships this.

## Contract

Mirrors the `dw_connect` full-page handoff exactly (same CSRF, same allowlist,
same scrub). Spans the same 4 files: wallet `public/sdk.js`,
`src/routes/Landing.tsx` (+ `src/lib/accounts.ts` reuse), pinka
`lib/chain/walletSdk.ts`, `app/dashboard/new/page.tsx`.

### 1. SDK method (`public/sdk.js`, bump `_version` to `0.10.0`)

```js
Domovina.createAccount({ name })
// → Promise<{ accountAddress, safeAddress, signerAddress, credentialId?, saltNonce? }>
```

Semantics (identical to `connect()`):

1. **Returning** — URL has `dw_return=1&dw_account=…` and a valid single-use
   `dw_state` (sessionStorage CSRF, ≥128-bit): resolve from params, scrub them
   via `replaceState`.
2. **Fresh call** — generate `dw_state`, then full-page redirect to
   `wallet.domovina.ai/?dw_create_account=1&dw_name=<urlencoded>&dw_state=…&dw_return=<hostUrl>`.
   The promise never resolves (page navigates away).

No cached short-circuit: every call opens a NEW account (each campaign gets its
own). `connect()` caching (`domovina_connected_v1`) is unaffected; if the host
isn't connected yet, the wallet handles identity (open/create passkey) as part
of the same visit — the return params double as connect params.

### 2. Wallet side (`src/routes/Landing.tsx`)

On `dw_create_account=1`:

1. Validate `dw_return` against the existing origin allowlist
   (`*.domovina.ai`, `*.pinka.io`, localhost) — same open-redirect guard as
   `dw_connect`.
2. Ensure a passkey session (same open/create flow as `dw_connect`; all the
   onboarding rules — no get-before-create, excludeCredentials — apply
   unchanged).
3. Show a confirm screen: "**pinka.io** traži otvaranje novog računa
   **'{dw_name}'**" with Otvori račun / Odbij. (Account derivation is
   pure-local — no Face ID needed beyond the session; the confirm is consent,
   not a signature.)
4. On confirm, reuse the existing "Novi račun" derivation
   (`src/lib/accounts.ts`): 1-of-2 `[signerAddress, recoveryOwner]`, wallet's
   own saltNonce scheme, `name = dw_name` (trim, cap length, fall back to
   "Kampanja"). Persist to `domovina_accounts_v3` + fire-and-forget
   `POST /api/wallets/{credId}/accounts` (cross-device sync).
5. Redirect back:
   `<dw_return>?dw_return=1&dw_account=<derivedSafe>&dw_safe=<bootstrapSafe>&dw_signer=<signer>&dw_cred=<credId>&dw_salt=<saltNonce>&dw_state=<echo>`.
6. On reject/cancel: `<dw_return>?dw_return=1&dw_error=cancelled&dw_state=<echo>`.

### 3. What pinka already does (shipped, this repo)

- `lib/chain/walletSdk.ts`: `supportsCampaignAccounts()` (feature-detects
  `Domovina.createAccount`, always false inside Safe{Wallet}) and
  `createCampaignAccount(name)`.
- `app/dashboard/new/page.tsx`: in account mode, the form draft is persisted
  to sessionStorage (`pinka.campaign_draft_v1`) before the handoff; on return
  with `dw_account` it creates the campaign with
  `destination_address = dw_account` and
  `metadata.safe.source = "domovina-wallet-account"` (plus
  `salt_nonce = dw_salt` when present). On `dw_error` the draft is restored
  into the form for retry. Until the SDK ships `createAccount`, the wizard
  silently uses the legacy derive path — nothing breaks on deploy order.

## Follow-ups (after wallet ships)

- pinka `app/dashboard/manage`: the "Deriviraj Safe iz passkey-a" repair path
  should offer "Otvori račun u DOMOVINA walletu" (same handoff, with
  `manage?id=` as the return URL) for campaigns still missing a Safe.
- Wallet account row could deep-link back to the campaign manage page
  (optional `dw_meta`/source tag on the registered account).
- sdk.js cache gotcha applies: after deploying 0.10, pinka users may hold the
  old sdk.js for up to the zone TTL (hard-refresh, or add a version query to
  `SDK_SRC` in `lib/chain/walletSdk.ts`).
