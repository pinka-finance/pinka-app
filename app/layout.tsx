import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SeoSync } from "@/components/seo-sync";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

// Current production deploy of this repo (pinka-finance/app) is https://pinka.io —
// the apex domain (the build sets NEXT_PUBLIC_SITE_URL; the canonical/og URLs in
// out/ resolve to pinka.io). The marketing landing (pinka-finance/landing) is on
// pinka.finance. app.pinka.finance is a possible future alias for this app, not
// live yet — so the fallback below points at the real current domain.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pinka.io";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "pinka — kampanje",
    template: "%s · pinka",
  },
  description:
    "Podrži kampanje jednim skenom — SEPA Instant + Monerium EURe, bez kartičnih provizija, izravno autoru, transparentno na lancu.",
  // Croatian is the default/canonical; English is reachable at ?lang=en. SeoSync
  // (client) swaps title/description/og:locale live on language switch and emits
  // the per-language hreflang + canonical (Next's metadata API drops the ?lang
  // query from alternates, so those are injected at runtime instead).
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "hr_HR",
    alternateLocale: ["en_US"],
    url: siteUrl,
    siteName: "pinka",
    images: [
      {
        url: "/og-hr.png",
        width: 1200,
        height: 630,
        alt: "pinka — podrži kampanje jednim skenom",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-hr.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBF8F3",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <I18nProvider>
          <SeoSync />
          <AuthProvider>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
