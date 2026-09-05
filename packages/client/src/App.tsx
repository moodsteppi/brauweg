import { Suspense, lazy, useEffect, useState } from 'react';

import { api, type Me } from './api';
import { t } from './i18n';
import { Ladebildschirm } from './Ladebildschirm';
import { Ladekreis } from './Ladekreis';
import { musikAn } from './klang';
import { deckForGame, deckMitRuecken } from './decks';
import { TISCH_PARAMETER, tafelrundePaket } from './minispiele/tafelrunde/paket';
import { useVorladen } from './minispiele/tafelrunde/vorladen';
import { Auth } from './screens/Auth';
import { GameSelect } from './screens/GameSelect';
import { Lobby } from './screens/Lobby';

/**
 * Jeder Spielbildschirm ist ein eigenes Stueck und kommt erst, wenn er
 * gebraucht wird.
 *
 * Der Anlass ist gemessen (05.09.2026, `npm run build`): Das Hauptbuendel wog
 * 1.952 kB (574 kB gzip), weil hier ELF Spielbildschirme statisch standen —
 * und ueber `FeldherrTisch` haengte `three` mit drin. Wer Tafelrunde antippte,
 * lud vorher zehn andere Spiele und eine 3D-Bibliothek herunter, und zwar
 * BEVOR ueberhaupt etwas gezeichnet werden konnte. Deshalb sah Robin den
 * Ladebildschirm nie: Zum Zeitpunkt des Wartens gab es ihn noch nicht.
 *
 * Drei bleiben absichtlich hier: `Auth`, `GameSelect` und `Lobby`. Sie sind
 * das, was jeder Spieler in jeder Sitzung als Erstes sieht — sie nachzuladen
 * hiesse, die Wartezeit nur zu verschieben.
 *
 * Der Rueckfall waehrend des Ladens ist KEIN Ladekreis, sondern der
 * `Ladebildschirm` mit dem Namen des Spiels und dem Satz „Dateien werden
 * heruntergeladen" — Robins Wortlaut. Siehe `Vorhang` weiter unten.
 */
const EasyPoker = lazy(() => import('./screens/EasyPoker').then((m) => ({ default: m.EasyPoker })));
const FeldherrTisch = lazy(() =>
  import('./screens/FeldherrTisch').then((m) => ({ default: m.FeldherrTisch })),
);
const Eiland = lazy(() => import('./screens/Eiland').then((m) => ({ default: m.Eiland })));
const Filler = lazy(() => import('./screens/Filler').then((m) => ({ default: m.Filler })));
const Mememory = lazy(() => import('./screens/Mememory').then((m) => ({ default: m.Mememory })));
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })));
const Table = lazy(() => import('./screens/Table').then((m) => ({ default: m.Table })));
const CambioTable = lazy(() =>
  import('./screens/CambioTable').then((m) => ({ default: m.CambioTable })),
);
const SkatTable = lazy(() => import('./screens/SkatTable').then((m) => ({ default: m.SkatTable })));
const WizardTable = lazy(() =>
  import('./screens/WizardTable').then((m) => ({ default: m.WizardTable })),
);
/* Ueber `tafelrundePaket` und nicht ueber ein eigenes `import(…)`: Dasselbe
   Stueck steht auch als Posten im Ladebalken (vorladen.ts). Zwei Schreibweisen
   desselben Pfades gingen beim naechsten Verschieben auseinander. */
const Tafelrunde = lazy(() => tafelrundePaket().then((m) => ({ default: m.Tafelrunde })));
const Runner = lazy(() => import('./screens/Runner').then((m) => ({ default: m.Runner })));

/**
 * Der Vorhang, waehrend ein Spielpaket ueber die Leitung kommt.
 *
 * Ein eigenes Bauteil und keine zehn `<Suspense fallback={…}>`: Der Rueckfall
 * ist bei jedem Spiel derselbe, nur der Name wechselt.
 */
function Vorhang({
  titel,
  onAbbrechen,
  children,
}: {
  titel: string;
  onAbbrechen: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Suspense fallback={<Ladebildschirm titel={titel} onAbbrechen={onAbbrechen} />}>
      {children}
    </Suspense>
  );
}

/**
 * Der Name eines Spiels fuer den Vorhang.
 *
 * `t()` gibt bei einem unbekannten Schluessel den Schluessel zurueck — das
 * waere hier die Zeichenkette „game.irgendwas" in Riesenschrift. Der Fall ist
 * nicht erfunden: Der Server liefert die Spieleliste, und ein Spiel, das
 * dieser Client noch nicht kennt, kommt frueher oder spaeter durch.
 */
function spielName(gameId: string): string {
  const name = t(`game.${gameId}`);
  return name === `game.${gameId}` ? 'Spiel' : name;
}

/**
 * Derselbe Vorhang fuer Tafelrunde — mit einem Balken, der schon zaehlt.
 *
 * `useVorladen` steht HIER und nicht erst im Bildschirm, und das ist der
 * eigentliche Punkt der Aenderung: Der Lauf fuehrt seit dem 06.09.2026 das
 * Spielpaket als ersten Posten (vorladen.ts). Ihn hier anzustossen heisst
 * also, den Balken zu starten, BEVOR das Paket da ist — sonst faengt er erst
 * an, wenn das Warten schon vorbei ist.
 *
 * Der Bildschirm ruft `useVorladen` danach ein zweites Mal auf und haelt die
 * Ruestkammer zurueck, bis auch die Bilder durch sind. Das ist derselbe Lauf
 * (modulweit, siehe dort) und deshalb derselbe Balken: Er laeuft ueber den
 * Wechsel vom Vorhang zum Bildschirm einfach weiter.
 */
function TafelrundeVorhang({
  onAbbrechen,
  children,
}: {
  onAbbrechen: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const vorrat = useVorladen();
  return (
    <Suspense
      fallback={<Ladebildschirm titel="Tafelrunde" stand={vorrat} onAbbrechen={onAbbrechen} />}
    >
      {children}
    </Suspense>
  );
}

type Screen =
  | { name: 'games' }
  /** Minispiel: laeuft im Browser, kein Tisch, kein Spielmodul. */
  | { name: 'feldherr' }
  /**
   * Mememory bringt sein eigenes Hauptmenue mit und haelt den Tisch selbst.
   * `tisch` ist nur der Einstieg aus dem "Weiterspielen" des Hubs — den
   * Wechsel waehrend der Match-Suche macht der Bildschirm intern, weil ein
   * Umweg ueber diesen Zustand jedes Mal die Verbindung neu aufbaute.
   */
  | { name: 'mememory'; tisch?: string | null }
  /**
   * Easy Poker bringt wie Mememory sein eigenes Hauptmenue mit: Sofort
   * gegen den Computer oder Match-Suche, beides ohne Kartenlobby.
   */
  | { name: 'easypoker'; tisch?: string | null }
  /**
   * Filler bringt wie Mememory sein eigenes Hauptmenue mit: Match-Suche und
   * Brett auf einem Bildschirm, ohne Kartenlobby.
   */
  | { name: 'filler'; tisch?: string | null }
  /**
   * Eiland macht es wie Filler: eigenes Hauptmenue, Match-Suche und Karte auf
   * einem Bildschirm, keine Kartenlobby.
   */
  | { name: 'eiland'; tisch?: string | null }
  /**
   * Tafelrunde ebenso: eigenes Hauptmenue, eigene Match-Suche, Ruestkammer
   * auf einem Bildschirm. Es ist kein Kartenspiel und braucht keine
   * Kartenlobby.
   */
  | { name: 'tafelrunde'; tisch?: string | null }
  | { name: 'lobby'; gameId: string }
  | { name: 'table'; gameId: string; tableId: string }
  /** Solo-Endless-Runner aus der Spielauswahl. */
  | { name: 'prosubway' }
  /**
   * `vorher` merkt sich den Absprungpunkt: Wer vom Spieltisch aus ein Profil
   * oeffnet, muss an den Tisch zurueck - nicht auf die Startseite. Die
   * WebSocket-Verbindung des Tisches wird dabei getrennt und beim Zurueck neu
   * aufgebaut; der Server schickt ohnehin immer die volle Sicht.
   */
  | { name: 'profil'; accountId: string; vorher: Screen };

export function App(): React.JSX.Element {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * `/?tisch=KX7M9Q` fuehrt direkt zu Tafelrunde.
   *
   * Der Link, den ein Gastgeber weitergibt, landet sonst auf der Startseite,
   * und der Eingeladene muesste den Code aus der Adresszeile abschreiben.
   * Beigetreten wird nicht von selbst — der Bildschirm oeffnet nur die
   * Beitreten-Ansicht mit ausgefuelltem Code (siehe TISCH_PARAMETER).
   */
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(window.location.search).get(TISCH_PARAMETER)
      ? { name: 'tafelrunde' }
      : { name: 'games' },
  );

  const reload = async (): Promise<void> => {
    setMe(await api.me().catch(() => null));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  /**
   * Musik laeuft, solange jemand angemeldet ist.
   *
   * An genau einer Stelle statt in jedem Bildschirm: Welches Stueck spielt,
   * steht ohnehin in den Einstellungen, und ein An-Aus je Bildschirm haette
   * beim Wechsel Hub -> Tisch -> Hub jedes Mal neu angefangen. Vor der
   * Anmeldung bleibt es still — wer noch tippt, wer er ist, will keine Musik.
   */
  useEffect(() => {
    musikAn(me !== null);
    return () => musikAn(false);
  }, [me !== null]);

  if (loading) {
    return (
      <main className="app-laden">
        <Ladekreis bild="/hub/lade-pinguin.webp" text="Einen Moment…" />
      </main>
    );
  }

  if (!me) return <Auth onSignedIn={() => void reload()} />;

  /**
   * Aussehen eines Spiels. Der Server liefert alle bekannten Spiele mit;
   * die Rueckfallwerte greifen nur, falls ein Spiel dazukommt, das dieser
   * Client noch nicht kennt.
   */
  const themeFuer = (
    gameId: string,
  ): { cardDeck: string; tableScene: string; cardBack: string } =>
    me.themes[gameId] ?? { cardDeck: 'text', tableScene: 'stube', cardBack: 'standard' };

  const zeigeProfil = (accountId: string): void =>
    setScreen({ name: 'profil', accountId, vorher: screen });

  /**
   * Zurueck auf den Startbildschirm — mit frischem `me`.
   *
   * Das `reload()` ist der Grund fuer diese Zeile: Ohne es zeigt
   * „Weiterspielen" den Stand von vorhin (Wartetisch weg / Partie noch offen).
   * Die Fassung stand vor dem Nachladen dreizehnmal woertlich im Code; seit
   * die Bildschirme in einem `Vorhang` stecken, braucht sie jeder von ihnen
   * zweimal — einmal fuer das Spiel und einmal fuer den Abbruch waehrend des
   * Ladens.
   */
  const zurueckZumHub = (): void => {
    setScreen({ name: 'games' });
    void reload();
  };

  if (screen.name === 'profil') {
    const zurueck = (): void => setScreen(screen.vorher);
    return (
      <Vorhang titel="Profil" onAbbrechen={zurueck}>
        <Profile accountId={screen.accountId} onBack={zurueck} />
      </Vorhang>
    );
  }

  if (screen.name === 'prosubway') {
    return (
      <Vorhang titel={t('modus.prosubway')} onAbbrechen={zurueckZumHub}>
        <Runner hubMode onBack={zurueckZumHub} />
      </Vorhang>
    );
  }

  /**
   * Feldherr laeuft nicht am Kartentisch.
   *
   * Es ist ein Echtzeitspiel: Der Kern zeichnet selbst, und die Partie
   * rechnen beide Geraete im Gleichschritt. Ein Kartentisch mit Blatt,
   * Stichanzeige und Zugtimer waere hier nur im Weg.
   */
  if (screen.name === 'table' && screen.gameId === 'feldherr') {
    const zurueck = (): void => setScreen({ name: 'lobby', gameId: screen.gameId });
    return (
      <Vorhang titel={spielName('feldherr')} onAbbrechen={zurueck}>
        <FeldherrTisch tableId={screen.tableId} onBack={zurueck} />
      </Vorhang>
    );
  }
  if (screen.name === 'lobby' && screen.gameId === 'feldherr') {
    const zurueck = (): void => setScreen({ name: 'games' });
    return (
      <Vorhang titel={spielName('feldherr')} onAbbrechen={zurueck}>
        <FeldherrTisch
          onBack={zurueck}
          onEnter={(tableId) => setScreen({ name: 'table', gameId: 'feldherr', tableId })}
        />
      </Vorhang>
    );
  }

  /**
   * Mememory laeuft ebenfalls nicht am Kartentisch: Es bringt sein eigenes
   * Hauptmenue samt Match-Suche mit und haelt den Tisch selbst. Deshalb
   * fuehren alle drei Wege — Spielauswahl, Lobby, Weiterspielen — auf
   * denselben Bildschirm.
   */
  if (screen.name === 'mememory') {
    return (
      <Vorhang titel={spielName('mememory')} onAbbrechen={zurueckZumHub}>
        <Mememory
          startTisch={screen.tisch ?? null}
          istAufsicht={me.entitlements.staff}
          onBack={zurueckZumHub}
        />
      </Vorhang>
    );
  }
  if (
    (screen.name === 'table' || screen.name === 'lobby') &&
    screen.gameId === 'mememory'
  ) {
    return (
      <Vorhang titel={spielName('mememory')} onAbbrechen={zurueckZumHub}>
        <Mememory
          startTisch={screen.name === 'table' ? screen.tableId : null}
          istAufsicht={me.entitlements.staff}
          onBack={zurueckZumHub}
        />
      </Vorhang>
    );
  }

  /**
   * Easy Poker laeuft ebenfalls nicht am Kartentisch: Vier Schaltflaechen,
   * zwei Sitze, ein eigener Filz. Alle drei Wege — Spielauswahl, Lobby,
   * Weiterspielen — fuehren auf denselben Bildschirm.
   */
  if (screen.name === 'easypoker') {
    return (
      <Vorhang titel={spielName('easypoker')} onAbbrechen={zurueckZumHub}>
        <EasyPoker startTisch={screen.tisch ?? null} onBack={zurueckZumHub} />
      </Vorhang>
    );
  }
  if (
    (screen.name === 'table' || screen.name === 'lobby') &&
    screen.gameId === 'easypoker'
  ) {
    return (
      <Vorhang titel={spielName('easypoker')} onAbbrechen={zurueckZumHub}>
        <EasyPoker
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={zurueckZumHub}
        />
      </Vorhang>
    );
  }

  /**
   * Filler laeuft ebenfalls nicht am Kartentisch: Ein Raster, sechs Farben,
   * zwei Sitze. Alle drei Wege — Spielauswahl, Lobby, Weiterspielen — fuehren
   * auf denselben Bildschirm.
   */
  if (screen.name === 'filler') {
    return (
      <Vorhang titel={spielName('filler')} onAbbrechen={zurueckZumHub}>
        <Filler startTisch={screen.tisch ?? null} onBack={zurueckZumHub} />
      </Vorhang>
    );
  }
  if (
    (screen.name === 'table' || screen.name === 'lobby') &&
    screen.gameId === 'filler'
  ) {
    return (
      <Vorhang titel={spielName('filler')} onAbbrechen={zurueckZumHub}>
        <Filler
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={zurueckZumHub}
        />
      </Vorhang>
    );
  }

  /**
   * Eiland: eine Karte, zwei Sitze, gleichzeitige Zuege. Wie bei Filler fuehren
   * alle drei Wege — Spielauswahl, Lobby, Weiterspielen — auf denselben
   * Bildschirm.
   */
  if (screen.name === 'eiland') {
    return (
      <Vorhang titel={spielName('eiland')} onAbbrechen={zurueckZumHub}>
        <Eiland startTisch={screen.tisch ?? null} onBack={zurueckZumHub} />
      </Vorhang>
    );
  }
  if (
    (screen.name === 'table' || screen.name === 'lobby') &&
    screen.gameId === 'eiland'
  ) {
    return (
      <Vorhang titel={spielName('eiland')} onAbbrechen={zurueckZumHub}>
        <Eiland
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={zurueckZumHub}
        />
      </Vorhang>
    );
  }

  /**
   * Tafelrunde: Auto-Battler mit Verschmelzen. Wie bei Filler und Eiland
   * fuehren alle drei Wege — Spielauswahl, Lobby, Weiterspielen — auf
   * denselben Bildschirm.
   */
  if (screen.name === 'tafelrunde') {
    return (
      <TafelrundeVorhang onAbbrechen={zurueckZumHub}>
        <Tafelrunde startTisch={screen.tisch ?? null} onBack={zurueckZumHub} />
      </TafelrundeVorhang>
    );
  }
  if (
    (screen.name === 'table' || screen.name === 'lobby') &&
    screen.gameId === 'tafelrunde'
  ) {
    return (
      <TafelrundeVorhang onAbbrechen={zurueckZumHub}>
        <Tafelrunde
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={zurueckZumHub}
        />
      </TafelrundeVorhang>
    );
  }

  if (screen.name === 'table') {
    /**
     * Jedes Spiel hat seinen eigenen Tisch: Der Doppelkopftisch kennt
     * Vorbehalte und Ansagen, der Zaubertisch Gebote und Trumpfwahl. Die
     * gemeinsamen Bausteine liegen in `src/tisch/` — verzweigt wird genau
     * hier, an einer einzigen Stelle.
     */
    const TISCHE: Record<string, typeof Table> = {
      wizard: WizardTable as unknown as typeof Table,
      cambio: CambioTable as unknown as typeof Table,
      skat: SkatTable as unknown as typeof Table,
    };
    const Spieltisch = TISCHE[screen.gameId] ?? Table;
    return (
      <Vorhang titel={spielName(screen.gameId)} onAbbrechen={zurueckZumHub}>
        <Spieltisch
          tableId={screen.tableId}
          /* Blatt und Rueckseite sind zwei Einstellungen, aber ein Objekt:
             So bleiben alle Stellen, die eine Kartenrueckseite zeichnen,
             unveraendert. */
          deck={deckMitRuecken(
            deckForGame(screen.gameId, themeFuer(screen.gameId).cardDeck),
            themeFuer(screen.gameId).cardBack,
          )}
          szene={themeFuer(screen.gameId).tableScene}
          onShowProfile={zeigeProfil}
          // Zurueck zum Start: me neu laden, damit „Weiterspielen" den
          // echten Stand zeigt (Wartetisch weg / Partie noch offen).
          onLeave={zurueckZumHub}
        />
      </Vorhang>
    );
  }

  if (screen.name === 'feldherr') {
    const zurueck = (): void => setScreen({ name: 'games' });
    return (
      <Vorhang titel={spielName('feldherr')} onAbbrechen={zurueck}>
        <FeldherrTisch
          onBack={zurueck}
          onEnter={(tableId) => setScreen({ name: 'table', gameId: 'feldherr', tableId })}
        />
      </Vorhang>
    );
  }

  if (screen.name === 'lobby') {
    return (
      <Lobby
        gameId={screen.gameId}
        onBack={zurueckZumHub}
        onEnter={(tableId) => setScreen({ name: 'table', gameId: screen.gameId, tableId })}
      />
    );
  }

  return (
    <GameSelect
      me={me}
      // Feldherr und Mememory haben keine Kartenlobby: Tisch erstellen und
      // beitreten erledigt der jeweils eigene Bildschirm, fest mit zwei
      // Sitzen und einer Runde.
      onPick={(gameId) => {
        if (gameId === 'feldherr') return setScreen({ name: 'feldherr' });
        if (gameId === 'mememory') return setScreen({ name: 'mememory' });
        if (gameId === 'easypoker') return setScreen({ name: 'easypoker' });
        if (gameId === 'filler') return setScreen({ name: 'filler' });
        if (gameId === 'eiland') return setScreen({ name: 'eiland' });
        if (gameId === 'tafelrunde') return setScreen({ name: 'tafelrunde' });
        return setScreen({ name: 'lobby', gameId });
      }}
      onSolo={(modusId) => {
        if (modusId === 'prosubway') setScreen({ name: 'prosubway' });
      }}
      onResume={(gameId, tableId) => setScreen({ name: 'table', gameId, tableId })}
      onShowProfile={zeigeProfil}
      // Erst umschalten, dann speichern: Das Blatt wechselt ohne Wartezeit,
      // und schlaegt das Speichern fehl, holt reload() den echten Stand zurueck.
      onThemeChange={(gameId, teil) => {
        setMe({ ...me, themes: { ...me.themes, [gameId]: { ...themeFuer(gameId), ...teil } } });
        void api.setTheme(gameId, teil).catch(() => void reload());
      }}
      onAvatarChange={() => void reload()}
      onSignOut={async () => {
        await api.logout();
        setMe(null);
      }}
      // Kein api.logout(): Die Loeschung hat die Sitzung schon widerrufen und
      // das Cookie geraeumt - ein Abmelden danach liefe in ein 401.
      onDeleted={() => setMe(null)}
    />
  );
}
