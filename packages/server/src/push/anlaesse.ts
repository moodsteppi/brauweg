/**
 * Wann eine Push-Mitteilung entsteht — drei Anlaesse, jeder einzeln abschaltbar.
 *
 *   - `dran`      Du bist am Zug (nur Spiele mit echter Zugfolge, `ZUGSPIELE`).
 *   - `start`     Der Tisch ist voll, die Partie beginnt.
 *   - `einladung` Jemand ist ueber deinen Einladungscode an deinen Tisch gekommen.
 *
 * Fuer alle drei gilt dieselbe Schleuse, in dieser Reihenfolge:
 *
 *   1. Server-weit abgeschaltet (PUSH_AUS)? Dann nichts.
 *   2. Hat der Empfaenger die App gerade im Vordergrund? Dann nichts — er
 *      sieht es ohnehin, und eine Mitteilung ueber das, was man gerade
 *      anschaut, ist Laerm. Woher der Server das weiss, steht am Gateway
 *      (`imVordergrund`): eine offene Tischverbindung, die sich nicht mit
 *      `hintergrund` abgemeldet hat.
 *   3. Drosselung: hoechstens EINE Mitteilung je Konto und Tisch und Minute,
 *      ueber alle Anlaesse zusammen. An einem Tisch mit drei Bots wechselt
 *      der Zug in Sekunden reihum; ohne Deckel klingelte das Telefon bei
 *      jedem Stich.
 *   4. Hat das Konto den Anlass in den Einstellungen abgewaehlt? Dann nichts.
 *   5. An jedes aktive Geraet des Kontos. Erklaert der Dienst ein Token fuer
 *      tot, wird es abgeschaltet (`aktiv = false`).
 *
 * Nichts davon blockiert den Spielablauf: Die Anlaesse werden angestossen und
 * laufen nebenher; ein Fehler landet im Log, nie beim Spieler am Tisch.
 */

import { asc, eq } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import type { LiveParty } from '../runtime/party.js';
import { deaktiviereGeraete, geraeteFuer } from './geraete.js';
import { type Anlass, ZUGSPIELE } from './kennungen.js';
import type { Mitteilung } from './sender.js';
import { mitteilungstext } from './texte.js';
import type { PushVersand } from './versand.js';

export { ANLAESSE, type Anlass, ZUGSPIELE, istAnlass } from './kennungen.js';

/** Hoechstens eine Mitteilung je Konto und Tisch in diesem Abstand. */
export const DROSSEL_MS = 60_000;

/** Was die Anlaesse von der Laufzeit brauchen — nicht mehr. */
export interface LaufzeitSicht {
  get(tableId: string): LiveParty | undefined;
  onUpdate(listener: (tableId: string, nurSicht: boolean) => void): () => void;
}

export interface PushAnlaesseOptionen {
  readonly db: Db;
  readonly versand: PushVersand;
  /** Server-weit abgeschaltete Anlaesse (PUSH_AUS). */
  readonly aus?: readonly Anlass[];
  readonly drosselMs?: number;
  /** Uhr in Millisekunden — fuer Tests vorstellbar. */
  readonly jetzt?: () => number;
  readonly protokoll?: (zeile: string) => void;
}

export class PushAnlaesse {
  private readonly db: Db;
  private readonly versand: PushVersand;
  private readonly aus: ReadonlySet<Anlass>;
  private readonly drosselMs: number;
  private readonly jetzt: () => number;
  private readonly protokoll: (zeile: string) => void;
  /** Siehe `setzeVordergrund`. Ohne Gateway: niemand ist im Vordergrund. */
  private vordergrund: (accountId: string) => boolean = () => false;
  /** Letzte Mitteilung je `konto|tisch`. */
  private readonly zuletzt = new Map<string, number>();
  /** Wer zuletzt am Zug war, je Tisch — nur ein WECHSEL loest `dran` aus. */
  private readonly amZug = new Map<string, number | null>();
  /** Laufende Zustellungen, damit Tests und das Serverende darauf warten koennen. */
  private readonly laufend = new Set<Promise<void>>();

  constructor(optionen: PushAnlaesseOptionen) {
    this.db = optionen.db;
    this.versand = optionen.versand;
    this.aus = new Set(optionen.aus ?? []);
    this.drosselMs = optionen.drosselMs ?? DROSSEL_MS;
    this.jetzt = optionen.jetzt ?? (() => Date.now());
    // eslint-disable-next-line no-console
    this.protokoll = optionen.protokoll ?? ((zeile) => console.error(zeile));
  }

  /**
   * Woher bekannt ist, ob jemand gerade hinsieht. Der Gateway kennt die
   * offenen Verbindungen und entsteht erst nach dem HTTP-Server — deshalb
   * wird er nachgereicht statt im Konstruktor verlangt.
   */
  setzeVordergrund(pruefung: (accountId: string) => boolean): void {
    this.vordergrund = pruefung;
  }

  /** Zugwechsel beobachten. Liefert die Abmeldung zurueck. */
  beobachte(laufzeit: LaufzeitSicht): () => void {
    return laufzeit.onUpdate((tableId) => this.zugGeaendert(laufzeit, tableId));
  }

  /**
   * Nach jeder Aenderung an einem Tisch: Ist jetzt ein ANDERER Mensch am Zug
   * als vorher, bekommt er `dran`.
   *
   * Nur der Wechsel zaehlt, nicht jede Sicht: Waehrend jemand am Zug ist,
   * gehen weitere Rundrufe hinaus (Zuruf, Beitritt eines Zuschauers), und
   * jeder davon waere sonst ein neuer Anstoss.
   */
  zugGeaendert(laufzeit: Pick<LaufzeitSicht, 'get'>, tableId: string): void {
    const party = laufzeit.get(tableId);
    if (!party || party.finished) {
      this.amZug.delete(tableId);
      return;
    }
    if (this.aus.has('dran') || !ZUGSPIELE.has(party.gameId)) return;

    let sitz: number | null;
    try {
      sitz = party.module.currentActor(party.state);
    } catch {
      return;
    }
    const vorher = this.amZug.get(tableId);
    this.amZug.set(tableId, sitz);
    if (sitz === null || sitz === vorher || party.paused) return;

    const platz = party.seats.find((kandidat) => kandidat.index === sitz);
    if (!platz?.accountId || platz.permanentBot || party.leftSeats.has(sitz)) return;
    this.anstossen('dran', [platz.accountId], tableId, party.gameId);
  }

  /** Der Tisch ist voll und die Partie laeuft an — an alle Menschen am Tisch. */
  partieGestartet(laufzeit: Pick<LaufzeitSicht, 'get'>, tableId: string): void {
    if (this.aus.has('start')) return;
    const party = laufzeit.get(tableId);
    if (!party) return;
    const konten = party.seats
      .filter((platz) => platz.accountId && !platz.permanentBot)
      .map((platz) => platz.accountId as string);
    this.anstossen('start', konten, tableId, party.gameId);
  }

  /**
   * Jemand ist ueber den Einladungscode beigetreten. Bescheid bekommt, wer
   * den Tisch aufgemacht hat — der erste Mensch am Tisch, derselbe, der in
   * der Code-Vorschau als Gastgeber steht (`/api/tables/code/:code`).
   */
  einladungAngenommen(tableId: string, gastId: string): void {
    if (this.aus.has('einladung')) return;
    this.merke(
      (async () => {
        const plaetze = await this.db
          .select({ accountId: s.tableSeat.accountId })
          .from(s.tableSeat)
          .where(eq(s.tableSeat.tableId, tableId))
          .orderBy(asc(s.tableSeat.seatIndex));
        const gastgeber = plaetze.find((p) => p.accountId && p.accountId !== gastId)?.accountId;
        if (!gastgeber) return;
        const [tisch] = await this.db
          .select({ gameId: s.gameTable.gameId })
          .from(s.gameTable)
          .where(eq(s.gameTable.id, tableId));
        const [gast] = await this.db
          .select({ displayName: s.account.displayName })
          .from(s.account)
          .where(eq(s.account.id, gastId));
        if (!tisch) return;
        await this.zustellen('einladung', [gastgeber], tableId, tisch.gameId, gast?.displayName ?? null);
      })(),
    );
  }

  /** Wartet, bis alle angestossenen Zustellungen durch sind (Tests, Serverende). */
  async ruhe(): Promise<void> {
    while (this.laufend.size > 0) await Promise.allSettled([...this.laufend]);
  }

  private anstossen(anlass: Anlass, konten: readonly string[], tableId: string, gameId: string): void {
    this.merke(this.zustellen(anlass, konten, tableId, gameId, null));
  }

  private merke(arbeit: Promise<void>): void {
    const sicher = arbeit.catch((err: unknown) => {
      this.protokoll(`PUSHFEHLER Anlass gescheitert: ${err instanceof Error ? err.message : String(err)}`);
    });
    this.laufend.add(sicher);
    void sicher.finally(() => this.laufend.delete(sicher));
  }

  /** Schleuse 2 bis 5 (siehe Kopf). */
  private async zustellen(
    anlass: Anlass,
    konten: readonly string[],
    tableId: string,
    gameId: string,
    name: string | null,
  ): Promise<void> {
    if (this.aus.has(anlass)) return;
    const jetzt = this.jetzt();
    this.raeumeDrossel(jetzt);

    const empfaenger: string[] = [];
    for (const konto of new Set(konten)) {
      if (this.vordergrund(konto)) continue;
      const schluessel = `${konto}|${tableId}`;
      const zuletzt = this.zuletzt.get(schluessel);
      if (zuletzt !== undefined && jetzt - zuletzt < this.drosselMs) continue;
      // VOR dem ersten await setzen: Zwei Anstoesse im selben Augenblick
      // (Start und erster Zug) sollen nicht beide durch die Schleuse kommen.
      this.zuletzt.set(schluessel, jetzt);
      empfaenger.push(konto);
    }
    if (empfaenger.length === 0) return;

    const geraete = await geraeteFuer(this.db, empfaenger, anlass);
    if (geraete.length === 0) return;

    const { titel, text } = mitteilungstext(anlass, { gameId, name });
    const mitteilung: Mitteilung = {
      titel,
      text,
      daten: { anlass, tableId, gameId },
      sammelKennung: `tisch-${tableId}`,
    };

    const tot: string[] = [];
    await Promise.all(
      geraete.map(async (geraet) => {
        const ergebnis = await this.versand[geraet.plattform].senden(geraet.token, mitteilung);
        if (ergebnis === 'ungueltig') tot.push(geraet.token);
      }),
    );
    await deaktiviereGeraete(this.db, tot);
  }

  /** Alte Drossel-Eintraege weg, damit die Tabelle nicht mit jedem Tisch waechst. */
  private raeumeDrossel(jetzt: number): void {
    if (this.zuletzt.size < 1000) return;
    for (const [schluessel, zeit] of this.zuletzt) {
      if (jetzt - zeit >= this.drosselMs) this.zuletzt.delete(schluessel);
    }
  }
}
