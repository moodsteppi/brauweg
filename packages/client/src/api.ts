/**
 * HTTP-Zugriff.
 *
 * Die Sitzung liegt in einem HttpOnly-Cookie; der Client sieht sie nie und
 * schickt sie nur mit. Fehler kommen als Schluessel zurueck und werden erst
 * beim Anzeigen uebersetzt.
 *
 * In der iOS-Huelle geht das nicht — dort ist der Server eine fremde
 * Herkunft und bekommt kein Cookie. Sie traegt ihr Token selbst; siehe
 * `laufzeit.ts`. Im Browser bleibt alles wie bisher.
 */

import type { Bemalung } from './bemalung';
import type { BotLevel } from './protocol';
import { apiBase, inApp, sessionToken, setSessionToken } from './laufzeit';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly messageKey: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = sessionToken();
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    // In der App gibt es keine Cookies ueber die Herkunftsgrenze. `omit`
    // sagt das ausdruecklich, statt es dem Browser zu ueberlassen.
    credentials: inApp ? 'omit' : 'same-origin',
    headers: {
      // NUR mit Rumpf. Ein leerer Rumpf mit dieser Kopfzeile ist fuer Fastify
      // ein Fehler ("Body cannot be empty when content-type is set to
      // application/json") - und traf damit jeden Aufruf ohne Daten:
      // beitreten, verlassen, abmelden, abstimmen.
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      messageKey?: string;
    };
    throw new ApiError(
      body.code ?? 'internal',
      body.messageKey ?? 'error.internal',
      response.status,
    );
  }
  return (await response.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export interface GameSummary {
  id: string;
  nameKey: string;
  availability: 'playable' | 'preview';
  seatCounts: number[];
  votes: number;
}

export interface ActiveTable {
  tableId: string;
  gameId: string;
  status: 'waiting' | 'running';
  paused: boolean;
  visibility: string;
  maxRounds: number;
  seats: number;
}

/**
 * Die fuenf Plaetze der Pinguin-Ausstattung.
 *
 * Muss zu SLOTS in `packages/server/src/kosmetik.ts` passen. Der Server prueft
 * die Kennungen, das Aussehen kennt nur diese Seite — dieselbe Trennung wie bei
 * Kartenblatt und Szenerie.
 */
export const SLOTS = ['hut', 'brille', 'oberteil', 'schuhe', 'hand', 'aura'] as const;
export type Slot = (typeof SLOTS)[number];

/** Was der Pinguin traegt. Ein leerer Platz fehlt schlicht. */
export type Getragen = Partial<Record<Slot, string>>;

export interface Me {
  id: string;
  /**
   * Bemalung der 3D-Figur. `null` heißt: nie bemalt, es gilt die
   * Standardoptik. Der Server hat sie schon geprüft.
   */
  figur?: Bemalung | null;
  displayName: string;
  coins: number;
  /**
   * Edelsteine — die zweite Waehrung. Sie entstehen nur aus Kauf oder
   * Geschenk, nie aus Truhen: sonst waere jede Truhe eine Geldquelle.
   */
  gems: number;
  /**
   * BroJetons — Pokerchips. Gekauft gegen Münzen, eingesetzt am Tisch.
   * Zurück in Münzen gehen sie nicht.
   */
  broJetons: number;
  /** Was der Pinguin gerade traegt, je Platz. */
  avatar: Getragen;
  /**
   * Was bereitliegt: offene Truhen und fertige, noch nicht abgeholte Aufgaben.
   *
   * Nur die Zahlen — die Listen stehen an `/chests` und `/quests`. Sie treiben
   * den Punkt an der Truhe auf dem Startbildschirm.
   */
  bereit: { truhen: number; aufgaben: number };
  /**
   * Stufe und Fortschritt, fertig gerechnet vom Server.
   *
   * Bewusst nicht die Punkte allein: Die Kurve gehoert an eine Stelle, und
   * das ist der Server. Wird sie nachjustiert, gilt das sofort — der
   * Client zeigt nur an, was hier steht.
   */
  level: { stufe: number; xp: number; imLevel: number; fuerLevel: number };
  /**
   * Aussehen je Spiel: Kartenblatt und Tischszenerie.
   *
   * Je Spiel, weil ein Blatt nur zu seinem Spiel passt. Der Server liefert
   * immer alle bekannten Spiele mit, auch die noch nicht spielbaren —
   * sonst muesste der Client die Vorgaben ein zweites Mal pflegen.
   */
  themes: Record<string, { cardDeck: string; tableScene: string; cardBack: string }>;
  /** URL des eigenen Profilbilds, oder null. */
  avatarUrl: string | null;
  /** ISO-Kalendertag oder null bei Altkonten. */
  birthday: string | null;
  /** Tage bis zum naechsten Geburtstag; 0 = heute. */
  daysUntilBirthday: number | null;
  birthdayToday: boolean;
  birthdayRewardClaimable: boolean;
  /** Geburtstags-Pinguin schon mindestens einmal geholt. */
  hasBirthdayOutfit: boolean;
  stats: { gameId: string; trophies: number; parties: number; wins: number }[];
  clubs: { id: string; name: string }[];
  activeTable: ActiveTable | null;
  /**
   * Was dieses Konto darf. Kommt fertig vom Server — der Client rechnet
   * nichts aus Ablaufdaten aus, sonst gäbe es zwei Wahrheiten.
   */
  entitlements: {
    premium: boolean;
    unlimitedCoins: boolean;
    ownsEverything: boolean;
    /** Testkonto: hat alles. Wird dezent gekennzeichnet. */
    staff: boolean;
  };
  /** Welche Ausgabe läuft: `production`, `staging` oder `development`. */
  stage: 'production' | 'staging' | 'development';
}

export interface RankingEntry {
  rank: number;
  accountId: string;
  displayName: string;
  trophies: number;
  parties: number;
  wins: number;
  highestCheckpoint: number;
}

// ---------------------------------------------------------------------------
// Waehrungen, Truhen, Tagesaufgaben, Kosmetik
// ---------------------------------------------------------------------------

export type Waehrung = 'coins' | 'gems';
export type Guthaben = Waehrung | 'broJetons';

export type Grad = 'holz' | 'bronze' | 'silber' | 'gold' | 'diamant';

export interface Truhe {
  id: string;
  art: 'tag' | 'stufe';
  grad: Grad;
  /** Spanne, die drinsteckt. Sie wird angezeigt, damit nichts geraten wird. */
  von: number;
  bis: number;
  offen: boolean;
  geholt: boolean;
  /** Was drin war — erst gesetzt, wenn `geholt`. */
  coins: number | null;
  abStufe: number | null;
  fehltStufen: number | null;
}

export interface Truhen {
  tag: Truhe;
  stufen: Truhe[];
}

export interface Fund {
  chestId: string;
  grad: Grad;
  coins: number;
  /** Muenzstand nach der Gutschrift. */
  stand: number;
}

export interface Aufgabe {
  id: string;
  nameKey: string;
  hinweisKey: string;
  ziel: number;
  fortschritt: number;
  fertig: boolean;
  abgeholt: boolean;
  belohnung: { waehrung: Waehrung; betrag: number };
}

export interface Aufgaben {
  /** Kalendertag in Europe/Berlin, auf den sich der Fortschritt bezieht. */
  tag: string;
  aufgaben: Aufgabe[];
  /** Summe der fertigen, noch nicht abgeholten Belohnungen. */
  offeneBelohnung: number;
}

export type Seltenheit = 'gewoehnlich' | 'selten' | 'episch' | 'legendaer';

/** Was ein Stück kostet — in beiden Währungen, bezahlt wird mit einer. */
export interface Preis {
  coins: number;
  gems: number;
}

export interface RegalStueck {
  id: string;
  slot: Slot;
  nameKey: string;
  seltenheit: Seltenheit;
  /** 0 in beiden heißt: gehört allen. */
  preis: Preis;
  besessen: boolean;
  /** Nur zu bekommen, nicht zu kaufen (Geburtstagsoutfit). */
  geschenk: boolean;
}

export interface Paket {
  id: string;
  nameKey: string;
  gibt: { waehrung: Guthaben; betrag: number } | null;
  /** Anzeigepreis in ganzen Cent, oder null: kostet kein Geld. */
  cents: number | null;
  /** Preis in Edelsteinen, oder null: dafür nicht zu haben. */
  gems: number | null;
  /** Preis in Münzen, oder null — so kosten die BroJeton-Pakete. */
  coins: number | null;
  /** Aufschlag gegenüber dem kleinsten Paket, in Prozent. */
  bonus: number | null;
  /** Läuft der Kauf wirklich, oder ist es ein Schaufenster? */
  kaufbar: boolean;
}

/** Eine Truhe aus dem Shop. Die Spanne steht dran, gewürfelt wird beim Kauf. */
export interface Kauftruhe {
  id: string;
  grad: Grad;
  nameKey: string;
  gems: number;
  von: number;
  bis: number;
}

/**
 * Eine Szenerie oder ein Kartenblatt im Regal.
 *
 * `wert` ist die Kennung ohne Praefix — so heisst sie in den Themen-
 * Einstellungen. `id` traegt das Praefix und ist die Kennung fuer den Kauf.
 */
export type WareArt = 'szene' | 'blatt' | 'ruecken' | 'emote' | 'wappen' | 'klang' | 'musik';

export interface RegalWare {
  id: string;
  art: WareArt;
  wert: string;
  nameKey: string;
  seltenheit: string;
  /** Beide Preise — der Käufer wählt, wie bei der Kosmetik. */
  preis: Preis;
  besessen: boolean;
}

export interface Shop {
  paesse: Paket[];
  muenzpakete: Paket[];
  edelsteinpakete: Paket[];
  jetonpakete: Paket[];
  tischware: RegalWare[];
  truhen: Kauftruhe[];
  /** Münzen je Edelstein. Kommt vom Server, damit niemand falsch rechnet. */
  kurs: number;
  regale: { slot: Slot; stuecke: RegalStueck[] }[];
}

/** Was ein Paketkauf gebracht hat. */
export interface Paketkauf {
  paketId: string;
  bezahlt: number;
  gibt: { waehrung: Guthaben; betrag: number };
  stand: { coins: number; gems: number; broJetons: number };
}

/** Was in einer gekauften Truhe war. */
export interface Kauffund {
  chestId: string;
  truheId: string;
  grad: Grad;
  coins: number;
  bezahlt: number;
  stand: { coins: number; gems: number; broJetons: number };
}

export interface TableRow {
  id: string;
  gameId: string;
  seats: number;
  maxRounds: number;
  visibility: string;
  occupied: number;
  /** Anzeigename dessen, der den Tisch aufgemacht hat. Null nur bei Altlasten. */
  host: string | null;
  /** Wie viele Sonderregeln an sind. 0 heißt Grundspiel. */
  ruleCount: number;
  /** Buy-in und Blinds, oder null wenn der Tisch keine Chips kennt. */
  stakes: { startJetons: number; kleinerBlind: number; grosserBlind: number } | null;
}

export interface GameDefaults {
  config: Record<string, unknown>;
  protocolVersion: number;
  seatCounts: number[];
  rounds: Record<string, number[]>;
}

export interface PlayerRef {
  id: string;
  displayName: string;
}

export type Relationship = 'self' | 'friends' | 'incoming' | 'outgoing' | 'none';

export interface PlayerProfile {
  id: string;
  displayName: string;
  /** Jahr-Monat, mehr gibt ein fremdes Konto nicht preis. */
  memberSince: string;
  relationship: Relationship;
  ranking: {
    gameId: string;
    trophies: number;
    highestCheckpoint: number;
    parties: number;
    wins: number;
  }[];
  totals: { parties: number; wins: number; trophies: number };
}

export interface FriendLists {
  friends: PlayerRef[];
  incoming: PlayerRef[];
  outgoing: PlayerRef[];
}

// ---------------------------------------------------------------------------
// Clans
// ---------------------------------------------------------------------------

/** Auswaehlbare Wappen. Muss zu CRESTS im Server passen. */
export const WAPPEN = [
  'wappen-1',
  'wappen-2',
  'wappen-3',
  'wappen-4',
  'wappen-5',
  'wappen-6',
  'wappen-7',
  'wappen-8',
  // Zweiter Satz. Wappen kosten nichts: Das Zeichen eines Vereins soll nicht
  // daran haengen, ob sein Anfuehrer Muenzen uebrig hat.
  'wappen-9',
  'wappen-10',
  'wappen-11',
  'wappen-12',
  'wappen-13',
  'wappen-14',
  'wappen-15',
  'wappen-16',
  'wappen-17',
  'wappen-18',
] as const;

export type ClubRole = 'admin' | 'vize' | 'elder' | 'member' | 'guest';
export type JoinMode = 'open' | 'on_request';

export interface ClubSummary {
  id: string;
  name: string;
  crest: string;
  motto: string | null;
  joinMode: JoinMode;
  minTrophies: number;
  members: number;
  maxMembers: number;
  trophies: number;
}

export interface ClubMemberView {
  accountId: string;
  displayName: string;
  role: ClubRole;
  trophies: number;
  since: string;
  /** Ob ein eigenes Bild hinterlegt ist — sonst sitzt dort ein Pinguin. */
  hasAvatar: boolean;
}

export interface ClubDetail extends ClubSummary {
  /** `null`, wenn man nicht Mitglied ist. */
  myRole: ClubRole | null;
  memberList: ClubMemberView[];
  /** Nur beim Admin gefuellt. */
  requests: ClubMemberView[];
  defaultRuleSetId: string | null;
}

/**
 * Eine Zeile im Clanchat.
 *
 * `system` schreibt der Server selbst (Kriegsbeginn, Ergebnis) und traegt
 * kein Konto — daran erkennt der Client sie, ohne den Text zu deuten.
 */
export interface ChatMessage {
  id: string;
  kind: 'text' | 'system';
  accountId: string | null;
  displayName: string | null;
  hasAvatar: boolean;
  /** `null`, wenn geloescht. */
  body: string | null;
  deleted: boolean;
  createdAt: string;
}

export interface WarSide {
  clubId: string;
  name: string;
  crest: string;
  score: number;
}

export interface WarContributor {
  accountId: string;
  displayName: string;
  points: number;
  games: number;
}

export interface WarView {
  id: string;
  status: 'suche' | 'angefragt' | 'laeuft' | 'beendet' | 'abgesagt';
  wir: WarSide;
  gegner: WarSide | null;
  wirHabenGefordert: boolean;
  endsAt: string | null;
  ergebnis: 'wir' | 'gegner' | 'unentschieden' | null;
  beitraege: WarContributor[];
}

export interface WarState {
  aktuell: WarView | null;
  offeneAnfragen: WarView[];
  letzter: WarView | null;
  darfFuehren: boolean;
}

export const api = {
  register: (body: {
    email: string;
    password: string;
    displayName: string;
    birthday: string;
  }) => post<{ ok: true }>('/auth/register', body),

  /** Ob "Mit Google anmelden" auf dieser Ausgabe eingerichtet ist. */
  googleConfig: () => request<{ clientId: string | null }>('/auth/google/config'),
  /** Anmeldung mit dem ID-Token aus dem Google-Knopf. Cookie wie beim Login. */
  googleLogin: async (credential: string) => {
    const antwort = await post<{ ok: true; token?: string }>('/auth/google', {
      credential,
    });
    if (antwort.token) setSessionToken(antwort.token);
    return antwort;
  },

  verify: (token: string) => post<{ ok: true }>('/auth/verify', { token }),
  resendVerification: (email: string) =>
    post<{ ok: true }>('/auth/verification/resend', { email }),
  /**
   * Anmelden. Der Browser bekommt sein Cookie, die App zusaetzlich das
   * Token im Rumpf — sie hat keinen anderen Weg, ihre Sitzung zu halten.
   */
  login: async (email: string, password: string) => {
    const antwort = await post<{ ok: true; token?: string }>('/auth/login', {
      email,
      password,
    });
    if (antwort.token) setSessionToken(antwort.token);
    return antwort;
  },

  /**
   * Abmelden. Das Token faellt hier auch dann, wenn der Server nicht
   * erreichbar war: Wer sich abmeldet, will abgemeldet sein — und die
   * Sitzung laeuft serverseitig ohnehin ab.
   */
  logout: async () => {
    try {
      return await post<{ ok: true }>('/auth/logout');
    } finally {
      setSessionToken(null);
    }
  },
  me: () => request<Me>('/me'),
  /** Kartenblatt oder Szenerie eines Spiels setzen. */
  setTheme: (
    gameId: string,
    teil: { cardDeck?: string; tableScene?: string; cardBack?: string },
  ) =>
    patch<{ ok: true }>(`/me/themes/${gameId}`, teil),

  /** Die Bemalung der 3D-Figur speichern. Der Server prüft Form und Größe. */
  setFigur: (bemalung: Bemalung) =>
    patch<{ ok: true; figur: Bemalung }>('/me/figur', bemalung),
  /** Profilbild setzen (data-URL) oder mit null entfernen. */
  setAvatar: (avatar: string | null) => patch<{ ok: true }>('/me', { avatar }),
  /** Die Stufenleiter um den eigenen Stand herum. Nur beim Antippen geladen. */
  levels: () =>
    request<{
      stufe: number;
      xp: number;
      imLevel: number;
      fuerLevel: number;
      leiter: { stufe: number; ab: number; kosten: number; erreicht: boolean; aktuell: boolean }[];
    }>('/me/levels'),

  // --- Truhen ---------------------------------------------------------------

  /** Alle Truhen: die heutige und die Stufentruhen, auch die gesperrten. */
  chests: () => request<Truhen>('/chests'),
  /**
   * Truhe öffnen. Gewürfelt wird am Server, genau einmal — was zurückkommt,
   * steht danach fest.
   */
  openChest: (chestId: string) => post<Fund>(`/chests/${chestId}/open`),

  // --- Tagesaufgaben --------------------------------------------------------

  quests: () => request<Aufgaben>('/quests'),
  claimQuest: (questId: string) =>
    post<{ betrag: number; waehrung: Waehrung; stand: number }>(`/quests/${questId}/claim`),

  // --- Pro-Subway -----------------------------------------------------------

  /** Tagesstand: wie viele Hub-Münzen heute noch aus dem Runner kommen. */
  runnerToday: () =>
    request<{ verdient: number; restHeute: number; limitTag: number }>('/runner/today'),
  /**
   * Lauf beendet: Runner-Münzen (Anzahl Pickups) in Hub-Münzen umwandeln.
   * Server kappt pro Lauf und pro Tag.
   */
  runnerCashout: (coins: number) =>
    post<{
      gutgeschrieben: number;
      stand: number;
      restHeute: number;
      limitTag: number;
    }>('/runner/cashout', { coins }),
  /**
   * Lauf beendet — der eine Aufruf am Lebensende des Laufs: Münzen (mit
   * Kappen), Tagesaufgaben, Tagesbestwert und Platz in der Tagesliste.
   */
  runnerLauf: (lauf: { muenzen: number; punkte: number; meter: number }) =>
    post<{
      gutgeschrieben: number;
      stand: number;
      restHeute: number;
      limitTag: number;
      rangHeute: number;
    }>('/runner/lauf', lauf),
  /** Die heutige Tagesliste: beste zehn plus eigener Platz. */
  runnerRangliste: () =>
    request<{
      eintraege: {
        rang: number;
        displayName: string;
        punkte: number;
        meter: number;
        muenzen: number;
        du: boolean;
      }[];
      rang: number;
      punkte: number;
    }>('/runner/rangliste'),

  // --- Shop und Kleiderschrank ---------------------------------------------

  shop: () => request<Shop>('/shop'),
  /**
   * Kosmetik kaufen — gegen Münzen oder Edelsteine.
   *
   * Mit geht nur, **welche** Währung es sein soll. Der Betrag kommt vom Server;
   * ihn mitzuschicken wäre die Einladung, ihn zu ändern.
   */
  buyItem: (itemId: string, waehrung: Waehrung) =>
    post<{ itemId: string; bezahlt: number; waehrung: Waehrung; stand: number }>(
      `/shop/${itemId}/buy`,
      { waehrung },
    ),
  /** Ein Paket gegen Edelsteine kaufen — heute die drei Münzpakete. */
  buyPack: (paketId: string) => post<Paketkauf>(`/shop/pakete/${paketId}/buy`),
  /**
   * Eine Truhe gegen Edelsteine kaufen. Gekauft ist geöffnet: Was drin war,
   * steht in der Antwort, es gibt kein zweites Antippen.
   */
  buyChest: (truheId: string) => post<Kauffund>(`/shop/truhen/${truheId}/buy`),
  /** Ein Stück anziehen, oder mit `null` den Platz leer machen. */
  wear: (slot: Slot, itemId: string | null) =>
    patch<{ ok: true; avatar: Getragen }>('/me/avatar', { slot, itemId }),

  /** Geburtstags-Pinguin einsammeln (nur am Geburtstag). */
  /**
   * Feldherr meldet seinen Ausgang. Der Server deckelt je Tag; was
   * zurueckkommt, ist das tatsaechlich Gebuchte, nicht das Erhoffte.
   */

  claimBirthdayReward: () => post<{ ok: true; item: string }>('/me/birthday-reward'),
  /** Unumkehrbar. Das Passwort schuetzt vor dem offen liegengelassenen Geraet. */
  deleteMe: async (password: string) => {
    const antwort = await request<{ ok: true }>('/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    // Die Loeschung hat die Sitzung schon widerrufen. Bliebe das Token
    // liegen, liefe jeder Start in ein 401 statt auf die Anmeldung.
    setSessionToken(null);
    return antwort;
  },

  games: () => request<GameSummary[]>('/games'),
  vote: (gameId: string) => post<{ ok: true }>(`/games/${gameId}/vote`),
  defaults: (gameId: string) => request<GameDefaults>(`/games/${gameId}/defaults`),
  /**
   * Wie viele Menschen gerade in diesem einen Spiel stecken — suchend ODER
   * spielend. Die Tischliste kann das nicht beantworten: Sie zeigt nur Tische
   * im Zustand `waiting`.
   */
  aktiveSpieler: (gameId: string) => request<{ aktiv: number }>(`/games/${gameId}/aktiv`),
  /** Spieler an Tischen ueber alle Spiele — fuer die Kopfzeile des Homescreens. */
  aktiveGesamt: () => request<{ aktiv: number }>('/aktiv'),

  tables: (gameId: string) => request<TableRow[]>(`/tables?game=${gameId}`),
  createTable: (body: {
    gameId: string;
    config: unknown;
    seats: number;
    rounds: number;
    visibility?: 'public' | 'on_request' | 'club_only';
    clubId?: string;
    fillWithBots?: boolean;
    botLevel?: BotLevel;
  }) => post<{ id: string }>('/tables', body),
  joinTable: (id: string) => post<{ ok: true }>(`/tables/${id}/join`),
  leaveTable: (id: string) => post<{ ok: true }>(`/tables/${id}/leave`),
  pauseTable: (id: string) => post<{ ok: true }>(`/tables/${id}/pause`),
  resumeTable: (id: string) => post<{ ok: true }>(`/tables/${id}/resume`),
  /** Der festgeschriebene Regelsatz eines Tisches, zum Nachlesen am Tisch. */
  tableRules: (id: string) =>
    request<{ config: Record<string, unknown> }>(`/tables/${id}/rules`),

  ranking: (gameId: string) => request<RankingEntry[]>(`/rankings/${gameId}`),
  overallRanking: () => request<RankingEntry[]>('/rankings'),

  profile: (accountId: string) => request<PlayerProfile>(`/players/${accountId}`),
  searchPlayers: (q: string) => request<PlayerRef[]>(`/players?q=${encodeURIComponent(q)}`),
  friends: () => request<FriendLists>('/friends'),
  requestFriend: (accountId: string) =>
    post<{ status: 'pending' | 'accepted' }>(`/friends/${accountId}/request`),
  acceptFriend: (accountId: string) => post<{ ok: true }>(`/friends/${accountId}/accept`),
  removeFriend: (accountId: string) =>
    request<{ ok: true }>(`/friends/${accountId}`, { method: 'DELETE' }),

  /** Clanliste zum Beitreten, dazu die eigenen offenen Anfragen. */
  clubs: (search?: string) =>
    request<{ clubs: ClubSummary[]; pending: string[] }>(
      search ? `/clubs?search=${encodeURIComponent(search)}` : '/clubs',
    ),
  club: (clubId: string) => request<ClubDetail>(`/clubs/${clubId}`),
  createClub: (body: {
    name: string;
    crest: string;
    motto?: string | null;
    joinMode?: JoinMode;
    minTrophies?: number;
  }) => post<{ id: string }>('/clubs', body),
  updateClub: (
    clubId: string,
    body: {
      name?: string;
      crest?: string;
      motto?: string | null;
      joinMode?: JoinMode;
      minTrophies?: number;
    },
  ) => patch<{ ok: true }>(`/clubs/${clubId}`, body),
  joinClub: (clubId: string) =>
    post<{ status: 'joined' | 'requested' }>(`/clubs/${clubId}/join`),
  cancelClubRequest: (clubId: string) =>
    request<{ ok: true }>(`/clubs/${clubId}/join`, { method: 'DELETE' }),
  leaveClub: (clubId: string) =>
    request<{ ok: true }>(`/clubs/${clubId}/members/me`, { method: 'DELETE' }),
  acceptClubRequest: (clubId: string, accountId: string) =>
    post<{ ok: true }>(`/clubs/${clubId}/requests/${accountId}/accept`),
  rejectClubRequest: (clubId: string, accountId: string) =>
    post<{ ok: true }>(`/clubs/${clubId}/requests/${accountId}/reject`),
  setClubRole: (clubId: string, accountId: string, role: ClubRole) =>
    patch<{ ok: true }>(`/clubs/${clubId}/members/${accountId}`, { role }),
  kickClubMember: (clubId: string, accountId: string) =>
    request<{ ok: true }>(`/clubs/${clubId}/members/${accountId}`, { method: 'DELETE' }),

  /**
   * Clanchat. `seit` holt nur Neueres — der offene Chat fragt im
   * Sekundentakt nach, und die volle Seite bei jedem Abgleich waere
   * Verschwendung auf einer Mobilfunkleitung.
   */
  clubMessages: (clubId: string, seit?: string) =>
    request<{ messages: ChatMessage[] }>(
      seit
        ? `/clubs/${clubId}/messages?seit=${encodeURIComponent(seit)}`
        : `/clubs/${clubId}/messages`,
    ),
  postClubMessage: (clubId: string, body: string) =>
    post<ChatMessage>(`/clubs/${clubId}/messages`, { body }),
  deleteClubMessage: (clubId: string, messageId: string) =>
    request<{ ok: true }>(`/clubs/${clubId}/messages/${messageId}`, { method: 'DELETE' }),

  // --- Mememory: Vorschlagskasten -------------------------------------------

  /**
   * Die freigegebenen hochgeladenen Motive.
   *
   * `hochgeladen` sind NUR die freigegebenen Einsendungen. Genau diese
   * Liste wandert als `zusatz` in die Tisch-config, und das Spielmodul legt
   * sie zu seinem eigenen Katalog — sie ist der Teil, den das Modul beim
   * Bauen noch nicht kennen konnte.
   *
   * `grund` ist der feste Katalog des Moduls, durchgereicht vom Server. Er
   * gehoert NICHT in die `zusatz`-Liste (das Modul hat ihn schon) und dient
   * allein der Sammlungsseite: Sie zeigt auch, was noch fehlt, und braucht
   * dafuer den ganzen Topf.
   */
  mememoryMotive: () =>
    request<{ grund: string[]; hochgeladen: string[]; namen: Record<string, string> }>(
      '/mememory/motive',
    ),

  /**
   * Was das eigene Konto noch einreichen darf. `frei: null` heisst
   * unbegrenzt (Aufsicht). Der Stapel-Upload fragt das, bevor er
   * zuschneiden laesst.
   */
  mememoryEigene: () =>
    request<{ offen: number; frei: number | null; hoechstens: number }>('/mememory/eigene'),

  /**
   * Ein Bild einreichen. `direkt` wirkt nur bei der Aufsicht (der Server
   * prueft das nach) und stellt es sofort ins Spiel. `frei` ist der Rest,
   * den das Konto danach noch einreichen darf.
   */
  mememoryEinreichen: (bild: string, titel: string | null, direkt = false) =>
    post<{ kennung: string; status: 'vorschlag' | 'frei'; frei: number | null }>(
      '/mememory/vorschlaege',
      { bild, titel, direkt },
    ),

  /** Was im Kasten liegt, plus der freigegebene Bestand. Nur Aufsicht. */
  mememoryVorschlaege: () =>
    request<{
      vorschlaege: {
        kennung: string;
        titel: string | null;
        pack: string | null;
        bild: string;
        einreicher: string | null;
        eingereichtAm: string;
      }[];
      freigegeben: { kennung: string; titel: string | null; pack: string | null }[];
    }>('/mememory/vorschlaege'),

  /** Nur die Zahl fuer den Punkt am Briefkasten. Nur Aufsicht. */
  mememoryOffen: () => request<{ offen: number }>('/mememory/vorschlaege/anzahl'),

  mememoryFreigeben: (kennung: string) =>
    post<{ ok: true }>(`/mememory/vorschlaege/${kennung}/freigeben`),

  /**
   * Ein freigegebenes Motiv nachtraeglich aendern — Name, Zuschnitt oder
   * beides. Die Kennung bleibt, damit laufende Tische keine leere Karte
   * bekommen. Nur Aufsicht.
   */
  mememoryAendern: (kennung: string, aenderung: { titel?: string | null; bild?: string }) =>
    patch<{ ok: true }>(`/mememory/motive/${kennung}`, aenderung),

  // --- Mememory: Sammlung und Emote-Gurt ------------------------------------

  /**
   * Aufgedeckte Motive gutschreiben. Zurueck kommt, wie viele wirklich neu
   * waren — nur dafuer lohnt sich eine Anzeige.
   */
  mememoryGesehen: (kennungen: string[]) =>
    post<{ neu: number; gesamt: number }>('/mememory/sammlung', { kennungen }),

  /** Die eigene Sammlung samt Gurt (die drei fuer den Tisch). */
  mememorySammlung: () =>
    request<{
      gesammelt: { kennung: string; platz: number | null }[];
      gurt: string[];
      hoechstens: number;
    }>('/mememory/sammlung'),

  /** Den Gurt neu belegen. Die Liste ist die ganze Wahrheit. */
  mememoryGurt: (kennungen: string[]) =>
    request<{ gurt: string[] }>('/mememory/sammlung/gurt', {
      method: 'PUT',
      body: JSON.stringify({ kennungen }),
    }),

  /** Ablehnen und Herausnehmen sind derselbe Handgriff: die Zeile geht weg. */
  mememoryLoeschen: (kennung: string) =>
    request<{ ok: true }>(`/mememory/motive/${kennung}`, { method: 'DELETE' }),

  /** Clankrieg: Stand, Gegnersuche, Herausforderung. */
  clubWar: (clubId: string) => request<WarState>(`/clubs/${clubId}/war`),
  searchWar: (clubId: string) =>
    post<{ status: 'gepaart' | 'sucht' }>(`/clubs/${clubId}/war/search`),
  challengeWar: (clubId: string, gegnerId: string) =>
    post<{ ok: true }>(`/clubs/${clubId}/war/challenge`, { gegnerId }),
  acceptWar: (clubId: string, warId: string) =>
    post<{ ok: true }>(`/clubs/${clubId}/war/${warId}/accept`),
  cancelWar: (clubId: string, warId: string) =>
    request<{ ok: true }>(`/clubs/${clubId}/war/${warId}`, { method: 'DELETE' }),
};
