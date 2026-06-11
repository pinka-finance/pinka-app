"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

// Upload covera u public bucket 'pinka-covers' (path mora počinjati s
// auth.uid() — storage RLS). Zamjena/uklanjanje ne briše stari objekt:
// kampanja možda već javno pokazuje taj URL, a orphan se čisti kasnije.
export function CoverUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    const ext = ACCEPT[file.type];
    if (!ext) return setError(t("form.cover.errType"));
    if (file.size > MAX_BYTES) return setError(t("form.cover.errSize"));
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) throw new Error("not_signed_in");
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("pinka-covers")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (upErr) throw upErr;
      const { data } = sb.storage.from("pinka-covers").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e) {
      console.error(e);
      setError(t("form.cover.errUpload"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(ACCEPT).join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-ink/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-44 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-ink/50 to-transparent p-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium hover:bg-white disabled:opacity-50"
            >
              {busy ? t("form.cover.uploading") : t("form.cover.replace")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange(null)}
              className="rounded-full bg-white/90 p-1.5 hover:bg-white disabled:opacity-50"
              aria-label={t("form.cover.remove")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink/20 bg-white/40 text-sm text-inkMuted hover:border-ink/40 hover:text-ink disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          {busy ? t("form.cover.uploading") : t("form.cover.upload")}
        </button>
      )}
      {error ? <p className="mt-2 text-xs leading-relaxed text-rust">{error}</p> : null}
    </div>
  );
}
