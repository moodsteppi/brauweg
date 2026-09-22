/**
 * Die Replay-Ansicht: ein Loch noch einmal ansehen, mit der echten Physik
 * und dem echten Zeichner.
 *
 * Robins Entscheidung vom 22.09.2026: der EIGENE Lauf, keine Zuschauersicht.
 * Die Kamera folgt deshalb dem eigenen Ball, die anderen Bälle rollen sichtbar
 * mit — so, wie man das Loch erlebt hat. Gerechnet wird in `replay.ts` auf
 * eigenen Kopien; die laufende Partie dahinter bleibt unberührt und läuft
 * weiter (Golf wartet auf niemanden, auch nicht auf jemanden im Replay).
 *
 * Dieselbe Leinwandtechnik wie `Partie` in `screens/Golf.tsx`: EINE
 * Bildschleife an einem Schlüssel (der Aufzeichnung), Bedienzustand in Refs,
 * und was sich je Bild ändert (der Fortschrittsbalken), geht am DOM-Knoten
 * vorbei an React — ein `setState` je Bild zeichnete sechzigmal je Sekunde
 * die ganze Ansicht neu.
 *
 * „Weniger Bewegung" (`prefers-reduced-motion`): Der Ball rollt trotzdem —
 * das IST der Inhalt —, aber die Kamera folgt ohne Nachlauf, hart auf den
 * Ball. Ein nachziehendes Bild ist genau die Bewegung, die man sich damit
 * abbestellt hat.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { t } from '../../i18n';
import { GRUNDSICHT, Kamera } from './kamera';
import { TAKT_MS } from './physik';
import {
  Abspieler,
  faelligeTakte,
  nimmLochAuf,
  type ReplayEingabe,
  type Tempo,
} from './replay';
import { Zeichner } from './zeichnen';

export function GolfReplay({
  eingabe,
  loch,
  eigenerSitz,
  farben,
  laeuftWeiter,
  onSchliessen,
}: {
  /** Beim Knopfdruck eingefroren (siehe `eingabeAusKern`). */
  eingabe: ReplayEingabe;
  loch: number;
  /** Wessen Ball die Kamera folgt; -1 (Zuschauer) heißt Sitz 0. */
  eigenerSitz: number;
  /** Ballfarbe je Sitz, schon doppelfrei — dieselbe wie im Spiel. */
  farben: readonly string[];
  /** Läuft die Partie hinter dem Replay noch? Dann sagt die Ansicht es. */
  laeuftWeiter: boolean;
  onSchliessen: () => void;
}): React.JSX.Element {
  const aufzeichnung = useMemo(() => nimmLochAuf(eingabe, loch), [eingabe, loch]);
  const sitz = eigenerSitz >= 0 && eigenerSitz < eingabe.sitze ? eigenerSitz : 0;

  const leinwandRef = useRef<HTMLCanvasElement | null>(null);
  const balkenRef = useRef<HTMLSpanElement | null>(null);
  const abspielerRef = useRef<Abspieler | null>(null);
  const kameraRef = useRef<Kamera>(new Kamera());
  /** Übertrag der Wanduhr ins nächste Bild (siehe `faelligeTakte`). */
  const restRef = useRef(0);
  const spieltRef = useRef(true);
  const tempoRef = useRef<Tempo>(1);
  const [spielt, setSpielt] = useState(true);
  const [tempo, setTempo] = useState<Tempo>(1);
  const [schlag, setSchlag] = useState(0);
  const [eingelocht, setEingelocht] = useState(false);
  const [zuEnde, setZuEnde] = useState(false);
  const farbenRef = useRef<readonly string[]>(farben);
  farbenRef.current = farben;

  const [ruhig] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  /* Bildschleife — einmal je Aufzeichnung, nicht je Render. */
  useEffect(() => {
    const leinwand = leinwandRef.current;
    if (leinwand === null || aufzeichnung === null) return;
    const abspieler = new Abspieler(aufzeichnung);
    abspielerRef.current = abspieler;
    restRef.current = 0;
    kameraRef.current.vergiss();
    const zeichner = new Zeichner(leinwand);
    zeichner.setzeFarben(farbenRef.current);
    const karte = aufzeichnung.karte;

    let laeuft = true;
    let bild = 0;
    let letzteMs = performance.now();
    let letzterSchlag = -1;
    let letztesLoch = false;

    const takt = (): void => {
      if (!laeuft) return;
      bild = requestAnimationFrame(takt);
      const jetzt = performance.now();
      const dt = jetzt - letzteMs;
      letzteMs = jetzt;

      if (spieltRef.current && !abspieler.fertig) {
        const f = faelligeTakte(restRef.current, dt, tempoRef.current);
        restRef.current = f.restMs;
        for (let i = 0; i < f.takte && !abspieler.fertig; i += 1) {
          abspieler.schritt();
          zeichner.nimmEffekte(abspieler.effekte());
        }
        if (abspieler.fertig) {
          restRef.current = 0;
          spieltRef.current = false;
          setSpielt(false);
          setZuEnde(true);
        }
      }

      const z = abspieler.zustand();
      const ball = z.baelle[sitz];
      // Schlagnummer und Einlochen ändern sich selten — nur dann an React.
      const n = ball?.schlaege ?? 0;
      if (n !== letzterSchlag) {
        letzterSchlag = n;
        setSchlag(n);
      }
      const drin = ball?.eingelocht ?? false;
      if (drin !== letztesLoch) {
        letztesLoch = drin;
        setEingelocht(drin);
      }
      const balken = balkenRef.current;
      if (balken !== null) {
        const anteil = abspieler.taktImLoch / Math.max(1, abspieler.takteGesamt);
        balken.style.transform = `scaleX(${anteil > 1 ? 1 : anteil})`;
      }

      if (typeof document !== 'undefined' && document.hidden) return;

      const folgt = ball !== undefined && ball.dabei && !ball.eingelocht;
      const zielX = folgt ? ball.x : karte.loch[0];
      const zielY = folgt ? ball.y : karte.loch[1];
      const kamera = kameraRef.current;
      // Ohne Nachlauf: jedes Bild hart auf den Ball, `schritt` klemmt nur.
      if (ruhig) kamera.setzeSofort(zielX, zielY, GRUNDSICHT);
      const blick = kamera.schritt(
        karte,
        zielX,
        zielY,
        0,
        false,
        zeichner.seitenverhaeltnis,
        ruhig ? 0 : dt,
      );

      zeichner.zeichne({
        karte,
        zustand: z,
        vorher: abspieler.vorher(),
        // Pause friert den Bruchteil mit ein — sonst ruckte das Standbild.
        anteil: abspieler.fertig ? 1 : restRef.current / TAKT_MS,
        blick,
        eigenerSitz: sitz,
        ziel: null,
        uhrMs: jetzt,
        uebersicht: false,
      });
    };

    bild = requestAnimationFrame(takt);
    return () => {
      laeuft = false;
      cancelAnimationFrame(bild);
      abspielerRef.current = null;
    };
  }, [aufzeichnung, sitz, ruhig]);

  /* Escape schließt — wie jede andere Überlagerung auch. */
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen();
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [onSchliessen]);

  const anAbschlag = (): void => {
    abspielerRef.current?.zurueck();
    restRef.current = 0;
    kameraRef.current.vergiss();
    setZuEnde(false);
  };

  const umschalten = (): void => {
    const a = abspielerRef.current;
    // Am Ende heißt „Abspielen": von vorn.
    const vonVorn = a !== null && a.fertig;
    if (vonVorn) anAbschlag();
    const an = vonVorn || !spieltRef.current;
    spieltRef.current = an;
    setSpielt(an);
  };

  const wechsleTempo = (): void => {
    const neu: Tempo = tempoRef.current === 1 ? 2 : 1;
    tempoRef.current = neu;
    setTempo(neu);
  };

  const titel = `${t('golf.replay.titel')} · ${t('golf.replay.loch')} ${loch + 1}`;

  if (aufzeichnung === null) {
    return (
      <div className="grp-seite" role="dialog" aria-modal="true" aria-label={titel}>
        <div className="grp-leer">
          <p>{t('golf.replay.nichtDa')}</p>
          <button className="gf-knopf gf-knopf-haupt" type="button" onClick={onSchliessen}>
            {t('golf.replay.schliessen')}
          </button>
        </div>
      </div>
    );
  }

  const schlagText = eingelocht
    ? `${t('golf.replay.eingelocht')} · ${schlag}`
    : schlag === 0
      ? t('golf.replay.amAbschlag')
      : `${t('golf.replay.schlag')} ${schlag}`;

  return (
    <div className="grp-seite" role="dialog" aria-modal="true" aria-label={titel}>
      <canvas className="grp-leinwand" ref={leinwandRef} aria-hidden="true" />

      <div className="grp-kopf">
        <button
          className="gf-zurueck grp-zu"
          type="button"
          onClick={onSchliessen}
          aria-label={t('golf.replay.schliessen')}
        >
          ←
        </button>
        <span className="grp-titel">
          {titel} · {aufzeichnung.karte.name}
        </span>
        <strong className="grp-schlag" aria-live="polite">
          {schlagText}
        </strong>
      </div>
      {laeuftWeiter && <p className="grp-hinweis">{t('golf.replay.laeuftWeiter')}</p>}

      <div className="grp-leiste">
        <span className="grp-balken" aria-hidden="true">
          <span ref={balkenRef} />
        </span>
        <div className="grp-knoepfe">
          <button
            className="grp-knopf"
            type="button"
            onClick={anAbschlag}
            aria-label={t('golf.replay.abschlag')}
            title={t('golf.replay.abschlag')}
          >
            ⏮
          </button>
          <button
            className="grp-knopf grp-knopf-haupt"
            type="button"
            onClick={umschalten}
            aria-label={spielt ? t('golf.replay.pause') : t('golf.replay.abspielen')}
          >
            {spielt ? '❚❚' : zuEnde ? '↻' : '▶'}
          </button>
          <button
            className="grp-knopf"
            type="button"
            onClick={wechsleTempo}
            aria-pressed={tempo === 2}
            aria-label={t('golf.replay.tempo')}
            title={t('golf.replay.tempo')}
          >
            {tempo}×
          </button>
        </div>
      </div>
    </div>
  );
}
