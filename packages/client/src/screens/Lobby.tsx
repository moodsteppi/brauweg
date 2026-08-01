import { useEffect, useState } from 'react';

import { ApiError, api, type GameDefaults, type TableRow } from '../api';
import { t } from '../i18n';

/**
 * Lobby und Tischerstellung.
 *
 * Welche Spielerzahlen und Rundenzahlen zur Auswahl stehen, liefert der
 * Server aus dem Spielmodul. Der Client verdrahtet nichts davon fest.
 */
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
  const [fillWithBots, setFillWithBots] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = (): void => {
    void api.tables(gameId).then(setTables);
  };

  useEffect(() => {
    refresh();
    void api.defaults(gameId).then((d) => {
      setDefaults(d);
      setConfig(d.config);
      const first = d.rounds[String(seats)]?.[0];
      if (first) setRounds(first);
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
        fillWithBots,
      });
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

        <label className="row" style={{ gap: '0.5rem' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={fillWithBots}
            onChange={(e) => setFillWithBots(e.target.checked)}
          />
          Freie Plätze mit Bots füllen (zählt nicht für die Rangliste)
        </label>

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
 * Spiel oder eine neue Option braucht deshalb keine Aenderung hier. Die
 * Beschriftungen sind roh — das ist der Ort, an dem die Gestaltung anfaengt.
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

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}>
        {open ? 'Regeln zuklappen' : `Regeln anpassen (${flags.length} Optionen)`}
      </button>
      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          {flags.map(([key, value]) => (
            <label className="row" key={key} style={{ gap: '0.5rem' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={value as boolean}
                onChange={(e) => onChange({ ...config, [key]: e.target.checked })}
              />
              {key}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
