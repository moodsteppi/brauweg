// @vitest-environment node
import { afterEach, beforeAll, expect, it } from 'vitest';
import type { RigidBody, World } from '@dimforge/rapier2d-compat';
import { FAHIGKEITEN, FORMEN, type BauItem, type BauZauber } from '@brauweg/building-kern';
import { BauPartie, ladeBauphysik } from './partie';
import { bauPrivat } from './privateSicht';
let r: Awaited<ReturnType<typeof ladeBauphysik>>;
const offen: BauPartie[] = [];
beforeAll(async () => { r = await ladeBauphysik(); });
afterEach(() => { offen.splice(0).forEach(p => p.freigeben()); });
const schritte = (p: BauPartie, n: number): void => { for (let i = 0; i < n; i++) p.schritt(); };
function partie(anzahl = 2, seed = 217): BauPartie {
  const p = new BauPartie(r, Array.from({ length: anzahl }, (_, i) => ({ id: String(i), name: `Spieler ${i}`, farbe: '#79e3c9' })), 'rennen', seed);
  offen.push(p); schritte(p, 181); return p;
}
type TestBahn = { item?: BauItem; itemNummer: number; itemIn: number; hoehe: number; welt: World; steine: { koerper: RigidBody; gelandet: boolean; stein: boolean }[]; platzierung?: { x: number; y: number; maxY: number } };
const bahn = (p: BauPartie, i = 0): TestBahn => (p as unknown as { bahnen: TestBahn[] }).bahnen[i];
/** Kontrollierter Fund nur für Physik-Szenarien, die zufällige Zuteilung wird separat gespielt. */
function fund(p: BauPartie, art: BauZauber, i = 0): BauItem { const b = bahn(p, i); return b.item = { art, nummer: ++b.itemNummer }; }
function nutzen(p: BauPartie, i = 0, ziel?: string): void {
  const item = p.sicht().bahnen[i].item!;
  p.eingabe(String(i), { art: 'zauber', zauber: item.art, item: item.nummer, ziel });
}
function fallen(p: BauPartie, id = '0'): void {
  p.eingabe(id, { art: 'steuerung', x: 0, y: 0, tasten: ['fallen'] }); p.eingabe(id, { art: 'steuerung', x: 0, y: 0, tasten: [] });
}

it('liefert reproduzierbare Zufallsitems, überschreibt belegte Plätze nicht und lässt weiterbauen', () => {
  const p = partie(), q = partie();
  expect(p.sicht().bahnen.every(b => !b.item)).toBe(true);
  schritte(p, 740); schritte(q, 740);
  expect(p.sicht().bahnen.map(b => b.item)).toEqual(q.sicht().bahnen.map(b => b.item));
  expect(p.sicht().bahnen.every(b => b.item?.nummer === 1)).toBe(true);
  const vorher = p.sicht().bahnen[0];
  for (let i = 0; i < 1200; i++) { if (i % 90 === 0) fallen(p); p.schritt(); }
  expect(p.sicht().bahnen[0].item).toEqual(vorher.item);
  expect(p.sicht().bahnen[0].gebaut).toBeGreaterThan(vorher.gebaut);
});

it('Solo verteilt ausschließlich nützliche Items, Kennungen und Abklingzeit verhindern mehrfachen Verbrauch', () => {
  for (const seed of [1, 19, 777]) {
    const p = partie(1, seed); schritte(p, 740);
    const erstes = p.sicht().bahnen[0].item!; expect(FAHIGKEITEN[erstes.art].angriff).toBe(false);
  }
  const p = partie(); const item = fund(p, 'anker');
  p.eingabe('0', { art: 'zauber', zauber: 'stein', item: item.nummer });
  expect(p.sicht().bahnen[0].item).toEqual(item);
  nutzen(p); expect(p.sicht().bahnen[0].item).toBeUndefined();
  const zeit = p.sicht().bahnen[0].itemIn; expect(zeit).toBeGreaterThanOrEqual(18);
  schritte(p, 30); const rest = p.sicht().bahnen[0].anker;
  p.eingabe('0', { art: 'zauber', zauber: 'anker', item: item.nummer }); expect(p.sicht().bahnen[0].anker).toBe(rest);
  const neu = fund(p, 'anker');
  p.eingabe('0', { art: 'zauber', zauber: 'anker', item: item.nummer }); expect(p.sicht().bahnen[0].item).toEqual(neu);
  nutzen(p); schritte(p, 29 * 60);
  expect(p.sicht().bahnen[0].item?.nummer).toBe(neu.nummer + 1);
});

it.each(['schwere', 'eis'] as const)('%s trifft nur das gewählte nächste Bauteil und verwirft ungültige Ziele nicht', art => {
  const p = partie(3); const item = fund(p, art);
  nutzen(p, 0, '0'); expect(p.sicht().bahnen[0].item).toEqual(item);
  nutzen(p, 0, 'fremd'); expect(p.sicht().bahnen[0].item).toEqual(item);
  nutzen(p, 0, '1'); expect(p.sicht().bahnen[0].item).toBeUndefined();
  for (let i = 0; i < 200; i++) { if (i % 60 === 0) fallen(p, '1'); p.schritt(); }
  const eigenschaft = art === 'eis' ? 'eis' : 'schwer';
  expect(p.sicht().bahnen[1].steine.some(s => s[eigenschaft])).toBe(true);
  expect(p.sicht().bahnen[2].steine.some(s => s[eigenschaft])).toBe(false);
  const s = bahn(p, 1).steine.find((_, i) => p.sicht().bahnen[1].steine[i][eigenschaft])!;
  if (art === 'eis') expect(s.koerper.collider(0).friction()).toBeLessThan(.02);
  else expect(s.koerper.collider(0).density()).toBe(3);
});

it('Steinsiegel verändert erst das nächste Teil und macht es bei Kontakt unbeweglich', () => {
  const p = partie(1); fund(p, 'stein'); nutzen(p);
  expect(p.sicht().bahnen[0].steine[0].stein).toBe(false);
  for (let i = 0; i < 500; i++) { if (i % 70 === 0) fallen(p); p.schritt(); }
  const stein = bahn(p).steine.find(s => s.stein)!;
  expect(stein.gelandet).toBe(true); expect(stein.koerper.isFixed()).toBe(true);
  expect(p.sicht().bahnen[0].steinWartet).toBe(false);
});

it('Steg wartet auf freie Platzierung, verbraucht genau ein Item und zählt nicht selbst als Turmhöhe', () => {
  const p = partie(1); const item = fund(p, 'plattform'); nutzen(p);
  const y = p.sicht().bahnen[0].steine[0].y;
  p.eingabe('0', { art: 'steuerung', x: 1, y: -1, tasten: ['fallen', 'drehen'] }); schritte(p, 30);
  expect(p.sicht().bahnen[0].steine[0].y).toBeCloseTo(y);
  expect(p.sicht().bahnen[0].steine[0].winkel).toBe(0);
  expect(p.sicht().bahnen[0].platzierung!.x).toBeGreaterThan(1);
  expect(p.sicht().bahnen[0].platzierung!.y).toBe(.4);
  p.eingabe('0', { art: 'plattform', item: item.nummer + 1, schritt: 'platzieren' });
  expect(p.sicht().bahnen[0].plattformen).toHaveLength(0);
  p.eingabe('0', { art: 'plattform', item: item.nummer, schritt: 'platzieren' });
  expect(p.sicht().bahnen[0].plattformen).toHaveLength(1);
  expect(p.sicht().bahnen[0].item).toBeUndefined(); expect(p.sicht().bahnen[0].platzierung).toBeUndefined();
  p.eingabe('0', { art: 'plattform', item: item.nummer, schritt: 'platzieren' });
  expect(p.sicht().bahnen[0].plattformen).toHaveLength(1);
  schritte(p, 1); expect(p.sicht().bahnen[0].hoehe).toBe(0);
  expect(p.sicht().bahnen[0].steine[0].y).toBeLessThan(y);
});

it('Steg kann keine Körper schneiden und weder Feld- noch Höhenbegrenzung umgehen', () => {
  const p = partie(); fund(p, 'plattform'); nutzen(p);
  // Ein bestehender Körper blockiert die Stelle, auch wenn die Vorschau noch alt ist.
  bahn(p).steine[0].koerper.setTranslation({ x: 0, y: .4 }, true); schritte(p, 1);
  const item = p.sicht().bahnen[0].item!;
  p.eingabe('0', { art: 'plattform', item: item.nummer, schritt: 'platzieren' });
  expect(p.sicht().bahnen[0].plattformen).toHaveLength(0); expect(p.sicht().bahnen[0].item).toEqual(item);
  for (let i = 0; i < 200; i++) { if (i % 10 === 0) p.eingabe('0', { art: 'steuerung', x: 1, y: -1, tasten: [] }); p.schritt(); }
  expect(p.sicht().bahnen[0].platzierung!.x).toBeLessThanOrEqual(6);
  expect(p.sicht().bahnen[0].platzierung!.y).toBe(.4);
});

it('Zurück und Ablauf behalten das Plattformitem, Reset bewegt den Steg nicht weiter', () => {
  const p = partie(); const item = fund(p, 'plattform'); nutzen(p);
  p.eingabe('0', { art: 'steuerung', x: 1, y: 0, tasten: [] }); schritte(p, 5);
  p.neutralisieren(); const x = p.sicht().bahnen[0].platzierung!.x; schritte(p, 10);
  expect(p.sicht().bahnen[0].platzierung!.x).toBe(x);
  p.eingabe('0', { art: 'plattform', item: item.nummer, schritt: 'zurueck' }); expect(p.sicht().bahnen[0].item).toEqual(item);
  nutzen(p); schritte(p, 481);
  expect(p.sicht().bahnen[0].platzierung).toBeUndefined(); expect(p.sicht().bahnen[0].item).toEqual(item);
});

it('ein echter Baustein landet auf dem Steg; Vorschau und Solo-/Handystatus stimmen überein', () => {
  const p = partie(1); const item = fund(p, 'plattform'); nutzen(p);
  p.eingabe('0', { art: 'plattform', item: item.nummer, schritt: 'platzieren' });
  fallen(p); schritte(p, 65);
  expect(p.sicht().bahnen[0].gebaut).toBe(1);
  expect(bahn(p).steine[0].koerper.translation().y).toBeGreaterThan(.6);
  const s = p.sicht(), b = s.bahnen[0], privat = bauPrivat(s, b);
  expect(FORMEN[privat.form]).toBe(b.naechster); expect(privat.itemIn).toBe(b.itemIn);
  expect(privat.item).toEqual(b.item);
});
