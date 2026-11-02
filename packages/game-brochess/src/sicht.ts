/**
 * Was ein Sitz von der Partie sieht.
 *
 * Beim Schach ist das alles: Es gibt nichts Verdecktes, Spieler und
 * Zuschauer sehen dasselbe Brett. Die Trennung von `sichtFuer` und
 * `zuschauerSicht` bleibt trotzdem, weil nur der Sitz eine eigene Farbe hat
 * — und weil der Bot laut game-api nie auf einer Zuschauersicht laufen
 * darf.
 *
 * Seit dem 02.11.2026 gibt es doch etwas Verdecktes: die geheime Dame im
 * Modus 'secretDame'. Welche Figur es ist, steht nur in der Sicht ihres
 * Besitzers (`secretDame.meine`); Gegner und Zuschauer erfahren es erst, wenn
 * sie aufgedeckt oder verdeckt geschlagen wird. Dafuer gilt: Kein Feld der
 * Sicht darf sich mit der Wahl aendern — auch nicht `schach` (unter Regel A
 * zaehlt die verdeckte Dame nicht), nicht `verlauf` (kein „+" durch sie) und
 * nicht `vorab` des Gegners. Ein Test haelt das fest, indem er die
 * Gegnersicht zweier Partien vergleicht, die sich nur in der Wahl
 * unterscheiden.
 *
 * Die Wiederholungszaehlung geht NICHT mit: Sie ist Buchhaltung des Servers,
 * und der Bildschirm braucht sie fuer nichts, was er zeigt.
 */

import { type Farbe, feldName, materialStand, vorabZiele, zuFen } from './brett.js';
import { type GeheimEreignis, type GeheimeDame, type GeheimZustand, wahlFertig } from './geheim.js';
import { type BroChessPartie, type Ende, farbeVonSitz, schachInPartie } from './partie.js';
import { type SchachDurchVerdeckte, zeitkontrolle } from './regeln.js';

/** Eine geheime Dame, soweit der Betrachter sie kennen darf. */
export interface GeheimeDameSicht {
  readonly zustand: GeheimZustand;
  /** Aktuelles Feld, null wenn sie nicht mehr auf dem Brett steht. */
  readonly feld: string | null;
  /** Grundfigur in Kleinbuchstaben ('p', 'n', 'b', 'r', 'q'). */
  readonly grundfigur: string;
}

/** Was die Sicht vom Modus 'secretDame' zeigt; null im normalen Modus. */
export interface SecretDameSicht {
  readonly regel: SchachDurchVerdeckte;
  /** Laeuft noch die Wahl? Dann bietet `legalActions` Wahl-Aktionen statt Zuegen an. */
  readonly wahlLaeuft: boolean;
  /** Wer schon gewaehlt hat — ob, nicht was. */
  readonly gewaehlt: { readonly w: boolean; readonly b: boolean };
  /** Die eigene geheime Dame; null vor der eigenen Wahl und fuer Zuschauer. */
  readonly meine: GeheimeDameSicht | null;
  /**
   * Geheime Damen, die der Gegner kennt (aufgedeckt oder verdeckt
   * geschlagen), je Farbe; sonst null. Die eigene steht hier auch, sobald
   * der Gegner sie kennt.
   */
  readonly bekannt: { readonly w: GeheimeDameSicht | null; readonly b: GeheimeDameSicht | null };
  /** Ereignisse, soweit der Betrachter sie sehen darf, in Reihenfolge. */
  readonly ereignisse: readonly GeheimEreignis[];
}

export interface BroChessSicht {
  readonly zuschauer: boolean;
  /**
   * Die Stellung als FEN. Der Bildschirm liest `brett`; die FEN ist fuer den
   * Bot da, der laut game-api nur die Sicht bekommt und daraus seine
   * Zuege rechnen muss.
   */
  readonly fen: string;
  /** 64 Felder, a1 zuerst, Figuren in FEN-Schreibweise, '' ist leer. */
  readonly brett: readonly string[];
  readonly amZug: Farbe;
  /** Eigene Farbe, null fuer Zuschauer. */
  readonly meineFarbe: Farbe | null;
  readonly weissSitz: number;
  /** Steht die Seite am Zug im Schach? Auch bei Matt wahr. */
  readonly schach: boolean;
  readonly letzterZug: { readonly von: string; readonly nach: string } | null;
  readonly ende: Ende | null;
  /** Gespielte Zuege in Kurzschrift (SAN), ab dem ersten. */
  readonly verlauf: readonly string[];
  /**
   * Schachuhr oder null. `restMs` je Sitz steht auf dem Stand vor dem
   * laufenden Zug; fuer den Sitz am Zug zaehlt der Bildschirm von
   * `turnDeadline` herunter (die Plattform setzt sie aufs Ende seines Kontos).
   */
  readonly uhr: {
    readonly restMs: readonly number[];
    readonly bedenkzeitMs: number;
    readonly zuschlagMs: number;
  } | null;
  /** Vom Brett genommene Figuren je Farbe (Kleinbuchstaben, staerkste zuerst). */
  readonly geschlagen: { readonly w: readonly string[]; readonly b: readonly string[] };
  /** Materialvorsprung von Weiss; negativ, wenn Schwarz vorn liegt. */
  readonly vorsprung: number;
  /**
   * Ziele fuer einen Vorab-Zug (Premove), Feld → Felder. Nur fuer den Sitz,
   * der gerade NICHT am Zug ist; sonst leer. Die Gangart rechnet das Modul
   * (vorabZiele in brett.ts), ob der Zug dann geht, sagt `legalActions`.
   */
  readonly vorab: Readonly<Record<string, readonly string[]>>;
  /** Modus 'secretDame', sonst null. */
  readonly secretDame: SecretDameSicht | null;
}

function dameSicht(dame: GeheimeDame): GeheimeDameSicht | null {
  if (dame.grundfigur === null) return null;
  return {
    zustand: dame.zustand,
    feld: dame.feld === null ? null : feldName(dame.feld),
    grundfigur: dame.grundfigur,
  };
}

function secretDameSicht(partie: BroChessPartie, meineFarbe: Farbe | null): SecretDameSicht | null {
  const stand = partie.secretDame;
  if (!stand) return null;
  return {
    regel: stand.regel,
    wahlLaeuft: !wahlFertig(stand),
    gewaehlt: { w: stand.w.zustand !== 'offen', b: stand.b.zustand !== 'offen' },
    meine: meineFarbe === null ? null : dameSicht(stand[meineFarbe]),
    bekannt: {
      w: stand.w.bekannt ? dameSicht(stand.w) : null,
      b: stand.b.bekannt ? dameSicht(stand.b) : null,
    },
    // Eine verdeckt umgewandelte Dame sieht nur ihr Besitzer.
    ereignisse: stand.ereignisse.filter(
      (e) => !(e.art === 'umgewandelt' && e.verdeckt && e.farbe !== meineFarbe),
    ),
  };
}

/**
 * Vorab-Ziele; fuer die eigene geheime Dame kommen die Damenziele dazu.
 * Gerechnet wird das wie in `vorabZiele` auf der Gangart — fuer die geheime
 * Figur einmal als sie selbst und einmal als Dame.
 */
function vorabMitDame(partie: BroChessPartie, farbe: Farbe): Record<string, string[]> {
  const ziele = vorabZiele(partie.stellung, farbe);
  const dame = partie.secretDame?.[farbe];
  if (!dame || dame.feld === null || (dame.zustand !== 'verdeckt' && dame.zustand !== 'aufgedeckt')) {
    return ziele;
  }
  const brett = [...partie.stellung.brett];
  brett[dame.feld] = farbe === 'w' ? 'Q' : 'q';
  const name = feldName(dame.feld);
  const alsDame = vorabZiele({ ...partie.stellung, brett }, farbe)[name] ?? [];
  const alle = new Set([...(ziele[name] ?? []), ...alsDame]);
  if (alle.size > 0) ziele[name] = [...alle];
  return ziele;
}

function sicht(partie: BroChessPartie, meineFarbe: Farbe | null): BroChessSicht {
  return {
    zuschauer: meineFarbe === null,
    fen: zuFen(partie.stellung),
    brett: partie.stellung.brett,
    amZug: partie.stellung.amZug,
    meineFarbe,
    weissSitz: partie.weissSitz,
    schach: schachInPartie(partie),
    letzterZug: partie.letzterZug,
    ende: partie.ende,
    verlauf: partie.verlauf,
    uhr: (() => {
      const kontrolle = zeitkontrolle(partie.regeln);
      return partie.uhr && kontrolle ? { restMs: partie.uhr.restMs, ...kontrolle } : null;
    })(),
    ...materialStand(partie.stellung.brett),
    vorab:
      meineFarbe !== null && partie.ende === null && partie.stellung.amZug !== meineFarbe
        ? vorabMitDame(partie, meineFarbe)
        : {},
    secretDame: secretDameSicht(partie, meineFarbe),
  };
}

export function sichtFuer(partie: BroChessPartie, sitz: number): BroChessSicht {
  return sicht(partie, farbeVonSitz(partie, sitz));
}

export function zuschauerSicht(partie: BroChessPartie): BroChessSicht {
  return sicht(partie, null);
}
