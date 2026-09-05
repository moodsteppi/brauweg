/**
 * Eine Figur als Ausschnitt aus dem Blatt ihrer Rolle.
 *
 * DAS BAUTEIL FUER ALLE ORTE. Bis zum 6.9.2026 gab es die 3D-Figuren nur in
 * der Arena (KampfAnzeige.tsx), und auf Brett, Bank und Ladenkarte standen
 * weiter die 32er-Pixelbilder aus `figuren.ts`. Wer spielt, ist die meiste
 * Zeit in der Vorbereitung — der Bruch fiel also genau dort auf, wo man am
 * laengsten hinsieht. Seitdem zeichnen alle vier Orte dieselbe Figur, und
 * damit sie es auch morgen noch tun, steht sie hier und nicht zweimal.
 *
 * DER AUFBAU: ein Kasten mit `overflow: hidden`, darin das ganze Blatt,
 * sechsmal so breit und fuenfmal so hoch. Ohne Versatz steht die Zelle links
 * oben, und das ist Bild 0 der Ruhefolge — eine STEHENDE Figur bekommt
 * deshalb gar keine Angabe. Nur die Arena schiebt das Blatt weiter, und zwar
 * unmittelbar am Element (`bildSchieben` in KampfAnzeige.tsx); dafuer ist
 * `gib` da. Am `<img>` steht deshalb kein `transform`: Es waere die Angabe,
 * die der Takt gleich darauf ueberschreibt, und beim naechsten Zeichnen
 * setzte React sie zurueck.
 *
 * WARUM EIN `<img>` UND KEIN HINTERGRUNDBILD: `onError`. Ein ausgefallener
 * Hintergrund ist ein leeres Feld; ein ausgefallenes `<img>` meldet sich, und
 * dann tritt der Rueckfall an seine Stelle. Der gescheiterte PFAD wird
 * gemerkt und nicht bloss ein Ja/Nein: Ein Bankplatz behaelt seine Komponente,
 * wenn dort eine andere Einheit landet (React setzt ueber die Stelle
 * zusammen, nicht ueber den Inhalt) — mit einem Ja/Nein bliebe der Rueckfall
 * der ersten Einheit an der zweiten kleben, deren Blatt in Ordnung ist.
 *
 * DIE MASSE STEHEN NICHT HIER, sondern beim Aufrufer (`klasse`). Warum, steht
 * im Kopf von `Figur3D.module.css`.
 */

import { type ReactNode, useState } from 'react';

import stil from './Figur3D.module.css';

export function Figur3D({
  name,
  blatt,
  spiegeln,
  ersatz,
  klasse,
  gib,
}: {
  /**
   * Der Name der EINHEIT, nicht der der Rolle: Fuer den Leser ist die Figur
   * eine Dorfwache; dass sie sich das Blatt mit sieben anderen teilt, ist
   * eine Auskunft ueber die Dateien.
   */
  name: string;
  /** Pfad zum Blatt der Rolle (`blattPfad`), oder null, wenn es keines gibt. */
  blatt: string | null;
  /** Nach links schauen lassen — alle Blaetter schauen nach rechts. */
  spiegeln?: boolean;
  /** Was an die Stelle tritt, wenn es kein Blatt gibt oder es nicht laedt. */
  ersatz: ReactNode;
  /** Wo die Figur steht und wie gross sie ist — je Ort eine eigene Klasse. */
  klasse?: string;
  /**
   * Meldet das Bild an einen Takt, der es schieben will (nur die Arena).
   * Ohne diese Angabe steht die Figur still, und zwar auf Bild 0 der
   * Ruhefolge.
   */
  gib?: (el: HTMLImageElement | null) => void;
}): React.JSX.Element {
  const [kaputt, setKaputt] = useState<string | null>(null);
  if (blatt === null || blatt === kaputt) return <>{ersatz}</>;
  return (
    <span
      className={klasse ? `${stil.ausschnitt} ${klasse}` : stil.ausschnitt}
      data-spiegel={spiegeln ? '' : undefined}
    >
      <img
        ref={gib}
        className={gib ? `${stil.blatt} ${stil.bewegt}` : stil.blatt}
        src={blatt}
        alt={name}
        onError={() => setKaputt(blatt)}
      />
    </span>
  );
}
