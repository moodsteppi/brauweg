/**
 * Kategorien für das Kategorien-Battle.
 *
 * Reihum nennt jeder laut etwas aus der Kategorie; wer stockt oder etwas
 * doppelt nennt, hat verloren. Eine Kategorie taugt nur, wenn sie für einen
 * vollen Tisch (zwölf Leute, mehrere Runden um den Tisch) genug hergibt —
 * „Bundesländer" wäre nach sechzehn Nennungen tot, und dann verliert nicht
 * der Langsamste, sondern der Sechzehnte.
 *
 * Seit dem 22.09.2026. Jeder Eintrag trägt ausdrücklich `haerte` und
 * mindestens ein `paket` (Robins Vorgabe für die neuen Minispiele). Kein Text
 * befiehlt das Trinken — der Schluck kommt aus der Wertung
 * (`test/ohne-uhr.test.ts`). Neue Einträge hängen hinten an, Kennungen
 * ändern sich nie.
 */

import type { Inhalt } from './typen.js';

/** Eine Kategorie — `text` steht so auf der Bühne: „Nennt reihum: …". */
export interface Kategorie extends Inhalt {
  readonly text: string;
}

export const KATEGORIEN: readonly Kategorie[] = [
  { id: 'k001', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga'], text: 'Automarken' },
  { id: 'k002', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Hauptstädte Europas' },
  { id: 'k003', haerte: 1, paket: ['wg-abend', 'arbeit', 'weihnachten'], text: 'Obstsorten' },
  { id: 'k004', haerte: 1, paket: ['wg-abend', 'arbeit'], text: 'Gemüsesorten' },
  { id: 'k005', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Tiere mit vier Beinen' },
  { id: 'k006', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Fußballvereine' },
  { id: 'k007', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Disney-Filme' },
  { id: 'k008', haerte: 1, paket: ['wg-abend', 'studenten'], text: 'Pizzabeläge' },
  { id: 'k009', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Brettspiele' },
  { id: 'k010', haerte: 1, paket: ['wg-abend', 'arbeit', 'weihnachten'], text: 'Musikinstrumente' },
  { id: 'k011', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Sportarten mit Ball' },
  { id: 'k012', haerte: 1, paket: ['studenten', 'arbeit'], text: 'Länder in Afrika' },
  { id: 'k013', haerte: 1, paket: ['weihnachten'], text: 'Weihnachtslieder' },
  { id: 'k014', haerte: 1, paket: ['wg-abend', 'weihnachten'], text: 'Dinge, die man in der Küche findet' },
  { id: 'k015', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Berufe' },
  { id: 'k016', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Farben' },
  { id: 'k017', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Superhelden und Bösewichte' },
  { id: 'k018', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], text: 'Fast-Food-Ketten' },
  { id: 'k019', haerte: 1, paket: ['wg-abend', 'weihnachten'], text: 'Käsesorten' },
  { id: 'k020', haerte: 1, paket: ['arbeit', 'studenten'], text: 'Apps auf dem Handy' },
  { id: 'k021', haerte: 1, paket: ['wg-abend', 'arbeit', 'weihnachten', 'studenten'], text: 'Städte in Deutschland' },
  { id: 'k022', haerte: 1, paket: ['wg-abend', 'weihnachten'], text: 'Vogelarten' },
  { id: 'k023', haerte: 1, paket: ['wg-abend', 'weihnachten', 'studenten'], text: 'Süßigkeiten' },
  { id: 'k024', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Zeichentrickserien' },
  { id: 'k025', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Bands und Musiker' },
  { id: 'k026', haerte: 1, paket: ['arbeit'], text: 'Dinge im Büro' },
  { id: 'k027', haerte: 1, paket: ['wg-abend', 'weihnachten'], text: 'Gewürze' },
  { id: 'k028', haerte: 1, paket: ['arbeit', 'weihnachten', 'wg-abend'], text: 'Getränke ohne Alkohol' },
  { id: 'k029', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Kleidungsstücke' },
  { id: 'k030', haerte: 1, paket: ['studenten', 'arbeit'], text: 'Flüsse' },
  { id: 'k031', haerte: 1, paket: ['wg-abend', 'arbeit'], text: 'Werkzeuge' },
  { id: 'k032', haerte: 1, paket: ['wg-abend', 'jga', 'arbeit'], text: 'Dinge, die man in den Urlaub mitnimmt' },
  { id: 'k033', haerte: 1, paket: ['wg-abend', 'weihnachten', 'jga'], text: 'Märchenfiguren' },
  { id: 'k034', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Harry-Potter-Figuren' },
  { id: 'k035', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Videospiele' },
  { id: 'k036', haerte: 1, paket: ['weihnachten', 'wg-abend'], text: 'Baumarten' },
  { id: 'k037', haerte: 1, paket: ['arbeit', 'studenten'], text: 'Automodelle' },
  { id: 'k038', haerte: 1, paket: ['wg-abend', 'jga'], text: 'Schauspielerinnen und Schauspieler' },
  { id: 'k039', haerte: 1, paket: ['wg-abend', 'studenten'], text: 'Nudelsorten' },
  { id: 'k040', haerte: 1, paket: ['wg-abend', 'jga'], text: 'Hunderassen' },
  { id: 'k041', haerte: 1, paket: ['arbeit', 'studenten'], text: 'Olympische Sportarten' },
  { id: 'k042', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Dinge, die rund sind' },
  { id: 'k043', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'weihnachten'], text: 'Wörter, die mit „Sch" anfangen' },
  { id: 'k044', haerte: 1, paket: ['weihnachten'], text: 'Plätzchensorten' },
  { id: 'k045', haerte: 1, paket: ['weihnachten'], text: 'Geschenke unterm Weihnachtsbaum' },
  { id: 'k046', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Kinderspiele von früher' },
  { id: 'k047', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Ausreden fürs Zuspätkommen' },
  { id: 'k048', haerte: 1, paket: ['studenten'], text: 'Studiengänge' },
  { id: 'k049', haerte: 1, paket: ['wg-abend', 'studenten'], text: 'Dinge im WG-Kühlschrank, die niemandem gehören' },
  { id: 'k050', haerte: 1, paket: ['jga'], text: 'Hochzeitsbräuche' },
  { id: 'k051', haerte: 1, paket: ['jga'], text: 'Reiseziele für die Flitterwochen' },
  { id: 'k052', haerte: 1, paket: ['arbeit'], text: 'Floskeln aus Meetings' },
  { id: 'k053', haerte: 1, paket: ['arbeit'], text: 'Abkürzungen aus dem Büro' },
  { id: 'k054', haerte: 1, paket: ['studenten'], text: 'Gerichte aus der Mensa' },
  { id: 'k055', haerte: 1, paket: ['wg-abend', 'jga'], text: 'Sternzeichen und Horoskop-Wörter' },
  { id: 'k056', haerte: 1, paket: ['wg-abend', 'jga', 'arbeit'], text: 'Inseln' },
  { id: 'k057', haerte: 1, paket: ['jga', 'wg-abend'], text: 'Tanzstile' },
  { id: 'k058', haerte: 1, paket: ['weihnachten'], text: 'Figuren aus Weihnachtsfilmen' },
  { id: 'k059', haerte: 1, paket: ['weihnachten'], text: 'Dinge vom Weihnachtsmarkt' },
  { id: 'k060', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], text: 'Emojis' },
  { id: 'k061', haerte: 1, paket: ['weihnachten', 'wg-abend', 'arbeit'], text: 'Dinge aus Holz' },
  { id: 'k062', haerte: 1, paket: ['weihnachten', 'wg-abend'], text: 'Süßigkeiten aus der Kindheit' },
  { id: 'k063', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Serien zum Streamen' },
  { id: 'k064', haerte: 1, paket: ['studenten', 'wg-abend', 'arbeit', 'weihnachten'], text: 'Wörter, die sich auf „Haus" reimen' },
  { id: 'k065', haerte: 1, paket: ['studenten'], text: 'Ausreden für eine verpasste Abgabe' },
  { id: 'k066', haerte: 1, paket: ['wg-abend', 'arbeit'], text: 'Dinge, die man im Supermarkt vergisst' },
  { id: 'k067', haerte: 2, paket: ['jga', 'wg-abend', 'studenten'], text: 'Anmachsprüche' },
  { id: 'k068', haerte: 2, paket: ['jga', 'wg-abend'], text: 'Orte für ein erstes Date' },
  { id: 'k069', haerte: 2, paket: ['jga'], text: 'Peinliche Momente auf Hochzeiten' },
  { id: 'k070', haerte: 2, paket: ['arbeit', 'studenten'], text: 'Ausreden fürs Blaumachen' },
  { id: 'k071', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Dinge, die man nach einer Trennung tut' },
  { id: 'k072', haerte: 2, paket: ['arbeit'], text: 'Dinge, die man über den Chef denkt, aber nie sagt' },
  { id: 'k073', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Nachrichten, die man nie in die falsche Gruppe schicken will' },
  { id: 'k074', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Gründe, warum man Single ist' },
  { id: 'k075', haerte: 2, paket: ['jga', 'wg-abend'], text: 'Kosenamen für den Partner' },
  { id: 'k076', haerte: 2, paket: ['jga', 'wg-abend'], text: 'Dinge, die man nackt besser nicht tut' },
  { id: 'k077', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Schimpfwörter' },
  { id: 'k078', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], text: 'Wörter für Sex' },
  { id: 'k079', haerte: 3, paket: ['jga', 'wg-abend'], text: 'Dinge, die im Schlafzimmer schiefgehen können' },
  { id: 'k080', haerte: 3, paket: ['jga', 'wg-abend'], text: 'Orte, an denen man Sex haben könnte' },
  { id: 'k081', haerte: 3, paket: ['jga', 'studenten'], text: 'Körperteile, die man besser nicht fotografiert' },
  { id: 'k082', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Peinliche Krankheiten' },
];
