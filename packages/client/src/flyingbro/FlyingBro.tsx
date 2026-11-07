/**
 * Flying Bro: der Bildschirm — Levelwahl, Spiel und Levelende, als Vollbild
 * wie die Kartenmanufaktur (GameSelect.tsx, `soloStarten`).
 *
 * Quer gespielt (Spezifikation, Bildschirm und Format). Hochkant liegt eine
 * Dreh-Einblendung über allem, und das Spiel pausiert; wieder quer bleibt es
 * im Pausenmenü stehen, bis jemand „Weiter" tippt — sonst flöge ein Bro
 * weiter, während die Hand noch das Gerät dreht.
 *
 * Vor jedem Level steht die Vorbereitung: Dort setzt man Hilfsmittel aus
 * dem Vorrat ein oder kauft im Shop mit Flugmeilen nach. Was gewählt ist,
 * geht genau so an den Start, an `sterneFuer` und an die Meldung — der
 * Server prüft, dass alle drei übereinstimmen, und bucht beim Start ab.
 * Zierde zeigt der Shop hier noch nicht: Sie hat im Spiel noch kein
 * Aussehen, und ein Kauf ohne sichtbare Wirkung wäre ein Fehlkauf.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  BRO_WERTE,
  HILFSMITTEL_KATALOG,
  type Hilfsmittel,
  LEVELS,
  type Level,
  MELDUNG,
  SPIELABLAUF,
  type Sterne,
  freigeschaltet,
  kaufe,
  levelNach,
  levelsDerWelt,
  naechstesLevel,
  sterneFuer,
  tragendeTeile,
} from '@brauweg/flyingbro-kern';

import { ApiError } from '../api';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { useEscape } from '../screens/HbBlatt';
import { type Bilder, ladeBilder } from './bilder';
import { type Kamera, kameraFuer, naeher } from './kamera';
import { type Leitung, echteLeitung } from './leitung';
import { Partie, ladeRapier } from './partie';
import type { FlyingbroAnsicht, FlyingbroErgebnisAntwort } from './sicht';
import { zeichne, type ZeichenHilfe, type Zielbild } from './zeichnen';
import { SCHRITT_S, abschuss, vollerZugPx, vorschau, zugAus } from './zielen';
import './flyingbro.css';

/**
 * Bildzeiten nach `window.__flyingbroBildrate` nur, wenn jemand misst: auf
 * der Probe-Seite (alle drei Schreibweisen aus main.tsx `istProbe`) oder mit
 * `?bildrate` in der Adresse. Im echten Spiel hinge sonst ein globales Feld.
 */
function bildrateMessen(probe: ProbeFall | undefined): boolean {
  if (probe) return true;
  const { pathname, hash, search } = window.location;
  const q = new URLSearchParams(search);
  return q.has('bildrate') || q.get('probe') === 'flyingbro' || pathname === '/probe/flyingbro' || hash === '#/probe/flyingbro';
}

/** Für die Proben (proben/flyingbro): ein fester Zustand statt eines Spielverlaufs. */
export type ProbeFall = 'levelwahl' | 'shop' | 'vorbereitung' | 'zielen' | 'einsturz' | 'levelende';

/** Die Fälle, die im laufenden Spiel stehen — die übrigen sind Tafeln davor. */
type SpielFall = Extract<ProbeFall, 'zielen' | 'einsturz' | 'levelende'>;
function spielFall(f: ProbeFall | undefined): SpielFall | undefined {
  return f === 'zielen' || f === 'einsturz' || f === 'levelende' ? f : undefined;
}

/** Kurzzeichen je Hilfsmittel — für Schalter und HUD, ohne Bilddatei (es gibt noch keine). */
const ZEICHEN: Readonly<Record<Hilfsmittel, string>> = { fernrohr: '🔭', bauplan: '📐', 'ersatz-pelle': '🐧' };
/** Höchstens so viele Physikschritte je Bild — ein langsames Gerät läuft lieber langsamer als in Sprüngen. */
const MAX_SCHRITTE_JE_BILD = 4;
/** So lange stehen Splitter und Punkte noch, bevor die Wertung kommt (s). */
const NACHLAUF_S = 1.2;

function istQuer(): boolean {
  return typeof window === 'undefined' || window.innerWidth >= window.innerHeight;
}

/** Hört wie Golf.tsx auf Größe UND Drehung — iOS meldet die Drehung nicht immer als resize. */
function useQuer(): boolean {
  const [quer, setQuer] = useState(istQuer);
  useEffect(() => {
    const pruefe = (): void => setQuer(istQuer());
    window.addEventListener('resize', pruefe);
    window.addEventListener('orientationchange', pruefe);
    return () => {
      window.removeEventListener('resize', pruefe);
      window.removeEventListener('orientationchange', pruefe);
    };
  }, []);
  return quer;
}

function Sternreihe({ sterne, gross = false }: { sterne: number; gross?: boolean }): React.JSX.Element {
  return (
    <span className={`fb-sterne${gross ? ' is-gross' : ''}`} aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`fb-stern${n <= sterne ? ' is-voll' : ''}`} style={{ animationDelay: `${n * 0.25}s` }}>
          ★
        </span>
      ))}
    </span>
  );
}

function Drehen(): React.JSX.Element {
  return (
    <div className="fb-drehen" role="alert">
      <svg className="fb-drehen-handy" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="20" y="8" width="24" height="44" rx="4" />
        <circle cx="32" cy="46" r="2" />
        <path d="M50 30a18 18 0 0 1-8 15" />
        <path d="M38 44l4 1.5-.5-4.5" />
      </svg>
      <p>{t('flyingbro.drehen')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Levelwahl
// ---------------------------------------------------------------------------

function Levelwahl({
  stand,
  welt,
  setWelt,
  onLevel,
  onShop,
  onClose,
}: {
  stand: FlyingbroAnsicht;
  welt: number;
  setWelt: (w: number) => void;
  onLevel: (l: Level) => void;
  onShop: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const geschafft = useMemo(() => new Set(Object.keys(stand.level)), [stand.level]);
  const welten = [...new Set(LEVELS.map((l) => l.welt))];
  const summe = Object.values(stand.level).reduce((a, l) => a + l.sterne, 0);
  return (
    <div className="fb-wahl">
      <header className="fb-wahl-kopf">
        <button type="button" className="fb-knopf is-rund" onClick={onClose} aria-label={t('flyingbro.zurueck')}>
          ←
        </button>
        <h1>{t('flyingbro.titel')}</h1>
        <span className="fb-wahl-stand">
          <span className="fb-chip" title={tf('flyingbro.sterneSumme', { sterne: summe, max: LEVELS.length * 3 })}>
            ★ {summe}/{LEVELS.length * 3}
          </span>
          <span className="fb-chip">
            ✈ {stand.meilen} <small>{t('flyingbro.meilen')}</small>
          </span>
          <button type="button" className="fb-knopf is-klein" onClick={onShop}>
            {t('flyingbro.shop.titel')}
          </button>
        </span>
      </header>
      <nav className="fb-welten" role="tablist">
        {welten.map((w) => (
          <button key={w} type="button" role="tab" aria-selected={w === welt} className={`fb-welt${w === welt ? ' is-aktiv' : ''}`} onClick={() => setWelt(w)}>
            {t(`flyingbro.welt.${w}`)}
          </button>
        ))}
      </nav>
      <ol className="fb-kacheln">
        {levelsDerWelt(welt).map((l) => {
          const offen = freigeschaltet(l.id, geschafft);
          const sterne = stand.level[l.id]?.sterne ?? 0;
          return (
            <li key={l.id}>
              <button
                type="button"
                className={`fb-kachel${offen ? '' : ' is-zu'}`}
                disabled={!offen}
                title={offen ? l.titel : t('flyingbro.gesperrt')}
                aria-label={offen ? tf('flyingbro.levelLabel', { nr: l.nr, sterne }) : t('flyingbro.gesperrt')}
                onClick={() => onLevel(l)}
              >
                <span className="fb-kachel-nr">{offen ? l.nr : '🔒'}</span>
                {offen && <Sternreihe sterne={sterne} />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shop im Spiel
// ---------------------------------------------------------------------------

/**
 * Hilfsmittel gegen Flugmeilen. Die Preise kommen aus dem Kernkatalog, und
 * ob es reicht, sagt `kaufe` aus demselben Kern — mit dieser Funktion bucht
 * auch der Server. Der Knopf kann also nicht mehr erlauben als der Server.
 */
function Shop({
  stand,
  leitung,
  onStand,
  onZurueck,
}: {
  stand: FlyingbroAnsicht;
  leitung: Leitung;
  onStand: (s: FlyingbroAnsicht) => void;
  onZurueck: () => void;
}): React.JSX.Element {
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  // Doppeltipp am Handy: Der zweite Kauf ginge sonst los, bevor der erste zurück ist.
  const sperre = useRef(false);
  const kaufen = (id: string): void => {
    if (sperre.current) return;
    sperre.current = true;
    setLaeuft(id);
    setFehler(null);
    leitung
      .kauf(id)
      .then(onStand, (e: unknown) => setFehler(fehlerText(e)))
      .finally(() => {
        sperre.current = false;
        setLaeuft(null);
      });
  };
  return (
    <div className="fb-wahl" role="region" aria-label={t('flyingbro.shop.titel')}>
      <header className="fb-wahl-kopf">
        <button type="button" className="fb-knopf is-rund" onClick={onZurueck} aria-label={t('flyingbro.zurueck')}>
          ←
        </button>
        <h1>{t('flyingbro.shop.titel')}</h1>
        <span className="fb-wahl-stand">
          <span className="fb-chip is-meilen">
            ✈ {stand.meilen} <small>{t('flyingbro.meilen')}</small>
          </span>
        </span>
      </header>
      <p className="fb-shop-satz">{t('flyingbro.shop.satz')}</p>
      <ul className="fb-shop">
        {HILFSMITTEL_KATALOG.map((a) => {
          const geht = kaufe({ meilen: stand.meilen, vorrat: stand.vorrat, zierde: stand.zierde }, a.id).ok;
          return (
            <li key={a.id} className="fb-ware">
              <span className="fb-ware-zeichen" aria-hidden="true">
                {ZEICHEN[a.id]}
              </span>
              <span className="fb-ware-text">
                <strong>{t(`flyingbro.hilfsmittel.${a.id}`)}</strong>
                <small>{t(`flyingbro.hilfsmittel.${a.id}.wirkung`)}</small>
              </span>
              <span className="fb-ware-vorrat">{tf('flyingbro.shop.vorrat', { n: stand.vorrat[a.id] })}</span>
              <button
                type="button"
                className="fb-knopf is-gold"
                disabled={!geht || laeuft !== null}
                aria-label={tf('flyingbro.shop.kaufenLabel', { name: t(`flyingbro.hilfsmittel.${a.id}`), preis: a.preis })}
                onClick={() => kaufen(a.id)}
              >
                ✈ {a.preis}
              </button>
            </li>
          );
        })}
      </ul>
      <p className={`fb-shop-satz${fehler ? ' is-fehler' : ' is-leise'}`} aria-live="polite">
        {fehler ?? t('flyingbro.shop.zweiSterne')}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vorbereitung — Hilfsmittel für den nächsten Versuch wählen
// ---------------------------------------------------------------------------

function Vorbereitung({
  level,
  stand,
  gewaehlt,
  setGewaehlt,
  onLos,
  onShop,
  onZurueck,
}: {
  level: Level;
  stand: FlyingbroAnsicht;
  gewaehlt: Hilfsmittel[];
  setGewaehlt: (h: Hilfsmittel[]) => void;
  onLos: () => void;
  onShop: () => void;
  onZurueck: () => void;
}): React.JSX.Element {
  const umschalten = (h: Hilfsmittel): void => setGewaehlt(gewaehlt.includes(h) ? gewaehlt.filter((x) => x !== h) : [...gewaehlt, h]);
  return (
    <div className="fb-wahl fb-mitte">
      <div className="fb-tafel fb-vorbereitung" role="group" aria-label={t('flyingbro.vorbereitung.titel')}>
        <h2>
          {level.welt}-{level.nr} · {level.titel}
        </h2>
        <p className="fb-ende-zeile">{t('flyingbro.vorbereitung.titel')}</p>
        <div className="fb-schalter">
          {HILFSMITTEL_KATALOG.map((a) => {
            const an = gewaehlt.includes(a.id);
            // Wählbar ist nur, was im Vorrat liegt — der Start lehnte es sonst ab.
            const leer = stand.vorrat[a.id] <= 0;
            return (
              <button
                key={a.id}
                type="button"
                className={`fb-schalt${an ? ' is-an' : ''}`}
                aria-pressed={an}
                disabled={leer && !an}
                title={t(`flyingbro.hilfsmittel.${a.id}.wirkung`)}
                onClick={() => umschalten(a.id)}
              >
                <span className="fb-schalt-zeichen" aria-hidden="true">
                  {ZEICHEN[a.id]}
                </span>
                <strong>{t(`flyingbro.hilfsmittel.${a.id}`)}</strong>
                <small>{tf('flyingbro.shop.vorrat', { n: stand.vorrat[a.id] })}</small>
              </button>
            );
          })}
        </div>
        <p className="fb-ende-leise">{gewaehlt.length > 0 ? t('flyingbro.shop.zweiSterne') : t('flyingbro.vorbereitung.ohne')}</p>
        <div className="fb-tafel-knoepfe">
          <button type="button" className="fb-knopf" onClick={onZurueck}>
            {t('flyingbro.levelwahl')}
          </button>
          <button type="button" className="fb-knopf" onClick={onShop}>
            {t('flyingbro.shop.titel')}
          </button>
          <button type="button" className="fb-knopf is-gold" onClick={onLos}>
            {t('flyingbro.vorbereitung.los')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------------------

interface Ende {
  geschafft: boolean;
  punkte: number;
  verschossen: number;
  uebrig: number;
  sterne: Sterne;
}

type Wertung = { art: 'wartet' } | { art: 'fertig'; antwort: FlyingbroErgebnisAntwort } | { art: 'fehler'; text: string };

function fehlerText(e: unknown): string {
  return e instanceof ApiError ? t(e.messageKey) : t('error.internal');
}

/** Ein Schuss, der das Level schafft — für die Proben „einsturz" und „levelende", gesucht wie in partie.test.ts. */
function probeSchuss(R: Awaited<ReturnType<typeof ladeRapier>>, level: Level): { x: number; y: number } {
  for (let grad = 0; grad <= 70; grad += 2) {
    const p = new Partie(R, level);
    for (let i = 0; i < 60; i++) p.schritt();
    const tempo = BRO_WERTE[level.bros[0]!].hoechsttempo;
    const v = { x: Math.cos((grad * Math.PI) / 180) * tempo, y: Math.sin((grad * Math.PI) / 180) * tempo };
    p.schiessen(v);
    let n = 0;
    while (p.phase === 'flug' && n++ < 600) p.schritt();
    const gut = p.phase === 'gewonnen';
    p.freigeben();
    if (gut) return v;
  }
  return { x: 18, y: 8 };
}

function Spiel({
  level,
  versuch,
  hilfsmittel,
  leitung,
  quer,
  probe,
  onNochmal,
  onNeuVorbereiten,
  onLevelwahl,
  onWeiter,
  onVorrat,
  onGeaendert,
}: {
  level: Level;
  /** Schlüssel des Versuchs: Ein neuer Wert baut die Partie neu (Nochmal). */
  versuch: number;
  /** Eingesetzt für diesen Versuch — fest, solange das Level läuft. */
  hilfsmittel: Hilfsmittel[];
  leitung: Leitung;
  quer: boolean;
  probe?: SpielFall;
  onNochmal: () => void;
  /** Nach der Wertung mit Hilfsmitteln: neu wählen, denn der nächste Start bucht wieder ab. */
  onNeuVorbereiten: () => void;
  onLevelwahl: () => void;
  onWeiter: ((l: Level) => void) | null;
  /** Der Start hat abgebucht — der Vorrat im Stand zieht nach. */
  onVorrat: (vorrat: FlyingbroAnsicht['vorrat']) => void;
  onGeaendert: (antwort: FlyingbroErgebnisAntwort) => void;
}): React.JSX.Element {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const partie = useRef<Partie | null>(null);
  const bilder = useRef<Bilder>({});
  const kamera = useRef<Kamera | null>(null);
  const masse = useRef({ b: 844, h: 390, dpr: 1 });
  const zug = useRef<{ id: number; x0: number; y0: number; dx: number; dy: number } | null>(null);
  const pausiert = useRef(false);
  const startLokal = useRef<number | null>(null);
  const startFehler = useRef<string | null>(null);
  const endeSeit = useRef<number | null>(null);
  const [bereit, setBereit] = useState(false);
  const [pause, setPause] = useState(false);
  const [punkte, setPunkte] = useState(0);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [ende, setEnde] = useState<Ende | null>(null);
  const [wertung, setWertung] = useState<Wertung>({ art: 'wartet' });
  // Der Bildschirm ruft zurück, ohne dass die Schleife neu startet (Effekt am Schlüssel, nicht am Objekt).
  const geaendert = useRef(onGeaendert);
  geaendert.current = onGeaendert;
  const vorratNeu = useRef(onVorrat);
  vorratNeu.current = onVorrat;
  // Die Wahl ändert sich während eines Levels nicht (die Vorbereitung liegt
  // davor); als Schlüssel für die Effekte dient deshalb die Zeichenkette —
  // ein neues Feld mit gleichem Inhalt startete sonst den Versuch neu.
  const einsatz = hilfsmittel.join(',');
  const fernrohr = hilfsmittel.includes('fernrohr');
  const hilfe = useMemo<ZeichenHilfe>(
    () => (hilfsmittel.includes('bauplan') ? { tragend: new Set(tragendeTeile(level)) } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Schlüssel ist die Wahl, nicht das Feld.
    [level, einsatz],
  );

  pausiert.current = pause || !quer;

  // Hochkant gedreht: anhalten und im Pausenmenü bleiben (Spezifikation).
  useEffect(() => {
    if (!quer && !ende) setPause(true);
  }, [quer, ende]);

  // Levelstart beim Server — er merkt sich die Zeit für die Plausibilität.
  useEffect(() => {
    startLokal.current = null;
    startFehler.current = null;
    let aus = false;
    leitung.start(level.id, hilfsmittel).then(
      (antwort) => {
        if (aus) return;
        startLokal.current = performance.now();
        vorratNeu.current(antwort.vorrat);
      },
      (e: unknown) => {
        if (!aus) startFehler.current = fehlerText(e);
      },
    );
    return () => {
      aus = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `einsatz` steht für `hilfsmittel`.
  }, [level.id, versuch, leitung, einsatz]);

  // Laden, Partie bauen, Schleife — einmal je Versuch.
  useEffect(() => {
    let aus = false;
    let bild = 0;
    let letzte = 0;
    let rest = 0;
    let letzterHinweis: string | null = null;
    let letztePunkte = -1;
    setBereit(false);
    setEnde(null);
    setWertung({ art: 'wartet' });
    setPause(false);
    setPunkte(0);
    endeSeit.current = null;
    kamera.current = null;
    const zeiten: number[] = [];
    if (bildrateMessen(probe)) {
      (window as unknown as { __flyingbroBildrate?: number[] }).__flyingbroBildrate = zeiten;
    }

    const groesse = (): void => {
      const c = leinwand.current;
      if (!c) return;
      const r = c.getBoundingClientRect();
      // Höchstens doppelte Auflösung: Dreifach (iPhone) kostet die Bildrate, sieht man bei 17 px großen Bros aber nicht.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      masse.current = { b: Math.max(1, r.width), h: Math.max(1, r.height), dpr };
      c.width = Math.round(masse.current.b * dpr);
      c.height = Math.round(masse.current.h * dpr);
    };

    const zielKamera = (p: Partie): Kamera => {
      const { b, h } = masse.current;
      let oben = level.boden + 4;
      for (const t of p.teile) if (t.koerper) oben = Math.max(oben, t.koerper.translation().y + 1);
      for (const g of p.giraffen) if (g.koerper) oben = Math.max(oben, g.koerper.translation().y + 2.4);
      let links = -1;
      let rechts = level.breite + 1;
      const bro = p.bro?.koerper.translation();
      if (bro) {
        oben = Math.max(oben, bro.y + 1.5);
        links = Math.min(links, bro.x - 1.5);
        rechts = Math.max(rechts, bro.x + 1.5);
      }
      return kameraFuer(b, h, level.boden, { links, rechts, oben });
    };

    const ziel = (p: Partie): Zielbild | null => {
      const z = zug.current;
      const art = p.imBand();
      if (!z || !art) return null;
      const { b, h } = masse.current;
      const zz = zugAus(z.dx, z.dy, vollerZugPx(b, h));
      if (!zz) return null;
      const v = abschuss(art, zz);
      // Fernrohr: dieselbe Vorschau, nur länger (Kern, `vorschauFernrohrS`).
      const dauer = fernrohr ? SPIELABLAUF.vorschauFernrohrS : SPIELABLAUF.vorschauS;
      return { versatz: zz.versatz, punkte: v ? vorschau(p.abschussPunkt(), v, dauer) : [] };
    };

    const runde = (jetzt: number): void => {
      if (aus) return;
      bild = requestAnimationFrame(runde);
      const p = partie.current;
      const c = leinwand.current;
      const ctx = c?.getContext('2d');
      if (!p || !c || !ctx) return;
      const dt = letzte ? Math.min(0.1, (jetzt - letzte) / 1000) : SCHRITT_S;
      // Die Nachlaufuhr steht in der Pause still: Sonst schlösse das Level
      // hinter dem Pausenmenü ab, und die Abrechnung erschiene beim „Weiter".
      if (letzte && pausiert.current && endeSeit.current !== null && Number.isFinite(endeSeit.current)) {
        endeSeit.current += jetzt - letzte;
      }
      if (letzte) {
        zeiten.push(jetzt - letzte);
        if (zeiten.length > 1200) zeiten.splice(0, zeiten.length - 1200);
      }
      letzte = jetzt;
      // Probe „einsturz": eingefroren, sobald es kracht (siehe unten).
      if (!pausiert.current && !(probe === 'einsturz' && p.verschossen > 0)) {
        rest += dt;
        let n = 0;
        while (rest >= SCHRITT_S && n < MAX_SCHRITTE_JE_BILD) {
          p.schritt();
          rest -= SCHRITT_S;
          n++;
        }
        if (n === MAX_SCHRITTE_JE_BILD) rest = 0;
      }
      const zk = zielKamera(p);
      kamera.current = kamera.current ? naeher(kamera.current, zk, dt) : zk;
      const { b, h, dpr } = masse.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      zeichne(ctx, p, kamera.current, bilder.current, b, h, ziel(p), hilfe);

      if (p.punkte !== letztePunkte) {
        letztePunkte = p.punkte;
        setPunkte(p.punkte);
      }
      const hw = p.phase === 'zielen' && p.verschossen === 0 ? t('flyingbro.hinweis.zielen') : p.faehigkeitMoeglich() && p.bro ? t(`flyingbro.hinweis.${p.bro.art}`) : null;
      if (hw !== letzterHinweis) {
        letzterHinweis = hw;
        setHinweis(hw);
      }
      if ((p.phase === 'gewonnen' || p.phase === 'verloren') && endeSeit.current === null) endeSeit.current = jetzt;
      if (endeSeit.current !== null && jetzt - endeSeit.current > NACHLAUF_S * 1000) {
        endeSeit.current = Infinity;
        abschliessen(p);
      }
    };

    const abschliessen = (p: Partie): void => {
      const geschafft = p.phase === 'gewonnen';
      const e: Ende = {
        geschafft,
        punkte: p.punkte,
        verschossen: p.verschossen,
        uebrig: geschafft ? p.uebrigeBros() : 0,
        sterne: sterneFuer(level, { geschafft, punkte: p.punkte, hilfsmittel }),
      };
      setEnde(e);
      melden(e);
    };

    const melden = (e: Ende): void => {
      if (startFehler.current) {
        setWertung({ art: 'fehler', text: startFehler.current });
        return;
      }
      // Der Server lehnt Meldungen ab, die schneller kommen als 4 s je Bro.
      // Gemessen ab der Startantwort hier am Gerät, nicht an der Serveruhr —
      // die Uhren beider Seiten müssen dafür nicht übereinstimmen.
      const versuche = (): void => {
        if (aus) return;
        if (startLokal.current === null && !probe) {
          if (startFehler.current) setWertung({ art: 'fehler', text: startFehler.current });
          else window.setTimeout(versuche, 300);
          return;
        }
        const frueh = probe ? 0 : startLokal.current! + MELDUNG.msJeBro * e.verschossen + 400 - performance.now();
        if (frueh > 0) {
          window.setTimeout(versuche, frueh);
          return;
        }
        leitung
          .ergebnis({ levelId: level.id, geschafft: e.geschafft, punkte: e.punkte, verschossen: e.verschossen, hilfsmittel })
          .then(
            (antwort) => {
              if (aus) return;
              setWertung({ art: 'fertig', antwort });
              geaendert.current(antwort);
            },
            (err: unknown) => {
              if (!aus) setWertung({ art: 'fehler', text: fehlerText(err) });
            },
          );
      };
      versuche();
    };

    Promise.all([ladeRapier(), ladeBilder()]).then(([R, b]) => {
      if (aus) return;
      bilder.current = b;
      partie.current?.freigeben();
      // Ersatz-Pelle: ein zusätzlicher Pelle am Ende der Reihe (die Partie zählt ihn mit).
      const p = new Partie(R, level, { ersatzPelle: hilfsmittel.includes('ersatz-pelle') });
      partie.current = p;
      groesse();
      // Proben: feste Zustände statt eines Fingers.
      if (probe === 'zielen') zug.current = { id: -1, x0: 0, y0: 0, dx: -vollerZugPx(masse.current.b, masse.current.h) * 0.8, dy: vollerZugPx(masse.current.b, masse.current.h) * 0.45 };
      if (probe === 'einsturz' || probe === 'levelende') {
        const v = probeSchuss(R, level);
        for (let i = 0; i < 60; i++) p.schritt();
        p.schiessen(v);
        if (probe === 'einsturz') {
          // Bis es richtig kracht: das erste gebrochene Teil, dann noch eine Viertelsekunde.
          let n = 0;
          while (p.phase === 'flug' && n++ < 300 && !p.teile.some((t) => !t.koerper)) p.schritt();
          for (let i = 0; i < 15; i++) p.schritt();
        } else {
          let n = 0;
          while (p.phase === 'flug' && n++ < 2000) p.schritt();
          for (let i = 0; i < 120; i++) p.schritt();
          endeSeit.current = Infinity;
          abschliessen(p);
        }
      }
      setBereit(true);
      // Erstes Bild sofort, auch wenn rAF (Hintergrund-Tab) wartet. `runde`
      // meldet sich selbst für das nächste Bild an — ein zusätzliches
      // requestAnimationFrame hier startete eine ZWEITE Schleife, und jedes
      // Bild wurde doppelt gezeichnet (gemessen: jeder zweite Abstand 0 ms).
      runde(performance.now());
    });

    window.addEventListener('resize', groesse);
    window.addEventListener('orientationchange', groesse);
    return () => {
      aus = true;
      cancelAnimationFrame(bild);
      window.removeEventListener('resize', groesse);
      window.removeEventListener('orientationchange', groesse);
      partie.current?.freigeben();
      partie.current = null;
      zug.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Schlüssel ist der Versuch, nicht die Rückrufe.
  }, [level.id, versuch, leitung, probe, einsatz]);

  const runter = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = partie.current;
    if (!p || pausiert.current) return;
    if (p.phase === 'zielen' && p.imBand()) {
      // Gezogen wird irgendwo auf der linken Hälfte (Spezifikation, Zielen).
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX - r.left > r.width / 2) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      zug.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    } else if (p.phase === 'flug') {
      e.currentTarget.setPointerCapture(e.pointerId);
      p.tippen();
    }
  }, []);

  const bewegt = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const z = zug.current;
    if (!z || z.id !== e.pointerId) return;
    z.dx = e.clientX - z.x0;
    z.dy = e.clientY - z.y0;
  }, []);

  const hoch = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = partie.current;
    const z = zug.current;
    if (p && z && z.id === e.pointerId) {
      zug.current = null;
      const art = p.imBand();
      const { b, h } = masse.current;
      const v = art && !pausiert.current ? abschuss(art, zugAus(z.dx, z.dy, vollerZugPx(b, h))) : null;
      // Unter 0,3 m Zugweg: abgebrochen, kein Versehensschuss.
      if (v) p.schiessen(v);
    } else p?.loslassen();
  }, []);

  const abbrechen = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (zug.current?.id === e.pointerId) zug.current = null;
    partie.current?.loslassen();
  }, []);

  const weiter = onWeiter && ende?.geschafft ? naechstesLevel(level.id) : undefined;

  return (
    <div className="fb-spiel">
      <canvas
        ref={leinwand}
        className="fb-leinwand"
        onPointerDown={runter}
        onPointerMove={bewegt}
        onPointerUp={hoch}
        onPointerCancel={abbrechen}
      />
      {!bereit && <div className="fb-laedt">{t('flyingbro.laedt')}</div>}
      <div className="fb-hud">
        <button type="button" className="fb-knopf is-rund" aria-label={t('flyingbro.pause')} onClick={() => setPause(true)} disabled={!!ende}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        </button>
        <span className="fb-hud-titel">
          {level.welt}-{level.nr} · {level.titel}
        </span>
        {hilfsmittel.length > 0 && (
          <span className="fb-hud-hilfe" title={hilfsmittel.map((h) => t(`flyingbro.hilfsmittel.${h}`)).join(', ')}>
            {hilfsmittel.map((h) => ZEICHEN[h]).join(' ')}
          </span>
        )}
        <span className="fb-hud-punkte">
          <small>{t('flyingbro.punkte')}</small> {punkte.toLocaleString()}
        </span>
      </div>
      {hinweis && !pause && !ende && <div className="fb-hinweis">{hinweis}</div>}

      {pause && !ende && (
        <div className="fb-schleier" role="dialog" aria-modal="true" aria-label={t('flyingbro.pause')}>
          <div className="fb-tafel">
            <h2>{t('flyingbro.pause')}</h2>
            <div className="fb-tafel-knoepfe">
              <button type="button" className="fb-knopf is-gold" onClick={() => setPause(false)} disabled={!quer}>
                {t('flyingbro.weiter')}
              </button>
              <button type="button" className="fb-knopf" onClick={onNochmal}>
                {t('flyingbro.nochmal')}
              </button>
              <button type="button" className="fb-knopf" onClick={onLevelwahl}>
                {t('flyingbro.levelwahl')}
              </button>
            </div>
          </div>
        </div>
      )}

      {ende && (
        <div className="fb-schleier" role="dialog" aria-modal="true" aria-label={ende.geschafft ? t('flyingbro.ende.geschafft') : t('flyingbro.ende.verloren')}>
          <div className={`fb-tafel fb-ende${ende.geschafft ? ' is-geschafft' : ''}`}>
            <h2>{ende.geschafft ? t('flyingbro.ende.geschafft') : t('flyingbro.ende.verloren')}</h2>
            {ende.geschafft && <Sternreihe sterne={wertung.art === 'fertig' ? wertung.antwort.sterne : ende.sterne} gross />}
            <p className="fb-ende-punkte">{ende.punkte.toLocaleString()}</p>
            {ende.uebrig > 0 && <p className="fb-ende-zeile">{tf('flyingbro.ende.bonus', { anzahl: ende.uebrig })}</p>}
            <div className="fb-ende-ertrag" aria-live="polite">
              {wertung.art === 'wartet' && <span className="fb-ende-leise">{t('flyingbro.ende.wertet')}</span>}
              {wertung.art === 'fehler' && (
                <span className="fb-ende-leise">
                  {t('flyingbro.ende.nichtGewertet')}: {wertung.text}
                </span>
              )}
              {wertung.art === 'fertig' && (
                <>
                  {wertung.antwort.meilen.summe > 0 && <span className="fb-chip is-meilen">{tf('flyingbro.ende.meilen', { n: wertung.antwort.meilen.summe })}</span>}
                  {wertung.antwort.muenzen.gutschrift + wertung.antwort.muenzen.welt > 0 && (
                    <span className="fb-chip is-muenzen">{tf('flyingbro.ende.muenzen', { n: wertung.antwort.muenzen.gutschrift + wertung.antwort.muenzen.welt })}</span>
                  )}
                  {wertung.antwort.muenzen.offen > 0 && <span className="fb-ende-leise">{tf('flyingbro.ende.offen', { n: wertung.antwort.muenzen.offen })}</span>}
                  {wertung.antwort.besteSterne > wertung.antwort.sterne && (
                    <span className="fb-ende-leise">{tf('flyingbro.ende.bestwert', { sterne: wertung.antwort.besteSterne })}</span>
                  )}
                  {hilfsmittel.length > 0 && ende.geschafft && <span className="fb-ende-leise">{t('flyingbro.shop.zweiSterne')}</span>}
                  {wertung.antwort.goldhelmNeu && <span className="fb-chip is-muenzen">{t('flyingbro.ende.goldhelm')}</span>}
                </>
              )}
            </div>
            <div className="fb-tafel-knoepfe">
              <button type="button" className="fb-knopf" onClick={hilfsmittel.length > 0 ? onNeuVorbereiten : onNochmal}>
                {t('flyingbro.nochmal')}
              </button>
              {weiter && onWeiter && (
                <button type="button" className="fb-knopf is-gold" onClick={() => onWeiter(weiter)}>
                  {t('flyingbro.naechstesLevel')}
                </button>
              )}
              <button type="button" className="fb-knopf" onClick={onLevelwahl}>
                {t('flyingbro.levelwahl')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ganzer Bildschirm
// ---------------------------------------------------------------------------

export function FlyingBro({
  onClose,
  onGeaendert,
  leitung = echteLeitung,
  fall,
}: {
  onClose: () => void;
  /** Münzen fürs Hub kamen dazu — `/api/me` neu laden. */
  onGeaendert: () => void;
  /** Nur für Proben: ein nachgestellter Server (proben/flyingbro). */
  leitung?: Leitung;
  fall?: ProbeFall;
}): React.JSX.Element {
  const quer = useQuer();
  const [stand, setStand] = useState<FlyingbroAnsicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [level, setLevel] = useState<Level | null>(() => (spielFall(fall) ? (levelNach('w1-01') ?? null) : null));
  // Vor dem Level: die Vorbereitung. Die Probe zeigt das erste offene, noch nicht geschaffte Level ihres Stands.
  const [vorbereiten, setVorbereiten] = useState<Level | null>(() => (fall === 'vorbereitung' ? (levelNach('w1-06') ?? null) : null));
  const [shopOffen, setShopOffen] = useState(fall === 'shop');
  const [einsatz, setEinsatz] = useState<Hilfsmittel[]>([]);
  const [versuch, setVersuch] = useState(0);
  const [welt, setWelt] = useState(1);
  const [laden, setLaden] = useState(0);

  // Escape geht eine Ebene zurück: Shop → davor, Vorbereitung und Spiel → Levelwahl, Levelwahl → Hub.
  useEscape(shopOffen ? () => setShopOffen(false) : vorbereiten ? () => setVorbereiten(null) : level ? () => setLevel(null) : onClose);

  const vorbereitenFuer = (l: Level): void => {
    setLevel(null);
    setVorbereiten(l);
  };

  useEffect(() => {
    let aus = false;
    setFehler(null);
    leitung.stand().then(
      (s) => {
        if (aus) return;
        setStand(s);
        // Die Welt des ersten offenen, noch nicht geschafften Levels vorwählen.
        const geschafft = new Set(Object.keys(s.level));
        const offen = LEVELS.find((l) => freigeschaltet(l.id, geschafft) && !geschafft.has(l.id));
        if (offen) setWelt(offen.welt);
      },
      (e: unknown) => {
        if (!aus) setFehler(fehlerText(e));
      },
    );
    return () => {
      aus = true;
    };
  }, [leitung, laden]);

  const beimErgebnis = useCallback(
    (antwort: FlyingbroErgebnisAntwort) => {
      setStand(antwort.stand);
      if (antwort.muenzen.gutschrift + antwort.muenzen.welt > 0) onGeaendert();
    },
    [onGeaendert],
  );

  const beimVorrat = useCallback((vorrat: FlyingbroAnsicht['vorrat']) => {
    setStand((s) => (s ? { ...s, vorrat } : s));
  }, []);

  // Eine Wahl, die der Vorrat nicht mehr deckt, fällt heraus — der Start lehnte sie sonst ab.
  const deckbar = (e: Hilfsmittel[]): Hilfsmittel[] => e.filter((h) => (stand?.vorrat[h] ?? 0) > 0);

  return (
    <div className="fb" role="dialog" aria-modal="true" aria-label={t('flyingbro.titel')} data-flyingbro="">
      {shopOffen && stand ? (
        <Shop stand={stand} leitung={leitung} onStand={setStand} onZurueck={() => setShopOffen(false)} />
      ) : level ? (
        <Spiel
          key={level.id}
          level={level}
          versuch={versuch}
          hilfsmittel={einsatz}
          leitung={leitung}
          quer={quer}
          probe={spielFall(fall)}
          onNochmal={() => setVersuch((v) => v + 1)}
          onNeuVorbereiten={() => vorbereitenFuer(level)}
          onLevelwahl={() => {
            setWelt(level.welt);
            setLevel(null);
          }}
          onWeiter={vorbereitenFuer}
          onVorrat={beimVorrat}
          onGeaendert={beimErgebnis}
        />
      ) : vorbereiten && stand ? (
        <Vorbereitung
          level={vorbereiten}
          stand={stand}
          gewaehlt={deckbar(einsatz)}
          setGewaehlt={setEinsatz}
          onLos={() => {
            setEinsatz(deckbar(einsatz));
            setVersuch((v) => v + 1);
            setLevel(vorbereiten);
            setVorbereiten(null);
          }}
          onShop={() => setShopOffen(true)}
          onZurueck={() => {
            setWelt(vorbereiten.welt);
            setVorbereiten(null);
          }}
        />
      ) : stand ? (
        <Levelwahl
          stand={stand}
          welt={welt}
          setWelt={setWelt}
          onLevel={vorbereitenFuer}
          onShop={() => setShopOffen(true)}
          onClose={onClose}
        />
      ) : (
        <div className="fb-wahl fb-mitte">
          {fehler ? (
            <>
              <p>{t('flyingbro.standFehler')}</p>
              <p className="fb-ende-leise">{fehler}</p>
              <div className="fb-tafel-knoepfe">
                <button type="button" className="fb-knopf is-gold" onClick={() => setLaden((n) => n + 1)}>
                  {t('flyingbro.nochmalLaden')}
                </button>
                <button type="button" className="fb-knopf" onClick={onClose}>
                  {t('flyingbro.zurueck')}
                </button>
              </div>
            </>
          ) : (
            <p>{t('flyingbro.laedt')}</p>
          )}
        </div>
      )}
      {!quer && <Drehen />}
    </div>
  );
}
