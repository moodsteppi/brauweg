/**
 * Zusatzpakete: Spielinhalt, der Geld (Muenzen oder Edelsteine) kostet.
 *
 * Robins Entscheidung vom 22.09.2026 (S3): **Der Grundbestand bleibt frei,
 * besondere Kurse und Themenpakete sind kaufbar.** Bis hierher war alles im
 * Shop rein kosmetisch (`kosmetik.ts`: „Kosmetik veraendert nie das Spiel");
 * das hier ist die erste Ware mit Spielinhalt. Sie aendert trotzdem nichts
 * an Sieg oder Niederlage — ein Kurs ist eine andere Bahnfolge, kein
 * staerkerer Schlaeger. Pay-to-win bleibt draussen.
 *
 * **Diese Liste ist die EINE Stelle, die sagt, was kostet.** Was hier nicht
 * steht, ist frei — auch jeder Kurs und jedes Paket, das spaeter dazukommt.
 * Das ist die sichere Richtung: Ein vergessener Eintrag verschenkt etwas, ein
 * falscher sperrte einen Tisch, den bisher jeder aufmachen konnte.
 *
 * Wie ueberall im Shop kennt der Server nur Kennung und Preis. Was ein Kurs
 * ist, weiss das Spielmodul; hier steht nur, WELCHES Feld im Regelsatz
 * WELCHEN Wert traegt, wenn das Paket benutzt wird. Damit bleibt
 * `tables/service.ts` spielblind: Es fragt `bezahlpaketeIm(gameId, config)`
 * und muss nicht wissen, dass Golf `kurs` sagt und die Partykiste `paket`.
 * `test/inhaltspakete.test.ts` haelt jeden Eintrag gegen das Modul — ein
 * vertippter Wert kostete sonst nichts, weil ihn kein Regelsatz je traegt.
 *
 * Der Besitz liegt, wie alle Tischware, in `account_cosmetic` mit freier
 * Kennung (`golf-kurs-profi`, `party-paket-jga`) — keine Migration.
 */

import type { GameId } from '@brauweg/game-api';

import type { Seltenheit } from './kosmetik.js';

export interface Inhaltspaket {
  /** Das Spiel, dessen Regelsatz das Paket traegt. */
  readonly spiel: GameId;
  /** Das Feld im Regelsatz, z. B. `kurs` (Golf) oder `paket` (Partykiste). */
  readonly feld: string;
  /** Der Wert in diesem Feld — die Kennung im Modul. Nie aendern, sie steht in alten Tischen. */
  readonly wert: string;
  /** Vorsilbe der Warenkennung; haelt Golf und Partykiste im Besitz auseinander. */
  readonly praefix: 'golf-kurs' | 'party-paket';
  /** Gepflegt wird der Muenzpreis, der Edelsteinpreis folgt dem Kurs (`tischware.ts`). */
  readonly muenzen: number;
  readonly seltenheit: Seltenheit;
}

/**
 * Die kostenpflichtigen Pakete.
 *
 * VORSCHLAG — Robin legt fest, welche und zu welchem Preis. Die Auswahl
 * folgt seiner Vorgabe: je Spiel zwei, der Rest bleibt frei. Bei Golf die
 * zwei „besonderen" Kurse (Profi: die schwersten neun; Flipperhalle: die
 * Bahn spielt mit), bei der Partykiste zwei Anlaesse, fuer die man die Kiste
 * eigens aufmacht (JGA, Weihnachten). Frei bleiben Anfaengerrunde,
 * Wuestentour, Eiszeit, Wasserspiele, Nachtkurs sowie WG-Abend, Studenten
 * und Arbeit — genug, dass niemand ohne Kauf vor einem leeren Menue steht.
 *
 * Die Preise (VORSCHLAG, Robin legt fest) liegen im Band der Kartenblaetter
 * (600–2000): Ein Kurs ist ein ganzes Match Inhalt, mehr als eine Szenerie
 * (250–900), aber nichts, was man am Tisch dauernd sieht.
 */
export const BEZAHLPAKETE: readonly Inhaltspaket[] = [
  { spiel: 'golf', feld: 'kurs', wert: 'flipperhalle', praefix: 'golf-kurs', muenzen: 800, seltenheit: 'selten' },
  { spiel: 'golf', feld: 'kurs', wert: 'profi', praefix: 'golf-kurs', muenzen: 1200, seltenheit: 'episch' },
  { spiel: 'partykiste', feld: 'paket', wert: 'weihnachten', praefix: 'party-paket', muenzen: 600, seltenheit: 'gewoehnlich' },
  { spiel: 'partykiste', feld: 'paket', wert: 'jga', praefix: 'party-paket', muenzen: 800, seltenheit: 'selten' },
];

/** Die Warenkennung, wie sie in `account_cosmetic` steht. */
export function inhaltspaketId(paket: Inhaltspaket): string {
  return `${paket.praefix}-${paket.wert}`;
}

/**
 * Die Bezahlpakete, die dieser Regelsatz benutzt. Leer fuer alles Freie.
 *
 * Wirft nie: Der Regelsatz kommt als JSON von aussen und ist hier noch
 * nicht vom Modul geprueft. Was kein Objekt ist, benutzt nichts — abweisen
 * ist Sache von `validateConfig`.
 */
export function bezahlpaketeIm(spiel: string, config: unknown): Inhaltspaket[] {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return [];
  const felder = config as Record<string, unknown>;
  return BEZAHLPAKETE.filter((p) => p.spiel === spiel && felder[p.feld] === p.wert);
}
