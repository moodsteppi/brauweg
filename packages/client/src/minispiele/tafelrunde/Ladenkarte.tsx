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
 *
 * DIE KARTE IST EINE SCHALTFLAECHE, und darin darf kein zweiter Knopf stehen
 * (ungueltiges HTML, und er stuerbe den Kauf-Tipp). Die Auskunft, was die
 * angebotene Einheit kann und was ihre Marken tun, haengt deshalb seit dem
 * 18.09.2026 an einem Griff DANEBEN: `onBlatt` schlaegt das Einheitenblatt
 * auf. Die Karte sitzt dafuer in einer Huelle, der Griff in ihrer linken
 * oberen Ecke — gegenueber dem Preis.
 *
 * ZWEITER WEG: ein langer Druck auf die Karte selbst. Er ist der bequeme und
 * NICHT der verlaessliche — eine gesperrte Karte (kein Gold, Kampfphase)
 * bekommt gar keine Zeigerereignisse, und ausgerechnet dort will man sich
 * erkundigen. Genau dafuer gibt es den sichtbaren Griff, der auch mit der
 * Tastatur erreichbar ist.
 */

import { useEffect, useRef } from 'react';

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
  onBlatt,
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
  /**
   * Das Blatt der angebotenen Einheit aufschlagen — Werte, Marken, und von
   * dort das Blatt einer Marke. Fehlt der Haken, bleibt die Karte, was sie
   * war: nur ein Kauf.
   */
  onBlatt?: () => void;
}): React.JSX.Element {
  /*
   * Der lange Druck. `lang` merkt sich, dass er ausgeloest hat, damit der
   * Klick danach NICHT auch noch kauft: Ein Tipp, der ein Blatt aufschlaegt
   * und im selben Zug Gold ausgibt, waere die teuerste Fehlbedienung des
   * Spiels. Als Ref und nicht als Zustand — das Umschalten darf kein Bild
   * neu zeichnen, und der Klick kommt unmittelbar danach.
   */
  const lang = useRef(false);
  const uhr = useRef<number | null>(null);
  const stoppe = (): void => {
    if (uhr.current !== null) {
      window.clearTimeout(uhr.current);
      uhr.current = null;
    }
  };
  // Verschwindet die Karte waehrend des Drueckens (gekauft, Phasenwechsel),
  // liefe der Wecker sonst in ein abgeraeumtes Bauteil.
  useEffect(() => stoppe, []);

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
    /* Die Huelle traegt den Griff, damit er NEBEN der Schaltflaeche steht und
       nicht darin. Sie ist das Rasterfeld des Ladens; die Karte fuellt sie
       ganz aus (`.tr-karte-huelle` in styles.css). */
    <div className="tr-karte-huelle">
      <button
        type="button"
        className={trifft ? `tr-karte ${KARTE_TRIFFT}` : 'tr-karte'}
        disabled={!kaufbar}
        /* Der lange Druck. Er haengt an der KARTE und nicht an der Huelle: Eine
           gesperrte Schaltflaeche schickt keine Zeigerereignisse, und dort ist
           der Griff oben links ohnehin der bessere Weg. */
        onPointerDown={
          onBlatt
            ? () => {
                lang.current = false;
                stoppe();
                uhr.current = window.setTimeout(() => {
                  lang.current = true;
                  onBlatt();
                }, 450);
              }
            : undefined
        }
        onPointerUp={onBlatt ? stoppe : undefined}
        onPointerLeave={onBlatt ? stoppe : undefined}
        onPointerCancel={onBlatt ? stoppe : undefined}
        /* Sonst legt das Handy nach demselben langen Druck sein eigenes Menue
           ueber das Blatt, das gerade aufgegangen ist. */
        onContextMenu={onBlatt ? (e) => e.preventDefault() : undefined}
        data-verschmilzt={verschmilzt ? '' : undefined}
        /* Zu teuer heisst: gedaempft, nicht bloss gesperrt. Eine Karte, fuer
           die das Gold fehlt, soll man im Vorbeisehen ueberspringen koennen —
           eine, die nur gerade nicht dran ist (schon bereit, Kampfphase), sieht
           anders aus. Die Auskunft kommt aus `grund` und damit aus den Zahlen
           der Sicht; erklaeren die Zahlen die Sperre nicht, bleibt die Karte
           ruhig. */
        data-teuer={grund === 'gold' ? '' : undefined}
        style={{ '--tr-kosten': farbe } as React.CSSProperties}
        /* Nach einem langen Druck wird NICHT gekauft: Der Klick kommt beim
           Loslassen ohnehin noch, und das Blatt liegt da schon offen. */
        onClick={() => {
          if (lang.current) {
            lang.current = false;
            return;
          }
          onKauf();
        }}
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
      {/* Der Griff zum Blatt — gegenueber dem Preis, damit sich die beiden
          Ecken nicht ins Gehege kommen. Er sitzt AUSSERHALB der Karte, weil
          ein Knopf in einem Knopf ungueltiges HTML ist und den Kauf-Tipp
          stehlen wuerde. Und er bleibt bedienbar, wenn die Karte gesperrt ist:
          Wer gerade nicht kaufen kann, hat die meiste Zeit zum Nachlesen. */}
      {onBlatt && (
        <button
          type="button"
          className="tr-karte-info"
          aria-haspopup="dialog"
          aria-label={`${einheit.name} ansehen`}
          onClick={onBlatt}
        >
          {/* Gezeichnet und nicht geladen — dieselbe Bauart wie alle Zeichen
              dieses Spiels (Zeichen.tsx): Striche auf 24 x 24 in
              `currentColor`. */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.5M12 7.6h.01" />
          </svg>
        </button>
      )}
    </div>
  );
}
