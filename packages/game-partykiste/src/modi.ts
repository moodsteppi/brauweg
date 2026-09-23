/**
 * Partykiste — die Spielmodi Eskalation, Themenabend und Team-Abend.
 *
 * Robins Entscheidung vom 22.09.2026: neben dem klassischen Turnier genau
 * diese drei. Hier steht, was die Modi AUSMACHT — die Kurve, die
 * Themenliste, die Lager und ihre Wertung. `partie.ts` haengt sich an
 * wenigen Stellen ein (Rundenaufbau, Reihum-Folge, Aufstellung, Rangliste);
 * alles andere am Ablauf ist fuer jeden Modus derselbe. Das ist Absicht und
 * dieselbe Begruendung wie beim Trinkmodus: Ein zweiter Ablauf je Modus
 * waeren vier Regelwerke, von denen drei nie jemand testet.
 *
 * Wie ueberall im Paket: kein Zufall ausser dem Saatkorn. Die Kurve haengt
 * nur an Rundennummer und Rundenzahl, die Lager nur an der Sitznummer und
 * an dem, was der Tischoeffner getauscht hat.
 */

import { haerteVon, waehlbareInhalte, type InhaltsRueckfall } from './inhalte/filter.js';
import type { Haerte, Inhalt, Paket } from './inhalte/typen.js';
import {
  INHALTS_HAERTE_MAX,
  istSpielmodus,
  type MinispielId,
  type PartykisteRegeln,
  type Spielmodus,
} from './regeln.js';
import { baueZufall, gemischt, rundenSaat } from './zufall.js';

/** Der Modus eines Regelsatzes — auch eines alten, der das Feld nicht kennt. */
export function modusVon(regeln: Pick<PartykisteRegeln, 'modus'>): Spielmodus {
  const modus: unknown = regeln.modus;
  return istSpielmodus(modus) ? modus : 'turnier';
}

// ---------------------------------------------------------------------------
// Eskalation
// ---------------------------------------------------------------------------

/**
 * Die Stufe der Runde `nr` (0-basiert) in einem Abend aus `runden` Runden:
 * erstes Drittel 1, zweites 2, letztes 3.
 *
 * Gerechnet als `floor(nr * 3 / runden) + 1` und nicht mit gerundeten
 * Drittelgrenzen: So faellt bei jeder Rundenzahl von 3 bis 15 genau die
 * letzte Runde in Stufe 3, und bei drei Runden ist jede Runde eine Stufe.
 */
export function eskalationsStufe(nr: number, runden: number): Haerte {
  if (!Number.isFinite(nr) || !Number.isFinite(runden) || runden <= 0) return 1;
  const stufe = Math.floor((Math.max(0, nr) * 3) / runden) + 1;
  return stufe <= 1 ? 1 : stufe >= 3 ? 3 : 2;
}

/**
 * Was eine Runde der Eskalation zusaetzlich weiss. Steht nur am Regelsatz
 * EINER Runde (`regelnDerRunde`), nie in der Partie oder im Snapshot.
 */
export interface EskalationsKontext {
  /** Rundenzahl des Abends — die Kurve haengt daran. */
  readonly runden: number;
  /**
   * Die hoechste Stufe, die dieser Tisch ueberhaupt bekommt: 3, oder 2, wenn
   * ein Gast sitzt (`wirksameInhaltsHaerte`). Die Kurve steigt nie darueber.
   */
  readonly decke: Haerte;
}

/** Der Regelsatz, wie er fuer EINE Runde gilt. */
export type RundenRegeln = PartykisteRegeln & { readonly eskalation?: EskalationsKontext };

function kleinere(a: Haerte, b: Haerte): Haerte {
  return a < b ? a : b;
}

/**
 * Der Regelsatz der Runde `nr`. Fuer jeden Modus ausser der Eskalation ist
 * das der Regelsatz der Partie, unveraendert.
 *
 * In der Eskalation steigen Inhaltsstufe UND `schluckFaktor` mit der Kurve.
 * Die Inhaltsstufe ist dabei immer hoechstens `regeln.inhaltsHaerte` — dort
 * steht seit `erzeugePartie` die wirksame Obergrenze, und die ist bei einem
 * Gast am Tisch "pikant". **Die Gast-Kappung wird nicht umgangen, auch nicht
 * in der letzten Runde**; `schluckFaktor` kappt sie nicht, sie gilt den
 * Texten, nicht den Glaesern.
 *
 * Fehlt `runden` (ein Aufrufer, der die Rundenzahl nicht kennt), gilt Stufe
 * 1 — die sichere Seite, wie ueberall in diesem Paket.
 */
export function regelnDerRunde(regeln: PartykisteRegeln, nr: number, runden?: number): RundenRegeln {
  if (modusVon(regeln) !== 'eskalation') return regeln;
  const decke: Haerte =
    regeln.inhaltsHaerte === 1 || regeln.inhaltsHaerte === 2 || regeln.inhaltsHaerte === 3
      ? regeln.inhaltsHaerte
      : 1;
  if (runden === undefined || !Number.isFinite(runden) || runden <= 0) {
    return { ...regeln, inhaltsHaerte: 1, schluckFaktor: 1 };
  }
  const stufe = eskalationsStufe(nr, runden);
  return {
    ...regeln,
    inhaltsHaerte: kleinere(stufe, decke),
    schluckFaktor: stufe,
    eskalation: { runden, decke },
  };
}

/**
 * Verteilt einen gemischten Stapel auf die Plaetze eines ganzen Abends:
 * Platz `j` bekommt einen Inhalt, dessen Haerte hoechstens `grenzen[j]` ist
 * — und zwar den ersten noch UNBENUTZTEN genau dieser Stufe, sonst den
 * ersten der naechst milderen.
 *
 * Warum nicht einfach je Runde neu filtern: Dann haette jede Stufe ihren
 * eigenen gemischten Stapel, und derselbe harmlose Spruch koennte in Stufe 1
 * und in Stufe 2 oben liegen — genau der Wiederholungsfehler, den #205 fuer
 * "Wer bin ich" und W/P beseitigt hat. Hier gibt es EINEN Stapel und eine
 * Belegung ueber alle Plaetze, also kommt kein Inhalt zweimal, solange der
 * Stapel reicht.
 *
 * Warum "genau diese Stufe zuerst": Eskalation heisst, dass die Stufe
 * ausgeschoepft wird, nicht nur erlaubt. Naehme Stufe 2 den ersten Inhalt
 * bis 2, kaeme bei einem Katalog mit zehn pikanten unter hundert harmlosen
 * Eintraegen fast nie etwas Pikantes — die Kurve stuende nur im Regelsatz.
 *
 * Ist der Stapel aufgebraucht, faengt die Belegung von vorn an — so wie
 * `an()` am Ende des Stapels.
 */
export function belegeStufenweise<T extends Inhalt>(stapel: readonly T[], grenzen: readonly Haerte[]): T[] {
  if (stapel.length === 0) return [];
  let frei: T[] = [...stapel];
  const belegt: T[] = [];
  for (const grenze of grenzen) {
    let stelle = sucheStufe(frei, grenze);
    if (stelle < 0) {
      frei = [...stapel];
      stelle = sucheStufe(frei, grenze);
    }
    /*
     * Nichts bis zur Grenze im ganzen Stapel: kommt nicht vor, weil der
     * Stapel aus `waehlbareInhalte` stammt und jeder Katalog genug Harmloses
     * traegt (Test "jeder Katalog traegt die strengste Einstellung"). Dann
     * lieber irgendein Inhalt als eine Runde ohne.
     */
    if (stelle < 0) stelle = 0;
    belegt.push(frei.splice(stelle, 1)[0]!);
  }
  return belegt;
}

function sucheStufe<T extends Inhalt>(frei: readonly T[], grenze: Haerte): number {
  for (let stufe = grenze; stufe >= 1; stufe--) {
    const stelle = frei.findIndex((inhalt) => haerteVon(inhalt) === stufe);
    if (stelle >= 0) return stelle;
  }
  return -1;
}

/**
 * Der Stapel eines Katalogs in der Eskalation — oder null, wenn der
 * Regelsatz keine Eskalation traegt (dann nimmt `stapel()` in partie.ts den
 * gewohnten Weg).
 *
 * Geliefert wird nicht der gemischte Stapel selbst, sondern seine BELEGUNG:
 * Stelle `j` ist der Inhalt fuer Platz `j`. Die Plaetze zaehlt `partie.ts`
 * so, wie es sie ohnehin zaehlt — die n-te Runde einer Art nimmt Stelle n,
 * bei "Wer bin ich" und Wahrheit oder Pflicht Stelle `n * sitze + sitz`.
 * Deshalb braucht diese Funktion zu jedem Zweck, wie viele Plaetze eine
 * Runde hat (`platzeJeRunde`); ein Zweck, der zu keinem Minispiel passt,
 * bekommt null und damit den Stapel seiner Rundenstufe.
 *
 * Gefiltert wird auf die DECKE (nicht auf die Stufe der Runde), gemischt mit
 * derselben Saat wie im Turnier (`rundenSaat(saat, 0, zweck)`), und erst die
 * Belegung haelt jede Runde unter ihrer Stufe.
 */
export function stufenStapel<T extends Inhalt>(
  katalog: readonly T[],
  regeln: RundenRegeln,
  saat: string,
  sitze: number,
  zweck: string,
  mindestens: number,
  artDerRunde: (nr: number) => MinispielId,
): { readonly stapel: readonly T[]; readonly rueckfall: InhaltsRueckfall | null } | null {
  const eskalation = regeln.eskalation;
  if (!eskalation) return null;
  const art = zweckArt(zweck);
  if (art === null) return null;
  const jeRunde = platzeJeRunde(art, sitze);
  const grenzen: Haerte[] = [];
  for (let nr = 0; nr < eskalation.runden; nr++) {
    if (artDerRunde(nr) !== art) continue;
    const grenze = kleinere(eskalationsStufe(nr, eskalation.runden), eskalation.decke);
    for (let platz = 0; platz < jeRunde; platz++) grenzen.push(grenze);
  }
  if (grenzen.length === 0) return null;
  const auswahl = waehlbareInhalte(katalog, { inhaltsHaerte: eskalation.decke, paket: regeln.paket }, sitze, mindestens);
  const gemischterStapel = gemischt(auswahl.inhalte, baueZufall(rundenSaat(saat, 0, zweck)));
  return { stapel: belegeStufenweise(gemischterStapel, grenzen), rueckfall: auswahl.rueckfall };
}

/** Zu welchem Minispiel ein Zweck aus `baueRunde` gehoert. */
function zweckArt(zweck: string): MinispielId | null {
  switch (zweck) {
    case 'imposter':
    case 'quiz':
    case 'werbinich':
    case 'niemals':
    case 'wereher':
    case 'schaetzen':
    case 'entweder':
    case 'kategorien':
    case 'mehrheit':
    case 'regelkarte':
      return zweck;
    case 'wp-w':
    case 'wp-p':
      return 'wahrheitpflicht';
    /* Die drei mit Uhr (zeitdruck.ts): Die Bombe zieht Kategorien aus einem
       eigenen Stapel, der Koenigsbecher Regel-Karten fuer seine Buben. */
    case 'bombe':
    case 'zehnsekunden':
      return zweck;
    case 'koenigsbecher-regel':
      return 'koenigsbecher';
    default:
      return null;
  }
}

/**
 * Wie viele Inhalte eine Runde dieser Art zieht — Spiegel der Stellen in
 * `baueRunde` bzw. `zieheAufgabe`. Wer dort die Zaehlung aendert, aendert
 * sie hier mit; der Test "Eskalation: keine Kennung zweimal" faellt sonst.
 */
function platzeJeRunde(art: MinispielId, sitze: number): number {
  /* Koenigsbecher: vier Regel-Karten je Runde, eine je Bube (baueRunde). */
  if (art === 'koenigsbecher') return 4;
  return art === 'werbinich' || art === 'wahrheitpflicht' ? sitze : 1;
}

// ---------------------------------------------------------------------------
// Themenabend
// ---------------------------------------------------------------------------

/**
 * Welche Minispiele zu welchem Paket passen, in der Reihenfolge des Abends.
 *
 * Ein Paket ist eine Zielgruppe (typen.ts), und die Liste folgt daraus:
 * Beim Arbeitsabend fehlen "Ich hab noch nie" und Wahrheit oder Pflicht —
 * Gestaendnisse vor Kollegen sind kein Spiel, sondern ein Montag. Am
 * Weihnachtsabend sitzt die Familie, also Wissen und Raten statt Bus fahren.
 * JGA, WG und Studenten bekommen die Trinkrunden und die Regel-Karte
 * (#213), Familie und Kollegen das Kategorien-Battle; Mehrheitsraten passt
 * fast ueberall.
 *
 * Ein neues Paket braucht hier einen Eintrag (der Typ erzwingt es), ein neues
 * Minispiel nicht: Es spielt in keinem Themenabend mit, bis jemand es
 * einordnet.
 */
export const THEMEN_MINISPIELE: Readonly<Record<Paket, readonly MinispielId[]>> = {
  /*
   * Die drei mit Uhr (23.09.2026) eingeordnet: Die Bombe und „10 Sekunden"
   * gehen ueberall (sie fragen nichts ab, was man vor Kollegen oder Oma nicht
   * sagen koennte), der Koenigsbecher ist eine Trinkrunde und gehoert zu
   * WG, JGA und Studenten. Mitten in die Liste und nicht ans Ende — bei sechs
   * Runden kaeme sonst keines davon je dran.
   */
  'wg-abend': ['niemals', 'wereher', 'imposter', 'bombe', 'regelkarte', 'entweder', 'koenigsbecher', 'busfahrer', 'mehrheit', 'zehnsekunden', 'wahrheitpflicht', 'schaetzen'],
  jga: ['wahrheitpflicht', 'niemals', 'bombe', 'regelkarte', 'wereher', 'koenigsbecher', 'imposter', 'werbinich', 'zehnsekunden', 'mehrheit', 'entweder', 'busfahrer'],
  weihnachten: ['quiz', 'werbinich', 'kategorien', 'zehnsekunden', 'schaetzen', 'imposter', 'bombe', 'mehrheit', 'entweder', 'wereher'],
  studenten: ['busfahrer', 'niemals', 'koenigsbecher', 'quiz', 'regelkarte', 'bombe', 'wereher', 'kategorien', 'imposter', 'zehnsekunden', 'entweder', 'wahrheitpflicht'],
  arbeit: ['quiz', 'kategorien', 'zehnsekunden', 'schaetzen', 'imposter', 'bombe', 'mehrheit', 'entweder', 'werbinich', 'wereher'],
};

/**
 * Die Minispiele eines Themenabends: die Liste des Pakets, geschnitten mit
 * dem, was der Tisch ueberhaupt spielen will.
 *
 * Das Paket bestimmt Auswahl UND Reihenfolge; hat der Oeffner einzelne
 * Minispiele abgewaehlt, bleiben sie draussen. Bleibt nichts uebrig, gilt die
 * Paketliste — ein Themenabend ohne Minispiel ist kein Abend.
 */
export function themenMinispiele(paket: Paket, gewaehlt: readonly MinispielId[]): MinispielId[] {
  const liste = THEMEN_MINISPIELE[paket];
  const schnitt = liste.filter((art) => gewaehlt.includes(art));
  return schnitt.length > 0 ? schnitt : [...liste];
}

// ---------------------------------------------------------------------------
// Team-Abend
// ---------------------------------------------------------------------------

/**
 * Wer die Lager aufstellt: Sitz 0, der Tischoeffner — dieselbe Regel wie im
 * Wartesaal, wo auch nur Sitz 0 den Startknopf sieht.
 */
export const TISCHOEFFNER = 0;

/** Die beiden Lager. Mehr als zwei gibt es nicht — zu zwoelft waeren drei Lager zu viert Gruppenarbeit. */
export const LAGER = [0, 1] as const;

/**
 * Die Lager zu Beginn: abwechselnd nach Sitz. Sitznachbarn landen damit in
 * verschiedenen Lagern — am echten Tisch sitzen Paare und Freunde meist
 * nebeneinander, und genau die sollen sich nicht gegenseitig die Punkte
 * zuschieben.
 */
export function startLager(sitze: number): number[] {
  return Array.from({ length: Math.max(0, sitze) }, (_, sitz) => sitz % 2);
}

function mitglieder(lager: readonly number[], welches: number): number[] {
  const liste: number[] = [];
  lager.forEach((l, sitz) => {
    if (l === welches) liste.push(sitz);
  });
  return liste;
}

/**
 * Die Reihenfolge der Reihum-Spiele im Team-Abend: die Lager im Wechsel —
 * einer aus A, einer aus B, und so weiter; wer uebrig bleibt, faehrt am
 * Ende. Welches Lager anfaengt, wechselt von Runde zu Runde.
 *
 * Ohne das fuehre nach einem Tausch des Oeffners womoeglich ein Lager drei
 * Mal hintereinander, und beim Bus fahren saehe das andere nur zu.
 * `undefined` ohne Lager: dann gilt die Sitzreihenfolge wie immer.
 */
export function reihumFolge(lager: readonly number[] | null | undefined, nr: number): number[] | undefined {
  if (!lager) return undefined;
  const erstes = nr % 2 === 0 ? 0 : 1;
  const a = mitglieder(lager, erstes);
  const b = mitglieder(lager, 1 - erstes);
  const folge: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) folge.push(a[i]!);
    if (i < b.length) folge.push(b[i]!);
  }
  return folge;
}

/**
 * Welche Sitze der Oeffner gerade ins andere Lager setzen darf: jeder, nur
 * nicht der letzte Anwesende eines Lagers. Ein Lager ohne einen einzigen
 * Anwesenden spielt nicht mit, sondern nur noch Punkte ab.
 */
export function wechselbareSitze(lager: readonly number[], ausgestiegen: readonly number[]): number[] {
  const raus = new Set(ausgestiegen);
  const anwesend = (welches: number) => mitglieder(lager, welches).filter((s) => !raus.has(s)).length;
  const liste: number[] = [];
  lager.forEach((l, sitz) => {
    if (raus.has(sitz) || anwesend(l) > 1) liste.push(sitz);
  });
  return liste;
}

/** Eine Zeile der Lager-Tabelle. */
export interface LagerPlatzierung {
  /** 0 oder 1. */
  readonly lager: number;
  /** Die Sitze des Lagers, aufsteigend — auch die Ausgestiegenen. */
  readonly sitze: readonly number[];
  /** Summe der Turnierpunkte aller Mitglieder. */
  readonly punkte: number;
  /** Summe der Schluecke aller Mitglieder — steht daneben, wertet nicht. */
  readonly schlucke: number;
  /** 1 oder 2; Gleichstand: beide 1. */
  readonly platz: number;
}

/**
 * Die Tabelle der Lager.
 *
 * Verglichen wird der SCHNITT je Kopf, gerechnet ueber Kreuz (`a.punkte *
 * b.koepfe` gegen `b.punkte * a.koepfe`, keine Division, kein Rundungsfehler).
 * Bei gleich grossen Lagern ist das genau die Summe. Bei ungleich grossen —
 * sieben Leute, oder der Oeffner hat getauscht — gewaenne sonst das groessere
 * Lager, nur weil es mehr Leute hat: In fast jedem Minispiel bekommt jeder
 * Sitz fuer sich Punkte. Ausgestiegene zaehlen weiter mit, mit dem, was sie
 * bis dahin geholt haben.
 */
export function lagerWertung(
  lager: readonly number[],
  punkte: readonly number[],
  schlucke: readonly number[],
): LagerPlatzierung[] {
  const zeilen = LAGER.map((welches) => {
    const sitze = mitglieder(lager, welches);
    return {
      lager: welches as number,
      sitze,
      punkte: sitze.reduce((summe, s) => summe + (punkte[s] ?? 0), 0),
      schlucke: sitze.reduce((summe, s) => summe + (schlucke[s] ?? 0), 0),
    };
  });
  const [a, b] = zeilen as [(typeof zeilen)[number], (typeof zeilen)[number]];
  /* Ueber Kreuz: a.punkte / a.koepfe gegen b.punkte / b.koepfe. Ein leeres
     Lager (kann die Aufstellung nicht erzeugen) steht mit null Punkten da. */
  const links = a.punkte * Math.max(1, b.sitze.length) * (a.sitze.length > 0 ? 1 : 0);
  const rechts = b.punkte * Math.max(1, a.sitze.length) * (b.sitze.length > 0 ? 1 : 0);
  const platzA = links >= rechts ? 1 : 2;
  const platzB = rechts >= links ? 1 : 2;
  return [
    { ...a, platz: platzA },
    { ...b, platz: platzB },
  ];
}

/**
 * Der Platz je SITZ im Team-Abend, fuer `standings` und damit fuer die
 * Trophaeen — oder null ohne Lager.
 *
 * WARUM JE PERSON UND NICHT JE LAGER: Die Plattform verteilt Trophaeen an
 * Konten, nicht an Lager (`awardForParty` bekommt eine Zeile je Sitz), und
 * ein Lager ist kein Konto — es entsteht an diesem Abend und ist danach weg.
 * Also bleibt die Rangliste eine je Person. Der PLATZ aber kommt aus dem
 * Lager-Ergebnis: Gespielt hat man fuers Lager, also gewinnt oder verliert man
 * mit ihm. Wer im Siegerlager die wenigsten eigenen Punkte hat, steht trotzdem
 * vorn — sonst waere der Team-Abend fuer die Trophaeen doch wieder ein
 * Turnier jeder gegen jeden, und wer seinem Lager hilft (die Stimme bei "Wer
 * wuerde eher" auf den Gegner), schadete sich selbst.
 *
 * Die Plaetze folgen der Zaehlweise der Plattform (Gleichstand teilt, der
 * Naechste ueberspringt): Das Siegerlager steht auf 1, das andere auf
 * "Groesse des Siegerlagers + 1". Nur so teilt `awardForParty` die Werte
 * richtig — mit "2" fuer drei Verlierer hinter drei Siegern bekaemen die
 * Verlierer die Plaetze 2 bis 4 statt 4 bis 6, und die Nullsumme waere hin.
 * Gleichstand der Lager: alle auf 1.
 */
export function lagerPlaetze(lager: readonly number[] | null | undefined, punkte: readonly number[]): number[] | null {
  if (!lager) return null;
  const wertung = lagerWertung(lager, punkte, []);
  const sieger = wertung.filter((zeile) => zeile.platz === 1);
  const vorne = sieger.length === wertung.length ? 0 : sieger.reduce((n, zeile) => n + zeile.sitze.length, 0);
  return lager.map((welches) => (wertung[welches]?.platz === 1 ? 1 : vorne + 1));
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

/**
 * Die Inhaltsstufe, die ein Modus sich wuenscht, bevor die Gast-Kappung
 * greift. Die Eskalation will am Ende "derb" — ob sie es bekommt, entscheidet
 * `wirksameInhaltsHaerte` wie fuer jeden anderen Tisch.
 */
export function gewollteInhaltsHaerte(modus: Spielmodus, eingestellt: Haerte): Haerte {
  return modus === 'eskalation' ? INHALTS_HAERTE_MAX : eingestellt;
}
