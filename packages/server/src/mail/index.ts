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
 *
 * Seit dem 23.09.2026 sagt jeder Mailer, WAS er ist (`art`), und der
 * Resend-Weg meldet jeden Fehlschlag laut. Anlass: In der Produktion lief
 * wochenlang der Log-Mailer, obwohl die Variable RESEND_API_KEY am Dienst
 * stand — ihr Wert war leer, `createMailer` nahm den leeren Text als "kein
 * Schluessel", und der einzige Hinweis war eine Warnung beim Start, die
 * "fehlt" sagte, waehrend im Dashboard die Variable zu sehen war. Robin holte
 * sich die Codes derweil aus dem Log. Siehe docs/MAIL.md.
 *
 * Was hier NIE in ein Log, eine Antwort oder eine Fehlermeldung gelangt: der
 * Schluessel selbst. Auch nicht, wenn Resend ihn in seiner Fehlermeldung
 * zurueckspiegelt — `entschaerfe` streicht ihn vorher heraus.
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

/** Zustand der Variablen RESEND_API_KEY — nie ihr Wert. */
export type SchluesselZustand = 'gesetzt' | 'leer' | 'fehlt';

/** Ein gescheiterter Versand, so wie ihn die Diagnose zeigen darf. */
export interface Fehlschlag {
  /** ISO-Zeitpunkt. */
  readonly zeit: string;
  /** HTTP-Status von Resend; null, wenn Resend gar nicht erreichbar war. */
  readonly status: number | null;
  /** Resends Fehlerkennung (`validation_error`, `invalid_api_key` …). */
  readonly name: string | null;
  /** Resends Fehlertext, ohne Schluessel und gekuerzt. */
  readonly text: string;
  /** Nur die Domain des Empfaengers — die ganze Adresse gehoert nicht ins Log. */
  readonly empfaengerDomain: string;
}

export interface Mailer {
  /**
   * `resend` stellt wirklich zu, `log` schreibt nur ins Betriebslog. Die
   * Anmeldung haengt daran, ob sie eine Bestaetigung verlangen darf: Einen
   * Link zu fordern, der nie ankommt, sperrt jeden Neuen aus.
   */
  readonly art: 'resend' | 'log';
  /** Absender (MAIL_FROM), wie er an Resend geht. */
  readonly absender: string;
  /** Warum der Log-Mailer laeuft — fuer Startzeile und Diagnose. */
  readonly grund?: string;
  /** Der juengste Fehlschlag seit dem Start, fuer die Diagnose. */
  readonly letzterFehler?: Fehlschlag | null;
  send(mail: Mail): Promise<void>;
}

/** Domain einer Adresse, auch in der Form `Name <a@b.de>`. */
export function mailDomain(adresse: string): string | null {
  const innen = adresse.match(/<([^>]*)>/)?.[1] ?? adresse;
  const at = innen.lastIndexOf('@');
  if (at < 0) return null;
  const domain = innen.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

/**
 * Macht einen fremden Fehlertext logtauglich: Schluessel raus, kurz halten.
 *
 * Der Schluessel wird zweimal gesucht — woertlich und nach Resends Form
 * `re_…`. Das zweite faengt den Fall, dass Resend einen ANDEREN Schluessel
 * nennt oder ihn gekuerzt zurueckgibt.
 */
export function entschaerfe(text: string, schluessel: string | null): string {
  let sauber = text;
  if (schluessel && schluessel.length > 0) sauber = sauber.split(schluessel).join('[Schluessel]');
  sauber = sauber.replace(/re_[A-Za-z0-9_-]{4,}/g, 're_[…]');
  sauber = sauber.replace(/\s+/g, ' ').trim();
  return sauber.length > 300 ? `${sauber.slice(0, 300)}…` : sauber;
}

/** Wird geworfen, wenn Resend eine Mail nicht annimmt. Text ist entschaerft. */
export class MailVersandFehler extends Error {
  constructor(readonly fehlschlag: Fehlschlag) {
    super(
      fehlschlag.status === null
        ? `Resend nicht erreichbar: ${fehlschlag.text}`
        : `Resend antwortete mit ${fehlschlag.status}` +
            (fehlschlag.name ? ` (${fehlschlag.name})` : '') +
            `: ${fehlschlag.text}`,
    );
    this.name = 'MailVersandFehler';
  }
}

export class ConsoleMailer implements Mailer {
  readonly art = 'log' as const;
  /** Fuer Tests einsehbar. */
  readonly sent: Mail[] = [];

  constructor(
    readonly grund = 'kein Versanddienst eingerichtet ist',
    readonly absender = 'Brauweg <noreply@brauweg-spielen.de>',
  ) {}

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

/** Antwort von `GET /domains`, soweit die Diagnose sie braucht. */
export type DomainAbfrage =
  | { readonly ok: true; readonly domains: readonly { name: string; status: string }[] }
  | { readonly ok: false; readonly status: number | null; readonly name: string | null; readonly text: string };

export interface ResendOptionen {
  /** Fuer Tests: ein nachgestelltes `fetch`, damit niemand Resend anfragt. */
  readonly fetch?: typeof fetch;
  /** Ziel der Fehlerzeilen. Standard: `console.error`. */
  readonly protokoll?: (zeile: string) => void;
}

const RESEND_API = 'https://api.resend.com';

export class ResendMailer implements Mailer {
  readonly art = 'resend' as const;
  private fehler: Fehlschlag | null = null;
  private readonly holen: typeof fetch;
  private readonly protokoll: (zeile: string) => void;

  constructor(
    private readonly apiKey: string,
    readonly absender: string,
    optionen: ResendOptionen = {},
  ) {
    this.holen = optionen.fetch ?? ((...args) => fetch(...args));
    // eslint-disable-next-line no-console
    this.protokoll = optionen.protokoll ?? ((zeile) => console.error(zeile));
  }

  get letzterFehler(): Fehlschlag | null {
    return this.fehler;
  }

  async send(mail: Mail): Promise<void> {
    const empfaengerDomain = mailDomain(mail.to) ?? '(ohne Domain)';
    let res: Response;
    try {
      res = await this.holen(`${RESEND_API}/emails`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.absender,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
          ...(mail.html ? { html: mail.html } : {}),
        }),
      });
    } catch (err) {
      throw this.melde({
        status: null,
        name: null,
        text: entschaerfe(err instanceof Error ? err.message : String(err), this.apiKey),
        empfaengerDomain,
      });
    }
    if (!res.ok) {
      const { name, text } = await this.leseFehler(res);
      throw this.melde({ status: res.status, name, text, empfaengerDomain });
    }
  }

  /**
   * Die Domains des Resend-Kontos. Nur fuer die Diagnose — ein Schluessel mit
   * reinem Senderecht (Resends Empfehlung fuer den Betrieb) bekommt hier 401
   * `restricted_api_key`, und das ist dann KEIN Fehler des Versands.
   */
  async domains(): Promise<DomainAbfrage> {
    let res: Response;
    try {
      res = await this.holen(`${RESEND_API}/domains`, {
        headers: { authorization: `Bearer ${this.apiKey}` },
      });
    } catch (err) {
      return {
        ok: false,
        status: null,
        name: null,
        text: entschaerfe(err instanceof Error ? err.message : String(err), this.apiKey),
      };
    }
    if (!res.ok) {
      const { name, text } = await this.leseFehler(res);
      return { ok: false, status: res.status, name, text };
    }
    const rumpf = (await res.json().catch(() => ({}))) as { data?: unknown };
    const liste = Array.isArray(rumpf.data) ? rumpf.data : [];
    return {
      ok: true,
      domains: liste
        .filter((d): d is { name: string; status: string } =>
          typeof (d as { name?: unknown }).name === 'string' &&
          typeof (d as { status?: unknown }).status === 'string',
        )
        .map((d) => ({ name: d.name.toLowerCase(), status: d.status })),
    };
  }

  private async leseFehler(res: Response): Promise<{ name: string | null; text: string }> {
    const roh = await res.text().catch(() => '');
    let name: string | null = null;
    let text = roh;
    try {
      const rumpf = JSON.parse(roh) as { name?: unknown; message?: unknown };
      if (typeof rumpf.name === 'string') name = rumpf.name;
      if (typeof rumpf.message === 'string') text = rumpf.message;
    } catch {
      /* Kein JSON — dann eben der Rohtext. */
    }
    return { name, text: entschaerfe(text || '(leere Antwort)', this.apiKey) };
  }

  /** Merkt sich den Fehlschlag, schreibt ihn ins Log und liefert den Fehler. */
  private melde(teil: Omit<Fehlschlag, 'zeit'>): MailVersandFehler {
    const fehlschlag: Fehlschlag = { zeit: new Date().toISOString(), ...teil };
    this.fehler = fehlschlag;
    const fehler = new MailVersandFehler(fehlschlag);
    // "MAILFEHLER" als feste Marke: Danach sucht man im Railway-Log.
    this.protokoll(
      `MAILFEHLER ${fehler.message} — Empfaenger-Domain ${fehlschlag.empfaengerDomain}, ` +
        `Absender-Domain ${mailDomain(this.absender) ?? '(keine)'}`,
    );
    return fehler;
  }
}

/** Zustand der Variablen aus ihrem Rohwert — liest ihn, gibt ihn nie heraus. */
export function schluesselZustand(roh: string | undefined | null): SchluesselZustand {
  if (roh === undefined || roh === null) return 'fehlt';
  return roh.trim().length === 0 ? 'leer' : 'gesetzt';
}

export interface MailerWahl {
  readonly mailer: Mailer;
  /** Die eine Startzeile: welcher Mailer und warum. Ohne Schluesselwert. */
  readonly zeile: string;
}

/**
 * Waehlt den Mailer und begruendet die Wahl in einer Zeile.
 *
 * Genau diese Bedingung stand bis zum 23.09.2026 als `apiKey ? … : …` in
 * `createMailer` und war der Grund, warum in der Produktion nichts ankam:
 * Ein leerer Wert und eine fehlende Variable sahen gleich aus. Jetzt nennt
 * die Zeile den Unterschied, und ein Wert aus lauter Leerzeichen zaehlt als
 * leer statt als Schluessel.
 */
export function waehleMailer(
  rohSchluessel: string | undefined | null,
  absender: string,
  publicUrl: string,
  optionen: ResendOptionen = {},
): MailerWahl {
  const zustand = schluesselZustand(rohSchluessel);
  const absenderDomain = mailDomain(absender) ?? '(keine)';

  if (zustand !== 'gesetzt') {
    const grund =
      zustand === 'fehlt'
        ? 'RESEND_API_KEY nicht gesetzt ist'
        : 'RESEND_API_KEY gesetzt, aber leer ist';
    return {
      mailer: new ConsoleMailer(grund, absender),
      zeile:
        `Mailversand: NUR LOG, weil ${grund}. Bestaetigungs- und Passwortmails ` +
        `gehen an niemanden hinaus, sie stehen nur hier im Log (Suche "MAIL an"). ` +
        `Einrichten: docs/MAIL.md.`,
    };
  }

  const schluessel = (rohSchluessel as string).trim();
  const hinweise: string[] = [];
  // Nur die Form, nie der Inhalt: Resend-Schluessel beginnen mit "re_". Ein
  // Platzhalter wie "xxx" oder "changeme" faellt so schon beim Start auf.
  if (!schluessel.startsWith('re_')) hinweise.push('Schluessel beginnt nicht mit "re_" — Platzhalter?');
  if (absenderDomain === 'resend.dev') {
    hinweise.push('Absender auf resend.dev: Resend stellt dann nur an die Adresse des Resend-Kontos zu');
  }
  if (/localhost|127\.0\.0\.1/.test(publicUrl)) hinweise.push(`Links zeigen auf ${publicUrl}`);

  return {
    mailer: new ResendMailer(schluessel, absender, optionen),
    zeile:
      `Mailversand: Resend (RESEND_API_KEY gesetzt), Absender-Domain ${absenderDomain}, ` +
      `Links auf ${publicUrl}` +
      (hinweise.length > 0 ? `. ACHTUNG: ${hinweise.join('; ')}` : ''),
  };
}

/** Alte Form, fuer Aufrufer ohne Begruendung. */
export function createMailer(apiKey: string | null, from: string): Mailer {
  return waehleMailer(apiKey, from, '').mailer;
}
