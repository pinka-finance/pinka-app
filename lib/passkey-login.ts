"use client";

// Passkey (WebAuthn) prijava — isti backend kao domovina.ai: edge fn `passkey`
// (domovina-api) vodi SimpleWebAuthn ceremoniju (register|login start/finish),
// a sesija se uspostavlja istim email_otp → verifyOtp(magiclink) mostom kao i
// Certilia (vidi lib/certilia.ts). RP ID je pinka.io → passkeyi su odvojeni od
// domovina.ai credentiala (WebAuthn ih veže za domenu), ali računi su isti
// (zajednički GoTrue na api.domovina.ai).

import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { supabaseBrowser } from "@/lib/supabase";

export class PasskeyError extends Error {
  /// true = na uređaju nema upotrebljivog passkeya / korisnik je odustao →
  /// UI nudi drugu metodu umjesto generične greške.
  constructor(
    message: string,
    readonly noCredential = false,
  ) {
    super(message);
  }
}

interface StartResponse {
  options:
    | PublicKeyCredentialCreationOptionsJSON
    | PublicKeyCredentialRequestOptionsJSON;
  rpId: string;
}

interface FinishResponse {
  email_otp?: string;
  email?: string;
  error?: string;
}

async function invokeFn<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.functions.invoke(path, { body });
  if (error) {
    // FunctionsHttpError nosi Response u .context — backend šalje { error }.
    let detail = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        detail = ((await ctx.json()) as { error?: string }).error ?? detail;
      } catch {
        /* ne-JSON body — zadrži generičku poruku */
      }
    }
    throw new PasskeyError(detail, detail === "unknown_credential");
  }
  const res = data as T & { error?: string };
  if (res?.error) throw new PasskeyError(res.error);
  return res;
}

// Uspostavi Supabase sesiju iz email_otp-a kojeg minta backend (isti most kao
// certilia edge fn — vidi mintSession u passkey/index.ts).
async function redeemOtp(res: FinishResponse): Promise<void> {
  if (!res.email_otp || !res.email) throw new PasskeyError("backend_no_otp");
  const { error } = await supabaseBrowser().auth.verifyOtp({
    email: res.email,
    token: res.email_otp,
    type: "magiclink",
  });
  if (error) throw new PasskeyError(error.message);
}

function mapCeremonyError(e: unknown): PasskeyError {
  const name = (e as { name?: string })?.name;
  // NotAllowedError = korisnik odustao ILI nema passkeya za ovaj RP — WebAuthn
  // ih namjerno ne razlikuje; tretiramo kao "nema credentiala" i nudimo dalje.
  if (name === "NotAllowedError") return new PasskeyError("cancelled", true);
  return new PasskeyError(String((e as Error)?.message ?? e));
}

/// Prijava postojećim passkeyom (discoverable credential — bez emaila).
export async function signInWithPasskey(): Promise<void> {
  const start = await invokeFn<StartResponse>("passkey/login/start", {});
  let credential;
  try {
    credential = await startAuthentication({
      optionsJSON: start.options as PublicKeyCredentialRequestOptionsJSON,
    });
  } catch (e) {
    throw mapCeremonyError(e);
  }
  const finish = await invokeFn<FinishResponse>("passkey/login/finish", {
    challenge: start.options.challenge,
    credential,
    rpId: start.rpId,
  });
  await redeemOtp(finish);
}

/// Dodaj passkey PRIJAVLJENOM (ne-anonimnom) korisniku — email ide iz JWT-a
/// (functions.invoke šalje Authorization header tekuće sesije).
export async function registerPasskey(deviceName?: string): Promise<void> {
  const start = await invokeFn<StartResponse>("passkey/register/start", {});
  let credential;
  try {
    credential = await startRegistration({
      optionsJSON: start.options as PublicKeyCredentialCreationOptionsJSON,
    });
  } catch (e) {
    throw mapCeremonyError(e);
  }
  await invokeFn<FinishResponse>("passkey/register/finish", {
    challenge: start.options.challenge,
    credential,
    deviceName: deviceName ?? defaultDeviceName(),
    rpId: start.rpId,
  });
  // Korisnik je već prijavljen kao isti račun — email_otp ne treba iskoristiti.
}

function defaultDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone/iPad";
  if (/Mac/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  return "Web";
}
