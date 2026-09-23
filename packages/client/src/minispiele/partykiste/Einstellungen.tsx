/**
 * Das Menue der Partykiste: Einstellungen und das Angebot einer offenen Runde.
 *
 * Ausgelagert aus `screens/Partykiste.tsx` am 22.09.2026, damit der
 * Schaukasten beide zeigen kann — der Bildschirm zieht `api` und `useTable`
 * mit, dieser Teil nichts davon.
 */

import { Regelzeile } from './Regelzeile';
import { HAERTE_NAME, type PartyRegelsatz } from './sicht';

/** Eine offene Runde, die "Online spielen" gefunden hat — noch nicht beigetreten. */
export interface Angebot {
  id: string;
  host: string | null;
  runden: number;
  /** null: Regelsatz nicht lesbar. Dann steht das auch so da. */
  regeln: PartyRegelsatz | null;
}

/**
 * Runden, Härte, Trinkmodus — fuer BEIDE Wege.
 *
 * Bis zum 22.09.2026 standen Runden und Härte nur im aufgeklappten
 * "Gegen Bots"-Block, und einen Trinkmodus-Schalter gab es gar nicht. Online
 * galt trotzdem die Rundenzahl von dort (wer sie nicht aufklappte, sah sie
 * nie) und fuer alles andere die Vorgabe des Moduls.
 */
export function Einstellungen({
  runden,
  haerte,
  trinkmodus,
  onRunden,
  onHaerte,
  onTrinkmodus,
}: {
  runden: number;
  haerte: number;
  trinkmodus: boolean;
  onRunden: (w: number) => void;
  onHaerte: (w: number) => void;
  onTrinkmodus: (an: boolean) => void;
}): React.JSX.Element {
  return (
    <section className="pk-einstellungen" aria-labelledby="pk-einstellungen-titel">
      <h2 id="pk-einstellungen-titel" className="pk-einstellungen-titel">
        Einstellungen
      </h2>
      <div className="pk-stufen" role="group" aria-label="Trinkmodus" data-pk-trinkmodus="">
        <button
          type="button"
          data-an={trinkmodus ? '' : undefined}
          aria-pressed={trinkmodus}
          onClick={() => onTrinkmodus(true)}
        >
          Trinkspiel
        </button>
        <button
          type="button"
          data-an={trinkmodus ? undefined : ''}
          aria-pressed={!trinkmodus}
          onClick={() => onTrinkmodus(false)}
        >
          Alkoholfrei
        </button>
      </div>
      <Regler titel="Runden" wert={runden} min={3} max={15} onWahl={onRunden} />
      <Regler titel="Härte" wert={haerte} min={1} max={3} zusatz={HAERTE_NAME[haerte]} onWahl={onHaerte} />
      <p className="pk-einstellungen-hinweis">
        {trinkmodus
          ? 'Wer verliert, trinkt — die Härte nimmt alle Schlücke mal.'
          : 'Statt Schlücken gibt es Strafpunkte, die Härte nimmt sie mal. Die Punkte fürs Turnier bleiben gleich.'}{' '}
        Gilt für deine eigene Runde, online wie gegen Bots.
      </p>
    </section>
  );
}

/**
 * Eine offene Runde gefunden: erst ansehen, dann beitreten.
 *
 * Die eigenen Einstellungen gelten dort NICHT — der Oeffner hat eingestellt
 * (P6). Deshalb steht der Unterschied ausdruecklich da, statt dass man ihn an
 * der ersten Abrechnung bemerkt.
 */
export function OffeneRunde({
  angebot,
  laedt,
  onBeitreten,
  onEigene,
  onAbbrechen,
}: {
  angebot: Angebot;
  laedt: boolean;
  onBeitreten: () => void;
  onEigene: () => void;
  onAbbrechen: () => void;
}): React.JSX.Element {
  return (
    <div className="pk-angebot" data-pk-angebot="">
      <p className="pk-angebot-titel">
        Offene Runde{angebot.host ? ` von ${angebot.host}` : ''}
      </p>
      {angebot.regeln ? (
        <Regelzeile regeln={angebot.regeln} runden={angebot.runden} />
      ) : (
        <p className="pk-warten">Die Regeln dieser Runde ließen sich nicht lesen.</p>
      )}
      <p className="pk-warten">Dort gelten die Regeln der Runde, nicht deine Einstellungen.</p>
      <div className="pk-wahl">
        <button className="pk-knopf is-haupt" type="button" data-pk-beitreten="" onClick={onBeitreten} disabled={laedt}>
          Beitreten
        </button>
        <button className="pk-knopf is-neben" type="button" data-pk-eigene="" onClick={onEigene} disabled={laedt}>
          Eigene aufmachen
        </button>
      </div>
      <button className="pk-textknopf" type="button" onClick={onAbbrechen}>
        Abbrechen
      </button>
    </div>
  );
}

export function Regler({
  titel,
  wert,
  min,
  max,
  zusatz,
  onWahl,
}: {
  titel: string;
  wert: number;
  min: number;
  max: number;
  zusatz?: string;
  onWahl: (wert: number) => void;
}): React.JSX.Element {
  return (
    <label className="pk-reglerzeile">
      <span className="pk-reglertitel">{titel}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={wert}
        onChange={(e) => onWahl(Number(e.target.value))}
      />
      <strong className="pk-reglerwert">{zusatz ?? wert}</strong>
    </label>
  );
}
