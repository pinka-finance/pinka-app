"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

// pinka is a static-export SPA on Cloudflare Pages — NOT a PWA, so there's no
// service worker to emit update events (unlike the DOMOVINA Wallet). Instead we
// poll a tiny, never-cached version.json (written at build time by
// scripts/gen-version.mjs) and compare its commit to the one baked into THIS
// bundle. A newer deploy serves a newer commit → we surface the "Ažuriraj"
// banner → a reload pulls the fresh HTML/chunks from the (deploy-purged) edge.
const CURRENT_COMMIT = process.env.NEXT_PUBLIC_COMMIT ?? "unknown";

// 60s: short enough that a freshly-deployed fix reaches an open tab within a
// minute, long enough not to spam the CF Pages edge with no-op requests.
const POLL_INTERVAL_MS = 60_000;

export function UpdateBanner() {
  const { t } = useI18n();
  const [needRefresh, setNeedRefresh] = useState(false);
  // Once the user taps "Odgodi" we stop nagging for the rest of this page-load
  // (a reload clears it). Kept in a ref so the poller reads the latest value
  // without re-subscribing.
  const dismissedRef = useRef(false);

  useEffect(() => {
    // No reliable baseline (build env had no git) → never prompt.
    if (CURRENT_COMMIT === "unknown") return;

    let cancelled = false;

    async function check() {
      if (dismissedRef.current) return;
      if ("onLine" in navigator && !navigator.onLine) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: { commit?: string } = await res.json();
        if (cancelled || !data.commit || data.commit === "unknown") return;
        if (data.commit !== CURRENT_COMMIT) setNeedRefresh(true);
      } catch {
        // Offline / transient network error — try again next tick.
      }
    }

    const id = setInterval(check, POLL_INTERVAL_MS);
    // Also check when the tab regains focus — covers laptops resumed from sleep
    // where interval timers are throttled/paused.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    void check();

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 pointer-events-none sm:inset-x-auto sm:right-4 sm:max-w-sm"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-teal/30 bg-teal p-3 text-cream shadow-lift sm:p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream/15">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            {t("update.ready")}
          </p>
          <p className="text-xs leading-tight text-cream/80">
            {t("update.hint")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.location.reload()}
          className="bg-cream text-teal hover:bg-cream/90 hover:text-teal"
        >
          {t("update.action")}
        </Button>
        <button
          type="button"
          aria-label={t("update.dismiss")}
          onClick={() => {
            dismissedRef.current = true;
            setNeedRefresh(false);
          }}
          className="rounded-full p-1.5 text-cream/80 transition-colors hover:bg-cream/10 hover:text-cream"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
