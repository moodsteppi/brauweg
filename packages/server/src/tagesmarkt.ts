/** Persönlicher Münz-Shop. Der Berliner Kalendertag und alle Preise kommen vom Server. */
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { conflict, forbidden, notFound } from './errors.js';
import { KATALOG, type Slot } from './kosmetik.js';
import { WAREN } from './tischware.js';
import { entitlementsFor } from './entitlements.js';
import { heute } from './truhen.js';
import { abbuchen, gutschreiben } from './waehrung.js';

export const TAGESMUENZEN = 25;
export interface MarktArtikel { id: string; art: string; wert: string; nameKey: string; seltenheit: string; normalpreis: number; slot?: Slot }
export const MARKT_ARTIKEL: readonly MarktArtikel[] = [
  ...WAREN.filter(w => w.preis.coins > 0 && !w.nurErspielt && ['blatt', 'ruecken', 'szene'].includes(w.art))
    .map(w => ({ id: w.id, art: w.art, wert: w.wert, nameKey: w.nameKey, seltenheit: w.seltenheit, normalpreis: w.preis.coins })),
  ...KATALOG.filter(w => w.herkunft === 'shop' && w.preis.coins > 0)
    .map(w => ({ id: w.id, art: 'pinguin', wert: w.id, nameKey: w.nameKey, seltenheit: w.seltenheit, normalpreis: w.preis.coins, slot: w.slot })),
];
const NACH_ID = new Map(MARKT_ARTIKEL.map(a => [a.id, a]));

/** Echte nächste Berliner Mitternacht, auch an den beiden Zeitumstellungstagen. */
export function marktWechsel(now: Date): string {
  const tag = heute(now);
  let links = now.getTime(), rechts = links + 27 * 60 * 60 * 1000;
  while (rechts - links > 1) {
    const mitte = Math.floor((links + rechts) / 2);
    if (heute(new Date(mitte)) === tag) links = mitte; else rechts = mitte;
  }
  return new Date(rechts).toISOString();
}

/** Kontogebundene Reihenfolge; wiederholtes Öffnen würfelt nicht neu. Persistiert wird die ganze Auswahl. */
export function marktAuswahl(accountId: string, tag: string, eigene: ReadonlySet<string>): s.MarktPlatz[] {
  const gesehen = new Set<string>();
  const rang = (id: string, slot: string) => createHash('sha256').update(`${accountId}:${tag}:${slot}:${id}`).digest('hex');
  const platz = (id: string, spiel: string, stufe: string | null, rabatt: number, passt: (a: MarktArtikel) => boolean): s.MarktPlatz => {
    const artikel = MARKT_ARTIKEL.filter(a => !eigene.has(a.id) && !gesehen.has(a.id) && passt(a))
      .sort((a, b) => rang(a.id, id).localeCompare(rang(b.id, id)))[0];
    if (artikel) gesehen.add(artikel.id);
    return { id, spiel, stufe, rabatt, artikelId: artikel?.id ?? null, normalpreis: artikel?.normalpreis ?? 0,
      preis: artikel ? Math.max(1, Math.floor(artikel.normalpreis * (100 - rabatt) / 100)) : 0, aufgedeckt: stufe === null };
  };
  const auswahl = [
    platz('sonder-gewoehnlich', 'alle', 'gewoehnlich', 15, a => a.normalpreis < 350),
    platz('sonder-selten', 'alle', 'selten', 25, a => a.normalpreis >= 350 && a.normalpreis < 1000),
    platz('sonder-episch', 'alle', 'episch', 35, a => a.normalpreis >= 1000),
  ];
  for (const spiel of ['brochess', 'doppelkopf', 'skat']) for (let i = 1; i <= 3; i++) {
    auswahl.push(platz(`${spiel}-${i}`, spiel, null, 0, a => spiel === 'brochess'
      ? a.wert === 'schach-pinguin' || a.art === 'szene'
      : ['blatt', 'szene', 'ruecken'].includes(a.art) && a.wert !== 'schach-pinguin'));
  }
  auswahl.push(platz('allgemein-1', 'allgemein', null, 0, a => a.art === 'pinguin'));
  return auswahl;
}

async function vorbereiten(db: Db, accountId: string, now: Date) {
  const tag = heute(now);
  const bedingung = and(eq(s.tagesmarkt.accountId, accountId), eq(s.tagesmarkt.tag, tag));
  let [markt] = await db.select().from(s.tagesmarkt).where(bedingung);
  if (!markt) {
    const eigene = await db.select({ id: s.accountCosmetic.itemId }).from(s.accountCosmetic).where(eq(s.accountCosmetic.accountId, accountId));
    const [konto] = await db.select().from(s.account).where(eq(s.account.id, accountId));
    if (!konto) throw notFound('accountUnknown');
    const besitz = entitlementsFor(konto).ownsEverything ? new Set(MARKT_ARTIKEL.map(a => a.id)) : new Set(eigene.map(a => a.id));
    await db.insert(s.tagesmarkt).values({ accountId, tag, angebote: marktAuswahl(accountId, tag, besitz) }).onConflictDoNothing();
    [markt] = await db.select().from(s.tagesmarkt).where(bedingung);
  }
  if (!markt) throw notFound('accountUnknown');
  return markt;
}

export async function tagesmarktFuer(db: Db, accountId: string, now = new Date()) {
  const markt = await vorbereiten(db, accountId, now);
  const eigene = new Set((await db.select({ id: s.accountCosmetic.itemId }).from(s.accountCosmetic).where(eq(s.accountCosmetic.accountId, accountId))).map(a => a.id));
  const [konto] = await db.select().from(s.account).where(eq(s.account.id, accountId));
  const alles = !!konto && entitlementsFor(konto).ownsEverything;
  return { tag: markt.tag, serverZeit: now.toISOString(), wechseltAm: marktWechsel(now), gratisMuenzen: { betrag: TAGESMUENZEN, geholt: markt.muenzenGeholt },
    angebote: markt.angebote.map(p => ({ id: p.id, spiel: p.spiel, stufe: p.stufe, rabatt: p.rabatt,
      aufgedeckt: p.aufgedeckt, leer: !p.artikelId || !NACH_ID.has(p.artikelId), artikel: p.aufgedeckt && p.artikelId ? NACH_ID.get(p.artikelId) ?? null : null,
      preis: p.aufgedeckt ? p.preis : null, normalpreis: p.aufgedeckt ? p.normalpreis : null,
      besessen: p.aufgedeckt && !!p.artikelId && (alles || eigene.has(p.artikelId)) })) };
}

export async function marktAufdecken(db: Db, accountId: string, angebotId: string, tag: string, now = new Date()) {
  if (tag !== heute(now)) throw conflict('marktNeuerTag');
  await vorbereiten(db, accountId, now);
  await db.transaction(async tx => {
    const bedingung = and(eq(s.tagesmarkt.accountId, accountId), eq(s.tagesmarkt.tag, tag));
    const [markt] = await tx.select().from(s.tagesmarkt).where(bedingung).for('update');
    const platz = markt?.angebote.find(a => a.id === angebotId);
    if (!platz) throw notFound('marktAngebotUnbekannt');
    await tx.update(s.tagesmarkt).set({ angebote: markt!.angebote.map(a => a.id === angebotId ? { ...a, aufgedeckt: true } : a) }).where(bedingung);
  });
  return tagesmarktFuer(db, accountId, now);
}

export async function marktKaufen(db: Db, accountId: string, itemId: string, tag?: string, now = new Date()) {
  if (tag !== undefined && tag !== heute(now)) throw conflict('marktNeuerTag');
  if (!NACH_ID.has(itemId)) throw notFound('itemUnknown');
  const markt = await vorbereiten(db, accountId, now);
  const angebot = markt.angebote.find(p => p.artikelId === itemId);
  if (!angebot) throw forbidden('marktNichtImAngebot');
  if (!angebot.aufgedeckt) throw forbidden('marktNochVerdeckt');
  return db.transaction(async tx => {
    const [konto] = await tx.select().from(s.account).where(eq(s.account.id, accountId)).for('update');
    if (!konto) throw notFound('accountUnknown');
    const [eigen] = await tx.select().from(s.accountCosmetic).where(and(eq(s.accountCosmetic.accountId, accountId), eq(s.accountCosmetic.itemId, itemId)));
    if (eigen || entitlementsFor(konto).ownsEverything) throw conflict('itemAlreadyOwned');
    // Die Helfer verwenden nur select/update, keine Verbindungsmethoden. Die Transaktion bleibt atomar.
    const transaktion = tx as unknown as Db;
    const stand = await abbuchen(transaktion, accountId, 'coins', angebot.preis);
    const neu = await tx.insert(s.accountCosmetic).values({ accountId, itemId }).onConflictDoNothing().returning({ id: s.accountCosmetic.itemId });
    if (!neu.length) throw conflict('itemAlreadyOwned');
    return { itemId, bezahlt: angebot.preis, waehrung: 'coins' as const, stand };
  });
}

export async function marktGratis(db: Db, accountId: string, tag: string, now = new Date()) {
  if (tag !== heute(now)) throw conflict('marktNeuerTag');
  await vorbereiten(db, accountId, now);
  return db.transaction(async tx => {
    await tx.select({ id: s.account.id }).from(s.account).where(eq(s.account.id, accountId)).for('update');
    const bedingung = and(eq(s.tagesmarkt.accountId, accountId), eq(s.tagesmarkt.tag, tag));
    const [markt] = await tx.select().from(s.tagesmarkt).where(bedingung).for('update');
    if (!markt || markt.muenzenGeholt) throw conflict('marktGratisSchonGeholt');
    await tx.update(s.tagesmarkt).set({ muenzenGeholt: true }).where(bedingung);
    const stand = await gutschreiben(tx as unknown as Db, accountId, 'coins', TAGESMUENZEN);
    return { coins: TAGESMUENZEN, stand };
  });
}
