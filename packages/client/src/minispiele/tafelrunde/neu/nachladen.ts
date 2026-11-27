/**
 * Bilder nach Bedarf holen — fuer TafelrundeNeu.
 *
 * WARUM NICHT `useVorladen` (vorladen.ts): Der Lauf dort ist EINE feste Liste
 * fuer das alte Tafelrunde, samt dessen Bildschirmpaket (paket.ts). Die neue
 * Oberflaeche laedt nach dem Umsetzungsplan (Abschnitt 4) nur, was gerade
 * gebraucht wird: die Figuren in Laden, Bank, Brett und Kampf und den
 * Schauplatz der laufenden Runde. Welche Dateien das sind, weiss erst der
 * Bildschirm — und es wechselt mit jeder Runde.
 *
 * DER MERKER IST MODULWEIT: Ein Bild, das einmal da ist, bleibt da, auch wenn
 * der Bildschirm neu aufgebaut wird. Sonst kaeme das Ladebild bei jedem
 * Wiederverbinden zurueck, obwohl der Browser alles im Speicher hat.
 *
 * GEHOLT WIRD MIT `bildHolen` aus vorladen.ts — derselbe Weg, mit derselben
 * Ruhefrist-Philosophie: Eine Datei, die ausbleibt, haelt niemanden auf
 * (`FRIST_MS`), die Figur zeigt dann ihren Ersatz.
 */

import { useEffect, useMemo, useState } from 'react';

import { FRIST_MS, bildHolen } from '../vorladen';

type Zustand = 'laedt' | 'da' | 'fehlt';

const merker = new Map<string, Zustand>();
const hoerer = new Set<() => void>();

function melde(): void {
  for (const h of hoerer) h();
}

/** Fuer Tests: alles vergessen. */
export function nachladenZuruecksetzen(): void {
  merker.clear();
}

/** Eine Datei anstossen. Wer schon laeuft oder fertig ist, wird nicht noch einmal geholt. */
export function hole(pfad: string, holen: (pfad: string) => Promise<void> = bildHolen): void {
  if (merker.has(pfad)) return;
  merker.set(pfad, 'laedt');
  holen(pfad).then(
    () => {
      merker.set(pfad, 'da');
      melde();
    },
    () => {
      merker.set(pfad, 'fehlt');
      melde();
    },
  );
}

export interface Nachladestand {
  /** Alle angefragten Dateien sind da oder ausgefallen — oder die Ruhefrist ist um. */
  readonly fertig: boolean;
  readonly erledigt: number;
  readonly gesamt: number;
}

/**
 * Die Dateien holen und den Stand mitlesen.
 *
 * Der Effekt haengt an der Liste als ZEICHENKETTE und nicht am Feld: Ein neues
 * Feld bei jedem Rundruf liefe sonst jedes Mal neu an (CLAUDE.md, „React-
 * Effekte an einen Schluessel haengen").
 */
export function useNachladen(
  pfade: readonly string[],
  optionen: { holen?: (pfad: string) => Promise<void>; fristMs?: number } = {},
): Nachladestand {
  const schluessel = [...new Set(pfade)].sort().join('|');
  const [, setTakt] = useState(0);
  const [fristUm, setFristUm] = useState(false);

  useEffect(() => {
    const liste = schluessel ? schluessel.split('|') : [];
    const neuZeichnen = (): void => setTakt((n) => n + 1);
    hoerer.add(neuZeichnen);
    for (const pfad of liste) hole(pfad, optionen.holen);
    setFristUm(false);
    // Eine RUHEFRIST wie in vorladen.ts: Jede eintreffende Datei stellt die
    // Uhr zurueck, aufgegeben wird nur bei Stillstand.
    let uhr = window.setTimeout(() => setFristUm(true), optionen.fristMs ?? FRIST_MS);
    const ruhe = (): void => {
      window.clearTimeout(uhr);
      uhr = window.setTimeout(() => setFristUm(true), optionen.fristMs ?? FRIST_MS);
    };
    hoerer.add(ruhe);
    return () => {
      hoerer.delete(neuZeichnen);
      hoerer.delete(ruhe);
      window.clearTimeout(uhr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  const liste = useMemo(() => (schluessel ? schluessel.split('|') : []), [schluessel]);
  const erledigt = liste.filter((p) => {
    const z = merker.get(p);
    return z === 'da' || z === 'fehlt';
  }).length;
  return { fertig: fristUm || erledigt === liste.length, erledigt, gesamt: liste.length };
}
