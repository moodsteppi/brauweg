import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Adressen im Browser und in der App (23.09.2026).
 *
 * Der Server schreibt seine Adressen ohne Herkunft (`/api/avatars/…`). Im
 * Browser ist das richtig, in der App zeigte es ins App-Paket — Profilbilder
 * blieben leer, geteilte Tafelrunde-Links lauteten `brauweg://app/?tisch=…`.
 * Die Webseite muss dabei Zeichen fuer Zeichen dieselben Adressen behalten.
 *
 * `laufzeit.ts` liest `window.BRAUWEG_APP` beim Laden. Jeder Fall laedt das
 * Modul deshalb frisch.
 */

async function lade(huelle?: { apiBase: string }) {
  vi.resetModules();
  if (huelle) window.BRAUWEG_APP = huelle;
  else delete window.BRAUWEG_APP;
  return {
    laufzeit: await import('./laufzeit'),
    tischlink: await import('./minispiele/tafelrunde/tischlink'),
  };
}

afterEach(() => {
  delete window.BRAUWEG_APP;
  vi.resetModules();
});

describe('im Browser', () => {
  it('bleiben alle Adressen, wie der Server sie schreibt', async () => {
    const { laufzeit, tischlink } = await lade();
    expect(laufzeit.inApp).toBe(false);
    expect(laufzeit.serverAdresse('/api/avatars/abc')).toBe('/api/avatars/abc');
    expect(laufzeit.serverAdresse('/hub/pinguin-1.png')).toBe('/hub/pinguin-1.png');
    expect(laufzeit.serverAdresse(null)).toBeNull();
    expect(tischlink.beitrittsLink('KX7M9Q')).toBe(`${window.location.origin}/?tisch=KX7M9Q`);
  });
});

describe('in der App', () => {
  const huelle = { apiBase: 'https://www.brauweg-spielen.de/' };

  it('zeigen Serveradressen auf den Server, Paketdateien bleiben im Paket', async () => {
    const { laufzeit } = await lade(huelle);
    expect(laufzeit.inApp).toBe(true);
    expect(laufzeit.serverAdresse('/api/avatars/abc')).toBe(
      'https://www.brauweg-spielen.de/api/avatars/abc',
    );
    expect(laufzeit.serverAdresse('/hub/pinguin-1.png')).toBe('/hub/pinguin-1.png');
    expect(laufzeit.serverAdresse(undefined)).toBeNull();
  });

  it('teilt einen Tafelrunde-Link, den ein anderes Handy oeffnen kann', async () => {
    const { tischlink } = await lade(huelle);
    expect(tischlink.beitrittsLink('KX7M9Q')).toBe('https://www.brauweg-spielen.de/?tisch=KX7M9Q');
  });
});
