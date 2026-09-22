import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Einladung im Partykiste-Wartesaal (22.09.2026).
 *
 * Geprueft wird die Verdrahtung: dass der Code des EIGENEN wartenden Tisches
 * erscheint und nicht der einer fremden, laufenden Partie; dass Link und
 * QR-Code dazu passen; und dass „Link teilen" ohne `navigator.share` auf die
 * Zwischenablage zurueckfaellt — der Normalfall am Desktop und in manchem
 * WebView, und genau dort sieht es sonst aus, als taete der Knopf nichts.
 */

const { me, tischMitCode } = vi.hoisted(() => ({ me: vi.fn(), tischMitCode: vi.fn() }));

vi.mock('../../api', () => ({ api: { me, tischMitCode } }));

import { Einladung } from './Einladung';
import { qrMatrix, qrPfad } from './qr';

const TISCH = '11111111-2222-3333-4444-555555555555';

function wartet(gameId = 'partykiste', status = 'waiting'): void {
  me.mockResolvedValue({ activeTable: { tableId: TISCH, gameId, status } });
  tischMitCode.mockResolvedValue({
    table: { id: TISCH, gameId, status, joinCode: 'K7X9MQ' },
  });
}

const echtesTeilen = Object.getOwnPropertyDescriptor(navigator, 'share');
const echteAblage = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function setzeNavigator(name: 'share' | 'clipboard', wert: unknown): void {
  Object.defineProperty(navigator, name, { value: wert, configurable: true, writable: true });
}

beforeEach(() => {
  me.mockReset();
  tischMitCode.mockReset();
});

afterEach(() => {
  for (const [name, alt] of [
    ['share', echtesTeilen],
    ['clipboard', echteAblage],
  ] as const) {
    if (alt) Object.defineProperty(navigator, name, alt);
    else delete (navigator as unknown as Record<string, unknown>)[name];
  }
});

describe('Einladung', () => {
  it('zeigt den Code gross und den Link darunter', async () => {
    wartet();
    render(<Einladung spiel="partykiste" />);
    expect(await screen.findByText('K7X9MQ')).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/beitritt/K7X9MQ`)).toBeInTheDocument();
    expect(tischMitCode).toHaveBeenCalledWith(TISCH);
  });

  it('liest den Code zum Vorlesen Zeichen fuer Zeichen vor', async () => {
    wartet();
    render(<Einladung spiel="partykiste" />);
    expect(await screen.findByLabelText('Beitrittscode K 7 X 9 M Q')).toBeInTheDocument();
  });

  it('zeichnet den QR-Code als SVG im Browser, nicht als geholtes Bild', async () => {
    wartet();
    const { container } = render(<Einladung spiel="partykiste" />);
    const qr = await screen.findByRole('img', { name: 'QR-Code des Einladungslinks' });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    // Genau der Link darunter steckt im Code — und `qrMatrix` selbst ist in
    // qr.test.ts gegen die Referenz `qrcode@1.5.4` gehalten.
    expect(qr.querySelector('path')?.getAttribute('d')).toBe(
      qrPfad(qrMatrix(`${window.location.origin}/beitritt/K7X9MQ`)),
    );
    // Die Inhaltsrichtlinie liesse ein fremdes Bild ohnehin nicht zu.
    expect(container.querySelector('img')).toBeNull();
  });

  it('faellt ohne navigator.share auf die Zwischenablage zurueck und sagt es', async () => {
    wartet();
    setzeNavigator('share', undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setzeNavigator('clipboard', { writeText });
    render(<Einladung spiel="partykiste" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Link teilen' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/beitritt/K7X9MQ`),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Link kopiert');
  });

  it('meldet es, wenn es auch keine Zwischenablage gibt — der Link steht dann als Text da', async () => {
    wartet();
    setzeNavigator('share', undefined);
    setzeNavigator('clipboard', undefined);
    render(<Einladung spiel="partykiste" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Link teilen' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Kopieren ging nicht');
  });

  it('teilt ueber das Geraet, wenn es das kann, mit Titel, Text und Adresse', async () => {
    wartet();
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    setzeNavigator('share', share);
    setzeNavigator('clipboard', { writeText });
    render(<Einladung spiel="partykiste" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Link teilen' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0]![0]).toMatchObject({
      url: `${window.location.origin}/beitritt/K7X9MQ`,
      text: expect.stringContaining('K7X9MQ'),
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('kopiert nicht, wenn jemand das Teilen abbricht', async () => {
    wartet();
    setzeNavigator('share', vi.fn().mockRejectedValue(new DOMException('weg', 'AbortError')));
    const writeText = vi.fn();
    setzeNavigator('clipboard', { writeText });
    render(<Einladung spiel="partykiste" />);
    // Erst suchen, dann in `act` klicken: Innerhalb von `act` haelt React das
    // Nachzeichnen zurueck, und `findByRole` wartete dort auf einen Knopf,
    // der erst nach dem `act` erscheint.
    const knopf = await screen.findByRole('button', { name: 'Link teilen' });
    await act(async () => {
      fireEvent.click(knopf);
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('zeigt nichts, wenn der aktive Tisch eine laufende Partie eines anderen Spiels ist', async () => {
    wartet('doppelkopf', 'running');
    const { container } = render(<Einladung spiel="partykiste" />);
    await waitFor(() => expect(me).toHaveBeenCalled());
    await act(async () => {});
    expect(tischMitCode).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
