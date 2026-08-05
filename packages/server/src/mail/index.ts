/**
 * Mailversand.
 *
 * Bestaetigungs- und Passwortmails laufen ueber einen Versanddienst, nicht ueber
 * einen selbst betriebenen Server: selbst versendete Mails landen zuverlaessig
 * im Spam.
 *
 * Ohne RESEND_API_KEY schreibt der Server die Mail ins Log statt sie zu
 * verwerfen. So laesst sich die Anmeldung lokal vollstaendig durchspielen,
 * ohne dass ein fehlender Schluessel unbemerkt bleibt.
 */

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  /**
   * Gestaltete Fassung. Optional, und der Textteil bleibt Pflicht: Er ist
   * die Rueckfallebene fuer Programme ohne HTML, er landet im Log, solange
   * kein Versanddienst haengt, und eine Mail ganz ohne Textteil bewerten
   * Spamfilter schlechter.
   */
  readonly html?: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  /** Fuer Tests einsehbar. */
  readonly sent: Mail[] = [];

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
    // Auffaellig gerahmt, damit sich der Link im Betriebslog mit einer Suche
    // nach "MAIL" finden laesst, solange noch kein Versanddienst haengt.
    // eslint-disable-next-line no-console
    console.info(
      `\n=== MAIL an ${mail.to} =======================================\n` +
        `${mail.subject}\n${mail.text}\n` +
        `=============================================================\n`,
    );
  }
}

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(mail: Mail): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend antwortete mit ${res.status}: ${await res.text()}`);
    }
  }
}

export function createMailer(
  apiKey: string | null,
  from: string,
): Mailer {
  return apiKey ? new ResendMailer(apiKey, from) : new ConsoleMailer();
}
