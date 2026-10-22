/**
 * Grosse Zahlen fuer die Kartenmanufaktur: „12,3 Tsd.", „4,56 Mio.", und
 * jenseits der Billiarde Buchstabenpaare (aa, ab …) wie in Idle-Spielen
 * ueblich — eine Zahl mit 30 Stellen liest am Handy niemand.
 */

const STUFEN = ['', 'Tsd.', 'Mio.', 'Mrd.', 'Bio.', 'Brd.'];

function buchstaben(n: number): string {
  // n = 0 → aa, 1 → ab, …, 25 → az, 26 → ba
  const a = 'abcdefghijklmnopqrstuvwxyz';
  return `${a[Math.floor(n / 26) % 26]}${a[n % 26]}`;
}

export function kurz(wert: number): string {
  if (!Number.isFinite(wert)) return '∞';
  const betrag = Math.abs(wert);
  if (betrag < 1000) {
    return (Math.floor(wert * 10) / 10).toLocaleString('de-DE', { maximumFractionDigits: betrag < 100 ? 1 : 0 });
  }
  const stufe = Math.floor(Math.log10(betrag) / 3);
  const geteilt = wert / 1000 ** stufe;
  const stellen = Math.abs(geteilt) < 10 ? 2 : Math.abs(geteilt) < 100 ? 1 : 0;
  // Abgerundet, damit nie mehr dasteht, als da ist — mit Toleranz, sonst
  // wird aus 4,56 durch Gleitkomma 4,5599… und daraus 4,55.
  const zahl = (Math.floor(geteilt * 10 ** stellen + 1e-9) / 10 ** stellen).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: stellen,
  });
  const einheit = stufe < STUFEN.length ? STUFEN[stufe]! : buchstaben(stufe - STUFEN.length);
  return `${zahl} ${einheit}`;
}

/** „3 Std. 12 Min." für die Offline-Meldung. */
export function dauer(sekunden: number): string {
  const std = Math.floor(sekunden / 3600);
  const min = Math.floor((sekunden % 3600) / 60);
  if (std > 0) return min > 0 ? `${std} Std. ${min} Min.` : `${std} Std.`;
  return `${Math.max(1, min)} Min.`;
}
