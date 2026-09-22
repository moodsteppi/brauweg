/**
 * Eingabe: Daumen-Joystick und Tastatur → Richtungen und Knöpfe.
 *
 * Ohne DOM und ohne React, damit sich genau die Rechnungen prüfen lassen, die
 * man am Bildschirm nicht sieht: eine Richtung, die nicht ganz die Länge eins
 * hat (der Server weist sie ab), eine Totzone, die zu klein ist (der Koch
 * zittert), und die Frage, welche Taste zu welchem Koch gehört.
 *
 * **Richtungen sind gerundete Einheitsvektoren, keine Winkel.** Vier
 * Nachkommastellen, weil das Modul genau diese Länge durchlässt und weil
 * `Math.atan2` zwischen Safari und V8 in der letzten Stelle abweichen kann —
 * und jede Abweichung läuft in der Küche über Stöße auseinander.
 */

/** Ab dieser Auslenkung (in Bildpunkten) zählt der Joystick als bewegt. */
export const TOTZONE = 12;
/** Bei dieser Auslenkung ist der Stick voll ausgefahren. */
export const STICK_RADIUS = 56;

export interface Richtung {
  readonly dx: number;
  readonly dy: number;
}

export const STEHT: Richtung = { dx: 0, dy: 0 };

function runde4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Macht aus einer Auslenkung eine Richtung: Länge eins oder Stillstand.
 *
 * Keine halbe Geschwindigkeit bei halber Auslenkung — das Modul ließe sie
 * gar nicht durch (`richtungUngueltig`), und in einer engen Küche will man
 * ohnehin entweder laufen oder stehen.
 */
export function normiere(dx: number, dy: number, totzone = TOTZONE): Richtung {
  const laenge = Math.sqrt(dx * dx + dy * dy);
  // Die Null zuerst, und zwar unabhängig von der Totzone: Mit `totzone = 0`
  // ist `laenge < totzone` falsch, und die Division darunter ergäbe NaN. Das
  // Modul wiese die Eingabe als `richtungUngueltig` ab — ohne Meldung, der
  // Koch bliebe einfach stehen.
  if (laenge === 0 || laenge < totzone) return STEHT;
  return { dx: runde4(dx / laenge), dy: runde4(dy / laenge) };
}

/** Zwei Richtungen, wie sie über die Leitung gehen — reicht für einen Vergleich. */
export function gleich(a: Richtung, b: Richtung): boolean {
  return a.dx === b.dx && a.dy === b.dy;
}

export interface Tastenbelegung {
  readonly hoch: readonly string[];
  readonly runter: readonly string[];
  readonly links: readonly string[];
  readonly rechts: readonly string[];
  readonly greifen: readonly string[];
  readonly werken: readonly string[];
  readonly spurt: readonly string[];
}

/**
 * Koch 1 am Rechner: WASD, Leertaste, E. Der Spurt liegt auf der
 * Umschalttaste — doppeltes Antippen der Laufrichtung wäre am Handy richtig,
 * an der Tastatur nur schwer zu treffen.
 */
export const BELEGUNG_LINKS: Tastenbelegung = {
  hoch: ['KeyW'],
  runter: ['KeyS'],
  links: ['KeyA'],
  rechts: ['KeyD'],
  greifen: ['Space'],
  werken: ['KeyE'],
  spurt: ['ShiftLeft'],
};

/** Koch 2 am selben Rechner: Pfeiltasten, Enter, Block-0. */
export const BELEGUNG_RECHTS: Tastenbelegung = {
  hoch: ['ArrowUp'],
  runter: ['ArrowDown'],
  links: ['ArrowLeft'],
  rechts: ['ArrowRight'],
  greifen: ['Enter', 'NumpadEnter'],
  werken: ['Numpad0', 'ControlRight'],
  spurt: ['ShiftRight'],
};

/** Alle Tasten, die das Spiel benutzt — der Bildschirm hält damit die Seite ruhig. */
export function belegteTasten(belegungen: readonly Tastenbelegung[]): Set<string> {
  const tasten = new Set<string>();
  for (const b of belegungen) {
    for (const liste of [b.hoch, b.runter, b.links, b.rechts, b.greifen, b.werken, b.spurt]) {
      for (const t of liste) tasten.add(t);
    }
  }
  return tasten;
}

function irgendeine(gedrueckt: ReadonlySet<string>, tasten: readonly string[]): boolean {
  return tasten.some((t) => gedrueckt.has(t));
}

/**
 * Richtung aus gedrückten Tasten. Gegensätzliche heben sich auf — wer links
 * und rechts zugleich hält, steht; alles andere wäre eine Frage der
 * Tastaturbauart.
 */
export function tastenRichtung(gedrueckt: ReadonlySet<string>, b: Tastenbelegung): Richtung {
  const x = (irgendeine(gedrueckt, b.rechts) ? 1 : 0) - (irgendeine(gedrueckt, b.links) ? 1 : 0);
  const y = (irgendeine(gedrueckt, b.runter) ? 1 : 0) - (irgendeine(gedrueckt, b.hoch) ? 1 : 0);
  if (x === 0 && y === 0) return STEHT;
  // Diagonal: auf Länge eins bringen, sonst liefe man schräg schneller.
  return normiere(x, y, 0);
}

export function taste(gedrueckt: ReadonlySet<string>, b: Tastenbelegung, welche: 'greifen' | 'werken' | 'spurt'): boolean {
  return irgendeine(gedrueckt, b[welche]);
}

/** Ein Daumen auf dem Bildschirm: Wo er aufsetzte und wo er jetzt ist. */
export interface Stick {
  readonly zeiger: number;
  readonly ursprungX: number;
  readonly ursprungY: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Die Richtung eines Sticks. Der Ursprung ist die Stelle, an der der Daumen
 * aufsetzte — nicht die Mitte eines festen Kreises: Auf einem Handy trifft
 * niemand blind dieselbe Stelle, und ein fester Kreis kostet jedes Mal einen
 * Blick nach unten.
 */
export function stickRichtung(s: Stick | null): Richtung {
  if (s === null) return STEHT;
  return normiere(s.x - s.ursprungX, s.y - s.ursprungY);
}

/** Wie weit der Stick ausgefahren ist (0…1) — nur für die Anzeige. */
export function stickWeg(s: Stick | null): number {
  if (s === null) return 0;
  const dx = s.x - s.ursprungX;
  const dy = s.y - s.ursprungY;
  const laenge = Math.sqrt(dx * dx + dy * dy);
  return laenge > STICK_RADIUS ? 1 : laenge / STICK_RADIUS;
}

/**
 * Doppeltipp als Spurt: Zwei Berührungen derselben Hälfte innerhalb dieser
 * Zeit. Länger, und jedes hektische Nachfassen wäre ein Spurt.
 */
export const DOPPELTIPP_MS = 260;

export function istDoppeltipp(letzterTippMs: number, jetztMs: number): boolean {
  return jetztMs - letzterTippMs <= DOPPELTIPP_MS;
}
