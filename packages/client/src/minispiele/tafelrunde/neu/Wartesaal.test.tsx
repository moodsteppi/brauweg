import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { friends } = vi.hoisted(() => ({
  friends: vi.fn(() => Promise.resolve({ friends: [{ id: 'f1', displayName: 'Tom' }] })),
}));

vi.mock('../../../api', () => ({
  ApiError: class ApiError extends Error {},
  api: { friends, tischEinladen: vi.fn(() => Promise.resolve({ status: 'benachrichtigt' })) },
}));

import { WartesaalSeite, teileLink } from './Wartesaal';

/*
 * Der Wartesaal: Code, Link teilen (Teilen-Blatt, sonst Zwischenablage),
 * Einladen ueber das Blatt der Tischschicht, Plaetze mit Bild, Bot-Stufe und
 * Start mit derselben Sperre wie im alten Saal.
 */

const SITZE = [
  { seat: 0, displayName: 'Robin', accountId: 'r', avatarUrl: null, isBot: false },
  { seat: 1, displayName: null, accountId: null, avatarUrl: null, isBot: false },
];

function saal(teil: Partial<Parameters<typeof WartesaalSeite>[0]> = {}) {
  const onStart = vi.fn();
  render(
    <WartesaalSeite
      tischId="t1"
      wartesaal={{ code: 'KX7M9Q', gastgeber: true, botsFuellen: false }}
      sitze={SITZE}
      botStufe="standard"
      botStufen={[{ id: 'standard', name: 'Normal' }]}
      onBotStufe={() => {}}
      onBotsFuellen={() => {}}
      onStart={onStart}
      onAbbrechen={() => {}}
      {...teil}
    />,
  );
  return { onStart };
}

describe('Wartesaal', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
  });

  it('zeigt Code und Plaetze; ohne Bots braucht der Start zwei Menschen', () => {
    saal();
    expect(screen.getByRole('button', { name: 'Beitrittscode KX7M9Q' })).toBeInTheDocument();
    expect(screen.getByText('Robin')).toBeInTheDocument();
    expect(screen.getByText('Freier Platz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Partie starten' })).toBeDisabled();
  });

  it('mit Bots darf der Gastgeber sofort starten', () => {
    const { onStart } = saal({ wartesaal: { code: 'KX7M9Q', gastgeber: true, botsFuellen: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    expect(onStart).toHaveBeenCalled();
  });

  it('Einladen oeffnet das Blatt der Tischschicht mit den Freunden', async () => {
    saal();
    fireEvent.click(screen.getByRole('button', { name: 'Freunde einladen' }));
    expect(await screen.findByText('Tom')).toBeInTheDocument();
    expect(friends).toHaveBeenCalled();
  });

  it('Link teilen: Teilen-Blatt, wenn es eins gibt', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    expect(await teileLink('https://x/?tisch=KX7M9Q', 'Tafelrunde')).toBe('geteilt');
    expect(share).toHaveBeenCalledWith({ title: 'Tafelrunde', url: 'https://x/?tisch=KX7M9Q' });
  });

  it('Link teilen: abgebrochen heisst nichts tun, ohne Teilen-Blatt wird kopiert', async () => {
    Object.defineProperty(navigator, 'share', {
      value: () => Promise.reject(new DOMException('weg', 'AbortError')),
      configurable: true,
    });
    expect(await teileLink('u', 't')).toBe('nichts');
    Reflect.deleteProperty(navigator, 'share');
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await teileLink('u', 't')).toBe('kopiert');
    expect(writeText).toHaveBeenCalledWith('u');
  });

  it('der Knopf sagt, dass kopiert wurde', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
    saal();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Link teilen' }));
    });
    expect(screen.getByRole('button', { name: 'Link kopiert' })).toBeInTheDocument();
  });

  it('Gaeste sehen keine Einstellungen und keinen Startknopf', () => {
    saal({ wartesaal: { code: null, gastgeber: false, botsFuellen: false } });
    expect(screen.queryByRole('button', { name: 'Partie starten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    // Einladen geht auch ohne Code: Es braucht nur den Tisch.
    expect(screen.getByRole('button', { name: 'Freunde einladen' })).toBeInTheDocument();
  });
});
