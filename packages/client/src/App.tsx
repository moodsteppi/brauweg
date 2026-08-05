import { useEffect, useState } from 'react';

import { api, type Me } from './api';
import { Ladekreis } from './Ladekreis';
import { musikAn } from './klang';
import { deckForGame, deckMitRuecken } from './decks';
import { Auth } from './screens/Auth';
import { GameSelect } from './screens/GameSelect';
import { Lobby } from './screens/Lobby';
import { Profile } from './screens/Profile';
import { Table } from './screens/Table';
import { WizardTable } from './screens/WizardTable';

type Screen =
  | { name: 'games' }
  | { name: 'lobby'; gameId: string }
  | { name: 'table'; gameId: string; tableId: string }
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
      <main>
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

  if (screen.name === 'table') {
    /**
     * Jedes Spiel hat seinen eigenen Tisch: Der Doppelkopftisch kennt
     * Vorbehalte und Ansagen, der Zaubertisch Gebote und Trumpfwahl. Die
     * gemeinsamen Bausteine liegen in `src/tisch/` — verzweigt wird genau
     * hier, an einer einzigen Stelle.
     */
    const Spieltisch = screen.gameId === 'wizard' ? WizardTable : Table;
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
      onPick={(gameId) => setScreen({ name: 'lobby', gameId })}
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
