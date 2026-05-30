/// EUR formatiranje iz cent-integera (hr-locale: zarez kao decimalni separator).
export function fmtEur(cents: number): string {
  const eur = cents / 100;
  const whole = Number.isInteger(eur);
  return eur
    .toFixed(whole ? 0 : 2)
    .replace(".", ",");
}

/// Parsira korisnicki unos (npr. "12,50" ili "12.50") u cente; null ako nevaljano.
export function parseEurToCents(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
