import { SozialeKanaele } from './SozialeKanaele';
import type { Me } from '../api';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';

import './start-einstiege.css';

/**
 * Start: drei Wege ins Spiel (Quick-Play, BroweG-Bock, Schild „Zu den
 * Spielen“), dazu Lernen und Browort; Aufgaben und Truhen als Seitensymbole.
 * Der Trophäenweg ist über den Kopf erreichbar.
 */

/** Banner je Spiel. Drei Spiele heißen im Bild anders als im Code. */
export function bannerFuer(gameId: string): string {
  // DreckBro hat noch kein geliefertes Banner (Bestellung:
  // docs/ASSETS-DRECKBRO.md). Bis dahin ein gezeichnetes SVG statt eines Pfads
  // auf eine WebP, die es nicht gibt — sonst stuende ein leeres Feld da.
  if (gameId === 'brobluff') return '/brobluff/icon.webp';
  if (gameId === 'dreckbro') return '/broremote/ausbau/dreckbro.webp';
  const name: Record<string, string> = {
    wizard: 'zauberer',
    easypoker: 'poker',
    golf: 'minigolf',
    filler: 'farbduell',
  };
  return `/hub/banner-${name[gameId] ?? gameId}.webp`;
}

/** Die Trophäenweg-Kacheln des neuen Hubs, gleiche Reihenfolge wie `BIOME`. */
export function wegBild(datei: string): string {
  return `/hub/weg-${datei}.webp`;
}

/** Die höchste 100er-Marke, unter die man nicht mehr fällt (bis 1.000; danach 250er). */
export function sicherAb(trophies: number): number {
  if (trophies < 1000) return Math.floor(trophies / 100) * 100;
  return 1000 + Math.floor((trophies - 1000) / 250) * 250;
}

/**
 * Die beiden Bilder des Umbaus (docs/ASSETS-START-NEU.md). Als Konstanten mit
 * null-Möglichkeit, weil sie erst nach dem Code kamen: Steht hier null, zeichnet
 * die Kachel kein `<img>` — ein weißer Kasten sähe nach Fehler aus
 * (CLAUDE.md) —, und das Schild fällt auf seinen CSS-Holzgrund zurück.
 */
const BOCK_BILD: string | null = '/hub/start-einstiege/bock.webp';
const SCHILD_BILD: string | null = '/hub/start-einstiege/schild.webp';

export function StartNeu({
  me,
  onAlleSpiele,
  onHeute,
  onBelohnungen,
  onQuickPlay,
  onZahnrad,
  onBock,
  bockBald,
  onLernen,
  onBrowort,
}: {
  me: Me;
  onAlleSpiele: () => void;
  onHeute: () => void;
  onBelohnungen: () => void;
  onQuickPlay: () => void;
  /** Das Zahnrad der Quick-Play-Kachel: welche Spiele Quick-Play nehmen darf. */
  onZahnrad: () => void;
  onBock: () => void;
  /** Den Bock gibt es noch nicht: Die Kachel trägt ehrlich „Bald“ (DESIGN.md). */
  bockBald: boolean;
  /** „Doppelkopf lernen" — fehlt es im Umfang, steht keine Lernkarte da. */
  onLernen?: () => void;
  /** Browort — wie `onLernen` nur gesetzt, wenn es im Umfang steht. */
  onBrowort?: () => void;
}): React.JSX.Element {
  const { aufgaben, truhen } = me.bereit;
  return (
    <div className="hb-start">
      <section className="start-mosaik" aria-label={t('start.einstiege')}>
        {/* Zwei Knöpfe nebeneinander statt verschachtelt: Ein Knopf im Knopf
            ist kein gültiges HTML, und das Zahnrad soll die Kachel nicht
            auslösen (eigene Tippfläche, Plan Abschnitt 3). */}
        <div className="start-kachel-huelle">
          <button
            type="button"
            className="start-kachel start-holzrahmen start-quickplay"
            onClick={onQuickPlay}
            aria-label={t('start.quickplay.aria')}
          >
            <span className="start-kachel-text">
              <strong>{t('start.quickplay.titel')}</strong>
              <small>{t('start.quickplay.unter')}</small>
            </span>
            <img src="/hub/start-einstiege/play.webp" alt="" fetchPriority="high" />
            <RahmenEcken />
          </button>
          <button
            type="button"
            className="start-zahnrad"
            onClick={onZahnrad}
            aria-label={t('start.quickplay.zahnrad')}
          >
            <img src="/hub/icon-einstellungen.webp" alt="" />
          </button>
        </div>
        <button
          type="button"
          className="start-kachel start-holzrahmen start-bock"
          onClick={onBock}
          aria-label={t('start.bock.aria')}
        >
          <span className="start-kachel-text">
            <strong>{t('start.bock.titel')}</strong>
            <small>{t('start.bock.unter')}</small>
          </span>
          {bockBald && <b className="start-kachel-badge start-bald">{t('start.bock.bald')}</b>}
          {BOCK_BILD && <img src={BOCK_BILD} alt="" />}
          <RahmenEcken />
        </button>
        <button
          type="button"
          className="start-kachel start-holzrahmen start-lernen"
          onClick={onLernen ?? onAlleSpiele}
          aria-label={
            onLernen ? t('start.mosaik.lernenAria') : t('start.spielen.aria')
          }
        >
          <span className="start-kachel-text">
            <strong>
              {t(onLernen ? 'start.mosaik.lernen' : 'start.spiele.titel')}
            </strong>
            <small>
              {onLernen ? t('game.doppelkopf') : t('start.spielen.auswahl')}
            </small>
          </span>
          <img src="/hub/start-einstiege/lernen.webp" alt="" />
          <RahmenEcken />
        </button>
        <button
          type="button"
          className="start-kachel start-holzrahmen start-browort"
          onClick={onBrowort ?? onAlleSpiele}
          aria-label={
            onBrowort ? t('start.mosaik.browortAria') : t('start.spielen.aria')
          }
        >
          <span className="start-kachel-text">
            <strong>
              {onBrowort ? 'Browort' : t('start.spielen.auswahl')}
            </strong>
            <small>
              {t(onBrowort ? 'start.mosaik.wort' : 'start.mosaik.entdecken')}
            </small>
          </span>
          <img
            className="start-kachel-szene"
            src={
              onBrowort
                ? '/hub/start-einstiege/browort.webp'
                : '/hub/start-einstiege/spielen.webp'
            }
            alt=""
          />
          <RahmenEcken />
        </button>
        {/* Das Schild ersetzt den Play-Kreis: Die Schrift ist echtes HTML,
            nichts davon steckt im Bild (Regel 5). */}
        <button
          type="button"
          className={`start-schild${SCHILD_BILD ? ' mit-bild' : ''}`}
          onClick={onAlleSpiele}
          style={SCHILD_BILD ? { backgroundImage: `url(${SCHILD_BILD})` } : undefined}
        >
          <span>{t('start.schild')}</span>
        </button>
        {/* Robin (A1): senkrecht am rechten Rand, schwebend über dem Mosaik,
            wie die Seitensymbole in Handyspielen. Die Zahl steht im Namen,
            weil die rote Marke allein nichts vorliest (DESIGN.md). */}
        <div className="start-seitenleiste" role="group" aria-label={t('start.symbole')}>
          <button
            type="button"
            className="start-symbol"
            onClick={onHeute}
            aria-label={aufgaben > 0 ? tf('start.symbol.aufgabenBereit', { n: aufgaben }) : t('start.symbol.aufgaben')}
          >
            <img src="/hub/icon-aufgaben.webp" alt="" />
            {aufgaben > 0 && <b className="start-symbol-zahl" aria-hidden="true">{aufgaben}</b>}
          </button>
          <button
            type="button"
            className="start-symbol"
            onClick={onBelohnungen}
            aria-label={truhen > 0 ? tf('start.symbol.truhenBereit', { n: truhen }) : t('start.symbol.truhen')}
          >
            <img src="/hub/truhe-holz.webp" alt="" />
            {truhen > 0 && <b className="start-symbol-zahl" aria-hidden="true">{truhen}</b>}
          </button>
        </div>
      </section>

      {/* Weiterspielen und „Deine Spiele“ sind vom Start weg (Robin,
          28.11.2026): Die laufende Runde melden die Pop-ups
          (StartAblauf.tsx), die eigenen Spiele stehen oben im Spiele-Reiter.
          Damit passt der Start ohne Rollen aufs Handy. */}
      <SozialeKanaele kompakt />
    </div>
  );
}

export function Haken(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="hb-ic"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function RahmenEcken(): React.JSX.Element {
  return (
    <span className="start-rahmen-ecken" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
