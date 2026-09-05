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

/** Schirme, die erst auf Antippen ueber die Leitung gehen duerfen. */
const NACHGELADEN = [
  'CambioTable',
  'EasyPoker',
  'Eiland',
  'FeldherrTisch',
  'Filler',
  'Mememory',
  'Profile',
  'Runner',
  'SkatTable',
  'Table',
  'Tafelrunde',
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
   * bevor irgendein Bildschirm feststeht. Kaeme er wie frueher aus
   * `screens/Tafelrunde`, zoege diese eine Zeichenkette den ganzen Schirm ins
   * Hauptpaket zurueck und die Aufteilung waere fuer Tafelrunde aufgehoben.
   */
  it('holt den Tischlink aus dem eigenen kleinen Modul, nicht aus dem Schirm', () => {
    expect(APP).toContain("from './minispiele/tafelrunde/tischlink'");
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
