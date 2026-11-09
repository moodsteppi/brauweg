/**
 * Sprachprobe von Farbduell (`screens/Filler.tsx`).
 *
 * Wie `proben/sprache-tische`, nur mit einem zweiten Bild: Die meisten Texte
 * von Farbduell stehen nicht im Menue, sondern am Brett (Bau-Knopf, Hinweis,
 * Warteband). Ein Brett gibt es aber nur mit Tisch, und den kann die
 * Sichtprobe weder aufmachen noch anklicken. Deshalb zeichnet `ansicht=brett`
 * das ECHTE Brett des Bildschirms (`Brett`) mit einer festen Sicht — einer
 * Extreme-Partie auf 12 × 11 mitten im Zug, nach der ersten von zwei Mauern.
 *
 *   ansicht   menue · brett
 *   spielart  nebel · klar · build · extreme (nur Menue; das Brett ist Extreme)
 *   sprache   de · en — ohne Angabe gilt, was eingestellt ist
 *
 * Aufruf: `npx vite --port 5199` in packages/client, dann
 * http://localhost:5199/sprachprobe-filler.html?ansicht=brett&sprache=en
 *
 * Hier stehen keine Oberflaechentexte; alles Sichtbare kommt aus dem
 * Bildschirm selbst. Die Sitznamen sind Daten, keine Texte.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles.css';
import '../../screens/hub-neu.css';
import '../../screens/spiel-einstieg.css';
import { setzeSprachwahl } from '../../i18n';
import { istSprache } from '../../i18n/sprachen';
import type { FillerSicht, Variante } from '../../minispiele/filler/sicht';
import { Brett, Filler } from '../../screens/Filler';

const suche = new URLSearchParams(location.search);

/**
 * Eine Wahl, die nur fuer diese Seite gilt: Der Wert im Geraet wird danach
 * zurueckgelegt. Die Probe laeuft auf derselben Herkunft wie die App — ohne
 * das Zuruecklegen stellte ein Aufruf mit `?sprache=en` die App im selben
 * Browser dauerhaft um (Muster aus `proben/sprache-tische`).
 */
function nurFuerDieseSeite(schluessel: string, setzen: () => void): void {
  let vorher: string | null = null;
  try {
    vorher = localStorage.getItem(schluessel);
  } catch {
    // Gesperrter Speicher: dann gibt es auch nichts zu verstellen.
  }
  setzen();
  try {
    if (vorher === null) localStorage.removeItem(schluessel);
    else localStorage.setItem(schluessel, vorher);
  } catch {
    // s. o.
  }
}

const sprache = suche.get('sprache');
if (istSprache(sprache)) nurFuerDieseSeite('brauweg.sprache', () => setzeSprachwahl(sprache));

const SPIELARTEN: readonly Variante[] = ['nebel', 'klar', 'build', 'extreme'];
const spielart = suche.get('spielart') as Variante | null;
// Der Bildschirm liest die Spielart beim ersten Zeichnen aus dem Speicher.
// Hier bleibt sie stehen — zurueckgelegt wird erst beim Verlassen der Seite.
if (spielart && SPIELARTEN.includes(spielart)) {
  let vorher: string | null = null;
  try {
    vorher = localStorage.getItem('filler.variante');
    localStorage.setItem('filler.variante', spielart);
  } catch {
    // Gesperrter Speicher: Dann zeigt das Menue seine Vorgabe.
  }
  addEventListener('pagehide', () => {
    try {
      if (vorher === null) localStorage.removeItem('filler.variante');
      else localStorage.setItem('filler.variante', vorher);
    } catch {
      // s. o.
    }
  });
}

/** Extreme auf 12 × 11, Sitz 0 am Zug, die erste von zwei Mauern gesetzt. */
function extremeSicht(): FillerSicht {
  const spalten = 12;
  const zeilen = 11;
  const plaetze = spalten * zeilen;
  const eigen = new Set([120, 121, 108, 122, 109]);
  const fremd = new Set([11, 10, 23, 9]);
  const feld = Array.from({ length: plaetze }, (_, p) => {
    if (eigen.has(p)) return 0;
    if (fremd.has(p)) return 3;
    const x = p % spalten;
    const y = Math.floor(p / spalten);
    return (x * 3 + y * 5 + Math.floor(x / 3)) % 7;
  });
  return {
    ich: 0,
    variante: 'extreme',
    spalten,
    zeilen,
    farbzahl: 7,
    feld,
    grau: feld.map(() => 0),
    besitzer: feld.map((_, p) => (eigen.has(p) ? 0 : fremd.has(p) ? 1 : null)),
    farbe: { 0: 0, 1: 3 },
    punkte: { 0: 5, 1: 4 },
    dran: 0,
    zug: 9,
    fertig: false,
    sieger: null,
    leftSeats: [],
    zuschauer: false,
    barrieren: [
      [97, 98],
      [85, 97],
      [34, 35],
    ],
    barrierenUebrig: { 0: 17, 1: 20 },
    barrierenMoeglich: [
      [110, 111],
      [98, 110],
      [96, 108],
    ],
    sterne: [14, 29, 40, 55, 76, 91, 102, 117],
    mauerSperre: 0,
    mauernJeZug: 2,
    mauernDiesenZug: 1,
    mauerPause: [],
    aufgegeben: null,
  };
}

const nichts = (): void => {};

function Seite(): React.JSX.Element {
  if (suche.get('ansicht') === 'brett') {
    return (
      <Brett
        sicht={extremeSicht()}
        eigenerSitz={0}
        sitze={[
          { seat: 0, displayName: 'Mia', avatarUrl: null, isBot: false },
          { seat: 1, displayName: null, avatarUrl: null, isBot: true },
        ]}
        binDran
        gegenBot
        getippt={null}
        onWaehle={nichts}
        onBarriere={nichts}
        onZurueck={nichts}
        frist={Date.now() + 42_000}
        onAufgeben={nichts}
      />
    );
  }
  return <Filler startTisch={null} onBack={nichts} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Ein Rahmen ueber die ganze Seite: Bildschirm und Brett stehen „fixed",
        und die Sichtprobe braucht ein sichtbares Element in voller Breite.
        `transform` macht ihn zum Bezugsrahmen der fixed-Kinder. */}
    <div
      data-probe-seite
      style={{ width: '100vw', height: '100vh', position: 'relative', transform: 'translateZ(0)' }}
    >
      <Seite />
    </div>
  </StrictMode>,
);
