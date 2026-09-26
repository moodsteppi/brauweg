import { useEffect, useState } from 'react';

import { ApiError, api, type GameDefaults, type TableRow } from '../api';
import { t } from '../i18n';
import type { BotLevel } from '../protocol';
import { regelBild } from '../regelbilder';
import { hubNeu } from '../hubNeu';
import { HbBlatt } from './HbBlatt';
import { SpielAbschnitt, SpielRahmen, SpielWahl } from './SpielEinstieg';

/**
 * Lobby und Tischerstellung.
 *
 * Welche Spielerzahlen und Rundenzahlen zur Auswahl stehen, liefert der
 * Server aus dem Spielmodul. Der Client verdrahtet nichts davon fest.
 *
 * Die Einstellungen des zuletzt erstellten Tisches werden am Geraet gemerkt
 * und beim naechsten Mal vorgelegt: Wer immer mit denselben Hausregeln
 * spielt, soll sie nicht jedes Mal neu zusammenklicken.
 */

interface Gemerkt {
  seats?: number;
  rounds?: number;
  config?: Record<string, unknown>;
  visibility?: 'public' | 'club_only';
  botLevel?: BotLevel;
}

/**
 * Die drei Bot-Spielstärken mit einem Satz, was sie ausmacht. Nur beim
 * Doppelkopf angeboten — nur dort wertet das Modul die Stufe aus.
 */
// Anfänger ist bewusst nicht wählbar: zu schwach für einen ernsten Tisch. Die
// Stufe bleibt im Modul erhalten, wird hier aber nicht angeboten — so bleiben
// es drei Chips in einer Reihe.
const BOT_STUFEN: readonly { id: BotLevel; name: string }[] = [
  { id: 'standard', name: 'Standard' },
  { id: 'experte', name: 'Experte' },
  { id: 'genie', name: 'Genie' },
];

/**
 * Der Zaehler am Schluessel verwirft alte Staende.
 *
 * Version 1 hat beim ersten Tisch jede Boolesche Regel auf aus gesetzt und
 * das dann gemerkt — auch Hochzeit und Armut. Diese Werte hat nie jemand
 * gewaehlt, sie waren ein Fehler. Sie zu behalten hiesse, ihn jedem
 * bestehenden Konto dauerhaft mitzugeben.
 */
const merkKey = (gameId: string): string => `tischEinstellungen2.${gameId}`;

function gemerkteEinstellungen(gameId: string): Gemerkt | null {
  try {
    const raw = localStorage.getItem(merkKey(gameId));
    return raw ? (JSON.parse(raw) as Gemerkt) : null;
  } catch {
    return null;
  }
}
/**
 * Der Satz unter dem Erstellen-Knopf.
 *
 * Er stand einmal fest verdrahtet da und erzählte auch am Skattisch vom
 * „Bot als Vierter" — ein Satz aus dem Doppelkopf. Skat IST ein Dreierspiel;
 * dort ist der Dreiertisch der Normalfall und kein Behelf. Deshalb hängt der
 * Text jetzt am Spiel und nicht allein an der Platzzahl.
 */
function fussnote(gameId: string, seats: number, visibility: 'public' | 'club_only'): string {
  if (visibility === 'club_only') {
    return 'Clantisch: bis 100 Runden, pausierbar, nur für Clanmitglieder.';
  }
  if (gameId === 'skat') {
    return 'Skat wird zu dritt gespielt. Freie Plätze füllst du am Tisch mit Bots — dann zählt der Tisch nicht für die Rangliste.';
  }
  if (seats === 3) {
    return 'Am Dreiertisch spielt immer ein Bot als Vierter mit. Der Tisch zählt trotzdem für die Rangliste.';
  }
  return 'Freie Plätze füllst du am Tisch mit Bots. Dann zählt der Tisch nicht für die Rangliste.';
}

export function Lobby({
  gameId,
  onEnter,
  onBack,
}: {
  gameId: string;
  onEnter: (tableId: string) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [defaults, setDefaults] = useState<GameDefaults | null>(null);
  const [seats, setSeats] = useState(4);
  const [rounds, setRounds] = useState(8);
  const [visibility, setVisibility] = useState<'public' | 'club_only'>('public');
  const [botLevel, setBotLevel] = useState<BotLevel>('standard');
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);
  /** Tischauswahl oder Tisch erstellen — zwei Bildschirme, kein Langformular. */
  const [ansicht, setAnsicht] = useState<'liste' | 'erstellen'>('liste');
  /**
   * Filter als Zeichenkette, weil die Sitz-Filter aus dem Spielmodul kommen:
   * Doppelkopf hat drei bis fünf Plätze, Zauberer drei bis sechs. Fest
   * verdrahtete Knöpfe müssten bei jedem neuen Spiel nachgezogen werden.
   */
  const [filter, setFilter] = useState<string>('alle');
  const [suche, setSuche] = useState('');

  const refresh = (): void => {
    void api.tables(gameId).then(setTables);
  };

  useEffect(() => {
    refresh();
    void api.defaults(gameId).then((d) => {
      setDefaults(d);

      // Gemerktes ueber die Vorgaben legen - aber nur Schluessel, die es noch
      // gibt, mit unveraendertem Typ. So uebersteht der Speicher Regelsatz-
      // Aenderungen, statt einen kaputten Tisch zu bauen.
      const merken = gemerkteEinstellungen(gameId);
      const config = { ...d.config };
      if (merken?.config) {
        for (const [key, value] of Object.entries(merken.config)) {
          if (key in config && typeof value === typeof config[key]) config[key] = value;
        }
      }
      // Ohne gemerkte Einstellungen gilt die Vorgabe des Spielmoduls, also
      // `d.config` unveraendert.
      //
      // Frueher wurde hier jede Boolesche Regel auf false gesetzt - "der Tisch
      // startet nackt". Das hat aber nicht nur Hausregeln abgeschaltet,
      // sondern auch Hochzeit und Armut: Wer zwei Kreuz-Damen hielt, bekam
      // keine Hochzeit angeboten. Das ist kein nackter Tisch mehr, das ist
      // kein Doppelkopf. Was aus ist, sagt der Regelsatz des Moduls - dort
      // stehen Schmeissen und die Sonderpunkte schon auf aus.
      setConfig(config);

      // Ohne gemerkte Wahl bleibt der Anfangswert (4) nur stehen, wenn das
      // Spiel ihn kennt. Skat hat 3 Sitze; sonst scheitert der erste Tisch.
      const seatWahl =
        merken?.seats !== undefined && d.seatCounts.includes(merken.seats)
          ? merken.seats
          : d.seatCounts.includes(seats)
            ? seats
            : d.seatCounts[0];
      setSeats(seatWahl);
      const runden = d.rounds[String(seatWahl)] ?? [];
      const rundenWahl =
        merken?.rounds !== undefined && runden.includes(merken.rounds)
          ? merken.rounds
          : runden[0];
      if (rundenWahl) setRounds(rundenWahl);
      if (merken?.visibility === 'club_only' || merken?.visibility === 'public') {
        setVisibility(merken.visibility);
      }
      if (
        merken?.botLevel === 'standard' ||
        merken?.botLevel === 'experte' ||
        merken?.botLevel === 'genie'
      ) {
        setBotLevel(merken.botLevel);
      }
    });
    const handle = setInterval(refresh, 4000);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const baseRounds = defaults?.rounds[String(seats)] ?? [];
  // Clantische dürfen bis 100 Runden — die kurze Liste vom Modul um die
  // lange Partie ergänzen, sofern die Geberrotation aufgeht.
  const roundOptions =
    visibility === 'club_only' && !baseRounds.includes(100)
      ? [...baseRounds, 100]
      : baseRounds;

  const create = async (): Promise<void> => {
    setError(null);
    try {
      const table = await api.createTable({
        gameId,
        config: { ...config, tableSize: seats, rounds },
        seats,
        rounds,
        visibility,
        // Bot-Stärke gilt für alle Bots des Tisches. Welche Module sie
        // auswerten, steht bei `BotLevel` in game-api und wird hier bewusst
        // nicht zweitgezählt: Mitschicken schadet keinem Spiel, ein Modul
        // ohne Auswertung ignoriert das Feld.
        botLevel,
      });
      // Erst nach dem Erfolg merken: Ein abgelehnter Regelsatz soll nicht
      // beim naechsten Besuch wieder vorgelegt werden.
      try {
        localStorage.setItem(
          merkKey(gameId),
          JSON.stringify({ seats, rounds, config, visibility, botLevel }),
        );
      } catch {
        // Voller oder gesperrter Speicher ist kein Grund, den Tisch zu verweigern.
      }
      onEnter(table.id);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
    }
  };

  const join = async (id: string): Promise<void> => {
    setError(null);
    try {
      await api.joinTable(id);
      onEnter(id);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
    }
  };

  const flags = config
    ? Object.entries(config).filter(([, value]) => typeof value === 'boolean')
    : [];
  /**
   * Gezaehlt werden Abweichungen von der Vorgabe, nicht eingeschaltete
   * Regeln. Die Vorgabe hat selbst ein Dutzend Regeln an; "12 Sonderregeln"
   * unter jedem Tisch sagt nichts. Interessant ist, was jemand bewusst
   * anders eingestellt hat — egal ob an oder aus.
   */
  const aktiveRegeln =
    defaults && config
      ? flags.filter(
          ([key, value]) => (defaults.config as Record<string, unknown>)[key] !== value,
        ).length +
        // Die Blattwahl (Scharfer Doppelkopf) zaehlt wie jede andere Abweichung.
        (config.deck !== undefined &&
        config.deck !== (defaults.config as Record<string, unknown>).deck
          ? 1
          : 0)
      : 0;

  // Filter und Suche laufen auf der geladenen Liste: Sie ist kurz, und so
  // reagiert die Auswahl ohne Rueckfrage beim Server.
  const sitzFilter = /^(\d+)er$/.exec(filter);
  const gefiltert = tables.filter((row) => {
    if (sitzFilter && row.seats !== Number(sitzFilter[1])) return false;
    if (filter === 'offen' && row.occupied >= row.seats) return false;
    if (filter === 'clan' && row.visibility !== 'club_only') return false;
    const s = suche.trim().toLowerCase();
    if (s.length > 0 && !(row.host ?? '').toLowerCase().includes(s)) return false;
    return true;
  });

  // Neues Hub: dieselben Zustände und Aufrufe im Spieleinstieg-Baukasten.
  if (hubNeu) {
    const name = t(`game.${gameId}`);
    const sitze = defaults?.seatCounts ?? [4];
    const sitzText = sitze.length > 1 ? `${sitze[0]}–${sitze[sitze.length - 1]}` : `${sitze[0]}`;
    if (ansicht === 'erstellen') {
      return (
        <SpielRahmen
          gameId={gameId}
          titel="Tisch erstellen"
          unter={`${name} · ${sitzText} Spieler`}
          onBack={() => setAnsicht('liste')}
          zurueckText="Zurück zur Tischauswahl"
          fuss={
            <>
              <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => void create()}>
                Tisch erstellen
              </button>
              <p className="hb-klein">{fussnote(gameId, seats, visibility)}</p>
            </>
          }
        >
          {error && <p className="hb-fehler">{error}</p>}
          <SpielAbschnitt titel="Spieler">
            <SpielWahl
              name="Spieler"
              werte={sitze.map((c) => ({ wert: c, text: `${c} Spieler` }))}
              wert={seats}
              onWahl={(count) => {
                setSeats(count);
                const first = defaults?.rounds[String(count)]?.[0];
                if (first) setRounds(first);
              }}
            />
          </SpielAbschnitt>
          <SpielAbschnitt titel="Runden">
            <SpielWahl name="Runden" werte={roundOptions.map((c) => ({ wert: c, text: String(c) }))} wert={rounds} onWahl={setRounds} />
          </SpielAbschnitt>
          <SpielAbschnitt titel="Für wen">
            <SpielWahl
              name="Für wen"
              werte={[
                { wert: 'public' as const, text: 'Offen', unter: 'für alle' },
                { wert: 'club_only' as const, text: 'Nur Clan', unter: 'bis 100 Runden' },
              ]}
              wert={visibility}
              onWahl={(v) => {
                setVisibility(v);
                if (v === 'public' && rounds > 20) {
                  const first = defaults?.rounds[String(seats)]?.[0];
                  if (first) setRounds(first);
                }
              }}
            />
          </SpielAbschnitt>
          {gameId === 'doppelkopf' && (
            <SpielAbschnitt titel="Bot-Stärke">
              <SpielWahl name="Bot-Stärke" werte={BOT_STUFEN.map((b) => ({ wert: b.id, text: b.name }))} wert={botLevel} onWahl={setBotLevel} />
            </SpielAbschnitt>
          )}
          <SpielAbschnitt titel="Regeln">
            <div className="hb-liste">
              <button type="button" className="spe-zeile" onClick={() => setRegelnOffen(true)}>
                <span>
                  <strong>{aktiveRegeln === 0 ? 'Standard' : `${aktiveRegeln} Sonderregeln`}</strong>
                  <small>Antippen zum Einstellen</small>
                </span>
                <span className="hb-pf" aria-hidden="true">
                  ›
                </span>
              </button>
            </div>
          </SpielAbschnitt>
          {regelnOffen && config && <RegelSheet neu config={config} onChange={setConfig} onClose={() => setRegelnOffen(false)} />}
        </SpielRahmen>
      );
    }
    const filterWerte: [string, string][] = [
      ['alle', 'Alle'],
      ...sitze.map((c) => [`${c}er`, `${c}er`] as [string, string]),
      ['offen', 'Offen'],
      ['clan', 'Clan'],
    ];
    return (
      <SpielRahmen
        gameId={gameId}
        titel={name}
        unter={`${sitzText} Spieler · Tischauswahl`}
        onBack={onBack}
        zurueckText="Zurück zur Spielseite"
        fuss={
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => setAnsicht('erstellen')}>
            Tisch erstellen
          </button>
        }
      >
        {error && <p className="hb-fehler">{error}</p>}
        <div className="hb-chips spe-chips" role="group" aria-label="Filter">
          {filterWerte.map(([wert, text]) => (
            <button
              type="button"
              key={wert}
              className={`hb-chip${filter === wert ? ' is-an' : ''}`}
              aria-pressed={filter === wert}
              onClick={() => setFilter(wert)}
            >
              {text}
            </button>
          ))}
        </div>
        <input
          className="spe-feld"
          placeholder="Spieler suchen…"
          value={suche}
          onChange={(event) => setSuche(event.target.value)}
          aria-label="Tisch nach Gastgeber suchen"
        />
        <SpielAbschnitt titel="Offene Tische" zusatz={tables.length > 0 ? `${gefiltert.length} von ${tables.length}` : undefined}>
          <div className="hb-liste">
            {gefiltert.length === 0 && (
              <p className="spe-leer">
                {tables.length === 0 ? 'Gerade ist kein Tisch offen. Mach den ersten auf.' : 'Kein Tisch passt zu diesem Filter.'}
              </p>
            )}
            {gefiltert.map((row) => (
              <button type="button" className="spe-zeile spe-tisch" key={row.id} onClick={() => void join(row.id)}>
                <span>
                  <strong>
                    {row.host ? `Runde von ${row.host}` : 'Offener Tisch'}
                    {row.visibility === 'club_only' && <span className="spe-marke"> · Clan</span>}
                  </strong>
                  <small>
                    {row.seats}er · {row.maxRounds} Runden · {row.ruleCount === 0 ? 'Standard' : `${row.ruleCount} Sonderregeln`}
                  </small>
                </span>
                <span className="spe-punkte" aria-hidden="true">
                  {Array.from({ length: row.seats }, (_, i) => (
                    <i key={i} className={i < row.occupied ? '' : 'is-frei'} />
                  ))}
                </span>
                <span className="spe-zahl" aria-label={`${row.occupied} von ${row.seats} Plätzen besetzt`}>
                  {row.occupied}/{row.seats}
                </span>
              </button>
            ))}
          </div>
        </SpielAbschnitt>
      </SpielRahmen>
    );
  }

  if (ansicht === 'erstellen') {
    return (
      <div className="doko doko--lobby doko--erstellen">
        <img className="doko-bg" src="/hub/bg-tisch-erstellen.png" alt="" draggable={false} />
        <header className="doko-top">
          <button
            className="doko-icon"
            onClick={() => setAnsicht('liste')}
            aria-label="Zurück zur Tischauswahl"
          >
            ‹
          </button>
          <h1 className="lobby-schild">Tisch erstellen</h1>
          <span className="doko-icon is-leer" aria-hidden="true" />
        </header>

        <div className="lobby-rolle">
          {error && <p className="error">{error}</p>}

          <section className="lobby-tafel">
            <h2 className="lobby-tafel-titel">Spieler</h2>
            <div className="lobby-gross">
              {(defaults?.seatCounts ?? [4]).map((count) => (
                <button
                  key={count}
                  className={`lobby-grossknopf${seats === count ? ' is-an' : ''}`}
                  aria-pressed={seats === count}
                  onClick={() => {
                    setSeats(count);
                    const first = defaults?.rounds[String(count)]?.[0];
                    if (first) setRounds(first);
                  }}
                >
                  {count} Spieler
                </button>
              ))}
            </div>

            <h2 className="lobby-tafel-titel">Runden</h2>
            <div className="lobby-chips">
              {roundOptions.map((count) => (
                <button
                  key={count}
                  className={`lobby-chip${rounds === count ? ' is-an' : ''}`}
                  aria-pressed={rounds === count}
                  onClick={() => setRounds(count)}
                >
                  {count}
                </button>
              ))}
            </div>

            <h2 className="lobby-tafel-titel">Für wen</h2>
            <div className="lobby-chips">
              <button
                className={`lobby-chip${visibility === 'public' ? ' is-an' : ''}`}
                aria-pressed={visibility === 'public'}
                onClick={() => {
                  setVisibility('public');
                  if (rounds > 20) {
                    const first = defaults?.rounds[String(seats)]?.[0];
                    if (first) setRounds(first);
                  }
                }}
              >
                Offen
              </button>
              <button
                className={`lobby-chip${visibility === 'club_only' ? ' is-an' : ''}`}
                aria-pressed={visibility === 'club_only'}
                onClick={() => setVisibility('club_only')}
              >
                Nur Clan
              </button>
            </div>

            {/* Bot-Stärke nur beim Doppelkopf: nur dort spielen die Stufen
                wirklich unterschiedlich. Gehört hierher, wo der Tisch gebaut
                wird — wie Runden und „Für wen", einmal gewählt und fest. */}
            {gameId === 'doppelkopf' && (
              <>
                <h2 className="lobby-tafel-titel">Bot-Stärke</h2>
                <div className="lobby-chips">
                  {BOT_STUFEN.map((stufe) => (
                    <button
                      key={stufe.id}
                      className={`lobby-chip${botLevel === stufe.id ? ' is-an' : ''}`}
                      aria-pressed={botLevel === stufe.id}
                      onClick={() => setBotLevel(stufe.id)}
                    >
                      {stufe.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <h2 className="lobby-tafel-titel">Regeln</h2>
            {/* Eine Zeile statt eines aufgeklappten Formulars: Der Stand ist
                lesbar, die Kacheln kommen als Blatt von unten. */}
            <button className="lobby-regelzeile" onClick={() => setRegelnOffen(true)}>
              <span>{aktiveRegeln === 0 ? 'Standard' : `${aktiveRegeln} Sonderregeln`}</span>
              <span aria-hidden="true">›</span>
            </button>

            <button className="lobby-erstellen" onClick={() => void create()}>
              Tisch erstellen
            </button>
            <p className="muted lobby-fussnote">{fussnote(gameId, seats, visibility)}</p>
          </section>
        </div>

        {regelnOffen && config && (
          <RegelSheet config={config} onChange={setConfig} onClose={() => setRegelnOffen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="doko doko--lobby">
      <img className="doko-bg" src="/hub/bg-tischauswahl.png" alt="" draggable={false} />
      <header className="doko-top">
        <button className="doko-icon" onClick={onBack} aria-label="Zurück zur Spielauswahl">
          ‹
        </button>
        <h1 className="lobby-schild">Tischauswahl</h1>
        <span className="doko-icon is-leer" aria-hidden="true" />
      </header>

      <div className="lobby-filter">
        {/* Die Sitz-Filter liefert das Spielmodul über `defaults.seatCounts` —
            fest verdrahtet wären sie beim zweiten Spiel schon falsch. */}
        {[
          ['alle', 'Alle'] as [string, string],
          ...(defaults?.seatCounts ?? []).map(
            (count) => [`${count}er`, `${count}er`] as [string, string],
          ),
          ['offen', 'Offen'] as [string, string],
          ['clan', 'Clan'] as [string, string],
        ].map(([wert, text]) => (
          <button
            key={wert}
            className={`lobby-filterchip${filter === wert ? ' is-an' : ''}`}
            aria-pressed={filter === wert}
            onClick={() => setFilter(wert)}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="lobby-suchzeile">
        <input
          className="lobby-suche"
          placeholder="Spieler suchen…"
          value={suche}
          onChange={(event) => setSuche(event.target.value)}
          aria-label="Tisch nach Gastgeber suchen"
        />
      </div>

      <div className="lobby-rolle kachelraster">
        {error && <p className="error">{error}</p>}

        {gefiltert.length === 0 && (
          <p className="muted lobby-leer">
            {tables.length === 0
              ? 'Gerade ist kein Tisch offen. Mach den ersten auf.'
              : 'Kein Tisch passt zu diesem Filter.'}
          </p>
        )}

        {gefiltert.map((row) => (
          <button className="lobby-tisch" key={row.id} onClick={() => void join(row.id)}>
            <span className="lobby-tischinfo">
              <strong>
                {row.host ? `Runde von ${row.host}` : 'Offener Tisch'}
                {row.visibility === 'club_only' && (
                  <span className="lobby-schloss" aria-label="Clantisch">
                    🔒
                  </span>
                )}
              </strong>
              <span className="muted">
                {row.seats}er · {row.maxRounds} Runden ·{' '}
                {row.ruleCount === 0 ? 'Standard' : `${row.ruleCount} Sonderregeln`}
              </span>
            </span>
            {/* Ein Punkt je Platz: voll oder frei, auf einen Blick. */}
            <span className="lobby-punkte" aria-hidden="true">
              {Array.from({ length: row.seats }, (_, i) => (
                <i key={i} className={i < row.occupied ? '' : 'is-frei'} />
              ))}
            </span>
            <span className="lobby-zahl">
              {row.occupied}/{row.seats}
            </span>
            <span className="lobby-pfeil" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>

      <div className="lobby-fuss">
        <button className="lobby-erstellen" onClick={() => setAnsicht('erstellen')}>
          Tisch erstellen
        </button>
      </div>
    </div>
  );
}

/**
 * Regelsatz-Editor als Blatt von unten.
 *
 * Er kennt die Optionen nicht: Er zeigt, was defaultConfig liefert. Ein neues
 * Spiel oder eine neue Option braucht deshalb keine Aenderung hier - nur einen
 * `regel.*`-Eintrag im Woerterbuch und ein Bild in regelbilder.ts. Fehlt
 * beides, erscheinen roher Schluessel und Ersatzbild: sichtbar haesslich
 * statt unsichtbar kaputt.
 *
 * Jede Regel ist eine Kachel mit Bild, an/aus durch Antippen. Aktive Kacheln
 * tragen einen goldenen Rand mit Haken.
 */
function RegelSheet({
  neu = false,
  config,
  onChange,
  onClose,
}: {
  /** Neues Hub: als Blatt im neuen Stil, dieselben Kacheln. */
  neu?: boolean;
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onClose: () => void;
}): React.JSX.Element {
  const flags = Object.entries(config).filter(([, value]) => typeof value === 'boolean');

  // Scharfer Doppelkopf ist keine Ja/Nein-Regel im Regelsatz, sondern die
  // Blattwahl (deck: without9 = ohne Neunen, 40 Karten). Als Kachel fuehlt
  // sie sich trotzdem wie ein Schalter an - also steht sie hier vorneweg.
  const hatBlattwahl = typeof config.deck === 'string';
  const scharf = config.deck === 'without9';
  const active = flags.filter(([, value]) => value).length + (scharf ? 1 : 0);
  const gesamt = flags.length + (hatBlattwahl ? 1 : 0);

  const kacheln = (
    <div className="regeln">
      {hatBlattwahl && (
        <button
          type="button"
          className={`regel${scharf ? ' is-on' : ''}`}
          aria-pressed={scharf}
          onClick={() => onChange({ ...config, deck: scharf ? 'with9' : 'without9' })}
        >
          <span className="regel-bild" aria-hidden="true">
            {regelBild('scharf')}
          </span>
          {t('regel.scharf')}
          <span className="regel-check" aria-hidden="true">
            ✓
          </span>
        </button>
      )}
      {flags.map(([key, value]) => (
        <button
          type="button"
          key={key}
          className={`regel${value ? ' is-on' : ''}`}
          aria-pressed={!!value}
          onClick={() => onChange({ ...config, [key]: !value })}
        >
          <span className="regel-bild" aria-hidden="true">
            {regelBild(key)}
          </span>
          {t(`regel.${key}`)}
          <span className="regel-check" aria-hidden="true">
            ✓
          </span>
        </button>
      ))}
    </div>
  );
  if (neu) {
    return (
      <HbBlatt titel="Regeln" label="Regeln für diesen Tisch" onClose={onClose}>
        <p className="hb-klein">
          {active} von {gesamt} an · Antippen schaltet um
        </p>
        {kacheln}
        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onClose}>
          Fertig
        </button>
      </HbBlatt>
    );
  }

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card" onClick={(event) => event.stopPropagation()}>
        <h2>Regeln für diesen Tisch</h2>
        <p className="muted">
          {active} von {gesamt} an · Antippen schaltet um
        </p>
        <div className="regeln">
          {hatBlattwahl && (
            <button
              type="button"
              className={`regel${scharf ? ' is-on' : ''}`}
              aria-pressed={scharf}
              onClick={() => onChange({ ...config, deck: scharf ? 'with9' : 'without9' })}
            >
              <span className="regel-bild" aria-hidden="true">
                {regelBild('scharf')}
              </span>
              {t('regel.scharf')}
              <span className="regel-check" aria-hidden="true">
                ✓
              </span>
            </button>
          )}
          {flags.map(([key, value]) => (
            <button
              type="button"
              key={key}
              className={`regel${value ? ' is-on' : ''}`}
              aria-pressed={!!value}
              onClick={() => onChange({ ...config, [key]: !value })}
            >
              <span className="regel-bild" aria-hidden="true">
                {regelBild(key)}
              </span>
              {t(`regel.${key}`)}
              <span className="regel-check" aria-hidden="true">
                ✓
              </span>
            </button>
          ))}
        </div>
        <button className="primary" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  );
}
