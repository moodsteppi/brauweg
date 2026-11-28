/**
 * Die Spielarten von Filler (in der Oberflaeche „Farbduell") als
 * `GameMeta.spielarten` (seit dem 28.11.2026).
 *
 * Die Spielart war schon vorher `config.variante` — das Muster, nach dem
 * jetzt alle Spiele gebaut sind. Neu ist nur, dass die Liste im Modul steht:
 * Der Bildschirm legte bisher selbst `variante` auf die Vorgabe. Reihenfolge
 * wie im Menue (Nebel zuerst, er ist die Vorgabe des Moduls).
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { DEFAULT_REGELN, VARIANTEN } from './regeln.js';

export const SPIELARTEN: readonly Spielart[] = VARIANTEN.map((v) => spielartAus(v, DEFAULT_REGELN));
