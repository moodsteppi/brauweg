/**
 * Wortlaut der Mails an Spieler — je Sprache.
 *
 * Die Sprache ist die Wahl am Konto (`account.sprache`, `textSprache` in
 * src/sprache.ts), ohne Wahl Deutsch. Bei der Registrierung steht dort noch
 * nichts, die Bestaetigungsmail geht also deutsch hinaus, bis jemand im
 * Profil umstellt.
 *
 * Text- und HTML-Fassung entstehen aus denselben Saetzen, damit sie nicht
 * auseinanderlaufen. Nicht hier: die Testmail der Mail-Diagnose
 * (mail/probe.ts) — die liest nur das Team.
 */

import type { Sprache } from '../sprache.js';
import { baueHtml } from './vorlage.js';

/** Was jede Spielermail ausmacht; `to` setzt der Aufrufer. */
export interface MailInhalt {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

interface Saetze {
  readonly betreff: string;
  readonly ueberschrift: string;
  readonly absaetze: readonly string[];
  readonly knopf: string;
  readonly fussnote: string;
  /** Reiner Textteil: knapper als die HTML-Fassung, der Link steht darin ausgeschrieben. */
  readonly text: string;
}

function zusammen(s: Saetze, sprache: Sprache, publicUrl: string, knopfLink: string): MailInhalt {
  return {
    subject: s.betreff,
    text: s.text,
    html: baueHtml({
      publicUrl,
      ueberschrift: s.ueberschrift,
      absaetze: s.absaetze,
      knopfText: s.knopf,
      knopfLink,
      fussnote: s.fussnote,
      sprache,
    }),
  };
}

const BESTAETIGEN: Readonly<Record<Sprache, (link: string, stunden: number) => Saetze>> = {
  // Der deutsche Wortlaut ist unveraendert aus auth/service.ts uebernommen —
  // samt „bestaetigen" ohne Umlaut im Betreff und Textteil.
  de: (link, stunden) => ({
    betreff: 'Brauweg: E-Mail bestaetigen',
    text: `Willkommen bei Brauweg.\n\nBestaetige deine Adresse: ${link}\n\nDer Link gilt ${stunden} Stunden.`,
    ueberschrift: 'Willkommen bei Brauweg',
    absaetze: ['Schön, dass du dabei bist. Bestätige einmal kurz deine Adresse, dann kann es losgehen.'],
    knopf: 'Adresse bestätigen',
    fussnote: `Der Link gilt ${stunden} Stunden. Hast du dich nicht angemeldet, ignoriere diese Mail einfach.`,
  }),
  en: (link, stunden) => ({
    betreff: 'Brauweg: Confirm your email',
    text: `Welcome to Brauweg.\n\nConfirm your address: ${link}\n\nThe link is valid for ${stunden} hours.`,
    ueberschrift: 'Welcome to Brauweg',
    absaetze: ["Great to have you. Just confirm your address once and you're ready to go."],
    knopf: 'Confirm address',
    fussnote: `The link is valid for ${stunden} hours. If you didn't sign up, simply ignore this email.`,
  }),
};

const ZURUECKSETZEN: Readonly<Record<Sprache, (link: string, stunden: number) => Saetze>> = {
  de: (link, stunden) => ({
    betreff: 'Brauweg: Passwort zuruecksetzen',
    text: `Neues Passwort setzen: ${link}\n\nDer Link gilt ${stunden} Stunden. Warst du das nicht, ignoriere diese Mail.`,
    ueberschrift: 'Neues Passwort setzen',
    absaetze: ['Du hast ein neues Passwort angefordert. Mit dem Knopf unten setzt du es.'],
    knopf: 'Passwort ändern',
    fussnote: `Der Link gilt ${stunden} Stunden. Warst du das nicht, ignoriere diese Mail — dein Passwort bleibt dann unverändert.`,
  }),
  en: (link, stunden) => ({
    betreff: 'Brauweg: Reset your password',
    text: `Set a new password: ${link}\n\nThe link is valid for ${stunden} hours. If this wasn't you, ignore this email.`,
    ueberschrift: 'Set a new password',
    absaetze: ['You asked for a new password. Use the button below to set it.'],
    knopf: 'Change password',
    fussnote: `The link is valid for ${stunden} hours. If this wasn't you, ignore this email — your password stays unchanged.`,
  }),
};

const LOESCHEN: Readonly<Record<Sprache, (code: string, minuten: number) => Saetze>> = {
  de: (code, minuten) => ({
    betreff: 'Brauweg: Code zum Löschen deines Kontos',
    text:
      `Dein Code zum Löschen deines Brauweg-Kontos: ${code}\n\n` +
      `Er gilt ${minuten} Minuten. Warst du das nicht, ignoriere diese Mail — dann bleibt dein Konto, wie es ist.`,
    ueberschrift: 'Konto löschen',
    absaetze: ['Du hast das Löschen deines Kontos angefordert. Gib diesen Code in Brauweg ein:', code],
    knopf: 'Brauweg öffnen',
    fussnote: `Der Code gilt ${minuten} Minuten. Warst du das nicht, ignoriere diese Mail — dann bleibt dein Konto, wie es ist.`,
  }),
  en: (code, minuten) => ({
    betreff: 'Brauweg: Code to delete your account',
    text:
      `Your code to delete your Brauweg account: ${code}\n\n` +
      `It is valid for ${minuten} minutes. If this wasn't you, ignore this email — your account stays as it is.`,
    ueberschrift: 'Delete account',
    absaetze: ['You asked to delete your account. Enter this code in Brauweg:', code],
    knopf: 'Open Brauweg',
    fussnote: `The code is valid for ${minuten} minutes. If this wasn't you, ignore this email — your account stays as it is.`,
  }),
};

export function bestaetigungsMail(sprache: Sprache, publicUrl: string, link: string, stunden: number): MailInhalt {
  return zusammen(BESTAETIGEN[sprache](link, stunden), sprache, publicUrl, link);
}

export function passwortMail(sprache: Sprache, publicUrl: string, link: string, stunden: number): MailInhalt {
  return zusammen(ZURUECKSETZEN[sprache](link, stunden), sprache, publicUrl, link);
}

/** Der Knopf fuehrt nur in die App — der Code wird dort eingetippt. */
export function loeschMail(sprache: Sprache, publicUrl: string, code: string, minuten: number): MailInhalt {
  return zusammen(LOESCHEN[sprache](code, minuten), sprache, publicUrl, publicUrl);
}
