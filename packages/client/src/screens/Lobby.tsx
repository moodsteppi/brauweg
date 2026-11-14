import { useEffect, useState } from 'react';

import { ApiError, api, type GameDefaults, type TableRow } from '../api';
import { t } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import type { BotLevel } from '../protocol';
import { regelBild } from '../regelbilder';
import { HbBlatt } from './HbBlatt';
import { SpielAbschnitt, SpielRahmen, SpielWahl } from './SpielEinstieg';
import { AnfrageWarten } from '../tisch/Anfragen';
import { ARTNAME, VORGABE_ZEIT, regelnFuer, zeitText, zeitkontrolle } from '../minispiele/brochess/zeit';
import { ArtZeichen, ZeitWahlBlatt } from '../minispiele/brochess/ZeitWahl';
import { useSpezialModi } from '../minispiele/brochess/SpezialModi';

/**
 * Gemerkte Zeitkontrolle fuer BroChess. Eigener Schluessel statt im
 * gemerkten Regelsatz: Der Regelsatz uebernimmt nur Felder, die die
 * Vorgabe des Moduls kennt, und die Vorgabe hat keine Uhr — sonst bekaeme
 * jeder alte Tisch eine.
 */
const ZEIT_KEY = 'brochess.zeit';

function gemerkteZeit(): string {
  try {
    return localStorage.getItem(ZEIT_KEY) ?? VORGABE_ZEIT;
  } catch {
    return VORGABE_ZEIT;
  }
}

function merkeZeit(id: string): void {
  try {
    localStorage.setItem(ZEIT_KEY, id);
  } catch {
    // Gesperrter Speicher: dann eben beim naechsten Mal wieder die Vorgabe.
  }
}

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
  visibility?: Sichtbarkeit;
  botLevel?: BotLevel;
}

/**
 * Die drei Bot-Spielstärken mit einem Satz, was sie ausmacht. Nur beim
 * Doppelkopf angeboten — nur dort wertet das Modul die Stufe aus.
 */
// Anfänger ist bewusst nicht wählbar: zu schwach für einen ernsten Tisch. Die
// Stufe bleibt im Modul erhalten, wird hier aber nicht angeboten — so bleiben
// es drei Chips in einer Reihe.
// Schlüssel statt Text, auch in SCHACH_STUFEN: t() muss beim Zeichnen
// laufen, sonst bliebe die Sprache vom Laden des Moduls stehen.
const BOT_STUFEN: readonly { id: BotLevel; name: string }[] = [
  { id: 'standard', name: 'lobby.stufe.standard' },
  { id: 'experte', name: 'lobby.stufe.experte' },
  { id: 'genie', name: 'lobby.stufe.genie' },
];

/**
 * Schach gegen den Computer: alle vier Stufen, auch Anfänger. Anders als am
 * Doppelkopftisch sitzt hier kein Mensch neben dem Bot, dem eine schwache
 * Stufe das Spiel verdirbt — wer allein Schach lernt, braucht sie gerade.
 * Was jede Stufe rechnet, steht in packages/game-brochess/src/bot.ts.
 */
const SCHACH_STUFEN: readonly { id: BotLevel; name: string; unter: string }[] = [
  { id: 'anfaenger', name: 'lobby.stufe.anfaenger', unter: 'lobby.stufe.anfaenger.unter' },
  { id: 'standard', name: 'lobby.stufe.standard', unter: 'lobby.stufe.standard.unter' },
  { id: 'experte', name: 'lobby.stufe.experte', unter: 'lobby.stufe.experte.unter' },
  { id: 'genie', name: 'lobby.stufe.genie', unter: 'lobby.stufe.genie.unter' },
];

/**
 * Spiele, die man in der Lobby direkt allein gegen einen Bot beginnen kann.
 * Bisher nur BroChess (Emile, 13.10.2026): Zu zweit gibt es sonst keinen Weg,
 * ohne Gegner zu spielen, außer erst einen Tisch zu öffnen und dort den
 * freien Platz zu füllen — das findet niemand.
 */
const ALLEIN_GEGEN_BOT: ReadonlySet<string> = new Set(['brochess']);

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
/**
 * Wer an den Tisch darf. `on_request` heißt seit dem 13.10.2026 „Privat":
 * Er steht nicht in der Lobbyliste, man kommt nur per Einladung herein, und
 * der Gastgeber sagt jedem Beitritt zu (Server: tables/anfragen.ts).
 */
type Sichtbarkeit = 'public' | 'on_request' | 'club_only';

function fussnote(gameId: string, seats: number, visibility: Sichtbarkeit): string {
  if (visibility === 'on_request') {
    return t('lobby.fuss.privat');
  }
  if (visibility === 'club_only') {
    return t('lobby.fuss.clan');
  }
  if (gameId === 'skat') {
    return t('lobby.fuss.skat');
  }
  if (seats === 3) {
    return t('lobby.fuss.dreier');
  }
  // Bots zählen seit dem 04.08.2026 für die Rangliste (`countsForRanking` im
  // Server); bis zum 13.10.2026 stand hier noch das Gegenteil.
  return t('lobby.fuss.standard');
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
  const [visibility, setVisibility] = useState<Sichtbarkeit>('public');
  const [botLevel, setBotLevel] = useState<BotLevel>('standard');
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);
  /**
   * Zeitkontrolle (nur BroChess, Emile, 22.10.2026): Bullet, Blitz, Rapid wie
   * auf den grossen Schachseiten. Sie geht als Teil des Regelsatzes an den
   * Tisch; pruefen und messen tun Modul und Server.
   */
  const istSchach = gameId === 'brochess';
  const [zeitId, setZeitId] = useState(gemerkteZeit);
  const [zeitOffen, setZeitOffen] = useState(false);
  const zeitRegeln = istSchach ? regelnFuer(zeitkontrolle(zeitId)) : {};
  /**
   * Spezial-Modi (BroChess: Secret Dame …), ein Knopf in Liste, Bot- und
   * Erstellen-Ansicht — dieselbe Wahl gilt für alle drei. Bis zum 13.11.2026
   * stand Secret Dame nur im Formular „Tisch erstellen" und wurde nicht
   * gefunden; gegen den Bot gab es ihn gar nicht. Was es an Modi gibt, steht
   * allein in minispiele/brochess/spezialmodi.ts.
   */
  const spezial = useSpezialModi(istSchach);
  /** Tischauswahl oder Tisch erstellen — zwei Bildschirme, kein Langformular. */
  const [ansicht, setAnsicht] = useState<'liste' | 'erstellen' | 'bot'>('liste');
  /** Gestellte Beitrittsanfrage an einen privaten Tisch, solange sie läuft. */
  const [anfrage, setAnfrage] = useState<{ tableId: string; host: string | null } | null>(null);
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
      if (merken?.visibility === 'club_only' || merken?.visibility === 'public' || merken?.visibility === 'on_request') {
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
        config: { ...config, tableSize: seats, rounds, ...zeitRegeln, ...spezial.felder },
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
      if (istSchach) merkeZeit(zeitId);
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
      setError(err instanceof ApiError ? t(err.messageKey) : t('lobby.verbindungFehlgeschlagen'));
    }
  };

  /**
   * Allein gegen den Bot: ein Tisch für zwei, der freie Platz sofort mit
   * einem Bot besetzt. `on_request` hält ihn aus der Lobbyliste heraus — wie
   * bei Farbduell und Mememory, damit niemand an einen Bot-Tisch gerät, der
   * einen Menschen sucht.
   */
  const starteGegenBot = async (): Promise<void> => {
    setError(null);
    try {
      const sitze = defaults?.seatCounts[0] ?? 2;
      const runden = defaults?.rounds[String(sitze)]?.[0] ?? 1;
      const table = await api.createTable({
        gameId,
        config: { ...config, tableSize: sitze, rounds: runden, ...zeitRegeln, ...spezial.felder },
        seats: sitze,
        rounds: runden,
        visibility: 'on_request',
        fillWithBots: true,
        botLevel,
      });
      if (istSchach) merkeZeit(zeitId);
      onEnter(table.id);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.messageKey) : t('lobby.verbindungFehlgeschlagen'));
    }
  };

  const join = async (id: string): Promise<void> => {
    setError(null);
    try {
      const antwort = await api.joinTable(id);
      // Privater Tisch: erst die Zusage des Gastgebers (tisch/Anfragen.tsx).
      if (antwort.angefragt) {
        setAnfrage({ tableId: id, host: tables.find((row) => row.id === id)?.host ?? null });
        return;
      }
      onEnter(id);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.messageKey) : t('lobby.verbindungFehlgeschlagen'));
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

  if (anfrage) {
    return (
      <AnfrageWarten
        gameId={gameId}
        tableId={anfrage.tableId}
        gastgeber={anfrage.host}
        onAngenommen={() => onEnter(anfrage.tableId)}
        onZurueck={() => {
          setAnfrage(null);
          refresh();
        }}
      />
    );
  }

  // Neues Hub: dieselben Zustände und Aufrufe im Spieleinstieg-Baukasten.
  const zeitWahl = zeitkontrolle(zeitId);
  const zeitAbschnitt = istSchach ? (
    <SpielAbschnitt titel={t('lobby.zeit')}>
      <div className="hb-liste">
        <button type="button" className="spe-zeile" onClick={() => setZeitOffen(true)}>
          <span>
            <strong>
              <ArtZeichen art={zeitWahl.art} /> {zeitText(zeitWahl)}
            </strong>
            <small>{tf('lobby.zeit.unter', { art: ARTNAME[zeitWahl.art] })}</small>
          </span>
          <span className="hb-pf" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </SpielAbschnitt>
  ) : null;
  const zeitBlatt =
    istSchach && zeitOffen ? (
      <ZeitWahlBlatt wert={zeitId} onWahl={setZeitId} onClose={() => setZeitOffen(false)} />
    ) : null;

  const name = t(`game.${gameId}`);
  const sitze = defaults?.seatCounts ?? [4];
  const sitzText = sitze.length > 1 ? `${sitze[0]}-${sitze[sitze.length - 1]}` : `${sitze[0]}`;
  if (ansicht === 'bot') {
    return (
      <SpielRahmen
        gameId={gameId}
        titel={t('lobby.bot.titel')}
        unter={tf('lobby.bot.unter', { spiel: name })}
        onBack={() => setAnsicht('liste')}
        zurueckText={t('lobby.zurueckZurAuswahl')}
        fuss={
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => void starteGegenBot()}>
            {t('lobby.bot.starten')}
          </button>
        }
      >
        {error && <p className="hb-fehler">{error}</p>}
        {spezial.knopf}
        {zeitAbschnitt}
        <SpielAbschnitt titel={t('lobby.botStaerke')}>
          <SpielWahl
            name={t('lobby.botStaerke')}
            werte={SCHACH_STUFEN.map((b) => ({ wert: b.id, text: t(b.name), unter: t(b.unter) }))}
            wert={botLevel}
            onWahl={setBotLevel}
          />
        </SpielAbschnitt>
        <p className="hb-klein">{t('lobby.bot.los')}</p>
        {zeitBlatt}
        {spezial.blatt}
      </SpielRahmen>
    );
  }
  if (ansicht === 'erstellen') {
    return (
      <SpielRahmen
        gameId={gameId}
        titel={t('lobby.erstellen')}
        unter={tf('lobby.erstellen.unter', { spiel: name, spanne: sitzText })}
        onBack={() => setAnsicht('liste')}
        zurueckText={t('lobby.zurueckZurAuswahl')}
        fuss={
          <>
            <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => void create()}>
              {t('lobby.erstellen')}
            </button>
            <p className="hb-klein">{fussnote(gameId, seats, visibility)}</p>
          </>
        }
      >
        {error && <p className="hb-fehler">{error}</p>}
        {spezial.knopf}
        {zeitAbschnitt}
        {/* Schach kennt nur zwei Spieler und eine Partie — zwei Wahlen mit
            je einer Möglichkeit wären keine Wahl. */}
        {!istSchach && (
        <>
        <SpielAbschnitt titel={t('lobby.spieler')}>
          <SpielWahl
            name={t('lobby.spieler')}
            werte={sitze.map((c) => ({ wert: c, text: tf('lobby.spielerZahl', { n: c }) }))}
            wert={seats}
            onWahl={(count) => {
              setSeats(count);
              const first = defaults?.rounds[String(count)]?.[0];
              if (first) setRounds(first);
            }}
          />
        </SpielAbschnitt>
        <SpielAbschnitt titel={t('lobby.runden')}>
          <SpielWahl name={t('lobby.runden')} werte={roundOptions.map((c) => ({ wert: c, text: String(c) }))} wert={rounds} onWahl={setRounds} />
        </SpielAbschnitt>
        </>
        )}
        <SpielAbschnitt titel={t('lobby.fuerWen')}>
          <SpielWahl
            name={t('lobby.fuerWen')}
            werte={[
              { wert: 'public' as const, text: t('lobby.offen'), unter: t('lobby.offen.unter') },
              { wert: 'on_request' as const, text: t('lobby.privat'), unter: t('lobby.privat.unter') },
              { wert: 'club_only' as const, text: t('lobby.nurClan'), unter: t('lobby.nurClan.unter') },
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
          <SpielAbschnitt titel={t('lobby.botStaerke')}>
            <SpielWahl name={t('lobby.botStaerke')} werte={BOT_STUFEN.map((b) => ({ wert: b.id, text: t(b.name) }))} wert={botLevel} onWahl={setBotLevel} />
          </SpielAbschnitt>
        )}
        {!istSchach && (
        <SpielAbschnitt titel={t('lobby.regeln')}>
          <div className="hb-liste">
            <button type="button" className="spe-zeile" onClick={() => setRegelnOffen(true)}>
              <span>
                <strong>{aktiveRegeln === 0 ? t('lobby.regeln.standard') : tn('lobby.sonderregeln', aktiveRegeln)}</strong>
                <small>{t('lobby.regeln.einstellen')}</small>
              </span>
              <span className="hb-pf" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </SpielAbschnitt>
        )}
        {regelnOffen && config && <RegelSheet config={config} onChange={setConfig} onClose={() => setRegelnOffen(false)} />}
        {zeitBlatt}
        {spezial.blatt}
      </SpielRahmen>
    );
  }
  const filterWerte: [string, string][] = [
    ['alle', t('lobby.filter.alle')],
    ...sitze.map((c) => [`${c}er`, tf('lobby.filter.sitze', { n: c })] as [string, string]),
    ['offen', t('lobby.filter.offen')],
    ['clan', t('lobby.filter.clan')],
  ];
  return (
    <SpielRahmen
      gameId={gameId}
      titel={name}
      unter={tf('lobby.auswahl.unter', { spanne: sitzText })}
      onBack={onBack}
      zurueckText={t('lobby.zurueckZurSpielseite')}
      fuss={
        <>
          {ALLEIN_GEGEN_BOT.has(gameId) && (
            <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => setAnsicht('bot')}>
              {t('lobby.bot.titel')}
            </button>
          )}
          <button
            type="button"
            className={ALLEIN_GEGEN_BOT.has(gameId) ? 'hb-kn is-breit' : 'hb-kn is-gold is-haupt is-breit'}
            onClick={() => setAnsicht('erstellen')}
          >
            {t('lobby.erstellen')}
          </button>
        </>
      }
    >
      {error && <p className="hb-fehler">{error}</p>}
      {spezial.knopf}
      {spezial.blatt}
      <div className="hb-chips spe-chips" role="group" aria-label={t('lobby.filter')}>
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
        placeholder={t('lobby.suche')}
        value={suche}
        onChange={(event) => setSuche(event.target.value)}
        aria-label={t('lobby.suche.label')}
      />
      <SpielAbschnitt titel={t('lobby.offeneTische')} zusatz={tables.length > 0 ? tf('lobby.offeneTische.zahl', { gefiltert: gefiltert.length, gesamt: tables.length }) : undefined}>
        <div className="hb-liste">
          {gefiltert.length === 0 && (
            <p className="spe-leer">
              {tables.length === 0 ? t('lobby.leer') : t('lobby.leerFilter')}
            </p>
          )}
          {gefiltert.map((row) => (
            <button type="button" className="spe-zeile spe-tisch" key={row.id} onClick={() => void join(row.id)}>
              <span>
                <strong>
                  {row.host ? tf('lobby.tisch.runde', { host: row.host }) : t('lobby.tisch.offen')}
                  {row.visibility === 'club_only' && <span className="spe-marke">{t('lobby.tisch.clan')}</span>}
                </strong>
                <small>
                  {tf('lobby.tisch.zeile', { sitze: row.seats, runden: row.maxRounds, regeln: row.ruleCount === 0 ? t('lobby.regeln.standard') : tn('lobby.sonderregeln', row.ruleCount) })}
                </small>
              </span>
              <span className="spe-punkte" aria-hidden="true">
                {Array.from({ length: row.seats }, (_, i) => (
                  <i key={i} className={i < row.occupied ? '' : 'is-frei'} />
                ))}
              </span>
              <span className="spe-zahl" aria-label={tf('lobby.tisch.besetzt', { belegt: row.occupied, sitze: row.seats })}>
                {row.occupied}/{row.seats}
              </span>
            </button>
          ))}
        </div>
      </SpielAbschnitt>
    </SpielRahmen>
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
  return (
    <HbBlatt titel={t('lobby.regeln')} label={t('lobby.regelblatt.label')} onClose={onClose}>
      <p className="hb-klein">
        {tf('lobby.regelblatt.zahl', { an: active, gesamt })}
      </p>
      {kacheln}
      <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onClose}>
        {t('lobby.fertig')}
      </button>
    </HbBlatt>
  );
}
