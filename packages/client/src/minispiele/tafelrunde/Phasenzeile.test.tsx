import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Phasenzeile.
 *
 * Der wichtigste Fall steht ganz unten und ist ein NEGATIVER: In der
 * Platzierungsphase darf keine Restzeit stehen. Es gibt dort keine — das
 * Modul beendet die Phase, wenn der Letzte bereit ist, nicht nach Zeit (siehe
 * Kopf von Phasenzeile.tsx). Eine Zahl an dieser Stelle waere eine erfundene
 * Auskunft, und die faellt niemandem auf, bis sie beim naechsten Kauf wieder
 * hochspringt.
 */

import { Phasenzeile, phasenName, restsekunden, uhrText } from './Phasenzeile';

afterEach(() => {
  vi.useRealTimers();
});

describe('phasenName', () => {
  it('nennt jede Phase mit einem Wort, das sagt, was zu tun ist', () => {
    expect(phasenName('vorbereitung')).toBe('Platzierungsphase');
    expect(phasenName('kampf')).toBe('Kampfphase');
    expect(phasenName('ende')).toBe('Partie vorbei');
  });
});

describe('restsekunden', () => {
  it('rechnet die Frist gegen die Uhr und rundet auf', () => {
    // Aufgerundet, damit die Anzeige nicht bei 0 haengt, waehrend noch eine
    // halbe Sekunde laeuft.
    expect(restsekunden(10_500, 10_000)).toBe(1);
    expect(restsekunden(22_000, 10_000)).toBe(12);
  });

  it('wird nicht negativ — eine ueberzogene Frist ist um, nicht rueckwaerts', () => {
    expect(restsekunden(9_000, 10_000)).toBe(0);
  });

  it('gibt ohne Frist null zurueck', () => {
    expect(restsekunden(null, 10_000)).toBeNull();
  });
});

describe('uhrText', () => {
  it('schreibt Sekunden zweistellig und Minuten nur, wenn es welche gibt', () => {
    expect(uhrText(7)).toBe('0:07');
    expect(uhrText(45)).toBe('0:45');
    expect(uhrText(75)).toBe('1:15');
  });
});

describe('Phasenzeile', () => {
  it('nennt Runde und Phase im Klartext', () => {
    render(<Phasenzeile runde={3} phase="kampf" frist={null} bereit={0} offen={4} />);
    expect(screen.getByText('Runde 3')).toBeInTheDocument();
    expect(screen.getByText('Kampfphase')).toBeInTheDocument();
  });

  it('zaehlt die Schaupause herunter, solange eine Frist steht', () => {
    // `interludeDeadline` der Plattform: eine echte Frist, sie steht ab
    // Beginn der Pause fest.
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    render(<Phasenzeile runde={3} phase="kampf" frist={112_000} bereit={0} offen={4} />);
    expect(screen.getByText('0:12')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText('0:07')).toBeInTheDocument();
  });

  it('sagt die Restzeit auch als Satz — die Ziffern selbst sind stumm', () => {
    /* Eine Zahl, die viermal je Sekunde vorgelesen wird, ist Laerm; ohne
       jeden Text waere sie fuer ein Vorlesegeraet gar nicht da. */
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    render(<Phasenzeile runde={1} phase="kampf" frist={109_000} bereit={0} offen={2} />);
    expect(screen.getByText('Noch 9 Sekunden in dieser Phase')).toBeInTheDocument();
  });

  it('zeigt in der Platzierungsphase KEINE Uhr, sondern wer schon bereit ist', () => {
    render(<Phasenzeile runde={2} phase="vorbereitung" frist={null} bereit={1} offen={4} />);
    expect(screen.getByText('1 von 4 bereit')).toBeInTheDocument();
    expect(screen.queryByText(/Sekunden/)).toBeNull();
  });

  it('schweigt am Ende der Partie — dort ist nichts mehr zu zaehlen', () => {
    render(<Phasenzeile runde={9} phase="ende" frist={null} bereit={0} offen={0} />);
    expect(screen.getByText('Partie vorbei')).toBeInTheDocument();
    expect(screen.queryByText(/bereit/)).toBeNull();
  });
});
