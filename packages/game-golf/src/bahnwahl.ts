/**
 * Die Bahnauswahl des Tisches: pruefen, benennen, der Lobby beschreiben.
 *
 * Was aus einer Wahl fuer eine Folge wird, rechnet `waehleBahnen`
 * (bahnen.ts). Hier steht, was drumherum gebraucht wird: ob ein Regelsatz
 * eine gueltige Wahl traegt (fuer `validateConfig`), wie sie in der
 * Tischliste heisst (`variante`), und welche Daten die Lobby braucht, um die
 * Wahl ueberhaupt anbieten zu koennen (`lobbyDaten`).
 */

import type { ConfigProblem } from '@brauweg/game-api';

import { BAHNEN_KATALOG, passendeBahnen } from './bahnen.js';
import {
  BAHN_THEMEN,
  KURSE,
  THEMEN,
  VARIANTE_EIGENE_AUSWAHL,
  istThema,
  kursMitKennung,
  type Kurs,
  type Themeneintrag,
} from './kurse.js';
import { LOECHER_MAX, LOECHER_MIN, type GolfFilter, type GolfRegeln } from './regeln.js';

/** Laenger reicht `varianteVon` (Server) nicht durch. */
export const VARIANTE_MAX = 24;

function istObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Die Bahnauswahl eines Regelsatzes pruefen. Wirft nie — der Regelsatz kommt
 * als JSON von aussen (siehe `validateConfig` in game-api), und
 * `plattform-invarianten.test.ts` bewirft das Modul mit Unsinn.
 *
 * Die Lochzahl wird hier bewusst NICHT gegen die Laenge eines Kurses
 * geprueft: Ein Online-Tisch entsteht mit neun Loechern, und die Wahl kommt
 * erst in der Lobby; beim Start stellt die Lobby die Lochzahl gleich, und
 * `waehleBahnen` kommt auch mit einer abweichenden zurecht.
 */
export function pruefeBahnwahl(config: unknown): ConfigProblem[] {
  if (!istObjekt(config)) return [];
  const probleme: ConfigProblem[] = [];
  const gesetzt = ['kurs', 'filter', 'bahnen'].filter((feld) => config[feld] !== undefined);
  if (gesetzt.length > 1) {
    probleme.push({ path: 'config', messageKey: 'ruleset.golf.auswahlDoppelt', severity: 'error' });
  }

  if (config.kurs !== undefined && kursMitKennung(config.kurs) === undefined) {
    probleme.push({ path: 'config.kurs', messageKey: 'ruleset.golf.kursUnbekannt', severity: 'error' });
  }

  if (config.filter !== undefined) {
    const filter = config.filter;
    const stufen = istObjekt(filter) ? filter.schwierigkeit : undefined;
    const thema = istObjekt(filter) ? filter.thema : undefined;
    const stufenGut =
      stufen === undefined ||
      (Array.isArray(stufen) &&
        stufen.every((s) => Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 5));
    const themaGut = thema === undefined || istThema(thema);
    if (!istObjekt(filter) || !stufenGut || !themaGut) {
      probleme.push({ path: 'config.filter', messageKey: 'ruleset.golf.filterUngueltig', severity: 'error' });
    } else if (passendeBahnen(filter as GolfFilter).length === 0 && (stufen !== undefined || thema !== undefined)) {
      // Erlaubt, aber nicht, was man meint: gezogen wird dann aus allen Bahnen.
      probleme.push({ path: 'config.filter', messageKey: 'ruleset.golf.filterLeer', severity: 'warning' });
    }
  }

  if (config.bahnen !== undefined) {
    const liste = config.bahnen;
    const bekannt = new Set(BAHNEN_KATALOG.map((b) => b.id));
    if (
      !Array.isArray(liste) ||
      !liste.every((id) => typeof id === 'string' && bekannt.has(id)) ||
      new Set(liste).size !== liste.length
    ) {
      probleme.push({ path: 'config.bahnen', messageKey: 'ruleset.golf.bahnenUngueltig', severity: 'error' });
    } else if (liste.length < LOECHER_MIN || liste.length > LOECHER_MAX) {
      probleme.push({ path: 'config.bahnen', messageKey: 'ruleset.golf.bahnenAnzahl', severity: 'error' });
    }
  }

  if (config.variante !== undefined) {
    const v = config.variante;
    if (typeof v !== 'string' || v.length === 0 || v.length > VARIANTE_MAX) {
      probleme.push({ path: 'config.variante', messageKey: 'ruleset.golf.varianteUngueltig', severity: 'error' });
    }
  }
  return probleme;
}

/** Stufen als kurzer Text: „Stufe 3–5", „Stufe 2", „Stufe 1, 3, 5". */
function stufenText(stufen: readonly number[]): string {
  const s = [...new Set(stufen)].sort((a, b) => a - b);
  if (s.length === 1) return `Stufe ${s[0]}`;
  const zusammenhaengend = s.every((wert, i) => i === 0 || wert === s[i - 1]! + 1);
  return zusammenhaengend ? `Stufe ${s[0]}–${s[s.length - 1]}` : `Stufe ${s.join(', ')}`;
}

/**
 * Die Spielart eines Regelsatzes fuer die Tischliste: Kursname, „Eigene
 * Auswahl" oder der Filter in Worten; `null` ohne Wahl (freie Ziehung).
 *
 * Die Lobby schreibt das Ergebnis als `variante` in den Regelsatz — der
 * Server liest es dort (`varianteVon`), ohne Golf zu kennen. Der Client hat
 * dieselbe Rechnung (minispiele/golf/bahnwahl.ts), weil er das Modul nicht
 * importiert; `vertrag/golf-kurse.test.ts` vergleicht beide ueber alle
 * Filter. Laenger als 24 Zeichen wird es nie — dann steht die kurze Form da.
 */
export function varianteFuer(regeln: GolfRegeln): string | null {
  if (!istObjekt(regeln)) return null;
  if (regeln.kurs !== undefined) return kursMitKennung(regeln.kurs)?.name ?? null;
  if (regeln.bahnen !== undefined) return VARIANTE_EIGENE_AUSWAHL;
  const filter = regeln.filter;
  if (!istObjekt(filter)) return null;
  const stufen = Array.isArray(filter.schwierigkeit) ? filter.schwierigkeit : [];
  const thema = THEMEN.find((t) => t.kennung === filter.thema)?.name ?? null;
  let text: string;
  if (thema !== null && stufen.length > 0) text = `${thema} · ${stufenText(stufen)}`;
  else if (thema !== null) text = `Nur ${thema}`;
  else if (stufen.length > 0) text = stufenText(stufen);
  else return null;
  return text.length <= VARIANTE_MAX ? text : 'Gefilterte Auswahl';
}

/** Was die Lobby vor der Partie braucht, um die Bahnauswahl anzubieten. */
export interface GolfLobbyDaten {
  readonly kurse: readonly Kurs[];
  readonly themen: readonly Themeneintrag[];
  readonly bahnThemen: Readonly<Record<string, readonly string[]>>;
  /** Die Spielart einer Einzelauswahl — dasselbe Wort wie in der Tischliste. */
  readonly eigeneAuswahl: string;
}

export function lobbyDaten(): GolfLobbyDaten {
  return { kurse: KURSE, themen: THEMEN, bahnThemen: BAHN_THEMEN, eigeneAuswahl: VARIANTE_EIGENE_AUSWAHL };
}
