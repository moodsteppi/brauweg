import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RaumSicht } from '@brauweg/broremote-kern';
import type { SitzungsEreignisse } from './transport';

const draht = vi.hoisted(() => ({ e: null as SitzungsEreignisse | null, senden: vi.fn(() => true), schliessen: vi.fn() }));
vi.mock('./transport', () => ({
  hatLan: () => false,
  nativLauschen: () => () => undefined,
  nativ: vi.fn(), lanGastgeber: vi.fn(),
  Verbindung: class {
    constructor(_z: unknown, e: SitzungsEreignisse) { draht.e = e; e.status('verbinden'); }
    senden = draht.senden;
    schliessen = draht.schliessen;
  },
}));
import { BroRemote } from './BroRemote';

const link = () => `https://staging.brauweg-spielen.de/broremote#t=relay&r=ABC12345&k=${'a'.repeat(32)}&b=${Date.now() + 600_000}`;
beforeEach(() => {
  sessionStorage.clear(); history.replaceState(null, '', '/broremote');
  draht.e = null; draht.senden.mockClear(); draht.schliessen.mockClear();
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => cleanup());

it('nimmt eine neue Einladung auch auf einer schon geöffneten BroRemote-Seite an', () => {
  render(<BroRemote />);
  expect(screen.getByRole('heading', { name: /Großes Bild/ })).toBeInTheDocument();
  act(() => { history.replaceState(null, '', `/broremote${new URL(link()).hash}`); window.dispatchEvent(new HashChangeEvent('hashchange')); });
  expect(screen.getByRole('heading', { name: 'Fast dabei.' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Lobby eröffnen/ })).not.toBeInTheDocument();
  expect(window.location.hash).toBe('');
});

it('wechselt von Bereitstatus zum Controller und verwirft alte private Informationen', () => {
  render(<BroRemote />);
  fireEvent.click(screen.getByRole('button', { name: /Bro Building Battle/ }));
  fireEvent.change(screen.getByLabelText('Dein Spielername'), { target: { value: 'Anna' } });
  fireEvent.change(screen.getByLabelText('Einladungslink'), { target: { value: link() } });
  fireEvent.click(screen.getByRole('button', { name: 'Verbinden' }));
  const s: RaumSicht = { raum: 'ABC12345', phase: 'lobby', abschnitt: 1, layout: 'bauen', gesperrt: false, gastgeberDa: true, einladungBis: Date.now() + 600_000, spieler: [{ id: 'anna', name: 'Anna', farbe: '#80e5cd', verbunden: true, bereit: false }] };
  act(() => {
    draht.e!.status('verbunden');
    draht.e!.nachricht({ art: 'willkommen', rolle: 'spieler', raum: s.raum, schluessel: 'b'.repeat(32), spieler: 'anna' });
    draht.e!.nachricht({ art: 'raum', sicht: s });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ich bin bereit' }));
  expect(draht.senden).toHaveBeenCalledWith({ art: 'bereit', bereit: true });
  act(() => draht.e!.nachricht({ art: 'raum', sicht: { ...s, phase: 'test', abschnitt: 2 } }));
  expect(screen.getByRole('button', { name: 'Drehen' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Eure Lobby' })).not.toBeInTheDocument();
  act(() => draht.e!.nachricht({ art: 'privat', abschnitt: 1, daten: { hinweis: 'Alter Geheimtext' } }));
  expect(screen.queryByText('Alter Geheimtext')).not.toBeInTheDocument();
  act(() => draht.e!.nachricht({ art: 'privat', abschnitt: 2, daten: { hinweis: 'Nur für Anna' } }));
  expect(screen.getByText('Nur für Anna')).toBeInTheDocument();
  act(() => draht.e!.nachricht({ art: 'raum', sicht: { ...s, phase: 'test', abschnitt: 3, layout: 'auswahl' } }));
  expect(screen.queryByText('Nur für Anna')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Mond/ })).toBeInTheDocument();
  act(() => draht.e!.status('wiederverbinden'));
  expect(screen.queryByRole('button', { name: /Mond/ })).not.toBeInTheDocument();
});

it('zeigt den Baucontroller nur während einer laufenden eigenen Runde und stoppt ihn bei Pause', () => {
  render(<BroRemote />);
  fireEvent.click(screen.getByRole('button', { name: /Bro Building Battle/ }));
  fireEvent.change(screen.getByLabelText('Dein Spielername'), { target: { value: 'Anna' } });
  fireEvent.change(screen.getByLabelText('Einladungslink'), { target: { value: link() } });
  fireEvent.click(screen.getByRole('button', { name: 'Verbinden' }));
  const s: RaumSicht = { raum: 'ABC12345', phase: 'spiel', abschnitt: 2, layout: 'bauen', gesperrt: true, gastgeberDa: true, einladungBis: Date.now() + 600_000, partie: { id: 'runde', seed: 42, modus: 'standfest' }, spieler: [{ id: 'anna', name: 'Anna', farbe: '#80e5cd', verbunden: true, bereit: true }] };
  act(() => { draht.e!.status('verbunden'); draht.e!.nachricht({ art: 'willkommen', rolle: 'spieler', raum: s.raum, schluessel: 'b'.repeat(32), spieler: 'anna' }); draht.e!.nachricht({ art: 'raum', sicht: s }); });
  expect(screen.queryByRole('button', { name: 'Drehen' })).not.toBeInTheDocument();
  const bau = { form: 2, hoehe: 12.4, restzeit: 120, phase: 'spiel' as const, countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 8 };
  act(() => draht.e!.nachricht({ art: 'privat', abschnitt: 2, daten: { leben: 2, bau } }));
  expect(screen.getByRole('button', { name: 'Drehen' })).toBeInTheDocument();
  expect(screen.getByText('12,4 Meter')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(draht.senden).toHaveBeenLastCalledWith(expect.objectContaining({ art: 'eingabe', abschnitt: 2, aktion: { art: 'steuerung', x: 1, y: 0, tasten: [] } }));
  act(() => draht.e!.nachricht({ art: 'privat', abschnitt: 2, daten: { bau: { ...bau, phase: 'pause' } } }));
  expect(screen.queryByRole('button', { name: 'Drehen' })).not.toBeInTheDocument();
  expect(draht.senden).toHaveBeenLastCalledWith(expect.objectContaining({ aktion: { art: 'reset' } }));
  act(() => draht.e!.nachricht({ art: 'privat', abschnitt: 2, daten: { bau: { ...bau, phase: 'ende', gewonnen: true } } }));
  expect(screen.getByText('Gewonnen!')).toBeInTheDocument();
});

it('ein neu geladenes Gastgeberfenster setzt eine verlorene Physikrunde in die Lobby zurück', () => {
  sessionStorage.setItem('brauweg.broremote.sitzung.v1', JSON.stringify({ transport: 'relay', adresse: 'wss://staging.brauweg-spielen.de/ws/broremote', rolle: 'gastgeber', raum: 'ABC12345', schluessel: 'a'.repeat(32) }));
  render(<BroRemote />); fireEvent.click(screen.getByRole('button', { name: 'Zur letzten Lobby zurück' }));
  act(() => draht.e!.nachricht({ art: 'raum', sicht: { raum: 'ABC12345', phase: 'spiel', abschnitt: 4, layout: 'bauen', gesperrt: true, gastgeberDa: true, einladungBis: Date.now(), spieler: [], partie: { id: 'alt', seed: 42, modus: 'rennen' } } }));
  expect(draht.senden).toHaveBeenCalledWith({ art: 'lobby' });
  expect(screen.getByText(/Gastgeberseite wurde neu geöffnet/)).toBeInTheDocument();
});
