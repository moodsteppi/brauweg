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
 * sind verschiedene Listen.
 *
 * Grenze (seit dem 27.09.2026, Massstab ist docs/PARTYKISTE-INHALTE.md):
 * harmlos geht an jedem Tisch, pikant ist Kneipenniveau und die Decke fuer
 * Gaeste, derb ist richtig derb und nur fuer Konten ab 18 — deutlich sexuell,
 * Drogen, Ekel, Koerperliches. Tabu auf jeder Stufe: reale benannte Personen
 * in sexuellen oder herabwuerdigenden Zusammenhaengen, alles mit
 * Minderjaehrigen, Gewalt, sexuelle Gewalt und Zwang, Herabwuerdigung von
 * Gruppen, Aufforderungen zu Straftaten oder Gefaehrlichem, Selbstverletzung
 * und Suizid. Im Zweifel die hoehere Stufe.
 *
 * Kennungen: Neue Eintraege haengen hinten an, mit eins ueber der hoechsten
 * je vergebenen Nummer. Gestrichene Eintraege werden geloescht, ihre Kennung
 * steht in der Liste `…_ENTFERNT` unten und wird nie neu vergeben (warum
 * gestrichen, steht in docs/partykiste-pruefung/). Geprueft von
 * `pruefeKennungen` in schema.ts, im Test.
 */

import type { Inhalt } from './typen.js';

/** Eine Aufgabe fuer „10 Sekunden" — `text` im Plural, ohne „Nenne drei". */
export interface ZehnSekundenAufgabe extends Inhalt {
  readonly text: string;
}

export const ZEHN_SEKUNDEN: readonly ZehnSekundenAufgabe[] = [
  { id: 'z001', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga'], text: 'Automarken aus Italien' },
  { id: 'z002', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Länder, die mit A anfangen' },
  { id: 'z003', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Gewürze' },
  { id: 'z004', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Disney-Bösewichte' },
  { id: 'z005', haerte: 1, paket: ['weihnachten', 'wg-abend'], text: 'Dinge, die an einen Weihnachtsbaum gehören' },
  { id: 'z006', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Programme auf einem Computer' },
  { id: 'z007', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Cocktails ohne Alkohol' },
  { id: 'z009', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Fußballspieler' },
  { id: 'z010', haerte: 1, paket: ['wg-abend', 'weihnachten', 'jga'], text: 'Märchenfiguren' },
  { id: 'z012', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Städte am Meer' },
  { id: 'z013', haerte: 1, paket: ['weihnachten', 'wg-abend', 'arbeit'], text: 'Plätzchensorten' },
  { id: 'z014', haerte: 1, paket: ['jga', 'wg-abend', 'weihnachten'], text: 'Liebeslieder' },
  { id: 'z015', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Studienfächer' },
  { id: 'z017', haerte: 1, paket: ['wg-abend', 'jga', 'studenten'], text: 'Tiere, die fliegen können, aber keine Vögel sind' },
  { id: 'z020', haerte: 1, paket: ['arbeit', 'wg-abend', 'weihnachten'], text: 'Werkzeuge' },
  { id: 'z021', haerte: 1, paket: ['jga', 'wg-abend', 'weihnachten'], text: 'Dinge, die man auf einer Hochzeit sieht' },
  { id: 'z023', haerte: 1, paket: ['wg-abend', 'weihnachten', 'studenten'], text: 'Käsesorten' },
  { id: 'z024', haerte: 1, paket: ['arbeit', 'studenten', 'jga'], text: 'Dinge, die man in einer Besprechung sagt' },
  { id: 'z025', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Tanzstile' },
  { id: 'z026', haerte: 1, paket: ['weihnachten', 'wg-abend', 'arbeit'], text: 'Geschenke unter zehn Euro' },
  { id: 'z028', haerte: 1, paket: ['arbeit', 'studenten', 'weihnachten'], text: 'Berufe mit Uniform' },
  { id: 'z029', haerte: 1, paket: ['wg-abend', 'jga', 'studenten'], text: 'Sängerinnen oder Sänger, die schon gestorben sind' },
  { id: 'z030', haerte: 1, paket: ['weihnachten', 'wg-abend', 'jga'], text: 'Rentiere, Engel und andere Weihnachtsfiguren' },
  { id: 'z032', haerte: 1, paket: ['jga', 'wg-abend', 'studenten'], text: 'Urlaubsziele in Asien' },
  { id: 'z034', haerte: 1, paket: ['studenten', 'jga', 'wg-abend'], text: 'Kinofilme mit Fortsetzung' },
  { id: 'z035', haerte: 1, paket: ['weihnachten', 'arbeit', 'wg-abend'], text: 'Dinge, die man backen kann' },
  { id: 'z036', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Gründe, zu spät zu kommen' },
  { id: 'z037', haerte: 1, paket: ['jga', 'weihnachten', 'wg-abend'], text: 'Brettspiele und Kartenspiele' },
  { id: 'z038', haerte: 1, paket: ['arbeit', 'studenten', 'jga'], text: 'Firmen mit drei Buchstaben' },
  { id: 'z039', haerte: 1, paket: ['wg-abend', 'weihnachten', 'studenten'], text: 'Dinge, die man im Supermarkt vergisst' },
  { id: 'z040', haerte: 1, paket: ['studenten', 'wg-abend', 'arbeit'], text: 'Superhelden ohne Superkräfte' },
  { id: 'z041', haerte: 1, paket: ['jga', 'wg-abend', 'arbeit'], text: 'Sportarten ohne Ball' },
  { id: 'z042', haerte: 1, paket: ['weihnachten', 'jga', 'wg-abend'], text: 'Dinge, die glitzern' },
  { id: 'z043', haerte: 1, paket: ['arbeit', 'wg-abend', 'studenten'], text: 'Obstsorten, die man schälen muss' },
  { id: 'z046', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Hauptstädte außerhalb Europas' },
  { id: 'z047', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Dinge, die man auf einer Party findet' },
  { id: 'z049', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Nudelsorten' },
  { id: 'z051', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Ausreden, warum man nicht zurückgeschrieben hat' },
  { id: 'z052', haerte: 2, paket: ['jga', 'wg-abend'], text: 'Dinge, die beim ersten Date schiefgehen' },
  { id: 'z053', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Dinge, die man nachts um drei im Kühlschrank sucht' },
  { id: 'z054', haerte: 2, paket: ['arbeit', 'studenten'], text: 'Ausreden fürs Blaumachen' },
  { id: 'z055', haerte: 2, paket: ['jga', 'wg-abend', 'studenten'], text: 'Anmachsprüche, die garantiert scheitern' },
  { id: 'z056', haerte: 2, paket: ['weihnachten', 'arbeit'], text: 'Dinge, die man bei der Weihnachtsfeier bereut' },
  { id: 'z057', haerte: 1, paket: ['wg-abend', 'studenten'], text: 'Dinge, die in einer WG-Küche stehen bleiben' },
  { id: 'z058', haerte: 2, paket: ['jga', 'wg-abend'], text: 'Orte für einen heimlichen Kuss' },
  { id: 'z060', haerte: 3, paket: ['jga', 'wg-abend'], text: 'Dinge, die man nicht im Browserverlauf haben will' },
  { id: 'z061', haerte: 3, paket: ['jga', 'studenten'], text: 'Dinge, die man im Schlafzimmer besser nicht sagt' },
  { id: 'z062', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Gründe, sich nie wieder zu melden' },
  { id: 'z063', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man im Flugzeug nicht darf' },
  { id: 'z064', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Hauptstädte in Südamerika' },
  { id: 'z065', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Filme mit Tom Hanks' },
  { id: 'z066', haerte: 1, paket: ['wg-abend', 'arbeit', 'weihnachten'], text: 'Tiere mit Streifen' },
  { id: 'z067', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Gemüse, das unter der Erde wächst' },
  { id: 'z068', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Wörter, die mit Q anfangen' },
  { id: 'z069', haerte: 1, paket: ['studenten', 'arbeit', 'jga'], text: 'Länder mit nur vier Buchstaben' },
  { id: 'z070', haerte: 1, paket: ['wg-abend', 'arbeit', 'jga'], text: 'Sportarten mit Schläger' },
  { id: 'z071', haerte: 1, paket: ['weihnachten', 'arbeit', 'wg-abend'], text: 'Dinge, die man nur einmal im Jahr benutzt' },
  { id: 'z072', haerte: 1, paket: ['weihnachten', 'arbeit', 'jga'], text: 'Instrumente mit Saiten' },
  { id: 'z073', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], text: 'Figuren aus den Simpsons' },
  { id: 'z074', haerte: 1, paket: ['arbeit', 'jga', 'weihnachten'], text: 'Berühmte Bauwerke' },
  { id: 'z075', haerte: 1, paket: ['wg-abend', 'studenten', 'weihnachten'], text: 'Tiere im Wasser, die keine Fische sind' },
  { id: 'z076', haerte: 1, paket: ['arbeit', 'studenten', 'jga'], text: 'Marken mit einem Tier im Logo' },
  { id: 'z077', haerte: 1, paket: ['jga', 'weihnachten', 'studenten'], text: 'Städte in Italien' },
  { id: 'z078', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Cocktails mit Rum' },
  { id: 'z079', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Biersorten, die kein Pils sind' },
  { id: 'z080', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Schnäpse, die man nur auf Partys bestellt' },
  { id: 'z081', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Getränke, die man mit Cola mischt' },
  { id: 'z082', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden, warum man noch nicht nach Hause will' },
  { id: 'z083', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Leute, denen man betrunken schreibt' },
  { id: 'z084', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Green Flags beim ersten Date' },
  { id: 'z085', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Dinge, die man auf einer Hausparty kaputt macht' },
  { id: 'z086', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Sätze, die man dem Ex nie schreiben sollte' },
  { id: 'z087', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden, um ein Date früher zu verlassen' },
  { id: 'z088', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man beim ersten Date bestellt' },
  { id: 'z089', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Lieder, bei denen man betrunken mitgrölt' },
  { id: 'z090', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Anzeichen, dass jemand mit dir flirtet' },
  { id: 'z091', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Ausreden, um nicht zur Hochzeit vom Ex zu gehen' },
  { id: 'z092', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Fragen, die die beste Freundin nach dem Date stellt' },
  { id: 'z093', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man vor einem Date im Bad erledigt' },
  { id: 'z094', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man im Taxi nach Hause macht' },
  { id: 'z095', haerte: 2, paket: ['jga'], text: 'Dinge, die man auf einem JGA tragen muss' },
  { id: 'z096', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Promi-Paare, die noch zusammen sind' },
  { id: 'z097', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Stellen für ein heimliches Tattoo' },
  { id: 'z098', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Dinge, die Paare auf Instagram posten' },
  { id: 'z099', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man tut, wenn der Schwarm den Raum betritt' },
  { id: 'z100', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die im Urlaub mit Freunden schiefgehen' },
  { id: 'z101', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man betrunken für eine gute Idee hält' },
  { id: 'z102', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Hausmittel gegen einen Kater' },
  { id: 'z103', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man auf Mallorca erlebt' },
  { id: 'z104', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man im Club verliert' },
  { id: 'z105', haerte: 2, paket: ['jga', 'wg-abend', 'weihnachten'], text: 'Leute, die man auf jeder Hochzeit trifft' },
  { id: 'z106', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Anmachsprüche für den Supermarkt' },
  { id: 'z107', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Dinge, die man nach drei Jahren Beziehung nicht mehr macht' },
  { id: 'z108', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Dinge, die man vom Ex behalten hat' },
  { id: 'z109', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Dinge, die man im Inkognito-Modus sucht' },
  { id: 'z110', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Gründe, dem Ex doch zu schreiben' },
  { id: 'z111', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Komplimente, die falsch ankommen' },
  { id: 'z112', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man nach dem ersten Kuss sagt' },
  { id: 'z113', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden für einen Knutschfleck' },
  { id: 'z114', haerte: 2, paket: ['jga'], text: 'Dinge, die man auf einer Hochzeit heimlich tut' },
  { id: 'z115', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Emojis, die man zum Flirten schickt' },
  { id: 'z116', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Orte, an denen man den Ex nicht treffen will' },
  { id: 'z117', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Fragen, die man bei einem Blind Date stellt' },
  { id: 'z118', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Getränke an einer Strandbar' },
  { id: 'z119', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Dinge, die man am FKK-Strand sieht' },
  { id: 'z120', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Dinge, die man um vier Uhr morgens isst' },
  { id: 'z121', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für Sperma' },
  { id: 'z122', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für Hoden' },
  { id: 'z123', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für Kondom' },
  { id: 'z124', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für Sex, die deine Oma sagen würde' },
  { id: 'z125', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Geschlechtskrankheiten' },
  { id: 'z126', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die beim Sex Geräusche machen' },
  { id: 'z127', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden, um keinen Sex zu haben' },
  { id: 'z128', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die im Porno unrealistisch sind' },
  { id: 'z129', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Berufe, die im Porno ständig vorkommen' },
  { id: 'z130', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Pornokategorien' },
  { id: 'z131', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Emojis mit versauter Bedeutung' },
  { id: 'z132', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Obst und Gemüse, das versaut aussieht' },
  { id: 'z133', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Körperteile, die man ablecken kann' },
  { id: 'z134', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man nicht in seiner Unterhose finden will' },
  { id: 'z135', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Ekelhafte Dinge auf einem Club-Klo' },
  { id: 'z136', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden für Flecken auf dem Laken' },
  { id: 'z137', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Kondom-Geschmacksrichtungen' },
  { id: 'z138', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man mit einem Kondom machen kann, außer Sex' },
  { id: 'z139', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Gründe, warum man kotzen musste' },
  { id: 'z140', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ekelhafte Angewohnheiten' },
  { id: 'z141', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Stellen, an denen ungewollt Haare wachsen' },
  { id: 'z142', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Körperstellen, die schnell stinken' },
  { id: 'z143', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Körperflüssigkeiten' },
  { id: 'z144', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die ein Proktologe sieht' },
  { id: 'z145', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Geräusche, die man auf dem Klo hört' },
  { id: 'z146', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die man mit Gleitgel machen kann' },
  { id: 'z147', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Haushaltsgegenstände, die man im Bett zweckentfremden kann' },
  { id: 'z148', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die man in einem Stundenhotel findet' },
  { id: 'z149', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die bei einem Dreier schiefgehen' },
  { id: 'z150', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die beim Sex im Auto schiefgehen' },
  { id: 'z151', haerte: 3, paket: ['wg-abend', 'arbeit'], text: 'Orte im Büro für einen Quickie' },
  { id: 'z152', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man nicht im Handy der Eltern finden will' },
  { id: 'z153', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden, wenn die Eltern reinplatzen' },
  { id: 'z154', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man lieber nicht auf dem Sofa der Eltern tut' },
  { id: 'z155', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Ausreden, wenn die Mitbewohner einen gehört haben' },
  { id: 'z156', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden, warum das Bett quietscht' },
  { id: 'z157', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die nach einer Party im Bett liegen' },
  { id: 'z158', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Gründe, warum der Sex nur zwei Minuten gedauert hat' },
  { id: 'z159', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man nie nüchtern tun würde' },
  { id: 'z160', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man nach einem One-Night-Stand vergisst' },
  { id: 'z161', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Nachrichten, die man nach einem One-Night-Stand bekommt' },
  { id: 'z162', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Gründe, im Club-Klo zu verschwinden' },
  { id: 'z163', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man lieber nicht beim Frauenarzt sagt' },
  { id: 'z164', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Gerüche am Morgen nach einer Party' },
  { id: 'z165', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man lieber nicht im Whirlpool findet' },
  { id: 'z166', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die auf einer Swingerparty auf dem Buffet stehen' },
  { id: 'z167', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Gründe, nackt vor der Tür zu stehen' },
  { id: 'z168', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die beim Pinkeln schiefgehen' },
];

/**
 * Gestrichene Kennungen — nie neu vergeben. Seit der Pruefung vom 27.09.2026;
 * die Gruende stehen in docs/partykiste-pruefung/zehnsekunden.json.
 */
export const ZEHN_SEKUNDEN_ENTFERNT: readonly string[] = ['z008', 'z011', 'z016', 'z018', 'z019', 'z022', 'z027', 'z031', 'z033', 'z044', 'z045', 'z048', 'z050', 'z059'];
