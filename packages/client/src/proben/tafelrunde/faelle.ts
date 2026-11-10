/**
 * Erfundene Sichten fuer den Tafelrunde-Schaukasten.
 *
 * Grundlage sind die beiden aufgezeichneten Szenen der Proben
 * (`../ruestkammer/ruestkammer-szene.json` und `../kampf/kampf-szene.json`):
 * Sie stammen aus echten Bot-Partien mit fester Saat, haben also echte
 * Einheiten, echte Marken und echte Werte je Sternstufe. Was sie nicht
 * fuehren (weitere Gegner, Serien, Rangliste, Paarungen), ist hier von Hand
 * ergaenzt — nur so viel, dass jede Ansicht etwas zu zeigen hat.
 *
 * Keine Regel wird nachgerechnet: Was kaufbar ist, steht in der Szene
 * (`kaufbar`, `darfWuerfeln`, `darfLevel`) und wird nur in die Form von
 * `legalActions` gebracht. Der Schaukasten schickt ohnehin nichts ab.
 */

import type { SitzZeile, Aktion } from '../../screens/Tafelrunde';
import type { Kampfpaarung, Paarungsergebnis } from '../../minispiele/tafelrunde/KampfAnzeige';
import type {
  EigeneSicht,
  Einheit,
  FremdeSicht,
  Stufenwerte,
  TafelrundeSicht,
} from '../../minispiele/tafelrunde/sicht';
import type { Synergie, Synergiestand } from '../../minispiele/tafelrunde/Synergien';
import type { Kaempfer } from '../../minispiele/tafelrunde/zuege';

/*
 * `?raw` und `JSON.parse` statt eines JSON-Imports — derselbe Grund wie in
 * ProbeKampf.tsx: Der Client uebersetzt ohne `resolveJsonModule`.
 */
import rohRuest from '../ruestkammer/ruestkammer-szene.json?raw';
import rohKampf from '../kampf/kampf-szene.json?raw';

interface RuestSzene {
  runde: number;
  rundenGrenze: number;
  brettReihen: number;
  brettSpalten: number;
  ladenPlaetze: number;
  bankPlaetze: number;
  verschmelzZahl: number;
  maxStufe: number;
  eigenes: Omit<EigeneSicht, 'serie' | 'bereit' | 'ausRunde' | 'darfHandeln'> & {
    synergien: Synergiestand[];
  };
  gegner: {
    sitz: number;
    leben: number;
    level: number;
    ausRunde: number | null;
    brett: (Kaempfer | null)[];
    synergien: Synergiestand[];
  };
  kaufbar: number[];
  darfWuerfeln: boolean;
  darfLevel: boolean;
  katalog: Einheit[];
  stufenwerte: Record<string, Stufenwerte[]>;
  synergieTabelle: Synergie[];
}

interface KampfSzene {
  arenaReihen: number;
  zeitraffer: number;
  schrittMs: number;
  kampf: Kampfpaarung;
}

const RUEST = JSON.parse(rohRuest) as RuestSzene;
const KAMPF = JSON.parse(rohKampf) as KampfSzene;

/*
 * Zwei Einheiten des aufgezeichneten Kampfes stehen nicht im Katalog der
 * Ruestkammer-Szene. Werte abgeschrieben aus packages/game-tafelrunde/src/
 * katalog.ts — fuer eine Schauseite genuegt das, ein Vertrag lohnt nicht.
 */
const NACHTRAG: Einheit[] = [
  {
    id: 'moosheiler',
    name: 'Moosheiler',
    kosten: 1,
    rolle: 'beistand',
    marken: ['naturwesen'],
    leben: 560,
    angriff: 26,
    tempo: 0.7,
    reichweite: 2,
    ruestung: 20,
  },
  {
    id: 'knochenspaeher',
    name: 'Knochenspäher',
    kosten: 2,
    rolle: 'meuchler',
    marken: ['untot'],
    leben: 950,
    angriff: 60,
    tempo: 0.9,
    reichweite: 1,
    ruestung: 20,
  },
];

export const KATALOG: Record<string, Einheit> = Object.fromEntries(
  [...RUEST.katalog, ...NACHTRAG].map((e) => [e.id, e]),
);
export const STUFENWERTE = RUEST.stufenwerte;
export const SYNERGIE_TABELLE = RUEST.synergieTabelle;

/** Vier Sitze: ich, ein Mensch, zwei Bots — die Namen erscheinen in Leiste und Bretttitel. */
export const SITZE: SitzZeile[] = [
  { seat: 0, displayName: 'Robin', accountId: 'ich', avatarUrl: null, isBot: false },
  { seat: 1, displayName: 'Jan', accountId: 'konto-1', avatarUrl: null, isBot: false },
  { seat: 2, displayName: null, accountId: null, avatarUrl: null, isBot: true },
  { seat: 3, displayName: 'Tom', accountId: 'konto-3', avatarUrl: null, isBot: false },
];

const FELDER = RUEST.brettReihen * RUEST.brettSpalten;
const LEERES_BRETT: (Kaempfer | null)[] = Array.from({ length: FELDER }, () => null);

function gegnerAus(teil: Partial<FremdeSicht> & Pick<FremdeSicht, 'sitz'>): FremdeSicht {
  return {
    leben: 14,
    level: 3,
    serie: { art: null, laenge: 0 },
    brett: LEERES_BRETT,
    bereit: false,
    ausRunde: null,
    verlassen: false,
    synergien: [],
    ...teil,
  };
}

const GEGNER: FremdeSicht[] = [
  gegnerAus({
    sitz: 1,
    leben: RUEST.gegner.leben,
    level: RUEST.gegner.level,
    brett: RUEST.gegner.brett,
    synergien: RUEST.gegner.synergien,
    serie: { art: 'niederlage', laenge: 3 },
  }),
  gegnerAus({ sitz: 2, leben: 9, level: 4, bereit: true, brett: RUEST.gegner.brett }),
  gegnerAus({ sitz: 3, leben: 0, level: 2, ausRunde: 7 }),
];

const EIGENES: EigeneSicht = {
  ...RUEST.eigenes,
  serie: { art: 'sieg', laenge: 2 },
  bereit: false,
  ausRunde: null,
  darfHandeln: true,
};

/** Die Grundsicht: Ruestphase, Runde 9, ich bin am Zug. */
function grundsicht(teil: Partial<TafelrundeSicht> = {}): TafelrundeSicht {
  return {
    ich: 0,
    runde: RUEST.runde,
    rundenGrenze: RUEST.rundenGrenze,
    phase: 'vorbereitung',
    fertig: false,
    sieger: null,
    platzierung: [
      { sitz: 0, platz: 1, runden: RUEST.runde },
      { sitz: 1, platz: 1, runden: RUEST.runde },
      { sitz: 2, platz: 1, runden: RUEST.runde },
      { sitz: 3, platz: 4, runden: 7 },
    ],
    zuschauer: false,
    ladenPlaetze: RUEST.ladenPlaetze,
    bankPlaetze: RUEST.bankPlaetze,
    brettFelder: FELDER,
    brettReihen: RUEST.brettReihen,
    brettSpalten: RUEST.brettSpalten,
    arenaReihen: KAMPF.arenaReihen,
    verschmelzZahl: RUEST.verschmelzZahl,
    maxStufe: RUEST.maxStufe,
    vorrat: Object.fromEntries(Object.keys(KATALOG).map((id) => [id, 20])),
    eigenes: EIGENES,
    gegner: GEGNER,
    leftSeats: [],
    zeitraffer: KAMPF.zeitraffer,
    schrittMs: KAMPF.schrittMs,
    ...teil,
  };
}

/** `legalActions` in der Form des Moduls, aus den fertigen Angaben der Szene. */
function zuegeAus(eigenes: EigeneSicht): Aktion[] {
  const zuege: Aktion[] = RUEST.kaufbar.map((platz) => ({ typ: 'kaufen', platz }));
  if (RUEST.darfWuerfeln) zuege.push({ typ: 'neuwuerfeln' });
  if (RUEST.darfLevel) zuege.push({ typ: 'levelAuf' });
  eigenes.bank.forEach((k, platz) => {
    if (k) zuege.push({ typ: 'verkaufen', ort: { bereich: 'bank', platz } });
  });
  eigenes.brett.forEach((k, platz) => {
    if (k) zuege.push({ typ: 'verkaufen', ort: { bereich: 'brett', platz } });
  });
  zuege.push({ typ: 'bereit' });
  return zuege;
}

/** Alles, was die Ruestkammer ausser den Rueckrufen braucht. */
export interface Tischfall {
  sicht: TafelrundeSicht;
  legaleZuege: Aktion[];
  /** Frist der Ruestphase in Millisekunden ab dem Zeichnen, sonst null. */
  rundenfristIn: number | null;
}

const KAMPF_PAARUNGEN: Paarungsergebnis[] = [
  {
    a: KAMPF.kampf.a,
    b: KAMPF.kampf.b,
    geist: KAMPF.kampf.geist,
    sieger: KAMPF.kampf.bericht.sieger,
    schaden: KAMPF.kampf.bericht.schaden,
    dauerMs: KAMPF.kampf.bericht.dauerMs,
  },
  // Sieger ist eine Arenaseite (0 = `a`), kein Sitz — siehe KampfAnzeige.tsx.
  { a: 2, b: 3, geist: true, sieger: 0, schaden: 4, dauerMs: 9000 },
];

/** Die Tischfaelle — jeder ein Zustand der Ruestkammer. */
export const TISCHFAELLE: Record<string, () => Tischfall> = {
  /** Ruestphase, ich bin am Zug, die Uhr laeuft. */
  ruesten: () => ({ sicht: grundsicht(), legaleZuege: zuegeAus(EIGENES), rundenfristIn: 24_000 }),
  /** Nach „Bereit": Laden gesperrt, Hinweis „Auf die anderen warten". */
  bereit: () => {
    const eigenes = { ...EIGENES, bereit: true, darfHandeln: false };
    return { sicht: grundsicht({ eigenes }), legaleZuege: [], rundenfristIn: 11_000 };
  },
  /** Kampfphase: die Arena mit dem aufgezeichneten Kampf. */
  kampf: () => {
    const eigenes = { ...EIGENES, bereit: true, darfHandeln: false };
    return {
      sicht: grundsicht({
        phase: 'kampf',
        eigenes,
        gegner: GEGNER.map((g) => ({ ...g, bereit: true })),
        kaempfe: [KAMPF.kampf],
        paarungen: KAMPF_PAARUNGEN,
      }),
      legaleZuege: [],
      rundenfristIn: null,
    };
  },
  /** Ich bin ausgeschieden, die Partie laeuft weiter: Endbild mit „Zusehen". */
  ausgeschieden: () => {
    const eigenes = { ...EIGENES, leben: 0, ausRunde: 9, darfHandeln: false };
    return {
      sicht: grundsicht({
        eigenes,
        platzierung: [
          { sitz: 1, platz: 1, runden: 9 },
          { sitz: 2, platz: 1, runden: 9 },
          { sitz: 0, platz: 3, runden: 8 },
          { sitz: 3, platz: 4, runden: 7 },
        ],
      }),
      legaleZuege: [],
      rundenfristIn: null,
    };
  },
  /** Die Partie ist aus, ich habe gewonnen: Endbild und Abschluss im Fuss. */
  ende: () => {
    const eigenes = { ...EIGENES, bereit: true, darfHandeln: false };
    return {
      sicht: grundsicht({
        phase: 'ende',
        fertig: true,
        sieger: 0,
        runde: 14,
        eigenes,
        gegner: GEGNER.map((g, i) => ({ ...g, leben: 0, ausRunde: 14 - i })),
        platzierung: [
          { sitz: 0, platz: 1, runden: 14 },
          { sitz: 1, platz: 2, runden: 13 },
          { sitz: 2, platz: 3, runden: 12 },
          { sitz: 3, platz: 4, runden: 7 },
        ],
      }),
      legaleZuege: [],
      rundenfristIn: null,
    };
  },
  /** Zuschauer: kein eigener Sitz, nur die Bretter der anderen. */
  zuschauer: () => ({
    sicht: grundsicht({
      ich: null,
      zuschauer: true,
      eigenes: null,
      gegner: [
        gegnerAus({
          sitz: 0,
          leben: EIGENES.leben,
          level: EIGENES.level,
          brett: EIGENES.brett,
          synergien: EIGENES.synergien,
        }),
        ...GEGNER,
      ],
    }),
    legaleZuege: [],
    rundenfristIn: 18_000,
  }),
};
