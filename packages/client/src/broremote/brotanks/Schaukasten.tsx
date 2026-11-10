/**
 * Schaukasten von BroTanks — Bühne und Handy ohne Server.
 *
 * Eine Runde BroTanks braucht einen Gastgeber und mindestens zwei Handys; wer
 * nur sehen will, wie die Insel oder der Zielbildschirm aussieht, stellt das
 * sonst jedes Mal mit drei Geräten nach. Hier läuft die echte Partie (die
 * Arena rechnet wie am Tisch), nur die Handys sind erfunden.
 *
 * Aufruf: `npm run dev:client`, dann
 * http://localhost:5173/brotanks-schaukasten.html?fall=<name>
 *
 *   buehne      Bühne mit drei Bros; nach dem Countdown zielt der erste
 *   flug        wie buehne, aber der Bro am Zug feuert nach dem Countdown
 *   pause       ein Bro fehlt — Feuerpause mit dem Weiterspielen-Knopf
 *   ergebnis    wie pause, nur zu zweit: Weiterspielen ohne ihn beendet die Partie
 *   handy       Handy am Zug
 *   warten      Handy, das noch zwei Züge warten muss
 *   ende        Handy nach gewonnener Partie
 *
 * Die Handy-Sichten sind von Hand geschrieben; dass ihre Form stimmt, prüft
 * der Typ `ArtiPrivat`. Die Seite wird nicht mitgebaut.
 */

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ArtiPrivat, Privat, Spieler } from '@brauweg/broremote-kern';

import '../../styles.css';
import '../broremote.css';
import TanksArena, { type EingabeEmpfang } from './TanksArena';
import { ZielController } from './ZielController';

const SPIELER: Spieler[] = [
  { id: 'anna', name: 'Anna', farbe: '#80e5cd', verbunden: true, bereit: true },
  { id: 'bert', name: 'Bert', farbe: '#ff8a5c', verbunden: true, bereit: true },
  { id: 'cleo', name: 'Cleo', farbe: '#ffd166', verbunden: true, bereit: true },
];

const ARTI: ArtiPrivat = {
  phase: 'zielen', amZug: true, zug: 3, rest: 14, inZuegen: 0, winkel: 58, staerke: 64, waffe: 2,
  munition: [-1, 3, 2, 2, 1, 2, 1, 1], lp: 72, tank: 80, wind: -4, runde: 1, platz: 1, raus: false, gewonnen: false,
};
const HANDY: Record<string, ArtiPrivat> = {
  handy: ARTI,
  warten: { ...ARTI, amZug: false, inZuegen: 2 },
  ende: { ...ARTI, phase: 'ende', amZug: false, gewonnen: true },
};

function Buehne({ fall }: { fall: string }): React.JSX.Element {
  const eingaben = useRef<EingabeEmpfang | null>(null);
  const [amZug, setAmZug] = useState<string | null>(null);
  // Wartemarke fürs Sichtprobe-Werkzeug (--warte "[data-stand=flug]"): Der Flug wird erst kurz nach dem Abschuss markiert, damit das Geschoss schon in der Luft ist.
  const [stand, setStand] = useState('countdown');
  const gefeuert = useRef(false);
  const runde = fall === 'ergebnis' ? SPIELER.slice(0, 2) : SPIELER;
  const spieler = fall === 'pause' || fall === 'ergebnis' ? runde.map(s => s.id === amZug ? { ...s, verbunden: false } : s) : runde;
  const privat = (id: string, d: Privat): void => {
    const a = d.arti;
    if (!a) return;
    if (a.amZug && a.phase === 'zielen') setAmZug(id);
    if (a.phase === 'flug') setTimeout(() => setStand('flug'), 900);
    else if (a.phase !== 'countdown') setStand(s => s === 'flug' && a.phase === 'zielen' ? s : a.phase);
  };
  useEffect(() => {
    if (fall !== 'flug' || !amZug || gefeuert.current) return;
    gefeuert.current = true;
    eingaben.current?.(amZug, { art: 'feuer', zug: 1, winkel: 50, staerke: 62, waffe: 0 });
  }, [fall, amZug]);
  return <main className="br-seite br-spielt" data-stand={stand}><div className="br-inhalt">
    <TanksArena id="schaukasten" seed={11} spieler={spieler} verbunden eingaben={eingaben} privat={privat} zurLobby={() => undefined} />
  </div></main>;
}

function Schaukasten(): React.JSX.Element {
  const fall = new URLSearchParams(location.search).get('fall') ?? 'buehne';
  const arti = HANDY[fall];
  if (arti) return <main className="br-seite br-spielt" data-fall={fall}><div className="br-inhalt"><ZielController arti={arti} senden={() => undefined} /></div></main>;
  return <div data-fall={fall}><Buehne fall={fall} /></div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Schaukasten /></StrictMode>);
