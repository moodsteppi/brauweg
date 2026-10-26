/** Gezielte Rangaufstiege gegen Lehrbriefe aus Kundenauftraegen. Uhren und Faehigkeiten bleiben erhalten. */
import type { Ziel } from './formeln.js';
import { platzVon, wirkMs, abklingMs, wirkung } from './meister.js';
import type { ManufakturStand, Rang } from './stand.js';
export interface AusbildungsVorschau {
  rang: Rang;
  danach: Rang | null;
  lehrbriefe: number;
  leistbar: boolean;
  wirkt: boolean;
  wirkungVorher: number;
  wirkungNachher: number;
  dauerNachher: number;
  pauseNachher: number;
}
export function ausbildungsVorschau(s: ManufakturStand, ziel: Ziel, id: number, jetzt: number): AusbildungsVorschau | null {
  const platz = platzVon(s, ziel);
  const m = platz.pool.find(m => m.id === id);
  if (!m) return null;
  const station = ziel.art === 'presse' ? s.pressen[ziel.index] : ziel.art === 'versand' ? s.versand : s.paternoster;
  if (!station) return null;
  const wirkt = jetzt < (platz.zugewiesen === id ? station.faehigkeitBis : m.faehigkeitBis);
  const danach = m.rang === 'jung' ? 'meister' : m.rang === 'meister' ? 'ober' : null;
  const lehrbriefe = m.rang === 'jung' ? 3 : m.rang === 'meister' ? 8 : 0;
  return { rang: m.rang, danach, lehrbriefe, wirkt, leistbar: danach !== null && !wirkt && freieLehrbriefe(s) >= lehrbriefe,
    wirkungVorher: wirkung(ziel.art, m.rang, m.art), wirkungNachher: wirkung(ziel.art, danach ?? m.rang, m.art),
    dauerNachher: wirkMs(s, danach ?? m.rang), pauseNachher: abklingMs(s, danach ?? m.rang) };
}

/** Ein abgeschlossener Auftrag ergibt einen Lehrbrief, Ausbildungen verbrauchen sie. */
export function freieLehrbriefe(s: ManufakturStand): number {
  return Math.max(0, s.auftraege.erledigt - (s.zaehler.lehrbriefeVerbraucht ?? 0));
}
