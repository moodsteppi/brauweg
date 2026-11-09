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
