import type { Spieler, TanksOptionen } from '@brauweg/broremote-kern';
import { TanksPartie, type TanksSicht } from './partie';
/** Seriensiege gehören dem Spieler bzw. seinem Team, nicht einzelnen ausgeschiedenen Panzern. */
export class TanksSerie {
  runde = 1;
  readonly siege = new Map<string, number>();
  private gewertet = 0;
  fertig = false;
  gewinner: string[] = [];
  constructor(readonly spieler: readonly Spieler[], readonly seed: number, readonly optionen: TanksOptionen) {}
  private schluessel(id: string): string { return this.optionen.modus === 'team' ? `team-${this.spieler.find(b=>b.id===id)!.team}` : id; }
  siegeVon(id: string): number { return this.siege.get(this.schluessel(id)) ?? 0; }
  partie(): TanksPartie { return new TanksPartie(this.spieler, (this.seed + (this.runde-1)*7919) >>> 0, this.optionen, 1+(this.runde-1)*1000); }
  werten(s: TanksSicht): void {
    if (s.phase !== 'ende' || this.gewertet === this.runde) return;
    this.gewertet = this.runde;
    const sieger = [...new Set(s.gewinner.map(id=>this.schluessel(id)))];
    // Gleichstand bringt niemandem einen Seriensieg.
    if (sieger.length === 1 && s.grund !== 'gleichstand') this.siege.set(sieger[0], (this.siege.get(sieger[0]) ?? 0)+1);
    this.fertig = this.optionen.serie === 1 || this.runde >= 3 || [...this.siege.values()].some(n=>n>=2);
    if (this.fertig) {
      if (this.optionen.serie === 1) this.gewinner = s.grund === 'gleichstand' ? [] : [...s.gewinner];
      else { const max = Math.max(0,...this.siege.values()); const vorn = [...this.siege].filter(([,n])=>n===max).map(([id])=>id); this.gewinner = vorn.length===1 ? this.spieler.filter(b=>vorn.includes(this.schluessel(b.id))).map(b=>b.id) : []; }
    }
  }
  weiter(): boolean { if (this.fertig || this.gewertet!==this.runde) return false; this.runde++; return true; }
}
