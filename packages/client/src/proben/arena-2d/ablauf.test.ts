/**
 * Pruefungen fuer das Abspielwerk der 2D-Probe.
 *
 * Zwei Dinge stehen hier auf dem Pruefstand, und beide wuerden sonst still
 * falsch aussehen statt laut zu scheitern:
 *
 *  1. Die Geometrie (`ortVon`). Ein gekipptes Gitter ist genau die Rechnung,
 *     bei der man Reihe und Spalte verwechselt — und dann kaempfen beide
 *     Seiten uebereinander statt gegeneinander, was auf einem Standbild noch
 *     nach Absicht aussieht.
 *  2. Der Stand zu einem Zeitpunkt (`standBei`). Er wird jedes Bild neu
 *     gerechnet; ein Fehler darin faellt am Bildschirm nur als "irgendwie
 *     komisch" auf.
 *
 * Die aufgezeichnete Szene wird gleich mitgeprueft: Sie ist eine Datei im
 * Repo, und wer sie neu erzeugt, soll sofort merken, wenn sie nicht mehr
 * zeigt, was die Probe zeigen soll.
 */

import { describe, expect, it } from 'vitest';

import rohszene from '../arena-szene.json?raw';

import {
  ARENA_REIHEN,
  ARENA_SPALTEN,
  LAUF_MS,
  NACHSPANN_MS,
  VORLAUF_MS,
  ZUCKEN_MS,
  type Kampfbericht,
  ortVon,
  standBei,
} from './ablauf';

const SZENE = JSON.parse(rohszene) as Kampfbericht;

/**
 * In dieser Szene ueberlagern sich Ereignisse staendig — 97 Treffer auf 19
 * Sekunden, und wer schlaegt, wird oft im selben Augenblick selbst getroffen.
 * Genau das ist der Normalfall, und die Anzeige hat dafuer eine Regel (RANG in
 * ablauf.ts). Wer eine EINZELNE Bewegung pruefen will, muss sich deshalb ein
 * Ereignis suchen, das allein steht — sonst prueft der Test die Ueberlagerung
 * und nicht das, was in seinem Namen steht.
 */
function sucheEreignis<A extends string>(
  art: A,
  passt: (e: Extract<(typeof SZENE.ereignisse)[number], { art: A }>) => boolean,
): Extract<(typeof SZENE.ereignisse)[number], { art: A }> {
  for (const e of SZENE.ereignisse) {
    if (e.art !== art) continue;
    const kandidat = e as Extract<(typeof SZENE.ereignisse)[number], { art: A }>;
    if (passt(kandidat)) return kandidat;
  }
  throw new Error(`Die Szene hat kein passendes Ereignis der Art ${art}`);
}

/** Ein Treffer, bei dem der Schlaeger nicht gleichzeitig selbst getroffen wird. */
function ersterSauberSchlag() {
  return sucheEreignis('treffer', (t) =>
    SZENE.ereignisse.every((x) => x.art !== 'treffer' || x.zeitMs !== t.zeitMs || x.ziel !== t.wer),
  );
}

describe('ortVon', () => {
  it('stellt Seite 0 nach links und Seite 1 nach rechts', () => {
    // Arenareihen 2 und 3 gehoeren Seite 0, die Reihen 0 und 1 Seite 1
    // (arena.ts, haelfteVon). Auf der Buehne wird daraus links und rechts.
    for (let spalte = 0; spalte < ARENA_SPALTEN; spalte++) {
      for (const reihe of [2, 3]) {
        expect(ortVon(reihe * ARENA_SPALTEN + spalte).x).toBeLessThan(50);
      }
      for (const reihe of [0, 1]) {
        expect(ortVon(reihe * ARENA_SPALTEN + spalte).x).toBeGreaterThan(50);
      }
    }
  });

  it('setzt die vorderen Reihen beider Seiten an die Mitte', () => {
    // Reihe 2 ist die vordere von Seite 0, Reihe 1 die vordere von Seite 1.
    const vorneLinks = ortVon(2 * ARENA_SPALTEN).x;
    const hintenLinks = ortVon(3 * ARENA_SPALTEN).x;
    const vorneRechts = ortVon(1 * ARENA_SPALTEN).x;
    const hintenRechts = ortVon(0 * ARENA_SPALTEN).x;
    expect(vorneLinks).toBeGreaterThan(hintenLinks);
    expect(vorneRechts).toBeLessThan(hintenRechts);
  });

  it('versetzt ungerade Reihen um ein halbes Feld', () => {
    const gerade = ortVon(0 * ARENA_SPALTEN + 1);
    const ungerade = ortVon(1 * ARENA_SPALTEN + 1);
    const feldhoehe = ortVon(2) .y - ortVon(1).y;
    expect(ungerade.y - gerade.y).toBeCloseTo(feldhoehe / 2, 6);
  });

  it('haelt jeden Platz vollstaendig im Bild', () => {
    for (let platz = 0; platz < ARENA_REIHEN * ARENA_SPALTEN; platz++) {
      const ort = ortVon(platz);
      expect(ort.x).toBeGreaterThan(0);
      expect(ort.x).toBeLessThan(100);
      expect(ort.y).toBeGreaterThan(0);
      expect(ort.y).toBeLessThan(100);
    }
  });
});

describe('die aufgezeichnete Szene', () => {
  it('bringt vier Einheiten je Seite mit', () => {
    expect(SZENE.start.filter((k) => k.seite === 0)).toHaveLength(4);
    expect(SZENE.start.filter((k) => k.seite === 1)).toHaveLength(4);
  });

  it('zeigt Bewegung, mehrere Treffer, mindestens zwei Tode und ein Ende', () => {
    const zaehle = (art: string) => SZENE.ereignisse.filter((e) => e.art === art).length;
    expect(zaehle('bewegung')).toBeGreaterThan(0);
    expect(zaehle('treffer')).toBeGreaterThan(3);
    expect(zaehle('tod')).toBeGreaterThanOrEqual(2);
    expect(zaehle('ende')).toBe(1);
    // Das Ende steht immer zuletzt — sonst spielte die Anzeige darueber hinweg.
    expect(SZENE.ereignisse.at(-1)?.art).toBe('ende');
  });

  it('endet durch Ausloeschung und nicht an der Zeitgrenze', () => {
    expect(SZENE.grund).toBe('ausgeloescht');
  });
});

describe('standBei', () => {
  it('zeigt im Vorlauf alle Figuren unversehrt und in Ruhe', () => {
    // Im Vorlauf und nicht bei null: Die ersten Treffer der Szene fallen bei
    // `zeitMs === 0`. Genau deshalb gibt es den Vorlauf (siehe VORLAUF_MS).
    const stand = standBei(SZENE, -VORLAUF_MS);
    expect(stand.figuren).toHaveLength(SZENE.start.length);
    for (const figur of stand.figuren) {
      expect(figur.tot).toBe(false);
      expect(figur.leben).toBe(figur.hoechstesLeben);
      expect(figur.bewegung).toBe('ruhig');
    }
    expect(stand.vorbei).toBe(false);
  });

  it('setzt das Leben des Ziels auf den Wert aus dem Protokoll', () => {
    const treffer = SZENE.ereignisse.find((e) => e.art === 'treffer');
    if (treffer?.art !== 'treffer') throw new Error('Die Szene hat keinen Treffer');
    const stand = standBei(SZENE, treffer.zeitMs);
    const ziel = stand.figuren.find((f) => f.id === treffer.ziel);
    expect(ziel?.leben).toBe(treffer.lebenDanach);
  });

  it('laesst das Ziel zurueckzucken und den Schlaeger zuschlagen', () => {
    // Gesucht ist ein Treffer, bei dem der Schlaeger im SELBEN Augenblick
    // nicht auch getroffen wird — sonst zeigt er das Zurueckzucken, und das
    // ist so gewollt (siehe RANG in ablauf.ts).
    const treffer = ersterSauberSchlag();
    const stand = standBei(SZENE, treffer.zeitMs);
    expect(stand.figuren.find((f) => f.id === treffer.ziel)?.bewegung).toBe('zucken');
    expect(stand.figuren.find((f) => f.id === treffer.wer)?.bewegung).toBe('schlag');
  });

  it('zeigt das Zurueckzucken, wenn jemand gleichzeitig schlaegt und getroffen wird', () => {
    const gleichzeitig = SZENE.ereignisse.find(
      (e) =>
        e.art === 'treffer' &&
        SZENE.ereignisse.some(
          (x) => x.art === 'treffer' && x.zeitMs === e.zeitMs && x.ziel === e.wer,
        ),
    );
    if (gleichzeitig?.art !== 'treffer') throw new Error('Kein gleichzeitiger Schlagabtausch');
    const figur = standBei(SZENE, gleichzeitig.zeitMs).figuren.find(
      (f) => f.id === gleichzeitig.wer,
    );
    expect(figur?.bewegung).toBe('zucken');
  });

  it('laesst das Zurueckzucken wieder aufhoeren', () => {
    // Ein Treffer, nach dem das Ziel eine Zuckdauer lang seine Ruhe hat.
    // `x !== t` und nicht `x.zeitMs > t.zeitMs`: Wer im selben Augenblick
    // selbst zuschlaegt, zeigt danach seinen Schlag — die Schlagbewegung dauert
    // laenger als das Zucken.
    const treffer = sucheEreignis(
      'treffer',
      (t) =>
        !SZENE.ereignisse.some(
          (x) =>
            x !== t &&
            x.zeitMs >= t.zeitMs &&
            x.zeitMs <= t.zeitMs + ZUCKEN_MS &&
            ((x.art === 'treffer' && (x.ziel === t.ziel || x.wer === t.ziel)) ||
              (x.art === 'tod' && x.wer === t.ziel) ||
              (x.art === 'bewegung' && x.wer === t.ziel)),
        ),
    );
    const spaeter = standBei(SZENE, treffer.zeitMs + ZUCKEN_MS);
    const ziel = spaeter.figuren.find((f) => f.id === treffer.ziel);
    expect(ziel?.bewegung).toBe('ruhig');
  });

  it('schiebt eine laufende Figur zwischen die beiden Felder', () => {
    // Ein Schritt, waehrend dessen die Figur weder zuschlaegt noch getroffen
    // wird — sonst gewinnt die spaetere Bewegung, und das ist richtig so.
    const schritt = sucheEreignis(
      'bewegung',
      (b) =>
        !SZENE.ereignisse.some(
          (x) =>
            x.zeitMs >= b.zeitMs &&
            x.zeitMs <= b.zeitMs + LAUF_MS &&
            ((x.art === 'treffer' && (x.wer === b.wer || x.ziel === b.wer)) ||
              (x.art === 'tod' && x.wer === b.wer)),
        ),
    );
    const von = ortVon(schritt.von);
    const nach = ortVon(schritt.nach);
    const mitten = standBei(SZENE, schritt.zeitMs + LAUF_MS / 2).figuren.find(
      (f) => f.id === schritt.wer,
    );
    expect(mitten?.bewegung).toBe('lauf');
    expect(mitten?.ort.x).toBeCloseTo((von.x + nach.x) / 2, 6);
    expect(mitten?.ort.y).toBeCloseTo((von.y + nach.y) / 2, 6);

    const angekommen = standBei(SZENE, schritt.zeitMs + LAUF_MS).figuren.find(
      (f) => f.id === schritt.wer,
    );
    expect(angekommen?.ort).toEqual(nach);
  });

  it('laesst Gefallene liegen und nimmt ihnen das Leben', () => {
    const tod = SZENE.ereignisse.find((e) => e.art === 'tod');
    if (tod?.art !== 'tod') throw new Error('Die Szene hat keinen Tod');
    for (const zeit of [tod.zeitMs, tod.zeitMs + 5000, SZENE.dauerMs]) {
      const figur = standBei(SZENE, zeit).figuren.find((f) => f.id === tod.wer);
      expect(figur?.tot).toBe(true);
      expect(figur?.bewegung).toBe('tod');
      expect(figur?.leben).toBe(0);
      // Der Schluessel der Bewegung darf sich nach dem Tod nicht mehr aendern,
      // sonst faengt das Umfallen bei jedem Bild von vorne an.
      expect(figur?.bewegungAb).toBe(tod.zeitMs);
    }
  });

  it('meldet den Sieger erst mit dem Ende-Ereignis', () => {
    expect(standBei(SZENE, SZENE.dauerMs - 1).vorbei).toBe(false);
    const ende = standBei(SZENE, SZENE.dauerMs);
    expect(ende.vorbei).toBe(true);
    expect(ende.sieger).toBe(SZENE.sieger);
  });

  it('laeuft erst nach dem Nachspann ab', () => {
    expect(standBei(SZENE, SZENE.dauerMs).abgelaufen).toBe(false);
    expect(standBei(SZENE, SZENE.dauerMs + NACHSPANN_MS).abgelaufen).toBe(true);
  });

  it('kommt nach einem Sprung zurueck auf denselben Stand', () => {
    // Der Knopf "nochmal" ist genau das: die Uhr auf null. Wenn der Stand
    // fortgeschrieben statt gerechnet waere, gaebe es hier Reste.
    const spaet = standBei(SZENE, SZENE.dauerMs);
    expect(spaet.figuren.some((f) => f.tot)).toBe(true);
    expect(standBei(SZENE, 0)).toEqual(standBei(SZENE, 0));
    expect(standBei(SZENE, 0).figuren.every((f) => !f.tot)).toBe(true);
  });
});
