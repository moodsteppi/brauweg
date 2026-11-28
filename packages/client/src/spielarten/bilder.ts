/**
 * Die Bilder der Spielart-Karten — WELCHE es gibt und wo sie liegen.
 *
 * Eine Liste und keine Vermutung (wie `figuren3d/grafik-neu.ts`): CLAUDE.md
 * verbietet ein `<img>` auf eine Datei, die es noch nicht gibt. Die Bilder
 * entstehen in einer eigenen Strecke (codex, 256 × 256, freigestellt) und
 * kommen Stueck fuer Stueck unter `public/hub/spielarten/<spiel>-<id>.webp`.
 * Wer eine Datei ablegt, traegt sie HIER ein; fehlt sie hier, zeichnet die
 * Karte das Banner des Spiels (`bannerFuer`).
 *
 * `<spiel>` ist der Name in der Oberflaeche, nicht die Kennung des Servers:
 * Zauberer heisst `wizard`, Poker `easypoker` — die Dateien heissen wie das
 * Spiel, das man sieht. `BILD_NAME` uebersetzt.
 *
 * Farbduell (Vorschaubrett) und Golf (Bahnminiatur) bekommen keine Bilder:
 * Ihre Karte zeigt das echte Spielfeld, gezeichnet aus dem Regelsatz.
 */

/** Wurzel aller Spielart-Bilder, relativ zur Seite. */
export const SPIELART_BILD_WURZEL = '/hub/spielarten';

/** Dateiname-Vorsilbe je Spielkennung, wo sie von der Kennung abweicht. */
const BILD_NAME: Readonly<Record<string, string>> = {
  wizard: 'zauberer',
  easypoker: 'poker',
};

/**
 * Die Dateien, die schon unter `public/hub/spielarten/` liegen — ohne Endung.
 * Gepflegt von der Bildstrecke; die Probe `bilder.test.ts` haelt die Liste
 * gegen den Ordner.
 */
export const SPIELART_BILDER_VORHANDEN: ReadonlySet<string> = new Set<string>([]);

/** Das Bild einer Spielart, oder null — dann zeichnet die Karte das Banner. */
export function spielartBild(gameId: string, spielartId: string): string | null {
  const name = `${BILD_NAME[gameId] ?? gameId}-${spielartId}`;
  return SPIELART_BILDER_VORHANDEN.has(name) ? `${SPIELART_BILD_WURZEL}/${name}.webp` : null;
}
