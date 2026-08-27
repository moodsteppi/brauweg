/**
 * Wo das Bild zu einer Motivkennung liegt.
 *
 * Zwei Quellen, ein Vorsatz entscheidet: Die 88 Grundmotive liegen als Datei
 * unter `public/mememory/motive/`, alles mit `hoch-` davor ist hochgeladen
 * und kommt aus der Datenbank. Der Vorsatz spart den Abruf eines Katalogs,
 * bevor die erste Karte gezeichnet werden kann — er muss zu HOCH_VORSATZ in
 * packages/server/src/memes.ts passen.
 *
 * `apiBase` ist der Unterschied zwischen Browser und App-Huelle: Im Browser
 * ist er leer (dieselbe Herkunft), in der iOS-Huelle steht der Server
 * woanders, und ein `/api/...` ohne Vorsatz zeigte dort ins App-Paket.
 */

import { apiBase } from '../../laufzeit';

export const HOCH_VORSATZ = 'hoch-';

export function motivBildPfad(kennung: string): string {
  return kennung.startsWith(HOCH_VORSATZ)
    ? `${apiBase}/api/mememory/motive/${kennung}`
    : `/mememory/motive/${kennung}.webp`;
}

/**
 * Wo der Ton zu einer Motivkennung liegt — oder null, wenn es keinen geben
 * kann.
 *
 * Toene gibt es nur zu hochgeladenen Motiven. Die 88 Grundmotive liegen als
 * Dateien im Client und stehen in keiner Tabelle; es gaebe also gar keine
 * Stelle, an der jemand ihnen einen Ton anhaengen koennte. Das `null` spart
 * dem Aufrufer den Abruf, der sicher mit „nicht gefunden" endet.
 */
export function motivTonPfad(kennung: string): string | null {
  return kennung.startsWith(HOCH_VORSATZ)
    ? `${apiBase}/api/mememory/motive/${kennung}/ton`
    : null;
}
