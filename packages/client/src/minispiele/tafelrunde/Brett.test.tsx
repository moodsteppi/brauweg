import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BANKKASTEN, WABENKASTEN } from './bildfolge';
import { Bankreihe, Einheitenmarke, Hexbrett } from './Brett';
import type { Einheit } from './sicht';

/*
 * Der Lesepfad: eine Einheit antippen, ohne sie zu fassen.
 *
 * Bis zum 19.9.2026 schaltete `aktiv` alles ab — wer schon „Bereit" gedrueckt
 * hatte oder das Brett des Gegners ansah, kam an kein Blatt mehr. Seitdem gibt
 * es `onNachsehen`: Die Marke wird zum Knopf, aber nicht zum Griff. Geprueft
 * wird hier die TRENNUNG der beiden Wege, denn sie ist die einzige Regel in
 * dieser Datei: Ist die Einheit aktiv, fuehrt `onWaehlen` zum Blatt und
 * `onNachsehen` liegt still — sonst liefe ein Tipp doppelt (einmal ueber den
 * Zeiger, einmal ueber den Klick) und das Blatt ginge auf und gleich wieder
 * zu.
 */

const DORFWACHE: Einheit = {
  id: 'dorfwache',
  name: 'Dorfwache',
  kosten: 1,
  rolle: 'wache',
  marken: ['krieger'],
  leben: 650,
  angriff: 30,
  tempo: 0.65,
  reichweite: 1,
  ruestung: 40,
};
const KATALOG = { dorfwache: DORFWACHE };
const WACHE = { id: 'dorfwache', stufe: 1 };

describe('Einheitenmarke — der Lesepfad', () => {
  it('ist ohne aktiv und ohne Lesepfad gar nicht antippbar', () => {
    // Der Stand vor dem 19.9.2026, und er bleibt so, wo niemand `onNachsehen`
    // anbietet: Ein Knopf, hinter dem nichts kommt, waere fuer ein
    // Vorlesegeraet eine Luege.
    render(
      <Einheitenmarke
        kaempfer={WACHE}
        katalog={KATALOG}
        maxStufe={3}
        fehlt={0}
        aktiv={false}
        onWaehlen={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ist mit Lesepfad antippbar, aber nicht fassbar', () => {
    const nachsehen = vi.fn();
    render(
      <Einheitenmarke
        kaempfer={WACHE}
        katalog={KATALOG}
        maxStufe={3}
        fehlt={0}
        aktiv={false}
        onNachsehen={nachsehen}
      />,
    );
    const marke = screen.getByRole('button', { name: /Dorfwache/ });
    expect(marke).not.toHaveAttribute('data-fassbar');
    expect(marke).toHaveAttribute('data-lesbar');
    /* JEDER Klick zaehlt hier, der echte (detail 1) wie der erzeugte
       (detail 0): Ohne `aktiv` gibt es keinen Zeigerweg, der den echten schon
       erledigt haette. */
    fireEvent.click(marke, { detail: 1 });
    fireEvent.click(marke, { detail: 0 });
    expect(nachsehen).toHaveBeenCalledTimes(2);
  });

  it('nimmt den Lesepfad auch ueber die Tastatur', () => {
    const nachsehen = vi.fn();
    render(
      <Einheitenmarke
        kaempfer={WACHE}
        katalog={KATALOG}
        maxStufe={3}
        fehlt={0}
        aktiv={false}
        onNachsehen={nachsehen}
      />,
    );
    const marke = screen.getByRole('button', { name: /Dorfwache/ });
    expect(marke).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(marke, { key: 'Enter' });
    fireEvent.keyDown(marke, { key: ' ' });
    fireEvent.keyDown(marke, { key: 'a' });
    expect(nachsehen).toHaveBeenCalledTimes(2);
  });

  it('laesst den Lesepfad liegen, solange die Einheit aktiv ist', () => {
    const waehlen = vi.fn();
    const nachsehen = vi.fn();
    render(
      <Einheitenmarke
        kaempfer={WACHE}
        katalog={KATALOG}
        maxStufe={3}
        fehlt={0}
        aktiv
        onWaehlen={waehlen}
        onNachsehen={nachsehen}
      />,
    );
    const marke = screen.getByRole('button', { name: /Dorfwache/ });
    expect(marke).toHaveAttribute('data-fassbar');
    expect(marke).not.toHaveAttribute('data-lesbar');
    fireEvent.click(marke, { detail: 0 });
    fireEvent.keyDown(marke, { key: 'Enter' });
    expect(waehlen).toHaveBeenCalledTimes(2);
    expect(nachsehen).not.toHaveBeenCalled();
  });
});

describe('Hexbrett und Bankreihe reichen den Lesepfad durch', () => {
  it('auch am fremden Brett, wo es kein `eigen` gibt — mit dem Ort', () => {
    const nachsehen = vi.fn();
    render(
      <Hexbrett
        reihen={1}
        spalten={2}
        felder={[null, WACHE]}
        katalog={KATALOG}
        maxStufe={3}
        gespiegelt
        onNachsehen={nachsehen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dorfwache/ }));
    expect(nachsehen).toHaveBeenCalledWith({ bereich: 'brett', platz: 1 });
    // Die leere Wabe bleibt am fremden Brett, was sie war: kein Ziel, kein Knopf.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('auf der eigenen Bank, sobald sie nicht mehr aktiv ist', () => {
    const nachsehen = vi.fn();
    render(
      <Bankreihe
        plaetze={2}
        bank={[WACHE, null]}
        katalog={KATALOG}
        maxStufe={3}
        aktiv={false}
        onWaehlen={vi.fn()}
        onNachsehen={nachsehen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dorfwache/ }));
    expect(nachsehen).toHaveBeenCalledWith({ bereich: 'bank', platz: 0 });
  });
});

describe('Die Masse der Figur kommen von der Figur', () => {
  /*
   * Wabe und Bankfach bemassen ihren Figurenausschnitt seit dem 22.09.2026
   * nicht mehr mit festen Prozentzahlen im Stylesheet, sondern mit Variablen,
   * die `EinheitenFigur` mitbringt (gerechnet in bildfolge.ts). Der Grund ist
   * in bildfolge.test.ts ausgeschrieben; hier wird nur geprueft, dass sie
   * wirklich ankommen — ohne sie hat die Figur gar keine Hoehe.
   */
  it('setzt Hoehe und Boden als Variablen an den Ausschnitt', () => {
    const { container } = render(
      <Einheitenmarke
        kaempfer={WACHE}
        katalog={KATALOG}
        maxStufe={3}
        fehlt={0}
        aktiv={false}
        onWaehlen={vi.fn()}
      />,
    );
    const figur = container.querySelector('.tr-figur3d') as HTMLElement;
    expect(figur.style.getPropertyValue('--tr-wabenkasten-hoehe')).toBe(
      `${WABENKASTEN.hoehe}%`,
    );
    expect(figur.style.getPropertyValue('--tr-wabenkasten-boden')).toBe(
      `${WABENKASTEN.boden}%`,
    );
    /* Beide Paare an jeder Figur, nicht das passende: Wo sie steht, entscheidet
       ihre Klasse, und die Regel `.tr-bankplatz .tr-figur3d` greift sich davon
       ihr eigenes. Verzweigte das Bauteil hier nach dem Ort, stuende die
       Zuordnung Klasse -> Ort ein zweites Mal da. */
    expect(figur.style.getPropertyValue('--tr-bankkasten-hoehe')).toBe(`${BANKKASTEN.hoehe}%`);
    expect(figur.style.getPropertyValue('--tr-bankkasten-boden')).toBe(`${BANKKASTEN.boden}%`);
  });
});
