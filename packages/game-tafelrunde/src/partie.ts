/**
 * Spielzustand und Regeln von Tafelrunde.
 *
 * Reine Logik: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser dem
 * uebergebenen Seed (game-api, Grundsatz 1).
 *
 * Das Spiel: Jeder Sitz hat seinen EIGENEN Laden, seine eigene Reservebank und
 * seine eigene Bretthaelfte. Zwischen den Runden kauft man Einheiten aus dem
 * Laden, stellt sie auf, verschmilzt drei gleiche zu einer staerkeren und
 * steigert seinen Level. Danach kaempfen die Sitze paarweise gegeneinander;
 * gerechnet wird der Kampf in kampf.ts, angesetzt und abgerechnet hier
 * (`setzeAn`, `beginneKampf`, `loeseKampfAuf`).
 *
 * Es gibt KEINE Zugfolge. Alle Sitze ruesten gleichzeitig, genau wie bei
 * Eiland; `amZug` nennt trotzdem einen Sitz, damit Zugzeit und Bot-Uebernahme
 * der Plattform ueberhaupt greifen. Wer handeln darf, entscheidet allein
 * `darfHandeln` — und das ist jeder, der noch lebt und noch nicht bereit ist.
 */

import {
  type EinheitId,
  type Kosten,
  KOSTENSTUFEN,
  MAX_STUFE,
  type Stufe,
  VERSCHMELZ_ZAHL,
  VORRAT_JE_KOSTEN,
  KATALOG,
  einheit,
  einheitenMitKosten,
  gesamtkosten,
  istEinheitId,
  kartenZahl,
} from './katalog.js';
import { BRETT_FELDER, istBrettplatz } from './brett.js';
import {
  MAX_LEVEL,
  type TafelrundeRegeln,
  START_LEVEL,
  aufstiegKosten,
  feldplaetze,
  ladenChancen,
  serienBonus,
  zins,
} from './regeln.js';
import { type Kampfbericht, simuliereKampf } from './kampf.js';
import { type Saat, baueZufall, kampfSaat, ladenSaat, paarungsSaat } from './zufall.js';

// ---------------------------------------------------------------------------
// Zufall
// ---------------------------------------------------------------------------

/*
 * Der Generator und die Saatzeichenketten stehen in zufall.ts — nicht, weil
 * sie dort besser aufgehoben waeren, sondern weil der Kampf sie ebenfalls
 * braucht und diese Datei den Kampf braucht. Hier stehen sie weiter im
 * Export, damit index.ts und die Proben nur eine Anlaufstelle haben.
 */
export type { Saat };
export { baueZufall, kampfSaat, ladenSaat, paarungsSaat };

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/** Eine Einheit, wie sie auf Bank oder Brett steht. */
export interface Kaempfer {
  readonly id: EinheitId;
  readonly stufe: Stufe;
}

export type Serienart = 'sieg' | 'niederlage';

/**
 * Sieges- oder Niederlagenserie. Beide zaehlen gleich, denn beide zahlen
 * Bonusgold — wer verliert, soll aufholen koennen, statt nur schneller zu
 * verlieren.
 */
export interface Serie {
  readonly art: Serienart | null;
  readonly laenge: number;
}

export const KEINE_SERIE: Serie = { art: null, laenge: 0 };

/** Alles, was einem Sitz gehoert. */
export interface Heer {
  readonly leben: number;
  readonly gold: number;
  readonly level: number;
  /** Ladenplaetze. null = schon gekauft oder Vorrat erschoepft. */
  readonly laden: readonly (EinheitId | null)[];
  readonly bank: readonly (Kaempfer | null)[];
  /** Die eigene Bretthaelfte, Platznummern siehe brett.ts. */
  readonly brett: readonly (Kaempfer | null)[];
  readonly serie: Serie;
  /** Hat der Sitz seine Vorbereitung beendet? */
  readonly bereit: boolean;
  /** Wie oft der Laden fuer diesen Sitz schon gefuellt wurde. Siehe ladenSaat. */
  readonly wuerfe: number;
  /** Runde des Ausscheidens, sonst null. */
  readonly ausRunde: number | null;
  readonly verlassen: boolean;
}

/**
 * Phasen einer Runde.
 *
 * In `kampf` ist bereits alles gerechnet: Der Uebergang dorthin simuliert alle
 * Kaempfe der Runde in einem Rutsch (`beginneKampf`), und was danach vergeht,
 * ist reine Zuschauzeit fuer die Anzeige. Aufgeloest wird die Phase von
 * `loeseKampfAuf`, das die Plattform ueber `advanceInterlude` aufruft.
 */
export type Phase = 'vorbereitung' | 'kampf' | 'ende';

export interface TafelrundePartie {
  readonly regeln: TafelrundeRegeln;
  /** Saat als Zeichenkette. Aus ihr entsteht jeder Laden, siehe ladenSaat. */
  readonly saat: string;
  readonly runde: number;
  readonly phase: Phase;
  /**
   * Uebrige Kopien je Einheit — der gemeinsame Vorrat ALLER Sitze.
   *
   * Er ist der eigentliche Wettbewerb des Spiels: Wer eine Einheit sammelt,
   * nimmt sie den anderen weg. Deshalb liegt er in der Partie und nicht im
   * Heer, und deshalb wandern Karten beim Neu-Wuerfeln und beim Verkaufen
   * zurueck. Ein Vorrat, aus dem nur entnommen wird, ist nach zehn Runden
   * leer und der Laden bleibt bis zum Partieende leer.
   */
  readonly vorrat: Readonly<Record<EinheitId, number>>;
  readonly heere: Readonly<Record<number, Heer>>;
  /**
   * Die Kaempfe DIESER Runde, samt vollstaendigem Ablaufprotokoll.
   *
   * Sie stehen im Zustand und nicht nur in der Sicht, weil die Abrechnung sie
   * braucht: Wer gewonnen hat, entscheidet der Kampf und nicht der Server, der
   * die Sicht gerade zusammenstellt. Zweimal simulieren waere der Weg, auf dem
   * Anzeige und Abrechnung auseinanderlaufen.
   *
   * Ausserhalb der Kampfphase ist die Liste LEER (`naechsteRunde` raeumt sie
   * ab). Ein Protokoll ist je nach Kampf ein paar hundert Ereignisse gross,
   * und die brauchen im Snapshot nur genau so lange zu stehen, wie ihnen
   * jemand zusieht.
   */
  readonly kaempfe: readonly Kampfpaarung[];
  readonly fertig: boolean;
}

/**
 * Ein angesetzter Kampf: wer gegen wen, auf welcher Arenaseite.
 *
 * `a` steht auf Arenaseite 0, `b` auf Seite 1 (siehe arena.ts). Welcher Sitz
 * wohin kommt, wuerfelt `setzeAn` aus — nicht aus Spielerei, sondern weil die
 * Seite den Erstzieher mitbestimmt und ein fester Platz ein Vorteil waere,
 * den niemand erspielt hat.
 */
export interface Kampfpaarung {
  readonly a: number;
  /** Beim Geist: der Sitz, dessen Brett als Abbild antritt. Sonst der Gegner. */
  readonly b: number;
  /**
   * Kaempft `b` selbst mit, oder steht dort nur ein Abbild?
   *
   * Bei einer ungeraden Zahl lebender Sitze bleibt einer uebrig. Er bekommt
   * KEINE Freirunde, sondern das Brett eines anderen als Geist vorgesetzt:
   * Eine Freirunde waere ein Schadensfreibrief, und wer sie zufaellig oft
   * bekaeme, gewaenne ohne Kampf. Der Geist nimmt seinerseits nichts mit —
   * sein Besitzer kaempft an anderer Stelle seinen eigenen Kampf.
   */
  readonly geist: boolean;
  readonly bericht: Kampfbericht;
}

export type Bereich = 'bank' | 'brett';

export interface Ort {
  readonly bereich: Bereich;
  readonly platz: number;
}

export type TafelrundeAktion =
  /** Einen Ladenplatz kaufen. Die Einheit landet auf der Bank. */
  | { readonly typ: 'kaufen'; readonly platz: number }
  | { readonly typ: 'neuwuerfeln' }
  | { readonly typ: 'levelAuf' }
  /** Zwischen Bank und Brett schieben oder zwei Plaetze tauschen. */
  | { readonly typ: 'verschieben'; readonly von: Ort; readonly nach: Ort }
  | { readonly typ: 'verkaufen'; readonly ort: Ort }
  /** Vorbereitung beenden. Sind alle bereit, geht es in den Kampf. */
  | { readonly typ: 'bereit' };

// ---------------------------------------------------------------------------
// Vorrat
// ---------------------------------------------------------------------------

export function vollerVorrat(): Record<EinheitId, number> {
  const vorrat = {} as Record<EinheitId, number>;
  for (const e of KATALOG) vorrat[e.id] = VORRAT_JE_KOSTEN[e.kosten];
  return vorrat;
}

/** Wie viele Karten einer Kostenstufe noch im Vorrat liegen. */
export function vorratSumme(
  vorrat: Readonly<Record<EinheitId, number>>,
  kosten: Kosten,
): number {
  return einheitenMitKosten(kosten).reduce((summe, e) => summe + (vorrat[e.id] ?? 0), 0);
}

function ausGewicht<T>(paare: readonly (readonly [T, number])[], zufall: () => number): T | null {
  const summe = paare.reduce((s, [, g]) => s + g, 0);
  if (summe <= 0) return null;
  let los = zufall() * summe;
  for (const [wert, gewicht] of paare) {
    los -= gewicht;
    if (los < 0) return wert;
  }
  // Rundungsfehler am Rand: die letzte Moeglichkeit ist immer eine gueltige
  // Antwort, `null` waere hier ein Laden mit Loch.
  return paare[paare.length - 1]?.[0] ?? null;
}

/**
 * Eine Karte aus dem Vorrat ziehen.
 *
 * Zwei Ziehungen hintereinander: erst die Kostenstufe nach den Chancen des
 * Levels, dann innerhalb der Stufe GEWICHTET nach den uebrigen Kopien. Das
 * zweite Gewicht ist der Kern der Vorratsmechanik — eine Einheit, die drei
 * Spieler bereits sammeln, taucht seltener auf, und genau das macht das
 * Mitzaehlen des Vorrats zu einer Faehigkeit statt zu einer Formalie.
 *
 * Ist in den Stufen, die dieser Level ueberhaupt sehen darf, nichts mehr
 * uebrig, wird aus den anderen gezogen. Ein leerer Ladenplatz waere die
 * schlechtere Antwort: Er sieht aus wie ein Fehler und ist keiner.
 */
export function zieheKarte(
  vorrat: Readonly<Record<EinheitId, number>>,
  level: number,
  zufall: () => number,
): EinheitId | null {
  const chancen = ladenChancen(level);
  const erlaubt = KOSTENSTUFEN.filter((k) => chancen[k] > 0 && vorratSumme(vorrat, k) > 0);
  const auswahl =
    erlaubt.length > 0 ? erlaubt : KOSTENSTUFEN.filter((k) => vorratSumme(vorrat, k) > 0);
  if (auswahl.length === 0) return null;

  const gewichte: [Kosten, number][] = auswahl.map((k) => [
    k,
    erlaubt.length > 0 ? chancen[k] : vorratSumme(vorrat, k),
  ]);
  const stufe = ausGewicht(gewichte, zufall);
  if (stufe === null) return null;

  const kandidaten: [EinheitId, number][] = einheitenMitKosten(stufe).map((e) => [
    e.id,
    vorrat[e.id] ?? 0,
  ]);
  return ausGewicht(kandidaten, zufall);
}

/**
 * Einen ganzen Laden ziehen. Die gezogenen Karten sind aus dem Vorrat heraus,
 * solange sie ausliegen — beim Neu-Wuerfeln und beim naechsten Rundenanfang
 * gehen sie zurueck.
 */
export function zieheLaden(
  vorrat: Readonly<Record<EinheitId, number>>,
  level: number,
  plaetze: number,
  zufall: () => number,
): { laden: (EinheitId | null)[]; vorrat: Record<EinheitId, number> } {
  const rest = { ...vorrat } as Record<EinheitId, number>;
  const laden: (EinheitId | null)[] = [];
  for (let i = 0; i < plaetze; i++) {
    const gezogen = zieheKarte(rest, level, zufall);
    if (gezogen === null) {
      laden.push(null);
      continue;
    }
    rest[gezogen] = (rest[gezogen] ?? 0) - 1;
    laden.push(gezogen);
  }
  return { laden, vorrat: rest };
}

/** Ausliegende Ladenkarten in den Vorrat zurueckgeben. */
function gibZurueck(
  vorrat: Readonly<Record<EinheitId, number>>,
  karten: readonly (EinheitId | null)[],
): Record<EinheitId, number> {
  const rest = { ...vorrat } as Record<EinheitId, number>;
  for (const karte of karten) {
    if (karte === null) continue;
    rest[karte] = (rest[karte] ?? 0) + 1;
  }
  return rest;
}

/**
 * Den Laden eines Sitzes neu fuellen: alte Karten zurueck, neue ziehen.
 *
 * Eine Funktion fuer beides — Rundenanfang und Neu-Wuerfeln —, weil ein
 * zweiter Weg unweigerlich das Zurueckgeben vergessen wuerde. Genau daran
 * laeuft ein Vorrat leer, und zwar erst nach zwanzig Runden.
 */
function fuelleLaden(
  partie: TafelrundePartie,
  sitz: number,
): { heer: Heer; vorrat: Record<EinheitId, number> } {
  const heer = heerVon(partie, sitz);
  const zurueck = gibZurueck(partie.vorrat, heer.laden);
  const wurf = heer.wuerfe + 1;
  const { laden, vorrat } = zieheLaden(
    zurueck,
    heer.level,
    partie.regeln.ladenPlaetze,
    baueZufall(ladenSaat(partie.saat, sitz, wurf)),
  );
  return { heer: { ...heer, laden, wuerfe: wurf }, vorrat };
}

// ---------------------------------------------------------------------------
// Verschmelzen
// ---------------------------------------------------------------------------

interface Fundstelle {
  readonly bereich: Bereich;
  readonly platz: number;
}

/**
 * Drei gleiche derselben Stufe werden eine der naechsten — und zwar so lange,
 * bis nichts mehr passt.
 *
 * Die Kettenreaktion ist keine Zugabe, sondern der Fall, der zaehlt: Wer neun
 * Kopien sammelt, bekommt EINE Einheit der Stufe 3, nicht drei der Stufe 2.
 * Deshalb die Schleife und keine einmalige Pruefung.
 *
 * Gezaehlt wird ueber BANK UND BRETT hinweg. Sonst haenge das Verschmelzen
 * davon ab, wo die Karten gerade liegen, und man muesste vor jedem Kauf erst
 * aufraeumen.
 *
 * Die Reihenfolge — erst Brett, dann Bank, jeweils aufsteigend — ist die
 * ganze Bestimmtheit dieser Funktion: Sie entscheidet, WELCHE drei von vieren
 * verschmelzen und wo das Ergebnis landet. Waere sie zufaellig, waere der
 * Zustand nach einem Kauf nicht mehr nachrechenbar (Grundsatz 1).
 *
 * Das Ergebnis landet bevorzugt auf dem BRETT, wenn eine der drei dort stand:
 * Wer eine Einheit aufgestellt hat, will sie nach dem Verschmelzen nicht auf
 * der Bank wiederfinden und von Hand zurueckstellen muessen.
 */
export function verschmelze(
  brett: readonly (Kaempfer | null)[],
  bank: readonly (Kaempfer | null)[],
): { brett: (Kaempfer | null)[]; bank: (Kaempfer | null)[]; verschmolzen: number } {
  const neuesBrett = [...brett];
  const neueBank = [...bank];
  let verschmolzen = 0;

  const holen = (o: Fundstelle) =>
    o.bereich === 'brett' ? neuesBrett[o.platz] : neueBank[o.platz];
  const setzen = (o: Fundstelle, wert: Kaempfer | null) => {
    if (o.bereich === 'brett') neuesBrett[o.platz] = wert;
    else neueBank[o.platz] = wert;
  };

  // Jede Verschmelzung nimmt zwei Einheiten vom Tisch, die Schleife endet
  // also immer. Der Zaehler daneben ist nur die Notbremse gegen einen
  // kuenftigen Denkfehler.
  for (let runde = 0; runde < 100; runde++) {
    const gruppen = new Map<string, Fundstelle[]>();
    const reihenfolge: string[] = [];
    const sammeln = (bereich: Bereich, liste: readonly (Kaempfer | null)[]) => {
      liste.forEach((k, platz) => {
        if (!k || k.stufe >= MAX_STUFE) return;
        const schluessel = `${k.id}:${k.stufe}`;
        const vorhanden = gruppen.get(schluessel);
        if (vorhanden) vorhanden.push({ bereich, platz });
        else {
          gruppen.set(schluessel, [{ bereich, platz }]);
          reihenfolge.push(schluessel);
        }
      });
    };
    sammeln('brett', neuesBrett);
    sammeln('bank', neueBank);

    const treffer = reihenfolge.find(
      (s) => (gruppen.get(s)?.length ?? 0) >= VERSCHMELZ_ZAHL,
    );
    if (!treffer) break;

    const stellen = gruppen.get(treffer)!.slice(0, VERSCHMELZ_ZAHL);
    const alt = holen(stellen[0]!)!;
    const ziel = stellen.find((s) => s.bereich === 'brett') ?? stellen[0]!;
    for (const stelle of stellen) setzen(stelle, null);
    setzen(ziel, { id: alt.id, stufe: (alt.stufe + 1) as Stufe });
    verschmolzen++;
  }

  return { brett: neuesBrett, bank: neueBank, verschmolzen };
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

function neuesHeer(regeln: TafelrundeRegeln): Heer {
  return {
    leben: regeln.startLeben,
    gold: regeln.startGold,
    level: START_LEVEL,
    laden: new Array(regeln.ladenPlaetze).fill(null),
    bank: new Array(regeln.bankPlaetze).fill(null),
    brett: new Array(BRETT_FELDER).fill(null),
    serie: KEINE_SERIE,
    bereit: false,
    wuerfe: 0,
    ausRunde: null,
    verlassen: false,
  };
}

export function erstellePartie(
  regeln: TafelrundeRegeln,
  sitze: readonly number[],
  saat: Saat,
): TafelrundePartie {
  const heere: Record<number, Heer> = {};
  for (const sitz of sitze) heere[sitz] = neuesHeer(regeln);

  const roh: TafelrundePartie = {
    regeln,
    saat: String(saat),
    runde: 1,
    phase: 'vorbereitung',
    vorrat: vollerVorrat(),
    heere,
    kaempfe: [],
    fertig: false,
  };

  /*
   * Der erste Laden wird HIER gezogen und nicht beim ersten Blick in die
   * Sicht. Ein Laden, der beim Ansehen entsteht, waere kein Zustand, sondern
   * eine Nebenwirkung — und zwei Zuschauer bekaemen zwei verschiedene.
   */
  return fuelleAlleLaeden(roh, sitze);
}

function fuelleAlleLaeden(
  partie: TafelrundePartie,
  sitze: readonly number[],
): TafelrundePartie {
  let stand = partie;
  for (const sitz of sitze) {
    const { heer, vorrat } = fuelleLaden(stand, sitz);
    stand = { ...stand, vorrat, heere: { ...stand.heere, [sitz]: heer } };
  }
  return stand;
}

// ---------------------------------------------------------------------------
// Auskunft
// ---------------------------------------------------------------------------

export function sitzeVon(partie: TafelrundePartie): number[] {
  return Object.keys(partie.heere)
    .map(Number)
    .sort((a, b) => a - b);
}

export function heerVon(partie: TafelrundePartie, sitz: number): Heer {
  const heer = partie.heere[sitz];
  if (!heer) throw new Error(`Sitz ${sitz} sitzt an diesem Tisch nicht`);
  return heer;
}

export function lebt(heer: Heer): boolean {
  return heer.ausRunde === null;
}

/** Sitze, die noch im Rennen sind. */
export function lebendeSitze(partie: TafelrundePartie): number[] {
  return sitzeVon(partie).filter((s) => lebt(heerVon(partie, s)));
}

/** Wie viele Einheiten dieser Sitz auf dem Brett stehen hat. */
export function brettBelegung(heer: Heer): number {
  return heer.brett.filter((k) => k !== null).length;
}

/**
 * Darf dieser Sitz gerade handeln?
 *
 * Das ist die eigentliche Zugregel — nicht `amZug`. Alle ruesten gleichzeitig,
 * also darf jeder handeln, der lebt und noch nicht bereit gemeldet hat.
 */
export function darfHandeln(partie: TafelrundePartie, sitz: number): boolean {
  if (partie.fertig || partie.phase !== 'vorbereitung') return false;
  const heer = partie.heere[sitz];
  return heer !== undefined && lebt(heer) && !heer.bereit;
}

/**
 * Ein Sitz fuer die Plattform, damit Zugzeit, Bot-Uebernahme und die
 * Verlassen-Regel greifen — dieselbe Kruecke wie bei Eiland.
 *
 * Der Server prueft `currentActor` beim Handeln NICHT; wer handeln darf, sagt
 * `darfHandeln`. Genannt wird der kleinste Sitz, der noch nicht bereit ist:
 * Waere es ein fester Sitz, liefe dessen Uhr auch dann, wenn er laengst
 * fertig ist, und die eines Truedlers nie.
 */
export function amZug(partie: TafelrundePartie): number | null {
  if (partie.fertig || partie.phase !== 'vorbereitung') return null;
  return sitzeVon(partie).find((s) => darfHandeln(partie, s)) ?? null;
}

// ---------------------------------------------------------------------------
// Gold
// ---------------------------------------------------------------------------

/**
 * Einkommen einer Runde: Grundeinkommen + Zins + Serienbonus (Konzept).
 *
 * Der Zins rechnet auf das Gold VOR der Auszahlung. Andersherum bekaeme man
 * Zins auf Geld, das man noch gar nicht hat, und die Grenze von 5 waere bei
 * 45 statt bei 50 erreicht.
 */
export function einkommen(heer: Heer, regeln: TafelrundeRegeln): number {
  return regeln.grundeinkommen + zins(heer.gold) + serienBonus(heer.serie.laenge);
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

function istOrt(wert: unknown, regeln: TafelrundeRegeln): wert is Ort {
  if (typeof wert !== 'object' || wert === null) return false;
  const o = wert as Record<string, unknown>;
  if (o['bereich'] !== 'bank' && o['bereich'] !== 'brett') return false;
  const platz = o['platz'];
  if (typeof platz !== 'number' || !Number.isInteger(platz) || platz < 0) return false;
  return o['bereich'] === 'brett' ? istBrettplatz(platz) : platz < regeln.bankPlaetze;
}

function anOrt(heer: Heer, ort: Ort): Kaempfer | null {
  return ort.bereich === 'brett' ? (heer.brett[ort.platz] ?? null) : (heer.bank[ort.platz] ?? null);
}

function mitOrt(heer: Heer, ort: Ort, wert: Kaempfer | null): Heer {
  if (ort.bereich === 'brett') {
    const brett = [...heer.brett];
    brett[ort.platz] = wert;
    return { ...heer, brett };
  }
  const bank = [...heer.bank];
  bank[ort.platz] = wert;
  return { ...heer, bank };
}

/**
 * Eine Bank, die durch das Verschmelzen kurzzeitig einen Platz zu viel hatte,
 * wieder auf ihre Groesse bringen.
 *
 * Liefert null, wenn das nicht geht — dann war der Kauf nicht erlaubt. Das ist
 * die Regel "bei voller Bank darf man nur kaufen, was sofort verschmilzt":
 * Ohne sie stuende man mit vollem Beutel vor der dritten Kopie und koennte sie
 * nicht holen, obwohl sie nirgends Platz braucht.
 */
function passeBankAn(
  bank: readonly (Kaempfer | null)[],
  plaetze: number,
): (Kaempfer | null)[] | null {
  if (bank.length <= plaetze) {
    return [...bank, ...new Array(plaetze - bank.length).fill(null)];
  }
  const rest = bank.slice(0, plaetze);
  for (const uebrig of bank.slice(plaetze)) {
    if (uebrig === null) continue;
    const frei = rest.indexOf(null);
    if (frei < 0) return null;
    rest[frei] = uebrig;
  }
  return rest;
}

/**
 * Einen Kauf durchrechnen, ohne ihn auszufuehren.
 *
 * Dieselbe Rechnung braucht `erlaubteZuege` (darf ich?) und `fuehreAus`
 * (dann tu es). Zweimal geschrieben liefen sie irgendwann auseinander, und
 * der Client zeigte einen Knopf, den der Server abweist.
 */
function rechneKauf(heer: Heer, plaetze: number, id: EinheitId): Heer | null {
  const kosten = einheit(id).kosten;
  if (heer.gold < kosten) return null;

  const frei = heer.bank.indexOf(null);
  const bankRoh =
    frei >= 0
      ? heer.bank.map((k, i) => (i === frei ? { id, stufe: 1 as Stufe } : k))
      : [...heer.bank, { id, stufe: 1 as Stufe }];

  const { brett, bank } = verschmelze(heer.brett, bankRoh);
  const angepasst = passeBankAn(bank, plaetze);
  if (angepasst === null) return null;

  return { ...heer, gold: heer.gold - kosten, brett, bank: angepasst };
}

export function erlaubteZuege(
  partie: TafelrundePartie,
  sitz: number,
): TafelrundeAktion[] {
  if (!darfHandeln(partie, sitz)) return [];
  const heer = heerVon(partie, sitz);
  const zuege: TafelrundeAktion[] = [];

  heer.laden.forEach((id, platz) => {
    if (id === null) return;
    if (rechneKauf(heer, partie.regeln.bankPlaetze, id) !== null) {
      zuege.push({ typ: 'kaufen', platz });
    }
  });

  if (heer.gold >= partie.regeln.neuwuerfelnKosten) zuege.push({ typ: 'neuwuerfeln' });

  const aufstieg = aufstiegKosten(heer.level);
  if (aufstieg !== null && heer.gold >= aufstieg) zuege.push({ typ: 'levelAuf' });

  heer.brett.forEach((k, platz) => {
    if (k) zuege.push({ typ: 'verkaufen', ort: { bereich: 'brett', platz } });
  });
  heer.bank.forEach((k, platz) => {
    if (k) zuege.push({ typ: 'verkaufen', ort: { bereich: 'bank', platz } });
  });

  zuege.push({ typ: 'bereit' });

  /*
   * `verschieben` steht ABSICHTLICH nicht in dieser Liste. Ein Zug ist ein
   * Paar aus 19 Plaetzen — das waeren bis zu 342 Eintraege, und zwar in jeder
   * Sicht, die ueber die Leitung geht. Damit der Client trotzdem keine Regel
   * nachbaut, steht die einzige Einschraenkung als Zahl in der Sicht:
   * `feldplaetze` (siehe sicht.ts).
   */
  return zuege;
}

export function fuehreAus(
  partie: TafelrundePartie,
  sitz: number,
  aktion: TafelrundeAktion,
): TafelrundePartie {
  if (partie.fertig) throw new Error('Partie ist zu Ende');
  if (partie.phase !== 'vorbereitung') throw new Error('Gerade wird nicht geruestet');
  const heer = heerVon(partie, sitz);
  if (!lebt(heer)) throw new Error('Sitz ist ausgeschieden');
  if (heer.bereit) throw new Error('Sitz hat seine Vorbereitung beendet');

  const { regeln } = partie;

  switch (aktion.typ) {
    case 'kaufen': {
      const { platz } = aktion;
      if (!Number.isInteger(platz) || platz < 0 || platz >= heer.laden.length) {
        throw new Error('Diesen Ladenplatz gibt es nicht');
      }
      const id = heer.laden[platz];
      if (!id) throw new Error('Der Ladenplatz ist leer');
      const gekauft = rechneKauf(heer, regeln.bankPlaetze, id);
      if (!gekauft) throw new Error('Kein Gold oder kein Platz');
      /*
       * Die Karte bleibt aus dem Vorrat heraus — sie war es schon, seit sie
       * im Laden lag. Zurueck geht sie erst beim Verkaufen.
       */
      const laden = heer.laden.map((k, i) => (i === platz ? null : k));
      return setzeHeer(partie, sitz, { ...gekauft, laden });
    }

    case 'neuwuerfeln': {
      if (heer.gold < regeln.neuwuerfelnKosten) throw new Error('Zu wenig Gold');
      const bezahlt = setzeHeer(partie, sitz, {
        ...heer,
        gold: heer.gold - regeln.neuwuerfelnKosten,
      });
      const { heer: gefuellt, vorrat } = fuelleLaden(bezahlt, sitz);
      return { ...bezahlt, vorrat, heere: { ...bezahlt.heere, [sitz]: gefuellt } };
    }

    case 'levelAuf': {
      const kosten = aufstiegKosten(heer.level);
      if (kosten === null) throw new Error('Hoechster Level erreicht');
      if (heer.gold < kosten) throw new Error('Zu wenig Gold');
      return setzeHeer(partie, sitz, {
        ...heer,
        gold: heer.gold - kosten,
        level: Math.min(heer.level + 1, MAX_LEVEL),
      });
    }

    case 'verschieben': {
      const { von, nach } = aktion;
      if (!istOrt(von, regeln) || !istOrt(nach, regeln)) throw new Error('Platz gibt es nicht');
      if (von.bereich === nach.bereich && von.platz === nach.platz) {
        throw new Error('Der Zug bewegt nichts');
      }
      const bewegt = anOrt(heer, von);
      if (!bewegt) throw new Error('Da steht niemand');
      const ziel = anOrt(heer, nach);

      /*
       * Nur der Weg auf ein FREIES Brettfeld kann die Grenze reissen. Ein
       * Tausch aendert die Belegung nicht, und der Weg vom Brett auf die Bank
       * macht sie kleiner — beides bleibt erlaubt, auch wenn das Brett gerade
       * ueber der Grenze steht (das kann nach einem Levelverlust nicht
       * passieren, aber die Regel soll es auch dann nicht blockieren).
       */
      if (nach.bereich === 'brett' && von.bereich === 'bank' && ziel === null) {
        if (brettBelegung(heer) >= feldplaetze(heer.level)) {
          throw new Error('Kein Feldplatz frei');
        }
      }
      return setzeHeer(partie, sitz, mitOrt(mitOrt(heer, nach, bewegt), von, ziel));
    }

    case 'verkaufen': {
      const { ort } = aktion;
      if (!istOrt(ort, regeln)) throw new Error('Platz gibt es nicht');
      const verkauft = anOrt(heer, ort);
      if (!verkauft) throw new Error('Da steht niemand');
      /*
       * Der volle Preis zurueck, auch fuer verschmolzene Einheiten. Ein
       * Abschlag waere eine zweite Waehrung im Spiel und wuerde vor allem den
       * bestrafen, der sich verbaut hat — also genau den, der umbauen muss.
       */
      const gold = heer.gold + gesamtkosten(verkauft.id, verkauft.stufe);
      const zurueck = { ...partie.vorrat } as Record<EinheitId, number>;
      zurueck[verkauft.id] = (zurueck[verkauft.id] ?? 0) + kartenZahl(verkauft.stufe);
      const ohne = mitOrt({ ...heer, gold }, ort, null);
      return { ...setzeHeer(partie, sitz, ohne), vorrat: zurueck };
    }

    case 'bereit':
      return pruefePhase(setzeHeer(partie, sitz, { ...heer, bereit: true }));

    default:
      throw new Error('Unbekannte Aktion');
  }
}

function setzeHeer(partie: TafelrundePartie, sitz: number, heer: Heer): TafelrundePartie {
  return { ...partie, heere: { ...partie.heere, [sitz]: heer } };
}

/**
 * Sind alle bereit, beginnt der Kampf.
 *
 * Ein verlassener Sitz haelt niemanden auf: Die Plattform laesst ihn zwar von
 * einem Bot weiterspielen, aber wenn der ausfaellt, wartete der ganze Tisch
 * bis zum Verfall auf jemanden, der nicht mehr da ist.
 */
function pruefePhase(partie: TafelrundePartie): TafelrundePartie {
  if (partie.phase !== 'vorbereitung') return partie;
  const offen = lebendeSitze(partie).filter((s) => {
    const heer = heerVon(partie, s);
    return !heer.bereit && !heer.verlassen;
  });
  if (offen.length > 0) return partie;
  return beginneKampf(partie);
}

// ---------------------------------------------------------------------------
// Der Kampf
// ---------------------------------------------------------------------------

/** Wer gegen wen antritt — ohne den Kampf selbst. */
export interface Ansetzung {
  readonly a: number;
  readonly b: number;
  readonly geist: boolean;
}

/**
 * Die Paarungen einer Runde.
 *
 * Gemischt und dann der Reihe nach zu zweit — kein festes Reihum. Ein fester
 * Turnus waere vorhersagbar, und wer weiss, gegen wen er in der naechsten
 * Runde antritt, ruestet gezielt gegen dieses eine Brett. Genau das soll ein
 * Auto-Battler nicht sein: Man baut gegen das FELD, nicht gegen einen Gegner.
 *
 * Absichtlich NICHT ausgeschlossen ist, zweimal hintereinander auf denselben
 * Gegner zu treffen. Das kommt vor, und es auszuschliessen hiesse, sich die
 * vorige Runde zu merken — ein Zustand mehr im Snapshot fuer einen Nachteil,
 * den bei acht Sitzen kaum jemand bemerkt.
 *
 * Unter zwei lebenden Sitzen gibt es nichts anzusetzen: Dann ist die Partie
 * ohnehin vorbei (siehe `naechsteRunde`).
 */
export function setzeAn(
  sitze: readonly number[],
  saat: string,
  runde: number,
): Ansetzung[] {
  if (sitze.length < 2) return [];
  const zufall = baueZufall(paarungsSaat(saat, runde));

  // Von der sortierten Liste aus mischen, nicht von der uebergebenen: Sonst
  // haenge die Paarung daran, in welcher Reihenfolge der Aufrufer die Sitze
  // aufgezaehlt hat, und zwei Server kaemen zu verschiedenen Kaempfen.
  const misch = [...sitze].sort((x, y) => x - y);
  for (let i = misch.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    const merk = misch[i];
    misch[i] = misch[j];
    misch[j] = merk;
  }

  const an: Ansetzung[] = [];
  let i = 0;
  for (; i + 1 < misch.length; i += 2) {
    an.push({ a: misch[i], b: misch[i + 1], geist: false });
  }
  if (i < misch.length) {
    // Der Uebriggebliebene bekommt das Brett eines anderen als Geist, siehe
    // `Kampfpaarung.geist`.
    const allein = misch[i];
    const andere = misch.filter((s) => s !== allein);
    an.push({ a: allein, b: andere[Math.floor(zufall() * andere.length)], geist: true });
  }
  return an;
}

/**
 * Alle Kaempfe der Runde rechnen und in den Zustand legen.
 *
 * Auf einen Schlag und nicht nach und nach: Ein Kampf ist eine reine Funktion
 * ueber Brett und Saat, und wer ihn erst beim Zusehen rechnete, muesste den
 * Zufallsstrom durch den Snapshot schleppen. So steht nach dem Uebergang alles
 * fest, was diese Runde noch passieren wird — die Anzeige spielt nur noch ab.
 */
function beginneKampf(partie: TafelrundePartie): TafelrundePartie {
  const kaempfe = setzeAn(lebendeSitze(partie), partie.saat, partie.runde).map((satz) => ({
    ...satz,
    bericht: simuliereKampf(
      [heerVon(partie, satz.a).brett, heerVon(partie, satz.b).brett],
      kampfSaat(partie.saat, partie.runde, satz.a, satz.b),
    ),
  }));
  return { ...partie, phase: 'kampf', kaempfe };
}

/** Der Kampf, an dem dieser Sitz beteiligt ist — als Geistgeber gilt er nicht. */
export function kampfVon(
  partie: TafelrundePartie,
  sitz: number,
): Kampfpaarung | null {
  return (
    partie.kaempfe.find((k) => k.a === sitz || (k.b === sitz && !k.geist)) ?? null
  );
}

/**
 * Wie lange der laengste Kampf dieser Runde dauert.
 *
 * Danach richtet sich die Schaupause der Plattform (`interludeMs` in
 * adapter.ts). Der laengste und nicht der Durchschnitt: Alle Kaempfe laufen
 * gleichzeitig ab, und wer seinem noch zusieht, soll nicht mitten im Getuemmel
 * in den naechsten Laden geworfen werden.
 */
export function kampfdauer(partie: TafelrundePartie): number {
  return partie.kaempfe.reduce((laengste, k) => Math.max(laengste, k.bericht.dauerMs), 0);
}

/**
 * Aus den Kampfberichten die Ausgaenge machen, die `wendeKampfausgang` bucht.
 *
 * Ein UNENTSCHIEDEN erzeugt gar keinen Eintrag. Das ist eine Entscheidung: Der
 * Sitz nimmt keinen Schaden, und seine Serie bleibt stehen, statt als
 * Niederlage zu zaehlen. Ein Unentschieden als Niederlage zu buchen hiesse,
 * beiden Seiten Niederlagengold zu zahlen — in der ersten Runde, in der noch
 * niemand etwas aufgestellt hat, treten regelmaessig zwei leere Bretter
 * gegeneinander an.
 */
export function ausgaengeAus(kaempfe: readonly Kampfpaarung[]): Kampfausgang[] {
  const raus: Kampfausgang[] = [];
  for (const kampf of kaempfe) {
    const { sieger, schaden } = kampf.bericht;
    if (sieger === null) continue;
    raus.push({ sitz: kampf.a, sieg: sieger === 0, schaden: sieger === 0 ? 0 : schaden });
    // Ein Geist hat keinen Lebensbalken: Sein Besitzer kaempft anderswo seinen
    // eigenen Kampf und darf nicht zweimal in einer Runde Schaden nehmen.
    if (!kampf.geist) {
      raus.push({ sitz: kampf.b, sieg: sieger === 1, schaden: sieger === 1 ? 0 : schaden });
    }
  }
  return raus;
}

/**
 * Die Kampfphase abschliessen: buchen, was die Berichte hergeben.
 *
 * Das ist der Weg, den die Plattform nach der Schaupause geht. Gerechnet wird
 * hier nichts mehr — die Berichte stehen seit `beginneKampf` fest.
 */
export function loeseKampfAuf(partie: TafelrundePartie): TafelrundePartie {
  return wendeKampfausgang(partie, ausgaengeAus(partie.kaempfe));
}

// ---------------------------------------------------------------------------
// Rundenwechsel
// ---------------------------------------------------------------------------

/**
 * Was ein Kampf fuer EINEN Sitz ergeben hat.
 *
 * Die Simulation, die das ausrechnet, gehoert in Phase 2. Dieser Regelkern
 * nimmt das Ergebnis entgegen und bucht es — Leben, Serie, Ausscheiden. Die
 * Trennung ist Absicht: Wer beides in einer Funktion hat, kann die Buchung
 * nicht pruefen, ohne einen ganzen Kampf zu simulieren.
 */
export interface Kampfausgang {
  readonly sitz: number;
  readonly sieg: boolean;
  /** Lebenspunkte, die der Sitz verliert. Beim Sieger ueblicherweise 0. */
  readonly schaden: number;
}

/**
 * Den Kampf abrechnen und die naechste Runde beginnen.
 *
 * Sitze, zu denen kein Ausgang geliefert wird, gehen unveraendert durch — das
 * ist der Zustand, solange es keine Simulation gibt (siehe `ohneKampfWeiter`),
 * und es ist zugleich die richtige Antwort fuer einen Sitz, der in dieser
 * Runde gegen niemanden antreten musste.
 */
export function wendeKampfausgang(
  partie: TafelrundePartie,
  ausgaenge: readonly Kampfausgang[],
): TafelrundePartie {
  if (partie.phase !== 'kampf') throw new Error('Es wird gerade nicht gekaempft');

  const heere: Record<number, Heer> = { ...partie.heere };
  const vorrat = { ...partie.vorrat } as Record<EinheitId, number>;

  for (const ausgang of ausgaenge) {
    const heer = heere[ausgang.sitz];
    if (!heer || !lebt(heer)) continue;
    const art: Serienart = ausgang.sieg ? 'sieg' : 'niederlage';
    const leben = Math.max(0, heer.leben - Math.max(0, Math.trunc(ausgang.schaden)));
    const gebucht: Heer = {
      ...heer,
      leben,
      serie: {
        art,
        laenge: heer.serie.art === art ? heer.serie.laenge + 1 : 1,
      },
      // Ausgeschieden wird in DIESER Runde, nicht in der naechsten: Sonst
      // stuende in den Platzierungen eine Runde, die der Sitz nie erlebt hat.
      ausRunde: leben <= 0 ? partie.runde : null,
    };
    if (leben > 0) {
      heere[ausgang.sitz] = gebucht;
      continue;
    }
    /*
     * Ausgeschieden: Laden, Bank und Brett gehen VOLLSTAENDIG in den Vorrat
     * zurueck.
     *
     * Ohne das faellt bei acht Spielern alles aus dem Kreislauf, was die
     * sieben Ausgeschiedenen gesammelt haben — bis zu zwanzig Einheiten je
     * Sitz. Der Laden der Ueberlebenden wuerde dann ausgerechnet zum Ende
     * hin duenner, wenn das Verschmelzen die meisten Kopien braucht. Ein
     * Fehler, der erst in der zwanzigsten Runde auffaellt, und dann als
     * "das Spiel zeigt mir nichts mehr".
     */
    for (const karte of gebucht.laden) {
      if (karte) vorrat[karte] = (vorrat[karte] ?? 0) + 1;
    }
    for (const k of [...gebucht.bank, ...gebucht.brett]) {
      if (k) vorrat[k.id] = (vorrat[k.id] ?? 0) + kartenZahl(k.stufe);
    }
    heere[ausgang.sitz] = {
      ...gebucht,
      laden: gebucht.laden.map(() => null),
      bank: gebucht.bank.map(() => null),
      brett: gebucht.brett.map(() => null),
    };
  }

  return naechsteRunde({ ...partie, heere, vorrat });
}

/**
 * Die Kampfphase beenden, ohne irgendetwas zu buchen.
 *
 * Niemand nimmt Schaden, niemand gewinnt, die Serien bleiben stehen. Seit es
 * die Simulation gibt, ist das nicht mehr der Normalweg — der heisst
 * `loeseKampfAuf` —, sondern der Notausgang: Kaempfe, die gar nicht erst
 * angesetzt werden konnten, und alte Snapshots aus der Zeit vor der
 * Simulation, in denen `kaempfe` leer ist.
 *
 * Er bleibt stehen, weil ein Tisch sonst in der Kampfphase haengen bliebe —
 * und ein haengender Tisch ist der einzige Fehler, den ein Spieler nicht
 * selbst beheben kann.
 */
export function ohneKampfWeiter(partie: TafelrundePartie): TafelrundePartie {
  return wendeKampfausgang(partie, []);
}

/**
 * Naechste Runde: Einkommen auszahlen, Laeden neu fuellen, Bereitmeldungen
 * zuruecksetzen.
 *
 * Der Laden wird JEDE Runde neu gezogen, ohne dass es Gold kostet. Ohne das
 * saehe man in Runde 12 noch die Einheiten aus Runde 11 und muesste fuer
 * jeden Blick auf etwas Neues bezahlen.
 */
function naechsteRunde(partie: TafelrundePartie): TafelrundePartie {
  const uebrig = lebendeSitze(partie);

  // Erst das Ende pruefen, dann auszahlen: Ein Einkommen in einer Runde, die
  // es nicht mehr gibt, stuende hinterher unerklaerlich im Snapshot.
  if (uebrig.length <= 1 || partie.runde >= partie.regeln.rundenGrenze) {
    return { ...partie, phase: 'ende', kaempfe: [], fertig: true };
  }

  const heere: Record<number, Heer> = { ...partie.heere };
  for (const sitz of sitzeVon(partie)) {
    const heer = heere[sitz]!;
    if (!lebt(heer)) {
      heere[sitz] = { ...heer, bereit: true };
      continue;
    }
    heere[sitz] = { ...heer, gold: heer.gold + einkommen(heer, partie.regeln), bereit: false };
  }

  const naechste: TafelrundePartie = {
    ...partie,
    runde: partie.runde + 1,
    phase: 'vorbereitung',
    heere,
    // Die Protokolle der vorigen Runde sind abgespielt und abgerechnet. Sie
    // stehen zu lassen hiesse, jede Runde ein paar hundert Ereignisse mehr
    // durch die Datenbank und ueber die Leitung zu schleppen.
    kaempfe: [],
  };
  /*
   * Die Phasenpruefung am Ende: Sitzen am Tisch nur noch verlassene Sitze,
   * meldet niemand mehr "bereit" — ohne diese Zeile stuende die Partie bis zum
   * Verfall in der Vorbereitung, statt bis zur Rundengrenze durchzulaufen.
   */
  return pruefePhase(fuelleAlleLaeden(naechste, uebrig));
}

// ---------------------------------------------------------------------------
// Ende
// ---------------------------------------------------------------------------

export function markiereVerlassen(
  partie: TafelrundePartie,
  sitz: number,
): TafelrundePartie {
  const heer = partie.heere[sitz];
  if (!heer || heer.verlassen) return partie;
  // Die Phasenpruefung gleich mit: Wartete der Tisch nur noch auf diesen
  // Sitz, geht es jetzt weiter statt in die Zugzeit zu laufen.
  return pruefePhase(setzeHeer(partie, sitz, { ...heer, verlassen: true }));
}

/**
 * Platzierungen.
 *
 * Gezaehlt wird, wie viele Runden ein Sitz ueberstanden hat — bei einem
 * Ausscheidungsspiel ist das die einzige Zahl, die alle vergleichbar macht.
 * Wer noch lebt, zaehlt die laufende Runde mit.
 *
 * Bei Gleichstand entscheidet das verbliebene Leben. Erst wenn auch das gleich
 * ist, teilen sich zwei Sitze einen Platz — und dann ist es ein echtes
 * Unentschieden.
 */
export function platzierungen(
  partie: TafelrundePartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const reihe = sitzeVon(partie)
    .map((seat) => {
      const heer = heerVon(partie, seat);
      return {
        seat,
        points: heer.ausRunde ?? partie.runde,
        leben: heer.leben,
        left: heer.verlassen,
      };
    })
    .sort((a, b) => b.points - a.points || b.leben - a.leben);

  let platz = 0;
  let letzter: string | null = null;
  return reihe.map((eintrag, index) => {
    const schluessel = `${eintrag.points}:${eintrag.leben}`;
    if (letzter === null || schluessel !== letzter) {
      platz = index + 1;
      letzter = schluessel;
    }
    const { leben, ...rest } = eintrag;
    return { ...rest, place: platz };
  });
}

/** Sieger, oder null bei Gleichstand bzw. laufender Partie. */
export function sieger(partie: TafelrundePartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster) return null;
  if (zweiter && zweiter.place === erster.place) return null;
  return erster.seat;
}

/**
 * Kennung pruefen — fuer `deserialize`, wo alles von aussen kommt.
 *
 * Ein Snapshot ist JSON aus der Datenbank und kann aus einer aelteren Fassung
 * stammen. Eine Einheit, die es nicht mehr gibt, faellt hier auf und nicht
 * erst mitten in einem Kampf.
 */
export function istKaempfer(wert: unknown): wert is Kaempfer {
  if (typeof wert !== 'object' || wert === null) return false;
  const k = wert as Record<string, unknown>;
  const stufe = k['stufe'];
  if (stufe !== 1 && stufe !== 2 && stufe !== 3) return false;
  return istEinheitId(k['id']);
}
