/**
 * Einmal-Nonces fuer die Anmeldung mit Google und Apple.
 *
 * Ein ID-Token gilt je nach Anbieter bis zu einer Stunde. Wer es in
 * der Zeit abfaengt — aus einem Protokoll, einer Browser-Erweiterung, einem
 * geteilten Bildschirm —, koennte sich damit anmelden, so oft er will. Die
 * Nonce macht es zum Einmalschein: Der Server gibt sie aus, der Client reicht
 * sie beim Oeffnen des Anbieter-Dialogs weiter, der Anbieter schreibt sie
 * signiert ins Token, und hier wird sie genau einmal eingeloest.
 *
 * Im Speicher und nicht in der Datenbank: Der Server laeuft als EIN Prozess
 * (die Tische leben ohnehin im Speicher, siehe runtime/party.ts), und eine
 * Nonce, die ein Neustart verliert, kostet genau einen zweiten Klick. Wird der
 * Dienst einmal auf mehrere Prozesse verteilt, muss dieser Speicher mit.
 */

import { randomBytes } from 'node:crypto';

export class NonceSpeicher {
  private readonly offen = new Map<string, number>();
  private readonly gueltigMs: number;
  private readonly hoechstens: number;
  private readonly jetzt: () => number;

  constructor(
    optionen: {
      /**
       * Fuenfzehn Minuten: Der Auth-Bildschirm holt die Nonce beim Oeffnen, und
       * wer dann erst Kaffee holt, soll nicht scheitern. Der Client holt
       * ausserdem alle zehn Minuten eine frische (AnbieterKnoepfe.tsx).
       */
      gueltigMs?: number;
      /**
       * Obergrenze offener Nonces. Die Ausgabe braucht keine Anmeldung; ohne
       * Grenze liesse sich der Speicher damit fuellen. Bei voller Liste fliegt
       * die aelteste — schlimmstenfalls klickt jemand ein zweites Mal.
       */
      hoechstens?: number;
      jetzt?: () => number;
    } = {},
  ) {
    this.gueltigMs = optionen.gueltigMs ?? 15 * 60_000;
    this.hoechstens = optionen.hoechstens ?? 20_000;
    this.jetzt = optionen.jetzt ?? Date.now;
  }

  ausgeben(): string {
    this.aufraeumen();
    while (this.offen.size >= this.hoechstens) {
      const aelteste = this.offen.keys().next().value;
      if (aelteste === undefined) break;
      this.offen.delete(aelteste);
    }
    const nonce = randomBytes(24).toString('base64url');
    this.offen.set(nonce, this.jetzt() + this.gueltigMs);
    return nonce;
  }

  /** true genau beim ersten Einloesen einer ausgegebenen, nicht abgelaufenen Nonce. */
  einloesen(nonce: unknown): boolean {
    if (typeof nonce !== 'string') return false;
    const bis = this.offen.get(nonce);
    if (bis === undefined) return false;
    this.offen.delete(nonce);
    return bis > this.jetzt();
  }

  private aufraeumen(): void {
    const jetzt = this.jetzt();
    // Map haelt die Einfuegereihenfolge — die abgelaufenen stehen vorn.
    for (const [nonce, bis] of this.offen) {
      if (bis > jetzt) break;
      this.offen.delete(nonce);
    }
  }
}
