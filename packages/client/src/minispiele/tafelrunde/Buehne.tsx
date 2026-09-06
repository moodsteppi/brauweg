/**
 * Die Buehne der Kampfphase — der Raum, in dem die Arena steht.
 *
 * Bis hierher stand das Brett auf der nackten Seitenfarbe: richtig gefaerbt,
 * aber ohne Tiefe, und damit sah die Kampfphase aus wie eine Tabelle mit
 * Bildern darin. Diese Datei legt einen RAUM darunter — Horizont, Boden,
 * Dunst, aufsteigende Glut — und stellt das Brett hinein.
 *
 * Der Ton ist vom Startbildschirm abgeschaut und nicht neu erfunden: dieselbe
 * Art Bewegung wie `hub-baum-weht`, `hub-huepf` und die `pf-…`-Zierden in
 * styles.css (langsam, ease-in-out, endlos, gegeneinander versetzt), dieselbe
 * Auffahrt-Kurve `cubic-bezier(0.22, 1, 0.36, 1)` wie bei der Weltkarte. Die
 * Farben sind die des Spiels (`--gold` auf `--bg`), nicht die des Hubs: Der
 * Hub ist hell und blau, Tafelrunde ist dunkel und golden — das steht so im
 * Kopf des Tafelrunde-Abschnitts von styles.css und gilt hier weiter.
 *
 * HIER WIRD NICHTS GERECHNET UND NICHTS GESPIELT. Die Buehne kennt weder
 * Kaempfe noch Figuren; sie bekommt die Arena als Kind und die Rundenzahl als
 * Zahl. Der Kampf selbst laeuft unveraendert in KampfAnzeige.tsx nach der Uhr
 * des Servers — die Ansage legt sich nur DARUEBER und haelt ihn nicht an.
 * Das ist Absicht: Die Schaupause des Servers (`interludeMs`) ist die einzige
 * Uhr, nach der sich die Anzeige richten darf; eine Buehne, die den Kampf um
 * ihre eigene Einblendung verzoegerte, waere am Ende zu spaet fertig.
 *
 * Eingehaengt wird sie in screens/Tafelrunde.tsx um die Arena herum, und
 * zwar UM sie herum und nicht IN sie hinein: Die Arena ist ein
 * abgeschlossenes Bauteil mit eigener Uhr, und ein Hintergrund in ihrem Baum
 * waere beim naechsten Umbau ihr Problem statt unseres.
 */

import { type ReactNode, useEffect, useState } from 'react';

import stil from './Buehne.module.css';

/**
 * Wie lange die Rundenansage steht, bevor die Buehne auffaehrt.
 *
 * Kurz gehalten, weil der Kampf darunter schon laeuft (siehe Kopf): Was die
 * Ansage verdeckt, ist verpasst. 900 ms sind knapp zwei Schritte der
 * Simulation (SCHRITT_MS = 500 in kampf.ts) und damit hoechstens der
 * Anmarsch, nie ein Treffer — Kaempfe dauern 15 bis 30 Sekunden.
 */
export const ANSAGE_MS = 900;

/**
 * Die Funken, die ueber den Boden steigen.
 *
 * Feste Liste statt Zufall: Ein `Math.random()` beim Zeichnen gaebe bei jedem
 * Rundruf des Servers neue Werte, und die Funken sprangen im Takt der
 * Netzwerkpakete. Die Zahlen sind Prozent (links) und Sekunden (Verzoegerung
 * und Dauer) — gegeneinander versetzt, damit kein Takt entsteht.
 */
const FUNKEN: readonly { links: number; halt: number; dauer: number }[] = [
  { links: 12, halt: 0, dauer: 4.2 },
  { links: 27, halt: -1.7, dauer: 5.1 },
  { links: 44, halt: -3.1, dauer: 4.6 },
  { links: 61, halt: -0.9, dauer: 5.4 },
  { links: 78, halt: -2.4, dauer: 4.4 },
  { links: 91, halt: -3.8, dauer: 5.8 },
];

export function Buehne({
  runde,
  verblasst,
  children,
}: {
  /** Die laufende Runde — die Zahl, die in der Ansage steht. */
  runde: number;
  /** Der Server hat die Phase gewechselt: die ganze Buehne verblasst. */
  verblasst?: boolean;
  children: ReactNode;
}): React.JSX.Element {
  /*
   * Die Ansage haengt am EINHAENGEN und nicht an einer Phase in der Sicht:
   * Diese Komponente entsteht mit der Kampfphase und vergeht mit ihr (siehe
   * `useKampfbild` in screens/Tafelrunde.tsx). Ein Effekt mit dem
   * Sicht-Objekt in der Abhaengigkeitsliste liefe bei jedem Serverfunk neu
   * und raeumte seinen Timer ab — genau der Fehler, vor dem CLAUDE.md warnt;
   * die leere Liste hier kann das bauartbedingt nicht.
   */
  const [ansage, setAnsage] = useState(true);
  useEffect(() => {
    const uhr = window.setTimeout(() => setAnsage(false), ANSAGE_MS);
    return () => window.clearTimeout(uhr);
  }, []);

  return (
    <div className={stil.buehne} data-verblasst={verblasst ? '' : undefined}>
      {/* Die Kulisse. Vier Ebenen, jede mit genau einer Aufgabe — so laesst
          sich eine davon aendern, ohne die anderen anzufassen. `aria-hidden`
          durchgehend: Wer vorgelesen bekommt, hat von Dunst nichts. */}
      <div className={stil.himmel} aria-hidden="true" />
      <div className={stil.horizont} aria-hidden="true" />
      <div className={stil.boden} aria-hidden="true" />
      <div className={stil.dunst} aria-hidden="true">
        <i />
        <i />
      </div>
      <div className={stil.glut} aria-hidden="true">
        {FUNKEN.map((f) => (
          <i
            key={f.links}
            style={
              {
                left: `${f.links}%`,
                animationDelay: `${f.halt}s`,
                animationDuration: `${f.dauer}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Die Arena. Sie faehrt auf, wenn die Ansage verklingt — die
          Verzoegerung steht im Stylesheet, damit die Bewegung an EINER Stelle
          liegt und bei „weniger Bewegung" ersatzlos wegfaellt. */}
      <div className={stil.mitte}>{children}</div>

      {ansage && (
        /*
         * Kein `role="status"`: Am Tisch traegt schon das Verschmelz-Band
         * diese Rolle, und zwei Statusbereiche auf einem Bildschirm lesen
         * sich gegenseitig tot. `aria-live` sagt dasselbe, ohne die Rolle zu
         * belegen.
         */
        <div className={stil.vorhang} aria-live="polite">
          <strong>Runde {runde}</strong>
          <span>Zum Kampf</span>
        </div>
      )}
    </div>
  );
}
