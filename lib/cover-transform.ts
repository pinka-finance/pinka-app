import { supabaseBrowser } from "@/lib/supabase";

// Worker that resizes an arbitrary source image to the canonical pinka cover
// format (1200×630). See pinka-finance/cover-worker. Configurable so the same
// build can point at a workers.dev URL during rollout.
const WORKER_URL =
  process.env.NEXT_PUBLIC_COVER_WORKER_URL ?? "https://covers.pinka.io";

// Turn an imported source image (a 16:9 domovina.ai episode thumbnail, or an
// arbitrary channel avatar_cover) into a 1200×630 pinka cover stored in the
// pinka-covers bucket, and return its public URL.
//
// Best-effort by design: the import must still work if the Worker is down, the
// user isn't signed in, or storage rejects the write — in every failure case we
// fall back to the original URL (which the form already accepted). The transform
// runs once here; the stored copy is what gets served afterwards.
export async function materializeCover(remoteUrl: string): Promise<string> {
  try {
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return remoteUrl;

    const res = await fetch(
      `${WORKER_URL}/transform?url=${encodeURIComponent(remoteUrl)}`,
    );
    if (!res.ok) return remoteUrl;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.size === 0) return remoteUrl;

    // Same path scheme + cache policy as the manual upload (cover-upload.tsx):
    // {uid}/* satisfies the storage RLS, 1-year immutable cache.
    const path = `${u.user.id}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage
      .from("pinka-covers")
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) return remoteUrl;

    return sb.storage.from("pinka-covers").getPublicUrl(path).data.publicUrl;
  } catch {
    return remoteUrl;
  }
}
