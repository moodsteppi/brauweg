/**
 * Sitzzahlen eines Spiels als kurze Spanne: `[1,2,…,8]` wird zu `1–8`.
 *
 * Warum: `seatCounts` kommt vom Spielmodul als Liste jeder erlaubten Zahl,
 * weil die Lobby daraus einzelne Knoepfe baut. Auf der Spielkarte ist die
 * Liste aber nur Laerm — bei Golf standen dort acht Zahlen mit Kommas, wo
 * „1–8" dasselbe sagt (Robins Wunsch vom 07.09.2026).
 *
 * Luecken bleiben sichtbar: `[2, 4]` ist keine Spanne, sondern „2, 4", und
 * `[2, 3, 4, 6]` wird zu „2–4, 6". Sonst verspräche die Karte eine Zahl,
 * die der Tisch gar nicht anbietet.
 */
export function sitzSpanne(seatCounts: readonly number[]): string {
  const zahlen = [...new Set(seatCounts)].sort((a, b) => a - b);
  const teile: string[] = [];
  let anfang: number | null = null;
  let ende: number | null = null;
  const abschliessen = () => {
    if (anfang === null || ende === null) return;
    // Ein Gedankenstrich, kein Bindestrich: „4–5" ist eine Spanne, „4-5" saehe
    // nach einem Rechenzeichen aus.
    teile.push(anfang === ende ? String(anfang) : `${anfang}–${ende}`);
  };
  for (const n of zahlen) {
    if (ende !== null && n === ende + 1) {
      ende = n;
      continue;
    }
    abschliessen();
    anfang = n;
    ende = n;
  }
  abschliessen();
  return teile.join(', ');
}
