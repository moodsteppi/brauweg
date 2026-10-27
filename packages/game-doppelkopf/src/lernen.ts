/**
 * Doppelkopf lernen — der Lernpfad (Emile, 17.10.2026).
 *
 * Sieben Lektionen, jede eine Folge kurzer Schritte wie bei Duolingo:
 * erklaeren, dann sofort selbst tun. Die ersten sechs laufen ohne Tisch, die
 * siebte ist eine echte Runde gegen Bots (`uebung`, siehe Server
 * `lernpfad.ts`).
 *
 * **Warum der Inhalt hier im Modul steht und nicht im Client:** Jede Aufgabe
 * hat eine richtige Antwort, und die ist eine Doppelkopf-Regel — welche Karte
 * man bedienen muss, wer den Stich bekommt, ob die Herz-Zehn Trumpf ist. Der
 * Client bildet keine Regel nach (CLAUDE.md). Also rechnet DIESE Datei die
 * Antworten mit derselben Engine aus, die am Tisch entscheidet
 * (`legalCards`, `resolveTrick`, `isTrump`, `mindestAugen`). Geschrieben
 * steht hier nur, was gefragt wird; was richtig ist, steht nirgends von Hand.
 * Aendert sich eine Regel, aendert sich die Lektion mit — und
 * `test/lernen.test.ts` faellt, wenn eine Aufgabe dadurch keine Wahl mehr
 * laesst.
 *
 * Die Lektionen gehen von den Standardregeln aus (`DEFAULT_RULESET`): mit
 * Neunen, Dulle als hoechster Trumpf, erste von zwei gleichen Karten sticht.
 * Genau das findet ein Anfaenger auch am Uebungstisch vor.
 *
 * Die Mitspieler heissen in allen Lektionen gleich, damit man sie wiedererkennt:
 * Ole links, Mia gegenueber, Kai rechts.
 */

import { type Card, type Rank, type Suit, cardValue, isFuchs, sumValues } from './cards.js';
import { type CardOrder, buildOrder, isTrump, legalCards } from './order.js';
import { mayAnnounce } from './pflichtansage.js';
import { DEFAULT_RULESET } from './ruleset.js';
import { type Party, mindestAugen } from './scoring.js';
import { resolveTrick } from './trick.js';

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

/** Sitz 0 bist du; die anderen drei tragen in jeder Lektion denselben Namen. */
export const LERN_NAMEN = ['Du', 'Ole', 'Mia', 'Kai'] as const;

/** Eine Karte im Stich, mit dem, der sie gelegt hat. */
export interface LernStichKarte {
  readonly sitz: number;
  readonly karte: Card;
}

export type LernSchritt =
  /** Lesen und weiter. `karten` zeigt eine Reihe zur Anschauung. */
  | {
      readonly art: 'erklaerung';
      readonly titel: string;
      readonly text: string;
      readonly karten?: readonly Card[];
    }
  /**
   * Eine Karte aus der Hand tippen. `richtig` sind die Kennungen aller
   * Karten, die als Antwort gelten — von der Engine ausgerechnet.
   */
  | {
      readonly art: 'waehlen';
      readonly titel: string;
      readonly text: string;
      readonly hand: readonly Card[];
      readonly stich: readonly LernStichKarte[];
      readonly richtig: readonly number[];
      /**
       * ALLE richtigen Karten antippen, dann pruefen — statt einer einzigen.
       * Fuer „Was darfst du legen?": Wer nur eine von zwei erlaubten Karten
       * findet, hat die Regel erst halb (Emile, 17.10.2026). Fehlt das Feld,
       * reicht eine richtige Karte (stechen, Fuchs legen — dort legt man eine).
       */
      readonly alle?: true;
      /** Steht da, wenn die falsche Karte getippt wurde. */
      readonly hinweis: string;
      /** Steht da, wenn es stimmt — der Satz, den man mitnehmen soll. */
      readonly merke: string;
    }
  /** Eine von mehreren Antworten tippen. */
  | {
      readonly art: 'frage';
      readonly titel: string;
      readonly text: string;
      readonly karten?: readonly Card[];
      readonly stich?: readonly LernStichKarte[];
      readonly antworten: readonly string[];
      readonly richtig: number;
      readonly hinweis: string;
      readonly merke: string;
    };

export interface Lektion {
  readonly id: string;
  readonly titel: string;
  /** Eine Zeile fuer den Pfad. */
  readonly kurz: string;
  readonly schritte: readonly LernSchritt[];
  /**
   * Die Lektion endet an einem echten Tisch: Nach den Schritten startet eine
   * Uebungsrunde gegen Bots, und erledigt ist sie erst, wenn diese Runde
   * abgerechnet ist (Server, `lernpfad.ts`).
   */
  readonly uebung?: true;
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/** Normalspiel nach den Standardregeln — die Ordnung, gegen die alles gerechnet wird. */
const ORDNUNG: CardOrder = buildOrder({ kind: 'normal' }, DEFAULT_RULESET);
const ZWEITE_DULLE = { secondDulleBeatsFirst: DEFAULT_RULESET.secondDulleBeatsFirst };

let naechsteId = 1000;

/** `k('HT')` ist die Herz-Zehn. Jede Karte bekommt eine eigene Kennung. */
function k(kennung: string): Card {
  const suit = kennung[0] as Suit;
  const rank = kennung[1] as Rank;
  if (!'CSHD'.includes(suit) || !'9JQKTA'.includes(rank) || kennung.length !== 2) {
    throw new Error(`Unbekannte Karte im Lernpfad: ${kennung}`);
  }
  return { suit, rank, id: naechsteId++ };
}

function karten(...kennungen: string[]): Card[] {
  return kennungen.map(k);
}

const FARBE: Record<Suit, string> = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
const RANG: Record<Rank, string> = { '9': 'Neun', J: 'Bube', Q: 'Dame', K: 'König', T: 'Zehn', A: 'Ass' };

/** „Herz-Zehn". */
export function kartenName(karte: Pick<Card, 'suit' | 'rank'>): string {
  return `${FARBE[karte.suit]}-${RANG[karte.rank]}`;
}

/**
 * Hand sortiert wie am Tisch: Truempfe vom staerksten abwaerts, danach die
 * Fehlfarben. Sonst laege die Karte, nach der gefragt wird, zufaellig da.
 */
function sortiert(hand: readonly Card[]): Card[] {
  const rang = (karte: Card): number => {
    const schluessel = `${karte.suit}${karte.rank}`;
    const t = ORDNUNG.trumps.indexOf(schluessel);
    if (t >= 0) return t;
    const farben: Suit[] = ['C', 'S', 'H'];
    const f = farben.indexOf(karte.suit);
    return 100 + f * 10 + ORDNUNG.fehl[karte.suit].indexOf(schluessel);
  };
  return [...hand].sort((a, b) => rang(a) - rang(b));
}

/** Ein Stich aus `[sitz, karte]`-Paaren in Legereihenfolge. */
function stich(...gelegt: [number, string][]): LernStichKarte[] {
  return gelegt.map(([sitz, kennung]) => ({ sitz, karte: k(kennung) }));
}

/** Wer bekommt den Stich? Der Sitz, wie ihn die Engine bestimmt. */
function stichSieger(gelegt: readonly LernStichKarte[]): number {
  return resolveTrick(
    gelegt.map((g) => ({ seat: g.sitz, card: g.karte })),
    ORDNUNG,
    ZWEITE_DULLE,
  ).winnerSeat;
}

/** Was darf ich in diesen Stich legen? */
function erlaubt(hand: readonly Card[], gelegt: readonly LernStichKarte[]): Card[] {
  return legalCards(hand, ORDNUNG, gelegt[0]?.karte ?? null);
}

/** Erlaubte Karten, mit denen ich (Sitz 0) den Stich jetzt gewinne. */
function stechend(hand: readonly Card[], gelegt: readonly LernStichKarte[]): Card[] {
  return erlaubt(hand, gelegt).filter(
    (karte) => stichSieger([...gelegt, { sitz: 0, karte }]) === 0,
  );
}

function ids(liste: readonly Card[]): number[] {
  return liste.map((karte) => karte.id);
}

function jaNein(wahr: boolean): { antworten: string[]; richtig: number } {
  return { antworten: ['Ja', 'Nein'], richtig: wahr ? 0 : 1 };
}

/** Partei aus der Hand: Wer eine Kreuz-Dame hat, spielt Re. */
function parteiVon(hand: readonly Card[]): Party {
  return hand.some((karte) => karte.suit === 'C' && karte.rank === 'Q') ? 're' : 'kontra';
}

/**
 * Antworten fuer „Wie viele Augen?": die richtige Zahl und drei, die man mit
 * einem typischen Fehler erhaelt — Ass als 10 gezaehlt, Zehn als 0, eine
 * Karte vergessen. Aufsteigend sortiert, damit die Lage nichts verraet.
 */
function augenAntworten(liste: readonly Card[]): { antworten: string[]; richtig: number } {
  const summe = sumValues(liste);
  const kandidaten = [summe, summe - 1, summe + 10, summe - cardValue(liste[liste.length - 1]!), summe + 4];
  const werte = [...new Set(kandidaten.filter((wert) => wert >= 0))].slice(0, 4).sort((a, b) => a - b);
  return { antworten: werte.map(String), richtig: werte.indexOf(summe) };
}

// ---------------------------------------------------------------------------
// Bausteine fuer Schritte
// ---------------------------------------------------------------------------

function erklaerung(titel: string, text: string, gezeigt?: Card[]): LernSchritt {
  return gezeigt ? { art: 'erklaerung', titel, text, karten: gezeigt } : { art: 'erklaerung', titel, text };
}

/** „Tippe einen Trumpf." — richtig ist jeder Trumpf der Hand. */
function tippeTrumpf(text: string, hand: Card[], hinweis: string, merke: string): LernSchritt {
  const sortierteHand = sortiert(hand);
  return {
    art: 'waehlen',
    titel: 'Finde den Trumpf',
    text,
    hand: sortierteHand,
    stich: [],
    richtig: ids(sortierteHand.filter((karte) => isTrump(karte, ORDNUNG))),
    hinweis,
    merke,
  };
}

/** Eine erlaubte Karte in den Stich legen — richtig ist, was die Engine erlaubt. */
function legeErlaubt(
  text: string,
  hand: Card[],
  gelegt: LernStichKarte[],
  hinweis: string,
  merke: string,
): LernSchritt {
  const sortierteHand = sortiert(hand);
  const darf = ids(erlaubt(sortierteHand, gelegt));
  return {
    art: 'waehlen',
    titel: 'Was darfst du legen?',
    // Wie viele es sind, sagt die Engine — der Satz passt sich an.
    text: `${text} ${darf.length === 1 ? 'Tippe sie an.' : 'Tippe alle an, die erlaubt sind.'}`,
    hand: sortierteHand,
    stich: gelegt,
    richtig: darf,
    ...(darf.length > 1 ? { alle: true as const } : {}),
    hinweis,
    merke,
  };
}

/** Den Stich gewinnen — richtig sind die erlaubten Karten, die ihn holen. */
function legeStechend(
  text: string,
  hand: Card[],
  gelegt: LernStichKarte[],
  hinweis: string,
  merke: string,
): LernSchritt {
  const sortierteHand = sortiert(hand);
  return {
    art: 'waehlen',
    titel: 'Hol dir den Stich',
    text,
    hand: sortierteHand,
    stich: gelegt,
    richtig: ids(stechend(sortierteHand, gelegt)),
    hinweis,
    merke,
  };
}

/**
 * Genau eine bestimmte Karte legen (eine Spielweise, keine Regel). Die Karte
 * muss erlaubt sein — sonst lehrte die Lektion etwas, das am Tisch nicht geht.
 */
function legeGenau(
  titel: string,
  text: string,
  hand: Card[],
  gelegt: LernStichKarte[],
  welche: (karte: Card) => boolean,
  hinweis: string,
  merke: string,
): LernSchritt {
  const sortierteHand = sortiert(hand);
  const gemeint = sortierteHand.filter(welche);
  const darf = erlaubt(sortierteHand, gelegt);
  if (gemeint.length === 0 || gemeint.some((karte) => !darf.includes(karte))) {
    throw new Error(`Lernpfad: „${titel}" verlangt eine Karte, die nicht erlaubt ist`);
  }
  return { art: 'waehlen', titel, text, hand: sortierteHand, stich: gelegt, richtig: ids(gemeint), hinweis, merke };
}

function frageSieger(text: string, gelegt: LernStichKarte[], hinweis: string, merke: string): LernSchritt {
  const sieger = stichSieger(gelegt);
  return {
    art: 'frage',
    titel: 'Wer bekommt den Stich?',
    text,
    stich: gelegt,
    antworten: gelegt.map((g) => LERN_NAMEN[g.sitz]!),
    richtig: gelegt.findIndex((g) => g.sitz === sieger),
    hinweis,
    merke,
  };
}

/** `{summe}` im Merksatz wird durch die gezaehlten Augen ersetzt — keine Zahl von Hand. */
function frageAugen(text: string, gezeigt: Card[], hinweis: string, merke: string): LernSchritt {
  return {
    art: 'frage',
    titel: 'Augen zählen',
    text,
    karten: gezeigt,
    ...augenAntworten(gezeigt),
    hinweis,
    merke: merke.replace('{summe}', String(sumValues(gezeigt))),
  };
}

function frageJaNein(
  titel: string,
  text: string,
  wahr: boolean,
  hinweis: string,
  merke: string,
  gezeigt?: Card[],
): LernSchritt {
  return {
    art: 'frage',
    titel,
    text,
    ...(gezeigt ? { karten: gezeigt } : {}),
    ...jaNein(wahr),
    hinweis,
    merke,
  };
}

/** Welche dieser Karten erfuellt …? Antworten sind die Kartennamen. */
function frageKarte(
  titel: string,
  text: string,
  kandidaten: Card[],
  welche: (karte: Card) => boolean,
  hinweis: string,
  merke: string,
): LernSchritt {
  const treffer = kandidaten.filter(welche);
  if (treffer.length !== 1) throw new Error(`Lernpfad: „${titel}" hat ${treffer.length} richtige Antworten`);
  return {
    art: 'frage',
    titel,
    text,
    karten: kandidaten,
    antworten: kandidaten.map(kartenName),
    richtig: kandidaten.indexOf(treffer[0]!),
    hinweis,
    merke,
  };
}

function frageWerGewinnt(titel: string, text: string, reAugen: number, reAbsage: 0 | 1, hinweis: string, merke: string): LernSchritt {
  const reGewinnt = reAugen >= mindestAugen('re', reAbsage);
  return { art: 'frage', titel, text, antworten: ['Re', 'Kontra'], richtig: reGewinnt ? 0 : 1, hinweis, merke };
}

/** Staerkster Trumpf unter den gezeigten Karten — nach der Engine-Ordnung. */
function staerkster(liste: readonly Card[]): Card {
  return [...liste].sort(
    (a, b) => ORDNUNG.trumps.indexOf(`${a.suit}${a.rank}`) - ORDNUNG.trumps.indexOf(`${b.suit}${b.rank}`),
  )[0]!;
}

// ---------------------------------------------------------------------------
// Die Lektionen
// ---------------------------------------------------------------------------

function lektionKarten(): Lektion {
  const kandidaten = karten('CQ', 'HT', 'DA');
  const hoechster = staerkster(kandidaten);
  return {
    id: 'karten',
    titel: 'Karten & Trumpf',
    kurz: 'Welche Karten es gibt und was alles sticht',
    schritte: [
      erklaerung(
        'Jede Karte gibt es zweimal',
        'Doppelkopf spielt man zu viert mit 48 Karten: Neun, Bube, Dame, König, Zehn und Ass in Kreuz, Pik, Herz und Karo — und jede davon doppelt. Daher der Name.',
        karten('C9', 'CJ', 'CQ', 'CK', 'CT', 'CA'),
      ),
      erklaerung(
        'Trumpf sticht alles',
        'Trumpf sind die Herz-Zehn, alle Damen, alle Buben und alle Karo-Karten. Hier stehen sie vom stärksten zum schwächsten — die Herz-Zehn heißt „Dulle" und ist die höchste Karte im Spiel.',
        karten('HT', 'CQ', 'SQ', 'HQ', 'DQ', 'CJ', 'SJ', 'HJ', 'DJ', 'DA', 'DT', 'DK', 'D9'),
      ),
      tippeTrumpf(
        'Nur eine dieser Karten ist Trumpf. Tippe sie an.',
        karten('CA', 'SK', 'HQ', 'H9', 'ST', 'CK'),
        'Schau nach einer Dame, einem Buben oder einer Karo-Karte.',
        'Die Herz-Dame ist Trumpf — wie jede Dame.',
      ),
      tippeTrumpf(
        'Und hier? Tippe den Trumpf an.',
        karten('HA', 'DK', 'C9', 'SA', 'HK'),
        'Karo ist immer Trumpf.',
        'Der Karo-König ist Trumpf: Alle Karo-Karten sind Trumpf.',
      ),
      frageJaNein(
        'Trumpf oder nicht?',
        'Ist der Herz-König Trumpf?',
        isTrump(k('HK'), ORDNUNG),
        'Bei Herz ist nur die Zehn Trumpf (und Dame und Bube, wie überall).',
        'Der Herz-König ist kein Trumpf — er ist eine normale Herz-Karte.',
        karten('HK'),
      ),
      frageJaNein(
        'Trumpf oder nicht?',
        'Ist die Herz-Zehn Trumpf?',
        isTrump(k('HT'), ORDNUNG),
        'Denk an die Dulle.',
        'Die Herz-Zehn ist die Dulle — der höchste Trumpf.',
        karten('HT'),
      ),
      frageKarte(
        'Der stärkste Trumpf',
        'Welche dieser drei Karten sticht die anderen beiden?',
        kandidaten,
        (karte) => karte === hoechster,
        'Die Reihenfolge war: Dulle, dann die Damen, dann die Buben, dann Karo.',
        `Die ${kartenName(hoechster)} ist die stärkste.`,
      ),
      erklaerung(
        'Alles andere ist „Fehl"',
        'Kreuz, Pik und Herz ohne Damen, Buben und Herz-Zehn nennt man Fehl. Dort gilt: Ass vor Zehn vor König vor Neun.',
        karten('SA', 'ST', 'SK', 'S9'),
      ),
    ],
  };
}

function lektionBedienen(): Lektion {
  return {
    id: 'bedienen',
    titel: 'Bedienen & Stiche',
    kurz: 'Was du legen musst und wer den Stich bekommt',
    schritte: [
      erklaerung(
        'Ein Stich',
        'Reihum legt jeder eine Karte — das ist ein Stich. Die erste Karte bestimmt, was gespielt wird. Du musst „bedienen": dieselbe Farbe legen, wenn du sie hast.',
      ),
      legeErlaubt(
        'Ole spielt das Pik-Ass aus. Welche Karten darfst du legen?',
        karten('S9', 'SK', 'HQ', 'CA', 'D9'),
        stich([1, 'SA']),
        'Du hast Pik — also musst du Pik legen.',
        'Beide Pik-Karten gehen: Wer die Farbe hat, muss sie legen — welche, ist egal.',
      ),
      erklaerung(
        'Trumpf ist eine eigene Farbe',
        'Wird Trumpf ausgespielt, musst du Trumpf legen — auch eine Dame oder einen Buben. Umgekehrt: Wird Herz ausgespielt, zählt die Herz-Dame NICHT als Herz, sondern als Trumpf.',
      ),
      legeErlaubt(
        'Ole spielt den Karo-König aus — das ist Trumpf. Welche Karten darfst du legen?',
        karten('HA', 'CQ', 'SA', 'C9', 'SJ'),
        stich([1, 'DK']),
        'Damen und Buben sind Trumpf. Du hast welche!',
        'Kreuz-Dame und Pik-Bube: Trumpf wird mit Trumpf bedient.',
      ),
      legeStechend(
        'Ole spielt Herz-Ass, Mia und Kai legen Herz dazu. Du hast kein normales Herz — also darfst du stechen. Hol dir den Stich!',
        karten('HT', 'HQ', 'S9', 'CA'),
        stich([1, 'HA'], [2, 'H9'], [3, 'HK']),
        'Herz-Zehn und Herz-Dame sind Trumpf, kein Herz. Mit Trumpf stichst du das Ass.',
        'Wer eine Farbe nicht hat, darf jede Karte legen — und mit Trumpf stechen.',
      ),
      frageSieger(
        'Ole spielt Pik-Ass aus. Wer bekommt diesen Stich?',
        stich([1, 'SA'], [2, 'S9'], [3, 'DJ'], [0, 'SK']),
        'Eine der Karten ist Trumpf.',
        'Kai sticht mit dem Karo-Buben: Trumpf schlägt jede Fehlkarte.',
      ),
      frageSieger(
        'Zwei gleiche Karten! Wer bekommt den Stich?',
        stich([1, 'HA'], [2, 'HA'], [3, 'H9'], [0, 'HK']),
        'Bei zwei gleichen Karten zählt die Reihenfolge.',
        'Ole: Bei gleichen Karten gewinnt die zuerst gelegte.',
      ),
      erklaerung('Weiter geht’s', 'Wer den Stich gewinnt, nimmt ihn zu sich und spielt als Nächstes aus.'),
    ],
  };
}

function lektionAugen(): Lektion {
  return {
    id: 'augen',
    titel: 'Augen zählen',
    kurz: 'Wie viel die Karten wert sind und ab wann man gewinnt',
    schritte: [
      erklaerung(
        'Augen statt Stiche',
        'Gewonnen wird nicht mit vielen Stichen, sondern mit Augen. Ass 11, Zehn 10, König 4, Dame 3, Bube 2, Neun 0 — zusammen 240 im ganzen Spiel.',
        karten('HA', 'HT', 'HK', 'HQ', 'HJ', 'H9'),
      ),
      {
        art: 'frage',
        titel: 'Augen zählen',
        text: 'Wie viele Augen ist ein Ass wert?',
        karten: karten('CA'),
        antworten: ['4', '10', '11'],
        richtig: ['4', '10', '11'].indexOf(String(cardValue(k('CA')))),
        hinweis: 'Das Ass ist die wertvollste Karte — noch vor der Zehn.',
        merke: 'Ein Ass zählt 11 Augen.',
      },
      frageAugen(
        'Wie viele Augen liegen in diesem Stich?',
        karten('SA', 'ST', 'SK', 'S9'),
        'Ass 11, Zehn 10, König 4, Neun 0.',
        'Ass 11 + Zehn 10 + König 4 + Neun 0 = {summe}.',
      ),
      frageAugen(
        'Und in diesem?',
        karten('CQ', 'DJ', 'HA', 'D9'),
        'Dame 3, Bube 2, Ass 11, Neun 0.',
        'Auch Trümpfe zählen ganz normal ihre Augen.',
      ),
      erklaerung(
        'Ab 121 gewinnst du',
        'Ihr spielt zu zweit gegen zwei. Die Partei „Re" braucht mindestens 121 Augen. Bei 120 zu 120 gewinnt die andere Partei, „Kontra".',
      ),
      frageWerGewinnt(
        'Wer gewinnt?',
        'Re hat am Ende genau 120 Augen, Kontra auch 120. Wer gewinnt?',
        120,
        0,
        'Re braucht mehr als die Hälfte.',
        'Kontra gewinnt: Re braucht 121.',
      ),
    ],
  };
}

function lektionParteien(): Lektion {
  const mitDame = karten('CQ', 'HA', 'D9', 'SK', 'CJ', 'HT', 'C9', 'SA', 'DK', 'H9', 'ST', 'DJ');
  const ohneDame = karten('SQ', 'HA', 'D9', 'SK', 'CJ', 'HT', 'C9', 'SA', 'DK', 'H9', 'ST', 'DJ');
  return {
    id: 'parteien',
    titel: 'Re & Kontra',
    kurz: 'Wer mit wem spielt — und warum das geheim ist',
    schritte: [
      erklaerung(
        'Die Kreuz-Damen',
        'Wer eine Kreuz-Dame hat, spielt „Re". Die beiden anderen spielen „Kontra". Am Anfang weiß niemand, wer zu wem gehört — das findet man im Spiel heraus.',
        karten('CQ', 'CQ'),
      ),
      {
        art: 'frage',
        titel: 'Deine Partei',
        text: 'Das ist deine Hand. In welcher Partei spielst du?',
        karten: sortiert(mitDame),
        antworten: ['Re', 'Kontra'],
        richtig: parteiVon(mitDame) === 're' ? 0 : 1,
        hinweis: 'Schau nach der Kreuz-Dame.',
        merke: 'Du hast eine Kreuz-Dame — also Re.',
      },
      {
        art: 'frage',
        titel: 'Deine Partei',
        text: 'Und mit dieser Hand?',
        karten: sortiert(ohneDame),
        antworten: ['Re', 'Kontra'],
        richtig: parteiVon(ohneDame) === 're' ? 0 : 1,
        hinweis: 'Die Pik-Dame zählt nicht — nur Kreuz.',
        merke: 'Keine Kreuz-Dame — also Kontra.',
      },
      {
        art: 'frage',
        titel: 'Wer ist wer?',
        text: 'Ole spielt eine Kreuz-Dame aus. Was weißt du jetzt über Ole?',
        stich: stich([1, 'CQ']),
        antworten: ['Ole spielt Re', 'Ole spielt Kontra'],
        richtig: parteiVon([k('CQ')]) === 're' ? 0 : 1,
        hinweis: 'Wer die Kreuz-Dame hat …',
        merke: 'Ole hat eine Kreuz-Dame, also spielt Ole Re.',
      },
      erklaerung(
        'Vor dem Spiel: „gesund"',
        'Bevor es losgeht, fragt das Spiel, ob du etwas Besonderes hast. Mit einer normalen Hand sagst du einfach „gesund".',
      ),
      erklaerung(
        'Hochzeit: zwei Kreuz-Damen',
        `Hast du beide Kreuz-Damen, kannst du vor dem Spiel „Hochzeit" ansagen. Wer außer dir innerhalb der ersten ${DEFAULT_RULESET.hochzeitClarifyTricks} Stiche als Erster einen Stich gewinnt, wird dein Partner. Ihr spielt zusammen als Re. Gewinnst du diese ${DEFAULT_RULESET.hochzeitClarifyTricks} Stiche alle selbst, spielst du allein gegen die anderen drei.`,
        karten('CQ', 'CQ'),
      ),
      erklaerung(
        'Ein Tipp',
        'Hast du eine Kreuz-Dame, zeig sie ruhig früh. Dann weiß dein Partner, dass ihr zusammengehört.',
      ),
    ],
  };
}

function lektionSonderpunkte(): Lektion {
  const doppelkopfStich = karten('SA', 'ST', 'SA', 'ST');
  const kleinerStich = karten('HA', 'H9', 'HK', 'HA');
  return {
    id: 'sonderpunkte',
    titel: 'Fuchs, Karlchen, Doppelkopf',
    kurz: 'Drei Extrapunkte, auf die alle achten',
    schritte: [
      erklaerung(
        'Der Fuchs',
        'Das Karo-Ass heißt Fuchs. Gewinnt die gegnerische Partei den Stich, in dem dein Fuchs liegt, bekommt sie einen Extrapunkt — man sagt: Der Fuchs ist gefangen.',
        karten('DA'),
      ),
      frageKarte(
        'Wo ist der Fuchs?',
        'Welche Karte ist der Fuchs?',
        karten('HA', 'DA', 'CA'),
        isFuchs,
        'Der Fuchs ist ein Trumpf-Ass.',
        'Das Karo-Ass ist der Fuchs.',
      ),
      legeGenau(
        'Bring den Fuchs nach Hause',
        'Mia ist deine Partnerin und spielt die Herz-Zehn aus — die höchste Karte. Kai hat schon bedient. Der Stich gehört euch: Leg den Fuchs dazu!',
        karten('DA', 'DK', 'D9', 'CA', 'SA'),
        stich([2, 'HT'], [3, 'D9']),
        isFuchs,
        'Der Fuchs ist das Karo-Ass. Bei deiner Partnerin ist er sicher.',
        'Sicher verstaut: 11 Augen für euch und kein Punkt für die Gegner.',
      ),
      erklaerung(
        'Karlchen',
        'Der Kreuz-Bube heißt Karlchen. Gewinnt er den allerletzten Stich, gibt es einen Extrapunkt.',
        karten('CJ'),
      ),
      erklaerung('Doppelkopf', 'Ein Stich mit mindestens 40 Augen heißt Doppelkopf und bringt einen Extrapunkt.'),
      frageJaNein(
        'Doppelkopf?',
        'Ist dieser Stich ein Doppelkopf?',
        sumValues(doppelkopfStich) >= 40,
        'Zähl die Augen: Ass 11, Zehn 10.',
        `${sumValues(doppelkopfStich)} Augen — ein Doppelkopf!`,
        doppelkopfStich,
      ),
      frageJaNein(
        'Doppelkopf?',
        'Und dieser?',
        sumValues(kleinerStich) >= 40,
        'Zähl nach: Ass 11, Neun 0, König 4.',
        `Nur ${sumValues(kleinerStich)} Augen — kein Doppelkopf.`,
        kleinerStich,
      ),
    ],
  };
}

function lektionAnsagen(): Lektion {
  return {
    id: 'ansagen',
    titel: 'Ansagen',
    kurz: '„Re", „Kontra" und „keine 90"',
    schritte: [
      erklaerung(
        'Re sagen',
        'Bist du sicher, dass deine Partei gewinnt, sag „Re" (oder „Kontra"). Dann zählt das Spiel doppelt — für die Gewinner und für die Verlierer.',
      ),
      frageJaNein(
        'Bis wann?',
        'Du hast schon eine Karte gelegt. Darfst du noch „Re" sagen?',
        mayAnnounce(0, 1),
        'Die Ansage hat eine Frist, aber die ist noch nicht vorbei.',
        'Bis du deine zweite Karte legst, ist noch Zeit.',
      ),
      frageJaNein(
        'Bis wann?',
        'Du hast schon zwei Karten gelegt. Darfst du noch „Re" sagen?',
        mayAnnounce(0, 2),
        'Die Frist endet mit deiner zweiten Karte.',
        'Nach der zweiten Karte ist es zu spät.',
      ),
      frageWerGewinnt(
        'Wer gewinnt?',
        'Re hat „Re" gesagt und holt 121 Augen. Wer gewinnt?',
        121,
        0,
        'Die Ansage ändert nicht, wie viele Augen Re braucht.',
        'Re gewinnt — und weil angesagt war, zählt es doppelt.',
      ),
      erklaerung(
        'Keine 90',
        'Danach kann man steigern: „keine 90" heißt, die Gegner bekommen keine 90 Augen. Dann braucht ihr selbst 151. Schafft ihr das, gibt es einen Extrapunkt — schafft ihr es nicht, verliert ihr.',
      ),
      frageWerGewinnt(
        'Geschafft?',
        'Re hat „keine 90" gesagt. Am Ende hat Re 145 Augen, Kontra 95. Wer gewinnt?',
        145,
        1,
        'Kontra hat 90 oder mehr — die Absage ist geplatzt.',
        'Kontra gewinnt: Re hätte 151 gebraucht.',
      ),
      erklaerung(
        'Merke',
        'Lieber einmal zu wenig ansagen als einmal zu viel. Die Hochzeit mit beiden Kreuz-Damen kennst du schon. Armut und Soli lernst du am echten Tisch kennen.',
      ),
    ],
  };
}

function lektionErsteRunde(): Lektion {
  return {
    id: 'erste-runde',
    titel: 'Deine erste Runde',
    kurz: 'Eine ganze Runde gegen freundliche Bots',
    uebung: true,
    schritte: [
      erklaerung(
        'Jetzt wird gespielt',
        'Du spielst eine ganze Runde gegen drei Bots, die es dir nicht zu schwer machen. Die Karten, die du legen darfst, leuchten auf, und unten steht ein Tipp. Viel Glück!',
      ),
    ],
  };
}

/** Der ganze Pfad, in der Reihenfolge, in der man ihn geht. */
export const LEKTIONEN: readonly Lektion[] = [
  lektionKarten(),
  lektionBedienen(),
  lektionAugen(),
  lektionParteien(),
  lektionSonderpunkte(),
  lektionAnsagen(),
  lektionErsteRunde(),
];

export function lektionVon(id: string): Lektion | null {
  return LEKTIONEN.find((lektion) => lektion.id === id) ?? null;
}

/** Die Lektion, die mit einer Uebungsrunde endet. */
export const UEBUNGS_LEKTION = LEKTIONEN.find((lektion) => lektion.uebung)!.id;
