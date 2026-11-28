import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { erstelle, handeln, sicht, erlaubt, type Partie } from '@brauweg/game-wuerfelglanz';
import { api } from '../api';
import { WuerfelglanzMenue, WuerfelglanzPartie, Wuerfel } from './Wuerfelglanz';
vi.mock('../klang', () => ({ spiele: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => {
  vi.spyOn(api, 'tables').mockResolvedValue([]);
  vi.spyOn(api, 'defaults').mockResolvedValue({ config: {}, protocolVersion: 1, seatCounts: [1, 2, 3, 4, 5, 6], rounds: { 1: [1], 2: [1], 3: [1], 4: [1], 5: [1], 6: [1] } });
  vi.spyOn(api, 'eigeneBestleistungen').mockResolvedValue([]);
  vi.spyOn(api, 'createTable').mockResolvedValue({ id: 'tisch-neu', joinCode: 'GLANZ5' });
});
it('legt Solo mit einem Platz und eine Mehrspielerrunde mit gewählter Spielerzahl an', async () => {
  const tisch = vi.fn(); render(<WuerfelglanzMenue onBack={vi.fn()} onTisch={tisch} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Allein spielen' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Allein spielen' }));
  await waitFor(() => expect(tisch).toHaveBeenCalledWith('tisch-neu'));
  expect(api.createTable).toHaveBeenCalledWith({ gameId: 'wuerfelglanz', seats: 1, rounds: 1, visibility: 'on_request' });
  fireEvent.click(within(screen.getByRole('group', { name: 'Spielerzahl' })).getByRole('button', { name: '4' }));
  fireEvent.click(screen.getByRole('button', { name: 'Offenen Tisch für 4 erstellen' }));
  await waitFor(() => expect(api.createTable).toHaveBeenLastCalledWith({ gameId: 'wuerfelglanz', seats: 4, rounds: 1, visibility: 'public' }));
});
// Seit dem 28.11.2026: Quick-Play über die Schlange statt der Liste offener Tische.
it('Quick-Play sucht über die Schlange; eine Tischliste gibt es nicht mehr', async () => {
  vi.spyOn(api, 'sucheStarten').mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null } as never);
  vi.spyOn(api, 'sucheStand').mockReturnValue(new Promise(() => {}));
  vi.spyOn(api, 'sucheAbbrechen').mockResolvedValue({ ok: true });
  render(<WuerfelglanzMenue onBack={vi.fn()} onTisch={vi.fn()} />);
  expect(screen.queryByText(/Offene Würfeltische/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Quick-Play' }));
  await waitFor(() => expect(api.sucheStarten).toHaveBeenCalledWith('wuerfelglanz', undefined));
  expect(await screen.findByRole('heading', { name: 'Mitspieler suchen' })).toBeTruthy();
  expect(api.tables).not.toHaveBeenCalled();
});
it('startet ohne geladene Spielvorgabe nichts und erlaubt einen erneuten Abruf', async () => {
  vi.mocked(api.defaults).mockRejectedValueOnce(new Error('Server nicht erreichbar'));
  render(<WuerfelglanzMenue onBack={vi.fn()} onTisch={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Würfelglanz ist gerade nicht erreichbar');
  expect(screen.getByRole('button', { name: 'Allein spielen' })).toBeDisabled();
  expect(api.createTable).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Allein spielen' })).toBeEnabled());
});
it('Würfel halten, Punktevorschau auswählen und erst nach Bestätigung eintragen', () => {
  const p = handeln(erstelle(1, 6), 0, { art: 'wuerfeln' }); const aktion = vi.fn();
  render(<WuerfelglanzPartie sicht={sicht(p, 0)} namen={['Du']} aktionen={erlaubt(p, 0)} onAktion={aktion} onBack={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Würfel 1:/ }));
  expect(aktion).toHaveBeenLastCalledWith({ art: 'halten', index: 0 });
  const chance = screen.getByRole('button', { name: /Chance: Alle Augen zählen/ }); fireEvent.click(chance);
  expect(aktion).not.toHaveBeenCalledWith({ art: 'eintragen', kategorie: 'chance' });
  fireEvent.click(screen.getByRole('button', { name: /\d+ Punkte eintragen/ }));
  expect(aktion).toHaveBeenLastCalledWith({ art: 'eintragen', kategorie: 'chance' });
});
it('verlangt für einen Null-Eintrag eine ausdrückliche Bestätigung', () => {
  const p = { ...handeln(erstelle(1, 7), 0, { art: 'wuerfeln' }), wuerfel: [1, 2, 3, 4, 6] }; const aktion = vi.fn();
  render(<WuerfelglanzPartie sicht={sicht(p, 0)} namen={['Du']} aktionen={erlaubt(p, 0)} onAktion={aktion} onBack={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Fünferglanz: Fünf gleiche Würfel/ }));
  fireEvent.click(screen.getByRole('button', { name: '0 Punkte eintragen' }));
  expect(aktion).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Mit 0 Punkten eintragen' }));
  expect(aktion).toHaveBeenCalledWith({ art: 'eintragen', kategorie: 'fuenferglanz' });
});
it('Mitspieler und Zuschauer können Würfe und fremde Bögen nicht verändern', () => {
  const p = handeln(erstelle(2, 9), 0, { art: 'wuerfeln' });
  const { rerender } = render(<WuerfelglanzPartie sicht={sicht(p, 1)} namen={['Robin', 'Du']} aktionen={[]} onAktion={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Mitspieler am Zug' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Würfel 1:/ })).toBeDisabled();
  rerender(<WuerfelglanzPartie sicht={sicht(p, null)} namen={['Robin', 'Du']} aktionen={[]} onAktion={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByRole('button', { name: /Chance: Alle Augen zählen/ })).toBeDisabled();
});
it('zeigt Ende und Bonus korrekt und erlaubt keinen weiteren Wurf', () => {
  const p: Partie = { ...erstelle(1, 0), fertig: true, boegen: [{ eins: 3, zwei: 6, drei: 9, vier: 12, fuenf: 15, sechs: 18, chance: 30 }] };
  render(<WuerfelglanzPartie sicht={sicht(p, 0)} namen={['Du']} aktionen={[]} onAktion={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByText('inklusive 35 Bonuspunkten', { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Dein Bogen glänzt' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Würfeln' })).not.toBeInTheDocument();
});
it('zeichnet alle sechs Würfelseiten mit richtiger Augenzahl', () => {
  const { container } = render(<Wuerfel wert={6} index={0} />);
  for (let n = 1; n <= 6; n++) expect(container.querySelectorAll(`.s-${n} .punkt`)).toHaveLength(n);
});

it('verdeckt die Würfel vor jedem ersten Wurf und zeigt erst danach echte Augen', () => {
  const start = erstelle(1, 88);
  const props = { namen: ['Du'], onAktion: vi.fn(), onBack: vi.fn() };
  const { rerender } = render(<WuerfelglanzPartie {...props} sicht={sicht(start, 0)} aktionen={erlaubt(start, 0)} />);
  expect(screen.getByRole('img', { name: 'Würfelbecher mit fünf verdeckten Würfeln' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Würfel 1:/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Würfeln' })).toBeEnabled();
  const wurf = handeln(start, 0, { art: 'wuerfeln' });
  rerender(<WuerfelglanzPartie {...props} sicht={sicht(wurf, 0)} aktionen={erlaubt(wurf, 0)} />);
  expect(screen.queryByRole('img', { name: 'Würfelbecher mit fünf verdeckten Würfeln' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Würfel 1:/ })).toBeInTheDocument();
  const neuerZug = handeln(wurf, 0, { art: 'eintragen', kategorie: 'chance' });
  rerender(<WuerfelglanzPartie {...props} sicht={sicht(neuerZug, 0)} aktionen={erlaubt(neuerZug, 0)} />);
  expect(screen.getByRole('img', { name: 'Würfelbecher mit fünf verdeckten Würfeln' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Würfel 1:/ })).not.toBeInTheDocument();
});
