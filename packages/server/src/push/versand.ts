/**
 * Welcher Sender je Plattform laeuft — aus der Umgebung, mit EINER Startzeile.
 *
 * Wie `waehleMailer` (mail/index.ts): Die Zeile nennt fuer jede Plattform,
 * ob wirklich zugestellt wird, und wenn nicht, welche Variable fehlt oder
 * nicht lesbar ist. Nie einen Wert. Der Anlass beim Mailer war, dass eine
 * leere Variable wochenlang wie eine fehlende aussah; hier kommt dazu, dass
 * APNs vier Variablen braucht und eine vergessene sonst niemand bemerkt.
 */

import { ApnsSender, leseApnsSchluessel, type ApnsOptionen, type ApnsUmgebung } from './apns.js';
import { FcmSender, leseFcmDienstkonto, type FcmOptionen } from './fcm.js';
import { LogSender, type PushSender } from './sender.js';

export interface PushVersand {
  readonly ios: PushSender;
  readonly android: PushSender;
  /** Beide Sender schliessen (Serverende, Testende). */
  schliessen(): void;
}

export interface PushVersandWahl {
  readonly versand: PushVersand;
  /** Die Startzeile. Ohne Werte. */
  readonly zeile: string;
}

type Umgebung = Readonly<Record<string, string | undefined>>;

/** Gesetzt heisst: da und nicht nur Leerzeichen. */
function gesetzt(wert: string | undefined): wert is string {
  return wert !== undefined && wert.trim().length > 0;
}

/**
 * APNS_UMGEBUNG: `production` (Vorgabe — TestFlight und App Store) oder
 * `sandbox` (aus Xcode aufs Kabel gespielte Entwicklungsbauten). Deutsche
 * Schreibweisen gehen auch; alles andere ist ein Tippfehler und wird
 * benannt statt still als Produktion gelesen.
 */
export function leseApnsUmgebung(roh: string | undefined): ApnsUmgebung | null {
  if (!gesetzt(roh)) return 'production';
  const wert = roh.trim().toLowerCase();
  if (wert === 'production' || wert === 'produktion') return 'production';
  if (wert === 'sandbox' || wert === 'development' || wert === 'entwicklung') return 'sandbox';
  return null;
}

export function waehlePushVersand(
  umgebung: Umgebung = process.env,
  optionen: { readonly apns?: ApnsOptionen; readonly fcm?: FcmOptionen; readonly protokoll?: (zeile: string) => void } = {},
): PushVersandWahl {
  const logOptionen = optionen.protokoll ? { protokoll: optionen.protokoll } : {};

  // --- iOS -----------------------------------------------------------------
  let ios: PushSender;
  let iosZeile: string;
  const apnsNamen = ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_KEY', 'APNS_BUNDLE_ID'] as const;
  const apnsFehlt = apnsNamen.filter((name) => !gesetzt(umgebung[name]));
  const apnsUmgebung = leseApnsUmgebung(umgebung.APNS_UMGEBUNG);
  if (apnsFehlt.length === apnsNamen.length) {
    ios = new LogSender('ios', logOptionen);
    iosZeile = 'iOS nur Log (APNS_* nicht gesetzt)';
  } else if (apnsFehlt.length > 0) {
    ios = new LogSender('ios', logOptionen);
    iosZeile = `iOS nur Log (fehlt: ${apnsFehlt.join(', ')})`;
  } else if (apnsUmgebung === null) {
    ios = new LogSender('ios', logOptionen);
    iosZeile = 'iOS nur Log (APNS_UMGEBUNG weder production noch sandbox)';
  } else {
    const schluessel = leseApnsSchluessel(umgebung.APNS_KEY as string);
    if (!schluessel) {
      ios = new LogSender('ios', logOptionen);
      iosZeile = 'iOS nur Log (APNS_KEY ist kein lesbarer P-256-Schluessel — Inhalt der .p8?)';
    } else {
      const bundleId = (umgebung.APNS_BUNDLE_ID as string).trim();
      ios = new ApnsSender(
        {
          keyId: (umgebung.APNS_KEY_ID as string).trim(),
          teamId: (umgebung.APNS_TEAM_ID as string).trim(),
          schluessel,
          bundleId,
          umgebung: apnsUmgebung,
        },
        optionen.apns,
      );
      iosZeile = `iOS ueber APNs (${apnsUmgebung}, ${bundleId})`;
    }
  }

  // --- Android -------------------------------------------------------------
  let android: PushSender;
  let androidZeile: string;
  const fcmRoh = umgebung.FCM_SERVICE_ACCOUNT;
  if (!gesetzt(fcmRoh)) {
    android = new LogSender('android', logOptionen);
    androidZeile =
      fcmRoh === undefined
        ? 'Android nur Log (FCM_SERVICE_ACCOUNT nicht gesetzt)'
        : 'Android nur Log (FCM_SERVICE_ACCOUNT gesetzt, aber leer)';
  } else {
    const konto = leseFcmDienstkonto(fcmRoh);
    if (!konto) {
      android = new LogSender('android', logOptionen);
      androidZeile =
        'Android nur Log (FCM_SERVICE_ACCOUNT ist kein lesbares Dienstkonto — project_id, client_email, private_key?)';
    } else {
      android = new FcmSender(konto, optionen.fcm);
      androidZeile = `Android ueber FCM (Projekt ${konto.projektId})`;
    }
  }

  return {
    versand: {
      ios,
      android,
      schliessen() {
        ios.schliessen?.();
        android.schliessen?.();
      },
    },
    zeile: `Push-Mitteilungen: ${iosZeile}; ${androidZeile}`,
  };
}
