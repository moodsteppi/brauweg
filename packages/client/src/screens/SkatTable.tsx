import { useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { CardFront } from '../CardFace';
import { Ladekreis } from '../Ladekreis';
import type { Deck } from '../decks';
import { szeneBild } from '../szenen';
import { EmoteBlase, EmoteLeiste } from '../tisch/emote';
import type { Card, SkatGameView, SkatRoundView } from '../protocol';
import {
  Avatar,
  HandCard,
  LetzterStich,
  PartyEnd,
  RegelBlatt,
  Ruecken,
  StichStapel,
  TurnClock,
  Wartebereich,
  istSeitlich,
  slotFor,
} from '../tisch';
import { useTable } from '../useTable';

/**
 * Der Skat-Tisch.
 *
 * Skat laeuft in Abschnitten, die es sonst nirgends gibt: erst das Reizen (wer
 * spielt und zu welchem Wert), dann die Skatwahl (aufnehmen oder Hand), das
 * Druecken zweier Karten, die Ansage der Spielart, und erst dann der Stich.
 * Der Tisch fuehrt Schritt fuer Schritt durch diese Abschnitte.
 *
 * Wie ueberall gilt: Der Client bildet keine Regel nach. Die Knoepfe des
 * Reizens, der Skatwahl und von Kontra/Re entstehen aus `round.aktionen`; die
 * spielbaren Karten stehen in `round.legal`; welche Karte sticht, sagt
 * `round.trumpfKeys`. Der Client rechnet nichts davon selbst aus.
 */
const FARBEN: { spiel: string; name: string; zeichen: string }[] = [
  { spiel: 'C', name: 'Kreuz', zeichen: '♣' },
  { spiel: 'S', name: 'Pik', zeichen: '♠' },
  { spiel: 'H', name: 'Herz', zeichen: '♥' },
  { spiel: 'D', name: 'Karo', zeichen: '♦' },
];

function spielName(gt: { kind: string; trump?: string } | null): string {
  if (!gt) return '';
  if (gt.kind === 'grand') return 'Grand';
  if (gt.kind === 'null') return 'Null';
  if (gt.kind === 'ramsch') return 'Ramsch';
  if (gt.kind === 'suit') return FARBEN.find((f) => f.spiel === gt.trump)?.name ?? 'Farbe';
  return '';
}

export function SkatTable({
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
    useTable<SkatGameView>(tableId, 'skat');

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

  /** Beim Druecken vorgemerkte Karten (genau zwei). */
  const [gedrueckt, setGedrueckt] = useState<number[]>([]);
  /** Abrechnung von Hand geschlossen. Die Pause selbst steuert der Server. */
  const [abrechnungWeg, setAbrechnungWeg] = useState(false);
  const [zeigeRegeln, setZeigeRegeln] = useState(false);
  const [zeigeLetzten, setZeigeLetzten] = useState(false);

  const round: SkatRoundView | null = view?.view.round ?? null;

  useEffect(() => {
    if (round?.phase !== 'druecken') setGedrueckt([]);
  }, [round?.phase]);
  useEffect(() => {
    if (round?.phase !== 'vorbei') setAbrechnungWeg(false);
  }, [round?.phase]);

  /*
   * Der volle Stich muss kurz liegen bleiben, bevor er verschwindet — sonst
   * sieht man die entscheidende dritte Karte nie: Der Server rechnet den Stich
   * in derselben Aktion ab, in der die dritte Karte faellt, und schickt `trick`
   * schon leer mit gefuelltem `lastTrick`. Genau wie am Doppelkopftisch wird
   * der letzte Stich deshalb hier noch anderthalb Sekunden weitergezeigt.
   * `seenKey` verhindert das Aufblitzen beim Beitritt mitten in einer Gabe.
   */
  const lastTrick = view?.view.round?.lastTrick ?? null;
  const lastKey = lastTrick ? lastTrick.played.map((p) => p.card.id).join('.') : null;
  const [frozenKey, setFrozenKey] = useState<string | null>(null);
  const seenKey = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (seenKey.current === undefined) {
      seenKey.current = lastKey;
      return;
    }
    if (lastKey && lastKey !== seenKey.current) {
      seenKey.current = lastKey;
      setFrozenKey(lastKey);
      const handle = setTimeout(() => setFrozenKey((k) => (k === lastKey ? null : k)), 1500);
      return () => clearTimeout(handle);
    }
  }, [lastKey]);

  const nameOf = (seat: number): string =>
    table?.seats.find((s) => s.seat === seat)?.displayName ?? `Bot ${seat + 1}`;
  const accountOf = (seat: number): string | null | undefined =>
    table?.seats.find((s) => s.seat === seat)?.accountId;
  const spielerName = (text: string, accountId: string | null | undefined): React.JSX.Element =>
    accountId ? (
      <button className="spielername" onClick={() => onShowProfile(accountId)}>
        {text}
      </button>
    ) : (
      <span>{text}</span>
    );

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
      <PartyEnd view={view} party={party} nameOf={nameOf} spielerName={spielerName} onLeave={onLeave} />
    );
  }

  if (!round) {
    return (
      <div className="doko">
        <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />
        <Ladekreis text="Neue Gabe…" />
      </div>
    );
  }

  const meinSitz = round.seat;
  const gegner = [0, 1, 2].filter((s) => s !== meinSitz);
  const deadline = view.turnDeadline ?? null;
  const spielbar = new Set(round.legal.map((c) => c.id));
  const sticht = new Set(round.trumpfKeys);
  const kann = (typ: string): boolean => round.aktionen.includes(typ);
  const zeigeAbrechnung = round.phase === 'vorbei' && !!round.result && !abrechnungWeg;

  // Frisch abgeraeumter Stich: die drei Karten bleiben kurz liegen (siehe oben).
  const frozenActive = frozenKey !== null && frozenKey === lastKey && round.trick.length === 0;
  const trickAnzeige = frozenActive && lastTrick ? lastTrick.played : round.trick;
  const trickGewinner = frozenActive && lastTrick ? lastTrick.winner : null;

  const toggleDruecken = (id: number): void =>
    setGedrueckt((alt) =>
      alt.includes(id) ? alt.filter((x) => x !== id) : alt.length < 2 ? [...alt, id] : alt,
    );

  const hand = round.hand;

  return (
    <div className="doko doko--skat">
      <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />

      <header className="doko-top">
        <button className="doko-icon" onClick={onLeave} aria-label="Zurück">
          ‹
        </button>
        <div className="doko-titel">
          <strong>
            Gabe {view.view.roundIndex + 1} / {view.view.totalRounds}
            {view.view.bock > 1 && <span className="doko-bock"> · Bock ×{view.view.bock}</span>}
          </strong>
          <span className="muted">{phasenText(round, meinSitz)}</span>
        </div>
        <div className="doko-top-right">
          <button
            className="doko-icon"
            onClick={() => setZeigeLetzten(true)}
            disabled={!lastTrick}
            aria-label="Letzter Stich"
          >
            ↩
          </button>
          <button
            className="doko-icon"
            onClick={() => setZeigeRegeln(true)}
            aria-label="Tischregeln ansehen"
          >
            §
          </button>
        </div>
      </header>

      <div className="doko-felt seats-3">
        {gegner.map((seat) => (
          <GegnerSitz
            key={seat}
            slot={slotFor(seat, meinSitz, 3)}
            seat={seat}
            name={nameOf(seat)}
            accountId={accountOf(seat)}
            onShowProfile={onShowProfile}
            round={round}
            deck={deck}
            score={view.view.scores[seat] ?? 0}
            active={round.turn === seat && round.phase === 'stich'}
            reizAktiv={round.phase === 'reizen' && round.reiz.amZug === seat}
            deadline={round.turn === seat || round.reiz.amZug === seat ? deadline : null}
            emote={emotes[seat] ?? null}
          />
        ))}

        {/* Spielinfo in der Mitte: was gespielt wird und der Reizwert. */}
        <div className="doko-plakette skat-info">
          {round.gameType ? (
            <>
              <strong>{spielName(round.gameType)}</strong>
              {round.declarer !== null && (
                <span className="muted">
                  {nameOf(round.declarer)}
                  {round.reizWert > 0 && ` · gereizt bis ${round.reizWert}`}
                </span>
              )}
              {(round.kontra || round.re) && (
                <span className="skat-kontra">{round.re ? 'Re' : 'Kontra'}</span>
              )}
            </>
          ) : (
            <span className="muted">
              Reizen{round.reiz.wert > 0 ? ` · Stand ${round.reiz.wert}` : ''}
            </span>
          )}
        </div>

        <div className="doko-trick">
          {trickAnzeige.map((played) => (
            <div
              key={played.card.id}
              className={`doko-trick-card at-${slotFor(played.seat, meinSitz, 3)}${
                trickGewinner === played.seat ? ' is-winner' : ''
              }`}
            >
              <div className="pc pc--trick">
                <CardFront card={played.card} deck={deck} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offene Karten des Alleinspielers beim Ouvert (fuer die Gegner). */}
      {round.ouvertHand && round.ouvertHand.length > 0 && (
        <div className="skat-ouvert">
          <span className="muted">Offen:</span>
          {round.ouvertHand.map((c) => (
            <span className="pc pc--mini" key={c.id}>
              <CardFront card={c} deck={deck} />
            </span>
          ))}
        </div>
      )}

      {error && <p className="doko-error">{error}</p>}

      <div className="doko-me">
        <span className="doko-me-avatar">
          {emotes[meinSitz] && <EmoteBlase emote={emotes[meinSitz]!} />}
          <Avatar
            name={nameOf(meinSitz)}
            seatIndex={meinSitz}
            active={round.isMyTurn}
            deadline={round.isMyTurn ? deadline : null}
            avatarUrl={table?.seats.find((s) => s.seat === meinSitz)?.avatarUrl ?? null}
            you
          />
        </span>
        <div className="doko-me-info">
          <strong>{nameOf(meinSitz)}</strong>
          <span className="muted">
            {view.view.scores[meinSitz] ?? 0} Punkte · {round.augen[meinSitz] ?? 0} Augen
          </span>
        </div>
        <StichStapel count={round.trickCounts[meinSitz] ?? 0} />
        {round.isMyTurn && deadline !== null && <TurnClock deadline={deadline} />}
      </div>

      <div
        className="doko-hand"
        style={{ '--luecken': Math.max(1, hand.length - 1) } as React.CSSProperties}
      >
        {hand.map((card, index) => (
          <HandCard
            key={card.id}
            card={card}
            deck={deck}
            index={index}
            total={hand.length}
            playable={round.phase === 'stich' && round.isMyTurn && spielbar.has(card.id)}
            markable={round.phase === 'druecken' && round.isMyTurn}
            marked={gedrueckt.includes(card.id)}
            trump={sticht.has(`${card.suit}${card.rank}`)}
            onPlay={(id) => send({ type: 'karte', cardId: id })}
            onMark={toggleDruecken}
          />
        ))}
        {hand.length === 0 && <span className="muted">Keine Karten auf der Hand.</span>}
      </div>

      {/* Die Schaltflaechen des jeweiligen Abschnitts. */}
      <SkatAktionen
        round={round}
        kann={kann}
        gedrueckt={gedrueckt}
        send={send}
        onWeiter={() => {
          send({ type: 'weiter' });
          setAbrechnungWeg(true);
        }}
      />

      <EmoteLeiste
        besessen={meineEmotes}
        onSenden={sendEmote}
        onKaufen={() => setZeigeEmoteHinweis(true)}
      />

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
          scores={view.view.scores}
          nameOf={nameOf}
          onWeiter={() => {
            send({ type: 'weiter' });
            setAbrechnungWeg(true);
          }}
        />
      )}

      {zeigeRegeln && <RegelBlatt tableId={tableId} onClose={() => setZeigeRegeln(false)} />}

      {zeigeLetzten && lastTrick && (
        <LetzterStich
          played={lastTrick.played}
          winnerSeat={lastTrick.winner}
          nameOf={nameOf}
          deck={deck}
          onClose={() => setZeigeLetzten(false)}
        />
      )}
    </div>
  );
}

/** Was gerade zu tun ist, in einem Satz. */
function phasenText(round: SkatRoundView, meinSitz: number): string {
  if (round.phase === 'vorbei') return 'Abgerechnet';
  const dran = round.isMyTurn;
  switch (round.phase) {
    case 'reizen':
      return dran ? 'Du bist am Reizen' : 'Es wird gereizt';
    case 'skat':
      return dran ? 'Skat aufnehmen oder Hand spielen' : 'Der Alleinspieler entscheidet über den Skat';
    case 'druecken':
      return dran ? 'Zwei Karten drücken' : 'Der Alleinspieler drückt';
    case 'ansage':
      return dran ? 'Spielart ansagen' : 'Der Alleinspieler sagt an';
    case 'stich':
      return dran ? 'Du bist am Zug' : `${round.turn === meinSitz ? 'Du' : 'Mitspieler'} ist am Zug`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Schaltflaechen
// ---------------------------------------------------------------------------

function SkatAktionen({
  round,
  kann,
  gedrueckt,
  send,
  onWeiter,
}: {
  round: SkatRoundView;
  kann: (typ: string) => boolean;
  gedrueckt: number[];
  send: (action: unknown) => void;
  onWeiter: () => void;
}): React.JSX.Element | null {
  // Zwischenpause: nur "Weiter".
  if (round.phase === 'vorbei' && round.result) {
    return (
      <div className="skat-aktionen">
        <button className="primary" onClick={onWeiter}>
          Weiter
        </button>
      </div>
    );
  }

  if (!round.isMyTurn) return null;

  if (round.phase === 'reizen') {
    const weiterLabel =
      round.reiz.rolle === 'vh'
        ? 'Spiel nehmen (18)'
        : round.reiz.rolle === 'hoerer'
          ? `${round.reiz.wert} halten`
          : `${round.reiz.gebot ?? 18} sagen`;
    return (
      <div className="skat-aktionen">
        {kann('reizWeiter') && (
          <button className="primary" onClick={() => send({ type: 'reizWeiter' })}>
            {weiterLabel}
          </button>
        )}
        {kann('reizWeg') && (
          <button className="skat-knopf" onClick={() => send({ type: 'reizWeg' })}>
            Weg
          </button>
        )}
      </div>
    );
  }

  if (round.phase === 'skat') {
    return (
      <div className="skat-aktionen">
        {kann('skatNehmen') && (
          <button className="primary" onClick={() => send({ type: 'skatNehmen' })}>
            Skat aufnehmen
          </button>
        )}
        {kann('handSpielen') && (
          <button className="skat-knopf" onClick={() => send({ type: 'handSpielen' })}>
            Hand spielen
          </button>
        )}
      </div>
    );
  }

  if (round.phase === 'druecken') {
    return (
      <div className="skat-aktionen">
        <span className="skat-hinweis">
          {gedrueckt.length < 2
            ? `Noch ${2 - gedrueckt.length} Karte${gedrueckt.length === 1 ? '' : 'n'} wählen`
            : 'Zwei Karten gewählt'}
        </span>
        <button
          className="primary"
          disabled={gedrueckt.length !== 2}
          onClick={() => send({ type: 'druecken', cards: gedrueckt })}
        >
          Drücken
        </button>
      </div>
    );
  }

  if (round.phase === 'ansage') {
    return <AnsagePanel handSpiel={round.handSpiel} send={send} />;
  }

  if (round.phase === 'stich') {
    if (!kann('kontra') && !kann('re')) return null;
    return (
      <div className="skat-aktionen">
        {kann('kontra') && (
          <button className="skat-knopf" onClick={() => send({ type: 'kontra' })}>
            Kontra
          </button>
        )}
        {kann('re') && (
          <button className="skat-knopf" onClick={() => send({ type: 're' })}>
            Re
          </button>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Die Ansage: Spielart waehlen, im Handspiel dazu die Zusatzstufen. Der Server
 * prueft die Kombination erneut; verlangt Schwarz etwa Schneider, ergaenzt er
 * das selbst, deshalb schickt dieses Blatt nur, was angetippt wurde.
 */
function AnsagePanel({
  handSpiel,
  send,
}: {
  handSpiel: boolean;
  send: (action: unknown) => void;
}): React.JSX.Element {
  const [spiel, setSpiel] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [schneider, setSchneider] = useState(false);
  const [schwarz, setSchwarz] = useState(false);

  const istNull = spiel === 'null';
  // Zusatzstufen gibt es nur im Handspiel; bei Null nur Ouvert.
  const zusatzMoeglich = handSpiel && spiel !== null;

  return (
    <div className="skat-ansage">
      <div className="skat-ansage-arten">
        {FARBEN.map((f) => (
          <button
            key={f.spiel}
            className={`skat-art${spiel === f.spiel ? ' is-gewaehlt' : ''}`}
            onClick={() => setSpiel(f.spiel)}
          >
            <span className="skat-art-zeichen">{f.zeichen}</span>
            {f.name}
          </button>
        ))}
        <button
          className={`skat-art${spiel === 'grand' ? ' is-gewaehlt' : ''}`}
          onClick={() => setSpiel('grand')}
        >
          Grand
        </button>
        <button
          className={`skat-art${spiel === 'null' ? ' is-gewaehlt' : ''}`}
          onClick={() => setSpiel('null')}
        >
          Null
        </button>
      </div>

      {zusatzMoeglich && (
        <div className="skat-ansage-zusatz">
          {!istNull && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={schneider}
                  onChange={(e) => setSchneider(e.target.checked)}
                />
                Schneider
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={schwarz}
                  onChange={(e) => setSchwarz(e.target.checked)}
                />
                Schwarz
              </label>
            </>
          )}
          <label>
            <input type="checkbox" checked={ouvert} onChange={(e) => setOuvert(e.target.checked)} />
            Ouvert
          </label>
        </div>
      )}

      <button
        className="primary"
        disabled={spiel === null}
        onClick={() =>
          send({
            type: 'ansage',
            spiel,
            ouvert,
            schneider: istNull ? false : schneider,
            schwarz: istNull ? false : schwarz,
          })
        }
      >
        Ansagen
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function GegnerSitz({
  slot,
  seat,
  name,
  accountId,
  onShowProfile,
  round,
  deck,
  score,
  active,
  reizAktiv,
  deadline,
  emote,
}: {
  slot: string;
  seat: number;
  name: string;
  accountId: string | null | undefined;
  onShowProfile: (accountId: string) => void;
  round: SkatRoundView;
  deck: Deck;
  score: number;
  active: boolean;
  reizAktiv: boolean;
  deadline: number | null;
  emote: string | null;
}): React.JSX.Element {
  const istDeclarer = round.declarer === seat;
  return (
    <div className={`doko-opp at-${slot}${active || reizAktiv ? ' is-active' : ''}`}>
      <Avatar
        name={name}
        seatIndex={seat}
        active={active || reizAktiv}
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
        {round.dealer === seat && <em className="doko-tag">Geber</em>}
        {istDeclarer && <em className="doko-tag">Spieler</em>}
      </div>
      <Ruecken count={round.handCounts[seat] ?? 0} vertical={istSeitlich(slot as never)} deck={deck} />
      <div className="doko-opp-foot">
        <StichStapel count={round.trickCounts[seat] ?? 0} />
        <span className="doko-opp-score">{score}</span>
      </div>
      {emote && <EmoteBlase emote={emote} />}
    </div>
  );
}

/** Abrechnung einer Gabe: Spielart, Ausgang und die Punkte je Sitz. */
function Rundenblatt({
  round,
  scores,
  nameOf,
  onWeiter,
}: {
  round: SkatRoundView;
  scores: Record<number, number>;
  nameOf: (seat: number) => string;
  onWeiter: () => void;
}): React.JSX.Element {
  const r = round.result!;
  const istRamsch = r.gameType.kind === 'ramsch';

  return (
    <div className="doko-sheet" onClick={onWeiter}>
      <div className="doko-sheet-card skat-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>{spielName(r.gameType)}</h2>
        {istRamsch ? (
          <p className={r.durchmarsch !== null ? 'skat-gut' : 'skat-schlecht'}>
            {r.durchmarsch !== null
              ? `Durchmarsch von ${nameOf(r.durchmarsch)}.`
              : 'Der Augenreichste zahlt.'}
          </p>
        ) : (
          <p className={r.gewonnen ? 'skat-gut' : 'skat-schlecht'}>
            {r.declarer !== null && nameOf(r.declarer)}
            {r.gewonnen ? ' hat gewonnen' : ' hat verloren'}
            {r.ueberreizt && ' (überreizt)'}
            {r.schwarz ? ' · schwarz' : r.schneider ? ' · Schneider' : ''}
            {'. '}
            {r.declarer !== null && `${r.declarerAugen} Augen, Spielwert ${r.spielwert}.`}
          </p>
        )}

        <ol className="skat-abrechnung">
          {[0, 1, 2].map((seat) => (
            <li key={seat}>
              <span>{nameOf(seat)}</span>
              <span className={(r.punkte[seat] ?? 0) < 0 ? 'skat-minus' : undefined}>
                {(r.punkte[seat] ?? 0) > 0 ? `+${r.punkte[seat]}` : (r.punkte[seat] ?? 0)}
              </span>
            </li>
          ))}
        </ol>

        <h3>Gesamtstand</h3>
        <ol className="skat-tafel">
          {[0, 1, 2]
            .slice()
            .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
            .map((seat) => (
              <li key={seat}>
                <span>{nameOf(seat)}</span>
                <span>{scores[seat] ?? 0}</span>
              </li>
            ))}
        </ol>

        <button className="primary" onClick={onWeiter}>
          Weiter
        </button>
      </div>
    </div>
  );
}
