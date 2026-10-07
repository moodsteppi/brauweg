/**
 * Warten auf das „Weiter" aller — und wer zuletzt tippt.
 *
 * Seit dem 07.10.2026. Drei Stellen der Partykiste warten, bis JEDER getippt
 * hat, und an allen dreien stand bis dahin nur „Noch 2 Leute …": Niemand
 * wusste, auf WEN der Tisch wartet. Jetzt nennt die Sicht die Fehlenden
 * (`weiterFehlen`), und wer als Letzter tippt, trinkt mit 50 % einen Schluck.
 *
 * Die drei Wartepunkte, und nur diese:
 *
 *   - die Abrechnung jeder Runde (`ergebnis`, Knopf „Weiter"),
 *   - das eigene Wort beim Imposter (`sehen`, Knopf „Gesehen"),
 *   - die Regel-Karte (`spiel`, Knopf „Verstanden").
 *
 * NICHT dazu gehoeren die gleichzeitigen Minispiele (Quiz, Schaetzen …):
 * Dort wartet die Runde zwar auch auf alle, aber auf eine ANTWORT — wer da
 * zuletzt antwortet, hat nachgedacht und soll nicht dafuer trinken. Auch die
 * Aufstellung im Team-Abend nicht (dort tippt nur der Oeffner) und nicht das
 * „Los" bei 10 Sekunden (nur der Sprecher).
 *
 * Eine Stelle fuer alle drei, damit die Sonderfaelle nicht dreimal
 * auseinanderlaufen. Sie sind:
 *
 *   1. EIN Wartender: kein Letzter, kein Wurf. Wer allein tippt, ist nicht
 *      „der Letzte", sondern der Einzige — sonst traenke ein Mensch mit drei
 *      Bots jede Abrechnung mit 50 %, weil Bots dort nie tippen (unten).
 *   2. Ausgestiegene fallen sofort aus der Liste (`lebende`). Macht ein
 *      Ausstieg die Liste leer, hat niemand zuletzt GETIPPT — kein Wurf.
 *   3. Bots: In der Abrechnung warten wir nicht auf sie (`wartetNochJemand`
 *      in partie.ts — sie tippen dort nie von selbst), also stehen sie nicht
 *      in der Liste und koennen nicht Letzter sein. Bei „Gesehen" und
 *      „Verstanden" tippen sie wie jeder andere und werden behandelt wie jeder
 *      andere: Sie stehen in der Liste, und tippt einer zuletzt, gilt der Wurf
 *      auch fuer ihn. Gaeste sind fuer das Modul ganz normale Sitze.
 *   4. Zeitablauf: Tippt die Plattform nach der Zugzeit FUER einen Menschen
 *      (der Bot uebernimmt diesen einen Zug), endet das Warten, ohne dass er
 *      gedrueckt hat — kein Wurf. Erkennbar am `vertreten` der Bot-Aktion
 *      (bot.ts); bei einem echten Bot-Sitz zaehlt das Feld nicht, der IST ja
 *      der Spieler. Faelschen kann es ein Geraet zwar — es spart sich damit
 *      hoechstens einen Schluck, der ohnehin nur halb so wahrscheinlich war.
 *
 * Der Wurf haengt wie jeder Zufall dieses Moduls an der Saat (zufall.ts),
 * getrennt je Runde und Phase — also EINMAL je Wartepunkt, auf dem Server,
 * und jeder Bildschirm sieht dasselbe Ergebnis, weil es in der Sicht steht.
 */

import type { PartykistePartie } from './partie.js';
import { SCHLUECKE, type PartykisteAktion } from './regeln.js';
import { baueZufall, rundenSaat } from './zufall.js';

/** Ein laufender Wartepunkt: wer tippen muss und wer es noch nicht hat. */
export interface Wartepunkt {
  /** Alle, auf die gewartet wird — in Sitzreihenfolge. */
  readonly warten: readonly number[];
  /** Davon die, die noch nicht getippt haben. */
  readonly fehlen: readonly number[];
}

/**
 * Was der letzte Wurf ergeben hat — bleibt in der Partie stehen, bis der
 * naechste kommt. `nr` zaehlt hoch, damit ein Bildschirm denselben Wurf nicht
 * zweimal ansagt und zwei gleiche Wuerfe hintereinander trotzdem auseinanderhaelt.
 */
export interface LetzterWurf {
  readonly nr: number;
  /** In welcher Runde (0-basiert) — nur zur Anzeige. */
  readonly rundeNr: number;
  readonly sitz: number;
  readonly trinkt: boolean;
  /** Wie viele, wenn ja; sonst 0. */
  readonly schlucke: number;
}

function lebende(partie: PartykistePartie): number[] {
  const raus = new Set(partie.ausgestiegen);
  const liste: number[] = [];
  for (let s = 0; s < partie.sitze; s++) if (!raus.has(s)) liste.push(s);
  return liste;
}

/** Wartet die Partie gerade auf das „Weiter" aller? Sonst null. */
export function wartepunkt(partie: PartykistePartie): Wartepunkt | null {
  if (partie.fertig || partie.aufstellung) return null;
  const runde = partie.runde;
  let warten: number[];
  if (runde.phase === 'ergebnis') {
    /* Bots tippen in der Abrechnung nicht — siehe Kopf, Punkt 3. */
    const bots = new Set(partie.botSitze);
    warten = lebende(partie).filter((s) => !bots.has(s));
  } else if ((runde.art === 'imposter' && runde.phase === 'sehen') || (runde.art === 'regelkarte' && runde.phase === 'spiel')) {
    warten = lebende(partie);
  } else {
    return null;
  }
  const fertig = new Set(runde.fertig);
  return { warten, fehlen: warten.filter((s) => !fertig.has(s)) };
}

/** Der Zufall des laufenden Wartepunkts: je Runde und Phase einer. */
export function zufallDesWartepunkts(partie: PartykistePartie): () => number {
  return baueZufall(rundenSaat(partie.saat, partie.rundeNr, `letzter|${partie.runde.phase}`));
}

/**
 * `sitz` tippt am Wartepunkt — und ist er der Letzte, wird gewuerfelt.
 *
 * Liefert die Partie mit dem Tipp, aber noch NICHT weitergeschoben: Der
 * Schluck muss gebucht sein, bevor `weiter()` die Abrechnung schliesst und
 * die Runde ins Protokoll schreibt.
 *
 * Gebucht wird in `runde.schlucke`, also in die Abrechnung dieser Runde:
 *
 *   - in der Abrechnung selbst zugleich in den Turnierstand, denn die Runde
 *     ist dort schon ausgewertet;
 *   - bei „Gesehen" und „Verstanden" nur in die Runde — `werteAus` legt
 *     ihn dann zu den Schluecken des Minispiels, und er steht in derselben
 *     Abrechnung. Ein Zwischenstand im Turnier waere ein zweiter Weg, auf dem
 *     Schluecke in die Tabelle kommen, und das Protokoll stimmte nicht mehr.
 *
 * Genau EIN Schluck, nicht `mitSchluck`: Die Ansage sagt „ein Schluck", und
 * mit Haerte 3 wuerde das Warten teurer als manche verlorene Runde.
 *
 * `zufall` ist nur fuer Tests einstellbar.
 */
export function tippeWeiter(
  partie: PartykistePartie,
  sitz: number,
  vertreten: boolean,
  zufall: () => number = zufallDesWartepunkts(partie),
): PartykistePartie {
  const runde = partie.runde;
  const punkt = wartepunkt(partie);
  const getippt: PartykistePartie = { ...partie, runde: { ...runde, fertig: [...runde.fertig, sitz] } };
  if (!punkt) return getippt;
  /* Punkt 1 bis 4 im Kopf. */
  const letzter = punkt.fehlen.length === 1 && punkt.fehlen[0] === sitz;
  if (!letzter || punkt.warten.length < 2) return getippt;
  if (vertreten && !partie.botSitze.includes(sitz)) return getippt;

  const trinkt = zufall() < 0.5;
  const schlucke = trinkt ? SCHLUECKE.letzterBeimWeiter : 0;
  const wurf: LetzterWurf = {
    nr: (partie.letzterWurf?.nr ?? 0) + 1,
    rundeNr: partie.rundeNr,
    sitz,
    trinkt,
    schlucke,
  };
  const dazu = (liste: readonly number[]): number[] => liste.map((n, s) => (s === sitz ? n + schlucke : n));
  return {
    ...getippt,
    letzterWurf: wurf,
    runde: { ...getippt.runde, schlucke: dazu(runde.schlucke) },
    schlucke: runde.phase === 'ergebnis' ? dazu(partie.schlucke) : partie.schlucke,
  };
}

/**
 * Die Aktion ohne die Marke `vertreten` — so, wie sie in `legalActions`
 * steht. Die Marke ist kein anderer Zug, sondern nur die Auskunft, wer
 * getippt hat; wer Bot-Zuege gegen die erlaubten haelt, vergleicht hiermit.
 */
export function ohneVertreten(aktion: PartykisteAktion): PartykisteAktion {
  return aktion.art === 'bereit' ? { art: 'bereit' } : aktion;
}
