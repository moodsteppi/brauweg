/**
 * Partiezustand von Golf.
 *
 * Duenn wie bei Feldherr: Saatkorn, Regelsatz, Bot-Sitze, die Zugliste
 * (Schlaege mit Takt), Ausstiege, Ergebnismeldungen. Die eigentliche Partie —
 * Baelle, Loecher, Physik — rechnet ausschliesslich der Client aus Saatkorn +
 * Zugliste; der Server weiss davon nichts und kann es deshalb auch nicht
 * falsch rechnen.
 */

import type { BotLevel } from '@brauweg/game-api';

import { DEFAULT_BOT_LEVEL } from '@brauweg/game-api';

import { BAHNEN_KATALOG, waehleBahnen } from './bahnen.js';
import type { GolfAktion, GolfRegeln, Zug } from './regeln.js';

export class RegelverstossError extends Error {}

export interface GolfAusstieg {
  readonly sitz: number;
  /** Index in `zuege`, ab dem der Sitz als ausgestiegen gilt (siehe Client). */
  readonly abZug: number;
}

export interface GolfMeldung {
  readonly schlaege: readonly number[];
  readonly pruef: string;
  /**
   * Die Tafel `[loch][sitz]`, aus der `pruef` gerechnet ist — seit dem
   * 22.09.2026 fuer die Bestleistung je Bahn (bestleistung.ts). Fehlt bei
   * Geraeten von davor und bei kaputter Form; die Meldung zaehlt dann fuer
   * den Platz wie immer, nur ohne Bestleistung.
   *
   * Steht damit auch in der Sicht (`meldungen`), und trotzdem ohne Sprung
   * von `protocolVersion`: Die Versionsgrenze trennt Geraete, die aus
   * derselben Zugliste verschiedene Partien rechnen. Dieses Feld rechnet
   * niemand nach; ein alter Client liest daran vorbei, ein alter Sender
   * laesst es weg.
   */
  readonly jeLoch?: readonly (readonly number[])[];
}

export interface GolfAusgang {
  readonly schlaege: readonly number[];
  readonly strittig: boolean;
}

export interface GolfPartie {
  readonly regeln: GolfRegeln;
  /** Saatkorn, aus dem alle Geraete dieselben Bahnen und Bot-Entscheidungen ziehen. */
  readonly saat: number;
  readonly sitze: number;
  readonly loecher: number;
  /**
   * Die Bahnen der Partie als Kennungen, ein Eintrag je Loch in Spielfolge.
   * Seit dem 22.09.2026 hier EINMAL beim Start gezogen (`waehleBahnen`) statt
   * auf jedem Geraet gegen dessen eigenen Katalog — so kann eine neue Bahn
   * dazukommen, ohne dass zwei Geraete aus derselben Saat Verschiedenes
   * spielen. Siehe bahnen.ts.
   */
  readonly bahnen: readonly string[];
  readonly botSitze: readonly number[];
  /**
   * Gewuenschte Bot-Spielstaerke des Tisches. Steht hier und nicht nur in
   * `createParty`, weil `viewFor` sie in jeder Sicht ausliefern muss — Golf-
   * Bots leben im Client, und der braucht die Stufe, um dieselbe Staerke zu
   * rechnen wie jedes andere Geraet am Tisch.
   */
  readonly botStufe: BotLevel;
  readonly zuege: readonly (Zug & { readonly sitz: number })[];
  readonly ausstiege: readonly GolfAusstieg[];
  readonly meldungen: Readonly<Record<number, GolfMeldung>>;
  readonly ausgang: GolfAusgang | null;
}

export interface ErzeugePartieOptionen {
  readonly regeln: GolfRegeln;
  readonly saat: number;
  readonly sitze: number;
  readonly loecher: number;
  readonly botSitze?: readonly number[];
  readonly botStufe?: BotLevel;
}

export function erzeugePartie(opts: ErzeugePartieOptionen): GolfPartie {
  // >>> 0 erzwingt eine vorzeichenlose Ganzzahl; || 1 faengt die 0 ab, denn
  // mulberry32 (Client) mit Saat 0 liefert eine gueltige, aber unbrauchbar
  // eintoenige Folge.
  const saat = opts.saat >>> 0 || 1;
  return {
    regeln: opts.regeln,
    saat,
    sitze: opts.sitze,
    loecher: opts.loecher,
    // Aus der NORMIERTEN Saat — dieselbe, die in der Sicht steht und aus der
    // die Geraete bis zum 22.09.2026 selbst gezogen haben. Mit dem Regelsatz,
    // weil er seit demselben Tag die Bahnauswahl des Tisches traegt.
    bahnen: waehleBahnen(saat, opts.loecher, BAHNEN_KATALOG, opts.regeln),
    botSitze: opts.botSitze ? [...opts.botSitze] : [],
    botStufe: opts.botStufe ?? DEFAULT_BOT_LEVEL,
    zuege: [],
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
 * Prueft die Form eines Schlags — nicht, ob er im Spiel Sinn ergibt.
 *
 * Determinismus-Regel aus SPEZIFIKATION-GOLF.md Abschnitt 2: Richtungen sind
 * Einheitsvektoren, keine Winkel. `0.99`/`1.01` lassen die vom Client auf
 * vier Nachkommastellen gerundete Laenge durch, ohne echte Verzerrungen
 * (halbe Kraft in eine Richtung, die keine ist) zu akzeptieren.
 */
function pruefeZugForm(zug: unknown): asserts zug is Zug {
  if (typeof zug !== 'object' || zug === null) {
    throw new RegelverstossError('zugUngueltig');
  }
  const z = zug as Record<string, unknown>;
  if (!istEndlicheZahl(z.takt) || !Number.isInteger(z.takt) || z.takt < 0) {
    throw new RegelverstossError('taktUngueltig');
  }
  if (!istEndlicheZahl(z.nr) || !Number.isInteger(z.nr) || z.nr < 0) {
    throw new RegelverstossError('nrUngueltig');
  }
  if (!istEndlicheZahl(z.rx) || !istEndlicheZahl(z.ry)) {
    throw new RegelverstossError('richtungUngueltig');
  }
  const laenge = Math.sqrt(z.rx * z.rx + z.ry * z.ry);
  if (laenge < 0.99 || laenge > 1.01) {
    throw new RegelverstossError('richtungUngueltig');
  }
  if (!istEndlicheZahl(z.kraft) || z.kraft <= 0 || z.kraft > 1) {
    throw new RegelverstossError('kraftUngueltig');
  }
}

function pruefeErgebnisForm(
  aktion: Extract<GolfAktion, { art: 'ergebnis' }>,
  sitze: number,
): void {
  if (!Array.isArray(aktion.schlaege) || aktion.schlaege.length !== sitze) {
    throw new RegelverstossError('ergebnisUngueltig');
  }
  if (!aktion.schlaege.every((s) => istEndlicheZahl(s))) {
    throw new RegelverstossError('ergebnisUngueltig');
  }
  if (typeof aktion.pruef !== 'string') {
    throw new RegelverstossError('ergebnisUngueltig');
  }
}

/**
 * Obergrenze fuer eine einzelne Schlagzahl in `jeLoch`. Das Schlaglimit einer
 * Bahn liegt bei hoechstens 12 (karten-pruefen.ts im Client), nicht
 * Eingelochtes zaehlt Limit + 1 — alles darueber ist keine Golfpartie,
 * sondern eine kaputte oder erfundene Meldung.
 */
const TAFEL_SCHLAEGE_MAX = 99;

/**
 * Nimmt die mitgeschickte Tafel `[loch][sitz]` an — oder nicht. Gibt eine
 * Kopie zurueck, wenn die Form stimmt, sonst `undefined`.
 *
 * Wirft absichtlich NICHT, anders als `pruefeErgebnisForm`: Die Tafel ist ein
 * Zusatz zur Ergebnismeldung. Ein Geraet von vor dem 22.09.2026 schickt sie
 * gar nicht, ein kaputtes schickt Unsinn — in beiden Faellen zaehlt seine
 * Meldung fuer den Platz weiter, nur eben ohne Bestleistung.
 */
export function tafelAusMeldung(
  roh: unknown,
  loecher: number,
  sitze: number,
): readonly (readonly number[])[] | undefined {
  if (!Array.isArray(roh) || roh.length !== loecher) return undefined;
  const tafel: number[][] = [];
  for (const reihe of roh) {
    if (!Array.isArray(reihe) || reihe.length !== sitze) return undefined;
    for (const wert of reihe) {
      if (
        typeof wert !== 'number' ||
        !Number.isInteger(wert) ||
        wert < 0 ||
        wert > TAFEL_SCHLAEGE_MAX
      ) {
        return undefined;
      }
    }
    tafel.push([...(reihe as number[])]);
  }
  return tafel;
}

/** Letzter Takt, den dieser Sitz schon belegt hat — Aktionen muessen aufsteigen. */
function letzterTakt(partie: GolfPartie, sitz: number): number {
  let max = -1;
  for (const z of partie.zuege) if (z.sitz === sitz && z.takt > max) max = z.takt;
  return max;
}

// ---------------------------------------------------------------------------
// Ergebnis-Mehrheitsregel
// ---------------------------------------------------------------------------

/**
 * Bildet den Ausgang aus den vorhandenen Meldungen — die Mehrheitsregel aus
 * SPEZIFIKATION-GOLF.md Abschnitt 2 ("Ergebnis"):
 *
 *   - Keine Meldung: strittig, alle Schlaegen 0 (niemand hat etwas gesagt).
 *   - Stimmen alle Pruefsummen ueberein: das ist zugleich die groesste
 *     Gruppe, die Schlaegen dieser Gruppe gelten.
 *   - Sonst gilt die groesste Gruppe gleicher Pruefsummen, WENN sie mehr als
 *     die Haelfte aller Meldungen stellt — sonst strittig.
 *
 * Wird von `pruefeAbschluss` (alle Erforderlichen haben gemeldet) UND von
 * `schliesseAb` (Zeitablauf, evtl. mit Luecken) gleichermassen benutzt, damit
 * ein Timeout nie eine andere Regel anwendet als ein vollstaendiger Abschluss.
 */
function ausgangAusMeldungen(
  meldungen: Readonly<Record<number, GolfMeldung>>,
  sitze: number,
): GolfAusgang {
  const groesste = mehrheitsgruppe(meldungen);
  if (groesste === null) {
    return { schlaege: Array(sitze).fill(0), strittig: true };
  }

  // Innerhalb der siegreichen Gruppe zaehlt der niedrigste Sitz — deterministisch,
  // und weil gleiche Pruefsumme ohnehin gleiche Schlaegen bedeuten sollte.
  const gewinner = groesste.reduce((a, b) => (a.sitz < b.sitz ? a : b));
  return { schlaege: [...gewinner.schlaege], strittig: false };
}

/**
 * Die Meldungen mit derselben Pruefsumme, die mehr als die Haelfte aller
 * Meldungen stellen — oder `null` ohne Meldung oder ohne Mehrheit. Eine
 * zweite Gruppe dieser Groesse kann es nicht geben, die Antwort ist also
 * eindeutig.
 *
 * Herausgeloest am 22.09.2026, damit die Bestleistung je Bahn
 * (bestleistung.ts) ihre Tafel aus GENAU der Gruppe nimmt, die den Ausgang
 * gestellt hat, statt die Mehrheitsregel ein zweites Mal aufzuschreiben.
 */
export function mehrheitsgruppe(
  meldungen: Readonly<Record<number, GolfMeldung>>,
): (GolfMeldung & { readonly sitz: number })[] | null {
  const eintraege = Object.entries(meldungen).map(([sitz, m]) => ({
    sitz: Number(sitz),
    ...m,
  }));
  if (eintraege.length === 0) return null;

  const gruppen = new Map<string, typeof eintraege>();
  for (const eintrag of eintraege) {
    const liste = gruppen.get(eintrag.pruef) ?? [];
    liste.push(eintrag);
    gruppen.set(eintrag.pruef, liste);
  }

  let groesste: typeof eintraege = [];
  for (const liste of gruppen.values()) {
    if (liste.length > groesste.length) groesste = liste;
  }

  return groesste.length > eintraege.length / 2 ? groesste : null;
}

/**
 * Schliesst die Partie mit den Meldungen ab, die JETZT vorliegen — der Weg
 * fuer `advanceInterlude` nach Ablauf der Schaupause (`STILLSTAND_MS`). Keine
 * Meldungen heisst: sechs Minuten kein Schlag und keine Meldung, der Tisch
 * ist tot — strittig, alle Platz 1.
 */
export function schliesseAb(partie: GolfPartie): GolfPartie {
  if (partie.ausgang !== null) return partie;
  return { ...partie, ausgang: ausgangAusMeldungen(partie.meldungen, partie.sitze) };
}

/**
 * Prueft, ob nun alle erforderlichen Meldungen da sind, und schliesst die
 * Partie in dem Fall ab. "Erforderlich" ist jeder Sitz, der weder Bot noch
 * ausgestiegen ist — Bots melden nie (sie handeln nur im Client, nie ueber
 * den Server), und wer den Tisch verlassen hat, wird nicht mehr abgewartet.
 *
 * Sind es null Erforderliche (letzter Mensch gerade gegangen, oder von
 * Anfang an nur Bots am Tisch), gilt "alle gemeldet" bei null Meldungen
 * trivial als erfuellt — die Mehrheitsregel liefert dafuer dieselbe Antwort
 * wie bei einem Timeout ohne jede Meldung: strittig.
 */
export function pruefeAbschluss(partie: GolfPartie): GolfPartie {
  if (partie.ausgang !== null) return partie;

  const ausgestiegen = new Set(partie.ausstiege.map((a) => a.sitz));
  const botSitze = new Set(partie.botSitze);

  for (let s = 0; s < partie.sitze; s += 1) {
    if (botSitze.has(s) || ausgestiegen.has(s)) continue;
    if (partie.meldungen[s] === undefined) return partie; // noch nicht alle da
  }

  return { ...partie, ausgang: ausgangAusMeldungen(partie.meldungen, partie.sitze) };
}

// ---------------------------------------------------------------------------
// Aktionsverarbeitung
// ---------------------------------------------------------------------------

/**
 * Nimmt eine Aktion an. Geprueft wird Form und Reihenfolge, NICHT die
 * Physik — der Server kennt weder Baelle noch Loecher.
 */
export function verarbeite(partie: GolfPartie, sitz: number, aktion: GolfAktion): GolfPartie {
  // `nichts` ist die Antwort von botAction (niemand handelt ueber den
  // Server) und deshalb IMMER folgenlos — auch nach dem Ende, siehe adapter.ts.
  if (aktion.art === 'nichts') return partie;

  if (partie.ausgang !== null) throw new RegelverstossError('partieBeendet');
  if (!Number.isInteger(sitz) || sitz < 0 || sitz >= partie.sitze) {
    throw new RegelverstossError('sitzUnbekannt');
  }

  if (aktion.art === 'zug') {
    pruefeZugForm(aktion.zug);
    const zug = aktion.zug;
    if (zug.takt <= letzterTakt(partie, sitz)) {
      throw new RegelverstossError('taktNichtAufsteigend');
    }
    return { ...partie, zuege: [...partie.zuege, { ...zug, sitz }] };
  }

  if (aktion.art === 'aufgabe') {
    return ausstieg(partie, sitz);
  }

  // Ergebnis
  pruefeErgebnisForm(aktion, partie.sitze);
  if (partie.botSitze.includes(sitz)) {
    throw new RegelverstossError('botMeldetNicht');
  }
  if (partie.ausstiege.some((a) => a.sitz === sitz)) {
    throw new RegelverstossError('ausgestiegenMeldetNicht');
  }
  // Erste Meldung je Sitz zaehlt — jede weitere (Neuladen, Doppelklick) ist
  // ein folgenloses No-Op statt eines Fehlers (siehe SPEZIFIKATION-GOLF.md
  // Abschnitt 5: "idempotent").
  if (partie.meldungen[sitz] !== undefined) return partie;

  const jeLoch = tafelAusMeldung(aktion.jeLoch, partie.loecher, partie.sitze);
  const meldungen = {
    ...partie.meldungen,
    [sitz]: {
      schlaege: [...aktion.schlaege],
      pruef: aktion.pruef,
      // Nur wenn da und wohlgeformt — ohne das Feld sieht die Meldung aus
      // wie vor dem 22.09.2026, und alte Schnappschuesse bleiben gleich.
      ...(jeLoch === undefined ? {} : { jeLoch }),
    },
  };
  return pruefeAbschluss({ ...partie, meldungen });
}

/**
 * Aussteigen — idempotent: Ein zweiter Ausstieg desselben Sitzes aendert
 * nichts. Beendet die Partie sofort, wenn dadurch alle uebrigen Erforderlichen
 * bereits gemeldet haben.
 */
export function ausstieg(partie: GolfPartie, sitz: number): GolfPartie {
  if (partie.ausgang !== null) return partie;
  if (partie.ausstiege.some((a) => a.sitz === sitz)) return partie;

  const neu: GolfPartie = {
    ...partie,
    ausstiege: [...partie.ausstiege, { sitz, abZug: partie.zuege.length }],
  };
  return pruefeAbschluss(neu);
}

// ---------------------------------------------------------------------------
// Platzierungen
// ---------------------------------------------------------------------------

export interface GolfPlatzierung {
  readonly sitz: number;
  readonly schlaege: number;
  readonly platz: number;
}

/**
 * Rangfolge aus dem Ausgang: weniger Schlaege ist besser, Gleichstand teilt
 * sich denselben Platz. Vor dem Ende (kein Ausgang) oder bei strittigem
 * Ausgang gibt es keine Rangfolge — alle teilen sich Platz 1, siehe
 * SPEZIFIKATION-GOLF.md Abschnitt 2.
 */
export function platzierungen(ausgang: GolfAusgang | null, sitze: number): GolfPlatzierung[] {
  if (ausgang === null || ausgang.strittig) {
    return Array.from({ length: sitze }, (_, sitz) => ({ sitz, schlaege: 0, platz: 1 }));
  }

  const eintraege = Array.from({ length: sitze }, (_, sitz) => ({
    sitz,
    schlaege: ausgang.schlaege[sitz] ?? 0,
  }));
  const sortiert = [...eintraege].sort((a, b) => a.schlaege - b.schlaege);

  const ergebnis: GolfPlatzierung[] = [];
  let platz = 1;
  for (let i = 0; i < sortiert.length; i += 1) {
    if (i > 0 && sortiert[i]!.schlaege > sortiert[i - 1]!.schlaege) platz = i + 1;
    ergebnis.push({ sitz: sortiert[i]!.sitz, schlaege: sortiert[i]!.schlaege, platz });
  }
  // Wieder nach Sitz ordnen, damit der Aufrufer eine stabile Reihenfolge bekommt.
  return ergebnis.sort((a, b) => a.sitz - b.sitz);
}
