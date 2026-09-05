/*
 * Armut im Doppelkopf: die zweite Stelle, an der der Client eine Regel nachbaut.
 *
 * Beim Drücken und Schieben im Skat ist es die Auswahl (siehe
 * `tisch-auswahl.ts`), hier ist es die Frage, WELCHE Bedienung überhaupt
 * erscheinen darf. Das Spielmodul liefert für die Armut absichtlich nur einen
 * Teil der Aktionen, und die Lücke ist nicht symmetrisch — genau daran
 * scheitert eine Fassung, die den Fall „sieht doch gleich aus" gleich
 * behandelt (`packages/game-doppelkopf/src/adapter.ts`, `legalActions`):
 *
 *   - `decide`   (annehmen/ablehnen): Das Modul liefert BEIDE Aktionen.
 *   - `handover` (der Arme gibt ab): Hat er Trümpfe, muss er ALLE abgeben —
 *     das ist genau eine Aktion, und das Modul liefert sie. Hat er keinen
 *     Trumpf, sind es drei frei gewählte Karten aus zwölf; das wären 220
 *     Aktionen, also liefert das Modul KEINE und der Client muss auswählen
 *     lassen.
 *   - `return`   (der Partner gibt zurück): Immer eine freie Auswahl, das
 *     Modul liefert nie eine Aktion.
 *
 * Daraus folgt die Regel, die sonst nirgends steht: Bei `handover` hängt es
 * an der Aktionsliste, bei `return` nie. Zeigt der Client bei vorhandener
 * `armutHandover`-Aktion trotzdem die Auswahl, wählt der Arme irgendwelche
 * Karten und der Server weist sie ab („Trümpfe müssen abgegeben werden") —
 * der Tisch steht, bis jemand die Runde abbricht.
 *
 * Was hier steht, ist reine Ableitung aus der Sicht. Keine Anzeige, kein
 * Zustand: damit es sich prüfen lässt, ohne den 2000-Zeilen-Bildschirm
 * aufzubauen.
 */

import type { Action, RoundView } from './protocol';

/** Welche Kartenauswahl die Armut gerade verlangt — oder keine. */
export type ArmutKartenwahl = 'rueckgabe' | 'abgabe' | null;

/** Die aufgeteilte Aktionsliste eines Tisches. */
export interface AufgeteilteAktionen {
  /** Spielbare Karten als Menge von Karten-IDs. */
  spielbar: Set<number>;
  /** Vorbehaltsabfrage — eigener Dialog, nie eine Knopfreihe. */
  vorbehalt: Action[];
  /** „Weiter" gehört aufs Zwischenstand-Blatt. */
  weiter: Action | null;
  /** Armut annehmen/ablehnen — eigenes Blatt mit Erklärung. */
  entscheidung: { annehmen: Action; ablehnen: Action } | null;
  /** Der Rest: Ansagen und Ähnliches, unten als Knopfreihe. */
  knoepfe: Action[];
}

/**
 * Die Aktionsliste in die Bereiche des Tisches aufteilen.
 *
 * Der Grund für die Trennung ist keine Kosmetik: Vorbehalt und
 * Armut-Entscheidung sind Entscheidungen, die eine ganze Runde festlegen. In
 * einer Knopfreihe am unteren Rand entscheidet sie ein Fehltipp.
 */
export function aktionenAufteilen(legalActions: readonly Action[]): AufgeteilteAktionen {
  const spielbar = new Set<number>();
  const vorbehalt: Action[] = [];
  let weiter: Action | null = null;
  let annehmen: Action | null = null;
  let ablehnen: Action | null = null;
  const knoepfe: Action[] = [];

  for (const action of legalActions) {
    switch (action.type) {
      case 'playCard':
        spielbar.add(action.cardId as number);
        break;
      case 'vorbehalt':
        vorbehalt.push(action);
        break;
      case 'weiter':
        // Mehrfach kann es nicht kommen; käme es doch, gilt das erste.
        weiter ??= action;
        break;
      case 'armutAccept':
        annehmen ??= action;
        break;
      case 'armutDecline':
        ablehnen ??= action;
        break;
      default:
        knoepfe.push(action);
    }
  }

  return {
    spielbar,
    vorbehalt,
    weiter,
    // Nur zusammen: Ein Blatt „Armut annehmen?" ohne Ablehnen-Knopf wäre eine
    // Sackgasse, und ein einzelnes Ablehnen ergibt keine Frage.
    entscheidung: annehmen && ablehnen ? { annehmen, ablehnen } : null,
    knoepfe,
  };
}

/**
 * Welche Kartenauswahl die Armut gerade verlangt.
 *
 * `awaiting` steht in der Sicht nur bei dem Sitz, von dem gerade etwas
 * erwartet wird — das Modul setzt es hinter `isMyTurn` und leert es für
 * Zuschauer. Der Client muss also nicht noch einmal prüfen, wer dran ist; er
 * muss nur wissen, wann das Modul die Aktion schon mitliefert.
 */
export function armutKartenwahl(
  armut: RoundView['armut'] | null | undefined,
  legalActions: readonly Action[],
): ArmutKartenwahl {
  if (!armut) return null;
  // Rückgabe: Das Modul liefert dafür nie eine Aktion, es gibt also nichts
  // abzuwarten.
  if (armut.awaiting === 'return') return 'rueckgabe';
  if (armut.awaiting !== 'handover') return null;
  // Abgabe: Liegt die Aktion vor, gibt der Arme zwingend alle Trümpfe ab —
  // dann ist es ein Knopf und keine Auswahl.
  if (legalActions.some((action) => action.type === 'armutHandover')) return null;
  return 'abgabe';
}
