/**
 * FCM-Sender: Firebase Cloud Messaging, HTTP v1 mit Dienstkonto.
 *
 * Wie bei APNs ohne Bibliothek: `firebase-admin` zieht ueber hundert Pakete
 * nach (gRPC, Google-Auth, Firestore-Typen) — fuer genau zwei Anfragen, die
 * `fetch` und `crypto.sign` von Haus aus koennen. Erstens ein RS256-JWT mit
 * dem Dienstkonto gegen ein Zugriffstoken tauschen (OAuth 2.0, "JWT Bearer
 * Grant"), zweitens je Mitteilung ein POST an `messages:send`.
 *
 * FCM_SERVICE_ACCOUNT ist die JSON-Datei des Dienstkontos als Variable. Der
 * private Schluessel darin und das Zugriffstoken erscheinen in keiner Zeile
 * und keinem Fehler; zitiert wird hoechstens die Projektkennung.
 */

import { createPrivateKey, sign, type KeyObject } from 'node:crypto';

import { base64url, tokenKurz, type Mitteilung, type PushSender, type Zustellung } from './sender.js';

export interface FcmDienstkonto {
  readonly projektId: string;
  readonly clientEmail: string;
  readonly schluessel: KeyObject;
  readonly tokenUri: string;
}

export interface FcmOptionen {
  /** Nur Tests: nachgestelltes `fetch`, damit niemand Google anfragt. */
  readonly fetch?: typeof fetch;
  /** Sekunden seit 1970. */
  readonly jetzt?: () => number;
  readonly protokoll?: (zeile: string) => void;
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';

/**
 * Liest das Dienstkonto aus dem Rohwert der Variablen, oder null.
 *
 * Nimmt das JSON wie heruntergeladen und — weil Railway-Variablen gern
 * einzeilig verlangt werden — auch als Base64. `private_key` enthaelt im
 * JSON woertliche `\n`; JSON.parse macht daraus echte Umbrueche, ein
 * doppelt maskierter Wert wird zusaetzlich zurechtgerueckt.
 */
export function leseFcmDienstkonto(roh: string): FcmDienstkonto | null {
  const text = roh.trim();
  const kandidaten = [text];
  if (!text.startsWith('{')) kandidaten.push(Buffer.from(text, 'base64').toString('utf8').trim());
  for (const kandidat of kandidaten) {
    let daten: Record<string, unknown>;
    try {
      daten = JSON.parse(kandidat) as Record<string, unknown>;
    } catch {
      continue;
    }
    const projektId = daten.project_id;
    const clientEmail = daten.client_email;
    const privat = daten.private_key;
    if (typeof projektId !== 'string' || typeof clientEmail !== 'string' || typeof privat !== 'string') {
      continue;
    }
    try {
      const schluessel = createPrivateKey({ key: privat.replace(/\\n/g, '\n'), format: 'pem' });
      if (schluessel.asymmetricKeyType !== 'rsa') continue;
      const tokenUri = typeof daten.token_uri === 'string' ? daten.token_uri : GOOGLE_TOKEN_URI;
      return { projektId, clientEmail, schluessel, tokenUri };
    } catch {
      continue;
    }
  }
  return null;
}

/** Die Zusicherung fuer Googles Token-Tausch (RS256). */
export function fcmZusicherung(konto: FcmDienstkonto, iat: number): string {
  const kopf = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const rumpf = base64url(
    JSON.stringify({ iss: konto.clientEmail, scope: FCM_SCOPE, aud: konto.tokenUri, iat, exp: iat + 3600 }),
  );
  const signatur = sign('sha256', Buffer.from(`${kopf}.${rumpf}`), konto.schluessel);
  return `${kopf}.${rumpf}.${base64url(signatur)}`;
}

/** Der Rumpf fuer `messages:send`. */
export function fcmNachricht(token: string, mitteilung: Mitteilung): unknown {
  return {
    message: {
      token,
      notification: { title: mitteilung.titel, body: mitteilung.text },
      data: { ...mitteilung.daten },
      android: {
        priority: 'HIGH',
        // Eine Stunde, wie bei APNs: danach ist die Nachricht vorbei.
        ttl: '3600s',
        ...(mitteilung.sammelKennung ? { notification: { tag: mitteilung.sammelKennung } } : {}),
      },
    },
  };
}

export class FcmSender implements PushSender {
  readonly art = 'fcm' as const;
  private zugriff: { token: string; bis: number } | null = null;
  private readonly holen: typeof fetch;
  private readonly jetzt: () => number;
  private readonly protokoll: (zeile: string) => void;

  constructor(
    private readonly konto: FcmDienstkonto,
    optionen: FcmOptionen = {},
  ) {
    this.holen = optionen.fetch ?? ((...args) => fetch(...args));
    this.jetzt = optionen.jetzt ?? (() => Math.floor(Date.now() / 1000));
    // eslint-disable-next-line no-console
    this.protokoll = optionen.protokoll ?? ((zeile) => console.error(zeile));
  }

  get projektId(): string {
    return this.konto.projektId;
  }

  async senden(token: string, mitteilung: Mitteilung): Promise<Zustellung> {
    let zugriff: string;
    try {
      zugriff = await this.zugriffstoken();
    } catch (err) {
      this.protokoll(`PUSHFEHLER FCM-Anmeldung gescheitert: ${(err as Error).message}`);
      return 'fehler';
    }

    let res: Response;
    try {
      res = await this.holen(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.konto.projektId)}/messages:send`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${zugriff}`, 'content-type': 'application/json' },
          body: JSON.stringify(fcmNachricht(token, mitteilung)),
        },
      );
    } catch (err) {
      this.protokoll(
        `PUSHFEHLER FCM nicht erreichbar (${tokenKurz(token)}): ` +
          (err instanceof Error ? err.message : String(err)).slice(0, 200),
      );
      return 'fehler';
    }
    if (res.ok) return 'zugestellt';

    const fehler = await leseFcmFehler(res);
    // UNREGISTERED: Die App ist weg oder das Token abgeloest. Ein
    // INVALID_ARGUMENT, das ausdruecklich das Token meint, ist dasselbe in
    // anderer Form (kaputtes oder fremdes Token) — andere INVALID_ARGUMENT
    // betreffen die Nachricht und sind ein Fehler bei uns, nicht am Geraet.
    if (
      fehler.code === 'UNREGISTERED' ||
      (fehler.code === 'INVALID_ARGUMENT' && /registration token/i.test(fehler.text))
    ) {
      return 'ungueltig';
    }
    if (res.status === 401) this.zugriff = null;
    this.protokoll(
      `PUSHFEHLER FCM antwortete ${res.status}` +
        (fehler.code ? ` (${fehler.code})` : '') +
        ` fuer ${tokenKurz(token)}`,
    );
    return 'fehler';
  }

  /** Zugriffstoken, eine Minute vor Ablauf erneuert. */
  private async zugriffstoken(): Promise<string> {
    const jetzt = this.jetzt();
    if (this.zugriff && this.zugriff.bis > jetzt + 60) return this.zugriff.token;
    const res = await this.holen(this.konto.tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: fcmZusicherung(this.konto, jetzt),
      }).toString(),
    });
    if (!res.ok) throw new Error(`Token-Tausch antwortete ${res.status}`);
    const rumpf = (await res.json().catch(() => ({}))) as { access_token?: unknown; expires_in?: unknown };
    if (typeof rumpf.access_token !== 'string') throw new Error('Token-Tausch ohne access_token');
    const dauer = typeof rumpf.expires_in === 'number' ? rumpf.expires_in : 3600;
    this.zugriff = { token: rumpf.access_token, bis: jetzt + dauer };
    return rumpf.access_token;
  }
}

/** Fehlerkennung aus FCMs Antwort: `details[].errorCode`, sonst `status`. */
async function leseFcmFehler(res: Response): Promise<{ code: string | null; text: string }> {
  const roh = await res.text().catch(() => '');
  try {
    const fehler = (JSON.parse(roh) as { error?: { status?: unknown; message?: unknown; details?: unknown } }).error;
    const details = Array.isArray(fehler?.details) ? fehler.details : [];
    const fcm = details.find(
      (d): d is { errorCode: string } => typeof (d as { errorCode?: unknown }).errorCode === 'string',
    );
    const code = fcm?.errorCode ?? (typeof fehler?.status === 'string' ? fehler.status : null);
    const text = typeof fehler?.message === 'string' ? fehler.message.slice(0, 200) : '';
    return { code, text };
  } catch {
    return { code: null, text: '' };
  }
}
