/**
 * Toene von Mememory — vollstaendig im Browser erzeugt, ohne eine einzige
 * Datei.
 *
 * Warum synthetisch und nicht als MP3 wie der Rest der Plattform (docs/KLANG.md)?
 * Drei Gruende, in dieser Reihenfolge:
 *
 *   1. Echte Meme-Toene sind fremde Aufnahmen. `docs/KLANG.md` fuehrt fuer
 *      jeden Ton Herkunft und Lizenz — ein aus dem Netz gezogener Schnipsel
 *      haette dort keine Zeile, die man ehrlich ausfuellen koennte.
 *   2. Der Auftrag nennt den Klang ausdruecklich als Demo mit der geringsten
 *      Prioritaet. Synthese kostet null Bytes Uebertragung und keine
 *      Ladephase — und "keine langen Ladephasen" steht weit oben.
 *   3. Auf diesem Rechner fehlt das Klangwerkzeug aus CLAUDE.md Regel 4
 *      (siehe docs/MEMEMORY-TICKETS.md, T-01). Es gaebe also gar keinen Weg,
 *      eine Aufnahme regelkonform nach MP3 zu wandeln.
 *
 * Der Ton ist damit bewusst ein Cartoon-Ton und kein Originalzitat. Wer
 * spaeter echte Schnipsel einbaut, ersetzt genau diese Datei.
 *
 * **Die Meme-Toene sind die Ausnahme, und sie widersprechen dem nicht.**
 * Seit dem 28. August haengt an jedem hochgeladenen Motiv ein Schnipsel von
 * hoechstens acht Zehntelsekunden. Er kommt nicht aus dem Repository, sondern
 * aus der Datenbank — hochgeladen von der Aufsicht, wie das Bild daneben.
 * `docs/KLANG.md` fuehrt Herkunft und Lizenz fuer die Toene DER PLATTFORM;
 * ein Meme-Ton ist Inhalt, kein Bestandteil der Anwendung, und steht dort
 * genauso wenig wie das Bild, zu dem er gehoert.
 */

import { motivTonPfad } from './bildpfad';

let kontext: AudioContext | null = null;
let summe: GainNode | null = null;

const SCHLUESSEL = 'mememory.ton';
/**
 * Der Regler, seit dem 27. August. Er steht neben dem alten Schalter und
 * nicht an seiner Stelle: Wer den Ton frueher eingeschaltet hat, soll ihn
 * nach dem Deploy noch anhaben, und ein neuer Schluessel waere fuer den
 * genauso still wie fuer alle anderen.
 */
const SCHLUESSEL_STAERKE = 'mememory.lautstaerke';

/**
 * Voll aufgedreht sind diese Toene am Handy unangenehm laut — deshalb liegt
 * schon die Obergrenze des Reglers hier und nicht bei 1.
 */
const OBERGRENZE = 0.28;

/** Vorgabe des Reglers, sobald jemand den Ton ueberhaupt einschaltet. */
const VORGABE_STAERKE = 70;

/** Der Ton ist opt-in — Vorgabe aus, so steht es im Auftrag. */
export function tonAn(): boolean {
  try {
    return window.localStorage.getItem(SCHLUESSEL) === 'an';
  } catch {
    return false;
  }
}

export function setzeTon(an: boolean): void {
  try {
    window.localStorage.setItem(SCHLUESSEL, an ? 'an' : 'aus');
  } catch {
    /* Privater Modus: dann gilt der Schalter nur fuer diese Sitzung. */
  }
  if (an) starte();
}

/** Reglerstand 0..100. Ohne Eintrag die Vorgabe. */
export function lautstaerke(): number {
  try {
    const roh = Number(window.localStorage.getItem(SCHLUESSEL_STAERKE));
    if (!Number.isFinite(roh)) return VORGABE_STAERKE;
    return Math.min(100, Math.max(0, Math.round(roh)));
  } catch {
    return VORGABE_STAERKE;
  }
}

/**
 * Den Regler setzen — und ihn dabei zum Schalter machen.
 *
 * Null heisst aus, alles darueber an. Zwei getrennte Bedienelemente fuer
 * dieselbe Frage ("hoere ich etwas?") waeren eine Falle: Ein Regler auf
 * siebzig, aus dem nichts kommt, weil daneben noch ein Schalter steht, sieht
 * nach kaputt aus.
 *
 * Und der Zug am Regler IST die Nutzergeste, die der AudioContext braucht
 * (siehe `starte`) — deshalb wird er hier gleich mit gestartet.
 */
export function setzeLautstaerke(wert: number): void {
  const stand = Math.min(100, Math.max(0, Math.round(wert)));
  try {
    window.localStorage.setItem(SCHLUESSEL_STAERKE, String(stand));
  } catch {
    /* Privater Modus: dann gilt der Regler nur fuer diese Sitzung. */
  }
  setzeTon(stand > 0);
  // Ein laufender Kontext soll die neue Zahl sofort tragen, nicht erst beim
  // naechsten Aufbau — sonst zieht man den Regler und hoert die alte Stufe.
  if (summe) summe.gain.value = verstaerkung(stand);
}

/**
 * Reglerstand auf Verstaerkung. Quadratisch, nicht linear — dieselbe
 * Ueberlegung wie in klang.ts: Das Ohr hoert ungefaehr logarithmisch, ein
 * linearer Regler taete auf der unteren Haelfte des Weges fast nichts.
 */
const verstaerkung = (stand: number): number => (stand / 100) ** 2 * OBERGRENZE;

/**
 * Der AudioContext entsteht erst beim Einschalten.
 *
 * Nicht aus Sparsamkeit: Safari und Chrome starten ihn ausserhalb einer
 * Nutzergeste im Zustand `suspended`, und ein stumm gebliebener Kontext
 * bleibt es fuer den Rest der Seite. Der Schalter IST die Geste.
 */
function starte(): void {
  if (kontext) {
    void kontext.resume();
    return;
  }
  const Konstruktor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Konstruktor) return;
  kontext = new Konstruktor();
  summe = kontext.createGain();
  summe.gain.value = verstaerkung(lautstaerke());
  summe.connect(kontext.destination);
}

function bereit(): { ctx: AudioContext; aus: GainNode } | null {
  if (!tonAn()) return null;
  if (!kontext) starte();
  if (!kontext || !summe) return null;
  if (kontext.state === 'suspended') void kontext.resume();
  return { ctx: kontext, aus: summe };
}

/** Ein Ton mit Tonhoehenverlauf. */
function ton(
  ctx: AudioContext,
  ziel: AudioNode,
  form: OscillatorType,
  vonHz: number,
  nachHz: number,
  ab: number,
  dauer: number,
  lautstaerke = 1,
): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = form;
  o.frequency.setValueAtTime(vonHz, ab);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, nachHz), ab + dauer);
  // Immer mit einer kurzen Rampe ein- und ausblenden: Ein hart gestarteter
  // Oszillator knackt, und zwanzig Knackser je Partie hoert man.
  g.gain.setValueAtTime(0.0001, ab);
  g.gain.exponentialRampToValueAtTime(lautstaerke, ab + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ab + dauer);
  o.connect(g);
  g.connect(ziel);
  o.start(ab);
  o.stop(ab + dauer + 0.02);
}

/** Rauschen — Grundlage fuer Wisch- und Jubelgeraeusche. */
function rauschen(
  ctx: AudioContext,
  ziel: AudioNode,
  ab: number,
  dauer: number,
  vonHz: number,
  nachHz: number,
  lautstaerke = 1,
): void {
  const laenge = Math.max(1, Math.floor(ctx.sampleRate * dauer));
  const puffer = ctx.createBuffer(1, laenge, ctx.sampleRate);
  const daten = puffer.getChannelData(0);
  for (let i = 0; i < laenge; i++) daten[i] = Math.random() * 2 - 1;
  const quelle = ctx.createBufferSource();
  quelle.buffer = puffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(vonHz, ab);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, nachHz), ab + dauer);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ab);
  g.gain.exponentialRampToValueAtTime(lautstaerke, ab + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ab + dauer);
  quelle.connect(filter);
  filter.connect(g);
  g.connect(ziel);
  quelle.start(ab);
  quelle.stop(ab + dauer + 0.02);
}

export type Klang = 'dreh' | 'treffer' | 'daneben' | 'sieg' | 'niederlage' | 'gefunden';

export function spieleKlang(welcher: Klang): void {
  const b = bereit();
  if (!b) return;
  const { ctx, aus } = b;
  const t = ctx.currentTime;

  switch (welcher) {
    // Karte umdrehen: kurzes Wischen plus ein Blubb. Absichtlich sehr kurz —
    // es passiert bis zu vierzig Mal je Partie.
    case 'dreh':
      rauschen(ctx, aus, t, 0.09, 900, 3200, 0.35);
      ton(ctx, aus, 'triangle', 420, 760, t, 0.09, 0.3);
      break;

    // Treffer: das klassische aufsteigende Dreiklang-Zwinkern.
    case 'treffer':
      ton(ctx, aus, 'square', 660, 660, t, 0.09, 0.35);
      ton(ctx, aus, 'square', 880, 880, t + 0.08, 0.09, 0.35);
      ton(ctx, aus, 'square', 1320, 1320, t + 0.16, 0.16, 0.32);
      break;

    // Fehlgriff: die abrutschende Posaune. Sawtooth, weil sie schnarren soll.
    case 'daneben':
      ton(ctx, aus, 'sawtooth', 330, 120, t, 0.42, 0.22);
      break;

    // Ein Punkt fuer den Gegner: dasselbe Motiv, eine Oktave tiefer und
    // kuerzer. Man soll hoeren, DASS etwas passiert ist, ohne mitzufeiern.
    case 'gefunden':
      ton(ctx, aus, 'triangle', 330, 330, t, 0.08, 0.22);
      ton(ctx, aus, 'triangle', 440, 440, t + 0.07, 0.12, 0.2);
      break;

    // Sieg: Fanfare plus ein Rauschschwall, der wie Beifall klingt.
    case 'sieg':
      [523, 659, 784, 1047].forEach((hz, i) => {
        ton(ctx, aus, 'square', hz, hz, t + i * 0.11, 0.2, 0.3);
      });
      for (let i = 0; i < 7; i++) {
        rauschen(ctx, aus, t + 0.42 + i * 0.09, 0.2, 1400, 2600, 0.16);
      }
      break;

    // Niederlage: dieselbe Fanfare rueckwaerts und schief.
    case 'niederlage':
      [523, 440, 349, 262].forEach((hz, i) => {
        ton(ctx, aus, 'sawtooth', hz, hz * 0.98, t + i * 0.14, 0.26, 0.22);
      });
      break;
  }
}

// ---------------------------------------------------------------------------
// Meme-Toene
// ---------------------------------------------------------------------------

/**
 * Entpackte Meme-Toene, Kennung -> Puffer. `null` heisst: nachgesehen, es gibt
 * keinen.
 *
 * Der Merker fuer „gibt es nicht" ist so wichtig wie der Puffer selbst: Ohne
 * ihn fragte jeder Wurf desselben stummen Motivs wieder an.
 */
const memeToene = new Map<string, AudioBuffer | null>();
/** Was gerade unterwegs ist — damit dasselbe Motiv nicht doppelt geholt wird. */
const unterwegs = new Set<string>();

/**
 * Die Toene einer Partie im Voraus holen.
 *
 * **Vorladen und nicht beim Wurf holen.** Ein Flug dauert 1450 ms; ein Ton,
 * der erst danach ankommt, kommt zum falschen Bild. Der Aufrufer schickt nur
 * die Kennungen, von denen der Server gesagt hat, dass sie einen Ton haben
 * (`toene` in /api/mememory/motive) — sonst waeren es zwei Dutzend Abrufe je
 * Partie, von denen fast alle mit „nicht gefunden" enden.
 *
 * Bei ausgeschaltetem Ton passiert gar nichts: kein Kontext, kein Abruf, kein
 * Byte. Wer nichts hoeren will, soll auch nichts laden.
 */
export async function ladeMemeToene(kennungen: readonly string[]): Promise<void> {
  const b = bereit();
  if (!b) return;
  await Promise.all(
    kennungen.map(async (kennung) => {
      if (memeToene.has(kennung) || unterwegs.has(kennung)) return;
      const pfad = motivTonPfad(kennung);
      if (!pfad) return;
      unterwegs.add(kennung);
      try {
        const antwort = await fetch(pfad);
        if (!antwort.ok) {
          // Auch das Nein wird gemerkt. Ein Motiv ohne Ton bleibt eines.
          memeToene.set(kennung, null);
          return;
        }
        // Ueber den Kontext entpacken und nicht ueber ein <audio>-Element:
        // Die Inhaltsrichtlinie der Produktion erlaubt `media-src` nur von
        // der eigenen Herkunft, und ein Puffer laesst sich ausserdem durch
        // denselben Regler schicken wie alle anderen Toene.
        memeToene.set(kennung, await b.ctx.decodeAudioData(await antwort.arrayBuffer()));
      } catch {
        memeToene.set(kennung, null);
      } finally {
        unterwegs.delete(kennung);
      }
    }),
  );
}

/**
 * Den Ton eines Memes spielen — falls es einen gibt und er schon da ist.
 *
 * Bewusst ohne Nachladen: Diese Funktion laeuft in dem Moment, in dem das Bild
 * losfliegt. Was jetzt nicht da ist, kommt zu spaet; dann bleibt es eben
 * stumm, und beim naechsten Wurf ist der Ton geladen.
 *
 * Etwas lauter als die synthetischen Toene (Faktor 1,6): Die sind auf einen
 * Cartoon-Pieps hin gebaut, ein Meme-Schnipsel ist eine Aufnahme mit ganz
 * anderem Pegel und ginge daneben unter.
 */
export function spieleMemeTon(kennung: string): void {
  const b = bereit();
  if (!b) return;
  const puffer = memeToene.get(kennung);
  if (!puffer) return;
  const quelle = b.ctx.createBufferSource();
  quelle.buffer = puffer;
  const g = b.ctx.createGain();
  g.gain.value = 1.6;
  quelle.connect(g);
  g.connect(b.aus);
  quelle.start();
}

/**
 * Einen Ton zur Probe spielen, ohne Ruecksicht auf den Schalter.
 *
 * Fuer den Bestandseditor: Dort ist das Abspielen ein ausdruecklicher
 * Handgriff der Aufsicht. Ein Knopf, der wegen eines Schalters an ganz
 * anderer Stelle stumm bleibt, sieht kaputt aus — und der Tipp darauf IST die
 * Nutzergeste, die der Kontext braucht.
 *
 * Deshalb hier ein eigener Weg mit fester Lautstaerke, direkt an den Ausgang:
 * Der Regler des Spiels gehoert dem Spiel.
 */
export async function spieleTonProbe(dataUrl: string): Promise<void> {
  // Von Hand entpackt und nicht ueber `fetch('data:...')`: Die
  // Inhaltsrichtlinie der Produktion laesst als `connect-src` nur die eigene
  // Herkunft zu, und ein `data:` gehoert nicht dazu. Auf dem
  // Entwicklungsserver faellt das nicht auf — Vite setzt gar keine Richtlinie.
  const komma = dataUrl.indexOf(',');
  if (komma < 0) return;
  const roh = atob(dataUrl.slice(komma + 1));
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) bytes[i] = roh.charCodeAt(i);
  await probe(bytes.buffer);
}

/** Dasselbe fuer einen Ton, der beim Server liegt. */
export async function spieleTonProbeVon(pfad: string): Promise<void> {
  const antwort = await fetch(pfad);
  if (!antwort.ok) return;
  await probe(await antwort.arrayBuffer());
}

/** Der gemeinsame Teil der beiden Proben. */
async function probe(bytes: ArrayBuffer): Promise<void> {
  if (!kontext) starte();
  if (!kontext) return;
  if (kontext.state === 'suspended') await kontext.resume();
  const puffer = await kontext.decodeAudioData(bytes);
  const quelle = kontext.createBufferSource();
  quelle.buffer = puffer;
  const g = kontext.createGain();
  g.gain.value = 0.9;
  quelle.connect(g);
  g.connect(kontext.destination);
  quelle.start();
}

