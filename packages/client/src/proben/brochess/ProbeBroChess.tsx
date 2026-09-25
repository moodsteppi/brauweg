import { useState } from 'react';

import { Brett, statusText } from '../../minispiele/brochess/Brett';
import stil from '../../minispiele/brochess/BroChess.module.css';
import type { BroChessSicht, BroChessZug } from '../../minispiele/brochess/sicht';

/**
 * Probe unter `/probe/brochess`: das ECHTE Brett mit festen Stellungen, ohne
 * Server und ohne Anmeldung.
 *
 * Die Zuege sind von Hand aus dem Regelkern abgeschrieben und bewusst nur
 * eine Handvoll — der Client kennt keine Schachregel und soll hier auch
 * keine lernen. Ein Klick auf einen Zug fuehrt ihn nicht aus, sondern zeigt,
 * was an den Server ginge. Die Stellungen bleiben dafuer stehen, wie sie
 * sind: Hier sieht man Aussehen und Bedienung an, nicht die Partie.
 */

/** Figurenteil einer FEN → 64 Felder, a1 zuerst (wie `brett` in der Sicht). */
function brettAus(figuren: string): string[] {
  const brett: string[] = Array.from({ length: 64 }, () => '');
  figuren.split('/').forEach((reihe, i) => {
    let linie = 0;
    for (const zeichen of reihe) {
      if (/\d/.test(zeichen)) linie += Number(zeichen);
      else brett[(7 - i) * 8 + linie++] = zeichen;
    }
  });
  return brett;
}

const z = (von: string, nach: string, umwandlung?: BroChessZug['umwandlung']): BroChessZug => ({
  type: 'zug',
  von,
  nach,
  ...(umwandlung ? { umwandlung } : {}),
});

interface Fall {
  titel: string;
  sicht: BroChessSicht;
  zuege: BroChessZug[];
}

const GRUND = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

const FAELLE: Fall[] = [
  {
    titel: 'Grundstellung, Weiß am Zug',
    sicht: {
      zuschauer: false,
      fen: `${GRUND} w KQkq - 0 1`,
      brett: brettAus(GRUND),
      amZug: 'w',
      meineFarbe: 'w',
      weissSitz: 0,
      schach: false,
      letzterZug: null,
      ende: null,
    },
    zuege: [
      ...'abcdefgh'.split('').flatMap((l) => [z(`${l}2`, `${l}3`), z(`${l}2`, `${l}4`)]),
      z('b1', 'a3'),
      z('b1', 'c3'),
      z('g1', 'f3'),
      z('g1', 'h3'),
    ],
  },
  {
    titel: 'Schach — Schwarz spielt, Blick von unten',
    sicht: {
      zuschauer: false,
      fen: 'rnbqkbnr/ppp2ppp/3p4/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3',
      brett: brettAus('rnbqkbnr/ppp2ppp/3p4/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR'),
      amZug: 'b',
      meineFarbe: 'b',
      weissSitz: 1,
      schach: true,
      letzterZug: { von: 'f1', nach: 'b5' },
      ende: null,
    },
    zuege: [z('c7', 'c6'), z('b8', 'c6'), z('b8', 'd7'), z('c8', 'd7'), z('d8', 'd7'), z('e8', 'e7')],
  },
  {
    titel: 'Umwandlung',
    sicht: {
      zuschauer: false,
      fen: '8/1P4k1/8/8/8/8/6K1/8 w - - 0 1',
      brett: brettAus('8/1P4k1/8/8/8/8/6K1/8'),
      amZug: 'w',
      meineFarbe: 'w',
      weissSitz: 0,
      schach: false,
      letzterZug: null,
      ende: null,
    },
    zuege: [
      z('b7', 'b8', 'q'),
      z('b7', 'b8', 'r'),
      z('b7', 'b8', 'b'),
      z('b7', 'b8', 'n'),
      z('g2', 'f1'),
      z('g2', 'g1'),
      z('g2', 'h1'),
      z('g2', 'f2'),
      z('g2', 'h2'),
      z('g2', 'f3'),
      z('g2', 'g3'),
      z('g2', 'h3'),
    ],
  },
  {
    titel: 'Matt (Narrenmatt)',
    sicht: {
      zuschauer: false,
      fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      brett: brettAus('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR'),
      amZug: 'w',
      meineFarbe: 'w',
      weissSitz: 0,
      schach: true,
      letzterZug: { von: 'd8', nach: 'h4' },
      ende: { ausgang: 'matt', sieger: 1 },
    },
    zuege: [],
  },
  {
    titel: 'Patt',
    sicht: {
      zuschauer: false,
      fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
      brett: brettAus('7k/5Q2/6K1/8/8/8/8/8'),
      amZug: 'b',
      meineFarbe: 'w',
      weissSitz: 0,
      schach: false,
      letzterZug: { von: 'f5', nach: 'f7' },
      ende: { ausgang: 'patt', sieger: null },
    },
    zuege: [],
  },
];

export function ProbeBroChess(): React.JSX.Element {
  const [nummer, setNummer] = useState(0);
  const [gesendet, setGesendet] = useState<string | null>(null);
  const fall = FAELLE[nummer] ?? FAELLE[0]!;
  const status = statusText(fall.sicht, (f) => (f === 'w' ? 'Anna' : 'Bert'));

  return (
    <div className={stil.seite}>
      <header className={stil.kopf}>
        <h1>BroChess — Probe</h1>
        <select
          value={nummer}
          onChange={(e) => {
            setNummer(Number(e.target.value));
            setGesendet(null);
          }}
        >
          {FAELLE.map((f, i) => (
            <option key={f.titel} value={i}>
              {f.titel}
            </option>
          ))}
        </select>
      </header>
      <Brett
        sicht={fall.sicht}
        zuege={fall.zuege}
        onZug={(zug) => setGesendet(`${zug.von}–${zug.nach}${zug.umwandlung ? ` = ${zug.umwandlung}` : ''}`)}
      />
      <p
        className={`${stil.status} ${
          status.art === 'schach' ? stil.statusSchach : status.art === 'ende' ? stil.statusEnde : ''
        }`}
      >
        {status.text}
      </p>
      <p className="muted">{gesendet ? `Ginge an den Server: ${gesendet}` : 'Figur antippen, dann Ziel.'}</p>
    </div>
  );
}
