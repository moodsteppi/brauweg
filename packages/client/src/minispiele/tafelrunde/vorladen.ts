import { useEffect, useState } from 'react';

import { BLATT_PFADE } from './bildfolge';
import { FIGUREN, UNTERGRUND } from './figuren';
import { PAKET } from './paket';

/**
 * Alles holen, bevor die erste Runde laeuft.
 *
 * Seit dem 6.9.2026 haengen ausserdem die fuenf Blaetter der 3D-Bildfolgen mit
 * drin (bildfolge.ts). Sie wiegen gut 280 kB — mehr als alles andere an
 * Bildern zusammen — und werden erst in der Kampfphase gebraucht; genau
 * deshalb muessen sie vorher da sein.
 *
 * Der Anlass ist gemessen (05.09.2026): Die 22 Figuren und der Holz-Untergrund
 * wurden nirgends vorgeladen. Jede Datei ging erst los, wenn eine Einheit zum
 * ersten Mal auf dem Bildschirm auftauchte — 23 einzelne Anfragen, verteilt
 * ueber die ersten Runden. Zusammen sind das nur 47 kB, aber wer im Laden
 * kauft, sieht den leeren Platz genau so lange, wie die Anfrage braucht. Auf
 * einer langsamen Leitung sind das die ersten Runden.
 *
 * Seit dem 6.9.2026 haengt das SPIELPAKET mit im selben Lauf (paket.ts). Es
 * ist der erste Posten der Liste und wiegt gut ein Drittel — ohne ihn zeigte
 * der Balken die zweite Haelfte einer Wartezeit, deren erste der Spieler vor
 * einem leeren Bildschirm verbracht hat.
 *
 * Drei Entscheidungen, die man dem Code sonst nicht ansieht:
 *
 *  1. **Die Liste wird aus `FIGUREN` abgeleitet, nicht danebengeschrieben.**
 *     Eine zweite Aufzaehlung ginge beim ersten neuen Recken auseinander — und
 *     zwar so, dass genau die neue Figur nicht vorgeladen waere, also die
 *     einzige, die niemand schon im Zwischenspeicher hat.
 *  2. **Gewartet wird auf `decode()`, nicht auf `onload`.** Ein geladenes,
 *     aber noch nicht entpacktes Bild erscheint erst einen Bildlauf spaeter;
 *     genau dieses Aufblitzen war bei Mememory schon einmal der Fehler
 *     (screens/Mememory.tsx). Entpackt wird ueber DENSELBEN Pfad, den die
 *     `<img>` spaeter benutzen: Der Browser fuehrt seinen Bildspeicher ueber
 *     die Adresse, ein Umweg ueber `blob:` waere also umsonst gewesen.
 *  3. **Der Fortschritt zaehlt Gewicht, nicht Dateien.** Bei 22 Winzlingen und
 *     einer 35-kB-Textur waere ein Dateizaehler eine Luege: Er stuende bei
 *     96 %, waehrend noch drei Viertel der Bytes unterwegs sind. Fuer die
 *     3D-Fassung ist das der eigentliche Punkt — dort stehen GLB-Modelle im
 *     Megabyte-Bereich neben Kleinkram, und ein Dateizaehler haenge
 *     minutenlang auf demselben Strich.
 *  4. **Es gibt zwei Holer, und die Wahl haengt an der Groesse.** `bildHolen`
 *     meldet sich genau einmal, naemlich fertig; `stromHolen` meldet je
 *     gelesenem Stueck. Alles, was laenger als die Ruhefrist am Stueck laden
 *     kann, gehoert an den zweiten — sonst schreibt die Uhr es mitten im
 *     Herunterladen ab (siehe `FRIST_MS`). Heute ist kein Posten so schwer:
 *     Das dickste Bild ist ein Blatt mit 78 kB.
 */

// ---------------------------------------------------------------------------
// Was geholt wird
// ---------------------------------------------------------------------------

export interface Posten {
  readonly pfad: string;
  /**
   * Grobes Gewicht in Kilobyte — NUR fuer die Breite des Balkens.
   *
   * Es muss nicht stimmen und wird bewusst nicht aus der Datei ermittelt: Ein
   * erzeugter Groessenkatalog waere die zweite Stelle, an der eine neue Figur
   * einzutragen waere (siehe Punkt 1 oben). Ein Wert in der richtigen
   * Groessenordnung genuegt, damit der Balken nicht luegt.
   *
   * Seit es Zwischenberichte gibt (`stromHolen`), ist der Wert ausserdem der
   * Massstab fuer eine halb geladene Datei — aber nur dann, wenn die
   * Gegenstelle keine `Content-Length` mitschickt. Sonst gilt fuer diesen
   * einen Posten die echte Groesse.
   */
  readonly kb: number;
  /**
   * Ein eigener Weg fuer Posten, die kein Bild sind.
   *
   * Bisher gibt es genau einen: das Spielpaket (paket.ts). Es kommt nicht
   * ueber eine Adresse, sondern ueber `import()` — den Dateinamen kennt nur
   * der Bauvorgang. Ohne diesen Haken muesste `bildHolen` Sonderfaelle nach
   * dem Pfad unterscheiden, und das waere die Stelle, an der die naechste
   * Sonderbehandlung dazukaeme.
   *
   * Der Parameter ist der Draht fuer Zwischenberichte (siehe `Fortschritt`).
   * Das Spielpaket braucht ihn nicht — ein `import()` hat keinen Zaehler —,
   * ein Posten aus `stromPosten` benutzt ihn.
   */
  readonly holen?: (melden: Fortschritt) => Promise<void>;
  /**
   * Wie viele DATEIEN dieser Posten ist. Vorgabe: eine.
   *
   * Nur fuer die Zahl neben dem Balken („x von y Dateien"), nie fuer seine
   * Breite — die rechnet mit `kb`. Ein Posten ist EINE Wartezeit mit einem
   * Ende, aber nicht zwangslaeufig eine Datei, und der Bildschirm nennt
   * Dateien.
   *
   * Es gibt genau einen mit mehr als einer: das Spielpaket (paket.ts). Vite
   * fordert beim `import()` fuenf Dateien gemeinsam an; ihre Namen tragen eine
   * Pruefsumme, die erst beim Bauen entsteht — aufzaehlen lassen sie sich hier
   * also nicht, mitzaehlen schon. Als eine gezaehlt stand der Bildschirm auf
   * „29 Dateien", waehrend 33 ueber die Leitung gingen.
   */
  readonly stueck?: number;
}

/** Wie viele Dateien ein Posten ist. Siehe `Posten.stueck`. */
function stueckZahl(posten: Posten): number {
  return posten.stueck ?? 1;
}

/**
 * Die Zahl neben dem Balken: Dateien, nicht Posten.
 *
 * Steht als Funktion da und nicht als `posten.length` an vier Stellen, weil
 * genau das der Fehler war — vier Stellen, die alle „Dateien" sagten und
 * Posten zaehlten.
 */
function stueckSumme(posten: readonly Posten[]): number {
  return posten.reduce((summe, p) => summe + stueckZahl(p), 0);
}

/**
 * Die vollstaendige Liste. Wer eine Figur in `figuren.ts` ergaenzt, ist damit
 * fertig — sie steht hier sofort mit drin.
 */
export const VORZULADEN: readonly Posten[] = [
  /* Das Spielpaket ganz vorn: Ohne den Schirm gibt es nichts zu zeigen, und
     die Anfragen gehen in der Reihenfolge dieser Liste raus. Es gehoert in
     denselben Lauf wie die Bilder, damit der Balken EINE Wartezeit zeigt und
     nicht zwei hintereinander — siehe paket.ts. */
  PAKET,
  /*
   * Die fuenf Blaetter der Bildfolgen (figuren3d.ts): zusammen gut 280 kB und
   * damit der schwerste Posten nach dem Spielpaket. Vor die Textur gezogen,
   * weil ohne sie im Kampf gar keine Figur steht — der Rueckfall auf die
   * Pixelfigur greift zwar (KampfAnzeige.tsx), aber der Kampf ist das
   * Schauspiel der Runde und soll nicht in der Ersatzbesetzung laufen.
   *
   * Aus BLATT_PFADE abgeleitet und nicht danebengeschrieben, aus demselben
   * Grund wie bei den Figuren (Punkt 1 oben).
   */
  ...BLATT_PFADE.map((pfad) => ({ pfad, kb: 58 })),
  /* Die Textur: die groesste Einzeldatei nach den Blaettern und die einzige,
     deren Fehlen man auf jedem Bildschirm sofort sieht. */
  { pfad: UNTERGRUND, kb: 35 },
  ...Object.values(FIGUREN).map((pfad) => ({ pfad, kb: 1 })),
];

/**
 * Die Frist ist eine RUHEFRIST und keine Gesamtzeit: Sie laeuft neu an, sobald
 * ein Posten eintrifft. Aufgegeben wird also erst, wenn so lange gar nichts
 * mehr passiert.
 *
 * Der Unterschied ist gemessen und nicht theoretisch. Gegen Chromes Profil
 * „Slow 3G" (2000 ms Latenz, ~50 kB/s) braucht der Satz ueber HTTP/1.1 mit
 * sechs Verbindungen 9,3 Sekunden — vier Wellen zu je zwei Sekunden Latenz.
 * Eine Gesamtfrist von zehn Sekunden haette dort also fast zugeschlagen, und
 * zwar auf einer Leitung, auf der alles funktioniert. Fuer die 3D-Fassung
 * waere sie vollends falsch: Ein GLB im Megabyte-Bereich laeuft ueber jede
 * vernuenftige Gesamtzeit hinaus.
 *
 * Wenn sie doch greift, ist das kein Beinbruch: `Figurbild` faellt bei einem
 * fehlenden Bild auf ein gezeichnetes Zeichen zurueck (KampfAnzeige.tsx).
 * Lieber ein Platzhalter als ein haengender Ladebildschirm.
 *
 * DER LANGE DOWNLOAD IST ABGEDECKT, seit es `stromHolen` gibt (6.9.2026).
 * Vorher meldete sich ein Posten nur EINMAL, naemlich fertig — eine Datei, die
 * laenger als die Ruhefrist am Stueck laedt, sah von hier aus wie eine tote
 * aus, und die Uhr haette sie mitten im Herunterladen abgeschrieben. Ein
 * Zwischenbericht stellt die Uhr jetzt genauso zurueck wie ein fertiger
 * Posten; gezaehlt wird damit wirklich Stillstand und nicht mehr „seit dem
 * letzten Dateiende".
 *
 * WER SICH NICHT ZWISCHENMELDET, ist deshalb nicht falsch bedient: `bildHolen`
 * kann es gar nicht (ein `<img>` hat keinen Zaehler), und bei 58 kB je Blatt
 * braucht es das auch nicht — auf gedrosseltem 3G ist ein Blatt in rund einer
 * Sekunde durch. Die Regel dahinter: Ein Posten, der laenger als `FRIST_MS`
 * am Stueck laden kann, gehoert an `stromPosten` und nicht an `bildHolen`.
 */
export const FRIST_MS = 15_000;

// ---------------------------------------------------------------------------
// Der Stand
// ---------------------------------------------------------------------------

export interface Ladestand {
  /** Fertig heisst: Es darf gespielt werden — auch wenn etwas fehlt. */
  readonly fertig: boolean;
  /** Erledigte Dateien (geladen ODER ausgefallen). Siehe `Posten.stueck`. */
  readonly erledigt: number;
  /** Alle Dateien des Laufs — nicht alle Posten. Siehe `Posten.stueck`. */
  readonly gesamt: number;
  /** 0 bis 1, nach Gewicht. Die Breite des Balkens. */
  readonly anteil: number;
  /** Was nicht kam. Im Betrieb leer; sonst steht es auch im Protokoll. */
  readonly fehlend: readonly string[];
}

const NOCH_NICHTS: Ladestand = {
  fertig: false,
  erledigt: 0,
  gesamt: stueckSumme(VORZULADEN),
  anteil: 0,
  fehlend: [],
};

/**
 * Ein Zwischenbericht EINES Postens: wie viele Bytes davon da sind — und wie
 * viele es werden, oder `null`, wenn die Gegenstelle keine `Content-Length`
 * mitschickt (dann rechnet der Lauf mit `Posten.kb`).
 *
 * Zwei Dinge haengen daran, und das zweite ist das wichtigere: Der Balken
 * fuellt sich waehrend einer grossen Datei weiter — und die Ruhefrist laeuft
 * neu an, statt mitten im Herunterladen abzulaufen (siehe `FRIST_MS`).
 *
 * Gemeldet wird der STAND, nicht der Zuwachs: Ein verlorener Bericht heilt
 * damit von selbst beim naechsten, und wer zweimal dasselbe meldet, verschiebt
 * nichts.
 */
export type Fortschritt = (gelesen: number, gesamt: number | null) => void;

/**
 * Wie ein einzelner Posten geholt wird. Austauschbar, damit es pruefbar ist.
 *
 * Der zweite Parameter ist der Draht fuer Zwischenberichte. Wer ihn nicht
 * braucht, laesst ihn in seiner Unterschrift weg — `bildHolen` und die Holer
 * der Tests tun genau das, und TypeScript nimmt eine Funktion mit weniger
 * Parametern klaglos an.
 */
export type Holer = (pfad: string, melden: Fortschritt) => Promise<void>;

export interface Optionen {
  readonly posten?: readonly Posten[];
  readonly holen?: Holer;
  readonly fristMs?: number;
}

/**
 * Ein Bild holen und entpacken.
 *
 * Ein Fehlschlag kommt als abgelehntes Versprechen zurueck und nicht als
 * Ausnahme: Der Lauf soll wissen, dass diese Datei fehlt, aber daran nicht
 * scheitern. jsdom kennt weder `decode()` noch das Laden von Bildern — dort
 * greift der Rueckfall auf `onload`, und der bleibt still. Deshalb setzen die
 * Tests einen eigenen Holer ein.
 */
export function bildHolen(pfad: string): Promise<void> {
  return new Promise((erfuellen, ablehnen) => {
    const bild = new Image();
    const schiefgegangen = (): void => ablehnen(new Error(pfad));
    bild.src = pfad;
    if (typeof bild.decode === 'function') {
      void bild.decode().then(() => erfuellen(), schiefgegangen);
      return;
    }
    bild.onload = () => erfuellen();
    bild.onerror = schiefgegangen;
  });
}

/**
 * Eine grosse Datei holen und dabei laufend melden, wie weit sie ist.
 *
 * DER ZWEITE WEG NEBEN `bildHolen` — und ausdruecklich nicht dessen
 * Nachfolger. Fuer ein Bild bleibt `bildHolen` richtig, aus dem Grund in
 * Punkt 2 oben: Dort wird ueber `<img>` auch ENTPACKT, und zwar unter
 * derselben Adresse, die das spaetere `<img>` benutzt. Ein `fetch` legt die
 * Bytes zwar in den HTTP-Speicher des Browsers, entpackt aber nichts — das
 * Bild blitzte beim ersten Zeichnen trotzdem auf. Beides nacheinander waere
 * ein Weg, kostete aber im ungluecklichen Fall (Antwort ohne Freigabe zum
 * Speichern) zwei Uebertragungen. Fuer 43-kB-Blaetter ein schlechter Tausch.
 *
 * Gedacht ist er fuer alles, was gross ist und kein Bild: heute nichts, ab dem
 * ersten GLB-Modell der 3D-Arena jeder einzelne Posten. Dort ist der
 * Zwischenbericht kein Komfort, sondern der Unterschied zwischen „laedt" und
 * „gilt als tot" (siehe `FRIST_MS`).
 *
 * DIE BYTES WERDEN WEGGEWORFEN, und das ist der ganze Zweck: Was bleibt, ist
 * der Eintrag im HTTP-Speicher. Der spaetere Lader fordert dieselbe Adresse an
 * und bekommt sie von dort — sie zwischenzuhalten hiesse, ein Modell im
 * Megabyte-Bereich ein zweites Mal im Arbeitsspeicher zu fuehren.
 *
 * Fehlt `Content-Length` — bei `Transfer-Encoding: chunked` oder hinter
 * gzip —, meldet er die gelesenen Bytes mit `null` als Gesamtwert. Der Lauf
 * rechnet dann mit `Posten.kb`; angestossen wird die Ruhefrist so oder so,
 * und das ist der wichtigere Teil.
 */
export function stromHolen(pfad: string, melden?: Fortschritt): Promise<void> {
  return fetch(pfad).then(async (antwort) => {
    /* Ein 404 kommt bei `fetch` als ganz gewoehnliche Antwort an. Ohne diese
       Zeile haekelte der Lauf eine fehlende Datei als geladen ab — und der
       Ladebildschirm meldete Vollzug ueber eine Datei, die es nicht gibt. */
    if (!antwort.ok) throw new Error(`${pfad}: HTTP ${antwort.status}`);
    const laenge = Number(antwort.headers.get('content-length'));
    const gesamt = Number.isFinite(laenge) && laenge > 0 ? laenge : null;
    const leser = antwort.body?.getReader();
    /* Kein Koerper zum Mitlesen (jsdom kennt keinen, aeltere Browser auch
       nicht): dann eben in einem Stueck. Der Posten meldet sich damit wie
       frueher nur einmal — das ist schlechter als ein Zwischenbericht und
       immer noch viel besser als eine Ausnahme, denn die kostete die Datei. */
    if (!leser) {
      await antwort.arrayBuffer();
      return;
    }
    let gelesen = 0;
    for (;;) {
      const stueck = await leser.read();
      if (stueck.done) break;
      gelesen += stueck.value.byteLength;
      melden?.(gelesen, gesamt);
    }
  });
}

/**
 * Ein Posten, der ueber `stromHolen` kommt — die Fassung fuer grosse Dateien.
 *
 * Steht hier und nicht als Handarbeit in der Liste, damit der Pfad EINMAL
 * genannt wird. Von Hand hiesse es `{ pfad, kb, holen: (m) => stromHolen(pfad,
 * m) }`, und die beiden Nennungen koennen auseinanderlaufen: Der Lauf haekelte
 * dann einen Posten ab, dessen Datei er nie geholt hat.
 */
export function stromPosten(pfad: string, kb: number): Posten {
  return { pfad, kb, holen: (melden) => stromHolen(pfad, melden) };
}

// ---------------------------------------------------------------------------
// Der Lauf — genau einer je Sitzung
// ---------------------------------------------------------------------------

interface Lauf {
  stand: Ladestand;
  readonly hoerer: Set<(stand: Ladestand) => void>;
  versprechen: Promise<Ladestand>;
}

/**
 * Der laufende oder abgeschlossene Vorgang. Modulweit und absichtlich: Wer
 * eine zweite Partie startet, soll den Ladebildschirm nicht wiedersehen — und
 * ein React-Zustand waere mit dem Bildschirm verschwunden.
 */
let lauf: Lauf | null = null;

/** Nur fuer Tests. Im Betrieb ist genau das Nicht-Zuruecksetzen der Zweck. */
export function vorratZuruecksetzen(): void {
  lauf = null;
}

/** Der Stand ohne Anmeldung — fuer den ersten Aufbau einer Komponente. */
export function vorratStand(): Ladestand {
  return lauf?.stand ?? NOCH_NICHTS;
}

/**
 * Den Vorrat holen. Der zweite Aufruf holt nichts nach, sondern gibt das
 * Versprechen des ersten zurueck — auch wenn es laengst erfuellt ist.
 *
 * Die Optionen wirken deshalb nur beim ERSTEN Aufruf. Das ist kein Versehen:
 * Ein zweiter Aufruf mit anderer Liste waere ein zweiter Ladebildschirm, und
 * den soll es nicht geben.
 */
export function vorratLaden(optionen: Optionen = {}): Promise<Ladestand> {
  if (lauf) return lauf.versprechen;

  const posten = optionen.posten ?? VORZULADEN;
  const holen = optionen.holen ?? bildHolen;
  const fristMs = optionen.fristMs ?? FRIST_MS;
  /* Ohne Untergrenze teilte der Anteil durch null, sobald jemand eine leere
     Liste vorladen laesst. */
  const gesamtKb = posten.reduce((summe, p) => summe + p.kb, 0) || 1;
  /* Die Zahl neben dem Balken zaehlt Dateien; das Spielpaket ist eine mehr
     wert als es Posten sind (siehe `Posten.stueck`). */
  const gesamtStueck = stueckSumme(posten);

  const dieser: Lauf = {
    stand: { fertig: false, erledigt: 0, gesamt: gesamtStueck, anteil: 0, fehlend: [] },
    hoerer: new Set(),
    // Wird unten ersetzt, sobald das Versprechen steht. Es zuerst zu bauen
    // ginge nicht: Der Lauf muss schon stehen, wenn der erste Posten meldet.
    versprechen: Promise.resolve(NOCH_NICHTS),
  };
  lauf = dieser;

  const offen = new Set(posten.map((p) => p.pfad));
  const kaputt: string[] = [];
  /* Angefangene Posten: Pfad -> das schon geladene Gewicht in kB. Wer hier
     steht, ist NOCH offen; `abgehakt` raeumt ihn heraus, bevor sein volles
     Gewicht nach `fertigeKb` wandert — sonst zaehlte es doppelt und der
     Balken stuende ueber dem, was wirklich da ist. */
  const teilKb = new Map<string, number>();
  let erledigt = 0;
  let fertigeKb = 0;
  let abgeschlossen = false;

  const melde = (stand: Ladestand): void => {
    dieser.stand = stand;
    for (const hoerer of [...dieser.hoerer]) hoerer(stand);
  };

  /** Die Breite des Balkens: fertiges Gewicht plus das der angefangenen. */
  const anteilJetzt = (): number => {
    let summe = fertigeKb;
    for (const kb of teilKb.values()) summe += kb;
    return Math.min(1, summe / gesamtKb);
  };

  dieser.versprechen = new Promise<Ladestand>((erfuellen) => {
    let uhr: ReturnType<typeof setTimeout>;

    const beenden = (durchFrist: boolean): void => {
      if (abgeschlossen) return;
      abgeschlossen = true;
      clearTimeout(uhr);
      const fehlend = [...kaputt, ...offen];
      if (fehlend.length > 0) {
        /* Ins Protokoll und nicht auf den Bildschirm: Wer spielen will,
           interessiert sich nicht fuer Dateinamen — wer den Fehler sucht,
           schon. */
        console.warn(
          durchFrist
            ? `[Tafelrunde] Vorladen abgebrochen, seit ${fristMs} ms kam nichts mehr — ${fehlend.length} von ${posten.length} Posten fehlen:`
            : `[Tafelrunde] Vorladen fertig, ${fehlend.length} von ${posten.length} Posten fehlen:`,
          fehlend.join(', '),
        );
      }
      melde({ fertig: true, erledigt, gesamt: gesamtStueck, anteil: 1, fehlend });
      erfuellen(dieser.stand);
    };

    /** Die Ruhefrist von vorn. Siehe FRIST_MS: gezaehlt wird Stillstand. */
    const uhrStellen = (): void => {
      clearTimeout(uhr);
      uhr = setTimeout(() => beenden(true), fristMs);
    };
    uhrStellen();

    /**
     * Ein Posten ist ein Stueck weiter. Das tut ZWEIERLEI, und das zweite ist
     * das wichtigere: Es fuellt den Balken feiner — und es stellt die
     * Ruhefrist zurueck. Ohne das gilt eine Datei, die laenger als `fristMs`
     * am Stueck laedt, als tot (siehe `FRIST_MS`).
     *
     * Ein Bericht nach dem Schluss wird verworfen, genau wie ein Nachzuegler
     * in `abgehakt`: Sonst spraenge der Balken zurueck, waehrend die Partie
     * laengst laeuft.
     */
    const gemeldet = (p: Posten, gelesen: number, gesamt: number | null): void => {
      if (abgeschlossen || !offen.has(p.pfad)) return;
      /* Ohne `Content-Length` bleibt nur das geschaetzte Gewicht des Postens.
         Es kann danebenliegen; der Deckel bei eins sorgt dafuer, dass der
         Balken davon hoechstens zu frueh voll aussieht und nicht ueberlaeuft. */
      const erwartet = gesamt ?? p.kb * 1024;
      teilKb.set(p.pfad, Math.min(1, gelesen / Math.max(1, erwartet)) * p.kb);
      uhrStellen();
      melde({
        fertig: false,
        erledigt,
        gesamt: gesamtStueck,
        anteil: anteilJetzt(),
        fehlend: [...kaputt],
      });
    };

    const abgehakt = (p: Posten, geklappt: boolean): void => {
      if (abgeschlossen || !offen.has(p.pfad)) return;
      offen.delete(p.pfad);
      teilKb.delete(p.pfad);
      if (!geklappt) kaputt.push(p.pfad);
      erledigt += stueckZahl(p);
      fertigeKb += p.kb;
      uhrStellen();
      melde({
        fertig: false,
        erledigt,
        gesamt: gesamtStueck,
        anteil: anteilJetzt(),
        fehlend: [...kaputt],
      });
      if (offen.size === 0) beenden(false);
    };

    if (posten.length === 0) {
      beenden(false);
      return;
    }
    /* Alle gleichzeitig anstossen. Der Browser haelt seine eigene
       Warteschlange (sechs Verbindungen je Gegenstelle); ein selbstgebauter
       Takt waere hier nur langsamer. */
    for (const p of posten) {
      /* Bringt der Posten seinen eigenen Weg mit, gilt der — `holen` ist der
         Weg fuer Bilder, und das Spielpaket ist keines (siehe `Posten.holen`).
         Der Lauf selbst merkt keinen Unterschied: Er sieht ein Versprechen,
         das haelt oder nicht. */
      const melden: Fortschritt = (gelesen, gesamt) => gemeldet(p, gelesen, gesamt);
      void (p.holen ? p.holen(melden) : holen(p.pfad, melden)).then(
        () => abgehakt(p, true),
        () => abgehakt(p, false),
      );
    }
  });

  return dieser.versprechen;
}

// ---------------------------------------------------------------------------
// Der Haken fuer den Bildschirm
// ---------------------------------------------------------------------------

/**
 * Vorladen anstossen und den Stand mitlesen.
 *
 * Der Effekt haengt an einer LEEREN Liste und nicht an den Optionen: Sie
 * wirken ohnehin nur beim ersten Lauf (siehe `vorratLaden`), und mit dem
 * Objekt in der Abhaengigkeitsliste liefe er bei jedem Rundruf des Servers
 * neu — der Fehler, vor dem CLAUDE.md warnt.
 */
export function useVorladen(optionen: Optionen = {}): Ladestand {
  const [stand, setStand] = useState<Ladestand>(() => vorratStand());

  useEffect(() => {
    let lebt = true;
    void vorratLaden(optionen);
    const dieser = lauf;
    if (!dieser) return;
    // Zwischen dem ersten Aufbau und diesem Effekt koennen schon Posten
    // durchgelaufen sein — ohne diese Zeile bliebe der Balken bei null stehen,
    // bis der naechste eintrifft.
    setStand(dieser.stand);
    const hoerer = (neu: Ladestand): void => {
      if (lebt) setStand(neu);
    };
    dieser.hoerer.add(hoerer);
    return () => {
      lebt = false;
      dieser.hoerer.delete(hoerer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return stand;
}
