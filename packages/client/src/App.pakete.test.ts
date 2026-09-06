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
   * Tafelrunde wartet beim Antippen auf sein Paket UND auf 23 Bilder. Bis zum
   * 6.9.2026 waren das zwei Vorhaenge hintereinander: der Lade-Pinguin fuer
   * das Paket, danach der Ladebildschirm mit dem Balken fuer die Bilder.
   * Faellt der Rueckfall wieder auf `AppLaedt` zurueck, sieht man den ersten
   * Teil der Wartezeit erneut als Spinner ohne Fortschritt — und der Balken
   * danach unterschlaegt ihn. Der Import muss statisch bleiben: Ein
   * nachgeladener Rueckfall ist keiner.
   */
  it('zeigt beim Nachladen von Tafelrunde seinen Ladebildschirm, nicht den Spinner', () => {
    expect(APP).toMatch(/^import \{ Ladevorhang \} from '\.\/minispiele\/tafelrunde\/Ladevorhang';$/m);
    expect(APP).toContain('<Ladevorhang onAbbrechen=');
    // Und zwar an BEIDEN Wegen zum Schirm: Spielauswahl und Lobby/Tisch.
    expect(APP.split('<Ladevorhang onAbbrechen=')).toHaveLength(3);
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

/**
 * Derselbe Waechter eine Ebene tiefer.
 *
 * Die Avatar-Werkstatt haengt an einem Knopf im Profil-Tab; die allermeisten
 * Besucher oeffnen sie nie. `main.tsx` holt sie deshalb fuer `?dev=werkstatt`
 * per `lazy`. Stand sie in GameSelect zugleich als gewoehnlicher Import, gewann
 * der statische: Das Stueck blieb im Hauptpaket, und Vite meldete bei jedem Bau
 * "dynamically imported by main.tsx but also statically imported by
 * GameSelect.tsx" — eine Hinweiszeile, die nach einem Fehler aussieht und
 * keiner ist. Rutscht der Import zurueck, faellt es hier auf und nicht erst im
 * ueberlesenen Bauprotokoll.
 */
describe('Paketaufteilung von GameSelect.tsx', () => {
  it('laedt die Avatar-Werkstatt nach, statt sie statisch zu importieren', () => {
    expect(GAME_SELECT).not.toMatch(/^import .* from '\.\/Avatarwerkstatt';$/m);
    expect(GAME_SELECT).toContain("import('./Avatarwerkstatt')");
  });

  /*
   * Nachgeladen heisst: Zwischen Tipp und Blatt liegt eine Wartezeit. Ohne
   * eigenen Rueckfall faengt die naechste Suspense-Grenze darueber den Fall
   * ab — im schlimmsten Fall die des ganzen Schirms, und dann verschwindet
   * fuer den Moment des Nachladens die halbe Startseite.
   */
  it('haelt einen eigenen Rueckfall bereit, solange die Werkstatt laedt', () => {
    expect(GAME_SELECT).toMatch(/<Suspense(?:(?!<\/Suspense>)[\s\S])*?<Avatarwerkstatt/);
  });
});
