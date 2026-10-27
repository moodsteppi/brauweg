import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * Helle Schirme melden sich der iOS-Huelle über `theme-color` — und geben die
 * Farbe beim Verlassen zurück, sonst bliebe die Statusleiste überall dunkel.
 */

vi.mock('./laufzeit', async () => {
  const echt = await vi.importActual<typeof import('./laufzeit')>('./laufzeit');
  return { ...echt, inApp: true };
});

import { HELLE_KOPFZEILE, HelleKopfzeile } from './kopfzeile';

describe('HelleKopfzeile', () => {
  it('setzt theme-color hell und stellt sie danach zurück', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#1a3f7a';
    document.head.append(meta);

    const { unmount } = render(<HelleKopfzeile />);
    expect(meta.content).toBe(HELLE_KOPFZEILE);
    unmount();
    expect(meta.content).toBe('#1a3f7a');
    meta.remove();
  });
});
