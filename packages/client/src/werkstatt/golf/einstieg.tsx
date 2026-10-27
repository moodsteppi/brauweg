/**
 * Einstieg der Bahnwerkstatt — eine eigene Seite neben der App.
 *
 * Seit dem 22.09.2026, gebaut wie der Schaukasten der Partykiste
 * (`schaukasten.html` → `src/proben/partykiste/Schaukasten.tsx`): Vite
 * liefert in der Entwicklung jede HTML-Datei im Paketordner aus, gebaut wird
 * dagegen nur `index.html`. Warum die Werkstatt NICHT ins Betriebspaket geht,
 * steht in `bahnwerkstatt.html`.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './werkstatt.css';
import { Werkstatt } from './Werkstatt';

const wurzel = document.getElementById('wurzel');
if (wurzel !== null) {
  createRoot(wurzel).render(
    <StrictMode>
      <Werkstatt />
    </StrictMode>,
  );
}
