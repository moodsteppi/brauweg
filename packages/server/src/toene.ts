/**
 * Kleine Tonpruefung fuer alles, was als data-URL hereinkommt.
 *
 * Gebaut wie `bilder.ts` und aus demselben Grund getrennt davon: Ein Ton hat
 * andere Magiebytes, eine andere Obergrenze und eine andere Frage („wie lang
 * ist er?"), die es bei einem Bild gar nicht gibt.
 *
 * **Nur WAV, und das ist Absicht.** Der Browser nimmt jede Datei an, die er
 * abspielen kann, rechnet sie aber in ein Stueck WAV um, bevor er sie
 * abschickt (`tonSchnipsel` im Client) — hier kommt also nie ein MP3 an. Die
 * schmale Liste erspart dem Server, fremde Formate zu vermessen: Bei WAV
 * steht die Laenge im Kopf, bei einem MP3 muesste man es dekodieren.
 *
 * **Warum ueberhaupt geprueft wird.** Der angegebene Typ einer data-URL ist
 * eine Behauptung. Wer HTML als `audio/wav` ablegt, bekaeme es unter unserer
 * eigenen Herkunft ausgeliefert — der kurze Weg zu XSS, genau wie beim Bild.
 */

/** Erlaubte Form einer Ton-data-URL. Alles andere kommt gar nicht erst an. */
export const TON_DATA_URL = /^data:audio\/wav;base64,[A-Za-z0-9+/=]+$/;

/**
 * So lang darf ein Meme-Ton hoechstens sein.
 *
 * Acht Zehntelsekunden sind die Vorgabe des Auftrags, und sie sind gut
 * gewaehlt: Ein Meme-Ton ist eine Pointe, kein Musikstueck, und waehrend er
 * laeuft, will sich der Gegner Karten merken. Der Client schneidet auf diese
 * Laenge; hier steht sie noch einmal, weil ein Browser sich umgehen laesst.
 *
 * Ein Zehntel Zugabe, damit ein Schnitt, der um ein paar Abtastwerte
 * danebenliegt, nicht am Riegel scheitert.
 */
export const TON_MAX_SEKUNDEN = 0.9;

/**
 * Groesster erlaubter Ton als Zeichenzahl der data-URL.
 *
 * Der Client rechnet auf Mono, 22050 Hz und 16 Bit; 0,8 s sind damit rund
 * 35 kB Rohdaten und als data-URL rund 47 000 Zeichen. 64 000 lassen Luft
 * und bleiben mit dem Bild zusammen unter der Rumpfgrenze des Servers
 * (128 kB).
 */
export const TON_MAX_ZEICHEN = 64_000;

/** Bytes einer data-URL, ohne Ruecksicht auf den Typ davor. */
function bytes(dataUrl: string): Buffer | null {
  const komma = dataUrl.indexOf(',');
  if (komma < 0) return null;
  try {
    return Buffer.from(dataUrl.slice(komma + 1), 'base64');
  } catch {
    return null;
  }
}

/**
 * Steht wirklich ein WAV dahinter — und wie lang ist es?
 *
 * Zurueck kommt die Dauer in Sekunden, oder null, wenn es keines ist. Gelesen
 * wird der `fmt `-Block (Kanaele, Abtastrate, Bits) und die Laenge des
 * `data`-Blocks; daraus ergibt sich die Dauer ohne einen einzigen
 * dekodierten Abtastwert.
 *
 * Die Bloecke werden DURCHLAUFEN und nicht an festen Stellen gelesen: Ein
 * WAV darf vor `data` weitere Bloecke tragen (`LIST`, `fact`), und ein
 * Leser, der 44 Bytes Kopf annimmt, verrechnet sich daran.
 */
export function wavDauer(dataUrl: string): number | null {
  const roh = bytes(dataUrl);
  if (!roh || roh.length < 44) return null;
  if (roh.subarray(0, 4).toString('ascii') !== 'RIFF') return null;
  if (roh.subarray(8, 12).toString('ascii') !== 'WAVE') return null;

  let kanaele = 0;
  let rate = 0;
  let bits = 0;
  let daten = 0;

  let ort = 12;
  while (ort + 8 <= roh.length) {
    const kennung = roh.subarray(ort, ort + 4).toString('ascii');
    const laenge = roh.readUInt32LE(ort + 4);
    const inhalt = ort + 8;
    if (kennung === 'fmt ' && inhalt + 16 <= roh.length) {
      kanaele = roh.readUInt16LE(inhalt + 2);
      rate = roh.readUInt32LE(inhalt + 4);
      bits = roh.readUInt16LE(inhalt + 14);
    } else if (kennung === 'data') {
      // Der angegebene Block darf nicht laenger sein als die Datei: Sonst
      // liesse sich mit einer Zahl im Kopf jede Dauer behaupten.
      daten = Math.min(laenge, roh.length - inhalt);
      break;
    }
    // Bloecke sind auf gerade Laengen ausgerichtet.
    ort = inhalt + laenge + (laenge % 2);
  }

  if (kanaele <= 0 || rate <= 0 || bits <= 0 || daten <= 0) return null;
  return daten / (rate * kanaele * (bits / 8));
}

/** Form, Inhalt und Laenge in einem: taugt der Ton? */
export function istEchterTon(dataUrl: string): boolean {
  if (!TON_DATA_URL.test(dataUrl)) return false;
  const dauer = wavDauer(dataUrl);
  return dauer !== null && dauer > 0 && dauer <= TON_MAX_SEKUNDEN;
}

/**
 * Zerlegt eine gepruefte data-URL in Inhaltstyp und Bytes.
 *
 * Eigene Fassung neben der in `bilder.ts`: Dort steht `image/` fest im
 * Muster, und ein gemeinsamer Zerleger, der beides annimmt, waere die Stelle,
 * an der irgendwann ein Bild als Ton ausgeliefert wird.
 */
export function tonBytes(dataUrl: string): { typ: string; bytes: Buffer } | null {
  const treffer = /^data:(audio\/[a-z0-9+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!treffer) return null;
  return { typ: treffer[1]!, bytes: Buffer.from(treffer[2]!, 'base64') };
}
