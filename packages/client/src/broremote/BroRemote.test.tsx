import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RaumSicht } from '@brauweg/broremote-kern';
import type { SitzungsEreignisse } from './transport';

const draht = vi.hoisted(() => ({ e: null as SitzungsEreignisse | null, senden: vi.fn(() => true), schliessen: vi.fn() }));
const bauEmpfang = vi.hoisted(() => vi.fn());
const tanksEmpfang = vi.hoisted(() => vi.fn());
vi.mock('./brotanks/TanksArena', () => ({ default: (p: { eingaben: { current: unknown } }) => { p.eingaben.current = tanksEmpfang; return <div>Geprüfte Insel</div>; } }));
vi.mock('./building/BauArena', () => ({ default: (p: { eingaben: { current: unknown } }) => { p.eingaben.current = bauEmpfang; return <div>Geprüfte Bauwelt</div>; } }));
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
  bauEmpfang.mockClear(); tanksEmpfang.mockClear();
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

it('der Gastgeber leitet aktuelle Eingaben mit dem richtigen Spieler in die Bauwelt', async () => {
  render(<BroRemote />);
  fireEvent.click(screen.getByRole('button', { name: /Bro Building Battle/ }));
  fireEvent.click(screen.getByRole('button', { name: /Lobby eröffnen/ }));
  const s: RaumSicht = { raum: 'ABC12345', phase: 'spiel', abschnitt: 2, layout: 'bauen', gesperrt: true, gastgeberDa: true, einladungBis: Date.now(), spieler: [{ id: 'anna', name: 'Anna', farbe: '#80e5cd', verbunden: true, bereit: true }], partie: { id: 'neu', seed: 1, modus: 'rennen' } };
  act(() => { draht.e!.status('verbunden'); draht.e!.nachricht({ art: 'raum', sicht: s }); });
  await screen.findByText('Geprüfte Bauwelt');
  act(() => draht.e!.nachricht({ art: 'eingabe', spieler: 'anna', abschnitt: 2, folge: 1, aktion: { art: 'steuerung', x: 1, y: 0, tasten: ['drehen'] } }));
  expect(bauEmpfang).toHaveBeenCalledWith('anna', { art: 'steuerung', x: 1, y: 0, tasten: ['drehen'] });
  bauEmpfang.mockClear();
  act(() => draht.e!.nachricht({ art: 'eingabe', spieler: 'anna', abschnitt: 1, folge: 2, aktion: { art: 'steuerung', x: -1, y: 0, tasten: [] } }));
  expect(bauEmpfang).not.toHaveBeenCalled();
});

it('zeigt den laufenden Ping in der Lobby und trennt ihn vom Verbindungsstatus', () => {
  render(<BroRemote />);
  fireEvent.click(screen.getByRole('button', { name: /Bro Building Battle/ }));
  expect(screen.getByRole('button', { name: 'Solotraining starten' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Lobby eröffnen/ }));
  act(() => { draht.e!.status('verbunden'); draht.e!.qualitaet!({ ping: 48, schwankung: 6, versuch: 0 }); });
  expect(screen.getByLabelText('Server-Ping: 48 ms')).toBeInTheDocument();
  act(() => draht.e!.status('wiederverbinden'));
  expect(screen.queryByText('48 ms')).not.toBeInTheDocument();
  expect(screen.getByText('Verbinde erneut')).toBeInTheDocument();
});

it('ein Abbruchdialog wartet auf die bewusste Auswahl und blockiert die Verbindung nicht', () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  render(<BroRemote />);
  fireEvent.click(screen.getByRole('button', { name: /Bro Building Battle/ }));
  fireEvent.click(screen.getByRole('button', { name: /Lobby eröffnen/ }));
  act(() => { draht.e!.status('verbunden'); draht.e!.nachricht({ art: 'raum', sicht: { raum: 'ABC12345', phase: 'lobby', abschnitt: 1, layout: 'bauen', gesperrt: false, gastgeberDa: true, einladungBis: Date.now() + 60_000, spieler: [] } }); });
  fireEvent.click(screen.getByRole('button', { name: 'Lobby beenden' }));
  expect(screen.getByRole('heading', { name: 'Lobby für alle beenden?' })).toBeInTheDocument();
  expect(draht.schliessen).not.toHaveBeenCalled();
  act(() => draht.e!.qualitaet!({ ping: 21, schwankung: 1, versuch: 0 }));
  expect(screen.getByText('21 ms')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Hier bleiben'));
  expect(draht.schliessen).not.toHaveBeenCalled();
});

// BroTanks (docs/BROREMOTE-ARTILLERIE.md, Abschnitt 8): zweite Spielkarte, Spielwahl, Mindestzahl, Weiterleitung.
const lobby = (x: Partial<RaumSicht> = {}): RaumSicht => ({ raum: 'ABC12345', phase: 'lobby', abschnitt: 1, layout: 'bauen', gesperrt: false, gastgeberDa: true, einladungBis: Date.now() + 600_000, spieler: [], ...x });

it('zeigt zwei Spielkarten; BroTanks hat kein Solotraining und wählt sein Spiel in der neuen Lobby', () => {
  render(<BroRemote />);
  expect(screen.getByRole('button', { name: /Bro Building Battle/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /BroTanks/ }));
  expect(screen.getByRole('heading', { name: 'BroTanks' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Solotraining starten' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Lobby eröffnen/ }));
  act(() => { draht.e!.status('verbunden'); draht.e!.nachricht({ art: 'raum', sicht: lobby() }); });
  expect(draht.senden).toHaveBeenCalledWith({ art: 'spielwahl', spiel: 'brotanks' });
  // Einmal je Raum: Ein weiteres Raumupdate mit noch altem Spiel schickt die Wahl nicht erneut.
  act(() => draht.e!.nachricht({ art: 'raum', sicht: lobby({ abschnitt: 2 }) }));
  expect(draht.senden.mock.calls.filter(c => (c as unknown as [{ art: string }])[0].art === 'spielwahl')).toHaveLength(1);
});

it('ein neu geladener Gastgeber stellt eine BroTanks-Lobby beim Wiederverbinden nicht aufs Bauspiel zurück', () => {
  sessionStorage.setItem('brauweg.broremote.sitzung.v1', JSON.stringify({ transport: 'relay', adresse: 'wss://staging.brauweg-spielen.de/ws/broremote', rolle: 'gastgeber', raum: 'ABC12345', schluessel: 'a'.repeat(32) }));
  render(<BroRemote />); fireEvent.click(screen.getByRole('button', { name: 'Zur letzten Lobby zurück' }));
  act(() => { draht.e!.status('verbunden'); draht.e!.nachricht({ art: 'raum', sicht: lobby({ spiel: 'brotanks' }) }); });
  act(() => draht.e!.nachricht({ art: 'raum', sicht: lobby({ spiel: 'brotanks', abschnitt: 2 }) }));
  expect(draht.senden).not.toHaveBeenCalledWith(expect.objectContaining({ art: 'spielwahl' }));
  expect(screen.getByRole('button', { name: 'BroTanks' })).toHaveAttribute('aria-pressed', 'true');
});

it('der Gastgeber schaltet in der Lobby das Spiel um; für BroTanks braucht es zwei Handys', () => {
  render(<BroRemote />);
  fireEvent.click(screen.getByRole('button', { name: /Bro Building Battle/ }));
  fireEvent.click(screen.getByRole('button', { name: /Lobby eröffnen/ }));
  const anna = { id: 'anna', name: 'Anna', farbe: '#80e5cd', verbunden: true, bereit: true };
  act(() => { draht.e!.status('verbunden'); draht.e!.nachricht({ art: 'raum', sicht: lobby({ spiel: 'building', spieler: [anna] }) }); });
  expect(draht.senden).not.toHaveBeenCalledWith(expect.objectContaining({ art: 'spielwahl' }));
  expect(screen.getByText('EUER SPIELMODUS')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'BroTanks' }));
  expect(draht.senden).toHaveBeenCalledWith({ art: 'spielwahl', spiel: 'brotanks' });
  act(() => draht.e!.nachricht({ art: 'raum', sicht: lobby({ spiel: 'brotanks', spieler: [anna] }) }));
  expect(screen.queryByText('EUER SPIELMODUS')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Battle starten' })).toBeDisabled();
  expect(screen.getByText('Für BroTanks braucht ihr mindestens zwei Spieler oder Bots.')).toBeInTheDocument();
  act(() => draht.e!.nachricht({ art: 'raum', sicht: lobby({ spiel: 'brotanks', spieler: [anna, { ...anna, id: 'bert', name: 'Bert' }] }) }));
  expect(screen.getByRole('button', { name: 'Battle starten' })).toBeEnabled();
});

it('der Gastgeber leitet BroTanks-Eingaben in die Insel, nicht in die Bauwelt', async () => {
  render(<BroRemote />);
  fireEvent.click(screen.getByRole('button', { name: /BroTanks/ }));
  fireEvent.click(screen.getByRole('button', { name: /Lobby eröffnen/ }));
  const spieler = [{ id: 'anna', name: 'Anna', farbe: '#80e5cd', verbunden: true, bereit: true }, { id: 'bert', name: 'Bert', farbe: '#ff8a5c', verbunden: true, bereit: true }];
  act(() => { draht.e!.status('verbunden'); draht.e!.nachricht({ art: 'raum', sicht: lobby({ phase: 'spiel', abschnitt: 2, layout: 'zielen', gesperrt: true, spiel: 'brotanks', spieler, partie: { id: 'insel', seed: 7, spiel: 'brotanks', modus: 'rennen' } }) }); });
  await screen.findByText('Geprüfte Insel');
  expect(screen.queryByText('Geprüfte Bauwelt')).not.toBeInTheDocument();
  act(() => draht.e!.nachricht({ art: 'eingabe', spieler: 'bert', abschnitt: 2, folge: 1, aktion: { art: 'feuer', zug: 1, winkel: 45, staerke: 60, waffe: 0 } }));
  expect(tanksEmpfang).toHaveBeenCalledWith('bert', { art: 'feuer', zug: 1, winkel: 45, staerke: 60, waffe: 0 });
  expect(bauEmpfang).not.toHaveBeenCalled();
});

it('das Handy zeigt in BroTanks den Zielcontroller und schickt den Schuss mit der Zugnummer', () => {
  render(<BroRemote />);
  fireEvent.click(screen.getByRole('button', { name: /Bro Building Battle/ }));
  fireEvent.change(screen.getByLabelText('Dein Spielername'), { target: { value: 'Anna' } });
  fireEvent.change(screen.getByLabelText('Einladungslink'), { target: { value: link() } });
  fireEvent.click(screen.getByRole('button', { name: 'Verbinden' }));
  const s = lobby({ phase: 'spiel', abschnitt: 2, layout: 'zielen', gesperrt: true, spiel: 'brotanks', partie: { id: 'insel', seed: 7, spiel: 'brotanks', modus: 'rennen' }, spieler: [{ id: 'anna', name: 'Anna', farbe: '#80e5cd', verbunden: true, bereit: true }] });
  act(() => { draht.e!.status('verbunden'); draht.e!.nachricht({ art: 'willkommen', rolle: 'spieler', raum: s.raum, schluessel: 'b'.repeat(32), spieler: 'anna' }); draht.e!.nachricht({ art: 'raum', sicht: s }); });
  expect(screen.getByText('Gleich geht es los.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Drehen' })).not.toBeInTheDocument();
  const arti = { phase: 'zielen' as const, amZug: true, zug: 2, rest: 20, inZuegen: 0, winkel: 70, staerke: 40, waffe: 0, munition: [-1, 3, 2, 2, 1, 2, 1, 1], lp: 100, tank: 100, wind: 3, runde: 1, platz: 1, raus: false, gewonnen: false };
  act(() => draht.e!.nachricht({ art: 'privat', abschnitt: 2, daten: { arti } }));
  fireEvent.click(screen.getByRole('button', { name: /FEUER/ }));
  expect(draht.senden).toHaveBeenLastCalledWith(expect.objectContaining({ art: 'eingabe', abschnitt: 2, aktion: { art: 'feuer', zug: 2, winkel: 70, staerke: 40, waffe: 0 } }));
});
