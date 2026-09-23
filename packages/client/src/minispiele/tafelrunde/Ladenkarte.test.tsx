import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KARTENKASTEN } from './bildfolge';
import { Ladenkarte, kaufhindernis } from './Ladenkarte';
import type { Einheit } from './sicht';

/*
 * Die Karte im Laden.
 *
 * DIE WICHTIGSTE PROBE IST DIE LETZTE: Ein langer Druck schlaegt das Blatt auf
 * und darf danach NICHT auch noch kaufen. Der Klick kommt beim Loslassen
 * ohnehin — ein Tipp, der ein Blatt aufschlaegt und im selben Zug Gold
 * ausgibt, waere die teuerste Fehlbedienung des Spiels.
 *
 * Und die zweitwichtigste: Der sichtbare Griff bleibt bedienbar, wenn die
 * Karte gesperrt ist. Genau dort will man sich erkundigen — und genau dort
 * schickt die Schaltflaeche keine Zeigerereignisse mehr, der lange Druck
 * greift also nicht.
 */

const DORFWACHE: Einheit = {
  id: 'dorfwache',
  name: 'Dorfwache',
  kosten: 1,
  rolle: 'wache',
  marken: ['krieger', 'waechter'],
  leben: 650,
  angriff: 30,
  tempo: 0.65,
  reichweite: 1,
  ruestung: 40,
};

function zeichne(zusatz: Partial<React.ComponentProps<typeof Ladenkarte>> = {}) {
  const onKauf = vi.fn();
  const onBlatt = vi.fn();
  const ergebnis = render(
    <Ladenkarte
      einheit={DORFWACHE}
      kaufbar
      verschmilzt={false}
      fehlt={2}
      verschmelzZahl={3}
      marken={DORFWACHE.marken}
      trifftSchwelle={() => false}
      grund={null}
      onKauf={onKauf}
      onBlatt={onBlatt}
      {...zusatz}
    />,
  );
  // Die Karte ueber ihre Klasse und nicht ueber den Namen: „Dorfwache" steht
  // auch am Griff daneben („Dorfwache ansehen"), und zwei Treffer sind hier
  // kein Zufall, sondern der Sinn der Sache.
  const karte = ergebnis.container.querySelector('.tr-karte') as HTMLElement;
  return { ...ergebnis, karte, onKauf, onBlatt };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Ladenkarte', () => {
  it('kauft beim kurzen Tipp', () => {
    const { karte, onKauf, onBlatt } = zeichne();
    fireEvent.click(karte);
    expect(onKauf).toHaveBeenCalledOnce();
    expect(onBlatt).not.toHaveBeenCalled();
  });

  it('schlaegt beim langen Druck das Blatt auf und kauft dann NICHT', () => {
    vi.useFakeTimers();
    const { karte, onKauf, onBlatt } = zeichne();

    fireEvent.pointerDown(karte);
    vi.advanceTimersByTime(500);
    expect(onBlatt).toHaveBeenCalledOnce();

    // Der Klick beim Loslassen kommt trotzdem — er darf kein Gold kosten.
    fireEvent.pointerUp(karte);
    fireEvent.click(karte);
    expect(onKauf).not.toHaveBeenCalled();

    // Und der naechste kurze Tipp kauft wieder.
    fireEvent.pointerDown(karte);
    fireEvent.pointerUp(karte);
    fireEvent.click(karte);
    expect(onKauf).toHaveBeenCalledOnce();
  });

  it('bricht den langen Druck ab, wenn der Finger vorher weggeht', () => {
    vi.useFakeTimers();
    const { karte, onKauf, onBlatt } = zeichne();

    fireEvent.pointerDown(karte);
    fireEvent.pointerUp(karte);
    vi.advanceTimersByTime(500);
    expect(onBlatt).not.toHaveBeenCalled();

    fireEvent.click(karte);
    expect(onKauf).toHaveBeenCalledOnce();
  });

  it('haelt den Griff zum Blatt auch an einer gesperrten Karte bereit', () => {
    // Der lange Druck greift hier nicht (eine gesperrte Schaltflaeche schickt
    // keine Zeigerereignisse) — der Griff daneben schon. Er ist auch der
    // einzige Weg mit der Tastatur.
    const { onBlatt } = zeichne({ kaufbar: false, grund: 'gold' });
    fireEvent.click(screen.getByRole('button', { name: 'Dorfwache ansehen' }));
    expect(onBlatt).toHaveBeenCalledOnce();
  });

  it('laesst den Griff weg, wenn der Aufrufer keinen Haken gibt', () => {
    zeichne({ onBlatt: undefined });
    expect(screen.queryByRole('button', { name: /ansehen/ })).toBeNull();
  });
});

describe('kaufhindernis', () => {
  it('nennt das Gold vor der Bank — daran laesst sich noch etwas aendern', () => {
    expect(kaufhindernis(0, true, DORFWACHE)).toBe('gold');
    expect(kaufhindernis(5, true, DORFWACHE)).toBe('bank');
    expect(kaufhindernis(5, false, DORFWACHE)).toBeNull();
    // Kein Angebot, kein Hindernis.
    expect(kaufhindernis(0, true, undefined)).toBeNull();
  });
});

describe('Die Masse der Figur kommen von der Figur', () => {
  it('setzt Hoehe und Boden des Kartenkopfs als Variablen in Pixeln', () => {
    /*
     * Die Karte rechnet in Pixeln und nicht in Prozent — sie ist eine Spalte
     * von fuenf und auf einem 360er-Handy keine 70 px breit. Die beiden Zahlen
     * standen bis zum 22.09.2026 fest im Stylesheet und hingen dort stumm am
     * gemessenen Ausschnitt der Blaetter; heute rechnet `KARTENKASTEN` sie
     * (bildfolge.ts), und `EinheitenFigur` bringt sie mit.
     */
    const { container } = zeichne();
    const figur = container.querySelector('.tr-figur3d-karte') as HTMLElement;
    expect(figur.style.getPropertyValue('--tr-kartenkasten-hoehe')).toBe(
      `${KARTENKASTEN.hoehe}px`,
    );
    expect(figur.style.getPropertyValue('--tr-kartenkasten-boden')).toBe(
      `${KARTENKASTEN.boden}px`,
    );
  });
});
