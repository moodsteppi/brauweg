import { useEffect } from 'react';
import { CHECKPOINT_MUENZEN, STATIONEN, zwischenCheckpoints } from '../trophaeenweg';
import { truhenBild } from '../truhenbild';
import { sicherAb } from './StartNeu';

/**
 * Der Trophäenweg als Vollbild (Layout von ChatGPT, 26.09.2026): alle sechs
 * Stationen auf einem Bildschirm, links die Station, rechts die Belohnung,
 * dazwischen die Checkpoints. Der Pinguin steht an der eigenen Stelle.
 *
 * Als Modal über allem, mit Schließen-Knopf und Escape (Apple: ein Vollbild
 * verdeckt die Reiterleiste, braucht dann aber einen klaren Ausgang).
 */

/** Höhe eines Bioms auf dem Bildschirm; sechs davon füllen ein iPhone. */
const BAND = 118;

export function TrophaeenwegNeu({
  trophies,
  onClose,
}: {
  trophies: number;
  onClose: () => void;
}): React.JSX.Element {
  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  const hoehe = BAND * STATIONEN.length;
  // Stationen in der Mitte ihres Bandes, von unten nach oben.
  const stationY = (i: number): number => hoehe - BAND * i - BAND / 2;
  // Checkpoints gleichmäßig in die Lücke zwischen zwei Stationen verteilt,
  // nicht nach Wert — sonst fielen sie auf die Karten der Stationen.
  const marken: { wert: number; y: number; station: number | null }[] = [];
  STATIONEN.forEach((s, i) => {
    marken.push({ wert: s.ab, y: stationY(i), station: i });
    const naechste = STATIONEN[i + 1];
    if (!naechste) return;
    const dazwischen = zwischenCheckpoints().filter((t) => t > s.ab && t < naechste.ab);
    dazwischen.forEach((t, j) => {
      // Nur im freien Raum zwischen den Karten (40 bis 88 pt über der Station),
      // sonst streifen die Schilder die Marke „Erhalten".
      const abstand = 40 + (48 * (j + 0.5)) / dazwischen.length;
      marken.push({ wert: t, y: stationY(i) - abstand, station: null });
    });
  });
  // Pinguin: zwischen den beiden Marken, zwischen denen die Trophäenzahl liegt.
  const obenMarke = marken.find((m) => m.wert > trophies);
  const untenMarke = [...marken].reverse().find((m) => m.wert <= trophies) ?? marken[0]!;
  const ichY = obenMarke
    ? untenMarke.y + (obenMarke.y - untenMarke.y) * ((trophies - untenMarke.wert) / (obenMarke.wert - untenMarke.wert))
    : stationY(STATIONEN.length - 1) - BAND * 0.3;
  const naechste = STATIONEN.find((s) => s.ab > trophies) ?? null;

  return (
    <div className="hb-voll" role="dialog" aria-modal="true" aria-label="Trophäenweg">
      <header className="hb-voll-kopf">
        <button type="button" className="hb-rund" onClick={onClose} aria-label="Schließen">
          <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="hb-voll-titel">
          <h1>Trophäenweg</h1>
          <span>alle Spiele zusammen</span>
        </div>
        <span className="hb-pill is-pk is-gross" aria-label={`${trophies} Trophäen`}>
          <img src="/hub/symbol-pokal.webp" alt="" />
          {trophies.toLocaleString('de-DE')}
        </span>
      </header>

      <div className="hb-weg-karte" style={{ height: hoehe }}>
        {STATIONEN.map((s, i) => (
          <div
            key={s.name}
            className="hb-weg-band"
            style={{ top: hoehe - BAND * (i + 1) - 24, height: BAND + 48, backgroundImage: `url(/hub/${s.biom}.webp)` }}
            aria-hidden="true"
          />
        ))}
        <div className="hb-weg-nebel" aria-hidden="true" />

        {marken
          .filter((m) => m.station === null)
          .map((m) => (
            <span key={m.wert} className={`hb-cp${m.wert <= trophies ? ' is-ok' : ''}`} style={{ top: m.y }}>
              <i aria-hidden="true" />
              <small>
                {m.wert.toLocaleString('de-DE')} · +{CHECKPOINT_MUENZEN} Münzen
              </small>
            </span>
          ))}

        {STATIONEN.map((s, i) => {
          const erreicht = trophies >= s.ab;
          return (
            <div key={s.name} className={`hb-station${erreicht ? ' is-ok' : ' is-zu'}`} style={{ top: stationY(i) }}>
              <div className="hb-st-schild">
                <strong>{s.name}</strong>
                <span className="hb-pk">
                  <img src="/hub/symbol-pokal.webp" alt="" />
                  {s.ab.toLocaleString('de-DE')}
                </span>
              </div>
              <span className="hb-st-punkt" aria-label={erreicht ? 'erreicht' : 'noch nicht erreicht'}>
                {erreicht ? (
                  <svg viewBox="0 0 24 24" className="hb-ic" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="hb-ic" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                )}
              </span>
              {s.truhe && (
                <div className="hb-st-lohn">
                  <img src={truhenBild(s.truhe.grad)} alt="" />
                  <span>
                    <b>{s.truhe.name}</b>
                    <small>{s.gegenstand}</small>
                  </span>
                  {erreicht ? (
                    <em className="is-ok">Erhalten</em>
                  ) : s === naechste ? (
                    <em>noch {(s.ab - trophies).toLocaleString('de-DE')}</em>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        <div className="hb-ich" style={{ top: ichY }}>
          <img src="/hub/pinguin-held.webp" alt="" />
          <span className="hb-ich-podest" aria-hidden="true" />
          <span className="hb-ich-zahl">
            <span className="hb-pk">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {trophies.toLocaleString('de-DE')}
            </span>
            {trophies >= 100 && <small>Sicher ab {sicherAb(trophies).toLocaleString('de-DE')}</small>}
          </span>
        </div>
      </div>
    </div>
  );
}
