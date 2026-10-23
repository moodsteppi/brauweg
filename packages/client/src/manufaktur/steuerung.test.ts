import { describe, expect, it, vi } from 'vitest';

import { type Aktion, type ManufakturStand, handle, neuerStand, vorspulen } from '@brauweg/manufaktur-kern';

import type { ManufakturAntwort } from './sicht';
import { type Leitung, Steuerung } from './steuerung';

/*
 * Die Steuerung sagt Aktionen sofort voraus, schickt sie der Reihe nach und
 * gleicht jede Antwort ab. Der „Server" hier rechnet mit demselben Kern —
 * so wie der echte.
 */

const T0 = Date.parse('2026-10-23T10:00:00Z');
const presse = { art: 'presse' as const, index: 0 };

function falscherServer(start: ManufakturStand, uhr: () => number) {
  let stand = start;
  const offen: (() => void)[] = [];
  const antwort = (): ManufakturAntwort => ({ stand, zeit: uhr(), offline: null, muenzen: 0 });
  const leitung: Leitung = {
    laden: async () => {
      stand = vorspulen(stand, uhr());
      return antwort();
    },
    senden: (aktion: Aktion, bei: number) =>
      new Promise<ManufakturAntwort>((fertig) => {
        // Antworten erst, wenn der Test es sagt — so liegt etwas „unterwegs".
        // Wie der echte Dienst: ab dem genannten Zeitpunkt, hoechstens 1,5 s zurueck.
        offen.push(() => {
          stand = handle(stand, aktion, Math.max(bei, uhr() - 1500)).stand;
          fertig(antwort());
        });
      }),
  };
  /** Antwortet auf die naechste Anfrage, sobald sie wirklich gesendet ist. */
  const antworte = async (): Promise<void> => {
    await vi.waitFor(() => expect(offen.length).toBeGreaterThan(0));
    offen.shift()!();
  };
  return { leitung, antworte };
}

describe('Steuerung der Manufaktur', () => {
  it('sagt eine Aktion sofort voraus und verliert beim Abgleich keine, die noch unterwegs ist', async () => {
    let jetzt = T0;
    const uhr = () => jetzt;
    const server = falscherServer({ ...neuerStand(T0), taler: 1000 }, uhr);
    const s = new Steuerung(server.leitung, {}, uhr);
    await s.laden();

    expect(s.tue({ typ: 'ausbauen', ziel: presse, menge: 1 })).toEqual({ ok: true });
    expect(s.tue({ typ: 'ausbauen', ziel: presse, menge: 1 })).toEqual({ ok: true });
    expect(s.stand()!.pressen[0]!.stufe).toBe(3);

    // Die erste Antwort kommt — die zweite Aktion ist noch unterwegs und bleibt sichtbar.
    jetzt += 100;
    await server.antworte();
    await vi.waitFor(() => expect(s.stand()!.pressen[0]!.stufe).toBe(3));
    await server.antworte();
    await s.fertig();
    expect(s.stand()!.pressen[0]!.stufe).toBe(3);
  });

  it('laesst den Pinguin nicht zurueckspringen, wenn die Antwort spaeter kommt', async () => {
    let jetzt = T0;
    const uhr = () => jetzt;
    const server = falscherServer(neuerStand(T0), uhr);
    const s = new Steuerung(server.leitung, {}, uhr);
    await s.laden();
    s.tue({ typ: 'arbeiten', ziel: presse });
    // 300 ms Laufzeit: Vorhersage und Server muessen danach denselben Zyklus haben.
    jetzt += 300;
    const vorher = s.stand()!.pressen[0]!.fortschritt;
    await server.antworte();
    await s.fertig();
    expect(s.stand()!.pressen[0]!.fortschritt).toBeCloseTo(vorher, 6);
  });

  it('schickt nichts, was schon der Kern ablehnt', async () => {
    const server = falscherServer(neuerStand(T0), () => T0);
    const senden = vi.spyOn(server.leitung, 'senden');
    const s = new Steuerung(server.leitung, {}, () => T0);
    await s.laden();
    expect(s.tue({ typ: 'ausbauen', ziel: presse, menge: 1 })).toEqual({ ok: false, code: 'manufakturZuTeuer' });
    expect(senden).not.toHaveBeenCalled();
  });

  it('rechnet mit der Server-Zeit weiter, auch wenn die eigene Uhr anders geht', async () => {
    let eigene = 5_000; // die Uhr des Geraets geht voellig anders als die des Servers
    const server = falscherServer(neuerStand(T0), () => T0 + eigene - 5_000);
    const s = new Steuerung(server.leitung, {}, () => eigene);
    await s.laden();
    expect(Math.abs(s.jetzt() - T0)).toBeLessThan(1);
    s.tue({ typ: 'arbeiten', ziel: presse });
    eigene += 10_000;
    expect(s.stand()!.pressen[0]!.kiste).toBeGreaterThan(0);
  });

  it('meldet einen Umzug, auch wenn ihn ein anderes Geraet ausgeloest hat', async () => {
    let stand = neuerStand(T0);
    const umzug = vi.fn();
    const leitung: Leitung = {
      laden: async () => ({ stand, zeit: T0, offline: null, muenzen: 0 }),
      senden: async () => ({ stand, zeit: T0, offline: null, muenzen: 0 }),
    };
    const s = new Steuerung(leitung, { umzug }, () => T0);
    await s.laden();
    expect(umzug).not.toHaveBeenCalled();
    stand = neuerStand(T0, 2);
    await s.laden();
    expect(umzug).toHaveBeenCalledWith(2);
  });
});
