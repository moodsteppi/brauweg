/**
 * Die Spezial-Modi von BroChess: ein Eintrag je Modus, sonst nichts.
 *
 * Seit dem 13.11.2026 (Projekt „BroChess Spezial-Modi", Tom). Vorher stand
 * Secret Dame als eigener Abschnitt „Spielart" nur unter „Tisch erstellen"
 * und fehlte beim Spiel gegen den Bot ganz — wer gegen den Bot startet (der
 * gold hervorgehobene Weg), hat den Modus nie zu sehen bekommen. Jetzt
 * führt ein Knopf „Spezial-Modi" in beiden Wegen zu einem Blatt mit einer
 * Karte je Eintrag dieser Liste.
 *
 * EIN NEUER MODUS IST EIN NEUER EINTRAG — Name, ein Satz Regel, Symbol, die
 * Felder für den Regelsatz. Blatt, Knopf und Lobby lesen nur diese Liste.
 * Was der Modus am Brett bedeutet, entscheidet das Modul
 * (packages/game-brochess, `modus` im Regelsatz); hier steht keine Regel,
 * nur was an `createTable` geht.
 *
 * Ohne React, damit die Liste ohne Bildschirm geprüft wird.
 */

import { type Spielart, spielartRegeln } from './geheim';
import type { SecretDameRegel } from './sicht';

/** Eine Variante innerhalb eines Modus (Secret Dame: Regel A oder B). */
export interface ModusVariante {
  readonly id: string;
  /** i18n-Schlüssel des kurzen Namens („Regel A"). */
  readonly kurz: string;
  /** i18n-Schlüssel des Satzes, was sie bedeutet. */
  readonly satz: string;
}

export interface SpezialModus {
  /** Kennung; dieselbe wie `modus` im Regelsatz des Moduls. */
  readonly id: string;
  /** i18n-Schlüssel des Namens. */
  readonly name: string;
  /** i18n-Schlüssel: die Regel in EINEM Satz, für die Karte. */
  readonly regel: string;
  /**
   * Das kleine Symbol als Pfade in einem 24×24-Feld (SVG `d`), gezeichnet
   * mit Strich. Gezeichnet statt als Bild: Ein Symbol, dessen Datei noch
   * fehlt, wäre ein weißer Kasten (CLAUDE.md, „Kein <img> auf eine Datei, die
   * es noch nicht gibt").
   */
  readonly symbol: readonly string[];
  /** Varianten zur Wahl; die erste ist die Vorgabe. Leer, wenn es keine gibt. */
  readonly varianten: readonly ModusVariante[];
  /** Die Felder für den Regelsatz des Tisches. */
  readonly felder: (variante: string) => Record<string, unknown>;
}

export const SPEZIAL_MODI: readonly SpezialModus[] = [
  {
    id: 'secretDame',
    name: 'brochess.secretDame',
    regel: 'brochess.modi.secretDame.satz',
    // Eine Krone mit Fragezeichen: Dame, aber welche?
    symbol: ['M4 18h16', 'M5 18l-1.5-9 4.5 3.5L12 6l4 6.5L20.5 9 19 18', 'M10.5 11.5a1.6 1.6 0 1 1 2.2 1.5c-.5.3-.7.6-.7 1.1', 'M12 16.2v.1'],
    varianten: [
      { id: 'A', kurz: 'brochess.regel.A.kurz', satz: 'brochess.regel.A.satz' },
      { id: 'B', kurz: 'brochess.regel.B.kurz', satz: 'brochess.regel.B.satz' },
    ],
    felder: (variante) =>
      spielartRegeln({ modus: 'secretDame', regel: variante as SecretDameRegel } satisfies Spielart),
  },
];

/** Was gewählt ist: kein Modus (klassisches Schach) oder ein Modus mit Variante. */
export interface ModusWahl {
  readonly modus: string | null;
  readonly variante: string | null;
}

export const KLASSISCH: ModusWahl = { modus: null, variante: null };

export function modusVon(id: string | null): SpezialModus | null {
  return SPEZIAL_MODI.find((m) => m.id === id) ?? null;
}

/** Wahl eines Modus mit seiner Vorgabe-Variante. */
export function waehleModus(id: string): ModusWahl {
  const modus = modusVon(id);
  return modus ? { modus: modus.id, variante: modus.varianten[0]?.id ?? null } : KLASSISCH;
}

/**
 * Die Felder für `createTable`. Klassisch schickt NICHTS mit — so entsteht
 * derselbe Tisch wie vor den Spezial-Modi, und das Modul liest den fehlenden
 * Modus als 'normal'. Eine unbekannte Kennung (etwa aus einer älteren
 * Fassung gemerkt) fällt ebenso auf klassisch zurück.
 */
export function modusFelder(wahl: ModusWahl): Record<string, unknown> {
  const modus = modusVon(wahl.modus);
  if (!modus) return {};
  const variante = modus.varianten.some((v) => v.id === wahl.variante)
    ? wahl.variante!
    : (modus.varianten[0]?.id ?? '');
  return modus.felder(variante);
}
