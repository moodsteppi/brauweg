/**
 * Der Shop im Spiel: kauft nur mit Flugmeilen. **Kein Artikel gibt Sterne,
 * Punkte oder ein übersprungenes Level** — und wer ein Hilfsmittel einsetzt,
 * spielt den Versuch mit höchstens zwei Sternen (`sterneFuer`).
 *
 * Preise stehen hier im Katalog, nie in der Datenbank (wie `kosmetik.ts` und
 * `tischware.ts` auf dem Server). Die Rechnung hinter den Zahlen steht in der
 * Spezifikation, Abschnitt „Shop im Spiel": Die ganze Zierde kostet genau das
 * Dreifache dessen, was ein Durchlauf einbringt — wer Preise oder Einnahmen
 * ändert, rechnet sie nach (der Test `zierde kostet das Dreifache` fällt sonst).
 */

export const HILFSMITTEL = ['fernrohr', 'bauplan', 'ersatz-pelle'] as const;
export type Hilfsmittel = (typeof HILFSMITTEL)[number];

export type ZierdeGruppe = 'schleuderband' | 'flugspur' | 'siegerpose' | 'kistenmotiv';

export interface HilfsmittelArtikel {
  art: 'hilfsmittel';
  id: Hilfsmittel;
  name: string;
  wirkung: string;
  preis: number;
}

export interface ZierdeArtikel {
  art: 'zierde';
  id: string;
  gruppe: ZierdeGruppe;
  name: string;
  preis: number;
}

export type Artikel = HilfsmittelArtikel | ZierdeArtikel;

export const HILFSMITTEL_KATALOG: readonly HilfsmittelArtikel[] = [
  { art: 'hilfsmittel', id: 'fernrohr', name: 'Fernrohr', wirkung: 'Flugbahnvorschau 1,5 s statt 0,6 s, für ein Level', preis: 40 },
  { art: 'hilfsmittel', id: 'bauplan', name: 'Bauplan', wirkung: 'zeigt für ein Level die drei tragenden Teile', preis: 60 },
  { art: 'hilfsmittel', id: 'ersatz-pelle', name: 'Ersatz-Pelle', wirkung: 'ein zusätzlicher Pelle am Ende der Reihe', preis: 80 },
];

function zierde(gruppe: ZierdeGruppe, preis: number, stuecke: [string, string][]): ZierdeArtikel[] {
  return stuecke.map(([kennung, name]) => ({ art: 'zierde', id: `${gruppe}-${kennung}`, gruppe, name, preis }));
}

/** Dauerhaft, ändert nichts am Spiel. Die Kennungen sind Besitz — einmal vergeben, nie umbenennen. */
export const ZIERDE_KATALOG: readonly ZierdeArtikel[] = [
  ...zierde('schleuderband', 400, [
    ['rot', 'Schleuderband Rot'],
    ['orange', 'Schleuderband Orange'],
    ['gelb', 'Schleuderband Gelb'],
    ['gruen', 'Schleuderband Grün'],
    ['blau', 'Schleuderband Blau'],
    ['lila', 'Schleuderband Lila'],
  ]),
  ...zierde('flugspur', 800, [
    ['funken', 'Flugspur Funken'],
    ['seifenblasen', 'Flugspur Seifenblasen'],
    ['schneeflocken', 'Flugspur Schneeflocken'],
  ]),
  ...zierde('siegerpose', 1200, [
    ['tanz', 'Siegerpose Tanz'],
    ['flossenklatschen', 'Siegerpose Flossenklatschen'],
  ]),
  // Die Motive der Kartenrücken sind noch nicht gewählt; die Kennungen sind
  // neutral, damit ein späterer Name keinen Besitz umbenennen muss.
  ...zierde('kistenmotiv', 1200, [
    ['eins', 'Kistenmotiv I'],
    ['zwei', 'Kistenmotiv II'],
    ['drei', 'Kistenmotiv III'],
  ]),
];

export const KATALOG: readonly Artikel[] = [...HILFSMITTEL_KATALOG, ...ZIERDE_KATALOG];

/** Geschenk zum Start. */
export const STARTVORRAT: Readonly<Record<Hilfsmittel, number>> = { fernrohr: 2, bauplan: 0, 'ersatz-pelle': 1 };

export function artikel(id: string): Artikel | undefined {
  return KATALOG.find((a) => a.id === id);
}

export function istHilfsmittel(id: unknown): id is Hilfsmittel {
  return (HILFSMITTEL as readonly unknown[]).includes(id);
}

/** Was der Shop über ein Konto wissen muss. Server und Client halten es gleich. */
export interface ShopStand {
  meilen: number;
  vorrat: Record<Hilfsmittel, number>;
  /** Kennungen gekaufter Zierde. */
  zierde: string[];
}

export function neuerShopStand(): ShopStand {
  return { meilen: 0, vorrat: { ...STARTVORRAT }, zierde: [] };
}

export type KaufAbgelehnt = 'unbekannt' | 'zu_teuer' | 'schon_gekauft';

/**
 * Ein Kauf als reine Funktion: neuer Stand oder der Grund, warum nicht.
 * Hilfsmittel stapeln sich im Vorrat; Zierde gibt es je Stück einmal.
 */
export function kaufe(stand: ShopStand, id: string): { ok: true; stand: ShopStand } | { ok: false; grund: KaufAbgelehnt } {
  const a = artikel(id);
  if (!a) return { ok: false, grund: 'unbekannt' };
  if (a.art === 'zierde' && stand.zierde.includes(a.id)) return { ok: false, grund: 'schon_gekauft' };
  if (stand.meilen < a.preis) return { ok: false, grund: 'zu_teuer' };
  const meilen = stand.meilen - a.preis;
  if (a.art === 'hilfsmittel') {
    return { ok: true, stand: { ...stand, meilen, vorrat: { ...stand.vorrat, [a.id]: stand.vorrat[a.id] + 1 } } };
  }
  return { ok: true, stand: { ...stand, meilen, zierde: [...stand.zierde, a.id] } };
}

export type EinsatzAbgelehnt = 'unbekannt' | 'doppelt' | 'nicht_im_vorrat';

/**
 * Hilfsmittel für einen Versuch einsetzen: je Level höchstens eins von jeder
 * Sorte, und nur, was im Vorrat liegt. Verbraucht beim Einsatz.
 */
export function setzeEin(
  vorrat: Record<Hilfsmittel, number>,
  ids: readonly string[],
): { ok: true; vorrat: Record<Hilfsmittel, number> } | { ok: false; grund: EinsatzAbgelehnt } {
  if (!ids.every(istHilfsmittel)) return { ok: false, grund: 'unbekannt' };
  if (new Set(ids).size !== ids.length) return { ok: false, grund: 'doppelt' };
  const neu = { ...vorrat };
  for (const id of ids) {
    if (neu[id] <= 0) return { ok: false, grund: 'nicht_im_vorrat' };
    neu[id] -= 1;
  }
  return { ok: true, vorrat: neu };
}
