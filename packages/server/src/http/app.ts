/**
 * HTTP-Schnittstelle.
 *
 * Alles, was nicht am Tisch passiert: Konten, Spielauswahl, Regelsaetze,
 * Lobby. Der Tisch selbst laeuft ueber WebSocket, weil dort jeder Zug
 * unaufgefordert an alle muss.
 */

import { timingSafeEqual } from 'node:crypto';

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { and, eq, sql } from 'drizzle-orm';
import { ZodError, z } from 'zod';
import type { GameId } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { AppError, RuleSetInvalidError, badRequest, conflict, forbidden, notFound, unauthorized } from '../errors.js';
import { darfBenutzen } from '../tischware.js';
import { leseBemalung, pruefeBemalung } from '../bemalung.js';
import {
  type AuthDeps,
  anonymizeAccount,
  login,
  logout,
  register,
  requestPasswordReset,
  requestVerification,
  resetPassword,
  sessionFromToken,
  verifyEmail,
} from '../auth/service.js';
import { verifyPassword } from '../auth/secrets.js';
import {
  berlinToday,
  birthdayRewardClaimable,
  daysUntilBirthday,
  isBirthdayToday,
} from '../birthday.js';
import { CARD_BACKS, CARD_DECKS, DEFAULT_CARD_BACK, DEFAULT_CARD_DECK } from '../decks.js';
import { leiterUm, stufenstand } from '../level.js';
import { entitlementsFor } from '../entitlements.js';
import { WAEHRUNGEN, sichtbarerStand } from '../waehrung.js';
import { GEBURTSTAGS_OUTFIT, SLOTS, istSlot, schenken } from '../kosmetik.js';
import { anziehen, getragenVon, kaufen, paketKaufen, shopFuer } from '../shop.js';
import { offeneTruhen, truheKaufen, truheOeffnen, truhenFuer } from '../truhen.js';
import { aufgabeAbholen, aufgabenFuer, offeneBelohnungen } from '../quests.js';
import { runnerCashout, runnerLauf, runnerRangliste, runnerTagesstand } from '../runner.js';
import { TABLE_SCENES, DEFAULT_TABLE_SCENE } from '../scenes.js';
import { isPlayable, registry, requireModule } from '../games/registry.js';
import {
  acceptFriendship,
  listFriendships,
  playerProfile,
  removeFriendship,
  requestFriendship,
  searchPlayers,
} from '../social/service.js';
import {
  CRESTS,
  MOTTO_MAX,
  NAME_MAX,
  NAME_MIN,
  acceptJoinRequest,
  cancelJoinRequest,
  clubDetail,
  clubsFor,
  createClub,
  joinClub,
  kickMember,
  leaveClub,
  listClubs,
  pendingRequestsOf,
  rejectJoinRequest,
  releaseClubMemberships,
  requireClubMember,
  setMemberRole,
  updateClub,
} from '../clubs/service.js';
import {
  MAX_LAENGE,
  deleteMessage,
  listMessages,
  postMessage,
} from '../clubs/chat.js';
import {
  acceptWar,
  cancelWar,
  challengeWar,
  searchWar,
  warState,
} from '../clubs/war.js';
import { overallRanking, rankingForGame } from '../rankings/service.js';
import { lies, nimmAuf, uebersicht } from '../diagnose.js';
import {
  activeTableFor,
  createTable,
  joinTable,
  leaveLobby,
  listRuleSets,
  listTables,
  saveRuleSet,
  tableRules,
  tableWithSeats,
} from '../tables/service.js';
import type { PartyRuntime } from '../runtime/party.js';

export const SESSION_COOKIE = 'brauweg_session';

/**
 * Herkunft der iOS-Huelle.
 *
 * Die App laedt den Client aus dem eigenen Paket, ausgeliefert unter
 * `brauweg://app`. Fuer den Server ist das eine fremde Herkunft: Das
 * Sitzungs-Cookie waere ein Drittanbieter-Cookie, und WebKit verwirft die.
 * Deshalb bekommt die App ihr Sitzungstoken einmal beim Anmelden in die Hand
 * und schickt es danach selbst mit - im `Authorization`-Kopf, am WebSocket
 * als Unterprotokoll.
 *
 * Dass das Token ueberhaupt herausgegeben wird, haengt an genau dieser
 * Herkunft. Eine Kopfzeile koennte sich jede Seite selbst setzen; die
 * Herkunft setzt der Browser, und faelschen kann sie niemand von einer
 * Webseite aus. Fuer den Browser bleibt es deshalb beim HttpOnly-Cookie,
 * das kein Skript je zu sehen bekommt.
 */
export const APP_ORIGIN = 'brauweg://app';

export interface AppDeps {
  readonly db: Db;
  readonly auth: AuthDeps;
  readonly runtime: PartyRuntime;
  readonly cookieSecure: boolean;
  readonly sessionTtlDays: number;
  /** Verzeichnis des gebauten Clients. Fehlt es, liefert der Server nur die API. */
  readonly clientDir?: string;
  /**
   * Welche Ausgabe hier laeuft. Geht nur zur Kennzeichnung an den Client —
   * Rechte haengen am Konto, nicht an der Umgebung.
   */
  readonly stage?: 'production' | 'staging' | 'development';
  /**
   * Schluessel fuer den Abruf der Feldherr-Mitschnitte, aus
   * `DIAGNOSE_SCHLUESSEL`. Fehlt er, geht der Abruf ausschliesslich ueber
   * ein angemeldetes Testkonto — was der uebliche Weg ist. Der Schluessel
   * ist fuer den Fall gedacht, dass auf einer Ausgabe kein Testkonto
   * eingerichtet ist und man trotzdem an die Daten muss.
   */
  readonly diagnoseSchluessel?: string | null;
}

const gameIdSchema = z.enum([
  'doppelkopf',
  'wizard',
  'feldherr',
  'mememory',
  'skat',
  'schafkopf',
  'romme',
  'maumau',
  'schwimmen',
  'backgammon',
  'bauernskat',
  'werwolf',
  'cambio',
  'phase10',
  'drecksau',
]);

const registerSchema = z.object({
  email: z.string().email(),
  // Kurze Passwoerter sind das haeufigste Einfallstor. Zwoelf Zeichen ohne
  // Zeichenklassen-Zwang ist die heute empfohlene Vorgabe.
  password: z.string().min(12).max(200),
  displayName: z.string().min(2).max(30),
  inviteCode: z.string().min(1),
  /** Kalendertag YYYY-MM-DD — Mindestalter prueft der Auth-Service. */
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Portion eines Feldherr-Mitschnitts.
 *
 * Bewusst duenn: Geprueft wird nur, was der Server selbst braucht (Tisch,
 * Sitz, Anlass, Startindex). Der ganze Rumpf wird unveraendert abgelegt —
 * ein Schema ueber den Inhalt hiesse, dass jeder neue Verdacht erst eine
 * Migration braucht, waehrend der Fehler weiter unbeobachtet auftritt. Die
 * Groesse begrenzt BODY_LIMIT, die Haeufigkeit die Ratengrenze.
 */
const diagnoseSchema = z.object({
  grund: z.string().min(1).max(40),
  /** Index des ersten mitgeschickten Ereignisses; Luecken werden so sichtbar. */
  ab: z.number().int().min(0).max(50_000_000).optional(),
  kopf: z.object({
    tisch: z.string().max(64).optional(),
    /** -1 ist der Zuschauer; er zeichnet mit, sitzt aber nicht. */
    sitz: z.number().int().min(-1).max(7),
  }),
  ereignisse: z.array(z.unknown()).max(4000).optional(),
});

const createTableSchema = z.object({
  gameId: gameIdSchema,
  name: z.string().min(1).max(60).optional(),
  config: z.unknown(),
  seats: z.number().int().min(2).max(8),
  rounds: z.number().int().min(1).max(100),
  visibility: z.enum(['public', 'on_request', 'club_only']).optional(),
  clubId: z.string().uuid().optional(),
  fillWithBots: z.boolean().optional(),
  botLevel: z.enum(['anfaenger', 'standard', 'experte', 'genie']).optional(),
});

/**
 * Grenzen gegen Missbrauch.
 *
 * Ohne sie steht jede Anmeldung offen zum Durchprobieren, jede Mailadresse
 * zum Zuschuetten und jeder Endpunkt zum Fluten. Die Zahlen sind so gewaehlt,
 * dass ein Mensch sie im Alltag nie erreicht.
 */
/**
 * Anmelden, Registrieren, Mails anfordern.
 *
 * 30 Versuche je Viertelstunde: Ein ganzer Verein sitzt oft hinter einer
 * einzigen Adresse und muss sich reihum anmelden koennen. Zum Durchprobieren
 * von Passwoertern reicht es trotzdem nicht - zwei Versuche pro Minute, jeder
 * mit Argon2 belegt.
 */
const LIMIT_AUTH = { max: 30, timeWindow: '15 minutes' };
const LIMIT_SCHREIBEN = { max: 60, timeWindow: '1 minute' };
const LIMIT_ALLGEMEIN = { max: 300, timeWindow: '1 minute' };

/** Rumpfgrenze: Der groesste erlaubte Rumpf ist das Profilbild (~60 kB). */
const BODY_LIMIT = 128 * 1024;

/**
 * Prueft die ersten Bytes einer Bild-data-URL.
 *
 * Der angegebene Typ sagt nichts: Wer HTML als `image/png` hinterlegt,
 * bekaeme es unter unserer eigenen Herkunft ausgeliefert. Also wird
 * nachgesehen, ob wirklich PNG, JPEG oder WebP dahintersteht.
 */
function istEchtesBild(dataUrl: string): boolean {
  const komma = dataUrl.indexOf(',');
  if (komma < 0) return false;
  let kopf: Buffer;
  try {
    kopf = Buffer.from(dataUrl.slice(komma + 1, komma + 41), 'base64');
  } catch {
    return false;
  }
  if (kopf.length < 12) return false;
  const png = kopf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = kopf[0] === 0xff && kopf[1] === 0xd8 && kopf[2] === 0xff;
  const webp =
    kopf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    kopf.subarray(8, 12).toString('ascii') === 'WEBP';
  return png || jpeg || webp;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT });
  await app.register(cookie);

  // Sicherheits-Kopfzeilen. Ohne frame-ancestors laesst sich die Seite in
  // einen fremden Rahmen setzen und per Clickjacking bedienen; ohne CSP wird
  // aus jedem kuenftigen XSS sofort eine Sitzungsuebernahme.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        /**
         * `blob:` ist fuer die 3D-Figur noetig, und der Fehler war teuer zu
         * finden: Die Texturen stecken als JPEG **im** GLB. Der Lader von
         * three packt sie aus und laedt sie ueber eine `blob:`-Adresse — die
         * Richtlinie hat genau das geblockt. Ergebnis war ein schneeweisser
         * Pinguin, ohne dass an der Datei etwas falsch war: Sie kam mit 200
         * an, war gueltig, und `createImageBitmap` konnte sie von Hand auch
         * entpacken. Nur der Weg ueber `<img src="blob:…">` war zu.
         *
         * Auf dem Entwicklungsserver faellt das nie auf — dort gibt es diese
         * Kopfzeile gar nicht. **Was mit Bildern zu tun hat, gehoert am
         * ausgelieferten Stand geprueft.**
         *
         * `blob:` erlaubt nur Daten, die die Seite selbst erzeugt hat; es
         * oeffnet keine fremde Herkunft.
         */
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        /**
         * `blob:` gehoert dazu, und der Fehler war teuer.
         *
         * Der GLTF-Lader von three packt die Texturen aus dem GLB aus und
         * HOLT sie ueber eine `blob:`-Adresse — das ist ein `connect`, kein
         * `img`. Ohne diesen Eintrag blieb der Ritter in der 3D-Ansicht
         * ohne Textur, mit "Refused to connect" in der Konsole. Auf dem
         * Entwicklungsserver faellt das nie auf: Dort liefert Vite aus, und
         * Vite setzt gar keine Inhaltsrichtlinie.
         */
        connectSrc: ["'self'", 'ws:', 'wss:', 'blob:'],
        /**
         * DER Fehler, der Feldherr auf Produktion strittig gemacht hat —
         * und der in keiner Testfassung auftrat.
         *
         * Der Spielkern haelt den verdeckten Tab mit einem Web Worker am
         * Leben (`anbindung-fuss.js`): Dort feuert requestAnimationFrame
         * nicht, und ohne Antrieb steht der Kern still, pulst nicht mehr,
         * und die Partie friert auf BEIDEN Geraeten ein. Am Handy passiert
         * das bei jedem kurzen Blick woandershin.
         *
         * Der Worker entsteht aus einem Blob. Ohne `worker-src` faellt der
         * Browser auf `script-src` zurueck, und dort steht nur `'self'` —
         * der Worker wurde also auf JEDER Ausgabe blockiert, die den Client
         * ueber diesen Server ausliefert (Produktion und Staging), aber auf
         * KEINER Entwicklungsfassung, weil Vite keine Richtlinie setzt.
         * Genau das erklaert "in den Testversionen passiert es nie".
         *
         * Und es faellt nicht als Ausnahme auf: Ein verbotener Worker wirft
         * beim Erzeugen NICHT. `new Worker` liefert ein Objekt zurueck, das
         * schweigt; der Versuch/Fange-Zweig im Kern lief also nie.
         *
         * `blob:` heisst hier ausschliesslich "von dieser Seite selbst
         * erzeugt" — es oeffnet keine fremde Herkunft.
         */
        workerSrc: ["'self'", 'blob:'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // Die Seite laeuft ausschliesslich ueber HTTPS.
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
    crossOriginEmbedderPolicy: false,
  });

  /**
   * Herkunftsfreigabe - ausschliesslich fuer die iOS-Huelle.
   *
   * Der Browser bleibt same-origin (der Server liefert den Client selbst
   * aus), er braucht das hier nicht. Bewusst `credentials: false`: Die App
   * schickt ihr Token im Kopf, nicht als Cookie. Wer Cookies ueber die
   * Herkunftsgrenze erlaubt, oeffnet CSRF - genau das soll nicht passieren.
   */
  await app.register(cors, {
    origin: [APP_ORIGIN],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization'],
    credentials: false,
    maxAge: 86_400,
  });

  /**
   * Ratengrenzen.
   *
   * Bewusst global: Nur so haengt die Grenze an einem onRequest-Haken und
   * gilt fuer alle Routen, unabhaengig davon, wann sie angemeldet wurden.
   * Ohne global griffe sie nur fuer Routen, die NACH dem Plugin entstehen -
   * und das waere hier keine einzige. Die Grundgrenze ist grosszuegig
   * (ein ganzer Verein hinter einer Adresse), die scharfen Werte stehen an
   * den einzelnen Routen.
   */
  // Vor den Routen: Das Plugin haengt seine Grenzen beim Anmelden JEDER
  // Route an. Wird es erst danach geladen, sieht es keine einzige - genau
  // deshalb muss hier gewartet werden.
  await app.register(rateLimit, {
    global: true,
    max: 1200,
    timeWindow: '1 minute',
    // Hinter Railways Proxy ist die echte Adresse die erste in x-forwarded-for.
    keyGenerator: (request) => {
      const weiter = request.headers['x-forwarded-for'];
      const kette = Array.isArray(weiter) ? weiter[0] : weiter;
      return (kette?.split(',')[0]?.trim() || request.ip) ?? 'unbekannt';
    },
  });

  /**
   * Ein leerer Rumpf mit `content-type: application/json` ist fuer Fastify ein
   * Fehler. Fuer die Aufrufe ohne Daten - beitreten, verlassen, abmelden,
   * abstimmen - ist er aber das Naheliegende, und jeder Client schickt den
   * Kopf frueher oder spaeter versehentlich mit. Statt daran zu scheitern,
   * wird er als "keine Daten" gelesen; ob das reicht, entscheidet danach das
   * Schema der jeweiligen Route.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      const text = (body as string).trim();
      if (text === '') return done(null, undefined);
      try {
        done(null, JSON.parse(text));
      } catch (err) {
        // Ein roher SyntaxError traegt keinen Statuscode. Ohne ihn faellt er
        // in der Fehlerbehandlung an allen 4xx-Zweigen vorbei in den 500er -
        // samt console.error, das damit von gewoehnlichen Client-Fehlern
        // volllief. Mit 400 greift der bestehende Zweig, und der Aufrufer
        // bekommt 'invalidRequest' statt 'etwas ist schiefgelaufen'.
        (err as { statusCode?: number }).statusCode = 400;
        done(err as Error);
      }
    },
  );

  const setSession = (reply: FastifyReply, token: string): void => {
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: deps.cookieSecure,
      path: '/',
      maxAge: deps.sessionTtlDays * 24 * 3600,
    });
  };

  /**
   * Sitzungstoken einer Anfrage: erst das Cookie, dann der
   * `Authorization`-Kopf.
   *
   * Das Cookie bleibt der Weg des Browsers, weil es HttpOnly ist und ein
   * Skript es damit nie zu Gesicht bekommt. Den Kopf nutzt nur die
   * iOS-Huelle, die kein Cookie bekommen kann (siehe `APP_ORIGIN`).
   */
  const sessionToken = (request: FastifyRequest): string | undefined => {
    const ausCookie = request.cookies[SESSION_COOKIE];
    if (ausCookie) return ausCookie;

    const kopf = request.headers.authorization;
    if (!kopf) return undefined;
    const [art, wert] = kopf.split(' ');
    return art?.toLowerCase() === 'bearer' && wert ? wert : undefined;
  };

  /** Wirft, wenn niemand angemeldet ist. */
  const requireAccount = async (request: FastifyRequest): Promise<string> => {
    const session = await sessionFromToken(deps.db, sessionToken(request));
    if (!session) throw unauthorized();
    return session.accountId;
  };

  /**
   * Zugang zu den Mitschnitten (docs/FELDHERR-DIAGNOSE.md).
   *
   * Zwei Wege, und beide mit Absicht:
   *
   *   - **Angemeldetes Testkonto.** Der uebliche Weg. Das Merkmal kommt
   *     ausschliesslich aus `STAFF_EMAILS` beim Serverstart (siehe
   *     staff.ts) — es gibt keinen Endpunkt, ueber den man es sich selbst
   *     geben koennte.
   *   - **Schluessel im Kopf.** Fuer den Fall, dass auf einer Ausgabe kein
   *     Testkonto eingerichtet ist. Er kommt aus der Umgebung; ohne
   *     `DIAGNOSE_SCHLUESSEL` ist dieser Weg zu.
   *
   * Verglichen wird zeitgleich. Ein gewoehnliches `===` verraet ueber die
   * Laufzeit, wie viele Zeichen stimmen — bei einem Geheimnis, das im Kopf
   * jeder Anfrage steht, ist das kein theoretischer Einwand.
   */
  const requireAufsicht = async (request: FastifyRequest): Promise<void> => {
    const roh = request.headers['x-diagnose-schluessel'];
    const gereicht = Array.isArray(roh) ? roh[0] : roh;
    const erwartet = deps.diagnoseSchluessel;
    if (erwartet && gereicht) {
      const a = Buffer.from(gereicht);
      const b = Buffer.from(erwartet);
      if (a.length === b.length && timingSafeEqual(a, b)) return;
    }

    const accountId = await requireAccount(request);
    const [konto] = await deps.db
      .select({ isStaff: s.account.isStaff })
      .from(s.account)
      .where(eq(s.account.id, accountId));
    if (!konto?.isStaff) throw forbidden('nurAufsicht');
  };

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof RuleSetInvalidError) {
      return reply
        .status(error.status)
        .send({ code: error.code, messageKey: error.messageKey, problems: error.problems });
    }
    if (error instanceof AppError) {
      return reply.status(error.status).send({ code: error.code, messageKey: error.messageKey });
    }
    // Zod wirft einen ZodError, keinen Fastify-Validierungsfehler. Ohne diesen
    // Zweig wurde jede fehlerhafte Eingabe zu einem 500 mit "etwas ist
    // schiefgelaufen" - eine Meldung, die weder dem Benutzer noch dem
    // Betreiber sagt, was los ist.
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'invalidInput',
        messageKey: 'error.invalidInput',
        fields: error.issues.map((issue) => issue.path.join('.')),
      });
    }
    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send({ code: 'invalidInput', messageKey: 'error.invalidInput' });
    }

    // Fastify wirft eigene Fehler mit Statuscode - fehlerhaftes JSON, zu
    // grosser Rumpf, leerer Rumpf bei gesetztem content-type. Sie hier
    // durchfallen zu lassen machte aus einem 400 einen 500 samt "etwas ist
    // schiefgelaufen", was weder stimmte noch weiterhalf.
    // Ratengrenze: eigener Schluessel, damit der Client sagen kann, was los
    // ist - 'ungueltige Anfrage' waere hier schlicht falsch.
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 429) {
      return reply
        .status(429)
        .send({ code: 'tooManyRequests', messageKey: 'error.tooManyRequests' });
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply
        .status(status)
        .send({ code: 'invalidRequest', messageKey: 'error.invalidRequest' });
    }

    // Hierher kommt nur, was wirklich unerwartet ist. Es MUSS im Log landen,
    // sonst sucht man es spaeter vergeblich.
    // eslint-disable-next-line no-console
    console.error(`500 bei ${request.method} ${request.url}:`, error);
    return reply.status(500).send({ code: 'internal', messageKey: 'error.internal' });
  });

  // -------------------------------------------------------------------------
  // Konten
  // -------------------------------------------------------------------------

  app.post('/api/auth/register', { config: { rateLimit: LIMIT_AUTH } }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    await register(deps.auth, body);
    // Bewusst ohne Sitzung: Erst bestaetigen, dann anmelden.
    return reply.status(201).send({ ok: true });
  });

  app.post('/api/auth/verify', { config: { rateLimit: LIMIT_AUTH } }, async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.body);
    const accountId = await verifyEmail(deps.db, token);
    return reply.send({ ok: true, accountId });
  });

  /** Bestaetigungslink erneut anfordern. Antwortet immer gleich. */
  app.post('/api/auth/verification/resend', { config: { rateLimit: LIMIT_AUTH } }, async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    await requestVerification(deps.auth, email);
    return reply.send({ ok: true });
  });

  app.post('/api/auth/login', { config: { rateLimit: LIMIT_AUTH } }, async (request, reply) => {
    const body = z
      .object({ email: z.string().email(), password: z.string() })
      .parse(request.body);
    const { token, accountId } = await login(deps.auth, body.email, body.password);
    setSession(reply, token);
    // Nur die App bekommt das Token in die Hand, und nur, weil ihre Herkunft
    // sich nicht faelschen laesst. Siehe APP_ORIGIN.
    if (request.headers.origin === APP_ORIGIN) {
      return reply.send({ ok: true, accountId, token });
    }
    return reply.send({ ok: true, accountId });
  });

  app.post('/api/auth/logout', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const session = await sessionFromToken(deps.db, sessionToken(request));
    if (session) await logout(deps.db, session.sessionId);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.send({ ok: true });
  });

  app.post('/api/auth/reset-request', { config: { rateLimit: LIMIT_AUTH } }, async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    await requestPasswordReset(deps.auth, email);
    // Immer dieselbe Antwort, damit sich registrierte Adressen nicht abfragen
    // lassen.
    return reply.send({ ok: true });
  });

  app.post('/api/auth/reset', { config: { rateLimit: LIMIT_AUTH } }, async (request, reply) => {
    const body = z
      .object({ token: z.string(), password: z.string().min(12).max(200) })
      .parse(request.body);
    await resetPassword(deps.db, body.token, body.password);
    return reply.send({ ok: true });
  });

  app.get('/api/me', async (request, reply) => {
    const accountId = await requireAccount(request);
    const [account] = await deps.db
      .select({
        id: s.account.id,
        displayName: s.account.displayName,
        coins: s.account.coins,
        gems: s.account.gems,
        xp: s.account.xp,
        premiumUntil: s.account.premiumUntil,
        isStaff: s.account.isStaff,
        birthday: s.account.birthday,
        hasBirthdayOutfit: s.account.hasBirthdayOutfit,
        birthdayRewardYear: s.account.birthdayRewardYear,
        // Nur, OB ein Bild vorliegt — die Bytes gehen nie mit /api/me raus,
        // sondern nur ueber die eigene URL, die der Browser zwischenspeichert.
        hasAvatar: sql<boolean>`${s.account.avatar} is not null`,
        figurBemalung: s.account.figurBemalung,
      })
      .from(s.account)
      .where(eq(s.account.id, accountId));
    if (!account) throw notFound('accountUnknown');

    const stats = await deps.db
      .select()
      .from(s.accountGameStat)
      .where(eq(s.accountGameStat.accountId, accountId));

    // Reines Lesen: Wer aus seinem Clan austritt, soll draussen bleiben und
    // nicht beim naechsten Laden wieder im Beta-Clan stehen. Eingetragen wird
    // nur bei der Registrierung.
    const clubs = await clubsFor(deps.db, accountId);
    const activeTable = await activeTableFor(deps.db, accountId);

    /*
     * Aussehen je Spiel. Zurueck geht eine vollstaendige Tabelle ueber alle
     * bekannten Spiele — auch ueber die, die es noch nicht zu spielen gibt
     * und fuer die nichts gespeichert ist. Sonst muesste der Client die
     * Vorgaben kennen und doppelt pflegen, und ein fehlender Eintrag saehe
     * aus wie ein Fehler statt wie "noch nie umgestellt".
     */
    const gespeicherte = await deps.db
      .select()
      .from(s.accountGameTheme)
      .where(eq(s.accountGameTheme.accountId, accountId));
    const themes = Object.fromEntries(
      registry.all().map((meta) => {
        const zeile = gespeicherte.find((z) => z.gameId === meta.id);
        return [
          meta.id,
          {
            cardDeck: zeile?.cardDeck ?? DEFAULT_CARD_DECK,
            tableScene: zeile?.tableScene ?? DEFAULT_TABLE_SCENE,
            cardBack: zeile?.cardBack ?? DEFAULT_CARD_BACK,
          },
        ];
      }),
    );

    const { hasAvatar, birthdayRewardYear, isStaff, gems, figurBemalung, ...rest } = account;
    const birthday = account.birthday ?? null;
    // Rechte kommen aus einer einzigen Stelle (entitlements.ts). Der Client
    // rechnet nichts aus Ablaufdaten aus - er zeigt, was hier steht.
    const rechte = entitlementsFor(account);
    // Beide Waehrungen aus einer Hand: Fuer Testkonten meldet die Funktion
    // einen Festwert, deshalb nicht die Spalten direkt.
    const stand = sichtbarerStand(account);
    // Was der Pinguin traegt. Gehoert an /api/me und nicht in einen eigenen
    // Aufruf: Der Mini-Pinguin steht auf dem Startbildschirm, also braucht
    // ihn jeder Ladevorgang ohnehin.
    const getragen = await getragenVon(deps.db, accountId);

    /*
     * Was bereitliegt — zwei Zahlen, damit der Startbildschirm einen Punkt an
     * die Truhe haengen kann. Bewusst nur die Zaehler und nicht die ganzen
     * Listen: Die stehen an /api/chests und /api/quests, und die ruft nur auf,
     * wer den Bildschirm wirklich oeffnet.
     */
    const [truhenOffen, belohnungenOffen] = await Promise.all([
      offeneTruhen(deps.db, accountId, account.xp),
      offeneBelohnungen(deps.db, accountId),
    ]);
    return reply.send({
      ...rest,
      coins: stand.coins,
      gems: stand.gems,
      avatar: getragen,
      /**
       * Die Bemalung der 3D-Figur, schon geprueft. `null` heisst: nie bemalt,
       * es gilt die Standardoptik. Kaputter Inhalt gibt ebenfalls null — eine
       * einmal falsch geschriebene Zeile darf nicht das ganze Profil sperren.
       */
      figur: leseBemalung(figurBemalung),
      bereit: { truhen: truhenOffen, aufgaben: belohnungenOffen },
      /*
       * Stufe und Fortschritt fertig gerechnet. Der Client bekommt die
       * Zahlen, nicht die Kurve: Wird sie je nachjustiert, gilt das
       * sofort fuer alle und nicht erst nach dem naechsten App-Update.
       */
      level: stufenstand(account.xp),
      entitlements: rechte,
      /**
       * Welche Ausgabe hier laeuft, fuer die dezente Kennzeichnung. Ohne
       * Angabe die Produktion: Ein vergessener Schalter soll kein Schild in
       * die echte App haengen, sondern hoechstens eines auf dem Testsystem
       * fehlen lassen.
       */
      stage: deps.stage ?? 'production',
      themes,
      birthday,
      daysUntilBirthday: birthday ? daysUntilBirthday(birthday) : null,
      birthdayToday: birthday ? isBirthdayToday(birthday) : false,
      birthdayRewardClaimable: birthdayRewardClaimable(birthday, birthdayRewardYear),
      avatarUrl: hasAvatar ? `/api/avatars/${account.id}` : null,
      stats,
      clubs,
      activeTable,
    });
  });

  /**
   * Geburtstagsbelohnung einsammeln: Pinguin im Geburtstagsoutfit.
   * Nur am eigenen Geburtstag, einmal pro Kalenderjahr.
   */
  /**
   * Die Stufenleiter um den eigenen Stand herum.
   *
   * Eigener Endpunkt statt an /api/me gehaengt: Gebraucht wird sie nur,
   * wenn jemand die Stufe antippt, und /api/me laeuft bei jedem Laden.
   */
  app.get('/api/me/levels', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const [account] = await deps.db
      .select({ xp: s.account.xp })
      .from(s.account)
      .where(eq(s.account.id, accountId));
    if (!account) throw notFound('accountUnknown');

    return reply.send({
      ...stufenstand(account.xp),
      leiter: leiterUm(account.xp),
    });
  });


  app.post('/api/me/birthday-reward', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const [account] = await deps.db
      .select({
        birthday: s.account.birthday,
        birthdayRewardYear: s.account.birthdayRewardYear,
      })
      .from(s.account)
      .where(eq(s.account.id, accountId));
    if (!account) throw notFound('accountUnknown');
    if (!account.birthday) throw badRequest('birthdayMissing');
    if (!isBirthdayToday(account.birthday)) throw badRequest('birthdayNotToday');
    const year = berlinToday().y;
    if (account.birthdayRewardYear === year) throw conflict('birthdayAlreadyClaimed');

    await deps.db
      .update(s.account)
      .set({ hasBirthdayOutfit: true, birthdayRewardYear: year })
      .where(eq(s.account.id, accountId));

    /*
     * Seit es einen Kleiderschrank gibt, ist das Geburtstagsoutfit nicht mehr
     * nur ein Merkmal, sondern zwei tragbare Stuecke. `hasBirthdayOutfit`
     * bleibt trotzdem stehen: Die Spalte traegt die Anzeige im Profil, und
     * sie zu entfernen waere eine Migration ohne Gewinn.
     *
     * Die beiden Stuecke sind `herkunft: 'geschenk'` und stehen deshalb in
     * keinem Regal — es gibt genau diesen einen Weg hinein. Waeren sie
     * kaufbar, waere der Geburtstag belanglos.
     */
    await schenken(deps.db, accountId, GEBURTSTAGS_OUTFIT);

    return reply.send({ ok: true, item: 'pinguin_geburtstag', items: GEBURTSTAGS_OUTFIT });
  });

  // -------------------------------------------------------------------------
  // Truhen
  // -------------------------------------------------------------------------

  /**
   * Alle Truhen: die heutige und die Stufentruhen, auch die gesperrten.
   *
   * Vollstaendig mit Absicht. Nach DESIGN.md steht das, was es noch nicht
   * gibt, trotzdem in der Oberflaeche — bei Truhen ist das sogar der Kern:
   * Wer nicht sieht, dass bei Stufe 5 eine Bronzetruhe wartet, hat keinen
   * Grund, dorthin zu wollen.
   */
  app.get('/api/chests', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    return reply.send(await truhenFuer(deps.db, accountId));
  });

  /**
   * Truhe oeffnen.
   *
   * Was drin war, steht in der Antwort und danach dauerhaft in `chest_claim`.
   * Gewuerfelt wird genau einmal; ein zweiter Aufruf bekommt einen Konflikt und
   * keinen zweiten Wurf.
   */
  app.post(
    '/api/chests/:chestId/open',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      // Die Kennung wird nur in der Form geprueft; ob es sie gibt und ob sie
      // offen ist, entscheidet truheOeffnen gegen die eigenen Listen.
      const { chestId } = z
        .object({ chestId: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/) })
        .parse(request.params);
      return reply.send(await truheOeffnen(deps.db, accountId, chestId));
    },
  );

  // -------------------------------------------------------------------------
  // Tagesaufgaben
  // -------------------------------------------------------------------------

  app.get('/api/quests', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    return reply.send(await aufgabenFuer(deps.db, accountId));
  });

  app.post(
    '/api/quests/:questId/claim',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      const { questId } = z
        .object({ questId: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/) })
        .parse(request.params);
      return reply.send(await aufgabeAbholen(deps.db, accountId, questId));
    },
  );

  // -------------------------------------------------------------------------
  // Pro-Subway (Solo-Runner)
  // -------------------------------------------------------------------------

  /** Wie viele Hub-Muenzen heute noch aus dem Runner kommen koennen. */
  app.get('/api/runner/today', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    return reply.send(await runnerTagesstand(deps.db, accountId));
  });

  /**
   * Lauf beendet: eingesammelte Runner-Muenzen in Hub-Muenzen umwandeln.
   * Kappen: pro Lauf und pro Kalendertag (siehe runner.ts).
   */
  app.post('/api/runner/cashout', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = z
      .object({
        coins: z.number().int().min(0).max(500),
      })
      .parse(request.body);
    return reply.send(await runnerCashout(deps.db, accountId, body.coins));
  });

  /**
   * Lauf beendet — der eine Aufruf am Lebensende des Laufs: Muenzen (mit
   * Kappen), Tagesaufgaben, Tagesbestwert und Platz in der Tagesliste.
   * Ersetzt /cashout im Client; der alte Weg bleibt fuer Clients, die den
   * Deploy noch nicht geladen haben.
   */
  app.post('/api/runner/lauf', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = z
      .object({
        muenzen: z.number().int().min(0).max(500),
        punkte: z.number().int().min(0).max(100_000),
        meter: z.number().int().min(0).max(100_000),
      })
      .parse(request.body);
    return reply.send(await runnerLauf(deps.db, accountId, body));
  });

  /** Die heutige Tagesliste: beste zehn plus eigener Platz. */
  app.get('/api/runner/rangliste', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    return reply.send(await runnerRangliste(deps.db, accountId));
  });

  // -------------------------------------------------------------------------
  // Shop und Kleiderschrank
  // -------------------------------------------------------------------------

  /**
   * Der Shop: Paesse, Pakete, Kauftruhen und die Kosmetikregale mit beiden
   * Preisen, dem Kurs und dem Besitzstand des Kontos.
   */
  app.get('/api/shop', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    return reply.send(await shopFuer(deps.db, accountId));
  });

  /**
   * Kosmetik kaufen — gegen Muenzen oder Edelsteine, nicht gegen Geld.
   *
   * Der Rumpf traegt genau eine Angabe: **welche** der beiden Waehrungen es
   * sein soll. Wie hoch der Preis ist, steht im Katalog — daran gibt es nichts
   * zu verhandeln. Fehlt die Angabe, wird in Muenzen bezahlt.
   */
  app.post(
    '/api/shop/:itemId/buy',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      const { itemId } = z
        .object({ itemId: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/) })
        .parse(request.params);
      // Der Rumpf darf ganz fehlen: Ein Kauf ohne Angabe ist ein Kauf in
      // Muenzen, und die alten Aufrufe ohne Rumpf bleiben damit gueltig.
      const { waehrung } = z
        .object({ waehrung: z.enum(WAEHRUNGEN).default('coins') })
        .parse(request.body ?? {});
      return reply.send(await kaufen(deps.db, accountId, itemId, waehrung));
    },
  );

  /**
   * Ein Paket gegen Edelsteine kaufen — heute die drei Muenzpakete.
   *
   * Eigener Weg und nicht `/api/shop/:itemId/buy` mit einer Paketkennung: Ein
   * Paket schuettet Guthaben aus, ein Kosmetikstueck traegt sich ins Eigentum
   * ein. Dieselbe Route fuer beides waere eine Verzweigung nach Kennungsform,
   * und die trifft irgendwann falsch.
   */
  app.post(
    '/api/shop/pakete/:paketId/buy',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      const { paketId } = z
        .object({ paketId: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/) })
        .parse(request.params);
      return reply.send(await paketKaufen(deps.db, accountId, paketId));
    },
  );

  /**
   * Eine Truhe gegen Edelsteine kaufen.
   *
   * **Gekauft ist geoeffnet:** Der Wurf steht in der Antwort, es gibt kein
   * zweites Antippen. Ein Zwischenzustand „gekauft, noch zu" waere eine Truhe,
   * die auf etwas wartet, was schon bezahlt ist.
   */
  app.post(
    '/api/shop/truhen/:truheId/buy',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      const { truheId } = z
        .object({ truheId: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/) })
        .parse(request.params);
      return reply.send(await truheKaufen(deps.db, accountId, truheId));
    },
  );

  /**
   * Anziehen. Ein Platz je Aufruf, `null` macht ihn leer.
   *
   * Am Server und nicht im Browser, weil hier der Besitz geprueft wird — sonst
   * waere ein Aufruf mit fremder Kennung der Weg, ein legendaeres Stueck zu
   * tragen, ohne es zu haben.
   */
  app.patch(
    '/api/me/avatar',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      const body = z
        .object({
          slot: z.enum(SLOTS),
          itemId: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).nullable(),
        })
        .parse(request.body);
      // Der Zod-Enum prueft schon; istSlot ist der Riegel dagegen, dass beide
      // Listen auseinanderlaufen, falls SLOTS je erweitert wird.
      if (!istSlot(body.slot)) throw badRequest('invalidInput');

      await anziehen(deps.db, accountId, body.slot, body.itemId);
      return reply.send({ ok: true, avatar: await getragenVon(deps.db, accountId) });
    },
  );

  /**
   * Die Bemalung der 3D-Figur speichern.
   *
   * Die Pruefung liegt in `src/bemalung.ts` und ist bewusst streng: Ein Aufruf
   * mit einem Strich zu viel wird abgelehnt und nicht stillschweigend
   * beschnitten. Wer beschneidet, bekommt spaeter die Frage, warum die Haelfte
   * der Bemalung fehlt.
   *
   * Kein Besitzriegel wie beim Anziehen: Malen kostet nichts, und was jemand
   * auf seine eigene Figur malt, geht niemanden etwas an. Begrenzt wird nur
   * die Groesse.
   */
  app.patch(
    '/api/me/figur',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      const bemalung = pruefeBemalung(request.body);
      if (!bemalung) throw badRequest('invalidInput');

      await deps.db
        .update(s.account)
        .set({ figurBemalung: JSON.stringify(bemalung) })
        .where(eq(s.account.id, accountId));

      return reply.send({ ok: true, figur: bemalung });
    },
  );

  /**
   * Profilbild eines Kontos. Oeffentlich, weil es genau dafuer da ist: die
   * Mitspieler am Tisch sollen es sehen. Gespeichert ist es als data-URL, hier
   * wird es in Bytes zurueckuebersetzt und kurz zwischengespeichert.
   */
  app.get('/api/avatars/:accountId', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    const [row] = await deps.db
      .select({ avatar: s.account.avatar })
      .from(s.account)
      .where(eq(s.account.id, accountId));

    const match = row?.avatar ? /^data:(image\/[a-z+]+);base64,(.+)$/.exec(row.avatar) : null;
    if (!match) throw notFound('avatarUnknown');

    return reply
      .header('content-type', match[1]!)
      .header('cache-control', 'public, max-age=120')
      .send(Buffer.from(match[2]!, 'base64'));
  });

  /**
   * Persoenliche Einstellungen. Bislang nur das Kartenblatt.
   *
   * Es gehoert an das Konto und nicht in den Browser: Wer am Rechner ein Blatt
   * waehlt, will es am Telefon nicht erneut suchen. Geprueft wird gegen eine
   * feste Liste — was der Server speichert, muss er auch benennen koennen.
   */
  app.patch('/api/me', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = z
      .object({
        // Ein kleines, im Browser verkleinertes Quadrat als data-URL. Die
        // Groesse ist bewusst hart begrenzt: Die Verkleinerung passiert im
        // Client, hier steht nur der Riegel, falls sie umgangen wird. null
        // entfernt das Bild wieder.
        avatar: z
          .string()
          .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/)
          .max(60_000)
          .nullable()
          .optional(),
      })
      .parse(request.body);

    const set: Record<string, unknown> = {};
    if (body.avatar !== undefined) {
      // Der Kopf einer data-URL ist nur eine Behauptung. Ohne Blick auf die
      // ersten Bytes liesse sich HTML als "image/png" ablegen und danach von
      // unserer eigenen Herkunft ausliefern - der kurze Weg zu XSS.
      if (body.avatar !== null && !istEchtesBild(body.avatar)) {
        throw badRequest('avatarInvalid');
      }
      set.avatar = body.avatar;
    }
    if (Object.keys(set).length > 0) {
      await deps.db.update(s.account).set(set).where(eq(s.account.id, accountId));
    }

    return reply.send({ ok: true });
  });

  /**
   * Aussehen eines Spiels: Kartenblatt und Tischszenerie.
   *
   * Je Spiel, weil ein Blatt nur zu seinem Spiel passt. Geprueft wird gegen
   * feste Listen — was der Server speichert, muss er auch benennen koennen.
   *
   * Die Spielkennung muss bekannt sein, aber das Spiel muss noch nicht
   * spielbar sein: Wer sich sein Skat-Blatt schon zurechtlegt, waehrend Skat
   * noch Vorschau ist, soll das duerfen. Es kostet nichts und geht nicht
   * verloren.
   */
  app.patch(
    '/api/me/themes/:gameId',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      const { gameId } = z
        .object({ gameId: z.string() })
        .parse(request.params);
      // all() statt get(): Auch Vorschau-Spiele duerfen eingestellt werden,
      // get() kennt nur die spielbaren.
      if (!registry.all().some((m) => m.id === gameId)) throw notFound('gameNotPlayable');

      const body = z
        .object({
          cardDeck: z.enum(CARD_DECKS).optional(),
          tableScene: z.enum(TABLE_SCENES).optional(),
          cardBack: z.enum(CARD_BACKS).optional(),
        })
        .parse(request.body);
      if (
        body.cardDeck === undefined &&
        body.tableScene === undefined &&
        body.cardBack === undefined
      ) {
        throw badRequest('invalidInput');
      }

      /*
       * Besitz pruefen — hier und nicht im Client.
       *
       * Die Kennung hat die Liste in scenes.ts/decks.ts schon passiert, das
       * sagt aber nur, dass es sie gibt. Ohne diese zweite Frage waere ein
       * Aufruf mit fremder Kennung der Weg, eine gekaufte Szenerie zu
       * benutzen, ohne sie zu haben.
       */
      const [konto] = await deps.db
        .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
        .from(s.account)
        .where(eq(s.account.id, accountId));
      const alles = konto ? entitlementsFor(konto).ownsEverything : false;

      if (
        body.tableScene &&
        !(await darfBenutzen(deps.db, accountId, 'szene', body.tableScene, alles))
      ) {
        throw forbidden('itemNotOwned');
      }
      if (
        body.cardDeck &&
        !(await darfBenutzen(deps.db, accountId, 'blatt', body.cardDeck, alles))
      ) {
        throw forbidden('itemNotOwned');
      }
      if (
        body.cardBack &&
        !(await darfBenutzen(deps.db, accountId, 'ruecken', body.cardBack, alles))
      ) {
        throw forbidden('itemNotOwned');
      }

      // Einfuegen oder aendern in einem Zug: Es gibt keine Zeile, solange
      // nichts umgestellt wurde, und der erste Klick soll nicht scheitern.
      await deps.db
        .insert(s.accountGameTheme)
        .values({
          accountId,
          gameId: gameId as GameId,
          ...(body.cardDeck ? { cardDeck: body.cardDeck } : {}),
          ...(body.tableScene ? { tableScene: body.tableScene } : {}),
          ...(body.cardBack ? { cardBack: body.cardBack } : {}),
        })
        .onConflictDoUpdate({
          target: [s.accountGameTheme.accountId, s.accountGameTheme.gameId],
          set: {
            ...(body.cardDeck ? { cardDeck: body.cardDeck } : {}),
            ...(body.tableScene ? { tableScene: body.tableScene } : {}),
            ...(body.cardBack ? { cardBack: body.cardBack } : {}),
          },
        });

      return reply.send({ ok: true });
    },
  );

  /**
   * Kontoloeschung. Sie MUSS in der App funktionieren, und sie loescht keine
   * Zeilen, sondern anonymisiert: Sonst zerfielen die Partiehistorien aller
   * Mitspieler.
   *
   * Das Passwort wird erneut verlangt. Der Schritt ist unumkehrbar, und die
   * Sitzung haelt dreissig Tage: Ohne diese Frage genuegt ein kurz aus der
   * Hand gelegtes Handy, um ein fremdes Konto endgueltig zu loeschen.
   */
  app.delete('/api/me', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { password } = z.object({ password: z.string().min(1) }).parse(request.body);

    const [acc] = await deps.db
      .select({ passwordHash: s.account.passwordHash })
      .from(s.account)
      .where(eq(s.account.id, accountId));
    // Derselbe Schluessel wie bei der Anmeldung: Wer das Passwort nicht kennt,
    // erfaehrt hier nichts, was er nicht schon wusste.
    if (!acc || !(await verifyPassword(acc.passwordHash, password))) {
      throw unauthorized('credentialsInvalid');
    }

    // Waehrend laufender Partie gilt die Loeschung als Verlassen.
    const running = await deps.db
      .select({ tableId: s.tableSeat.tableId })
      .from(s.tableSeat)
      .innerJoin(s.gameTable, eq(s.gameTable.id, s.tableSeat.tableId))
      .where(and(eq(s.tableSeat.accountId, accountId), eq(s.gameTable.status, 'running')));
    for (const row of running) {
      await deps.runtime.markLeftByAccount(row.tableId, accountId);
    }

    // Vor dem Anonymisieren aus dem Clan austragen: Sonst bliebe ein Clan
    // zurueck, dessen Admin "geloescht-a1b2c3d4" heisst und den niemand mehr
    // verwalten kann.
    await releaseClubMemberships(deps.db, accountId);
    await anonymizeAccount(deps.db, accountId);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Profile und Freunde
  // -------------------------------------------------------------------------

  /** Namenssuche zum Anfreunden. Vor der Profilroute, sonst faengt :id "search". */
  app.get('/api/players', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const viewerId = await requireAccount(request);
    const { q } = z.object({ q: z.string().max(60) }).parse(request.query);
    return reply.send(await searchPlayers(deps.db, viewerId, q));
  });

  app.get('/api/players/:accountId', async (request, reply) => {
    const viewerId = await requireAccount(request);
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    return reply.send(await playerProfile(deps.db, viewerId, accountId));
  });

  app.get('/api/friends', async (request, reply) => {
    const meId = await requireAccount(request);
    return reply.send(await listFriendships(deps.db, meId));
  });

  app.post('/api/friends/:accountId/request', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const meId = await requireAccount(request);
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    return reply.send(await requestFriendship(deps.db, meId, accountId));
  });

  app.post('/api/friends/:accountId/accept', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const meId = await requireAccount(request);
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    await acceptFriendship(deps.db, meId, accountId);
    return reply.send({ ok: true });
  });

  /** Entfernt Freundschaft, lehnt eine Anfrage ab oder zieht die eigene zurueck. */
  app.delete('/api/friends/:accountId', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const meId = await requireAccount(request);
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    await removeFriendship(deps.db, meId, accountId);
    return reply.send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Spielauswahl
  // -------------------------------------------------------------------------

  app.get('/api/games', async (_request, reply) => {
    const votes = await deps.db
      .select({ gameId: s.gameVote.gameId, count: sql<number>`count(*)::int` })
      .from(s.gameVote)
      .groupBy(s.gameVote.gameId);
    const countOf = new Map(votes.map((row) => [row.gameId, row.count]));

    return reply.send(
      registry.all().map((meta) => ({
        id: meta.id,
        nameKey: meta.nameKey,
        availability: meta.availability,
        seatCounts: meta.seatCounts,
        votes: countOf.get(meta.id) ?? 0,
      })),
    );
  });

  /** Vorschau-Spiele: Abstimmung, welches zuerst kommt. */
  app.post('/api/games/:gameId/vote', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { gameId } = z.object({ gameId: gameIdSchema }).parse(request.params);
    if (isPlayable(gameId)) {
      return reply.status(400).send({ code: 'alreadyPlayable', messageKey: 'error.alreadyPlayable' });
    }
    await deps.db.insert(s.gameVote).values({ accountId, gameId }).onConflictDoNothing();
    return reply.send({ ok: true });
  });

  /**
   * Wie viele Menschen gerade in EINEM Spiel stecken - suchend oder spielend.
   *
   * Warum eine eigene Zeile und nicht die Tischliste: `/tables` zeigt
   * ausschliesslich Tische im Zustand `waiting`. Wer gerade eine Partie
   * spielt, ist darin unsichtbar, und eine Anzeige "3 aktive Spieler", die
   * beim Spielstart auf 1 faellt, ist schlechter als gar keine.
   *
   * Bewusst spielunabhaengig: Die Zeile kennt kein einzelnes Spiel, sie
   * zaehlt besetzte Plaetze. Botsitze zaehlen nicht mit (accountId ist null).
   */
  app.get('/api/games/:gameId/aktiv', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const { gameId } = z.object({ gameId: gameIdSchema }).parse(request.params);
    const [zeile] = await deps.db
      .select({ anzahl: sql<number>`count(distinct ${s.tableSeat.accountId})::int` })
      .from(s.tableSeat)
      .innerJoin(s.gameTable, eq(s.tableSeat.tableId, s.gameTable.id))
      .where(
        and(
          eq(s.gameTable.gameId, gameId),
          sql`${s.gameTable.status} in ('waiting','running')`,
          sql`${s.tableSeat.accountId} is not null`,
        ),
      );
    return reply.send({ aktiv: zeile?.anzahl ?? 0 });
  });

  /** Vorbelegung fuer den Regelsatz-Editor. Der Inhalt kommt aus dem Modul. */
  app.get('/api/games/:gameId/defaults', async (request, reply) => {
    const { gameId } = z.object({ gameId: gameIdSchema }).parse(request.params);
    const module = requireModule(gameId as GameId);
    const seatCounts = module.meta.seatCounts;

    return reply.send({
      config: module.defaultConfig(),
      protocolVersion: module.protocolVersion,
      seatCounts,
      rounds: Object.fromEntries(
        seatCounts.map((seats) => [seats, module.meta.suggestedRounds(seats)]),
      ),
    });
  });

  // -------------------------------------------------------------------------
  // Clans (Plan 9.3)
  // -------------------------------------------------------------------------

  /**
   * Clanliste zum Beitreten, mit optionaler Namenssuche.
   *
   * Oeffentlich fuer angemeldete Konten — man muss sehen koennen, wohin man
   * eintreten kann. Mitgliedernamen stehen hier bewusst nicht drin, die gibt
   * es erst in der Einzelansicht.
   */
  app.get('/api/clubs', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const query = z
      .object({ search: z.string().trim().max(40).optional() })
      .parse(request.query);
    const [clubs, pending] = await Promise.all([
      listClubs(deps.db, { search: query.search }),
      pendingRequestsOf(deps.db, accountId),
    ]);
    return reply.send({ clubs, pending });
  });

  const createClubSchema = z.object({
    name: z.string().min(NAME_MIN).max(NAME_MAX),
    crest: z.enum(CRESTS),
    motto: z.string().max(MOTTO_MAX).nullish(),
    joinMode: z.enum(['open', 'on_request']).optional(),
    minTrophies: z.number().int().min(0).max(100_000).optional(),
  });

  app.post('/api/clubs', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = createClubSchema.parse(request.body);
    const created = await createClub(deps.db, accountId, body);
    return reply.status(201).send(created);
  });

  const clubParams = z.object({ clubId: z.string().uuid() });
  const memberParams = z.object({
    clubId: z.string().uuid(),
    accountId: z.string().uuid(),
  });
  const warParams = z.object({
    clubId: z.string().uuid(),
    warId: z.string().uuid(),
  });

  app.get('/api/clubs/:clubId', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    return reply.send(await clubDetail(deps.db, clubId, accountId));
  });

  app.patch('/api/clubs/:clubId', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    const body = z
      .object({
        name: z.string().min(NAME_MIN).max(NAME_MAX).optional(),
        crest: z.enum(CRESTS).optional(),
        motto: z.string().max(MOTTO_MAX).nullish(),
        joinMode: z.enum(['open', 'on_request']).optional(),
        minTrophies: z.number().int().min(0).max(100_000).optional(),
        defaultRuleSetId: z.string().uuid().nullish(),
      })
      .parse(request.body);
    await updateClub(deps.db, clubId, accountId, body);
    return reply.send({ ok: true });
  });

  /** Beitreten: sofort bei offenen Clans, sonst als Anfrage. */
  app.post('/api/clubs/:clubId/join', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    return reply.send(await joinClub(deps.db, clubId, accountId));
  });

  /** Eigene Anfrage zuruecknehmen. */
  app.delete('/api/clubs/:clubId/join', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    await cancelJoinRequest(deps.db, clubId, accountId);
    return reply.send({ ok: true });
  });

  /** Austreten. Beim Admin rueckt das aelteste Mitglied nach. */
  app.delete('/api/clubs/:clubId/members/me', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    await leaveClub(deps.db, clubId, accountId);
    return reply.send({ ok: true });
  });

  app.post('/api/clubs/:clubId/requests/:accountId/accept', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const adminId = await requireAccount(request);
    const params = memberParams.parse(request.params);
    await acceptJoinRequest(deps.db, params.clubId, adminId, params.accountId);
    return reply.send({ ok: true });
  });

  app.post('/api/clubs/:clubId/requests/:accountId/reject', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const adminId = await requireAccount(request);
    const params = memberParams.parse(request.params);
    await rejectJoinRequest(deps.db, params.clubId, adminId, params.accountId);
    return reply.send({ ok: true });
  });

  app.patch('/api/clubs/:clubId/members/:accountId', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const adminId = await requireAccount(request);
    const params = memberParams.parse(request.params);
    const { role } = z.object({ role: z.enum(['admin', 'vize', 'elder', 'member', 'guest']) }).parse(request.body);
    await setMemberRole(deps.db, params.clubId, adminId, params.accountId, role);
    return reply.send({ ok: true });
  });

  app.delete('/api/clubs/:clubId/members/:accountId', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const adminId = await requireAccount(request);
    const params = memberParams.parse(request.params);
    await kickMember(deps.db, params.clubId, adminId, params.accountId);
    return reply.send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Clanchat
  // -------------------------------------------------------------------------

  /**
   * Nachrichten lesen. `seit` holt nur Neueres — der Client fragt im
   * Sekundentakt nach und schickt den Zeitstempel seiner juengsten Zeile mit.
   */
  app.get('/api/clubs/:clubId/messages', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    const { seit } = z.object({ seit: z.string().datetime().optional() }).parse(request.query);
    const messages = await listMessages(
      deps.db,
      clubId,
      accountId,
      seit ? new Date(seit) : undefined,
    );
    return reply.send({ messages });
  });

  app.post('/api/clubs/:clubId/messages', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    const { body } = z.object({ body: z.string().min(1).max(MAX_LAENGE) }).parse(request.body);
    return reply.send(await postMessage(deps.db, clubId, accountId, body));
  });

  app.delete('/api/clubs/:clubId/messages/:messageId', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const params = z
      .object({ clubId: z.string().uuid(), messageId: z.string().uuid() })
      .parse(request.params);
    await deleteMessage(deps.db, params.clubId, params.messageId, accountId);
    return reply.send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Clankrieg
  // -------------------------------------------------------------------------

  app.get('/api/clubs/:clubId/war', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    return reply.send(await warState(deps.db, clubId, accountId));
  });

  /** Gegner suchen. Wartet schon einer, sind beide sofort im Krieg. */
  app.post('/api/clubs/:clubId/war/search', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    return reply.send(await searchWar(deps.db, clubId, accountId));
  });

  /** Einen bestimmten Clan herausfordern. */
  app.post('/api/clubs/:clubId/war/challenge', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { clubId } = clubParams.parse(request.params);
    const { gegnerId } = z.object({ gegnerId: z.string().uuid() }).parse(request.body);
    await challengeWar(deps.db, clubId, gegnerId, accountId);
    return reply.send({ ok: true });
  });

  app.post('/api/clubs/:clubId/war/:warId/accept', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { warId } = warParams.parse(request.params);
    await acceptWar(deps.db, warId, accountId);
    return reply.send({ ok: true });
  });

  /** Suche beenden oder Herausforderung ablehnen. Laufende Kriege nicht. */
  app.delete('/api/clubs/:clubId/war/:warId', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { warId } = warParams.parse(request.params);
    await cancelWar(deps.db, warId, accountId);
    return reply.send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Regelsaetze
  // -------------------------------------------------------------------------

  app.get('/api/rulesets', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { game } = z.object({ game: gameIdSchema }).parse(request.query);
    return reply.send(await listRuleSets(deps.db, accountId, game));
  });

  app.post('/api/rulesets', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = z
      .object({
        gameId: gameIdSchema,
        name: z.string().min(1).max(60),
        config: z.unknown(),
        seats: z.number().int(),
        rounds: z.number().int(),
        ruleSetId: z.string().uuid().optional(),
      })
      .parse(request.body);

    return reply.status(201).send(await saveRuleSet(deps.db, { accountId, ...body }));
  });

  // -------------------------------------------------------------------------
  // Lobby und Tische
  // -------------------------------------------------------------------------

  app.get('/api/tables', async (request, reply) => {
    const accountId = await requireAccount(request);
    const query = z
      .object({
        game: gameIdSchema,
        seats: z.coerce.number().int().optional(),
        rounds: z.coerce.number().int().optional(),
      })
      .parse(request.query);

    const clubs = await clubsFor(deps.db, accountId);
    return reply.send(
      await listTables(deps.db, {
        gameId: query.game,
        seats: query.seats,
        rounds: query.rounds,
        clubIds: clubs.map((c) => c.id),
      }),
    );
  });

  app.post('/api/tables', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = createTableSchema.parse(request.body);
    // Clantisch ohne clubId: den ersten (und in der Beta einzigen) Clan nehmen.
    let clubId = body.clubId;
    if (body.visibility === 'club_only' && !clubId) {
      const clubs = await clubsFor(deps.db, accountId);
      clubId = clubs[0]?.id;
    }
    const table = await createTable(deps.db, { accountId, ...body, clubId });
    return reply.status(201).send(table);
  });

  /** Clantisch pausieren — Zugtimer und 24h-Verfall stehen still. */
  app.post('/api/tables/:tableId/pause', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await deps.runtime.pause(tableId, accountId);
    deps.runtime.notify(tableId);
    return reply.send({ ok: true });
  });

  /** Pausierten Clantisch fortsetzen. */
  app.post('/api/tables/:tableId/resume', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await deps.runtime.unpause(tableId, accountId);
    deps.runtime.notify(tableId);
    return reply.send({ ok: true });
  });

  app.get('/api/tables/:tableId', async (request, reply) => {
    // Anmeldepflicht wie bei allen Nachbarrouten. Ohne sie konnte jeder
    // anonym die Konto-Kennungen aller Sitze eines privaten Clantisches
    // abfragen und ueber die Profilsuche mit Namen verknuepfen.
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    const { table, seats } = await tableWithSeats(deps.db, tableId);
    if (
      table.visibility === 'club_only' &&
      !seats.some((seat) => seat.accountId === accountId)
    ) {
      if (!table.clubId) throw notFound('tableUnknown');
      await requireClubMember(deps.db, table.clubId, accountId);
    }
    return reply.send({ table, seats });
  });

  /** Wer am Tisch sitzt, muss nachlesen koennen, welche Regeln hier gelten. */
  app.get('/api/tables/:tableId/rules', async (request, reply) => {
    await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    return reply.send({ config: await tableRules(deps.db, tableId) });
  });

  app.post('/api/tables/:tableId/join', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await joinTable(deps.db, tableId, accountId);
    // Die schon Verbundenen sollen sehen, dass sich der Tisch fuellt - und
    // wenn er damit voll ist, startet die Partie von selbst.
    deps.runtime.notify(tableId);
    return reply.send({ ok: true });
  });

  /** Vor dem Start straffrei. Danach greift die Verlassen-Logik am Tisch. */
  app.post('/api/tables/:tableId/leave', { config: { rateLimit: LIMIT_SCHREIBEN } }, async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await leaveLobby(deps.db, tableId, accountId);
    deps.runtime.notify(tableId);
    return reply.send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Ranglisten
  // -------------------------------------------------------------------------

  app.get('/api/rankings/:gameId', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    await requireAccount(request);
    const { gameId } = z.object({ gameId: gameIdSchema }).parse(request.params);
    const query = z
      .object({
        limit: z.coerce.number().int().optional(),
        offset: z.coerce.number().int().optional(),
      })
      .parse(request.query);
    return reply.send(await rankingForGame(deps.db, gameId, query.limit, query.offset));
  });

  app.get('/api/rankings', { config: { rateLimit: LIMIT_ALLGEMEIN } }, async (request, reply) => {
    await requireAccount(request);
    const query = z
      .object({
        limit: z.coerce.number().int().optional(),
        offset: z.coerce.number().int().optional(),
      })
      .parse(request.query);
    return reply.send(await overallRanking(deps.db, query.limit, query.offset));
  });

  // -------------------------------------------------------------------------
  // Diagnose (Feldherr)
  // -------------------------------------------------------------------------

  /**
   * Aufnehmen darf jeder Angemeldete: Es ist die Messung des eigenen
   * Geraets an der eigenen Partie. Lesen darf nur die Aufsicht — die
   * Sammlung ueber alle Partien ist etwas anderes als der eigene
   * Mitschnitt. Der ganze Zweck steht in docs/FELDHERR-DIAGNOSE.md.
   */
  app.post(
    '/api/diagnose/feldherr',
    { config: { rateLimit: LIMIT_SCHREIBEN } },
    async (request, reply) => {
      const accountId = await requireAccount(request);
      const body = diagnoseSchema.parse(request.body);

      /**
       * Der Tisch wird nachgesehen, nicht geglaubt: Ein unbekanntes
       * Saatkorn im Feld `tisch` liefe sonst in einen Fremdschluessel-
       * Fehler und damit in einen 500er — fuer eine Meldung, die im
       * Zweifel trotzdem wertvoll ist. Ohne Tisch wird sie eben ohne
       * Zuordnung abgelegt.
       */
      let tableId: string | null = null;
      if (body.kopf.tisch) {
        const [zeile] = await deps.db
          .select({ id: s.gameTable.id })
          .from(s.gameTable)
          .where(eq(s.gameTable.id, body.kopf.tisch));
        tableId = zeile?.id ?? null;
      }

      const gespeichert = await nimmAuf(deps.db, {
        accountId,
        tableId,
        seat: body.kopf.sitz,
        grund: body.grund,
        abIndex: body.ab ?? 0,
        rumpf: request.body,
      });

      /**
       * Auch eine verworfene Meldung ist ein `ok`. Ein Geraet, das ein
       * Nein bekaeme, faenge an zu wiederholen — und belastete genau die
       * Leitung, auf der die Partie laeuft, die wir gerade untersuchen.
       */
      return reply.send({ ok: true, gespeichert });
    },
  );

  app.get(
    '/api/diagnose/feldherr',
    { config: { rateLimit: LIMIT_ALLGEMEIN } },
    async (request, reply) => {
      await requireAufsicht(request);
      const query = z
        .object({
          seit: z.string().optional(),
          tisch: z.string().uuid().optional(),
          grenze: z.coerce.number().int().min(1).max(5000).optional(),
        })
        .parse(request.query);

      const seit = query.seit ? new Date(query.seit) : undefined;
      if (seit && Number.isNaN(seit.getTime())) throw badRequest('invalidInput');

      const zeilen = await lies(deps.db, {
        seit,
        tableId: query.tisch,
        grenze: query.grenze ?? 2000,
      });
      return reply.send({ zeilen, grenze: query.grenze ?? 2000 });
    },
  );

  /** Welche Partien ueberhaupt Mitschnitte haben — der Einstieg in die Suche. */
  app.get(
    '/api/diagnose/feldherr/tische',
    { config: { rateLimit: LIMIT_ALLGEMEIN } },
    async (request, reply) => {
      await requireAufsicht(request);
      const query = z
        .object({ stunden: z.coerce.number().int().min(1).max(24 * 30).optional() })
        .parse(request.query);
      const seit = new Date(Date.now() - (query.stunden ?? 48) * 3600_000);
      return reply.send({ seit, tische: await uebersicht(deps.db, seit) });
    },
  );

  app.get('/api/health', async (_request, reply) => reply.send({ ok: true }));

  // -------------------------------------------------------------------------
  // Client
  // -------------------------------------------------------------------------

  /**
   * Der gebaute Client wird vom selben Server ausgeliefert.
   *
   * Damit gibt es genau einen Ursprung: Das Sitzungs-Cookie gilt ohne
   * Sonderfall auch fuer den WebSocket, es braucht kein CORS und keine zweite
   * Domain. In der Entwicklung uebernimmt Vite diese Rolle und reicht /api und
   * /ws hierher weiter.
   */
  if (deps.clientDir) {
    void app.register(fastifyStatic, { root: deps.clientDir });

    // Caching des Clients steuern.
    //
    // index.html traegt keinen Hash und verweist auf die gehashten Bundles.
    // Wird sie gecacht, zeigt eine alte index.html nach einem Deploy auf ein
    // Bundle, das es nicht mehr gibt - und die Seite bleibt weiss. Also nie
    // cachen. Die Assets darunter aendern bei jeder Aenderung ihren Namen und
    // duerfen deshalb dauerhaft im Cache bleiben.
    app.addHook('onSend', async (request, reply) => {
      const path = request.url.split('?')[0] ?? '';
      if (path.startsWith('/api') || path.startsWith('/ws')) return;
      if (path.startsWith('/assets/')) {
        reply.header('cache-control', 'public, max-age=31536000, immutable');
      } else if (/\.(png|jpe?g|webp|svg|webmanifest)$/.test(path)) {
        // Bilder und Manifest tragen keinen Hash im Namen, aendern sich aber
        // selten. Eine Stunde Cache spart beim Start vom Homescreen ein paar
        // Dutzend Rueckfragen, ohne dass ein neues Icon lange alt bleibt.
        reply.header('cache-control', 'public, max-age=3600');
      } else {
        // index.html und jede SPA-Route: nie cachen, damit ein Deploy sofort
        // greift und keine alte Seite auf ein verschwundenes Bundle zeigt.
        reply.header('cache-control', 'no-cache');
      }
    });

    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split('?')[0] ?? '';

      // API und WebSocket bleiben ehrliche 404.
      if (path.startsWith('/api') || path.startsWith('/ws')) {
        return reply.status(404).send({ code: 'notFound', messageKey: 'error.notFound' });
      }

      // Eine fehlende Datei mit Endung (ein altes Bundle, ein Bild) darf NICHT
      // die index.html zurueckbekommen: Ein Browser, der ein veraltetes
      // /assets/index-XXXX.js anfragt, bekaeme sonst HTML als "JavaScript"
      // geliefert und die Seite bliebe weiss. Nur echte Navigationsrouten der
      // Einzelseiten-Anwendung erhalten die index.html - und die ungecacht.
      if (path.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(path)) {
        return reply.status(404).send({ code: 'notFound', messageKey: 'error.notFound' });
      }
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  }

  return app;
}
