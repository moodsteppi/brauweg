/**
 * Flying Bro: die Bilder aus public/flyingbro, einmal geladen.
 *
 * Nur Namen, die es dort wirklich gibt (CLAUDE.md: kein Bild auf eine Datei,
 * die es noch nicht gibt). Die Deko der Level (`busch-1`) fehlt noch — sie
 * wird deshalb gar nicht gezeichnet statt als leerer Kasten.
 */

const NAMEN = [
  'schleuder',
  ...['pelle', 'malve', 'tjark'].flatMap((b) => [`bro-${b}-ruhe`, `bro-${b}-flug`]),
  'bro-pelle-rutsch',
  'bro-malve-gleit',
  'bro-tjark-eisblock',
  ...['klein', 'mittel', 'gross'].flatMap((g) => [`giraffe-${g}-steht`, `giraffe-${g}-getroffen`]),
  ...['glas', 'holz', 'stein'].flatMap((s) =>
    ['quadrat', 'balken'].flatMap((f) => [`${s}-${f}-heil`, `${s}-${f}-angeknackst`]),
  ),
] as const;

export type BildName = (typeof NAMEN)[number];
export type Bilder = Partial<Record<BildName, HTMLImageElement>>;

let laden: Promise<Bilder> | null = null;

/** Lädt alle Bilder; ein fehlendes Bild bleibt weg (gezeichnet wird dann eine Farbfläche), statt das Spiel aufzuhalten. */
export function ladeBilder(): Promise<Bilder> {
  laden ??= Promise.all(
    NAMEN.map(
      (n) =>
        new Promise<[BildName, HTMLImageElement | null]>((fertig) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => fertig([n, img]);
          img.onerror = () => fertig([n, null]);
          img.src = `/flyingbro/${n}.webp`;
        }),
    ),
  ).then((paare) => {
    const b: Bilder = {};
    for (const [n, img] of paare) if (img) b[n] = img;
    return b;
  });
  return laden;
}
