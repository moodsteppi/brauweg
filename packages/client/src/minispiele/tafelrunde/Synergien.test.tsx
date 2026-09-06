import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/*
 * Die Synergie-Anzeige.
 *
 * Der eine Satz, um den es geht: Diese Anzeige RECHNET NICHT. Sie zeigt, was
 * das Spielmodul in die Sicht gelegt hat — Anzahl, erreichte Schwelle,
 * naechste Schwelle, Bonus. Genau das laesst sich pruefen, indem man ihr
 * Zahlen gibt, die sich NICHT nachrechnen lassen: Steht dann trotzdem da, was
 * die Sicht sagt, kann die Anzeige es nicht selbst ausgerechnet haben.
 *
 * Dazu die zweite Zusage aus der Aufgabe: Die Hervorhebung im Laden greift
 * genau bei Schwellenerreichen — nicht davor, nicht darueber hinaus.
 */

import {
  type Synergie,
  type Synergiestand,
  type Wertebonus,
  Fremdmarken,
  Markennamen,
  Markenzeichen,
  Synergieleiste,
  bonusSatz,
  markennamen,
  schwellenPruefer,
  standSatz,
  trifftSchwelle,
} from './Synergien';

function bonus(teil: Partial<Wertebonus> = {}): Wertebonus {
  return { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 0, ...teil };
}

/** Die Tabelle, wie sie einmalig mit der ersten Sicht kommt (synergien.ts). */
const TABELLE: Synergie[] = [
  {
    marke: 'krieger',
    name: 'Krieger',
    stufen: [
      { schwelle: 2, bonus: bonus({ ruestung: 10 }) },
      { schwelle: 4, bonus: bonus({ ruestung: 20 }) },
      { schwelle: 6, bonus: bonus({ ruestung: 30 }) },
    ],
  },
  {
    marke: 'naturwesen',
    name: 'Naturwesen',
    stufen: [
      { schwelle: 2, bonus: bonus({ lebenProzent: 15 }) },
      { schwelle: 4, bonus: bonus({ lebenProzent: 30 }) },
      { schwelle: 6, bonus: bonus({ lebenProzent: 50 }) },
    ],
  },
];

function stand(teil: Partial<Synergiestand> = {}): Synergiestand {
  return {
    marke: 'krieger',
    name: 'Krieger',
    anzahl: 3,
    schwelle: 2,
    naechsteSchwelle: 4,
    bonus: bonus({ ruestung: 10 }),
    ...teil,
  };
}

// ---------------------------------------------------------------------------

describe('bonusSatz', () => {
  it('nennt jeden Wert mit seiner Einheit — Prozent bei dreien, Punkte bei der Rüstung', () => {
    expect(bonusSatz(bonus({ lebenProzent: 15 }))).toBe('+15 % Leben');
    expect(bonusSatz(bonus({ ruestung: 10 }))).toBe('+10 Rüstung');
    expect(bonusSatz(bonus({ angriffProzent: 25, tempoProzent: 10 }))).toBe(
      '+25 % Angriff · +10 % Tempo',
    );
  });

  it('lässt weg, was null ist — sonst stünde an jeder Marke dreimal +0 %', () => {
    expect(bonusSatz(bonus())).toBe('');
    expect(bonusSatz(bonus({ lebenProzent: 10, ruestung: 5 }))).toBe(
      '+10 % Leben · +5 Rüstung',
    );
  });

  it('verträgt den fehlenden Bonus unterhalb der ersten Schwelle', () => {
    expect(bonusSatz(null)).toBe('');
  });
});

describe('trifftSchwelle', () => {
  it('greift genau dann, wenn der nächste Träger die Schwelle voll macht', () => {
    // 3 von 4: der Kauf macht die vier voll.
    expect(trifftSchwelle('krieger', [stand({ anzahl: 3, naechsteSchwelle: 4 })], TABELLE)).toBe(
      true,
    );
    // 2 von 4: danach sind es drei, die Schwelle bleibt offen.
    expect(
      trifftSchwelle('krieger', [stand({ anzahl: 2, naechsteSchwelle: 4 })], TABELLE),
    ).toBe(false);
  });

  it('greift auch bei der ersten Schwelle, obwohl die Marke noch gar nicht in der Sicht steht', () => {
    /*
     * Das Modul schickt nur Marken mit mindestens einem Traeger. Bei genau
     * einem steht die Marke also drin (1 + 1 >= 2 → wahr), bei keinem fehlt
     * sie — und dann darf auch nichts leuchten, denn aus null wird eins.
     */
    expect(trifftSchwelle('krieger', [stand({ anzahl: 1, naechsteSchwelle: 2 })], TABELLE)).toBe(
      true,
    );
    expect(trifftSchwelle('krieger', [], TABELLE)).toBe(false);
  });

  it('leuchtet nicht mehr, wenn es über der höchsten Schwelle nichts zu holen gibt', () => {
    expect(
      trifftSchwelle('krieger', [stand({ anzahl: 6, schwelle: 6, naechsteSchwelle: null })], TABELLE),
    ).toBe(false);
  });

  it('nimmt die erste Schwelle aus der Tabelle und nicht aus einer 2 im Client', () => {
    // Dieselbe Marke, aber eine Tabelle mit verschobenen Stufen: Bei einer
    // ersten Schwelle von 3 macht der zweite Träger sie noch nicht voll.
    const verschoben: Synergie[] = [
      { marke: 'drache', name: 'Drache', stufen: [{ schwelle: 3, bonus: bonus({ ruestung: 5 }) }] },
    ];
    expect(trifftSchwelle('drache', [], verschoben)).toBe(false);
    expect(
      trifftSchwelle('drache', [stand({ marke: 'drache', anzahl: 2, naechsteSchwelle: 3 })], verschoben),
    ).toBe(true);
  });

  it('kennt eine Marke ohne Eintrag in der Tabelle nicht und behauptet nichts', () => {
    expect(trifftSchwelle('einhorn', [], TABELLE)).toBe(false);
  });

  it('schwellenPruefer bindet dieselbe Frage einmal', () => {
    const pruefer = schwellenPruefer([stand({ anzahl: 3, naechsteSchwelle: 4 })], TABELLE);
    expect(pruefer('krieger')).toBe(true);
    expect(pruefer('naturwesen')).toBe(false);
  });
});

describe('standSatz', () => {
  it('nennt den geltenden Bonus und was als Nächstes kommt', () => {
    const satz = standSatz(stand({ anzahl: 3 }), TABELLE[0]);
    expect(satz).toBe('ab 2: +10 Rüstung · noch 1 bis 4: +20 Rüstung');
  });

  it('nennt unterhalb der ersten Schwelle nur, was fehlt', () => {
    const satz = standSatz(
      stand({ anzahl: 1, schwelle: null, naechsteSchwelle: 2, bonus: null }),
      TABELLE[0],
    );
    expect(satz).toBe('noch 1 bis 2: +10 Rüstung');
  });

  it('nennt auf der höchsten Schwelle nur noch den Bonus', () => {
    const satz = standSatz(
      stand({ anzahl: 7, schwelle: 6, naechsteSchwelle: null, bonus: bonus({ ruestung: 30 }) }),
      TABELLE[0],
    );
    expect(satz).toBe('ab 6: +30 Rüstung');
  });

  it('erfindet ohne Tabelle keine Zahl', () => {
    // Die Tabelle kommt nur in der ersten Sicht. Fehlt sie, steht da, was in
    // der Sicht steht — und kein geratener Bonus.
    expect(standSatz(stand({ anzahl: 3 }), undefined)).toBe('ab 2: +10 Rüstung · noch 1 bis 4');
  });
});

// ---------------------------------------------------------------------------

describe('Synergieleiste', () => {
  it('zeigt die Anzahl gegen die naechste Schwelle als Zaehler', () => {
    render(<Synergieleiste staende={[stand({ anzahl: 3 })]} tabelle={TABELLE} />);
    const leiste = screen.getByRole('region', { name: 'Synergien' });
    // Sichtbar: das Zeichen und "3/4". Die Marke steht daran, aber nicht als
    // Zeile — das war die Textliste, die diese Leiste losgeworden ist.
    expect(within(leiste).getByText('3/4')).toBeInTheDocument();
    expect(within(leiste).getByText(/Krieger: 3 von 4/)).toBeInTheDocument();
    expect(within(leiste).getByText(/ab 2: \+10 Rüstung/)).toBeInTheDocument();
  });

  it('rechnet nichts selbst nach — sie zeigt, was die Sicht sagt', () => {
    /*
     * Die Probe aus der Aufgabe. Diese Zahlen ergeben zusammen keinen Sinn:
     * Nach der Tabelle wären fünf Krieger die Schwelle 4 mit +20 Rüstung.
     * Die Sicht behauptet Schwelle 2, +99 Rüstung und als nächste die 6.
     * Wenn die Leiste rechnete, stünde hier etwas anderes.
     */
    render(
      <Synergieleiste
        staende={[
          stand({ anzahl: 5, schwelle: 2, naechsteSchwelle: 6, bonus: bonus({ ruestung: 99 }) }),
        ]}
        tabelle={TABELLE}
      />,
    );
    expect(screen.getByText('5/6')).toBeInTheDocument();
    expect(screen.getByText(/ab 2: \+99 Rüstung/)).toBeInTheDocument();
  });

  it('nennt auf der hoechsten Stufe nur noch die Anzahl', () => {
    // Ohne nächste Schwelle wäre jeder Nenner erfunden.
    render(
      <Synergieleiste
        staende={[stand({ anzahl: 6, schwelle: 6, naechsteSchwelle: null })]}
        tabelle={TABELLE}
      />,
    );
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.queryByText(/6[/]/)).toBeNull();
  });

  it('zeigt nur die Marken, die in der Sicht stehen — nicht alle aus der Tabelle', () => {
    // Das Modul lässt Marken ohne Träger weg. Wer sie hier ergänzte, hätte
    // sieben Zähler "0/2" statt einer Auskunft.
    render(<Synergieleiste staende={[stand()]} tabelle={TABELLE} />);
    expect(screen.getByText(/Krieger:/)).toBeInTheDocument();
    expect(screen.queryByText(/Naturwesen:/)).toBeNull();
  });

  it('erfindet ohne Tabelle keinen Bonus, den Zaehler zeigt sie trotzdem', () => {
    // Die Tabelle kommt nur mit der ersten Sicht. Bis dahin steht der Zähler
    // da und der geltende Bonus (der kommt aus dem Stand), aber NICHT, was
    // die nächste Schwelle brächte — die Zahl kennt niemand.
    render(<Synergieleiste staende={[stand({ anzahl: 3 })]} tabelle={[]} />);
    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(screen.getByText(/noch 1 bis 4$/)).toBeInTheDocument();
    expect(screen.queryByText(/Leben/)).toBeNull();
  });

  it('hebt eine Marke mit erreichter Schwelle hervor', () => {
    const { container } = render(
      <Synergieleiste
        staende={[
          stand({ anzahl: 3 }),
          stand({ marke: 'naturwesen', name: 'Naturwesen', anzahl: 1, schwelle: null, naechsteSchwelle: 2, bonus: null }),
        ]}
        tabelle={TABELLE}
      />,
    );
    const eintraege = container.querySelectorAll('li');
    expect(eintraege[0]!.hasAttribute('data-aktiv')).toBe(true);
    expect(eintraege[1]!.hasAttribute('data-aktiv')).toBe(false);
  });

  it('sagt es, wenn noch keine Marke auf dem Feld steht', () => {
    render(<Synergieleiste staende={[]} tabelle={TABELLE} />);
    expect(screen.getByText(/Noch keine Marken/)).toBeInTheDocument();
  });

  it('laesst sich nicht mehr zuklappen — dafuer ist sie zu flach', () => {
    // Vorher eine Liste mit Sätzen und einem Klappknopf, der selbst so hoch
    // war wie die Zähler heute zusammen.
    render(<Synergieleiste staende={[stand()]} tabelle={TABELLE} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('Markenzeichen', () => {
  function zeige(
    marken: string[],
    trifft?: (m: string) => boolean,
    beschriftet?: boolean,
  ): HTMLElement {
    const { container } = render(
      <Markennamen.Provider value={markennamen(TABELLE)}>
        <Markenzeichen marken={marken} trifft={trifft} beschriftet={beschriftet} />
      </Markennamen.Provider>,
    );
    return container;
  }

  it('zeichnet ein Zeichen je Marke', () => {
    const container = zeige(['krieger', 'naturwesen']);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('nimmt den Namen aus der Tabelle der Sicht, nicht aus einer Liste im Client', () => {
    const container = zeige(['krieger']);
    expect(container.querySelector('[title]')).toHaveAttribute('title', 'Krieger');
  });

  it('behilft sich bei einer unbekannten Marke mit ihrer Kennung', () => {
    // Eine achte Marke im Katalog soll ein Zeichen bekommen und keinen Absturz.
    const container = zeige(['einhorn']);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.querySelector('[title]')).toHaveAttribute('title', 'einhorn');
  });

  it('hebt genau die Marke hervor, deren Schwelle der Kauf erreicht', () => {
    const container = zeige(['krieger', 'naturwesen'], (m) => m === 'krieger');
    const zeichen = container.querySelectorAll('[title]');
    expect(zeichen[0]!.hasAttribute('data-trifft')).toBe(true);
    expect(zeichen[1]!.hasAttribute('data-trifft')).toBe(false);
  });

  it('bleibt an der Einheit vor dem Vorlesegerät verborgen, auf der Ladenkarte nicht', () => {
    // An der Einheit trägt schon das aria-label den Namen; neunzehn Felder mit
    // je zwei zusätzlich vorgelesenen Wörtern wären Lärm. Im Laden dagegen ist
    // die Marke die Kaufauskunft.
    const still = zeige(['krieger']);
    expect(still.querySelector('span')).toHaveAttribute('aria-hidden', 'true');

    const laut = zeige(['krieger'], undefined, true);
    expect(laut.querySelector('span')).not.toHaveAttribute('aria-hidden');
    expect(within(laut).getByText('Krieger')).toBeInTheDocument();
  });

  it('zeichnet nichts, wenn eine Einheit keine Marke trägt', () => {
    const container = zeige([]);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('Fremdmarken', () => {
  it('zeigt die Marken des fremden Bretts mit demselben Zaehler wie die eigene Leiste', () => {
    // Die Frage aus der Aufgabe: Geht der Gegner gerade auf sechs Wächter zu?
    render(
      <Fremdmarken
        staende={[stand({ marke: 'waechter', name: 'Wächter', anzahl: 4, schwelle: 4, naechsteSchwelle: 6 })]}
        tabelle={TABELLE}
        beschriftung="Marken von Ada"
      />,
    );
    const zeile = screen.getByRole('list', { name: 'Marken von Ada' });
    expect(within(zeile).getByText('4/6')).toBeInTheDocument();
  });

  it('rechnet nichts nach — auch hier stehen die Zahlen der Sicht', () => {
    /*
     * Dieselbe Probe wie bei der eigenen Leiste, mit Zahlen, die zur Tabelle
     * nicht passen: fünf Krieger, aber laut Sicht Schwelle 2 und als nächste
     * die 6. Wer hier abzählte, käme auf etwas anderes.
     */
    render(
      <Fremdmarken
        staende={[stand({ anzahl: 5, schwelle: 2, naechsteSchwelle: 6, bonus: bonus({ ruestung: 99 }) })]}
        tabelle={TABELLE}
        beschriftung="Marken von Ada"
      />,
    );
    expect(screen.getByText('5/6')).toBeInTheDocument();
    expect(screen.getByText(/ab 2: \+99 Rüstung/)).toBeInTheDocument();
  });

  it('hebt eine erreichte Schwelle hervor, eine unerreichte nicht', () => {
    const { container } = render(
      <Fremdmarken
        staende={[
          stand({ anzahl: 3 }),
          stand({
            marke: 'naturwesen',
            name: 'Naturwesen',
            anzahl: 1,
            schwelle: null,
            naechsteSchwelle: 2,
            bonus: null,
          }),
        ]}
        tabelle={TABELLE}
        beschriftung="Marken von Ada"
      />,
    );
    const eintraege = container.querySelectorAll('li');
    expect(eintraege[0]!.hasAttribute('data-aktiv')).toBe(true);
    expect(eintraege[1]!.hasAttribute('data-aktiv')).toBe(false);
  });

  it('zeichnet gar nichts, solange keine Marke auf dem fremden Brett steht', () => {
    // Kein „Noch keine Marken" wie in der eigenen Leiste: Das ist eine
    // Aufforderung, und aufzustellen hat man auf fremdem Brett nichts. Der
    // leere Fall trifft auch einen Tisch aus der Zeit vor den Synergien —
    // dort fehlt das Feld ganz.
    const { container } = render(
      <Fremdmarken staende={[]} tabelle={TABELLE} beschriftung="Marken von Ada" />,
    );
    expect(container.querySelector('ul')).toBeNull();
  });

  it('nennt dem Vorlesegeraet, wessen Marken das sind', () => {
    // In der Liste steht nur „Wächter: 4 von 6" — wem das Brett gehört, sagt
    // sichtbar der Bretttitel darüber, den ein Vorleser überspringen kann.
    render(
      <Fremdmarken
        staende={[stand({ marke: 'waechter', name: 'Wächter', anzahl: 4, naechsteSchwelle: 6 })]}
        tabelle={TABELLE}
        beschriftung="Marken von Ada"
      />,
    );
    expect(screen.getByRole('list', { name: 'Marken von Ada' })).toBeInTheDocument();
    expect(screen.getByText(/Wächter: 4 von 6/)).toBeInTheDocument();
  });
});
