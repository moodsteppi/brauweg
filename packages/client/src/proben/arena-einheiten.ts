/**
 * Name und Rolle je Einheit — die Nachschlagetabelle zu `arena-szene.json`.
 *
 * Sie liegt neben der Szene und nicht in einem der beiden Proben-Ordner, weil
 * beide Proben (2D und 3D) dieselbe Auskunft brauchen: Der Kampfbericht nennt
 * je Streiter nur `einheitId`, aber gezeigt werden muessen ein lesbarer Name
 * und — fuer die Figurenwahl — die Rolle.
 *
 * ABGESCHRIEBEN, NICHT EINGEBUNDEN: Die Werte stammen aus
 * `packages/game-tafelrunde/src/katalog.ts`. Der Client importiert aus keinem
 * Spielpaket (CLAUDE.md), und fuer eine Wegwerf-Probe lohnt kein Vertrag unter
 * `src/vertrag/`. Wer den Katalog umbenennt, faellt hier nicht beim Uebersetzen
 * auf — dafuer aber beim Erzeugen der Szene, denn `szene-erzeugen.mjs` laeuft
 * gegen das echte Paket und wirft bei einer unbekannten Kennung.
 *
 * Vollstaendig alle 22 Einheiten, obwohl die aufgezeichnete Szene nur acht
 * davon braucht: Wer die Szene neu erzeugt und dabei die Aufstellung aendert,
 * soll hier nichts nachtragen muessen.
 */

/** Die fuenf Rollen des Katalogs. Zu jeder gibt es genau einen Figurensatz. */
export type Rolle = 'wache' | 'schuetze' | 'magier' | 'meuchler' | 'beistand';

export interface Einheitsangabe {
  readonly name: string;
  readonly rolle: Rolle;
}

export const EINHEITEN: Readonly<Record<string, Einheitsangabe>> = {
  // --- 1 Gold ---------------------------------------------------------------
  dorfwache: { name: 'Dorfwache', rolle: 'wache' },
  schildknappe: { name: 'Schildknappe', rolle: 'wache' },
  astschuetze: { name: 'Astschütze', rolle: 'schuetze' },
  steinschleuderer: { name: 'Steinschleuderer', rolle: 'schuetze' },
  funkenlehrling: { name: 'Funkenlehrling', rolle: 'magier' },
  irrlicht: { name: 'Irrlicht', rolle: 'magier' },
  gassendieb: { name: 'Gassendieb', rolle: 'meuchler' },
  moosheiler: { name: 'Moosheiler', rolle: 'beistand' },

  // --- 2 Gold ---------------------------------------------------------------
  hainwaechterin: { name: 'Hainwächterin', rolle: 'wache' },
  grimmbart: { name: 'Grimmbart', rolle: 'wache' },
  bogenmeisterin: { name: 'Bogenmeisterin', rolle: 'schuetze' },
  nachtpfeil: { name: 'Nachtpfeil', rolle: 'schuetze' },
  frostweberin: { name: 'Frostweberin', rolle: 'magier' },
  schattenklinge: { name: 'Schattenklinge', rolle: 'meuchler' },
  knochenspaeher: { name: 'Knochenspäher', rolle: 'meuchler' },
  runenpriester: { name: 'Runenpriester', rolle: 'beistand' },

  // --- 3 Gold ---------------------------------------------------------------
  wurzelriese: { name: 'Wurzelriese', rolle: 'wache' },
  drachenkind: { name: 'Drachenkind', rolle: 'schuetze' },
  sturmrufer: { name: 'Sturmrufer', rolle: 'magier' },
  grabfuerstin: { name: 'Grabfürstin', rolle: 'magier' },
  klingentaenzerin: { name: 'Klingentänzerin', rolle: 'meuchler' },
  lichtwahrerin: { name: 'Lichtwahrerin', rolle: 'beistand' },
};

/**
 * Rolle einer Einheit. Faellt auf `wache` zurueck, damit eine Szene mit einer
 * unbekannten Kennung eine Figur zeigt statt einer Luecke — ein leerer Platz
 * saehe im Vergleich der beiden Proben nach einem Fehler der Anzeige aus.
 */
export function rolleVon(einheitId: string): Rolle {
  return EINHEITEN[einheitId]?.rolle ?? 'wache';
}

/** Lesbarer Name. Ohne Eintrag die Kennung selbst — besser als ein leeres Feld. */
export function namenVon(einheitId: string): string {
  return EINHEITEN[einheitId]?.name ?? einheitId;
}
