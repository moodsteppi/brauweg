import { useEffect, useState } from 'react';
import { ApiError, api, type Weg, type WegFund, type WegStufe } from '../api';
import { t } from '../i18n';
import { holbar, stationenMit, type Station } from '../trophaeenweg';
import { FundBlatt } from './Aufgaben';
import { sicherAb } from './StartNeu';

/**
 * Der Trophäenweg als Vollbild (Layout von ChatGPT, 26.09.2026): alle sechs
 * Stationen auf einem Bildschirm, links die Station, rechts die Belohnung,
 * dazwischen die Checkpoints. Der Pinguin steht an der eigenen Stelle.
 *
 * Als Modal über allem, mit Schließen-Knopf und Escape (Apple: ein Vollbild
 * verdeckt die Reiterleiste, braucht dann aber einen klaren Ausgang).
 *
 * Belohnungen und ihr Zustand kommen vom Server (`/api/weg`). Abgeholt wird
 * von Hand wie bei Truhen und Tagesaufgaben: Erreichtes trägt einen goldenen
 * Knopf „Holen", danach öffnet sich die Truhe im selben Fundblatt wie unter
 * „Heute".
 */

/** Bis ein eigenes Bild bestellt ist: Bronze zeigt die Holztruhe, Diamant die offene Goldtruhe. */
const TRUHE_BILD: Record<NonNullable<Station['truhe']>['grad'], string> = {
  bronze: '/hub/truhe-holz.webp',
  silber: '/hub/truhe-silber.webp',
  gold: '/hub/truhe-gold.webp',
  diamant: '/hub/truhe-gold-offen.webp',
};

/** Höhe eines Bioms auf dem Bildschirm; sechs davon füllen ein iPhone. */
const BAND = 118;

export function TrophaeenwegNeu({
  trophies,
  onClose,
  onGuthaben,
}: {
  trophies: number;
  onClose: () => void;
  /** Meldet dem Hub, dass Guthaben und Bereitschaft neu zu laden sind. */
  onGuthaben: () => void;
}): React.JSX.Element {
  const [weg, setWeg] = useState<Weg | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Schwelle, die gerade abgeholt wird — gegen den Doppeltipp. */
  const [laeuft, setLaeuft] = useState<number | null>(null);
  const [fund, setFund] = useState<WegFund | null>(null);

  const laden = (): void => {
    void api
      .weg()
      .then(setWeg)
      .catch(() => setFehler('Der Trophäenweg ließ sich nicht laden.'));
  };
  useEffect(laden, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  const holen = (stufe: WegStufe): void => {
    if (laeuft !== null || !holbar(stufe)) return;
    setLaeuft(stufe.schwelle);
    setFehler(null);
    void api
      .wegHolen(stufe.schwelle)
      .then((ergebnis) => {
        // Eine Truhe geht im Fundblatt auf; feste Münzen brauchen keine Bühne,
        // der Checkpoint zeigt nach dem Laden selbst, was er gab.
        if (ergebnis.grad) setFund(ergebnis);
        laden();
        onGuthaben();
      })
      .catch((err: unknown) =>
        setFehler(err instanceof ApiError ? t(err.messageKey) : 'Die Belohnung ließ sich nicht holen.'),
      )
      .finally(() => setLaeuft(null));
  };

  // Der Stand vom Server, sobald er da ist: Er entscheidet, was holbar ist,
  // und die Anzeige soll dazu passen, auch wenn /api/me einen Augenblick
  // älter ist.
  const stand = weg?.trophaeen ?? trophies;
  const stationen = stationenMit(weg);
  const hoehe = BAND * stationen.length;
  // Stationen in der Mitte ihres Bandes, von unten nach oben.
  const stationY = (i: number): number => hoehe - BAND * i - BAND / 2;
  // Checkpoints gleichmäßig in die Lücke zwischen zwei Stationen verteilt,
  // nicht nach Wert — sonst fielen sie auf die Karten der Stationen.
  const checkpoints = weg?.stufen.filter((s) => s.art === 'checkpoint') ?? [];
  const marken: { wert: number; y: number; stufe: WegStufe | null; station: number | null }[] = [];
  stationen.forEach((s, i) => {
    marken.push({ wert: s.ab, y: stationY(i), stufe: s.stufe, station: i });
    const naechste = stationen[i + 1];
    if (!naechste) return;
    const dazwischen = checkpoints.filter((c) => c.schwelle > s.ab && c.schwelle < naechste.ab);
    dazwischen.forEach((c, j) => {
      // Nur im freien Raum zwischen den Karten (40 bis 88 pt über der Station),
      // sonst streifen die Schilder die Marke „Erhalten".
      const abstand = 40 + (48 * (j + 0.5)) / dazwischen.length;
      marken.push({ wert: c.schwelle, y: stationY(i) - abstand, stufe: c, station: null });
    });
  });
  marken.sort((a, b) => a.wert - b.wert);
  // Pinguin: zwischen den beiden Marken, zwischen denen die Trophäenzahl liegt.
  const obenMarke = marken.find((m) => m.wert > stand);
  const untenMarke = [...marken].reverse().find((m) => m.wert <= stand) ?? marken[0]!;
  const ichY = obenMarke
    ? untenMarke.y + (obenMarke.y - untenMarke.y) * ((stand - untenMarke.wert) / (obenMarke.wert - untenMarke.wert))
    : stationY(stationen.length - 1) - BAND * 0.3;
  const naechste = stationen.find((s) => s.ab > stand) ?? null;

  // Über 1.000: alle 250 eine Silbertruhe. Die kleinste holbare zuerst, sonst
  // die nächste als Ziel — eine Zeile statt einer Liste, die bei 3.000
  // Trophäen den Himmel füllen würde.
  const weiter = weg?.stufen.filter((s) => s.art === 'weiter') ?? [];
  const weiterHolbar = weiter.filter(holbar);
  const weiterNaechste = weiter.find((s) => !s.erreicht) ?? null;

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
        <span className="hb-pill is-pk is-gross" aria-label={`${stand} Trophäen`}>
          <img src="/hub/symbol-pokal.webp" alt="" />
          {stand.toLocaleString('de-DE')}
        </span>
      </header>
      {fehler && (
        <p className="hb-fehler hb-weg-fehler" role="alert">
          {fehler}
        </p>
      )}

      <div className="hb-weg-karte" style={{ height: hoehe }}>
        {stationen.map((s, i) => (
          <div
            key={s.name}
            className="hb-weg-band"
            style={{ top: hoehe - BAND * (i + 1) - 24, height: BAND + 48, backgroundImage: `url(/hub/${s.biom}.webp)` }}
            aria-hidden="true"
          />
        ))}
        <div className="hb-weg-nebel" aria-hidden="true" />

        {weiterHolbar[0] ? (
          <button
            type="button"
            className="hb-weg-weiter is-holbar"
            disabled={laeuft !== null}
            onClick={() => holen(weiterHolbar[0]!)}
            aria-label={`Silbertruhe bei ${weiterHolbar[0].schwelle} Trophäen holen${weiterHolbar.length > 1 ? `, ${weiterHolbar.length - 1} weitere bereit` : ''}`}
          >
            <img src={TRUHE_BILD.silber} alt="" />
            <span>
              Holen · {weiterHolbar[0].schwelle.toLocaleString('de-DE')}
              {weiterHolbar.length > 1 && <small>+{weiterHolbar.length - 1} weitere</small>}
            </span>
          </button>
        ) : (
          // Unter 1.000 ist der Sternenhafen das Ziel; der Hinweis auf die
          // Truhen dahinter käme dort nur den Schildern in die Quere.
          stand >= 1000 &&
          weiterNaechste && (
            <span className="hb-weg-weiter">
              <img src={TRUHE_BILD.silber} alt="" />
              <span>
                Alle 250 eine Silbertruhe
                <small>nächste bei {weiterNaechste.schwelle.toLocaleString('de-DE')}</small>
              </span>
            </span>
          )
        )}

        {marken
          .filter((m) => m.station === null && m.stufe)
          .map(({ wert, y, stufe }) => {
            const muenzen = stufe!.muenzen ?? 0;
            const schild = (
              <>
                <i aria-hidden="true" />
                <small>
                  {wert.toLocaleString('de-DE')} · {stufe!.geholt ? `✓ ${stufe!.coins ?? muenzen}` : `+${muenzen}`} Münzen
                  {holbar(stufe) && <b> holen</b>}
                </small>
              </>
            );
            // Holbar ist das ganze Schild der Knopf (Punkt und Beschriftung), mit
            // 44 pt Trefferfläche — ein eigener kleiner Knopf daneben fände
            // zwischen zwei Checkpoints mit 24 pt Abstand keinen Platz.
            return holbar(stufe) ? (
              <button
                type="button"
                key={wert}
                className="hb-cp is-ok is-holbar"
                style={{ top: y }}
                disabled={laeuft !== null}
                onClick={() => holen(stufe!)}
                aria-label={`Checkpoint ${wert}: ${muenzen} Münzen holen`}
              >
                {schild}
              </button>
            ) : (
              <span key={wert} className={`hb-cp${wert <= stand ? ' is-ok' : ''}${stufe!.geholt ? ' is-geholt' : ''}`} style={{ top: y }}>
                {schild}
              </span>
            );
          })}

        {stationen.map((s, i) => {
          const erreicht = stand >= s.ab;
          const bereit = holbar(s.stufe);
          const lohnText = s.truhe && (
            <>
              <img src={TRUHE_BILD[s.truhe.grad]} alt="" />
              <span>
                <b>{t(`truhe.${s.truhe.grad}`)}</b>
                {s.gegenstand && <small>{t(`weg.${s.gegenstand}`)}</small>}
              </span>
            </>
          );
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
              {s.truhe &&
                (bereit ? (
                  // Die ganze Karte ist der Knopf (DESIGN.md: wo eine Karte als
                  // Ganzes antippbar ist, ist sie das Ziel) — 150 × 54 pt.
                  <button
                    type="button"
                    className="hb-st-lohn is-holbar"
                    disabled={laeuft !== null}
                    onClick={() => holen(s.stufe!)}
                    aria-label={`${s.name}: ${t(`truhe.${s.truhe.grad}`)}${s.gegenstand ? ` und ${t(`weg.${s.gegenstand}`)}` : ''} holen`}
                  >
                    {lohnText}
                    <em className="is-holen" aria-hidden="true">
                      Holen
                    </em>
                  </button>
                ) : (
                  <div className="hb-st-lohn">
                    {lohnText}
                    {s.stufe?.geholt ? (
                      <em className="is-ok">Erhalten</em>
                    ) : s === naechste ? (
                      <em>noch {(s.ab - stand).toLocaleString('de-DE')}</em>
                    ) : null}
                  </div>
                ))}
            </div>
          );
        })}

        <div className="hb-ich" style={{ top: ichY }}>
          <img src="/hub/pinguin-held.webp" alt="" />
          <span className="hb-ich-podest" aria-hidden="true" />
          <span className="hb-ich-zahl">
            <span className="hb-pk">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {stand.toLocaleString('de-DE')}
            </span>
            {stand >= 100 && <small>Sicher ab {sicherAb(stand).toLocaleString('de-DE')}</small>}
          </span>
        </div>
      </div>
      {fund?.grad && <FundBlatt fund={{ grad: fund.grad, coins: fund.coins }} onClose={() => setFund(null)} />}
    </div>
  );
}
