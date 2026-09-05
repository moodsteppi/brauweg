import { Suspense, lazy, useEffect, useState } from 'react';

import { api, type Me } from './api';
import { Ladekreis } from './Ladekreis';
import { musikAn } from './klang';
import { deckForGame, deckMitRuecken } from './decks';
import { Auth } from './screens/Auth';
import { GameSelect } from './screens/GameSelect';
import { Lobby } from './screens/Lobby';
import { Ladevorhang } from './minispiele/tafelrunde/Ladevorhang';
import { TISCH_PARAMETER } from './minispiele/tafelrunde/tischlink';

const Runner = lazy(() => import('./screens/Runner').then((m) => ({ default: m.Runner })));

/**
 * Die Spielschirme kommen einzeln nach.
 *
 * Statisch importiert lagen sie alle im Hauptpaket: Wer Tafelrunde antippte,
 * lud vorher elf andere Spiele — und Feldherr zog ueber `Buehne3D` auch noch
 * `three` mit hinein. Im Hauptpaket bleiben nur Auth, GameSelect und Lobby;
 * die braucht man sofort. Wer hier einen Bildschirm wieder statisch
 * importiert, hebt die Aufteilung fuer ihn auf — Vite meldet das beim Bau
 * ("dynamic import will not move module into another chunk").
 */
const Tafelrunde = lazy(() =>
  import('./screens/Tafelrunde').then((m) => ({ default: m.Tafelrunde })),
);
const CambioTable = lazy(() =>
  import('./screens/CambioTable').then((m) => ({ default: m.CambioTable })),
);
const EasyPoker = lazy(() =>
  import('./screens/EasyPoker').then((m) => ({ default: m.EasyPoker })),
);
const Eiland = lazy(() => import('./screens/Eiland').then((m) => ({ default: m.Eiland })));
/* Feldherr zieht ueber `Buehne3D` `three` und `@react-three/fiber` nach —
   der schwerste der Schirme und der Grund, warum die 3D-Bibliothek bis heute
   im Hauptpaket lag, obwohl main.tsx seine Werkzeuge laengst nachlaedt. */
const FeldherrTisch = lazy(() =>
  import('./screens/FeldherrTisch').then((m) => ({ default: m.FeldherrTisch })),
);
const Filler = lazy(() => import('./screens/Filler').then((m) => ({ default: m.Filler })));
const Mememory = lazy(() => import('./screens/Mememory').then((m) => ({ default: m.Mememory })));
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })));
const SkatTable = lazy(() =>
  import('./screens/SkatTable').then((m) => ({ default: m.SkatTable })),
);
const Table = lazy(() => import('./screens/Table').then((m) => ({ default: m.Table })));
const WizardTable = lazy(() =>
  import('./screens/WizardTable').then((m) => ({ default: m.WizardTable })),
);

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

/**
 * Der Lade-Zustand des Clients.
 *
 * Zwei Anlaesse, ein Bild: der erste Abruf von `me` beim Start und — seit die
 * Spielschirme einzeln nachkommen — die kurze Weile, in der ein Schirm noch
 * ueber die Leitung ist.
 */
function AppLaedt({ text = 'Einen Moment…' }: { text?: string }): React.JSX.Element {
  return (
    <main className="app-laden">
      <Ladekreis bild="/hub/lade-pinguin.webp" text={text} />
    </main>
  );
}

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

  if (loading) return <AppLaedt />;

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
   * Zurueck in die Spielauswahl, mit frischem `me`.
   *
   * Als benannte Funktion, weil sie bei Tafelrunde an ZWEI Stellen haengt: am
   * Schirm und am Abbrechen-Knopf seines Ladevorhangs. Zwei Kopien derselben
   * Zeile gingen beim naechsten Zusatz (etwa einem Klang) auseinander, und
   * zwar so, dass nur der Weg ueber den Vorhang ihn nicht bekaeme.
   */
  const zurueckZuDenSpielen = (): void => {
    setScreen({ name: 'games' });
    void reload();
  };

  /**
   * Welcher Bildschirm gezeigt wird.
   *
   * Als eigene Funktion und nicht als Kette von `return`s im Rumpf, weil die
   * Schirme nachgeladen werden: So genuegt EIN <Suspense> darum, statt eines
   * an jeder der gut zwanzig Rueckgabestellen.
   */
  const bildschirm = (): React.JSX.Element => {
    if (screen.name === 'profil') {
      return <Profile accountId={screen.accountId} onBack={() => setScreen(screen.vorher)} />;
    }

    if (screen.name === 'prosubway') {
      return (
        <Suspense fallback={<AppLaedt text="Pro-Subway…" />}>
          <Runner
            hubMode
            onBack={() => {
              setScreen({ name: 'games' });
              void reload();
            }}
          />
        </Suspense>
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
      return (
        <FeldherrTisch
          tableId={screen.tableId}
          onBack={() => setScreen({ name: 'lobby', gameId: screen.gameId })}
        />
      );
    }
    if (screen.name === 'lobby' && screen.gameId === 'feldherr') {
      return (
        <FeldherrTisch
          onBack={() => setScreen({ name: 'games' })}
          onEnter={(tableId) => setScreen({ name: 'table', gameId: 'feldherr', tableId })}
        />
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
        <Mememory
          startTisch={screen.tisch ?? null}
          istAufsicht={me.entitlements.staff}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }
    if (
      (screen.name === 'table' || screen.name === 'lobby') &&
      screen.gameId === 'mememory'
    ) {
      return (
        <Mememory
          startTisch={screen.name === 'table' ? screen.tableId : null}
          istAufsicht={me.entitlements.staff}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }

    /**
     * Easy Poker laeuft ebenfalls nicht am Kartentisch: Vier Schaltflaechen,
     * zwei Sitze, ein eigener Filz. Alle drei Wege — Spielauswahl, Lobby,
     * Weiterspielen — fuehren auf denselben Bildschirm.
     */
    if (screen.name === 'easypoker') {
      return (
        <EasyPoker
          startTisch={screen.tisch ?? null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }
    if (
      (screen.name === 'table' || screen.name === 'lobby') &&
      screen.gameId === 'easypoker'
    ) {
      return (
        <EasyPoker
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }

    /**
     * Filler laeuft ebenfalls nicht am Kartentisch: Ein Raster, sechs Farben,
     * zwei Sitze. Alle drei Wege — Spielauswahl, Lobby, Weiterspielen — fuehren
     * auf denselben Bildschirm.
     */
    if (screen.name === 'filler') {
      return (
        <Filler
          startTisch={screen.tisch ?? null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }
    if (
      (screen.name === 'table' || screen.name === 'lobby') &&
      screen.gameId === 'filler'
    ) {
      return (
        <Filler
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }

    /**
     * Eiland: eine Karte, zwei Sitze, gleichzeitige Zuege. Wie bei Filler fuehren
     * alle drei Wege — Spielauswahl, Lobby, Weiterspielen — auf denselben
     * Bildschirm.
     */
    if (screen.name === 'eiland') {
      return (
        <Eiland
          startTisch={screen.tisch ?? null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }
    if (
      (screen.name === 'table' || screen.name === 'lobby') &&
      screen.gameId === 'eiland'
    ) {
      return (
        <Eiland
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }

    /**
     * Tafelrunde: Auto-Battler mit Verschmelzen. Wie bei Filler und Eiland
     * fuehren alle drei Wege — Spielauswahl, Lobby, Weiterspielen — auf
     * denselben Bildschirm.
     *
     * Als einziger Schirm bekommt Tafelrunde ein eigenes <Suspense> mit
     * eigenem Rueckfall: seinem Ladebildschirm statt des Lade-Pinguins. Der
     * Grund ist Robins Beschwerde vom 5.9.2026 — hier hingen zwei Vorhaenge
     * hintereinander (erst das Paket, dann die Bilder), und der zweite zeigte
     * einen Balken, der die erste Haelfte der Wartezeit unterschlug. Jetzt ist
     * es ein Balken ueber beides; der Rueckfall und der nachgeladene Schirm
     * lesen denselben Lauf mit (Ladevorhang.tsx).
     */
    if (screen.name === 'tafelrunde') {
      return (
        <Suspense fallback={<Ladevorhang onAbbrechen={zurueckZuDenSpielen} />}>
          <Tafelrunde startTisch={screen.tisch ?? null} onBack={zurueckZuDenSpielen} />
        </Suspense>
      );
    }
    if (
      (screen.name === 'table' || screen.name === 'lobby') &&
      screen.gameId === 'tafelrunde'
    ) {
      return (
        <Suspense fallback={<Ladevorhang onAbbrechen={zurueckZuDenSpielen} />}>
          <Tafelrunde
            startTisch={screen.name === 'table' ? screen.tableId : null}
            onBack={zurueckZuDenSpielen}
          />
        </Suspense>
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
          onLeave={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }

    if (screen.name === 'feldherr') {
      return (
        <FeldherrTisch
          onBack={() => setScreen({ name: 'games' })}
          onEnter={(tableId) => setScreen({ name: 'table', gameId: 'feldherr', tableId })}
        />
      );
    }

    if (screen.name === 'lobby') {
      return (
        <Lobby
          gameId={screen.gameId}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
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
  };

  return <Suspense fallback={<AppLaedt />}>{bildschirm()}</Suspense>;
}
