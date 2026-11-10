/**
 * Flying Bro: der Weg zum Server, als Schnittstelle — damit die Probe
 * (proben/flyingbro) einen nachgestellten Server einsetzen kann, wie die
 * Kartenmanufaktur es tut.
 */

import { api } from '../api';
import type { Hilfsmittel } from '@brauweg/flyingbro-kern';
import type { FlyingbroAnsicht, FlyingbroErgebnisAntwort, FlyingbroMeldung, FlyingbroStartAntwort } from './sicht';

export interface Leitung {
  stand(): Promise<FlyingbroAnsicht>;
  start(levelId: string, hilfsmittel: Hilfsmittel[]): Promise<FlyingbroStartAntwort>;
  ergebnis(m: FlyingbroMeldung): Promise<FlyingbroErgebnisAntwort>;
  /** Shop im Spiel: ein Hilfsmittel mit Flugmeilen kaufen; zurück kommt der neue Stand. */
  kauf(id: string): Promise<FlyingbroAnsicht>;
}

export const echteLeitung: Leitung = {
  stand: () => api.flyingbro(),
  start: (levelId, hilfsmittel) => api.flyingbroStart(levelId, hilfsmittel),
  ergebnis: (m) => api.flyingbroErgebnis(m),
  kauf: (id) => api.flyingbroKauf(id),
};
