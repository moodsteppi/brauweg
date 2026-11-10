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

describe('BroRemote-Leitungsqualität', () => {
  function aufbau() {
    vi.useFakeTimers();
    const leitungen: { e: Ereignisse; senden: ReturnType<typeof vi.fn>; schliessen: ReturnType<typeof vi.fn> }[] = [];
    const e: SitzungsEreignisse = { nachricht: vi.fn(), status: vi.fn(), fehler: vi.fn(), merken: vi.fn(), qualitaet: vi.fn() };
    const v = new Verbindung({ transport: 'relay', adresse: 'wss://example.test/ws/broremote', rolle: 'gastgeber' }, e, (_a, _l, ereignis) => {
      const k = { e: ereignis, senden: vi.fn(() => true), schliessen: vi.fn() }; leitungen.push(k); return k;
    });
    const willkommen = () => { const k = leitungen.at(-1)!; k.e.offen(); k.e.nachricht({ art: 'willkommen', rolle: 'gastgeber', raum: 'ABC12345', schluessel: 'b'.repeat(32) }); return k; };
    return { v, e, leitungen, willkommen };
  }
  it('misst nur die passende Ping-Antwort und verwirft Messwerte beim Abbruch', async () => {
    const a = aufbau(), k = a.willkommen();
    const probe = k.senden.mock.calls.at(-1)![0];
    await vi.advanceTimersByTimeAsync(42);
    k.e.nachricht({ art: 'pong', zeit: 7000, kennung: 'fremde-probe' });
    k.e.nachricht({ art: 'pong', zeit: 7000 });
    expect(a.e.qualitaet).toHaveBeenLastCalledWith({ ping: null, schwankung: 0, versuch: 0 });
    k.e.nachricht({ art: 'pong', zeit: 7000, kennung: probe.kennung });
    expect(a.e.qualitaet).toHaveBeenLastCalledWith({ ping: 42, schwankung: 0, versuch: 0 });
    k.e.zu();
    expect(a.e.qualitaet).toHaveBeenLastCalledWith({ ping: null, schwankung: 0, versuch: 1 });
    a.v.schliessen(); expect(vi.getTimerCount()).toBe(0);
  });
  it('erkennt eine halb tote Leitung auch bei weiter eintreffendem Spielstatus', async () => {
    const a = aufbau(), k = a.willkommen();
    for (let i = 0; i < 13; i++) {
      k.e.nachricht({ art: 'privat', abschnitt: 1, daten: { punkte: i } });
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(k.schliessen).toHaveBeenCalled();
    expect(a.leitungen.length).toBeGreaterThan(1);
    expect(a.e.status).toHaveBeenCalledWith('wiederverbinden'); a.v.schliessen();
  });
  it('verbindet beim Online-Ereignis sofort neu und ignoriert alte Leitungen', () => {
    const a = aufbau(), k = a.willkommen(); k.e.zu();
    window.dispatchEvent(new Event('online'));
    expect(a.leitungen).toHaveLength(2);
    a.willkommen(); k.e.nachricht({ art: 'beendet', text: 'alter Kanal' });
    expect(a.e.status).toHaveBeenLastCalledWith('verbunden');
    a.v.schliessen(); window.dispatchEvent(new Event('online'));
    expect(a.leitungen).toHaveLength(2); expect(vi.getTimerCount()).toBe(0);
  });
  it('beendet erfolglose Wiederverbindungen nach der Schonfrist und räumt alle Timer auf', async () => {
    const a = aufbau(); a.willkommen().e.zu();
    await vi.advanceTimersByTimeAsync(110_000);
    expect(a.e.status).toHaveBeenLastCalledWith('beendet');
    expect(a.e.fehler).toHaveBeenCalledWith(expect.stringContaining('erneut versuchen'));
    expect(vi.getTimerCount()).toBe(0); a.v.schliessen();
  });
  it('hält ältere Gegenstellen ohne Ping-Kennung verbunden, zeigt aber keine erfundenen Millisekunden', async () => {
    const a = aufbau(), k = a.willkommen();
    for (let i = 0; i < 15; i++) { await vi.advanceTimersByTimeAsync(1000); k.e.nachricht({ art: 'pong', zeit: Date.now() }); }
    expect(a.leitungen).toHaveLength(1);
    expect(a.e.qualitaet).toHaveBeenLastCalledWith({ ping: null, schwankung: 0, versuch: 0 }); a.v.schliessen();
  });
});
