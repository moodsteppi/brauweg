import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SeatInfo } from '../../protocol';
import { AufstellungSeite, LagerTabelle } from './Lager';
import { modusChip } from './modi';
import { Regelzeile } from './Regelzeile';
import {
  MINISPIEL_NAME,
  PARTY_MODI,
  PARTY_PAKETE,
  liesRegelsatz,
  type PartyMinispiel,
  type PartykisteSicht,
} from './sicht';
import { MODI, PAKET_NAME } from './wahl';
import { Tabelle } from './Wertung';

/*
 * Die Spielmodi am Bildschirm (22.09.2026): Die Regelzeile nennt den Modus,
 * die Aufstellung schickt nur, was die Sicht erlaubt, und die Lager-Tabelle
 * steht nur da, wo es Lager gibt. Die Regeln selbst prueft das Modul
 * (packages/game-partykiste/test/modi.test.ts).
 */

const SITZE: SeatInfo[] = ['Robin', 'Jan', 'Tom', 'Emil'].map((name, seat) => ({
  seat,
  displayName: name,
  accountId: `konto-${seat}`,
  isBot: false,
  avatarUrl: null,
}));

function sicht(teil: Partial<PartykisteSicht> = {}): PartykisteSicht {
  return {
    sitz: 0,
    sitze: 4,
    rundeNr: 0,
    runden: 6,
    art: 'quiz',
    phase: 'spiel',
    trinkmodus: true,
    schluckFaktor: 1,
    minispiele: Object.keys(MINISPIEL_NAME) as PartyMinispiel[],
    botSitze: [],
    ausgestiegen: [],
    punkte: [3, 5, 1, 2],
    schlucke: [1, 0, 2, 4],
    rundenPunkte: null,
    rundenSchlucke: null,
    amZug: 0,
    gehandelt: [],
    fertig: false,
    tabelle: [
      { sitz: 0, punkte: 3, schlucke: 1, platz: 3 },
      { sitz: 1, punkte: 5, schlucke: 0, platz: 1 },
      { sitz: 2, punkte: 1, schlucke: 2, platz: 3 },
      { sitz: 3, punkte: 2, schlucke: 4, platz: 1 },
    ],
    daten: { art: 'quiz', frage: 'Frage', antworten: ['a', 'b', 'c', 'd'], meineWahl: -1, richtig: null, wahl: null },
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

describe('Die Regelzeile nennt den Modus', () => {
  it('das Turnier bekommt keinen Chip, jeder andere Modus einen', () => {
    expect(modusChip(sicht())).toBeNull();
    expect(modusChip({ ...sicht(), modus: 'team' })).toBe('Team-Abend');
    expect(modusChip({ ...sicht(), modus: 'themenabend', paket: 'jga' })).toBe('Themenabend: JGA');
    expect(modusChip({ minispiele: [], trinkmodus: true, schluckFaktor: 1, modus: 'eskalation' })).toBe('Eskalation');
    /* Die Kacheln im Menue (wahl.ts) und das Spiegelbild der Sicht kennen dieselben Modi und Pakete. */
    expect(MODI.map((m) => m.kennung)).toEqual([...PARTY_MODI]);
    expect(Object.keys(PAKET_NAME)).toEqual([...PARTY_PAKETE]);
  });

  it('in der Eskalation zeigt sie Stufe und Haerte der Runde — und sagt, wenn ein Gast kappt', () => {
    render(
      <Regelzeile
        regeln={sicht({
          modus: 'eskalation',
          eskalation: { stufe: 3, inhaltsHaerte: 2, schluckFaktor: 3, gekappt: true },
        })}
      />,
    );
    expect(screen.getByText('Eskalation · Stufe 3 von 3')).toBeTruthy();
    expect(screen.getByText('Härte kurzer Abend')).toBeTruthy();
    expect(screen.getByText(/derb.*erst ohne Gast/)).toBeTruthy();
  });

  it('im Wartesaal steht nur, dass die Haerte steigt', () => {
    render(<Regelzeile regeln={{ minispiele: ['quiz'], trinkmodus: true, schluckFaktor: 1, modus: 'eskalation' }} runden={9} />);
    expect(screen.getByText('Härte steigt')).toBeTruthy();
    expect(screen.queryByText(/erst ohne Gast/)).toBeNull();
  });

  it('liest Modus und Paket vom Server und laesst Unbekanntes weg', () => {
    expect(
      liesRegelsatz({ minispiele: ['quiz'], trinkmodus: true, schluckFaktor: 1, modus: 'themenabend', paket: 'arbeit' }),
    ).toEqual({ minispiele: ['quiz'], trinkmodus: true, schluckFaktor: 1, modus: 'themenabend', paket: 'arbeit' });
    const unbekannt = liesRegelsatz({ minispiele: ['quiz'], trinkmodus: true, schluckFaktor: 1, modus: 'marathon', paket: 'xy' });
    expect(unbekannt?.modus).toBeUndefined();
    expect(unbekannt?.paket).toBeUndefined();
  });
});

describe('Aufstellung des Team-Abends', () => {
  const aufstellung = sicht({
    modus: 'team',
    lager: [0, 1, 0, 1],
    aufstellung: { aufsteller: 0, wechselbar: [0, 1, 2] },
  });

  it('der Oeffner setzt per Tipp ins andere Lager und gibt frei — nur, was die Sicht erlaubt', () => {
    const sende = vi.fn();
    render(<AufstellungSeite sicht={aufstellung} sitze={SITZE} sende={sende} />);
    const lagerA = screen.getByRole('region', { name: 'Lager A' });
    expect(within(lagerA).getAllByRole('button').map((b) => b.textContent)).toEqual(['Robin', 'Tom']);

    fireEvent.click(screen.getByRole('button', { name: 'Jan' }));
    expect(sende).toHaveBeenLastCalledWith({ art: 'lagerwechsel', sitz: 1 });

    /* Emil ist der letzte in Lager B, der dort mitspielt: Die Sicht nennt ihn nicht. */
    expect((screen.getByRole('button', { name: 'Emil' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Los geht/ }));
    expect(sende).toHaveBeenLastCalledWith({ art: 'bereit' });
  });

  it('alle anderen sehen die Lager ohne Knoepfe', () => {
    render(
      <AufstellungSeite
        sicht={{ ...aufstellung, sitz: 2, aufstellung: { aufsteller: 0, wechselbar: [] } }}
        sitze={SITZE}
        sende={() => {}}
      />,
    );
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.getByText('Robin stellt die Lager auf …')).toBeTruthy();
  });
});

describe('Die Tabelle je Lager', () => {
  it('steht im Team-Abend ueber der Tabelle je Person — mit Mitgliedern und Summen', () => {
    render(
      <Tabelle
        sicht={sicht({
          modus: 'team',
          lager: [0, 1, 0, 1],
          lagerTabelle: [
            { lager: 0, sitze: [0, 2], punkte: 4, schlucke: 3, platz: 2 },
            { lager: 1, sitze: [1, 3], punkte: 7, schlucke: 4, platz: 1 },
          ],
        })}
        sitze={SITZE}
      />,
    );
    const lager = screen.getByRole('list', { name: 'Stand der Lager' });
    const zeilen = within(lager).getAllByRole('listitem');
    expect(zeilen.map((z) => z.getAttribute('data-lager'))).toEqual(['1', '0']);
    expect(zeilen[0]!.textContent).toContain('Jan, Emil');
    expect(zeilen[0]!.textContent).toContain('7');
  });

  it('ohne Lager zeichnet sie nichts', () => {
    const { container } = render(<LagerTabelle sicht={sicht()} sitze={SITZE} />);
    expect(container.innerHTML).toBe('');
  });
});
