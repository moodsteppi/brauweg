import { describe, expect, it } from 'vitest';

import { abschlussdaten } from './abschluss';
import { KARTEN } from './karten';
import { Golfnetz } from './netz';
import { type Partiezustand, TAKT_MS, gesamtschlaege, platzierungen } from './physik';
import { parJeLoch } from './par';
import type { GolfSicht } from './sicht';

/*
 * Das Par der Endtafel gegen die Bahnen DER PARTIE.
 *
 * Bis zum 22.09.2026 las der Bildschirm `reihenfolge` gegen den Katalog. Seit
 * #206 zeigt sie in die Partiebahnen (`[0, 1, 2]`), und die Endtafel zeigte
 * das Par der ersten drei Katalogbahnen. Die Partie hier spielt deshalb
 * absichtlich die LETZTEN drei Katalogbahnen rückwärts — eine Folge, die mit
 * dem Katalog nichts gemein hat — und die Prüfung sichert zuerst ab, dass die
 * alte Rechnung dort wirklich ein anderes Par ergäbe. Sonst bliebe der Test
 * grün, auch wenn jemand den Fehler zurückbaut.
 */
const BAHNEN = KARTEN.slice(-3)
  .reverse()
  .map((k) => k.id);

function spieleMitBots(): { netz: Golfnetz; ende: Partiezustand } {
  let uhr = 0;
  const netz = new Golfnetz({
    sende: () => {},
    sendeTakt: () => {},
    neuVerbinden: () => {},
    jetzt: () => uhr,
    karten: KARTEN,
  });
  const sicht: GolfSicht = {
    saat: 424242,
    sitze: 2,
    loecher: BAHNEN.length,
    botSitze: [0, 1],
    bahnen: [...BAHNEN],
    zuege: [],
    abIndex: 0,
    ausstiege: [],
    meldungen: {},
    ausgang: null,
    taktMs: TAKT_MS,
    vorlauf: 2,
    botStufe: 'genie',
  };
  netz.nimmSicht(sicht);
  const gs = netz.kern;
  if (gs === null) throw new Error('kein Kern');
  // Jedes Loch endet spätestens am Zeitlimit; mehr als das braucht es nie.
  for (let i = 0; i < 100_000 && !gs.zustand().fertig; i += 1) {
    uhr += 20 * TAKT_MS;
    gs.rechneBis(netz.taktJetzt());
  }
  return { netz, ende: gs.zustand() };
}

describe('Endtafel: Par gegen die Bahnen der Partie', () => {
  const { netz, ende } = spieleMitBots();
  const erwartet = BAHNEN.map((id) => KARTEN.find((k) => k.id === id)!.par);

  it('spielt eine Folge, die nicht die Katalogreihenfolge ist', () => {
    expect(ende.fertig).toBe(true);
    expect(netz.karten.map((k) => k.id)).toEqual(BAHNEN);
    // Die alte Rechnung (gegen den Katalog) ergäbe hier ein anderes Par —
    // genau das, was die Endtafel bis zu diesem Commit zeigte.
    expect(parJeLoch(ende.reihenfolge, KARTEN)).not.toEqual(erwartet);
  });

  it('zeigt das Par der gespielten Bahnen', () => {
    expect(abschlussdaten(ende, netz.karten).par).toEqual(erwartet);
  });

  it('übernimmt Schläge und Platz unverändert aus dem Kern', () => {
    const daten = abschlussdaten(ende, netz.karten);
    expect(daten.gesamt).toEqual(gesamtschlaege(ende));
    expect(daten.platz).toEqual(platzierungen(ende));
    expect(daten.ergebnis).toEqual(ende.ergebnis);
    // Eine Kopie: Der Kern lebt weiter, die Tafel soll stehen bleiben.
    expect(daten.ergebnis[0]).not.toBe(ende.ergebnis[0]);
  });
});
