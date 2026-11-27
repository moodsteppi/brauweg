import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Waechter ueber die Paketaufteilung des Clients.
 *
 * Bis zum 5.9.2026 importierte App.tsx alle vierzehn Schirme statisch: Das
 * Hauptpaket wog 1.952 kB, und wer Tafelrunde antippte, lud vorher elf andere
 * Spiele und ueber Feldherrs `Buehne3D` auch noch `three`. Ein einziger
 * zurueckgerutschter `import { X } from './screens/X'` macht das rueckgaengig
 * — Vite meldet es beim Bau nur als Hinweiszeile, die niemand liest, und die
 * uebrigen Tests bleiben gruen, weil sie die Schirme ohnehin einzeln laden.
 *
 * Geprueft wird der Quelltext, nicht der Bau: Ein Testlauf baut nicht, und
 * eine Pruefung gegen `dist/` haenge an einem vorherigen `npm run build`.
 *
 * Die Zeilenenden werden vereinheitlicht, weil die Datei auf Windows mit CRLF
 * im Arbeitsbaum liegt (core.autocrlf). Ohne das faengt kein Zeilenende-Anker
 * die Zeile, und alles hier waere still immer gruen.
 */
const APP = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8').split('\r\n').join('\n');
const GAME_SELECT = readFileSync(resolve(process.cwd(), 'src/screens/GameSelect.tsx'), 'utf8')
  .split('\r\n')
  .join('\n');

/** Schirme, die erst auf Antippen ueber die Leitung gehen duerfen. */
const NACHGELADEN = [
  'BroCooked',
  'CambioTable',
  'EasyPoker',
  'Eiland',
  'FeldherrTisch',
  // Seit dem 23.09.2026: Landeseiten der Mail-Links. App.tsx liest den Pfad
  // beim Start. (Das Blatt zum Sichern eines Gastkontos stand bis zum
  // 23.10.2026 mit hier; es hing an der Gastleiste des alten Hubs.)
  'KontoLink',
  'Filler',
  'Mememory',
  // Seit dem 22.09.2026 in der Liste: Ab da liest App.tsx beim Start den
  // Einladungslink der Partykiste — genau die Art Zeile, die einen Schirm
  // unbemerkt ins Hauptpaket zurueckholt.
  'Partykiste',
  'Profile',
  'Runner',
  'SkatTable',
  'Table',
  'TafelrundeNeu',
  'WizardTable',
];

/** Schirme, die jeder Besucher sofort braucht — die bleiben im Hauptpaket. */
const SOFORT = ['Auth', 'GameSelect', 'Lobby'];

/** Ein statischer Import genau dieses Schirms, als ganze Zeile. */
const statisch = (schirm: string): RegExp =>
  new RegExp("^import .* from '[.]/screens/" + schirm + "';$", 'm');

describe('Paketaufteilung von App.tsx', () => {
  it.each(NACHGELADEN)('%s wird nachgeladen, nicht statisch importiert', (schirm) => {
    expect(APP).not.toMatch(statisch(schirm));
    expect(APP).toContain(`import('./screens/${schirm}')`);
  });

  it.each(SOFORT)('%s bleibt im Hauptpaket', (schirm) => {
    expect(APP).toMatch(statisch(schirm));
  });

  /*
   * Die Probe aufs Exempel: Der Ausdruck oben muss auch wirklich anschlagen.
   * Ein Muster, das nichts findet, macht jede der Zeilen darueber grundlos
   * gruen — und genau das ist beim Schreiben dieses Tests passiert, weil das
   * CRLF der Datei den Zeilenende-Anker verschluckte.
   */
  it('erkennt einen statischen Import ueberhaupt', () => {
    expect("import { Tafelrunde } from './screens/Tafelrunde';").toMatch(statisch('Tafelrunde'));
    expect("import { Tafelrunde } from './screens/Tafelrunde';").not.toMatch(statisch('Table'));
  });

  /*
   * Der Suchparameter des geteilten Tischlinks wird beim Start gelesen, noch
   * bevor irgendein Bildschirm feststeht. Kaeme er aus dem Schirm
   * (`screens/TafelrundeNeu`), zoege diese eine Zeichenkette den ganzen Schirm ins
   * Hauptpaket zurueck und die Aufteilung waere fuer Tafelrunde aufgehoben.
   */
  it('holt den Tischlink aus dem eigenen kleinen Modul, nicht aus dem Schirm', () => {
    expect(APP).toContain("from './minispiele/tafelrunde/tischlink'");
  });

  /*
   * Dasselbe fuer `/beitritt/<CODE>` (22.09.2026): App.tsx liest den Code vor
   * dem ersten Bild. Kaeme er aus `Einladung.tsx`, zoege er den QR-Kodierer
   * mit ins Hauptpaket, kaeme er aus dem Schirm, gleich die ganze Partykiste.
   */
  it('liest die Mail-Links aus dem eigenen kleinen Modul, nicht aus dem Schirm', () => {
    expect(APP).toContain("from './kontolink';");
  });

  it('holt den Einladungslink aus dem eigenen kleinen Modul, nicht aus Einladung oder Schirm', () => {
    expect(APP).toContain("from './minispiele/partykiste/einladungslink';");
    expect(APP).not.toMatch(/from '\.\/minispiele\/partykiste\/(Einladung|Beitrittscode|qr)'/);
  });

  /*
   * Tafelrunde wartet beim Antippen auf sein Paket. Bis zum 6.9.2026 waren
   * das zwei Vorhaenge hintereinander: der Lade-Pinguin fuer das Paket,
   * danach ein Ladebildschirm fuer die Bilder. Faellt der Rueckfall wieder auf
   * `AppLaedt` zurueck, sieht man den ersten Teil der Wartezeit erneut als
   * Spinner. Der Import muss statisch bleiben: Ein nachgeladener Rueckfall ist
   * keiner. (Seit dem 28.11.2026 das Ladebild der neuen Oberflaeche — der
   * alte Ladevorhang ging mit dem alten Tafelrunde.)
   */
  it('zeigt beim Nachladen von Tafelrunde sein Ladebild, nicht den Spinner', () => {
    expect(APP).toMatch(/^import \{ Ladebild \} from '\.\/minispiele\/tafelrunde\/neu\/Ladebild';$/m);
    // Und zwar an BEIDEN Wegen zum Schirm: Spielauswahl und Lobby/Tisch.
    expect(APP.split('<Suspense fallback={<Ladebild onAbbrechen=')).toHaveLength(3);
  });

  /*
   * `three` und `@react-three/*` wiegen zusammen rund 900 kB. Sie haengen an
   * Avatar3D, Truhe3D, dem Runner, den Ausricht-Werkzeugen und Feldherrs
   * Buehne — alle nur ueber `lazy` erreichbar. Ein direkter Import hier holt
   * sie in das Stueck, das jeder Besucher beim Anmelden laedt.
   */
  it('zieht three nicht ins Hauptpaket', () => {
    expect(APP).not.toMatch(new RegExp("^import .* from '(three|@react-three/[^']*)';$", 'm'));
  });
});

/** Die Avatar-Werkstatt ist nur noch eine Entwicklungsansicht. */
describe('Paketaufteilung von GameSelect.tsx', () => {
  it('zieht die Entwicklungswerkstatt nicht in den Hub', () => {
    expect(GAME_SELECT).not.toContain('Avatarwerkstatt');
  });
});
