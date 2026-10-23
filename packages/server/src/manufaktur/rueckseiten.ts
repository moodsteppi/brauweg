/**
 * Kartenruecken aus der Kartenmanufaktur (Emile, 23.10.2026): Wer eine
 * Manufaktur abschliesst (umzieht), bekommt ihren Ruecken; den Kartenpalast
 * schliesst das erste Jubilaeum ab. Die Ruecken stehen in tischware.ts als
 * `nurErspielt` — kaufen kann man sie nicht.
 *
 * Hier und nicht im Kern: Der Kern kennt keine Ware, nur Meilensteine.
 */

const NACH_MEILENSTEIN: Readonly<Record<string, string>> = {
  'umzug-2': 'ruecken-manufaktur-dorf',
  'umzug-3': 'ruecken-manufaktur-fluss',
  'umzug-4': 'ruecken-manufaktur-berg',
  'umzug-5': 'ruecken-manufaktur-hafen',
  'jubilaeum-1': 'ruecken-manufaktur-palast',
};

/** Welche Ruecken diese Meilensteine freispielen. */
export function rueckenFuer(kennungen: readonly string[]): string[] {
  return kennungen.map((k) => NACH_MEILENSTEIN[k]).filter((id): id is string => id !== undefined);
}
