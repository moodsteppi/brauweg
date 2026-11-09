import { beforeEach, expect, it, vi } from 'vitest';
import { BauBuch, chronikLesen } from './chronik';
import { api } from '../../api';
import type { BauErgebnis } from '@brauweg/building-kern';
vi.mock('../../api', () => ({ api: { bauStart: vi.fn(), bauErgebnis: vi.fn() } }));
const ergebnis: BauErgebnis = { modus: 'rennen', hoehe: 17, gebaut: 14, verloren: 1, leben: 3, platz: 1, gewonnen: true, aufgegeben: false, dauer: 40, spielerzahl: 2 };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
it('Gast speichert lokal ohne erfundene Kontomünzen, dieselbe Runde bleibt einmalig', async () => {
  vi.mocked(api.bauStart).mockRejectedValue(new Error('Nicht angemeldet'));
  const buch = new BauBuch('runde-gast', 'rennen');
  expect(await buch.speichern(ergebnis, 'Anna')).toContain('Auf diesem Gerät');
  await buch.speichern(ergebnis, 'Anna');
  expect(chronikLesen()).toHaveLength(1); expect(chronikLesen()[0].muenzen).toBeUndefined(); expect(api.bauErgebnis).not.toHaveBeenCalled();
});
it('Kontobelohnung stammt aus der Serverantwort, fehlgeschlagene Übertragung bleibt nachmeldbar', async () => {
  vi.mocked(api.bauStart).mockResolvedValue({ konto: 'a', partie: 'runde-online' });
  vi.mocked(api.bauErgebnis).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ muenzen: 7, abzeichen: [], wiederholt: false });
  const buch = new BauBuch('runde-online', 'rennen');
  expect(await buch.speichern(ergebnis, 'Anna')).toContain('erneut versuchen'); expect(chronikLesen()[0].konto).toBe('a');
  expect(await buch.speichern(ergebnis, 'Anna')).toContain('+7 Münzen'); expect(chronikLesen()[0].muenzen).toBe(7);
});
