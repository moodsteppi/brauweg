/**
 * Die aufgezeichnete Kampfszene in eine Zeitleiste verwandeln — 3D-Fassung.
 *
 * Gelesen wird `../arena-szene.json`, dieselbe Datei, die Probe A abspielt.
 * Sie ist verbindlich: Verglichen werden sollen zwei DARSTELLUNGEN, nicht zwei
 * Kaempfe. Erzeugt wird sie von `../szene-erzeugen.mjs`.
 *
 * WARUM DAS HIER TROTZDEM NEBEN `arena-2d/ablauf.ts` STEHT, statt geteilt zu
 * werden: Die beiden Proben brauchen aus demselben Protokoll verschiedene
 * Dinge. Probe A rechnet Bildschirmorte in Prozent und kennt Haltungen wie
 * "Zuruckzucken", die es nur als Sprite gibt; hier fallen Weltkoordinaten in
 * Metern an und vier Animationsspuren, die im Modell stecken. Eine gemeinsame
 * Zwischenschicht muesste beides koennen und waere fuer eine Wegwerf-Probe
 * mehr Aufwand als die doppelte Rechnung. Geteilt ist, was wirklich dasselbe
 * ist: die Szene selbst und `../arena-einheiten.ts`.
 *
 * Reine Rechnerei ohne React und ohne three — damit sie sich ohne Bildschirm
 * pruefen laesst (ablauf.test.ts).
 *
 * WARUM `?raw` UND NICHT EIN JSON-IMPORT: Die tsconfig des Clients hat
 * `resolveJsonModule` nicht an, und eine Probe ist kein Anlass, an den
 * Uebersetzer-Einstellungen des ganzen Pakets zu drehen. `?raw` kommt aus
 * `vite/client` und ist bereits typisiert.
 */

import roh from '../arena-szene.json?raw';
import { type Rolle, namenVon, rolleVon } from '../arena-einheiten';

// ---------------------------------------------------------------------------
// Was in der Datei steht
// ---------------------------------------------------------------------------

/** Seite 0 steht unten in der Arena, Seite 1 oben. */
export type Seite = 0 | 1;

export interface Kaempferstand {
  readonly id: number;
  readonly seite: Seite;
  readonly einheitId: string;
  readonly stufe: number;
  readonly platz: number;
  readonly leben: number;
  readonly hoechstesLeben: number;
}

export type Ereignis =
  | {
      readonly art: 'bewegung';
      readonly zeitMs: number;
      readonly wer: number;
      readonly von: number;
      readonly nach: number;
    }
  | {
      readonly art: 'treffer';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly schaden: number;
      readonly lebenDanach: number;
    }
  | { readonly art: 'tod'; readonly zeitMs: number; readonly wer: number }
  | {
      readonly art: 'ende';
      readonly zeitMs: number;
      readonly sieger: Seite | null;
      readonly grund: string;
    };

/** Der Bericht, wie ihn `simuliereKampf()` ausgibt und die Datei ihn traegt. */
export interface Kampfbericht {
  readonly saat: string;
  readonly erstZieher: Seite;
  readonly start: readonly Kaempferstand[];
  readonly ereignisse: readonly Ereignis[];
  readonly sieger: Seite | null;
  readonly grund: string;
  readonly dauerMs: number;
}

export const BERICHT = JSON.parse(roh) as Kampfbericht;

// ---------------------------------------------------------------------------
// Die Geometrie der Arena
// ---------------------------------------------------------------------------

/** Vier Reihen zu fuenf Spalten — beide Bretthaelften zusammen (arena.ts). */
export const ARENA_REIHEN = 4;
export const ARENA_SPALTEN = 5;

/**
 * Wie lange eine Einheit fuer ein Feld braucht. Muss zu `SCHRITT_MS` aus
 * kampf.ts passen: Das Protokoll nennt nur den Zeitpunkt, zu dem ein Schritt
 * BEGINNT. Waere der Wert hier groesser, liefe eine Figur noch, waehrend sie
 * im Protokoll laengst wieder zuschlaegt.
 */
export const SCHRITT_MS = 500;

/**
 * Wie lange ein Treffer als Angriff gezeigt wird.
 *
 * Das Protokoll kennt keine Dauer, nur den Augenblick des Treffers. Der
 * langsamste Angriffstakt im Katalog liegt bei rund 1.700 ms (Tempo 0,6), der
 * schnellste bei 1.000 ms (Tempo 1,05) — 500 ms passen also immer zwischen
 * zwei Schlaege derselben Figur und ueberlappen nie.
 */
export const ANGRIFF_MS = 500;

/**
 * Ein Platz in Weltkoordinaten.
 *
 * Das Raster ist "odd-r": jede ungerade Reihe liegt eine halbe Zelle weiter
 * rechts (brett.ts). Ein odd-r-Versatz gehoert zu SPITZEN Sechsecken, deshalb
 * ist der Spaltenabstand `sqrt(3)` und der Reihenabstand `1,5` — nicht
 * umgekehrt. Mit vertauschten Faktoren stehen die Figuren scheinbar richtig,
 * aber die Abstaende stimmen nicht mehr mit denen des Moduls ueberein, und
 * Nahkaempfer schlagen ueber eine sichtbare Luecke hinweg zu.
 *
 * Der Nullpunkt liegt in der Mitte der Arena, damit die Kamera auf (0,0,0)
 * schauen kann.
 */
export function weltVonPlatz(platz: number): { x: number; z: number } {
  const reihe = Math.floor(platz / ARENA_SPALTEN);
  const spalte = platz % ARENA_SPALTEN;
  const x =
    Math.sqrt(3) * (spalte + 0.5 * (reihe % 2)) - (Math.sqrt(3) * (ARENA_SPALTEN - 1 + 0.5)) / 2;
  const z = 1.5 * reihe - (1.5 * (ARENA_REIHEN - 1)) / 2;
  return { x, z };
}

// ---------------------------------------------------------------------------
// Die Zeitleiste
// ---------------------------------------------------------------------------

/** Ein Schritt von einem Feld aufs naechste. */
export interface Schritt {
  readonly abMs: number;
  readonly bisMs: number;
  readonly von: number;
  readonly nach: number;
}

/** Alles, was eine Figur ueber den ganzen Kampf hinweg tut. */
export interface Spur {
  readonly id: number;
  readonly seite: Seite;
  readonly rolle: Rolle;
  readonly name: string;
  readonly hoechstesLeben: number;
  readonly startPlatz: number;
  readonly schritte: readonly Schritt[];
  /** Zeitpunkte, an denen diese Figur zuschlaegt. */
  readonly angriffe: readonly number[];
  /** Leben nach jedem erlittenen Treffer, aufsteigend nach Zeit. */
  readonly treffer: readonly { readonly zeitMs: number; readonly leben: number }[];
  /** Wann sie faellt — `null`, wenn sie ueberlebt. */
  readonly todMs: number | null;
}

export type Haltung = 'idle' | 'laufen' | 'angriff' | 'tod';

/** Wie eine Figur zu einem Zeitpunkt dasteht. */
export interface Stellung {
  readonly x: number;
  readonly z: number;
  /** Blickrichtung in Bogenmass um die Y-Achse. */
  readonly drehung: number;
  readonly haltung: Haltung;
  /** Anteil des Lebens, 0 bis 1. */
  readonly lebenAnteil: number;
  /** Millisekunden seit Beginn der laufenden Haltung. */
  readonly seitMs: number;
}

/**
 * Baut aus dem Protokoll je Figur eine Spur.
 *
 * Einmal beim Aufbau der Buehne, nicht je Bild: Ueber 110 Ereignisse in jedem
 * von 60 Bildern der Sekunde zu laufen waere die teuerste Schleife der ganzen
 * Anzeige, und sie liefert immer dasselbe Ergebnis.
 */
export function baueSpuren(bericht: Kampfbericht = BERICHT): Spur[] {
  const roh = new Map<
    number,
    {
      schritte: Schritt[];
      angriffe: number[];
      treffer: { zeitMs: number; leben: number }[];
      todMs: number | null;
    }
  >();
  for (const k of bericht.start) {
    roh.set(k.id, { schritte: [], angriffe: [], treffer: [], todMs: null });
  }

  for (const e of bericht.ereignisse) {
    const eintrag = 'wer' in e ? roh.get(e.wer) : undefined;
    switch (e.art) {
      case 'bewegung':
        eintrag?.schritte.push({
          abMs: e.zeitMs,
          bisMs: e.zeitMs + SCHRITT_MS,
          von: e.von,
          nach: e.nach,
        });
        break;
      case 'treffer':
        eintrag?.angriffe.push(e.zeitMs);
        roh.get(e.ziel)?.treffer.push({ zeitMs: e.zeitMs, leben: e.lebenDanach });
        break;
      case 'tod':
        if (eintrag) eintrag.todMs = e.zeitMs;
        break;
      case 'ende':
        break;
    }
  }

  return bericht.start.map((k) => {
    const eintrag = roh.get(k.id)!;
    return {
      id: k.id,
      seite: k.seite,
      rolle: rolleVon(k.einheitId),
      name: namenVon(k.einheitId),
      hoechstesLeben: k.hoechstesLeben,
      startPlatz: k.platz,
      schritte: eintrag.schritte,
      angriffe: eintrag.angriffe,
      treffer: eintrag.treffer,
      todMs: eintrag.todMs,
    };
  });
}

/**
 * Wo eine Figur zum Zeitpunkt `zeitMs` steht und was sie gerade tut.
 *
 * Die Reihenfolge der Faelle ist die Rangfolge der Haltungen: Tot schlaegt
 * alles, Laufen schlaegt Angriff, Angriff schlaegt Stehen. Ohne diese
 * Rangfolge zappelt eine Figur, die im selben Augenblick zieht und trifft,
 * zwischen zwei Animationen hin und her.
 */
export function stellungBei(spur: Spur, zeitMs: number): Stellung {
  // Position: der letzte begonnene Schritt bestimmt sie.
  let platzVon = spur.startPlatz;
  let platzNach = spur.startPlatz;
  let anteil = 1;
  let laeuft = false;
  let schrittBeginn = 0;
  for (const s of spur.schritte) {
    if (zeitMs < s.abMs) break;
    platzVon = s.von;
    platzNach = s.nach;
    schrittBeginn = s.abMs;
    if (zeitMs < s.bisMs) {
      anteil = (zeitMs - s.abMs) / SCHRITT_MS;
      laeuft = true;
    } else {
      anteil = 1;
      laeuft = false;
    }
  }

  const a = weltVonPlatz(platzVon);
  const b = weltVonPlatz(platzNach);
  const x = a.x + (b.x - a.x) * anteil;
  const z = a.z + (b.z - a.z) * anteil;

  // Blickrichtung: beim Laufen in Laufrichtung, sonst zum Gegner. Seite 0
  // steht bei grossem z und schaut nach -z, Seite 1 umgekehrt.
  const zumGegner = spur.seite === 0 ? Math.PI : 0;
  const drehung =
    laeuft && (b.x !== a.x || b.z !== a.z) ? Math.atan2(b.x - a.x, b.z - a.z) : zumGegner;

  // Leben.
  let leben = spur.hoechstesLeben;
  for (const t of spur.treffer) {
    if (t.zeitMs > zeitMs) break;
    leben = t.leben;
  }

  if (spur.todMs !== null && zeitMs >= spur.todMs) {
    return { x, z, drehung, haltung: 'tod', lebenAnteil: 0, seitMs: zeitMs - spur.todMs };
  }
  const lebenAnteil = Math.max(0, Math.min(1, leben / spur.hoechstesLeben));
  if (laeuft) {
    return { x, z, drehung, haltung: 'laufen', lebenAnteil, seitMs: zeitMs - schrittBeginn };
  }
  let letzterAngriff: number | null = null;
  for (const t of spur.angriffe) {
    if (t > zeitMs) break;
    letzterAngriff = t;
  }
  if (letzterAngriff !== null && zeitMs - letzterAngriff < ANGRIFF_MS) {
    return { x, z, drehung, haltung: 'angriff', lebenAnteil, seitMs: zeitMs - letzterAngriff };
  }
  return { x, z, drehung, haltung: 'idle', lebenAnteil, seitMs: zeitMs };
}

/**
 * Wie lange die Wiedergabe dauert.
 *
 * Der Bericht endet einen Takt nach dem letzten Ereignis (siehe kampf.ts);
 * dazu kommt hier ein Nachlauf, damit die Todesanimation der letzten Figur
 * noch zu Ende laeuft, bevor das Ergebnis eingeblendet wird. Dieselben zwei
 * Sekunden wie `NACHSPANN_MS` in Probe A — beide Proben sollen gleich lang
 * laufen, sonst vergleicht man am Bildschirm auch noch zwei Taktgefuehle.
 */
export const NACHLAUF_MS = 2000;

export function dauerMs(bericht: Kampfbericht = BERICHT): number {
  return bericht.dauerMs + NACHLAUF_MS;
}
