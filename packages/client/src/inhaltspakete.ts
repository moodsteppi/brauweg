/**
 * Zusatzpakete in der Auswahl eines Spiels: welche Kachel gesperrt ist, und
 * mit welchem Grund (seit dem 22.09.2026, Robins Entscheidung S3).
 *
 * WAS kostet und WER es besitzt, weiss allein der Server
 * (`server/src/inhaltspakete.ts`) — hier wird nichts nachgebildet. Die
 * Antwort kommt aus dem Shop (`tischware`, Art `inhaltspaket`, mit Spiel und
 * Regelsatzfeld). Nur was dort als NICHT besessen steht, wird gesperrt.
 *
 * Laesst sich der Shop nicht laden (alter Server, kurz weg, Proben ohne
 * `api.shop`), ist NICHTS gesperrt: Die Sperre am Server bleibt die
 * eigentliche, und eine Auswahl, die aus Unwissen alles verriegelt, waere
 * schlimmer als eine, die einmal zu viel erlaubt und dann die Absage zeigt.
 *
 * Ohne React-Bildschirm und ohne Spielpaket, damit Golf und Partykiste es
 * gleichermassen einhaengen koennen und das Hauptpaket nichts mitschleppt.
 */

import { useEffect, useState } from 'react';

import { api, type RegalWare } from './api';
import { t } from './i18n';

/** Wo im Shop die Pakete stehen — derselbe Titel wie das Regal in GameSelect. */
export const SHOP_RUBRIK = 'Spielpakete';

/** Der Grund an der gesperrten Kachel: Preis und wohin. Kurz — er ersetzt den Untertitel. */
export function sperrgrund(ware: Pick<RegalWare, 'preis'>): string {
  return `${ware.preis.coins} Münzen · Im Shop ansehen: „${SHOP_RUBRIK}“`;
}

/** Aus dem Regal: die nicht besessenen Pakete dieses Spiels, nach `feld:wert`. */
export function sperrenAus(tischware: readonly RegalWare[] | null | undefined, spiel: string): Map<string, RegalWare> {
  const sperren = new Map<string, RegalWare>();
  for (const ware of tischware ?? []) {
    if (ware.art !== 'inhaltspaket' || ware.besessen || ware.inhalt?.spiel !== spiel) continue;
    sperren.set(`${ware.inhalt.feld}:${ware.wert}`, ware);
  }
  return sperren;
}

/**
 * Sperrgruende fuer die Auswahl eines Spiels: `(feld, wert) => Grund | undefined`.
 *
 * Einmal je Aufbau geholt. Wer im Shop kauft und zurueckkommt, baut den
 * Bildschirm neu auf — dann stimmt es wieder, ohne dass hier jemand horcht.
 */
export function useInhaltsSperren(spiel: string): (feld: string, wert: string) => string | undefined {
  const [sperren, setSperren] = useState<Map<string, RegalWare>>(() => new Map());
  useEffect(() => {
    let lebt = true;
    void Promise.resolve()
      .then(() => api.shop())
      .then((shop) => {
        if (lebt) setSperren(sperrenAus(shop?.tischware, spiel));
      })
      .catch(() => {
        /* Ohne Shop nichts gesperrt — siehe Kopf. */
      });
    return () => {
      lebt = false;
    };
  }, [spiel]);
  return (feld, wert) => {
    const ware = sperren.get(`${feld}:${wert}`);
    return ware ? sperrgrund(ware) : undefined;
  };
}

/**
 * Die Meldung zu einem abgelehnten Tisch: Fehlt ein Paket, sagt es das
 * Woerterbuch (mit dem Weg in den Shop) — sonst bleibt der bisherige Satz
 * des Bildschirms stehen.
 *
 * Nach Form gefragt statt mit `instanceof ApiError`: Die Bildschirmproben
 * ersetzen `../api` durch eine Attrappe ohne die Klasse, und ein Fehlerpfad,
 * der dort selbst wirft, verdeckte den eigentlichen Fehler.
 */
export function tischFehler(fehler: unknown, sonst: string): string {
  const f = fehler as { code?: unknown; messageKey?: unknown } | null;
  return f?.code === 'inhaltspaketFehlt' && typeof f.messageKey === 'string' ? t(f.messageKey) : sonst;
}
