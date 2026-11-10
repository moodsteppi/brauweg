import { useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { CardFront } from '../CardFace';
import { Ladekreis } from '../Ladekreis';
import type { Deck } from '../decks';
import { szeneBild } from '../szenen';
import { EmoteBlase, EmoteLeiste } from '../tisch/emote';
import type { Card, SkatGameView, SkatReizZeile, SkatRoundView } from '../protocol';
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
import { t } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import { fehlenText, waehleZumDruecken } from '../tisch-auswahl';

/** Grenzen der Tischgroesse — dieselben wie am Doppelkopf- und Zaubertisch. */
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.45;
const ZOOM_STEP = 0.15;

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
// Nur Kennung und Zeichen: Der Name kommt beim Zeichnen aus `karte.farbe.*`.
// Ein fertiger Text auf Modulebene sprang beim Umstellen der Sprache nicht um.
const FARBEN: { spiel: string; zeichen: string }[] = [
  { spiel: 'C', zeichen: '♣' },
  { spiel: 'S', zeichen: '♠' },
  { spiel: 'H', zeichen: '♥' },
  { spiel: 'D', zeichen: '♦' },
];

const farbName = (farbe: string): string => t(`karte.farbe.${farbe}`);

function spielName(gt: { kind: string; trump?: string } | null): string {
  if (!gt) return '';
  if (gt.kind === 'grand') return t('skat.spiel.grand');
  if (gt.kind === 'saechsisch') return t('skat.spiel.saechsisch');
  if (gt.kind === 'null') return t('skat.spiel.null');
  if (gt.kind === 'ramsch') return t('skat.spiel.ramsch');
  if (gt.kind === 'suit') {
    return FARBEN.some((f) => f.spiel === gt.trump) ? farbName(gt.trump!) : t('skat.spiel.farbe');
  }
  return '';
}

/** Name einer Ansagekennung, wie sie im Reizrechner steht. */
function ansageName(spiel: string): string {
  if (spiel === 'grand') return t('skat.spiel.grand');
  if (spiel === 'saechsisch') return t('skat.spiel.saechsischKurz');
  if (spiel === 'null') return t('skat.spiel.null');
  return FARBEN.some((f) => f.spiel === spiel) ? farbName(spiel) : spiel;
}

/** Ganzer Name je Patrouille: „Schwarze Patrouille" ist im Englischen „Black patrol". */
function patrouilleName(p: string): string {
  return p === 'schwarz' || p === 'rot' ? t(`skat.patrouille.${p}`) : p;
}

/** Kurze Erklärung der gewählten Spielart (Fachwörter bleiben, siehe `i18n/en/skat.ts`). */
function spielErklaerung(spiel: string): string {
  if (spiel === 'grand' || spiel === 'saechsisch' || spiel === 'null') {
    return t(`skat.erklaerung.${spiel}`);
  }
  return t('skat.erklaerung.farbe');
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
  const { view, party, table, error, connected, send, emotes, sendEmote, addBot, removeBot, setBotLevel } =
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

  /** Beim Druecken oder Schieben vorgemerkte Karten (genau zwei). */
  const [gedrueckt, setGedrueckt] = useState<number[]>([]);
  /** Abrechnung von Hand geschlossen. Die Pause selbst steuert der Server. */
  const [abrechnungWeg, setAbrechnungWeg] = useState(false);

  // Tischgroesse: skaliert Hand- und Stichkarten. Am Geraet gespeichert, weil
  // sie von Augen und Bildschirm abhaengt, nicht vom Konto — derselbe
  // Schluessel wie am Doppelkopftisch, es ist dieselbe Vorliebe.
  const [zoom, setZoom] = useState<number>(() => {
    const raw = Number(localStorage.getItem('tischZoom'));
    return raw >= ZOOM_MIN && raw <= ZOOM_MAX ? raw : 1;
  });
  const changeZoom = (delta: number): void => {
    const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + delta)) * 100) / 100;
    setZoom(next);
    localStorage.setItem('tischZoom', String(next));
  };

  const [zeigeRegeln, setZeigeRegeln] = useState(false);
  const [zeigeLetzten, setZeigeLetzten] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);

  const togglePause = (): void => {
    if (!table || pauseBusy) return;
    setPauseBusy(true);
    const call = table.paused ? api.resumeTable(tableId) : api.pauseTable(tableId);
    void call.catch(() => undefined).finally(() => setPauseBusy(false));
  };

  const round: SkatRoundView | null = view?.view.round ?? null;

  // Die Vormerkung gilt genau fuer den Abschnitt, in dem sie entstand: Wer
  // zwei Karten zum Druecken gewaehlt hat, soll sie nicht beim Schieben der
  // naechsten Gabe wiederfinden.
  useEffect(() => {
    if (round?.phase !== 'druecken' && round?.phase !== 'schieben') setGedrueckt([]);
  }, [round?.phase]);
  // Beim Schieberamsch wandert der Skat weiter: Mit dem Sitz faellt auch die
  // Vormerkung. Der Effekt haengt am Sitz und nicht an der Sicht — sonst liefe
  // er bei jedem Serverfunk neu.
  useEffect(() => setGedrueckt([]), [round?.schiebenSitz]);
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

  /*
   * Vorklicken (Premove): Wer nicht am Zug ist, kann seine Karte schon
   * antippen; sie fliegt von selbst, sobald er dran ist. Genau wie am
   * Doppelkopftisch — gerade am Handy spart das die Warterei auf die Bots.
   * `legalKey` ist erst gefuellt, wenn der Sitz wirklich am Zug ist (die Sicht
   * liefert `legal` nur dann), also loest der Effekt exakt im richtigen Moment
   * aus. Ist die vorgemerkte Karte dann nicht bedienbar, verfaellt sie.
   */
  const [vorgemerkt, setVorgemerkt] = useState<number | null>(null);
  const stichPhase = view?.view.round?.phase === 'stich';
  const legalKey =
    stichPhase && view?.view.round?.isMyTurn
      ? (view?.view.round?.legal ?? []).map((c) => c.id).join('.')
      : '';
  useEffect(() => {
    if (!stichPhase) setVorgemerkt(null);
  }, [stichPhase]);
  useEffect(() => {
    if (vorgemerkt === null || legalKey === '') return;
    const spielbar = new Set(legalKey.split('.').map(Number));
    if (spielbar.has(vorgemerkt)) send({ type: 'karte', cardId: vorgemerkt });
    setVorgemerkt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorgemerkt, legalKey]);

  const nameOf = (seat: number): string =>
    table?.seats.find((s) => s.seat === seat)?.displayName ?? tf('skat.bot', { nummer: seat + 1 });
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
        setBotLevel={setBotLevel}
        onLeave={onLeave}
      />
    );
  }

  if (!view || !connected) {
    return (
      <div className="doko">
        <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />
        <Ladekreis text={error ?? t('skat.verbinde')} />
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
        <Ladekreis text={t('skat.neueGabe')} />
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

  // Frisch abgeraeumter Stich: die Karten bleiben kurz liegen (siehe oben).
  const frozenActive = frozenKey !== null && frozenKey === lastKey && round.trick.length === 0;
  const trickAnzeige = frozenActive && lastTrick ? lastTrick.played : round.trick;
  const trickGewinner = frozenActive && lastTrick ? lastTrick.winner : null;

  // Die Regel selbst steht geprueft in tisch-auswahl.ts - hier bleibt nur das
  // Anstossen des Zustands.
  const toggleDruecken = (id: number): void => setGedrueckt((alt) => waehleZumDruecken(alt, id));
  const toggleVormerken = (id: number): void =>
    setVorgemerkt((v) => (v === id ? null : id));

  // Zwei Arten, eine Karte anzutippen, ohne sie sofort zu spielen: beim
  // Druecken/Schieben die Wegwerf-Auswahl, im Stich das Vorklicken, wenn man
  // noch nicht dran ist.
  const imDruecken =
    round.isMyTurn &&
    (round.phase === 'druecken' ||
      (round.phase === 'schieben' && round.schiebenAufgenommen));
  const darfVormerken = round.phase === 'stich' && !round.isMyTurn;

  const hand = round.hand;

  return (
    <div className="doko doko--skat" style={{ '--zoom': zoom } as React.CSSProperties}>
      <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />

      <header className="doko-top">
        <button className="doko-icon" onClick={onLeave} aria-label={t('skat.zurueck')}>
          ‹
        </button>
        <div className="doko-top-mid">
          <strong>
            {tf('skat.gabe', { nummer: view.view.roundIndex + 1, gesamt: view.view.totalRounds })}
            {view.view.bock > 1 && (
              <span className="doko-bock">{tf('skat.bock', { faktor: view.view.bock })}</span>
            )}
          </strong>
          <span className="muted">{phasenText(round, meinSitz)}</span>
        </div>
        {/* Dieselben Werkzeuge wie am Doppelkopftisch: Sie fehlten hier
            schlicht, nicht weil Skat sie nicht braeuchte. */}
        {table?.paused && <span className="doko-badge doko-badge--pause">{t('skat.pausiert')}</span>}
        {table?.visibility === 'club_only' && (
          <button
            className="doko-icon"
            onClick={togglePause}
            disabled={pauseBusy}
            aria-label={t(table.paused ? 'skat.tischFortsetzen' : 'skat.tischPausieren')}
            title={t(table.paused ? 'skat.fortsetzen' : 'skat.pausieren')}
          >
            {table.paused ? '▶' : '❚❚'}
          </button>
        )}
        <button
          className="doko-icon"
          onClick={() => setZeigeLetzten(true)}
          disabled={!round.lastTrick}
          aria-label={t('skat.letzterStich')}
        >
          ⟲
        </button>
        <button
          className="doko-icon"
          onClick={() => setZeigeRegeln(true)}
          aria-label={t('skat.regeln')}
        >
          §
        </button>
        <button
          className="doko-icon"
          onClick={() => changeZoom(-ZOOM_STEP)}
          disabled={zoom <= ZOOM_MIN}
          aria-label={t('skat.kleiner')}
        >
          −
        </button>
        <button
          className="doko-icon"
          onClick={() => changeZoom(ZOOM_STEP)}
          disabled={zoom >= ZOOM_MAX}
          aria-label={t('skat.groesser')}
        >
          +
        </button>
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
                  {round.reizWert > 0 && tf('skat.gereizt', { wert: round.reizWert })}
                </span>
              )}
              {round.patrouillen.length > 0 && (
                <span className="muted">
                  {round.patrouillen.map(patrouilleName).join(' + ')}
                </span>
              )}
              {(round.kontra || round.re || round.hirsch) && (
                <span className="skat-kontra">
                  {t(round.hirsch ? 'skat.hirsch' : round.re ? 'skat.re' : 'skat.kontra')}
                </span>
              )}
              {round.ramschFaktor > 1 && (
                <span className="skat-kontra">{tf('skat.blind', { faktor: round.ramschFaktor })}</span>
              )}
            </>
          ) : (
            <span className="muted">
              {round.reiz.wert > 0 ? tf('skat.reizenStand', { wert: round.reiz.wert }) : t('skat.reizen')}
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
          <span className="muted">{t('skat.offen')}</span>
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
            {tf('skat.punkteAugen', {
              punkte: view.view.scores[meinSitz] ?? 0,
              augen: round.augen[meinSitz] ?? 0,
            })}
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
            markable={imDruecken || darfVormerken}
            marked={imDruecken ? gedrueckt.includes(card.id) : vorgemerkt === card.id}
            trump={sticht.has(`${card.suit}${card.rank}`)}
            onPlay={(id) => send({ type: 'karte', cardId: id })}
            onMark={imDruecken ? toggleDruecken : toggleVormerken}
          />
        ))}
        {hand.length === 0 && <span className="muted">{t('skat.keineKarten')}</span>}
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
            <h2>{t('skat.zurufe')}</h2>
            <p className="muted">{t('skat.zurufe.shop')}</p>
            <button className="primary" onClick={() => setZeigeEmoteHinweis(false)}>
              {t('skat.zurufe.ok')}
            </button>
          </div>
        </div>
      )}

      {zeigeRegeln && <RegelBlatt tableId={tableId} onClose={() => setZeigeRegeln(false)} />}

      {zeigeLetzten && round.lastTrick && (
        <LetzterStich
          played={round.lastTrick.played}
          winnerSeat={round.lastTrick.winner}
          nameOf={nameOf}
          deck={deck}
          onClose={() => setZeigeLetzten(false)}
        />
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
    </div>
  );
}

/** Was gerade zu tun ist, in einem Satz. */
function phasenText(round: SkatRoundView, meinSitz: number): string {
  if (round.phase === 'vorbei') return t('skat.phase.vorbei');
  const dran = round.isMyTurn;
  switch (round.phase) {
    case 'reizen':
      return t(dran ? 'skat.phase.reizenDu' : 'skat.phase.reizen');
    case 'schieben':
      if (!dran) return t('skat.phase.schieben');
      return t(round.schiebenAufgenommen ? 'skat.phase.schiebenWeiter' : 'skat.phase.schiebenWahl');
    case 'skat':
      return t(dran ? 'skat.phase.skatDu' : 'skat.phase.skat');
    case 'druecken':
      return t(dran ? 'skat.phase.drueckenDu' : 'skat.phase.druecken');
    case 'ansage':
      return t(dran ? 'skat.phase.ansageDu' : 'skat.phase.ansage');
    case 'stich':
      // Vorher stand hier „Du ist am Zug", wenn der eigene Sitz dran war, die
      // Sicht aber noch nicht `isMyTurn` meldete — als ganzer Satz je Fall.
      return t(dran || round.turn === meinSitz ? 'skat.phase.stichDu' : 'skat.phase.stich');
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
          {t('skat.weiter')}
        </button>
      </div>
    );
  }

  // Der Reizrechner steht die ganze Reizphase offen, auch wenn man gerade nicht
  // am Zug ist: Man will die tragbaren Werte nachsehen koennen, bevor man dran
  // ist. Die eigentlichen Knoepfe (sagen/halten/weg) schalten sich darin ueber
  // `kann()` selbst frei — deshalb steht dieser Fall VOR der Zug-Sperre.
  if (round.phase === 'reizen') {
    return <ReizPanel round={round} kann={kann} send={send} />;
  }

  if (!round.isMyTurn) return null;

  if (round.phase === 'schieben') {
    if (!round.schiebenAufgenommen) {
      return (
        <div className="skat-aktionen">
          {kann('schiebenNehmen') && (
            <button className="primary" onClick={() => send({ type: 'schiebenNehmen' })}>
              {t('skat.skatAufnehmen')}
            </button>
          )}
          {kann('schiebenBlind') && (
            <button className="skat-knopf" onClick={() => send({ type: 'schiebenBlind' })}>
              {t('skat.blindSchieben')}
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="skat-aktionen">
        <span className="skat-hinweis">
          {fehlenText(gedrueckt.length) ?? t('skat.zweiGewaehlt')}
        </span>
        <button
          className="primary"
          disabled={gedrueckt.length !== 2}
          onClick={() => send({ type: 'schieben', cards: gedrueckt })}
        >
          {t('skat.weiterschieben')}
        </button>
      </div>
    );
  }

  if (round.phase === 'skat') {
    return (
      <div className="skat-aktionen">
        {kann('skatNehmen') && (
          <button className="primary" onClick={() => send({ type: 'skatNehmen' })}>
            {t('skat.skatAufnehmen')}
          </button>
        )}
        {kann('handSpielen') && (
          <button
            className="skat-knopf"
            onClick={() => send({ type: 'handSpielen' })}
            title={t('skat.erklaerung.hand')}
          >
            {t('skat.handSpielen')}
          </button>
        )}
        {/* Am Handy gibt es kein `title`: Was „Hand" heisst, steht deshalb
            sichtbar da — im Englischen bleibt das Fachwort stehen. */}
        {kann('handSpielen') && <p className="skat-hinweis">{t('skat.erklaerung.hand')}</p>}
      </div>
    );
  }

  if (round.phase === 'druecken') {
    return (
      <div className="skat-aktionen">
        <span className="skat-hinweis">
          {fehlenText(gedrueckt.length) ?? t('skat.zweiGewaehlt')}
        </span>
        <button
          className="primary"
          disabled={gedrueckt.length !== 2}
          onClick={() => send({ type: 'druecken', cards: gedrueckt })}
        >
          {t('skat.druecken')}
        </button>
      </div>
    );
  }

  if (round.phase === 'ansage') {
    return (
      <AnsagePanel
        handSpiel={round.handSpiel}
        saechsischAn={round.saechsischAn}
        meinePatrouillen={round.meinePatrouillen}
        send={send}
      />
    );
  }

  if (round.phase === 'stich') {
    if (!kann('kontra') && !kann('re') && !kann('hirsch')) return null;
    return (
      <div className="skat-aktionen">
        {kann('kontra') && (
          <button className="skat-knopf" onClick={() => send({ type: 'kontra' })}>
            {t('skat.kontra')}
          </button>
        )}
        {kann('re') && (
          <button className="skat-knopf" onClick={() => send({ type: 're' })}>
            {t('skat.re')}
          </button>
        )}
        {kann('hirsch') && (
          <button className="skat-knopf" onClick={() => send({ type: 'hirsch' })}>
            {t('skat.hirsch')}
          </button>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Der Reizrechner.
 *
 * Am echten Tisch rechnet man im Kopf: „Ohne zwei, Spiel drei, mal zehn —
 * dreissig kann ich." Genau diese Zeile steht hier, je Spielart, und darunter
 * die Leiter der Werte, die man jetzt sagen darf. Man tippt den Wert an,
 * statt sich mit „weiter" Stufe fuer Stufe hochzuzaehlen.
 *
 * Gerechnet hat das alles der Server (`round.reizHilfe`, `round.reiz.stufen`).
 * Der Client bildet keine Regel nach — er malt Zeilen und Knoepfe. Sonst
 * stuende die Reizleiter an zwei Stellen, und eine davon waere irgendwann
 * falsch.
 */
function ReizPanel({
  round,
  kann,
  send,
}: {
  round: SkatRoundView;
  kann: (typ: string) => boolean;
  send: (action: unknown) => void;
}): React.JSX.Element {
  const [offen, setOffen] = useState(false);
  const rolle = round.reiz.rolle;
  const stufen = round.reiz.stufen;
  // Der Hoerer haelt nur; springen darf allein, wer sagt.
  const darfSpringen = rolle === 'sager' && stufen.length > 1;

  const weiterLabel =
    rolle === 'vh'
      ? t('skat.reiz.spielNehmen')
      : rolle === 'hoerer'
        ? tf('skat.reiz.halten', { wert: round.reiz.wert })
        : tf('skat.reiz.sagen', { wert: round.reiz.gebot ?? 18 });

  return (
    <div className="skat-reiz">
      {offen ? (
        <div className="skat-reizblatt">
          <div className="skat-reiztabelle">
            {round.reizHilfe.map((z) => (
              <ReizZeileAnzeige key={z.spiel} zeile={z} />
            ))}
          </div>
          {darfSpringen && (
            <>
              <p className="skat-hinweis">
                {t('skat.reiz.hoeher')}
              </p>
              <div className="skat-reizleiter">
                {stufen.map((w) => (
                  <button
                    key={w}
                    className={`skat-reizwert${istTragbar(round.reizHilfe, w) ? ' is-tragbar' : ''}`}
                    onClick={() => {
                      send({ type: 'reizWeiter', wert: w });
                      setOffen(false);
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </>
          )}
          <button className="skat-knopf" onClick={() => setOffen(false)}>
            {t('skat.zurueck')}
          </button>
        </div>
      ) : (
        <div className="skat-aktionen">
          {kann('reizWeiter') && (
            <button className="primary" onClick={() => send({ type: 'reizWeiter' })}>
              {weiterLabel}
            </button>
          )}
          {/* Der Rechner steht immer offen — auch wer nur haelt oder gerade
              nicht dran ist, will die tragbaren Werte sehen koennen. */}
          <button className="skat-knopf" onClick={() => setOffen(true)}>
            {t('skat.reiz.rechner')}
          </button>
          {kann('reizWeg') && (
            <button className="skat-knopf" onClick={() => send({ type: 'reizWeg' })}>
              {t('skat.reiz.weg')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Traegt irgendeine Spielart dieses Blattes den Wert noch ohne Zusatzansage? */
function istTragbar(hilfe: readonly SkatReizZeile[], wert: number): boolean {
  return hilfe.some((z) => z.maxWert >= wert);
}

function ReizZeileAnzeige({ zeile }: { zeile: SkatReizZeile }): React.JSX.Element {
  const istNull = zeile.spiel === 'null';
  return (
    <div className="skat-reizzeile">
      <span className="skat-reizart">{ansageName(zeile.spiel)}</span>
      <span className="muted">
        {istNull
          ? t('skat.reiz.festerWert')
          : tf(zeile.mit ? 'skat.reiz.mit' : 'skat.reiz.ohne', {
              spitzen: zeile.spitzen,
              grundwert: zeile.grundwert,
            })}
      </span>
      <strong>{zeile.maxWert}</strong>
    </div>
  );
}

/**
 * Die Ansage: Spielart waehlen, im Handspiel dazu die Zusatzstufen. Der Server
 * prueft die Kombination erneut; verlangt Schwarz etwa Schneider, ergaenzt er
 * das selbst, deshalb schickt dieses Blatt nur, was angetippt wurde.
 */
function AnsagePanel({
  handSpiel,
  saechsischAn,
  meinePatrouillen,
  send,
}: {
  handSpiel: boolean;
  saechsischAn: boolean;
  meinePatrouillen: readonly string[];
  send: (action: unknown) => void;
}): React.JSX.Element {
  const [spiel, setSpiel] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [schneider, setSchneider] = useState(false);
  const [schwarz, setSchwarz] = useState(false);
  const [patrouillen, setPatrouillen] = useState<string[]>([]);

  const istNull = spiel === 'null';
  // Zusatzstufen gibt es nur im Handspiel; bei Null nur Ouvert.
  const zusatzMoeglich = handSpiel && spiel !== null;
  // Patrouillen zeigt die Sicht nur, wenn der Tisch sie spielt UND man sie
  // wirklich hat. Im Nullspiel gibt es keine Spielstufen, also auch keine.
  const patrouillenMoeglich = meinePatrouillen.length > 0 && spiel !== null && !istNull;

  const togglePatrouille = (p: string): void =>
    setPatrouillen((alt) => (alt.includes(p) ? alt.filter((x) => x !== p) : [...alt, p]));

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
            {farbName(f.spiel)}
          </button>
        ))}
        <button
          className={`skat-art${spiel === 'grand' ? ' is-gewaehlt' : ''}`}
          onClick={() => setSpiel('grand')}
        >
          {t('skat.spiel.grand')}
        </button>
        {saechsischAn && (
          <button
            className={`skat-art${spiel === 'saechsisch' ? ' is-gewaehlt' : ''}`}
            onClick={() => setSpiel('saechsisch')}
            title={t('skat.erklaerung.saechsisch')}
          >
            {t('skat.spiel.saechsischKurz')}
          </button>
        )}
        <button
          className={`skat-art${spiel === 'null' ? ' is-gewaehlt' : ''}`}
          onClick={() => setSpiel('null')}
        >
          {t('skat.spiel.null')}
        </button>
      </div>

      {/* Was die gewaehlte Spielart heisst, sichtbar statt nur im `title`
          (am Handy gibt es kein Hovern). Im Englischen bleiben Grand und Null
          als Fachwort stehen; diese Zeile erklaert sie. */}
      {spiel !== null && <p className="skat-hinweis">{spielErklaerung(spiel)}</p>}

      {patrouillenMoeglich && (
        <div className="skat-ansage-zusatz">
          {meinePatrouillen.map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                checked={patrouillen.includes(p)}
                onChange={() => togglePatrouille(p)}
              />
              {patrouilleName(p)}
            </label>
          ))}
        </div>
      )}

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
          {!istNull && <p className="skat-hinweis">{t('skat.erklaerung.zusatz')}</p>}
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
            patrouillen: patrouillenMoeglich ? patrouillen : [],
          })
        }
      >
        {t('skat.ansagen')}
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
        {round.dealer === seat && <em className="doko-tag">{t('skat.geber')}</em>}
        {istDeclarer && <em className="doko-tag">{t('skat.spieler')}</em>}
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
          <>
            <p className={r.durchmarsch !== null ? 'skat-gut' : 'skat-schlecht'}>
              {r.durchmarsch !== null
                ? tf('skat.ergebnis.durchmarsch', { name: nameOf(r.durchmarsch) })
                : t('skat.ergebnis.augenreichster')}
            </p>
            {/* Warum es so teuer wurde, gehoert sichtbar dazu — sonst wirkt der
                verdoppelte Betrag wie ein Rechenfehler. */}
            {r.jungfrauen.length > 0 && (
              <p className="muted">
                {tf('skat.ergebnis.jungfrau', { namen: r.jungfrauen.map(nameOf).join(', ') })}
              </p>
            )}
            {round.ramschFaktor > 1 && (
              <p className="muted">{tf('skat.ergebnis.blind', { faktor: round.ramschFaktor })}</p>
            )}
          </>
        ) : (
          <p className={r.gewonnen ? 'skat-gut' : 'skat-schlecht'}>
            {tf(r.gewonnen ? 'skat.ergebnis.gewonnen' : 'skat.ergebnis.verloren', {
              name: r.declarer !== null ? nameOf(r.declarer) : '',
            }).trim()}
            {r.ueberreizt && t('skat.ergebnis.ueberreizt')}
            {r.schwarz
              ? t('skat.ergebnis.schwarz')
              : r.schneider
                ? t('skat.ergebnis.schneider')
                : ''}
            {r.patrouillen > 0 && tn('skat.ergebnis.patrouillen', r.patrouillen)}
            {'. '}
            {r.declarer !== null &&
              tf('skat.ergebnis.augen', { augen: r.declarerAugen, wert: r.spielwert })}
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

        <h3>{t('skat.gesamtstand')}</h3>
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
          {t('skat.weiter')}
        </button>
      </div>
    </div>
  );
}
