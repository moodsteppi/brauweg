import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Start nach dem Umbau vom 28.11.2026 (docs/STARTSEITE-UMBAU-PLAN.md):
 * Seitensymbole mit Zahl, Quick-Play mit Such-Blatt und Zahnrad, das Schild
 * „Zu den Spielen", die beiden Weiterspielen-Pop-ups samt Verlassen und die
 * Sperre von Quick-Play und Bock an einem laufenden Tisch.
 *
 * Der Server dazu entsteht parallel; geprüft wird gegen die Schnittstelle in
 * api.ts, die `api` ist hier nachgebaut.
 */

const a = vi.hoisted(() => ({
  konto: { me: null as unknown },
  me: vi.fn(),
  aktiveGesamt: vi.fn(),
  schnellspielStarten: vi.fn(),
  schnellspielKandidaten: vi.fn(),
  schnellspielAuswahl: vi.fn(),
  sucheStand: vi.fn(),
  sucheAbbrechen: vi.fn(),
  leaveTable: vi.fn(),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      me: a.me,
      aktiveGesamt: a.aktiveGesamt,
      schnellspielStarten: a.schnellspielStarten,
      schnellspielKandidaten: a.schnellspielKandidaten,
      schnellspielAuswahl: a.schnellspielAuswahl,
      sucheStand: a.sucheStand,
      sucheAbbrechen: a.sucheAbbrechen,
      leaveTable: a.leaveTable,
      games: () => Promise.resolve([]),
    },
  };
});

import { ApiError, type ActiveTable, type Me } from '../api';
import { GameSelect } from './GameSelect';
import { probeKonto } from './probe-konto';
import { seitenwechsel } from './StartAblauf';

const LAEUFT: ActiveTable = { tableId: 't1', gameId: 'doppelkopf', status: 'running', paused: false, visibility: 'public', maxRounds: 8, seats: 4 };
const WARTET: ActiveTable = { ...LAEUFT, tableId: 't2', status: 'waiting' };

const SUCHE = {
  sucht: true,
  suchende: 2,
  restMs: 24000,
  tischId: null,
  wartende: [
    { id: 'a1', name: 'Robin', bildUrl: null },
    { id: 'x1', name: 'Kiebitz', bildUrl: null },
  ],
};

async function zeige(
  konto: Partial<Me> = {},
  mehr: { frisch?: Partial<Me>; onBock?: () => void } = {},
): Promise<{ onResume: ReturnType<typeof vi.fn>; onAvatarChange: ReturnType<typeof vi.fn> }> {
  const me = probeKonto({ bereit: { truhen: 1, aufgaben: 2 }, ...konto });
  // `/api/me` liefert, was der Server jetzt weiß — ohne Angabe dasselbe Konto.
  a.me.mockResolvedValue({ ...me, ...mehr.frisch });
  const onResume = vi.fn();
  const onAvatarChange = vi.fn();
  render(
    <GameSelect
      me={me}
      onPick={vi.fn()}
      onSolo={vi.fn()}
      onResume={onResume}
      onThemeChange={vi.fn()}
      onAvatarChange={onAvatarChange}
      onShowProfile={vi.fn()}
      onSignOut={vi.fn()}
      onDeleted={vi.fn()}
      onBock={mehr.onBock}
    />,
  );
  await act(async () => {});
  return { onResume, onAvatarChange };
}

const reiter = (): HTMLElement => screen.getByRole('navigation', { name: 'Bereiche' });
const knopf = (name: string | RegExp): HTMLElement => screen.getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  a.aktiveGesamt.mockResolvedValue({ aktiv: 5 });
  a.sucheAbbrechen.mockResolvedValue({ ok: true });
  a.leaveTable.mockResolvedValue({ ok: true });
  a.schnellspielAuswahl.mockResolvedValue({ schnellspiel: null });
  a.schnellspielKandidaten.mockResolvedValue({
    kandidaten: [
      { id: 'doppelkopf', art: 'tisch', wartende: 3 },
      { id: 'skat', art: 'tisch', wartende: 0 },
      { id: 'tanks-online', art: 'arena', wartende: 1 },
    ],
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Start: Kopf, Symbole, Mosaik', () => {
  it('zeigt keine Online-Zeile mehr und fragt die Zahl auch nicht mehr ab', async () => {
    await zeige();
    expect(screen.queryByText(/gerade am Tisch/)).toBeNull();
    expect(a.aktiveGesamt).not.toHaveBeenCalled();
  });

  // Seit dem 28.11.2026 abends breite Knöpfe über dem Mosaik statt Seitensymbole
  // (Robin); Rolle, Namen und Zahl sind dieselben geblieben.
  it('trägt Aufgaben und Truhen als Knöpfe über dem Mosaik mit roter Zahl, die Zahl steht im Namen', async () => {
    await zeige();
    const leiste = screen.getByRole('region', { name: 'Aufgaben und Belohnungen' });
    const aufgaben = within(leiste).getByRole('button', { name: 'Tagesaufgaben, 2 bereit' });
    const truhen = within(leiste).getByRole('button', { name: 'Belohnungen, 1 bereit' });
    expect(aufgaben.querySelector('.start-symbol-zahl')).toHaveTextContent('2');
    expect(truhen.querySelector('.start-symbol-zahl')).toHaveTextContent('1');
    // Wie bisher die Kacheln: dasselbe Blatt „Heute" (Truhen öffnet am Truhenabschnitt, HubNeu.test.tsx).
    fireEvent.click(truhen);
    expect(await screen.findByRole('dialog', { name: /^Heute/ })).toBeInTheDocument();
  });

  it('lässt die Marke weg, wenn nichts bereitliegt', async () => {
    await zeige({ bereit: { truhen: 0, aufgaben: 0 } });
    expect(knopf('Tagesaufgaben').querySelector('.start-symbol-zahl')).toBeNull();
    expect(knopf('Belohnungen').querySelector('.start-symbol-zahl')).toBeNull();
  });

  it('wischt mit dem Schild „Zu den Spielen" auf den Spiele-Reiter', async () => {
    await zeige();
    fireEvent.click(knopf('Zu den Spielen'));
    await act(async () => {});
    expect(within(reiter()).getByRole('button', { name: 'Spiele' })).toHaveAttribute('aria-current', 'page');
  });

  it('hat Weiterspielen-Karte und „Deine Spiele" nicht mehr auf dem Start', async () => {
    await zeige({ stats: [{ gameId: 'skat', trophies: 40, parties: 3, wins: 1 }] });
    const start = document.querySelector('.hb-start')!;
    expect(within(start as HTMLElement).queryByText('Deine Spiele')).toBeNull();
    expect(start.querySelector('.hb-weiter')).toBeNull();
  });

  it('zeigt den Bock ohne Verdrahtung ehrlich als „Bald" und ruft ihn mit Verdrahtung auf', async () => {
    await zeige();
    fireEvent.click(knopf('BroweG-Bock: mehrere Spiele, ein Sieger'));
    expect(await screen.findByRole('dialog', { name: /BroweG-Bock/ })).toBeInTheDocument();
    cleanup();
    const onBock = vi.fn();
    await zeige({}, { onBock });
    expect(screen.queryByText('Bald')).toBeNull();
    fireEvent.click(knopf('BroweG-Bock: mehrere Spiele, ein Sieger'));
    expect(onBock).toHaveBeenCalled();
  });
});

describe('Quick-Play', () => {
  it('setzt an einen wartenden Tisch und geht direkt dorthin', async () => {
    a.schnellspielStarten.mockResolvedValue({ art: 'tisch', gameId: 'skat', tableId: 't9' });
    const { onResume } = await zeige();
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    await act(async () => {});
    expect(a.schnellspielStarten).toHaveBeenCalledWith();
    expect(onResume).toHaveBeenCalledWith('skat', 't9');
  });

  it('öffnet bei einer Suche das Such-Blatt und geht an den Tisch, sobald er steht', async () => {
    vi.useFakeTimers();
    a.schnellspielStarten.mockResolvedValue({ art: 'suche', gameId: 'doppelkopf', stand: SUCHE });
    a.sucheStand.mockResolvedValueOnce({ ...SUCHE, restMs: 23000 }).mockResolvedValue({ ...SUCHE, restMs: 22000, tischId: 't7' });
    const { onResume } = await zeige();
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    await act(async () => {});
    const blatt = screen.getByRole('dialog', { name: 'Quick-Play: Doppelkopf' });
    expect(within(blatt).getByText('Suche Mitspieler …')).toBeInTheDocument();
    expect(within(blatt).getByRole('timer')).toHaveTextContent('0:24');
    // Man selbst heißt „Du", die anderen mit Namen.
    expect(within(blatt).getByText('Du')).toBeInTheDocument();
    expect(within(blatt).getByText('Kiebitz')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(a.sucheStand).toHaveBeenCalledWith('doppelkopf');
    expect(onResume).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onResume).toHaveBeenCalledWith('doppelkopf', 't7');
    expect(screen.queryByRole('dialog', { name: 'Quick-Play: Doppelkopf' })).toBeNull();
  });

  it('bricht die Suche am Server ab, wenn man das Blatt schließt', async () => {
    a.schnellspielStarten.mockResolvedValue({ art: 'suche', gameId: 'skat', stand: SUCHE });
    a.sucheStand.mockResolvedValue(SUCHE);
    await zeige();
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    await act(async () => {});
    fireEvent.click(knopf('Suche abbrechen'));
    expect(a.sucheAbbrechen).toHaveBeenCalledWith('skat');
    expect(screen.queryByRole('dialog', { name: 'Quick-Play: Skat' })).toBeNull();
  });

  it('öffnet eine Arena mit der Bitte, dort sofort zu suchen', async () => {
    const zu = vi.spyOn(seitenwechsel, 'zu').mockImplementation(() => undefined);
    a.schnellspielStarten.mockResolvedValue({ art: 'arena', arena: 'tanks-online' });
    await zeige();
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    await act(async () => {});
    expect(zu).toHaveBeenCalledWith('/tanks-online?schnell=1');
    zu.mockRestore();
  });

  it('sagt freundlich, wenn für die Auswahl kein Spiel frei ist, und wo man das ändert', async () => {
    // Der echte Code aus server/src/schnellspiel.ts (badRequest), nicht eine
    // geratene Statuszahl — so stand es bis zum Zusammenführen hier.
    a.schnellspielStarten.mockRejectedValue(new ApiError('schnellspielKeinSpiel', 'error.schnellspielKeinSpiel', 400));
    await zeige();
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent(/Nimm im Zahnrad mehr Spiele dazu/);
  });

  it('sagt beim laufenden Tisch, den das Gerät noch nicht kannte, erst zurück an den Tisch', async () => {
    a.schnellspielStarten.mockRejectedValue(new ApiError('schnellspielLaufenderTisch', 'error.schnellspielLaufenderTisch', 409));
    await zeige();
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent(/laufenden Tisch/);
  });

  it('sagt bei einem anderen Fehler, dass es gleich noch mal geht', async () => {
    a.schnellspielStarten.mockRejectedValue(new Error('weg'));
    await zeige();
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent(/Versuch es gleich noch mal/);
  });
});

describe('Quick-Play: Zahnrad', () => {
  it('löst mit dem Zahnrad nicht die Kachel aus und zeigt alle Kandidaten an', async () => {
    await zeige();
    fireEvent.click(knopf('Quick-Play einstellen'));
    await act(async () => {});
    expect(a.schnellspielStarten).not.toHaveBeenCalled();
    const blatt = screen.getByRole('dialog', { name: 'Quick-Play-Spiele' });
    const schalter = within(blatt).getAllByRole('switch');
    expect(schalter.map((s) => s.textContent)).toEqual(['Doppelkopf3 warten gerade', 'Skat', 'BroTanks Online1 wartet gerade']);
    expect(schalter.every((s) => s.getAttribute('aria-checked') === 'true')).toBe(true);
  });

  it('speichert eine Teilauswahl als Liste und lädt das Konto neu', async () => {
    const { onAvatarChange } = await zeige();
    fireEvent.click(knopf('Quick-Play einstellen'));
    await act(async () => {});
    fireEvent.click(screen.getByRole('switch', { name: /^Skat/ }));
    fireEvent.click(knopf('Speichern'));
    await act(async () => {});
    expect(a.schnellspielAuswahl).toHaveBeenCalledWith(['doppelkopf', 'tanks-online']);
    expect(onAvatarChange).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Quick-Play-Spiele' })).toBeNull();
  });

  it('lässt nicht alles ausschalten und speichert „alle an" als null', async () => {
    await zeige();
    fireEvent.click(knopf('Quick-Play einstellen'));
    await act(async () => {});
    fireEvent.click(knopf('Keine'));
    expect(knopf('Speichern')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Mindestens ein Spiel muss an bleiben.');
    fireEvent.click(knopf('Alle'));
    fireEvent.click(knopf('Speichern'));
    await act(async () => {});
    expect(a.schnellspielAuswahl).toHaveBeenCalledWith(null);
  });

  it('beginnt mit der gespeicherten Auswahl', async () => {
    await zeige({ vorlieben: { favoriten: [], schnellspiel: ['skat'] } });
    fireEvent.click(knopf('Quick-Play einstellen'));
    await act(async () => {});
    const an = screen.getAllByRole('switch').filter((s) => s.getAttribute('aria-checked') === 'true');
    expect(an.map((s) => s.textContent)).toEqual(['Skat']);
  });
});

describe('Weiterspielen', () => {
  it('fragt mit großem Pop-up nach der laufenden Runde — erst nach frischem /api/me', async () => {
    await zeige({ activeTable: LAEUFT });
    expect(a.me).toHaveBeenCalled();
    const frage = screen.getByRole('dialog', { name: 'Du bist noch in einer Runde' });
    expect(within(frage).getByText('Doppelkopf läuft – zurück an den Tisch?')).toBeInTheDocument();
  });

  it('fragt nicht nach einem Spiel, das inzwischen vorbei ist, und lädt das Konto neu', async () => {
    const { onAvatarChange } = await zeige({ activeTable: LAEUFT }, { frisch: { activeTable: null } });
    expect(screen.queryByRole('dialog', { name: 'Du bist noch in einer Runde' })).toBeNull();
    expect(screen.queryByRole('region', { name: /Deine Runde/ })).toBeNull();
    expect(onAvatarChange).toHaveBeenCalled();
  });

  it('nennt einen wartenden Tisch beim Namen', async () => {
    await zeige({ activeTable: WARTET });
    expect(screen.getByRole('dialog', { name: 'Du wartest noch an einem Tisch' })).toBeInTheDocument();
  });

  it('lässt nach „Nein" ein kleines Pop-up stehen, das an den Tisch zurückführt', async () => {
    const { onResume } = await zeige({ activeTable: LAEUFT });
    fireEvent.click(knopf('Nein, später'));
    expect(screen.queryByRole('dialog', { name: 'Du bist noch in einer Runde' })).toBeNull();
    const klein = screen.getByRole('region', { name: 'Deine Runde: Doppelkopf' });
    // Der ganze Streifen ist der Zurück-Knopf (Robin, 28.11.2026), das X
    // steht als eigener Knopf daneben.
    fireEvent.click(within(klein).getByRole('button', { name: 'Doppelkopf: Zurück an den Tisch' }));
    expect(onResume).toHaveBeenCalledWith('doppelkopf', 't1');
  });

  it('verlässt den Tisch erst nach der Rückfrage mit dem Bro — mit Hinweis auf die Strafe', async () => {
    const { onAvatarChange } = await zeige({ activeTable: LAEUFT });
    fireEvent.click(knopf('Nein, später'));
    fireEvent.click(knopf('Tisch verlassen'));
    const frage = screen.getByRole('dialog', { name: 'Tisch verlassen?' });
    expect(frage.querySelector('img[src="/hub/pinguin.png"]')).not.toBeNull();
    expect(within(frage).getByText('Sicher, dass du den Tisch verlassen willst?')).toBeInTheDocument();
    expect(within(frage).getByText(/Du bekommst −10 Trophäen/)).toBeInTheDocument();
    expect(a.leaveTable).not.toHaveBeenCalled();
    fireEvent.click(within(frage).getByRole('button', { name: 'Ja, verlassen' }));
    await act(async () => {});
    expect(a.leaveTable).toHaveBeenCalledWith('t1');
    expect(onAvatarChange).toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: /Deine Runde/ })).toBeNull();
  });

  it('nennt an einem wartenden Tisch keine Strafe, und Abbrechen lässt alles stehen', async () => {
    await zeige({ activeTable: WARTET });
    fireEvent.click(knopf('Nein, später'));
    fireEvent.click(knopf('Tisch verlassen'));
    const frage = screen.getByRole('dialog', { name: 'Tisch verlassen?' });
    expect(within(frage).queryByText(/Trophäen/)).toBeNull();
    fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }));
    expect(a.leaveTable).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Deine Runde: Doppelkopf' })).toBeInTheDocument();
  });

  it('fragt wieder, wenn der Start erneut sichtbar wird — auch beim Wiedereinblenden der App', async () => {
    await zeige({ activeTable: LAEUFT });
    fireEvent.click(knopf('Nein, später'));
    fireEvent.click(within(reiter()).getByRole('button', { name: 'Spiele' }));
    await act(async () => {});
    expect(screen.queryByRole('region', { name: /Deine Runde/ })).toBeNull();
    fireEvent.click(within(reiter()).getByRole('button', { name: /^Start/ }));
    await act(async () => {});
    expect(screen.getByRole('dialog', { name: 'Du bist noch in einer Runde' })).toBeInTheDocument();

    fireEvent.click(knopf('Nein, später'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByRole('dialog', { name: 'Du bist noch in einer Runde' })).toBeInTheDocument();
  });

  it('sperrt Quick-Play und Bock an einem laufenden Tisch und zeigt stattdessen das große Pop-up', async () => {
    const onBock = vi.fn();
    await zeige({ activeTable: LAEUFT }, { onBock });
    fireEvent.click(knopf('Nein, später'));
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    expect(screen.getByRole('dialog', { name: 'Du bist noch in einer Runde' })).toBeInTheDocument();
    expect(a.schnellspielStarten).not.toHaveBeenCalled();
    fireEvent.click(knopf('Nein, später'));
    fireEvent.click(knopf('BroweG-Bock: mehrere Spiele, ein Sieger'));
    expect(screen.getByRole('dialog', { name: 'Du bist noch in einer Runde' })).toBeInTheDocument();
    expect(onBock).not.toHaveBeenCalled();
  });

  it('lässt Quick-Play an einem nur wartenden Tisch zu — den verlässt der Server selbst', async () => {
    a.schnellspielStarten.mockResolvedValue({ art: 'tisch', gameId: 'skat', tableId: 't9' });
    const { onResume } = await zeige({ activeTable: WARTET });
    fireEvent.click(knopf('Nein, später'));
    fireEvent.click(knopf('Quick-Play: sofort in eine Runde'));
    await act(async () => {});
    expect(onResume).toHaveBeenCalledWith('skat', 't9');
  });
});
