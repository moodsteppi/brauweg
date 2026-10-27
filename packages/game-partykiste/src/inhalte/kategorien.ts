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
 * (`test/ohne-uhr.test.ts`).
 *
 * Grenze (seit dem 27.09.2026, Maßstab ist docs/PARTYKISTE-INHALTE.md):
 * harmlos geht an jedem Tisch, pikant ist Kneipenniveau und die Decke für
 * Gäste, derb ist richtig derb und nur für Konten ab 18 — deutlich sexuell,
 * Drogen, Ekel, Körperliches. Tabu auf jeder Stufe: reale benannte Personen
 * in sexuellen oder herabwürdigenden Zusammenhängen, alles mit
 * Minderjährigen, Gewalt, sexuelle Gewalt und Zwang, Herabwürdigung von
 * Gruppen, Aufforderungen zu Straftaten oder Gefährlichem, Selbstverletzung
 * und Suizid. Im Zweifel die höhere Stufe.
 *
 * Kennungen: Neue Einträge hängen hinten an, mit eins über der höchsten je
 * vergebenen Nummer. Gestrichene Einträge werden gelöscht, ihre Kennung
 * steht in der Liste `…_ENTFERNT` unten und wird nie neu vergeben (warum
 * gestrichen, steht in docs/partykiste-pruefung/). Geprüft von
 * `pruefeKennungen` in schema.ts, im Test.
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
  { id: 'k038', haerte: 1, paket: ['wg-abend', 'jga'], text: 'Schauspielerinnen und Schauspieler' },
  { id: 'k039', haerte: 1, paket: ['wg-abend', 'studenten'], text: 'Nudelsorten' },
  { id: 'k040', haerte: 1, paket: ['wg-abend', 'jga'], text: 'Hunderassen' },
  { id: 'k041', haerte: 1, paket: ['arbeit', 'studenten'], text: 'Olympische Sportarten' },
  { id: 'k042', haerte: 1, paket: ['wg-abend', 'weihnachten', 'arbeit'], text: 'Dinge, die rund sind' },
  { id: 'k043', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'weihnachten'], text: 'Wörter, die mit „Sch" anfangen' },
  { id: 'k045', haerte: 1, paket: ['weihnachten'], text: 'Geschenke unterm Weihnachtsbaum' },
  { id: 'k046', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Kinderspiele von früher' },
  { id: 'k047', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Ausreden fürs Zuspätkommen' },
  { id: 'k048', haerte: 1, paket: ['studenten'], text: 'Studiengänge' },
  { id: 'k049', haerte: 1, paket: ['wg-abend', 'studenten'], text: 'Dinge im WG-Kühlschrank, die niemandem gehören' },
  { id: 'k051', haerte: 1, paket: ['jga'], text: 'Reiseziele für die Flitterwochen' },
  { id: 'k052', haerte: 1, paket: ['arbeit'], text: 'Floskeln aus Meetings' },
  { id: 'k053', haerte: 1, paket: ['arbeit'], text: 'Abkürzungen aus dem Büro' },
  { id: 'k054', haerte: 1, paket: ['studenten'], text: 'Gerichte aus der Mensa' },
  { id: 'k056', haerte: 1, paket: ['wg-abend', 'jga', 'arbeit'], text: 'Inseln' },
  { id: 'k057', haerte: 1, paket: ['jga', 'wg-abend'], text: 'Tanzstile' },
  { id: 'k059', haerte: 1, paket: ['weihnachten'], text: 'Dinge vom Weihnachtsmarkt' },
  { id: 'k060', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], text: 'Emojis' },
  { id: 'k061', haerte: 1, paket: ['weihnachten', 'wg-abend', 'arbeit'], text: 'Dinge aus Holz' },
  { id: 'k063', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Serien zum Streamen' },
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
  { id: 'k077', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Schimpfwörter, die man im Auto brüllt' },
  { id: 'k078', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], text: 'Wörter für Sex' },
  { id: 'k079', haerte: 3, paket: ['jga', 'wg-abend'], text: 'Dinge, die im Schlafzimmer schiefgehen können' },
  { id: 'k080', haerte: 3, paket: ['jga', 'wg-abend'], text: 'Orte, an denen man Sex haben könnte' },
  { id: 'k081', haerte: 3, paket: ['jga', 'studenten'], text: 'Wörter für Penis' },
  { id: 'k082', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Peinliche Krankheiten' },
  { id: 'k083', haerte: 1, paket: ['wg-abend', 'weihnachten', 'studenten'], text: 'Eissorten' },
  { id: 'k084', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], text: 'YouTuber und Influencer' },
  { id: 'k085', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Dinge, die stinken' },
  { id: 'k086', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], text: 'Dinge, die man auf ein Festival mitnimmt' },
  { id: 'k087', haerte: 1, paket: ['arbeit', 'weihnachten', 'wg-abend'], text: 'Berühmte Deutsche' },
  { id: 'k088', haerte: 1, paket: ['arbeit', 'wg-abend', 'weihnachten'], text: 'Dinge mit Rädern' },
  { id: 'k089', haerte: 1, paket: ['arbeit', 'weihnachten', 'wg-abend'], text: 'Marken aus dem Supermarkt' },
  { id: 'k090', haerte: 1, paket: ['arbeit', 'jga', 'wg-abend'], text: 'Dinge in einem Hotelzimmer' },
  { id: 'k091', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Cocktails' },
  { id: 'k092', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Schnäpse und Liköre' },
  { id: 'k093', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Biermarken' },
  { id: 'k094', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Trinkspiele' },
  { id: 'k095', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für betrunken' },
  { id: 'k096', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ballermann-Hits und Partyschlager' },
  { id: 'k097', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Dinge, die man betrunken online bestellt' },
  { id: 'k098', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Gründe für eine Trennung' },
  { id: 'k099', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Red Flags beim Date' },
  { id: 'k100', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man nach dem Feiern im Handy findet' },
  { id: 'k101', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Dinge, die man dem Ex gern sagen würde' },
  { id: 'k102', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Sätze aus Dating-Profilen' },
  { id: 'k103', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man beim ersten Date nie sagen sollte' },
  { id: 'k104', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Orte, an denen man jemanden kennenlernt' },
  { id: 'k105', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Lieder zum Knutschen' },
  { id: 'k106', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Gründe, warum die Party eskaliert ist' },
  { id: 'k107', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden, warum man nicht ans Handy geht' },
  { id: 'k108', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Dinge, die man heimlich googelt' },
  { id: 'k109', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man im Urlaub macht, aber zu Hause nie' },
  { id: 'k110', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Typen, die man im Club trifft' },
  { id: 'k111', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Gründe für eine Nachricht um drei Uhr nachts' },
  { id: 'k112', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man am Morgen danach sucht' },
  { id: 'k113', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Spitznamen für den Ex' },
  { id: 'k114', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man beim Flirten macht' },
  { id: 'k115', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Peinliche Tattoo-Motive' },
  { id: 'k116', haerte: 2, paket: ['jga'], text: 'Programmpunkte auf einem Junggesellenabschied' },
  { id: 'k117', haerte: 2, paket: ['wg-abend', 'jga', 'arbeit'], text: 'Dinge, die man in der Sauna nicht tun sollte' },
  { id: 'k118', haerte: 2, paket: ['jga', 'wg-abend', 'weihnachten'], text: 'Dinge, die man vor den Eltern des Partners nicht sagt' },
  { id: 'k119', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Promi-Paare, die sich getrennt haben' },
  { id: 'k120', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Gründe für einen Walk of Shame' },
  { id: 'k121', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man für einen Schwarm tun würde' },
  { id: 'k122', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Dinge, die man nach Mitternacht isst' },
  { id: 'k123', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Lügen beim ersten Date' },
  { id: 'k124', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Dinge, die man heimlich macht, wenn man allein zu Hause ist' },
  { id: 'k125', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Dinge in der Nachttischschublade' },
  { id: 'k126', haerte: 2, paket: ['wg-abend', 'jga'], text: 'Dinge, die in einer Beziehung nerven' },
  { id: 'k127', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden, um ein Date abzusagen' },
  { id: 'k128', haerte: 2, paket: ['wg-abend', 'studenten', 'weihnachten'], text: 'Filme, die man nicht mit den Eltern schauen will' },
  { id: 'k129', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Arten, jemandem einen Korb zu geben' },
  { id: 'k130', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man betrunken sagt' },
  { id: 'k131', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], text: 'Dinge, die man mit 18 zum ersten Mal gemacht hat' },
  { id: 'k132', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für Brüste' },
  { id: 'k133', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für Vagina' },
  { id: 'k134', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für den Hintern' },
  { id: 'k135', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für Selbstbefriedigung' },
  { id: 'k136', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wörter für Kotzen' },
  { id: 'k137', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Wörter für Furzen' },
  { id: 'k138', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Sexstellungen' },
  { id: 'k139', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die man im Sexshop kaufen kann' },
  { id: 'k140', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Fetische' },
  { id: 'k141', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Ausreden nach schlechtem Sex' },
  { id: 'k142', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Sexspielzeuge, die es noch nicht gibt' },
  { id: 'k143', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Dinge, die man bekifft tut' },
  { id: 'k144', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Ekelhafte Dinge in einer WG' },
  { id: 'k145', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Pornoversionen von Filmtiteln' },
  { id: 'k146', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Gründe für einen One-Night-Stand' },
  { id: 'k147', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die man nackt machen kann' },
  { id: 'k148', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die man im Swingerclub sieht' },
  { id: 'k149', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Unpassende Orte für ein Nacktfoto' },
  { id: 'k150', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die man mit Schlagsahne im Bett machen kann' },
  { id: 'k151', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die man beim Sex heimlich denkt' },
  { id: 'k152', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Sätze für Dirty Talk' },
  { id: 'k153', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Erfundene Pornonamen' },
  { id: 'k154', haerte: 3, paket: ['wg-abend', 'jga'], text: 'Dinge, die man nach dem Sex tut' },
  { id: 'k155', haerte: 3, paket: ['wg-abend', 'studenten', 'jga'], text: 'Versaute Anmachsprüche' },
];

/**
 * Gestrichene Kennungen — nie neu vergeben. Seit der Prüfung vom 27.09.2026;
 * die Gründe stehen in docs/partykiste-pruefung/kategorien.json.
 */
export const KATEGORIEN_ENTFERNT: readonly string[] = ['k012', 'k037', 'k044', 'k050', 'k055', 'k058', 'k062', 'k064'];
