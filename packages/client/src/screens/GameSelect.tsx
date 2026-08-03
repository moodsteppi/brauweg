import { useEffect, useState } from 'react';

import {
  ApiError,
  api,
  type FriendLists,
  type GameSummary,
  type Me,
  type PlayerRef,
  type RankingEntry,
} from '../api';
import { DECKS, cardImage, deckById, type Deck } from '../decks';
import { SZENEN, szeneBild } from '../szenen';
import { HubBanner, HubSzene, StatHero, StatKachel, StatSpiel, Tafel } from '../hub';
import { Clan } from './Clan';
import { cardLabel, cardName, isRed, t } from '../i18n';
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

export function GameSelect({
  me,
  onPick,
  onResume,
  onDeckChange,
  onSzeneChange,
  onAvatarChange,
  onShowProfile,
  onSignOut,
  onDeleted,
}: {
  me: Me;
  onPick: (gameId: string) => void;
  onResume: (gameId: string, tableId: string) => void;
  onDeckChange: (cardDeck: string) => void;
  onSzeneChange: (tableScene: string) => void;
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
  const trophies = me.stats.reduce((sum, stat) => sum + stat.trophies, 0);

  return (
    <div className="front front--hub">
      <header className="front-top">
        {/* Level und Name fuehren zum Profil-Tab. Das Level ist ehrlich Null -
            das System dahinter kommt noch, der Platz dafuer steht schon. */}
        <button className="front-spieler" onClick={() => setTab('profil')}>
          <img className="front-avatar" src="/hub/pinguin.png" alt="" />
          <span className="front-spieler-info">
            <strong>{me.displayName}</strong>
            <span className="front-xp" aria-hidden="true">
              <span style={{ width: '0%' }} />
            </span>
          </span>
          <span className="front-level front-level--hub" aria-label="Level 0">
            0
          </span>
        </button>
        <div className="front-waehrungen">
          <span className="front-waehrung front-waehrung--cups">
            <img className="front-waehrung-icon" src="/hub/pokal.png" alt="" />
            {trophies}
          </span>
          <button
            className="front-waehrung front-waehrung--muenzen"
            onClick={() => setBald('Münzen kaufen')}
          >
            <img className="front-waehrung-icon" src="/hub/muenze.png" alt="" />
            {me.coins}
            <span className="front-plus" aria-hidden="true">
              +
            </span>
          </button>
          <button
            className="front-waehrung front-waehrung--vip"
            onClick={() => setBald('VIP')}
          >
            <img className="front-waehrung-icon" src="/hub/krone.png" alt="" />
            0
            <span className="front-plus" aria-hidden="true">
              +
            </span>
          </button>
        </div>
      </header>

      <div
        className={`front-body${tab === 'spielen' ? '' : ' front-body--szene'}`}
        key={tab}
      >
        {tab === 'shop' && <Shop onBald={setBald} />}
        {tab === 'clan' && (
          <Clan
            clanId={me.clubs[0]?.id ?? null}
            onBald={setBald}
            onShowProfile={onShowProfile}
            onMeChange={onAvatarChange}
          />
        )}
        {tab === 'spielen' && (
          <Spielen
            trophies={trophies}
            activeTable={me.activeTable}
            onPick={onPick}
            onResume={onResume}
            onBald={setBald}
            onRangliste={() => setRanglisteOffen(true)}
          />
        )}
        {tab === 'blatt' && <DeckPicker
            current={me.cardDeck}
            onChange={onDeckChange}
            szene={me.tableScene}
            onSzeneChange={onSzeneChange}
          />}
        {tab === 'profil' && (
          <ProfilTab
            me={me}
            onAvatarChange={onAvatarChange}
            onMeChange={onAvatarChange}
            onSignOut={onSignOut}
            onDeleted={onDeleted}
            onBald={setBald}
            onShowProfile={onShowProfile}
          />
        )}
      </div>

      <nav className="front-tabs" aria-label="Bereiche">
        <TabButton
          label="Shop"
          farbe="shop"
          active={tab === 'shop'}
          onClick={() => setTab('shop')}
          iconSrc="/hub/tab-shop.webp"
        />
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
          label="Blatt"
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

      <div className="hub-profilkopf hub-profilkopf--a">
        <ProfilBild me={me} onChanged={onAvatarChange} />
        <div className="hub-profilkopf-text">
          <strong>{me.displayName}</strong>
          <span className="muted">{geburtstagText}</span>
        </div>
        <span className="front-level front-level--hub" aria-label="Level 0">
          0
        </span>
      </div>

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

      <p className="hub-statistik-hinweis">
        Trophäen nur an Tischen ohne Bots. Partien und Siege zählen alles.
      </p>

      {/* Freunde standen frueher im Clan-Tab. Dort fuellt jetzt die
          Mitgliederliste den Bildschirm, und Freunde sind ohnehin kein
          Clan: Sie gehoeren zum eigenen Konto. */}
      <Freunde onShowProfile={onShowProfile} />

      <div className="hub-knopfreihe hub-knopfreihe--a">
        <button className="hub-knopf hub-knopf--a" onClick={() => onBald('Benachrichtigungen')}>
          Benachrichtigungen
          <span className="front-bald-tag">Bald</span>
        </button>
        <button className="hub-knopf hub-knopf--a-raus" onClick={onSignOut}>
          Abmelden
        </button>
      </div>

      {/* Klein und unten, aber vorhanden: Apple lehnt Apps mit Konten ohne
          diesen Weg zuverlaessig ab, und die DSGVO verlangt ihn ohnehin. Als
          Textzeile statt als Knopf, damit er nicht neben "Abmelden" liegt und
          im Vorbeitippen erwischt wird. */}
      <button className="hub-konto-loeschen" onClick={() => setLoeschenOffen(true)}>
        Konto löschen
      </button>

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

/**
 * Shop (Entwurf B): Season Pass als Sonderangebot oben, darunter
 * Wochenangebot/VIP, dann Vitrinen. Alles nur Vorschau — kein Kauf.
 */
function Shop({ onBald }: { onBald: (name: string) => void }): React.JSX.Element {
  /** Die grossen Angebote: drei nebeneinander, wie im Entwurf. */
  const angebote = [
    { name: 'Season Pass', art: '/hub/season-pass.png', preis: 'Saison' },
    { name: 'VIP-Pass', art: '/hub/shop-vip.webp', preis: '7 Tage' },
    { name: 'Münzpaket', art: '/hub/muenze.png', preis: 'Paket' },
  ];
  /** Kleine Vitrine darunter - alles noch Attrappe, ehrlich ohne Preis. */
  const auswahl = [
    { name: 'Blätter', icon: '/hub/tab-blatt.webp' },
    { name: 'Tische', icon: '/hub/truhe.png' },
    { name: 'Wappen', icon: '/hub/clan-wappen.png' },
    { name: 'Emotes', icon: '/hub/tab-spielen.webp' },
  ];

  return (
    <HubSzene bg="/hub/bg-shop.webp" className="front-shop front-shop--b">
      <HubBanner />

      <Tafel titel="Angebote">
        <div className="hub-reihe hub-reihe--drei">
          {angebote.map((a) => (
            <button key={a.name} className="hub-angebot" onClick={() => onBald(a.name)}>
              <img className="hub-angebot-art" src={a.art} alt="" draggable={false} />
              <strong>{a.name}</strong>
              <span className="hub-preis">{a.preis}</span>
              <span className="front-bald-tag">Bald</span>
            </button>
          ))}
        </div>
      </Tafel>

      <Tafel titel="Tägliche Auswahl" zusatz="Kommt bald">
        <div className="hub-reihe hub-reihe--vier">
          {auswahl.map((k) => (
            <button key={k.name} className="hub-vitrine" onClick={() => onBald(k.name)}>
              <img className="hub-vitrine-icon" src={k.icon} alt="" draggable={false} />
              <span>{k.name}</span>
            </button>
          ))}
        </div>
      </Tafel>
    </HubSzene>
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
      onClick={onClick}
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
  activeTable,
  onPick,
  onResume,
  onBald,
  onRangliste,
}: {
  trophies: number;
  activeTable: Me['activeTable'];
  onPick: (gameId: string) => void;
  onResume: (gameId: string, tableId: string) => void;
  onBald: (name: string) => void;
  onRangliste: () => void;
}): React.JSX.Element {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [wahlOffen, setWahlOffen] = useState(false);

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
        <Trophaeenpfad trophies={trophies} />

        <header className="hub-logo" aria-label="Brauweg">
          <img className="hub-logo-mark" src="/hub/logo.png" alt="Brauweg" draggable={false} />
          <img
            className="hub-logo-slogan"
            src="/hub/slogan.png"
            alt="Doppelkopf. Dein Weg."
            draggable={false}
          />
        </header>

        <aside className="hub-seite hub-seite--links">
          <button
            type="button"
            className="hub-side-btn hub-side-btn--lila"
            aria-label="Spielauswahl"
            onClick={() => setWahlOffen(true)}
          >
            <img src="/hub/tab-spielen.webp" alt="" draggable={false} />
          </button>
          <button
            type="button"
            className="hub-side-btn hub-side-btn--blau"
            aria-label="Rangliste"
            onClick={onRangliste}
          >
            <img src="/hub/pokal.png" alt="" draggable={false} />
          </button>
          <button
            type="button"
            className="hub-side-btn hub-side-btn--grau"
            aria-label="Bald"
            onClick={() => onBald('Mehr Features')}
          >
            <img src="/hub/krone.png" alt="" draggable={false} />
          </button>
        </aside>

        <aside className="hub-seite hub-seite--rechts">
          <button
            type="button"
            className="hub-truhe"
            aria-label="Tägliche Belohnung, bald"
            onClick={() => onBald('Der Tagesbonus')}
          >
            <img src="/hub/truhe.png" alt="" draggable={false} />
            <span className="front-bald-tag">Bald</span>
          </button>
        </aside>

        {/* Einstieg fuer Neue, wie im Entwurf unten rechts. Die Anleitung
            selbst gibt es noch nicht — der Platz dafuer steht schon, und beim
            Antippen sagt sie das auch. */}
        <button
          type="button"
          className="hub-neuhier"
          onClick={() => onBald('Die Doppelkopf-Anleitung')}
        >
          <span className="hub-neuhier-text">
            <strong>Neu hier?</strong>
            <span>So spielst du Doppelkopf</span>
          </span>
          <img src="/hub/pinguin.png" alt="" draggable={false} />
          <span className="front-bald-tag">Bald</span>
        </button>
      </div>

      <div className={`front-play-stack${activeTable ? ' has-resume' : ''}`}>
        {activeTable && (
          <button
            className="front-play"
            onClick={() => onResume(activeTable.gameId, activeTable.tableId)}
          >
            {activeTable.paused
              ? 'Weiterspielen — pausiert'
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
          onBald={onBald}
          onClose={() => setWahlOffen(false)}
        />
      )}
    </div>
  );
}

function RanglisteBlatt({
  meId,
  onClose,
  onShowProfile,
}: {
  meId: string;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  const [rows, setRows] = useState<RankingEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .ranking('doppelkopf')
      .then(setRows)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
      });
  }, []);

  return (
    <div className="doko-sheet" onClick={onClose} role="presentation">
      <div
        className="doko-sheet-card front-ranking"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Rangliste Doppelkopf"
      >
        <header className="front-ranking-head">
          <strong>Rangliste · Doppelkopf</strong>
          <button className="doko-icon" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </header>
        {error && <p className="error">{error}</p>}
        {!error && rows.length === 0 && <p className="muted">Noch niemand auf der Liste.</p>}
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
      </div>
    </div>
  );
}

/**
 * Spielauswahl im Vollbild: ein Bild je Spiel.
 *
 * Doppelkopf ist offen und fuehrt ins Tisch-Menue; die anderen tragen die
 * Bald-Marke, lassen sich anstimmen, und ein Tipp aufs Bild oeffnet das
 * "Kommt bald"-Blatt. Die Bilder sind gemalte SVGs - nichts laedt nach.
 */
function Spielwahl({
  games,
  voted,
  onVote,
  onPick,
  onBald,
  onClose,
}: {
  games: GameSummary[];
  voted: Set<string>;
  onVote: (gameId: string) => void;
  onPick: (gameId: string) => void;
  onBald: (name: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const playable = games.filter((game) => game.availability === 'playable');
  const preview = games.filter((game) => game.availability === 'preview');

  return (
    <div className="spielwahl">
      <header className="spielwahl-kopf">
        <h2>Spielauswahl</h2>
        <button className="spielwahl-zu" onClick={onClose} aria-label="Schließen">
          ×
        </button>
      </header>
      <div className="spielwahl-rolle">
        {playable.map((game) => (
          <button
            key={game.id}
            className="spielwahl-karte is-offen"
            onClick={() => onPick(game.id)}
          >
            <SpielBild id={game.id} />
            <span className="spielwahl-titel">
              <strong>{t(game.nameKey)}</strong>
              <span>{game.seatCounts.join(', ')} Spieler</span>
            </span>
            <span className="spielwahl-spielen">Spielen</span>
          </button>
        ))}
        {preview.map((game) => (
          <div key={game.id} className="spielwahl-karte is-zu">
            <button className="spielwahl-flaeche" onClick={() => onBald(t(game.nameKey))}>
              <SpielBild id={game.id} />
              <span className="spielwahl-titel">
                <strong>{t(game.nameKey)}</strong>
                <span className="front-bald-tag">Bald</span>
              </span>
            </button>
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
    </div>
  );
}

/**
 * Gemalte Bilder der Spiele: je ein kleines Stillleben mit den Karten, an
 * denen man das Spiel erkennt. Ein unbekanntes Spiel bekommt Ruecken -
 * sichtbar generisch statt unsichtbar kaputt.
 */
function SpielBild({ id }: { id: string }): React.JSX.Element {
  const karte = (
    x: number,
    rot: number,
    text: string,
    rotFarbe: boolean,
    breit = 30,
  ): React.JSX.Element => (
    <g key={`${x}-${text}`} transform={`translate(${x},14) rotate(${rot})`}>
      <rect width={breit} height={breit * 1.45} rx="3" fill="#fff" />
      <text x="5" y="15" fontSize="11" fill={rotFarbe ? '#c22b1e' : '#17181d'} fontWeight="800">
        {text}
      </text>
    </g>
  );

  if (id === 'doppelkopf') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#1c5138" />
        <ellipse cx="160" cy="92" rx="190" ry="48" fill="#237a4d" />
        {karte(112, -14, '♣D', false)}
        {karte(142, -5, '♠D', false)}
        {karte(172, 5, '♥10', true)}
        {karte(202, 14, '♦A', true)}
      </svg>
    );
  }
  if (id === 'skat') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#1d3a52" />
        {karte(104, -8, '♠B', false)}
        {karte(134, 0, '♥B', true)}
        {karte(164, 8, '♣B', false)}
        <g transform="translate(216,22) rotate(4)">
          <rect width="26" height="37" rx="3" fill="#4a6a8a" />
          <rect x="3" y="3" width="20" height="31" rx="2" fill="#3a5570" />
        </g>
        <g transform="translate(240,24) rotate(11)">
          <rect width="26" height="37" rx="3" fill="#4a6a8a" />
          <rect x="3" y="3" width="20" height="31" rx="2" fill="#3a5570" />
        </g>
      </svg>
    );
  }
  if (id === 'schafkopf') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#3a5f8a" />
        <g fill="#fff" opacity="0.2">
          <path d="M0 0 L28 40 L0 80 Z" />
          <path d="M56 0 L28 40 L56 80 L84 40 Z" />
          <path d="M112 0 L84 40 L112 80 Z" />
        </g>
        {karte(150, -6, '♥O', true)}
        {karte(182, 7, '♠O', false)}
      </svg>
    );
  }
  if (id === 'romme') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#5a3a78" />
        {karte(104, -6, '♦3', true, 28)}
        {karte(134, 0, '♦4', true, 28)}
        {karte(164, 0, '♦5', true, 28)}
        <g transform="translate(196,16) rotate(7)">
          <rect width="28" height="40" rx="3" fill="#ffe9a8" />
          <text x="7" y="27" fontSize="16">🃏</text>
        </g>
      </svg>
    );
  }
  if (id === 'maumau') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#8a3a4a" />
        {karte(116, -9, '♣7', false)}
        {karte(150, 3, '♥7', true)}
        <text x="204" y="48" fontSize="19" fontWeight="900" fill="#ffd76e" transform="rotate(6 204 48)">
          Mau!
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 80" aria-hidden="true">
      <rect width="320" height="80" fill="#33266b" />
      <g transform="translate(132,16) rotate(-6)">
        <rect width="28" height="40" rx="3" fill="#4a55a8" />
        <rect x="3" y="3" width="22" height="34" rx="2" fill="#3a4488" />
      </g>
      <g transform="translate(162,16) rotate(6)">
        <rect width="28" height="40" rx="3" fill="#4a55a8" />
        <rect x="3" y="3" width="22" height="34" rx="2" fill="#3a4488" />
      </g>
    </svg>
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
    <Tafel titel="Freunde" zusatz={lists ? `${anzahl}` : '…'} weit>
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

      {lists === null && <p className="muted">Wird geladen…</p>}
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

/** Die drei Karten, an denen sich die Blätter am deutlichsten unterscheiden. */
const SAMPLE = [
  { id: 1, suit: 'C', rank: 'Q' },
  { id: 2, suit: 'H', rank: 'T' },
  { id: 3, suit: 'D', rank: 'A' },
];

/**
 * Kartenblatt waehlen.
 *
 * Mit Vorschau statt nur mit Namen: Welches Blatt einem liegt, entscheidet
 * niemand nach einer Beschreibung, sondern nach dem Hinsehen.
 */
function DeckPicker({
  current,
  onChange,
  szene,
  onSzeneChange,
}: {
  current: string;
  onChange: (cardDeck: string) => void;
  szene: string;
  onSzeneChange: (tableScene: string) => void;
}): React.JSX.Element {
  return (
    <HubSzene bg="/hub/bg-blatt.webp" className="front-blatt front-blatt--b">
      <HubBanner />

      <Tafel
        titel="Kartenblatt"
        zusatz="Gilt auf allen Geräten"
        weit
        className="hub-tafel--blatt"
      >
        <div className="hub-blaetter">
          {DECKS.map((deck) => (
            <button
              className={`hub-blatt${deck.id === current ? ' is-an' : ''}`}
              key={deck.id}
              aria-pressed={deck.id === current}
              onClick={() => onChange(deck.id)}
            >
              <div className="hub-blatt-probe">
                {SAMPLE.map((card) => (
                  <DeckSample card={card} deck={deck} key={card.id} />
                ))}
              </div>
              <strong>{t(deck.nameKey)}</strong>
              {deck.id === current && <span className="hub-blatt-haken">✓</span>}
            </button>
          ))}
        </div>

        {/*
          Die Szenerie steht beim Kartenblatt, weil beides dieselbe Frage
          beantwortet: Wie sieht mein Tisch aus? Sie ist persoenlich — jeder
          am Tisch sieht seine eigene, niemand entscheidet fuer alle.

          Die Vorschau zeigt echte Karten darauf, denn genau darauf kommt es
          an: Auf einem zu dunklen Untergrund verschwinden Kreuz und Pik.
          Das soll man vor dem Spiel sehen und nicht mittendrin.
        */}
        <h3 className="hub-abschnitt">Tisch</h3>
        <div className="hub-szenen">
          {SZENEN.map((s) => (
            <button
              className={`hub-szene${s.id === szene ? ' is-an' : ''}`}
              key={s.id}
              aria-pressed={s.id === szene}
              onClick={() => onSzeneChange(s.id)}
            >
              <span className="hub-szene-probe">
                <img src={szeneBild(s.id)} alt="" draggable={false} />
                <span className="hub-szene-karten">
                  {SAMPLE.slice(0, 2).map((card) => (
                    <DeckSample card={card} deck={deckById(current)} key={card.id} />
                  ))}
                </span>
              </span>
              <strong>{s.name}</strong>
              <span className="muted">{s.hinweis}</span>
              {s.id === szene && <span className="hub-blatt-haken">✓</span>}
            </button>
          ))}
        </div>
      </Tafel>
    </HubSzene>
  );
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
        <img src="/hub/pinguin.png" alt="Profilbild" draggable={false} />
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

