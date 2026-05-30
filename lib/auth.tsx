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
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      await signInWithEmail(email.trim());
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="container-content py-20">
      <div className="mx-auto max-w-md card-base">
        <Logo />
        <h1 className="mt-5 text-2xl font-display font-semibold">
          Prijava za kreatore
        </h1>
        <p className="mt-2 text-sm text-inkMuted">
          Pošaljemo ti čarobnu poveznicu na e-mail.
        </p>
        {state === "sent" ? (
          <p className="mt-6 rounded-md bg-coral/10 p-4 text-sm text-coral-700">
            Provjeri e-mail — poslali smo ti poveznicu za prijavu.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ti@email.com"
              className="w-full rounded-full border border-ink/15 px-4 py-3 text-sm focus:border-ink/30 focus:outline-none"
            />
            {state === "error" ? (
              <p className="text-sm text-rust">
                Greška pri slanju. Pokušaj ponovno.
              </p>
            ) : null}
            <Button type="submit" disabled={state === "sending"} className="w-full">
              {state === "sending" ? "Šaljem…" : "Pošalji poveznicu"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
