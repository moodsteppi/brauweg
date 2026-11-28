import { useEffect, useState } from 'react';

import { ApiError, api, type GameDefaults } from '../api';
import { t } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import type { BotLevel } from '../protocol';
import { regelBild } from '../regelbilder';
import { HbBlatt } from './HbBlatt';
import { SpielAbschnitt, SpielRahmen, SpielWahl } from './SpielEinstieg';
import { CodeBeitritt } from '../minispiele/partykiste/Beitrittscode';
import {
  ARTNAME,
  VORGABE_ZEIT,
  ZEITKONTROLLEN,
  regelnFuer,
  zeitText,
  zeitkontrolle,
} from '../minispiele/brochess/zeit';
import { ArtZeichen, ZeitWahlBlatt } from '../minispiele/brochess/ZeitWahl';
import { useSpezialModi } from '../minispiele/brochess/SpezialModi';
import { EinzelKarte, SpielartKarten, SuchWarten, quickplayUnter, spielartName } from '../spielarten/SpielartKarten';
import { useSchnellsuche } from '../spielarten/useSchnellsuche';
import { useSpielarten } from '../spielarten/useSpielarten';

/**
 * Der Spieleinstieg der Lobby-Spiele (Doppelkopf, Skat, Zauberer, Cambio,
 * BroChess, DreckBro, Bro Bluff) — seit dem 28.11.2026 ohne Tischliste.
 *
 * Robin: „Die Tischlisten verwirren — weg damit", die Zwischenseite soll
 * aussehen wie bei Farbduell. Oben die Spielarten als Karten (aus dem Modul,
 * `GameMeta.spielarten`; Antippen WAEHLT nur aus), darunter im Fuss der
 * goldene Quick-Play-Knopf (Suche in dieser Spielart ueber die Schlange),
 * blau „Gegen Bots" und „Mit Freunden" (Code-Tisch, Wartesaal wie bisher),
 * klein „Eigene Regeln" fuer den Freundestisch. Alle drei Wege nehmen die
 * gewaehlte Spielart. Wer einen Code bekommen hat, tippt ihn unten ein.
 *
 * Erstellen, Bot-Tisch und Regelblatt sind die der alten Lobby — nur der
 * Einstieg davor ist neu. Spiele ohne Spielarten bekommen eine grosse Karte
 * mit ihrem Banner und dieselben Knoepfe.
 */

/**
 * Gemerkte Zeitkontrolle fuer BroChess (bis zum 28.11.2026 die Wahl der
 * Lobby). Seitdem setzt die Spielart die Uhr; die eigene Zeitwahl unter
 * „Mit Freunden" ueberschreibt sie nur, wenn jemand sie anfasst.
 */
const ZEIT_KEY = 'brochess.zeit';

function merkeZeit(id: string): void {
  try {
    localStorage.setItem(ZEIT_KEY, id);
  } catch {
    // Gesperrter Speicher: dann eben beim naechsten Mal wieder die Spielart.
  }
}

/** Die Zeitkontrolle aus dem Regelsatz einer Spielart, fuer die Anzeige. */
function zeitIdAus(config: Record<string, unknown> | null): string {
  const treffer = ZEITKONTROLLEN.find((z) => {
    const r = regelnFuer(z);
    return r.bedenkzeitMs === config?.['bedenkzeitMs'] && r.zuschlagMs === (config?.['zuschlagMs'] ?? 0);
  });
  return treffer?.id ?? VORGABE_ZEIT;
}

/**
 * Was am Geraet gemerkt wird: Sitze, Runden, fuer wen und Bot-Staerke des
 * letzten Freundestisches. Der Regelsatz NICHT mehr (bis zum 28.11.2026
 * schon) — den bringt jetzt die Spielart, und ein gemerkter alter Regelsatz
 * stuende still ueber ihr.
 */
interface Gemerkt {
  seats?: number;
  rounds?: number;
  visibility?: string;
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
 * Spiele, bei denen „Gegen Bots" erst nach der Staerke fragt. Nur dort wertet
 * das Modul sie aus (Doppelkopf) bzw. braucht man sie (Schach allein gegen
 * den Computer, Emile 13.10.2026). Alle anderen setzen sich sofort hin.
 */
const BOT_STAERKE_WAEHLEN: ReadonlySet<string> = new Set(['doppelkopf', 'brochess']);

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
 * Wer an den Freundestisch darf. Offen gibt es nicht mehr: Ohne Tischliste
 * findet einen offenen Tisch niemand, der den Code nicht hat — er waere ein
 * privater Tisch mit falschem Namen. `on_request` ist „Privat": Man kommt nur
 * per Einladung herein, und der Gastgeber sagt jedem Beitritt zu (Server:
 * tables/anfragen.ts).
 */
type Sichtbarkeit = 'on_request' | 'club_only';

/**
 * Der Satz unter dem Knopf „Tisch aufmachen". Er haengt am Spiel und nicht
 * allein an der Platzzahl: Skat IST ein Dreierspiel, dort ist der Dreiertisch
 * der Normalfall und kein Behelf.
 */
function fussnote(gameId: string, visibility: Sichtbarkeit): string {
  if (visibility === 'club_only') return t('lobby.fuss.clan');
  if (gameId === 'skat') return t('lobby.fuss.skat');
  return t('einstieg.freunde.fuss');
}

/** Boolesche Regeln und die Blattwahl — das, was das Regelblatt umschaltet. */
function schalter(config: Record<string, unknown>): [string, unknown][] {
  return Object.entries(config).filter(([key, value]) => typeof value === 'boolean' || (key === 'deck' && typeof value === 'string'));
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
  const [defaults, setDefaults] = useState<GameDefaults | null>(null);
  const [seats, setSeats] = useState(4);
  const [rounds, setRounds] = useState(8);
  const [visibility, setVisibility] = useState<Sichtbarkeit>('on_request');
  const [botLevel, setBotLevel] = useState<BotLevel>('standard');
  /** Regelsatz des Freundestisches — die Spielart, darauf die eigenen Regeln. */
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);
  const [ansicht, setAnsicht] = useState<'start' | 'freunde' | 'bot'>('start');

  const istSchach = gameId === 'brochess';
  /**
   * Eigene Zeitkontrolle am Freundestisch (BroChess). `null` heisst: die Uhr
   * der Spielart. Eine angefasste Wahl gilt bis zum Verlassen des Bildschirms.
   */
  const [zeitWahl, setZeitWahl] = useState<string | null>(null);
  const [zeitOffen, setZeitOffen] = useState(false);
  /**
   * Spezial-Modi (BroChess: Secret Dame …) unter „Gegen Bots" und „Mit
   * Freunden". Ohne Wahl schicken sie nichts mit — dann gilt der Modus der
   * Spielart („Spezial" zieht ihn aus dem Zufall, die anderen spielen
   * klassisch). Was es an Modi gibt, steht allein in
   * minispiele/brochess/spezialmodi.ts.
   */
  const spezial = useSpezialModi(istSchach);

  const wahl = useSpielarten(gameId);
  const suche = useSchnellsuche(gameId, onEnter);

  useEffect(() => {
    void api.defaults(gameId).then((d) => {
      setDefaults(d);
      const merken = gemerkteEinstellungen(gameId);
      // Ohne gemerkte Wahl bleibt der Anfangswert (4) nur stehen, wenn das
      // Spiel ihn kennt. Skat hat 3 Sitze; sonst scheitert der erste Tisch.
      const seatWahl =
        merken?.seats !== undefined && d.seatCounts.includes(merken.seats)
          ? merken.seats
          : d.seatCounts.includes(4)
            ? 4
            : d.seatCounts[0]!;
      setSeats(seatWahl);
      const runden = d.rounds[String(seatWahl)] ?? [];
      const rundenWahl =
        merken?.rounds !== undefined && runden.includes(merken.rounds) ? merken.rounds : runden[0];
      if (rundenWahl) setRounds(rundenWahl);
      if (merken?.visibility === 'club_only') setVisibility('club_only');
      if (merken?.botLevel === 'standard' || merken?.botLevel === 'experte' || merken?.botLevel === 'genie') {
        setBotLevel(merken.botLevel);
      }
    });
  }, [gameId]);

  const name = t(`game.${gameId}`);
  const art = wahl.gewaehlt;
  const artName = art ? spielartName(gameId, art.id) : null;
  /** Grundlage aller drei Wege: die Spielart, ohne eine die Vorgabe des Moduls. */
  const basis: Record<string, unknown> = art?.config ?? defaults?.config ?? {};
  const sitze = defaults?.seatCounts ?? [4];
  const sitzText = sitze.length > 1 ? `${sitze[0]}-${sitze[sitze.length - 1]}` : `${sitze[0]}`;
  const zeitId = zeitWahl ?? zeitIdAus(art?.config ?? null);
  /*
   * Bringt die Spielart selbst einen Modus mit (BroChess „Spezial":
   * `modus: 'zufall'`), steht der Spezial-Modi-Knopf nicht da. Er zeigte sonst
   * „Klassisches Schach", obwohl der Partiebau gleich einen Modus zieht — wer
   * einen bestimmten will, waehlt eine Zeit-Spielart und dann den Modus.
   */
  const spezialKnopf = art?.config['modus'] !== undefined ? null : spezial.knopf;
  const zeitRegeln = istSchach && zeitWahl !== null ? regelnFuer(zeitkontrolle(zeitWahl)) : {};

  const baseRounds = defaults?.rounds[String(seats)] ?? [];
  // Clantische dürfen bis 100 Runden — die kurze Liste vom Modul um die
  // lange Partie ergänzen, sofern die Geberrotation aufgeht.
  const roundOptions =
    visibility === 'club_only' && !baseRounds.includes(100) ? [...baseRounds, 100] : baseRounds;

  const fehlerText = (err: unknown): string =>
    err instanceof ApiError ? t(err.messageKey) : t('lobby.verbindungFehlgeschlagen');

  /** Quick-Play: die Suche in der gewaehlten Spielart. Ohne Spielart die Vorgabe des Moduls. */
  const quickPlay = (): void => {
    setError(null);
    void suche.starte(art?.config);
  };

  /**
   * Allein gegen Bots: ein Tisch, die freien Plaetze sofort mit Bots besetzt.
   * `on_request` haelt ihn aus jeder Liste — wie bei Farbduell und Mememory.
   * Schach spielt zu zweit, die Kartenspiele mit der Sitzzahl, die zuletzt
   * gewaehlt war (sonst vier bzw. drei beim Skat).
   */
  const starteGegenBot = async (): Promise<void> => {
    setError(null);
    try {
      const botSitze = istSchach ? (defaults?.seatCounts[0] ?? 2) : seats;
      const runden = defaults?.rounds[String(botSitze)]?.[0] ?? 1;
      const table = await api.createTable({
        gameId,
        config: { ...basis, tableSize: botSitze, rounds: runden, ...zeitRegeln, ...spezial.felder },
        seats: botSitze,
        rounds: runden,
        visibility: 'on_request',
        fillWithBots: true,
        // Bot-Stärke gilt für alle Bots des Tisches; ein Modul ohne
        // Auswertung ignoriert das Feld (siehe `BotLevel` in game-api).
        botLevel,
      });
      onEnter(table.id);
    } catch (err) {
      setError(fehlerText(err));
    }
  };

  /** Der Freundestisch: privat oder Clan, mit Code, Wartesaal wie bisher. */
  const create = async (): Promise<void> => {
    setError(null);
    try {
      const table = await api.createTable({
        gameId,
        config: { ...(config ?? basis), tableSize: seats, rounds, ...zeitRegeln, ...spezial.felder },
        seats,
        rounds,
        visibility,
        botLevel,
      });
      // Erst nach dem Erfolg merken: Eine Absage soll nicht beim naechsten
      // Besuch wieder vorgelegt werden.
      if (istSchach && zeitWahl !== null) merkeZeit(zeitWahl);
      try {
        localStorage.setItem(merkKey(gameId), JSON.stringify({ seats, rounds, visibility, botLevel }));
      } catch {
        // Voller oder gesperrter Speicher ist kein Grund, den Tisch zu verweigern.
      }
      onEnter(table.id);
    } catch (err) {
      setError(fehlerText(err));
    }
  };

  const oeffneFreunde = (eigeneRegeln: boolean): void => {
    setError(null);
    // Jedes Mal frisch von der Spielart: Wer zwischendurch eine andere Karte
    // gewaehlt hat, soll nicht die Regeln der vorigen weiterspielen.
    setConfig({ ...basis });
    setAnsicht('freunde');
    if (eigeneRegeln && !istSchach) setRegelnOffen(true);
  };

  /** Regeln, die vom Regelsatz der Spielart abweichen — egal ob an oder aus. */
  const abweichungen = config
    ? schalter(config).filter(([key, value]) => basis[key] !== value).length
    : 0;
  /** Gibt es ueberhaupt etwas einzustellen? Sonst bleibt „Eigene Regeln" weg. */
  const hatRegeln = istSchach || schalter(basis).length > 0;

  if (suche.suchstand) {
    return (
      <SuchWarten
        gameId={gameId}
        stand={suche.suchstand}
        unter={artName ? `${name} · ${artName}` : name}
        onAbbrechen={suche.brichAb}
      />
    );
  }

  const zeitAbschnitt = istSchach ? (
    <SpielAbschnitt titel={t('lobby.zeit')}>
      <div className="hb-liste">
        <button type="button" className="spe-zeile" onClick={() => setZeitOffen(true)}>
          <span>
            <strong>
              <ArtZeichen art={zeitkontrolle(zeitId).art} /> {zeitText(zeitkontrolle(zeitId))}
            </strong>
            <small>{tf('lobby.zeit.unter', { art: ARTNAME[zeitkontrolle(zeitId).art] })}</small>
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
      <ZeitWahlBlatt wert={zeitId} onWahl={setZeitWahl} onClose={() => setZeitOffen(false)} />
    ) : null;

  if (ansicht === 'bot') {
    return (
      <SpielRahmen
        gameId={gameId}
        titel={t('lobby.bot.titel')}
        unter={artName ? `${name} · ${artName}` : tf('lobby.bot.unter', { spiel: name })}
        onBack={() => setAnsicht('start')}
        zurueckText={t('einstieg.zurueck')}
        fuss={
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => void starteGegenBot()}>
            {t('lobby.bot.starten')}
          </button>
        }
      >
        {error && <p className="hb-fehler">{error}</p>}
        {spezialKnopf}
        <SpielAbschnitt titel={t('lobby.botStaerke')}>
          {istSchach ? (
            <SpielWahl
              name={t('lobby.botStaerke')}
              werte={SCHACH_STUFEN.map((b) => ({ wert: b.id, text: t(b.name), unter: t(b.unter) }))}
              wert={botLevel}
              onWahl={setBotLevel}
            />
          ) : (
            <SpielWahl
              name={t('lobby.botStaerke')}
              werte={BOT_STUFEN.map((b) => ({ wert: b.id, text: t(b.name) }))}
              wert={botLevel}
              onWahl={setBotLevel}
            />
          )}
        </SpielAbschnitt>
        {istSchach && <p className="hb-klein">{t('lobby.bot.los')}</p>}
        {spezial.blatt}
      </SpielRahmen>
    );
  }

  if (ansicht === 'freunde') {
    return (
      <SpielRahmen
        gameId={gameId}
        titel={t('einstieg.freunde.titel')}
        unter={artName ? tf('einstieg.freunde.unter', { spiel: name, spielart: artName }) : name}
        onBack={() => {
          setRegelnOffen(false);
          setAnsicht('start');
        }}
        zurueckText={t('einstieg.zurueck')}
        fuss={
          <>
            <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => void create()}>
              {t('einstieg.freunde.los')}
            </button>
            <p className="hb-klein">{fussnote(gameId, visibility)}</p>
          </>
        }
      >
        {error && <p className="hb-fehler">{error}</p>}
        {spezialKnopf}
        {zeitAbschnitt}
        {/* Schach kennt nur zwei Spieler und eine Partie — zwei Wahlen mit
            je einer Möglichkeit wären keine Wahl. */}
        {!istSchach && sitze.length > 1 && (
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
        )}
        {!istSchach && (
          <SpielAbschnitt titel={t('lobby.runden')}>
            <SpielWahl
              name={t('lobby.runden')}
              werte={roundOptions.map((c) => ({ wert: c, text: String(c) }))}
              wert={rounds}
              onWahl={setRounds}
            />
          </SpielAbschnitt>
        )}
        <SpielAbschnitt titel={t('lobby.fuerWen')}>
          <SpielWahl
            name={t('lobby.fuerWen')}
            werte={[
              { wert: 'on_request' as const, text: t('lobby.privat'), unter: t('lobby.privat.unter') },
              { wert: 'club_only' as const, text: t('lobby.nurClan'), unter: t('lobby.nurClan.unter') },
            ]}
            wert={visibility}
            onWahl={(v) => {
              setVisibility(v);
              if (v === 'on_request' && rounds > 20) {
                const first = defaults?.rounds[String(seats)]?.[0];
                if (first) setRounds(first);
              }
            }}
          />
        </SpielAbschnitt>
        {gameId === 'doppelkopf' && (
          <SpielAbschnitt titel={t('lobby.botStaerke')}>
            <SpielWahl
              name={t('lobby.botStaerke')}
              werte={BOT_STUFEN.map((b) => ({ wert: b.id, text: t(b.name) }))}
              wert={botLevel}
              onWahl={setBotLevel}
            />
          </SpielAbschnitt>
        )}
        {!istSchach && hatRegeln && (
          <SpielAbschnitt titel={t('lobby.regeln')}>
            <div className="hb-liste">
              <button type="button" className="spe-zeile" onClick={() => setRegelnOffen(true)}>
                <span>
                  <strong>
                    {abweichungen === 0
                      ? artName
                        ? tf('einstieg.regeln.spielart', { spielart: artName })
                        : t('lobby.regeln.standard')
                      : tn('lobby.sonderregeln', abweichungen)}
                  </strong>
                  <small>{t('lobby.regeln.einstellen')}</small>
                </span>
                <span className="hb-pf" aria-hidden="true">
                  ›
                </span>
              </button>
            </div>
          </SpielAbschnitt>
        )}
        {regelnOffen && config && (
          <RegelSheet config={config} onChange={setConfig} onClose={() => setRegelnOffen(false)} />
        )}
        {zeitBlatt}
        {spezial.blatt}
      </SpielRahmen>
    );
  }

  const unterQuick = quickplayUnter(gameId, art);
  return (
    <SpielRahmen
      gameId={gameId}
      titel={name}
      unter={artName ? tf('einstieg.unter', { spanne: sitzText, spielart: artName }) : tf('einstieg.unterOhne', { spanne: sitzText })}
      onBack={onBack}
      zurueckText={t('lobby.zurueckZurSpielseite')}
      uebersicht={gameId}
      fuss={
        <>
          <button
            type="button"
            className="hb-kn is-gold is-haupt is-breit spe-kn-unter"
            data-einstieg="quickplay"
            onClick={quickPlay}
            disabled={suche.startet || wahl.spielarten === null}
          >
            {t('einstieg.quickplay')}
            {unterQuick && <small>{unterQuick}</small>}
          </button>
          {/* Nebeneinander: Vier Zeilen Knoepfe nahmen am Handy fast die
              Haelfte der Hoehe, und die Spielarten darueber sind der Inhalt. */}
          <div className="hb-knopfreihe">
            <button
              type="button"
              className="hb-kn is-blau"
              data-einstieg="bots"
              onClick={() => (BOT_STAERKE_WAEHLEN.has(gameId) ? setAnsicht('bot') : void starteGegenBot())}
            >
              {t('einstieg.bots')}
            </button>
            <button
              type="button"
              className="hb-kn is-blau"
              data-einstieg="freunde"
              onClick={() => oeffneFreunde(false)}
            >
              {t('einstieg.freunde')}
            </button>
          </div>
          {/* Die zwei Nebenwege als Textlinks in einer Zeile (28.11.2026
              abends): Das Codefeld stand vorher als eigener Abschnitt über
              dem Fuß und kostete den Spielarten den Platz. */}
          <div className="spa-links">
            {hatRegeln && (
              <button type="button" className="spa-eigene" data-einstieg="eigene" onClick={() => oeffneFreunde(true)}>
                {t('einstieg.eigeneRegeln')}
              </button>
            )}
            <CodeBeitritt spiel={gameId} onBeigetreten={onEnter} />
          </div>
        </>
      }
    >
      {error && <p className="hb-fehler">{error}</p>}
      {suche.fehler && <p className="hb-fehler">{t(suche.fehler)}</p>}
      {wahl.spielarten !== null && wahl.spielarten.length > 0 ? (
        <SpielAbschnitt titel={t('einstieg.spielart')}>
          <SpielartKarten
            gameId={gameId}
            spielarten={wahl.spielarten}
            gewaehlt={art?.id ?? null}
            onWahl={wahl.waehle}
          />
        </SpielAbschnitt>
      ) : wahl.spielarten !== null ? (
        <EinzelKarte gameId={gameId} />
      ) : null}
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
