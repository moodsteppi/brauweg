/**
 * Kartenruecken aus der Kartenmanufaktur (Emile, 23.10.2026): Wer eine
 * Manufaktur abschliesst (umzieht), bekommt ihren Ruecken; im Kartenpalast
 * gibt es ihn seit dem Renovieren (24.10.2026) fuer die erste Renovierung
 * dort — vorher fuer das erste Jubilaeum, das ist geblieben, damit niemand
 * einen schon verdienten Ruecken verliert. Die Ruecken stehen in tischware.ts als
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
  'renovierung-5-1': 'ruecken-manufaktur-palast',
};

/** Welche Ruecken diese Meilensteine freispielen. */
export function rueckenFuer(kennungen: readonly string[]): string[] {
  return kennungen.map((k) => NACH_MEILENSTEIN[k]).filter((id): id is string => id !== undefined);
}
