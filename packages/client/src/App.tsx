import { Suspense, lazy, useEffect, useState } from 'react';

import { ApiError, api, type Me } from './api';
import { t } from './i18n';
import { Ladekreis } from './Ladekreis';
import { musikAn } from './klang';
import { inApp } from './laufzeit';
import { deckForGame, deckMitRuecken } from './decks';
import { Auth } from './screens/Auth';
import { GameSelect } from './screens/GameSelect';
import { Lobby } from './screens/Lobby';
import { Ladevorhang } from './minispiele/tafelrunde/Ladevorhang';
import { TISCH_PARAMETER } from './minispiele/tafelrunde/tischlink';
import {
  fehlschlagMerken,
  vorgemerkterCode,
  vormerkungLoeschen,
} from './minispiele/partykiste/einladungslink';

import { leseKontoLink, type KontoLinkZiel } from './kontolink';
import { istSpielbar } from './spielfreigabe';
import { useZuruecktaste } from './zuruecktaste';

const Runner = lazy(() => import('./screens/Runner').then((m) => ({ default: m.Runner })));
/** Landeseiten der Mail-Links und die Mail-Diagnose (seit dem 23.09.2026). */
const KontoLink = lazy(() =>
  import('./screens/KontoLink').then((m) => ({ default: m.KontoLink })),
);
const KontoSichern = lazy(() =>
  import('./screens/KontoSichern').then((m) => ({ default: m.KontoSichern })),
);

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
const BroChessTable = lazy(() =>
  import('./screens/BroChessTable').then((m) => ({ default: m.BroChessTable })),
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
/* Golf zieht seinen kompletten Spielkern nach (Physik, Bots, 40 Bahnen) —
   nichts davon braucht jemand, der Doppelkopf spielt. */
const Golf = lazy(() => import('./screens/Golf').then((m) => ({ default: m.Golf })));
/* BroCooked zieht Küche, Zeichner und Hilfskoch nach — nichts davon braucht,
   wer Doppelkopf spielt. */
const BroCooked = lazy(() =>
  import('./screens/BroCooked').then((m) => ({ default: m.BroCooked })),
);
const Mememory = lazy(() => import('./screens/Mememory').then((m) => ({ default: m.Mememory })));
const Partykiste = lazy(() =>
  import('./screens/Partykiste').then((m) => ({ default: m.Partykiste })),
);
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })));
/**
 * Push-Mitteilungen (docs/PUSH.md): meldet das Geraetetoken und fragt beim
 * ersten Tisch einmal nach. Nur in der App — auf der Webseite wird die Datei
 * nie geladen.
 */
const PushBegleiter = lazy(() =>
  import('./push/PushBegleiter').then((m) => ({ default: m.PushBegleiter })),
);
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
   * Golf ebenso: eigenes Hauptmenue mit "Online spielen" und "Gegen Bots",
   * die Gruppe und die Bahn auf einem Bildschirm. Es ist kein Kartenspiel
   * und braucht keine Kartenlobby — die Lochzahl waehlt der Erste in der
   * Gruppe, nicht ein Regelsatz-Editor.
   */
  | { name: 'golf'; tisch?: string | null }
  | { name: 'brocooked'; tisch?: string | null }
  /**
   * Partykiste ebenso: eigenes Hauptmenue, eigene Runde, die Minispiele auf
   * einem Bildschirm. Es ist kein Kartenspiel und braucht keine Kartenlobby —
   * gewaehlt wird die Rundenzahl, kein Regelsatz.
   */
  | { name: 'partykiste'; tisch?: string | null }
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

/** Spiele, deren `lobby` die gewoehnliche Kartenlobby ist (siehe useZuruecktaste unten). */
const MIT_KARTENLOBBY: ReadonlySet<string> = new Set(['doppelkopf', 'skat', 'wizard', 'cambio', 'brochess']);

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
  /**
   * `/beitritt/K7X9MQ` setzt einen an den Tisch hinter dem Code (seit dem
   * 22.09.2026, Einladung am Partykiste-Tisch).
   *
   * Anders als `/?tisch=` bei Tafelrunde tritt dieser Link SELBST bei — so
   * hat Robin es entschieden: Er wird am selben Tisch vom Gastgeber
   * weitergegeben, meist als QR-Code ueber den Tisch, und wer ihn scannt,
   * will genau dorthin. Ein zweiter Tipp auf „Beitreten" waere dort nur eine
   * Huerde, und wer doch nicht will, steht im Wartesaal wieder auf.
   *
   * Wer noch nicht angemeldet ist, meldet sich erst an (oder spielt als Gast);
   * der Code wartet solange im Tab-Speicher (siehe einladungslink.ts).
   */
  const [einladung, setEinladung] = useState<string | null>(() => vorgemerkterCode());
  /**
   * `/verify`, `/reset` und `/aufsicht/mail` (siehe kontolink.ts) — gelesen
   * vor dem ersten Bild und unabhaengig von der Anmeldung: Der Gast, der
   * eben sein Konto gesichert hat, oeffnet den Bestaetigungslink angemeldet.
   */
  const [kontoLink, setKontoLink] = useState<KontoLinkZiel | null>(() => leseKontoLink());
  const [sichernOffen, setSichernOffen] = useState(false);
  /** Kam der Start ueber den Tafelrunde-Link `/?tisch=`? Nur dann wird nachgefragt. */
  const [tischLinkPruefen] = useState(() => screen.name === 'tafelrunde');

  const reload = async (): Promise<void> => {
    setMe(await api.me().catch(() => null));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  /**
   * Die Einladung einloesen, sobald jemand angemeldet ist.
   *
   * Erst ansehen, dann beitreten: Die Vorschau nennt das Spiel, und nur damit
   * landet man im richtigen Schirm — der Beitritt selbst antwortet nur mit der
   * Tischkennung. Beide Routen gab es schon; neu ist nur, dass sie hier von
   * selbst laufen.
   *
   * Scheitert es (Partie laeuft schon, Tisch voll, Code vertippt), geht es in
   * die Partykiste mit dem Code in der Eingabe und dem Grund darunter — nicht
   * stumm auf die Startseite, wo niemand erfaehrt, warum der Link nichts tat.
   * Die Partykiste, weil nur sie solche Links verteilt.
   *
   * Am Konto als Kennung, nicht an `me`: `reload()` ersetzt das Objekt nach
   * jeder Partie, und der Effekt liefe dann erneut los. Unter `StrictMode`
   * laeuft er im Entwicklungsbetrieb trotzdem zweimal; das ist harmlos, weil
   * `joinTable` im Server einen schon Sitzenden unveraendert zurueckgibt.
   */
  const kontoId = me?.id ?? null;

  /**
   * Der Tafelrunde-Link fuehrt am Server vorbei in den Schirm. Ist Tafelrunde
   * hier nicht freigegeben (App-Schalter, siehe spielfreigabe.ts), geht es
   * stattdessen auf die Startseite — sonst stuende man vor einem Beitritt,
   * den der Server ablehnt.
   */
  useEffect(() => {
    if (!kontoId || !tischLinkPruefen) return;
    let lebt = true;
    void istSpielbar('tafelrunde').then((ja) => {
      if (lebt && !ja) setScreen((jetzt) => (jetzt.name === 'tafelrunde' ? { name: 'games' } : jetzt));
    });
    return () => {
      lebt = false;
    };
  }, [kontoId, tischLinkPruefen]);

  useEffect(() => {
    if (!kontoId || !einladung) return;
    let lebt = true;
    void (async () => {
      try {
        const vorschau = await api.tischPerCode(einladung);
        const { tableId } = await api.beitretenPerCode(einladung);
        if (lebt) setScreen({ name: 'table', gameId: vorschau.gameId, tableId });
      } catch (err) {
        if (!lebt) return;
        fehlschlagMerken(einladung, err instanceof ApiError ? err.messageKey : 'error.internal');
        // Die Code-Eingabe steht in der Partykiste. Ist die hier nicht
        // freigegeben (App-Schalter), bleibt nur die Startseite.
        const partykiste = await istSpielbar('partykiste');
        if (lebt) setScreen(partykiste ? { name: 'partykiste' } : { name: 'games' });
      } finally {
        if (lebt) {
          vormerkungLoeschen();
          setEinladung(null);
        }
      }
    })();
    return () => {
      lebt = false;
    };
  }, [kontoId, einladung]);

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

  /**
   * Die Zurueck-Taste der Android-App (zuruecktaste.ts). Nur die zwei
   * Schritte, deren Ziel hier feststeht: aus einem Profil dorthin, wo es
   * geoeffnet wurde, und aus der Kartenlobby in die Spielauswahl — genau
   * das, was die Zurueck-Knoepfe dieser Schirme tun. Am Tisch und in den
   * Spielen mit eigenem Menue blaettert die Taste nicht: Dort weiss nur der
   * Schirm selbst, was „zurueck" heisst (die Partykiste steht auch im
   * Wartesaal noch auf `lobby`), und die App geht in den Hintergrund, statt
   * die Partie zu verlassen. Darum eine Liste der Spiele MIT Kartenlobby
   * statt einer ohne: Ein neues Spiel faellt so auf „nicht blaettern"
   * zurueck, nicht auf „aus dem Spiel werfen".
   */
  useZuruecktaste(() => {
    if (!me) return false;
    if (screen.name === 'profil') {
      setScreen(screen.vorher);
      return true;
    }
    if (screen.name === 'lobby' && MIT_KARTENLOBBY.has(screen.gameId)) {
      setScreen({ name: 'games' });
      void reload();
      return true;
    }
    return false;
  });

  if (loading) return <AppLaedt />;

  // Die Diagnose braucht ein angemeldetes Testkonto; ohne Anmeldung geht es
  // erst durch den Anmeldeschirm, und die Adresse wartet solange.
  if (kontoLink && (me || kontoLink.art !== 'mailprobe')) {
    return (
      <Suspense fallback={<AppLaedt />}>
        <KontoLink
          ziel={kontoLink}
          angemeldet={me !== null}
          onFertig={() => {
            setKontoLink(null);
            void reload();
          }}
        />
      </Suspense>
    );
  }

  if (!me) {
    return (
      <>
        {/* Die Anmeldung selbst bleibt unberuehrt (sie gehoert zum
            Sofort-Paket); der Hinweis liegt nur darueber, damit niemand
            glaubt, der Link habe ins Leere gefuehrt. */}
        {einladung ? (
          <p className="einladung-vorgemerkt" role="status">
            {t('einladung.vorgemerkt')} <strong>{einladung}</strong>
          </p>
        ) : null}
        <Auth onSignedIn={() => void reload()} />
      </>
    );
  }

  /* Zwischen Anmeldung und Tisch: kurz warten statt die Startseite zu zeigen,
     die gleich wieder verschwindet. */
  if (einladung) return <AppLaedt text={t('einladung.laeuft')} />;

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
     * Golf: Minigolf von oben, bis zu acht Baelle gleichzeitig auf einer
     * Bahn. Wie bei Filler und Eiland fuehren alle drei Wege —
     * Spielauswahl, Lobby, Weiterspielen — auf denselben Bildschirm.
     */
    if (screen.name === 'golf') {
      return (
        <Golf
          startTisch={screen.tisch ?? null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }
    /**
     * BroCooked: hektische Küche für 1 bis 4 Köche. Wie Golf führen alle drei
     * Wege — Spielauswahl, Lobby, Weiterspielen — auf denselben Bildschirm;
     * allein und zu zweit läuft er sogar ganz ohne Tisch.
     */
    if (screen.name === 'brocooked') {
      return (
        <BroCooked
          startTisch={screen.tisch ?? null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }
    if ((screen.name === 'table' || screen.name === 'lobby') && screen.gameId === 'brocooked') {
      return (
        <BroCooked
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }
    if ((screen.name === 'table' || screen.name === 'lobby') && screen.gameId === 'golf') {
      return (
        <Golf
          startTisch={screen.name === 'table' ? screen.tableId : null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }

    /**
     * Partykiste: neun Minispiele als Turnier, 4 bis 12 Leute im selben
     * Raum. Wie bei Golf fuehren alle drei Wege — Spielauswahl, Lobby,
     * Weiterspielen — auf denselben Bildschirm.
     */
    if (screen.name === 'partykiste') {
      return (
        <Partykiste
          startTisch={screen.tisch ?? null}
          onBack={() => {
            setScreen({ name: 'games' });
            void reload();
          }}
        />
      );
    }
    if ((screen.name === 'table' || screen.name === 'lobby') && screen.gameId === 'partykiste') {
      return (
        <Partykiste
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
        // Schach braucht weder Blatt noch Szene; die Props, die es nicht
        // kennt, laufen ins Leere.
        brochess: BroChessTable as unknown as typeof Table,
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

    /*
     * Gaeste bekommen ueber der Spielauswahl eine schmale Leiste zum Sichern.
     * Hier und nicht in GameSelect: Die Route gab es seit dem Gastkonto, nur
     * keinen Weg dorthin — und das Blatt kommt erst beim Antippen nach.
     */
    const gastLeiste = me.gast ? (
      <div className="gastsichern-leiste" role="note">
        <span>Du spielst als Gast.</span>
        <button type="button" onClick={() => setSichernOffen(true)}>
          Konto sichern
        </button>
        {sichernOffen && (
          <Suspense fallback={null}>
            <KontoSichern
              onClose={() => setSichernOffen(false)}
              onGesichert={() => {
                setSichernOffen(false);
                void reload();
              }}
            />
          </Suspense>
        )}
      </div>
    ) : null;

    return (
      <>
      {gastLeiste}
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
          if (gameId === 'golf') return setScreen({ name: 'golf' });
          if (gameId === 'brocooked') return setScreen({ name: 'brocooked' });
          if (gameId === 'partykiste') return setScreen({ name: 'partykiste' });
          if (gameId === 'tafelrunde') return setScreen({ name: 'tafelrunde' });
          return setScreen({ name: 'lobby', gameId });
        }}
        onSolo={(modusId) => {
          // In der App kommt Pro-Subway erst spaeter (GameSelect zeigt "Bald").
          if (modusId === 'prosubway' && !inApp) setScreen({ name: 'prosubway' });
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
      </>
    );
  };

  return (
    <>
      <Suspense fallback={<AppLaedt />}>{bildschirm()}</Suspense>
      {/* Eigene Grenze: Waehrend der Begleiter nachlaedt, soll der Bildschirm
          nicht auf den Ladevorhang zurueckfallen. */}
      {inApp && (
        <Suspense fallback={null}>
          <PushBegleiter kontoId={me.id} />
        </Suspense>
      )}
    </>
  );
}
