/** Regeln ohne Uhr, Netzwerk und Oberfläche. Ein Seed ergibt dieselbe Bauteilfolge für alle. */
export type BauZauber = 'anker' | 'plattform' | 'stein' | 'schwere' | 'eis';
export type BauItem = { art: BauZauber; nummer: number };
export const ZAUBER = Object.freeze({ ankerDauer: 4, schwereFaktor: 3, plattformHalb: 1.5, plattformHoehe: .2, plattformMaximum: 3, platzierZeit: 8 });
export const FAHIGKEITEN: Record<BauZauber, { name: string; kurz: string; beschreibung: string; angriff: boolean }> = {
  anker: { name: 'Turmanker', kurz: '4 Sekunden Schutz', beschreibung: 'Beruhigt deinen Turm für 4 Sekunden. Ideal, wenn es wackelt.', angriff: false },
  plattform: { name: 'Wolkensteg', kurz: 'Plattform platzieren', beschreibung: 'Platziere einen festen, 3 Meter breiten Steg auf oder unterhalb deiner Turmspitze. Maximal 3 Stege pro Runde.', angriff: false },
  stein: { name: 'Steinsiegel', kurz: 'Nächstes Teil verankern', beschreibung: 'Dein nächstes Bauteil wird bei der Landung zu unbeweglichem Stein.', angriff: false },
  schwere: { name: 'Schwergewicht', kurz: 'Gegner beschweren', beschreibung: 'Das nächste Bauteil des gewählten Gegners wiegt dreimal so viel.', angriff: true },
  eis: { name: 'Eisglätte', kurz: 'Gegner aufs Eis legen', beschreibung: 'Das nächste gegnerische Bauteil wird spiegelglatt und rutscht leichter ab.', angriff: true },
};
/** Eigener Zufallsstrom: Item-Verbrauch verändert niemals die gemeinsame Bauteilfolge. */
export function itemZufall(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
export function itemZiehen(zufall: () => number, erlaubt: readonly BauZauber[], vorher?: BauZauber): BauZauber {
  const auswahl = erlaubt.filter(a => a !== vorher);
  const sack = auswahl.length ? auswahl : erlaubt;
  return sack[Math.min(sack.length - 1, Math.floor(zufall() * sack.length))] ?? 'anker';
}
export const BELOHNUNG = Object.freeze({ runde: 5, sieg: 10, tag: 60 });
export type BauErgebnis = { modus: BauModus; hoehe: number; gebaut: number; verloren: number; leben: number; platz: number; gewonnen: boolean; aufgegeben: boolean; dauer: number; spielerzahl: number };
export function bauAbzeichen(e: BauErgebnis): string[] {
  return [...(e.gebaut >= 1 ? ['Baumeister'] : []), ...(e.gewonnen ? ['Turmkönig'] : []), ...(e.hoehe >= 16 ? ['Wolkenkratzer'] : []), ...(e.modus === 'standfest' && e.gewonnen && e.verloren === 0 ? ['Standhaft'] : [])];
}
/** Doppelte bisherige Höhe über der Plattform. */
export const spawnHoehe = (hoehe: number): number => 2 * Math.max(7, hoehe + 5);
export type BauModus = 'rennen' | 'standfest';
export type BauForm = 'balken' | 'quadrat' | 'treppe' | 'bogen' | 'haken' | 'spiegel' | 'stufe';
export type Punkt = { x: number; y: number };
export const FORMEN: readonly BauForm[] = ['balken', 'quadrat', 'treppe', 'bogen', 'haken', 'spiegel', 'stufe'];
export const FORM_NAMEN: Record<BauForm, string> = { balken: 'Balken', quadrat: 'Quadrat', treppe: 'Treppe', bogen: 'Krone', haken: 'Haken', spiegel: 'Winkel', stufe: 'Stufe' };
const raster: Record<BauForm, number[][]> = {
  balken: [[0, 0], [1, 0], [2, 0], [3, 0]], quadrat: [[0, 0], [1, 0], [0, 1], [1, 1]],
  treppe: [[0, 0], [1, 0], [1, 1], [2, 1]], bogen: [[0, 0], [1, 0], [2, 0], [1, 1]],
  haken: [[0, 0], [1, 0], [2, 0], [2, 1]], spiegel: [[0, 0], [1, 0], [2, 0], [0, 1]],
  stufe: [[1, 0], [2, 0], [0, 1], [1, 1]],
};
export const REGELN = Object.freeze({ schritt: 1 / 60, countdown: 3, dauer: 180, ziel: 16, halten: 3, leben: 3, bauteile: 30, nachschubPause: .65, bodenHalb: 4.8, feldHalb: 7.5 });
/** Plausibilitätsgrenze aus Rundenzeit und Mindestpause, kein Spielende im Rennen. */
export const MAX_BAUTEILE = Math.ceil(REGELN.dauer / REGELN.nachschubPause) + 1;
export const MODI: Record<BauModus, { name: string; kurz: string; regel: string }> = {
  rennen: { name: 'Höhenrennen', kurz: 'Hoch hinaus', regel: 'Baue auf 16 Meter und halte deinen Turm 3 Sekunden. Nachschub gibt es auch nach einem Einsturz. Nach 3 Minuten gewinnt der höchste Turm.' },
  standfest: { name: 'Standfest', kurz: 'Drei Leben. Ein Turm.', regel: 'Jedes abgestürzte Teil kostet ein Leben. Wer zuletzt steht, gewinnt. Bei Zeitablauf zählen Leben, Höhe und verbaute Teile. Soloziel: 30 Teile mit mindestens einem Leben.' },
};
export function zellen(form: BauForm): Punkt[] {
  const r = raster[form], mx = r.reduce((s, p) => s + p[0], 0) / r.length, my = r.reduce((s, p) => s + p[1], 0) / r.length;
  return r.map(([x, y]) => ({ x: x - mx, y: y - my }));
}
export function bauteilfolge(seed: number, anzahl = REGELN.bauteile + 1): BauForm[] {
  let s = seed >>> 0;
  const zufall = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const folge: BauForm[] = [];
  while (folge.length < anzahl) {
    const sack = [...FORMEN];
    for (let i = sack.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [sack[i], sack[j]] = [sack[j], sack[i]]; }
    folge.push(...sack);
  }
  return folge.slice(0, anzahl);
}
export type Wertung = { id: string; hoehe: number; leben: number; gebaut: number; aufgegeben: boolean };
/** Gleich gute Ergebnisse teilen sich einen Platz. Sitzreihenfolge ist kein sportliches Kriterium. */
export function rangfolge(spieler: readonly Wertung[], modus: BauModus, zielsieger: readonly string[] = []): (Wertung & { platz: number })[] {
  const wert = (s: Wertung): number[] => [s.aufgegeben ? 0 : 1, zielsieger.includes(s.id) ? 1 : 0, modus === 'standfest' ? s.leben : 0, Math.round(s.hoehe * 100), s.gebaut];
  const vergleich = (a: Wertung, b: Wertung): number => {
    const aa = wert(a), bb = wert(b);
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return bb[i] - aa[i];
    return 0;
  };
  const sortiert = [...spieler].sort(vergleich);
  return sortiert.map((s, i) => ({ ...s, platz: i > 0 && vergleich(s, sortiert[i - 1]) === 0 ? sortiert.findIndex(v => vergleich(v, s) === 0) + 1 : i + 1 }));
}
