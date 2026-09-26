import { useEffect, useRef, useState } from 'react';
import { ApiError, api, type Aufgabe, type Aufgaben, type Fund, type Truhe, type Truhen } from '../api';
import { t } from '../i18n';
import { FundBlatt } from './Aufgaben';

/**
 * Das Blatt „Heute" im neuen Hub: Tagesaufgaben, Truhen und der Weg zur
 * Gesamt-Rangliste (Entwurf Fassung 4, Seite „Start, weiter unten").
 *
 * Dieselben Aufrufe und dieselben Regeln wie das bisherige Aufgabenblatt —
 * abholen, öffnen, Fundblatt mit der Öffnung —, nur als Blatt von unten
 * (Apple: ein Blatt zugleich, Griff, schließen per Wisch, Hintergrund, Escape
 * und Knopf).
 */

const TRUHE_BILD: Record<Truhe['grad'], string> = {
  holz: '/hub/truhe-holz.webp',
  // Bis ein eigenes Bild bestellt ist
  bronze: '/hub/truhe-holz.webp',
  silber: '/hub/truhe-silber.webp',
  gold: '/hub/truhe-gold.webp',
  diamant: '/hub/truhe-gold-offen.webp',
};

const GRAD_NAME: Record<Truhe['grad'], string> = {
  holz: 'Holz',
  bronze: 'Bronze',
  silber: 'Silber',
  gold: 'Gold',
  diamant: 'Diamant',
};

export function HeuteNeu({
  onClose,
  onGuthaben,
  onRangliste,
}: {
  onClose: () => void;
  onGuthaben: () => void;
  onRangliste: () => void;
}): React.JSX.Element {
  const [truhen, setTruhen] = useState<Truhen | null>(null);
  const [aufgaben, setAufgaben] = useState<Aufgaben | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  /** Zuerst höchstens fünf Aufgaben (Bauplan), der Rest auf Wunsch. */
  const [alleZeigen, setAlleZeigen] = useState(false);
  const zug = useRef<{ y: number; dy: number } | null>(null);
  const blatt = useRef<HTMLDivElement>(null);

  const laden = (): void => {
    void Promise.all([api.chests(), api.quests()])
      .then(([tr, q]) => {
        setTruhen(tr);
        setAufgaben(q);
      })
      .catch(() => setFehler('Aufgaben und Truhen ließen sich nicht laden.'));
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
  const oeffnen = (truhe: Truhe): void => {
    if (laeuft || !truhe.offen || truhe.geholt) return;
    setLaeuft(truhe.id);
    setFehler(null);
    void api
      .openChest(truhe.id)
      .then((ergebnis) => {
        setFund(ergebnis);
        laden();
        onGuthaben();
      })
      .catch((err: unknown) => meldung(err, 'Die Truhe ließ sich nicht öffnen.'))
      .finally(() => setLaeuft(null));
  };
  const abholen = (aufgabe: Aufgabe): void => {
    if (laeuft) return;
    setLaeuft(aufgabe.id);
    setFehler(null);
    void api
      .claimQuest(aufgabe.id)
      .then(() => {
        laden();
        onGuthaben();
      })
      .catch((err: unknown) => meldung(err, 'Die Belohnung ließ sich nicht holen.'))
      .finally(() => setLaeuft(null));
  };

  // Wisch nach unten am Griff schließt das Blatt.
  const ziehStart = (e: React.TouchEvent): void => {
    zug.current = { y: e.touches[0]!.clientY, dy: 0 };
  };
  const ziehen = (e: React.TouchEvent): void => {
    if (!zug.current || !blatt.current) return;
    zug.current.dy = Math.max(0, e.touches[0]!.clientY - zug.current.y);
    blatt.current.style.transform = `translateY(${zug.current.dy}px)`;
  };
  const ziehEnde = (): void => {
    const dy = zug.current?.dy ?? 0;
    zug.current = null;
    if (dy > 90) onClose();
    else if (blatt.current) blatt.current.style.transform = '';
  };

  // Abholbares zuerst, dann was noch läuft, zuletzt das Erledigte.
  const reihe = (a: Aufgabe): number => (a.fertig && !a.abgeholt ? 0 : a.abgeholt ? 2 : 1);
  const sortiert = aufgaben ? [...aufgaben.aufgaben].sort((a, b) => reihe(a) - reihe(b)) : [];
  const liste = alleZeigen ? sortiert : sortiert.slice(0, 5);
  const summe = aufgaben?.aufgaben.reduce((s, a) => s + a.belohnung.betrag, 0) ?? 0;
  const alleTruhen = truhen ? [truhen.tag, ...truhen.stufen] : [];

  return (
    <>
    <div className="hb-blatt-grund" onClick={onClose}>
      <div
        className="hb-blatt"
        ref={blatt}
        role="dialog"
        aria-modal="true"
        aria-label="Heute: Aufgaben und Truhen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hb-blatt-griff" onTouchStart={ziehStart} onTouchMove={ziehen} onTouchEnd={ziehEnde}>
          <span aria-hidden="true" />
        </div>
        <header className="hb-blatt-kopf">
          <h1 className="hb-titel">Heute</h1>
          <button type="button" className="hb-rund" onClick={onClose} aria-label="Schließen">
            <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="hb-blatt-rolle">
          {fehler && <p className="hb-fehler">{fehler}</p>}
          {!truhen && !aufgaben && !fehler && <p className="hb-laden">Wird geladen…</p>}

          {aufgaben && (
            <section className="hb-blk">
              <h2 className="hb-ab">
                <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="4" />
                  <path d="M8 12l3 3 5-6" />
                </svg>
                Tagesaufgaben
                {sortiert.length > 5 && (
                  <button type="button" className="hb-ab-mehr" onClick={() => setAlleZeigen((a) => !a)} aria-expanded={alleZeigen}>
                    {alleZeigen ? 'Weniger' : `Alle ${sortiert.length} ›`}
                  </button>
                )}
              </h2>
              <p className="hb-klein">
                Jeden Tag alle {aufgaben.aufgaben.length === 8 ? 'acht' : aufgaben.aufgaben.length}, zusammen {summe} Münzen. Neu um Mitternacht.
              </p>
              <div className="hb-liste">
                {liste.map((a) => {
                  const bereit = a.fertig && !a.abgeholt;
                  return (
                    <div className={`hb-auf${a.abgeholt ? ' is-geholt' : ''}`} key={a.id}>
                      <div className="hb-auf-text">
                        <strong>{t(a.nameKey)}</strong>
                        <span className="hb-auf-stand">
                          <span className="hb-balken" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, Math.round((a.fortschritt / Math.max(1, a.ziel)) * 100))}%` }} />
                          </span>
                          <small>
                            {Math.min(a.fortschritt, a.ziel)} / {a.ziel}
                          </small>
                        </span>
                      </div>
                      {bereit ? (
                        <button
                          type="button"
                          className="hb-kn is-gold hb-abholen"
                          disabled={laeuft === a.id}
                          onClick={() => abholen(a)}
                          aria-label={`${t(a.nameKey)}: ${a.belohnung.betrag} Münzen abholen`}
                        >
                          <img src="/hub/symbol-muenze.webp" alt="" />+{a.belohnung.betrag}
                        </button>
                      ) : (
                        <span className="hb-auf-lohn">
                          {a.abgeholt ? (
                            'geholt'
                          ) : (
                            <>
                              <img src="/hub/symbol-muenze.webp" alt="" />
                              {a.belohnung.betrag}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="hb-klein">
                Gezählt wird am Ende einer Partie, auch an Tischen mit Bots. Abgebrochene Partien zählen nicht.
              </p>
            </section>
          )}

          {truhen && (
            <section className="hb-blk">
              <h2 className="hb-ab">
                Truhen
                <span className="hb-ab-zusatz">nur Münzen drin</span>
              </h2>
              <div className="hb-truhen">
                {alleTruhen.map((tr) => {
                  const offen = tr.offen && !tr.geholt;
                  const titel = tr.art === 'tag' ? 'Tagestruhe' : `Stufe ${tr.abStufe ?? ''}`;
                  return (
                    <button
                      type="button"
                      key={tr.id}
                      className={`hb-tr${offen ? ' is-offen' : ''}${tr.geholt ? ' is-geholt' : ''}${!tr.offen && !tr.geholt ? ' is-zu' : ''}`}
                      disabled={!offen || laeuft === tr.id}
                      onClick={() => oeffnen(tr)}
                      aria-label={`${titel}, ${GRAD_NAME[tr.grad]}, ${tr.von} bis ${tr.bis} Münzen${offen ? ', öffnen' : tr.geholt ? ', schon geholt' : ''}`}
                    >
                      <img src={TRUHE_BILD[tr.grad]} alt="" />
                      <strong>{titel}</strong>
                      <small>
                        {!tr.offen && !tr.geholt && tr.fehltStufen !== null
                          ? `noch ${tr.fehltStufen} ${tr.fehltStufen === 1 ? 'Stufe' : 'Stufen'}`
                          : `${GRAD_NAME[tr.grad]} · ${tr.von}–${tr.bis}`}
                      </small>
                      {offen ? (
                        <span className="hb-tr-knopf">Öffnen</span>
                      ) : tr.geholt ? (
                        <span className="hb-tr-ok">✓ {tr.coins ?? ''}</span>
                      ) : (
                        <span className="hb-tr-zu" aria-hidden="true">
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
              <p className="hb-klein">
                Die Tagestruhe steht jeden Tag einmal bereit. Die anderen kommen mit den Stufen, erreicht ist erreicht.
              </p>
            </section>
          )}

          <button type="button" className="hb-zeile" onClick={onRangliste}>
            <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
            </svg>
            <span>
              <strong>Rangliste</strong>
              <small>Gesamt und je Spiel</small>
            </span>
            <span className="hb-pf" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </div>
    </div>
    {fund && <FundBlatt fund={fund} onClose={() => setFund(null)} />}
    </>
  );
}
