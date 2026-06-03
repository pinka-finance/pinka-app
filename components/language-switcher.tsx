"use client";

import { useI18n, type Locale } from "@/lib/i18n";

const LOCALES: Locale[] = ["hr", "en"];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div
      className="inline-flex rounded-full border border-ink/10 p-0.5 text-xs"
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={
            "rounded-full px-2 py-0.5 font-medium uppercase transition-colors " +
            (locale === l
              ? "bg-coral text-cream"
              : "text-inkMuted hover:text-ink")
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}
