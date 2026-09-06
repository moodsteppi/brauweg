/**
 * Baut die beiden Artefakte des Feldherr-Spiels aus den Quellmodulen unter
 * quelle/teile/:
 *
 *   1. quelle/feldherr.html — die eigenstaendige Spieldatei (Doppelklick)
 *   2. packages/client/src/minispiele/feldherr/kern.js — der Spielkern des
 *      Clients samt Gleichschritt-Anbindung
 *
 *     node packages/game-feldherr/werkzeug/bauen.mjs
 *
 * Stufe 1 des 3D-Strukturumbaus (docs/FELDHERR-3D-UMBAU.md): Die
 * Erzeugungsrichtung ist umgedreht. Frueher schnitt kern-erzeugen.mjs den
 * Kern AUS der HTML-Datei; jetzt sind die Module die Quelle, und beide
 * Artefakte werden daraus gebaut. feldherr.html und kern.js von Hand zu
 * aendern ist damit sinnlos — der naechste Bau ueberschreibt beides.
 *
 * Die Teile, in Bau-Reihenfolge (spaetere Teile greifen auf fruehere zu;
 * Funktionsdeklarationen werden ueber die Teilgrenzen hinweg gehoistet):
 *
 *   kopf.html         Dokumentationskopf und <head> der Spieldatei
 *   stil.css          Gestaltung von HUD, Karten, Overlays, Menue
 *   huelle.html       Buehne, Kartenleisten, alle Overlays
 *   karten.js         Teil 0: Kartenkatalog, Charaktere und die reine
 *                     Werte-Rechnung. Steht als EINZIGER Teil VOR der
 *                     Spielfunktion, im Modulrahmen: Die Auswahl im
 *                     Bildschirm zeigt die Werteseite jeder Karte, bevor
 *                     eine Partie laeuft, und darf die Zahlen deshalb
 *                     nicht aus einem laufenden Kern abgreifen. Zweimal
 *                     gepflegte Zahlen liefen mit dem ersten
 *                     Balance-Schritt auseinander.
 *   simulation.js     Teil 1: Regeln und Zustand G, update(dt), Saatkorn-
 *                     Zufall — OHNE DOM, ohne Canvas, ohne Uhr. Der
 *                     Waechter unten erzwingt das bei jedem Bau.
 *   darstellung.js    Teile 2-4: Projektion P(), Gelaende, Figuren, Effekte,
 *                     Bildaufbau — der komplette 2D-Renderer. Stufe 2 stellt
 *                     den 3D-Renderer NEBEN dieses Modul, nicht darueber.
 *   ki.js             Teil 6: die KI (ebenfalls DOM-frei)
 *   oberflaeche.js    Teil 5: Bedienleisten, Eingabe, Menue, Bildschleife.
 *                     Hier leben noch die Befehlsfunktionen (playCard,
 *                     setzeHaus, ...), weil sie HUD-Aufrufe enthalten —
 *                     ihr Umzug in die Simulation ist der naechste
 *                     Feinschnitt und braucht eine Verhaltenspruefung,
 *                     kein Byte-Vergleich.
 *   anbindung-kopf.js / anbindung-fuss.js
 *                     Die Gleichschritt-Anbindung des Client-Kerns
 *                     (Wissensgrenze, Meldepuffer, schwebende Zuege,
 *                     Pruefsummen). Die Platzhalter <<STIL>> und <<HUELLE>>
 *                     fuellt der Bauer aus stil.css und huelle.html.
 *
 * Alle Ausgaben sind LF-normiert, egal wie der Checkout aussieht. Der alte
 * Weg erbte die Zeilenenden des Arbeitsbaums — der erzeugte kern.js sah je
 * nach Plattform anders aus (\r\n-Escapes in STIL/HUELLE).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const pfad = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const lf = (s) => s.replace(/\r\n/g, '\n');
const teil = (name) => lf(readFileSync(pfad('../quelle/teile/' + name), 'utf8'));

const kopf = teil('kopf.html');
const karten = teil('karten.js');
const stil = teil('stil.css');
const huelle = teil('huelle.html');
const simulation = teil('simulation.js');
const darstellung = teil('darstellung.js');
const ki = teil('ki.js');
const oberflaeche = teil('oberflaeche.js');
const anbindungKopf = teil('anbindung-kopf.js');
const anbindungFuss = teil('anbindung-fuss.js');

// ---------------------------------------------------------------------------
// ERZEUGT-Banner — die ALLERERSTEN Zeilen beider Artefakte.
//
// Der Hinweis stand frueher tief in der Datei (in kern.js erst um Zeile 256,
// hinter dem kompletten Kartenkatalog) — Menschen, Reviews und Sprachmodelle
// lasen und aenderten die Artefakte, bevor sie ihn erreichten. Deshalb baut
// der Bauer den Banner selbst an den Anfang, statt ihn einem Teil zu
// ueberlassen: Kein Umsortieren der Teile kann ihn je wieder nach hinten
// schieben. @generated verstehen gaengige Review-Werkzeuge und falten die
// Datei im Diff zusammen.
// ---------------------------------------------------------------------------
const bannerZeilen = [
  '@generated MASCHINELL ERZEUGT — NICHT LESEN, NICHT VON HAND AENDERN.',
  'Quelle:  packages/game-feldherr/quelle/teile/',
  'Bau:     node packages/game-feldherr/werkzeug/bauen.mjs',
  'Der naechste Bau ueberschreibt diese Datei vollstaendig.',
];
const bannerJs = '/**\n' + bannerZeilen.map((z) => ' * ' + z).join('\n') + '\n */\n';
const bannerHtml = '<!--\n' + bannerZeilen.map((z) => '  ' + z).join('\n') + '\n-->\n';

// ---------------------------------------------------------------------------
// Waechter 1: Simulation und KI bleiben DOM-frei.
//
// Der wertvollste Teil des Codes ist der ueber sechs Live-Fehler gehaertete
// Determinismus. Ein document-Zugriff in der Simulation waere der erste
// Schritt zurueck in die Verflechtung, die der 3D-Umbau gerade aufloest —
// lieber bricht der Bau, als dass es unbemerkt einsickert.
// ---------------------------------------------------------------------------
// Zwei Fundstellen sind bewusst erlaubt und muessen WOERTLICH so bleiben:
// die Startsaat des oertlichen Spiels (im Netz ueberschreibt saat(korn) sie
// vor dem Rundenstart) und deko, das absichtlich NICHT aus dem Saatkorn
// zieht (siehe Kommentar in simulation.js). Alles andere ist ein Verstoss.
const erlaubteZeilen = [
  'saat((Date.now() ^ 0x9E3779B9) >>> 0);',
  'const deko = Math.random;',
];
for (const [name, quelle] of [['karten.js', karten], ['simulation.js', simulation], ['ki.js', ki]]) {
  let bereinigt = quelle;
  if (name === 'simulation.js') {
    for (const zeile of erlaubteZeilen) {
      if (bereinigt.split(zeile).length - 1 !== 1) {
        throw new Error('Erwarte genau einmal in simulation.js: ' + zeile);
      }
      bereinigt = bereinigt.replace(zeile, '');
    }
  }
  for (const verboten of ['document.', 'getElementById', 'window.', 'requestAnimationFrame',
                          'performance.now', 'Date.now', 'Math.random']) {
    if (bereinigt.includes(verboten)) {
      throw new Error(name + ' enthaelt ' + verboten + ' — die Simulation kennt weder DOM noch Uhr.');
    }
  }
}

// ---------------------------------------------------------------------------
// Waechter 2: simulation.js laeuft nackt, ohne jede Attrappe.
//
// Ein leerer Sandkasten hat kein document und kein window — greift der Teil
// beim Laden auf so etwas zu, wirft er hier. Zusaetzlich muessen die
// Kernstuecke wirklich in DIESEM Teil liegen, nicht per Hoisting aus einem
// spaeteren kommen (im Sandkasten gibt es keine spaeteren Teile).
// ---------------------------------------------------------------------------
{
  // Seit dem Feinschnitt gehoeren auch die Befehlsfunktionen und die
  // Bauregeln in die Simulation — wandert eine zurueck in die Oberflaeche,
  // faellt sie hier aus dem Sandkasten und der Bau bricht.
  const funktionen = ['saat', 'zufall', 'mische', 'newState', 'update',
    'placeSpot', 'preisFuer', 'playCard', 'setzeHaus', 'haltBefehl',
    'abrissBefehl', 'drehBefehl', 'coinAuslosen', 'coinWahl', 'coinTick',
    // aus karten.js — Katalog und Werte-Rechnung, gemeinsame Quelle von
    // Spielkern und Werteseite der Auswahl
    'handVon', 'werteVon', 'kartenBlatt', 'charakterBlatt'];
  const befund = runInNewContext(
    // karten.js gehoert dazu: simulation.js liest daraus handVon und werteVon.
    karten + simulation + '\n;[' + funktionen.map((f) => 'typeof ' + f).join(', ') +
      ', typeof HAKEN].join(",");',
    {},
  );
  const soll = funktionen.map(() => 'function').join(',') + ',object';
  if (befund !== soll) {
    throw new Error('karten.js + simulation.js unvollstaendig im Sandkasten: ' + befund);
  }
}

// Die Spieldatei traegt alles in EINEM Skript; im Client-Kern wandert
// karten.js dagegen VOR die Spielfunktion (Modulrahmen), damit die
// Auswahl im Bildschirm die Werte ohne laufende Partie lesen kann.
const js = simulation + darstellung + ki + oberflaeche;

// ---------------------------------------------------------------------------
// Waechter 3: Ankerstellen der Anbindung (uebernommen aus kern-erzeugen.mjs).
// Fehlt eine, lieber sofort abbrechen als einen halben Kern liefern, der im
// Netz stumm auseinanderlaeuft.
// ---------------------------------------------------------------------------
for (const anker of [
  'function drehBefehl(',
  'function setzeHaus(',
  'function abrissBefehl(',
  'function haltBefehl(',
  'function playCard(',
  'function coinWahl(',
  'let darfBedienen',
  'let ueberKopf',
  'let SPIEGEL',
  'function coinTick(',
  'function horcherAbhaengen(',
]) {
  if (!js.includes(anker)) throw new Error('Befehlsfunktion fehlt in den Teilen: ' + anker);
}

// Der Eigenstart muss aus dem Client-Kern weg — und die Selbst-Fortpflanzung
// in loop() ebenso: Eingebettet treibt die Anbindung loop je Bild. Es sind
// GENAU zwei Fundstellen, beide in der Oberflaeche. Ein einzelnes replace()
// traf frueher nur die erste — der Eigenstart blieb drin und feuerte je
// Sitzung EIN zusaetzliches Bildzeit-update mit geraetseigenem dt (Partien
// wurden "manchmal" strittig, headless unsichtbar).
const starts = js.split('requestAnimationFrame(loop);').length - 1;
if (starts !== 2) throw new Error('Erwarte genau 2 loop-Anstoesse, gefunden: ' + starts);
if (oberflaeche.split('requestAnimationFrame(loop);').length - 1 !== 2) {
  throw new Error('Die loop-Anstoesse gehoeren beide in oberflaeche.js');
}

// ---------------------------------------------------------------------------
// Artefakt 1: die eigenstaendige Spieldatei. Der Banner steht VOR dem
// Doctype — das ist erlaubt und laesst den Standards-Modus unangetastet
// (Quirks loesen nur Text oder Elemente vor dem Doctype aus, keine
// Kommentare).
// ---------------------------------------------------------------------------
const standalone =
  bannerHtml + kopf + '<style>\n' + stil + '</style>\n</head>\n<body>\n' + huelle +
  '<script>\n' + js + '</' + 'script>\n</body>\n</html>\n';
const standaloneZiel = pfad('../quelle/feldherr.html');
writeFileSync(standaloneZiel, standalone, 'utf8');

// ---------------------------------------------------------------------------
// Artefakt 2: der Client-Kern. STIL und HUELLE tragen die fuehrende
// Leerzeile, die im Standalone zwischen dem Tag und dem Inhalt steht — der
// Kern setzt beide unveraendert in die Seite ein.
// ---------------------------------------------------------------------------
const kernKopf = anbindungKopf
  .replace('"<<STIL>>"', JSON.stringify('\n' + stil))
  .replace('"<<HUELLE>>"', JSON.stringify('\n' + huelle));
if (kernKopf.includes('<<')) throw new Error('Platzhalter in anbindung-kopf.js nicht gefuellt');
const kernSkript = ('\n' + js).split('requestAnimationFrame(loop);').join('');
// Der Banner darf VOR "use strict" stehen: Kommentare gehoeren zum
// Direktiven-Prolog und heben die Direktive nicht auf (kern.js ist als
// ES-Modul ohnehin strikt).
const kern = bannerJs + karten + kernKopf + kernSkript + anbindungFuss;
const kernZiel = pfad('../../client/src/minispiele/feldherr/kern.js');
writeFileSync(kernZiel, kern, 'utf8');

console.log('feldherr.html gebaut:', Math.round(standalone.length / 1024), 'KB');
console.log('kern.js gebaut:      ', Math.round(kern.length / 1024), 'KB');
