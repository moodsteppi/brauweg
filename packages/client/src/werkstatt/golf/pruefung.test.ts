/**
 * Prüft die Warnung vor dem Geometriebruch (seit 22.09.2026, nach #206).
 *
 * Laufende Partien tragen ihre Bahnfolge als Kennungen, und jedes Gerät löst
 * sie gegen den eigenen Katalog auf. Eine umgebaute Bahn mit alter Kennung ist
 * spielbar — `pruefeKarte` und der Bot sind zufrieden —, rollt aber auf einem
 * alten und einem neuen Stand verschieden. Genau das darf die Werkstatt nicht
 * als „katalogreif" durchwinken.
 */
import { describe, expect, it } from 'vitest';

import { KARTEN } from '../../minispiele/golf/karten';
import { kennungAus, naechsteNummer, verschiebeNach } from './modell';
import { bruchZeile, geometrieBruch, katalogreif, pruefe } from './pruefung';

const k = KARTEN.find((x) => x.id === 'k37-portalkarussell') ?? KARTEN[0];

describe('geometrieBruch', () => {
  it('schweigt bei einer unveränderten Katalogbahn, auch in anderer Schlüsselfolge', () => {
    expect(geometrieBruch(structuredClone(k), KARTEN)).toBeNull();
    const umgeordnet = { ...k, zonen: k.zonen.map((z) => Object.fromEntries(Object.entries(z).reverse())) } as typeof k;
    expect(geometrieBruch(umgeordnet, KARTEN)).toBeNull();
  });

  it('schweigt, wenn sich nur Bild und Angaben ändern', () => {
    const b = { ...k, name: 'Anders', par: k.par + 1, dekor: 'eis' as const, beschreibung: 'neu', tags: ['x'] };
    expect(geometrieBruch(b, KARTEN)).toBeNull();
    // Weitere Abschläge sind Doku — alle Bälle starten auf Abschlag 0.
    const mehr = { ...k, abschlaege: [...k.abschlaege, [5, 30] as [number, number]] };
    expect(geometrieBruch(mehr, KARTEN)).toBeNull();
  });

  it('meldet eine verschobene Wand, ein anderes Loch, einen anderen Abschlag 0', () => {
    const b = verschiebeNach(structuredClone(k), { art: 'wand', index: 0 }, 7, 24);
    expect(geometrieBruch(b, KARTEN)).toEqual({ id: k.id, felder: ['waende'] });
    const c = { ...k, loch: [k.loch[0] + 1, k.loch[1]] as [number, number], zeitLimitS: k.zeitLimitS + 5 };
    expect(geometrieBruch(c, KARTEN)?.felder).toEqual(['zeitLimitS', 'loch']);
    const d = { ...k, abschlaege: [[10, 37] as [number, number], ...k.abschlaege.slice(1)] };
    expect(geometrieBruch(d, KARTEN)?.felder).toEqual(['Abschlag 0']);
    expect(bruchZeile({ id: k.id, felder: ['waende'] })).toMatch(/bricht laufende Partien/);
  });

  it('macht eine sonst einwandfreie Bahn nicht katalogreif — bis sie eine neue Kennung hat', () => {
    const b = verschiebeNach(structuredClone(k), { art: 'zone', index: 5 }, 7, 7);
    const e = pruefe(b, KARTEN, k.id);
    expect(e.bruch).not.toBeNull();
    expect(katalogreif(b, e)).toBe(false);

    const neu = { ...b, id: kennungAus(b.name, naechsteNummer(KARTEN)) };
    const f = pruefe(neu, KARTEN, null);
    expect(f.bruch).toBeNull();
    expect(f.befunde).toEqual([]);
  });

  it('erinnert an BAHNEN_KATALOG, wenn sich die Schwierigkeit ändert', () => {
    const b = { ...k, schwierigkeit: (k.schwierigkeit === 5 ? 4 : 5) as 4 | 5 };
    expect(pruefe(b, KARTEN, k.id).hinweise.some((h) => h.includes('BAHNEN_KATALOG'))).toBe(true);
  });
});
