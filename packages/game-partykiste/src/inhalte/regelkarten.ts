/**
 * Regel-Karten.
 *
 * Eine Karte bringt eine Regel an den Tisch, die zwei weitere Runden lang
 * gilt — während ganz andere Minispiele laufen. Wer dagegen verstößt, meldet
 * sich selbst oder wird von der Mehrheit gemeldet. Eine Regel taugt nur, wenn
 * man den Verstoß HÖREN oder SEHEN kann: „Denk nicht an Elefanten" lässt sich
 * nicht überprüfen, „Sag nicht ‚ja'" schon.
 *
 * Strenger als die anderen Kataloge: Eine Regel ist ein Befehl an alle, und
 * der gilt auch am alkoholfreien Tisch. Deshalb steht hier nicht nur kein
 * Trinkbefehl, sondern gar kein Trinkwort (dieselbe Stufe wie bei Wahrheit
 * oder Pflicht, `test/ohne-uhr.test.ts`). Die Kartenvorlage „nach jedem Satz
 * Prost" wurde deshalb zu „Jawohl".
 *
 * Seit dem 22.09.2026, jeder Eintrag mit `haerte` und mindestens einem
 * `paket`.
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

export interface Regelkarte extends Inhalt {
  readonly text: string;
}

export const REGELKARTEN: readonly Regelkarte[] = [
  { id: 'r001', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga', 'weihnachten'], text: 'Keine Vornamen. Wer jemanden beim Namen nennt, hat verstoßen.' },
  { id: 'r002', haerte: 1, paket: ['wg-abend', 'studenten', 'jga', 'weihnachten'], text: 'Glas, Tasse und Handy nur mit der linken Hand anfassen.' },
  { id: 'r003', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Jeder Satz endet mit „Jawohl".' },
  { id: 'r004', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Keine Fragen stellen. Wer etwas fragt, hat verstoßen.' },
  { id: 'r005', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga', 'weihnachten'], text: 'Das Wort „ja" ist verboten.' },
  { id: 'r006', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga', 'weihnachten'], text: 'Das Wort „nein" ist verboten.' },
  { id: 'r007', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Wer reden will, hebt vorher die Hand.' },
  { id: 'r008', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga', 'weihnachten'], text: 'Nicht aufs Handy schauen — außer auf diesen Bildschirm.' },
  { id: 'r009', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Keine englischen Wörter. „Okay" zählt auch.' },
  { id: 'r010', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Wer spricht, legt eine Hand auf den Kopf.' },
  { id: 'r011', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'weihnachten'], text: 'Nicht zeigen — weder mit dem Finger noch mit dem Kinn.' },
  { id: 'r012', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Nur flüstern.' },
  { id: 'r013', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Die Person links von dir heißt jetzt „Eure Hoheit". Anders ansprechen gilt nicht.' },
  { id: 'r014', haerte: 1, paket: ['arbeit', 'weihnachten', 'wg-abend'], text: 'Keine Schimpfwörter, auch keine harmlosen.' },
  { id: 'r015', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Wer aufsteht, sagt vorher laut, wohin er geht.' },
  { id: 'r016', haerte: 1, paket: ['arbeit', 'wg-abend', 'jga'], text: 'Wer die Arme verschränkt, hat verstoßen.' },
  { id: 'r017', haerte: 1, paket: ['arbeit', 'studenten'], text: 'Jeder Satz beginnt mit „Meines Erachtens".' },
  { id: 'r018', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Jeder redet von sich nur in der dritten Person.' },
  { id: 'r020', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Keine Zahlen aussprechen.' },
  { id: 'r021', haerte: 1, paket: ['wg-abend', 'studenten', 'jga', 'weihnachten'], text: 'Vor jedem Satz einmal auf den Tisch klopfen.' },
  { id: 'r022', haerte: 1, paket: ['weihnachten'], text: 'Das Wort „Weihnachten" ist verboten.' },
  { id: 'r023', haerte: 1, paket: ['weihnachten', 'wg-abend', 'jga'], text: 'Wer gefragt wird, antwortet in Reimen.' },
  { id: 'r024', haerte: 1, paket: ['arbeit'], text: 'Die Wörter „Chef" und „Meeting" sind verboten.' },
  { id: 'r025', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Wer „eigentlich" sagt, hat verstoßen.' },
  { id: 'r026', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Keine Gesten beim Reden — die Hände bleiben liegen.' },
  { id: 'r027', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Wer gähnt, hat verstoßen.' },
  { id: 'r028', haerte: 1, paket: ['jga'], text: 'Den Namen der Braut oder des Bräutigams nicht aussprechen.' },
  { id: 'r029', haerte: 1, paket: ['wg-abend', 'jga', 'studenten'], text: 'Nur mit Akzent reden — welcher, ist egal.' },
  { id: 'r030', haerte: 1, paket: ['wg-abend', 'studenten', 'jga', 'weihnachten'], text: 'Wer sich an die Nase fasst, hat verstoßen.' },
  { id: 'r031', haerte: 1, paket: ['wg-abend', 'jga'], text: 'Beim Reden die Person rechts von dir ansehen.' },
  { id: 'r032', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'weihnachten'], text: 'Das Wort „Handy" ist verboten.' },
  { id: 'r033', haerte: 1, paket: ['arbeit', 'weihnachten', 'wg-abend'], text: 'Wer seufzt, hat verstoßen.' },
  { id: 'r034', haerte: 1, paket: ['studenten', 'wg-abend'], text: 'Jede Antwort beginnt mit einer Gegenfrage.' },
  { id: 'r035', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Wer etwas auf den Tisch stellt, sagt laut „Abgestellt".' },
  { id: 'r036', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Kein Satz hat mehr als fünf Wörter.' },
  { id: 'r037', haerte: 1, paket: ['studenten'], text: 'Die Wörter „Klausur", „Prüfung" und „Uni" sind verboten.' },
  { id: 'r038', haerte: 1, paket: ['jga', 'weihnachten', 'wg-abend'], text: 'Wer den Raum verlässt, verabschiedet sich von allen per Handschlag.' },
  { id: 'r039', haerte: 1, paket: ['arbeit'], text: 'Jeder Satz beginnt mit „Liebe Kolleginnen und Kollegen".' },
  { id: 'r040', haerte: 1, paket: ['wg-abend', 'studenten', 'jga', 'weihnachten'], text: 'Lachen nur mit geschlossenem Mund.' },
  { id: 'r041', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'weihnachten'], text: '„Bitte" und „Danke" sind verboten.' },
  { id: 'r042', haerte: 1, paket: ['arbeit', 'jga', 'wg-abend', 'weihnachten'], text: 'Wer über die Arbeit redet, hat verstoßen.' },
  { id: 'r043', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer einen Ex erwähnt, hat verstoßen.' },
  { id: 'r044', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… im Bett".' },
  { id: 'r045', haerte: 2, paket: ['jga', 'wg-abend'], text: 'Alle sprechen sich nur mit Kosenamen an: Schatz, Hase, Bärchen.' },
  { id: 'r046', haerte: 2, paket: ['jga', 'wg-abend', 'studenten'], text: 'Flirten ist verboten — was als Flirten zählt, entscheidet die Runde.' },
  { id: 'r047', haerte: 3, paket: ['jga', 'wg-abend', 'studenten'], text: 'In jedem Satz muss das Wort „Sex" vorkommen.' },
  { id: 'r048', haerte: 2, paket: ['wg-abend', 'studenten'], text: 'Jeder Satz braucht ein Schimpfwort. Wer eins vergisst, hat verstoßen.' },
  { id: 'r049', haerte: 3, paket: ['jga', 'wg-abend'], text: 'Jede Antwort muss versaut zweideutig sein — wer sauber antwortet, hat verstoßen.' },
  { id: 'r050', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit', 'jga', 'weihnachten'], text: 'Das Wort „genau" ist verboten.' },
  { id: 'r051', haerte: 1, paket: ['wg-abend', 'studenten', 'jga', 'weihnachten'], text: 'Wer lacht, hält sich dabei die Hand vor den Mund.' },
  { id: 'r052', haerte: 1, paket: ['arbeit', 'studenten', 'wg-abend'], text: 'Jede Antwort beginnt mit „Gute Frage!".' },
  { id: 'r053', haerte: 1, paket: ['arbeit', 'weihnachten', 'wg-abend'], text: 'Alle siezen sich — wer jemanden duzt, hat verstoßen.' },
  { id: 'r054', haerte: 1, paket: ['weihnachten', 'wg-abend', 'studenten'], text: 'Wer niest oder hustet, sagt sich selbst laut „Gesundheit".' },
  { id: 'r055', haerte: 1, paket: ['arbeit', 'wg-abend', 'studenten', 'jga'], text: 'Nach jedem Satz ein Daumen hoch.' },
  { id: 'r056', haerte: 1, paket: ['studenten', 'arbeit', 'wg-abend'], text: 'Das Wort „und" ist verboten.' },
  { id: 'r057', haerte: 1, paket: ['weihnachten', 'jga', 'wg-abend'], text: 'Wer etwas vom Tisch nimmt, sagt laut „Danke, Tisch".' },
  { id: 'r058', haerte: 1, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer spricht, macht dabei die Augen zu.' },
  { id: 'r059', haerte: 1, paket: ['studenten', 'wg-abend', 'jga'], text: 'Die Wörter „krass" und „mega" sind verboten.' },
  { id: 'r060', haerte: 1, paket: ['wg-abend', 'jga', 'weihnachten'], text: 'Wer lacht, grunzt dabei wie ein Schwein.' },
  { id: 'r061', haerte: 1, paket: ['arbeit', 'weihnachten', 'jga'], text: 'Wer die Runde unterbricht, entschuldigt sich mit einer Verbeugung.' },
  { id: 'r062', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… Baby".' },
  { id: 'r063', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer lacht, wirft der Person gegenüber einen Luftkuss zu.' },
  { id: 'r064', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer aufsteht, macht vorher einen Hüftschwung.' },
  { id: 'r065', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Das Wort „Single" ist verboten.' },
  { id: 'r066', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer über Dating-Apps redet, hat verstoßen.' },
  { id: 'r067', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… aber nur, wenn du mich küsst".' },
  { id: 'r068', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Die Wörter „betrunken", „besoffen" und „dicht" sind verboten.' },
  { id: 'r069', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jede Frage beginnt mit einem Anmachspruch.' },
  { id: 'r070', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Die Wörter „süß", „heiß" und „sexy" sind verboten.' },
  { id: 'r071', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Nach jedem Satz einmal mit den Augenbrauen wackeln.' },
  { id: 'r072', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… sagte mein Ex".' },
  { id: 'r073', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz beginnt mit „Unter uns Singles …".' },
  { id: 'r074', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer aufs Handy schaut, sagt laut, wem er zuletzt geschrieben hat.' },
  { id: 'r075', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Du und die Person rechts seid jetzt ein Paar: Ihr redet nur noch in der Wir-Form.' },
  { id: 'r076', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer jemanden anspricht, beginnt mit „Hey, Hübsche" oder „Hey, Hübscher".' },
  { id: 'r077', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jede Antwort endet mit einem Kussgeräusch.' },
  { id: 'r078', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… aber psst, nicht meiner Mutter sagen".' },
  { id: 'r079', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer „Sorry" oder „Entschuldigung" sagt, hängt „Liebling" dran.' },
  { id: 'r080', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „ich" sagt jeder „ich Sexbombe".' },
  { id: 'r081', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Alle reden nur noch mit Schlafzimmerstimme.' },
  { id: 'r082', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer etwas abstellt, stöhnt dabei leise.' },
  { id: 'r083', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer eine Zahl sagt, sagt stattdessen „neunundsechzig".' },
  { id: 'r084', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer einen Namen sagt, hängt „der Hengst" oder „die Stute" dran.' },
  { id: 'r085', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Die Wörter „Kater" und „Absturz" sind verboten.' },
  { id: 'r086', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer jemandem etwas reicht, zwinkert dabei.' },
  { id: 'r087', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jede Antwort beginnt mit „Das verrate ich nur beim zweiten Date:".' },
  { id: 'r088', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… wie bei unserem ersten Date".' },
  { id: 'r089', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer etwas vom Tisch nimmt, streichelt es vorher zärtlich.' },
  { id: 'r090', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Das Wort „Date" ist verboten.' },
  { id: 'r091', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Beim Reden auf die Lippen der Person schauen, mit der man spricht.' },
  { id: 'r092', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer lacht, legt die Hand aufs Herz und seufzt „Ach".' },
  { id: 'r093', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Die Wörter „Kuss" und „küssen" sind verboten.' },
  { id: 'r094', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… wenn du weißt, was ich meine".' },
  { id: 'r095', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jede Frage wird mit tiefem Blick in die Augen gestellt.' },
  { id: 'r096', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Die Wörter „Nacht" und „Bett" sind verboten.' },
  { id: 'r097', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer auf dem Handy tippt, liest laut vor, was er tippt.' },
  { id: 'r098', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz muss ein Kompliment an die angesprochene Person enthalten.' },
  { id: 'r099', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Die Wörter „Party", „Club" und „Bar" sind verboten.' },
  { id: 'r100', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer lacht, himmelt dabei die Person rechts von sich an.' },
  { id: 'r101', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Alle Handys liegen mit dem Bildschirm nach oben — wer seins umdreht, hat verstoßen.' },
  { id: 'r102', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer eine Nachricht bekommt, sagt laut, von wem.' },
  { id: 'r103', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer gähnt, sagt „Ich bin nicht müde, nur verliebt".' },
  { id: 'r104', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz beginnt mit „Nach Mitternacht würde ich sagen …".' },
  { id: 'r105', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer sich durch die Haare fährt, hat verstoßen — das gilt als Flirtsignal.' },
  { id: 'r106', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Die Wörter „verliebt", „Liebe" und „Herz" sind verboten.' },
  { id: 'r107', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Das Wort „geil" ist verboten.' },
  { id: 'r108', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „Tisch" heißt es „Bett".' },
  { id: 'r109', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „essen" heißt es „vernaschen".' },
  { id: 'r110', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer vom Tisch aufsteht, wackelt beim Weggehen mit dem Hintern.' },
  { id: 'r111', haerte: 2, paket: ['wg-abend', 'jga', 'studenten'], text: 'Das Wort „Sex" ist verboten — es heißt „Matratzensport".' },
  { id: 'r112', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… und dann haben wir gevögelt".' },
  { id: 'r113', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „ja" heißt es „Oh ja, härter".' },
  { id: 'r114', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „nein" heißt es „Nicht ohne Gummi".' },
  { id: 'r115', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Die Wörter „hart", „feucht", „tief" und „kommen" sind verboten.' },
  { id: 'r116', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… sagte die Domina".' },
  { id: 'r117', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer lacht, lacht wie beim Orgasmus.' },
  { id: 'r118', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder heißt nach seiner Lieblingsstellung. Wer einen echten Namen sagt, hat verstoßen.' },
  { id: 'r119', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer aufs Handy schaut, sagt laut „Ich such nur Nudes".' },
  { id: 'r120', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer die Hände unter dem Tisch hat, sagt laut, was sie da machen.' },
  { id: 'r121', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer vom Klo zurückkommt, meldet laut „groß" oder „klein".' },
  { id: 'r122', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer niest, hustet oder sich schnäuzt, stöhnt danach.' },
  { id: 'r123', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer auf etwas zeigt, zeigt mit dem Mittelfinger.' },
  { id: 'r124', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer etwas in den Mund steckt, sagt vorher „Mmh, so groß".' },
  { id: 'r125', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer lacht, sagt danach „Das war fast so gut wie Sex".' },
  { id: 'r126', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Alle sprechen sich mit „Luder" oder „Lümmel" an.' },
  { id: 'r127', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jede Frage wird mit Porno-Synchronstimme gestellt.' },
  { id: 'r128', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „Entschuldigung" heißt es „Bestraf mich".' },
  { id: 'r129', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer gähnt, sagt „Du langweilst mich mehr als mein letzter Sex".' },
  { id: 'r130', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer einen Satz mit „Ich" beginnt, beendet ihn mit „… und zwar nackt".' },
  { id: 'r131', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'In jedem Satz muss ein Körperteil unterhalb der Gürtellinie vorkommen.' },
  { id: 'r132', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer rülpst oder pupst, widmet es laut jemandem am Tisch.' },
  { id: 'r133', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer aufsteht, ruft dabei „Ich komme!".' },
  { id: 'r134', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… und das war erst das Vorspiel".' },
  { id: 'r135', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „Hallo" und „Tschüss" heißt es „Na, du geiles Stück".' },
  { id: 'r136', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer einen Gegenstand in die Hand nimmt, befummelt ihn erst lasziv.' },
  { id: 'r137', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jede Antwort beginnt mit „Beim letzten Dreier …".' },
  { id: 'r138', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer sich bückt oder etwas aufhebt, fragt „Gefällt dir die Aussicht?".' },
  { id: 'r139', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… aber nur mit Handschellen".' },
  { id: 'r140', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer die Person neben sich anspricht, nennt sie „Sexgott" oder „Sexgöttin".' },
  { id: 'r141', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… im Swingerclub".' },
  { id: 'r142', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer lacht, wackelt dabei obszön mit der Zunge.' },
  { id: 'r143', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz beginnt mit „Als ich letztens high war …".' },
  { id: 'r144', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Nur dreckige Witze erlaubt — wer einen sauberen erzählt, hat verstoßen.' },
  { id: 'r145', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer sich kratzt, sagt laut, ob es Filzläuse sind.' },
  { id: 'r146', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „Handy" heißt es „Dildo".' },
  { id: 'r147', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „Glas" heißt es „Gleitgel".' },
  { id: 'r148', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „Stuhl" heißt es „Sexschaukel".' },
  { id: 'r149', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „machen" heißt es „es treiben".' },
  { id: 'r150', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer jemandem in die Augen schaut, leckt sich dabei über die Lippen.' },
  { id: 'r151', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit „… und dann hab ich gekotzt".' },
  { id: 'r152', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „Danke" heißt es „Danke, du geile Sau".' },
  { id: 'r153', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „Bitte" heißt es „Bitte, fester".' },
  { id: 'r154', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz endet mit dem Namen einer Körperflüssigkeit.' },
  { id: 'r155', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jeder Satz beginnt mit „Alter …" und klingt, als wärst du high.' },
  { id: 'r156', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer aufsteht, sagt laut, welche Unterwäsche er trägt.' },
  { id: 'r157', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer lacht, nennt danach eine Stellung, die er mag.' },
  { id: 'r158', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer die Arme hebt, riecht danach an der eigenen Achsel.' },
  { id: 'r159', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer hustet, sagt „Das kommt vom Gras".' },
  { id: 'r160', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Statt „toll", „super" oder „schön" heißt es „orgastisch".' },
  { id: 'r161', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Wer sich hinsetzt, sagt „Ah, da sitz ich gern drauf".' },
  { id: 'r162', haerte: 3, paket: ['wg-abend', 'jga', 'studenten'], text: 'Jede Frage beginnt mit „Mal ganz unter uns Perversen:".' },
];

/**
 * Gestrichene Kennungen — nie neu vergeben. Seit der Prüfung vom 27.09.2026;
 * die Gründe stehen in docs/partykiste-pruefung/regelkarten.json.
 */
export const REGELKARTEN_ENTFERNT: readonly string[] = ['r019'];
