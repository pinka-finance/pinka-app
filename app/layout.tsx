import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.pinka.finance";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "pinka — kampanje",
    template: "%s · pinka",
  },
  description:
    "Podrži kampanje jednim skenom — SEPA Instant + Monerium EURe, bez kartičnih provizija, izravno autoru, transparentno na lancu.",
  openGraph: {
    type: "website",
    locale: "hr_HR",
    url: siteUrl,
    siteName: "pinka",
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
