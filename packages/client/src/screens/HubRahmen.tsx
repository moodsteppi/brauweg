import { useCallback, useRef, useState } from 'react';
import { useHubWischen } from './hub-wischen';
import type { Me } from '../api';
import { mitEdelsteinen, serverAdresse } from '../laufzeit';
import { kompakteZahl, t } from '../i18n';
import { tf } from '../i18n/einsetzen';

/** Bis 9.999 ausgeschrieben (wie im Entwurf), darüber kurz („12K“). */
const zahl = (n: number): string => (n < 10000 ? n.toLocaleString('de-DE') : kompakteZahl(n));
import { Pinguin } from '../pinguin';
import { spiele } from '../klang';

/**
 * Der Rahmen des neuen Hubs: Kopf, Online-Zeile, Inhalt, Reiterleiste.
 *
 * Zustand, Wisch-Geste und alle Blätter bleiben in GameSelect — dieser
 * Rahmen zeichnet nur. So geht beim Umbau keine Funktion verloren: Was das
 * alte Hub kann, kann das neue auch, es sieht nur anders aus.
 */

type Reiter = 'shop' | 'clan' | 'spielen' | 'blatt' | 'profil' | 'spiele';

// Nur Symbole: Die Beschriftung kommt beim Zeichnen aus `rahmen.reiter.<reiter>`,
// sonst bliebe sie in der Sprache stehen, in der das Modul geladen wurde.
const REITER: Record<Reiter, { icon: React.JSX.Element }> = {
  shop: { icon: <path d="M5 8h14l-1 12H6z M9 8a3 3 0 0 1 6 0" /> },
  spiele: {
    icon: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </>
    ),
  },
  spielen: { icon: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /> },
  blatt: { icon: <path d="M5 7l7-3 7 3v10l-7 3-7-3z M5 7l7 3 7-3M12 10v10" /> },
  clan: { icon: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /> },
  profil: {
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </>
    ),
  },
};

function Symbol({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function NeuerRahmen<T extends Reiter>({
  me,
  tab,
  tabFolge,
  online,
  trophies,
  kaufbar,
  onTab,
  renderTab,
  zurueck,
  children,
}: {
  me: Me;
  tab: T;
  tabFolge: T[];
  online: number | null;
  trophies: number;
  /** Der Münz-Shop ist erreichbar; Echtgeldpakete gehören nicht in diesen Reiter. */
  kaufbar: boolean;
  onTab: (tab: T) => void;
  renderTab: (tab: T) => React.JSX.Element | null;
  /** Unterseite im offenen Reiter: Wisch nach rechts führt zurück statt zum Nachbarn (hub-wischen.ts). */
  zurueck?: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const inhalt = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Jeder Reiter hat seinen festen Platz im Track, damit beim Ziehen die
  // Nachbarseite schon daneben liegt. Der offene Reiter steht nicht in der
  // Leiste (Profil auf der Webseite)? Dann bekommt er einen Platz am Ende.
  const seiten = tabFolge.includes(tab) ? tabFolge : [...tabFolge, tab];
  // Gerendert wird nur, was schon offen war oder gerade angefasst wird —
  // sonst lüde der Start alle Reiter auf einmal. Was einmal hing, bleibt
  // hängen: Wer zurückwischt, sieht die Seite, nicht „wird geladen…".
  const [geladen, setGeladen] = useState<ReadonlySet<T>>(() => new Set([tab]));
  const vorbereiten = useCallback((tabs: T[]) => {
    setGeladen((alt) => (tabs.every((t) => alt.has(t)) ? alt : new Set([...alt, ...tabs])));
  }, []);
  const zeigt = geladen.has(tab) ? geladen : new Set([...geladen, tab]);
  if (zeigt !== geladen) setGeladen(zeigt);
  useHubWischen(inhalt, trackRef, tab, tabFolge, seiten, onTab, vorbereiten, zurueck);
  const zumShop = kaufbar ? () => onTab('shop' as T) : undefined;
  // Der Kopf mit Spieler und Guthaben steht nur auf dem Start (Bauplan); die
  // anderen Reiter haben ihre eigene Überschrift. Er hängt im Platz des
  // Starts und zieht mit ihm zur Seite — stünde er über dem Track, spränge
  // der Inhalt beim Wechsel um seine Höhe.
  const kopf = (
    <>
      <header className="hb-kopf">
        <button type="button" className="hb-spieler" onClick={() => onTab('profil' as T)} aria-label={tf('rahmen.spieler.aria', { name: me.displayName, stufe: me.level.stufe })}>
          {me.avatarUrl ? (
            <img className="hb-ava" src={serverAdresse(me.avatarUrl)} alt="" draggable={false} />
          ) : (
            <span className="hb-ava">
              <Pinguin getragen={me.avatar} groesse={2.2} />
            </span>
          )}
          <span className="hb-wer">
            <strong>{me.displayName}</strong>
            <span>{tf('rahmen.stufe', { stufe: me.level.stufe })}</span>
            <span className="hb-balken is-xp" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round((me.level.imLevel / Math.max(1, me.level.fuerLevel)) * 100))}%` }} />
            </span>
          </span>
        </button>
        <div className="hb-geld">
          <span className="hb-pill is-pk" aria-label={tf('rahmen.trophaeen', { n: trophies })}>
            <img src="/hub/symbol-pokal.webp" alt="" />
            {zahl(trophies)}
          </span>
          {[
            { wert: me.coins, bild: '/hub/symbol-muenze.webp', name: 'muenzen' },
            ...(mitEdelsteinen() ? [{ wert: me.gems, bild: '/hub/symbol-edelstein.webp', name: 'edelsteine' }] : []),
          ].map(({ wert, bild, name }) =>
            zumShop ? (
              <button type="button" key={name} className="hb-pill" onClick={zumShop} aria-label={tf(`rahmen.${name}.zumShop`, { n: wert })}>
                <img src={bild} alt="" />
                {zahl(wert)}
              </button>
            ) : (
              <span key={name} className="hb-pill" aria-label={tf(`rahmen.${name}`, { n: wert })}>
                <img src={bild} alt="" />
                {zahl(wert)}
              </span>
            ),
          )}
        </div>
      </header>
      {/* Gezaehlt wird, wer gerade an einem Tisch sitzt (`/api/aktiv`), nicht
          wer die App offen hat — „online" hiess es trotzdem, und wer sie
          oeffnete, las „0 Spieler online", waehrend er selbst online war. Bei
          null steht die Zeile gar nicht da: Eine Null ist keine Auskunft,
          sondern sieht nach leerem Laden aus. */}
      {online !== null && online > 0 && (
        <div className="hb-online">
          <span className="hb-punkt" aria-hidden="true" />
          {tf('rahmen.online', { n: online.toLocaleString('de-DE') })}
        </div>
      )}
    </>
  );
  return (
    <div className="hb">
      {/* Wischen zieht die Hauptseiten mit (hub-wischen.ts); horizontale
          Spielreihen behalten ihre Geste. */}
      <div className="hb-inhalt" ref={inhalt}>
        <div className="front-track hb-track" ref={trackRef}>
          {seiten.map((tt) => (
            // Die Seiten daneben sind nur Vorschau: weder antippbar noch
            // per Tab oder Vorlesen erreichbar, bis sie offen sind.
            <div
              className={`hb-reiterplatz${tt === 'spielen' ? ' is-start' : ''}`}
              key={tt}
              inert={tt !== tab}
              aria-hidden={tt !== tab || undefined}
            >
              {tt === 'spielen' && kopf}
              <div className="hb-seite">{zeigt.has(tt) && renderTab(tt)}</div>
            </div>
          ))}
        </div>
      </div>

      <nav className="hb-tabs" aria-label={t('rahmen.bereiche')}>
        {tabFolge.map((r) => {
          const { icon } = REITER[r];
          const label = t(`rahmen.reiter.${r}`);
          const haupt = r === 'spielen';
          // Punkt am Profil: Geburtstagsgeschenk. Punkt am Start: unter „Heute"
          // oder auf dem Trophäenweg liegt etwas bereit — beides erreicht man
          // nur über den Start.
          const bereit = me.bereit.truhen + me.bereit.aufgaben + (me.bereit.weg ?? 0);
          const punkt = (r === 'profil' && me.birthdayRewardClaimable) || (haupt && bereit > 0);
          return (
            <button
              type="button"
              key={r}
              className={`hb-tab${haupt ? ' is-haupt' : ''}${tab === r ? ' is-an' : ''}`}
              aria-current={tab === r ? 'page' : undefined}
              aria-label={
                punkt
                  ? haupt
                    ? tf('rahmen.reiter.bereit', { reiter: label, n: bereit })
                    : tf('rahmen.reiter.geschenk', { reiter: label })
                  : label
              }
              onClick={() => {
                spiele('tipp');
                onTab(r);
              }}
            >
              {haupt ? (
                <span className="hb-tab-rund">
                  <Symbol>{icon}</Symbol>
                </span>
              ) : (
                <Symbol>{icon}</Symbol>
              )}
              <span>{label}</span>
              {punkt && <span className="hb-tab-punkt" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
