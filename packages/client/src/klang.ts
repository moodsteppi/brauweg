/**
 * Klang — Töne und Musik für beide Spieltische und den Hub.
 *
 * Eine Datei für alles, weil Doppelkopf und Zauberer dieselben Dinge tun: Es
 * wird gegeben, eine Karte fällt, ein Stich wird eingezogen, jemand sagt
 * etwas an, am Ende steht eine Abrechnung. Wer hier einen Klang ergänzt,
 * ergänzt ihn für beide Tische — genau wie bei den Emotes.
 *
 * Drei Entscheidungen, die den Aufbau erklären:
 *
 * 1. **Töne laufen über die Web-Audio-Schnittstelle, Musik über ein
 *    gewöhnliches `<audio>`-Element.** Töne müssen sofort kommen und oft
 *    gleichzeitig — dafür ist ein einmal entschlüsselter Puffer da. Musik ist
 *    lang und darf strömen. Der zweite Grund ist wichtiger: Ein `<audio>`
 *    ohne Web-Audio-Anschluss braucht keine CORS-Kopfzeilen. Wenn die Musik
 *    später auf einen eigenen Ort umzieht (siehe `docs/KLANG.md`), reicht
 *    dafür eine Umgebungsvariable und keine Umbauarbeit.
 *
 * 2. **`navigator.audioSession.type = 'ambient'`.** Das ist die eine Zeile,
 *    die Spotify am Leben lässt. Ohne sie stuft iOS eine Seite, die Ton
 *    abspielt, als "playback" ein und hält alles andere an — man startet eine
 *    Partie und die Musik im Hintergrund ist weg. "ambient" heißt: Wir mischen
 *    uns unter, wir verdrängen nichts. Preis dafür: Der Klingelschalter am
 *    iPhone schaltet uns mit stumm. Das ist die richtige Seite des Tauschs,
 *    aber es steht auch so in den Einstellungen, sonst hält man es für kaputt.
 *
 * 3. **Eine fehlende Datei bleibt still.** Kein Fehler in der Konsole, keine
 *    Ausnahme, keine kaputte Oberfläche. Solange die Musikstücke noch nicht
 *    ausgesucht sind, darf `musikAn('tisch')` einfach nichts tun.
 */

/** Alles, was klingen kann. Mehrere Dateien je Kennung = Abwechslung. */
const DATEIEN = {
  // Karten. Drei Varianten fürs Legen, weil in einer Partie vierzig Mal
  // gelegt wird und derselbe Klick beim zwanzigsten Mal auffällt.
  'karte-legen': ['karte-legen-1', 'karte-legen-2', 'karte-legen-3'],
  'karte-geben': ['karte-geben-1', 'karte-geben-2', 'karte-geben-3'],
  mischen: ['mischen'],
  'stich-ein': ['stich-ein-1', 'stich-ein-2'],

  // Am Tisch.
  dran: ['dran'],
  ansage: ['ansage'],
  emote: ['emote'],
  'runde-ende': ['runde-ende'],
  fehler: ['fehler'],

  // Oberfläche.
  tipp: ['tipp'],
  'blatt-auf': ['blatt-auf'],
  'blatt-zu': ['blatt-zu'],
  schalter: ['schalter'],

  // Belohnung.
  kauf: ['kauf'],
  truhe: ['truhe'],
  stufe: ['stufe'],
  sieg: ['sieg'],
  niederlage: ['niederlage'],
} as const;

export type Klangname = keyof typeof DATEIEN;

/**
 * Wie die Klangpakete heißen.
 *
 * Steht hier und nicht im Katalog auf dem Server, aus demselben Grund wie bei
 * Szenerien und Blättern: **Der Server kennt Kennung und Preis, nie das
 * Aussehen** — und wie etwas heißt, gehört zum Aussehen.
 */
export const PAKET_NAMEN: Record<string, string> = {
  grund: 'Grundklang',
  glas: 'Glas',
};

/**
 * Woher die Dateien kommen.
 *
 * Standard ist der eigene Ursprung. Sobald die Musik zu schwer für das Repo
 * wird — und das wird sie, sobald jedes Biom und jedes Spiel eine eigene
 * Schleife hat —, zeigt `VITE_KLANG_BASIS` auf einen eigenen Ort, und keine
 * Zeile hier ändert sich. Töne bleiben immer beim Ursprung: 123 kB für alle
 * zusammen sind kein Auslagerungsfall, und sie müssen sofort da sein.
 */
const MUSIK_BASIS = (import.meta.env.VITE_KLANG_BASIS as string | undefined) ?? '';

export type Einstellungen = {
  /** 0–100. */
  sounds: number;
  /** 0–100. */
  musik: number;
  vibration: boolean;
  /**
   * Gekauftes Klangpaket, oder null für den Grundsatz.
   *
   * Ein Paket muss **nicht** alle 23 Klänge mitbringen. Fehlt einer, greift
   * der Grundsatz — so kostet ein Paket, das nur die Karten und die Knöpfe
   * austauscht, auch nur diese paar Dateien. Ohne diesen Rückfall müsste
   * jedes Paket vollständig sein, und dann entstünde nie ein zweites.
   */
  paket: string | null;
  /** Gekaufte Musik, oder null für keine. */
  stueck: string | null;
};

/**
 * Die Regler stehen am Gerät, nicht am Konto.
 *
 * Lautstärke ist eine Eigenschaft des Kopfhörers und des Raums, nicht des
 * Spielers: Wer abends auf dem Sofa leise spielt, will morgens in der Bahn
 * nicht dieselbe Zahl. Ein Konto über zwei Geräte hinweg gleichzuschalten
 * wäre hier keine Bequemlichkeit, sondern ein Ärgernis. Deshalb
 * localStorage, wie bei `tischZoom`.
 */
const SCHLUESSEL = 'brauweg.klang';

/** Musik "einfach normal" an — wer sie nicht will, dreht sie in zwei Tipps weg. */
const VORGABE: Einstellungen = {
  sounds: 80,
  musik: 50,
  vibration: true,
  paket: null,
  stueck: null,
};

function lies(): Einstellungen {
  try {
    const roh: unknown = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '');
    if (typeof roh !== 'object' || roh === null) return { ...VORGABE };
    const teil = roh as Partial<Einstellungen>;
    return {
      sounds: zahlImRahmen(teil.sounds, VORGABE.sounds),
      musik: zahlImRahmen(teil.musik, VORGABE.musik),
      vibration: typeof teil.vibration === 'boolean' ? teil.vibration : VORGABE.vibration,
      paket: typeof teil.paket === 'string' ? teil.paket : null,
      stueck: typeof teil.stueck === 'string' ? teil.stueck : null,
    };
  } catch {
    // Kaputter oder fehlender Eintrag: Vorgabe. Ein Regler ist nichts, wofür
    // man jemanden mit einer Fehlermeldung behelligt.
    return { ...VORGABE };
  }
}

const zahlImRahmen = (wert: unknown, ersatz: number): number =>
  typeof wert === 'number' && Number.isFinite(wert) ? Math.min(100, Math.max(0, Math.round(wert))) : ersatz;

let einstellungen = lies();

/** Wer beim Ändern mitbekommen will, dass sich etwas geändert hat. */
const horcher = new Set<() => void>();

export const holeEinstellungen = (): Einstellungen => einstellungen;

export function abonniere(ruf: () => void): () => void {
  horcher.add(ruf);
  return () => horcher.delete(ruf);
}

export function setzeEinstellungen(teil: Partial<Einstellungen>): void {
  const vorher = einstellungen;
  einstellungen = { ...einstellungen, ...teil };
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(einstellungen));
  } catch {
    // Privater Modus, voller Speicher: Dann gilt die Einstellung eben nur für
    // diese Sitzung. Kein Grund, den Regler nicht zu bewegen.
  }
  // Ein neues Paket macht jeden gemerkten Puffer wertlos — die Schlüssel
  // tragen das Paket zwar mit, aber der Speicher füllt sich sonst mit
  // Klängen, die niemand mehr hört.
  if (teil.paket !== undefined && teil.paket !== vorher.paket) puffer.clear();
  richteMusik();
  for (const ruf of horcher) ruf();
}

/**
 * Musik in Einklang mit den Einstellungen bringen.
 *
 * Die eine Stelle, die entscheidet, ob gerade etwas laufen soll: Es braucht
 * einen Bildschirm, der Musik will (`musikGewuenscht`), ein gewähltes Stück
 * und einen Regler über null. Fällt eines davon weg, wird angehalten; kommt
 * es zurück, geht es weiter.
 *
 * Ohne diese Bündelung fällt genau ein Fall durch: Musik steht auf 0, jemand
 * betritt den Tisch, und dann zieht er den Regler hoch. Es liefe nichts, bis
 * er den Bildschirm wechselt.
 */
function richteMusik(): void {
  const soll = musikGewuenscht && einstellungen.musik > 0 ? einstellungen.stueck : null;
  spieleStueck(soll);
}

/**
 * Regler auf Verstärkung.
 *
 * Quadratisch, nicht linear: Das Ohr hört Lautstärke ungefähr logarithmisch.
 * Ein linearer Regler ist bei 50 schon fast auf voller Lautstärke, und die
 * untere Hälfte des Weges tut dann nichts mehr.
 */
const verstaerkung = (regler: number): number => (regler / 100) ** 2;

// ---------------------------------------------------------------------------
// Töne
// ---------------------------------------------------------------------------

let kontext: AudioContext | null = null;
let tonWeg: GainNode | null = null;
const puffer = new Map<string, AudioBuffer | null>();

/**
 * Die Tonsitzung anmelden, bevor irgendetwas klingt.
 *
 * Safari ab 16.4 kennt das; andere Browser noch nicht, dort ist der Zugriff
 * schlicht undefiniert und der Aufruf verpufft. Deshalb ohne Umschweife in
 * einem try — eine Funktion, die es nicht gibt, ist hier kein Fehlerfall,
 * sondern der Normalfall auf dem halben Markt.
 */
function meldeTonsitzungAn(): void {
  try {
    const sitzung = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (sitzung) sitzung.type = 'ambient';
  } catch {
    /* Kennt der Browser nicht. */
  }
}

/**
 * Den Tonweg aufbauen. Muss aus einer Nutzergeste heraus geschehen: iOS und
 * Chrome starten einen AudioContext sonst im Zustand "suspended", und der
 * erste Klang bleibt stumm.
 */
function weckeAuf(): AudioContext | null {
  if (kontext) {
    if (kontext.state === 'suspended') void kontext.resume();
    return kontext;
  }
  try {
    meldeTonsitzungAn();
    const Bau =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Bau) return null;
    kontext = new Bau({ latencyHint: 'interactive' });
    tonWeg = kontext.createGain();
    tonWeg.connect(kontext.destination);
    return kontext;
  } catch {
    // Kein Ton möglich — das Spiel läuft trotzdem.
    return null;
  }
}

/**
 * Wo eine Datei liegt: erst im gewählten Paket, sonst im Grundsatz.
 *
 * Der Schlüssel im Zwischenspeicher trägt das Paket mit, sonst hörte man nach
 * einem Paketwechsel weiter die alten Puffer.
 */
const wege = (datei: string): { schluessel: string; pfade: string[] } => {
  const paket = einstellungen.paket;
  return {
    schluessel: paket ? `${paket}/${datei}` : datei,
    pfade: paket ? [`/klang/${paket}/${datei}.mp3`, `/klang/${datei}.mp3`] : [`/klang/${datei}.mp3`],
  };
};

async function holePuffer(datei: string): Promise<AudioBuffer | null> {
  const { schluessel, pfade } = wege(datei);
  const da = puffer.get(schluessel);
  if (da !== undefined) return da;
  // Platzhalter setzen, damit zwei gleichzeitige Anfragen nicht zweimal laden.
  puffer.set(schluessel, null);
  try {
    let antwort: Response | null = null;
    for (const pfad of pfade) {
      const versuch = await fetch(pfad);
      if (versuch.ok) {
        antwort = versuch;
        break;
      }
    }
    if (!antwort) return null;
    const roh = await antwort.arrayBuffer();
    const ktx = kontext ?? weckeAuf();
    if (!ktx) return null;
    const fertig = await ktx.decodeAudioData(roh);
    puffer.set(schluessel, fertig);
    return fertig;
  } catch {
    // Datei fehlt oder ist unlesbar: still bleiben. Genau dieser Zweig hält
    // das System benutzbar, solange nicht jeder Klang geliefert ist.
    return null;
  }
}

/**
 * Einen Klang abspielen. Kostet nichts, wirft nie, und tut bei Regler 0 gar
 * nichts — auch nicht laden.
 */
export function spiele(name: Klangname, lautstaerke = 1): void {
  if (einstellungen.sounds === 0) return;
  const varianten = DATEIEN[name];
  const datei = varianten[Math.floor(Math.random() * varianten.length)];
  const ktx = weckeAuf();
  if (!ktx || !tonWeg) return;

  void holePuffer(datei).then((buf) => {
    if (!buf || !kontext || !tonWeg) return;
    // Zwischen Anfrage und Ankunft kann der Regler auf 0 gegangen sein.
    if (einstellungen.sounds === 0) return;
    const quelle = kontext.createBufferSource();
    quelle.buffer = buf;
    const regler = kontext.createGain();
    regler.gain.value = verstaerkung(einstellungen.sounds) * lautstaerke;
    quelle.connect(regler);
    regler.connect(tonWeg);
    quelle.start();
  });
}

/**
 * Alles vorladen, damit der erste Kartenklick nicht auf das Netz wartet.
 * 123 kB über 23 Dateien — das ist weniger als ein einziges Kartenbild.
 */
export function ladeVor(): void {
  if (einstellungen.sounds === 0) return;
  if (!weckeAuf()) return;
  for (const varianten of Object.values(DATEIEN)) {
    for (const datei of varianten) void holePuffer(datei);
  }
}

// ---------------------------------------------------------------------------
// Musik
// ---------------------------------------------------------------------------

let musik: HTMLAudioElement | null = null;
/** Der Dateiname dessen, was gerade tatsächlich läuft. */
let musikStueck: string | null = null;
/** Ob der aktuelle Bildschirm überhaupt Musik will. */
let musikGewuenscht = false;
let blende: number | null = null;

function legeMusikLautstaerkeAn(): void {
  if (musik) musik.volume = verstaerkung(einstellungen.musik);
}

/**
 * Sanft überblenden statt hart umschalten. Ein Schnitt mitten in der Musik
 * beim Wechsel vom Hub an den Tisch klingt nach Fehler, nicht nach Wechsel.
 */
function blendeAus(element: HTMLAudioElement, danach: () => void): void {
  if (blende !== null) window.clearInterval(blende);
  const start = element.volume;
  let schritt = 0;
  blende = window.setInterval(() => {
    schritt += 1;
    element.volume = Math.max(0, start * (1 - schritt / 12));
    if (schritt >= 12) {
      if (blende !== null) window.clearInterval(blende);
      blende = null;
      element.pause();
      danach();
    }
  }, 35);
}

/**
 * Genau das Stück spielen, das laufen soll — oder gar keines.
 *
 * `stueck` ist der Dateiname ohne Endung und bewusst eine freie Zeichenkette:
 * Ein im Shop gekauftes Stück läuft damit ohne eine einzige Codeänderung.
 */
function spieleStueck(stueck: string | null): void {
  if (stueck === musikStueck) {
    // Gleiches Stück, aber vielleicht kam der Regler gerade von 0 zurück.
    if (musik && musik.paused && stueck !== null) void musik.play().catch(() => undefined);
    if (musik) legeMusikLautstaerkeAn();
    return;
  }
  musikStueck = stueck;

  if (stueck === null) {
    if (musik) blendeAus(musik, () => undefined);
    return;
  }

  const starte = (): void => {
    meldeTonsitzungAn();
    if (!musik) {
      musik = new Audio();
      musik.loop = true;
      musik.preload = 'none';
      // Schon jetzt gesetzt, obwohl die Musik noch beim eigenen Ursprung
      // liegt: Zieht sie später um, ist das eine Sache der Umgebung und
      // nicht des Codes.
      musik.crossOrigin = 'anonymous';
    }
    musik.src = `${MUSIK_BASIS}/klang/${stueck}.mp3`;
    musik.volume = verstaerkung(einstellungen.musik);
    // Fehlt das Stück, lehnt play() ab — dann bleibt es eben still.
    void musik.play().catch(() => undefined);
  };

  if (musik && !musik.paused) blendeAus(musik, starte);
  else starte();
}

/**
 * Ein Bildschirm meldet an, ob er Musik möchte.
 *
 * Bewusst nur "ja oder nein" und nicht "welches Stück": Was läuft, entscheidet
 * die Einstellung — sonst müsste jeder Bildschirm wissen, welche Stücke dem
 * Spieler gehören, und die Auswahl im Shop stünde an vier Stellen im Code.
 */
export function musikAn(gewuenscht: boolean): void {
  musikGewuenscht = gewuenscht;
  richteMusik();
}

/** Läuft gerade Musik, und welche. */
export const laufendesStueck = (): string | null => musikStueck;

// ---------------------------------------------------------------------------
// Vibration
// ---------------------------------------------------------------------------

/**
 * Kann dieses Gerät überhaupt vibrieren?
 *
 * Android sagt hier ja, das iPhone nein — Safari kennt die Schnittstelle
 * schlicht nicht, weder am Handy noch am Rechner, und es gibt auch keinen
 * Ersatzweg. Die Einstellung wird deshalb nicht versteckt, sondern abgeblendet
 * mit einem Satz dazu: Ein Schalter, der nichts tut, ist ärgerlicher als ein
 * Schalter, der erklärt, warum er nichts tut.
 */
export const kannVibrieren = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function vibriere(muster: number | number[] = 12): void {
  if (!einstellungen.vibration || !kannVibrieren()) return;
  try {
    navigator.vibrate(muster);
  } catch {
    /* Manche Browser verbieten es je nach Zustand der Seite. */
  }
}

// ---------------------------------------------------------------------------
// Anschluss an die Seite
// ---------------------------------------------------------------------------

/**
 * Beim ersten Antippen den Ton freischalten und alles vorladen.
 *
 * Vorher geht es nicht: Ohne Nutzergeste bleibt der AudioContext angehalten.
 * Der Horcher entfernt sich selbst — er wird genau einmal gebraucht.
 */
export function starteKlang(): void {
  meldeTonsitzungAn();
  const einmal = (): void => {
    weckeAuf();
    ladeVor();
    window.removeEventListener('pointerdown', einmal);
    window.removeEventListener('keydown', einmal);
  };
  window.addEventListener('pointerdown', einmal, { once: true });
  window.addEventListener('keydown', einmal, { once: true });

  /**
   * Beim Wegschalten den Ton loslassen.
   *
   * Ein laufender AudioContext hält auf Android den Tonfokus fest. Wer die
   * Seite in den Hintergrund schiebt und Spotify weiterhört, soll uns nicht
   * mehr im Weg haben. Beim Zurückkommen wird von selbst wieder geweckt.
   */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (musik && !musik.paused) musik.pause();
      if (kontext && kontext.state === 'running') void kontext.suspend();
    } else {
      if (kontext && kontext.state === 'suspended') void kontext.resume();
      richteMusik();
    }
  });
}
