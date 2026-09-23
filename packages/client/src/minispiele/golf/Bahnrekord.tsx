import { useEffect, useState } from 'react';

import { api } from '../../api';
import { t } from '../../i18n';
import { Bahnrekordspeicher, bestmarkenJeBahn, neuigkeit, type Bahnrekordstand } from './rekord';

/**
 * Bahnrekord im Zwischenstand von Golf: „Bahnrekord: 3 (Anna) · dein
 * Bestes: 4", und wenn das eben gespielte Loch besser war, leuchtet es.
 *
 * Seit dem 22.09.2026, in einer eigenen Datei, damit `screens/Golf.tsx` nur
 * zwei Einhaengezeilen bekommt. Die Rechnung steht in `rekord.ts`.
 */

/**
 * Der Stand der Bahn, die gerade gespielt wird — geholt, sobald das Loch
 * BEGINNT, damit er in der Pause schon da ist.
 *
 * Der Speicher lebt so lange wie der Aufrufer (eine Partie) und fragt je
 * Bahn genau einmal. Der Effekt haengt an der Kennung, nicht an einem Objekt
 * (CLAUDE.md, „React-Effekte an einen Schlüssel hängen"): Die Tafel wird
 * jede Sekunde neu gebaut, die Bahn wechselt nur zwischen zwei Löchern.
 */
export function useBahnrekord(bahnId: string | null): Bahnrekordstand | null {
  const [speicher] = useState(() => new Bahnrekordspeicher((id) => api.bestenliste('golf', id)));
  const [stand, setStand] = useState<{ bahnId: string; stand: Bahnrekordstand | null } | null>(
    null,
  );

  useEffect(() => {
    if (bahnId === null) return;
    let lebt = true;
    void speicher.hole(bahnId).then((s) => {
      if (lebt) setStand({ bahnId, stand: s });
    });
    return () => {
      lebt = false;
    };
  }, [speicher, bahnId]);

  // Der Stand einer VORIGEN Bahn gehoert nicht unter dieses Loch.
  return stand !== null && stand.bahnId === bahnId ? stand.stand : null;
}

/**
 * Die Zeile selbst. Ohne Stand (noch unterwegs, Server nicht erreichbar)
 * zeigt sie nichts: Eine halbe Zeile oder ein „lädt …" in einer Tafel, die
 * nach wenigen Sekunden wieder verschwindet, waere nur Unruhe.
 *
 * `schlaege` ist die eigene Zahl dieses Lochs, aber NUR wenn der Ball
 * gefallen ist — sonst null (siehe `neuigkeit`). `zaehlt` sagt, ob der Tisch
 * fuer die Bestenliste zaehlt; sitzt ein Gast dabei, leuchtet nichts.
 */
export function Bahnrekord({
  stand,
  schlaege,
  zaehlt,
}: {
  stand: Bahnrekordstand | null;
  schlaege: number | null;
  zaehlt: boolean;
}): React.JSX.Element | null {
  if (stand === null) return null;
  const neu = neuigkeit(stand, schlaege, zaehlt);
  const rekord =
    stand.rekord === null
      ? t('golf.rekord.keiner')
      : `${stand.rekord.wert} (${stand.rekord.du ? t('golf.rekord.du') : stand.rekord.name})`;
  const eigenes = stand.eigenes === null ? '–' : String(stand.eigenes);

  return (
    <div className="grek" data-grek-neu={neu.bahnrekord || neu.eigenesBestes ? '' : undefined}>
      <p className="grek-zeile">
        {t('golf.rekord.bahn')}: <strong>{rekord}</strong> · {t('golf.rekord.eigenes')}:{' '}
        <strong>{eigenes}</strong>
      </p>
      {neu.bahnrekord ? (
        <p className="grek-neu" data-grek-art="bahn">
          {t('golf.rekord.neuBahn')}
        </p>
      ) : neu.eigenesBestes ? (
        <p className="grek-neu" data-grek-art="eigen">
          {t('golf.rekord.neuEigen')}
        </p>
      ) : null}
    </div>
  );
}

const KEINE_MARKEN: ReadonlyMap<string, number> = new Map();

/**
 * Die eigenen Bestmarken je Bahn fuer die Einzelauswahl der Bahnauswahl,
 * einmal geholt, sobald `an` wahr wird (die Einzelauswahl offen ist) — nicht
 * je Kachel und nicht bei jedem Tippen in die Suche.
 *
 * Scheitert der Abruf (Server alt, kein Netz), bleiben die Kacheln ohne
 * Marke; die Auswahl selbst haengt nicht daran.
 */
export function useBestmarken(an: boolean): ReadonlyMap<string, number> {
  const [marken, setMarken] = useState<ReadonlyMap<string, number> | null>(null);
  const geholt = marken !== null;

  useEffect(() => {
    if (!an || geholt) return;
    let lebt = true;
    // Ueber ein Versprechen gestartet, damit auch ein sofort werfender Aufruf
    // hier endet und nicht im Effekt.
    void Promise.resolve()
      .then(() => api.eigeneBestleistungen('golf'))
      .then(bestmarkenJeBahn)
      .catch(() => KEINE_MARKEN)
      .then((m) => {
        if (lebt) setMarken(m);
      });
    return () => {
      lebt = false;
    };
  }, [an, geholt]);

  return marken ?? KEINE_MARKEN;
}
