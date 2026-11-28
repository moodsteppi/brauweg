/**
 * „Zuletzt gespielt" für Spiele ohne Tisch (seit dem 28.11.2026,
 * Startseiten-Umbau): Solo-Spiele und Arenen melden sich beim Öffnen selbst
 * (`POST /api/zuletzt/:spiel`). Tischspiele trägt der Server beim Hinsetzen
 * selbst ein — dort braucht es diesen Haken nicht.
 *
 * Still: Eine Anzeige im Spiele-Tab darf kein Spiel stören. Kein Netz, kein
 * Konto (Gast ohne Anmeldung, 401) oder ein älterer Server ohne die Route —
 * alles wird geschluckt. Auch ein synchroner Fehler: In den Bildschirmproben
 * ist `api` oft nur teilweise nachgebaut, und ein fehlendes `zuletztMelden`
 * soll dort nicht den Bildschirm umwerfen.
 */

import { useEffect } from 'react';

import { api } from './api';

/** Kennungen wie im Server: `SOLO_SPIELE` und `SCHNELLSPIEL_ARENEN` (server/src/schnellspiel.ts). */
export type SelbstMelder =
  | 'prosubway'
  | 'browort'
  | 'flyingbro'
  | 'kartenmanufaktur'
  | 'tanks-online'
  | 'ice-clash';

export function zuletztMelden(spiel: SelbstMelder): void {
  try {
    Promise.resolve(api.zuletztMelden(spiel)).catch(() => undefined);
  } catch {
    // siehe Kopf: still
  }
}

/**
 * Einmal je Öffnen des Bildschirms melden. `an = false` für Proben mit
 * nachgestelltem Server: Dort spielt niemand, also wird auch nichts gemeldet.
 */
export function useZuletztMelden(spiel: SelbstMelder, an = true): void {
  useEffect(() => {
    if (an) zuletztMelden(spiel);
  }, [spiel, an]);
}
