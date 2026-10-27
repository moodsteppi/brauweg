/**
 * Was die Endtafel von Golf zeigt — rein und ohne React.
 *
 * Stand bis zum 22.09.2026 als Rechnung in `meldeErgebnis` (screens/Golf.tsx)
 * und rechnete das Par gegen den KATALOG: `parJeLoch(zustand.reihenfolge,
 * KARTEN)`. Seit „Bahnen als Daten" (#206) zeigt `reihenfolge` aber in die
 * Bahnen DIESER Partie (`Golfnetz.karten`, aus den Kennungen der Sicht), also
 * `[0, 1, 2, …]` — gegen den Katalog gelesen stand in der Endtafel das Par der
 * ersten Katalogbahnen, nicht das der gespielten. Aufgefallen beim Rebase des
 * Replays, das dieselbe Umstellung mitmachen musste. Hier steht die Rechnung,
 * damit sie sich prüfen lässt (abschluss.test.ts); der Bildschirm reicht nur
 * noch die Partiebahnen hinein.
 */

import type { Karte } from './karte';
import { parJeLoch } from './par';
import { type Partiezustand, gesamtschlaege, platzierungen } from './physik';

export interface Abschlussdaten {
  /** `[loch][sitz]` — Kopie, weil der Kernzustand lebt und weiterläuft. */
  ergebnis: number[][];
  gesamt: number[];
  platz: { sitz: number; schlaege: number; platz: number }[];
  /** Par je gespieltem Loch — nur für die Anzeige „zu Par", nie für den Platz. */
  par: number[];
}

/**
 * Die Endtafel aus dem Endzustand.
 *
 * `partieKarten` sind die Bahnen, in die `zustand.reihenfolge` zeigt — im
 * Spiel `Golfnetz.karten`, NICHT der Katalog `KARTEN`.
 */
export function abschlussdaten(
  zustand: Partiezustand,
  partieKarten: readonly Karte[],
): Abschlussdaten {
  return {
    ergebnis: zustand.ergebnis.map((reihe) => [...(reihe ?? [])]),
    gesamt: gesamtschlaege(zustand),
    platz: platzierungen(zustand),
    par: parJeLoch(zustand.reihenfolge, partieKarten),
  };
}
