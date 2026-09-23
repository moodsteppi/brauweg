/**
 * Pruefung eines OpenID-Connect-ID-Tokens gegen die Schluessel des Ausstellers.
 *
 * Google und Apple stellen beide ein RS256-signiertes JWT aus und legen ihre
 * oeffentlichen Schluessel als JWKS unter einer festen Adresse ab. Geprueft
 * wird hier mit `node:crypto` selbst, ohne JWT-Bibliothek: Gebraucht wird
 * genau EIN Verfahren (RS256), und jede Bibliothek braechte die Verfahren mit,
 * vor denen man sich bei JWT schuetzen muss — `alg: none` und HS256 mit dem
 * oeffentlichen Schluessel als "Geheimnis". Hier gibt es sie schlicht nicht.
 *
 * Bis zum 23.09.2026 ging Google ueber den tokeninfo-Endpunkt. Den nennt
 * Google selbst ausdruecklich ein Werkzeug zur Fehlersuche, nicht fuer den
 * Betrieb (gedrosselt, ein Netzaufruf je Anmeldung, und ein Ausfall dort ist
 * ein Ausfall hier). Mit Apple kam ein zweiter Aussteller, der keinen solchen
 * Endpunkt hat — also pruefen jetzt beide denselben Weg.
 */

import { createPublicKey, verify, type JsonWebKey, type KeyObject } from 'node:crypto';

/** Warum ein Token abgewiesen wurde — fuer Tests und das Protokoll, nie fuer den Client. */
export class IdTokenFehler extends Error {
  constructor(readonly grund: string) {
    super(`ID-Token abgewiesen: ${grund}`);
    this.name = 'IdTokenFehler';
  }
}

/** Liefert den oeffentlichen Schluessel zu einer Schluesselkennung (`kid`). */
export interface Schluesselquelle {
  schluessel(kid: string): Promise<KeyObject | null>;
}

interface Jwks {
  readonly keys?: readonly (JsonWebKey & { kid?: string; use?: string })[];
}

function schluesselAus(jwks: Jwks): Map<string, KeyObject> {
  const karte = new Map<string, KeyObject>();
  for (const jwk of jwks.keys ?? []) {
    // Nur Signaturschluessel vom Typ RSA. Ein Schluessel ohne Kennung ist
    // nicht zuzuordnen und wird uebergangen, statt die ganze Liste zu kippen.
    if (!jwk.kid || jwk.kty !== 'RSA' || (jwk.use && jwk.use !== 'sig')) continue;
    try {
      karte.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
    } catch {
      /* Ein kaputter Eintrag darf die uebrigen nicht mitnehmen. */
    }
  }
  return karte;
}

/** Feste Schluessel — fuer Tests mit selbst erzeugten Schluesselpaaren. */
export function festeSchluessel(jwks: Jwks): Schluesselquelle {
  const karte = schluesselAus(jwks);
  return { schluessel: async (kid) => karte.get(kid) ?? null };
}

/** Wie lange eine Schluesselliste hoechstens und mindestens als frisch gilt. */
const FRISCH_MIN_MS = 5 * 60_000;
const FRISCH_MAX_MS = 24 * 3600_000;
const FRISCH_VORGABE_MS = 3600_000;
/**
 * Ein unbekanntes `kid` loest einen neuen Abruf aus — aber hoechstens einmal
 * je Minute. Sonst koennte jeder mit erfundenen Kennungen den Server dazu
 * bringen, Google oder Apple im Takt der Anfragen abzufragen.
 */
const NACHFRAGE_SPERRE_MS = 60_000;

/**
 * Schluessel von einer JWKS-Adresse, zwischengespeichert.
 *
 * Die Frische kommt aus `cache-control: max-age` der Antwort (Google setzt
 * dort einige Stunden, Apple gar nichts — dann eine Stunde). Beide wechseln
 * ihre Schluessel ueberlappend: Ein neues `kid` steht in der Liste, bevor es
 * zum ersten Mal signiert. Faellt der Abruf aus, gilt die alte Liste weiter;
 * ein kurzer Ausfall beim Aussteller soll nicht alle Anmeldungen hier sperren.
 */
export function schluesselVonAdresse(
  adresse: string,
  optionen: { holen?: typeof fetch; jetzt?: () => number } = {},
): Schluesselquelle {
  const holen = optionen.holen ?? fetch;
  const jetzt = optionen.jetzt ?? Date.now;
  let karte = new Map<string, KeyObject>();
  let frischBis = 0;
  let letzterAbruf = -Infinity;
  let laufend: Promise<void> | null = null;

  const abrufen = (): Promise<void> => {
    if (laufend) return laufend;
    letzterAbruf = jetzt();
    laufend = (async () => {
      try {
        const antwort = await holen(adresse, { signal: AbortSignal.timeout(5_000) });
        if (!antwort.ok) throw new Error(`JWKS ${antwort.status}`);
        const neu = schluesselAus((await antwort.json()) as Jwks);
        if (neu.size === 0) throw new Error('JWKS leer');
        karte = neu;
        const maxAge = /max-age=(\d+)/.exec(antwort.headers.get('cache-control') ?? '');
        const dauer = maxAge ? Number(maxAge[1]) * 1000 : FRISCH_VORGABE_MS;
        frischBis = jetzt() + Math.min(FRISCH_MAX_MS, Math.max(FRISCH_MIN_MS, dauer));
      } catch (fehler) {
        // eslint-disable-next-line no-console
        console.error(`Schluesselabruf ${adresse} fehlgeschlagen:`, fehler);
      } finally {
        laufend = null;
      }
    })();
    return laufend;
  };

  return {
    async schluessel(kid) {
      const abgelaufen = jetzt() >= frischBis;
      const unbekannt = !karte.has(kid) && jetzt() - letzterAbruf >= NACHFRAGE_SPERRE_MS;
      if (abgelaufen || unbekannt) await abrufen();
      return karte.get(kid) ?? null;
    },
  };
}

export interface Erwartung {
  readonly quelle: Schluesselquelle;
  /** Zulaessige `iss`-Werte. Google kennt zwei Schreibweisen, Apple eine. */
  readonly aussteller: readonly string[];
  /** Die eigene Client-ID — `aud` muss sie nennen. */
  readonly zielgruppe: string;
  readonly jetzt?: () => number;
}

/**
 * Spielraum fuer abweichende Uhren. Eine Minute: genug fuer ein Handy, dessen
 * Uhr etwas nachgeht, zu wenig, um ein abgelaufenes Token nennenswert zu
 * verlaengern.
 */
const SPIELRAUM_S = 60;
/** Laenger ist kein echtes ID-Token; die Grenze haelt Unsinn vom Parser fern. */
const HOECHSTLAENGE = 8192;

function teilJson(teil: string, name: string): Record<string, unknown> {
  try {
    const wert: unknown = JSON.parse(Buffer.from(teil, 'base64url').toString('utf8'));
    if (wert && typeof wert === 'object' && !Array.isArray(wert)) {
      return wert as Record<string, unknown>;
    }
  } catch {
    /* faellt unten durch */
  }
  throw new IdTokenFehler(`${name} unlesbar`);
}

/**
 * Prueft Signatur, Aussteller, Zielgruppe und Laufzeit und gibt die Angaben
 * des Tokens zurueck. Wirft `IdTokenFehler` bei jedem Mangel.
 *
 * Die Nonce prueft der Aufrufer: Sie haengt an einem Speicher, den nur er hat.
 */
export async function pruefeIdToken(
  token: string,
  erwartung: Erwartung,
): Promise<Record<string, unknown>> {
  if (token.length > HOECHSTLAENGE) throw new IdTokenFehler('zu lang');
  const teile = token.split('.');
  if (teile.length !== 3 || teile.some((t) => t.length === 0)) {
    throw new IdTokenFehler('kein JWT');
  }
  const [kopfTeil, rumpfTeil, signaturTeil] = teile as [string, string, string];

  const kopf = teilJson(kopfTeil, 'Kopf');
  // Genau RS256. Alles andere — "none", HS256, ES256 — ist hier ein Angriff
  // oder ein Irrtum, und beides wird gleich behandelt.
  if (kopf.alg !== 'RS256') throw new IdTokenFehler(`Verfahren ${String(kopf.alg)}`);
  if (typeof kopf.kid !== 'string' || kopf.kid.length === 0) {
    throw new IdTokenFehler('keine Schluesselkennung');
  }

  const schluessel = await erwartung.quelle.schluessel(kopf.kid);
  if (!schluessel) throw new IdTokenFehler('Schluessel unbekannt');

  const echt = verify(
    'RSA-SHA256',
    Buffer.from(`${kopfTeil}.${rumpfTeil}`),
    schluessel,
    Buffer.from(signaturTeil, 'base64url'),
  );
  if (!echt) throw new IdTokenFehler('Signatur');

  const rumpf = teilJson(rumpfTeil, 'Rumpf');
  const jetztS = Math.floor((erwartung.jetzt ?? Date.now)() / 1000);

  if (typeof rumpf.iss !== 'string' || !erwartung.aussteller.includes(rumpf.iss)) {
    throw new IdTokenFehler('Aussteller');
  }
  // `aud` darf laut Standard eine Liste sein. Das ist die eigentliche Sicherung:
  // Ein echtes, gueltiges Token fuer eine FREMDE App darf hier nichts oeffnen.
  const aud = rumpf.aud;
  const passt = Array.isArray(aud) ? aud.includes(erwartung.zielgruppe) : aud === erwartung.zielgruppe;
  if (!passt) throw new IdTokenFehler('Zielgruppe');

  if (typeof rumpf.exp !== 'number' || rumpf.exp + SPIELRAUM_S <= jetztS) {
    throw new IdTokenFehler('abgelaufen');
  }
  if (typeof rumpf.iat === 'number' && rumpf.iat - SPIELRAUM_S > jetztS) {
    throw new IdTokenFehler('aus der Zukunft');
  }
  if (typeof rumpf.sub !== 'string' || rumpf.sub.length === 0 || rumpf.sub.length > 255) {
    throw new IdTokenFehler('keine Kennung');
  }
  return rumpf;
}

/**
 * Wahrheitswert aus einem Token. Apple liefert `email_verified` mal als
 * `true`, mal als `"true"`, je nach Alter des Kontos — beides zaehlt.
 */
export function wahr(wert: unknown): boolean {
  return wert === true || wert === 'true';
}
