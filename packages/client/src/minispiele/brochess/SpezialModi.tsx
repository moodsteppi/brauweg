import { useState } from 'react';

import { t } from '../../i18n';
import { HbBlatt } from '../../screens/HbBlatt';
import stil from './BroChess.module.css';
import { KLASSISCH, type ModusWahl, SPEZIAL_MODI, modusFelder, modusVon, waehleModus } from './modusliste';

/** Das kleine Symbol eines Modus, aus den Pfaden seines Eintrags. */
function ModusSymbol({ pfade }: { pfade: readonly string[] }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={stil.modusSymbol} aria-hidden="true">
      {pfade.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Vier Felder eines Bretts, eins davon leuchtet — das Zeichen des Knopfs selbst. */
const KNOPF_SYMBOL = ['M4 4h16v16H4z', 'M12 4v16', 'M4 12h16', 'M14.5 6.5l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3z'];

/** Was gerade gewählt ist, als eine Zeile: „Klassisches Schach" oder „Secret Dame · Regel A". */
export function modusText(wahl: ModusWahl): string {
  const modus = modusVon(wahl.modus);
  if (!modus) return t('brochess.modi.klassisch');
  const variante = modus.varianten.find((v) => v.id === wahl.variante);
  return variante ? `${t(modus.name)} · ${t(variante.kurz)}` : t(modus.name);
}

/**
 * Der Knopf „Spezial-Modi" in der Lobby. Gut sichtbar mit Absicht: Secret
 * Dame stand vorher als Abschnitt mitten im Formular „Tisch erstellen" und
 * wurde nicht gefunden (Tom, 13.11.2026). Er zeigt, was gewählt ist, damit
 * niemand eine Spezialpartie startet, ohne es zu merken.
 */
export function SpezialModiKnopf({ wahl, onClick }: { wahl: ModusWahl; onClick: () => void }): React.JSX.Element {
  const an = wahl.modus !== null;
  return (
    <button
      type="button"
      className={`${stil.modiKnopf}${an ? ` ${stil.modiKnopfAn}` : ''}`}
      onClick={onClick}
      aria-haspopup="dialog"
    >
      <ModusSymbol pfade={modusVon(wahl.modus)?.symbol ?? KNOPF_SYMBOL} />
      <span>
        <strong>{t('brochess.modi.knopf')}</strong>
        <small>{modusText(wahl)}</small>
      </span>
      <span className="hb-pf" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/**
 * Die Auswahl: eine Karte je Eintrag in `SPEZIAL_MODI`, beim gewählten
 * Modus darunter seine Varianten. Wählt nur — was davon an den Tisch geht,
 * steht in `modusFelder`, und ob es gilt, prüft das Modul.
 */
export function SpezialModiAuswahl({
  wahl,
  onWahl,
}: {
  wahl: ModusWahl;
  onWahl: (wahl: ModusWahl) => void;
}): React.JSX.Element {
  return (
    <div className={stil.modiListe}>
      {SPEZIAL_MODI.map((modus) => {
        const an = wahl.modus === modus.id;
        return (
          <div key={modus.id} className={`${stil.modusKarte}${an ? ` ${stil.modusKarteAn}` : ''}`}>
            <button
              type="button"
              className={stil.modusKopf}
              aria-pressed={an}
              onClick={() => onWahl(an ? KLASSISCH : waehleModus(modus.id))}
            >
              <ModusSymbol pfade={modus.symbol} />
              <span>
                <strong>{t(modus.name)}</strong>
                <small>{t(modus.regel)}</small>
              </span>
              <span className={stil.modusHaken} aria-hidden="true">
                {an ? '✓' : ''}
              </span>
            </button>
            {an && modus.varianten.length > 0 && (
              <div className={stil.modusVarianten}>
                <p className="hb-klein">{t('brochess.spielart.hinweis')}</p>
                <div
                  className={`spe-wahl ${stil.regelWahl}`}
                  role="group"
                  aria-label={t('brochess.spielart.regelAria')}
                >
                  {modus.varianten.map((v, i) => (
                    <button
                      type="button"
                      key={v.id}
                      className={`spe-wahl-knopf${wahl.variante === v.id ? ' is-an' : ''}`}
                      aria-pressed={wahl.variante === v.id}
                      onClick={() => onWahl({ modus: modus.id, variante: v.id })}
                    >
                      <strong>
                        {t(v.kurz)}
                        {i === 0 && <span className={stil.regelVorgabe}> · {t('brochess.spielart.vorgabe')}</span>}
                      </strong>
                      <small>{t(v.satz)}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {wahl.modus !== null && (
        <button type="button" className="hb-kn is-breit" onClick={() => onWahl(KLASSISCH)}>
          {t('brochess.modi.klassischSpielen')}
        </button>
      )}
    </div>
  );
}

/**
 * Knopf, Blatt und Zustand für die Lobby — hier statt in Lobby.tsx, damit
 * alles Wissen über die Modi bei BroChess bleibt und die Lobby nur drei
 * Dinge verdrahtet: `felder` in die `config` von `createTable`, `knopf` in
 * die Bildschirme, `blatt` daneben.
 *
 * Gilt für den Tisch mit Menschen UND gegen den Bot: Seit dem 13.11.2026
 * spielt der Bot Secret Dame (packages/game-brochess/src/bot.ts). Ein
 * künftiger Modus ohne Bot braucht dann hier eine Weiche — heute gibt es
 * keinen, also auch keine.
 *
 * Bei `aktiv = false` (jedes andere Spiel) gibt es nichts zu zeigen und
 * keine Felder — dort entsteht derselbe Tisch wie bisher.
 */
export function useSpezialModi(aktiv: boolean): {
  felder: Record<string, unknown>;
  knopf: React.JSX.Element | null;
  blatt: React.JSX.Element | null;
} {
  const [wahl, setWahl] = useState<ModusWahl>(KLASSISCH);
  const [offen, setOffen] = useState(false);
  if (!aktiv) return { felder: {}, knopf: null, blatt: null };
  return {
    felder: modusFelder(wahl),
    knopf: <SpezialModiKnopf wahl={wahl} onClick={() => setOffen(true)} />,
    blatt: offen ? (
      <HbBlatt titel={t('brochess.modi.knopf')} onClose={() => setOffen(false)}>
        <SpezialModiAuswahl wahl={wahl} onWahl={setWahl} />
        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => setOffen(false)}>
          {t('brochess.modi.fertig')}
        </button>
      </HbBlatt>
    ) : null,
  };
}
