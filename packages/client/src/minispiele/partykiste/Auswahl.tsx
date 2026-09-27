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
  INHALT_GEMISCHT,
  INHALT_TITEL,
  MINDESTENS_MINISPIELE,
  MINISPIEL_ABLAUF,
  MINISPIEL_ZEICHEN,
  MODI,
  PAKET_ALLES,
  PAKET_NAME,
  alleMinispiele,
  inhaltsKacheln,
  gemerkteWahl,
  merkeWahl,
  minispielName,
  minispielWahl,
  modusBekannt,
  regelsatzAus,
  wirksameInhaltsKachel,
  wirksameMinispiele,
  wirksamerModus,
  wirksamesPaket,
  type PartyWahl,
} from './wahl';
import { SpielAbschnitt } from '../../screens/SpielEinstieg';
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
  paketSperre,
  neu = false,
  einzel = false,
}: {
  vorgabe: Record<string, unknown> | null;
  wahl: PartyWahl;
  gast: boolean;
  /** Fuer die Kurzregel: Die Ansagen reden ohne Trinkmodus nicht vom Trinken. */
  trinkmodus: boolean;
  onWahl: (neu: PartyWahl) => void;
  /**
   * Warum ein Themenpaket gesperrt ist (Zusatzpaket, das nicht gehoert) —
   * oder `undefined`. Kommt fertig vom Bildschirm (`useInhaltsSperren`),
   * entschieden hat es der Server.
   */
  paketSperre?: (paket: string) => string | undefined;
  /**
   * Neues Hub: dieselben Raster und Wahlen, aber als Abschnitte des
   * Spieleinstiegs und die Themenpakete mit ihrem Bild (`/hub/paket-<id>.webp`).
   */
  neu?: boolean;
  /**
   * Einzelspiel (einzelspiele.ts): Das Minispiel liegt fest, der Modus ist das
   * Turnier — Modus und Minispielwahl entfallen, Pakete und Inhalte bleiben.
   */
  einzel?: boolean;
}): React.JSX.Element {
  /* Welche der vier Inhalte-Kacheln gilt (harmlos · pikant · derb · gemischt). */
  const kachel = wirksameInhaltsKachel(vorgabe, wahl, gast);
  const paket = wirksamesPaket(vorgabe, wahl);
  const modus = wirksamerModus(vorgabe, wahl);
  const irgendeinPaketGesperrt =
    paketSperre !== undefined && Object.keys(PAKET_NAME).some((k) => paketSperre(k) !== undefined);

  if (neu) {
    return (
      <>
        {modusBekannt(vorgabe) && !einzel ? (
          <SpielAbschnitt titel="Modus">
            <AuswahlRaster
              label="Modus"
              spalten={2}
              eintraege={MODI.map((m) => ({ kennung: m.kennung, titel: m.titel, untertitel: m.text }))}
              gewaehlt={modus}
              onWahl={(kennung) => onWahl({ ...wahl, modus: kennung })}
            />
            {modus === 'themenabend' && paket === PAKET_ALLES ? (
              <p className="hb-klein">Für den Themenabend unten ein Themenpaket wählen.</p>
            ) : null}
          </SpielAbschnitt>
        ) : null}

        <SpielAbschnitt titel="Themenpakete">
          <AuswahlRaster
            label="Themenpaket"
            spalten={3}
            className="spe-pakete"
            eintraege={[
              {
                kennung: PAKET_ALLES,
                titel: 'alles',
                untertitel: 'Ohne Thema',
                vorschau: <span className="spe-paket-alles">✦</span>,
              },
              ...Object.entries(PAKET_NAME).map(([kennung, titel]) => {
                const grund = paketSperre?.(kennung);
                return {
                  kennung,
                  titel,
                  bild: `/hub/paket-${kennung}.webp`,
                  deaktiviert: grund,
                  // Gesperrt heißt Schloss plus leise Schrift (DESIGN.md, „Das neue Hub").
                  badge: grund ? <SchlossZeichen /> : undefined,
                };
              }),
            ]}
            gewaehlt={paket}
            onWahl={(kennung) => onWahl({ ...wahl, paket: kennung })}
          />
          <p className="hb-klein">Hat ein Paket zu wenig eigene Inhalte, mischt die Kiste allgemeine dazu.</p>
          {irgendeinPaketGesperrt ? (
            <p className="hb-klein" data-pk-paketsperre="">
              Gesperrte Pakete braucht nur, wer die Runde aufmacht — alle anderen spielen mit.
            </p>
          ) : null}
        </SpielAbschnitt>

        {/* „Inhalte“, nicht „Härte“ — die Härte ist der Schluck-Regler in den Einstellungen. */}
        <SpielAbschnitt titel={INHALT_TITEL}>
          <AuswahlRaster
            label={INHALT_TITEL}
            spalten={2}
            eintraege={inhaltsKacheln(vorgabe, gast)}
            gewaehlt={kachel}
            onWahl={(kennung) => onWahl({ ...wahl, inhaltsHaerte: inhaltsWahlAus(kennung) })}
          />
        </SpielAbschnitt>

        {einzel ? null : (
          <MinispielAuswahl neu vorgabe={vorgabe} wahl={wahl} trinkmodus={trinkmodus} onWahl={onWahl} />
        )}
      </>
    );
  }

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
          spalten={2}
          eintraege={inhaltsKacheln(vorgabe, gast)}
          gewaehlt={kachel}
          onWahl={(kennung) => onWahl({ ...wahl, inhaltsHaerte: inhaltsWahlAus(kennung) })}
        />
      </div>

      <div className="pk-aw-block" data-pk-paket="">
        <h3 className="pk-aw-titel">Themenpaket</h3>
        <AuswahlRaster
          label="Themenpaket"
          spalten={3}
          eintraege={[
            { kennung: PAKET_ALLES, titel: 'alles', untertitel: 'Ohne Thema' },
            ...Object.entries(PAKET_NAME).map(([kennung, titel]) => ({
              kennung,
              titel,
              deaktiviert: paketSperre?.(kennung),
            })),
          ]}
          gewaehlt={paket}
          onWahl={(kennung) => onWahl({ ...wahl, paket: kennung })}
        />
        <p className="pk-aw-hinweis">
          Hat ein Paket zu wenig eigene Inhalte, mischt die Kiste allgemeine dazu.
        </p>
        {irgendeinPaketGesperrt ? (
          <p className="pk-aw-hinweis" data-pk-paketsperre="">
            Gesperrte Pakete braucht nur, wer die Runde aufmacht — alle anderen spielen mit.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Minispiele: an- und ausklicken, die Kiste mischt.
 *
 * Seit dem 27.09.2026 (Robin: „nicht mehr Reihenfolge, sonst wie bei
 * Doppelkopf an/ausklickbar und dann ist Zufall"). Bis dahin zaehlte die
 * Reihenfolge der Auswahl — die Runden gingen reihum durch die Liste, und
 * darunter stand eine Liste mit Hoch- und Runter-Knoepfen. Jetzt mischt das
 * Modul (`minispielFolge`): jedes angeklickte Spiel einmal je Mischung, keins
 * zweimal hintereinander. Die Auswahl ist deshalb eine Menge und wird in der
 * Reihenfolge des Moduls geschickt.
 *
 * Im neuen Hub sind es dieselben Kacheln wie die Regeln der Kartenlobby
 * (`RegelSheet` in Lobby.tsx, `.spe .regel`): Symbol, Name, an mit goldenem
 * Rand UND Haken — nicht nur ueber die Farbe. Im alten Hub bleibt das Raster
 * des alten Menues, nur ohne Platznummer.
 */
function MinispielAuswahl({
  vorgabe,
  wahl,
  trinkmodus,
  onWahl,
  neu = false,
}: {
  vorgabe: Record<string, unknown> | null;
  wahl: PartyWahl;
  trinkmodus: boolean;
  onWahl: (neu: PartyWahl) => void;
  /** Neues Hub: als Abschnitt des Spieleinstiegs. */
  neu?: boolean;
}): React.JSX.Element {
  const [zuWenig, setZuWenig] = useState(false);
  const alle = alleMinispiele(vorgabe);
  const gewaehlt = wirksameMinispiele(vorgabe, wahl);

  const hinweis = neu ? 'hb-klein' : 'pk-aw-hinweis';

  if (!alle || !gewaehlt) {
    if (neu) {
      return (
        <SpielAbschnitt titel="Minispiele">
          <p className="spe-leer" data-pk-minispiele="">
            Minispiele werden geladen …
          </p>
        </SpielAbschnitt>
      );
    }
    return (
      <div className="pk-aw-block" data-pk-minispiele="">
        <h3 className="pk-aw-titel">Minispiele</h3>
        <p className="pk-warten">Minispiele werden geladen …</p>
      </div>
    );
  }

  const mindestens = Math.min(MINDESTENS_MINISPIELE, alle.length);
  const umschalten = (id: string): void => {
    const an = new Set(gewaehlt);
    if (an.has(id)) an.delete(id);
    else an.add(id);
    // In der Reihenfolge des Moduls: Die Reihenfolge bedeutet nichts mehr, und
    // so erkennt `minispielWahl` „alle an“ und merkt dann nichts.
    const neueWahl = alle.filter((k) => an.has(k));
    if (neueWahl.length < mindestens) {
      setZuWenig(true);
      return;
    }
    setZuWenig(false);
    onWahl({ ...wahl, minispiele: minispielWahl(vorgabe, neueWahl) });
  };

  const alleAn = (): void => {
    setZuWenig(false);
    onWahl({ ...wahl, minispiele: null });
  };

  const zuWenigHinweis = zuWenig ? (
    <p className={hinweis} role="status">
      Mindestens {mindestens} Minispiele — sonst kommt dasselbe ständig wieder.
    </p>
  ) : null;
  const mischHinweis = <p className={hinweis}>Die angeklickten Spiele kommen gemischt dran, keins zweimal hintereinander.</p>;
  const nichtAlle = gewaehlt.length < alle.length;

  if (neu) {
    return (
      <SpielAbschnitt
        titel="Minispiele"
        zusatz={
          <>
            {gewaehlt.length} von {alle.length} an
          </>
        }
      >
        <div className="spe-minispiele" data-pk-minispiele="">
          <div className="regeln spe-pk-regeln" role="group" aria-label="Minispiele">
            {alle.map((id) => {
              const an = gewaehlt.includes(id);
              return (
                <button
                  type="button"
                  key={id}
                  className={`regel${an ? ' is-on' : ''}`}
                  aria-pressed={an}
                  data-kennung={id}
                  onClick={() => umschalten(id)}
                >
                  <span className="regel-bild" aria-hidden="true">
                    {MINISPIEL_ZEICHEN[id as PartyMinispiel] ?? minispielName(id).slice(0, 1)}
                  </span>
                  {minispielName(id)}
                  <span className="regel-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
          {zuWenigHinweis}
          {mischHinweis}
          {nichtAlle ? (
            <button type="button" className="hb-kn is-blau is-klein spe-pk-alle" data-pk-alle="" onClick={alleAn}>
              Alle an
            </button>
          ) : null}
        </div>
      </SpielAbschnitt>
    );
  }

  const eintraege: AuswahlEintrag[] = alle.map((id) => {
    const ablauf = MINISPIEL_ABLAUF[id as PartyMinispiel];
    const regel = ansageFuer(id as PartyMinispiel, trinkmodus) as string | undefined;
    return {
      kennung: id,
      titel: minispielName(id),
      untertitel: [ablauf, regel].filter(Boolean).join(' · ') || undefined,
      vorschau: <span className="pk-aw-zeichen">{MINISPIEL_ZEICHEN[id as PartyMinispiel] ?? minispielName(id).slice(0, 1)}</span>,
      // An heisst Rand UND Haken — nicht nur die Farbe.
      badge: gewaehlt.includes(id) ? <span className="pk-aw-an">✓</span> : undefined,
    };
  });

  return (
    <div className="pk-aw-block" data-pk-minispiele="">
      <div className="pk-aw-kopf">
        <h3 className="pk-aw-titel">Minispiele</h3>
        <span className="pk-aw-zahl">
          {gewaehlt.length} von {alle.length} an
        </span>
        {nichtAlle ? (
          <button type="button" className="pk-textknopf" data-pk-alle="" onClick={alleAn}>
            Alle an
          </button>
        ) : null}
      </div>
      <AuswahlRaster
        label="Minispiele"
        mehrfach
        eintraege={eintraege}
        gewaehlt={gewaehlt}
        onWahl={(kennung) => umschalten(kennung)}
      />
      {zuWenigHinweis}
      {mischHinweis}
    </div>
  );
}

/** Die angetippte Inhalte-Kachel als Wahl: eine Stufe oder „gemischt". */
function inhaltsWahlAus(kennung: string): PartyWahl['inhaltsHaerte'] {
  return kennung === INHALT_GEMISCHT ? INHALT_GEMISCHT : Number(kennung);
}

/** Schloss an einer gesperrten Kachel — gesperrt heißt Schloss plus leise Schrift. */
function SchlossZeichen(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-label="gesperrt" role="img" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
