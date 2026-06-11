/// EUR formatiranje iz cent-integera (hr-locale: zarez kao decimalni separator).
export function fmtEur(cents: number): string {
  const eur = cents / 100;
  const whole = Number.isInteger(eur);
  return eur
    .toFixed(whole ? 0 : 2)
    .replace(".", ",");
}

/// Parsira korisnicki unos u cente; null ako nevaljano. Razumije hrvatski i
/// engleski zapis: "12,50", "12.50", "10.000", "1.234,56", "1,234.56", "1 000".
/// Heuristika za jedan separator: tocno 3 znamenke iza + bar jedna ispred
/// (i nije "0") = tisucice; inace decimala. Vise od 2 decimale = nevaljano.
export function parseEurToCents(raw: string): number | null {
  let s = raw.trim().replace(/[€\s ']/g, "");
  if (!s || !/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // oba separatora: zadnji je decimalni, drugi je za tisucice
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    if (s.split(decSep).length !== 2) return null;
    s = s.split(thouSep).join("").replace(decSep, ".");
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? "," : ".";
    const parts = s.split(sep);
    const head = parts[0] ?? "";
    const tail = parts[parts.length - 1] ?? "";
    const thousands =
      parts.length > 2 || (tail.length === 3 && head.length >= 1 && head !== "0");
    if (thousands) {
      // svaka grupa iza prve mora imati tocno 3 znamenke ("1.00.0" je nevaljano)
      if (parts.slice(1).some((p) => p.length !== 3)) return null;
      s = parts.join("");
    } else {
      s = parts.join(".");
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/// GitHub-style slug (lowercase, alfanum + crtice; rubovi alfanum), max 60.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
