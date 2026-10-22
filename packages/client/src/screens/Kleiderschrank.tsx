/**
 * Kleiderschrank — hier wird der Pinguin angezogen.
 *
 * **Der Pinguin steht oben und bleibt stehen.** Jede Wahl aendert ihn sofort,
 * in der Groesse, in der er auch auf dem Startbildschirm sitzt. Das ist
 * dieselbe Regel wie bei den Kartenblaettern (DESIGN.md, „Themen-Vorschau"):
 * Was am Ende wirkt, wird gezeigt und nicht beschrieben — ein Hut in
 * Daumennagelgroesse sagt nichts darueber, wie er auf dem Pinguin sitzt.
 *
 * **Gekauft wird hier auch.** Ein getrennter Shop fuer Kleidung und ein
 * Schrank zum Anziehen waeren zwei Wege zum selben Stueck, und man muesste
 * zwischen ihnen hin und her, um zu sehen, ob sich der Kauf lohnt. Also: ein
 * Tipp auf ein fremdes Stueck zeigt den Preis, ein zweiter kauft — und danach
 * sitzt es sofort.
 *
 * Der Besitz wird trotzdem am Server geprueft, nicht hier: Diese Datei kann
 * einen Knopf ausgrauen, aber sie kann nichts verhindern.
 */

import { useEffect, useState } from 'react';
import { Ladekreis } from '../Ladekreis';

import {
  ApiError,
  SLOTS,
  api,
  type Getragen,
  type RegalStueck,
  type Shop,
  type Slot,
  type Waehrung,
} from '../api';
import { mitEdelsteinen } from '../laufzeit';
import { Pinguin, StueckAllein, StueckBild } from '../pinguin';
import { EdelsteinIcon, Tafel } from '../hub';
import { t } from '../i18n';
import { HbBlatt, Schliessen } from './HbBlatt';
import './spind.css';

/**
 * Die Plaetze als Schubladen im Spind: je Platz ein kleines Zeichen.
 * Gezeichnet statt geladen, weil es sechs Striche sind und kein Bild.
 */
const SCHUBLADEN_ZEICHEN: Readonly<Record<Slot, string>> = {
  hut: 'M4 15h16M7 15c0-5 2-8 5-8s5 3 5 8',
  brille: 'M3 11h2m14 0h2M5 11a3 3 0 1 0 6 0a3 3 0 1 0-6 0m8 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  oberteil: 'M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-1 2-2 3-4 3S9 6 8 4z',
  schuhe: 'M4 16v-5c2 0 4-1 5-3h3v5l7 2v3H4z',
  hand: 'M12 3v9M8 6v7M16 6v7M5 13c1 5 4 8 7 8s6-3 7-8',
  aura: 'M12 3l2 5 5 .5-4 3.5 1.5 5L12 14l-4.5 3 1.5-5-4-3.5L10 8z',
};

/** Oberteile haengen am Buegel, der Rest liegt im Fach. */
const AM_BUEGEL: ReadonlySet<Slot> = new Set<Slot>(['oberteil']);

/** Betrag mit Einheit, Einzahl beachtet: „1 Münze", „8 Edelsteine". */
function betragText(betrag: number, waehrung: Waehrung): string {
  const einheit = betrag === 1 ? t(`waehrung.${waehrung}.eins`) : t(`waehrung.${waehrung}`);
  return `${betrag} ${einheit}`;
}

/**
 * Preis als lesbare Zeile, oder „Gehört dir" / „Geschenk".
 *
 * **Beide Preise stehen dran, nicht nur einer.** Ein Stück, das für Münzen
 * ausgezeichnet ist und heimlich auch für Edelsteine zu haben wäre, macht aus
 * dem Kleiderschrank ein Ratespiel — und wer nur Edelsteine hat, hielte das
 * halbe Regal für gesperrt.
 */
function preisText(stueck: RegalStueck): string {
  if (stueck.besessen) return 'Gehört dir';
  if (stueck.geschenk) return 'Nur zu bekommen';
  return `${betragText(stueck.preis.coins, 'coins')} oder ${betragText(stueck.preis.gems, 'gems')}`;
}

export function Kleiderschrank({
  getragen,
  onClose,
  onGetragen,
  onGuthaben,
  neu = false,
}: {
  /** Neues Hub: Vollbild in Nachtblau & Gold, dieselben Käufe und Rückfragen. */
  neu?: boolean;
  /** Was gerade sitzt — kommt aus /api/me, damit es nur eine Wahrheit gibt. */
  getragen: Getragen;
  onClose: () => void;
  /** Nach dem Anziehen: /api/me neu laden. */
  onGetragen: () => void;
  /** Nach einem Kauf: Guthaben in der Kopfzeile nachziehen. */
  onGuthaben: () => void;
}): React.JSX.Element {
  const [shop, setShop] = useState<Shop | null>(null);
  const [slot, setSlot] = useState<Slot>('hut');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  /**
   * Stueck, dessen Kauf bestaetigt werden soll.
   *
   * Ein Tipp darf nichts abbuchen: Muenzen sind erarbeitet, und wer beim
   * Durchblaettern versehentlich 380 davon ausgibt, kommt nicht zurueck.
   */
  const [kaufen, setKaufen] = useState<RegalStueck | null>(null);
  /**
   * Welche Waehrung gerade abgebucht wird.
   *
   * Getrennt von `laeuft`, weil das die Kennung traegt und auch das Anziehen
   * damit arbeitet. Hier geht es nur darum, welcher der zwei Kaufknoepfe
   * „Kauft…" zeigt — beide gleichzeitig waere gelogen.
   */
  const [kauftMit, setKauftMit] = useState<Waehrung | null>(null);

  /**
   * Vorschau: Was der Pinguin zeigen soll, waehrend man ein Stueck antippt,
   * das noch nicht gehoert. Anprobieren geht immer, kaufen ist die
   * Entscheidung danach.
   */
  const [probe, setProbe] = useState<Getragen>({});

  const laden = (): void => {
    void api
      .shop()
      .then(setShop)
      .catch(() => setFehler('Der Kleiderschrank ließ sich nicht laden.'));
  };
  useEffect(laden, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  const meldung = (err: unknown, ersatz: string): void => {
    setFehler(err instanceof ApiError ? t(err.messageKey) : ersatz);
  };

  const anziehen = (stueck: RegalStueck): void => {
    if (laeuft) return;
    setLaeuft(stueck.id);
    setFehler(null);
    setProbe({});
    void api
      .wear(stueck.slot, stueck.id)
      .then(() => onGetragen())
      .catch((err: unknown) => meldung(err, 'Das ließ sich nicht anziehen.'))
      .finally(() => setLaeuft(null));
  };

  const ausziehen = (): void => {
    if (laeuft) return;
    setLaeuft(`aus-${slot}`);
    setFehler(null);
    setProbe({});
    void api
      .wear(slot, null)
      .then(() => onGetragen())
      .catch((err: unknown) => meldung(err, 'Das ließ sich nicht ausziehen.'))
      .finally(() => setLaeuft(null));
  };

  const jetztKaufen = (stueck: RegalStueck, waehrung: Waehrung): void => {
    setLaeuft(stueck.id);
    setKauftMit(waehrung);
    setFehler(null);
    void api
      .buyItem(stueck.id, waehrung)
      .then(() => {
        setKaufen(null);
        onGuthaben();
        laden();
        // Nach dem Kauf sofort anziehen: Wer 300 Muenzen fuer eine Laterne
        // ausgibt, will sie nicht erst suchen.
        return api.wear(stueck.slot, stueck.id).then(() => onGetragen());
      })
      .catch((err: unknown) => {
        setKaufen(null);
        meldung(err, 'Der Kauf ging nicht durch.');
      })
      .finally(() => {
        setLaeuft(null);
        setKauftMit(null);
      });
  };

  const regal = shop?.regale.find((r) => r.slot === slot);
  /** Der Pinguin zeigt Getragenes, ueberschrieben von der Anprobe. */
  const gezeigt: Getragen = { ...getragen, ...probe };
  const belegt = getragen[slot] !== undefined;

  if (neu) {
    return (
      <div className="hb-voll hb-schrank sp" role="dialog" aria-modal="true" aria-label="Kleiderschrank">
        <header className="hb-voll-kopf">
          <Schliessen onClick={onClose} />
          <div className="hb-voll-titel">
            <h1>Dein Spind</h1>
            <span>Dein Pinguin · für alle Spiele</span>
          </div>
        </header>

        {/*
          Der offene Spind ist die Bühne: Holzkorpus, zwei aufgeklappte
          Türen, Kleiderstange und Lampe innen, der Pinguin steht davor auf
          dem Teppich. Sie bleibt stehen, nur die Fächer darunter rollen
          (Begründung in der alten Fassung unten). Alles CSS — kein Bild, das
          fehlen könnte (CLAUDE.md, „Kein <img> auf eine Datei, die es noch
          nicht gibt").
        */}
        <div className="sp-buehne">
          <div className="sp-korpus" aria-hidden="true">
            <div className="sp-innen">
              <span className="sp-lampe" />
              <span className="sp-ablage" />
              <span className="sp-stange" />
              <span className="sp-buegel is-1" />
              <span className="sp-buegel is-2" />
              <span className="sp-buegel is-3" />
            </div>
            <span className="sp-tuer is-links">
              <span className="sp-spiegel" />
            </span>
            <span className="sp-tuer is-rechts">
              <span className="sp-griff" />
            </span>
          </div>
          <span className="sp-teppich" aria-hidden="true" />
          <div className="sp-pinguin">
            <Pinguin getragen={gezeigt} groesse={10.5} titel="Dein Pinguin" anziehen />
          </div>
          {Object.keys(probe).length > 0 && <span className="hb-schrank-probe">Anprobe</span>}
        </div>

        <nav className="sp-schubladen" aria-label="Plätze">
          {SLOTS.map((s) => (
            <button
              type="button"
              key={s}
              className={`sp-schublade${s === slot ? ' is-an' : ''}${getragen[s] ? ' is-belegt' : ''}`}
              aria-pressed={s === slot}
              onClick={() => {
                setSlot(s);
                setProbe({});
              }}
            >
              <svg viewBox="0 0 24 24" className="sp-schublade-zeichen" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={SCHUBLADEN_ZEICHEN[s]} />
              </svg>
              <span>{t(`slot.${s}`)}</span>
              <i className="sp-knauf" aria-hidden="true" />
            </button>
          ))}
        </nav>

        <div className="hb-voll-rolle sp-rolle">
          {fehler && <p className="hb-fehler">{fehler}</p>}
          {!shop && !fehler && <p className="hb-laden">Wird geladen…</p>}
          {regal && (
            <section className="hb-blk">
              <h2 className="hb-ab">
                {t(`slot.${slot}`)}
                {belegt ? (
                  <button type="button" className="hb-ab-mehr" onClick={ausziehen} disabled={laeuft !== null}>
                    Ausziehen
                  </button>
                ) : (
                  <span className="hb-ab-zusatz">Nichts an</span>
                )}
              </h2>
              <div className={`hb-raster is-drei sp-faecher${AM_BUEGEL.has(slot) ? ' is-buegel' : ''}`}>
                {regal.stuecke.map((stueck) => {
                  const sitzt = getragen[slot] === stueck.id;
                  return (
                    <button
                      type="button"
                      key={stueck.id}
                      className={`hb-stueck sp-fach is-${stueck.seltenheit}${sitzt ? ' is-aktiv' : ''}${stueck.besessen ? '' : ' is-fremd'}`}
                      aria-pressed={sitzt}
                      disabled={laeuft !== null}
                      onClick={() => {
                        if (stueck.besessen) {
                          anziehen(stueck);
                          return;
                        }
                        // Anprobieren darf man immer; kaufen braucht ein Ja.
                        setProbe({ [slot]: stueck.id });
                        if (!stueck.geschenk) setKaufen(stueck);
                      }}
                    >
                      <span className="sp-fach-bild">
                        {AM_BUEGEL.has(slot) && <span className="sp-fach-haken" aria-hidden="true" />}
                        <StueckAllein itemId={stueck.id} slot={slot} groesse={4.6} />
                      </span>
                      <strong>{t(stueck.nameKey)}</strong>
                      <small>{stueck.besessen ? (sitzt ? 'trägst du' : 'gehört dir') : stueck.geschenk ? 'Geschenk' : `${stueck.preis.coins.toLocaleString('de-DE')} Münzen`}</small>
                      {sitzt && (
                        <span className="hb-ding-ok" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      {!stueck.besessen && !stueck.geschenk && (
                        <span className="hb-stueck-schloss" aria-hidden="true">
                          <svg viewBox="0 0 24 24" className="hb-ic" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="11" width="14" height="9" rx="2" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {kaufen && (
          <HbBlatt titel={t(kaufen.nameKey)} label="Kauf bestätigen" onClose={() => setKaufen(null)} klasse="is-klein">
            <form
              className="hb-kauf-form"
              onSubmit={(e) => {
                e.preventDefault();
                // Die Eingabetaste kauft in Münzen — siehe die alte Fassung.
                jetztKaufen(kaufen, 'coins');
              }}
            >
              <div className="hb-mitte">
                <StueckBild itemId={kaufen.id} slot={kaufen.slot} groesse={7} />
                <p className="hb-text">
                  {t(`seltenheit.${kaufen.seltenheit}`)} · {t(`slot.${kaufen.slot}`)}
                </p>
              </div>
              {/* Gold ist der eine Hauptknopf: die Münzen, die kein echtes Geld
                  gekostet haben (dieselbe Überlegung wie bei der Eingabetaste). */}
              {mitEdelsteinen && <p className="hb-klein hb-ohne-rand hb-mitte-text">Womit bezahlen?</p>}
              <div className="hb-knopfreihe">
                <button type="submit" className={`hb-kn is-gold is-haupt${mitEdelsteinen ? '' : ' is-breit'}`} disabled={laeuft !== null}>
                  {kauftMit === 'coins' ? (
                    'Kauft…'
                  ) : (
                    <>
                      <img className="hb-kn-bild" src="/hub/symbol-muenze.webp" alt="" draggable={false} />
                      {betragText(kaufen.preis.coins, 'coins')}
                    </>
                  )}
                </button>
                {/* In der App nur Münzen (laufzeit.ts, `mitEdelsteinen`). */}
                {mitEdelsteinen && (
                <button
                  type="button"
                  className="hb-kn is-zweit is-haupt"
                  disabled={laeuft !== null}
                  onClick={() => jetztKaufen(kaufen, 'gems')}
                >
                  {kauftMit === 'gems' ? (
                    'Kauft…'
                  ) : (
                    <>
                      <img className="hb-kn-bild" src="/hub/symbol-edelstein.webp" alt="" draggable={false} />
                      {betragText(kaufen.preis.gems, 'gems')}
                    </>
                  )}
                </button>
                )}
              </div>
              <button type="button" className="hb-leise-knopf" onClick={() => setKaufen(null)}>
                Später
              </button>
            </form>
          </HbBlatt>
        )}
      </div>
    );
  }

  return (
    <div className="pfad-voll kleiderschrank">
      <header className="pfad-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          ← Zurück
        </button>
        <span className="pfad-voll-stand">Dein Pinguin</span>
      </header>

      {/* Die Buehne bleibt stehen, nur die Liste darunter rollt. Sonst waere
          der Pinguin beim Blaettern durch die Aura nicht mehr zu sehen —
          also genau dann nicht, wenn man ihn braucht. */}
      <div className="ks-buehne">
        <Pinguin getragen={gezeigt} groesse={11} titel="Dein Pinguin" />
        {Object.keys(probe).length > 0 && <span className="ks-probe-marke">Anprobe</span>}
      </div>

      <nav className="ks-plaetze" aria-label="Plätze">
        {SLOTS.map((s) => (
          <button
            key={s}
            className={`ks-platz${s === slot ? ' is-an' : ''}${getragen[s] ? ' is-belegt' : ''}`}
            aria-pressed={s === slot}
            onClick={() => {
              setSlot(s);
              setProbe({});
            }}
          >
            {t(`slot.${s}`)}
          </button>
        ))}
      </nav>

      <div className="pfad-voll-rolle ks-rolle">
        {fehler && <p className="error">{fehler}</p>}
        {!shop && !fehler && <Ladekreis />}

        {regal && (
          <Tafel
            titel={t(`slot.${slot}`)}
            zusatz={
              belegt ? (
                <button className="hub-mini" onClick={ausziehen} disabled={laeuft !== null}>
                  Ausziehen
                </button>
              ) : (
                'Nichts an'
              )
            }
          >
            <div className="ks-gitter">
              {regal.stuecke.map((stueck) => {
                const sitzt = getragen[slot] === stueck.id;
                return (
                  <button
                    key={stueck.id}
                    className={`ks-stueck is-${stueck.seltenheit}${sitzt ? ' is-an' : ''}${
                      stueck.besessen ? '' : ' is-fremd'
                    }`}
                    aria-pressed={sitzt}
                    disabled={laeuft !== null}
                    onClick={() => {
                      if (stueck.besessen) {
                        anziehen(stueck);
                        return;
                      }
                      if (stueck.geschenk) {
                        // Nicht kaufbar: anprobieren darf man, mehr nicht.
                        setProbe({ [slot]: stueck.id });
                        return;
                      }
                      // Erst anprobieren, dann fragen. Der Kauf braucht ein Ja.
                      setProbe({ [slot]: stueck.id });
                      setKaufen(stueck);
                    }}
                  >
                    <StueckBild itemId={stueck.id} slot={slot} />
                    <strong>{t(stueck.nameKey)}</strong>
                    <span className="ks-preis muted">{preisText(stueck)}</span>
                    {sitzt && <span className="hub-blatt-haken">✓</span>}
                    {!stueck.besessen && !stueck.geschenk && (
                      <span className="ks-schloss" aria-hidden="true">
                        🔒
                      </span>
                    )}
                    {!stueck.besessen && stueck.geschenk && (
                      <span className="front-bald-tag">Geschenk</span>
                    )}
                  </button>
                );
              })}
            </div>
          </Tafel>
        )}
      </div>

      {kaufen && (
        <div className="doko-sheet" onClick={() => setKaufen(null)} role="presentation">
          <form
            className="doko-sheet-card ks-kauf"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              // Die Eingabetaste kauft in Muenzen. Sie ist die Waehrung, die man
              // nicht kaufen muss — ein versehentliches Ja kostet damit nichts,
              // was Geld gekostet hat.
              jetztKaufen(kaufen, 'coins');
            }}
          >
            <StueckBild itemId={kaufen.id} slot={kaufen.slot} groesse={7} />
            <h2>{t(kaufen.nameKey)}</h2>
            <p className="muted">
              {t(`seltenheit.${kaufen.seltenheit}`)} · {t(`slot.${kaufen.slot}`)}
            </p>
            <p className="ks-kauf-womit muted">Womit bezahlen?</p>
            {/*
              Zwei Knoepfe statt eines Umschalters: Ein Umschalter waere ein
              Zustand, den man erst setzt und dann bestaetigt — zwei Tipps fuer
              eine Entscheidung, und dazwischen die Frage, welcher gerade steht.
              Hier steht der Preis auf dem Knopf, und der Tipp ist der Kauf.

              Beide tragen denselben gruenen Knopf: Die gemalten Knopfbilder sind
              Holz, Gruen und Rot — ein blaugruener waere eine Bildbestellung und
              kein CSS. Unterschieden werden sie ueber Symbol und Zahl, und die
              sind der Unterschied, auf den es ankommt.
            */}
            <div className="hub-knopfreihe hub-knopfreihe--a ks-kauf-waehl">
              <button
                type="submit"
                className="hub-knopf hub-knopf--a-gold"
                disabled={laeuft !== null}
              >
                {kauftMit === 'coins' ? (
                  'Kauft…'
                ) : (
                  <>
                    <img className="ks-kauf-icon" src="/hub/muenze.png" alt="" draggable={false} />
                    {betragText(kaufen.preis.coins, 'coins')}
                  </>
                )}
              </button>
              <button
                type="button"
                className="hub-knopf hub-knopf--a-gold"
                disabled={laeuft !== null}
                onClick={() => jetztKaufen(kaufen, 'gems')}
              >
                {kauftMit === 'gems' ? (
                  'Kauft…'
                ) : (
                  <>
                    <EdelsteinIcon className="ks-kauf-icon" />
                    {betragText(kaufen.preis.gems, 'gems')}
                  </>
                )}
              </button>
            </div>
            <button type="button" className="hub-knopf hub-knopf--a" onClick={() => setKaufen(null)}>
              Später
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
