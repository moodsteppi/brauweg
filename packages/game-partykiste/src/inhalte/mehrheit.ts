/**
 * Fragen für das Mehrheitsraten.
 *
 * Jeder beantwortet die Frage für sich (A oder B) UND tippt, was die Mehrheit
 * am Tisch antwortet. Gewertet wird nur der Tipp. Eine Frage taugt deshalb
 * nur, wenn beide Seiten ernsthaft gewählt werden — bei „Lieber gesund oder
 * krank?" weiß jeder die Mehrheit, und die Runde ist geschenkt.
 *
 * Anders als beim Entweder-oder steht hier eine ganze FRAGE auf der Bühne,
 * nicht nur zwei Stichworte: Wer die Mehrheit raten soll, muss wissen, wie
 * genau die Frage lautet. `a` und `b` sind die Beschriftungen der Knöpfe.
 *
 * Seit dem 22.09.2026, jeder Eintrag mit `haerte` und mindestens einem
 * `paket`. Kein Text befiehlt das Trinken.
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

export interface Mehrheitsfrage extends Inhalt {
  readonly frage: string;
  readonly a: string;
  readonly b: string;
}

export const MEHRHEITSFRAGEN: readonly Mehrheitsfrage[] = [
  { id: 'm001', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], frage: 'Lieber ein Jahr ohne Handy oder ein Jahr ohne Urlaub?', a: 'Ohne Handy', b: 'Ohne Urlaub' },
  { id: 'm002', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], frage: 'Ananas auf der Pizza?', a: 'Ja, gern', b: 'Niemals' },
  { id: 'm003', haerte: 1, paket: ['arbeit', 'wg-abend', 'jga'], frage: 'Am Flughafen lieber zwei Stunden zu früh oder knapp auf den letzten Drücker?', a: 'Zu früh', b: 'Knapp' },
  { id: 'm004', haerte: 1, paket: ['wg-abend', 'studenten'], frage: 'Socken im Bett?', a: 'Ja', b: 'Nein' },
  { id: 'm005', haerte: 1, paket: ['wg-abend', 'studenten', 'jga', 'weihnachten'], frage: 'Lieber fliegen können oder unsichtbar sein?', a: 'Fliegen', b: 'Unsichtbar' },
  { id: 'm006', haerte: 1, paket: ['wg-abend', 'studenten'], frage: 'Klopapier: das Blatt hängt vorne oder hinten?', a: 'Vorne', b: 'Hinten' },
  { id: 'm007', haerte: 1, paket: ['weihnachten'], frage: 'Weihnachten lieber am Strand oder im Schnee?', a: 'Strand', b: 'Schnee' },
  { id: 'm008', haerte: 1, paket: ['weihnachten'], frage: 'Bescherung am 24. abends oder am 25. morgens?', a: 'Am 24.', b: 'Am 25.' },
  { id: 'm009', haerte: 1, paket: ['weihnachten'], frage: 'Weihnachtsbaum echt oder künstlich?', a: 'Echt', b: 'Künstlich' },
  { id: 'm010', haerte: 1, paket: ['weihnachten'], frage: 'Lieber Plätzchen backen oder Geschenke einpacken?', a: 'Backen', b: 'Einpacken' },
  { id: 'm011', haerte: 1, paket: ['arbeit'], frage: 'Lieber Homeoffice oder Büro?', a: 'Homeoffice', b: 'Büro' },
  { id: 'm012', haerte: 1, paket: ['arbeit'], frage: 'Lieber vier lange oder fünf kurze Arbeitstage?', a: 'Vier lange', b: 'Fünf kurze' },
  { id: 'm013', haerte: 1, paket: ['arbeit'], frage: 'Mails sofort beantworten oder sammeln und abarbeiten?', a: 'Sofort', b: 'Sammeln' },
  { id: 'm014', haerte: 1, paket: ['arbeit'], frage: 'Lieber mit dem Chef per Du oder per Sie?', a: 'Du', b: 'Sie' },
  { id: 'm015', haerte: 1, paket: ['arbeit'], frage: 'Lieber ein Meeting zu viel oder eine Mail zu viel?', a: 'Meeting', b: 'Mail' },
  { id: 'm016', haerte: 1, paket: ['studenten'], frage: 'Im Hörsaal lieber erste Reihe oder ganz hinten?', a: 'Erste Reihe', b: 'Ganz hinten' },
  { id: 'm017', haerte: 1, paket: ['studenten'], frage: 'Lernen lieber früh am Morgen oder spät in der Nacht?', a: 'Morgens', b: 'Nachts' },
  { id: 'm018', haerte: 1, paket: ['studenten', 'wg-abend'], frage: 'Lieber Mensa oder selbst kochen?', a: 'Mensa', b: 'Selbst kochen' },
  { id: 'm019', haerte: 1, paket: ['studenten', 'wg-abend'], frage: 'Lieber in einer WG oder allein wohnen?', a: 'WG', b: 'Allein' },
  { id: 'm020', haerte: 1, paket: ['wg-abend', 'studenten'], frage: 'Ein Putzplan: Segen oder Fluch?', a: 'Segen', b: 'Fluch' },
  { id: 'm021', haerte: 1, paket: ['wg-abend', 'studenten'], frage: 'Lieber die Spülmaschine ausräumen oder den Müll runterbringen?', a: 'Ausräumen', b: 'Müll' },
  { id: 'm022', haerte: 1, paket: ['jga'], frage: 'Hochzeit lieber groß oder klein?', a: 'Groß', b: 'Klein' },
  { id: 'm023', haerte: 1, paket: ['jga'], frage: 'Lieber nur Standesamt oder auch Kirche?', a: 'Nur Standesamt', b: 'Auch Kirche' },
  { id: 'm024', haerte: 1, paket: ['jga'], frage: 'Flitterwochen lieber Abenteuer oder Strand?', a: 'Abenteuer', b: 'Strand' },
  { id: 'm025', haerte: 1, paket: ['jga'], frage: 'Den Brautstrauß lieber fangen oder ausweichen?', a: 'Fangen', b: 'Ausweichen' },
  { id: 'm026', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga', 'weihnachten'], frage: 'Hund oder Katze?', a: 'Hund', b: 'Katze' },
  { id: 'm027', haerte: 1, paket: ['wg-abend', 'arbeit', 'jga'], frage: 'Urlaub lieber in den Bergen oder am Meer?', a: 'Berge', b: 'Meer' },
  { id: 'm028', haerte: 1, paket: ['arbeit', 'wg-abend', 'weihnachten'], frage: 'Morgens lieber Kaffee oder Tee?', a: 'Kaffee', b: 'Tee' },
  { id: 'm029', haerte: 1, paket: ['wg-abend', 'arbeit'], frage: 'Lieber Frühling oder Herbst?', a: 'Frühling', b: 'Herbst' },
  { id: 'm030', haerte: 1, paket: ['wg-abend', 'studenten'], frage: 'Eine neue Serie lieber am Stück oder eine Folge pro Woche?', a: 'Am Stück', b: 'Pro Woche' },
  { id: 'm031', haerte: 1, paket: ['wg-abend', 'studenten', 'jga', 'weihnachten', 'arbeit'], frage: 'Eine Zeitreise: lieber in die Vergangenheit oder in die Zukunft?', a: 'Vergangenheit', b: 'Zukunft' },
  { id: 'm032', haerte: 1, paket: ['wg-abend', 'studenten', 'weihnachten'], frage: 'Lieber nie wieder Schokolade oder nie wieder Chips?', a: 'Keine Schokolade', b: 'Keine Chips' },
  { id: 'm033', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], frage: 'Lieber eine Sprachnachricht oder ein Anruf?', a: 'Sprachnachricht', b: 'Anruf' },
  { id: 'm034', haerte: 1, paket: ['wg-abend', 'jga'], frage: 'Nachts lieber zu warm oder zu kalt?', a: 'Zu warm', b: 'Zu kalt' },
  { id: 'm035', haerte: 1, paket: ['wg-abend', 'studenten', 'weihnachten'], frage: 'Lieber das Buch oder den Film dazu?', a: 'Buch', b: 'Film' },
  { id: 'm036', haerte: 1, paket: ['studenten', 'jga', 'wg-abend'], frage: 'Lieber ein Konzert oder ein Festival?', a: 'Konzert', b: 'Festival' },
  { id: 'm037', haerte: 1, paket: ['arbeit', 'jga', 'wg-abend'], frage: 'Lieber Städtereise oder Wanderurlaub?', a: 'Städtereise', b: 'Wandern' },
  { id: 'm038', haerte: 1, paket: ['arbeit', 'wg-abend', 'studenten'], frage: 'Lieber immer zehn Minuten zu früh oder immer zehn Minuten zu spät?', a: 'Zu früh', b: 'Zu spät' },
  { id: 'm039', haerte: 1, paket: ['wg-abend', 'studenten'], frage: 'Im Film lieber der Held oder der Bösewicht?', a: 'Held', b: 'Bösewicht' },
  { id: 'm040', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Zu Pommes lieber Ketchup oder Mayo?', a: 'Ketchup', b: 'Mayo' },
  { id: 'm041', haerte: 1, paket: ['jga', 'wg-abend', 'weihnachten'], frage: 'Frühstück lieber im Bett oder am Tisch?', a: 'Im Bett', b: 'Am Tisch' },
  { id: 'm042', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], frage: 'Wecker: Schlummertaste oder sofort raus?', a: 'Schlummern', b: 'Sofort raus' },
  { id: 'm043', haerte: 1, paket: ['weihnachten', 'jga'], frage: 'Ein Geschenk lieber selbst gemacht oder gekauft?', a: 'Selbst gemacht', b: 'Gekauft' },
  { id: 'm044', haerte: 1, paket: ['weihnachten', 'arbeit'], frage: 'Lieber Wichteln oder jeder beschenkt jeden?', a: 'Wichteln', b: 'Jeder jeden' },
  { id: 'm045', haerte: 1, paket: ['weihnachten'], frage: 'An Weihnachten lieber Gans oder Raclette?', a: 'Gans', b: 'Raclette' },
  { id: 'm046', haerte: 1, paket: ['weihnachten', 'wg-abend', 'studenten'], frage: 'Silvester lieber Party oder Sofa?', a: 'Party', b: 'Sofa' },
  { id: 'm047', haerte: 1, paket: ['weihnachten'], frage: 'Lieber Schneeballschlacht oder Schlittenfahren?', a: 'Schneeballschlacht', b: 'Schlitten' },
  { id: 'm048', haerte: 1, paket: ['arbeit', 'weihnachten'], frage: 'Weihnachtsfeier lieber mit Programm oder nur Essen?', a: 'Mit Programm', b: 'Nur Essen' },
  { id: 'm049', haerte: 1, paket: ['arbeit'], frage: 'Lieber ein Urlaubstag mehr oder 300 Euro Bonus?', a: 'Urlaubstag', b: 'Bonus' },
  { id: 'm050', haerte: 1, paket: ['arbeit'], frage: 'Lieber Großraumbüro oder Einzelbüro?', a: 'Großraum', b: 'Einzelbüro' },
  { id: 'm051', haerte: 1, paket: ['arbeit'], frage: 'Mittags lieber Kantine oder Brotdose?', a: 'Kantine', b: 'Brotdose' },
  { id: 'm052', haerte: 1, paket: ['studenten'], frage: 'Lieber eine Klausur oder eine Hausarbeit?', a: 'Klausur', b: 'Hausarbeit' },
  { id: 'm053', haerte: 1, paket: ['studenten', 'arbeit'], frage: 'Lieber in der Gruppe arbeiten oder allein?', a: 'Gruppe', b: 'Allein' },
  { id: 'm054', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], frage: 'Feiern lieber in der WG oder im Club?', a: 'WG', b: 'Club' },
  { id: 'm056', haerte: 1, paket: ['wg-abend', 'weihnachten'], frage: 'Lieber Spieleabend oder Filmabend?', a: 'Spieleabend', b: 'Filmabend' },
  { id: 'm057', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Lieber kochen oder abwaschen?', a: 'Kochen', b: 'Abwaschen' },
  { id: 'm058', haerte: 1, paket: ['jga'], frage: 'Auf der Hochzeit lieber die Rede halten oder den ersten Tanz tanzen?', a: 'Rede', b: 'Tanz' },
  { id: 'm059', haerte: 1, paket: ['jga'], frage: 'Junggesellenabschied lieber im Ausland oder zu Hause?', a: 'Ausland', b: 'Zu Hause' },
  { id: 'm060', haerte: 1, paket: ['jga', 'wg-abend', 'arbeit'], frage: 'Eine Überraschungsparty lieber bekommen oder planen?', a: 'Bekommen', b: 'Planen' },
  { id: 'm061', haerte: 2, paket: ['wg-abend', 'jga'], frage: 'Das Handy des Partners heimlich lesen — würdest du, wenn du könntest?', a: 'Ja', b: 'Nein' },
  { id: 'm062', haerte: 2, paket: ['jga', 'arbeit'], frage: 'Auf deiner Hochzeit lieber den Ex oder den Chef als Gast?', a: 'Den Ex', b: 'Den Chef' },
  { id: 'm063', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Lieber deinen Chatverlauf vorgelesen bekommen oder deinen Suchverlauf?', a: 'Chatverlauf', b: 'Suchverlauf' },
  { id: 'm064', haerte: 2, paket: ['jga', 'wg-abend', 'studenten'], frage: 'Beim ersten Date lieber bezahlen oder eingeladen werden?', a: 'Bezahlen', b: 'Eingeladen' },
  { id: 'm065', haerte: 2, paket: ['arbeit', 'wg-abend'], frage: 'Beim Lästern erwischt: lieber zugeben oder abstreiten?', a: 'Zugeben', b: 'Abstreiten' },
  { id: 'm066', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Zurück zum Ex — jemals eine gute Idee?', a: 'Kann sein', b: 'Nie' },
  { id: 'm067', haerte: 1, paket: ['arbeit'], frage: 'Den Fehler eines Kollegen lieber melden oder decken?', a: 'Melden', b: 'Decken' },
  { id: 'm068', haerte: 2, paket: ['arbeit', 'studenten'], frage: 'Schon mal krankgemeldet, obwohl du gesund warst?', a: 'Ja', b: 'Nein' },
  { id: 'm069', haerte: 2, paket: ['jga', 'wg-abend'], frage: 'Im Bett lieber Licht an oder Licht aus?', a: 'Licht an', b: 'Licht aus' },
  { id: 'm070', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], frage: 'Sex lieber morgens oder abends?', a: 'Morgens', b: 'Abends' },
  { id: 'm071', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], frage: 'Lieber beim Sex erwischt werden oder jemanden beim Sex erwischen?', a: 'Erwischt werden', b: 'Selbst erwischen' },
  { id: 'm072', haerte: 2, paket: ['jga', 'wg-abend', 'studenten'], frage: 'Ein One-Night-Stand: eher ja oder eher nein?', a: 'Eher ja', b: 'Eher nein' },
  { id: 'm073', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Mit dem Ex befreundet bleiben: geht das?', a: 'Ja', b: 'Nein' },
  { id: 'm074', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Ist Flirten mit dem Barkeeper für einen Gratis-Drink okay?', a: 'Okay', b: 'Daneben' },
  { id: 'm075', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Den ersten Kuss schon beim ersten Date?', a: 'Ja', b: 'Lieber warten' },
  { id: 'm076', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Beim Flirten: Machst du den ersten Schritt oder wartest du?', a: 'Ich mache ihn', b: 'Ich warte' },
  { id: 'm077', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Den Partner einer Freundin oder eines Freundes schon mal heimlich attraktiv gefunden?', a: 'Ja', b: 'Nein' },
  { id: 'm078', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Dein Partner küsst betrunken jemand anderen: verzeihen oder Schluss?', a: 'Verzeihen', b: 'Schluss' },
  { id: 'm079', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Ist ein Kuss mit jemand anderem schon Fremdgehen?', a: 'Ja', b: 'Nein' },
  { id: 'm080', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Ist heimliches Flirten per Chat schon Fremdgehen?', a: 'Ja', b: 'Nein' },
  { id: 'm081', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal jemanden geghostet?', a: 'Ja', b: 'Nein' },
  { id: 'm082', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Nach dem ersten Date: sofort schreiben oder einen Tag warten?', a: 'Sofort', b: 'Warten' },
  { id: 'm083', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal betrunken dem Ex geschrieben?', a: 'Ja', b: 'Nein' },
  { id: 'm084', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Den Standort mit dem Partner dauerhaft teilen?', a: 'Ja', b: 'Nein' },
  { id: 'm085', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Würdest du jemanden daten, der 15 Jahre älter ist?', a: 'Ja', b: 'Nein' },
  { id: 'm086', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Partner und bester Freund können sich nicht leiden: Wer gewinnt?', a: 'Partner', b: 'Bester Freund' },
  { id: 'm087', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Auf der Party: tschüss sagen oder heimlich verschwinden?', a: 'Tschüss sagen', b: 'Heimlich weg' },
  { id: 'm088', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Lieber verkatert nach einer großartigen Nacht oder fit nach einer langweiligen?', a: 'Verkatert', b: 'Fit' },
  { id: 'm089', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Ist das Vorglühen oft besser als die Party selbst?', a: 'Ja', b: 'Nein' },
  { id: 'm090', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal auf einer Party eingeschlafen?', a: 'Ja', b: 'Nein' },
  { id: 'm091', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal betrunken etwas online bestellt?', a: 'Ja', b: 'Nein' },
  { id: 'm092', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal einen Filmriss gehabt?', a: 'Ja', b: 'Nein' },
  { id: 'm093', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Vier Uhr nachts nach der Party: noch zum Döner oder direkt ins Bett?', a: 'Döner', b: 'Bett' },
  { id: 'm094', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Den Ex der besten Freundin oder des besten Freundes daten: geht klar oder tabu?', a: 'Geht klar', b: 'Tabu' },
  { id: 'm095', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Würdest du deinem Partner sagen, dass er schlecht küsst?', a: 'Ja', b: 'Nein' },
  { id: 'm096', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Pärchen-Kosenamen wie „Schatzi": süß oder peinlich?', a: 'Süß', b: 'Peinlich' },
  { id: 'm097', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Wildes Knutschen in der Öffentlichkeit: okay oder unangenehm?', a: 'Okay', b: 'Unangenehm' },
  { id: 'm098', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Getrennte Schlafzimmer in einer Beziehung: Traum oder Horror?', a: 'Traum', b: 'Horror' },
  { id: 'm099', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Bei Liebeskummer: lieber Party oder Sofa mit Eis?', a: 'Party', b: 'Sofa' },
  { id: 'm100', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal jemanden nur wegen eines Fotos angeschrieben?', a: 'Ja', b: 'Nein' },
  { id: 'm101', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal jemanden geküsst, dessen Namen du nicht wusstest?', a: 'Ja', b: 'Nein' },
  { id: 'm102', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal einen Schwarm online bis weit ins alte Profil gestalkt?', a: 'Ja', b: 'Nein' },
  { id: 'm103', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Der Ex schreibt um zwei Uhr nachts „Bist du wach?": antworten oder ignorieren?', a: 'Antworten', b: 'Ignorieren' },
  { id: 'm104', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Nachts mit Freunden nackt baden gehen: dabei oder nicht?', a: 'Dabei', b: 'Nicht dabei' },
  { id: 'm105', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Würdest du jemanden aus dem eigenen Freundeskreis daten?', a: 'Ja', b: 'Nein' },
  { id: 'm106', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Was ist beim Date schlimmer: Mundgeruch oder Schweißgeruch?', a: 'Mundgeruch', b: 'Schweißgeruch' },
  { id: 'm107', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Flirten, obwohl man vergeben ist: harmlos oder schon zu viel?', a: 'Harmlos', b: 'Zu viel' },
  { id: 'm108', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Würdest du dein entsperrtes Handy einen Abend lang dem Tisch überlassen?', a: 'Ja', b: 'Nein' },
  { id: 'm109', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Schon mal jemandem absichtlich eine falsche Nummer gegeben?', a: 'Ja', b: 'Nein' },
  { id: 'm110', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Das erste „Ich liebe dich": lieber sagen oder hören?', a: 'Sagen', b: 'Hören' },
  { id: 'm111', haerte: 2, paket: ['arbeit', 'weihnachten'], frage: 'Auf der Weihnachtsfeier mit jemandem aus dem Büro knutschen: geht oder geht gar nicht?', a: 'Geht', b: 'Geht gar nicht' },
  { id: 'm112', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Würdest du auf einer Party mit einer fremden Person knutschen?', a: 'Ja', b: 'Nein' },
  { id: 'm113', haerte: 2, paket: ['wg-abend', 'studenten', 'jga'], frage: 'Den Schwarm per Antwort auf die Story anflirten: mutig oder peinlich?', a: 'Mutig', b: 'Peinlich' },
  { id: 'm114', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Sex beim ersten Date: okay oder zu früh?', a: 'Okay', b: 'Zu früh' },
  { id: 'm115', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Pornos schauen in einer Beziehung: normal oder No-Go?', a: 'Normal', b: 'No-Go' },
  { id: 'm116', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Gehört Sexspielzeug in jede Nachttischschublade?', a: 'Ja', b: 'Nein' },
  { id: 'm117', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Reizt dich die Vorstellung von einem Dreier?', a: 'Ja', b: 'Nein' },
  { id: 'm118', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Schon mal einen Orgasmus vorgetäuscht?', a: 'Ja', b: 'Nein' },
  { id: 'm119', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'In einer Beziehung lieber zu oft Sex oder zu selten?', a: 'Zu oft', b: 'Zu selten' },
  { id: 'm120', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Sex während der Periode: okay oder No-Go?', a: 'Okay', b: 'No-Go' },
  { id: 'm121', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Intim: komplett rasiert oder natürlich?', a: 'Rasiert', b: 'Natürlich' },
  { id: 'm122', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Schon mal Nacktfotos verschickt?', a: 'Ja', b: 'Nein' },
  { id: 'm123', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Dirty Talk: macht an oder bringt zum Lachen?', a: 'Macht an', b: 'Zum Lachen' },
  { id: 'm124', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Schon mal Sex im Auto gehabt?', a: 'Ja', b: 'Nein' },
  { id: 'm125', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Morgensex vor dem Zähneputzen: geht oder eklig?', a: 'Geht', b: 'Eklig' },
  { id: 'm126', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Könntest du eine offene Beziehung führen?', a: 'Ja', b: 'Nein' },
  { id: 'm127', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Sexfreundschaft ohne Gefühle: funktioniert das?', a: 'Ja', b: 'Nein' },
  { id: 'm128', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Sex in einer Beziehung: sehr wichtig oder überbewertet?', a: 'Sehr wichtig', b: 'Überbewertet' },
  { id: 'm129', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Nach dem Sex: erst kuscheln oder sofort duschen?', a: 'Kuscheln', b: 'Duschen' },
  { id: 'm130', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Würdest du mal in einen Swingerclub reinschauen?', a: 'Ja', b: 'Nein' },
  { id: 'm131', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Sex am Strand: Traum oder Sand überall?', a: 'Traum', b: 'Sand überall' },
  { id: 'm132', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Willst du wissen, mit wie vielen Leuten dein Partner schon geschlafen hat?', a: 'Ja', b: 'Lieber nicht' },
  { id: 'm133', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Die eigene Zahl an Sexpartnern: ehrlich sagen oder schönen?', a: 'Ehrlich', b: 'Schönen' },
  { id: 'm134', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Schon mal beim Sex erwischt worden?', a: 'Ja', b: 'Nein' },
  { id: 'm135', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Beim Sex Musik an oder aus?', a: 'An', b: 'Aus' },
  { id: 'm136', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Zusammen mit dem Partner einen Porno schauen?', a: 'Gern', b: 'Lieber nicht' },
  { id: 'm137', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Eine Toy-Party mit Freunden: dabei oder nicht?', a: 'Dabei', b: 'Nicht dabei' },
  { id: 'm138', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Für 10.000 Euro ein Jahr lang auf Sex verzichten?', a: 'Ja', b: 'Nein' },
  { id: 'm139', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Für eine Million Euro einen Porno drehen?', a: 'Ja', b: 'Nein' },
  { id: 'm140', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Schon mal gekifft?', a: 'Ja', b: 'Nein' },
  { id: 'm141', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Magic Mushrooms: würdest du es probieren, wenn es legal wäre?', a: 'Ja', b: 'Nein' },
  { id: 'm142', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Nach einer Partynacht schon mal neben einer fremden Person aufgewacht?', a: 'Ja', b: 'Nein' },
  { id: 'm143', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Schon mal auf einer Party gekotzt?', a: 'Ja', b: 'Nein' },
  { id: 'm144', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Pinkelst du unter der Dusche?', a: 'Ja', b: 'Nein' },
  { id: 'm145', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Vor dem Partner pupsen: ganz normal oder niemals?', a: 'Normal', b: 'Niemals' },
  { id: 'm146', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Beim Klogang die Tür offen lassen, wenn der Partner da ist: geht oder geht gar nicht?', a: 'Geht', b: 'Geht gar nicht' },
  { id: 'm147', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Schon mal dieselbe Unterhose zwei Tage getragen?', a: 'Ja', b: 'Nein' },
  { id: 'm148', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Die Zahnbürste des Partners benutzen: okay oder eklig?', a: 'Okay', b: 'Eklig' },
  { id: 'm149', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Redest du mit Freunden über Selbstbefriedigung?', a: 'Ja', b: 'Nein' },
  { id: 'm150', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Selbstbefriedigung in einer Beziehung: normal oder komisch?', a: 'Normal', b: 'Komisch' },
  { id: 'm151', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Einmal fremdgegangen: beichten oder schweigen?', a: 'Beichten', b: 'Schweigen' },
  { id: 'm152', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Dein Partner ist einmal betrunken fremdgegangen: willst du es wissen?', a: 'Ja', b: 'Lieber nicht' },
  { id: 'm153', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Schon mal „aus Versehen" wieder mit dem Ex im Bett gelandet?', a: 'Ja', b: 'Nein' },
  { id: 'm154', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Rollenspiele im Bett: aufregend oder albern?', a: 'Aufregend', b: 'Albern' },
  { id: 'm155', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Fesseln im Bett: reizvoll oder nichts für dich?', a: 'Reizvoll', b: 'Nichts für mich' },
  { id: 'm156', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Sex an einem Ort, wo man erwischt werden könnte: reizvoll oder zu riskant?', a: 'Reizvoll', b: 'Zu riskant' },
  { id: 'm157', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Lieber ein Quickie oder eine ganze Stunde?', a: 'Quickie', b: 'Eine Stunde' },
  { id: 'm158', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Sex auf dem Flugzeugklo: würdest du?', a: 'Ja', b: 'Nein' },
  { id: 'm159', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Stöhnen beim Sex: meistens echt oder meistens Show?', a: 'Echt', b: 'Show' },
  { id: 'm160', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Der Zoll packt deinen Vibrator aus: peinlich oder egal?', a: 'Peinlich', b: 'Egal' },
  { id: 'm161', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Sex nach Kalender in einer Beziehung: unsexy oder vernünftig?', a: 'Unsexy', b: 'Vernünftig' },
  { id: 'm162', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Versöhnungssex: der beste Sex oder überbewertet?', a: 'Der beste', b: 'Überbewertet' },
  { id: 'm163', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], frage: 'Dein Partner wünscht sich ein gemeinsames Sexvideo: ja oder nein?', a: 'Ja', b: 'Nein' },
];

/**
 * Gestrichene Kennungen — nie neu vergeben. Seit der Prüfung vom 27.09.2026;
 * die Gründe stehen in docs/partykiste-pruefung/mehrheit.json.
 */
export const MEHRHEITSFRAGEN_ENTFERNT: readonly string[] = ['m055'];
