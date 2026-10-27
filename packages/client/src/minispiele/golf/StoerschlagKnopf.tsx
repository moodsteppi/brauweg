import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../i18n';
import type { Karte } from './karte';
import type { Golfnetz } from './netz';
import type { Partiezustand } from './physik';
import { BOMBE_R, KLEBE_R, istStoerart, sperrgrund, zielstelle } from './stoerschlag';
import type { Zielbild } from './zeichnen';

/**
 * Der Knopf für die Störschläge im HUD (Fun-Modus, Teil 3/3, seit dem
 * 23.09.2026) — eine eigene Datei, damit `screens/Golf.tsx` nur
 * Einhängezeilen bekommt.
 *
 * Bombe und Klebefeld: Ein Tipp schaltet aufs Zielen um, das nächste Ziehen
 * zielt wie ein Schlag, und beim Loslassen geht statt des Schlags der
 * Auslöse-Zug raus (`Golfnetz.loeseAus`). Ein zweiter Tipp bricht ab. Tausch
 * braucht kein Ziel und geht mit dem Tipp sofort raus.
 *
 * Ob ausgelöst werden DARF, sagt der Kern (`sperrgrund` in stoerschlag.ts),
 * nicht dieser Knopf — er zeigt es nur an, und gesperrt ist er aus.
 */

/**
 * Der Stand für den HUD-Schlüssel, als eine Zeichenkette: `''` ohne
 * Störschlag, sonst `art:frei` oder `art:<Sperrgrund>`.
 */
export function stoerZustand(z: Partiezustand, sitz: number): string {
  const b = z.baelle[sitz];
  if (b === undefined || !istStoerart(b.halt)) return '';
  const grund = sperrgrund(z, sitz);
  return `${b.halt}:${grund ?? 'frei'}`;
}

export interface StoerZielen {
  /** Für die Zeigerhändler in Golf.tsx — dort liegt alles Zielen in Refs. */
  readonly aktivRef: { current: boolean };
  readonly aktiv: boolean;
  setze(an: boolean): void;
}

/** Ob das nächste Ziehen einen Störschlag zielt statt einen Schlag. */
export function useStoerZielen(): StoerZielen {
  const aktivRef = useRef(false);
  const [aktiv, setAktiv] = useState(false);
  const setze = useCallback((an: boolean) => {
    aktivRef.current = an;
    setAktiv(an);
  }, []);
  return { aktivRef, aktiv, setze };
}

/**
 * Das Zielbild beim Auslösen: der Pfeil wie beim Schlag, keine Rollvorschau
 * (es rollt ja nichts), dafür der Umkreis an der Zielstelle — mit derselben
 * Rechnung wie der Kern (`zielstelle`).
 */
export function stoerZielbild(
  z: Partiezustand,
  sitz: number,
  karte: Karte | undefined,
  ballX: number,
  ballY: number,
  wunsch: { rx: number; ry: number; kraft: number },
): Zielbild {
  const b = z.baelle[sitz];
  const art = b?.halt;
  const basis = { x: ballX, y: ballY, rx: wunsch.rx, ry: wunsch.ry, kraft: wunsch.kraft, bahn: [] };
  if (karte === undefined || (art !== 'bombe' && art !== 'klebefeld')) return basis;
  const ort = zielstelle({ x: ballX, y: ballY }, karte, wunsch.rx, wunsch.ry, wunsch.kraft);
  return { ...basis, stoer: { x: ort.x, y: ort.y, r: art === 'bombe' ? BOMBE_R : KLEBE_R, art } };
}

/**
 * Beim Loslassen: War der Knopf aufs Zielen gestellt, geht der Auslöse-Zug
 * raus, und das Zielen ist vorbei. `true` heißt: erledigt, kein Schlag.
 */
export function loeseBeimLoslassen(
  zielen: StoerZielen,
  netz: Golfnetz,
  sitz: number,
  wunsch: { rx: number; ry: number; kraft: number },
): boolean {
  if (!zielen.aktivRef.current) return false;
  zielen.setze(false);
  netz.loeseAus(sitz, wunsch.rx, wunsch.ry, wunsch.kraft);
  return true;
}

const ZEICHEN: Readonly<Record<string, string>> = { bombe: '💣', klebefeld: '🟫', tausch: '🔁' };

export function StoerschlagKnopf({
  zustand,
  zielen,
  netz,
  sitz,
}: {
  /** `stoerZustand` aus dem HUD-Stand. */
  zustand: string;
  zielen: StoerZielen;
  netz: Golfnetz;
  sitz: number;
}): React.JSX.Element | null {
  const [art, grund] = zustand.split(':');
  const frei = grund === 'frei';
  const { setze } = zielen;
  // Nicht mehr auslösbar (ausgelöst, Loch vorbei, Ball rollt): Zielen aus.
  useEffect(() => {
    if (!frei) setze(false);
  }, [frei, setze]);
  if (zustand === '' || sitz < 0) return null;

  const drueck = (): void => {
    if (!frei) return;
    if (art === 'tausch') {
      // Richtung und Kraft sind beim Tausch ohne Bedeutung; der Zug braucht sie.
      netz.loeseAus(sitz, 0, -1, 1);
      return;
    }
    setze(!zielen.aktivRef.current);
  };

  const hinweis = frei
    ? t(zielen.aktiv ? 'golf.fun.stoer.zielen' : `golf.fun.stoer.${art}Knopf`)
    : t(`golf.fun.stoer.gesperrt.${grund}`);
  return (
    <div className="gf-stoer" data-golf-stoer={art}>
      <button
        type="button"
        className="gf-stoer-knopf"
        data-aktiv={zielen.aktiv ? '' : undefined}
        disabled={!frei}
        onClick={drueck}
        aria-pressed={art === 'tausch' ? undefined : zielen.aktiv}
      >
        <span aria-hidden="true">{ZEICHEN[art] ?? '⚠'}</span>
        <strong>{t(`golf.fun.pu.${art}`)}</strong>
      </button>
      <em>{hinweis}</em>
    </div>
  );
}
