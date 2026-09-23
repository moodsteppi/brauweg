import { golf } from '@brauweg/game-golf';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Zusatzpakete in der Auswahl (22.09.2026, Robins Entscheidung S3).
 *
 * Was kostet, entscheidet der Server — geprueft wird hier nur, dass die
 * Auswahl seine Antwort richtig liest: gesperrt ist genau, was der Shop als
 * nicht besessen fuer DIESES Spiel meldet; die gesperrte Kachel traegt Preis
 * und Weg in den Shop und laesst sich nicht waehlen; ohne Shop ist nichts
 * gesperrt. Dass der Server einen Tisch ohne Besitz ablehnt, steht in
 * packages/server/test/inhaltspakete.test.ts.
 */

const shop = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({ api: { shop } }));

import type { RegalWare } from './api';
import { t } from './i18n';
import { SHOP_RUBRIK, sperrenAus, sperrgrund, tischFehler, useInhaltsSperren } from './inhaltspakete';
import { Bahnauswahl } from './minispiele/golf/Bahnauswahl';
import { liesLobbydaten } from './minispiele/golf/bahnwahl';
import { KARTEN } from './minispiele/golf/karten';
import { PartyAuswahl } from './minispiele/partykiste/Auswahl';
import { KEINE_WAHL } from './minispiele/partykiste/wahl';

function ware(teil: Partial<RegalWare> & Pick<RegalWare, 'id' | 'wert'>): RegalWare {
  return {
    art: 'inhaltspaket',
    nameKey: teil.id,
    seltenheit: 'selten',
    preis: { coins: 800, gems: 54 },
    besessen: false,
    ...teil,
  };
}

const REGAL: RegalWare[] = [
  ware({ id: 'golf-kurs-profi', wert: 'profi', preis: { coins: 1200, gems: 80 }, inhalt: { spiel: 'golf', feld: 'kurs' } }),
  ware({ id: 'golf-kurs-flipperhalle', wert: 'flipperhalle', besessen: true, inhalt: { spiel: 'golf', feld: 'kurs' } }),
  ware({ id: 'party-paket-jga', wert: 'jga', inhalt: { spiel: 'partykiste', feld: 'paket' } }),
  // Andere Ware mit demselben Wert darf nichts sperren.
  { id: 'szene-profi', art: 'szene', wert: 'profi', nameKey: 'szene.profi', seltenheit: 'selten', preis: { coins: 1, gems: 1 }, besessen: false },
];

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  shop.mockReset();
});

describe('Sperren aus dem Shop', () => {
  it('sperrt nur nicht Besessenes dieses Spiels, nach Feld und Wert', () => {
    const golfSperren = sperrenAus(REGAL, 'golf');
    expect([...golfSperren.keys()]).toEqual(['kurs:profi']);
    expect([...sperrenAus(REGAL, 'partykiste').keys()]).toEqual(['paket:jga']);
    expect(sperrenAus(null, 'golf').size).toBe(0);
  });

  it('der Grund nennt den Preis und wohin es geht', () => {
    const grund = sperrgrund({ preis: { coins: 1200, gems: 80 } });
    expect(grund).toContain('1200 Münzen');
    expect(grund).toContain('Im Shop ansehen');
    expect(grund).toContain(SHOP_RUBRIK);
  });

  it('eine fehlende Paketabsage bekommt den Text aus dem Wörterbuch, alles andere den alten Satz', () => {
    const absage = { code: 'inhaltspaketFehlt', messageKey: 'error.inhaltspaketFehlt', status: 403 };
    expect(tischFehler(absage, 'sonst')).toBe(t('error.inhaltspaketFehlt'));
    expect(t('error.inhaltspaketFehlt')).not.toBe('error.inhaltspaketFehlt');
    expect(tischFehler(new Error('weg'), 'sonst')).toBe('sonst');
    expect(tischFehler(null, 'sonst')).toBe('sonst');
  });
});

function GolfProbe({ onWahl }: { onWahl: (w: unknown) => void }): React.JSX.Element {
  const sperre = useInhaltsSperren('golf');
  return (
    <Bahnauswahl
      daten={liesLobbydaten(JSON.parse(JSON.stringify(golf.lobbyDaten!())))}
      wahl={{ art: 'kurs', kurs: 'anfaengerrunde' }}
      onWahl={onWahl}
      karten={KARTEN}
      kursSperre={(k) => sperre('kurs', k)}
    />
  );
}

describe('Golf: gesperrter Kurs in der Auswahl', () => {
  it('Profi ist gesperrt, mit Preis — antippen wählt nichts; Flipperhalle gehört und geht', async () => {
    shop.mockResolvedValue({ tischware: REGAL });
    const onWahl = vi.fn();
    render(<GolfProbe onWahl={onWahl} />);
    await durchatmen();

    const raster = screen.getByRole('group', { name: 'Kurs' });
    const profi = within(raster).getByRole('button', { name: 'Profi' });
    expect(profi.getAttribute('aria-disabled')).toBe('true');
    expect(profi.textContent).toContain('1200 Münzen');
    fireEvent.click(profi);
    expect(onWahl).not.toHaveBeenCalled();

    const flipper = within(raster).getByRole('button', { name: 'Flipperhalle' });
    expect(flipper.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(flipper);
    expect(onWahl).toHaveBeenCalledWith({ art: 'kurs', kurs: 'flipperhalle' });
    expect(document.querySelector('[data-golf-kurssperre]')).not.toBeNull();
  });

  it('ohne Shop ist nichts gesperrt — der Server bleibt die Sperre', async () => {
    shop.mockRejectedValue(new Error('weg'));
    const onWahl = vi.fn();
    render(<GolfProbe onWahl={onWahl} />);
    await durchatmen();
    const profi = within(screen.getByRole('group', { name: 'Kurs' })).getByRole('button', { name: 'Profi' });
    expect(profi.getAttribute('aria-disabled')).toBeNull();
    expect(document.querySelector('[data-golf-kurssperre]')).toBeNull();
  });
});

function PartyProbe({ onWahl }: { onWahl: (w: unknown) => void }): React.JSX.Element {
  const sperre = useInhaltsSperren('partykiste');
  return (
    <PartyAuswahl
      vorgabe={null}
      wahl={KEINE_WAHL}
      gast={false}
      trinkmodus={false}
      onWahl={onWahl}
      paketSperre={(p) => sperre('paket', p)}
    />
  );
}

describe('Partykiste: gesperrtes Themenpaket in der Auswahl', () => {
  it('JGA ist gesperrt, die freien Pakete nicht', async () => {
    shop.mockResolvedValue({ tischware: REGAL });
    const onWahl = vi.fn();
    render(<PartyProbe onWahl={onWahl} />);
    await durchatmen();

    const raster = screen.getByRole('group', { name: 'Themenpaket' });
    const jga = within(raster).getByRole('button', { name: 'JGA' });
    expect(jga.getAttribute('aria-disabled')).toBe('true');
    expect(jga.textContent).toContain('Im Shop ansehen');
    fireEvent.click(jga);
    expect(onWahl).not.toHaveBeenCalled();

    for (const frei of ['WG-Abend', 'Studenten', 'Arbeit', 'Weihnachten']) {
      expect(within(raster).getByRole('button', { name: frei }).getAttribute('aria-disabled')).toBeNull();
    }
    fireEvent.click(within(raster).getByRole('button', { name: 'WG-Abend' }));
    expect(onWahl).toHaveBeenCalledWith(expect.objectContaining({ paket: 'wg-abend' }));
    expect(document.querySelector('[data-pk-paketsperre]')).not.toBeNull();
  });
});
