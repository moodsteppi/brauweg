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
  MINDESTENS_MINISPIELE,
  MINISPIEL_ABLAUF,
  MINISPIEL_ZEICHEN,
  MODI,
  PAKET_ALLES,
  PAKET_NAME,
  alleMinispiele,
  inhaltTitel,
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
import { tz } from './text';

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
          <SpielAbschnitt titel={tz('auswahl.modus')}>
            <AuswahlRaster
              label={tz('auswahl.modus')}
              spalten={2}
              eintraege={MODI.map((m) => ({ kennung: m.kennung, titel: m.titel, untertitel: m.text }))}
              gewaehlt={modus}
              onWahl={(kennung) => onWahl({ ...wahl, modus: kennung })}
            />
            {modus === 'themenabend' && paket === PAKET_ALLES ? (
              <p className="hb-klein">{tz('auswahl.themenabendOhnePaket')}</p>
            ) : null}
          </SpielAbschnitt>
        ) : null}

        <SpielAbschnitt titel={tz('auswahl.themenpakete')}>
          <AuswahlRaster
            label={tz('auswahl.themenpaket')}
            spalten={3}
            className="spe-pakete"
            eintraege={[
              {
                kennung: PAKET_ALLES,
                titel: tz('auswahl.paketAlles'),
                untertitel: tz('auswahl.paketAllesText'),
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
          <p className="hb-klein">{tz('auswahl.paketMischt')}</p>
          {irgendeinPaketGesperrt ? (
            <p className="hb-klein" data-pk-paketsperre="">
              {tz('auswahl.paketGesperrt')}
            </p>
          ) : null}
        </SpielAbschnitt>

        {/* „Inhalte“, nicht „Härte“ — die Härte ist der Schluck-Regler in den Einstellungen. */}
        <SpielAbschnitt titel={inhaltTitel()}>
          <AuswahlRaster
            label={inhaltTitel()}
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
        {tz('auswahl.titel')}
      </h2>

      {modusBekannt(vorgabe) ? (
        <div className="pk-aw-block" data-pk-modus="">
          <h3 className="pk-aw-titel">{tz('auswahl.modus')}</h3>
          <AuswahlRaster
            label={tz('auswahl.modus')}
            spalten={2}
            eintraege={MODI.map((m) => ({ kennung: m.kennung, titel: m.titel, untertitel: m.text }))}
            gewaehlt={modus}
            onWahl={(kennung) => onWahl({ ...wahl, modus: kennung })}
          />
          {modus === 'themenabend' && paket === PAKET_ALLES ? (
            <p className="pk-aw-hinweis">{tz('auswahl.themenabendOhnePaket')}</p>
          ) : null}
        </div>
      ) : null}

      <MinispielAuswahl vorgabe={vorgabe} wahl={wahl} trinkmodus={trinkmodus} onWahl={onWahl} />

      <div className="pk-aw-block" data-pk-inhalt="">
        {/* „Inhalte“, nicht „Härte“ — die Härte ist der Schluck-Regler darueber. */}
        <h3 className="pk-aw-titel">{inhaltTitel()}</h3>
        <AuswahlRaster
          label={inhaltTitel()}
          spalten={2}
          eintraege={inhaltsKacheln(vorgabe, gast)}
          gewaehlt={kachel}
          onWahl={(kennung) => onWahl({ ...wahl, inhaltsHaerte: inhaltsWahlAus(kennung) })}
        />
      </div>

      <div className="pk-aw-block" data-pk-paket="">
        <h3 className="pk-aw-titel">{tz('auswahl.themenpaket')}</h3>
        <AuswahlRaster
          label={tz('auswahl.themenpaket')}
          spalten={3}
          eintraege={[
            { kennung: PAKET_ALLES, titel: tz('auswahl.paketAlles'), untertitel: tz('auswahl.paketAllesText') },
            ...Object.entries(PAKET_NAME).map(([kennung, titel]) => ({
              kennung,
              titel,
              deaktiviert: paketSperre?.(kennung),
            })),
          ]}
          gewaehlt={paket}
          onWahl={(kennung) => onWahl({ ...wahl, paket: kennung })}
        />
        <p className="pk-aw-hinweis">{tz('auswahl.paketMischt')}</p>
        {irgendeinPaketGesperrt ? (
          <p className="pk-aw-hinweis" data-pk-paketsperre="">
            {tz('auswahl.paketGesperrt')}
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
        <SpielAbschnitt titel={tz('auswahl.minispiele')}>
          <p className="spe-leer" data-pk-minispiele="">
            {tz('auswahl.minispieleLaden')}
          </p>
        </SpielAbschnitt>
      );
    }
    return (
      <div className="pk-aw-block" data-pk-minispiele="">
        <h3 className="pk-aw-titel">{tz('auswahl.minispiele')}</h3>
        <p className="pk-warten">{tz('auswahl.minispieleLaden')}</p>
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
      {tz('auswahl.zuWenig', { n: mindestens })}
    </p>
  ) : null;
  const mischHinweis = <p className={hinweis}>{tz('auswahl.gemischt')}</p>;
  const nichtAlle = gewaehlt.length < alle.length;

  if (neu) {
    return (
      <SpielAbschnitt
        titel={tz('auswahl.minispiele')}
        zusatz={<>{tz('auswahl.vonAn', { an: gewaehlt.length, alle: alle.length })}</>}
      >
        <div className="spe-minispiele" data-pk-minispiele="">
          <div className="regeln spe-pk-regeln" role="group" aria-label={tz('auswahl.minispiele')}>
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
              {tz('auswahl.alleAn')}
            </button>
          ) : null}
        </div>
      </SpielAbschnitt>
    );
  }

  const eintraege: AuswahlEintrag[] = alle.map((id) => {
    const ablauf = MINISPIEL_ABLAUF[id as PartyMinispiel];
    const regel = ansageFuer(id as PartyMinispiel, trinkmodus) as string | undefined;
    /* Der Ablauf ist eine Kennung ('gleichzeitig'/'reihum') — angezeigt wird ihr Wort. */
    const ablaufText = ablauf ? tz(`auswahl.ablauf.${ablauf}`) : undefined;
    return {
      kennung: id,
      titel: minispielName(id),
      untertitel: [ablaufText, regel].filter(Boolean).join(' · ') || undefined,
      vorschau: <span className="pk-aw-zeichen">{MINISPIEL_ZEICHEN[id as PartyMinispiel] ?? minispielName(id).slice(0, 1)}</span>,
      // An heisst Rand UND Haken — nicht nur die Farbe.
      badge: gewaehlt.includes(id) ? <span className="pk-aw-an">✓</span> : undefined,
    };
  });

  return (
    <div className="pk-aw-block" data-pk-minispiele="">
      <div className="pk-aw-kopf">
        <h3 className="pk-aw-titel">{tz('auswahl.minispiele')}</h3>
        <span className="pk-aw-zahl">
          {tz('auswahl.vonAn', { an: gewaehlt.length, alle: alle.length })}
        </span>
        {nichtAlle ? (
          <button type="button" className="pk-textknopf" data-pk-alle="" onClick={alleAn}>
            {tz('auswahl.alleAn')}
          </button>
        ) : null}
      </div>
      <AuswahlRaster
        label={tz('auswahl.minispiele')}
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
    <svg viewBox="0 0 24 24" width="14" height="14" aria-label={tz('auswahl.gesperrt')} role="img" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
