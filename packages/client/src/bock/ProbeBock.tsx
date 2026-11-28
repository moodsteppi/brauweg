import { useState } from 'react';

import type { bockApi, BockSicht, BockSuchstand } from './api';
import { BockBand } from './BockBand';
import { BockBildschirm } from './BockBildschirm';

/**
 * Probe `/?dev=bock&fall=…` — nur im Dev-Server, ohne Anmeldung und ohne
 * Server: der echte Bock-Bildschirm mit festen Staenden.
 *
 * Faelle: `einstieg`, `suche`, `lobby` (als Gastgeber), `gast` (Lobby als
 * Mitspieler), `zwischenstand`, `station` (Station laeuft, vom Band aus
 * geoeffnet), `ende`, `band` (das Band ueber einem leeren Tisch).
 */

const SITZE: BockSicht['sitze'] = [
  { name: 'Robin', bot: false, verlassen: false, bildUrl: null, punkte: 8, rang: 1 },
  { name: 'Tom', bot: false, verlassen: false, bildUrl: null, punkte: 5.5, rang: 2 },
  { name: 'Niklas', bot: false, verlassen: false, bildUrl: null, punkte: 2, rang: 3 },
  { name: '', bot: true, verlassen: false, bildUrl: null, punkte: 0.5, rang: 4 },
];

const GRUND: BockSicht = {
  id: '00000000-0000-4000-8000-000000000000',
  art: 'freunde',
  code: 'KX7M9Q',
  zustand: 'laeuft',
  gastgeber: true,
  ich: 0,
  sitze: SITZE,
  plan: ['doppelkopf', 'filler', 'dreckbro'],
  kandidaten: [],
  station: 2,
  stationen: [
    {
      nr: 1,
      gameId: 'doppelkopf',
      fertig: true,
      platzierung: [
        { sitz: 0, platz: 1, punkte: 4 },
        { sitz: 1, platz: 2, punkte: 1.5 },
        { sitz: 3, platz: 2, punkte: 1.5 },
        { sitz: 2, platz: 4, punkte: 0 },
      ],
    },
    {
      nr: 2,
      gameId: 'filler',
      fertig: true,
      platzierung: [
        { sitz: 0, platz: 1, punkte: 4 },
        { sitz: 1, platz: 2, punkte: 2 },
        { sitz: 2, platz: 3, punkte: 1 },
        { sitz: 3, platz: 4, punkte: 0 },
      ],
    },
  ],
  tisch: null,
  weiterInMs: 12_000,
  ergebnis: null,
};

function fallSicht(fall: string): BockSicht | null {
  switch (fall) {
    case 'lobby':
    case 'gast':
      return {
        ...GRUND,
        zustand: 'wartet',
        gastgeber: fall === 'lobby',
        ich: fall === 'lobby' ? 0 : 1,
        sitze: SITZE.slice(0, 2).map((s) => ({ ...s, punkte: 0, rang: 1 })),
        plan: ['doppelkopf', null, 'dreckbro'],
        kandidaten: ['skat', 'brobluff', 'dreckbro'],
        station: 0,
        stationen: [],
        weiterInMs: null,
      };
    case 'zwischenstand':
      return GRUND;
    case 'station':
    case 'band':
      return {
        ...GRUND,
        station: 3,
        stationen: [...GRUND.stationen, { nr: 3, gameId: 'dreckbro', fertig: false, platzierung: null }],
        tisch: { tableId: '11111111-0000-4000-8000-000000000000', gameId: 'dreckbro' },
        weiterInMs: null,
      };
    case 'ende':
      return {
        ...GRUND,
        zustand: 'fertig',
        station: 3,
        weiterInMs: null,
        sitze: [
          { ...SITZE[0]!, punkte: 10, rang: 1 },
          { ...SITZE[1]!, punkte: 8.5, rang: 2 },
          { ...SITZE[2]!, punkte: 3, rang: 3 },
          { ...SITZE[3]!, punkte: 2.5, rang: 4 },
        ],
        ergebnis: [
          { sitz: 0, punkte: 10, siege: 2, platz: 1, trophaeen: 9, muenzen: 50 },
          { sitz: 1, punkte: 8.5, siege: 1, platz: 2, trophaeen: 3, muenzen: 25 },
          { sitz: 2, punkte: 3, siege: 0, platz: 3, trophaeen: -3, muenzen: 10 },
          { sitz: 3, punkte: 2.5, siege: 0, platz: 4, trophaeen: -9, muenzen: 0 },
        ],
      };
    default:
      return null;
  }
}

/** Ein Server, der nur festhaelt, was der Fall vorgibt — und Knoepfe nicht wirken laesst. */
function nachgestellt(fall: string): typeof bockApi {
  const sicht = fallSicht(fall);
  const suche: BockSuchstand = { sucht: true, suchende: 2, restMs: 24_000, bockId: null };
  const nie = <T,>(): Promise<T> => new Promise<T>(() => undefined);
  return {
    aktiv: () => Promise.resolve({ bockId: sicht?.id ?? null }),
    erstellen: () => Promise.resolve(fallSicht('lobby')!),
    beitreten: () => Promise.resolve(fallSicht('gast')!),
    stand: () => (sicht ? Promise.resolve(sicht) : nie()),
    planSetzen: () => Promise.resolve(sicht!),
    starten: () => nie(),
    verlassen: () => nie(),
    sucheBetreten: () => Promise.resolve(suche),
    sucheStand: () => Promise.resolve(suche),
    sucheAbbrechen: () => Promise.resolve({ ok: true as const }),
  };
}

export function ProbeBock(): React.JSX.Element {
  const fall = new URLSearchParams(window.location.search).get('fall') ?? 'einstieg';
  const [api] = useState(() => nachgestellt(fall));
  const [suchtSchon] = useState(() => fall === 'suche');
  const sicht = fallSicht(fall);

  if (fall === 'band') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#1d3b2a' }}>
        <BockBand bockId={sicht!.id} api={api} onOeffnen={() => undefined} onVorbei={() => undefined} />
      </div>
    );
  }
  return (
    <ProbeMitSuche api={api} startSuche={suchtSchon} bockId={sicht?.id ?? null} vonTisch={fall === 'station' ? sicht!.tisch!.tableId : null} />
  );
}

/**
 * Der Fall `suche` muss den Suchknopf nicht erst tippen lassen: Ein Klick
 * nach dem Laden, damit das Bildschirmfoto die laufende Suche zeigt.
 */
function ProbeMitSuche({
  api,
  startSuche,
  bockId,
  vonTisch,
}: {
  api: typeof bockApi;
  startSuche: boolean;
  bockId: string | null;
  vonTisch: string | null;
}): React.JSX.Element {
  return (
    <div
      ref={(el) => {
        if (!el || !startSuche || el.dataset.gesucht) return;
        el.dataset.gesucht = 'ja';
        setTimeout(() => (el.querySelector('.spe-fuss .is-gold') as HTMLButtonElement | null)?.click(), 50);
      }}
    >
      <BockBildschirm
        bockId={bockId}
        bekannterTisch={vonTisch}
        api={api}
        onBock={() => undefined}
        onTisch={() => undefined}
        onZurueck={() => window.history.back()}
      />
    </div>
  );
}
