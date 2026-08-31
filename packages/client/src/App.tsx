import { Suspense, lazy, useEffect, useState } from 'react';

import { api, type Me } from './api';
import { Ladekreis } from './Ladekreis';
import { musikAn } from './klang';
import { deckForGame, deckMitRuecken } from './decks';
import { Auth } from './screens/Auth';
import { FeldherrTisch } from './screens/FeldherrTisch';
import { Filler } from './screens/Filler';
import { GameSelect } from './screens/GameSelect';
import { Lobby } from './screens/Lobby';
import { Mememory } from './screens/Mememory';
import { Profile } from './screens/Profile';
import { Table } from './screens/Table';
import { CambioTable } from './screens/CambioTable';
import { SkatTable } from './screens/SkatTable';
import { WizardTable } from './screens/WizardTable';

const Runner = lazy(() => import('./screens/Runner').then((m) => ({ default: m.Runner })));

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
   * Filler bringt wie Mememory sein eigenes Hauptmenue mit: Match-Suche und
   * Brett auf einem Bildschirm, ohne Kartenlobby.
   */
  | { name: 'filler'; tisch?: string | null }
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
  const [screen, setScreen] = useState<Screen>({ name: 'games' });

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

  if (screen.name === 'profil') {
    return <Profile accountId={screen.accountId} onBack={() => setScreen(screen.vorher)} />;
  }

  if (screen.name === 'prosubway') {
    return (
      <Suspense
        fallback={
          <main className="app-laden">
            <Ladekreis bild="/hub/lade-pinguin.webp" text="Pro-Subway…" />
          </main>
        }
      >
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
        if (gameId === 'filler') return setScreen({ name: 'filler' });
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
