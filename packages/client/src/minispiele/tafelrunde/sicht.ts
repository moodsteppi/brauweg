/**
 * Die Sicht des Tafelrunde-Moduls, wie der Client sie liest.
 *
 * Sie stand bis zum 06.09.2026 in screens/Tafelrunde.tsx. Hier steht sie,
 * weil der Vertrag unter src/vertrag/ sie gegen die echte Modulsicht haelt
 * (packages/game-tafelrunde/src/sicht.ts) — und ein Import aus dem Bildschirm
 * zoege React samt aller Bauteile in einen Test, der nur Typen vergleichen
 * will.
 *
 * Zweitbeschreibung mit Absicht: Der Client soll genau die Felder kennen, die
 * er benutzt, und nicht mit einer neueren Serverfassung mitwandern. Was das
 * kostet und wer es auffaengt, steht in src/vertrag/README.md.
 */

import type { Kampfpaarung, Paarungsergebnis } from './KampfAnzeige';
import type { Synergie, Synergiestand } from './Synergien';
import type { Platz } from './platzierung';
import type { Kaempfer } from './zuege';

/** Kampfrolle. Siehe packages/game-tafelrunde/src/katalog.ts. */
export type Rolle = 'wache' | 'schuetze' | 'magier' | 'meuchler' | 'beistand';

export interface Einheit {
  id: string;
  name: string;
  kosten: number;
  rolle: Rolle;
  marken: string[];
  leben: number;
  angriff: number;
  tempo: number;
  reichweite: number;
  ruestung: number;
}

/*
 * `Kaempfer` und `Ort` stehen in minispiele/tafelrunde/zuege.ts — zusammen
 * mit der Rechnerei, die sie benutzt. Ein zweiter Satz hier liefe beim ersten
 * neuen Feld auseinander.
 */

export interface Serie {
  art: 'sieg' | 'niederlage' | null;
  laenge: number;
}

/** Alles, was nur dem eigenen Sitz gehoert. */
export interface EigeneSicht {
  sitz: number;
  leben: number;
  gold: number;
  level: number;
  laden: (string | null)[];
  bank: (Kaempfer | null)[];
  brett: (Kaempfer | null)[];
  serie: Serie;
  bereit: boolean;
  ausRunde: number | null;
  feldplaetze: number;
  belegt: number;
  einkommen: number;
  neuwuerfelnKosten: number;
  aufstiegKosten: number | null;
  darfHandeln: boolean;
  /**
   * Die Marken auf dem eigenen BRETT mit Anzahl, erreichter und naechster
   * Schwelle (sicht.ts). Nur Marken mit mindestens einem Traeger stehen
   * drin — das Modul laesst die uebrigen weg.
   *
   * Wahlfrei gefuehrt wie `kaempfe`: Ein Tisch, der vor den Synergien
   * aufgemacht wurde, hat das Feld nicht. Dann bleibt die Leiste leer,
   * statt dass der Bildschirm stolpert.
   */
  synergien?: Synergiestand[];
}

export interface FremdeSicht {
  sitz: number;
  leben: number;
  level: number;
  serie: Serie;
  brett: (Kaempfer | null)[];
  bereit: boolean;
  ausRunde: number | null;
  verlassen: boolean;
  /** Auch beim Gegner: Das Brett ist oeffentlich, also sind es seine Marken. */
  synergien?: Synergiestand[];
}

export interface TafelrundeSicht {
  ich: number | null;
  runde: number;
  rundenGrenze: number;
  phase: 'vorbereitung' | 'kampf' | 'ende';
  fertig: boolean;
  sieger: number | null;
  /**
   * Die Rangliste aller Sitze, der beste zuerst (sicht.ts). Sie steht in
   * jeder Sicht und nicht erst am Ende — wer in Runde vier ausscheidet,
   * bekommt sein Endbild, waehrend die Partie weiterlaeuft.
   */
  platzierung: Platz[];
  zuschauer: boolean;
  ladenPlaetze: number;
  bankPlaetze: number;
  brettFelder: number;
  brettReihen: number;
  brettSpalten: number;
  /**
   * Reihen der Kampfarena (arena.ts). Nicht `brettReihen * 2`: Zwischen den
   * beiden Haelften liegen leere Reihen, und wie viele, weiss nur das Modul.
   */
  arenaReihen: number;
  verschmelzZahl: number;
  maxStufe: number;
  vorrat: Record<string, number>;
  eigenes: EigeneSicht | null;
  gegner: FremdeSicht[];
  leftSeats: number[];
  /**
   * Die Kaempfe der laufenden Kampfphase mit vollem Ablaufprotokoll — ein
   * Spieler bekommt seinen eigenen, ein Zuschauer alle; ausserhalb der
   * Kampfphase leer (sicht.ts). Als wahlfrei gefuehrt, weil eine Sicht aus
   * der Zeit vor der Kampfsimulation das Feld nicht hat — der Bildschirm
   * zeigt dann die Wartezeile statt zu stolpern.
   */
  kaempfe?: Kampfpaarung[];
  /**
   * ALLE Kaempfe der laufenden Runde als blosses Ergebnis, ohne Protokoll —
   * auch die, denen dieser Sitz nicht zusieht (sicht.ts). Daraus entstehen die
   * Ergebniszeilen unter der Arena; aus `kaempfe` koennte sie nur ein
   * Zuschauer bauen.
   *
   * Wahlfrei wie `kaempfe`, und aus demselben Grund: Ein Tisch aus der Zeit
   * davor hat das Feld nicht.
   */
  paarungen?: Paarungsergebnis[];
  /** Kommt NUR in der ersten Sicht nach dem Beitritt, siehe sicht.ts. */
  katalog?: Einheit[];
  /**
   * Die Synergie-Tabelle mit allen Stufen — wie der Katalog nur in der ersten
   * Sicht und aus demselben Grund: Sie aendert sich nie. Wer sie nicht
   * festhaelt, hat ab dem zweiten Rundruf keine Schwellen mehr.
   */
  synergieTabelle?: Synergie[];
}
