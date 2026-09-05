/**
 * Die Kampfsimulation — zwei Bretthaelften treten an, heraus kommt ein Bericht.
 *
 * Hier wird nichts zugesehen und nichts angezeigt: Der ganze Kampf wird in
 * einem Rutsch durchgerechnet, und die Oberflaeche spielt hinterher das
 * Ablaufprotokoll ab. Ein Kampf, den man nachrechnen kann, ist auch ein
 * Kampf, den man aufzeichnen, wiederholen und in einem Fehlerbericht
 * mitschicken kann.
 *
 * Reine Funktion: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser
 * dem uebergebenen Seed (game-api, Grundsatz 1). Die uebergebenen Bretter
 * werden nie veraendert — die Streiter sind Kopien, die nur innerhalb dieser
 * Datei leben.
 *
 * Die Synergie-Boni (synergien.ts) greifen an genau einer Stelle ein:
 * `baueStreiter` rechnet sie einmal je Seite aus und gibt sie an `werteFuer`
 * — danach stehen die Werte und werden nicht mehr angefasst.
 *
 * NOCH NICHT DABEI: Faehigkeiten und Mana. Ein eigener Auftrag; er greift in
 * die Zugschleife in `simuliereKampf` ein (dort kaeme das Wirken einer
 * Faehigkeit vor dem Angriff, mit Mana aus Treffern).
 *
 * ZUR ZEIT: Gerechnet wird in ganzen Millisekunden und in festen Takten von
 * `TAKT_MS`. Keine Gleitkommazeit, kein `Date.now()`. Sekundenbruchteile als
 * Kommazahl aufzusummieren waere der sicherste Weg, zwei Laeufe derselben
 * Saat nach ein paar hundert Angriffen auseinanderlaufen zu lassen — und
 * genau das darf hier nicht passieren.
 */

import { type EinheitId, type Grundwerte, type Stufe, werteFuer } from './katalog.js';
import { bonusFuerEinheit, zaehleMarken } from './synergien.js';
import {
  type Seite,
  SEITEN,
  arenaAbstand,
  arenaNachbarn,
  gegenseite,
  nachArena,
} from './arena.js';
import { type Saat, baueZufall } from './zufall.js';

// ---------------------------------------------------------------------------
// Die Stellschrauben
// ---------------------------------------------------------------------------

/**
 * Die Taktlaenge der Simulation.
 *
 * Hundert Millisekunden sind fein genug, dass ein Zuschauer keine Stufen
 * sieht (die Anzeige blendet zwischen zwei Ereignissen ohnehin weich um), und
 * grob genug, dass ein voller Kampf in ein paar hundert Durchlaeufen erledigt
 * ist. Alle Wartezeiten sind Vielfache davon, damit kein Ereignis zwischen
 * zwei Takte faellt und dort auf den naechsten warten muss.
 */
export const TAKT_MS = 100;

/** Wie lange eine Einheit fuer ein Feld braucht. Zwei Felder je Sekunde. */
export const SCHRITT_MS = 500;

/**
 * Nach dieser Zeit ist Schluss, auch wenn beide Seiten noch stehen.
 *
 * Ohne diese Grenze kann die Schleife ewig laufen: Eine Nahkampfeinheit, die
 * von den eigenen Leuten eingekeilt ist, kommt an ihr Ziel womoeglich nie
 * heran (siehe `schrittZiel`), und zwei Bretter aus lauter Schildknappen
 * halten einander sehr lange aus.
 *
 * WARUM AUSGERECHNET 45 SEKUNDEN: Eine Abbruchgrenze taugt nur etwas, wenn sie
 * die Ausnahme bleibt — sonst entscheidet nicht mehr der Kampf, sondern
 * `entscheideNachZeit`. Die Zahl ist am heutigen Katalog gemessen und nicht
 * geraten. Ueber 800 zufaellig besetzte Bretterpaare je Groesse (2 bis 4, 6
 * und 9 Einheiten, Werte aus dem heutigen Katalog) und OHNE Deckel gerechnet:
 * Median 17 s, Mittel 20 s, das neunte Zehntel bei 35 s, das 95. bei 40 s, das
 * 99. bei 50 s, der laengste 78 s. Bei 45 s werden also rund 2 bis 4 Prozent
 * abgeschnitten; bei 30 s waere es jeder sechste gewesen und bei 20 s zwei von
 * fuenf.
 *
 * DIESE MESSUNG GILT NUR FUER ZUFAELLIG BESETZTE BRETTER, und das ist ihr
 * Fehler (gefunden am 05.09.2026 beim Zerlegen der Spielzeit). Ein Bot kauft
 * nicht zufaellig: Er nimmt das Beste, verschmilzt auf Stufe 2 und 3 und
 * sammelt Marken, deren Boni Leben und Ruestung dazulegen. Auf Brettern aus
 * ECHTEN Partien dauert derselbe Kampf doppelt so lange — Median 35 s statt
 * 17 s —, und abgeschnitten werden nicht 2 bis 4 Prozent, sondern 29
 * (500 Partien zu viert, werkzeug/spielzeit.mjs). Die Grenze ist damit kein
 * Rettungsseil mehr, sondern entscheidet jeden dritten Kampf ueber
 * `entscheideNachZeit`.
 *
 * DIE ZAHL 45_000 BLEIBT TROTZDEM STEHEN, weil sie das falsche Ende ist: Wer
 * sie senkt, laesst noch mehr Kaempfe von der Uhr entscheiden. Kuerzer werden
 * die Kaempfe ueber den Ablauf selbst (`Kampfregler.zeitraffer`) oder ueber den
 * Katalog — mit Zeitraffer x1,5 faellt der Anteil auf 8 %, mit x2 auf 1 %. Die
 * Auswertung dazu steht in docs/TAFELRUNDE-SPIELZEIT.md.
 *
 * Zwei Proben halten das fest: die in test/kampf.test.ts auf zufaelligen
 * Brettern (sie sagt etwas ueber den Katalog) und die in test/spielzeit.test.ts
 * auf Brettern aus echten Partien (sie sagt etwas ueber das Spiel). Wer nur
 * die erste liest, glaubt weiter an die 2 bis 4 Prozent.
 *
 * WER GEWINNT DANN: siehe `entscheideNachZeit`.
 */
export const HOECHSTDAUER_MS = 45_000;

/**
 * Grundschaden am Verlierer, unabhaengig davon, was noch steht.
 *
 * Ohne ihn koennte ein Spieler, der jede Runde knapp verliert, ewig
 * weiterspielen, sobald der Gegner mit einer einzigen Einheit gewinnt. Der
 * Grundschaden sorgt dafuer, dass eine Niederlage immer kostet.
 */
export const SCHADEN_GRUNDWERT = 1;

/**
 * Durch so viel wird die Stufensumme der ueberlebenden Gegner geteilt.
 *
 * Der Teiler kam am 05.09.2026 mit den 20 Startleben (vorher 100, siehe
 * regeln.ts). Ohne ihn kostet eine Niederlage im spaeten Spiel acht bis zehn
 * Punkte, und eine Partie zu viert war nach acht Runden vorbei — gemessen ueber
 * 300 Partien, nicht geschaetzt. Die Reihe, jeweils Median der Runden zu viert:
 * ohne Teiler 8, mit Teiler 2 dann 13, mit Teiler 3 dann 15.
 *
 * DREI, WEIL DIE ZIELSPANNE 14 BIS 20 RUNDEN IST. Nach unten begrenzt sie das
 * Spiel selbst: Vor Runde 10 steht kein ausgebautes Brett, wer da ausscheidet,
 * hat nicht verloren, sondern nicht gespielt. Nach oben begrenzt sie das Handy
 * — eine Runde dauert Vorbereitung plus Kampf, also bis zu anderthalb Minuten.
 * Gemessen liegt der Median bei 15 Runden, die laengste von 5.000 Partien bei
 * 22.
 *
 * `ceil` und nicht `round`: Eine Niederlage gegen einen einzelnen Ueberlebenden
 * der Stufe 1 soll die vollen zwei Punkte kosten (Grundwert plus eins) und
 * nicht durch die Rundung zum halben Preis werden.
 */
export const SCHADEN_STUFEN_TEILER = 3;

// ---------------------------------------------------------------------------
// Die Stellschrauben als Buendel
// ---------------------------------------------------------------------------

/**
 * Dieselben vier Zahlen, aber einstellbar.
 *
 * WOZU: Um zu beantworten, welche Stellschraube eine Partie wie viel kuerzer
 * macht, muss man jede EINZELN drehen und dieselben 500 Partien noch einmal
 * rechnen (docs/TAFELRUNDE-SPIELZEIT.md). Mit vier `const` im Modul ginge das
 * nur, indem der Messstand den Kampf ein zweites Mal nachbaut — und dann misst
 * er seine eigene Kopie und nicht das Spiel.
 *
 * WAS ES NICHT IST: eine Regel des Tisches. Der Regler steht bewusst NICHT in
 * `TafelrundeRegeln` (regeln.ts), denn der Regelsatz kommt als JSON von aussen
 * — ein selbstgebauter Tisch koennte sich sonst einen Zeitraffer von 10
 * einstellen. Wer den Standard aendern will, aendert die Konstanten oben; der
 * Regler ist der Weg, das vorher zu messen.
 */
export interface Kampfregler {
  /** Taktlaenge der Simulation, siehe `TAKT_MS`. */
  readonly taktMs: number;
  /** Abbruchgrenze, siehe `HOECHSTDAUER_MS`. */
  readonly hoechstdauerMs: number;
  /** Teiler der Stufensumme beim Schaden, siehe `SCHADEN_STUFEN_TEILER`. */
  readonly schadenStufenTeiler: number;
  /**
   * Wie viel schneller alles ablaeuft: Angriffstempo UND Schrittweite.
   *
   * 1 ist der gebaute Ablauf, 1,5 macht denselben Kampf in zwei Dritteln der
   * Zeit. Ein Faktor und keine zwei Zahlen, weil beides zusammengehoert: Wer
   * nur schneller schlagen, aber gleich langsam laufen laesst, verschiebt das
   * Kraefteverhaeltnis zwischen Nah- und Fernkampf, statt den Kampf zu
   * raffen.
   *
   * ACHTUNG, DAS AENDERT DIE ANZEIGE MIT. Die Oberflaeche spielt das
   * Ablaufprotokoll in Echtzeit ab (`zeitMs`); ein Zeitraffer macht den Kampf
   * am Bildschirm tatsaechlich schneller und nicht nur die Rechnung kuerzer.
   */
  readonly zeitraffer: number;
}

/** Der gebaute Ablauf: die vier Konstanten dieser Datei. */
export const STANDARD_REGLER: Kampfregler = {
  taktMs: TAKT_MS,
  hoechstdauerMs: HOECHSTDAUER_MS,
  schadenStufenTeiler: SCHADEN_STUFEN_TEILER,
  zeitraffer: 1,
};

// ---------------------------------------------------------------------------
// Was hinein geht
// ---------------------------------------------------------------------------

/**
 * Eine aufgestellte Einheit.
 *
 * Deckungsgleich mit `Kaempfer` aus partie.ts und trotzdem hier noch einmal
 * genannt: Diese Datei darf partie.ts NICHT kennen, weil partie.ts sie kennt.
 * Ein Ringschluss zwischen den beiden waere der Preis fuer einen gesparten
 * Typ von drei Zeilen.
 */
export interface Aufgestellt {
  readonly id: EinheitId;
  readonly stufe: Stufe;
}

/**
 * Eine Bretthaelfte, wie sie im Heer steht: ein Platz je Feld, `null` = leer.
 * Die Platznummern sind BRETTPLAETZE (brett.ts), nicht Arenaplaetze.
 */
export type Brettseite = readonly (Aufgestellt | null)[];

// ---------------------------------------------------------------------------
// Was herauskommt
// ---------------------------------------------------------------------------

/** Warum der Kampf zu Ende ist. */
export type Endgrund =
  /** Eine Seite steht nicht mehr. Der Normalfall. */
  | 'ausgeloescht'
  /** `HOECHSTDAUER_MS` erreicht, beide Seiten stehen noch. */
  | 'zeit';

/**
 * Eine Einheit im Kampf, wie sie nach aussen sichtbar ist.
 *
 * `platz` ist ein ARENAPLATZ, kein Brettplatz — beide Seiten stehen im selben
 * Gitter, sonst gaebe es keinen Abstand zwischen ihnen. Wer daraus wieder
 * einen Brettplatz braucht, nimmt `vonArena` aus arena.ts.
 */
export interface Kaempferstand {
  /** Stabile Kennung innerhalb dieses Kampfes. Alle Ereignisse nennen sie. */
  readonly id: number;
  readonly seite: Seite;
  readonly einheitId: EinheitId;
  readonly stufe: Stufe;
  readonly platz: number;
  readonly leben: number;
  readonly hoechstesLeben: number;
}

/**
 * Ein Ereignis des Ablaufprotokolls.
 *
 * Das Protokoll ist der eigentliche Ertrag dieser Datei: Aus ihm spielt die
 * Anzeige den Kampf ab, ohne selbst eine Regel nachzubauen (CLAUDE.md, "Der
 * Client bildet keine Regel nach"). Jedes Ereignis traegt seinen Zeitpunkt in
 * Millisekunden seit Kampfbeginn, und die Liste ist nach `zeitMs` aufsteigend
 * sortiert — die Anzeige kann sie also einfach der Reihe nach abarbeiten.
 *
 * Ereignisse desselben Zeitpunkts stehen in Zugreihenfolge. Auch das ist Teil
 * der Zusicherung: Zwei Laeufe derselben Saat liefern dieselbe Liste, Eintrag
 * fuer Eintrag.
 */
export type Ereignis =
  /** Eine Einheit ist ein Feld weit gezogen. Beide Plaetze sind Arenaplaetze. */
  | {
      readonly art: 'bewegung';
      readonly zeitMs: number;
      readonly wer: number;
      readonly von: number;
      readonly nach: number;
    }
  /** Eine Einheit hat getroffen. `lebenDanach` spart der Anzeige das Mitrechnen. */
  | {
      readonly art: 'treffer';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly schaden: number;
      readonly lebenDanach: number;
    }
  /** Eine Einheit ist gefallen. Kommt immer unmittelbar nach dem toedlichen Treffer. */
  | { readonly art: 'tod'; readonly zeitMs: number; readonly wer: number }
  /** Der Kampf ist vorbei. Immer das letzte Ereignis, genau einmal. */
  | {
      readonly art: 'ende';
      readonly zeitMs: number;
      readonly sieger: Seite | null;
      readonly grund: Endgrund;
    };

export interface Kampfbericht {
  /**
   * Die Saat, mit der gerechnet wurde — damit ein Bericht allein nachspielbar
   * ist. Immer als Zeichenkette, auch wenn eine Zahl hereinkam: Sonst haette
   * derselbe Kampf je nach Aufrufer zwei verschiedene Berichte.
   */
  readonly saat: string;
  /** Wer innerhalb eines Taktes zuerst handelt. Kommt aus der Saat, siehe `simuliereKampf`. */
  readonly erstZieher: Seite;
  /** Alle Einheiten mit vollem Leben auf ihrem Startplatz. Der Aufbau der Buehne. */
  readonly start: readonly Kaempferstand[];
  /** Das Ablaufprotokoll, aufsteigend nach Zeit. Endet mit genau einem `ende`. */
  readonly ereignisse: readonly Ereignis[];
  /** `null` heisst unentschieden — dann nimmt niemand Schaden. */
  readonly sieger: Seite | null;
  readonly grund: Endgrund;
  readonly dauerMs: number;
  /** Wer noch steht, mit Restleben und Endplatz. Leer, wenn sich beide ausgeloescht haben. */
  readonly ueberlebende: readonly Kaempferstand[];
  /** Schaden am Verlierer. Bei unentschieden 0. */
  readonly schaden: number;
}

// ---------------------------------------------------------------------------
// Der Zustand waehrend des Kampfes
// ---------------------------------------------------------------------------

/**
 * Ein Streiter waehrend der Simulation — veraenderlich, aber nur hier drin.
 *
 * Das ist die eine Stelle im Paket, an der ein Feld ueberschrieben wird statt
 * ein neues Objekt zu entstehen. Der Grund ist Rechenzeit: Ein Kampf macht
 * bis zu vierhundert Takte mal achtzehn Einheiten, und dabei jedes Mal die
 * ganze Aufstellung neu zu bauen waere Verschwendung. Nach aussen dringt
 * davon nichts — es gehen ausschliesslich frisch gebaute `Kaempferstand`
 * hinaus, und die Eingabe wird nicht angefasst.
 */
interface Streiter {
  readonly id: number;
  readonly seite: Seite;
  readonly einheitId: EinheitId;
  readonly stufe: Stufe;
  readonly werte: Grundwerte;
  readonly hoechstesLeben: number;
  /** Rang in der Zugreihenfolge. Entscheidet auch den Gleichstand bei der Zielwahl. */
  rang: number;
  platz: number;
  leben: number;
  /** Ab wann diese Einheit wieder angreifen bzw. ziehen darf, in Millisekunden. */
  angriffFreiAb: number;
  schrittFreiAb: number;
}

/**
 * Wartezeit zwischen zwei Angriffen, in ganzen Takten.
 *
 * `tempo` ist die Zahl der Angriffe je Sekunde und eine Kommazahl (0,6 bis
 * 1,05). Sie wird hier EINMAL in eine ganze Zahl von Millisekunden verwandelt
 * und danach nur noch addiert; so kann sich kein Gleitkommarest ueber
 * hunderte Angriffe aufsummieren. Aufgerundet auf ganze Takte, damit ein
 * Angriff nicht zwischen zwei Takten faellig wird und dadurch effektiv
 * langsamer waere, als sein Tempo verspricht.
 *
 * Mindestens ein Takt: Ein Tempo ueber 10 gibt es heute nicht, aber eine
 * Wartezeit von 0 waere eine Endlosschleife im Takt.
 */
export function angriffstakt(tempo: number, regler: Kampfregler = STANDARD_REGLER): number {
  const roh = Math.round(1000 / (tempo * regler.zeitraffer));
  return Math.max(regler.taktMs, Math.ceil(roh / regler.taktMs) * regler.taktMs);
}

/**
 * Wie lange ein Feld weit ziehen dauert, in ganzen Takten.
 *
 * Dieselbe Aufrundung wie beim Angriff und aus demselben Grund: Ein Schritt,
 * der zwischen zwei Takten faellig wird, wartet sonst auf den naechsten und
 * dauert damit effektiv laenger, als `SCHRITT_MS` sagt.
 */
export function schrittdauer(regler: Kampfregler = STANDARD_REGLER): number {
  const roh = Math.round(SCHRITT_MS / regler.zeitraffer);
  return Math.max(regler.taktMs, Math.ceil(roh / regler.taktMs) * regler.taktMs);
}

/**
 * Was ein Angriff nach Ruestung uebrig laesst.
 *
 * Ruestung ist ein Abzug in Prozentpunkten (10 bis 50), nicht ein fester
 * Betrag: Ein fester Abzug macht schwache Angriffe wirkungslos und starke
 * kaum schwaecher, und die 50 des Wurzelriesen wuerden jede Einheit zu einem
 * Gold vollstaendig abprallen lassen.
 *
 * Mindestens 1: Damit ein Kampf immer irgendwann endet, auch wenn spaeter
 * einmal eine Synergie die Ruestung ueber 100 Punkte schiebt. Ohne diesen
 * Boden stuende dann eine unsterbliche Einheit auf dem Feld.
 */
export function schadenNach(angriff: number, ruestung: number): number {
  return Math.max(1, Math.round((angriff * (100 - ruestung)) / 100));
}

/**
 * Der Schaden, den der Verlierer am Lebensbalken nimmt.
 *
 * Grundschaden plus die geteilte Stufe jeder ueberlebenden Gegnereinheit — so
 * steht es im Konzept ("Schaden am Verlierer nach verbliebenen
 * Gegnereinheiten"). Die Stufe und nicht die Kopfzahl, weil ein einzelner
 * Stufe-3-Riese ein knapperes Ergebnis ist als drei unversehrte
 * Stufe-1-Einheiten, aber ein schwererer Gegner als eine einzelne
 * Stufe-1-Einheit.
 *
 * Warum ueberhaupt geteilt wird, steht bei `SCHADEN_STUFEN_TEILER`.
 */
export function schadenFuerVerlierer(
  ueberlebende: readonly Kaempferstand[],
  teiler: number = SCHADEN_STUFEN_TEILER,
): number {
  const stufen = ueberlebende.reduce((summe, k) => summe + k.stufe, 0);
  return SCHADEN_GRUNDWERT + Math.ceil(stufen / teiler);
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

function standVon(s: Streiter): Kaempferstand {
  return {
    id: s.id,
    seite: s.seite,
    einheitId: s.einheitId,
    stufe: s.stufe,
    platz: s.platz,
    leben: s.leben,
    hoechstesLeben: s.hoechstesLeben,
  };
}

/**
 * Baut aus den beiden Bretthaelften die Streiterliste.
 *
 * Nur was auf dem BRETT steht, kaempft — die Bank sieht zu, sie kommt hier gar
 * nicht erst an. Die Reihenfolge ist fest (erst Seite 0 in Brettordnung, dann
 * Seite 1), und daraus entstehen die Kennungen. Sie sind damit unabhaengig von
 * der Saat: Zwei Kaempfe derselben Bretter mit verschiedenen Saaten reden
 * trotzdem von denselben Einheiten, und ein Fehlerbericht bleibt vergleichbar.
 *
 * Hier kommen die Synergie-Boni auf die Werte — an genau einer Stelle, weil
 * `werte` danach nicht mehr angefasst wird. Gezaehlt wird je Seite ueber die
 * EIGENE Bretthaelfte: Die Krieger des Gegners staerken nicht meine.
 */
function baueStreiter(bretter: readonly [Brettseite, Brettseite]): Streiter[] {
  const streiter: Streiter[] = [];
  for (const seite of SEITEN) {
    const zaehlung = zaehleMarken(bretter[seite]);
    bretter[seite].forEach((einheit, brettPlatz) => {
      if (!einheit) return;
      const w = werteFuer(einheit.id, einheit.stufe, bonusFuerEinheit(einheit.id, zaehlung));
      streiter.push({
        id: streiter.length,
        seite,
        einheitId: einheit.id,
        stufe: einheit.stufe,
        werte: w,
        hoechstesLeben: w.leben,
        rang: 0, // wird gleich vergeben, sobald der Erstzieher feststeht
        platz: nachArena(brettPlatz, seite),
        leben: w.leben,
        angriffFreiAb: 0,
        schrittFreiAb: 0,
      });
    });
  }
  return streiter;
}

/**
 * Die Zugreihenfolge innerhalb eines Taktes.
 *
 * Erst alle Einheiten des Erstziehers in Brettordnung, dann die der anderen
 * Seite. Der Rang steht fuer den ganzen Kampf fest und entscheidet ausserdem
 * den Gleichstand bei der Zielwahl — beides aus demselben Grund an derselben
 * Zahl: Waeren es zwei verschiedene Ordnungen, muesste man bei jedem Befund
 * zweimal nachsehen, welche gerade greift.
 */
function vergibRaenge(streiter: Streiter[], erstZieher: Seite): Streiter[] {
  const reihenfolge = [...streiter].sort((a, b) => {
    if (a.seite !== b.seite) return a.seite === erstZieher ? -1 : 1;
    return a.id - b.id;
  });
  reihenfolge.forEach((s, i) => {
    s.rang = i;
  });
  return reihenfolge;
}

// ---------------------------------------------------------------------------
// Zielwahl und Bewegung
// ---------------------------------------------------------------------------

/**
 * Das naechstgelegene lebende Ziel auf der Gegenseite.
 *
 * Bei gleichem Abstand gewinnt der niedrigere Rang. Irgendeine feste Regel
 * muss es geben, sonst haengt das Ziel an der Reihenfolge, in der die Liste
 * gerade durchlaufen wird — und die aendert sich, sobald jemand die
 * Streiterliste umbaut. Der Rang ist die Ordnung, die ohnehin schon feststeht.
 */
function sucheZiel(wer: Streiter, alle: readonly Streiter[]): Streiter | null {
  const feindSeite = gegenseite(wer.seite);
  let bestes: Streiter | null = null;
  let besterAbstand = Infinity;
  for (const anderer of alle) {
    if (anderer.seite !== feindSeite || anderer.leben <= 0) continue;
    const d = arenaAbstand(wer.platz, anderer.platz);
    if (
      d < besterAbstand ||
      (d === besterAbstand && bestes !== null && anderer.rang < bestes.rang)
    ) {
      bestes = anderer;
      besterAbstand = d;
    }
  }
  return bestes;
}

/**
 * Der Nachbarplatz, der dem Ziel naeher liegt und frei ist — oder null.
 *
 * Ausschliesslich STRIKT naeher. Ein Zug auf ein gleich weit entferntes Feld
 * saehe wie Ausweichen aus, fuehrt aber dazu, dass zwei blockierte Einheiten
 * bis zum Zeitablauf umeinander herumlaufen und dabei jeden Takt ein Ereignis
 * ins Protokoll schreiben. Wer nicht naeher kommt, bleibt stehen; dass eine
 * eingekeilte Einheit ihr Ziel dann womoeglich nie erreicht, faengt die
 * Hoechstdauer ab.
 *
 * Bei mehreren gleich guten Feldern gewinnt das erste in der Ordnung von
 * `arenaNachbarn` — fest und damit wiederholbar.
 */
function schrittZiel(
  wer: Streiter,
  zielPlatz: number,
  belegt: ReadonlyMap<number, number>,
): number | null {
  let bestes: number | null = null;
  let besterAbstand = arenaAbstand(wer.platz, zielPlatz);
  for (const platz of arenaNachbarn(wer.platz)) {
    if (belegt.has(platz)) continue;
    const d = arenaAbstand(platz, zielPlatz);
    if (d < besterAbstand) {
      bestes = platz;
      besterAbstand = d;
    }
  }
  return bestes;
}

// ---------------------------------------------------------------------------
// Das Ende
// ---------------------------------------------------------------------------

function lebende(alle: readonly Streiter[], seite: Seite): Streiter[] {
  return alle.filter((s) => s.seite === seite && s.leben > 0);
}

/**
 * Wer gewinnt, wenn die Zeit ablaeuft?
 *
 * DIE ENTSCHEIDUNG, mit Begruendung — die Aufgabe verlangt sie ausdruecklich:
 *
 * 1. Der HOEHERE ANTEIL am eigenen Gesamtleben gewinnt. Nicht die absolute
 *    Lebenssumme: Ein Brett aus teuren Einheiten hat von Haus aus mehr Leben
 *    und wuerde jedes Zeitpatt gewinnen, ohne im Kampf irgendetwas geleistet
 *    zu haben. Der Anteil misst dagegen, wer den anderen naeher an den Tod
 *    gedrueckt hat — und das ist die einzige Leistung, die in einem Kampf
 *    ohne Sieger ueberhaupt messbar ist.
 * 2. Bei gleichem Anteil zaehlt, wer mehr Einheiten stehen hat. Das ist der
 *    Massstab, mit dem der Schaden am Verlierer ohnehin gerechnet wird.
 * 3. Sonst ist es UNENTSCHIEDEN, und dann nimmt niemand Schaden. Ein
 *    Muenzwurf aus der Saat waere hier moeglich und trotzdem falsch: Der
 *    Spieler saehe zwei identische Kaempfe und einmal Schaden, einmal nicht.
 *
 * Gerechnet wird mit Kreuzmultiplikation statt mit einer Division, damit der
 * Vergleich exakt bleibt. Zwei Anteile als Gleitkommazahl koennen bei
 * gleichem Verhaeltnis um ein Bit auseinanderliegen — und dann faellt ein
 * Unentschieden zufaellig auf eine Seite.
 */
function entscheideNachZeit(alle: readonly Streiter[]): Seite | null {
  const werte = SEITEN.map((seite) => {
    const stehende = lebende(alle, seite);
    return {
      seite,
      leben: stehende.reduce((s, k) => s + k.leben, 0),
      gesamt: alle.filter((k) => k.seite === seite).reduce((s, k) => s + k.hoechstesLeben, 0),
      koepfe: stehende.length,
    };
  });
  const a = werte[0]!;
  const b = werte[1]!;

  const linkeSeite = a.leben * b.gesamt;
  const rechteSeite = b.leben * a.gesamt;
  if (linkeSeite !== rechteSeite) return linkeSeite > rechteSeite ? a.seite : b.seite;
  if (a.koepfe !== b.koepfe) return a.koepfe > b.koepfe ? a.seite : b.seite;
  return null;
}

// ---------------------------------------------------------------------------
// Die Simulation
// ---------------------------------------------------------------------------

/**
 * Rechnet einen ganzen Kampf durch.
 *
 * `bretter[0]` kaempft gegen `bretter[1]`; welcher Spieler auf welcher Seite
 * steht, entscheidet die Partie, nicht diese Datei. Uebergeben wird jeweils
 * `heer.brett` — nur das Brett, die Bank bleibt aussen vor.
 *
 * WOFUER DIE SAAT GEBRAUCHT WIRD: fuer genau eine Frage — wer innerhalb eines
 * Taktes zuerst handelt. Alles andere am Kampf ist fest gerechnet, und das
 * soll auch so bleiben: Ein Wuerfel auf jeden einzelnen Treffer waere fuer
 * den Zuschauer nicht mehr nachvollziehbar. Der Erstzieher ist aber keine
 * Kleinigkeit, sondern der einzige systematische Vorteil im ganzen Modell:
 * Bei zwei gleichen Brettern gewinnt zwangslaeufig, wer zuerst schlaegt.
 * Waere das immer Seite 0, haette in jedem Spiegelkampf derselbe Sitz recht —
 * ein Vorteil, den niemand erspielt hat. Die Saat verteilt ihn.
 *
 * Gleiche Saat plus gleiche Bretter ergibt denselben Ablauf, Ereignis fuer
 * Ereignis (siehe test/kampf.test.ts).
 */
export function simuliereKampf(
  bretter: readonly [Brettseite, Brettseite],
  saat: Saat,
  regler: Kampfregler = STANDARD_REGLER,
): Kampfbericht {
  const alsText = String(saat);
  const schritt = schrittdauer(regler);
  const zufall = baueZufall(alsText);
  const erstZieher: Seite = zufall() < 0.5 ? 0 : 1;

  const alle = baueStreiter(bretter);
  const reihenfolge = vergibRaenge(alle, erstZieher);
  const start = alle.map(standVon);

  // Wer steht wo. Der Wert ist die Kennung und nicht nur ein Haken: Beim
  // Nachsehen, warum eine Einheit nicht vorankommt, will man wissen, WER ihr
  // im Weg steht.
  const belegt = new Map<number, number>();
  for (const s of alle) belegt.set(s.platz, s.id);

  const ereignisse: Ereignis[] = [];
  let jetzt = 0;
  let grund: Endgrund = 'ausgeloescht';

  for (;;) {
    // Erst pruefen, dann handeln: Ein bereits entschiedener Kampf soll nicht
    // noch einen Takt lang Ereignisse erzeugen, in denen Ueberlebende auf
    // niemanden mehr einschlagen.
    if (lebende(alle, 0).length === 0 || lebende(alle, 1).length === 0) {
      grund = 'ausgeloescht';
      break;
    }
    if (jetzt >= regler.hoechstdauerMs) {
      grund = 'zeit';
      break;
    }

    for (const wer of reihenfolge) {
      if (wer.leben <= 0) continue; // im selben Takt schon gefallen

      const ziel = sucheZiel(wer, alle);
      if (!ziel) break; // Gegenseite ausgeloescht — der Rest des Taktes entfaellt

      if (arenaAbstand(wer.platz, ziel.platz) <= wer.werte.reichweite) {
        if (jetzt < wer.angriffFreiAb) continue;
        const schaden = schadenNach(wer.werte.angriff, ziel.werte.ruestung);
        ziel.leben = Math.max(0, ziel.leben - schaden);
        wer.angriffFreiAb = jetzt + angriffstakt(wer.werte.tempo, regler);
        ereignisse.push({
          art: 'treffer',
          zeitMs: jetzt,
          wer: wer.id,
          ziel: ziel.id,
          schaden,
          lebenDanach: ziel.leben,
        });
        if (ziel.leben === 0) {
          belegt.delete(ziel.platz);
          ereignisse.push({ art: 'tod', zeitMs: jetzt, wer: ziel.id });
        }
        continue;
      }

      if (jetzt < wer.schrittFreiAb) continue;
      const nach = schrittZiel(wer, ziel.platz, belegt);
      if (nach === null) continue; // eingekeilt: stehen bleiben statt im Kreis zu laufen
      const von = wer.platz;
      belegt.delete(von);
      belegt.set(nach, wer.id);
      wer.platz = nach;
      wer.schrittFreiAb = jetzt + schritt;
      ereignisse.push({ art: 'bewegung', zeitMs: jetzt, wer: wer.id, von, nach });
    }

    jetzt += regler.taktMs;
  }

  // `dauerMs` liegt damit einen Takt hinter dem letzten Ereignis: Der Takt, in
  // dem der letzte Gegner faellt, wird zu Ende gespielt, und erst der naechste
  // Schleifendurchlauf stellt das Ende fest. Das ist gewollt — die Anzeige
  // braucht nach dem letzten Todesstoss ohnehin einen Wimpernschlag, bevor sie
  // das Ergebnis einblendet.

  const sieger =
    grund === 'zeit'
      ? entscheideNachZeit(alle)
      : lebende(alle, 0).length > 0
        ? 0
        : lebende(alle, 1).length > 0
          ? 1
          : null;

  ereignisse.push({ art: 'ende', zeitMs: jetzt, sieger, grund });

  const ueberlebende = alle.filter((s) => s.leben > 0).map(standVon);
  const schaden =
    sieger === null
      ? 0
      : schadenFuerVerlierer(
          ueberlebende.filter((k) => k.seite === sieger),
          regler.schadenStufenTeiler,
        );

  return {
    saat: alsText,
    erstZieher,
    start,
    ereignisse,
    sieger,
    grund,
    dauerMs: jetzt,
    ueberlebende,
    schaden,
  };
}

/**
 * Ein Kampfbericht als Zeichenkette, Zeile fuer Zeile.
 *
 * Nicht fuer die Oberflaeche, sondern fuer Proben und Fehlerberichte: Zwei
 * Laeufe zu vergleichen heisst dann, zwei Texte zu vergleichen, und die erste
 * abweichende Zeile nennt Zeitpunkt und Beteiligte. Ohne so eine Form endet
 * jede Determinismus-Probe in einer Objektdiagonale, in der niemand sieht,
 * WELCHES der vierhundert Ereignisse abweicht.
 */
export function protokollText(bericht: Kampfbericht): string {
  const zeilen = bericht.ereignisse.map((e) => {
    const zeit = String(e.zeitMs).padStart(6, ' ');
    switch (e.art) {
      case 'bewegung':
        return `${zeit} bewegung ${e.wer} ${e.von} -> ${e.nach}`;
      case 'treffer':
        return `${zeit} treffer  ${e.wer} -> ${e.ziel} ${e.schaden} (${e.lebenDanach})`;
      case 'tod':
        return `${zeit} tod      ${e.wer}`;
      case 'ende':
        return `${zeit} ende     sieger=${e.sieger ?? '-'} grund=${e.grund}`;
    }
  });
  return zeilen.join('\n');
}

/** Alle Ueberlebenden einer Seite — das braucht die Partie fuer den Schaden. */
export function ueberlebendeVon(bericht: Kampfbericht, seite: Seite): readonly Kaempferstand[] {
  return bericht.ueberlebende.filter((k) => k.seite === seite);
}
