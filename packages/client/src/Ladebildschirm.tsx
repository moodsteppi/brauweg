import type { Ladestand } from './minispiele/tafelrunde/vorladen';
import stil from './Ladebildschirm.module.css';

/**
 * „Dateien werden heruntergeladen" — der Vorhang vor einem Spiel.
 *
 * Robins Satz beim Spielen: „das spiel braucht zu viel dateien wenn man
 * tafelrunde anklickt muss im loadingscreen alles wichtige runtergeladen
 * werden sonst sieht man die ersten runden nichts". Dazu ausdruecklich: „kann
 * da auch ruhig stehen Dateien werden heruntergeladen". Der Satz steht also
 * woertlich so da und wird nicht in etwas Hoefliches umformuliert.
 *
 * Der Bildschirm lag bis zum 06.09.2026 unter `minispiele/tafelrunde/` und
 * ist heute der Rueckfall JEDES Spiels (App.tsx): Seit alle Spielbildschirme
 * nachgeladen werden, ist er das erste und oft einzige Bild, das ein Spieler
 * beim Antippen zu sehen bekommt. Genau darum ging es Robin — er sah ihn
 * vorher nie, weil zum Zeitpunkt des Wartens noch gar nichts gezeichnet war.
 *
 * Zwei Anzeigen und nicht eine: der Balken fuer „es geht voran" (nach Gewicht,
 * siehe vorladen.ts) und die Zahl fuer „wie weit noch" (nach Dateien, weil
 * Kilobyte niemandem etwas sagen). Der Balken ist ein `progressbar` mit
 * `aria-valuenow` — damit sagt ein Vorlesegeraet den Fortschritt an, ohne dass
 * ein `aria-live` die Zahl 23-mal vorliest.
 *
 * Der Bildschirm hat KEINEN eigenen Zeitgeber und keine eigene Frist: Dass
 * nach `FRIST_MS` weitergespielt wird, entscheidet der Lauf in vorladen.ts.
 * Hier haengt nichts, was dort nicht endet.
 */
export function Ladebildschirm({
  titel,
  stand,
  onAbbrechen,
}: {
  /** Der Name des Spiels, das gerade kommt. Steht gross ueber dem Balken. */
  titel: string;
  /**
   * Der gewogene Fortschritt — heute liefert ihn nur Tafelrunde (vorladen.ts).
   *
   * Ohne ihn laeuft der Balken unbestimmt. Das ist kein Schoenheitsfehler,
   * sondern die einzige ehrliche Anzeige, die ein blosses `import()` zulaesst:
   * Ein dynamischer Import meldet keinen Zwischenstand, er ist da oder nicht.
   * Ein Balken, der auf gut Glueck auf 60 % kriecht, waere dieselbe Luege wie
   * der Dateizaehler, den vorladen.ts ausdruecklich nicht benutzt.
   */
  stand?: Ladestand;
  /** Zurueck ins Menue. Ohne Rueckweg waere der Vorhang eine Sackgasse. */
  onAbbrechen?: () => void;
}): React.JSX.Element {
  const prozent = stand ? Math.round(Math.min(1, Math.max(0, stand.anteil)) * 100) : null;
  return (
    <main className="tr-seite tr-menue">
      {onAbbrechen && (
        <button className="tr-zurueck" type="button" onClick={onAbbrechen}>
          ← Abbrechen
        </button>
      )}
      <div className="tr-menue-mitte">
        <h1 className="tr-titel">{titel}</h1>
        <p className="tr-untertitel">Dateien werden heruntergeladen</p>
        <div
          className={`${stil.balken} ${prozent === null ? stil.unbestimmt : ''}`}
          role="progressbar"
          aria-label="Dateien werden heruntergeladen"
          aria-valuemin={0}
          aria-valuemax={100}
          /* Ohne `aria-valuenow` gilt ein progressbar als unbestimmt — genau
             das soll er dann sein. `undefined` und nicht 0: Eine Null waere
             die Aussage „null Prozent" und nicht „unbekannt". */
          aria-valuenow={prozent ?? undefined}
        >
          <span
            className={stil.fuellung}
            style={prozent === null ? undefined : { width: `${prozent}%` }}
          />
        </div>
        {stand && (
          <p className={`tr-untertitel ${stil.zaehler}`}>
            {stand.erledigt} von {stand.gesamt} Dateien
          </p>
        )}
        {/*
          Die huepfenden Punkte des Wartebereichs, und zwar aus einem
          gemessenen Grund: Auf gedrosseltem 3G kommt die erste Antwort erst
          nach zwei Sekunden Latenz. So lange stuenden Balken und Zaehler ohne
          sie regungslos auf null — genau der Eindruck ("da passiert nichts"),
          den dieser Bildschirm ausraeumen soll.
        */}
        <div className="tr-punkte-lauf" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  );
}
