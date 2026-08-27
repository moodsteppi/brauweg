/**
 * Die Spielstaerke eines Bots als Regler statt als Knopfreihe.
 *
 * Vier Knoepfe nebeneinander brauchen eine Zeile fuer sich, und mit drei
 * Gegnern waren das drei Zeilen plus drei Saetze. Ein Regler passt in eine
 * Zeile — und das ist der Punkt: Im Wartebereich steht neben ihm der Knopf
 * "Mit Bots auffuellen", und beides zusammen muss auf ein Telefon passen.
 *
 * **Die Namen bleiben sichtbar.** Ein Regler ohne Beschriftung ist eine
 * Zumutung: "Stufe 3 von 4" sagt niemandem, ob der Gegner sich etwas merkt.
 * Alle vier stehen deshalb unter der Schiene; die gewaehlte gross und hell,
 * die anderen klein und grau. So liest man im Vorbeigehen, wo man steht, und
 * beim Hinsehen, was es sonst noch gibt.
 *
 * **Ein echtes `<input type="range">` und kein Nachbau.** Es bringt
 * Tastatur (Pfeiltasten), Vorlesen ("Regler, 2 von 4") und das Ziehverhalten
 * des Geraets mit. Ein Nachbau aus vier Feldern haette nichts davon.
 */

/** Muss zu STUFEN in packages/game-mememory/src/stufen.ts passen. */
export type Stufe = 'leicht' | 'mittel' | 'schwer' | 'experte';

export interface Beschreibung {
  readonly stufe: Stufe;
  readonly name: string;
  readonly satz: string;
}

/**
 * Was die Stufen wirklich tun — in der Sprache des Spielers, nicht in der des
 * Codes. Wer "70 % Haltewahrscheinlichkeit" liest, weiss nicht, ob er
 * gewinnen kann.
 */
export const STUFEN: readonly Beschreibung[] = [
  {
    stufe: 'leicht',
    name: 'Leicht',
    satz: 'Merkt sich nur die letzten zwei Züge und deckt sonst blind auf.',
  },
  {
    stufe: 'mittel',
    name: 'Mittel',
    satz: 'Merkt sich drei Züge — aber jede Karte nur mit halber Wahrscheinlichkeit.',
  },
  {
    stufe: 'schwer',
    name: 'Schwer',
    satz: 'Vier Züge, dreht nichts unnötig zweimal um und behält manches für immer.',
  },
  {
    stufe: 'experte',
    name: 'Experte',
    satz: 'Vergisst nichts. Was einmal offen lag, hat er.',
  },
];

/**
 * Die Mememory-Stufe auf die der Plattform.
 *
 * Die Plattform kennt vier eigene Namen (`BotLevel` in game-api) und speichert
 * SIE am Tisch; das Spielmodul rechnet sie beim Partiestart wieder zurueck
 * (`stufeAusBotLevel` in game-mememory/src/stufen.ts). Wer hier etwas
 * umhaengt, muss dort mit.
 *
 * Warum ueberhaupt der Umweg: Der Regelsatz eines Tisches steht seit dem
 * Erstellen fest, die Tischeinstellungen nicht. Beim Auffuellen eines
 * wartenden Tisches ist die Plattformstufe der einzige Weg, an dem noch etwas
 * ankommt.
 */
export function botLevelAus(stufe: Stufe): 'anfaenger' | 'standard' | 'experte' | 'genie' {
  switch (stufe) {
    case 'leicht':
      return 'anfaenger';
    case 'schwer':
      return 'experte';
    case 'experte':
      return 'genie';
    default:
      return 'standard';
  }
}

export function Stufenregler({
  wert,
  onWert,
  gesperrt,
  beschriftung,
}: {
  wert: Stufe;
  onWert: (stufe: Stufe) => void;
  gesperrt?: boolean;
  /** Vorlesetext, wenn daneben nicht ohnehin steht, worum es geht. */
  beschriftung?: string;
}): React.JSX.Element {
  const nr = Math.max(0, STUFEN.findIndex((eintrag) => eintrag.stufe === wert));

  return (
    <div className="mm-regelzeile">
      <input
        className="mm-stufenschiene"
        type="range"
        min={0}
        max={STUFEN.length - 1}
        step={1}
        value={nr}
        disabled={gesperrt}
        aria-label={beschriftung ?? 'Spielstärke'}
        /*
         * `aria-valuetext` ist hier kein Beiwerk: Ohne ihn liest ein
         * Vorleseprogramm "2" vor, und die Zahl steht nirgends auf dem
         * Bildschirm. Mit ihm liest es "Mittel".
         */
        aria-valuetext={STUFEN[nr]?.name}
        onChange={(e) => {
          const gewaehlt = STUFEN[Number(e.target.value)];
          if (gewaehlt) onWert(gewaehlt.stufe);
        }}
      />
      <div className="mm-stufennamen" aria-hidden="true">
        {STUFEN.map((eintrag, i) => (
          <button
            key={eintrag.stufe}
            type="button"
            className="mm-stufenname"
            data-an={i === nr ? '' : undefined}
            disabled={gesperrt}
            /*
             * Die Namen sind zugleich Knoepfe. Wer die Stufe schon kennt,
             * tippt sie direkt an, statt den Griff dorthin zu ziehen — auf
             * einem Telefon ist das der schnellere Weg. Fuer die Vorlesehilfe
             * bleiben sie unsichtbar (aria-hidden am Kasten), weil der Regler
             * darueber dieselbe Auskunft schon gibt.
             */
            onClick={() => onWert(eintrag.stufe)}
          >
            {eintrag.name}
          </button>
        ))}
      </div>
    </div>
  );
}
