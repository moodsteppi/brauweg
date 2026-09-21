/**
 * Die Tauschprobe: dieselbe Einheit, dasselbe Brett, derselbe Gegner.
 *
 * ANLASS. Die Spalte "Siegquote je Einheit auf dem letzten Brett"
 * (`test/messen.ts`) beantwortet die Frage "ist diese Einheit zu stark"
 * nachweislich nicht. Der Gegenbeweis ist gemessen und steht in der neunten
 * Messung (docs/spiele/auto-battler-konzept.md): Schwaecht man die
 * Lichtwahrerin, STEIGT ihre Siegquote (82,4 -> 82,8 -> 88,5 %), weil der Bot
 * sie seltener kauft und die verbleibenden Bretter die reichen sind. Wer nach
 * dieser Spalte am Katalog dreht, dreht in die falsche Richtung.
 *
 * Zwei Auswege gibt es, und sie beheben verschiedene Haelften des Problems:
 *
 *   1. `einheitenNormiert` in messen.ts rechnet die rohe Quote gegen Bretter
 *      GLEICHER KOSTENSUMME. Das nimmt den Wohlstand heraus, aber nicht die
 *      Auswahl: Wen der Bot nie kauft, hat weiter keine Zeile, und wo er eine
 *      Einheit nur in einer bestimmten Brettart kauft, misst auch dieser
 *      Index diese Brettart mit.
 *   2. Diese Probe nimmt die Auswahl ganz heraus. Sie nimmt ECHTE
 *      Schlussbretter aus einem Botlauf, sucht darauf einen Platz einer
 *      Kostenstufe und besetzt ihn REIHUM mit jeder Einheit dieser Stufe.
 *      Jede Einheit bekommt damit dieselben Bretter, dieselben Gegner und
 *      dieselben Saaten; die Antrittszahl ist fuer alle Zeilen einer Stufe
 *      Ziffer fuer Ziffer gleich. Was die Zeilen unterscheidet, ist genau
 *      eine Einheit auf genau einem Platz.
 *
 * WAS SIE VOM MONOKULTUR-TURNIER (test/turnier.ts) UNTERSCHEIDET. Dort treten
 * drei Kopien derselben Einheit gegen drei Kopien einer anderen an — ein
 * Brett, das niemand bauen wuerde, mit Marken, die immer auf ihrer eigenen
 * Schwelle stehen. Hier ist das Brett ein gespieltes: gemischte Rollen,
 * gewachsene Sternstufen, Marken in der Zusammensetzung, in der sie im Spiel
 * vorkommen. Das Turnier misst die Einheit im luftleeren Raum, diese Probe
 * misst sie an ihrem Platz.
 *
 * WAS SIE NICHT MISST. Ob der Bot die Einheit ueberhaupt kaufen WUERDE, und
 * was sie kostet. Eine Einheit kann hier gut abschneiden und trotzdem selten
 * auf einem Brett stehen; beides zusammen liest man aus dieser Tabelle und
 * den Antritten der Ausgewogenheits-Messung. Und: Getauscht wird gegen die
 * Einheiten DERSELBEN Kostenstufe. Die Zahl sagt also "besser als ihr Preis",
 * nicht "besser als alles".
 *
 * DETERMINISMUS: keine Uhr, kein `Math.random`, kein Zustand zwischen zwei
 * Kaempfen. Die Saat haengt an Saatbasis, Kostenstufe, Kontextnummer, Seite
 * und laufender Nummer — ausdruecklich NICHT an der eingesetzten Einheit,
 * sonst bekaeme jede Zeile einen anderen Erstzieher und der Vergleich waere
 * keiner mehr (game-api, Grundsatz 1).
 */

import {
  type Brettseite,
  type EinheitId,
  type Kaempfer,
  type Kampfregler,
  type Kosten,
  KOSTENSTUFEN,
  type Rolle,
  STANDARD_REGLER,
  type TafelrundeRegeln,
  einheit,
  einheitenMitKosten,
  simuliereKampf,
} from '../src/index.js';
import { type Besetzung, VIER_SITZE, brettwert, messe } from './messen.js';

// ---------------------------------------------------------------------------
// Was hineingeht
// ---------------------------------------------------------------------------

export interface Tauschoptionen {
  /** Wie viele Partien die Bretter liefern. Jede liefert eines je Sitz. */
  readonly partien?: number;
  readonly sitze?: readonly number[];
  readonly besetzung?: Besetzung;
  readonly saatBasis?: string;
  /**
   * Wie viele Bretter je Kostenstufe getauscht werden.
   *
   * Der Nenner einer Zeile ist `kontexte * 2 * saaten` — zwei, weil jeder
   * Kontext auf beiden Seiten antritt.
   */
  readonly kontexte?: number;
  /** Saaten je Kontext und Seite. Jede wuerfelt den Erstzieher neu. */
  readonly saaten?: number;
  readonly regler?: Kampfregler;
  readonly regeln?: TafelrundeRegeln;
}

interface Vollstaendig extends Required<Omit<Tauschoptionen, 'regeln'>> {
  readonly regeln?: TafelrundeRegeln;
}

function vollstaendig(o: Tauschoptionen): Vollstaendig {
  const kontexte = o.kontexte ?? 200;
  const saaten = o.saaten ?? 1;
  if (!Number.isInteger(kontexte) || kontexte < 1) {
    throw new Error(`kontexte muss eine ganze Zahl ab 1 sein, nicht ${kontexte}`);
  }
  if (!Number.isInteger(saaten) || saaten < 1) {
    throw new Error(`saaten muss eine ganze Zahl ab 1 sein, nicht ${saaten}`);
  }
  return {
    partien: o.partien ?? 300,
    sitze: o.sitze ?? VIER_SITZE,
    besetzung: o.besetzung ?? 'normal',
    saatBasis: o.saatBasis ?? 'tausch-v1',
    kontexte,
    saaten,
    regler: o.regler ?? STANDARD_REGLER,
    regeln: o.regeln,
  };
}

// ---------------------------------------------------------------------------
// Was herauskommt
// ---------------------------------------------------------------------------

export interface Tauschzeile {
  readonly id: EinheitId;
  readonly name: string;
  readonly kosten: Kosten;
  readonly rolle: Rolle;
  /** Fuer alle Zeilen einer Kostenstufe dieselbe Zahl — das ist der Zweck. */
  readonly kaempfe: number;
  /** Siege der Seite, auf der die eingesetzte Einheit stand. */
  readonly siege: number;
  readonly unentschieden: number;
  readonly anDerUhr: number;
  readonly quote: number | null;
  /**
   * Der Schadenssaldo je Kampf: zugefuegter minus erlittener Rundenschaden
   * (`Kampfbericht.schaden`, die Zahl, die der Verlierer an Leben abgibt).
   *
   * WOZU NEBEN DER QUOTE: Die Quote wirft jeden Kampf auf eine Null oder eine
   * Eins und verliert dabei den Unterschied zwischen knapp und deutlich. Der
   * Saldo behaelt ihn — er ist bei gleicher Zahl Kaempfe die ruhigere Zahl
   * und schlaegt frueher aus. Und er ist die Groesse, um die es im Spiel
   * wirklich geht: Ausgeschieden wird nach Leben, nicht nach Siegen.
   */
  readonly saldo: number;
  /**
   * Quote geteilt durch den Schnitt ihrer Kostenstufe.
   *
   * 1,00 heisst: genau so gut wie der Durchschnitt dessen, was man fuer
   * dasselbe Gold auf denselben Platz stellen koennte.
   */
  readonly index: number | null;
}

export interface Tauschstufe {
  readonly kosten: Kosten;
  /** Wie viele echte Bretter getauscht wurden. */
  readonly kontexte: number;
  readonly kaempfe: number;
  /** Mittel der Zeilenquoten — der Massstab fuer `index`. */
  readonly schnitt: number;
  readonly zeilen: readonly Tauschzeile[];
}

export interface Tauschbefund {
  readonly stufen: readonly Tauschstufe[];
  readonly kaempfe: number;
  /** Wie viele Schlussbretter der Botlauf insgesamt hergab. */
  readonly bretter: number;
}

// ---------------------------------------------------------------------------
// Die Bretter
// ---------------------------------------------------------------------------

/**
 * Alle Schlussbretter eines Botlaufs, in fester Reihenfolge.
 *
 * `letzteBretter` und nicht der Endzustand: Wer ausscheidet, gibt sein Brett
 * in den Vorrat zurueck (siehe Partiebefund in messen.ts). Die Reihenfolge ist
 * Partie fuer Partie, darin Sitz fuer Sitz — deterministisch, damit zwei
 * Laeufe dieselben Kontexte ziehen.
 */
export function schlussbretter(o: Tauschoptionen = {}): Brettseite[] {
  const v = vollstaendig(o);
  const befunde = messe({
    partien: v.partien,
    sitze: v.sitze,
    besetzung: v.besetzung,
    saatBasis: v.saatBasis,
    regeln: v.regeln,
    regler: v.regler,
  });
  const bretter: Brettseite[] = [];
  for (const b of befunde) {
    for (const sitz of [...v.sitze].sort((x, y) => x - y)) {
      const brett = b.letzteBretter[sitz];
      if (brett) bretter.push(brett as readonly (Kaempfer | null)[]);
    }
  }
  return bretter;
}

/**
 * Der Platz, der getauscht wird: der erste Platz des Bretts mit einer Einheit
 * dieser Kostenstufe. `-1`, wenn es keinen gibt.
 *
 * Der ERSTE und kein zufaelliger: Zufall an dieser Stelle waere eine zweite
 * Quelle von Rauschen, die nichts erklaert. Dass es damit oft der vordere
 * Platz ist, macht den Vergleich nicht schief — alle Zeilen einer Stufe
 * bekommen ja genau denselben Platz.
 */
function tauschplatz(brett: Brettseite, kosten: Kosten): number {
  return brett.findIndex((k) => k !== null && einheit(k.id).kosten === kosten);
}

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

interface Konto {
  kaempfe: number;
  siege: number;
  unentschieden: number;
  anDerUhr: number;
  /** Zugefuegter minus erlittener Rundenschaden, aufsummiert. */
  saldo: number;
}

function stufeRechnen(kosten: Kosten, bretter: readonly Brettseite[], v: Vollstaendig): Tauschstufe {
  const einheiten = einheitenMitKosten(kosten);
  const konten = new Map<EinheitId, Konto>(
    einheiten.map((e) => [e.id, { kaempfe: 0, siege: 0, unentschieden: 0, anDerUhr: 0, saldo: 0 }]),
  );

  /*
   * Die Kontexte: Brett, Tauschplatz und Gegner.
   *
   * DER GEGNER IST DAS BRETT MIT DEM NAECHSTLIEGENDEN BRETTWERT, und das ist
   * keine Schoenheit, sondern der Punkt, an dem die Probe ihre Aussagekraft
   * gewinnt. Ein beliebiger Gegner aus dem Topf ergibt fuer teure Bretter
   * Kaempfe, die zu ueber 85 % ohnehin gewonnen werden — und ein Platz, der
   * so gut wie nie entscheidet, trennt die Zeilen nicht mehr. Gegen einen
   * gleich teuren Gegner steht der Kampf auf der Kippe, und genau dort faellt
   * auf, welche Einheit auf dem Platz mehr taugt.
   */
  const nachWert = [...bretter]
    .map((brett, i) => ({ brett, i, wert: brettwert(brett) }))
    .sort((a, b) => a.wert - b.wert || a.i - b.i);
  const gegnerVon = new Map<Brettseite, Brettseite>();
  for (const [rang, eintrag] of nachWert.entries()) {
    /*
     * Gepaart wird 0 mit 1, 2 mit 3 und so fort (`rang ^ 1`) — gegenseitig
     * und nicht "jeder gegen den naechsten". Sonst traete JEDES Brett gegen
     * ein etwas teureres an, und der Schnitt der ganzen Stufe laege unter
     * 50 %, ohne dass an den Einheiten etwas liegt.
     */
    const nachbar = nachWert[rang ^ 1] ?? nachWert[rang - 1];
    if (nachbar) gegnerVon.set(eintrag.brett, nachbar.brett);
  }

  const kontexte: { brett: Brettseite; platz: number; gegner: Brettseite }[] = [];
  for (const brett of bretter) {
    if (kontexte.length >= v.kontexte) break;
    const platz = tauschplatz(brett, kosten);
    if (platz < 0) continue;
    const gegner = gegnerVon.get(brett);
    // Ein Brett gegen sich selbst waere ein Kampf, den allein der Erstzieher
    // entscheidet. Kommt vor, wenn zwei Sitze dasselbe Brett gebaut haben.
    if (!gegner || gegner === brett) continue;
    kontexte.push({ brett, platz, gegner });
  }

  let kaempfe = 0;
  for (const [nr, kontext] of kontexte.entries()) {
    const stufe = kontext.brett[kontext.platz]!.stufe;
    for (const e of einheiten) {
      const getauscht = [...kontext.brett];
      // Die Sternstufe bleibt die des Platzes: Sonst vergliche man eine
      // Einheit auf Stufe 1 mit einer verschmolzenen und nennte den
      // Unterschied das Ergebnis.
      getauscht[kontext.platz] = { id: e.id, stufe };
      const konto = konten.get(e.id)!;
      for (const seite of [0, 1] as const) {
        for (let n = 0; n < v.saaten; n++) {
          const bretterPaar: readonly [Brettseite, Brettseite] =
            seite === 0 ? [getauscht, kontext.gegner] : [kontext.gegner, getauscht];
          const bericht = simuliereKampf(
            bretterPaar,
            `${v.saatBasis}:tausch:${kosten}:${nr}:${seite}:${n}`,
            v.regler,
          );
          konto.kaempfe += 1;
          if (bericht.sieger === seite) {
            konto.siege += 1;
            konto.saldo += bericht.schaden;
          } else if (bericht.sieger === null) konto.unentschieden += 1;
          else konto.saldo -= bericht.schaden;
          if (bericht.grund === 'zeit') konto.anDerUhr += 1;
          kaempfe += 1;
        }
      }
    }
  }

  const roh = einheiten.map((e) => {
    const k = konten.get(e.id)!;
    return { e, k, quote: k.kaempfe === 0 ? null : k.siege / k.kaempfe };
  });
  const gezaehlt = roh.filter((z) => z.quote !== null);
  const schnitt =
    gezaehlt.length === 0 ? 0 : gezaehlt.reduce((s, z) => s + z.quote!, 0) / gezaehlt.length;

  const zeilen = roh
    .map(({ e, k, quote }) => ({
      id: e.id,
      name: e.name,
      kosten: e.kosten,
      rolle: e.rolle,
      kaempfe: k.kaempfe,
      siege: k.siege,
      unentschieden: k.unentschieden,
      anDerUhr: k.anDerUhr,
      quote,
      saldo: k.kaempfe === 0 ? 0 : k.saldo / k.kaempfe,
      index: quote === null || schnitt === 0 ? null : quote / schnitt,
    }))
    .sort((x, y) => (y.quote ?? -1) - (x.quote ?? -1));

  return { kosten, kontexte: kontexte.length, kaempfe, schnitt, zeilen };
}

/**
 * Die ganze Probe ueber alle Kostenstufen.
 *
 * Die Bretter werden EINMAL gespielt und von allen Stufen benutzt: Ein
 * eigener Botlauf je Kostenstufe kostete die dreifache Zeit und ergaebe
 * dieselben Bretter.
 */
export function tauschprobe(optionen: Tauschoptionen = {}): Tauschbefund {
  const v = vollstaendig(optionen);
  const bretter = schlussbretter(optionen);
  const stufen = KOSTENSTUFEN.map((kosten) => stufeRechnen(kosten, bretter, v));
  return {
    stufen,
    kaempfe: stufen.reduce((s, z) => s + z.kaempfe, 0),
    bretter: bretter.length,
  };
}

/** Eine einzelne Zeile herausgesucht — fuer Proben und fuer Vergleichslaeufe. */
export function zeileVon(befund: Tauschbefund, id: EinheitId): Tauschzeile | null {
  for (const stufe of befund.stufen) {
    const treffer = stufe.zeilen.find((z) => z.id === id);
    if (treffer) return treffer;
  }
  return null;
}
