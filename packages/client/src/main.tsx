import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { FeedbackWidget } from './FeedbackWidget';
import { starteKlang } from './klang';
import './styles.css';

// Vor dem ersten Bild: Die Tonsitzung muss als "ambient" angemeldet sein,
// bevor irgendetwas klingt, sonst haelt iOS beim ersten Ton die Musik in
// anderen Apps an. Geladen wird dabei noch nichts.
starteKlang();

const root = document.getElementById('root');
if (!root) throw new Error('Kein Wurzelelement gefunden');

/**
 * Entwickler-Werkzeuge ohne Anmeldung.
 * - /?dev=avatar — Mütze auf Pinguin
 * - /?dev=chest — Deckel auf Truhe
 * - /?dev=werkstatt — Avatar-Vorschau wie im Spiel
 * - /?dev=runner — Endless-Runner-Platzhalter
 * - /?dev=truhe — Truhenöffnung
 * Manche Browser/Embeds liefern fälschlich ?dev%3D… — das fangen wir ab.
 */
function isDevFlag(name: string): boolean {
  const { search, hash, pathname } = window.location;
  const params = new URLSearchParams(search);
  if (params.get('dev') === name) return true;
  if (params.has(`dev=${name}`)) return true;
  const decoded = decodeURIComponent(search);
  if (new RegExp(`(?:^|[?&])dev=${name}(?:&|$)`).test(decoded)) return true;
  if (pathname === `/dev/${name}` || pathname.endsWith(`/dev/${name}`)) return true;
  if (hash === `#${name}` || hash === `#/dev/${name}` || hash.includes(`dev=${name}`)) return true;
  return false;
}

const devAvatar = isDevFlag('avatar');
const devChest = isDevFlag('chest');
const devWerkstatt = isDevFlag('werkstatt');
const devRunner = isDevFlag('runner');
/**
 * Die Truhenoeffnung so, wie der Spieler sie sieht — ohne Anmeldung.
 * Oeffnen: `/?dev=truhe`
 *
 * Aus demselben Grund wie `?dev=werkstatt`: An die fertige Bewegung kaeme man
 * sonst nur ueber Anmeldung, Datenbank und eine tatsaechlich offene Truhe.
 */
const devTruhe = isDevFlag('truhe');

if (
  (devAvatar || devChest || devWerkstatt || devRunner || devTruhe) &&
  (window.location.search.includes('%3D') || window.location.pathname.includes('/dev/'))
) {
  const flag = devAvatar
    ? 'avatar'
    : devChest
      ? 'chest'
      : devWerkstatt
        ? 'werkstatt'
        : devRunner
          ? 'runner'
          : 'truhe';
  window.history.replaceState(null, '', `/?dev=${flag}`);
}

/**
 * Beide Werkzeuge ziehen `three` und `@react-three/drei` nach — zusammen rund
 * 900 kB. Als gewoehnlicher Import landete das im Hauptbuendel und damit bei
 * jedem Spieler, obwohl es fuer die allermeisten nie gebraucht wird. Mit
 * `lazy` holt Vite es in ein eigenes Stueck.
 */
const AvatarAligner = lazy(() =>
  import('./screens/AvatarAligner').then((m) => ({ default: m.AvatarAligner })),
);
const ChestAligner = lazy(() =>
  import('./screens/ChestAligner').then((m) => ({ default: m.ChestAligner })),
);
const Avatarwerkstatt = lazy(() =>
  import('./screens/Avatarwerkstatt').then((m) => ({ default: m.Avatarwerkstatt })),
);
const Runner = lazy(() => import('./screens/Runner').then((m) => ({ default: m.Runner })));
const TruhenOeffnung = lazy(() =>
  import('./TruhenOeffnung').then((m) => ({ default: m.TruhenOeffnung })),
);

const werkzeug = devAvatar ? (
  <AvatarAligner />
) : devChest ? (
  <ChestAligner />
) : devWerkstatt ? (
  /* Mit Wollmütze, weil die Strecke genau dafür da ist: die Figur samt
     Zubehör ansehen, ohne sich anzumelden. Ohne sie prüft man hier nur den
     nackten Pinguin und hält die Mütze für kaputt. */
  <Avatarwerkstatt
    getragen={{ hut: 'hut-wollmuetze' }}
    onClose={() => window.history.back()}
  />
) : devRunner ? (
  <Runner />
) : devTruhe ? (
  <TruhenOeffnung grad="gold" muenzen={120} onFertig={() => window.location.reload()} />
) : null;

createRoot(root).render(
  <StrictMode>
    {werkzeug ? (
      <Suspense fallback={<p className="muted">Werkzeug wird geladen…</p>}>{werkzeug}</Suspense>
    ) : (
      <>
        <App />
        <FeedbackWidget />
      </>
    )}
  </StrictMode>,
);
