import { TanksPartie, type TanksEingabe, type TanksSicht } from './partie.js';
import { botSchuss, type BotSchuss } from './bot.js';
import type { ArtiPrivat } from '../index.js';

export const SUCHE_MS = 30_000;
export const ONLINE_WAFFEN = [0, 1, 2] as const;
export type OnlineSpieler = {
  id: string;
  name: string;
  farbe: string;
  bot: boolean;
  verbunden: boolean;
  ohneBots: boolean;
};
export type OnlineStand = {
  art: 'stand';
  code: string;
  ich: string;
  host: string;
  offen: boolean;
  warte: number;
  botsErlaubt: boolean;
  spieler: OnlineSpieler[];
  partie: (Omit<TanksSicht, 'gelaende'> & { gelaende: number[] }) | null;
  privat: ArtiPrivat | null;
};
const FARBEN = ['#71e7cb', '#ffd36b', '#b6a2ff', '#ff94ad'];

/** Die Online-Arena benutzt dieselbe Physik wie BroRemote, aber der Server
 * besitzt Uhr, Eingaben und Ergebnis. Kein Handy muss Gastgeber bleiben. */
export class TanksOnlineRaum {
  readonly spieler: OnlineSpieler[] = [];
  host = '';
  partie: TanksPartie | null = null;
  private fehltSeit = new Map<string, number>();
  private botPlan: {
    zug: number;
    seit: number;
    schuss: BotSchuss | null;
  } | null = null;
  constructor(
    readonly code: string,
    readonly seed: number,
    readonly offen: boolean,
    public seit: number,
  ) {}
  get botsErlaubt(): boolean {
    return this.spieler.filter((p) => !p.bot).every((p) => !p.ohneBots);
  }
  hinzufuegen(id: string, name: string, ohneBots = false): boolean {
    if (
      this.partie ||
      this.spieler.length >= 4 ||
      this.spieler.some((p) => p.id === id)
    )
      return false;
    this.spieler.push({
      id,
      name: name.trim().slice(0, 20) || 'Bro',
      farbe: FARBEN.find((f) => !this.spieler.some((p) => p.farbe === f))!,
      verbunden: true,
      bot: false,
      ohneBots,
    });
    this.host ||= id;
    return true;
  }
  botWahl(id: string, wert: boolean): void {
    if (!this.partie) {
      const p = this.spieler.find((p) => p.id === id);
      if (p) p.ohneBots = wert;
    }
  }
  verbindung(id: string, da: boolean, jetzt: number): void {
    const p = this.spieler.find((p) => p.id === id);
    if (!p) return;
    p.verbunden = da;
    if (da) this.fehltSeit.delete(id);
    else {
      this.fehltSeit.set(id, jetzt);
      this.partie?.eingabe(id, { art: 'reset' });
    }
    if (!da && this.host === id)
      this.host = this.spieler.find((p) => p.verbunden && !p.bot)?.id ?? id;
  }
  entfernen(id: string): void {
    this.fehltSeit.delete(id);
    if (this.partie) {
      this.partie.aufgeben(id);
      const p = this.spieler.find((p) => p.id === id);
      if (p) p.verbunden = false;
    } else {
      const i = this.spieler.findIndex((p) => p.id === id);
      if (i >= 0) this.spieler.splice(i, 1);
    }
    if (this.host === id)
      this.host = this.spieler.find((p) => !p.bot && p.verbunden)?.id ?? '';
  }
  starten(id: string): boolean {
    if (this.offen || id !== this.host) return false;
    return this.beginnen();
  }
  private beginnen(): boolean {
    if (this.partie || !this.spieler.some((p) => !p.bot && p.verbunden))
      return false;
    // Getrennte Handys zählen nicht als Gegner. Sie behalten ihren Platz bis
    // zur kurzen Wiederverbindungsfrist; die Lobby startet in dieser Zeit nicht.
    if (this.spieler.some((p) => !p.verbunden)) return false;
    if (this.botsErlaubt)
      while (this.spieler.length < 4) {
        const i = this.spieler.length;
        this.spieler.push({
          id: `bot-${i}`,
          name: ['Bot Pip', 'Bot Fiete', 'Bot Nora', 'Bot Bruno'][i],
          farbe: FARBEN.find((f) => !this.spieler.some((p) => p.farbe === f))!,
          bot: true,
          verbunden: true,
          ohneBots: false,
        });
      }
    if (this.spieler.length < 2) return false;
    this.partie = new TanksPartie(this.spieler, this.seed, {
      modus: 'einzel',
      serie: 1,
      karte: this.seed % 5,
    });
    return true;
  }
  eingabe(id: string, zug: number, aktion: TanksEingabe): void {
    const s = this.partie?.sicht();
    if (!s || !this.spieler.some((p) => p.id === id && p.verbunden && !p.bot))
      return;
    if (aktion.art === 'reset') {
      this.partie!.eingabe(id, aktion);
      return;
    }
    if (zug !== s.zug || s.amZug !== id || s.phase !== 'zielen') return;
    if (
      (aktion.art === 'zielen' || aktion.art === 'feuer') &&
      !ONLINE_WAFFEN.includes(aktion.waffe as 0 | 1 | 2)
    )
      return;
    if (
      aktion.art === 'tanksitem' &&
      !['reparatur', 'schild'].includes(aktion.item)
    )
      return;
    this.partie!.eingabe(id, aktion);
  }
  /** Aufruf alle 50 ms, drei feste Physikschritte. */
  schritt(jetzt: number): void {
    for (const [id, seit] of this.fehltSeit)
      if (jetzt - seit >= (this.partie ? 45_000 : 15_000)) this.entfernen(id);
    if (
      !this.partie &&
      this.offen &&
      (this.spieler.length === 4 || jetzt - this.seit >= SUCHE_MS)
    )
      this.beginnen();
    const p = this.partie;
    if (!p) return;
    for (let i = 0; i < 3; i++) p.schritt();
    const s = p.sicht();
    if (
      s.phase !== 'zielen' ||
      !this.spieler.find((p) => p.id === s.amZug)?.bot
    )
      return;
    if (this.botPlan?.zug !== s.zug) {
      // Kompakte Auswahl auch für Bots; die begrenzte Suche läuft einmal je Zug.
      const sicht = {
        ...s,
        bros: s.bros.map((b) => ({
          ...b,
          munition: b.munition.map((n, i) => (i < 3 ? n : 0)),
        })),
      };
      this.botPlan = {
        zug: s.zug,
        seit: jetzt,
        schuss: botSchuss(sicht, 'leicht'),
      };
      if (this.botPlan.schuss)
        p.eingabe(s.amZug, { art: 'zielen', ...this.botPlan.schuss });
    } else if (jetzt - this.botPlan.seit >= 1500 && this.botPlan.schuss) {
      p.eingabe(s.amZug, { art: 'feuer', zug: s.zug, ...this.botPlan.schuss });
    }
  }
  sicht(id: string, jetzt: number): OnlineStand {
    const s = this.partie?.sicht();
    return {
      art: 'stand',
      code: this.code,
      ich: id,
      host: this.host,
      offen: this.offen,
      warte: Math.max(0, Math.ceil((this.seit + SUCHE_MS - jetzt) / 1000)),
      botsErlaubt: this.botsErlaubt,
      spieler: this.spieler.map((p) => ({ ...p })),
      partie: s ? { ...s, gelaende: Array.from(s.gelaende) } : null,
      privat: this.partie?.privatFuer(id) ?? null,
    };
  }
}
