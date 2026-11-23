/**
 * Das automatische Ende als Welle abspielen (Wunsch Niklas, 21.11.2026).
 *
 * Ist kein Feld mehr umkaempft, beendet das Modul die Partie in einem
 * Schritt und schickt die verteilten Felder als Liste mit (`autoEnde`). Ohne
 * Abspielen sprang das Brett vom letzten Zug direkt auf den Endstand — ein
 * halbes Brett wechselte auf einmal die Farbe, und niemand sah, warum. Hier
 * wird die Liste Feld fuer Feld nachgezeichnet.
 *
 * Gespielt wird NUR die Liste des Servers: Welche Felder, in welcher
 * Reihenfolge, mit welcher Farbe davor und wie viele Punkte sie bringen,
 * steht alles darin. Gerechnet wird hier nichts, was eine Regel waere —
 * `zurueckgespult` zieht nur ab, was die Liste selbst als Zuwachs nennt.
 */
import { useEffect, useState } from 'react';

import type { AutoEndeFeld, FillerSicht } from './sicht';

/** So lange steht ein Feld, bevor das naechste kommt — bei kurzen Listen. */
export const ABSPIEL_JE_FELD_MS = 40;
/** Laenger dauert die Welle nie; lange Listen laufen schneller. */
export const ABSPIEL_HOECHSTENS_MS = 3000;
/**
 * Nach dem letzten Feld bleibt das Brett noch so lange ohne Ergebnis stehen:
 * Das Aufleuchten des letzten Feldes (styles.css, `fl-geholt`) soll zu Ende
 * laufen, bevor die Ergebnisanzeige den Blick nach unten zieht.
 */
export const ABSPIEL_NACHLAUF_MS = 450;

/**
 * Laesst sich die Liste abspielen?
 *
 * Nein, wenn ein Eintrag `vorher` oder `punkte` nicht kennt — eine Partie,
 * die am 23.11.2026 endete, bevor das Modul beides mitschrieb. Dann lieber
 * gleich der Endstand als eine Welle mit geratenen Farben.
 */
export function abspielbar(liste: readonly AutoEndeFeld[] | undefined): liste is readonly AutoEndeFeld[] {
  return (
    liste !== undefined &&
    liste.length > 0 &&
    liste.every((e) => e.vorher !== undefined && e.punkte !== undefined)
  );
}

/** Abstand zweier Felder: 40 ms, bei langen Listen so knapp, dass alles in 3 s passt. */
export function abstandJeFeld(anzahl: number): number {
  return Math.min(ABSPIEL_JE_FELD_MS, ABSPIEL_HOECHSTENS_MS / Math.max(1, anzahl));
}

/**
 * Die Sicht, wie sie aussah, als erst `gezeigt` Felder der Liste verteilt
 * waren: Die uebrigen tragen wieder ihre alte Farbe, gehoeren niemandem, und
 * ihre Punkte stehen noch nicht auf dem Zaehler. Alles andere — auch
 * `fertig` — bleibt, wie der Server es geschickt hat.
 */
export function zurueckgespult(sicht: FillerSicht, gezeigt: number): FillerSicht {
  const liste = sicht.autoEnde;
  if (!abspielbar(liste) || gezeigt >= liste.length) return sicht;
  const feld = [...sicht.feld];
  const besitzer = [...sicht.besitzer];
  const punkte = { ...sicht.punkte };
  for (const eintrag of liste.slice(Math.max(0, gezeigt))) {
    feld[eintrag.platz] = eintrag.vorher!;
    besitzer[eintrag.platz] = null;
    punkte[eintrag.sitz] = (punkte[eintrag.sitz] ?? 0) - eintrag.punkte!;
  }
  return { ...sicht, feld, besitzer, punkte };
}

function bewegungReduziert(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Wie viele Felder der Liste gerade schon zu sehen sind — oder `null`, wenn
 * nichts (mehr) abzuspielen ist und der Endstand gilt.
 *
 * Der Effekt haengt an einem SCHLUESSEL aus der Liste und nicht an der Sicht
 * (CLAUDE.md): Jeder Serverfunk bringt ein neues Sichtobjekt, und ein daran
 * gehaengter Effekt finge die Welle bei jedem Funk von vorn an.
 *
 * Unter `prefers-reduced-motion` laeuft nichts: sofort der Endstand.
 */
export function useAutoEndeAbspiel(liste: readonly AutoEndeFeld[] | undefined): number | null {
  const spielbar = abspielbar(liste) && !bewegungReduziert();
  const schluessel = spielbar ? liste!.map((e) => `${e.platz}:${e.sitz}`).join(',') : '';
  const anzahl = spielbar ? liste!.length : 0;
  const [lauf, setLauf] = useState<{ schluessel: string; gezeigt: number }>({ schluessel: '', gezeigt: 0 });
  const [fertigFuer, setFertigFuer] = useState('');

  useEffect(() => {
    if (schluessel === '') return;
    const abstand = abstandJeFeld(anzahl);
    const beginn = Date.now();
    const uhr = window.setInterval(() => {
      const vergangen = Date.now() - beginn;
      // Das erste Feld sofort, dann eines je Abstand — aus der Uhr gerechnet
      // und nicht gezaehlt, damit ein gedrosselter Takt (Hintergrund-Tab)
      // die Welle nicht in die Laenge zieht, sondern Felder zusammenfasst.
      const gezeigt = Math.min(anzahl, Math.floor(vergangen / abstand) + 1);
      setLauf({ schluessel, gezeigt });
      if (vergangen >= abstand * anzahl + ABSPIEL_NACHLAUF_MS) {
        window.clearInterval(uhr);
        setFertigFuer(schluessel);
      }
    }, 16);
    return () => window.clearInterval(uhr);
  }, [schluessel, anzahl]);

  if (schluessel === '' || fertigFuer === schluessel) return null;
  // Vor dem ersten Takt (und beim Wechsel auf eine andere Liste) steht das
  // Brett von davor — sonst blitzte fuer einen Takt der Endstand auf.
  return lauf.schluessel === schluessel ? lauf.gezeigt : 0;
}
