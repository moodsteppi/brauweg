/**
 * Die Auswahl im Menue der Partykiste — Modus, Minispiele, Inhalte, Themenpaket.
 *
 * Zwei Teile, damit der Schaukasten die Kacheln ohne Server zeigen kann:
 * `usePartyAuswahl` haelt die Wahl (localStorage) und holt die Vorgabe des
 * Moduls, `PartyAuswahl` zeichnet sie. Was gewaehlt werden KANN und was
 * daraus als `config` wird, steht in `wahl.ts`.
 *
 * Gilt fuer beide Wege, Bot- und Online-Tisch: Der Bildschirm holt den
 * Regelsatz fuer beide ueber `regelsatz()`.
 */

import { useCallback, useState } from 'react';

import { AuswahlRaster, type AuswahlEintrag } from '../../hub';
import { useSpielVorgabe } from '../../spiel-vorgabe';
import {
  DERB_GRUND_GAST,
  INHALT_STUFEN,
  INHALT_TITEL,
  MINDESTENS_MINISPIELE,
  MINISPIEL_ABLAUF,
  MINISPIEL_ZEICHEN,
  MODI,
  PAKET_ALLES,
  PAKET_NAME,
  alleMinispiele,
  gemerkteWahl,
  merkeWahl,
  minispielName,
  minispielWahl,
  modusBekannt,
  regelsatzAus,
  verschiebe,
  wirksameInhaltsHaerte,
  wirksameMinispiele,
  wirksamerModus,
  wirksamesPaket,
  type PartyWahl,
} from './wahl';
import { ansageFuer, type PartyMinispiel } from './sicht';

export interface PartyAuswahlStand {
  /** Regelsatz des Moduls, sobald er da ist — vorher `null`. */
  vorgabe: Record<string, unknown> | null;
  wahl: PartyWahl;
  gast: boolean;
  setWahl: (neu: PartyWahl) => void;
  /**
   * Der Regelsatz fuer `createTable`: Vorgabe des Moduls, darauf `basis`
   * (Trinkmodus, Schluckfaktor), darauf die Auswahl. Wartet auf die Vorgabe,
   * statt zu raten (spiel-vorgabe.ts).
   */
  regelsatz: (basis: object) => Promise<Record<string, unknown>>;
}

/**
 * Die Wahl im Menue, gemerkt im Browser.
 *
 * `gast` kommt vom Bildschirm (`me.gast`), weil der `me` ohnehin schon holt.
 * Solange die Antwort fehlt, zaehlt niemand als Gast — das Menue sperrt dann
 * „derb“ noch nicht, der Server kappt trotzdem (siehe `wirksameInhaltsHaerte`).
 */
export function usePartyAuswahl(gast: boolean): PartyAuswahlStand {
  const { holen, vorgabe } = useSpielVorgabe('partykiste');
  const [wahl, setzeWahl] = useState<PartyWahl>(gemerkteWahl);

  const setWahl = useCallback((neu: PartyWahl): void => {
    setzeWahl(neu);
    merkeWahl(neu);
  }, []);

  const regelsatz = useCallback(
    async (basis: object): Promise<Record<string, unknown>> =>
      regelsatzAus(await holen(), basis as Record<string, unknown>, wahl, gast),
    [holen, wahl, gast],
  );

  return { vorgabe, wahl, gast, setWahl, regelsatz };
}

export function PartyAuswahl({
  vorgabe,
  wahl,
  gast,
  trinkmodus,
  onWahl,
}: {
  vorgabe: Record<string, unknown> | null;
  wahl: PartyWahl;
  gast: boolean;
  /** Fuer die Kurzregel: Die Ansagen reden ohne Trinkmodus nicht vom Trinken. */
  trinkmodus: boolean;
  onWahl: (neu: PartyWahl) => void;
}): React.JSX.Element {
  const stufe = wirksameInhaltsHaerte(vorgabe, wahl, gast);
  const paket = wirksamesPaket(vorgabe, wahl);
  const modus = wirksamerModus(vorgabe, wahl);

  return (
    <section className="pk-aw" aria-labelledby="pk-aw-titel" data-pk-auswahl="">
      <h2 id="pk-aw-titel" className="pk-einstellungen-titel">
        Auswahl
      </h2>

      {modusBekannt(vorgabe) ? (
        <div className="pk-aw-block" data-pk-modus="">
          <h3 className="pk-aw-titel">Modus</h3>
          <AuswahlRaster
            label="Modus"
            spalten={2}
            eintraege={MODI.map((m) => ({ kennung: m.kennung, titel: m.titel, untertitel: m.text }))}
            gewaehlt={modus}
            onWahl={(kennung) => onWahl({ ...wahl, modus: kennung })}
          />
          {modus === 'themenabend' && paket === PAKET_ALLES ? (
            <p className="pk-aw-hinweis">Für den Themenabend unten ein Themenpaket wählen.</p>
          ) : null}
        </div>
      ) : null}

      <MinispielAuswahl vorgabe={vorgabe} wahl={wahl} trinkmodus={trinkmodus} onWahl={onWahl} />

      <div className="pk-aw-block" data-pk-inhalt="">
        {/* „Inhalte“, nicht „Härte“ — die Härte ist der Schluck-Regler darueber. */}
        <h3 className="pk-aw-titel">{INHALT_TITEL}</h3>
        <AuswahlRaster
          label={INHALT_TITEL}
          spalten={3}
          eintraege={INHALT_STUFEN.map((s) => ({
            kennung: String(s.stufe),
            titel: s.titel,
            untertitel: s.text,
            deaktiviert: gast && s.stufe === 3 ? DERB_GRUND_GAST : undefined,
          }))}
          gewaehlt={stufe === null ? null : String(stufe)}
          onWahl={(kennung) => onWahl({ ...wahl, inhaltsHaerte: Number(kennung) })}
        />
      </div>

      <div className="pk-aw-block" data-pk-paket="">
        <h3 className="pk-aw-titel">Themenpaket</h3>
        <AuswahlRaster
          label="Themenpaket"
          spalten={3}
          eintraege={[
            { kennung: PAKET_ALLES, titel: 'alles', untertitel: 'Ohne Thema' },
            ...Object.entries(PAKET_NAME).map(([kennung, titel]) => ({ kennung, titel })),
          ]}
          gewaehlt={paket}
          onWahl={(kennung) => onWahl({ ...wahl, paket: kennung })}
        />
        <p className="pk-aw-hinweis">
          Hat ein Paket zu wenig eigene Inhalte, mischt die Kiste allgemeine dazu.
        </p>
      </div>
    </section>
  );
}

/**
 * Minispiele: mehrere waehlen, und die Reihenfolge zaehlt.
 *
 * Die Reihenfolge ist die, in der die Runden drankommen (`minispielFuer`
 * im Modul: reihum durch die Liste, dann von vorn). Neu angetippte Spiele
 * haengen sich hinten an; in der Liste darunter laesst sich jedes eins
 * frueher oder spaeter setzen.
 */
function MinispielAuswahl({
  vorgabe,
  wahl,
  trinkmodus,
  onWahl,
}: {
  vorgabe: Record<string, unknown> | null;
  wahl: PartyWahl;
  trinkmodus: boolean;
  onWahl: (neu: PartyWahl) => void;
}): React.JSX.Element {
  const [zuWenig, setZuWenig] = useState(false);
  const alle = alleMinispiele(vorgabe);
  const gewaehlt = wirksameMinispiele(vorgabe, wahl);

  if (!alle || !gewaehlt) {
    return (
      <div className="pk-aw-block" data-pk-minispiele="">
        <h3 className="pk-aw-titel">Minispiele</h3>
        <p className="pk-warten">Minispiele werden geladen …</p>
      </div>
    );
  }

  const mindestens = Math.min(MINDESTENS_MINISPIELE, alle.length);
  const setze = (neu: readonly string[]): void => {
    if (neu.length < mindestens) {
      setZuWenig(true);
      return;
    }
    setZuWenig(false);
    onWahl({ ...wahl, minispiele: minispielWahl(vorgabe, neu) });
  };

  const eintraege: AuswahlEintrag[] = alle.map((id) => {
    const platz = gewaehlt.indexOf(id);
    const ablauf = MINISPIEL_ABLAUF[id as PartyMinispiel];
    const regel = ansageFuer(id as PartyMinispiel, trinkmodus) as string | undefined;
    return {
      kennung: id,
      titel: minispielName(id),
      untertitel: [ablauf, regel].filter(Boolean).join(' · ') || undefined,
      vorschau: <span className="pk-aw-zeichen">{MINISPIEL_ZEICHEN[id as PartyMinispiel] ?? minispielName(id).slice(0, 1)}</span>,
      badge: platz >= 0 ? <span className="pk-aw-platz">{platz + 1}.</span> : undefined,
    };
  });

  return (
    <div className="pk-aw-block" data-pk-minispiele="">
      <div className="pk-aw-kopf">
        <h3 className="pk-aw-titel">Minispiele</h3>
        <span className="pk-aw-zahl">
          {gewaehlt.length} von {alle.length}
        </span>
        {gewaehlt.length < alle.length ? (
          <button
            type="button"
            className="pk-textknopf"
            data-pk-alle=""
            onClick={() => {
              setZuWenig(false);
              onWahl({ ...wahl, minispiele: null });
            }}
          >
            Alle
          </button>
        ) : null}
      </div>
      <AuswahlRaster
        label="Minispiele"
        mehrfach
        eintraege={eintraege}
        gewaehlt={gewaehlt}
        onWahl={(_kennung, auswahl) => setze(auswahl)}
      />
      {zuWenig ? (
        <p className="pk-aw-hinweis" role="status">
          Mindestens {mindestens} Minispiele — sonst kommt dasselbe ständig wieder.
        </p>
      ) : null}
      <ol className="pk-aw-folge" aria-label="Reihenfolge der Minispiele">
        {gewaehlt.map((id, i) => (
          <li key={id} data-pk-folge={id}>
            <span className="pk-aw-folgename">{minispielName(id)}</span>
            <button
              type="button"
              aria-label={`${minispielName(id)} früher`}
              disabled={i === 0}
              onClick={() => setze(verschiebe(gewaehlt, id, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`${minispielName(id)} später`}
              disabled={i === gewaehlt.length - 1}
              onClick={() => setze(verschiebe(gewaehlt, id, 1))}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <p className="pk-aw-hinweis">
        In dieser Reihenfolge kommen die Runden dran; sind es mehr Runden als Spiele, geht es vorn weiter.
      </p>
    </div>
  );
}
