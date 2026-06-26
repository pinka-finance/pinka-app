"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { upsertMeta, upsertLink } from "@/lib/head-meta";

// Static export ships a single set of HTML with Croatian metadata baked in. This
// keeps the live document head in sync with the chosen locale: it rewrites the
// title, description and Open Graph/Twitter tags so JS-capable crawlers (Google)
// and link unfurlers reflect the active language. The campaign route (/c) owns
// its own title AND og:title/description/image (the campaign name + cover), so
// we skip those there — see app/c/page.tsx.

export function SeoSync() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  // Per-route titles for static content pages; the campaign route (/c) sets
  // its own (the campaign name) and is skipped below.
  const title = pathname === "/kako-radi" ? t("howItWorks.seoTitle") : t("seo.title");
  const description = t("seo.description");
  const ogImageAlt = t("seo.ogImageAlt");
  const ogLocale = locale === "en" ? "en_US" : "hr_HR";

  // Campaign pages (/c and /c/{slug}) own their title, description and
  // og:title/description/image (the campaign name + 1200×630 cover) — see
  // app/c/page.tsx. We only manage the locale-level tags below for them.
  const isCampaign = pathname === "/c" || (pathname?.startsWith("/c/") ?? false);

  // Deps are primitive strings → no re-run loop despite `t` being unstable.
  useEffect(() => {
    if (!isCampaign) {
      document.title = title;
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:title", title);
      upsertMeta("property", "og:description", description);
      upsertMeta("name", "twitter:title", title);
      upsertMeta("name", "twitter:description", description);
    }
    upsertMeta("property", "og:locale", ogLocale);

    // Per-language URLs for this exact page: hr is the default (no ?lang), en is
    // the same path with ?lang=en. Canonical is self-referential per locale.
    const hrUrl = new URL(window.location.href);
    hrUrl.searchParams.delete("lang");
    const enUrl = new URL(hrUrl.toString());
    enUrl.searchParams.set("lang", "en");
    const hr = hrUrl.toString();
    const en = enUrl.toString();

    upsertLink("canonical", locale === "en" ? en : hr);
    upsertLink("alternate", hr, "hr-HR");
    upsertLink("alternate", en, "en-US");
    upsertLink("alternate", hr, "x-default");
    upsertMeta("property", "og:url", locale === "en" ? en : hr);

    // Locale-matched share image (1200×630). Absolute URL — required by scrapers.
    // Campaign pages override these with their own cover (app/c/page.tsx).
    if (!isCampaign) {
      const ogImage = `${hrUrl.origin}/og-${locale}.png`;
      upsertMeta("property", "og:image", ogImage);
      upsertMeta("property", "og:image:alt", ogImageAlt);
      upsertMeta("name", "twitter:image", ogImage);
    }
  }, [title, description, ogImageAlt, ogLocale, locale, pathname, isCampaign]);

  return null;
}
