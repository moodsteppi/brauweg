import { afterEach, describe, expect, it, vi } from 'vitest';

import { herkunft, leseKennung, merkeHerkunft, vergissHerkunft } from './herkunft';

function ort(search: string, pathname = '/', hash = '') {
  return { pathname, search, hash };
}

afterEach(() => vergissHerkunft());

describe('Werbelink ?q=', () => {
  it('liest die Kennung klein geschrieben und weist Unsinn ab', () => {
    expect(leseKennung('?q=TikTok-1')).toBe('tiktok-1');
    expect(leseKennung('?q=%20meta_a%20')).toBe('meta_a');
    expect(leseKennung('?q=')).toBeNull();
    expect(leseKennung('?q=<script>')).toBeNull();
    expect(leseKennung(`?q=${'a'.repeat(41)}`)).toBeNull();
    expect(leseKennung('?dev=hub')).toBeNull();
  });

  it('merkt sie, meldet einen Besuch und nimmt q aus der Adresse — der Rest bleibt', () => {
    const melden = vi.fn();
    const ersetzen = vi.fn();
    merkeHerkunft(melden, ort('?q=tiktok-1&probe=kampf', '/beitritt/ABC', '#x'), ersetzen);

    expect(herkunft()).toBe('tiktok-1');
    expect(melden).toHaveBeenCalledWith('tiktok-1');
    expect(ersetzen).toHaveBeenCalledWith('/beitritt/ABC?probe=kampf#x');
  });

  it('ohne q passiert nichts, nicht einmal ein Eingriff in die Adresse', () => {
    const melden = vi.fn();
    const ersetzen = vi.fn();
    merkeHerkunft(melden, ort('?dev=hub'), ersetzen);
    expect(herkunft()).toBeNull();
    expect(melden).not.toHaveBeenCalled();
    expect(ersetzen).not.toHaveBeenCalled();
  });

  it('eine ungueltige Kennung fliegt aus der Adresse, wird aber weder gemerkt noch gemeldet', () => {
    const melden = vi.fn();
    const ersetzen = vi.fn();
    merkeHerkunft(melden, ort('?q=%3Cx%3E'), ersetzen);
    expect(herkunft()).toBeNull();
    expect(melden).not.toHaveBeenCalled();
    expect(ersetzen).toHaveBeenCalledWith('/');
  });

  it('legt nichts im Browser ab — sonst braeuchte es ein Einwilligungsbanner', () => {
    const vorher = { lokal: localStorage.length, sitzung: sessionStorage.length, keks: document.cookie };
    merkeHerkunft(vi.fn(), ort('?q=meta-1'), vi.fn());
    expect(localStorage.length).toBe(vorher.lokal);
    expect(sessionStorage.length).toBe(vorher.sitzung);
    expect(document.cookie).toBe(vorher.keks);
  });
});
