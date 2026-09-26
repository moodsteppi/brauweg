import type { RefObject } from 'react';
import type { Me } from '../api';
import { serverAdresse } from '../laufzeit';
import { kompakteZahl } from '../i18n';

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

const REITER: Record<Reiter, { label: string; icon: React.JSX.Element }> = {
  shop: { label: 'Shop', icon: <path d="M5 8h14l-1 12H6z M9 8a3 3 0 0 1 6 0" /> },
  spiele: {
    label: 'Spiele',
    icon: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </>
    ),
  },
  spielen: { label: 'Start', icon: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /> },
  blatt: { label: 'Sammlung', icon: <path d="M5 7l7-3 7 3v10l-7 3-7-3z M5 7l7 3 7-3M12 10v10" /> },
  clan: { label: 'Clan', icon: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /> },
  profil: {
    label: 'Profil',
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
  fenster,
  trackRef,
  renderTab,
  children,
}: {
  me: Me;
  tab: T;
  tabFolge: T[];
  online: number | null;
  trophies: number;
  /** Im App-Paket gibt es keinen Shop; die Pillen sind dann reine Anzeigen. */
  kaufbar: boolean;
  onTab: (tab: T) => void;
  fenster: T[];
  trackRef: RefObject<HTMLDivElement | null>;
  renderTab: (tab: T) => React.JSX.Element | null;
  children: React.ReactNode;
}): React.JSX.Element {
  const zumShop = kaufbar ? () => onTab('shop' as T) : undefined;
  return (
    <div className={`hb${tab === 'spielen' ? '' : ' is-ohne-kopf'}`}>
      {/* Der Kopf mit Spieler und Guthaben steht nur auf dem Start (Bauplan);
          die anderen Reiter haben ihre eigene Überschrift. */}
      {tab === 'spielen' && (
      <header className="hb-kopf">
        <button type="button" className="hb-spieler" onClick={() => onTab('profil' as T)} aria-label={`${me.displayName}, Stufe ${me.level.stufe}, zum Profil`}>
          {me.avatarUrl ? (
            <img className="hb-ava" src={serverAdresse(me.avatarUrl)} alt="" draggable={false} />
          ) : (
            <span className="hb-ava">
              <Pinguin getragen={me.avatar} groesse={2.2} />
            </span>
          )}
          <span className="hb-wer">
            <strong>{me.displayName}</strong>
            <span>Stufe {me.level.stufe}</span>
            <span className="hb-balken is-xp" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round((me.level.imLevel / Math.max(1, me.level.fuerLevel)) * 100))}%` }} />
            </span>
          </span>
        </button>
        <div className="hb-geld">
          <span className="hb-pill is-pk" aria-label={`${trophies} Trophäen`}>
            <img src="/hub/symbol-pokal.webp" alt="" />
            {zahl(trophies)}
          </span>
          {[
            { wert: me.coins, bild: '/hub/symbol-muenze.webp', name: 'Münzen' },
            { wert: me.gems, bild: '/hub/symbol-edelstein.webp', name: 'Edelsteine' },
          ].map(({ wert, bild, name }) =>
            zumShop ? (
              <button type="button" key={name} className="hb-pill" onClick={zumShop} aria-label={`${wert} ${name}, zum Shop`}>
                <img src={bild} alt="" />
                {zahl(wert)}
              </button>
            ) : (
              <span key={name} className="hb-pill" aria-label={`${wert} ${name}`}>
                <img src={bild} alt="" />
                {zahl(wert)}
              </span>
            ),
          )}
        </div>
      </header>
      )}
      {tab === 'spielen' && online !== null && (
        <div className="hb-online">
          <span className="hb-punkt" aria-hidden="true" />
          {online.toLocaleString('de-DE')} Spieler online
        </div>
      )}

      {/* Kein Wischen zwischen den Reitern (Robin, 26.09.2026): Im neuen Hub
          rollen Spielreihen und Filter selbst waagerecht, und ein Wisch darin
          sprang auf den Nachbarreiter, statt die Reihe weiterzuschieben.
          Gewechselt wird über die Leiste unten — so hält es auch Apple. */}
      <div className="hb-inhalt">
        <div className="front-track hb-track" ref={trackRef}>
          {fenster.map((tt) => (
            <div className="hb-seite" key={tt}>
              {renderTab(tt)}
            </div>
          ))}
        </div>
      </div>

      <nav className="hb-tabs" aria-label="Bereiche">
        {tabFolge.map((r) => {
          const { label, icon } = REITER[r];
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
              aria-label={punkt ? (haupt ? `${label}, ${bereit} bereit` : `${label}, Geschenk liegt bereit`) : label}
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
