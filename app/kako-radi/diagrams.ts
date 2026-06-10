import type { Locale } from "@/lib/i18n/messages";

// Mermaid sources for the "Kako radi" explainer, per locale. These are
// content, not UI strings — kept out of the i18n catalogue on purpose (mermaid
// syntax uses characters the t() interpolation would fight with), but the
// hr/en pair must stay in sync like messages.ts.

export interface HowItWorksDiagrams {
  identity: string;
  donation: string;
  payout: string;
}

const hr: HowItWorksDiagrams = {
  identity: `graph TB
  P["Passkey<br/>(Face ID / otisak prsta)"] --> W["DOMOVINA wallet<br/>jedan identitet, kao bankovna aplikacija"]
  W --> M["Glavni račun<br/>Safe multisig · Gnosis"]
  W --> K1["Račun: Kampanja A<br/>Safe multisig · Gnosis"]
  W --> K2["Račun: Kampanja B<br/>Safe multisig · Gnosis"]
  K1 -.->|"stanje i promet<br/>u stvarnom vremenu"| W
`,
  donation: `flowchart TB
  D["Podržavatelj"] -->|"SEPA uplata<br/>QR u bankovnoj aplikaciji"| MON["Monerium<br/>regulirani izdavatelj e-novca"]
  MON -->|"EURe · digitalni euro 1:1"| S["Račun kampanje<br/>Safe multisig · Gnosis"]
  D -->|"on-chain EURe<br/>iz vlastitog novčanika"| S
  S --> V["Javno provjerljivo<br/>Gnosisscan + zid podrške"]
`,
  payout: `flowchart LR
  S["Račun kampanje<br/>EURe na Gnosisu"] -->|"isplatu odobravaš<br/>svojim passkeyem"| MON["Monerium<br/>otkup EURe"]
  MON -->|"SEPA uplata u eurima"| B["Tvoj IBAN<br/>bankovni račun"]
`,
};

const en: HowItWorksDiagrams = {
  identity: `graph TB
  P["Passkey<br/>(Face ID / fingerprint)"] --> W["DOMOVINA wallet<br/>one identity, like a banking app"]
  W --> M["Main account<br/>Safe multisig · Gnosis"]
  W --> K1["Account: Campaign A<br/>Safe multisig · Gnosis"]
  W --> K2["Account: Campaign B<br/>Safe multisig · Gnosis"]
  K1 -.->|"balance and activity<br/>in real time"| W
`,
  donation: `flowchart TB
  D["Supporter"] -->|"SEPA payment<br/>QR in their banking app"| MON["Monerium<br/>regulated e-money issuer"]
  MON -->|"EURe · digital euro 1:1"| S["Campaign account<br/>Safe multisig · Gnosis"]
  D -->|"on-chain EURe<br/>from their own wallet"| S
  S --> V["Publicly verifiable<br/>Gnosisscan + support wall"]
`,
  payout: `flowchart LR
  S["Campaign account<br/>EURe on Gnosis"] -->|"you approve the payout<br/>with your passkey"| MON["Monerium<br/>EURe redeem"]
  MON -->|"SEPA payment in euros"| B["Your IBAN<br/>bank account"]
`,
};

export function getDiagrams(locale: Locale): HowItWorksDiagrams {
  return locale === "en" ? en : hr;
}
