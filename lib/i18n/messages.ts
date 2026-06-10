// Translation catalogue for pinka.finance. Croatian (hr) is the source of truth
// and the default; English (en) is typed against it (`Messages`) so every key
// must exist in both. Leaf values are either a plain string (with {var}
// interpolation and **bold** / `code` markup rendered via <Rich/>) or a Plural
// object selected by a `count` var. See lib/i18n/index.tsx for the runtime.

export type Plural = { one: string; few?: string; many?: string; other: string };

// Helper so plural literals infer the `Plural` type (with optional few/many) —
// lets `en` provide only {one, other} while `hr` adds {few, many}.
const p = (v: Plural): Plural => v;

const hr = {
  nav: {
    campaigns: "Kampanje",
    creators: "Za kreatore",
    howItWorks: "Kako radi",
    about: "O projektu",
    homeAria: "pinka — naslovnica",
  },
  footer: {
    copyright: "© pinka.finance",
    rail: "SEPA Instant · Monerium EURe · Gnosis",
  },
  update: {
    ready: "Nova verzija je spremna",
    hint: "Ažuriraj da je primijeniš.",
    action: "Ažuriraj",
    dismiss: "Odgodi",
  },
  seo: {
    title: "pinka — kampanje",
    description:
      "Podrži kampanje jednim skenom — SEPA Instant + Monerium EURe, bez kartičnih provizija, izravno autoru, transparentno na lancu.",
    ogImageAlt: "pinka — podrži kampanje jednim skenom",
  },
  common: {
    loading: "Učitavam…",
    allCampaigns: "Sve kampanje",
    back: "Natrag",
    myCampaigns: "Moje kampanje",
  },
  units: {
    supporters: p({
      one: "{count} podržavatelj",
      few: "{count} podržavatelja",
      many: "{count} podržavatelja",
      other: "{count} podržavatelja",
    }),
    contributions: p({
      one: "{count} uplata",
      few: "{count} uplate",
      many: "{count} uplata",
      other: "{count} uplata",
    }),
  },
  home: {
    eyebrow: "pinka.finance",
    title: "Podrži kampanje jednim skenom",
    subtitle:
      "SEPA Instant + Monerium EURe. Bez kartičnih provizija, bez čekanja — sredstva idu izravno autoru, transparentno na Gnosis lancu.",
    empty: "Trenutno nema aktivnih kampanja.",
  },
  card: {
    collected: "Prikupljeno {amount} €",
    ofGoal: "od {goal} €",
  },
  campaign: {
    notFound: "Kampanja nije pronađena.",
    supportWall: "Zid podrške",
    anonymous: "Anoniman",
    linkFallback: "poveznica",
    ofGoal: "od cilja {goal} €",
    collected: "prikupljeno",
    verifyTitle: "Provjeri na lancu",
    verifyDesc:
      "Uplate stižu izravno na Safe kampanje (EURe na Gnosis lancu). Stanje može provjeriti bilo tko — neovisno o nama.",
    eureBalance: "EURe saldo na Gnosisscanu ↗",
    inflowHistory: "Povijest priljeva (transferi) ↗",
    verifiedBadge: "Verificirano · eOsobna",
    verifiedTitle:
      "Identitet potvrđen hrvatskom e-osobnom (Certilia) — 100% verificirana osoba.",
    doubleVerifiedBadge: "Dvostruko verificirano",
    doubleVerifiedTitle:
      "Dvostruka provjera: ime iz Certilia eID-a se podudara s imenom pošiljatelja SEPA uplate.",
    bankVerifiedBadge: "Bankovno potvrđeno",
    bankVerifiedTitle: "Uplaćeno SEPA-om s imenovanog bankovnog računa.",
    types: {
      donation: "Donacija",
      crowdfund: "Crowdfunding",
      tokenization: "Tokenizacija",
      tickets: "Ulaznice",
      realestate: "Nekretnina",
      generic: "Kampanja",
    },
  },
  contribute: {
    minAmount: "Najmanji iznos je {amount} €",
    createFailed: "Neuspjelo kreiranje uplate. Pokušaj ponovno.",
    walletSentSoft:
      "Uplata poslana — pojavit će se na zidu čim se potvrdi na lancu.",
    walletFailed: "Slanje iz novčanika nije uspjelo ili je otkazano.",
    thanksTitle: "Hvala na podršci! 🙏",
    thanksDesc: "Plaćanje je potvrđeno na lancu.",
    scanTitle: "Skeniraj u bankovnoj aplikaciji",
    amountLabel: "Iznos: {amount} €",
    iban: "IBAN",
    beneficiary: "Primatelj",
    description: "Opis",
    token: "Token",
    awaiting: "Čekam potvrdu plaćanja…",
    heading: "Podrži ovu kampanju",
    tabSepa: "SEPA",
    tabOnchain: "On-chain",
    sepaBlurb: "Doniraj jednim skenom — SEPA, bez naknade.",
    onchainBlurb:
      "Pošalji EURe (Gnosis) skenom iz novčanika — izravno na lanac.",
    otherAmount: "Ostalo",
    namePlaceholder: "Ime ili nadimak (opcionalno)",
    messagePlaceholder: "Poruka uz podršku (opcionalno)",
    anonymous: "Doniraj anonimno (ne prikazuj me na zidu podrške)",
    preparing: "Pripremam…",
    supportWith: "Podrži s {amount} €",
    openingWallet: "Otvaram novčanik…",
    confirmingChain: "Potvrđujem na lancu…",
    payFromWallet: "Plati {amount} € iz DOMOVINA novčanika",
    orScanOther: "ili skeniraj drugim novčanikom",
    scanWithWallet:
      "Skeniraj novčanikom (MetaMask / Monerium) i pošalji {amount} € u EURe.",
    appearsOnWall:
      "Donacija se pojavi na zidu podrške kad stigne na lanac (~1–2 min).",
    copyAria: "Kopiraj {label}",
    verifyCta: "Prijavi se eOsobnom — uplata postaje verificirana",
    verifyDesc:
      "Prijavom hrvatskom e-osobnom (Certilia) tvoja uplata se vodi kao 100% verificirana — potvrđena osoba od Republike Hrvatske.",
    verifyOpening: "Otvaram eOsobnu…",
    verifyFailed: "Prijava eOsobnom nije uspjela ili je otkazana.",
    nameMatchOk: "Ime se podudara s eID — donacija ostaje verificirana.",
    nameMatchLost:
      "Promijenjeno ime ne odgovara eID-u — donacija neće imati oznaku verificirano.",
    verifiedAs: "Verificirano kao {name} · eOsobna",
    verifiedAnon: "Verificiran identitet · eOsobna",
  },
  permanentQr: {
    title: "Trajni QR za kampanju",
    desc: "Jedan QR, više uplata — svaka se bilježi zasebno. Podijeli ili isprintaj.",
    tabSepa: "SEPA",
    tabOnchain: "On-chain",
    free: "Slobodan iznos",
    fixedAmount: "Fiksni €",
    prefillNote: "Predloženi iznos — uplatitelj ga može promijeniti.",
    loading: "Učitavam…",
    unavailable: "Trajni SEPA QR trenutno nije dostupan.",
    sepaHint: "Skeniraj bankovnom aplikacijom i upiši iznos — vrijedi za sve uplate.",
    onchainHint: "Skeniraj novčanikom (EURe · Gnosis) i upiši iznos.",
    iban: "IBAN",
    beneficiary: "Primatelj",
    reference: "Poziv na broj",
    onchainAddr: "Primatelj",
  },
  auth: {
    title: "Prijava za kreatore",
    intro: "Odaberi način prijave — svi vode na isti račun.",
    passkey: "Prijava passkeyom",
    passkeySub: "Najbrže — Face ID / otisak, bez lozinke",
    passkeyBusy: "Provjeravam passkey…",
    passkeyNone:
      "Na ovom uređaju nema passkeya za pinka.io — prijavi se drugom metodom, pa ga dodaj u Mojim kampanjama.",
    passkeyError: "Prijava passkeyom nije uspjela. Pokušaj ponovno.",
    google: "Nastavi s Googleom",
    apple: "Nastavi s Appleom",
    oauthError: "Prijava nije uspjela. Pokušaj ponovno.",
    emailIntro: "Upiši e-mail — pošaljemo ti kod (i poveznicu) za prijavu.",
    or: "ili",
    certilia: "Prijava eOsobnom",
    certiliaSub: "Hrvatska e-osobna (Certilia)",
    certiliaBusy: "Otvaram eOsobnu…",
    certiliaError: "Prijava eOsobnom nije uspjela ili je otkazana.",
    emailPlaceholder: "ti@email.com",
    sending: "Šaljem…",
    sendCode: "Pošalji kod",
    codeIntroPre: "Poslali smo kod na ",
    codeIntroPost:
      ". Upiši ga ovdje — ili jednostavno klikni poveznicu iz maila.",
    verifying: "Provjeravam…",
    confirmSignIn: "Potvrdi i prijavi se",
    changeEmail: "Promijeni e-mail",
    resend: "Pošalji ponovno",
    errSend: "Greška pri slanju. Pokušaj ponovno.",
    errCode: "Kod nije točan ili je istekao. Provjeri i pokušaj ponovno.",
    errResend: "Greška pri ponovnom slanju.",
  },
  identity: {
    verified: "Verificiran identitet",
    verifiedTitle: "Potvrđeno hrvatskom e-osobnom (Certilia)",
    signIn: "Prijava eOsobnom",
    signInBusy: "Otvaram eOsobnu…",
    signInError: "Prijava eOsobnom nije uspjela ili je otkazana.",
    signOut: "Odjava",
  },
  kyc: {
    checking: "Provjeravam identitet…",
    title: "Za kreiranje kampanje treba eOsobna",
    intro:
      "Kampanju na pinki može otvoriti **isključivo osoba prijavljena hrvatskom e-osobnom** (Certilia Mobile ID). Time je identitet kreatora službeno potvrđen (KYC/AML) i točno se zna tko je odgovoran za kampanju. Za pregled i podršku kampanjama dovoljna je obična prijava.",
    signedInAs:
      "Trenutno si prijavljen kao {email} — nakon prijave eOsobnom nastavljaš kao verificirani korisnik.",
  },
  states: {
    draft: "nacrt",
    active: "aktivna",
    funded: "ispunjena",
    closed: "zatvorena",
    cancelled: "otkazana",
  },
  dashboard: {
    title: "Moje kampanje",
    newCampaign: "Nova kampanja",
    signOut: "Odjava",
    loadFailed: "Učitavanje kampanja nije uspjelo.",
    empty: "Još nemaš kampanja. Kreiraj prvu.",
    addPasskey: "Dodaj passkey",
    addPasskeyBusy: "Spremam passkey…",
    addPasskeyDone: "Passkey dodan — idući put prijava otiskom/Face ID-em.",
    addPasskeyError: "Dodavanje passkeya nije uspjelo. Pokušaj ponovno.",
  },
  dashboardNew: {
    title: "Nova kampanja",
    intro:
      "Dva koraka: prvo poveži **DOMOVINA wallet**, zatim detalji. Svaka kampanja dobiva **vlastiti račun** — kao zaseban bankovni račun, samo na lancu. Kampanja se kreira kao **nacrt** i ne prima uplate dok je ne aktiviraš.",
    step1Title: "1. Novčanik kampanje",
    step1Desc:
      "Poveži svoj **DOMOVINA wallet** — isti passkey-identitet koji koristiš na domovina.ai i drugim aplikacijama ekosustava. Svaka kampanja dobiva **vlastiti račun** (Safe multisig na Gnosis lancu): donacije stižu odvojeno po kampanji, a stanje i promet pratiš u walletu kao na bankovnom računu. Kontrolu nad svime imaš ti, jednim passkeyem.",
    openingWallet: "Otvaram wallet…",
    connectWallet: "Poveži DOMOVINA wallet",
    changeWallet: "Promijeni novčanik",
    ecosystemWalletLabel: "Tvoj ekosustav-wallet (zajednički identitet)",
    campaignSafeLabel: "Safe ove kampanje — ovamo stižu donacije",
    counterfactualNote:
      "**Counterfactual**: adresa već prima EURe; sam Safe se na lancu kreira tek pri prvoj isplati (bez gasa unaprijed). Vlasnik: tvoj ekosustav-passkey.",
    walletAccountNote:
      "Pri kreiranju kampanje wallet otvara **novi račun s imenom kampanje** — odmah ga vidiš u DOMOVINA walletu uz svoj glavni račun, sa stanjem i prometom u stvarnom vremenu.",
    finishing: "Otvaram račun kampanje i dovršavam kreiranje…",
    accountFailed:
      "Otvaranje računa kampanje u walletu nije uspjelo (otkazano ili blokirano). Uneseni podaci su sačuvani — pokušaj ponovno.",
    howItWorksLink: "Kako sve radi? →",
    step2Title: "2. Detalji kampanje",
    createCampaign: "Kreiraj kampanju",
    connectFailed:
      "Povezivanje s DOMOVINA walletom nije uspjelo (otkazano ili blokirano).",
  },
  form: {
    errTitleRequired: "Naslov je obavezan.",
    errSafeNotDerived: "Safe kampanje još nije izveden — poveži passkey.",
    errAddrRequired: "Odredišna Gnosis adresa (0x… 40 hex) je obavezna.",
    errGoalInvalid: "Neispravan cilj.",
    errSaveFailed: "Spremanje nije uspjelo. Provjeri podatke i pokušaj ponovno.",
    titleLabel: "Naslov kampanje",
    titleDesc:
      "Ovo ljudi prvo vide — u listi kampanja i na vrhu javne stranice. Drži ga kratkim i konkretnim (npr. „Nova sezona podcasta o ekonomiji”).",
    typeLabel: "Tip kampanje",
    typeDesc:
      "Određuje logiku i kako se kampanja predstavlja. Možeš ga kasnije promijeniti dok je nacrt.",
    descLabel: "Opis",
    descDesc:
      "Glavni tekst na javnoj stranici. Ispričaj priču: tko si, za što skupljaš i kamo točno ide novac. Više redaka je u redu — transparentnost diže povjerenje (i donacije).",
    goalLabel: "Cilj (€)",
    goalDesc:
      "Koliko želiš skupiti. **Ostavi prazno** za otvorenu donaciju bez cilja. Kad se cilj dosegne, kampanja se označi „ispunjenom”, ali i dalje prima uplate.",
    goalPlaceholder: "npr. 1000 (ili prazno)",
    minLabel: "Najmanji doprinos (€)",
    minDesc:
      "Donja granica jedne uplate. Spriječava sitne iznose. Tipično 1–5 €.",
    recurrenceLabel: "Ponavljanje (članarina)",
    recurrenceDesc:
      "Očekivani raspored za ponavljajuće podržavatelje. Pinka **ne tereti** karticu — svaku uplatu član sam odobri (trajni nalog u banci ili ponovna uplata) i može ju besplatno otkazati. Ovo samo definira **kada se uplata očekuje** pa znamo tko je aktivan, a tko je propustio ciklus. Bez naknada — pogodno i za režije/račune.",
    anchorDayLabel: "Dan u mjesecu (opcionalno)",
    anchorDayPlaceholder: "npr. 15 — prazno = od prve uplate",
    recurrences: {
      none: {
        label: "Jednokratno",
        blurb: "Bez očekivanog ponavljanja — obična donacija.",
      },
      monthly: {
        label: "Mjesečno",
        blurb:
          "Očekuje se svaki mjesec. Prazan dan = mjesec dana od svake prve uplate; upisan dan (npr. 15) = fiksno tog datuma.",
      },
      quarterly: {
        label: "Tromjesečno",
        blurb: "Očekuje se svaka 3 mjeseca od prve uplate.",
      },
      yearly: {
        label: "Godišnje",
        blurb: "Očekuje se jednom godišnje od prve uplate.",
      },
    },
    visLabel: "Vidljivost",
    visDesc:
      "Tko može vidjeti kampanju. Bez brige — kreira se kao **nacrt** i ne prima uplate dok je ručno ne aktiviraš.",
    safeLabel: "Račun kampanje (Safe na Gnosisu)",
    safeDescLocked:
      "**Zaseban račun ove kampanje** — multisig novčanik u koji stižu sve donacije kao EURe (euro-stablecoin). Izveden je iz tvog passkeya — **samo ti njime upravljaš**. „Counterfactual” znači da adresa već prima novac, a sam novčanik se na lancu kreira tek pri prvoj isplati — pa ne plaćaš gas unaprijed.",
    safeDescAccount:
      "**Zaseban račun ove kampanje.** Pri kreiranju se u tvom DOMOVINA walletu otvara novi račun (Safe multisig na Gnosis lancu) s imenom kampanje. Sve donacije stižu na njega kao EURe (euro-stablecoin), a stanje i promet pratiš u walletu — kao zaseban bankovni račun. Upravljaš njime samo ti, svojim passkeyem.",
    safePendingAccount:
      "Račun se otvara u tvom DOMOVINA walletu pri kreiranju kampanje.",
    safeDescManual:
      "EURe se prosljeđuje izravno na ovu adresu. Preporuka: Safe kojim sam upravljaš.",
    safeLockedEmpty: "Poveži DOMOVINA wallet u koraku 1.",
    advancedSummary: "Napredno — povezivanje sa sadržajem",
    advancedLinked: "· vezano uz epizodu",
    advancedOptional: "(opcionalno)",
    advancedDesc:
      "Kampanju možeš zalijepiti uz konkretan sadržaj. Za **podcast epizodu** upiši tip `podcast_episode` i kao referencu **YouTube ID** epizode — tada se panel „Podrži ovu epizodu” automatski pojavi na toj epizodi na domovina.ai. Za običnu kampanju ostavi `generic`.",
    subjectTypeLabel: "Tip subjekta",
    subjectTypePlaceholder: "generic / podcast_episode",
    subjectRefLabel: "Referenca",
    subjectRefPlaceholder: "npr. YouTube ID",
    saving: "Spremam…",
    types: {
      donation: {
        label: "Donacija",
        blurb:
          "Podržavatelji daju jer žele — bez protučinidbe i bez roka. Idealno za trajnu podršku kreatoru ili udruzi.",
      },
      crowdfund: {
        label: "Crowdfunding",
        blurb:
          "Skupljaš za konkretan projekt s ciljanim iznosom (npr. oprema, nova sezona). Postavi cilj niže.",
      },
      tokenization: {
        label: "Tokenizacija (soft)",
        blurb:
          "Svaki podržavatelj dobije on-chain potvrdu doprinosa (badge/atestacija). NIJE prenosivi vrijednosni papir — nema dividendi ni preprodaje.",
      },
      tickets: {
        label: "Ulaznice",
        blurb:
          "Prodaja ulaznica — svaka kupnja troši komad iz zalihe. Razine (ulaznice) definiraš nakon kreiranja kampanje.",
      },
      realestate: {
        label: "Nekretnina",
        blurb:
          "Grupno financiranje nekretnine. Veći iznosi obično traže provjeru identiteta (KYC) — to dolazi u kasnijoj fazi.",
      },
    },
    visibility: {
      public: {
        label: "Javna",
        blurb:
          "Vidi se na pinka.finance listi kampanja i preko izravne poveznice. Za pravu objavu.",
      },
      unlisted: {
        label: "Skrivena (na poveznicu)",
        blurb:
          "Ne pojavljuje se u listi — otvara je samo tko ima link. Dobro za uži krug ili najavu.",
      },
      private: {
        label: "Privatna",
        blurb: "Vidiš je samo ti. Za pripremu i testiranje prije objave.",
      },
    },
  },
  manage: {
    stateLabel: "stanje:",
    publicPage: "javna stranica ↗",
    activate: "Aktiviraj",
    pause: "Pauziraj",
    close: "Zatvori",
    saveChanges: "Spremi promjene",
    safe: {
      title: "Safe kampanje (custody)",
      set: "Odredišni Safe za ovu kampanju. Donacije idu na ovu adresu.",
      unset:
        "Safe još nije postavljen. Deriviraj ga iz svog passkey-a PRIJE objave — inače donacije idu na praznu adresu.",
      derive: "Deriviraj Safe iz passkey-a",
      rederive: "Ponovno deriviraj Safe",
      lockHint: "Deriviraj Safe prije aktivacije ili objave kampanje.",
      blockPublic:
        "Kampanja ne može biti javna/nelistana dok Safe nije postavljen. Prvo deriviraj Safe, pa promijeni vidljivost.",
    },
    tabs: {
      edit: "Uredi",
      tiers: "Nagrade",
      contributions: "Doprinosi",
      members: "Članovi",
      payouts: "Isplate",
    },
    tiers: {
      empty: "Nema nagrada/razina.",
      delete: "Obriši",
      namePlaceholder: "Naziv nagrade",
      pricePlaceholder: "Cijena €",
      stockPlaceholder: "Zaliha (prazno = ∞)",
      add: "Dodaj nagradu",
      kinds: {
        reward: "Nagrada",
        ticket: "Ulaznica",
        token_tranche: "Token tranša",
        none: "Bez",
      },
    },
    contribs: {
      empty: "Još nema doprinosa.",
      show: "Prikaži",
      hide: "Sakrij",
      cols: {
        date: "Datum",
        name: "Ime",
        amount: "Iznos",
        state: "Stanje",
        message: "Poruka (zid)",
      },
    },
    members: {
      empty: "Još nema ponavljajućih članova.",
      intro:
        "Ponavljajući podržavatelji — prepoznati, ne naplaćeni. Pinka ne tereti karticu; svaku uplatu član sam odobri (trajnim nalogom u svojoj banci ili ponovnom uplatom preko QR-a) i može ju besplatno otkazati kad god želi. Prikazani su uplatitelji s 2+ uplate.",
      anonymous: "Anoniman",
      cancel: "Otkaži",
      cancelConfirm:
        "Označiti ovog člana kao otkazanog? Sljedeća uplata automatski ga ponovno aktivira.",
      cols: {
        name: "Ime",
        status: "Status",
        cadence: "Učestalost",
        count: "Uplata",
        total: "Ukupno",
        last: "Zadnja",
        next: "Očekivano",
      },
      statuses: {
        active: "Aktivan",
        lapsed: "Neaktivan",
        cancelled: "Otkazan",
      },
      cadences: {
        monthly: "Mjesečno",
        quarterly: "Tromjesečno",
        yearly: "Godišnje",
        irregular: "Neredovito",
        unknown: "—",
      },
    },
    payouts: {
      intro:
        "EURe stiže izravno na odredišni Safe kampanje. Isplata (Monerium redeem u SEPA) pokreće se preko Safe-a / ops procesa — ovdje je povijest.",
      empty: "Nema zabilježenih isplata.",
    },
  },
  howItWorks: {
    seoTitle: "pinka — kako radi",
    title: "Kako pinka radi",
    intro:
      "Svaka kampanja na pinki ima **vlastiti račun** — kao zaseban bankovni račun, samo što živi na lancu. Bez kartičnih provizija, bez posrednika koji drži novac: donacije idu izravno tebi, a svatko ih može provjeriti. Evo cijele slike, korak po korak.",
    identityTitle: "Jedan identitet, više računa",
    identityBody:
      "Tvoj **DOMOVINA wallet** radi kao moderna bankovna aplikacija: jedna prijava (passkey — Face ID ili otisak prsta, bez lozinki) i pod njom više računa. Glavni račun za svakodnevicu, plus **po jedan račun za svaku kampanju**. Tehnički, svaki račun je **Safe multisig** novčanik na Gnosis lancu — industrijski standard za čuvanje sredstava on-chain — a upravljaš njime isključivo ti, svojim passkeyem.",
    identityDiagramTitle: "Identitet i računi",
    donateTitle: "Kako donacija stiže",
    donateBody:
      "Podržavatelj plaća na dva načina: **SEPA uplatom** iz svoje bankovne aplikacije (skenira QR kod — bez kartica, bez provizija) ili **on-chain** izravno iz svog novčanika. U oba slučaja novac na račun kampanje sjeda kao **EURe** — digitalni euro reguliranog izdavatelja (Monerium), 1:1 vezan uz euro. Pinka nikad ne drži novac: on putuje od podržavatelja izravno na račun tvoje kampanje.",
    donateDiagramTitle: "Tok donacije",
    payoutTitle: "Isplata na tvoj IBAN",
    payoutBody:
      "Kad želiš isplatu, EURe s računa kampanje pretvaraš natrag u eure na svom bankovnom računu (Monerium otkup u SEPA). Svaku isplatu odobravaš svojim passkeyem — nitko je drugi ne može pokrenuti.",
    payoutDiagramTitle: "Tok isplate",
    transparencyTitle: "Zašto je ovo transparentno i sigurno",
    bullet1:
      "**Samo ti upravljaš računom.** Račun kampanje je Safe multisig čiji je vlasnik tvoj passkey. Ni pinka ni itko treći ne može pomaknuti sredstva.",
    bullet2:
      "**Sve je javno provjerljivo.** Stanje i svaki priljev računa kampanje vidljivi su na Gnosis lancu (Gnosisscan) — neovisno o nama. Donatori ne moraju vjerovati, mogu provjeriti.",
    bullet3:
      "**Bez naknada unaprijed.** Adresa računa prima novac od prvog dana, a na lancu se račun stvara tek pri prvoj isplati — pa nema troška dok kampanja ne proradi.",
    bullet4:
      "**Pratiš sve u walletu.** Svaka kampanja ti se u DOMOVINA walletu vodi kao zaseban račun, sa stanjem i prometom u stvarnom vremenu — kao u bankovnoj aplikaciji.",
    openSourceTitle: "100% otvoreni kod",
    openSourceBody:
      "Transparentnost ne staje na lancu — vrijedi i za softver. Sve što ovdje vidiš je **javno i otvoreno (MIT licenca)**: aplikacija, wallet, pa i landing. Kod možeš pročitati, provjeriti i pokrenuti sam:",
    repoApp: "pinka aplikacija — ova stranica: kampanje, checkout, dashboard",
    repoWallet: "DOMOVINA wallet — passkey novčanik i SEPA ↔ EURe rail",
    repoLanding: "pinka.finance — landing stranica",
    repoMvp: "pinka MVP — pametni ugovori i rani eksperimenti",
    whiteLabelTitle: "Napravi svoju Pinku",
    whiteLabelBody:
      "Želiš **vlastitu platformu za kampanje ili vlastiti wallet pod svojim brandom** — za udrugu, župu, klub, medij ili zajednicu? Forkaj i prilagodi: boje, ime, domena — sve je tvoje.",
    consultingBody:
      "A ako želiš da to **napravimo mi**: postavljanje tvoje platforme s tvojim brandingom nudimo kao paketiranu uslugu razvojnog konzaltinga — ti dobiješ platformu ključ u ruke (i uredan konzultantski račun), mi se pobrinemo za sve tehničko.",
    contactCta: "Javi nam se",
    ctaTitle: "Spreman pokrenuti kampanju?",
    cta: "Kreiraj kampanju",
    diagramLoading: "Učitavam dijagram…",
  },
  notFound: {
    code: "404",
  },
};

export type Messages = typeof hr;

const en: Messages = {
  nav: {
    campaigns: "Campaigns",
    creators: "For creators",
    howItWorks: "How it works",
    about: "About",
    homeAria: "pinka — home",
  },
  footer: {
    copyright: "© pinka.finance",
    rail: "SEPA Instant · Monerium EURe · Gnosis",
  },
  update: {
    ready: "A new version is ready",
    hint: "Refresh to apply it.",
    action: "Refresh",
    dismiss: "Later",
  },
  seo: {
    title: "pinka — campaigns",
    description:
      "Support campaigns with a single scan — SEPA Instant + Monerium EURe, no card fees, directly to the creator, transparently on-chain.",
    ogImageAlt: "pinka — support campaigns with a single scan",
  },
  common: {
    loading: "Loading…",
    allCampaigns: "All campaigns",
    back: "Back",
    myCampaigns: "My campaigns",
  },
  units: {
    supporters: p({ one: "{count} supporter", other: "{count} supporters" }),
    contributions: p({
      one: "{count} contribution",
      other: "{count} contributions",
    }),
  },
  home: {
    eyebrow: "pinka.finance",
    title: "Support campaigns with a single scan",
    subtitle:
      "SEPA Instant + Monerium EURe. No card fees, no waiting — funds go straight to the creator, transparently on the Gnosis chain.",
    empty: "No active campaigns right now.",
  },
  card: {
    collected: "Raised {amount} €",
    ofGoal: "of {goal} €",
  },
  campaign: {
    notFound: "Campaign not found.",
    supportWall: "Support wall",
    anonymous: "Anonymous",
    linkFallback: "link",
    ofGoal: "of {goal} € goal",
    collected: "raised",
    verifyTitle: "Verify on-chain",
    verifyDesc:
      "Funds arrive directly to the campaign Safe (EURe on the Gnosis chain). Anyone can check the balance — independently of us.",
    eureBalance: "EURe balance on Gnosisscan ↗",
    inflowHistory: "Inflow history (transfers) ↗",
    verifiedBadge: "Verified · eID",
    verifiedTitle:
      "Identity confirmed with the Croatian eID (Certilia) — a 100% verified person.",
    doubleVerifiedBadge: "Double-verified",
    doubleVerifiedTitle:
      "Double check: the Certilia eID name matches the SEPA payment sender's name.",
    bankVerifiedBadge: "Bank-verified",
    bankVerifiedTitle: "Paid via SEPA from a named bank account.",
    types: {
      donation: "Donation",
      crowdfund: "Crowdfunding",
      tokenization: "Tokenization",
      tickets: "Tickets",
      realestate: "Real estate",
      generic: "Campaign",
    },
  },
  contribute: {
    minAmount: "Minimum amount is {amount} €",
    createFailed: "Couldn't create the payment. Please try again.",
    walletSentSoft:
      "Payment sent — it will appear on the wall once confirmed on-chain.",
    walletFailed: "Sending from the wallet failed or was cancelled.",
    thanksTitle: "Thank you for your support! 🙏",
    thanksDesc: "The payment has been confirmed on-chain.",
    scanTitle: "Scan in your banking app",
    amountLabel: "Amount: {amount} €",
    iban: "IBAN",
    beneficiary: "Beneficiary",
    description: "Reference",
    token: "Token",
    awaiting: "Waiting for payment confirmation…",
    heading: "Support this campaign",
    tabSepa: "SEPA",
    tabOnchain: "On-chain",
    sepaBlurb: "Donate with a single scan — SEPA, no fees.",
    onchainBlurb:
      "Send EURe (Gnosis) by scanning from your wallet — straight on-chain.",
    otherAmount: "Other",
    namePlaceholder: "Name or nickname (optional)",
    messagePlaceholder: "Message with your support (optional)",
    anonymous: "Donate anonymously (don't show me on the support wall)",
    preparing: "Preparing…",
    supportWith: "Support with {amount} €",
    openingWallet: "Opening wallet…",
    confirmingChain: "Confirming on-chain…",
    payFromWallet: "Pay {amount} € from the DOMOVINA wallet",
    orScanOther: "or scan with another wallet",
    scanWithWallet:
      "Scan with a wallet (MetaMask / Monerium) and send {amount} € in EURe.",
    appearsOnWall:
      "The donation appears on the support wall once it lands on-chain (~1–2 min).",
    copyAria: "Copy {label}",
    verifyCta: "Sign in with eID — make your payment verified",
    verifyDesc:
      "By signing in with the Croatian eID (Certilia) your payment is recorded as 100% verified — a person confirmed by the Republic of Croatia.",
    verifyOpening: "Opening eID…",
    verifyFailed: "eID sign-in failed or was cancelled.",
    nameMatchOk: "Name matches your eID — the donation stays verified.",
    nameMatchLost:
      "The edited name doesn't match your eID — the donation won't be marked verified.",
    verifiedAs: "Verified as {name} · eID",
    verifiedAnon: "Verified identity · eID",
  },
  permanentQr: {
    title: "Permanent campaign QR",
    desc: "One QR, many payments — each recorded separately. Share or print it.",
    tabSepa: "SEPA",
    tabOnchain: "On-chain",
    free: "Any amount",
    fixedAmount: "Fixed €",
    prefillNote: "Suggested amount — the payer can still change it.",
    loading: "Loading…",
    unavailable: "The permanent SEPA QR is currently unavailable.",
    sepaHint: "Scan with your banking app and enter the amount — works for every payment.",
    onchainHint: "Scan with a wallet (EURe · Gnosis) and enter the amount.",
    iban: "IBAN",
    beneficiary: "Beneficiary",
    reference: "Reference",
    onchainAddr: "Recipient",
  },
  auth: {
    title: "Creator sign-in",
    intro: "Pick a sign-in method — they all lead to the same account.",
    passkey: "Sign in with a passkey",
    passkeySub: "Fastest — Face ID / fingerprint, no password",
    passkeyBusy: "Checking passkey…",
    passkeyNone:
      "No passkey for pinka.io on this device — sign in another way, then add one in My campaigns.",
    passkeyError: "Passkey sign-in failed. Please try again.",
    google: "Continue with Google",
    apple: "Continue with Apple",
    oauthError: "Sign-in failed. Please try again.",
    emailIntro: "Enter your email — we'll send you a code (and a link) to sign in.",
    or: "or",
    certilia: "Sign in with eID",
    certiliaSub: "Croatian eID (Certilia)",
    certiliaBusy: "Opening eID…",
    certiliaError: "eID sign-in failed or was cancelled.",
    emailPlaceholder: "you@email.com",
    sending: "Sending…",
    sendCode: "Send code",
    codeIntroPre: "We sent a code to ",
    codeIntroPost: ". Enter it here — or just click the link in the email.",
    verifying: "Verifying…",
    confirmSignIn: "Confirm and sign in",
    changeEmail: "Change email",
    resend: "Resend",
    errSend: "Error sending. Please try again.",
    errCode: "The code is incorrect or expired. Check it and try again.",
    errResend: "Error resending.",
  },
  identity: {
    verified: "Verified identity",
    verifiedTitle: "Confirmed with the Croatian eID (Certilia)",
    signIn: "Sign in with eID",
    signInBusy: "Opening eID…",
    signInError: "eID sign-in failed or was cancelled.",
    signOut: "Sign out",
  },
  kyc: {
    checking: "Checking identity…",
    title: "Creating a campaign requires the Croatian eID",
    intro:
      "A campaign on pinka can only be opened by **a person signed in with the Croatian eID** (Certilia Mobile ID). That officially confirms the creator's identity (KYC/AML), so it is always clear who is responsible for the campaign. Browsing and supporting campaigns works with any sign-in.",
    signedInAs:
      "You're currently signed in as {email} — after the eID sign-in you continue as your verified account.",
  },
  states: {
    draft: "draft",
    active: "active",
    funded: "funded",
    closed: "closed",
    cancelled: "cancelled",
  },
  dashboard: {
    title: "My campaigns",
    newCampaign: "New campaign",
    signOut: "Sign out",
    loadFailed: "Failed to load campaigns.",
    empty: "You don't have any campaigns yet. Create your first one.",
    addPasskey: "Add a passkey",
    addPasskeyBusy: "Saving passkey…",
    addPasskeyDone: "Passkey added — next time sign in with Face ID / fingerprint.",
    addPasskeyError: "Adding the passkey failed. Please try again.",
  },
  dashboardNew: {
    title: "New campaign",
    intro:
      "Two steps: first connect your **DOMOVINA wallet**, then the details. Every campaign gets **its own account** — like a separate bank account, just on-chain. The campaign is created as a **draft** and won't accept payments until you activate it.",
    step1Title: "1. Campaign wallet",
    step1Desc:
      "Connect your **DOMOVINA wallet** — the same passkey identity you use on domovina.ai and other ecosystem apps. Every campaign gets **its own account** (a Safe multisig on Gnosis chain): donations arrive separately per campaign, and you track the balance and activity in the wallet like a bank account. You keep full control with a single passkey.",
    openingWallet: "Opening wallet…",
    connectWallet: "Connect DOMOVINA wallet",
    changeWallet: "Change wallet",
    ecosystemWalletLabel: "Your ecosystem wallet (shared identity)",
    campaignSafeLabel: "This campaign's Safe — donations arrive here",
    counterfactualNote:
      "**Counterfactual**: the address already receives EURe; the Safe itself is created on-chain only at the first payout (no gas upfront). Owner: your ecosystem passkey.",
    walletAccountNote:
      "When you create the campaign, the wallet opens a **new account named after it** — you'll see it in your DOMOVINA wallet next to your main account, with the balance and activity in real time.",
    finishing: "Opening the campaign account and finishing creation…",
    accountFailed:
      "Opening the campaign account in the wallet failed (cancelled or blocked). Your input is preserved — try again.",
    howItWorksLink: "How does it all work? →",
    step2Title: "2. Campaign details",
    createCampaign: "Create campaign",
    connectFailed:
      "Connecting to the DOMOVINA wallet failed (cancelled or blocked).",
  },
  form: {
    errTitleRequired: "Title is required.",
    errSafeNotDerived: "The campaign Safe isn't derived yet — connect a passkey.",
    errAddrRequired: "A destination Gnosis address (0x… 40 hex) is required.",
    errGoalInvalid: "Invalid goal.",
    errSaveFailed: "Saving failed. Check the data and try again.",
    titleLabel: "Campaign title",
    titleDesc:
      "This is what people see first — in the campaign list and at the top of the public page. Keep it short and concrete (e.g. “New season of an economics podcast”).",
    typeLabel: "Campaign type",
    typeDesc:
      "Determines the logic and how the campaign is presented. You can change it later while it's a draft.",
    descLabel: "Description",
    descDesc:
      "The main text on the public page. Tell the story: who you are, what you're raising for and exactly where the money goes. Multiple paragraphs are fine — transparency builds trust (and donations).",
    goalLabel: "Goal (€)",
    goalDesc:
      "How much you want to raise. **Leave empty** for an open-ended donation with no goal. When the goal is reached the campaign is marked “funded”, but still accepts payments.",
    goalPlaceholder: "e.g. 1000 (or empty)",
    minLabel: "Minimum contribution (€)",
    minDesc:
      "The lower bound of a single payment. Prevents tiny amounts. Typically 1–5 €.",
    recurrenceLabel: "Recurrence (membership)",
    recurrenceDesc:
      "The expected schedule for recurring supporters. Pinka **never charges** a card — the member approves each payment themselves (a standing order at their bank, or paying again) and can cancel for free. This only defines **when a payment is expected** so we know who is active vs. who skipped a cycle. No fees — also suitable for utility bills.",
    anchorDayLabel: "Day of month (optional)",
    anchorDayPlaceholder: "e.g. 15 — empty = from first payment",
    recurrences: {
      none: {
        label: "One-off",
        blurb: "No expected recurrence — a plain donation.",
      },
      monthly: {
        label: "Monthly",
        blurb:
          "Expected every month. Empty day = one month from each first payment; a set day (e.g. 15) = fixed on that date.",
      },
      quarterly: {
        label: "Quarterly",
        blurb: "Expected every 3 months from the first payment.",
      },
      yearly: {
        label: "Yearly",
        blurb: "Expected once a year from the first payment.",
      },
    },
    visLabel: "Visibility",
    visDesc:
      "Who can see the campaign. No worries — it's created as a **draft** and won't accept payments until you activate it manually.",
    safeLabel: "Campaign account (Safe on Gnosis)",
    safeDescLocked:
      "**This campaign's own account** — a multisig wallet where all donations arrive as EURe (a euro stablecoin). It's derived from your passkey — **only you control it**. “Counterfactual” means the address already receives money, while the wallet itself is created on-chain only at the first payout — so you don't pay gas upfront.",
    safeDescAccount:
      "**This campaign's own account.** When you create the campaign, a new account (a Safe multisig on Gnosis chain) named after it is opened in your DOMOVINA wallet. All donations arrive on it as EURe (a euro stablecoin), and you track the balance and activity in the wallet — like a separate bank account. Only you control it, with your passkey.",
    safePendingAccount:
      "The account is opened in your DOMOVINA wallet when you create the campaign.",
    safeDescManual:
      "EURe is forwarded directly to this address. Recommended: a Safe you control yourself.",
    safeLockedEmpty: "Connect your DOMOVINA wallet in step 1.",
    advancedSummary: "Advanced — link to content",
    advancedLinked: "· linked to an episode",
    advancedOptional: "(optional)",
    advancedDesc:
      "You can attach the campaign to specific content. For a **podcast episode** set the type to `podcast_episode` and use the episode's **YouTube ID** as the reference — then the “Support this episode” panel appears automatically on that episode on domovina.ai. For a regular campaign leave `generic`.",
    subjectTypeLabel: "Subject type",
    subjectTypePlaceholder: "generic / podcast_episode",
    subjectRefLabel: "Reference",
    subjectRefPlaceholder: "e.g. YouTube ID",
    saving: "Saving…",
    types: {
      donation: {
        label: "Donation",
        blurb:
          "Supporters give because they want to — no reward, no deadline. Ideal for ongoing support of a creator or association.",
      },
      crowdfund: {
        label: "Crowdfunding",
        blurb:
          "You raise for a concrete project with a target amount (e.g. equipment, a new season). Set the goal below.",
      },
      tokenization: {
        label: "Tokenization (soft)",
        blurb:
          "Every supporter gets an on-chain proof of contribution (badge/attestation). It is NOT a transferable security — no dividends or resale.",
      },
      tickets: {
        label: "Tickets",
        blurb:
          "Ticket sales — each purchase consumes one item from stock. You define the tiers (tickets) after creating the campaign.",
      },
      realestate: {
        label: "Real estate",
        blurb:
          "Group financing of real estate. Larger amounts usually require identity verification (KYC) — that comes in a later phase.",
      },
    },
    visibility: {
      public: {
        label: "Public",
        blurb:
          "Visible on the pinka.finance campaign list and via the direct link. For a real launch.",
      },
      unlisted: {
        label: "Unlisted (link only)",
        blurb:
          "Doesn't appear in the list — only someone with the link can open it. Good for a small circle or an announcement.",
      },
      private: {
        label: "Private",
        blurb: "Only you can see it. For preparation and testing before launch.",
      },
    },
  },
  manage: {
    stateLabel: "state:",
    publicPage: "public page ↗",
    activate: "Activate",
    pause: "Pause",
    close: "Close",
    saveChanges: "Save changes",
    safe: {
      title: "Campaign Safe (custody)",
      set: "Destination Safe for this campaign. Donations go to this address.",
      unset:
        "Safe is not set yet. Derive it from your passkey BEFORE publishing — otherwise donations go to an empty address.",
      derive: "Derive Safe from passkey",
      rederive: "Re-derive Safe",
      lockHint: "Derive the Safe before activating or publishing the campaign.",
      blockPublic:
        "The campaign cannot be public/unlisted until the Safe is set. Derive the Safe first, then change visibility.",
    },
    tabs: {
      edit: "Edit",
      tiers: "Rewards",
      contributions: "Contributions",
      members: "Members",
      payouts: "Payouts",
    },
    tiers: {
      empty: "No rewards/tiers.",
      delete: "Delete",
      namePlaceholder: "Reward name",
      pricePlaceholder: "Price €",
      stockPlaceholder: "Stock (empty = ∞)",
      add: "Add reward",
      kinds: {
        reward: "Reward",
        ticket: "Ticket",
        token_tranche: "Token tranche",
        none: "None",
      },
    },
    contribs: {
      empty: "No contributions yet.",
      show: "Show",
      hide: "Hide",
      cols: {
        date: "Date",
        name: "Name",
        amount: "Amount",
        state: "Status",
        message: "Message (wall)",
      },
    },
    members: {
      empty: "No recurring members yet.",
      intro:
        "Recurring supporters — recognised, not charged. Pinka never debits a card; the member approves each payment themselves (a standing order at their own bank, or paying again via the QR) and can cancel for free anytime. Payers with 2+ payments are shown.",
      anonymous: "Anonymous",
      cancel: "Cancel",
      cancelConfirm:
        "Mark this member as cancelled? Their next payment will automatically reactivate it.",
      cols: {
        name: "Name",
        status: "Status",
        cadence: "Frequency",
        count: "Payments",
        total: "Total",
        last: "Last",
        next: "Expected",
      },
      statuses: {
        active: "Active",
        lapsed: "Lapsed",
        cancelled: "Cancelled",
      },
      cadences: {
        monthly: "Monthly",
        quarterly: "Quarterly",
        yearly: "Yearly",
        irregular: "Irregular",
        unknown: "—",
      },
    },
    payouts: {
      intro:
        "EURe arrives directly to the campaign's destination Safe. The payout (Monerium redeem to SEPA) is triggered via the Safe / ops process — here is the history.",
      empty: "No payouts recorded yet.",
    },
  },
  howItWorks: {
    seoTitle: "pinka — how it works",
    title: "How pinka works",
    intro:
      "Every campaign on pinka has **its own account** — like a separate bank account, except it lives on-chain. No card fees, no middleman holding the money: donations go directly to you, and anyone can verify them. Here's the whole picture, step by step.",
    identityTitle: "One identity, many accounts",
    identityBody:
      "Your **DOMOVINA wallet** works like a modern banking app: one sign-in (a passkey — Face ID or fingerprint, no passwords) with multiple accounts under it. A main account for everyday use, plus **one account per campaign**. Technically, each account is a **Safe multisig** wallet on Gnosis chain — the industry standard for holding funds on-chain — and only you control it, with your passkey.",
    identityDiagramTitle: "Identity and accounts",
    donateTitle: "How a donation arrives",
    donateBody:
      "A supporter pays in one of two ways: a **SEPA payment** from their banking app (scanning a QR code — no cards, no fees) or **on-chain** directly from their wallet. Either way, the money lands on the campaign account as **EURe** — a digital euro from a regulated issuer (Monerium), pegged 1:1 to the euro. Pinka never holds the money: it travels from the supporter straight to your campaign's account.",
    donateDiagramTitle: "Donation flow",
    payoutTitle: "Payout to your IBAN",
    payoutBody:
      "When you want a payout, you convert EURe from the campaign account back to euros on your bank account (Monerium redeem to SEPA). You approve every payout with your passkey — nobody else can trigger one.",
    payoutDiagramTitle: "Payout flow",
    transparencyTitle: "Why this is transparent and safe",
    bullet1:
      "**Only you control the account.** The campaign account is a Safe multisig owned by your passkey. Neither pinka nor any third party can move the funds.",
    bullet2:
      "**Everything is publicly verifiable.** The campaign account's balance and every inflow are visible on Gnosis chain (Gnosisscan) — independently of us. Donors don't have to trust, they can verify.",
    bullet3:
      "**No upfront fees.** The account address receives money from day one, while the account itself is created on-chain only at the first payout — so there's no cost until the campaign takes off.",
    bullet4:
      "**You track everything in the wallet.** Each campaign shows up in your DOMOVINA wallet as a separate account, with its balance and activity in real time — like in a banking app.",
    openSourceTitle: "100% open source",
    openSourceBody:
      "Transparency doesn't stop at the chain — it applies to the software too. Everything you see here is **public and open (MIT license)**: the app, the wallet, even the landing page. You can read, audit and run the code yourself:",
    repoApp: "pinka app — this site: campaigns, checkout, dashboard",
    repoWallet: "DOMOVINA wallet — passkey wallet and the SEPA ↔ EURe rail",
    repoLanding: "pinka.finance — landing page",
    repoMvp: "pinka MVP — smart contracts and early experiments",
    whiteLabelTitle: "Build your own Pinka",
    whiteLabelBody:
      "Want **your own campaign platform or your own wallet under your brand** — for an association, parish, club, media outlet or community? Fork and customize: colors, name, domain — it's all yours.",
    consultingBody:
      "And if you'd rather **we build it for you**: we offer setting up your branded platform as a productized development-consulting service — you get a turnkey platform (and a proper consulting invoice), we take care of everything technical.",
    contactCta: "Get in touch",
    ctaTitle: "Ready to start a campaign?",
    cta: "Create a campaign",
    diagramLoading: "Loading diagram…",
  },
  notFound: {
    code: "404",
  },
};

export const messages = { hr, en };
export type Locale = keyof typeof messages;
