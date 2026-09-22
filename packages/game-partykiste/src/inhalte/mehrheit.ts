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
 * `paket`. Kein Text befiehlt das Trinken. Neue Einträge hängen hinten an,
 * Kennungen ändern sich nie.
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
  { id: 'm055', haerte: 1, paket: ['studenten'], frage: 'Semesterferien lieber am Strand oder im Praktikum?', a: 'Strand', b: 'Praktikum' },
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
  { id: 'm067', haerte: 2, paket: ['arbeit'], frage: 'Den Fehler eines Kollegen lieber melden oder decken?', a: 'Melden', b: 'Decken' },
  { id: 'm068', haerte: 2, paket: ['arbeit', 'studenten'], frage: 'Schon mal krankgemeldet, obwohl du gesund warst?', a: 'Ja', b: 'Nein' },
  { id: 'm069', haerte: 3, paket: ['jga', 'wg-abend'], frage: 'Im Bett lieber Licht an oder Licht aus?', a: 'Licht an', b: 'Licht aus' },
  { id: 'm070', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], frage: 'Sex lieber morgens oder abends?', a: 'Morgens', b: 'Abends' },
  { id: 'm071', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], frage: 'Lieber beim Sex erwischt werden oder beim Lästern über den, der euch erwischt?', a: 'Beim Sex', b: 'Beim Lästern' },
  { id: 'm072', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], frage: 'Ein One-Night-Stand: eher ja oder eher nein?', a: 'Eher ja', b: 'Eher nein' },
];
