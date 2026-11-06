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

import { t } from '../../i18n';

/** Muss zu STUFEN in packages/game-mememory/src/stufen.ts passen. */
export type Stufe = 'leicht' | 'mittel' | 'schwer' | 'experte';

/**
 * Die Stufen in der Reihenfolge des Reglers.
 *
 * Was die Stufen wirklich tun — in der Sprache des Spielers, nicht in der des
 * Codes. Wer "70 % Haltewahrscheinlichkeit" liest, weiss nicht, ob er
 * gewinnen kann. Name und Satz stehen im Woerterbuch
 * (`mememory.stufe.<stufe>` und `….satz`) und werden beim Zeichnen gelesen:
 * Eine Tabelle mit fertigem Text bliebe nach dem Umschalten der Sprache in
 * der alten stehen, bis jemand neu laedt.
 */
export const STUFEN: readonly Stufe[] = ['leicht', 'mittel', 'schwer', 'experte'];

function istStufe(stufe: string | undefined): stufe is Stufe {
  return (STUFEN as readonly (string | undefined)[]).includes(stufe);
}

/**
 * Der Anzeigename einer Stufe, oder null fuer alles Unbekannte.
 *
 * Gebraucht am Brett: Neben dem Namen eines Bots steht seine Staerke, und die
 * kommt als Kennung aus der Sicht des Moduls. Die Namen stehen neben den
 * Saetzen im selben Bereich — zwei Listen mit denselben vier Woertern liefen
 * auseinander.
 */
export function stufenName(stufe: string | undefined): string | null {
  return istStufe(stufe) ? t(`mememory.stufe.${stufe}`) : null;
}

/** Der Satz zu einer Stufe: was der Bot sich merkt. */
export function stufenSatz(stufe: Stufe): string {
  return t(`mememory.stufe.${stufe}.satz`);
}

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
  const nr = Math.max(0, STUFEN.indexOf(wert));

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
        aria-label={beschriftung ?? t('mememory.stufe.beschriftung')}
        /*
         * `aria-valuetext` ist hier kein Beiwerk: Ohne ihn liest ein
         * Vorleseprogramm "2" vor, und die Zahl steht nirgends auf dem
         * Bildschirm. Mit ihm liest es "Mittel".
         */
        aria-valuetext={stufenName(STUFEN[nr]) ?? undefined}
        onChange={(e) => {
          const gewaehlt = STUFEN[Number(e.target.value)];
          if (gewaehlt) onWert(gewaehlt);
        }}
      />
      <div className="mm-stufennamen" aria-hidden="true">
        {STUFEN.map((eintrag, i) => (
          <button
            key={eintrag}
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
            onClick={() => onWert(eintrag)}
          >
            {stufenName(eintrag)}
          </button>
        ))}
      </div>
    </div>
  );
}
