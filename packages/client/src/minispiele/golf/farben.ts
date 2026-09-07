/**
 * Die sechzehn Ballfarben von Golf — an EINER Stelle, weil sie an fünf
 * gebraucht werden: in der Lobby (Golfball je Spieler), im HUD (Chips), auf
 * der Leinwand (Bälle, Konfetti), im Banner der Spielauswahl und im Menü.
 * Dieselbe Bauart wie minispiele/filler/farben.ts.
 *
 * **Warum sechzehn und nicht acht.** Seit dem 07.09.2026 darf jeder in der
 * Lobby seine Ballfarbe durchtippen. Bei acht Farben und acht Sitzen wäre
 * jede Wahl nur ein Tausch: Es gäbe nie eine freie Farbe. Die zweiten acht
 * sind der Spielraum, aus dem gewählt wird.
 *
 * Die Reihenfolge ist Anzeige, nicht Protokoll: Über die Leitung geht kein
 * Farbwert, sondern nur der PLATZ in dieser Tabelle (der Farbwunsch am Sitz).
 * Wer hier eine Farbe tauscht, färbt trotzdem für alle um — auf jedem Gerät
 * gleich, weil jedes dieselbe Tabelle liest.
 */

export const FARBEN = [
  '#e63946', // 0 rot
  '#1d9bf0', // 1 blau
  '#2ec27e', // 2 grün
  '#f4b400', // 3 gelb
  '#9b5de5', // 4 lila
  '#ff8c42', // 5 orange
  '#00bcd4', // 6 türkis
  '#f06292', // 7 rosa
  '#b5179e', // 8 magenta
  '#aeea00', // 9 limette
  '#4d61ff', // 10 indigo
  '#8d6e63', // 11 braun
  '#00e5a0', // 12 mint
  '#f2f2f2', // 13 weiß
  '#37474f', // 14 schiefer
  '#00796b', // 15 tanne
] as const;

/** So viele Farben zeigt das Menü — die Zahl von früher, aus dem größeren Vorrat gezogen. */
export const MENUE_FARBEN = 8;

/**
 * Farbe zu einem Platz in der Tabelle. Der Rest-Operator ist da, weil ein
 * Bildschirm, der bei einem unerwarteten Wert `undefined` in ein `fillStyle`
 * schreibt, nicht abstürzt, sondern still schwarz malt.
 */
export function farbeAus(nr: number): string {
  return FARBEN[((Math.trunc(nr) % FARBEN.length) + FARBEN.length) % FARBEN.length];
}

/**
 * Farbe eines Sitzes ohne Wahl — die Vorgabe, wie sie vor der Farbwahl galt.
 * Mehr als acht Sitze gibt es nicht (`seatCounts` des Moduls endet bei 8).
 */
export function farbeVon(sitz: number): string {
  return farbeAus(sitz);
}

/**
 * Aus den Farbwünschen der Sitze die tatsächlichen Farben machen — je Sitz
 * ein Platz in FARBEN, garantiert doppelfrei.
 *
 * **Warum das hier steht und nicht im Server.** Der Server verwahrt nur den
 * WUNSCH je Sitz (`SeatInfo.farbe`) und prüft ihn nicht gegen die anderen:
 * Zwei Leute können im selben Moment dieselbe Farbe antippen, und ein Sitz
 * kann beim Start umnummeriert werden. Doppelfrei wird es erst hier — durch
 * eine reine Funktion, die auf jedem Gerät dieselbe Antwort gibt, weil jedes
 * dieselben Wünsche in derselben Sitzreihenfolge sieht. Eine Regel, keine
 * zweite Wahrheit: Es gibt sie genau einmal.
 *
 * Regel, Sitz für Sitz: Ein Wunsch gilt, solange ihn kein früherer Sitz schon
 * hat (sonst gilt der Sitz als wunschlos). Wer keinen gültigen Wunsch hat,
 * bekommt die Farbe seines Sitzes; ist auch die vergeben, die erste freie.
 */
export function farbtafel(wuensche: readonly (number | null | undefined)[]): number[] {
  const vergeben = new Set<number>();
  const tafel: number[] = new Array(wuensche.length).fill(-1);

  wuensche.forEach((wunsch, sitz) => {
    if (wunsch === null || wunsch === undefined || !Number.isFinite(wunsch)) return;
    const nr = ((Math.trunc(wunsch) % FARBEN.length) + FARBEN.length) % FARBEN.length;
    if (vergeben.has(nr)) return;
    vergeben.add(nr);
    tafel[sitz] = nr;
  });

  for (let sitz = 0; sitz < tafel.length; sitz += 1) {
    if (tafel[sitz] !== -1) continue;
    const eigen = ((sitz % FARBEN.length) + FARBEN.length) % FARBEN.length;
    let nr = vergeben.has(eigen) ? -1 : eigen;
    for (let i = 0; nr === -1 && i < FARBEN.length; i += 1) {
      if (!vergeben.has(i)) nr = i;
    }
    // Mehr Sitze als Farben gibt es nicht (8 gegen 16); bliebe doch einer
    // uebrig, faerbt er wie sein Sitz, statt undefined zu werden.
    if (nr === -1) nr = eigen;
    vergeben.add(nr);
    tafel[sitz] = nr;
  }

  return tafel;
}

/**
 * Die nächste Farbe für einen Sitz — das, was ein Tipp auf den eigenen Namen
 * auslöst. Übersprungen wird, was ein anderer Sitz gerade trägt; so entsteht
 * kein Wunsch, den `farbtafel` gleich wieder wegräumt.
 *
 * Gibt es keine freie Farbe (kann bei 16 Farben und 8 Sitzen nicht passieren),
 * bleibt es bei der jetzigen.
 */
export function naechsteFarbe(tafel: readonly number[], sitz: number): number {
  const jetzt = tafel[sitz] ?? sitz;
  const belegt = new Set(tafel.filter((_, i) => i !== sitz));
  for (let schritt = 1; schritt <= FARBEN.length; schritt += 1) {
    const nr = (jetzt + schritt) % FARBEN.length;
    if (!belegt.has(nr)) return nr;
  }
  return jetzt;
}

/**
 * `anzahl` verschiedene Farben aus dem ganzen Vorrat ziehen — fürs Menü, das
 * weiterhin acht Bälle zeigt, aber nicht mehr immer dieselben.
 *
 * `zufall` ist ein Parameter, damit die Probe nicht würfeln muss.
 */
export function zieheFarben(anzahl: number, zufall: () => number = Math.random): string[] {
  const vorrat = FARBEN.map((_, i) => i);
  // Fisher-Yates, so weit wie noetig: kein Ziehen mit Zuruecklegen, sonst
  // stuenden im Menue zwei gleiche Baelle nebeneinander.
  const wie_viele = Math.max(0, Math.min(Math.trunc(anzahl), vorrat.length));
  for (let i = 0; i < wie_viele; i += 1) {
    const j = i + Math.floor(zufall() * (vorrat.length - i));
    const hier = vorrat[i]!;
    vorrat[i] = vorrat[Math.min(j, vorrat.length - 1)]!;
    vorrat[Math.min(j, vorrat.length - 1)] = hier;
  }
  return vorrat.slice(0, wie_viele).map((nr) => FARBEN[nr]!);
}

/**
 * Dunklere Fassung derselben Farbe, für Schatten und Ränder.
 *
 * Gerechnet statt als zweite Tabelle gepflegt: Zwei Listen, die man von Hand
 * gleich halten muss, laufen beim ersten Farbwechsel auseinander.
 */
export function dunkler(farbe: string, anteil = 0.35): string {
  const zahl = Number.parseInt(farbe.slice(1), 16);
  const r = Math.round(((zahl >> 16) & 255) * (1 - anteil));
  const g = Math.round(((zahl >> 8) & 255) * (1 - anteil));
  const b = Math.round((zahl & 255) * (1 - anteil));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Hellere Fassung — für Glanzlichter auf dem Ball. */
export function heller(farbe: string, anteil = 0.45): string {
  const zahl = Number.parseInt(farbe.slice(1), 16);
  const r = Math.round(((zahl >> 16) & 255) + (255 - ((zahl >> 16) & 255)) * anteil);
  const g = Math.round(((zahl >> 8) & 255) + (255 - ((zahl >> 8) & 255)) * anteil);
  const b = Math.round((zahl & 255) + (255 - (zahl & 255)) * anteil);
  return `rgb(${r}, ${g}, ${b})`;
}
