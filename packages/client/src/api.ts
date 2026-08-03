/**
 * HTTP-Zugriff.
 *
 * Die Sitzung liegt in einem HttpOnly-Cookie; der Client sieht sie nie und
 * schickt sie nur mit. Fehler kommen als Schluessel zurueck und werden erst
 * beim Anzeigen uebersetzt.
 */

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
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      // NUR mit Rumpf. Ein leerer Rumpf mit dieser Kopfzeile ist fuer Fastify
      // ein Fehler ("Body cannot be empty when content-type is set to
      // application/json") - und traf damit jeden Aufruf ohne Daten:
      // beitreten, verlassen, abmelden, abstimmen.
      ...(init.body ? { 'content-type': 'application/json' } : {}),
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

export interface Me {
  id: string;
  displayName: string;
  coins: number;
  /** Gewaehltes Kartenblatt. Siehe decks.ts. */
  cardDeck: string;
  /** Gewaehlte Tischszenerie — persoenlich wie das Kartenblatt. */
  tableScene: string;
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

export const api = {
  register: (body: {
    email: string;
    password: string;
    displayName: string;
    inviteCode: string;
    birthday: string;
  }) => post<{ ok: true }>('/auth/register', body),

  verify: (token: string) => post<{ ok: true }>('/auth/verify', { token }),
  resendVerification: (email: string) =>
    post<{ ok: true }>('/auth/verification/resend', { email }),
  login: (email: string, password: string) => post<{ ok: true }>('/auth/login', { email, password }),
  logout: () => post<{ ok: true }>('/auth/logout'),
  me: () => request<Me>('/me'),
  setCardDeck: (cardDeck: string) => patch<{ ok: true }>('/me', { cardDeck }),
  setTableScene: (tableScene: string) => patch<{ ok: true }>('/me', { tableScene }),
  /** Profilbild setzen (data-URL) oder mit null entfernen. */
  setAvatar: (avatar: string | null) => patch<{ ok: true }>('/me', { avatar }),
  /** Geburtstags-Pinguin einsammeln (nur am Geburtstag). */
  claimBirthdayReward: () => post<{ ok: true; item: string }>('/me/birthday-reward'),
  /** Unumkehrbar. Das Passwort schuetzt vor dem offen liegengelassenen Geraet. */
  deleteMe: (password: string) =>
    request<{ ok: true }>('/me', { method: 'DELETE', body: JSON.stringify({ password }) }),

  games: () => request<GameSummary[]>('/games'),
  vote: (gameId: string) => post<{ ok: true }>(`/games/${gameId}/vote`),
  defaults: (gameId: string) => request<GameDefaults>(`/games/${gameId}/defaults`),

  tables: (gameId: string) => request<TableRow[]>(`/tables?game=${gameId}`),
  createTable: (body: {
    gameId: string;
    config: unknown;
    seats: number;
    rounds: number;
    visibility?: 'public' | 'on_request' | 'club_only';
    clubId?: string;
    fillWithBots?: boolean;
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
};
