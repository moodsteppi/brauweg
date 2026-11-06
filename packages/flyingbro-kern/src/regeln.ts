/**
 * Flying Bro: die festen Zahlen des Spiels — Stoffe, Giraffen, die drei Bros,
 * Schaden und Trefferpunkte. Quelle ist docs/SPEZIFIKATION-FLYINGBRO.md; wer
 * hier eine Zahl ändert, ändert sie dort mit.
 *
 * Die Physik selbst steht NICHT im Kern (Spezifikation, „Kern"): rapier ist
 * eine Client-Abhängigkeit mit WASM, und ob der Server je nachrechnet, ist
 * offen. Was hier steht, sind die Werte, die die Physik im Client einstellt,
 * und die Regeln, nach denen aus ihren Kontakten Punkte werden — damit der
 * Server dieselben Grenzen kennt, mit denen der Client zählt.
 */

// ---------------------------------------------------------------------------
// Stoffe
// ---------------------------------------------------------------------------

export const STOFFE = ['glas', 'holz', 'stein'] as const;
export type Stoff = (typeof STOFFE)[number];

export interface StoffWerte {
  /** kg/m² — die Welt ist zweidimensional. */
  dichte: number;
  reibung: number;
  abprall: number;
  haltbarkeit: number;
  /** Punkte, wenn das Teil bricht. Jedes Teil bricht höchstens einmal. */
  bruchpunkte: number;
}

/** Für alle Teile eines Stoffs gleich — Abwechslung kommt aus der Form, nicht aus Ausnahmen. */
export const STOFF_WERTE: Readonly<Record<Stoff, StoffWerte>> = {
  glas: { dichte: 0.9, reibung: 0.2, abprall: 0.15, haltbarkeit: 20, bruchpunkte: 100 },
  holz: { dichte: 0.7, reibung: 0.6, abprall: 0.1, haltbarkeit: 60, bruchpunkte: 200 },
  stein: { dichte: 2.2, reibung: 0.8, abprall: 0.05, haltbarkeit: 160, bruchpunkte: 400 },
};

/** Ab diesen Anteilen der Haltbarkeit wechselt das Bild auf die nächste Rissstufe (Bild, keine Physik). */
export const RISS_STUFEN = [0.66, 0.33, 0] as const;

// ---------------------------------------------------------------------------
// Giraffen
// ---------------------------------------------------------------------------

export const GIRAFFEN_GROESSEN = ['kalb', 'giraffe', 'langhals'] as const;
export type GiraffenGroesse = (typeof GIRAFFEN_GROESSEN)[number];

export interface GiraffenWerte {
  /** Fußpunkt bis Kopf, in Metern. */
  hoehe: number;
  rumpfBreite: number;
  rumpfHoehe: number;
  dichte: number;
  haltbarkeit: number;
  /** Punkte, wenn sie umfällt. Jede Giraffe fällt höchstens einmal. */
  punkte: number;
}

export const GIRAFFEN_WERTE: Readonly<Record<GiraffenGroesse, GiraffenWerte>> = {
  kalb: { hoehe: 0.6, rumpfBreite: 0.5, rumpfHoehe: 0.35, dichte: 0.8, haltbarkeit: 25, punkte: 2000 },
  giraffe: { hoehe: 1.3, rumpfBreite: 0.8, rumpfHoehe: 0.5, dichte: 0.9, haltbarkeit: 60, punkte: 3500 },
  langhals: { hoehe: 2.1, rumpfBreite: 1.0, rumpfHoehe: 0.6, dichte: 1.0, haltbarkeit: 110, punkte: 5000 },
};

/**
 * Wann eine Giraffe als umgefallen gilt (eine der drei Bedingungen genügt).
 * Umwerfen genügt — sie muss nicht zerbrechen; das ist der Unterschied zum
 * Vorbild und der Grund, warum die Kopflastigkeit zählt.
 */
export const GIRAFFE_UMGEFALLEN = {
  /** Neigung über diesem Winkel … */
  neigungGrad: 70,
  /** … länger als so viele Sekunden. */
  liegenS: 0.5,
  /** Tiefer gefallen als so viele Meter, gemessen von der höchsten Lage seit der letzten Ruhe. */
  fallhoeheM: 1.5,
} as const;

/** Reine Regel, damit Client und spätere Nachrechnung dieselbe Grenze ziehen. */
export function giraffeUmgefallen(z: {
  haltbarkeit: number;
  /** Wie lange die Neigung schon über `neigungGrad` liegt, in Sekunden (0, wenn nicht). */
  liegtSeitS: number;
  /** Höhe des Fußpunkts jetzt und höchste seit der letzten Ruhe, in Metern. */
  y: number;
  hoechstesY: number;
}): boolean {
  return (
    z.haltbarkeit <= 0 ||
    z.liegtSeitS > GIRAFFE_UMGEFALLEN.liegenS ||
    z.hoechstesY - z.y > GIRAFFE_UMGEFALLEN.fallhoeheM
  );
}

// ---------------------------------------------------------------------------
// Die drei Bros
// ---------------------------------------------------------------------------

export const BROS = ['pelle', 'malve', 'tjark'] as const;
export type Bro = (typeof BROS)[number];

export type Faehigkeit = 'bauchrutscher' | 'gleitflug' | 'eisblock';

export interface BroWerte {
  name: string;
  radius: number;
  dichte: number;
  /** m/s bei vollem Zugweg. */
  hoechsttempo: number;
  faehigkeit: Faehigkeit;
  /**
   * Schadensfaktor je Stoff, NACHDEM die Fähigkeit ausgelöst wurde. Ohne
   * Fähigkeit ist der Faktor an allen Stoffen 1 (Spezifikation, „Die drei Bros").
   */
  faktorMitFaehigkeit: Readonly<Record<Stoff, number>>;
  /** Erstes Level, in dem er in einer Reihenfolge vorkommen darf. */
  abWelt: number;
  abNr: number;
}

export const BRO_WERTE: Readonly<Record<Bro, BroWerte>> = {
  pelle: {
    name: 'Pelle',
    radius: 0.3,
    dichte: 2.0,
    hoechsttempo: 22,
    faehigkeit: 'bauchrutscher',
    faktorMitFaehigkeit: { holz: 1.5, glas: 1, stein: 1 },
    abWelt: 1,
    abNr: 1,
  },
  malve: {
    name: 'Malve',
    radius: 0.27,
    dichte: 1.6,
    hoechsttempo: 24,
    faehigkeit: 'gleitflug',
    faktorMitFaehigkeit: { glas: 2, holz: 1, stein: 1 },
    abWelt: 1,
    abNr: 6,
  },
  tjark: {
    name: 'Tjark',
    radius: 0.3,
    dichte: 2.4,
    hoechsttempo: 20,
    faehigkeit: 'eisblock',
    // An Glas nur ×0,5: Der Eisblock rutscht ab, statt zu schneiden.
    faktorMitFaehigkeit: { stein: 2.5, glas: 0.5, holz: 1 },
    abWelt: 2,
    abNr: 1,
  },
};

/** Masse eines Bros in kg (Kreis, 2D): π r² × Dichte. */
export function broMasse(bro: Bro): number {
  const w = BRO_WERTE[bro];
  return Math.PI * w.radius * w.radius * w.dichte;
}

/** Darf dieser Bro im Level `welt`/`nr` vorkommen? Davor ist er nicht freigeschaltet. */
export function broFreigeschaltet(bro: Bro, welt: number, nr: number): boolean {
  const w = BRO_WERTE[bro];
  return welt > w.abWelt || (welt === w.abWelt && nr >= w.abNr);
}

/** Die Fähigkeiten im Einzelnen — Werte, die der Client in die Physik gibt. */
export const FAEHIGKEITEN = {
  bauchrutscher: {
    /** Kapsel statt Kreis. */
    breite: 0.7,
    hoehe: 0.3,
    /** Anteil des Tempos, der beim ersten Bodenkontakt bleibt (statt Abprall). */
    tempoBehalten: 0.9,
    reibung: 0.02,
    rutschenMaxS: 3,
  },
  gleitflug: {
    schwerkraftFaktor: 0.3,
    luftwiderstand: 0.4,
    dauerMaxS: 2.5,
    /** Als einzige geht sie nach einem Streifkontakt noch, solange Malve nicht lag. */
    nachStreifkontakt: true,
  },
  eisblock: {
    kante: 0.6,
    masseFaktor: 3,
    abprall: 0,
  },
} as const;

// ---------------------------------------------------------------------------
// Spielablauf
// ---------------------------------------------------------------------------

export const SPIELABLAUF = {
  /** Abschusspunkt über dem Boden, wenn das Level nichts anderes sagt. */
  schleuderHoehe: 1.2,
  zugwegMax: 2.4,
  /** Darunter bricht das Loslassen ab — kein Versehensschuss. */
  zugwegMin: 0.3,
  vorschauS: 0.6,
  vorschauFernrohrS: 1.5,
  /** Spätestens so lange nach dem Schuss beginnt der nächste Zug, auch wenn nicht alles schläft. */
  ruheMaxS: 6,
  /** Ohne Dämpfung rollt der Bro auf flachem Boden ewig, und nichts schläft je ein. */
  broRollDaempfung: 0.8,
  broLinearDaempfung: 0.3,
  /** Je nicht verschossenem Bro am Levelende. */
  bonusJeUebrigemBro: 3000,
} as const;

/** Abschussgeschwindigkeit in m/s; `null` heißt: Zugweg zu kurz, kein Schuss. */
export function abschussTempo(bro: Bro, zugweg: number): number | null {
  if (!(zugweg >= SPIELABLAUF.zugwegMin)) return null;
  const anteil = Math.min(zugweg, SPIELABLAUF.zugwegMax) / SPIELABLAUF.zugwegMax;
  return anteil * BRO_WERTE[bro].hoechsttempo;
}

// ---------------------------------------------------------------------------
// Schaden und Treffer
// ---------------------------------------------------------------------------

export const SCHADEN = {
  /** Darunter kein Schaden — sonst zerreibt sich ein ruhig liegender Stapel selbst. */
  impulsSchwelle: 2,
  jeImpuls: 10,
} as const;

export const TREFFER = {
  /** Ein Treffer zählt erst über diesem Schaden. */
  abSchaden: 5,
  punkte: 10,
  /**
   * Höchstens so viele Treffer je Ziel und Versuch. Ohne Deckel hinge die
   * Punktsumme an der Zahl der Kontakte, und die ist nicht beschränkt — der
   * Server lehnt aber alles über den Höchstpunkten ab.
   */
  maxJeZiel: 5,
} as const;

/** Höchstens so viele Trefferpunkte bringt ein einzelnes Ziel in einem Versuch. */
export const TREFFERPUNKTE_MAX_JE_ZIEL = TREFFER.punkte * TREFFER.maxJeZiel;

/**
 * Schadensfaktor eines Kontakts. Bauteil gegen Bauteil (und gegen Giraffen)
 * ist 1; ein Bro ohne ausgelöste Fähigkeit ebenso.
 */
export function schadensFaktor(bro: Bro | null, stoff: Stoff | 'giraffe', faehigkeitAktiv: boolean): number {
  if (bro === null || !faehigkeitAktiv || stoff === 'giraffe') return 1;
  return BRO_WERTE[bro].faktorMitFaehigkeit[stoff];
}

/** Schaden je Kontakt aus dem Normalimpuls. */
export function kontaktSchaden(normalimpuls: number, faktor: number): number {
  return Math.max(0, normalimpuls - SCHADEN.impulsSchwelle) * SCHADEN.jeImpuls * faktor;
}

/**
 * Trefferpunkte für den BEGINN eines Kontakts mit einem Ziel, das in diesem
 * Versuch schon `bisherigeTreffer` gezählte Treffer hat. Der Aufrufer zählt
 * nur, wenn hier mehr als 0 herauskommt.
 */
export function trefferPunkte(schaden: number, bisherigeTreffer: number): number {
  if (schaden <= TREFFER.abSchaden) return 0;
  if (bisherigeTreffer >= TREFFER.maxJeZiel) return 0;
  return TREFFER.punkte;
}
