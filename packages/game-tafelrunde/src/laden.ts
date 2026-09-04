/**
 * Der Laden: fuenf Plaetze, gezogen aus dem gemeinsamen Vorrat.
 *
 * Zwei Dinge entscheiden, was hier liegt: das Spielerlevel (die Tabelle
 * `CHANCEN`) und der Rest des Vorrats (vorrat.ts). Beides zusammen ist die
 * ganze Spannung des Spiels — hoeheres Level heisst bessere Aussichten, aber
 * auf eine Einheit, die drei Mitspieler schon aufgekauft haben, hilft auch
 * Level 9 nicht.
 *
 * Reine Funktionen: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser
 * dem uebergebenen Seed (game-api, Grundsatz 1). Der uebergebene Zustand wird
 * nie veraendert, es kommt immer ein neuer zurueck.
 *
 * ZUR SAAT: Jede Ziehung bekommt ihre eigene Saat uebergeben, und das ist
 * Absicht — dieselbe Saat ergibt zwingend denselben Laden (dafuer gibt es
 * eine Probe). Wer den Laden zweimal mit derselben Saat wuerfelt, bekommt
 * zweimal dasselbe und hat zwei Gold verbrannt. Die spaetere partie.ts baut
 * die Saat deshalb aus Partiesaat, Runde, Sitz und einem Wurfzaehler
 * zusammen, etwa "a1b2c3:r7:s2:w3".
 */

import { type EinheitId, type Kosten, einheitVonId } from './einheiten.js';
import {
  HOECHSTES_LEVEL,
  type Level,
  PREIS_NEU_WUERFELN,
  kannZahlen,
  preisKaufen,
  preisLevelAuf,
  verkaufsWert,
  zahle,
} from './gold.js';
import { type Exemplar } from './verschmelzen.js';
import { type Saat, type Vorrat, baueZufall, freiMitKosten, ziehe, zurueck, zurueckExemplare } from './vorrat.js';

/** Fuenf Plaetze, wie im Konzept. */
export const LADEN_PLAETZE = 5;

/**
 * Die Ladenauslage. Ein leerer Platz ist `null` — entweder gekauft oder der
 * Vorrat gab nichts mehr her.
 */
export interface Laden {
  readonly plaetze: readonly (EinheitId | null)[];
}

/** Ein Laden ohne Auslage. Startpunkt vor dem ersten Wurf. */
export function leererLaden(): Laden {
  return { plaetze: Array.from({ length: LADEN_PLAETZE }, () => null) };
}

/**
 * Die Chancentabelle: Level -> Wahrscheinlichkeit je Kostenstufe, in
 * Prozentpunkten.
 *
 * Als Daten und nicht als Bedingungskette — an dieser Tabelle wird nach den
 * ersten Partien geschraubt, und man muss sie in einem Blick lesen koennen.
 * Prozentpunkte als ganze Zahlen, damit die Summe je Zeile exakt 100 ergibt
 * (eine Probe prueft das); mit 0,25 und 0,35 stuende dort irgendwann
 * 0,9999999999999999, und die letzte Kostenstufe waere unerreichbar.
 *
 * Die Spalten sind [1 Gold, 2 Gold, 3 Gold]. Level 1 und 2 zeigen nur die
 * billigste Stufe: Die ersten Runden sollen ueber Menge und Verschmelzen
 * gehen, nicht ueber einen Gluecksgriff.
 */
export const CHANCEN: Readonly<Record<Level, readonly [number, number, number]>> = {
  1: [100, 0, 0],
  2: [100, 0, 0],
  3: [75, 25, 0],
  4: [60, 30, 10],
  5: [50, 35, 15],
  6: [40, 40, 20],
  7: [33, 40, 27],
  8: [25, 42, 33],
  9: [20, 40, 40],
};

/** Die Chance auf eine Kostenstufe in Prozentpunkten. */
export function chanceFuer(level: Level, kosten: Kosten): number {
  return CHANCEN[level][kosten - 1];
}

/**
 * Wuerfelt die Kostenstufe eines einzelnen Platzes aus der Tabelle.
 *
 * Verbraucht genau EINE Zahl aus dem Strom, auch bei einer Zeile mit lauter
 * Nullen. Das haelt den Strom vorhersagbar: Wer die Tabelle spaeter aendert,
 * verschiebt sonst rueckwirkend jede gespeicherte Partie.
 */
export function wuerfleKosten(level: Level, zufall: () => number): Kosten {
  const zeile = CHANCEN[level];
  const los = zufall() * 100;
  let grenze = 0;
  for (let i = 0; i < zeile.length; i++) {
    grenze += zeile[i];
    if (los < grenze) return (i + 1) as Kosten;
  }
  // Rundungsrest oder eine Zeile, die nicht auf 100 kommt: die billigste
  // Stufe ist die harmlose Antwort.
  return 1;
}

/**
 * Zieht eine Karte fuer einen Platz — mit Ausweichen nach unten.
 *
 * Ist die gewuerfelte Kostenstufe leer, wird die naechstbilligere versucht,
 * danach die naechstteurere. Nach unten zuerst, weil billige Karten haeufiger
 * sind und der Spieler bei leerem Vorrat sonst reihenweise teure Einheiten
 * geschenkt bekaeme — ausgerechnet dann, wenn der Vorrat knapp ist.
 */
function zieheFuerPlatz(
  vorrat: Vorrat,
  level: Level,
  zufall: () => number,
): { vorrat: Vorrat; einheitId: EinheitId | null } {
  const gewuenscht = wuerfleKosten(level, zufall);
  const reihenfolge: Kosten[] = [gewuenscht];
  for (let k = gewuenscht - 1; k >= 1; k--) reihenfolge.push(k as Kosten);
  for (let k = gewuenscht + 1; k <= 3; k++) reihenfolge.push(k as Kosten);

  for (const kosten of reihenfolge) {
    if (freiMitKosten(vorrat, kosten) <= 0) continue;
    return ziehe(vorrat, kosten, zufall);
  }
  return { vorrat, einheitId: null }; // Der ganze Vorrat ist leer. Kommt vor, ist kein Fehler.
}

/**
 * Fuellt alle fuenf Plaetze neu. Der alte Inhalt geht vorher zurueck.
 *
 * Ohne das Zuruecklegen waere der Vorrat nach ein paar Runden leer, obwohl
 * niemand etwas gekauft hat: Jeder Wurf haette fuenf Karten verschluckt.
 */
export function fuelleNeu(vorrat: Vorrat, laden: Laden, level: Level, saat: Saat): { laden: Laden; vorrat: Vorrat } {
  const zufall = baueZufall(saat);
  let stand = zurueck(vorrat, laden.plaetze.filter((id): id is EinheitId => id !== null));

  const plaetze: (EinheitId | null)[] = [];
  for (let i = 0; i < LADEN_PLAETZE; i++) {
    const gezogen = zieheFuerPlatz(stand, level, zufall);
    stand = gezogen.vorrat;
    plaetze.push(gezogen.einheitId);
  }
  return { laden: { plaetze }, vorrat: stand };
}

// ---------------------------------------------------------------------------
// Der Zustand eines Spielers, soweit der Laden ihn braucht
// ---------------------------------------------------------------------------

/**
 * Gold, Level, Auslage und der Blick auf den gemeinsamen Vorrat.
 *
 * Bank und Brett stehen bewusst NICHT darin. Der Laden gibt beim Kauf ein
 * Exemplar heraus und nimmt das Gold; wo es landet, entscheidet brett.ts mit
 * `aufBank()`. Das trennt zwei Regeln, die sonst in einer Funktion
 * verschwaenden — und die spaetere partie.ts setzt beide in einem Zug
 * zusammen, mit der Pruefung auf einen freien Bankplatz davor.
 *
 * Der Vorrat liegt hier als ganzes Feld und nicht als Kopie: Er gehoert der
 * Partie, nicht dem Spieler. Wer diese Struktur baut, reicht den Vorrat der
 * Partie hinein und schreibt den zurueckgegebenen wieder dorthin.
 */
export interface LadenZustand {
  readonly vorrat: Vorrat;
  readonly laden: Laden;
  readonly gold: number;
  readonly level: Level;
}

/** Wuerfelt ohne Kosten — fuer den ersten Laden einer Partie. */
export function wuerfleKostenlos(zustand: LadenZustand, saat: Saat): LadenZustand {
  const { laden, vorrat } = fuelleNeu(zustand.vorrat, zustand.laden, zustand.level, saat);
  return { ...zustand, laden, vorrat };
}

/** Reicht das Gold fuer einen Wurf? */
export function kannNeuWuerfeln(zustand: LadenZustand): boolean {
  return kannZahlen(zustand.gold, PREIS_NEU_WUERFELN);
}

/**
 * Neu wuerfeln: kostet Gold, legt die alte Auslage zurueck, zieht fuenf neue.
 *
 * Wirft bei zu wenig Gold. Ein Wurf, der stillschweigend nichts tut, waere im
 * Zweifel der teuerste Fehler des Spiels — der Spieler haette die Auslage
 * gesehen und darauf gebaut.
 */
export function neuWuerfeln(zustand: LadenZustand, saat: Saat): LadenZustand {
  const gold = zahle(zustand.gold, PREIS_NEU_WUERFELN);
  return wuerfleKostenlos({ ...zustand, gold }, saat);
}

/** Liegt auf dem Platz etwas, und reicht das Gold dafuer? */
export function kannKaufen(zustand: LadenZustand, platz: number): boolean {
  const id = zustand.laden.plaetze[platz];
  if (!id) return false;
  return kannZahlen(zustand.gold, preisKaufen(einheitVonId(id)));
}

/**
 * Kauft den Platz und gibt das Exemplar heraus.
 *
 * Die Karte ist zu diesem Zeitpunkt laengst aus dem Vorrat — sie ging beim
 * Ziehen heraus. Der Kauf nimmt sie nur aus der Auslage, damit sie nicht beim
 * naechsten Wurf zurueckwandert und dem Spieler zweimal gehoert.
 *
 * Gekauft wird immer auf Stufe 1. Hoehere Stufen entstehen ausschliesslich
 * durch Verschmelzen.
 */
export function kaufe(zustand: LadenZustand, platz: number): { zustand: LadenZustand; exemplar: Exemplar } {
  if (!Number.isInteger(platz) || platz < 0 || platz >= LADEN_PLAETZE) {
    throw new Error(`Ladenplatz gibt es nicht: ${platz}`);
  }
  const id = zustand.laden.plaetze[platz];
  if (!id) throw new Error(`Ladenplatz ist leer: ${platz}`);

  const gold = zahle(zustand.gold, preisKaufen(einheitVonId(id)));
  const plaetze = [...zustand.laden.plaetze];
  plaetze[platz] = null;
  return {
    zustand: { ...zustand, gold, laden: { plaetze } },
    exemplar: { einheitId: id, stufe: 1 },
  };
}

/** Reicht das Gold fuers Aufsteigen, und geht ueberhaupt noch eins? */
export function kannLevelAuf(zustand: LadenZustand): boolean {
  const preis = preisLevelAuf(zustand.level);
  return preis !== null && kannZahlen(zustand.gold, preis);
}

/**
 * Steigt ein Level auf.
 *
 * Der Laden wird dabei NICHT neu gewuerfelt. Sonst waere Aufsteigen ein
 * Gratiswurf, und die Entscheidung "Level oder wuerfeln" gaebe es nicht mehr
 * — die naechste Auslage kommt ohnehin schon mit den besseren Chancen.
 */
export function levelAuf(zustand: LadenZustand): LadenZustand {
  const preis = preisLevelAuf(zustand.level);
  if (preis === null) throw new Error(`Hoechstes Level erreicht: ${HOECHSTES_LEVEL}`);
  return { ...zustand, gold: zahle(zustand.gold, preis), level: (zustand.level + 1) as Level };
}

/**
 * Verkauft ein Exemplar: Gold zurueck, Karten zurueck in den Vorrat.
 *
 * Das Exemplar muss vorher aus der Aufstellung genommen worden sein
 * (brett.ts: `vonBank`, `vomBrett`) — dieselbe Trennung wie beim Kaufen. Wer
 * hier eine Einheit hineinreicht, die noch auf dem Brett steht, verdoppelt
 * sie; die Klammer darum zieht spaeter partie.ts.
 */
export function verkaufe(zustand: LadenZustand, exemplar: Exemplar): LadenZustand {
  return {
    ...zustand,
    gold: zustand.gold + verkaufsWert(exemplar),
    vorrat: zurueckExemplare(zustand.vorrat, [exemplar]),
  };
}
