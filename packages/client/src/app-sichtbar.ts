import { inApp } from './laufzeit';

/**
 * Spiele, die in der App gar nicht auftauchen sollen — auch nicht in der
 * eigenen Statistik oder unter „Deine Spiele" (Emile, 22.10.2026).
 *
 * Nur die Partykiste: Sie steht in der App auf „Kommt bald" (FREIGABE im
 * Server), und als Trinkspiel soll sie dort nirgends mehr zu sehen sein. Die
 * übrigen „Bald"-Spiele (Eiland, Zauberer …) bleiben in der Statistik — wer sie
 * auf der Webseite gespielt hat, soll seine Partien sehen.
 */
const IN_APP_AUSGEBLENDET: ReadonlySet<string> = new Set(['partykiste']);

export function inAppSichtbar(gameId: string): boolean {
  return !inApp || !IN_APP_AUSGEBLENDET.has(gameId);
}
