"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";
import { signInWithCertilia as runCertiliaLogin } from "@/lib/certilia";
import {
  signInWithPasskey as runPasskeyLogin,
  PasskeyError,
} from "@/lib/passkey-login";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useI18n, Rich } from "@/lib/i18n";

/// Safe subset returned by public.my_identity_status() — OIB/DOB never leave the
/// backend. `verified: true` means the user signed in with their Croatian eID
/// (Certilia) and is 100% confirmed by RH → implicit KYC/AML.
export interface IdentityStatus {
  verified: boolean;
  provider?: string;
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  verified_at?: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /// eID verification status of the signed-in user (null while unknown/anon).
  identity: IdentityStatus | null;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  /// Login with the Croatian eID (Certilia MobileID). Resolves once the Supabase
  /// session is established; identity is then refreshed via onAuthStateChange.
  signInWithCertilia: () => Promise<void>;
  /// Login with an existing passkey (WebAuthn, RP = pinka.io). Same email_otp
  /// session bridge as Certilia — see lib/passkey-login.ts.
  signInWithPasskey: () => Promise<void>;
  /// Google/Apple OAuth via the shared GoTrue (api.domovina.ai). Full-page
  /// redirect; the session lands back on /dashboard (detectSessionInUrl).
  signInWithOAuth: (provider: "google" | "apple") => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<IdentityStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      void refreshIdentity(data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void refreshIdentity(s);
    });
    return () => sub.subscription.unsubscribe();

    // my_identity_status() is granted to authenticated only and returns just a
    // safe subset (no OIB/DOB). Skip for anon/guest sessions.
    async function refreshIdentity(s: Session | null) {
      if (!s?.user || s.user.is_anonymous) {
        setIdentity(null);
        return;
      }
      const { data, error } = await supabaseBrowser().rpc("my_identity_status");
      if (error) {
        // Signed-in user whose status we couldn't fetch — treat as unverified
        // (gates stay closed) rather than unknown; eID login retries anyway.
        setIdentity({ verified: false });
        return;
      }
      setIdentity((data as IdentityStatus) ?? { verified: false });
    }
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    loading,
    identity,
    signInWithEmail: async (email: string) => {
      const sb = supabaseBrowser();
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
    },
    verifyEmailOtp: async (email: string, code: string) => {
      // Same OTP GoTrue mailed; type "email" covers the magic-link/email-OTP
      // flow. On success onAuthStateChange fires and AuthGate renders children.
      const sb = supabaseBrowser();
      const { error } = await sb.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
    },
    signInWithCertilia: async () => {
      // The eID handshake + edge-fn bridge live in lib/certilia. On success the
      // Supabase session flips to the permanent (kyc_verified) user and
      // onAuthStateChange refreshes `identity` above.
      await runCertiliaLogin();
    },
    signInWithPasskey: async () => {
      await runPasskeyLogin();
    },
    signInWithOAuth: async (provider: "google" | "apple") => {
      const sb = supabaseBrowser();
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      // The browser navigates away to the provider; nothing more to do here.
    },
    signOut: async () => {
      await supabaseBrowser().auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/// Gate koji traži KYC-verificiranog korisnika (prijava Certilia Mobile ID-jem).
/// Koristi se UNUTAR AuthGate-a na kreiranju kampanje: bilo koji login otvara
/// dashboard, ali kampanju smije kreirati isključivo eOsobnom verificiran
/// korisnik (implicitni KYC/AML — enforcano i server-side RLS-om na INSERT).
export function VerifiedGate({ children }: { children: ReactNode }) {
  const { identity, signInWithCertilia, user } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // identity stiže async nakon prijave (rpc my_identity_status).
  if (!identity) {
    return (
      <div className="container-content py-24 text-center text-inkMuted">
        {t("kyc.checking")}
      </div>
    );
  }
  if (identity.verified) return <>{children}</>;

  async function doCertilia() {
    setBusy(true);
    setError(null);
    try {
      await signInWithCertilia();
      // success → session prelazi na verificirani (kyc) račun i identity se
      // osvježi kroz onAuthStateChange; gate se sam otvara.
    } catch {
      setError(t("auth.certiliaError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-content py-20">
      <div className="mx-auto max-w-md card-base">
        <Logo />
        <h1 className="mt-5 text-2xl font-display font-semibold">
          {t("kyc.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-inkMuted">
          <Rich>{t("kyc.intro")}</Rich>
        </p>
        <button
          type="button"
          onClick={doCertilia}
          disabled={busy}
          className={`mt-6 ${providerBtnCls}`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-teal-700" />
          )}
          {busy ? t("auth.certiliaBusy") : t("auth.certilia")}
        </button>
        {user?.email ? (
          <p className="mt-3 text-center text-xs text-inkMuted">
            {t("kyc.signedInAs", { email: user.email })}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rust">{error}</p> : null}
      </div>
    </div>
  );
}

/// Gate koji traži prijavljenog (NE-anonimnog) korisnika; inače pokazuje
/// magic-link sign-in. Anonimne sesije se tretiraju kao neprijavljene.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const signedIn = !!user && !user.is_anonymous;

  if (loading) {
    return (
      <div className="container-content py-24 text-center text-inkMuted">
        {t("common.loading")}
      </div>
    );
  }
  if (!signedIn) return <SignIn />;
  return <>{children}</>;
}

// Inline brand glyphs — lucide nema (ne-deprecated) Google/Apple ikone.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.18 7.18 0 0 1-10.8-3.78H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.27a12 12 0 0 0 0 10.8l3.99-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.97 11.97 0 0 0 1.27 6.6l3.99 3.1A7.18 7.18 0 0 1 12 4.77Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M16.36 12.95c.03 3.04 2.67 4.05 2.7 4.06-.02.07-.42 1.45-1.4 2.86-.84 1.23-1.71 2.45-3.09 2.47-1.35.03-1.79-.8-3.34-.8-1.55 0-2.03.78-3.31.83-1.33.05-2.34-1.32-3.19-2.54-1.73-2.5-3.05-7.07-1.28-10.16a4.95 4.95 0 0 1 4.18-2.54c1.3-.02 2.54.88 3.34.88.8 0 2.3-1.09 3.87-.93.66.03 2.51.27 3.7 2-.1.06-2.21 1.3-2.18 3.87ZM13.8 4.43c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.24 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44Z" />
    </svg>
  );
}

const providerBtnCls =
  "flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 px-4 py-3 text-sm font-medium transition-colors hover:border-ink/30 disabled:opacity-50";

function SignIn() {
  const {
    signInWithEmail,
    verifyEmailOtp,
    signInWithCertilia,
    signInWithPasskey,
    signInWithOAuth,
  } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // step "email" → enter address; step "code" → enter the 6-digit OTP (or just
  // click the link in the mail, which logs in via onAuthStateChange anyway).
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One provider ceremony at a time: "passkey" | "certilia" | "google" | "apple".
  const [provBusy, setProvBusy] = useState<string | null>(null);

  async function doPasskey() {
    setProvBusy("passkey");
    setError(null);
    try {
      await signInWithPasskey();
      // success → AuthGate re-renders children (session is now non-anon).
    } catch (e) {
      setError(
        e instanceof PasskeyError && e.noCredential
          ? t("auth.passkeyNone")
          : t("auth.passkeyError"),
      );
    } finally {
      setProvBusy(null);
    }
  }

  async function doCertilia() {
    setProvBusy("certilia");
    setError(null);
    try {
      await signInWithCertilia();
    } catch {
      setError(t("auth.certiliaError"));
    } finally {
      setProvBusy(null);
    }
  }

  async function doOAuth(provider: "google" | "apple") {
    setProvBusy(provider);
    setError(null);
    try {
      await signInWithOAuth(provider);
      // Page navigates to the provider — keep the spinner until then.
    } catch {
      setError(t("auth.oauthError"));
      setProvBusy(null);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim());
      setStep("code");
    } catch {
      setError(t("auth.errSend"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, code);
      // success → AuthGate re-renders children; nothing else to do here.
    } catch {
      setError(t("auth.errCode"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim());
    } catch {
      setError(t("auth.errResend"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-content py-20">
      <div className="mx-auto max-w-md card-base">
        <Logo />
        <h1 className="mt-5 text-2xl font-display font-semibold">
          {t("auth.title")}
        </h1>

        {step === "email" ? (
          <>
            <p className="mt-2 text-sm text-inkMuted">{t("auth.intro")}</p>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={doPasskey}
                disabled={provBusy !== null}
                className={providerBtnCls}
              >
                {provBusy === "passkey" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Fingerprint className="h-4 w-4 text-coral-700" />
                )}
                {provBusy === "passkey" ? t("auth.passkeyBusy") : t("auth.passkey")}
              </button>
              <p className="-mt-1 text-center text-xs text-inkMuted">
                {t("auth.passkeySub")}
              </p>

              <button
                type="button"
                onClick={doCertilia}
                disabled={provBusy !== null}
                className={providerBtnCls}
              >
                {provBusy === "certilia" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                )}
                {provBusy === "certilia" ? t("auth.certiliaBusy") : t("auth.certilia")}
              </button>
              <p className="-mt-1 text-center text-xs text-inkMuted">
                {t("auth.certiliaSub")}
              </p>

              <button
                type="button"
                onClick={() => void doOAuth("google")}
                disabled={provBusy !== null}
                className={providerBtnCls}
              >
                {provBusy === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {t("auth.google")}
              </button>

              <button
                type="button"
                onClick={() => void doOAuth("apple")}
                disabled={provBusy !== null}
                className={providerBtnCls}
              >
                {provBusy === "apple" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AppleIcon />
                )}
                {t("auth.apple")}
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-inkMuted">
              <span className="h-px flex-1 bg-ink/10" />
              {t("auth.or")}
              <span className="h-px flex-1 bg-ink/10" />
            </div>

            <p className="text-sm text-inkMuted">{t("auth.emailIntro")}</p>
            <form onSubmit={sendCode} className="mt-3 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-full border border-ink/15 px-4 py-3 text-sm focus:border-ink/30 focus:outline-none"
              />
              <Button type="submit" disabled={busy || provBusy !== null} className="w-full">
                {busy ? t("auth.sending") : t("auth.sendCode")}
              </Button>
            </form>
            {error ? <p className="mt-3 text-sm text-rust">{error}</p> : null}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-inkMuted">
              {t("auth.codeIntroPre")}
              <strong>{email}</strong>
              {t("auth.codeIntroPost")}
            </p>
            <form onSubmit={confirmCode} className="mt-6 space-y-3">
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full rounded-2xl border border-ink/15 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-ink/30 focus:outline-none"
              />
              {error ? <p className="text-sm text-rust">{error}</p> : null}
              <Button type="submit" disabled={busy || code.length < 6} className="w-full">
                {busy ? t("auth.verifying") : t("auth.confirmSignIn")}
              </Button>
            </form>
            <div className="mt-4 flex items-center justify-between text-xs text-inkMuted">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="hover:text-ink"
              >
                ← {t("auth.changeEmail")}
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={busy}
                className="hover:text-ink disabled:opacity-50"
              >
                {t("auth.resend")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
