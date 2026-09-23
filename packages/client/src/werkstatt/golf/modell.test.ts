/**
 * Prüft das Modell der Bahnwerkstatt.
 *
 * Zwei Zusagen stehen im Vordergrund: Jede der neun Zonenarten, frisch
 * gesetzt, ist ein gültiges Objekt (die Prüfung meldet nichts dazu, der Leser
 * nimmt es an, die Physik rechnet damit ohne NaN) — auch am Rand geklickt. Und
 * eine Bahn, die nur mit den Handgriffen der Werkstatt gebaut wurde, besteht
 * `pruefeKarte` und wird vom Genie-Bot gelöst. Ohne die zweite Zusage wäre die
 * Werkstatt ein Zeichenprogramm.
 */
import { describe, expect, it } from 'vitest';

import { istInZone } from '../../minispiele/golf/karte';
import { KARTEN } from '../../minispiele/golf/karten';
import { botLoestKarte, pruefeKarte } from '../../minispiele/golf/karten-pruefen';
import { neuePartie, schritt, starteLoch } from '../../minispiele/golf/physik';
import { alsBahn } from './austausch';
import {
  type Auswahl,
  type Werkstattbahn,
  ZONENARTEN,
  griffe,
  kennungAus,
  loesche,
  naechsteNummer,
  neueBahn,
  ordneBefunde,
  rasten,
  setze,
  trifft,
  verschiebeNach,
  wechsleForm,
  zieheGriff,
} from './modell';
import { katalogreif, pruefe } from './pruefung';

/** Die Simulation ein Stück laufen lassen und nachsehen, ob alles endlich bleibt. */
function rechnetSauber(bahn: Werkstattbahn): boolean {
  const z = neuePartie({ saat: 7, sitze: 1, botSitze: [0], loecher: 1, botStufe: 'genie', karten: [bahn] });
  starteLoch(z, 0, 0, [bahn]);
  for (let i = 0; i < 400; i += 1) schritt(z, [], [bahn]);
  const b = z.baelle[0];
  return [b.x, b.y, b.vx, b.vy].every(Number.isFinite);
}

describe('neueBahn', () => {
  it('ist von Anfang an gültig und wird gelöst', () => {
    const b = neueBahn({ nummer: 41 });
    expect(pruefeKarte(b)).toEqual([]);
    expect(botLoestKarte(b).geloest).toBe(true);
  });

  it('bildet Kennungen im Stil des Katalogs', () => {
    expect(kennungAus('Über die Brücke!', 41)).toBe('k41-ueber-die-bruecke');
    expect(kennungAus('', 7)).toBe('k07-neue-bahn');
    // Gegen die ersten vierzig, damit der Test nicht mit jeder neuen Katalogbahn umzieht.
    expect(naechsteNummer(KARTEN.slice(0, 40))).toBe(41);
  });
});

describe('Zonen setzen', () => {
  const orte: [string, number, number][] = [
    ['mitten im Feld', 10, 12],
    ['in der linken oberen Ecke', 0, 0],
    ['in der rechten unteren Ecke', 20, 30],
  ];

  for (const art of ZONENARTEN) {
    for (const [wo, x, y] of orte) {
      it(`${art} ${wo} ergibt ein gültiges Objekt`, () => {
        const leer = neueBahn({ breite: 20, hoehe: 30 });
        const { bahn, auswahl } = setze(leer, art, x, y);
        expect(auswahl).toEqual({ art: 'zone', index: 0 });
        expect(bahn.zonen.length).toBe(art === 'portal' ? 2 : 1);
        expect(bahn.zonen.every((z) => z.art === art)).toBe(true);
        // Die Bahn von vorher bleibt unberührt — die Zwischenspeicher hängen am Objekt.
        expect(leer.zonen).toHaveLength(0);
        // Keine Meldung über die Zone selbst (Lage, Ziel).
        const zuZonen = pruefeKarte(bahn).filter((f) => f.startsWith('Zone '));
        expect(zuZonen).toEqual([]);
        // Der Leser der Werkstatt nimmt die Form an.
        expect('bahn' in alsBahn(JSON.parse(JSON.stringify(bahn)))).toBe(true);
        // Und die Physik rechnet damit.
        expect(rechnetSauber(bahn)).toBe(true);
      });
    }
  }

  it('Portale kommen als Paar, jedes zielt in die Mitte des anderen', () => {
    const { bahn } = setze(neueBahn(), 'portal', 8, 14);
    const [a, b] = bahn.zonen;
    if (a.art !== 'portal' || b.art !== 'portal') throw new Error('kein Portal');
    expect(a.ziel).toEqual({ x: b.x, y: b.y });
    expect(b.ziel).toEqual({ x: a.x, y: a.y });
    expect(a.paar).toBe(b.paar);
    // Ein zweites Paar bekommt eine neue Nummer (Farbe).
    const zwei = setze(bahn, 'portal', 4, 20).bahn;
    const drittes = zwei.zonen[2];
    expect(drittes.art === 'portal' && drittes.paar).toBe(a.paar + 1);
  });

  it('verschiebt beim Portal das Ziel des Partners mit', () => {
    const { bahn } = setze(neueBahn(), 'portal', 8, 14);
    const neu = verschiebeNach(bahn, { art: 'zone', index: 0 }, 5, 16);
    const [a, b] = neu.zonen;
    if (a.art !== 'portal' || b.art !== 'portal') throw new Error('kein Portal');
    expect([a.x, a.y]).toEqual([5, 16]);
    expect(b.ziel).toEqual({ x: 5, y: 16 });
  });

  it('schaltet Sand zwischen Rechteck und Kreis um, ohne die Art zu verlieren', () => {
    const { bahn } = setze(neueBahn(), 'sand', 8, 12);
    const kreis = wechsleForm(bahn.zonen[0]);
    expect(kreis).toMatchObject({ art: 'sand', r: 1.5 });
    expect(istInZone(kreis, 8, 12)).toBe(true);
    expect(wechsleForm(kreis)).toMatchObject({ art: 'sand', w: 3, h: 3 });
  });
});

describe('Handgriffe', () => {
  it('rastet ein und rundet ohne Rauschen', () => {
    expect(rasten(3.26, 0.5)).toBe(3.5);
    expect(rasten(3.24, 0.5)).toBe(3);
    expect(rasten(0.1 + 0.2, 0)).toBe(0.3);
    expect(Object.is(rasten(-0.1, 0.5), 0)).toBe(true);
  });

  it('trifft kleine Ziele vor großen und oben vor unten', () => {
    let b = neueBahn({ breite: 20, hoehe: 30 });
    b = setze(b, 'eis', 10, 15).bahn;
    b = setze(b, 'bumper', 10, 15).bahn;
    expect(trifft(b, 10, 15, 0.1)).toEqual({ art: 'zone', index: 1 });
    expect(trifft(b, b.loch[0], b.loch[1], 0.1)).toEqual({ art: 'loch' });
    expect(trifft(b, 1, 1, 0.1)).toBeNull();
  });

  it('zieht Griffe: Ecke, Enden, Radius', () => {
    let b = neueBahn({ breite: 20, hoehe: 30 });
    b = setze(b, 'wand-rechteck', 10, 15).bahn;
    b = setze(b, 'wand-schraeg', 10, 20).bahn;
    b = setze(b, 'strudel', 5, 10).bahn;
    const rechteck: Auswahl = { art: 'wand', index: 0 };
    expect(griffe(b, rechteck).map((g) => g.art)).toEqual(['ecke']);
    b = zieheGriff(b, rechteck, 'ecke', 14, 16);
    expect(b.waende[0]).toEqual({ x: 8, y: 14.7, w: 6, h: 1.3 });
    b = zieheGriff(b, { art: 'wand', index: 1 }, 'b', 18, 18);
    expect(b.waende[1]).toMatchObject({ bx: 18, by: 18 });
    b = zieheGriff(b, { art: 'zone', index: 0 }, 'radius', 7, 10);
    expect(b.zonen[0]).toMatchObject({ r: 2 });
  });

  it('lässt Loch und die letzten zwei Abschläge stehen', () => {
    const b = neueBahn();
    expect(loesche(b, { art: 'loch' })).toBe(b);
    expect(loesche(b, { art: 'abschlag', index: 0 })).toBe(b);
    const drei = setze(b, 'abschlag', 8, 18).bahn;
    expect(loesche(drei, { art: 'abschlag', index: 2 }).abschlaege).toEqual(b.abschlaege);
  });
});

describe('Befunde auf der Bahn', () => {
  it('ordnet die Meldungen von pruefeKarte den Objekten zu', () => {
    const befunde = ordneBefunde([
      'Wand 3 liegt nicht im Feld',
      'Zone 1 (portal) zielt aus dem Feld heraus',
      'Abschlaege 0 und 2 liegen 0.50 E auseinander (noetig 0.9)',
      'Vom Abschlag 1 ist das Loch nicht erreichbar',
      'Loch liegt in einer Zone (sand)',
      'Breite 8 liegt nicht in 12..40',
    ]);
    expect(befunde.map((b) => b.ziele)).toEqual([
      [{ art: 'wand', index: 3 }],
      [{ art: 'zone', index: 1 }],
      [
        { art: 'abschlag', index: 0 },
        { art: 'abschlag', index: 2 },
      ],
      [{ art: 'abschlag', index: 1 }],
      [{ art: 'loch' }],
      [],
    ]);
  });

  it('versteht die echten Meldungen einer kaputten Bahn', () => {
    let b = neueBahn();
    b = { ...b, waende: [{ x: 0, y: 10, w: 16, h: 0.6 }] };
    b = setze(b, 'wasser', b.loch[0], b.loch[1]).bahn;
    const e = pruefe(b, KARTEN, null);
    const ziele = e.befunde.flatMap((f) => f.ziele);
    expect(ziele).toContainEqual({ art: 'loch' });
    expect(katalogreif(b, e)).toBe(false);
  });

  it('zählt die geladene Katalogbahn beim Doppeltest nicht mit', () => {
    const k = KARTEN[3];
    expect(pruefe(k, KARTEN, k.id).befunde).toEqual([]);
    expect(pruefe(k, KARTEN, null).befunde.map((f) => f.text)).toContain(`Kennung ${k.id} kommt 2-mal vor`);
  });
});

describe('Eine Kunstbahn aus der Werkstatt', () => {
  /*
   * Nur mit den Handgriffen der Werkstatt gebaut — so, wie jemand am
   * Bildschirm klickt: neue Bahn, Maße, Wände, Zonen, Loch, ein Abschlag
   * dazu, eine Wand aufgezogen. Keine Zahl ist von Hand ins Objekt getippt.
   */
  function baue(): Werkstattbahn {
    let b = neueBahn({ breite: 18, hoehe: 30, name: 'Die Kunstbahn', nummer: 41 });
    b = { ...b, schwierigkeit: 2, par: 3, schlagLimit: 7, zeitLimitS: 75 };
    // Eine Schikane: zwei Riegel von links und rechts, versetzt.
    let r = setze(b, 'wand-rechteck', 5, 20);
    b = zieheGriff(r.bahn, r.auswahl, 'ecke', 10, 20.6);
    b = verschiebeNach(b, r.auswahl, 0, 20);
    r = setze(b, 'wand-rechteck', 12, 11);
    b = zieheGriff(r.bahn, r.auswahl, 'ecke', 14, 11.6);
    b = verschiebeNach(b, r.auswahl, 8, 11);
    b = zieheGriff(b, r.auswahl, 'ecke', 18, 11.6);
    // Eine schräge Bande in der Ecke oben links.
    b = setze(b, 'wand-schraeg', 2, 4).bahn;
    // Zonen: Sand neben der Ideallinie, ein Bumper, ein Beschleuniger nach oben.
    b = setze(b, 'sand', 15, 24).bahn;
    b = setze(b, 'bumper', 4, 15).bahn;
    b = setze(b, 'beschleuniger', 13, 16).bahn;
    // Loch und ein dritter Abschlag.
    b = setze(b, 'loch', 12, 4).bahn;
    b = setze(b, 'abschlag', 12, 27).bahn;
    return b;
  }

  it('besteht pruefeKarte', () => {
    const b = baue();
    expect(pruefeKarte(b, [...KARTEN, b])).toEqual([]);
  });

  it('wird vom Genie-Bot innerhalb von Schlaglimit und par + 2 gelöst', () => {
    const b = baue();
    const e = pruefe(b, KARTEN, null);
    expect(e.bot?.geloest).toBe(true);
    expect(katalogreif(b, e)).toBe(true);
  });

  it('lässt sich ausgeben und unverändert wieder laden', () => {
    const b = baue();
    const r = alsBahn(JSON.parse(JSON.stringify(b)));
    expect('bahn' in r && r.bahn).toEqual(b);
  });
});
