/**
 * Vom gefilterten Katalog zum Stapel einer Partie — je nach Lesart der
 * Inhaltsstufe (`PartykisteRegeln.inhaltsMischung`, seit dem 27.09.2026).
 *
 * Der Filter (filter.ts) liefert nur Mengen in Katalogreihenfolge und mischt
 * nie. Hier wird gemischt, und zwar immer mit dem Saatkorn der Partie und
 * `rundenSaat(saat, 0, zweck)` fuer den Hauptstapel: Jede Runde derselben Art
 * zieht aus DEMSELBEN Stapel an der naechsten Stelle (`an()` in partie.ts),
 * also wiederholt sich nichts, solange der Stapel reicht.
 *
 * Drei Lesarten:
 *
 *   bis       (Regelsatz ohne Feld, also von vor dem 27.09.2026) — alles bis
 *             zur Stufe, einmal gemischt. Wortgleich der Weg von davor,
 *             damit ein alter Snapshot dieselben Fragen weiterzieht.
 *   genau     erst alle Eintraege GENAU der Stufe, gemischt; dahinter die der
 *             naechst milderen, dann der mildesten. Hat „derb" zwoelf Fragen,
 *             spielen die ersten zwoelf Runden derb und erst danach pikant —
 *             das Ausweichen passiert nur, wenn die Stufe erschoepft ist, nie
 *             nach oben, und ohne Wiederholung, solange irgendeine erlaubte
 *             Stufe noch etwas hat.
 *   gemischt  je Stufe ein gemischter Stapel, und jede Stelle zieht per Saat
 *             eine STUFE (gleich wahrscheinlich unter denen, die noch etwas
 *             haben) und davon den naechsten Eintrag. Je Eintrag zu ziehen
 *             waere wieder die alte Obergrenze: Die Kataloge sind zu 60 %
 *             harmlos, und „gemischt" hiesse fast nur harmlos.
 *
 * Bei „harmlos" (Stufe 1) sind alle drei dasselbe, auch Stelle fuer Stelle —
 * darum geht Stufe 1 immer den alten Weg. Die Vorgabe (`DEFAULT_REGELN`) ist
 * harmlos; ein Tisch, der nie etwas gewaehlt hat, zieht also nach der
 * Umstellung dieselben Fragen wie davor.
 *
 * Die Eskalation geht nicht hier durch, sondern durch `stufenStapel`
 * (modi.ts): Sie belegt einen Stapel Platz fuer Platz mit der Stufe des
 * jeweiligen Drittels — das ist „genau" mit einer Stufe je Runde.
 */

import { inhaltsLesart, istHaerte } from '../regeln.js';
import { baueZufall, ganzzahl, gemischt, rundenSaat } from '../zufall.js';
import { MINDESTMENGE, waehlbareInhalte, type InhaltsRegeln, type InhaltsRueckfall } from './filter.js';
import type { Haerte, Inhalt } from './typen.js';

export interface InhaltsStapel<T> {
  /** Gemischt; Stelle `n` ist der Inhalt fuer die n-te Ziehung dieser Art. */
  readonly stapel: readonly T[];
  readonly rueckfall: InhaltsRueckfall | null;
}

/** Die Saat des Stapels einer MILDEREN Stufe — dieselbe Kette wie in `stufenStapel`. */
function milderSaat(saat: string, stufe: Haerte, zweck: string): string {
  return rundenSaat(saat, stufe, `${zweck}-milder`);
}

export function inhaltsStapel<T extends Inhalt>(
  katalog: readonly T[],
  regeln: InhaltsRegeln,
  saat: string,
  sitze: number,
  zweck: string,
  mindestens: number = MINDESTMENGE,
): InhaltsStapel<T> {
  const lesart = inhaltsLesart(regeln);
  const haerte: Haerte = istHaerte(regeln.inhaltsHaerte) ? regeln.inhaltsHaerte : 1;
  const paket = regeln.paket ?? null;

  if (lesart === 'bis' || haerte === 1) {
    /* Der alte Weg — ausdruecklich OHNE `inhaltsMischung`, damit der Filter bis zur Stufe liest. */
    const auswahl = waehlbareInhalte(katalog, { inhaltsHaerte: haerte, paket }, sitze, mindestens);
    return {
      stapel: gemischt(auswahl.inhalte, baueZufall(rundenSaat(saat, 0, zweck))),
      rueckfall: auswahl.rueckfall,
    };
  }

  /* Je Stufe von der gewollten abwaerts: genau diese Stufe, mit dem weichen Paket-Rueckfall. */
  const stufen: { stufe: Haerte; liste: T[]; rueckfall: InhaltsRueckfall | null; passend: number }[] = [];
  for (let stufe = haerte; stufe >= 1; stufe--) {
    const s = stufe as Haerte;
    const auswahl = waehlbareInhalte(katalog, { inhaltsHaerte: s, paket, inhaltsMischung: 'genau' }, sitze, mindestens);
    const zufall = baueZufall(s === haerte ? rundenSaat(saat, 0, zweck) : milderSaat(saat, s, zweck));
    stufen.push({ stufe: s, liste: gemischt(auswahl.inhalte, zufall), rueckfall: auswahl.rueckfall, passend: auswahl.inhalte.length });
  }
  const oben = stufen[0]!;

  if (lesart === 'genau') {
    const ziel = Math.max(1, Math.floor(Number.isFinite(mindestens) ? mindestens : MINDESTMENGE));
    const duenn = oben.passend < ziel;
    const rueckfall: InhaltsRueckfall | null = duenn
      ? {
          ...(oben.rueckfall ?? { gewollt: paket ? 'paket' : 'ohnePaket', genutzt: paket ? 'paket' : 'ohnePaket', passend: oben.passend }),
          stufeDuenn: { stufe: haerte, passend: oben.passend },
        }
      : oben.rueckfall;
    return { stapel: stufen.flatMap((s) => s.liste), rueckfall };
  }

  /* gemischt: Stelle fuer Stelle eine Stufe ziehen, dann deren naechsten Eintrag. */
  const zufall = baueZufall(rundenSaat(saat, 0, `${zweck}-stufen`));
  const zeiger = stufen.map(() => 0);
  const stapel: T[] = [];
  for (;;) {
    const offen = stufen.map((_, i) => i).filter((i) => zeiger[i]! < stufen[i]!.liste.length);
    if (offen.length === 0) break;
    const i = offen[ganzzahl(zufall, offen.length)]!;
    stapel.push(stufen[i]!.liste[zeiger[i]!]!);
    zeiger[i] = zeiger[i]! + 1;
  }
  return { stapel, rueckfall: stufen.find((s) => s.rueckfall !== null)?.rueckfall ?? null };
}
