/**
 * Der Bot.
 *
 * Er bekommt ausschliesslich die gefilterte Sicht (game-api) und kann deshalb
 * bauartbedingt nicht schummeln — er sieht die Karten des Gegners so wenig
 * wie ein Mensch. Was er daraus macht, ist bewusst eine Faustregel und keine
 * Gleichgewichtsstrategie: Ein Gegner, der nie blufft und nie danebenliegt,
 * ist auf einem Handy kein Spass, sondern eine Wand.
 *
 * Der Ablauf ist immer derselbe:
 *
 *   1. Wie stark ist meine Hand, ausgedrueckt als Zahl zwischen 0 und 1?
 *   2. Was kostet das Mitgehen im Verhaeltnis zum Topf (die Pot Odds)?
 *   3. Erhoehen, mitgehen, schieben oder passen — mit etwas Zufall, damit er
 *      nicht ablesbar wird.
 *
 * `Math.random` ist hier erlaubt und im uebrigen Modul verboten: Der Bot ist
 * keine Regel. Sein Zug wandert als gewoehnliche Aktion in die Zugliste, die
 * Partie bleibt also aus Saat und Zuegen reproduzierbar.
 */

import type { BotLevel } from '@brauweg/game-api';

import { KATEGORIE, type Karte, rang } from './karten.js';
import type { EasyPokerAktion } from './partie.js';
import type { EasyPokerSicht } from './sicht.js';

// ---------------------------------------------------------------------------
// Handstaerke
// ---------------------------------------------------------------------------

/**
 * Staerke zweier Startkarten nach der Chen-Formel, auf 0..1 gestreckt.
 *
 * Die Formel ist alt, kurz und fuer diesen Zweck genau richtig: Sie kennt
 * Paare, gleiche Farbe, Luecke und Strassenpotenzial und braucht dafuer keine
 * Tabelle mit 169 Eintraegen, die niemand pruefen koennte.
 */
function startStaerke(karten: readonly Karte[]): number {
  const [a, b] = karten;
  if (!a || !b) return 0;

  const hoch = Math.max(rang(a.wert), rang(b.wert));
  const tief = Math.min(rang(a.wert), rang(b.wert));

  const grundwert = (r: number): number => {
    if (r === 14) return 10;
    if (r === 13) return 8;
    if (r === 12) return 7;
    if (r === 11) return 6;
    return r / 2;
  };

  let punkte = grundwert(hoch);
  if (hoch === tief) punkte = Math.max(punkte * 2, 5);
  if (a.farbe === b.farbe) punkte += 2;

  const luecke = hoch - tief - 1;
  if (hoch !== tief) {
    if (luecke === 1) punkte -= 1;
    else if (luecke === 2) punkte -= 2;
    else if (luecke === 3) punkte -= 4;
    else if (luecke >= 4) punkte -= 5;
    // Zwei niedrige, dicht beieinanderliegende Karten bauen Strassen.
    if (luecke <= 1 && hoch < 12) punkte += 1;
  }

  const gerundet = Math.ceil(punkte);
  return Math.max(0, Math.min(1, (gerundet + 1) / 21));
}

/** Vier Karten einer Farbe und noch eine Brettkarte zu kommen. */
function hatFarbZug(alle: readonly Karte[], brettLaenge: number): boolean {
  if (brettLaenge >= 5) return false;
  const zaehler = new Map<string, number>();
  for (const karte of alle) zaehler.set(karte.farbe, (zaehler.get(karte.farbe) ?? 0) + 1);
  return [...zaehler.values()].some((anzahl) => anzahl === 4);
}

/** Vier aufeinanderfolgende Werte — der Zug auf eine Strasse. */
function hatStrassenZug(alle: readonly Karte[], brettLaenge: number): boolean {
  if (brettLaenge >= 5) return false;
  const raenge = new Set(alle.map((karte) => rang(karte.wert)));
  if (raenge.has(14)) raenge.add(1);
  for (const start of raenge) {
    let laenge = 0;
    for (let i = 0; i < 4; i++) if (raenge.has(start - i)) laenge++;
    if (laenge === 4) return true;
  }
  return false;
}

/**
 * Staerke nach dem Flop.
 *
 * Zwei Dinge braucht diese Zahl ueber die Kategorie hinaus, und beide sind
 * die Stellen, an denen ein naiver Bot Jetons verschenkt:
 *
 *   1. **Spiele ich das Brett?** Besteht die beste Kombination nur aus
 *      Brettkarten, hat der Gegner exakt dieselbe — Vierling hin oder her,
 *      besser als geteilt wird es nicht.
 *   2. **Ist es ein Spitzenpaar?** Ein Paar Zweien auf einem Brett mit Ass
 *      ist etwas ganz anderes als ein Paar Asse, steht aber in derselben
 *      Kategorie.
 */
function brettStaerke(sicht: EasyPokerSicht): number {
  const staerke = sicht.meineStaerke;
  if (!staerke) return 0;

  const eigeneIds = new Set(sicht.meineKarten.map((karte) => karte.id));
  const eigeneImSpiel = staerke.karten.filter((karte) => eigeneIds.has(karte.id)).length;
  const brettRaenge = sicht.brett.map((karte) => rang(karte.wert));
  const hoechsteBrettkarte = brettRaenge.length > 0 ? Math.max(...brettRaenge) : 0;

  let wert: number;
  switch (staerke.kategorie) {
    case KATEGORIE.strassenFlush:
      wert = 1;
      break;
    case KATEGORIE.vierling:
      wert = 0.98;
      break;
    case KATEGORIE.fullHouse:
      wert = 0.95;
      break;
    case KATEGORIE.flush:
      wert = 0.9;
      break;
    case KATEGORIE.strasse:
      wert = 0.85;
      break;
    case KATEGORIE.drilling:
      wert = 0.78;
      break;
    case KATEGORIE.zweiPaare:
      wert = 0.62;
      break;
    case KATEGORIE.paar: {
      const paarRang = staerke.werte[0] ?? 0;
      if (paarRang >= hoechsteBrettkarte) wert = 0.5;
      else wert = 0.32;
      break;
    }
    default: {
      // Nur eine hohe Karte. Ass oder Koenig lassen sich noch verbessern,
      // alles darunter ist auf dem Weg zum Passen.
      const hoechsteEigene = Math.max(...sicht.meineKarten.map((karte) => rang(karte.wert)), 0);
      wert = hoechsteEigene >= 13 ? 0.2 : 0.1;
    }
  }

  // Das Brett gehoert beiden. Wer nichts Eigenes beisteuert, kann bestenfalls
  // teilen — und setzt trotzdem oft, wenn ihm das niemand sagt.
  if (eigeneImSpiel === 0) wert = Math.min(wert, 0.22);

  const alle = [...sicht.meineKarten, ...sicht.brett];
  if (hatFarbZug(alle, sicht.brett.length)) wert = Math.max(wert, 0.55);
  else if (hatStrassenZug(alle, sicht.brett.length)) wert = Math.max(wert, 0.48);

  return Math.max(0, Math.min(1, wert));
}

function staerkeVon(sicht: EasyPokerSicht): number {
  if (sicht.strasse === 'preflop') return startStaerke(sicht.meineKarten);
  return brettStaerke(sicht);
}

// ---------------------------------------------------------------------------
// Entscheidung
// ---------------------------------------------------------------------------

/**
 * Spielstaerke als drei Stellschrauben.
 *
 * `mut` verschiebt die Grenze zum Erhoehen, `bluff` die Haeufigkeit von
 * Setzen ohne Hand, `geduld` die Grenze zum Passen. Ein Anfaenger geht zu oft
 * mit und blufft zu selten — genau das, was einen Anfaenger ausmacht.
 */
function stellschrauben(level: BotLevel | undefined): {
  mut: number;
  bluff: number;
  geduld: number;
} {
  switch (level) {
    case 'anfaenger':
      return { mut: 0.9, bluff: 0.03, geduld: -0.12 };
    case 'experte':
      return { mut: 0.74, bluff: 0.14, geduld: 0.06 };
    case 'genie':
      return { mut: 0.68, bluff: 0.2, geduld: 0.1 };
    default:
      return { mut: 0.8, bluff: 0.09, geduld: 0 };
  }
}

export function botZug(sicht: EasyPokerSicht, level?: BotLevel): EasyPokerAktion {
  const { mut, bluff, geduld } = stellschrauben(level);
  const staerke = staerkeVon(sicht);
  const wuerfel = Math.random();

  const kannSetzen = sicht.setzKosten !== null;
  const mussZahlen = sicht.zuZahlen > 0;

  // Erhoehen, wenn die Hand es traegt — und ab und zu, wenn nicht. Ohne den
  // zweiten Fall waere jedes Setzen des Bots eine Ansage, die man mitlesen
  // kann.
  if (kannSetzen && (staerke >= mut ? wuerfel < 0.8 : wuerfel < bluff)) {
    return { typ: 'setzen', betrag: sicht.setzKosten! };
  }

  if (!mussZahlen) return { typ: 'schieben' };

  /*
   * Pot Odds: Was das Mitgehen kostet, gemessen am Topf, den man gewinnen
   * kann. Wer 10 in einen Topf von 40 zahlt, braucht in einem Fuenftel der
   * Faelle die bessere Hand — mehr sagt die Zahl nicht, und mehr braucht ein
   * Bot dieser Groesse auch nicht.
   */
  const odds = sicht.zuZahlen / (sicht.topf + sicht.zuZahlen);

  // Ein All-in kostet alles. Dafuer reicht keine Hand, die nur knapp vor den
  // Pot Odds liegt.
  const eigeneJetons = sicht.dran === null ? 0 : (sicht.jetons[sicht.dran] ?? 0);
  const allIn = sicht.zuZahlen >= eigeneJetons && eigeneJetons > 0;
  const schwelle = odds + (allIn ? 0.2 : 0.05) - geduld;

  if (staerke >= schwelle) return { typ: 'mitgehen', betrag: sicht.zuZahlen };
  // Knapp darunter gelegentlich trotzdem mitgehen: Ein Bot, der jede
  // Grenzhand passt, ist mit zwei Bluffs auszurechnen.
  if (staerke >= schwelle - 0.12 && wuerfel < 0.3) {
    return { typ: 'mitgehen', betrag: sicht.zuZahlen };
  }

  return { typ: 'passen' };
}
