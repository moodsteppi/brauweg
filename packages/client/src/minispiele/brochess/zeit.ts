/**
 * Zeitkontrollen für BroChess (Emile, 22.10.2026) — die Auswahl vor der
 * Partie, wie man sie von den großen Schachseiten kennt: Bullet, Blitz,
 * Rapid.
 *
 * Hier steht nur das ANGEBOT. Welche Werte erlaubt sind, prüft das Modul
 * (`pruefeRegeln` in packages/game-brochess/src/regeln.ts), gemessen wird im
 * Server. Die Liste ist eine Auswahl aus diesen erlaubten Werten.
 */

export type Zeitart = 'bullet' | 'blitz' | 'rapid';

export interface Zeitkontrolle {
  /** Merkname, z. B. „3+2". Bleibt stabil, damit die gemerkte Wahl passt. */
  readonly id: string;
  readonly art: Zeitart;
  readonly minuten: number;
  readonly zuschlagS: number;
}

const k = (art: Zeitart, minuten: number, zuschlagS = 0): Zeitkontrolle => ({
  id: `${minuten}+${zuschlagS}`,
  art,
  minuten,
  zuschlagS,
});

/** In der Reihenfolge der Auswahl, je Art die geläufigsten zuerst. */
export const ZEITKONTROLLEN: readonly Zeitkontrolle[] = [
  k('bullet', 1),
  k('bullet', 1, 1),
  k('bullet', 2, 1),
  k('bullet', 0.5),
  k('bullet', 20 / 60, 1),
  k('blitz', 3),
  k('blitz', 3, 2),
  k('blitz', 5),
  k('blitz', 5, 5),
  k('blitz', 5, 2),
  k('rapid', 10),
  k('rapid', 15, 10),
  k('rapid', 30),
  k('rapid', 10, 5),
  k('rapid', 20),
  k('rapid', 60),
];

/** Vorgabe ohne gemerkte Wahl: zehn Minuten, die ruhigste Art zu beginnen. */
export const VORGABE_ZEIT = '10+0';

export const ARTNAME: Readonly<Record<Zeitart, string>> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
};

export function zeitkontrolle(id: string | null | undefined): Zeitkontrolle {
  return (
    ZEITKONTROLLEN.find((z) => z.id === id) ?? ZEITKONTROLLEN.find((z) => z.id === VORGABE_ZEIT)!
  );
}

/** Die Felder für den Regelsatz des Tisches. */
export function regelnFuer(z: Zeitkontrolle): { bedenkzeitMs: number; zuschlagMs: number } {
  return { bedenkzeitMs: Math.round(z.minuten * 60_000), zuschlagMs: z.zuschlagS * 1000 };
}

/** „10 min", „3 + 2", „30 Sek", „20 Sek + 1". */
export function zeitText(z: Zeitkontrolle): string {
  const grund = z.minuten < 1 ? `${Math.round(z.minuten * 60)} Sek` : `${z.minuten}`;
  if (z.zuschlagS > 0) return `${grund} + ${z.zuschlagS}`;
  return z.minuten < 1 ? grund : `${grund} min`;
}

/**
 * Restzeit an der Uhr. Unter 20 Sekunden mit Zehnteln — wie an jeder
 * Schachuhr, denn dort entscheidet jede Zehntel. Ab einer Stunde mit
 * Stunden.
 */
export function uhrText(ms: number): string {
  const rest = Math.max(0, ms);
  if (rest < 20_000) {
    const zehntel = Math.floor(rest / 100);
    return `0:${String(Math.floor(zehntel / 10)).padStart(2, '0')}.${zehntel % 10}`;
  }
  const sekunden = Math.ceil(rest / 1000);
  const h = Math.floor(sekunden / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  const s = sekunden % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
