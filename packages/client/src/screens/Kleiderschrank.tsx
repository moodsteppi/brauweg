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

import {
  ApiError,
  SLOTS,
  api,
  type Getragen,
  type RegalStueck,
  type Shop,
  type Slot,
} from '../api';
import { Pinguin, StueckBild } from '../pinguin';
import { Tafel } from '../hub';
import { t } from '../i18n';

/** Preis als lesbare Zeile, oder „Gehört dir" / „Geschenk". */
function preisText(stueck: RegalStueck): string {
  if (stueck.besessen) return 'Gehört dir';
  if (stueck.geschenk) return 'Nur zu bekommen';
  const einheit =
    stueck.preis === 1 ? t(`waehrung.${stueck.waehrung}.eins`) : t(`waehrung.${stueck.waehrung}`);
  return `${stueck.preis} ${einheit}`;
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

  const jetztKaufen = (stueck: RegalStueck): void => {
    setLaeuft(stueck.id);
    setFehler(null);
    void api
      .buyItem(stueck.id)
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
      .finally(() => setLaeuft(null));
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
        {!shop && !fehler && <p className="muted">Wird geladen…</p>}

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
              jetztKaufen(kaufen);
            }}
          >
            <StueckBild itemId={kaufen.id} slot={kaufen.slot} groesse={7} />
            <h2>{t(kaufen.nameKey)}</h2>
            <p className="muted">
              {t(`seltenheit.${kaufen.seltenheit}`)} · {t(`slot.${kaufen.slot}`)}
            </p>
            <p className="ks-kauf-preis">{preisText(kaufen)}</p>
            <div className="hub-knopfreihe hub-knopfreihe--a">
              <button type="button" className="hub-knopf hub-knopf--a" onClick={() => setKaufen(null)}>
                Später
              </button>
              <button
                type="submit"
                className="hub-knopf hub-knopf--a-gold"
                disabled={laeuft !== null}
              >
                {laeuft === kaufen.id ? 'Kauft…' : 'Kaufen und anziehen'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
