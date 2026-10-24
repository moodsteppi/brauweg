/**
 * Kartenmanufaktur: alle Zahlen, nach denen die Manufaktur rechnet.
 *
 * Eine Werteinheit: **Warenwert in Talern.** Pressen erzeugen Warenwert
 * (Karten × Kartenwert der Sorte), Paternoster und Versand bewegen ihn, und
 * erst der Versand macht daraus Taler. Deshalb haben Transportstationen eine
 * Kapazitaet und eine Fahrzeit, aber keine „Taler je Sekunde".
 *
 * Die Stellschrauben stehen oben als Konstanten. Gestellt werden sie mit
 * `npm run sim --workspace @brauweg/manufaktur-kern` (werkzeug/oekonomie-sim.ts),
 * nicht nach Gefuehl: Das Skript spielt drei Stunden und vergleicht mit den
 * Zielzeiten aus docs/SPEZIFIKATION-KARTENMANUFAKTUR.md.
 */

// ---------------------------------------------------------------------------
// Grenzen
// ---------------------------------------------------------------------------

/** So fein laeuft die Zeit — Server und Client rechnen in denselben Takten. */
export const TAKT_MS = 50;
export const MAX_PRESSEN = 8;
export const MAX_STUFE = 400;
export const MAX_MANUFAKTUR = 5;
/** Jeder Meilenstein verdoppelt die Leistung der Station. */
export const MEILENSTEINE = [10, 25, 50, 100, 150, 200, 300, 400] as const;
/** Bis Stufe 100 bringt jeder Meilenstein einen sichtbaren Arbeiter mehr. */
export const ARBEITER_BIS_STUFE = 100;
export const MAX_ARBEITER = 5;
/**
 * Offline: hoechstens eine Stunde, und nur zum halben Tempo. Mit 2 h zum
 * vollen Tempo verdiente ein Gelegenheitsspieler (4 × 3 min am Tag) mehr in
 * den Pausen als beim Spielen und zog nach 1,3 Tagen das erste Mal um
 * (Simulation, Profil Gelegenheit, 23.10.2026).
 */
export const OFFLINE_MS = 60 * 60 * 1000;
export const OFFLINE_TEMPO = 0.5;
/** Ab dieser Luecke zwischen zwei Rechnungen gilt jemand als weg. */
export const ABWESEND_AB_MS = 60_000;

/** Jubilaeum: Jedes Gildensiegel gibt dauerhaft so viel mehr Kartenwert. */
export const SIEGEL_BONUS = 0.1;
/** Muenzen fuers Hub je Jubilaeum — nur fuer die ersten, sonst waere es eine endlose Muenzquelle. */
export const MUENZEN_JUBILAEUM = 100;
export const JUBILAEEN_MIT_MUENZEN = 10;

/** Meilensteine fuers Hub: Muenzen, nicht Taler. */
export const MUENZEN_MILLION = 50;
export const MUENZEN_UMZUG = 300;

// ---------------------------------------------------------------------------
// Stellschrauben (mit der Simulation gestellt)
// ---------------------------------------------------------------------------
/**
 * Alle Stellschrauben an einem Ort. Nur die Simulation
 * (werkzeug/oekonomie-sim.ts) setzt sie fuer ihre Suche um — Server und
 * Client lesen sie nur. Wer einen Wert aendert, laesst danach die
 * Simulation laufen.
 */
export const STELLSCHRAUBEN = {

  /** Warenwert je Sekunde einer Presse der ersten Etage auf Stufe 1. */
  PRESSE_GRUND: 1.25,
  /** Jede tiefere Etage presst eine wertvollere Sorte. */
  KARTENWERT_STEIGUNG: 6,
  /** Ein Arbeitszyklus der Presse auf Stufe 1 … und hoechstens so viel schneller. */
  PRESSE_ZYKLUS_MS: 4000,
  PRESSE_ZYKLUS_MIN: 0.5,
  PRESSE_ZYKLUS_JE_STUFE: 0.985,

  PATERNOSTER_GRUND: 8,
  /** Fahrt je Etage, Halt je Etage, Entladen oben — bei Tempo 1. */
  PATERNOSTER_FAHRT_MS: 700,
  PATERNOSTER_HALT_MS: 300,
  PATERNOSTER_ENTLADEN_MS: 600,

  VERSAND_GRUND: 10,
  VERSAND_LADEN_MS: 1200,
  VERSAND_FAHRT_MS: 1600,

  /**
   * Transport waechst geometrisch, nicht linear wie die Pressen: Die Pressen
   * werden mit jeder Etage viermal wertvoller, und ein Paternoster, der nur
   * linear mitwaechst, waere ab der dritten Etage eine Mauer (so in der ersten
   * Simulation: Presse 6 erst nach 114 min, 13 min ohne sinnvollen Kauf).
   */
  TRANSPORT_WACHSTUM: 1.09,
  /** Transport wird mit der Stufe schneller, hoechstens doppelt so schnell. */
  TRANSPORT_TEMPO_JE_STUFE: 0.01,
  TRANSPORT_TEMPO_MAX: 2,

  PRESSE_K0: 4,
  PRESSE_K0_STEIGUNG: 13,
  PRESSE_G: 1.13,
  TRANSPORT_K0: 6,
  TRANSPORT_G: 1.12,

  /** Die zweite Presse kostet so viel, jede weitere das Vielfache. */
  FREISCHALT_GRUND: 180,
  FREISCHALT_STEIGUNG: 12,
  /**
   * Abweichung vom festen Faktor, je Etage ab Presse 3: frueh steiler,
   * hinten flacher. Mit einem festen Faktor kam Presse 5 nach 14 statt
   * 25–35 min, Presse 8 aber erst nach 70 — die Mitte war zu leicht, das
   * Ende zaeh.
   */
  FREISCHALT_FORM: [2.5, 3, 2, 0.22, 0.75, 0.33] as number[],

  MEISTER_PRESSE: 120,
  MEISTER_PRESSE_STEIGUNG: 12,
  /**
   * Der Versand-Meister ist der guenstigste: Er ist der erste, den die
   * Anleitung zeigt, weil ohne ihn offline nichts ankommt — wer zuerst einen
   * Pressen-Meister kauft, produziert in einen Stau (Rueckmeldung 23.10.2026).
   */
  MEISTER_VERSAND: 60,
  MEISTER_PATERNOSTER: 90,

  /**
   * Jede weitere Manufaktur ist teurer. Ohne das machte der doppelte Ertrag
   * (`faktor`) jeden Umzug zur Abkuerzung: In der ersten Simulation dauerten die
   * Manufakturen 2 bis 5 nur noch 31, 18, 13 und 9 min — nach gut zwei Stunden
   * waere das Spiel zu Ende gewesen.
   */
  PREIS_JE_MANUFAKTUR: 1.8,
};
const W = STELLSCHRAUBEN;

// ---------------------------------------------------------------------------
// Ziele und Stationen
// ---------------------------------------------------------------------------

export type Ziel = { art: 'presse'; index: number } | { art: 'paternoster' } | { art: 'versand' };

/** Jede weitere Manufaktur leistet doppelt so viel — fuer alle Stationen. */
export function faktor(manufaktur: number): number {
  return 2 ** (manufaktur - 1);
}

export function erreichteMeilensteine(stufe: number): number {
  return MEILENSTEINE.filter((m) => m <= stufe).length;
}

export function sprung(stufe: number): number {
  return 2 ** erreichteMeilensteine(stufe);
}

/** Wie viele Pinguine an einer Presse arbeiten (sichtbar, ohne Einfluss auf die Leistung). */
export function arbeiter(stufe: number): number {
  return Math.min(MAX_ARBEITER, 1 + erreichteMeilensteine(Math.min(stufe, ARBEITER_BIS_STUFE)));
}

/** Der naechste Meilenstein und der vorige — fuer den Balken im Upgrade-Blatt. */
export function meilensteinBalken(stufe: number): { von: number; bis: number } | null {
  const bis = MEILENSTEINE.find((m) => m > stufe);
  if (bis === undefined) return null;
  const vorher = [...MEILENSTEINE].reverse().find((m) => m <= stufe) ?? 0;
  return { von: vorher, bis };
}

export function kartenwert(index: number): number {
  return W.KARTENWERT_STEIGUNG ** index;
}

/** Warenwert je Sekunde, den die Presse liefert, solange sie arbeitet. */
/** Dauerhafter Bonus aus Gildensiegeln (Jubilaeum im Kartenpalast). */
export function siegelFaktor(jubilaeen: number): number {
  return 1 + SIEGEL_BONUS * jubilaeen;
}

export function presseLeistung(index: number, stufe: number, manufaktur: number, jubilaeen = 0): number {
  return W.PRESSE_GRUND * kartenwert(index) * stufe * sprung(stufe) * faktor(manufaktur) * siegelFaktor(jubilaeen);
}

/** Dauer eines Arbeitszyklus (ms): Ein Upgrade macht die Presse sichtbar schneller. */
export function presseZyklus(stufe: number): number {
  return W.PRESSE_ZYKLUS_MS * Math.max(W.PRESSE_ZYKLUS_MIN, W.PRESSE_ZYKLUS_JE_STUFE ** (stufe - 1));
}

/** Warenwert, den ein Zyklus in die Ablage-Kiste legt. */
export function presseErtrag(index: number, stufe: number, manufaktur: number, jubilaeen = 0): number {
  return (presseLeistung(index, stufe, manufaktur, jubilaeen) * presseZyklus(stufe)) / 1000;
}

function transportTempo(stufe: number): number {
  return Math.min(W.TRANSPORT_TEMPO_MAX, 1 + (stufe - 1) * W.TRANSPORT_TEMPO_JE_STUFE);
}

export function paternosterKapazitaet(stufe: number, manufaktur: number): number {
  return W.PATERNOSTER_GRUND * W.TRANSPORT_WACHSTUM ** (stufe - 1) * sprung(stufe) * faktor(manufaktur);
}

/** Eine ganze Fahrt (ms): hinunter bis zur tiefsten Etage, an jeder halten, hinauf, entladen. */
export function paternosterFahrt(etagen: number, stufe: number): number {
  const roh = 2 * etagen * W.PATERNOSTER_FAHRT_MS + etagen * W.PATERNOSTER_HALT_MS + W.PATERNOSTER_ENTLADEN_MS;
  return roh / transportTempo(stufe);
}

/**
 * Wann (Anteil der Fahrt, 0 … 1) der Paternoster an Etage `etage` (1 …)
 * fertig geladen hat. Haengt nur an der Zahl der Etagen, nicht am Tempo —
 * deshalb darf man mitten in der Fahrt ausbauen.
 */
export function paternosterHalt(etage: number, etagen: number): { an: number; ab: number } {
  const roh = 2 * etagen * W.PATERNOSTER_FAHRT_MS + etagen * W.PATERNOSTER_HALT_MS + W.PATERNOSTER_ENTLADEN_MS;
  const an = etage * W.PATERNOSTER_FAHRT_MS + (etage - 1) * W.PATERNOSTER_HALT_MS;
  return { an: an / roh, ab: (an + W.PATERNOSTER_HALT_MS) / roh };
}

/** Ab hier (Anteil der Fahrt) faehrt der Paternoster wieder hinauf. */
export function paternosterWende(etagen: number): number {
  return paternosterHalt(etagen, etagen).ab;
}

/** Ab hier wird oben entladen. */
export function paternosterEntladen(etagen: number): number {
  const roh = 2 * etagen * W.PATERNOSTER_FAHRT_MS + etagen * W.PATERNOSTER_HALT_MS + W.PATERNOSTER_ENTLADEN_MS;
  return (roh - W.PATERNOSTER_ENTLADEN_MS) / roh;
}

export function versandKapazitaet(stufe: number, manufaktur: number): number {
  return W.VERSAND_GRUND * W.TRANSPORT_WACHSTUM ** (stufe - 1) * sprung(stufe) * faktor(manufaktur);
}

/** Laden, wegfahren, zurueckfahren (ms). */
export function versandZyklus(stufe: number): number {
  return (W.VERSAND_LADEN_MS + 2 * W.VERSAND_FAHRT_MS) / transportTempo(stufe);
}

/** Anteile des Versandzyklus: bis hier wird geladen, hier wird verkauft. */
export const VERSAND_ABFAHRT = W.VERSAND_LADEN_MS / (W.VERSAND_LADEN_MS + 2 * W.VERSAND_FAHRT_MS);
export const VERSAND_VERKAUF = (W.VERSAND_LADEN_MS + W.VERSAND_FAHRT_MS) / (W.VERSAND_LADEN_MS + 2 * W.VERSAND_FAHRT_MS);

/**
 * Anteile des Pressenzyklus: zur Presse gehen, pressen, mit dem Stapel zur
 * Kiste, ablegen. Der Warenwert landet am Ende in der Kiste — genau dann,
 * wenn der Pinguin ihn ablegt.
 */
export const PRESSE_PHASEN = { hin: 0.2, arbeiten: 0.55, zurueck: 0.2, ablegen: 0.05 } as const;

// ---------------------------------------------------------------------------
// Kosten
// ---------------------------------------------------------------------------

/** Was in Manufaktur `manufaktur` alles mehr kostet als in der ersten. */
export function preisfaktor(manufaktur: number): number {
  return W.PREIS_JE_MANUFAKTUR ** (manufaktur - 1);
}

function grundkosten(ziel: Ziel, manufaktur: number): { k0: number; g: number } {
  const p = preisfaktor(manufaktur);
  if (ziel.art === 'presse') return { k0: W.PRESSE_K0 * W.PRESSE_K0_STEIGUNG ** ziel.index * p, g: W.PRESSE_G };
  return { k0: W.TRANSPORT_K0 * p, g: W.TRANSPORT_G };
}

/** K(L) = K0 · g^(L−1): der Schritt von Stufe L auf L+1. */
export function ausbauKosten(ziel: Ziel, stufe: number, manufaktur: number): number {
  const { k0, g } = grundkosten(ziel, manufaktur);
  return k0 * g ** (stufe - 1);
}

/** Mehrere Stufen auf einmal — geometrische Summe statt Schleife. */
export function ausbauKostenFuer(ziel: Ziel, stufe: number, anzahl: number, manufaktur: number): number {
  if (anzahl <= 0) return 0;
  const { k0, g } = grundkosten(ziel, manufaktur);
  return (k0 * g ** (stufe - 1) * (g ** anzahl - 1)) / (g - 1);
}

/** Wie viele Stufen man sich mit `taler` leisten kann (hoechstens bis MAX_STUFE). */
export function maxKaufbar(ziel: Ziel, stufe: number, taler: number, manufaktur: number): number {
  const { k0, g } = grundkosten(ziel, manufaktur);
  const frei = MAX_STUFE - stufe;
  if (frei <= 0 || taler <= 0) return 0;
  const erste = k0 * g ** (stufe - 1);
  let n = Math.floor(Math.log(1 + (taler * (g - 1)) / erste) / Math.log(g));
  n = Math.min(frei, Math.max(0, n));
  // Gleitkomma: Die Formel darf sich nie um eine Stufe zu viel verschaetzen.
  while (n > 0 && ausbauKostenFuer(ziel, stufe, n, manufaktur) > taler + 1e-9) n -= 1;
  while (n < frei && ausbauKostenFuer(ziel, stufe, n + 1, manufaktur) <= taler + 1e-9) n += 1;
  return n;
}

/** Kosten der naechsten Presse, wenn schon `anzahlPressen` stehen. */
export function freischaltKosten(anzahlPressen: number, manufaktur: number): number {
  let kosten = W.FREISCHALT_GRUND;
  for (let n = 2; n <= anzahlPressen; n += 1) kosten *= W.FREISCHALT_STEIGUNG * (W.FREISCHALT_FORM[n - 2] ?? 1);
  return kosten * preisfaktor(manufaktur);
}

export function meisterKosten(ziel: Ziel, manufaktur: number): number {
  const grund =
    ziel.art === 'presse'
      ? W.MEISTER_PRESSE * W.MEISTER_PRESSE_STEIGUNG ** ziel.index
      : ziel.art === 'paternoster'
        ? W.MEISTER_PATERNOSTER
        : W.MEISTER_VERSAND;
  return grund * preisfaktor(manufaktur);
}
