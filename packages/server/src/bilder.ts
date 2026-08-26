/**
 * Kleine Bildpruefung fuer alles, was als data-URL hereinkommt.
 *
 * Stand bis zum 26. August in http/app.ts und galt nur dem Profilbild. Seit
 * die Mememory-Motive denselben Weg gehen (Browser verkleinert, data-URL,
 * Textspalte), braucht die Pruefung zwei Aufrufer — und eine kopierte
 * Sicherheitspruefung ist eine, die irgendwann nur an einer Stelle
 * nachgezogen wird.
 */

/** Erlaubte Form einer Bild-data-URL. Alles andere kommt gar nicht erst an. */
export const BILD_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Prueft die ersten Bytes einer Bild-data-URL.
 *
 * Der angegebene Typ sagt nichts: Wer HTML als `image/png` hinterlegt,
 * bekaeme es unter unserer eigenen Herkunft ausgeliefert. Also wird
 * nachgesehen, ob wirklich PNG, JPEG oder WebP dahintersteht.
 */
export function istEchtesBild(dataUrl: string): boolean {
  const komma = dataUrl.indexOf(',');
  if (komma < 0) return false;
  let kopf: Buffer;
  try {
    kopf = Buffer.from(dataUrl.slice(komma + 1, komma + 41), 'base64');
  } catch {
    return false;
  }
  if (kopf.length < 12) return false;
  const png = kopf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = kopf[0] === 0xff && kopf[1] === 0xd8 && kopf[2] === 0xff;
  const webp =
    kopf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    kopf.subarray(8, 12).toString('ascii') === 'WEBP';
  return png || jpeg || webp;
}

/**
 * Zerlegt eine gepruefte data-URL in Inhaltstyp und Bytes.
 *
 * Gibt null zurueck, wenn die Zeichenkette keine ist — der Aufrufer
 * antwortet dann mit "nicht gefunden" statt mit einem leeren Bild.
 */
export function bytesAusDataUrl(dataUrl: string): { typ: string; bytes: Buffer } | null {
  const treffer = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
  if (!treffer) return null;
  return { typ: treffer[1]!, bytes: Buffer.from(treffer[2]!, 'base64') };
}
