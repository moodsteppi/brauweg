import { useEffect, useRef, useState } from 'react';

import { ApiError, api } from '../api';
import { CardFront } from '../CardFace';
import type { Deck } from '../decks';
import { t } from '../i18n';
import { spiele } from '../klang';
import { Pinguin } from '../pinguin';
import type { Card } from '../protocol';
import { imUmfang } from '../umfang';
import { merkeGefeiert } from './gefeiert';
import { Flamme } from './Flamme';
import { LERN_NAMEN, type Lektion, type LernSchritt, type LernStichKarte, type Spieltag } from './sicht';

/**
 * Eine Lektion des Lernpfads, Schritt fuer Schritt (Emile, 17.10.2026).
 *
 * Gebaut nach dem Duolingo-Muster: oben ein Fortschrittsbalken, in der Mitte
 * genau eine Aufgabe, unten ein Streifen, der nach dem Tipp gruen („Richtig")
 * oder rot („Nicht ganz") aufgeht. Bei einem Fehler bleibt man auf dem
 * Schritt und versucht es nochmal — der Hinweis sagt, wohin man schauen soll,
 * nicht was richtig ist.
 *
 * Was richtig ist, steht in der Lektion selbst (`richtig`), ausgerechnet vom
 * Modul (game-doppelkopf/src/lernen.ts). Hier wird nur verglichen.
 */

/**
 * `fehlt`: Bei „alle antippen" war nichts Falsches dabei, aber eine erlaubte
 * Karte fehlte noch — dann heisst es „Fast!" statt des Hinweises.
 */
type Antwort = { stimmt: boolean; fehlt?: boolean };

export function LektionSpieler({
  lektionId,
  deck,
  onClose,
  onGeschafft,
  onUebung,
  onAnziehen,
}: {
  lektionId: string;
  deck: Deck;
  onClose: () => void;
  /** Der Server hat den Spieltag eingetragen. */
  onGeschafft: (tag: Spieltag) => void;
  /** Uebungslektion: die Runde am Tisch starten. */
  onUebung: () => Promise<void>;
  /** Belohnung gleich anziehen; meldet zurueck, damit der Kopf neu laedt. */
  onAnziehen: () => void;
}): React.JSX.Element {
  const [lektion, setLektion] = useState<Lektion | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  /** Was zuletzt getippt wurde — Kartenkennung oder Antwortnummer. */
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  /** „Alle antippen" (`alle` im Schritt): die markierten Karten, noch ungeprueft. */
  const [markiert, setMarkiert] = useState<number[]>([]);
  const [fehlversuche, setFehlversuche] = useState(0);
  const [ergebnis, setErgebnis] = useState<Spieltag | null>(null);
  const [startet, setStartet] = useState(false);
  const gemeldet = useRef(false);

  useEffect(() => {
    let lebt = true;
    api
      .lektion(lektionId)
      .then((l) => lebt && setLektion(l))
      .catch((err: unknown) => lebt && setFehler(err instanceof ApiError ? t(err.messageKey) : 'Die Lektion lädt gerade nicht.'));
    return () => {
      lebt = false;
    };
  }, [lektionId]);

  const anzahl = lektion?.schritte.length ?? 0;
  // Eine Lektion ohne Schritte ist nie „geschafft" — sonst meldete sie sich
  // beim Oeffnen sofort als erledigt.
  const amEnde = lektion !== null && anzahl > 0 && index >= anzahl;

  // Am Ende einmal melden — an der Kennung und dem Ende haengen, nicht an Objekten.
  useEffect(() => {
    if (!amEnde || !lektion || lektion.uebung || gemeldet.current) return;
    gemeldet.current = true;
    api
      .lektionFertig(lektion.id)
      .then((tag) => {
        setErgebnis(tag);
        onGeschafft(tag);
        // Hier wird schon gefeiert — der Start soll es nicht noch einmal tun (Feier.tsx).
        if (tag.belohnung) merkeGefeiert();
        spiele(tag.belohnung ? 'truhe' : 'sieg');
      })
      .catch((err: unknown) => {
        gemeldet.current = false;
        setFehler(err instanceof ApiError ? t(err.messageKey) : 'Das hat nicht geklappt. Versuch es gleich nochmal.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amEnde, lektion?.id]);

  const schritt = lektion && !amEnde ? lektion.schritte[index]! : null;
  // Die Übungsrunde ist ein Doppelkopf-Tisch: Ohne Doppelkopf im Umfang
  // gibt es sie nicht (der Server lehnt sie dann ab, umfang.ts im Server).
  const mitTisch = imUmfang('doppelkopf');

  const pruefe = (stimmt: boolean, wert: number): void => {
    if (antwort?.stimmt) return;
    setGewaehlt(wert);
    setAntwort({ stimmt });
    if (!stimmt) setFehlversuche((n) => n + 1);
    spiele(stimmt ? 'stich-ein' : 'fehler');
  };

  /**
   * Alle markierten Karten auf einmal pruefen. Richtig ist es nur, wenn GENAU
   * die erlaubten markiert sind — die Menge kommt aus der Lektion, hier wird
   * nur verglichen.
   */
  const pruefeAlle = (richtig: readonly number[]): void => {
    if (antwort?.stimmt || markiert.length === 0) return;
    const soll = new Set(richtig);
    const falsche = markiert.some((id) => !soll.has(id));
    const stimmt = !falsche && markiert.length === soll.size;
    setAntwort({ stimmt, fehlt: !stimmt && !falsche });
    if (!stimmt) setFehlversuche((n) => n + 1);
    spiele(stimmt ? 'stich-ein' : 'fehler');
  };

  const umschalten = (id: number): void => {
    if (antwort) return;
    setMarkiert((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]));
  };

  const weiter = (): void => {
    setAntwort(null);
    setGewaehlt(null);
    setMarkiert([]);
    setIndex((i) => i + 1);
  };

  /** Die Markierung bleibt stehen: Man soll sie verbessern, nicht neu anfangen. */
  const nochmal = (): void => {
    setAntwort(null);
    setGewaehlt(null);
  };

  const mehrfach = schritt?.art === 'waehlen' && schritt.alle === true;

  const fortschritt = anzahl === 0 ? 0 : Math.min(1, (index + (antwort?.stimmt ? 1 : 0)) / anzahl);

  return (
    <div className="hb-voll ln-lektion" role="dialog" aria-modal="true" aria-label={lektion?.titel ?? 'Lektion'}>
      <header className="ln-lektion-kopf">
        <button type="button" className="hb-rund" onClick={onClose} aria-label="Lektion schließen">
          <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div
          className="ln-balken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={anzahl}
          aria-valuenow={Math.min(index, anzahl)}
          aria-label="Fortschritt der Lektion"
        >
          <span style={{ width: `${Math.round(fortschritt * 100)}%` }} />
        </div>
      </header>

      <div className="ln-lektion-rolle">
        {fehler && (
          <p className="hb-fehler" role="alert">
            {fehler}
          </p>
        )}
        {!lektion && !fehler && <p className="hb-laden">Lektion wird geladen…</p>}
        {schritt && (
          <SchrittAnsicht
            key={index}
            schritt={schritt}
            deck={deck}
            gewaehlt={gewaehlt}
            markiert={markiert}
            antwort={antwort}
            gesperrt={antwort?.stimmt === true}
            onKarte={(karte) => {
              if (schritt.art !== 'waehlen') return;
              if (schritt.alle) umschalten(karte.id);
              else pruefe(schritt.richtig.includes(karte.id), karte.id);
            }}
            onAntwort={(nr) => schritt.art === 'frage' && pruefe(nr === schritt.richtig, nr)}
          />
        )}
        {amEnde && lektion?.uebung && (
          <div className="ln-ende">
            <img className="ln-ende-bild" src="/hub/banner-doppelkopf.webp" alt="" />
            {mitTisch ? (
              <>
                <h2>Bereit für den Tisch?</h2>
                <p>Eine Runde, drei Bots, und unten stehen Tipps. Wenn die Runde abgerechnet ist, zählt sie für deine Serie.</p>
              </>
            ) : (
              <>
                <h2>Ende der Lektion</h2>
                <p>Die Übungsrunde am Tisch gibt es hier nicht.</p>
              </>
            )}
          </div>
        )}
        {amEnde && !lektion?.uebung && ergebnis && <Ergebnis tag={ergebnis} fehlversuche={fehlversuche} />}
        {amEnde && !lektion?.uebung && !ergebnis && !fehler && <p className="hb-laden">Wird eingetragen…</p>}
      </div>

      <footer className={`ln-fuss${antwort ? (antwort.stimmt ? ' is-richtig' : ' is-falsch') : ''}`}>
        {schritt && antwort && schritt.art !== 'erklaerung' && (
          <div className="ln-rueckmeldung" role="status">
            <strong>{antwort.stimmt ? 'Richtig!' : 'Nicht ganz'}</strong>
            <span>
              {antwort.stimmt
                ? schritt.merke
                : antwort.fehlt
                  ? 'Fast! Eine erlaubte Karte fehlt noch.'
                  : schritt.hinweis}
            </span>
          </div>
        )}
        {schritt?.art === 'erklaerung' && (
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={weiter}>
            Weiter
          </button>
        )}
        {mehrfach && !antwort && schritt?.art === 'waehlen' && (
          <button
            type="button"
            className="hb-kn is-gold is-haupt is-breit"
            disabled={markiert.length === 0}
            onClick={() => pruefeAlle(schritt.richtig)}
          >
            {markiert.length === 0 ? 'Karten antippen' : 'Prüfen'}
          </button>
        )}
        {schritt && schritt.art !== 'erklaerung' && antwort?.stimmt && (
          <button type="button" className="hb-kn is-haupt is-breit ln-kn-gruen" onClick={weiter}>
            Weiter
          </button>
        )}
        {schritt && antwort && !antwort.stimmt && (
          <button type="button" className="hb-kn is-haupt is-breit ln-kn-rot" onClick={nochmal}>
            Nochmal
          </button>
        )}
        {amEnde && lektion?.uebung && mitTisch && (
          <button
            type="button"
            className="hb-kn is-gold is-haupt is-breit"
            disabled={startet}
            onClick={() => {
              setStartet(true);
              void onUebung().catch((err: unknown) => {
                setStartet(false);
                setFehler(err instanceof ApiError ? t(err.messageKey) : 'Der Tisch ließ sich nicht öffnen.');
              });
            }}
          >
            {startet ? 'Tisch wird gedeckt…' : 'Runde starten'}
          </button>
        )}
        {amEnde && lektion?.uebung && !mitTisch && (
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onClose}>
            Weiter
          </button>
        )}
        {amEnde && ergebnis && ergebnis.belohnung && (
          <button
            type="button"
            className="hb-kn is-gold is-haupt is-breit"
            onClick={() => {
              void Promise.all(ergebnis.pfad.outfit.map((id) => api.wear(id.startsWith('hut-') ? 'hut' : 'oberteil', id)))
                .then(onAnziehen)
                .catch(() => undefined)
                .finally(onClose);
            }}
          >
            Gleich anziehen
          </button>
        )}
        {amEnde && ergebnis && (
          <button
            type="button"
            className={`hb-kn is-haupt is-breit${ergebnis.belohnung ? ' ln-kn-leise' : ' is-gold'}`}
            onClick={onClose}
          >
            {ergebnis.belohnung ? 'Später' : 'Weiter'}
          </button>
        )}
      </footer>
    </div>
  );
}

function SchrittAnsicht({
  schritt,
  deck,
  gewaehlt,
  markiert,
  antwort,
  gesperrt,
  onKarte,
  onAntwort,
}: {
  schritt: LernSchritt;
  deck: Deck;
  gewaehlt: number | null;
  markiert: readonly number[];
  antwort: Antwort | null;
  gesperrt: boolean;
  onKarte: (karte: Card) => void;
  onAntwort: (nr: number) => void;
}): React.JSX.Element {
  return (
    <div className="ln-schritt">
      <span className="hb-label">{schritt.titel}</span>
      <p className="ln-text">{schritt.text}</p>

      {schritt.art !== 'waehlen' && schritt.karten && schritt.karten.length > 0 && (
        <div className={`ln-reihe${schritt.karten.length > 6 ? ' is-dicht' : ''}`}>
          {schritt.karten.map((karte) => (
            <div className="pc ln-karte" key={karte.id}>
              <CardFront card={karte} deck={deck} />
            </div>
          ))}
        </div>
      )}

      {(schritt.art === 'waehlen' || (schritt.art === 'frage' && schritt.stich && schritt.stich.length > 0)) && (
        <Stich
          gelegt={schritt.art === 'waehlen' ? schritt.stich : schritt.stich ?? []}
          deck={deck}
          mitDir={schritt.art === 'waehlen'}
          meine={
            schritt.art === 'waehlen' && gesperrt && !schritt.alle
              ? schritt.hand.find((k) => k.id === gewaehlt) ?? null
              : null
          }
        />
      )}

      {schritt.art === 'waehlen' && (
        <div className="ln-hand" role="group" aria-label="Deine Karten">
          {schritt.hand.map((karte) => {
            const istGewaehlt = gewaehlt === karte.id;
            const stimmt = schritt.richtig.includes(karte.id);
            const istMarkiert = markiert.includes(karte.id);
            // Mehrfach: markiert ist gold; nach dem Pruefen gruen, oder rot,
            // wenn die Karte nicht erlaubt war. Was fehlt, wird nicht verraten.
            const klasse = schritt.alle
              ? istMarkiert
                ? antwort?.stimmt
                  ? ' is-richtig'
                  : antwort && !stimmt
                    ? ' is-falsch'
                    : ' is-markiert'
                : ''
              : `${istGewaehlt ? (stimmt ? ' is-richtig' : ' is-falsch') : ''}${istGewaehlt && stimmt && gesperrt ? ' is-gelegt' : ''}`;
            return (
              <button
                type="button"
                key={karte.id}
                className={`ln-handkarte${klasse}`}
                aria-pressed={schritt.alle ? istMarkiert : undefined}
                disabled={schritt.alle ? antwort !== null : gesperrt && !istGewaehlt}
                onClick={() => {
                  spiele('karte-legen');
                  onKarte(karte);
                }}
              >
                <div className="pc ln-karte">
                  <CardFront card={karte} deck={deck} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {schritt.art === 'frage' && (
        <div className={`ln-antworten${schritt.antworten.length > 3 ? ' is-raster' : ''}`}>
          {schritt.antworten.map((text, nr) => {
            const istGewaehlt = gewaehlt === nr;
            return (
              <button
                type="button"
                key={text}
                className={`ln-antwort${istGewaehlt ? (nr === schritt.richtig ? ' is-richtig' : ' is-falsch') : ''}`}
                disabled={gesperrt && !istGewaehlt}
                onClick={() => onAntwort(nr)}
              >
                {text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Der Stich auf grünem Filz, mit Namen darunter. `mitDir`: ein Platz für deine
 * Karte — leer, bis sie richtig gewählt ist, dann liegt sie dort (`meine`).
 */
function Stich({
  gelegt,
  deck,
  mitDir,
  meine,
}: {
  gelegt: readonly LernStichKarte[];
  deck: Deck;
  mitDir: boolean;
  meine: Card | null;
}): React.JSX.Element {
  return (
    <div className="ln-filz">
      {gelegt.map((g) => (
        <figure key={g.karte.id} className="ln-gelegt">
          <div className="pc ln-karte">
            <CardFront card={g.karte} deck={deck} />
          </div>
          <figcaption>{LERN_NAMEN[g.sitz]}</figcaption>
        </figure>
      ))}
      {mitDir && (
        <figure className={`ln-gelegt${meine ? ' is-meine' : ' is-frei'}`}>
          {meine ? (
            <div className="pc ln-karte">
              <CardFront card={meine} deck={deck} />
            </div>
          ) : (
            <div className="ln-platz" aria-hidden="true">
              ?
            </div>
          )}
          <figcaption>Du</figcaption>
        </figure>
      )}
    </div>
  );
}

function Ergebnis({ tag, fehlversuche }: { tag: Spieltag; fehlversuche: number }): React.JSX.Element {
  const ziel = tag.pfad.ziel;
  return (
    <div className="ln-ende">
      {tag.belohnung ? (
        <>
          <div className="ln-feier-pinguin">
            <Pinguin getragen={{ hut: 'hut-doktorhut', oberteil: 'oberteil-meisterrobe' }} groesse={11} titel="Pinguin als Doko-Meister" />
          </div>
          <h2>Doko-Meister!</h2>
          <p>Sieben Tage am Stück — dein Pinguin hat sich Doktorhut und Meisterrobe verdient. Beides liegt jetzt in deinem Kleiderschrank.</p>
        </>
      ) : (
        <>
          <div className="ln-feier-flamme">
            <Flamme groesse={7} />
            <strong className="ln-feier-zahl">{tag.serie}</strong>
          </div>
          <h2>Lektion geschafft!</h2>
          <p>
            {tag.neuerTag
              ? tag.serie === 1
                ? 'Deine Serie beginnt. Komm morgen wieder, dann brennt die Flamme weiter.'
                : `${tag.serie} Tage am Stück — weiter so!`
              : 'Heute hast du schon gespielt, die Flamme brennt.'}
            {tag.geschuetzt && ' Dein Wochenschutz hat den verpassten Tag überbrückt.'}
          </p>
          {tag.serie < ziel && !tag.pfad.belohnt && (
            <p className="hb-klein">
              Noch {ziel - tag.serie} {ziel - tag.serie === 1 ? 'Tag' : 'Tage'} bis zum Doko-Meister-Outfit.
            </p>
          )}
        </>
      )}
      <p className="ln-fehlerzahl">{fehlversuche === 0 ? 'Ohne einen Fehler!' : `${fehlversuche} ${fehlversuche === 1 ? 'Fehlversuch' : 'Fehlversuche'}`}</p>
    </div>
  );
}
