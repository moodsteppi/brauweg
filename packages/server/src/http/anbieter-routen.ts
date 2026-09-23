/**
 * HTTP-Routen fuer "Mit Google anmelden" und "Mit Apple anmelden".
 *
 * Eigene Datei, weil app.ts schon ueber zweieinhalbtausend Zeilen hat und die
 * Anmeldung ueber Anbieter ein geschlossenes Stueck ist: zwei Konfigurationen,
 * eine Nonce, je Anbieter ein Anmelde- und ein Verknuepfungsweg, das Trennen.
 * Was app.ts beisteuert (Sitzungscookie, `requireAccount`), kommt als
 * Abhaengigkeit herein, damit es davon genau eine Fassung gibt.
 *
 * Ob ein Anbieter angeboten wird, entscheidet allein die Umgebung: Ohne
 * Client-ID liefert `/config` null, der Client zeigt keinen Knopf, und die
 * Anmelderouten antworten mit "abgeschaltet".
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  Anmeldescheine,
  anmeldeartenVon,
  anmeldenMitAnbieter,
  istAnbieter,
  schliesseAnmeldungAb,
  trenneAnbieter,
  verknuepfeAnbieter,
  type AnbieterProfil,
} from '../auth/anbieter.js';
import { pruefeAppleToken } from '../auth/apple.js';
import { pruefeGoogleToken } from '../auth/google.js';
import type { Schluesselquelle } from '../auth/idtoken.js';
import { NonceSpeicher } from '../auth/nonce.js';
import type { AuthDeps } from '../auth/service.js';
import type { Db } from '../db/types.js';
import { badRequest, notFound } from '../errors.js';

type Grenze = { max: number; timeWindow: string };

export interface AnbieterRoutenDeps {
  readonly db: Db;
  readonly auth: AuthDeps;
  readonly googleClientId: string | null;
  readonly appleClientId: string | null;
  readonly appleRedirectUri: string | null;
  /** Inhalt von apple-developer-domain-association.txt, falls Apple ihn verlangt. */
  readonly appleDomainVerknuepfung: string | null;
  /** Nur fuer Tests: eigene Schluessel statt Googles und Apples JWKS. */
  readonly schluessel?: { readonly google?: Schluesselquelle; readonly apple?: Schluesselquelle };
  readonly nonces?: NonceSpeicher;
  /** Kommt die Anfrage aus der App (iOS oder Android)? Siehe APP_ORIGINS in app.ts. */
  readonly istApp: (origin: string | undefined) => boolean;
  readonly setSession: (reply: FastifyReply, token: string) => void;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly limitAuth: Grenze;
  readonly limitSchreiben: Grenze;
}

/**
 * Grenze fuer die Nonce-Ausgabe. Weiter als LIMIT_AUTH: Der Auth-Bildschirm
 * holt beim Oeffnen eine, danach alle zehn Minuten und nach jedem Versuch —
 * eine Party hinter einem WLAN kaeme mit 30 je Viertelstunde nicht hin. Den
 * Speicher schuetzt dessen eigene Obergrenze (nonce.ts).
 */
const LIMIT_NONCE = { max: 120, timeWindow: '15 minutes' };

/** Nur ein Gast muss es beim Verknuepfen mitschicken; alle anderen haben es schon. */
const GEBURTSTAG = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export function anbieterRouten(app: FastifyInstance, deps: AnbieterRoutenDeps): void {
  const nonces = deps.nonces ?? new NonceSpeicher();
  const scheine = new Anmeldescheine();

  const googleProfil = async (credential: string): Promise<AnbieterProfil> => {
    if (!deps.googleClientId) throw badRequest('googleLoginDisabled');
    return pruefeGoogleToken(credential, {
      clientId: deps.googleClientId,
      nonces,
      quelle: deps.schluessel?.google,
    });
  };

  const appleProfil = async (
    idToken: string,
    vorname: string | null,
  ): Promise<AnbieterProfil> => {
    if (!deps.appleClientId) throw badRequest('appleLoginDisabled');
    return pruefeAppleToken(idToken, {
      clientId: deps.appleClientId,
      nonces,
      vorname,
      quelle: deps.schluessel?.apple,
    });
  };

  /** Wie beim Passwort-Login: Nur die iOS-Huelle bekommt das Token selbst. */
  const anmelden = async (
    request: FastifyRequest,
    reply: FastifyReply,
    profil: AnbieterProfil,
  ) => {
    const ergebnis = await anmeldenMitAnbieter(deps.auth, profil, scheine);
    // Neues Konto: noch keine Sitzung, erst das Geburtsdatum (anbieter.ts,
    // Regel 5). Der Client fragt es und kommt mit dem Schein wieder.
    if ('schein' in ergebnis) return reply.send(ergebnis);
    return sitzung(request, reply, ergebnis);
  };

  const sitzung = (
    request: FastifyRequest,
    reply: FastifyReply,
    { token, accountId, neu }: { token: string; accountId: string; neu: boolean },
  ) => {
    deps.setSession(reply, token);
    if (deps.istApp(request.headers.origin)) {
      return reply.send({ ok: true, accountId, neu, token });
    }
    return reply.send({ ok: true, accountId, neu });
  };

  /**
   * Ob "Mit Google anmelden" moeglich ist, entscheidet allein der Server —
   * der Client fragt hier VOR der Anmeldung nach. Bewusst ein eigener kleiner
   * Endpunkt statt einer Build-Variablen: Die Client-ID haengt an der
   * Umgebung, nicht am gebauten Buendel.
   */
  app.get('/api/auth/google/config', async (_request, reply) => {
    return reply.send({ clientId: deps.googleClientId ?? null });
  });

  /**
   * Apple braucht zur Client-ID (der Services ID) eine Return-URL, die im
   * Entwicklerkonto eingetragen ist — auch im Popup-Modus, obwohl dort nie
   * jemand dorthin navigiert: Apple prueft die Angabe beim Oeffnen des
   * Dialogs und schickt die Antwort an deren Herkunft.
   */
  app.get('/api/auth/apple/config', async (_request, reply) => {
    const an = Boolean(deps.appleClientId && deps.appleRedirectUri);
    return reply.send({
      clientId: an ? deps.appleClientId : null,
      redirectUri: an ? deps.appleRedirectUri : null,
    });
  });

  /**
   * Eine frische Nonce fuer den naechsten Anbieter-Dialog.
   *
   * POST und `no-store`: Sie darf in keinem Zwischenspeicher liegen bleiben,
   * sonst bekaemen zwei Geraete dieselbe, und das zweite scheiterte.
   */
  app.post('/api/auth/nonce', { config: { rateLimit: LIMIT_NONCE } }, async (_request, reply) => {
    void reply.header('cache-control', 'no-store');
    return reply.send({ nonce: nonces.ausgeben() });
  });

  app.post('/api/auth/google', { config: { rateLimit: deps.limitAuth } }, async (request, reply) => {
    if (!deps.googleClientId) throw badRequest('googleLoginDisabled');
    const { credential } = z.object({ credential: z.string().min(1).max(8192) }).parse(request.body);
    return anmelden(request, reply, await googleProfil(credential));
  });

  app.post('/api/auth/apple', { config: { rateLimit: deps.limitAuth } }, async (request, reply) => {
    if (!deps.appleClientId) throw badRequest('appleLoginDisabled');
    const body = z
      .object({
        idToken: z.string().min(1).max(8192),
        // Nur beim allerersten Mal gefuellt — siehe apple.ts.
        vorname: z.string().max(60).optional(),
      })
      .parse(request.body);
    return anmelden(request, reply, await appleProfil(body.idToken, body.vorname ?? null));
  });

  /**
   * Erstanmeldung abschliessen: Geburtsdatum zum Schein. Dieselbe Pruefung
   * wie `/api/auth/register`; unter 18 dieselbe Absage, und der Schein ist weg.
   */
  app.post(
    '/api/auth/anbieter/abschliessen',
    { config: { rateLimit: deps.limitAuth } },
    async (request, reply) => {
      const body = z
        .object({
          schein: z.string().min(1).max(100),
          birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(request.body);
      const ergebnis = await schliesseAnmeldungAb(deps.auth, scheine, body.schein, body.birthday);
      return sitzung(request, reply, ergebnis);
    },
  );

  /**
   * Return-URL fuer Apple. Im Popup-Modus kommt hier niemand an; sollte Apple
   * doch einmal hierher weiterleiten (Popup blockiert und vom Browser in einen
   * Tab verwandelt), landet die Person auf der Startseite statt vor einer
   * weissen Fehlerseite. Ein Code, der hier ankaeme, wird bewusst NICHT
   * eingeloest — das braeuchte das client_secret, siehe apple.ts.
   */
  const zurueck = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.redirect('/', 303);
  app.get('/api/auth/apple/rueckweg', zurueck);
  app.post('/api/auth/apple/rueckweg', zurueck);

  /**
   * Domain-Nachweis fuer Apple, falls das Entwicklerkonto ihn verlangt.
   *
   * Aus der Umgebung und nicht als Datei im Client: Staging und Produktion
   * sind zwei Domains mit zwei Nachweisen, und die Datei ist kein Geheimnis,
   * gehoert aber zur Ausgabe, nicht zum Quelltext.
   */
  app.get('/.well-known/apple-developer-domain-association.txt', async (_request, reply) => {
    if (!deps.appleDomainVerknuepfung) throw notFound();
    return reply.type('text/plain; charset=utf-8').send(deps.appleDomainVerknuepfung);
  });

  // -------------------------------------------------------------------------
  // Einstellungen: Anmeldearten des angemeldeten Kontos
  // -------------------------------------------------------------------------

  app.get('/api/me/anmeldung', async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    return reply.send(await anmeldeartenVon(deps.db, accountId));
  });

  app.post(
    '/api/me/anmeldung/google',
    { config: { rateLimit: deps.limitAuth } },
    async (request, reply) => {
      const accountId = await deps.requireAccount(request);
      const { credential, birthday } = z
        .object({ credential: z.string().min(1).max(8192), birthday: GEBURTSTAG })
        .parse(request.body);
      const ergebnis = await verknuepfeAnbieter(
        deps.db,
        accountId,
        await googleProfil(credential),
        birthday,
      );
      return reply.send({ ok: true, ...ergebnis });
    },
  );

  app.post(
    '/api/me/anmeldung/apple',
    { config: { rateLimit: deps.limitAuth } },
    async (request, reply) => {
      const accountId = await deps.requireAccount(request);
      const { idToken, birthday } = z
        .object({ idToken: z.string().min(1).max(8192), birthday: GEBURTSTAG })
        .parse(request.body);
      const ergebnis = await verknuepfeAnbieter(
        deps.db,
        accountId,
        await appleProfil(idToken, null),
        birthday,
      );
      return reply.send({ ok: true, ...ergebnis });
    },
  );

  app.delete(
    '/api/me/anmeldung/:anbieter',
    { config: { rateLimit: deps.limitSchreiben } },
    async (request, reply) => {
      const accountId = await deps.requireAccount(request);
      const { anbieter } = z.object({ anbieter: z.string() }).parse(request.params);
      if (!istAnbieter(anbieter)) throw notFound('anbieterNichtVerknuepft');
      await trenneAnbieter(deps.db, accountId, anbieter);
      return reply.send({ ok: true });
    },
  );
}
