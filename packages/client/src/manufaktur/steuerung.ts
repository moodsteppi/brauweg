/**
 * Die Steuerung der Kartenmanufaktur im Client: haelt den Stand, rechnet ihn
 * mit dem gemeinsamen Kern bis „jetzt" weiter und gleicht ihn mit dem Server ab.
 *
 * Warum der Client ueberhaupt mitrechnet: Jede Bewegung auf dem Bildschirm
 * haengt an einem echten Zyklus (der Pinguin legt den Stapel genau dann ab,
 * wenn der Warenwert in der Kiste landet). Das geht nur, wenn hier dieselbe
 * Simulation laeuft wie auf dem Server.
 *
 * Massgeblich bleibt der Server — Meilensteine zahlen echte Muenzen. Eine
 * Aktion wirkt sofort hier (Vorhersage) und geht dann der Reihe nach an den
 * Server; jede Antwort ersetzt den Stand, und was noch unterwegs ist, wird
 * darauf neu angewendet. Kein Tipp wird verworfen: Wer fuenfmal schnell
 * ausbaut, will fuenf Stufen (so schon vor dem Umbau, siehe Git-Historie).
 *
 * Reines TypeScript ohne React: Der Bildschirm (Pixi-Szene und DOM) liest in
 * jedem Bild `stand()` und `jetzt()`; React wird nur benachrichtigt, wenn
 * sich etwas Sichtbares am DOM aendern kann.
 */

import { type Aktion, AktionAbgelehnt, type ManufakturStand, handle, vorspulen } from '@brauweg/manufaktur-kern';

import type { ManufakturAntwort } from './sicht';

export interface Leitung {
  laden: () => Promise<ManufakturAntwort>;
  senden: (aktion: Aktion) => Promise<ManufakturAntwort>;
}

export interface Ereignisse {
  /** Muenzen fuers Hub gutgeschrieben (Meilenstein). */
  muenzen?: (anzahl: number) => void;
  /** Beim Oeffnen: was waehrend der Abwesenheit verdient wurde. */
  offline?: (meldung: NonNullable<ManufakturAntwort['offline']>) => void;
  /** Der Server hat abgelehnt (Text-Schluessel fuer `t`) oder ist nicht erreichbar (null). */
  fehler?: (textSchluessel: string | null) => void;
  /** Eine neue Manufaktur ist bezogen (auch von einem zweiten Geraet aus). */
  umzug?: (nummer: number) => void;
}

/** Nach so langer Zeit fragt der Client ohnehin neu — fuer ein zweites Geraet. */
export const NACHFRAGEN_MS = 30_000;

export class Steuerung {
  private basis: ManufakturStand | null = null;
  /** Server-Zeit minus eigene Uhr. */
  private versatz = 0;
  /** Gesendet, aber noch nicht bestaetigt — in dieser Reihenfolge. */
  private unterwegs: Aktion[] = [];
  private kette: Promise<void> = Promise.resolve();
  private hoerer = new Set<() => void>();
  private letzteManufaktur: number | null = null;

  constructor(
    private readonly leitung: Leitung,
    private readonly ereignisse: Ereignisse = {},
    private readonly uhr: () => number = () => Date.now(),
  ) {}

  /** Server-Zeit jetzt. */
  jetzt(): number {
    return this.uhr() + this.versatz;
  }

  /** Der Stand bis jetzt gerechnet — null, solange die erste Antwort fehlt. */
  stand(): ManufakturStand | null {
    if (!this.basis) return null;
    this.basis = vorspulen(this.basis, this.jetzt());
    return this.basis;
  }

  bereit(): boolean {
    return this.basis !== null;
  }

  abonnieren(hoerer: () => void): () => void {
    this.hoerer.add(hoerer);
    return () => this.hoerer.delete(hoerer);
  }

  private melden(): void {
    for (const h of this.hoerer) h();
  }

  /** Den Stand vom Server holen (beim Oeffnen, alle 30 s, beim Zurueckkommen). */
  laden(): Promise<void> {
    return this.anhaengen(async () => {
      const gesendet = this.uhr();
      const antwort = await this.leitung.laden();
      this.uebernehmen(antwort, gesendet);
      if (antwort.offline) this.ereignisse.offline?.(antwort.offline);
    });
  }

  /**
   * Eine Aktion: sofort vorhersagen, dann senden. Lehnt schon der Kern hier
   * ab (zu teuer, keine Pause vorbei), geht nichts an den Server — der Code
   * kommt zurueck, damit der Bildschirm es zeigen kann.
   */
  tue(aktion: Aktion): { ok: true } | { ok: false; code: string } {
    const stand = this.stand();
    if (!stand) return { ok: false, code: 'manufakturBeschaeftigt' };
    try {
      this.basis = handle(stand, aktion, this.jetzt()).stand;
    } catch (err) {
      if (err instanceof AktionAbgelehnt) return { ok: false, code: err.code };
      throw err;
    }
    this.unterwegs.push(aktion);
    this.melden();
    void this.anhaengen(async () => {
      const gesendet = this.uhr();
      try {
        const antwort = await this.leitung.senden(aktion);
        this.unterwegs.shift();
        this.uebernehmen(antwort, gesendet);
      } catch (err) {
        this.unterwegs.shift();
        this.ereignisse.fehler?.((err as { messageKey?: string } | null)?.messageKey ?? null);
        // Die Vorhersage war falsch — den echten Stand holen.
        const antwort = await this.leitung.laden().catch(() => null);
        if (antwort) this.uebernehmen(antwort, this.uhr());
      }
    });
    return { ok: true };
  }

  /** Wartet, bis alles Gesendete bestaetigt ist (fuer Tests und das Schliessen). */
  fertig(): Promise<void> {
    return this.kette;
  }

  private anhaengen(arbeit: () => Promise<void>): Promise<void> {
    const weiter = this.kette.then(arbeit).catch(() => {
      this.ereignisse.fehler?.(null);
    });
    this.kette = weiter;
    return weiter;
  }

  /**
   * Antwort uebernehmen: Uhrversatz aus der halben Laufzeit, Stand ersetzen,
   * noch Unbestaetigtes darauf neu anwenden.
   */
  private uebernehmen(antwort: ManufakturAntwort, gesendet: number): void {
    const empfangen = this.uhr();
    this.versatz = antwort.zeit - (gesendet + empfangen) / 2;
    let stand = antwort.stand;
    for (const aktion of this.unterwegs) {
      try {
        stand = handle(stand, aktion, this.jetzt()).stand;
      } catch {
        // Was der Server gleich ablehnen wird, zeigen wir auch nicht.
      }
    }
    this.basis = stand;
    if (antwort.muenzen > 0) this.ereignisse.muenzen?.(antwort.muenzen);
    const nummer = antwort.stand.manufaktur;
    if (this.letzteManufaktur !== null && nummer > this.letzteManufaktur) this.ereignisse.umzug?.(nummer);
    this.letzteManufaktur = nummer;
    this.melden();
  }
}
