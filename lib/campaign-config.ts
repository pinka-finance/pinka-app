import type { CampaignType } from "@/lib/pinka";
import type { CampaignFormValues, Recurrence } from "@/components/dashboard/campaign-form";
import { fmtEur } from "@/lib/format";

// "pinka.campaign.v1" — prijenosni format konfiguracije kampanje za AI flow:
// korisnik kopira predložak (buildAiPrompt) u ChatGPT/Claude/Gemini, iterira
// tamo, pa JSON zalijepi natrag. Parser je TOLERANTAN na ulaz (code fences,
// tekst oko JSON-a), ali STROG na sadržaj: samo whitelistana content polja,
// svako validirano istim pravilima kao forma. Sigurnosno kritično: uvoz NIKAD
// ne dira destinationAddress / metadata / state — to nisu content polja i
// zalijepljeni config ne smije moći preusmjeriti novac.

export const CONFIG_VERSION = "pinka.campaign.v1";

const TYPES: CampaignType[] = ["donation", "crowdfund", "tokenization", "tickets", "realestate"];
const VISIBILITIES = ["public", "unlisted", "private"] as const;
const RECURRENCES: Recurrence[] = ["none", "monthly", "quarterly", "yearly"];

/// Jedno uvezeno polje, spremno za review tablicu (prihvati/zadrži po polju).
export interface ImportField {
  key: string; // stabilni id reda (config ključ)
  labelKey: string; // i18n ključ naziva polja (form.*)
  display: string; // formatirana uvezena vrijednost za prikaz
  patch: Partial<CampaignFormValues> | null; // null = nevaljano, ne može se primijeniti
  errorKey: string | null; // i18n ključ greške kad je patch null
}

export interface ImportResult {
  versionOk: boolean;
  fields: ImportField[]; // samo ključevi prisutni u zalijepljenom JSON-u
  ignoredKeys: string[]; // nepoznati/nedopušteni ključevi (npr. destination)
}

// Izvuče JSON objekt iz sirovog teksta: čisti paste, ```json fence, ili JSON
// zatrpan tekstom (prvi '{' … zadnji '}').
function extractJson(text: string): Record<string, unknown> | null {
  const candidates: string[] = [];
  const trimmed = text.trim();
  if (trimmed) candidates.push(trimmed);
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* sljedeći kandidat */
    }
  }
  return null;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function field(
  key: string,
  labelKey: string,
  display: string,
  patch: Partial<CampaignFormValues> | null,
  errorKey: string | null = null,
): ImportField {
  return { key, labelKey, display, patch, errorKey };
}

const show = (v: unknown): string => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 90 ? s.slice(0, 87) + "…" : s;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T12:00:00");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/// Parsira zalijepljeni tekst u per-field review rezultat; null = nema JSON-a.
export function parseCampaignConfig(text: string): ImportResult | null {
  const json = extractJson(text);
  if (!json) return null;

  const fields: ImportField[] = [];
  const ignoredKeys: string[] = [];
  const known = new Set([
    "version", "title", "type", "description", "goal_eur", "min_contribution_eur",
    "visibility", "recurrence", "recurrence_anchor_day", "location",
    "starts_at", "ends_at", "subject_type", "subject_ref", "cover_image_url",
  ]);
  for (const k of Object.keys(json)) if (!known.has(k)) ignoredKeys.push(k);

  if ("title" in json) {
    const v = str(json.title)?.trim() ?? "";
    fields.push(
      v.length >= 3 && v.length <= 160
        ? field("title", "form.titleLabel", show(v), { title: v })
        : field("title", "form.titleLabel", show(json.title), null,
            v.length < 3 ? "form.errTitleShort" : "form.errTitleLong"),
    );
  }
  if ("type" in json) {
    const v = str(json.type);
    fields.push(
      v && (TYPES as string[]).includes(v)
        ? field("type", "form.typeLabel", v, { type: v as CampaignType })
        : field("type", "form.typeLabel", show(json.type), null, "form.errImportEnum"),
    );
  }
  if ("description" in json) {
    const v = str(json.description)?.trim() ?? "";
    fields.push(
      v && v.length <= 20000
        ? field("description", "form.descLabel", show(v), { description: v })
        : field("description", "form.descLabel", show(json.description), null, "form.errDescLong"),
    );
  }
  if ("goal_eur" in json) {
    if (json.goal_eur === null) {
      fields.push(field("goal_eur", "form.goalLabel", "—", { goalCents: null }));
    } else {
      const v = num(json.goal_eur);
      const cents = v !== null ? Math.round(v * 100) : null;
      fields.push(
        cents !== null && cents >= 100 && cents <= 10000000000
          ? field("goal_eur", "form.goalLabel", `${fmtEur(cents)} €`, { goalCents: cents })
          : field("goal_eur", "form.goalLabel", show(json.goal_eur), null, "form.errGoalRange"),
      );
    }
  }
  if ("min_contribution_eur" in json) {
    const v = num(json.min_contribution_eur);
    const cents = v !== null ? Math.round(v * 100) : null;
    fields.push(
      cents !== null && cents >= 1 && cents <= 1000000
        ? field("min_contribution_eur", "form.minLabel", `${fmtEur(cents)} €`, { minContributionCents: cents })
        : field("min_contribution_eur", "form.minLabel", show(json.min_contribution_eur), null, "form.errMinInvalid"),
    );
  }
  if ("visibility" in json) {
    const v = str(json.visibility);
    fields.push(
      v && (VISIBILITIES as readonly string[]).includes(v)
        ? field("visibility", "form.visLabel", v, { visibility: v as CampaignFormValues["visibility"] })
        : field("visibility", "form.visLabel", show(json.visibility), null, "form.errImportEnum"),
    );
  }
  if ("recurrence" in json) {
    const v = str(json.recurrence);
    fields.push(
      v && (RECURRENCES as string[]).includes(v)
        ? field("recurrence", "form.recurrenceLabel", v, { recurrence: v as Recurrence })
        : field("recurrence", "form.recurrenceLabel", show(json.recurrence), null, "form.errImportEnum"),
    );
  }
  if ("recurrence_anchor_day" in json && json.recurrence_anchor_day !== null) {
    const v = num(json.recurrence_anchor_day);
    fields.push(
      v !== null && Number.isInteger(v) && v >= 1 && v <= 31
        ? field("recurrence_anchor_day", "form.anchorDayLabel", String(v), { recurrenceAnchorDay: v })
        : field("recurrence_anchor_day", "form.anchorDayLabel", show(json.recurrence_anchor_day), null, "form.errAnchorDay"),
    );
  }
  if ("location" in json && json.location !== null) {
    const loc = (typeof json.location === "object" ? json.location : {}) as Record<string, unknown>;
    const name = str(loc.name)?.trim() || null;
    const lat = num(loc.latitude);
    const lng = num(loc.longitude);
    const pairOk = (lat === null) === (lng === null);
    const rangeOk =
      lat === null || (lat >= -90 && lat <= 90 && lng !== null && lng >= -180 && lng <= 180);
    const nameOk = name === null || name.length <= 160;
    if (pairOk && rangeOk && nameOk && (name !== null || lat !== null)) {
      const display = [name, lat !== null ? `${lat}, ${lng}` : null].filter(Boolean).join(" · ");
      fields.push(
        field("location", "form.locationLabel", display, {
          locationName: name, latitude: lat, longitude: lng,
        }),
      );
    } else {
      fields.push(field("location", "form.locationLabel", show(json.location), null, "form.errLocationInvalid"));
    }
  }
  if ("starts_at" in json && json.starts_at !== null) {
    const v = str(json.starts_at) ?? "";
    fields.push(
      validDate(v)
        ? field("starts_at", "form.startsLabel", v, { startsAt: v })
        : field("starts_at", "form.startsLabel", show(json.starts_at), null, "form.errImportDate"),
    );
  }
  if ("ends_at" in json && json.ends_at !== null) {
    const v = str(json.ends_at) ?? "";
    fields.push(
      validDate(v) && v > new Date().toISOString().slice(0, 10)
        ? field("ends_at", "form.endsLabel", v, { endsAt: v })
        : field("ends_at", "form.endsLabel", show(json.ends_at), null,
            validDate(v) ? "form.errEndsPast" : "form.errImportDate"),
    );
  }
  if ("subject_type" in json) {
    const v = str(json.subject_type)?.trim() ?? "";
    fields.push(
      /^[a-z0-9_]{1,40}$/.test(v)
        ? field("subject_type", "form.subjectTypeLabel", v, { subjectType: v })
        : field("subject_type", "form.subjectTypeLabel", show(json.subject_type), null, "form.errSubjectType"),
    );
  }
  if ("cover_image_url" in json && json.cover_image_url !== null) {
    const v = str(json.cover_image_url)?.trim() ?? "";
    fields.push(
      /^https:\/\//i.test(v) && v.length <= 1000
        ? field("cover_image_url", "form.cover.label", show(v), { coverImageUrl: v })
        : field("cover_image_url", "form.cover.label", show(json.cover_image_url), null, "form.errImportUrl"),
    );
  }
  if ("subject_ref" in json && json.subject_ref !== null) {
    const v = str(json.subject_ref)?.trim() ?? "";
    fields.push(
      v.length >= 1 && v.length <= 200
        ? field("subject_ref", "form.subjectRefLabel", v, { subjectRef: v })
        : field("subject_ref", "form.subjectRefLabel", show(json.subject_ref), null, "form.errSubjectRefLong"),
    );
  }

  return {
    versionOk: json.version === CONFIG_VERSION,
    fields,
    ignoredKeys,
  };
}

/// Trenutačno stanje forme → prenosivi JSON (za "izvezi pa iteriraj u AI chatu").
export function exportCampaignConfig(v: CampaignFormValues): string {
  const config: Record<string, unknown> = { version: CONFIG_VERSION };
  if (v.title.trim()) config.title = v.title.trim();
  config.type = v.type;
  if (v.description.trim()) config.description = v.description.trim();
  config.goal_eur = v.goalCents !== null ? v.goalCents / 100 : null;
  config.min_contribution_eur = v.minContributionCents / 100;
  config.visibility = v.visibility;
  config.recurrence = v.recurrence;
  if (v.recurrenceAnchorDay !== null) config.recurrence_anchor_day = v.recurrenceAnchorDay;
  if (v.locationName || v.latitude !== null) {
    config.location = {
      ...(v.locationName ? { name: v.locationName } : {}),
      ...(v.latitude !== null ? { latitude: v.latitude, longitude: v.longitude } : {}),
    };
  }
  if (v.coverImageUrl) config.cover_image_url = v.coverImageUrl;
  if (v.startsAt) config.starts_at = v.startsAt;
  if (v.endsAt) config.ends_at = v.endsAt;
  if (v.subjectType && v.subjectType !== "generic") config.subject_type = v.subjectType;
  if (v.subjectRef) config.subject_ref = v.subjectRef;
  return JSON.stringify(config, null, 2);
}

const SCHEMA_BLOCK = `{
  "version": "${CONFIG_VERSION}",
  "title": "string, 3-160 znakova",
  "type": "donation | crowdfund | tokenization | tickets | realestate",
  "description": "string, glavni tekst javne stranice, smije imati više odlomaka (\\n), max 20000",
  "goal_eur": "number | null — ciljani iznos u eurima (1 do 100000000); null = otvorena kampanja bez cilja",
  "min_contribution_eur": "number — najmanja pojedinačna uplata u eurima (0.01 do 10000), tipično 1-5",
  "visibility": "public | unlisted | private",
  "recurrence": "none | monthly | quarterly | yearly — očekivani ritam članarine (pinka NIKAD ne tereti sama)",
  "recurrence_anchor_day": "number | null — samo uz monthly: fiksni dan u mjesecu 1-31",
  "location": "{ \\"name\\": string, \\"latitude\\": number, \\"longitude\\": number } | null — samo ako kampanja ima fizičku lokaciju",
  "starts_at": "YYYY-MM-DD | null",
  "ends_at": "YYYY-MM-DD | null — rok kampanje, mora biti u budućnosti",
  "subject_type": "izostavi (ili \\"podcast_episode\\" uz subject_ref = YouTube ID)",
  "subject_ref": "izostavi osim uz subject_type"
}`;

const PROMPT_HR = `Pomažeš mi pripremiti kampanju na pinka.io — hrvatskoj P2P crowdfunding platformi (uplate u EUR, SEPA i EURe stablecoin; bez naknada platforme; bez automatskog terećenja — članarine su dobrovoljne ponavljajuće uplate).

Tvoj zadatak:
1. Postavljaj mi pitanja dok ne razumiješ kampanju (tko sam, za što skupljam, koliko, do kada, gdje).
2. Predloži uvjerljiv naslov i opis (opis: prvo lice, konkretno kamo ide novac, više kraćih odlomaka).
3. Nakon SVAKE iteracije vrati kompletnu konfiguraciju kao JEDAN JSON code block, bez teksta unutar blocka, točno po ovoj shemi (vrijednosti opisuju pravila, ne kopiraj ih doslovno):

${SCHEMA_BLOCK}

Pravila: iznosi su brojevi u eurima; ne izmišljaj podatke koje ti nisam dao (radije pitaj); polja koja ne znaš izostavi ili stavi null; opis piši na hrvatskom osim ako tražim drukčije.

Kad budem zadovoljan/zadovoljna, zadnji JSON ću zalijepiti natrag u pinka.io i tamo pregledati svako polje prije primjene.

Moja kampanja (polazna točka):
`;

const PROMPT_EN = `You're helping me prepare a campaign on pinka.io — a Croatian P2P crowdfunding platform (payments in EUR via SEPA and the EURe stablecoin; no platform fees; no auto-charging — memberships are voluntary recurring payments).

Your task:
1. Ask me questions until you understand the campaign (who I am, what I'm raising for, how much, by when, where).
2. Propose a compelling title and description (description: first person, concrete about where the money goes, several short paragraphs).
3. After EVERY iteration return the complete configuration as ONE JSON code block, no prose inside the block, exactly per this schema (the values describe the rules — don't copy them literally):

${SCHEMA_BLOCK}

Rules: amounts are numbers in euros; never invent data I didn't give you (ask instead); omit or null any field you don't know; write the description in Croatian unless I ask otherwise.

Once I'm happy, I'll paste the final JSON back into pinka.io and review every field there before applying.

My campaign (starting point):
`;

/// Predložak za vanjski AI chat; uključuje trenutačno stanje forme kao polaznu
/// točku kad postoji (round-trip: forma → AI → forma).
export function buildAiPrompt(locale: string, current?: CampaignFormValues | null): string {
  const base = locale === "en" ? PROMPT_EN : PROMPT_HR;
  const seed = current && (current.title.trim() || current.description.trim())
    ? "```json\n" + exportCampaignConfig(current) + "\n```"
    : locale === "en" ? "(describe it in your own words here)" : "(ovdje opiši svojim riječima)";
  return base + seed + "\n";
}

/// Predložak seedan SIROVIM podacima s domovina.ai (statički link import) —
/// asistent ih semantički preoblikuje u kampanju umjesto da prepričava metapodatke.
export function buildAiPromptFromConfig(
  locale: string,
  config: Record<string, unknown>,
  kind: "episode" | "channel",
): string {
  const base = locale === "en" ? PROMPT_EN : PROMPT_HR;
  const note =
    locale === "en"
      ? `These are RAW ${kind === "episode" ? "episode" : "channel"} data auto-imported from domovina.ai — don't just rephrase the metadata: rewrite the title and description as the campaign ORGANIZER would (first person, why support matters, where the money goes), keep subject_type/subject_ref and cover_image_url exactly as they are:`
      : `Ovo su SIROVI podaci ${kind === "episode" ? "epizode" : "kanala"} automatski uvezeni s domovina.ai — nemoj samo prepričati metapodatke: preoblikuj naslov i opis kako bi ih napisao ORGANIZATOR kampanje (prvo lice, zašto podrška ima smisla, kamo ide novac), a subject_type/subject_ref i cover_image_url ostavi točno kakvi jesu:`;
  return base + note + "\n```json\n" + JSON.stringify(config, null, 2) + "\n```\n";
}
