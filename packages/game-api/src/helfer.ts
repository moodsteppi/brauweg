/**
 * Gemeinsame Helfer fuer Spielmodul-Adapter.
 *
 * Jeder Kartenspiel-Adapter braucht dieselben zwei Handgriffe: die
 * Formpruefung des Regelsatzes und den versionierten Partie-Snapshot. Vor
 * dieser Datei stand der Rumpf viermal fast woertlich gleich in Cambio,
 * Doppelkopf, Skat und Zauberer — wer dort einen Fehler fand, musste ihn
 * viermal beheben. Deshalb wohnt der gemeinsame Teil hier; was ein Spiel
 * besonders macht (etwa die Bock-Uebersetzung im Doppelkopf), bleibt im
 * jeweiligen Adapter.
 */

import type { ConfigProblem } from './index.js';

/**
 * Prueft, ob ueberhaupt ein Regelsatz vorliegt.
 *
 * Verglichen wird gegen die Felder des uebergebenen Standardregelsatzes:
 * Jedes muss da sein und denselben Typ haben. So haelt auch eine spaetere
 * neue Option automatisch mit, ohne dass eine Feldliste gepflegt werden
 * muss. Arrays werden eigens erkannt, weil typeof sie nur als 'object'
 * meldet — sonst ginge ein beliebiges Objekt als Solo-Liste durch.
 */
export function shapeProblems(config: unknown, standard: object): ConfigProblem[] {
  if (typeof config !== 'object' || config === null) {
    return [{ path: 'config', messageKey: 'ruleset.notAnObject', severity: 'error' }];
  }

  const given = config as Record<string, unknown>;
  const problems: ConfigProblem[] = [];

  for (const [key, soll] of Object.entries(standard)) {
    const value = given[key];
    if (value === undefined) {
      problems.push({ path: key, messageKey: 'ruleset.fieldMissing', severity: 'error' });
      continue;
    }
    const erwartet = Array.isArray(soll) ? 'array' : typeof soll;
    const tatsaechlich = Array.isArray(value) ? 'array' : typeof value;
    if (erwartet !== tatsaechlich) {
      problems.push({ path: key, messageKey: 'ruleset.fieldWrongType', severity: 'error' });
    }
  }

  return problems;
}

/**
 * Wirft, wenn ein Snapshot aus einer anderen Fassung stammt.
 *
 * Der Server kennt den Snapshot-Inhalt nicht, muss eine unlesbare Fassung
 * aber als Fehler erkennen koennen, statt sie stillschweigend falsch zu
 * deuten. Die Meldung ist absichtlich zentral, damit sie in allen Spielen
 * gleich klingt.
 */
export function pruefeSnapshotVersion(ist: number, erwartet: number): void {
  if (ist !== erwartet) {
    throw new Error(`Snapshot-Version ${ist} wird nicht unterstuetzt (erwartet ${erwartet})`);
  }
}

/**
 * serialize/deserialize fuer den Normalfall: Der Partiezustand ist reines
 * JSON — keine Klasse, keine Methode, kein Datum. Die Version kommt trotzdem
 * mit, damit ein Snapshot aus einer aelteren Fassung als Fehler auffaellt.
 *
 * Spiele mit Sonderfeldern (der Doppelkopf uebersetzt seinen BockState von
 * Hand) schreiben serialize/deserialize weiterhin selbst und nutzen nur
 * pruefeSnapshotVersion.
 */
export function snapshotCodec<TParty extends object>(
  version: number,
): {
  serialize(party: TParty): unknown;
  deserialize(raw: unknown): TParty;
} {
  return {
    serialize: (party) => ({ v: version, ...party }),
    deserialize: (raw) => {
      const snap = raw as TParty & { v: number };
      pruefeSnapshotVersion(snap.v, version);
      const { v: _v, ...rest } = snap;
      return rest as TParty;
    },
  };
}
