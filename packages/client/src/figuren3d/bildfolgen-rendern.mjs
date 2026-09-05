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
 * Mit `--vergleich` rendert es stattdessen KEINE Blaetter fuers Spiel, sondern
 * ein einzelnes Vergleichsbild mehrerer Kamerawinkel (siehe KAMERA_GRAD).
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
 *
 * ZWEITE QUELLE SEIT DEM 06.09.2026: der Beistand kommt aus "Adventurers 2.0"
 * und "Character Animations 1.1" desselben Urhebers, ebenfalls CC0. Warum ein
 * zweites Paket noetig war und warum es aus einem Spiegel geholt wird, steht
 * bei `QUELLE_SAMMLUNG` weiter unten.
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, prune, unpartition } from '@gltf-transform/functions';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..', '..');
const ZIEL = join(WURZEL, 'packages', 'client', 'public', 'tafelrunde', 'figuren3d');
const VERGLEICHSBILD = join(WURZEL, 'docs', 'bilder', 'tafelrunde-kamerawinkel.webp');
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

/**
 * Die zweite Quelle: "The Complete KayKit Collection v6.1".
 *
 * WARUM SIE SEIN MUSS: Vier der fuenf Rollen kommen aus dem Paket oben, der
 * Beistand nicht. Er ist ein Heiler (Moosheiler, Runenpriester, Lichtwahrerin),
 * und "Adventurers 1.0" hat genau fuenf Figuren — Knight, Mage, Rogue,
 * Rogue_Hooded, Barbarian. Keine davon ist ein Heiler. Bis zum 06.09.2026 trug
 * der Beistand deshalb den BARBAREN mit Axt und Schild; fuer die Probe war das
 * tragbar, im fertigen Spiel sieht ein Axtkaempfer als Heiler falsch aus.
 * "Adventurers 2.0" hat vier Figuren mehr, darunter den DRUIDEN.
 *
 * WARUM EIN SPIEGEL UND NICHT DAS ORIGINAL: Kay Lousberg legt nur die
 * 1.0-Pakete als Repository unter `KayKit-Game-Assets` ab (nachgesehen am
 * 06.09.2026: dort liegen Adventures 1.0, Skeletons 1.0, Dungeon, Hexagon und
 * die Bits-Pakete — 2.0 ist nicht dabei). Alles Neuere gibt es auf itch.io und
 * Patreon, beides hinter einem Formular und damit nicht abrufbar. Der Spiegel
 * `SY227/kaykit-complete-v6-1-assets` traegt die Sammlung samt ihrer
 * `License.txt` — dieselbe CC0-Erklaerung wie im 1.0-Paket, woertlich
 * nachgelesen: "free to use in personal, educational and commercial projects",
 * Namensnennung ausdruecklich nicht verlangt.
 *
 * WAS ZU TUN IST, WENN DER SPIEGEL VERSCHWINDET: Nichts Dringendes — die
 * fertigen Blaetter liegen im Repo und haengen an keinem Netz. Wer neu rendern
 * will, holt sich die Sammlung von kaylousberg.com (itch.io, CC0) und legt die
 * fuenf Dateien aus `TEILE_BEISTAND` von Hand in den Zwischenordner; `hole()`
 * ueberspringt, was schon da ist.
 */
const QUELLE_SAMMLUNG =
  'https://media.githubusercontent.com/media/SY227/kaykit-complete-v6-1-assets/main';

/**
 * Dieselbe Sammlung ueber `raw.` statt `media.`.
 *
 * DER UNTERSCHIED IST KEINE GESCHMACKSFRAGE: Das Repository liegt in Git LFS.
 * Binaerdateien (.glb, .bin, .png) sind dort nur Zeiger, und erst
 * `media.githubusercontent.com` loest sie auf. Textdateien (.gltf) liegen
 * NICHT in LFS — fuer sie antwortet `media.` mit 0 Bytes und Status 200. Genau
 * das ist beim Bau passiert: eine leere .gltf, und der Fehler stand dann in
 * `JSON.parse` statt beim Holen. Deshalb prueft `hole()` auf Laenge null.
 */
const QUELLE_SAMMLUNG_TEXT =
  'https://raw.githubusercontent.com/SY227/kaykit-complete-v6-1-assets/main';

// ---------------------------------------------------------------------------
// Kamera
// ---------------------------------------------------------------------------

/**
 * Wie hoch die Kamera ueber der Waagerechten steht, in Grad.
 *
 * DAS IST DIE WICHTIGSTE ZAHL DER DATEI. Aus ihr wird die Blickrichtung
 * gerechnet — (0, sin, cos) —, nicht umgekehrt; ein roher Vektor sagt niemandem,
 * ob er 12 oder 40 Grad bedeutet.
 *
 * 16 GRAD, ENTSCHIEDEN VON ROBIN AM 05.09.2026. Der erste Anlauf hatte hier
 * 38,6 Grad — die Kamera der 3D-Probe, die von oben auf ein BRETT schaut
 * (`proben/arena-3d/Arena3D.tsx`: Kamera (0, 7.4, 8.2) auf (0, 0.85, 0)). Fuer
 * Figurenbilder ist dieser Winkel falsch: Man sieht den Scheitel statt des
 * Gesichts, und beim Meuchler mit dem grossen KayKit-Kopf verschwindet das
 * Gesicht ganz. Die Vorbilder (Merge Tactics) zeigen Gesicht, Brust und Waffe.
 *
 * Entschieden wurde am Vergleichsbild `docs/bilder/tafelrunde-kamerawinkel.webp`
 * (`--vergleich` rendert es neu). Das Mass war das Auge des Meuchlers: Bei
 * 38,6 Grad ist es gar nicht zu sehen, bei 22 Grad taucht es auf, ab 16 Grad
 * liegen Auge, Wange und Kinn frei. 12 Grad zeigt kaum mehr Gesicht, nimmt aber
 * die letzte Andeutung von oben und laesst die Figur auf dem Brett schweben.
 *
 * Wer den Winkel spaeter noch einmal aendert, laesst das Skript OHNE
 * `--vergleich` laufen und traegt die ausgegebenen Zahlen in figuren3d.ts nach —
 * vor allem den Fusspunkt, der sich mit dem Winkel verschiebt.
 */
const KAMERA_GRAD = 16;

/**
 * Wie weit die Figur aus dem Bild gedreht steht, in Grad.
 *
 * Sie schaut nach rechts (+X), denn genau so werden die beiden Seiten spaeter
 * gegeneinander gestellt und die Gegenseite wird gespiegelt. Reines Profil
 * (0 Grad) waere flach; die Drehung zur Kamera hin macht daraus eine
 * Dreiviertelansicht, in der man Gesicht und Waffe sieht.
 *
 * 17 Grad ist der Wert der steilen Kamera. Die Vermutung war, dass eine
 * flachere Kamera mehr Drehung vertraegt. GEPRUEFT am 05.09.2026 (unterer Block
 * des Vergleichsbildes, 17 / 26 / 34 Grad bei 16 Grad Kamera): Sie vertraegt
 * sie, aber sie gewinnt fast nichts. Der KayKit-Kopf ist eine glatte Kugel ohne
 * Nase; ob er 17 oder 34 Grad steht, aendert am Gesicht kaum etwas, waehrend
 * ab etwa 30 Grad der zweite Dolch hinter dem Koerper verschwindet. Das Gesicht
 * kommt vom KAMERAWINKEL, nicht von der Drehung — deshalb bleibt es bei 17.
 */
const DREHUNG_GRAD = 17;

/**
 * Luft zwischen der Figur und dem Zellrand, als Faktor auf den gemessenen
 * Halbbedarf. 6 Prozent decken die Kantenglaettung und ein bis zwei Pixel
 * Schlagschatten ab, ohne die Figur sichtbar zu verkleinern.
 */
const LUFT = 1.06;

/**
 * Ausschnitt der Probemessung, in Weltmetern.
 *
 * Der Bildausschnitt wird nicht mehr geraten, sondern GEMESSEN (siehe
 * `messeAusschnitt`): Erst laeuft ein Durchgang mit diesem grosszuegigen
 * Ausschnitt, dabei wird der Alphakanal jedes Bildes abgetastet, und aus der
 * groessten Ausdehnung ueber ALLE Rollen und ALLE Bewegungen ergibt sich der
 * echte Ausschnitt.
 *
 * WARUM NICHT MEHR DIE FESTE 1,5: Die war fuer 38,6 Grad von Hand gesucht. Wie
 * hoch eine Figur im Bild steht, haengt aber am Kamerawinkel — eine senkrechte
 * Strecke der Laenge h misst auf dem Bildschirm h * cos(Winkel), und die Tiefe
 * der Figur schlaegt mit sin(Winkel) auf. Wer den Winkel aendert und die 1,5
 * stehen laesst, bekommt entweder eine geschrumpfte Figur oder einen
 * abgeschnittenen Stab.
 *
 * GEMESSEN am 05.09.2026 ueber Wache und Meuchler: 1,94 — und zwar bei 12, 16,
 * 22 UND 38,6 Grad derselbe Wert. Der Ausschnitt haengt also gar nicht am
 * Winkel, weil ihn nicht die Hoehe bestimmt, sondern die WAAGERECHTE Reichweite
 * beim Schlag (die Dolche des Meuchlers, das Schwert der Wache) — und die
 * steht quer zur Blickachse und aendert sich mit dem Winkel nicht. Die alte
 * 1,5 war zu klein: Sie hat diese Reichweite abgeschnitten, und was aus dem
 * Bild ragt, sieht man erst in der Bewegung.
 */
const PROBE_HALBE_HOEHE = 2.8;
const PROBE_MITTE_Y = 1.0;

// ---------------------------------------------------------------------------
// Was gerendert wird
// ---------------------------------------------------------------------------

/**
 * Je Rolle eine Figur, eine Garnitur und fuenf Animationen.
 *
 * Zuordnung und Ausruestung der ersten vier sind aus
 * `proben/arena-3d/modelle-bauen.mjs` uebernommen. NEU ist dort gegenueber nur
 * `getroffen`; die Probe kam ohne aus, eine Kampfanzeige nicht.
 *
 * DER BEISTAND FAELLT AUS DER REIHE und traegt deshalb `sammlung: true`. Er
 * kommt aus einem zweiten Paket (siehe `QUELLE_SAMMLUNG`) und ist dort auf drei
 * Dateien verteilt statt auf eine: Figur, Animationen und Ausruestung. Was das
 * fuers Bauen heisst, steht bei `baueAusTeilen`.
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
    figur: 'Druid',
    sammlung: true,
    // Der Rucksack ist das einzige Beiwerk, das die 2.0-Figur mitbringt; alles
    // andere (Stab, Trank, Beutel) liegt dort als eigene Datei. Er bleibt drin,
    // weil er die Silhouette gegen den Magier abgrenzt: Der hat Spitzhut und
    // Umhang, der Druide Kapuze und Rucksack.
    behalten: ['Druid_Backpack'],
    ausruestung: [{ teil: 'druid_staff', knochen: 'handslot.r' }],
    animationen: {
      // `Idle_A` statt `Idle`: In 2.0 heisst die Ruhepose so, und es gibt
      // dazu ein `Idle_B`. Fuer die vier 1.0-Figuren heisst sie weiter `Idle`.
      stand: 'Idle_A',
      lauf: 'Walking_A',
      // KEIN Nahkampfschlag. Ein Heiler haut nicht zu, er hebt die Hand — und
      // `Ranged_Magic_Raise` ist genau das: Stab hoch, Handflaeche nach vorn.
      // Der Magier nimmt daneben `Spellcast_Shoot`, ein Stoss nach vorn; die
      // beiden sind damit auch in der Bewegung auseinanderzuhalten und nicht
      // nur an der Figur.
      schlag: 'Ranged_Magic_Raise',
      getroffen: 'Hit_A',
      tod: 'Death_A',
    },
  },
];

/**
 * Die Dateien, aus denen der Beistand zusammengesetzt wird.
 *
 * Drei Sorten, und die Aufteilung ist nicht unsere: KayKit hat mit 2.0 die
 * Animationen aus den Figuren herausgeloest. Eine Figur aus 2.0 traegt gar
 * keine Animation mehr (nachgezaehlt: `Druid.glb` hat null), dafuer passen die
 * Bewegungen des Animationspakets auf JEDE Figur mit demselben Rig.
 *
 * DASS DAS AUFGEHT, HAENGT AN EINER EINZIGEN TATSACHE: Die 23 Knochen des
 * Druiden heissen genau wie die 23 Ziele der Animationen — geprueft, nicht
 * gehofft (`baueAusTeilen` bricht ab, wenn ein Name fehlt).
 */
const TEILE_BEISTAND = {
  /** Die Figur selbst: Koerper, Kapuze, Rucksack — ohne Animation, ohne Waffe. */
  figur: 'KayKit%20Adventurers%202.0/Characters/gltf',
  /**
   * Die Bewegungen, drei Dateien fuer fuenf Animationen.
   *
   * Genommen wird das Paket "Character Animations 1.1" und NICHT der
   * Animationsordner, der in Adventurers 2.0 mitliegt: Der hat nur `General`
   * und `MovementBasic`, und `Ranged_Magic_Raise` steckt in `CombatRanged`.
   * Alle drei aus einer Quelle zu holen ist billiger zu erklaeren als zwei.
   */
  bewegungen: 'KayKit%20Character%20Animations%201.1/Animations/gltf/Rig_Medium',
  bewegungsdateien: [
    'Rig_Medium_General.glb', // Idle_A, Hit_A, Death_A
    'Rig_Medium_MovementBasic.glb', // Walking_A
    'Rig_Medium_CombatRanged.glb', // Ranged_Magic_Raise
  ],
  /** Die Ausruestung, je Teil drei Dateien: .gltf (Text), .bin und die Textur. */
  ausruestung: 'KayKit%20Adventurers%202.0/Assets/gltf',
  textur: 'druid_texture.png',
};

/**
 * Wie ein Ausruestungsteil in der Hand sitzt.
 *
 * NICHT GERATEN, SONDERN ABGELESEN: In den 1.0-Figuren haengen Schwert, Stab
 * und Axt als Kinder von `handslot.r` und tragen alle dieselbe Drehung — eine
 * halbe Umdrehung um die Y-Achse (Quaternion 0,1,0,0), Verschiebung praktisch
 * null. Nachgesehen an `Mage.glb` (2H_Staff, 1H_Wand) und `Knight.glb`
 * (1H_Sword). Der Griffpunkt steckt also im Modell des Teils, nicht in einer
 * Zahl, die jemand suchen muesste; die 2.0-Teile folgen derselben Konvention.
 *
 * WORAN MAN SIEHT, DASS ES STIMMT: Der Stab liegt IN der Faust, nicht daneben
 * und nicht verkehrt herum (Krone oben). Steht er auf dem Kopf, ist es diese
 * Drehung; schwebt er neben der Hand, ist es der falsche Knochen.
 */
const GRIFF_DREHUNG = [0, 1, 0, 0];

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
// Was der Vergleichslauf zeigt
// ---------------------------------------------------------------------------

/**
 * Der Winkel der Bretterkamera aus `proben/arena-3d/`. Er wird nicht mehr
 * gerendert, steht im Vergleichsbild aber als Vergleichsmass mit — ohne ihn
 * sieht man nicht, wie viel die flacheren Winkel wirklich gewinnen.
 */
const BRETTKAMERA_GRAD = 38.6;

/** Die Winkel des Vergleichsbildes, vom steilsten zum flachsten. */
const VERGLEICH_WINKEL = [BRETTKAMERA_GRAD, 22, 16, 12];

/**
 * Zwei Rollen genuegen: Die Wache traegt Helm und Schild (viel Verdeckung von
 * oben), der Meuchler hat den groessten Kopf des Pakets und zeigt deshalb am
 * deutlichsten, ab wann ein Gesicht zu sehen ist.
 */
const VERGLEICH_ROLLEN = ['wache', 'meuchler'];

/** Vier aussagekraeftige Einzelbilder je Zeile statt des ganzen Blattes. */
const VERGLEICH_ZELLEN = [
  { bewegung: 'stand', bild: 0 },
  { bewegung: 'lauf', bild: 2 },
  { bewegung: 'schlag', bild: 3 },
  { bewegung: 'tod', bild: 3 },
];

/** Drehungen, die im unteren Block des Vergleichsbildes gegenuebergestellt werden. */
const VERGLEICH_DREHUNGEN = [17, 26, 34];

/** Bei welchem Kamerawinkel der Drehungsblock gerendert wird (die mittlere Stufe). */
const VERGLEICH_DREHUNG_GRAD = 16;

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
  const inhalt = Buffer.from(await antwort.arrayBuffer());
  // Null Bytes mit Status 200 ist der Normalfall, wenn man eine NICHT in LFS
  // liegende Datei ueber `media.githubusercontent.com` anfragt (siehe
  // QUELLE_SAMMLUNG_TEXT). Ohne diese Zeile landet der Fehler erst im Parser
  // und zeigt dann auf die Datei statt auf die Adresse.
  if (inhalt.byteLength === 0) throw new Error(`${url} antwortet mit 0 Bytes`);
  await writeFile(ziel, inhalt);
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

/** Winkelangaben im Dateinamen und in der Beschriftung: 38.6 -> "38,6". */
const grad = (g) => `${g.toFixed(1).replace('.', ',').replace(',0', '')}°`;

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
/** Wirft alle Mesh-Knoten weg, die weder Koerper noch gewuenschte Garnitur sind. */
function beschneideMeshes(root, behalten) {
  const erlaubt = new Set(behalten);
  for (const knoten of root.listNodes()) {
    if (!knoten.getMesh()) continue;
    const name = knoten.getName();
    if (KOERPER.test(name) || erlaubt.has(name)) continue;
    knoten.dispose();
  }
}

/**
 * Wirft eine Animation samt ihrer Kanaele und Abtaster weg.
 *
 * Kanaele und Abtaster einzeln — ein blosses `anim.dispose()` laesst sie im
 * Graphen stehen, und dann haelt eine geloeschte Animation ihre Daten am Leben
 * (der Befund steht ausfuehrlich in modelle-bauen.mjs).
 */
function wirfAnimationWeg(anim) {
  for (const kanal of anim.listChannels()) kanal.dispose();
  for (const abtaster of anim.listSamplers()) abtaster.dispose();
  anim.dispose();
}

/**
 * Behaelt aus `animationen` genau die fuenf gewuenschten und benennt sie
 * deutsch. Was fehlt, ist ein Abbruch und keine leere Zeile im Blatt.
 */
function benenneAnimationen(animationen, wunsch, figur) {
  const gewuenscht = new Map(Object.entries(wunsch).map(([neu, alt]) => [alt, neu]));
  const gefunden = new Set();
  for (const anim of animationen) {
    const neu = gewuenscht.get(anim.getName());
    if (!neu) {
      wirfAnimationWeg(anim);
      continue;
    }
    gefunden.add(anim.getName());
    anim.setName(neu);
  }
  return { gewuenscht, gefunden, figur };
}

/** Bricht ab, wenn eine der fuenf Animationen nicht aufgetaucht ist. */
function pruefeVollstaendig({ gewuenscht, gefunden, figur }) {
  for (const alt of gewuenscht.keys()) {
    if (!gefunden.has(alt)) throw new Error(`${figur}: Animation ${alt} fehlt`);
  }
}

/**
 * Der Normalfall: eine Figur aus "Adventurers 1.0".
 *
 * Dort steckt alles in EINER Datei — Koerper, jede Waffe des Pakets und 76
 * Animationen. Zu tun ist deshalb nur Wegwerfen und Umbenennen.
 */
async function baueAusEinemStueck(eintrag, zwischen) {
  const roh = join(zwischen, `${eintrag.figur}.glb`);
  await hole(`${QUELLE}/Characters/gltf/${eintrag.figur}.glb`, roh);

  const doc = await io.read(roh);
  const root = doc.getRoot();

  beschneideMeshes(root, eintrag.behalten);
  pruefeVollstaendig(
    benenneAnimationen(root.listAnimations(), eintrag.animationen, eintrag.figur),
  );
  return doc;
}

/**
 * Der Sonderfall: eine Figur aus "Adventurers 2.0" plus Animationspaket.
 *
 * DREI DINGE SIND HIER ANDERS ALS OBEN, und alle drei kommen daher, dass
 * KayKit mit 2.0 auseinandergezogen hat, was in 1.0 in einer Datei lag:
 *
 * 1. DIE FIGUR HAT KEINE ANIMATION. Sie kommen aus eigenen Dateien und werden
 *    hier hineinkopiert. `mergeDocuments` bringt dabei die Knochen der Quelle
 *    mit, und die Kanaele zeigen danach auf DIESE Kopie statt auf das Skelett
 *    der Figur. Ohne das Umhaengen weiter unten steht die Figur still, waehrend
 *    ein unsichtbares zweites Skelett daneben laeuft — und zwar ohne Fehler.
 * 2. DIE FIGUR HAT KEINE WAFFE. Der Stab ist eine eigene Datei und wird an
 *    `handslot.r` gehaengt (siehe GRIFF_DREHUNG).
 * 3. JEDE ZUSAMMENFUEHRUNG BRINGT EINEN EIGENEN BUFFER MIT. Ein GLB darf
 *    hoechstens einen haben, deshalb `unpartition()` am Ende. Ohne das bricht
 *    erst `io.write` ab, mit einer Meldung, die nichts mit dem Grund zu tun hat.
 */
async function baueAusTeilen(eintrag, zwischen) {
  const ordner = join(zwischen, eintrag.rolle);
  await mkdir(ordner, { recursive: true });

  const figurDatei = join(ordner, `${eintrag.figur}.glb`);
  await hole(`${QUELLE_SAMMLUNG}/${TEILE_BEISTAND.figur}/${eintrag.figur}.glb`, figurDatei);

  const doc = await io.read(figurDatei);
  const root = doc.getRoot();
  beschneideMeshes(root, eintrag.behalten);

  // Die Knochen der FIGUR, nach Namen. Sie sind das Ziel, auf das gleich jeder
  // Animationskanal umgehaengt wird.
  const knochen = new Map(root.listNodes().map((n) => [n.getName(), n]));

  const gewuenscht = new Map(
    Object.entries(eintrag.animationen).map(([neu, alt]) => [alt, neu]),
  );
  const gefunden = new Set();

  for (const datei of TEILE_BEISTAND.bewegungsdateien) {
    const pfad = join(ordner, datei);
    await hole(`${QUELLE_SAMMLUNG}/${TEILE_BEISTAND.bewegungen}/${datei}`, pfad);
    const quelle = await io.read(pfad);

    // Vorher merken, was schon da war: `mergeDocuments` gibt zwar eine Karte
    // zurueck, aber der Weg ueber "alles Neue" liest sich hier kuerzer als
    // der ueber die Karte, und die Datei enthaelt bis zu 20 Animationen.
    const vorher = new Set(root.listAnimations());
    mergeDocuments(doc, quelle);

    for (const anim of root.listAnimations()) {
      if (vorher.has(anim)) continue;
      const neu = gewuenscht.get(anim.getName());
      if (!neu) {
        wirfAnimationWeg(anim);
        continue;
      }
      gefunden.add(anim.getName());
      anim.setName(neu);
      for (const kanal of anim.listChannels()) {
        const name = kanal.getTargetNode().getName();
        const ziel = knochen.get(name);
        // Kein stilles Ueberspringen: Passt ein Knochenname nicht, ist das
        // Animationspaket nicht fuer dieses Rig — und das Ergebnis waere eine
        // Figur, die halb steht und halb zuckt.
        if (!ziel) throw new Error(`${eintrag.figur}: Knochen ${name} fehlt`);
        kanal.setTargetNode(ziel);
      }
    }
    wirfNebenszenenWeg(root);
  }
  pruefeVollstaendig({ gewuenscht, gefunden, figur: eintrag.figur });

  for (const { teil, knochen: knochenName } of eintrag.ausruestung ?? []) {
    // Drei Dateien je Teil, und die .gltf MUSS ueber `raw.` kommen (siehe
    // QUELLE_SAMMLUNG_TEXT). Die Textur liegt daneben, weil die .gltf sie ueber
    // einen relativen Pfad sucht — `io.read` loest ihn im selben Ordner auf.
    const basis = `${QUELLE_SAMMLUNG}/${TEILE_BEISTAND.ausruestung}`;
    await hole(
      `${QUELLE_SAMMLUNG_TEXT}/${TEILE_BEISTAND.ausruestung}/${teil}.gltf`,
      join(ordner, `${teil}.gltf`),
    );
    await hole(`${basis}/${teil}.bin`, join(ordner, `${teil}.bin`));
    await hole(
      `${basis}/${TEILE_BEISTAND.textur}`,
      join(ordner, TEILE_BEISTAND.textur),
    );

    const teilDoc = await io.read(join(ordner, `${teil}.gltf`));
    const karte = mergeDocuments(doc, teilDoc);
    const knoten = karte.get(teilDoc.getRoot().getDefaultScene().listChildren()[0]);
    knoten.setRotation(GRIFF_DREHUNG);

    const hand = knochen.get(knochenName);
    if (!hand) throw new Error(`${eintrag.figur}: Knochen ${knochenName} fehlt`);
    hand.addChild(knoten);
    wirfNebenszenenWeg(root, knoten);
  }

  // `dedup()` nur hier: Der Stab benutzt dieselbe Textur wie die Figur, und
  // ohne das Zusammenlegen liegt sie zweimal im Modell.
  await doc.transform(dedup());
  return doc;
}

/**
 * Wirft alle Szenen ausser der ersten weg, samt ihrem Inhalt.
 *
 * Jede Zusammenfuehrung bringt die Szene ihrer Quelle mit: beim Animationspaket
 * ein zweites Skelett, beim Stab dessen Ursprungsszene. Beides ist nach dem
 * Umhaengen ueberfluessig — aber es haengt noch an den Daten, und `prune()`
 * raeumt nur weg, was NIRGENDS mehr haengt. Was `behalten` nennt, wird
 * uebersprungen: Der Stab sitzt zu diesem Zeitpunkt schon in der Hand und ist
 * nur noch zufaellig auch Kind seiner alten Szene.
 */
function wirfNebenszenenWeg(root, behalten) {
  const haupt = root.getDefaultScene();
  for (const szene of root.listScenes()) {
    if (szene === haupt) continue;
    for (const kind of szene.listChildren()) {
      if (kind !== behalten) kind.dispose();
    }
    szene.dispose();
  }
}

async function baueModelle(zwischen, nurRollen) {
  const pfade = new Map();
  for (const eintrag of ROLLEN) {
    if (nurRollen && !nurRollen.includes(eintrag.rolle)) continue;

    const doc = eintrag.sammlung
      ? await baueAusTeilen(eintrag, zwischen)
      : await baueAusEinemStueck(eintrag, zwischen);

    // Kein `quantize()` und kein `textureCompress()`: Das Modell wird hier
    // nicht ausgeliefert, sondern nur angesehen. Beides wuerde die Bildqualitaet
    // kosten, ohne irgendetwas zu sparen, was jemand je herunterlaedt.
    await doc.transform(prune({ keepLeaves: false }), unpartition());

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
 * DIE KAMERA IST ORTHOGRAFISCH, anders als die perspektivische der Probe: Eine
 * perspektivische Kamera bildet eine Figur am Bildrand anders ab als in der
 * Mitte, und ein Sprite steht spaeter ueberall auf dem Brett. Orthografisch ist
 * jedes Bild derselben Figur gleich gross, egal wo es hinkommt.
 *
 * Winkel, Drehung und Ausschnitt kommen als Argument herein und stehen NICHT
 * in der Seite: Der Vergleichslauf braucht mehrere davon in einem Durchgang.
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

/**
 * Baut die Kamera aus dem WINKEL, nicht aus einem rohen Vektor.
 * Blickrichtung bei g Grad ueber der Waagerechten: (0, sin g, cos g).
 */
function baueKamera({ grad, halbeHoehe, mitteY }) {
  const rad = (grad * Math.PI) / 180;
  const blick = new THREE.Vector3(0, Math.sin(rad), Math.cos(rad));
  const kamera = new THREE.OrthographicCamera(-halbeHoehe, halbeHoehe, halbeHoehe, -halbeHoehe, 0.1, 60);
  kamera.position.copy(blick).multiplyScalar(12).add(new THREE.Vector3(0, mitteY, 0));
  kamera.lookAt(0, mitteY, 0);
  return kamera;
}

const lader = new GLTFLoader();
// Ein Modell je URL genuegt: Der Vergleichslauf rendert dieselbe Rolle mit
// mehreren Kameras, und jedes Mal 300 kB neu zu laden und zu riggen kostet
// mehr Zeit als der ganze Rest des Skripts.
const modelle = new Map();
async function ladeModell(url) {
  if (!modelle.has(url)) modelle.set(url, await lader.loadAsync(url));
  return modelle.get(url);
}

/** Der Knochen, an dem die Figur "haengt" — an ihm wird der Ort gemessen. */
const ANKERKNOCHEN = 'hips';

/**
 * Laeuft alle Bewegungen ab und ruft "jeBild" fuer jedes gerenderte Bild.
 *
 * Der ganze Ablauf steht genau einmal hier, weil Messen und Rendern DIESELBEN
 * Bilder sehen muessen: Waere die Messung ein zweiter, leicht anderer
 * Durchlauf, passte der gemessene Ausschnitt nicht zu den Bildern, die
 * hinterher entstehen.
 */
async function durchlaufen(url, bewegungen, kameraKonfig, jeBild) {
  const gltf = await ladeModell(url);
  const figur = gltf.scene;
  // PLUS 90 Grad, MINUS die Drehung — und beide Vorzeichen haengen daran, dass
  // das KayKit-Modell nach +Z schaut. Das ist nicht geraten, sondern an der
  // Rogue.glb abgelesen: Rogue_ArmRight liegt bei x -0,97..-0,09 (der rechte
  // Arm einer nach +Z schauenden Figur liegt links), Rogue_Cape ganz bei
  // z -0,39..-0,04 (ein Umhang haengt hinten), die Zehen ragen nach +Z.
  //
  // Ry(a) bildet +Z auf (sin a, 0, cos a) ab. Die Kamera steht auf +Z und hat
  // Weltachse +X rechts im Bild (baueKamera). Also:
  //   +90° - d  ->  (cos d, 0, sin d)   rechts, d Grad ZUR Kamera   <- gewollt
  //   +90° + d  ->  (cos d, 0, -sin d)  rechts, d Grad von ihr WEG
  //   -90° - d  ->  (-cos d, 0, -sin d) links,  d Grad von ihr weg
  //   -90° + d  ->  (-cos d, 0, sin d)  links,  d Grad zur Kamera
  //
  // WORAN MAN ES MERKT, WENN ES KIPPT — zwei verschiedene Fehler, und genau
  // deshalb kommt man mit "einmal das Vorzeichen umdrehen" nicht hin:
  //
  // 1. VORNE/HINTEN falsch (das Vorzeichen VOR der Drehung d): Die Figur zeigt
  //    den HINTERKOPF. Kein Auge, kein Ohr auf der Kameraseite, dafuer der
  //    Umhang vorn und die Waffe hinter dem Koerper.
  // 2. LINKS/RECHTS falsch (das Vorzeichen vor den 90 Grad): Die Figur zeigt
  //    ihr Gesicht, aber nach LINKS — Waffe links vor dem Koerper, Umhang
  //    rechts dahinter. figuren3d.ts verspricht der Oberflaeche rechts, und
  //    gespiegelt wird dort nur die Gegenseite; ein linksblickendes Blatt
  //    dreht damit BEIDE Seiten falsch herum.
  //
  // Beides ist hier schon passiert. Die erste Fassung stand auf +90° + d
  // (Fehler 1). Wer den dann "umdreht", landet auf -90° - d — und das ist
  // Fehler 1 UND 2 zugleich, nur faellt Fehler 1 dabei weniger auf. Genau so
  // ging der zweite Satz Blaetter am 05.09.2026 raus.
  //
  // UND HIER IST DIE FALLE: Bei STEILER Kamera faellt Fehler 1 gar nicht auf.
  // Von 38,6 Grad sieht man ohnehin nur den Scheitel, und der ist von vorn wie
  // von hinten derselbe runde Kopf. Wer am Vorzeichen zweifelt, rendert
  // deshalb NICHT bei 38,6 gegen, sondern flach.
  figur.rotation.y = Math.PI / 2 - (kameraKonfig.drehungGrad * Math.PI) / 180;
  // Die Figur haengt in einem Halter, der sie in jedem Bild zurueckschiebt
  // (siehe anStelleHalten weiter unten). Deshalb ein Halter und nicht die
  // Figur selbst: Die traegt schon die Drehung, und zwei Dinge an einem
  // Objekt zu verrechnen macht die Rechnung unlesbar.
  const halter = new THREE.Group();
  halter.add(figur);
  szene.add(halter);

  const kamera = baueKamera(kameraKonfig);

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
      jeBild(zeile, i);
    }
  }

  mischer.stopAllAction();
  szene.remove(halter);
  // Der Mischer haelt das Rig in der zuletzt gesetzten Pose fest. Ohne
  // Zuruecksetzen faengt der naechste Durchlauf derselben Figur (anderer
  // Winkel!) mit der Todespose an — und misst dann Unsinn.
  mischer.uncacheRoot(figur);
  return { laengen, kamera };
}

/** Ein Abtast-Blatt fuer die Messung, so gross wie ein Einzelbild. */
const messblatt = document.createElement('canvas');
messblatt.width = KANTE;
messblatt.height = KANTE;
const messstift = messblatt.getContext('2d', { willReadFrequently: true });

/**
 * Misst, wie weit die Figur ueber ALLE Bilder aus der Bildmitte ragt.
 *
 * Gemessen wird der ALPHAKANAL des fertig gerenderten Bildes, nicht die
 * Geometrie: Was zaehlt, ist was man sieht. Ein Umhang, der durch den Koerper
 * faellt, macht die Geometrie breiter als das Bild; ein Stab, der aus dem
 * Ausschnitt ragt, faellt in der Geometrie gar nicht auf.
 *
 * Rueckgabe in Weltmetern, bezogen auf den Kameramittelpunkt: "halbBreite" die
 * groesste Ausdehnung nach links oder rechts, "unten"/"oben" die senkrechten
 * Kanten (negativ ist unterhalb der Mitte).
 */
window.messeRolle = async (url, bewegungen, kameraKonfig) => {
  let halbBreite = 0;
  let unten = Infinity;
  let oben = -Infinity;
  const h = kameraKonfig.halbeHoehe;

  await durchlaufen(url, bewegungen, kameraKonfig, () => {
    messstift.clearRect(0, 0, KANTE, KANTE);
    messstift.drawImage(renderer.domElement, 0, 0);
    const daten = messstift.getImageData(0, 0, KANTE, KANTE).data;
    for (let y = 0; y < KANTE; y++) {
      for (let x = 0; x < KANTE; x++) {
        // Schwelle 8 statt 0: Die Kantenglaettung legt einen Saum aus fast
        // durchsichtigen Pixeln um die Figur. Bei 0 misst man den Saum mit und
        // zieht den Ausschnitt bei jedem Lauf ein Stueck weiter auf.
        if (daten[(y * KANTE + x) * 4 + 3] <= 8) continue;
        const nx = ((x + 0.5) / KANTE) * 2 - 1;
        const ny = 1 - ((y + 0.5) / KANTE) * 2;
        const bx = Math.abs(nx) * h;
        if (bx > halbBreite) halbBreite = bx;
        const by = ny * h;
        if (by < unten) unten = by;
        if (by > oben) oben = by;
      }
    }
  });

  if (unten === Infinity) throw new Error('Nichts im Bild: ' + url);
  return { halbBreite, unten, oben };
};

/** Rendert ein Blatt (eine Zeile je Bewegung) und gibt es als PNG zurueck. */
window.rendereRolle = async (url, bewegungen, kameraKonfig) => {
  const spalten = Math.max(...bewegungen.map((b) => b.bilder));
  const blatt = document.createElement('canvas');
  blatt.width = spalten * KANTE;
  blatt.height = bewegungen.length * KANTE;
  const stift = blatt.getContext('2d');

  const { laengen, kamera } = await durchlaufen(url, bewegungen, kameraKonfig, (zeile, i) => {
    stift.drawImage(renderer.domElement, i * KANTE, zeile * KANTE);
  });

  // Wo in der Zelle steht die Figur auf dem Boden? Der Punkt (0,0,0) der Szene
  // ist die Stelle, an der die Fuesse aufsetzen; Teil 2 muss sie kennen, um
  // das Sprite auf ein Feld zu setzen. Sie liegt NICHT in der Zellmitte: Die
  // Kamera schaut schraeg, der Ausschnitt ist gegen die Figur verschoben.
  // Ausgerechnet statt geschaetzt.
  const fuss = new THREE.Vector3(0, 0, 0).project(kamera);
  const fusspunkt = { x: (fuss.x + 1) / 2, y: (1 - fuss.y) / 2 };

  return { bild: blatt.toDataURL('image/png'), spalten, laengen, fusspunkt };
};

window.bereit = true;
</script>
</body></html>`;

// ---------------------------------------------------------------------------
// Schritt 3: messen, rendern, verkleinern
// ---------------------------------------------------------------------------

/**
 * Sucht den Ausschnitt, in den ALLE Rollen bei diesem Winkel hineinpassen.
 *
 * Ein gemeinsamer Ausschnitt fuer alle Rollen und alle Bewegungen ist die
 * wichtigste Eigenschaft der ganzen Datei: Nur so kann Teil 2 jede Zelle an
 * dieselbe Stelle malen, ohne je Bewegung oder je Rolle nachzurechnen.
 */
async function messeAusschnitt(seite, rollen, { grad: winkel, drehungGrad }) {
  const probe = {
    grad: winkel,
    drehungGrad,
    halbeHoehe: PROBE_HALBE_HOEHE,
    mitteY: PROBE_MITTE_Y,
  };
  let halbBreite = 0;
  let unten = Infinity;
  let oben = -Infinity;
  for (const rolle of rollen) {
    const mass = await seite.evaluate(
      ([url, bewegungen, konfig]) => window.messeRolle(url, bewegungen, konfig),
      [`/modelle/${rolle}.glb`, BEWEGUNGEN, probe],
    );
    halbBreite = Math.max(halbBreite, mass.halbBreite);
    unten = Math.min(unten, mass.unten);
    oben = Math.max(oben, mass.oben);
  }
  // Senkrecht wird die Figur MITTIG in die Zelle gelegt, waagerecht bleibt sie
  // um ihren Fusspunkt zentriert: Die Figur soll ueber ihrem Feld stehen und
  // nicht daneben, auch wenn sie beim Ausholen weit nach links greift.
  const mitte = (unten + oben) / 2;
  const halbeHoehe = Math.max(halbBreite, (oben - unten) / 2) * LUFT;
  // Die Kamera zielt auf (0, mitteY, 0); sie um dy anzuheben verschiebt das
  // Bild senkrecht um dy * cos(Winkel). Deshalb die Division.
  const mitteY = PROBE_MITTE_Y + mitte / Math.cos((winkel * Math.PI) / 180);
  return { grad: winkel, drehungGrad, halbeHoehe, mitteY };
}

/** Rendert ein Blatt und gibt es als PNG-Puffer in Zielgroesse zurueck. */
async function rendereBlatt(seite, sharp, rolle, kameraKonfig) {
  const { bild, spalten, laengen, fusspunkt } = await seite.evaluate(
    ([url, bewegungen, konfig]) => window.rendereRolle(url, bewegungen, konfig),
    [`/modelle/${rolle}.glb`, BEWEGUNGEN, kameraKonfig],
  );
  const roh = Buffer.from(bild.slice('data:image/png;base64,'.length), 'base64');
  const png = await sharp(roh)
    .resize(spalten * KANTE, BEWEGUNGEN.length * KANTE, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  return { png, spalten, laengen, fusspunkt };
}

// ---------------------------------------------------------------------------
// Vorbereitung (fuer beide Betriebsarten dieselbe)
// ---------------------------------------------------------------------------

const nurVergleich = process.argv.includes('--vergleich');

// Fester Name statt `mkdtemp`: Die 17,6 MB Originale sollen beim zweiten Lauf
// nicht noch einmal aus dem Netz kommen (`hole()` ueberspringt, was schon da
// ist). Wer wirklich frisch laden will, loescht den Ordner.
const zwischen = join(tmpdir(), 'brauweg-figuren3d');
await mkdir(zwischen, { recursive: true });
console.log(`Zwischenstand: ${zwischen}`);

const gebraucht = nurVergleich ? VERGLEICH_ROLLEN : null;
await baueModelle(zwischen, gebraucht);

const { server, port } = await starteServer(SEITE, zwischen);
const { chromium } = await ladePaket('playwright');
const { default: sharp } = await ladePaket('sharp');

const browser = await chromium.launch();
const seite = await browser.newPage();
seite.on('pageerror', (fehler) => console.error('Seite:', fehler.message));
await seite.goto(`http://127.0.0.1:${port}/seite.html`);
await seite.waitForFunction('window.bereit === true', null, { timeout: 30_000 });

// Der Aufruf steht ganz UNTEN in der Datei, nicht hier: Die Konstanten des
// Vergleichsbildes stehen weiter hinten, und ein `const` ist vor seiner Zeile
// nicht benutzbar. Funktionen darf man vorziehen, ihre Konstanten nicht.

// ---------------------------------------------------------------------------
// Betriebsart A: die fuenf Blaetter fuers Spiel
// ---------------------------------------------------------------------------

/**
 * Legt die LIZENZ.txt neben die Bilder.
 *
 * FRUEHER WAR DAS EIN `copyFile` der LICENSE.txt aus Adventurers 1.0. Seit der
 * Beistand ein Druide ist, deckt die aber nur noch vier der fuenf Blaetter —
 * und eine Lizenzdatei, die das fuenfte nicht nennt, ist schlechter als keine:
 * Sie sieht vollstaendig aus. Deshalb steht davor jetzt eine deutsche Zeile je
 * Blatt, die sagt, welche Figur aus welchem Paket kommt.
 *
 * Beide Pakete sind CC0 vom selben Urheber; der zweite Lizenztext steht
 * wortgleich in der `License.txt` der Sammlung (siehe QUELLE_SAMMLUNG) und
 * wird deshalb nicht ein zweites Mal abgedruckt, sondern benannt.
 */
async function schreibeLizenz() {
  const kopf = [
    'Die Figuren der Tafelrunde — Herkunft und Lizenz',
    '',
    'Alles hier ist CC0 1.0 Universal von Kay Lousberg (www.kaylousberg.com):',
    'frei verwendbar, auch kommerziell, Namensnennung nicht verlangt.',
    '',
    'Aus "KayKit Character Pack : Adventurers" 1.0 — Lizenztext siehe unten:',
    ...ROLLEN.filter((r) => !r.sammlung).map((r) => `  ${r.rolle.padEnd(10)} ${r.figur}`),
    '',
    'Aus "KayKit Adventurers 2.0" (Figur und Stab) und "KayKit Character',
    'Animations 1.1" (die Bewegungen) — beide CC0, Lizenztext wortgleich zum',
    'unten stehenden, nachzulesen als License.txt der Complete Collection:',
    ...ROLLEN.filter((r) => r.sammlung).map((r) => `  ${r.rolle.padEnd(10)} ${r.figur}`),
    '',
    '------------------------------------------------------------------',
    '',
  ].join('\n');
  await writeFile(join(ZIEL, 'LIZENZ.txt'), kopf + (await readFile(LIZENZ_QUELLE, 'utf8')));
}

async function baueBlaetter() {
  await mkdir(ZIEL, { recursive: true });
  await schreibeLizenz();

  const alle = ROLLEN.map((r) => r.rolle);
  const ausschnitt = await messeAusschnitt(seite, alle, {
    grad: KAMERA_GRAD,
    drehungGrad: DREHUNG_GRAD,
  });
  console.log(
    `Kamera ${grad(KAMERA_GRAD)} ueber der Waagerechten, Figur ${DREHUNG_GRAD}° zur Kamera gedreht`,
  );
  console.log(
    `Ausschnitt gemessen: halbe Hoehe ${ausschnitt.halbeHoehe.toFixed(3)}  Mitte y ${ausschnitt.mitteY.toFixed(3)}`,
  );

  const bericht = [];
  for (const eintrag of ROLLEN) {
    const { png, spalten, laengen, fusspunkt } = await rendereBlatt(
      seite,
      sharp,
      eintrag.rolle,
      ausschnitt,
    );
    const ziel = join(ZIEL, `${eintrag.rolle}.webp`);
    await sharp(png)
      // Verlustbehaftet mit `alphaQuality: 100`: Die Farbflaechen der Figuren
      // vertragen die Kompression gut, ein weicher Alphakanal nicht — ein
      // ausgefranster Umriss faellt sofort auf, ein leicht anderes Braun nie.
      .webp({ quality: 70, alphaQuality: 100, effort: 6 })
      .toFile(ziel);
    const groesse = (await readFile(ziel)).byteLength;
    bericht.push({ rolle: eintrag.rolle, groesse, laengen, fusspunkt, spalten });
  }

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
  console.log(
    `Fusspunkt in der Zelle: x ${f.x.toFixed(4)}  y ${f.y.toFixed(4)} (Anteil der Kante)`,
  );
}

// ---------------------------------------------------------------------------
// Betriebsart B: das Vergleichsbild
// ---------------------------------------------------------------------------

/** Zeilenhoehe, Beschriftungsspalte und Kopfzeilen des Vergleichsbildes. */
const V_SPALTE = 172;
const V_KOPF = 100;
const V_LUECKE = 30;
const V_GRUND = '#241d18';

function beschriftung(text, unterzeile, x, y) {
  const zweite = unterzeile
    ? `<text x="${x}" y="${y + 22}" fill="#c8b9a6" font-family="sans-serif" font-size="15">${unterzeile}</text>`
    : '';
  return `<text x="${x}" y="${y}" fill="#f4ece0" font-family="sans-serif" font-size="19" font-weight="600">${text}</text>${zweite}`;
}

/**
 * Rendert die Vergleichswinkel nebeneinander und legt sie als EIN Bild ab.
 *
 * Ein Bild und nicht zwoelf Dateien: Robin soll die Winkel nebeneinander sehen
 * und nicht zwischen Tabs springen — der Unterschied zwischen 16 und 22 Grad
 * ist genau die Art Unterschied, die man im Vergleich sofort und einzeln gar
 * nicht sieht.
 */
async function baueVergleich() {
  const zeilen = [];

  // Oberer Block: ein Winkel je Zeilenpaar, beide Rollen.
  for (const winkel of VERGLEICH_WINKEL) {
    const ausschnitt = await messeAusschnitt(seite, VERGLEICH_ROLLEN, {
      grad: winkel,
      drehungGrad: DREHUNG_GRAD,
    });
    console.log(
      `Kamera ${grad(winkel)}: halbe Hoehe ${ausschnitt.halbeHoehe.toFixed(3)}  Mitte y ${ausschnitt.mitteY.toFixed(3)}`,
    );
    for (const rolle of VERGLEICH_ROLLEN) {
      const { png } = await rendereBlatt(seite, sharp, rolle, ausschnitt);
      zeilen.push({
        png,
        titel: `${grad(winkel)} · ${rolle}`,
        unter:
          winkel === BRETTKAMERA_GRAD
            ? `Brettkamera · Ausschnitt ${ausschnitt.halbeHoehe.toFixed(2)}`
            : winkel === KAMERA_GRAD
              ? `GEWAEHLT · Ausschnitt ${ausschnitt.halbeHoehe.toFixed(2)}`
              : `Ausschnitt ${ausschnitt.halbeHoehe.toFixed(2)}`,
      });
    }
  }

  const trenner = zeilen.length;

  // Unterer Block: eine Rolle, ein Winkel, drei Drehungen.
  for (const drehung of VERGLEICH_DREHUNGEN) {
    const ausschnitt = await messeAusschnitt(seite, ['meuchler'], {
      grad: VERGLEICH_DREHUNG_GRAD,
      drehungGrad: drehung,
    });
    const { png } = await rendereBlatt(seite, sharp, 'meuchler', ausschnitt);
    zeilen.push({
      png,
      titel: `Drehung ${drehung}°`,
      unter: `bei ${grad(VERGLEICH_DREHUNG_GRAD)} · meuchler`,
    });
  }

  // Aus jedem Blatt die vier ausgewaehlten Zellen schneiden.
  const reihen = [];
  for (const zeile of zeilen) {
    const zellen = [];
    for (const wahl of VERGLEICH_ZELLEN) {
      const y = BEWEGUNGEN.findIndex((b) => b.name === wahl.bewegung);
      zellen.push(
        await sharp(zeile.png)
          .extract({ left: wahl.bild * KANTE, top: y * KANTE, width: KANTE, height: KANTE })
          .png()
          .toBuffer(),
      );
    }
    reihen.push({ ...zeile, zellen });
  }

  const breite = V_SPALTE + VERGLEICH_ZELLEN.length * KANTE;
  const hoehe =
    V_KOPF + trenner * KANTE + V_LUECKE + V_KOPF + (reihen.length - trenner) * KANTE + 12;

  const teile = [];
  const texte = [];

  // Kopfzeile des oberen Blocks, samt Spaltenbeschriftung.
  texte.push(
    beschriftung(
      'Kamerawinkel · Tafelrunde-Figuren',
      `Drehung ${DREHUNG_GRAD}° · Ausschnitt je Winkel neu gemessen`,
      14,
      26,
    ),
  );
  // Der Satz gehoert INS BILD und nicht nur in eine Notiz daneben: Das Bild
  // wandert herum, die Notiz nicht — und ohne ihn sieht es in einem halben Jahr
  // wie eine offene Frage aus statt wie eine beantwortete.
  texte.push(
    `<text x="14" y="${V_KOPF - 22}" fill="#e8c98a" font-family="sans-serif" font-size="15" font-weight="600">Entschieden am 05.09.2026 von Robin: ${grad(KAMERA_GRAD)} — so sind die Blaetter gerendert.</text>`,
  );
  VERGLEICH_ZELLEN.forEach((wahl, i) => {
    texte.push(
      `<text x="${V_SPALTE + i * KANTE + KANTE / 2}" y="${V_KOPF - 8}" fill="#9c8d7c" font-family="sans-serif" font-size="14" text-anchor="middle">${wahl.bewegung}</text>`,
    );
  });

  reihen.forEach((reihe, i) => {
    const versatz = i < trenner ? V_KOPF : V_KOPF + trenner * KANTE + V_LUECKE + V_KOPF;
    const zeileOben = versatz + (i < trenner ? i : i - trenner) * KANTE;
    texte.push(beschriftung(reihe.titel, reihe.unter, 14, zeileOben + 52));
    reihe.zellen.forEach((zelle, s) => {
      teile.push({ input: zelle, left: V_SPALTE + s * KANTE, top: zeileOben });
    });
  });

  // Kopfzeile des unteren Blocks.
  const untenOben = V_KOPF + trenner * KANTE + V_LUECKE;
  texte.push(
    beschriftung(
      'Wie weit die Figur zur Kamera gedreht steht',
      'je flacher die Kamera, desto mehr Drehung vertraegt sie',
      14,
      untenOben + 26,
    ),
  );

  // Trennlinie und Zeilenraster als eine SVG-Ebene ueber dem Hintergrund.
  const raster = reihen
    .map((_, i) => {
      const versatz = i < trenner ? V_KOPF : untenOben + V_KOPF;
      const y = versatz + (i < trenner ? i : i - trenner) * KANTE;
      return `<rect x="0" y="${y}" width="${breite}" height="${KANTE}" fill="${i % 2 ? '#2b231d' : '#241d18'}"/>`;
    })
    .join('');

  const svg = `<svg width="${breite}" height="${hoehe}" xmlns="http://www.w3.org/2000/svg">${raster}<line x1="0" y1="${untenOben + 14}" x2="${breite}" y2="${untenOben + 14}" stroke="#4a3b2e" stroke-width="2"/>${texte.join('')}</svg>`;

  await mkdir(dirname(VERGLEICHSBILD), { recursive: true });
  await sharp({
    create: { width: breite, height: hoehe, channels: 4, background: V_GRUND },
  })
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...teile])
    // Verlustbehaftet und ohne Alpha: Das Bild wird angesehen, nicht verbaut.
    .webp({ quality: 82, effort: 6 })
    .toFile(VERGLEICHSBILD);

  const groesse = (await readFile(VERGLEICHSBILD)).byteLength;
  console.log(`Vergleichsbild: ${VERGLEICHSBILD} (${breite}x${hoehe}, ${kb(groesse)})`);
}

// ---------------------------------------------------------------------------
// Los
// ---------------------------------------------------------------------------

if (nurVergleich) {
  await baueVergleich();
} else {
  await baueBlaetter();
}

await browser.close();
server.close();
