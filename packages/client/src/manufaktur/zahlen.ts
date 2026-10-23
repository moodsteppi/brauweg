/**
 * Zahlen fuer die Kartenmanufaktur, immer ohne Kommastellen-Gewimmel:
 *
 *   1.240 · 12 Tsd. · 3,4 Mio. · 34 Mio. · 1,2 Mrd. · 5 Bio. · 1 aa · 7,5 ab
 *
 * Bis 9.999 steht die ganze Zahl da, bis unter einer Million ganze Tausender,
 * darueber eine Nachkommastelle nur, solange die Zahl einstellig ist. Nach den
 * Billionen kommen Buchstabenpaare wie in Idle-Spielen ueblich — eine Zahl mit
 * dreissig Stellen liest am Handy niemand. Abgerundet wird immer: Es steht nie
 * mehr da, als da ist. Gerechnet wird intern weiter mit double.
 */

const EINHEITEN = ['', 'Tsd.', 'Mio.', 'Mrd.', 'Bio.'];

function buchstaben(n: number): string {
  // n = 0 → aa, 1 → ab, …, 25 → az, 26 → ba
  const a = 'abcdefghijklmnopqrstuvwxyz';
  return `${a[Math.floor(n / 26) % 26]}${a[n % 26]}`;
}

/** Abrunden mit Toleranz — sonst wird aus 3,4 durch Gleitkomma 3,3999… und daraus 3,3. */
function ab(wert: number, stellen: number): number {
  const f = 10 ** stellen;
  return Math.floor(wert * f + 1e-9) / f;
}

export function kurz(wert: number): string {
  if (!Number.isFinite(wert)) return '∞';
  const vorzeichen = wert < 0 ? '−' : '';
  const betrag = Math.abs(wert);
  if (betrag < 10_000) return vorzeichen + ab(betrag, 0).toLocaleString('de-DE');
  if (betrag < 1e6) return `${vorzeichen}${ab(betrag / 1000, 0).toLocaleString('de-DE')} Tsd.`;
  const stufe = Math.floor(Math.log10(betrag) / 3 + 1e-12);
  const geteilt = betrag / 1000 ** stufe;
  const zahl = ab(geteilt, geteilt < 10 ? 1 : 0).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const einheit = stufe < EINHEITEN.length ? EINHEITEN[stufe]! : buchstaben(stufe - EINHEITEN.length);
  return `${vorzeichen}${zahl} ${einheit}`;
}

/** Sekunden fuer Kennzahlen: „3 s", „1,5 s" unter zehn Sekunden — dort zaehlt das Zehntel. */
export function sekunden(wert: number): string {
  return `${ab(wert, wert < 10 ? 1 : 0).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
}

/**
 * Eine Rate fuer die Hauptzeile im Upgrade-Blatt: unter 100 mit einer
 * Nachkommastelle. Ganzzahlig stand dort „6 → 6", obwohl die Stufe 6,2 auf
 * 6,7 hob — der Ausbau sah nutzlos aus.
 */
export function proSekunde(wert: number): string {
  if (Math.abs(wert) >= 100) return kurz(wert);
  return ab(wert, 1).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** „3 Std. 12 Min." für die Offline-Meldung. */
export function dauer(sekunden: number): string {
  const std = Math.floor(sekunden / 3600);
  const min = Math.floor((sekunden % 3600) / 60);
  if (std > 0) return min > 0 ? `${std} Std. ${min} Min.` : `${std} Std.`;
  return `${Math.max(1, min)} Min.`;
}
