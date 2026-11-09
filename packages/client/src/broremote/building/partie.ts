import type * as RapierTypen from '@dimforge/rapier2d-compat';
import { bauteilfolge, rangfolge, REGELN, zellen, type BauForm, type BauModus, type Punkt } from '@brauweg/building-kern';

type Rapier = typeof RapierTypen;
let geladen: Promise<Rapier> | undefined;
export function ladeBauphysik(): Promise<Rapier> {
  geladen ??= import('@dimforge/rapier2d-compat').then(async m => {
    const r = ((m as unknown as { default?: Rapier }).default ?? m) as Rapier;
    await r.init(); return r;
  }).catch(e => { geladen = undefined; throw e; });
  return geladen;
}
export type BauEingabe = { art: 'reset' } | { art: 'steuerung'; x: number; y: number; tasten: readonly string[] };
export type BauSpieler = { id: string; name: string; farbe: string };
export type SteinSicht = { nummer: number; form: BauForm; x: number; y: number; winkel: number; aktiv: boolean };
export type BahnSicht = BauSpieler & { steine: SteinSicht[]; naechster: BauForm; hoehe: number; leben: number; gebaut: number; verbraucht: number; verloren: number; halten: number; fertig: boolean; aufgegeben: boolean; platz: number };
export type BauSicht = { phase: 'countdown' | 'spiel' | 'ende'; countdown: number; restzeit: number; modus: BauModus; bahnen: BahnSicht[]; gewinner: string[]; grund: string };
type Stein = { nummer: number; form: BauForm; koerper: RapierTypen.RigidBody; zellen: Punkt[]; gelandet: boolean; };
type Bahn = BauSpieler & {
  welt: RapierTypen.World; ereignisse: RapierTypen.EventQueue; steine: Stein[]; aktiv?: Stein;
  eingabe: { x: number; y: number; drehen: boolean; fallen: boolean }; drehenAnstehend: boolean; fallenAnstehend: boolean; eingabeAlter: number;
  verbraucht: number; gebaut: number; verloren: number; leben: number; hoehe: number; halten: number;
  nachschub: number; fertig: boolean; aufgegeben: boolean;
};

/** Eine autoritative Simulation auf dem Gastgeber. Die Controller liefern nur Absichten. */
export class BauPartie {
  private readonly bahnen: Bahn[];
  private readonly folge: BauForm[];
  private zeit = -REGELN.countdown;
  private ende = false;
  private freigegeben = false;
  private gewinner: string[] = [];
  private grund = '';
  constructor(private readonly r: Rapier, spieler: readonly BauSpieler[], readonly modus: BauModus, seed: number) {
    if (!spieler.length || spieler.length > 4 || new Set(spieler.map(s => s.id)).size !== spieler.length) throw new Error('Ein bis vier verschiedene Spieler sind erforderlich.');
    this.folge = bauteilfolge(seed);
    this.bahnen = spieler.map(s => {
      const welt = new r.World({ x: 0, y: -18 }); welt.timestep = REGELN.schritt;
      const boden = welt.createRigidBody(r.RigidBodyDesc.fixed().setTranslation(0, -.35));
      welt.createCollider(r.ColliderDesc.cuboid(REGELN.bodenHalb, .35).setFriction(.8), boden);
      return { ...s, welt, ereignisse: new r.EventQueue(true), steine: [], eingabe: { x: 0, y: 0, drehen: false, fallen: false }, eingabeAlter: 0, drehenAnstehend: false, fallenAnstehend: false,
        verbraucht: 0, gebaut: 0, verloren: 0, leben: REGELN.leben, hoehe: 0, halten: 0, nachschub: 0, fertig: false, aufgegeben: false };
    });
  }
  eingabe(id: string, a: BauEingabe): void {
    const b = this.bahnen.find(s => s.id === id);
    if (!b || this.ende || b.fertig) return;
    if (a.art === 'reset') { b.eingabe = { x: 0, y: 0, drehen: false, fallen: false }; b.drehenAnstehend = false; b.fallenAnstehend = false; return; }
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return;
    // Eine kurze Taste kann zwischen zwei Physikschritten drücken UND loslassen.
    // Ihre Flanke bleibt deshalb bis zum nächsten Schritt erhalten.
    b.drehenAnstehend ||= a.tasten.includes('drehen') && !b.eingabe.drehen;
    b.fallenAnstehend ||= a.tasten.includes('fallen') && !b.eingabe.fallen;
    b.eingabe = { x: Math.max(-1, Math.min(1, a.x)), y: Math.max(-1, Math.min(1, a.y)), drehen: a.tasten.includes('drehen'), fallen: a.tasten.includes('fallen') };
    b.eingabeAlter = 0;
  }
  neutralisieren(): void { for (const b of this.bahnen) this.eingabe(b.id, { art: 'reset' }); }
  aufgeben(id: string): void {
    const b = this.bahnen.find(s => s.id === id);
    if (!b || this.ende) return;
    this.eingabe(id, { art: 'reset' }); b.aufgegeben = true; b.fertig = true; b.leben = 0;
    if (b.aktiv) { b.welt.removeRigidBody(b.aktiv.koerper); b.steine = b.steine.filter(s => s !== b.aktiv); b.aktiv = undefined; }
  }
  private neu(b: Bahn): void {
    if (b.verbraucht >= REGELN.bauteile) { b.fertig = true; return; }
    const form = this.folge[b.verbraucht], teile = zellen(form);
    const koerper = b.welt.createRigidBody(this.r.RigidBodyDesc.dynamic().setTranslation(0, Math.max(7, b.hoehe + 5)).setGravityScale(0).lockRotations().setCcdEnabled(true).setLinearDamping(.15).setAngularDamping(.5));
    for (const p of teile) b.welt.createCollider(this.r.ColliderDesc.cuboid(.49, .49).setTranslation(p.x, p.y).setFriction(.75).setRestitution(.02).setDensity(1).setActiveEvents(this.r.ActiveEvents.COLLISION_EVENTS), koerper);
    const s = { form, nummer: b.verbraucht++, koerper, zellen: teile, gelandet: false };
    b.steine.push(s); b.aktiv = s; b.drehenAnstehend = false; b.fallenAnstehend = false;
  }
  private drehen(b: Bahn, s: Stein): void {
    const winkel = s.koerper.rotation() - Math.PI / 2, p = s.koerper.translation();
    // Drehen dicht am Turm darf kein Bauteil in einen anderen Körper teleportieren.
    for (const z of s.zellen) {
      const pos = { x: p.x + z.x * Math.cos(winkel) - z.y * Math.sin(winkel), y: p.y + z.x * Math.sin(winkel) + z.y * Math.cos(winkel) };
      if (Math.abs(pos.x) + .49 > REGELN.feldHalb || b.welt.intersectionWithShape(pos, winkel, new this.r.Cuboid(.48, .48), undefined, undefined, undefined, s.koerper)) return;
    }
    s.koerper.setRotation(winkel, true);
  }
  schritt(): void {
    if (this.ende || this.freigegeben) return;
    const dt = REGELN.schritt; this.zeit += dt;
    if (this.zeit < 0) { this.neutralisieren(); return; }
    for (const b of this.bahnen) {
      b.eingabeAlter += dt;
      if (b.eingabeAlter > .6) this.eingabe(b.id, { art: 'reset' });
      if (!b.fertig && !b.aktiv) { b.nachschub -= dt; if (b.nachschub <= 0) this.neu(b); }
      const aktiv = b.aktiv;
      if (aktiv) {
        if (b.drehenAnstehend) this.drehen(b, aktiv);
        // Der Fallknopf beschleunigt genau dieses Bauteil, nicht das nächste.
        if (b.fallenAnstehend) aktiv.koerper.userData = { schnell: true };
        const p = aktiv.koerper.translation();
        const schnell = (aktiv.koerper.userData as { schnell?: boolean } | undefined)?.schnell;
        const vx = b.eingabe.x * 5.5;
        aktiv.koerper.setLinvel({ x: (p.x < -5.5 && vx < 0) || (p.x > 5.5 && vx > 0) ? 0 : vx, y: schnell ? -18 : b.eingabe.y > .4 ? -6 : -2.4 }, true);
      }
      b.drehenAnstehend = false; b.fallenAnstehend = false;
      b.welt.step(b.ereignisse);
      let beruehrt = false;
      b.ereignisse.drainCollisionEvents((a, c, an) => {
        if (!an || !aktiv) return;
        for (let i = 0; i < aktiv.koerper.numColliders(); i++) if (aktiv.koerper.collider(i).handle === a || aktiv.koerper.collider(i).handle === c) beruehrt = true;
      });
      if (aktiv && beruehrt) {
        aktiv.gelandet = true; aktiv.koerper.lockRotations(false, true); aktiv.koerper.setGravityScale(1, true);
        const v = aktiv.koerper.linvel(); aktiv.koerper.setLinvel({ x: v.x * .25, y: Math.max(-3, v.y) }, true);
        b.aktiv = undefined; b.gebaut++; b.nachschub = .65;
      }
      for (const s of [...b.steine]) {
        const p = s.koerper.translation();
        if (p.y < -4 || Math.abs(p.x) > 18 || !Number.isFinite(p.y)) {
          b.welt.removeRigidBody(s.koerper); b.steine.splice(b.steine.indexOf(s), 1); b.verloren++;
          if (s === b.aktiv) { b.aktiv = undefined; b.nachschub = .65; }
          if (this.modus === 'standfest') b.leben = Math.max(0, b.leben - 1);
        }
      }
      if (this.modus === 'standfest' && b.leben === 0 && !b.fertig) {
        b.fertig = true;
        if (b.aktiv) { b.welt.removeRigidBody(b.aktiv.koerper); b.steine = b.steine.filter(s => s !== b.aktiv); b.aktiv = undefined; }
      }
      b.hoehe = 0;
      for (const s of b.steine) if (s.gelandet) {
        const p = s.koerper.translation(), w = s.koerper.rotation(), v = s.koerper.linvel();
        if (Math.hypot(v.x, v.y) > .8 || Math.abs(s.koerper.angvel()) > .8) continue;
        for (const z of s.zellen) b.hoehe = Math.max(b.hoehe, p.y + z.x * Math.sin(w) + z.y * Math.cos(w) + .49 * (Math.abs(Math.sin(w)) + Math.abs(Math.cos(w))));
      }
      b.halten = b.hoehe >= REGELN.ziel && !b.aufgegeben ? b.halten + dt : 0;
    }
    this.endePruefen();
  }
  private endePruefen(): void {
    const lebend = this.bahnen.filter(b => !b.aufgegeben && (this.modus === 'rennen' || b.leben > 0));
    const ziel = this.bahnen.filter(b => b.halten >= REGELN.halten && !b.aufgegeben);
    if (this.modus === 'rennen' && ziel.length) { this.gewinner = ziel.map(b => b.id); this.grund = 'Zielhöhe gehalten!'; }
    else if (this.bahnen.length > 1 && lebend.length <= 1) { this.gewinner = lebend.map(b => b.id); this.grund = 'Der letzte Turm steht.'; }
    else if (!lebend.length) this.grund = 'Keine Leben mehr.';
    else if (this.zeit >= REGELN.dauer) this.grund = 'Die Zeit ist um.';
    // Nach dem letzten Teil bekommt die Physik Zeit: ein fallender Turm zählt nicht als fertig.
    else if (this.bahnen.every(b => b.fertig) && this.bahnen.every(b => b.steine.every(s => s.koerper.isSleeping() || Math.hypot(s.koerper.linvel().x, s.koerper.linvel().y) < .12))) this.grund = 'Alle Bauteile verbaut.';
    if (!this.grund) return;
    this.ende = true;
    if (!this.gewinner.length && this.bahnen.length > 1) this.gewinner = rangfolge(this.bahnen, this.modus).filter(b => b.platz === 1 && !b.aufgegeben).map(b => b.id);
    if (this.bahnen.length === 1 && this.modus === 'standfest' && this.bahnen[0].leben > 0 && this.bahnen[0].verbraucht === REGELN.bauteile) this.gewinner = [this.bahnen[0].id];
    this.neutralisieren();
  }
  sicht(): BauSicht {
    const rang = rangfolge(this.bahnen, this.modus, this.gewinner);
    return { phase: this.ende ? 'ende' : this.zeit < 0 ? 'countdown' : 'spiel', countdown: Math.max(0, Math.ceil(-this.zeit)), restzeit: Math.max(0, Math.ceil(REGELN.dauer - Math.max(0, this.zeit))), modus: this.modus, gewinner: [...this.gewinner], grund: this.grund,
      bahnen: this.bahnen.map(b => ({ id: b.id, name: b.name, farbe: b.farbe, naechster: this.folge[b.verbraucht] ?? 'quadrat', hoehe: Math.max(0, b.hoehe), leben: b.leben, gebaut: b.gebaut, verbraucht: b.verbraucht, verloren: b.verloren, halten: b.halten, fertig: b.fertig, aufgegeben: b.aufgegeben, platz: rang.find(s => s.id === b.id)!.platz,
        steine: b.steine.map(s => ({ nummer: s.nummer, form: s.form, ...s.koerper.translation(), winkel: s.koerper.rotation(), aktiv: s === b.aktiv })) })) };
  }
  freigeben(): void { if (this.freigegeben) return; this.freigegeben = true; for (const b of this.bahnen) { b.ereignisse.free(); b.welt.free(); } }
}
