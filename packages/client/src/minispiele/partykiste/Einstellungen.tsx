/**
 * Das Menue der Partykiste: Einstellungen und das Angebot einer offenen Runde.
 *
 * Ausgelagert aus `screens/Partykiste.tsx` am 22.09.2026, damit der
 * Schaukasten beide zeigen kann — der Bildschirm zieht `api` und `useTable`
 * mit, dieser Teil nichts davon.
 */

import { SpielAbschnitt, SpielWahl } from '../../screens/SpielEinstieg';
import { Regelzeile } from './Regelzeile';
import { haerteName, type PartyRegelsatz } from './sicht';
import { tz } from './text';

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
  neu = false,
}: {
  runden: number;
  haerte: number;
  trinkmodus: boolean;
  onRunden: (w: number) => void;
  onHaerte: (w: number) => void;
  onTrinkmodus: (an: boolean) => void;
  /** Neues Hub: im Spieleinstieg-Baukasten (DESIGN.md, „Spieleinstieg“). */
  neu?: boolean;
}): React.JSX.Element {
  const hinweis = (
    <>
      {trinkmodus
        ? tz('einstellungen.hinweisTrinken')
        : tz('einstellungen.hinweisOhne')}{' '}
      {tz('einstellungen.hinweisGilt')}
    </>
  );
  if (neu) {
    return (
      <SpielAbschnitt titel={tz('einstellungen.titel')}>
        <div className="spe-karte" data-pk-einstellungen="">
          <SpielWahl
            name={tz('einstellungen.trinkmodus')}
            werte={[
              { wert: 'an' as const, text: tz('einstellungen.trinkspiel') },
              { wert: 'aus' as const, text: tz('einstellungen.alkoholfrei') },
            ]}
            wert={trinkmodus ? 'an' : 'aus'}
            onWahl={(w) => onTrinkmodus(w === 'an')}
          />
          <Regler neu titel={tz('einstellungen.runden')} wert={runden} min={3} max={15} onWahl={onRunden} />
          <Regler neu titel={tz('einstellungen.haerte')} wert={haerte} min={1} max={3} zusatz={haerteName(haerte)} onWahl={onHaerte} />
          <p className="hb-klein">{hinweis}</p>
        </div>
      </SpielAbschnitt>
    );
  }
  return (
    <section className="pk-einstellungen" aria-labelledby="pk-einstellungen-titel">
      <h2 id="pk-einstellungen-titel" className="pk-einstellungen-titel">
        {tz('einstellungen.titel')}
      </h2>
      <div className="pk-stufen" role="group" aria-label={tz('einstellungen.trinkmodus')} data-pk-trinkmodus="">
        <button
          type="button"
          data-an={trinkmodus ? '' : undefined}
          aria-pressed={trinkmodus}
          onClick={() => onTrinkmodus(true)}
        >
          {tz('einstellungen.trinkspiel')}
        </button>
        <button
          type="button"
          data-an={trinkmodus ? undefined : ''}
          aria-pressed={!trinkmodus}
          onClick={() => onTrinkmodus(false)}
        >
          {tz('einstellungen.alkoholfrei')}
        </button>
      </div>
      <Regler titel={tz('einstellungen.runden')} wert={runden} min={3} max={15} onWahl={onRunden} />
      <Regler titel={tz('einstellungen.haerte')} wert={haerte} min={1} max={3} zusatz={haerteName(haerte)} onWahl={onHaerte} />
      <p className="pk-einstellungen-hinweis">{hinweis}</p>
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
  neu = false,
}: {
  angebot: Angebot;
  laedt: boolean;
  onBeitreten: () => void;
  onEigene: () => void;
  onAbbrechen: () => void;
  /** Neues Hub: steht im festen Fuß, Beitreten ist der goldene Hauptknopf. */
  neu?: boolean;
}): React.JSX.Element {
  if (neu) {
    return (
      <div className="spe-angebot" data-pk-angebot="">
        <p className="spe-angebot-titel">{angebot.host ? tz('angebot.titelVon', { host: angebot.host }) : tz('angebot.titel')}</p>
        {angebot.regeln ? (
          <Regelzeile regeln={angebot.regeln} runden={angebot.runden} />
        ) : (
          <p className="hb-klein">{tz('angebot.unlesbar')}</p>
        )}
        <p className="hb-klein">{tz('angebot.dortGelten')}</p>
        <button
          className="hb-kn is-gold is-haupt is-breit"
          type="button"
          data-pk-beitreten=""
          onClick={onBeitreten}
          disabled={laedt}
        >
          {tz('angebot.beitreten')}
        </button>
        <div className="hb-knopfreihe">
          <button className="hb-kn is-blau" type="button" data-pk-eigene="" onClick={onEigene} disabled={laedt}>
            {tz('angebot.eigene')}
          </button>
          <button className="hb-kn is-blau" type="button" onClick={onAbbrechen}>
            {tz('angebot.abbrechen')}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="pk-angebot" data-pk-angebot="">
      <p className="pk-angebot-titel">
        {angebot.host ? tz('angebot.titelVon', { host: angebot.host }) : tz('angebot.titel')}
      </p>
      {angebot.regeln ? (
        <Regelzeile regeln={angebot.regeln} runden={angebot.runden} />
      ) : (
        <p className="pk-warten">{tz('angebot.unlesbar')}</p>
      )}
      <p className="pk-warten">{tz('angebot.dortGelten')}</p>
      <div className="pk-wahl">
        <button className="pk-knopf is-haupt" type="button" data-pk-beitreten="" onClick={onBeitreten} disabled={laedt}>
          {tz('angebot.beitreten')}
        </button>
        <button className="pk-knopf is-neben" type="button" data-pk-eigene="" onClick={onEigene} disabled={laedt}>
          {tz('angebot.eigene')}
        </button>
      </div>
      <button className="pk-textknopf" type="button" onClick={onAbbrechen}>
        {tz('angebot.abbrechen')}
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
  neu = false,
}: {
  titel: string;
  wert: number;
  min: number;
  max: number;
  zusatz?: string;
  onWahl: (wert: number) => void;
  /** Neues Hub: dieselbe Zeile in den Farben des Spieleinstiegs. */
  neu?: boolean;
}): React.JSX.Element {
  return (
    <label className={neu ? 'spe-regler' : 'pk-reglerzeile'}>
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
