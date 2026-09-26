import { useEffect, useState } from 'react';
import { api, type GameSummary, type Me, type RankingEntry } from '../api';
import { cardImage, deckForGame } from '../decks';
import { t } from '../i18n';
import { inApp } from '../laufzeit';
import { sitzSpanne } from '../sitzspanne';
import { SZENEN, szeneBild } from '../szenen';
import { bannerFuer } from './StartNeu';

/**
 * Der Reiter „Spiele" im neuen Hub und die Spielseite davor
 * (Entwurf „Nachtblau & Gold", Fassung 4 vom 26.09.2026).
 *
 * Spiele stehen nach Kategorien. Die Kategorien kennt nur der Client: Im
 * Server gibt es keine (FAKTENBLATT.md, Abschnitt 7), sie sind eine reine
 * Ordnung für die Anzeige. Ein Spiel, das in keiner steht, landet unter
 * „Weitere" und fällt so nie still heraus.
 *
 * Ein Tipp auf ein Spiel öffnet seine Spielseite, erst „Zum Spiel" führt in
 * die eigene Lobby des Spiels (Robin, 26.09.2026).
 */

interface Kategorie {
  readonly id: string;
  readonly titel: string;
  /** Für die Unterzeile der Spielseite („4–5 Spieler · Kartenspiel"). */
  readonly einzahl: string;
  readonly spiele: readonly string[];
  readonly icon: React.JSX.Element;
}

const KATEGORIEN: readonly Kategorie[] = [
  {
    id: 'karten',
    titel: 'Kartenspiele',
    einzahl: 'Kartenspiel',
    spiele: ['doppelkopf', 'skat', 'wizard', 'cambio', 'easypoker'],
    icon: <path d="M4 7.5 13 5l3 13-9 2.5z M11 4.5l7-1.5 3 13-3 .7" />,
  },
  {
    id: 'trink',
    titel: 'Trinkspiele',
    einzahl: 'Trinkspiel',
    spiele: ['partykiste'],
    icon: <path d="M4 20l5-13 8 8z M14 4l1 2M19 5l-2 1.5M20 10h-2.5M11 3.5l.5 2" />,
  },
  {
    id: 'echtzeit',
    titel: 'Echtzeit',
    einzahl: 'Echtzeit',
    spiele: ['golf', 'brocooked', 'feldherr'],
    icon: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
  },
  {
    id: 'denken',
    titel: 'Denken & Strategie',
    einzahl: 'Strategie',
    spiele: ['tafelrunde', 'brochess', 'eiland', 'filler', 'mememory'],
    icon: <path d="M9 4h6v3a2 2 0 1 0 0 4v3h-3a2 2 0 1 1-4 0H5v-3a2 2 0 1 0 0-4V4z" />,
  },
];

/** Was der Server nicht weiß, aber aufs Banner gehört (aus der alten Spielwahl übernommen). */
const ZUSATZ: Record<string, string> = {
  feldherr: 'Echtzeit',
  mememory: 'Meme-Memory',
  easypoker: 'Hold’em',
  filler: 'Flächen im Nebel',
  eiland: 'Landnahme im Nebel',
  golf: 'Minigolf in Echtzeit',
  brocooked: 'Küche in Echtzeit',
  tafelrunde: 'Auto-Battler',
  partykiste: '15 Minispiele, ein Turnier',
  brochess: 'Schach',
};

/** Spiele mit Kartenblatt und Tisch aus der Sammlung. */
const MIT_THEMEN = new Set(['doppelkopf', 'skat', 'wizard', 'cambio']);

function Symbol({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function kategorieVon(gameId: string): Kategorie | null {
  return KATEGORIEN.find((k) => k.spiele.includes(gameId)) ?? null;
}

export function SpieleNeu({
  me,
  offen,
  onOeffne,
  onPick,
  onSolo,
  onBald,
  onSammlung,
}: {
  me: Me;
  /** Das Spiel, dessen Spielseite offen ist, oder null für die Übersicht. */
  offen: string | null;
  onOeffne: (gameId: string | null) => void;
  onPick: (gameId: string) => void;
  onSolo: (modusId: string) => void;
  onBald: (name: string) => void;
  onSammlung: () => void;
}): React.JSX.Element {
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('alle');

  useEffect(() => {
    let lebt = true;
    void api
      .games()
      .then((liste) => lebt && setGames(liste))
      .catch(() => lebt && setGames([]));
    return () => {
      lebt = false;
    };
  }, []);

  const abstimmen = async (gameId: string): Promise<void> => {
    await api.vote(gameId);
    setVoted((alt) => new Set(alt).add(gameId));
    setGames(await api.games());
  };

  if (!games) return <p className="hb-laden">Spiele werden geladen…</p>;

  const spielbar = games.filter((g) => g.availability === 'playable');
  const bald = games.filter((g) => g.availability === 'preview');
  const offenesSpiel = offen ? games.find((g) => g.id === offen) : undefined;
  if (offenesSpiel) {
    return (
      <SpielSeite
        game={offenesSpiel}
        me={me}
        onZurueck={() => onOeffne(null)}
        onZumSpiel={() => onPick(offenesSpiel.id)}
        onSammlung={onSammlung}
      />
    );
  }

  const trophaeen = (id: string): number => me.stats.find((s) => s.gameId === id)?.trophies ?? 0;
  const bekannt = new Set(KATEGORIEN.flatMap((k) => k.spiele));
  const weitere = spielbar.filter((g) => !bekannt.has(g.id));
  const zeige = (id: string): boolean => filter === 'alle' || filter === id;

  const karte = (g: GameSummary): React.JSX.Element => (
    <button type="button" className="hb-sk" key={g.id} onClick={() => onOeffne(g.id)}>
      <span className="hb-sk-bild" style={{ backgroundImage: `url(${bannerFuer(g.id)})` }} />
      <strong>{t(g.nameKey)}</strong>
      {trophaeen(g.id) > 0 ? (
        <span className="hb-pk">
          <img src="/hub/symbol-pokal.webp" alt="" />
          {trophaeen(g.id).toLocaleString('de-DE')}
        </span>
      ) : (
        <small>{sitzSpanne(g.seatCounts)} Spieler</small>
      )}
    </button>
  );

  return (
    <div className="hb-spiele">
      <header className="hb-kopfzeile">
        <h1 className="hb-titel">Spiele</h1>
      </header>
      <div className="hb-chips" role="tablist" aria-label="Kategorien">
        {[{ id: 'alle', titel: 'Alle' }, ...KATEGORIEN].map((k) => (
          <button
            type="button"
            role="tab"
            aria-selected={filter === k.id}
            key={k.id}
            className={`hb-chip${filter === k.id ? ' is-an' : ''}`}
            onClick={() => setFilter(k.id)}
          >
            {k.id === 'denken' ? 'Denken' : k.titel}
          </button>
        ))}
      </div>

      <div className="hb-spiele-rolle">
        {KATEGORIEN.map((k) => {
          // Reihenfolge der Kategorie, nicht die des Servers
          const liste = spielbar
            .filter((g) => k.spiele.includes(g.id))
            .sort((a, b) => k.spiele.indexOf(a.id) - k.spiele.indexOf(b.id));
          if (liste.length === 0 || !zeige(k.id)) return null;
          if (k.id === 'trink') {
            const party = liste[0]!;
            return (
              <section className="hb-blk" key={k.id}>
                <h2 className="hb-ab">
                  <Symbol>{k.icon}</Symbol>
                  {k.titel}
                  <span className="hb-ab-zusatz">das erste</span>
                </h2>
                <button
                  type="button"
                  className="hb-held hb-party"
                  style={{ backgroundImage: `url(${bannerFuer(party.id)})` }}
                  onClick={() => onOeffne(party.id)}
                >
                  <span className="hb-held-unten hb-held-zeile">
                    <span>
                      <strong className="hb-held-titel">{t(party.nameKey)}</strong>
                      <span>15 Minispiele · {sitzSpanne(party.seatCounts)} Leute · auch ohne Alkohol</span>
                    </span>
                    <span className="hb-kn is-gold">Ansehen</span>
                  </span>
                </button>
              </section>
            );
          }
          return (
            <section className="hb-blk" key={k.id}>
              <h2 className="hb-ab">
                <Symbol>{k.icon}</Symbol>
                {k.titel}
                <span className="hb-ab-zusatz">{liste.length}</span>
              </h2>
              <div className="hb-reihe">{liste.map(karte)}</div>
            </section>
          );
        })}

        {weitere.length > 0 && filter === 'alle' && (
          <section className="hb-blk">
            <h2 className="hb-ab">
              Weitere<span className="hb-ab-zusatz">{weitere.length}</span>
            </h2>
            <div className="hb-reihe">{weitere.map(karte)}</div>
          </section>
        )}

        {filter === 'alle' && (
          <>
            <section className="hb-blk">
              <h2 className="hb-ab">
                <Symbol>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </Symbol>
                Allein
              </h2>
              {/* In der App kommt Pro-Subway erst später (Robin, 23.09.2026). */}
              <button
                type="button"
                className="hb-quer"
                style={{ backgroundImage: 'url(/hub/banner-prosubway.webp)' }}
                onClick={() => (inApp ? onBald(t('modus.prosubway')) : onSolo('prosubway'))}
              >
                <span className="hb-quer-text">
                  <strong>{t('modus.prosubway')}</strong>
                  <span>Münzen fürs Hub · bis 40 am Tag</span>
                </span>
                {inApp ? <span className="hb-bald-marke">Bald</span> : <span className="hb-kn is-gold">Los</span>}
              </button>
            </section>

            <section className="hb-blk">
              <h2 className="hb-ab">
                <Symbol>
                  <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
                </Symbol>
                Modi
              </h2>
              {/* Der Mehrkampf ist noch nicht gebaut: ehrliche „Bald"-Marke (DESIGN.md). */}
              <button
                type="button"
                className="hb-quer"
                style={{ backgroundImage: 'url(/hub/banner-mehrkampf.webp)' }}
                onClick={() => onBald(t('modus.mehrkampf'))}
              >
                <span className="hb-quer-text">
                  <strong>{t('modus.mehrkampf')}</strong>
                  <span>Runden aus mehreren Spielen</span>
                </span>
                <span className="hb-bald-marke">Bald</span>
              </button>
            </section>

            {bald.length > 0 && (
              <section className="hb-blk">
                <h2 className="hb-ab">
                  <Symbol>
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4l3 2" />
                  </Symbol>
                  Kommt bald
                  <span className="hb-ab-zusatz">Stimm ab</span>
                </h2>
                <div className="hb-liste">
                  {bald.map((g) => (
                    <div className="hb-bald" key={g.id}>
                      <button type="button" className="hb-bald-flaeche" onClick={() => onBald(t(g.nameKey))}>
                        <span className="hb-bald-bild" style={{ backgroundImage: `url(${bannerFuer(g.id)})` }} />
                        <span className="hb-bald-text">
                          <strong>{t(g.nameKey)}</strong>
                          <small>
                            {sitzSpanne(g.seatCounts)} Spieler
                            {g.abstimmbar !== false ? ` · ${g.votes.toLocaleString('de-DE')} Stimmen` : ''}
                          </small>
                        </span>
                      </button>
                      {/* Ohne Stimme, was es schon gibt und nur noch nicht freigegeben ist. */}
                      {g.abstimmbar !== false ? (
                        <button
                          type="button"
                          className="hb-kn is-stimme"
                          disabled={voted.has(g.id)}
                          onClick={() => void abstimmen(g.id)}
                        >
                          {voted.has(g.id) ? 'Abgestimmt' : 'Dafür'}
                        </button>
                      ) : (
                        <span className="hb-bald-marke">Bald</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Die Spielseite: großes Banner, die eigenen Trophäen in diesem Spiel, der
 * Beitrag zum gemeinsamen Trophäenweg, Blatt und Tisch aus der Sammlung und
 * die Rangliste. „Zum Spiel" öffnet die eigene Lobby des Spiels.
 *
 * Die Reiterleiste bleibt dabei sichtbar (Apple: Tab-Leiste auf jeder
 * Push-Ebene), der Zurück-Pfeil führt zur Übersicht.
 */
function SpielSeite({
  game,
  me,
  onZurueck,
  onZumSpiel,
  onSammlung,
}: {
  game: GameSummary;
  me: Me;
  onZurueck: () => void;
  onZumSpiel: () => void;
  onSammlung: () => void;
}): React.JSX.Element {
  const [rangliste, setRangliste] = useState<RankingEntry[] | null>(null);
  useEffect(() => {
    let lebt = true;
    void api
      .ranking(game.id)
      .then((liste) => lebt && setRangliste(liste))
      .catch(() => lebt && setRangliste([]));
    return () => {
      lebt = false;
    };
  }, [game.id]);

  const stat = me.stats.find((s) => s.gameId === game.id);
  const gesamt = me.stats.reduce((summe, s) => summe + s.trophies, 0);
  const eigene = stat?.trophies ?? 0;
  const ich = rangliste?.find((e) => e.accountId === me.id) ?? null;
  const erster = rangliste?.[0] ?? null;
  const kat = kategorieVon(game.id);
  const unterzeile = [
    `${sitzSpanne(game.seatCounts)} Spieler`,
    kat?.einzahl,
    ZUSATZ[game.id] && ZUSATZ[game.id] !== kat?.einzahl ? ZUSATZ[game.id] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const quote = stat && stat.parties > 0 ? Math.round((stat.wins / stat.parties) * 100) : null;
  const thema = me.themes[game.id];
  const deck = deckForGame(game.id, thema?.cardDeck);
  const blattBild = cardImage(deck, { suit: 'H', rank: 'Q' });
  const szene = SZENEN.find((s) => s.id === thema?.tableScene) ?? SZENEN[0]!;

  return (
    <div className="hb-spielseite">
      <div className="hb-sp-kopf" style={{ backgroundImage: `url(${bannerFuer(game.id)})` }}>
        <button type="button" className="hb-rund" onClick={onZurueck} aria-label="Zurück zu allen Spielen">
          <Symbol>
            <path d="M15 5l-7 7 7 7" />
          </Symbol>
        </button>
      </div>
      <div className="hb-sp-inhalt">
        <div className="hb-sp-titel">
          <h1>{t(game.nameKey)}</h1>
          <span>{unterzeile}</span>
        </div>

        <div className="hb-sp-status">
          <div className="hb-sp-zahl">
            <span className="hb-sp-pokal">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {eigene.toLocaleString('de-DE')}
            </span>
            <span className="hb-klein">
              {ich ? (
                <>
                  Platz {ich.rank.toLocaleString('de-DE')}
                  <br />
                  in Deutschland
                </>
              ) : (
                'Noch nicht in der Rangliste'
              )}
            </span>
          </div>
          <div className="hb-sp-anteil">
            <span className="hb-klein">
              Dein Beitrag zum Trophäenweg: <b>{eigene.toLocaleString('de-DE')} von {gesamt.toLocaleString('de-DE')}</b>
            </span>
            <span className="hb-balken" aria-hidden="true">
              <span style={{ width: `${gesamt > 0 ? Math.round((eigene / gesamt) * 100) : 0}%` }} />
            </span>
          </div>
          <div className="hb-sp-werte">
            <span>
              <b>{(stat?.parties ?? 0).toLocaleString('de-DE')}</b>Partien
            </span>
            <span>
              <b>{(stat?.wins ?? 0).toLocaleString('de-DE')}</b>Siege
            </span>
            <span>
              <b>{quote === null ? '–' : `${quote} %`}</b>Quote
            </span>
          </div>
        </div>

        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onZumSpiel}>
          Zum Spiel
        </button>

        {MIT_THEMEN.has(game.id) && (
          <section className="hb-blk">
            <h2 className="hb-ab">
              Dein {t(game.nameKey)}
              <button type="button" className="hb-ab-mehr" onClick={onSammlung}>
                Sammlung ›
              </button>
            </h2>
            <div className="hb-mein">
              <button type="button" className="hb-mn is-blatt" onClick={onSammlung}>
                <span className="hb-mn-bild" style={blattBild ? { backgroundImage: `url(${blattBild})` } : undefined} />
                <span className="hb-mn-text">
                  <small>Blatt</small>
                  <strong>{t(deck.nameKey)}</strong>
                </span>
              </button>
              <button type="button" className="hb-mn" onClick={onSammlung}>
                <span className="hb-mn-bild" style={{ backgroundImage: `url(${szeneBild(szene.id)})` }} />
                <span className="hb-mn-text">
                  <small>Tisch</small>
                  <strong>{szene.name}</strong>
                </span>
              </button>
            </div>
          </section>
        )}

        <section className="hb-blk">
          <h2 className="hb-ab">
            Rangliste {t(game.nameKey)}
            <span className="hb-ab-zusatz">Deutschland</span>
          </h2>
          <div className="hb-liste">
            {rangliste === null ? (
              <p className="hb-klein hb-liste-leer">Rangliste wird geladen…</p>
            ) : !erster ? (
              <p className="hb-klein hb-liste-leer">Noch niemand in der Rangliste. Spiel die erste Partie.</p>
            ) : (
              [erster, ...(ich && ich.accountId !== erster.accountId ? [ich] : [])].map((e) => (
                <div className={`hb-rl${e.accountId === me.id ? ' is-du' : ''}`} key={e.accountId}>
                  <span className="hb-rl-rang">{e.rank}</span>
                  <strong>{e.accountId === me.id ? 'Du' : e.displayName}</strong>
                  <span className="hb-pk">
                    <img src="/hub/symbol-pokal.webp" alt="" />
                    {e.trophies.toLocaleString('de-DE')}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
