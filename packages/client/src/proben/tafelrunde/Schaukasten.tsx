/**
 * Schaukasten von Tafelrunde.
 *
 * Zeichnet die ECHTEN Ansichten — Einstieg (Menue, Suche, Erstellen,
 * Beitreten, Wartesaal, Aufbau), Ladevorhang und die Ruestkammer in allen
 * Phasen samt ihren Blaettern — mit erfundenen Sichten (`faelle.ts`), ohne
 * Server und ohne Anmeldung. Entstanden mit der englischen Fassung des Spiels
 * (Projekt „BroweGGames Language"): Vorher- und Nachher-Bilder brauchen einen
 * Zustand, der sich ohne vier Mitspieler und neun Runden herstellen laesst.
 *
 * Aufruf in der Entwicklung: `npm run dev:client`, dann
 * http://localhost:5173/tafelrunde-schaukasten.html?fall=ruesten&sprache=en
 *
 *   fall    ohne Angabe: alle Faelle untereinander, je in einem 390 px
 *           breiten Rahmen (iframe — damit Medienabfragen und `vw` wie am
 *           Handy rechnen). Mit Angabe: genau dieser Fall, bildschirmfuellend.
 *   sprache de · en — ohne Angabe gilt, was eingestellt ist
 *
 * Jeder Fall steckt in einem Element mit `data-fall="<name>"`.
 *
 * Offene Blaetter (Einheit, Laden, Marke, Regeln) entstehen nicht aus einem
 * Sonderweg in den Bauteilen, sondern so wie am Tisch: Nach dem ersten Bild
 * tippt der Schaukasten die Stelle an, die das Blatt aufschlaegt (`tippe`).
 * Die Ruestkammer selbst bleibt dabei unveraendert. Gewaehlt wird nach
 * Klassen und Attributen, nie nach Text — sonst fiele der Fall auf Englisch
 * aus.
 *
 * Ein Knopf schickt nichts ab. Nicht im Betriebsbau (Rollup-Eingabe ist
 * index.html).
 */

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles.css';
import type { TableRow } from '../../api';
import { setzeSprachwahl } from '../../i18n';
import { istSprache } from '../../i18n/sprachen';
import {
  AufbauNeu,
  BeitretenNeu,
  ErstellenNeu,
  MenueNeu,
  SucheNeu,
  WartesaalNeu,
} from '../../minispiele/tafelrunde/EinstiegNeu';
import { Ladebildschirm } from '../../minispiele/tafelrunde/Ladebildschirm';
import { Markennamen, markennamen } from '../../minispiele/tafelrunde/Synergien';
import {
  botStufen,
  RegelText,
  Ruestkammer,
  SITZ_WAHL,
} from '../../screens/Tafelrunde';
import {
  KATALOG,
  SITZE,
  STUFENWERTE,
  SYNERGIE_TABELLE,
  TISCHFAELLE,
} from './faelle';

const suche = new URLSearchParams(location.search);
const sprache = suche.get('sprache');
if (istSprache(sprache)) setzeSprachwahl(sprache);
const gewaehlterFall = suche.get('fall');

const nichts = (): void => undefined;

/** Der Tisch in einer der Phasen aus `faelle.ts`. */
function Tisch({ fall }: { fall: string }): React.JSX.Element {
  /* Einmal gebaut und festgehalten: Eine frische Sicht bei jedem Bild waere
     fuer die Effekte der Ruestkammer ein neuer Rundruf. */
  const [daten] = useState(() => TISCHFAELLE[fall]!());
  /* Die Frist einmal beim Zeichnen festlegen und nicht bei jedem Bild neu —
     sonst stuende die Uhr der Phasenzeile still. */
  const jetzt = useRef(Date.now()).current;
  return (
    <Markennamen.Provider value={markennamen(SYNERGIE_TABELLE)}>
      <Ruestkammer
        sicht={daten.sicht}
        katalog={KATALOG}
        synergieTabelle={SYNERGIE_TABELLE}
        stufenwerte={STUFENWERTE}
        legaleZuege={daten.legaleZuege}
        revision={1}
        frist={null}
        rundenfrist={daten.rundenfristIn === null ? null : jetzt + daten.rundenfristIn}
        sitze={SITZE}
        onAktion={nichts}
        onZurueck={nichts}
      />
    </Markennamen.Provider>
  );
}

const OFFENE_TISCHE: TableRow[] = [
  {
    id: 't1',
    gameId: 'tafelrunde',
    seats: 4,
    maxRounds: 1,
    visibility: 'public',
    occupied: 2,
    host: 'Jan',
    ruleCount: 0,
    stakes: null,
    variante: null,
  } as TableRow,
  {
    id: 't2',
    gameId: 'tafelrunde',
    seats: 8,
    maxRounds: 1,
    visibility: 'public',
    occupied: 5,
    host: 'Anni',
    ruleCount: 0,
    stakes: null,
    variante: null,
  } as TableRow,
];

interface Fall {
  name: string;
  titel: string;
  zeichne: () => React.JSX.Element;
  /**
   * CSS-Selektoren, die nach dem ersten Bild der Reihe nach angetippt
   * werden — so oeffnet sich ein Blatt wie am Tisch.
   */
  tippe?: string[];
}

const FAELLE: Fall[] = [
  {
    name: 'menue',
    titel: 'Hauptmenü',
    zeichne: () => (
      <MenueNeu
        aktiv={37}
        startet={false}
        fehler={null}
        regeln={<RegelText />}
        onBack={nichts}
        onSuche={nichts}
        onErstellen={nichts}
        onBeitreten={nichts}
        onBots={nichts}
      />
    ),
  },
  {
    name: 'suche',
    titel: 'Mitspielersuche',
    zeichne: () => <SucheNeu sekunden={18} gefunden={2} aktiv={37} onAbbrechen={nichts} />,
  },
  {
    name: 'erstellen',
    titel: 'Tisch erstellen',
    zeichne: () => (
      <ErstellenNeu
        sitzWahl={SITZ_WAHL}
        sitze={4}
        oeffentlich={false}
        botsFuellen
        botStufe="standard"
        botStufen={botStufen()}
        startet={false}
        fehler={null}
        onSitze={nichts}
        onOeffentlich={nichts}
        onBotsFuellen={nichts}
        onBotStufe={nichts}
        onErstellen={nichts}
        onZurueck={nichts}
      />
    ),
  },
  {
    name: 'beitreten',
    titel: 'Tisch beitreten',
    zeichne: () => (
      <BeitretenNeu
        code="KX7M9Q"
        codeFertig
        vorschau={{
          tableId: 't0',
          gameId: 'tafelrunde',
          seats: 4,
          occupied: 1,
          host: 'Robin',
          visibility: 'on_request',
        }}
        offeneTische={OFFENE_TISCHE}
        startet={false}
        fehler={null}
        onCode={nichts}
        onPerCode={nichts}
        onTisch={nichts}
        onZurueck={nichts}
      />
    ),
  },
  {
    name: 'wartesaal',
    titel: 'Wartesaal (Gastgeber)',
    zeichne: () => (
      <WartesaalNeu
        wartesaal={{ code: 'KX7M9Q', gastgeber: true, botsFuellen: true }}
        sitze={[
          { seat: 0, displayName: 'Robin', accountId: 'ich', isBot: false },
          { seat: 1, displayName: 'Jan', accountId: 'konto-1', isBot: false, gast: true },
          { seat: 2, displayName: null, accountId: null, isBot: false },
          { seat: 3, displayName: null, accountId: null, isBot: false },
        ]}
        botStufe="standard"
        botStufen={botStufen()}
        onBotStufe={nichts}
        onBotsFuellen={nichts}
        onStart={nichts}
        onAbbrechen={nichts}
      />
    ),
  },
  {
    name: 'aufbau',
    titel: 'Tisch wird aufgebaut',
    zeichne: () => (
      <AufbauNeu text="2 von 4 Plätzen besetzt" aktiv={37} onAbbrechen={nichts} />
    ),
  },
  {
    name: 'laden',
    titel: 'Ladevorhang',
    zeichne: () => (
      <Ladebildschirm
        stand={{ fertig: false, erledigt: 14, gesamt: 23, anteil: 0.58, fehlend: [] }}
        onAbbrechen={nichts}
      />
    ),
  },
  { name: 'ruesten', titel: 'Rüstphase', zeichne: () => <Tisch fall="ruesten" /> },
  {
    name: 'einheit',
    titel: 'Einheitenblatt (eigene Einheit)',
    zeichne: () => <Tisch fall="ruesten" />,
    tippe: ['.tr-einheit[data-fassbar]'],
  },
  {
    name: 'auswahl',
    titel: 'Einheit gewählt, Ziel antippen',
    zeichne: () => <Tisch fall="ruesten" />,
    /* Der erste Knopf des Blattes ohne eigene Beschriftung ist „Verschieben":
       Schliessen und die Markenknoepfe tragen ein aria-label. */
    tippe: ['.tr-einheit[data-fassbar]', '[role="dialog"] button:not([aria-label])'],
  },
  {
    name: 'gegnereinheit',
    titel: 'Einheitenblatt (Gegner, nur lesen)',
    zeichne: () => <Tisch fall="ruesten" />,
    tippe: ['.tr-einheit[data-lesbar]'],
  },
  {
    name: 'ladenblatt',
    titel: 'Ladenkarte nachschlagen',
    zeichne: () => <Tisch fall="ruesten" />,
    tippe: ['.tr-karte-info'],
  },
  {
    name: 'marke',
    titel: 'Synergie-Blatt',
    zeichne: () => <Tisch fall="ruesten" />,
    tippe: ['.tr-statuszeile button[aria-expanded]'],
  },
  {
    name: 'regeln',
    titel: 'Regelblatt',
    zeichne: () => <Tisch fall="ruesten" />,
    tippe: ['.tr-regelzeile'],
  },
  { name: 'bereit', titel: 'Bereit, warten auf die anderen', zeichne: () => <Tisch fall="bereit" /> },
  { name: 'kampf', titel: 'Kampfphase', zeichne: () => <Tisch fall="kampf" /> },
  { name: 'zuschauer', titel: 'Zuschauer', zeichne: () => <Tisch fall="zuschauer" /> },
  {
    name: 'ausgeschieden',
    titel: 'Endbild: ausgeschieden',
    zeichne: () => <Tisch fall="ausgeschieden" />,
  },
  { name: 'ende', titel: 'Endbild: gewonnen', zeichne: () => <Tisch fall="ende" /> },
];

/**
 * Ein Fall bildschirmfuellend.
 *
 * `transform` macht den Kasten zum Bezug fuer `position: fixed` — die
 * Ruestkammer (`.tr-seite`) und ihre Blaetter bleiben so IN `[data-fall]`,
 * und ein Bildschirmfoto des Elements zeigt genau den Fall.
 */
function EinFall({ fall }: { fall: Fall }): React.JSX.Element {
  const kasten = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const schritte = fall.tippe ?? [];
    const uhren: number[] = [];
    schritte.forEach((selektor, i) => {
      uhren.push(
        window.setTimeout(
          () => {
            const ziel = kasten.current?.querySelector<HTMLElement>(selektor);
            if (!ziel) {
              console.warn(`Schaukasten: ${selektor} nicht gefunden (Fall ${fall.name})`);
              return;
            }
            /* `detail: 0` wie Tastatur oder Vorlesegeraet: Die Einheitenmarke
               nimmt nur diesen Klick, weil Finger und Maus bei ihr ueber die
               Zeigerereignisse laufen (Brett.tsx). */
            ziel.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
          },
          150 * (i + 1),
        ),
      );
    });
    return () => uhren.forEach((u) => window.clearTimeout(u));
  }, [fall]);
  return (
    <div ref={kasten} className="sk-fall" data-fall={fall.name}>
      {fall.zeichne()}
    </div>
  );
}

/** Alle Faelle als Rahmen in Handygroesse, jeder in seinem eigenen Fenster. */
function Uebersicht(): React.JSX.Element {
  const zusatz = istSprache(sprache) ? `&sprache=${sprache}` : '';
  return (
    <div className="sk-seite">
      <h1>Tafelrunde — Schaukasten</h1>
      <p className="sk-vorwort">
        Jeder Fall einzeln: <code>?fall=&lt;name&gt;</code>, Sprache mit <code>&amp;sprache=en</code>.
      </p>
      <div className="sk-raster">
        {FAELLE.map((fall) => (
          <figure key={fall.name} className="sk-kasten" data-fall={fall.name}>
            <figcaption>
              <a href={`?fall=${fall.name}${zusatz}`}>
                <strong>{fall.name}</strong>
              </a>{' '}
              <span>{fall.titel}</span>
            </figcaption>
            <iframe
              title={fall.titel}
              src={`?fall=${fall.name}${zusatz}`}
              width={390}
              height={844}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}

const fall = gewaehlterFall ? FAELLE.find((f) => f.name === gewaehlterFall) : undefined;
if (gewaehlterFall && !fall) {
  console.warn(`Schaukasten: unbekannter Fall „${gewaehlterFall}" — es gibt ${FAELLE.map((f) => f.name).join(', ')}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{fall ? <EinFall fall={fall} /> : <Uebersicht />}</StrictMode>,
);
