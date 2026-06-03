"use client";

// Certilia / NIAS eID web login — port of the domovina.ai Flutter web flow
// (flutter_certilia/certilia_web_client.dart) to the browser.
//
// Architecture (identical to domovina.ai): the client never speaks to Certilia
// directly. A shared OIDC proxy at certilia.domovina.ai holds the OAuth secrets
// and runs the authorization_code + PKCE handshake. We:
//   1. GET  /api/auth/initialize         → { authorization_url, session_id, state }
//   2. POST /api/auth/polling/start      → { polling_id }
//   3. window.open(authorization_url)    → user signs in with their eID
//   4. poll GET /api/auth/polling/:id/status until { code, state }
//   5. POST /api/auth/exchange           → { idToken, user }
// Then we bridge the Certilia idToken into a Supabase session via the SAME
// backend domovina.ai uses: the `certilia` edge fn verifies the token against
// Certilia JWKS, upserts a GoTrue user (kyc_verified), stores the encrypted OIB
// in identity_verifications, and returns an email_otp we redeem with verifyOtp.
//
// Why polling (not postMessage): under Cross-Origin-Opener-Policy the browser
// severs window.opener for the cross-origin Certilia popup, so the opener can't
// receive a postMessage reliably. The proxy's polling session is the source of
// truth — see certilia_web_client.dart for the original rationale.

import { supabaseBrowser } from "@/lib/supabase";

const PROXY =
  process.env.NEXT_PUBLIC_CERTILIA_SERVER_URL ?? "https://certilia.domovina.ai";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min, mirrors the Flutter web client

export class CertiliaError extends Error {}

interface InitResponse {
  authorization_url: string;
  session_id: string;
  state: string;
}
interface PollStartResponse {
  polling_id: string;
}
interface PollStatusResponse {
  status: "pending" | "completed" | "expired" | string;
  result?: { code: string; state: string };
}
interface ExchangeResponse {
  idToken?: string;
  error?: string;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new CertiliaError(`certilia proxy ${res.status} @ ${url}`);
  }
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Run the full OIDC handshake on the proxy and return the Certilia idToken.
async function runProxyOidc(): Promise<string> {
  const redirectUri = `${PROXY}/api/auth/callback`;

  const init = await getJson<InitResponse>(
    `${PROXY}/api/auth/initialize?response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}`,
  );

  const poll = await getJson<PollStartResponse>(
    `${PROXY}/api/auth/polling/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: init.state, session_id: init.session_id }),
    },
  );

  // Open the popup synchronously-ish; if the browser blocked it, bail clearly.
  const w = 500;
  const h = 700;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  const popup = window.open(
    init.authorization_url,
    "certilia_auth",
    `width=${w},height=${h},left=${left},top=${top}`,
  );
  if (!popup) {
    throw new CertiliaError("popup_blocked");
  }

  try {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let closedTicks = 0;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const status = await getJson<PollStatusResponse>(
        `${PROXY}/api/auth/polling/${poll.polling_id}/status`,
      );
      if (status.status === "completed" && status.result?.code) {
        const ex = await getJson<ExchangeResponse>(`${PROXY}/api/auth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: status.result.code,
            state: status.result.state,
            session_id: init.session_id,
          }),
        });
        if (ex.error) throw new CertiliaError(ex.error);
        if (!ex.idToken) throw new CertiliaError("no_id_token");
        return ex.idToken;
      }
      if (status.status === "expired") {
        throw new CertiliaError("session_expired");
      }
      // Best-effort cancel detection: popup.closed can read true spuriously
      // under COOP, so only bail after it stays closed across two ticks while
      // the polling session is still pending.
      if (popup.closed) {
        closedTicks += 1;
        if (closedTicks >= 2) throw new CertiliaError("cancelled");
      } else {
        closedTicks = 0;
      }
    }
    throw new CertiliaError("timeout");
  } finally {
    if (!popup.closed) popup.close();
  }
}

// Full sign-in: eID handshake → certilia edge fn → Supabase session.
// On success the browser session becomes the permanent (kyc_verified) user and
// supabaseBrowser().auth.onAuthStateChange fires (AuthProvider picks it up).
export async function signInWithCertilia(): Promise<void> {
  const idToken = await runProxyOidc();

  const sb = supabaseBrowser();
  // Echo any current anonymous id so the backend can associate it if needed
  // (domovina.ai migrates anon data; pinka has none, but we keep the contract).
  const { data: cur } = await sb.auth.getUser();
  const anonId = cur.user?.is_anonymous ? cur.user.id : null;

  const { data, error } = await sb.functions.invoke("certilia", {
    body: { idToken, anonId },
  });
  if (error) throw new CertiliaError(error.message);
  const res = data as { email_otp?: string; email?: string; error?: string };
  if (res.error) throw new CertiliaError(res.error);
  if (!res.email_otp || !res.email) {
    throw new CertiliaError("backend_no_otp");
  }

  // Same session-bridge as the Flutter client: redeem the magic-link OTP.
  const { error: vErr } = await sb.auth.verifyOtp({
    email: res.email,
    token: res.email_otp,
    type: "magiclink",
  });
  if (vErr) throw new CertiliaError(vErr.message);
}
