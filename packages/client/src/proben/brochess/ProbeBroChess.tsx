import { useState } from 'react';

import { Brett, ergebnis, statusText } from '../../minispiele/brochess/Brett';
import stil from '../../minispiele/brochess/BroChess.module.css';
import {
  NORMALE_SPIELART,
  REGEL_TEXT,
  type Spielart,
  frischesEreignis,
  meldung,
  wahlHinweis,
} from '../../minispiele/brochess/geheim';
import type { BroChessSicht, BroChessZug, SecretDameSicht } from '../../minispiele/brochess/sicht';
import { SpielartWahl } from '../../minispiele/brochess/ZeitWahl';
import '../../screens/hub-neu.css';
import '../../screens/spiel-einstieg.css';

/**
 * Probe unter `/probe/brochess`: das ECHTE Brett mit festen Stellungen, ohne
 * Server und ohne Anmeldung.
 *
 * Die Zuege sind von Hand aus dem Regelkern abgeschrieben und bewusst nur
 * eine Handvoll — der Client kennt keine Schachregel und soll hier auch
 * keine lernen. Ein Klick auf einen Zug fuehrt ihn nicht aus, sondern zeigt,
 * was an den Server ginge. Die Stellungen bleiben dafuer stehen, wie sie
 * sind: Hier sieht man Aussehen und Bedienung an, nicht die Partie.
 *
 * `?fall=<schluessel>` oeffnet gleich einen Fall — fuer die Sichtprobe, die
 * nicht klicken kann. Seit dem 04.11.2026 gibt es dazu die Faelle von
 * Secret Dame (spielart, figurenwahl, wahl-wartet, aufdecken, war-dame,
 * koenigsschlag); `spielart` zeigt die Wahl vor der Partie statt eines Bretts.
 * Rahmen, Meldung und Fuss sind hier nachgestellt, weil der echte Tisch
 * einen Server braucht — die Bausteine darin (Brett, SpielartWahl, Saetze
 * aus geheim.ts) sind die echten.
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
  schluessel: string;
  titel: string;
  sicht: BroChessSicht;
  zuege: BroChessZug[];
  /** Secret Dame: Felder, die zur Wahl stehen, und die vorgemerkte Figur. */
  wahl?: { felder: string[]; vorgemerkt: string | null };
}

const GRUND = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

/** Was die Probe nicht zeigt: keine Uhr, keine Zugliste, nichts geschlagen. */
const OHNE: Pick<BroChessSicht, 'verlauf' | 'uhr' | 'geschlagen' | 'vorsprung' | 'vorab' | 'secretDame'> = {
  verlauf: [],
  uhr: null,
  geschlagen: { w: [], b: [] },
  vorsprung: 0,
  vorab: {},
  secretDame: null,
};

/** Secret Dame unter Regel A, noch nichts geschehen. */
const SD: SecretDameSicht = {
  regel: 'A',
  wahlLaeuft: false,
  gewaehlt: { w: true, b: true },
  meine: null,
  bekannt: { w: null, b: null },
  ereignisse: [],
};

/** Alle eigenen Figuren ausser dem König in der Grundstellung (Weiss). */
const WAHL_WEISS = [
  ...'abcdefgh'.split('').map((l) => `${l}2`),
  ...['a1', 'b1', 'c1', 'd1', 'f1', 'g1', 'h1'],
];

const FAELLE: Fall[] = [
  {
    schluessel: 'grund',
    titel: 'Grundstellung, Weiß am Zug',
    sicht: {
      ...OHNE,
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
    schluessel: 'schach',
    titel: 'Schach - Schwarz spielt, Blick von unten',
    sicht: {
      ...OHNE,
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
    schluessel: 'umwandlung',
    titel: 'Umwandlung',
    sicht: {
      ...OHNE,
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
    schluessel: 'matt',
    titel: 'Matt (Narrenmatt)',
    sicht: {
      ...OHNE,
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
    schluessel: 'patt',
    titel: 'Patt',
    sicht: {
      ...OHNE,
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
  {
    schluessel: 'figurenwahl',
    titel: 'Secret Dame: eigene Figur wählen',
    sicht: {
      ...OHNE,
      zuschauer: false,
      fen: `${GRUND} w KQkq - 0 1`,
      brett: brettAus(GRUND),
      amZug: 'w',
      meineFarbe: 'w',
      weissSitz: 0,
      schach: false,
      letzterZug: null,
      ende: null,
      secretDame: { ...SD, wahlLaeuft: true, gewaehlt: { w: false, b: true } },
    },
    zuege: [],
    wahl: { felder: WAHL_WEISS, vorgemerkt: 'g1' },
  },
  {
    schluessel: 'wahl-wartet',
    titel: 'Secret Dame: gewählt, Gegner wählt noch',
    sicht: {
      ...OHNE,
      zuschauer: false,
      fen: `${GRUND} w KQkq - 0 1`,
      brett: brettAus(GRUND),
      amZug: 'w',
      meineFarbe: 'w',
      weissSitz: 0,
      schach: false,
      letzterZug: null,
      ende: null,
      secretDame: {
        ...SD,
        wahlLaeuft: true,
        gewaehlt: { w: true, b: false },
        meine: { zustand: 'verdeckt', feld: 'g1', grundfigur: 'n' },
      },
    },
    zuege: [],
  },
  {
    // 1.e4 e5 2.Nf3 Nc6 3.Nf3xf7+ — der Springer zieht wie eine Dame und ist aufgedeckt.
    schluessel: 'aufdecken',
    titel: 'Secret Dame: Gegner deckt auf (Schwarz)',
    sicht: {
      ...OHNE,
      zuschauer: false,
      fen: 'r1bqkbnr/pppp1Npp/2n5/4p3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
      brett: brettAus('r1bqkbnr/pppp1Npp/2n5/4p3/4P3/8/PPPP1PPP/RNBQKB1R'),
      amZug: 'b',
      meineFarbe: 'b',
      weissSitz: 0,
      schach: true,
      letzterZug: { von: 'f3', nach: 'f7' },
      ende: null,
      verlauf: ['e4', 'e5', 'Nf3', 'Nc6', 'Nf3xf7+'],
      geschlagen: { w: [], b: ['p'] },
      vorsprung: 1,
      secretDame: {
        ...SD,
        meine: { zustand: 'verdeckt', feld: 'f8', grundfigur: 'b' },
        bekannt: { w: { zustand: 'aufgedeckt', feld: 'f7', grundfigur: 'n' }, b: null },
        ereignisse: [{ art: 'aufgedeckt', farbe: 'w', feld: 'f7', grundfigur: 'n', halbzug: 5 }],
      },
    },
    zuege: [z('e8', 'f7'), z('f8', 'f7')],
  },
  {
    // 1.e4 d5 2.exd5 — der Bauer auf d5 war die verdeckte Dame von Schwarz.
    schluessel: 'war-dame',
    titel: 'Secret Dame: verdeckte Dame geschlagen',
    sicht: {
      ...OHNE,
      zuschauer: false,
      fen: 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
      brett: brettAus('rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR'),
      amZug: 'b',
      meineFarbe: 'w',
      weissSitz: 0,
      schach: false,
      letzterZug: { von: 'e4', nach: 'd5' },
      ende: null,
      verlauf: ['e4', 'd5', 'exd5'],
      geschlagen: { w: [], b: ['p'] },
      vorsprung: 1,
      secretDame: {
        ...SD,
        meine: { zustand: 'verdeckt', feld: 'b1', grundfigur: 'n' },
        bekannt: { w: null, b: { zustand: 'geschlagen', feld: null, grundfigur: 'p' } },
        ereignisse: [{ art: 'verdecktGeschlagen', farbe: 'b', feld: 'd5', grundfigur: 'p', halbzug: 3 }],
      },
    },
    zuege: [],
  },
  {
    // Regel A: 1.e4 d5 2.Nc3 a6 3.Nb5 Nf6 4.Nb5xe8 — Schwarz sah kein Schach, der König faellt.
    schluessel: 'koenigsschlag',
    titel: 'Secret Dame: Königsschlag (Regel A)',
    sicht: {
      ...OHNE,
      zuschauer: false,
      fen: 'rnbqNb1r/1pp1pppp/p4n2/3p4/4P3/8/PPPP1PPP/R1BQKBNR b KQ - 0 4',
      brett: brettAus('rnbqNb1r/1pp1pppp/p4n2/3p4/4P3/8/PPPP1PPP/R1BQKBNR'),
      amZug: 'b',
      meineFarbe: 'b',
      weissSitz: 1,
      schach: false,
      letzterZug: { von: 'b5', nach: 'e8' },
      ende: { ausgang: 'matt', sieger: 1 },
      verlauf: ['e4', 'd5', 'Nc3', 'a6', 'Nb5', 'Nf6', 'Nb5xe8#'],
      secretDame: {
        ...SD,
        meine: { zustand: 'verdeckt', feld: 'c8', grundfigur: 'b' },
        bekannt: { w: { zustand: 'aufgedeckt', feld: 'e8', grundfigur: 'n' }, b: null },
        ereignisse: [
          { art: 'aufgedeckt', farbe: 'w', feld: 'e8', grundfigur: 'n', halbzug: 7 },
          { art: 'koenigGeschlagen', farbe: 'w', feld: 'e8', halbzug: 7 },
        ],
      },
    },
    zuege: [],
  },
];

/** Kein Brett, sondern die Wahl vor der Partie. */
const SPIELART = 'spielart';

function fallAusAdresse(): string {
  return new URLSearchParams(window.location.search).get('fall') ?? 'grund';
}

export function ProbeBroChess(): React.JSX.Element {
  const [schluessel, setSchluessel] = useState(fallAusAdresse);
  const [gesendet, setGesendet] = useState<string | null>(null);
  const [spielart, setSpielart] = useState<Spielart>({ ...NORMALE_SPIELART, modus: 'secretDame' });
  const fall = FAELLE.find((f) => f.schluessel === schluessel) ?? FAELLE[0]!;
  const [vorgemerkt, setVorgemerkt] = useState<string | null>(fall.wahl?.vorgemerkt ?? null);
  const nameVon = (f: 'w' | 'b'): string => (f === 'w' ? 'Anna' : 'Bert');
  const status = statusText(fall.sicht, nameVon);
  const aus = ergebnis(fall.sicht, nameVon);
  const hinweis = wahlHinweis(fall.sicht, nameVon);
  const frisch = frischesEreignis(fall.sicht);
  const sd = fall.sicht.secretDame;

  return (
    <div className={`spe ${stil.tisch}`}>
      <header className={stil.kopf}>
        <div className={stil.kopfTitel}>
          <h1>BroChess - Probe</h1>
          {sd && schluessel !== SPIELART && (
            <span className={stil.kopfModus}>Secret Dame · {REGEL_TEXT[sd.regel].kurz}</span>
          )}
        </div>
        <select style={{ maxWidth: '45%', marginLeft: 'auto' }}
          value={schluessel}
          onChange={(e) => {
            const neu = e.target.value;
            setSchluessel(neu);
            setGesendet(null);
            setVorgemerkt(FAELLE.find((f) => f.schluessel === neu)?.wahl?.vorgemerkt ?? null);
          }}
        >
          {FAELLE.map((f) => (
            <option key={f.schluessel} value={f.schluessel}>
              {f.titel}
            </option>
          ))}
          <option value={SPIELART}>Secret Dame: Spielart wählen</option>
        </select>
      </header>
      {schluessel === SPIELART ? (
        <div className={stil.probeSpielart}>
          <SpielartWahl wert={spielart} onWahl={setSpielart} />
        </div>
      ) : (
        <>
          <div className={stil.mitte}>
            {frisch && (
              <p
                className={`${stil.meldung} ${
                  frisch.art === 'koenigGeschlagen' || frisch.art === 'verdecktGeschlagen' ? stil.meldungRot : ''
                }`}
                role="status"
              >
                {meldung(frisch, fall.sicht.meineFarbe, nameVon)}
              </p>
            )}
            <Brett
              sicht={fall.sicht}
              zuege={fall.zuege}
              onZug={(zug) => setGesendet(`${zug.von}-${zug.nach}${zug.umwandlung ? ` = ${zug.umwandlung}` : ''}`)}
              wahl={fall.wahl ? { felder: fall.wahl.felder, vorgemerkt, onTipp: setVorgemerkt } : undefined}
            />
          </div>
          <footer className={stil.fuss}>
            {aus ? (
              <div className={`${stil.ergebnis} ${stil[`ergebnis_${aus.art}`] ?? ''}`} role="status">
                <strong>{aus.titel}</strong>
                {aus.grund && <span>{aus.grund}</span>}
              </div>
            ) : (
              <p className={`${stil.status} ${status.art === 'schach' ? stil.statusSchach : ''}`}>
                {hinweis ?? status.text}
              </p>
            )}
            {fall.wahl ? (
              <button
                type="button"
                className="hb-kn is-gold is-haupt is-breit"
                disabled={!vorgemerkt}
                onClick={() => setGesendet(`wahl ${vorgemerkt}`)}
              >
                {vorgemerkt ? `♛︎ Figur auf ${vorgemerkt} als geheime Dame` : 'Erst eine Figur antippen'}
              </button>
            ) : (
              <p className="hb-klein">
                {gesendet ? `Ginge an den Server: ${gesendet}` : 'Figur antippen, dann Ziel.'}
              </p>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
