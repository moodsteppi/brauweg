import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* Das Titelbild steht nicht fest — die Grafikstrecke traegt es irgendwann
   ein. Der Test des Ersatzes darf davon nicht abhaengen. */
vi.mock('../../../figuren3d/grafik-neu', async (original) => ({
  ...(await original<typeof import('../../../figuren3d/grafik-neu')>()),
  titelBild: () => null,
  figurNeuBlatt: () => null,
}));

import { BeitretenSeite, EinstiegSeite, ErstellenSeite } from './Einstieg';
import { KEIN_REGELWISSEN } from './Regelblatt';
import { FAEHIGKEITEN, KATALOG, TABELLE } from './testdaten';

/*
 * Der Einstieg: Schnellsuche als Hauptknopf, Erstellen, Beitreten, Bots,
 * Regeln — jeder Knopf fuehrt zu seinem Rueckruf. Titelbild: ohne Datei der
 * Ersatz aus den fuenf Rollenfiguren, kein leeres Bild.
 */

function einstieg(teil: Partial<Parameters<typeof EinstiegSeite>[0]> = {}) {
  const rufe = { onBack: vi.fn(), onSuche: vi.fn(), onErstellen: vi.fn(), onBeitreten: vi.fn(), onBots: vi.fn() };
  render(<EinstiegSeite aktiv={7} startet={false} fehler={null} regelwissen={KEIN_REGELWISSEN} {...rufe} {...teil} />);
  return rufe;
}

describe('Einstieg', () => {
  it('jeder Knopf ruft seinen Weg', () => {
    const rufe = einstieg();
    fireEvent.click(screen.getByRole('button', { name: 'Schnellsuche' }));
    fireEvent.click(screen.getByRole('button', { name: /Tisch erstellen/ }));
    fireEvent.click(screen.getByRole('button', { name: /Tisch beitreten/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gegen Bots spielen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(rufe.onSuche).toHaveBeenCalledTimes(1);
    expect(rufe.onErstellen).toHaveBeenCalledTimes(1);
    expect(rufe.onBeitreten).toHaveBeenCalledTimes(1);
    expect(rufe.onBots).toHaveBeenCalledTimes(1);
    expect(rufe.onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('7 Spieler gerade in Tafelrunde')).toBeInTheDocument();
  });

  it('das Titelbild ist ohne Datei der Ersatz aus den Rollenfiguren', () => {
    const { container } = render(
      <EinstiegSeite aktiv={null} startet={false} fehler={null} regelwissen={KEIN_REGELWISSEN} onBack={() => {}} onSuche={() => {}} onErstellen={() => {}} onBeitreten={() => {}} onBots={() => {}} />,
    );
    const titel = container.querySelector('[data-ersatz]');
    expect(titel).not.toBeNull();
    // Fuenf Figuren aus den alten Rollenblaettern, keine fehlende Datei.
    expect(titel!.querySelectorAll('img')).toHaveLength(5);
  });

  it('die Regeln gehen als Blatt auf; vor dem Tisch ohne Faehigkeiten, mit dem Hinweis darauf', () => {
    einstieg();
    fireEvent.click(screen.getByRole('button', { name: /Anleitung/ }));
    expect(screen.getByRole('dialog', { name: 'So spielt man Tafelrunde' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Fähigkeiten' }));
    expect(screen.getByText(/sobald du an einem sitzt/)).toBeInTheDocument();
  });

  it('mit Wissen vom Tisch stehen Faehigkeiten und Marken im Regelblatt', () => {
    einstieg({ regelwissen: { katalog: KATALOG, faehigkeiten: FAEHIGKEITEN, synergieTabelle: TABELLE } });
    fireEvent.click(screen.getByRole('button', { name: /Anleitung/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Fähigkeiten' }));
    expect(screen.getByText(/Kettenblitz/)).toBeInTheDocument();
    expect(screen.getByText(/80 Mana/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Marken' }));
    expect(screen.getByText('+5 Rüstung, unter halbem Leben +20 % Angriff.')).toBeInTheDocument();
  });

  it('ein Fehler steht als Meldung da', () => {
    einstieg({ fehler: 'Die Suche ist fehlgeschlagen.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Die Suche ist fehlgeschlagen.');
  });
});

describe('Erstellen und Beitreten', () => {
  it('Erstellen: Platzwahl meldet die Zahl, Bot-Stufe nur mit Bots', () => {
    const onSitze = vi.fn();
    const props = {
      sitzWahl: [2, 4, 8],
      sitze: 4,
      oeffentlich: false,
      botStufe: 'standard' as const,
      botStufen: [{ id: 'standard' as const, name: 'Normal' }],
      startet: false,
      fehler: null,
      onSitze,
      onOeffentlich: () => {},
      onBotsFuellen: () => {},
      onBotStufe: () => {},
      onErstellen: () => {},
      onZurueck: () => {},
    };
    const { rerender } = render(<ErstellenSeite {...props} botsFuellen />);
    fireEvent.click(screen.getByRole('radio', { name: '8' }));
    expect(onSitze).toHaveBeenCalledWith(8);
    expect(screen.getByRole('radiogroup', { name: 'Wie hart spielen die Bots' })).toBeInTheDocument();
    rerender(<ErstellenSeite {...props} botsFuellen={false} />);
    expect(screen.queryByRole('radiogroup', { name: 'Wie hart spielen die Bots' })).not.toBeInTheDocument();
  });

  it('Beitreten: Knopf erst mit vollstaendigem Code, Eingabe in Grossbuchstaben', () => {
    const onCode = vi.fn();
    const props = {
      code: 'AB',
      vorschau: null,
      offeneTische: [],
      startet: false,
      fehler: null,
      onCode,
      onPerCode: () => {},
      onTisch: () => {},
      onZurueck: () => {},
    };
    const { rerender } = render(<BeitretenSeite {...props} codeFertig={false} />);
    expect(screen.getByRole('button', { name: 'Beitreten' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Beitrittscode'), { target: { value: 'kx7m9q' } });
    expect(onCode).toHaveBeenCalledWith('KX7M9Q');
    rerender(<BeitretenSeite {...props} codeFertig />);
    expect(screen.getByRole('button', { name: 'Beitreten' })).toBeEnabled();
  });
});
