/** Gleichzeitige Planungszüge: nur der Server löst Bewegung, Kollisionen und Siege auf. */
export type EisPlan = { x: number; y: number; fest: boolean; item: boolean };
export type EisSpieler = {
  id: string;
  name: string;
  bot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  winkel: number;
  lebt: boolean;
  siege: number;
  anker: number;
  item: string;
  bereit: boolean;
  verbunden: boolean;
  geplant: boolean;
  emote: string;
  emoteZeit: number;
};
export class EisPartie {
  spieler: EisSpieler[] = [];
  phase = "lobby";
  zeit = 0;
  runde = 0;
  zug = 0;
  radius = 260;
  warnung = false;
  gewinner = "";
  effekte: { x: number; y: number; art: string; bis: number }[] = [];
  geschosse: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    von: string;
    rest: number;
  }[] = [];
  fund: { x: number; y: number; art: string } | null = null;
  private plaene = new Map<string, EisPlan>();
  private zustand: number;
  private uhr = 0;
  private rundenzug = 0;
  constructor(seed = 1) {
    this.zustand = seed >>> 0;
  }
  private zufall() {
    this.zustand = (Math.imul(this.zustand, 1664525) + 1013904223) >>> 0;
    return this.zustand / 4294967296;
  }
  hinzufuegen(id: string, name: string, bot = false) {
    if (this.phase !== "lobby" || this.spieler.length >= 4) return false;
    this.spieler.push({
      id,
      name,
      bot,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      winkel: 0,
      lebt: true,
      siege: 0,
      anker: 0,
      item: "",
      bereit: bot,
      verbunden: true,
      geplant: false,
      emote: "",
      emoteZeit: 0,
    });
    return true;
  }
  planen(
    id: string,
    zug: number,
    x: number,
    y: number,
    fest: boolean,
    item = false,
  ) {
    const p = this.spieler.find((p) => p.id === id);
    if (
      this.phase !== "planung" ||
      zug !== this.zug ||
      !p?.lebt ||
      this.plaene.get(id)?.fest ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      return false;
    const l = Math.max(1, Math.hypot(x, y));
    this.plaene.set(id, { x: x / l, y: y / l, fest, item: !!p.item && item });
    p.geplant = fest;
    return true;
  }
  emote(id: string, art: string) {
    const p = this.spieler.find((p) => p.id === id);
    if (
      !p ||
      p.emoteZeit > 1 ||
      !["hallo", "haha", "ups", "jubel"].includes(art)
    )
      return false;
    p.emote = art;
    p.emoteZeit = 3;
    return true;
  }
  starten() {
    if (
      this.phase !== "lobby" ||
      this.spieler.length < 2 ||
      this.spieler.some((p) => !p.bereit)
    )
      return false;
    this.neueRunde();
    return true;
  }
  private neueRunde() {
    this.runde++;
    this.radius = 260;
    this.rundenzug = 0;
    this.fund = null;
    this.effekte = [];
    this.geschosse = [];
    this.gewinner = "";
    const a = this.zufall() * Math.PI * 2;
    this.spieler.forEach((p, i) =>
      Object.assign(p, {
        x: Math.cos(a + (i * Math.PI * 2) / this.spieler.length) * 155,
        y: Math.sin(a + (i * Math.PI * 2) / this.spieler.length) * 155,
        vx: 0,
        vy: 0,
        winkel: a + (i * Math.PI * 2) / this.spieler.length + Math.PI,
        lebt: true,
        anker: 0,
        item: "",
      }),
    );
    this.planungsphase();
  }
  private botPlan(p: EisSpieler): EisPlan {
    const ziel = this.spieler
      .filter((q) => q.id !== p.id && q.lebt)
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      )[0];
    const rand = Math.hypot(p.x, p.y) > this.radius * 0.5;
    const dx = rand ? -p.x : (ziel?.x ?? 0) - p.x,
      dy = rand ? -p.y : (ziel?.y ?? 0) - p.y;
    const l = Math.max(1, Math.hypot(dx, dy));
    const kraft = Math.min(0.9, Math.max(0.35, l / 220));
    return {
      x: (dx / l) * kraft,
      y: (dy / l) * kraft,
      fest: true,
      item: !!p.item,
    };
  }
  private planungsphase() {
    this.phase = "planung";
    this.zeit = 15;
    this.zug++;
    this.rundenzug++;
    this.warnung = this.rundenzug % 2 === 0;
    this.plaene.clear();
    this.geschosse = [];
    for (const p of this.spieler) {
      p.vx = 0;
      p.vy = 0;
      p.geplant = false;
      if (p.lebt && (p.bot || !p.verbunden)) {
        this.plaene.set(p.id, this.botPlan(p));
        p.geplant = true;
      }
    }
    if (!this.fund) {
      const a = this.zufall() * Math.PI * 2;
      this.fund = {
        x: Math.cos(a) * this.radius * 0.45,
        y: Math.sin(a) * this.radius * 0.45,
        art: ["anker", "schneeball", "wind"][Math.floor(this.zufall() * 3)],
      };
    }
  }
  private ausfuehren() {
    this.phase = "gleiten";
    this.zeit = 4;
    // Zuerst alle Impulse setzen, danach Fähigkeiten. Sonst überschreibt ein späterer Spieler Treffer.
    for (const p of this.spieler) {
      if (!p.lebt) continue;
      const plan =
        this.plaene.get(p.id) ??
        (p.bot || !p.verbunden
          ? this.botPlan(p)
          : { x: 0, y: 0, fest: true, item: false });
      this.plaene.set(p.id, { ...plan, fest: true });
      p.geplant = true;
      p.vx = plan.x * 240;
      p.vy = plan.y * 240;
      if (Math.hypot(plan.x, plan.y) > 0.01)
        p.winkel = Math.atan2(plan.y, plan.x);
      if (plan.item && p.item === "anker") p.anker = 4;
    }
    for (const p of this.spieler) {
      if (!p.lebt || !this.plaene.get(p.id)?.item || !p.item) continue;
      if (p.item === "schneeball")
        this.geschosse.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(p.winkel) * 370,
          vy: Math.sin(p.winkel) * 370,
          von: p.id,
          rest: 1.3,
        });
      if (p.item === "wind")
        for (const q of this.spieler) {
          const dx = q.x - p.x,
            dy = q.y - p.y,
            d = Math.hypot(dx, dy);
          if (
            q.id !== p.id &&
            q.lebt &&
            d < 130 &&
            (dx * Math.cos(p.winkel) + dy * Math.sin(p.winkel)) /
              Math.max(1, d) >
              0.35
          ) {
            q.vx += Math.cos(p.winkel) * 160 * (q.anker ? 0.2 : 1);
            q.vy += Math.sin(p.winkel) * 160 * (q.anker ? 0.2 : 1);
          }
        }
      this.effekte.push({ x: p.x, y: p.y, art: "schnee", bis: this.uhr + 0.5 });
      p.item = "";
    }
  }
  schritt() {
    const dt = 0.04;
    this.uhr += dt;
    for (const p of this.spieler) {
      p.emoteZeit = Math.max(0, p.emoteZeit - dt);
      if (!p.emoteZeit) p.emote = "";
    }
    this.effekte = this.effekte.filter((e) => e.bis > this.uhr);
    if (this.phase === "lobby" || this.phase === "ende") return;
    this.zeit = Math.max(0, this.zeit - dt);
    if (this.phase === "planung") {
      if (this.zeit === 0) this.ausfuehren();
      return;
    }
    if (this.phase === "pause") {
      if (this.zeit === 0) {
        if (this.spieler.some((p) => p.siege >= 3)) this.phase = "ende";
        else this.neueRunde();
      }
      return;
    }
    if (this.phase !== "gleiten") return;
    for (const p of this.spieler) {
      if (!p.lebt) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.965;
      p.vy *= 0.965;
      p.anker = Math.max(0, p.anker - dt);
    }
    for (let i = 0; i < this.spieler.length; i++)
      for (let j = i + 1; j < this.spieler.length; j++) {
        const a = this.spieler[i],
          b = this.spieler[j];
        if (!a.lebt || !b.lebt) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy);
        if (d >= 34) continue;
        const nx = d ? dx / d : 1,
          ny = d ? dy / d : 0,
          abstand = (34 - d) / 2;
        a.x -= nx * abstand;
        a.y -= ny * abstand;
        b.x += nx * abstand;
        b.y += ny * abstand;
        const annäherung = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (annäherung > 0) {
          const impuls = annäherung * 0.94;
          a.vx -= nx * impuls * (a.anker ? 0.2 : 1);
          a.vy -= ny * impuls * (a.anker ? 0.2 : 1);
          b.vx += nx * impuls * (b.anker ? 0.2 : 1);
          b.vy += ny * impuls * (b.anker ? 0.2 : 1);
          this.effekte.push({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            art: "schnee",
            bis: this.uhr + 0.3,
          });
        }
      }
    for (const g of this.geschosse) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.rest -= dt;
      const q = this.spieler.find(
        (p) =>
          p.id !== g.von && p.lebt && Math.hypot(p.x - g.x, p.y - g.y) < 25,
      );
      if (q) {
        q.vx += g.vx * 0.45 * (q.anker ? 0.2 : 1);
        q.vy += g.vy * 0.45 * (q.anker ? 0.2 : 1);
        g.rest = 0;
      }
    }
    this.geschosse = this.geschosse.filter((g) => g.rest > 0);
    for (const p of this.spieler) {
      if (
        p.lebt &&
        this.fund &&
        !p.item &&
        Math.hypot(p.x - this.fund.x, p.y - this.fund.y) < 30
      ) {
        p.item = this.fund.art;
        this.fund = null;
      }
    }
    this.stuerze();
    if (this.rundenende()) return;
    if (this.zeit === 0) {
      if (this.warnung) {
        this.radius = Math.max(0, this.radius - 35);
        if (
          this.fund &&
          Math.hypot(this.fund.x, this.fund.y) > this.radius - 20
        )
          this.fund = null;
        this.stuerze();
      }
      if (!this.rundenende()) this.planungsphase();
    }
  }
  private stuerze() {
    for (const p of this.spieler) {
      if (p.lebt && Math.hypot(p.x, p.y) > this.radius + 5) {
        p.lebt = false;
        p.vx = 0;
        p.vy = 0;
        this.effekte.push({ x: p.x, y: p.y, art: "wasser", bis: this.uhr + 2 });
      }
    }
  }
  private rundenende() {
    const rest = this.spieler.filter((p) => p.lebt);
    if (rest.length > 1) return false;
    this.gewinner = rest[0]?.id ?? "";
    if (rest[0]) rest[0].siege++;
    this.phase = "pause";
    this.zeit = 4;
    return true;
  }
  sicht(id?: string) {
    return {
      phase: this.phase,
      zeit: this.zeit,
      runde: this.runde,
      zug: this.zug,
      radius: this.radius,
      warnung: this.warnung,
      gewinner: this.gewinner,
      spieler: this.spieler,
      effekte: this.effekte,
      geschosse: this.geschosse,
      fund: this.fund,
      plan: id ? (this.plaene.get(id) ?? null) : null,
    };
  }
}
