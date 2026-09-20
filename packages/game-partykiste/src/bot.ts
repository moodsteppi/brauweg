/**
 * Der Bot.
 *
 * Er bekommt ausschliesslich die gefilterte Sicht — dieselbe, die auch ein
 * Mensch auf diesem Sitz saehe. Das ist kein Selbstzweck: Ein Bot, der den
 * Partiezustand saehe, wuesste beim Imposter, wer der Imposter ist, und die
 * Runde waere tot.
 *
 * EINE AUSNAHME, DIE KEINE IST: Beim Quiz schlaegt der Bot die Frage im
 * eigenen Katalog nach — ueber den Fragetext, der ohnehin in der Sicht steht.
 * Das ist kein Blick in den Zustand, sondern Allgemeinwissen aus dem
 * Buchregal, und genau darum geht es in diesem Minispiel. Wie oft er das
 * Gewusste dann auch antwortet, bestimmt die eingestellte Spielstaerke
 * (`quizTrefferquote`) — ein Anfaenger-Bot weiss es und tippt trotzdem daneben.
 *
 * Der Zufall des Bots haengt an der Sicht und an nichts sonst. Er ist damit
 * nachvollziehbar, aber nicht vorhersehbar fuer die Mitspieler: Sie kennen die
 * Sicht des Bots nicht.
 */

import type { BotLevel } from '@brauweg/game-api';

import { QUIZ_FRAGEN } from './inhalte/quiz.js';
import { SCHAETZ_FRAGEN } from './inhalte/schaetzen.js';
import type { PartykisteAktion } from './regeln.js';
import { quizTrefferquote } from './regeln.js';

/** Wie weit ein Bot beim Schaetzen hoechstens danebengreift (Anteil der Antwort). */
function schaetzStreuung(stufe: BotLevel | undefined): number {
  switch (stufe) {
    case 'anfaenger':
      return 0.6;
    case 'experte':
      return 0.15;
    case 'genie':
      return 0.05;
    default:
      return 0.35;
  }
}
import type { PartykisteSicht } from './sicht.js';
import { baueZufall, ganzzahl } from './zufall.js';

/** Sitze, auf die dieser Bot zeigen darf: alle ausser sich selbst und den Weggegangenen. */
function ziele(sicht: PartykisteSicht): number[] {
  const raus = new Set(sicht.ausgestiegen);
  const liste: number[] = [];
  for (let s = 0; s < sicht.sitze; s++) if (s !== sicht.sitz && !raus.has(s)) liste.push(s);
  return liste;
}

/** Ein Zufallsstrom, der nur von der Sicht abhaengt. */
function strom(sicht: PartykisteSicht, zweck: string): () => number {
  return baueZufall(`${sicht.sitz}|${sicht.rundeNr}|${sicht.art}|${zweck}`);
}

/**
 * Die Antwort, die der Bot fuer richtig HAELT — oder -1, wenn die Frage nicht
 * im Katalog steht (kann nach einem Umbau der Kataloge vorkommen; dann raet
 * er, statt zu scheitern).
 */
function gewussteAntwort(frage: string, antworten: readonly string[]): number {
  const eintrag = QUIZ_FRAGEN.find((q) => q.frage === frage);
  if (!eintrag) return -1;
  return antworten.indexOf(eintrag.antworten[eintrag.richtig]!);
}

export function botZug(sicht: PartykisteSicht, stufe?: BotLevel): PartykisteAktion {
  /* Abrechnung: weitertippen, damit die Runde nicht auf einen Bot wartet. */
  if (sicht.phase === 'ergebnis') return { art: 'bereit' };

  switch (sicht.daten.art) {
    case 'imposter': {
      if (sicht.phase === 'sehen') return { art: 'bereit' };
      /*
       * Der Bot stimmt blind ab — er kann gar nicht anders, denn woran ein
       * Imposter auffliegt, ist gesagtes Wort im Raum und steht in keiner
       * Sicht. Auch der Imposter-Bot stimmt mit: Wer sich enthielte, waere
       * jede Runde an der Enthaltung zu erkennen.
       */
      const moeglich = ziele(sicht);
      if (moeglich.length === 0) return { art: 'bereit' };
      return { art: 'stimme', ziel: moeglich[ganzzahl(strom(sicht, 'verdacht'), moeglich.length)]! };
    }
    case 'quiz': {
      const gewusst = gewussteAntwort(sicht.daten.frage, sicht.daten.antworten);
      const zufall = strom(sicht, 'quiz');
      const wuerfel = zufall();
      if (gewusst >= 0 && wuerfel < quizTrefferquote(stufe)) return { art: 'antwort', wahl: gewusst };
      /* Daneben: irgendeine andere Antwort, damit der Fehler nicht auffaellt. */
      const falsche = sicht.daten.antworten.map((_, i) => i).filter((i) => i !== gewusst);
      if (falsche.length === 0) return { art: 'antwort', wahl: 0 };
      return { art: 'antwort', wahl: falsche[ganzzahl(zufall, falsche.length)]! };
    }
    case 'werbinich': {
      /*
       * Ob ein Bot "sich selbst erraet", ist eine Muenze — er hoert die Runde
       * ja nicht. Etwas unter der Haelfte, damit ein Tisch voller Bots das
       * Turnier nicht ueber dieses Minispiel entscheidet.
       */
      return { art: 'geraten', erfolg: strom(sicht, 'raten')() < 0.45 };
    }
    case 'niemals': {
      /* Zwei von fuenf Bots haben es getan. Mehr waere ein trauriger Abend. */
      return { art: 'gestehen', ja: strom(sicht, 'gestehen')() < 0.4 };
    }
    case 'wereher': {
      const moeglich = ziele(sicht);
      if (moeglich.length === 0) return { art: 'bereit' };
      return { art: 'stimme', ziel: moeglich[ganzzahl(strom(sicht, 'wereher'), moeglich.length)]! };
    }
    case 'busfahrer': {
      const daten = sicht.daten;
      const zufall = strom(sicht, `bus-${daten.stufe}`);
      if (daten.stufe === 0) return { art: 'tipp', wahl: zufall() < 0.5 ? 0 : 1 };
      if (daten.stufe === 1) {
        /* Die erste Karte liegt offen — danach richtet sich jeder Mensch auch. */
        const erste = daten.offen[0];
        if (!erste) return { art: 'tipp', wahl: 0 };
        return { art: 'tipp', wahl: erste.rang <= 8 ? 0 : 1 };
      }
      const a = daten.offen[0];
      const b = daten.offen[1];
      if (!a || !b) return { art: 'tipp', wahl: 0 };
      /* Innen nur, wenn die Spanne breiter ist als der Rest des Blatts. */
      const spanne = Math.abs(a.rang - b.rang) - 1;
      return { art: 'tipp', wahl: spanne > 6 ? 0 : 1 };
    }
    case 'schaetzen': {
      /*
       * Wie beim Quiz: Die Antwort steht im eigenen Katalog, gefunden ueber den
       * Fragetext. Die Spielstaerke bestimmt, wie weit der Bot danebengreift —
       * ein Anfaenger um bis zu 60 Prozent, ein Genie um bis zu 5.
       */
      const frage = sicht.daten.frage;
      const bekannt = SCHAETZ_FRAGEN.find((f) => f.frage === frage);
      const zufall = strom(sicht, 'schaetzen');
      if (!bekannt) return { art: 'schaetzung', wert: Math.round(zufall() * 1000) };
      const streuung = schaetzStreuung(stufe);
      const faktor = 1 + (zufall() * 2 - 1) * streuung;
      const wert = bekannt.antwort * faktor;
      /* Ganzzahlig, wenn die Antwort es ist — sonst eine Nachkommastelle. */
      return { art: 'schaetzung', wert: Number.isInteger(bekannt.antwort) ? Math.round(wert) : Math.round(wert * 10) / 10 };
    }
    case 'entweder': {
      return { art: 'seite', wahl: strom(sicht, 'entweder')() < 0.5 ? 0 : 1 };
    }
    case 'wahrheitpflicht': {
      const daten = sicht.daten;
      if (daten.gewaehlt[sicht.sitz] === -1) {
        return { art: 'wahl', pflicht: strom(sicht, 'wp-wahl')() < 0.5 };
      }
      /* Vier von fuenf Bots ziehen durch. Der fuenfte kneift — Bots sind auch nur Menschen. */
      return { art: 'erledigt', ja: strom(sicht, 'wp-erledigt')() < 0.8 };
    }
  }
}
