"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ShieldCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";
import { signInWithCertilia as runCertiliaLogin } from "@/lib/certilia";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useI18n } from "@/lib/i18n";

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
        setIdentity(null);
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

function SignIn() {
  const { signInWithEmail, verifyEmailOtp, signInWithCertilia } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // step "email" → enter address; step "code" → enter the 6-digit OTP (or just
  // click the link in the mail, which logs in via onAuthStateChange anyway).
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certBusy, setCertBusy] = useState(false);

  async function doCertilia() {
    setCertBusy(true);
    setError(null);
    try {
      await signInWithCertilia();
      // success → AuthGate re-renders children (session is now non-anon).
    } catch {
      setError(t("auth.certiliaError"));
    } finally {
      setCertBusy(false);
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
            <p className="mt-2 text-sm text-inkMuted">{t("auth.emailIntro")}</p>
            <form onSubmit={sendCode} className="mt-6 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-full border border-ink/15 px-4 py-3 text-sm focus:border-ink/30 focus:outline-none"
              />
              {error ? <p className="text-sm text-rust">{error}</p> : null}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? t("auth.sending") : t("auth.sendCode")}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-inkMuted">
              <span className="h-px flex-1 bg-ink/10" />
              {t("auth.or")}
              <span className="h-px flex-1 bg-ink/10" />
            </div>

            <button
              type="button"
              onClick={doCertilia}
              disabled={certBusy}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 px-4 py-3 text-sm font-medium transition-colors hover:border-ink/30 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              {certBusy ? t("auth.certiliaBusy") : t("auth.certilia")}
            </button>
            <p className="mt-1.5 text-center text-xs text-inkMuted">
              {t("auth.certiliaSub")}
            </p>
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
