/**
 * Das Aufstellungsduell: DASSELBE Heer zweimal aufgestellt — einmal nach
 * Regel A, einmal nach Regel B — und dann gegeneinander.
 *
 * ANLASS: Beim Umbau der Bot-Aufstellung am 06.09.2026 (`wunschreihe` in
 * bot.ts) ist die naheliegendste Frage unbeantwortet geblieben: Stellt der
 * neue Bot STAERKER auf als der alte? Alle vorhandenen Messstaende taugen
 * dafuer nicht, und zwar nicht aus Nachlaessigkeit, sondern bauartbedingt —
 * werkzeug/ausgewogenheit.mjs, werkzeug/laufwege.mjs und
 * werkzeug/gangarten.mjs spielen Tische, an denen JEDER Bot dieselbe Regel
 * benutzt. Sie zeigen, wie sich die Meta verschiebt (welche Einheit gewinnt,
 * wie viel gelaufen wird, wie lange ein Kampf dauert), und genau deshalb
 * zeigen sie nicht, welche AUFSTELLUNG gewinnt: Wenn beide Seiten nach
 * derselben Regel stehen, hebt sich der Regelunterschied heraus, ehe der
 * erste Takt laeuft. Eine Siegquote gegen sich selbst ist immer 50 %.
 *
 * DIESE DATEI IST DER ZWEITE MESSSTAND und nicht der Ersatz fuer den ersten.
 * Sie beantwortet nur die Duellfrage; ob ein Spiel mit der neuen Regel besser
 * ist (kuerzere Kaempfe, ausgewogenere Einheiten, mehr Bewegung), steht
 * weiter dort. Wer nur eines liest, zieht den falschen Schluss — derselbe
 * Satz steht im Kopf von test/turnier.ts ueber Turnier und Ausgewogenheit.
 *
 * WIE SIE GEBAUT IST, folgt der `beistandsprobe` in test/turnier.ts, weil die
 * Frage dieselbe Form hat ("lohnt sich dieser eine Unterschied?"):
 *
 *   - Gegen das EIGENE Heer und nicht gegen ein fremdes, damit der Vergleich
 *     nur EINEN Unterschied hat: die Aufstellung. Zwei verschiedene Heere
 *     maessen den Einkauf mit.
 *   - BEIDE SEITEN antreten lassen. Der Kampf ist bei getauschten
 *     Aufstellungen nur so lange spiegelsymmetrisch, wie niemand laeuft
 *     (arena.ts), und gelaufen wird seit der Arenaluecke immer (Board-Karte
 *     461be03d). Sonst haengt die Zahl am Erstzieher und an den Laufwegen.
 *   - Die ZWEITE Regel steht hier nachgebildet (`ALTE_PLATZSTRAFE`) und nicht
 *     im Modul. Aus demselben Grund wie `stelleAuf` in test/turnier.ts: Eine
 *     abgeloeste Regel gehoert nicht in den Auslieferungsstand, nur damit ein
 *     Messwerkzeug sie aufrufen kann. Die Gefahr, dass die Nachbildung
 *     abdriftet, besteht hier nicht — sie soll gerade NICHT mitwandern,
 *     sondern den Stand vor dem Umbau festhalten.
 *
 * WAS HIER NICHT NACHGEBILDET IST, und das ist der Unterschied zu turnier.ts:
 * die Aufstellungs-MASCHINE. Beide Regeln laufen durch `stelleHeerAuf` aus
 * bot.ts (hinstellen, dann nachbessern bis zum Stillstand). Nur so misst das
 * Duell die Regel und nicht den Unterschied zweier Maschinen.
 *
 * DETERMINISMUS: keine Uhr, kein `Math.random`, kein Zustand zwischen zwei
 * Kaempfen. Heer und Kampfsaat entstehen aus Saatbasis, Heergroesse und
 * laufender Nummer; derselbe Aufruf liefert dieselbe Tabelle (game-api,
 * Grundsatz 1).
 */

import {
  BRETT_FELDER,
  BRETT_REIHEN,
  BRETT_SPALTEN,
  BOT_PLATZSTRAFE,
  type Brettseite,
  type EinheitId,
  KATALOG,
  type Kaempfer,
  type Kampfregler,
  type Kosten,
  type Platzstrafe,
  type Rolle,
  STANDARD_REGLER,
  type Stufe,
  baueZufall,
  einheit,
  einheitenMitKosten,
  simuliereKampf,
  stelleHeerAuf,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Regel B: der Stand vor dem 06.09.2026
// ---------------------------------------------------------------------------

/**
 * Die Gewichte der alten Regel, wortgleich aus bot.ts vor dem 06.09.2026.
 *
 * Sie stehen hier noch einmal und nicht als Import, weil sie im Modul
 * inzwischen etwas anderes bedeuten: `REIHEN_GEWICHT` gilt dort heute nur
 * noch fuer den Weg nach hinten, nach vorn wiegt `VORRUECK_GEWICHT`. Ein
 * Import haenge die alte Regel an Zahlen, die zur neuen gehoeren — und beim
 * naechsten Dreh an den Gewichten waere der Vergleichsmassstab stillschweigend
 * mitverschoben.
 */
const ALT_REIHEN_GEWICHT = 10;
const ALT_RAND_GEWICHT = 2;
const ALT_VORDERSTE_REIHE = 0;

/**
 * Die Aufstellungsregel des Bots BIS ZUM 06.09.2026 — zwei Extreme statt
 * einer Wunschreihe je Rolle.
 *
 * Wache und Meuchler ganz nach vorn, alles andere ganz nach hinten; der
 * Meuchler an den Rand, alle uebrigen in die Mitte. Auf den zwei Reihen von
 * damals war das vollstaendig. Seit das Brett vier Reihen hat, laesst dieselbe
 * unveraenderte Regel die beiden mittleren leer — ueber 26.395 aufgestellte
 * Einheiten stand der Bot zu 100 % in Reihe 0 oder Reihe 3. Genau das ist der
 * Unterschied, den dieses Duell wiegt.
 *
 * Wortgetreu aus bot.ts, Stand vor Commit db40af4. Wer sie „verbessert",
 * verschiebt den Massstab und macht jede aeltere Zahl unvergleichbar.
 */
export const ALTE_PLATZSTRAFE: Platzstrafe = (k, platz, reihen, spalten) => {
  const reihe = Math.floor(platz / spalten);
  const spalte = platz % spalten;
  const nachHinten = reihen - 1 - reihe;
  const zurMitte = Math.abs(spalte - (spalten - 1) / 2);
  const zumRand = Math.min(spalte, spalten - 1 - spalte);

  switch (einheit(k.id).rolle) {
    case 'wache':
      return ALT_REIHEN_GEWICHT * (reihe - ALT_VORDERSTE_REIHE) + zurMitte;
    case 'meuchler':
      return ALT_REIHEN_GEWICHT * (reihe - ALT_VORDERSTE_REIHE) + ALT_RAND_GEWICHT * zumRand;
    default:
      return ALT_REIHEN_GEWICHT * nachHinten + zurMitte;
  }
};

// ---------------------------------------------------------------------------
// Die Heere
// ---------------------------------------------------------------------------

/**
 * Wie gross die Heere sind, ueber die gemessen wird.
 *
 * Die Zahlen sind Feldplaetze und damit Level (`feldplaetze` in regeln.ts):
 * Drei ist ein fruehes Brett, neun das groesste, das es gibt. Die Groesse
 * steht in der Tabelle als eigene Zeile, weil die Aufstellungsregel mit ihr
 * erst zur Geltung kommt — bei drei Einheiten ist fast jede Wunschreihe frei,
 * bei neun kaempfen sie um dieselben Felder. Waere der Unterschied nur bei
 * neun zu sehen, waere er im Spiel selten.
 */
export const HEERGROESSEN: readonly number[] = [3, 5, 7, 9];

/**
 * Ein Heer wuerfeln: `groesse` Einheiten, gleichverteilt aus dem Katalog und
 * MIT Zuruecklegen.
 *
 * Mit Zuruecklegen, weil echte Heere Kopien enthalten — drei gleiche Karten
 * sind im Spiel sogar das Ziel (`VERSCHMELZ_ZAHL`). Gleichverteilt dagegen
 * ist bewusst UNREALISTISCH: Der Bot kauft nach Wert und der Laden wuerfelt
 * nach Level, ein gezogenes Heer sieht also nicht aus wie ein gespieltes. Fuer
 * die Duellfrage ist das richtig herum — beide Seiten bekommen dasselbe Heer,
 * ein schiefes Heer verzerrt damit keine der beiden Regeln, und die
 * Gleichverteilung deckt mehr Rollenmischungen ab als der Einkauf des Bots.
 * Wer wissen will, wie sich die Regel an einem ECHTEN Tisch auswirkt, misst
 * mit werkzeug/ausgewogenheit.mjs weiter.
 */
export function heerZiehen(
  saat: string,
  groesse: number,
  stufe: Stufe,
  kosten?: Kosten,
): Kaempfer[] {
  if (!Number.isInteger(groesse) || groesse < 1 || groesse > BRETT_FELDER) {
    throw new Error(`Heergroesse muss zwischen 1 und ${BRETT_FELDER} liegen, nicht ${groesse}`);
  }
  const vorrat: readonly EinheitId[] = (
    kosten === undefined ? KATALOG : einheitenMitKosten(kosten)
  ).map((e) => e.id);
  const zufall = baueZufall(saat);
  const heer: Kaempfer[] = [];
  for (let i = 0; i < groesse; i++) {
    heer.push({ id: vorrat[Math.floor(zufall() * vorrat.length)]!, stufe });
  }
  return heer;
}

/** Stehen beide Aufstellungen Feld fuer Feld gleich? Dann gibt es nichts zu messen. */
function gleicheAufstellung(a: Brettseite, b: Brettseite): boolean {
  return a.every((k, platz) => {
    const andere = b[platz] ?? null;
    if (k === null || andere === null) return k === andere;
    return k.id === andere.id && k.stufe === andere.stufe;
  });
}

/** Welche Rollen in diesem Heer ueberhaupt vorkommen. */
function rollenIn(heer: readonly Kaempfer[]): Set<Rolle> {
  return new Set(heer.map((k) => einheit(k.id).rolle));
}

// ---------------------------------------------------------------------------
// Was herauskommt
// ---------------------------------------------------------------------------

/** Eine Bilanz aus Sicht von Regel A. */
export interface Duellbilanz {
  readonly kaempfe: number;
  /** Siege der Seite, die nach Regel A steht. */
  readonly siege: number;
  /** Kaempfe ohne Sieger. Zaehlen weder als Sieg noch als Niederlage. */
  readonly unentschieden: number;
  /** Kaempfe, die an der Hoechstdauer abgeschnitten wurden. */
  readonly anDerUhr: number;
  /** Siegquote von Regel A. `null`, wenn kein Kampf stattfand. */
  readonly quote: number | null;
}

/** Eine Zeile je Heergroesse. */
export interface Duellzeile extends Duellbilanz {
  readonly groesse: number;
  /** Wie viele Heere gewuerfelt wurden. */
  readonly heere: number;
  /**
   * Bei wie vielen davon BEIDE Regeln dasselbe Feld waehlten.
   *
   * Diese Heere kaempfen nicht — ein Kampf gegen die eigene Aufstellung
   * entscheidet nur der Erstzieher und faelschte die Quote zur 50 % hin. Die
   * Zahl gehoert trotzdem in die Tabelle, und zwar als die wichtigste neben
   * der Quote: Sie sagt, wie oft der Unterschied ueberhaupt einer ist.
   */
  readonly gleich: number;
  /** Mittlere Kampfdauer in Millisekunden. */
  readonly dauerSchnittMs: number;
}

export interface Duellbefund {
  readonly zeilen: readonly Duellzeile[];
  /** Alle Groessen zusammen. */
  readonly gesamt: Duellbilanz;
  readonly heere: number;
  readonly gleich: number;
  /**
   * Je Rolle: die Bilanz ueber die Heere, in denen diese Rolle vorkommt.
   *
   * Ein Heer zaehlt fuer jede Rolle, die es enthaelt — die Zeilen summieren
   * sich also NICHT zur Gesamtzahl. Sie beantworten eine andere Frage: An
   * welcher Rolle haengt der Unterschied? Beim Umbau am 06.09.2026 war die
   * Erwartung der `beistand` (aus Reihe 3 heilt er die Front nicht mehr); ob
   * sie stimmt, sagt diese Tabelle und nicht die Begruendung in bot.ts.
   */
  readonly jeRolle: ReadonlyMap<Rolle, Duellbilanz>;
}

export interface Duelloptionen {
  /** Wie viele Heere je Groesse gewuerfelt werden. */
  readonly heere?: number;
  /** Saaten je Heer UND Seitenzuweisung. Jede Saat wuerfelt den Erstzieher neu. */
  readonly saaten?: number;
  readonly groessen?: readonly number[];
  readonly saatBasis?: string;
  readonly stufe?: Stufe;
  /** Nur Einheiten dieser Kostenstufe ins Heer. Ohne Angabe der ganze Katalog. */
  readonly kosten?: Kosten;
  readonly regler?: Kampfregler;
  /** Regel A — die gemessene. Vorgabe: die des Bots. */
  readonly regel?: Platzstrafe;
  /** Regel B — der Massstab. Vorgabe: der Stand vor dem 06.09.2026. */
  readonly gegenregel?: Platzstrafe;
}

function vollstaendig(optionen: Duelloptionen): Required<Omit<Duelloptionen, 'kosten'>> & {
  kosten: Kosten | undefined;
} {
  const heere = optionen.heere ?? 50;
  if (!Number.isInteger(heere) || heere < 1) {
    throw new Error(`heere muss eine ganze Zahl ab 1 sein, nicht ${heere}`);
  }
  const groessen = optionen.groessen ?? HEERGROESSEN;
  for (const groesse of groessen) {
    if (!Number.isInteger(groesse) || groesse < 1 || groesse > BRETT_FELDER) {
      throw new Error(`Heergroesse muss zwischen 1 und ${BRETT_FELDER} liegen, nicht ${groesse}`);
    }
  }
  return {
    heere,
    saaten: optionen.saaten ?? 1,
    groessen,
    saatBasis: optionen.saatBasis ?? 'duell-v1',
    stufe: optionen.stufe ?? 1,
    kosten: optionen.kosten,
    regler: optionen.regler ?? STANDARD_REGLER,
    regel: optionen.regel ?? BOT_PLATZSTRAFE,
    gegenregel: optionen.gegenregel ?? ALTE_PLATZSTRAFE,
  };
}

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

interface Konto {
  kaempfe: number;
  siege: number;
  unentschieden: number;
  anDerUhr: number;
  dauerSumme: number;
}

const leeresKonto = (): Konto => ({
  kaempfe: 0,
  siege: 0,
  unentschieden: 0,
  anDerUhr: 0,
  dauerSumme: 0,
});

function bilanz(k: Konto): Duellbilanz {
  return {
    kaempfe: k.kaempfe,
    siege: k.siege,
    unentschieden: k.unentschieden,
    anDerUhr: k.anDerUhr,
    quote: k.kaempfe === 0 ? null : k.siege / k.kaempfe,
  };
}

export function duell(optionen: Duelloptionen = {}): Duellbefund {
  const o = vollstaendig(optionen);
  const zeilen: Duellzeile[] = [];
  const gesamt = leeresKonto();
  const jeRolle = new Map<Rolle, Konto>();
  let heereGesamt = 0;
  let gleichGesamt = 0;

  for (const groesse of o.groessen) {
    const konto = leeresKonto();
    let gleich = 0;

    for (let i = 0; i < o.heere; i++) {
      const heer = heerZiehen(`${o.saatBasis}:heer:${groesse}:${i}`, groesse, o.stufe, o.kosten);
      const nachA = stelleHeerAuf(heer, BRETT_REIHEN, BRETT_SPALTEN, o.regel);
      const nachB = stelleHeerAuf(heer, BRETT_REIHEN, BRETT_SPALTEN, o.gegenregel);
      heereGesamt += 1;
      if (gleicheAufstellung(nachA, nachB)) {
        gleich += 1;
        gleichGesamt += 1;
        continue;
      }

      // Jeder Kampf zaehlt in drei Koerbe: die Zeile dieser Heergroesse, die
      // Gesamtbilanz und je ein Konto fuer jede Rolle, die im Heer steht.
      const konten: Konto[] = [konto, gesamt];
      for (const rolle of rollenIn(heer)) {
        let rollenkonto = jeRolle.get(rolle);
        if (rollenkonto === undefined) {
          rollenkonto = leeresKonto();
          jeRolle.set(rolle, rollenkonto);
        }
        konten.push(rollenkonto);
      }

      // Beide Seiten: einmal steht A auf Seite 0, einmal auf Seite 1. Sonst
      // haengt die Zahl am Erstzieher und an den Laufwegen.
      for (const aAufSeite of [0, 1] as const) {
        for (let n = 0; n < o.saaten; n++) {
          const bretter: readonly [Brettseite, Brettseite] =
            aAufSeite === 0 ? [nachA, nachB] : [nachB, nachA];
          const bericht = simuliereKampf(
            bretter,
            `${o.saatBasis}:kampf:${groesse}:${i}:${aAufSeite}:${n}`,
            o.regler,
          );
          for (const k of konten) {
            k.kaempfe += 1;
            if (bericht.sieger === aAufSeite) k.siege += 1;
            else if (bericht.sieger === null) k.unentschieden += 1;
            if (bericht.grund === 'zeit') k.anDerUhr += 1;
            k.dauerSumme += bericht.dauerMs;
          }
        }
      }
    }

    zeilen.push({
      groesse,
      heere: o.heere,
      gleich,
      dauerSchnittMs: konto.kaempfe === 0 ? 0 : Math.round(konto.dauerSumme / konto.kaempfe),
      ...bilanz(konto),
    });
  }

  return {
    zeilen,
    gesamt: bilanz(gesamt),
    heere: heereGesamt,
    gleich: gleichGesamt,
    jeRolle: new Map([...jeRolle].map(([rolle, k]) => [rolle, bilanz(k)])),
  };
}
