/**
 * Die beiden Dateien, mit denen iOS und Android einen Einladungslink
 * `https://www.brauweg-spielen.de/beitritt/<CODE>` direkt in der App oeffnen
 * statt im Browser (Universal Links bzw. App Links).
 *
 * Beide Systeme holen die Datei selbst vom Server und vergleichen sie mit dem
 * installierten Paket: Apple ueber Team-ID und Bundle-ID, Google ueber
 * Paketname und den SHA-256-Fingerabdruck des Signierzertifikats. Nichts
 * davon ist geheim — es steht in jeder ausgelieferten App —, aber es haengt
 * an Konten, die dieses Repo nicht kennt (Toms Apple-Konto, der Schluessel
 * der Play-App-Signatur). Deshalb Umgebungsvariablen, und fehlen sie, gibt
 * es die Datei nicht (404): Eine Datei mit Platzhaltern waere fuer beide
 * Systeme eine falsche Zusage, und Android merkt sich ein gescheitertes
 * Pruefen bis zur naechsten Installation.
 *
 *   APPLE_TEAM_ID     zehn Zeichen, developer.apple.com → Membership
 *   APP_BUNDLE_ID     Vorgabe de.broweg.brauweg-spielen (iOS; de.brauweg.app liess sich bei Apple nicht registrieren, 24.09.2026)
 *   ANDROID_PAKET     Vorgabe de.brauweg.app
 *   ANDROID_SHA256    Fingerabdruecke, durch Komma getrennt (Play Console →
 *                     App-Integritaet → App-Signatur; dazu der des eigenen
 *                     Upload-Schluessels, falls ausserhalb von Play verteilt)
 *
 * Ablauf und Fundorte: docs/APP-RELEASE.md.
 */

import type { FastifyInstance } from 'fastify';

export interface AppVerknuepfung {
  readonly appleTeamId: string | null;
  readonly bundleId: string;
  readonly androidPaket: string;
  readonly androidFingerabdruecke: readonly string[];
}

/** Welche Pfade in die App gehoeren. Nur die Einladung (#203). */
export const APP_LINK_PFADE = ['/beitritt/*'] as const;

const TEAM_ID = /^[A-Z0-9]{10}$/;
const FINGERABDRUCK = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function appVerknuepfungAusUmgebung(env: NodeJS.ProcessEnv = process.env): AppVerknuepfung {
  const team = (env.APPLE_TEAM_ID ?? '').trim().toUpperCase();
  return {
    appleTeamId: TEAM_ID.test(team) ? team : null,
    bundleId: (env.APP_BUNDLE_ID ?? '').trim() || 'de.broweg.brauweg-spielen',
    androidPaket: (env.ANDROID_PAKET ?? '').trim() || 'de.brauweg.app',
    androidFingerabdruecke: (env.ANDROID_SHA256 ?? '')
      .split(',')
      .map((f) => f.trim().toUpperCase())
      .filter((f) => FINGERABDRUCK.test(f)),
  };
}

export function appleAppSiteAssociation(v: AppVerknuepfung): object | null {
  if (!v.appleTeamId) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [`${v.appleTeamId}.${v.bundleId}`],
          components: APP_LINK_PFADE.map((pfad) => ({ '/': pfad })),
        },
      ],
    },
  };
}

export function assetLinks(v: AppVerknuepfung): object[] | null {
  if (v.androidFingerabdruecke.length === 0) return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: v.androidPaket,
        sha256_cert_fingerprints: [...v.androidFingerabdruecke],
      },
    },
  ];
}

export function appVerknuepfungRouten(app: FastifyInstance, v: AppVerknuepfung): void {
  // Apple verlangt application/json, OHNE Weiterleitung und ohne Endung.
  // Ohne diese Route bekaeme Apple die index.html (setNotFoundHandler).
  app.get('/.well-known/apple-app-site-association', async (_request, reply) => {
    const inhalt = appleAppSiteAssociation(v);
    if (!inhalt) return reply.status(404).send({ code: 'notFound', messageKey: 'error.notFound' });
    return reply.header('content-type', 'application/json').header('cache-control', 'public, max-age=3600').send(inhalt);
  });

  app.get('/.well-known/assetlinks.json', async (_request, reply) => {
    const inhalt = assetLinks(v);
    if (!inhalt) return reply.status(404).send({ code: 'notFound', messageKey: 'error.notFound' });
    return reply.header('content-type', 'application/json').header('cache-control', 'public, max-age=3600').send(inhalt);
  });
}
