"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="border-b border-ink/8">
      <div className="container-content flex h-20 items-center justify-between">
        <Link href="/" aria-label={t("nav.homeAria")}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-inkMuted">
          <Link href="/" className="hover:text-ink">
            {t("nav.campaigns")}
          </Link>
          <Link href="/kako-radi" className="hover:text-ink">
            {t("nav.howItWorks")}
          </Link>
          <Link href="/dashboard" className="hover:text-ink">
            {t("nav.creators")}
          </Link>
          <a
            href="https://pinka.finance"
            className="hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            {t("nav.about")}
          </a>
          <LanguageSwitcher />
          <AccountChip />
        </nav>
      </div>
    </header>
  );
}

/// Global identity affordance: signed-out → "Prijava eOsobnom" (eID); signed-in
/// & verified → a verified badge with sign-out. A signed-in-but-unverified user
/// (e.g. email-OTP creator) is also offered the eID login to get verified.
function AccountChip() {
  const { t } = useI18n();
  const { user, identity, signInWithCertilia, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const signedIn = !!user && !user.is_anonymous;

  async function doLogin() {
    setBusy(true);
    setErr(false);
    try {
      await signInWithCertilia();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  if (signedIn && identity?.verified) {
    const name = [identity.first_name, identity.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return (
      <div className="flex items-center gap-2">
        <span
          title={t("identity.verifiedTitle")}
          className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {name || t("identity.verified")}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label={t("identity.signOut")}
          className="text-inkMuted hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={doLogin}
      disabled={busy}
      title={err ? t("identity.signInError") : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-teal-300 px-3 py-1.5 text-xs font-medium text-teal-800 transition-colors hover:border-teal-500 disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5" />
      )}
      {busy ? t("identity.signInBusy") : t("identity.signIn")}
    </button>
  );
}
