import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { Ladekreis } from '../Ladekreis';

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
import { inApp, serverAdresse } from '../laufzeit';
import { inAppSichtbar } from '../app-sichtbar';
import { imUmfang } from '../umfang';
import { schonGefeiert } from '../lernen/gefeiert';
import {
  RUECKEN,
  cardImage,
  deckBack,
  deckById,
  deckForGame,
  deckMitRuecken,
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
import { EinstellungenBlatt, MitteilungenBlatt } from './Einstellungen';
import {
  EdelsteinIcon,
  HubBanner,
  HubSzene,
  Tafel,
} from '../hub';
import { Pinguin } from '../pinguin';
import { Kreuz, Note, Wuerfel } from '../zeichen';
import { Clan } from './Clan';
import { FundBlatt, TruhenBild } from './Aufgaben';
import { Kleiderschrank } from './Kleiderschrank';
import { KontoSichern } from './KontoSichern';
import { BrowortImProfil } from '../browort/BrowortImProfil';
import { Klanghalle } from './Klanghalle';
import { LEERE_BEMALUNG } from '../bemalung';

/**
 * Die 3D-Figur wird nachgeladen: `three` und `drei` wiegen rund 900 kB. Bis
 * sie da ist, steht der gemalte Pinguin als Rueckfall — siehe die Stelle im
 * Profil-Tab.
 */
const Avatar3D = lazy(() => import('../Avatar3D'));

/**
 * Die Werkstatt wird nachgeladen — genau wie in `main.tsx`, die sie fuer
 * `?dev=werkstatt` schon per `lazy` holt. Solange sie hier statisch stand,
 * zog der statische Import gegen den dynamischen: Vite meldete bei jedem Bau
 * "dynamically imported by main.tsx but also statically imported by
 * GameSelect.tsx" und liess sie im Hauptbuendel liegen, obwohl die
 * allermeisten Besucher sie nie oeffnen.
 */
const Avatarwerkstatt = lazy(() =>
  import('./Avatarwerkstatt').then((m) => ({ default: m.Avatarwerkstatt })),
);
/** „Doppelkopf lernen" — nur in der App und erst beim Oeffnen nachgeladen. */
const Lernpfad = lazy(() => import('../lernen/Lernpfad').then((m) => ({ default: m.Lernpfad })));
const Browort = lazy(() => import('../browort/Browort').then((m) => ({ default: m.Browort })));
const Clanwort = lazy(() => import('../browort/Clanwort').then((m) => ({ default: m.Clanwort })));
const Kartenmanufaktur = lazy(() =>
  import('../manufaktur/Kartenmanufaktur').then((m) => ({ default: m.Kartenmanufaktur })),
);
const MeisterFeier = lazy(() => import('../lernen/Feier').then((m) => ({ default: m.MeisterFeier })));
import { Stufenbalken, Stufenleiter } from './Stufen';
import { Rechtliches } from './Auth';
import { cardLabel, cardName, isRed, t } from '../i18n';
import { SHOP_RUBRIK } from '../inhaltspakete';
import { StartNeu } from './StartNeu';
import { NeuerRahmen } from './HubRahmen';
import { SpieleNeu } from './SpieleNeu';
import { TrophaeenwegNeu } from './TrophaeenwegNeu';
import { HeuteNeu } from './HeuteNeu';
import { SammlungNeu } from './SammlungNeu';
import { HbBlatt, HbSymbol, ImHub, Schliessen, Zurueck, useEscape, useRueckfrage } from './HbBlatt';
import { bannerFuer } from './StartNeu';
import { truhenBild } from '../truhenbild';
import '@fontsource/lilita-one';
import '@fontsource-variable/nunito';
import './hub-neu.css';

/**
 * Startbildschirm im Stil eines Handyspiels: unten die Tab-Leiste mit
 * "Spielen" in der Mitte, oben die Ressourcen-Leiste mit Level, Muenzen und
 * VIP. Was es noch nicht gibt - Shop, Muenzen kaufen, Tagesbonus, Level -,
 * steht trotzdem schon da, mit ehrlichen Nullen und einem "Kommt bald" beim
 * Antippen: Die Oberflaeche zeigt, wohin die Reise geht. Handy ist der
 * Massstab - im breiten Browser bleibt die Flaeche auf Handybreite begrenzt.
 */

/** `spiele` gibt es nur im neuen Hub (dort ist die Spielauswahl ein Reiter). */
export type Tab = 'shop' | 'clan' | 'spielen' | 'blatt' | 'profil' | 'spiele';

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
  anfangsTab,
  anfangsSpiel,
  anfangsWeg,
  anfangsHeute,
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
  /** Nur für die Probe `?dev=hub`: mit welchem Reiter und welcher Spielseite sie öffnet. */
  anfangsTab?: Tab;
  anfangsSpiel?: string;
  anfangsWeg?: boolean;
  anfangsHeute?: boolean;
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(anfangsTab ?? 'spielen');
  /** Neues Hub: das Spiel, dessen Spielseite im Reiter „Spiele" offen ist. */
  const [spielseite, setSpielseite] = useState<string | null>(anfangsSpiel ?? null);
  /** Neues Hub: der Trophäenweg als Vollbild. */
  const [wegOffen, setWegOffen] = useState(anfangsWeg ?? false);
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
  const [aufgabenOffen, setAufgabenOffen] = useState(anfangsHeute ?? false);
  const [schrankOffen, setSchrankOffen] = useState(false);
  const [klanghalleOffen, setKlanghalleOffen] = useState(false);
  const [werkstattOffen, setWerkstattOffen] = useState(false);
  /** Doppelkopf lernen (nur App): Lernpfad als Vollbild. */
  const [lernenOffen, setLernenOffen] = useState(false);
  // Jeweils zusätzlich der Umfang der Ausgabe (umfang.ts): Fehlt der Teil
  // dort, fehlt sein Einstieg — die Route sperrt der Server ohnehin.
  const oeffneLernen = inApp && imUmfang('lernpfad') ? () => setLernenOffen(true) : undefined;
  /** Browort und Clanwort (nur App): Vollbilder wie der Lernpfad. */
  const [browortOffen, setBrowortOffen] = useState(false);
  const [clanwortOffen, setClanwortOffen] = useState(false);
  const oeffneBrowort = inApp && imUmfang('browort') ? () => setBrowortOffen(true) : undefined;
  const oeffneClanwort = inApp && imUmfang('clanwort') ? () => setClanwortOffen(true) : undefined;
  /** Kartenmanufaktur (nur App): das Idle-Spiel als Vollbild. */
  const [manufakturOffen, setManufakturOffen] = useState(false);
  const soloStarten = (modusId: string): void => {
    if (modusId === 'kartenmanufaktur') setManufakturOffen(true);
    else if (modusId === 'browort') setBrowortOffen(true);
    else onSolo(modusId);
  };
  /** Das Outfit kam ueber die Uebungsrunde: einmal feiern (lernen/Feier.tsx). */
  const [feierZu, setFeierZu] = useState(false);
  const zeigeFeier = Boolean(oeffneLernen) && me.lernen?.belohnt === true && !feierZu && !lernenOffen && !schonGefeiert();
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

  // Shop · Spiele · Start · Sammlung · Clan, Start mittig. In der App fehlt der
  // Shop (siehe zeigeKaufbares); dort steht das Profil an seiner Stelle, damit
  // Start in der Mitte bleibt. Gewechselt wird nur über die Leiste, nicht per
  // Wisch — warum, steht in HubRahmen.tsx am Track.
  const tabFolge: Tab[] = [zeigeKaufbares ? 'shop' : 'profil', 'spiele', 'spielen', 'blatt', 'clan'];
  const trackRef = useRef<HTMLDivElement>(null);
  // Am Track hängt immer nur der offene Reiter — sonst lüde der Start alle auf einmal.
  const fenster: Tab[] = [tab];

  const renderTab = (tt: Tab): React.JSX.Element | null => {
    switch (tt) {
      case 'shop':
        return zeigeKaufbares ? (
          <Shop neu coins={me.coins} gems={me.gems} onBald={setBald} onGuthaben={onAvatarChange} />
        ) : null;
      case 'clan':
        return (
          <Clan
            neu
            clanId={me.clubs[0]?.id ?? null}
            meId={me.id}
            onBald={setBald}
            onShowProfile={onShowProfile}
            onMeChange={onAvatarChange}
            onClanwort={oeffneClanwort}
          />
        );
      case 'spiele':
        return (
          <SpieleNeu
            me={me}
            offen={spielseite}
            onOeffne={setSpielseite}
            onPick={onPick}
            onSolo={soloStarten}
            onBald={setBald}
            onSammlung={() => setTab('blatt')}
            onLernen={oeffneLernen}
          />
        );
      case 'spielen':
        return (
          <StartNeu
            me={me}
            trophies={trophies}
            activeTable={me.activeTable}
            bereit={me.bereit.truhen + me.bereit.aufgaben}
            wegBereit={me.bereit.weg ?? 0}
            onResume={onResume}
            onPick={(gameId) => {
              setSpielseite(gameId);
              setTab('spiele');
            }}
            onAlleSpiele={() => {
              setSpielseite(null);
              setTab('spiele');
            }}
            onHeute={() => setAufgabenOffen(true)}
            onWeg={() => setWegOffen(true)}
            onLernen={oeffneLernen}
            onBrowort={oeffneBrowort}
          />
        );
      case 'blatt':
        return (
          <SammlungNeu
            me={me}
            onThemeChange={onThemeChange}
            onGekauft={onAvatarChange}
            onSchrank={() => setSchrankOffen(true)}
            onWerkstatt={() => {
              spiele('blatt-auf');
              setWerkstattOffen(true);
            }}
            details={(gameId, zurueck) => {
              const thema = me.themes[gameId] ?? { cardDeck: 'text', tableScene: 'stube', cardBack: 'standard' };
              return (
                <DeckPicker
                  neu
                  gameId={gameId}
                  spielName={t(`game.${gameId}`)}
                  onSpielWechseln={zurueck}
                  current={thema.cardDeck}
                  onChange={(cardDeck) => onThemeChange(gameId, { cardDeck })}
                  szene={thema.tableScene}
                  onSzeneChange={(tableScene) => onThemeChange(gameId, { tableScene })}
                  ruecken={thema.cardBack}
                  onRueckenChange={(cardBack) => onThemeChange(gameId, { cardBack })}
                  onGekauft={onAvatarChange}
                />
              );
            }}
          />
        );
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

  // Blätter und Vollbilder über dem Rahmen.
  const overlays = (
    <>
      {wegOffen && (
        <TrophaeenwegNeu trophies={trophies} onClose={() => setWegOffen(false)} onGuthaben={onAvatarChange} />
      )}
        {stufenOffen && <Stufenleiter neu onClose={() => setStufenOffen(false)} />}
        {aufgabenOffen && (
          <HeuteNeu
            onClose={() => setAufgabenOffen(false)}
            onGuthaben={onAvatarChange}
            onRangliste={() => {
              // Ein Blatt zugleich: Heute schließt, die Rangliste öffnet.
              setAufgabenOffen(false);
              setRanglisteOffen(true);
            }}
          />
        )}
        {schrankOffen && (
          <Kleiderschrank
            neu
            getragen={me.avatar}
            onClose={() => setSchrankOffen(false)}
            onGetragen={onAvatarChange}
            onGuthaben={onAvatarChange}
          />
        )}
        {klanghalleOffen && <Klanghalle neu onClose={() => setKlanghalleOffen(false)} />}
        {werkstattOffen && (
          // Der Rueckfall traegt dieselbe Blatthuelle wie die Werkstatt selbst:
          // Der Tipp verdunkelt sofort den Hintergrund, statt bis zum
          // nachgeladenen Stueck so auszusehen, als sei nichts passiert.
          <Suspense
            fallback={
              <div className="doko-sheet doko-sheet--mitte">
                <Ladekreis text="Werkstatt wird geladen…" />
              </div>
            }
          >
            <Avatarwerkstatt
              neu
              bemalung={me.figur ?? null}
              getragen={me.avatar}
              onClose={() => setWerkstattOffen(false)}
              // Neu laden, damit die Figur im Profil sofort so aussieht wie
              // gerade gespeichert.
              onGespeichert={() => onAvatarChange()}
            />
          </Suspense>
        )}
        {lernenOffen && (
          <Suspense
            fallback={
              <div className="doko-sheet doko-sheet--mitte">
                <Ladekreis text="Lernpfad wird geladen…" />
              </div>
            }
          >
            <Lernpfad
              deck={deckMitRuecken(
                deckForGame('doppelkopf', me.themes.doppelkopf?.cardDeck),
                me.themes.doppelkopf?.cardBack,
              )}
              onClose={() => setLernenOffen(false)}
              onUebung={(tableId) => {
                setLernenOffen(false);
                onResume('doppelkopf', tableId);
              }}
              onGeaendert={onAvatarChange}
            />
          </Suspense>
        )}
        {browortOffen && (
          <Suspense fallback={null}>
            <Browort onClose={() => setBrowortOffen(false)} onGeaendert={onAvatarChange} />
          </Suspense>
        )}
        {clanwortOffen && (
          <Suspense fallback={null}>
            <Clanwort onClose={() => setClanwortOffen(false)} onGeaendert={onAvatarChange} />
          </Suspense>
        )}
        {manufakturOffen && (
          <Suspense fallback={null}>
            <Kartenmanufaktur onClose={() => setManufakturOffen(false)} onGeaendert={onAvatarChange} getragen={me.avatar} />
          </Suspense>
        )}
        {zeigeFeier && (
          <Suspense fallback={null}>
            <MeisterFeier
              outfit={['hut-doktorhut', 'oberteil-meisterrobe']}
              onClose={() => setFeierZu(true)}
              onAngezogen={onAvatarChange}
            />
          </Suspense>
        )}
        {bald && <BaldBlatt name={bald} onClose={() => setBald(null)} />}
        {ranglisteOffen && (
          <RanglisteBlatt neu meId={me.id} onClose={() => setRanglisteOffen(false)} onShowProfile={onShowProfile} />
        )}
      </>
  );

  return (
    <NeuerRahmen
      me={me}
      tab={tab}
      tabFolge={tabFolge}
      online={online}
      trophies={trophies}
      kaufbar={zeigeKaufbares}
      onTab={setTab}
      fenster={fenster}
      trackRef={trackRef}
      renderTab={renderTab}
    >
      {overlays}
    </NeuerRahmen>
  );
}

/**
 * "Kommt bald"-Blatt: schlicht — Zeichen, Titel, ein Satz, CTA.
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
    <HbBlatt titel="Kommt bald!" label={`Kommt bald: ${name}`} onClose={onClose} klasse="is-klein">
      <div className="hb-mitte">
        <span className="hb-bald-zeichen" aria-hidden="true">
          🔨
        </span>
        <p className="hb-text">Daran bauen wir gerade: {name}.</p>
      </div>
      <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onClose}>
        Alles klar
      </button>
    </HbBlatt>
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
  const [mitteilungenOffen, setMitteilungenOffen] = useState(false);
  const [sichernOffen, setSichernOffen] = useState(false);

  const kacheln = [
    { icon: '/hub/tab-spielen.webp', name: 'Partien', wert: partien },
    { icon: '/hub/krone.png', name: 'Siege', wert: siege },
    { icon: '/hub/muenze.png', name: 'Siegquote', wert: quote },
    // Hier stand `DECKS.length` als „Blätter" — die Zahl aller Blätter im
    // Katalog, also bei jedem Spieler dieselbe 15. Die eigenen kennt erst die
    // Sammlung (sie braucht den Shop); hier steht, was das Profil weiß.
    { icon: '/hub/tab-blatt.webp', name: 'Spiele', wert: me.stats.filter((s) => s.parties > 0).length },
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

  const bereit = me.bereit.truhen + me.bereit.aufgaben;
  const geburtstag = (
    <section className="hb-blk">
      <h2 className="hb-ab">
        Geburtstag
        <span className="hb-ab-zusatz">{me.birthdayRewardClaimable ? 'Heute!' : 'Einmal im Jahr'}</span>
      </h2>
      <div className={`hb-karte hb-geburtstag${me.birthdayRewardClaimable ? ' is-heute' : ''}`}>
        <img src="/hub/pinguin-geburtstag.png" alt="Geburtstags-Pinguin" draggable={false} />
        <span className="hb-geburtstag-text">
          <strong>Geburtstags-Pinguin</strong>
          <small>
            {me.birthdayRewardClaimable
              ? 'Heute abholen: Outfit mit Partyhüten.'
              : me.hasBirthdayOutfit
                ? 'In deiner Sammlung · nächstes Mal am Geburtstag.'
                : 'Am Geburtstag einmal im Jahr einsammeln.'}
          </small>
          {me.birthdayRewardClaimable && (
            <button type="button" className="hb-kn is-gold" disabled={claimBusy} onClick={claimReward}>
              {claimBusy ? 'Wird geholt…' : 'Belohnung holen'}
            </button>
          )}
          {claimError && <span className="hb-fehler">{claimError}</span>}
        </span>
      </div>
    </section>
  );
  const einstiege = [
    { icon: '/hub/icon-kleiderschrank.webp', name: 'Kleiderschrank', punkt: null, onClick: onSchrank },
    { icon: '/hub/icon-klanghalle.webp', name: 'Klanghalle', punkt: null, onClick: onKlanghalle },
    { icon: '/hub/icon-aufgaben.webp', name: 'Aufgaben', punkt: bereit > 0 ? `${bereit} bereit` : null, onClick: onAufgaben },
  ];
  return (
    <div className="hb-profil">
      <header className="hb-kopfzeile">
        <h1 className="hb-titel">Profil</h1>
      </header>
      <div className="hb-profil-inhalt">
        <div className="hb-karte hb-profilkopf">
          <ProfilBild me={me} onChanged={onAvatarChange} />
          <span className="hb-profilkopf-text">
            <strong>{me.displayName}</strong>
            {/* In der App ohne Geburtstag (Emile, 22.10.2026) — dort steht
                stattdessen die Stufe in Worten. */}
            <small>{inApp ? `Stufe ${me.level.stufe}` : geburtstagText}</small>
          </span>
          <span className="hb-stufe" aria-label={`Stufe ${me.level.stufe}`}>
            {me.level.stufe}
          </span>
        </div>

        <Stufenbalken
          neu
          stufe={me.level.stufe}
          imLevel={me.level.imLevel}
          fuerLevel={me.level.fuerLevel}
          onClick={onStufen}
        />

        {!inApp && me.birthdayRewardClaimable && geburtstag}

        {/* In der App ohne 3D-Figur: Für die erste Fassung gibt es dort den
            Kleiderschrank (Emile, 22.10.2026). */}
        {!inApp && (
        <section className="hb-blk">
          <h2 className="hb-ab">
            Deine Figur
            <span className="hb-ab-zusatz">{me.figur?.design === 'bemalt' ? 'Selbst angemalt' : 'Antippen zum Bearbeiten'}</span>
          </h2>
          {/* Über die volle Breite, aus demselben Grund wie im alten
              Profil: Ein WebGL-Bereich hat keine eigene Höhe. */}
          <button type="button" className="hb-figur" onClick={onWerkstatt} aria-label="Figur bearbeiten">
            <Suspense fallback={<Pinguin getragen={me.avatar} groesse={9} titel="Deine Figur" />}>
              <Avatar3D getragen={me.avatar} bemalung={me.figur ?? LEERE_BEMALUNG} drehbar={false} />
            </Suspense>
            <span className="hb-figur-stift" aria-hidden="true">
              <HbSymbol>
                <path d="M14 4l6 6-8 8H6v-6z M12 6l6 6" />
              </HbSymbol>
            </span>
          </button>
          <p className="hb-klein hb-ohne-rand">Drehen, anmalen, Mütze aufsetzen — antippen.</p>
        </section>
        )}

        <section className="hb-blk">
          <h2 className="hb-ab">
            Deine Sachen
            <span className="hb-ab-zusatz">
              {/* Die Plätze der Figur, nicht die Kacheln darunter: „0 von 6
                  Plätzen" über drei Kacheln las sich wie fehlende Kacheln. */}
              {Object.keys(me.avatar).length} von {SLOTS.length} angezogen
            </span>
          </h2>
          <div className="hb-einstiege">
            {einstiege.map((e) => (
              <button
                type="button"
                key={e.name}
                className="hb-einstieg"
                aria-label={mitPunkt(e.name, e.punkt)}
                onClick={() => {
                  spiele('tipp');
                  e.onClick();
                }}
              >
                <img src={e.icon} alt="" draggable={false} />
                <span>{e.name}</span>
                {e.punkt !== null && <span className="hb-tab-punkt" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </section>

        <section className="hb-blk">
          <h2 className="hb-ab">
            Trophäen
            <span className="hb-ab-zusatz">{partien} Partien</span>
          </h2>
          <div className="hb-karte hb-trophaeen">
            <span className="hb-trophaeen-zahl">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {trophaeen.toLocaleString('de-DE')}
            </span>
            <span className="hb-klein">alle Spiele zusammen</span>
            <span className="hb-sp-werte is-vier">
              {kacheln.map((k) => (
                <span key={k.name}>
                  <b>{typeof k.wert === 'number' ? k.wert.toLocaleString('de-DE') : k.wert}</b>
                  {k.name}
                </span>
              ))}
            </span>
          </div>
          <div className="hb-liste">
            {me.stats.length === 0 ? (
              <p className="hb-klein hb-liste-leer">Noch keine Partie gespielt.</p>
            ) : (
              me.stats.filter((row) => inAppSichtbar(row.gameId)).map((row) => (
                <div className="hb-mg" key={row.gameId}>
                  <img className="hb-mg-spiel" src={bannerFuer(row.gameId)} alt="" />
                  <span className="hb-mg-name">
                    <strong>{t(`game.${row.gameId}`)}</strong>
                    <small className="is-leise">
                      {row.parties} Partien · {row.wins} Siege
                    </small>
                  </span>
                  <span className="hb-pk">
                    <img src="/hub/symbol-pokal.webp" alt="" />
                    {row.trophies.toLocaleString('de-DE')}
                  </span>
                </div>
              ))
            )}
          </div>
          {/* Bis zum 13.10.2026 stand hier „nur an Tischen ohne Bots". Der
              Server zählt Bot-Tische aber seit dem 04.08.2026 mit
              (`countsForRanking` in tables/service.ts); ausgenommen sind nur
              Gäste am Tisch und Training. */}
          <p className="hb-klein hb-ohne-rand">
            Trophäen gibt es auch gegen Bots — nur nicht, wenn ein Gast mitspielt oder Training an ist.
          </p>
        </section>

        {/* Browort nur in der App (wie der Lernpfad), Zahlen aus `/api/me`. */}
        {inApp && imUmfang('browort') && (
          <BrowortImProfil
            du
            serie={me.browort?.serie ?? 0}
            schnitt={me.browort?.schnitt ?? null}
            geloest={me.browort?.geloest ?? 0}
          />
        )}

        <Freunde neu onShowProfile={onShowProfile} />

        {!inApp && !me.birthdayRewardClaimable && geburtstag}

        {/* Harmlos nach oben, endgültig nach unten — Löschen steht allein
            und rot am Schluss, nicht neben „Abmelden" (siehe oben). */}
        <section className="hb-blk">
          <h2 className="hb-ab">
            Konto
            <span className="hb-ab-zusatz">{me.displayName}</span>
          </h2>
          <div className="hb-liste">
            {me.gast && (
              <button type="button" className="hb-mg is-du" onClick={() => setSichernOffen(true)}>
                <span className="hb-mg-symbol hb-mg-symbol-ic" aria-hidden="true">
                  <HbSymbol>
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </HbSymbol>
                </span>
                <span className="hb-mg-name">
                  <strong>Konto sichern</strong>
                  <small>Du spielst als Gast</small>
                </span>
                <span className="hb-pf" aria-hidden="true">
                  ›
                </span>
              </button>
            )}
            <button
              type="button"
              className="hb-mg"
              onClick={() => {
                spiele('blatt-auf');
                setEinstellungenOffen(true);
              }}
            >
              <img className="hb-mg-symbol" src="/hub/icon-einstellungen.webp" alt="" />
              <span className="hb-mg-name">
                <strong>Einstellungen</strong>
              </span>
              <span className="hb-pf" aria-hidden="true">
                ›
              </span>
            </button>
            {/* In der App gibt es Mitteilungen (docs/PUSH.md), auf der
                Webseite nicht — dort bleibt es „Bald". */}
            <button
              type="button"
              className="hb-mg"
              onClick={() => (inApp ? setMitteilungenOffen(true) : onBald('Benachrichtigungen'))}
            >
              <img className="hb-mg-symbol" src="/hub/icon-benachrichtigung.webp" alt="" />
              <span className="hb-mg-name">
                <strong>Benachrichtigungen</strong>
              </span>
              {inApp ? (
                <span className="hb-pf" aria-hidden="true">
                  ›
                </span>
              ) : (
                <span className="hb-bald-marke">Bald</span>
              )}
            </button>
            <button type="button" className="hb-mg" onClick={onSignOut}>
              <img className="hb-mg-symbol" src="/hub/icon-abmelden.webp" alt="" />
              <span className="hb-mg-name">
                <strong>Abmelden</strong>
              </span>
            </button>
          </div>
          <Rechtliches />
          <button type="button" className="hb-kn is-gefahr is-breit" onClick={() => setLoeschenOffen(true)}>
            Konto löschen
          </button>
        </section>
      </div>

      {einstellungenOffen && (
        <ImHub>
          <EinstellungenBlatt
            neu
            onClose={() => {
              spiele('blatt-zu');
              setEinstellungenOffen(false);
            }}
          />
        </ImHub>
      )}
      {mitteilungenOffen && (
        <ImHub>
          <MitteilungenBlatt neu onClose={() => setMitteilungenOffen(false)} />
        </ImHub>
      )}
      {sichernOffen && (
        <KontoSichern
          neu
          onClose={() => setSichernOffen(false)}
          onGesichert={() => {
            setSichernOffen(false);
            onMeChange();
          }}
        />
      )}
      {loeschenOffen && (
        <ImHub>
          <KontoLoeschenBlatt
            name={me.displayName}
            weg={me.loeschenPer ?? 'passwort'}
            onClose={() => setLoeschenOffen(false)}
            onDeleted={onDeleted}
          />
        </ImHub>
      )}
    </div>
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
 *
 * Konten ohne Passwort (seit dem 23.09.2026, Apple 5.1.1(v)): Wer nur ueber
 * Google oder Apple hereinkam, fordert einen Code an die eigene Adresse an;
 * ein Gast tippt LÖSCHEN. Welcher Weg gilt, sagt der Server (`loeschenPer`).
 */
export function KontoLoeschenBlatt({
  name,
  weg,
  onClose,
  onDeleted,
}: {
  name: string;
  weg: 'passwort' | 'code' | 'bestaetigung';
  onClose: () => void;
  onDeleted: () => void;
}): React.JSX.Element {
  /** Passwort, Code oder das Wort — je nach `weg` genau eins davon. */
  const [passwort, setPasswort] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Nur beim Code: ob er angefordert ist, und was der Server dazu sagte. */
  const [codeHinweis, setCodeHinweis] = useState<string | null>(null);

  const codeAnfordern = (): void => {
    if (busy) return;
    setBusy(true);
    setFehler(null);
    void api
      .loeschcodeAnfordern()
      .then((antwort) =>
        setCodeHinweis(
          antwort.versandt
            ? 'Der Code ist unterwegs. Er gilt 15 Minuten.'
            : 'Eben kam schon ein Code — er gilt weiter. Einen neuen gibt es in einer Minute.',
        ),
      )
      .catch((err: unknown) =>
        setFehler(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.'),
      )
      .finally(() => setBusy(false));
  };

  const loeschen = (event: React.FormEvent): void => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFehler(null);
    const nachweis =
      weg === 'code' ? { code: passwort } : weg === 'bestaetigung' ? { bestaetigung: passwort } : passwort;
    void api.deleteMe(nachweis).then(onDeleted, (err: unknown) => {
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

        {weg === 'passwort' ? (
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
        ) : weg === 'code' ? (
          <>
            <p className="muted">
              Dein Konto hat kein Passwort. Zur Bestätigung schicken wir dir einen Code an deine
              E-Mail-Adresse.
            </p>
            <button type="button" className="hub-knopf hub-knopf--a" onClick={codeAnfordern} disabled={busy}>
              {codeHinweis ? 'Neuen Code schicken' : 'Code schicken'}
            </button>
            {codeHinweis && <p className="muted" role="status">{codeHinweis}</p>}
            <label>
              Code aus der Mail
              <input
                value={passwort}
                onChange={(event) => setPasswort(event.target.value)}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                required
              />
            </label>
          </>
        ) : (
          <label>
            Tippe LÖSCHEN ein, um zu bestätigen
            <input
              value={passwort}
              onChange={(event) => setPasswort(event.target.value)}
              autoFocus
              autoCapitalize="characters"
              required
            />
          </label>
        )}

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
      {/* Dieselbe Truhe wie in „Heute" und am Trophäenweg — das gemalte Bild
          aus `truhenBild()`. Eine zweite waere eine, die sich ab der ersten
          Bildlieferung unterscheidet. */}
      <img className="hub-angebot-art" src={truhenBild(truhe.grad)} alt="" draggable={false} />
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

  const titel =
    frage.art === 'ware' ? frage.name : frage.art === 'truhe' ? t(frage.truhe.nameKey) : t(frage.paket.nameKey);
  // Das Paketbild zeigt, was man bekommt: Münzen, BroJetons oder Edelsteine.
  const paketBild =
    frage.art === 'paket'
      ? frage.paket.gibt?.waehrung === 'broJetons'
        ? '/hub/symbol-brojeton.webp'
        : frage.paket.gibt?.waehrung === 'gems'
          ? '/hub/symbol-edelstein.webp'
          : '/hub/symbol-muenze.webp'
      : null;
  const bild = frage.art === 'ware' ? frage.bild : frage.art === 'truhe' ? truhenBild(frage.truhe.grad) : paketBild;
  return (
    <HbBlatt titel={titel} label="Kauf bestätigen" onClose={onAbbrechen} klasse="is-klein">
      <div className="hb-mitte">
        {/* Ware ohne Grafik (Klang, Musik) zeigt hier nichts statt eines
            kaputten Bildes — der Name im Kopf trägt die Rückfrage. */}
        {bild && <img className={`hb-kauf-bild${frage.art === 'ware' ? ' is-ware' : ''}`} src={bild} alt="" draggable={false} />}
        {frage.art === 'truhe' && (
          <p className="hb-text">
            {frage.truhe.von} bis {frage.truhe.bis} Münzen, ausgewürfelt beim Öffnen
          </p>
        )}
        {frage.art === 'paket' && (
          <p className="hb-text">
            {frage.paket.gibt
              ? `${frage.paket.gibt.betrag} ${t(`waehrung.${frage.paket.gibt.waehrung}`)}`
              : 'Ohne Guthaben'}
          </p>
        )}
        {/* Erst hören, dann entscheiden — der Knopf steht vor der Frage. */}
        {frage.art === 'ware' && <Vorhoeren neu ware={frage.ware} />}
      </div>
      {frage.art === 'ware' ? (
        <>
          {/* Zwei Wege wie im Kleiderschrank. Gold ist der eine Hauptknopf
              (DESIGN.md) — also die Münzen: Sie kosten kein echtes Geld,
              ein versehentliches Ja tut dort am wenigsten weh. */}
          <p className="hb-klein hb-ohne-rand hb-mitte-text">Womit bezahlen?</p>
          <div className="hb-knopfreihe">
            <button
              type="button"
              className="hb-kn is-gold is-haupt"
              disabled={laeuft}
              onClick={() => onWare(frage.ware, 'coins')}
              aria-label={`${frage.ware.preis.coins} Münzen zahlen`}
            >
              <img className="hb-kn-bild" src="/hub/symbol-muenze.webp" alt="" />
              {frage.ware.preis.coins.toLocaleString('de-DE')}
            </button>
            <button
              type="button"
              className="hb-kn is-zweit is-haupt"
              disabled={laeuft}
              onClick={() => onWare(frage.ware, 'gems')}
              aria-label={`${frage.ware.preis.gems} Edelsteine zahlen`}
            >
              <img className="hb-kn-bild" src="/hub/symbol-edelstein.webp" alt="" />
              {frage.ware.preis.gems.toLocaleString('de-DE')}
            </button>
          </div>
          <button type="button" className="hb-leise-knopf" onClick={onAbbrechen}>
            Später
          </button>
        </>
      ) : (
        <>
          <p className="hb-kauf-preis">
            {muenzen !== null ? (
              <>
                <img src="/hub/symbol-muenze.webp" alt="" />
                {muenzen} {muenzen === 1 ? t('waehrung.coins.eins') : t('waehrung.coins')}
              </>
            ) : (
              <>
                <img src="/hub/symbol-edelstein.webp" alt="" />
                {gems} {gems === 1 ? t('waehrung.gems.eins') : t('waehrung.gems')}
              </>
            )}
          </p>
          <div className="hb-knopfreihe">
            <button type="button" className="hb-kn is-zweit is-haupt" onClick={onAbbrechen}>
              Später
            </button>
            <button
              type="button"
              className="hb-kn is-gold is-haupt"
              disabled={laeuft}
              onClick={() => (frage.art === 'truhe' ? onTruhe(frage.truhe) : onPaket(frage.paket))}
            >
              {laeuft ? 'Kauft…' : frage.art === 'truhe' ? 'Öffnen' : 'Kaufen'}
            </button>
          </div>
        </>
      )}
    </HbBlatt>
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
  neu = false,
}: {
  /** Neues Hub: derselbe Inhalt im neuen Rahmen. */
  neu?: boolean;
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
    <ShopRahmen coins={coins} gems={gems}>
      {/* Oben ein Tisch, den man noch nicht hat — jeden Tag ein anderer.
          Gekauft wird über dieselbe Rückfrage wie jede Ware. */}
      {(() => {
          const angebote = ware('szene').filter((w) => !w.besessen && w.preis.coins > 0);
          if (angebote.length === 0) return null;
          const tag = Math.floor(Date.now() / 86_400_000);
          const w = angebote[tag % angebote.length]!;
          const name = SZENEN.find((sz) => sz.id === w.wert)?.name ?? w.wert;
          return (
            <button
              type="button"
              className="hb-held hb-empfohlen"
              style={{ backgroundImage: `url(${szeneBild(w.wert)})` }}
              disabled={kauft !== null}
              onClick={() => setFrage({ art: 'ware', ware: w, name, bild: szeneBild(w.wert) })}
            >
              <span className="hb-held-unten hb-held-zeile">
                <span>
                  <span className="hb-label">Empfohlen · Tisch</span>
                  <strong className="hb-held-titel">{name}</strong>
                  <span>für alle Kartenspiele</span>
                </span>
                <span className="hb-kn is-gold">
                  <img src="/hub/symbol-muenze.webp" alt="" />
                  {w.preis.coins.toLocaleString('de-DE')}
                </span>
              </span>
            </button>
          );
        })()}

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

      {/* Kartenblätter und Tische: seit dem 26.09.2026 auch hier (Robin), nicht
          mehr nur in der Sammlung. Dort bleibt die große Vorschau; gekauft wird
          über denselben Aufruf (buyItem), also läuft nichts auseinander. */}
      <WareRegal
        titel="Kartenblätter"
        zusatz="Für Doppelkopf, Skat und Zauberer"
        waren={ware('blatt').filter((w) => w.preis.coins > 0)}
        bild={(w) => {
          const deck = deckById(w.wert);
          return cardImage(deck, { suit: 'H', rank: 'Q' }) ?? deckBack(deck);
        }}
        name={(w) => t(`deck.${w.wert}`)}
        kauft={kauft}
        onKaufen={(w, name, bild) => setFrage({ art: 'ware', ware: w, name, bild })}
      />
      <WareRegal
        titel="Tische"
        zusatz="Für alle Kartenspiele"
        waren={ware('szene').filter((w) => w.preis.coins > 0)}
        bild={(w) => szeneBild(w.wert)}
        name={(w) => SZENEN.find((sz) => sz.id === w.wert)?.name ?? w.wert}
        kauft={kauft}
        onKaufen={(w, name, bild) => setFrage({ art: 'ware', ware: w, name, bild })}
      />

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

      {/* Spielpakete (22.09.2026, Robins Entscheidung S3): die erste Ware mit
          Spielinhalt — Golf-Kurse und Partykiste-Themen. Gebraucht werden sie
          nur von dem, der den Tisch aufmacht; wer mitspielt, braucht nichts.
          Der Titel ist derselbe, auf den die gesperrte Kachel in der Auswahl
          verweist (SHOP_RUBRIK in inhaltspakete.ts). */}
      <WareRegal
        titel={SHOP_RUBRIK}
        zusatz="Neue Kurse und Themen"
        waren={ware('inhaltspaket')}
        bild={() => null}
        glyph="wuerfel"
        name={(w) => t(w.nameKey)}
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
          nur den Muenzstand aendert, ist eine Zahl ohne Erklaerung. An der
          Wurzel des Hubs, sonst deckte die Oeffnung nur die Seite ab
          (siehe `ImHub`). */}
      {fund && (
        <ImHub>
          <FundBlatt fund={fund} onClose={() => setFund(null)} />
        </ImHub>
      )}
    </ShopRahmen>
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
  glyph?: 'note' | 'noten' | 'wuerfel';
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
                {glyph === 'note' || glyph === 'noten' ? (
                  <Note doppelt={glyph === 'noten'} />
                ) : glyph === 'wuerfel' ? (
                  <Wuerfel />
                ) : (
                  '?'
                )}
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
 * Name eines Knopfes, an dem ein Bereitschaftspunkt haengen kann.
 *
 * Der Vorlesetext gehoert in den Namen des KNOPFES, nicht an den Punkt: Ein
 * aria-label am Punkt zaehlt nicht mit, sobald der Knopf selbst eins traegt
 * (so war die Truhe bis zum 23.09.2026 stumm), und ohne eins klebt der Name
 * aus dem Inhalt ohne Trennung zusammen (der Reiter hiess
 * "ProfilGeschenk liegt bereit"). Das Komma ist die Pause beim Vorlesen.
 */
function mitPunkt(name: string, punkt: string | null): string {
  return punkt === null ? name : `${name}, ${punkt}`;
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
function Vorhoeren({ ware, neu = false }: { ware: RegalWare; neu?: boolean }): React.JSX.Element | null {
  const laeuftProbe = useSyncExternalStore(abonniere, laufendeProbe, laufendeProbe);
  useEffect(() => () => probeMusik(null), []);

  if (ware.art !== 'klang' && ware.art !== 'musik') return null;
  const istMusik = ware.art === 'musik';
  const an = istMusik && laeuftProbe === ware.wert;

  return (
    <button
      type="button"
      className={neu ? 'hb-kn is-zweit' : 'hub-knopf hub-knopf--a ks-kauf-hoeren'}
      onClick={() => (istMusik ? probeMusik(ware.wert) : probePaket(ware.wert))}
    >
      {an ? '■ Stopp' : '▶ Anhören'}
    </button>
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
  neu = false,
}: {
  meId: string;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
  /** Neues Hub: Blatt von unten mit Chips statt Reitern, dieselben Abrufe. */
  neu?: boolean;
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

  if (neu) {
    return (
      <HbBlatt titel="Rangliste" label={`Rangliste ${titel}`} onClose={onClose}>
        {spiele.length > 1 && (
          <div className="hb-chips hb-chips--blatt" role="tablist" aria-label="Wertung wählen">
            {[{ id: 'gesamt', name: 'Gesamt' }, ...spiele.map((g) => ({ id: g.id, name: t(g.nameKey) }))].map((r) => (
              <button
                type="button"
                key={r.id}
                role="tab"
                aria-selected={wahl === r.id}
                className={`hb-chip${wahl === r.id ? ' is-an' : ''}`}
                onClick={() => setWahl(r.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
        {error && <p className="hb-fehler">{error}</p>}
        {!error && laedt && <p className="hb-laden">Wird geladen…</p>}
        {!error && !laedt && rows.length === 0 && <p className="hb-klein hb-ohne-rand">Noch niemand auf der Liste.</p>}
        {!laedt && rows.length > 0 && (
          <ol className="hb-liste hb-rangliste">
            {rows.map((row) => (
              <li key={row.accountId} className={`hb-rl${row.accountId === meId ? ' is-du' : ''}`}>
                <span className="hb-rl-rang">{row.rank}</span>
                <button
                  type="button"
                  className="hb-rl-name"
                  onClick={() => {
                    onClose();
                    onShowProfile(row.accountId);
                  }}
                >
                  {row.displayName}
                  {row.accountId === meId ? ' · du' : ''}
                </button>
                <span className="hb-pk">
                  <img src="/hub/symbol-pokal.webp" alt="" />
                  {row.trophies.toLocaleString('de-DE')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </HbBlatt>
    );
  }

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
 * Freundesliste im Profil-Tab.
 *
 * Anfragen stehen zuoberst, weil sie eine Antwort verlangen. Die Suche
 * arbeitet erst ab zwei Zeichen und auf Knopfdruck - niemand soll beim
 * Tippen live durchsucht werden.
 */
function Freunde({
  onShowProfile,
  neu = false,
}: {
  onShowProfile: (accountId: string) => void;
  /** Neues Hub: Abschnitt mit Liste statt Holztafel, dieselben Aufrufe. */
  neu?: boolean;
}): React.JSX.Element {
  const [lists, setLists] = useState<FriendLists | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerRef[] | null>(null);
  /*
    Bis zum 22.10.2026 schluckte die Liste jeden Fehler: Ging `/friends`
    schief, stand für immer „Wird geladen…", und ein Tipp auf Annehmen,
    Suchen oder Anfragen tat ohne Netz einfach nichts. Jetzt steht da, was
    nicht ging (CLAUDE.md: „Am Tisch nichts stumm verwerfen").
  */
  const [fehler, setFehler] = useState<string | null>(null);
  const fang = (err: unknown): void =>
    setFehler(err instanceof ApiError ? t(err.messageKey) : 'Das hat nicht geklappt. Prüf die Verbindung.');

  const reload = (): void => {
    void api
      .friends()
      .then((l) => {
        setLists(l);
        setFehler(null);
      })
      .catch(fang);
  };
  useEffect(reload, []);

  const search = (event: React.FormEvent): void => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setFehler(null);
    void api.searchPlayers(query).then(setResults).catch(fang);
  };

  const anzahl = lists ? lists.friends.length : 0;

  const anfragen = (player: PlayerRef): void =>
    void api
      .requestFriend(player.id)
      .then(() => {
        setResults((alt) => (alt ?? []).filter((entry) => entry.id !== player.id));
        reload();
      })
      .catch(fang);

  if (neu) {
    /* Die ganze Zeile ist der Weg zum Profil, nicht nur der Name: Vorher
       traf ein Tipp auf den Pfeil oder die freie Fläche daneben nichts. */
    const zeile = (player: PlayerRef, rechts?: React.ReactNode): React.JSX.Element =>
      rechts === undefined ? (
        <button type="button" className="hb-mg hb-mg-ganz" key={player.id} onClick={() => onShowProfile(player.id)}>
          <span className="hb-mg-name">
            <strong>{player.displayName}</strong>
          </span>
          <span className="hb-pf" aria-hidden="true">›</span>
        </button>
      ) : (
        <div className="hb-mg" key={player.id}>
          <button type="button" className="hb-mg-name hb-mg-knopf" onClick={() => onShowProfile(player.id)}>
            <strong>{player.displayName}</strong>
          </button>
          {rechts}
        </div>
      );
    return (
      <section className="hb-blk">
        <h2 className="hb-ab">
          Freunde
          <span className="hb-ab-zusatz">{lists ? anzahl : '…'}</span>
        </h2>
        {/* Anfragen zuoberst: sie verlangen eine Antwort. */}
        {(lists === null || lists.incoming.length > 0 || lists.friends.length > 0) && (
          <div className="hb-liste">
            {lists === null && (
              <p className="hb-klein hb-liste-leer">{fehler ? 'Freunde ließen sich nicht laden.' : 'Wird geladen…'}</p>
            )}
            {lists?.incoming.map((player) =>
              zeile(
                player,
                <span className="hb-mg-knoepfe">
                  <button type="button" className="hb-kn is-gold is-klein" onClick={() => void api.acceptFriend(player.id).then(reload).catch(fang)}>
                    Annehmen
                  </button>
                  <button type="button" className="hb-kn is-zweit is-klein" onClick={() => void api.removeFriend(player.id).then(reload).catch(fang)}>
                    Nein
                  </button>
                </span>,
              ),
            )}
            {lists?.friends.map((player) => zeile(player))}
          </div>
        )}
        {fehler && (
          <span className="hb-fehler">
            {fehler}{' '}
            {lists === null && (
              <button type="button" className="hb-link" onClick={reload}>
                Nochmal
              </button>
            )}
          </span>
        )}
        {lists !== null && lists.friends.length === 0 && lists.incoming.length === 0 && (
          <p className="hb-klein hb-ohne-rand">Noch keine Freunde. Such unten nach einem Namen.</p>
        )}
        {lists !== null && lists.outgoing.length > 0 && (
          <p className="hb-klein hb-ohne-rand">
            Angefragt: {lists.outgoing.map((player) => player.displayName).join(', ')}
          </p>
        )}
        <form className="hb-suchzeile" onSubmit={search}>
          <input
            className="hb-feld"
            placeholder="Spieler suchen…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Spieler suchen"
          />
          <button className="hb-kn is-zweit" type="submit" disabled={query.trim().length < 2}>
            Suchen
          </button>
        </form>
        {results !== null && results.length === 0 && (
          <p className="hb-klein hb-ohne-rand">Niemand mit diesem Namen gefunden.</p>
        )}
        {results !== null && results.length > 0 && (
          <div className="hb-liste">
            {results.map((player) =>
              zeile(
                player,
                <button type="button" className="hb-kn is-zweit is-klein" onClick={() => anfragen(player)}>
                  Anfragen
                </button>,
              ),
            )}
          </div>
        )}
      </section>
    );
  }

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
  neu = false,
}: {
  /** Neues Hub: dieselbe Auswahl mit denselben Käufen, in Nachtblau & Gold. */
  neu?: boolean;
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
  const [frage, rueckfrage] = useRueckfrage();
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

  /**
   * Ein Tipp auf Blatt, Rückseite oder Tisch.
   *
   * Was mir gehört, wird sofort eingestellt. Was nicht, wird nach der
   * Rückfrage gekauft — und danach eingestellt, denn genau das war die Absicht
   * des Tipps. Eine Stelle für altes und neues Hub, damit die beiden nicht
   * unterschiedlich kaufen.
   */
  const waehle = (art: RegalWare['art'], id: string, name: string, setzen: () => void): void => {
    if (gehoert(art, id)) {
      setzen();
      return;
    }
    const w = wareZu(art, id);
    if (!w) return;
    // Erspielt, nicht gekauft (Kartenruecken der Manufaktur): kein Kaufangebot.
    if (w.nurErspielt) {
      setKaufFehler(t('error.itemNurErspielt'));
      return;
    }
    // Im neuen Hub die eigene Rückfrage statt des grauen iOS-Dialogs.
    if (neu) {
      frage(
        { titel: `„${name}“ kaufen?`, text: `Kostet ${w.preis.coins.toLocaleString('de-DE')} Münzen.`, ja: `Für ${w.preis.coins.toLocaleString('de-DE')} Münzen kaufen` },
        () => kaufen(w, setzen),
      );
      return;
    }
    if (!window.confirm(`„${name}" für ${w.preis.coins} Münzen kaufen?`)) return;
    kaufen(w, setzen);
  };
  const waehleBlatt = (deck: Deck): void =>
    waehle('blatt', deck.id, t(deck.nameKey), () => {
      onChange(deck.id);
      setVorschau(true);
    });
  const waehleRuecken = (r: (typeof RUECKEN)[number]): void =>
    waehle('ruecken', r.id, r.name, () => onRueckenChange(r.id));
  const waehleSzene = (s: (typeof SZENEN)[number]): void =>
    waehle('szene', s.id, s.name, () => {
      onSzeneChange(s.id);
      setVorschau(true);
    });

  if (neu) {
    /** Unterzeile einer Kachel: aktiv, gehört dir oder der Preis. */
    const stand = (art: RegalWare['art'], id: string, aktiv: boolean): string => {
      if (!gehoert(art, id)) {
        const w = wareZu(art, id);
        if (w?.nurErspielt) return 'In der Kartenmanufaktur erspielen';
        return `${(w?.preis.coins ?? 0).toLocaleString('de-DE')} Münzen`;
      }
      return aktiv ? 'aktiv' : 'gehört dir';
    };
    const marke = (aktiv: boolean, mein: boolean): React.JSX.Element | null =>
      aktiv && mein ? (
        <span className="hb-ding-ok" aria-hidden="true">
          ✓
        </span>
      ) : !mein ? (
        <span className="hb-ding-schloss" aria-hidden="true">
          <HbSymbol>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </HbSymbol>
        </span>
      ) : null;
    return (
      <div className="hb-spiele hb-details">
        <header className="hb-kopfzeile is-zurueck">
          <Zurueck onClick={onSpielWechseln} label="Zurück zur Sammlung" />
          {/* Welches Spiel gerade eingestellt wird, muss dabeistehen. */}
          <span className="hb-kopf-titel">
            <h1 className="hb-titel">{spielName}</h1>
            <small>Blatt, Rückseite und Tisch · gilt auf allen Geräten</small>
          </span>
        </header>
        <div className="hb-spiele-rolle">
          {kaufFehler && <p className="hb-fehler">{kaufFehler}</p>}

          <section className="hb-blk">
            <h2 className="hb-ab">
              Kartenblatt
              <span className="hb-ab-zusatz">Antippen zeigt den Tisch</span>
            </h2>
            {/* Nur Blätter, die zu diesem Spiel passen: Ein Zauberblatt hat
                keine Dame, ein Doppelkopfblatt keine Sieben. */}
            <div className="hb-raster">
              {decksFor(gameId).map((deck) => {
                const mein = gehoert('blatt', deck.id);
                const aktiv = deck.id === current;
                return (
                  <button
                    type="button"
                    key={deck.id}
                    className={`hb-wahl${aktiv ? ' is-aktiv' : ''}${mein ? '' : ' is-zu'}`}
                    aria-pressed={aktiv}
                    disabled={kauft === wareZu('blatt', deck.id)?.id}
                    onClick={() => waehleBlatt(deck)}
                  >
                    <span className="hb-wahl-bild is-blatt">
                      <span className="hb-wahl-karten">
                        {proben.map((card) => (
                          <DeckSample card={card} deck={deck} key={card.id} />
                        ))}
                      </span>
                      {marke(aktiv, mein)}
                    </span>
                    <strong>{t(deck.nameKey)}</strong>
                    <small>{stand('blatt', deck.id, aktiv)}</small>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Die Rückseite ist das, was die anderen sehen — deshalb steht sie
              beim Blatt und nicht beim Tisch. */}
          <section className="hb-blk">
            <h2 className="hb-ab">
              Rückseite
              <span className="hb-ab-zusatz">Was die anderen sehen</span>
            </h2>
            <div className="hb-reihe">
              {RUECKEN.map((r) => {
                const mein = gehoert('ruecken', r.id);
                const aktiv = r.id === ruecken;
                return (
                  <button
                    type="button"
                    key={r.id}
                    className={`hb-ding${aktiv ? ' is-aktiv' : ''}${mein ? '' : ' is-zu'}`}
                    aria-pressed={aktiv}
                    disabled={kauft === wareZu('ruecken', r.id)?.id}
                    onClick={() => waehleRuecken(r)}
                  >
                    <span
                      className="hb-ding-bild is-ruecken"
                      style={{
                        backgroundImage: `url(${rueckenBild(r.id) ?? deckBack(deckById(current)) ?? '/hub/tab-blatt.webp'})`,
                      }}
                    >
                      {marke(aktiv, mein)}
                    </span>
                    <strong>{r.name}</strong>
                    <small>{stand('ruecken', r.id, aktiv)}</small>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Der Tisch zeigt echte Karten: Auf einem zu dunklen Untergrund
              verschwinden Kreuz und Pik, das soll man vorher sehen. */}
          <section className="hb-blk">
            <h2 className="hb-ab">
              Tisch
              <span className="hb-ab-zusatz">Nur du siehst ihn</span>
            </h2>
            <div className="hb-raster">
              {SZENEN.map((s) => {
                const mein = gehoert('szene', s.id);
                const aktiv = s.id === szene;
                return (
                  <button
                    type="button"
                    key={s.id}
                    className={`hb-wahl${aktiv ? ' is-aktiv' : ''}${mein ? '' : ' is-zu'}`}
                    aria-pressed={aktiv}
                    disabled={kauft === wareZu('szene', s.id)?.id}
                    onClick={() => waehleSzene(s)}
                  >
                    <span className="hb-wahl-bild" style={{ backgroundImage: `url(${szeneBild(s.id)})` }}>
                      <span className="hb-wahl-karten is-tisch">
                        {proben.slice(0, 2).map((card) => (
                          <DeckSample card={card} deck={deckById(current)} key={card.id} />
                        ))}
                      </span>
                      {marke(aktiv, mein)}
                    </span>
                    <strong>{s.name}</strong>
                    <small>{mein ? s.hinweis : stand('szene', s.id, aktiv)}</small>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {vorschau && (
          <TischVorschau
            neu
            gameId={gameId}
            spielName={spielName}
            deck={deckById(current)}
            szene={szene}
            onClose={() => setVorschau(false)}
          />
        )}
        {rueckfrage}
      </div>
    );
  }

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
                onClick={() => waehleBlatt(deck)}
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
                onClick={() => waehleRuecken(r)}
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
                onClick={() => waehleSzene(s)}
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
  neu = false,
}: {
  gameId: string;
  spielName: string;
  deck: Deck;
  szene: string;
  onClose: () => void;
  /** Neues Hub: über den ganzen Bildschirm, mit Schließen-Knopf und Escape. */
  neu?: boolean;
}): React.JSX.Element {
  const hand = handFuer(gameId);
  const stich = hand.slice(0, 3);
  const szeneName = SZENEN.find((s) => s.id === szene)?.name ?? szene;

  if (neu) return <TischVorschauNeu hand={hand} stich={stich} deck={deck} szene={szene} szeneName={szeneName} spielName={spielName} onClose={onClose} />;

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

/**
 * Die große Vorschau im neuen Hub: dieselben drei Dinge wie oben (Untergrund,
 * Stich, eigene Hand) in Tischgröße, aber über den ganzen Bildschirm — dort
 * sitzt man am Ende auch. Der Kopf liegt auf einer Abdeckung mit mindestens
 * 0,85 Deckkraft (DESIGN.md), weil unter ihm jeder Tisch liegen kann.
 */
function TischVorschauNeu({
  hand,
  stich,
  deck,
  szene,
  szeneName,
  spielName,
  onClose,
}: {
  hand: { id: number; suit: string; rank: string }[];
  stich: { id: number; suit: string; rank: string }[];
  deck: Deck;
  szene: string;
  szeneName: string;
  spielName: string;
  onClose: () => void;
}): React.JSX.Element {
  useEscape(onClose);
  return (
    <ImHub>
      <div className="hb-vorschau" role="dialog" aria-modal="true" aria-label={`Vorschau: ${t(deck.nameKey)} · ${szeneName}`}>
        <img className="hb-vorschau-bg" src={szeneBild(szene)} alt="" draggable={false} />
        <header className="hb-vorschau-kopf">
          <span className="hb-vorschau-titel">
            <span className="hb-label">So sieht dein {spielName}-Tisch aus</span>
            <strong>
              {t(deck.nameKey)} · {szeneName}
            </strong>
          </span>
          <Schliessen onClick={onClose} />
        </header>
        <div className="hb-vorschau-tisch">
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
        </div>
        {/* Die Wahl gilt schon; „Passt" bestätigt nichts, es schließt nur. */}
        <div className="hb-vorschau-fuss">
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onClose}>
            Passt
          </button>
        </div>
      </div>
    </ImHub>
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

  const src = me.avatarUrl ? `${serverAdresse(me.avatarUrl)}?v=${ver}` : null;

  /*
   * In der App nur anzeigen, nicht hochladen — bis es eine Moderation gibt.
   * Ein eigenes Foto ist Nutzerinhalt, den alle am Tisch sehen, und Apple
   * verlangt dafuer (1.2) eine Pruefung, die es noch nicht gibt. Wer auf der
   * Webseite ein Bild gesetzt hat, sieht es hier trotzdem.
   */
  if (inApp) {
    return (
      <span className="hub-profilbild">
        {src ? (
          <img src={src} alt="Profilbild" draggable={false} />
        ) : (
          <Pinguin getragen={me.avatar} groesse={3.2} titel="Profilbild" />
        )}
      </span>
    );
  }

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



/**
 * Rahmen des Shops: im alten Hub die gemalte Szene mit Logo-Schild, im neuen
 * Überschrift und Guthaben. Der Inhalt (Tafeln, Kaufrückfrage, Fundblatt) ist
 * in beiden derselbe — so geht kein Kaufweg verloren.
 */
function ShopRahmen({
  neu,
  coins,
  gems,
  children,
}: {
  neu: boolean;
  coins: number;
  gems: number;
  children: React.ReactNode;
}): React.JSX.Element {
  if (!neu) {
    return (
      <HubSzene bg="/hub/bg-shop.webp" className="front-shop front-shop--b">
        <HubBanner />
        {children}
      </HubSzene>
    );
  }
  return (
    <div className="hb-shop">
      <header className="hb-kopfzeile">
        <h1 className="hb-titel">Shop</h1>
        <span className="hb-geld">
          <span className="hb-pill" aria-label={`${coins} Münzen`}>
            <img src="/hub/symbol-muenze.webp" alt="" />
            {coins.toLocaleString('de-DE')}
          </span>
          <span className="hb-pill" aria-label={`${gems} Edelsteine`}>
            <img src="/hub/symbol-edelstein.webp" alt="" />
            {gems.toLocaleString('de-DE')}
          </span>
        </span>
      </header>
      <div className="hb-shop-rolle">{children}</div>
    </div>
  );
}
