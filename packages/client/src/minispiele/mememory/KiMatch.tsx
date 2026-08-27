/**
 * "KI-Match erstellen" — die Stufenwahl vor einer Partie gegen den Rechner.
 *
 * Ein eigener Bildschirm und kein Auswahlfeld im Menue: Die vier Stufen
 * spielen sich spuerbar verschieden, und wer sie zum ersten Mal sieht, will
 * wissen, was ihn erwartet. Dafuer braucht jede einen Satz — und vier Saetze
 * passen nicht neben einen Knopf.
 *
 * **Vorbereitet auf mehr als einen Gegner.** Der Zustand ist eine LISTE von
 * Stufen, auch wenn heute genau eine darinsteht: Mememory hat zwei Sitze
 * (SEAT_COUNTS in packages/game-mememory/src/regeln.ts). Wird das Brett
 * spaeter auf vier Spieler erweitert, waechst hier eine Zeile je Gegner —
 * die Liste geht als `botStufen` ohnehin schon sitzweise an den Tisch.
 */

import { useState } from 'react';

/** Muss zu MememoryStufe in packages/game-mememory/src/stufen.ts passen. */
export type Stufe = 'leicht' | 'mittel' | 'schwer' | 'experte';

interface Beschreibung {
  readonly stufe: Stufe;
  readonly name: string;
  readonly satz: string;
}

/**
 * Was die Stufen wirklich tun — in der Sprache des Spielers, nicht in der des
 * Codes. Wer "70 % Haltewahrscheinlichkeit" liest, weiss nicht, ob er
 * gewinnen kann.
 */
const STUFEN: readonly Beschreibung[] = [
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

export function KiMatch({
  laeuft,
  fehler,
  onStart,
  onBack,
}: {
  /** Der Tisch wird gerade aufgemacht — der Knopf darf nicht zweimal gehen. */
  laeuft: boolean;
  fehler: string | null;
  onStart: (stufen: Stufe[]) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [gegner, setGegner] = useState<Stufe[]>(['mittel']);

  const setze = (index: number, stufe: Stufe): void => {
    setGegner((alt) => alt.map((wert, i) => (i === index ? stufe : wert)));
  };

  return (
    <main className="mm-menue">
      <button className="mm-zurueck" type="button" onClick={onBack} disabled={laeuft}>
        ← Zurück
      </button>

      <div className="mm-menue-mitte">
        <h1 className="mm-titel mm-titel-klein">KI-Match erstellen</h1>
        <p className="mm-untertitel">Wie gut soll dein Gegner sich erinnern?</p>

        {gegner.map((gewaehlt, index) => (
          <div className="mm-stufenwahl" key={index}>
            {STUFEN.map((eintrag) => (
              <button
                key={eintrag.stufe}
                type="button"
                className="mm-stufe"
                data-an={eintrag.stufe === gewaehlt ? '' : undefined}
                aria-pressed={eintrag.stufe === gewaehlt}
                onClick={() => setze(index, eintrag.stufe)}
                disabled={laeuft}
              >
                {eintrag.name}
              </button>
            ))}
          </div>
        ))}

        <p className="mm-stufensatz">
          {STUFEN.find((eintrag) => eintrag.stufe === gegner[0])?.satz}
        </p>

        <button
          className="mm-suchen"
          type="button"
          onClick={() => onStart(gegner)}
          disabled={laeuft}
        >
          <span>{laeuft ? 'Tisch wird aufgemacht…' : 'Match starten'}</span>
        </button>

        {fehler && <p className="mm-fehler">{fehler}</p>}
      </div>
    </main>
  );
}
