/**
 * Partiezustand von Feldherr.
 *
 * Der Zustand ist bewusst duenn: Saatkorn, Aktionsliste, Meldungen, Ausgang.
 * Das Spiel selbst rechnen die Geraete aus — der Server verwahrt nur, was
 * beide brauchen, um zum selben Ergebnis zu kommen. Wer hier den Spielstand
 * mitfuehren will, braucht Weg C aus docs/FELDHERR-PLAN.md und damit eine
 * Taktschleife im Server.
 */

import type { Ausgang, FeldherrAktion, FeldherrRegeln, Zug } from './regeln.js';
import { VORLAUF_TAKTE } from './regeln.js';

export interface Meldung {
  readonly sieger: number;
  readonly takt: number;
  readonly pruef: string;
}

export interface FeldherrPartie {
  readonly regeln: FeldherrRegeln;
  /**
   * Saatkorn beider Geraete. Kommt von der Plattform und ist fuer beide
   * gleich — daraus entstehen Gelaende, KI-Entscheidungen und Muenzwurf.
   */
  readonly saat: number;
  readonly zuege: readonly (Zug & { readonly sitz: number })[];
  readonly meldungen: Readonly<Record<number, Meldung>>;
  readonly ausgang: Ausgang | null;
  readonly ausgestiegen: readonly number[];
}

export function erzeugePartie(regeln: FeldherrRegeln, saat: number): FeldherrPartie {
  return {
    regeln,
    saat: saat >>> 0 || 1,
    zuege: [],
    meldungen: {},
    ausgang: null,
    ausgestiegen: [],
  };
}

/** Letzter Takt, den dieser Sitz belegt hat. Aktionen muessen aufsteigen. */
function letzterTakt(partie: FeldherrPartie, sitz: number): number {
  let max = -1;
  for (const z of partie.zuege) if (z.sitz === sitz && z.takt > max) max = z.takt;
  return max;
}

export class RegelverstossError extends Error {}

/**
 * Nimmt eine Aktion an.
 *
 * Geprueft wird Form und Reihenfolge, NICHT die Spielregel. Der Server weiss
 * nicht, ob der Spieler sich die Karte leisten kann — das entscheidet der
 * Spielkern auf beiden Geraeten gleich. Was er verhindern kann und muss:
 * Aktionen in der Vergangenheit (damit niemand nachtraeglich in einen bereits
 * gerechneten Takt hineinschreibt) und Aktionen nach dem Ende.
 */
export function verarbeite(
  partie: FeldherrPartie,
  sitz: number,
  aktion: FeldherrAktion,
): FeldherrPartie {
  if (partie.ausgang) throw new RegelverstossError('partieBeendet');
  if (sitz !== 0 && sitz !== 1) throw new RegelverstossError('sitzUnbekannt');

  if (aktion.art === 'aufgabe') {
    return {
      ...partie,
      ausgang: {
        sieger: 1 - sitz,
        takte: letzterTakt(partie, sitz) + 1,
        strittig: false,
        aufgegeben: true,
      },
    };
  }

  if (aktion.art === 'zug') {
    const zug = aktion.zug;
    if (!Number.isInteger(zug.takt) || zug.takt < 0) {
      throw new RegelverstossError('taktUngueltig');
    }
    if (zug.takt <= letzterTakt(partie, sitz)) {
      throw new RegelverstossError('taktNichtAufsteigend');
    }
    return { ...partie, zuege: [...partie.zuege, { ...zug, sitz }] };
  }

  // Ergebnis
  const meldungen = { ...partie.meldungen, [sitz]: {
    sieger: aktion.sieger,
    takt: aktion.takt,
    pruef: aktion.pruef,
  } };
  const beide = meldungen[0] && meldungen[1];
  if (!beide) return { ...partie, meldungen };

  const a = meldungen[0]!;
  const b = meldungen[1]!;
  const einig = a.sieger === b.sieger && a.pruef === b.pruef;
  return {
    ...partie,
    meldungen,
    ausgang: {
      sieger: einig ? a.sieger : null,
      takte: Math.max(a.takt, b.takt),
      strittig: !einig,
      aufgegeben: false,
    },
  };
}

/**
 * Aussteigen beendet die Partie sofort zugunsten des anderen.
 *
 * Bei den Kartenspielen uebernimmt hier ein Bot. Das geht bei Feldherr nicht:
 * Die Gegner-KI lebt im Spielkern auf den Geraeten, und ein Bot im Server
 * muesste die ganze Echtzeitpartie mitrechnen. Wer geht, verliert.
 */
export function ausstieg(partie: FeldherrPartie, sitz: number): FeldherrPartie {
  if (partie.ausgang) return partie;
  return {
    ...partie,
    ausgestiegen: [...partie.ausgestiegen, sitz],
    ausgang: {
      sieger: 1 - sitz,
      takte: letzterTakt(partie, sitz) + 1,
      strittig: false,
      aufgegeben: true,
    },
  };
}

/**
 * Frueheseter Takt, fuer den dieser Sitz noch etwas einplanen darf.
 *
 * Der Client fragt das nicht ab — er rechnet mit demselben Vorlauf. Die
 * Funktion steht hier, damit die Regel an einer Stelle steht und der Test sie
 * pruefen kann.
 */
export function naechsterTakt(partie: FeldherrPartie, sitz: number): number {
  return letzterTakt(partie, sitz) + VORLAUF_TAKTE;
}
