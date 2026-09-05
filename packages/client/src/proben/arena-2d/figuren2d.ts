/**
 * Die animierten Figuren der 2D-Probe: je Rolle ein Sprite-Bogen.
 *
 * ═══ HERKUNFT UND LIZENZ ═══════════════════════════════════════════════════
 *
 * Alle fuenf Boegen unter `packages/client/public/proben/arena-2d/` sind mit
 * **UnitForge** (https://unitforge.net) aus dessen eingebauten Teilen
 * zusammengesetzt und als Sprite-Bogen exportiert.
 *
 *  - Quelle:  https://unitforge.net (browserbasierter Pixel-Figurenbauer)
 *  - Autor:   UnitForge
 *  - Lizenz:  **frei fuer jede Nutzung, auch kommerziell, ohne Namensnennung.**
 *             Woertlich aus dem Lizenzabschnitt des Werkzeugs (ai-guide.md,
 *             §10): "Characters you assemble from built-in parts and export
 *             (PNG or sprite sheet) are free to use, including in commercial
 *             projects. No attribution required."
 *             Derselbe Autor hat ein Beispielpaket aus demselben Teilesatz auf
 *             OpenGameArt ausdruecklich unter **CC0** gestellt:
 *             https://opengameart.org/content/pixel-chibi-character-pack-%E2%80%94-knight-archer-gunner-spearman-48%C3%9748-animated
 *             Die Namensnennung hier steht trotzdem — ohne Vermerk kommt kein
 *             Bild ins Repo (CLAUDE.md, Regel 5).
 *
 * NICHT ins Repo gekommen sind die rohen Einzelteile des Werkzeugs; die
 * weiterzugeben untersagt dieselbe Lizenz ausdruecklich. Was hier liegt, sind
 * ausschliesslich fertig exportierte Figuren.
 *
 * ═══ WIE MAN SIE NEU ERZEUGT ═══════════════════════════════════════════════
 *
 * Auf https://unitforge.net, Reiter "Character": erst `#preset-alloff`, dann
 * die Teile unten je Rolle waehlen, `#export-anim` auf `ALL`, `#btn-sheet`.
 * Das Ergebnis ist ein PNG mit 8 Bildern je Reihe zu 48 x 48 Pixeln; ins Repo
 * kommt es verlustfrei als WebP (`magick x.png -define webp:lossless=true
 * -define webp:exact=true x.webp`) — je Bogen rund 4 kB.
 *
 * ═══ WAS BEIM ANZEIGEN ZU BEACHTEN IST ═════════════════════════════════════
 *
 * **Die Figuren schauen im Rohmaterial nach LINKS.** Seite 0 steht in dieser
 * Probe links und wird deshalb gespiegelt; Seite 1 bleibt, wie sie ist.
 *
 * **Pixelkunst braucht `image-rendering: pixelated`.** 48 Pixel auf ein
 * Viertel eines Handybildschirms hochgezogen sind ohne den Hinweis Matsch.
 *
 * **Die Zahl der Reihen ist NICHT bei allen gleich.** Waffen mit eigener
 * Angriffsbewegung (Dolch, Bogen) bringen eine zusaetzliche Reihe mit. Wer
 * die Reihe hart auf 0..4 rechnet, zeigt beim Schuetzen die Sterbebewegung
 * als Angriff. Deshalb steht je Rolle die vollstaendige Reihenfolge da.
 */

import type { Rolle } from '../arena-einheiten';

/** Was eine Figur gerade tut. Mehr Zustaende hat die Probe nicht. */
export type Bewegungsart = 'ruhig' | 'lauf' | 'schlag' | 'zucken' | 'tod';

export interface Figurensatz {
  /** Pfad des Sprite-Bogens unter `public/`. */
  readonly bogen: string;
  /** Zeilen des Bogens insgesamt — fuer die Groesse des Hintergrundbildes. */
  readonly zeilen: number;
  /** Welche Zeile welche Bewegung zeigt. */
  readonly zeile: Readonly<Record<Bewegungsart, number>>;
  /** Aus welchen Teilen die Figur besteht — die Quittung zur Lizenz oben. */
  readonly aufbau: string;
}

const ORDNER = '/proben/arena-2d';

/**
 * Bilder je Bewegung. Bei allen Boegen gleich (UnitForge exportiert immer 8),
 * und die Anzeige rechnet damit — deshalb hier als Konstante und nicht als
 * Feld je Satz.
 */
export const BILDER_JE_BEWEGUNG = 8;

/**
 * Die fuenf Rollen des Katalogs, jede mit ihrem Bogen.
 *
 * Die Zuordnung Rolle -> Ausruestung ist die einzige gestalterische
 * Entscheidung hier: Wache = Ritterhelm, Schwert, Turmschild; Meuchler =
 * dunkles Leder und roter Dolch; Schuetze = Waldlaeuferkapuze und Bogen;
 * Magier = Hut, Robe, Stab; Beistand = Paladinruestung, Streitkolben,
 * Goldschild. Fuenf Rollen genuegen — die Probe zeigt keine 22 Einheiten,
 * sondern eine Szene.
 */
export const FIGUREN_2D: Readonly<Record<Rolle, Figurensatz>> = {
  wache: {
    bogen: `${ORDNER}/wache.webp`,
    zeilen: 5,
    zeile: { ruhig: 0, lauf: 1, schlag: 2, zucken: 3, tod: 4 },
    aufbau: 'Helm "Knight 01 (Closed)" (Sichtschlitz), Ruestung/Stiefel "Knight 01", Waffe "Sword 01", Schild "Tower"',
  },
  meuchler: {
    bogen: `${ORDNER}/meuchler.webp`,
    // Der Dolch bringt CHOP_ATTACK als eigene Reihe mit — deshalb sechs.
    zeilen: 6,
    zeile: { ruhig: 0, lauf: 1, schlag: 3, zucken: 4, tod: 5 },
    aufbau: 'Haar "Spiky" (#2b2b3a), kein Helm, Ruestung/Stiefel "Dark", Waffe "Dagger Red", kein Schild',
  },
  schuetze: {
    bogen: `${ORDNER}/schuetze.webp`,
    // Der Bogen bringt BOW_ATTACK als eigene Reihe mit — deshalb sechs.
    zeilen: 6,
    zeile: { ruhig: 0, lauf: 1, schlag: 3, zucken: 4, tod: 5 },
    aufbau: 'Helm "Ranger Hood", Ruestung/Stiefel "Ranger", Waffe "Bow", kein Schild',
  },
  magier: {
    bogen: `${ORDNER}/magier.webp`,
    zeilen: 5,
    zeile: { ruhig: 0, lauf: 1, schlag: 2, zucken: 3, tod: 4 },
    aufbau: 'Helm "Mage Hat", Ruestung "Mage Robe", Stiefel "Mage", Waffe "Staff", kein Schild',
  },
  beistand: {
    bogen: `${ORDNER}/beistand.webp`,
    zeilen: 5,
    zeile: { ruhig: 0, lauf: 1, schlag: 2, zucken: 3, tod: 4 },
    aufbau: 'Helm "Paladin Wing (Closed)" (offen), Ruestung/Stiefel "Paladin", Waffe "Mace", Schild "Gold"',
  },
};

/**
 * Der Untergrund der Buehne. Schon im Repo, weil der laufende Tafelrunde-
 * Bildschirm ihn benutzt — die Probe legt keine zweite Kopie daneben.
 *
 * Wood051 (1K, Color), https://ambientcg.com/view?id=Wood051 —
 * Autor: ambientCG (Lennart Demes), Lizenz CC0 1.0.
 */
export const HOLZ_UNTERGRUND = '/tafelrunde/untergrund-holz.webp';

/**
 * Wo im Bogen ein bestimmtes Bild einer Bewegung liegt, in Prozent.
 *
 * Prozent und nicht Pixel: Die Buehne skaliert mit dem Fenster, und eine
 * Rechnung in Pixeln muesste jede Figurgroesse kennen. Bei einem
 * Hintergrundbild, das `n` mal so breit ist wie sein Kasten, verteilt der
 * Browser die Prozentwerte auf `n - 1` Schritte — deshalb `bilder - 1` und
 * nicht `bilder` im Nenner. Wer das verwechselt, bekommt ein Bild, das am
 * rechten Rand um ein halbes Einzelbild verrutscht.
 */
export function bildVersatz(index: number, anzahl: number): string {
  if (anzahl <= 1) return '0%';
  return `${(index / (anzahl - 1)) * 100}%`;
}
