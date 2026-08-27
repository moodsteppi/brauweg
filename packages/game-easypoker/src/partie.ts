/**
 * Spielzustand und Regeln von Easy Poker.
 *
 * Texas Hold'em fuer zwei bis sechs Sitze, auf das Noetigste eingedampft:
 * zwei Handkarten, fuenf Gemeinschaftskarten, vier Setzrunden — und genau
 * VIER Schaltflaechen, weil eine Setzleiste mit Schieberegler auf einem Handy
 * niemand bedient. Wie viel ein Erhoehen kostet, rechnet deshalb dieses
 * Modul aus und schickt den Betrag mit der erlaubten Aktion mit (siehe
 * `erlaubteZuege`).
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
  /**
   * `betrag` ist der Vorschlag des Servers; `min`/`max` stecken die Spanne
   * ab, in der der Spieler den Betrag selbst waehlen darf (Mindest-Erhoehung
   * bis all-in). Beide stehen nur in `legalActions` — die zurueckkommende
   * Aktion traegt allein den gewaehlten `betrag`, und der wird gegen die
   * Spanne geprueft.
   */
  | { readonly typ: 'setzen'; readonly betrag: number; readonly min?: number; readonly max?: number }
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
  /**
   * Sitze, die mindestens einen umkaempften Topf gewonnen haben.
   * Bei geteiltem Topf mehrere; wer nur ungerufene Jetons zurueckbekommt,
   * steht nicht hier.
   */
  readonly gewinner: readonly number[];
  /** Alle bis auf einen haben aufgegeben — dann werden keine Karten gezeigt. */
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
  /** Sitz mit dem Knopf. Zu dritt und mehr zahlt LINKS davon den kleinen Blind. */
  readonly geber: number;
  /** Wer in DIESER Hand den kleinen Blind gestellt hat. */
  readonly kleinerSitz: number;
  /** Wer in DIESER Hand den grossen Blind gestellt hat. */
  readonly grosserSitz: number;
  /** Jetons HINTER dem laufenden Einsatz. */
  readonly jetons: Readonly<Record<number, number>>;
  readonly hand: Readonly<Record<number, readonly Karte[]>>;
  readonly brett: readonly Karte[];
  /** Rest des Gebens. Daraus kommen Flop, Turn und River. */
  readonly reststapel: readonly Karte[];
  readonly strasse: Strasse;
  /** Einsatz in DIESER Strasse. Am Strassenende wandert er in den Topf. */
  readonly einsatz: Readonly<Record<number, number>>;
  /**
   * Was jeder Sitz in DIESER Hand insgesamt in den Topf gelegt hat
   * (abgeschlossene Strassen). Grundlage der Nebentoepfe.
   */
  readonly beitrag: Readonly<Record<number, number>>;
  readonly topf: number;
  readonly dran: number | null;
  /** Wer seit der letzten Erhoehung schon gehandelt hat. */
  readonly gehandelt: readonly number[];
  /** Betrag der letzten Erhoehung — Untergrenze fuer die naechste. */
  readonly letzteErhoehung: number;
  readonly letzteAktion: LetzteAktion | null;
  /** Sitze, die in dieser Hand noch dabei sind (nicht gepasst). */
  readonly imSpiel: readonly number[];
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

/** Sitze, die noch Jetons haben — nur die bekommen die naechste Hand. */
export function lebendeSitze(partie: EasyPokerPartie): number[] {
  return sitzeVon(partie).filter((sitz) => (partie.jetons[sitz] ?? 0) > 0);
}

/**
 * Der Sitz links vom angegebenen, in Sitzreihenfolge.
 *
 * "Links" ist die naechste hoehere Nummer, am Ende zurueck auf den ersten —
 * dieselbe Umlaufordnung wie am echten Tisch.
 */
export function linksVon(sitz: number, sitze: readonly number[]): number {
  const geordnet = [...sitze].sort((a, b) => a - b);
  const stelle = geordnet.indexOf(sitz);
  if (stelle < 0) return geordnet[0] ?? sitz;
  return geordnet[(stelle + 1) % geordnet.length]!;
}

/** Sitze im Umlauf, beginnend links vom angegebenen. */
function reihumLinksVon(sitz: number, sitze: readonly number[]): number[] {
  const geordnet = [...sitze].sort((a, b) => a - b);
  if (geordnet.length === 0) return [];
  const start = linksVon(sitz, geordnet);
  const stelle = geordnet.indexOf(start);
  if (stelle < 0) return geordnet;
  return [...geordnet.slice(stelle), ...geordnet.slice(0, stelle)];
}

/**
 * Der andere Sitz. Zu dritt und mehr der naechste in der Nummerierung —
 * bewusst kein "der Gegner", nur ein bequemer Alias fuer die alten Tests
 * zu zweit.
 */
export function gegnerVon(partie: EasyPokerPartie, sitz: number): number {
  return sitzeVon(partie).find((s) => s !== sitz) ?? sitz;
}

function hoechsterEinsatz(partie: EasyPokerPartie): number {
  return Math.max(0, ...sitzeVon(partie).map((s) => partie.einsatz[s] ?? 0));
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

function leereZahl(sitze: readonly number[], wert = 0): Record<number, number> {
  return Object.fromEntries(sitze.map((s) => [s, wert]));
}

/**
 * Kann dieser Sitz in der laufenden Strasse noch handeln?
 *
 * Drei Faelle, und der dritte ist der, an dem eine selbstgebaute Setzrunde
 * fast immer haengt: Vor dem Flop hat der grosse Blind das Recht zu erhoehen,
 * auch wenn bisher nur mitgegangen wurde — die Einsaetze sind dann gleich,
 * gehandelt hat er aber noch nicht.
 */
function kannHandeln(partie: EasyPokerPartie, sitz: number): boolean {
  if (!partie.imSpiel.includes(sitz)) return false;
  if ((partie.jetons[sitz] ?? 0) <= 0) return false;
  if (!partie.gehandelt.includes(sitz)) return true;
  return (partie.einsatz[sitz] ?? 0) < hoechsterEinsatz(partie);
}

function gegebeneSitze(partie: EasyPokerPartie): number[] {
  return sitzeVon(partie).filter((sitz) => (partie.hand[sitz] ?? []).length > 0);
}

/** Kleiner Blind: zu zweit der Knopf, sonst links vom Knopf. */
export function kleinerBlindVon(geber: number, gegeben: readonly number[]): number {
  if (gegeben.length <= 2) return geber;
  return linksVon(geber, gegeben);
}

/** Grosser Blind: links vom kleinen. */
export function grosserBlindVon(geber: number, gegeben: readonly number[]): number {
  return linksVon(kleinerBlindVon(geber, gegeben), gegeben);
}

// ---------------------------------------------------------------------------
// Geben
// ---------------------------------------------------------------------------

/**
 * Setzt eine neue Hand auf: mischen, geben, Blinds stellen.
 *
 * Nur Sitze mit Jetons bekommen Karten. Die Blinds werden auf den Stapel
 * gedeckelt: Wer weniger hat als der grosse Blind, geht mit dem Setzen
 * all-in — und darf trotzdem noch gewinnen.
 */
function gibHand(partie: EasyPokerPartie): EasyPokerPartie {
  const alle = sitzeVon(partie);
  const lebende = alle.filter((sitz) => (partie.jetons[sitz] ?? 0) > 0);
  const geber = lebende.includes(partie.geber)
    ? partie.geber
    : (reihumLinksVon(partie.geber, alle).find((sitz) => lebende.includes(sitz)) ?? lebende[0] ?? 0);

  const zufall = handZufall(partie.saat, partie.handNr);
  const blatt = mische(erstelleBlatt(), zufall);

  const hand: Record<number, readonly Karte[]> = {};
  for (const sitz of alle) hand[sitz] = [];
  let naechste = 0;
  // Reihum geben, beginnend links vom Geber — wie am echten Tisch.
  for (const sitz of reihumLinksVon(geber, lebende)) {
    hand[sitz] = [blatt[naechste++]!, blatt[naechste++]!];
  }

  const kleinerSitz = kleinerBlindVon(geber, lebende);
  const grosserSitz = grosserBlindVon(geber, lebende);
  const kleinerBetrag = Math.min(partie.regeln.kleinerBlind, partie.jetons[kleinerSitz] ?? 0);
  const grosserBetrag = Math.min(partie.regeln.grosserBlind, partie.jetons[grosserSitz] ?? 0);

  const jetons: Record<number, number> = { ...partie.jetons };
  jetons[kleinerSitz] = (jetons[kleinerSitz] ?? 0) - kleinerBetrag;
  jetons[grosserSitz] = (jetons[grosserSitz] ?? 0) - grosserBetrag;

  const einsatz = leereZahl(alle);
  einsatz[kleinerSitz] = kleinerBetrag;
  einsatz[grosserSitz] = grosserBetrag;

  const gegeben: EasyPokerPartie = {
    ...partie,
    geber,
    kleinerSitz,
    grosserSitz,
    hand,
    brett: [],
    reststapel: blatt.slice(naechste),
    strasse: 'preflop',
    jetons,
    einsatz,
    beitrag: leereZahl(alle),
    topf: 0,
    // Blinds sind kein Handeln: Wer den grossen Blind gestellt hat, darf
    // spaeter trotzdem noch erhoehen.
    gehandelt: [],
    letzteErhoehung: partie.regeln.grosserBlind,
    letzteAktion: null,
    imSpiel: [...lebende],
    ergebnis: null,
    dran: null,
  };

  return starteStrasse(gegeben, 'preflop');
}

/**
 * Beginn einer Setzrunde: Wer zuerst handelt, und ob ueberhaupt jemand kann.
 *
 * Vor dem Flop handelt links vom grossen Blind zuerst (zu zweit also der
 * Knopf). Danach handelt links vom Knopf zuerst. Diese Umkehr ist der
 * Positionsvorteil des Spiels und deshalb die einzige Stelle, an der die
 * Reihenfolge steht.
 */
function starteStrasse(partie: EasyPokerPartie, strasse: Strasse): EasyPokerPartie {
  const mitStrasse: EasyPokerPartie = { ...partie, strasse };
  const referenz = strasse === 'preflop' ? partie.grosserSitz : partie.geber;
  const dran = reihumLinksVon(referenz, sitzeVon(mitStrasse)).find((sitz) =>
    kannHandeln(mitStrasse, sitz),
  );
  if (dran === undefined) return schliesseStrasse(mitStrasse);
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
 * der eigene Stapel und das, was der reichste noch aktive Gegner ueberhaupt
 * bezahlen kann. Ohne den zweiten Deckel setzte man Jetons in einen Topf,
 * den niemand mehr mitgehen kann, und bekaeme sie am Ende zurueck: eine
 * Erhoehung, die keine ist.
 */
export function setzKosten(partie: EasyPokerPartie, sitz: number): number | null {
  const eigen = partie.jetons[sitz] ?? 0;
  if (eigen <= 0) return null;

  const gegner = partie.imSpiel.filter((s) => s !== sitz);
  if (gegner.length === 0) return null;

  const bisDeckel = Math.max(
    0,
    ...gegner.map(
      (g) => (partie.einsatz[g] ?? 0) + (partie.jetons[g] ?? 0) - (partie.einsatz[sitz] ?? 0),
    ),
  );

  const fehlt = zuZahlen(partie, sitz);
  if (bisDeckel <= fehlt) return null;

  const topfNachMitgehen = topfGesamt(partie) + fehlt;
  const erhoehung = Math.max(
    partie.regeln.grosserBlind,
    partie.letzteErhoehung,
    Math.round(topfNachMitgehen / 2),
  );

  const kosten = Math.min(fehlt + erhoehung, eigen, bisDeckel);
  return kosten > fehlt ? kosten : null;
}

/**
 * Die Spanne, in der ein Spieler den Setzbetrag selbst waehlen darf.
 *
 * `min` ist Mitgehen plus Mindest-Erhoehung (grosser Blind bzw. die letzte
 * Erhoehung — die uebliche No-Limit-Regel), `max` der eigene Stapel, beides
 * gedeckelt auf das, was die Gegner ueberhaupt noch stellen koennen (die
 * Begruendung steht an `setzKosten`). Reicht der Stapel nicht bis zur
 * Mindest-Erhoehung, ist all-in trotzdem erlaubt: min faellt dann auf max.
 *
 * null unter denselben Bedingungen, unter denen es kein `setzen` gibt.
 */
export function setzSpanne(
  partie: EasyPokerPartie,
  sitz: number,
): { min: number; max: number } | null {
  const eigen = partie.jetons[sitz] ?? 0;
  if (eigen <= 0) return null;

  const gegner = partie.imSpiel.filter((s) => s !== sitz);
  if (gegner.length === 0) return null;

  const bisDeckel = Math.max(
    0,
    ...gegner.map(
      (g) => (partie.einsatz[g] ?? 0) + (partie.jetons[g] ?? 0) - (partie.einsatz[sitz] ?? 0),
    ),
  );

  const fehlt = zuZahlen(partie, sitz);
  if (bisDeckel <= fehlt) return null;

  const max = Math.min(eigen, bisDeckel);
  const mindest = fehlt + Math.max(partie.regeln.grosserBlind, partie.letzteErhoehung);
  const min = Math.min(mindest, max);
  return max > fehlt ? { min, max } : null;
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
  const spanne = setzSpanne(partie, sitz);
  if (kosten !== null && spanne !== null) {
    zuege.push({ typ: 'setzen', betrag: kosten, min: spanne.min, max: spanne.max });
  }

  return zuege;
}

function istErlaubt(partie: EasyPokerPartie, sitz: number, aktion: EasyPokerAktion): boolean {
  // Setzen prueft gegen die Spanne, nicht gegen den einen Vorschlag: Der
  // Spieler darf den Betrag selbst waehlen. Ganzzahlig muss er sein — ein
  // halber Jeton existiert nicht.
  if (aktion.typ === 'setzen') {
    const spanne = setzSpanne(partie, sitz);
    return (
      amZug(partie) === sitz &&
      spanne !== null &&
      Number.isInteger(aktion.betrag) &&
      aktion.betrag >= spanne.min &&
      aktion.betrag <= spanne.max
    );
  }
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
    const imSpiel = partie.imSpiel.filter((s) => s !== sitz);
    const weiter: EasyPokerPartie = {
      ...partie,
      imSpiel,
      letzteAktion: { sitz, art: 'passen', betrag: null },
    };
    if (imSpiel.length <= 1) return beendeDurchAufgabe(weiter);
    return naechsterSchritt(weiter);
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
    // Ein Erhoehen setzt die Runde zurueck: Jeder andere muss noch einmal ran.
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
 * Nach jedem Zug: naechster Sitz dran, oder Strasse zu Ende.
 *
 * Die Suche laeuft linksherum und ueberspringt, wer nicht mehr handeln kann
 * (gepasst, all-in, oder schon gehandelt bei gleichem Einsatz).
 */
function naechsterSchritt(partie: EasyPokerPartie): EasyPokerPartie {
  const akt = partie.dran ?? 0;
  const dran = reihumLinksVon(akt, sitzeVon(partie)).find((sitz) => kannHandeln(partie, sitz));
  if (dran !== undefined) return { ...partie, dran };
  return schliesseStrasse(partie);
}

/**
 * Strassenende: Einsaetze in den Topf, dann die naechste Karte — oder das
 * Zeigen.
 *
 * Anders als zu zweit gibt es hier KEINE Rueckgabe "des ueberzaehligen
 * Teils" an dieser Stelle. Wer mehr gesetzt hat, als ein anderer stellen
 * konnte, landet in einem Nebentopf, und den loest `zahleAus` am Handende.
 */
function schliesseStrasse(partie: EasyPokerPartie): EasyPokerPartie {
  const gesammelt = sammleEinsaetze(partie);

  const koennenNoch = gesammelt.imSpiel.filter((sitz) => (gesammelt.jetons[sitz] ?? 0) > 0);
  const naechste = STRASSEN[STRASSEN.indexOf(gesammelt.strasse) + 1];

  if (koennenNoch.length <= 1 || naechste === undefined) {
    return zahleAus(deckeRestlichesBrettAuf(gesammelt), false);
  }

  const mitKarten = deckeAuf(gesammelt, NEUE_BRETTKARTEN[naechste]);
  return starteStrasse(mitKarten, naechste);
}

function sammleEinsaetze(partie: EasyPokerPartie): EasyPokerPartie {
  const sitze = sitzeVon(partie);
  const beitrag: Record<number, number> = { ...partie.beitrag };
  let topf = partie.topf;
  for (const sitz of sitze) {
    const gesetzt = partie.einsatz[sitz] ?? 0;
    beitrag[sitz] = (beitrag[sitz] ?? 0) + gesetzt;
    topf += gesetzt;
  }
  return {
    ...partie,
    beitrag,
    topf,
    einsatz: leereZahl(sitze),
    gehandelt: [],
    letzteErhoehung: partie.regeln.grosserBlind,
    letzteAktion: null,
    dran: null,
  };
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
 * Alle bis auf einen haben aufgegeben.
 *
 * Karten werden dabei NICHT gezeigt. Das ist keine Kosmetik: Wer sieht, mit
 * welchen Blaettern die anderen setzen, spielt danach ein anderes Spiel.
 */
function beendeDurchAufgabe(partie: EasyPokerPartie): EasyPokerPartie {
  return zahleAus(sammleEinsaetze(partie), true);
}

function besteSitze(
  kandidaten: readonly number[],
  bewertung: Readonly<Record<number, Bewertung>>,
): number[] {
  const erster = kandidaten[0];
  if (erster === undefined) return [];
  let beste: number[] = [erster];
  for (const sitz of kandidaten.slice(1)) {
    const vergleich = vergleicheHaende(bewertung[sitz]!, bewertung[beste[0]!]!);
    if (vergleich > 0) beste = [sitz];
    else if (vergleich === 0) beste.push(sitz);
  }
  return beste;
}

/**
 * Toepfe bauen und auszahlen.
 *
 * Ein Topf je Einsatzstufe: Wer all-in weniger setzen konnte als die anderen,
 * spielt nur um den Topf bis zu seinem Beitrag mit. Der Rest ist ein
 * Nebentopf unter denen, die weitergesetzt haben. Ungerufene Jetons — der
 * einzige "Sieger" einer Stufe — kommen an den Sitz zurueck und zaehlen
 * nicht als Gewinn der Hand.
 *
 * Ungerade Jetons in einem geteilten Topf gehen an den Sitz, der links vom
 * Knopf als Erstes unter den Gewinnern sitzt. Zu zweit ist das der Sitz
 * ohne Knopf — dieselbe Regel wie zuvor.
 */
function zahleAus(partie: EasyPokerPartie, durchAufgabe: boolean): EasyPokerPartie {
  const sitze = sitzeVon(partie);
  const berechtigt = partie.imSpiel;

  const bewertung: Record<number, Bewertung> = {};
  const gezeigt: Record<number, readonly Karte[]> = {};
  if (!durchAufgabe) {
    for (const sitz of berechtigt) {
      const eigene = partie.hand[sitz] ?? [];
      bewertung[sitz] = besteHand([...eigene, ...partie.brett]);
      gezeigt[sitz] = eigene;
    }
  }

  const stufen = [...new Set(sitze.map((s) => partie.beitrag[s] ?? 0).filter((v) => v > 0))].sort(
    (a, b) => a - b,
  );

  const jetons: Record<number, number> = { ...partie.jetons };
  const erhalten = leereZahl(sitze);
  const gewinner: number[] = [];

  let vorher = 0;
  for (const stufe of stufen) {
    const zahler = sitze.filter((s) => (partie.beitrag[s] ?? 0) >= stufe);
    const amount = (stufe - vorher) * zahler.length;
    vorher = stufe;
    const kandidaten = zahler.filter((s) => berechtigt.includes(s));
    if (kandidaten.length === 0 || amount <= 0) continue;

    const siegerSitze =
      durchAufgabe || kandidaten.length === 1
        ? [...kandidaten]
        : besteSitze(kandidaten, bewertung);

    if (kandidaten.length >= 2 || durchAufgabe) {
      for (const sitz of siegerSitze) {
        if (!gewinner.includes(sitz)) gewinner.push(sitz);
      }
    }

    const anteil = Math.floor(amount / siegerSitze.length);
    let rest = amount - anteil * siegerSitze.length;
    const reihenfolge = reihumLinksVon(partie.geber, sitze).filter((s) => siegerSitze.includes(s));
    for (const sitz of reihenfolge) {
      const extra = rest > 0 ? 1 : 0;
      if (rest > 0) rest -= 1;
      const teil = anteil + extra;
      jetons[sitz] = (jetons[sitz] ?? 0) + teil;
      erhalten[sitz] = (erhalten[sitz] ?? 0) + teil;
    }
  }

  const gewinn = leereZahl(sitze);
  for (const sitz of sitze) {
    gewinn[sitz] = (erhalten[sitz] ?? 0) - (partie.beitrag[sitz] ?? 0);
  }

  return {
    ...partie,
    jetons,
    // Ausgezahlt, also leer — dieselben Jetons duerfen nicht noch einmal im
    // Topf stehen, sonst zaehlte die Summe sie doppelt.
    topf: 0,
    einsatz: leereZahl(sitze),
    dran: null,
    gehandelt: [],
    ergebnis: {
      gewinner,
      durchAufgabe,
      topf: sitze.reduce((summe, s) => summe + (partie.beitrag[s] ?? 0), 0),
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
 * gibt es nichts zu lesen, es geht sofort weiter. Beim Zeigen liegen fremde
 * Blaetter auf dem Tisch, und wer sie nicht sieht, versteht nicht, warum
 * sein Stapel kleiner geworden ist.
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
 *
 * Vorbei ist die Partie, wenn weniger als zwei Sitze noch Jetons haben —
 * nicht schon, wenn der Erste pleite ist. Sonst waere ein Sechser-Tisch nach
 * der ersten Pleite zu Ende.
 */
export function beendePause(partie: EasyPokerPartie): EasyPokerPartie {
  if (partie.ergebnis === null || partie.fertig) return partie;

  const abgeschlossen = partie.abgeschlossen + 1;
  const nachher: EasyPokerPartie = { ...partie, abgeschlossen, ergebnis: partie.ergebnis };
  const lebende = lebendeSitze(nachher);

  if (lebende.length < 2 || partie.handNr >= partie.handMax) {
    return { ...nachher, fertig: true, dran: null };
  }

  const naechsterGeber =
    reihumLinksVon(partie.geber, sitzeVon(partie)).find((sitz) => lebende.includes(sitz)) ??
    lebende[0]!;

  return gibHand({
    ...nachher,
    handNr: partie.handNr + 1,
    geber: naechsterGeber,
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
    kleinerSitz: geber,
    grosserSitz: geber,
    jetons: Object.fromEntries(geordnet.map((s) => [s, regeln.startJetons])),
    hand: {},
    brett: [],
    reststapel: [],
    strasse: 'preflop',
    einsatz: leereZahl(geordnet),
    beitrag: leereZahl(geordnet),
    topf: 0,
    dran: null,
    gehandelt: [],
    letzteErhoehung: regeln.grosserBlind,
    letzteAktion: null,
    imSpiel: [...geordnet],
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
 * Platzierungen. Gewertet wird der Jetonstand. Gleichstand ergibt denselben
 * Platz mehrfach.
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

/** Sieger der Partie, oder null bei Gleichstand auf Platz eins bzw. laufender Partie. */
export function sieger(partie: EasyPokerPartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster) return null;
  if (!zweiter) return erster.seat;
  return erster.points === zweiter.points ? null : erster.seat;
}
