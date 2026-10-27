/**
 * Mail-Diagnose fuer die Aufsicht (`POST /api/staff/mail-probe`).
 *
 * Beantwortet die eine Frage "Warum kommt die Bestaetigungsmail nicht an?"
 * vom Server aus — dort, wo Schluessel und Absender wirklich stehen. Aus dem
 * Railway-Dashboard allein laesst sie sich nicht beantworten: Es zeigt nur,
 * DASS eine Variable da ist, nicht ob ihr Wert leer ist, und Resends Domain-
 * Status steht in einem anderen Dashboard.
 *
 * Die haeufigen Ursachen, die die Antwort auseinanderhalten muss:
 *   - Log-Mailer aktiv (Schluessel fehlt oder ist leer) → `keinVersanddienst`
 *   - Absender auf `onboarding@resend.dev` → `sandbox`: Resend stellt dann
 *     nur an die Adresse des eigenen Resend-Kontos zu
 *   - Absender-Domain im Resend-Konto nicht verifiziert → `pending`,
 *     `not_started`, `failed`, … oder `nichtImKonto`; auch dann liefert Resend
 *     nur an die Kontoadresse
 *   - falscher oder abgelaufener Schluessel → `schluesselUngueltig` (401/403)
 *
 * Die Antwort enthaelt nie den Schluessel — alle Texte von Resend laufen
 * durch `entschaerfe`.
 */

import {
  MailVersandFehler,
  ResendMailer,
  mailDomain,
  type Fehlschlag,
  type Mailer,
} from './index.js';
import { baueHtml } from './vorlage.js';

export type DomainStatus =
  /** Resends eigene Werte, durchgereicht. */
  | 'verified'
  | 'pending'
  | 'not_started'
  | 'partially_verified'
  | 'partially_failed'
  | 'failed'
  | 'temporary_failure'
  /** Eigene Befunde. */
  | 'keinVersanddienst'
  | 'sandbox'
  | 'nichtImKonto'
  | 'schluesselUngueltig'
  /** Schluessel darf nur senden — Status laesst sich nicht abfragen, der Versand zeigt es. */
  | 'nichtAbfragbar'
  | 'nichtErreichbar'
  | 'unbekannt';

export interface MailProbe {
  readonly mailer: 'resend' | 'log';
  readonly absenderDomain: string | null;
  readonly domainStatus: DomainStatus;
  /** Ist die Testmail an die Adresse des angemeldeten Kontos hinausgegangen? */
  readonly versandt: boolean;
  /** Was schiefging, in Resends Worten (entschaerft) oder unseren. */
  readonly fehler: string | null;
  /** Ein Satz: die wahrscheinlichste Ursache und was zu tun ist. */
  readonly diagnose: string;
  /** Wohin die Links in den Mails zeigen (PUBLIC_URL). */
  readonly linkBasis: string;
  /** Juengster Fehlschlag seit dem Serverstart, falls einer da war. */
  readonly letzterFehler: Fehlschlag | null;
}

const RESEND_STATUS = new Set<DomainStatus>([
  'verified',
  'pending',
  'not_started',
  'partially_verified',
  'partially_failed',
  'failed',
  'temporary_failure',
]);

export async function mailProbe(
  mailer: Mailer,
  publicUrl: string,
  empfaenger: string,
): Promise<MailProbe> {
  const absenderDomain = mailDomain(mailer.absender);
  const linkWarnung = /localhost|127\.0\.0\.1/.test(publicUrl)
    ? ` Ausserdem zeigen die Links auf ${publicUrl} — PUBLIC_URL muss die oeffentliche Adresse sein.`
    : '';
  const basis = { mailer: mailer.art, absenderDomain, linkBasis: publicUrl };

  if (!(mailer instanceof ResendMailer)) {
    return {
      ...basis,
      domainStatus: 'keinVersanddienst',
      versandt: false,
      fehler: `Versand laeuft ueber das Log, weil ${mailer.grund ?? 'kein Versanddienst eingerichtet ist'}`,
      diagnose:
        `Versand laeuft ueber das Log, weil ${mailer.grund ?? 'kein Versanddienst eingerichtet ist'}. ` +
        `Niemand bekommt eine Mail; die Links stehen nur im Betriebslog. ` +
        `RESEND_API_KEY mit einem Schluessel aus dem Resend-Dashboard fuellen (docs/MAIL.md).` +
        linkWarnung,
      letzterFehler: mailer.letzterFehler ?? null,
    };
  }

  // 1. Domain-Status. Bei resend.dev gibt es nichts abzufragen: Die Domain
  //    gehoert Resend, und sie ist genau der Sandkasten.
  let domainStatus: DomainStatus = 'unbekannt';
  let abfrageFehler: string | null = null;
  if (absenderDomain === 'resend.dev') {
    domainStatus = 'sandbox';
  } else {
    const abfrage = await mailer.domains();
    if (abfrage.ok) {
      const treffer = abfrage.domains.find((d) => d.name === absenderDomain);
      domainStatus = !treffer
        ? 'nichtImKonto'
        : RESEND_STATUS.has(treffer.status as DomainStatus)
          ? (treffer.status as DomainStatus)
          : 'unbekannt';
    } else if (abfrage.name === 'restricted_api_key' && abfrage.status === 401) {
      domainStatus = 'nichtAbfragbar';
    } else if (abfrage.status === 401 || abfrage.status === 403) {
      domainStatus = 'schluesselUngueltig';
      abfrageFehler = `${abfrage.status}${abfrage.name ? ` ${abfrage.name}` : ''}: ${abfrage.text}`;
    } else if (abfrage.status === null) {
      domainStatus = 'nichtErreichbar';
      abfrageFehler = abfrage.text;
    } else {
      abfrageFehler = `${abfrage.status}${abfrage.name ? ` ${abfrage.name}` : ''}: ${abfrage.text}`;
    }
  }

  // 2. Testmail. Mit ungueltigem Schluessel sparen wir sie uns: Sie scheitert
  //    genauso, und der Grund steht schon da.
  let versandt = false;
  let fehler: string | null = abfrageFehler;
  if (domainStatus !== 'schluesselUngueltig') {
    try {
      await mailer.send({
        to: empfaenger,
        subject: 'Brauweg: Testmail der Mail-Diagnose',
        text:
          'Diese Mail kommt aus der Mail-Diagnose (POST /api/staff/mail-probe).\n\n' +
          'Kommt sie an, stellt Resend zu. Kommen Bestaetigungsmails an andere ' +
          'Adressen trotzdem nicht an, ist die Absender-Domain noch nicht verifiziert.',
        html: baueHtml({
          publicUrl,
          ueberschrift: 'Testmail der Mail-Diagnose',
          absaetze: [
            'Kommt diese Mail an, stellt Resend zu.',
            'Kommen Bestätigungsmails an andere Adressen trotzdem nicht an, ist die Absender-Domain noch nicht verifiziert.',
          ],
          knopfText: 'Zu Brauweg',
          knopfLink: publicUrl,
          fussnote: 'Ausgelöst von einem Testkonto. Du musst nichts tun.',
        }),
      });
      versandt = true;
    } catch (err) {
      fehler = err instanceof MailVersandFehler ? err.message : 'Versand gescheitert';
      const f = err instanceof MailVersandFehler ? err.fehlschlag : null;
      if (f && (f.name === 'invalid_api_key' || f.name === 'missing_api_key' || f.name === 'suspended_api_key')) {
        domainStatus = 'schluesselUngueltig';
      }
    }
  }

  return {
    ...basis,
    domainStatus,
    versandt,
    fehler,
    diagnose: deute(domainStatus, versandt, absenderDomain) + linkWarnung,
    letzterFehler: mailer.letzterFehler,
  };
}

/** Der eine Satz zur Lage. Ordnung: vom haeufigsten Fall zum seltensten. */
function deute(status: DomainStatus, versandt: boolean, domain: string | null): string {
  const d = domain ?? '(keine Domain)';
  switch (status) {
    case 'schluesselUngueltig':
      return 'Resend lehnt den Schluessel ab (401/403). Im Resend-Dashboard einen neuen API-Schluessel erzeugen und RESEND_API_KEY in Railway ersetzen.';
    case 'sandbox':
      return (
        'MAIL_FROM steht auf resend.dev (Sandkasten). Resend stellt dann NUR an die Adresse des Resend-Kontos zu' +
        (versandt ? ' — deshalb kam diese Testmail vielleicht an, andere kommen nicht.' : '.') +
        ' MAIL_FROM auf eine Adresse der verifizierten Domain setzen, z. B. "Brauweg <noreply@brauweg-spielen.de>".'
      );
    case 'nichtImKonto':
      return `Die Absender-Domain ${d} ist im Resend-Konto nicht angelegt. Resend nimmt Mails von ihr nicht an. Domain im Resend-Dashboard hinzufuegen und die DNS-Eintraege setzen.`;
    case 'not_started':
    case 'pending':
    case 'failed':
    case 'temporary_failure':
    case 'partially_verified':
    case 'partially_failed':
      return (
        `Die Absender-Domain ${d} ist bei Resend nicht verifiziert (Status ${status}). ` +
        'Bis dahin stellt Resend nur an die Adresse des Resend-Kontos zu. DNS-Eintraege (SPF, DKIM, MX) pruefen und im Dashboard "Verify" druecken.'
      );
    case 'verified':
      return versandt
        ? `Alles in Ordnung: Domain ${d} verifiziert, Testmail angenommen. Kommt sie nicht an, im Spam nachsehen.`
        : `Domain ${d} ist verifiziert, aber Resend hat die Testmail abgelehnt — siehe "fehler".`;
    case 'nichtAbfragbar':
      return versandt
        ? 'Der Schluessel darf nur senden, den Domain-Status zeigt er deshalb nicht. Die Testmail wurde angenommen. Kommen Mails an andere Adressen nicht an, im Resend-Dashboard unter Domains den Status ansehen.'
        : 'Der Schluessel darf nur senden, und Resend hat die Testmail abgelehnt — siehe "fehler". Meist ist die Domain nicht verifiziert.';
    case 'nichtErreichbar':
      return 'Resend war vom Server aus nicht erreichbar. Spaeter erneut pruefen; haelt es an, Netz des Dienstes pruefen.';
    default:
      return versandt ? 'Testmail angenommen.' : 'Unklarer Zustand — siehe "fehler".';
  }
}
