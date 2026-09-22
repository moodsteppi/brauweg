/**
 * Die Bahnauswahl am Bildschirm: Lobbydaten lesen, Wahl und Regelsatz
 * ineinander übersetzen (seit dem 22.09.2026).
 *
 * Was aus einer Wahl für eine Bahnfolge wird, entscheidet das Modul
 * (`waehleBahnen` in packages/game-golf/src/bahnen.ts) beim Start — hier wird
 * nichts gezogen und nichts ausgedünnt. Die Kurse und die Themen je Bahn
 * kommen ebenfalls vom Modul (`lobbyDaten`, über `/api/games/golf/defaults`),
 * damit der Client die Listen nicht abschreibt.
 *
 * Eine Rechnung steht trotzdem doppelt: `varianteFuer`, der Name der Wahl in
 * der Tischliste. Die Lobby muss ihn in den Regelsatz schreiben (der Server
 * liest `variante`, ohne Golf zu kennen), und der Client importiert das
 * Modul nicht. `vertrag/golf-kurse.test.ts` vergleicht beide Fassungen über
 * alle Filter.
 */

/** Ein Kurs, wie das Modul ihn liefert. */
export interface Kurs {
  kennung: string;
  name: string;
  beschreibung: string;
  bahnen: string[];
}

export interface Thema {
  kennung: string;
  name: string;
}

/** Die Lobbydaten des Moduls (`GolfLobbyDaten` in game-golf). */
export interface Lobbydaten {
  kurse: Kurs[];
  themen: Thema[];
  /** Kennung der Bahn → Themen (Zonenarten), die auf ihr liegen. */
  bahnThemen: Record<string, string[]>;
  /** Spielart einer Einzelauswahl in der Tischliste. */
  eigeneAuswahl: string;
}

/** Die Bahnauswahl, wie sie der Regelsatz trägt — nur die Felder, die hier zählen. */
export interface Bahnregeln {
  kurs?: string;
  filter?: { schwierigkeit?: number[]; thema?: string };
  bahnen?: string[];
  variante?: string;
}

/** Was die Lobby anbietet: vier Wege, einer gilt. */
export type Bahnwahl =
  | { art: 'zufall' }
  | { art: 'kurs'; kurs: string }
  | { art: 'filter'; schwierigkeit: number[]; thema: string | null }
  | { art: 'eigene'; bahnen: string[] };

export const ZUFALL: Bahnwahl = { art: 'zufall' };

/** Höchstens so viele Bahnen in einer Einzelauswahl — die Lochzahl eines Matches. */
export const EIGENE_MAX = 15;
/** Mindestens so viele — darunter nimmt das Modul die Auswahl nicht an. */
export const EIGENE_MIN = 2;

/** Längere Spielarten reicht der Server nicht durch (`varianteVon`). */
const VARIANTE_MAX = 24;

function istText(x: unknown): x is string {
  return typeof x === 'string';
}

function istTextliste(x: unknown): x is string[] {
  return Array.isArray(x) && x.every(istText);
}

/**
 * Die Lobbydaten aus der Antwort des Servers lesen. `null`, wenn sie fehlen
 * (älterer Server) oder nicht die erwartete Form haben — dann bietet die
 * Lobby nur die Zufallsziehung an, statt halbe Listen zu zeigen.
 */
export function liesLobbydaten(roh: unknown): Lobbydaten | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const r = roh as Record<string, unknown>;
  if (!Array.isArray(r.kurse) || !Array.isArray(r.themen) || !istText(r.eigeneAuswahl)) return null;
  if (typeof r.bahnThemen !== 'object' || r.bahnThemen === null) return null;
  const kurse: Kurs[] = [];
  for (const k of r.kurse as unknown[]) {
    const e = k as Record<string, unknown> | null;
    if (!e || !istText(e.kennung) || !istText(e.name) || !istTextliste(e.bahnen)) return null;
    kurse.push({
      kennung: e.kennung,
      name: e.name,
      beschreibung: istText(e.beschreibung) ? e.beschreibung : '',
      bahnen: [...e.bahnen],
    });
  }
  const themen: Thema[] = [];
  for (const t of r.themen as unknown[]) {
    const e = t as Record<string, unknown> | null;
    if (!e || !istText(e.kennung) || !istText(e.name)) return null;
    themen.push({ kennung: e.kennung, name: e.name });
  }
  const bahnThemen: Record<string, string[]> = {};
  for (const [id, liste] of Object.entries(r.bahnThemen as Record<string, unknown>)) {
    if (!istTextliste(liste)) return null;
    bahnThemen[id] = [...liste];
  }
  return { kurse, themen, bahnThemen, eigeneAuswahl: r.eigeneAuswahl };
}

/** Die Wahl, die ein Regelsatz trägt. Alles Unlesbare ist Zufall — wie im Modul. */
export function wahlAusRegeln(regeln: unknown): Bahnwahl {
  if (typeof regeln !== 'object' || regeln === null) return ZUFALL;
  const r = regeln as Record<string, unknown>;
  if (istText(r.kurs)) return { art: 'kurs', kurs: r.kurs };
  if (istTextliste(r.bahnen)) return { art: 'eigene', bahnen: [...r.bahnen] };
  if (typeof r.filter === 'object' && r.filter !== null) {
    const f = r.filter as Record<string, unknown>;
    const schwierigkeit = Array.isArray(f.schwierigkeit)
      ? f.schwierigkeit.filter((s): s is number => Number.isInteger(s))
      : [];
    const thema = istText(f.thema) ? f.thema : null;
    return { art: 'filter', schwierigkeit, thema };
  }
  return ZUFALL;
}

/** Nur die Felder der Wahl — ohne `variante`, die hängt an den Lobbydaten. */
function wahlfelder(wahl: Bahnwahl): Bahnregeln {
  switch (wahl.art) {
    case 'zufall':
      return {};
    case 'kurs':
      return { kurs: wahl.kurs };
    case 'eigene':
      return { bahnen: [...wahl.bahnen] };
    case 'filter': {
      const filter: { schwierigkeit?: number[]; thema?: string } = {};
      if (wahl.schwierigkeit.length > 0) filter.schwierigkeit = [...wahl.schwierigkeit].sort((a, b) => a - b);
      if (wahl.thema !== null) filter.thema = wahl.thema;
      return Object.keys(filter).length > 0 ? { filter } : {};
    }
  }
}

/**
 * Den Regelsatz zu einer Wahl bauen: `basis` (der bisherige Regelsatz des
 * Tisches bzw. die Vorgabe des Moduls) ohne alte Wahl, dazu die neue und ihr
 * Name für die Tischliste. Andere Felder bleiben, wie sie sind — der Client
 * überstimmt nichts, was er nicht einstellt.
 */
export function regelnAusWahl(
  wahl: Bahnwahl,
  basis: Record<string, unknown>,
  daten: Lobbydaten | null,
): Record<string, unknown> {
  const { kurs: _k, filter: _f, bahnen: _b, variante: _v, ...rest } = basis;
  const felder = wahlfelder(wahl);
  const variante = daten === null ? null : varianteFuer(felder, daten);
  return { ...rest, ...felder, ...(variante === null ? {} : { variante }) };
}

/** Stufen als kurzer Text: „Stufe 3–5", „Stufe 2", „Stufe 1, 3, 5". */
function stufenText(stufen: readonly number[]): string {
  const s = [...new Set(stufen)].sort((a, b) => a - b);
  if (s.length === 1) return `Stufe ${s[0]}`;
  const zusammenhaengend = s.every((wert, i) => i === 0 || wert === s[i - 1]! + 1);
  return zusammenhaengend ? `Stufe ${s[0]}–${s[s.length - 1]}` : `Stufe ${s.join(', ')}`;
}

/**
 * Der Name einer Wahl in der Tischliste — dieselbe Rechnung wie
 * `varianteFuer` im Modul (siehe Kopf). `null` für die Zufallsziehung.
 */
export function varianteFuer(regeln: Bahnregeln, daten: Lobbydaten): string | null {
  if (regeln.kurs !== undefined) return daten.kurse.find((k) => k.kennung === regeln.kurs)?.name ?? null;
  if (regeln.bahnen !== undefined) return daten.eigeneAuswahl;
  const filter = regeln.filter;
  if (typeof filter !== 'object' || filter === null) return null;
  const stufen = Array.isArray(filter.schwierigkeit) ? filter.schwierigkeit : [];
  const thema = daten.themen.find((t) => t.kennung === filter.thema)?.name ?? null;
  let text: string;
  if (thema !== null && stufen.length > 0) text = `${thema} · ${stufenText(stufen)}`;
  else if (thema !== null) text = `Nur ${thema}`;
  else if (stufen.length > 0) text = stufenText(stufen);
  else return null;
  return text.length <= VARIANTE_MAX ? text : 'Gefilterte Auswahl';
}

/**
 * Die Lochzahl, die eine Wahl festlegt: ein Kurs seine Länge, eine
 * Einzelauswahl ihre. `null` heißt: Der Regler gilt.
 */
export function festeLochzahl(wahl: Bahnwahl, daten: Lobbydaten | null): number | null {
  if (wahl.art === 'eigene') return wahl.bahnen.length;
  if (wahl.art === 'kurs') return daten?.kurse.find((k) => k.kennung === wahl.kurs)?.bahnen.length ?? null;
  return null;
}

/**
 * Warum sich mit dieser Wahl (noch) nicht starten lässt — oder `null`. Nur
 * die Einzelauswahl kann unfertig sein; alles andere nimmt das Modul immer an.
 */
export function wahlUnfertig(wahl: Bahnwahl): string | null {
  if (wahl.art === 'eigene' && wahl.bahnen.length < EIGENE_MIN) {
    return `Mindestens ${EIGENE_MIN} Bahnen wählen.`;
  }
  return null;
}

/** Zwei Wahlen gleich? Für „schon gesendet" — nicht für die Bahnfolge. */
export function gleicheWahl(a: Bahnwahl, b: Bahnwahl): boolean {
  return JSON.stringify(wahlfelder(a)) === JSON.stringify(wahlfelder(b));
}

/** Die Wahl in einem Satz für alle, die nicht einstellen. */
export function beschreibeWahl(wahl: Bahnwahl, daten: Lobbydaten | null): string {
  if (wahl.art === 'zufall') return 'Zufällige Bahnen aus allen, leicht bis schwer';
  if (daten === null) return 'Eigene Bahnwahl';
  const name = varianteFuer(wahlfelder(wahl), daten);
  if (wahl.art === 'filter') return `Zufällige Bahnen: ${name ?? 'alle'}`;
  return name ?? 'Eigene Bahnwahl';
}

/* --------------------------------------------------------------------------
 * Gemerkte Wahl (nur für den Bot-Tisch — online gilt der Regelsatz des Tisches)
 * ----------------------------------------------------------------------- */

const SCHLUESSEL = 'golf.bahnwahl';

export function gemerkteWahl(): Bahnwahl {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    return roh === null ? ZUFALL : wahlAusRegeln(JSON.parse(roh));
  } catch {
    return ZUFALL;
  }
}

export function merkeWahl(wahl: Bahnwahl): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(wahlfelder(wahl)));
  } catch {
    /* Privates Fenster: Die Wahl gilt trotzdem, nur nicht morgen. */
  }
}

/** Trägt die Wahl überhaupt etwas? Ein leerer Filter ist Zufall — dann geht kein Regelsatz mit. */
export function traegtWahl(wahl: Bahnwahl): boolean {
  return Object.keys(wahlfelder(wahl)).length > 0;
}
