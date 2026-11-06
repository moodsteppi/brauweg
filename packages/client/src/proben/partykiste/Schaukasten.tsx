/**
 * Schaukasten der Partykiste.
 *
 * Zeigt jede Ansicht des Spiels nebeneinander, mit erfundenen Sichten statt
 * eines echten Tisches. Er ist keine Spielerei: Die Bildschirme der Partykiste
 * haengen an Zustaenden, die man im Betrieb nur mit vier bis zwoelf Leuten
 * gleichzeitig herstellt — "alle haben abgestimmt ausser einem", "der Imposter
 * ist durchgekommen", "der dritte Tipp beim Bus war falsch". Wer die dafuer
 * jedes Mal nachstellt, sieht sie nie.
 *
 * Aufruf in der Entwicklung: `npm run dev:client`, dann
 * http://localhost:5173/schaukasten.html
 *
 *   ?fall=<name>    nur diesen einen Kasten (ohne Seitenkopf); jeder Kasten
 *                   traegt `data-fall="<name>"`, ein Selektor trifft genau ihn
 *   ?sprache=de|en  die Sprache vor dem ersten Zeichnen — fuer Vorher-Nachher-
 *                   Bilder derselben Ansicht
 *   ?von=&bis=      Ausschnitt der Spielrunden (wie bisher)
 *
 * Menue, Wartesaal und Endstand sind die echten Bausteine des Bildschirms
 * (screens/Partykiste.tsx). Was sie vom Server holen, beantwortet hier eine
 * Attrappe (`api` wird vor dem Zeichnen ueberschrieben) — nur auf dieser
 * Seite, die nicht mitgebaut wird.
 *
 * Die Sichten hier sind VON HAND geschrieben und kommen nicht aus dem Modul.
 * Das ist Absicht — der Schaukasten soll auch dann noch zeichnen, wenn das
 * Modul gerade nicht baut. Dass die Form stimmt, prueft der Typ
 * (`PartykisteSicht`) und der Vertrag unter src/vertrag/.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles.css';
import { api, type Me } from '../../api';
import { setzeSprachwahl } from '../../i18n';
import { istSprache } from '../../i18n/sprachen';
import { RegelsatzKontext } from '../../minispiele/partykiste/Regelzeile';
import { Endstand, Lobby, Partykiste, TischKopf } from '../../screens/Partykiste';
import { PartyAuswahl } from '../../minispiele/partykiste/Auswahl';
import { PartykisteBanner } from '../../minispiele/partykiste/Banner';
import { Einstellungen, OffeneRunde } from '../../minispiele/partykiste/Einstellungen';
import { Regelzeile } from '../../minispiele/partykiste/Regelzeile';
import { Runde } from '../../minispiele/partykiste/Runden';
import { Szene } from '../../minispiele/partykiste/Szene';
import { AktiveRegel } from '../../minispiele/partykiste/RundenOhneUhr';
import { PasstNicht } from '../../minispiele/partykiste/PasstNicht';
import {
  MINISPIEL_NAME,
  ansageFuer,
  type PartyLetzterWurf,
  type PartyMinispiel,
  type PartyRegelsatz,
  type PartykisteSicht,
} from '../../minispiele/partykiste/sicht';
import { Abrechnung, Tabelle } from '../../minispiele/partykiste/Wertung';
import { AufstellungSeite } from '../../minispiele/partykiste/Lager';
import { LetzterSchicht } from '../../minispiele/partykiste/LetzterWurf';
import type { SeatInfo } from '../../protocol';
import { bilderOhneUhr } from './bilder-ohne-uhr';
import { bilderZeitdruck } from './bilder-zeitdruck';

const SUCHE = new URLSearchParams(window.location.search);

/* Vor dem ersten Zeichnen, sonst steht das erste Bild in der falschen Sprache. */
const SPRACHE = SUCHE.get('sprache');
if (istSprache(SPRACHE)) setzeSprachwahl(SPRACHE);

/** `?fall=…` — nur dieser Kasten. Ohne Angabe alle, wie bisher. */
const FALL = SUCHE.get('fall');

/**
 * Der Name eines Kastens fuer `?fall=` und `data-fall`. Aus dem Titel
 * abgeleitet, damit keiner der vielen Kaesten ohne Namen bleibt; eine
 * vorhandene `kennung` (data-sk der Sichtprobe) geht vor.
 */
function fallName(titel: string): string {
  return titel
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function zeigen(fall: string): boolean {
  return FALL === null || FALL === fall;
}

/*
 * Attrappe des Servers fuer Menue und Wartesaal. Die Bausteine holen sich
 * Konto, Vorgabe, Shop und Einladungscode selbst; ohne Antwort zeichnen sie
 * weniger (keine Einladung, keine Inhalte-Kacheln) — und genau deren Texte
 * fehlten dann im Bild.
 */
const ATTRAPPE_ME = {
  id: 'ich',
  gast: false,
  displayName: 'Robin',
  stage: 'production',
  activeTable: { tableId: 'probe', gameId: 'partykiste', status: 'waiting' },
} as unknown as Me;

Object.assign(api, {
  me: async () => ATTRAPPE_ME,
  shop: async () => ({ tischware: [] }),
  defaults: async () => ({
    config: {
      minispiele: Object.keys(MINISPIEL_NAME),
      inhaltsHaerte: 1,
      inhaltsMischung: 'genau',
      paket: null,
      modus: 'turnier',
    },
  }),
  tableRules: async () => ({ config: {} }),
  tischMitCode: async (id: string) => ({ table: { id, gameId: 'partykiste', status: 'waiting', joinCode: 'K7M2QX' } }),
  tischPerCode: async () => ({ id: 'probe', gameId: 'partykiste', host: 'Robin', occupied: 3, seats: 12 }),
});

const LEUTE = ['Robin', 'Jan', 'Tom', 'Emil', 'Niklas', 'Anni'];

const SITZE: SeatInfo[] = LEUTE.map((name, seat) => ({
  seat,
  displayName: name,
  accountId: seat === 0 ? 'ich' : `konto-${seat}`,
  isBot: seat >= 4,
  avatarUrl: null,
}));

/** Das Geruest jeder Sicht. Nur `art`, `phase` und `daten` unterscheiden sich. */
function sicht(teil: Partial<PartykisteSicht> & Pick<PartykisteSicht, 'art' | 'daten'>): PartykisteSicht {
  return {
    sitz: 0,
    sitze: 6,
    rundeNr: 2,
    runden: 6,
    phase: 'spiel',
    trinkmodus: true,
    schluckFaktor: 1,
    minispiele: Object.keys(MINISPIEL_NAME) as PartyMinispiel[],
    botSitze: [4, 5],
    ausgestiegen: [],
    punkte: [7, 9, 4, 11, 2, 6],
    schlucke: [3, 1, 5, 0, 6, 2],
    rundenPunkte: null,
    rundenSchlucke: null,
    amZug: 0,
    gehandelt: [1, 3],
    fertig: false,
    tabelle: [
      { sitz: 0, punkte: 7, schlucke: 3, platz: 3 },
      { sitz: 1, punkte: 9, schlucke: 1, platz: 2 },
      { sitz: 2, punkte: 4, schlucke: 5, platz: 5 },
      { sitz: 3, punkte: 11, schlucke: 0, platz: 1 },
      { sitz: 4, punkte: 2, schlucke: 6, platz: 6 },
      { sitz: 5, punkte: 6, schlucke: 2, platz: 4 },
    ],
    regelKarte: null,
    modus: 'turnier',
    paket: null,
    eskalation: null,
    inhaltsHaerte: 1,
    inhaltsMischung: 'genau',
    inhaltsHaerteGewollt: null,
    gezeigt: [],
    weiterFehlen: null,
    letzterWurf: null,
    lager: null,
    lagerTabelle: null,
    aufstellung: null,
    ...teil,
  };
}

/**
 * Was unter der Runde steht. Die Abrechnung und die Tabelle stehen seit dem
 * 22.09.2026 im Schaukasten — genau dort aendert der Trinkmodus etwas, und
 * bis dahin lagen beide nur im Bildschirm, wo sie niemand ohne vier Leute sah.
 */
type Zusatz = 'abrechnung' | 'tabelle';

interface Bild {
  titel: string;
  text: string;
  sicht: PartykisteSicht;
  zusatz?: Zusatz;
  /** Fuer die Sichtprobe: `figure[data-sk="…"]`. */
  kennung?: string;
}

/* Der Letzte beim „Weiter" (seit 07.10.2026): einmal getrunken, einmal Glueck. */
const ANSAGEN: { titel: string; text: string; kennung: string; wurf: PartyLetzterWurf }[] = [
  {
    titel: 'Der Letzte - ein Schluck',
    text: 'Wer beim „Weiter" zuletzt tippt, trinkt mit 50 % einen Schluck. Gewürfelt hat der Server; alle sehen dieselbe Ansage, dreieinhalb Sekunden lang über der nächsten Runde.',
    kennung: 'letzter-trinkt',
    wurf: { nr: 3, rundeNr: 2, sitz: 2, trinkt: true, schlucke: 1 },
  },
  {
    titel: 'Der Letzte - Glück gehabt',
    text: 'Die andere Hälfte: kein Schluck, nur die Ansage.',
    kennung: 'letzter-glueck',
    wurf: { nr: 4, rundeNr: 2, sitz: 3, trinkt: false, schlucke: 0 },
  },
];

const BILDER: Bild[] = [
  {
    titel: 'Imposter - dein Wort',
    text: 'Ein Wort, sonst nichts - und die Redereihenfolge. Darunter, wer noch nicht „Gesehen" getippt hat.',
    kennung: 'imposter-sehen',
    sicht: sicht({
      art: 'imposter',
      phase: 'sehen',
      gehandelt: [1, 3, 4],
      weiterFehlen: [0, 2, 5],
      daten: {
        art: 'imposter',
        meinWort: 'Schwimmbad',
        hinweis: null,
        reihenfolge: [2, 0, 5, 3, 1, 4],
        redeRunde: 1,
        nochmal: [],
        nochmalMoeglich: true,
        binImposter: false,
        abgestimmt: [],
        stimmen: null,
        imposter: null,
        echtesWort: null,
        ertappt: null,
      },
    }),
  },
  {
    titel: 'Imposter - du bist es',
    text: 'Der Imposter sieht, dass er es ist, und bekommt nur einen Hinweis. Mitreden muss er trotzdem.',
    sicht: sicht({
      art: 'imposter',
      phase: 'sehen',
      gehandelt: [1, 3, 4],
      daten: {
        art: 'imposter',
        meinWort: null,
        hinweis: 'Ein Ort mit Wasser',
        reihenfolge: [2, 0, 5, 3, 1, 4],
        redeRunde: 1,
        nochmal: [],
        nochmalMoeglich: true,
        binImposter: true,
        abgestimmt: [],
        stimmen: null,
        imposter: null,
        echtesWort: null,
        ertappt: null,
      },
    }),
  },
  {
    titel: 'Imposter - abstimmen',
    text: 'Nach der Rederunde: Wer passt nicht? Das eigene Wort bleibt klein im Blick.',
    sicht: sicht({
      art: 'imposter',
      phase: 'spiel',
      gehandelt: [1, 3],
      daten: {
        art: 'imposter',
        meinWort: 'Schwimmbad',
        hinweis: null,
        reihenfolge: [2, 0, 5, 3, 1, 4],
        redeRunde: 1,
        nochmal: [],
        nochmalMoeglich: true,
        binImposter: false,
        abgestimmt: [1, 3],
        stimmen: null,
        imposter: null,
        echtesWort: null,
        ertappt: null,
      },
    }),
  },
  {
    titel: 'Imposter - durchgekommen',
    text: 'Keine eindeutige Mehrheit: Der Imposter holt vier Punkte, die Runde trinkt.',
    sicht: sicht({
      art: 'imposter',
      phase: 'ergebnis',
      rundenPunkte: [0, 0, 0, 0, 4, 0],
      rundenSchlucke: [1, 1, 1, 1, 0, 1],
      gehandelt: [1],
      daten: {
        art: 'imposter',
        meinWort: 'Schwimmbad',
        hinweis: null,
        reihenfolge: [2, 0, 5, 3, 1, 4],
        redeRunde: 1,
        nochmal: [],
        nochmalMoeglich: true,
        binImposter: false,
        abgestimmt: [],
        stimmen: [1, 2, 3, 2, 0, 3],
        imposter: 4,
        echtesWort: 'Schwimmbad',
        ertappt: false,
      },
    }),
  },
  {
    titel: 'Allgemeinwissen',
    text: 'Vier Antworten, alle tippen gleichzeitig. Falsch heißt ein Schluck.',
    sicht: sicht({
      art: 'quiz',
      phase: 'spiel',
      daten: {
        art: 'quiz',
        frage: 'Welcher Fluss fließt durch Wien?',
        antworten: ['Donau', 'Rhein', 'Elbe', 'Weichsel'],
        meineWahl: -1,
        richtig: null,
        wahl: null,
      },
    }),
  },
  {
    titel: 'Allgemeinwissen - aufgelöst',
    text: 'Richtig steht grün, der eigene Fehlgriff rot. Darunter, wer was hatte.',
    sicht: sicht({
      art: 'quiz',
      phase: 'ergebnis',
      rundenPunkte: [0, 2, 2, 0, 2, 0],
      rundenSchlucke: [1, 0, 0, 1, 0, 1],
      daten: {
        art: 'quiz',
        frage: 'Welcher Fluss fließt durch Wien?',
        antworten: ['Donau', 'Rhein', 'Elbe', 'Weichsel'],
        meineWahl: 2,
        richtig: 0,
        wahl: [2, 0, 0, 3, 0, 1],
      },
    }),
  },
  {
    titel: 'Wer bin ich - du bist dran',
    text: 'Du siehst alle Namen außer deinem. Gefragt und geantwortet wird am Tisch.',
    sicht: sicht({
      art: 'werbinich',
      phase: 'spiel',
      amZug: 0,
      daten: {
        art: 'werbinich',
        namen: [null, 'Pippi Langstrumpf', 'Sherlock Holmes', 'Albert Einstein', 'Darth Vader', 'Mary Poppins'],
        amZug: 0,
        erfolg: [-1, -1, -1, -1, -1, -1],
      },
    }),
  },
  {
    titel: 'Wer bin ich - ein anderer rät',
    text: 'Bei den anderen steht ihr Name offen - deiner bleibt auch dann verdeckt.',
    sicht: sicht({
      art: 'werbinich',
      phase: 'spiel',
      amZug: 2,
      daten: {
        art: 'werbinich',
        namen: [null, 'Pippi Langstrumpf', 'Sherlock Holmes', 'Albert Einstein', 'Darth Vader', 'Mary Poppins'],
        amZug: 2,
        erfolg: [1, 0, -1, -1, -1, -1],
      },
    }),
  },
  {
    titel: 'Ich hab noch nie',
    text: 'Zwei Knöpfe. Wer gesteht, trinkt - wer sauber bleibt, bekommt einen Punkt.',
    sicht: sicht({
      art: 'niemals',
      phase: 'spiel',
      daten: {
        art: 'niemals',
        text: 'Ich hab noch nie eine Zimmerpflanze totgepflegt, obwohl sie als pflegeleicht galt.',
        meine: -1,
        gewaehlt: [1, 3, 4],
        gestanden: null,
      },
    }),
  },
  {
    titel: 'Ich hab noch nie - aufgedeckt',
    text: 'Und dann steht es da.',
    sicht: sicht({
      art: 'niemals',
      phase: 'ergebnis',
      rundenPunkte: [1, 0, 0, 1, 0, 1],
      rundenSchlucke: [0, 1, 1, 0, 1, 0],
      daten: {
        art: 'niemals',
        text: 'Ich hab noch nie eine Zimmerpflanze totgepflegt, obwohl sie als pflegeleicht galt.',
        meine: 0,
        gewaehlt: [0, 1, 2, 3, 4, 5],
        gestanden: [0, 1, 1, 0, 1, 0],
      },
    }),
  },
  {
    titel: 'Wer würde eher',
    text: 'Zeig auf einen. Jede Stimme, die jemand bekommt, ist für ihn ein Schluck.',
    sicht: sicht({
      art: 'wereher',
      phase: 'spiel',
      daten: {
        art: 'wereher',
        text: 'Wer würde eher aus Versehen die Gruppe im falschen Chat anschreiben?',
        meineStimme: -1,
        gewaehlt: [1, 4],
        stimmen: null,
      },
    }),
  },
  {
    titel: 'Wer würde eher - die Balken',
    text: 'Die Runde hat entschieden. Wer keine Stimme bekam, nimmt einen Punkt mit.',
    sicht: sicht({
      art: 'wereher',
      phase: 'ergebnis',
      rundenPunkte: [0, 1, 0, 1, 0, 1],
      rundenSchlucke: [3, 0, 2, 0, 1, 0],
      daten: {
        art: 'wereher',
        text: 'Wer würde eher aus Versehen die Gruppe im falschen Chat anschreiben?',
        meineStimme: 2,
        gewaehlt: [0, 1, 2, 3, 4, 5],
        stimmen: [2, 0, 0, 4, 2, 0],
      },
    }),
  },
  {
    titel: 'Bus fahren - du fährst',
    text: 'Drei Fragen hintereinander. Gleichstand zählt gegen den Fahrer.',
    sicht: sicht({
      art: 'busfahrer',
      phase: 'spiel',
      amZug: 0,
      daten: {
        art: 'busfahrer',
        amZug: 0,
        stufe: 1,
        offen: [{ rang: 7, farbe: 1 }],
        treffer: [-1, 3, 1, 0, -1, -1],
        letzter: { sitz: 0, stufe: 0, wahl: 0, karte: { rang: 7, farbe: 1 }, richtig: true },
      },
    }),
  },
  {
    titel: 'Schätzen',
    text: 'Eine Zahl eintippen. Der Nächste holt drei Punkte, der Weiteste trinkt zwei.',
    sicht: sicht({
      art: 'schaetzen',
      phase: 'spiel',
      daten: {
        art: 'schaetzen',
        frage: 'Wie hoch ist der Eiffelturm (mit Antenne)?',
        einheit: 'Meter',
        meine: null,
        gewaehlt: [1, 3],
        antwort: null,
        schaetzung: null,
      },
    }),
  },
  {
    titel: 'Schätzen - aufgelöst',
    text: 'Sortiert nach Abstand. Wer nicht getippt hat, steht ganz unten.',
    sicht: sicht({
      art: 'schaetzen',
      phase: 'ergebnis',
      rundenPunkte: [0, 3, 0, 0, 0, 0],
      rundenSchlucke: [0, 0, 0, 0, 2, 0],
      daten: {
        art: 'schaetzen',
        frage: 'Wie hoch ist der Eiffelturm (mit Antenne)?',
        einheit: 'Meter',
        meine: 300,
        gewaehlt: [0, 1, 2, 3, 4, 5],
        antwort: 330,
        schaetzung: [300, 325, 400, 280, null, 350],
      },
    }),
  },
  {
    titel: 'Entweder - oder',
    text: 'Zwei Knöpfe, sonst nichts. Die Minderheit trinkt.',
    sicht: sicht({
      art: 'entweder',
      phase: 'spiel',
      daten: { art: 'entweder', a: 'Meer', b: 'Berge', meine: -1, gewaehlt: [1, 2], seite: null },
    }),
  },
  {
    titel: 'Entweder - oder - aufgelöst',
    text: 'Die Mehrheit leuchtet grün und nimmt einen Punkt mit.',
    sicht: sicht({
      art: 'entweder',
      phase: 'ergebnis',
      rundenPunkte: [1, 0, 1, 1, 0, 1],
      rundenSchlucke: [0, 1, 0, 0, 1, 0],
      daten: {
        art: 'entweder',
        a: 'Meer',
        b: 'Berge',
        meine: 0,
        gewaehlt: [0, 1, 2, 3, 4, 5],
        seite: [0, 1, 0, 0, 1, 0],
      },
    }),
  },
  {
    titel: 'Wahrheit oder Pflicht - wählen',
    text: 'Erst die Wahl, dann die Aufgabe. Vorher sieht niemand beide.',
    sicht: sicht({
      art: 'wahrheitpflicht',
      phase: 'spiel',
      amZug: 0,
      daten: {
        art: 'wahrheitpflicht',
        amZug: 0,
        gewaehlt: [-1, -1, -1, -1, -1, -1],
        text: ['', '', '', '', '', ''],
        erfolg: [-1, -1, -1, -1, -1, -1],
      },
    }),
  },
  {
    titel: 'Wahrheit oder Pflicht - Aufgabe',
    text: 'Die Runde sieht die Aufgabe mit - sonst könnte man „gemacht" behaupten.',
    sicht: sicht({
      art: 'wahrheitpflicht',
      phase: 'spiel',
      amZug: 2,
      daten: {
        art: 'wahrheitpflicht',
        amZug: 2,
        gewaehlt: [1, 0, 1, -1, -1, -1],
        text: ['Sing den Refrain deines Lieblingssongs - laut.', 'Was war dein peinlichster Moment auf einer Party?', 'Mach 20 Sekunden den Akzent deiner Wahl, bis alle geraten haben, welcher es ist.', '', '', ''],
        erfolg: [1, 0, -1, -1, -1, -1],
      },
    }),
  },
  {
    titel: 'Bus fahren - daneben',
    text: 'Innen getippt, außen gekommen: ein Schluck, der Nächste steigt ein.',
    sicht: sicht({
      art: 'busfahrer',
      phase: 'spiel',
      amZug: 1,
      daten: {
        art: 'busfahrer',
        amZug: 1,
        stufe: 0,
        offen: [],
        treffer: [2, -1, 1, 0, -1, -1],
        letzter: {
          sitz: 0,
          stufe: 2,
          wahl: 0,
          karte: { rang: 14, farbe: 3 },
          richtig: false,
        },
      },
    }),
  },
  {
    titel: 'Bus fahren - daneben, alkoholfrei',
    text: 'Derselbe Fehlgriff ohne Trinkmodus: ein Strafpunkt statt eines Schlucks. Die Regelzeile oben sagt es auch.',
    sicht: sicht({
      art: 'busfahrer',
      phase: 'spiel',
      amZug: 1,
      trinkmodus: false,
      daten: {
        art: 'busfahrer',
        amZug: 1,
        stufe: 0,
        offen: [],
        treffer: [2, -1, 1, 0, -1, -1],
        letzter: { sitz: 0, stufe: 2, wahl: 0, karte: { rang: 14, farbe: 3 }, richtig: false },
      },
    }),
  },
  {
    titel: 'Allgemeinwissen - Abrechnung, Trinkmodus',
    text: 'Unter der Auflösung: was die Runde gebracht hat. Schlücke als Wort und Zahl, kein Glas mehr.',
    zusatz: 'abrechnung',
    sicht: sicht({
      art: 'quiz',
      phase: 'ergebnis',
      schluckFaktor: 2,
      rundenPunkte: [0, 2, 2, 0, 2, 0],
      rundenSchlucke: [2, 0, 0, 2, 0, 2],
      gehandelt: [],
      daten: {
        art: 'quiz',
        frage: 'Welcher Fluss fließt durch Wien?',
        antworten: ['Donau', 'Rhein', 'Elbe', 'Weichsel'],
        meineWahl: 2,
        richtig: 0,
        wahl: [2, 0, 0, 3, 0, 1],
      },
    }),
  },
  {
    titel: 'Allgemeinwissen - Abrechnung, wer fehlt',
    text: 'Schon „Weiter" getippt: Statt „Noch 2 Leute" stehen die Namen da - live, bis der Letzte tippt.',
    zusatz: 'abrechnung',
    kennung: 'abrechnung-fehlen',
    sicht: sicht({
      art: 'quiz',
      phase: 'ergebnis',
      rundenPunkte: [0, 2, 2, 0, 2, 0],
      rundenSchlucke: [1, 0, 0, 1, 0, 1],
      gehandelt: [0, 1, 2],
      weiterFehlen: [3],
      daten: {
        art: 'quiz',
        frage: 'Welcher Fluss fließt durch Wien?',
        antworten: ['Donau', 'Rhein', 'Elbe', 'Weichsel'],
        meineWahl: 2,
        richtig: 0,
        wahl: [2, 0, 0, 3, 0, 1],
      },
    }),
  },
  {
    titel: 'Allgemeinwissen - Abrechnung, alkoholfrei',
    text: 'Dieselbe Runde ohne Trinkmodus: gezählt wird genauso, nur heißt es Strafpunkte. Auch die Ansage oben redet nicht mehr vom Trinken.',
    zusatz: 'abrechnung',
    sicht: sicht({
      art: 'quiz',
      phase: 'ergebnis',
      trinkmodus: false,
      rundenPunkte: [0, 2, 2, 0, 2, 0],
      rundenSchlucke: [1, 0, 0, 1, 0, 1],
      gehandelt: [],
      daten: {
        art: 'quiz',
        frage: 'Welcher Fluss fließt durch Wien?',
        antworten: ['Donau', 'Rhein', 'Elbe', 'Weichsel'],
        meineWahl: 2,
        richtig: 0,
        wahl: [2, 0, 0, 3, 0, 1],
      },
    }),
  },
  {
    titel: 'Stand - alkoholfrei',
    text: 'Die Turniertabelle ohne Trinkmodus. Punkte entscheiden, die Strafpunkte stehen daneben.',
    zusatz: 'tabelle',
    sicht: sicht({
      art: 'entweder',
      phase: 'spiel',
      trinkmodus: false,
      schluckFaktor: 3,
      daten: { art: 'entweder', a: 'Meer', b: 'Berge', meine: -1, gewaehlt: [1, 2], seite: null },
    }),
  },
  /* Kategorien-Battle, Mehrheitsraten, Regel-Karte (22.09.2026). */
  ...bilderOhneUhr(sicht),
  ...bilderZeitdruck(sicht),
  /* -- Spielmodi (22.09.2026) ------------------------------------------- */
  {
    titel: 'Ich hab noch nie - Eskalation, Stufe 2',
    text: 'Das zweite Drittel: pikante Sprüche und doppelte Härte. Die Regelzeile sagt, wo die Kurve steht.',
    sicht: sicht({
      art: 'niemals',
      modus: 'eskalation',
      eskalation: { stufe: 2, inhaltsHaerte: 2, schluckFaktor: 2, gekappt: false },
      daten: { art: 'niemals', text: 'Ich hab noch nie auf einer Party gekifft.', meine: -1, gewaehlt: [1, 3], gestanden: null },
    }),
  },
  {
    titel: 'Entweder - oder - Eskalation, letzte Runde mit Gast',
    text: 'Stufe 3, aber ein Gast sitzt am Tisch: Die Härte steigt, die Texte bleiben pikant - und die Zeile sagt warum.',
    sicht: sicht({
      art: 'entweder',
      rundeNr: 5,
      modus: 'eskalation',
      eskalation: { stufe: 3, inhaltsHaerte: 2, schluckFaktor: 3, gekappt: true },
      daten: { art: 'entweder', a: 'Nie wieder Kaffee', b: 'Nie wieder Bier', meine: -1, gewaehlt: [2], seite: null },
    }),
  },
  {
    titel: 'Wahrheit oder Pflicht - Themenabend JGA',
    text: 'Das Paket bestimmt die Minispiele (neun von zwölf) und die Inhalte; die Zeile nennt das Thema.',
    sicht: sicht({
      art: 'wahrheitpflicht',
      modus: 'themenabend',
      paket: 'jga',
      minispiele: ['wahrheitpflicht', 'niemals', 'regelkarte', 'wereher', 'imposter', 'werbinich', 'mehrheit', 'entweder', 'busfahrer'],
      amZug: 0,
      daten: {
        art: 'wahrheitpflicht',
        amZug: 0,
        gewaehlt: [-1, -1, -1, -1, -1, -1],
        text: ['', '', '', '', '', ''],
        erfolg: [-1, -1, -1, -1, -1, -1],
      },
    }),
  },
  {
    titel: 'Stand - Team-Abend',
    text: 'Oben die Lager, darunter jede Person mit ihrem Lager. Der Platz ist der des Lagers - für die Trophäen zählt, wie das Lager abschneidet.',
    zusatz: 'tabelle',
    sicht: sicht({
      art: 'quiz',
      modus: 'team',
      lager: [0, 1, 0, 1, 0, 1],
      lagerTabelle: [
        { lager: 0, sitze: [0, 2, 4], punkte: 13, schlucke: 14, platz: 2 },
        { lager: 1, sitze: [1, 3, 5], punkte: 26, schlucke: 3, platz: 1 },
      ],
      tabelle: [
        { sitz: 0, punkte: 7, schlucke: 3, platz: 4 },
        { sitz: 1, punkte: 9, schlucke: 1, platz: 1 },
        { sitz: 2, punkte: 4, schlucke: 5, platz: 4 },
        { sitz: 3, punkte: 11, schlucke: 0, platz: 1 },
        { sitz: 4, punkte: 2, schlucke: 6, platz: 4 },
        { sitz: 5, punkte: 6, schlucke: 2, platz: 1 },
      ],
      daten: { art: 'quiz', frage: 'Wie viele Beine hat eine Spinne?', antworten: ['6', '8', '10', '12'], meineWahl: -1, richtig: null, wahl: null },
    }),
  },
  {
    titel: 'Stand - Team-Abend, ungleiche Lager',
    text: 'Vier gegen zwei, weil der Öffner getauscht hat: Es entscheidet der Schnitt je Kopf, nicht die Summe.',
    zusatz: 'tabelle',
    sicht: sicht({
      art: 'quiz',
      modus: 'team',
      lager: [0, 0, 0, 0, 1, 1],
      lagerTabelle: [
        { lager: 0, sitze: [0, 1, 2, 3], punkte: 31, schlucke: 9, platz: 1 },
        { lager: 1, sitze: [4, 5], punkte: 8, schlucke: 8, platz: 2 },
      ],
      tabelle: [
        { sitz: 0, punkte: 7, schlucke: 3, platz: 1 },
        { sitz: 1, punkte: 9, schlucke: 1, platz: 1 },
        { sitz: 2, punkte: 4, schlucke: 5, platz: 1 },
        { sitz: 3, punkte: 11, schlucke: 0, platz: 1 },
        { sitz: 4, punkte: 2, schlucke: 6, platz: 5 },
        { sitz: 5, punkte: 6, schlucke: 2, platz: 5 },
      ],
      daten: { art: 'quiz', frage: 'Wie viele Beine hat eine Spinne?', antworten: ['6', '8', '10', '12'], meineWahl: -1, richtig: null, wahl: null },
    }),
  },
];

/** Die Aufstellung des Team-Abends — einmal als Oeffner, einmal als Wartender. */
const AUFSTELLUNG = sicht({
  art: 'quiz',
  rundeNr: 0,
  modus: 'team',
  lager: [0, 1, 0, 0, 0, 1],
  aufstellung: { aufsteller: 0, wechselbar: [0, 1, 2, 3, 4, 5] },
  daten: { art: 'quiz', frage: '', antworten: [], meineWahl: -1, richtig: null, wahl: null },
});

function Kasten({ titel, text, sicht: bild, zusatz, kennung }: Bild): React.JSX.Element | null {
  const fall = kennung ?? fallName(titel);
  if (!zeigen(fall)) return null;
  return (
    <figure className="sk-kasten" data-sk={kennung} data-fall={fall}>
      <figcaption>
        <strong>{titel}</strong>
        <span>{text}</span>
      </figcaption>
      <div className="sk-rahmen">
        <main className="pk-seite pk-tisch" data-szene={bild.art}>
          <Szene art={bild.art} />
          {/* Der echte Kopf des Bildschirms statt einer Abschrift — eine Abschrift bliebe beim Uebersetzen deutsch. */}
          <TischKopf sicht={bild} tafel={zusatz === 'tabelle'} onTafel={() => {}} onVerlassen={() => {}} />
          <Regelzeile regeln={bild} />
          <AktiveRegel sicht={bild} sitze={SITZE} sende={() => {}} />
          {zusatz === 'tabelle' ? (
            <Tabelle sicht={bild} sitze={SITZE} />
          ) : (
            <>
              <p className="pk-ansage">{ansageFuer(bild.art, bild.trinkmodus)}</p>
              <Runde sicht={bild} sitze={SITZE} sende={() => {}} />
              {zusatz === 'abrechnung' ? (
                <Abrechnung sicht={bild} sitze={SITZE} binFertig={bild.gehandelt.includes(bild.sitz)} sende={() => {}} />
              ) : null}
            </>
          )}
        </main>
      </div>
    </figure>
  );
}

/** Ein Kasten mit Beschriftung und Handyrahmen; ohne `fall` zaehlt der Titel. */
function Figur({
  titel,
  text,
  fall = fallName(titel),
  kennung,
  rahmen = 'sk-rahmen',
  children,
}: {
  titel: string;
  text: string;
  fall?: string;
  kennung?: string;
  rahmen?: string;
  children: React.ReactNode;
}): React.JSX.Element | null {
  if (!zeigen(fall)) return null;
  return (
    <figure className="sk-kasten" data-sk={kennung} data-fall={fall}>
      <figcaption>
        <strong>{titel}</strong>
        <span>{text}</span>
      </figcaption>
      <div className={rahmen}>{children}</div>
    </figure>
  );
}

/** Ein Menue-Baustein ohne Tischkopf — im selben Handyrahmen. */
function MenueKasten({
  titel,
  text,
  fall,
  children,
}: {
  titel: string;
  text: string;
  fall: string;
  children: React.ReactNode;
}): React.JSX.Element | null {
  return (
    <Figur titel={titel} text={text} fall={fall}>
      <main className="pk-seite pk-menue">
        <div className="pk-menue-mitte">{children}</div>
      </main>
    </Figur>
  );
}

/** Der Regelsatz des Wartesaals — am echten Tisch kommt er vom Server. */
const LOBBY_REGELN: PartyRegelsatz = {
  minispiele: Object.keys(MINISPIEL_NAME) as PartyMinispiel[],
  trinkmodus: true,
  schluckFaktor: 2,
};

/** Zwoelf Plaetze, wie `oeffneRunde` sie anlegt; die hinteren sind frei. */
function lobbySitze(besetzt: number): SeatInfo[] {
  return Array.from({ length: 12 }, (_, seat) =>
    seat < besetzt
      ? { ...SITZE[seat % SITZE.length]!, seat, isBot: false }
      : { seat, displayName: null, accountId: null, isBot: false, avatarUrl: null },
  );
}

/** Endstand: dieselbe Tabelle wie im Turnier, nur `fertig`. */
const ENDSTAND = sicht({
  art: 'quiz',
  rundeNr: 5,
  fertig: true,
  daten: { art: 'quiz', frage: '', antworten: [], meineWahl: -1, richtig: null, wahl: null },
});

/** Der Wartesaal mit dem Regelsatz, den der Bildschirm sonst vom Server liest. */
function Wartesaal(props: Omit<React.ComponentProps<typeof Lobby>, 'onStart' | 'onZurueck'>): React.JSX.Element {
  return (
    <RegelsatzKontext.Provider value={{ regeln: LOBBY_REGELN, runden: props.runden }}>
      <Lobby {...props} onStart={() => {}} onZurueck={() => {}} />
    </RegelsatzKontext.Provider>
  );
}

/**
 * `?von=0&bis=4` zeigt nur einen Ausschnitt.
 *
 * Damit laesst sich die Seite in Stuecken abfotografieren — ein
 * Kopfloser-Browser-Schnappschuss nimmt immer nur den sichtbaren Anfang auf,
 * und die ganze Reihe ist mehrere Bildschirme lang.
 */
function ausschnitt(): { von: number; bis: number; kopf: boolean } {
  /* Mit `?fall=` zaehlt jeder Kasten, egal ob oben oder unter den Runden. */
  if (FALL !== null) return { von: 0, bis: BILDER.length, kopf: true };
  const von = Number(SUCHE.get('von'));
  const bis = Number(SUCHE.get('bis'));
  return {
    von: Number.isFinite(von) && von > 0 ? von : 0,
    bis: Number.isFinite(bis) && bis > 0 ? bis : BILDER.length,
    kopf: SUCHE.get('kopf') !== 'aus',
  };
}

function Schaukasten(): React.JSX.Element {
  const { von, bis, kopf } = ausschnitt();
  return (
    <div className="sk-seite">
      {kopf ? (
        <>
          {FALL === null ? (
            <>
              <h1>Partykiste - Schaukasten</h1>
              <p className="sk-vorwort">
                Jede Ansicht mit erfundenen Daten. Nichts davon ist mit einem Server verbunden;
                die Knöpfe tun absichtlich nichts.
              </p>
            </>
          ) : null}
          <Figur
            titel="Banner der Spielauswahl"
            text="Gezeichnet, nicht geladen - für die Kiste gibt es noch kein gemaltes Bild."
            fall="banner"
            rahmen="sk-rahmen sk-rahmen-banner"
          >
            <PartykisteBanner />
          </Figur>
          {/* -- Der Bildschirm selbst: Menue, Wartesaal, Endstand ---------- */}
          <Figur
            titel="Bildschirm - Menü"
            text="Der echte Einstieg (screens/Partykiste.tsx) ohne Tisch: Einstellungen, Auswahl, Gegen Bots, Beitrittscode."
            fall="menue"
            rahmen="sk-rahmen sk-rahmen-lang"
          >
            <Partykiste startTisch={null} onBack={() => {}} />
          </Figur>
          <Figur
            titel="Bildschirm - Menü, Einzelspiel Bus fahren"
            text="Dieselbe Kiste als Einzelspiel: Modus und Minispielwahl entfallen."
            fall="menue-einzel"
            rahmen="sk-rahmen sk-rahmen-lang"
          >
            <Partykiste startTisch={null} einzel="busfahrer" onBack={() => {}} />
          </Figur>
          <Figur
            titel="Bildschirm - Wartesaal, Öffner"
            text="Fünf von zwölf da: Regelzeile, Einladung mit Code, Link und QR, die Plätze und der Startknopf."
            fall="lobby-oeffner"
            rahmen="sk-rahmen sk-rahmen-schirm"
          >
            <Wartesaal sitze={lobbySitze(5)} meineKennung="ich" verbunden runden={6} />
          </Figur>
          <Figur
            titel="Bildschirm - Wartesaal, zu wenige, ohne Verbindung"
            text="Drei da: Der Startknopf ist aus, darunter der Grund. Dazu die Meldung der toten Leitung."
            fall="lobby-zu-wenige"
            rahmen="sk-rahmen sk-rahmen-schirm"
          >
            <Wartesaal sitze={lobbySitze(3)} meineKennung="ich" verbunden={false} runden={6} />
          </Figur>
          <Figur
            titel="Bildschirm - Wartesaal, Mitspieler"
            text="Wer nicht geöffnet hat, wartet auf den Ersten."
            fall="lobby-wartend"
            rahmen="sk-rahmen sk-rahmen-schirm"
          >
            <Wartesaal sitze={lobbySitze(6)} meineKennung="konto-2" verbunden runden={6} />
          </Figur>
          <Figur titel="Bildschirm - Endstand" text="Turnier vorbei: die Tabelle und „Fertig“." fall="endstand">
            <Endstand sicht={ENDSTAND} sitze={SITZE} wurf={null} onZu={() => {}} onFertig={() => {}} />
          </Figur>
          <MenueKasten
            fall="einstellungen-trinkspiel"
            titel="Menü - Einstellungen, Trinkspiel"
            text="Runden, Härte und Trinkmodus stehen offen im Menü und gelten online wie gegen Bots."
          >
            <Einstellungen runden={6} haerte={2} trinkmodus onRunden={() => {}} onHaerte={() => {}} onTrinkmodus={() => {}} />
          </MenueKasten>
          <MenueKasten
            fall="einstellungen-alkoholfrei"
            titel="Menü - Einstellungen, alkoholfrei"
            text="Ausgeschaltet heißt der Zähler Strafpunkte; der Hinweis sagt, dass die Turnierpunkte gleich bleiben."
          >
            <Einstellungen runden={8} haerte={1} trinkmodus={false} onRunden={() => {}} onHaerte={() => {}} onTrinkmodus={() => {}} />
          </MenueKasten>
          <MenueKasten
            fall="auswahl"
            titel="Menü - Auswahl"
            text="Minispiele an/aus (die Kiste mischt), Inhaltsstufe und Themenpaket. Ohne Modus: Das Modul kennt noch keinen."
          >
            <PartyAuswahl
              vorgabe={{ minispiele: Object.keys(MINISPIEL_NAME), inhaltsHaerte: 1, paket: null }}
              wahl={{ minispiele: ['quiz', 'imposter', 'entweder', 'wahrheitpflicht'], inhaltsHaerte: 2, paket: 'jga', modus: null }}
              gast={false}
              trinkmodus
              onWahl={() => {}}
            />
          </MenueKasten>
          <MenueKasten
            fall="auswahl-gast"
            titel="Menü - Auswahl als Gast, Modus bekannt, vier Inhalte-Kacheln"
            text="„derb“ gesperrt mit Grund; „gemischt“ heißt für den Gast harmlos und pikant. Die vierte Kachel und die Modus-Kacheln erscheinen erst, wenn defaultConfig() die Felder inhaltsMischung und modus hat."
          >
            <PartyAuswahl
              vorgabe={{ minispiele: Object.keys(MINISPIEL_NAME), inhaltsHaerte: 1, inhaltsMischung: 'genau', paket: null, modus: 'turnier' }}
              wahl={{ minispiele: null, inhaltsHaerte: 'gemischt', paket: null, modus: 'themenabend' }}
              gast
              trinkmodus={false}
              onWahl={() => {}}
            />
          </MenueKasten>
          <MenueKasten
            fall="passt-nicht"
            titel="Am Tisch - „Passt nicht“ (nur auf staging)"
            text="Leise unter der Runde, 44 pt. Zeigt die Runde mehrere Einträge, fragt das Blatt erst, welcher. Senden geht hier ins Leere - kein Server."
          >
            <PasstNicht
              gezeigt={[
                { katalog: 'identitaeten', kennung: 'p001', text: 'Harry Potter' },
                { katalog: 'identitaeten', kennung: 'p002', text: 'Barbie' },
                { katalog: 'regelkarten', kennung: 'r003', text: 'Keine Vornamen' },
              ]}
              tischId={null}
              stufe={2}
            />
          </MenueKasten>
          <MenueKasten
            fall="offene-runde"
            titel="Online - offene Runde gefunden"
            text="Erst ansehen, dann beitreten: Dort gilt der Regelsatz des Öffners, nicht die eigenen Einstellungen."
          >
            <OffeneRunde
              angebot={{
                id: 'probe',
                host: 'Robin',
                runden: 10,
                regeln: { minispiele: Object.keys(MINISPIEL_NAME) as PartyMinispiel[], trinkmodus: false, schluckFaktor: 2 },
              }}
              laedt={false}
              onBeitreten={() => {}}
              onEigene={() => {}}
              onAbbrechen={() => {}}
            />
          </MenueKasten>
          <Figur
            titel="Team-Abend - Lager aufstellen"
            text="Vor der ersten Runde: abwechselnd nach Sitz vorbelegt, der Öffner tippt Namen hinüber. Hier hat er Emil ins Lager A geholt."
            fall="aufstellung-oeffner"
          >
            <AufstellungSeite sicht={AUFSTELLUNG} sitze={SITZE} sende={() => {}} />
          </Figur>
          <Figur
            titel="Team-Abend - die anderen warten"
            text="Dieselben Spalten ohne Knöpfe, solange der Öffner aufstellt."
            fall="aufstellung-wartend"
          >
            <AufstellungSeite
              sicht={{ ...AUFSTELLUNG, sitz: 2, aufstellung: { aufsteller: 0, wechselbar: [] } }}
              sitze={SITZE}
              sende={() => {}}
            />
          </Figur>
          <MenueKasten
            fall="regelzeile-eskalation"
            titel="Wartesaal - Regelzeile, Eskalation"
            text="Vor der ersten Runde steht nur fest, dass die Härte steigt; im Spiel nennt die Zeile die Stufe."
          >
            <Regelzeile
              regeln={{ minispiele: Object.keys(MINISPIEL_NAME) as PartyMinispiel[], trinkmodus: true, schluckFaktor: 1, modus: 'eskalation' }}
              runden={9}
            />
          </MenueKasten>
          <MenueKasten
            fall="regelzeile"
            titel="Wartesaal - Regelzeile"
            text="Dieselbe Zeile steht im Wartesaal (vom Server gelesen) und im Spielkopf (aus der Sicht)."
          >
            <Regelzeile
              regeln={{ minispiele: ['imposter', 'quiz', 'niemals', 'wereher', 'entweder'], trinkmodus: true, schluckFaktor: 3 }}
              runden={6}
            />
          </MenueKasten>
          {ANSAGEN.map((a) => (
            <Figur key={a.kennung} titel={a.titel} text={a.text} fall={a.kennung} kennung={a.kennung}>
              <main className="pk-seite pk-tisch">
                <LetzterSchicht wurf={a.wurf} sitze={SITZE} ich={0} trinkmodus onZu={() => {}} fest />
                <header className="pk-kopf">
                  <span className="pk-rundenzahl">Runde 4/6</span>
                  <strong className="pk-spielname">Imposter</strong>
                </header>
              </main>
            </Figur>
          ))}
        </>
      ) : null}
      {BILDER.slice(von, bis).map((bild) => (
        <Kasten key={bild.titel} {...bild} />
      ))}
    </div>
  );
}

createRoot(document.getElementById('wurzel')!).render(
  <StrictMode>
    <Schaukasten />
  </StrictMode>,
);
