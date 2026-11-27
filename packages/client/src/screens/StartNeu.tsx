import { SozialeKanaele } from './SozialeKanaele';
import type { ActiveTable, Me } from '../api';
import { t, zahl } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { inAppSichtbar } from '../app-sichtbar';

import './start-einstiege.css';

/** Start: Spielen und Tagesaufgaben zuerst; der Trophäenweg ist über den Kopf erreichbar. */

/** Banner je Spiel. Drei Spiele heißen im Bild anders als im Code. */
export function bannerFuer(gameId: string): string {
  // DreckBro hat noch kein geliefertes Banner (Bestellung:
  // docs/ASSETS-DRECKBRO.md). Bis dahin ein gezeichnetes SVG statt eines Pfads
  // auf eine WebP, die es nicht gibt — sonst stuende ein leeres Feld da.
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

export function StartNeu({
  me,
  activeTable,
  onResume,
  onPick,
  onAlleSpiele,
  onHeute,
  onBelohnungen,
  onLernen,
  onBrowort,
}: {
  me: Me;
  activeTable: ActiveTable | null;
  onResume: (gameId: string, tableId: string) => void;
  onPick: (gameId: string) => void;
  onAlleSpiele: () => void;
  onHeute: () => void;
  onBelohnungen: () => void;
  /** „Doppelkopf lernen" — fehlt es im Umfang, steht keine Lernkarte da. */
  onLernen?: () => void;
  /** Browort — wie `onLernen` nur gesetzt, wenn es im Umfang steht. */
  onBrowort?: () => void;
}): React.JSX.Element {
  const eigene = [...me.stats]
    .filter((s) => inAppSichtbar(s.gameId))
    .filter((s) => s.parties > 0 || s.trophies > 0)
    .sort((a, b) => b.trophies - a.trophies)
    .slice(0, 6);

  return (
    <div className="hb-start">
      <section className="start-mosaik" aria-label={t('start.einstiege')}>
        <button
          type="button"
          className="start-kachel start-holzrahmen start-quests"
          onClick={onHeute}
          aria-label={
            me.bereit.aufgaben > 0
              ? tf('start.heute.ariaBereit', { n: me.bereit.aufgaben })
              : t('start.heute.aria')
          }
        >
          <span className="start-kachel-text">
            <strong>{t('start.aufgaben.titel')}</strong>
            <small>{t('start.mosaik.quests')}</small>
          </span>
          <img src="/hub/start-einstiege/aufgaben.webp" alt="" />
          {me.bereit.aufgaben > 0 && (
            <b className="start-kachel-badge">
              {tf('start.heute.bereit', { n: me.bereit.aufgaben })}
            </b>
          )}
          <RahmenEcken />
        </button>
        <button
          type="button"
          className="start-kachel start-holzrahmen start-rewards"
          onClick={onBelohnungen}
          aria-label={t('start.mosaik.belohnungenAria')}
        >
          <span className="start-kachel-text">
            <strong>{t('start.mosaik.belohnungen')}</strong>
            <small>{t('start.mosaik.truhen')}</small>
          </span>
          <img src="/hub/truhe-holz.webp" alt="" />
          {me.bereit.truhen > 0 && (
            <b className="start-kachel-badge">
              {tf('start.heute.bereit', { n: me.bereit.truhen })}
            </b>
          )}
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
        <button
          type="button"
          className="start-play-kreis"
          onClick={onAlleSpiele}
          aria-label={t('start.spielen.aria')}
        >
          <img
            src="/hub/start-einstiege/play.webp"
            alt=""
            fetchPriority="high"
          />
        </button>
      </section>

      {activeTable && inAppSichtbar(activeTable.gameId) && (
        <button
          type="button"
          className="hb-weiter start-holzrahmen"
          onClick={() => onResume(activeTable.gameId, activeTable.tableId)}
        >
          <span
            className="hb-weiter-bild"
            style={{
              backgroundImage: `url(${bannerFuer(activeTable.gameId)})`,
            }}
          />
          <span className="hb-weiter-text">
            <span className="hb-label">{t('start.weiter.label')}</span>
            <strong>{t(`game.${activeTable.gameId}`)}</strong>
            <span>
              {activeTable.paused
                ? t('start.weiter.pausiert')
                : activeTable.status === 'waiting'
                  ? t('start.weiter.wartet')
                  : t('start.weiter.laeuft')}
            </span>
          </span>
          <span className="hb-weiter-los" aria-hidden="true">
            ›
          </span>
          <RahmenEcken />
        </button>
      )}

      <section className="hb-blk">
        <h2 className="hb-ab">
          {t('start.spiele.titel')}
          <button type="button" className="hb-ab-mehr" onClick={onAlleSpiele}>
            {t('start.spiele.alle')}
          </button>
        </h2>
        <div className="start-favoriten">
          {eigene.length === 0 ? (
            <button type="button" className="hb-leer" onClick={onAlleSpiele}>
              {t('start.spiele.leer')}
            </button>
          ) : (
            eigene.map((s) => (
              <button
                type="button"
                className="hb-sk start-holzrahmen"
                key={s.gameId}
                onClick={() => onPick(s.gameId)}
              >
                <span
                  className="hb-sk-bild"
                  style={{ backgroundImage: `url(${bannerFuer(s.gameId)})` }}
                />
                <strong>{t(`game.${s.gameId}`)}</strong>
                <RahmenEcken />
                <span className="hb-pk">
                  <img src="/hub/symbol-pokal.webp" alt="" />
                  {zahl(s.trophies)}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
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

function RahmenEcken() {
  return (
    <span className="start-rahmen-ecken" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
