import { useEffect, useState } from 'react';

import { api } from '../api';
import { spiele } from '../klang';
import { Pinguin } from '../pinguin';
import { merkeGefeiert } from './gefeiert';
import './lernen.css';

/**
 * Die Feier zum Doko-Meister — einmal je Geraet.
 *
 * Das Outfit kann auf zwei Wegen kommen: am Ende einer Lektion (dann feiert
 * LektionSpieler.tsx selbst) oder am Ende einer Uebungsrunde. Im zweiten Fall
 * sitzt man am Tisch und sieht nichts davon — der Server vergibt es beim
 * Abrechnen. Deshalb fragt der Start `me.lernen.belohnt` und zeigt die Feier,
 * bis sie hier einmal gesehen wurde.
 */

export function MeisterFeier({ outfit, onClose, onAngezogen }: { outfit: readonly string[]; onClose: () => void; onAngezogen: () => void }): React.JSX.Element {
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    merkeGefeiert();
    spiele('truhe');
  }, []);

  const anziehen = (): void => {
    setLaeuft(true);
    void Promise.all(outfit.map((id) => api.wear(id.startsWith('hut-') ? 'hut' : 'oberteil', id)))
      .then(onAngezogen)
      .catch(() => undefined)
      .finally(onClose);
  };

  return (
    <div className="hb-voll ln-lektion" role="dialog" aria-modal="true" aria-label="Doko-Meister">
      <div className="ln-lektion-rolle">
        <div className="ln-ende ln-feier">
          <div className="ln-feier-pinguin">
            <Pinguin getragen={{ hut: 'hut-doktorhut', oberteil: 'oberteil-meisterrobe' }} groesse={13} titel="Pinguin als Doko-Meister" />
          </div>
          <h2>Doko-Meister!</h2>
          <p>Sieben Tage am Stück Doppelkopf gelernt. Dein Pinguin hat sich Doktorhut und Meisterrobe verdient - beides liegt jetzt in deinem Kleiderschrank.</p>
        </div>
      </div>
      <footer className="ln-fuss">
        <button type="button" className="hb-kn is-gold is-haupt is-breit" disabled={laeuft} onClick={anziehen}>
          Gleich anziehen
        </button>
        <button type="button" className="hb-kn is-haupt is-breit ln-kn-leise" onClick={onClose}>
          Später
        </button>
      </footer>
    </div>
  );
}
