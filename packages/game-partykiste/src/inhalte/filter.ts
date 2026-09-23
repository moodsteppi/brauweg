/**
 * Der eine Filter ueber alle Kataloge.
 *
 * Bis zum 22.09.2026 griff `baueRunde` an acht Stellen den vollen Katalog.
 * Mit Haerte, Paket und Sitzzahl waeren das acht Kopien derselben drei
 * Bedingungen geworden — und die neunte Stelle (die naechste Aufgabe, die
 * erst bei der Wahl gezogen wird) haette eine davon vergessen. Deshalb steht
 * die Auswahl hier einmal, und jede Ziehung geht durch sie hindurch.
 *
 * ZWEI REGELN, die nicht verhandelbar sind:
 *
 *   1. Die Reihenfolge der Auswahl ist die KATALOGREIHENFOLGE. Gemischt wird
 *      erst danach, mit dem Saatkorn. Wuerde der Filter umsortieren, zoege
 *      derselbe Tisch mit derselben Saat andere Fragen, sobald irgendwo ein
 *      Eintrag ein Paket bekommt.
 *   2. Die Haerte wird NIE gelockert. Alles andere darf zurueckfallen, wenn
 *      zu wenig uebrig bleibt — ein Tisch, der "harmlos" eingestellt hat,
 *      bekommt aber unter keinen Umstaenden einen derben Spruch, auch nicht,
 *      weil das Paket sonst leer waere.
 */

import type { PartykisteRegeln } from '../regeln.js';
import type { Haerte, Inhalt, Paket } from './typen.js';

/**
 * Unter so vielen passenden Inhalten faellt die Auswahl auf die naechste
 * weichere Stufe zurueck. Zehn: Bei fuenfzehn Runden kommt jedes der neun
 * Minispiele hoechstens zweimal — zehn Inhalte reichen also fuer ein ganzes
 * Turnier ohne Wiederholung, und wer ein einzelnes Minispiel fuenfzehnmal
 * spielt, sieht mit weniger als zehn dieselben Fragen zweimal.
 */
export const MINDESTMENGE = 10;

/**
 * Was der Filter vom Regelsatz braucht. Beides optional, weil auch ein
 * Regelsatz aus einem Snapshot von vor dem 22.09.2026 hier ankommt — der
 * kennt die Felder nicht und soll trotzdem spielen (harmlos, alles).
 */
export type InhaltsRegeln = Partial<Pick<PartykisteRegeln, 'inhaltsHaerte' | 'paket'>>;

/**
 * Die Stufen, in denen die Auswahl nachgibt — von streng nach weich.
 *
 *   paket              nur Inhalte, die das Paket tragen (das Motto)
 *   paketUndAllgemein  dazu Inhalte ohne Paket (die Zielgruppe: nichts,
 *                      was fuer ein ANDERES Paket gedacht ist)
 *   ohnePaket          das Paket wird ignoriert
 *   ohneMinSitze       auch die Sitzgrenze faellt — lieber ein Spruch, der
 *                      auf mehr Leute zielt, als eine Runde ohne Spruch.
 *                      DAS IST DER LETZTE HALT: Hier gilt nur noch die Haerte.
 *   vollerKatalog      GIBT ES NICHT MEHR (seit dem 23.09.2026). Bis dahin
 *                      nahm diese Stufe den ganzen Katalog, wenn auch
 *                      `ohneMinSitze` zu wenig hergab — also auch Derbes
 *                      fuer einen harmlosen Tisch, gegen Regel 2 oben. Im
 *                      Betrieb kam das nie vor (jeder Katalog traegt genug
 *                      Harmloses, ein Test haelt es fest), aber ein Katalog
 *                      mit zu wenig Harmlosem haette es still ausgeloest.
 *                      Jetzt wird statt dessen innerhalb der erlaubten Stufen
 *                      wiederholt (`an()` in partie.ts laeuft den gemischten
 *                      Stapel erst ganz durch), und ohne einen einzigen
 *                      erlaubten Eintrag ersetzt `baueRunde` das Minispiel
 *                      (`spielbaresMinispiel`). Die Kennung bleibt im Typ,
 *                      weil sie in Snapshots von davor stehen kann.
 */
export type AuswahlStufe = 'paket' | 'paketUndAllgemein' | 'ohnePaket' | 'ohneMinSitze' | 'vollerKatalog';

/**
 * Wenn die Auswahl nachgeben musste: welche Stufe gewollt war, welche es
 * wurde, und wie viele Inhalte auf der gewollten passten. Steht in der Runde
 * (`inhaltsRueckfall`), damit der Bildschirm es sagen kann — "zum Paket
 * passten nur drei Fragen, es spielt der ganze Vorrat".
 */
export interface InhaltsRueckfall {
  readonly gewollt: AuswahlStufe;
  readonly genutzt: AuswahlStufe;
  readonly passend: number;
}

export interface Auswahl<T> {
  /** In Katalogreihenfolge. Nie leer, solange der Katalog nicht leer ist. */
  readonly inhalte: readonly T[];
  /** null, wenn die strengste anwendbare Stufe gereicht hat. */
  readonly rueckfall: InhaltsRueckfall | null;
}

export function haerteVon(inhalt: Inhalt): Haerte {
  return inhalt.haerte ?? 1;
}

function passtHaerte(inhalt: Inhalt, grenze: Haerte): boolean {
  return haerteVon(inhalt) <= grenze;
}

function passtSitze(inhalt: Inhalt, sitze: number): boolean {
  return inhalt.minSitze === undefined || inhalt.minSitze <= sitze;
}

function traegtPaket(inhalt: Inhalt, paket: Paket): boolean {
  return inhalt.paket !== undefined && inhalt.paket.includes(paket);
}

function istAllgemein(inhalt: Inhalt): boolean {
  return inhalt.paket === undefined || inhalt.paket.length === 0;
}

function stufeAnwenden<T extends Inhalt>(
  katalog: readonly T[],
  stufe: AuswahlStufe,
  haerte: Haerte,
  paket: Paket | null,
  sitze: number,
): T[] {
  switch (stufe) {
    case 'paket':
      return katalog.filter(
        (i) => passtHaerte(i, haerte) && passtSitze(i, sitze) && paket !== null && traegtPaket(i, paket),
      );
    case 'paketUndAllgemein':
      return katalog.filter(
        (i) =>
          passtHaerte(i, haerte) &&
          passtSitze(i, sitze) &&
          (istAllgemein(i) || (paket !== null && traegtPaket(i, paket))),
      );
    case 'ohnePaket':
      return katalog.filter((i) => passtHaerte(i, haerte) && passtSitze(i, sitze));
    case 'ohneMinSitze':
      return katalog.filter((i) => passtHaerte(i, haerte));
    /* Nie mehr angesteuert (siehe AuswahlStufe) — und selbst dann nie ueber die Haerte. */
    case 'vollerKatalog':
      return katalog.filter((i) => passtHaerte(i, haerte));
  }
}

/**
 * Hat der Katalog ueberhaupt einen Eintrag bis zu dieser Haerte? Dasselbe
 * Mass wie die letzte Stufe von `waehlbareInhalte`: Ist das nein, ist die
 * Auswahl leer, egal mit welchem Paket und welcher Sitzzahl.
 */
export function hatErlaubtenVorrat(katalog: readonly Inhalt[], haerte: Haerte): boolean {
  return katalog.some((i) => passtHaerte(i, haerte));
}

/**
 * Die Inhalte eines Katalogs, die zu Regelsatz und Sitzzahl passen — in
 * Katalogreihenfolge, mindestens `mindestens` Stueck, wenn der Katalog das
 * irgendwie hergibt.
 *
 * Die Stufen werden von streng nach weich durchprobiert; genommen wird die
 * erste, die `mindestens` erreicht. Bleibt selbst die weichste darunter,
 * wird sie trotzdem genommen (kurz ist besser als leer — der Aufrufer
 * wiederholt dann innerhalb dessen, was die Haerte erlaubt). Die Haerte
 * lockert keine Stufe, auch nicht die letzte: Hat der Katalog unter der
 * Grenze gar nichts, ist die Auswahl LEER, und der Aufrufer muss damit
 * umgehen (`baueRunde` ersetzt dann das Minispiel, siehe
 * `spielbaresMinispiel`).
 *
 * Wirft nie. Ein Regelsatz mit Unsinn in `inhaltsHaerte` gilt als harmlos,
 * einer mit Unsinn in `paket` als "alles" — dieselbe Nachsicht wie in
 * `createParty`, denn hier kommen auch Snapshots alter Partien an.
 */
export function waehlbareInhalte<T extends Inhalt>(
  katalog: readonly T[],
  regeln: InhaltsRegeln,
  sitze: number,
  mindestens: number = MINDESTMENGE,
): Auswahl<T> {
  const haerte: Haerte =
    regeln.inhaltsHaerte === 1 || regeln.inhaltsHaerte === 2 || regeln.inhaltsHaerte === 3
      ? regeln.inhaltsHaerte
      : 1;
  const paket: Paket | null = typeof regeln.paket === 'string' ? regeln.paket : null;
  const grenze = Number.isFinite(sitze) ? sitze : 0;
  const ziel = Math.max(1, Math.floor(Number.isFinite(mindestens) ? mindestens : MINDESTMENGE));

  /* Ohne 'vollerKatalog': Die letzte Stufe filtert noch auf die Haerte (siehe AuswahlStufe). */
  const stufen: AuswahlStufe[] = paket
    ? ['paket', 'paketUndAllgemein', 'ohnePaket', 'ohneMinSitze']
    : ['ohnePaket', 'ohneMinSitze'];

  const gewollt = stufen[0]!;
  let passend = -1;
  let letzte: T[] = [];
  for (const stufe of stufen) {
    const treffer = stufeAnwenden(katalog, stufe, haerte, paket, grenze);
    if (passend < 0) passend = treffer.length;
    letzte = treffer;
    if (treffer.length >= ziel) {
      return {
        inhalte: treffer,
        rueckfall: stufe === gewollt ? null : { gewollt, genutzt: stufe, passend },
      };
    }
  }
  /* Auch die weichste Stufe blieb unter dem Ziel: nehmen, was da ist. */
  return {
    inhalte: letzte,
    rueckfall: stufen.length > 1 ? { gewollt, genutzt: stufen[stufen.length - 1]!, passend } : null,
  };
}
