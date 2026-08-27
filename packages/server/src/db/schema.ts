/**
 * Datenmodell der Plattform (Plan 6.2).
 *
 * Zwei Grundsaetze, die sich durch das ganze Schema ziehen:
 *
 *   1. `game_id` gehoert an Tisch, Regelsatz, Partie und Statistik. Es
 *      nachzuruesten waere eine Migration ueber alle Kernfelder. Es ist
 *      bewusst `text` und kein Enum: ein neues Kartenspiel soll ein neues
 *      Paket sein und keine Schemaaenderung. Die Typsicherheit liefert
 *      `GameId` aus @brauweg/game-api.
 *
 *   2. Alles Spielabhaengige liegt in `jsonb`. Der Server kennt den Inhalt von
 *      `party_snapshot.state`, `round_summary.summary` und `rule_set.config`
 *      nicht und darf ihn nicht kennen.
 *
 * Kontoloeschung erfolgt als Anonymisierung (`account.anonymized_at`), nicht
 * als DELETE. Wuerde man Zeilen entfernen, zerfielen die Partiehistorien aller
 * Mitspieler.
 */

import type { GameId } from '@brauweg/game-api';
import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/** Spielkennung. Siehe Grundsatz 1 oben: bewusst kein Enum. */
const gameId = () => text().$type<GameId>().notNull();

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const tableVisibility = pgEnum('table_visibility', [
  'public',
  'on_request',
  'club_only',
]);

export const tableStatus = pgEnum('table_status', [
  'waiting',
  'running',
  'finished',
  'abandoned',
]);

export const partyStatus = pgEnum('party_status', [
  'running',
  'finished',
  'abandoned',
]);

export const clubJoinMode = pgEnum('club_join_mode', ['open', 'on_request']);

/**
 * Rangstufen im Clan.
 *
 *  ist der Anfuehrer,  der Vizeanfuehrer — beide duerfen
 * dasselbe.  (Aeltester) ist bisher eine Auszeichnung ohne
 * Sonderrechte; die Stufe steht schon da, damit ein Verein sie vergeben kann.
 * Die Kennungen bleiben englisch wie das uebrige Schema, die Anzeige
 * uebersetzt der Client.
 */
export const clubRole = pgEnum('club_role', ['admin', 'vize', 'elder', 'member', 'guest']);

export const friendshipStatus = pgEnum('friendship_status', [
  'pending',
  'accepted',
]);

/**
 * Stand eines Clankriegs.
 *
 * `suche` ist ein Krieg mit nur einer Seite: Der Clan wartet auf einen
 * Gegner. `angefragt` ist eine gezielte Herausforderung, die der andere
 * Clan noch annehmen muss. Erst `laeuft` zaehlt Punkte.
 */
export const clubWarStatus = pgEnum('club_war_status', [
  'suche',
  'angefragt',
  'laeuft',
  'beendet',
  'abgesagt',
]);

export const authTokenPurpose = pgEnum('auth_token_purpose', [
  'email_verify',
  'password_reset',
]);

export const purchaseProvider = pgEnum('purchase_provider', [
  'stripe',
  'apple',
]);

/** Warum eine Trophaeenbuchung entstanden ist. */
export const trophyReason = pgEnum('trophy_reason', [
  'party_result',
  'leave_penalty',
  'checkpoint_protection',
  'manual_correction',
]);

// ---------------------------------------------------------------------------
// Konten
// ---------------------------------------------------------------------------

export const account = pgTable(
  'account',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Nach Anonymisierung null. Deshalb nullable trotz Anmeldepflicht. */
    email: text(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    passwordHash: text(),
    /** Eindeutig und aenderbar, Aenderung ist immer kostenpflichtig. */
    displayName: text().notNull(),
    createdAt: createdAt(),
    premiumUntil: timestamp({ withTimezone: true }),
    coins: integer().notNull().default(0),
    /**
     * Edelsteine — die zweite Waehrung.
     *
     * Getrennt von den Muenzen, weil sie verschieden entstehen: Muenzen fallen
     * aus Truhen und Tagesaufgaben, Edelsteine nur aus Kauf oder Geschenk.
     * Waere es eine Spalte mit einem Kurs dazwischen, waere jede Truhe indirekt
     * eine Geldquelle — und der Kurs die einzige Zahl, die noch zaehlt.
     *
     * Beide Waehrungen sind ganzzahlig und laufen ueber src/waehrung.ts. Kein
     * Gleitkomma: Ein halber Edelstein ist nichts, was jemand erklaeren will.
     */
    gems: integer().notNull().default(0),
    /**
     * Erfahrungspunkte, spieluebergreifend. Die Stufe wird daraus gerechnet
     * und nicht gespeichert (src/level.ts): Sonst gaebe es zwei Wahrheiten,
     * und eine Aenderung an der Kurve muesste jede Zeile anfassen.
     */
    xp: integer().notNull().default(0),
    /**
     * Testkonto: hat alles, was man haben kann.
     *
     * Am KONTO und nicht an der Umgebung, weil es an beiden Orten gebraucht
     * wird: auf staging fuer alle, die dort ausprobieren, und in der
     * Produktion fuer das Demokonto, das App Store Connect verlangt - die
     * Pruefer muessen jede Funktion sehen koennen, ohne etwas zu kaufen.
     *
     * Gesetzt wird das Merkmal ausschliesslich ueber die Umgebungsvariable
     * STAFF_EMAILS beim Start (siehe src/staff.ts). Es gibt bewusst keinen
     * Weg, es aus der laufenden Anwendung heraus zu setzen: Ein Endpunkt, der
     * Rechte vergibt, ist der lohnendste Angriffspunkt einer jeden App.
     */
    isStaff: boolean().notNull().default(false),
    /**
     * Gewaehltes Kartenblatt. Reine Darstellung, deshalb bewusst nur eine
     * Kennung: Wie ein Deck aussieht, weiss allein der Client. Der Server
     * kennt die zulaessigen Kennungen (src/decks.ts), damit nichts Fremdes in
     * der Spalte landet, und sonst nichts.
     */
    cardDeck: text().notNull().default('text'),
    /**
     * Gewaehlte Tischszenerie — der Untergrund, auf dem gespielt wird.
     *
     * Persoenlich wie das Kartenblatt und nicht am Tisch: Sonst muesste
     * einer fuer alle entscheiden, und wer die Karten auf dunklem Grund
     * schlecht sieht, muesste damit leben. Wie beim Blatt kennt der Server
     * nur die zulaessigen Kennungen (src/scenes.ts), nicht ihr Aussehen.
     */
    tableScene: text().notNull().default('stube'),
    /**
     * Profilbild als data-URL (kleines, im Browser verkleinertes Quadrat).
     * Bewusst in der Zeile und nicht als Datei-Ablage: fuer die Beta ist das
     * einfach und ohne zusaetzlichen Dienst. Ausgeliefert wird es ueber
     * /api/avatars/:id, ueber die Leitung geht nur diese URL, nie die Bytes.
     */
    avatar: text(),
    /**
     * Bemalung der 3D-Figur — als Striche, nicht als Bild.
     *
     * `{ design, striche }` (siehe `packages/client/src/bemalung.ts`), roh als
     * Text. Bewusst KEIN fertiges PNG: Selbst in 512 x 512 waeren das hundert
     * Kilobyte je Konto, die bei jedem Laden des Profils mitkaemen. Ein
     * Strichzug sind ein paar Zahlen, und daraus entsteht das Bild jedes Mal
     * neu - auch wenn die Figur spaeter ein feineres Netz bekommt.
     *
     * Der Server prueft Form und Obergrenzen (src/bemalung.ts) und kennt
     * sonst nichts davon: Wie eine Farbe aussieht, weiss allein der Client -
     * dieselbe Trennung wie bei Blatt und Szenerie.
     *
     * null heisst: noch nie bemalt, es gilt die Standardoptik.
     */
    figurBemalung: text(),
    /**
     * Geburtstag (nur Kalendertag). Pflicht bei neuen Konten; aeltere Zeilen
     * koennen null sein, bis nachgepflegt. Fuer Countdown und Jaahresbelohnung.
     */
    birthday: date(),
    /** true, sobald das Geburtstags-Pinguin-Outfit mindestens einmal geholt wurde. */
    hasBirthdayOutfit: boolean().notNull().default(false),
    /**
     * Mememory: Zufallsgurt an?
     *
     * Ist er an, bekommt der Spieler in JEDER Partie drei andere Memes aus
     * seiner Sammlung — bis auf die Faecher, die er gesperrt hat (siehe
     * `mememory_sammlung.gesperrt`).
     *
     * Am KONTO und nicht am Geraet, anders als die Lautstaerke: Er gehoert
     * zur Sammlung, und wer seine Bilder rollen laesst, will das auf jedem
     * Geraet.
     */
    mememoryZufall: boolean().notNull().default(false),
    /** Kalenderjahr, in dem die Geburtstagsbelohnung zuletzt eingesammelt wurde. */
    birthdayRewardYear: integer(),
    anonymizedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('account_email_key').on(t.email),
    uniqueIndex('account_display_name_key').on(t.displayName),
  ],
);

/**
 * Ergaenzung zu Plan 6.2: Der Bestaetigungslink vor der ersten Anmeldung und
 * das Passwort-Zuruecksetzen (6.7) brauchen kurzlebige Token. Gespeichert wird
 * nur der Hash, damit ein Datenbankleck keine gueltigen Links liefert.
 */
export const authToken = pgTable(
  'auth_token',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    purpose: authTokenPurpose().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('auth_token_hash_key').on(t.tokenHash),
    index('auth_token_account_idx').on(t.accountId),
  ],
);

/**
 * Anmeldesitzungen. Ergaenzung zu Plan 6.2.
 *
 * Bewusst serverseitig statt als JWT: Eine Sitzung muss sofort widerrufbar
 * sein. Kontoloeschung waehrend laufender Partie und Sperren aus der Moderation
 * verlangen genau das, ein ausgestelltes Token kann man nicht zurueckholen.
 *
 * Im Cookie steht ein Zufallswert, hier liegt nur dessen Hash.
 */
export const session = pgTable(
  'session',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('session_token_key').on(t.tokenHash),
    index('session_account_idx').on(t.accountId),
  ],
);

/** Rangliste je Spiel. Die Gesamtliste ist die Summe ueber alle Zeilen. */
export const accountGameStat = pgTable(
  'account_game_stat',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    /** Startwert 0, Untergrenze 0. */
    trophies: integer().notNull().default(0),
    /** Hoechster erreichter Checkpoint, schuetzt gegen Absturz. */
    highestCheckpoint: integer().notNull().default(0),
    parties: integer().notNull().default(0),
    wins: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.gameId] }),
    index('account_game_stat_ranking_idx').on(t.gameId, t.trophies),
  ],
);

/**
 * Aussehen je Spiel: Kartenblatt und Tischszenerie.
 *
 * Je Spiel und nicht je Konto, weil ein Blatt nur zu seinem Spiel passt —
 * ein Doppelkopfblatt hat keine Acht, ein Rommeblatt zwei Joker. Wer beides
 * spielt, will nicht bei jedem Wechsel neu waehlen.
 *
 * Fehlt eine Zeile, gelten die Vorgaben aus decks.ts und scenes.ts. Es wird
 * also nichts angelegt, solange niemand etwas umstellt.
 *
 * Die alten Spalten account.card_deck und account.table_scene sind beim
 * Anlegen dieser Tabelle nach 'doppelkopf' uebernommen worden und werden
 * nicht mehr gelesen. Sie stehen bewusst noch da: Faellt ein Deploy zurueck,
 * laeuft die vorige Fassung damit weiter. Sie duerfen weg, sobald dieser
 * Stand eine Weile stabil laeuft.
 */
export const accountGameTheme = pgTable(
  'account_game_theme',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    cardDeck: text().notNull().default('text'),
    tableScene: text().notNull().default('stube'),
    /**
     * Rueckseite der Karten — bewusst getrennt vom Blatt.
     *
     * Die Rueckseite ist das, was alle am Tisch sehen; die Vorderseiten
     * sieht nur die eigene Hand. Wer eine schoene Rueckseite kauft, will sie
     * herzeigen, ohne dafuer sein gewohntes Blatt aufzugeben.
     *
     * `standard` heisst: die Rueckseite des gewaehlten Blattes.
     */
    cardBack: text().notNull().default('standard'),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.gameId] })],
);

// ---------------------------------------------------------------------------
// Truhen, Tagesaufgaben, Kosmetik
// ---------------------------------------------------------------------------

/**
 * Gradstufen einer Truhe.
 *
 * Als Enum und nicht als Text, anders als `game_id`: Ein neuer Grad ist keine
 * neue Datei, sondern eine Aenderung an der Oekonomie — die soll auffallen und
 * durch eine Migration gehen.
 */
export const chestGrade = pgEnum('chest_grade', [
  'holz',
  'bronze',
  'silber',
  'gold',
  'diamant',
]);

/**
 * Geoeffnete Truhen.
 *
 * Die Zeile ist Beweis und Ergebnis in einem: Sie verhindert das zweite
 * Oeffnen (Primaerschluessel) und haelt fest, was dabei herauskam. Der Inhalt
 * MUSS gespeichert werden — sonst wuerde jede Anzeige neu wuerfeln, und
 * derselbe Fund saehe bei jedem Laden anders aus.
 *
 * `chest_id` traegt bei Tagestruhen den Kalendertag (`tag-2026-08-04`), bei
 * Stufentruhen die Stufe (`stufe-5`). Damit ist die Sperre gegen das zweite
 * Oeffnen derselbe Mechanismus fuer beide Arten, und die Truhen von gestern
 * bleiben als Verlauf stehen.
 */
export const chestClaim = pgTable(
  'chest_claim',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    chestId: text().notNull(),
    grade: chestGrade().notNull(),
    /** Was tatsaechlich gutgeschrieben wurde, nicht die Spanne. */
    coins: integer().notNull(),
    claimedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.chestId] }),
    index('chest_claim_account_idx').on(t.accountId, t.claimedAt),
  ],
);

/**
 * Fortschritt der Tagesaufgaben.
 *
 * Je Konto, Aufgabe und Kalendertag. Der Tag steht als Spalte und nicht als
 * "wird nachts geloescht": Ein naechtlicher Aufraeumlauf, der ausfaellt,
 * verschenkt Belohnungen doppelt — eine Zeile mit Datum kann das nicht.
 *
 * Gezaehlt wird in Europe/Berlin (src/birthday.ts), damit der Tag nicht je
 * nach Server-UTC um Mitternacht falsch kippt.
 */
export const questProgress = pgTable(
  'quest_progress',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    questId: text().notNull(),
    /** Kalendertag in Europe/Berlin. */
    day: date().notNull(),
    progress: integer().notNull().default(0),
    /** Gesetzt, sobald die Belohnung abgeholt ist. Verhindert das zweite Mal. */
    claimedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.questId, t.day] }),
    index('quest_progress_tag_idx').on(t.accountId, t.day),
  ],
);

/**
 * Pro-Subway: Hub-Muenzen, die heute schon aus dem Runner kamen.
 *
 * Kalendertag in Europe/Berlin (wie bei quest_progress). Ohne diese Kappe
 * koennte ein Client den Cashout beliebig oft aufrufen.
 */
export const runnerDay = pgTable(
  'runner_day',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    /** Kalendertag in Europe/Berlin. */
    day: date().notNull(),
    coins: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.day] }),
    index('runner_day_tag_idx').on(t.accountId, t.day),
  ],
);

/**
 * Pro-Subway: der beste Lauf des Tages je Konto — die Tagesrangliste.
 *
 * Eine Zeile je Konto und Tag, ueberschrieben nur von einem besseren Lauf.
 * Meter und Muenzen gehoeren zum BESTEN Lauf und sind keine getrennten
 * Maxima — sonst stuende da ein Lauf, den es nie gab.
 *
 * Taeglich statt ewig, aus demselben Grund wie das Muenz-Tageslimit: Eine
 * ewige Liste gehoert dem, der einmal einen guten Tag hatte; eine
 * Tagesliste gehoert dem, der heute laeuft.
 */
export const runnerBest = pgTable(
  'runner_best',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    /** Kalendertag in Europe/Berlin. */
    day: date().notNull(),
    punkte: integer().notNull().default(0),
    meter: integer().notNull().default(0),
    muenzen: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.day] }),
    /** Fuer die Tagesliste: ein Tag, sortiert nach Punkten. */
    index('runner_best_tag_idx').on(t.day, t.punkte),
  ],
);

/**
 * Besitz an Kosmetik (Pinguin-Ausstattung).
 *
 * Nur die Kennung, kein Preis und kein Aussehen: Was ein Stueck kostet, steht
 * im Katalog (src/kosmetik.ts) und darf sich aendern, ohne dass alte Zeilen
 * unstimmig werden. Wie es aussieht, weiss allein der Client — dieselbe
 * Trennung wie bei Kartenblatt und Szenerie.
 *
 * Es gibt bewusst keine Zeile fuer "gehoert allen": Freie Stuecke (Preis 0)
 * kann jeder anlegen, ohne dass fuer jedes Konto Zeilen entstehen. Der Besitz
 * wird deshalb immer ueber den Katalog gefragt, nie allein ueber diese Tabelle.
 */
export const accountCosmetic = pgTable(
  'account_cosmetic',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    itemId: text().notNull(),
    acquiredAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.itemId] })],
);

/**
 * Was der Pinguin gerade traegt: je Platz ein Stueck.
 *
 * Eine Zeile je belegtem Platz statt fuenf Spalten. Ein sechster Platz ist
 * damit ein Eintrag im Katalog und keine Migration — und ein leerer Platz ist
 * schlicht keine Zeile, nicht ein `null`, das man ueberall mitpruefen muesste.
 */
export const accountAvatar = pgTable(
  'account_avatar',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    /** Kennung aus SLOTS in src/kosmetik.ts. */
    slot: text().notNull(),
    itemId: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.slot] })],
);

/** Dauerhaft und aggregiert, damit Premium-Statistiken lange zurueckreichen. */
export const statCounter = pgTable(
  'stat_counter',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    key: text().notNull(),
    value: bigint({ mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.gameId, t.key] })],
);

export const inviteCode = pgTable('invite_code', {
  code: text().primaryKey(),
  maxUses: integer().notNull(),
  uses: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});

/** Abstimmung, welches Vorschau-Spiel als naechstes kommt (Plan 4). */
export const gameVote = pgTable(
  'game_vote',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.gameId] })],
);

// ---------------------------------------------------------------------------
// Clans (Tabellen heissen club_* — historische Kennung)
// ---------------------------------------------------------------------------

export const club = pgTable(
  'club',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    adminAccountId: uuid()
      .notNull()
      .references(() => account.id),
    /**
     * Zeigt auf eine Regelsatz-Familie, nicht auf eine feste Version: ein
     * Verein soll seine Vorgabe aendern koennen, ohne dass laufende Tische
     * ihre Regeln wechseln. Deshalb bewusst ohne Fremdschluessel, denn
     * rule_set ist ueber (id, version) verschluesselt.
     */
    defaultRuleSetId: uuid(),
    joinMode: clubJoinMode().notNull().default('on_request'),
    minTrophies: integer().notNull().default(0),
    maxMembers: integer().notNull().default(50),
    /**
     * Wappen als Kennung aus einem festen Satz ("wappen-3"), nicht als
     * hochgeladenes Bild. Ein Upload braucht Moderation — ein Vereinswappen
     * ist genau die Stelle, an der jemand ein Hakenkreuz hochlaedt.
     */
    crest: text().notNull().default('wappen-1'),
    /** Ein Satz zur Vorstellung in der Clanliste. Keine Formatierung. */
    motto: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('club_name_key').on(t.name)],
);

/**
 * Beitrittsanfragen fuer `join_mode = 'on_request'`.
 *
 * Bewusst eine eigene Tabelle statt einer Rolle "bewerber" in club_member:
 * Ein Bewerber ist kein Mitglied, und jede Abfrage, die Mitglieder zaehlt
 * oder Clantische freigibt, muesste ihn sonst eigens ausschliessen. Wird die
 * Anfrage angenommen, verschwindet die Zeile und eine club_member-Zeile
 * entsteht.
 */
export const clubJoinRequest = pgTable(
  'club_join_request',
  {
    clubId: uuid()
      .notNull()
      .references(() => club.id, { onDelete: 'cascade' }),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.accountId] })],
);

export const clubMember = pgTable(
  'club_member',
  {
    clubId: uuid()
      .notNull()
      .references(() => club.id, { onDelete: 'cascade' }),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    role: clubRole().notNull().default('member'),
    joinedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.accountId] })],
);

/**
 * Clanchat.
 *
 * `accountId` ist bei Systemmeldungen leer (Beitritt, Kriegsergebnis) — die
 * schreibt der Server selbst, und niemand soll sie einem Mitglied zuordnen
 * koennen. `kind` unterscheidet die beiden Sorten, damit der Client sie
 * verschieden darstellt, ohne den Text auszuwerten.
 *
 * Geloeschte Nachrichten werden nicht entfernt, sondern mit `deletedAt`
 * versehen: So bleibt die Reihenfolge stabil, und die Leitung kann eine
 * Loeschung nicht als Zensur bestreiten.
 */
export const clubMessageKind = pgEnum('club_message_kind', ['text', 'system']);

export const clubMessage = pgTable(
  'club_message',
  {
    id: uuid().primaryKey().defaultRandom(),
    clubId: uuid()
      .notNull()
      .references(() => club.id, { onDelete: 'cascade' }),
    /** Leer bei Systemmeldungen. */
    accountId: uuid().references(() => account.id, { onDelete: 'set null' }),
    kind: clubMessageKind().notNull().default('text'),
    body: text().notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('club_message_club_idx').on(t.clubId, t.createdAt)],
);

/**
 * Clankrieg: zwei Clans, achtundvierzig Stunden, Punkte aus echten Partien.
 *
 * `clubB` ist leer, solange der Krieg in der Suche haengt. Beide Seiten
 * stehen bewusst in EINER Zeile und nicht als zwei Teilnehmerzeilen: Ein
 * Krieg hat genau zwei Seiten, und ein Stand ohne Gegenstand waere keiner.
 */
export const clubWar = pgTable(
  'club_war',
  {
    id: uuid().primaryKey().defaultRandom(),
    clubAId: uuid()
      .notNull()
      .references(() => club.id, { onDelete: 'cascade' }),
    /** Leer, solange gesucht wird. */
    clubBId: uuid().references(() => club.id, { onDelete: 'cascade' }),
    status: clubWarStatus().notNull().default('suche'),
    scoreA: integer().notNull().default(0),
    scoreB: integer().notNull().default(0),
    /** Gesetzt, sobald ein Gegner feststeht. */
    startedAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('club_war_a_idx').on(t.clubAId, t.status),
    index('club_war_b_idx').on(t.clubBId, t.status),
  ],
);

/**
 * Beitrag eines Mitglieds zu einem Krieg.
 *
 * Traegt den Deckel: `games` zaehlt die gewerteten Partien, und ab dem
 * Hoechstwert bringt eine weitere Partie nichts mehr. Ohne diese Zeile
 * muesste dafuer jede Partie des Kriegs nachgezaehlt werden.
 */
export const clubWarScore = pgTable(
  'club_war_score',
  {
    warId: uuid()
      .notNull()
      .references(() => clubWar.id, { onDelete: 'cascade' }),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    /** Fuer welche Seite gezaehlt wurde. Ein Clanwechsel mitten im Krieg
        soll die schon erspielten Punkte nicht umhaengen. */
    clubId: uuid()
      .notNull()
      .references(() => club.id, { onDelete: 'cascade' }),
    points: integer().notNull().default(0),
    games: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.warId, t.accountId] })],
);

// ---------------------------------------------------------------------------
// Regelsaetze
// ---------------------------------------------------------------------------

/**
 * Versioniert ueber (id, version). Aeltere Versionen bleiben unveraendert
 * bestehen, damit eine spaetere Aenderung abgeschlossene Partien nicht
 * umdeutet. `config` ist spielabhaengig und wird vom Server nie ausgewertet,
 * sondern nur an GameModule.validateConfig durchgereicht.
 */
export const ruleSet = pgTable(
  'rule_set',
  {
    id: uuid().notNull().defaultRandom(),
    version: integer().notNull().default(1),
    gameId: gameId(),
    ownerAccountId: uuid().references(() => account.id, {
      onDelete: 'set null',
    }),
    clubId: uuid().references(() => club.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    config: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.version] }),
    index('rule_set_owner_idx').on(t.ownerAccountId, t.gameId),
    index('rule_set_club_idx').on(t.clubId, t.gameId),
  ],
);

// ---------------------------------------------------------------------------
// Tische und Partien
// ---------------------------------------------------------------------------

export const gameTable = pgTable(
  'table_',
  {
    id: uuid().primaryKey().defaultRandom(),
    gameId: gameId(),
    ruleSetId: uuid().notNull(),
    /** Feste Version, damit spaetere Regelaenderungen den Tisch nicht treffen. */
    ruleSetVersion: integer().notNull(),
    visibility: tableVisibility().notNull().default('public'),
    clubId: uuid().references(() => club.id, { onDelete: 'cascade' }),
    status: tableStatus().notNull().default('waiting'),
    seats: integer().notNull(),
    /** Oeffentlich und privat hoechstens 20, Clantisch hoechstens 100. */
    maxRounds: integer().notNull(),
    createdAt: createdAt(),
    /** Ein Tisch ohne Aktivitaet verfaellt nach 24 Stunden. */
    lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /**
     * Clantische duerfen pausieren: Solange gesetzt, laufen keine Zugtimer
     * und der Tisch verfaellt nicht nach 24 Stunden. Oeffentliche Tische
     * setzen das Feld nie.
     */
    pausedAt: timestamp({ withTimezone: true }),
    /**
     * Lobby-Filter. Welche Filter es gibt, liefert das Spielmodul, nicht eine
     * feste Verdrahtung im Server. Deshalb jsonb.
     */
    filters: jsonb().notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    foreignKey({
      columns: [t.ruleSetId, t.ruleSetVersion],
      foreignColumns: [ruleSet.id, ruleSet.version],
      name: 'table_rule_set_fk',
    }),
    index('table_lobby_idx').on(t.gameId, t.status, t.visibility),
    index('table_activity_idx').on(t.lastActivityAt),
  ],
);

export const tableSeat = pgTable(
  'table_seat',
  {
    tableId: uuid()
      .notNull()
      .references(() => gameTable.id, { onDelete: 'cascade' }),
    seatIndex: integer().notNull(),
    /** Null bei freiem Platz. Bei Bot-Uebernahme bleibt das Konto stehen. */
    accountId: uuid().references(() => account.id, { onDelete: 'set null' }),
    /** Bot-Uebernahme ist fuer alle sichtbar. */
    isBot: boolean().notNull().default(false),
    joinedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.tableId, t.seatIndex] }),
    index('table_seat_account_idx').on(t.accountId),
  ],
);

export const party = pgTable(
  'party',
  {
    id: uuid().primaryKey().defaultRandom(),
    tableId: uuid()
      .notNull()
      .references(() => gameTable.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    /** Bestimmt jedes Geben. Gleicher Seed ergibt dieselbe Partie. */
    seed: bigint({ mode: 'number' }).notNull(),
    rounds: integer().notNull(),
    status: partyStatus().notNull().default('running'),
    startedAt: createdAt(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('party_table_idx').on(t.tableId)],
);

/**
 * Der Server haelt die laufende Partie massgeblich im Arbeitsspeicher und
 * schreibt nach jeder Aktion hierher. Railway startet den Container bei jedem
 * Deploy neu; reiner Arbeitsspeicher wuerde alle laufenden Tische verwerfen.
 *
 * Eine Zeile je Partie, `revision` zaehlt hoch. Der Client verwirft anhand
 * dieser Nummer veraltete Nachrichten.
 *
 * Aufbewahrung: nur die letzten 20 Partien je Account.
 */
export const partySnapshot = pgTable('party_snapshot', {
  partyId: uuid()
    .primaryKey()
    .references(() => party.id, { onDelete: 'cascade' }),
  revision: integer().notNull().default(0),
  /** Ergebnis von GameModule.serialize. Inhalt ist fuer den Server opak. */
  state: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Speichert bewusst nur jsonb: Die Struktur einer Runde ist spielabhaengig,
 * der Server darf sie nicht kennen.
 */
export const roundSummary = pgTable(
  'round_summary',
  {
    partyId: uuid()
      .notNull()
      .references(() => party.id, { onDelete: 'cascade' }),
    roundIndex: integer().notNull(),
    summary: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.partyId, t.roundIndex] })],
);

// ---------------------------------------------------------------------------
// Trophaeen
// ---------------------------------------------------------------------------

/**
 * Dauerhaft. Trophaeen entstehen aus der Platzierung ueber die gesamte Partie,
 * nie aus Spielpunkten, und sind deshalb regelunabhaengig.
 */
export const trophyLedger = pgTable(
  'trophy_ledger',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    partyId: uuid().references(() => party.id, { onDelete: 'set null' }),
    delta: integer().notNull(),
    reason: trophyReason().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('trophy_ledger_account_idx').on(t.accountId, t.gameId)],
);

// ---------------------------------------------------------------------------
// Soziales und Moderation
// ---------------------------------------------------------------------------

export const friendship = pgTable(
  'friendship',
  {
    /** Der Anfragende. Richtung bleibt erhalten, solange status = pending. */
    accountA: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    accountB: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    status: friendshipStatus().notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.accountA, t.accountB] }),
    index('friendship_b_idx').on(t.accountB),
  ],
);

/** Blockierte Spieler werden nur an oeffentlichen Tischen ausgeschlossen. */
export const block = pgTable(
  'block',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    blockedAccountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.blockedAccountId] })],
);

/**
 * Schlank und laenger aufbewahrt, ausschliesslich fuer Absprache-Erkennung.
 * Konvention: accountA < accountB als Text, damit ein Paar genau eine
 * Schreibweise hat und die Haeufigkeitsabfrage ohne OR auskommt.
 */
export const pairingLog = pgTable(
  'pairing_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountA: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    accountB: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    partyId: uuid().references(() => party.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('pairing_log_pair_idx').on(t.accountA, t.accountB, t.createdAt)],
);

export const report = pgTable(
  'report',
  {
    id: uuid().primaryKey().defaultRandom(),
    reporterId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    targetId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    reason: text().notNull(),
    freeText: text(),
    createdAt: createdAt(),
  },
  (t) => [index('report_target_idx').on(t.targetId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Kaeufe
// ---------------------------------------------------------------------------

/**
 * Der Anspruch wird serverseitig gefuehrt, damit ein im Web gekauftes Abo auch
 * auf dem iPhone gilt. `amountCents` ist ganzzahlig, nie Gleitkomma.
 */
export const purchase = pgTable(
  'purchase',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    sku: text().notNull(),
    provider: purchaseProvider().notNull(),
    amountCents: integer().notNull(),
    currency: text().notNull().default('EUR'),
    createdAt: createdAt(),
  },
  (t) => [index('purchase_account_idx').on(t.accountId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Diagnose
// ---------------------------------------------------------------------------

/**
 * Mitschnitt einer Feldherr-Netzpartie (docs/FELDHERR-DIAGNOSE.md).
 *
 * Feldherr wird auf dem Produktivsystem strittig und in keiner Testfassung.
 * Ein Fehler, der nur auf fremden Geraeten, fremden Browsern und echten
 * Funkstrecken auftritt, laesst sich nicht nachstellen — er muss
 * aufgezeichnet werden, waehrend er passiert. Jede Zeile ist eine Portion
 * Mitschnitt EINES Geraets; die Auswertung stellt aus den Portionen beider
 * Sitze den Vergleich her, und genau der zeigt, wo die Laeufe auseinander
 * gingen.
 *
 * `rumpf` ist bewusst `jsonb` und ungeprueft: Was drinsteht, entscheidet
 * der Client, und ein Schema hier wuerde bei jedem neuen Verdacht eine
 * Migration verlangen — waehrend der Fehler weiter unbeobachtet auftritt.
 *
 * Die Zeilen verfallen (siehe `aufraeumen` in src/diagnose.ts). Ein
 * Mitschnitt ist ein Werkzeug, kein Bestand: Was aelter als zwei Wochen
 * ist, gehoert nicht mehr in die Datenbank eines Spiels.
 */
export const feldherrDiagnose = pgTable(
  'feldherr_diagnose',
  {
    id: uuid().primaryKey().defaultRandom(),
    /**
     * Wer gemeldet hat. `set null` und nicht `cascade`: Loescht jemand sein
     * Konto, bleibt der Mitschnitt als anonyme Messung brauchbar — er
     * beschreibt eine Partie, keinen Menschen.
     */
    accountId: uuid().references(() => account.id, { onDelete: 'set null' }),
    /** Tisch der Partie — der Schluessel, unter dem beide Sitze zusammenfinden. */
    tableId: uuid().references(() => gameTable.id, { onDelete: 'cascade' }),
    seat: integer().notNull(),
    /** Warum gesendet wurde: takt, strittig, ende, ausgang, tab, abschied. */
    grund: text().notNull(),
    /** Index des ersten Ereignisses dieser Portion — Luecken werden sichtbar. */
    abIndex: integer().notNull().default(0),
    rumpf: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    /** Die Auswertung liest immer "ein Tisch, in Reihenfolge". */
    index('feldherr_diagnose_tisch_idx').on(t.tableId, t.createdAt),
    /** Und der Abruf ohne Tisch liest "alles seit gestern". */
    index('feldherr_diagnose_zeit_idx').on(t.createdAt),
  ],
);

/**
 * Mememory: hochgeladene Motive und der Vorschlagskasten.
 *
 * Grundsatz 2 oben ("alles Spielabhaengige liegt in jsonb") gilt fuer den
 * SPIELZUSTAND — der Server darf nicht wissen, wie eine Partie aussieht.
 * Bilder sind kein Spielzustand, sondern Inhalt, und Inhalt braucht eine
 * Zeile, die man ansehen, freigeben und wieder loeschen kann. Dieselbe
 * Ueberlegung wie bei `feldherr_diagnose`: spielnah, aber kein Regelwissen.
 *
 * Warum Datenbank und nicht Datei unter public/: Railway baut bei jedem
 * Deploy ein frisches Abbild, und alles, was der laufende Dienst auf die
 * Platte schreibt, ist danach weg.
 */
export const mememoryMotiv = pgTable(
  'mememory_motiv',
  {
    /**
     * Die Kennung ist der Schluessel und zugleich der Vertrag zum Spielmodul
     * (siehe packages/game-mememory/src/motive.ts). Sie traegt den Vorsatz
     * `hoch-`, und daran allein erkennt der Client, ob er das Bild aus
     * `public/` oder ueber diesen Endpunkt holt — ohne einen zweiten Abruf.
     */
    kennung: text().primaryKey(),
    /** data-URL, im Browser auf ein Quadrat verkleinert. Wie account.avatar. */
    bild: text().notNull(),
    /** Freier Titel des Einreichenden. Nur Anzeige, nie Teil des Spiels. */
    titel: text(),
    /**
     * 'vorschlag' oder 'frei'. Abgelehnt heisst geloescht: Ein dritter
     * Zustand waere ein Bilderfriedhof, und ausgerechnet die Bilder, die
     * jemand abgelehnt hat, will man nicht aufheben.
     */
    status: text().notNull().default('vorschlag'),
    /**
     * Vorbereitung fuer eigene Packs. NULL ist der Grundtopf, den alle
     * sehen. Bekommt ein Motiv spaeter eine Pack-Kennung, filtert der
     * Katalogabruf danach — Tabelle, Endpunkte und Spielmodul bleiben, wie
     * sie sind.
     */
    pack: text(),
    /** `set null`: Loescht jemand sein Konto, bleibt sein Meme im Spiel. */
    eingereichtVon: uuid().references(() => account.id, { onDelete: 'set null' }),
    geprueftVon: uuid().references(() => account.id, { onDelete: 'set null' }),
    geprueftAm: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    /** Beide Listen fragen nach dem Zustand: der Katalog nach 'frei', der
        Vorschlagskasten nach 'vorschlag'. */
    index('mememory_motiv_status_idx').on(t.status),
  ],
);

/**
 * Mememory: die Sammlung eines Kontos und sein Emote-Gurt.
 *
 * Wer ein Motiv im Spiel einmal aufgedeckt hat, hat es gesammelt. Aus der
 * Sammlung waehlt man bis zu drei, die im Spiel als Reaktion fliegen.
 *
 * KEIN Fremdschluessel auf `mememory_motiv`: Die 88 Grundmotive stehen dort
 * nicht, sie liegen als Dateien im Client. Ein Fremdschluessel schloesse
 * also die Haelfte der sammelbaren Bilder aus. Geprueft wird die FORM der
 * Kennung — ein erfundener Eintrag kostet den, der ihn schickt, ein leeres
 * Feld in der eigenen Sammlung und sonst nichts.
 */
export const mememorySammlung = pgTable(
  'mememory_sammlung',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    kennung: text().notNull(),
    /** 1, 2 oder 3 — der Gurt. NULL heisst: gesammelt, aber nicht dabei. */
    platz: smallint(),
    /**
     * Haelt dieses Fach beim Zufallsgurt fest.
     *
     * Nur sinnvoll zusammen mit einem `platz`: Der Gurt IST die Spalte
     * `platz`, ein Fach ohne Motiv gibt es nicht — also auch nichts, was ein
     * Schloss ohne Motiv festhalten koennte. Ohne Zufallsmodus steht die
     * Spalte still; sie kostet dann ein Byte je Zeile und keinen Gedanken.
     */
    gesperrt: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.kennung] }),
    /** Ein Konto vergibt denselben Platz nicht zweimal. Teilindex, damit die
        vielen NULL-Zeilen (nicht im Gurt) sich nicht gegenseitig sperren. */
    uniqueIndex('mememory_sammlung_platz_key')
      .on(t.accountId, t.platz)
      .where(sql`${t.platz} is not null`),
  ],
);

// ---------------------------------------------------------------------------
// Abgeleitete Typen
// ---------------------------------------------------------------------------

export type TableVisibility = (typeof tableVisibility.enumValues)[number];
export type TableStatus = (typeof tableStatus.enumValues)[number];
export type PartyStatus = (typeof partyStatus.enumValues)[number];
export type TrophyReason = (typeof trophyReason.enumValues)[number];

export type Account = typeof account.$inferSelect;
export type GameTable = typeof gameTable.$inferSelect;
export type TableSeat = typeof tableSeat.$inferSelect;
export type Party = typeof party.$inferSelect;

// ---------------------------------------------------------------------------
// Beziehungen
// ---------------------------------------------------------------------------

export const accountRelations = relations(account, ({ many }) => ({
  gameStats: many(accountGameStat),
  seats: many(tableSeat),
  trophyEntries: many(trophyLedger),
  clubMemberships: many(clubMember),
}));

export const gameTableRelations = relations(gameTable, ({ many, one }) => ({
  seats: many(tableSeat),
  parties: many(party),
  club: one(club, { fields: [gameTable.clubId], references: [club.id] }),
}));

export const partyRelations = relations(party, ({ one, many }) => ({
  table: one(gameTable, {
    fields: [party.tableId],
    references: [gameTable.id],
  }),
  snapshot: one(partySnapshot, {
    fields: [party.id],
    references: [partySnapshot.partyId],
  }),
  rounds: many(roundSummary),
}));

export const clubRelations = relations(club, ({ many, one }) => ({
  members: many(clubMember),
  joinRequests: many(clubJoinRequest),
  admin: one(account, {
    fields: [club.adminAccountId],
    references: [account.id],
  }),
}));
