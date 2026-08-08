// Pravni okvir primanja sredstava u RH, preveden u pravila forme.
//
// SSOT za obrazloženja i citate: `pinka-finance/landing/docs/pravni-okvir-primanja-sredstava.md`.
// Ovdje su SAMO pravila; nijedan iznos, članak ni kazna ne piše se u UI copy iz
// sjećanja — copy živi u lib/i18n/messages.ts pod `legal.*`.
//
// Tri zahtjeva koja ovaj modul implementira (P1–P3 iz dokumenta):
//   P1  tip primatelja je prvo pitanje i mijenja ostatak tijeka
//   P2  donacija fizičkoj osobi traži izbor pravne osnove
//   P3  fizička osoba NE SMIJE prikupljati za sebe ili srodnika do 2. stupnja
//       kao humanitarnu akciju — Zakon o humanitarnoj pomoći (NN 156/23) čl. 23.
//       To je tvrda blokada, ne upozorenje.

import type { CampaignType } from "@/lib/pinka";

export type RecipientType =
  | "association" // udruga
  | "foundation" // zaklada
  | "institution" // ustanova, vjerska zajednica, JLS
  | "individual" // fizička osoba
  | "company"; // trgovačko društvo / obrt

export type LegalBasis =
  | "own_activity" // redovna djelatnost neprofitne osobe (statut) — bez rješenja
  | "humanitarian" // humanitarna akcija po ZHP-u — traži rješenje
  | "public_action" // javno oglašena akcija — ZPD čl. 8/1/5, traži javni namjenski račun
  | "health" // darovanje za zdravstvene potrebe
  | "commercial"; // primatelj je u profitnom sektoru → oporezivi prihod

export type YesNo = "" | "yes" | "no";

export interface LegalDeclaration {
  recipientType: RecipientType | "";
  legalBasis: LegalBasis | "";
  /** Klasa/urbroj rješenja o odobrenju humanitarne akcije. */
  permitRef: string;
  /** ZHP čl. 23: je li korisnik organizator, njegov partner ili srodnik do 2. stupnja? */
  selfOrFamily: YesNo;
  /** Potvrda da su tvrdnje točne i da je organizator odgovoran za osnovu. */
  acknowledged: boolean;
}

export const RECIPIENT_TYPES: RecipientType[] = [
  "association",
  "foundation",
  "institution",
  "individual",
  "company",
];

export const EMPTY_DECLARATION: LegalDeclaration = {
  recipientType: "",
  legalBasis: "",
  permitRef: "",
  selfOrFamily: "",
  acknowledged: false,
};

/** Tipovi kampanje koji su po naravi darovanje (bez protučinidbe). */
const DONATIVE_TYPES: CampaignType[] = ["donation", "crowdfund"];

export function isDonative(type: CampaignType): boolean {
  return DONATIVE_TYPES.includes(type);
}

/**
 * P2 — kada uopće tražimo pravnu osnovu.
 * Fizička osoba koja prikuplja darovanja mora izabrati osnovu; za neprofitne
 * osobe je osnova implicitna (redovna djelatnost) osim ako same ne pokreću
 * humanitarnu akciju, pa im nudimo izbor ali ne blokiramo.
 */
export function requiresLegalBasis(
  recipientType: RecipientType | "",
  type: CampaignType,
): boolean {
  return recipientType === "individual" && isDonative(type);
}

/** Koje su osnove ponuđene za dani tip primatelja i kampanje. */
export function basesFor(
  recipientType: RecipientType | "",
  type: CampaignType,
): LegalBasis[] {
  if (!recipientType) return [];
  if (recipientType === "company") return ["commercial"];
  if (recipientType === "individual") {
    return isDonative(type) ? ["public_action", "humanitarian", "health"] : ["commercial"];
  }
  // udruga / zaklada / ustanova
  return isDonative(type) ? ["own_activity", "humanitarian"] : ["own_activity"];
}

/**
 * P3 — tvrda blokada. Fizička osoba ne može biti organizator humanitarne akcije
 * ako prikuplja za sebe, partnera ili srodnika do zaključno 2. stupnja
 * (ZHP NN 156/23, čl. 23). Vrijedi SAMO za humanitarnu akciju: „javno oglašena
 * akcija" iz ZPD-a upravo pretpostavlja račun osobe u potrebi, pa se tamo ne
 * blokira.
 */
export function isBlockedByArticle23(d: LegalDeclaration): boolean {
  return (
    d.recipientType === "individual" &&
    d.legalBasis === "humanitarian" &&
    d.selfOrFamily === "yes"
  );
}

/** Osnove koje traže upisanu referencu rješenja. */
export function requiresPermit(basis: LegalBasis | ""): boolean {
  return basis === "humanitarian";
}

export type LegalErrors = Partial<Record<string, string>>;

/**
 * Validacija deklaracije. Vraća mapu polje → i18n ključ, u istom obliku kao
 * ostatak forme (`check()` u campaign-form.tsx).
 */
export function checkLegal(d: LegalDeclaration, type: CampaignType): LegalErrors {
  const e: LegalErrors = {};

  // P1 — tip primatelja je uvijek obavezan.
  if (!d.recipientType) {
    e.recipientType = "legal.errRecipientRequired";
    return e; // ostalo nema smisla dok se ne zna tko prima
  }

  const bases = basesFor(d.recipientType, type);
  const needsBasis = requiresLegalBasis(d.recipientType, type);

  // P2 — osnova obavezna za fizičku osobu; za ostale samo ako ju je ponudila lista.
  if (needsBasis && !d.legalBasis) {
    e.legalBasis = "legal.errBasisRequired";
  } else if (d.legalBasis && !bases.includes(d.legalBasis)) {
    e.legalBasis = "legal.errBasisInvalid";
  }

  if (d.legalBasis === "humanitarian") {
    if (!d.selfOrFamily) {
      e.selfOrFamily = "legal.errRelationRequired";
    } else if (isBlockedByArticle23(d)) {
      // P3 — blokada; poruka objašnjava alternativu.
      e.selfOrFamily = "legal.errArticle23Blocked";
    }
    const ref = d.permitRef.trim();
    if (!ref) e.permitRef = "legal.errPermitRequired";
    else if (ref.length > 120) e.permitRef = "legal.errPermitLong";
  }

  if (needsBasis && !d.acknowledged) {
    e.legalAck = "legal.errAckRequired";
  }

  return e;
}

/** Je li deklaracija u blokiranom stanju (za onemogućavanje submita i crveni panel). */
export function isBlocked(d: LegalDeclaration): boolean {
  return isBlockedByArticle23(d);
}

/**
 * Oblik koji ide u `metadata.legal` na kampanji. Namjerno plitak i stabilan —
 * čita ga kasnije i javna stranica i eventualni izvještaji.
 * `declaredAt` postavlja pozivatelj (ISO string) da modul ostane čist.
 */
export interface LegalMetadata {
  recipient_type: RecipientType;
  legal_basis: LegalBasis | null;
  permit_ref: string | null;
  self_or_family: boolean | null;
  acknowledged: boolean;
  declared_at: string;
}

export function toMetadata(d: LegalDeclaration, declaredAt: string): LegalMetadata | null {
  if (!d.recipientType) return null;
  return {
    recipient_type: d.recipientType,
    legal_basis: d.legalBasis || null,
    permit_ref: d.legalBasis === "humanitarian" ? d.permitRef.trim() || null : null,
    self_or_family: d.selfOrFamily ? d.selfOrFamily === "yes" : null,
    acknowledged: d.acknowledged,
    declared_at: declaredAt,
  };
}

/** Obrnuti smjer — čitanje spremljene deklaracije natrag u formu (manage). */
export function fromMetadata(raw: unknown): LegalDeclaration {
  const m = raw as Partial<LegalMetadata> | null | undefined;
  if (!m || typeof m !== "object") return { ...EMPTY_DECLARATION };
  const rt = m.recipient_type;
  return {
    recipientType: RECIPIENT_TYPES.includes(rt as RecipientType) ? (rt as RecipientType) : "",
    legalBasis: (m.legal_basis as LegalBasis) || "",
    permitRef: m.permit_ref ?? "",
    selfOrFamily: m.self_or_family == null ? "" : m.self_or_family ? "yes" : "no",
    acknowledged: !!m.acknowledged,
  };
}

/**
 * Dodatna upozorenja koja se prikazuju uz odabir, ali ne blokiraju.
 * Vraća i18n ključeve (`legal.notes.*`).
 */
export function notesFor(
  recipientType: RecipientType | "",
  basis: LegalBasis | "",
  type: CampaignType,
): string[] {
  const notes: string[] = [];
  if (!recipientType) return notes;

  if (recipientType === "association" || recipientType === "foundation") {
    notes.push("legal.notes.statute");
  }
  if (recipientType === "company") {
    notes.push("legal.notes.companyTaxable");
  }
  if (recipientType === "individual" && !isDonative(type)) {
    notes.push("legal.notes.individualCommercial");
  }
  if (basis === "public_action") {
    notes.push("legal.notes.publicAction");
  }
  if (basis === "humanitarian") {
    notes.push("legal.notes.humanitarianDuties");
  }
  if (basis === "health") {
    notes.push("legal.notes.health");
  }
  if (type === "tickets") {
    notes.push("legal.notes.tickets");
  }
  if (isDonative(type)) {
    notes.push("legal.notes.unspent");
  }
  return notes;
}
