// Live <head> mutation helpers for the static-export SPA. The exported HTML
// ships with Croatian defaults baked in; these upsert tags at runtime so the
// locale switch and per-campaign pages can override title/description/og tags
// for JS-capable crawlers and link unfurlers. Shared by SeoSync (site-wide)
// and the campaign page (per-campaign og:image).

export function upsertMeta(
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
export function upsertLink(rel: string, href: string, hreflang?: string) {
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
