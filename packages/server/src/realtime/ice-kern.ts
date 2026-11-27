/** Serverautorität, feste 40-ms-Schritte: keine Treffer oder Siege vom Gerät übernehmen. */
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
  laden: number;
  pause: number;
  anker: number;
  item: string;
  bereit: boolean;
  verbunden: boolean;
};
export class EisPartie {
  spieler: EisSpieler[] = [];
  phase = "lobby";
  zeit = 0;
  runde = 0;
  radius = 260;
  warnung = false;
  gewinner = "";
  effekte: {
    x: number;
    y: number;
    art: string;
    bis: number;
  }[] = [];
  fund: {
    x: number;
    y: number;
    art: string;
  } | null = null;
  private zustand: number;
  constructor(seed = 1) {
    this.zustand = seed >>> 0;
  }
  private zufall() {
    this.zustand = (Math.imul(this.zustand, 1664525) + 1013904223) >>> 0;
    return this.zustand / 4294967296;
  }
  geschosse: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    von: string;
    rest: number;
  }[] = [];
  private eingaben = new Map<
    string,
    {
      x: number;
      y: number;
      laden: boolean;
      item: boolean;
      alter: number;
    }
  >();
  private ablauf = 0;
  private naechsterFund = 10;
  hinzufuegen(id: string, name: string, bot = false) {
    if (this.spieler.length >= 4 || this.phase !== "lobby") return false;
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
      laden: 0,
      pause: 0,
      anker: 0,
      item: "",
      bereit: bot,
      verbunden: true,
    });
    return true;
  }
  eingabe(id: string, x: number, y: number, laden: boolean, item: boolean) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const l = Math.max(1, Math.hypot(x, y));
    this.eingaben.set(id, { x: x / l, y: y / l, laden, item, alter: 0 });
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
    this.phase = "countdown";
    this.zeit = 3;
    this.radius = 260;
    this.ablauf = 0;
    this.naechsterFund = 10;
    this.warnung = false;
    this.fund = null;
    this.geschosse = [];
    this.gewinner = "";
    this.effekte = [];
    this.eingaben.clear();
    this.spieler.forEach((p, i) =>
      Object.assign(p, {
        x: Math.cos((i * Math.PI * 2) / this.spieler.length) * 160,
        y: Math.sin((i * Math.PI * 2) / this.spieler.length) * 160,
        vx: 0,
        vy: 0,
        winkel: (i * Math.PI * 2) / this.spieler.length + Math.PI,
        lebt: true,
        laden: 0,
        pause: 0,
        anker: 0,
        item: "",
      }),
    );
  }
  schritt() {
    const dt = 0.04;
    if (this.phase === "lobby" || this.phase === "ende") return;
    this.zeit -= dt;
    if (this.phase === "countdown") {
      if (this.zeit <= 0) {
        this.phase = "spiel";
        this.zeit = 0;
      }
      return;
    }
    if (this.phase === "pause") {
      if (this.zeit <= 0) {
        if (this.spieler.some((p) => p.siege >= 3)) this.phase = "ende";
        else this.neueRunde();
      }
      return;
    }
    this.ablauf += dt;
    this.effekte = this.effekte.filter((e) => e.bis > this.ablauf);
    const stufe = Math.floor(this.ablauf / 9);
    this.radius = Math.max(0, 260 - stufe * 27);
    this.warnung = this.ablauf % 9 > 6;
    if (this.fund && Math.hypot(this.fund.x, this.fund.y) > this.radius - 20)
      this.fund = null;
    if (!this.fund && this.ablauf >= this.naechsterFund) {
      this.naechsterFund = this.ablauf + 10;
      const a = this.zufall() * Math.PI * 2;
      this.fund = {
        x: Math.cos(a) * this.radius * 0.65,
        y: Math.sin(a) * this.radius * 0.65,
        art: ["anker", "schneeball", "wind"][Math.floor(this.zufall() * 3)],
      };
    }
    for (const p of this.spieler) {
      if (!p.lebt) continue;
      const gespeichert = this.eingaben.get(p.id);
      if (gespeichert) gespeichert.alter += dt;
      let e =
        gespeichert && gespeichert.alter < 0.6
          ? { ...gespeichert }
          : { x: 0, y: 0, laden: false, item: false };
      if (gespeichert) gespeichert.item = false;
      if (p.bot || !p.verbunden) {
        const ziel = this.spieler
          .filter((q) => q !== p && q.lebt)
          .sort(
            (a, b) =>
              Math.hypot(a.x - p.x, a.y - p.y) -
              Math.hypot(b.x - p.x, b.y - p.y),
          )[0];
        const rand = Math.hypot(p.x, p.y) > this.radius - 65;
        const x = rand ? -p.x : (ziel?.x ?? 0) - p.x,
          y = rand ? -p.y : (ziel?.y ?? 0) - p.y,
          l = Math.max(1, Math.hypot(x, y));
        e = {
          x: x / l,
          y: y / l,
          laden: !!ziel && l < 105 && p.laden < 0.8,
          item: !!p.item,
        };
      }
      p.pause = Math.max(0, p.pause - dt);
      p.anker = Math.max(0, p.anker - dt);
      if (Math.hypot(e.x, e.y) > 0.1) p.winkel = Math.atan2(e.y, e.x);
      const kraft = e.laden ? 140 : 310;
      p.vx = (p.vx + e.x * kraft * dt) * 0.94;
      p.vy = (p.vy + e.y * kraft * dt) * 0.94;
      if (e.laden && p.pause === 0) p.laden = Math.min(1, p.laden + dt);
      else if (p.laden > 0) {
        this.schub(p, 55 + 90 * p.laden, 52 + 35 * p.laden);
        p.laden = 0;
        p.pause = 0.65;
      }
      if (e.item && p.item) {
        if (p.item === "anker") p.anker = 3;
        else if (p.item === "schneeball")
          this.geschosse.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(p.winkel) * 370,
            vy: Math.sin(p.winkel) * 370,
            von: p.id,
            rest: 1.2,
          });
        else this.schub(p, 190, 130);
        p.item = "";
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (
        this.fund &&
        !p.item &&
        Math.hypot(p.x - this.fund.x, p.y - this.fund.y) < 30
      ) {
        p.item = this.fund.art;
        this.fund = null;
      }
      if (Math.hypot(p.x, p.y) > this.radius + 5) {
        p.lebt = false;
        this.effekte.push({
          x: p.x,
          y: p.y,
          art: "wasser",
          bis: this.ablauf + 2,
        });
      }
    }
    for (const g of this.geschosse) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.rest -= dt;
      const ziel = this.spieler.find(
        (p) =>
          p.id !== g.von && p.lebt && Math.hypot(p.x - g.x, p.y - g.y) < 23,
      );
      if (ziel) {
        ziel.vx += g.vx * 0.48 * (ziel.anker ? 0.2 : 1);
        ziel.vy += g.vy * 0.48 * (ziel.anker ? 0.2 : 1);
        g.rest = 0;
        this.effekte.push({
          x: g.x,
          y: g.y,
          art: "schnee",
          bis: this.ablauf + 0.4,
        });
      }
    }
    this.geschosse = this.geschosse.filter((g) => g.rest > 0);
    for (let i = 0; i < this.spieler.length; i++)
      for (let j = i + 1; j < this.spieler.length; j++) {
        const a = this.spieler[i],
          b = this.spieler[j];
        if (!a.lebt || !b.lebt) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy);
        if (d < 32) {
          const nx = d ? dx / d : 1,
            ny = d ? dy / d : 0;
          const k = (32 - d) / 2;
          a.x -= nx * k;
          a.y -= ny * k;
          b.x += nx * k;
          b.y += ny * k;
        }
      }
    for (const p of this.spieler) {
      if (p.lebt && Math.hypot(p.x, p.y) > this.radius + 5) {
        p.lebt = false;
        this.effekte.push({
          x: p.x,
          y: p.y,
          art: "wasser",
          bis: this.ablauf + 2,
        });
      }
    }
    const rest = this.spieler.filter((p) => p.lebt);
    if (rest.length <= 1) {
      this.gewinner = rest[0]?.id ?? "";
      if (rest[0]) rest[0].siege++;
      this.phase = "pause";
      this.zeit = 5;
    }
  }
  private schub(p: EisSpieler, kraft: number, reichweite: number) {
    this.effekte.push({
      x: p.x + Math.cos(p.winkel) * 25,
      y: p.y + Math.sin(p.winkel) * 25,
      art: "schnee",
      bis: this.ablauf + 0.4,
    });
    for (const q of this.spieler) {
      if (q === p || !q.lebt) continue;
      const dx = q.x - p.x,
        dy = q.y - p.y,
        d = Math.hypot(dx, dy);
      if (
        d < reichweite &&
        (dx * Math.cos(p.winkel) + dy * Math.sin(p.winkel)) / Math.max(1, d) >
          0.35
      ) {
        q.vx += Math.cos(p.winkel) * kraft * (q.anker ? 0.2 : 1);
        q.vy += Math.sin(p.winkel) * kraft * (q.anker ? 0.2 : 1);
      }
    }
    p.vx -= Math.cos(p.winkel) * 35;
    p.vy -= Math.sin(p.winkel) * 35;
  }
  sicht() {
    return {
      phase: this.phase,
      zeit: this.zeit,
      runde: this.runde,
      radius: this.radius,
      warnung: this.warnung,
      gewinner: this.gewinner,
      spieler: this.spieler,
      effekte: this.effekte,
      geschosse: this.geschosse,
      fund: this.fund,
    };
  }
}
