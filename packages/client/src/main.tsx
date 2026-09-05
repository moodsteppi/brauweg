import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { installiereDruckabbruch } from './druckabbruch';
import { FeedbackWidget } from './FeedbackWidget';
import { starteKlang } from './klang';
import './styles.css';

// Vor dem ersten Bild: Die Tonsitzung muss als "ambient" angemeldet sein,
// bevor irgendetwas klingt, sonst haelt iOS beim ersten Ton die Musik in
// anderen Apps an. Geladen wird dabei noch nichts.
starteKlang();

// Ebenfalls vor dem ersten Bild und einmal fuer alles: Ein Knopf, von dem
// der Finger weit weggezogen wurde, loest nicht aus (siehe druckabbruch.ts).
installiereDruckabbruch();

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

/**
 * Proben unter `/probe/…` — Entwuerfe, die nebeneinander verglichen werden
 * sollen, bevor einer davon ins Spiel kommt.
 *
 * Getrennt von den `?dev=`-Werkzeugen oben, weil sie etwas anderes sind: Ein
 * Werkzeug bleibt, eine Probe wird verworfen oder eingebaut. Sie sind im Spiel
 * nirgends verlinkt und nur ueber die Adresse erreichbar; der Server liefert
 * fuer jeden Pfad ohne Dateiendung die index.html aus (siehe
 * `setNotFoundHandler` in `packages/server/src/http/app.ts`), Vite tut das in
 * der Entwicklung von selbst.
 *
 * - /probe/arena-2d — Arena-Szene in 2D mit animierten Sprites (Probe A)
 * - /probe/arena-3d — DIESELBE Szene in 3D mit Three.js (Probe B)
 * - /probe/kampf — die ECHTE Kampfanzeige des Spiels mit einem aufgezeichneten
 *   Kampf aus Runde 10. Die einzige der drei, die bleiben soll: Sie ist die
 *   Stelle, an der man Aenderungen an der Kampfanzeige ansieht, ohne eine
 *   Partie zu spielen (siehe Kopf von `proben/kampf/ProbeKampf.tsx`).
 */
function istProbe(name: string): boolean {
  const { pathname, hash, search } = window.location;
  if (pathname === `/probe/${name}`) return true;
  if (hash === `#/probe/${name}`) return true;
  return new URLSearchParams(search).get('probe') === name;
}

const probeArena2d = istProbe('arena-2d');
const probeArena3d = istProbe('arena-3d');
const probeKampf = istProbe('kampf');

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
/*
 * Aus demselben Grund `lazy` wie die Werkzeuge darueber: Die Probe zieht die
 * aufgezeichnete Szene (16 kB JSON) mit ins Buendel. Die gehoert nicht in das
 * Stueck, das jeder Spieler beim Anmelden laedt.
 */
const Arena2D = lazy(() => import('./proben/arena-2d/Arena2D').then((m) => ({ default: m.Arena2D })));
const TruhenOeffnung = lazy(() =>
  import('./TruhenOeffnung').then((m) => ({ default: m.TruhenOeffnung })),
);
/* Aus demselben Grund `lazy`, hier aber mit deutlich mehr Gewicht dahinter:
   Probe B zieht `three` und `@react-three/fiber` nach. Was davon schon im
   Hauptbuendel steckt, ist eine andere Baustelle (Avatarwerkstatt wird von
   GameSelect statisch importiert und landet deshalb dort) — die Probe selbst
   soll jedenfalls nichts dazulegen. */
const Arena3D = lazy(() => import('./proben/arena-3d/Arena3D').then((m) => ({ default: m.Arena3D })));
/* Aus demselben Grund `lazy` wie die Proben darueber, hier aber mit einem
   zweiten dazu: Die Probe zieht den aufgezeichneten Kampf (rund 30 kB JSON)
   UND die Bauteile des Tafelrunde-Tisches nach. Beides gehoert nicht in das
   Stueck, das jeder Spieler beim Anmelden laedt — und am Client wird gerade
   ohnehin daran gearbeitet, die Spielschirme einzeln nachzuladen. */
const ProbeKampf = lazy(() =>
  import('./proben/kampf/ProbeKampf').then((m) => ({ default: m.ProbeKampf })),
);

const werkzeug = probeArena2d ? (
  <Arena2D />
) : probeArena3d ? (
  <Arena3D />
) : probeKampf ? (
  <ProbeKampf />
) : devAvatar ? (
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
