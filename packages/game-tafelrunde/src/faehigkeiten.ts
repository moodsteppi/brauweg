/**
 * Die Faehigkeiten der Einheiten — WAS sie tun. WIE sie im Kampf wirken,
 * steht in kampf.ts (`wirke`), denn nur dort gibt es Streiter, Plaetze und
 * eine Uhr.
 *
 * ENTSCHIEDEN VON ROBIN AM 27.11.2026 (docs/TAFELRUNDE-NEU-UMSETZUNG.md):
 * "nicht unbedingt alle, aber gerne viele", "nicht so krass", "ausgeglichen",
 * "es kann auch Schuetzen geben, die nur angreifen und einen passiven Bonus
 * haben". Daraus: 16 aktive, 3 passive, 2 Einheiten ohne Faehigkeit.
 *
 * MANA: Eine aktive Faehigkeit laedt sich aus Treffern auf — eigenen
 * (`MANA_JE_ANGRIFF`) und erlittenen (`MANA_JE_TREFFER`). Ist der Balken voll,
 * wirkt die Einheit beim naechsten Angriff statt zuzuschlagen, und der Balken
 * leert sich. Das ist der Ablauf des Genres und damit der, den Spieler
 * erwarten.
 *
 * DIE ZAHLEN SIND MASSVOLL GEWAEHLT und am Bot-Turnier geprueft
 * (docs/TAFELRUNDE-FAEHIGKEITEN.md). Sie wachsen nicht eigens mit der Stufe:
 * Schaden und Heilung gehen vom Angriff aus, Schilde vom Leben, und beides
 * waechst mit der Stufe ohnehin (`STUFEN_FAKTOR`).
 *
 * Namen und Texte stehen hier auf Deutsch, wie die Einheitennamen im Katalog;
 * die englische Fassung steht in der Sprachdatei des Clients.
 */

import type { EinheitId } from './katalog.js';

/** Wie viel Mana ein eigener Angriff oder eine eigene Heilung bringt. */
export const MANA_JE_ANGRIFF = 10;
/** Wie viel Mana ein erlittener Treffer bringt. */
export const MANA_JE_TREFFER = 5;

export type FaehigkeitId =
  | 'schildwall'
  | 'panzer'
  | 'jederVierte'
  | 'kopfnuss'
  | 'funkenwurf'
  | 'kraeuterwolke'
  | 'speerstoss'
  | 'axtwirbel'
  | 'doppelpfeil'
  | 'zielschuss'
  | 'frostring'
  | 'schattensprung'
  | 'ersterTreffer'
  | 'runenschild'
  | 'stampfer'
  | 'feuerstrahl'
  | 'kettenblitz'
  | 'seelenraub'
  | 'klingentanz'
  | 'lichtsegen';

export interface Faehigkeit {
  readonly id: FaehigkeitId;
  readonly name: string;
  /** Ein Satz, wie er im Einheitenblatt steht. */
  readonly text: string;
  /** Passiv wirkt immer und braucht kein Mana. */
  readonly art: 'aktiv' | 'passiv';
  /** Volles Mana. Bei passiven 0. */
  readonly mana: number;
}

function aktiv(id: FaehigkeitId, name: string, mana: number, text: string): Faehigkeit {
  return { id, name, text, art: 'aktiv', mana };
}

function passiv(id: FaehigkeitId, name: string, text: string): Faehigkeit {
  return { id, name, text, art: 'passiv', mana: 0 };
}

/**
 * Je Einheit ihre Faehigkeit oder null.
 *
 * Ein Record ueber ALLE Kennungen und kein Feld am Katalogeintrag: So meldet
 * der Uebersetzer jede Einheit, die hier vergessen wurde, statt dass sie still
 * ohne Faehigkeit bleibt.
 */
export const FAEHIGKEITEN: Readonly<Record<EinheitId, Faehigkeit | null>> = {
  // --- 1 Gold ---------------------------------------------------------------
  dorfwache: aktiv('schildwall', 'Schildwall', 60, 'Hebt den Schild: kurz deutlich mehr Rüstung.'),
  schildknappe: aktiv('panzer', 'Panzer einziehen', 70, 'Zieht sich in den Panzer zurück und nimmt kurz nur halben Schaden.'),
  astschuetze: passiv('jederVierte', 'Volltreffer', 'Jeder vierte Schuss trifft doppelt.'),
  steinschleuderer: aktiv('kopfnuss', 'Kopfnuss', 50, 'Ein gezielter Stein betäubt das Ziel kurz.'),
  funkenlehrling: aktiv('funkenwurf', 'Funkenwurf', 60, 'Wirft Funken auf das Ziel, die auf einen Nachbarn überspringen.'),
  irrlicht: null,
  gassendieb: null,
  moosheiler: aktiv('kraeuterwolke', 'Kräuterwolke', 70, 'Heilt alle Verbündeten auf den Nachbarfeldern.'),
  // --- 2 Gold ---------------------------------------------------------------
  hainwaechterin: aktiv('speerstoss', 'Speerstoß', 60, 'Durchbohrt das Ziel und trifft auch den Gegner dahinter.'),
  grimmbart: aktiv('axtwirbel', 'Axtwirbel', 70, 'Wirbelt die Axt und trifft alle Gegner ringsum.'),
  bogenmeisterin: aktiv('doppelpfeil', 'Doppelpfeil', 50, 'Schießt zwei Pfeile auf zwei verschiedene Ziele.'),
  nachtpfeil: aktiv('zielschuss', 'Zielschuss', 70, 'Trifft den schwächsten Gegner auf dem Feld, egal wie weit weg.'),
  frostweberin: aktiv('frostring', 'Frostring', 70, 'Trifft das Ziel und verlangsamt alle Gegner drumherum.'),
  schattenklinge: aktiv('schattensprung', 'Schattensprung', 60, 'Springt zum hintersten Gegner und greift ihn an.'),
  knochenspaeher: passiv('ersterTreffer', 'Überfall', 'Der erste Treffer im Kampf zählt doppelt.'),
  runenpriester: aktiv('runenschild', 'Runenschild', 60, 'Legt dem schwächsten Verbündeten einen Schild um.'),
  // --- 3 Gold ---------------------------------------------------------------
  wurzelriese: aktiv('stampfer', 'Stampfer', 80, 'Stampft auf und betäubt alle Gegner ringsum.'),
  drachenkind: aktiv('feuerstrahl', 'Feuerstrahl', 70, 'Speit Feuer in einer Linie bis zum Ziel.'),
  sturmrufer: aktiv('kettenblitz', 'Kettenblitz', 80, 'Ein Blitz springt nacheinander auf drei Gegner.'),
  grabfuerstin: aktiv('seelenraub', 'Seelenraub', 70, 'Raubt dem Ziel Leben und heilt sich um die Hälfte.'),
  klingentaenzerin: aktiv('klingentanz', 'Klingentanz', 70, 'Drei schnelle Hiebe auf das Ziel, dazu einer auf jeden Nachbarn.'),
  lichtwahrerin: aktiv('lichtsegen', 'Lichtsegen', 60, 'Heilt alle Verbündeten und sich selbst.'),
};

export function faehigkeitVon(id: EinheitId): Faehigkeit | null {
  return FAEHIGKEITEN[id];
}

/**
 * Die Stellschrauben der Wirkungen, alle an einer Stelle.
 *
 * Zeiten in SPIELsekunden: Der Kampf rechnet sie mit dem Zeitraffer um
 * (`dauerImKampf` in kampf.ts), damit "drei Sekunden" bei doppeltem Tempo
 * auch drei Angriffe lang halten und nicht sechs.
 */
export const WIRKUNG = {
  schildwallRuestung: 30,
  schildwallSek: 3,
  panzerSek: 2,
  jederVierteFaktor: 2,
  kopfnussBetaeubungSek: 0.5,
  funkenwurfZiel: 1.4,
  funkenwurfNachbar: 0.7,
  kraeuterwolkeHeilung: 1.0,
  speerstossZiel: 1.3,
  speerstossDahinter: 0.9,
  axtwirbel: 1.0,
  doppelpfeil: 1.0,
  zielschuss: 1.8,
  frostringZiel: 1.2,
  frostringLangsamProzent: 30,
  frostringSek: 3,
  schattensprung: 1.3,
  ersterTrefferFaktor: 2,
  runenschildLebenProzent: 25,
  stampferSchaden: 0.6,
  stampferBetaeubungSek: 1,
  feuerstrahl: 1.3,
  kettenblitz: [1.3, 1.0, 0.7] as readonly number[],
  seelenraub: 1.6,
  seelenraubHeilAnteil: 0.5,
  klingentanzHieb: 0.55,
  klingentanzHiebe: 3,
  lichtsegenHeilung: 1.5,
} as const;
