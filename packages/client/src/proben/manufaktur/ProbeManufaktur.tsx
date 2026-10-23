import { useState } from 'react';

import {
  type Aktion,
  type ManufakturStand,
  MAX_PRESSEN,
  handle,
  neuePresse,
  neuerStand,
  vorspulen,
} from '@brauweg/manufaktur-kern';

import { Kartenmanufaktur } from '../../manufaktur/Kartenmanufaktur';
import type { Leitung } from '../../manufaktur/steuerung';
import '../../screens/hub-neu.css';

/**
 * Probe unter `/probe/manufaktur?fall=neu|mitte|voll`: die ECHTE
 * Kartenmanufaktur mit festen Staenden, ohne Server und ohne Anmeldung — auch
 * im Browser, obwohl es das Spiel sonst nur in der App gibt.
 *
 * Der „Server" hier rechnet mit demselben Kern wie der echte, nur im
 * Speicher: Tippen, Ausbauen und Meister gehen also wirklich. Gedacht fuer
 * Bildschirmgroessen, gelieferte Bilder und Rig-Teile (Debug-Ansicht im
 * Manufaktur-Blatt), ohne erst eine Stunde spielen zu muessen.
 */

function mitMeister<T extends { meister: boolean }>(s: T): T {
  return { ...s, meister: true };
}

function fall(name: string, jetzt: number): ManufakturStand {
  const stand = neuerStand(jetzt);
  if (name === 'mitte') {
    // Vier Etagen, der Paternoster kommt nicht nach: Kisten voll, Engpass am Schacht.
    stand.taler = 4_800;
    stand.verdient = 90_000;
    stand.pressen = [45, 32, 18, 6].map((stufe, i) => ({ ...neuePresse(), stufe, meister: i < 2, kiste: 4_000 * (i + 1) }));
    stand.paternoster = mitMeister({ ...stand.paternoster, stufe: 12 });
    stand.versand = mitMeister({ ...stand.versand, stufe: 40 });
    stand.packtisch = 900;
  }
  if (name === 'voll') {
    stand.manufaktur = 2;
    stand.taler = 3.4e9;
    stand.verdient = 9e9;
    stand.pressen = Array.from({ length: MAX_PRESSEN }, (_, i) => mitMeister({ ...neuePresse(), stufe: 110 - i * 12 }));
    stand.paternoster = mitMeister({ ...stand.paternoster, stufe: 150 });
    stand.versand = mitMeister({ ...stand.versand, stufe: 140 });
  }
  return stand;
}

function nachgestellterServer(start: ManufakturStand): Leitung {
  let stand = start;
  const antwort = () => ({ stand, zeit: Date.now(), offline: null, muenzen: 0 });
  return {
    laden: async () => {
      stand = vorspulen(stand, Date.now());
      return antwort();
    },
    senden: async (aktion: Aktion) => {
      stand = handle(stand, aktion, Date.now()).stand;
      return antwort();
    },
  };
}

export function ProbeManufaktur(): React.JSX.Element {
  // Einmal je Seite: Ein neuer Server bei jedem Zeichnen setzte den Stand zurueck.
  const [leitung] = useState(() => {
    const name = new URLSearchParams(window.location.search).get('fall') ?? 'neu';
    return nachgestellterServer(fall(name, Date.now()));
  });
  return (
    <div className="hb">
      <Kartenmanufaktur
        onClose={() => window.history.back()}
        onGeaendert={() => undefined}
        getragen={{ hut: 'hut-wollmuetze' }}
        leitung={leitung}
      />
    </div>
  );
}
