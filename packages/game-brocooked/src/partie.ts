/**
 * Partiezustand von BroCooked.
 *
 * Duenn wie bei Golf: Saatkorn, Regelsatz, Bot-Sitze, die Eingabeliste,
 * Ausstiege, Ergebnismeldungen. Die Kueche selbst — Koeche, Stationen,
 * Tickets, Punkte — rechnet ausschliesslich das Geraet aus Saatkorn und
 * Eingabeliste. Der Server weiss davon nichts und kann es deshalb auch nicht
 * falsch rechnen.
 */

import type { BotLevel } from '@brauweg/game-api';

import { DEFAULT_BOT_LEVEL } from '@brauweg/game-api';

import type { BroCookedAktion, BroCookedRegeln, Eingabe, ErgebnisMeldung } from './regeln.js';

export class RegelverstossError extends Error {}

export interface BroCookedAusstieg {
  readonly sitz: number;
  /** Index in `eingaben`, ab dem der Sitz als ausgestiegen gilt (der Koch bleibt dann stehen). */
  readonly abEingabe: number;
}

export interface BroCookedAusgang {
  readonly punkte: number;
  readonly sterne: readonly number[];
  /**
   * Die Geraete haben Verschiedenes gemeldet. Dann gilt die Mehrheit, und
   * das Ergebnis zaehlt nicht fuer Trophaeen — ein Auseinanderlaufen ist kein
   * Sieg, aber auch kein Verschulden der Spielenden.
   */
  readonly strittig: boolean;
}

export interface BroCookedPartie {
  readonly regeln: BroCookedRegeln;
  readonly saat: number;
  readonly sitze: number;
  readonly runden: number;
  readonly botSitze: readonly number[];
  /**
   * Gewuenschte Bot-Spielstaerke. Steht hier und nicht nur in `createParty`,
   * weil jede Sicht sie ausliefern muss: BroCooked-Bots leben im Geraet, und
   * jedes Geraet muss dieselbe Staerke rechnen wie die anderen.
   */
  readonly botStufe: BotLevel;
  readonly eingaben: readonly (Eingabe & { readonly sitz: number })[];
  readonly ausstiege: readonly BroCookedAusstieg[];
  readonly meldungen: Readonly<Record<number, ErgebnisMeldung>>;
  readonly ausgang: BroCookedAusgang | null;
}

export interface ErzeugePartieOptionen {
  readonly regeln: BroCookedRegeln;
  readonly saat: number;
  readonly sitze: number;
  readonly runden: number;
  readonly botSitze?: readonly number[];
  readonly botStufe?: BotLevel;
}

export function erzeugePartie(opts: ErzeugePartieOptionen): BroCookedPartie {
  return {
    regeln: opts.regeln,
    // >>> 0 erzwingt eine vorzeichenlose Ganzzahl; || 1 faengt die 0 ab, denn
    // mulberry32 (Geraet) liefert mit Saat 0 eine gueltige, aber unbrauchbar
    // eintoenige Folge — jede Runde bekaeme dieselben Tickets.
    saat: opts.saat >>> 0 || 1,
    sitze: opts.sitze,
    runden: opts.runden,
    botSitze: opts.botSitze ? [...opts.botSitze] : [],
    botStufe: opts.botStufe ?? DEFAULT_BOT_LEVEL,
    eingaben: [],
    ausstiege: [],
    meldungen: {},
    ausgang: null,
  };
}

// ---------------------------------------------------------------------------
// Formpruefung
// ---------------------------------------------------------------------------

function istEndlicheZahl(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isFinite(wert);
}

/**
 * Prueft die FORM einer Eingabe, nicht ihren Sinn.
 *
 * Ob ein Koch dort greifen kann, wo er steht, weiss nur die Kueche auf dem
 * Geraet. Hier faellt nur durch, was gar keine Eingabe sein kann — und das
 * muss es, weil die Liste ueber die Leitung kommt und in jeder Partie auf
 * jedem Geraet dieselbe Rechnung ausloest.
 */
function pruefeEingabeForm(eingabe: unknown): asserts eingabe is Eingabe {
  if (typeof eingabe !== 'object' || eingabe === null) {
    throw new RegelverstossError('eingabeUngueltig');
  }
  const e = eingabe as Record<string, unknown>;
  if (!istEndlicheZahl(e.takt) || !Number.isInteger(e.takt) || e.takt < 0) {
    throw new RegelverstossError('taktUngueltig');
  }
  if (!istEndlicheZahl(e.nr) || !Number.isInteger(e.nr) || e.nr < 0) {
    throw new RegelverstossError('nrUngueltig');
  }
  switch (e.art) {
    case 'richtung': {
      if (!istEndlicheZahl(e.dx) || !istEndlicheZahl(e.dy)) {
        throw new RegelverstossError('richtungUngueltig');
      }
      const laenge = Math.sqrt(e.dx * e.dx + e.dy * e.dy);
      // Entweder Stillstand oder ein Einheitsvektor. Die Spanne laesst die auf
      // vier Stellen gerundete Laenge des Geraets durch, aber keine halben
      // Richtungen — die waeren halbe Geschwindigkeit durch die Hintertuer.
      if (laenge > 0.0001 && (laenge < 0.99 || laenge > 1.01)) {
        throw new RegelverstossError('richtungUngueltig');
      }
      return;
    }
    case 'werken':
      if (typeof e.an !== 'boolean') throw new RegelverstossError('werkenUngueltig');
      return;
    case 'greifen':
    case 'spurt':
      return;
    default:
      throw new RegelverstossError('eingabeartUnbekannt');
  }
}

function pruefeMeldung(meldung: unknown, runden: number): asserts meldung is ErgebnisMeldung {
  if (typeof meldung !== 'object' || meldung === null) {
    throw new RegelverstossError('meldungUngueltig');
  }
  const m = meldung as Record<string, unknown>;
  if (!istEndlicheZahl(m.punkte) || !Number.isInteger(m.punkte)) {
    throw new RegelverstossError('punkteUngueltig');
  }
  if (!Array.isArray(m.sterne) || m.sterne.length !== runden) {
    throw new RegelverstossError('sterneUngueltig');
  }
  if (m.sterne.some((s) => !Number.isInteger(s) || (s as number) < 0 || (s as number) > 3)) {
    throw new RegelverstossError('sterneUngueltig');
  }
  if (typeof m.pruef !== 'string' || m.pruef.length === 0 || m.pruef.length > 64) {
    throw new RegelverstossError('pruefUngueltig');
  }
}

// ---------------------------------------------------------------------------
// Handeln
// ---------------------------------------------------------------------------

export function verarbeite(
  partie: BroCookedPartie,
  sitz: number,
  aktion: BroCookedAktion,
): BroCookedPartie {
  if (!Number.isInteger(sitz) || sitz < 0 || sitz >= partie.sitze) {
    throw new RegelverstossError('sitzUnbekannt');
  }
  if (typeof aktion !== 'object' || aktion === null) {
    throw new RegelverstossError('aktionUngueltig');
  }
  switch (aktion.art) {
    case 'nichts':
      return partie;
    case 'eingabe': {
      // Nach dem Abschluss nimmt niemand mehr etwas an: Sonst haenge eine
      // spaete Eingabe an einer Partie, die schon gewertet ist.
      if (partie.ausgang !== null) return partie;
      pruefeEingabeForm(aktion.eingabe);
      // Doppelte still verwerfen: Die eigene Eingabe kommt einmal aus der
      // eigenen Hand und ein zweites Mal vom Server zurueck.
      const schonDa = partie.eingaben.some((e) => e.sitz === sitz && e.nr === aktion.eingabe.nr);
      if (schonDa) return partie;
      return { ...partie, eingaben: [...partie.eingaben, { ...aktion.eingabe, sitz }] };
    }
    case 'ergebnis': {
      if (partie.ausgang !== null) return partie;
      pruefeMeldung(aktion.meldung, partie.runden);
      if (partie.meldungen[sitz]) return partie;
      const meldungen = { ...partie.meldungen, [sitz]: aktion.meldung };
      const naechste: BroCookedPartie = { ...partie, meldungen };
      // Haben alle menschlichen Sitze gemeldet, ist die Partie fertig — auf
      // die Stillstandsgrenze zu warten waere eine Minute Stillstand ohne Grund.
      const menschen = menschlicheSitze(partie);
      const vollzaehlig = menschen.every((s) => meldungen[s] !== undefined);
      return vollzaehlig ? schliesseAb(naechste) : naechste;
    }
    default:
      throw new RegelverstossError('aktionUnbekannt');
  }
}

function menschlicheSitze(partie: BroCookedPartie): number[] {
  const bots = new Set(partie.botSitze);
  const ausgestiegen = new Set(partie.ausstiege.map((a) => a.sitz));
  const sitze: number[] = [];
  for (let s = 0; s < partie.sitze; s += 1) {
    if (!bots.has(s) && !ausgestiegen.has(s)) sitze.push(s);
  }
  return sitze;
}

/**
 * Schliesst die Partie mit den vorhandenen Meldungen ab.
 *
 * Gemeinsam gekocht heisst gemeinsam gewertet: Es gibt EINE Punktzahl. Melden
 * zwei Geraete Verschiedenes, gilt die haeufigste Meldung, und der Ausgang
 * ist `strittig` — dann sind die Geraete auseinandergelaufen, und das darf
 * keine Trophaee geben. Ohne jede Meldung (alle weg, Stillstand) bleibt es
 * bei null Punkten.
 */
export function schliesseAb(partie: BroCookedPartie): BroCookedPartie {
  if (partie.ausgang !== null) return partie;
  const meldungen = Object.values(partie.meldungen);
  if (meldungen.length === 0) {
    return {
      ...partie,
      ausgang: { punkte: 0, sterne: new Array(partie.runden).fill(0), strittig: false },
    };
  }
  const haeufigkeit = new Map<string, { meldung: ErgebnisMeldung; anzahl: number }>();
  for (const m of meldungen) {
    const eintrag = haeufigkeit.get(m.pruef);
    if (eintrag) eintrag.anzahl += 1;
    else haeufigkeit.set(m.pruef, { meldung: m, anzahl: 1 });
  }
  let beste = { meldung: meldungen[0], anzahl: 0 };
  for (const eintrag of haeufigkeit.values()) {
    if (eintrag.anzahl > beste.anzahl) beste = eintrag;
  }
  return {
    ...partie,
    ausgang: {
      punkte: beste.meldung.punkte,
      sterne: beste.meldung.sterne,
      strittig: haeufigkeit.size > 1,
    },
  };
}

/**
 * Ein Sitz verlaesst den Tisch. Der Koch bleibt ab diesem Punkt stehen; das
 * Geraet erkennt ihn an `abEingabe` und laesst ihn aus. Bots uebernehmen
 * einen verlassenen Sitz NICHT — mitten im Gedraenge waere ein
 * uebernommener Koch verwirrender als ein stehender.
 */
export function ausstieg(partie: BroCookedPartie, sitz: number): BroCookedPartie {
  if (!Number.isInteger(sitz) || sitz < 0 || sitz >= partie.sitze) return partie;
  if (partie.ausstiege.some((a) => a.sitz === sitz)) return partie;
  return {
    ...partie,
    ausstiege: [...partie.ausstiege, { sitz, abEingabe: partie.eingaben.length }],
  };
}

export interface Platzierung {
  readonly sitz: number;
  readonly platz: number;
  readonly punkte: number;
}

/**
 * Platzierungen. BroCooked ist ein Miteinander: Alle stehen auf Platz 1 oder
 * alle auf Platz 1 — es gibt nur ein gemeinsames Ergebnis. Die Plattform
 * verlangt trotzdem eine Liste je Sitz, und sie bekommt sie.
 */
export function platzierungen(
  ausgang: BroCookedAusgang | null,
  sitze: number,
): readonly Platzierung[] {
  const punkte = ausgang?.punkte ?? 0;
  return Array.from({ length: sitze }, (_, sitz) => ({ sitz, platz: 1, punkte }));
}
