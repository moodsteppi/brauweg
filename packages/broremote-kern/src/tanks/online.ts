import type { ArtiPrivat, Spieler, TanksOptionen } from '../index.js';
import type { TanksSicht } from './partie.js';
/** Flugbahnen werden aus denselben Startwerten gezeichnet, nicht 5× pro Sekunde übertragen. */
export type TanksNetzSicht = Omit<TanksSicht, 'gelaende' | 'schuss'> & { gelaende: number[] };
export type TanksStand = {
  art: 'stand'; code: string; ich: string; host: string; spieler: Spieler[];
  optionen: TanksOptionen; partie: number; sicht?: TanksNetzSicht; privat?: ArtiPrivat;
};
