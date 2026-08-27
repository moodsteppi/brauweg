/**
 * Die Guthaben der Plattform.
 *
 * DIE EINZIGE STELLE, an der ein Guthaben sich aendert. Wer irgendwo sonst
 * `update(account).set({ coins: ... })` schreibt, umgeht die Sperre gegen
 * negative Staende und die Sonderbehandlung der Testkonten — und beides
 * faellt erst auf, wenn jemand mit −40 Muenzen dasteht.
 *
 * **Muenzen** (`coins`) fallen aus Truhen und Tagesaufgaben. Sie sind die
 * Waehrung des Mitspielens: Wer regelmaessig spielt, kommt an alles Bunte.
 *
 * **Edelsteine** (`gems`) entstehen nur aus Kauf oder Geschenk. Sie sind die
 * Waehrung des Ungeduldigen — und die einzige, die echtes Geld kostet.
 *
 * **BroJetons** (`broJetons`) sind Pokerchips. Man kauft sie im Shop gegen
 * Muenzen, setzt sie am Tisch ein und bekommt den Reststapel zurueck. Aus
 * BroJetons werden bewusst nie wieder Muenzen oder Edelsteine: Sonst waere
 * jede gewonnene Hand ein Weg in den Shop.
 *
 * **Zwei einseitige Bruecken, keine Kreise.** Edelsteine werden zu Muenzen,
 * Muenzen zu BroJetons. Es gibt weder `muenzenZuEdelsteinen()` noch
 * `broJetonsZuMuenzen()` — die Einseitigkeit ist eine fehlende Funktion,
 * keine Regel in einem Kommentar.
 *
 * BroJetons gegen BroJetons am Tisch ist ein geschlossener Chipkreislauf,
 * kein Umtausch in die Shop-Waehrungen. Genau das haelt Grundsatz 4: Das
 * Regelwerk kennt Zahlen, die Plattform den Beutel.
 */

import { and, eq, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest, conflict, notFound } from './errors.js';
import { entitlementsFor } from './entitlements.js';

/** Waehrungen, mit denen der Shop Kosmetik verkauft — bewusst ohne BroJetons. */
export const WAEHRUNGEN = ['coins', 'gems'] as const;
export type Waehrung = (typeof WAEHRUNGEN)[number];

/** Alle drei Guthaben, inklusive der Pokerchips. */
export const GUTHABEN = ['coins', 'gems', 'broJetons'] as const;
export type Guthaben = (typeof GUTHABEN)[number];

/** Startstapel fuer neue Konten — eine kleine Runde Poker, ohne zuerst zu kaufen. */
export const START_BRO_JETONS = 1000;

/** Die Spalte zum Guthaben. Eine Stelle, damit kein Zweig sie vergisst. */
const SPALTE = {
  coins: s.account.coins,
  gems: s.account.gems,
  broJetons: s.account.broJetons,
} as const;

export interface Stand {
  readonly coins: number;
  readonly gems: number;
  readonly broJetons: number;
}

/**
 * Oberkante eines Guthabens.
 *
 * Nicht aus Sparsamkeit, sondern gegen den Ueberlauf: `integer` in Postgres
 * endet bei 2.147.483.647, und eine Gutschrift, die darueber hinausgeht,
 * bricht die Anweisung ab statt still zu saettigen. Der Wert liegt weit ueber
 * allem, was durch Spielen erreichbar ist, und unter dem Rand.
 */
export const OBERGRENZE = 1_000_000_000;

/**
 * Guthaben eines Kontos, wie die Oberflaeche es zeigen soll.
 *
 * Fuer Testkonten meldet `coinsFor` einen hohen Festwert — deshalb geht das
 * hier ueber `entitlements.ts` und nicht direkt an die Spalte.
 */
export async function standVon(db: Db, accountId: string): Promise<Stand> {
  const [row] = await db
    .select({
      coins: s.account.coins,
      gems: s.account.gems,
      broJetons: s.account.broJetons,
      premiumUntil: s.account.premiumUntil,
      isStaff: s.account.isStaff,
    })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!row) throw notFound('accountUnknown');

  return sichtbarerStand(row);
}

/** Dieselbe Rechnung fuer eine bereits geladene Zeile — ohne zweite Abfrage. */
export function sichtbarerStand(row: {
  coins: number;
  gems: number;
  broJetons: number;
  premiumUntil: Date | string | null;
  isStaff: boolean;
}): Stand {
  const rechte = entitlementsFor(row);
  if (rechte.unlimitedCoins) {
    return { coins: STAFF_STAND, gems: STAFF_STAND, broJetons: STAFF_STAND };
  }
  return { coins: row.coins, gems: row.gems, broJetons: row.broJetons };
}

/**
 * Guthaben eines Testkontos.
 *
 * Eine grosse, aber endliche Zahl — dieselbe Begruendung wie bei
 * `STAFF_COINS` in `entitlements.ts`: `Infinity` wird auf dem Weg durch JSON
 * zu `null` und in jeder Rechnung zu NaN.
 */
export const STAFF_STAND = 9_999_999;

/**
 * Gutschrift. Gibt den neuen Stand zurueck, wie die Oberflaeche ihn zeigt.
 *
 * Der Betrag muss positiv sein: Eine Gutschrift mit negativem Betrag waere
 * eine Abbuchung ohne Deckungspruefung, und genau die soll es nicht geben.
 *
 * Zurueck geht der SICHTBARE Stand und nicht der Spaltenwert — genau wie bei
 * `abbuchen`. Fuer ein Testkonto sind das verschiedene Zahlen, und ein
 * Endpunkt, der nach dem Oeffnen einer Truhe `stand: 2` meldet, waehrend die
 * Kopfzeile 9.999.999 zeigt, widerspricht sich.
 */
export async function gutschreiben(
  db: Db,
  accountId: string,
  waehrung: Guthaben,
  betrag: number,
): Promise<number> {
  const wert = ganzzahlig(betrag);
  if (wert <= 0) throw badRequest('invalidInput');

  const spalte = SPALTE[waehrung];
  const [row] = await db
    .update(s.account)
    // least() statt einer Vorabpruefung: Der Deckel greift in derselben
    // Anweisung, also auch dann, wenn zwei Gutschriften gleichzeitig laufen.
    .set({ [feldname(waehrung)]: sql`least(${spalte} + ${wert}, ${OBERGRENZE})` })
    .where(eq(s.account.id, accountId))
    // Alles in einem Zug zurueck, damit der sichtbare Stand ohne zweite
    // Abfrage zu rechnen ist.
    .returning({
      coins: s.account.coins,
      gems: s.account.gems,
      broJetons: s.account.broJetons,
      premiumUntil: s.account.premiumUntil,
      isStaff: s.account.isStaff,
    });

  if (!row) throw notFound('accountUnknown');
  return sichtbarerStand(row)[waehrung];
}

/**
 * Abbuchung. Wirft `coinsInsufficient`, wenn das Guthaben nicht reicht.
 *
 * Die Deckungspruefung steht in der WHERE-Klausel und nicht davor: Ein
 * `select` und danach ein `update` sind zwei Schritte, und zwischen ihnen
 * passt ein zweiter Kauf. So kann der Stand bauartbedingt nie unter Null
 * geraten — trifft die Bedingung nicht zu, aendert die Anweisung keine Zeile.
 *
 * Testkonten zahlen nicht. Ihr Stand soll nicht langsam schrumpfen, sonst
 * waere er nach hundert Kaeufen kein Testkonto mehr.
 */
export async function abbuchen(
  db: Db,
  accountId: string,
  waehrung: Guthaben,
  betrag: number,
): Promise<number> {
  const wert = ganzzahlig(betrag);
  if (wert < 0) throw badRequest('invalidInput');

  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  if (entitlementsFor(konto).unlimitedCoins) return STAFF_STAND;
  // Nichts zu zahlen: Freie Stuecke sollen keine Anweisung ausloesen.
  if (wert === 0) return (await standVon(db, accountId))[waehrung];

  const spalte = SPALTE[waehrung];
  const [row] = await db
    .update(s.account)
    .set({ [feldname(waehrung)]: sql`${spalte} - ${wert}` })
    .where(and(eq(s.account.id, accountId), sql`${spalte} >= ${wert}`))
    .returning({ stand: spalte });

  if (!row) throw conflict(fehlerschluessel(waehrung));
  return row.stand;
}

// ---------------------------------------------------------------------------
// Umtausch — nur in eine Richtung
// ---------------------------------------------------------------------------

/**
 * Der Kurs: so viele Muenzen gibt ein Edelstein.
 *
 * Abgeleitet aus den Cent-Platzhaltern der kleinsten Pakete, damit der Umtausch
 * sich nicht gegen einen spaeteren echten Preis stellt: Die kleine Handvoll
 * Edelsteine lag bei 299 Cent fuer 50 Stueck (5,98 Cent je Edelstein), die
 * kleine Handvoll Muenzen bei 199 Cent fuer 500 Stueck (0,398 Cent je Muenze).
 * 5,98 / 0,398 ergibt genau 15.
 *
 * **Vorlaeufig wie alles Preisliche hier** (Plan 13 fuehrt „Konkrete Preise fuer
 * Abo und Muenzpakete" als offenen Punkt). Wer ihn aendert, aendert diese Zahl
 * und nichts weiter: Die Kosmetikpreise und die Truhenspannen leiten ihren
 * zweiten Preis daraus ab, statt ihn doppelt zu fuehren.
 */
export const MUENZEN_JE_EDELSTEIN = 15;

/** Was ein Edelsteinbetrag in Muenzen wert ist. */
export function inMuenzen(edelsteine: number): number {
  return Math.trunc(edelsteine) * MUENZEN_JE_EDELSTEIN;
}

/**
 * Was ein Muenzbetrag in Edelsteinen kostet. **Aufgerundet.**
 *
 * Die Richtung der Rundung ist der ganze Punkt: Wuerde abgerundet, waere der
 * direkte Edelsteinpreis eines Stuecks billiger als derselbe Betrag ueber den
 * Umtausch — ein Rabatt, den niemand entschieden hat, und bei genug Stuecken
 * eine Rechenaufgabe statt einer Kaufentscheidung.
 */
export function inEdelsteine(muenzen: number): number {
  return Math.ceil(Math.trunc(muenzen) / MUENZEN_JE_EDELSTEIN);
}

/**
 * Edelsteine ausgeben, Muenzen dafuer bekommen.
 *
 * Die einzige Bruecke zwischen den beiden Staenden, und sie fuehrt nur hierhin:
 * Es gibt keine Funktion, die Muenzen zu Edelsteinen macht, und es soll auch
 * keine geben (siehe Kopf der Datei).
 *
 * **Erst abbuchen, dann gutschreiben** — dieselbe Reihenfolge wie beim Kauf in
 * `shop.ts`. Bricht es dazwischen ab, sind Edelsteine weg und Muenzen nicht da:
 * unangenehm und reparierbar. Andersherum waeren die Muenzen da und die
 * Edelsteine auch, und das ist der Fehler, den niemand meldet.
 *
 * Beide Betraege kommen vom Aufrufer und nicht aus dem Kurs, weil die Pakete
 * bewusst nicht kursgenau sind: Das kleine gibt etwas weniger je Edelstein, das
 * grosse etwas mehr — der uebliche Mengenrabatt. Der Kurs ist die Mitte, an der
 * sich die Staffelung messen laesst, keine Formel zur Laufzeit.
 */
export async function edelsteineZuMuenzen(
  db: Db,
  accountId: string,
  edelsteine: number,
  muenzen: number,
): Promise<Stand> {
  const preis = ganzzahlig(edelsteine);
  const ertrag = ganzzahlig(muenzen);
  if (preis <= 0 || ertrag <= 0) throw badRequest('invalidInput');

  await abbuchen(db, accountId, 'gems', preis);
  await gutschreiben(db, accountId, 'coins', ertrag);
  return standVon(db, accountId);
}

/**
 * Muenzen ausgeben, BroJetons dafuer bekommen.
 *
 * Die zweite einseitige Bruecke, und sie fuehrt nur hierhin: Es gibt keine
 * Funktion, die BroJetons zu Muenzen macht. Wer am Pokertisch gewinnt, hat
 * mehr Chips fuer die naechste Runde — nicht mehr Hut oder Truhe.
 *
 * **Erst abbuchen, dann gutschreiben**, dieselbe Reihenfolge wie oben.
 * Beide Betraege kommen vom Aufrufer, weil die Pakete bewusst nicht
 * kursgenau sind: Das grosse gibt mehr BroJetons je Muenze.
 */
export async function muenzenZuBroJetons(
  db: Db,
  accountId: string,
  muenzen: number,
  broJetons: number,
): Promise<Stand> {
  const preis = ganzzahlig(muenzen);
  const ertrag = ganzzahlig(broJetons);
  if (preis <= 0 || ertrag <= 0) throw badRequest('invalidInput');

  await abbuchen(db, accountId, 'coins', preis);
  await gutschreiben(db, accountId, 'broJetons', ertrag);
  return standVon(db, accountId);
}

/**
 * Feldname im Drizzle-Objekt.
 *
 * `set()` erwartet den Namen der Eigenschaft, `where()` die Spalte. Beides
 * steht hier beieinander, damit ein Umbenennen nicht die Haelfte trifft.
 */
function feldname(waehrung: Guthaben): 'coins' | 'gems' | 'broJetons' {
  return waehrung;
}

function fehlerschluessel(waehrung: Guthaben): string {
  if (waehrung === 'gems') return 'gemsInsufficient';
  if (waehrung === 'broJetons') return 'broJetonsInsufficient';
  return 'coinsInsufficient';
}

function ganzzahlig(betrag: number): number {
  if (!Number.isFinite(betrag)) throw badRequest('invalidInput');
  return Math.trunc(betrag);
}
