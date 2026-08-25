/**
 * Spielzustand und Regeln von Easy Poker.
 *
 * Texas Hold'em Kopf an Kopf, auf das Noetigste eingedampft: zwei Handkarten,
 * fuenf Gemeinschaftskarten, vier Setzrunden — und genau VIER Schaltflaechen,
 * weil eine Setzleiste mit Schieberegler auf einem Handy niemand bedient. Wie
 * viel ein Erhoehen kostet, rechnet deshalb dieses Modul aus und schickt den
 * Betrag mit der erlaubten Aktion mit (siehe `erlaubteZuege`).
 *
 * Reine Logik: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser dem
 * uebergebenen Seed (game-api, Grundsatz 1). Auch die Pause zwischen zwei
 * Haenden misst dieses Modul NICHT selbst — es meldet nur ihre Dauer, und die
 * Plattform ruft danach `beendePause` (wie bei Mememory).
 */

import {
  type Bewertung,
  type Karte,
  besteHand,
  erstelleBlatt,
  vergleicheHaende,
} from './karten.js';
import type { EasyPokerRegeln } from './regeln.js';

// ---------------------------------------------------------------------------
// Zufall
// ---------------------------------------------------------------------------

/**
 * Der Zufallsgenerator steht hier noch einmal, obwohl die anderen Spielmodule
 * denselben haben. Aus demselben Grund wie dort: Ein Spielmodul ist eine
 * eigenstaendige Bibliothek. Wanderte der Generator in ein gemeinsames Paket,
 * aenderte eine Verbesserung dort jede gespeicherte Partie.
 */
export type Saat = number | string;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function worte(hex: string): [number, number, number, number] {
  const sauber = hex.replace(/[^0-9a-f]/gi, '').padEnd(32, '0').slice(0, 32);
  return [
    Number.parseInt(sauber.slice(0, 8), 16) >>> 0,
    Number.parseInt(sauber.slice(8, 16), 16) >>> 0,
    Number.parseInt(sauber.slice(16, 24), 16) >>> 0,
    Number.parseInt(sauber.slice(24, 32), 16) >>> 0,
  ];
}

/**
 * Eine Zahl ist ein 32-Bit-Seed: gut fuer Tests, zu klein fuer den Ernstfall.
 * Wer seine eigenen Karten sieht, koennte 2^32 Seeds durchprobieren und
 * danach jede Karte des Gegners kennen. Im Betrieb kommt deshalb die Hexkette
 * vom Server.
 */
export function baueZufall(saat: Saat): () => number {
  if (typeof saat === 'number') return mulberry32(saat);
  const [a, b, c, d] = worte(saat);
  const zufall = sfc32(a, b, c, d);
  for (let i = 0; i < 12; i++) zufall();
  return zufall;
}

/**
 * Der Zufall EINER Hand.
 *
 * Anders als beim Memory wird hier mehrfach gegeben, und jede Gabe braucht
 * ihren eigenen Strom. Die Handnummer steht dabei VORNE: `worte()` liest die
 * ersten 32 Hexzeichen, eine hinten angehaengte Nummer fiele bei einer langen
 * Basis stillschweigend heraus — und dann bekaeme jede Hand dieselben Karten.
 */
function handZufall(saat: Saat, handNr: number): () => number {
  if (typeof saat === 'number') return mulberry32((saat + Math.imul(handNr, 0x9e3779b1)) >>> 0);
  return baueZufall(handNr.toString(16).padStart(8, '0') + saat);
}

/**
 * Fisher-Yates, von hinten nach vorne.
 *
 * Ausgeschrieben und nicht ueber `sort(() => zufall() - 0.5)`: Ein
 * Vergleichszufall mischt nicht gleichverteilt, und das Ergebnis haengt an
 * der Sortierung der Laufzeitumgebung.
 */
function mische<T>(liste: readonly T[], zufall: () => number): T[] {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    const merk = kopie[i]!;
    kopie[i] = kopie[j]!;
    kopie[j] = merk;
  }
  return kopie;
}

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

export type Strasse = 'preflop' | 'flop' | 'turn' | 'river';

/** Reihenfolge der Setzrunden. Eine Stelle, damit nichts auseinanderlaeuft. */
const STRASSEN: readonly Strasse[] = ['preflop', 'flop', 'turn', 'river'];

/** Wie viele Karten am Anfang einer Strasse aufgedeckt werden. */
const NEUE_BRETTKARTEN: Readonly<Record<Strasse, number>> = {
  preflop: 0,
  flop: 3,
  turn: 1,
  river: 1,
};

export type Aktionsart = 'passen' | 'schieben' | 'mitgehen' | 'setzen';

/**
 * Was ein Spieler tun kann.
 *
 * `betrag` ist immer das, was den eigenen Stapel VERLAESST — nicht der
 * Zieleinsatz. Der Bildschirm kann ihn damit ohne Rechnung auf den Knopf
 * schreiben ("Call 12"), und weil er mit der Aktion zurueckkommt, prueft der
 * Server ihn gegen seine eigene Rechnung: Ein manipulierter Client erhoeht
 * nicht um einen Betrag seiner Wahl.
 */
export type EasyPokerAktion =
  | { readonly typ: 'passen' }
  | { readonly typ: 'schieben' }
  | { readonly typ: 'mitgehen'; readonly betrag: number }
  | { readonly typ: 'setzen'; readonly betrag: number }
  /**
   * Anzeigename fuer dieses Spiel. Kein Spielzug: steht nicht in
   * `legalActions`, aendert weder Zugrecht noch Jetons und ist deshalb auch
   * waehrend der Schaupause erlaubt.
   */
  | { readonly typ: 'name'; readonly name: string };

export const NAME_MAX = 16;

/**
 * Saeubert einen selbstgewaehlten Namen.
 *
 * Er wird dem Gegner angezeigt, kommt also aus einem fremden Browser.
 * Steuerzeichen und Laenge werden hier begrenzt und nicht erst im Client: Ein
 * zweiter Client (oder ein Skript) haelt sich nicht an die Feldlaenge.
 */
export function saeubereName(roh: string): string {
  const sichtbar = [...roh].filter((zeichen) => {
    const code = zeichen.codePointAt(0) ?? 0;
    // Ausgeschriebene Bereiche statt einer Zeichenklasse: Steuerzeichen in
    // einem Quelltext zu SCHREIBEN ist genau der Fehler, den diese Funktion
    // verhindern soll.
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return false;
    // Nullbreiten- und Richtungszeichen: ein Name aus lauter davon sieht aus
    // wie ein leerer Platz, und ein Umbruch zerlegt die Anzeige.
    if (code >= 0x200b && code <= 0x200f) return false;
    if (code >= 0x2028 && code <= 0x202e) return false;
    return code !== 0xfeff;
  });
  // Ueber Codepunkte schneiden, nicht ueber UTF-16-Einheiten: Ein halbiertes
  // Emoji ist ein kaputtes Zeichen.
  return sichtbar.slice(0, NAME_MAX).join('').trim();
}

/** Was zuletzt am Tisch passiert ist — nur zur Anzeige. */
export interface LetzteAktion {
  readonly sitz: number;
  readonly art: Aktionsart;
  /** Was den Stapel verlassen hat. Bei `schieben` und `passen` null. */
  readonly betrag: number | null;
}

/** Ausgang einer Hand. Liegt waehrend der Schaupause an der Partie. */
export interface HandErgebnis {
  /** Ein Sitz, oder beide bei geteiltem Topf. */
  readonly gewinner: readonly number[];
  /** Der Gegner hat aufgegeben — dann werden keine Karten gezeigt. */
  readonly durchAufgabe: boolean;
  readonly topf: number;
  /** Handkarten, die offen gezeigt werden. Bei Aufgabe leer. */
  readonly gezeigt: Readonly<Record<number, readonly Karte[]>>;
  /** Die gewertete Fuenferkombination je Sitz. Bei Aufgabe leer. */
  readonly bewertung: Readonly<Record<number, Bewertung>>;
  /** Was diese Hand je Sitz eingebracht hat, Einsaetze schon abgezogen. */
  readonly gewinn: Readonly<Record<number, number>>;
}

export interface EasyPokerPartie {
  readonly regeln: EasyPokerRegeln;
  /**
   * Zufallsbasis. Verlaesst dieses Modul NIE — wer sie hat, kennt jede
   * kuenftige Hand. Deshalb steht sie in keiner Sicht (siehe sicht.ts).
   */
  readonly saat: Saat;
  readonly handMax: number;
  /** Laufende Hand, ab 1. */
  readonly handNr: number;
  /** Abgeschlossene Haende — Grundlage der Erfahrungspunkte. */
  readonly abgeschlossen: number;
  /** Sitz mit dem Knopf. Zahlt den kleinen Blind und handelt vor dem Flop zuerst. */
  readonly geber: number;
  /** Jetons HINTER dem laufenden Einsatz. */
  readonly jetons: Readonly<Record<number, number>>;
  readonly hand: Readonly<Record<number, readonly Karte[]>>;
  readonly brett: readonly Karte[];
  /** Rest des Gebens. Daraus kommen Flop, Turn und River. */
  readonly reststapel: readonly Karte[];
  readonly strasse: Strasse;
  /** Einsatz in DIESER Strasse. Am Strassenende wandert er in den Topf. */
  readonly einsatz: Readonly<Record<number, number>>;
  readonly topf: number;
  readonly dran: number | null;
  /** Wer seit der letzten Erhoehung schon gehandelt hat. */
  readonly gehandelt: readonly number[];
  /** Betrag der letzten Erhoehung — Untergrenze fuer die naechste. */
  readonly letzteErhoehung: number;
  readonly letzteAktion: LetzteAktion | null;
  /** Waehrend der Schaupause gesetzt, sonst null. */
  readonly ergebnis: HandErgebnis | null;
  readonly namen: Readonly<Record<number, string>>;
  readonly leftSeats: readonly number[];
  readonly fertig: boolean;
}

// ---------------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------------

export function sitzeVon(partie: EasyPokerPartie): number[] {
  return Object.keys(partie.jetons).map(Number).sort((a, b) => a - b);
}

export function gegnerVon(partie: EasyPokerPartie, sitz: number): number {
  return sitzeVon(partie).find((s) => s !== sitz) ?? sitz;
}

function hoechsterEinsatz(partie: EasyPokerPartie): number {
  return Math.max(...sitzeVon(partie).map((s) => partie.einsatz[s] ?? 0));
}

/** Der ganze Topf inklusive der laufenden Strasse — die Zahl auf dem Tisch. */
export function topfGesamt(partie: EasyPokerPartie): number {
  return partie.topf + sitzeVon(partie).reduce((summe, s) => summe + (partie.einsatz[s] ?? 0), 0);
}

/** Was dieser Sitz zahlen muesste, um mitzugehen. Nie mehr als sein Stapel. */
export function zuZahlen(partie: EasyPokerPartie, sitz: number): number {
  const fehlt = hoechsterEinsatz(partie) - (partie.einsatz[sitz] ?? 0);
  return Math.max(0, Math.min(fehlt, partie.jetons[sitz] ?? 0));
}

/**
 * Kann dieser Sitz in der laufenden Strasse noch handeln?
 *
 * Drei Faelle, und der dritte ist der, an dem eine selbstgebaute Setzrunde
 * fast immer haengt: Vor dem Flop hat der grosse Blind das Recht zu erhoehen,
 * auch wenn der Gegner nur mitgegangen ist — die Einsaetze sind dann gleich,
 * gehandelt hat er aber noch nicht.
 */
function kannHandeln(partie: EasyPokerPartie, sitz: number): boolean {
  if ((partie.jetons[sitz] ?? 0) <= 0) return false;
  if (!partie.gehandelt.includes(sitz)) return true;
  return (partie.einsatz[sitz] ?? 0) < hoechsterEinsatz(partie);
}

// ---------------------------------------------------------------------------
// Geben
// ---------------------------------------------------------------------------

/**
 * Setzt eine neue Hand auf: mischen, geben, Blinds stellen.
 *
 * Die Blinds werden auf den Stapel gedeckelt. Das ist kein Randfall, sondern
 * der Normalfall am Ende einer Partie: Wer weniger Jetons hat als der grosse
 * Blind, geht mit dem Setzen des Blinds all-in — und darf trotzdem noch
 * gewinnen.
 */
function gibHand(partie: EasyPokerPartie): EasyPokerPartie {
  const sitze = sitzeVon(partie);
  const zufall = handZufall(partie.saat, partie.handNr);
  const blatt = mische(erstelleBlatt(), zufall);

  const hand: Record<number, readonly Karte[]> = {};
  let naechste = 0;
  // Reihum geben, beginnend links vom Geber — wie am echten Tisch. Es aendert
  // nichts an den Wahrscheinlichkeiten, aber es macht die Tests lesbar.
  const gebeReihenfolge = [gegnerVon(partie, partie.geber), partie.geber];
  for (const sitz of gebeReihenfolge) {
    hand[sitz] = [blatt[naechste++]!, blatt[naechste++]!];
  }

  const kleinerSitz = partie.geber;
  const grosserSitz = gegnerVon(partie, partie.geber);
  const kleinerBetrag = Math.min(partie.regeln.kleinerBlind, partie.jetons[kleinerSitz] ?? 0);
  const grosserBetrag = Math.min(partie.regeln.grosserBlind, partie.jetons[grosserSitz] ?? 0);

  const jetons: Record<number, number> = { ...partie.jetons };
  jetons[kleinerSitz] = (jetons[kleinerSitz] ?? 0) - kleinerBetrag;
  jetons[grosserSitz] = (jetons[grosserSitz] ?? 0) - grosserBetrag;

  const einsatz: Record<number, number> = {};
  for (const sitz of sitze) einsatz[sitz] = 0;
  einsatz[kleinerSitz] = kleinerBetrag;
  einsatz[grosserSitz] = grosserBetrag;

  const gegeben: EasyPokerPartie = {
    ...partie,
    hand,
    brett: [],
    reststapel: blatt.slice(naechste),
    strasse: 'preflop',
    jetons,
    einsatz,
    topf: 0,
    // Blinds sind kein Handeln: Wer den grossen Blind gestellt hat, darf
    // spaeter trotzdem noch erhoehen.
    gehandelt: [],
    letzteErhoehung: partie.regeln.grosserBlind,
    letzteAktion: null,
    ergebnis: null,
    dran: null,
  };

  return starteStrasse(gegeben, 'preflop');
}

/**
 * Beginn einer Setzrunde: Wer zuerst handelt, und ob ueberhaupt jemand kann.
 *
 * Vor dem Flop handelt der Knopf zuerst (er zahlt den kleinen Blind), danach
 * zuletzt. Diese Umkehr ist der ganze Positionsvorteil des Spiels und deshalb
 * die einzige Stelle, an der die Reihenfolge steht.
 */
function starteStrasse(partie: EasyPokerPartie, strasse: Strasse): EasyPokerPartie {
  const reihenfolge =
    strasse === 'preflop'
      ? [partie.geber, gegnerVon(partie, partie.geber)]
      : [gegnerVon(partie, partie.geber), partie.geber];

  const mitStrasse: EasyPokerPartie = { ...partie, strasse };
  const dran = reihenfolge.find((sitz) => kannHandeln(mitStrasse, sitz)) ?? null;
  if (dran === null) return schliesseStrasse(mitStrasse);
  return { ...mitStrasse, dran };
}

// ---------------------------------------------------------------------------
// Zuege
// ---------------------------------------------------------------------------

export function amZug(partie: EasyPokerPartie): number | null {
  if (partie.fertig || partie.ergebnis !== null) return null;
  return partie.dran;
}

/**
 * Was ein Erhoehen kostet, oder null wenn keins moeglich ist.
 *
 * Ein einziger Knopf, also eine einzige Groesse: der halbe Topf, mindestens
 * aber ein grosser Blind und mindestens so viel wie die letzte Erhoehung
 * (sonst waere es nach den Regeln gar keine). Nach oben deckeln zwei Dinge —
 * der eigene Stapel und das, was der Gegner ueberhaupt noch bezahlen kann.
 * Ohne den zweiten Deckel setzte man Jetons in einen Topf, den niemand mehr
 * mitgehen kann, und bekaeme sie am Strassenende wieder zurueck: eine
 * Erhoehung, die keine ist.
 */
export function setzKosten(partie: EasyPokerPartie, sitz: number): number | null {
  const gegner = gegnerVon(partie, sitz);
  const eigen = partie.jetons[sitz] ?? 0;
  const fremd = partie.jetons[gegner] ?? 0;
  if (eigen <= 0 || fremd <= 0) return null;

  const fehlt = zuZahlen(partie, sitz);
  const topfNachMitgehen = topfGesamt(partie) + fehlt;
  const erhoehung = Math.max(
    partie.regeln.grosserBlind,
    partie.letzteErhoehung,
    Math.round(topfNachMitgehen / 2),
  );

  const bisAllIn = eigen;
  // Mehr als der Gegner insgesamt stellen kann, waere Zierde: Die Differenz
  // kaeme am Strassenende zurueck.
  const bisGegnerDeckel =
    (partie.einsatz[gegner] ?? 0) + fremd - (partie.einsatz[sitz] ?? 0);

  const kosten = Math.min(fehlt + erhoehung, bisAllIn, bisGegnerDeckel);
  return kosten > fehlt ? kosten : null;
}

export function erlaubteZuege(partie: EasyPokerPartie, sitz: number): EasyPokerAktion[] {
  if (amZug(partie) !== sitz) return [];

  const zuege: EasyPokerAktion[] = [];
  const fehlt = zuZahlen(partie, sitz);

  if (fehlt > 0) {
    // Passen nur, wenn es etwas zu bezahlen gibt. Ohne Einsatz waere es ein
    // Knopf, der die Hand verschenkt, obwohl Schieben nichts kostet — genau
    // der Fehlgriff, den DESIGN-DOKO an anderer Stelle "eine Runde
    // entscheiden" nennt.
    zuege.push({ typ: 'passen' });
    zuege.push({ typ: 'mitgehen', betrag: fehlt });
  } else {
    zuege.push({ typ: 'schieben' });
  }

  const kosten = setzKosten(partie, sitz);
  if (kosten !== null) zuege.push({ typ: 'setzen', betrag: kosten });

  return zuege;
}

function istErlaubt(partie: EasyPokerPartie, sitz: number, aktion: EasyPokerAktion): boolean {
  return erlaubteZuege(partie, sitz).some(
    (zug) =>
      zug.typ === aktion.typ &&
      (zug.typ === 'passen' ||
        zug.typ === 'schieben' ||
        ('betrag' in aktion && 'betrag' in zug && zug.betrag === aktion.betrag)),
  );
}

export function fuehreAus(
  partie: EasyPokerPartie,
  sitz: number,
  aktion: EasyPokerAktion,
): EasyPokerPartie {
  if (aktion.typ === 'name') {
    return { ...partie, namen: { ...partie.namen, [sitz]: saeubereName(aktion.name) } };
  }

  if (partie.fertig) throw new Error('Partie ist zu Ende');
  if (partie.ergebnis !== null) throw new Error('Schaupause laeuft');
  if (partie.dran !== sitz) throw new Error('Nicht am Zug');
  if (!istErlaubt(partie, sitz, aktion)) throw new Error(`Zug nicht erlaubt: ${aktion.typ}`);

  if (aktion.typ === 'passen') {
    return beendeDurchAufgabe(
      { ...partie, letzteAktion: { sitz, art: 'passen', betrag: null } },
      sitz,
    );
  }

  if (aktion.typ === 'schieben') {
    const weiter: EasyPokerPartie = {
      ...partie,
      gehandelt: [...partie.gehandelt, sitz],
      letzteAktion: { sitz, art: 'schieben', betrag: null },
    };
    return naechsterSchritt(weiter);
  }

  const betrag = aktion.betrag;
  const vorher = hoechsterEinsatz(partie);
  const neuerEinsatz = (partie.einsatz[sitz] ?? 0) + betrag;

  const weiter: EasyPokerPartie = {
    ...partie,
    jetons: { ...partie.jetons, [sitz]: (partie.jetons[sitz] ?? 0) - betrag },
    einsatz: { ...partie.einsatz, [sitz]: neuerEinsatz },
    // Ein Erhoehen setzt die Runde zurueck: Der Gegner muss noch einmal ran.
    gehandelt: aktion.typ === 'setzen' ? [sitz] : [...partie.gehandelt, sitz],
    letzteErhoehung:
      aktion.typ === 'setzen' && neuerEinsatz > vorher
        ? neuerEinsatz - vorher
        : partie.letzteErhoehung,
    letzteAktion: { sitz, art: aktion.typ, betrag },
  };

  return naechsterSchritt(weiter);
}

/**
 * Nach jedem Zug: Gegner dran, oder Strasse zu Ende.
 *
 * Kein Fall dazwischen. Wer gerade gehandelt hat, kann in derselben Strasse
 * nur dann noch einmal, wenn der Gegner erhoeht — und dann ist der Gegner
 * vorher am Zug.
 */
function naechsterSchritt(partie: EasyPokerPartie): EasyPokerPartie {
  const gegner = gegnerVon(partie, partie.dran ?? 0);
  if (kannHandeln(partie, gegner)) return { ...partie, dran: gegner };
  return schliesseStrasse(partie);
}

/**
 * Strassenende: Einsaetze in den Topf, dann die naechste Karte — oder das
 * Zeigen.
 *
 * Die Rueckgabe ist der einzige Nebentopf, den ein Spiel zu zweit braucht:
 * Wer mehr gesetzt hat, als der Gegner ueberhaupt stellen konnte, bekommt die
 * Differenz zurueck. Ohne sie koennte man einen Gegner mit funfzig Jetons um
 * zweihundert erleichtern.
 */
function schliesseStrasse(partie: EasyPokerPartie): EasyPokerPartie {
  const sitze = sitzeVon(partie);
  const gedeckt = Math.min(...sitze.map((s) => partie.einsatz[s] ?? 0));

  const jetons: Record<number, number> = { ...partie.jetons };
  let topf = partie.topf;
  for (const sitz of sitze) {
    const gesetzt = partie.einsatz[sitz] ?? 0;
    topf += gedeckt;
    jetons[sitz] = (jetons[sitz] ?? 0) + (gesetzt - gedeckt);
  }

  const einsatz: Record<number, number> = {};
  for (const sitz of sitze) einsatz[sitz] = 0;

  const gesammelt: EasyPokerPartie = {
    ...partie,
    jetons,
    einsatz,
    topf,
    gehandelt: [],
    letzteErhoehung: partie.regeln.grosserBlind,
    letzteAktion: null,
    dran: null,
  };

  // Steht jemand all-in, ist nichts mehr zu entscheiden: Die restlichen
  // Brettkarten fallen am Stueck, und es wird gezeigt.
  const allIn = sitze.some((sitz) => (gesammelt.jetons[sitz] ?? 0) <= 0);
  const naechste = STRASSEN[STRASSEN.indexOf(gesammelt.strasse) + 1];

  if (allIn || naechste === undefined) {
    return zeigeAuf(deckeRestlichesBrettAuf(gesammelt));
  }

  const mitKarten = deckeAuf(gesammelt, NEUE_BRETTKARTEN[naechste]);
  return starteStrasse(mitKarten, naechste);
}

function deckeAuf(partie: EasyPokerPartie, anzahl: number): EasyPokerPartie {
  if (anzahl <= 0) return partie;
  return {
    ...partie,
    brett: [...partie.brett, ...partie.reststapel.slice(0, anzahl)],
    reststapel: partie.reststapel.slice(anzahl),
  };
}

/** Fuellt das Brett auf fuenf Karten auf — fuer den All-in-Fall. */
function deckeRestlichesBrettAuf(partie: EasyPokerPartie): EasyPokerPartie {
  return deckeAuf(partie, 5 - partie.brett.length);
}

// ---------------------------------------------------------------------------
// Handende
// ---------------------------------------------------------------------------

/**
 * Der Gegner hat aufgegeben.
 *
 * Karten werden dabei NICHT gezeigt. Das ist keine Kosmetik: Wer sieht, mit
 * welchen Blaettern sein Gegner setzt, spielt danach ein anderes Spiel.
 *
 * Die Deckelung gilt auch hier: Wer mehr gesetzt hat, als der Gegner
 * ueberhaupt bezahlt hat, bekommt die Differenz zurueck, statt sie sich
 * selbst als Topf auszuzahlen.
 */
function beendeDurchAufgabe(partie: EasyPokerPartie, aufgeber: number): EasyPokerPartie {
  const sieger = gegnerVon(partie, aufgeber);
  const sitze = sitzeVon(partie);

  const gedeckt = Math.min(...sitze.map((s) => partie.einsatz[s] ?? 0));
  const jetons: Record<number, number> = { ...partie.jetons };
  let topf = partie.topf;
  for (const sitz of sitze) {
    topf += gedeckt;
    jetons[sitz] = (jetons[sitz] ?? 0) + ((partie.einsatz[sitz] ?? 0) - gedeckt);
  }

  jetons[sieger] = (jetons[sieger] ?? 0) + topf;

  /*
   * Beide haben zum Topf gleich viel beigetragen — dafuer sorgen die
   * Deckelungen an jedem Strassenende. Der Gewinn des Siegers ist deshalb
   * genau die Haelfte des Topfes, und exakt das ist der Verlust des
   * Aufgebers.
   */
  const anteil = topf / sitze.length;
  const gewinn: Record<number, number> = { [sieger]: anteil, [aufgeber]: -anteil };

  const einsatz: Record<number, number> = {};
  for (const sitz of sitze) einsatz[sitz] = 0;

  return {
    ...partie,
    jetons,
    einsatz,
    /*
     * Der Topf ist AUSGEZAHLT und deshalb leer.
     *
     * Die Zahl steht nur noch im Ergebnis, und das ist kein Schoenheitsfehler:
     * Stuende sie zusaetzlich hier, waeren dieselben Jetons zweimal gezaehlt —
     * einmal im Stapel des Siegers und einmal auf dem Tisch. Die Anzeige des
     * gewonnenen Topfes liest `ergebnis.topf`.
     */
    topf: 0,
    dran: null,
    gehandelt: [],
    ergebnis: {
      gewinner: [sieger],
      durchAufgabe: true,
      topf,
      gezeigt: {},
      bewertung: {},
      gewinn,
    },
  };
}

/**
 * Zeigen: beide Blaetter vergleichen, Topf verteilen.
 *
 * Bei Gleichstand geht der ungerade Jeton an den Sitz OHNE Knopf. Irgendwohin
 * muss er, und der Knopf hat in dieser Hand schon die bessere Position gehabt.
 */
function zeigeAuf(partie: EasyPokerPartie): EasyPokerPartie {
  const sitze = sitzeVon(partie);
  const bewertung: Record<number, Bewertung> = {};
  const gezeigt: Record<number, readonly Karte[]> = {};
  for (const sitz of sitze) {
    const eigene = partie.hand[sitz] ?? [];
    bewertung[sitz] = besteHand([...eigene, ...partie.brett]);
    gezeigt[sitz] = eigene;
  }

  const [a, b] = sitze as [number, number];
  const vergleich = vergleicheHaende(bewertung[a]!, bewertung[b]!);
  const gewinner = vergleich > 0 ? [a] : vergleich < 0 ? [b] : [a, b];

  const jetons: Record<number, number> = { ...partie.jetons };
  const gewinn: Record<number, number> = {};
  // Der eigene Anteil am Topf ist die Haelfte: Beide haben gleich viel
  // gestellt, sonst waere die Deckelung schon vorher aktiv geworden.
  const eigenerAnteil = partie.topf / sitze.length;

  if (gewinner.length === 1) {
    const sieger = gewinner[0]!;
    const verlierer = gegnerVon(partie, sieger);
    jetons[sieger] = (jetons[sieger] ?? 0) + partie.topf;
    gewinn[sieger] = partie.topf - eigenerAnteil;
    gewinn[verlierer] = -eigenerAnteil;
  } else {
    const ohneKnopf = gegnerVon(partie, partie.geber);
    const haelfte = Math.floor(partie.topf / 2);
    const rest = partie.topf - haelfte * 2;
    for (const sitz of sitze) {
      const anteil = haelfte + (sitz === ohneKnopf ? rest : 0);
      jetons[sitz] = (jetons[sitz] ?? 0) + anteil;
      gewinn[sitz] = anteil - eigenerAnteil;
    }
  }

  return {
    ...partie,
    jetons,
    // Ausgezahlt, also leer — siehe die Begruendung in beendeDurchAufgabe.
    topf: 0,
    dran: null,
    gehandelt: [],
    ergebnis: {
      gewinner,
      durchAufgabe: false,
      topf: partie.topf,
      gezeigt,
      bewertung,
      gewinn,
    },
  };
}

/**
 * Dauer der Schaupause zwischen zwei Haenden, oder null.
 *
 * Zwei Laengen, und der Unterschied ist keine Kosmetik: Bei einer Aufgabe
 * gibt es nichts zu lesen, es geht sofort weiter. Beim Zeigen liegen zwei
 * fremde Blaetter auf dem Tisch, und wer sie nicht sieht, versteht nicht,
 * warum sein Stapel kleiner geworden ist.
 */
export function pauseDauerMs(partie: EasyPokerPartie): number | null {
  if (partie.fertig || partie.ergebnis === null) return null;
  return partie.ergebnis.durchAufgabe ? 1600 : 3400;
}

/**
 * Ende der Schaupause: entweder die naechste Hand oder das Ende der Partie.
 *
 * Der letzte Ausgang bleibt dabei stehen. Wer die entscheidende Hand verliert,
 * soll auf dem Abschlussblatt noch sehen, woran es lag.
 */
export function beendePause(partie: EasyPokerPartie): EasyPokerPartie {
  if (partie.ergebnis === null || partie.fertig) return partie;

  const abgeschlossen = partie.abgeschlossen + 1;
  const pleite = sitzeVon(partie).some((sitz) => (partie.jetons[sitz] ?? 0) <= 0);

  if (pleite || partie.handNr >= partie.handMax) {
    return { ...partie, abgeschlossen, fertig: true, dran: null };
  }

  return gibHand({
    ...partie,
    abgeschlossen,
    handNr: partie.handNr + 1,
    geber: gegnerVon(partie, partie.geber),
    ergebnis: null,
  });
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

export function erstellePartie(
  regeln: EasyPokerRegeln,
  sitze: readonly number[],
  saat: Saat,
  handMax: number,
): EasyPokerPartie {
  const geordnet = [...sitze].sort((a, b) => a - b);
  // Wer den ersten Knopf hat, entscheidet der Seed und nicht die
  // Sitzreihenfolge — sonst faenge der Gastgeber jede Partie in Position an.
  const zufall = handZufall(saat, 0);
  const geber = geordnet[Math.floor(zufall() * geordnet.length)] ?? 0;

  const grundstellung: EasyPokerPartie = {
    regeln,
    saat,
    handMax,
    handNr: 1,
    abgeschlossen: 0,
    geber,
    jetons: Object.fromEntries(geordnet.map((s) => [s, regeln.startJetons])),
    hand: {},
    brett: [],
    reststapel: [],
    strasse: 'preflop',
    einsatz: Object.fromEntries(geordnet.map((s) => [s, 0])),
    topf: 0,
    dran: null,
    gehandelt: [],
    letzteErhoehung: regeln.grosserBlind,
    letzteAktion: null,
    ergebnis: null,
    namen: Object.fromEntries(geordnet.map((s) => [s, ''])),
    leftSeats: [],
    fertig: false,
  };

  return gibHand(grundstellung);
}

export function markiereVerlassen(partie: EasyPokerPartie, sitz: number): EasyPokerPartie {
  if (partie.leftSeats.includes(sitz)) return partie;
  return { ...partie, leftSeats: [...partie.leftSeats, sitz] };
}

/**
 * Platzierungen. Gewertet wird der Jetonstand — mehr gibt es bei einem Duell
 * nicht zu ordnen. Gleichstand ergibt zweimal Platz eins.
 */
export function platzierungen(
  partie: EasyPokerPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const reihe = sitzeVon(partie)
    .map((seat) => ({
      seat,
      points: partie.jetons[seat] ?? 0,
      left: partie.leftSeats.includes(seat),
    }))
    .sort((a, b) => b.points - a.points);

  let platz = 0;
  let letztePunkte: number | null = null;
  return reihe.map((eintrag, index) => {
    if (letztePunkte === null || eintrag.points !== letztePunkte) {
      platz = index + 1;
      letztePunkte = eintrag.points;
    }
    return { ...eintrag, place: platz };
  });
}

/** Sieger der Partie, oder null bei Gleichstand bzw. laufender Partie. */
export function sieger(partie: EasyPokerPartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster || !zweiter) return null;
  return erster.points === zweiter.points ? null : erster.seat;
}
