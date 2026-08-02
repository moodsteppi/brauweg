import { useEffect, useState } from 'react';

import { ApiError, api, type GameDefaults, type TableRow } from '../api';
import { t } from '../i18n';

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
}

const merkKey = (gameId: string): string => `tischEinstellungen.${gameId}`;

function gemerkteEinstellungen(gameId: string): Gemerkt | null {
  try {
    const raw = localStorage.getItem(merkKey(gameId));
    return raw ? (JSON.parse(raw) as Gemerkt) : null;
  } catch {
    return null;
  }
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
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setConfig(config);

      const seatWahl =
        merken?.seats !== undefined && d.seatCounts.includes(merken.seats)
          ? merken.seats
          : seats;
      setSeats(seatWahl);
      const runden = d.rounds[String(seatWahl)] ?? [];
      const rundenWahl =
        merken?.rounds !== undefined && runden.includes(merken.rounds)
          ? merken.rounds
          : runden[0];
      if (rundenWahl) setRounds(rundenWahl);
    });
    const handle = setInterval(refresh, 4000);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const roundOptions = defaults?.rounds[String(seats)] ?? [];

  const create = async (): Promise<void> => {
    setError(null);
    try {
      const table = await api.createTable({
        gameId,
        config: { ...config, tableSize: seats, rounds },
        seats,
        rounds,
      });
      // Erst nach dem Erfolg merken: Ein abgelehnter Regelsatz soll nicht
      // beim naechsten Besuch wieder vorgelegt werden.
      try {
        localStorage.setItem(merkKey(gameId), JSON.stringify({ seats, rounds, config }));
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

  return (
    <main>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Tische</h1>
        <button onClick={onBack}>Spielauswahl</button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        <h2>Neuer Tisch</h2>
        <div className="row">
          <label style={{ flex: 1 }}>
            Spieler
            <select
              value={seats}
              onChange={(e) => {
                const next = Number(e.target.value);
                setSeats(next);
                const first = defaults?.rounds[String(next)]?.[0];
                if (first) setRounds(first);
              }}
            >
              {(defaults?.seatCounts ?? [4]).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Runden
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
              {roundOptions.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="muted" style={{ margin: '0 0 0.75rem' }}>
          Bots fügst du am Tisch auf die freien Plätze — so könnt ihr auch zu
          zweit oder zu dritt mit Bots spielen. (Tische mit Bots zählen nicht für
          die Rangliste.)
        </p>

        <RuleEditor config={config} onChange={setConfig} />

        <button className="primary" onClick={() => void create()}>
          Tisch erstellen
        </button>
      </div>

      <h2>Offene Tische</h2>
      {tables.length === 0 && <p className="muted">Gerade ist kein Tisch offen.</p>}
      <table>
        <tbody>
          {tables.map((row) => (
            <tr key={row.id}>
              <td>
                {row.seats} Plätze · {row.maxRounds} Runden
              </td>
              <td className="muted">
                {row.occupied}/{row.seats} besetzt
              </td>
              <td style={{ textAlign: 'right' }}>
                <button onClick={() => void join(row.id)}>Beitreten</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

/**
 * Regelsatz-Editor.
 *
 * Er kennt die Optionen nicht: Er zeigt, was defaultConfig liefert. Ein neues
 * Spiel oder eine neue Option braucht deshalb keine Aenderung hier - nur einen
 * `regel.*`-Eintrag im Woerterbuch. Fehlt der, erscheint der rohe Schluessel:
 * sichtbar haesslich statt unsichtbar kaputt.
 *
 * Jede Regel ist eine Kachel, an/aus durch Antippen. Aktive Kacheln tragen
 * einen goldenen Rand mit Haken - der Zustand muss auf einen Blick lesbar
 * sein, nicht erst nach dem Suchen eines Kaestchens.
 */
function RuleEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown>) => void;
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (!config) return null;

  const flags = Object.entries(config).filter(([, value]) => typeof value === 'boolean');
  const active = flags.filter(([, value]) => value).length;

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <button type="button" onClick={() => setOpen(!open)}>
        {open ? 'Regeln zuklappen' : `Regeln anpassen (${active} von ${flags.length} an)`}
      </button>
      {open && (
        <div className="regeln">
          {flags.map(([key, value]) => (
            <button
              type="button"
              key={key}
              className={`regel${value ? ' is-on' : ''}`}
              aria-pressed={!!value}
              onClick={() => onChange({ ...config, [key]: !value })}
            >
              {t(`regel.${key}`)}
              <span className="regel-check" aria-hidden="true">
                ✓
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
