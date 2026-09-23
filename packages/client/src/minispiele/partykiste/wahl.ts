/**
 * Die Auswahl im Menue der Partykiste: Minispiele, Inhaltsstufe, Themenpaket,
 * Modus — was sie speichert und wie daraus der Regelsatz wird.
 *
 * Anlass (22.09.2026): Das Menue zeigte die Minispiele nur als Liste, waehlbar
 * war nichts, obwohl der Regelsatz `minispiele` seit dem ersten Tag kann. Bei
 * sechs Runden kamen deshalb immer die ersten sechs der Liste — Wahrheit oder
 * Pflicht sah man erst ab Runde neun. Dazu kamen am selben Tag `inhaltsHaerte`
 * und `paket` ins Modul, die der Bildschirm noch nicht schicken konnte.
 *
 * Diese Datei ist ohne React, damit Test und Vertrag sie lesen koennen, ohne
 * einen Bildschirm aufzubauen. Die Kacheln stehen in `Auswahl.tsx`.
 *
 * WOHER DIE LISTEN KOMMEN — und warum nicht alle von derselben Stelle:
 *
 * - Die Minispiele kommen aus dem Regelsatz des MODULS (`defaultConfig()`,
 *   vom Server ueber `useSpielVorgabe`), nicht aus einer Abschrift. Die
 *   Vorgabe traegt alle Minispiele in Modulreihenfolge; kommt dort eines
 *   dazu, steht es ohne Aenderung hier als Kachel im Menue.
 * - Die Themenpakete und Modi kennt der Client nur als Namen
 *   (`PAKET_NAME`, `MODUS_NAME`): Die Vorgabe sagt `paket: null`, nicht,
 *   welche es gibt. Beide sind Spiegelbilder, und der Vertrag
 *   (`vertrag/partykiste-auswahl.test.ts`) haelt sie gegen das Modul.
 */

import { MINISPIEL_NAME, type PartyMinispiel } from './sicht';

// ---------------------------------------------------------------------------
// Anzeigenamen
// ---------------------------------------------------------------------------

/**
 * Wie ein Minispiel ablaeuft: alle zugleich oder einer nach dem anderen.
 *
 * Spiegelbild von `istReihum` in packages/game-partykiste/src/partie.ts,
 * geprueft im Vertrag. `Partial`, weil parallel neue Minispiele entstehen:
 * Fehlt eines hier, zeigt die Kachel den Ablauf eben nicht an — ein fehlender
 * Eintrag darf den Bau nicht brechen, ein FALSCHER faellt im Vertrag auf.
 */
export const MINISPIEL_ABLAUF: Partial<Record<PartyMinispiel, 'gleichzeitig' | 'reihum'>> = {
  imposter: 'gleichzeitig',
  quiz: 'gleichzeitig',
  werbinich: 'reihum',
  niemals: 'gleichzeitig',
  wereher: 'gleichzeitig',
  busfahrer: 'reihum',
  schaetzen: 'gleichzeitig',
  entweder: 'gleichzeitig',
  wahrheitpflicht: 'reihum',
};

/**
 * Ein Zeichen je Minispiel fuer die Kachel. Kein Bild: Fuer die Kiste gibt es
 * noch keine Grafik, und ein `<img>` auf eine Datei, die es nicht gibt, sieht
 * nach Fehler aus (CLAUDE.md). Fehlt ein Zeichen, steht der Anfangsbuchstabe.
 */
export const MINISPIEL_ZEICHEN: Partial<Record<PartyMinispiel, string>> = {
  imposter: '🕵️',
  quiz: '❓',
  werbinich: '🎭',
  niemals: '🙊',
  wereher: '👉',
  busfahrer: '🚌',
  schaetzen: '🎯',
  entweder: '⚖️',
  wahrheitpflicht: '🎲',
};

/** Name eines Minispiels — auch fuer eines, das der Client noch nicht beschreibt. */
export function minispielName(id: string): string {
  return (MINISPIEL_NAME as Record<string, string>)[id] ?? id;
}

/**
 * Die Inhaltsstufe (`inhaltsHaerte`). Heisst im Bildschirm absichtlich NICHT
 * „Härte“: Der Regler fuer `schluckFaktor` steht direkt darueber schon so
 * da, und zwei Regler mit demselben Namen — einer fuer Glaeser, einer fuer
 * Texte — stellt niemand richtig ein (regeln.ts, Entscheidung vom 22.09.2026).
 */
export const INHALT_TITEL = 'Inhalte';
export const INHALT_STUFEN = [
  { stufe: 1, titel: 'harmlos', text: 'Geht an jedem Tisch.' },
  { stufe: 2, titel: 'pikant', text: 'Kneipenniveau, mal anzüglich.' },
  { stufe: 3, titel: 'derb', text: 'Nur unter Erwachsenen.' },
] as const;

/** Warum „derb“ fuer einen Gast gesperrt ist — steht als Grund in der Kachel. */
export const DERB_GRUND_GAST = 'nur mit Konto';

/**
 * Die Themenpakete — Spiegelbild von `PAKETE` (inhalte/typen.ts). Die
 * Reihenfolge ist die des Moduls, die Kennungen aendern sich dort nie.
 */
export const PAKET_NAME: Record<string, string> = {
  'wg-abend': 'WG-Abend',
  jga: 'JGA',
  weihnachten: 'Weihnachten',
  studenten: 'Studenten',
  arbeit: 'Arbeit',
};

/** Die Kachel fuer `paket: null`. Keine Paketkennung — `PAKETE` kennt sie nicht. */
export const PAKET_ALLES = 'alles';

/**
 * Die Spielmodi — seit #211 kennt das Modul sie (`SPIELMODI`, `modi.ts`), und
 * `defaultConfig()` traegt `modus: 'turnier'`, also stehen die Kacheln im
 * Menue (`modusBekannt`). Der Vertrag (vertrag/partykiste-auswahl.test.ts)
 * haelt diese Liste gegen `SPIELMODI` und `validateConfig`.
 */
export const MODI = [
  { kennung: 'turnier', titel: 'Turnier', text: 'Jeder für sich, die Tabelle entscheidet.' },
  { kennung: 'eskalation', titel: 'Eskalation', text: 'Wird von Drittel zu Drittel schärfer.' },
  { kennung: 'themenabend', titel: 'Themenabend', text: 'Ein Themenpaket bestimmt den Abend.' },
  { kennung: 'team', titel: 'Team', text: 'Zwei Lager, gezählt wird fürs Lager.' },
] as const;

// ---------------------------------------------------------------------------
// Gemerkt im Browser
// ---------------------------------------------------------------------------

export const SCHLUESSEL_MINISPIELE = 'partykiste.minispiele';
export const SCHLUESSEL_INHALT = 'partykiste.inhaltsHaerte';
export const SCHLUESSEL_PAKET = 'partykiste.paket';
export const SCHLUESSEL_MODUS = 'partykiste.modus';

/**
 * Was der Nutzer selbst gewaehlt hat. `null` heisst jeweils: nie angefasst,
 * es gilt die Vorgabe des Moduls — und die wird dann auch nicht mitgeschickt,
 * sondern kommt aus `defaultConfig()`. So bekommt, wer nie waehlt, ein neu
 * hinzugekommenes Minispiel von selbst dazu.
 */
export interface PartyWahl {
  minispiele: string[] | null;
  inhaltsHaerte: number | null;
  /** Eine Paketkennung oder `PAKET_ALLES`. */
  paket: string | null;
  modus: string | null;
}

export const KEINE_WAHL: PartyWahl = { minispiele: null, inhaltsHaerte: null, paket: null, modus: null };

function lies(schluessel: string): string | null {
  try {
    return localStorage.getItem(schluessel);
  } catch {
    return null;
  }
}

function schreib(schluessel: string, wert: string | null): void {
  try {
    if (wert === null) localStorage.removeItem(schluessel);
    else localStorage.setItem(schluessel, wert);
  } catch {
    /* Privates Fenster. Die Wahl gilt trotzdem — nur eben nicht morgen. */
  }
}

/** Die gemerkte Wahl. Was sich nicht lesen laesst, zaehlt als nie gewaehlt. */
export function gemerkteWahl(): PartyWahl {
  let minispiele: string[] | null = null;
  try {
    const roh: unknown = JSON.parse(lies(SCHLUESSEL_MINISPIELE) ?? 'null');
    if (Array.isArray(roh) && roh.every((x) => typeof x === 'string') && roh.length > 0) minispiele = roh;
  } catch {
    minispiele = null;
  }
  const stufe = Number(lies(SCHLUESSEL_INHALT));
  return {
    minispiele,
    inhaltsHaerte: stufe === 1 || stufe === 2 || stufe === 3 ? stufe : null,
    paket: lies(SCHLUESSEL_PAKET),
    modus: lies(SCHLUESSEL_MODUS),
  };
}

export function merkeWahl(wahl: PartyWahl): void {
  schreib(SCHLUESSEL_MINISPIELE, wahl.minispiele ? JSON.stringify(wahl.minispiele) : null);
  schreib(SCHLUESSEL_INHALT, wahl.inhaltsHaerte === null ? null : String(wahl.inhaltsHaerte));
  schreib(SCHLUESSEL_PAKET, wahl.paket);
  schreib(SCHLUESSEL_MODUS, wahl.modus);
}

// ---------------------------------------------------------------------------
// Aus Vorgabe und Wahl wird, was angezeigt und geschickt wird
// ---------------------------------------------------------------------------

/**
 * Mindestens drei Minispiele. Das Modul nimmt auch eines (`validateConfig`
 * verlangt nur „nicht leer“) — die Grenze ist eine des Menues: Mit einem
 * oder zweien laeuft der Abend auf „dreimal Quiz hintereinander“ hinaus, und
 * genau das soll die berechnete Reihenfolge verhindern (PARTYKISTE.md).
 */
export const MINDESTENS_MINISPIELE = 3;

/** Alle Minispiele, die das Modul kennt, in seiner Reihenfolge — oder `null`, solange die Vorgabe fehlt. */
export function alleMinispiele(vorgabe: Record<string, unknown> | null): string[] | null {
  const liste = vorgabe?.['minispiele'];
  if (!Array.isArray(liste)) return null;
  return liste.filter((x): x is string => typeof x === 'string');
}

/**
 * Die Minispiele, wie sie gerade gelten: die gemerkte Wahl, bereinigt um
 * alles, was das Modul nicht (mehr) kennt — sonst lehnte der Server den
 * ganzen Tisch ab. Bleiben zu wenige uebrig, gilt wieder die Vorgabe.
 */
export function wirksameMinispiele(vorgabe: Record<string, unknown> | null, wahl: PartyWahl): string[] | null {
  const alle = alleMinispiele(vorgabe);
  if (!alle) return null;
  if (!wahl.minispiele) return alle;
  const bekannt = new Set(alle);
  const sauber = wahl.minispiele.filter((id, i, liste) => bekannt.has(id) && liste.indexOf(id) === i);
  return sauber.length >= Math.min(MINDESTENS_MINISPIELE, alle.length) ? sauber : alle;
}

/**
 * Die neue Minispielwahl zum Merken. Deckt sie sich genau mit der Vorgabe
 * (alle, in Modulreihenfolge), wird sie NICHT gemerkt: Wer so spielt, soll
 * ein neues Minispiel von selbst bekommen, statt fuer immer auf dem Stand
 * von heute zu bleiben.
 */
export function minispielWahl(vorgabe: Record<string, unknown> | null, neu: readonly string[]): string[] | null {
  const alle = alleMinispiele(vorgabe);
  if (alle && alle.length === neu.length && alle.every((id, i) => neu[i] === id)) return null;
  return [...neu];
}

/** Ein Minispiel in der Reihenfolge verschieben (−1 frueher, +1 spaeter). */
export function verschiebe(liste: readonly string[], id: string, schritt: -1 | 1): string[] {
  const i = liste.indexOf(id);
  const j = i + schritt;
  if (i < 0 || j < 0 || j >= liste.length) return [...liste];
  const neu = [...liste];
  neu[i] = liste[j]!;
  neu[j] = id;
  return neu;
}

/**
 * Die Inhaltsstufe, wie sie angezeigt und geschickt wird.
 *
 * Ein Gast bekommt „derb“ nicht: Die Kachel ist gesperrt, und eine von
 * frueher gemerkte 3 (etwa vor dem Abmelden) wird als „pikant“ angezeigt
 * UND so geschickt — nicht still derb gewaehlt und am Server gekappt. Die
 * Kappung am Server (`erzeugePartie`, `INHALTS_HAERTE_GAST_MAX`) bleibt
 * trotzdem die eigentliche Sperre: Sie gilt auch fuer Gaeste, die sich erst
 * spaeter an den Tisch eines Kontos setzen, und die sieht dieses Menue nie.
 */
export function wirksameInhaltsHaerte(
  vorgabe: Record<string, unknown> | null,
  wahl: PartyWahl,
  gast: boolean,
): number | null {
  const roh = vorgabe?.['inhaltsHaerte'];
  const stufe = wahl.inhaltsHaerte ?? (typeof roh === 'number' ? roh : null);
  if (stufe === null) return null;
  return gast && stufe > 2 ? 2 : stufe;
}

/** Das Paket als Kachelkennung: `PAKET_ALLES` fuer `null`. Unbekanntes zaehlt als „alles“. */
export function wirksamesPaket(vorgabe: Record<string, unknown> | null, wahl: PartyWahl): string | null {
  if (wahl.paket !== null) return wahl.paket in PAKET_NAME ? wahl.paket : PAKET_ALLES;
  if (!vorgabe) return null;
  const roh = vorgabe['paket'];
  return typeof roh === 'string' && roh in PAKET_NAME ? roh : PAKET_ALLES;
}

/**
 * Kennt das Modul einen Modus? Nur dann erscheinen die Kacheln.
 *
 * Der Modus kommt mit einer eigenen Karte in Regel und Engine. Bis sie gemergt
 * ist, fehlt `modus` in `defaultConfig()` — und ein Menue, das trotzdem Modi
 * anboete, verspraeche etwas, das der Server gar nicht versteht (schlimmer:
 * `validateConfig` ignoriert ein unbekanntes Feld, der Tisch liefe still als
 * Turnier).
 */
export function modusBekannt(vorgabe: Record<string, unknown> | null): boolean {
  return typeof vorgabe?.['modus'] === 'string';
}

export function wirksamerModus(vorgabe: Record<string, unknown> | null, wahl: PartyWahl): string | null {
  if (!modusBekannt(vorgabe)) return null;
  if (wahl.modus !== null && MODI.some((m) => m.kennung === wahl.modus)) return wahl.modus;
  return vorgabe!['modus'] as string;
}

/**
 * Der Regelsatz, der beim Tischanlegen als `config` geht.
 *
 * Grundlage ist die VORGABE DES MODULS, darauf `basis` (Trinkmodus und
 * Schluckfaktor aus den Einstellungen), darauf die Auswahl. Die Reihenfolge
 * ist der Punkt: Der Server schreibt eine mitgeschickte `config` unveraendert
 * als Regelsatz fest (spiel-vorgabe.ts) — was hier fehlt, fehlt am Tisch.
 * Deshalb kommt jedes Feld, das niemand gewaehlt hat, aus der Vorgabe und
 * nicht aus einer Zahl in diesem Client.
 *
 * `minispiele` aus `basis` wird dabei bewusst ueberschrieben: Die
 * Einstellungen kannten bis hierher nur „alle“, und das war eine Abschrift.
 */
export function regelsatzAus(
  vorgabe: Record<string, unknown>,
  basis: Record<string, unknown>,
  wahl: PartyWahl,
  gast: boolean,
): Record<string, unknown> {
  const config: Record<string, unknown> = { ...vorgabe, ...basis };
  const minispiele = wirksameMinispiele(vorgabe, wahl);
  if (minispiele) config['minispiele'] = minispiele;
  const stufe = wirksameInhaltsHaerte(vorgabe, wahl, gast);
  if (stufe !== null) config['inhaltsHaerte'] = stufe;
  const paket = wirksamesPaket(vorgabe, wahl);
  if (paket !== null) config['paket'] = paket === PAKET_ALLES ? null : paket;
  const modus = wirksamerModus(vorgabe, wahl);
  if (modus !== null) config['modus'] = modus;
  return config;
}
