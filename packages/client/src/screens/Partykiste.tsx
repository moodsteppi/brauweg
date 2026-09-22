import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, type Me } from '../api';
import { PartyAuswahl, usePartyAuswahl } from '../minispiele/partykiste/Auswahl';
import { Einstellungen, OffeneRunde, Regler, type Angebot } from '../minispiele/partykiste/Einstellungen';
import { LobbyRegelzeile, RegelsatzKontext, Regelzeile } from '../minispiele/partykiste/Regelzeile';
import { Runde } from '../minispiele/partykiste/Runden';
import {
  MINISPIEL_NAME,
  ansageFuer,
  liesRegelsatz,
  type PartyAktion,
  type PartyMinispiel,
  type PartyRegelsatz,
  type PartykisteSicht,
} from '../minispiele/partykiste/sicht';
import { binReihumDran, useTischwache } from '../minispiele/partykiste/useTischwache';
import { Abrechnung, Tabelle } from '../minispiele/partykiste/Wertung';
import { Beitrittscode } from '../minispiele/partykiste/Beitrittscode';
import { Einladung } from '../minispiele/partykiste/Einladung';
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
 * sonst ein anderes Spiel. Ausgeschaltet heißen sie Strafpunkte; gezählt wird
 * genauso (seit dem 22.09.2026 auch sichtbar, vorher blendete der Schalter die
 * Zahl nur aus).
 */

const SCHLUESSEL_RUNDEN = 'partykiste.runden';
const SCHLUESSEL_BOTS = 'partykiste.bots';
const SCHLUESSEL_STUFE = 'partykiste.botstufe';
const SCHLUESSEL_HAERTE = 'partykiste.haerte';
const SCHLUESSEL_TRINKMODUS = 'partykiste.trinkmodus';

const STUFEN: readonly BotLevel[] = ['anfaenger', 'standard', 'experte', 'genie'];
const STUFE_NAME: Record<BotLevel, string> = {
  anfaenger: 'Anfänger',
  standard: 'Normal',
  experte: 'Experte',
  genie: 'Profi',
};

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

/**
 * Trinkmodus aus dem Browser. Ohne Eintrag AN — das ist die Vorgabe des
 * Moduls (`DEFAULT_REGELN`), und wer den Schalter nie angefasst hat, soll
 * dasselbe Spiel bekommen wie bisher.
 */
function gemerkterTrinkmodus(): boolean {
  try {
    return localStorage.getItem(SCHLUESSEL_TRINKMODUS) !== '0';
  } catch {
    return true;
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
  const [trinkmodus, setTrinkmodus] = useState(gemerkterTrinkmodus);
  const [stufe, setStufe] = useState<BotLevel>(gemerkteStufe);
  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const [tischRegeln, setTischRegeln] = useState<PartyRegelsatz | null>(null);
  /* Minispiele, Inhalte, Themenpaket, Modus — minispiele/partykiste/Auswahl.tsx. */
  const auswahl = usePartyAuswahl(ich?.gast === true);

  const tisch = useTable<PartykisteSicht>(tischId, 'partykiste');
  const sicht = tisch.view?.view ?? null;
  const sitze: SeatInfo[] = tisch.table?.seats ?? tisch.party?.seats ?? [];

  /*
   * Schirm an, solange das Turnier laeuft; summen, wenn man in einem
   * reihum-Spiel neu dran ist. Der Schluessel ist die Rundennummer: Reihum
   * kommt jeder Sitz je Runde genau einmal dran, beim Bus auch fuer drei
   * Tipps am Stueck — gesummt wird zum ersten, nicht zu jedem.
   */
  useTischwache({
    aktiv: sicht !== null && !sicht.fertig,
    dranSchluessel: binReihumDran(sicht) && sicht ? `${sicht.rundeNr}` : null,
  });

  /*
   * Der Regelsatz, wie ihn dieses Menue einstellt — fuer beide Wege.
   *
   * Die Minispielliste hier ist nur noch Grundlage: Seit dem 22.09.2026
   * ersetzt `auswahl.regelsatz` sie durch die Wahl im Menue bzw. die
   * Vorgabe des Moduls (minispiele/partykiste/wahl.ts, `regelsatzAus`).
   */
  const regelsatz = useMemo<PartyRegelsatz>(
    () => ({
      minispiele: Object.keys(MINISPIEL_NAME) as PartyMinispiel[],
      trinkmodus,
      schluckFaktor: haerte,
    }),
    [trinkmodus, haerte],
  );

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

  /*
   * Im Wartesaal gibt es noch keine Sicht, also auch keinen Regelsatz aus der
   * Sicht — er kommt vom Server, festgeschrieben, wie ihn der Oeffner
   * eingestellt hat. NICHT das eigene Menue: Wer beigetreten ist, spielt mit
   * den Regeln des Tisches, nicht mit seinen Reglern von gestern.
   */
  useEffect(() => {
    if (!tischId || sicht) return;
    let lebt = true;
    void api
      .tableRules(tischId)
      .then((antwort) => {
        if (lebt) setTischRegeln(liesRegelsatz(antwort.config));
      })
      .catch(() => {
        /* Dann steht keine Regelzeile da — besser als eine geratene. */
      });
    return () => {
      lebt = false;
    };
  }, [tischId, sicht !== null]);

  /* Die Tabelle blendet sich beim Rundenwechsel von selbst wieder weg. */
  useEffect(() => {
    setTafel(false);
  }, [sicht?.rundeNr]);

  /**
   * Eine eigene Online-Runde aufmachen — MIT Regelsatz.
   *
   * Bis zum 22.09.2026 stand hier der Vorbehalt, ohne `config` zu schicken:
   * Eine mitgeschickte Kopie des Regelsatzes ueberstimmte das Modul, ohne dass
   * es irgendwo auffiele (CLAUDE.md, Tafelrunde). Der Vorbehalt galt einer
   * ABSCHRIFT — Zahlen, die niemand eingestellt hatte und die beim naechsten
   * Umbau des Moduls still veraltet waeren. `api.createTable` sagt selbst,
   * wann das Mitschicken richtig ist: "solange ein Bildschirm sie auch
   * wirklich einstellen laesst". Genau das tut das Menue jetzt fuer Haerte und
   * Trinkmodus, und Robins Entscheidung P6 vom selben Tag verlangt es: Der
   * Tischoeffner stellt ein, und es gilt auch online. Ohne `config` bekaeme
   * jeder Online-Tisch Trinkmodus an und Haerte 1, egal was eingestellt war.
   */
  const oeffneRunde = useCallback(async (): Promise<void> => {
    setFehler(null);
    setAngebot(null);
    setLaedt(true);
    try {
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
        config: await auswahl.regelsatz(regelsatz),
      });
      setTischId(id);
    } catch {
      setFehler('Die Runde ließ sich nicht öffnen. Noch einmal versuchen?');
    } finally {
      setLaedt(false);
    }
  }, [runden, regelsatz, auswahl.regelsatz]);

  /**
   * Online spielen: eine offene Runde suchen — und ZEIGEN, bevor man sitzt.
   *
   * Bis zum 22.09.2026 trat der Knopf der ersten offenen Runde sofort bei.
   * Solange jeder Tisch dieselben Regeln hatte, war das egal; seit der
   * Oeffner einstellt, saesse man sonst stumm an einem Trinktisch, obwohl man
   * gerade "alkoholfrei" gewaehlt hat (P6: jeder sieht den Regelsatz vor dem
   * Beitritt). `/tables/:id/rules` darf jeder Angemeldete lesen.
   */
  const spieleOnline = useCallback(async (): Promise<void> => {
    setFehler(null);
    setLaedt(true);
    try {
      const liste = await api.tables('partykiste');
      const offen = liste.find(
        (zeile) => zeile.gameId === 'partykiste' && zeile.occupied < zeile.seats,
      );
      if (!offen) {
        setLaedt(false);
        await oeffneRunde();
        return;
      }
      const regeln = await api
        .tableRules(offen.id)
        .then((antwort) => liesRegelsatz(antwort.config))
        .catch(() => null);
      setAngebot({ id: offen.id, host: offen.host, runden: offen.maxRounds, regeln });
    } catch {
      setFehler('Die Runde ließ sich nicht öffnen. Noch einmal versuchen?');
    } finally {
      setLaedt(false);
    }
  }, [oeffneRunde]);

  const trittBei = useCallback(async (id: string): Promise<void> => {
    setFehler(null);
    setLaedt(true);
    try {
      await api.joinTable(id);
      setAngebot(null);
      setTischId(id);
    } catch {
      setFehler('Die Runde ist inzwischen voll oder weg. Noch einmal suchen?');
      setAngebot(null);
    } finally {
      setLaedt(false);
    }
  }, []);

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
        /* Derselbe Regelsatz wie online — bis zum 22.09.2026 stand hier fest
           `trinkmodus: true`, weil es keinen Schalter gab. */
        config: await auswahl.regelsatz(regelsatz),
      });
      setTischId(id);
    } catch {
      setFehler('Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?');
    } finally {
      setLaedt(false);
    }
  }, [bots, runden, stufe, regelsatz, auswahl.regelsatz]);

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
            sitzen. {trinkmodus ? 'Wer verliert, trinkt' : 'Wer verliert, sammelt Strafpunkte'}; wer
            gewinnt, steht oben.
          </p>
          <Einstellungen
            runden={runden}
            haerte={haerte}
            trinkmodus={trinkmodus}
            onRunden={(w) => {
              setRunden(w);
              merke(SCHLUESSEL_RUNDEN, w);
            }}
            onHaerte={(w) => {
              setHaerte(w);
              merke(SCHLUESSEL_HAERTE, w);
            }}
            onTrinkmodus={(an) => {
              setTrinkmodus(an);
              merke(SCHLUESSEL_TRINKMODUS, an ? '1' : '0');
            }}
          />
          <PartyAuswahl
            vorgabe={auswahl.vorgabe}
            wahl={auswahl.wahl}
            gast={auswahl.gast}
            trinkmodus={trinkmodus}
            onWahl={auswahl.setWahl}
          />

          {fehler ? <p className="pk-fehler">{fehler}</p> : null}
          {angebot ? (
            <OffeneRunde
              angebot={angebot}
              laedt={laedt}
              onBeitreten={() => void trittBei(angebot.id)}
              onEigene={() => void oeffneRunde()}
              onAbbrechen={() => setAngebot(null)}
            />
          ) : (
            <button
              className="pk-knopf is-haupt"
              type="button"
              data-pk-online=""
              onClick={() => void spieleOnline()}
              disabled={laedt}
            >
              Online spielen
            </button>
          )}
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
          <Beitrittscode spiel="partykiste" onBeigetreten={setTischId} />
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  if (!sicht) {
    const lobbyRunden = tisch.table?.rounds ?? runden;
    return (
      <RegelsatzKontext.Provider value={{ regeln: tischRegeln, runden: lobbyRunden }}>
        <Lobby
          sitze={sitze}
          meineKennung={ich?.id ?? null}
          verbunden={tisch.connected}
          runden={lobbyRunden}
          onStart={() => tisch.startNow()}
          onZurueck={verlasseUndZurueck}
        />
      </RegelsatzKontext.Provider>
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
      {/* Die Sicht traegt den Regelsatz selbst — sie passt auf PartyRegelsatz. */}
      <Regelzeile regeln={sicht} />

      {!tisch.connected ? (
        <p className="pk-fehler">Keine Verbindung — es wird neu aufgebaut …</p>
      ) : null}

      {tafel ? (
        <Tabelle sicht={sicht} sitze={sitze} />
      ) : (
        <>
          <p className="pk-ansage">{ansageFuer(sicht.art, sicht.trinkmodus)}</p>
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
 * Lobby
 * ----------------------------------------------------------------------- */

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
        <LobbyRegelzeile />
        {!verbunden ? <p className="pk-fehler">Keine Verbindung — es wird neu aufgebaut …</p> : null}
        <Einladung spiel="partykiste" />

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
