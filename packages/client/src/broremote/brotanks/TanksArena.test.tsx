import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ArtiPrivat, Privat, Spieler } from '@brauweg/broremote-kern';
import TanksArena, { type EingabeEmpfang } from './TanksArena';

// Rauchtest mit der echten Partie: jsdom hat keinen 2D-Kontext, also läuft alles außer dem Zeichnen.
const SPIELER: Spieler[] = [
  { id: 'anna', name: 'Anna', farbe: '#80e5cd', verbunden: true, bereit: true },
  { id: 'bert', name: 'Bert', farbe: '#ff8a5c', verbunden: true, bereit: true },
];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function aufbauen(spieler = SPIELER): { privat: ReturnType<typeof vi.fn>; eingaben: { current: EingabeEmpfang | null }; zurLobby: ReturnType<typeof vi.fn>; rerender: (s: Spieler[]) => void; letzte: (id: string) => ArtiPrivat } {
  const privat = vi.fn(), zurLobby = vi.fn(), eingaben = { current: null as EingabeEmpfang | null };
  const el = (s: Spieler[]): React.JSX.Element => <TanksArena id="insel" seed={7} spieler={s} verbunden eingaben={eingaben} privat={privat} zurLobby={zurLobby} />;
  const r = render(el(spieler));
  const letzte = (id: string): ArtiPrivat => (privat.mock.calls.filter(c => c[0] === id).at(-1)![1] as Privat).arti!;
  return { privat, eingaben, zurLobby, rerender: s => r.rerender(el(s)), letzte };
}
const laufen = (ms: number): void => { act(() => { vi.advanceTimersByTime(ms); }); };

it('zählt herunter, gibt dem ersten Bro den Zug und verteilt nur die eigene Sicht', () => {
  const { letzte } = aufbauen();
  expect(screen.getByText('MACHT EUCH BEREIT')).toBeInTheDocument();
  expect(letzte('anna').phase).toBe('countdown');
  laufen(3500);
  const a = letzte('anna'), b = letzte('bert');
  expect([a.phase, b.phase]).toEqual(['zielen', 'zielen']);
  expect([a.amZug, b.amZug].filter(Boolean)).toHaveLength(1);
  expect(screen.getByRole('list', { name: 'Zugfolge' }).children).toHaveLength(2);
  expect(screen.getByText(/zielt$/)).toBeInTheDocument();
});

it('ein Schuss fliegt, löst sich auf und gibt den Zug weiter', () => {
  const { eingaben, letzte } = aufbauen();
  laufen(3500);
  const dran = letzte('anna').amZug ? 'anna' : 'bert';
  act(() => eingaben.current!(dran, { art: 'feuer', zug: 1, winkel: 45, staerke: 60, waffe: 0 }));
  laufen(100);
  expect(letzte(dran).phase).toBe('flug');
  expect(screen.getByText('Schuss unterwegs …')).toBeInTheDocument();
  laufen(8000);
  expect(letzte(dran).zug).toBe(2);
  expect(letzte(dran).amZug).toBe(false);
});

it('pausiert, wenn der Bro am Zug fehlt, und spielt auf Wunsch ohne ihn weiter bis zum Ergebnis', () => {
  const { letzte, rerender, zurLobby } = aufbauen();
  laufen(3500);
  const dran = letzte('anna').amZug ? 'anna' : 'bert', anderer = dran === 'anna' ? 'bert' : 'anna';
  rerender(SPIELER.map(s => s.id === dran ? { ...s, verbunden: false } : s));
  laufen(300);
  expect(screen.getByText('FEUERPAUSE')).toBeInTheDocument();
  expect(letzte(anderer).phase).toBe('pause');
  fireEvent.click(screen.getByRole('button', { name: 'Ohne fehlende Spieler weiterspielen' }));
  laufen(300);
  expect(screen.getByText(`${SPIELER.find(s => s.id === anderer)!.name} gewinnt!`)).toBeInTheDocument();
  expect(letzte(anderer).gewonnen).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Revanche vorbereiten' }));
  expect(zurLobby).toHaveBeenCalled();
});

it('Bots warten mit dem Schuss während einer Pause und feuern danach selbst', () => {
 const privat=vi.fn(), eingaben={current:null as EingabeEmpfang|null};
 render(<TanksArena id="bots" seed={7} spieler={SPIELER} bots={SPIELER.map(s=>s.id)} lokal verbunden eingaben={eingaben} privat={privat} zurLobby={()=>undefined}/>);
 laufen(3300);
 fireEvent.click(screen.getByRole('button',{name:'Spiel pausieren'}));
 laufen(5000);
 expect(privat.mock.calls.at(-1)?.[1].arti.phase).toBe('pause');
 fireEvent.click(screen.getAllByRole('button',{name:'Weiterspielen'})[0]);
 laufen(1800);
 expect(privat.mock.calls.some(c=>c[1].arti.phase==='flug')).toBe(true);
});
