"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    loading,
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
  const signedIn = !!user && !user.is_anonymous;

  if (loading) {
    return (
      <div className="container-content py-24 text-center text-inkMuted">
        Učitavam…
      </div>
    );
  }
  if (!signedIn) return <SignIn />;
  return <>{children}</>;
}

function SignIn() {
  const { signInWithEmail, verifyEmailOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // step "email" → enter address; step "code" → enter the 6-digit OTP (or just
  // click the link in the mail, which logs in via onAuthStateChange anyway).
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim());
      setStep("code");
    } catch {
      setError("Greška pri slanju. Pokušaj ponovno.");
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
      setError("Kod nije točan ili je istekao. Provjeri i pokušaj ponovno.");
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
      setError("Greška pri ponovnom slanju.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-content py-20">
      <div className="mx-auto max-w-md card-base">
        <Logo />
        <h1 className="mt-5 text-2xl font-display font-semibold">
          Prijava za kreatore
        </h1>

        {step === "email" ? (
          <>
            <p className="mt-2 text-sm text-inkMuted">
              Upiši e-mail — pošaljemo ti kod (i poveznicu) za prijavu.
            </p>
            <form onSubmit={sendCode} className="mt-6 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ti@email.com"
                className="w-full rounded-full border border-ink/15 px-4 py-3 text-sm focus:border-ink/30 focus:outline-none"
              />
              {error ? <p className="text-sm text-rust">{error}</p> : null}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Šaljem…" : "Pošalji kod"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-inkMuted">
              Poslali smo kod na <strong>{email}</strong>. Upiši ga ovdje — ili
              jednostavno klikni poveznicu iz maila.
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
                {busy ? "Provjeravam…" : "Potvrdi i prijavi se"}
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
                ← Promijeni e-mail
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={busy}
                className="hover:text-ink disabled:opacity-50"
              >
                Pošalji ponovno
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
