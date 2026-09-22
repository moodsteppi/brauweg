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
  return { befunde, bot, hinweise };
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
    e.befunde.length === 0 &&
    e.bot !== null &&
    e.bot.geloest &&
    e.bot.schlaege <= bahn.schlagLimit &&
    e.bot.schlaege <= bahn.par + 2
  );
}
