import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Auswahl im Menue der Partykiste (22.09.2026).
 *
 * Geprueft wird, was am Tisch ankommt — der Regelsatz, den der Bildschirm
 * als `config` schickt —, nicht die Kacheln um ihrer selbst willen. Drei
 * Dinge verlangt die Karte ausdruecklich: Die Auswahl schreibt die `config`,
 * „derb“ ist fuer einen Gast gesperrt, und die Wahl bleibt (auch ueber ein
 * Neuladen hinweg). Bis zum 27.09.2026 stand hier „die Reihenfolge bleibt“ —
 * seitdem mischt das Modul, und die Minispiele sind nur noch an oder aus.
 * Dazu der Modus: unsichtbar, solange das Modul ihn nicht kennt.
 *
 * Die Vorgabe hier ist ein fester Regelsatz und nicht der des Moduls — ob der
 * erzeugte Regelsatz auch am echten `validateConfig` vorbeikommt, prueft der
 * Vertrag (src/vertrag/partykiste-auswahl.test.ts).
 */

const defaults = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ api: { defaults } }));

import { PartyAuswahl, usePartyAuswahl, type PartyAuswahlStand } from './Auswahl';
import { SCHLUESSEL_MINISPIELE } from './wahl';

const ALLE = ['imposter', 'quiz', 'werbinich', 'niemals', 'wereher', 'busfahrer', 'schaetzen', 'entweder', 'wahrheitpflicht'];
const VORGABE = { minispiele: ALLE, trinkmodus: true, schluckFaktor: 1, inhaltsHaerte: 1, paket: null };
const BASIS = { minispiele: ['quiz'], trinkmodus: false, schluckFaktor: 2 };

let stand: PartyAuswahlStand | null = null;

function Probe({ gast = false, neu = false }: { gast?: boolean; neu?: boolean }): React.JSX.Element {
  const a = usePartyAuswahl(gast);
  stand = a;
  return <PartyAuswahl vorgabe={a.vorgabe} wahl={a.wahl} gast={a.gast} trinkmodus onWahl={a.setWahl} neu={neu} />;
}

async function aufbauen(
  gast = false,
  vorgabe: Record<string, unknown> = VORGABE,
  neu = false,
): Promise<ReturnType<typeof render>> {
  defaults.mockResolvedValue({ config: vorgabe, protocolVersion: 1, seatCounts: [4], rounds: {} });
  const ansicht = render(<Probe gast={gast} neu={neu} />);
  await screen.findByRole('group', { name: 'Minispiele' });
  return ansicht;
}

const raster = (name: string): HTMLElement => screen.getByRole('group', { name });
const kachel = (gruppe: string, name: string): HTMLElement =>
  within(raster(gruppe)).getByRole('button', { name });

async function config(): Promise<Record<string, unknown>> {
  let ergebnis: Record<string, unknown> = {};
  await act(async () => {
    ergebnis = await stand!.regelsatz(BASIS);
  });
  return ergebnis;
}

describe('Auswahl im Menue der Partykiste', () => {
  beforeEach(() => {
    localStorage.clear();
    defaults.mockReset();
    stand = null;
  });

  it('wer nichts waehlt, schickt die Vorgabe des Moduls — alle Minispiele, nichts gemerkt', async () => {
    await aufbauen();
    expect(within(raster('Minispiele')).getAllByRole('button')).toHaveLength(ALLE.length);
    const c = await config();
    expect(c['minispiele']).toEqual(ALLE);
    expect(c).toMatchObject({ trinkmodus: false, schluckFaktor: 2, inhaltsHaerte: 1, paket: null });
    // Kein Modus, solange das Modul keinen kennt — weder im Menue noch in der config.
    expect(screen.queryByRole('group', { name: 'Modus' })).toBeNull();
    expect('modus' in c).toBe(false);
    expect(localStorage.getItem(SCHLUESSEL_MINISPIELE)).toBeNull();
  });

  it('die Auswahl schreibt die config: Minispiele, Inhaltsstufe, Themenpaket', async () => {
    await aufbauen();
    fireEvent.click(kachel('Minispiele', 'Allgemeinwissen'));
    fireEvent.click(kachel('Inhalte', 'pikant'));
    fireEvent.click(kachel('Themenpaket', 'JGA'));

    const c = await config();
    expect(c['minispiele']).toEqual(ALLE.filter((id) => id !== 'quiz'));
    expect(c['inhaltsHaerte']).toBe(2);
    expect(c['paket']).toBe('jga');

    // Zurueck auf „alles“ heisst paket: null — nicht die Kennung „alles“.
    fireEvent.click(kachel('Themenpaket', 'alles'));
    expect((await config())['paket']).toBeNull();
  });

  it('die Inhaltsstufe heisst nicht „Härte“ — das ist der Schluck-Regler', async () => {
    await aufbauen();
    expect(screen.getByRole('group', { name: 'Inhalte' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Härte/ })).toBeNull();
  });

  it('„derb“ ist fuer einen Gast gesperrt und nennt den Grund', async () => {
    await aufbauen(true);
    const derb = kachel('Inhalte', 'derb');
    expect(derb).toHaveAttribute('aria-disabled', 'true');
    expect(derb).toHaveAccessibleDescription(/nur mit Konto/);
    fireEvent.click(derb);
    expect(derb).toHaveAttribute('aria-pressed', 'false');
    expect((await config())['inhaltsHaerte']).toBe(1);
  });

  it('eine gemerkte 3 wird fuer einen Gast als „pikant“ angezeigt und geschickt', async () => {
    localStorage.setItem('partykiste.inhaltsHaerte', '3');
    await aufbauen(true);
    expect(kachel('Inhalte', 'pikant')).toHaveAttribute('aria-pressed', 'true');
    expect((await config())['inhaltsHaerte']).toBe(2);
  });

  it('mit Konto ist „derb“ waehlbar', async () => {
    await aufbauen(false);
    fireEvent.click(kachel('Inhalte', 'derb'));
    expect((await config())['inhaltsHaerte']).toBe(3);
  });

  /*
   * Bis zum 27.09.2026: „die Reihenfolge bleibt: wie angetippt, verschoben“.
   * Seitdem mischt das Modul (`minispielFolge`), und die Wahl ist eine Menge —
   * in der Reihenfolge des Moduls, egal in welcher angetippt wurde.
   */
  it('an und aus: die Wahl ist eine Menge in Modulreihenfolge und bleibt nach dem Neuladen', async () => {
    const ansicht = await aufbauen();
    // Alles ausser drei abwaehlen, dann in anderer Reihenfolge wieder dazu.
    for (const name of ['Imposter', 'Allgemeinwissen', 'Wer bin ich?', 'Ich hab noch nie', 'Wer würde eher?', 'Bus fahren']) {
      fireEvent.click(kachel('Minispiele', name));
    }
    fireEvent.click(kachel('Minispiele', 'Bus fahren'));
    fireEvent.click(kachel('Minispiele', 'Imposter'));
    const erwartet = ['imposter', 'busfahrer', 'schaetzen', 'entweder', 'wahrheitpflicht'];
    expect((await config())['minispiele']).toEqual(erwartet);
    expect(kachel('Minispiele', 'Imposter')).toHaveAttribute('aria-pressed', 'true');
    expect(kachel('Minispiele', 'Allgemeinwissen')).toHaveAttribute('aria-pressed', 'false');
    // Keine Reihenfolge mehr: weder Liste noch Hoch/Runter.
    expect(screen.queryByRole('list', { name: /Reihenfolge/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /früher|später/ })).toBeNull();
    expect(screen.getByText(/gemischt dran, keins zweimal hintereinander/)).toBeInTheDocument();

    ansicht.unmount();
    await aufbauen();
    expect((await config())['minispiele']).toEqual(erwartet);
  });

  it('alle wieder an, in anderer Reihenfolge angetippt: nichts gemerkt', async () => {
    await aufbauen();
    fireEvent.click(kachel('Minispiele', 'Imposter'));
    fireEvent.click(kachel('Minispiele', 'Allgemeinwissen'));
    fireEvent.click(kachel('Minispiele', 'Allgemeinwissen'));
    fireEvent.click(kachel('Minispiele', 'Imposter'));
    expect((await config())['minispiele']).toEqual(ALLE);
    expect(localStorage.getItem(SCHLUESSEL_MINISPIELE)).toBeNull();
  });

  it('im neuen Hub: Regelkacheln mit Haken, „Alle an“ nur, wenn nicht alle an sind', async () => {
    const { container } = await aufbauen(false, VORGABE, true);
    const kacheln = within(raster('Minispiele')).getAllByRole('button');
    expect(kacheln).toHaveLength(ALLE.length);
    // Dieselben Kacheln wie die Doppelkopf-Regeln, an heisst Rahmen UND Haken.
    expect(kacheln.every((k) => k.classList.contains('regel') && k.classList.contains('is-on'))).toBe(true);
    expect(container.querySelectorAll('.regel-check')).toHaveLength(ALLE.length);
    expect(screen.queryByRole('button', { name: 'Alle an' })).toBeNull();

    fireEvent.click(kachel('Minispiele', 'Allgemeinwissen'));
    expect(kachel('Minispiele', 'Allgemeinwissen')).toHaveAttribute('aria-pressed', 'false');
    expect(kachel('Minispiele', 'Allgemeinwissen')).not.toHaveClass('is-on');
    expect((await config())['minispiele']).toEqual(ALLE.filter((id) => id !== 'quiz'));
    expect(screen.getByText(/gemischt dran, keins zweimal hintereinander/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Alle an' }));
    expect((await config())['minispiele']).toEqual(ALLE);
    expect(screen.queryByRole('button', { name: 'Alle an' })).toBeNull();
  });

  it('im neuen Hub bleibt unter drei die Kachel an, ein Hinweis sagt warum', async () => {
    localStorage.setItem(SCHLUESSEL_MINISPIELE, JSON.stringify(['quiz', 'imposter', 'entweder']));
    await aufbauen(false, VORGABE, true);
    fireEvent.click(kachel('Minispiele', 'Allgemeinwissen'));
    expect(kachel('Minispiele', 'Allgemeinwissen')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/Mindestens 3/);
    expect((await config())['minispiele']).toEqual(['quiz', 'imposter', 'entweder']);
  });

  it('unter drei Minispiele geht es nicht — die Kachel bleibt an, ein Hinweis sagt warum', async () => {
    localStorage.setItem(SCHLUESSEL_MINISPIELE, JSON.stringify(['quiz', 'imposter', 'entweder']));
    await aufbauen();
    fireEvent.click(kachel('Minispiele', 'Allgemeinwissen'));
    expect(kachel('Minispiele', 'Allgemeinwissen')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/Mindestens 3/);
    expect((await config())['minispiele']).toEqual(['quiz', 'imposter', 'entweder']);
  });

  it('ein gemerktes Minispiel, das das Modul nicht mehr kennt, faellt weg statt den Tisch zu brechen', async () => {
    localStorage.setItem(SCHLUESSEL_MINISPIELE, JSON.stringify(['quiz', 'werwolf', 'imposter', 'entweder']));
    await aufbauen();
    expect((await config())['minispiele']).toEqual(['quiz', 'imposter', 'entweder']);
  });

  it('„Alle an“ setzt auf die Vorgabe zurueck und vergisst die Wahl', async () => {
    await aufbauen();
    fireEvent.click(kachel('Minispiele', 'Allgemeinwissen'));
    expect(localStorage.getItem(SCHLUESSEL_MINISPIELE)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Alle an' }));
    expect((await config())['minispiele']).toEqual(ALLE);
    expect(localStorage.getItem(SCHLUESSEL_MINISPIELE)).toBeNull();
  });

  it('kennt das Modul einen Modus, erscheinen die Kacheln und die Wahl geht mit', async () => {
    await aufbauen(false, { ...VORGABE, modus: 'turnier' });
    await waitFor(() => expect(raster('Modus')).toBeInTheDocument());
    expect(kachel('Modus', 'Turnier')).toHaveAttribute('aria-pressed', 'true');
    expect((await config())['modus']).toBe('turnier');
    fireEvent.click(kachel('Modus', 'Team'));
    expect((await config())['modus']).toBe('team');
  });

  it('solange die Vorgabe fehlt, steht keine erfundene Liste da', () => {
    defaults.mockReturnValue(new Promise(() => {}));
    render(<Probe />);
    expect(screen.getByText(/werden geladen/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Minispiele' })).toBeNull();
  });
});
