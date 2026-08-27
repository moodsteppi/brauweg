/**
 * Zeichen, die als Symbol dienen — und deshalb genau mittig sitzen muessen.
 *
 * **Warum das nicht als Schriftzeichen geht.** Ein `✕` oder `×` im Knopf wird
 * vom Browser nach seiner VORSCHUBBREITE zentriert, nicht nach seiner Tinte.
 * Was rechts und links vom Strich Luft ist, entscheidet die Schrift, und die
 * ist auf jedem Geraet eine andere. Nachgemessen am 27. August 2026: Das
 * Kreuz im Schliessknopf des Vorschlagskastens sass 3,4 px zu weit rechts
 * (34 px breiter Knopf, also ein Zehntel daneben), und das `×` in der
 * Spielauswahl 2,2 px zu tief. Beides ist sichtbar, und beides laesst sich
 * mit CSS nicht beheben — die Schrift gibt es nicht her.
 *
 * Ein Pfad in einer viewBox dagegen sitzt da, wo er hingeschrieben wird. Die
 * Zeichen hier sind alle um (12,12) gebaut und damit mittig per Konstruktion.
 *
 * Die Groesse kommt in `em` und richtet sich damit nach der Schriftgroesse des
 * Knopfes — so bleibt jeder Knopf so gross wie vorher, ohne dass eine
 * Pixelzahl an zehn Stellen wiederholt werden muss.
 */

/** Schliessen, ablehnen, herausnehmen: ein Kreuz. */
export function Kreuz({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={`zeichen zeichen-kreuz${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M7.5 7.5 L16.5 16.5 M16.5 7.5 L7.5 16.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Zurueck: ein Pfeil nach links.
 *
 * Derselbe Grund wie beim Kreuz. Gemessen sass das `←` im Raus-Knopf von
 * Mememory 1,5 px zu tief — bei 34 px Knopf faellt das noch nicht auf, aber
 * es ist dieselbe Ursache, und ein zweites Zeichen mit demselben Fehler waere
 * nur eine Frage der Zeit.
 */
export function PfeilLinks({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={`zeichen zeichen-pfeil${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {/* Schaft von 5 bis 19, Spitze bei 5 — waagerecht mittig um 12, und
          senkrecht liegt alles auf der Linie y = 12. */}
      <path
        d="M19 12 H5 M10.5 6.5 L5 12 L10.5 17.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Note — der Platzhalter im Laden fuer Klangpakete und Musikstuecke.
 *
 * Steht dort, wo es noch kein Bild gibt (siehe `glyph` in GameSelect.tsx).
 * Vorher waren es die Schriftzeichen `♪` und `♫`; gemessen sassen die
 * 2,3 px zu tief in einem 30 px hohen Feld, also fast ein Zwoelftel daneben.
 * Bei einem Zeichen, das ohnehin nur so lange dasteht, bis das Bild kommt,
 * faellt Schiefe besonders auf — es hat keinen Rahmen, an dem sich das Auge
 * festhaelt.
 *
 * `doppelt` gibt die zwei durch einen Balken verbundenen Noten (fuer Musik),
 * sonst die einzelne (fuer Klaenge).
 */
export function Note({ doppelt = false }: { doppelt?: boolean }): React.JSX.Element {
  return (
    <svg className="zeichen zeichen-note" viewBox="0 0 24 24" aria-hidden="true">
      {/*
        * Die beiden Verschiebungen sind gemessen und nicht geraten: Eine Note
        * ist von Natur aus unsymmetrisch — der Kopf sitzt unten links, der
        * Hals steht oben rechts —, und die Zeichnung landete deshalb 5,4 %
        * bzw. 3,9 % zu tief in ihrer Box. In Einheiten der viewBox sind das
        * 1,3 und 0,94. Nachgemessen im Laden bei 35 px Kantenlaenge.
        */}
      {doppelt ? (
        <g fill="currentColor" transform="translate(0.58 -0.94)">
          <ellipse cx="6.6" cy="17.8" rx="3.3" ry="2.5" transform="rotate(-20 6.6 17.8)" />
          <ellipse cx="16" cy="15.7" rx="3.3" ry="2.5" transform="rotate(-20 16 15.7)" />
          <path d="M9.1 17.4V7.2h1.7v10.2zM18.5 15.3V5.1h1.7v10.2z" />
          <path d="M9.1 7.2 20.2 4.6v2.9L9.1 10.1z" />
        </g>
      ) : (
        <g fill="currentColor" transform="translate(0 -1.3)">
          <ellipse cx="9.2" cy="17.6" rx="3.6" ry="2.7" transform="rotate(-20 9.2 17.6)" />
          <path d="M12 17.1V5.2h1.8v11.9z" />
          <path d="M13.8 5.2c3.4.7 5 2.4 5.2 4.9-1-1.7-2.7-2.6-5.2-2.8z" />
        </g>
      )}
    </svg>
  );
}
