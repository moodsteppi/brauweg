/**
 * Sagt die Bot-Bewertung voraus, was im Kampf wirklich gewinnt?
 *
 * ANLASS: Am 05.09.2026 stand auf dem Issueboard, `staerke` multipliziere
 * Aushalten mal Austeilen und sage die Turnier-Rangfolge nicht vorher. Das
 * liess sich damals nur von Hand nachrechnen, und weil niemand ein Werkzeug
 * dafuer hatte, blieb die Karte zwei Wochen offen und wurde dreimal mit
 * verschiedenen Zahlen kommentiert. Beim Aufarbeiten am 22.09.2026 war der
 * Befund dann teils verfallen — die Arena war inzwischen tiefer geworden, und
 * die Rangfolge, auf die sich die Karte stuetzte, gab es nicht mehr.
 *
 * GENAU DAS SOLL DIESE PROBE VERHINDERN. Sie stellt die eine Frage, die man
 * sonst schaetzt: Wenn der Bot Einheit A hoeher bewertet als B — gewinnt A
 * dann auch mehr Kaempfe? Gemessen wird die Rangkorrelation (Spearman)
 * zwischen `staerke` und der Siegquote aus dem Monokultur-Turnier, je
 * Kostenstufe.
 *
 * ZWEI LESARTEN, UND DER UNTERSCHIED IST DER GANZE WITZ. `staerke` nimmt die
 * Deckung als Parameter, und in der Vorgabe steht `KEINE_DECKUNG` — dann
 * zaehlt die Reichweite gar nicht. Beide Zahlen stehen deshalb nebeneinander:
 *
 *   mitDeckung   was die Einheit in einem gedeckten Mischheer wert ist
 *   ohneDeckung  was `staerke({ id, stufe: 1 })` liefert, also das, was ein
 *                Mensch beim Vergleichen zweier Einheiten in der Hand haelt
 *
 * WAS SIE NICHT SAGT — derselbe Vorbehalt wie bei turnier.ts, und er gilt hier
 * doppelt: Das Monokultur-Turnier ist nicht "das Spiel". Drei Kopien derselben
 * Einheit sind kein Brett, das jemand bauen wuerde, und der Bot kauft nicht
 * nach `staerke` allein (Verschmelzungen, Marken und `umfeldGewinn` stehen
 * daneben). Eine schlechte Korrelation heisst also NICHT, dass der Bot
 * schlecht spielt — ob er das tut, beantwortet `werkzeug/gangarten.mjs` und
 * sonst nichts. Sie heisst: Wer diese Zahl zum Balancieren liest, wird in die
 * Irre gefuehrt.
 *
 * DETERMINISMUS: Sie rechnet aus `turnier()` und sonst nichts — keine Uhr,
 * kein `Math.random`. Derselbe Aufruf liefert dieselben Zahlen.
 */

import { type EinheitId, type Kosten, type Rolle } from '../src/index.js';
import { KEINE_DECKUNG, VOLLE_DECKUNG, staerke } from '../src/bot.js';
import { type Turnieroptionen, turnier } from './turnier.js';

// ---------------------------------------------------------------------------
// Spearman
// ---------------------------------------------------------------------------

/**
 * Die Raenge einer Reihe, Gleichstaende auf ihrem Mittelrang.
 *
 * Der Mittelrang ist kein Beiwerk: Bei acht Einheiten je Kostenstufe teilen
 * sich regelmaessig zwei Zeilen dieselbe Siegquote (bei 70 Kaempfen sind das
 * ganze Prozentschritte). Wer Gleichstaende einfach der Reihe nach
 * durchnummeriert, bekommt eine Korrelation, die von der Sortierung der
 * Eingabe abhaengt — und damit eine Zahl, die sich beim naechsten
 * Katalogeintrag ohne Grund bewegt.
 */
function raenge(werte: readonly number[]): number[] {
  const sortiert = werte.map((w, i) => [w, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(werte.length);
  let i = 0;
  while (i < sortiert.length) {
    let j = i;
    while (j + 1 < sortiert.length && sortiert[j + 1]![0] === sortiert[i]![0]) j += 1;
    const mittel = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) r[sortiert[k]![1]] = mittel;
    i = j + 1;
  }
  return r;
}

/**
 * Rangkorrelation nach Spearman: +1 gleiche Reihenfolge, -1 umgekehrte, 0 kein
 * Zusammenhang. `null`, wenn eine Seite gar keine Streuung hat — dann gibt es
 * keine Reihenfolge, die man vergleichen koennte, und eine 0 waere gelogen.
 */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length) throw new Error('Spearman braucht zwei gleich lange Reihen');
  if (xs.length < 2) return null;
  const a = raenge(xs);
  const b = raenge(ys);
  const mittel = (v: readonly number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mittel(a);
  const mb = mittel(b);
  let zaehler = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i += 1) {
    zaehler += (a[i]! - ma) * (b[i]! - mb);
    sa += (a[i]! - ma) ** 2;
    sb += (b[i]! - mb) ** 2;
  }
  if (sa === 0 || sb === 0) return null;
  return zaehler / Math.sqrt(sa * sb);
}

// ---------------------------------------------------------------------------
// Was herauskommt
// ---------------------------------------------------------------------------

export interface Bewertungszeile {
  readonly id: EinheitId;
  readonly name: string;
  readonly rolle: Rolle;
  /** Siegquote im Monokultur-Turnier, 0 bis 1. */
  readonly quote: number;
  readonly mitDeckung: number;
  readonly ohneDeckung: number;
}

export interface Bewertungsstufe {
  readonly kosten: Kosten;
  /** Spearman gegen die Siegquote, `staerke` mit `VOLLE_DECKUNG`. */
  readonly mitDeckung: number | null;
  /** Dasselbe mit `KEINE_DECKUNG` — der Vorgabe von `staerke`. */
  readonly ohneDeckung: number | null;
  /** Absteigend nach Siegquote, wie im Turnier. */
  readonly zeilen: readonly Bewertungszeile[];
}

export interface Bewertungsbefund {
  readonly stufen: readonly Bewertungsstufe[];
  /** Schnitt ueber die Kostenstufen, die eine Zahl hergaben. */
  readonly mitDeckung: number | null;
  readonly ohneDeckung: number | null;
}

function schnitt(werte: readonly (number | null)[]): number | null {
  const echte = werte.filter((w): w is number => w !== null);
  if (echte.length === 0) return null;
  return echte.reduce((s, w) => s + w, 0) / echte.length;
}

/**
 * Die Probe ueber alle Kostenstufen.
 *
 * Die Sternstufe kommt aus den Turnieroptionen und geht auch in `staerke` —
 * beide Seiten muessen dieselbe Einheit meinen. Beim Turnier ist das
 * `optionen.stufe`, hier derselbe Wert; ein Vergleich von Stufe-1-Staerken
 * gegen Stufe-3-Kaempfe waere lautlos falsch.
 */
export function bewertungsprobe(optionen: Turnieroptionen = {}): Bewertungsbefund {
  const stufe = optionen.stufe ?? 1;
  const befund = turnier(optionen);

  const stufen = befund.stufen.map((s): Bewertungsstufe => {
    const zeilen = s.zeilen
      .filter((z) => z.quote !== null)
      .map((z): Bewertungszeile => ({
        id: z.id,
        name: z.name,
        rolle: z.rolle,
        quote: z.quote!,
        mitDeckung: staerke({ id: z.id, stufe }, undefined, VOLLE_DECKUNG),
        ohneDeckung: staerke({ id: z.id, stufe }, undefined, KEINE_DECKUNG),
      }));
    const quoten = zeilen.map((z) => z.quote);
    return {
      kosten: s.kosten,
      mitDeckung: spearman(zeilen.map((z) => z.mitDeckung), quoten),
      ohneDeckung: spearman(zeilen.map((z) => z.ohneDeckung), quoten),
      zeilen,
    };
  });

  return {
    stufen,
    mitDeckung: schnitt(stufen.map((s) => s.mitDeckung)),
    ohneDeckung: schnitt(stufen.map((s) => s.ohneDeckung)),
  };
}
