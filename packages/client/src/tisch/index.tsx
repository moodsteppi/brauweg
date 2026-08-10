/**
 * Gemeinsame Bausteine des Spieltisches.
 *
 * Was hier steht, gilt fuer JEDES Kartenspiel der Plattform: Sitzplaetze am
 * Bildschirm, Avatar mit Zug-Ring, Handkarte mit Legeanimation, Stichstapel,
 * Zugtimer, letzter Stich, Regelblatt und Partie-Ende.
 *
 * Was hier NICHT steht, ist alles Spielspezifische - Vorbehalte, Ansagen und
 * Armut gehoeren zum Doppelkopf, Gebote und Trumpfwahl zum Zauberer. Diese
 * Trennung ist der Grund, warum ein zweites Spiel keinen dritten Tisch braucht.
 *
 * Die Klassennamen bleiben bewusst `doko-*`: Sie stehen so in `styles.css` und
 * beschreiben laengst den Spieltisch allgemein, nicht das Spiel. Sie
 * umzubenennen hiesse, jede Regel der Datei anzufassen, ohne dass sich etwas
 * aendert - und genau dabei gehen Regeln verloren, die spaeter ueberschrieben
 * werden.
 */

import { memo, useEffect, useState } from 'react';
import { Ladekreis } from '../Ladekreis';

import { api } from '../api';
import { CardBack, CardFront } from '../CardFace';
import type { Deck } from '../decks';
import { t } from '../i18n';
import type { BaseGameView, Card, PartyMessage, TableMessage, ViewMessage } from '../protocol';
import { regelBild } from '../regelbilder';
import { useCountdown } from '../useTable';

export const TURN_SECONDS = 60;

// ---------------------------------------------------------------------------
// Sitzplaetze
// ---------------------------------------------------------------------------

export type Slot =
  | 'bottom'
  | 'left'
  | 'top'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'left-high'
  | 'right-high';

/**
 * Wo die Mitspieler sitzen, je nach Tischgroesse. Der eigene Sitz ist immer
 * unten; die anderen laufen im Uhrzeigersinn darum herum.
 *
 * Sechs Sitze gibt es seit Zauberer. Auf einem Hochkant-Handy passen dort
 * keine drei Plaetze mehr nebeneinander an den oberen Rand, deshalb sitzen
 * links und rechts je zwei uebereinander.
 */
export const LAYOUTS: Record<number, Slot[]> = {
  3: ['bottom', 'left', 'right'],
  4: ['bottom', 'left', 'top', 'right'],
  5: ['bottom', 'left', 'top-left', 'top-right', 'right'],
  6: ['bottom', 'left', 'left-high', 'top', 'right-high', 'right'],
};

/** Absoluter Sitz -> Platz am Bildschirm, relativ zum eigenen Sitz. */
export function slotFor(seat: number, base: number, seatCount: number): Slot {
  const rel = (seat - base + seatCount) % seatCount;
  return LAYOUTS[seatCount]?.[rel] ?? 'top';
}

/** Liegen die verdeckten Karten an diesem Platz quer? */
export function istSeitlich(slot: Slot): boolean {
  return slot === 'left' || slot === 'right' || slot === 'left-high' || slot === 'right-high';
}

// ---------------------------------------------------------------------------
// Avatar und Uhr
// ---------------------------------------------------------------------------

/**
 * Der Countdown tickt bewusst HIER und nicht am Tisch: Ein Timer an der
 * Wurzel rendert fuenfmal pro Sekunde den kompletten Tisch neu - genau das
 * machte jede Animation ruckelig. So tickt nur der eine aktive Avatar.
 */
export function Avatar({
  name,
  seatIndex,
  active,
  deadline,
  isBot,
  you,
  avatarUrl,
}: {
  name: string;
  seatIndex: number;
  active: boolean;
  deadline: number | null;
  isBot?: boolean;
  you?: boolean;
  avatarUrl?: string | null;
}): React.JSX.Element {
  const secondsLeft = useCountdown(active ? deadline : null);
  const ring =
    active && secondsLeft !== null
      ? `conic-gradient(var(--accent) ${(secondsLeft / TURN_SECONDS) * 360}deg, rgba(255,255,255,0.08) 0)`
      : undefined;
  return (
    <div
      className={`doko-avatar${active ? ' is-active' : ''}${you ? ' is-you' : ''}`}
      style={ring ? { background: ring } : undefined}
    >
      {avatarUrl ? (
        <img className="doko-avatar-img" src={avatarUrl} alt={name} draggable={false} />
      ) : (
        /* Ohne eigenes Bild sitzt der Pinguin am Tisch - er ist unser
           Maskottchen, und Buchstabenkreise wirken wie ein Formular. Je Sitz
           ein anderer Schal, damit sich mehrere Pinguine auseinanderhalten
           lassen. Bots bekommen denselben Pinguin, nur blasser. */
        <img
          className={`doko-avatar-img${isBot ? ' is-bot' : ''}`}
          src={`/hub/pinguin-${(seatIndex % 4) + 1}.png`}
          alt={name}
          draggable={false}
        />
      )}
    </div>
  );
}

/** Restzeit-Anzeige. Tickt fuer sich allein, nicht der ganze Tisch mit. */
export function TurnClock({ deadline }: { deadline: number | null }): React.JSX.Element | null {
  const secondsLeft = useCountdown(deadline);
  if (secondsLeft === null) return null;
  return <span className="doko-turnclock">{secondsLeft}s</span>;
}

/**
 * Der gewonnene Stichstapel neben dem Spieler: ein kleines Haeufchen
 * verdeckter Karten, wie am echten Tisch, mit der Anzahl daran.
 */
export function StichStapel({ count }: { count: number }): React.JSX.Element | null {
  if (count <= 0) return null;
  const shown = Math.min(count, 3);
  return (
    <span className="doko-stiche" aria-label={`${count} Stiche gewonnen`}>
      {Array.from({ length: shown }, (_, i) => (
        <i key={i} />
      ))}
      <b>{count}</b>
    </span>
  );
}

/** Verdeckte Karten eines Mitspielers, so viele wie er haelt. */
export function Ruecken({
  count,
  vertical,
  deck,
}: {
  count: number;
  vertical: boolean;
  deck: Deck;
}): React.JSX.Element {
  return (
    <div className={`doko-backs${vertical ? ' is-vertical' : ''}`}>
      {Array.from({ length: count }, (_, i) => (
        <div className={`pc pc--back${vertical ? ' side' : ''}`} key={i}>
          <CardBack deck={deck} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hand
// ---------------------------------------------------------------------------

export const HandCard = memo(function HandCard({
  card,
  deck,
  index,
  total,
  playable,
  trump,
  onPlay,
  legt,
  locked = false,
  markable = false,
  marked = false,
  onMark,
}: {
  card: Card;
  deck: Deck;
  index: number;
  total: number;
  playable: boolean;
  /** Karte, die sticht. Bekommt den schmalen gruenen Balken. */
  trump: boolean;
  onPlay: (cardId: number) => void;
  /**
   * Gesteuerter Flug: Der Tisch sagt, ob die Karte gerade fliegt, und
   * bekommt onPlay sofort beim Tipp - er taktet Animation und Meldung
   * selbst (Doppelkopf). Ohne dieses Feld fliegt die Karte selbstverwaltet
   * und onPlay kommt nach 170 ms (Zauberer).
   */
  legt?: boolean;
  /** Ein eigener Zug ist schon unterwegs: Tipps schuetteln nur. */
  locked?: boolean;
  /** Nicht am Zug: Der Tipp merkt die Karte vor, statt zu schuetteln. */
  markable?: boolean;
  marked?: boolean;
  onMark?: (cardId: number) => void;
}): React.JSX.Element {
  /**
   * Kein Faecher, keine Hervorhebung.
   *
   * Die Karten liegen gerade nebeneinander und fuellen am Anfang die volle
   * Breite; mit jeder gespielten Karte rueckt die Reihe zusammen, bis die
   * letzte in der Mitte liegt.
   *
   * Spielbare und gesperrte Karten sehen gleich aus. Wer eine spielt, sieht
   * sie fliegen; wer eine gesperrte antippt, sieht sie den Kopf schuetteln -
   * ausser er darf sie vormerken.
   */
  const [shaking, setShaking] = useState(false);
  const [eigenerFlug, setEigenerFlug] = useState(false);
  const controlled = legt !== undefined;
  const fliegt = controlled ? legt : eigenerFlug;

  const mid = (total - 1) / 2;
  const off = index - mid;

  const vars = {
    '--off': off,
    // Fliegende Karte ueber allem, vorgemerkte ueber ihren Nachbarinnen.
    zIndex: fliegt ? 400 : marked ? 300 : index,
  } as React.CSSProperties;

  return (
    <button
      className={`doko-handcard${trump ? ' is-trump' : ''}${shaking ? ' is-shake' : ''}${
        fliegt ? ' is-legt' : ''
      }${marked ? ' is-vorgemerkt' : ''}`}
      style={vars}
      // Nicht disabled: Der Tipp auf eine unspielbare Karte soll ankommen und
      // das Schuetteln ausloesen, statt lautlos zu versanden.
      aria-disabled={!playable}
      aria-pressed={markable || marked ? marked : undefined}
      onClick={() => {
        if (locked) {
          setShaking(true);
          return;
        }
        if (playable) {
          if (controlled) {
            onPlay(card.id);
            return;
          }
          // Erst fliegen lassen, dann melden. Die 170 ms sind kuerzer als
          // jede Reaktionszeit und sorgen dafuer, dass man die Karte fallen
          // sieht.
          setEigenerFlug(true);
          window.setTimeout(() => onPlay(card.id), 170);
          return;
        }
        if (markable && onMark) {
          onMark(card.id);
          return;
        }
        setShaking(true);
      }}
      onAnimationEnd={() => setShaking(false)}
      aria-label={marked ? 'Vorgemerkt' : trump ? 'Sticht' : undefined}
    >
      <div className="pc pc--hand">
        <CardFront card={card} deck={deck} />
        {trump && <span className="doko-trump-bar" aria-hidden="true" />}
      </div>
    </button>
  );
});

// ---------------------------------------------------------------------------
// Blaetter
// ---------------------------------------------------------------------------

/** Der letzte Stich zum Nachschauen - fuer alle am Tisch, auch Zuschauer. */
export function LetzterStich({
  played,
  winnerSeat,
  nameOf,
  deck,
  onClose,
}: {
  played: { seat: number; card: Card }[];
  winnerSeat: number;
  nameOf: (seat: number) => string;
  deck: Deck;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card" onClick={(e) => e.stopPropagation()}>
        <h2>Letzter Stich</h2>
        <p className="muted">Ging an {nameOf(winnerSeat)}.</p>
        <div className="doko-lasttrick">
          {played.map((p) => (
            <figure key={p.card.id} className={p.seat === winnerSeat ? 'is-winner' : undefined}>
              <div className="pc pc--trick">
                <CardFront card={p.card} deck={deck} />
              </div>
              <figcaption>{nameOf(p.seat)}</figcaption>
            </figure>
          ))}
        </div>
        <button className="primary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

/**
 * Die Regeln des Tisches zum Nachlesen, im selben Kachelbild wie beim
 * Erstellen - nur ohne Schalter. Der Regelsatz ist auf die Version beim
 * Tischbau festgeschrieben, gezeigt wird also genau das, was gilt.
 *
 * Das Blatt kennt kein einzelnes Spiel: Es zeigt, was der Regelsatz an
 * booleschen Feldern hergibt. Ein neues Spiel braucht deshalb nur
 * `regel.*`-Eintraege im Woerterbuch.
 */
export function RegelBlatt({
  tableId,
  onClose,
}: {
  tableId: string;
  onClose: () => void;
}): React.JSX.Element {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    api
      .tableRules(tableId)
      .then((antwort) => setConfig(antwort.config))
      .catch(() => setFehler(true));
  }, [tableId]);

  const flags = config
    ? Object.entries(config).filter(([, value]) => typeof value === 'boolean')
    : [];
  // Die Blattwahl (Scharfer Doppelkopf = ohne Neunen) ist keine Ja/Nein-Regel,
  // gehoert aber sichtbar dazu - wie in der Tischerstellung.
  const hatBlattwahl = typeof config?.deck === 'string';
  const scharf = config?.deck === 'without9';
  const an = flags.filter(([, value]) => value).length + (scharf ? 1 : 0);
  const gesamt = flags.length + (hatBlattwahl ? 1 : 0);

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card" onClick={(event) => event.stopPropagation()}>
        <h2>Regeln an diesem Tisch</h2>
        {fehler && <p className="error">Die Regeln ließen sich nicht laden.</p>}
        {!config && !fehler && <Ladekreis />}
        {config && (
          <>
            <p className="muted">
              {an === 0
                ? 'Keine Sonderregeln. Es gilt das Grundspiel.'
                : `${an} von ${gesamt} Regeln an.`}
            </p>
            <div className="regeln">
              {hatBlattwahl && (
                <span className={`regel${scharf ? ' is-on' : ''}`}>
                  <span className="regel-bild" aria-hidden="true">
                    {regelBild('scharf')}
                  </span>
                  {t('regel.scharf')}
                  <span className="regel-check" aria-hidden="true">
                    ✓
                  </span>
                </span>
              )}
              {flags.map(([key, value]) => (
                <span key={key} className={`regel${value ? ' is-on' : ''}`}>
                  <span className="regel-bild" aria-hidden="true">
                    {regelBild(key)}
                  </span>
                  {t(`regel.${key}`)}
                  <span className="regel-check" aria-hidden="true">
                    ✓
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
        <button className="primary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

/**
 * Wartebereich vor dem Start.
 *
 * Freie Plaetze sind kein Fehler, sondern der Normalfall: Man sieht, wer schon
 * da ist, kann Plaetze mit Bots fuellen, und sobald der letzte Platz belegt
 * ist, geht es von selbst los. Gilt fuer jedes Spiel - was dort steht, kommt
 * ausschliesslich aus der Tischnachricht.
 */
export function Wartebereich({
  tableId,
  table,
  error,
  spielerName,
  addBot,
  removeBot,
  onLeave,
}: {
  tableId: string;
  table: TableMessage;
  error: string | null;
  spielerName: (text: string, accountId: string | null | undefined) => React.JSX.Element;
  addBot: (seat: number) => void;
  removeBot: (seat: number) => void;
  onLeave: () => void;
}): React.JSX.Element {
  /**
   * Bot-Knoepfe, auf die der Tisch noch nicht geantwortet hat. Bis die neue
   * Tischnachricht eintrifft, zeigt der Knopf einen Kreisel statt gar nichts -
   * sonst tippt man doppelt.
   */
  const [botBusy, setBotBusy] = useState<Record<number, 'add' | 'remove'>>({});
  const [zeigeRegeln, setZeigeRegeln] = useState(false);

  useEffect(() => {
    setBotBusy((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [key, kind] of Object.entries(prev)) {
        const seat = table.seats.find((s) => s.seat === Number(key));
        if (!seat) continue;
        if ((kind === 'add' && seat.isBot) || (kind === 'remove' && !seat.isBot)) {
          delete next[Number(key)];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [table]);

  return (
    <div className="doko doko--wait">
      <header className="doko-top">
        {/* Zurueck aus dem Wartebereich gibt den Platz frei - sonst bleibt ein
            Geistertisch in der Lobby stehen. Schlaegt die Meldung fehl, raeumt
            der Server den Tisch spaeter selbst ab. */}
        <button
          className="doko-icon"
          onClick={() => {
            void api.leaveTable(tableId).catch(() => undefined);
            onLeave();
          }}
          aria-label="Zurück"
        >
          ‹
        </button>
        <div className="doko-top-mid">
          <strong>Wartet auf Mitspieler</strong>
          <span className="muted">
            {table.missing === 0
              ? 'Alle Plätze belegt, es geht gleich los…'
              : `${table.missing === 1 ? 'Noch ein Spieler' : `Noch ${table.missing} Spieler`} · ${table.rounds} Runden`}
          </span>
        </div>
        <div className="doko-top-right">
          <button
            className="doko-icon"
            onClick={() => setZeigeRegeln(true)}
            aria-label="Tischregeln ansehen"
          >
            §
          </button>
        </div>
      </header>
      <div className="doko-wait">
        {table.seats.map((seat) => (
          <div
            className={`doko-wait-seat${seat.displayName || seat.isBot ? '' : ' is-empty'}`}
            key={seat.seat}
          >
            <Avatar
              name={seat.displayName ?? (seat.isBot ? 'Bot' : 'frei')}
              seatIndex={seat.seat}
              active={false}
              deadline={null}
              isBot={seat.isBot}
              avatarUrl={seat.avatarUrl}
            />
            <div className="doko-wait-name">
              {seat.displayName
                ? spielerName(seat.displayName, seat.accountId)
                : seat.isBot
                  ? `Bot ${seat.seat + 1}`
                  : 'frei'}
            </div>
            {!seat.displayName && !seat.isBot && (
              <button
                className="doko-seat-btn"
                disabled={!!botBusy[seat.seat]}
                onClick={() => {
                  setBotBusy((b) => ({ ...b, [seat.seat]: 'add' }));
                  addBot(seat.seat);
                }}
              >
                {botBusy[seat.seat] ? (
                  <span className="doko-btn-spinner" aria-label="Bot setzt sich…" />
                ) : (
                  '+ Bot'
                )}
              </button>
            )}
            {!seat.displayName && seat.isBot && (
              <button
                className="doko-seat-btn"
                disabled={!!botBusy[seat.seat]}
                onClick={() => {
                  setBotBusy((b) => ({ ...b, [seat.seat]: 'remove' }));
                  removeBot(seat.seat);
                }}
              >
                {botBusy[seat.seat] ? (
                  <span className="doko-btn-spinner" aria-label="Bot steht auf…" />
                ) : (
                  'entfernen'
                )}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="muted doko-wait-hint">
        Teile die Adresse dieser Seite, dann können andere direkt beitreten — oder
        fülle freie Plätze mit Bots. Sobald alle Plätze belegt sind, geht es los.
      </p>
      {error && <p className="doko-error">{t(error)}</p>}
      {zeigeRegeln && <RegelBlatt tableId={tableId} onClose={() => setZeigeRegeln(false)} />}
    </div>
  );
}

/**
 * Partie-Ende mit Platzierung und gebuchten Trophaeen.
 *
 * Gilt fuer jedes Spiel: Die Plattform wertet Platzierungen, nicht
 * Spielpunkte - genau deshalb sieht dieser Bildschirm ueberall gleich aus.
 */
export function PartyEnd({
  view,
  party,
  nameOf,
  spielerName,
  onLeave,
}: {
  view: ViewMessage<BaseGameView>;
  party: PartyMessage | null;
  nameOf: (seat: number) => string;
  spielerName: (text: string, accountId: string | null | undefined) => React.JSX.Element;
  onLeave: () => void;
}): React.JSX.Element {
  const standings = [...(party?.standings ?? [])].sort((a, b) => a.place - b.place);

  const awards = party?.trophies ?? [];
  const gewertet = awards.length > 0;

  /** Summe je Sitz: Platzierung und eventuelle Verlassen-Strafe zusammen. */
  const trophiesOf = (seat: number): number =>
    awards.filter((a) => a.seat === seat).reduce((sum, a) => sum + a.delta, 0);

  const accountOf = (seat: number): string | null | undefined =>
    party?.seats.find((s) => s.seat === seat)?.accountId;

  return (
    <div className="doko doko--end">
      <img className="doko-bg" src="/hub/bg-abschluss.webp" alt="" draggable={false} />
      <div className="doko-end-card">
        <h1>Partie beendet</h1>
        <p className="muted">{view.view.totalRounds} Runden gespielt.</p>
        <ol className="doko-standings">
          {standings.map((s, i) => {
            const delta = trophiesOf(s.seat);
            return (
              <li key={s.seat} className={i === 0 ? 'is-winner' : undefined}>
                {/* Gemalte Medaille bis Platz drei, sonst die Zahl. Bei
                    Gleichstand haengen bewusst zwei gleiche Medaillen
                    nebeneinander - sie sind ja wirklich gleich weit. */}
                <span className="doko-place">
                  {s.place <= 3 ? (
                    <img
                      className="doko-medaille"
                      src={`/hub/medaille-${s.place}.webp`}
                      alt={`Platz ${s.place}`}
                      draggable={false}
                    />
                  ) : (
                    `${s.place}.`
                  )}
                </span>
                <span className="doko-standing-name">
                  {spielerName(nameOf(s.seat), accountOf(s.seat))}
                  {s.left && <em className="doko-tag">ausgestiegen</em>}
                  {/* Das Vorzeichen ist die Information: +9 ist ein Gewinn,
                      -9 ein Verlust, 0 ehrlich eine Null. */}
                  {gewertet && (
                    <em className="doko-tag">
                      {delta > 0 ? `+${delta}` : delta}
                      <img src="/hub/pokal.png" alt="Trophäen" className="doko-tag-icon" />
                    </em>
                  )}
                </span>
                <span className="doko-standing-points">{s.points}</span>
              </li>
            );
          })}
        </ol>
        <p className="muted doko-fineprint">
          {gewertet
            ? 'Trophäen sind gutgeschrieben. Dein Stand steht im Profil.'
            : 'Keine Trophäen: An Tischen mit Bots wird nicht gewertet.'}
        </p>
        <button className="primary" onClick={onLeave}>
          Zurück zur Lobby
        </button>
      </div>
    </div>
  );
}
