/**
 * Werbelink-Kennung `?q=<kennung>` (Werbetest, 19.10.2026; Server:
 * packages/server/src/herkunft.ts).
 *
 * Beim ersten Aufruf gelesen, als Besuch gemeldet und NUR im Arbeitsspeicher
 * gehalten, bis jemand ein Gastkonto anlegt — `api.gastLogin` schickt sie
 * dann mit. Kein Cookie, kein localStorage, kein sessionStorage: Genau
 * deshalb braucht es kein Einwilligungsbanner. Wer vor dem Gastkonto neu
 * laedt, ist ab da nicht mehr zuzuordnen; das ist der Preis, und er ist
 * gewollt.
 *
 * Danach fliegt `q` aus der Adresszeile. Sonst zaehlte jedes Neuladen als
 * neuer Besuch, und wer die Adresse weitergibt, gaebe die Anzeige mit.
 */

/** Dieselbe Form wie im Server; massgeblich ist dessen Pruefung. */
const KENNUNG = /^[a-z0-9][a-z0-9_-]{0,39}$/;

let gemerkt: string | null = null;

export function leseKennung(search: string): string | null {
  const roh = new URLSearchParams(search).get('q');
  if (roh === null) return null;
  const kennung = roh.trim().toLowerCase();
  return KENNUNG.test(kennung) ? kennung : null;
}

/** Die Kennung dieses Seitenaufrufs, falls er ueber einen Werbelink kam. */
export function herkunft(): string | null {
  return gemerkt;
}

/**
 * Einmal beim Start, vor dem ersten Bild. `melden` ist der Aufruf an den
 * Server — als Parameter, damit dieses Modul api.ts nicht importiert (api.ts
 * importiert umgekehrt `herkunft`).
 */
export function merkeHerkunft(
  melden: (kennung: string) => void,
  ort: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
  ersetzen: (adresse: string) => void = (adresse) => window.history.replaceState(null, '', adresse),
): void {
  const params = new URLSearchParams(ort.search);
  if (!params.has('q')) return;

  const kennung = leseKennung(ort.search);
  params.delete('q');
  const rest = params.toString();
  ersetzen(`${ort.pathname}${rest ? `?${rest}` : ''}${ort.hash}`);

  if (!kennung || gemerkt) return;
  gemerkt = kennung;
  melden(kennung);
}

/** Nur Tests. */
export function vergissHerkunft(): void {
  gemerkt = null;
}
