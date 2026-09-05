/**
 * Pruefungen fuer die Zeitleiste der Arena-Proben.
 *
 * Warum ausgerechnet hier: `ablauf.ts` ist die einzige Stelle der Probe,
 * die RECHNET statt zu zeichnen — und sie rechnet etwas nach, das im Modul
 * schon feststeht (Position, Abstand, Reihenfolge der Haltungen). Genau die
 * Sorte Code, die still falsch wird: Eine vertauschte Achse faellt am
 * Bildschirm nicht auf, weil acht Figuren auch dann irgendwo stehen.
 *
 * Die Buehne selbst wird nicht geprueft. WebGL laeuft in jsdom nicht, und ein
 * Test, der nur nachsaehe, ob R3F ein `<canvas>` anlegt, verspraeche eine
 * Sicherheit, die er nicht hat.
 */

import { describe, expect, it } from 'vitest';

import {
  ANGRIFF_MS,
  ARENA_REIHEN,
  ARENA_SPALTEN,
  SCHRITT_MS,
  BERICHT,
  baueSpuren,
  dauerMs,
  stellungBei,
  weltVonPlatz,
} from './ablauf';
import { EINHEITEN, rolleVon } from '../arena-einheiten';

describe('die aufgezeichnete Szene', () => {
  it('hat vier Einheiten je Seite', () => {
    const je = [0, 1].map((s) => BERICHT.start.filter((k) => k.seite === s).length);
    expect(je).toEqual([4, 4]);
  });

  it('enthaelt Bewegung, Treffer, Tode und genau ein Ende', () => {
    const zaehlung = { bewegung: 0, treffer: 0, tod: 0, ende: 0 };
    for (const e of BERICHT.ereignisse) zaehlung[e.art] += 1;
    expect(zaehlung.bewegung).toBeGreaterThan(0);
    expect(zaehlung.treffer).toBeGreaterThan(0);
    expect(zaehlung.tod).toBeGreaterThan(1);
    expect(zaehlung.ende).toBe(1);
  });

  it('zeigt Tode auf beiden Seiten', () => {
    const seiteVon = new Map(BERICHT.start.map((k) => [k.id, k.seite]));
    const tode = BERICHT.ereignisse.filter((e) => e.art === 'tod');
    for (const seite of [0, 1]) {
      expect(tode.filter((t) => seiteVon.get(t.wer) === seite).length).toBeGreaterThan(0);
    }
  });

  /*
   * Die Probe laedt ein Modell je Rolle. Faellt eine Rolle aus der Aufstellung,
   * laedt sie eine Datei, die niemand braucht — und schlimmer: Kommt eine
   * SECHSTE Rolle hinzu, steht die Figur ohne Modell da und fehlt stumm im
   * Bild. Beides soll hier auffallen und nicht erst am Bildschirm.
   */
  it('besetzt genau die fuenf Rollen, fuer die es Modelle gibt', () => {
    const rollen = new Set(BERICHT.start.map((k) => rolleVon(k.einheitId)));
    expect([...rollen].sort()).toEqual([
      'beistand',
      'magier',
      'meuchler',
      'schuetze',
      'wache',
    ]);
  });

  /*
   * `rolleVon` faellt bei einer unbekannten Kennung stillschweigend auf
   * `wache` zurueck — richtig fuer die Anzeige, gefaehrlich fuer die Probe:
   * Eine umbenannte Einheit stuende als Ritter auf dem Feld, und niemand
   * saehe, dass die Zuordnung verloren ist. Hier faellt es auf.
   */
  it('kennt jede Einheit der Szene beim Namen', () => {
    for (const k of BERICHT.start) {
      expect(EINHEITEN[k.einheitId], `unbekannte Einheit ${k.einheitId}`).toBeDefined();
    }
  });

  it('haelt die Ereignisse aufsteigend nach Zeit', () => {
    let letzte = -1;
    for (const e of BERICHT.ereignisse) {
      expect(e.zeitMs).toBeGreaterThanOrEqual(letzte);
      letzte = e.zeitMs;
    }
  });
});

describe('weltVonPlatz', () => {
  it('legt die Arena um den Nullpunkt', () => {
    const alle = Array.from({ length: ARENA_REIHEN * ARENA_SPALTEN }, (_, p) => weltVonPlatz(p));
    const mx = (Math.min(...alle.map((f) => f.x)) + Math.max(...alle.map((f) => f.x))) / 2;
    const mz = (Math.min(...alle.map((f) => f.z)) + Math.max(...alle.map((f) => f.z))) / 2;
    expect(mx).toBeCloseTo(0, 6);
    expect(mz).toBeCloseTo(0, 6);
  });

  /*
   * DER EIGENTLICHE PUNKT DIESER DATEI. Im Modul ist der Abstand zweier
   * benachbarter Felder immer 1 (hexAbstand). Steht das Raster hier mit
   * vertauschten Faktoren, sind die Nachbarn in Weltkoordinaten
   * unterschiedlich weit voneinander entfernt — und ein Nahkaempfer schlaegt
   * sichtbar ueber eine Luecke hinweg zu, obwohl das Modell sagt, er stehe
   * direkt daneben.
   */
  it('haelt alle sechs Nachbarn gleich weit entfernt', () => {
    const abstand = (a: number, b: number): number => {
      const p = weltVonPlatz(a);
      const q = weltVonPlatz(b);
      return Math.hypot(p.x - q.x, p.z - q.z);
    };
    // Feld 7 liegt in einer ungeraden Reihe und hat alle sechs Nachbarn.
    const nachbarn = [6, 8, 2, 3, 12, 13];
    for (const n of nachbarn) expect(abstand(7, n)).toBeCloseTo(Math.sqrt(3), 6);
    // Feld 12 liegt in einer geraden Reihe.
    for (const n of [11, 13, 6, 7, 16, 17]) expect(abstand(12, n)).toBeCloseTo(Math.sqrt(3), 6);
  });
});

describe('stellungBei', () => {
  const spuren = baueSpuren(BERICHT);

  it('setzt jede Figur zu Beginn auf ihren Startplatz', () => {
    for (const spur of spuren) {
      const soll = weltVonPlatz(spur.startPlatz);
      const ist = stellungBei(spur, 0);
      expect(ist.x).toBeCloseTo(soll.x, 6);
      expect(ist.z).toBeCloseTo(soll.z, 6);
    }
  });

  it('laeuft waehrend eines Schritts und steht danach auf dem Zielfeld', () => {
    const spur = spuren.find((s) => s.schritte.length > 0);
    expect(spur).toBeDefined();
    const schritt = spur!.schritte[0]!;

    const mitten = stellungBei(spur!, schritt.abMs + SCHRITT_MS / 2);
    expect(mitten.haltung).toBe('laufen');
    const von = weltVonPlatz(schritt.von);
    const nach = weltVonPlatz(schritt.nach);
    expect(mitten.x).toBeCloseTo((von.x + nach.x) / 2, 6);
    expect(mitten.z).toBeCloseTo((von.z + nach.z) / 2, 6);

    // Nach dem LETZTEN Schritt, nicht nach irgendeinem: Zwei Schritte
    // koennen luckenlos aneinander haengen (`schrittFreiAb` in kampf.ts ist
    // genau `SCHRITT_MS`), und dann laeuft die Figur weiter. Genau daran ist
    // die erste Fassung dieser Pruefung gescheitert.
    const letzter = spur!.schritte[spur!.schritte.length - 1]!;
    const ziel = weltVonPlatz(letzter.nach);
    const danach = stellungBei(spur!, letzter.bisMs + 1);
    expect(danach.haltung).not.toBe('laufen');
    expect(danach.x).toBeCloseTo(ziel.x, 6);
    expect(danach.z).toBeCloseTo(ziel.z, 6);
  });

  it('zeigt den Angriff nur im Fenster nach dem Treffer', () => {
    const spur = spuren.find((s) => s.angriffe.length > 0 && s.schritte.length === 0);
    expect(spur).toBeDefined();
    const zeitpunkt = spur!.angriffe[0]!;
    expect(stellungBei(spur!, zeitpunkt).haltung).toBe('angriff');
    expect(stellungBei(spur!, zeitpunkt + ANGRIFF_MS - 1).haltung).toBe('angriff');
    // Direkt nach dem Fenster wieder Ruhe - es sei denn, schon der naechste
    // Schlag faellt hinein. Genau davor schuetzt ANGRIFF_MS, siehe dort.
    const naechster = spur!.angriffe[1];
    if (naechster === undefined || naechster > zeitpunkt + ANGRIFF_MS) {
      expect(stellungBei(spur!, zeitpunkt + ANGRIFF_MS).haltung).toBe('idle');
    }
  });

  it('laesst eine gefallene Figur gefallen', () => {
    const spur = spuren.find((s) => s.todMs !== null);
    expect(spur).toBeDefined();
    expect(stellungBei(spur!, spur!.todMs! - 1).haltung).not.toBe('tod');
    for (const t of [spur!.todMs!, spur!.todMs! + 3000, dauerMs(BERICHT)]) {
      const stellung = stellungBei(spur!, t);
      expect(stellung.haltung).toBe('tod');
      expect(stellung.lebenAnteil).toBe(0);
    }
  });

  it('laesst das Leben nur sinken', () => {
    for (const spur of spuren) {
      let vorher = 1;
      for (let t = 0; t <= BERICHT.dauerMs; t += 100) {
        const jetzt = stellungBei(spur, t).lebenAnteil;
        expect(jetzt).toBeLessThanOrEqual(vorher + 1e-9);
        vorher = jetzt;
      }
    }
  });

  /*
   * Ohne diese Rangfolge zappelt eine Figur, die im selben Augenblick zieht
   * und trifft, zwischen Laufen und Angriff hin und her.
   */
  it('stellt Laufen ueber Angriff und Tod ueber alles', () => {
    for (const spur of spuren) {
      for (const schritt of spur.schritte) {
        const mitten = schritt.abMs + SCHRITT_MS / 2;
        if (spur.todMs !== null && mitten >= spur.todMs) continue;
        expect(stellungBei(spur, mitten).haltung).toBe('laufen');
      }
    }
  });
});
