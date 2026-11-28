/**
 * Die Schnellsuche: Restzeit und die Wartenden, wie sie einlaufen.
 *
 * Die Wartenden kommen seit dem 27.11.2026 mit Name und Bild aus dem
 * Suchstand (`wartende`, Reihenfolge des Eintreffens, man selbst inklusive).
 * Jeder bekommt seine Kachel mit einer Einlauf-Bewegung — sie haengt am
 * SCHLUESSEL (der Kennung), also laeuft sie fuer jeden genau einmal, auch
 * wenn der Stand jede Sekunde neu kommt.
 *
 * Ohne Bild steht ein Anfangsbuchstabe auf einem Farbkreis statt eines
 * `<img>` — ein leerer Kasten saehe nach Fehler aus (CLAUDE.md).
 */

import { useState } from 'react';

import { tz, tzAnzahl } from '../text';
import stil from './neu.module.css';
import { Seite } from './Seite';

export interface Wartender {
  id: string;
  name: string;
  bildUrl: string | null;
}

/** Ein Bild, das beim Ausfall auf den Buchstaben zurueckfaellt. */
export function Gesicht({ name, bildUrl, klasse }: { name: string; bildUrl: string | null; klasse?: string }): React.JSX.Element {
  const [kaputt, setKaputt] = useState<string | null>(null);
  if (bildUrl && bildUrl !== kaputt) {
    return (
      <img className={`${stil.gesicht} ${klasse ?? ''}`.trim()} src={bildUrl} alt="" onError={() => setKaputt(bildUrl)} />
    );
  }
  return (
    <span className={`${stil.gesicht} ${klasse ?? ''}`.trim()} data-ersatz="" aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

export function SucheSeite({
  sekunden,
  wartende,
  suchende,
  onAbbrechen,
}: {
  sekunden: number;
  wartende: readonly Wartender[];
  /** Die alte Zahl — gilt, wenn ein Server ohne `wartende` antwortet. */
  suchende: number;
  onAbbrechen: () => void;
}): React.JSX.Element {
  const anzahl = Math.max(wartende.length, suchende);
  return (
    <Seite
      titel={tz('neu.suche.titel')}
      unter={tzAnzahl('neu.suche.gefunden', anzahl)}
      zurueckText={tz('suche.abbrechen')}
      onZurueck={onAbbrechen}
      fuss={
        <button type="button" className={stil.zweitknopf} onClick={onAbbrechen}>
          {tz('suche.abbrechen')}
        </button>
      }
    >
      <div className={stil.restzeit} role="timer" aria-label={tz('neu.suche.restzeit', { n: sekunden })}>
        <strong>{sekunden}</strong>
        <span>{tz('neu.suche.sekunden')}</span>
      </div>
      <ul className={stil.wartende} aria-live="polite">
        {wartende.map((w) => (
          <li key={w.id} className={stil.wartender}>
            <Gesicht name={w.name} bildUrl={w.bildUrl} />
            <span>{w.name}</span>
          </li>
        ))}
      </ul>
      <p className={stil.klein}>{anzahl <= 1 ? tz('suche.niemand') : tz('neu.suche.botsFuellen')}</p>
    </Seite>
  );
}
