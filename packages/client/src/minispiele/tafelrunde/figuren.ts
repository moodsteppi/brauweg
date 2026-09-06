/**
 * Die Bilder von Tafelrunde: je Einheit eine Figur, dazu der Untergrund des
 * Bretts. Nur die Zuordnung Kennung -> Pfad — was der Bildschirm daraus
 * macht, entscheidet screens/Tafelrunde.tsx.
 *
 * SEIT DEM 06.09.2026 SIND DIESE FIGUREN DER RUECKFALL. Brett, Bank,
 * Ladenkarte und Arena zeigen das vorgerenderte 3D-Blatt der ROLLE
 * (`Figur3D.tsx`, fuenf Blaetter fuer 22 Einheiten, siehe bildfolge.ts); eine
 * Zeile von hier kommt nur auf den Bildschirm, wenn das Blatt fehlt oder nicht
 * laedt. Wer hier ein Bild tauscht, aendert also, was man im Fehlerfall sieht
 * — nicht, was am Tisch steht. Genau das ist beim Schildknappen passiert
 * (docs/ASSETS-TAFELRUNDE-UNTOT.md).
 *
 * **Alles hier ist CC0** (Creative Commons Zero, keine Namensnennung
 * noetig). Die Herkunft steht trotzdem an jeder Zeile, aus zwei Gruenden:
 * Ohne Vermerk kommt kein Bild ins Repo (CLAUDE.md, Regel 5), und wer eine
 * Figur tauschen will, muss wissen, aus welchem Satz sie stammt, damit die
 * neue zum Rest passt.
 *
 * **Die Figuren sind Pixelkunst, 32 x 32, vierfach hochgezogen (128 x 128,
 * nearest, verlustfrei).** Bis 128 px kann man sie unveraendert zeigen;
 * groesser braucht das Bild `image-rendering: pixelated`, sonst verwischt der
 * Browser die Kanten zu Matsch. Kleiner ist unkritisch. Gewaehlt wurde der
 * Satz aus Dungeon Crawl Stone Soup, weil er als einziger freier Satz alle
 * 22 Rollen des Katalogs abdeckt — vom Wurzelriesen bis zur Grabfuerstin.
 * Gemalte CC0-Portraits gibt es fast nur fuer Menschen, und ein Drachenkind
 * als Menschenkopf waere eine falsche Auskunft.
 *
 * Der Untergrund ist eine kachelbare 1024er-Textur, als `background-image`
 * mit `repeat` gedacht; auf einem Handybildschirm liegt sie einmal, auf dem
 * Desktop kachelt sie nahtlos (ambientCG-Materialien sind dafuer gebaut).
 *
 * Quellen der Originale (nicht im Repo, siehe docs/JETZT-AUSFUEHREN.md):
 *  - Dungeon Crawl 32x32 tiles, Paket „crawl-tiles Oct-5-2010.zip",
 *    https://opengameart.org/content/dungeon-crawl-32x32-tiles —
 *    Autoren: das Team von Dungeon Crawl Stone Soup auf Grundlage von
 *    rltiles (Sammelwerk vieler Zeichner, zusammengestellt von Chris Hamons),
 *    Lizenz CC0 1.0 (LICENSE.txt im Paket).
 *  - Wood051 (1K, Color), https://ambientcg.com/view?id=Wood051 —
 *    Autor: ambientCG (Lennart Demes), Lizenz CC0 1.0
 *    (https://docs.ambientcg.com/license/).
 */

/**
 * Kennungen aus packages/game-tafelrunde/src/katalog.ts — abgeschrieben, nicht
 * eingebunden: Der Client kennt die Spielmodule nicht (CLAUDE.md). Als
 * Vereinigungstyp und nicht als `string`, damit eine Einheit ohne Bild beim
 * Uebersetzen auffaellt und nicht als leerer Kasten am Tisch.
 */
export type EinheitId =
  | 'dorfwache'
  | 'schildknappe'
  | 'astschuetze'
  | 'steinschleuderer'
  | 'funkenlehrling'
  | 'irrlicht'
  | 'gassendieb'
  | 'moosheiler'
  | 'hainwaechterin'
  | 'grimmbart'
  | 'bogenmeisterin'
  | 'nachtpfeil'
  | 'frostweberin'
  | 'schattenklinge'
  | 'knochenspaeher'
  | 'runenpriester'
  | 'wurzelriese'
  | 'drachenkind'
  | 'sturmrufer'
  | 'grabfuerstin'
  | 'klingentaenzerin'
  | 'lichtwahrerin';

const ORDNER = '/tafelrunde';

/**
 * Figur je Einheit. Jede Zeile nennt die Originaldatei im Crawl-Paket
 * (Ordner dc-mon/), damit sich der Tausch einer Figur nachvollziehen laesst.
 * Alle: Dungeon Crawl 32x32 tiles, DCSS-Team, CC0 1.0 — siehe Kopf.
 *
 * **Wer hier eine Zeile ergaenzt, ist fertig.** Das Vorladen (vorladen.ts)
 * leitet seine Liste aus dieser Tabelle ab und nicht aus einer zweiten
 * Aufzaehlung — sonst waere ausgerechnet die neue Figur die einzige, die nicht
 * vorgeladen wird.
 */
export const FIGUREN: Readonly<Record<EinheitId, string>> = {
  // --- 1 Gold ---------------------------------------------------------------
  /** vault_guard.png — Wache in grauer Ruestung. */
  dorfwache: `${ORDNER}/dorfwache.webp`,
  /**
   * undead/guardian_mummy.png — Waechtermumie mit Schild und Kruemmschwert.
   * Vorher stand hier deep_elf_soldier.png, ein sichtbar lebender Elf: Seit
   * dem 05.09.2026 traegt der Schildknappe im Katalog die Marke Untot, und
   * eine lebende Figur mit Untot-Chip ist eine falsche Auskunft am Tisch.
   * DEN TISCH ERREICHT DER TAUSCH NICHT: Dort steht das Ritterblatt der Rolle
   * Wache, dasselbe wie bei der Dorfwache, und die Mumie nur, wenn es nicht
   * laedt (siehe Kopf). Ein Untoter, der auch am Tisch untot aussieht, ist
   * ein eigenes Blatt je Rolle und Gestalt — bestellt, nicht gebaut:
   * docs/ASSETS-TAFELRUNDE-UNTOT.md.
   * Nicht skeletal_warrior.png, obwohl das der wortwoertliche Schildtraeger
   * waere — auf Brettgroesse (rund 56 px) ist es von knochenspaeher
   * (skeleton_humanoid_small) kaum zu unterscheiden, und beide stehen oft
   * nebeneinander. Die Mumie ist untot, traegt einen Schild und bleibt
   * unterscheidbar.
   */
  schildknappe: `${ORDNER}/schildknappe.webp`,
  /** centaur.png — Zentaur mit Bogen, das Waldwesen unter den Schuetzen. */
  astschuetze: `${ORDNER}/astschuetze.webp`,
  /** halfling.png — in Crawl der Schleuderer, deshalb hier. */
  steinschleuderer: `${ORDNER}/steinschleuderer.webp`,
  /** unique/jessica.png — in Crawl die Zauberlehrling-Figur, junge Magierin mit Stab. */
  funkenlehrling: `${ORDNER}/funkenlehrling.webp`,
  /** nonliving/ball_lightning.png — blaue Kugel mit Blitzen. */
  irrlicht: `${ORDNER}/irrlicht.webp`,
  /** unique/maurice.png — in Crawl der Dieb, grau vermummt. */
  gassendieb: `${ORDNER}/gassendieb.webp`,
  /** fungi_plants/wandering_mushroom.png — wandernder Pilz. */
  moosheiler: `${ORDNER}/moosheiler.webp`,

  // --- 2 Gold ---------------------------------------------------------------
  /** spriggan/spriggan_defender.png — Waldgeist mit Schild und Speer. */
  hainwaechterin: `${ORDNER}/hainwaechterin.webp`,
  /** dwarf.png — Zwerg mit Helm, Axt und Rundschild. */
  grimmbart: `${ORDNER}/grimmbart.webp`,
  /** deep_elf_master_archer.png — Elfe mit Bogen, gruene Kapuze. */
  bogenmeisterin: `${ORDNER}/bogenmeisterin.webp`,
  /** unique/nessos.png — dunkler Zentaur mit Bogen. */
  nachtpfeil: `${ORDNER}/nachtpfeil.webp`,
  /** unique/louise.png — blaue Ruestung, eisblauer Stab. */
  frostweberin: `${ORDNER}/frostweberin.webp`,
  /** unique/sonja.png — gruene Kapuze, Dolch. */
  schattenklinge: `${ORDNER}/schattenklinge.webp`,
  /** undead/skeletons/skeleton_humanoid_small.png — kleines Skelett. */
  knochenspaeher: `${ORDNER}/knochenspaeher.webp`,
  /** deep_elf_high_priest.png — blaue Robe, roter Stab. */
  runenpriester: `${ORDNER}/runenpriester.webp`,

  // --- 3 Gold ---------------------------------------------------------------
  /** nonliving/wood_golem.png — Holzgolem, der Baumriese des Satzes. */
  wurzelriese: `${ORDNER}/wurzelriese.webp`,
  /** fire_drake.png — kleiner roter Drache. */
  drachenkind: `${ORDNER}/drachenkind.webp`,
  /** deep_elf_annihilator.png — gruene Robe, Blitzstab. */
  sturmrufer: `${ORDNER}/sturmrufer.webp`,
  /** undead/ancient_lich.png — gekroenter Lich, blaue Robe. */
  grabfuerstin: `${ORDNER}/grabfuerstin.webp`,
  /** deep_elf_blademaster.png — zwei Klingen. */
  klingentaenzerin: `${ORDNER}/klingentaenzerin.webp`,
  /** holy/paladin.png — goldene Ruestung, weisser Umhang. */
  lichtwahrerin: `${ORDNER}/lichtwahrerin.webp`,
};

/**
 * Der Untergrund des Bretts: dunkles Holz, wie eine Tafel. Wood051 von
 * ambientCG (Lennart Demes), CC0 1.0 — 1024 x 1024, kachelbar.
 */
export const UNTERGRUND = `${ORDNER}/untergrund-holz.webp`;
