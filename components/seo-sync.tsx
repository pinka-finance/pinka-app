"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

// Static export ships a single set of HTML with Croatian metadata baked in. This
// keeps the live document head in sync with the chosen locale: it rewrites the
// title, description and Open Graph/Twitter tags so JS-capable crawlers (Google)
// and link unfurlers reflect the active language. The campaign route (/c) owns
// its own title (the campaign name), so we skip the title there.
function upsertMeta(
  attr: "name" | "property",
  key: string,
  content: string,
) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Upsert a <link rel> by a stable lookup key (rel, plus hreflang for alternates).
function upsertLink(rel: string, href: string, hreflang?: string) {
  const sel = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (hreflang) el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function SeoSync() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const title = t("seo.title");
  const description = t("seo.description");
  const ogImageAlt = t("seo.ogImageAlt");
  const ogLocale = locale === "en" ? "en_US" : "hr_HR";

  // Deps are primitive strings → no re-run loop despite `t` being unstable.
  useEffect(() => {
    if (pathname !== "/c") document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:locale", ogLocale);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);

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
    const ogImage = `${hrUrl.origin}/og-${locale}.png`;
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:alt", ogImageAlt);
    upsertMeta("name", "twitter:image", ogImage);
  }, [title, description, ogImageAlt, ogLocale, locale, pathname]);

  return null;
}
