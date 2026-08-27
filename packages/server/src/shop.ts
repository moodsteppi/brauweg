/**
 * Shop.
 *
 * **Echtes Geld kauft nur Edelsteine. Edelsteine kaufen alles andere.** Das ist
 * seit dem 4. August die Ordnung des Shops, und sie hat einen einzigen Grund:
 * Es gibt genau eine Stelle, an der Geld ins Spiel kommt. Wer wissen will, was
 * etwas wirklich kostet, muss nur einen Kurs kennen und nicht fuenf Preislisten
 * vergleichen.
 *
 * Daraus folgen drei Sorten Angebot:
 *
 *  1. **Gegen Edelsteine, laeuft wirklich** — Muenzpakete (`paketKaufen`) und
 *     Kauftruhen (`truheKaufen` in `truhen.ts`).
 *  2. **Gegen Muenzen ODER Edelsteine, laeuft wirklich** — die Kosmetik
 *     (`kaufen`). Jedes Stueck hat beide Preise, der Kaeufer waehlt.
 *  3. **Bald** — die Edelsteinpakete und der VIP-Pass (beide gegen Geld) und
 *     der Season Pass (gegen Edelsteine). Preis steht dran, gekauft wird
 *     nichts: Fuer Geld fehlt der Bezahlweg, fuer den Season Pass das Modell.
 *
 * Warum die dritte Sorte trotzdem schon dasteht: DESIGN.md verlangt es —
 * „Was es noch nicht gibt, steht trotzdem in der Oberflaeche, mit ehrlicher
 * Null und Bald-Marke." Und der Shop muss seine endgueltige Form haben, bevor
 * ein Bezahlweg dazukommt: Ein Regal, das erst mit dem Zahlungsdienst
 * entworfen wird, wird nach dem Zahlungsdienst entworfen.
 *
 * **Muenzen sind kein Ziel eines Geldkaufs mehr.** Die drei Muenzpakete kosteten
 * bis dahin Cent-Betraege; sie kosten jetzt Edelsteine. Der Cent-Preis ist damit
 * nicht verschwunden, sondern nur eine Stufe weiter gerueckt — er steht am
 * Edelsteinpaket.
 *
 * **Die Euro-Preise sind Platzhalter.** Sie stehen als ganze Cent da, nie als
 * Gleitkomma, und sind bewusst noch nicht entschieden — Plan 13 fuehrt
 * „Konkrete Preise fuer Abo und Muenzpakete" als offenen Punkt. Sobald Stripe
 * und Apple dazukommen, ist der Preis dort die Wahrheit und hier nur noch die
 * Anzeige.
 *
 * **Im App-Paket bleibt der ganze Bereich draussen** (`zeigeKaufbares` im
 * Client). Angebote mit Paketangabe, die nichts verkaufen, gelten Apple als
 * unfertige App; sobald sie etwas verkaufen, muessen sie ueber Apples
 * Bezahlweg. Dass jetzt ein Teil des Regals nur virtuelle Waehrung kostet und
 * damit unbedenklich waere, aendert daran vorerst nichts — die Trennung im
 * Client ist grob und laeuft ueber den ganzen Tab. Siehe docs/APPSTORE.md.
 */

import { and, eq } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { conflict, forbidden, notFound } from './errors.js';
import { entitlementsFor } from './entitlements.js';
import {
  type Garderobe,
  type Preis,
  type Slot,
  SLOTS,
  besitzt,
  garderobeVon,
  KATALOG,
  preisIn,
  requireStueck,
} from './kosmetik.js';
import { KAUFTRUHEN, type Kauftruhe } from './truhen.js';
import {
  abbuchen,
  edelsteineZuMuenzen,
  muenzenZuBroJetons,
  MUENZEN_JE_EDELSTEIN,
  type Guthaben,
  type Stand,
  type Waehrung,
} from './waehrung.js';
import { type Ware, type WareArt, WAREN, besitzVon, istFrei, wareMit } from './tischware.js';

// ---------------------------------------------------------------------------
// Pakete und Paesse
// ---------------------------------------------------------------------------

export interface Paket {
  readonly id: string;
  readonly nameKey: string;
  /** Was drin ist. Null bei Paessen, die kein Guthaben geben. */
  readonly gibt: { readonly waehrung: Guthaben; readonly betrag: number } | null;
  /**
   * Anzeigepreis in ganzen Cent, oder null.
   *
   * Null heisst: kostet kein Geld. Genau ein Angebot darf beides tragen — und
   * heute tut es keines: Was Geld kostet, kostet keine Edelsteine, und
   * umgekehrt. Zwei Preise am selben Paket waeren ein Wechselkurs an der
   * Oberflaeche, und den fuehrt `waehrung.ts`.
   */
  readonly cents: number | null;
  /** Preis in Edelsteinen, oder null, wenn es dafuer nicht zu haben ist. */
  readonly gems: number | null;
  /** Preis in Muenzen, oder null — so kosten die BroJeton-Pakete. */
  readonly coins: number | null;
  /** Prozent Aufschlag gegenueber dem kleinsten Paket — der "Spartipp". */
  readonly bonus: number | null;
  /**
   * Laeuft der Kauf wirklich?
   *
   * Steht am Paket und nicht als Liste woanders: Ein Angebot, dessen Preis hier
   * steht und dessen Verkaeuflichkeit dort, ist eines, bei dem irgendwann das
   * eine ohne das andere geaendert wird.
   */
  readonly kaufbar: boolean;
}

/**
 * Muenzpakete — **gegen Edelsteine**.
 *
 * Die Staffelung ist die uebliche: Je groesser das Paket, desto mehr Muenzen je
 * Edelstein. Der Kurs (`MUENZEN_JE_EDELSTEIN`, 15) ist die Mitte, an der sich
 * die Staffelung messen laesst — das kleine Paket liegt mit 14,3 knapp
 * darunter, das mittlere genau darauf, das grosse mit 16 darueber. Ein Test
 * haelt diese Spanne fest, damit kein spaeteres Nachjustieren aus dem grossen
 * Paket eine Muenzquelle macht, gegen die sich Spielen nicht mehr lohnt.
 */
export const MUENZPAKETE: readonly Paket[] = [
  { id: 'muenzen-klein', nameKey: 'shop.muenzen-klein', gibt: { waehrung: 'coins', betrag: 500 }, cents: null, gems: 35, coins: null, bonus: null, kaufbar: true },
  { id: 'muenzen-mittel', nameKey: 'shop.muenzen-mittel', gibt: { waehrung: 'coins', betrag: 1_500 }, cents: null, gems: 100, coins: null, bonus: 5, kaufbar: true },
  { id: 'muenzen-gross', nameKey: 'shop.muenzen-gross', gibt: { waehrung: 'coins', betrag: 4_000 }, cents: null, gems: 250, coins: null, bonus: 12, kaufbar: true },
];

/**
 * Edelsteinpakete — **gegen Geld, und das bleibt so.**
 *
 * Die einzige Stelle im ganzen Shop, an der echtes Geld eine Waehrung kauft.
 * Deshalb `kaufbar: false`: Hier fehlt nicht das Modell, hier fehlt der
 * Bezahlweg.
 */
export const EDELSTEINPAKETE: readonly Paket[] = [
  { id: 'edelsteine-klein', nameKey: 'shop.edelsteine-klein', gibt: { waehrung: 'gems', betrag: 50 }, cents: 299, gems: null, coins: null, bonus: null, kaufbar: false },
  { id: 'edelsteine-mittel', nameKey: 'shop.edelsteine-mittel', gibt: { waehrung: 'gems', betrag: 150 }, cents: 799, gems: null, coins: null, bonus: 12, kaufbar: false },
  { id: 'edelsteine-gross', nameKey: 'shop.edelsteine-gross', gibt: { waehrung: 'gems', betrag: 400 }, cents: 1_899, gems: null, coins: null, bonus: 26, kaufbar: false },
];

/**
 * Paesse. Kein Guthaben, sondern ein Zeitraum — deshalb `gibt: null`.
 *
 * **Der VIP-Pass kostet Geld, der Season Pass Edelsteine.** Das ist bewusst
 * ungleich: VIP ist die laufende Mitgliedschaft und gehoert damit dorthin, wo
 * ein Abo hingehoert — an den Bezahlweg. Der Season Pass ist ein Gegenstand mit
 * Anfang und Ende, den man sich auch erspielen koennen soll, sobald es ihn gibt.
 *
 * **Beide sind noch nicht kaufbar**, aus zwei verschiedenen Gruenden: dem VIP
 * fehlt der Bezahlweg, dem Season Pass das Modell (Stufen, Belohnungen,
 * Laufzeit). Der Edelsteinpreis von 150 ist aus dem mittleren Edelsteinpaket
 * genommen, damit die Zahl nicht aus der Luft kommt — ausbalanciert ist daran
 * so wenig wie an allem Preislichen hier.
 */
export const PAESSE: readonly Paket[] = [
  { id: 'vip-pass', nameKey: 'shop.vip-pass', gibt: null, cents: 499, gems: null, coins: null, bonus: null, kaufbar: false },
  { id: 'season-pass', nameKey: 'shop.season-pass', gibt: null, cents: null, gems: 150, coins: null, bonus: null, kaufbar: false },
];

/**
 * BroJetons — **gegen Muenzen**.
 *
 * Einseitiger Umtausch, bewusst ohne Rueckweg: Wer am Tisch gewinnt, hat mehr
 * Chips fuer Poker, nicht mehr Huete. Die Staffelung ist dieselbe Idee wie
 * bei den Muenzpaketen — das grosse Paket gibt mehr BroJetons je Muenze.
 */
export const JETONPAKETE: readonly Paket[] = [
  { id: 'brojetons-klein', nameKey: 'shop.brojetons-klein', gibt: { waehrung: 'broJetons', betrag: 500 }, cents: null, gems: null, coins: 40, bonus: null, kaufbar: true },
  { id: 'brojetons-mittel', nameKey: 'shop.brojetons-mittel', gibt: { waehrung: 'broJetons', betrag: 1_500 }, cents: null, gems: null, coins: 100, bonus: 20, kaufbar: true },
  { id: 'brojetons-gross', nameKey: 'shop.brojetons-gross', gibt: { waehrung: 'broJetons', betrag: 5_000 }, cents: null, gems: null, coins: 280, bonus: 43, kaufbar: true },
];

/** Alle Pakete an einer Stelle, damit `paketKaufen` eine Kennung findet. */
const PAKET_NACH_ID = new Map(
  [...MUENZPAKETE, ...EDELSTEINPAKETE, ...PAESSE, ...JETONPAKETE].map((paket) => [paket.id, paket]),
);

// ---------------------------------------------------------------------------
// Ansicht
// ---------------------------------------------------------------------------

export interface RegalStueck {
  readonly id: string;
  readonly slot: Slot;
  readonly nameKey: string;
  readonly seltenheit: string;
  /** Beide Preise. Bezahlt wird mit einer der beiden, der Kaeufer waehlt. */
  readonly preis: Preis;
  /** Gehoert schon. Dann ist der Knopf "Anziehen", nicht "Kaufen". */
  readonly besessen: boolean;
  /** Nur zu bekommen, nicht zu kaufen (Geburtstagsoutfit). */
  readonly geschenk: boolean;
}

/** Eine Szenerie oder ein Blatt, wie der Shop sie zeigt. */
export interface RegalWare {
  readonly id: string;
  readonly art: WareArt;
  readonly wert: string;
  readonly nameKey: string;
  readonly seltenheit: string;
  /** Beide Preise — der Kaeufer waehlt, wie bei der Kosmetik. */
  readonly preis: Preis;
  readonly besessen: boolean;
}

export interface ShopAnsicht {
  readonly paesse: readonly Paket[];
  readonly muenzpakete: readonly Paket[];
  readonly edelsteinpakete: readonly Paket[];
  readonly jetonpakete: readonly Paket[];
  /** Szenerien, Rueckseiten, Zurufe und Wappen, inklusive der kostenlosen. */
  readonly tischware: readonly RegalWare[];
  /** Truhen, die Edelsteine kosten. Spanne inklusive — sie steht dran. */
  readonly truhen: readonly Kauftruhe[];
  /**
   * Muenzen je Edelstein.
   *
   * Der Kurs geht mit, statt in der Oberflaeche noch einmal zu stehen: Wer zwei
   * Preise nebeneinander sieht, rechnet ohnehin — dann soll er richtig rechnen,
   * auch nachdem die Zahl am Server einmal geaendert wurde.
   */
  readonly kurs: number;
  /** Kosmetik, nach Platz gruppiert und in Katalogreihenfolge. */
  readonly regale: readonly { readonly slot: Slot; readonly stuecke: readonly RegalStueck[] }[];
}

export async function shopFuer(db: Db, accountId: string): Promise<ShopAnsicht> {
  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  const rechte = entitlementsFor(konto);
  const garderobe = await garderobeVon(db, accountId);
  const eigeneWare = await besitzVon(db, accountId, rechte.ownsEverything);

  return {
    paesse: PAESSE,
    muenzpakete: MUENZPAKETE,
    edelsteinpakete: EDELSTEINPAKETE,
    jetonpakete: JETONPAKETE,
    /**
     * Ware fuer den Tisch. Kostenlose Stuecke bleiben in der Liste, damit die
     * Auswahl im Client vollstaendig ist — sie tragen Preis 0 und gelten als
     * besessen.
     */
    tischware: WAREN.map((ware) => ({
      id: ware.id,
      art: ware.art,
      wert: ware.wert,
      nameKey: ware.nameKey,
      seltenheit: ware.seltenheit,
      preis: ware.preis,
      besessen: eigeneWare.has(ware.id),
    })),
    truhen: KAUFTRUHEN,
    kurs: MUENZEN_JE_EDELSTEIN,
    regale: SLOTS.map((slot) => ({
      slot,
      stuecke: KATALOG.filter((stueck) => stueck.slot === slot).map((stueck) => ({
        id: stueck.id,
        slot: stueck.slot,
        nameKey: stueck.nameKey,
        seltenheit: stueck.seltenheit,
        preis: stueck.preis,
        besessen: besitzt(stueck, garderobe, rechte.ownsEverything),
        geschenk: stueck.herkunft === 'geschenk',
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Kauf
// ---------------------------------------------------------------------------

export interface Kauf {
  readonly itemId: string;
  readonly bezahlt: number;
  readonly waehrung: Waehrung;
  /** Stand der bezahlten Waehrung nach dem Kauf. */
  readonly stand: number;
}

/**
 * Kosmetik kaufen, in Muenzen oder Edelsteinen.
 *
 * Reihenfolge wie bei den Truhen: **erst abbuchen, dann eintragen.** Bricht
 * das Eintragen ab, ist Geld weg und die Ware nicht da — das ist
 * unangenehm, aber reparierbar. Andersherum waere die Ware da und das Geld
 * noch vorhanden, und das ist der Fehler, den niemand meldet.
 *
 * **Der Preis kommt aus dem Katalog, die Waehrung aus der Anfrage.** Das ist
 * der ganze Unterschied und die Grenze dazwischen ist wichtig: Welche der
 * beiden Zahlen gilt, darf der Kaeufer entscheiden — wie hoch sie ist, nicht.
 * Ein Client, der `{"preis":0}` mitschickt, aendert nichts; er schickt es an
 * eine Stelle, die nicht hinsieht.
 *
 * Ohne Angabe wird in **Muenzen** bezahlt. Das ist die Waehrung, die man nicht
 * kaufen muss — wer sich vertippt, verliert damit nichts, was Geld gekostet hat.
 */
export async function kaufen(
  db: Db,
  accountId: string,
  itemId: string,
  waehrung: Waehrung = 'coins',
): Promise<Kauf> {
  // Ware fuer den Tisch (Szenerien, Rueckseiten, Zurufe, Wappen) liegt in
  // einem eigenen Katalog, teilt sich aber die Besitztabelle. Sie wird zuerst
  // gefragt, damit `requireStueck` nicht ueber eine Kennung stolpert, die es
  // kennt.
  const ware = wareMit(itemId);
  if (ware) return kaufeWare(db, accountId, ware, waehrung);

  const stueck = requireStueck(itemId);
  if (stueck.herkunft === 'geschenk') throw forbidden('itemNotForSale');

  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  const rechte = entitlementsFor(konto);
  const garderobe = await garderobeVon(db, accountId);
  if (besitzt(stueck, garderobe, rechte.ownsEverything)) {
    throw conflict('itemAlreadyOwned');
  }

  const preis = preisIn(stueck, waehrung);
  const stand = await abbuchen(db, accountId, waehrung, preis);

  await db
    .insert(s.accountCosmetic)
    .values({ accountId, itemId: stueck.id })
    .onConflictDoNothing();

  return { itemId: stueck.id, bezahlt: preis, waehrung, stand };
}

// ---------------------------------------------------------------------------
// Pakete kaufen
// ---------------------------------------------------------------------------

export interface Paketkauf {
  readonly paketId: string;
  /** Was es gekostet hat — Edelsteine oder Muenzen, je nach Paket. */
  readonly bezahlt: number;
  /** Was es gebracht hat. */
  readonly gibt: { readonly waehrung: Guthaben; readonly betrag: number };
  /** Die Guthaben danach. */
  readonly stand: Stand;
}

/**
 * Ein Paket gegen Edelsteine kaufen. Heute sind das die drei Muenzpakete.
 *
 * Drei Riegel, alle gegen dieselbe Art von Anfrage — eine Kennung aus einer
 * Liste, in die sie nicht gehoert:
 *
 *  - Unbekannte Kennung: `packUnknown`.
 *  - Bekannt, aber `kaufbar: false` (Edelsteinpakete, VIP, Season Pass):
 *    `packNotForSale`. **Das ist der wichtigste** — ohne ihn waere
 *    `edelsteine-gross` der Weg, 400 Edelsteine gegen 0 zu bekommen, weil dort
 *    kein Edelsteinpreis steht.
 *  - Kaufbar, gibt aber keine Muenzen: `packNotForSale`. Ein Paket, das
 *    Edelsteine gegen Edelsteine taeuscht, oder ein Pass ohne Guthaben, laeuft
 *    nicht durch den Umtausch — der geht ausdruecklich nur eine Richtung.
 */
export async function paketKaufen(
  db: Db,
  accountId: string,
  paketId: string,
): Promise<Paketkauf> {
  const paket = PAKET_NACH_ID.get(paketId);
  if (!paket) throw notFound('packUnknown');
  if (!paket.kaufbar || paket.gibt === null) throw forbidden('packNotForSale');

  if (paket.gems !== null && paket.gibt.waehrung === 'coins') {
    const stand = await edelsteineZuMuenzen(db, accountId, paket.gems, paket.gibt.betrag);
    return { paketId: paket.id, bezahlt: paket.gems, gibt: paket.gibt, stand };
  }
  if (paket.coins !== null && paket.gibt.waehrung === 'broJetons') {
    const stand = await muenzenZuBroJetons(db, accountId, paket.coins, paket.gibt.betrag);
    return { paketId: paket.id, bezahlt: paket.coins, gibt: paket.gibt, stand };
  }
  throw forbidden('packNotForSale');
}

/** Wie oben, aber fuer Szenerien, Rueckseiten, Zurufe und Wappen. */
async function kaufeWare(
  db: Db,
  accountId: string,
  ware: Ware,
  waehrung: Waehrung,
): Promise<Kauf> {
  // Was allen gehoert, laesst sich nicht kaufen. Sonst koennte man Muenzen
  // fuer die Stube ausgeben, die man ohnehin hat.
  if (istFrei(ware)) throw conflict('itemAlreadyOwned');

  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  const rechte = entitlementsFor(konto);
  const eigen = await besitzVon(db, accountId, rechte.ownsEverything);
  if (eigen.has(ware.id)) throw conflict('itemAlreadyOwned');

  const betrag = waehrung === 'gems' ? ware.preis.gems : ware.preis.coins;
  const stand = await abbuchen(db, accountId, waehrung, betrag);

  await db
    .insert(s.accountCosmetic)
    .values({ accountId, itemId: ware.id })
    .onConflictDoNothing();

  return { itemId: ware.id, bezahlt: betrag, waehrung, stand };
}

// ---------------------------------------------------------------------------
// Anziehen
// ---------------------------------------------------------------------------

/**
 * Ein Stueck anziehen, oder einen Platz leer machen (`itemId === null`).
 *
 * Geprueft wird der Besitz, nicht nur die Kennung: Sonst waere
 * `PATCH /api/me/avatar {"aura":"aura-sterne"}` der Weg, ein legendaeres
 * Stueck zu tragen, ohne es zu haben. Genau diese Luecke ist der Grund, warum
 * das Anziehen ueberhaupt am Server haengt und nicht im Browser bleibt.
 */
export async function anziehen(
  db: Db,
  accountId: string,
  slot: Slot,
  itemId: string | null,
): Promise<void> {
  if (itemId === null) {
    await db
      .delete(s.accountAvatar)
      .where(and(eq(s.accountAvatar.accountId, accountId), eq(s.accountAvatar.slot, slot)));
    return;
  }

  const stueck = requireStueck(itemId);
  if (stueck.slot !== slot) throw conflict('itemWrongSlot');

  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  const garderobe = await garderobeVon(db, accountId);
  if (!besitzt(stueck, garderobe, entitlementsFor(konto).ownsEverything)) {
    throw forbidden('itemNotOwned');
  }

  await db
    .insert(s.accountAvatar)
    .values({ accountId, slot, itemId })
    .onConflictDoUpdate({
      target: [s.accountAvatar.accountId, s.accountAvatar.slot],
      set: { itemId },
    });
}

/** Getragenes eines Kontos, fuer /api/me und fremde Profile. */
export async function getragenVon(
  db: Db,
  accountId: string,
): Promise<Readonly<Partial<Record<Slot, string>>>> {
  return (await garderobeVon(db, accountId)).getragen;
}

export type { Garderobe };
