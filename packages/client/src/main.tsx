import { StrictMode, Suspense, lazy } from 'react';
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

/**
 * Entwickler-Werkzeug ohne Anmeldung.
 * Öffnen: /?dev=avatar  (auch /dev/avatar oder #avatar)
 * Manche Browser/Embeds liefern fälschlich ?dev%3Davatar — das fangen wir ab.
 */
function isDevAvatar(): boolean {
  const { search, hash, pathname } = window.location;
  const params = new URLSearchParams(search);
  if (params.get('dev') === 'avatar') return true;
  if (params.has('dev=avatar')) return true;
  const decoded = decodeURIComponent(search);
  if (/(?:^|[?&])dev=avatar(?:&|$)/.test(decoded)) return true;
  if (pathname === '/dev/avatar' || pathname.endsWith('/dev/avatar')) return true;
  if (hash === '#avatar' || hash === '#/dev/avatar' || hash.includes('dev=avatar')) return true;
  return false;
}

const devAvatar = isDevAvatar();
if (devAvatar && (window.location.search.includes('%3D') || window.location.pathname.includes('dev/avatar'))) {
  window.history.replaceState(null, '', '/?dev=avatar');
}

/**
 * Die Werkstatt so, wie der Spieler sie sieht — aber ohne Anmeldung.
 * Öffnen: `/?dev=werkstatt`
 *
 * Zwei Wege für dasselbe Modell, und beide haben ihren Grund: Der Ausrichter
 * ist zum Einstellen da (Regler, Gitter, Zahlen), die Werkstatt zum Prüfen,
 * wie es am Ende aussieht. Ohne diesen zweiten Weg käme man an das fertige
 * Bild nur über Anmeldung, Datenbank und Profil — für eine Frage nach dem
 * Sitz einer Mütze ist das der halbe Nachmittag.
 */
const devWerkstatt = new URLSearchParams(window.location.search).get('dev') === 'werkstatt';

/**
 * Beide Werkzeuge ziehen `three` und `@react-three/drei` nach — zusammen rund
 * 900 kB. Als gewoehnlicher Import landete das im Hauptbuendel und damit bei
 * jedem Spieler, obwohl es fuer die allermeisten nie gebraucht wird. Mit
 * `lazy` holt Vite es in ein eigenes Stueck.
 */
const AvatarAligner = lazy(() =>
  import('./screens/AvatarAligner').then((m) => ({ default: m.AvatarAligner })),
);
const Avatarwerkstatt = lazy(() =>
  import('./screens/Avatarwerkstatt').then((m) => ({ default: m.Avatarwerkstatt })),
);

const werkzeug = devAvatar ? <AvatarAligner /> : devWerkstatt ? (
  <Avatarwerkstatt onClose={() => window.history.back()} />
) : null;

createRoot(root).render(
  <StrictMode>
    {werkzeug ? (
      <Suspense fallback={<p className="muted">Werkzeug wird geladen…</p>}>{werkzeug}</Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
