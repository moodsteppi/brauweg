import type { Bestenliste, EigeneBestleistung } from '../../api';

/**
 * Bahnrekord und eigenes Bestes je Golf-Bahn — die Rechnung hinter der Zeile
 * im Zwischenstand („Bahnrekord: 3 (Anna) · dein Bestes: 4").
 *
 * Seit dem 22.09.2026. Die Zahlen schreibt der Server am Partieende
 * (`packages/game-golf/src/bestleistung.ts` meldet sie, `docs/BESTLEISTUNG.md`
 * beschreibt den Weg); gelesen werden sie ueber die vorhandene Route
 * `api.bestenliste('golf', <Bahnkennung>)`. Hier wird nichts sortiert und
 * kein Rang gerechnet: Die Liste kommt fertig vom Server, ihr erster Eintrag
 * IST der Rekord.
 *
 * Reine Funktionen plus ein kleiner Speicher, ohne React — damit die Regeln
 * („wann ist es neu?") ohne Bildschirm pruefbar sind.
 */

export interface Bahnrekordstand {
  /** Der Rekord der Bahn, oder null, solange niemand eine Zahl hat. */
  readonly rekord: { readonly wert: number; readonly name: string; readonly du: boolean } | null;
  /** Das eigene Beste auf dieser Bahn, oder null, solange man keins hat. */
  readonly eigenes: number | null;
}

/** Aus der Serverliste nur das, was die Zeile zeigt. */
export function standAus(liste: Bestenliste): Bahnrekordstand {
  const erster = liste.eintraege[0];
  return {
    rekord: erster ? { wert: erster.wert, name: erster.displayName, du: erster.du } : null,
    eigenes: liste.eigene?.wert ?? null,
  };
}

export interface Neuigkeit {
  /** Besser als jeder bisher auf dieser Bahn — oder der erste ueberhaupt. */
  readonly bahnrekord: boolean;
  /** Besser als das eigene Beste — oder das erste eigene. */
  readonly eigenesBestes: boolean;
}

const NICHTS_NEUES: Neuigkeit = { bahnrekord: false, eigenesBestes: false };

/**
 * Ist das eben gespielte Loch neu — Bahnrekord, eigenes Bestes, beides?
 *
 * Nur wenn der Ball wirklich gefallen ist (`schlaege` ist dann die echte
 * Zahl, sonst null): Ein nicht eingelochtes Loch zaehlt als Schlaglimit + 1
 * und ist nie ein Rekord, auch nicht der erste auf einer frischen Bahn. Und
 * nur, wenn der Tisch zaehlt (`zaehlt`: kein Gast am Tisch) — ein Rekord, den
 * der Server gleich darauf nicht eintraegt, darf nicht aufleuchten.
 *
 * „Besser" heisst bei Golf: kleiner. Gleichstand ist nicht neu, genau wie
 * im Server (`trageBestleistungEin` ueberschreibt nur mit einer besseren Zahl).
 */
export function neuigkeit(
  stand: Bahnrekordstand | null,
  schlaege: number | null,
  zaehlt: boolean,
): Neuigkeit {
  if (stand === null || schlaege === null || schlaege < 1 || !zaehlt) return NICHTS_NEUES;
  return {
    bahnrekord: stand.rekord === null || schlaege < stand.rekord.wert,
    eigenesBestes: stand.eigenes === null || schlaege < stand.eigenes,
  };
}

/**
 * Holt je Bahn EINMAL und behaelt die Antwort — die Zusage „nicht je Loch
 * neu".
 *
 * Auch der Fehlschlag wird behalten (als null): Ein Server, der die Liste
 * gerade nicht liefert, bekommt nicht bei jedem Neuzeichnen der Tafel eine
 * neue Anfrage. Ein Speicher lebt eine Partie lang (siehe `useBahnrekord`),
 * danach ist er weg — die naechste Partie sieht dann auch die Zahlen, die
 * diese hier eingetragen hat.
 */
export class Bahnrekordspeicher {
  private readonly anfragen = new Map<string, Promise<Bahnrekordstand | null>>();
  private readonly fertig = new Map<string, Bahnrekordstand | null>();

  private readonly lade: (bahnId: string) => Promise<Bestenliste>;

  constructor(lade: (bahnId: string) => Promise<Bestenliste>) {
    this.lade = lade;
  }

  /** Schon da? `undefined` heisst: noch nicht angefragt oder noch unterwegs. */
  vorhanden(bahnId: string): Bahnrekordstand | null | undefined {
    return this.fertig.get(bahnId);
  }

  hole(bahnId: string): Promise<Bahnrekordstand | null> {
    const laufend = this.anfragen.get(bahnId);
    if (laufend) return laufend;
    // Ueber ein Versprechen gestartet, damit auch ein SOFORT werfender Lader
    // (kein Netz, Attrappe im Test) als null endet statt im Effekt zu werfen.
    const anfrage = Promise.resolve()
      .then(() => this.lade(bahnId))
      .then(standAus)
      .catch(() => null)
      .then((stand) => {
        this.fertig.set(bahnId, stand);
        return stand;
      });
    this.anfragen.set(bahnId, anfrage);
    return anfrage;
  }
}

/**
 * Die eigenen Bestmarken je Bahn, fuer die Kacheln der Einzelauswahl in der
 * Bahnauswahl. Aus `api.eigeneBestleistungen('golf')` — EIN Aufruf fuer alle
 * Bahnen statt einer Liste je Kachel. Nur `tief` zaehlt: Golf meldet nichts
 * anderes, und eine Zeile mit fremder Richtung waere keine Schlagzahl.
 */
export function bestmarkenJeBahn(
  eigene: readonly EigeneBestleistung[],
): ReadonlyMap<string, number> {
  const marken = new Map<string, number>();
  for (const e of eigene) if (e.richtung === 'tief') marken.set(e.inhaltId, e.wert);
  return marken;
}
