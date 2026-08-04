/**
 * Shop.
 *
 * Zwei Sorten Angebot, streng getrennt:
 *
 *  1. **Kaufbar** — Kosmetik gegen Muenzen oder Edelsteine. Das laeuft
 *     wirklich: `kaufen()` bucht ab und traegt den Besitz ein.
 *  2. **Bald** — alles, was echtes Geld kostet (Muenz- und Edelsteinpakete,
 *     VIP, Season Pass). Preis steht dran, gekauft wird nichts.
 *
 * Warum die zweite Sorte trotzdem schon dasteht: DESIGN.md verlangt es —
 * „Was es noch nicht gibt, steht trotzdem in der Oberflaeche, mit ehrlicher
 * Null und Bald-Marke." Und der Shop muss seine endgueltige Form haben, bevor
 * ein Bezahlweg dazukommt: Ein Regal, das erst mit dem Zahlungsdienst
 * entworfen wird, wird nach dem Zahlungsdienst entworfen.
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
 * Bezahlweg. Siehe docs/APPSTORE.md.
 */

import { and, eq } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { conflict, forbidden, notFound } from './errors.js';
import { entitlementsFor } from './entitlements.js';
import {
  type Garderobe,
  type Slot,
  SLOTS,
  besitzt,
  garderobeVon,
  KATALOG,
  requireStueck,
} from './kosmetik.js';
import { abbuchen, type Waehrung } from './waehrung.js';
import { type Ware, type WareArt, WAREN, besitzVon, wareMit } from './tischware.js';

// ---------------------------------------------------------------------------
// Angebote gegen echtes Geld — heute alle "bald"
// ---------------------------------------------------------------------------

export interface Paket {
  readonly id: string;
  readonly nameKey: string;
  /** Was drin ist. Null bei Paessen, die kein Guthaben geben. */
  readonly gibt: { readonly waehrung: Waehrung; readonly betrag: number } | null;
  /** Anzeigepreis in ganzen Cent. Platzhalter, siehe Kopf der Datei. */
  readonly cents: number;
  /** Prozent Aufschlag gegenueber dem kleinsten Paket — der "Spartipp". */
  readonly bonus: number | null;
}

/**
 * Muenzpakete.
 *
 * Die Staffelung ist die uebliche: Je groesser das Paket, desto mehr Muenzen
 * je Euro. Sie ist hier nur Beispiel — was sie taugt, entscheidet sich erst,
 * wenn feststeht, was ein Hut kosten soll.
 */
export const MUENZPAKETE: readonly Paket[] = [
  { id: 'muenzen-klein', nameKey: 'shop.muenzen-klein', gibt: { waehrung: 'coins', betrag: 500 }, cents: 199, bonus: null },
  { id: 'muenzen-mittel', nameKey: 'shop.muenzen-mittel', gibt: { waehrung: 'coins', betrag: 1_500 }, cents: 499, bonus: 20 },
  { id: 'muenzen-gross', nameKey: 'shop.muenzen-gross', gibt: { waehrung: 'coins', betrag: 4_000 }, cents: 999, bonus: 60 },
];

export const EDELSTEINPAKETE: readonly Paket[] = [
  { id: 'edelsteine-klein', nameKey: 'shop.edelsteine-klein', gibt: { waehrung: 'gems', betrag: 50 }, cents: 299, bonus: null },
  { id: 'edelsteine-mittel', nameKey: 'shop.edelsteine-mittel', gibt: { waehrung: 'gems', betrag: 150 }, cents: 799, bonus: 12 },
  { id: 'edelsteine-gross', nameKey: 'shop.edelsteine-gross', gibt: { waehrung: 'gems', betrag: 400 }, cents: 1_899, bonus: 26 },
];

/** Paesse. Kein Guthaben, sondern ein Zeitraum — deshalb `gibt: null`. */
export const PAESSE: readonly Paket[] = [
  { id: 'vip-pass', nameKey: 'shop.vip-pass', gibt: null, cents: 499, bonus: null },
  { id: 'season-pass', nameKey: 'shop.season-pass', gibt: null, cents: 899, bonus: null },
];

// ---------------------------------------------------------------------------
// Ansicht
// ---------------------------------------------------------------------------

export interface RegalStueck {
  readonly id: string;
  readonly slot: Slot;
  readonly nameKey: string;
  readonly seltenheit: string;
  readonly preis: number;
  readonly waehrung: Waehrung;
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
  readonly preis: number;
  readonly waehrung: Waehrung;
  readonly besessen: boolean;
}

export interface ShopAnsicht {
  readonly paesse: readonly Paket[];
  readonly muenzpakete: readonly Paket[];
  readonly edelsteinpakete: readonly Paket[];
  /** Szenerien und Blaetter, inklusive der kostenlosen. */
  readonly tischware: readonly RegalWare[];
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
      waehrung: ware.waehrung,
      besessen: eigeneWare.has(ware.id),
    })),
    regale: SLOTS.map((slot) => ({
      slot,
      stuecke: KATALOG.filter((stueck) => stueck.slot === slot).map((stueck) => ({
        id: stueck.id,
        slot: stueck.slot,
        nameKey: stueck.nameKey,
        seltenheit: stueck.seltenheit,
        preis: stueck.preis,
        waehrung: stueck.waehrung,
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
 * Kosmetik kaufen.
 *
 * Reihenfolge wie bei den Truhen: **erst abbuchen, dann eintragen.** Bricht
 * das Eintragen ab, ist Geld weg und die Ware nicht da — das ist
 * unangenehm, aber reparierbar. Andersherum waere die Ware da und das Geld
 * noch vorhanden, und das ist der Fehler, den niemand meldet.
 *
 * Der Preis kommt aus dem Katalog und nie aus der Anfrage. Ein Client, der
 * `{"preis":0}` mitschickt, aendert damit nichts — er schickt es an eine
 * Stelle, die nicht hinsieht.
 */
export async function kaufen(db: Db, accountId: string, itemId: string): Promise<Kauf> {
  // Ware fuer den Tisch (Szenerien, spaeter Blaetter) liegt in einem eigenen
  // Katalog, teilt sich aber die Besitztabelle. Sie wird zuerst gefragt,
  // damit `requireStueck` nicht ueber eine Kennung stolpert, die es kennt.
  const ware = wareMit(itemId);
  if (ware) return kaufeWare(db, accountId, ware);

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

  const stand = await abbuchen(db, accountId, stueck.waehrung, stueck.preis);

  await db
    .insert(s.accountCosmetic)
    .values({ accountId, itemId: stueck.id })
    .onConflictDoNothing();

  return { itemId: stueck.id, bezahlt: stueck.preis, waehrung: stueck.waehrung, stand };
}

/** Wie oben, aber fuer Szenerien und Blaetter. */
async function kaufeWare(db: Db, accountId: string, ware: Ware): Promise<Kauf> {
  // Was allen gehoert, laesst sich nicht kaufen. Sonst koennte man Muenzen
  // fuer die Stube ausgeben, die man ohnehin hat.
  if (ware.preis === 0) throw conflict('itemAlreadyOwned');

  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  const rechte = entitlementsFor(konto);
  const eigen = await besitzVon(db, accountId, rechte.ownsEverything);
  if (eigen.has(ware.id)) throw conflict('itemAlreadyOwned');

  const stand = await abbuchen(db, accountId, ware.waehrung, ware.preis);

  await db
    .insert(s.accountCosmetic)
    .values({ accountId, itemId: ware.id })
    .onConflictDoNothing();

  return { itemId: ware.id, bezahlt: ware.preis, waehrung: ware.waehrung, stand };
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
