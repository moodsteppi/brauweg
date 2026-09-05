/**
 * Holt die CC0-Figuren der Probe und schrumpft sie auf Web-Groesse.
 *
 * NICHT Teil des Builds. Das Ergebnis (fuenf GLB unter
 * `packages/client/public/proben/arena-3d/`) liegt im Repo; dieses Skript
 * steht daneben, damit nachvollziehbar bleibt, WOHER die Dateien kommen und
 * WAS mit ihnen gemacht wurde. Ohne das waeren fuenf Binaerdateien ohne
 * Herkunft im Repo — und die Lizenzfrage waere in einem halben Jahr nicht
 * mehr zu beantworten.
 *
 * Ausfuehren (die Werkzeuge stehen bewusst NICHT in der package.json des
 * Clients — sie werden einmal gebraucht, nicht bei jedem Build):
 *
 *   cd packages/client/src/proben/arena-3d
 *   npm i --no-save @gltf-transform/core @gltf-transform/functions \
 *                   @gltf-transform/extensions sharp
 *   node modelle-bauen.mjs
 *
 * QUELLE UND LIZENZ: KayKit "Character Pack : Adventurers" 1.0 von Kay
 * Lousberg (kaylousberg.com), CC0 1.0 Universal — freie Verwendung auch
 * kommerziell, Namensnennung nicht verlangt. Bezogen aus dem offiziellen
 * GitHub-Spiegel des Autors (siehe QUELLE). Die LICENSE.txt des Pakets liegt
 * als LIZENZ.txt neben den GLB-Dateien.
 *
 * WAS HIER PASSIERT, UND WARUM DIE ROHDATEI NICHT TAUGT: Eine Figur wiegt im
 * Original 3,6 MB, alle fuenf zusammen 17,6 MB. Das ist keine Web-Anzeige.
 * Der Loewenanteil sind 76 Animationen (rund 1,6 MB je Figur) — gebraucht
 * werden vier. Dazu traegt jede Figur ihre ganze Ausruestung als eigene
 * Knoten (Schwerter, drei Schilde, Armbrueste, Becher); sichtbar ist immer
 * nur eine Garnitur. Beides faellt hier weg, danach wird quantisiert und die
 * Textur auf 128 Pixel gebracht (der Hersteller nennt das ausdruecklich als
 * ausreichend: es ist ein Farbverlaufs-Atlas, keine gemalte Textur).
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, '..', '..', '..', 'public', 'proben', 'arena-3d');
const ZWISCHEN = join(HIER, '.roh');

const QUELLE =
  'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures';

/**
 * Je Rolle eine Figur, eine Garnitur und vier Animationen.
 *
 * WARUM DIE ZUORDNUNG NICHT UEBERALL PASST: Das Paket hat fuenf Figuren, die
 * Tafelrunde fuenf Rollen — bis auf eine treffen sie sich gut. Der Beistand
 * (Moosheiler, Runenpriester, Lichtwahrerin) ist ein Heiler; das Paket hat
 * keinen. Er bekommt hier den Barbaren mit Axt und Schild. Fuer eine Probe,
 * in der es um Bildrate und Ladezeit geht, ist das tragbar; fuer einen
 * echten Einbau waere es eine eigene Figur.
 */
const ROLLEN = [
  {
    rolle: 'wache',
    figur: 'Knight',
    behalten: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'],
    animationen: {
      idle: 'Idle',
      laufen: 'Walking_A',
      angriff: '1H_Melee_Attack_Chop',
      tod: 'Death_A',
    },
  },
  {
    rolle: 'meuchler',
    figur: 'Rogue',
    behalten: ['Knife', 'Knife_Offhand', 'Rogue_Cape'],
    animationen: {
      idle: 'Idle',
      laufen: 'Running_A',
      angriff: 'Dualwield_Melee_Attack_Slice',
      tod: 'Death_A',
    },
  },
  {
    rolle: 'schuetze',
    figur: 'Rogue_Hooded',
    behalten: ['2H_Crossbow', 'Rogue_Cape'],
    animationen: {
      idle: 'Idle',
      laufen: 'Walking_A',
      angriff: '2H_Ranged_Shoot',
      tod: 'Death_A',
    },
  },
  {
    rolle: 'magier',
    figur: 'Mage',
    behalten: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'],
    animationen: {
      idle: 'Idle',
      laufen: 'Walking_A',
      angriff: 'Spellcast_Shoot',
      tod: 'Death_A',
    },
  },
  {
    rolle: 'beistand',
    figur: 'Barbarian',
    behalten: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat', 'Barbarian_Cape'],
    animationen: {
      idle: 'Idle',
      laufen: 'Walking_A',
      angriff: '1H_Melee_Attack_Chop',
      tod: 'Death_A',
    },
  },
];

/**
 * Koerperteile behaelt jede Figur. Alles andere ist Ausruestung und faellt
 * weg, wenn es nicht in `behalten` steht — der Ausschluss ist die Vorgabe,
 * nicht die Aufnahme: Kommt im naechsten Paket eine Waffe dazu, ist sie
 * automatisch aus, statt unbemerkt in der Hand zu haengen.
 */
const KOERPER = /(_Body|_Head|_Head_Hooded|_ArmLeft|_ArmRight|_LegLeft|_LegRight)$/;

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

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

await mkdir(ZWISCHEN, { recursive: true });
await mkdir(ZIEL, { recursive: true });

await hole(`${QUELLE}/LICENSE.txt`, join(ZIEL, 'LIZENZ.txt'));

const bericht = [];

for (const eintrag of ROLLEN) {
  const roh = join(ZWISCHEN, `${eintrag.figur}.glb`);
  await hole(`${QUELLE}/Characters/gltf/${eintrag.figur}.glb`, roh);
  const vorher = (await readFile(roh)).byteLength;

  const doc = await io.read(roh);
  const root = doc.getRoot();

  // 1. Ausruestung ausduennen.
  const erlaubt = new Set(eintrag.behalten);
  for (const knoten of root.listNodes()) {
    if (!knoten.getMesh()) continue;
    const name = knoten.getName();
    if (KOERPER.test(name) || erlaubt.has(name)) continue;
    knoten.dispose();
  }

  // 2. Animationen auf vier eindampfen und auf deutsche Namen bringen. Der
  //    Client soll `angriff` sagen koennen, ohne zu wissen, ob die Figur haut,
  //    schiesst oder zaubert — sonst stuende die Zuordnung zweimal im Code.
  const gewuenscht = new Map(Object.entries(eintrag.animationen).map(([neu, alt]) => [alt, neu]));
  //    ACHTUNG, hier steckt die eigentliche Ersparnis: Ein blosses
  //    `anim.dispose()` bringt fast nichts. Kanaele und Abtaster sind eigene
  //    Knoten im Objektgraphen und ueberleben ihre Animation; sie halten die
  //    Zugriffe am Leben, und `prune` sieht deshalb lauter benutzte Daten.
  //    Beim ersten Anlauf kamen so 2,2 MB je Figur heraus statt 0,2 MB.
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

  // 3. Aufraeumen. `resample` wirft Schluesselbilder weg, die sich linear aus
  //    ihren Nachbarn ergeben; `prune` die Zugriffe, Materialien und Knochen,
  //    die nach Schritt 1 und 2 niemand mehr braucht.
  await doc.transform(
    resample(),
    prune({ keepLeaves: false }),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [128, 128] }),
    quantize(),
  );

  const ausgabe = join(ZIEL, `${eintrag.rolle}.glb`);
  await io.write(ausgabe, doc);
  const nachher = (await readFile(ausgabe)).byteLength;
  bericht.push({ rolle: eintrag.rolle, figur: eintrag.figur, vorher, nachher });
}

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
let summeVorher = 0;
let summeNachher = 0;
for (const z of bericht) {
  summeVorher += z.vorher;
  summeNachher += z.nachher;
  console.log(
    `${z.rolle.padEnd(10)} ${z.figur.padEnd(14)} ${kb(z.vorher).padStart(9)} -> ${kb(z.nachher).padStart(8)}`,
  );
}
console.log(`${'zusammen'.padEnd(25)} ${kb(summeVorher).padStart(9)} -> ${kb(summeNachher).padStart(8)}`);
