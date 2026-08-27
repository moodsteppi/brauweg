/**
 * Spielzustand und Regeln von Mememory.
 *
 * Reine Logik: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser dem
 * uebergebenen Seed (game-api, Grundsatz 1). Auch das Zurueckdrehen zweier
 * ungleicher Karten misst dieses Modul NICHT selbst — es meldet nur, dass eine
 * Schaupause laeuft, und die Plattform ruft nach Ablauf `beendePause`.
 */

import { MOTIVE } from './motive.js';
import type { MememoryRegeln } from './regeln.js';
import { STUFEN_REGELN, istStufe, stufeAusBotLevel } from './stufen.js';

// ---------------------------------------------------------------------------
// Zufall
// ---------------------------------------------------------------------------

/**
 * Der Zufallsgenerator steht hier noch einmal, obwohl die anderen Spielmodule
 * denselben haben. Aus demselben Grund wie dort: Ein Spielmodul ist eine
 * eigenstaendige Bibliothek. Wanderte der Generator in ein gemeinsames Paket,
 * aenderte eine Verbesserung dort das Brett JEDER gespeicherten Partie.
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
 * Wer sein Brett sieht, koennte 2^32 Seeds durchprobieren und danach jede
 * verdeckte Karte kennen. Im Betrieb kommt deshalb die Hexkette vom Server.
 */
export function baueZufall(saat: Saat): () => number {
  if (typeof saat === 'number') return mulberry32(saat);
  const [a, b, c, d] = worte(saat);
  const zufall = sfc32(a, b, c, d);
  for (let i = 0; i < 12; i++) zufall();
  return zufall;
}

/**
 * Fisher-Yates, von hinten nach vorne.
 *
 * Ausgeschrieben und nicht ueber `sort(() => zufall() - 0.5)`: Ein
 * Vergleichszufall mischt nicht gleichverteilt, und das Ergebnis haengt an der
 * Sortierung der Laufzeitumgebung. Genau daran ist im Feldherr ein iPhone
 * gegen einen Schreibtisch auseinandergelaufen.
 */
function mische<T>(liste: T[], zufall: () => number): T[] {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    const merk = kopie[i]!;
    kopie[i] = kopie[j]!;
    kopie[j] = merk;
  }
  return kopie;
}

/**
 * Eine reproduzierbare Probe aus Saat und Umstaenden.
 *
 * Die Gedaechtnisproben der Bots (behalte ich diese Karte? bleibt sie mir?)
 * passieren IM Zustandsuebergang und muessen deshalb aus dem Snapshot heraus
 * dasselbe ergeben. `Math.random()` waere hier genau der Fehler, den das
 * Modul sonst ueberall vermeidet: Nach einem Serverneustart wuerfelte
 * dieselbe Partie anders, und aus der Zugliste liesse sie sich nicht mehr
 * nachrechnen.
 *
 * FNV-1a ueber die Umstaende, das Ergebnis als Saat fuer einen Zug aus
 * mulberry32. Keine Kryptografie — es geht um ein Gedaechtnis, nicht um
 * verdeckte Karten.
 */
function probe(saat: string, ...teile: readonly (string | number)[]): number {
  const text = `${saat}|${teile.join('|')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return mulberry32(h)();
}

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/**
 * Anlass der laufenden Schaupause.
 *
 * `mischen` ist seit dem 27. August dabei und die einzige, in der sich das
 * ganze Brett aendert. Sie ist ein eigener Schritt und kein Anhaengsel des
 * Zuges: Der Client soll die Karten sichtbar zusammenschieben, mischen und
 * neu verteilen koennen, und dafuer braucht er einen Zustand, in dem genau
 * das passiert. Waere das Mischen Teil von `beendePause`, spraenge das Brett
 * in einem einzigen Bild um.
 */
export type Pause = 'treffer' | 'daneben' | 'mischen';

/**
 * So viele Karten bringt jeder Spieler ab dem dritten mit. Vier Paare.
 *
 * Das Brett waechst dabei NICHT — vier Spalten sind auf einem Handy die
 * Grenze (siehe regeln.ts), und mehr Zeilen machten die Karten flacher. Die
 * zusaetzlichen Karten warten deshalb auf einem Stapel und kommen nach,
 * sobald Platz ist.
 */
export const NACHSCHUB_JE_SPIELER = 8;

/**
 * So viele Karten kommen auf einmal nach.
 *
 * Nachgelegt wird erst, wenn ein ganzer Block Platz hat, und dann wird das
 * Brett EINMAL durchgemischt. Wuerde nach jedem geholten Paar nachgelegt,
 * mischte es bei jedem zweiten Zug — und ein Brett, das staendig neu liegt,
 * ist kein Memory mehr.
 */
export const NACHSCHUB_BLOCK = 8;

/**
 * Ein Stueck Bot-Gedaechtnis: An Platz X lag Motiv Y, gesehen in Zug Z.
 *
 * Gespeichert wird die MOTIVNUMMER und nicht die Kennung — der Zustand
 * rechnet durchgaengig mit Nummern, und die Sicht uebersetzt sie erst beim
 * Hinausgeben.
 */
export interface Erinnerung {
  readonly platz: number;
  readonly motiv: number;
  readonly zug: number;
  /**
   * Hat die einmalige Halteprobe bestanden (nur "schwer") und bleibt damit
   * bis zum Ende. Ohne diesen Merker wuerde bei jedem Zug neu gewuerfelt,
   * und dann waere die Erinnerung eine Muenze statt eines Gedaechtnisses.
   */
  readonly fest?: boolean;
}

export interface MememoryPartie {
  readonly regeln: MememoryRegeln;
  /** Die gezogenen Motivkennungen dieser Partie, sortiert. Index = Motivnummer. */
  readonly motive: readonly string[];
  /** Je Platz die Motivnummer. Verlaesst diese Datei NIE ungefiltert. */
  readonly feld: readonly number[];
  /** Wem ein Platz gehoert, sonst null. */
  readonly besitzer: readonly (number | null)[];
  /** Gerade aufgedeckte Plaetze, hoechstens zwei. */
  readonly offen: readonly number[];
  readonly punkte: Readonly<Record<number, number>>;
  /** Wie viele Karten ein Sitz insgesamt aufgedeckt hat (Grundlage der XP). */
  readonly aufgedeckt: Readonly<Record<number, number>>;
  readonly dran: number;
  /** Selbstgewaehlter Anzeigename je Sitz, leer solange keiner gesetzt ist. */
  readonly namen: Readonly<Record<number, string>>;
  readonly pause: Pause | null;
  readonly leftSeats: readonly number[];
  readonly fertig: boolean;
  /**
   * Fortlaufende Zugnummer. Ein Zug sind zwei Aufdecker; hochgezaehlt wird am
   * Ende der Schaupause, also genau dann, wenn der Zug vorbei ist. Die
   * Gedaechtnisfenster der Bots rechnen damit.
   */
  readonly zug: number;
  /**
   * Die Saat als Zeichenkette — fuer die Gedaechtnisproben.
   *
   * Sie steht schon im Zustand und nicht nur beim Aufbau, weil nach einem
   * Serverneustart aus dem Snapshot weitergewuerfelt werden muss. Verdeckte
   * Karten verraet sie nicht: Die Lage steckt in `feld`, das ohnehin im
   * Snapshot steht, und der Snapshot verlaesst den Server nie.
   */
  readonly saat: string;
  /** Was welcher Bot-Sitz behalten hat. Sitze ohne Stufe stehen nicht drin. */
  readonly erinnerung: Readonly<Record<number, readonly Erinnerung[]>>;
  /**
   * Karten, die noch auf dem Stapel warten. Motivnummern, in fester
   * Reihenfolge — genommen wird von vorn.
   *
   * Leer bei jeder Partie zu zweit: Dort passen alle Karten aufs Brett.
   */
  readonly vorrat: readonly number[];
  /**
   * Wie oft schon gemischt wurde. Zwei Aufgaben in einer Zahl:
   *
   *   - Sie ist der Wuerfelbeutel jeder Mischung. Denselben Generator aus
   *     derselben Saat neu zu bauen ergaebe jedes Mal dieselbe Lage.
   *   - Der Client erkennt an ihr, dass gemischt wurde, und spielt die
   *     Bewegung — auch dann, wenn er die Schaupause verpasst hat, weil er
   *     gerade neu verbunden hat.
   */
  readonly mischung: number;
}

export type MememoryAktion =
  | { readonly typ: 'aufdecken'; readonly platz: number }
  /**
   * Anzeigename fuer dieses Spiel. Kein Spielzug: er steht nicht in
   * `legalActions`, aendert weder Zugrecht noch Punkte und ist deshalb auch
   * waehrend einer Schaupause erlaubt. Der Client setzt ihn einmal, sobald die
   * Partie steht.
   */
  | { readonly typ: 'name'; readonly name: string };

export const NAME_MAX = 16;

/**
 * Saeubert einen selbstgewaehlten Namen.
 *
 * Er wird dem Gegner angezeigt, kommt also aus einem fremden Browser. Steuer-
 * zeichen und Laenge werden hier begrenzt und nicht erst im Client: Ein
 * zweiter Client (oder ein Skript) haelt sich nicht an die Feldlaenge.
 */
export function saeubereName(roh: string): string {
  const sichtbar = [...roh].filter((zeichen) => {
    const code = zeichen.codePointAt(0) ?? 0;
    // Ausgeschriebene Bereiche statt einer Zeichenklasse: Steuerzeichen in
    // einem Quelltext zu SCHREIBEN ist genau der Fehler, den diese Funktion
    // verhindern soll — und die Datei wurde dabei schon einmal unlesbar.
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return false;
    // Nullbreiten- und Richtungszeichen: ein Name aus lauter davon sieht aus
    // wie ein leerer Platz, und ein Umbruch zerlegt die Anzeige.
    if (code >= 0x200b && code <= 0x200f) return false;
    if (code >= 0x2028 && code <= 0x202e) return false;
    return code !== 0xfeff;
  });
  // Ueber Codepunkte schneiden, nicht ueber UTF-16-Einheiten: Ein halbiertes
  // Emoji ist ein kaputtes Zeichen.
  return sichtbar.slice(0, NAME_MAX).join("").trim();
}


// ---------------------------------------------------------------------------
// Bot-Gedaechtnis
// ---------------------------------------------------------------------------

/** Die Sitze, die einen Bot mit Stufe tragen. */
function botSitze(regeln: MememoryRegeln): number[] {
  const stufen = regeln.botStufen;
  if (!stufen) return [];
  return Object.keys(stufen)
    .map((k) => Number(k))
    .filter((sitz) => Number.isInteger(sitz) && istStufe(stufen[sitz]));
}

/**
 * Eine gerade aufgedeckte Karte den Bots vorlegen.
 *
 * ALLEN Bots, nicht nur dem, der aufgedeckt hat: In diesem Spiel sieht jeder
 * jede umgedrehte Karte. Genau deshalb ist das Gedaechtnis auch kein
 * Geheimnis — es enthaelt nur, was ohnehin auf dem Tisch lag.
 *
 * Ob eine Karte haengen bleibt, entscheidet die Stufe. Bei "mittel" faellt
 * die Muenze je Karte einzeln; er kann die eine Haelfte eines Paares behalten
 * und die andere vergessen.
 */
function merke(partie: MememoryPartie, platz: number): MememoryPartie['erinnerung'] {
  const sitze = botSitze(partie.regeln);
  if (sitze.length === 0) return partie.erinnerung;

  const motiv = partie.feld[platz];
  if (motiv === undefined) return partie.erinnerung;

  const neu: Record<number, readonly Erinnerung[]> = { ...partie.erinnerung };
  for (const sitz of sitze) {
    const regel = STUFEN_REGELN[partie.regeln.botStufen![sitz]!];
    if (regel.merkt < 1 && probe(partie.saat, 'merke', sitz, partie.zug, platz) >= regel.merkt) {
      continue;
    }
    // Denselben Platz nicht doppelt fuehren: Wer ihn wieder sieht, sieht ihn
    // frisch — die Zugnummer wird also aufgefrischt.
    const ohne = (neu[sitz] ?? []).filter((e) => e.platz !== platz);
    neu[sitz] = [...ohne, { platz, motiv, zug: partie.zug }];
  }
  return neu;
}

/**
 * Am Zugende altern lassen.
 *
 * Was aus dem Fenster faellt, ist bei "leicht" und "mittel" einfach weg. Bei
 * "schwer" entscheidet EINE Probe mit 70 %, ob es dauerhaft bleibt; das
 * Ergebnis wird als `fest` festgehalten, damit nicht in jedem Zug neu
 * gewuerfelt wird. Ein Gedaechtnis, das jede Runde neu wuerfelt, ist keines.
 */
function altere(partie: MememoryPartie, zugJetzt: number): MememoryPartie['erinnerung'] {
  const sitze = botSitze(partie.regeln);
  if (sitze.length === 0) return partie.erinnerung;

  const neu: Record<number, readonly Erinnerung[]> = { ...partie.erinnerung };
  for (const sitz of sitze) {
    const regel = STUFEN_REGELN[partie.regeln.botStufen![sitz]!];
    if (regel.fenster === null) continue;

    const behalten: Erinnerung[] = [];
    for (const stueck of neu[sitz] ?? []) {
      if (stueck.fest || zugJetzt - stueck.zug <= regel.fenster) {
        behalten.push(stueck);
        continue;
      }
      // Faellt gerade heraus: einmal wuerfeln, dann steht es fest.
      if (regel.haelt > 0 && probe(partie.saat, 'halte', sitz, stueck.platz, stueck.zug) < regel.haelt) {
        behalten.push({ ...stueck, fest: true });
      }
    }
    neu[sitz] = behalten;
  }
  return neu;
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

/**
 * Wie viele Karten ausser den Brettplaetzen noch mitspielen.
 *
 * Null zu zweit. Ab dem dritten Spieler acht je Kopf — aber nur, wenn auf
 * dem Brett ueberhaupt ein ganzer Block frei werden kann. Auf einem winzigen
 * Brett kaeme der Nachschub sonst nie, und die Partie waere nie zu Ende.
 */
export function nachschubMenge(plaetze: number, spieler: number): number {
  if (plaetze < 2 * NACHSCHUB_BLOCK) return 0;
  return NACHSCHUB_JE_SPIELER * Math.max(0, spieler - 2);
}

export function erstellePartie(
  regeln: MememoryRegeln,
  sitze: readonly number[],
  saat: Saat,
  /**
   * Plaetze, auf denen ein Bot sitzt, und die Stufe der Tischeinstellung.
   *
   * Beides kommt von der Plattform (`CreatePartyOptions`) und wird nur
   * gebraucht, wenn die `config` keine `botStufen` nennt — also beim
   * AUFFUELLEN eines wartenden Tisches. Dort steht die config laengst fest,
   * die Tischeinstellung aber nicht.
   */
  botSitze: readonly number[] = [],
  botLevel?: string,
): MememoryPartie {
  const plaetze = regeln.spalten * regeln.zeilen;
  const paare = (plaetze + nachschubMenge(plaetze, sitze.length)) / 2;
  // Fester Katalog plus die Zusatzmotive des Tisches. Doppelte Kennungen
  // fliegen raus — zweimal dasselbe Motiv waeren zwei Paare, die sich nicht
  // unterscheiden lassen, und das Brett liesse sich nicht raeumen.
  const topf = [...new Set([...MOTIVE, ...(regeln.zusatz ?? [])])];
  if (paare > topf.length) {
    throw new Error(`Brett braucht ${paare} Motive, der Katalog hat ${topf.length}`);
  }

  /*
   * Welcher Sitz spielt mit welcher Staerke?
   *
   * Was in der `config` steht, hat Vorrang: Das ist das KI-Match, dort hat
   * JEDER Gegner seine eigene Stufe, und die soll eine Tischeinstellung nicht
   * ueberschreiben. Steht dort nichts, bekommen genau die Bot-Sitze des
   * Tisches die eingestellte Stufe.
   *
   * Warum nicht einfach alle Sitze eintragen: Wer hier steht, bekommt in
   * `sichtFuer` ein Gedaechtnis mitgeschickt. Fuer einen Bot ist das noetig,
   * fuer einen Menschen waere es ein Geschenk.
   */
  const ausConfig = regeln.botStufen ?? {};
  const botStufen =
    Object.keys(ausConfig).length > 0
      ? ausConfig
      : Object.fromEntries(botSitze.map((sitz) => [sitz, stufeAusBotLevel(botLevel)]));
  const wirksam: MememoryRegeln = { ...regeln, botStufen };

  const zufall = baueZufall(saat);
  // Erst ziehen, dann sortieren: Die Sicht schickt die Liste an beide Geraete,
  // und die Reihenfolge darf nichts ueber die Lage auf dem Brett verraten.
  const gezogen = mische(topf, zufall).slice(0, paare).sort();

  const paarliste: number[] = [];
  for (let i = 0; i < paare; i++) paarliste.push(i, i);
  // Erst alles mischen, dann teilen: Was auf dem Stapel landet, ist damit
  // genauso zufaellig wie das, was zuerst liegt.
  const alle = mische(paarliste, zufall);
  const feld = alle.slice(0, plaetze);

  return {
    regeln: wirksam,
    motive: gezogen,
    feld,
    besitzer: Array.from({ length: plaetze }, () => null),
    offen: [],
    punkte: Object.fromEntries(sitze.map((s) => [s, 0])),
    aufgedeckt: Object.fromEntries(sitze.map((s) => [s, 0])),
    // Wer anfaengt, entscheidet der Seed und nicht die Sitzreihenfolge —
    // sonst haette der Gastgeber in jeder Partie den ersten Zug.
    dran: sitze[Math.floor(zufall() * sitze.length)] ?? 0,
    namen: Object.fromEntries(sitze.map((s) => [s, ''])),
    pause: null,
    leftSeats: [],
    fertig: false,
    zug: 0,
    saat: String(saat),
    vorrat: alle.slice(plaetze),
    mischung: 0,
    // Jeder Bot-Sitz startet mit leerem Gedaechtnis. Sitze ohne Stufe stehen
    // gar nicht erst drin — so gibt es fuer einen Menschen nichts zu holen.
    erinnerung: Object.fromEntries(
      Object.keys(botStufen)
        .map((k) => Number(k))
        .filter((s) => Number.isInteger(s))
        .map((s) => [s, [] as Erinnerung[]]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Zuege
// ---------------------------------------------------------------------------

/**
 * Wer am Zug ist, oder null.
 *
 * Waehrend einer Schaupause ist NIEMAND am Zug. Daran haengt die ganze
 * Mechanik: Die Plattform plant die Pause genau dann, wenn `currentActor`
 * null meldet (siehe runtime/party.ts, scheduleInterlude).
 */
export function amZug(partie: MememoryPartie): number | null {
  if (partie.fertig || partie.pause !== null) return null;
  return partie.dran;
}

export function erlaubteZuege(partie: MememoryPartie, sitz: number): MememoryAktion[] {
  if (amZug(partie) !== sitz) return [];
  return partie.feld
    .map((_, platz) => platz)
    .filter((platz) => istAufdeckbar(partie, platz))
    .map((platz) => ({ typ: 'aufdecken', platz }) as const);
}

function istAufdeckbar(partie: MememoryPartie, platz: number): boolean {
  if (platz < 0 || platz >= partie.feld.length) return false;
  if (partie.besitzer[platz] !== null) return false;
  if (partie.offen.includes(platz)) return false;
  return partie.offen.length < 2;
}

export function fuehreAus(
  partie: MememoryPartie,
  sitz: number,
  aktion: MememoryAktion,
): MememoryPartie {
  if (aktion.typ === 'name') {
    return { ...partie, namen: { ...partie.namen, [sitz]: saeubereName(aktion.name) } };
  }

  if (partie.fertig) throw new Error('Partie ist zu Ende');
  if (partie.pause !== null) throw new Error('Schaupause laeuft');
  if (partie.dran !== sitz) throw new Error('Nicht am Zug');
  if (!istAufdeckbar(partie, aktion.platz)) throw new Error('Platz nicht aufdeckbar');

  const offen = [...partie.offen, aktion.platz];
  const aufgedeckt = { ...partie.aufgedeckt, [sitz]: (partie.aufgedeckt[sitz] ?? 0) + 1 };
  // Was umgedreht wird, sehen alle — also legen es alle Bots ihrem Gedaechtnis
  // vor. Ob es haengen bleibt, entscheidet ihre Stufe.
  const erinnerung = merke(partie, aktion.platz);

  if (offen.length < 2) return { ...partie, offen, aufgedeckt, erinnerung };

  const [a, b] = offen as [number, number];
  const treffer = partie.feld[a] === partie.feld[b];

  if (!treffer) return { ...partie, offen, aufgedeckt, erinnerung, pause: 'daneben' };

  // Treffer: Die beiden Plaetze gehoeren sofort dem Spieler. Sie bleiben damit
  // auch fuer den Gegner sichtbar — die Sicht zeigt jeden besessenen Platz.
  const besitzer = [...partie.besitzer];
  besitzer[a] = sitz;
  besitzer[b] = sitz;
  return {
    ...partie,
    offen,
    aufgedeckt,
    erinnerung,
    besitzer,
    punkte: { ...partie.punkte, [sitz]: (partie.punkte[sitz] ?? 0) + 1 },
    pause: 'treffer',
  };
}

/**
 * Dauer der Schaupause, oder null wenn keine laeuft.
 *
 * Zwei verschiedene Laengen, und der Unterschied ist keine Kosmetik: Nach
 * einem Treffer liegt nichts mehr im Weg, es geht sofort weiter; nach einem
 * Fehlgriff muss der Gegner Zeit haben, sich die beiden Karten zu merken.
 */
export function pauseDauerMs(partie: MememoryPartie): number | null {
  if (partie.pause === 'treffer') return 650;
  if (partie.pause === 'daneben') return partie.regeln.merkzeitMs;
  // Zusammenschieben, mischen, austeilen — die Bewegung braucht ihre Zeit,
  // und waehrend sie laeuft, darf niemand tippen. Der Client rechnet mit
  // derselben Zahl (MISCH_DAUER_MS in Mememory.tsx).
  if (partie.pause === 'mischen') return 2200;
  return null;
}

/** Ende der Schaupause: Karten wegraeumen bzw. zurueckdrehen, dann weiter. */
export function beendePause(partie: MememoryPartie): MememoryPartie {
  if (partie.pause === null) return partie;
  // Die Mischpause ist der Mischvorgang selbst — sie beendet keinen Zug.
  if (partie.pause === 'mischen') return mischeNeu(partie);

  // Hier — und nur hier — ist ein Zug wirklich vorbei: Zwei Karten lagen
  // offen, sie sind gewertet, die naechsten zwei kommen. Die
  // Gedaechtnisfenster der Bots rechnen mit dieser Zahl.
  const zug = partie.zug + 1;
  const weiter: MememoryPartie = {
    ...partie,
    offen: [],
    // Ein Treffer behaelt das Zugrecht, ein Fehlgriff gibt es ab.
    dran: partie.pause === 'treffer' ? partie.dran : naechsterSitz(partie, partie.dran),
    pause: null,
    zug,
    erinnerung: altere(partie, zug),
  };

  // Ist ein ganzer Block frei geworden, wird nachgelegt — aber erst im
  // naechsten Schritt. Dazwischen liegt die Mischpause, damit der Client die
  // Bewegung zeigen kann.
  if (nachschubFaellig(weiter)) return { ...weiter, pause: 'mischen' };

  return { ...weiter, fertig: istFertig(weiter) };
}

/** Die Partie ist zu Ende, wenn das Brett leer ist UND kein Stapel mehr wartet. */
function istFertig(partie: MememoryPartie): boolean {
  return partie.vorrat.length === 0 && partie.besitzer.every((wer) => wer !== null);
}

/** Genug Platz fuer einen ganzen Block Nachschub? */
function nachschubFaellig(partie: MememoryPartie): boolean {
  if (partie.vorrat.length === 0) return false;
  const frei = partie.besitzer.filter((wer) => wer !== null).length;
  return frei >= Math.min(NACHSCHUB_BLOCK, partie.vorrat.length);
}

/**
 * Nachlegen und das ganze Brett neu mischen.
 *
 * Die geholten Paare gehen vom Brett — sie sind gewertet, ihre Punkte stehen
 * laengst in `punkte`. Ihre Plaetze nehmen die Karten vom Stapel ein, und
 * dann liegt ALLES neu: Wer sich gemerkt hat, wo etwas lag, faengt von vorn
 * an. Genau darum geht es, sonst waere der Nachschub bloss Auffuellen.
 *
 * **Die Rechnung geht immer auf.** Genommen werden hoechstens so viele
 * Karten, wie Plaetze frei sind; und frei werden sie in Zweierschritten, bei
 * jeder Schaupause geprueft — der Block ist also genau erreicht und nie
 * ueberschritten. Das Brett bleibt damit voll.
 */
function mischeNeu(partie: MememoryPartie): MememoryPartie {
  const behalten = partie.feld.filter((_, platz) => partie.besitzer[platz] === null);
  const frei = partie.feld.length - behalten.length;
  const nachschub = partie.vorrat.slice(0, frei);
  const mischung = partie.mischung + 1;
  const zufall = baueZufall(`${partie.saat}|misch|${mischung}`);
  const feld = mische([...behalten, ...nachschub], zufall);

  return {
    ...partie,
    feld,
    besitzer: feld.map(() => null),
    offen: [],
    vorrat: partie.vorrat.slice(nachschub.length),
    mischung,
    pause: null,
    // Nach dem Mischen liegt nichts mehr dort, wo es lag. Ein Gedaechtnis zu
    // behalten waere schlimmer als es zu leeren: Der Bot griffe gezielt
    // daneben, statt nur zufaellig.
    erinnerung: Object.fromEntries(
      Object.keys(partie.erinnerung).map((sitz) => [Number(sitz), [] as Erinnerung[]]),
    ),
    fertig: false,
  };
}

/**
 * Wer als naechstes dran ist: der naechsthoehere Sitz, danach wieder von vorn.
 *
 * Bis zum 27. August hiess das "der andere" und suchte den ersten Sitz, der
 * nicht man selbst ist. Zu zweit ist das dasselbe; zu dritt bekaeme Sitz 2
 * nie einen Zug.
 */
function naechsterSitz(partie: MememoryPartie, sitz: number): number {
  const sitze = Object.keys(partie.punkte).map(Number).sort((x, y) => x - y);
  if (sitze.length === 0) return sitz;
  const platz = sitze.indexOf(sitz);
  return sitze[(platz + 1) % sitze.length] ?? sitz;
}

export function markiereVerlassen(partie: MememoryPartie, sitz: number): MememoryPartie {
  if (partie.leftSeats.includes(sitz)) return partie;
  return { ...partie, leftSeats: [...partie.leftSeats, sitz] };
}

/**
 * Platzierungen.
 *
 * Gleichstand ergibt zweimal Platz 1 — im Memory ist das ein echtes
 * Unentschieden und keine Verlegenheitsloesung: Bei 20 Paaren kann jeder zehn
 * haben.
 */
export function platzierungen(
  partie: MememoryPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const sitze = Object.keys(partie.punkte).map(Number).sort((a, b) => a - b);
  const reihe = sitze
    .map((seat) => ({
      seat,
      points: partie.punkte[seat] ?? 0,
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

/** Sieger, oder null bei Gleichstand bzw. laufender Partie. */
export function sieger(partie: MememoryPartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster || !zweiter) return null;
  return erster.points === zweiter.points ? null : erster.seat;
}
