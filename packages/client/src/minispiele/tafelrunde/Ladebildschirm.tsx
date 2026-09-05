import type { Ladestand } from './vorladen';
import stil from './Ladebildschirm.module.css';

/**
 * „Dateien werden heruntergeladen" — der Vorhang vor der ersten Runde.
 *
 * Robins Satz beim Spielen: „das spiel braucht zu viel dateien wenn man
 * tafelrunde anklickt muss im loadingscreen alles wichtige runtergeladen
 * werden sonst sieht man die ersten runden nichts". Dazu ausdruecklich: „kann
 * da auch ruhig stehen Dateien werden heruntergeladen". Der Satz steht also
 * woertlich so da und wird nicht in etwas Hoefliches umformuliert.
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
  stand,
  onAbbrechen,
}: {
  stand: Ladestand;
  /** Zurueck ins Menue. Ohne Rueckweg waere der Vorhang eine Sackgasse. */
  onAbbrechen?: () => void;
}): React.JSX.Element {
  const prozent = Math.round(Math.min(1, Math.max(0, stand.anteil)) * 100);
  return (
    <main className="tr-seite tr-menue">
      {onAbbrechen && (
        <button className="tr-zurueck" type="button" onClick={onAbbrechen}>
          ← Abbrechen
        </button>
      )}
      <div className="tr-menue-mitte">
        <h1 className="tr-titel">Tafelrunde</h1>
        <p className="tr-untertitel">Dateien werden heruntergeladen</p>
        <div
          className={stil.balken}
          role="progressbar"
          aria-label="Dateien werden heruntergeladen"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={prozent}
        >
          <span className={stil.fuellung} style={{ width: `${prozent}%` }} />
        </div>
        <p className={`tr-untertitel ${stil.zaehler}`}>
          {stand.erledigt} von {stand.gesamt} Dateien
        </p>
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
