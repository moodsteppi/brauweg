import type { Spielart, Suchstand } from '../api';
import { AuswahlRaster } from '../hub';
import { t } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import { SpielRahmen } from '../screens/SpielEinstieg';
import { bannerFuer } from '../screens/StartNeu';
import { spielartBild } from './bilder';

import './spielarten.css';

/*
 * Name und Satz einer Spielart. Funktionen und keine Tabelle: Eine Tabelle
 * waere beim Laden der Datei in der Sprache von damals ausgefuellt.
 */
export function spielartName(gameId: string, id: string): string {
  return t(`spielart.${gameId}.${id}.name`);
}
export function spielartText(gameId: string, id: string): string {
  return t(`spielart.${gameId}.${id}.text`);
}

/**
 * Die Spielarten eines Spiels als Karten mit Bild (Robin, 28.11.2026: „wie bei
 * Farbduell"). Antippen WAEHLT aus — los geht es erst mit dem goldenen
 * Quick-Play-Knopf darunter. Das Raster ist `AuswahlRaster` aus hub.tsx, also
 * dieselbe Bedienung wie die Spielart bei Farbduell und die Bahn bei Golf.
 *
 * Das Bild kommt aus der Liste in `bilder.ts`; fehlt es, steht das Banner des
 * Spiels da — nie ein `<img>` auf eine Datei, die es noch nicht gibt.
 * `vorschau` ersetzt beides fuer Spiele, deren Karte das Spielfeld selbst
 * zeichnet (Golf: Bahnminiatur).
 */
export function SpielartKarten({
  gameId,
  spielarten,
  gewaehlt,
  onWahl,
  vorschau,
  hinweis,
  gesperrt,
}: {
  gameId: string;
  spielarten: readonly Spielart[];
  gewaehlt: string | null;
  onWahl: (id: string) => void;
  /** Gezeichnete Miniatur statt Bild — null heisst: Bild bzw. Banner. */
  vorschau?: (art: Spielart) => React.ReactNode | null;
  /** Ein Zusatz hinter dem Satz, z. B. was die Spielart kostet. */
  hinweis?: (art: Spielart) => string | null;
  /** Der GRUND, warum die Karte nicht waehlbar ist (gekauftes Paket fehlt). */
  gesperrt?: (art: Spielart) => string | null;
}): React.JSX.Element {
  /*
   * Kompakt seit dem 28.11.2026 abends (Robin: der Einstieg soll auf einem
   * grossen Handy ohne Rollen passen). Bis vier Spielarten stehen in EINER
   * Reihe mit kleinem Bild und nur dem Namen; der Satz steht einmal darunter,
   * fuer die gewaehlte Karte. Vier Saetze in vier schmalen Karten machten
   * jede Karte doppelt so hoch und waren auf 80 px Breite kaum zu lesen. Mehr
   * als vier (Golf, sieben Kurse) laufen als waagerecht wischbare Reihe,
   * statt in Zweierreihen nach unten zu wachsen.
   *
   * Der Sperrgrund bleibt AN der Karte: Er ist die Nachricht dieser einen
   * Karte, nicht der gewaehlten.
   */
  const wisch = spielarten.length > 4;
  const gewaehlteArt = spielarten.find((a) => a.id === gewaehlt) ?? null;
  const zusatz = gewaehlteArt ? (hinweis?.(gewaehlteArt) ?? null) : null;
  const beschreibung = gewaehlteArt ? spielartText(gameId, gewaehlteArt.id) : null;
  return (
    <>
      <AuswahlRaster
        label={t('einstieg.spielart')}
        className={`spa-karten${wisch ? ' is-wisch' : ''}`}
        spalten={wisch ? undefined : Math.max(spielarten.length, 1)}
        gewaehlt={gewaehlt}
        onWahl={(id) => onWahl(id)}
        eintraege={spielarten.map((art) => ({
          kennung: art.id,
          titel: spielartName(gameId, art.id),
          vorschau: <SpielartBild gameId={gameId} art={art} vorschau={vorschau?.(art) ?? null} />,
          deaktiviert: gesperrt?.(art) ?? undefined,
        }))}
      />
      {beschreibung && (
        <p className="spa-beschreibung" aria-live="polite">
          {zusatz ? `${beschreibung} ${zusatz}` : beschreibung}
        </p>
      )}
    </>
  );
}

function SpielartBild({
  gameId,
  art,
  vorschau,
}: {
  gameId: string;
  art: Spielart;
  vorschau: React.ReactNode | null;
}): React.JSX.Element {
  if (vorschau !== null) return <span className="spa-art is-gezeichnet">{vorschau}</span>;
  const bild = spielartBild(gameId, art.id);
  return (
    <span className={`spa-art${bild ? '' : ' is-banner'}`} data-bild={bild ? 'spielart' : 'banner'}>
      <img src={bild ?? bannerFuer(gameId)} alt="" draggable={false} />
    </span>
  );
}

/**
 * Die eine grosse Karte fuer Spiele ohne Spielarten (Tafelrunde, DreckBro …):
 * Banner und ein Satz, darunter dieselben drei Knoepfe wie ueberall.
 */
export function EinzelKarte({ gameId, text }: { gameId: string; text?: string }): React.JSX.Element {
  return (
    <div className="spa-einzel">
      <span className="spa-art is-banner">
        <img src={bannerFuer(gameId)} alt="" draggable={false} />
      </span>
      <p className="spe-text">{text ?? t('einstieg.text.ohneSpielart')}</p>
    </div>
  );
}

/**
 * Der Bildschirm waehrend der Suche: Countdown, wie viele gefunden sind,
 * Abbrechen. Dasselbe Bild wie bei Farbduell, nur mit den Texten des
 * Einstiegs.
 */
export function SuchWarten({
  gameId,
  stand,
  unter,
  akzent,
  onAbbrechen,
}: {
  gameId: string;
  stand: Suchstand;
  unter?: string;
  akzent?: string;
  onAbbrechen: () => void;
}): React.JSX.Element {
  const sekunden = Math.max(0, Math.ceil(stand.restMs / 1000));
  return (
    <SpielRahmen
      gameId={gameId}
      titel={t('einstieg.suche.titel')}
      unter={unter}
      akzent={akzent}
      onBack={onAbbrechen}
      zurueckText={t('einstieg.suche.abbrechen')}
      fuss={
        <button type="button" className="hb-kn is-blau is-breit" onClick={onAbbrechen}>
          {t('einstieg.suche.abbrechen')}
        </button>
      }
    >
      <div className="spe-warten" data-suche={gameId}>
        <p className="spe-countdown" aria-live="polite">
          {sekunden}
        </p>
        <p className="spe-text">
          {stand.suchende <= 1 ? t('einstieg.suche.allein') : tn('einstieg.suche.gefunden', stand.suchende)}
        </p>
        <div className="spe-lauf" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </SpielRahmen>
  );
}

/** Die Zeile unter dem Quick-Play-Knopf: in welcher Spielart gesucht wird. */
export function quickplayUnter(gameId: string, art: Spielart | null): string | null {
  return art ? tf('einstieg.quickplay.unter', { spielart: spielartName(gameId, art.id) }) : null;
}
