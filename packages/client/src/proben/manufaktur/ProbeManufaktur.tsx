import { useState } from 'react';

import {
  type Aktion,
  type FaehigkeitArt,
  type ManufakturStand,
  type Rang,
  besetze,
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
 * Probe unter `/probe/manufaktur?fall=neu|mitte|voll|palast`: die ECHTE
 * Kartenmanufaktur mit festen Staenden, ohne Server und ohne Anmeldung — auch
 * im Browser, obwohl es das Spiel sonst nur in der App gibt.
 *
 * Der „Server" hier rechnet mit demselben Kern wie der echte, nur im
 * Speicher: Tippen, Ausbauen und Meister gehen also wirklich. Gedacht fuer
 * Bildschirmgroessen, gelieferte Bilder und Rig-Teile (Debug-Ansicht im
 * Manufaktur-Blatt), ohne erst eine Stunde spielen zu muessen.
 */

type Karte = [Rang, FaehigkeitArt];

/**
 * Meister-Pools fuer die Probe: je Station Karten (Rang, Faehigkeit), die
 * erste ist zugewiesen. So sieht man Rang-Kleidung, Ringe und Pools, ohne
 * erst einzustellen.
 */
function mitPools(stand: ManufakturStand, pools: Record<string, Karte[]>): ManufakturStand {
  for (const [slot, karten] of Object.entries(pools)) {
    const pool = karten.map(([rang, art]) => {
      const id = stand.naechsteMeisterId;
      stand.naechsteMeisterId += 1;
      return { id, rang, art, preis: 100, faehigkeitBis: 0, abklingenBis: 0 };
    });
    stand.belegschaft[slot] = { pool, zugewiesen: pool[0]?.id ?? null, eingestellt: pool.length };
  }
  besetze(stand);
  return stand;
}

function fall(name: string, jetzt: number): ManufakturStand {
  const stand = neuerStand(jetzt, 1, { zufall: 4711 });
  if (name === 'mitte') {
    // Vier Etagen, der Paternoster kommt nicht nach: Kisten voll, Engpass am Schacht.
    stand.taler = 4_800;
    stand.verdient = 90_000;
    stand.pressen = [45, 32, 18, 6].map((stufe, i) => ({ ...neuePresse(), stufe, kiste: 4_000 * (i + 1) }));
    stand.paternoster = { ...stand.paternoster, stufe: 12 };
    stand.versand = { ...stand.versand, stufe: 40 };
    stand.packtisch = 900;
    mitPools(stand, {
      'presse-0': [['jung', 'tempo'], ['jung', 'rabatt']],
      'presse-1': [['meister', 'tempo']],
      paternoster: [['ober', 'ladung'], ['jung', 'tempo'], ['jung', 'rabatt']],
      versand: [['jung', 'tempo'], ['jung', 'rabatt'], ['meister', 'ladung']],
    });
  }
  if (name === 'palast') {
    // Kartenpalast mit allen acht Pressen: Das Jubilaeum ist bereit.
    stand.manufaktur = 5;
    stand.jubilaeen = 2;
    stand.taler = 4e12;
    stand.pressen = Array.from({ length: MAX_PRESSEN }, (_, i) => ({ ...neuePresse(), stufe: 90 - i * 10 }));
    stand.paternoster = { ...stand.paternoster, stufe: 140 };
    stand.versand = { ...stand.versand, stufe: 130 };
    mitPools(stand, {
      ...Object.fromEntries(stand.pressen.map((_, i): [string, Karte[]] => [`presse-${i}`, [[(['jung', 'meister', 'ober'] as const)[i % 3], 'tempo']]])),
      paternoster: [['ober', 'ladung']],
      versand: [['meister', 'tempo']],
    });
  }
  if (name === 'voll') {
    stand.manufaktur = 2;
    stand.taler = 3.4e9;
    stand.verdient = 9e9;
    stand.pressen = Array.from({ length: MAX_PRESSEN }, (_, i) => ({ ...neuePresse(), stufe: 110 - i * 12 }));
    stand.paternoster = { ...stand.paternoster, stufe: 150 };
    stand.versand = { ...stand.versand, stufe: 140 };
    mitPools(stand, {
      ...Object.fromEntries(stand.pressen.map((_, i): [string, Karte[]] => [`presse-${i}`, [['meister', 'tempo']]])),
      paternoster: [['meister', 'ladung']],
      versand: [['meister', 'ladung']],
    });
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
    senden: async (aktion: Aktion, bei: number) => {
      stand = handle(stand, aktion, bei).stand;
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
