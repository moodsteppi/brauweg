import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { tippText } from './LernTipp';

/*
 * Der Satz am Uebungstisch (LernTipp.tsx) — aus der Sicht gelesen, nicht
 * nachgerechnet: Ob man bedienen muss, steht in der Zahl der erlaubten Karten.
 */

const text = (lage: Parameters<typeof tippText>[0]): string => render(<>{tippText(lage)}</>).container.textContent ?? '';

const BASIS = {
  phase: 'playing',
  amZug: true,
  vorbehaltGefragt: false,
  erlaubt: 12,
  handGroesse: 12,
  stichLeer: false,
  partei: null,
} as const;

describe('tippText', () => {
  it('beim Vorbehalt: gesund', () => {
    expect(text({ ...BASIS, phase: 'vorbehalt', vorbehaltGefragt: true })).toContain('„gesund"');
  });

  it('weniger erlaubte Karten als auf der Hand: bedienen', () => {
    expect(text({ ...BASIS, erlaubt: 3 })).toContain('Bedienen!');
  });

  it('beim Ausspielen und beim Warten', () => {
    expect(text({ ...BASIS, stichLeer: true, partei: 're' })).toContain('Du spielst aus.');
    expect(text({ ...BASIS, stichLeer: true, partei: 're' })).toContain('Re');
    expect(text({ ...BASIS, amZug: false })).toContain('Die anderen sind dran');
  });

  it('ausserhalb des Spiels nichts', () => {
    expect(tippText({ ...BASIS, phase: 'ende' })).toBeNull();
  });
});
