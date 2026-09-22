import {
  BAHN_THEMEN,
  KURSE,
  THEMEN,
  type GolfRegeln,
  golf,
  varianteFuer as varianteImModul,
  waehleBahnen,
} from '@brauweg/game-golf';
import { describe, expect, it } from 'vitest';

import {
  type Bahnregeln,
  type Bahnwahl,
  liesLobbydaten,
  regelnAusWahl,
  varianteFuer as varianteImClient,
  wahlAusRegeln,
} from '../minispiele/golf/bahnwahl';
import { KARTEN } from '../minispiele/golf/karten';

/*
 * Vertrag der Bahnauswahl (seit dem 22.09.2026) zwischen Modul und Client.
 *
 * Das Modul entscheidet, welche Bahnen ein Kurs oder Filter liefert; es kennt
 * aber keine Geometrie. Was es über die Bahnen sagt — welche Zonen auf ihnen
 * liegen, welche es in einem Kurs gibt —, muss deshalb zu den Geometrien des
 * Clients passen. Sonst fiele eine Sandbahn still aus dem Sandfilter, oder
 * ein Kurs zeigte „Neue Bahnen, bitte neu laden", und Neuladen hilft nicht.
 *
 * Dazu die eine Rechnung, die doppelt steht: der Name der Wahl in der
 * Tischliste (`varianteFuer`). Die Lobby schreibt ihn in den Regelsatz, der
 * Client importiert das Modul aber nicht — also wird hier über ALLE Filter
 * verglichen.
 */

const daten = liesLobbydaten(JSON.parse(JSON.stringify(golf.lobbyDaten!())));

/** Die Zonenarten einer Geometrie, alphabetisch — so rechnet `BAHN_THEMEN` sie. */
function zonenarten(id: string): string[] {
  const karte = KARTEN.find((k) => k.id === id)!;
  return [...new Set(karte.zonen.map((z) => z.art))].sort();
}

describe('Vertrag Golf-Kurse', () => {
  it('der Client liest die Lobbydaten des Moduls vollständig', () => {
    expect(daten).not.toBeNull();
    expect(daten!.kurse.map((k) => k.kennung)).toEqual(KURSE.map((k) => k.kennung));
    expect(daten!.themen.map((t) => t.kennung)).toEqual(THEMEN.map((t) => t.kennung));
  });

  it('jede Bahn hat im Modul genau die Themen, die in ihrer Geometrie liegen', () => {
    const abweichend = KARTEN.filter(
      (k) => JSON.stringify([...(BAHN_THEMEN[k.id] ?? ['FEHLT'])].sort()) !== JSON.stringify(zonenarten(k.id)),
    ).map((k) => `${k.id}: Modul ${JSON.stringify(BAHN_THEMEN[k.id])}, Geometrie ${JSON.stringify(zonenarten(k.id))}`);
    expect(abweichend).toEqual([]);
  });

  it('jedes Thema ist eine Zonenart, die es in der Physik gibt', () => {
    const arten = new Set(KARTEN.flatMap((k) => k.zonen.map((z) => z.art)));
    for (const thema of THEMEN) expect(arten, thema.kennung).toContain(thema.kennung);
  });

  it('jede Bahn jedes Kurses hat eine Geometrie im Client', () => {
    const ids = new Set(KARTEN.map((k) => k.id));
    for (const kurs of KURSE) {
      expect(kurs.bahnen.filter((id) => !ids.has(id)), kurs.kennung).toEqual([]);
    }
  });

  it('die Kurse folgen ihrem Dekor, wo der Name es verspricht', () => {
    const dekor = new Map(KARTEN.map((k) => [k.id, k.dekor]));
    const kurs = (kennung: string) => KURSE.find((k) => k.kennung === kennung)!;
    expect(kurs('nachtkurs').bahnen.every((id) => dekor.get(id) === 'nacht')).toBe(true);
    expect(kurs('wuestentour').bahnen.every((id) => dekor.get(id) === 'wueste')).toBe(true);
    // Eiszeit endet auf dem Portalkarussell (Nachtdekor, aber mit Eis) — der
    // Rest ist Eisdekor.
    expect(kurs('eiszeit').bahnen.slice(0, -1).every((id) => dekor.get(id) === 'eis')).toBe(true);
  });

  it('Client und Modul nennen jede Wahl gleich — über alle Kurse und alle Filter', () => {
    const faelle: Record<string, unknown>[] = [{}, { bahnen: ['k01-der-erste-schlag', 'k02-der-sandkasten'] }];
    for (const kurs of KURSE) faelle.push({ kurs: kurs.kennung });
    for (const thema of [undefined, ...THEMEN.map((t) => t.kennung)]) {
      for (let maske = 0; maske < 32; maske += 1) {
        const schwierigkeit = [1, 2, 3, 4, 5].filter((_, i) => (maske >> i) & 1);
        faelle.push({ filter: { ...(thema ? { thema } : {}), ...(schwierigkeit.length ? { schwierigkeit } : {}) } });
      }
    }
    for (const regeln of faelle) {
      expect(varianteImClient(regeln as Bahnregeln, daten!), JSON.stringify(regeln)).toBe(varianteImModul(regeln as GolfRegeln));
    }
  });

  it('was die Lobby als Regelsatz schreibt, nimmt das Modul an — und spielt es', () => {
    const wahlen: Bahnwahl[] = [
      { art: 'zufall' },
      ...KURSE.map((k): Bahnwahl => ({ art: 'kurs', kurs: k.kennung })),
      { art: 'filter', schwierigkeit: [4, 2], thema: 'eis' },
      { art: 'filter', schwierigkeit: [], thema: 'portal' },
      { art: 'eigene', bahnen: ['k40-meisterzirkel', 'k03-die-eisrutsche', 'k17-portalzange'] },
    ];
    for (const wahl of wahlen) {
      const regeln = regelnAusWahl(wahl, golf.defaultConfig() as Record<string, unknown>, daten);
      const fehler = golf.validateConfig(regeln, 4, 9).filter((p) => p.severity === 'error');
      expect(fehler, JSON.stringify(regeln)).toEqual([]);
      // Zurückgelesen ist es dieselbe Wahl (bis auf die Reihenfolge der Stufen).
      const zurueck = wahlAusRegeln(regeln);
      expect(zurueck.art).toBe(wahl.art);
      // Die Partie zieht daraus eine Folge, die der Client vollständig kennt.
      const loecher = wahl.art === 'eigene' ? wahl.bahnen.length : 9;
      const folge = waehleBahnen(4711, loecher, undefined, regeln as GolfRegeln);
      for (const id of folge) expect(KARTEN.some((k) => k.id === id), id).toBe(true);
      if (wahl.art === 'eigene') expect(folge).toEqual(wahl.bahnen);
    }
  });
});
