"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="container-content py-24 text-center">
      <h1 className="text-display-md font-display font-semibold">
        {t("notFound.code")}
      </h1>
      <p className="mt-3 text-inkMuted">{t("campaign.notFound")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t("common.allCampaigns")}</Link>
      </Button>
    </div>
  );
}
