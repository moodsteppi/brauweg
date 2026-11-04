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
  START_FEN,
  type Zug,
  UMWANDLUNGEN,
  angegriffen,
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
  zuFen,
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
import type { BroChessAktion, BroChessZug } from './partie.js';
import type { BroChessSicht, GeheimeDameSicht, SecretDameSicht } from './sicht.js';

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
    if (opfer !== '') g += 10 * WERT[opfer.toLowerCase()]! - WERT[taeter]!;
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
  stellung.brett[zug.nach] !== '' ||
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
  const zug = besterZug(ausFen(sicht.fen), level);
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
 *   welche legal sind, weiss er also nicht sicher. Ein Zug, den `act`
 *   abweist, beendet am Server den ganzen Tisch („abgebrochen", `playBot` in
 *   packages/server/src/runtime/party.ts). Deshalb spielt er nur Zuege, die
 *   fuer JEDEN noch moeglichen Kandidaten legal sind. Die Menge engt er mit
 *   `sicht.schach` ein, das unter B auch die verdeckte Dame zaehlt: Schach
 *   ohne sichtbaren Angreifer heisst, sie greift den König an; kein Schach
 *   heisst, sie tut es nicht. Bleibt kein Zug uebrig, der fuer alle legal
 *   ist, GIBT ER AUF. Das klingt hart, ist aber der einzige Zug, den `act`
 *   sicher annimmt: Raten ging in einer Probe (363 Partien, 04.11.2026) einmal
 *   schief — und dann bricht der Server den ganzen Tisch ab, auch fuer den
 *   Menschen. Beispiel: König c1 im sichtbaren Schach durch Lb2, fremde
 *   Kandidaten Th8 und Bh7. Ist Th8 die Dame, ist Kxb2 verboten; ist es h7,
 *   sind Kb1 und Kc2 verboten. Schliessen liesse sich die Luecke nur mit den
 *   eigenen erlaubten Zuegen in der Sicht (ein Feld im Spielkern, sicht.ts);
 *   die stehen dort (Stand 04.11.2026) nicht.
 *   OFFEN: Aufgeben statt raten ist eine Produktentscheidung, die noch kein
 *   Mensch getroffen hat (Zweitleser, 04.11.2026). Wie oft es vorkommt, zaehlt
 *   der Test „Regel B: Stichprobe" in test/bot.test.ts; die Zahl steht bewusst
 *   nicht hier, damit sie nicht veraltet.
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

/*
 * Regel B: die Kandidaten mit der Zugliste eingrenzen.
 *
 * Unter B steht in `verlauf` hinter einem Zug genau dann ein „+", wenn der
 * König danach im Schach stand — die verdeckte Dame eingerechnet (partie.ts,
 * `zieheGeheim`). Ein Mensch kann daraus ablesen, welche Figur es NICHT sein
 * kann: Haette sie den König als Dame erreicht, haette dort ein „+" stehen
 * muessen. Und ein „+" ohne sichtbaren Angreifer nennt die Figuren, die es
 * sein MUSS. Der Bot liest dieselbe Zugliste aus seiner Sicht und folgt jeder
 * fremden Figur ueber die Partie.
 *
 * Ohne das gab er in einer Probe (363 Partien unter B, 04.11.2026) gut ein
 * Drittel oefter auf, weil kein Zug fuer alle Kandidaten sicher legal war. Die
 * uebrigen Aufgaben sind echte Mehrdeutigkeiten (geprueft: die echte Dame fiel
 * nie heraus, nachspielen scheiterte nie); gezaehlt im Test „Regel B: Stichprobe".
 *
 * Nachgespielt wird ab der Grundstellung; stimmt das Ergebnis nicht genau mit
 * der FEN der Sicht ueberein (eine Partie aus einer anderen Stellung, eine
 * Zeile, die er nicht lesen kann), grenzt er nichts ein und nimmt alle — das
 * ist nur vorsichtiger, nie falsch.
 */

const ART: Readonly<Record<string, string>> = { N: 'n', B: 'b', R: 'r', Q: 'q', K: 'k' };

/** Findet den Zug zu einem Eintrag der Zugliste (ohne Schachzeichen); null, wenn keiner passt. */
function zugAusNotation(stellung: Stellung, text: string): GeheimZug | null {
  const farbe = stellung.amZug;
  const basis = pseudoZuege(stellung);
  const koenig = koenigVon(stellung, farbe);
  if (text === 'O-O' || text === 'O-O-O') {
    const nach = text === 'O-O' ? koenig + 2 : koenig - 2;
    const zug = basis.find((z) => z.von === koenig && z.nach === nach);
    return zug ? { ...zug, dame: false } : null;
  }
  // Langschrift „Nb1-d3" / „e3xe6=Q": ein Damenzug (geheim.ts, `notationGeheim`) — oder eine
  // Kurzschrift mit vollem Ausgangsfeld („Qh4xe1"); die erkennt man daran, dass die Grundfigur
  // den Zug selbst darf.
  const lang = /^([NBRQK]?)([a-h][1-8])([-x])([a-h][1-8])(?:=([QRBN]))?$/.exec(text);
  if (lang) {
    const von = feldIndex(lang[2]!);
    const nach = feldIndex(lang[4]!);
    const umwandlung = lang[5]?.toLowerCase() as Zug['umwandlung'];
    const eigen = basis.find((z) => z.von === von && z.nach === nach && z.umwandlung === umwandlung);
    if (eigen) return { ...eigen, dame: false };
    return { von, nach, ...(umwandlung ? { umwandlung } : {}), dame: true };
  }
  const kurz = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=([QRBN]))?$/.exec(text);
  if (!kurz) return null;
  const art = kurz[1] ? ART[kurz[1]]! : 'p';
  const nach = feldIndex(kurz[4]!);
  const umwandlung = kurz[5]?.toLowerCase();
  const passend = basis.filter((z) => {
    const name = feldName(z.von);
    return (
      z.nach === nach &&
      stellung.brett[z.von]!.toLowerCase() === art &&
      (z.umwandlung ?? undefined) === umwandlung &&
      (!kurz[2] || name[0] === kurz[2]) &&
      (!kurz[3] || name[1] === kurz[3])
    );
  });
  // Mehrere nur, wenn eine davon gefesselt ist — die Kurzschrift zaehlt nur die legalen.
  const legal = passend.filter((z) => !imSchach(wendeAn(stellung, z), farbe));
  const zug = legal[0] ?? passend[0];
  return zug ? { ...zug, dame: false } : null;
}

/**
 * Die Kandidaten nach der Zugliste — aber nie weniger als einer.
 *
 * Laeuft die Eingrenzung leer, hat sie sich verrechnet oder die Dame hat sich
 * verdeckt umgewandelt (dann hat die neue Figur keine Damenkraft und kann
 * ohne „+" auf den König sehen). Beides weiss der Bot nicht sicher. Leer
 * hiesse in `wurzelZuege` „keine verdeckte Dame" und gaebe jeden Zug frei —
 * auch einen, der fuer einen Kandidaten illegal ist; `act` wirft dann, und
 * der Server bricht den ganzen Tisch ab. Also zurueck auf alle Kandidaten:
 * vorsichtiger, nie falsch. Gefunden vom Zweitleser am 04.11.2026.
 */
export function eingegrenzt(alle: readonly number[], ausVerlauf: readonly number[] | null): number[] {
  return ausVerlauf && ausVerlauf.length > 0 ? [...ausVerlauf] : [...alle];
}

/**
 * Felder der fremden Figuren, die nach der Zugliste noch die verdeckte Dame
 * sein koennen; null, wenn sich die Partie nicht nachspielen liess.
 */
function kandidatenAusVerlauf(sicht: BroChessSicht, farbe: Farbe): number[] | null {
  const fremd = andere(farbe);
  let stellung = ausFen(START_FEN);
  // Jede Figur bekommt beim Start eine Nummer, die mit ihr zieht.
  let nummer: (number | null)[] = stellung.brett.map((figur, feld) => (figur === '' ? null : feld));
  const moeglich = new Set<number>();
  for (let feld = 0; feld < 64; feld += 1) {
    const figur = stellung.brett[feld]!;
    if (figur !== '' && farbeVon(figur) === fremd && figur.toLowerCase() !== 'k') moeglich.add(feld);
  }

  for (const eintrag of sicht.verlauf) {
    const zeichen = /[+#]$/.exec(eintrag)?.[0] ?? '';
    const zug = zugAusNotation(stellung, eintrag.replace(/[+#]$/, ''));
    if (!zug) return null;
    const zieher = stellung.amZug;
    const danach = zug.dame ? wendeAnGeheim(stellung, zug) : wendeAn(stellung, zug);

    const neu = [...nummer];
    neu[zug.nach] = nummer[zug.von]!;
    neu[zug.von] = null;
    if (!zug.dame && stellung.brett[zug.von]!.toLowerCase() === 'k' && Math.abs(zug.nach - zug.von) === 2) {
      const kurzeRochade = zug.nach > zug.von;
      const turmVon = kurzeRochade ? zug.von + 3 : zug.von - 4;
      const turmNach = kurzeRochade ? zug.von + 1 : zug.von - 1;
      neu[turmNach] = nummer[turmVon]!;
      neu[turmVon] = null;
    }
    // Was jetzt leer ist, hat keine Nummer mehr — so faellt auch der en passant geschlagene Bauer heraus.
    for (let feld = 0; feld < 64; feld += 1) if (danach.brett[feld] === '') neu[feld] = null;
    nummer = neu;
    stellung = danach;

    // Nach einem fremden Zug ist er selbst am Zug: Was sagt das Schachzeichen ueber die Dame?
    if (zieher === fremd && zeichen !== '#') {
      const koenig = koenigVon(stellung, farbe);
      if (koenig < 0) return null;
      const sichtbar = angegriffen(stellung.brett, koenig, fremd);
      for (const id of [...moeglich]) {
        const feld = nummer.indexOf(id);
        if (feld < 0) continue;
        const sieht = dameSieht(stellung.brett, feld, koenig);
        if (zeichen === '' && sieht) moeglich.delete(id);
        if (zeichen === '+' && !sichtbar && !sieht) moeglich.delete(id);
      }
    }
  }

  // Nur wenn das Nachgespielte genau die Stellung der Sicht ist, gilt die Eingrenzung.
  if (zuFen(stellung).split(' ')[0] !== sicht.fen.split(' ')[0]) return null;
  const felder: number[] = [];
  for (let feld = 0; feld < 64; feld += 1) {
    const id = nummer[feld];
    const figur = stellung.brett[feld]!;
    if (id !== null && id !== undefined && moeglich.has(id) && figur !== '' && farbeVon(figur) === fremd) {
      felder.push(feld);
    }
  }
  return felder;
}

/** Das Modell mit der fremden Dame verdeckt auf `feld` — eine Annahme, nie ein Wissen. */
function mitKandidat(modell: SecretDameStand, fremd: Farbe, feld: number, stellung: Stellung): SecretDameStand {
  const dame: GeheimeDame = {
    zustand: 'verdeckt',
    feld,
    grundfigur: stellung.brett[feld]!.toLowerCase(),
    bekannt: false,
  };
  return fremd === 'w' ? { ...modell, w: dame } : { ...modell, b: dame };
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

const zugSchluessel = (z: Zug): string => `${z.von}-${z.nach}-${z.umwandlung ?? ''}`;

interface WurzelZug {
  readonly zug: GeheimZug;
  /** Wahrscheinlichkeit, dass die verdeckte fremde Dame danach den König schlagen kann (nur Regel A). */
  readonly risiko: number;
}

/** Die Zuege, die der Bot an der Wurzel ueberhaupt in Betracht zieht (siehe Kopf des Abschnitts). */
function wurzelZuege(
  stellung: Stellung,
  modell: SecretDameStand,
  sd: SecretDameSicht,
  farbe: Farbe,
  sicht: BroChessSicht,
): WurzelZug[] {
  const fremd = andere(farbe);
  const basis = legaleZuegeGeheim(stellung, modell);
  let alle = kandidaten(stellung, sd, farbe);
  if (alle.length > 0 && sd.regel === 'B') alle = eingegrenzt(alle, kandidatenAusVerlauf(sicht, farbe));
  /*
   * Leer heisst hier nur: Die fremde Dame ist bekannt oder vom Brett (die
   * Sicht nennt sie in `bekannt`), es gibt nichts Verdecktes mehr. Dann gilt
   * jeder Zug des Modells. Eine leer gelaufene Eingrenzung kommt hier nicht
   * an, siehe `eingegrenzt`.
   */
  if (alle.length === 0) return basis.map((zug) => ({ zug, risiko: 0 }));

  if (sd.regel === 'A') {
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

  // Regel B: die Kandidaten mit dem Schach aus der Sicht einengen.
  const koenig = koenigVon(stellung, farbe);
  const greiftAn = (f: number): boolean => koenig >= 0 && dameSieht(stellung.brett, f, koenig);
  const sichtbaresSchach = imSchachGeheim(stellung, modell);
  const moeglich = !sicht.schach
    ? alle.filter((f) => !greiftAn(f))
    : sichtbaresSchach
      ? alle
      : alle.filter(greiftAn);
  const zaehler = new Map<string, number>();
  for (const feld of moeglich) {
    for (const zug of legaleZuegeGeheim(stellung, mitKandidat(modell, fremd, feld, stellung))) {
      const s = zugSchluessel(zug);
      zaehler.set(s, (zaehler.get(s) ?? 0) + 1);
    }
  }
  // Nur was fuer JEDEN moeglichen Kandidaten legal ist; leer heisst aufgeben (siehe Kopf).
  return basis
    .filter((zug) => zaehler.get(zugSchluessel(zug)) === moeglich.length)
    .map((zug) => ({ zug, risiko: 0 }));
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
  const wurzel = wurzelZuege(stellung, modell, sd, farbe, sicht);
  // Nur unter Regel B moeglich: kein Zug, der sicher legal ist (Begruendung im Kopf des Abschnitts).
  if (wurzel.length === 0) return { type: 'aufgeben' };
  const zug = besterZugGeheim(stellung, modell, wurzel, level);
  return {
    type: 'zug',
    von: feldName(zug.von),
    nach: feldName(zug.nach),
    ...(zug.umwandlung ? { umwandlung: zug.umwandlung } : {}),
  };
}
