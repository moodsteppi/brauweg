import { afterEach, describe, expect, it, vi } from 'vitest';
import { Verbindung, type Ereignisse, type SitzungsEreignisse } from './transport';

afterEach(() => vi.useRealTimers());

describe('BroRemote-Wiederverbindung', () => {
  it('meldet nach Verbindungsverlust denselben Sitz an und liefert keine alten Eingaben nach', async () => {
    vi.useFakeTimers();
    const leitungen: { e: Ereignisse; senden: ReturnType<typeof vi.fn>; schliessen: ReturnType<typeof vi.fn> }[] = [];
    const oeffner = (_adresse: string, _lokal: boolean, e: Ereignisse) => {
      const k = { e, senden: vi.fn(() => true), schliessen: vi.fn() }; leitungen.push(k); return k;
    };
    const e: SitzungsEreignisse = { nachricht: vi.fn(), status: vi.fn(), fehler: vi.fn(), merken: vi.fn() };
    const v = new Verbindung({ transport: 'relay', adresse: 'wss://staging.brauweg-spielen.de/ws/broremote', rolle: 'spieler', raum: 'ABCD1234', einladung: 'a'.repeat(32), name: 'Anna' }, e, oeffner);
    leitungen[0].e.offen();
    expect(leitungen[0].senden).toHaveBeenLastCalledWith(expect.objectContaining({ art: 'beitreten', name: 'Anna' }));
    leitungen[0].e.nachricht({ art: 'willkommen', rolle: 'spieler', raum: 'ABCD1234', schluessel: 'b'.repeat(32), spieler: 'anna' });
    expect(e.merken).toHaveBeenCalledWith(expect.objectContaining({ schluessel: 'b'.repeat(32), einladung: undefined }));
    leitungen[0].e.zu();
    expect(v.senden({ art: 'eingabe', folge: 99 })).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    leitungen[1].e.offen();
    expect(leitungen[1].senden).toHaveBeenCalledExactlyOnceWith({ art: 'fortsetzen', raum: 'ABCD1234', schluessel: 'b'.repeat(32) });
    // Späte Ereignisse einer bereits ersetzten Verbindung werden ignoriert.
    leitungen[0].e.nachricht({ art: 'beendet', text: 'alt' });
    expect(e.status).not.toHaveBeenCalledWith('beendet');
    leitungen[1].e.nachricht({ art: 'willkommen', rolle: 'spieler', raum: 'ABCD1234', schluessel: 'b'.repeat(32), spieler: 'anna' });
    v.schliessen();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('startet nach einem ausdrücklichen Raumende keine Wiederverbindung', async () => {
    vi.useFakeTimers();
    let leitung!: Ereignisse;
    const oeffner = vi.fn((_a: string, _l: boolean, e: Ereignisse) => { leitung = e; return { senden: () => true, schliessen: vi.fn() }; });
    const e: SitzungsEreignisse = { nachricht: vi.fn(), status: vi.fn(), fehler: vi.fn(), merken: vi.fn() };
    const v = new Verbindung({ transport: 'relay', adresse: 'wss://staging.brauweg-spielen.de/ws/broremote', rolle: 'gastgeber' }, e, oeffner);
    leitung.offen(); leitung.nachricht({ art: 'beendet', text: 'Geschlossen' }); leitung.zu();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(oeffner).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    v.schliessen();
  });
});
