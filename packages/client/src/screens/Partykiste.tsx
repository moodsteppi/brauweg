import { useCallback, useEffect, useState } from 'react';

import { api, type Me } from '../api';
import { MINISPIEL_ANSAGE, MINISPIEL_NAME, type PartyAktion, type PartykisteSicht } from '../minispiele/partykiste/sicht';
import { Runde, namenFuer } from '../minispiele/partykiste/Runden';
import type { BotLevel, SeatInfo } from '../protocol';
import { useTable } from '../useTable';

/**
 * Partykiste — ein Turnier aus Partyminispielen fuer 4 bis 12 Leute.
 *
 * Ein Bildschirm mit drei Gesichtern, wie bei Golf und Filler: ohne Tisch das
 * Menü, mit Tisch aber ohne Sicht die Runde (Lobby), mit Sicht das laufende
 * Minispiel.
 *
 * **Was diesen Bildschirm ausmacht, ist, was er NICHT tut.** Er zeigt je Runde
 * genau eine Sache — ein Wort, eine Frage, drei Karten — und darunter die
 * Schaltflächen. Kein Spielbrett, keine Animation, keine zweite Ebene: Geredet
 * wird am Tisch, der Bildschirm nimmt nur die Entscheidung entgegen. Beim
 * Imposter ist das buchstäblich ein einziges Wort, und mehr wäre dort
 * schlechter, nicht besser.
 *
 * Die Wertung läuft über das ganze Turnier (`sicht.tabelle`), die Schlücke
 * stehen daneben und zählen nicht mit — wer den Trinkmodus ausschaltet, spielt
 * sonst ein anderes Spiel.
 */

const SCHLUESSEL_RUNDEN = 'partykiste.runden';
const SCHLUESSEL_BOTS = 'partykiste.bots';
const SCHLUESSEL_STUFE = 'partykiste.botstufe';
const SCHLUESSEL_HAERTE = 'partykiste.haerte';

const STUFEN: readonly BotLevel[] = ['anfaenger', 'standard', 'experte', 'genie'];
const STUFE_NAME: Record<BotLevel, string> = {
  anfaenger: 'Anfänger',
  standard: 'Normal',
  experte: 'Experte',
  genie: 'Profi',
};
const HAERTE_NAME = ['', 'gemütlich', 'normal', 'kurzer Abend'] as const;

/** Aus dem Browser lesen. Gesperrte Seitendaten sind kein Fehler, nur leer. */
function gemerkt(schluessel: string, vorgabe: number, min: number, max: number): number {
  try {
    const wert = Number(localStorage.getItem(schluessel));
    if (!Number.isFinite(wert) || wert < min || wert > max) return vorgabe;
    return Math.round(wert);
  } catch {
    return vorgabe;
  }
}

function merke(schluessel: string, wert: string | number): void {
  try {
    localStorage.setItem(schluessel, String(wert));
  } catch {
    /* Privates Fenster. Die Wahl gilt trotzdem — nur eben nicht morgen. */
  }
}

function gemerkteStufe(): BotLevel {
  try {
    const wert = localStorage.getItem(SCHLUESSEL_STUFE);
    return STUFEN.includes(wert as BotLevel) ? (wert as BotLevel) : 'standard';
  } catch {
    return 'standard';
  }
}

export function Partykiste({
  startTisch,
  onBack,
}: {
  startTisch: string | null;
  onBack: () => void;
}): React.JSX.Element {
  const [tischId, setTischId] = useState<string | null>(startTisch);
  const [ich, setIch] = useState<Me | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [botsOffen, setBotsOffen] = useState(false);
  const [tafel, setTafel] = useState(false);
  const [bots, setBots] = useState(() => gemerkt(SCHLUESSEL_BOTS, 3, 3, 11));
  const [runden, setRunden] = useState(() => gemerkt(SCHLUESSEL_RUNDEN, 6, 3, 15));
  const [haerte, setHaerte] = useState(() => gemerkt(SCHLUESSEL_HAERTE, 1, 1, 3));
  const [stufe, setStufe] = useState<BotLevel>(gemerkteStufe);

  const tisch = useTable<PartykisteSicht>(tischId, 'partykiste');
  const sicht = tisch.view?.view ?? null;
  const sitze: SeatInfo[] = tisch.table?.seats ?? tisch.party?.seats ?? [];

  /* Wer ich bin, entscheidet in der Lobby über den Startknopf. */
  useEffect(() => {
    let lebt = true;
    void api
      .me()
      .then((m) => {
        if (lebt) setIch(m);
      })
      .catch(() => {
        /* Ohne Antwort bleibt der Startknopf beim ersten Sitz — drücken darf
           ihn ohnehin jeder Sitzende, der Server prüft es. */
      });
    return () => {
      lebt = false;
    };
  }, []);

  /* Die Tabelle blendet sich beim Rundenwechsel von selbst wieder weg. */
  useEffect(() => {
    setTafel(false);
  }, [sicht?.rundeNr]);

  /**
   * Online spielen: der offenen Runde beitreten, sonst eine aufmachen.
   *
   * Ohne `config`: Der Server nimmt dann `defaultConfig()` des Moduls. Eine
   * mitgeschickte Kopie des Regelsatzes überstimmte das Modul, ohne dass es
   * irgendwo auffiele (siehe CLAUDE.md, Tafelrunde).
   */
  const spieleOnline = useCallback(async (): Promise<void> => {
    setFehler(null);
    setLaedt(true);
    try {
      const liste = await api.tables('partykiste');
      const offen = liste.find(
        (zeile) => zeile.gameId === 'partykiste' && zeile.occupied < zeile.seats,
      );
      if (offen) {
        await api.joinTable(offen.id);
        setTischId(offen.id);
        return;
      }
      /*
       * Zwoelf Plaetze, die Obergrenze des Moduls — nicht acht. Der Tisch
       * schrumpft beim Start ohnehin auf die Anwesenden (`startNow`), ein
       * grosser Tisch kostet also nichts; ein zu kleiner sperrt die Leute
       * neun bis zwoelf aus, obwohl das Spiel sie traegt. Die 8 stand hier,
       * weil sie von Golf abgeschrieben war, wo acht wirklich das Ende ist.
       */
      const { id } = await api.createTable({
        gameId: 'partykiste',
        seats: 12,
        rounds: runden,
        visibility: 'public',
      });
      setTischId(id);
    } catch {
      setFehler('Die Runde ließ sich nicht öffnen. Noch einmal versuchen?');
    } finally {
      setLaedt(false);
    }
  }, [runden]);

  /**
   * Gegen Bots: eigener Tisch, `on_request` und sofort mit Bots gefüllt.
   *
   * Ein Bot-Tisch in der öffentlichen Liste fängt genau die Leute ab, die
   * gerade Menschen suchen — dieselbe Begründung wie bei Filler und Golf.
   */
  const spieleGegenBots = useCallback(async (): Promise<void> => {
    setFehler(null);
    setLaedt(true);
    try {
      const { id } = await api.createTable({
        gameId: 'partykiste',
        seats: 1 + bots,
        rounds: runden,
        visibility: 'on_request',
        fillWithBots: true,
        botLevel: stufe,
        /*
         * Hier MUSS ein vollstaendiger Regelsatz mit: Der Server prueft ihn
         * gegen `validateConfig`, und ein halber (nur der Haertegrad) faellt
         * dort als "kein Minispiel dabei" durch. Die Liste steht deshalb
         * ausgeschrieben da — sie ist dieselbe, die das Menue aufzaehlt.
         */
        config: {
          minispiele: Object.keys(MINISPIEL_NAME),
          trinkmodus: true,
          schluckFaktor: haerte,
        },
      });
      setTischId(id);
    } catch {
      setFehler('Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?');
    } finally {
      setLaedt(false);
    }
  }, [bots, runden, stufe, haerte]);

  const verlasseUndZurueck = useCallback((): void => {
    const id = tischId;
    setTischId(null);
    if (id) void api.leaveTable(id).catch(() => {});
    onBack();
  }, [tischId, onBack]);

  const sende = useCallback((aktion: PartyAktion): void => tisch.send(aktion), [tisch]);

  /* ------------------------------------------------------------------ */
  /* Menü                                                                */
  /* ------------------------------------------------------------------ */

  if (!tischId) {
    return (
      <main className="pk-seite pk-menue">
        <button className="pk-zurueck" type="button" onClick={onBack} aria-label="Zurück">
          ←
        </button>
        <div className="pk-menue-mitte">
          <h1 className="pk-titel">Partykiste</h1>
          <p className="pk-untertitel">
            Neun Minispiele, ein Turnier — für 4 bis 12 Leute, die im selben Raum
            sitzen. Wer verliert, trinkt; wer gewinnt, steht oben.
          </p>
          <ul className="pk-spielliste" aria-label="Enthaltene Minispiele">
            {(Object.keys(MINISPIEL_NAME) as (keyof typeof MINISPIEL_NAME)[]).map((id) => (
              <li key={id}>
                <strong>{MINISPIEL_NAME[id]}</strong>
                <span className="muted">{MINISPIEL_ANSAGE[id]}</span>
              </li>
            ))}
          </ul>
          {fehler ? <p className="pk-fehler">{fehler}</p> : null}
          <button
            className="pk-knopf is-haupt"
            type="button"
            data-pk-online=""
            onClick={() => void spieleOnline()}
            disabled={laedt}
          >
            Online spielen
          </button>
          <div className="pk-botblock">
            <button
              className="pk-knopf is-neben"
              type="button"
              data-pk-bots=""
              aria-expanded={botsOffen}
              onClick={() => setBotsOffen((an) => !an)}
            >
              Gegen Bots
            </button>
            {botsOffen ? (
              <div className="pk-regler">
                <Regler
                  titel="Bots"
                  wert={bots}
                  min={3}
                  max={11}
                  onWahl={(w) => {
                    setBots(w);
                    merke(SCHLUESSEL_BOTS, w);
                  }}
                />
                <Regler
                  titel="Runden"
                  wert={runden}
                  min={3}
                  max={15}
                  onWahl={(w) => {
                    setRunden(w);
                    merke(SCHLUESSEL_RUNDEN, w);
                  }}
                />
                <Regler
                  titel="Härte"
                  wert={haerte}
                  min={1}
                  max={3}
                  zusatz={HAERTE_NAME[haerte]}
                  onWahl={(w) => {
                    setHaerte(w);
                    merke(SCHLUESSEL_HAERTE, w);
                  }}
                />
                <div className="pk-stufen" role="group" aria-label="Spielstärke der Bots">
                  {STUFEN.map((s) => (
                    <button
                      key={s}
                      type="button"
                      data-an={stufe === s ? '' : undefined}
                      aria-pressed={stufe === s}
                      onClick={() => {
                        setStufe(s);
                        merke(SCHLUESSEL_STUFE, s);
                      }}
                    >
                      {STUFE_NAME[s]}
                    </button>
                  ))}
                </div>
                <button
                  className="pk-knopf is-haupt"
                  type="button"
                  data-pk-los=""
                  onClick={() => void spieleGegenBots()}
                  disabled={laedt}
                >
                  Los
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  if (!sicht) {
    return (
      <Lobby
        sitze={sitze}
        meineKennung={ich?.id ?? null}
        verbunden={tisch.connected}
        runden={tisch.table?.rounds ?? runden}
        onStart={() => tisch.startNow()}
        onZurueck={verlasseUndZurueck}
      />
    );
  }

  /* ------------------------------------------------------------------ */
  /* Turnier                                                             */
  /* ------------------------------------------------------------------ */

  if (sicht.fertig) {
    return (
      <main className="pk-seite pk-tisch">
        <header className="pk-kopf">
          <span className="pk-rundenzahl">Turnier vorbei</span>
        </header>
        <h2 className="pk-endtitel">Endstand</h2>
        <Tabelle sicht={sicht} sitze={sitze} />
        <div className="pk-wahl">
          <button className="pk-knopf is-haupt" type="button" onClick={verlasseUndZurueck}>
            Fertig
          </button>
        </div>
      </main>
    );
  }

  const binFertig = sicht.gehandelt.includes(sicht.sitz);

  return (
    <main className="pk-seite pk-tisch">
      <header className="pk-kopf">
        <button className="pk-zurueck is-klein" type="button" onClick={verlasseUndZurueck} aria-label="Verlassen">
          ←
        </button>
        <span className="pk-rundenzahl">
          Runde {sicht.rundeNr + 1}/{sicht.runden}
        </span>
        <strong className="pk-spielname">{MINISPIEL_NAME[sicht.art]}</strong>
        <button
          className="pk-tafelknopf"
          type="button"
          aria-pressed={tafel}
          onClick={() => setTafel((an) => !an)}
        >
          {tafel ? 'Zurück' : 'Stand'}
        </button>
      </header>

      {!tisch.connected ? (
        <p className="pk-fehler">Keine Verbindung — es wird neu aufgebaut …</p>
      ) : null}

      {tafel ? (
        <Tabelle sicht={sicht} sitze={sitze} />
      ) : (
        <>
          <p className="pk-ansage">{MINISPIEL_ANSAGE[sicht.art]}</p>
          <Runde sicht={sicht} sitze={sitze} sende={sende} />
          {sicht.phase === 'ergebnis' ? (
            <Abrechnung sicht={sicht} sitze={sitze} binFertig={binFertig} sende={sende} />
          ) : null}
        </>
      )}
    </main>
  );
}

/* --------------------------------------------------------------------------
 * Abrechnung einer Runde
 * ----------------------------------------------------------------------- */

/**
 * Was diese Runde gebracht hat — und der Weiter-Knopf.
 *
 * Er ist eine Abkürzung, keine Pflicht: Tippen ihn alle Anwesenden, geht es
 * sofort weiter; tippt ihn niemand, läuft die Schaupause des Moduls ab. Genau
 * deshalb steht hier keine eigene Uhr — eine zweite Frist im Client liefe der
 * echten davon.
 */
function Abrechnung({
  sicht,
  sitze,
  binFertig,
  sende,
}: {
  sicht: PartykisteSicht;
  sitze: SeatInfo[];
  binFertig: boolean;
  sende: (aktion: PartyAktion) => void;
}): React.JSX.Element {
  const punkte = sicht.rundenPunkte ?? [];
  const schlucke = sicht.rundenSchlucke ?? [];
  const meinePunkte = punkte[sicht.sitz] ?? 0;
  const meineSchlucke = schlucke[sicht.sitz] ?? 0;

  return (
    <div className="pk-abrechnung">
      <p className="pk-ausbeute">
        <span data-gut={meinePunkte > 0 ? '' : undefined}>
          {meinePunkte > 0 ? `+${meinePunkte} Punkte` : 'keine Punkte'}
        </span>
        {sicht.trinkmodus && meineSchlucke > 0 ? (
          <span className="pk-schluck">
            {meineSchlucke} {meineSchlucke === 1 ? 'Schluck' : 'Schlücke'} für dich
          </span>
        ) : null}
      </p>
      {sicht.trinkmodus ? (
        <ul className="pk-liste is-schmal">
          {schlucke.map((zahl, sitz) =>
            zahl > 0 && !sicht.ausgestiegen.includes(sitz) ? (
              <li key={sitz}>
                <span>{namenFuer(sitze, sitz)}</span>
                <span className="pk-schluck">{zahl} 🍺</span>
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      <div className="pk-wahl">
        <button
          type="button"
          className="pk-knopf is-haupt"
          disabled={binFertig}
          onClick={() => sende({ art: 'bereit' })}
        >
          {binFertig ? 'Warten auf die anderen …' : 'Weiter'}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Turniertabelle
 * ----------------------------------------------------------------------- */

function Tabelle({ sicht, sitze }: { sicht: PartykisteSicht; sitze: SeatInfo[] }): React.JSX.Element {
  const reihen = [...sicht.tabelle].sort((a, b) => a.platz - b.platz || a.sitz - b.sitz);
  return (
    <ol className="pk-tabelle">
      {reihen.map((zeile) => (
        <li
          key={zeile.sitz}
          data-ich={zeile.sitz === sicht.sitz ? '' : undefined}
          data-weg={sicht.ausgestiegen.includes(zeile.sitz) ? '' : undefined}
        >
          <span className="pk-platz">{zeile.platz}</span>
          <span className="pk-tabellenname">{namenFuer(sitze, zeile.sitz)}</span>
          {sicht.trinkmodus ? <span className="pk-schluck">{zeile.schlucke} 🍺</span> : null}
          <strong className="pk-punkte">{zeile.punkte}</strong>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------------------------------------------------------
 * Regler und Lobby
 * ----------------------------------------------------------------------- */

function Regler({
  titel,
  wert,
  min,
  max,
  zusatz,
  onWahl,
}: {
  titel: string;
  wert: number;
  min: number;
  max: number;
  zusatz?: string;
  onWahl: (wert: number) => void;
}): React.JSX.Element {
  return (
    <label className="pk-reglerzeile">
      <span className="pk-reglertitel">{titel}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={wert}
        onChange={(e) => onWahl(Number(e.target.value))}
      />
      <strong className="pk-reglerwert">{zusatz ?? wert}</strong>
    </label>
  );
}

function Lobby({
  sitze,
  meineKennung,
  verbunden,
  runden,
  onStart,
  onZurueck,
}: {
  sitze: readonly SeatInfo[];
  meineKennung: string | null;
  verbunden: boolean;
  runden: number;
  onStart: () => void;
  onZurueck: () => void;
}): React.JSX.Element {
  const anwesend = sitze.filter((s) => s.accountId !== null || s.isBot);
  const host = sitze[0] ?? null;
  /*
   * Host ist, wer auf Sitz 0 sitzt. Starten DARF laut Server jeder Sitzende —
   * der Knopf steht trotzdem nur bei einem, weil sonst zwei Leute gleichzeitig
   * starten und einer sich wundert.
   */
  const binHost = host !== null && meineKennung !== null && host.accountId === meineKennung;
  const genug = anwesend.length >= 4;

  return (
    <main className="pk-seite pk-menue">
      <button className="pk-zurueck" type="button" onClick={onZurueck} aria-label="Zurück">
        ←
      </button>
      <div className="pk-menue-mitte">
        <h1 className="pk-titel">Runde</h1>
        <p className="pk-untertitel">
          {anwesend.length} von {sitze.length} da · {runden} Minispiele
        </p>
        {!verbunden ? <p className="pk-fehler">Keine Verbindung — es wird neu aufgebaut …</p> : null}

        <ul className="pk-gruppe">
          {sitze.map((platz) => {
            const eigen = meineKennung !== null && platz.accountId === meineKennung;
            const leer = platz.accountId === null && !platz.isBot;
            return (
              <li
                key={platz.seat}
                data-pk-sitz={platz.seat}
                data-leer={leer ? '' : undefined}
                data-eigen={eigen ? '' : undefined}
              >
                <span className="pk-gruppenname">
                  {leer ? 'frei' : (platz.displayName ?? (platz.isBot ? 'Bot' : 'Spieler'))}
                </span>
                {eigen ? <em className="pk-du">du</em> : null}
              </li>
            );
          })}
        </ul>

        {sitze.some((platz) => platz.gast) ? (
          /* Vor dem Start, nicht erst an der Abrechnung: Ein Tisch mit Gast
             zaehlt fuer niemanden (countsForRanking) — wer das nicht will,
             geht jetzt, nicht nach sechs Runden. */
          <p className="pk-warten">Ein Gast spielt mit — diese Runde zählt nicht für die Rangliste.</p>
        ) : null}

        {binHost ? (
          <>
            <button
              className="pk-knopf is-haupt"
              type="button"
              data-pk-start=""
              onClick={onStart}
              disabled={!verbunden || !genug}
            >
              Starten
            </button>
            {!genug ? <p className="pk-warten">Ab vier Leuten geht es los.</p> : null}
          </>
        ) : (
          <p className="pk-warten" aria-live="polite">
            Warten, bis {host?.displayName ?? 'der Erste'} startet …
          </p>
        )}
      </div>
    </main>
  );
}
