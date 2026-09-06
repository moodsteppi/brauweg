import { describe, expect, it } from 'vitest';

import type { Action, RoundView } from './protocol';
import { aktionenAufteilen, armutKartenwahl } from './tisch-armut';

/*
 * Die Armut ist neben dem Skat-Drücken die zweite Stelle, an der der Client
 * eine Regel nachbaut. Was er hier falsch macht, fängt niemand ab — der
 * Server weist die falsche Aktion zwar zurück, aber der Tisch steht dann.
 */

const a = (type: string, rest: Record<string, unknown> = {}): Action => ({
  type,
  seat: 0,
  ...rest,
});

const armut = (
  awaiting: 'decide' | 'handover' | 'return' | null,
  role: string | null = null,
): RoundView['armut'] => ({ role, awaiting, handoverSize: 3 });

describe('aktionenAufteilen', () => {
  it('sammelt spielbare Karten als Menge von IDs', () => {
    const auf = aktionenAufteilen([
      a('playCard', { cardId: 7 }),
      a('playCard', { cardId: 12 }),
    ]);
    expect(auf.spielbar.has(7)).toBe(true);
    expect(auf.spielbar.has(12)).toBe(true);
    expect(auf.spielbar.size).toBe(2);
  });

  it('hält Vorbehalt und Weiter aus der Knopfreihe heraus', () => {
    // Beide haben eigene Blätter. Landen sie unten in der Reihe, entscheidet
    // ein Fehltipp eine ganze Runde bzw. überspringt den Zwischenstand.
    const auf = aktionenAufteilen([
      a('vorbehalt', { kind: null }),
      a('vorbehalt', { kind: 'solo', solo: 'damen' }),
      a('weiter'),
      a('kontra'),
    ]);
    expect(auf.vorbehalt).toHaveLength(2);
    expect(auf.weiter).not.toBeNull();
    expect(auf.knoepfe.map((x) => x.type)).toEqual(['kontra']);
  });

  it('zieht die Armut-Entscheidung aus der Knopfreihe heraus', () => {
    const auf = aktionenAufteilen([a('armutAccept'), a('armutDecline'), a('re')]);
    expect(auf.entscheidung?.annehmen.type).toBe('armutAccept');
    expect(auf.entscheidung?.ablehnen.type).toBe('armutDecline');
    // Sonst stünde „Armut annehmen" doppelt am Bildschirm: einmal als Blatt,
    // einmal als Knopf daneben.
    expect(auf.knoepfe.map((x) => x.type)).toEqual(['re']);
  });

  it('fragt nur, wenn beide Antworten möglich sind', () => {
    // Ein Blatt „Armut annehmen?" ohne Ablehnen-Knopf wäre eine Sackgasse.
    expect(aktionenAufteilen([a('armutAccept')]).entscheidung).toBeNull();
    expect(aktionenAufteilen([a('armutDecline')]).entscheidung).toBeNull();
  });

  it('lässt unbekannte Aktionstypen als Knöpfe stehen', () => {
    // Ein neuer Aktionstyp aus einem Modul-Update soll sichtbar bleiben und
    // nicht stillschweigend verschwinden.
    const auf = aktionenAufteilen([a('vollkommenNeu')]);
    expect(auf.knoepfe.map((x) => x.type)).toEqual(['vollkommenNeu']);
  });

  it('kommt mit einer leeren Aktionsliste zurecht', () => {
    // Der Normalfall an einem Tisch: Man ist nicht dran.
    const auf = aktionenAufteilen([]);
    expect(auf.spielbar.size).toBe(0);
    expect(auf.vorbehalt).toEqual([]);
    expect(auf.weiter).toBeNull();
    expect(auf.entscheidung).toBeNull();
    expect(auf.knoepfe).toEqual([]);
  });
});

describe('armutKartenwahl', () => {
  it('verlangt bei der Rückgabe immer eine Auswahl', () => {
    // Für die Rückgabe liefert das Modul NIE eine Aktion. Wer hier auf die
    // Aktionsliste wartet, lässt den Partner vor einem toten Tisch sitzen.
    expect(armutKartenwahl(armut('return', 'partner'), [])).toBe('rueckgabe');
  });

  it('verlangt bei der Abgabe ohne Trumpf eine Auswahl', () => {
    // Ohne Trumpf sind es drei aus zwölf — 220 Möglichkeiten, die das Modul
    // bewusst nicht aufzählt.
    expect(armutKartenwahl(armut('handover', 'poor'), [])).toBe('abgabe');
  });

  it('verlangt bei der Abgabe MIT Trumpf keine Auswahl', () => {
    // Der wichtigste Fall. Wer Trümpfe hat, gibt zwingend alle ab: Das Modul
    // liefert genau diese eine Aktion. Käme trotzdem die freie Auswahl, wählte
    // der Arme irgendwelche Karten, der Server wiese sie ab — und der Tisch
    // stünde, bis jemand die Runde abbricht.
    const mitAktion = [a('armutHandover', { cards: [3, 9, 14] })];
    expect(armutKartenwahl(armut('handover', 'poor'), mitAktion)).toBeNull();
  });

  it('lässt sich von anderen Aktionen nicht beirren', () => {
    // Nur `armutHandover` zählt — nicht irgendeine Aktion in der Liste.
    const andere = [a('playCard', { cardId: 4 }), a('re')];
    expect(armutKartenwahl(armut('handover', 'poor'), andere)).toBe('abgabe');
  });

  it('zeigt beim Annehmen/Ablehnen keine Kartenauswahl', () => {
    const entscheiden = [a('armutAccept'), a('armutDecline')];
    expect(armutKartenwahl(armut('decide', 'candidate'), entscheiden)).toBeNull();
  });

  it('zeigt ohne Erwartung nichts — auch mit Armut-Rolle', () => {
    // Der Arme wartet, während die anderen entscheiden. `awaiting` steht nur
    // bei dem Sitz, von dem gerade etwas erwartet wird.
    expect(armutKartenwahl(armut(null, 'poor'), [])).toBeNull();
  });

  it('zeigt Zuschauern nichts', () => {
    // Das Modul leert die Armut-Felder für Zuschauer (stripHand). Käme hier
    // eine Auswahl, schickte der Bildschirm `seat: null` an den Server.
    expect(armutKartenwahl(armut(null), [])).toBeNull();
    expect(armutKartenwahl(undefined, [])).toBeNull();
    expect(armutKartenwahl(null, [])).toBeNull();
  });
});
