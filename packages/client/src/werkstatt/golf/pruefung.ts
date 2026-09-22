/**
 * Die Prüfung in der Werkstatt: dieselben zwei Prüfungen wie im Vitest über
 * den Katalog, dazu die Grenzen, an denen die Katalogtests sonst erst im Pull
 * Request rot würden.
 *
 * Seit dem 22.09.2026. Nichts hier prüft selbst Geometrie — `pruefeKarte`
 * und `botLoestKarte` aus `karten-pruefen.ts` sind die einzige Wahrheit
 * darüber, ob eine Bahn taugt. Eine zweite, „schnellere" Prüfung in der
 * Werkstatt wäre genau die Stelle, an der eine Bahn hier grün und in der CI
 * rot ist.
 */

import { vergissWegfelder } from '../../minispiele/golf/bot';
import { type Karte, vergissSegmente } from '../../minispiele/golf/karte';
import { botLoestKarte, pruefeKarte } from '../../minispiele/golf/karten-pruefen';
import { type Befund, ordneBefunde } from './modell';

export interface Botbefund {
  geloest: boolean;
  schlaege: number;
  takte: number;
}

export interface Pruefergebnis {
  /** Befunde von `pruefeKarte`, den Objekten zugeordnet. Leer = in Ordnung. */
  befunde: Befund[];
  /** Nur, wenn die Geometrie stimmt — sonst sagt der Bot nichts Neues. */
  bot: Botbefund | null;
  /**
   * Was die Katalogtests (`karten/k01-k10.test.ts` usw.) zusätzlich
   * verlangen und `pruefeKarte` nicht prüft: Der Genie-Bot muss in höchstens
   * `par + 2` Schlägen einlochen, sonst ist das Par unehrlich gesetzt. Dazu
   * Werte, die die Physik zwar annimmt, aber anders meint.
   */
  hinweise: string[];
  /**
   * Gesetzt, wenn die Bahn die Kennung einer VORHANDENEN Katalogbahn trägt,
   * aber anders rollt als sie — dann bricht sie laufende Partien (siehe
   * `geometrieBruch`). Eine solche Bahn ist nie katalogreif.
   */
  bruch: Geometriebruch | null;
}

export interface Geometriebruch {
  /** Kennung der Katalogbahn, deren Geometrie sich geändert hat. */
  id: string;
  /** Welche Felder anders sind — für die Meldung. */
  felder: string[];
}

/**
 * Die Felder, die die Simulation liest (physik.ts, bot.ts, karte.ts). Von den
 * Abschlägen nur der erste: Alle Bälle starten dort (`starteLoch`), die
 * weiteren sind Doku. `par`, `name`, `dekor` und die freien Angaben
 * ändern das Bild, nicht den Lauf einer Partie.
 */
const GEOMETRIE = ['breite', 'hoehe', 'schlagLimit', 'zeitLimitS', 'loch', 'waende', 'zonen'] as const;

/** Tiefer Vergleich ohne Rücksicht auf die Schlüsselfolge — die Werkstatt ordnet beim Verschieben um. */
function gleich(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => gleich((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Hat die Bahn die Kennung einer Katalogbahn, rollt aber anders?
 *
 * Seit #206 (22.09.2026) steht in jeder laufenden Partie die Bahnfolge als
 * KENNUNGEN im Zustand, und jedes Gerät löst sie gegen seinen eigenen Katalog
 * auf. Zwei Stände mit derselben Kennung und verschiedener Wand rechnen aus
 * derselben Schlagliste verschiedene Partien — das Ergebnis wird strittig,
 * ohne dass irgendwo ein Fehler steht (docs/GOLF-PLAN.md, „Jede
 * Physikänderung ist ein Protokollbruch"). Deshalb gilt: Eine vorhandene Bahn
 * wird nicht umgebaut, sondern als neue Bahn mit neuer Kennung angelegt und
 * die alte Datei entfernt.
 */
export function geometrieBruch(bahn: Karte, katalog: readonly Karte[]): Geometriebruch | null {
  const alt = katalog.find((k) => k.id === bahn.id);
  if (alt === undefined) return null;
  const felder: string[] = GEOMETRIE.filter((f) => !gleich(bahn[f], alt[f]));
  if (!gleich(bahn.abschlaege[0], alt.abschlaege[0])) felder.push('Abschlag 0');
  return felder.length === 0 ? null : { id: bahn.id, felder };
}

/** Die Warnung, wie sie im Panel steht. */
export function bruchZeile(b: Geometriebruch): string {
  return (
    `Geometrie der vorhandenen Bahn ${b.id} geändert (${b.felder.join(', ')}): Das bricht laufende Partien, ` +
    'weil jedes Gerät die Kennung gegen seinen eigenen Katalog auflöst. Neue Kennung vergeben statt die Bahn zu ändern.'
  );
}

/**
 * Prüft eine Bahn gegen den Katalog.
 *
 * `herkunft` ist die Kennung der Katalogbahn, aus der die Arbeit stammt: Die
 * zählt beim Doppeltest nicht mit, sonst meldete jede geladene Bahn „Kennung
 * kommt 2-mal vor", obwohl man genau sie bearbeitet.
 *
 * Vorher werden die Zwischenspeicher von Physik und Wegsuche geleert. Die
 * hängen am Kartenobjekt, und die Werkstatt erzeugt bei jedem Handgriff ein
 * neues — ohne das wüchsen beide Speicher mit jeder Mausbewegung. Leeren ist
 * gefahrlos: Der Inhalt ist eine reine Funktion der Karte und wird beim
 * nächsten Zugriff neu gerechnet (siehe `segmenteVon`, `wegfeld`).
 */
export function pruefe(bahn: Karte, katalog: readonly Karte[], herkunft: string | null): Pruefergebnis {
  vergissSegmente();
  vergissWegfelder();
  const alle = [...katalog.filter((k) => k.id !== herkunft), bahn];
  const befunde = ordneBefunde(pruefeKarte(bahn, alle));
  const hinweise: string[] = [];

  bahn.zonen.forEach((z, i) => {
    if (z.art === 'beschleuniger' || z.art === 'sprungfeld') {
      const l = Math.sqrt(z.rx * z.rx + z.ry * z.ry);
      // Der Beschleuniger rechnet `rx * staerke` — ohne Einheitsvektor ist die
      // Stärke nicht die, die im Panel steht.
      if (Math.abs(l - 1) > 0.01) hinweise.push(`Zone ${i} (${z.art}): Richtung hat Länge ${l.toFixed(3)}, gemeint ist 1`);
    }
    if (z.art === 'drehkreuz' && (!Number.isInteger(z.gradJeTakt) || !Number.isInteger(z.phase))) {
      hinweise.push(`Zone ${i} (drehkreuz): Grad müssen ganze Zahlen sein (Winkeltabellen)`);
    }
  });

  let bot: Botbefund | null = null;
  if (befunde.length === 0) {
    bot = botLoestKarte(bahn, 'genie');
    if (bot.geloest && bot.schlaege > bahn.par + 2) {
      hinweise.unshift(
        `Genie-Bot braucht ${bot.schlaege} Schläge, der Katalogtest erlaubt höchstens par + 2 = ${bahn.par + 2}`,
      );
    }
  }
  const bruch = geometrieBruch(bahn, katalog);
  // Schwierigkeit steht doppelt, hier und in `BAHNEN_KATALOG` des Moduls; der
  // Vertrag `vertrag/golf-bahnen.test.ts` verlangt, dass beide gleich sind.
  const alt = katalog.find((k) => k.id === bahn.id);
  if (alt !== undefined && alt.schwierigkeit !== bahn.schwierigkeit) {
    hinweise.push(
      `Schwierigkeit ${alt.schwierigkeit} → ${bahn.schwierigkeit}: auch in BAHNEN_KATALOG (packages/game-golf/src/bahnen.ts) ändern`,
    );
  }
  return { befunde, bot, hinweise, bruch };
}

/** Die Zeile für den Bot, so wie sie im Panel steht. */
export function botZeile(bahn: Karte, bot: Botbefund | null): string {
  if (bot === null) return 'Bot wartet, bis die Geometrie stimmt';
  if (!bot.geloest) return `Genie-Bot locht NICHT ein (${bot.schlaege} Schläge, ${bot.takte} Takte)`;
  const zuViel = bot.schlaege > bahn.schlagLimit ? ` — über dem Schlaglimit ${bahn.schlagLimit}` : '';
  return `Genie-Bot löst in ${bot.schlaege} ${bot.schlaege === 1 ? 'Schlag' : 'Schlägen'} (par ${bahn.par})${zuViel}`;
}

/** Besteht die Bahn alles, was der Katalog verlangt? */
export function katalogreif(bahn: Karte, e: Pruefergebnis): boolean {
  return (
    e.bruch === null &&
    e.befunde.length === 0 &&
    e.bot !== null &&
    e.bot.geloest &&
    e.bot.schlaege <= bahn.schlagLimit &&
    e.bot.schlaege <= bahn.par + 2
  );
}
