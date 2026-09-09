import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Punkt an der Tab-Leiste: "hier hinten liegt etwas fuer dich".
 *
 * An der Truhe ist er selbsterklaerend, am Profil-Reiter ist er das
 * Gegenteil: Er zeigt auf die Geburtstagsbelohnung, und die gibt es an genau
 * einem Tag im Jahr. Wer den Reiter an diesem Tag nicht von sich aus
 * aufmacht, erfaehrt nie von seinem Geschenk und hat die naechste
 * Gelegenheit ein Jahr spaeter. Faellt der Punkt bei einem Umbau weg, faellt
 * sichtbar nichts aus — deshalb steht er hier als Probe.
 *
 * Eigene Datei und kein Anhang an `Profil.test.tsx`: Sobald ein Testfall den
 * Profil-Tab OEFFNET, laedt der Bildschirm sein Profilstueck nach, und
 * dessen 3D-Vorladen scheitert unter jsdom (three liest `/3d/…glb` mit
 * `fetch`, Node nimmt keine Adresse ohne Wurzel). Der Fehlschlag trifft dann
 * den naechsten Testfall derselben Datei. Hier wird nichts geoeffnet — es
 * geht um die Leiste, nicht um den Inhalt dahinter.
 */

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      // Beiwerk des Startbildschirms — die Tab-Leiste braucht davon nichts,
      // aber ohne Antwort haengen die Effekte in unbehandelten Rejections.
      aktiveGesamt: () => Promise.resolve({ aktiv: 0 }),
      games: () => Promise.resolve([]),
      friends: () => Promise.resolve({ friends: [], incoming: [], outgoing: [] }),
    },
  };
});

import type { Me } from '../api';
import { GameSelect } from './GameSelect';
import { probeKonto as konto } from './probe-konto';

/**
 * Rendert den Startbildschirm.
 *
 * Einmal leerlaufen lassen: Kopfleiste und Spielliste holen beim Aufbau, und
 * ohne dieses Abwarten kommen ihre Antworten erst NACH dem Test an — React
 * meldet das als "not wrapped in act".
 */
async function zeigeStart(me: Me): Promise<void> {
  render(
    <GameSelect
      me={me}
      onPick={vi.fn()}
      onSolo={vi.fn()}
      onResume={vi.fn()}
      onThemeChange={vi.fn()}
      onAvatarChange={vi.fn()}
      onShowProfile={vi.fn()}
      onSignOut={vi.fn()}
      onDeleted={vi.fn()}
    />,
  );
  await act(async () => {});
}

/**
 * Der Reiter, der ins Profil fuehrt.
 *
 * Gesucht wird mit dem Anfang des Namens und nicht wortgleich: Traegt der
 * Reiter einen Punkt, haengt dessen Vorlesetext am Namen des Knopfes — ein
 * `name: 'Profil'` traefe genau in dem Fall nicht mehr, um den es hier geht.
 */
function profilReiter(): HTMLElement {
  return screen.getByRole('button', { name: /^Profil/ });
}

describe('Punkt am Profil-Reiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setzt einen Punkt, sobald die Geburtstagsbelohnung bereitliegt', async () => {
    await zeigeStart(
      konto({ daysUntilBirthday: 0, birthdayToday: true, birthdayRewardClaimable: true }),
    );

    expect(profilReiter().querySelector('.hub-punkt')).not.toBeNull();
  });

  it('laesst den Reiter blank, wenn nichts abzuholen ist', async () => {
    // Auch am Geburtstag selbst: Wer sein Outfit schon geholt hat, soll nicht
    // den Rest des Tages einen Punkt sehen, hinter dem nichts mehr liegt.
    await zeigeStart(
      konto({
        daysUntilBirthday: 0,
        birthdayToday: true,
        birthdayRewardClaimable: false,
        hasBirthdayOutfit: true,
      }),
    );

    expect(profilReiter().querySelector('.hub-punkt')).toBeNull();
  });

  it('sagt einem Vorlesegeraet, was der Punkt bedeutet', async () => {
    // Ein Punkt ohne Text ist fuer ein Vorlesegeraet nicht vorhanden — und
    // damit bliebe das Geschenk fuer blinde Spieler weiter unauffindbar.
    await zeigeStart(konto({ birthdayToday: true, birthdayRewardClaimable: true }));

    expect(profilReiter()).toHaveAccessibleName(/Geschenk liegt bereit/);
  });

  it('haengt den Punkt an genau einen Reiter', async () => {
    await zeigeStart(konto({ birthdayToday: true, birthdayRewardClaimable: true }));

    expect(document.querySelectorAll('.front-tabs .hub-punkt')).toHaveLength(1);
  });
});
