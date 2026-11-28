import { Suspense, createContext, lazy, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { api, type GameSummary, type Me } from '../api';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { useEscape } from './HbBlatt';
import type { SammelBereich } from './SammlungVorschau';
import './einstieg-ecke.css';

/**
 * Herz und Übersicht oben rechts im Spieleinstieg (Robin, 28.11.2026 abends).
 *
 * Ein Tipp auf ein Spiel führt seitdem direkt in den Einstieg — die
 * Übersichtsseite davor (Ausstattung, Trophäen, Rangliste) kostete jedes Mal
 * einen Tipp. Sie ist nicht weg, sondern hinter dem runden Pokal-Knopf, und
 * das Herz (Favorit) zog mit ihr in die Ecke.
 *
 * Die Einstiege sind eigene Bildschirme in App.tsx und kennen weder das Konto
 * noch die Sammlung des Hubs. Statt jedem der zehn ein halbes Dutzend Props
 * durchzureichen, stellt App.tsx das Nötige als Kontext bereit. Fehlt er
 * (Einzeltests, Proben), zeichnet die Ecke nichts — ein Herz, das nicht
 * speichern kann, wäre schlimmer als keins.
 */
export interface EinstiegUmfeld {
  me: Me;
  /** `/api/me` neu laden, nachdem sich ein Favorit geändert hat. */
  onKontoNeu: () => void;
  /** In die Sammlung des Hubs, mit diesem Spiel und gegebenenfalls dem Bereich. */
  onSammlung: (spiel: string, art?: SammelBereich) => void;
  /** „Doppelkopf lernen" — nur gesetzt, wenn der Lernpfad im Umfang steht. */
  onLernen?: () => void;
}

export const EinstiegKontext = createContext<EinstiegUmfeld | null>(null);

/*
 * Nachgeladen: Die Übersicht zieht Kartenbilder, Tischszenen und die
 * Sammlungsvorschau mit. Im Einstieg braucht man sie selten — sie soll das
 * Stück, das jeden Einstieg lädt, nicht schwerer machen.
 */
const SpielSeite = lazy(() => import('./SpieleNeu').then((m) => ({ default: m.SpielSeite })));

/** Das Herz als SVG — ein Zeichen reicht, eine Grafik wäre eine Bestellung (Plan, Abschnitt 7). */
export function Herz({ voll }: { voll: boolean }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill={voll ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
    </svg>
  );
}

/*
 * Die Spielliste einmal je Sitzung: Die Übersicht braucht nur Name und
 * Sitzzahl, und wer zwischen zwei Einstiegen hin und her geht, soll nicht
 * jedes Mal warten. Scheitert der Abruf, wird beim nächsten Mal neu gefragt.
 */
let spieleListe: Promise<GameSummary[]> | null = null;
function ladeSpiele(): Promise<GameSummary[]> {
  spieleListe ??= api.games().catch(() => {
    spieleListe = null;
    return [];
  });
  return spieleListe;
}

export function EinstiegEcke({ spiel }: { spiel: string }): React.JSX.Element | null {
  const umfeld = useContext(EinstiegKontext);
  const [offen, setOffen] = useState(false);
  /*
   * Favoriten, wie der Server sie zuletzt bestätigt hat — bis das Konto neu
   * geladen ist. Sonst spränge das Herz nach dem Tippen kurz zurück (wie im
   * Spiele-Reiter, SpieleNeu.tsx).
   */
  const [stand, setStand] = useState<string[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  if (!umfeld) return null;

  const favoriten = stand ?? umfeld.me.vorlieben?.favoriten ?? [];
  const favorit = favoriten.includes(spiel);
  const umschalten = (): void => {
    const vorher = favoriten;
    const an = !favorit;
    setFehler(null);
    setStand(an ? [...vorher.filter((id) => id !== spiel), spiel] : vorher.filter((id) => id !== spiel));
    api
      .favoritSetzen(spiel, an)
      .then((antwort) => {
        setStand(antwort.favoriten);
        umfeld.onKontoNeu();
      })
      .catch(() => {
        setStand(vorher);
        setFehler(t('spielwahl.favorit.fehler'));
      });
  };

  return (
    <div className="spe-ecke">
      {/* aria-pressed sagt den Zustand, der Name bleibt gleich — wie auf der
          Übersichtsseite im Reiter. */}
      <button
        type="button"
        className={`hb-rund spe-eckknopf spe-herz${favorit ? ' is-an' : ''}`}
        aria-pressed={favorit}
        aria-label={tf('spielwahl.favorit.knopf', { spiel: t(`game.${spiel}`) })}
        onClick={umschalten}
      >
        <Herz voll={favorit} />
      </button>
      <button
        type="button"
        className="hb-rund spe-eckknopf spe-uebersicht-knopf"
        aria-label={t('spielwahl.uebersicht.knopf')}
        aria-haspopup="dialog"
        onClick={() => setOffen(true)}
      >
        <img src="/hub/symbol-pokal.webp" alt="" draggable={false} />
      </button>
      {fehler && (
        <p role="alert" className="spe-ecke-fehler">
          {fehler}
        </p>
      )}
      {/* In den body, nicht in den Kopf: Mememory legt `.spe` in eine eigene
          Seite (spiel-einstieg-mini.css), und ein `fixed` darin wäre an
          deren Rahmen gebunden statt ans Fenster. */}
      {offen && createPortal(<Uebersicht spiel={spiel} umfeld={umfeld} onZu={() => setOffen(false)} />, document.body)}
    </div>
  );
}

/**
 * Die Übersicht als Vollbild über dem Einstieg. Die Klasse `.hb` bringt das
 * Holz- und Messingkleid der Übersicht im Hub mit (hub-details.css,
 * hub-zierwerk.css gelten nur darunter) — so sieht sie aus wie bisher.
 */
function Uebersicht({
  spiel,
  umfeld,
  onZu,
}: {
  spiel: string;
  umfeld: EinstiegUmfeld;
  onZu: () => void;
}): React.JSX.Element {
  useEscape(onZu);
  const [game, setGame] = useState<Pick<GameSummary, 'id' | 'nameKey' | 'seatCounts'> | null>(null);
  useEffect(() => {
    let lebt = true;
    void ladeSpiele().then((liste) => {
      if (!lebt) return;
      // Fehlt das Spiel in der Liste (Partykiste steht in der App unter
      // „Bald"), reicht der Name — die Sitzzahl bleibt dann weg.
      setGame(liste.find((g) => g.id === spiel) ?? { id: spiel, nameKey: `game.${spiel}`, seatCounts: [] });
    });
    return () => {
      lebt = false;
    };
  }, [spiel]);

  const laden = <p className="hb-laden">{t('spielwahl.laden')}</p>;
  return (
    <div className="hb spe-uebersicht" role="dialog" aria-modal="true" aria-label={t('spielwahl.uebersicht.knopf')}>
      {game ? (
        <Suspense fallback={laden}>
          <SpielSeite
            game={game}
            me={umfeld.me}
            onZurueck={onZu}
            zurueckText={t('spielwahl.uebersicht.zurueck')}
            onSammlung={(art) => umfeld.onSammlung(spiel, art)}
            onLernen={spiel === 'doppelkopf' ? umfeld.onLernen : undefined}
          />
        </Suspense>
      ) : (
        laden
      )}
    </div>
  );
}
