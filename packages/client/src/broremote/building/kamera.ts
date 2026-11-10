import { REGELN, spawnHoehe } from '@brauweg/building-kern';

export type BauKamera = { oben: number; ziel: number };

/** Oberhalb der Ziellinie gibt es keinen neuen Spawn. Dort noch einen
 * höheren Nachschub einzuplanen machte gerade beim Zieleinlauf alles winzig. */
export function kameraBedarf(hoehe: number, aktiveHoehe: number | undefined, rennen: boolean): number {
  return Math.max(spawnHoehe(rennen ? Math.min(REGELN.ziel, hoehe) : hoehe) + 3, (aktiveHoehe ?? 0) + 3);
}

/** Eine Runde wird nur weiter, nie wieder enger. Neue Fallteile und ein
 * Einsturz dürfen deshalb kein Pumpen der Kamera auslösen. Acht-Meter-Stufen
 * lassen zwischen zwei ruhigen Fahrten Platz für mehrere Bauteile. */
export function kameraSchritt(vorher: BauKamera | undefined, benoetigt: number, sekunden: number, ruhe = false): BauKamera {
  const stufe = 22 + Math.max(0, Math.ceil((benoetigt - 22) / 8)) * 8;
  const ziel = Math.max(vorher?.ziel ?? 22, stufe);
  const oben = vorher?.oben ?? ziel;
  // Mehr als 100 ms nach einer Hintergrundpause werden nicht nachgeholt.
  const faktor = 1 - Math.exp(-Math.max(0, Math.min(.1, sekunden)) / 1.1);
  return { ziel, oben: ruhe || ziel - oben < .01 ? ziel : oben + (ziel - oben) * faktor };
}
