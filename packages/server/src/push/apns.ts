/**
 * APNs-Sender: Apple Push Notification service ueber HTTP/2 mit JWT.
 *
 * **Nur Node-Bordmittel (`node:http2`, `node:crypto`), keine Bibliothek.**
 * Begruendung: Der ganze Weg sind drei Handgriffe — ein ES256-JWT signieren,
 * eine HTTP/2-Verbindung zu Apple offen halten, je Mitteilung ein POST. Die
 * verbreiteten Pakete (`apn`, `@parse/node-apn`, `node-apn`) bringen dafuer
 * eigene HTTP/2-Schichten, Zertifikats-Altlasten und einen Baum von
 * Abhaengigkeiten mit, die in einem Server mit Sitzungs- und Kontodaten jede
 * fuer sich ein Einfallstor sind und bei jedem Node-Sprung nachgezogen
 * werden muessen. `fetch` taugt nicht: Es spricht in Node HTTP/1.1, und Apple
 * nimmt nur HTTP/2 an. `crypto.sign` kann ES256 seit Node 12 von Haus aus,
 * mit `dsaEncoding: 'ieee-p1363'` sogar gleich in der Form (r‖s), die JWT
 * verlangt.
 *
 * Der Schluessel (APNS_KEY, Inhalt der .p8 aus Toms Apple-Konto) wird genau
 * einmal gelesen, zu einem KeyObject gemacht und danach nie wieder als Text
 * angefasst. Er erscheint in keiner Zeile, keinem Fehler und keiner Antwort.
 */

import { connect, constants, type ClientHttp2Session } from 'node:http2';
import { createPrivateKey, sign, type KeyObject } from 'node:crypto';

import { base64url, tokenKurz, type Mitteilung, type PushSender, type Zustellung } from './sender.js';

export type ApnsUmgebung = 'production' | 'sandbox';

export interface ApnsKonfig {
  readonly keyId: string;
  readonly teamId: string;
  /** Der private Schluessel, schon gelesen (`leseApnsSchluessel`). */
  readonly schluessel: KeyObject;
  readonly bundleId: string;
  readonly umgebung: ApnsUmgebung;
}

export interface ApnsOptionen {
  /** Nur Tests: ein eigener HTTP/2-Server statt Apple (`http://127.0.0.1:…`). */
  readonly basis?: string;
  /** Sekunden seit 1970 — fuer Tests vorstellbar. */
  readonly jetzt?: () => number;
  readonly protokoll?: (zeile: string) => void;
  /** Wie lange eine einzelne Anfrage dauern darf. */
  readonly zeitlimitMs?: number;
}

export const APNS_BASIS: Readonly<Record<ApnsUmgebung, string>> = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
};

/**
 * Wie lange ein JWT wiederverwendet wird.
 *
 * Apple nimmt ein Token hoechstens eine Stunde an und lehnt es ab, wenn es
 * haeufiger als alle zwanzig Minuten erneuert wird
 * (`TooManyProviderTokenUpdates`). 50 Minuten liegen sicher dazwischen.
 */
export const APNS_JWT_GUELTIG_S = 50 * 60;

/**
 * Macht aus dem Rohwert der Variablen einen privaten Schluessel.
 *
 * Railway-Variablen sind einzeilig gedacht; wer die .p8 hineinkopiert,
 * bekommt je nach Weg echte Zeilenumbrueche, woertliche `\n` oder — wenn
 * er nur den Rumpf kopiert — gar keine Kopfzeile. Alle drei Formen und
 * zusaetzlich Base64 der ganzen Datei werden angenommen. Scheitert es, kommt
 * `null` zurueck und NIE eine Fehlermeldung von OpenSSL: Die koennte Teile
 * der Eingabe zitieren.
 */
// Kopf und Fuss stueckweise, damit die Geheimnis-Suche die leere Vorlage nicht
// fuer einen eingecheckten Schluessel haelt.
const PEM_KOPF = ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ');
const PEM_FUSS = ['-----END', 'PRIVATE', 'KEY-----'].join(' ');

export function leseApnsSchluessel(roh: string): KeyObject | null {
  const kandidaten: string[] = [];
  const text = roh.trim().replace(/\\n/g, '\n');
  kandidaten.push(text);
  if (!text.includes('-----BEGIN')) {
    const entpackt = Buffer.from(text, 'base64').toString('utf8');
    if (entpackt.includes('-----BEGIN')) kandidaten.push(entpackt.trim());
    const rumpf = text.replace(/\s+/g, '');
    const zeilen = rumpf.match(/.{1,64}/g) ?? [];
    kandidaten.push(`${PEM_KOPF}\n${zeilen.join('\n')}\n${PEM_FUSS}`);
  }
  for (const pem of kandidaten) {
    try {
      const schluessel = createPrivateKey({ key: pem, format: 'pem' });
      // Apple gibt ausschliesslich P-256-Schluessel aus. Ein RSA-Schluessel
      // (etwa versehentlich das Firebase-Dienstkonto) waere hier falsch.
      if (schluessel.asymmetricKeyType === 'ec') return schluessel;
    } catch {
      /* naechste Form versuchen */
    }
  }
  return null;
}

/** Das Anbieter-JWT fuer Apple: ES256, `kid` im Kopf, `iss`+`iat` im Rumpf. */
export function apnsJwt(konfig: Pick<ApnsKonfig, 'keyId' | 'teamId' | 'schluessel'>, iat: number): string {
  const kopf = base64url(JSON.stringify({ alg: 'ES256', kid: konfig.keyId }));
  const rumpf = base64url(JSON.stringify({ iss: konfig.teamId, iat }));
  const signatur = sign('sha256', Buffer.from(`${kopf}.${rumpf}`), {
    key: konfig.schluessel,
    dsaEncoding: 'ieee-p1363',
  });
  return `${kopf}.${rumpf}.${base64url(signatur)}`;
}

/** Was Apple als Rumpf erwartet (`aps` plus eigene Felder daneben). */
export function apnsRumpf(mitteilung: Mitteilung): string {
  return JSON.stringify({
    aps: {
      alert: { title: mitteilung.titel, body: mitteilung.text },
      sound: 'default',
      ...(mitteilung.sammelKennung ? { 'thread-id': mitteilung.sammelKennung } : {}),
    },
    ...mitteilung.daten,
  });
}

/** Gruende, bei denen Apple das Token selbst fuer tot erklaert. */
const UNGUELTIG_GRUENDE = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic']);

export class ApnsSender implements PushSender {
  readonly art = 'apns' as const;
  private sitzung: ClientHttp2Session | null = null;
  private jwt: { text: string; iat: number } | null = null;
  private readonly basis: string;
  private readonly jetzt: () => number;
  private readonly protokoll: (zeile: string) => void;
  private readonly zeitlimitMs: number;

  constructor(
    private readonly konfig: ApnsKonfig,
    optionen: ApnsOptionen = {},
  ) {
    this.basis = optionen.basis ?? APNS_BASIS[konfig.umgebung];
    this.jetzt = optionen.jetzt ?? (() => Math.floor(Date.now() / 1000));
    // eslint-disable-next-line no-console
    this.protokoll = optionen.protokoll ?? ((zeile) => console.error(zeile));
    this.zeitlimitMs = optionen.zeitlimitMs ?? 10_000;
  }

  /** Das aktuelle JWT, bei Bedarf neu signiert. */
  anbieterToken(): string {
    const jetzt = this.jetzt();
    if (!this.jwt || jetzt - this.jwt.iat >= APNS_JWT_GUELTIG_S) {
      this.jwt = { text: apnsJwt(this.konfig, jetzt), iat: jetzt };
    }
    return this.jwt.text;
  }

  async senden(token: string, mitteilung: Mitteilung): Promise<Zustellung> {
    // Geraetetoken sind Hex. Was anders aussieht, geht gar nicht erst an
    // Apple — und landet vor allem nicht als Pfadteil in einer Anfrage.
    if (!/^[0-9a-fA-F]{32,200}$/.test(token)) return 'ungueltig';

    let antwort: { status: number; rumpf: string };
    try {
      antwort = await this.anfrage(token, apnsRumpf(mitteilung));
    } catch (err) {
      this.protokoll(
        `PUSHFEHLER APNs nicht erreichbar (${tokenKurz(token)}): ` +
          (err instanceof Error ? err.message : String(err)).slice(0, 200),
      );
      return 'fehler';
    }
    if (antwort.status === 200) return 'zugestellt';

    const grund = leseGrund(antwort.rumpf);
    // 410: Das Token war einmal gueltig und ist es nicht mehr (App geloescht).
    if (antwort.status === 410 || (grund !== null && UNGUELTIG_GRUENDE.has(grund))) {
      return 'ungueltig';
    }
    // Ein abgelaufenes oder abgelehntes Anbieter-JWT: beim naechsten Mal neu
    // signieren. Das Geraet selbst ist unschuldig.
    if (antwort.status === 403) this.jwt = null;
    this.protokoll(
      `PUSHFEHLER APNs antwortete ${antwort.status}` +
        (grund ? ` (${grund})` : '') +
        ` fuer ${tokenKurz(token)}`,
    );
    return 'fehler';
  }

  schliessen(): void {
    this.sitzung?.close();
    this.sitzung = null;
  }

  /** Eine offene HTTP/2-Verbindung, bei Bedarf neu. Apple will sie langlebig. */
  private verbindung(): ClientHttp2Session {
    if (this.sitzung && !this.sitzung.closed && !this.sitzung.destroyed) return this.sitzung;
    const sitzung = connect(this.basis);
    const weg = (): void => {
      if (this.sitzung === sitzung) this.sitzung = null;
    };
    sitzung.on('error', weg);
    sitzung.on('close', weg);
    sitzung.on('goaway', weg);
    // Die offene Leitung darf den Prozess nicht am Beenden hindern.
    sitzung.unref();
    this.sitzung = sitzung;
    return sitzung;
  }

  private anfrage(token: string, rumpf: string): Promise<{ status: number; rumpf: string }> {
    return new Promise((resolve, reject) => {
      let sitzung: ClientHttp2Session;
      try {
        sitzung = this.verbindung();
      } catch (err) {
        reject(err);
        return;
      }
      const strom = sitzung.request({
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
        authorization: `bearer ${this.anbieterToken()}`,
        'apns-topic': this.konfig.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        // Eine Stunde: Ist das Telefon so lange aus, ist "du bist dran" vorbei.
        'apns-expiration': String(this.jetzt() + 3600),
        'content-type': 'application/json',
      });
      let status = 0;
      let text = '';
      const uhr = setTimeout(() => {
        strom.close(constants.NGHTTP2_CANCEL);
        reject(new Error('Zeitlimit'));
      }, this.zeitlimitMs);
      strom.setEncoding('utf8');
      strom.on('response', (kopf) => {
        status = Number(kopf[constants.HTTP2_HEADER_STATUS] ?? 0);
      });
      strom.on('data', (teil: string) => {
        if (text.length < 4096) text += teil;
      });
      strom.on('end', () => {
        clearTimeout(uhr);
        resolve({ status, rumpf: text });
      });
      strom.on('error', (err) => {
        clearTimeout(uhr);
        reject(err);
      });
      strom.end(rumpf);
    });
  }
}

/** `{"reason":"BadDeviceToken"}` → "BadDeviceToken". */
function leseGrund(rumpf: string): string | null {
  try {
    const grund = (JSON.parse(rumpf) as { reason?: unknown }).reason;
    return typeof grund === 'string' ? grund.slice(0, 60) : null;
  } catch {
    return null;
  }
}
