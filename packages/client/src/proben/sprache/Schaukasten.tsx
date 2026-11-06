/**
 * Sprach-Schaukasten für BroCooked und Browort.
 *
 * Zeichnet die ECHTEN Bildschirme mit erfundenen Daten, ohne Server und ohne
 * Anmeldung — dieselbe Idee wie der Zauberer-Schaukasten. Entstanden mit der
 * englischen Fassung beider Spiele (Projekt „BroweGGames Language"): Die
 * Gruppe am Tisch, der Feierabend, die fertige Browort-Runde mit Statistik
 * und die vier Clanwort-Lagen sieht man im Betrieb nur mit mehreren Geräten,
 * einmal am Tag oder als Ausgeloster — und die Sichtprobe kann nicht klicken.
 *
 * Aufruf in der Entwicklung: `npm run dev:client`, dann
 * http://localhost:5173/sprachprobe-schaukasten.html?fall=browort-geloest&sprache=en
 *
 *   fall    ein Name aus FAELLE (faelle.tsx) — ohne Angabe stehen alle untereinander
 *   sprache de · en — ohne Angabe gilt, was eingestellt ist
 *
 * Jeder Fall steht in einem Element mit `data-fall="<name>"`, 390 px breit.
 * Knöpfe schicken nichts ab; die Küche steht still (kein Motor, der weiterläuft).
 *
 * **Hier stehen keine Oberflächentexte.** Alles Sichtbare kommt aus den
 * Bildschirmen selbst; erfunden sind nur Daten (Namen, Wörter, Zahlen). Eine
 * Meldung, die im Betrieb aus einem Fehlerschlüssel entsteht, kommt auch hier
 * über `t()` — sonst stünde im englischen Bild ein deutscher Satz, den der
 * Schaukasten selbst hineingeschrieben hat.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles.css';
import '../../screens/hub-neu.css';
import '../../screens/spiel-einstieg.css';
import '../../screens/brocooked-einstieg.css';
import { setzeSprachwahl } from '../../i18n';
import { istSprache } from '../../i18n/sprachen';
import { FAELLE } from './faelle';

// Vor dem ersten Rendern: Die Bildschirme lesen die Sprache beim Zeichnen.
const suche = new URLSearchParams(location.search);
const sprache = suche.get('sprache');
if (istSprache(sprache)) setzeSprachwahl(sprache);
const nurFall = suche.get('fall');

function Seite(): React.JSX.Element {
  const faelle = nurFall === null ? FAELLE : FAELLE.filter((f) => f.name === nurFall);
  if (faelle.length === 0) {
    return (
      <p style={{ padding: 20 }}>
        Unbekannter Fall „{nurFall}“. Es gibt: {FAELLE.map((f) => f.name).join(', ')}
      </p>
    );
  }
  return (
    <div className="sk-seite">
      {faelle.map((f) => (
        <figure key={f.name} className="sk-kasten">
          <figcaption>
            <strong>{f.name}</strong> · {f.was}
          </figcaption>
          <div className="sk-rahmen" data-fall={f.name} style={{ height: f.hoehe ?? 780 }}>
            {f.zeige()}
          </div>
        </figure>
      ))}
    </div>
  );
}

if (nurFall !== null) document.body.classList.add('sk-einzeln');

createRoot(document.getElementById('wurzel')!).render(
  <StrictMode>
    <Seite />
  </StrictMode>,
);
