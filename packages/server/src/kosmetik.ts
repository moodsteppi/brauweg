/**
 * Der Pinguin und seine Ausstattung.
 *
 * Dieselbe Trennung wie bei Kartenblatt und Szenerie: **Der Server kennt
 * Kennung, Platz und Preis, nie das Aussehen.** Wie eine Wollmuetze aussieht,
 * weiss allein der Client — und muss es auch, denn ein Bild, das der Server
 * kennt, waere ein Bild, das er ausliefern muesste.
 *
 * Fuenf Plaetze, weil sich fuenf am Pinguin ueberschneidungsfrei zeichnen
 * lassen: Kopf, Rumpf, Fuesse, eine Flosse, und der Raum ringsum. Ein
 * sechster Platz ist ein Eintrag in `SLOTS` und keine Migration — die
 * Zuordnung steht in `account_avatar` als Zeile, nicht als Spalte.
 *
 * **Jedes Stueck hat zwei Preise**, einen in Muenzen und einen in Edelsteinen;
 * bezahlt wird mit einer der beiden, und der Kaeufer waehlt. Gefuehrt wird
 * trotzdem nur eine Zahl je Stueck — die zweite leitet `waehrung.ts` aus dem
 * Kurs ab. Zwei von Hand gepflegte Preise waeren zwei Wahrheiten, und die
 * zweite faellt erst auf, wenn jemand den billigeren Weg gefunden hat.
 *
 * Dass damit auch die legendaeren Stuecke erspielbar sind, ist die Folge und
 * gewollt: Sie kosten in Muenzen das Fuenfzehnfache, sind also weit teurer als
 * alles andere im Regal, aber nicht mehr unerreichbar fuer den, der nicht zahlt.
 *
 * **Preis 0 heisst "gehoert allen".** Dafuer entsteht keine Besitzzeile: Sonst
 * bekaeme jedes neue Konto fuenf Zeilen geschenkt, nur damit es einen Pulli
 * anziehen darf. Besitz wird deshalb immer ueber `besitzt()` gefragt und nie
 * allein ueber die Tabelle.
 *
 * **Die Preise sind vorlaeufig.** Sie stehen hier, damit der Shop echte Zahlen
 * zeigt und die Abbuchung wirklich laeuft; ausbalanciert ist daran nichts.
 * Wer sie aendert, aendert nur diese Datei — alte Besitzzeilen bleiben gueltig,
 * weil dort kein Preis steht.
 */

import { eq } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { notFound } from './errors.js';
import { inEdelsteine, inMuenzen, type Waehrung } from './waehrung.js';

// ---------------------------------------------------------------------------
// Plaetze
// ---------------------------------------------------------------------------

export const SLOTS = ['hut', 'oberteil', 'schuhe', 'hand', 'aura'] as const;
export type Slot = (typeof SLOTS)[number];

export function istSlot(wert: string): wert is Slot {
  return (SLOTS as readonly string[]).includes(wert);
}

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

/**
 * Seltenheit. Steuert im Client nur den Rahmen — sie ist eine Aussage ueber
 * den Preis, keine ueber die Wirkung: **Kosmetik veraendert nie das Spiel.**
 * Ein Hut, der Trumpf sticht, waere der Anfang von Pay-to-win.
 */
export const SELTENHEITEN = ['gewoehnlich', 'selten', 'episch', 'legendaer'] as const;
export type Seltenheit = (typeof SELTENHEITEN)[number];

/**
 * Woher ein Stueck kommt.
 *
 * `shop` ist kaufbar, `geschenk` nicht — es gibt nur einen Weg hinein (heute:
 * den Geburtstag). Ohne diese Unterscheidung waere das Geburtstagsoutfit fuer
 * 200 Muenzen zu haben, und der Geburtstag damit belanglos.
 */
export type Herkunft = 'shop' | 'geschenk';

/**
 * Was ein Stueck kostet — in beiden Waehrungen.
 *
 * Beide Zahlen stehen gleichberechtigt da, damit die Oberflaeche nicht rechnen
 * muss und der Server nicht zweimal: Der Client zeigt, was hier steht.
 */
export interface Preis {
  readonly coins: number;
  readonly gems: number;
}

export interface Stueck {
  readonly id: string;
  readonly slot: Slot;
  readonly nameKey: string;
  readonly seltenheit: Seltenheit;
  readonly herkunft: Herkunft;
  /** 0 in beiden Waehrungen heisst: gehoert allen, kein Kauf noetig. */
  readonly preis: Preis;
}

/**
 * Der Katalog.
 *
 * Je Platz ein Stueck zum Preis 0, damit der Kleiderschrank ohne eine einzige
 * Muenze benutzbar ist — ein Editor, der beim ersten Oeffnen nur Schloesser
 * zeigt, erklaert sich nicht.
 *
 * Darueber je Platz eine Reihe, deren Preis in **Muenzen** gefuehrt wird, und
 * genau ein legendaeres Stueck, dessen Preis in **Edelsteinen** gefuehrt wird.
 * Welche Waehrung hier steht, sagt nur, worin die Zahl gepflegt ist — kaufen
 * kann man jedes Stueck in beiden (siehe Kopf der Datei). Das legendaere ist
 * je Platz eines, und der teuerste Platz ist die Aura, weil sie am weitesten
 * sichtbar ist.
 */
export const KATALOG: readonly Stueck[] = [
  // --- Kopf ---------------------------------------------------------------
  frei('hut-wollmuetze', 'hut'),
  muenzen('hut-strohhut', 'hut', 120),
  muenzen('hut-zylinder', 'hut', 250, 'selten'),
  muenzen('hut-bergsteiger', 'hut', 400, 'episch'),
  edelsteine('hut-krone', 'hut', 40, 'legendaer'),
  geschenk('hut-partyhut', 'hut', 'episch'),

  // --- Rumpf --------------------------------------------------------------
  frei('oberteil-pulli', 'oberteil'),
  muenzen('oberteil-trikot', 'oberteil', 120),
  muenzen('oberteil-weste', 'oberteil', 200),
  muenzen('oberteil-regenjacke', 'oberteil', 320, 'selten'),
  edelsteine('oberteil-frack', 'oberteil', 60, 'legendaer'),

  // --- Fuesse -------------------------------------------------------------
  frei('schuhe-flossen', 'schuhe'),
  muenzen('schuhe-gummistiefel', 'schuhe', 100),
  muenzen('schuhe-turnschuhe', 'schuhe', 180),
  muenzen('schuhe-schlittschuhe', 'schuhe', 260, 'selten'),
  edelsteine('schuhe-goldstiefel', 'schuhe', 50, 'legendaer'),

  // --- Flosse -------------------------------------------------------------
  frei('hand-kakao', 'hand'),
  muenzen('hand-kartenfaecher', 'hand', 150),
  muenzen('hand-wanderstab', 'hand', 220),
  muenzen('hand-laterne', 'hand', 300, 'selten'),
  edelsteine('hand-zauberstab', 'hand', 55, 'legendaer'),

  // --- Ringsum ------------------------------------------------------------
  frei('aura-glitzer', 'aura'),
  muenzen('aura-blaetter', 'aura', 200),
  muenzen('aura-schneeflocken', 'aura', 280, 'selten'),
  muenzen('aura-funken', 'aura', 380, 'episch'),
  edelsteine('aura-sterne', 'aura', 70, 'legendaer'),
  geschenk('aura-konfetti', 'aura', 'episch'),
];

function frei(id: string, slot: Slot): Stueck {
  return {
    id,
    slot,
    nameKey: `kosmetik.${id}`,
    seltenheit: 'gewoehnlich',
    herkunft: 'shop',
    preis: { coins: 0, gems: 0 },
  };
}

/** Preis in Muenzen gefuehrt, der Edelsteinpreis kommt aus dem Kurs. */
function muenzen(
  id: string,
  slot: Slot,
  coins: number,
  seltenheit: Seltenheit = 'gewoehnlich',
): Stueck {
  return {
    id,
    slot,
    nameKey: `kosmetik.${id}`,
    seltenheit,
    herkunft: 'shop',
    preis: { coins, gems: inEdelsteine(coins) },
  };
}

/** Preis in Edelsteinen gefuehrt, der Muenzpreis kommt aus dem Kurs. */
function edelsteine(id: string, slot: Slot, gems: number, seltenheit: Seltenheit): Stueck {
  return {
    id,
    slot,
    nameKey: `kosmetik.${id}`,
    seltenheit,
    herkunft: 'shop',
    preis: { coins: inMuenzen(gems), gems },
  };
}

/** Nur zu bekommen, nicht zu kaufen. Der Preis ist bewusst unerreichbar. */
function geschenk(id: string, slot: Slot, seltenheit: Seltenheit): Stueck {
  return {
    id,
    slot,
    nameKey: `kosmetik.${id}`,
    seltenheit,
    herkunft: 'geschenk',
    preis: { coins: 0, gems: 0 },
  };
}

const NACH_ID = new Map(KATALOG.map((stueck) => [stueck.id, stueck]));

export function stueckMit(id: string): Stueck | undefined {
  return NACH_ID.get(id);
}

/** Wirft, wenn es die Kennung nicht gibt. Fuer Endpunkte, die eine erwarten. */
export function requireStueck(id: string): Stueck {
  const stueck = NACH_ID.get(id);
  if (!stueck) throw notFound('itemUnknown');
  return stueck;
}

/**
 * Was das Stueck in dieser Waehrung kostet.
 *
 * Eine Funktion und kein `stueck.preis[waehrung]` an den Aufrufstellen: Der
 * Zugriff soll durch eine Stelle laufen, die sich anpassen laesst, falls je ein
 * Stueck nur in einer Waehrung zu haben sein soll.
 */
export function preisIn(stueck: Stueck, waehrung: Waehrung): number {
  return waehrung === 'gems' ? stueck.preis.gems : stueck.preis.coins;
}

/** Das Geburtstagsoutfit — was der Geburtstags-Pinguin einbringt. */
export const GEBURTSTAGS_OUTFIT = ['hut-partyhut', 'aura-konfetti'] as const;

// ---------------------------------------------------------------------------
// Besitz und Getragenes
// ---------------------------------------------------------------------------

export interface Garderobe {
  /** Kennungen aller Stuecke, die diesem Konto gehoeren (ohne die freien). */
  readonly besitz: ReadonlySet<string>;
  /** Was gerade getragen wird, je Platz. Ein leerer Platz fehlt. */
  readonly getragen: Readonly<Partial<Record<Slot, string>>>;
}

/**
 * Was einem Konto gehoert und was es traegt.
 *
 * **Getragenes wird beim Lesen NICHT gegen den Besitz geprueft.** Der Besitz
 * wird beim Anziehen geprueft (`shop.ts`, `anziehen`), und gekaufte Stuecke
 * bleiben fuer immer — es gibt also keinen gewoehnlichen Weg, etwas zu tragen,
 * was einem nicht gehoert.
 *
 * Einen Grenzfall gibt es doch: Ein Testkonto (`ownsEverything`) darf alles
 * anziehen; verliert es das Merkmal, bleibt das Angezogene an. Das ist
 * hingenommen und nicht behoben, weil die Abhilfe teuer und der Fall
 * bedeutungslos ist: Die Pruefung muesste bei JEDEM `/api/me` laufen — dem
 * haeufigsten Aufruf der Anwendung —, und betroffen sind ausschliesslich
 * Konten aus `STAFF_EMAILS`. Kaeufliche Stuecke koennen nicht verfallen.
 *
 * Sollte es je zeitlich begrenzte Kosmetik geben (ein Stueck, das nur mit VIP
 * traegt), muss diese Entscheidung neu getroffen werden.
 */
export async function garderobeVon(db: Db, accountId: string): Promise<Garderobe> {
  const [eigene, angezogen] = await Promise.all([
    db
      .select({ itemId: s.accountCosmetic.itemId })
      .from(s.accountCosmetic)
      .where(eq(s.accountCosmetic.accountId, accountId)),
    db
      .select({ slot: s.accountAvatar.slot, itemId: s.accountAvatar.itemId })
      .from(s.accountAvatar)
      .where(eq(s.accountAvatar.accountId, accountId)),
  ]);

  const getragen: Partial<Record<Slot, string>> = {};
  for (const zeile of angezogen) {
    // Ein Platz, den der Katalog nicht mehr kennt, wird stillschweigend
    // uebergangen statt angezeigt: Die Zeile kann aus der Zeit vor einer
    // Umbenennung stammen, und ein leerer Platz ist besser als ein Loch.
    if (istSlot(zeile.slot)) getragen[zeile.slot] = zeile.itemId;
  }

  return { besitz: new Set(eigene.map((zeile) => zeile.itemId)), getragen };
}

/**
 * Gehoert dieses Stueck dem Konto?
 *
 * Drei Wege zu "ja": Der Preis ist 0, es steht in der Besitztabelle, oder das
 * Konto ist ein Testkonto (`ownsEverything`). Der dritte ist der Grund, warum
 * das eine Funktion ist und kein `besitz.has(id)` an zwanzig Stellen.
 */
export function besitzt(
  stueck: Stueck,
  garderobe: Garderobe,
  ownsEverything = false,
): boolean {
  if (ownsEverything) return true;
  // Frei ist nur, was in BEIDEN Waehrungen nichts kostet. Ein Stueck mit
  // `{ coins: 0, gems: 3 }` waere sonst gratis statt guenstig.
  if (stueck.preis.coins === 0 && stueck.preis.gems === 0 && stueck.herkunft === 'shop') {
    return true;
  }
  return garderobe.besitz.has(stueck.id);
}

/** Traegt ein Stueck ins Eigentum ein. Zweimal aufgerufen aendert nichts. */
export async function schenken(
  db: Db,
  accountId: string,
  itemIds: readonly string[],
): Promise<void> {
  const gueltig = itemIds.filter((id) => NACH_ID.has(id));
  if (gueltig.length === 0) return;

  await db
    .insert(s.accountCosmetic)
    .values(gueltig.map((itemId) => ({ accountId, itemId })))
    .onConflictDoNothing();
}
