/** Die Chronik liest dauerhaften Fortschritt; keine zweite Belohnungsquelle. */
import { hoechsterOrt } from './aktionen.js';
import type { ManufakturStand } from './stand.js';
export interface ChronikEintrag { kennung: string; titel: string; text: string; ist: number; soll: number; erreicht: boolean }
export function werkstattChronik(s: ManufakturStand): ChronikEintrag[] {
  const eingestellt = Object.values(s.belegschaft).reduce((n, p) => n + p.eingestellt, 0);
  const renoviert = Object.values(s.orte).reduce((n, o) => n + o.renovierung, 0);
  const buch = Object.values(s.werkstattbuch).reduce((n, stufe) => n + stufe, 0);
  const schule = s.zaehler.ausgebildet ?? 0;
  const daten: [string, string, string, number, number][] = [
    ['team', 'Eine helfende Flosse', 'Stelle deinen ersten Meister ein.', eingestellt, 1],
    ['team-10', 'Ein starkes Team', 'Stelle insgesamt zehn Meister ein.', eingestellt, 10],
    ['schule', 'Meisterstück', 'Bilde deinen ersten Meister aus.', schule, 1],
    ['schule-5', 'Wissen weitergeben', 'Schließe fünf Ausbildungen ab.', schule, 5],
    ['lieferung', 'Über die Werkstatttür hinaus', 'Schließe deinen ersten Kundenauftrag ab.', s.auftraege.erledigt, 1],
    ['lieferung-25', 'Gefragte Karten', 'Schließe 25 Kundenaufträge ab.', s.auftraege.erledigt, 25],
    ['renovierung', 'Frischer Glanz', 'Renoviere eine Manufaktur.', renoviert, 1],
    ['sterne', 'Sterne über der Werkstatt', 'Sammle insgesamt zehn Renovierungsstufen.', renoviert, 10],
    ['buch', 'Das erste Kapitel', 'Kaufe einen Eintrag im Werkstattbuch.', buch, 1],
    ['buch-10', 'Gesammeltes Wissen', 'Kaufe insgesamt zehn Buchstufen.', buch, 10],
    ['reise', 'Am Fluss', 'Erreiche die Fabrik am Fluss.', hoechsterOrt(s) - 1, 1],
    ['palast', 'Vom Dorf zum Palast', 'Erreiche den Kartenpalast.', hoechsterOrt(s) - 1, 4],
  ];
  return daten.map(([kennung, titel, text, ist, soll]) => ({ kennung, titel, text, ist: Math.min(ist, soll), soll, erreicht: ist >= soll }));
}
