/**
 * Rendert aus den gerigten CC0-Modellen die Bildfolgen der Tafelrunde-Figuren.
 *
 * NICHT Teil des Builds. Das Skript laeuft EINMAL, das Ergebnis (fuenf
 * Sprite-Sheets unter `packages/client/public/tafelrunde/figuren3d/`) liegt im
 * Repo, das Skript daneben — genau wie `modelle-bauen.mjs` bei der 3D-Probe.
 * Ohne das waeren fuenf Bilddateien ohne Herkunft im Repo, und die Frage
 * "woher kommen die, und wie kriege ich sie neu?" waere in einem halben Jahr
 * nicht mehr zu beantworten.
 *
 * Ausfuehren (die Werkzeuge stehen bewusst NICHT in der package.json des
 * Clients — sie werden einmal gebraucht, nicht bei jedem Build):
 *
 *   npm i --no-save @gltf-transform/core @gltf-transform/functions \
 *                   @gltf-transform/extensions sharp playwright
 *   npx playwright install chromium
 *   node packages/client/src/figuren3d/bildfolgen-rendern.mjs
 *
 * Findet das Skript `sharp` oder `playwright` nicht im Repo, greift es auf
 * `~/bildwerkzeug/node_modules` zurueck — dort liegen beide auf diesem Rechner
 * bereits (siehe CLAUDE.md, Abschnitt Bilder).
 *
 * WARUM CHROMIUM UND THREE UND NICHT BLENDER: Auf dem Rechner ist kein Blender
 * installiert, und ein Blender-Skript wuerde die Figuren mit einem ANDEREN
 * Renderer beleuchten als die 3D-Probe, an der die Optik abgenommen wurde —
 * Licht, Tone Mapping und Materialauslegung muessten von Hand nachgebaut
 * werden. Hier laeuft stattdessen dasselbe three.js mit denselben Lichtwerten
 * wie in `proben/arena-3d/Buehne.tsx`, nur in einem Chromium ohne Fenster.
 * Was herauskommt, sieht deshalb aus wie die Probe, und es haengt an keiner
 * zusaetzlichen Installation.
 *
 * QUELLE UND LIZENZ: KayKit "Character Pack : Adventurers" 1.0 von Kay
 * Lousberg (kaylousberg.com), CC0 1.0 Universal. Die LICENSE.txt des Pakets
 * wird als LIZENZ.txt neben die Bilder gelegt.
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..', '..');
const ZIEL = join(WURZEL, 'packages', 'client', 'public', 'tafelrunde', 'figuren3d');
const LIZENZ_QUELLE = join(
  WURZEL,
  'packages',
  'client',
  'public',
  'proben',
  'arena-3d',
  'LIZENZ.txt',
);

const QUELLE =
  'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures';

// ---------------------------------------------------------------------------
// Was gerendert wird
// ---------------------------------------------------------------------------

/**
 * Je Rolle eine Figur, eine Garnitur und fuenf Animationen.
 *
 * Zuordnung und Ausruestung sind aus `proben/arena-3d/modelle-bauen.mjs`
 * uebernommen — dort steht auch, warum der Beistand (ein Heiler) den Barbaren
 * bekommt: Das Paket hat keinen Heiler. NEU ist hier nur `getroffen`; die
 * Probe kam ohne aus, eine Kampfanzeige nicht.
 *
 * GERENDERT WIRD AUS DEM ORIGINAL, nicht aus den GLB-Dateien der Probe: Die
 * tragen nur vier Animationen, `Hit_A` ist beim Eindampfen weggefallen. Und
 * die Textur ist dort auf 128 Pixel geschrumpft — fuers Rendern ist das die
 * falsche Richtung, das Bild soll ja gerade so gut werden wie moeglich.
 */
const ROLLEN = [
  {
    rolle: 'wache',
    figur: 'Knight',
    behalten: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'],
    animationen: {
      stand: 'Idle',
      lauf: 'Walking_A',
      schlag: '1H_Melee_Attack_Chop',
      getroffen: 'Hit_A',
      tod: 'Death_A',
    },
  },
  {
    rolle: 'meuchler',
    figur: 'Rogue',
    behalten: ['Knife', 'Knife_Offhand', 'Rogue_Cape'],
    animationen: {
      stand: 'Idle',
      lauf: 'Running_A',
      schlag: 'Dualwield_Melee_Attack_Slice',
      getroffen: 'Hit_A',
      tod: 'Death_A',
    },
  },
  {
    rolle: 'schuetze',
    figur: 'Rogue_Hooded',
    behalten: ['2H_Crossbow', 'Rogue_Cape'],
    animationen: {
      stand: 'Idle',
      lauf: 'Walking_A',
      schlag: '2H_Ranged_Shoot',
      getroffen: 'Hit_A',
      tod: 'Death_A',
    },
  },
  {
    rolle: 'magier',
    figur: 'Mage',
    behalten: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'],
    animationen: {
      stand: 'Idle',
      lauf: 'Walking_A',
      schlag: 'Spellcast_Shoot',
      getroffen: 'Hit_A',
      tod: 'Death_A',
    },
  },
  {
    rolle: 'beistand',
    figur: 'Barbarian',
    behalten: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat', 'Barbarian_Cape'],
    animationen: {
      stand: 'Idle',
      lauf: 'Walking_A',
      schlag: '1H_Melee_Attack_Chop',
      getroffen: 'Hit_A',
      tod: 'Death_A',
    },
  },
];

/**
 * Die fuenf Bewegungen, ihre Bildzahl und der Ausschnitt der Animation.
 *
 * `spanne` sagt, WELCHES Stueck der Animation abgetastet wird, in Anteilen der
 * Cliplaenge. Zwei Faelle, und der Unterschied ist der Grund, warum die Spalte
 * ueberhaupt existiert:
 *
 * - Eine SCHLEIFE (stand, lauf) darf ihr letztes Bild nicht mitnehmen: Bild 0
 *   und das Bild bei 1,0 sind dieselbe Pose, die Figur wuerde einmal je
 *   Durchlauf stocken. Abgetastet wird deshalb bei i/n, das letzte Bild liegt
 *   bei (n-1)/n.
 * - Eine EINMAL-Bewegung (schlag, tod) braucht ihr Endbild, sonst bleibt die
 *   gefallene Figur auf halbem Weg liegen. Abgetastet wird bei i/(n-1).
 *
 * Zwei Bewegungen enden vor Schluss, jede aus eigenem Grund:
 *
 * - `getroffen`: `Hit_A` faengt in der Ruhepose an und endet auch dort. Zwei
 *   Bilder ueber die ganze Laenge waeren zweimal "steht da". Genommen wird das
 *   mittlere Drittel, in dem das Zurueckzucken sitzt.
 * - `tod`: nur die erste Haelfte, also das Zusammensacken — nicht das Liegen.
 *   Die liegende Figur ist gut dreimal so breit wie die stehende hoch ist
 *   (gemessen: bis 2,1 Einheiten neben der Mitte, vor allem der Hut des
 *   Magiers). Sie wuerde in den Ausschnitt passen, aber nur wenn man ihn so
 *   weit aufzieht, dass die stehende Figur auf halbe Groesse schrumpft — und
 *   die sieht man die ganze Partie, die liegende eine halbe Sekunde. Teil 2
 *   blendet die Figur nach dem letzten Todesbild aus.
 */
const BEWEGUNGEN = [
  { name: 'stand', bilder: 4, schleife: true, spanne: [0, 1] },
  { name: 'lauf', bilder: 6, schleife: true, spanne: [0, 1] },
  { name: 'schlag', bilder: 6, schleife: false, spanne: [0, 1] },
  { name: 'getroffen', bilder: 2, schleife: false, spanne: [0.22, 0.5] },
  { name: 'tod', bilder: 6, schleife: false, spanne: [0, 0.5] },
];

/** Kantenlaenge eines Einzelbildes im fertigen Sheet. */
const KANTE = 128;

/**
 * Gerendert wird doppelt so gross und danach halbiert.
 *
 * Ein WebGL-Kantenglaettung glaettet die Farbe, nicht den Alphakanal einer
 * freigestellten Figur; die Umrisse blieben treppig. Zweifach rendern und mit
 * sharp verkleinern mittelt beides sauber — und kostet nichts, weil das Bild
 * ohnehin nur einmal entsteht.
 */
const UEBERABTASTUNG = 2;

/**
 * Wie viele Koerperteile aus dem Original ueberleben.
 * Ausschluss ist die Vorgabe, nicht die Aufnahme (siehe modelle-bauen.mjs).
 */
const KOERPER = /(_Body|_Head|_Head_Hooded|_ArmLeft|_ArmRight|_LegLeft|_LegRight)$/;

// ---------------------------------------------------------------------------
// Kleinkram
// ---------------------------------------------------------------------------

const verlangeRequire = createRequire(import.meta.url);

/**
 * Holt ein Paket aus dem Repo, ersatzweise aus `~/bildwerkzeug`.
 *
 * Auf diesem Mac liegen sharp und playwright dort und nirgends sonst
 * (CLAUDE.md: "Auf diesem Rechner ist kein WebP-Werkzeug installiert").
 * Ohne diesen Rueckfall muesste man vor jedem Lauf 300 MB Chromium
 * herunterladen, obwohl er schon da ist.
 */
async function ladePaket(name) {
  let modul;
  try {
    modul = await import(name);
  } catch {
    const ausweich = join(process.env.HOME ?? '', 'bildwerkzeug', 'node_modules', name);
    modul = await import(verlangeRequire.resolve(ausweich));
  }
  // sharp und playwright sind CommonJS. Ueber `import()` geholt liegt ihr
  // ganzer Inhalt unter `default` — direkt aufgeloest waeren es benannte
  // Exporte. Beide Faelle treten hier wirklich auf, je nachdem, ob das Paket
  // im Repo liegt oder in ~/bildwerkzeug.
  return modul.default && !modul.chromium && typeof modul.default === 'object'
    ? { ...modul.default, default: modul.default }
    : modul;
}

async function existiert(pfad) {
  try {
    await access(pfad);
    return true;
  } catch {
    return false;
  }
}

async function hole(url, ziel) {
  if (await existiert(ziel)) return;
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error(`${url} antwortet ${antwort.status}`);
  await writeFile(ziel, Buffer.from(await antwort.arrayBuffer()));
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

// ---------------------------------------------------------------------------
// Schritt 1: aus dem Original ein Modell mit genau fuenf Animationen bauen
// ---------------------------------------------------------------------------

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/**
 * Der Zwischenstand liegt im Systemtemp, NICHT im Repo.
 *
 * Die fuenf Originale wiegen zusammen 17,6 MB. Ein `.roh`-Ordner neben dem
 * Skript ist genau die Art Ordner, die irgendwann versehentlich mitcommittet
 * wird (CLAUDE.md, Regel 7: ein `git add` auf einen ignorierten Pfad hat hier
 * schon 932 Dateien gekostet).
 */
async function baueModelle(zwischen) {
  const pfade = new Map();
  for (const eintrag of ROLLEN) {
    const roh = join(zwischen, `${eintrag.figur}.glb`);
    await hole(`${QUELLE}/Characters/gltf/${eintrag.figur}.glb`, roh);

    const doc = await io.read(roh);
    const root = doc.getRoot();

    const erlaubt = new Set(eintrag.behalten);
    for (const knoten of root.listNodes()) {
      if (!knoten.getMesh()) continue;
      const name = knoten.getName();
      if (KOERPER.test(name) || erlaubt.has(name)) continue;
      knoten.dispose();
    }

    // Animationen eindampfen und deutsch benennen. Kanaele und Abtaster
    // einzeln wegwerfen — ein blosses `anim.dispose()` laesst sie im Graphen
    // stehen, und dann haelt eine geloeschte Animation ihre Daten am Leben
    // (der Befund steht ausfuehrlich in modelle-bauen.mjs).
    const gewuenscht = new Map(
      Object.entries(eintrag.animationen).map(([neu, alt]) => [alt, neu]),
    );
    const gefunden = new Set();
    for (const anim of root.listAnimations()) {
      const neu = gewuenscht.get(anim.getName());
      if (!neu) {
        for (const kanal of anim.listChannels()) kanal.dispose();
        for (const abtaster of anim.listSamplers()) abtaster.dispose();
        anim.dispose();
        continue;
      }
      gefunden.add(anim.getName());
      anim.setName(neu);
    }
    for (const alt of gewuenscht.keys()) {
      if (!gefunden.has(alt)) throw new Error(`${eintrag.figur}: Animation ${alt} fehlt`);
    }

    // Kein `quantize()` und kein `textureCompress()`: Das Modell wird hier
    // nicht ausgeliefert, sondern nur angesehen. Beides wuerde die Bildqualitaet
    // kosten, ohne irgendetwas zu sparen, was jemand je herunterlaedt.
    await doc.transform(prune({ keepLeaves: false }));

    const ausgabe = join(zwischen, `${eintrag.rolle}.glb`);
    await io.write(ausgabe, doc);
    pfade.set(eintrag.rolle, ausgabe);
  }
  return pfade;
}

// ---------------------------------------------------------------------------
// Schritt 2: ein Server, der Chromium das Noetige reicht
// ---------------------------------------------------------------------------

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.glb': 'model/gltf-binary',
};

/**
 * Der Server reicht drei Dinge heraus: die Seite, three aus `node_modules`
 * und die Modelle aus dem Zwischenordner. `file://` taete es nicht — ES-Module
 * und `fetch` auf dem Dateiprotokoll sind in Chromium gesperrt.
 */
function starteServer(seite, zwischen) {
  const server = createServer(async (anfrage, antwort) => {
    const weg = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname);
    try {
      if (weg === '/' || weg === '/seite.html') {
        antwort.writeHead(200, { 'content-type': TYPEN['.html'] });
        antwort.end(seite);
        return;
      }
      // Der Praefix entscheidet ueber die Wurzel; danach wird der aufgeloeste
      // Pfad gegen sie geprueft. Ohne diese zweite Pruefung liest `../../..`
      // die ganze Platte aus — der Server hoert zwar nur auf localhost, aber
      // eine Wegwerf-Pruefung ist billiger als die Frage, ob das reicht.
      const [wurzel, rest] =
        weg.startsWith('/modelle/')
          ? [zwischen, weg.slice('/modelle/'.length)]
          : [WURZEL, weg.slice(1)];
      const datei = resolve(wurzel, normalize(rest));
      if (!datei.startsWith(resolve(wurzel))) {
        antwort.writeHead(403).end();
        return;
      }
      const inhalt = await readFile(datei);
      antwort.writeHead(200, {
        'content-type': TYPEN[extname(datei)] ?? 'application/octet-stream',
      });
      antwort.end(inhalt);
    } catch {
      antwort.writeHead(404).end();
    }
  });
  return new Promise((fertig) => {
    server.listen(0, '127.0.0.1', () => fertig({ server, port: server.address().port }));
  });
}

/**
 * Die Seite, die im Chromium laeuft.
 *
 * Sie steht als Zeichenkette hier drin und nicht als eigene .html-Datei: Unter
 * `src/` wuerde sie wie Anwendungscode aussehen, der Client baut sie aber nie
 * mit. Alles, was mit dem Rendern zu tun hat, gehoert in diese eine Datei.
 *
 * DIE KAMERA IST DIE DER PROBE, nur orthografisch. Die Probe schaut mit einer
 * perspektivischen Kamera von (0, 7.4, 8.2) auf (0, 0.85, 0) — das sind 38,6
 * Grad ueber dem Brett. Derselbe Winkel wird hier benutzt, aber ohne Fluchtung:
 * Eine perspektivische Kamera bildet eine Figur am Bildrand anders ab als in
 * der Mitte, und ein Sprite steht spaeter ueberall auf dem Brett. Orthografisch
 * ist jedes Bild derselben Figur gleich gross, egal wo es hinkommt.
 */
const SEITE = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>Bildfolgen rendern</title>
<style>html,body{margin:0;background:#111}</style>
<script type="importmap">
{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}
</script>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const KANTE = ${KANTE * UEBERABTASTUNG};

/** Blickrichtung der Probe: (0, 7.4, 8.2) - (0, 0.85, 0). */
const BLICK = new THREE.Vector3(0, 6.55, 8.2).normalize();

/**
 * Wie weit die Figur aus dem Bild gedreht steht.
 *
 * Sie schaut nach rechts (+X), denn genau so werden die beiden Seiten spaeter
 * gegeneinander gestellt und die Gegenseite wird gespiegelt. Reines Profil
 * waere flach; die 0,30 Radiant (17 Grad) zur Kamera hin machen daraus eine
 * Dreiviertelansicht, in der man Gesicht und Waffe sieht.
 */
const DREHUNG = -Math.PI / 2 + 0.30;

/**
 * Bildausschnitt in Weltmetern. Die Figuren sind rund 1,7 hoch, der Ausschnitt
 * ist 3,0 hoch — die Figur fuellt also gut die Haelfte der Zelle.
 *
 * ALLE Bilder haben denselben Ausschnitt und denselben Bezugspunkt. Das ist die
 * wichtigste Eigenschaft der ganzen Datei: Nur so kann Teil 2 jede Zelle an
 * dieselbe Stelle malen, ohne je Bewegung nachzurechnen. Wo die Figur auf dem
 * Boden aufsetzt, steht als `fusspunkt` in figuren3d.ts.
 *
 * 1,5 ist gemessen und nicht geraten: Bei 1,2 ragten Schwert und Stab aus dem
 * Bild, bei 1,7 wurde die stehende Figur zu klein. Das einzige, was auch jetzt
 * noch anstoesst, ist der Hut des Magiers im allerletzten Todesbild.
 */
const HALBE_HOEHE = 1.5;
const MITTE_Y = 0.95;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(KANTE, KANTE, false);
renderer.setClearColor(0x000000, 0);
// Dieselben zwei Zeilen wie in Arena3D.tsx — ohne sie sind die Figuren
// merklich blasser als in der Probe, an der die Optik abgenommen wurde.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const szene = new THREE.Scene();
// Kein Hintergrund und kein Nebel: Das Bild soll freigestellt sein. Der Nebel
// der Probe faerbt ausserdem alles Richtung #1a1410 ein, was auf einem
// transparenten Bild wie Schmutz im Alphakanal aussaehe.
szene.add(new THREE.HemisphereLight('#cfe0ff', '#4a3a28', 1.1));
const sonne = new THREE.DirectionalLight('#fff3dc', 2.1);
sonne.position.set(5.5, 9, 4.5);
szene.add(sonne);

const kamera = new THREE.OrthographicCamera(-HALBE_HOEHE, HALBE_HOEHE, HALBE_HOEHE, -HALBE_HOEHE, 0.1, 60);
kamera.position.copy(BLICK).multiplyScalar(12).add(new THREE.Vector3(0, MITTE_Y, 0));
kamera.lookAt(0, MITTE_Y, 0);

const lader = new GLTFLoader();

/** Der Knochen, an dem die Figur "haengt" — an ihm wird der Ort gemessen. */
const ANKERKNOCHEN = 'hips';

window.rendereRolle = async (url, bewegungen) => {
  const gltf = await lader.loadAsync(url);
  const figur = gltf.scene;
  figur.rotation.y = DREHUNG;
  // Die Figur haengt in einem Halter, der sie in jedem Bild zurueckschiebt
  // (siehe anStelleHalten weiter unten). Deshalb ein Halter und nicht die
  // Figur selbst: Die traegt schon die Drehung, und zwei Dinge an einem
  // Objekt zu verrechnen macht die Rechnung unlesbar.
  const halter = new THREE.Group();
  halter.add(figur);
  szene.add(halter);

  let anker = null;
  figur.traverse((teil) => {
    if (teil.isBone && teil.name === ANKERKNOCHEN) anker = teil;
  });
  if (!anker) throw new Error('Knochen fehlt: ' + ANKERKNOCHEN);

  /**
   * Schiebt die Figur so zurueck, dass ihr Ankerknochen immer ueber derselben
   * Stelle des Bodens steht.
   *
   * WARUM ES DAS BRAUCHT: Die Animationen laufen NICHT auf der Stelle. Beim
   * Sterben wandert die Wache ueber einen Meter nach hinten, beim Rennen der
   * Meuchler nach vorn. In einem Sprite ist das falsch, gleich zweimal: Die
   * letzten Todesbilder ragten rechts aus dem Bild heraus, und selbst wenn sie
   * hineinpassten, wuerde sich die Bewegung im Bild spaeter zu der Bewegung
   * addieren, mit der das Spiel das Sprite ueber das Brett schiebt.
   *
   * WARUM NICHT DIE VERSCHIEBESPUREN GELOESCHT WERDEN: Der erste Versuch hat
   * genau das gemacht — und im KayKit-Rig traegt JEDER Knochen eine solche
   * Spur, auch hand.r und handslot.r. Das Schwert schwebte danach einen halben
   * Meter neben der Hand. Nur root und hips zu leeren half auch nicht: Ein Teil
   * der Wanderung steckt in der Drehung des Beckens, nicht in seiner
   * Verschiebung. Am Ende gemessen wird deshalb das Ergebnis, nicht die
   * Ursache: Wo steht der Knochen wirklich, und wie weit muss die Figur
   * zurueck.
   *
   * NUR X UND Z. Die Hoehe bleibt, wie sie ist — das Einsinken beim Sterben
   * und das Wippen beim Laufen sind Bewegung und nicht Ort.
   */
  const ruhe = new THREE.Vector3();
  const jetzt = new THREE.Vector3();
  function anStelleHalten(erstesBild) {
    halter.position.set(0, 0, 0);
    halter.updateMatrixWorld(true);
    anker.getWorldPosition(jetzt);
    if (erstesBild) ruhe.copy(jetzt);
    halter.position.set(ruhe.x - jetzt.x, 0, ruhe.z - jetzt.z);
    halter.updateMatrixWorld(true);
  }

  const mischer = new THREE.AnimationMixer(figur);
  const clips = new Map(gltf.animations.map((c) => [c.name, c]));

  const spalten = Math.max(...bewegungen.map((b) => b.bilder));
  const blatt = document.createElement('canvas');
  blatt.width = spalten * KANTE;
  blatt.height = bewegungen.length * KANTE;
  const stift = blatt.getContext('2d');

  const laengen = {};
  for (let zeile = 0; zeile < bewegungen.length; zeile++) {
    const bewegung = bewegungen[zeile];
    const clip = clips.get(bewegung.name);
    if (!clip) throw new Error('Animation fehlt: ' + bewegung.name);
    laengen[bewegung.name] = clip.duration;

    mischer.stopAllAction();
    const aktion = mischer.clipAction(clip);
    aktion.reset();
    // Eine Einmal-Bewegung MUSS auf LoopOnce mit clampWhenFinished stehen.
    // Sonst laeuft sie als Schleife, und setTime(dauer) — das Endbild — springt
    // auf Null zurueck: Im letzten Bild von "tod" stand die Wache wieder
    // aufrecht da, mitten in einer Reihe liegender Leichen.
    if (!bewegung.schleife) {
      aktion.setLoop(THREE.LoopOnce, 1);
      aktion.clampWhenFinished = true;
    }
    aktion.play();

    const [von, bis] = bewegung.spanne;
    for (let i = 0; i < bewegung.bilder; i++) {
      // Schleife: i/n (das Bild bei 1,0 ist dasselbe wie bei 0).
      // Einmal-Bewegung: i/(n-1), damit das Endbild dabei ist.
      const teiler = bewegung.schleife ? bewegung.bilder : Math.max(1, bewegung.bilder - 1);
      const anteil = von + ((bis - von) * i) / teiler;
      // setTime statt update(delta): so haengt das Bild an der Zeit und nicht
      // daran, wie oft die Schleife vorher gelaufen ist. Zwei Laeufe des
      // Skripts geben damit Pixel fuer Pixel dasselbe Ergebnis.
      mischer.setTime(anteil * clip.duration);
      // Der Bezugspunkt kommt aus dem allerersten Bild (stand, Zeit 0) und
      // gilt fuer ALLE Bewegungen. Naehme jede Bewegung ihren eigenen, spraenge
      // die Figur beim Wechsel von stand auf lauf um die Differenz.
      anStelleHalten(zeile === 0 && i === 0);
      renderer.render(szene, kamera);
      stift.drawImage(renderer.domElement, i * KANTE, zeile * KANTE);
    }
  }

  mischer.stopAllAction();
  szene.remove(halter);

  // Wo in der Zelle steht die Figur auf dem Boden? Der Punkt (0,0,0) der Szene
  // ist die Stelle, an der die Fuesse aufsetzen; Teil 2 muss sie kennen, um
  // das Sprite auf ein Feld zu setzen. Sie liegt NICHT in der Zellmitte: Die
  // Kamera schaut schraeg von oben, der Ausschnitt ist nach oben verschoben,
  // damit die stehende Figur hineinpasst. Ausgerechnet statt geschaetzt.
  const fuss = new THREE.Vector3(0, 0, 0).project(kamera);
  const fusspunkt = { x: (fuss.x + 1) / 2, y: (1 - fuss.y) / 2 };

  return { bild: blatt.toDataURL('image/png'), spalten, laengen, fusspunkt };
};

window.bereit = true;
</script>
</body></html>`;

// ---------------------------------------------------------------------------
// Schritt 3: rendern, verkleinern, als WebP ablegen
// ---------------------------------------------------------------------------

// Fester Name statt `mkdtemp`: Die 17,6 MB Originale sollen beim zweiten Lauf
// nicht noch einmal aus dem Netz kommen (`hole()` ueberspringt, was schon da
// ist). Wer wirklich frisch laden will, loescht den Ordner.
const zwischen = join(tmpdir(), 'brauweg-figuren3d');
await mkdir(zwischen, { recursive: true });
console.log(`Zwischenstand: ${zwischen}`);

const modelle = await baueModelle(zwischen);
await mkdir(ZIEL, { recursive: true });
await copyFile(LIZENZ_QUELLE, join(ZIEL, 'LIZENZ.txt'));

const { server, port } = await starteServer(SEITE, zwischen);
const { chromium } = await ladePaket('playwright');
const { default: sharp } = await ladePaket('sharp');

const browser = await chromium.launch();
const seite = await browser.newPage();
seite.on('pageerror', (fehler) => console.error('Seite:', fehler.message));
await seite.goto(`http://127.0.0.1:${port}/seite.html`);
await seite.waitForFunction('window.bereit === true', null, { timeout: 30_000 });

const bericht = [];
for (const eintrag of ROLLEN) {
  const { bild, spalten, laengen, fusspunkt } = await seite.evaluate(
    ([url, bewegungen]) => window.rendereRolle(url, bewegungen),
    [`/modelle/${eintrag.rolle}.glb`, BEWEGUNGEN],
  );

  const roh = Buffer.from(bild.slice('data:image/png;base64,'.length), 'base64');
  const ziel = join(ZIEL, `${eintrag.rolle}.webp`);
  await sharp(roh)
    .resize(spalten * KANTE, BEWEGUNGEN.length * KANTE, { kernel: 'lanczos3' })
    // Verlustbehaftet mit `alphaQuality: 100`: Die Farbflaechen der Figuren
    // vertragen die Kompression gut, ein weicher Alphakanal nicht — ein
    // ausgefranster Umriss faellt sofort auf, ein leicht anderes Braun nie.
    .webp({ quality: 70, alphaQuality: 100, effort: 6 })
    .toFile(ziel);

  const groesse = (await readFile(ziel)).byteLength;
  bericht.push({ rolle: eintrag.rolle, groesse, laengen, fusspunkt });
}

await browser.close();
server.close();

let summe = 0;
for (const z of bericht) {
  summe += z.groesse;
  const dauern = Object.entries(z.laengen)
    .map(([name, s]) => `${name} ${s.toFixed(2)}s`)
    .join('  ');
  console.log(`${z.rolle.padEnd(10)} ${kb(z.groesse).padStart(9)}   ${dauern}`);
}
console.log(`${'zusammen'.padEnd(10)} ${kb(summe).padStart(9)}`);
console.log(
  `Raster je Blatt: ${Math.max(...BEWEGUNGEN.map((b) => b.bilder))} x ${BEWEGUNGEN.length} Zellen zu ${KANTE} px`,
);
// Der Fusspunkt gehoert in figuren3d.ts. Er steht hier als Zahl, damit ihn
// niemand aus dem Bild abmisst: Wer ihn um zwei Pixel danebensetzt, sucht
// spaeter, warum die Figuren im Getuemmel nicht auf einer Linie stehen.
const f = bericht[0].fusspunkt;
console.log(`Fusspunkt in der Zelle: x ${f.x.toFixed(4)}  y ${f.y.toFixed(4)} (Anteil der Kante)`);
