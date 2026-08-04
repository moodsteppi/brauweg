/**
 * Truhen.
 *
 * Drei Arten, ein Mechanismus:
 *
 *  - **Die Tagestruhe** steht jeden Kalendertag einmal bereit. Sie ist die
 *    Belohnung fuers Vorbeikommen, nicht fuers Gewinnen — deshalb haengt sie
 *    an keiner Bedingung ausser dem Tag.
 *  - **Stufentruhen** haengen an der Stufe (`src/level.ts`) und werden mit
 *    jeder hoeheren Stufe seltener und dicker. Erreicht ist erreicht: Eine
 *    Stufe kann nicht wieder fallen, also kann eine Stufentruhe nie
 *    zurueckgenommen werden.
 *  - **Kauftruhen** stehen im Shop und kosten Edelsteine. Sie warten nicht und
 *    sind nicht begrenzt: Gekauft heisst geoeffnet, das Ergebnis steht in der
 *    Antwort.
 *
 * **Es gibt nur Muenzen drin.** Das ist der bewusste Anfang: Truhen mit
 * Kosmetik darin waeren Zufallsboxen, und die sind laut Plan 11 ausgeschlossen
 * (`Nur Direktkauf zu festen Preisen, keine Zufallsboxen, nichts handelbar`).
 * Eine Truhe, die Muenzen ausschuettet, ist keine Zufallsbox: Man weiss vorher,
 * was drin ist, und die Spanne steht dran.
 *
 * **Bei der Kauftruhe ist das eine Entscheidung, die nachgeprueft werden muss.**
 * Sie wuerfelt wie die anderen, und bezahlt wird sie mit einer Waehrung, die am
 * Ende echtes Geld kostet — das ist derselbe Grenzbereich, wegen dem der Plan
 * Einsaetze und Zufallsboxen schon ausschliesst. Entschaerft ist es an zwei
 * Stellen: Die **Spanne steht dran**, und ihre **Mitte ist genau der Kurs**
 * (`MUENZEN_JE_EDELSTEIN`), das Wuerfeln kostet also im Erwartungswert nichts.
 * Wer statt der Spanne die Sicherheit will, kauft das Muenzpaket daneben, das
 * dasselbe Geld in eine feste Zahl umsetzt. Trotzdem: **Vor dem Anschluss eines
 * echten Bezahlwegs gehoert das noch einmal auf den Tisch** — spaetestens dann
 * ist es keine interne Zahl mehr, sondern ein Kauf.
 *
 * **Gewuerfelt wird genau einmal.** Das Ergebnis landet in `chest_claim` und
 * wird von dort gelesen. Wuerde die Anzeige neu wuerfeln, saehe derselbe Fund
 * bei jedem Laden anders aus — und wer oft genug neu laedt, bekommt irgendwann
 * die 3.
 */

import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { conflict, notFound } from './errors.js';
import { berlinToday } from './birthday.js';
import { stufeFuerPunkte } from './level.js';
import { abbuchen, gutschreiben, standVon, type Stand } from './waehrung.js';

export const GRADE = ['holz', 'bronze', 'silber', 'gold', 'diamant'] as const;
export type Grad = (typeof GRADE)[number];

/** Was eine Truhe ausschuettet, als geschlossene Spanne. */
export interface Spanne {
  readonly von: number;
  readonly bis: number;
}

/**
 * Was ein Grad ausschuettet — bei den **erspielten** Truhen.
 *
 * Die Tagestruhe ist bewusst mager (1 bis 3 Muenzen): Sie soll ein Grund sein
 * vorbeizukommen, nicht der Weg an alles. Wer den Kleiderschrank fuellen will,
 * spielt — eine Partie gibt ueber die Tagesaufgaben ein Mehrfaches davon.
 *
 * **Die Kauftruhen stehen bewusst nicht in dieser Tabelle**, obwohl sie
 * dieselben Grade tragen. Sie schuetten ein Vielfaches aus, weil sie ein
 * Vielfaches kosten; eine gemeinsame Tabelle haette entweder die Stufentruhen
 * masslos gemacht oder die Kauftruhen wertlos. Der Grad ist damit das Aussehen
 * und der Rang innerhalb seiner Art, nicht ein fester Betrag.
 */
export const SPANNE: Readonly<Record<Grad, Spanne>> = {
  holz: { von: 1, bis: 3 },
  bronze: { von: 4, bis: 8 },
  silber: { von: 10, bis: 20 },
  gold: { von: 25, bis: 45 },
  diamant: { von: 60, bis: 100 },
};

/**
 * Welche Stufe welche Truhe bringt.
 *
 * Nicht jede Stufe: Eine Truhe bei jedem Aufstieg waere ab Stufe zwanzig ein
 * Rauschen. Die Abstaende wachsen mit der Stufe, die Grade mit den Abstaenden.
 *
 * Die Liste hoert bei 50 auf, die Stufen aber nicht — jenseits davon gibt es
 * keine Truhen mehr. Das ist ehrlicher als eine Formel, die bis in die
 * Hunderter Gold ausschuettet, und leicht zu verlaengern, sobald jemand
 * wirklich dort ankommt.
 */
export const STUFENTRUHEN: readonly { readonly stufe: number; readonly grad: Grad }[] = [
  { stufe: 2, grad: 'holz' },
  { stufe: 3, grad: 'holz' },
  { stufe: 5, grad: 'bronze' },
  { stufe: 8, grad: 'bronze' },
  { stufe: 12, grad: 'silber' },
  { stufe: 16, grad: 'silber' },
  { stufe: 20, grad: 'gold' },
  { stufe: 25, grad: 'gold' },
  { stufe: 30, grad: 'diamant' },
  { stufe: 40, grad: 'diamant' },
  { stufe: 50, grad: 'diamant' },
];

/** Der Grad der Tagestruhe. */
export const TAGESTRUHE_GRAD: Grad = 'holz';

/**
 * Truhen, die im Shop stehen und Edelsteine kosten.
 *
 * **Die Mitte jeder Spanne ist genau `preis * MUENZEN_JE_EDELSTEIN`.** Das ist
 * die ganze Preisgestaltung: Das Wuerfeln kostet im Erwartungswert nichts, es
 * verteilt nur. Eine Truhe, deren Mitte unter dem Kurs liegt, waere eine
 * Gebuehr fuer Spannung; eine darueber waere der billigere Weg zu Muenzen und
 * damit die einzige Kaufentscheidung, die noch zaehlt. Ein Test haelt die
 * Rechnung fest, damit eine spaetere Zahlenaenderung sie nicht still bricht.
 *
 * Die Preise liegen bewusst **zwischen** den Muenzpaketen (35/100/250): So
 * steht neben einem Paket nie eine Truhe, die dasselbe zum selben Preis tut,
 * nur gewuerfelt. Wer die feste Zahl will, nimmt das Paket.
 */
export interface Kauftruhe extends Spanne {
  readonly id: string;
  readonly grad: Grad;
  readonly nameKey: string;
  /** Preis in Edelsteinen. */
  readonly gems: number;
}

export const KAUFTRUHEN: readonly Kauftruhe[] = [
  { id: 'truhe-silber', grad: 'silber', nameKey: 'truhe.silber', gems: 25, von: 250, bis: 500 },
  { id: 'truhe-gold', grad: 'gold', nameKey: 'truhe.gold', gems: 60, von: 650, bis: 1_150 },
  {
    id: 'truhe-diamant',
    grad: 'diamant',
    nameKey: 'truhe.diamant',
    gems: 150,
    von: 1_700,
    bis: 2_800,
  },
];

const KAUFTRUHE_NACH_ID = new Map(KAUFTRUHEN.map((truhe) => [truhe.id, truhe]));

/**
 * Praefix der Kennungen gekaufter Truhen in `chest_claim`.
 *
 * Eine gekaufte Truhe bekommt **je Kauf eine eigene Kennung** (`kauf-<uuid>`)
 * und nicht die des Katalogeintrags: Der Primaerschluessel aus Konto und
 * Kennung sperrt das zweite Oeffnen, und genau das darf hier nicht passieren —
 * eine Truhe, die man kaufen kann, muss man zweimal kaufen koennen. Die Sperre
 * gegen den doppelten Wurf braucht es hier auch nicht: Gekauft ist geoeffnet,
 * es gibt kein spaeteres Antippen.
 */
const KAUF_PRAEFIX = 'kauf-';

/**
 * Kennung einer Truhe.
 *
 * Bei der Tagestruhe steckt der Kalendertag drin, bei der Stufentruhe die
 * Stufe. Damit ist die Sperre gegen das zweite Oeffnen fuer beide Arten
 * derselbe Primaerschluessel, und die Truhen von gestern bleiben als Verlauf
 * stehen — ohne eine zweite Tabelle und ohne naechtliches Aufraeumen.
 */
export function tagesTruheId(tag: string): string {
  return `tag-${tag}`;
}

export function stufenTruheId(stufe: number): string {
  return `stufe-${stufe}`;
}

/** Heutiger Kalendertag in Berlin als ISO-Zeichenkette. */
export function heute(now = new Date()): string {
  const { y, m, d } = berlinToday(now);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface TruhenAnsicht {
  readonly id: string;
  readonly art: 'tag' | 'stufe';
  readonly grad: Grad;
  /** Spanne, die drinsteht — sie wird angezeigt, damit nichts geraten wird. */
  readonly von: number;
  readonly bis: number;
  /** Offen: darf jetzt geoeffnet werden. */
  readonly offen: boolean;
  /** Schon geholt — dann steht in `coins`, was drin war. */
  readonly geholt: boolean;
  readonly coins: number | null;
  /** Bei Stufentruhen: ab welcher Stufe. Sonst null. */
  readonly abStufe: number | null;
  /** Bei gesperrten Stufentruhen: wie viele Stufen noch fehlen. */
  readonly fehltStufen: number | null;
}

/**
 * Alle Truhen eines Kontos: die heutige und die Stufentruhen.
 *
 * Vollstaendig, auch die noch gesperrten. Nach DESIGN.md steht das, was es
 * noch nicht gibt, trotzdem in der Oberflaeche — bei Truhen ist das sogar der
 * Kern: Wer nicht sieht, dass bei Stufe 5 eine Bronzetruhe wartet, hat keinen
 * Grund, dorthin zu wollen.
 */
export async function truhenFuer(
  db: Db,
  accountId: string,
  now = new Date(),
): Promise<{ readonly tag: TruhenAnsicht; readonly stufen: readonly TruhenAnsicht[] }> {
  const [konto] = await db
    .select({ xp: s.account.xp })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  const stufe = stufeFuerPunkte(konto.xp);
  const tag = heute(now);

  const ids = [tagesTruheId(tag), ...STUFENTRUHEN.map((t) => stufenTruheId(t.stufe))];
  const geholt = await db
    .select({ chestId: s.chestClaim.chestId, coins: s.chestClaim.coins })
    .from(s.chestClaim)
    .where(and(eq(s.chestClaim.accountId, accountId), inArray(s.chestClaim.chestId, ids)));
  const standVon = new Map(geholt.map((zeile) => [zeile.chestId, zeile.coins]));

  const tagId = tagesTruheId(tag);
  const tagGeholt = standVon.has(tagId);

  return {
    tag: {
      id: tagId,
      art: 'tag',
      grad: TAGESTRUHE_GRAD,
      ...SPANNE[TAGESTRUHE_GRAD],
      offen: !tagGeholt,
      geholt: tagGeholt,
      coins: standVon.get(tagId) ?? null,
      abStufe: null,
      fehltStufen: null,
    },
    stufen: STUFENTRUHEN.map((eintrag) => {
      const id = stufenTruheId(eintrag.stufe);
      const istGeholt = standVon.has(id);
      const erreicht = stufe >= eintrag.stufe;
      return {
        id,
        art: 'stufe' as const,
        grad: eintrag.grad,
        ...SPANNE[eintrag.grad],
        offen: erreicht && !istGeholt,
        geholt: istGeholt,
        coins: standVon.get(id) ?? null,
        abStufe: eintrag.stufe,
        fehltStufen: erreicht ? null : eintrag.stufe - stufe,
      };
    }),
  };
}

/**
 * Wie viele Truhen offenstehen — nur die Zahl.
 *
 * Eigene, schlanke Abfrage statt `truhenFuer`: Sie haengt an `/api/me`, und das
 * laeuft bei jedem Laden. Der Punktestand kommt als Parameter herein, weil der
 * Aufrufer das Konto schon geladen hat; eine zweite Abfrage dafuer waere reine
 * Verschwendung.
 */
export async function offeneTruhen(
  db: Db,
  accountId: string,
  xp: number,
  now = new Date(),
): Promise<number> {
  const stufe = stufeFuerPunkte(xp);
  const erreichbar = STUFENTRUHEN.filter((t) => stufe >= t.stufe).map((t) =>
    stufenTruheId(t.stufe),
  );
  const ids = [tagesTruheId(heute(now)), ...erreichbar];

  const geholt = await db
    .select({ chestId: s.chestClaim.chestId })
    .from(s.chestClaim)
    .where(and(eq(s.chestClaim.accountId, accountId), inArray(s.chestClaim.chestId, ids)));

  return ids.length - geholt.length;
}

export interface Fund {
  readonly chestId: string;
  readonly grad: Grad;
  readonly coins: number;
  /** Muenzstand nach der Gutschrift. */
  readonly stand: number;
}

/**
 * Truhe oeffnen: wuerfeln, eintragen, gutschreiben.
 *
 * Die Reihenfolge ist Absicht. Der Eintrag in `chest_claim` kommt VOR der
 * Gutschrift und mit `onConflictDoNothing`: Nur wer die Zeile wirklich angelegt
 * hat, schreibt danach Muenzen. Zwei gleichzeitige Anfragen legen deshalb nie
 * zweimal gut — die zweite bekommt keine Zeile zurueck und wirft.
 *
 * Andersherum waere der Fehler teuer: Erst gutschreiben, dann eintragen heisst,
 * dass ein doppelter Tipp zweimal zahlt.
 */
export async function truheOeffnen(
  db: Db,
  accountId: string,
  chestId: string,
  now = new Date(),
): Promise<Fund> {
  const grad = await gradPruefen(db, accountId, chestId, now);
  const coins = wuerfeln(grad);

  const eingetragen = await db
    .insert(s.chestClaim)
    .values({ accountId, chestId, grade: grad, coins })
    .onConflictDoNothing()
    .returning({ chestId: s.chestClaim.chestId });

  if (eingetragen.length === 0) throw conflict('chestAlreadyOpened');

  const stand = await gutschreiben(db, accountId, 'coins', coins);
  return { chestId, grad, coins, stand };
}

/**
 * Darf diese Truhe jetzt geoeffnet werden? Gibt ihren Grad zurueck.
 *
 * Geprueft wird gegen die eigenen Listen und nie gegen das, was der Client
 * schickt: Sonst waere `{"chestId":"stufe-50"}` der kuerzeste Weg zu hundert
 * Muenzen.
 */
async function gradPruefen(
  db: Db,
  accountId: string,
  chestId: string,
  now: Date,
): Promise<Grad> {
  if (chestId === tagesTruheId(heute(now))) return TAGESTRUHE_GRAD;

  // Eine Tagestruhe von gestern ist keine Truhe mehr. Sie steht noch im
  // Verlauf, aber sie oeffnet sich nicht nachtraeglich - sonst waere eine
  // Woche Pause eine Woche Truhen.
  if (chestId.startsWith('tag-')) throw conflict('chestExpired');

  // Eine Kauftruhe ist mit dem Kauf geoeffnet. Ihre Kennung darf hier nie
  // durchkommen: Sonst waere `/open` mit der Kennung aus der Kaufantwort der
  // Weg, denselben Fund ein zweites Mal gutzuschreiben. Die Zeile in
  // `chest_claim` wuerde es zwar auch verhindern — aber erst nach dem Wurf und
  // mit einem Konflikt, der nach einem Fehler aussieht statt nach einer Regel.
  if (chestId.startsWith(KAUF_PRAEFIX)) throw notFound('chestUnknown');

  const eintrag = STUFENTRUHEN.find((t) => stufenTruheId(t.stufe) === chestId);
  if (!eintrag) throw notFound('chestUnknown');

  const [konto] = await db
    .select({ xp: s.account.xp })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  if (stufeFuerPunkte(konto.xp) < eintrag.stufe) throw conflict('chestLocked');
  return eintrag.grad;
}

/**
 * Der Wurf.
 *
 * Gleichverteilt ueber die Spanne, beide Enden eingeschlossen. Bewusst ohne
 * Gewichtung: Eine Spanne von 1 bis 3, in der die 3 selten ist, ist in
 * Wahrheit eine Spanne von 1 bis 2 mit einer Fussnote.
 */
export function wuerfelnIn({ von, bis }: Spanne, zufall = Math.random): number {
  return von + Math.floor(zufall() * (bis - von + 1));
}

/** Der Wurf einer erspielten Truhe, deren Spanne am Grad haengt. */
export function wuerfeln(grad: Grad, zufall = Math.random): number {
  return wuerfelnIn(SPANNE[grad], zufall);
}

// ---------------------------------------------------------------------------
// Kauftruhen
// ---------------------------------------------------------------------------

export interface Kauffund {
  /** Die Kennung, unter der der Kauf in `chest_claim` steht. */
  readonly chestId: string;
  /** Der Katalogeintrag, der gekauft wurde. */
  readonly truheId: string;
  readonly grad: Grad;
  /** Was drin war. */
  readonly coins: number;
  /** Was sie gekostet hat, in Edelsteinen. */
  readonly bezahlt: number;
  /** Beide Staende danach — es haben sich beide geaendert. */
  readonly stand: Stand;
}

/**
 * Truhe kaufen: bezahlen, wuerfeln, eintragen, gutschreiben.
 *
 * **Erst abbuchen, dann gutschreiben** — dieselbe Reihenfolge wie beim
 * Kosmetikkauf und aus demselben Grund. Bricht es dazwischen ab, sind die
 * Edelsteine weg und die Muenzen nicht da: unangenehm, reparierbar, und es
 * meldet sich jemand. Andersherum waeren die Muenzen da und die Edelsteine
 * auch, und das meldet niemand.
 *
 * Der Preis kommt aus dem Katalog und nie aus der Anfrage — dieselbe Regel wie
 * in `shop.ts`. Die Kennung wird gegen `KAUFTRUHEN` geprueft, damit
 * `{"truheId":"stufe-50"}` nichts anderes trifft als ein `chestUnknown`.
 *
 * Anders als beim Oeffnen gibt es hier **keine Sperre gegen den zweiten
 * Aufruf**: Eine Kauftruhe darf zweimal gekauft werden. Der Schutz gegen den
 * doppelten Tipp ist die Abbuchung selbst — zweimal kaufen kostet zweimal.
 */
export async function truheKaufen(
  db: Db,
  accountId: string,
  truheId: string,
): Promise<Kauffund> {
  const truhe = KAUFTRUHE_NACH_ID.get(truheId);
  if (!truhe) throw notFound('chestUnknown');

  await abbuchen(db, accountId, 'gems', truhe.gems);

  const coins = wuerfelnIn(truhe);
  const chestId = `${KAUF_PRAEFIX}${randomUUID()}`;

  // Ohne onConflictDoNothing: Die Kennung ist je Kauf neu, ein Konflikt waere
  // eine doppelte UUID und damit kein Fall, den man abfangen, sondern einer,
  // von dem man hoeren will.
  await db.insert(s.chestClaim).values({ accountId, chestId, grade: truhe.grad, coins });

  await gutschreiben(db, accountId, 'coins', coins);

  return {
    chestId,
    truheId: truhe.id,
    grad: truhe.grad,
    coins,
    bezahlt: truhe.gems,
    stand: await standVon(db, accountId),
  };
}
