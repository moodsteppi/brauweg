import type * as RapierTypen from '@dimforge/rapier2d-compat';
import { bauteilfolge, rangfolge, REGELN, MAX_BAUTEILE, ZAUBER, FAHIGKEITEN, itemZufall, itemZiehen, type BauItem, spawnHoehe, zellen, type BauZauber, type BauForm, type BauModus, type Punkt } from '@brauweg/building-kern';

type Rapier = typeof RapierTypen;
let geladen: Promise<Rapier> | undefined;
export function ladeBauphysik(): Promise<Rapier> {
  geladen ??= import('@dimforge/rapier2d-compat').then(async m => {
    const r = ((m as unknown as { default?: Rapier }).default ?? m) as Rapier;
    await r.init(); return r;
  }).catch(e => { geladen = undefined; throw e; });
  return geladen;
}
export type BauEingabe = { art: 'zauber'; zauber: BauZauber; item: number; ziel?: string } | { art: 'plattform'; item: number; schritt: 'platzieren' | 'zurueck' } | { art: 'reset' } | { art: 'steuerung'; x: number; y: number; tasten: readonly string[] };
export type BauSpieler = { id: string; name: string; farbe: string };
export type SteinSicht = { nummer: number; form: BauForm; x: number; y: number; winkel: number; aktiv: boolean; schwer: boolean; eis: boolean; stein: boolean };
export type BahnSicht = BauSpieler & { steine: SteinSicht[]; naechster: BauForm; hoehe: number; leben: number; gebaut: number; verbraucht: number; verloren: number; halten: number; fertig: boolean; aufgegeben: boolean; platz: number; anker: number; item?: BauItem; itemIn: number; itemBereit: boolean; plattformen: Punkt[]; platzierung?: Platzierung; ziele: string[]; schwereWartet: boolean; eisWartet: boolean; steinWartet: boolean; zauberHinweis: string; effekt: number };
export type BauSicht = { phase: 'countdown' | 'spiel' | 'ende'; countdown: number; restzeit: number; modus: BauModus; bahnen: BahnSicht[]; gewinner: string[]; grund: string; dauer: number };
type Stein = { nummer: number; form: BauForm; koerper: RapierTypen.RigidBody; zellen: Punkt[]; gelandet: boolean; schwer: boolean; eis: boolean; stein: boolean; };
export type Platzierung = Punkt & { gueltig: boolean; rest: number };
type Bahn = BauSpieler & {
  welt: RapierTypen.World; ereignisse: RapierTypen.EventQueue; steine: Stein[]; aktiv?: Stein;
  eingabe: { x: number; y: number; drehen: boolean; fallen: boolean }; drehenAnstehend: boolean; fallenAnstehend: boolean; eingabeAlter: number;
  verbraucht: number; gebaut: number; verloren: number; leben: number; hoehe: number; halten: number;
  anker: number; item?: BauItem; itemIn: number; itemNummer: number; letztesItem?: BauZauber; zufall: () => number; plattformen: Punkt[]; platzierung?: Platzierung & { maxY: number }; schwereWartet: boolean; eisWartet: boolean; steinWartet: boolean; zauberHinweis: string; effekt: number;
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
    // Auch der schnellste mögliche Nachschub reicht bis zum Zeitlimit, für
    // jeden Sitz in derselben Reihenfolge. Standfest behält sein Soloziel.
    this.folge = bauteilfolge(seed, MAX_BAUTEILE + 1);
    this.bahnen = spieler.map((s, i) => {
      const zufall = itemZufall(seed ^ Math.imul(i + 1, 0x9e3779b9));
      const welt = new r.World({ x: 0, y: -18 }); welt.timestep = REGELN.schritt;
      const boden = welt.createRigidBody(r.RigidBodyDesc.fixed().setTranslation(0, -.35));
      welt.createCollider(r.ColliderDesc.cuboid(REGELN.bodenHalb, .35).setFriction(.8), boden);
      return { ...s, welt, ereignisse: new r.EventQueue(true), steine: [], eingabe: { x: 0, y: 0, drehen: false, fallen: false }, eingabeAlter: 0, drehenAnstehend: false, fallenAnstehend: false,
        anker: 0, itemIn: 8 + Math.floor(zufall() * 5), itemNummer: 0, zufall, plattformen: [], schwereWartet: false, eisWartet: false, steinWartet: false, zauberHinweis: '', effekt: 0, verbraucht: 0, gebaut: 0, verloren: 0, leben: REGELN.leben, hoehe: 0, halten: 0, nachschub: 0, fertig: false, aufgegeben: false };
    });
  }
  eingabe(id: string, a: BauEingabe): void {
    const b = this.bahnen.find(s => s.id === id);
    if (!b || this.ende || b.fertig) return;
    if (a.art === 'zauber') { this.zaubern(b, a.zauber, a.item, a.ziel); return; }
    if (a.art === 'plattform') { this.plattform(b, a.item, a.schritt); return; }
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
    this.eingabe(id, { art: 'reset' }); b.aufgegeben = true; b.fertig = true; b.platzierung = undefined; b.leben = 0;
    if (b.aktiv) { b.welt.removeRigidBody(b.aktiv.koerper); b.steine = b.steine.filter(s => s !== b.aktiv); b.aktiv = undefined; }
  }
  private neu(b: Bahn): void {
    if (this.modus === 'standfest' && b.verbraucht >= REGELN.bauteile) { b.fertig = true; return; }
    const form = this.folge[b.verbraucht], teile = zellen(form);
    const koerper = b.welt.createRigidBody(this.r.RigidBodyDesc.dynamic().setTranslation(0, spawnHoehe(b.hoehe)).setGravityScale(0).lockRotations().setCcdEnabled(true).setLinearDamping(.15).setAngularDamping(.5));
    for (const p of teile) b.welt.createCollider(this.r.ColliderDesc.cuboid(.49, .49).setTranslation(p.x, p.y).setFriction(b.eisWartet ? .015 : .75).setFrictionCombineRule(b.eisWartet ? this.r.CoefficientCombineRule.Min : this.r.CoefficientCombineRule.Average).setRestitution(.02).setDensity(b.schwereWartet ? ZAUBER.schwereFaktor : 1).setActiveEvents(this.r.ActiveEvents.COLLISION_EVENTS), koerper);
    const s = { form, nummer: b.verbraucht++, koerper, zellen: teile, gelandet: false, schwer: b.schwereWartet, eis: b.eisWartet, stein: b.steinWartet };
    b.schwereWartet = false; b.eisWartet = false; b.steinWartet = false;
    b.steine.push(s); b.aktiv = s; b.drehenAnstehend = false; b.fallenAnstehend = false;
  }
  private ziele(b: Bahn): Bahn[] {
    return this.bahnen.filter(g => g !== b && !g.fertig && !g.aufgegeben && (b.item?.art === 'eis' ? !g.eisWartet : !g.schwereWartet));
  }
  private itemBereit(b: Bahn): boolean {
    if (!b.item || b.fertig || this.zeit < 0 || this.ende) return false;
    if (FAHIGKEITEN[b.item.art].angriff) return this.ziele(b).length > 0;
    if (b.item.art === 'plattform') return !b.halten && !b.platzierung && b.plattformen.length < ZAUBER.plattformMaximum;
    return b.item.art !== 'stein' || !b.steinWartet;
  }
  private verbrauchen(b: Bahn): void {
    b.item = undefined; b.platzierung = undefined;
    b.itemIn = 18 + Math.floor(b.zufall() * 11);
    this.eingabe(b.id, { art: 'reset' });
  }
  private zaubern(b: Bahn, zauber: BauZauber, nummer: number, ziel?: string): void {
    // Die Kennung verhindert, dass ein verspätetes Doppeltippen ein neues Item ausgibt.
    if (!this.itemBereit(b) || b.item?.nummer !== nummer || b.item.art !== zauber) return;
    if (zauber === 'anker') {
      b.anker = ZAUBER.ankerDauer;
      b.zauberHinweis = 'Turmanker schützt deinen Turm';
      for (const s of b.steine) if (s.gelandet) {
        s.koerper.setLinvel({ x: 0, y: 0 }, true); s.koerper.setAngvel(0, true);
      }
    } else if (zauber === 'plattform') {
      const maxY = Math.max(.4, Math.min(REGELN.ziel - 4, b.hoehe - 1));
      b.platzierung = { x: 0, y: maxY, maxY, gueltig: false, rest: ZAUBER.platzierZeit };
      b.platzierung.gueltig = this.platzFrei(b);
      this.eingabe(b.id, { art: 'reset' });
      return;
    } else if (zauber === 'stein') {
      b.steinWartet = true; b.zauberHinweis = 'Steinsiegel schützt dein nächstes Teil';
    } else {
      const gegner = this.ziele(b).find(g => g.id === ziel);
      if (!gegner) return;
      if (zauber === 'schwere') gegner.schwereWartet = true;
      else gegner.eisWartet = true;
      b.zauberHinweis = `${FAHIGKEITEN[zauber].name} trifft ${gegner.name}`;
      gegner.zauberHinweis = `${b.name}: ${FAHIGKEITEN[zauber].name} auf dein nächstes Teil`; gegner.effekt++;
    }
    b.effekt++; this.verbrauchen(b);
  }
  private platzFrei(b: Bahn): boolean {
    const p = b.platzierung;
    if (!p || Math.abs(p.x) > REGELN.feldHalb - ZAUBER.plattformHalb || p.y < .4 || p.y > p.maxY) return false;
    return b.welt.intersectionWithShape(p, 0, new this.r.Cuboid(ZAUBER.plattformHalb + .08, ZAUBER.plattformHoehe + .08)) === null;
  }
  private plattform(b: Bahn, nummer: number, schritt: 'platzieren' | 'zurueck'): void {
    if (this.zeit < 0 || !b.platzierung || b.item?.art !== 'plattform' || b.item.nummer !== nummer) return;
    if (schritt === 'zurueck') { b.platzierung = undefined; this.eingabe(b.id, { art: 'reset' }); return; }
    // Die aktuelle Physik entscheidet, nicht die möglicherweise ältere Handy-Vorschau.
    if (!this.platzFrei(b) || b.halten > 0 || b.plattformen.length >= ZAUBER.plattformMaximum) return;
    const { x, y } = b.platzierung;
    const steg = b.welt.createRigidBody(this.r.RigidBodyDesc.fixed().setTranslation(x, y));
    b.welt.createCollider(this.r.ColliderDesc.cuboid(ZAUBER.plattformHalb, ZAUBER.plattformHoehe).setFriction(.9), steg);
    b.plattformen.push({ x, y }); b.zauberHinweis = 'Wolkensteg platziert'; b.effekt++; this.verbrauchen(b);
  }
  private nachschubItem(b: Bahn, dt: number): void {
    if (b.fertig || b.item) return;
    b.itemIn = Math.max(0, b.itemIn - dt);
    if (b.itemIn > 0) return;
    const erlaubt: BauZauber[] = ['anker'];
    if (b.plattformen.length < ZAUBER.plattformMaximum) erlaubt.push('plattform');
    if (!b.steinWartet) erlaubt.push('stein');
    if (this.bahnen.some(g => g !== b && !g.fertig && !g.aufgegeben && !g.schwereWartet)) erlaubt.push('schwere');
    if (this.bahnen.some(g => g !== b && !g.fertig && !g.aufgegeben && !g.eisWartet)) erlaubt.push('eis');
    const art = itemZiehen(b.zufall, erlaubt, b.letztesItem);
    b.item = { art, nummer: ++b.itemNummer }; b.letztesItem = art;
    b.zauberHinweis = `${FAHIGKEITEN[art].name} erhalten!`; b.effekt++;
  }
  private aktivenEntfernen(b: Bahn, zuruecklegen = false): void {
    if (!b.aktiv) return;
    if (zuruecklegen) { b.verbraucht--; b.schwereWartet ||= b.aktiv.schwer; b.eisWartet ||= b.aktiv.eis; b.steinWartet ||= b.aktiv.stein; }
    b.welt.removeRigidBody(b.aktiv.koerper); b.steine = b.steine.filter(s => s !== b.aktiv); b.aktiv = undefined;
    this.eingabe(b.id, { art: 'reset' });
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
      b.anker = Math.max(0, b.anker - dt);
      this.nachschubItem(b, dt);
      if (b.platzierung) {
        const p = b.platzierung; p.rest -= dt;
        p.x = Math.max(-REGELN.feldHalb + ZAUBER.plattformHalb, Math.min(REGELN.feldHalb - ZAUBER.plattformHalb, p.x + b.eingabe.x * 4 * dt));
        p.y = Math.max(.4, Math.min(p.maxY, p.y - b.eingabe.y * 3 * dt));
        if (p.rest <= 0 || b.halten > 0) { b.platzierung = undefined; this.eingabe(b.id, { art: 'reset' }); }
      }
      if (!b.fertig && !b.platzierung && !b.aktiv && !(this.modus === 'rennen' && b.halten > 0)) { b.nachschub -= dt; if (b.nachschub <= 0) this.neu(b); }
      const aktiv = b.aktiv;
      if (aktiv && b.platzierung) aktiv.koerper.setLinvel({ x: 0, y: 0 }, true);
      if (aktiv && !b.platzierung) {
        if (b.drehenAnstehend) this.drehen(b, aktiv);
        // Der Fallknopf beschleunigt genau dieses Bauteil, nicht das nächste.
        if (b.fallenAnstehend) aktiv.koerper.userData = { schnell: true };
        const p = aktiv.koerper.translation();
        const schnell = (aktiv.koerper.userData as { schnell?: boolean } | undefined)?.schnell;
        const vx = b.eingabe.x * 5.5;
        aktiv.koerper.setLinvel({ x: (p.x < -5.5 && vx < 0) || (p.x > 5.5 && vx > 0) ? 0 : vx, y: schnell ? -18 : b.eingabe.y > .4 ? -6 : -2.4 }, true);
      }
      b.drehenAnstehend = false; b.fallenAnstehend = false;
      for (const s of b.steine) if (s.gelandet) {
        s.koerper.setLinearDamping(b.anker > 0 ? 10 : .15);
        s.koerper.setAngularDamping(b.anker > 0 ? 18 : .5);
      }
      b.welt.step(b.ereignisse);
      if (b.platzierung) b.platzierung.gueltig = this.platzFrei(b);
      let beruehrt = false;
      b.ereignisse.drainCollisionEvents((a, c, an) => {
        if (!an || !aktiv) return;
        for (let i = 0; i < aktiv.koerper.numColliders(); i++) if (aktiv.koerper.collider(i).handle === a || aktiv.koerper.collider(i).handle === c) beruehrt = true;
      });
      if (aktiv && beruehrt) {
        aktiv.gelandet = true; aktiv.koerper.lockRotations(false, true); aktiv.koerper.setGravityScale(1, true);
        const v = aktiv.koerper.linvel(); aktiv.koerper.setLinvel({ x: v.x * .25, y: Math.max(-3, v.y) }, true);
        if (aktiv.stein) aktiv.koerper.setBodyType(this.r.RigidBodyType.Fixed, true);
        b.aktiv = undefined; b.gebaut++; b.nachschub = REGELN.nachschubPause;
      }
      for (const s of [...b.steine]) {
        const p = s.koerper.translation();
        if (p.y < -4 || Math.abs(p.x) > 18 || !Number.isFinite(p.y)) {
          b.welt.removeRigidBody(s.koerper); b.steine.splice(b.steine.indexOf(s), 1); b.verloren++;
          if (s === b.aktiv) { b.aktiv = undefined; b.nachschub = REGELN.nachschubPause; }
          if (this.modus === 'standfest') b.leben = Math.max(0, b.leben - 1);
        }
      }
      if (this.modus === 'standfest' && b.leben === 0 && !b.fertig) {
        b.fertig = true; b.platzierung = undefined;
        if (b.aktiv) { b.welt.removeRigidBody(b.aktiv.koerper); b.steine = b.steine.filter(s => s !== b.aktiv); b.aktiv = undefined; }
      }
      b.hoehe = 0;
      for (const s of b.steine) if (s.gelandet) {
        const p = s.koerper.translation(), w = s.koerper.rotation(), v = s.koerper.linvel();
        if (Math.hypot(v.x, v.y) > .8 || Math.abs(s.koerper.angvel()) > .8) continue;
        for (const z of s.zellen) b.hoehe = Math.max(b.hoehe, p.y + z.x * Math.sin(w) + z.y * Math.cos(w) + .49 * (Math.abs(Math.sin(w)) + Math.abs(Math.cos(w))));
      }
      b.halten = this.modus === 'rennen' && b.hoehe >= REGELN.ziel && !b.aufgegeben ? b.halten + dt : 0;
      // Ab Zielkontakt gehört die Bühne nur dem Turm. Ein schon vorgeladenes
      // Teil kommt zurück in den Vorrat, damit der Countdown nichts verbraucht.
      if (b.halten > 0) this.aktivenEntfernen(b, true);
    }
    this.endePruefen();
  }
  private endePruefen(): void {
    const lebend = this.bahnen.filter(b => !b.aufgegeben && (this.modus === 'rennen' || b.leben > 0));
    const ziel = this.bahnen.filter(b => b.halten >= REGELN.halten && !b.aufgegeben);
    if (this.modus === 'rennen' && ziel.length) { this.gewinner = ziel.map(b => b.id); this.grund = 'Zielhöhe gehalten!'; }
    else if (this.bahnen.length > 1 && lebend.length === 1) { this.gewinner = lebend.map(b => b.id); this.grund = 'Der letzte Turm steht.'; }
    else if (!lebend.length) this.grund = 'Keine Leben mehr.';
    else if (this.zeit >= REGELN.dauer) this.grund = 'Die Zeit ist um.';
    // Nach dem letzten Teil bekommt die Physik Zeit: ein fallender Turm zählt nicht als fertig.
    else if (this.bahnen.every(b => b.fertig) && this.bahnen.every(b => b.steine.every(s => s.koerper.isSleeping() || Math.hypot(s.koerper.linvel().x, s.koerper.linvel().y) < .12))) this.grund = 'Alle Bauteile verbaut.';
    if (!this.grund) return;
    this.ende = true;
    for (const b of this.bahnen) b.platzierung = undefined;
    if (!this.gewinner.length && lebend.length > 0 && this.bahnen.length > 1) this.gewinner = rangfolge(this.bahnen, this.modus).filter(b => b.platz === 1 && !b.aufgegeben).map(b => b.id);
    if (this.bahnen.length === 1 && this.modus === 'standfest' && this.bahnen[0].leben > 0 && this.bahnen[0].verbraucht === REGELN.bauteile) this.gewinner = [this.bahnen[0].id];
    this.neutralisieren();
  }
  sicht(): BauSicht {
    const rang = rangfolge(this.bahnen, this.modus, this.gewinner);
    return { phase: this.ende ? 'ende' : this.zeit < 0 ? 'countdown' : 'spiel', countdown: Math.max(0, Math.ceil(-this.zeit)), restzeit: Math.max(0, Math.ceil(REGELN.dauer - Math.max(0, this.zeit))), modus: this.modus, gewinner: [...this.gewinner], grund: this.grund, dauer: Math.max(0, Math.round(this.zeit)),
      bahnen: this.bahnen.map(b => ({ id: b.id, name: b.name, farbe: b.farbe, naechster: this.folge[b.verbraucht] ?? 'quadrat', hoehe: Math.max(0, b.hoehe), anker: b.anker, item: b.item ? { ...b.item } : undefined, itemIn: Math.ceil(b.itemIn), itemBereit: this.itemBereit(b), plattformen: b.plattformen.map(p => ({ ...p })), platzierung: b.platzierung ? { x: b.platzierung.x, y: b.platzierung.y, gueltig: b.platzierung.gueltig, rest: Math.ceil(b.platzierung.rest) } : undefined, ziele: this.ziele(b).map(g => g.id), eisWartet: b.eisWartet, steinWartet: b.steinWartet, schwereWartet: b.schwereWartet, zauberHinweis: b.zauberHinweis, effekt: b.effekt, leben: b.leben, gebaut: b.gebaut, verbraucht: b.verbraucht, verloren: b.verloren, halten: b.halten, fertig: b.fertig, aufgegeben: b.aufgegeben, platz: rang.find(s => s.id === b.id)!.platz,
        steine: b.steine.map(s => ({ nummer: s.nummer, form: s.form, ...s.koerper.translation(), winkel: s.koerper.rotation(), aktiv: s === b.aktiv, schwer: s.schwer, eis: s.eis, stein: s.stein })) })) };
  }
  freigeben(): void { if (this.freigegeben) return; this.freigegeben = true; for (const b of this.bahnen) { b.ereignisse.free(); b.welt.free(); } }
}
