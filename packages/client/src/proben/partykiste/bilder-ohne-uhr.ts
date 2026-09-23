/**
 * Schaukasten-Bilder der drei Minispiele ohne Uhr (22.09.2026): jeder neue
 * Zustand einmal — Kategorien-Battle, Mehrheitsraten, Regel-Karte und die
 * Leiste der geltenden Regel waehrend eines ANDEREN Minispiels.
 *
 * Eigene Datei, damit `Schaukasten.tsx` nur eine Einhaengezeile bekommt. Das
 * Geruest der Sicht kommt vom Schaukasten (`sicht`), hier stehen nur die
 * Teile, die sich unterscheiden. Sechs Sitze wie dort: 0 bis 3 Menschen,
 * 4 und 5 Bots — deshalb braucht ein Einspruch gegen einen Menschen zwei
 * Stimmen (drei andere Menschen) und gegen einen Bot drei.
 */

import type { PartykisteSicht, RegelKarteSicht } from '../../minispiele/partykiste/sicht';

type Geruest = (teil: Partial<PartykisteSicht> & Pick<PartykisteSicht, 'art' | 'daten'>) => PartykisteSicht;

export interface OhneUhrBild {
  titel: string;
  text: string;
  sicht: PartykisteSicht;
  zusatz?: 'abrechnung' | 'tabelle';
}

const NOETIG = [2, 2, 2, 2, 3, 3];

const REGEL: RegelKarteSicht = {
  text: 'Keine Vornamen. Wer jemanden beim Namen nennt, hat verstoßen.',
  ab: 1,
  bis: 3,
  verstoesse: [0, 1, 0, 2, 0, 0],
  anklage: [-1, 2, -1, -1, -1, -1],
  noetig: NOETIG,
  meldenMoeglich: true,
};

export function bilderOhneUhr(sicht: Geruest): OhneUhrBild[] {
  return [
    {
      titel: 'Kategorien-Battle — du bist dran',
      text: 'Reihum im Kreis, bis einer stockt. Wer dran ist, nennt laut etwas und tippt „Genannt" — oder gibt zu, dass nichts mehr kommt.',
      sicht: sicht({
        art: 'kategorien',
        gehandelt: [],
        daten: {
          art: 'kategorien',
          kategorie: 'Automarken',
          amZug: 0,
          nennungen: 7,
          grenze: 24,
          letzter: 5,
          einspruch: [-1, -1, -1, -1, -1, -1],
          noetig: NOETIG,
          verlierer: -1,
          wie: null,
        },
      }),
    },
    {
      titel: 'Kategorien-Battle — Einspruch läuft',
      text: 'Tom ist dran, Jan hat eben genannt. Gegen beide geht Einspruch („Stockt!" / „Doppelt!"); es zählen nur die Menschen, Bots hören ja nicht mit.',
      sicht: sicht({
        art: 'kategorien',
        gehandelt: [],
        amZug: 2,
        daten: {
          art: 'kategorien',
          kategorie: 'Hauptstädte Europas',
          amZug: 2,
          nennungen: 13,
          grenze: 24,
          letzter: 1,
          einspruch: [-1, -1, -1, 1, -1, -1],
          noetig: NOETIG,
          verlierer: -1,
          wie: null,
        },
      }),
    },
    {
      titel: 'Kategorien-Battle — von der Runde benannt',
      text: 'Die Mehrheit hat entschieden: Jan hat gedoppelt. Er trinkt, alle anderen bekommen einen Punkt.',
      zusatz: 'abrechnung',
      sicht: sicht({
        art: 'kategorien',
        phase: 'ergebnis',
        gehandelt: [],
        rundenPunkte: [1, 0, 1, 1, 1, 1],
        rundenSchlucke: [0, 2, 0, 0, 0, 0],
        daten: {
          art: 'kategorien',
          kategorie: 'Hauptstädte Europas',
          amZug: 2,
          nennungen: 13,
          grenze: 24,
          letzter: 1,
          einspruch: [1, -1, -1, 1, -1, -1],
          noetig: NOETIG,
          verlierer: 1,
          wie: 'mehrheit',
        },
      }),
    },
    {
      titel: 'Kategorien-Battle — leergespielt',
      text: 'Vier Runden um den Tisch, niemand ist gestockt: Die Kategorie ist erledigt, alle bekommen den Punkt, keiner trinkt.',
      zusatz: 'abrechnung',
      sicht: sicht({
        art: 'kategorien',
        phase: 'ergebnis',
        gehandelt: [],
        rundenPunkte: [1, 1, 1, 1, 1, 1],
        rundenSchlucke: [0, 0, 0, 0, 0, 0],
        daten: {
          art: 'kategorien',
          kategorie: 'Obstsorten',
          amZug: 0,
          nennungen: 24,
          grenze: 24,
          letzter: 5,
          einspruch: [-1, -1, -1, -1, -1, -1],
          noetig: NOETIG,
          verlierer: -1,
          wie: null,
        },
      }),
    },
    {
      titel: 'Mehrheitsraten — antworten',
      text: 'Schritt 1: die eigene Antwort. Schritt 2 (nach dem Tippen): was sagt die Mehrheit? Beides geht zusammen raus.',
      sicht: sicht({
        art: 'mehrheit',
        gehandelt: [1, 3],
        daten: {
          art: 'mehrheit',
          frage: 'Lieber ein Jahr ohne Handy oder ein Jahr ohne Urlaub?',
          a: 'Ohne Handy',
          b: 'Ohne Urlaub',
          meine: -1,
          meinTipp: -1,
          gewaehlt: [1, 3],
          eigene: null,
          tipp: null,
          mehrheit: null,
        },
      }),
    },
    {
      titel: 'Mehrheitsraten — abgegeben',
      text: 'Die eigene Wahl steht da, fremde nicht: Vor der Abrechnung sähe man sonst, wohin die Mehrheit kippt.',
      sicht: sicht({
        art: 'mehrheit',
        gehandelt: [0, 1, 3],
        daten: {
          art: 'mehrheit',
          frage: 'Lieber ein Jahr ohne Handy oder ein Jahr ohne Urlaub?',
          a: 'Ohne Handy',
          b: 'Ohne Urlaub',
          meine: 1,
          meinTipp: 0,
          gewaehlt: [0, 1, 3],
          eigene: null,
          tipp: null,
          mehrheit: null,
        },
      }),
    },
    {
      titel: 'Mehrheitsraten — Abrechnung',
      text: 'Vier sagen „Ohne Urlaub", zwei „Ohne Handy". Gewertet wird der Tipp: Wer auf die Mehrheit getippt hat, bekommt zwei Punkte.',
      zusatz: 'abrechnung',
      sicht: sicht({
        art: 'mehrheit',
        phase: 'ergebnis',
        gehandelt: [],
        rundenPunkte: [0, 2, 2, 0, 2, 2],
        rundenSchlucke: [1, 0, 0, 1, 0, 0],
        daten: {
          art: 'mehrheit',
          frage: 'Lieber ein Jahr ohne Handy oder ein Jahr ohne Urlaub?',
          a: 'Ohne Handy',
          b: 'Ohne Urlaub',
          meine: 1,
          meinTipp: 0,
          gewaehlt: [0, 1, 2, 3, 4, 5],
          eigene: [1, 1, 0, 1, 0, 1],
          tipp: [0, 1, 1, 0, 1, 1],
          mehrheit: 1,
        },
      }),
    },
    {
      titel: 'Mehrheitsraten — Gleichstand, alkoholfrei',
      text: 'Drei zu drei: Es gibt keine Mehrheit, also lag jeder Tipp daneben — ein Strafpunkt für alle.',
      zusatz: 'abrechnung',
      sicht: sicht({
        art: 'mehrheit',
        phase: 'ergebnis',
        trinkmodus: false,
        gehandelt: [],
        rundenPunkte: [0, 0, 0, 0, 0, 0],
        rundenSchlucke: [1, 1, 1, 1, 1, 1],
        daten: {
          art: 'mehrheit',
          frage: 'Ananas auf der Pizza?',
          a: 'Ja, gern',
          b: 'Niemals',
          meine: 0,
          meinTipp: 1,
          gewaehlt: [0, 1, 2, 3, 4, 5],
          eigene: [0, 1, 0, 1, 0, 1],
          tipp: [1, 1, 0, 0, 1, 0],
          mehrheit: -1,
        },
      }),
    },
    {
      titel: 'Regel-Karte — neue Regel',
      text: 'Die Karte wird vorgelesen und bestätigt. Gelten tut sie ab jetzt bis zum Ende der übernächsten Runde.',
      sicht: sicht({
        art: 'regelkarte',
        rundeNr: 1,
        gehandelt: [2, 4, 5],
        daten: { art: 'regelkarte', text: REGEL.text, bis: 3 },
      }),
    },
    {
      titel: 'Regel-Karte — ab jetzt gilt',
      text: 'Nach dem Lesen: die Abrechnung der Karte (keine Punkte) — und oben steht die Regel jetzt als Leiste, die in den nächsten Runden bleibt.',
      zusatz: 'abrechnung',
      sicht: sicht({
        art: 'regelkarte',
        phase: 'ergebnis',
        rundeNr: 1,
        gehandelt: [],
        rundenPunkte: [0, 0, 0, 0, 0, 0],
        rundenSchlucke: [0, 0, 0, 0, 0, 0],
        regelKarte: { ...REGEL, verstoesse: [0, 0, 0, 0, 0, 0], anklage: [-1, -1, -1, -1, -1, -1] },
        daten: { art: 'regelkarte', text: REGEL.text, bis: 3 },
      }),
    },
    {
      titel: 'Regel gilt — mitten im Quiz',
      text: 'Die Regel wird während ANDERER Minispiele gebrochen. Selbst melden zählt sofort, jemanden melden erst mit der Mehrheit — Jan hat Tom schon gemeldet.',
      sicht: sicht({
        art: 'quiz',
        rundeNr: 2,
        gehandelt: [1],
        regelKarte: REGEL,
        daten: {
          art: 'quiz',
          frage: 'Wie viele Beine hat eine Spinne?',
          antworten: ['Sechs', 'Acht', 'Zehn', 'Zwölf'],
          meineWahl: -1,
          richtig: null,
          wahl: null,
        },
      }),
    },
    {
      titel: 'Regel gilt — Verstöße in der Abrechnung',
      text: 'Abgerechnet wird in der Runde, in der gemeldet wurde: Die Verstöße stehen als Schlücke neben den Quizpunkten. In der letzten Runde der Regel gibt es einen Punkt für jeden ohne Verstoß; danach ist Melden gesperrt, weil keine Abrechnung mehr käme.',
      zusatz: 'abrechnung',
      sicht: sicht({
        art: 'quiz',
        phase: 'ergebnis',
        rundeNr: 3,
        gehandelt: [],
        rundenPunkte: [3, 2, 3, 0, 3, 1],
        rundenSchlucke: [0, 1, 1, 3, 0, 1],
        regelKarte: { ...REGEL, meldenMoeglich: false },
        daten: {
          art: 'quiz',
          frage: 'Wie viele Beine hat eine Spinne?',
          antworten: ['Sechs', 'Acht', 'Zehn', 'Zwölf'],
          meineWahl: 1,
          richtig: 1,
          wahl: [1, 1, 1, 0, 1, 2],
        },
      }),
    },
  ];
}
