/**
 * Probe: die Ruestkammer von Tafelrunde — Brett, Bank und Laden, ohne
 * Anmeldung und ohne Partie.
 *
 * Erreichbar unter `/probe/ruestkammer` und sonst nirgends. Das Gegenstueck zu
 * `/probe/kampf`, das dasselbe fuer die Arena tut, und aus demselben Grund
 * gebaut: An eine ausgebaute Ruestkammer kam man bisher nur, indem man sich
 * anmeldete, einen Tisch eroeffnete und zehn Runden mitspielte.
 *
 * WARUM ES SIE GEBEN MUSSTE. Beim Umbau auf die 3D-Figuren (6.9.2026) ist
 * dafuer eine Wegwerf-Probe gebaut und wieder geloescht worden, die die
 * Klassen aus styles.css von Hand nachstellte. Eine nachgestellte Wabe zeigt
 * aber nicht, wie die Figur auf der ECHTEN sitzt — genau davor warnt der Kopf
 * von `ProbeKampf.tsx`, und genau das ist hier zweimal passiert. Die Masse der
 * Figur auf der Wabe sind gerechnet UND am Bildschirm nachgesehen; wer sie das
 * naechste Mal anfasst (groessere Figur, anderer Kamerawinkel, sechste Rolle),
 * braucht denselben Blick.
 *
 * DESHALB WIRD HIER NICHTS NACHGEBAUT. Es laufen `Hexbrett`, `Bankreihe`,
 * `Einheitenmarke`, `Ladenkarte`, `Mitspielerleiste`, `Phasenzeile`,
 * `Statuszeile` und `Brettkopf` aus `minispiele/tafelrunde/` — dieselben
 * Bauteile, die `screens/Tafelrunde.tsx` einhaengt, mit denselben
 * Eigenschaften, im selben Rahmen (`.tr-seite`, `.tr-tisch`, `.tr-oben`,
 * `.tr-spielflaeche`, `.tr-bretter`, `.tr-fuss`). Sie standen bis zum
 * 06.09.2026 privat im Bildschirm; sie herauszuziehen war die halbe Aufgabe.
 * Die beiden Kopfzeilen kamen als letzte nach (19.09.2026) — sie waren bis
 * dahin hier von Hand aufgebaut, und beim Handy-Umbau am 06.09.2026 bekam
 * nur der Tisch die neue Reihe: Die Probe zeigte einen Bildschirm, den es
 * nicht gab.
 *
 * SEIT DEM 07.09.2026 BEANTWORTET SIE AUCH DIE HOEHENFRAGE: Passt die
 * Ruestkammer auf einen Bildschirm? Dafuer musste sie die echte Kopfleiste
 * bekommen und ihre eigene Bedienung abgeben — die liegt jetzt als
 * zuklappbare Werkbank UEBER dem Tisch. Vorher standen Kopfzeile und
 * Erklaertext im Fluss und nahmen bis zu 155 Pixel, die es am echten Tisch
 * nicht gibt: Die Probe zeigte ein deutlich kleineres Brett, als dort steht.
 * Nachgemessen wird mit `werkzeug/hoehenprobe.mjs`, das genau diese Seite
 * anfaehrt.
 *
 * DER STAND kommt aus `ruestkammer-szene.json`: die Vorbereitung einer echten
 * Bot-Partie, angehalten mitten im Zug (`ruestkammer-erzeugen.mjs`, dort steht
 * auch, wonach der Stand ausgesucht wurde). Feste Saat, also jedes Mal
 * derselbe Bildschirm — sonst vergleicht man zwei Staende statt zwei Fassungen
 * der Anzeige.
 *
 * WAS DIE PROBE NICHT TUT: Sie kauft nicht, sie wuerfelt nicht, sie rechnet
 * kein Gold. Alles, was am Tisch aus `legalActions` kommt, steht als fertige
 * Angabe in der Szene (`kaufbar`, `darfWuerfeln`, `darfLevel`). Eine Probe,
 * die selbst entscheidet, waere eine zweite Regelfassung — und die faellt beim
 * ersten geaenderten Preis auseinander, ohne dass es jemand merkt.
 *
 * BEWEGEN kann man trotzdem: Antippen — im Blatt „Aufstellen" — Ziel
 * antippen. Das ist keine Regel, die hier nachgebaut waere, sondern
 * `tippfolge` aus `zuege.ts`, dieselbe reine Funktion, die auch der Tisch
 * benutzt. Dass ein Tipp seit dem 6.9.2026 zuerst das Blatt der Einheit
 * aufschlaegt, steht ebenso am Tisch (screens/Tafelrunde.tsx) — eine Probe,
 * die sich anders bedienen liesse als der Bildschirm, waere die Frage wert,
 * welche der beiden man gerade beurteilt.
 *
 * ZIEHEN MIT DEM FINGER geht seit dem 23.09.2026 ebenfalls, ueber denselben
 * Haken wie am Tisch (`useZiehen` in minispiele/tafelrunde/ziehen.ts). Bis
 * dahin hing die Zeigerverdrahtung im Bildschirm, und drei Zustaende gab es
 * nur in einer Partie: die stillgestellte Einheit am Herkunftsplatz
 * (`data-still`), das Feld unter dem Finger (`data-unterzeiger`) und den
 * Zugschatten (`.tr-schatten`). Weil eine Sichtprobe nicht ziehen kann,
 * stellt `?zug=bank:0>brett:4` einen angehaltenen Zug her — von wo, und
 * worueber der Finger gerade steht (`zugAusAdresse` unten). Ohne Ziel
 * (`?zug=bank:0`) haengt der Schatten ein Stueck ueber seiner Herkunft.
 *
 * ANSEHEN OHNE ANFASSEN geht seit dem 19.9.2026 ebenfalls wie am Tisch: Ein
 * Tipp auf eine Einheit des Gegners oder — „am Zug" abgeschaltet — auf eine
 * eigene schlaegt das Blatt ohne Knoepfe auf (`onNachsehen` in Brett.tsx).
 * Weil eine Sichtprobe nicht klicken kann, laesst sich dieser Zustand auch
 * ueber die Adresse herstellen: `?blatt=gegner/brett:4` oder `?bereit&blatt=
 * bank:0` (`blattAusAdresse` unten). Sonst hat die Adresse ausser `?zug=`
 * (siehe oben) keine Wirkung.
 *
 * WARUM `?raw` UND `JSON.parse` STATT EINES JSON-IMPORTS: Der Client
 * uebersetzt ohne `resolveJsonModule`; das anzuschalten waere eine Aenderung
 * an der gemeinsamen tsconfig wegen einer Probe. Dieselbe Zeile aus demselben
 * Grund wie in `../kampf/ProbeKampf.tsx`.
 */

import { useEffect, useMemo, useState } from 'react';

import { Bankreihe, Hexbrett, Zugschatten } from '../../minispiele/tafelrunde/Brett';
import { Einheitenblatt } from '../../minispiele/tafelrunde/Einheitenblatt';
import { Brettkopf, Statuszeile } from '../../minispiele/tafelrunde/Kopfzeilen';
import { Ladenkarte, kaufhindernis } from '../../minispiele/tafelrunde/Ladenkarte';
import { Mitspielerleiste, type Sitzzeile } from '../../minispiele/tafelrunde/Mitspieler';
import { Phasenzeile } from '../../minispiele/tafelrunde/Phasenzeile';
import {
  type Synergie,
  type Synergiestand,
  Markennamen,
  markennamen,
  schwellenPruefer,
  useMarkenblatt,
} from '../../minispiele/tafelrunde/Synergien';
import { GoldZeichen } from '../../minispiele/tafelrunde/Zeichen';
import type { Einheit, Stufenwerte } from '../../minispiele/tafelrunde/sicht';
import {
  type Kaempfer,
  type Ort,
  bestandVon,
  darfSchieben,
  fehlendeKopien,
  ortLesen,
  ortSchluessel,
  rastermass,
  tippfolge,
} from '../../minispiele/tafelrunde/zuege';
import { useZiehen } from '../../minispiele/tafelrunde/ziehen';

import rohszene from './ruestkammer-szene.json?raw';
import css from './ProbeRuestkammer.module.css';

/** Genau die Felder, die `ruestkammer-erzeugen.mjs` schreibt. */
interface Szene {
  readonly saat: string;
  readonly gangart: string;
  readonly sitze: readonly number[];
  readonly zuegeGespielt: number;
  readonly runde: number;
  readonly rundenGrenze: number;
  readonly ich: number;
  readonly brettReihen: number;
  readonly brettSpalten: number;
  readonly ladenPlaetze: number;
  readonly bankPlaetze: number;
  readonly verschmelzZahl: number;
  readonly maxStufe: number;
  readonly eigenes: {
    readonly sitz: number;
    readonly leben: number;
    readonly gold: number;
    readonly level: number;
    readonly einkommen: number;
    readonly belegt: number;
    readonly feldplaetze: number;
    readonly neuwuerfelnKosten: number;
    readonly aufstiegKosten: number | null;
    readonly laden: readonly (string | null)[];
    readonly bank: readonly (Kaempfer | null)[];
    readonly brett: readonly (Kaempfer | null)[];
    readonly synergien: Synergiestand[];
  };
  readonly gegner: {
    readonly sitz: number;
    readonly leben: number;
    readonly level: number;
    readonly ausRunde: number | null;
    readonly brett: readonly (Kaempfer | null)[];
    readonly synergien: Synergiestand[];
  };
  readonly kaufbar: readonly number[];
  readonly darfWuerfeln: boolean;
  readonly darfLevel: boolean;
  readonly katalog: readonly Einheit[];
  /** Werte und Verkaufserloes je Sternstufe, je Einheit — siehe sicht.ts. */
  readonly stufenwerte: Record<string, Stufenwerte[]>;
  readonly synergieTabelle: Synergie[];
}

const SZENE = JSON.parse(rohszene) as Szene;

/** Die Anzeige schlaegt je Kaempfer eine Kennung nach — deshalb als Tabelle. */
const KATALOG: Record<string, Einheit> = Object.fromEntries(
  SZENE.katalog.map((e) => [e.id, e]),
);

const KAUFBAR = new Set(SZENE.kaufbar);

/** Der Sitz, wie er am Tisch beschriftet waere — die Probe erfindet keine Namen. */
function nameVon(sitz: number): string {
  return `Sitz ${sitz + 1}`;
}

/**
 * Die Sitzzeilen fuer die Mitspielerleiste in der Kopfleiste.
 *
 * Dieselben Namen wie ueberall sonst in der Probe (`nameVon`) — kein Bild und
 * kein erfundener Spielername, denn die Szene fuehrt nur Sitznummern.
 */
const SITZZEILEN: readonly Sitzzeile[] = SZENE.sitze.map((sitz) => ({
  seat: sitz,
  displayName: nameVon(sitz),
  avatarUrl: null,
  isBot: sitz !== SZENE.ich,
}));

/**
 * Was auf Bank und Brett steht — der einzige Zustand, den die Probe fuehrt.
 *
 * Alles andere (Gold, Rang, Leben, Marken) steht fest in der Szene: Es aendert
 * sich am Tisch nur durch Zuege, die diese Probe bewusst nicht ausfuehrt.
 * Deshalb bleibt auch die Synergieleiste stehen, wenn man eine Einheit vom
 * Brett nimmt — sie zeigt den Stand der Szene, nicht eine hier nachgerechnete
 * Zaehlung. Wer das aendern will, braucht die Schwellen aus dem Modul, und die
 * gehoeren nicht in den Client.
 */
interface Stand {
  readonly bank: readonly (Kaempfer | null)[];
  readonly brett: readonly (Kaempfer | null)[];
}

const START: Stand = { bank: SZENE.eigenes.bank, brett: SZENE.eigenes.brett };

/** Ist beim Aufmachen kein Bankplatz mehr frei? Siehe `grund` am Laden. */
const BANK_VOLL = !SZENE.eigenes.bank.includes(null);

function schiebe(auf: Stand, von: Ort, nach: Ort): Stand {
  const bank = [...auf.bank];
  const brett = [...auf.brett];
  const reihe = (ort: Ort): (Kaempfer | null)[] => (ort.bereich === 'bank' ? bank : brett);
  const a = reihe(von)[von.platz] ?? null;
  const b = reihe(nach)[nach.platz] ?? null;
  reihe(nach)[nach.platz] = a;
  reihe(von)[von.platz] = b;
  return { bank, brett };
}

/** Verkaufen, soweit die Probe es zeigen kann: Der Platz wird leer. */
function nimmWeg(auf: Stand, ort: Ort): Stand {
  const bank = [...auf.bank];
  const brett = [...auf.brett];
  (ort.bereich === 'bank' ? bank : brett)[ort.platz] = null;
  return { bank, brett };
}

/** Welche Einheit ihr Blatt offen hat — Sitz und Ort, wie am Tisch. */
interface Blattlage {
  /** null ist das eigene Brett, sonst der Sitz des Gegners. */
  readonly sitz: number | null;
  readonly ort: Ort;
}

/**
 * Ein Blatt gleich beim Oeffnen, aus der Adresse: `?blatt=brett:4`,
 * `?blatt=bank:0` oder `?blatt=gegner/brett:4`. Nur fuer die Sichtprobe, die
 * nicht klicken kann; ohne den Parameter bleibt das Blatt zu.
 */
function blattAusAdresse(): Blattlage | null {
  const wert = new URLSearchParams(window.location.search).get('blatt');
  if (!wert) return null;
  const fremd = wert.startsWith('gegner/');
  const ort = ortLesen(fremd ? wert.slice('gegner/'.length) : wert);
  return ort ? { sitz: fremd ? SZENE.gegner.sitz : null, ort } : null;
}

/**
 * Ein angehaltener Zug gleich beim Oeffnen, aus der Adresse:
 * `?zug=bank:0>brett:4` — die Einheit von Bankplatz 0, der Finger ueber
 * Feld 4 — oder `?zug=bank:0` ohne Ziel. Nur fuer die Sichtprobe, die nicht
 * ziehen kann; ohne den Parameter faengt ein Zug erst mit dem Finger an.
 */
function zugAusAdresse(): { von: Ort; nach: Ort | null } | null {
  const wert = new URLSearchParams(window.location.search).get('zug');
  if (!wert) return null;
  const [vonText, nachText] = wert.split('>');
  const von = ortLesen(vonText);
  return von ? { von, nach: ortLesen(nachText) } : null;
}

/** Die Mitte des Platzes `ort` am Bildschirm — dort, wo `data-ziel` ihn nennt. */
function mitteVon(ort: Ort): { x: number; y: number } | null {
  const platz = document.querySelector(`[data-ziel="${ortSchluessel(ort)}"]`);
  if (!platz) return null;
  const rahmen = platz.getBoundingClientRect();
  return { x: rahmen.left + rahmen.width / 2, y: rahmen.top + rahmen.height / 2 };
}

export function ProbeRuestkammer(): React.JSX.Element {
  const [auf, setAuf] = useState<Stand>(START);
  const [gewaehlt, setGewaehlt] = useState<Ort | null>(null);
  const [laden, setLaden] = useState<readonly (string | null)[]>(SZENE.eigenes.laden);
  /*
   * „Am Zug" gegen „nicht am Zug" — der zweite Zustand JEDER Kachel, und der,
   * den man sonst nur sieht, wenn man selbst schon bereit ist oder der Kampf
   * laeuft: Einheiten sind nicht fassbar, Ziele sind gesperrt, Karten
   * ausgegraut.
   */
  const [amZug, setAmZug] = useState(
    /* `?bereit` in der Adresse stellt den zweiten Zustand her, ohne dass
       jemand die Werkbank bedienen muss — fuer die Sichtprobe. */
    !new URLSearchParams(window.location.search).has('bereit'),
  );
  /* Der Erklaertext ist zu, bis jemand ihn aufschlaegt: Er beschreibt die
     Probe und nicht die Ruestkammer — aufgeschlagen legt er sich ueber den
     Tisch, statt ihm Hoehe zu nehmen. */
  const [erklaerung, setErklaerung] = useState(false);
  /* Die Werkbank selbst laesst sich zuklappen: Am Handy liegt sie sonst genau
     auf der Kopfleiste, und die gehoert zu dem, was man hier ansehen will. */
  const [werkbank, setWerkbank] = useState(true);
  /*
   * Welche Einheit ihr Blatt aufgeschlagen hat — wie am Tisch der ORT und
   * nicht der Kaempfer: Was dort steht, aendert sich unter dem offenen Blatt,
   * sobald man verschiebt (screens/Tafelrunde.tsx). Mit Sitz, weil das Blatt
   * seit dem 19.9.2026 auch am Brett des Gegners aufgeht — dann ohne Knoepfe.
   */
  const [blatt, setBlatt] = useState<Blattlage | null>(blattAusAdresse);

  /*
   * Und welche LADENKARTE ihr Blatt offen hat — der Platz, aus demselben
   * Grund wie oben der Ort. Die Karte selbst ist eine Schaltflaeche; der Griff
   * dazu sitzt daneben (Ladenkarte.tsx).
   */
  const [ladenBlatt, setLadenBlatt] = useState<number | null>(null);

  /*
   * Die Grenze, die auch der Bildschirm prueft — und die einzige, die er
   * selbst prueft (siehe Kopf von screens/Tafelrunde.tsx): Von der Bank auf
   * ein FREIES Brettfeld nur, solange `belegt` unter `feldplaetze` liegt.
   * `belegt` kommt hier aus der laufenden Aufstellung und nicht aus der Szene,
   * sonst zaehlte die Probe eine Einheit, die man gerade heruntergenommen hat,
   * weiter mit.
   */
  const stellung = useMemo(
    () => ({
      bank: auf.bank,
      brett: auf.brett,
      feldplaetze: SZENE.eigenes.feldplaetze,
      belegt: auf.brett.filter((k) => k !== null).length,
    }),
    [auf],
  );

  const bestand = useMemo(() => bestandVon(stellung), [stellung]);
  const fehlen = (id: string, stufe = 1): number =>
    fehlendeKopien(bestand, SZENE.verschmelzZahl, id, stufe);

  const zielbar = (von: Ort, nach: Ort): boolean => darfSchieben(stellung, von, nach);

  function tippeOrt(ort: Ort): void {
    if (!amZug) return;
    const folge = tippfolge(stellung, gewaehlt, ort);
    /* Wie am Tisch: Ein Tipp ohne Auswahl schlaegt das Blatt der Einheit auf;
       ausgewaehlt wird von dort aus. Stuende hier `setGewaehlt`, verhielte
       sich die Probe anders als der Bildschirm, den sie zeigen soll. */
    if (folge.art === 'waehlen') setBlatt({ sitz: null, ort: folge.ort });
    else if (folge.art === 'abwaehlen') setGewaehlt(null);
    else if (folge.art === 'schieben') setze(folge.von, folge.nach);
  }

  /** Ablegen — vom Antippen und vom Ziehen, mit derselben Grenze wie am Tisch. */
  function setze(von: Ort, nach: Ort): void {
    if (!amZug || !zielbar(von, nach)) return;
    setAuf((a) => schiebe(a, von, nach));
    setGewaehlt(null);
  }

  /*
   * DIESELBE Zeigerverdrahtung wie am Tisch — nicht nachgebaut, sondern
   * eingehaengt. Ein Tipp ohne Bewegung laeuft darin in `tippeOrt`, ein
   * Ablegen in `setze`.
   */
  const { zug, ziehtVon, ablegeZiel, zeiger, vorfuehren } = useZiehen({
    darf: amZug,
    zielbar,
    tippe: tippeOrt,
    schiebe: setze,
  });

  /*
   * `?zug=` erst nach dem Aufbau: Die Lage des Schattens ist eine
   * Bildschirmkoordinate, und die gibt es erst, wenn die Waben stehen. Ohne
   * Ziel haengt er 80 Pixel ueber seiner Herkunft — dort verdeckt er nichts,
   * was man ansehen will.
   */
  useEffect(() => {
    const vorgabe = zugAusAdresse();
    if (!vorgabe) return;
    const bild = window.requestAnimationFrame(() => {
      const ziel = vorgabe.nach ? mitteVon(vorgabe.nach) : null;
      const herkunft = mitteVon(vorgabe.von);
      const punkt = ziel ?? (herkunft ? { x: herkunft.x, y: herkunft.y - 80 } : null);
      if (punkt) vorfuehren(vorgabe.von, punkt.x, punkt.y);
    });
    return () => window.cancelAnimationFrame(bild);
  }, [vorfuehren]);

  /** Was auf `blatt` steht — frisch aus dem Stand, siehe dort. Am fremden
      Brett aus der Szene: Der Gegner bewegt sich in der Probe nicht. */
  const blattKaempfer = blatt
    ? blatt.sitz === null
      ? ((blatt.ort.bereich === 'bank' ? auf.bank : auf.brett)[blatt.ort.platz] ?? null)
      : blatt.ort.bereich === 'brett'
        ? (SZENE.gegner.brett[blatt.ort.platz] ?? null)
        : null
    : null;
  const blattEinheit = blattKaempfer ? KATALOG[blattKaempfer.id] : undefined;
  const blattWerte =
    blattKaempfer && blattEinheit
      ? SZENE.stufenwerte[blattEinheit.id]?.[blattKaempfer.stufe - 1]
      : undefined;
  /* Nur lesen: am fremden Brett immer, am eigenen ohne „am Zug" — dieselbe
     Bedingung wie `blattNurLesen` am Tisch. */
  const blattNurLesen = blatt !== null && (blatt.sitz !== null || !amZug);
  /** Der erste freie Bankplatz — das Ziel von „Ablegen", wie am Tisch. */
  const freierBankplatz = Array.from({ length: SZENE.bankPlaetze }, (_, i) => i).find(
    (platz) => (auf.bank[platz] ?? null) === null,
  );

  /** Was am Finger haengt — frisch aus dem Stand, wie `blattKaempfer`. */
  const gezogen = zug
    ? ((zug.von.bereich === 'bank' ? auf.bank : auf.brett)[zug.von.platz] ?? null)
    : null;

  function zuruecksetzen(): void {
    setAuf(START);
    // Auch einen angehaltenen Zug (`?zug=`): Ihn beendet sonst kein Finger.
    zeiger.onZeigerAbbruch();
    setLaden(SZENE.eigenes.laden);
    setGewaehlt(null);
    setBlatt(null);
    setLadenBlatt(null);
  }

  /** Was die offene Ladenkarte anbietet — die Werte der ersten Stufe. */
  const ladenEinheit = ladenBlatt !== null ? KATALOG[laden[ladenBlatt] ?? ''] : undefined;

  const namen = markennamen(SZENE.synergieTabelle);
  const trifftSchwelle = schwellenPruefer(SZENE.eigenes.synergien, SZENE.synergieTabelle);
  /* Derselbe Griff wie am Tisch: Beide Blaetter fuehren zum Blatt einer
     Marke, und die Zaehler der Leiste bringen ihren eigenen mit. */
  const markengriff = useMarkenblatt(
    SZENE.eigenes.synergien,
    SZENE.synergieTabelle,
    KATALOG,
  );

  return (
    /*
     * Dieselben zwei Klassen wie am Tisch (`screens/Tafelrunde.tsx`): Sie
     * geben der Ruestkammer ihren dunkel-goldenen Raum und die Spalte, in der
     * sie steht. Auf einer weissen Seite saehe dasselbe Brett anders aus, und
     * dann beurteilt man den Rahmen statt die Wabe.
     */
    <main className="tr-seite tr-tisch">
      {/*
        DIE ECHTE KOPFLEISTE DES TISCHES, seit dem 07.09.2026 — Zurueck-Knopf,
        Mitspielerkacheln und Phasenzeile in `.tr-oben`, genau wie in
        screens/Tafelrunde.tsx.

        Sie steht hier, weil die Probe seither auch die Frage beantworten
        soll, OB die Ruestkammer auf einen Bildschirm passt. Das kann sie nur,
        wenn oben dasselbe steht wie am Tisch: Die eigene Kopfzeile der Probe
        war 64 bis 92 Pixel hoch und der Erklaertext darunter 95 bis 142 — die
        Probe war damit um bis zu 155 Pixel enger als der echte Tisch und
        zeigte ein deutlich kleineres Brett, als dort steht.

        Zwei Kacheln und nicht vier: Die Szene fuehrt den eigenen Sitz und
        EINEN Gegner mit Werten (`ruestkammer-szene.json`). Fuer die Hoehe
        macht das keinen Unterschied — die Kacheln stehen in einer Reihe, die
        seitlich rollt.
      */}
      <div className="tr-oben">
        <div className="tr-oben-reihe">
          <button className="tr-zurueck-oben" type="button" disabled aria-label="Zurück">
            ←
          </button>
          <Mitspielerleiste
            eigenes={{
              sitz: SZENE.eigenes.sitz,
              leben: SZENE.eigenes.leben,
              level: SZENE.eigenes.level,
              ausRunde: null,
              bereit: false,
            }}
            gegner={[
              {
                sitz: SZENE.gegner.sitz,
                leben: SZENE.gegner.leben,
                level: SZENE.gegner.level,
                ausRunde: SZENE.gegner.ausRunde,
                bereit: false,
              },
            ]}
            gegnerJetzt={SZENE.gegner.sitz}
            gezeigt={SZENE.gegner.sitz}
            sitze={SITZZEILEN}
            onWahl={() => undefined}
          />
        </div>
        {/* Ohne Frist: Die Probe hat keine Uhr, und eine ablaufende Zahl in
            einem angehaltenen Stand waere eine Behauptung. */}
        <Phasenzeile
          runde={SZENE.runde}
          phase="vorbereitung"
          frist={null}
          bereit={0}
          offen={SZENE.sitze.length}
        />
      </div>

      {/*
        Die Bedienung der Probe und ihr Erklaertext liegen UEBER dem Tisch und
        nicht darin: Was es am echten Tisch nicht gibt, darf dem Brett auch
        keine Hoehe wegnehmen. Vorher taten sie genau das (siehe oben).
      */}
      <div className={css.werkbank}>
        <div className={css.kopf}>
          <h1 className={css.titel}>Probe — die Rüstkammer</h1>
          {/* Zuklappbar, weil die Werkbank am Handy sonst genau die
              Kopfleiste verdeckt, die sie zeigen soll. */}
          <button
            type="button"
            className={css.knopf}
            aria-expanded={werkbank}
            onClick={() => setWerkbank((an) => !an)}
          >
            {werkbank ? 'zuklappen' : 'aufklappen'}
          </button>
        </div>
        {werkbank && (
          <div className={css.schalter}>
            <label className={css.schalt}>
              <input type="checkbox" checked={amZug} onChange={(e) => setAmZug(e.target.checked)} />
              am Zug
            </label>
            <button type="button" className={css.knopf} onClick={zuruecksetzen}>
              zurücksetzen
            </button>
            <button
              type="button"
              className={css.knopf}
              aria-expanded={erklaerung}
              onClick={() => setErklaerung((an) => !an)}
            >
              {erklaerung ? 'Text zu' : 'Was ist das?'}
            </button>
          </div>
        )}
        {werkbank && erklaerung && (
          <p className={css.fuss}>
            Runde {SZENE.runde} von {SZENE.rundenGrenze} einer Partie zu {SZENE.sitze.length} mit
            Bots (Saat „{SZENE.saat}", Gangart {SZENE.gangart}), angehalten nach{' '}
            {SZENE.zuegeGespielt} Zügen von {nameVon(SZENE.ich)}. Ein Tipp auf eine Einheit schlägt
            ihr Blatt auf; „Aufstellen" darin wählt sie, und der nächste Tipp setzt sie ab — oder man
            zieht sie mit dem Finger, genau wie am Tisch. Verkaufen nimmt sie hier nur vom
            Feld und zählt kein Gold, so wie ein Klick auf eine Karte sie nicht kauft, sondern nur
            ihren Platz abräumt: So sieht man den leeren Rahmen. Würfeln, Aufsteigen und Bereit tun
            nichts — das sind Regeln, und die bringt die Probe absichtlich nicht mit. „zurücksetzen"
            stellt alles wieder her.
          </p>
        )}
      </div>

      {/* Die Markennamen liegen als Kontext an, genau wie am Tisch: Die
          Zeichen sitzen tief im Baum (an jeder Einheit, an jeder Karte), und
          der Name waere sonst die neunzehnte durchgereichte Eigenschaft
          (Synergien.tsx). */}
      <Markennamen.Provider value={namen}>
        {/* Das Blatt einer angetippten Einheit — dasselbe Bauteil wie am
            Tisch. VERKAUFEN nimmt sie hier nur vom Feld und zaehlt kein Gold:
            Die Probe rechnet nichts (siehe Kopf), genau wie beim Klick auf
            eine Ladenkarte. „zuruecksetzen" holt beides zurueck. */}
        {blatt && blattKaempfer && blattEinheit && (
          <Einheitenblatt
            einheit={blattEinheit}
            kaempfer={blattKaempfer}
            werte={blattWerte}
            tabelle={SZENE.synergieTabelle}
            maxStufe={SZENE.maxStufe}
            erloes={blattWerte?.erloes}
            /* Ohne Knoepfe, sobald nur gelesen wird — wie am Tisch. */
            onVerkaufen={
              blattNurLesen
                ? undefined
                : () => {
                    setAuf((a) => nimmWeg(a, blatt.ort));
                    setBlatt(null);
                  }
            }
            onAblegen={
              !blattNurLesen && blatt.ort.bereich === 'brett' && freierBankplatz !== undefined
                ? () => {
                    setAuf((a) =>
                      schiebe(a, blatt.ort, {
                        bereich: 'bank',
                        platz: freierBankplatz,
                      }),
                    );
                    setBlatt(null);
                  }
                : undefined
            }
            onVerschieben={
              blattNurLesen
                ? undefined
                : () => {
                    setGewaehlt(blatt.ort);
                    setBlatt(null);
                  }
            }
            verschiebenTitel={blatt.ort.bereich === 'bank' ? 'Aufstellen' : 'Verschieben'}
            onMarke={markengriff.oeffne}
            escapeAus={markengriff.offeneMarke !== null}
            onSchliessen={() => setBlatt(null)}
          />
        )}

        {/* Das Blatt einer Ladenkarte — dasselbe Bauteil ohne Ort: Die Einheit
            steht noch nirgends, angeboten wird der Kauf. Die Probe kauft
            genauso wie der Knopf auf der Karte selbst. */}
        {ladenBlatt !== null && ladenEinheit && (
          <Einheitenblatt
            einheit={ladenEinheit}
            kaempfer={{ id: ladenEinheit.id, stufe: 1 }}
            werte={SZENE.stufenwerte[ladenEinheit.id]?.[0]}
            tabelle={SZENE.synergieTabelle}
            maxStufe={SZENE.maxStufe}
            erloes={undefined}
            /* Wie der Klick auf die Karte selbst: Er raeumt den Platz ab und
               kauft nichts — die Probe rechnet kein Gold (siehe `onKauf`
               unten). */
            onKaufen={
              amZug && KAUFBAR.has(ladenBlatt)
                ? () => {
                    setLaden((l) =>
                      l.map((eintrag, i) => (i === ladenBlatt ? null : eintrag)),
                    );
                    setLadenBlatt(null);
                  }
                : undefined
            }
            onMarke={markengriff.oeffne}
            escapeAus={markengriff.offeneMarke !== null}
            onSchliessen={() => setLadenBlatt(null)}
          />
        )}

        {/* Das Blatt einer Marke liegt ueber beiden — wie am Tisch. */}
        {markengriff.blatt}

        {/* Leben, Rang, Feldplaetze und die Marken in EINER Zeile —
            dasselbe Bauteil wie am Tisch (Kopfzeilen.tsx), seit dem
            19.09.2026 eingehaengt statt nachgeschrieben. Vorher stand der
            Aufbau hier ein zweites Mal, und beim Handy-Umbau am 06.09.2026
            bekam ihn nur der Tisch: Die Probe zeigte eine Zeile, die es
            nirgends gab.

            Die Zahlen stehen fest — die Probe spielt nicht. Nur `belegt`
            kommt aus der laufenden Aufstellung, sonst zaehlte sie eine
            Einheit weiter mit, die man gerade heruntergenommen hat. */}
        <Statuszeile
          werte={{
            leben: SZENE.eigenes.leben,
            level: SZENE.eigenes.level,
            belegt: stellung.belegt,
            feldplaetze: SZENE.eigenes.feldplaetze,
          }}
          staende={SZENE.eigenes.synergien}
          tabelle={SZENE.synergieTabelle}
        />

        {/* Derselbe Kasten wie am Tisch (`.tr-mitte`, screens/Tafelrunde.tsx):
            Er haelt alles zwischen Statuszeile und Laden zusammen, damit das
            Raster am breiten Schirm die beiden neben die Spielflaeche legen
            kann. Ohne ihn zeigte die Probe am Notebook einen anderen Aufbau
            als der Tisch — und sie ist das Werkzeug, mit dem der Aufbau
            gemessen wird (werkzeug/hoehenprobe.mjs). */}
        <div className="tr-mitte">
          {/* Die Spielflaeche: Bretter UND Bank in einem Kasten, genau wie am
              Tisch (screens/Tafelrunde.tsx). Sie bekommt den Platz, den
              Kopfzeile, Statuszeile und Laden uebriglassen, und rechnet daraus
              die Brettbreite — deshalb zeigt die Probe seit dem 07.09.2026 auch,
              OB die Ruestkammer auf einen Bildschirm passt, und nicht nur, wie
              sie aussieht. */}
          <div
            className="tr-spielflaeche"
            data-gegner=""
            data-bank=""
            style={
              {
                '--tr-brettverhaeltnis': rastermass(SZENE.brettReihen, SZENE.brettSpalten)
                  .seitenverhaeltnis,
              } as React.CSSProperties
            }
          >
            <div className="tr-bretter">
              {/* Das gegnerische Brett liegt oben und GESPIEGELT — so, wie die
                Heere spaeter aufeinandertreffen. Genau dieses Paar ist der
                Grund, warum die Probe beide Bretter zeigt und nicht nur das
                eigene: Ob die Figuren einander wirklich ansehen, sieht man erst
                hier. */}
              <section className="tr-brettteil tr-brettteil-fremd">
                {/* Name und Marken nebeneinander — dasselbe Bauteil wie am
                  Tisch (Kopfzeilen.tsx), samt dem Auge davor, das seit dem
                  06.09.2026 sagt, wessen Brett man sich gerade ansieht. Der
                  Gegner der Szene lebt; einen Ausgeschieden-Vermerk gibt es
                  hier deshalb nicht. */}
                <Brettkopf
                  name={nameVon(SZENE.gegner.sitz)}
                  ausRunde={SZENE.gegner.ausRunde}
                  staende={SZENE.gegner.synergien}
                  tabelle={SZENE.synergieTabelle}
                />
                <Hexbrett
                  reihen={SZENE.brettReihen}
                  spalten={SZENE.brettSpalten}
                  felder={SZENE.gegner.brett}
                  katalog={KATALOG}
                  gespiegelt
                  maxStufe={SZENE.maxStufe}
                  onNachsehen={(ort) => setBlatt({ sitz: SZENE.gegner.sitz, ort })}
                />
              </section>

              <section className="tr-brettteil">
                <Hexbrett
                  reihen={SZENE.brettReihen}
                  spalten={SZENE.brettSpalten}
                  felder={auf.brett}
                  katalog={KATALOG}
                  maxStufe={SZENE.maxStufe}
                  eigen
                  aktiv={amZug}
                  gewaehlt={gewaehlt}
                  istZiel={gewaehlt ? (ort) => zielbar(gewaehlt, ort) : undefined}
                  onWaehlen={tippeOrt}
                  onLeeresZiel={tippeOrt}
                  onNachsehen={(ort) => setBlatt({ sitz: null, ort })}
                  fehlendeKopien={fehlen}
                  ziehtVon={ziehtVon}
                  unterZeiger={ablegeZiel}
                  {...zeiger}
                />
              </section>
            </div>

            <Bankreihe
              plaetze={SZENE.bankPlaetze}
              bank={auf.bank}
              katalog={KATALOG}
              maxStufe={SZENE.maxStufe}
              aktiv={amZug}
              gewaehlt={gewaehlt}
              istZiel={gewaehlt ? (ort) => zielbar(gewaehlt, ort) : undefined}
              onWaehlen={tippeOrt}
              onNachsehen={(ort) => setBlatt({ sitz: null, ort })}
              fehlendeKopien={fehlen}
              ziehtVon={ziehtVon}
              unterZeiger={ablegeZiel}
              {...zeiger}
            />
          </div>
        </div>

        <div className="tr-fuss">
          <div className="tr-ladenkopf">
            <span className="tr-ladenwort">Laden</span>
            <span className="tr-goldstand">
              <GoldZeichen />
              <strong>{SZENE.eigenes.gold}</strong>
              <em>+{SZENE.eigenes.einkommen}</em>
            </span>
          </div>
          <div
            className="tr-laden"
            role="group"
            aria-label="Laden"
            /* Nur die Zahl der Plaetze, das Raster baut das Stylesheet —
               Begruendung am Tisch (screens/Tafelrunde.tsx). */
            style={{ '--tr-ladenplaetze': SZENE.ladenPlaetze } as React.CSSProperties}
          >
            {Array.from({ length: SZENE.ladenPlaetze }, (_, platz) => {
              const id = laden[platz] ?? null;
              const angeboten = id ? KATALOG[id] : undefined;
              /*
               * Kaufbar ist der Platz genau dann, wenn `erlaubteZuege` ihn
               * freigegeben hat — nachgerechnet wird hier nichts. Am Tisch
               * kommt dieselbe Menge als `legalActions` vom Server.
               */
              const darfKaufen = amZug && KAUFBAR.has(platz) && id !== null;
              return (
                <Ladenkarte
                  key={platz}
                  einheit={angeboten}
                  kaufbar={darfKaufen}
                  verschmilzt={id ? fehlen(id) === 1 : false}
                  fehlt={id ? fehlen(id) : 0}
                  verschmelzZahl={SZENE.verschmelzZahl}
                  marken={angeboten?.marken ?? []}
                  trifftSchwelle={trifftSchwelle}
                  /*
                   * Dieselbe Funktion, die auch der Tisch fragt
                   * (`kaufhindernis`) — hier stand einmal ein eigener
                   * Goldvergleich, und der waere die Beschriftung der Absage
                   * ein zweites Mal gewesen.
                   *
                   * Gefuettert wird sie mit den Zahlen der SZENE und nicht mit
                   * der laufenden Bank: `kaufbar` steht ebenfalls fest, und
                   * eine Sperre, die sich beim Verschieben aendert, waehrend
                   * die Freigabe daneben stehenbleibt, waere ein Widerspruch,
                   * den es am Tisch nicht gibt.
                   */
                  grund={
                    amZug && !darfKaufen
                      ? kaufhindernis(SZENE.eigenes.gold, BANK_VOLL, angeboten)
                      : null
                  }
                  /*
                   * KEIN KAUF. Der Klick raeumt den Platz nur ab — das zeigt
                   * `.tr-karte-leer`, den einzigen Kartenzustand, den man
                   * sonst gar nicht zu Gesicht bekommt, und behauptet dabei
                   * nichts ueber Gold, Bank oder Vorrat. „zuruecksetzen"
                   * bringt die Karte wieder.
                   */
                  onKauf={() =>
                    setLaden((l) => l.map((eintrag, i) => (i === platz ? null : eintrag)))
                  }
                  /* Der Griff zur Auskunft — echt wie alles hier: Er schlaegt
                     dasselbe Einheitenblatt auf wie am Tisch. */
                  onBlatt={angeboten ? () => setLadenBlatt(platz) : undefined}
                />
              );
            })}
          </div>
          <div className="tr-ladenknoepfe">
            <button type="button" className="tr-ladenknopf" disabled={!SZENE.darfWuerfeln}>
              Neu würfeln
              {SZENE.eigenes.neuwuerfelnKosten > 0 && (
                <em>
                  <GoldZeichen />
                  {SZENE.eigenes.neuwuerfelnKosten}
                </em>
              )}
            </button>
            <button type="button" className="tr-ladenknopf" disabled={!SZENE.darfLevel}>
              {SZENE.eigenes.aufstiegKosten === null ? 'Höchster Rang' : 'Rang steigern'}
              {SZENE.eigenes.aufstiegKosten !== null && (
                <em>
                  <GoldZeichen />
                  {SZENE.eigenes.aufstiegKosten}
                </em>
              )}
            </button>
            <button type="button" className="tr-bereitknopf" disabled>
              Bereit
            </button>
          </div>
        </div>

        {/* Was am Finger haengt — dasselbe Bauteil wie am Tisch. */}
        {zug && gezogen && (
          <Zugschatten
            kaempfer={gezogen}
            katalog={KATALOG}
            maxStufe={SZENE.maxStufe}
            x={zug.x}
            y={zug.y}
          />
        )}
      </Markennamen.Provider>
    </main>
  );
}
