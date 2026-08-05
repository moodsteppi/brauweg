/**
 * Bemalung der 3D-Figur — die Pruefung auf der Serverseite.
 *
 * **Der Server kennt Form und Groesse, nie das Aussehen.** Dieselbe Trennung
 * wie bei Blatt, Szenerie und Klangpaket: Wie eine Farbe wirkt, weiss allein
 * der Client. Hier steht nur, was ueberhaupt in die Spalte darf.
 *
 * Geprueft wird, weil die Spalte sonst ein offener Speicher waere: Ohne
 * Obergrenze schreibt ein praeparierter Aufruf ein Megabyte je Konto, und das
 * kommt bei jedem Laden des Profils zurueck. Die Zahlen sind dieselben wie im
 * Client (`packages/client/src/bemalung.ts`) — sie stehen bewusst zweimal, weil
 * der Client sie fuer die Oberflaeche braucht und der Server ihm nicht glauben
 * darf.
 */

/** Mehr Zuege malt niemand freiwillig; darueber faellt der aelteste weg. */
export const MAX_STRICHE = 300;
/** Ein Bogen ueber die ganze Figur braucht keine sechzig Punkte. */
export const MAX_PUNKTE_JE_STRICH = 60;

const FARBE = /^#[0-9a-f]{6}$/i;

export interface Strich {
  readonly f: string;
  readonly b: number;
  readonly p: readonly (readonly [number, number])[];
}

export interface Bemalung {
  readonly design: 'standard' | 'bemalt';
  readonly striche: readonly Strich[];
}

function istStrich(wert: unknown): wert is Strich {
  if (typeof wert !== 'object' || wert === null) return false;
  const s = wert as Partial<Strich>;
  if (typeof s.f !== 'string' || !FARBE.test(s.f)) return false;
  if (typeof s.b !== 'number' || !Number.isFinite(s.b) || s.b <= 0 || s.b > 0.5) return false;
  if (!Array.isArray(s.p) || s.p.length === 0 || s.p.length > MAX_PUNKTE_JE_STRICH) return false;
  return s.p.every(
    (pt) =>
      Array.isArray(pt) &&
      pt.length === 2 &&
      typeof pt[0] === 'number' &&
      typeof pt[1] === 'number' &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1]) &&
      pt[0] >= 0 &&
      pt[0] <= 1 &&
      pt[1] >= 0 &&
      pt[1] <= 1,
  );
}

/**
 * Nimmt an, was gueltig ist, und gibt `null` fuer alles andere.
 *
 * Kein Zurechtbiegen: Ein Aufruf mit einem Strich zu viel wird abgelehnt und
 * nicht stillschweigend beschnitten. Wer beschneidet, bekommt spaeter die
 * Frage, warum die Haelfte der Bemalung fehlt.
 */
export function pruefeBemalung(wert: unknown): Bemalung | null {
  if (typeof wert !== 'object' || wert === null) return null;
  const b = wert as Partial<Bemalung>;
  if (b.design !== 'standard' && b.design !== 'bemalt') return null;
  if (!Array.isArray(b.striche) || b.striche.length > MAX_STRICHE) return null;
  if (!b.striche.every(istStrich)) return null;
  return { design: b.design, striche: b.striche };
}

/**
 * Was in der Spalte steht, zurueck in eine Bemalung.
 *
 * Kaputter Inhalt gibt `null` und keine Ausnahme: Eine Zeile, die einmal
 * falsch geschrieben wurde, darf nicht das ganze Profil unerreichbar machen.
 */
export function leseBemalung(roh: string | null): Bemalung | null {
  if (!roh) return null;
  try {
    return pruefeBemalung(JSON.parse(roh));
  } catch {
    return null;
  }
}
