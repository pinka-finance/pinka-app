"use client";

import Link from "next/link";
import {
  KeyRound,
  Banknote,
  ArrowDownToLine,
  ShieldCheck,
  Github,
  ExternalLink,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { useI18n, Rich } from "@/lib/i18n";
import { getDiagrams } from "./diagrams";
import type { ReactNode } from "react";

// Public explainer: every campaign = its own on-chain account (Safe multisig
// on Gnosis) inside the creator's DOMOVINA wallet — told like a banking app,
// with Mermaid diagrams for the identity/donation/payout flows. Closes with
// the open-source section: public repos + white-label/consulting offer.

const CONTACT_MAILTO =
  "mailto:hello@pinka.finance?subject=Vlastita%20platforma%20(white-label)";

// Public GitHub repos shown in the open-source section; descKey lives in the
// i18n catalogue (howItWorks.repo*).
const REPOS = [
  { url: "https://github.com/pinka-finance/pinka-app", name: "pinka-finance/pinka-app", descKey: "repoApp" },
  { url: "https://github.com/domovinatv/pay.domovina.ai", name: "domovinatv/pay.domovina.ai", descKey: "repoWallet" },
  { url: "https://github.com/pinka-finance/landing", name: "pinka-finance/landing", descKey: "repoLanding" },
  { url: "https://github.com/pinka-finance/pinka-finance-mvp", name: "pinka-finance/pinka-finance-mvp", descKey: "repoMvp" },
] as const;

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="flex items-center gap-2 text-xl font-display font-semibold">
        <span className="text-coral">{icon}</span>
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-sm leading-relaxed text-inkSoft">{children}</div>
    </section>
  );
}

export default function HowItWorksPage() {
  const { t, locale } = useI18n();
  const diagrams = getDiagrams(locale);

  return (
    <div className="container-content max-w-3xl py-14">
      <h1 className="text-display-md font-display font-semibold">{t("howItWorks.title")}</h1>
      <p className="mt-4 text-base leading-relaxed text-inkSoft">
        <Rich>{t("howItWorks.intro")}</Rich>
      </p>

      <Section icon={<KeyRound className="h-5 w-5" />} title={t("howItWorks.identityTitle")}>
        <p>
          <Rich>{t("howItWorks.identityBody")}</Rich>
        </p>
        <MermaidDiagram code={diagrams.identity} />
      </Section>

      <Section icon={<Banknote className="h-5 w-5" />} title={t("howItWorks.donateTitle")}>
        <p>
          <Rich>{t("howItWorks.donateBody")}</Rich>
        </p>
        <MermaidDiagram code={diagrams.donation} />
      </Section>

      <Section icon={<ArrowDownToLine className="h-5 w-5" />} title={t("howItWorks.payoutTitle")}>
        <p>
          <Rich>{t("howItWorks.payoutBody")}</Rich>
        </p>
        <MermaidDiagram code={diagrams.payout} />
      </Section>

      <Section icon={<ShieldCheck className="h-5 w-5" />} title={t("howItWorks.transparencyTitle")}>
        <ul className="space-y-3">
          {(["bullet1", "bullet2", "bullet3", "bullet4"] as const).map((k) => (
            <li key={k} className="flex gap-2">
              <span className="mt-0.5 text-coral">•</span>
              <span>
                <Rich>{t(`howItWorks.${k}`)}</Rich>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={<Github className="h-5 w-5" />} title={t("howItWorks.openSourceTitle")}>
        <p>
          <Rich>{t("howItWorks.openSourceBody")}</Rich>
        </p>
        <ul className="space-y-3">
          {REPOS.map((r) => (
            <li key={r.url}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-2.5 rounded-lg border border-ink/8 bg-white/40 px-4 py-3 transition-colors hover:border-ink/20"
              >
                <Github className="mt-0.5 h-4 w-4 shrink-0 text-inkMuted" />
                <span>
                  <span className="font-mono text-xs font-medium text-ink group-hover:underline">
                    {r.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-inkMuted">
                    {t(`howItWorks.${r.descKey}`)}
                  </span>
                </span>
                <ExternalLink className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-inkMuted" />
              </a>
            </li>
          ))}
        </ul>
        <div className="rounded-lg bg-teal/5 px-4 py-3">
          <p className="font-medium text-ink">{t("howItWorks.whiteLabelTitle")}</p>
          <p className="mt-1">
            <Rich>{t("howItWorks.whiteLabelBody")}</Rich>
          </p>
          <p className="mt-2">
            <Rich>{t("howItWorks.consultingBody")}</Rich>
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href={CONTACT_MAILTO}>
              <Mail className="h-4 w-4" /> {t("howItWorks.contactCta")}
            </a>
          </Button>
        </div>
      </Section>

      <div className="mt-16 rounded-lg border border-ink/8 bg-sand/40 p-8 text-center">
        <p className="font-display text-lg font-semibold">{t("howItWorks.ctaTitle")}</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/new">{t("howItWorks.cta")}</Link>
        </Button>
      </div>
    </div>
  );
}
