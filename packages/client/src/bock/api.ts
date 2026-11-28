/**
 * BroweG-Bock — der Weg zum Server (Routen: server/src/http/bock-routen.ts).
 *
 * Eigene Datei und nicht in `../api.ts`, weil an der Startseite drei
 * Aufgaben gleichzeitig arbeiten und `api.ts` sonst die Stelle waere, an der
 * ihre Zweige zusammenstossen. Der Aufruf selbst ist derselbe wie dort:
 * Cookie im Browser, Token in der App (`laufzeit.ts`), Fehler als Schluessel.
 *
 * Die Typen beschreiben, was der Server schickt (`BockSicht` in
 * server/src/bock/dienst.ts). Gerechnet wird hier nichts: Punkte, Rang und
 * Restzeit kommen fertig — wie an jedem Tisch.
 */

import { ApiError } from '../api';
import { apiBase, inApp, sessionToken } from '../laufzeit';

export interface BockSitz {
  readonly name: string;
  readonly bot: boolean;
  readonly verlassen: boolean;
  readonly bildUrl: string | null;
  readonly punkte: number;
  readonly rang: number;
}

export interface BockStationPlatz {
  readonly sitz: number;
  readonly platz: number;
  readonly punkte: number;
}

export interface BockErgebnisZeile {
  readonly sitz: number;
  readonly punkte: number;
  readonly siege: number;
  readonly platz: number;
  readonly trophaeen: number;
  readonly muenzen: number;
}

export interface BockSicht {
  readonly id: string;
  readonly art: 'suche' | 'freunde';
  readonly code: string | null;
  readonly zustand: 'wartet' | 'laeuft' | 'fertig';
  readonly gastgeber: boolean;
  readonly ich: number | null;
  readonly sitze: readonly BockSitz[];
  /** Je Station das Spiel; in der Lobby `null` für „Zufällig". */
  readonly plan: readonly (string | null)[];
  readonly kandidaten: readonly string[];
  readonly station: number;
  readonly stationen: readonly {
    readonly nr: number;
    readonly gameId: string;
    readonly fertig: boolean;
    readonly platzierung: readonly BockStationPlatz[] | null;
  }[];
  readonly tisch: { readonly tableId: string; readonly gameId: string } | null;
  readonly weiterInMs: number | null;
  readonly ergebnis: readonly BockErgebnisZeile[] | null;
}

export interface BockSuchstand {
  readonly sucht: boolean;
  readonly suchende: number;
  readonly restMs: number;
  readonly bockId: string | null;
}

async function anfrage<T>(pfad: string, methode = 'GET', rumpf?: unknown): Promise<T> {
  const token = sessionToken();
  const antwort = await fetch(`${apiBase}/api${pfad}`, {
    method: methode,
    credentials: inApp ? 'omit' : 'same-origin',
    // Kopfzeile nur mit Rumpf — derselbe Fastify-Stolperstein wie in api.ts.
    headers: {
      ...(rumpf !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: rumpf !== undefined ? JSON.stringify(rumpf) : undefined,
  });
  if (!antwort.ok) {
    const fehler = (await antwort.json().catch(() => ({}))) as { code?: string; messageKey?: string };
    throw new ApiError(fehler.code ?? 'internal', fehler.messageKey ?? 'error.internal', antwort.status);
  }
  return (await antwort.json()) as T;
}

export const bockApi = {
  aktiv: () => anfrage<{ bockId: string | null }>('/bock/aktiv'),
  erstellen: () => anfrage<BockSicht>('/bock', 'POST', {}),
  beitreten: (code: string) => anfrage<BockSicht>(`/bock/code/${encodeURIComponent(code)}`, 'POST', {}),
  stand: (id: string) => anfrage<BockSicht>(`/bock/${id}`),
  planSetzen: (id: string, plan: readonly (string | null)[]) => anfrage<BockSicht>(`/bock/${id}/plan`, 'PUT', { plan }),
  starten: (id: string) => anfrage<BockSicht>(`/bock/${id}/start`, 'POST', {}),
  verlassen: (id: string) => anfrage<{ ok: true }>(`/bock/${id}/verlassen`, 'POST', {}),
  sucheBetreten: () => anfrage<BockSuchstand>('/bock/suche', 'POST', {}),
  sucheStand: () => anfrage<BockSuchstand>('/bock/suche'),
  sucheAbbrechen: () => anfrage<{ ok: true }>('/bock/suche/abbrechen', 'POST', {}),
};
