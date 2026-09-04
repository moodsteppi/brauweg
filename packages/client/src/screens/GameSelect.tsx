import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { Ladekreis } from '../Ladekreis';
import { CardFront } from '../CardFace';

import {
  ApiError,
  SLOTS,
  api,
  type FriendLists,
  type GameSummary,
  type Kauffund,
  type Kauftruhe,
  type Me,
  type Paket,
  type PlayerRef,
  type RankingEntry,
  type RegalWare,
  type Waehrung,
  type Shop as ShopDaten,
} from '../api';
import { inApp } from '../laufzeit';
import {
  DECKS,
  RUECKEN,
  cardImage,
  deckBack,
  deckById,
  decksFor,
  rueckenBild,
  type Deck,
} from '../decks';
import { SZENEN, szeneBild } from '../szenen';
import { emoteBild, emoteMit } from '../emotes';
import {
  MUSIK_NAMEN,
  PAKET_NAMEN,
  abonniere,
  laufendeProbe,
  probeMusik,
  probePaket,
  spiele,
} from '../klang';
import { EinstellungenBlatt } from './Einstellungen';
import {
  EdelsteinIcon,
  HubBanner,
  HubSzene,
  StatHero,
  StatKachel,
  StatSpiel,
  Tafel,
  spielBanner,
} from '../hub';
import { EilandBanner } from '../minispiele/eiland/Banner';
import { FillerBanner } from '../minispiele/filler/Banner';
import { TafelrundeBanner } from '../minispiele/tafelrunde/Banner';
import { MememoryBanner } from '../minispiele/mememory/Banner';
import { Pinguin } from '../pinguin';
import { Kreuz, Note } from '../zeichen';
import { Clan } from './Clan';
import { Aufgabenblatt, FundBlatt, TruhenBild } from './Aufgaben';
import { Kleiderschrank } from './Kleiderschrank';
import { Klanghalle } from './Klanghalle';
import { Avatarwerkstatt } from './Avatarwerkstatt';
import { LEERE_BEMALUNG } from '../bemalung';

/**
 * Die 3D-Figur wird nachgeladen: `three` und `drei` wiegen rund 900 kB. Bis
 * sie da ist, steht der gemalte Pinguin als Rueckfall — siehe die Stelle im
 * Profil-Tab.
 */
const Avatar3D = lazy(() => import('../Avatar3D'));
import { Stufenbalken, Stufenleiter } from './Stufen';
import { Rechtliches } from './Auth';
import { cardLabel, cardName, isRed, kompakteZahl, t } from '../i18n';
import { Trophaeenpfad } from './Pfad';

/**
 * Startbildschirm im Stil eines Handyspiels: unten die Tab-Leiste mit
 * "Spielen" in der Mitte, oben die Ressourcen-Leiste mit Level, Muenzen und
 * VIP. Was es noch nicht gibt - Shop, Muenzen kaufen, Tagesbonus, Level -,
 * steht trotzdem schon da, mit ehrlichen Nullen und einem "Kommt bald" beim
 * Antippen: Die Oberflaeche zeigt, wohin die Reise geht. Handy ist der
 * Massstab - im breiten Browser bleibt die Flaeche auf Handybreite begrenzt.
 */

type Tab = 'shop' | 'clan' | 'spielen' | 'blatt' | 'profil';

/**
 * Im App-Store-Paket bleibt alles Kaufbare draussen.
 *
 * Nicht aus Vorsicht, sondern weil es ein sicherer Ablehnungsgrund ist:
 * Angebote mit Paketangabe ("Season Pass", "VIP-Pass, 7 Tage"), die nichts
 * verkaufen, gelten Apple als unfertige App — und sobald sie etwas
 * verkaufen, muessen sie ueber Apples Bezahlweg laufen. Beides ist heute
 * nicht der Fall, also zeigt die App den Bereich gar nicht erst.
 *
 * Im Browser bleibt er sichtbar. Dort gilt DESIGN.md: Was es noch nicht
 * gibt, steht trotzdem da, mit ehrlicher Null und "Bald"-Marke.
 * Siehe docs/APPSTORE.md.
 */
const zeigeKaufbares = !inApp;

export function GameSelect({
  me,
  onPick,
  onSolo,
  onResume,
  onThemeChange,
  onAvatarChange,
  onShowProfile,
  onSignOut,
  onDeleted,
}: {
  me: Me;
  onPick: (gameId: string) => void;
  /** Solo-Minispiele aus der Spielauswahl (z. B. Pro-Subway). */
  onSolo: (modusId: string) => void;
  onResume: (gameId: string, tableId: string) => void;
  onThemeChange: (
    gameId: string,
    teil: { cardDeck?: string; tableScene?: string; cardBack?: string },
  ) => void;
  onAvatarChange: () => void;
  onShowProfile: (accountId: string) => void;
  onSignOut: () => void;
  /** Nach der Kontoloeschung: zurueck zur Anmeldung. */
  onDeleted: () => void;
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('spielen');
  /** Name des angetippten Noch-nicht-Bereichs, fuer das "Kommt bald"-Blatt. */
  const [bald, setBald] = useState<string | null>(null);
  const [ranglisteOffen, setRanglisteOffen] = useState(false);
  const [stufenOffen, setStufenOffen] = useState(false);
  /**
   * Tagesaufgaben und Truhen.
   *
   * Als Vollbild und nicht als sechster Tab: Die Tab-Leiste hat laut DESIGN.md
   * fuenf Plaetze mit "Spielen" mittig und groesser — ein sechster nimmt die
   * Mitte weg, und damit die einzige Stelle, die man ohne Hinsehen trifft.
   */
  const [aufgabenOffen, setAufgabenOffen] = useState(false);
  const [schrankOffen, setSchrankOffen] = useState(false);
  const [klanghalleOffen, setKlanghalleOffen] = useState(false);
  const [werkstattOffen, setWerkstattOffen] = useState(false);
  const trophies = me.stats.reduce((sum, stat) => sum + stat.trophies, 0);

  /**
   * Wie viele Menschen gerade an irgendeinem Tisch sitzen — die Zahl oben
   * rechts. null, solange sie nie geladen wurde: Dann bleibt die Pille weg,
   * eine geratene 0 saehe nach leerer Plattform aus, obwohl nur der Abruf
   * scheiterte.
   */
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    let lebt = true;
    const hole = (): void => {
      void api
        .aktiveGesamt()
        .then((antwort) => {
          if (lebt) setOnline(antwort.aktiv);
        })
        .catch(() => {
          /* Beiwerk. Ein Fehlversuch laesst die letzte Zahl stehen. */
        });
    };
    hole();
    const takt = window.setInterval(hole, 15000);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, []);

  /**
   * Zwischen den Tabs wird gezogen, nicht nur getippt.
   *
   * Beim waagerechten Ziehen folgt der Inhalt dem Finger, und die Nachbarseite
   * schaut schon herein — man zieht ein Stueck, haelt, sieht die naechste, und
   * beim Loslassen rastet sie ein oder federt zurueck. Die Reihenfolge ist die
   * der Leiste unten (im App-Paket ohne Shop), damit Ziehen und Tippen zum
   * selben Ort fuehren.
   *
   * Der laufende Zug steuert den Track direkt ueber `trackRef` (kein Rendern je
   * Fingerbewegung, sonst ruckelt es); React rendert nur bei Zugbeginn (um die
   * Nachbarn zu haengen) und beim Einrasten.
   */
  const tabFolge: Tab[] = [
    ...(zeigeKaufbares ? (['shop'] as const) : []),
    'clan',
    'spielen',
    'blatt',
    'profil',
  ];
  const [ziehen, setZiehen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const geste = useRef<{
    x: number;
    y: number;
    achse: '?' | 'h' | 'v';
    dx: number;
    breite: number;
    mitte: number;
    hatPrev: boolean;
    hatNext: boolean;
  } | null>(null);
  const schnappRef = useRef<number | undefined>(undefined);

  const idx = tabFolge.indexOf(tab);
  const prevTab = idx > 0 ? tabFolge[idx - 1]! : null;
  const nextTab = idx < tabFolge.length - 1 ? tabFolge[idx + 1]! : null;
  // Nachbarn haengen nur waehrend eines Zugs am Baum - sonst laedt der
  // Startbildschirm alle Tabs auf einmal.
  const fenster: Tab[] = ziehen
    ? ([prevTab, tab, nextTab].filter(Boolean) as Tab[])
    : [tab];
  const mitteIdx = fenster.indexOf(tab);

  // Grundstand des Tracks, wenn gerade nicht gezogen oder eingerastet wird.
  // Der Zug selbst setzt den transform direkt; deshalb hier ausgespart.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || geste.current || schnappRef.current) return;
    el.style.transition = 'none';
    el.style.transform = `translateX(${-mitteIdx * 100}%)`;
  }, [ziehen, tab, mitteIdx]);

  const onZiehStart = (e: React.TouchEvent): void => {
    if (geste.current || schnappRef.current) return;
    // In einer Vollbild-Auswahl steuert der Zug die Auswahl, nicht den Tab.
    if (
      (e.target as HTMLElement).closest(
        '.spielwahl, .hub-vorschau, .doko-sheet, .front-bald, .pfad-voll',
      )
    ) {
      return;
    }
    const t = e.touches[0]!;
    geste.current = {
      x: t.clientX,
      y: t.clientY,
      achse: '?',
      dx: 0,
      breite: e.currentTarget.clientWidth || window.innerWidth,
      mitte: idx > 0 ? 1 : 0,
      hatPrev: idx > 0,
      hatNext: idx < tabFolge.length - 1,
    };
  };

  const onZiehen = (e: React.TouchEvent): void => {
    const g = geste.current;
    if (!g) return;
    const t = e.touches[0]!;
    let dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.achse === '?') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Klar waagerecht? Sonst ist es ein senkrechtes Rollen und wird in Ruhe
      // gelassen.
      g.achse = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
      if (g.achse === 'h') setZiehen(true);
    }
    if (g.achse !== 'h') return;
    // Am Rand ohne Nachbarseite: Gummiband, damit man nicht ins Leere zieht.
    if ((dx < 0 && !g.hatNext) || (dx > 0 && !g.hatPrev)) dx *= 0.32;
    g.dx = dx;
    const el = trackRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = `translateX(calc(${-g.mitte * 100}% + ${dx}px))`;
    }
  };

  const onZiehEnde = (): void => {
    const g = geste.current;
    geste.current = null;
    if (!g || g.achse !== 'h') {
      if (g) setZiehen(false);
      return;
    }
    const schwelle = Math.min(72, g.breite * 0.22);
    let richtung = 0;
    if (g.dx <= -schwelle && g.hatNext) richtung = 1;
    else if (g.dx >= schwelle && g.hatPrev) richtung = -1;
    schnappen(g.mitte, richtung);
  };

  const schnappen = (mitte: number, richtung: number): void => {
    const el = trackRef.current;
    const fertig = (): void => {
      schnappRef.current = undefined;
      if (el) el.style.transition = 'none';
      setZiehen(false);
      if (richtung !== 0) {
        const jetzt = tabFolge.indexOf(tab);
        const ziel = jetzt + richtung;
        if (ziel >= 0 && ziel < tabFolge.length) setTab(tabFolge[ziel]!);
      }
    };
    const wenigerBewegung =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!el || wenigerBewegung) {
      fertig();
      return;
    }
    el.style.transition = 'transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1)';
    el.style.transform = `translateX(${-(mitte + richtung) * 100}%)`;
    schnappRef.current = window.setTimeout(fertig, 250);
  };

  const renderTab = (tt: Tab): React.JSX.Element | null => {
    switch (tt) {
      case 'shop':
        return zeigeKaufbares ? (
          <Shop coins={me.coins} gems={me.gems} onBald={setBald} onGuthaben={onAvatarChange} />
        ) : null;
      case 'clan':
        return (
          <Clan
            clanId={me.clubs[0]?.id ?? null}
            meId={me.id}
            onBald={setBald}
            onShowProfile={onShowProfile}
            onMeChange={onAvatarChange}
          />
        );
      case 'spielen':
        return (
          <Spielen
            trophies={trophies}
            getragen={me.avatar}
            bemalung={me.figur ?? null}
            activeTable={me.activeTable}
            onPick={onPick}
            onSolo={onSolo}
            onResume={onResume}
            onBald={setBald}
            onRangliste={() => setRanglisteOffen(true)}
            onAufgaben={() => setAufgabenOffen(true)}
            bereit={me.bereit.truhen + me.bereit.aufgaben}
          />
        );
      case 'blatt':
        return <ThemenTab me={me} onThemeChange={onThemeChange} onGekauft={onAvatarChange} />;
      case 'profil':
        return (
          <ProfilTab
            me={me}
            onAvatarChange={onAvatarChange}
            onMeChange={onAvatarChange}
            onSignOut={onSignOut}
            onDeleted={onDeleted}
            onStufen={() => setStufenOffen(true)}
            onSchrank={() => setSchrankOffen(true)}
            onKlanghalle={() => {
              spiele('blatt-auf');
              setKlanghalleOffen(true);
            }}
            onWerkstatt={() => {
              spiele('blatt-auf');
              setWerkstattOffen(true);
            }}
            onAufgaben={() => setAufgabenOffen(true)}
            onBald={setBald}
            onShowProfile={onShowProfile}
          />
        );
    }
  };

  return (
    <div className="front front--hub">
      <header className="front-top">
        {/* Level und Name fuehren zum Profil-Tab. Das Level ist ehrlich Null -
            das System dahinter kommt noch, der Platz dafuer steht schon. */}
        <button className="front-spieler" onClick={() => setTab('profil')}>
          {/*
            Oben links das Profilbild. Die Figur steht schon vorne auf dem
            Pfad — sie ein zweites Mal ins Kopfband zu setzen war dieselbe
            Figur zweimal. Ist ein Bild hochgeladen, steht es hier.

            Ohne hochgeladenes Bild der gemalte Pinguin als Rueckfall, NICHT
            der 3D-Avatar: Das Kopfband ist auf jedem Tab zu sehen, ein zweiter
            WebGL-Bereich nur fuer den Rueckfall waere teuer — und der 3D-Avatar
            braucht WASM, das die Content-Security-Policy am ausgelieferten
            Stand blockiert (scriptSrc 'self', ohne 'wasm-unsafe-eval'). Der
            gemalte Pinguin laedt nichts nach und kann nicht scheitern. */}
          {me.avatarUrl ? (
            <img className="front-avatar" src={me.avatarUrl} alt="" draggable={false} />
          ) : (
            <Pinguin getragen={me.avatar} groesse={2.6} className="front-avatar" />
          )}
          <span className="front-spieler-info">
            <strong>{me.displayName}</strong>
            {/* Der Balken zeigt den Fortschritt IN der Stufe, nicht die
                Gesamtpunkte — sonst stuende er ab Stufe zehn dauerhaft
                fast am Anschlag. */}
            <span className="front-xp" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, Math.round((me.level.imLevel / Math.max(1, me.level.fuerLevel)) * 100))}%`,
                }}
              />
            </span>
          </span>
          <span
            className="front-level front-level--hub"
            aria-label={`Stufe ${me.level.stufe}, ${me.level.imLevel} von ${me.level.fuerLevel} Punkten`}
          >
            {me.level.stufe}
          </span>
        </button>
        <div className="front-waehrungen">
          {/* Nur noch das Testkonto in der Produktion bekommt ein Schild —
              das braucht die App-Store-Prüfung, damit die Prüfer sehen, dass
              sie auf einem Demokonto sitzen.

              Auf staging hing es dauerhaft im Bild und stand beim Prüfen der
              Optik im Weg. Wer dort ist, weiß es an der Adresse. */}
          {me.stage === 'production' && me.entitlements.staff && (
            <span className="front-stufe" title="Testkonto, hier wird nichts gewertet">
              Test
            </span>
          )}
          {/* Oben rechts zuerst: wie viele gerade an Tischen sitzen. Nur wenn
              die Zahl je geladen wurde — siehe Kommentar am Zustand. */}
          {online !== null && (
            <span
              className="front-waehrung front-online"
              aria-label={`${online} Spieler gerade online`}
              title="Spieler gerade an Tischen"
            >
              <span className="front-online-punkt" aria-hidden="true" />
              {kompakteZahl(online)}
            </span>
          )}
          <span className="front-waehrung front-waehrung--cups">
            {/* `pokal-zeile` statt `pokal.png`: derselbe Pokal, aber fuer
                Zeilenhoehe gemalt — der alte war ein Bild fuer grosse Flaechen
                und wurde in der Kopfleiste matschig. */}
            <img className="front-waehrung-icon" src="/hub/pokal-zeile.webp" alt="" />
            {kompakteZahl(trophies)}
          </span>
          {/*
            Die beiden Waehrungen. Der VIP-Platz mit der Krone stand hier als
            Attrappe und ist jetzt der Edelstein: VIP ist kein Guthaben, sondern
            ein Zeitraum, und gehoert damit ins Shop-Regal und nicht in die
            Ressourcen-Leiste. So bleiben es drei Pillen wie bisher — vier waeren
            auf einem Hochkant-Handy eine zu viel.

            Das Plus fuehrt in den Shop, wo Pakete mit Preis stehen und beim
            Antippen "Kommt bald" sagen. Ohne Kaufbares (App-Paket) bleiben es
            reine Anzeigen: Ein Plus, das nirgendwohin fuehrt, ist ein Versprechen.
          */}
          {zeigeKaufbares ? (
            <>
              <button
                className="front-waehrung front-waehrung--muenzen"
                onClick={() => setTab('shop')}
                aria-label={`${me.coins} Münzen, zum Shop`}
              >
                <img className="front-waehrung-icon" src="/hub/muenze.png" alt="" />
                {kompakteZahl(me.coins)}
                <span className="front-plus" aria-hidden="true">
                  +
                </span>
              </button>
              <button
                className="front-waehrung front-waehrung--edelsteine"
                onClick={() => setTab('shop')}
                aria-label={`${me.gems} Edelsteine, zum Shop`}
              >
                <EdelsteinIcon />
                {kompakteZahl(me.gems)}
                <span className="front-plus" aria-hidden="true">
                  +
                </span>
              </button>
            </>
          ) : (
            <>
              <span className="front-waehrung front-waehrung--muenzen">
                <img className="front-waehrung-icon" src="/hub/muenze.png" alt="" />
                {kompakteZahl(me.coins)}
              </span>
              <span className="front-waehrung front-waehrung--edelsteine">
                <EdelsteinIcon />
                {kompakteZahl(me.gems)}
              </span>
            </>
          )}
        </div>
      </header>

      <div
        className="front-viewport"
        onTouchStart={onZiehStart}
        onTouchMove={onZiehen}
        onTouchEnd={onZiehEnde}
        onTouchCancel={onZiehEnde}
      >
        <div className="front-track" ref={trackRef}>
          {fenster.map((tt) => (
            <div
              className={`front-body${tt === 'spielen' ? '' : ' front-body--szene'}`}
              key={tt}
            >
              {renderTab(tt)}
            </div>
          ))}
        </div>
      </div>

      <nav className="front-tabs" aria-label="Bereiche">
        {zeigeKaufbares && (
          <TabButton
            label="Shop"
            farbe="shop"
            active={tab === 'shop'}
            onClick={() => setTab('shop')}
            iconSrc="/hub/tab-shop.webp"
          />
        )}
        <TabButton
          label="Clan"
          farbe="clan"
          active={tab === 'clan'}
          onClick={() => setTab('clan')}
          iconSrc="/hub/tab-clan.webp"
        />
        <TabButton
          label="Spielen"
          haupt
          farbe="spielen"
          active={tab === 'spielen'}
          onClick={() => setTab('spielen')}
          iconSrc="/hub/tab-spielen.webp"
        />
        <TabButton
          label="Themen"
          farbe="blatt"
          active={tab === 'blatt'}
          onClick={() => setTab('blatt')}
          iconSrc="/hub/tab-blatt.webp"
        />
        <TabButton
          label="Profil"
          farbe="profil"
          active={tab === 'profil'}
          onClick={() => setTab('profil')}
          iconSrc="/hub/tab-profil.webp"
        />
      </nav>

      {stufenOffen && <Stufenleiter onClose={() => setStufenOffen(false)} />}
      {aufgabenOffen && (
        <Aufgabenblatt onClose={() => setAufgabenOffen(false)} onGuthaben={onAvatarChange} />
      )}
      {schrankOffen && (
        <Kleiderschrank
          getragen={me.avatar}
          onClose={() => setSchrankOffen(false)}
          onGetragen={onAvatarChange}
          onGuthaben={onAvatarChange}
        />
      )}
      {klanghalleOffen && <Klanghalle onClose={() => setKlanghalleOffen(false)} />}
      {werkstattOffen && (
        <Avatarwerkstatt
          bemalung={me.figur ?? null}
          getragen={me.avatar}
          onClose={() => setWerkstattOffen(false)}
          // Neu laden, damit die Figur im Profil sofort so aussieht wie
          // gerade gespeichert.
          onGespeichert={() => onAvatarChange()}
        />
      )}
      {bald && <BaldBlatt name={bald} onClose={() => setBald(null)} />}
      {ranglisteOffen && (
        <RanglisteBlatt meId={me.id} onClose={() => setRanglisteOffen(false)} onShowProfile={onShowProfile} />
      )}
    </div>
  );
}

/**
 * "Kommt bald"-Blatt (Entwurf A): schlicht — Zeichen, Titel, ein Satz, CTA.
 * Kein Fortschritt, keine Feature-Liste. Tip auf Hintergrund schließt.
 */
function BaldBlatt({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card front-bald" onClick={(event) => event.stopPropagation()}>
        <span className="front-bald-zeichen" aria-hidden="true">
          🔨
        </span>
        <h2>Kommt bald!</h2>
        <p className="muted">Daran bauen wir gerade: {name}.</p>
        <button className="primary" onClick={onClose}>
          Alles klar
        </button>
      </div>
    </div>
  );
}

/**
 * Profil-Tab: Kopf, Pokal-Hero, Raster und Je Spiel (Entwurf A).
 *
 * Die Zahlen kommen aus me.stats und sind ehrlich — auch wenn überall Null
 * steht. Geburtstag: Countdown und einmal im Jahr die Outfit-Belohnung.
 */
function ProfilTab({
  me,
  onAvatarChange,
  onMeChange,
  onSignOut,
  onDeleted,
  onStufen,
  onSchrank,
  onKlanghalle,
  onWerkstatt,
  onAufgaben,
  onBald,
  onShowProfile,
}: {
  me: Me;
  onAvatarChange: () => void;
  /** Nach Claim u. a. /api/me neu laden. */
  onMeChange: () => void;
  onSignOut: () => void;
  /** Nach der Loeschung: zurueck zur Anmeldung, ohne Abmelde-Aufruf. */
  onDeleted: () => void;
  /** Oeffnet die Stufenleiter. */
  onStufen: () => void;
  /** Oeffnet den Kleiderschrank. */
  onSchrank: () => void;
  /** Oeffnet die Klanghalle — Musik und Klangpakete auswaehlen. */
  onKlanghalle: () => void;
  /** Oeffnet die Avatar-Werkstatt: drehen, anmalen, Muetze. */
  onWerkstatt: () => void;
  /** Oeffnet Tagesaufgaben und Truhen. */
  onAufgaben: () => void;
  onBald: (name: string) => void;
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  const partien = me.stats.reduce((sum, s) => sum + s.parties, 0);
  const siege = me.stats.reduce((sum, s) => sum + s.wins, 0);
  const trophaeen = me.stats.reduce((sum, s) => sum + s.trophies, 0);
  const quote = partien > 0 ? `${Math.round((siege / partien) * 100)} %` : '–';
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);

  const kacheln = [
    { icon: '/hub/tab-spielen.webp', name: 'Partien', wert: partien },
    { icon: '/hub/krone.png', name: 'Siege', wert: siege },
    { icon: '/hub/muenze.png', name: 'Siegquote', wert: quote },
    { icon: '/hub/tab-blatt.webp', name: 'Blätter', wert: DECKS.length },
  ];

  const geburtstagText = (() => {
    if (me.daysUntilBirthday === null) return 'Geburtstag noch nicht hinterlegt';
    if (me.daysUntilBirthday === 0) return 'Heute ist dein Geburtstag!';
    if (me.daysUntilBirthday === 1) return 'Noch 1 Tag bis zum Geburtstag';
    return `Noch ${me.daysUntilBirthday} Tage bis zum Geburtstag`;
  })();

  const claimReward = (): void => {
    if (claimBusy) return;
    setClaimBusy(true);
    setClaimError(null);
    void api
      .claimBirthdayReward()
      .then(() => onMeChange())
      .catch((err: unknown) => {
        setClaimError(
          err instanceof ApiError ? t(err.messageKey) : 'Belohnung konnte nicht geholt werden.',
        );
      })
      .finally(() => setClaimBusy(false));
  };

  return (
    <HubSzene bg="/hub/bg-profil.webp" className="front-profil front-profil--a">
      <HubBanner />

      {/* Als Erstes im Profil: Wo stehe ich, und wie weit ist es noch bis
          zur naechsten Stufe? Angetippt oeffnet sich die ganze Leiter. */}
      <Stufenbalken
        stufe={me.level.stufe}
        imLevel={me.level.imLevel}
        fuerLevel={me.level.fuerLevel}
        onClick={onStufen}
      />

      <div className="hub-profilkopf hub-profilkopf--a">
        <ProfilBild me={me} onChanged={onAvatarChange} />
        <div className="hub-profilkopf-text">
          <strong>{me.displayName}</strong>
          <span className="muted">{geburtstagText}</span>
        </div>
        <span
          className="front-level front-level--hub"
          aria-label={`Stufe ${me.level.stufe}`}
        >
          {me.level.stufe}
        </span>
      </div>

      {/*
        Ab hier: Tafeln, und zwar durchgehend.

        Der Profil-Tab war der einzige, der den Tafel-Baustein NICHT benutzt
        hat — jeder Abschnitt war ein eigener Kasten aus CSS-Verlauf mit
        goldenem Rand. Genau daran sah man, dass er nicht dazugehoert:
        DESIGN.md sagt seit jeher "Neue Hub-Inhalte gehoeren in eine Tafel,
        nicht in einen eigenen Kasten", und der Shop haelt sich daran.

        Die Tafeln geben zugleich die Rangfolge, die vorher fehlte: erst wer
        ich bin, dann was mir gehoert, dann was ich geleistet habe, dann meine
        Leute — und ganz zum Schluss die Konto-Sachen, die man ein Mal im Jahr
        braucht.
      */}
      {/*
        Die Figur bekommt eine eigene Tafel ueber die volle Breite.

        Vorher stand sie neben dem Text in derselben Tafel — und ragte dort
        oben heraus, quer ueber das Namensschild. Der Grund war die Hoehe: Ein
        WebGL-Bereich hat keine Inhaltsgroesse, an der sich die Zeile
        ausrichten koennte, und die Tafel laesst Ueberstand durch (`overflow:
        visible`, noetig fuer die Messingnieten). Ueber die volle Breite kann
        das nicht passieren.
      */}
      <Tafel titel="Deine Figur" zusatz={me.figur?.design === 'bemalt' ? 'Selbst angemalt' : 'Antippen zum Bearbeiten'}>
        <button className="hub-figur-buehne" onClick={onWerkstatt} title="Figur bearbeiten">
          <Suspense fallback={<Pinguin getragen={me.avatar} groesse={9} titel="Deine Figur" />}>
            {/* `me.avatar` ist genau das, was der Kleiderschrank anzieht —
                dieselbe Quelle wie beim gemalten Rückfall darüber. */}
            <Avatar3D
              getragen={me.avatar}
              bemalung={me.figur ?? LEERE_BEMALUNG}
              drehbar={false}
            />
          </Suspense>
          <span className="hub-profilbild-stift" aria-hidden="true">
            ✎
          </span>
        </button>
        <p className="muted hub-figur-hinweis">
          Drehen, anmalen, Mütze aufsetzen — antippen.
        </p>
      </Tafel>

      <Tafel titel="Deine Sachen" zusatz={`${Object.keys(me.avatar).length} von ${SLOTS.length} Plätzen`}>
        {/* Drei Einstiege in das, was einem gehoert: anziehen, hoeren,
            verdienen. Als Kachelreihe mit Symbol, nicht als Textknopfreihe —
            drei Woerter nebeneinander sind auf einem Handy zu schmal, um
            lesbar zu bleiben. */}
        <div className="hub-reihe hub-reihe--drei profil-einstiege">
          <ProfilKachel
            icon="/hub/icon-kleiderschrank.webp"
            name="Kleiderschrank"
            onClick={onSchrank}
          />
          <ProfilKachel
            icon="/hub/icon-klanghalle.webp"
            name="Klanghalle"
            onClick={onKlanghalle}
          />
          <ProfilKachel
            icon="/hub/icon-aufgaben.webp"
            name="Aufgaben"
            gold
            punkt={me.bereit.truhen + me.bereit.aufgaben > 0}
            onClick={onAufgaben}
          />
        </div>
      </Tafel>

      <Tafel
        titel="Geburtstag"
        zusatz={me.birthdayRewardClaimable ? 'Heute!' : geburtstagText}
      >
        <section
          className={`hub-geburtstag${me.birthdayRewardClaimable ? ' is-heute' : ''}${me.hasBirthdayOutfit ? ' is-besitz' : ''}`}
        >
          <div className="hub-geburtstag-art">
            <img
              src="/hub/pinguin-geburtstag.png"
              alt="Geburtstags-Pinguin"
              draggable={false}
            />
          </div>
          <div className="hub-geburtstag-text">
            <strong>Geburtstags-Pinguin</strong>
            {me.birthdayRewardClaimable ? (
              <span className="muted">Heute abholen: Outfit mit Partyhüten.</span>
            ) : me.hasBirthdayOutfit ? (
              <span className="muted">In deiner Sammlung · nächstes Mal am Geburtstag.</span>
            ) : (
              <span className="muted">Am Geburtstag einmal im Jahr einsammeln.</span>
            )}
            {me.birthdayRewardClaimable ? (
              <button
                className="hub-knopf hub-knopf--a-gold"
                disabled={claimBusy}
                onClick={claimReward}
              >
                {claimBusy ? 'Wird geholt…' : 'Belohnung holen'}
              </button>
            ) : null}
            {claimError && <p className="error">{claimError}</p>}
          </div>
        </section>
      </Tafel>

      <Tafel titel="Trophäen" zusatz={`${partien} Partien`}>
        <StatHero wert={trophaeen} />

        <div className="hub-stat-raster">
          {kacheln.map((k) => (
            <StatKachel key={k.name} icon={k.icon} wert={k.wert} name={k.name} />
          ))}
        </div>

        {me.stats.length === 0 ? (
          <p className="muted hub-stat-leer">Noch keine Partie gespielt.</p>
        ) : (
          me.stats.map((row) => (
            <StatSpiel
              key={row.gameId}
              name={t(`game.${row.gameId}`)}
              meta={`${row.parties} Partien · ${row.wins} Siege`}
              cups={row.trophies}
            />
          ))
        )}

        {/* „zählen alles" war eine Verkürzung, die niemand so sagt — und sie
            liess offen, was denn alles. Gemeint ist der Gegensatz zur Zeile
            davor: Trophäen sind an Tische ohne Bots gebunden, die Zählung von
            Partien und Siegen ist es nicht. Wortgleich mit dem fremden Profil
            (`Profile.tsx`) — dieselbe Regel, dieselbe Erklärung. */}
        <p className="hub-statistik-hinweis">
          Trophäen gibt es nur an Tischen ohne Bots. Partien und Siege werden
          überall gezählt, auch gegen Bots.
        </p>
      </Tafel>

      {/* Freunde standen frueher im Clan-Tab. Dort fuellt jetzt die
          Mitgliederliste den Bildschirm, und Freunde sind ohnehin kein
          Clan: Sie gehoeren zum eigenen Konto. */}
      <Freunde onShowProfile={onShowProfile} />

      {/*
        Konto — alles, was man selten braucht, an einem Ort und als richtige
        Knoepfe.

        Vorher lagen Einstellungen ganz oben allein, Benachrichtigungen und
        Abmelden irgendwo unter der Freundesliste, und "Konto loeschen" war
        eine nackte Textzeile darunter. Drei verschiedene Bauformen fuer
        dieselbe Art Sache.

        Die Reihenfolge ist Absicht: harmlos nach oben, endgueltig nach unten.
        Loeschen bleibt rot und steht allein in der letzten Zeile — nicht
        neben "Abmelden", sonst erwischt man es im Vorbeitippen.
      */}
      <Tafel titel="Konto" zusatz={me.displayName}>
        <div className="profil-konto">
          <button
            className="hub-knopf hub-knopf--a profil-konto-knopf"
            onClick={() => {
              spiele('blatt-auf');
              setEinstellungenOffen(true);
            }}
          >
            <img src="/hub/icon-einstellungen.webp" alt="" aria-hidden="true" />
            Einstellungen
          </button>

          <button
            className="hub-knopf hub-knopf--a profil-konto-knopf"
            onClick={() => onBald('Benachrichtigungen')}
          >
            <img src="/hub/icon-benachrichtigung.webp" alt="" aria-hidden="true" />
            Benachrichtigungen
            <span className="front-bald-tag">Bald</span>
          </button>

          <button
            className="hub-knopf hub-knopf--a-raus profil-konto-knopf"
            onClick={onSignOut}
          >
            <img src="/hub/icon-abmelden.webp" alt="" aria-hidden="true" />
            Abmelden
          </button>

          <Rechtliches />

          {/* Klein, aber vorhanden: Apple lehnt Apps mit Konten ohne diesen
              Weg zuverlaessig ab, und die DSGVO verlangt ihn ohnehin. */}
          <button className="hub-konto-loeschen" onClick={() => setLoeschenOffen(true)}>
            <img src="/hub/icon-konto-loeschen.webp" alt="" aria-hidden="true" />
            Konto löschen
          </button>
        </div>
      </Tafel>

      {einstellungenOffen && (
        <EinstellungenBlatt
          onClose={() => {
            spiele('blatt-zu');
            setEinstellungenOffen(false);
          }}
        />
      )}

      {loeschenOffen && (
        <KontoLoeschenBlatt
          name={me.displayName}
          onClose={() => setLoeschenOffen(false)}
          onDeleted={onDeleted}
        />
      )}
    </HubSzene>
  );
}

/**
 * Kontoloeschung — zweiter Schritt mit Passwort.
 *
 * Geloescht wird als Anonymisierung: Der Personenbezug verschwindet, die
 * Partien der Mitspieler bleiben nachvollziehbar. Das steht auch so im Blatt,
 * denn "alles weg" waere gelogen und "anonymisiert" ohne Erklaerung
 * beunruhigend.
 *
 * Das Passwort wird erneut verlangt, weil die Sitzung dreissig Tage haelt:
 * Sonst genuegte ein kurz aus der Hand gelegtes Handy.
 */
function KontoLoeschenBlatt({
  name,
  onClose,
  onDeleted,
}: {
  name: string;
  onClose: () => void;
  onDeleted: () => void;
}): React.JSX.Element {
  const [passwort, setPasswort] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const loeschen = (event: React.FormEvent): void => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFehler(null);
    void api.deleteMe(passwort).then(onDeleted, (err: unknown) => {
      // Der allgemeine Schluessel nennt E-Mail und Passwort. Hier wurde nur
      // ein Passwort eingegeben - also auch nur davon sprechen.
      setFehler(
        err instanceof ApiError
          ? err.code === 'credentialsInvalid'
            ? 'Das Passwort stimmt nicht.'
            : t(err.messageKey)
          : 'Verbindung fehlgeschlagen.',
      );
      setBusy(false);
    });
    // Kein finally: Bei Erfolg ist dieses Blatt weg, bevor es etwas zu setzen
    // gaebe.
  };

  return (
    <div className="doko-sheet" onClick={onClose}>
      <form
        className="doko-sheet-card hub-loeschen"
        onClick={(event) => event.stopPropagation()}
        onSubmit={loeschen}
      >
        <h2>Konto löschen</h2>
        <p className="muted">
          Das lässt sich nicht rückgängig machen. Dein Name, deine E-Mail-Adresse und dein
          Geburtstag werden entfernt, du wirst aus deinem Clan ausgetragen — führst du ihn,
          rückt das älteste Mitglied nach.
        </p>
        <p className="muted">
          Deine gespielten Partien bleiben als anonyme Einträge stehen, damit die Abrechnungen
          deiner Mitspieler nicht zerfallen. Läuft gerade eine Partie, zählt die Löschung als
          Verlassen.
        </p>

        <label>
          Passwort von {name}
          <input
            type="password"
            value={passwort}
            onChange={(event) => setPasswort(event.target.value)}
            autoFocus
            required
          />
        </label>

        {fehler && <p className="error">{fehler}</p>}

        <div className="hub-knopfreihe hub-knopfreihe--a">
          <button type="button" className="hub-knopf hub-knopf--a" onClick={onClose}>
            Behalten
          </button>
          <button
            type="submit"
            className="hub-knopf hub-knopf--a-raus"
            disabled={busy || passwort.length === 0}
          >
            {busy ? 'Wird gelöscht…' : 'Endgültig löschen'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Euro-Preis aus ganzen Cent. Nie Gleitkomma, nie gerundet. */
function euro(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')} €`;
}

/**
 * BroJetons im Shop: ein gemalter Stapel statt eines Bildes, ein / zwei /
 * drei Jetons je nach Paketgroesse — wie die Muenzgrafik daneben ein Bild ist.
 */
function BroJetonStapel({ betrag }: { betrag: number }): React.JSX.Element {
  const hoehe = betrag >= 5_000 ? 3 : betrag >= 1_500 ? 2 : 1;
  return (
    <span className={`hub-angebot-art poker-jeton-stapel is-${hoehe}`} aria-hidden="true">
      {Array.from({ length: hoehe }, (_, i) => (
        <span key={i} className="poker-jeton-zeichen" />
      ))}
    </span>
  );
}

/**
 * Ein Paket im Regal.
 *
 * Zwei Sorten in einer Kachel, weil sie sich nur im Preisschild und im Tipp
 * unterscheiden:
 *
 *  - **Gegen Edelsteine und wirklich kaufbar** (die Muenzpakete): Der Tipp
 *    fuehrt in die Rueckfrage, nicht in die Abbuchung.
 *  - **Bald** (Edelsteinpakete und VIP gegen Geld, Season Pass gegen
 *    Edelsteine): Preis und Inhalt stehen dran, gekauft wird nichts. Das
 *    Antippen sagt das ehrlich, statt in einen toten Knopf zu laufen
 *    (DESIGN.md).
 */
function PaketKachel({
  paket,
  laeuft,
  onBald,
  onKaufen,
}: {
  paket: Paket;
  /** Ein Kauf laeuft — dann nimmt keine Kachel einen zweiten Tipp an. */
  laeuft: boolean;
  onBald: (name: string) => void;
  onKaufen: (paket: Paket) => void;
}): React.JSX.Element {
  return (
    <button
      className="hub-angebot shop-paket"
      disabled={laeuft}
      onClick={() => (paket.kaufbar ? onKaufen(paket) : onBald(t(paket.nameKey)))}
    >
      {paket.gibt ? (
        paket.gibt.waehrung === 'coins' ? (
          <img className="hub-angebot-art" src="/hub/muenze.png" alt="" draggable={false} />
        ) : paket.gibt.waehrung === 'broJetons' ? (
          <BroJetonStapel betrag={paket.gibt.betrag} />
        ) : (
          <EdelsteinIcon className="hub-angebot-art shop-paket-stein" />
        )
      ) : (
        <img
          className="hub-angebot-art"
          src={paket.id === 'vip-pass' ? '/hub/shop-vip.webp' : '/hub/season-pass.png'}
          alt=""
          draggable={false}
        />
      )}
      <strong>{t(paket.nameKey)}</strong>
      {paket.gibt && (
        <span className="shop-paket-inhalt">
          {paket.gibt.betrag} {t(`waehrung.${paket.gibt.waehrung}`)}
        </span>
      )}
      <span className="hub-preis">{preisSchild(paket)}</span>
      {paket.bonus !== null && <span className="shop-bonus">+{paket.bonus} %</span>}
      {!paket.kaufbar && <span className="front-bald-tag">Bald</span>}
    </button>
  );
}

/**
 * Das Preisschild eines Pakets: Euro oder Edelsteine, nie beides.
 *
 * Beides waere ein Wechselkurs an der Kachel, und den fuehrt der Server. Faellt
 * ein Paket ohne jeden Preis herein, steht ein Strich da statt „0 €" — eine
 * Null waere ein Versprechen.
 */
function preisSchild(paket: Paket): React.JSX.Element | string {
  if (paket.cents !== null) return euro(paket.cents);
  if (paket.coins !== null) {
    return (
      <>
        {paket.coins}
        <img className="shop-preis-muenze" src="/hub/muenze.png" alt="" />
      </>
    );
  }
  if (paket.gems === null) return '—';
  return (
    <>
      {paket.gems}
      <EdelsteinIcon className="shop-preis-stein" />
    </>
  );
}

/**
 * Eine Truhe im Regal.
 *
 * **Die Spanne steht dran, nicht der Erwartungswert.** Wer 60 Edelsteine
 * ausgibt, soll vorher wissen, dass 650 herauskommen koennen und 1.150 auch —
 * eine mittlere Zahl waere die einzige, die nie herauskommt.
 */
function TruheKachel({
  truhe,
  laeuft,
  onKaufen,
}: {
  truhe: Kauftruhe;
  laeuft: boolean;
  onKaufen: (truhe: Kauftruhe) => void;
}): React.JSX.Element {
  return (
    <button className="hub-angebot shop-truhe" disabled={laeuft} onClick={() => onKaufen(truhe)}>
      {/* Dieselbe gezeichnete Truhe wie im Aufgaben-Vollbild — eine zweite waere
          eine, die sich ab der ersten Bildlieferung unterscheidet. */}
      <TruhenBild grad={truhe.grad} offen={false} />
      <strong>{t(truhe.nameKey)}</strong>
      {/* Ohne Tausenderpunkt, wie die Truhenzeile im Aufgaben-Vollbild: zwei
          Schreibweisen fuer dieselbe Zahl waeren zwei Zahlen. */}
      <span className="shop-paket-inhalt">
        {truhe.von} bis {truhe.bis} Münzen
      </span>
      <span className="hub-preis">
        {truhe.gems}
        <EdelsteinIcon className="shop-preis-stein" />
      </span>
    </button>
  );
}

/** Was gekauft werden soll — Paket oder Truhe, beides gegen Edelsteine. */
type Kaufwunsch =
  | { art: 'paket'; paket: Paket }
  | { art: 'truhe'; truhe: Kauftruhe }
  /** Szenerie, Rueckseite, Zuruf oder Wappen — mit Wahl der Waehrung. */
  | { art: 'ware'; ware: RegalWare; name: string; bild: string | null };

/**
 * Rueckfrage vor dem Abbuchen.
 *
 * Ein Tipp auf die Kachel oeffnet diese Frage, erst ein Tipp hier kauft. Die
 * Begruendung steht im Kleiderschrank: Ein Fehlgriff darf nichts kosten — und
 * hier ist die Waehrung die, die am Ende Geld kostet.
 */
function KaufFrage({
  frage,
  laeuft,
  onAbbrechen,
  onPaket,
  onTruhe,
  onWare,
}: {
  frage: Kaufwunsch;
  laeuft: boolean;
  onAbbrechen: () => void;
  onPaket: (paket: Paket) => void;
  onTruhe: (truhe: Kauftruhe) => void;
  onWare: (ware: RegalWare, waehrung: Waehrung) => void;
}): React.JSX.Element {
  const gems =
    frage.art === 'truhe'
      ? frage.truhe.gems
      : frage.art === 'ware'
        ? frage.ware.preis.gems
        : (frage.paket.gems ?? 0);
  const muenzen = frage.art === 'paket' ? frage.paket.coins : null;

  return (
    <div className="doko-sheet" onClick={onAbbrechen} role="presentation">
      <div
        className="doko-sheet-card ks-kauf"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Kauf bestätigen"
      >
        {frage.art === 'ware' ? (
          <>
            {/* Ware ohne Grafik (Klang, Musik) zeigt hier nichts statt eines
                kaputten Bildes — der Name darunter traegt die Rueckfrage. */}
            {frage.bild && (
              <img className="ks-kauf-ware" src={frage.bild} alt="" draggable={false} />
            )}
            <h2>{frage.name}</h2>
            {/* Klang und Musik kauft man nach Gehör, nicht nach Namen. Der
                Knopf steht deshalb VOR der Waehrungsfrage — erst hoeren,
                dann entscheiden. */}
            <Vorhoeren ware={frage.ware} />
          </>
        ) : frage.art === 'truhe' ? (
          <>
            <TruhenBild grad={frage.truhe.grad} offen={false} />
            <h2>{t(frage.truhe.nameKey)}</h2>
            <p className="muted">
              {frage.truhe.von} bis {frage.truhe.bis} Münzen, ausgewürfelt beim Öffnen
            </p>
          </>
        ) : (
          <>
            <img className="hub-angebot-art" src="/hub/muenze.png" alt="" draggable={false} />
            <h2>{t(frage.paket.nameKey)}</h2>
            <p className="muted">
              {frage.paket.gibt
                ? `${frage.paket.gibt.betrag} ${t(`waehrung.${frage.paket.gibt.waehrung}`)}`
                : 'Ohne Guthaben'}
            </p>
          </>
        )}
        {frage.art === 'ware' ? (
          <>
            {/* Zwei Wege, wie im Kleiderschrank: Der Kaeufer waehlt die
                Waehrung, nicht der Shop. */}
            <p className="muted ks-kauf-womit">Womit?</p>
            <div className="hub-knopfreihe hub-knopfreihe--a ks-kauf-waehl">
              <button
                type="button"
                className="hub-knopf hub-knopf--a-gold"
                disabled={laeuft}
                onClick={() => onWare(frage.ware, 'coins')}
              >
                <img className="ks-kauf-icon" src="/hub/muenze.png" alt="" />
                {frage.ware.preis.coins}
              </button>
              <button
                type="button"
                className="hub-knopf hub-knopf--a-gold"
                disabled={laeuft}
                onClick={() => onWare(frage.ware, 'gems')}
              >
                <EdelsteinIcon className="ks-kauf-icon" />
                {frage.ware.preis.gems}
              </button>
            </div>
            <button type="button" className="hub-knopf hub-knopf--a" onClick={onAbbrechen}>
              Später
            </button>
          </>
        ) : (
          <>
            <p className="ks-kauf-preis">
              {muenzen !== null ? (
                <>
                  {muenzen} {muenzen === 1 ? t('waehrung.coins.eins') : t('waehrung.coins')}
                </>
              ) : (
                <>
                  {gems} {gems === 1 ? t('waehrung.gems.eins') : t('waehrung.gems')}
                </>
              )}
            </p>
            <div className="hub-knopfreihe hub-knopfreihe--a">
              <button type="button" className="hub-knopf hub-knopf--a" onClick={onAbbrechen}>
                Später
              </button>
              <button
                type="button"
                className="hub-knopf hub-knopf--a-gold"
                disabled={laeuft}
                onClick={() =>
                  frage.art === 'truhe' ? onTruhe(frage.truhe) : onPaket(frage.paket)
                }
              >
                {laeuft ? 'Kauft…' : frage.art === 'truhe' ? 'Öffnen' : 'Kaufen'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Shop.
 *
 * Zwei Sorten Regal, streng getrennt und in dieser Reihenfolge:
 *
 *  1. **Was Edelsteine kostet und wirklich laeuft:** Muenzpakete und Truhen.
 *  2. **Was hier gekauft und anderswo angelegt wird:** Zurufe, Rueckseiten,
 *     Wappen. Der Shop ist der Ort, an dem etwas dazukommt, nicht der, an dem
 *     man sich einrichtet.
 *  3. **Was noch nicht geht:** Edelsteinpakete und VIP gegen Geld, Season Pass
 *     gegen Edelsteine. Mit Preis und Inhalt, aber ohne Kauf.
 *
 * Ein Shop, dessen erste Reihe „Bald" sagt, ist kein Shop — deshalb steht das
 * Ungebaute zuletzt.
 *
 * **Der Pinguin steht hier nicht.** Er und sein Kleiderschrank gehoeren ins
 * Profil, wo man sich um sich selbst kuemmert; im Shop waeren sie ein zweiter
 * Weg zu derselben Tuer. Blaetter und Szenerien stehen aus demselben Grund
 * nur im Themen-Tab: Dort sieht man sie in Tischgroesse, und dort wird auch
 * gekauft.
 */
function Shop({
  coins,
  gems,
  onBald,
  onGuthaben,
}: {
  /**
   * Der Guthabenstand — nur als Ausloeser zum Neuladen, nicht zur Anzeige.
   * Bewusst die zwei Zahlen statt des ganzen Kontos: Der Shop liest sonst
   * nichts davon, und ein `me` im Prop-Typ verspraeche mehr als er braucht.
   */
  coins: number;
  gems: number;
  onBald: (name: string) => void;
  onGuthaben: () => void;
}): React.JSX.Element {
  const [shop, setShop] = useState<ShopDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /**
   * Was bestaetigt werden soll.
   *
   * Ein Tipp darf nichts abbuchen — dieselbe Regel wie im Kleiderschrank, und
   * hier waere ein Fehlgriff teurer: 250 Edelsteine sind das groesste Angebot
   * im Regal, und Edelsteine kosten am Ende Geld.
   */
  const [frage, setFrage] = useState<Kaufwunsch | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  /**
   * Was in der gekauften Truhe war.
   *
   * Das Ergebnis MUSS gezeigt werden: Eine Truhe, die man kauft und deren Wurf
   * nur im Muenzstand auftaucht, ist eine Zahl, die sich unerklaert aendert.
   */
  const [fund, setFund] = useState<Kauffund | null>(null);

  useEffect(() => {
    void api
      .shop()
      .then(setShop)
      .catch(() => setFehler('Der Shop ließ sich nicht laden.'));
  }, [
    // Nach einem Kauf muss das Regal neu geladen werden, sonst steht dort
    // weiter ein Preis auf etwas, das schon gehoert.
    coins,
    gems,
  ]);

  const meldung = (err: unknown): void => {
    setFehler(err instanceof ApiError ? t(err.messageKey) : 'Der Kauf ging nicht durch.');
  };

  const kaufePaket = (paket: Paket): void => {
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    void api
      .buyPack(paket.id)
      .then(() => {
        setFrage(null);
        // Neu laden statt von Hand nachziehen: Der Server ist die Wahrheit, und
        // er weiss auch, was der Kauf sonst noch bewegt hat.
        onGuthaben();
      })
      .catch(meldung)
      .finally(() => setLaeuft(false));
  };

  const kaufeTruhe = (truhe: Kauftruhe): void => {
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    void api
      .buyChest(truhe.id)
      .then((ergebnis) => {
        spiele('truhe');
        setFrage(null);
        setFund(ergebnis);
        onGuthaben();
      })
      .catch(meldung)
      .finally(() => setLaeuft(false));
  };


  /** Ware einer Sorte, kostenlose zuletzt — Neues gehoert nach vorn. */
  const ware = (art: RegalWare['art']): RegalWare[] =>
    (shop?.tischware ?? [])
      .filter((w) => w.art === art)
      .sort((a, b) => Number(a.besessen) - Number(b.besessen));

  const [kauft, setKauft] = useState<string | null>(null);

  /**
   * Kaufen mit gewaehlter Waehrung.
   *
   * Ein Tipp auf die Kachel oeffnet nur die Rueckfrage; erst dort wird
   * abgebucht. Dieselbe Regel wie bei Paketen und Truhen — ein Fehlgriff
   * darf nichts kosten.
   */
  const kaufeWare = (w: RegalWare, waehrung: Waehrung): void => {
    if (kauft) return;
    setKauft(w.id);
    setFehler(null);
    void api
      .buyItem(w.id, waehrung)
      .then(() => {
        spiele('kauf');
        setFrage(null);
        onGuthaben();
      })
      .catch((e: unknown) => {
        const code = (e as { code?: string })?.code;
        setFrage(null);
        setFehler(
          code === 'coinsInsufficient'
            ? 'Dafür fehlen dir Münzen.'
            : code === 'gemsInsufficient'
              ? 'Dafür fehlen dir Edelsteine.'
              : 'Der Kauf hat nicht geklappt.',
        );
      })
      .finally(() => setKauft(null));
  };

  return (
    <HubSzene bg="/hub/bg-shop.webp" className="front-shop front-shop--b">
      <HubBanner />

      {fehler && <p className="error">{fehler}</p>}

      {/* Der eigene Pinguin steht im Shop, weil hier seine Sachen liegen. Ein
          Tipp fuehrt in den Kleiderschrank, wo gekauft und angezogen wird. */}
      <Tafel titel="Münzen" zusatz={shop ? `${shop.kurs} je Edelstein` : '…'}>
        <div className="hub-reihe hub-reihe--drei">
          {(shop?.muenzpakete ?? []).map((paket) => (
            <PaketKachel
              key={paket.id}
              paket={paket}
              laeuft={laeuft}
              onBald={onBald}
              onKaufen={(p) => setFrage({ art: 'paket', paket: p })}
            />
          ))}
        </div>
        <p className="shop-hinweis muted">
          Münzen gibt es auch fürs Spielen: aus der Tagestruhe, den Stufentruhen und den
          Tagesaufgaben. Gekaufte sind derselbe Stand, nur früher da.
        </p>
      </Tafel>

      <Tafel titel="BroJetons" zusatz="Für Poker">
        <div className="hub-reihe hub-reihe--drei">
          {(shop?.jetonpakete ?? []).map((paket) => (
            <PaketKachel
              key={paket.id}
              paket={paket}
              laeuft={laeuft}
              onBald={onBald}
              onKaufen={(p) => setFrage({ art: 'paket', paket: p })}
            />
          ))}
        </div>
        <p className="shop-hinweis muted">
          BroJetons setzt du am Pokertisch. Zurück in Münzen oder Edelsteine gehen sie nicht —
          wer gewinnt, hat mehr Chips für die nächste Runde.
        </p>
      </Tafel>

      <Tafel titel="Truhen" zusatz="Gegen Edelsteine">
        <div className="hub-reihe hub-reihe--drei">
          {(shop?.truhen ?? []).map((truhe) => (
            <TruheKachel
              key={truhe.id}
              truhe={truhe}
              laeuft={laeuft}
              onKaufen={(t2) => setFrage({ art: 'truhe', truhe: t2 })}
            />
          ))}
        </div>
        <p className="shop-hinweis muted">
          Die Spanne steht dran und wird beim Kauf ausgewürfelt. Ihre Mitte ist genau der Kurs —
          das Würfeln kostet im Schnitt nichts, es verteilt nur. Wer die feste Zahl will, nimmt
          ein Paket.
        </p>
      </Tafel>

      <Tafel titel="Edelsteine" zusatz="Kommt bald">
        <div className="hub-reihe hub-reihe--drei">
          {(shop?.edelsteinpakete ?? []).map((paket) => (
            <PaketKachel
              key={paket.id}
              paket={paket}
              laeuft={laeuft}
              onBald={onBald}
              onKaufen={(p) => setFrage({ art: 'paket', paket: p })}
            />
          ))}
        </div>
        <p className="shop-hinweis muted">
          Edelsteine fallen nicht aus Truhen und nicht aus Aufgaben — sie sind das Einzige, was
          echtes Geld kostet. Dafür ist mit ihnen alles andere hier zu haben.
        </p>
      </Tafel>

      {/*
        Drei Regale, drei Sorten. Szenerien stehen bewusst NICHT hier: Sie
        wollen in Tischgroesse gesehen werden, mit Karten darauf — das kann
        nur die Themenauswahl, und dort wird auch gekauft. Ein zweiter
        Kaufweg fuer dieselbe Ware waere eine Stelle mehr, die auseinander
        laufen kann.
      */}
      <WareRegal
        titel="Zurufe"
        zusatz="Gelten an jedem Tisch"
        waren={ware('emote')}
        bild={(w) => emoteBild(w.wert)}
        name={(w) => emoteMit(w.wert)?.name ?? w.wert}
        kauft={kauft}
        onKaufen={(w, name, bild) => setFrage({ art: 'ware', ware: w, name, bild })}
      />

      <WareRegal
        titel="Kartenrückseiten"
        zusatz="Was die anderen sehen"
        waren={ware('ruecken')}
        bild={(w) => rueckenBild(w.wert) ?? '/hub/tab-blatt.webp'}
        name={(w) => RUECKEN.find((r) => r.id === w.wert)?.name ?? w.wert}
        kauft={kauft}
        onKaufen={(w, name, bild) => setFrage({ art: 'ware', ware: w, name, bild })}
      />

      <WareRegal
        titel="Clanwappen"
        zusatz="Für deinen Verein"
        waren={ware('wappen')}
        bild={(w) => `/hub/${w.wert}.webp`}
        name={(w) => `Wappen ${w.wert.replace('wappen-', '')}`}
        kauft={kauft}
        onKaufen={(w, name, bild) => setFrage({ art: 'ware', ware: w, name, bild })}
      />
      {/* Klang und Musik. Beides wird hier gekauft und in den Einstellungen
          gewaehlt — dieselbe Trennung wie ueberall: Der Shop legt zu, das
          Einrichten passiert dort, wo man es benutzt. */}
      <WareRegal
        titel="Klangpakete"
        zusatz="Wie sich der Tisch anhört"
        waren={ware('klang')}
        bild={() => null}
        glyph="note"
        name={(w) => PAKET_NAMEN[w.wert] ?? w.wert}
        kauft={kauft}
        onKaufen={(w, name, bild) => setFrage({ art: 'ware', ware: w, name, bild })}
      />

      <WareRegal
        titel="Musik"
        zusatz="Im Menü und am Tisch"
        waren={ware('musik')}
        bild={() => null}
        glyph="noten"
        name={(w) => MUSIK_NAMEN[w.wert] ?? w.wert}
        kauft={kauft}
        onKaufen={(w, name, bild) => setFrage({ art: 'ware', ware: w, name, bild })}
      />

      <Tafel titel="Pässe" zusatz="Kommt bald">
        <div className="hub-reihe hub-reihe--drei">
          {(shop?.paesse ?? []).map((paket) => (
            <PaketKachel
              key={paket.id}
              paket={paket}
              laeuft={laeuft}
              onBald={onBald}
              onKaufen={(p) => setFrage({ art: 'paket', paket: p })}
            />
          ))}
        </div>
      </Tafel>

      {frage && (
        <KaufFrage
          frage={frage}
          laeuft={laeuft}
          onAbbrechen={() => setFrage(null)}
          onPaket={kaufePaket}
          onTruhe={kaufeTruhe}
          onWare={kaufeWare}
        />
      )}

      {/* Derselbe Fund-Moment wie im Aufgaben-Vollbild. Eine gekaufte Truhe, die
          nur den Muenzstand aendert, ist eine Zahl ohne Erklaerung. */}
      {fund && <FundBlatt fund={fund} onClose={() => setFund(null)} />}
    </HubSzene>
  );
}

/**
 * Ein Regal mit gleichartiger Ware.
 *
 * Gekauft wird hier und angelegt woanders — das ist Absicht: Eine Rueckseite
 * waehlt man beim Blatt, ein Wappen im Clan, einen Zuruf am Tisch. Der Shop
 * ist der Ort, an dem etwas dazukommt, nicht der, an dem man sich einrichtet.
 */
function WareRegal({
  titel,
  zusatz,
  waren,
  bild,
  glyph,
  name,
  kauft,
  onKaufen,
}: {
  titel: string;
  zusatz: string;
  waren: RegalWare[];
  /**
   * Bild der Kachel — oder null, wenn es fuer diese Sorte noch keins gibt.
   *
   * Dann steht `glyph` an seiner Stelle. Der Umweg ist Absicht: Ein `<img>`
   * auf eine Datei, die es nicht gibt, ist ein weisser Kasten, und genau das
   * ist beim Clan-Krieg schon einmal fast live gegangen. Ein Zeichen ist
   * ehrlicher als ein kaputtes Bild und laesst sich austauschen, sobald die
   * Grafik da ist.
   */
  bild: (w: RegalWare) => string | null;
  /**
   * Welches Ersatzzeichen: 'note' (Klangpaket) oder 'noten' (Musik).
   *
   * Bis zum 27. August standen hier die Schriftzeichen selbst. Sie sassen
   * gemessen 2,3 px zu tief in ihrem 30 px hohen Feld — eine Schrift
   * zentriert nach Vorschubbreite, nicht nach Tinte (siehe src/zeichen.tsx).
   * Jetzt ist es ein Name und dahinter eine Zeichnung, die mittig sitzt.
   */
  glyph?: 'note' | 'noten';
  name: (w: RegalWare) => string;
  /** Kennung, die gerade gekauft wird — der Knopf sperrt sich so lange. */
  kauft: string | null;
  /** Oeffnet die Rueckfrage. Gekauft wird erst dort. */
  onKaufen: (w: RegalWare, name: string, bild: string | null) => void;
}): React.JSX.Element | null {
  // Ist alles kostenlos und gehoert ohnehin allen, waere das Regal ein
  // leeres Schaufenster. Dann lieber gar keins.
  if (waren.every((w) => w.preis.coins === 0 && w.preis.gems === 0)) return null;

  const offen = waren.filter((w) => !w.besessen).length;
  return (
    <Tafel titel={titel} zusatz={offen > 0 ? `Noch ${offen}` : zusatz}>
      <div className="shop-ware">
        {waren.map((w) => (
          <button
            key={w.id}
            className={`shop-ware-stueck is-${w.seltenheit}${w.besessen ? ' is-mein' : ''}`}
            disabled={w.besessen || kauft !== null}
            onClick={() => onKaufen(w, name(w), bild(w))}
            title={name(w)}
          >
            {bild(w) ? (
              <img src={bild(w) ?? undefined} alt="" draggable={false} />
            ) : (
              <span className="shop-ware-glyph" aria-hidden="true">
                {glyph === 'note' || glyph === 'noten' ? <Note doppelt={glyph === 'noten'} /> : '?'}
              </span>
            )}
            <span className="shop-ware-name">{name(w)}</span>
            {w.besessen ? (
              <span className="shop-ware-hab">✓</span>
            ) : (
              <span className="shop-ware-preis">
                <img src="/hub/muenze.png" alt="" aria-hidden="true" />
                {w.preis.coins}
              </span>
            )}
          </button>
        ))}
      </div>
    </Tafel>
  );
}

/**
 * Ein Einstieg im Profil: Symbol oben, ein Wort darunter.
 *
 * Bewusst eine Kachel und kein breiter Knopf mit Text: Drei Woerter
 * nebeneinander in einer Knopfreihe sind auf einem Handy so schmal, dass
 * "Kleiderschrank" umbricht oder abgeschnitten wird. Ein Symbol traegt die
 * halbe Bedeutung, dann reicht der Platz.
 *
 * Die Symbole sind gemalte Gegenstaende, keine Piktogramme: ein offener
 * Schrank, ein Grammofon, eine Schriftrolle. Bestellt in
 * `docs/ASSETS-PROFIL.md`, Bedingung war, dass jedes bei 32 px noch
 * erkennbar ist — bei einer Strichzeichnung waere es das nicht.
 */
function ProfilKachel({
  icon,
  name,
  gold = false,
  punkt = false,
  onClick,
}: {
  icon: string;
  name: string;
  gold?: boolean;
  /** Roter Punkt: dahinter ist etwas zu holen. Nie eine Zahl — siehe DESIGN.md. */
  punkt?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={`profil-kachel${gold ? ' is-gold' : ''}`}
      onClick={() => {
        spiele('tipp');
        onClick();
      }}
    >
      <img src={icon} alt="" aria-hidden="true" draggable={false} />
      <span>{name}</span>
      {punkt && <span className="hub-punkt hub-punkt--klein" aria-hidden="true" />}
    </button>
  );
}

/**
 * Anhören, bevor man kauft.
 *
 * Nur fuer Klang und Musik — bei einer Szenerie taete ein Knopf nichts. Bei
 * Musik laeuft das Stueck an und der Knopf wird zum Stopp; bei einem
 * Klangpaket ist es ein einzelner Kartenklick aus genau diesem Paket, und
 * dafuer braucht es keinen Stoppknopf.
 *
 * Der Aufraeumer haengt am Element: Wer die Rueckfrage schliesst, waehrend
 * die Probe laeuft, soll nicht mit der Musik im Ruecken weitergehen.
 */
function Vorhoeren({ ware }: { ware: RegalWare }): React.JSX.Element | null {
  const laeuftProbe = useSyncExternalStore(abonniere, laufendeProbe, laufendeProbe);
  useEffect(() => () => probeMusik(null), []);

  if (ware.art !== 'klang' && ware.art !== 'musik') return null;
  const istMusik = ware.art === 'musik';
  const an = istMusik && laeuftProbe === ware.wert;

  return (
    <button
      type="button"
      className="hub-knopf hub-knopf--a ks-kauf-hoeren"
      onClick={() => (istMusik ? probeMusik(ware.wert) : probePaket(ware.wert))}
    >
      {an ? '■ Stopp' : '▶ Anhören'}
    </button>
  );
}

function TabButton({
  label,
  iconSrc,
  active,
  haupt = false,
  farbe,
  onClick,
}: {
  label: string;
  iconSrc: string;
  active: boolean;
  haupt?: boolean;
  /** Jeder Bereich hat seine eigene Leuchtfarbe, wenn er gewaehlt ist. */
  farbe: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={`front-tab front-tab--${farbe}${haupt ? ' front-tab--haupt' : ''}${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      // Der Klang haengt an der Leiste und nicht an jedem einzelnen Knopf im
      // Haus: Das hier ist die Bewegung, die man hundertmal am Abend macht.
      // Wer jeden Knopf verklanglicht, baut eine Klapperkiste.
      onClick={() => {
        if (!active) spiele('tipp');
        onClick();
      }}
    >
      <img className="front-tab-icon" src={iconSrc} alt="" draggable={false} />
      <span>{label}</span>
    </button>
  );
}

/**
 * Hauptschirm: der Trophaeenpfad.
 *
 * Die Trophaeen sind eine Reise von Insel zu Insel - jede ein Checkpoint,
 * jede eine eigene Welt. Der Spielauswahl-Knopf klebt am unteren Rand und
 * oeffnet das Vollbild mit allen Spielen samt Bildern; abgestimmt wird
 * dort, nicht mehr auf dem Startschirm.
 */
function Spielen({
  trophies,
  getragen,
  bemalung,
  activeTable,
  onPick,
  onSolo,
  onResume,
  onBald,
  onRangliste,
  onAufgaben,
  bereit,
}: {
  trophies: number;
  getragen: Me['avatar'];
  /** Bemalung der 3D-Figur, fuer den Pfad. */
  bemalung: Me['figur'];
  activeTable: Me['activeTable'];
  /** Wie viel bereitliegt (Truhen plus fertige Aufgaben). 0 = kein Punkt. */
  bereit: number;
  onPick: (gameId: string) => void;
  onSolo: (modusId: string) => void;
  onResume: (gameId: string, tableId: string) => void;
  onBald: (name: string) => void;
  onRangliste: () => void;
  /** Oeffnet Tagesaufgaben und Truhen. */
  onAufgaben: () => void;
}): React.JSX.Element {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [wahlOffen, setWahlOffen] = useState(false);
  const [anleitungOffen, setAnleitungOffen] = useState(false);

  useEffect(() => {
    void api.games().then(setGames);
  }, []);

  const vote = async (gameId: string): Promise<void> => {
    await api.vote(gameId).catch(() => undefined);
    setVoted(new Set([...voted, gameId]));
    setGames(await api.games());
  };

  return (
    <div className="front-hub">
      {/* Karte füllt die Bühne; Logo und Seiten-UI liegen als Overlay drauf,
          damit kein blauer Streifen die oberen Arenen verdeckt. */}
      <div className="hub-buehne">
          <Trophaeenpfad trophies={trophies} getragen={getragen} bemalung={bemalung} />

        {/* Nur der Schriftzug, dafuer gross und mittig. Der Slogan
            "Doppelkopf. Dein Weg." stand als zweites Bild darunter und
            machte beide klein - dabei ist oben ueber der Karte Platz, und
            eine Startseite darf ihren Namen deutlich zeigen. */}
        <header className="hub-logo" aria-label="Brauweg">
          <img className="hub-logo-mark" src="/hub/logo.png" alt="Brauweg" draggable={false} />
        </header>

        <aside className="hub-seite hub-seite--links">
          <button
            type="button"
            className="hub-side-btn"
            aria-label="Spielauswahl"
            onClick={() => setWahlOffen(true)}
          >
            <img src="/hub/side-icon-spielwahl.webp" alt="" draggable={false} />
          </button>
          <button
            type="button"
            className="hub-side-btn"
            aria-label="Rangliste"
            onClick={onRangliste}
          >
            <img src="/hub/side-icon-rangliste.webp" alt="" draggable={false} />
          </button>
          <button
            type="button"
            className="hub-side-btn"
            aria-label="Bald"
            onClick={() => onBald('Mehr Features')}
          >
            <img src="/hub/side-icon-bald.webp" alt="" draggable={false} />
          </button>
        </aside>

        {/*
          Die Truhe ist der Weg zu Tagesaufgaben und Truhen. Sie stand hier
          schon als "Bald"-Attrappe — jetzt fuehrt sie irgendwohin.

          Der Punkt daran verraet, dass etwas bereitliegt; ohne ihn muesste man
          nachsehen, um festzustellen, dass es nichts zu holen gibt. Die Zahl
          selbst steht drinnen, nicht hier: Eine Ziffer auf einem 44-Pixel-Knopf
          ist auf einem Handy nicht lesbar.
        */}
        <aside className="hub-seite hub-seite--rechts">
          <button
            type="button"
            className="hub-truhe"
            aria-label="Tagesaufgaben und Truhen"
            onClick={onAufgaben}
          >
            <img src="/hub/truhe.png" alt="" draggable={false} />
            {bereit > 0 && <span className="hub-punkt" aria-label={`${bereit} bereit`} />}
          </button>
        </aside>

        {/* Einstieg fuer Neue, unten rechts. Oeffnet die Anleitung: was Brauweg
            ist und woran man die Spiele erkennt. Spielneutral — mit mehreren
            Spielen waere ein fester Spielname hier falsch. */}
        <button
          type="button"
          className="hub-neuhier"
          onClick={() => setAnleitungOffen(true)}
        >
          <span className="hub-neuhier-text">
            <strong>Neu hier?</strong>
            <span>So funktioniert Brauweg</span>
          </span>
          <img src="/hub/pinguin/pinguin-basis.webp" alt="" draggable={false} />
        </button>
      </div>

      <div className={`front-play-stack${activeTable ? ' has-resume' : ''}`}>
        {activeTable && (
          <button
            className="front-play"
            onClick={() => onResume(activeTable.gameId, activeTable.tableId)}
          >
            {activeTable.paused
              ? 'Weiterspielen · pausiert'
              : activeTable.status === 'waiting'
                ? 'Zurück zum Tisch'
                : 'Weiterspielen'}
          </button>
        )}
        {!activeTable && (
          <button className="front-play" onClick={() => setWahlOffen(true)}>
            Spielauswahl
          </button>
        )}
        {activeTable && (
          <button className="front-play-neben" onClick={() => setWahlOffen(true)}>
            Spielauswahl
          </button>
        )}
      </div>

      {wahlOffen && (
        <Spielwahl
          games={games}
          voted={voted}
          onVote={(gameId) => void vote(gameId)}
          onPick={(gameId) => {
            setWahlOffen(false);
            onPick(gameId);
          }}
          onSolo={(modusId) => {
            setWahlOffen(false);
            onSolo(modusId);
          }}
          onBald={onBald}
          onClose={() => setWahlOffen(false)}
        />
      )}

      {anleitungOffen && (
        <Anleitung
          games={games}
          onSpielauswahl={() => {
            setAnleitungOffen(false);
            setWahlOffen(true);
          }}
          onClose={() => setAnleitungOffen(false)}
        />
      )}
    </div>
  );
}

/**
 * Anleitung fuer Neue — hinter dem "Neu hier?"-Knopf.
 *
 * Zwei Teile: erst was Brauweg ueberhaupt ist (viele Spiele, Trophaeen, eigenes
 * Aussehen, Truhen), dann je spielbarem Spiel eine Beispielhand aus ECHTEN
 * Karten. Die Hand ist der Kern: Anfaenger sehen, was sie halten, und wer die
 * Spiele kennt, erkennt am Blatt sofort, welches es ist — auch ohne den Namen.
 *
 * Die Karten sind echt gerendert (kein gemaltes Beispielbild): So stimmt die
 * Hand mit dem Tisch ueberein, und es haengt nichts an einer Lieferung. Das
 * grosse Held-Bild und die drei Symbole kommen aus der Bestellung
 * (docs/ASSETS-ANLEITUNG.md); bis dahin stehen vorhandene Icons und ein
 * gemalter Verlauf als Platzhalter — nie ein <img> auf eine fehlende Datei.
 */
const ERKENNUNG: Record<string, { blatt: string; wieViele: string; text: string }> = {
  doppelkopf: {
    blatt: 'eiche',
    wieViele: '3 bis 5 Spieler, meist zu viert',
    text: 'Neun bis Ass, jede Karte doppelt. Die zwei Kreuz-Damen sind das stärkste Paar. Wer sie hält, spielt verdeckt zusammen. Punkte bringen Ass und Zehn.',
  },
  wizard: {
    blatt: 'zauberwald',
    wieViele: '3 bis 6 Spieler',
    text: 'Vor jeder Runde sagst du an, wie viele Stiche du machst. Genau treffen zählt. Ein Zauberer sticht alles, ein Narr verliert jeden Stich.',
  },
};

function Anleitung({
  games,
  onSpielauswahl,
  onClose,
}: {
  games: GameSummary[];
  onSpielauswahl: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const spielbar = games.filter((g) => g.availability === 'playable');
  const bald = games.filter((g) => g.availability === 'preview');

  return (
    <div className="anleitung" onClick={onClose} role="presentation">
      <div
        className="anleitung-blatt"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="So funktioniert Brauweg"
      >
        <header className="anleitung-kopf">
          <h2>Willkommen bei Brauweg</h2>
          <button className="spielwahl-zu" onClick={onClose} aria-label="Schließen">
            <Kreuz />
          </button>
        </header>

        {/* Held-Bild. Platzhalter ist der Logo-Verlauf; die Bestellung liefert
            /hub/anleitung-held.webp, das dann als <img> hier steht. */}
        <div className="anleitung-held" aria-hidden="true">
          <img className="anleitung-held-logo" src="/hub/logo.png" alt="" draggable={false} />
        </div>

        <p className="anleitung-lauf">
          Brauweg ist eine Stube voller Spiele. Du spielst, sammelst Trophäen und richtest
          dir deinen Tisch ein, allein gegen Bots oder mit anderen.
        </p>

        {/* Die drei Versprechen. Symbole sind vorhandene Icons als Platzhalter;
            die Bestellung ersetzt sie durch gemalte anleitung-*.webp. */}
        <div className="anleitung-punkte">
          <div className="anleitung-punkt">
            <img src="/hub/pokal.png" alt="" draggable={false} />
            <strong>Trophäen sammeln</strong>
            <span className="muted">
              Jede Partie bringt Trophäen. Sie tragen dich den Pfad hinauf, von der Heimat bis zum
              Sternenhafen.
            </span>
          </div>
          <div className="anleitung-punkt">
            <img src="/hub/tab-blatt.webp" alt="" draggable={false} />
            <strong>Aussehen ändern</strong>
            <span className="muted">
              Kartenblatt, Rückseite, Tischszene und deinen Pinguin stellst du frei ein. Jeder am
              Tisch sieht sein eigenes.
            </span>
          </div>
          <div className="anleitung-punkt">
            <img src="/hub/truhe.png" alt="" draggable={false} />
            <strong>Truhen erspielen</strong>
            <span className="muted">
              Beim Spielen füllst du Truhen und Aufgaben. Daraus gibt es Münzen, mit denen du neue
              Designs freischaltest.
            </span>
          </div>
        </div>

        <h3 className="anleitung-abschnitt">Woran du die Spiele erkennst</h3>
        <p className="muted anleitung-abschnitt-hint">
          So sieht ein Blatt aus. Wer ein Spiel kennt, erkennt es hier sofort an den Karten, auch
          ohne den Namen.
        </p>

        {/* Nur Spiele mit echter Beispielhand. Ein Eintrag in ERKENNUNG ist
            die Bedingung: So bekommt ein neues Kartenspiel hier eine Hand,
            sobald jemand seine Karten und einen Satz dazuschreibt. Spiele ohne
            Blatt (z. B. Feldherr, ein Echtzeit-Duell) haben keine Hand und
            gehoeren nicht in einen Abschnitt ueber Karten - eine erfundene
            Fallback-Hand waere schlicht falsch. */}
        {spielbar
          .filter((spiel) => ERKENNUNG[spiel.id])
          .map((spiel) => {
            const info = ERKENNUNG[spiel.id]!;
            const deck = deckById(info.blatt);
            const hand = handFuer(spiel.id);
            return (
              <section className="anleitung-spiel" key={spiel.id}>
                <div className="anleitung-spiel-kopf">
                  <strong>{t(spiel.nameKey)}</strong>
                  <span className="muted">{info.wieViele}</span>
                </div>
                {/* Die Beispielhand aus echten Karten des passenden Blatts. */}
                <div className="anleitung-hand">
                  {hand.map((card) => (
                    <span className="pc pc--hand anleitung-karte" key={card.id}>
                      <CardFront card={card} deck={deck} />
                    </span>
                  ))}
                </div>
                <p className="anleitung-spiel-text">{info.text}</p>
              </section>
            );
          })}

        {bald.length > 0 && (
          <p className="muted anleitung-bald">
            In Arbeit: {bald.map((g) => t(g.nameKey)).join(', ')}. In der Spielauswahl kannst du
            dafür abstimmen, was als Nächstes kommt.
          </p>
        )}

        <button className="primary anleitung-los" onClick={onSpielauswahl}>
          Los geht’s
        </button>
      </div>
    </div>
  );
}

/**
 * Rangliste im Blatt, mit Spielwahl obenauf.
 *
 * „Gesamt" summiert die Trophäen über alle Spiele (der Kopf der Gesamtliste
 * aus dem Plan), die einzelnen Reiter zeigen je Spiel. Die Reiter kommen aus
 * den spielbaren Spielen, nicht aus fester Verdrahtung — ein drittes Spiel
 * steht damit von selbst hier. Bei nur einem Spiel bleiben die Reiter weg.
 */
type RangWahl = 'gesamt' | string;

function RanglisteBlatt({
  meId,
  onClose,
  onShowProfile,
}: {
  meId: string;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  const [spiele, setSpiele] = useState<GameSummary[]>([]);
  const [wahl, setWahl] = useState<RangWahl>('gesamt');
  const [rows, setRows] = useState<RankingEntry[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Spielbare Spiele einmal holen — sie bestimmen die Reiter.
  useEffect(() => {
    void api
      .games()
      .then((liste) => setSpiele(liste.filter((g) => g.availability === 'playable')))
      .catch(() => setSpiele([]));
  }, []);

  // Liste je Auswahl neu holen. Der Wächter verwirft eine überholte Antwort,
  // falls schnell umgeschaltet wird.
  useEffect(() => {
    let aktuell = true;
    setLaedt(true);
    setError(null);
    const holen = wahl === 'gesamt' ? api.overallRanking() : api.ranking(wahl);
    void holen
      .then((liste) => {
        if (!aktuell) return;
        setRows(liste);
        setLaedt(false);
      })
      .catch((err: unknown) => {
        if (!aktuell) return;
        setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
        setRows([]);
        setLaedt(false);
      });
    return () => {
      aktuell = false;
    };
  }, [wahl]);

  const titel = wahl === 'gesamt' ? 'Gesamt' : t(`game.${wahl}`);

  return (
    <div className="doko-sheet" onClick={onClose} role="presentation">
      <div
        className="doko-sheet-card front-ranking"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Rangliste ${titel}`}
      >
        <header className="front-ranking-head">
          <strong>Rangliste · {titel}</strong>
          <button className="doko-icon" onClick={onClose} aria-label="Schließen">
            <Kreuz />
          </button>
        </header>

        {spiele.length > 1 && (
          <div className="front-ranking-tabs" role="tablist" aria-label="Wertung wählen">
            <button
              role="tab"
              aria-selected={wahl === 'gesamt'}
              className={`front-ranking-tab${wahl === 'gesamt' ? ' is-active' : ''}`}
              onClick={() => setWahl('gesamt')}
            >
              Gesamt
            </button>
            {spiele.map((g) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={wahl === g.id}
                className={`front-ranking-tab${wahl === g.id ? ' is-active' : ''}`}
                onClick={() => setWahl(g.id)}
              >
                {t(g.nameKey)}
              </button>
            ))}
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {!error && laedt && <Ladekreis />}
        {!error && !laedt && rows.length === 0 && (
          <p className="muted">Noch niemand auf der Liste.</p>
        )}
        {!laedt && rows.length > 0 && (
          <ol className="front-ranking-list">
            {rows.map((row) => (
              <li key={row.accountId} className={row.accountId === meId ? 'is-du' : undefined}>
                <span className="front-ranking-rang">{row.rank}</span>
                <button
                  className="front-ranking-name"
                  onClick={() => {
                    onClose();
                    onShowProfile(row.accountId);
                  }}
                >
                  {row.displayName}
                  {row.accountId === meId ? ' · du' : ''}
                </button>
                <span className="front-ranking-cups">
                  <img src="/hub/pokal.png" alt="" aria-hidden="true" />
                  {row.trophies}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/**
 * Spielauswahl im Vollbild: ein gemaltes Banner je Spiel.
 *
 * Doppelkopf und Zauberer sind offen und fuehren ins Tisch-Menue; die anderen
 * tragen die Bald-Marke, lassen sich anstimmen, und ein Tipp aufs Bild oeffnet
 * das "Kommt bald"-Blatt.
 *
 * **Sie sieht aus wie der Themen-Tab, und das ist der Punkt.** Vorher war sie
 * der einzige Bildschirm im Haus mit lila Flaeche und gezeichneten
 * SVG-Stillleben — daneben der Themen-Tab, der dieselbe Frage stellt
 * ("welches Spiel?") und sie mit gemalten Bannern auf einer Holztafel in
 * einer Szene stellt. Zwei Antworten auf dieselbe Frage, zwei Gestaltungen.
 *
 * Deshalb sind es hier dieselben Bausteine und nicht nachgebaute: `HubSzene`,
 * `Tafel`, `.hub-themenspiel` und `spielBanner()`. Wer den Themen-Tab
 * umgestaltet, gestaltet diesen Bildschirm mit — genau das soll so sein.
 */
function Spielwahl({
  games,
  voted,
  onVote,
  onPick,
  onSolo,
  onBald,
  onClose,
}: {
  games: GameSummary[];
  voted: Set<string>;
  onVote: (gameId: string) => void;
  onPick: (gameId: string) => void;
  onSolo: (modusId: string) => void;
  onBald: (name: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const playable = games.filter((game) => game.availability === 'playable');
  const preview = games.filter((game) => game.availability === 'preview');

  return (
    <div className="spielwahl">
      {/* Die gemalte Szene wie in jedem Hub-Tab. Sie liegt als Bild und nicht
          als CSS-Hintergrund darin, damit `object-fit: cover` sie auf jedem
          Seitenverhaeltnis fuellt statt sie zu stauchen — dieselbe Bauart wie
          `HubSzene`. */}
      <img className="spielwahl-bg" src="/hub/bg-blatt.webp" alt="" draggable={false} />

      <header className="spielwahl-kopf">
        <h2>Spielauswahl</h2>
        <button className="spielwahl-zu" onClick={onClose} aria-label="Schließen">
          <Kreuz />
        </button>
      </header>

      <div className="spielwahl-rolle">
        <Tafel titel="Alleine" zusatz="Minispiel">
          <div className="hub-themenwahl kachelraster">
            <button
              type="button"
              className="hub-themenspiel"
              onClick={() => onSolo('prosubway')}
            >
              <span className="hub-themenspiel-bild" aria-hidden="true">
                <img src={spielBanner('prosubway')} alt="" draggable={false} />
              </span>
              <span className="hub-themenspiel-text">
                <strong>{t('modus.prosubway')}</strong>
                <span className="muted">{t('modus.prosubway.hint')}</span>
              </span>
              <span className="spielwahl-spielen">Spielen</span>
            </button>
          </div>
        </Tafel>

        <Tafel titel="Jetzt spielbar" zusatz={`${playable.length} von ${games.length}`}>
          <div className="hub-themenwahl kachelraster">
            {playable.map((game) => (
              <button
                key={game.id}
                className="hub-themenspiel"
                onClick={() => onPick(game.id)}
              >
                <span className="hub-themenspiel-bild" aria-hidden="true">
                  {/* Mememory zeigt echte Memes aus dem Vorschlagskasten
                      statt eines gemalten Stilllebens — was auf dem Banner
                      haengt, liegt im Spiel auch auf den Karten. Faellt der
                      Abruf aus, faellt es auf das gemalte Bild zurueck. */}
                  {game.id === 'mememory' ? (
                    <MememoryBanner />
                  ) : game.id === 'eiland' ? (
                    /* Eiland spielt sich im Banner selbst: zwei Gebiete
                       wachsen aus ihren Ecken, der Nebel weicht. Wer weniger
                       Bewegung will, bekommt das gezeichnete Bild. */
                    <EilandBanner />
                  ) : game.id === 'filler' ? (
                    /* Filler ebenso (seit 04.09.): zwei Gebiete faerben sich
                       Feld um Feld ueber das Brett, der Nebel weicht. */
                    <FillerBanner />
                  ) : game.id === 'tafelrunde' ? (
                    /* Tafelrunde stellt sich selbst auf: Recken erscheinen
                       auf den Waben, drei gleiche werden golden zu einem
                       staerkeren. Fuer dieses Spiel gibt es noch kein
                       gemaltes Banner — das bewegte ist deshalb auch der
                       Rueckfall bei "weniger Bewegung". */
                    <TafelrundeBanner />
                  ) : (
                    <img src={spielBanner(game.id)} alt="" draggable={false} />
                  )}
                </span>
                <span className="hub-themenspiel-text">
                  <strong>{t(game.nameKey)}</strong>
                  {/* Nur der Untertitel weiss mehr als der Server: Welche
                      Spiele keine Kartenspiele sind, steht in keiner
                      Modulbeschreibung, gehoert aber aufs Banner. */}
                  <span className="muted">
                    {game.seatCounts.join(', ')} Spieler
                    {game.id === 'feldherr' ? ' · Echtzeit' : ''}
                    {game.id === 'mememory' ? ' · Meme-Memory' : ''}
                    {game.id === 'easypoker' ? ' · Hold’em' : ''}
                    {game.id === 'filler' ? ' · Flächen im Nebel' : ''}
                    {game.id === 'eiland' ? ' · Landnahme im Nebel' : ''}
                    {game.id === 'tafelrunde' ? ' · Auto-Battler' : ''}
                  </span>
                </span>
                <span className="spielwahl-spielen">Spielen</span>
              </button>
            ))}
          </div>
        </Tafel>

        {preview.length > 0 && (
          <Tafel titel="Kommt bald" zusatz="Stimm ab, was zuerst kommt">
            <div className="hub-themenwahl kachelraster">
              {preview.map((game) => (
                <div key={game.id} className="hub-themenspiel is-bald">
                  <button className="spielwahl-flaeche" onClick={() => onBald(t(game.nameKey))}>
                    <span className="hub-themenspiel-bild" aria-hidden="true">
                      <img src={spielBanner(game.id)} alt="" draggable={false} />
                    </span>
                    <span className="hub-themenspiel-text">
                      <strong>{t(game.nameKey)}</strong>
                    </span>
                  </button>
                  <span className="front-bald-tag">Bald</span>
                  <button
                    className="spielwahl-stimme"
                    disabled={voted.has(game.id)}
                    onClick={() => onVote(game.id)}
                  >
                    {voted.has(game.id) ? 'Abgestimmt' : 'Dafür stimmen'} · {game.votes}
                  </button>
                </div>
              ))}
            </div>
          </Tafel>
        )}

        {/*
          Der Mehrkampf steht unter den Spielen, weil er keines ist: Eine
          Partie besteht aus Runden verschiedener Spiele, gewertet wird die
          Platzierung ueber alles. Er braucht kein eigenes Spielmodul,
          sondern nur die Regel, dass Module Platzierungen liefern und die
          Plattform daraus die Wertung rechnet — genau dafuer ist die
          Trennung gebaut.

          Deshalb steht er auch nicht in der Spielregistrierung des Servers
          und bekommt keine Abstimmung: Er konkurriert nicht mit den
          Spielen, er benutzt sie. Eine eigene Tafel sagt das, ohne dass es
          jemand lesen muss.
        */}
        <Tafel titel="Modus" zusatz="Über mehrere Spiele">
          <div className="hub-themenwahl kachelraster">
            <div className="hub-themenspiel is-bald">
              <button
                className="spielwahl-flaeche"
                onClick={() =>
                  onBald(`${t('modus.mehrkampf')}: der Mehrkampf über mehrere Spiele`)
                }
              >
                <span className="hub-themenspiel-bild" aria-hidden="true">
                  <img src={spielBanner('mehrkampf')} alt="" draggable={false} />
                </span>
                <span className="hub-themenspiel-text">
                  <strong>{t('modus.mehrkampf')}</strong>
                </span>
              </button>
              <span className="front-bald-tag">Bald</span>
            </div>
            <p className="spielwahl-modus-text">
              Eine Partie aus Runden verschiedener Spiele. Gewertet wird, wer über alles am besten
              durchkommt — nicht, wer die meisten Punkte macht.
            </p>
          </div>
        </Tafel>
      </div>
    </div>
  );
}

/**
 * Freunde-Tab.
 *
 * Anfragen stehen zuoberst, weil sie eine Antwort verlangen. Die Suche
 * arbeitet erst ab zwei Zeichen und auf Knopfdruck - niemand soll beim
 * Tippen live durchsucht werden.
 */
function Freunde({
  onShowProfile,
}: {
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  const [lists, setLists] = useState<FriendLists | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerRef[] | null>(null);

  const reload = (): void => {
    void api.friends().then(setLists);
  };
  useEffect(reload, []);

  const search = (event: React.FormEvent): void => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    void api.searchPlayers(query).then(setResults);
  };

  const anzahl = lists ? lists.friends.length : 0;

  return (
    /*
      Kein `weit`.

      `weit` heisst "fuell den Rest der Hoehe und roll innen" und stimmt nur,
      solange die Tafel den Bildschirm allein hat — so stand sie frueher im
      eigenen Freunde-Tab. Im Profil ist sie eine von sechs Tafeln in einer
      Spalte, die selbst schon rollt: Dort bedeutet `flex: 1 1 auto` mit
      `min-height: 0` das Gegenteil, naemlich "darfst auf null schrumpfen".
      Genau das tat sie — 36 px hoch, gerade die beiden Rahmenhaelften, Liste
      und Suchfeld unsichtbar, und weil der Tafelrahmen ueberstehen darf
      (`overflow: visible`), schob sich die Konto-Tafel sichtbar darueber.
    */
    <Tafel titel="Freunde" zusatz={lists ? `${anzahl}` : '…'}>
      {/* Anfragen zuoberst: sie verlangen eine Antwort. */}
      {lists?.incoming.map((player) => (
        <div className="hub-freund is-anfrage" key={player.id}>
          <button className="hub-freund-name" onClick={() => onShowProfile(player.id)}>
            {player.displayName}
          </button>
          <button
            className="hub-mini hub-mini--ja"
            onClick={() => void api.acceptFriend(player.id).then(reload)}
          >
            Annehmen
          </button>
          <button
            className="hub-mini"
            onClick={() => void api.removeFriend(player.id).then(reload)}
          >
            Nein
          </button>
        </div>
      ))}

      {lists === null && <Ladekreis />}
      {lists !== null && lists.friends.length === 0 && lists.incoming.length === 0 && (
        <p className="muted">Noch keine Freunde. Such unten nach einem Namen.</p>
      )}

      {lists?.friends.map((player) => (
        <div className="hub-freund" key={player.id}>
          <button className="hub-freund-name" onClick={() => onShowProfile(player.id)}>
            {player.displayName}
          </button>
        </div>
      ))}

      {lists !== null && lists.outgoing.length > 0 && (
        <p className="muted">
          Angefragt: {lists.outgoing.map((player) => player.displayName).join(', ')}
        </p>
      )}

      <form className="hub-suche" onSubmit={search}>
        <input
          placeholder="Spieler suchen…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Spieler suchen"
        />
        <button className="hub-mini" type="submit" disabled={query.trim().length < 2}>
          Suchen
        </button>
      </form>

      {results !== null && results.length === 0 && (
        <p className="muted">Niemand mit diesem Namen gefunden.</p>
      )}
      {results?.map((player) => (
        <div className="hub-freund" key={player.id}>
          <button className="hub-freund-name" onClick={() => onShowProfile(player.id)}>
            {player.displayName}
          </button>
          <button
            className="hub-mini hub-mini--ja"
            onClick={() =>
              void api
                .requestFriend(player.id)
                .then(() => {
                  setResults(results.filter((entry) => entry.id !== player.id));
                  reload();
                })
                .catch(() => undefined)
            }
          >
            Anfragen
          </button>
        </div>
      ))}
    </Tafel>
  );
}

/**
 * Die Karten, an denen sich die Blätter am deutlichsten unterscheiden — je
 * Spiel andere, weil jedes Spiel ein anderes Blatt hat. Ein Doppelkopfblatt
 * hat keine Sieben, ein Zauberblatt keine Dame.
 */
const PROBEN: Record<string, { id: number; suit: string; rank: string }[]> = {
  doppelkopf: [
    { id: 1, suit: 'C', rank: 'Q' },
    { id: 2, suit: 'H', rank: 'T' },
    { id: 3, suit: 'D', rank: 'A' },
  ],
  wizard: [
    { id: 1, suit: 'Z', rank: '1' },
    { id: 2, suit: 'H', rank: '13' },
    { id: 3, suit: 'N', rank: '2' },
  ],
};

const SAMPLE = PROBEN.doppelkopf!;

function probenFuer(gameId: string): { id: number; suit: string; rank: string }[] {
  return PROBEN[gameId] ?? SAMPLE;
}

/** Eine ganze Hand für die große Vorschau. */
const VORSCHAU_HAND: Record<string, { id: number; suit: string; rank: string }[]> = {
  doppelkopf: [
    { id: 11, suit: 'C', rank: 'Q' },
    { id: 12, suit: 'S', rank: 'Q' },
    { id: 13, suit: 'H', rank: 'T' },
    { id: 14, suit: 'D', rank: 'A' },
    { id: 15, suit: 'C', rank: 'J' },
    { id: 16, suit: 'S', rank: '9' },
  ],
  wizard: [
    { id: 11, suit: 'Z', rank: '1' },
    { id: 12, suit: 'H', rank: '13' },
    { id: 13, suit: 'H', rank: '7' },
    { id: 14, suit: 'C', rank: '11' },
    { id: 15, suit: 'D', rank: '3' },
    { id: 16, suit: 'N', rank: '2' },
  ],
};

function handFuer(gameId: string): { id: number; suit: string; rank: string }[] {
  return VORSCHAU_HAND[gameId] ?? VORSCHAU_HAND.doppelkopf!;
}

/**
 * Kartenblatt waehlen.
 *
 * Mit Vorschau statt nur mit Namen: Welches Blatt einem liegt, entscheidet
 * niemand nach einer Beschreibung, sondern nach dem Hinsehen.
 */
/**
 * Themen-Tab: erst das Spiel, dann sein Aussehen.
 *
 * Der Schritt davor ist noetig, weil ein Kartenblatt nur zu seinem Spiel
 * passt — ein Doppelkopfblatt hat keine Acht, ein Rommeblatt zwei Joker.
 * Was danach kommt, ist unveraendert die bisherige Ansicht.
 *
 * Auch die noch nicht spielbaren Spiele lassen sich einstellen. Das kostet
 * nichts, geht nicht verloren, und wer sich sein Skat-Blatt vorab
 * zurechtlegt, soll das duerfen.
 */
function ThemenTab({
  me,
  onThemeChange,
  onGekauft,
}: {
  me: Me;
  onThemeChange: (
    gameId: string,
    teil: { cardDeck?: string; tableScene?: string; cardBack?: string },
  ) => void;
  /** Nach einem Kauf muss der Muenzstand oben neu geladen werden. */
  onGekauft: () => void;
}): React.JSX.Element {
  const [spiele, setSpiele] = useState<GameSummary[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  useEffect(() => {
    void api.games().then(setSpiele).catch(() => setSpiele([]));
  }, []);

  const thema = gewaehlt
    ? (me.themes[gewaehlt] ?? { cardDeck: 'text', tableScene: 'stube', cardBack: 'standard' })
    : null;

  return (
    <>
      {gewaehlt && thema ? (
        <DeckPicker
          gameId={gewaehlt}
          spielName={t(`game.${gewaehlt}`)}
          onSpielWechseln={() => setGewaehlt(null)}
          current={thema.cardDeck}
          onChange={(cardDeck) => onThemeChange(gewaehlt, { cardDeck })}
          szene={thema.tableScene}
          onSzeneChange={(tableScene) => onThemeChange(gewaehlt, { tableScene })}
          ruecken={thema.cardBack}
          onRueckenChange={(cardBack) => onThemeChange(gewaehlt, { cardBack })}
          onGekauft={onGekauft}
        />
      ) : (
        <HubSzene bg="/hub/bg-blatt.webp" className="front-blatt front-blatt--b">
          <HubBanner />
          <Tafel titel="Für welches Spiel?" zusatz="Jedes Spiel hat sein eigenes Aussehen" weit>
            <div className="hub-themenwahl">
              {(spiele ?? []).map((spiel) => {
                const t2 = me.themes[spiel.id];
                const bald = spiel.availability !== 'playable';
                return (
                  <button
                    key={spiel.id}
                    className={`hub-themenspiel${bald ? ' is-bald' : ''}`}
                    onClick={() => setGewaehlt(spiel.id)}
                  >
                    {/* Dasselbe Banner wie in der Spielauswahl unter
                        „Spielen" — die Zuordnung steht in `spielBanner()`,
                        damit beide Bildschirme nicht auseinanderlaufen. */}
                    <span className="hub-themenspiel-bild" aria-hidden="true">
                      <img src={spielBanner(spiel.id)} alt="" draggable={false} />
                    </span>
                    {/* Name und was eingestellt ist, auf einem Verlauf unten -
                        sonst muesste man jedes Spiel oeffnen, um seine Wahl zu
                        sehen. Der Verlauf haelt den Text lesbar, egal wie hell
                        das Banner an der Stelle ist. */}
                    <span className="hub-themenspiel-text">
                      <strong>{t(spiel.nameKey)}</strong>
                      <span className="muted">
                        {t(`deck.${t2?.cardDeck ?? 'text'}`)}
                        {' · '}
                        {SZENEN.find((s) => s.id === (t2?.tableScene ?? 'stube'))?.name ?? 'Stube'}
                      </span>
                    </span>
                    {bald && <span className="front-bald-tag">Bald</span>}
                  </button>
                );
              })}
              {spiele === null && <Ladekreis text="Spiele werden geladen…" />}
            </div>
          </Tafel>
        </HubSzene>
      )}
    </>
  );
}

function DeckPicker({
  gameId,
  spielName,
  onSpielWechseln,
  current,
  onChange,
  szene,
  onSzeneChange,
  ruecken,
  onRueckenChange,
  onGekauft,
}: {
  gameId: string;
  spielName: string;
  onSpielWechseln: () => void;
  current: string;
  onChange: (cardDeck: string) => void;
  szene: string;
  onSzeneChange: (tableScene: string) => void;
  ruecken: string;
  onRueckenChange: (cardBack: string) => void;
  onGekauft: () => void;
}): React.JSX.Element {
  /**
   * Angetippt wird die Wahl sofort übernommen UND groß gezeigt: Ein Blatt in
   * Daumennagelgröße sagt nichts darüber, wie es am Tisch aussieht — und
   * genau dort wird es gebraucht. Schließen bestätigt nichts und macht nichts
   * rückgängig; gewählt ist, was man angetippt hat.
   */
  const [vorschau, setVorschau] = useState(false);
  const proben = probenFuer(gameId);

  /**
   * Was schon gehoert. Steht hier und nicht in `me`, weil es sich mit jedem
   * Kauf aendert und nur dieser Bildschirm es braucht.
   */
  const [ware, setWare] = useState<RegalWare[]>([]);
  const [kauft, setKauft] = useState<string | null>(null);
  const [kaufFehler, setKaufFehler] = useState<string | null>(null);

  const ladeWare = useCallback(() => {
    void api
      .shop()
      .then((s) => setWare(s.tischware))
      .catch(() => setWare([]));
  }, []);
  useEffect(ladeWare, [ladeWare]);

  const wareZu = (art: RegalWare['art'], wert: string): RegalWare | undefined =>
    ware.find((w) => w.art === art && w.wert === wert);

  /** Gehoert es mir? Unbekanntes gilt als frei — siehe tischware.ts. */
  const gehoert = (art: RegalWare['art'], wert: string): boolean =>
    wareZu(art, wert)?.besessen ?? true;

  const kaufen = (w: RegalWare, danach: () => void): void => {
    setKauft(w.id);
    setKaufFehler(null);
    void api
      // Hier wird in Muenzen gekauft. Wer mit Edelsteinen zahlen will,
      // findet dieselbe Ware im Shop-Regal mit beiden Knoepfen.
      .buyItem(w.id, 'coins')
      .then(() => {
        ladeWare();
        onGekauft();
        danach();
      })
      .catch((e: unknown) =>
        setKaufFehler(
          (e as { code?: string })?.code === 'coinsInsufficient'
            ? 'Dafür fehlen dir Münzen.'
            : 'Der Kauf hat nicht geklappt.',
        ),
      )
      .finally(() => setKauft(null));
  };

  return (
    <HubSzene bg="/hub/bg-blatt.webp" className="front-blatt front-blatt--b">
      <HubBanner />

      {/* Welches Spiel gerade eingestellt wird, muss dabeistehen - sonst
          weiss man nach dem Blaettern nicht mehr, wofuer man waehlt. */}
      <button className="hub-themen-zurueck" onClick={onSpielWechseln} type="button">
        ← {spielName}
      </button>

      <Tafel
        titel="Kartenblatt"
        zusatz="Gilt auf allen Geräten"
        weit
        className="hub-tafel--blatt"
      >
        <div className="hub-blaetter">
          {/* Nur Blätter, die zu diesem Spiel passen: Ein Zauberblatt hat
              keine Dame, ein Doppelkopfblatt keine Sieben. */}
          {decksFor(gameId).map((deck) => {
            const w = wareZu('blatt', deck.id);
            const mein = gehoert('blatt', deck.id);
            return (
              <button
                className={`hub-blatt${deck.id === current ? ' is-an' : ''}${
                  mein ? '' : ' is-zu'
                }`}
                key={deck.id}
                aria-pressed={deck.id === current}
                disabled={kauft === w?.id}
                onClick={() => {
                  if (mein) {
                    onChange(deck.id);
                    setVorschau(true);
                    return;
                  }
                  if (!w) return;
                  if (
                    !window.confirm(
                      `„${t(deck.nameKey)}" für ${w.preis.coins} Münzen kaufen?`,
                    )
                  ) {
                    return;
                  }
                  kaufen(w, () => {
                    onChange(deck.id);
                    setVorschau(true);
                  });
                }}
              >
                <div className="hub-blatt-probe">
                  {proben.map((card) => (
                    <DeckSample card={card} deck={deck} key={card.id} />
                  ))}
                </div>
                <strong>{t(deck.nameKey)}</strong>
                {deck.id === current && mein && <span className="hub-blatt-haken">✓</span>}
                {!mein && w && (
                  <span className="hub-szene-preis">
                    <img src="/hub/muenze.png" alt="" aria-hidden="true" />
                    {w.preis.coins}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/*
          Die Szenerie steht beim Kartenblatt, weil beides dieselbe Frage
          beantwortet: Wie sieht mein Tisch aus? Sie ist persoenlich — jeder
          am Tisch sieht seine eigene, niemand entscheidet fuer alle.

          Die Vorschau zeigt echte Karten darauf, denn genau darauf kommt es
          an: Auf einem zu dunklen Untergrund verschwinden Kreuz und Pik.
          Das soll man vor dem Spiel sehen und nicht mittendrin.
        */}
        {/* Die Rueckseite ist das, was die anderen sehen — deshalb steht sie
            beim Blatt und nicht bei der Szenerie. */}
        <h3 className="hub-abschnitt">Rückseite</h3>
        <div className="hub-ruecken">
          {RUECKEN.map((r) => {
            const w = wareZu('ruecken', r.id);
            const mein = gehoert('ruecken', r.id);
            return (
              <button
                className={`hub-ruecken-knopf${r.id === ruecken ? ' is-an' : ''}${
                  mein ? '' : ' is-zu'
                }`}
                key={r.id}
                aria-pressed={r.id === ruecken}
                disabled={kauft === w?.id}
                onClick={() => {
                  if (mein) {
                    onRueckenChange(r.id);
                    return;
                  }
                  if (!w) return;
                  if (!window.confirm(`„${r.name}" für ${w.preis.coins} Münzen kaufen?`)) return;
                  kaufen(w, () => onRueckenChange(r.id));
                }}
              >
                <span className="pc pc--hand">
                  {/* „Zum Blatt passend" zeigt die Rueckseite des gewaehlten
                      Blattes — beim Textblatt das gezeichnete Muster. */}
                  <img
                    className="pc-img"
                    src={rueckenBild(r.id) ?? deckBack(deckById(current)) ?? '/hub/tab-blatt.webp'}
                    alt=""
                    draggable={false}
                  />
                </span>
                <strong>{r.name}</strong>
                {r.id === ruecken && mein && <span className="hub-blatt-haken">✓</span>}
                {!mein && w && (
                  <span className="hub-szene-preis">
                    <img src="/hub/muenze.png" alt="" aria-hidden="true" />
                    {w.preis.coins}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <h3 className="hub-abschnitt">Tisch</h3>
        {kaufFehler && <p className="clan-fehler">{kaufFehler}</p>}
        <div className="hub-szenen">
          {SZENEN.map((s) => {
            const w = wareZu('szene', s.id);
            const mein = gehoert('szene', s.id);
            return (
              <button
                className={`hub-szene${s.id === szene ? ' is-an' : ''}${
                  mein ? '' : ' is-zu'
                }`}
                key={s.id}
                aria-pressed={s.id === szene}
                disabled={kauft === w?.id}
                onClick={() => {
                  // Was mir gehoert, wird sofort eingestellt. Was nicht,
                  // wird gekauft — und danach eingestellt, denn genau das
                  // war die Absicht des Tipps.
                  if (mein) {
                    onSzeneChange(s.id);
                    setVorschau(true);
                    return;
                  }
                  if (!w) return;
                  if (!window.confirm(`„${s.name}" für ${w.preis.coins} Münzen kaufen?`)) return;
                  kaufen(w, () => {
                    onSzeneChange(s.id);
                    setVorschau(true);
                  });
                }}
              >
                <span className="hub-szene-probe">
                  <img src={szeneBild(s.id)} alt="" draggable={false} />
                  <span className="hub-szene-karten">
                    {proben.slice(0, 2).map((card) => (
                      <DeckSample card={card} deck={deckById(current)} key={card.id} />
                    ))}
                  </span>
                </span>
                <strong>{s.name}</strong>
                <span className="muted">{s.hinweis}</span>
                {s.id === szene && mein && <span className="hub-blatt-haken">✓</span>}
                {!mein && w && (
                  <span className="hub-szene-preis">
                    <img src="/hub/muenze.png" alt="" aria-hidden="true" />
                    {w.preis.coins}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Tafel>

      {vorschau && (
        <TischVorschau
          gameId={gameId}
          spielName={spielName}
          deck={deckById(current)}
          szene={szene}
          onClose={() => setVorschau(false)}
        />
      )}
    </HubSzene>
  );
}

/**
 * Große Vorschau: so sieht der Tisch mit dieser Wahl aus.
 *
 * Kein Bildschirmfoto und keine Nachbildung des ganzen Tisches — nur die drei
 * Dinge, an denen sich eine Wahl entscheidet: die gewählte Szenerie als
 * Untergrund, ein Stich in der Mitte und die eigene Hand am unteren Rand, in
 * denselben Größen wie am echten Tisch.
 *
 * Der Grund für diesen Bildschirm: Auf einem zu dunklen Untergrund
 * verschwinden Kreuz und Pik, und ein Blatt in Daumennagelgröße verrät das
 * nicht. Das soll man vor dem Spiel sehen, nicht mittendrin.
 */
function TischVorschau({
  gameId,
  spielName,
  deck,
  szene,
  onClose,
}: {
  gameId: string;
  spielName: string;
  deck: Deck;
  szene: string;
  onClose: () => void;
}): React.JSX.Element {
  const hand = handFuer(gameId);
  const stich = hand.slice(0, 3);
  const szeneName = SZENEN.find((s) => s.id === szene)?.name ?? szene;

  return (
    <div className="hub-vorschau" onClick={onClose}>
      <div className="hub-vorschau-tisch" onClick={(event) => event.stopPropagation()}>
        <img className="hub-vorschau-bg" src={szeneBild(szene)} alt="" draggable={false} />

        <div className="hub-vorschau-kopf">
          <strong>
            {t(deck.nameKey)} · {szeneName}
          </strong>
          <span className="muted">So sieht dein {spielName}-Tisch aus</span>
        </div>

        {/* Mitspieler oben: verdeckte Karten zeigen den Rücken des Blatts. */}
        <div className="hub-vorschau-gegner">
          {Array.from({ length: 5 }, (_, i) => (
            <span className="hub-vorschau-ruecken" key={i}>
              {deckRuecken(deck)}
            </span>
          ))}
        </div>

        <div className="hub-vorschau-stich">
          {stich.map((card, i) => (
            <span className={`hub-vorschau-karte at-${i}`} key={card.id}>
              <DeckSample card={card} deck={deck} />
            </span>
          ))}
        </div>

        <div className="hub-vorschau-hand">
          {hand.map((card) => (
            <span className="hub-vorschau-karte" key={card.id}>
              <DeckSample card={card} deck={deck} />
            </span>
          ))}
        </div>

        <button className="primary hub-vorschau-fertig" onClick={onClose}>
          Passt
        </button>
      </div>
    </div>
  );
}

/** Rückseite des Blattes, oder das gezeichnete Muster beim Textblatt. */
function deckRuecken(deck: Deck): React.JSX.Element {
  const src = deckBack(deck);
  if (src) return <img className="card-img" src={src} alt="" draggable={false} />;
  return <span className="card card--back" aria-hidden="true" />;
}

function DeckSample({
  card,
  deck,
}: {
  card: { suit: string; rank: string };
  deck: Deck;
}): React.JSX.Element {
  const src = cardImage(deck, card);
  if (src) return <img className="card-img" src={src} alt={cardName(card)} draggable={false} />;
  return (
    <span className={`card${isRed(card) ? ' red' : ''}`}>{cardLabel(card)}</span>
  );
}

// ---------------------------------------------------------------------------
// Profilbild
// ---------------------------------------------------------------------------

const AVATAR_PX = 128;

/**
 * Verkleinert das gewaehlte Bild im Browser auf ein kleines Quadrat und gibt
 * es als data-URL zurueck. So geht nie ein grosses Foto an den Server, und die
 * Groesse bleibt weit unter dem serverseitigen Riegel.
 */
async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('kein Canvas');
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_PX,
    AVATAR_PX,
  );
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Profilbild im Kopf des Profil-Tabs.
 *
 * Das Bild IST der Knopf: antippen oeffnet die Dateiwahl, ein kleines
 * Stiftzeichen sagt das an. Kein eigener Kasten mehr - im Hub zaehlt jede
 * Zeile Hoehe.
 */
function ProfilBild({
  me,
  onChanged,
}: {
  me: Me;
  onChanged: () => void;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ver, setVer] = useState(0);

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      await api.setAvatar(await downscale(file));
      setVer((v) => v + 1);
      onChanged();
    } catch {
      setErr('Bild ließ sich nicht speichern.');
    } finally {
      setBusy(false);
    }
  };

  const src = me.avatarUrl ? `${me.avatarUrl}?v=${ver}` : null;

  return (
    <label className={`hub-profilbild${busy ? ' is-busy' : ''}`} title="Profilbild ändern">
      {src ? (
        <img src={src} alt="Profilbild" draggable={false} />
      ) : (
        <Pinguin getragen={me.avatar} groesse={3.2} titel="Profilbild" />
      )}
      <span className="hub-profilbild-stift" aria-hidden="true">
        ✎
      </span>
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={busy}
        onChange={(e) => void pick(e.target.files?.[0])}
        aria-label="Profilbild ändern"
      />
      {err && <span className="error">{err}</span>}
    </label>
  );
}

