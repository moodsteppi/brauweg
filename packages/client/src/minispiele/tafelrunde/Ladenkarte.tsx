/**
 * Die Karte im Laden — eine Einheit zum Kauf.
 *
 * Sie stand bis zum 06.09.2026 in screens/Tafelrunde.tsx und ist mit Brett
 * und Bank zusammen hierher gezogen (siehe Kopf von `Brett.tsx`): Die Probe
 * `/probe/ruestkammer` haengt sie ein, statt `.tr-karte` nachzubauen.
 *
 * Die Karte ENTSCHEIDET NICHTS. Ob gekauft werden darf, sagt `kaufbar`, und
 * das kommt aus `legalActions`; `grund` beschriftet nur eine schon gefallene
 * Absage. Und `verschmelzZahl` ist ein Wert aus der Sicht — hier stand die 3
 * einmal ausgeschrieben, und wer sie im Modul auf vier stellte, bekam eine
 * Karte, die "1 von 3" behauptet und bei drei Kopien nicht verschmilzt.
 */

import { KARTE_TRIFFT, Markenzeichen } from './Synergien';
import { EinheitenFigur, GoldZeichen, ROLLE_NAME, kostenFarbe } from './Zeichen';
import type { Einheit } from './sicht';

/**
 * Warum ein Kauf gerade nicht geht — die AUSKUNFT, nicht die Entscheidung.
 *
 * Ob gekauft werden darf, sagt allein `legalActions`. Dieser Wert wird erst
 * gebildet, wenn dort nichts steht, und beschriftet nur noch die schon
 * gefallene Absage. Andersherum waere es der Fehler, vor dem der Kopf von
 * screens/Tafelrunde.tsx warnt: Ein Client, der selbst entscheidet, zeigt
 * frueher oder spaeter einen Knopf, den der Server abweist.
 */
export type Kaufhindernis = 'gold' | 'bank' | null;

/**
 * Welcher der beiden Gruende gerade zutrifft.
 *
 * Beide Groessen stehen in der Sicht — das Gold und die Bank —, es wird also
 * keine Regel nachgerechnet, sondern eine Absage beschriftet, die
 * `legalActions` schon ausgesprochen hat. Die Reihenfolge ist Absicht: Fehlt
 * beides, wird das Gold genannt, denn daran laesst sich in derselben Runde
 * noch etwas aendern.
 *
 * Gibt bewusst `null` zurueck, wenn die Zahlen die Sperre NICHT erklaeren.
 * Dann steht der Grund woanders (Kampfphase, schon bereit, ausgeschieden),
 * und eine geratene Beschriftung waere schlimmer als keine.
 *
 * Als Funktion neben der Karte und nicht im Bildschirm, seit die Probe
 * `/probe/ruestkammer` dieselbe Auskunft braucht: Zwei Fassungen liefen beim
 * ersten geaenderten Preis auseinander, und die Probe zeigte dann eine
 * Beschriftung, die es am Tisch nicht gibt.
 */
export function kaufhindernis(
  gold: number,
  /**
   * Ist kein Bankplatz mehr frei? Eine volle Bank verbietet den Kauf nur,
   * wenn er nicht sofort verschmilzt — genau dann steht er aber in
   * `legalActions`, und diese Funktion laeuft gar nicht erst.
   */
  bankVoll: boolean,
  angeboten: Einheit | undefined,
): Kaufhindernis {
  if (!angeboten) return null;
  if (gold < angeboten.kosten) return 'gold';
  if (bankVoll) return 'bank';
  return null;
}

export function Ladenkarte({
  einheit,
  kaufbar,
  verschmilzt,
  fehlt,
  verschmelzZahl,
  marken,
  trifftSchwelle,
  grund,
  onKauf,
}: {
  einheit: Einheit | undefined;
  kaufbar: boolean;
  verschmilzt: boolean;
  fehlt: number;
  /** Wie viele Kopien verschmelzen — aus der Sicht, nie als 3 im Client. */
  verschmelzZahl: number;
  /** Die Klassen-Marken dieser Einheit (Katalog). Leer, solange er fehlt. */
  marken: string[];
  /** Wuerde ein Traeger dieser Marke eine Schwelle erreichen? Siehe Synergien.tsx. */
  trifftSchwelle: (marke: string) => boolean;
  /** Warum nicht kaufbar, falls die Zahlen der Sicht es erklaeren. */
  grund: Kaufhindernis;
  onKauf: () => void;
}): React.JSX.Element {
  if (!einheit) {
    // Gekauft oder Vorrat erschoepft. Ein leerer Rahmen statt einer Luecke:
    // Sonst rutscht der Laden bei jedem Kauf zusammen, und der Daumen trifft
    // die Karte daneben.
    return <div className="tr-karte tr-karte-leer" aria-hidden="true" />;
  }
  const farbe = kostenFarbe(einheit.kosten);
  /* Der Rahmen sagt "hier wird eine Schwelle voll", das leuchtende Zeichen
     darunter sagt welche. Genug fuer den Rahmen ist EINE Marke — eine Einheit
     traegt bis zu zwei. */
  const trifft = marken.some(trifftSchwelle);
  return (
    <button
      type="button"
      className={trifft ? `tr-karte ${KARTE_TRIFFT}` : 'tr-karte'}
      disabled={!kaufbar}
      data-verschmilzt={verschmilzt ? '' : undefined}
      /* Zu teuer heisst: gedaempft, nicht bloss gesperrt. Eine Karte, fuer
         die das Gold fehlt, soll man im Vorbeisehen ueberspringen koennen —
         eine, die nur gerade nicht dran ist (schon bereit, Kampfphase), sieht
         anders aus. Die Auskunft kommt aus `grund` und damit aus den Zahlen
         der Sicht; erklaeren die Zahlen die Sperre nicht, bleibt die Karte
         ruhig. */
      data-teuer={grund === 'gold' ? '' : undefined}
      style={{ '--tr-kosten': farbe } as React.CSSProperties}
      onClick={onKauf}
    >
      {/* Die Kostenmarke sitzt in der ECKE der Karte und nicht mehr neben der
          Figur: So steht sie bei allen fuenf Karten an derselben Stelle,
          egal wie lang der Name darunter ist. Rot, wenn das Gold nicht
          reicht. */}
      <span className="tr-karte-preis" data-teuer={grund === 'gold' ? '' : undefined}>
        <GoldZeichen />
        {einheit.kosten}
      </span>
      {/* Die KARTE bleibt eine Karte: Ein Rahmen um Name, Rolle und Preis ist
          richtig, weggenommen wurde nur die Platte unter der FIGUR. Und die
          Figur ist seit dem 6.9.2026 dieselbe wie auf dem Brett — wer eine
          Dorfwache kauft, soll sehen, was gleich auf seiner Wabe steht. */}
      <span className="tr-karte-kopf">
        <EinheitenFigur einheit={einheit} klasse="tr-figur3d-karte" />
      </span>
      <strong className="tr-karte-name">{einheit.name}</strong>
      <span className="tr-karte-rolle">{ROLLE_NAME[einheit.rolle]}</span>
      {/* Beschriftet, weil die Karte eine Schaltflaeche ist und ihren Namen
          aus dem Inhalt bezieht: "Dorfwache, Wache, Krieger" ist genau die
          Auskunft, die ein Vorlesegeraet fuer den Kauf braucht. */}
      <Markenzeichen marken={einheit.marken} trifft={trifftSchwelle} beschriftet ort="laden" />
      {/* Der Hinweis, der aus einem Kauf eine Entscheidung macht — und, wenn
          nichts zu entscheiden ist, der Grund dafuer. Der Grund steht vorn:
          Wer nicht kaufen kann, will zuerst wissen warum, und erst danach,
          dass es verschmolzen waere.

          Der Zaehler nennt `verschmelzZahl` und nicht "von 3". Hier stand
          die 3 einmal ausgeschrieben — wer sie im Modul auf vier stellte,
          bekam eine Karte, die "1 von 3" behauptet und bei drei Kopien nicht
          verschmilzt. */}
      {grund !== null ? (
        <span className="tr-karte-marke tr-karte-marke-hindernis">
          {grund === 'gold' ? 'Zu wenig Gold' : 'Bank voll'}
        </span>
      ) : verschmilzt ? (
        <span className="tr-karte-marke">verschmilzt!</span>
      ) : fehlt < verschmelzZahl ? (
        <span className="tr-karte-marke tr-karte-marke-leise">
          {verschmelzZahl - fehlt} von {verschmelzZahl}
        </span>
      ) : null}
    </button>
  );
}
