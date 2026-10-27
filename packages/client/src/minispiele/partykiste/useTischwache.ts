/**
 * Tischwache: Bildschirm an lassen und kurz summen, wenn man dran ist.
 *
 * Anlass (22.09.2026): Bei der Partykiste liegt das Handy auf dem Tisch,
 * waehrend die Runde redet — beim Imposter minutenlang. Nach 30 Sekunden ging
 * der Schirm aus, und wer bei "Wer bin ich" oder "Bus fahren" an die Reihe
 * kam, merkte es erst, wenn ihn jemand anstiess. Es gab weder Wake-Lock noch
 * Ton noch Vibration.
 *
 * Zwei Dinge, bewusst ohne Ton: Ein Ton aus zwoelf Handys gleichzeitig ist
 * auf einer Party Laerm, eine Vibration spuert nur der, den es angeht.
 *
 * Beides ist Beiwerk. Kein Browser MUSS es koennen (Safari kennt `vibrate`
 * gar nicht, Wake-Lock erst seit 16.4, und im Energiesparmodus lehnt er ab),
 * deshalb schluckt der Hook jeden Fehler — ein Tisch, der daran stirbt, dass
 * das Handy nicht summen kann, waere ein schlechter Tausch.
 */

import { useEffect } from 'react';

import type { PartykisteSicht } from './sicht';

/**
 * Bin ich in einem reihum-Minispiel gerade dran?
 *
 * Keine nachgebildete Regel: Welche Minispiele reihum laufen, sagt die FORM
 * der Sicht — nur ihre `daten` tragen ein `amZug` (Wer bin ich, Bus fahren,
 * Wahrheit oder Pflicht). Die gleichzeitigen haben keins, und dort ist ja
 * ohnehin jeder dran; das obere `sicht.amZug` nennt dort nur den naechsten
 * Offenen fuer die Zugzeit und taugt nicht als "du bist dran".
 */
export function binReihumDran(sicht: PartykisteSicht | null): boolean {
  if (!sicht || sicht.fertig || sicht.sitz < 0 || sicht.phase !== 'spiel') return false;
  /* Team-Abend: Waehrend der Aufstellung steht die erste Runde nur bereit —
     wer dort "dran" waere, ist es noch nicht, und summte sonst umsonst. */
  if (sicht.aufstellung) return false;
  const daten = sicht.daten as { amZug?: unknown };
  return typeof daten.amZug === 'number' && daten.amZug === sicht.sitz;
}

/** Kurz, zweimal — deutlich genug in der Hosentasche, nicht aufdringlich. */
const MUSTER_DRAN = [120, 80, 120];

export function useTischwache({ aktiv, dranSchluessel }: {
  /** Laeuft das Turnier? Nur dann bleibt der Schirm an. */
  aktiv: boolean;
  /**
   * Eine Zeichenkette, die sich genau dann aendert, wenn man NEU dran ist —
   * null, solange man es nicht ist. Ein Schluessel und kein Objekt: Haengt der
   * Effekt an der Sicht, summte das Handy bei jedem Serverfunk (CLAUDE.md,
   * "React-Effekte an einen Schluessel haengen").
   */
  dranSchluessel: string | null;
}): void {
  useEffect(() => {
    if (!aktiv || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sperre: WakeLockSentinel | null = null;
    let lebt = true;

    const anfordern = (): void => {
      /* Nur sichtbar: Ein verborgenes Dokument bekommt die Sperre ohnehin
         nicht, der Versuch waere ein sicherer Fehler. */
      if (document.visibilityState !== 'visible' || (sperre && !sperre.released)) return;
      navigator.wakeLock
        .request('screen')
        .then((neu) => {
          if (lebt) sperre = neu;
          else void neu.release().catch(() => {});
        })
        .catch(() => {
          /* Energiesparmodus, Richtlinie, alter Browser — dann geht der
             Schirm eben aus wie vorher. */
        });
    };

    /*
     * Der Browser gibt die Sperre von selbst frei, sobald die Seite
     * verborgen ist (anderer Tab, Handy kurz entsperrt). Kommt sie zurueck,
     * wird neu angefordert — sonst hielte die Sperre genau bis zum ersten
     * Blick in den Gruppenchat.
     */
    const beiSicht = (): void => anfordern();
    anfordern();
    document.addEventListener('visibilitychange', beiSicht);
    return () => {
      lebt = false;
      document.removeEventListener('visibilitychange', beiSicht);
      if (sperre) void sperre.release().catch(() => {});
    };
  }, [aktiv]);

  useEffect(() => {
    if (!dranSchluessel || typeof navigator === 'undefined') return;
    try {
      navigator.vibrate?.(MUSTER_DRAN);
    } catch {
      /* Manche Browser werfen statt false zu liefern (ohne Nutzergeste). */
    }
  }, [dranSchluessel]);
}
