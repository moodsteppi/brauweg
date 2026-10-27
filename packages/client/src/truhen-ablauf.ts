import type { Grad } from './api';

/** Gemeinsame Zeitachse für Deckel, Licht, Münzen und die Anzeige der Belohnung. */
export const TRUHEN_ZEIT = { spannen: 0.6, offen: 1.35, muenzen: 0.85, belohnung: 1.65, fertig: 3.2 } as const;
export const TRUHEN_STIL: Record<Grad, { name: string; panel: string; innen: string; metall: string; akzent: string; licht: string; metallisch: number; funken: number }> = {
  holz: { name: 'Holztruhe', panel: '#a5632e', innen: '#291b18', metall: '#69778d', akzent: '#edb84e', licht: '#ffd58c', metallisch: 0.35, funken: 6 },
  bronze: { name: 'Bronzetruhe', panel: '#633c29', innen: '#2c1a17', metall: '#d58b4c', akzent: '#ffcf82', licht: '#ffc08a', metallisch: 0.65, funken: 9 },
  silber: { name: 'Silbertruhe', panel: '#233f69', innen: '#102139', metall: '#cbddec', akzent: '#84dbff', licht: '#d8efff', metallisch: 0.75, funken: 12 },
  gold: { name: 'Goldtruhe', panel: '#16376b', innen: '#10213c', metall: '#f4bc42', akzent: '#fff0a2', licht: '#ffda79', metallisch: 0.75, funken: 16 },
  diamant: { name: 'Diamanttruhe', panel: '#133e71', innen: '#0b2441', metall: '#f6c150', akzent: '#62dbff', licht: '#a4edff', metallisch: 0.75, funken: 22 },
};
export const begrenze = (n: number): number => Math.max(0, Math.min(1, n));
const sanft = (n: number): number => { const t = begrenze(n); return t * t * (3 - 2 * t); };

/** Sekunden seit dem Tipp; vor dem Öffnen gibt es weder Licht noch fliegende Münzen. */
export function truhenPose(sekunden: number) {
  const t = Math.max(0, sekunden);
  const heben = sanft((t - TRUHEN_ZEIT.spannen) / 0.75);
  const rueckfedern = t < TRUHEN_ZEIT.spannen ? 0 : Math.sin((t - TRUHEN_ZEIT.spannen) * 10) * Math.exp(-(t - TRUHEN_ZEIT.spannen) * 4) * 0.12;
  const kraft = Math.sin(begrenze(t / TRUHEN_ZEIT.spannen) * Math.PI);
  return {
    deckel: -heben * 1.72 - rueckfedern,
    wackeln: t < TRUHEN_ZEIT.spannen ? Math.sin(t * 43) * kraft * 0.045 : 0,
    stauchen: 1 - kraft * 0.045,
    hoehe: Math.sin(heben * Math.PI) * 0.08,
    licht: sanft((t - 0.68) / 0.45),
    muenzen: t - 0.85,
  };
}
