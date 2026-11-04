import { useState } from 'react';

import { Brett } from '../../minispiele/dreckbro/Brett';
import stil from '../../minispiele/dreckbro/DreckBro.module.css';
import type { DreckBroSicht, DreckBroZug, Pinguin } from '../../minispiele/dreckbro/sicht';
import '../../screens/hub-neu.css';
import '../../screens/spiel-einstieg.css';

/**
 * Probe unter `/probe/dreckbro?fall=…`: das ECHTE Brett mit festen Staenden,
 * ohne Server und ohne Anmeldung — fuer die Sichtprobe und zum Ansehen.
 *
 * Die Zuege sind von Hand aus dem Regelkern abgeschrieben, so wie das Modul
 * sie fuer genau diesen Stand aufzaehlen wuerde. Der Client lernt dabei keine
 * Regel: Ein Zug wird nicht ausgefuehrt, die Probe zeigt nur, was an den
 * Server ginge. Der Fall steht in der Adresse, damit die Sichtprobe ihn ohne
 * Klick erreicht.
 */

const p = (dreck: number, iglu = false): Pinguin => ({ dreck, iglu });

const abwerfen = (...karten: number[]): DreckBroZug[] => karten.map((karte) => ({ type: 'abwerfen', karte }));

interface Fall {
  titel: string;
  sicht: DreckBroSicht;
  zuege: DreckBroZug[];
}

const NAMEN = ['Du', 'Mia', 'Bot 3', 'Ole', 'Bot 5'];

const FAELLE: Record<string, Fall> = {
  anfang: {
    titel: 'Anfang, drei Spieler, du bist dran',
    sicht: {
      zuschauer: false,
      meinSitz: 0,
      sitze: 3,
      amZug: 0,
      pinguine: [
        [p(0), p(0), p(0)],
        [p(0), p(0), p(0)],
        [p(0), p(0), p(0)],
      ],
      hand: [
        { id: 4, art: 'pfuetze' },
        { id: 17, art: 'schlammrutsche' },
        { id: 30, art: 'iglu' },
      ],
      handAnzahl: [3, 3, 3],
      stapel: 45,
      ablage: null,
      letzterZug: null,
      ende: null,
      zuege: 0,
    },
    zuege: [
      { type: 'spielen', karte: 4, eigen: 0 },
      { type: 'spielen', karte: 4, eigen: 1 },
      { type: 'spielen', karte: 4, eigen: 2 },
      { type: 'spielen', karte: 17 },
      { type: 'spielen', karte: 30, eigen: 0 },
      { type: 'spielen', karte: 30, eigen: 1 },
      { type: 'spielen', karte: 30, eigen: 2 },
      ...abwerfen(4, 17, 30),
    ],
  },
  mitte: {
    titel: 'Mitte, vier Spieler, Schneeball und Robbe auf der Hand',
    sicht: {
      zuschauer: false,
      meinSitz: 0,
      sitze: 4,
      amZug: 0,
      pinguine: [
        [p(1), p(0, true), p(2)],
        [p(2), p(2, true), p(1)],
        [p(0), p(1), p(0)],
        [p(2), p(0), p(1, true)],
      ],
      hand: [
        { id: 9, art: 'schneeball' },
        { id: 41, art: 'robbenklau' },
        { id: 50, art: 'tauwetter' },
      ],
      handAnzahl: [3, 3, 3, 3],
      stapel: 21,
      ablage: 'eisregen',
      letzterZug: { sitz: 3, art: 'eisregen' },
      ende: null,
      zuege: 23,
    },
    zuege: [
      { type: 'spielen', karte: 9, ziel: { sitz: 1, pinguin: 0 } },
      { type: 'spielen', karte: 9, ziel: { sitz: 1, pinguin: 2 } },
      { type: 'spielen', karte: 9, ziel: { sitz: 2, pinguin: 1 } },
      { type: 'spielen', karte: 9, ziel: { sitz: 3, pinguin: 0 } },
      { type: 'spielen', karte: 41, eigen: 0, ziel: { sitz: 1, pinguin: 0 } },
      { type: 'spielen', karte: 41, eigen: 0, ziel: { sitz: 3, pinguin: 0 } },
      { type: 'spielen', karte: 50, ziel: { sitz: 1, pinguin: 1 } },
      { type: 'spielen', karte: 50, ziel: { sitz: 3, pinguin: 2 } },
      ...abwerfen(9, 41, 50),
    ],
  },
  fuenf: {
    titel: 'Fünf Spieler, Ole ist dran',
    sicht: {
      zuschauer: false,
      meinSitz: 0,
      sitze: 5,
      amZug: 3,
      pinguine: [
        [p(1), p(1), p(0)],
        [p(0), p(2), p(0)],
        [p(1, true), p(0), p(0)],
        [p(2), p(1), p(2)],
        [p(0), p(0), p(1)],
      ],
      hand: [
        { id: 2, art: 'pfuetze' },
        { id: 13, art: 'iglu' },
        { id: 38, art: 'eisregen' },
      ],
      handAnzahl: [3, 3, 3, 3, 3],
      stapel: 12,
      ablage: 'schneeball',
      letzterZug: { sitz: 2, art: 'schneeball', ziel: { sitz: 1, pinguin: 0 } },
      ende: null,
      zuege: 31,
    },
    zuege: [],
  },
  ende: {
    titel: 'Ende: Mia ist der DreckBro',
    sicht: {
      zuschauer: false,
      meinSitz: 0,
      sitze: 2,
      amZug: null,
      pinguine: [
        [p(2), p(1, true), p(0)],
        [p(2), p(2), p(2)],
      ],
      hand: [
        { id: 6, art: 'pfuetze' },
        { id: 21, art: 'schneeball' },
        { id: 44, art: 'iglu' },
      ],
      handAnzahl: [3, 3],
      stapel: 8,
      ablage: 'pfuetze',
      letzterZug: { sitz: 1, art: 'pfuetze', eigen: 2 },
      ende: { sieger: 1, grund: 'dreckbro' },
      zuege: 26,
    },
    zuege: [],
  },
};

export function ProbeDreckBro(): React.JSX.Element {
  const start = new URLSearchParams(window.location.search).get('fall') ?? 'anfang';
  const [fall, setFall] = useState(start in FAELLE ? start : 'anfang');
  const [gesendet, setGesendet] = useState<string | null>(null);
  const f = FAELLE[fall]!;

  return (
    <div
      className={`spe ${stil.tisch}`}
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(#09152c,#13254a)' }}
    >
      <header className={stil.kopf}>
        <div className={stil.kopfTitel}>
          <h1>DreckBro – Probe</h1>
          <span>{f.titel}</span>
        </div>
        <select
          style={{ marginLeft: 'auto' }}
          value={fall}
          onChange={(e) => {
            setFall(e.target.value);
            setGesendet(null);
          }}
        >
          {Object.entries(FAELLE).map(([schluessel, x]) => (
            <option key={schluessel} value={schluessel}>
              {x.titel}
            </option>
          ))}
        </select>
      </header>
      <Brett
        key={fall}
        sicht={f.sicht}
        zuege={f.zuege}
        name={(sitz) => NAMEN[sitz] ?? `Platz ${sitz + 1}`}
        onZug={(zug) => setGesendet(JSON.stringify(zug))}
      />
      {f.sicht.ende && (
        <div className={stil.ergebnis} role="status">
          <strong>{NAMEN[f.sicht.ende.sieger ?? 0]} ist der DreckBro</strong>
          <span>Alle drei Pinguine voll eingesaut.</span>
        </div>
      )}
      <p style={{ textAlign: 'center', color: 'var(--hb-leise)', font: '700 12px var(--hb-txt)' }}>
        {gesendet ? `Ginge an den Server: ${gesendet}` : 'Karte antippen, dann Pinguin.'}
      </p>
    </div>
  );
}
