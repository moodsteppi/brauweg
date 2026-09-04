/**
 * Der Bot.
 *
 * Er bekommt ausschliesslich die gefilterte Sicht (game-api, `botAction`) und
 * kann deshalb bauartbedingt nicht schummeln — den Laden des Gegners sieht er
 * so wenig wie ein Mensch.
 *
 * Den KATALOG holt er sich dagegen direkt aus dem Modul und nicht aus der
 * Sicht. Das ist kein Umweg um die Filterung: Der Katalog ist oeffentlich, er
 * steht in jeder Sicht beim ersten Ausliefern. Aber er steht dort eben nur
 * beim ERSTEN, und ein Bot, der von der Belieferungsmarke abhinge, spielte je
 * nach Rundruf verschieden.
 *
 * WAS ER SPIELT. Bis zum 04.09.2026 kaufte er das Teuerste, was er sich
 * leisten konnte, schob es auf das naechstbeste freie Feld und stieg auf,
 * sobald das Gold reichte. Robin hat dagegen gespielt: "Sie sind da, aber sie
 * spielen nicht." Seitdem folgt er vier benannten Regeln, jede mit ihrer
 * eigenen Ueberschrift weiter unten:
 *
 *   1. KAUFEN NACH WERT — eine Verschmelzung schlaegt alles, danach zaehlen
 *      Paare, vertretene Marken und die reine Staerke.
 *   2. AUFSTELLEN NACH ROLLE — Wachen und Meuchler nach vorn, Schuetzen,
 *      Magier und Beistand nach hinten, Meuchler zusaetzlich an den Rand.
 *   3. AUFSTIEG BEI VOLLEM BRETT — ein Feldplatz nuetzt nur, wenn etwas
 *      darauf steht.
 *   4. NEU-WUERFELN NUR BEI FREMDEM LADEN — wenn das Brett voll ist, kein
 *      Ladenplatz zum eigenen Heer passt und danach noch ein Kauf drin ist.
 *
 * EINE AKTION JE AUFRUF. Die Plattform ruft `botAction` so lange, bis der Bot
 * `bereit` meldet; jede Aktion geht einzeln ueber den Server. Dass diese
 * Schleife endet, ist deshalb keine Nebensache, sondern die Bedingung dafuer,
 * dass eine Runde ueberhaupt zu Ende geht. Sie endet, weil jede Aktion ein
 * Mass echt verkleinert, das nicht unter null kann:
 *
 *   - Kaufen, Neu-Wuerfeln und Aufsteigen kosten GOLD, und in der Vorbereitung
 *     kommt keines nach (der Bot verkauft nichts).
 *   - Die drei Stellungszuege verkleinern das Tripel (freie Feldplaetze,
 *     -Brettstaerke, Stellungskosten) der Reihe nach: Aufstellen den ersten
 *     Wert, Austauschen den zweiten, Umstellen den dritten. Jeder von ihnen
 *     laesst die davorstehenden unberuehrt.
 *
 * KEIN Math.random. Wo der Bot wuerfelt — und das tut er nur bei der
 * Patzerregel der leichten Gangarten —, kommt die Zahl aus `baueZufall` ueber
 * eine Saat, die sich vollstaendig aus der Sicht ergibt. Dieselbe Lage ergibt
 * damit denselben Zug, und zwar auf jedem Rechner (Grundsatz 1).
 */

import type { Kaempfer, TafelrundeAktion } from './partie.js';
import type { EigeneSicht, TafelrundeSicht } from './sicht.js';
import { type EinheitId, type Marke, einheit, werteFuer } from './katalog.js';
import { baueZufall } from './zufall.js';

// ---------------------------------------------------------------------------
// Gangarten
// ---------------------------------------------------------------------------

/**
 * Wie hart der Gegner spielt.
 *
 * Ein Parameter mit Vorgabe und kein Feld im Regelsatz: Der Tisch waehlt heute
 * noch keine Gangart aus, und eine Stellschraube, die niemand stellt, gehoert
 * nicht in `TafelrundeRegeln` — dort stuende sie in jedem gespeicherten
 * Snapshot und in jedem Konfigurationsformular.
 */
export type Schwierigkeit = 'sanft' | 'normal' | 'hart';

interface Gangart {
  /**
   * Gold, das ab `POLSTER_AB_RUNDE` liegen bleibt.
   *
   * Sparen ist in diesem Spiel KEINE Staerke, und das war die Ueberraschung
   * der Messung: Der Zins ist bei 5 gedeckelt (`ZINS_MAX`), eine Partie zu
   * zweit dauert rund siebzehn Runden, und in dieser Zeit bringt ein
   * zurueckgehaltenes Gold weniger ein, als eine Einheit auf dem Brett wert
   * ist. Deshalb haelt hier der SANFTE Gegner am meisten zurueck, nicht der
   * harte — Horten ist die Schwaeche, die Robin an einem Menschen wiedererkennt.
   */
  readonly polster: number;
  /** Was nach einem Aufstieg uebrig bleiben soll, um das neue Feld zu fuellen. */
  readonly aufstiegsReserve: number;
  /** Steigt er nur auf, wenn das Brett voll ist? Siehe AUFSTIEG BEI VOLLEM BRETT. */
  readonly nurBeiVollemBrett: boolean;
  /** Wuerfelt er einen Laden neu, der nicht zu ihm passt? */
  readonly wuerfeltNeu: boolean;
  /**
   * Wie oft er statt des besten einen beliebigen bezahlbaren Kauf nimmt.
   *
   * Ein schwaecherer Gegner soll nicht weniger TUN — ein Bot mit halb leerer
   * Bank war der Anlass dieser Arbeit —, sondern schlechter WAEHLEN. Deshalb
   * kauft auch der sanfte in jeder Runde und fuellt sein Brett; er kauft nur
   * oft das Falsche.
   */
  readonly patzerQuote: number;
  /**
   * Greift er jedes Mal zu, wenn ein Kauf sofort verschmilzt?
   *
   * Was in diesem Spiel ueber Sieg und Niederlage entscheidet, ist die
   * Sternstufe: Eine Verschmelzung hebt Leben und Angriff auf das 1,8-fache,
   * im Zusammenspiel also auf gut das Dreifache. Wer sie mitnimmt, gewinnt.
   * Nur der sanfte Gegner darf sie verpassen.
   */
  readonly nimmtVerschmelzungImmer: boolean;
}

/**
 * Die drei Gangarten.
 *
 * `normal` ist die Vorgabe und zugleich die Fassung, die nach Lehrbuch spielt:
 * ab Runde 4 ein kleines Polster, Aufstieg nur bei vollem Brett, selten ein
 * Fehlgriff. `hart` spielt auf TEMPO — kein Zoegern beim Aufstieg, keine
 * Reserve, kein Fehlgriff. `sanft` sitzt auf seinem Gold, steigt spaet auf,
 * greift meist blind zu und verpasst Verschmelzungen.
 *
 * DASS DIESE REIHENFOLGE STIMMT, IST GEMESSEN und nicht geschaetzt — je 60
 * Partien zu zweit, mit eigenen Saaten und einmal mit vertauschten Sitzen:
 *
 *     hart : sanft   54 : 6      (vertauscht 48 : 12)
 *     hart : normal  42 : 18
 *     normal : sanft 41 : 19
 *
 * Der erste Anlauf hatte die Schrauben andersherum gesetzt — der harte Gegner
 * sparte am meisten und stieg am vorsichtigsten auf — und lag danach ueber 40
 * Partien mit 19:21 GLEICHAUF mit dem sanften. Wer hier etwas verstellt, misst
 * bitte nach; die Zahlen fallen in ein paar Sekunden an.
 */
const GANGARTEN: Readonly<Record<Schwierigkeit, Gangart>> = {
  sanft: {
    polster: 8,
    aufstiegsReserve: 6,
    nurBeiVollemBrett: true,
    wuerfeltNeu: false,
    patzerQuote: 0.75,
    nimmtVerschmelzungImmer: false,
  },
  normal: {
    polster: 4,
    aufstiegsReserve: 3,
    nurBeiVollemBrett: true,
    wuerfeltNeu: true,
    patzerQuote: 0.15,
    nimmtVerschmelzungImmer: true,
  },
  hart: {
    polster: 4,
    aufstiegsReserve: 0,
    nurBeiVollemBrett: false,
    wuerfeltNeu: true,
    patzerQuote: 0,
    nimmtVerschmelzungImmer: true,
  },
};

/**
 * Vor dieser Runde bleibt kein Gold liegen.
 *
 * In den ersten drei Runden ist jedes zurueckgehaltene Gold verschenkt: Der
 * Zins beginnt erst bei zehn, das Brett hat ein bis drei Plaetze, und wer sie
 * leer laesst, verliert die Kaempfe, die den Rest der Partie bezahlen.
 */
const POLSTER_AB_RUNDE = 4;

// ---------------------------------------------------------------------------
// Bewertung einer Einheit
// ---------------------------------------------------------------------------

/**
 * Damit die Staerken dreistellig bleiben und nicht sechsstellig. Reine
 * Lesbarkeit — verglichen werden sie nur untereinander.
 */
const STAERKE_TEILER = 100;

/**
 * Wie viel eine Einheit dem Bot wert ist: was sie aushaelt MAL dem, was sie
 * austeilt.
 *
 * Das Produkt und nicht die Summe, und das ist der Kern der Bewertung: Eine
 * Einheit teilt so lange aus, wie sie steht, ihr Beitrag ist also beides
 * miteinander. Addiert man stattdessen, gewinnt jeder Sandsack — der
 * Schildknappe (700 Leben, 45 Ruestung, aber knapp 17 Schaden je Sekunde)
 * stuende dann vor jedem Angreifer, und der Bot baute ein Heer, das nichts
 * umbringt.
 *
 * Die Ruestung ist ein Faktor auf das Leben und keine Zugabe: Der Kampf
 * mindert jeden Treffer um ihren Prozentsatz (`schadenNach` in kampf.ts), 50
 * Ruestung verdoppeln also das, was eine Einheit aushaelt.
 *
 * Was hier NICHT eingeht, ist die Reichweite — ein Schuetze mit denselben
 * Werten ist mehr wert als ein Nahkaempfer. Der Bot faengt das ueber die
 * Stellung ab (Schuetzen nach hinten) und nicht ueber einen weiteren
 * geschaetzten Faktor.
 *
 * Den Kampf wirklich durchrechnen zu lassen waere verlockend und falsch: Der
 * Bot entscheidet mehrmals je Runde, und `simuliereKampf` ist die teuerste
 * Rechnung des Moduls.
 */
function staerke(k: Kaempfer): number {
  const w = werteFuer(k.id, k.stufe);
  const haelt = (w.leben * 100) / Math.max(1, 100 - w.ruestung);
  const teiltAus = w.angriff * w.tempo;
  return Math.round((haelt * teiltAus) / STAERKE_TEILER);
}

/** Alle eigenen Einheiten, Brett und Bank zusammen. */
function eigeneEinheiten(eigen: EigeneSicht): Kaempfer[] {
  return [...eigen.brett, ...eigen.bank].filter((k): k is Kaempfer => k !== null);
}

/** Wie viele Kopien der untersten Stufe schon da sind — die verschmelzen. */
function kopienVon(eigene: readonly Kaempfer[], id: EinheitId): number {
  return eigene.filter((k) => k.id === id && k.stufe === 1).length;
}

/** Wie oft jede Marke im eigenen Heer vertreten ist. */
function markenZaehlung(eigene: readonly Kaempfer[]): Map<Marke, number> {
  const zaehlung = new Map<Marke, number>();
  for (const k of eigene) {
    for (const marke of einheit(k.id).marken) {
      zaehlung.set(marke, (zaehlung.get(marke) ?? 0) + 1);
    }
  }
  return zaehlung;
}

// ---------------------------------------------------------------------------
// 2. AUFSTELLEN NACH ROLLE
// ---------------------------------------------------------------------------

/**
 * Reihe 0 ist die vorderste — sie liegt in der Arena an der Mittellinie, und
 * zwar fuer BEIDE Seiten (siehe `nachArena` in arena.ts). Wer das verwechselt,
 * stellt seine Wachen in die hinterste Reihe und schickt die Magier voran.
 */
const VORDERSTE_REIHE = 0;

/** Eine falsche Reihe wiegt schwerer als eine falsche Spalte. */
const REIHEN_GEWICHT = 10;

/** Und ein Meuchler in der Mitte schwerer als eine Wache neben der Mitte. */
const RAND_GEWICHT = 2;

/**
 * Wie schlecht dieser Platz fuer diese Einheit ist. Null ist ideal.
 *
 * Die Rolle steht im Katalog, die Vorlieben sind die des Kampfes:
 *
 *   - `wache` nach vorn und in die Mitte. Sie soll zuerst getroffen werden,
 *     und in der Mitte deckt sie mehr Nachbarfelder (Sechseckraster, sechs
 *     Nachbarn statt vier).
 *   - `schuetze`, `magier`, `beistand` nach hinten und in die Mitte. Alle drei
 *     haben Reichweite 2 bis 4 und wenig Leben; vorn sterben sie, bevor sie
 *     zweimal geschossen haben. Der Beistand steht ausdruecklich dabei,
 *     obwohl die Aufgabe ihn nicht nennt: Mit Reichweite 2 und dem niedrigsten
 *     Angriff des Katalogs gehoert er nirgendwo anders hin.
 *   - `meuchler` nach vorn an den RAND. Er hat Reichweite 1 und das hoechste
 *     Tempo; am Rand laeuft er an der gegnerischen Front vorbei, statt sich in
 *     ihr festzubeissen.
 *
 * `reihen` und `spalten` kommen aus der Sicht und nicht aus brett.ts: Die
 * beiden Zahlen stehen dort, damit niemand sie nachbaut — auch der Bot nicht.
 */
function platzStrafe(k: Kaempfer, platz: number, reihen: number, spalten: number): number {
  const reihe = Math.floor(platz / spalten);
  const spalte = platz % spalten;
  const nachHinten = reihen - 1 - reihe;
  const zurMitte = Math.abs(spalte - (spalten - 1) / 2);
  const zumRand = Math.min(spalte, spalten - 1 - spalte);

  switch (einheit(k.id).rolle) {
    case 'wache':
      return REIHEN_GEWICHT * (reihe - VORDERSTE_REIHE) + zurMitte;
    case 'meuchler':
      return REIHEN_GEWICHT * (reihe - VORDERSTE_REIHE) + RAND_GEWICHT * zumRand;
    default:
      return REIHEN_GEWICHT * nachHinten + zurMitte;
  }
}

/** Der beste freie Platz fuer diese Einheit; bei Gleichstand der kleinste. */
function bestesFeld(
  k: Kaempfer,
  freie: readonly number[],
  reihen: number,
  spalten: number,
): number {
  let bester = freie[0]!;
  let beste = platzStrafe(k, bester, reihen, spalten);
  for (const platz of freie) {
    const strafe = platzStrafe(k, platz, reihen, spalten);
    if (strafe < beste) {
      bester = platz;
      beste = strafe;
    }
  }
  return bester;
}

interface Stelle {
  readonly platz: number;
  readonly k: Kaempfer;
}

/**
 * Der naechste Zug am eigenen Brett, oder null, wenn nichts zu ruecken ist.
 *
 * Drei Faelle in dieser Reihenfolge, und die Reihenfolge ist zugleich der
 * Beweis, dass die Aufrufschleife endet (siehe Dateikopf):
 *
 *   a) AUFSTELLEN: ein Feldplatz frei und etwas auf der Bank.
 *   b) AUSTAUSCHEN: Brett voll, aber auf der Bank steht etwas Staerkeres.
 *   c) UMSTELLEN: dieselben Einheiten stehen besser, wenn eine auf ein freies
 *      Feld rueckt oder zwei ihre Plaetze tauschen.
 *
 * Fall (b) und (c) verlangen einen ECHTEN Gewinn. Ohne dieses "echt" schoebe
 * der Bot zwei gleich gute Einheiten bis zum Zeitablauf hin und her, und die
 * Runde endete nie.
 */
function stellungsZug(sicht: TafelrundeSicht, eigen: EigeneSicht): TafelrundeAktion | null {
  const reihen = sicht.brettReihen;
  const spalten = sicht.brettSpalten;

  const freie: number[] = [];
  const stehen: Stelle[] = [];
  eigen.brett.forEach((k, platz) => {
    if (k === null) freie.push(platz);
    else stehen.push({ platz, k });
  });

  const bank: Stelle[] = [];
  eigen.bank.forEach((k, platz) => {
    if (k !== null) bank.push({ platz, k });
  });

  // Die staerkste Einheit der Bank, bei Gleichstand die am weitesten links.
  const vonBank: Stelle | null = bank.reduce<Stelle | null>(
    (bisher, jetzt) => (bisher === null || staerke(jetzt.k) > staerke(bisher.k) ? jetzt : bisher),
    null,
  );

  // a) Aufstellen. Ein freies Brettfeld allein genuegt nicht — die Grenze ist
  //    `feldplaetze`, und darueber hinaus weist `fuehreAus` den Zug ab.
  if (eigen.belegt < eigen.feldplaetze && freie.length > 0 && vonBank !== null) {
    return {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: vonBank.platz },
      nach: { bereich: 'brett', platz: bestesFeld(vonBank.k, freie, reihen, spalten) },
    };
  }

  // b) Austauschen. Ein Tausch aendert die Belegung nicht und ist deshalb auch
  //    bei vollem Brett erlaubt (siehe `verschieben` in fuehreAus).
  if (vonBank !== null && stehen.length > 0) {
    const schwaechste = stehen.reduce((bisher, jetzt) =>
      staerke(jetzt.k) < staerke(bisher.k) ? jetzt : bisher,
    );
    if (staerke(vonBank.k) > staerke(schwaechste.k)) {
      return {
        typ: 'verschieben',
        von: { bereich: 'bank', platz: vonBank.platz },
        nach: { bereich: 'brett', platz: schwaechste.platz },
      };
    }
  }

  // c) Umstellen: erst der Umzug auf ein freies Feld, dann der Tausch zweier
  //    Einheiten. Beides bewegt nur, was schon steht — die Belegung bleibt.
  for (const { platz, k } of stehen) {
    const jetzt = platzStrafe(k, platz, reihen, spalten);
    for (const frei of freie) {
      if (platzStrafe(k, frei, reihen, spalten) < jetzt) {
        return {
          typ: 'verschieben',
          von: { bereich: 'brett', platz },
          nach: { bereich: 'brett', platz: frei },
        };
      }
    }
  }
  for (const eins of stehen) {
    for (const zwei of stehen) {
      if (zwei.platz <= eins.platz) continue;
      const vorher =
        platzStrafe(eins.k, eins.platz, reihen, spalten) +
        platzStrafe(zwei.k, zwei.platz, reihen, spalten);
      const nachher =
        platzStrafe(eins.k, zwei.platz, reihen, spalten) +
        platzStrafe(zwei.k, eins.platz, reihen, spalten);
      if (nachher < vorher) {
        return {
          typ: 'verschieben',
          von: { bereich: 'brett', platz: eins.platz },
          nach: { bereich: 'brett', platz: zwei.platz },
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 1. KAUFEN NACH WERT
// ---------------------------------------------------------------------------

/**
 * Was eine dritte Kopie wert ist.
 *
 * Die Drei ist geschaetzt, aber nicht gegriffen: Die naechste Sternstufe hebt
 * Leben UND Angriff auf das 1,8-fache (`STUFEN_FAKTOR`), im Produkt der beiden
 * also auf gut das Dreifache. Genau das ist die Staerke, die aus den drei
 * Karten wird.
 */
const VERSCHMELZ_FAKTOR = 3;

/** Und was eine zweite wert ist — der halbe Weg dorthin. */
const PAAR_FAKTOR = 1.5;

/**
 * Was jede schon vertretene Einheit derselben Marke zusaetzlich wert ist.
 *
 * Fuenfundzwanzig gegen eine Einheitenstaerke von 130 (billigste) bis 970
 * (teuerste): Vier Gefaehrten derselben Marke wiegen etwa eine halbe
 * Ein-Gold-Einheit auf. Mehr waere falsch, solange es die Synergie-Boni noch
 * nicht gibt (sie sind eine eigene Aufgabe) — der Bot soll auf die Marken
 * hinspielen, nicht blind sammeln.
 */
const MARKEN_GEWICHT = 25;

interface Kandidat {
  readonly platz: number;
  readonly id: EinheitId;
  /** Vervollstaendigt der Kauf sofort eine Verschmelzung? */
  readonly verschmilzt: boolean;
  readonly wert: number;
}

/**
 * Alle Ladenplaetze, die der Bot kaufen KOENNTE, mit ihrem Wert — der beste
 * zuerst, bei Gleichstand der am weitesten links.
 *
 * Die feste Reihenfolge ist kein Schoenheitsfehler: Derselbe Laden muss
 * denselben Kauf ergeben, sonst haengt die Partie an der Sortierung der
 * Laufzeit (Grundsatz 1).
 */
function kandidaten(sicht: TafelrundeSicht, eigen: EigeneSicht, polster: number): Kandidat[] {
  const eigene = eigeneEinheiten(eigen);
  const marken = markenZaehlung(eigene);
  const bankFrei = eigen.bank.includes(null);
  const noetig = sicht.verschmelzZahl - 1;

  const gefunden: Kandidat[] = [];
  eigen.laden.forEach((id, platz) => {
    if (id === null) return;
    const art = einheit(id);
    if (art.kosten > eigen.gold) return;

    /*
     * Bei voller Bank ist nur der Kauf erlaubt, der sofort verschmilzt (siehe
     * `passeBankAn` in partie.ts). Der Bot ZAEHLT dafuer nur Kopien; die
     * Verschmelzregel baut er nicht nach, die Zahl dazu nimmt er aus der
     * Sicht. Wer hier die Kettenreaktion nachrechnen wollte, haette dieselbe
     * Regel zweimal im Haus — und zwei Fassungen laufen auseinander.
     */
    const kopien = kopienVon(eigene, id);
    const verschmilzt = kopien >= noetig;
    if (!bankFrei && !verschmilzt) return;

    /*
     * Das Polster gilt fuer den Verschmelzungskauf NICHT. Er ist der einzige
     * Kauf, der drei Karten zu einer macht und dabei Bankplatz freiraeumt —
     * ihn wegen zweier Goldstuecke liegen zu lassen waere in jeder Lage
     * falsch.
     */
    if (!verschmilzt && eigen.gold - art.kosten < polster) return;

    let wert = staerke({ id, stufe: 1 });
    if (verschmilzt) wert *= VERSCHMELZ_FAKTOR;
    else if (kopien > 0) wert *= PAAR_FAKTOR;
    for (const marke of art.marken) wert += MARKEN_GEWICHT * (marken.get(marke) ?? 0);

    gefunden.push({ platz, id, verschmilzt, wert });
  });

  return gefunden.sort((a, b) => b.wert - a.wert || a.platz - b.platz);
}

/**
 * Eine Zufallszahl aus der Lage.
 *
 * Die Saat entsteht vollstaendig aus der Sicht: Runde, Sitz, Gold, Level und
 * was in Laden, Bank und Brett liegt. Damit ist der Zug nachrechenbar
 * (dieselbe Lage, derselbe Wurf) und trotzdem nicht in jedem Aufruf derselbe —
 * nach jedem Kauf steht eine andere Lage da.
 *
 * Der `zweck` trennt die Stroeme: Zwei Entscheidungen in derselben Lage sollen
 * nicht dieselbe Zahl bekommen.
 */
function wurf(sicht: TafelrundeSicht, eigen: EigeneSicht, zweck: string): number {
  const zeichen = (k: Kaempfer | null) => (k === null ? '-' : `${k.id}${k.stufe}`);
  const saat = [
    'tafelrunde-bot',
    zweck,
    sicht.runde,
    eigen.sitz,
    eigen.gold,
    eigen.level,
    eigen.laden.map((id) => id ?? '-').join(','),
    eigen.bank.map(zeichen).join(','),
    eigen.brett.map(zeichen).join(','),
  ].join('|');
  return baueZufall(saat)();
}

function kaufZug(
  sicht: TafelrundeSicht,
  eigen: EigeneSicht,
  gangart: Gangart,
): TafelrundeAktion | null {
  const polster = sicht.runde >= POLSTER_AB_RUNDE ? gangart.polster : 0;
  const moeglich = kandidaten(sicht, eigen, polster);
  if (moeglich.length === 0) return null;

  const bester = moeglich[0]!;
  /*
   * Der Verschmelzungskauf ist bei `normal` und `hart` von der Patzerregel
   * ausgenommen: "Wer drei gleiche zusammenbekommt, nimmt sie" ist die Regel,
   * die dieses Spiel ausmacht. Nur der sanfte Gegner darf sie verpassen — und
   * genau daran haengt, dass er schwaecher ist als die anderen beiden.
   */
  if (bester.verschmilzt && gangart.nimmtVerschmelzungImmer) {
    return { typ: 'kaufen', platz: bester.platz };
  }

  /*
   * Gepatzt wird nicht "eine Stufe schlechter", sondern blind: irgendein
   * bezahlbarer Ladenplatz. Der zweitbeste Kauf war messbar kaum schlechter
   * als der beste — drei Gangarten, die sich nur darin unterschieden, lagen
   * ueber 40 Partien gleichauf.
   */
  if (moeglich.length > 1 && wurf(sicht, eigen, 'kauf') < gangart.patzerQuote) {
    const gewaehlt = Math.min(
      moeglich.length - 1,
      Math.floor(wurf(sicht, eigen, 'patzer') * moeglich.length),
    );
    return { typ: 'kaufen', platz: moeglich[gewaehlt]!.platz };
  }
  return { typ: 'kaufen', platz: bester.platz };
}

// ---------------------------------------------------------------------------
// 3. AUFSTIEG BEI VOLLEM BRETT
// ---------------------------------------------------------------------------

/**
 * Aufsteigen, wenn das Brett voll ist und danach noch Gold fuer das neue Feld
 * bleibt.
 *
 * Beide Haelften zaehlen. Ohne "Brett voll" kauft der Bot Feldplaetze, auf
 * denen nichts steht — genau das Bild, das den Anlass zu dieser Arbeit gab.
 * Ohne die Reserve steigt er auf, sobald er es gerade eben kann, und steht mit
 * einem groesseren Brett und leerem Beutel da.
 *
 * Das ist die Regel, nach der `normal` spielt. Die beiden anderen Gangarten
 * weichen in verschiedene Richtungen ab, und zwar gemessen (siehe GANGARTEN):
 * `hart` laesst BEIDE Haelften weg und steigt auf, sobald es geht — Tempo ist
 * in diesem Spiel mehr wert als ein gefuelltes Brett eine Runde frueher.
 * `sanft` haelt sich an die Regel und legt sechs Gold obendrauf, steigt also
 * spaeter auf als beide.
 */
function aufstiegsZug(eigen: EigeneSicht, gangart: Gangart): TafelrundeAktion | null {
  if (eigen.aufstiegKosten === null) return null;
  if (gangart.nurBeiVollemBrett && eigen.belegt < eigen.feldplaetze) return null;
  if (eigen.gold < eigen.aufstiegKosten + gangart.aufstiegsReserve) return null;
  return { typ: 'levelAuf' };
}

// ---------------------------------------------------------------------------
// 4. NEU-WUERFELN NUR BEI FREMDEM LADEN
// ---------------------------------------------------------------------------

/**
 * Was nach dem Wuerfeln noch dasein muss: der Preis der teuersten Einheit.
 *
 * Ein Neu-Wuerfeln, nach dem das Gold fuer keinen Kauf mehr reicht, ist
 * bezahlte Aussicht — der neue Laden geht am Rundenende ohnehin verloren.
 */
const KAUF_RUECKLAGE = 3;

/**
 * Neu wuerfeln, wenn das Brett voll ist und KEIN Ladenplatz zum eigenen Heer
 * passt.
 *
 * "Passt" heisst: verschmilzt, macht ein Paar oder verstaerkt eine schon
 * vertretene Marke. Steht dort nur Fremdes, ist ein neuer Laden mehr wert als
 * die Einheit, die man sonst dafuer bekaeme.
 *
 * DAS VOLLE BRETT IST BEDINGUNG, und zwar aus einem Fehler heraus, den die
 * erste Fassung dieser Regel hatte: Ohne sie wuerfelte der Bot in Runde 2 sein
 * ganzes Gold weg. Zu einem leeren Heer passt naemlich NICHTS — es gibt weder
 * eine Kopie noch eine vertretene Marke —, und die Regel haette genau dann
 * gegriffen, wenn er dringend seine erste Einheit braucht. Solange ein
 * Feldplatz frei ist, ist die schlechteste Einheit besser als der schoenste
 * Laden.
 *
 * Deshalb steht diese Regel auch VOR dem Kauf: Sie greift nur in der Lage, in
 * der ein Kauf ohnehin nur die Bank fuellte, und danach kaeme sie nie zum Zug.
 *
 * Dass der Bot sich nicht festwuerfelt, garantiert das Gold: Jeder Wurf
 * kostet, und in der Vorbereitung kommt keines nach.
 */
function wuerfelZug(
  sicht: TafelrundeSicht,
  eigen: EigeneSicht,
  gangart: Gangart,
): TafelrundeAktion | null {
  if (!gangart.wuerfeltNeu) return null;
  if (eigen.belegt < eigen.feldplaetze) return null;
  if (!eigen.bank.includes(null)) return null;

  const polster = sicht.runde >= POLSTER_AB_RUNDE ? gangart.polster : 0;
  if (eigen.gold - eigen.neuwuerfelnKosten < polster + KAUF_RUECKLAGE) return null;

  const eigene = eigeneEinheiten(eigen);
  const marken = markenZaehlung(eigene);
  const passt = eigen.laden.some((id) => {
    if (id === null) return false;
    if (kopienVon(eigene, id) > 0) return true;
    return einheit(id).marken.some((marke) => (marken.get(marke) ?? 0) > 0);
  });
  if (passt) return null;

  return { typ: 'neuwuerfeln' };
}

// ---------------------------------------------------------------------------
// Der Zug
// ---------------------------------------------------------------------------

/**
 * Der naechste Zug des Bots.
 *
 * Die Reihenfolge der vier Regeln ist Teil der Strategie:
 *
 *   1. Erst das BRETT in Ordnung bringen. Andersherum kaufte der Bot die Bank
 *      voll und stellte erst danach auf — und weil jede Aktion einzeln ueber
 *      die Plattform laeuft, staende sein Brett bis kurz vor dem Kampf leer.
 *      Sieht man ihm zu, soll er wie jemand wirken, der sein Heer aufbaut, und
 *      nicht wie jemand, der hamstert.
 *   2. Dann der AUFSTIEG. Er kommt vor dem Kauf, weil ein Feldplatz mehr wert
 *      ist als eine weitere Einheit auf der Bank — aber eben nur, wenn das
 *      Brett schon voll ist, sonst greift die Regel gar nicht.
 *   3. Dann das NEU-WUERFELN. Auch das steht vor dem Kauf, und dort steht es
 *      begruendet: Nach dem Kauf kaeme es nie zum Zug.
 *   4. Und erst dann KAUFEN — oder bereit melden.
 */
export function botZug(
  sicht: TafelrundeSicht,
  schwierigkeit: Schwierigkeit = 'normal',
): TafelrundeAktion {
  const eigen = sicht.eigenes;
  // Ohne eigenes Heer gibt es nichts zu entscheiden. Bereit zu melden ist die
  // einzige Aktion, die in jeder Lage etwas bewirkt oder wenigstens nicht
  // wirft — und der Adapter faengt den Zuschauerfall ohnehin vorher ab.
  if (!eigen) return { typ: 'bereit' };

  const gangart = GANGARTEN[schwierigkeit];
  return (
    stellungsZug(sicht, eigen) ??
    aufstiegsZug(eigen, gangart) ??
    wuerfelZug(sicht, eigen, gangart) ??
    kaufZug(sicht, eigen, gangart) ?? { typ: 'bereit' }
  );
}
