// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BauPartie, ladeBauphysik } from './partie';
import type { RigidBody } from '@dimforge/rapier2d-compat';
import { spawnHoehe } from '@brauweg/building-kern';
import { BroRaum, type ServerNachricht } from '@brauweg/broremote-kern';

let r: Awaited<ReturnType<typeof ladeBauphysik>>;
const offen: BauPartie[] = [];
beforeAll(async () => { r = await ladeBauphysik(); });
afterEach(() => { offen.splice(0).forEach(p => p.freigeben()); });
function partie(modus: 'rennen' | 'standfest' = 'rennen', anzahl = 1): BauPartie {
  const p = new BauPartie(r, Array.from({ length: anzahl }, (_, i) => ({ id: String(i), name: `Spieler ${i}`, farbe: '#79e3c9' })), modus, 217);
  offen.push(p); return p;
}
function schritte(p: BauPartie, n: number): void { for (let i = 0; i < n; i++) p.schritt(); }
function start(p: BauPartie): void { schritte(p, 181); }
function taste(p: BauPartie, id: string, t: string): void {
  p.eingabe(id, { art: 'steuerung', x: 0, y: 0, tasten: [t] });
  p.eingabe(id, { art: 'steuerung', x: 0, y: 0, tasten: [] });
}

describe('Bro Building Battle mit echter Physik', () => {
  it('startet erst nach Countdown und hält die Bauteilfolge für alle gleich', () => {
    const p = partie('rennen', 4);
    expect(p.sicht().phase).toBe('countdown'); schritte(p, 170);
    expect(p.sicht().bahnen.every(b => b.steine.length === 0)).toBe(true);
    schritte(p, 11);
    expect(p.sicht().phase).toBe('spiel');
    expect(new Set(p.sicht().bahnen.map(b => b.steine[0].form)).size).toBe(1);
  });
  it('behält kurze Tastenflanken, dreht einmal und beschleunigt nur das aktuelle Teil', () => {
    const p = partie(); start(p);
    taste(p, '0', 'drehen'); schritte(p, 1);
    expect(p.sicht().bahnen[0].steine[0].winkel).toBeCloseTo(-Math.PI / 2, 3);
    const y = p.sicht().bahnen[0].steine[0].y;
    taste(p, '0', 'fallen'); schritte(p, 10);
    expect(y - p.sicht().bahnen[0].steine[0].y).toBeGreaterThan(2);
    schritte(p, 80);
    const b = p.sicht().bahnen[0];
    expect(b.gebaut).toBeGreaterThanOrEqual(1);
    expect(b.steine.some(s => s.aktiv)).toBe(true);
  });
  it('ignoriert unbekannte Spieler und setzt hängende Eingaben nach 600 ms zurück', () => {
    const p = partie(); start(p);
    p.eingabe('fremd', { art: 'steuerung', x: 1, y: 0, tasten: [] });
    schritte(p, 5); expect(p.sicht().bahnen[0].steine[0].x).toBe(0);
    p.eingabe('0', { art: 'steuerung', x: 1, y: 0, tasten: [] });
    schritte(p, 38); const x = p.sicht().bahnen[0].steine[0].x;
    schritte(p, 10); expect(p.sicht().bahnen[0].steine[0].x).toBeCloseTo(x, 2);
  });
  it('jeder abgestürzte Körper kostet genau ein Leben, bei drei endet Solo', () => {
    const p = partie('standfest'); start(p);
    for (let i = 0; i < 6000 && p.sicht().phase !== 'ende'; i++) {
      if (i % 10 === 0) p.eingabe('0', { art: 'steuerung', x: 1, y: 0, tasten: [] });
      p.schritt();
    }
    const s = p.sicht(); expect(s.phase).toBe('ende');
    expect(s.bahnen[0].leben).toBe(0); expect(s.bahnen[0].verloren).toBe(3); expect(s.gewinner).toEqual([]);
  });
  it('vier gleich gesteuerte Türme verhalten sich gleich und eine ganze Runde bleibt begrenzt', () => {
    const p = partie('rennen', 4); start(p);
    for (let i = 0; i < 10_900 && p.sicht().phase !== 'ende'; i++) {
      if (i % 90 === 0) for (let j = 0; j < 4; j++) taste(p, String(j), 'fallen');
      p.schritt();
    }
    const s = p.sicht(); expect(s.phase).toBe('ende');
    expect(s.bahnen.every(b => b.verbraucht <= 30 && b.steine.length <= 30 && Number.isFinite(b.hoehe))).toBe(true);
    expect(new Set(s.bahnen.map(b => b.hoehe)).size).toBe(1);
    expect(new Set(s.bahnen.map(b => b.platz)).size).toBe(1);
  });
  it('gestapelte Bauteile bleiben echte Körper und können kippen', () => {
    const p = partie(); start(p); let gekippt = false;
    for (let i = 0; i < 1800; i++) {
      if (i % 90 === 0) taste(p, '0', 'fallen'); p.schritt();
      if (i % 30 === 0) gekippt ||= p.sicht().bahnen[0].steine.some(s => !s.aktiv && Math.abs(s.winkel) > .03);
    }
    expect(gekippt).toBe(true);
  });
  it('gleichzeitig abgestürzte Türme bekommen keinen erfundenen Sieg', () => {
    const p = partie('standfest', 2); start(p);
    for (let i = 0; i < 6000 && p.sicht().phase !== 'ende'; i++) {
      if (i % 10 === 0) for (const id of ['0', '1']) p.eingabe(id, { art: 'steuerung', x: 1, y: 0, tasten: [] });
      p.schritt();
    }
    expect(p.sicht().bahnen.every(b => b.leben === 0)).toBe(true);
    expect(p.sicht().gewinner).toEqual([]); expect(p.sicht().grund).toBe('Keine Leben mehr.');
  });
  it('Aufgeben entscheidet das Duell und eine neue Partie beginnt ohne Restzustand', () => {
    const p = partie('standfest', 2); start(p); p.aufgeben('0'); p.schritt();
    expect(p.sicht().gewinner).toEqual(['1']);
    p.freigeben(); p.freigeben();
    const neu = partie('standfest', 2); expect(neu.sicht().bahnen.every(b => b.leben === 3 && b.verbraucht === 0)).toBe(true);
  });
  it('Raum → Spiel: ein Handy bewegt nur seinen Turm, Reset stoppt die Bewegung', () => {
    let zaehler = 0, jetzt = 0, spiel: BauPartie | undefined;
    const post: { v: string; n: ServerNachricht }[] = [];
    const raum = new BroRaum({ raum: 'ABC12345', jetzt: () => jetzt, zufall: () => (++zaehler).toString(16).padStart(8, '0').padEnd(32, '0'), trennen() {}, senden(v, n) {
      post.push({ v, n }); if (v === 'host' && n.art === 'eingabe' && (n.aktion.art === 'steuerung' || n.aktion.art === 'reset')) spiel?.eingabe(n.spieler, n.aktion);
    } });
    raum.anmelden('host', { v: 1, art: 'gastgeber', schluessel: raum.hostSchluessel });
    const einladung = post.find(p => p.n.art === 'willkommen')!.n as Extract<ServerNachricht, { art: 'willkommen' }>;
    for (const id of ['a', 'b']) { raum.anmelden(id, { v: 1, art: 'beitreten', einladung: einladung.einladung, name: id }); raum.empfangen(id, { v: 1, art: 'bereit', bereit: true }); }
    raum.empfangen('host', { v: 1, art: 'spielen' }); const s = raum.sicht();
    spiel = new BauPartie(r, s.spieler, 'rennen', 217); offen.push(spiel); start(spiel);
    let folge = 0;
    for (let i = 0; i < 40; i++) {
      jetzt += 1000 / 60;
      if (i % 6 === 0) raum.empfangen('a', { v: 1, art: 'eingabe', abschnitt: s.abschnitt, folge: ++folge, aktion: { art: 'steuerung', x: 1, y: 0, tasten: [] } });
      spiel.schritt();
    }
    const b = spiel.sicht().bahnen; expect(b[0].steine[0].x).toBeGreaterThan(3); expect(b[1].steine[0].x).toBe(0);
    raum.empfangen('a', { v: 1, art: 'eingabe', abschnitt: s.abschnitt, folge: ++folge, aktion: { art: 'reset' } });
    const x = b[0].steine[0].x; schritte(spiel, 5); expect(spiel.sicht().bahnen[0].steine[0].x).toBeCloseTo(x, 2);
  });
  it('spawnt bei doppelter bisheriger Höhe, auch über einem vorhandenen Turm', () => {
    expect(spawnHoehe(0)).toBe(14); expect(spawnHoehe(12)).toBe(34);
    const p = partie(); start(p); expect(p.sicht().bahnen[0].steine[0].y).toBeGreaterThan(13.9);
  });
  it('hält den Nachschub am Ziel an, zählt drei Sekunden und setzt nach Einsturz fort', () => {
    const p = partie('rennen', 2); start(p); taste(p, '0', 'fallen');
    for (let i = 0; i < 160 && p.sicht().bahnen[0].gebaut === 0; i++) p.schritt();
    // Eine reproduzierbare Hochlage statt eines zufällig gerade stehenden Turms.
    const intern = p as unknown as { bahnen: { steine: { gelandet: boolean; koerper: RigidBody }[] }[] };
    const oberster = intern.bahnen[0].steine.find(s => s.gelandet)!.koerper;
    oberster.setBodyType(r.RigidBodyType.Fixed, true); oberster.setTranslation({ x: 0, y: 16 }, true);
    schritte(p, 1); const vorrat = p.sicht().bahnen[0].verbraucht;
    expect(p.sicht().bahnen[0].halten).toBeGreaterThan(0);
    schritte(p, 100); expect(p.sicht().phase).toBe('spiel');
    expect(p.sicht().bahnen[0].verbraucht).toBe(vorrat); expect(p.sicht().bahnen[0].steine.some(s => s.aktiv)).toBe(false);
    oberster.setTranslation({ x: 0, y: 1 }, true); schritte(p, 50);
    expect(p.sicht().bahnen[0].halten).toBe(0); expect(p.sicht().bahnen[0].steine.some(s => s.aktiv)).toBe(true);
    oberster.setTranslation({ x: 0, y: 16 }, true); schritte(p, 1);
    const zurueckgelegt = p.sicht().bahnen[0].verbraucht; schritte(p, 182);
    expect(p.sicht().gewinner).toEqual(['0']); expect(p.sicht().bahnen[0].verbraucht).toBe(zurueckgelegt);
  });
  it('Zauber brauchen drei Teile, kosten genau eine Ladung und treffen nur das gewählte Ziel', () => {
    const p = partie('rennen', 3); start(p);
    p.eingabe('0', { art: 'zauber', zauber: 'anker' }); expect(p.sicht().bahnen[0].anker).toBe(0);
    for (let i = 0; i < 2200 && p.sicht().bahnen[0].gebaut < 3; i++) { if (i % 90 === 0) for (const id of ['0', '1', '2']) taste(p, id, 'fallen'); p.schritt(); }
    expect(p.sicht().bahnen[0].ankerBereit).toBe(true);
    p.eingabe('0', { art: 'zauber', zauber: 'anker' }); schritte(p, 30);
    const rest = p.sicht().bahnen[0].anker; p.eingabe('0', { art: 'zauber', zauber: 'anker' });
    expect(p.sicht().bahnen[0].anker).toBe(rest); expect(p.sicht().bahnen[0].ankerBereit).toBe(false);
    p.eingabe('0', { art: 'zauber', zauber: 'schwere', ziel: '0' }); expect(p.sicht().bahnen[0].schwereBereit).toBe(true);
    p.eingabe('0', { art: 'zauber', zauber: 'schwere', ziel: '1' });
    expect(p.sicht().bahnen[1].schwereWartet).toBe(true); expect(p.sicht().bahnen[2].schwereWartet).toBe(false);
    expect(p.sicht().bahnen[0].schwereBereit).toBe(false);
    for (let i = 0; i < 500 && !p.sicht().bahnen[1].steine.some(s => s.schwer); i++) { if (i % 60 === 0) taste(p, '1', 'fallen'); p.schritt(); }
    expect(p.sicht().bahnen[1].steine.some(s => s.schwer)).toBe(true);
    expect(p.sicht().bahnen[2].steine.some(s => s.schwer)).toBe(false);
    schritte(p, 250); expect(p.sicht().bahnen[0].anker).toBe(0);
  });

});
