# OG share images (pinka.finance)

Bilingual Open Graph / Twitter cards at **1200×630** (the universal cross-network
size: Facebook, X/Twitter `summary_large_image`, LinkedIn, Discord, WhatsApp,
Telegram, Slack).

- Sources: `og-hr.svg`, `og-en.svg` (this folder)
- Output (served): `../og-hr.png`, `../og-en.png`

Brand: pinka's own palette (cream `#FBF8F3`, coral `#E85D5D`, ink `#1A1A1A`,
teal accents) — NOT the Domovina mediakit flag-D system (pinka is a separate
brand). The serif wordmark renders with **Georgia** (the documented Fraunces
fallback) so `rsvg-convert` is deterministic without the web font installed.

Regenerate (same toolchain as /Users/ms/git/domovinatv/mediakit.domovina.tv):

```bash
brew install librsvg   # provides rsvg-convert
for l in hr en; do rsvg-convert -w 1200 -h 630 og-$l.svg -o ../og-$l.png; done
```

Wiring: static default (hr) in `app/layout.tsx` metadata.openGraph/twitter;
`components/seo-sync.tsx` swaps `og:image`/`twitter:image` to `og-<locale>.png`
on language switch. See [[i18n-convention]].
