import type { Karte } from '../karte';

/**
 * Verkleinert (war 16×34 — für zwei Strudel viel zu lang): Zwei
 * Wandnasen bilden auf halber Höhe eine Taille, die das Feld in Anflug und
 * Landezone gliedert. Der große Strudel sitzt genau dort, wo ein voll
 * getroffener Ball ohnehin zur Ruhe käme, und wirft ihn knapp vor dem Loch
 * wieder aus. Der kleine Strudel liegt abseits am Wegesrand, direkt an der
 * Taille, und zeigt dieselbe Anziehung im Kleinen.
 */
export const bahn: Karte = {
  id: 'k08-der-strudelgarten',
  name: 'Der Strudelgarten',
  schwierigkeit: 1,
  breite: 16,
  hoehe: 28,
  par: 2,
  schlagLimit: 7,
  zeitLimitS: 65,
  abschlaege: [
    [8, 24],
    [6, 24],
    [10, 24],
    [12, 24],
  ],
  loch: [8, 4],
  waende: [
    { x: 0, y: 15.5, w: 4, h: 0.8 },
    { x: 12, y: 15.5, w: 4, h: 0.8 },
  ],
  zonen: [
    { art: 'strudel', x: 8.5, y: 6.7, r: 1.5, staerke: 8, ziel: { x: 8, y: 6 } },
    { art: 'strudel', x: 3, y: 18, r: 0.6, staerke: 3 },
  ],
  dekor: 'wiese',
};
