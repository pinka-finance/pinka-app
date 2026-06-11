"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtEur } from "@/lib/format";
import {
  buildAiPrompt,
  exportCampaignConfig,
  parseCampaignConfig,
  type ImportResult,
} from "@/lib/campaign-config";
import { parseDomovinaUrl, fetchDomovinaConfig } from "@/lib/domovina-import";
import type { CampaignFormValues } from "@/components/dashboard/campaign-form";
import { useI18n, Rich } from "@/lib/i18n";

// "Ispuni uz AI asistenta" — most između vanjskog AI chata (ChatGPT/Claude/
// Gemini) i forme. Tri koraka: kopiraj prompt predložak → iteriraj vani →
// zalijepi JSON natrag. Uvezena polja se NE upisuju slijepo: review tablica
// dopušta cherry-pick po polju, nevaljana polja su isključena s razlogom.
export function ConfigImport({
  current,
  onApply,
}: {
  current: CampaignFormValues | null;
  onApply: (patch: Partial<CampaignFormValues>) => void;
}) {
  const { t, locale } = useI18n();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<"prompt" | "config" | null>(null);

  async function copy(kind: "prompt" | "config") {
    const payload =
      kind === "prompt" ? buildAiPrompt(locale, current) : exportCampaignConfig(current!);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blokiran — ništa strašno */
    }
  }

  // Paste prima dva oblika: domovina.ai link (epizoda/kanal → config se gradi
  // iz cdn.domovina.ai) ili JSON iz AI chata. Oba idu kroz isti review.
  async function parse() {
    setParseError(null);
    setExcluded(new Set());
    const ref = parseDomovinaUrl(text);
    let source = text;
    if (ref) {
      setFetching(true);
      try {
        source = JSON.stringify(await fetchDomovinaConfig(ref));
      } catch (e) {
        console.error(e);
        setResult(null);
        setParseError(t("dashboardNew.ai.linkFetchFailed"));
        setFetching(false);
        return;
      }
      setFetching(false);
    }
    const r = parseCampaignConfig(source);
    if (!r || r.fields.length === 0) {
      setResult(null);
      setParseError(t("dashboardNew.ai.parseError"));
      return;
    }
    setResult(r);
  }

  function apply() {
    if (!result) return;
    const patch: Partial<CampaignFormValues> = {};
    for (const f of result.fields) {
      if (f.patch && !excluded.has(f.key)) Object.assign(patch, f.patch);
    }
    onApply(patch);
    setResult(null);
    setText("");
  }

  // trenutačna vrijednost polja za usporedbu u review tablici
  function currentDisplay(key: string): string {
    if (!current) return "—";
    const dash = (s: string | null | undefined) => (s && s.length > 0 ? s : "—");
    switch (key) {
      case "title": return dash(current.title);
      case "type": return current.type;
      case "description": return dash(current.description).slice(0, 90);
      case "goal_eur": return current.goalCents !== null ? `${fmtEur(current.goalCents)} €` : "—";
      case "min_contribution_eur": return `${fmtEur(current.minContributionCents)} €`;
      case "visibility": return current.visibility;
      case "recurrence": return current.recurrence;
      case "recurrence_anchor_day":
        return current.recurrenceAnchorDay !== null ? String(current.recurrenceAnchorDay) : "—";
      case "location":
        return dash(
          [current.locationName, current.latitude !== null ? `${current.latitude}, ${current.longitude}` : null]
            .filter(Boolean)
            .join(" · ") || null,
        );
      case "cover_image_url": return dash(current.coverImageUrl);
      case "starts_at": return dash(current.startsAt);
      case "ends_at": return dash(current.endsAt);
      case "subject_type": return current.subjectType;
      case "subject_ref": return dash(current.subjectRef);
      default: return "—";
    }
  }

  return (
    <details className="card-base !p-6 group">
      <summary className="flex cursor-pointer items-center gap-2 font-display font-semibold">
        <Sparkles className="h-5 w-5 text-coral" /> {t("dashboardNew.ai.title")}
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-inkMuted">
        <Rich>{t("dashboardNew.ai.desc")}</Rich>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy("prompt")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-xs font-medium hover:border-ink/30"
        >
          {copied === "prompt" ? <Check className="h-3.5 w-3.5 text-teal-700" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copied === "prompt" ? t("dashboardNew.ai.copied") : t("dashboardNew.ai.copyPrompt")}
        </button>
        <button
          type="button"
          onClick={() => copy("config")}
          disabled={!current}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-xs font-medium hover:border-ink/30 disabled:opacity-50"
        >
          {copied === "config" ? <Check className="h-3.5 w-3.5 text-teal-700" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copied === "config" ? t("dashboardNew.ai.copied") : t("dashboardNew.ai.exportJson")}
        </button>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-inkSoft">
          {t("dashboardNew.ai.pasteLabel")}
        </label>
        <textarea
          className="w-full rounded-lg border border-ink/15 bg-white/80 px-3.5 py-2.5 font-mono text-xs focus:border-ink/30 focus:outline-none"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("dashboardNew.ai.pastePlaceholder")}
        />
        <div className="mt-2 flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void parse()}
            disabled={!text.trim() || fetching}
          >
            {fetching ? t("dashboardNew.ai.linkLoading") : t("dashboardNew.ai.parse")}
          </Button>
          {parseError ? <p className="text-xs text-rust">{parseError}</p> : null}
        </div>
      </div>

      {result ? (
        <div className="mt-5 rounded-lg border border-ink/10 bg-white/60 p-4">
          <h4 className="text-sm font-semibold">{t("dashboardNew.ai.reviewTitle")}</h4>
          <p className="mt-1 text-xs leading-relaxed text-inkMuted">
            {t("dashboardNew.ai.reviewDesc")}
          </p>
          {!result.versionOk ? (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
              {t("dashboardNew.ai.versionWarn")}
            </p>
          ) : null}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink/8 text-left text-inkMuted">
                  <th className="py-1.5 pr-2 font-medium"></th>
                  <th className="py-1.5 pr-3 font-medium">{t("dashboardNew.ai.colField")}</th>
                  <th className="py-1.5 pr-3 font-medium">{t("dashboardNew.ai.colCurrent")}</th>
                  <th className="py-1.5 font-medium">{t("dashboardNew.ai.colProposed")}</th>
                </tr>
              </thead>
              <tbody>
                {result.fields.map((f) => {
                  const usable = f.patch !== null;
                  const checked = usable && !excluded.has(f.key);
                  return (
                    <tr key={f.key} className={"border-b border-ink/5 align-top " + (usable ? "" : "opacity-60")}>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!usable}
                          onChange={(e) => {
                            setExcluded((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.delete(f.key);
                              else next.add(f.key);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 font-medium">{t(f.labelKey)}</td>
                      <td className="max-w-[12rem] break-words py-2 pr-3 text-inkMuted">
                        {currentDisplay(f.key)}
                      </td>
                      <td className="max-w-[16rem] break-words py-2">
                        {f.display}
                        {f.errorKey ? (
                          <span className="mt-0.5 block text-rust">{t(f.errorKey)}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {result.ignoredKeys.length > 0 ? (
            <p className="mt-2 text-xs text-inkMuted">
              {t("dashboardNew.ai.ignoredKeys", { keys: result.ignoredKeys.join(", ") })}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button type="button" size="sm" onClick={apply}>
              {t("dashboardNew.ai.apply")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setResult(null)}>
              {t("dashboardNew.ai.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </details>
  );
}
