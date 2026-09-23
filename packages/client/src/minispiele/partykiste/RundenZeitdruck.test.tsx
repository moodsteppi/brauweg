import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SeatInfo } from '../../protocol';
import { Runde } from './Runden';
import { MINISPIEL_NAME, type PartyMinispiel, type PartyMinispielSicht, type PartykisteSicht } from './sicht';

/*
 * Die drei mit Uhr am Bildschirm (23.09.2026). Die Uhr selbst prueft der
 * Server (packages/server/test/partykiste-uhr.test.ts); hier steht, was der
 * Bildschirm daraus macht: Die Bombe zeigt NIE eine Restzeit — auch dann
 * nicht, wenn ihm jemand eine Frist hineinreicht —, die zehn Sekunden zeigen
 * die Frist des Servers, und „Hand hoch" darf jeder tippen, nicht nur der
 * Sitz am Zug.
 */

const SITZE: SeatInfo[] = ['Robin', 'Jan', 'Tom', 'Emil'].map((name, seat) => ({
  seat,
  displayName: name,
  accountId: `konto-${seat}`,
  isBot: false,
  avatarUrl: null,
}));

function sicht(art: PartyMinispiel, daten: PartyMinispielSicht, teil: Partial<PartykisteSicht> = {}): PartykisteSicht {
  return {
    sitz: 0,
    sitze: 4,
    rundeNr: 0,
    runden: 6,
    art,
    phase: 'spiel',
    trinkmodus: true,
    schluckFaktor: 1,
    minispiele: Object.keys(MINISPIEL_NAME) as PartyMinispiel[],
    botSitze: [],
    ausgestiegen: [],
    punkte: [0, 0, 0, 0],
    schlucke: [0, 0, 0, 0],
    rundenPunkte: null,
    rundenSchlucke: null,
    amZug: 0,
    gehandelt: [],
    fertig: false,
    tabelle: [0, 1, 2, 3].map((sitz) => ({ sitz, punkte: 0, schlucke: 0, platz: 1 })),
    daten,
    regelKarte: null,
    modus: 'turnier',
    paket: null,
    eskalation: null,
    lager: null,
    lagerTabelle: null,
    aufstellung: null,
    ...teil,
  };
}

describe('Bombe', () => {
  it('wer sie hat, gibt weiter — und eine Restzeit steht nirgends, auch mit Frist nicht', () => {
    const sende = vi.fn();
    const { container } = render(
      <Runde
        sicht={sicht('bombe', { art: 'bombe', kategorie: 'Automarken', amZug: 0, weitergaben: 3, verlierer: -1 })}
        sitze={SITZE}
        sende={sende}
        frist={Date.now() + 9_000}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    expect(sende).toHaveBeenCalledWith({ art: 'weitergeben' });
    expect(container.querySelector('.pk-zd-restzeit')).toBeNull();
    expect(container.textContent).not.toMatch(/\b\d+\s*s\b|Sekunde/);
  });

  it('wer sie nicht hat, bekommt keinen Knopf', () => {
    render(
      <Runde
        sicht={sicht('bombe', { art: 'bombe', kategorie: 'Automarken', amZug: 2, weitergaben: 3, verlierer: -1 })}
        sitze={SITZE}
        sende={() => {}}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Tom hat die Bombe/)).toBeTruthy();
  });
});

describe('10 Sekunden', () => {
  const sprechen = {
    art: 'zehnsekunden',
    sprecher: 1,
    schritt: 'sprechen',
    aufgabe: 'Automarken',
    anzahl: 3,
    richter: [0, 2, 3],
    meinUrteil: -1,
    abgegeben: [],
    urteile: null,
    geschafft: null,
  } as const;

  it('zeigt die Frist des Servers — und ohne Frist keine Zahl', () => {
    const { container, rerender } = render(
      <Runde sicht={sicht('zehnsekunden', { ...sprechen, richter: [...sprechen.richter], abgegeben: [] })} sitze={SITZE} sende={() => {}} frist={Date.now() + 7_400} />,
    );
    expect(container.querySelector('.pk-zd-restzeit')?.textContent).toBe('8');
    rerender(<Runde sicht={sicht('zehnsekunden', { ...sprechen, richter: [...sprechen.richter], abgegeben: [] })} sitze={SITZE} sende={() => {}} frist={null} />);
    expect(container.querySelector('.pk-zd-restzeit')).toBeNull();
  });

  it('im Urteil bekommen nur die Richter Knoepfe', () => {
    const sende = vi.fn();
    const urteil = { ...sprechen, schritt: 'urteil' as const, richter: [0, 2, 3], abgegeben: [] };
    render(<Runde sicht={sicht('zehnsekunden', urteil)} sitze={SITZE} sende={sende} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nicht geschafft' }));
    expect(sende).toHaveBeenCalledWith({ art: 'urteil', geschafft: false });
  });
});

describe('Koenigsbecher', () => {
  it('„Hand hoch" darf jeder tippen, auch wer nicht am Zug ist', () => {
    const sende = vi.fn();
    render(
      <Runde
        sicht={sicht(
          'koenigsbecher',
          {
            art: 'koenigsbecher',
            amZug: 2,
            kartenJeSitz: 2,
            gezogen: [1, 1, 1, 0],
            restKarten: 49,
            letzte: {
              sitz: 2,
              karte: { rang: 7, farbe: 0 },
              kartenId: 'kb07',
              folge: 'hand',
              ziele: [],
              titel: 'Hand hoch',
              text: 'Alle zeigen nach oben.',
            },
            wahlOffen: false,
            hand: [3],
            kassiert: [0, 0, 0, 0],
            becher: 0,
            koenigSitz: -1,
            neueRegel: null,
          },
          { amZug: 1 },
        )}
        sitze={SITZE}
        sende={sende}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Hand hoch/ }));
    expect(sende).toHaveBeenCalledWith({ art: 'hochzeigen' });
  });
});
