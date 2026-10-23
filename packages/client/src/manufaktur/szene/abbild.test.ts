import { describe, expect, it } from 'vitest';

import {
  type ManufakturStand,
  handle,
  neuerStand,
  paternosterFahrt,
  presseZyklus,
  versandZyklus,
  vorspulen,
} from '@brauweg/manufaktur-kern';

import { arbeiterOrt, kistenStapel, paternosterOrt, pressenPhase, traegtStapel, wagenOrt } from './abbild';

/*
 * „Die Bilder lügen nie": Was die Szene zeigt, folgt aus dem Stand — der
 * Stapel wird abgelegt, wenn der Warenwert in der Kiste landet, der Wagen
 * fährt erst beladen los.
 */

const T0 = Date.parse('2026-10-23T10:00:00Z');
const presse = { art: 'presse' as const, index: 0 };

describe('Abbild der Manufaktur', () => {
  it('der Pinguin trägt den Stapel zur Kiste, und genau dann liegt er drin', () => {
    let stand = handle(neuerStand(T0), { typ: 'arbeiten', ziel: presse }, T0).stand;
    const z = presseZyklus(1);
    const kurzVorEnde = vorspulen(stand, T0 + z - 100);
    const p = pressenPhase(kurzVorEnde.pressen[0]!, kurzVorEnde.zeit, 0);
    expect(['zurueck', 'ablegen']).toContain(p.phase);
    expect(traegtStapel(p.phase)).toBe(true);
    expect(kurzVorEnde.pressen[0]!.kiste).toBe(0);

    stand = vorspulen(stand, T0 + z + 100);
    expect(stand.pressen[0]!.kiste).toBeGreaterThan(0);
    const danach = pressenPhase(stand.pressen[0]!, stand.zeit, 0);
    expect(danach.phase).toBe('schlafen');
    expect(arbeiterOrt(danach.phase, danach.anteil)).toBe(0);
    expect(kistenStapel(stand.pressen[0]!, 0, 1)).toEqual({ anzahl: 1, quillt: false });
  });

  it('mitten im Zyklus steht er an der Presse und arbeitet', () => {
    const stand = vorspulen(handle(neuerStand(T0), { typ: 'arbeiten', ziel: presse }, T0).stand, T0 + presseZyklus(1) * 0.45);
    const p = pressenPhase(stand.pressen[0]!, stand.zeit, 0);
    expect(p.phase).toBe('arbeiten');
    expect(arbeiterOrt(p.phase, p.anteil)).toBe(1);
  });

  it('eine volle Kiste quillt über', () => {
    const stand = neuerStand(T0);
    const p = { ...stand.pressen[0]!, kiste: 1e6 };
    expect(kistenStapel(p, 0, 1)).toEqual({ anzahl: 6, quillt: true });
  });

  it('der Paternoster fährt hinunter, hält an der Etage und kommt wieder hoch', () => {
    let stand: ManufakturStand = { ...neuerStand(T0), pressen: [{ ...neuerStand(T0).pressen[0]!, kiste: 5 }] };
    stand = handle(stand, { typ: 'arbeiten', ziel: { art: 'paternoster' } }, T0).stand;
    expect(paternosterOrt(stand, T0, 0).etage).toBe(0);
    const fahrt = paternosterFahrt(1, 1);
    const unten = vorspulen(stand, T0 + fahrt * 0.45);
    expect(paternosterOrt(unten, unten.zeit, 0)).toMatchObject({ etage: 1, faehrt: false });
    const hoch = vorspulen(stand, T0 + fahrt * 0.7);
    const ort = paternosterOrt(hoch, hoch.zeit, 0);
    expect(ort.abwaerts).toBe(false);
    expect(ort.etage).toBeLessThan(1);
    expect(hoch.paternoster.ladung).toBe(5);
  });

  it('der Wagen fährt erst beladen los und verkauft draußen', () => {
    let stand: ManufakturStand = { ...neuerStand(T0), packtisch: 20 };
    stand = handle(stand, { typ: 'arbeiten', ziel: { art: 'versand' } }, T0).stand;
    expect(wagenOrt(stand, T0, 0).phase).toBe('laden');
    const z = versandZyklus(1);
    const unterwegs = vorspulen(stand, T0 + z * 0.4);
    expect(wagenOrt(unterwegs, unterwegs.zeit, 0).phase).toBe('weg');
    expect(unterwegs.taler).toBe(0);
    const zurueck = vorspulen(stand, T0 + z * 0.8);
    expect(wagenOrt(zurueck, zurueck.zeit, 0).phase).toBe('zurueck');
    expect(zurueck.taler).toBe(10);
    // Ohne Ware steht er.
    expect(wagenOrt(neuerStand(T0), T0, 0)).toEqual({ phase: 'steht', weg: 0, anteil: 0 });
  });
});

describe('Zustandsautomat der Arbeiter', () => {
  it('jede Phase hat ihren Ablauf, und ein Schlag wird genau einmal erkannt', async () => {
    const { arbeiterAblauf, schlagZwischen } = await import('./abbild');
    expect(arbeiterAblauf('schlafen')).toBe('schlafen');
    expect(arbeiterAblauf('zurueck')).toBe('laufen_tragen');
    expect(schlagZwischen(0.1, 0.25)).toBe(true);
    expect(schlagZwischen(0.25, 0.3)).toBe(false);
    expect(schlagZwischen(0.9, 0.1)).toBe(false);
  });

  it('ein Upgrade macht die Abläufe schneller', async () => {
    const { ablaufTempo } = await import('./abbild');
    const p = neuerStand(T0).pressen[0]!;
    expect(ablaufTempo({ ...p, stufe: 40 }, T0)).toBeGreaterThan(ablaufTempo(p, T0));
  });
});
