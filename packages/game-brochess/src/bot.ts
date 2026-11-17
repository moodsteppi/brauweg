/**
 * Der Computergegner von BroChess — und zugleich der Ersatzzug der Plattform.
 *
 * Bis zum 13.10.2026 stand hier nur ein Ersatzzug ("der erste legale Zug"):
 * genug, damit ein Tisch weiterlaeuft, wenn jemand geht, aber kein Gegner.
 * Seit die App BroChess zum Alleinspielen gegen einen Bot anbietet (Emile,
 * 13.10.2026), rechnet er: Alpha-Beta-Suche ueber Material und
 * Stellungstabellen, Schlagabtausch bis zur Ruhe ausgerechnet.
 *
 * **Deterministisch.** Ein Spielmodul hat keinen Zufall ausser der Saat, und
 * `botAction` bekommt keine. Gleiche Sicht und gleiche Stufe ergeben darum
 * denselben Zug; bei Gleichstand gewinnt der zuerst erzeugte Zug.
 *
 * **Begrenzt ueber Knoten, nicht ueber die Uhr.** Der Bot rechnet im
 * Serverprozess und haelt dort alle anderen Tische an, solange er denkt. Eine
 * Zeitgrenze waere nicht deterministisch (schneller Rechner, anderer Zug);
 * eine Knotengrenze ist es und deckelt die Rechenzeit trotzdem. Reicht sie
 * nicht fuer die volle Tiefe, gilt das Ergebnis der letzten fertigen Tiefe.
 *
 * Die Stufen der Plattform (`BotLevel`):
 * - anfaenger: eine Halbzug-Tiefe, nur Material — nimmt, was haengt, und
 *   uebersieht jede Drohung.
 * - standard: zwei Halbzuege mit Stellungsgefuehl.
 * - experte: drei Halbzuege.
 * - genie: vier Halbzuege.
 */

import type { BotLevel } from '@brauweg/game-api';

import {
  type Farbe,
  type Stellung,
  type Zug,
  UMWANDLUNGEN,
  ausFen,
  farbeVon,
  feldIndex,
  feldName,
  imSchach,
  legaleZuege,
  linieVon,
  pseudoZuege,
  reiheVon,
  wendeAn,
} from './brett.js';
import {
  type GeheimZug,
  type GeheimeDame,
  type SecretDameStand,
  aktiv,
  imSchachGeheim,
  legaleZuegeGeheim,
  schlaegtKoenig,
  standNachZug,
  wendeAnGeheim,
} from './geheim.js';
import { SCHACH_ZIEL } from './dreischach.js';
import { nebelZuege, schlaegtKoenigNebel } from './nebel.js';
import { abstandZumHuegel, zugErreichtHuegel } from './huegel.js';
import type { BroChessAktion } from './partie.js';
import type { BroChessSicht, DreiSchachSicht, GeheimeDameSicht, SecretDameSicht } from './sicht.js';

/** Figurenwerte in Hundertstel-Bauern. */
const WERT: Readonly<Record<string, number>> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/*
 * Stellungstabellen aus Sicht von Weiss, a1 zuerst (wie `brett`). Schwarz
 * liest dieselbe Tabelle gespiegelt. Werte nach dem verbreiteten
 * "Simplified Evaluation Function"-Schema: Mitte besetzen, Springer nicht an
 * den Rand, König hinter den Bauern.
 */
const TABELLE: Readonly<Record<string, readonly number[]>> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, -20, -20, 10, 10, 5,
    5, -5, -10, 0, 0, -10, -5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, 5, 10, 25, 25, 10, 5, 5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 5, 5, 0, 0, 0,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    5, 10, 10, 10, 10, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -10, 5, 5, 5, 5, 5, 0, -10,
    0, 0, 5, 5, 5, 5, 0, -5,
    -5, 0, 5, 5, 5, 5, 0, -5,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    20, 30, 10, 0, 0, 10, 30, 20,
    20, 20, 0, 0, 0, 0, 20, 20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
  ],
};

/** Matt schlaegt jede Materialrechnung; je naeher, desto besser. */
const MATT = 100_000;

interface Stufe {
  readonly tiefe: number;
  /** Stellungstabellen mitrechnen? Der Anfaenger zaehlt nur Material. */
  readonly stellung: boolean;
  /** Schlagabtausch am Ende der Suche ausrechnen? */
  readonly ruhe: boolean;
  /** Obergrenze fuer besuchte Stellungen je Zug — deckelt die Rechenzeit. */
  readonly knoten: number;
}

const STUFEN: Readonly<Record<BotLevel, Stufe>> = {
  anfaenger: { tiefe: 1, stellung: false, ruhe: false, knoten: 2_000 },
  standard: { tiefe: 2, stellung: true, ruhe: true, knoten: 8_000 },
  experte: { tiefe: 3, stellung: true, ruhe: true, knoten: 20_000 },
  genie: { tiefe: 4, stellung: true, ruhe: true, knoten: 40_000 },
};

/** Bewertung aus Sicht der Seite am Zug. */
function bewerte(stellung: Stellung, mitStellung: boolean): number {
  let summe = 0;
  const { brett } = stellung;
  for (let feld = 0; feld < 64; feld += 1) {
    const figur = brett[feld]!;
    if (figur === '') continue;
    const art = figur.toLowerCase();
    const weiss = figur !== art;
    let wert = WERT[art]!;
    if (mitStellung) wert += TABELLE[art]![weiss ? feld : feld ^ 56]!;
    summe += weiss ? wert : -wert;
  }
  return stellung.amZug === 'w' ? summe : -summe;
}

/** Schlaege zuerst, wertvolles Opfer mit billigem Taeter vorn (MVV-LVA). */
function ordne<Z extends Zug>(stellung: Stellung, zuege: readonly Z[]): Z[] {
  const gewicht = (zug: Z): number => {
    const opfer = stellung.brett[zug.nach]!;
    const taeter = stellung.brett[zug.von]!.toLowerCase();
    let g = 0;
    // Chess960: „König auf den eigenen Turm" ist die Rochade, kein Schlag.
    if (opfer !== '' && farbeVon(opfer) !== stellung.amZug) g += 10 * WERT[opfer.toLowerCase()]! - WERT[taeter]!;
    if (zug.umwandlung) g += WERT[zug.umwandlung]!;
    return g;
  };
  // Stabil sortiert: Bei gleichem Gewicht bleibt die Erzeugungsreihenfolge,
  // und damit bleibt der Bot deterministisch.
  return zuege
    .map((zug, i) => ({ zug, g: gewicht(zug), i }))
    .sort((a, b) => b.g - a.g || a.i - b.i)
    .map((e) => e.zug);
}

const istSchlag = (stellung: Stellung, zug: Zug): boolean =>
  (stellung.brett[zug.nach] !== '' && farbeVon(stellung.brett[zug.nach]!) !== stellung.amZug) ||
  (stellung.brett[zug.von]!.toLowerCase() === 'p' && zug.nach === stellung.epFeld) ||
  zug.umwandlung !== undefined;

class Suche {
  besucht = 0;
  constructor(private readonly stufe: Stufe) {}

  get erschoepft(): boolean {
    return this.besucht >= this.stufe.knoten;
  }

  /** Nur Schlaege, bis die Stellung ruhig ist — sonst endet die Suche mitten im Abtausch. */
  private ruhe(stellung: Stellung, alpha: number, beta: number): number {
    this.besucht += 1;
    const stehen = bewerte(stellung, this.stufe.stellung);
    if (stehen >= beta) return stehen;
    if (stehen > alpha) alpha = stehen;
    if (this.erschoepft) return stehen;
    const schlaege = pseudoZuege(stellung).filter((z) => istSchlag(stellung, z));
    for (const zug of ordne(stellung, schlaege)) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, stellung.amZug)) continue;
      const wert = -this.ruhe(danach, -beta, -alpha);
      if (wert >= beta) return wert;
      if (wert > alpha) alpha = wert;
    }
    return alpha;
  }

  wert(stellung: Stellung, tiefe: number, alpha: number, beta: number, abstand: number): number {
    if (stellung.halbzugUhr >= 100) return 0;
    if (tiefe === 0) {
      // Matt muss am Blatt erkannt werden, sonst saehe der Bot ein Matt in
      // einem Zug nur als Materialgewinn. Alle Zuege aufzuzaehlen kostet aber,
      // also nur im Schach. Ein Patt am Blatt uebersieht er — das ist selten
      // und kostet hoechstens ein Remis.
      if (imSchach(stellung) && legaleZuege(stellung).length === 0) return -MATT + abstand;
      if (this.stufe.ruhe) return this.ruhe(stellung, alpha, beta);
      this.besucht += 1;
      return bewerte(stellung, this.stufe.stellung);
    }
    this.besucht += 1;
    let bester = -Infinity;
    let legal = 0;
    // Legal wird ein Zug erst hier: Wer den eigenen König im Schach laesst,
    // faellt heraus. Das spart den zweiten Aufbau jeder Stellung, den
    // `legaleZuege` sonst vorab machte.
    for (const zug of ordne(stellung, pseudoZuege(stellung))) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, stellung.amZug)) continue;
      legal += 1;
      const wert = -this.wert(danach, tiefe - 1, -beta, -alpha, abstand + 1);
      if (wert > bester) bester = wert;
      if (wert > alpha) alpha = wert;
      if (alpha >= beta || this.erschoepft) break;
    }
    if (legal === 0) return imSchach(stellung) ? -MATT + abstand : 0;
    return bester;
  }
}

/** Der beste Zug nach Stufe. Wirft nur, wenn es keinen legalen Zug gibt. */
export function besterZug(stellung: Stellung, level: BotLevel): Zug {
  const zuege = legaleZuege(stellung);
  if (zuege.length === 0) throw new Error('Kein legaler Zug');
  const stufe = STUFEN[level];
  const suche = new Suche(stufe);
  let gewaehlt = ordne(stellung, zuege)[0]!;

  // Iterativ vertiefen: Jede fertige Tiefe ist ein gueltiges Ergebnis, und
  // die beste Antwort der vorigen Tiefe wird zuerst gerechnet — sie schneidet
  // in der naechsten am meisten ab.
  for (let tiefe = 1; tiefe <= stufe.tiefe; tiefe += 1) {
    const reihe = [gewaehlt, ...ordne(stellung, zuege).filter((z) => z !== gewaehlt && !gleich(z, gewaehlt))];
    let bester: Zug | null = null;
    let besterWert = -Infinity;
    let alpha = -Infinity;
    let fertig = true;
    for (const zug of reihe) {
      const wert = -suche.wert(wendeAn(stellung, zug), tiefe - 1, -Infinity, -alpha, 1);
      // Ging das Budget mitten in diesem Zug aus, ist sein Wert halb gerechnet
      // und zaehlt nicht. Die Zuege davor sind fertig: Der Beste unter ihnen
      // ist auf dieser Tiefe besser als der Sieger der vorigen, denn der steht
      // vorn und wurde zuerst zu Ende gerechnet.
      if (suche.erschoepft) {
        fertig = false;
        break;
      }
      if (wert > besterWert) {
        besterWert = wert;
        bester = zug;
      }
      if (wert > alpha) alpha = wert;
    }
    if (bester) gewaehlt = bester;
    if (!fertig || besterWert >= MATT - 100) break;
  }
  return gewaehlt;
}

function gleich(a: Zug, b: Zug): boolean {
  return a.von === b.von && a.nach === b.nach && a.umwandlung === b.umwandlung;
}

/**
 * Fuer die Plattform: Zug als Aktion, aus der Sicht des Sitzes am Zug. Im
 * Modus 'secretDame' auch die Wahl der geheimen Dame und, im Notfall unter
 * Regel B, das Aufgeben (`botGeheim` unten).
 */
export function botZug(sicht: BroChessSicht, level: BotLevel = 'standard'): BroChessAktion {
  if (sicht.secretDame) return botGeheim(sicht, sicht.secretDame, level);
  const zug = sicht.dreiSchach
    ? besterZugDreiSchach(ausFen(sicht.fen), sicht.dreiSchach, level)
    : sicht.huegel
      ? besterZugHuegel(ausFen(sicht.fen), level)
      : sicht.nebel
        ? besterZugNebel(ausFen(sicht.fen), level)
        : besterZug(ausFen(sicht.fen), level);
  return {
    type: 'zug',
    von: feldName(zug.von),
    nach: feldName(zug.nach),
    ...(zug.umwandlung ? { umwandlung: zug.umwandlung } : {}),
  };
}

// ---------------------------------------------------------------------------
// Secret Dame (seit dem 04.11.2026)
// ---------------------------------------------------------------------------

/*
 * Der Bot fuer den Modus 'secretDame'. Er rechnet AUSSCHLIESSLICH mit der
 * Sicht seines Sitzes (`sichtFuer`): die eigene geheime Dame aus
 * `secretDame.meine`, die fremde nur, wenn sie in `secretDame.bekannt` steht
 * (aufgedeckt oder verdeckt geschlagen). Welche Figur der Gegner verdeckt
 * gewaehlt hat, steht in seiner Sicht nicht — er kann sie also bauartbedingt
 * nicht kennen, genau wie ein Mensch am Brett.
 *
 * Was er ueber die verdeckte fremde Dame nicht weiss, ersetzt er durch eine
 * Kandidatenmenge: Jede fremde Figur ausser dem König kann es sein. Daraus
 * folgt je nach Regel des Tisches:
 *
 * - Regel A: Seine legalen Zuege haengen von der verdeckten Dame nicht ab (sie
 *   zaehlt fuer Schach nicht), die kennt er also genau. Aber sie darf seinen
 *   König SCHLAGEN, und dann ist die Partie aus. Darum zieht er an der Wurzel
 *   jeden Zug um den Anteil der Kandidaten herunter, die den König danach als
 *   Dame erreichen — als Wahrscheinlichkeit, dass er verliert.
 *
 * - Regel B: Die verdeckte Dame gibt Schach und beschraenkt seine Zuege —
 *   welche legal sind, kann er aus Brett und Zugliste nicht sicher ablesen.
 *   Ein Zug, den `act` abweist, beendet am Server den ganzen Tisch
 *   („abgebrochen", `playBot` in packages/server/src/runtime/party.ts). Bis
 *   zum 13.11.2026 spielte er deshalb nur Zuege, die fuer JEDEN moeglichen
 *   Kandidaten legal waren, und gab auf, wenn keiner blieb — in rund 5 % der
 *   Partien. Seitdem liefert die Sicht die eigenen erlaubten Zuege
 *   (`secretDame.meineZuege`, dieselbe Menge, die ein Mensch ueber
 *   `legalActions` bekommt), und er waehlt nur daraus. Mehr verraet ihm das
 *   nicht als einem Menschen am Brett, dem der Bildschirm genau diese Zuege
 *   anbietet.
 *
 * In der Suche selbst kommt die verdeckte fremde Dame nicht vor: Was er nicht
 * weiss, rechnet er nicht. Die eigene Dame und eine bekannte fremde rechnet
 * er mit voller Damenkraft.
 *
 * Der normale Modus laeuft weiter ueber `besterZug` oben und bleibt Zug fuer
 * Zug derselbe.
 */

/** Platzhalter fuer die fremde Dame, solange der Bot sie nicht kennt: im Modell nicht vorhanden. */
const UNBEKANNT: GeheimeDame = { zustand: 'erloschen', feld: null, grundfigur: null, bekannt: false };

/**
 * Aufschlag einer verdeckten Dame: Solange der Gegner sie nicht kennt, droht
 * sie unter A mit dem Königsschlag und haelt ihn unter B im Ungewissen.
 * Klein, damit er sie nicht um jeden Preis versteckt, aber gross genug, dass
 * er sie nicht fuer ein paar Felder Stellungsvorteil verraet.
 */
const VERDECKT_AUFSCHLAG = 30;

const andere = (farbe: Farbe): Farbe => (farbe === 'w' ? 'b' : 'w');
const koenigVon = (stellung: Stellung, farbe: Farbe): number =>
  stellung.brett.indexOf(farbe === 'w' ? 'K' : 'k');

/** Erreicht eine Dame auf `von` das Feld `ziel`? (geheim.ts hat dasselbe, exportiert es aber nicht.) */
function dameSieht(brett: readonly string[], von: number, ziel: number): boolean {
  if (von === ziel) return false;
  const dLinie = linieVon(ziel) - linieVon(von);
  const dReihe = reiheVon(ziel) - reiheVon(von);
  if (dLinie !== 0 && dReihe !== 0 && Math.abs(dLinie) !== Math.abs(dReihe)) return false;
  const schritt = Math.sign(dReihe) * 8 + Math.sign(dLinie);
  for (let f = von + schritt; f !== ziel; f += schritt) {
    if (brett[f] !== '') return false;
  }
  return true;
}

function dameAusSicht(dame: GeheimeDameSicht | null, bekannt: boolean): GeheimeDame {
  if (!dame) return UNBEKANNT;
  return {
    zustand: dame.zustand,
    feld: dame.feld === null ? null : feldIndex(dame.feld),
    grundfigur: dame.grundfigur,
    bekannt,
  };
}

/** Der Stand der geheimen Damen, soweit dieser Sitz ihn kennt. Ereignisse braucht die Suche nicht. */
function modellAusSicht(sd: SecretDameSicht, farbe: Farbe): SecretDameStand {
  const eigene = dameAusSicht(sd.meine, sd.bekannt[farbe] !== null);
  const fremde = dameAusSicht(sd.bekannt[andere(farbe)], true);
  return farbe === 'w'
    ? { regel: sd.regel, w: eigene, b: fremde, ereignisse: [] }
    : { regel: sd.regel, w: fremde, b: eigene, ereignisse: [] };
}

/** Felder, auf denen die verdeckte fremde Dame stehen koennte; leer, wenn er sie kennt. */
function kandidaten(stellung: Stellung, sd: SecretDameSicht, farbe: Farbe): number[] {
  const fremd = andere(farbe);
  if (sd.bekannt[fremd] !== null) return [];
  const felder: number[] = [];
  for (let feld = 0; feld < 64; feld += 1) {
    const figur = stellung.brett[feld]!;
    if (figur !== '' && farbeVon(figur) === fremd && figur.toLowerCase() !== 'k') felder.push(feld);
  }
  return felder;
}

/**
 * Die Wahl. Bevorzugt ein Laeufer, und zwar der am Königsfluegel: Seine
 * Schraegzuege verraten ihn nie, und die Geradezuege, die er als Dame
 * dazubekommt, kommen ueberraschend — unter Regel A ein Königsschlag aus dem
 * Nichts. Deterministisch wie alles hier (es gibt keine Saat): Wer oft gegen
 * ihn spielt, kann das lernen; dafuer bleibt ein Tisch nachvollziehbar.
 */
function waehleFigur(stellung: Stellung, farbe: Farbe): number {
  const vorzug = ['b', 'n', 'r', 'p', 'q'];
  const koenig = koenigVon(stellung, farbe);
  const eigene: { feld: number; rang: number; abstand: number }[] = [];
  for (let feld = 0; feld < 64; feld += 1) {
    const figur = stellung.brett[feld]!;
    if (figur === '' || farbeVon(figur) !== farbe || figur.toLowerCase() === 'k') continue;
    eigene.push({
      feld,
      rang: vorzug.indexOf(figur.toLowerCase()),
      abstand: koenig < 0 ? 0 : Math.abs(linieVon(feld) - linieVon(koenig)),
    });
  }
  if (eigene.length === 0) throw new Error('Keine waehlbare Figur');
  // Stabil sortiert: bei Gleichstand das zuerst gezaehlte Feld.
  return eigene.sort((a, b) => a.rang - b.rang || a.abstand - b.abstand)[0]!.feld;
}

/** Wie `bewerte`, dazu die Damenkraft der geheimen Damen im Modell. Aus Sicht der Seite am Zug. */
function bewerteGeheim(stellung: Stellung, stand: SecretDameStand, mitStellung: boolean): number {
  let summe = bewerte(stellung, mitStellung);
  for (const farbe of ['w', 'b'] as const) {
    const dame = stand[farbe];
    if (!aktiv(dame)) continue;
    const figur = stellung.brett[dame.feld!]!;
    if (figur === '') continue;
    let plus = WERT.q! - WERT[figur.toLowerCase()]!;
    if (dame.zustand === 'verdeckt') plus += VERDECKT_AUFSCHLAG;
    summe += farbe === stellung.amZug ? plus : -plus;
  }
  return summe;
}

const istSchlagGeheim = (stellung: Stellung, zug: GeheimZug): boolean =>
  stellung.brett[zug.nach] !== '' ||
  (!zug.dame && stellung.brett[zug.von]!.toLowerCase() === 'p' && zug.nach === stellung.epFeld) ||
  zug.umwandlung !== undefined;

/** Die acht Richtungen der Dame als (Linie, Reihe). */
const DAME_RICHTUNGEN: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * Die Zuege der Seite am Zug OHNE Legalitaetspruefung: die der Grundfiguren
 * und die zusaetzlichen Damenzuege der eigenen geheimen Dame — dieselbe Menge,
 * die `legaleZuegeGeheim` vor dem Filtern bildet.
 *
 * Warum nicht einfach `legaleZuegeGeheim`: Es wendet jeden Zug zur Pruefung
 * an, und die Suche wendet ihn danach noch einmal an. In jedem Knoten kostete
 * das so viel, dass „genie" im Modus bis 2,8 s je Zug rechnete statt 0,15 s
 * im normalen (gemessen 04.11.2026) — und der Bot haelt dabei jeden anderen
 * Tisch des Servers an. Hier wird wie in `Suche` erst gezogen und dann
 * geprueft. Fuer die Wurzel gilt das NICHT: Dort kommen die Zuege aus
 * `legaleZuegeGeheim` selbst, denn was der Bot spielt, muss `act` annehmen.
 */
function rohZuege(stellung: Stellung, stand: SecretDameStand): GeheimZug[] {
  const farbe = stellung.amZug;
  const { brett } = stellung;
  const basis = pseudoZuege(stellung);
  const zuege: GeheimZug[] = basis.map((z) => ({ ...z, dame: false }));
  const eigene = stand[farbe];
  if (!aktiv(eigene)) return zuege;
  const von = eigene.feld!;
  const figur = brett[von]!;
  if (figur === '' || farbeVon(figur) !== farbe) return zuege;
  const bauer = figur.toLowerCase() === 'p';
  const letzteReihe = farbe === 'w' ? 7 : 0;
  for (const [dl, dr] of DAME_RICHTUNGEN) {
    for (let schritt = 1; schritt < 8; schritt += 1) {
      const l = linieVon(von) + dl * schritt;
      const r = reiheVon(von) + dr * schritt;
      if (l < 0 || l > 7 || r < 0 || r > 7) break;
      const nach = r * 8 + l;
      const ziel = brett[nach]!;
      if (ziel !== '' && farbeVon(ziel) === farbe) break;
      if (!basis.some((z) => z.von === von && z.nach === nach)) {
        if (bauer && r === letzteReihe) {
          for (const umwandlung of UMWANDLUNGEN) zuege.push({ von, nach, umwandlung, dame: true });
        } else {
          zuege.push({ von, nach, dame: true });
        }
      }
      if (ziel !== '') break;
    }
  }
  return zuege;
}

/**
 * Fuehrt einen Zug aus `rohZuege` aus; null, wenn er den eigenen König im
 * Angriff laesst (nach der Regel des Tisches) oder durch ein angegriffenes
 * Feld rochiert. Den Königsschlag prueft der Aufrufer vorher.
 */
function ziehe(
  stellung: Stellung,
  stand: SecretDameStand,
  zug: GeheimZug,
): { stellung: Stellung; stand: SecretDameStand } | null {
  const farbe = stellung.amZug;
  const danach = wendeAnGeheim(stellung, zug);
  const standDanach = standNachZug(stand, stellung, zug, 0);
  if (imSchachGeheim(danach, standDanach, farbe)) return null;
  // Rochade: brett.ts prueft die Felder nur gegen die sichtbaren Figuren.
  if (!zug.dame && stellung.brett[zug.von]!.toLowerCase() === 'k' && Math.abs(zug.nach - zug.von) === 2) {
    const fremd = stand[andere(farbe)];
    const zaehlt = aktiv(fremd) && (fremd.zustand === 'aufgedeckt' || stand.regel === 'B');
    const mitte = (zug.von + zug.nach) / 2;
    if (zaehlt && [zug.von, mitte, zug.nach].some((f) => dameSieht(stellung.brett, fremd.feld!, f))) return null;
  }
  return { stellung: danach, stand: standDanach };
}

/**
 * Alpha-Beta wie `Suche`, aber auf Stellung UND Modell der geheimen Damen.
 * Eine eigene Klasse statt eines Schalters in `Suche`: Der normale Modus soll
 * Zug fuer Zug derselbe bleiben.
 */
class SucheGeheim {
  besucht = 0;
  constructor(private readonly stufe: Stufe) {}

  get erschoepft(): boolean {
    return this.besucht >= this.stufe.knoten;
  }

  /** Hat die Seite am Zug noch einen Zug? Bricht beim ersten ab. */
  private hatZug(stellung: Stellung, stand: SecretDameStand): boolean {
    return rohZuege(stellung, stand).some((z) => schlaegtKoenig(stellung, z) || ziehe(stellung, stand, z) !== null);
  }

  private ruhe(stellung: Stellung, stand: SecretDameStand, alpha: number, beta: number, abstand: number): number {
    this.besucht += 1;
    const stehen = bewerteGeheim(stellung, stand, this.stufe.stellung);
    if (stehen >= beta) return stehen;
    if (stehen > alpha) alpha = stehen;
    if (this.erschoepft) return stehen;
    const schlaege = rohZuege(stellung, stand).filter((z) => istSchlagGeheim(stellung, z));
    for (const zug of ordne(stellung, schlaege)) {
      if (schlaegtKoenig(stellung, zug)) return MATT - abstand;
      const danach = ziehe(stellung, stand, zug);
      if (!danach) continue;
      const wert = -this.ruhe(danach.stellung, danach.stand, -beta, -alpha, abstand + 1);
      if (wert >= beta) return wert;
      if (wert > alpha) alpha = wert;
    }
    return alpha;
  }

  wert(
    stellung: Stellung,
    stand: SecretDameStand,
    tiefe: number,
    alpha: number,
    beta: number,
    abstand: number,
  ): number {
    if (stellung.halbzugUhr >= 100) return 0;
    if (tiefe === 0) {
      // Wie in `Suche`: Matt am Blatt nur im Schach suchen, ein Patt dort uebersieht er.
      if (imSchachGeheim(stellung, stand) && !this.hatZug(stellung, stand)) return -MATT + abstand;
      if (this.stufe.ruhe) return this.ruhe(stellung, stand, alpha, beta, abstand);
      this.besucht += 1;
      return bewerteGeheim(stellung, stand, this.stufe.stellung);
    }
    this.besucht += 1;
    let bester = -Infinity;
    let legal = 0;
    for (const zug of ordne(stellung, rohZuege(stellung, stand))) {
      let wert: number;
      if (schlaegtKoenig(stellung, zug)) {
        // Regel A: Die verdeckte Dame schlaegt den König — die Partie ist aus, nichts mehr zu rechnen.
        wert = MATT - abstand;
      } else {
        const danach = ziehe(stellung, stand, zug);
        if (!danach) continue;
        wert = -this.wert(danach.stellung, danach.stand, tiefe - 1, -beta, -alpha, abstand + 1);
      }
      legal += 1;
      if (wert > bester) bester = wert;
      if (wert > alpha) alpha = wert;
      if (alpha >= beta || this.erschoepft) break;
    }
    if (legal === 0) return imSchachGeheim(stellung, stand) ? -MATT + abstand : 0;
    return bester;
  }
}

const zugSchluessel = (z: { von: number; nach: number; umwandlung?: string | undefined }): string =>
  `${z.von}-${z.nach}-${z.umwandlung ?? ''}`;

interface WurzelZug {
  readonly zug: GeheimZug;
  /** Wahrscheinlichkeit, dass die verdeckte fremde Dame danach den König schlagen kann (nur Regel A). */
  readonly risiko: number;
}

/** Die Zuege, die der Bot an der Wurzel ueberhaupt in Betracht zieht (siehe Kopf des Abschnitts). */
function wurzelZuege(stellung: Stellung, modell: SecretDameStand, sd: SecretDameSicht, farbe: Farbe): WurzelZug[] {
  const fremd = andere(farbe);
  const basis = legaleZuegeGeheim(stellung, modell);

  if (sd.regel === 'B') {
    /*
     * Die Sicht nennt die eigenen erlaubten Zuege (`meineZuege`, dieselbe
     * Menge wie `legalActions`). Jeder davon steht auch in `basis`: Die
     * verdeckte fremde Dame nimmt unter B nur Zuege weg, sie fuegt keine
     * hinzu. Also bleibt aus `basis`, was die Sicht erlaubt — `basis` liefert
     * dazu das `dame`-Kennzeichen, das die Suche braucht.
     */
    const erlaubt = new Set(
      sd.meineZuege.map((z) => zugSchluessel({ von: feldIndex(z.von), nach: feldIndex(z.nach), umwandlung: z.umwandlung })),
    );
    return basis.filter((zug) => erlaubt.has(zugSchluessel(zug))).map((zug) => ({ zug, risiko: 0 }));
  }

  const alle = kandidaten(stellung, sd, farbe);
  // Leer heisst: Die fremde Dame ist bekannt oder vom Brett, es gibt nichts Verdecktes mehr.
  if (alle.length === 0) return basis.map((zug) => ({ zug, risiko: 0 }));

  // Regel A
  return basis.map((zug) => {
    if (schlaegtKoenig(stellung, zug)) return { zug, risiko: 0 };
    const danach = wendeAnGeheim(stellung, zug);
    const koenig = koenigVon(danach, farbe);
    // Ein eben geschlagener Kandidat steht nicht mehr da und droht nicht mehr.
    const droher = alle.filter((f) => {
      const figur = danach.brett[f]!;
      return figur !== '' && farbeVon(figur) === fremd && koenig >= 0 && dameSieht(danach.brett, f, koenig);
    });
    return { zug, risiko: droher.length / alle.length };
  });
}

function besterZugGeheim(
  stellung: Stellung,
  modell: SecretDameStand,
  wurzel: readonly WurzelZug[],
  level: BotLevel,
): GeheimZug {
  if (wurzel.length === 0) throw new Error('Kein legaler Zug');
  const stufe = STUFEN[level];
  const suche = new SucheGeheim(stufe);
  const risiko = new Map(wurzel.map((e) => [e.zug, e.risiko]));
  const geordnet = ordne(stellung, wurzel.map((e) => e.zug));
  let gewaehlt = geordnet[0]!;

  for (let tiefe = 1; tiefe <= stufe.tiefe; tiefe += 1) {
    const reihe = [gewaehlt, ...geordnet.filter((z) => z !== gewaehlt)];
    let bester: GeheimZug | null = null;
    let besterWert = -Infinity;
    let alpha = -Infinity;
    let fertig = true;
    for (const zug of reihe) {
      const p = risiko.get(zug)!;
      let wert: number;
      if (schlaegtKoenig(stellung, zug)) {
        wert = MATT;
      } else if (p >= 1) {
        wert = -MATT;
      } else {
        /*
         * Gewertet wird (1 - p) * roh - p * MATT. Damit das Suchfenster dazu
         * passt, rechnet die Schranke auf den rohen Wert zurueck: roh zaehlt
         * erst ueber (alpha + p * MATT) / (1 - p).
         */
        const rohAlpha = alpha === -Infinity ? -Infinity : (alpha + p * MATT) / (1 - p);
        const roh = -suche.wert(
          wendeAnGeheim(stellung, zug),
          standNachZug(modell, stellung, zug, 0),
          tiefe - 1,
          -Infinity,
          -rohAlpha,
          1,
        );
        wert = (1 - p) * roh - p * MATT;
      }
      // Wie in `besterZug`: Ein halb gerechneter Zug zaehlt nicht.
      if (suche.erschoepft) {
        fertig = false;
        break;
      }
      if (wert > besterWert) {
        besterWert = wert;
        bester = zug;
      }
      if (wert > alpha) alpha = wert;
    }
    if (bester) gewaehlt = bester;
    if (!fertig || besterWert >= MATT - 100) break;
  }
  return gewaehlt;
}

/** Wahl oder Zug im Modus 'secretDame', allein aus der Sicht des Sitzes. */
function botGeheim(sicht: BroChessSicht, sd: SecretDameSicht, level: BotLevel): BroChessAktion {
  const farbe = sicht.meineFarbe;
  if (farbe === null) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
  const stellung = ausFen(sicht.fen);
  if (sd.wahlLaeuft) {
    // Hat er schon gewaehlt, waehlt nur noch der Gegner — fuer ihn gibt es nichts zu tun.
    if (sd.gewaehlt[farbe]) throw new Error('Schon gewaehlt, der Gegner waehlt noch');
    return { type: 'wahl', feld: feldName(waehleFigur(stellung, farbe)) };
  }
  if (sicht.amZug !== farbe) throw new Error('Nicht am Zug');
  const modell = modellAusSicht(sd, farbe);
  const wurzel = wurzelZuege(stellung, modell, sd, farbe);
  // Kommt nicht vor: Ohne erlaubten Zug ist die Partie schon aus (Matt oder Patt). Falls doch, ist Aufgeben
  // die einzige Aktion, die `act` sicher annimmt — ein geratener Zug braeche am Server den Tisch ab.
  if (wurzel.length === 0) return { type: 'aufgeben' };
  const zug = besterZugGeheim(stellung, modell, wurzel, level);
  return {
    type: 'zug',
    von: feldName(zug.von),
    nach: feldName(zug.nach),
    ...(zug.umwandlung ? { umwandlung: zug.umwandlung } : {}),
  };
}

// ---------------------------------------------------------------------------
// Drei-Schach (seit dem 14.11.2026)
// ---------------------------------------------------------------------------

/*
 * Der Bot fuer den Modus 'dreiSchach'. Die Zuege sind die des normalen
 * Schachs — an der Wurzel kommen sie aus `legaleZuege`, derselben Liste, die
 * `act` prueft. Anders ist nur, was er sucht: Jedes Schachgebot zaehlt, und
 * das dritte gewinnt wie ein Matt.
 *
 * Darum (Auftrag: „Bot bewertet Schachgebote hoch"):
 * - Die gegebenen Schachs gehen mit SCHACH_WERT in die Bewertung ein — das
 *   erste schon mehr als ein Bauer, das zweite mehr als eine Leichtfigur.
 *   So opfert er Material fuer ein Schach, aber nicht die Dame fuer das erste.
 * - Ein Zug, der das dritte Schach gibt, ist ein Sieg (MATT), in der Suche
 *   wie an der Wurzel.
 * - Die Ruhesuche rechnet nicht nur Schlaege: Hat die Seite am Zug schon zwei
 *   Schachs gegeben, prueft sie jedes Schachgebot — sonst saehe der Bot am
 *   Horizont nicht, dass der Gegner im naechsten Zug gewinnt.
 *
 * Eine eigene Klasse statt eines Schalters in `Suche`, wie bei Secret Dame:
 * Der normale Modus bleibt Zug fuer Zug derselbe.
 */

/** Wert der gegebenen Schachs (Index = Anzahl, 0 bis 2) in Hundertstel-Bauern. */
const SCHACH_WERT: readonly number[] = [0, 180, 520];

type Gegeben = { readonly w: number; readonly b: number };

const schachWert = (n: number): number => SCHACH_WERT[Math.min(n, SCHACH_WERT.length - 1)]!;

/** Wie `bewerte`, dazu die gegebenen Schachs beider Seiten. Aus Sicht der Seite am Zug. */
function bewerteDreiSchach(stellung: Stellung, gegeben: Gegeben, mitStellung: boolean): number {
  const ich = stellung.amZug;
  return bewerte(stellung, mitStellung) + schachWert(gegeben[ich]) - schachWert(gegeben[andere(ich)]);
}

/** Der Zaehlerstand nach einem Zug von `farbe`, der Schach gibt. */
const mitSchach = (gegeben: Gegeben, farbe: Farbe): Gegeben => ({ ...gegeben, [farbe]: gegeben[farbe] + 1 });

class SucheDreiSchach {
  besucht = 0;
  constructor(private readonly stufe: Stufe) {}

  get erschoepft(): boolean {
    return this.besucht >= this.stufe.knoten;
  }

  /**
   * Gewinnt die Seite am Zug sofort mit einem Schachgebot? Nur gefragt, wenn
   * sie schon zwei gegeben hat — jedes weitere Schach ist dann das dritte.
   */
  private gewinntMitSchach(stellung: Stellung, gegeben: Gegeben): boolean {
    if (gegeben[stellung.amZug] < SCHACH_ZIEL - 1) return false;
    this.besucht += 1;
    for (const zug of pseudoZuege(stellung)) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, stellung.amZug)) continue;
      if (imSchach(danach)) return true;
    }
    return false;
  }

  private ruhe(stellung: Stellung, gegeben: Gegeben, alpha: number, beta: number, abstand: number): number {
    this.besucht += 1;
    if (this.gewinntMitSchach(stellung, gegeben)) return MATT - abstand - 1;
    const stehen = bewerteDreiSchach(stellung, gegeben, this.stufe.stellung);
    if (stehen >= beta) return stehen;
    if (stehen > alpha) alpha = stehen;
    if (this.erschoepft) return stehen;
    const ich = stellung.amZug;
    const schlaege = pseudoZuege(stellung).filter((z) => istSchlag(stellung, z));
    for (const zug of ordne(stellung, schlaege)) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, ich)) continue;
      const gibtSchach = imSchach(danach);
      const neu = gibtSchach ? mitSchach(gegeben, ich) : gegeben;
      const wert =
        neu[ich] >= SCHACH_ZIEL ? MATT - abstand - 1 : -this.ruhe(danach, neu, -beta, -alpha, abstand + 1);
      if (wert >= beta) return wert;
      if (wert > alpha) alpha = wert;
    }
    return alpha;
  }

  wert(stellung: Stellung, gegeben: Gegeben, tiefe: number, alpha: number, beta: number, abstand: number): number {
    if (stellung.halbzugUhr >= 100) return 0;
    if (tiefe === 0) {
      // Wie in `Suche`: Matt am Blatt nur im Schach suchen, ein Patt dort uebersieht er.
      if (imSchach(stellung) && legaleZuege(stellung).length === 0) return -MATT + abstand;
      if (this.stufe.ruhe) return this.ruhe(stellung, gegeben, alpha, beta, abstand);
      this.besucht += 1;
      return bewerteDreiSchach(stellung, gegeben, this.stufe.stellung);
    }
    this.besucht += 1;
    const ich = stellung.amZug;
    let bester = -Infinity;
    let legal = 0;
    for (const zug of ordne(stellung, pseudoZuege(stellung))) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, ich)) continue;
      legal += 1;
      const gibtSchach = imSchach(danach);
      const neu = gibtSchach ? mitSchach(gegeben, ich) : gegeben;
      // Das dritte Schach gewinnt sofort — wie ein Matt einen Halbzug spaeter.
      const wert =
        neu[ich] >= SCHACH_ZIEL ? MATT - abstand - 1 : -this.wert(danach, neu, tiefe - 1, -beta, -alpha, abstand + 1);
      if (wert > bester) bester = wert;
      if (wert > alpha) alpha = wert;
      if (alpha >= beta || this.erschoepft) break;
    }
    if (legal === 0) return imSchach(stellung) ? -MATT + abstand : 0;
    return bester;
  }
}

/** Der beste Zug im Drei-Schach nach Stufe. Wirft nur, wenn es keinen legalen Zug gibt. */
export function besterZugDreiSchach(stellung: Stellung, drei: DreiSchachSicht, level: BotLevel): Zug {
  const zuege = legaleZuege(stellung);
  if (zuege.length === 0) throw new Error('Kein legaler Zug');
  const stufe = STUFEN[level];
  const suche = new SucheDreiSchach(stufe);
  const ich = stellung.amZug;
  const gegeben: Gegeben = { w: drei.gegeben.w, b: drei.gegeben.b };
  const geordnet = ordne(stellung, zuege);
  // Das dritte Schach gewinnt sofort; dafuer muss nichts gesucht werden, und
  // ein knappes Knotenbudget darf es nicht verdecken.
  if (gegeben[ich] >= SCHACH_ZIEL - 1) {
    const sieg = geordnet.find((z) => imSchach(wendeAn(stellung, z)));
    if (sieg) return sieg;
  }
  let gewaehlt = geordnet[0]!;

  // Wie `besterZug`: iterativ vertiefen, die beste Antwort der vorigen Tiefe zuerst.
  for (let tiefe = 1; tiefe <= stufe.tiefe; tiefe += 1) {
    const reihe = [gewaehlt, ...geordnet.filter((z) => z !== gewaehlt)];
    let bester: Zug | null = null;
    let besterWert = -Infinity;
    let alpha = -Infinity;
    let fertig = true;
    for (const zug of reihe) {
      const danach = wendeAn(stellung, zug);
      const neu = imSchach(danach) ? mitSchach(gegeben, ich) : gegeben;
      const wert = -suche.wert(danach, neu, tiefe - 1, -Infinity, -alpha, 1);
      if (suche.erschoepft) {
        fertig = false;
        break;
      }
      if (wert > besterWert) {
        besterWert = wert;
        bester = zug;
      }
      if (wert > alpha) alpha = wert;
    }
    if (bester) gewaehlt = bester;
    if (!fertig || besterWert >= MATT - 100) break;
  }
  return gewaehlt;
}

// ---------------------------------------------------------------------------
// Koenig des Huegels (seit dem 17.11.2026)
// ---------------------------------------------------------------------------

/*
 * Der Bot fuer den Modus 'huegel'. Die Zuege sind die des normalen Schachs —
 * an der Wurzel kommen sie aus `legaleZuege`, derselben Liste, die `act`
 * prueft. Anders ist nur, was er sucht: Wer seinen König auf d4, e4, d5 oder
 * e5 ziehen kann, gewinnt.
 *
 * Darum (Auftrag: „König in die Mitte ziehen, wenn sicher; den gegnerischen
 * König vom Huegel fernhalten"):
 * - Ein Königszug auf den Huegel ist ein Sieg (MATT), in der Suche wie an der
 *   Wurzel. „Wenn sicher" kommt von selbst: Es sind nur legale Zuege, also
 *   nie in ein Schach.
 * - Die Naehe des eigenen Königs zum Huegel zaehlt in der Bewertung, die des
 *   gegnerischen zaehlt gegen den Bot — er rueckt vor und haelt den Gegner mit
 *   Figuren von den Huegelfeldern fern (ein Feld, das er angreift, ist fuer
 *   den gegnerischen König verboten, also kein Sieg).
 * - Die Ruhesuche und das Blatt fragen, ob die Seite am Zug jetzt gewinnt —
 *   sonst saehe der Bot am Horizont nicht, dass der Gegner im naechsten Zug
 *   auf den Huegel zieht.
 *
 * Eine eigene Klasse statt eines Schalters in `Suche`, wie bei Drei-Schach:
 * Der normale Modus bleibt Zug fuer Zug derselbe.
 */

/** Wert der Naehe zum Huegel (Index = Abstand in Koenigsschritten, 0 bis 4) in Hundertstel-Bauern. */
const HUEGEL_NAEHE: readonly number[] = [0, 160, 80, 30, 0];

const huegelNaehe = (abstand: number): number => HUEGEL_NAEHE[Math.min(abstand, HUEGEL_NAEHE.length - 1)]!;

/** Wie `bewerte`, dazu die Naehe beider Koenige zum Huegel. Aus Sicht der Seite am Zug. */
function bewerteHuegel(stellung: Stellung, mitStellung: boolean): number {
  const ich = stellung.amZug;
  const meiner = koenigVon(stellung, ich);
  const seiner = koenigVon(stellung, andere(ich));
  return (
    bewerte(stellung, mitStellung) +
    (meiner >= 0 ? huegelNaehe(abstandZumHuegel(meiner)) : 0) -
    (seiner >= 0 ? huegelNaehe(abstandZumHuegel(seiner)) : 0)
  );
}

/** Gewinnt die Seite am Zug jetzt mit einem legalen Königszug auf den Huegel? */
function gewinntAmHuegel(stellung: Stellung): boolean {
  const koenig = koenigVon(stellung, stellung.amZug);
  // Weiter als einen Schritt entfernt, erreicht ihn kein Königszug — dann spart das die Zugerzeugung.
  if (koenig < 0 || abstandZumHuegel(koenig) > 1) return false;
  for (const zug of pseudoZuege(stellung)) {
    if (zug.von !== koenig || !zugErreichtHuegel(stellung.brett[zug.von]!, zug.nach)) continue;
    if (!imSchach(wendeAn(stellung, zug), stellung.amZug)) return true;
  }
  return false;
}

class SucheHuegel {
  besucht = 0;
  constructor(private readonly stufe: Stufe) {}

  get erschoepft(): boolean {
    return this.besucht >= this.stufe.knoten;
  }

  private ruhe(stellung: Stellung, alpha: number, beta: number, abstand: number): number {
    this.besucht += 1;
    if (gewinntAmHuegel(stellung)) return MATT - abstand - 1;
    const stehen = bewerteHuegel(stellung, this.stufe.stellung);
    if (stehen >= beta) return stehen;
    if (stehen > alpha) alpha = stehen;
    if (this.erschoepft) return stehen;
    const schlaege = pseudoZuege(stellung).filter((z) => istSchlag(stellung, z));
    for (const zug of ordne(stellung, schlaege)) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, stellung.amZug)) continue;
      const wert = -this.ruhe(danach, -beta, -alpha, abstand + 1);
      if (wert >= beta) return wert;
      if (wert > alpha) alpha = wert;
    }
    return alpha;
  }

  wert(stellung: Stellung, tiefe: number, alpha: number, beta: number, abstand: number): number {
    if (stellung.halbzugUhr >= 100) return 0;
    if (tiefe === 0) {
      // Wie in `Suche`: Matt am Blatt nur im Schach suchen, ein Patt dort uebersieht er.
      if (imSchach(stellung) && legaleZuege(stellung).length === 0) return -MATT + abstand;
      if (this.stufe.ruhe) return this.ruhe(stellung, alpha, beta, abstand);
      this.besucht += 1;
      if (gewinntAmHuegel(stellung)) return MATT - abstand - 1;
      return bewerteHuegel(stellung, this.stufe.stellung);
    }
    this.besucht += 1;
    const ich = stellung.amZug;
    let bester = -Infinity;
    let legal = 0;
    for (const zug of ordne(stellung, pseudoZuege(stellung))) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, ich)) continue;
      legal += 1;
      // Der Königszug auf den Huegel gewinnt sofort — wie ein Matt einen Halbzug spaeter.
      const wert = zugErreichtHuegel(stellung.brett[zug.von]!, zug.nach)
        ? MATT - abstand - 1
        : -this.wert(danach, tiefe - 1, -beta, -alpha, abstand + 1);
      if (wert > bester) bester = wert;
      if (wert > alpha) alpha = wert;
      if (alpha >= beta || this.erschoepft) break;
    }
    if (legal === 0) return imSchach(stellung) ? -MATT + abstand : 0;
    return bester;
  }
}

/** Der beste Zug im Koenig des Huegels nach Stufe. Wirft nur, wenn es keinen legalen Zug gibt. */
export function besterZugHuegel(stellung: Stellung, level: BotLevel): Zug {
  const zuege = legaleZuege(stellung);
  if (zuege.length === 0) throw new Error('Kein legaler Zug');
  const stufe = STUFEN[level];
  const suche = new SucheHuegel(stufe);
  const geordnet = ordne(stellung, zuege);
  // Der Huegel gewinnt sofort; dafuer muss nichts gesucht werden, und ein
  // knappes Knotenbudget darf es nicht verdecken.
  const sieg = geordnet.find((z) => zugErreichtHuegel(stellung.brett[z.von]!, z.nach));
  if (sieg) return sieg;
  let gewaehlt = geordnet[0]!;

  // Wie `besterZug`: iterativ vertiefen, die beste Antwort der vorigen Tiefe zuerst.
  for (let tiefe = 1; tiefe <= stufe.tiefe; tiefe += 1) {
    const reihe = [gewaehlt, ...geordnet.filter((z) => z !== gewaehlt)];
    let bester: Zug | null = null;
    let besterWert = -Infinity;
    let alpha = -Infinity;
    let fertig = true;
    for (const zug of reihe) {
      const wert = -suche.wert(wendeAn(stellung, zug), tiefe - 1, -Infinity, -alpha, 1);
      if (suche.erschoepft) {
        fertig = false;
        break;
      }
      if (wert > besterWert) {
        besterWert = wert;
        bester = zug;
      }
      if (wert > alpha) alpha = wert;
    }
    if (bester) gewaehlt = bester;
    if (!fertig || besterWert >= MATT - 100) break;
  }
  return gewaehlt;
}

// ---------------------------------------------------------------------------
// Nebelschach (seit dem 17.11.2026)
// ---------------------------------------------------------------------------

/*
 * Der Bot fuer den Modus 'nebel'. Er bekommt wie jeder Bot nur die Sicht —
 * also das verdeckte Brett — und rechnet darauf. Das genuegt fuer legale
 * Zuege: Jedes Ziel eines eigenen Zuges und jeder Blocker liegt auf einem
 * sichtbaren Feld (nebel.ts), `nebelZuege` auf dem verdeckten Brett ergibt
 * also genau die Zuege des echten. Ein Zug, den `act` ablehnt, kann daraus
 * nicht entstehen.
 *
 * Was er nicht weiss, ignoriert er: Figuren im Nebel gibt es fuer ihn nicht.
 * Er sieht also keine Drohung, die aus dem Nebel kommt — wie ein Mensch, der
 * nicht an sie denkt. Was sichtbar ist, rechnet er aus: Ein Zug, der den
 * gegnerischen König schlaegt, ist ein Sieg (MATT), und ein eigener König, den
 * ein sichtbarer Gegner schlagen koennte, ist ein Verlust. Schach gibt es
 * nicht; die Suche kennt darum weder Schachgebote noch Mattsuche, sondern nur
 * Koenigsschlaege.
 *
 * Eine eigene Klasse statt eines Schalters in `Suche`, wie bei Drei-Schach
 * und Huegel: Der normale Modus bleibt Zug fuer Zug derselbe.
 */

class SucheNebel {
  besucht = 0;
  constructor(private readonly stufe: Stufe) {}

  get erschoepft(): boolean {
    return this.besucht >= this.stufe.knoten;
  }

  private ruhe(stellung: Stellung, alpha: number, beta: number, abstand: number): number {
    this.besucht += 1;
    const zuege = nebelZuege(stellung);
    if (zuege.some((z) => schlaegtKoenigNebel(stellung, z))) return MATT - abstand - 1;
    const stehen = bewerte(stellung, this.stufe.stellung);
    if (stehen >= beta) return stehen;
    if (stehen > alpha) alpha = stehen;
    if (this.erschoepft) return stehen;
    for (const zug of ordne(stellung, zuege.filter((z) => istSchlag(stellung, z)))) {
      const wert = -this.ruhe(wendeAn(stellung, zug), -beta, -alpha, abstand + 1);
      if (wert >= beta) return wert;
      if (wert > alpha) alpha = wert;
    }
    return alpha;
  }

  wert(stellung: Stellung, tiefe: number, alpha: number, beta: number, abstand: number): number {
    if (stellung.halbzugUhr >= 100) return 0;
    if (tiefe === 0) {
      if (this.stufe.ruhe) return this.ruhe(stellung, alpha, beta, abstand);
      this.besucht += 1;
      if (nebelZuege(stellung).some((z) => schlaegtKoenigNebel(stellung, z))) return MATT - abstand - 1;
      return bewerte(stellung, this.stufe.stellung);
    }
    this.besucht += 1;
    const zuege = nebelZuege(stellung);
    // Wer den König schlagen kann, hat gewonnen — ohne weiter zu suchen.
    if (zuege.some((z) => schlaegtKoenigNebel(stellung, z))) return MATT - abstand - 1;
    // Kein Zug: Patt, Remis.
    if (zuege.length === 0) return 0;
    let bester = -Infinity;
    for (const zug of ordne(stellung, zuege)) {
      const wert = -this.wert(wendeAn(stellung, zug), tiefe - 1, -beta, -alpha, abstand + 1);
      if (wert > bester) bester = wert;
      if (wert > alpha) alpha = wert;
      if (alpha >= beta || this.erschoepft) break;
    }
    return bester;
  }
}

/** Der beste Zug im Nebelschach nach Stufe. Wirft nur, wenn es keinen Zug gibt. */
export function besterZugNebel(stellung: Stellung, level: BotLevel): Zug {
  const zuege = nebelZuege(stellung);
  if (zuege.length === 0) throw new Error('Kein Zug');
  const stufe = STUFEN[level];
  const suche = new SucheNebel(stufe);
  const geordnet = ordne(stellung, zuege);
  // Der Koenigsschlag gewinnt sofort; ein knappes Knotenbudget darf ihn nicht verdecken.
  const sieg = geordnet.find((z) => schlaegtKoenigNebel(stellung, z));
  if (sieg) return sieg;
  let gewaehlt = geordnet[0]!;

  for (let tiefe = 1; tiefe <= stufe.tiefe; tiefe += 1) {
    const reihe = [gewaehlt, ...geordnet.filter((z) => z !== gewaehlt)];
    let bester: Zug | null = null;
    let besterWert = -Infinity;
    let alpha = -Infinity;
    let fertig = true;
    for (const zug of reihe) {
      const wert = -suche.wert(wendeAn(stellung, zug), tiefe - 1, -Infinity, -alpha, 1);
      if (suche.erschoepft) {
        fertig = false;
        break;
      }
      if (wert > besterWert) {
        besterWert = wert;
        bester = zug;
      }
      if (wert > alpha) alpha = wert;
    }
    if (bester) gewaehlt = bester;
    if (!fertig || besterWert >= MATT - 100) break;
  }
  return gewaehlt;
}
