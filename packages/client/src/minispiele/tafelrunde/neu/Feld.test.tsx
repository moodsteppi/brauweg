import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Bank } from './Bank';
import { Hexbrett } from './Feld';
import { Kopfband } from './Kopfband';
import { KATALOG, ruestsicht } from './testdaten';

/*
 * Feld, Bank und Kopfband: Einheiten mit Sternen und Rollenzeichen, der
 * Farbring der angetippten Marke, Ziele fuers Ziehen (`data-ziel`), der
 * Lesepfad am fremden Brett. Und die Mitspieler mit ihren Leben.
 */

const LEER = { gewaehlt: null, ablegeZiel: null, ziehtVon: null } as const;

describe('Hexbrett', () => {
  it('zeigt Einheiten mit Sternen und Rollenzeichen, jede Wabe des eigenen Bretts ist ein Ziel', () => {
    const sicht = ruestsicht();
    // Nach „Bereit" (nicht aktiv) fuehrt der Lesepfad zur Einheit.
    const { container } = render(
      <Hexbrett reihen={4} spalten={5} felder={sicht.eigenes!.brett} katalog={KATALOG} eigen aktiv={false} {...LEER} onNachsehen={() => {}} marke={null} beschriftung="Dein Feld" />,
    );
    expect(container.querySelectorAll('[data-ziel^="brett:"]')).toHaveLength(20);
    const wache = screen.getByRole('button', { name: 'Pinguinwache, Wache, Stufe 2' });
    expect(wache).toHaveAttribute('data-ziel', 'brett:16');
    // Sterne ueber der Einheit — gemalt oder als Zeichen, je nachdem, was
    // grafik-neu.ts gerade kennt; gezaehlt wird die Stufe.
    expect(container.querySelector('[data-stufe="2"]')?.children).toHaveLength(2);
  });

  it('die angetippte Marke legt ihren Farbring um alle Traeger', () => {
    const sicht = ruestsicht();
    const { container, rerender } = render(
      <Hexbrett reihen={4} spalten={5} felder={sicht.eigenes!.brett} katalog={KATALOG} eigen aktiv {...LEER} marke={null} beschriftung="x" />,
    );
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(0);
    rerender(
      <Hexbrett reihen={4} spalten={5} felder={sicht.eigenes!.brett} katalog={KATALOG} eigen aktiv {...LEER} marke="krieger" beschriftung="x" />,
    );
    // Pinguinwache und Kaiserkrieger tragen beide „krieger".
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(2);
    rerender(
      <Hexbrett reihen={4} spalten={5} felder={sicht.eigenes!.brett} katalog={KATALOG} eigen aktiv {...LEER} marke="waechter" beschriftung="x" />,
    );
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(1);
  });

  it('ein Tipp ohne Bewegung geht an `tippe` — ueber die Zeigerereignisse des Ziehens', () => {
    const sicht = ruestsicht();
    const zeiger = {
      onZeigerStart: vi.fn(),
      onZeigerBewegung: vi.fn(),
      onZeigerEnde: vi.fn(),
      onZeigerAbbruch: vi.fn(),
    };
    render(
      <Hexbrett reihen={4} spalten={5} felder={sicht.eigenes!.brett} katalog={KATALOG} eigen aktiv {...LEER} zeiger={zeiger} marke={null} beschriftung="x" />,
    );
    const wache = screen.getByRole('button', { name: /Pinguinwache/ });
    fireEvent.pointerDown(wache);
    fireEvent.pointerUp(wache);
    expect(zeiger.onZeigerStart).toHaveBeenCalledWith({ bereich: 'brett', platz: 16 }, expect.anything());
    expect(zeiger.onZeigerEnde).toHaveBeenCalledWith({ bereich: 'brett', platz: 16 }, expect.anything());
  });

  it('das fremde Brett ist gespiegelt, ohne Ziele, aber nachschlagbar', () => {
    const sicht = ruestsicht();
    const onNachsehen = vi.fn();
    const { container } = render(
      <Hexbrett reihen={4} spalten={5} felder={sicht.gegner[0]!.brett} katalog={KATALOG} gespiegelt aktiv={false} {...LEER} onNachsehen={onNachsehen} marke={null} beschriftung="Feld von KI" />,
    );
    expect(container.querySelectorAll('[data-ziel]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Pinguindieb/ }));
    expect(onNachsehen).toHaveBeenCalledWith({ bereich: 'brett', platz: 17 });
  });

  it('ein leeres Ziel nimmt im Antipp-Weg den Tipp an', () => {
    const sicht = ruestsicht();
    const onTippe = vi.fn();
    render(
      <Hexbrett
        reihen={4}
        spalten={5}
        felder={sicht.eigenes!.brett}
        katalog={KATALOG}
        eigen
        aktiv
        {...LEER}
        gewaehlt={{ bereich: 'bank', platz: 0 }}
        istZiel={(ort) => ort.platz === 3}
        onTippe={onTippe}
        marke={null}
        beschriftung="x"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Feld 4 · Ziel' }));
    expect(onTippe).toHaveBeenCalledWith({ bereich: 'brett', platz: 3 });
  });
});

describe('Bank', () => {
  it('neun Plaetze aus der Sicht, jeder ein Ziel, belegte mit Einheit', () => {
    const sicht = ruestsicht();
    const { container } = render(
      <Bank plaetze={9} bank={sicht.eigenes!.bank} katalog={KATALOG} aktiv={false} {...LEER} onTippe={() => {}} onNachsehen={() => {}} marke={null} />,
    );
    expect(container.querySelectorAll('[data-ziel^="bank:"]')).toHaveLength(9);
    expect(container.querySelectorAll('[data-leer]')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Pinguinwache, Wache, Stufe 1' })).toBeInTheDocument();
  });
});

describe('Kopfband', () => {
  it('Runde, Bereit-Zaehler und alle Mitspieler mit Leben; ein Tipp meldet den Sitz', () => {
    const onWahl = vi.fn();
    render(
      <Kopfband
        sicht={ruestsicht()}
        sitze={[{ seat: 1, displayName: 'Tom', accountId: 't', avatarUrl: null, isBot: false }]}
        gegnerJetzt={null}
        gezeigt={1}
        frist={null}
        onWahl={onWahl}
        onZurueck={() => {}}
        onRegeln={() => {}}
      />,
    );
    expect(screen.getByText('Runde 3')).toBeInTheDocument();
    expect(screen.getByText(/1 von 2 bereit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tom, 9 Leben' }));
    expect(onWahl).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'Du, 12 Leben' })).toHaveAttribute('data-ich');
  });
});
