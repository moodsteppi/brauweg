/**
 * Aufgaben fuer „10 Sekunden".
 *
 * Einer nennt laut DREI Dinge aus der Aufgabe, bevor die Uhr des Servers
 * ablaeuft; danach urteilt die Runde. `text` steht so auf der Buehne:
 * „Nenne drei: …". Eine Aufgabe taugt nur, wenn sie drei Antworten leicht
 * hergibt, aber nicht im Schlaf — „Farben" waere geschenkt, „Nobelpreis-
 * traeger der Chemie" unmoeglich, beides ist kein Spiel.
 *
 * Seit dem 23.09.2026. Wie die Kataloge der drei ohne Uhr traegt jeder
 * Eintrag ausdruecklich `haerte` und mindestens ein `paket`, und kein Text
 * befiehlt das Trinken — der Schluck kommt aus der Wertung
 * (`test/zeitdruck.test.ts`). Eine eigene Datei und kein Griff in die
 * Kategorien: Dort steht, was fuer VIELE Nennungen reicht (zwoelf Leute, vier
 * Runden um den Tisch), hier, was in zehn Sekunden fuer drei reicht — das
 * sind verschiedene Listen. Neue Eintraege haengen hinten an, Kennungen
 * aendern sich nie.
 */

import type { Inhalt } from './typen.js';

/** Eine Aufgabe fuer „10 Sekunden" — `text` im Plural, ohne „Nenne drei". */
export interface ZehnSekundenAufgabe extends Inhalt {
  readonly text: string;
}

export const ZEHN_SEKUNDEN: readonly ZehnSekundenAufgabe[] = [
  { id: 'z001', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga'], text: 'Automarken' },
  { id: 'z002', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Länder, die mit A anfangen' },
  { id: 'z003', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Gewürze' },
  { id: 'z004', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Disney-Figuren' },
  { id: 'z005', haerte: 1, paket: ['weihnachten', 'wg-abend'], text: 'Dinge, die an einen Weihnachtsbaum gehören' },
  { id: 'z006', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Programme auf einem Computer' },
  { id: 'z007', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Cocktails ohne Alkohol' },
  { id: 'z008', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Dinge, die man im Bad findet' },
  { id: 'z009', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Fußballspieler' },
  { id: 'z010', haerte: 1, paket: ['wg-abend', 'weihnachten', 'jga'], text: 'Märchenfiguren' },
  { id: 'z011', haerte: 1, paket: ['arbeit', 'studenten'], text: 'Dinge auf einem Schreibtisch' },
  { id: 'z012', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Städte am Meer' },
  { id: 'z013', haerte: 1, paket: ['weihnachten', 'wg-abend', 'arbeit'], text: 'Plätzchensorten' },
  { id: 'z014', haerte: 1, paket: ['jga', 'wg-abend', 'weihnachten'], text: 'Liebeslieder' },
  { id: 'z015', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Studienfächer' },
  { id: 'z016', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Dinge, die man in eine Tasche packt' },
  { id: 'z017', haerte: 1, paket: ['wg-abend', 'jga', 'studenten'], text: 'Tiere, die fliegen können' },
  { id: 'z018', haerte: 1, paket: ['weihnachten', 'arbeit', 'wg-abend'], text: 'Dinge, die man im Winter anzieht' },
  { id: 'z019', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Serien auf Streamingdiensten' },
  { id: 'z020', haerte: 1, paket: ['arbeit', 'wg-abend', 'weihnachten'], text: 'Werkzeuge' },
  { id: 'z021', haerte: 1, paket: ['jga', 'wg-abend', 'weihnachten'], text: 'Dinge, die man auf einer Hochzeit sieht' },
  { id: 'z022', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Social-Media-Apps' },
  { id: 'z023', haerte: 1, paket: ['wg-abend', 'weihnachten', 'studenten'], text: 'Käsesorten' },
  { id: 'z024', haerte: 1, paket: ['arbeit', 'studenten', 'jga'], text: 'Dinge, die man in einer Besprechung sagt' },
  { id: 'z025', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Tanzstile' },
  { id: 'z026', haerte: 1, paket: ['weihnachten', 'wg-abend', 'arbeit'], text: 'Geschenke unter zehn Euro' },
  { id: 'z027', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], text: 'Fast-Food-Ketten' },
  { id: 'z028', haerte: 1, paket: ['arbeit', 'studenten', 'weihnachten'], text: 'Berufe mit Uniform' },
  { id: 'z029', haerte: 1, paket: ['wg-abend', 'jga', 'studenten'], text: 'Sänger oder Sängerinnen' },
  { id: 'z030', haerte: 1, paket: ['weihnachten', 'wg-abend', 'jga'], text: 'Rentiere, Engel und andere Weihnachtsfiguren' },
  { id: 'z031', haerte: 1, paket: ['wg-abend', 'arbeit', 'studenten'], text: 'Dinge, die man im Kühlschrank findet' },
  { id: 'z032', haerte: 1, paket: ['jga', 'wg-abend', 'studenten'], text: 'Urlaubsziele' },
  { id: 'z033', haerte: 1, paket: ['arbeit', 'wg-abend', 'weihnachten'], text: 'Dinge, die rund sind' },
  { id: 'z034', haerte: 1, paket: ['studenten', 'jga', 'wg-abend'], text: 'Kinofilme mit Fortsetzung' },
  { id: 'z035', haerte: 1, paket: ['weihnachten', 'arbeit', 'wg-abend'], text: 'Dinge, die man backen kann' },
  { id: 'z036', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Gründe, zu spät zu kommen' },
  { id: 'z037', haerte: 1, paket: ['jga', 'weihnachten', 'wg-abend'], text: 'Brettspiele und Kartenspiele' },
  { id: 'z038', haerte: 1, paket: ['arbeit', 'studenten', 'jga'], text: 'Firmen mit drei Buchstaben' },
  { id: 'z039', haerte: 1, paket: ['wg-abend', 'weihnachten', 'studenten'], text: 'Dinge, die man im Supermarkt vergisst' },
  { id: 'z040', haerte: 1, paket: ['studenten', 'wg-abend', 'arbeit'], text: 'Superhelden' },
  { id: 'z041', haerte: 1, paket: ['jga', 'wg-abend', 'arbeit'], text: 'Sportarten ohne Ball' },
  { id: 'z042', haerte: 1, paket: ['weihnachten', 'jga', 'wg-abend'], text: 'Dinge, die glitzern' },
  { id: 'z043', haerte: 1, paket: ['arbeit', 'wg-abend', 'studenten'], text: 'Obstsorten, die man schälen muss' },
  { id: 'z044', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Emojis' },
  { id: 'z045', haerte: 1, paket: ['weihnachten', 'arbeit', 'jga'], text: 'Dinge, die man verschenken kann' },
  { id: 'z046', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Hauptstädte außerhalb Europas' },
  { id: 'z047', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Dinge, die man auf einer Party findet' },
  { id: 'z048', haerte: 1, paket: ['arbeit', 'weihnachten', 'studenten'], text: 'Dinge, die Strom brauchen' },
  { id: 'z049', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Nudelsorten' },
  { id: 'z050', haerte: 1, paket: ['jga', 'studenten', 'weihnachten'], text: 'Spitznamen für die beste Freundin' },
  { id: 'z051', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Ausreden, warum man nicht zurückgeschrieben hat' },
  { id: 'z052', haerte: 2, paket: ['jga', 'wg-abend'], text: 'Dinge, die beim ersten Date schiefgehen' },
  { id: 'z053', haerte: 2, paket: ['studenten', 'wg-abend'], text: 'Dinge, die man nachts um drei im Kühlschrank sucht' },
  { id: 'z054', haerte: 2, paket: ['arbeit', 'studenten'], text: 'Ausreden fürs Blaumachen' },
  { id: 'z055', haerte: 2, paket: ['jga', 'wg-abend', 'studenten'], text: 'Anmachsprüche, die garantiert scheitern' },
  { id: 'z056', haerte: 2, paket: ['weihnachten', 'arbeit'], text: 'Dinge, die man bei der Weihnachtsfeier bereut' },
  { id: 'z057', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Dinge, die in einer WG-Küche stehen bleiben' },
  { id: 'z058', haerte: 2, paket: ['jga', 'wg-abend'], text: 'Orte für einen heimlichen Kuss' },
  { id: 'z059', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], text: 'Schimpfwörter' },
  { id: 'z060', haerte: 3, paket: ['jga', 'wg-abend'], text: 'Dinge, die man nicht im Browserverlauf haben will' },
  { id: 'z061', haerte: 3, paket: ['jga', 'studenten'], text: 'Dinge, die man im Schlafzimmer besser nicht sagt' },
  { id: 'z062', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Gründe, sich nie wieder zu melden' },
];
