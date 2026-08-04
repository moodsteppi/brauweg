import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { starteKlang } from './klang';
import './styles.css';

// Vor dem ersten Bild: Die Tonsitzung muss als "ambient" angemeldet sein,
// bevor irgendetwas klingt, sonst haelt iOS beim ersten Ton die Musik in
// anderen Apps an. Geladen wird dabei noch nichts.
starteKlang();

const root = document.getElementById('root');
if (!root) throw new Error('Kein Wurzelelement gefunden');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
