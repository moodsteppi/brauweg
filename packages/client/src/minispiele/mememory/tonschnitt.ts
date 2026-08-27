/**
 * Aus einer beliebigen Tondatei acht Zehntelsekunden WAV machen.
 *
 * Dasselbe Verhaeltnis wie beim Bild: Zugeschnitten wird im BROWSER, nicht
 * auf dem Server. Der Grund ist derselbe und noch etwas deutlicher — eine
 * MP3-Datei vom Handy wiegt schnell fuenf Megabyte, und davon soll ein
 * Achtelsekundenstueck uebrig bleiben. Was den Server erreicht, sind rund
 * 47 kB, und er muss zum Pruefen nichts dekodieren: Bei WAV steht die Laenge
 * im Kopf (siehe packages/server/src/toene.ts).
 *
 * **Warum WAV und nicht das Format, das hereinkam.** Etwas anderes zu
 * erzeugen hiesse, im Browser einen Kodierer zu haben: `MediaRecorder` kann
 * das, nimmt aber in Echtzeit auf und liefert je nach Geraet Opus, WebM oder
 * MP4 — drei Formate, die der Server alle vermessen muesste. WAV entsteht
 * durch blosses Hinschreiben der Abtastwerte und ist ueberall gleich.
 *
 * **Mono und 22050 Hz.** Ein Meme-Ton ist eine Pointe, kein Musikstueck. In
 * Stereo bei 48 kHz waeren dieselben 0,8 s viermal so gross und muessten am
 * Riegel des Servers scheitern.
 */

/** Muss zu TON_MAX_SEKUNDEN in packages/server/src/toene.ts passen (0,9 mit Zugabe). */
export const TON_SEKUNDEN = 0.8;

/** Abtastrate des Ergebnisses. Telefonqualitaet reicht fuer einen Zuruf. */
const RATE = 22050;

/**
 * Ein- und Ausblendung in Sekunden.
 *
 * Ein Schnitt mitten in eine Schwingung knackt — dieselbe Ueberlegung wie bei
 * den synthetischen Toenen in `klaenge.ts`, wo jeder Oszillator eine Rampe
 * bekommt. Fuenf Millisekunden hoert niemand als Blende, aber jeder hoert
 * den Knacks, den sie verhindern.
 */
const BLENDE = 0.005;

/**
 * Entpackt die Datei und schneidet sie zurecht.
 *
 * Der `OfflineAudioContext` ist hier kein Umweg, sondern der Grund, warum das
 * ohne Nutzergeste geht: Ein gewoehnlicher `AudioContext` startet ausserhalb
 * einer Geste angehalten, ein Offline-Kontext braucht gar keine — und er
 * rechnet beim Entpacken gleich auf seine eigene Abtastrate um. Das Umrechnen
 * ist damit erledigt, bevor der erste Abtastwert gelesen wird.
 */
export async function tonSchnipsel(datei: Blob): Promise<string> {
  const roh = await datei.arrayBuffer();
  const Offline =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!Offline) throw new Error('kein Tonwerk');
  const werk = new Offline(1, 1, RATE);
  const gelesen = await werk.decodeAudioData(roh);

  const laenge = Math.min(Math.floor(TON_SEKUNDEN * RATE), gelesen.length);
  if (laenge <= 0) throw new Error('leer');

  /*
   * Alle Kanaele auf einen mitteln.
   *
   * Nur den linken zu nehmen waere billiger und gelegentlich falsch: Auf
   * manchen Aufnahmen liegt die Pointe im rechten Kanal, und die waere dann
   * weg.
   */
  const werte = new Float32Array(laenge);
  for (let k = 0; k < gelesen.numberOfChannels; k += 1) {
    const kanal = gelesen.getChannelData(k);
    for (let i = 0; i < laenge; i += 1) werte[i] = (werte[i] ?? 0) + (kanal[i] ?? 0);
  }
  const teiler = Math.max(1, gelesen.numberOfChannels);
  const blende = Math.min(Math.floor(BLENDE * RATE), Math.floor(laenge / 2));
  for (let i = 0; i < laenge; i += 1) {
    let wert = (werte[i] ?? 0) / teiler;
    if (blende > 0) {
      if (i < blende) wert *= i / blende;
      else if (i >= laenge - blende) wert *= (laenge - 1 - i) / blende;
    }
    werte[i] = wert;
  }

  return alsWavDataUrl(werte);
}

/** 16-Bit-PCM-WAV, Mono, als data-URL. */
function alsWavDataUrl(werte: Float32Array): string {
  const bytes = new ArrayBuffer(44 + werte.length * 2);
  const sicht = new DataView(bytes);
  const text = (ort: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) sicht.setUint8(ort + i, s.charCodeAt(i));
  };

  text(0, 'RIFF');
  sicht.setUint32(4, 36 + werte.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  sicht.setUint32(16, 16, true); // Laenge des fmt-Blocks
  sicht.setUint16(20, 1, true); // 1 = unkomprimiertes PCM
  sicht.setUint16(22, 1, true); // Kanaele
  sicht.setUint32(24, RATE, true);
  sicht.setUint32(28, RATE * 2, true); // Bytes je Sekunde
  sicht.setUint16(32, 2, true); // Bytes je Abtastwert
  sicht.setUint16(34, 16, true); // Bits
  text(36, 'data');
  sicht.setUint32(40, werte.length * 2, true);

  for (let i = 0; i < werte.length; i += 1) {
    // Begrenzen, nicht ueberlaufen lassen: Ein Wert ueber 1 wuerde sonst als
    // grosse negative Zahl abgelegt — aus einem lauten Ton wuerde Krachen.
    const wert = Math.max(-1, Math.min(1, werte[i] ?? 0));
    sicht.setInt16(44 + i * 2, Math.round(wert * 32767), true);
  }

  return `data:audio/wav;base64,${alsBase64(new Uint8Array(bytes))}`;
}

/**
 * Bytes nach Base64.
 *
 * In Haeppchen und nicht in einem Zug: `String.fromCharCode(...bytes)` legt
 * jedes Byte als eigenes Argument auf den Aufrufstapel, und bei 35 000 Bytes
 * ist der voll ("Maximum call stack size exceeded"). Genau daran scheitert
 * dieser Einzeiler in jeder zweiten Anleitung im Netz.
 */
function alsBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(s);
}
