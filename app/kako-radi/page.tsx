"use client";

import Link from "next/link";
import { KeyRound, Banknote, ArrowDownToLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { useI18n, Rich } from "@/lib/i18n";
import { getDiagrams } from "./diagrams";
import type { ReactNode } from "react";

// Public explainer: every campaign = its own on-chain account (Safe multisig
// on Gnosis) inside the creator's DOMOVINA wallet — told like a banking app,
// with Mermaid diagrams for the identity/donation/payout flows.

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
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-xl font-display font-semibold">
        <span className="text-coral">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-sm leading-relaxed text-inkSoft">{children}</div>
    </section>
  );
}

export default function HowItWorksPage() {
  const { t, locale } = useI18n();
  const diagrams = getDiagrams(locale);

  return (
    <div className="container-content max-w-3xl py-12">
      <h1 className="text-display-md font-display font-semibold">{t("howItWorks.title")}</h1>
      <p className="mt-3 text-base leading-relaxed text-inkSoft">
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

      <div className="mt-12 rounded-lg border border-ink/8 bg-sand/40 p-6 text-center">
        <p className="font-display text-lg font-semibold">{t("howItWorks.ctaTitle")}</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/new">{t("howItWorks.cta")}</Link>
        </Button>
      </div>
    </div>
  );
}
