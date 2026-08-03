import { useEffect, useState } from 'react';

import { ApiError, api, type GameDefaults, type TableRow } from '../api';
import { t } from '../i18n';
import { regelBild } from '../regelbilder';

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
  const [visibility, setVisibility] = useState<'public' | 'club_only'>('public');
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);

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
      } else {
        // Ohne gemerkte Einstellungen startet der Tisch nackt: keine Regel an.
        // Wer Hausregeln will, schaltet sie bewusst ein - und ab dann sind sie
        // ja gemerkt.
        for (const [key, value] of Object.entries(config)) {
          if (typeof value === 'boolean') config[key] = false;
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
      if (merken?.visibility === 'club_only' || merken?.visibility === 'public') {
        setVisibility(merken.visibility);
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
      });
      // Erst nach dem Erfolg merken: Ein abgelehnter Regelsatz soll nicht
      // beim naechsten Besuch wieder vorgelegt werden.
      try {
        localStorage.setItem(
          merkKey(gameId),
          JSON.stringify({ seats, rounds, config, visibility }),
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
  const aktiveRegeln = flags.filter(([, value]) => value).length;

  return (
    <div className="doko doko--lobby">
      <header className="doko-top">
        <button className="doko-icon" onClick={onBack} aria-label="Zurück zur Spielauswahl">
          ‹
        </button>
        <div className="doko-top-mid">
          <strong>{t(`game.${gameId}`)}</strong>
          <span className="muted">Tisch erstellen oder beitreten</span>
        </div>
      </header>

      <div className="lobby-rolle">
        {error && <p className="error">{error}</p>}

        <section className="lobby-panel">
          <h2>Neuer Tisch</h2>
          <div className="lobby-wahl">
            <div className="lobby-gruppe">
              <span className="muted">Spieler</span>
              <div className="lobby-chips">
                {(defaults?.seatCounts ?? [4]).map((count) => (
                  <button
                    key={count}
                    className={`lobby-chip${seats === count ? ' is-an' : ''}`}
                    aria-pressed={seats === count}
                    onClick={() => {
                      setSeats(count);
                      const first = defaults?.rounds[String(count)]?.[0];
                      if (first) setRounds(first);
                    }}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <div className="lobby-gruppe">
              <span className="muted">Runden</span>
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
            </div>
            <div className="lobby-gruppe">
              <span className="muted">Für wen</span>
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
            </div>
          </div>

          {/* Eine Zeile statt eines aufgeklappten Formulars: Der Stand ist
              lesbar, die Kacheln kommen als Blatt von unten. */}
          <button className="lobby-regelzeile" onClick={() => setRegelnOffen(true)}>
            <span>
              <strong>Regeln:</strong> {aktiveRegeln} von {flags.length} an
              {aktiveRegeln === 0 ? ' — Grundspiel' : ''}
            </span>
            <span className="muted">ändern ›</span>
          </button>

          <button className="primary lobby-erstellen" onClick={() => void create()}>
            Tisch erstellen
          </button>
          <p className="muted lobby-fussnote">
            {visibility === 'club_only'
              ? 'Clantisch: bis 100 Runden, pausierbar, nur für Clanmitglieder — für alle Spiele.'
              : 'Bots setzt du am Tisch auf die freien Plätze — Tische mit Bots zählen nicht für die Rangliste.'}
          </p>
        </section>

        <h2 className="lobby-ueberschrift">Offene Tische</h2>
        {tables.length === 0 && <p className="muted">Gerade ist kein Tisch offen.</p>}
        {tables.map((row) => (
          <div className="lobby-tisch" key={row.id}>
            <span className="lobby-tischinfo">
              <strong>
                {row.seats} Plätze · {row.maxRounds} Runden
                {row.visibility === 'club_only' ? ' · Clan' : ''}
              </strong>
              <span className="muted">
                {row.occupied} von {row.seats} besetzt
              </span>
            </span>
            {/* Ein Punkt je Platz: voll oder frei, auf einen Blick. */}
            <span className="lobby-punkte" aria-hidden="true">
              {Array.from({ length: row.seats }, (_, i) => (
                <i key={i} className={i < row.occupied ? '' : 'is-frei'} />
              ))}
            </span>
            <button className="doko-seat-btn" onClick={() => void join(row.id)}>
              Beitreten
            </button>
          </div>
        ))}
      </div>

      {regelnOffen && config && (
        <RegelSheet config={config} onChange={setConfig} onClose={() => setRegelnOffen(false)} />
      )}
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
  config,
  onChange,
  onClose,
}: {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onClose: () => void;
}): React.JSX.Element {
  const flags = Object.entries(config).filter(([, value]) => typeof value === 'boolean');
  const active = flags.filter(([, value]) => value).length;

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card" onClick={(event) => event.stopPropagation()}>
        <h2>Regeln für diesen Tisch</h2>
        <p className="muted">
          {active} von {flags.length} an · Antippen schaltet um
        </p>
        <div className="regeln">
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
