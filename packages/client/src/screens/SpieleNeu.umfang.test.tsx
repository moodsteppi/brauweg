import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '../api';
import { imUmfang, setzeUmfang } from '../umfang';

/*
 * Der Umfang der Ausgabe (`UMFANG` im Server, umfang.ts im Client): Was dort
 * fehlt, hat in der Auswahl keinen Einstieg — auch nicht unter „Kommt bald".
 * In der App geprüft, weil dort die Solo-Spiele stehen (`inApp` steht beim
 * Laden von laufzeit.ts fest, daher eine eigene Datei).
 */

vi.mock('../laufzeit', async () => {
  const echt = await vi.importActual<typeof import('../laufzeit')>('../laufzeit');
  return { ...echt, inApp: true };
});

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  const spiel = (id: string, availability: 'playable' | 'preview') => ({
    id,
    nameKey: `game.${id}`,
    availability,
    seatCounts: [2],
    votes: 0,
    abstimmbar: false,
  });
  return {
    ...echt,
    api: {
      ...echt.api,
      games: () => Promise.resolve([spiel('doppelkopf', 'playable'), spiel('wizard', 'preview')]),
    },
  };
});

import { SpieleNeu } from './SpieleNeu';

const me = { stats: [] } as unknown as Me;

function zeige() {
  render(
    <SpieleNeu
      me={me}
      offen={null}
      onOeffne={vi.fn()}
      onPick={vi.fn()}
      onSolo={vi.fn()}
      onBald={vi.fn()}
      onSammlung={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  setzeUmfang(null);
});

describe('Umfang im Client', () => {
  it('ohne Liste (null oder ein Server, der das Feld nicht kennt) ist alles an', () => {
    setzeUmfang(null);
    expect(imUmfang('browort')).toBe(true);
    setzeUmfang(undefined);
    expect(imUmfang('clankrieg')).toBe(true);
    setzeUmfang(['doppelkopf']);
    expect(imUmfang('doppelkopf')).toBe(true);
    expect(imUmfang('browort')).toBe(false);
  });

  it('ohne Umfang stehen Kartenmanufaktur und Browort unter „Allein"', async () => {
    zeige();
    expect(await screen.findByText('Kartenmanufaktur')).toBeTruthy();
    expect(screen.getByText('Browort')).toBeTruthy();
  });

  it('was nicht im Umfang steht, hat keinen Einstieg', async () => {
    setzeUmfang(['doppelkopf', 'browort']);
    zeige();
    expect(await screen.findByText('Browort')).toBeTruthy();
    expect(screen.queryByText('Kartenmanufaktur')).toBeNull();
  });

  it('ohne beide Solo-Spiele fehlt der ganze Abschnitt, ohne Pro-Subway auch unter „Kommt bald"', async () => {
    setzeUmfang(['doppelkopf']);
    zeige();
    const kopf = await screen.findByRole('button', { name: /Kommt bald/ });
    expect(screen.queryByText('Allein')).toBeNull();
    // Gezählt werden das Bald-Spiel und der Mehrkampf — Pro-Subway nicht mehr.
    expect(kopf.textContent).toContain('2');
    fireEvent.click(kopf);
    expect(screen.queryByText('Pro-Subway')).toBeNull();
    // Der Mehrkampf hängt an keinem Umfang und bleibt.
    expect(screen.getByText('Brauweg-Bock')).toBeTruthy();
  });
});
