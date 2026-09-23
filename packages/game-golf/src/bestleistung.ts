/**
 * Bestleistung je Bahn: was Golf am Partieende an die Plattform meldet.
 *
 * Seit dem 22.09.2026 (Robins Entscheidung G6, Bestenliste je Bahn zuerst).
 * Den Unterbau — Tabelle, Schreibhaken, Leseweg, die Regel, welcher Tisch
 * zaehlt — baut der Server (`packages/server/src/bestleistung.ts`,
 * `docs/BESTLEISTUNG.md`). Hier steht nur, WELCHE Zahlen Golf dafuer
 * hergibt: je Sitz und Loch `{ inhaltId: <Bahnkennung>, wert: Schlaege,
 * richtung: 'tief' }` in `standings[i].bestleistungen`.
 *
 * **Die Schlagzahlen je Loch kennt der Server sonst nicht.** Die Physik
 * laeuft auf den Geraeten; gemeldet wurden bis heute nur die Summen je Sitz
 * und eine Pruefsumme ueber die ganze Tafel `[loch][sitz]`. Seitdem schickt
 * jedes Geraet die Tafel selbst mit (`jeLoch` an der Ergebnismeldung). Sie
 * zaehlt aber nur, wenn sie zu genau dem passt, was auch den Platz
 * entscheidet (`waehleLochwerte`):
 *
 *   1. Der Ausgang ist nicht strittig — ohne Mehrheit gibt es keinen Platz,
 *      also auch keine Bestleistung.
 *   2. Die Tafel stammt aus der Mehrheitsgruppe (gleiche Pruefsumme, mehr
 *      als die Haelfte der Meldungen), und ihre Pruefsumme, HIER
 *      nachgerechnet, ist genau die der Gruppe. Eine Tafel, die jemand
 *      neben einer abgeschriebenen Pruefsumme frei erfindet, faellt daran
 *      durch.
 *   3. Ihre Zeilensummen sind je Sitz genau die Schlaege des Ausgangs. Eine
 *      Bahnbestleistung, die nicht in die Summe eingeht, die den Platz
 *      bestimmt, gibt es nicht.
 *   4. Das Loch ist eingelocht. Dafuer schickt jedes Geraet neben der Tafel
 *      die Kennzeichen `eingelocht` `[loch][sitz]` mit — ein nicht
 *      eingelochtes Loch steht in der Tafel als Schlaglimit + 1 und wird nie
 *      gespeichert.
 *
 * Nur ein Modul ohne Uhr und Zufall: alles hier ist eine reine Funktion des
 * Partiezustands.
 */

import type { GolfMeldung, GolfPartie } from './partie.js';
import { mehrheitsgruppe } from './partie.js';
import { modusVon } from './modus.js';
import type { GolfRegeln } from './regeln.js';

/** Die Form, die `packages/server/src/bestleistung.ts` erwartet (`Bestleistungsmeldung`). */
export interface GolfBestleistung {
  readonly inhaltId: string;
  readonly wert: number;
  readonly richtung: 'tief';
}

/**
 * DER HAKEN FUER DEN FUN-MODUS. Zaehlt eine Partie mit diesem Regelsatz fuer
 * die Bestenliste je Bahn?
 *
 * Klassisch ja, im Fun-Modus (seit dem 23.09.2026, `modus.ts`) nein. Die
 * Felder der Bahnauswahl (#212) waehlen nur, WELCHE Bahnen gespielt werden —
 * jede davon bleibt dieselbe Bahn. Der Fun-Modus mit Wind, Wetter und
 * Roulette je Loch gibt hier `false` zurueck — und zwar hier, im Modul, nicht am
 * Bildschirm und nicht im Server. Der Grund: Eine Bestenliste vergleicht
 * Schlagzahlen auf DERSELBEN Bahn. Mit Rueckenwind oder einem Glueckstreffer
 * aus dem Ereigniswurf ist es nicht mehr dieselbe Bahn, und die Liste
 * gehoerte dem, der das beste Wetter erwischt hat, statt dem, der am besten
 * spielt. Der Server kennt die Regeln der Spiele nicht (`docs/BESTLEISTUNG.md`)
 * — er traegt ein, was das Modul meldet, also muss das Modul hier schweigen.
 *
 * Gast am Tisch und `training` sind KEIN Fall fuer diesen Haken: Das
 * entscheidet `countsForRanking` im Server fuer alle Spiele gleich, und die
 * Regel wird dort aufgerufen, nicht hier abgeschrieben.
 */
export function zaehltFuerBestleistung(regeln: GolfRegeln): boolean {
  return modusVon(regeln) === 'klassisch';
}

// ---------------------------------------------------------------------------
// Pruefsumme — dieselbe Rechnung wie `pruefsumme` im Client
// ---------------------------------------------------------------------------

/*
 * Bewusst eine Abschrift von `fnv1a` (client `minispiele/golf/zufall.ts`) und
 * `pruefsumme` (client `minispiele/golf/physik.ts`) statt eines Imports — das
 * Modul zieht nichts aus dem Client (siehe bahnen.ts, dieselbe Begruendung).
 * Gleich bleiben MUSS sie: Rechnete sie anders, fiele jede ehrliche Tafel
 * durch, und es gaebe lautlos keine einzige Bestleistung mehr. Der Vertrag
 * `packages/client/src/vertrag/golf-bestleistung.test.ts` haelt beide
 * Rechnungen gegeneinander.
 */

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Pruefsumme ueber alle Schlagzahlen je Loch je Sitz, wie die Geraete sie melden. */
export function pruefsummeDerTafel(jeLoch: readonly (readonly number[])[]): string {
  const teile: string[] = [];
  for (const reihe of jeLoch) teile.push(reihe.join(','));
  return fnv1a(teile.join(';'));
}

// ---------------------------------------------------------------------------
// Welche Tafel zaehlt
// ---------------------------------------------------------------------------

function summenPassen(tafel: readonly (readonly number[])[], schlaege: readonly number[]): boolean {
  for (let s = 0; s < schlaege.length; s += 1) {
    let summe = 0;
    for (const reihe of tafel) summe += reihe[s] ?? 0;
    if (summe !== schlaege[s]) return false;
  }
  return true;
}

/**
 * Welche Loecher als eingelocht gelten, `[loch][sitz]` — oder `null`, wenn
 * keine Meldung der Gruppe es sagt.
 *
 * Die Kennzeichen stehen nicht in der Pruefsumme (die bleibt ueber die
 * Schlagzahlen, wie alle Geraete sie seit jeher rechnen). Deshalb zaehlt ein
 * Loch nur als eingelocht, wenn JEDE Meldung der Gruppe, die Kennzeichen
 * traegt, es so sagt: Ein einzelnes Geraet kann damit eine Bestleistung nur
 * wegnehmen, nie eine erfinden. Ehrliche Geraete rechnen aus derselben
 * Zugliste dieselben Baelle und sagen ohnehin alle dasselbe.
 */
function eingelochtLaut(
  gruppe: readonly GolfMeldung[],
  loecher: number,
  sitze: number,
): boolean[][] | null {
  let ergebnis: boolean[][] | null = null;
  for (const m of gruppe) {
    const k = m.eingelocht;
    if (k === undefined || k.length !== loecher) continue;
    if (ergebnis === null) {
      ergebnis = Array.from({ length: loecher }, () => new Array<boolean>(sitze).fill(true));
    }
    for (let loch = 0; loch < loecher; loch += 1) {
      for (let s = 0; s < sitze; s += 1) {
        if (k[loch]?.[s] !== true) ergebnis[loch]![s] = false;
      }
    }
  }
  return ergebnis;
}

export interface Lochwerte {
  /** `[loch][sitz]` Schlaege, genau die Tafel hinter Pruefsumme und Ausgang. */
  readonly schlaege: readonly (readonly number[])[];
  /** `[loch][sitz]` ob der Ball gefallen ist (siehe `eingelochtLaut`). */
  readonly eingelocht: readonly (readonly boolean[])[];
}

/**
 * Die Tafel `[loch][sitz]`, die fuer die Bestleistung zaehlt, mit ihren
 * Eingelocht-Kennzeichen — oder `null`.
 *
 * Gesucht wird in der Mehrheitsgruppe, die auch den Ausgang gestellt hat
 * (`mehrheitsgruppe` in partie.ts, dieselbe Funktion, nicht nachgebaut),
 * vom niedrigsten Sitz an: die erste Meldung, deren Tafel zur Pruefsumme der
 * Gruppe und zu den Schlaegen des Ausgangs passt. Nicht nur der niedrigste
 * Sitz selbst — der koennte noch ein Geraet von vor dem 22.09.2026 sein,
 * das gar keine Tafel schickt, und dann bekaeme der ganze Tisch nichts.
 *
 * Ohne Kennzeichen ebenfalls `null`: Ein nicht eingelochtes Loch steht in der
 * Tafel als Schlaglimit + 1 und laesst sich ohne Kennzeichen von einem echten
 * Ergebnis nicht unterscheiden — der Server kennt das Schlaglimit nicht.
 * Lieber gar keine Bestleistung als eine aus einem Strafwert.
 */
export function waehleLochwerte(partie: GolfPartie): Lochwerte | null {
  const ausgang = partie.ausgang;
  if (ausgang === null || ausgang.strittig) return null;
  const gruppe = mehrheitsgruppe(partie.meldungen);
  if (gruppe === null) return null;
  const eingelocht = eingelochtLaut(gruppe, partie.bahnen.length, partie.sitze);
  if (eingelocht === null) return null;
  const nachSitz = [...gruppe].sort((a, b) => a.sitz - b.sitz);
  for (const m of nachSitz) {
    const tafel = m.jeLoch;
    if (tafel === undefined) continue;
    if (tafel.length !== partie.bahnen.length) continue;
    if (pruefsummeDerTafel(tafel) !== m.pruef) continue;
    if (!summenPassen(tafel, ausgang.schlaege)) continue;
    return { schlaege: tafel, eingelocht };
  }
  return null;
}

/**
 * Die Meldungen je Sitz, Index = Sitz. Leere Listen fuer alle, die nichts
 * bekommen:
 *
 *   - Nicht eingelochte Loecher: Sie stehen als Schlaglimit + 1 in der Tafel
 *     und sind nie eine Bestleistung — auch nicht voruebergehend als erster
 *     Rekord auf einer Bahn, die noch niemand gespielt hat.
 *   - Bot-Sitze: Sie haben kein Konto (der Server uebergaebe sie ohnehin),
 *     und eine Bahn, auf der ein Bot den Rekord haelt, waere keine Liste
 *     von Spielern.
 *   - Ausgestiegene: Ab dem Loch nach dem Ausstieg traegt ihr Geraet fuer sie
 *     das Schlaglimit + 1 ein (physik.ts, `starteLoch`), und das Loch, in dem
 *     sie gingen, endet genauso. Welche Loecher davor echt gespielt waren,
 *     weiss der Server nicht — `abZug` zaehlt Schlaege, keine Loecher.
 *     Lieber keine Bestleistung als eine, die aus einem Strafwert stammt.
 *   - Werte unter 1: Ein Loch mit null Schlaegen gibt es nicht; so eine
 *     Zahl kann nur ein Sitz sein, der das Loch nie gespielt hat.
 */
export function bestleistungenJeSitz(partie: GolfPartie): GolfBestleistung[][] {
  const jeSitz = Array.from({ length: partie.sitze }, (): GolfBestleistung[] => []);
  if (!zaehltFuerBestleistung(partie.regeln)) return jeSitz;
  const werte = waehleLochwerte(partie);
  if (werte === null) return jeSitz;
  const tafel = werte.schlaege;

  const ohne = new Set<number>([...partie.botSitze, ...partie.ausstiege.map((a) => a.sitz)]);
  for (let s = 0; s < partie.sitze; s += 1) {
    if (ohne.has(s)) continue;
    for (let loch = 0; loch < tafel.length; loch += 1) {
      const wert = tafel[loch]![s]!;
      const inhaltId = partie.bahnen[loch];
      if (inhaltId === undefined || wert < 1 || !werte.eingelocht[loch]![s]) continue;
      jeSitz[s]!.push({ inhaltId, wert, richtung: 'tief' });
    }
  }
  return jeSitz;
}
