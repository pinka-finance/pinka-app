"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

// Client-only Mermaid renderer. The library is heavy (~1 MB), so it's loaded
// lazily via dynamic import — only pages that actually render a diagram (e.g.
// /kako-radi) pull the chunk, the rest of the SPA is unaffected. Diagrams are
// our own static sources (no user input), rendered to inline SVG.

type MermaidApi = typeof import("mermaid")["default"];

let mermaidLoader: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidLoader) {
    mermaidLoader = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "base",
        fontFamily: "inherit",
        themeVariables: {
          // Brand tokens from tailwind.config.ts (cream/sand/ink/coral/teal)
          background: "#FBF8F3",
          primaryColor: "#FDEEEE",
          primaryBorderColor: "#E85D5D",
          primaryTextColor: "#1A1A1A",
          secondaryColor: "#E6EEF1",
          secondaryBorderColor: "#0F4C5C",
          secondaryTextColor: "#1A1A1A",
          tertiaryColor: "#F5EFE6",
          tertiaryBorderColor: "#F0E6D2",
          lineColor: "#6B6B6B",
          textColor: "#1A1A1A",
          fontSize: "14px",
        },
      });
      return m.default;
    });
  }
  return mermaidLoader;
}

// mermaid.render() wants a unique element id per call (locale switches
// re-render the same component with a new source).
let renderSeq = 0;

export function MermaidDiagram({ code, className }: { code: string; className?: string }) {
  const { t } = useI18n();
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSvg(null);
    loadMermaid()
      .then(async (mermaid) => {
        const { svg } = await mermaid.render(`pinka-mmd-${++renderSeq}`, code);
        if (alive) setSvg(svg);
      })
      .catch((e) => {
        // A broken diagram should never take the page down — log and hide.
        console.error("mermaid render failed", e);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  if (!svg) {
    return (
      <div
        className={
          "flex min-h-[160px] items-center justify-center rounded-lg border border-ink/8 bg-white/40 text-xs text-inkMuted " +
          (className ?? "")
        }
      >
        {t("howItWorks.diagramLoading")}
      </div>
    );
  }

  return (
    <div
      className={"overflow-x-auto rounded-lg border border-ink/8 bg-white/40 p-4 [&_svg]:mx-auto [&_svg]:max-w-full " + (className ?? "")}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
