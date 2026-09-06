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
 * Gezeigt wird er an ZWEI Stellen, und beide meinen denselben Lauf: als
 * Rueckfall von `<Suspense>`, solange das Spielpaket unterwegs ist
 * (Ladevorhang.tsx, eingehaengt in App.tsx), und danach vom Schirm selbst,
 * solange noch Bilder fehlen. Fuer den Spieler ist das ein Bildschirm mit
 * einem Balken — der Wechsel dazwischen ist nicht zu sehen.
 *
 * Zwei Anzeigen und nicht eine: der Balken fuer „es geht voran" (nach Gewicht,
 * siehe vorladen.ts) und die Zahl fuer „wie weit noch" (nach Dateien, weil
 * Kilobyte niemandem etwas sagen). „Dateien" ist dort seit dem 6.9.2026
 * woertlich zu nehmen: Das Spielpaket zaehlt mit fuenf statt mit eins
 * (`Posten.stueck`, paket.ts), obwohl es EIN Posten mit einer Wartezeit ist.
 * Vorher stand hier „29 Dateien", waehrend 33 ueber die Leitung gingen — der
 * Balken stimmte, die Zahl daneben untertrieb.
 *
 * „29 Teile" waere die andere Loesung gewesen und haette genauso gestimmt, sagt
 * aber Fachsprache, wo Robin ausdruecklich „Dateien" wollte. Die Zahl kostet
 * ein Feld und behaelt sein Wort. Aufzaehlen lassen sich die fuenf naemlich
 * nicht: Ihre Namen tragen eine Pruefsumme, die erst beim Bauen entsteht — die
 * ANZAHL kennt man trotzdem.
 *
 * Der Balken ist ein `progressbar` mit `aria-valuenow` — damit sagt ein
 * Vorlesegeraet den Fortschritt an, ohne dass ein `aria-live` die Zahl 33-mal
 * vorliest.
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
