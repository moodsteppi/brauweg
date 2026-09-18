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
 * Die Sichten hier sind VON HAND geschrieben und kommen nicht aus dem Modul.
 * Das ist Absicht — der Schaukasten soll auch dann noch zeichnen, wenn das
 * Modul gerade nicht baut. Dass die Form stimmt, prueft der Typ
 * (`PartykisteSicht`) und der Vertrag unter src/vertrag/.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles.css';
import { PartykisteBanner } from '../../minispiele/partykiste/Banner';
import { Runde } from '../../minispiele/partykiste/Runden';
import type { PartykisteSicht } from '../../minispiele/partykiste/sicht';
import type { SeatInfo } from '../../protocol';

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
    ...teil,
  };
}

const BILDER: { titel: string; text: string; sicht: PartykisteSicht }[] = [
  {
    titel: 'Imposter — dein Wort',
    text: 'Ein Wort, sonst nichts. Einer am Tisch hat ein anderes und weiß es nicht.',
    sicht: sicht({
      art: 'imposter',
      phase: 'sehen',
      gehandelt: [1, 3, 4],
      daten: {
        art: 'imposter',
        meinWort: 'Schwimmbad',
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
    titel: 'Imposter — abstimmen',
    text: 'Nach der Rederunde: Wer passt nicht? Das eigene Wort bleibt klein im Blick.',
    sicht: sicht({
      art: 'imposter',
      phase: 'spiel',
      gehandelt: [1, 3],
      daten: {
        art: 'imposter',
        meinWort: 'Schwimmbad',
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
    titel: 'Imposter — durchgekommen',
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
    titel: 'Allgemeinwissen — aufgelöst',
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
    titel: 'Wer bin ich — du bist dran',
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
    titel: 'Wer bin ich — ein anderer rät',
    text: 'Bei den anderen steht ihr Name offen — deiner bleibt auch dann verdeckt.',
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
    text: 'Zwei Knöpfe. Wer gesteht, trinkt — wer sauber bleibt, bekommt einen Punkt.',
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
    titel: 'Ich hab noch nie — aufgedeckt',
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
    titel: 'Wer würde eher — die Balken',
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
    titel: 'Bus fahren — du fährst',
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
    titel: 'Schätzen — aufgelöst',
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
    titel: 'Entweder – oder',
    text: 'Zwei Knöpfe, sonst nichts. Die Minderheit trinkt.',
    sicht: sicht({
      art: 'entweder',
      phase: 'spiel',
      daten: { art: 'entweder', a: 'Meer', b: 'Berge', meine: -1, gewaehlt: [1, 2], seite: null },
    }),
  },
  {
    titel: 'Entweder – oder — aufgelöst',
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
    titel: 'Wahrheit oder Pflicht — wählen',
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
    titel: 'Wahrheit oder Pflicht — Aufgabe',
    text: 'Die Runde sieht die Aufgabe mit — sonst könnte man „gemacht" behaupten.',
    sicht: sicht({
      art: 'wahrheitpflicht',
      phase: 'spiel',
      amZug: 2,
      daten: {
        art: 'wahrheitpflicht',
        amZug: 2,
        gewaehlt: [1, 0, 1, -1, -1, -1],
        text: ['Sing den Refrain deines Lieblingssongs — laut.', 'Was war dein peinlichster Moment auf einer Party?', 'Mach 20 Sekunden den Akzent deiner Wahl, bis alle geraten haben, welcher es ist.', '', '', ''],
        erfolg: [1, 0, -1, -1, -1, -1],
      },
    }),
  },
  {
    titel: 'Bus fahren — daneben',
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
];

function Kasten({
  titel,
  text,
  sicht: bild,
}: {
  titel: string;
  text: string;
  sicht: PartykisteSicht;
}): React.JSX.Element {
  return (
    <figure className="sk-kasten">
      <figcaption>
        <strong>{titel}</strong>
        <span>{text}</span>
      </figcaption>
      <div className="sk-rahmen">
        <main className="pk-seite pk-tisch">
          <header className="pk-kopf">
            <span className="pk-rundenzahl">
              Runde {bild.rundeNr + 1}/{bild.runden}
            </span>
            <strong className="pk-spielname">{titel.split(' —')[0]}</strong>
            <button className="pk-tafelknopf" type="button">
              Stand
            </button>
          </header>
          <Runde sicht={bild} sitze={SITZE} sende={() => {}} />
        </main>
      </div>
    </figure>
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
  const p = new URLSearchParams(window.location.search);
  const von = Number(p.get('von'));
  const bis = Number(p.get('bis'));
  return {
    von: Number.isFinite(von) && von > 0 ? von : 0,
    bis: Number.isFinite(bis) && bis > 0 ? bis : BILDER.length,
    kopf: p.get('kopf') !== 'aus',
  };
}

function Schaukasten(): React.JSX.Element {
  const { von, bis, kopf } = ausschnitt();
  return (
    <div className="sk-seite">
      {kopf ? (
        <>
          <h1>Partykiste — Schaukasten</h1>
          <p className="sk-vorwort">
            Jede Ansicht mit erfundenen Daten. Nichts davon ist mit einem Server verbunden;
            die Knöpfe tun absichtlich nichts.
          </p>
          <figure className="sk-kasten">
            <figcaption>
              <strong>Banner der Spielauswahl</strong>
              <span>Gezeichnet, nicht geladen — für die Kiste gibt es noch kein gemaltes Bild.</span>
            </figcaption>
            <div className="sk-rahmen sk-rahmen-banner">
              <PartykisteBanner />
            </div>
          </figure>
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
