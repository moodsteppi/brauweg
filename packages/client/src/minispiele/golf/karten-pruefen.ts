/**
 * Die Bahnprüfung: Was muss eine Karte erfüllen, damit sie spielbar ist?
 *
 * Vierzig Bahnen von Hand nachzuspielen schafft niemand, und die Fehler, die
 * hier gefunden werden, fallen im Spiel erst auf, wenn ein Mensch feststeckt:
 * ein Loch, das in einer Wand liegt; ein Abschlag außerhalb des Felds; eine
 * Kammer, in die kein Ball hineinrollt. Deshalb prüft das hier — und der
 * Vitest über alle Karten macht daraus eine Bedingung fürs Grünwerden.
 *
 * Zwei Arten von Prüfung stehen nebeneinander:
 *
 *   - `pruefeKarte` prüft Form, Grenzen, Abstände und Erreichbarkeit. Rein
 *     geometrisch, in Millisekunden.
 *   - `botLoestKarte` spielt die Bahn tatsächlich durch. Das findet, was keine
 *     Geometrie findet: eine Bahn, die zwar erreichbar, aber nicht spielbar
 *     ist, weil das Loch nur über einen Schlag geht, den es nicht gibt.
 */

import { erreichbarVon, wegfeld } from './bot';
import {
  type Karte,
  type Wand,
  type Zone,
  abstandZuWaenden,
  istInZone,
  istKreis,
  istRechteck,
} from './karte';
import { type Botstufe, type Partiezustand, neuePartie, schritt, starteLoch } from './physik';

/** Kleinster Abstand eines Abschlags zu einer Wand. */
export const ABSCHLAG_WANDABSTAND = 1.2;
/** Kleinster Abstand zweier Abschläge zueinander. */
export const ABSCHLAG_ABSTAND = 0.9;
/** Kleinster Abstand des Lochs zu einer Wand. */
export const LOCH_WANDABSTAND = 1.5;
/** Deckel der Probesimulation in Takten (150 s). */
export const PROBE_TAKTE = 3000;

/* --------------------------------------------------------------------------
 * Geometrie
 * ----------------------------------------------------------------------- */

function imFeld(karte: Karte, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x <= karte.breite && y <= karte.hoehe;
}

function wandImFeld(karte: Karte, wand: Wand): boolean {
  if (istRechteck(wand)) {
    return (
      wand.w > 0 &&
      wand.h > 0 &&
      imFeld(karte, wand.x, wand.y) &&
      imFeld(karte, wand.x + wand.w, wand.y + wand.h)
    );
  }
  return wand.dicke > 0 && imFeld(karte, wand.ax, wand.ay) && imFeld(karte, wand.bx, wand.by);
}

function zoneImFeld(karte: Karte, zone: Zone): boolean {
  if (zone.art === 'drehkreuz') {
    const halb = zone.laenge / 2;
    return imFeld(karte, zone.x - halb, zone.y - halb) && imFeld(karte, zone.x + halb, zone.y + halb);
  }
  if (zone.art === 'portal' || zone.art === 'bumper' || zone.art === 'strudel') {
    return imFeld(karte, zone.x - zone.r, zone.y - zone.r) && imFeld(karte, zone.x + zone.r, zone.y + zone.r);
  }
  if (istKreis(zone)) {
    return imFeld(karte, zone.x - zone.r, zone.y - zone.r) && imFeld(karte, zone.x + zone.r, zone.y + zone.r);
  }
  return imFeld(karte, zone.x, zone.y) && imFeld(karte, zone.x + zone.w, zone.y + zone.h);
}

/** Alle Zonen, in denen der Punkt liegt (Drehkreuze zählen nicht als Fläche). */
export function zonenAmPunkt(karte: Karte, x: number, y: number): Zone[] {
  const treffer: Zone[] = [];
  for (let i = 0; i < karte.zonen.length; i += 1) {
    if (istInZone(karte.zonen[i], x, y)) treffer.push(karte.zonen[i]);
  }
  return treffer;
}

/* --------------------------------------------------------------------------
 * Prüfung
 * ----------------------------------------------------------------------- */

/**
 * Prüft eine Karte. Leere Liste heißt: in Ordnung.
 *
 * `alleKarten` ist optional und nur für die Eindeutigkeit der Kennung da —
 * eine doppelte `id` sieht man einer einzelnen Karte nicht an, und der
 * Segment-Zwischenspeicher würde sie später klaglos hinnehmen.
 */
export function pruefeKarte(karte: Karte, alleKarten?: readonly Karte[]): string[] {
  const fehler: string[] = [];

  if (karte.id.trim() === '') fehler.push('Kennung fehlt');
  if (karte.name.trim() === '') fehler.push('Name fehlt');
  if (alleKarten !== undefined) {
    let gleiche = 0;
    for (const k of alleKarten) if (k.id === karte.id) gleiche += 1;
    if (gleiche > 1) fehler.push(`Kennung ${karte.id} kommt ${gleiche}-mal vor`);
  }
  if (karte.schwierigkeit < 1 || karte.schwierigkeit > 5) {
    fehler.push(`Schwierigkeit ${karte.schwierigkeit} liegt nicht in 1..5`);
  }
  if (karte.breite < 12 || karte.breite > 40) fehler.push(`Breite ${karte.breite} liegt nicht in 12..40`);
  if (karte.hoehe < 16 || karte.hoehe > 64) fehler.push(`Hoehe ${karte.hoehe} liegt nicht in 16..64`);
  if (karte.schlagLimit < 6 || karte.schlagLimit > 12) {
    fehler.push(`Schlaglimit ${karte.schlagLimit} liegt nicht in 6..12`);
  }
  if (karte.zeitLimitS < 45 || karte.zeitLimitS > 120) {
    fehler.push(`Zeitlimit ${karte.zeitLimitS} s liegt nicht in 45..120`);
  }
  if (karte.par < 1 || karte.par > karte.schlagLimit - 2) {
    fehler.push(`Par ${karte.par} liegt nicht in 1..${karte.schlagLimit - 2}`);
  }

  for (let i = 0; i < karte.waende.length; i += 1) {
    if (!wandImFeld(karte, karte.waende[i])) fehler.push(`Wand ${i} liegt nicht im Feld`);
  }
  for (let i = 0; i < karte.zonen.length; i += 1) {
    const zone = karte.zonen[i];
    if (!zoneImFeld(karte, zone)) fehler.push(`Zone ${i} (${zone.art}) liegt nicht im Feld`);
    if (zone.art === 'portal' && !imFeld(karte, zone.ziel.x, zone.ziel.y)) {
      fehler.push(`Zone ${i} (portal) zielt aus dem Feld heraus`);
    }
    if (zone.art === 'strudel' && zone.ziel !== undefined && !imFeld(karte, zone.ziel.x, zone.ziel.y)) {
      fehler.push(`Zone ${i} (strudel) zielt aus dem Feld heraus`);
    }
  }

  // Loch
  const [lx, ly] = karte.loch;
  if (!imFeld(karte, lx, ly)) fehler.push('Loch liegt ausserhalb des Feldes');
  else {
    const abstand = abstandZuWaenden(karte, lx, ly);
    if (abstand < LOCH_WANDABSTAND) {
      fehler.push(`Loch liegt in oder zu nah an einer Wand (${abstand.toFixed(2)} E, noetig ${LOCH_WANDABSTAND})`);
    }
    const zonen = zonenAmPunkt(karte, lx, ly);
    if (zonen.length > 0) fehler.push(`Loch liegt in einer Zone (${zonen[0].art})`);
  }

  // Abschläge
  if (karte.abschlaege.length < 2) fehler.push('Weniger als zwei Abschlaege');
  for (let i = 0; i < karte.abschlaege.length; i += 1) {
    const [ax, ay] = karte.abschlaege[i];
    if (!imFeld(karte, ax, ay)) {
      fehler.push(`Abschlag ${i} liegt ausserhalb des Feldes`);
      continue;
    }
    const abstand = abstandZuWaenden(karte, ax, ay);
    if (abstand < ABSCHLAG_WANDABSTAND) {
      fehler.push(`Abschlag ${i} liegt zu nah an einer Wand (${abstand.toFixed(2)} E, noetig ${ABSCHLAG_WANDABSTAND})`);
    }
    const zonen = zonenAmPunkt(karte, ax, ay);
    if (zonen.length > 0) fehler.push(`Abschlag ${i} liegt in einer Zone (${zonen[0].art})`);
    for (let j = i + 1; j < karte.abschlaege.length; j += 1) {
      const [bx, by] = karte.abschlaege[j];
      const d = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
      if (d < ABSCHLAG_ABSTAND) {
        fehler.push(`Abschlaege ${i} und ${j} liegen ${d.toFixed(2)} E auseinander (noetig ${ABSCHLAG_ABSTAND})`);
      }
    }
  }

  // Erreichbarkeit. Erst, wenn die Geometrie stimmt — sonst meldet die
  // Wegsuche Folgefehler und verdeckt die Ursache.
  if (fehler.length === 0) {
    const feld = wegfeld(karte);
    if (feld.lochZelle < 0 || feld.entfernung[feld.lochZelle] !== 0) {
      fehler.push('Loch liegt auf keinem befahrbaren Feld');
    } else {
      for (let i = 0; i < karte.abschlaege.length; i += 1) {
        const [ax, ay] = karte.abschlaege[i];
        if (!erreichbarVon(karte, ax, ay)) {
          fehler.push(`Vom Abschlag ${i} ist das Loch nicht erreichbar`);
        }
      }
    }
  }

  return fehler;
}

/** Prüft eine ganze Sammlung und liefert nur die Karten mit Befund. */
export function pruefeKarten(karten: readonly Karte[]): { id: string; fehler: string[] }[] {
  const liste: { id: string; fehler: string[] }[] = [];
  for (const karte of karten) {
    const fehler = pruefeKarte(karte, karten);
    if (fehler.length > 0) liste.push({ id: karte.id, fehler });
  }
  return liste;
}

/* --------------------------------------------------------------------------
 * Probesimulation
 * ----------------------------------------------------------------------- */

/**
 * Lässt einen einzelnen Bot die Bahn spielen.
 *
 * Ein Sitz, keine Gegner, keine Netzereignisse — nur der Kern. Das Saatkorn
 * ist fest, damit die Prüfung bei jedem Lauf dieselbe Antwort gibt; eine
 * Prüfung, die manchmal grün und manchmal rot ist, prüft nichts.
 */
export function botLoestKarte(
  karte: Karte,
  stufe: Botstufe = 'genie',
  saat = 0x9017f,
): { geloest: boolean; schlaege: number; takte: number } {
  const z: Partiezustand = neuePartie({
    saat,
    sitze: 1,
    botSitze: [0],
    loecher: 1,
    botStufe: stufe,
    karten: [karte],
  });
  starteLoch(z, 0, 0, [karte]);
  const leer: never[] = [];
  while (z.takt < PROBE_TAKTE && z.aktuell.endeTakt === -1) {
    schritt(z, leer, [karte]);
  }
  const ball = z.baelle[0];
  return { geloest: ball.eingelocht, schlaege: ball.schlaege, takte: z.takt };
}

/**
 * Prüft eine Karte vollständig: Geometrie plus Probelauf.
 *
 * Getrennt von `pruefeKarte`, weil der Probelauf je Karte einige Millisekunden
 * kostet — wer nur die Geometrie wissen will, soll nicht dafür zahlen.
 */
export function pruefeKarteMitBot(karte: Karte, alleKarten?: readonly Karte[]): string[] {
  const fehler = pruefeKarte(karte, alleKarten);
  if (fehler.length > 0) return fehler;
  const probe = botLoestKarte(karte, 'genie');
  if (!probe.geloest) {
    fehler.push(`Bot (genie) locht nicht ein (${probe.schlaege} Schlaege, ${probe.takte} Takte)`);
  } else if (probe.schlaege > karte.schlagLimit) {
    fehler.push(`Bot (genie) braucht ${probe.schlaege} Schlaege, erlaubt sind ${karte.schlagLimit}`);
  }
  return fehler;
}
