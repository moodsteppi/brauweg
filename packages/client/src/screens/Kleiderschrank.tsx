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
import { Pinguin, StueckBild } from '../pinguin';
import { EdelsteinIcon, Tafel } from '../hub';
import { t } from '../i18n';

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
}: {
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
