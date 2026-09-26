import { describe, expect, it } from 'vitest';
// Der Katalog des Servers, aus seiner Quelle: Er importiert absichtlich nichts,
// damit genau diese Probe ohne Datenbank und Drizzle laufen kann. Der Client
// selbst liest ihn nie — zur Laufzeit kommt alles über /api/weg.
import { WEG_STATIONEN, wegStufenBis } from '../../server/src/trophaeenweg-katalog';
import type { Weg } from './api';
import { t } from './i18n';
import { BIOME } from './screens/Pfad';
import { sicherAb } from './screens/StartNeu';
import { STATIONEN, holbar, stationenMit } from './trophaeenweg';

describe('Trophäenweg im neuen Hub', () => {
  it('hat dieselben Stationen und Schwellen wie der Pfad', () => {
    // Zwei Listen derselben Sache: Laufen sie auseinander, zeigt der Weg
    // andere Schwellen als der Server zählt.
    expect(STATIONEN.map((s) => [s.name, s.ab])).toEqual(BIOME.map((b) => [b.name, b.cp]));
  });

  it('zahlt an genau den Stationen aus, die der Bildschirm zeichnet', () => {
    // Die Heimat (0) gibt nichts; jede andere Station hat ihre Stufe im
    // Katalog des Servers. Fehlt eine, stünde an der Station keine Belohnung.
    expect(WEG_STATIONEN.map((s) => s.schwelle)).toEqual(STATIONEN.slice(1).map((s) => s.ab));
  });

  it('hat für jeden Gegenstand des Servers einen Namen', () => {
    // Fehlt der Eintrag, stünde der rohe Schlüssel „weg.aura-sterne" auf der Karte.
    for (const { gegenstand } of WEG_STATIONEN) {
      expect(t(`weg.${gegenstand}`), gegenstand).not.toBe(`weg.${gegenstand}`);
    }
  });

  it('legt die Antwort des Servers auf die Stationen', () => {
    const weg: Weg = {
      trophaeen: 773,
      bereit: 1,
      stufen: wegStufenBis(1250).map((s) => ({
        schwelle: s.schwelle,
        art: s.art,
        truhe: s.truhe ? { grad: s.truhe, von: 1, bis: 2 } : null,
        muenzen: s.muenzen,
        gegenstand: s.gegenstand,
        erreicht: s.schwelle <= 773,
        geholt: s.schwelle < 750,
        coins: null,
      })),
    };
    const stationen = stationenMit(weg);
    expect(stationen[0]!.truhe).toBeNull();
    expect(stationen.slice(1).map((s) => [s.name, s.truhe?.grad, s.gegenstand])).toEqual([
      ['Wiesen', 'bronze', 'hut-strohhut'],
      ['Strand', 'silber', 'ruecken-sommerwiese'],
      ['Feuerberg', 'gold', 'szene-kaminzimmer'],
      ['Schneefeld', 'gold', 'blatt-winterhof'],
      ['Sternenhafen', 'diamant', 'aura-sterne'],
    ]);
    expect(stationen.map((s) => holbar(s.stufe))).toEqual([false, false, false, false, true, false]);
  });

  it('zeigt ohne Antwort keine Belohnung, statt eine zu erfinden', () => {
    expect(stationenMit(null).every((s) => s.truhe === null && s.gegenstand === null)).toBe(true);
  });

  it('nennt den Checkpoint, unter den man nicht mehr fällt', () => {
    expect(sicherAb(0)).toBe(0);
    expect(sicherAb(773)).toBe(700);
    expect(sicherAb(1000)).toBe(1000);
    expect(sicherAb(1249)).toBe(1000);
    expect(sicherAb(1250)).toBe(1250);
  });
});
