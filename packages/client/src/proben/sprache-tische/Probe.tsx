/**
 * Sprachprobe der Einstiege von Golf, Mememory, Eiland und Feldherr.
 *
 * Zeichnet den ECHTEN Bildschirm des Spiels ohne Tisch — so, wie man ihn
 * nach dem Antippen im Hub sieht. Ohne Server: Was der Bildschirm nachlädt
 * (Konto, Sammlung, offene Tische), schlägt fehl, und er zeigt seinen Stand
 * ohne diese Daten. Für die Texte genügt das, und die Sichtprobe kann weder
 * anmelden noch klicken.
 *
 *   spiel    golf · mememory · eiland · feldherr
 *   sprache  de · en — ohne Angabe gilt, was eingestellt ist (Automatisch:
 *            die Gerätesprache)
 *
 * Hier stehen keine Oberflächentexte; alles Sichtbare kommt aus den
 * Bildschirmen selbst.
 */

import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles.css';
import '../../screens/hub-neu.css';
import '../../screens/spiel-einstieg.css';
import { setzeSprachwahl } from '../../i18n';
import { istSprache } from '../../i18n/sprachen';
import { Eiland } from '../../screens/Eiland';
import { FeldherrTisch } from '../../screens/FeldherrTisch';
import { Golf } from '../../screens/Golf';
import { Mememory } from '../../screens/Mememory';

// Vor dem ersten Zeichnen: Die Bildschirme lesen die Sprache beim Zeichnen.
const suche = new URLSearchParams(location.search);
const sprache = suche.get('sprache');
if (istSprache(sprache)) {
  // `setzeSprachwahl` merkt sich die Wahl im Geraet (`brauweg.sprache`, siehe
  // `i18n/index.ts`). Die Probe laeuft auf derselben Herkunft wie die App —
  // ohne das Zuruecklegen stellte ein Aufruf mit `?sprache=en` die App im
  // selben Browser dauerhaft auf Englisch um. Die Wahl gilt deshalb nur fuer
  // diese Seite, der gespeicherte Wert bleibt, wie er war.
  const SPEICHER = 'brauweg.sprache';
  let vorher: string | null = null;
  try {
    vorher = localStorage.getItem(SPEICHER);
  } catch {
    // Gesperrter Speicher: dann gibt es auch nichts zu verstellen.
  }
  setzeSprachwahl(sprache);
  try {
    if (vorher === null) localStorage.removeItem(SPEICHER);
    else localStorage.setItem(SPEICHER, vorher);
  } catch {
    // s. o.
  }
}

const zurueck = (): void => {};

function Seite({ spiel }: { spiel: string | null }): React.JSX.Element {
  switch (spiel) {
    case 'golf':
      return <Golf startTisch={null} onBack={zurueck} />;
    case 'mememory':
      return <Mememory startTisch={null} istAufsicht={false} onBack={zurueck} />;
    case 'eiland':
      return <Eiland startTisch={null} onBack={zurueck} />;
    case 'feldherr':
      return <FeldherrTisch onBack={zurueck} />;
    default:
      return <p style={{ padding: 20 }}>?spiel=golf · mememory · eiland · feldherr</p>;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {/* Ein Rahmen über die ganze Seite: Die Einstiege stehen „fixed", und
          die Sichtprobe braucht ein sichtbares Element in voller Breite. */}
      <div data-probe-seite style={{ width: '100%', minHeight: '100vh' }}>
        <Seite spiel={suche.get('spiel')} />
      </div>
    </Suspense>
  </StrictMode>,
);
