/**
 * Mememory-Motive: Vorschlagskasten, Freigabe, Katalog.
 *
 * Der Grund fuer diese Datei: Ein neues Meme sollte bisher ein Commit sein.
 * Bild nach `packages/client/public/mememory/motive/`, Kennung in
 * `motive.ts`, bauen, deployen. Das ist der falsche Aufwand fuer ein Bild,
 * das jemand unterwegs auf dem Handy findet.
 *
 * **Warum das die Trennung "der Server kennt kein einzelnes Spiel" nicht
 * bricht:** Hier steht keine Regel. Es geht um Inhalt — ein Bild, ein
 * Zustand, eine Freigabe. Das Spielmodul bleibt rein und uhrlos; es bekommt
 * die Motivliste als gewoehnlichen Teil der Tisch-`config` und weiss nicht,
 * woher sie kommt. Dieselbe Bauart wie `diagnose.ts` (Feldherr): spielnah,
 * ohne Regelwissen.
 *
 * **Zwei Zustaende, kein dritter.** 'vorschlag' wartet auf die Aufsicht,
 * 'frei' ist im Spiel. Abgelehnt heisst geloescht — ausgerechnet die Bilder,
 * die jemand abgelehnt hat, will man nicht aufbewahren.
 *
 * **Packs (spaeter).** Jede Zeile hat eine Spalte `pack`; NULL ist der
 * Grundtopf, den alle sehen. Ein eigener Pack ist spaeter eine Kennung in
 * dieser Spalte plus ein Filter in `freieKennungen` — die Motivliste geht
 * ohnehin schon je Tisch in die `config`, es gibt also keinen Umbau.
 */

import { randomBytes } from 'node:crypto';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { BILD_DATA_URL, bytesAusDataUrl, istEchtesBild } from './bilder.js';
import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest, conflict, notFound } from './errors.js';

/**
 * Vorsatz jeder hochgeladenen Kennung.
 *
 * Er ist der ganze Trick, mit dem der Client ohne einen zweiten Abruf weiss,
 * wo ein Bild liegt: Was mit `hoch-` beginnt, kommt ueber
 * `/api/mememory/motive/<kennung>`, alles andere aus `public/`. Wer ihn
 * aendert, muss `motivBild()` in Mememory.tsx mitaendern — sonst steht auf
 * der Karte ein weisser Kasten, und das ist laut docs/STAND.md genau der
 * Fehler, der schon zweimal live ging.
 */
export const HOCH_VORSATZ = 'hoch-';

/** Form einer gueltigen Kennung. Auch die des Grundkatalogs passen hierauf. */
export const KENNUNG_MUSTER = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Groesstes erlaubtes Bild als Zeichenzahl der data-URL.
 *
 * Der Client verkleinert auf ein Quadrat von 320 px; das sind als WebP
 * ueblicherweise 15 bis 40 kB. 60 000 Zeichen (~45 kB Bytes) lassen Luft
 * fuer ein sperriges JPEG und bleiben weit unter der Rumpfgrenze des
 * Servers (128 kB). Der Riegel steht hier, weil die Verkleinerung im
 * Browser passiert und ein Browser sich umgehen laesst.
 */
export const BILD_MAX_ZEICHEN = 60_000;

/** Laengster erlaubter Titel. Anzeige, kein Spielinhalt. */
export const TITEL_MAX = 40;

/**
 * So viele unbearbeitete Vorschlaege darf ein Konto gleichzeitig offen haben.
 *
 * Ohne diese Zahl kann ein Einzelner den Kasten in einer Minute mit
 * hundert Bildern zuschuetten, und die Aufsicht sortiert danach von Hand.
 * Fuenf reichen fuer jeden ehrlichen Zweck; ist einer freigegeben oder
 * abgelehnt, ist der Platz wieder frei.
 */
export const OFFEN_MAX = 5;

export interface MotivZeile {
  readonly kennung: string;
  readonly titel: string | null;
  readonly pack: string | null;
}

export interface VorschlagZeile extends MotivZeile {
  /** Das Bild selbst — die Aufsicht muss sehen, worueber sie entscheidet. */
  readonly bild: string;
  readonly einreicher: string | null;
  readonly eingereichtAm: string;
}

/** Neue, nicht erratbare Kennung. Kurz genug, um in einem Log lesbar zu sein. */
export function neueKennung(): string {
  return HOCH_VORSATZ + randomBytes(5).toString('hex');
}

/**
 * Kennungen aller freigegebenen Motive.
 *
 * `pack IS NULL` ist der Grundtopf. Der Parameter ist die Stelle, an der
 * spaeter ein eigener Pack dazukommt — heute fragt niemand danach.
 */
export async function freieKennungen(db: Db): Promise<string[]> {
  const zeilen = await db
    .select({ kennung: s.mememoryMotiv.kennung })
    .from(s.mememoryMotiv)
    .where(and(eq(s.mememoryMotiv.status, 'frei'), isNull(s.mememoryMotiv.pack)))
    .orderBy(s.mememoryMotiv.createdAt);
  return zeilen.map((zeile) => zeile.kennung);
}

/** Freigegebene Motive mit Titel — fuer die Katalogansicht der Aufsicht. */
export async function freieMotive(db: Db): Promise<MotivZeile[]> {
  return db
    .select({
      kennung: s.mememoryMotiv.kennung,
      titel: s.mememoryMotiv.titel,
      pack: s.mememoryMotiv.pack,
    })
    .from(s.mememoryMotiv)
    .where(eq(s.mememoryMotiv.status, 'frei'))
    .orderBy(desc(s.mememoryMotiv.createdAt));
}

/** Offene Vorschlaege, neueste zuerst. Nur fuer die Aufsicht. */
export async function offeneVorschlaege(db: Db): Promise<VorschlagZeile[]> {
  const zeilen = await db
    .select({
      kennung: s.mememoryMotiv.kennung,
      titel: s.mememoryMotiv.titel,
      pack: s.mememoryMotiv.pack,
      bild: s.mememoryMotiv.bild,
      einreicher: s.account.displayName,
      eingereichtAm: s.mememoryMotiv.createdAt,
    })
    .from(s.mememoryMotiv)
    .leftJoin(s.account, eq(s.account.id, s.mememoryMotiv.eingereichtVon))
    .where(eq(s.mememoryMotiv.status, 'vorschlag'))
    .orderBy(desc(s.mememoryMotiv.createdAt));

  return zeilen.map((zeile) => ({
    ...zeile,
    eingereichtAm: zeile.eingereichtAm.toISOString(),
  }));
}

/**
 * Wie viele offene Vorschlaege ein Konto gerade hat.
 *
 * Seit dem Stapel-Upload (mehrere Bilder in einem Durchgang) braucht das der
 * Client VOR dem Zuschneiden: Wer acht Bilder waehlt, aber nur noch drei
 * einreichen darf, soll das erfahren, bevor er fuenf davon umsonst
 * zurechtrueckt.
 */
export async function offeneVon(db: Db, accountId: string): Promise<number> {
  const [zeile] = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(s.mememoryMotiv)
    .where(
      and(eq(s.mememoryMotiv.status, 'vorschlag'), eq(s.mememoryMotiv.eingereichtVon, accountId)),
    );
  return zeile?.anzahl ?? 0;
}

/** Wie viele offene Vorschlaege gerade warten. Fuer die Zahl am Briefkasten. */
export async function anzahlOffen(db: Db): Promise<number> {
  const [zeile] = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(s.mememoryMotiv)
    .where(eq(s.mememoryMotiv.status, 'vorschlag'));
  return zeile?.anzahl ?? 0;
}

/**
 * Ein Bild einreichen.
 *
 * `direkt` ist der Weg der Aufsicht: Was sie selbst hochlaedt, ist sofort im
 * Spiel. Sie muesste sich sonst ihre eigenen Bilder freigeben, und jeder
 * Handgriff, der immer gleich ausgeht, wird irgendwem laestig genug, um ihn
 * zu ueberspringen.
 */
export async function einreichen(
  db: Db,
  eingabe: {
    accountId: string;
    bild: string;
    titel?: string | null;
    direkt: boolean;
  },
): Promise<{ kennung: string; status: 'vorschlag' | 'frei'; frei: number | null }> {
  const bild = eingabe.bild;
  if (bild.length > BILD_MAX_ZEICHEN) throw badRequest('bildZuGross');
  // Der Kopf einer data-URL ist nur eine Behauptung. Ohne Blick auf die
  // ersten Bytes liesse sich HTML als "image/png" ablegen und danach von
  // unserer eigenen Herkunft ausliefern - der kurze Weg zu XSS.
  if (!BILD_DATA_URL.test(bild) || !istEchtesBild(bild)) throw badRequest('bildUngueltig');

  let offenNachher: number | null = null;
  if (!eingabe.direkt) {
    const offen = await offeneVon(db, eingabe.accountId);
    if (offen >= OFFEN_MAX) throw conflict('zuVieleVorschlaege');
    offenNachher = offen + 1;
  }

  const kennung = neueKennung();
  const titel = (eingabe.titel ?? '').trim().slice(0, TITEL_MAX);
  const status = eingabe.direkt ? 'frei' : 'vorschlag';

  await db.insert(s.mememoryMotiv).values({
    kennung,
    bild,
    titel: titel.length > 0 ? titel : null,
    status,
    eingereichtVon: eingabe.accountId,
    geprueftVon: eingabe.direkt ? eingabe.accountId : null,
    geprueftAm: eingabe.direkt ? new Date() : null,
  });

  // `frei` ist der Rest, den dieses Konto noch einreichen darf. null heisst
  // unbegrenzt (Aufsicht) — der Client haelt den Stapel danach an, statt in
  // einen Fehler zu laufen, den der Spieler nicht kommen sieht.
  return { kennung, status, frei: offenNachher === null ? null : OFFEN_MAX - offenNachher };
}

/** Einen Vorschlag freigeben. Ab dann kann ihn jede neue Partie ziehen. */
export async function freigeben(db: Db, kennung: string, aufsichtId: string): Promise<void> {
  const ergebnis = await db
    .update(s.mememoryMotiv)
    .set({ status: 'frei', geprueftVon: aufsichtId, geprueftAm: new Date() })
    .where(and(eq(s.mememoryMotiv.kennung, kennung), eq(s.mememoryMotiv.status, 'vorschlag')))
    .returning({ kennung: s.mememoryMotiv.kennung });
  if (ergebnis.length === 0) throw notFound('motivUnbekannt');
}

/**
 * Ein Motiv entfernen — abgelehnter Vorschlag oder freigegebenes Bild.
 *
 * Laufende Partien stoert das nicht: Die gezogenen Kennungen stehen im
 * Snapshot, und der Endpunkt liefert das Bild danach nicht mehr. Sichtbar
 * wird es als leere Karte in genau der einen Partie, die gerade laeuft —
 * das ist der Preis dafuer, ein Bild sofort aus dem Verkehr ziehen zu
 * koennen, und der ist richtig herum gewaehlt.
 */
export async function loeschen(db: Db, kennung: string): Promise<void> {
  const ergebnis = await db
    .delete(s.mememoryMotiv)
    .where(eq(s.mememoryMotiv.kennung, kennung))
    .returning({ kennung: s.mememoryMotiv.kennung });
  if (ergebnis.length === 0) throw notFound('motivUnbekannt');
}

/**
 * Bild eines freigegebenen Motivs als Bytes.
 *
 * Bewusst nur 'frei': Ein Vorschlag ist noch nicht oeffentlich, und die
 * Kennungen sind zufaellig, aber nicht geheim. Die Aufsicht sieht wartende
 * Bilder ueber die Liste, nicht ueber diesen Weg.
 */
export async function bildVon(db: Db, kennung: string): Promise<{ typ: string; bytes: Buffer }> {
  const [zeile] = await db
    .select({ bild: s.mememoryMotiv.bild })
    .from(s.mememoryMotiv)
    .where(and(eq(s.mememoryMotiv.kennung, kennung), eq(s.mememoryMotiv.status, 'frei')));
  const zerlegt = zeile ? bytesAusDataUrl(zeile.bild) : null;
  if (!zerlegt) throw notFound('motivUnbekannt');
  return zerlegt;
}
