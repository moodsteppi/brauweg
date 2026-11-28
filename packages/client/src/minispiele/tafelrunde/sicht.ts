/**
 * Die Sicht des Tafelrunde-Moduls, wie der Client sie liest.
 *
 * Hier und nicht im Bildschirm, weil der Vertrag unter src/vertrag/ sie gegen
 * die echte Modulsicht haelt (packages/game-tafelrunde/src/sicht.ts) — und
 * ein Import aus dem Bildschirm zoege React samt aller Bauteile in einen Test,
 * der nur Typen vergleichen will.
 *
 * Zweitbeschreibung mit Absicht: Der Client soll genau die Felder kennen, die
 * er benutzt, und nicht mit einer neueren Serverfassung mitwandern. Was das
 * kostet und wer es auffaengt, steht in src/vertrag/README.md.
 */

import type { Kampfpaarung, Paarungsergebnis } from './kampfbericht';
import type { Synergie, Synergiestand } from './marken';
import type { Platz } from './platzierung';
import type { Kaempfer } from './zuege';

/** Kampfrolle. Siehe packages/game-tafelrunde/src/katalog.ts. */
export type Rolle = 'wache' | 'schuetze' | 'magier' | 'meuchler' | 'beistand';

export interface Einheit {
  id: string;
  name: string;
  /** Kostenstufe 1–3: Rahmenfarbe und Chancen im Laden — NICHT der Preis. */
  kosten: number;
  /**
   * Was der Kauf kostet (seit dem 27.11.2026 abends, katalog.ts). Wahlfrei,
   * weil die aufgezeichneten Szenen der Proben und Tische aus der Zeit davor
   * es nicht haben; dort war die Stufe der Preis (`preisVon` in neu/grafik.tsx).
   */
  preis?: number;
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

/**
 * Was eine Einheit auf einer Sternstufe mitbringt — und was sie beim
 * Verkaufen einbringt (sicht.ts im Modul).
 *
 * Fertig gerechnet, und das ist der ganze Zweck: Der Katalog nennt nur die
 * Werte der ersten Stufe, eine verschmolzene Einheit hat aber mehr Leben und
 * mehr Angriff — Tempo, Reichweite und Ruestung dagegen nicht. Welcher Wert
 * mit der Stufe waechst und welcher nicht, ist eine Regel des Moduls; hier
 * wird sie gelesen und nicht nachgerechnet.
 */
export interface Stufenwerte {
  stufe: number;
  leben: number;
  angriff: number;
  tempo: number;
  reichweite: number;
  ruestung: number;
  /** Gold, das ein Verkauf auf dieser Stufe einbringt. */
  erloes: number;
}

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
  /**
   * Wie viele Feldplaetze es in der naechsten Runde gibt (seit dem 27.11.2026
   * abends: Die Plaetze wachsen mit der Runde statt mit gekauften Raengen).
   * Aus der Sicht und nicht aus der Runde gerechnet — wie viele dazukommen und
   * wo Schluss ist, weiss das Modul. Wahlfrei fuer Tische aus der Zeit davor.
   */
  feldplaetzeNaechsteRunde?: number;
  /**
   * Gegen wen man im Kampf dieser Runde antritt, schon in der Ruestphase
   * (seit dem 28.11.2026). `geist`: Es kommt das Abbild dieses Bretts. Null im
   * Kampf und fuer Ausgeschiedene; wahlfrei fuer Tische aus der Zeit davor.
   */
  naechsterGegner?: { sitz: number; geist: boolean } | null;
  belegt: number;
  einkommen: number;
  /*
   * `neuwuerfelnKosten` und `aufstiegKosten` standen hier bis zum 27.11.2026:
   * Neu wuerfeln und Rang steigern gibt es seitdem nicht mehr (Robin).
   */
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
   * Der Zeitraffer der Kampfsimulation (kampf.ts): um wie viel schneller alles
   * ablaeuft als im Katalog gemessen.
   *
   * Die Arena spielt das Protokoll in Echtzeit ab, die Bildraten der
   * 3D-Bildfolgen sind aber die des Modells (figuren3d.ts). Ohne diesen Faktor
   * holen die Figuren in Zeitlupe aus, waehrend die Treffer im geraffeten Takt
   * fallen — bis zum 18.09.2026 stand er als `KAMPF_TEMPO = 2` in
   * bildfolge.ts und war eine Abschrift.
   */
  zeitraffer: number;
  /**
   * Wie lange ein Schritt von Feld zu Feld dauert, in Millisekunden
   * (`schrittdauer` in kampf.ts). Nicht `500 / zeitraffer`: Das Modul rundet
   * auf ganze Takte auf.
   */
  schrittMs: number;
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
  /**
   * Werte und Verkaufserloes je Sternstufe, je Einheit — wie der Katalog nur
   * in der ersten Sicht und aus demselben Grund: Sie aendern sich nie. Wer
   * sie nicht festhaelt, hat ab dem zweiten Rundruf kein Blatt mehr, das die
   * Werte einer angetippten Einheit nennen koennte.
   */
  stufenwerte?: Record<string, Stufenwerte[]>;
  /**
   * Je Einheit ihre Faehigkeit oder null (seit dem 27.11.2026, faehigkeiten.ts
   * im Modul). Wie der Katalog nur in der ERSTEN Sicht (`seit === 0`) und aus
   * demselben Grund: Sie aendert sich nie. Wer sie nicht festhaelt, hat ab dem
   * zweiten Rundruf keinen Manabalken mehr — volles Mana steht nur hier, und
   * der Bildschirm soll keine zweite Zahl dafuer kennen.
   *
   * Wahlfrei, weil ein Tisch aus der Zeit davor das Feld nicht schickt. Das
   * alte Tafelrunde liest es nicht; es steht hier, weil der Vertrag jedes Feld
   * der Modulsicht kennen will, das der Client liest (TafelrundeNeu).
   */
  faehigkeiten?: Record<string, Faehigkeit | null>;
}

/**
 * Eine Faehigkeit, wie die Sicht sie liefert (faehigkeiten.ts im Modul).
 *
 * `id` ist eine Zeichenkette und kein Vereinigungstyp, aus demselben Grund wie
 * die Marke in marken.tsx: Eine neue Faehigkeit im Modul soll am Bildschirm
 * mit dem deutschen Namen aus der Sicht erscheinen und nicht den Bau brechen.
 */
export interface Faehigkeit {
  id: string;
  /** Deutscher Name — Inhalt des Spiels, uebersetzt wird ueber `id` (text.ts). */
  name: string;
  /** Ein Satz fuer das Einheitenblatt. */
  text: string;
  /** Passiv wirkt immer und braucht kein Mana; dann gibt es keinen Balken. */
  art: 'aktiv' | 'passiv';
  /** Volles Mana. Bei passiven 0. */
  mana: number;
}
