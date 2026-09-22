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
 * `paket`. Neue Einträge hängen hinten an, Kennungen ändern sich nie.
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
  { id: 'r016', haerte: 1, paket: ['arbeit', 'wg-abend', 'jga'], text: 'Die Beine nicht übereinanderschlagen.' },
  { id: 'r017', haerte: 1, paket: ['arbeit', 'studenten'], text: 'Jeder Satz beginnt mit „Meines Erachtens".' },
  { id: 'r018', haerte: 1, paket: ['wg-abend', 'studenten', 'jga'], text: 'Jeder redet von sich nur in der dritten Person.' },
  { id: 'r019', haerte: 1, paket: ['wg-abend', 'studenten', 'arbeit'], text: 'Das Wort „ich" ist verboten.' },
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
  { id: 'r033', haerte: 1, paket: ['arbeit', 'weihnachten', 'wg-abend'], text: 'Wer sich beschwert, hat verstoßen.' },
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
  { id: 'r048', haerte: 3, paket: ['wg-abend', 'studenten'], text: 'Jeder Satz braucht ein Schimpfwort. Wer eins vergisst, hat verstoßen.' },
  { id: 'r049', haerte: 3, paket: ['jga', 'wg-abend'], text: 'Zweideutigkeiten sind Pflicht: Wer etwas Eindeutiges sagt, hat verstoßen.' },
];
