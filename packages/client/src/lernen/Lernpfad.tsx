import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../api';
import type { Deck } from '../decks';
import { t } from '../i18n';
import { spiele } from '../klang';
import { Pinguin } from '../pinguin';
import { Flamme } from './Flamme';
import { LektionSpieler } from './LektionSpieler';
import type { LernpfadAnsicht } from './sicht';
import { merkeUebung } from './uebung';
import './lernen.css';

/**
 * „Doppelkopf lernen" — der Pfad (Emile, 17.10.2026, nur in der App).
 *
 * Oben die Serie wie bei Duolingo: Flamme, Tageszahl, sieben Punkte bis zum
 * Outfit. Darunter die sieben Lektionen als Pfad. Gesperrt ist eine Lektion,
 * bis die vorige geschafft ist — „frei" heisst hier: so viele am Tag, wie man
 * mag, nicht in beliebiger Reihenfolge. Wer durch ist, haelt die Serie mit
 * einer Uebungsrunde.
 *
 * Wann die Serie waechst, entscheidet der Server (lernpfad.ts); hier steht nur,
 * was er sagt.
 */
export function Lernpfad({
  deck,
  onClose,
  onUebung,
  onGeaendert,
}: {
  deck: Deck;
  onClose: () => void;
  /** Der Uebungstisch steht — an den Tisch wechseln. */
  onUebung: (tableId: string) => void;
  /** Serie oder Kleiderschrank haben sich geaendert: `me` neu laden. */
  onGeaendert: () => void;
}): React.JSX.Element {
  const [pfad, setPfad] = useState<LernpfadAnsicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);

  const laden = useCallback(() => {
    api
      .lernpfad()
      .then(setPfad)
      .catch((err: unknown) => setFehler(err instanceof ApiError ? t(err.messageKey) : 'Der Lernpfad lädt gerade nicht.'));
  }, []);

  useEffect(() => {
    spiele('blatt-auf');
    laden();
  }, [laden]);

  const starteUebung = async (): Promise<void> => {
    const { tableId } = await api.lernUebung();
    merkeUebung(tableId);
    onUebung(tableId);
  };

  const serie = pfad?.serie;
  const ziel = pfad?.ziel ?? 7;
  const aktuelle = pfad?.lektionen.find((l) => !l.erledigt) ?? null;
  const allesGeschafft = pfad !== null && aktuelle === null;

  return (
    <div className="hb-voll ln" role="dialog" aria-modal="true" aria-label="Doppelkopf lernen">
      <header className="hb-voll-kopf">
        <button type="button" className="hb-rund" onClick={onClose} aria-label="Schließen">
          <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="hb-voll-titel">
          <h1>Doppelkopf lernen</h1>
          <span>Eine Lektion am Tag hält die Flamme am Brennen</span>
        </div>
        <span className="hb-pill is-gross ln-pill" aria-label={`Serie: ${serie?.serie ?? 0} Tage`}>
          <Flamme aus={!serie?.heuteGespielt} groesse={1.5} />
          {serie?.serie ?? 0}
        </span>
      </header>

      <div className="hb-voll-rolle">
        {fehler && (
          <p className="hb-fehler" role="alert">
            {fehler}
          </p>
        )}
        {!pfad && !fehler && <p className="hb-laden">Lernpfad wird geladen…</p>}

        {pfad && serie && (
          <section className="ln-serie" aria-label="Deine Serie">
            <div className="ln-serie-kopf">
              <Flamme aus={!serie.heuteGespielt} groesse={3.2} />
              <div>
                <strong className="ln-serie-zahl">
                  {serie.serie} {serie.serie === 1 ? 'Tag' : 'Tage'}
                </strong>
                <span className="ln-serie-text">{serienText(serie)}</span>
              </div>
            </div>
            <ol className="ln-punkte" aria-label={`${Math.min(serie.serie, ziel)} von ${ziel} Tagen`}>
              {Array.from({ length: ziel }, (_, i) => (
                <li key={i} className={i < Math.min(serie.serie, ziel) ? 'is-voll' : undefined}>
                  {i + 1}
                </li>
              ))}
            </ol>
            <span className="ln-schutz">
              <SchildZeichen />
              {serie.schutzFrei ? 'Wochenschutz bereit: Ein verpasster Tag wird überbrückt.' : 'Wochenschutz diese Woche schon verbraucht.'}
            </span>
          </section>
        )}

        {pfad && (
          <section className={`ln-belohnung${pfad.belohnt ? ' is-frei' : ''}`} aria-label="Belohnung">
            <Pinguin getragen={{ hut: 'hut-doktorhut', oberteil: 'oberteil-meisterrobe' }} groesse={6.5} titel="Pinguin als Doko-Meister" />
            <div>
              <span className="hb-label">{pfad.belohnt ? 'Freigeschaltet' : `Nach ${ziel} Tagen am Stück`}</span>
              <strong>Doko-Meister</strong>
              <span className="hb-klein">
                {pfad.belohnt
                  ? 'Doktorhut und Meisterrobe liegen in deinem Kleiderschrank.'
                  : 'Doktorhut und Meisterrobe für deinen Pinguin — gibt es nur über die Serie.'}
              </span>
            </div>
          </section>
        )}

        {pfad && (
          <ol className="ln-pfad">
            {pfad.lektionen.map((lektion, i) => {
              const frei = lektion.erledigt || i === 0 || pfad.lektionen[i - 1]!.erledigt;
              const istAktuell = lektion.id === aktuelle?.id;
              return (
                <li key={lektion.id} className={`ln-station is-${['links', 'mitte', 'rechts', 'mitte'][i % 4]}`}>
                  <button
                    type="button"
                    className={`ln-knoten${lektion.erledigt ? ' is-erledigt' : ''}${istAktuell ? ' is-aktuell' : ''}${frei ? '' : ' is-gesperrt'}`}
                    disabled={!frei}
                    onClick={() => setOffen(lektion.id)}
                    aria-label={`Lektion ${i + 1}: ${lektion.titel}${lektion.erledigt ? ', geschafft' : frei ? '' : ', noch gesperrt'}`}
                  >
                    <span className="ln-knoten-inhalt" aria-hidden="true">
                      {lektion.erledigt ? <HakenZeichen /> : frei ? (lektion.uebung ? <KartenZeichen /> : i + 1) : <SchlossZeichen />}
                    </span>
                    {istAktuell && <span className="ln-start">Start</span>}
                  </button>
                  <span className="ln-station-text">
                    <strong>{lektion.titel}</strong>
                    <span>{lektion.kurz}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {allesGeschafft && (
          <section className="ln-weiter">
            <strong>Alle Lektionen geschafft!</strong>
            <span className="hb-klein">Halte deine Serie mit einer Übungsrunde gegen drei Bots — eine Runde reicht für heute.</span>
            <button
              type="button"
              className="hb-kn is-gold is-haupt is-breit"
              onClick={() => void starteUebung().catch((err: unknown) => setFehler(err instanceof ApiError ? t(err.messageKey) : 'Der Tisch ließ sich nicht öffnen.'))}
            >
              Übungsrunde spielen
            </button>
          </section>
        )}
      </div>

      {offen && (
        <LektionSpieler
          lektionId={offen}
          deck={deck}
          onClose={() => {
            setOffen(null);
            spiele('blatt-zu');
          }}
          onGeschafft={(tag) => {
            setPfad(tag.pfad);
            onGeaendert();
          }}
          onUebung={starteUebung}
          onAnziehen={onGeaendert}
        />
      )}
    </div>
  );
}

function serienText(serie: LernpfadAnsicht['serie']): string {
  if (serie.heuteGespielt) return 'Heute geschafft — morgen geht es weiter.';
  if (serie.brauchtSchutz) return 'Gestern verpasst. Spiel heute, dann rettet dich der Wochenschutz.';
  if (serie.serie > 0) return 'Heute noch eine Lektion, sonst erlischt die Flamme.';
  return 'Mach heute deine erste Lektion und starte deine Serie.';
}

function HakenZeichen(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function SchlossZeichen(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function KartenZeichen(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="4" y="5" width="10" height="14" rx="2" transform="rotate(-10 9 12)" />
      <rect x="10" y="5" width="10" height="14" rx="2" transform="rotate(10 15 12)" />
    </svg>
  );
}

function SchildZeichen(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  );
}
