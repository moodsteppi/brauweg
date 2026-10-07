import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SeatInfo } from '../../protocol';
import { ANSAGE_MS, AnsageLetzter, useNeuerWurf } from './LetzterWurf';
import { FehlenNoch } from './Runden';
import { Abrechnung } from './Wertung';
import { MINISPIEL_NAME, type PartyLetzterWurf, type PartyMinispiel, type PartykisteSicht } from './sicht';

/*
 * Das Warten auf das „Weiter" aller am Bildschirm (07.10.2026). Wer fehlt und
 * ob der Letzte trinkt, entscheidet das Modul (weiter-warten.test.ts dort);
 * hier steht nur, dass der Bildschirm es mit Namen zeigt — und einen Wurf
 * genau einmal ansagt.
 */

const SITZE: SeatInfo[] = ['Robin', 'Anna', 'Ben', 'Emil'].map((name, seat) => ({
  seat,
  displayName: name,
  accountId: `konto-${seat}`,
  isBot: false,
  avatarUrl: null,
}));

function sicht(teil: Partial<PartykisteSicht>): PartykisteSicht {
  return {
    sitz: 0,
    sitze: 4,
    rundeNr: 0,
    runden: 6,
    art: 'quiz',
    phase: 'ergebnis',
    trinkmodus: true,
    schluckFaktor: 1,
    minispiele: Object.keys(MINISPIEL_NAME) as PartyMinispiel[],
    botSitze: [],
    ausgestiegen: [],
    punkte: [0, 0, 0, 0],
    schlucke: [0, 0, 0, 0],
    rundenPunkte: [0, 0, 0, 0],
    rundenSchlucke: [0, 0, 0, 0],
    amZug: 1,
    gehandelt: [0],
    fertig: false,
    tabelle: [0, 1, 2, 3].map((sitz) => ({ sitz, punkte: 0, schlucke: 0, platz: 1 })),
    daten: { art: 'quiz', frage: 'F', antworten: ['a', 'b'], meineWahl: 0, richtig: 0, wahl: [0, 0, 0, 0] },
    regelKarte: null,
    modus: 'turnier',
    paket: null,
    eskalation: null,
    inhaltsHaerte: 1,
    inhaltsMischung: 'genau',
    inhaltsHaerteGewollt: null,
    gezeigt: [],
    weiterFehlen: [1, 2],
    letzterWurf: null,
    lager: null,
    lagerTabelle: null,
    aufstellung: null,
    ...teil,
  };
}

const WURF: PartyLetzterWurf = { nr: 1, rundeNr: 0, sitz: 2, trinkt: true, schlucke: 1 };

afterEach(() => vi.useRealTimers());

describe('wer beim „Weiter" noch fehlt', () => {
  it('nennt die Fehlenden mit Namen, auch wer schon getippt hat', () => {
    render(<Abrechnung sicht={sicht({})} sitze={SITZE} binFertig sende={() => {}} />);
    expect(screen.getByText(/Es fehlen noch/).textContent).toBe('Es fehlen noch: Anna, Ben');
  });

  it('steht auch bei dem, der noch nicht getippt hat — und nennt ihn „du"', () => {
    render(<Abrechnung sicht={sicht({ gehandelt: [], weiterFehlen: [0, 2] })} sitze={SITZE} binFertig={false} sende={() => {}} />);
    expect(screen.getByText(/Es fehlen noch/).textContent).toBe('Es fehlen noch: du, Ben');
  });

  it('zeigt nichts, wenn der Tisch gerade nicht auf ein „Weiter" wartet', () => {
    const { container } = render(<FehlenNoch sicht={sicht({ weiterFehlen: null })} sitze={SITZE} />);
    expect(container.textContent).toBe('');
  });
});

describe('die Ansage für den Letzten', () => {
  it('sagt den Schluck an — und das Glück', () => {
    const { rerender, container } = render(<AnsageLetzter wurf={WURF} sitze={SITZE} ich={0} trinkmodus />);
    expect(container.textContent).toContain('Ben war Letzter – ein Schluck!');
    rerender(<AnsageLetzter wurf={{ ...WURF, trinkt: false, schlucke: 0 }} sitze={SITZE} ich={0} trinkmodus />);
    expect(container.textContent).toContain('Ben war Letzter – Glück gehabt!');
    rerender(<AnsageLetzter wurf={WURF} sitze={SITZE} ich={2} trinkmodus={false} />);
    expect(container.textContent).toContain('Du warst Letzter – ein Strafpunkt!');
  });

  it('sagt nur NEUE Würfe an, einmal und kurz', () => {
    vi.useFakeTimers();
    /* Beim Öffnen steht schon ein Wurf in der Sicht — der ist alt. */
    const { result, rerender } = renderHook(({ wurf }) => useNeuerWurf('t1', true, wurf), {
      initialProps: { wurf: WURF as PartyLetzterWurf | null },
    });
    expect(result.current.angesagt).toBeNull();

    const neu = { ...WURF, nr: 2 };
    rerender({ wurf: neu });
    expect(result.current.angesagt).toEqual(neu);
    /* Ein neuer Serverfunk mit demselben Wurf als neuem Objekt räumt nichts ab. */
    rerender({ wurf: { ...neu } });
    expect(result.current.angesagt?.nr).toBe(2);

    act(() => vi.advanceTimersByTime(ANSAGE_MS));
    expect(result.current.angesagt).toBeNull();
    rerender({ wurf: { ...neu } });
    expect(result.current.angesagt).toBeNull();
  });
});
