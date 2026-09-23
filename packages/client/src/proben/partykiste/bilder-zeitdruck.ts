/**
 * Schaukasten-Bilder der drei Minispiele mit Uhr (23.09.2026): Bombe,
 * 10 Sekunden, Koenigsbecher — jeder neue Zustand einmal.
 *
 * Eigene Datei, damit `Schaukasten.tsx` nur eine Einhaengezeile bekommt. Das
 * Geruest der Sicht kommt vom Schaukasten (`sicht`), sechs Sitze wie dort:
 * 0 bis 3 Menschen, 4 und 5 Bots. Eine Uhr gibt es hier nicht — die laeuft
 * auf dem Server; die Bilder zeigen, was der Bildschirm zwischen zwei Sichten
 * stehen hat.
 */

import type { PartykisteSicht } from '../../minispiele/partykiste/sicht';

type Geruest = (teil: Partial<PartykisteSicht> & Pick<PartykisteSicht, 'art' | 'daten'>) => PartykisteSicht;

export interface ZeitdruckBild {
  titel: string;
  text: string;
  sicht: PartykisteSicht;
  zusatz?: 'abrechnung' | 'tabelle';
}

export function bilderZeitdruck(sicht: Geruest): ZeitdruckBild[] {
  return [
    {
      titel: 'Bombe — du hast sie',
      text: 'Reihum laut etwas aus der Kategorie nennen und weitergeben. Die Bombe tickt gleichmäßig; wann sie hochgeht, weiß nur der Server — die Frist geht nicht über die Leitung.',
      sicht: sicht({
        art: 'bombe',
        gehandelt: [],
        daten: { art: 'bombe', kategorie: 'Automarken', amZug: 0, weitergaben: 7, verlierer: -1 },
      }),
    },
    {
      titel: 'Bombe — ein anderer hat sie',
      text: 'Wer die Bombe nicht hat, sieht nur, bei wem sie gerade tickt.',
      sicht: sicht({
        art: 'bombe',
        gehandelt: [],
        amZug: 2,
        daten: { art: 'bombe', kategorie: 'Automarken', amZug: 2, weitergaben: 8, verlierer: -1 },
      }),
    },
    {
      titel: 'Bombe — hochgegangen',
      text: 'Wer sie in der Hand hatte, kassiert; alle anderen bekommen einen Punkt. Die Zündzeit steht auch hier nicht — der Tisch soll nicht lernen, wie lang eine Bombe tickt.',
      zusatz: 'abrechnung',
      sicht: sicht({
        art: 'bombe',
        phase: 'ergebnis',
        gehandelt: [],
        rundenPunkte: [1, 1, 0, 1, 1, 1],
        rundenSchlucke: [0, 0, 2, 0, 0, 0],
        daten: { art: 'bombe', kategorie: 'Automarken', amZug: 2, weitergaben: 13, verlierer: 2 },
      }),
    },
    {
      titel: '10 Sekunden — du bist dran',
      text: 'Die Aufgabe kommt erst mit „Los", für alle gleichzeitig. Vorher sieht sie niemand, auch der Sprecher nicht — sonst hätte er Bedenkzeit, die keine Uhr misst.',
      sicht: sicht({
        art: 'zehnsekunden',
        gehandelt: [],
        daten: {
          art: 'zehnsekunden',
          sprecher: 0,
          schritt: 'bereit',
          aufgabe: null,
          anzahl: 3,
          richter: [1, 2, 3],
          meinUrteil: -1,
          abgegeben: [],
          urteile: null,
          geschafft: null,
        },
      }),
    },
    {
      titel: '10 Sekunden — die Uhr läuft',
      text: 'Die Zeit misst der Server und schaltet danach selbst aufs Urteil. Angezeigt wird seine Frist (phaseDeadline); im Schaukasten gibt es keine, darum steht hier keine Zahl.',
      sicht: sicht({
        art: 'zehnsekunden',
        gehandelt: [],
        amZug: 1,
        daten: {
          art: 'zehnsekunden',
          sprecher: 1,
          schritt: 'sprechen',
          aufgabe: 'Dinge, die man im Bad findet',
          anzahl: 3,
          richter: [0, 2, 3],
          meinUrteil: -1,
          abgegeben: [],
          urteile: null,
          geschafft: null,
        },
      }),
    },
    {
      titel: '10 Sekunden — du urteilst',
      text: 'Es urteilen die Menschen außer dem Sprecher; Bots hören nicht zu. Wie die anderen geurteilt haben, steht erst in der Abrechnung.',
      sicht: sicht({
        art: 'zehnsekunden',
        gehandelt: [2],
        daten: {
          art: 'zehnsekunden',
          sprecher: 1,
          schritt: 'urteil',
          aufgabe: 'Dinge, die man im Bad findet',
          anzahl: 3,
          richter: [0, 2, 3],
          meinUrteil: -1,
          abgegeben: [2],
          urteile: null,
          geschafft: null,
        },
      }),
    },
    {
      titel: 'Königsbecher — du ziehst',
      text: 'Reihum eine Karte aus dem 52er-Blatt, jede Karte ist eine Regel. Der Text sagt „kassiert", nie „trinkt" — ob das ein Schluck ist, sagt der Trinkmodus.',
      sicht: sicht({
        art: 'koenigsbecher',
        gehandelt: [],
        daten: {
          art: 'koenigsbecher',
          amZug: 0,
          kartenJeSitz: 2,
          gezogen: [0, 1, 1, 1, 1, 1],
          restKarten: 47,
          letzte: {
            sitz: 5,
            karte: { rang: 13, farbe: 2 },
            kartenId: 'kb13',
            folge: 'becher',
            ziele: [],
            titel: 'Becher',
            text: 'Der Becher füllt sich. Wer den letzten König der Runde zieht, bekommt ihn.',
          },
          wahlOffen: false,
          hand: null,
          kassiert: [0, 1, 0, 2, 0, 1],
          becher: 1,
          koenigSitz: 5,
          neueRegel: null,
        },
      }),
    },
    {
      titel: 'Königsbecher — Hand hoch!',
      text: 'Nach einer Sieben tippen alle „Hand hoch". Die Frist (fünf Sekunden) läuft auf dem Server; wer bis dahin nicht tippt, kassiert — tippen alle, der Letzte.',
      sicht: sicht({
        art: 'koenigsbecher',
        gehandelt: [],
        amZug: 1,
        daten: {
          art: 'koenigsbecher',
          amZug: 3,
          kartenJeSitz: 2,
          gezogen: [1, 1, 1, 1, 1, 1],
          restKarten: 45,
          letzte: {
            sitz: 3,
            karte: { rang: 7, farbe: 0 },
            kartenId: 'kb07',
            folge: 'hand',
            ziele: [],
            titel: 'Hand hoch',
            text: 'Alle zeigen nach oben und tippen „Hand hoch" — wer zuletzt ist, kassiert.',
          },
          wahlOffen: false,
          hand: [4, 5, 2],
          kassiert: [0, 1, 0, 2, 0, 1],
          becher: 1,
          koenigSitz: 5,
          neueRegel: 'Keine Vornamen. Wer jemanden beim Namen nennt, hat verstoßen.',
        },
      }),
    },
    {
      titel: 'Königsbecher — du wählst',
      text: 'Eine Zwei: Wer zieht, zeigt auf jemanden. Dieselbe Geste wie „Wer würde eher", derselbe Knopf.',
      sicht: sicht({
        art: 'koenigsbecher',
        gehandelt: [],
        daten: {
          art: 'koenigsbecher',
          amZug: 0,
          kartenJeSitz: 2,
          gezogen: [2, 1, 1, 1, 1, 1],
          restKarten: 44,
          letzte: {
            sitz: 0,
            karte: { rang: 2, farbe: 1 },
            kartenId: 'kb02',
            folge: 'waehlen',
            ziele: [],
            titel: 'Du wählst',
            text: 'Zeig auf jemanden — der kassiert.',
          },
          wahlOffen: true,
          hand: null,
          kassiert: [0, 0, 0, 0, 0, 0],
          becher: 0,
          koenigSitz: -1,
          neueRegel: null,
        },
      }),
    },
  ];
}
