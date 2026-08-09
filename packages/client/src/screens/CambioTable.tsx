import { useEffect, useState } from 'react';

import { api } from '../api';
import { CardBack, CardFront } from '../CardFace';
import { Ladekreis } from '../Ladekreis';
import type { Deck } from '../decks';
import { szeneBild } from '../szenen';
import { EmoteBlase, EmoteLeiste } from '../tisch/emote';
import type {
  Action,
  CambioGameView,
  CambioRoundView,
  CambioSlot,
  CambioTarget,
  Card,
} from '../protocol';
import {
  Avatar,
  LAYOUTS,
  PartyEnd,
  TurnClock,
  Wartebereich,
  slotFor,
} from '../tisch';
import { useTable } from '../useTable';

/**
 * Der Cambio-Tisch.
 *
 * Anders als bei Doppelkopf und Zauberer liegt hier keine Hand auf, sondern
 * jeder hat VIER VERDECKTE PLAETZE vor sich. Das aendert die ganze Anzeige:
 *
 *   - Man sieht seine eigenen Karten nur, solange man sie kennt. Was der
 *     Server nicht schickt, kann der Tisch auch nicht zeigen - hier wird
 *     nichts ausgeblendet, hier ist nichts da.
 *   - Ein Zug hat mehrere Schritte. Nach dem Ziehen liegt die Karte offen vor
 *     einem und will eingesetzt werden; eine Aktionskarte verlangt danach
 *     noch ein Ziel. Der Tisch fuehrt durch diese Schritte, statt alle
 *     Moeglichkeiten gleichzeitig anzubieten.
 *   - Wer Cambio gerufen hat, steht deutlich am Tisch. Danach zaehlt jeder
 *     Zug doppelt, und das muss man sehen.
 *
 * Unveraendert gilt: Alle Schaltflaechen entstehen aus `legalActions`. Der
 * Client bildet keine Regel nach - er prueft nie selbst, ob ein Ziel erlaubt
 * ist, sondern zeigt nur, was der Server anbietet.
 */
export function CambioTable({
  tableId,
  deck,
  szene,
  onShowProfile,
  onLeave,
}: {
  tableId: string;
  deck: Deck;
  szene: string;
  onShowProfile: (accountId: string) => void;
  onLeave: () => void;
}): React.JSX.Element {
  const { view, party, table, error, connected, send, emotes, sendEmote, addBot, removeBot } =
    useTable<CambioGameView>(tableId, 'cambio');

  /** Welche Zurufe mir gehoeren — dieselbe Frage wie an den anderen Tischen. */
  const [meineEmotes, setMeineEmotes] = useState<Set<string>>(new Set());
  const [zeigeEmoteHinweis, setZeigeEmoteHinweis] = useState(false);
  useEffect(() => {
    void api
      .shop()
      .then((s) =>
        setMeineEmotes(
          new Set(s.tischware.filter((w) => w.art === 'emote' && w.besessen).map((w) => w.wert)),
        ),
      )
      .catch(() => undefined);
  }, []);

  /**
   * Die Abrechnung von Hand geschlossen?
   *
   * Wie lange sie steht, bestimmt die SCHAUPAUSE des Servers, nicht ein Timer
   * hier: Solange die Runde in Phase 'finished' liegt, laeuft die Pause. Wer
   * sie wegtippt, spielt fuer sich weiter - der Tisch geht trotzdem erst
   * weiter, wenn die Zeit um ist.
   */
  const [abrechnungWeg, setAbrechnungWeg] = useState(false);

  /**
   * Erster Tipp beim Blindtausch.
   *
   * Der Bube tauscht ZWEI Plaetze, also braucht die Aktion zwei Ziele. Der
   * erste Tipp wird hier gemerkt, der zweite schickt das fertige Paar. Ohne
   * diesen Zwischenschritt liesse sich der Bube ueberhaupt nicht spielen -
   * ein Tipp allein passt auf keine erlaubte Aktion.
   */
  const [ersterTipp, setErsterTipp] = useState<CambioTarget | null>(null);

  const round: CambioRoundView | null = view?.view.round ?? null;
  const zeigeAbrechnung = round?.phase === 'finished' && !!round.result && !abrechnungWeg;

  // Beginnt eine neue Runde, ist das Blatt wieder frisch.
  useEffect(() => {
    if (round?.phase !== 'finished') setAbrechnungWeg(false);
  }, [round?.phase]);

  // Endet die Aktion, ist auch die halbe Auswahl hinfaellig.
  useEffect(() => {
    if (round?.pendingAction !== 'blindSwap') setErsterTipp(null);
  }, [round?.pendingAction]);

  const nameOf = (seat: number): string => {
    const eintrag = table?.seats.find((s) => s.seat === seat);
    return eintrag?.displayName ?? `Bot ${seat + 1}`;
  };

  const accountOf = (seat: number): string | null | undefined =>
    table?.seats.find((s) => s.seat === seat)?.accountId;

  const spielerName = (
    text: string,
    accountId: string | null | undefined,
  ): React.JSX.Element =>
    accountId ? (
      <button className="spielername" onClick={() => onShowProfile(accountId)}>
        {text}
      </button>
    ) : (
      <span>{text}</span>
    );

  // Wartebereich, solange der Tisch nicht voll ist.
  if (!view && table && table.status === 'waiting') {
    return (
      <Wartebereich
        tableId={tableId}
        table={table}
        error={error}
        spielerName={spielerName}
        addBot={addBot}
        removeBot={removeBot}
        onLeave={onLeave}
      />
    );
  }

  if (!view || !connected) {
    return (
      <div className="doko">
        <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />
        <Ladekreis text={error ?? 'Verbinde mit dem Tisch…'} />
      </div>
    );
  }

  if (view.view.finished) {
    return (
      <PartyEnd
        view={view}
        party={party}
        nameOf={nameOf}
        spielerName={spielerName}
        onLeave={onLeave}
      />
    );
  }

  if (!round) {
    return (
      <div className="doko">
        <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />
        <Ladekreis text="Neue Runde…" />
      </div>
    );
  }

  const meinSitz = round.seat;
  const sitzzahl = round.seats.length;

  return (
    <div className="doko doko--cambio">
      <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />

      <header className="doko-top">
        <button className="doko-icon" onClick={onLeave} aria-label="Zurück">
          ‹
        </button>
        <div className="doko-titel">
          <strong>
            Runde {view.view.roundIndex + 1} / {view.view.totalRounds}
          </strong>
          <span className="muted">{phasenText(round, meinSitz)}</span>
        </div>
        <span className="doko-icon is-leer" aria-hidden="true" />
      </header>

      <div className="doko-felt cambio-felt">
        {/* Mitspieler ringsum, jeder mit seinen vier Plaetzen. */}
        {round.seats
          .filter((seat) => seat !== meinSitz)
          .map((seat) => (
            <SitzPlatz
              key={seat}
              seat={seat}
              slot={slotFor(seat, meinSitz ?? 0, sitzzahl)}
              round={round}
              deck={deck}
              name={nameOf(seat)}
              accountId={accountOf(seat)}
              deadline={view.turnDeadline ?? null}
              onShowProfile={onShowProfile}
              onTarget={(index) =>
                zielWaehlen(round, send, { seat, index }, ersterTipp, setErsterTipp)
              }
              emote={emotes[seat] ?? null}
            />
          ))}

        {/* Stapel in der Mitte: verdeckt links, offen rechts. */}
        <div className="cambio-mitte">
          <button
            className="cambio-stapel cambio-stapel--verdeckt"
            disabled={!erlaubt(round, 'drawStock')}
            onClick={() => sende(round, send, 'drawStock')}
            aria-label={`Nachziehstapel, ${round.stockCount} Karten`}
          >
            <CardBack deck={deck} />
            <span className="cambio-stapel-zahl">{round.stockCount}</span>
          </button>

          <div className="cambio-stapel cambio-stapel--offen" aria-label="Ablagestapel">
            <CardFront card={round.topDiscard} deck={deck} />
          </div>
        </div>

        {/* Die gezogene Karte liegt gross vor einem und will eingesetzt werden. */}
        {round.drawn && (
          <div className="cambio-gezogen">
            <span className="cambio-gezogen-hinweis">Gezogen</span>
            <CardFront card={round.drawn} deck={deck} />
          </div>
        )}

        {round.caller !== null && (
          <div className="cambio-ruf">
            <strong>Cambio!</strong>
            <span>
              {nameOf(round.caller)} hat gerufen — noch{' '}
              {offeneZuege(round) === 1 ? 'ein Zug' : `${offeneZuege(round)} Züge`}
            </span>
          </div>
        )}
      </div>

      {/* Eigener Sitz: vier Plaetze, antippbar wenn ein Ziel gesucht wird. */}
      {meinSitz !== null && (
        <div className="cambio-eigene">
          <div className="cambio-eigene-kopf">
            <Avatar
              name={nameOf(meinSitz)}
              seatIndex={meinSitz}
              active={round.isMyTurn}
              deadline={view.turnDeadline ?? null}
              you
              avatarUrl={table?.seats.find((s) => s.seat === meinSitz)?.avatarUrl ?? null}
            />
            <div className="cambio-eigene-text">
              <strong>{nameOf(meinSitz)}</strong>
              <span className="muted">{punkteText(view.view.scores, meinSitz)}</span>
            </div>
            <TurnClock deadline={round.isMyTurn ? (view.turnDeadline ?? null) : null} />
          </div>

          <div className="cambio-plaetze">
            {round.hands[meinSitz]?.map((slot) => (
              <PlatzKarte
                key={slot.index}
                slot={slot}
                deck={deck}
                waehlbar={istZiel(round, meinSitz, slot.index)}
                gewaehlt={
                  !!ersterTipp && ersterTipp.seat === meinSitz && ersterTipp.index === slot.index
                }
                onClick={() =>
                  zielWaehlen(
                    round,
                    send,
                    { seat: meinSitz, index: slot.index },
                    ersterTipp,
                    setErsterTipp,
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Die Schaltflaechen des Zuges. */}
      <div className="cambio-aktionen">
        <Aktionsleiste
          round={round}
          send={send}
          ersterTipp={ersterTipp}
          onAuswahlZurueck={() => setErsterTipp(null)}
        />
      </div>

      {/* Zurufe nur fuer Mitspieler — dieselbe Regel wie an den anderen Tischen. */}
      {meinSitz !== null && (
        <EmoteLeiste
          besessen={meineEmotes}
          onSenden={sendEmote}
          onKaufen={() => setZeigeEmoteHinweis(true)}
        />
      )}
      {meinSitz !== null && emotes[meinSitz] && <EmoteBlase emote={emotes[meinSitz]!} />}

      {zeigeEmoteHinweis && (
        <div className="doko-sheet" onClick={() => setZeigeEmoteHinweis(false)}>
          <div className="doko-sheet-card" onClick={(e) => e.stopPropagation()}>
            <h2>Zurufe</h2>
            <p className="muted">Weitere Zurufe gibt es im Shop.</p>
            <button className="primary" onClick={() => setZeigeEmoteHinweis(false)}>
              Alles klar
            </button>
          </div>
        </div>
      )}

      {zeigeAbrechnung && round.result && (
        <Rundenblatt
          round={round}
          view={view.view}
          deck={deck}
          nameOf={nameOf}
          onClose={() => setAbrechnungWeg(true)}
        />
      )}

      {error && <p className="doko-fehler">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hilfen auf der Sicht
//
// Alle fragen ausschliesslich `round.legal` - der Client entscheidet nie
// selbst, was erlaubt ist.
// ---------------------------------------------------------------------------

function erlaubt(round: CambioRoundView, type: string): boolean {
  return round.legal.some((a) => a.type === type);
}

function sende(
  round: CambioRoundView,
  send: (action: Action) => void,
  type: string,
): void {
  const action = round.legal.find((a) => a.type === type);
  if (action) send(action);
}

/**
 * Ist dieser Platz gerade ein zulaessiges Ziel?
 *
 * Beim Blindtausch zaehlt jeder Platz, der in irgendeinem erlaubten Paar
 * vorkommt - welches Paar es wird, entscheidet erst der zweite Tipp.
 */
function istZiel(round: CambioRoundView, seat: number, index: number): boolean {
  const ziel = { seat, index };
  return round.legal.some(
    (a) =>
      (a.type === 'resolveAction' && zieleVon(a).some((t) => gleich(t, ziel))) ||
      (a.type === 'swap' && a.seat === seat && a.index === index) ||
      (a.type === 'takeDiscard' && a.seat === seat && a.index === index),
  );
}

function gleich(a: CambioTarget, b: CambioTarget): boolean {
  return a.seat === b.seat && a.index === b.index;
}

/** Die Ziele einer Aktion, oder eine leere Liste. */
function zieleVon(action: Action): CambioTarget[] {
  return (action.targets as CambioTarget[] | undefined) ?? [];
}

/**
 * Einen Platz antippen.
 *
 * Was das bedeutet, haengt am Schritt: In `decide` ist es ein Tausch, in
 * `action` ein Aktionsziel, sonst das Nehmen vom Ablagestapel. Statt das im
 * Client zu verzweigen, wird die passende erlaubte Aktion gesucht - so bleibt
 * die Regelhoheit beim Server.
 *
 * Einzige Ausnahme ist der Blindtausch: Er braucht zwei Ziele, also muss der
 * erste Tipp irgendwo stehen, bis der zweite kommt.
 */
function zielWaehlen(
  round: CambioRoundView,
  send: (action: Action) => void,
  ziel: CambioTarget,
  erster: CambioTarget | null,
  setErster: (t: CambioTarget | null) => void,
): void {
  if (round.phase === 'decide') {
    const a = round.legal.find(
      (x) => x.type === 'swap' && x.seat === ziel.seat && x.index === ziel.index,
    );
    if (a) send(a);
    return;
  }

  if (round.phase === 'action') {
    if (round.pendingAction === 'blindSwap') {
      if (!erster) {
        setErster(ziel);
        return;
      }
      if (gleich(erster, ziel)) {
        // Denselben Platz zweimal antippen nimmt die Auswahl zurueck.
        setErster(null);
        return;
      }
      const paar = round.legal.find((x) => {
        if (x.type !== 'resolveAction') return false;
        const z = zieleVon(x);
        return (
          z.length === 2 &&
          ((gleich(z[0]!, erster) && gleich(z[1]!, ziel)) ||
            (gleich(z[0]!, ziel) && gleich(z[1]!, erster)))
        );
      });
      if (paar) send(paar);
      setErster(null);
      return;
    }

    const a = round.legal.find(
      (x) => x.type === 'resolveAction' && zieleVon(x).length === 1 && gleich(zieleVon(x)[0]!, ziel),
    );
    if (a) send(a);
    return;
  }

  const a = round.legal.find(
    (x) => x.type === 'takeDiscard' && x.seat === ziel.seat && x.index === ziel.index,
  );
  if (a) send(a);
}

/** Wie viele Sitze nach dem Ruf noch dran sind. */
function offeneZuege(round: CambioRoundView): number {
  if (round.caller === null) return 0;
  return round.seats.filter(
    (seat) => seat !== round.caller && !round.afterCall.includes(seat),
  ).length;
}

function punkteText(scores: Record<number, number>, seat: number): string {
  const p = scores[seat] ?? 0;
  return `${p} Punkt${p === 1 ? '' : 'e'}`;
}

/** Was gerade zu tun ist, in einem Satz. */
function phasenText(round: CambioRoundView, meinSitz: number | null): string {
  if (round.phase === 'finished') return 'Aufgedeckt';
  if (!round.isMyTurn) return `${round.turn === meinSitz ? 'Du' : 'Mitspieler'} ist am Zug`;

  switch (round.phase) {
    case 'turn':
      return 'Ziehen, nehmen oder Cambio rufen';
    case 'decide':
      return 'Tauschen oder abwerfen';
    case 'action':
      return aktionsText(round);
    default:
      return '';
  }
}

function aktionsText(round: CambioRoundView): string {
  switch (round.pendingAction) {
    case 'peekOwn':
      return 'Eine eigene Karte ansehen';
    case 'peekOther':
      return 'Eine fremde Karte ansehen';
    case 'blindSwap':
      return 'Zwei Karten blind tauschen';
    case 'lookAndSwap':
      return round.lookedAt ? 'Tauschen oder verzichten' : 'Eine fremde Karte ansehen';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/** Eine Karte an einem Platz: offen, wenn bekannt, sonst Rückseite. */
function PlatzKarte({
  slot,
  deck,
  waehlbar,
  gewaehlt,
  onClick,
}: {
  slot: CambioSlot;
  deck: Deck;
  waehlbar: boolean;
  /** Beim Blindtausch bereits als erste Karte angetippt. */
  gewaehlt?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={`cambio-platz${waehlbar ? ' is-waehlbar' : ''}${slot.card ? ' is-bekannt' : ''}${
        gewaehlt ? ' is-gewaehlt' : ''
      }`}
      disabled={!waehlbar}
      onClick={onClick}
      aria-label={slot.card ? undefined : `Verdeckter Platz ${slot.index + 1}`}
    >
      {slot.card ? <CardFront card={slot.card} deck={deck} /> : <CardBack deck={deck} />}
    </button>
  );
}

/** Ein Mitspieler mit seinen vier Plätzen. */
function SitzPlatz({
  seat,
  slot,
  round,
  deck,
  name,
  accountId,
  deadline,
  onShowProfile,
  onTarget,
  emote,
}: {
  seat: number;
  slot: string;
  round: CambioRoundView;
  deck: Deck;
  name: string;
  accountId: string | null | undefined;
  deadline: number | null;
  onShowProfile: (accountId: string) => void;
  onTarget: (index: number) => void;
  emote: string | null;
}): React.JSX.Element {
  const dran = round.turn === seat && round.phase !== 'finished';
  const fertig = round.caller !== null && round.afterCall.includes(seat);

  return (
    <div className={`doko-opp at-${slot}${dran ? ' is-active' : ''}`}>
      <Avatar
        name={name}
        seatIndex={seat}
        active={dran}
        deadline={deadline}
        isBot={!accountId}
      />
      <div className="doko-opp-name">
        {accountId ? (
          <button className="spielername" onClick={() => onShowProfile(accountId)}>
            {name}
          </button>
        ) : (
          <span>{name}</span>
        )}
        {round.caller === seat && <em className="doko-tag">Cambio</em>}
        {fertig && <em className="doko-tag">fertig</em>}
      </div>
      <div className="cambio-plaetze cambio-plaetze--fremd">
        {round.hands[seat]?.map((s) => (
          <PlatzKarte
            key={s.index}
            slot={s}
            deck={deck}
            waehlbar={istZiel(round, seat, s.index)}
            onClick={() => onTarget(s.index)}
          />
        ))}
      </div>
      {emote && <EmoteBlase emote={emote} />}
    </div>
  );
}

/**
 * Die Schaltflächen des Zuges.
 *
 * Beim Blindtausch braucht es zwei Ziele. Der erste Tipp wird hier gemerkt,
 * der zweite schickt die fertige Aktion — deshalb hat diese Leiste als
 * einzige Stelle einen eigenen Zustand.
 */
function Aktionsleiste({
  round,
  send,
  ersterTipp,
  onAuswahlZurueck,
}: {
  round: CambioRoundView;
  send: (action: Action) => void;
  /** Beim Blindtausch der bereits angetippte Platz. */
  ersterTipp: CambioTarget | null;
  onAuswahlZurueck: () => void;
}): React.JSX.Element | null {
  if (!round.isMyTurn) return null;

  if (round.phase === 'turn') {
    return (
      <>
        {erlaubt(round, 'callCambio') && (
          <button className="cambio-knopf is-ruf" onClick={() => sende(round, send, 'callCambio')}>
            Cambio rufen
          </button>
        )}
        <span className="cambio-hinweis">
          Stapel antippen zum Ziehen, eigenen Platz für die offene Karte
        </span>
      </>
    );
  }

  if (round.phase === 'decide') {
    return (
      <>
        <button className="cambio-knopf" onClick={() => sende(round, send, 'discardDrawn')}>
          Abwerfen
        </button>
        <span className="cambio-hinweis">oder einen eigenen Platz antippen zum Tauschen</span>
      </>
    );
  }

  if (round.phase === 'action') {
    if (round.pendingAction === 'blindSwap') {
      return <BlindtauschLeiste erster={ersterTipp} onZurueck={onAuswahlZurueck} />;
    }
    return (
      <>
        {erlaubt(round, 'skipAction') && (
          <button className="cambio-knopf" onClick={() => sende(round, send, 'skipAction')}>
            Nicht tauschen
          </button>
        )}
        <span className="cambio-hinweis">{aktionsText(round)}</span>
      </>
    );
  }

  return null;
}

/**
 * Blindtausch: zwei Ziele nacheinander.
 *
 * Die zulässigen Paare stehen fertig in `legal`; hier wird nur gemerkt, was
 * zuerst angetippt wurde, und beim zweiten Tipp das passende Paar gesucht.
 */
function BlindtauschLeiste({
  erster,
  onZurueck,
}: {
  erster: CambioTarget | null;
  onZurueck: () => void;
}): React.JSX.Element {
  return (
    <>
      <span className="cambio-hinweis">
        {erster
          ? 'Erste Karte gewählt — jetzt die zweite antippen'
          : 'Zwei Karten antippen, die getauscht werden sollen'}
      </span>
      {erster && (
        <button className="cambio-knopf" onClick={onZurueck}>
          Auswahl zurücknehmen
        </button>
      )}
    </>
  );
}

/** Abrechnung nach einer Runde: alle Hände offen, dazu die Punktetafel. */
function Rundenblatt({
  round,
  view,
  deck,
  nameOf,
  onClose,
}: {
  round: CambioRoundView;
  view: CambioGameView;
  deck: Deck;
  nameOf: (seat: number) => string;
  onClose: () => void;
}): React.JSX.Element {
  const r = round.result!;

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card cambio-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>Aufgedeckt</h2>
        {r.caller !== null && (
          <p className={r.callSucceeded ? 'cambio-ruf-gut' : 'cambio-ruf-schlecht'}>
            {nameOf(r.caller)} rief Cambio —{' '}
            {r.callSucceeded ? 'und lag vorn: null Punkte.' : 'daneben, plus Strafpunkte.'}
          </p>
        )}

        <ol className="cambio-abrechnung">
          {round.seats
            .slice()
            .sort((a, b) => (r.scores[a] ?? 0) - (r.scores[b] ?? 0))
            .map((seat) => (
              <li key={seat}>
                <span className="cambio-abrechnung-name">{nameOf(seat)}</span>
                <span className="cambio-abrechnung-karten">
                  {(r.hands[seat] ?? []).map((card: Card) => (
                    <CardFront card={card} deck={deck} key={card.id} />
                  ))}
                </span>
                <span className="cambio-abrechnung-punkte">
                  {r.scores[seat]}
                  {r.scores[seat] !== r.raw[seat] && (
                    <em className="muted"> (statt {r.raw[seat]})</em>
                  )}
                </span>
              </li>
            ))}
        </ol>

        <h3>Gesamtstand</h3>
        <ol className="cambio-tafel">
          {round.seats
            .slice()
            .sort((a, b) => (view.scores[a] ?? 0) - (view.scores[b] ?? 0))
            .map((seat) => (
              <li key={seat}>
                <span>{nameOf(seat)}</span>
                <span>{view.scores[seat] ?? 0}</span>
              </li>
            ))}
        </ol>
        <p className="muted">Wenig ist gut — es gewinnt, wer am Ende am wenigsten hat.</p>

        <button className="primary" onClick={onClose}>
          Weiter
        </button>
      </div>
    </div>
  );
}
