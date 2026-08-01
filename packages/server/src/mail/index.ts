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
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  /** Fuer Tests einsehbar. */
  readonly sent: Mail[] = [];

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
    // eslint-disable-next-line no-console
    console.info(`[mail] an ${mail.to}: ${mail.subject}\n${mail.text}`);
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
