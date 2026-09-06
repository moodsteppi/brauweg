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
 * `Einheitenmarke` und `Ladenkarte` aus `minispiele/tafelrunde/` — dieselben
 * Bauteile, die `screens/Tafelrunde.tsx` einhaengt, mit denselben
 * Eigenschaften, im selben Rahmen (`.tr-seite`, `.tr-tisch`, `.tr-bretter`,
 * `.tr-fuss`). Sie standen bis zum 06.09.2026 privat im Bildschirm; sie
 * herauszuziehen war die halbe Aufgabe.
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
 * welche der beiden man gerade beurteilt. Das ZIEHEN mit dem Finger fehlt
 * — es haengt an Zeigererfassung und Zugschatten, also an Verdrahtung des
 * Bildschirms und nicht am Aussehen der Wabe.
 *
 * WARUM `?raw` UND `JSON.parse` STATT EINES JSON-IMPORTS: Der Client
 * uebersetzt ohne `resolveJsonModule`; das anzuschalten waere eine Aenderung
 * an der gemeinsamen tsconfig wegen einer Probe. Dieselbe Zeile aus demselben
 * Grund wie in `../kampf/ProbeKampf.tsx`.
 */

import { useMemo, useState } from 'react';

import { Bankreihe, Hexbrett } from '../../minispiele/tafelrunde/Brett';
import { Einheitenblatt } from '../../minispiele/tafelrunde/Einheitenblatt';
import { Ladenkarte, kaufhindernis } from '../../minispiele/tafelrunde/Ladenkarte';
import { AugeZeichen } from '../../minispiele/tafelrunde/Mitspieler';
import {
  type Synergie,
  type Synergiestand,
  Fremdmarken,
  Markennamen,
  Synergieleiste,
  markennamen,
  schwellenPruefer,
} from '../../minispiele/tafelrunde/Synergien';
import { GoldZeichen, LebenZeichen } from '../../minispiele/tafelrunde/Zeichen';
import type { Einheit, Stufenwerte } from '../../minispiele/tafelrunde/sicht';
import {
  type Kaempfer,
  type Ort,
  bestandVon,
  darfSchieben,
  fehlendeKopien,
  tippfolge,
} from '../../minispiele/tafelrunde/zuege';

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
  const [amZug, setAmZug] = useState(true);
  /*
   * Welche Einheit ihr Blatt aufgeschlagen hat — wie am Tisch der ORT und
   * nicht der Kaempfer: Was dort steht, aendert sich unter dem offenen Blatt,
   * sobald man verschiebt (screens/Tafelrunde.tsx).
   */
  const [blattOrt, setBlattOrt] = useState<Ort | null>(null);

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
    if (folge.art === 'waehlen') setBlattOrt(folge.ort);
    else if (folge.art === 'abwaehlen') setGewaehlt(null);
    else if (folge.art === 'schieben') {
      setAuf((a) => schiebe(a, folge.von, folge.nach));
      setGewaehlt(null);
    }
  }

  /** Was auf `blattOrt` steht — frisch aus dem Stand, siehe dort. */
  const blattKaempfer = blattOrt
    ? ((blattOrt.bereich === 'bank' ? auf.bank : auf.brett)[blattOrt.platz] ?? null)
    : null;
  const blattEinheit = blattKaempfer ? KATALOG[blattKaempfer.id] : undefined;
  const blattWerte =
    blattKaempfer && blattEinheit
      ? SZENE.stufenwerte[blattEinheit.id]?.[blattKaempfer.stufe - 1]
      : undefined;
  /** Der erste freie Bankplatz — das Ziel von „Ablegen", wie am Tisch. */
  const freierBankplatz = Array.from({ length: SZENE.bankPlaetze }, (_, i) => i).find(
    (platz) => (auf.bank[platz] ?? null) === null,
  );

  function zuruecksetzen(): void {
    setAuf(START);
    setLaden(SZENE.eigenes.laden);
    setGewaehlt(null);
    setBlattOrt(null);
  }

  const namen = markennamen(SZENE.synergieTabelle);
  const trifftSchwelle = schwellenPruefer(SZENE.eigenes.synergien, SZENE.synergieTabelle);

  return (
    /*
     * Dieselben zwei Klassen wie am Tisch (`screens/Tafelrunde.tsx`): Sie
     * geben der Ruestkammer ihren dunkel-goldenen Raum und die Spalte, in der
     * sie steht. Auf einer weissen Seite saehe dasselbe Brett anders aus, und
     * dann beurteilt man den Rahmen statt die Wabe.
     */
    <main className="tr-seite tr-tisch">
      <div className={css.kopf}>
        <h1 className={css.titel}>Probe — die Rüstkammer</h1>
        <div className={css.schalter}>
          <label className={css.schalt}>
            <input
              type="checkbox"
              checked={amZug}
              onChange={(e) => setAmZug(e.target.checked)}
            />
            am Zug
          </label>
          <button type="button" className={css.knopf} onClick={zuruecksetzen}>
            zurücksetzen
          </button>
        </div>
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
        {blattOrt && blattKaempfer && blattEinheit && (
          <Einheitenblatt
            einheit={blattEinheit}
            kaempfer={blattKaempfer}
            werte={blattWerte}
            tabelle={SZENE.synergieTabelle}
            maxStufe={SZENE.maxStufe}
            erloes={blattWerte?.erloes}
            onVerkaufen={() => {
              setAuf((a) => nimmWeg(a, blattOrt));
              setBlattOrt(null);
            }}
            onAblegen={
              blattOrt.bereich === 'brett' && freierBankplatz !== undefined
                ? () => {
                    setAuf((a) => schiebe(a, blattOrt, { bereich: 'bank', platz: freierBankplatz }));
                    setBlattOrt(null);
                  }
                : undefined
            }
            onVerschieben={() => {
              setGewaehlt(blattOrt);
              setBlattOrt(null);
            }}
            verschiebenTitel={blattOrt.bereich === 'bank' ? 'Aufstellen' : 'Verschieben'}
            onSchliessen={() => setBlattOrt(null)}
          />
        )}

        {/* Leben, Rang, Feldplaetze und die Marken in EINER Zeile — Aufbau
            und Klassen wie am Tisch (`.tr-statuszeile`, screens/Tafelrunde.tsx
            und styles.css). Die Zahlen stehen fest: Die Probe spielt nicht.

            Der Aufbau ist hier nachgeschrieben und nicht eingehaengt, weil er
            im Bildschirm noch kein eigenes Bauteil ist. Wer ihn dort aendert,
            aendert ihn hier mit — sonst zeigt ausgerechnet die Probe eine
            Zeile, die es am Tisch nicht gibt. */}
        <div className="tr-statuszeile">
          <header className="tr-kopf">
            <span className="tr-wert tr-wert-leben">
              <LebenZeichen />
              <strong>{SZENE.eigenes.leben}</strong>
              <em>Leben</em>
            </span>
            <span className="tr-wert tr-wert-level">
              <em>Rang</em>
              <strong>{SZENE.eigenes.level}</strong>
            </span>
            <span className="tr-wert tr-wert-feld">
              <strong>
                {stellung.belegt}/{SZENE.eigenes.feldplaetze} Feld
              </strong>
            </span>
          </header>
          <Synergieleiste
            staende={SZENE.eigenes.synergien}
            tabelle={SZENE.synergieTabelle}
          />
        </div>

        <div className="tr-bretter">
          {/* Das gegnerische Brett liegt oben und GESPIEGELT — so, wie die
              Heere spaeter aufeinandertreffen. Genau dieses Paar ist der
              Grund, warum die Probe beide Bretter zeigt und nicht nur das
              eigene: Ob die Figuren einander wirklich ansehen, sieht man erst
              hier. */}
          <section className="tr-brettteil tr-brettteil-fremd">
            {/* Name und Marken nebeneinander, wie am Tisch
                (`.tr-brettkopf`) — samt dem Auge davor, das seit dem
                06.09.2026 sagt, wessen Brett man sich gerade ansieht. */}
            <div className="tr-brettkopf">
              <h2 className="tr-bretttitel">
                <AugeZeichen />
                {nameVon(SZENE.gegner.sitz)}
              </h2>
              <Fremdmarken
                staende={SZENE.gegner.synergien}
                tabelle={SZENE.synergieTabelle}
                beschriftung={`Marken von ${nameVon(SZENE.gegner.sitz)}`}
              />
            </div>
            <Hexbrett
              reihen={SZENE.brettReihen}
              spalten={SZENE.brettSpalten}
              felder={SZENE.gegner.brett}
              katalog={KATALOG}
              gespiegelt
              maxStufe={SZENE.maxStufe}
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
              fehlendeKopien={fehlen}
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
          fehlendeKopien={fehlen}
        />

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
            style={{ gridTemplateColumns: `repeat(${SZENE.ladenPlaetze}, 1fr)` }}
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
      </Markennamen.Provider>

      <p className={css.fuss}>
        Runde {SZENE.runde} von {SZENE.rundenGrenze} einer Partie zu {SZENE.sitze.length} mit
        Bots (Saat „{SZENE.saat}", Gangart {SZENE.gangart}), angehalten nach{' '}
        {SZENE.zuegeGespielt} Zügen von {nameVon(SZENE.ich)}. Ein Tipp auf eine Einheit
        schlägt ihr Blatt auf; „Aufstellen" darin wählt sie, und der nächste Tipp setzt sie
        ab — Ziehen mit dem Finger gehört zum Tisch und nicht zur Wabe. Verkaufen nimmt sie
        hier nur vom Feld und zählt kein Gold, so wie ein Klick auf eine Karte sie nicht
        kauft, sondern nur ihren Platz abräumt: So sieht man den leeren Rahmen. Würfeln,
        Aufsteigen und Bereit tun nichts — das sind Regeln, und die bringt die Probe
        absichtlich nicht mit. „zurücksetzen" stellt alles wieder her.
      </p>
    </main>
  );
}
