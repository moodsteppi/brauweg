import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuswahlFilter, AuswahlRaster, passtZurSuche, type AuswahlEintrag } from './hub';

/*
 * Das Auswahl-Bauteil aus hub.tsx (22.09.2026).
 *
 * Geprueft wird, was die Folgenutzer (Golf-Bahnwahl, Partykiste,
 * Themenpakete) blind voraussetzen werden: dass der Name einer Kachel ihr
 * Titel ist, dass eine gesperrte Kachel ihren Grund SAGT statt stumm zu
 * verschwinden, und dass das Raster nichts selbst entscheidet — es meldet
 * die Wahl, uebernehmen muss der Aufrufer.
 */

const BAHNEN: AuswahlEintrag[] = [
  { kennung: 'wiese', titel: 'Wiese', untertitel: 'Par 3', badge: 1 },
  { kennung: 'duene', titel: 'Düne', untertitel: 'Par 4', badge: 3, bild: '/bahn/duene.webp' },
  { kennung: 'vulkan', titel: 'Vulkan', deaktiviert: 'Ab Stufe 10', untertitel: 'Par 5' },
  { kennung: 'insel', titel: 'Insel', vorschau: <svg data-testid="miniatur" /> },
];

/** Das Raster mit eigenem Zustand, wie es ein Bildschirm benutzt. */
function Einfach({ onWahl }: { onWahl?: (k: string) => void }): React.JSX.Element {
  const [wahl, setWahl] = useState<string | null>('wiese');
  return (
    <AuswahlRaster
      label="Bahn"
      eintraege={BAHNEN}
      gewaehlt={wahl}
      onWahl={(k) => {
        onWahl?.(k);
        setWahl(k);
      }}
    />
  );
}

function Mehrfach(): React.JSX.Element {
  const [wahl, setWahl] = useState<string[]>([]);
  return (
    <AuswahlRaster
      label="Minispiele"
      mehrfach
      eintraege={BAHNEN}
      gewaehlt={wahl}
      onWahl={(_k, auswahl) => setWahl(auswahl)}
    />
  );
}

const kachel = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('AuswahlRaster', () => {
  it('rendert je Eintrag eine Kachel — der Name ist der Titel, nicht der Untertitel', () => {
    render(<Einfach />);
    expect(screen.getByRole('group', { name: 'Bahn' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(kachel('Wiese')).toHaveAccessibleDescription(/Par 3/);
    // Bild und Vorschau-Slot: das eine als <img>, das andere wie uebergeben.
    expect(kachel('Düne').querySelector('img')?.getAttribute('src')).toBe('/bahn/duene.webp');
    expect(screen.getByTestId('miniatur')).toBeInTheDocument();
    // Schwierigkeit als Punkte, fuer Vorleser als Zahl.
    expect(screen.getByRole('img', { name: 'Stufe 3 von 5' })).toBeInTheDocument();
  });

  it('Einfachauswahl: genau eine Kachel ist gedrueckt', () => {
    const onWahl = vi.fn();
    render(<Einfach onWahl={onWahl} />);
    expect(kachel('Wiese')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(kachel('Düne'));
    expect(onWahl).toHaveBeenCalledWith('duene');
    expect(kachel('Düne')).toHaveAttribute('aria-pressed', 'true');
    expect(kachel('Wiese')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Mehrfachauswahl: an- und wieder abwaehlen, unabhaengig voneinander', () => {
    render(<Mehrfach />);
    expect(screen.getByRole('group', { name: 'Minispiele' })).toHaveAttribute('aria-multiselectable', 'true');
    fireEvent.click(kachel('Wiese'));
    fireEvent.click(kachel('Insel'));
    expect(kachel('Wiese')).toHaveAttribute('aria-pressed', 'true');
    expect(kachel('Insel')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(kachel('Wiese'));
    expect(kachel('Wiese')).toHaveAttribute('aria-pressed', 'false');
    expect(kachel('Insel')).toHaveAttribute('aria-pressed', 'true');
  });

  it('meldet nur, uebernimmt nichts: ohne Aufrufer bleibt die Wahl stehen', () => {
    const onWahl = vi.fn();
    render(<AuswahlRaster label="Bahn" eintraege={BAHNEN} gewaehlt="wiese" onWahl={onWahl} />);
    fireEvent.click(kachel('Düne'));
    expect(onWahl).toHaveBeenCalledWith('duene', ['duene']);
    expect(kachel('Wiese')).toHaveAttribute('aria-pressed', 'true');
  });

  it('eine gesperrte Kachel ist nicht waehlbar und zeigt ihren Grund', () => {
    const onWahl = vi.fn();
    render(<Einfach onWahl={onWahl} />);
    const vulkan = kachel('Vulkan');
    expect(vulkan).toHaveAttribute('aria-disabled', 'true');
    // Der Grund verdraengt den Untertitel — und bleibt vorlesbar.
    expect(screen.getByText('Ab Stufe 10')).toBeInTheDocument();
    expect(screen.queryByText('Par 5')).toBeNull();
    expect(vulkan).toHaveAccessibleDescription('Ab Stufe 10');
    fireEvent.click(vulkan);
    fireEvent.keyDown(vulkan, { key: 'Enter' });
    expect(onWahl).not.toHaveBeenCalled();
    expect(vulkan).toHaveAttribute('aria-pressed', 'false');
    // Fokussierbar bleibt sie trotzdem, sonst erfaehrt die Tastatur den Grund nie.
    expect(vulkan).not.toBeDisabled();
  });

  it('Tastatur: Pfeile wandern, Pos1/Ende springen, am Rand bleibt es stehen', () => {
    render(<Einfach />);
    const raster = screen.getByRole('group', { name: 'Bahn' });
    kachel('Wiese').focus();
    fireEvent.keyDown(raster, { key: 'ArrowRight' });
    expect(kachel('Düne')).toHaveFocus();
    fireEvent.keyDown(raster, { key: 'ArrowDown' });
    // Auch die gesperrte Kachel bekommt den Fokus — sie ist nur nicht waehlbar.
    expect(kachel('Vulkan')).toHaveFocus();
    fireEvent.keyDown(raster, { key: 'End' });
    expect(kachel('Insel')).toHaveFocus();
    fireEvent.keyDown(raster, { key: 'ArrowRight' });
    expect(kachel('Insel')).toHaveFocus();
    fireEvent.keyDown(raster, { key: 'Home' });
    expect(kachel('Wiese')).toHaveFocus();
    fireEvent.keyDown(raster, { key: 'ArrowLeft' });
    expect(kachel('Wiese')).toHaveFocus();
  });

  it('Enter und Leertaste waehlen — weil die Kachel ein echter Knopf ist', () => {
    render(<Einfach />);
    // jsdom loest aus Tasten keinen Klick aus; dass es einer ist, genuegt:
    // Der Browser macht aus Enter und Leertaste auf <button> einen Klick.
    const duene = kachel('Düne');
    expect(duene.tagName).toBe('BUTTON');
    expect(duene).toHaveAttribute('type', 'button');
  });

  it('feste Spaltenzahl und Mindestbreite gehen als Custom Property ans Raster', () => {
    render(<AuswahlRaster label="Art" eintraege={BAHNEN} gewaehlt={null} onWahl={() => {}} spalten={2} min="18rem" />);
    const raster = screen.getByRole('group', { name: 'Art' });
    expect(raster).toHaveClass('aw-raster', 'is-fest');
    expect(raster.style.getPropertyValue('--aw-spalten')).toBe('2');
    expect(raster.style.getPropertyValue('--aw-min')).toBe('18rem');
  });
});

describe('AuswahlFilter', () => {
  it('Suchtext und Chips sind gesteuert und melden sich beim Aufrufer', () => {
    const onSuchtext = vi.fn();
    const onChip = vi.fn();
    render(
      <AuswahlFilter
        suchtext=""
        onSuchtext={onSuchtext}
        chips={[
          { kennung: 'leicht', text: 'Leicht' },
          { kennung: 'schwer', text: 'Schwer' },
        ]}
        chip="leicht"
        onChip={onChip}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox', { name: 'Auswahl durchsuchen' }), {
      target: { value: 'düne' },
    });
    expect(onSuchtext).toHaveBeenCalledWith('düne');
    expect(screen.getByRole('button', { name: 'Leicht' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Schwer' }));
    expect(onChip).toHaveBeenCalledWith('schwer');
  });

  it('passtZurSuche: jedes Wort in Titel oder Untertitel, ohne Gross/Klein', () => {
    const [wiese, duene] = BAHNEN as [AuswahlEintrag, AuswahlEintrag];
    expect(passtZurSuche(wiese, '')).toBe(true);
    expect(passtZurSuche(duene, 'DÜNE par')).toBe(true);
    expect(passtZurSuche(duene, 'düne 3')).toBe(false);
    expect(passtZurSuche(wiese, 'par 3')).toBe(true);
  });

  it('ein leeres Raster sagt es, statt als Luecke dazustehen', () => {
    render(<AuswahlRaster label="Bahn" eintraege={[]} gewaehlt={null} onWahl={() => {}} leer="Keine Bahn passt." />);
    expect(screen.getByText('Keine Bahn passt.')).toBeInTheDocument();
  });
});
