"use client";

import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-24 border-t border-ink/8">
      <div className="container-content flex h-20 items-center justify-between text-sm text-inkMuted">
        <span>{t("footer.copyright")}</span>
        <span>{t("footer.rail")}</span>
      </div>
    </footer>
  );
}
