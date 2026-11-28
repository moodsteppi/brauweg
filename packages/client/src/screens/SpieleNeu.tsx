import { useEffect, useRef, useState } from 'react';
import { api, type GameSummary, type Me, type RankingEntry } from '../api';
import { deckForGame, rueckenBild, RUECKEN } from '../decks';
import { CardFront, CardBack } from '../CardFace';
import { t, zahl } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import { inApp } from '../laufzeit';
import { inAppSichtbar } from '../app-sichtbar';
import { imUmfang } from '../umfang';
import { EINZELSPIELE, einzelKennung, einzelName } from '../minispiele/partykiste/einzelspiele';
import { sitzSpanne } from '../sitzspanne';
import { SZENEN, szeneBild } from '../szenen';
import './spielraster.css';
import './kategorie-register.css';
import { BRO_SPIELE } from '../broremote/spiele';
import { bannerFuer } from './StartNeu';
import { SammelIcon, SammlungVorschau, type SammelBereich } from './SammlungVorschau';
import { HubBildIcon } from './HubBildIcon';

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

/*
 * Titel stehen hier als Schlüssel, nicht als Text: t() muss beim Zeichnen
 * laufen, sonst bliebe die Sprache vom Laden des Moduls stehen.
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
  { id: 'wuerfel', titel: 'Würfelspiele', einzahl: 'Würfelspiel', spiele: ['wuerfelglanz'], icon: <><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="8" cy="8" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="16" cy="16" r="1" /></> },
  {
    id: 'karten',
    titel: 'spielwahl.kategorie.karten',
    einzahl: 'spielwahl.einzahl.karten',
    spiele: ['doppelkopf', 'skat', 'dreckbro', 'brobluff', 'wizard', 'cambio', 'easypoker'],
    icon: <path d="M4 7.5 13 5l3 13-9 2.5z M11 4.5l7-1.5 3 13-3 .7" />,
  },
  {
    id: 'trink',
    titel: 'spielwahl.kategorie.trink',
    einzahl: 'spielwahl.einzahl.trink',
    spiele: ['partykiste'],
    icon: <path d="M4 20l5-13 8 8z M14 4l1 2M19 5l-2 1.5M20 10h-2.5M11 3.5l.5 2" />,
  },
  {
    id: 'echtzeit',
    titel: 'spielwahl.kategorie.echtzeit',
    einzahl: 'spielwahl.einzahl.echtzeit',
    spiele: ['golf', 'brocooked', 'feldherr'],
    icon: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
  },
  {
    id: 'denken',
    titel: 'spielwahl.kategorie.denken',
    einzahl: 'spielwahl.einzahl.denken',
    spiele: ['tafelrunde', 'brochess', 'eiland', 'filler', 'mememory'],
    icon: <path d="M9 4h6v3a2 2 0 1 0 0 4v3h-3a2 2 0 1 1-4 0H5v-3a2 2 0 1 0 0-4V4z" />,
  },
];

/**
 * Was der Server nicht weiß, aber aufs Banner gehört (aus der alten Spielwahl
 * übernommen): die Spiele, für die `spielwahl.zusatz.<id>` existiert.
 */
const ZUSATZ: ReadonlySet<string> = new Set([
  'feldherr', 'mememory', 'easypoker', 'filler', 'eiland', 'golf', 'brocooked', 'tafelrunde', 'partykiste', 'brochess', 'dreckbro', 'brobluff',
]);

/** Spiele mit Kartenblatt und Tisch aus der Sammlung. */
const BALD_BILDER = new Set(['schafkopf', 'romme', 'maumau', 'schwimmen', 'backgammon', 'bauernskat', 'phase10']);
const BESTEHENDE_BANNER = new Set(KATEGORIEN.flatMap(k => k.spiele));

const MIT_THEMEN = new Set(['doppelkopf', 'skat', 'wizard', 'cambio', 'easypoker']);

function Symbol({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** Die Kategorien behalten ihre Motive aus den Abschnittsüberschriften. */
function KategorieZeichen({ id }: { id: string }): React.JSX.Element {
  if (id === 'alle' || id === 'denken') return <Symbol><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Symbol>;
  if (id === 'broremote') return <Symbol><path d="M3 4h14v11H3z M6 20h8 M10 15v5"/><rect x="18" y="11" width="4" height="11" rx="1"/></Symbol>;
  if (id === 'solo') return <Symbol><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></Symbol>;
  if (id === 'bald') return <Symbol><path d="M6 3h12 M6 21h12 M7 3v4l5 5-5 5v4 M17 3v4l-5 5 5 5v4"/></Symbol>;
  return <Symbol>{KATEGORIEN.find(k => k.id === id)?.icon ?? <path d="M4 7h16v14H4z M8 7V3h8v4"/>}</Symbol>;
}

/**
 * Die Chips über der Spielliste (ohne „Alle", das immer davor steht).
 *
 * Ein Chip, hinter dem nichts Spielbares steht, wäre ein leerer Bildschirm.
 * In der App ist nur ein Teil der Spiele freigegeben (FREIGABE im Server):
 * Dort zählen deshalb nur Kategorien mit spielbaren Spielen, und alles
 * Übrige sammelt der Chip „Kommt bald" (Emile, 13.10.2026). Auf der Webseite
 * passiert dasselbe, seit `UMFANG` dort ganze Kategorien leeren kann
 * (Abnahme-Probe 3d2e54c6, 24.10.2026: „Trinkspiele" und „Echtzeit" führten
 * ins Leere) — aber ohne „Kommt bald": Das Bald steht dort unter „Modi".
 * Ohne `UMFANG` ist auf der Webseite jede Kategorie spielbar, die Leiste
 * also dieselbe wie vorher.
 *
 * Herausgezogen, damit die Proben sie ohne Bildschirm und ohne `inApp`-Mock
 * für beide Plattformen fragen können.
 */
export function chipsFuer(spielbar: readonly string[], app: boolean): readonly { id: string; titel: string }[] {
  const belegt = KATEGORIEN.filter((k) => k.id === 'denken' || spielbar.some((id) => k.spiele.includes(id)));
  const chips = [{ id: 'broremote', titel: 'BroRemote' }, ...belegt.map((k) => ({ id: k.id, titel: k.id === 'trink' ? 'Partykiste' : t(k.titel) }))];
  return app ? [...chips, { id: 'bald', titel: t('spielwahl.kategorie.bald') }] : chips;
}

/** Arenen außerhalb der Tischschicht — Ziel und Bild wie in ihren Registern. */
const ARENEN: Readonly<Record<string, { name: string; bild: string }>> = {
  'tanks-online': { name: 'BroTanks Online', bild: '/broremote/ausbau/tanks.webp' },
  'ice-clash': { name: 'Bro Ice Clash', bild: '/ice-clash/titel.webp' },
};

/** Solo-Spiele mit Bild wie im Register „Allein". Namen als Funktion: t() muss beim Zeichnen laufen. */
const SOLO: Readonly<Record<string, { name: () => string; bild: string; stil?: React.CSSProperties }>> = {
  prosubway: { name: () => t('modus.prosubway'), bild: '/hub/banner-prosubway.webp' },
  kartenmanufaktur: { name: () => 'Kartenmanufaktur', bild: '/manufaktur/werkstatt-hero.webp' },
  flyingbro: { name: () => 'Flying Bro', bild: '/flyingbro/bro-pelle-flug.webp', stil: { backgroundSize: 'contain', backgroundRepeat: 'no-repeat' } },
  browort: { name: () => 'Browort', bild: '/hub/browort-icon.webp' },
};

/** Das Herz als SVG — ein Zeichen reicht, eine Grafik wäre eine Bestellung (Plan, Abschnitt 7). */
function Herz({ voll }: { voll: boolean }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill={voll ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
    </svg>
  );
}

/** Das kleine Herz an einer Favoriten-Kachel; der Name steht für das Vorlesen dabei. */
function FavoritMarke(): React.JSX.Element {
  return (
    <span className="hb-sk-herz">
      <Herz voll />
      <span className="hb-sk-herz-text">{t('spielwahl.favorit.marke')}</span>
    </span>
  );
}

/**
 * „Deine Spiele" ganz oben im Reiter (Robin, B4): zwei Reihen, Favoriten in
 * der gespeicherten Reihenfolge, darunter zuletzt gespielt ohne die
 * Favoriten. Eine leere Reihe entfällt, beide leer — der ganze Abschnitt
 * (kein leerer Kasten bei einem neuen Konto).
 */
function DeineSpiele({
  favoriten,
  zuletzt,
  kachelFuer,
}: {
  favoriten: readonly string[];
  zuletzt: readonly string[];
  kachelFuer: (id: string, favorit: boolean) => React.JSX.Element | null;
}): React.JSX.Element | null {
  const fav = favoriten.map((id) => kachelFuer(id, true)).filter((k): k is React.JSX.Element => k !== null);
  const schonDa = new Set(favoriten);
  const zul = [...new Set(zuletzt)]
    .filter((id) => !schonDa.has(id))
    .map((id) => kachelFuer(id, false))
    .filter((k): k is React.JSX.Element => k !== null);
  if (fav.length === 0 && zul.length === 0) return null;
  return (
    <section className="hb-blk hb-deine" aria-label={t('spielwahl.deine.titel')}>
      <h2 className="hb-ab">{t('spielwahl.deine.titel')}</h2>
      {fav.length > 0 && (
        <div className="hb-deine-reihe" role="group" aria-label={t('spielwahl.deine.favoriten')}>
          <h3 className="hb-deine-unter">{t('spielwahl.deine.favoriten')}</h3>
          <div className="hb-reihe">{fav}</div>
        </div>
      )}
      {zul.length > 0 && (
        <div className="hb-deine-reihe" role="group" aria-label={t('spielwahl.deine.zuletzt')}>
          <h3 className="hb-deine-unter">{t('spielwahl.deine.zuletzt')}</h3>
          <div className="hb-reihe">{zul}</div>
        </div>
      )}
    </section>
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
  onBock,
  onSammlung,
  onLernen,
  onKontoNeu,
}: {
  me: Me;
  /** Das Spiel, dessen Spielseite offen ist, oder null für die Übersicht. */
  offen: string | null;
  onOeffne: (gameId: string | null) => void;
  onPick: (gameId: string) => void;
  onSolo: (modusId: string) => void;
  onBald: (name: string) => void;
  /**
   * BroweG-Bock öffnen (seit dem 28.11.2026 spielbar, `src/bock/`). Fehlt er
   * (Umfang ohne `mehrkampf`), bleibt die ehrliche „Bald"-Karte der Webseite.
   */
  onBock?: () => void;
  onSammlung: (art?: SammelBereich) => void;
  /** „Doppelkopf lernen" auf der Doppelkopf-Seite — nur gesetzt, wenn es im Umfang steht. */
  onLernen?: () => void;
  /** `/api/me` neu laden, nachdem sich ein Favorit geändert hat. */
  onKontoNeu?: () => void;
}): React.JSX.Element {
  /*
   * Favoriten, wie der Server sie zuletzt bestätigt hat. Bis die Wurzel `me`
   * neu geladen hat, gilt die Antwort von `favoritSetzen` — sonst spränge das
   * Herz nach dem Tippen kurz zurück.
   */
  const [favoritenStand, setFavoritenStand] = useState<string[] | null>(null);
  const favoriten = favoritenStand ?? me.vorlieben?.favoriten ?? [];
  const [favoritFehler, setFavoritFehler] = useState<string | null>(null);
  const favoritSetzen = (spiel: string, an: boolean): void => {
    const vorher = favoriten;
    setFavoritFehler(null);
    // Sofort umschalten; schlägt das Speichern fehl, gilt wieder der alte Stand.
    setFavoritenStand(an ? [...vorher.filter((id) => id !== spiel), spiel] : vorher.filter((id) => id !== spiel));
    api
      .favoritSetzen(spiel, an)
      .then((antwort) => {
        setFavoritenStand(antwort.favoriten);
        onKontoNeu?.();
      })
      .catch(() => {
        setFavoritenStand(vorher);
        setFavoritFehler(t('spielwahl.favorit.fehler'));
      });
  };
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [abstimmFehler, setAbstimmFehler] = useState<string | null>(null);
  const unterwegs = useRef(new Set<string>());
  const [sendet, setSendet] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('alle');
  /** „Kommt bald" in der App: zu, bis jemand hineinsieht. */
  const [baldOffen, setBaldOffen] = useState(false);

  useEffect(() => {
    let lebt = true;
    void api
      .games()
      .then((liste) => {
        if (!lebt) return;
        setGames(liste);
        setVoted(new Set(liste.filter(g => g.meineStimme).map(g => g.id)));
      })
      .catch(() => lebt && setGames([]));
    return () => {
      lebt = false;
    };
  }, []);

  const abstimmen = async (gameId: string): Promise<void> => {
    if (unterwegs.current.has(gameId) || voted.has(gameId)) return;
    unterwegs.current.add(gameId);
    setSendet(new Set(unterwegs.current));
    setAbstimmFehler(null);
    try {
      await api.vote(gameId);
      setVoted((alt) => new Set(alt).add(gameId));
      setGames(alt => alt?.map(g => g.id === gameId ? { ...g, meineStimme: true, votes: g.votes + 1 } : g) ?? null);
    } catch {
      setAbstimmFehler(t('spielwahl.abstimmFehler'));
    } finally {
      unterwegs.current.delete(gameId);
      setSendet(new Set(unterwegs.current));
    }
  };

  // Vor dem frühen Rückgabewert unten: Hooks immer in derselben Reihenfolge.
  const offenBald = offen ? games?.find((g) => g.id === offen && g.availability === 'preview') : undefined;
  useEffect(() => {
    if (!offenBald) return;
    onOeffne(null);
    onBald(t(offenBald.nameKey));
    // An der Kennung hängen, nicht am Objekt (CLAUDE.md).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offenBald?.id]);

  if (!games) return <p className="hb-laden">{t('spielwahl.laden')}</p>;

  const spielbar = games.filter((g) => g.availability === 'playable');
  // Die Partykiste steht in der App nicht einmal unter „Kommt bald“ (app-sichtbar.ts).
  const bald = games.filter((g) => g.availability === 'preview' && inAppSichtbar(g.id)).sort((a, b) => b.votes - a.votes);
  // Nur Spielbares hat eine Spielseite. Ein „Bald"-Spiel kann trotzdem
  // ankommen — vom Start aus „Deine Spiele", wenn man es früher gespielt hat
  // (Partykiste in der App, seit 21.10.2026 „Kommt bald").
  const offenesSpiel = offen ? spielbar.find((g) => g.id === offen) : undefined;
  if (offenesSpiel) {
    return (
      <SpielSeite
        game={offenesSpiel}
        me={me}
        onZurueck={() => onOeffne(null)}
        onZumSpiel={() => onPick(offenesSpiel.id)}
        onSammlung={onSammlung}
        onLernen={offenesSpiel.id === 'doppelkopf' ? onLernen : undefined}
        favorit={favoriten.includes(offenesSpiel.id)}
        onFavorit={(an) => favoritSetzen(offenesSpiel.id, an)}
        favoritFehler={favoritFehler}
      />
    );
  }

  const trophaeen = (id: string): number => me.stats.find((s) => s.gameId === id)?.trophies ?? 0;
  const bekannt = new Set(KATEGORIEN.flatMap((k) => k.spiele));
  const weitere = spielbar.filter((g) => !bekannt.has(g.id));
  const zeige = (id: string): boolean => filter === 'alle' || filter === id;

  // Spiele, ueber die erst abgestimmt wird, gibt es noch nicht — also auch
  // kein Banner. `bannerFuer` zeigte auf eine fehlende Datei, und statt des
  // Bildes stand ein leeres Feld (CLAUDE.md: kein <img> auf eine Datei, die es
  // nicht gibt). Sie bekommen das gemeinsame Bald-Bild.
  const baldBild = (g: GameSummary): string =>
    g.id === 'prosubway' || g.id === 'mehrkampf' ? `/hub/banner-${g.id}.webp` : BALD_BILDER.has(g.id) ? `/hub/bald-${g.id}.webp` : g.abstimmbar !== false && !BESTEHENDE_BANNER.has(g.id) ? '/hub/spielwahl-bald.webp' : bannerFuer(g.id);

  // Was der Umfang der Ausgabe nicht enthält, verschwindet ganz — auch aus
  // „Kommt bald": Es kommt in diesem Release ja nicht (umfang.ts).
  const mitManufaktur = imUmfang('kartenmanufaktur');
  const mitBrowort = imUmfang('browort');
  // Flying Bro wird quer gespielt; die iOS-Hülle erlaubt heute nur Hochformat
  // (docs/SPEZIFIKATION-FLYINGBRO.md, Bildschirm und Format). In der App
  // stünde deshalb für immer „Bitte Handy drehen" da — der Einstieg kommt
  // dort erst mit der Hüllen-Aufgabe.
  const mitFlyingbro = imUmfang('flyingbro') && !inApp;
  const mitProSubway = imUmfang('prosubway');
  const soloDa = mitManufaktur || mitFlyingbro || mitBrowort || (!inApp && mitProSubway);
  const chips = [...chipsFuer(spielbar.map((g) => g.id), inApp), ...(soloDa ? [{id:'solo',titel:t('spielwahl.allein')}] : [])];
  // Auf beiden Plattformen abstimmen, soweit der Releaseumfang es erlaubt.
  const mitAbstimmung = imUmfang('abstimmung');

  /*
   * Eine Kachel für „Deine Spiele" — nur für Spiele, die es hier gibt: Ein
   * Favorit oder ein zuletzt gespieltes Spiel, das auf dieser Plattform fehlt
   * (App-Freigabe, Umfang), führte sonst ins Leere. Arenen und Solo-Spiele
   * haben dasselbe Ziel wie in ihren Registern.
   */
  const deineKachel = (id: string, favorit: boolean): React.JSX.Element | null => {
    const herz = favorit ? <FavoritMarke /> : null;
    const spiel = spielbar.find((g) => g.id === id);
    if (spiel && inAppSichtbar(id)) {
      return (
        <button type="button" className="hb-sk" key={id} onClick={() => onOeffne(id)}>
          <span className="hb-sk-bild" style={{ backgroundImage: `url(${bannerFuer(id)})` }} />
          <strong>{t(spiel.nameKey)}</strong>
          {trophaeen(id) > 0 ? (
            <span className="hb-pk">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {zahl(trophaeen(id))}
            </span>
          ) : (
            <small>{tf('spielwahl.spieler', { spanne: sitzSpanne(spiel.seatCounts) })}</small>
          )}
          {herz}
        </button>
      );
    }
    const arena = ARENEN[id];
    if (arena) {
      return (
        <a className="hb-sk" key={id} href={`/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="hb-sk-bild" style={{ backgroundImage: `url(${arena.bild})` }} />
          <strong>{arena.name}</strong>
          <small>{t('spielwahl.deine.arena')}</small>
          {herz}
        </a>
      );
    }
    const solo = SOLO[id];
    const soloHier =
      (id === 'prosubway' && !inApp && mitProSubway) ||
      (id === 'kartenmanufaktur' && mitManufaktur) ||
      (id === 'flyingbro' && mitFlyingbro) ||
      (id === 'browort' && mitBrowort);
    if (solo && soloHier) {
      return (
        <button type="button" className="hb-sk" key={id} onClick={() => onSolo(id)}>
          <span className="hb-sk-bild" style={{ backgroundImage: `url(${solo.bild})`, ...solo.stil }} />
          <strong>{solo.name()}</strong>
          <small>{t('spielwahl.deine.solo')}</small>
          {herz}
        </button>
      );
    }
    return null;
  };

  const baldUnter = (g: GameSummary): string =>
    g.id === 'prosubway' ? t('spielwahl.prosubway.bald') : g.id === 'mehrkampf' ? t('spielwahl.mehrkampf.unter') : tf('spielwahl.spieler', { spanne: sitzSpanne(g.seatCounts) });

  const baldZeile = (g: GameSummary): React.JSX.Element => (
    <div className="hb-bald" key={g.id} role="group" aria-label={t(g.nameKey)}>
      <button type="button" className="hb-bald-flaeche" onClick={() => onBald(t(g.nameKey))}>
        <span className="hb-bald-bild" style={{ backgroundImage: `url(${baldBild(g)})` }} />
        <span className="hb-bald-text">
          <strong>{t(g.nameKey)}</strong>
          <small>
            {g.abstimmbar !== false && mitAbstimmung
              ? tn('spielwahl.mitStimmen', g.votes, { zeile: baldUnter(g), n: zahl(g.votes) })
              : baldUnter(g)}
          </small>
        </span>
      </button>
      {/* Eine Stimme je Konto und angekuendigtem Spiel, vom Server bestaetigt. */}
      {g.abstimmbar !== false && mitAbstimmung ? (
        <button
          type="button"
          className="hb-kn is-stimme"
          disabled={voted.has(g.id) || sendet.has(g.id)}
          onClick={() => void abstimmen(g.id)}
        >
          {voted.has(g.id) ? t('spielwahl.abgestimmt') : sendet.has(g.id) ? t('spielwahl.speichert') : t('spielwahl.dafuer')}
        </button>
      ) : (
        <span className="hb-bald-marke">{t('spielwahl.bald')}</span>
      )}
    </div>
  );

  const karte = (g: GameSummary): React.JSX.Element => (
    <button type="button" className="hb-sk" key={g.id} onClick={() => onOeffne(g.id)}>
      <span className="hb-sk-bild" style={{ backgroundImage: `url(${bannerFuer(g.id)})` }} />
      <strong>{t(g.nameKey)}</strong>
      {trophaeen(g.id) > 0 ? (
        <span className="hb-pk">
          <img src="/hub/symbol-pokal.webp" alt="" />
          {zahl(trophaeen(g.id))}
        </span>
      ) : (
        <small>{tf('spielwahl.spieler', { spanne: sitzSpanne(g.seatCounts) })}</small>
      )}
    </button>
  );

  return (
    <div className="hb-spiele hb-einheitlich">
      <header className="hb-kopfzeile">
        <h1 className="hb-titel">{t('spielwahl.titel')}</h1>
      </header>

      {abstimmFehler && <p role="alert" className="hb-text">{abstimmFehler}</p>}
      <div className="hb-spiele-rolle">
        {/* „Deine Spiele" steht vor den Registern (Robin, B4) und rollt mit
            weg; die Register kleben danach oben, wie vorher über der Liste. */}
        <DeineSpiele
          favoriten={favoriten}
          zuletzt={(me.zuletzt ?? []).map((z) => z.spiel)}
          kachelFuer={deineKachel}
        />
        <div className="hb-chips kategorie-register hb-chips-klebend" role="tablist" aria-label={t('spielwahl.kategorien')}>
          {[{ id: 'alle', titel: t('spielwahl.alle') }, ...chips].map((k) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === k.id}
              key={k.id}
              className={`hb-chip${filter === k.id ? ' is-an' : ''}`}
              onClick={() => {
                setFilter(k.id);
                if (k.id === 'bald') setBaldOffen(true);
              }}
            >
              <KategorieZeichen id={k.id} />
              {k.id === 'denken' ? t('spielwahl.chip.denken') : k.titel}
            </button>
          ))}
        </div>

        {zeige('broremote') && <section className="hb-blk"><h2 className="hb-ab"><Symbol><path d="M3 4h15v11H3z M7 20h7 M10 15v5 M19 12h4v10h-4z"/></Symbol>BroRemote<span className="hb-ab-zusatz">2</span></h2><div className="hb-reihe">{BRO_SPIELE.map(g => <a className="hb-sk" key={g.id} href={`/broremote?spiel=${g.id}`} style={{textDecoration:'none',color:'inherit'}}><span className="hb-sk-bild" style={{backgroundImage:g.id === 'building' ? `url(${g.bild}), url(/broremote/bauwelt.webp)` : `url(${g.bild})`,backgroundSize:g.id === 'building' ? 'auto 95%, cover' : 'cover',backgroundRepeat:'no-repeat',backgroundPosition:'center'}}/><strong>{g.name}</strong><small>{g.spieler}</small></a>)}</div></section>}
        {KATEGORIEN.map((k) => {
          // Reihenfolge der Kategorie, nicht die des Servers
          const liste = spielbar
            .filter((g) => k.spiele.includes(g.id))
            .sort((a, b) => k.spiele.indexOf(a.id) - k.spiele.indexOf(b.id));
          if ((liste.length === 0 && k.id !== 'denken') || !zeige(k.id)) return null;
          if (k.id === 'trink') {
            const party = liste[0]!;
            return <section className="hb-blk" key={k.id}><h2 className="hb-ab"><Symbol>{k.icon}</Symbol>Partykiste</h2>
              {filter === 'trink' && <button className="hb-chip" onClick={() => setFilter('alle')}>‹ Alle Spiele</button>}
              <div className="hb-reihe"><button className="hb-sk" onClick={() => filter === 'trink' ? onPick(party.id) : setFilter('trink')}><span className="hb-sk-bild" style={{backgroundImage:`url(${bannerFuer(party.id)})`}}/><strong>{t(party.nameKey)}</strong><small>{filter === 'trink' ? 'Gemischte Runde' : `${EINZELSPIELE.length} Minispiele`}</small></button>
              {filter === 'trink' && EINZELSPIELE.map(m => <button className="hb-sk" key={m} data-pk-einzel={m} onClick={() => onPick(einzelKennung(m))}><span className="hb-sk-bild" style={{backgroundImage:`url(${bannerFuer(einzelKennung(m))})`}}/><strong>{einzelName(m)}</strong><small>{tf('spielwahl.spieler',{spanne:sitzSpanne(party.seatCounts)})}</small></button>)}
              </div></section>;
          }
          return (
            <section className="hb-blk" key={k.id}>
              <h2 className="hb-ab">
                <Symbol>{k.icon}</Symbol>
                {t(k.titel)}
                <span className="hb-ab-zusatz">{liste.length + (k.id === 'denken' ? 2 : 0)}</span>
              </h2>
              <div className="hb-reihe">{k.id === 'denken' && <a className="hb-sk" href="/ice-clash" style={{textDecoration:'none',color:'inherit'}}><span className="hb-sk-bild" style={{backgroundImage:'url(/ice-clash/titel.webp)'}}/><strong>Bro Ice Clash</strong><small>2–4 · Geheime Züge</small></a>}{k.id === 'denken' && <a className="hb-sk" href="/tanks-online" style={{textDecoration:'none',color:'inherit'}}><span className="hb-sk-bild" style={{backgroundImage:'url(/broremote/ausbau/tanks.webp)'}}/><strong>BroTanks Online</strong><small>{tf('spielwahl.spieler', { spanne: '2–4' })}</small></a>}{liste.map(karte)}</div>
            </section>
          );
        })}

        {weitere.length > 0 && filter === 'alle' && (
          <section className="hb-blk">
            <h2 className="hb-ab">
              {t('spielwahl.weitere')}<span className="hb-ab-zusatz">{weitere.length}</span>
            </h2>
            <div className="hb-reihe">{weitere.map(karte)}</div>
          </section>
        )}

        {zeige('echtzeit') && <section className="hb-blk"><h2 className="hb-ab">Online-Arena</h2><div className="hb-reihe"><a className="hb-sk" href="/ice-clash"><span className="hb-sk-bild" style={{backgroundImage:'url(/ice-clash/titel.webp)'}}/><strong>Bro Ice Clash</strong><small>2–4 Spieler</small></a><a className="hb-sk" href="/tanks-online" style={{textDecoration:'none',color:'inherit'}}><span className="hb-sk-bild" style={{backgroundImage:'url(/broremote/ausbau/tanks.webp)'}}/><strong>BroTanks Online</strong><small>{tf('spielwahl.spieler', { spanne: '2–4' })}</small></a></div></section>}
        {zeige('solo') && soloDa && <section className="hb-blk"><h2 className="hb-ab">{t('spielwahl.allein')}</h2><div className="hb-reihe">
          {!inApp && mitProSubway && <button className="hb-sk" onClick={() => onSolo('prosubway')}><span className="hb-sk-bild" style={{backgroundImage:'url(/hub/banner-prosubway.webp)'}}/><strong>{t('modus.prosubway')}</strong><small>Solo</small></button>}
          {mitManufaktur && <button className="hb-sk" onClick={() => onSolo('kartenmanufaktur')}><span className="hb-sk-bild" style={{backgroundImage:'url(/manufaktur/werkstatt-hero.webp)'}}/><strong>Kartenmanufaktur</strong><small>Solo</small></button>}
          {mitFlyingbro && <button className="hb-sk" onClick={() => onSolo('flyingbro')}><span className="hb-sk-bild" style={{backgroundImage:'url(/flyingbro/bro-pelle-flug.webp)',backgroundSize:'contain',backgroundRepeat:'no-repeat'}}/><strong>Flying Bro</strong><small>Solo</small></button>}
          {mitBrowort && <button className="hb-sk" onClick={() => onSolo('browort')}><span className="hb-sk-bild" style={{backgroundImage:'url(/hub/browort-icon.webp)'}}/><strong>Browort</strong><small>Solo</small></button>}
        </div></section>}

        {/* Der Bock ist seit dem 28.11.2026 spielbar — dann auf Webseite UND in
            der App eine echte Karte unter „Modi" statt der Bald-Marke. */}
        {filter === 'alle' && onBock && imUmfang('mehrkampf') && (
          <section className="hb-blk">
            <h2 className="hb-ab">
              <Symbol>
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
              </Symbol>
              {t('spielwahl.modi')}
            </h2>
            <div className="hb-reihe">
              <button type="button" className="hb-sk" onClick={onBock}>
                <span className="hb-sk-bild" style={{ backgroundImage: 'url(/hub/banner-mehrkampf.webp)' }} />
                <strong>{t('modus.mehrkampf')}</strong>
                <small>{t('spielwahl.mehrkampf.unter')}</small>
              </button>
            </div>
          </section>
        )}

        {filter === 'alle' && !inApp && (
          <>
            {/* Der Mehrkampf ist noch nicht gebaut: ehrliche „Bald"-Marke (DESIGN.md).
                Kündigt der Server ihn an (seit 26.10.2026 auch auf der Webseite,
                abstimmModiFuer in registry.ts), steht er wie in der App unter
                „Kommt bald" mit Stimme — die feste Marke bleibt nur, wenn die
                Abstimmung nicht im Umfang ist, sonst stünde er doppelt da.
                Ohne `mehrkampf` im Umfang fehlt auch die Marke: Was dort nicht
                steht, ist auf der Webseite weg (server/src/umfang.ts). */}
            {!onBock && imUmfang('mehrkampf') && !bald.some((g) => g.id === 'mehrkampf') && (
            <section className="hb-blk">
              <h2 className="hb-ab">
                <Symbol>
                  <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
                </Symbol>
                {t('spielwahl.modi')}
              </h2>
              <button
                type="button"
                className="hb-sk"
                onClick={() => onBald(t('modus.mehrkampf'))}
              >
                <span className="hb-sk-bild" style={{backgroundImage:'url(/hub/banner-mehrkampf.webp)'}}/><strong>{t('modus.mehrkampf')}</strong>
                <span className="hb-bald-marke">{t('spielwahl.bald')}</span>
              </button>
            </section>
            )}

            {bald.length > 0 && (
              <section className="hb-blk">
                <h2 className="hb-ab">
                  <Symbol>
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4l3 2" />
                  </Symbol>
                  {t('spielwahl.kategorie.bald')}
                  <span className="hb-ab-zusatz">{t('spielwahl.stimmAb')}</span>
                </h2>
                <div className="hb-liste">{bald.map(baldZeile)}</div>
              </section>
            )}
          </>
        )}

        {/*
         * Die App zeigt in ihrer ersten Fassung nur einen Teil der Spiele
         * (Emile, 13.10.2026). Der Rest steht zugeklappt in einer eigenen
         * Kategorie: sichtbar, dass mehr kommt, ohne die Auswahl zu fluten.
         */}
        {inApp && (filter === 'alle' || filter === 'bald') && (
          <section className="hb-blk hb-kommt-bald">
            <button
              type="button"
              className="hb-ab hb-ab-knopf"
              aria-expanded={baldOffen}
              onClick={() => setBaldOffen((alt) => !alt)}
            >
              <Symbol>
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4l3 2" />
              </Symbol>
              {t('spielwahl.kategorie.bald')}
              <span className="hb-ab-zusatz">{bald.length}</span>
              <Symbol>
                <path d="m6 9 6 6 6-6" />
              </Symbol>
            </button>
            {baldOffen && (
              <div className="hb-liste">
                {bald.map(baldZeile)}
              </div>
            )}
          </section>
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
  onLernen,
  favorit,
  onFavorit,
  favoritFehler,
}: {
  game: GameSummary;
  me: Me;
  onZurueck: () => void;
  onZumSpiel: () => void;
  onSammlung: (art?: SammelBereich) => void;
  onLernen?: () => void;
  favorit: boolean;
  onFavorit: (an: boolean) => void;
  favoritFehler: string | null;
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
  const einzahl = kat ? t(kat.einzahl) : null;
  // Verglichen wird der Text: Feldherr ist „Echtzeit" in „Echtzeit" — doppelt stünde es sonst da.
  const zusatz = ZUSATZ.has(game.id) ? t(`spielwahl.zusatz.${game.id}`) : null;
  const unterzeile = [
    tf('spielwahl.spieler', { spanne: sitzSpanne(game.seatCounts) }),
    einzahl,
    zusatz && zusatz !== einzahl ? zusatz : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const quote = stat && stat.parties > 0 ? Math.round((stat.wins / stat.parties) * 100) : null;
  const thema = me.themes[game.id];
  const deck = deckForGame(game.id, thema?.cardDeck);
  const vorschaukarten = game.id === 'wizard'
    ? [{ id: 1, suit: 'Z', rank: '1' }, { id: 2, suit: 'H', rank: '13' }, { id: 3, suit: 'C', rank: '7' }]
    : game.id === 'cambio' ? [{ id: 1, suit: 'H', rank: '13' }, { id: 2, suit: 'C', rank: '7' }, { id: 3, suit: 'D', rank: '1' }]
    : [{ id: 1, suit: 'C', rank: 'Q' }, { id: 2, suit: 'H', rank: 'T' }, { id: 3, suit: 'D', rank: 'A' }];
  // Dieselbe persönliche Rückseite wie am Spieltisch, statt immer der Standardrückseite.
  const rueckenDeck = { ...deck, ...(thema?.cardBack && thema.cardBack !== 'standard' ? { backSrc: rueckenBild(thema.cardBack) ?? undefined } : {}) };
  const szene = SZENEN.find((s) => s.id === thema?.tableScene) ?? SZENEN[0]!;

  return (
    <div className="hb-spielseite">
      <div className="hb-sp-kopf" style={{ backgroundImage: `url(${bannerFuer(game.id)})` }}>
        <button type="button" className="hb-rund" onClick={onZurueck} aria-label={t('spielwahl.seite.zurueck')}>
          <Symbol>
            <path d="M15 5l-7 7 7 7" />
          </Symbol>
        </button>
        {/* Gegenüber dem Zurück-Knopf, im selben runden Holzknöpfchen
            (Plan, Abschnitt 5). aria-pressed sagt den Zustand, der Name
            bleibt gleich — „Favorit entfernen" und „merken" im Wechsel
            verwirren beim Vorlesen mehr, als sie helfen. */}
        <button
          type="button"
          className={`hb-rund hb-sp-herz${favorit ? ' is-an' : ''}`}
          aria-pressed={favorit}
          aria-label={tf('spielwahl.favorit.knopf', { spiel: t(game.nameKey) })}
          onClick={() => onFavorit(!favorit)}
        >
          <Herz voll={favorit} />
        </button>
        <div className="hb-sp-titel">
          <h1>{t(game.nameKey)}</h1>
          <span>{unterzeile}</span>
        </div>
      </div>
      <div className="hb-sp-inhalt">
        {favoritFehler && <p role="alert" className="hb-text">{favoritFehler}</p>}
        <button type="button" className="hb-kn is-gold is-haupt is-breit hb-sp-start" onClick={onZumSpiel}>
          <img src="/hub/start-einstiege/play.webp" alt="" draggable={false} />
          {t('spielwahl.seite.zumSpiel')}
        </button>

        {MIT_THEMEN.has(game.id) && (
          <section className="hb-blk hb-sp-ausstattung">
            <h2 className="hb-ab">
              {tf('spielwahl.seite.deinSpiel', { spiel: t(game.nameKey) })}
              <button type="button" className="hb-ab-mehr hb-sp-sammlung" onClick={() => onSammlung()}>
                <HubBildIcon motiv="collection" />{t('spielwahl.seite.sammlung')}
              </button>
            </h2>
            <div className="hb-sp-kartenvorschau" role="group" aria-label={t('spielwahl.seite.vorschau')} style={{ backgroundImage: `linear-gradient(#08162f33,#08162f44),url(${szeneBild(szene.id)})` }}>
              <span className="hb-sp-probekarten">{vorschaukarten.map(karte => <span className="pc" key={karte.id}><CardFront card={karte} deck={deck} /></span>)}<span className="pc ist-ruecken" aria-label={t('spielwahl.seite.ruecken')}><CardBack deck={rueckenDeck} /></span></span>
              <span className="hb-sp-probetext">{t(deck.nameKey)} · {szene.name}</span>
            </div>
            <div className="hb-sp-designwahl">
              {([
                ['blatt', t('spielwahl.seite.blatt'), t(deck.nameKey)],
                ['szene', t('spielwahl.seite.tisch'), szene.name],
                ['ruecken', t('sammlung.ruecken'), RUECKEN.find(r => r.id === thema?.cardBack)?.name ?? RUECKEN[0]!.name],
              ] as const).map(([art, name, wert]) => (
                <button key={art} type="button" aria-label={`${name}: ${wert}`} onClick={() => onSammlung(art)}>
                  <SammelIcon art={art} /><span><small>{name}</small><strong>{wert}</strong></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {game.id === 'brochess' && (
          <button type="button" className="hb-sp-figurenauswahl" onClick={() => onSammlung('blatt')}>
            <SammlungVorschau art="blatt" spiel="brochess" wert={thema?.cardDeck ?? 'text'} />
            <span><SammelIcon art="figuren" /><strong>{t('sammlung.figuren')}</strong><small>{t('spielwahl.seite.sammlung')}</small></span>
          </button>
        )}
        {onLernen && (
          <button type="button" className="hb-kn is-stimme is-haupt is-breit" onClick={onLernen}>
            {t('spielwahl.seite.lernen')}
          </button>
        )}


        <div className="hb-sp-status">
          <div className="hb-sp-zahl">
            <span className="hb-sp-pokal">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {zahl(eigene)}
            </span>
            <span className="hb-klein">
              {ich ? (
                <>
                  {tf('spielwahl.seite.platz', { rang: zahl(ich.rank) })}
                  <br />
                  {t('spielwahl.seite.inDeutschland')}
                </>
              ) : (
                t('spielwahl.seite.nichtInRangliste')
              )}
            </span>
          </div>
          <div className="hb-sp-anteil">
            <span className="hb-klein">
              {/* „0 von 0" sah nach einem Rechenfehler aus; ohne eine einzige
                  Trophäe gibt es noch keinen Anteil, nur eine Einladung. */}
              {gesamt > 0 ? (
                <>
                  {t('spielwahl.seite.beitrag')} <b>{tf('spielwahl.seite.beitragZahl', { eigene: zahl(eigene), gesamt: zahl(gesamt) })}</b>
                </>
              ) : (
                t('spielwahl.seite.einladung')
              )}
            </span>
            <span className="hb-balken" aria-hidden="true">
              <span style={{ width: `${gesamt > 0 ? Math.round((eigene / gesamt) * 100) : 0}%` }} />
            </span>
          </div>
          <div className="hb-sp-werte">
            <span>
              <b>{zahl(stat?.parties ?? 0)}</b>{t('spielwahl.seite.partien')}
            </span>
            <span>
              <b>{zahl(stat?.wins ?? 0)}</b>{t('spielwahl.seite.siege')}
            </span>
            <span>
              <b>{quote === null ? '-' : `${quote} %`}</b>{t('spielwahl.seite.quote')}
            </span>
          </div>
        </div>

        <section className="hb-blk">
          <h2 className="hb-ab">
            {tf('spielwahl.seite.rangliste', { spiel: t(game.nameKey) })}
            <span className="hb-ab-zusatz">{t('spielwahl.seite.deutschland')}</span>
          </h2>
          <div className="hb-liste">
            {rangliste === null ? (
              <p className="hb-klein hb-liste-leer">{t('spielwahl.seite.ranglisteLaedt')}</p>
            ) : !erster ? (
              <p className="hb-klein hb-liste-leer">{t('spielwahl.seite.ranglisteLeer')}</p>
            ) : (
              [erster, ...(ich && ich.accountId !== erster.accountId ? [ich] : [])].map((e) => (
                <div className={`hb-rl${e.accountId === me.id ? ' is-du' : ''}`} key={e.accountId}>
                  <span className="hb-rl-rang">{e.rank}</span>
                  <strong>{e.accountId === me.id ? t('spielwahl.seite.du') : e.displayName}</strong>
                  <span className="hb-pk">
                    <img src="/hub/symbol-pokal.webp" alt="" />
                    {zahl(e.trophies)}
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
