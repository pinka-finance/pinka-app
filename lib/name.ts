// Client-side mirror of pinka_finance.norm_name / display_name_matches_identity
// (migration 20260605140000). Used only for a LIVE hint in the contribute panel
// — the backend is the source of truth for the stored display_name_verified flag.

const FOLD: Record<string, string> = {
  č: "c", ć: "c", ž: "z", š: "s", đ: "d",
  á: "a", à: "a", â: "a", ä: "a", ã: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ü: "u", ñ: "n",
};

export function normNameTokens(s: string | null | undefined): string[] {
  if (!s) return [];
  const folded = s
    .toLowerCase()
    .replace(/[čćžšđáàâäãéèêëíìîïóòôöõúùûüñ]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return folded ? folded.split(/\s+/) : [];
}

/// True when the displayed name faithfully matches the eID identity: every shown
/// token belongs to the identity name (display ⊆ identity). Empty display = true
/// (no false claim). No identity name → false.
export function displayNameMatchesIdentity(
  display: string | null | undefined,
  first: string | null | undefined,
  last: string | null | undefined,
): boolean {
  const cert = normNameTokens(`${first ?? ""} ${last ?? ""}`);
  if (cert.length === 0) return false;
  const disp = normNameTokens(display);
  if (disp.length === 0) return true;
  return disp.every((t) => cert.includes(t));
}
