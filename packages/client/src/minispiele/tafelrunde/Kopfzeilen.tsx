/**
 * Die beiden Kopfzeilen der Ruestkammer: die eigene Statuszeile und der
 * Brettkopf ueber einem fremden Brett.
 *
 * Sie standen bis zum 19.09.2026 zweimal da — einmal in
 * `screens/Tafelrunde.tsx` (dort sogar zweimal: Spieler- und Zuschauersicht)
 * und einmal in `proben/ruestkammer/ProbeRuestkammer.tsx`, jeweils von Hand
 * aufgebaut aus `.tr-statuszeile`, `.tr-wert` und `.tr-brettkopf`. Beim
 * Handy-Umbau am 06.09.2026 ist genau das passiert, wovor der Kopf der Probe
 * warnt: Der Tisch bekam die neue Zeile, die Probe behielt die alte — und die
 * Probe zeigte einen Bildschirm, den es nicht gibt. Brett, Bank,
 * Einheitenmarke und Ladenkarte sind seit #99 herausgeloest; das hier ist
 * dieselbe Reihe.
 *
 * DIE ZEILEN ENTSCHEIDEN NICHTS. Sie zaehlen kein Brett ab und rechnen keine
 * Schwelle: `belegt`, `feldplaetze` und die Synergiestaende kommen aus der
 * Sicht (siehe Kopf von screens/Tafelrunde.tsx). Was hier steht, ist
 * Anordnung.
 *
 * Die Masse der Werte stehen in styles.css (`.tr-wert`), die der Marken in
 * Synergien.module.css — der Chip des Nachbarn wird NICHT abgeschrieben,
 * beide Bauteile behalten ihr eigenes Stylesheet.
 */

import { AugeZeichen } from './Mitspieler';
import {
  type Markenkatalog,
  type Synergie,
  type Synergiestand,
  Fremdmarken,
  Synergieleiste,
} from './Synergien';
import { LebenZeichen } from './Zeichen';

/** Leere Staende als feste Kennung — sonst laeuft jeder Memo-Vergleich leer. */
const OHNE_SYNERGIEN: readonly Synergiestand[] = [];

/**
 * Die drei Chips der eigenen Statuszeile: Leben, Rang, Feldplaetze.
 *
 * `null` statt dieser Werte heisst „Kampf laeuft" — dann stehen in der Zeile
 * nur die Marken (siehe `Statuszeile`).
 */
export interface Eigenwerte {
  readonly leben: number;
  readonly level: number;
  readonly belegt: number;
  readonly feldplaetze: number;
}

/**
 * Die eigene Statuszeile: Werte und Marken in EINER Reihe.
 *
 * Bis zum 06.09.2026 waren das zwei Baender untereinander: ein Kasten mit
 * zwei grossen Kacheln (Leben, Rang/Feld) und darunter die Markenleiste. Auf
 * Robins Handybild (440 x 956, IMG_1047) kosteten fuenf kleine Angaben
 * zusammen 88 Pixel — Platz, der dem Brett und dem Laden fehlte.
 * Nebeneinander in einer Reihe sind es 22.
 *
 * Die Werte sehen aus wie die Markenchips daneben, weil sie dasselbe sind:
 * kurze Auskunft, kein Bedienfeld.
 *
 * Am Desktop haengt die Markenleiste seitlich statt hier — das entscheidet
 * allein Synergien.module.css, und weil sie sich dort selbst aus dem Fluss
 * nimmt (`position: fixed`), bleibt diese Reihe davon unberuehrt.
 */
export function Statuszeile({
  werte,
  staende,
  tabelle,
  katalog,
}: {
  /**
   * Leben, Rang und Feldplaetze — oder `null`, WAEHREND DER KAMPF LAEUFT.
   * Dort sind sie entbehrlich: Das eigene Leben steht ohnehin auf der eigenen
   * Kachel in der Mitspielerleiste darueber, und Rang wie Feldplaetze kann
   * man im Kampf weder aendern noch brauchen. Die Marken bleiben, denn wer
   * zusieht, plant schon die naechste Runde.
   */
  werte: Eigenwerte | null;
  staende: readonly Synergiestand[];
  tabelle: readonly Synergie[];
  /** Nur fuer die Traegerreihe im Markenblatt — wie bei der Leiste selbst. */
  katalog?: Markenkatalog;
}): React.JSX.Element {
  return (
    <div className="tr-statuszeile">
      {werte && (
        <header className="tr-kopf">
          <span className="tr-wert tr-wert-leben">
            <LebenZeichen />
            <strong>{werte.leben}</strong>
            <em>Leben</em>
          </span>
          <span className="tr-wert tr-wert-level">
            <em>Rang</em>
            <strong>{werte.level}</strong>
          </span>
          <span className="tr-wert tr-wert-feld">
            <strong>
              {werte.belegt}/{werte.feldplaetze} Feld
            </strong>
          </span>
        </header>
      )}
      <Synergieleiste staende={staende} tabelle={tabelle} katalog={katalog} />
    </div>
  );
}

/**
 * Der Kopf ueber einem fremden Brett: Name und Marken in EINER Zeile.
 *
 * Aus demselben Grund wie bei der Statuszeile: Zwei Zeilen Beiwerk ueber
 * einem Brett kosten am Handy 33 Pixel, nebeneinander 18.
 *
 * Das Auge vor dem Namen ist dasselbe Zeichen wie an der Kachel oben, die
 * gerade leuchtet. Es beantwortet die Frage, die Robin gestellt hat („was
 * passiert, wenn man oben einen antippt?"): Das hier ist das Brett, das du
 * dir ansiehst.
 */
export function Brettkopf({
  name,
  ausRunde = null,
  staende = OHNE_SYNERGIEN,
  tabelle,
  katalog,
}: {
  name: string;
  /**
   * In welcher Runde der Gegner ausgeschieden ist — dann steht es hinter dem
   * Namen. `null` heisst: lebt noch. Die Zuschauersicht reicht es nicht
   * durch, dort ist der Vermerk seit jeher weg.
   */
  ausRunde?: number | null;
  /** Fehlt das Feld in der Sicht (Tisch aus der Zeit davor), bleibt die Reihe leer. */
  staende?: readonly Synergiestand[];
  tabelle: readonly Synergie[];
  katalog?: Markenkatalog;
}): React.JSX.Element {
  return (
    <div className="tr-brettkopf">
      <h2 className="tr-bretttitel">
        <AugeZeichen />
        {name}
        {ausRunde !== null ? ' · ausgeschieden' : ''}
      </h2>
      {/* Womit der Gegner antritt — dieselben Zeichen und Zaehler wie in der
          eigenen Leiste. Ohne sie muesste man seine Figuren einzeln
          abzaehlen, um zu sehen, dass er auf sechs Waechter zugeht. Die
          Zahlen kommen aus SEINER Sicht; abgezaehlt wird auch hier nichts. */}
      <Fremdmarken
        staende={staende}
        tabelle={tabelle}
        katalog={katalog}
        beschriftung={`Marken von ${name}`}
      />
    </div>
  );
}
