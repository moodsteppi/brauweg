/**
 * BroTanks: Zahlen und Waffen. Reine Daten, keine Uhr, kein Netz, keine Oberfläche.
 * Alle Werte sind Startwerte aus docs/BROREMOTE-ARTILLERIE.md; eine Feinabstimmung
 * ist hier genau eine Zeile. Handy und Bühne lesen Namen und Vorrat aus WAFFEN,
 * damit es keine zweite Liste gibt.
 */
export type Waffe = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WAFFEN_ANZAHL = 8;

export const REGELN = Object.freeze({
  /** Feste Schrittweite der Partie UND der Flugrechnung (wie die Bauphysik). */
  schritt: 1 / 60,
  countdown: 3, zielzeit: 20, nachlauf: 1,
  /** Längste Anzeigedauer eines Fluges; die Bühne spielt längere beschleunigt ab. */
  flugAnzeige: 5,
  breite: 64, spaltenbreite: 0.125, spalten: 512,
  /** Höhe außerhalb der Insel und Untergrenze eines Kraters. */
  meeresgrund: -3, tiefstens: -4, hoechstens: 20,
  meerStart: 0,
  lebenspunkte: 100, tank: 100,
  /** 1,5 m/s bei 30 Tank/s: rund 5 m Fahrstrecke je Zug. */
  fahrtempo: 1.5, tankProSekunde: 30, steigungMax: 1.5,
  /** Ohne Auffrischung hält der Bro nach 600 ms an (wie EINGABE_PAUSE_MS im Raumkern). */
  eingabeVerfall: 0.6,
  fallFrei: 2, fallProMeter: 5, eigenerSchaden: 0.5,
  /** Trefferpunkt eines Bros liegt so hoch über dem Fußpunkt; Geschosse treffen im Radius. */
  broHoehe: 0.5, broRadius: 0.7, rohr: 0.6, schuetzenSchonzeit: 0.5,
  rundenMax: 12, flutAb: 6, flutProRunde: 0.5,
  schwerkraft: 9.81, windFaktor: 0.25, staerkeFaktor: 0.3, windMax: 10,
  flugMax: 12, maxTeilgeschosse: 8, maxEinschlaege: 10,
  spielerMin: 2, spielerMax: 4,
});

export type WaffenDaten = {
  name: string;
  /** −1 = unbegrenzt */
  vorrat: number;
  kurz: string;
  /** Kraterradius in m (0 = kein Krater), Schadensradius, größter Schaden, Rückstoß in m. */
  krater: number; radius: number; schaden: number; stoss: number;
};
export const WAFFEN: readonly WaffenDaten[] = Object.freeze([
  { name: 'Schneekugel', vorrat: -1, kurz: 'Kleiner Krater, bis 25 Schaden.', krater: 1.2, radius: 2.4, schaden: 25, stoss: 0 },
  { name: 'Heringsfächer', vorrat: 3, kurz: 'Teilt sich oben in drei Fische.', krater: 0.8, radius: 1.6, schaden: 12, stoss: 0 },
  { name: 'Polterfass', vorrat: 2, kurz: 'Rollt bergab, dann großer Krater.', krater: 2.5, radius: 5, schaden: 35, stoss: 0 },
  { name: 'Hüpfeis', vorrat: 2, kurz: 'Springt zweimal, der dritte Aufprall zündet.', krater: 1, radius: 2, schaden: 20, stoss: 0 },
  { name: 'Meißelbolzen', vorrat: 1, kurz: 'Bohrt 4 m ins Gelände und explodiert dort.', krater: 2.2, radius: 3, schaden: 30, stoss: 0 },
  { name: 'Schneewehe', vorrat: 2, kurz: 'Baut einen Hügel, schadet niemandem.', krater: 0, radius: 0, schaden: 0, stoss: 0 },
  { name: 'Korkenknall', vorrat: 1, kurz: 'Wenig Schaden, stößt Bros weg.', krater: 0.8, radius: 3, schaden: 8, stoss: 4 },
  { name: 'Lichterkette', vorrat: 1, kurz: 'Fünf Funken fallen nacheinander herab.', krater: 0.6, radius: 1.2, schaden: 10, stoss: 0 },
] satisfies WaffenDaten[]);
export const VORRAT_START: readonly number[] = Object.freeze(WAFFEN.map(w => w.vorrat));
/** Hügel der Schneewehe (Breite, Höhe in m). */
export const WEHE = Object.freeze({ breite: 3, hoehe: 1.5 });
/** Lichterkette: Abstand der Funken, Pause zwischen ihnen, Anzahl. */
export const KETTE = Object.freeze({ abstand: 1.2, pause: 0.25, funken: 5 });

/** Eigener Zufallsstrom je Zweck (Wind, Gelände, Reihenfolge): ein Schuss verändert nie die spätere Windfolge. */
export function zufallsstrom(seed: number): () => number {
  let s = seed >>> 0;
  const z = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  // Die ersten Werte einer LCG hängen stark am Seed; kurz einlaufen lassen.
  z(); z(); z();
  return z;
}
export const STROM = Object.freeze({ gelaende: 0x6e1d, wind: 0x57d1, reihe: 0x3a77, platz: 0x91c3 });
export function mischen<T>(liste: readonly T[], zufall: () => number): T[] {
  const r = [...liste];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
