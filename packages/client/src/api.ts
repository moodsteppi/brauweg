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

export interface Me {
  id: string;
  displayName: string;
  coins: number;
  /** Gewaehltes Kartenblatt. Siehe decks.ts. */
  cardDeck: string;
  /** URL des eigenen Profilbilds, oder null. */
  avatarUrl: string | null;
  stats: { gameId: string; trophies: number; parties: number; wins: number }[];
}

export interface TableRow {
  id: string;
  gameId: string;
  seats: number;
  maxRounds: number;
  visibility: string;
  occupied: number;
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

export const api = {
  register: (body: {
    email: string;
    password: string;
    displayName: string;
    inviteCode: string;
  }) => post<{ ok: true }>('/auth/register', body),

  verify: (token: string) => post<{ ok: true }>('/auth/verify', { token }),
  resendVerification: (email: string) =>
    post<{ ok: true }>('/auth/verification/resend', { email }),
  login: (email: string, password: string) => post<{ ok: true }>('/auth/login', { email, password }),
  logout: () => post<{ ok: true }>('/auth/logout'),
  me: () => request<Me>('/me'),
  setCardDeck: (cardDeck: string) => patch<{ ok: true }>('/me', { cardDeck }),
  /** Profilbild setzen (data-URL) oder mit null entfernen. */
  setAvatar: (avatar: string | null) => patch<{ ok: true }>('/me', { avatar }),
  deleteMe: () => request<{ ok: true }>('/me', { method: 'DELETE' }),

  games: () => request<GameSummary[]>('/games'),
  vote: (gameId: string) => post<{ ok: true }>(`/games/${gameId}/vote`),
  defaults: (gameId: string) => request<GameDefaults>(`/games/${gameId}/defaults`),

  tables: (gameId: string) => request<TableRow[]>(`/tables?game=${gameId}`),
  createTable: (body: {
    gameId: string;
    config: unknown;
    seats: number;
    rounds: number;
    fillWithBots?: boolean;
  }) => post<{ id: string }>('/tables', body),
  joinTable: (id: string) => post<{ ok: true }>(`/tables/${id}/join`),
  leaveTable: (id: string) => post<{ ok: true }>(`/tables/${id}/leave`),
  /** Der festgeschriebene Regelsatz eines Tisches, zum Nachlesen am Tisch. */
  tableRules: (id: string) =>
    request<{ config: Record<string, unknown> }>(`/tables/${id}/rules`),

  profile: (accountId: string) => request<PlayerProfile>(`/players/${accountId}`),
  searchPlayers: (q: string) => request<PlayerRef[]>(`/players?q=${encodeURIComponent(q)}`),
  friends: () => request<FriendLists>('/friends'),
  requestFriend: (accountId: string) =>
    post<{ status: 'pending' | 'accepted' }>(`/friends/${accountId}/request`),
  acceptFriend: (accountId: string) => post<{ ok: true }>(`/friends/${accountId}/accept`),
  removeFriend: (accountId: string) =>
    request<{ ok: true }>(`/friends/${accountId}`, { method: 'DELETE' }),
};
