import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { AuthProvider } from "@/lib/auth";
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
        <header className="border-b border-ink/8">
          <div className="container-content flex h-16 items-center justify-between">
            <Link href="/" aria-label="pinka — naslovnica">
              <Logo />
            </Link>
            <nav className="flex items-center gap-6 text-sm text-inkMuted">
              <Link href="/" className="hover:text-ink">Kampanje</Link>
              <Link href="/dashboard" className="hover:text-ink">Za kreatore</Link>
              <a
                href="https://pinka.finance"
                className="hover:text-ink"
                target="_blank"
                rel="noreferrer"
              >
                O projektu
              </a>
            </nav>
          </div>
        </header>
        <main id="main">
          <AuthProvider>{children}</AuthProvider>
        </main>
        <footer className="mt-24 border-t border-ink/8">
          <div className="container-content flex h-20 items-center justify-between text-sm text-inkMuted">
            <span>© pinka.finance</span>
            <span>SEPA Instant · Monerium EURe · Gnosis</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
