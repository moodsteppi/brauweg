/**
 * Versandschicht fuer Push-Mitteilungen — die Schnittstelle und der Log-Sender.
 *
 * Gebaut nach dem Muster des Mailers (mail/index.ts): Ohne Konfiguration
 * laeuft ein Sender, der nur ins Log schreibt, und die Startzeile sagt das.
 * So laesst sich der ganze Ablauf — Anlass, Drosselung, Empfaenger — schon
 * pruefen, bevor Toms APNs-Schluessel und das Firebase-Projekt da sind.
 *
 * Ein Sender kennt genau EINE Plattform. APNs und FCM teilen sich keinen
 * einzigen Handgriff (HTTP/2 mit ES256 gegen HTTP/1.1 mit OAuth), und ein
 * gemeinsamer Sender waere nur eine Weiche, die jeder Test mitschleppt.
 *
 * Was nie in ein Log gelangt: Schluessel, Dienstkonto, Zugriffstoken — und
 * das Geraetetoken nur als letzte sechs Zeichen (`tokenKurz`). Ein volles
 * Token ist eine Zustelladresse; wer es liest, kann dem Geraet mit dem
 * passenden Schluessel schreiben.
 */

/** Was auf dem Sperrbildschirm steht, plus Daten fuer die App beim Antippen. */
export interface Mitteilung {
  readonly titel: string;
  readonly text: string;
  /**
   * Kleine Zusatzdaten, nur Zeichenketten (FCM verlangt das so). Heute
   * `anlass`, `tableId`, `gameId` — damit die Huelle beim Antippen einmal an
   * den richtigen Tisch springen kann. Nie ein Name, nie eine Adresse.
   */
  readonly daten: Readonly<Record<string, string>>;
  /**
   * Fasst Mitteilungen desselben Tisches zusammen (APNs `thread-id`, FCM
   * `tag`): Eine neue ersetzt am Geraet die alte, statt sich zu stapeln.
   */
  readonly sammelKennung?: string;
}

/**
 * Ergebnis eines Versands.
 *
 * `ungueltig` heisst: Der Dienst sagt, dieses Token gibt es nicht (mehr) —
 * App deinstalliert, Erlaubnis entzogen, falsche Umgebung. Die Zeile wird
 * dann abgeschaltet (`aktiv = false`). `fehler` ist alles andere: Netz weg,
 * Schluessel falsch, Dienst gestoert. Dann bleibt das Token, wie es ist —
 * ein Ausfall bei Apple soll nicht alle Geraete abmelden.
 */
export type Zustellung = 'zugestellt' | 'ungueltig' | 'fehler';

export interface PushSender {
  /** `log` stellt nichts zu; `apns` und `fcm` wirklich. */
  readonly art: 'log' | 'apns' | 'fcm';
  senden(token: string, mitteilung: Mitteilung): Promise<Zustellung>;
  /** Offene Verbindungen schliessen (HTTP/2 zu Apple). */
  schliessen?(): void;
}

/** Die letzten sechs Zeichen — genug, um ein Geraet im Log wiederzufinden. */
export function tokenKurz(token: string): string {
  return token.length <= 6 ? '…' : `…${token.slice(-6)}`;
}

/** Ein Versand, wie ihn der Log-Sender festhaelt (fuer Tests). */
export interface Protokolliert {
  readonly plattform: 'ios' | 'android';
  readonly token: string;
  readonly mitteilung: Mitteilung;
}

/**
 * Stellt nichts zu, schreibt nur eine Zeile.
 *
 * Mit fester Marke "PUSH (nur Log)", damit sich im Railway-Log danach suchen
 * laesst, solange noch kein Schluessel haengt — wie "MAIL an" beim Mailer.
 */
export class LogSender implements PushSender {
  readonly art = 'log' as const;
  /** Fuer Tests einsehbar. */
  readonly gesendet: Protokolliert[] = [];
  private readonly protokoll: (zeile: string) => void;

  constructor(
    readonly plattform: 'ios' | 'android',
    optionen: { readonly protokoll?: (zeile: string) => void } = {},
  ) {
    // eslint-disable-next-line no-console
    this.protokoll = optionen.protokoll ?? ((zeile) => console.info(zeile));
  }

  async senden(token: string, mitteilung: Mitteilung): Promise<Zustellung> {
    this.gesendet.push({ plattform: this.plattform, token, mitteilung });
    this.protokoll(
      `PUSH (nur Log) ${this.plattform} ${tokenKurz(token)}: ` +
        `${mitteilung.titel} — ${mitteilung.text}`,
    );
    return 'zugestellt';
  }
}

/** Base64url ohne Auffuellzeichen, wie JWT es verlangt. */
export function base64url(daten: Buffer | string): string {
  return Buffer.from(daten).toString('base64url');
}
