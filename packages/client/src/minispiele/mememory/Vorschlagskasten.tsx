/**
 * Der Vorschlagskasten von Mememory.
 *
 * Bis zum 26. August war ein neues Meme ein Commit: Bild ins Repo, Kennung in
 * den Katalog, bauen, deployen. Hier geht es vom Telefon aus — Bild aus der
 * Galerie, selbst zurechtruecken, einreichen.
 *
 * Zwei Gesichter, dieselbe Tuer:
 *
 *   - **Jeder Spieler** reicht ein. Sein Bild wartet, bis die Aufsicht es
 *     ansieht. Ohne diesen Zwischenschritt liefe jedes fremde Bild sofort in
 *     fremde Partien, und genau an dieser Stelle laedt irgendwann jemand
 *     etwas hoch, das dort nichts zu suchen hat.
 *   - **Die Aufsicht** (Testkonto, siehe STAFF_EMAILS) sieht denselben Kasten
 *     mit drei Blaettern: selbst hochladen (sofort im Spiel), Wartendes
 *     freigeben oder ablehnen, und den Bestand, aus dem sich etwas wieder
 *     herausnehmen laesst — alles ohne Deploy.
 *
 * **Zugeschnitten wird hier, nicht auf dem Server.** Ein Meme ist selten
 * quadratisch, und was davon wichtig ist, weiss nur der Mensch davor: Die
 * Pointe steht oft am Rand. Also ein quadratischer Rahmen zum Schieben und
 * Zoomen — und was hinausragt, ist weg. Nebenbei geht dadurch nie ein
 * 4-MB-Foto ueber die Leitung: Was den Server erreicht, ist ein Quadrat von
 * 320 px.
 *
 * **Mehrere Bilder auf einmal, eines nach dem anderen zugeschnitten.** Wer
 * in der Galerie steht, hat selten genau ein Meme dabei. Die Auswahl wird
 * deshalb zur Warteschlange: zuschneiden, einreichen, das naechste kommt von
 * selbst. Zwei Dinge sind daran wichtiger, als sie aussehen —
 *
 *   - **Nur das aktuelle Bild ist entpackt.** In der Schlange liegen
 *     `File`-Verweise, kein Bildspeicher. Zehn Handyfotos gleichzeitig als
 *     ImageBitmap waeren dreistellige Megabyte, und auf dem Telefon wirft
 *     der Browser dafuer den Tab weg.
 *   - **Ein unlesbares Bild haelt den Stapel nicht an.** Es wird gezaehlt und
 *     uebersprungen. Sonst reisst eine einzige HEIC-Datei aus der Galerie
 *     neun brauchbare Memes mit sich.
 *
 * **Vorschau und Ergebnis sind dieselbe Funktion.** `malen()` zeichnet in die
 * Vorschau-Leinwand und in die Ausgabe-Leinwand; nur die Seitenlaenge ist
 * anders, alle Masse sind Bruchteile davon. Eine zweite Rechenstrecke fuer
 * die Vorschau waere die sichere Art, ein Bild anders zu speichern, als es
 * angezeigt wurde.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../api';
import { Kreuz, Note } from '../../zeichen';
import { motivBildPfad, motivTonPfad } from './bildpfad';
import { spieleTonProbe, spieleTonProbeVon } from './klaenge';
import { TON_SEKUNDEN, tonSchnipsel } from './tonschnitt';

/** Kantenlaenge des gespeicherten Bildes. Die Grundmotive haben 224 px; hier
    sind es mehr, weil auf einem Meme oft Text steht. */
const AUSGABE_PX = 320;

/** Muss zu BILD_MAX_ZEICHEN in packages/server/src/memes.ts passen. */
const MAX_ZEICHEN = 60_000;

/** Muss zu TITEL_MAX im Server passen. */
const TITEL_MAX = 40;

/** Muss zu TON_MAX_ZEICHEN in packages/server/src/toene.ts passen. */
const TON_MAX_ZEICHEN = 64_000;

/** Wie weit sich hineinzoomen laesst. 1 heisst: das ganze Bild ist zu sehen. */
const ZOOM_MAX = 4;

/**
 * Wie viele Bilder ein Stapel hoechstens fasst.
 *
 * Nicht gegen Missbrauch — dagegen steht der Riegel im Server —, sondern
 * gegen das Versehen: In der iOS-Galerie ist "alle auswaehlen" ein Griff,
 * und 400 Urlaubsfotos in einer Warteschlange sind keine Absicht, sondern
 * ein Ausrutscher. Was darueber hinausgeht, wird abgeschnitten und gesagt.
 */
const STAPEL_MAX = 20;

interface Versatz {
  readonly x: number;
  readonly y: number;
}

type Blatt = 'einreichen' | 'kasten' | 'bestand';

interface Vorschlag {
  kennung: string;
  titel: string | null;
  bild: string;
  einreicher: string | null;
  eingereichtAm: string;
}

interface Bestandsmotiv {
  kennung: string;
  titel: string | null;
  /** Haengt ein Ton daran? Nur das Ja oder Nein — der Ton kommt einzeln. */
  hatTon: boolean;
}

/**
 * Was mit dem Ton eines Motivs im Bearbeiten gerade passiert.
 *
 * Drei Zustaende und nicht zwei: „unveraendert" und „geloescht" muessen sich
 * unterscheiden lassen, sonst nimmt jedes Umbenennen den Ton mit weg (der
 * Server liest `undefined` als „nicht angefasst" und `null` als „weg").
 */
type Tonlage =
  | { art: 'unveraendert'; hatTon: boolean }
  | { art: 'neu'; daten: string }
  | { art: 'weg' };

// ---------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------

/**
 * Zeichnet den Ausschnitt in ein Quadrat der Seitenlaenge `seite`.
 *
 * Alle Masse sind Bruchteile der Seitenlaenge — deshalb ergibt dieselbe
 * Einstellung in der 260-px-Vorschau und im 320-px-Ergebnis denselben
 * Ausschnitt. `basis` passt das ganze Bild hinein (Zoom 1); ab da vergroessert
 * `zoom`, und was ueber den Rand geht, faellt weg.
 */
function malen(
  ziel: CanvasRenderingContext2D,
  seite: number,
  bild: ImageBitmap,
  zoom: number,
  versatz: Versatz,
  grund: string,
): void {
  ziel.fillStyle = grund;
  ziel.fillRect(0, 0, seite, seite);
  const basis = Math.min(1 / bild.width, 1 / bild.height);
  const breite = bild.width * basis * zoom * seite;
  const hoehe = bild.height * basis * zoom * seite;
  ziel.drawImage(
    bild,
    (seite - breite) / 2 + versatz.x * seite,
    (seite - hoehe) / 2 + versatz.y * seite,
    breite,
    hoehe,
  );
}

/**
 * Haelt den Ausschnitt auf dem Bild.
 *
 * Ohne diese Grenze laesst sich das Bild aus dem Rahmen schieben, bis nur
 * noch Hintergrund zu sehen ist — und weil man dabei nichts festhaelt,
 * passiert das beim ersten Wischen. Ist eine Seite kleiner als der Rahmen
 * (Zoom 1, ein breites Meme), bleibt sie mittig: Es gibt dort nichts zu
 * verschieben.
 */
function begrenze(versatz: Versatz, zoom: number, bild: ImageBitmap): Versatz {
  const basis = Math.min(1 / bild.width, 1 / bild.height);
  const breite = bild.width * basis * zoom;
  const hoehe = bild.height * basis * zoom;
  const maxX = Math.max(0, (breite - 1) / 2);
  const maxY = Math.max(0, (hoehe - 1) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, versatz.x)),
    y: Math.min(maxY, Math.max(-maxY, versatz.y)),
  };
}

/**
 * Mittlere Randfarbe des Bildes.
 *
 * Sie fuellt die Flaeche, die bei Zoom 1 neben einem breiten Meme frei
 * bleibt. Ein fester weisser Balken sieht neben einem dunklen Meme aus wie
 * ein Ladefehler; die Farbe des Bildrands sieht nach Absicht aus. Gerechnet
 * wird auf einer 16-px-Verkleinerung — das ist schnell und genau genug fuer
 * eine Flaeche, die niemand ausmisst.
 */
function randfarbe(bild: ImageBitmap): string {
  const klein = document.createElement('canvas');
  klein.width = 16;
  klein.height = 16;
  const ctx = klein.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#ffffff';
  ctx.drawImage(bild, 0, 0, 16, 16);
  let daten: Uint8ClampedArray;
  try {
    daten = ctx.getImageData(0, 0, 16, 16).data;
  } catch {
    // Ein Bild von fremder Herkunft macht die Leinwand unlesbar. Hier kommt
    // es aus einer Datei, aber ein Weg zurueck kostet nichts.
    return '#ffffff';
  }
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (x !== 0 && x !== 15 && y !== 0 && y !== 15) continue;
      const i = (y * 16 + x) * 4;
      r += daten[i]!;
      g += daten[i + 1]!;
      b += daten[i + 2]!;
      n++;
    }
  }
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}

/**
 * Der Ausschnitt als data-URL.
 *
 * WebP zuerst, JPEG als Rueckfall: Safari kannte `toDataURL('image/webp')`
 * lange nicht und gibt dann still ein PNG zurueck — ein PNG von einem Foto
 * ist gross genug, um am Riegel des Servers zu scheitern. Deshalb wird der
 * Kopf der Zeichenkette geprueft und nicht dem Aufruf geglaubt. Ist das
 * Ergebnis trotzdem zu gross, sinkt die Guete; bei 320 px greift das
 * praktisch nie.
 */
function alsDataUrl(bild: ImageBitmap, zoom: number, versatz: Versatz, grund: string): string {
  const leinwand = document.createElement('canvas');
  leinwand.width = AUSGABE_PX;
  leinwand.height = AUSGABE_PX;
  const ctx = leinwand.getContext('2d');
  if (!ctx) throw new Error('keine Leinwand');
  malen(ctx, AUSGABE_PX, bild, zoom, versatz, grund);

  let letzte = '';
  for (const guete of [0.85, 0.7, 0.55]) {
    let url = leinwand.toDataURL('image/webp', guete);
    if (!url.startsWith('data:image/webp')) url = leinwand.toDataURL('image/jpeg', guete);
    letzte = url;
    if (url.length <= MAX_ZEICHEN) return url;
  }
  return letzte;
}

// ---------------------------------------------------------------------------
// Der Kasten
// ---------------------------------------------------------------------------

export function Vorschlagskasten({
  istAufsicht,
  onFertig,
}: {
  /** Testkonto: darf freigeben, ablehnen und direkt aufnehmen. */
  istAufsicht: boolean;
  onFertig: () => void;
}): React.JSX.Element {
  const [blatt, setBlatt] = useState<Blatt>('einreichen');
  const [bild, setBild] = useState<ImageBitmap | null>(null);
  /**
   * Die noch nicht bearbeiteten Bilder — als Dateien, nicht als Bildspeicher.
   * Das aktuelle steckt NICHT mehr darin, sonst zaehlt es doppelt.
   */
  const [schlange, setSchlange] = useState<File[]>([]);
  /** Wie viele Bilder dieser Durchgang hatte. 0 heisst: gerade keiner. */
  const [gesamt, setGesamt] = useState(0);
  /**
   * Wie viele Vorschlaege das Konto noch offen haben darf. null = unbegrenzt
   * (Aufsicht), undefined = noch nicht gefragt.
   */
  const [frei, setFrei] = useState<number | null | undefined>(undefined);
  /**
   * Welches Motiv gerade nachtraeglich bearbeitet wird, sonst null.
   *
   * Der Zuschneider ist derselbe wie beim Hochladen — nur der Weg hinein und
   * der Knopf am Ende sind andere. Ein zweiter Zuschneider waere eine zweite
   * Rechenstrecke fuer denselben Ausschnitt, und genau davor warnt der
   * Kopfkommentar oben.
   */
  const [bearbeitet, setBearbeitet] = useState<{ kennung: string; titel: string } | null>(null);
  /**
   * Der Ton des gerade bearbeiteten Motivs.
   *
   * Er wird NICHT mit ins Bearbeiten geladen: Zum Abspielen reicht die
   * Adresse beim Server, und ein Ton, den man nur anhoeren will, muss nicht
   * durch den Browserspeicher. Erst wer einen neuen waehlt, hat Daten hier
   * stehen.
   */
  const [tonlage, setTonlage] = useState<Tonlage>({ art: 'unveraendert', hatTon: false });
  /** Laeuft gerade das Zuschneiden einer Tondatei? Es dauert kurz. */
  const [tonLaedt, setTonLaedt] = useState(false);
  /** Hochgezaehlt bei jeder Aenderung — haengt an den Bildadressen im Bestand. */
  const [stand, setStand] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [versatz, setVersatz] = useState<Versatz>({ x: 0, y: 0 });
  const [grund, setGrund] = useState('#ffffff');
  const [titel, setTitel] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  /** Sachhinweis zum Stapel (abgeschnitten, gedeckelt) — kein Fehler. */
  const [stapelhinweis, setStapelhinweis] = useState<string | null>(null);
  /**
   * Zwischen zwei Bildern wird entpackt, und das dauert auf einem Telefon bis
   * zu anderthalb Sekunden. Solange steht hier true — und in dieser Zeit gibt
   * es KEINEN Rahmen, sondern eine Wartefläche. Der Grund steht bei `weiter`.
   */
  const [laedtNaechstes, setLaedtNaechstes] = useState(false);

  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [bestand, setBestand] = useState<Bestandsmotiv[]>([]);
  const [laedt, setLaedt] = useState(false);

  /**
   * Die Bilanz des laufenden Durchgangs.
   *
   * In einem Ref und nicht im Zustand: Sie wird mitten in einer
   * Ereigniskette hochgezaehlt (einreichen -> naechstes Bild laden), und ein
   * Zustand waere dort noch der alte. Angezeigt wird sie erst am Ende, dann
   * einmal als `meldung`.
   */
  const bilanz = useRef({ eingereicht: 0, uebersprungen: 0, unlesbar: 0 });

  /**
   * Kennung des laufenden Durchgangs.
   *
   * Zwischen "naechstes Bild holen" und "naechstes Bild da" liegt ein
   * `await`. Wer in dieser Zeit abbricht, eine neue Auswahl trifft oder den
   * Kasten schliesst, erhoeht die Zahl — und der alte Lauf legt sein
   * Ergebnis danach nicht mehr ab, sondern gibt es frei. Ohne diese Kennung
   * kam ein gerade verworfener Stapel eine Sekunde spaeter zurueck.
   */
  const laufNr = useRef(0);

  /**
   * Laeuft gerade eine Entpackung?
   *
   * Bewusst ein Ref und nicht `laedtNaechstes`: Zwei Tipper in DERSELBEN
   * Ereignisrunde sehen beide noch den Zustand von vorher, und der zweite
   * kaeme durch jede Wache, die auf gerendertem Zustand steht. Er
   * uebersprang dann zwar kein zweites Bild (dafuer sorgt die Laufnummer),
   * zaehlte aber eines mit — und am Ende stand in der Bilanz eine Zahl, die
   * nicht stimmte.
   */
  const laeuft = useRef(false);

  /**
   * Das aktuelle Bild auch als Ref — nur fuer das Aufraeumen beim Schliessen.
   * Ein Effekt mit `bild` in der Abhaengigkeitsliste wuerde bei JEDEM Wechsel
   * aufraeumen und damit das gerade gezeigte Bild schliessen.
   */
  const bildRef = useRef<ImageBitmap | null>(null);
  useEffect(() => {
    bildRef.current = bild;
  }, [bild]);

  useEffect(
    () => () => {
      // Kasten zu: laufende Entpackung entwerten und den Bildspeicher
      // freigeben, statt auf die Speicherbereinigung zu warten. Auf einem
      // Telefon sind das schnell zweistellige Megabyte.
      laufNr.current += 1;
      laeuft.current = false;
      bildRef.current?.close?.();
    },
    [],
  );

  /**
   * Die Vorschau-Leinwand steht im ZUSTAND, nicht in einem Ref.
   *
   * Der Grund ist der Reiterwechsel: Geht die Aufsicht mitten im Stapel auf
   * "Kasten" und zurueck auf "Hochladen", baut React die Leinwand neu. Ein
   * Ref aendert dabei nichts, woran ein Effekt haengen koennte — der
   * Zeichen-Effekt liefe also nicht, und der Rahmen bliebe leer, bis der
   * Nutzer ihn anfasst und damit `versatz` aendert. Als Zustand ist das
   * frische Element selbst die Abhaengigkeit.
   */
  const [leinwand, setLeinwand] = useState<HTMLCanvasElement | null>(null);
  /** Aktive Finger. Zwei davon heissen: zoomen statt schieben. */
  const zeiger = useRef(new Map<number, { x: number; y: number }>());
  const letzterAbstand = useRef<number | null>(null);
  /**
   * Zoom und Versatz liegen zusaetzlich in Refs.
   *
   * Eine Wischbewegung liefert mehrere Ereignisse je Bild, und React fasst
   * die Zustandsaenderungen zusammen. Rechnete jeder Schritt mit dem Wert aus
   * dem letzten Rendern, ginge unterwegs etwas verloren und das Bild
   * ruckelte hinterher. Die Refs tragen den jeweils aktuellen Stand, der
   * Zustand daneben loest nur das Neuzeichnen aus.
   */
  const zoomRef = useRef(1);
  const versatzRef = useRef<Versatz>({ x: 0, y: 0 });

  /** Zoom setzen und den Versatz gleich mit auf das Bild zurueckholen. */
  const setzeZoom = useCallback((wert: number, welches: ImageBitmap): void => {
    const neu = Math.min(ZOOM_MAX, Math.max(1, wert));
    zoomRef.current = neu;
    versatzRef.current = begrenze(versatzRef.current, neu, welches);
    setZoom(neu);
    setVersatz(versatzRef.current);
  }, []);

  const schiebe = useCallback((dx: number, dy: number, welches: ImageBitmap): void => {
    versatzRef.current = begrenze(
      { x: versatzRef.current.x + dx, y: versatzRef.current.y + dy },
      zoomRef.current,
      welches,
    );
    setVersatz(versatzRef.current);
  }, []);

  // --- Vorschau ------------------------------------------------------------

  useEffect(() => {
    if (!leinwand || !bild) return;
    const ctx = leinwand.getContext('2d');
    if (!ctx) return;
    // Die Leinwand ist doppelt so gross wie ihre Anzeige. Auf einem
    // Telefonschirm ist eine 1:1-Leinwand sichtbar weich, und ein weiches
    // Vorschaubild laesst einen genauer zuschneiden, als noetig waere.
    malen(ctx, leinwand.width, bild, zoom, versatz, grund);
  }, [leinwand, bild, zoom, versatz, grund]);

  // --- Listen der Aufsicht -------------------------------------------------

  const listenHolen = useCallback(async (): Promise<void> => {
    if (!istAufsicht) return;
    setLaedt(true);
    try {
      const antwort = await api.mememoryVorschlaege();
      setVorschlaege(antwort.vorschlaege);
      setBestand(antwort.freigegeben);
    } catch {
      setFehler('Die Liste ließ sich nicht laden.');
    } finally {
      setLaedt(false);
    }
  }, [istAufsicht]);

  useEffect(() => {
    if (blatt === 'kasten' || blatt === 'bestand') void listenHolen();
  }, [blatt, listenHolen]);

  // --- Wie viel das Konto noch darf ---------------------------------------

  /**
   * Vor dem ersten Zuschneiden fragen, nicht danach.
   *
   * Die Grenze von fuenf offenen Vorschlaegen faellt erst beim Stapel
   * wirklich auf: Wer acht Bilder waehlt und beim vierten ein Nein bekommt,
   * hat drei davon umsonst zurechtgerueckt.
   */
  useEffect(() => {
    if (blatt !== 'einreichen') return;
    let lebt = true;
    void api
      .mememoryEigene()
      .then((antwort) => {
        if (lebt) setFrei(antwort.frei);
      })
      .catch(() => {
        // Kein Netz, keine Auskunft: Dann laeuft der Stapel wie frueher in
        // den Serverfehler. Das ist schlechter, aber nicht kaputt.
        if (lebt) setFrei(null);
      });
    return () => {
      lebt = false;
    };
  }, [blatt]);

  // --- Bilder waehlen und abarbeiten --------------------------------------

  /** Ein entpacktes Bild in den Rahmen legen und die Ansicht zuruecksetzen. */
  const zeige = useCallback((neu: ImageBitmap): void => {
    zoomRef.current = 1;
    versatzRef.current = { x: 0, y: 0 };
    setBild(neu);
    setGrund(randfarbe(neu));
    setZoom(1);
    setVersatz({ x: 0, y: 0 });
    setTitel('');
  }, []);

  /** Was am Ende eines Durchgangs dasteht. null heisst: nichts zu melden. */
  const schlussmeldung = useCallback((): string | null => {
    const { eingereicht, uebersprungen, unlesbar } = bilanz.current;
    if (eingereicht === 0 && unlesbar === 0) return null;
    const teile: string[] = [];
    if (eingereicht === 1) {
      teile.push(
        istAufsicht
          ? 'Aufgenommen. Ab der nächsten Partie kann es auf dem Brett liegen.'
          : 'Danke! Dein Meme liegt jetzt im Kasten und wartet auf Freigabe.',
      );
    } else if (eingereicht > 1) {
      teile.push(
        istAufsicht
          ? `${eingereicht} Bilder aufgenommen. Ab der nächsten Partie können sie auf dem Brett liegen.`
          : `Danke! ${eingereicht} Memes liegen jetzt im Kasten und warten auf Freigabe.`,
      );
    }
    if (unlesbar > 0) {
      teile.push(
        unlesbar === 1
          ? 'Eine Datei ließ sich nicht öffnen und wurde übergangen.'
          : `${unlesbar} Dateien ließen sich nicht öffnen und wurden übergangen.`,
      );
    }
    if (uebersprungen > 0) {
      teile.push(uebersprungen === 1 ? 'Eines hast du übersprungen.' : `${uebersprungen} hast du übersprungen.`);
    }
    return teile.join(' ');
  }, [istAufsicht]);

  /**
   * Das naechste lesbare Bild aus der Schlange holen.
   *
   * Der Rest wird ausdruecklich uebergeben und nicht aus dem Zustand gelesen:
   * Diese Funktion laeuft direkt nach dem Einreichen, und dort steht im
   * Zustand noch die Schlange von vorher.
   *
   * Unlesbares wird gezaehlt und ueberholt, statt den Stapel anzuhalten —
   * eine einzelne Datei, die der Browser nicht entpacken kann (HEIC aus der
   * iOS-Galerie ist der Regelfall), darf neun brauchbare nicht mitreissen.
   */
  const weiter = useCallback(
    async (rest: readonly File[]): Promise<void> => {
      const meins = (laufNr.current += 1);
      laeuft.current = true;

      /**
       * ZUERST das alte Bild aus dem Zustand nehmen, dann entpacken.
       *
       * Der Aufrufer hat es bereits geschlossen, und ein geschlossenes
       * ImageBitmap im Zustand ist eine Falle: Der Rahmen bliebe waehrend des
       * Entpackens sichtbar UND bedienbar — auf einem Telefon bis zu
       * anderthalb Sekunden bei einem 12-Megapixel-Foto. Der erste Wisch in
       * dieser Zeit liefe in `malen()`, und `drawImage` auf ein
       * geschlossenes Bitmap wirft. Aus einem Effekt heraus nimmt dieser Wurf
       * den ganzen Bildschirm mit.
       *
       * Vor dem Stapel konnte das nicht passieren: Da standen `close()` und
       * `setBild(null)` immer in derselben Runde, ohne `await` dazwischen.
       */
      setBild(null);
      setLaedtNaechstes(true);

      let uebrig = [...rest];
      while (uebrig.length > 0) {
        const naechste = uebrig[0]!;
        uebrig = uebrig.slice(1);
        try {
          // `from-image` ist die Vorgabe der Norm, steht hier aber
          // ausdruecklich: Ein Handyfoto traegt seine Drehung als
          // EXIF-Merkmal, und ohne diese Auswertung liegt jedes Hochformat
          // quer im Rahmen.
          const neu = await createImageBitmap(naechste, { imageOrientation: 'from-image' });
          if (laufNr.current !== meins) {
            // Inzwischen abgebrochen. Das frisch Entpackte gleich wieder
            // freigeben, statt den verworfenen Stapel zurueckzuholen.
            neu.close?.();
            return;
          }
          laeuft.current = false;
          setSchlange(uebrig);
          zeige(neu);
          setLaedtNaechstes(false);
          return;
        } catch {
          if (laufNr.current !== meins) return;
          bilanz.current.unlesbar += 1;
        }
      }
      if (laufNr.current !== meins) return;
      // Nichts mehr da: Durchgang zu Ende.
      laeuft.current = false;
      setSchlange([]);
      setGesamt(0);
      setLaedtNaechstes(false);
      setMeldung(schlussmeldung());
    },
    [schlussmeldung, zeige],
  );

  const waehlen = async (liste: FileList | null): Promise<void> => {
    const gewaehlt = [...(liste ?? [])];
    if (gewaehlt.length === 0) return;
    setFehler(null);
    setMeldung(null);
    setStapelhinweis(null);
    bilanz.current = { eingereicht: 0, uebersprungen: 0, unlesbar: 0 };

    // Zwei Deckel: STAPEL_MAX gegen das Versehen in der Galerie, `frei` gegen
    // die Grenze im Server. Der kleinere gewinnt.
    let platz = typeof frei === 'number' ? Math.min(STAPEL_MAX, frei) : STAPEL_MAX;
    if (platz <= 0) {
      // Die Zahl stammt vom Oeffnen des Kastens und kann alt sein —
      // inzwischen kann die Aufsicht etwas freigegeben haben. Bevor der
      // Client von sich aus ablehnt, fragt er nach. Ein Client, der aus
      // eigener Rechnung ein Nein sagt, das der Server gar nicht mehr
      // sagen wuerde, ist die aergerlichste Sorte Fehler.
      const jetzt = await api.mememoryEigene().catch(() => null);
      if (jetzt && (jetzt.frei === null || jetzt.frei > 0)) {
        setFrei(jetzt.frei);
        platz = jetzt.frei === null ? STAPEL_MAX : Math.min(STAPEL_MAX, jetzt.frei);
      } else {
        setFehler('Es warten schon fünf Bilder von dir. Warte, bis sie geprüft sind.');
        return;
      }
    }
    const genommen = gewaehlt.slice(0, platz);
    if (genommen.length < gewaehlt.length) {
      setStapelhinweis(
        typeof frei === 'number' && frei <= STAPEL_MAX
          ? `Von ${gewaehlt.length} Bildern nimmst du ${genommen.length}: mehr Vorschläge darfst du gerade nicht offen haben.`
          : `Von ${gewaehlt.length} Bildern nimmst du die ersten ${genommen.length}.`,
      );
    }

    bild?.close?.();
    setGesamt(genommen.length);
    await weiter(genommen);
  };

  /**
   * Das aktuelle Bild verwerfen und weitermachen.
   *
   * Der Riegel ist noetig, obwohl der Knopf waehrend des Entpackens gar nicht
   * dasteht: Zwei schnelle Tipper koennen beide durch sein, bevor React neu
   * gezeichnet hat — und dann zaehlte die Bilanz zwei, es wuerde aber nur
   * eines uebersprungen.
   */
  const ueberspringen = (): void => {
    if (!bild || laeuft.current) return;
    bilanz.current.uebersprungen += 1;
    bild.close?.();
    void weiter(schlange);
  };

  /** Den ganzen Rest verwerfen. */
  const stapelWeg = (): void => {
    // Erhoeht die Laufnummer und entwertet damit eine gerade laufende
    // Entpackung. Ohne das kam der verworfene Stapel zurueck, sobald das
    // naechste Bild fertig war.
    laufNr.current += 1;
    laeuft.current = false;
    bild?.close?.();
    bilanz.current.uebersprungen += (bild ? 1 : 0) + schlange.length;
    setSchlange([]);
    setBild(null);
    setGesamt(0);
    setLaedtNaechstes(false);
    setStapelhinweis(null);
    setMeldung(schlussmeldung());
  };

  // --- Schieben und Zoomen -------------------------------------------------

  const abstandDerFinger = (): number | null => {
    const punkte = [...zeiger.current.values()];
    if (punkte.length < 2) return null;
    const dx = punkte[0]!.x - punkte[1]!.x;
    const dy = punkte[0]!.y - punkte[1]!.y;
    return Math.hypot(dx, dy);
  };

  const zeigerRunter = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    try {
      // Der Fang haelt die Bewegung auf der Leinwand, auch wenn der Finger
      // ueber den Rand hinauswandert. Er ist Komfort, keine Bedingung —
      // scheitert er (kein echter Zeiger, schon losgelassen), soll das
      // Schieben trotzdem gehen statt die Oberflaeche mitzureissen.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ohne Fang weiter */
    }
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    letzterAbstand.current = abstandDerFinger();
  };

  const zeigerBewegt = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!bild || !zeiger.current.has(e.pointerId)) return;
    const vorher = zeiger.current.get(e.pointerId)!;
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const breite = e.currentTarget.getBoundingClientRect().width || 1;

    if (zeiger.current.size >= 2) {
      // Zwei Finger: der Abstand macht den Zoom. Verschoben wird dabei nicht
      // zusaetzlich — sonst wandert das Bild bei jedem Aufziehen mit, und man
      // trifft den Ausschnitt nie.
      const jetzt = abstandDerFinger();
      if (jetzt !== null && letzterAbstand.current) {
        setzeZoom(zoomRef.current * (jetzt / letzterAbstand.current), bild);
      }
      letzterAbstand.current = jetzt;
      return;
    }

    schiebe((e.clientX - vorher.x) / breite, (e.clientY - vorher.y) / breite, bild);
  };

  const zeigerHoch = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    zeiger.current.delete(e.pointerId);
    letzterAbstand.current = abstandDerFinger();
  };

  const rollen = (e: React.WheelEvent<HTMLCanvasElement>): void => {
    if (!bild) return;
    setzeZoom(zoomRef.current * (e.deltaY < 0 ? 1.12 : 1 / 1.12), bild);
  };

  // --- Einreichen ----------------------------------------------------------

  const einreichen = async (direkt: boolean): Promise<void> => {
    if (!bild || laeuft.current || busy) return;
    setBusy(true);
    setFehler(null);
    setMeldung(null);
    try {
      const dataUrl = alsDataUrl(bild, zoom, versatz, grund);
      if (dataUrl.length > MAX_ZEICHEN) {
        setFehler('Das Bild ist zu groß. Etwas näher heranzoomen hilft.');
        return;
      }
      const antwort = await api.mememoryEinreichen(dataUrl, titel.trim() || null, direkt);
      bilanz.current.eingereicht += 1;
      setFrei(antwort.frei);
      bild.close?.();
      if (istAufsicht) void listenHolen();
      // Das naechste Bild kommt von selbst — das ist der ganze Sinn des
      // Stapels. Die Meldung steht erst am Ende, sonst blitzt sie zwischen
      // zwei Bildern kurz auf und liest sich niemand.
      await weiter(schlange);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'zuVieleVorschlaege') {
        // Der Riegel des Servers hat zugeschlagen — dann hat auch der Rest
        // des Stapels keine Aussicht mehr. Ihn stumm weiterlaufen zu lassen
        // hiesse, denselben Fehler noch fuenfmal zu zeigen.
        const uebrig = schlange.length + 1;
        bild.close?.();
        setSchlange([]);
        setBild(null);
        setGesamt(0);
        setFrei(0);
        setFehler(
          uebrig > 1
            ? `Es warten schon fünf Bilder von dir. Die restlichen ${uebrig} sind nicht eingereicht — warte, bis die anderen geprüft sind.`
            : 'Es warten schon fünf Bilder von dir. Warte, bis sie geprüft sind.',
        );
        setMeldung(schlussmeldung());
        return;
      }
      setFehler(
        code === 'bildUngueltig' || code === 'bildZuGross'
          ? 'Dieses Bild hat der Server nicht angenommen.'
          : 'Das Einreichen ist fehlgeschlagen.',
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Ein freigegebenes Motiv zum Bearbeiten in den Zuschneider holen.
   *
   * Das Bild kommt vom Server zurueck, nicht aus einem Zwischenspeicher der
   * Anzeige: Was hier bearbeitet wird, muss der Stand sein, den auch das
   * Spiel ausliefert. `frisch` haengt eine Zahl an die Adresse, damit ein
   * Browser den eigenen Zwischenspeicher nicht bevorzugt.
   */
  const bearbeiten = async (eintrag: Bestandsmotiv): Promise<void> => {
    setBusy(true);
    setFehler(null);
    setMeldung(null);
    try {
      const antwort = await fetch(`${motivBildPfad(eintrag.kennung)}?frisch=${stand}`);
      if (!antwort.ok) throw new Error('nicht ladbar');
      const neu = await createImageBitmap(await antwort.blob(), {
        imageOrientation: 'from-image',
      });
      bild?.close?.();
      setBearbeitet({ kennung: eintrag.kennung, titel: eintrag.titel ?? '' });
      zeige(neu);
      setTitel(eintrag.titel ?? '');
      setTonlage({ art: 'unveraendert', hatTon: eintrag.hatTon });
    } catch {
      setFehler('Das Bild ließ sich nicht zum Bearbeiten öffnen.');
    } finally {
      setBusy(false);
    }
  };

  /** Bearbeiten abbrechen — nichts geht an den Server. */
  const bearbeitenWeg = (): void => {
    bild?.close?.();
    setBild(null);
    setBearbeitet(null);
    setTitel('');
    setTonlage({ art: 'unveraendert', hatTon: false });
  };

  /**
   * Eine Tondatei annehmen: entpacken, auf 0,8 s schneiden, als WAV merken.
   *
   * Geschnitten wird im BROWSER, wie beim Bild — und aus demselben Grund: Eine
   * MP3-Datei vom Telefon wiegt Megabyte, und davon soll nicht einmal eine
   * Sekunde uebrig bleiben. Was den Server erreicht, sind rund 47 kB (siehe
   * tonschnitt.ts).
   */
  const tonWaehlen = async (datei: File | null | undefined): Promise<void> => {
    if (!datei) return;
    setTonLaedt(true);
    setFehler(null);
    try {
      const daten = await tonSchnipsel(datei);
      if (daten.length > TON_MAX_ZEICHEN) {
        // Kann bei 0,8 s Mono eigentlich nicht passieren; steht hier, damit
        // ein spaeter geaenderter Schnitt nicht am Server scheitert, ohne dass
        // jemand sagt, warum.
        setFehler('Der Ton ist zu groß geworden.');
        return;
      }
      setTonlage({ art: 'neu', daten });
      // Sofort vorspielen: Was von einem Meme-Ton uebrig bleibt, entscheidet
      // sich in den ersten acht Zehnteln — das will man hoeren, bevor man
      // speichert, und nicht erst mitten in einer Partie.
      await spieleTonProbe(daten);
    } catch {
      setFehler('Diese Tondatei ließ sich nicht öffnen.');
    } finally {
      setTonLaedt(false);
    }
  };

  /** Den Ton anhoeren — den neu gewaehlten oder den, der beim Server liegt. */
  const tonProbe = (): void => {
    if (tonlage.art === 'neu') {
      void spieleTonProbe(tonlage.daten).catch(() => setFehler('Der Ton ließ sich nicht abspielen.'));
      return;
    }
    const pfad = bearbeitet ? motivTonPfad(bearbeitet.kennung) : null;
    if (pfad) void spieleTonProbeVon(pfad).catch(() => setFehler('Der Ton ließ sich nicht abspielen.'));
  };

  /** Namen und Zuschnitt eines Motivs ersetzen. Die Kennung bleibt. */
  const speichern = async (): Promise<void> => {
    if (!bild || !bearbeitet || busy) return;
    setBusy(true);
    setFehler(null);
    try {
      const dataUrl = alsDataUrl(bild, zoom, versatz, grund);
      if (dataUrl.length > MAX_ZEICHEN) {
        setFehler('Das Bild ist zu groß. Etwas näher heranzoomen hilft.');
        return;
      }
      await api.mememoryAendern(bearbeitet.kennung, {
        titel: titel.trim() || null,
        bild: dataUrl,
        // Nur mitschicken, wenn wirklich etwas am Ton passiert ist: Ein
        // `undefined` laesst ihn stehen, ein `null` nimmt ihn weg. Wer nur
        // umbenennt, soll seinen Ton behalten.
        ...(tonlage.art === 'neu'
          ? { ton: tonlage.daten }
          : tonlage.art === 'weg'
            ? { ton: null }
            : {}),
      });
      bild.close?.();
      setBild(null);
      setBearbeitet(null);
      setTitel('');
      setTonlage({ art: 'unveraendert', hatTon: false });
      // Die Kennung bleibt gleich — ohne neue Zahl in der Adresse zeigte die
      // Kachel daneben noch den alten Zuschnitt.
      setStand((z) => z + 1);
      setMeldung('Geändert. Neue Partien zeigen den neuen Zuschnitt.');
      await listenHolen();
    } catch {
      setFehler('Das Ändern hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  const entscheiden = async (kennung: string, frei: boolean): Promise<void> => {
    setBusy(true);
    setFehler(null);
    try {
      if (frei) await api.mememoryFreigeben(kennung);
      else await api.mememoryLoeschen(kennung);
      await listenHolen();
    } catch {
      setFehler('Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  // --- Anzeige -------------------------------------------------------------

  const blaetter: { id: Blatt; text: string }[] = [
    { id: 'einreichen', text: istAufsicht ? 'Hochladen' : 'Meme vorschlagen' },
    ...(istAufsicht
      ? ([
          { id: 'kasten' as Blatt, text: `Kasten${vorschlaege.length ? ` (${vorschlaege.length})` : ''}` },
          { id: 'bestand' as Blatt, text: 'Bestand' },
        ] satisfies { id: Blatt; text: string }[])
      : []),
  ];

  return (
    <div className="mm-kasten-schicht" role="dialog" aria-modal="true" aria-label="Vorschlagskasten">
      <div className="mm-kasten-blatt">
        <div className="mm-kasten-kopf">
          <h2>Vorschlagskasten</h2>
          <button type="button" className="mm-kasten-zu" onClick={onFertig} aria-label="Schließen">
            <Kreuz />
          </button>
        </div>

        {blaetter.length > 1 && !bild && !laedtNaechstes && (
          <div className="mm-kasten-reiter">
            {blaetter.map((eintrag) => (
              <button
                key={eintrag.id}
                type="button"
                className={blatt === eintrag.id ? 'ist-an' : ''}
                onClick={() => setBlatt(eintrag.id)}
              >
                {eintrag.text}
              </button>
            ))}
          </div>
        )}

        {/*
          * Der Zuschneider bekommt das ganze Blatt, egal woher er kommt:
          * aus dem Stapel oder aus dem Bestand. Die Reiter sind dabei weg —
          * ein Wechsel mitten im Zuschnitt wuerfe die Arbeit weg, und ein
          * Kasten, der zwei Dinge gleichzeitig anbietet, wird auf einem
          * Telefon zum Ratespiel.
          */}
        {bild || laedtNaechstes ? (
          <div className="mm-kasten-inhalt">
            {bild ? (
              <>
                {gesamt > 1 && (
                  <div className="mm-kasten-fortschritt" role="status">
                    <strong>
                      Bild {gesamt - schlange.length} von {gesamt}
                    </strong>
                    <span className="mm-kasten-perlen" aria-hidden="true">
                      {Array.from({ length: gesamt }, (_, i) => (
                        <i key={i} className={i < gesamt - schlange.length - 1 ? 'ist-durch' : i === gesamt - schlange.length - 1 ? 'ist-dran' : ''} />
                      ))}
                    </span>
                  </div>
                )}
                <p className="mm-kasten-hinweis">
                  {bearbeitet
                    ? 'Neuer Ausschnitt, neuer Name — die Kennung bleibt, laufende Tische behalten das Motiv.'
                    : 'Schieben zum Verrücken, zwei Finger oder der Regler zum Zoomen. Was im Rahmen steht, kommt auf die Karte.'}
                </p>
                {stapelhinweis && <p className="mm-kasten-hinweis">{stapelhinweis}</p>}
                <canvas
                  ref={setLeinwand}
                  className="mm-kasten-rahmen"
                  width={AUSGABE_PX * 2}
                  height={AUSGABE_PX * 2}
                  onPointerDown={zeigerRunter}
                  onPointerMove={zeigerBewegt}
                  onPointerUp={zeigerHoch}
                  onPointerCancel={zeigerHoch}
                  onWheel={rollen}
                />
                <input
                  className="mm-kasten-regler"
                  type="range"
                  min={1}
                  max={ZOOM_MAX}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setzeZoom(Number(e.target.value), bild)}
                  aria-label="Zoom"
                />
                <input
                  className="mm-kasten-titel"
                  type="text"
                  placeholder={bearbeitet ? 'Name' : 'Name (freiwillig)'}
                  maxLength={TITEL_MAX}
                  value={titel}
                  onChange={(e) => setTitel(e.target.value)}
                />
                {/*
                  * Der Ton — nur beim Bearbeiten eines Motivs, das schon im
                  * Spiel ist.
                  *
                  * Beim EINREICHEN steht er bewusst nicht da: Ein wartender
                  * Vorschlag ist ein Bild, ueber das die Aufsicht noch
                  * entscheidet, und ein Ton daran waere ein zweites Stueck
                  * Inhalt, das dieselbe Pruefung braeuchte. Wer aufnimmt,
                  * haengt ihn danach an.
                  */}
                {bearbeitet && (
                  <div className="mm-tonzeile">
                    <span className="mm-tonzeile-kopf">
                      <Note />
                      <b>Ton</b>
                      <em>
                        {tonLaedt
                          ? 'wird geschnitten…'
                          : tonlage.art === 'neu'
                            ? 'neu gewählt'
                            : tonlage.art === 'weg'
                              ? 'wird entfernt'
                              : tonlage.hatTon
                                ? 'vorhanden'
                                : 'keiner'}
                      </em>
                    </span>
                    <div className="mm-tonzeile-knoepfe">
                      {/*
                        * Anhören gibt es nur, wenn es etwas zu hören gibt.
                        * Ein Knopf, der nichts tut, ist schlimmer als keiner.
                        */}
                      {(tonlage.art === 'neu' ||
                        (tonlage.art === 'unveraendert' && tonlage.hatTon)) && (
                        <button type="button" onClick={tonProbe} disabled={busy}>
                          Anhören
                        </button>
                      )}
                      <label className="mm-tonzeile-waehlen">
                        <span>{tonlage.art === 'neu' ? 'Andere Datei' : 'Datei wählen'}</span>
                        <input
                          type="file"
                          accept="audio/*"
                          hidden
                          onChange={(e) => {
                            void tonWaehlen(e.target.files?.[0]);
                            // Zuruecksetzen, sonst loest dieselbe Datei beim
                            // zweiten Mal kein `change` aus.
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {(tonlage.art === 'neu' ||
                        (tonlage.art === 'unveraendert' && tonlage.hatTon)) && (
                        <button
                          type="button"
                          className="mm-tonzeile-weg"
                          onClick={() => setTonlage({ art: 'weg' })}
                          disabled={busy}
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                    <p className="mm-tonzeile-satz">
                      Höchstens {String(TON_SEKUNDEN).replace('.', ',')} Sekunden — was länger ist,
                      wird abgeschnitten. Er spielt, sobald jemand dieses Meme über den Tisch wirft.
                    </p>
                  </div>
                )}
                <div className="mm-kasten-knoepfe">
                  {/* Derselbe Platz, drei Bedeutungen: beim Bearbeiten
                      Abbrechen/Speichern, im Stapel Ueberspringen, beim
                      letzten Bild Verwerfen. Ein weiterer Knopf daneben waere
                      auf einem Telefon eine Reihe zu viel. */}
                  <button
                    type="button"
                    className="mm-kasten-weg"
                    onClick={bearbeitet ? bearbeitenWeg : ueberspringen}
                    disabled={busy}
                  >
                    {bearbeitet ? 'Abbrechen' : schlange.length > 0 ? 'Überspringen' : 'Verwerfen'}
                  </button>
                  <button
                    type="button"
                    className="mm-kasten-los"
                    onClick={() => void (bearbeitet ? speichern() : einreichen(istAufsicht))}
                    disabled={busy}
                  >
                    {bearbeitet ? 'Speichern' : istAufsicht ? 'Aufnehmen' : 'Einreichen'}
                  </button>
                </div>
                {!bearbeitet && schlange.length > 0 && (
                  <button
                    type="button"
                    className="mm-kasten-abbruch"
                    onClick={stapelWeg}
                    disabled={busy}
                  >
                    Dieses und die {schlange.length} übrigen verwerfen
                  </button>
                )}
              </>
            ) : (
              /* Zwischen zwei Bildern. Die Flaeche behaelt die Groesse des
                 Rahmens, damit der Kasten nicht bei jedem Bild springt. */
              <div className="mm-kasten-warten" role="status">
                Nächstes Bild wird geöffnet…
              </div>
            )}
            {meldung && <p className="mm-kasten-gut">{meldung}</p>}
          </div>
        ) : (
          <>
            {blatt === 'einreichen' && (
              <div className="mm-kasten-inhalt">
              <>
                <p className="mm-kasten-hinweis">
                  {istAufsicht
                    ? 'Bilder aussuchen — auch mehrere auf einmal. Du schneidest sie nacheinander zu, jedes ist sofort im Spiel.'
                    : 'Such dir Memes aus deiner Galerie aus, gern mehrere auf einmal. Du schneidest sie nacheinander selbst zurecht — was auf dem Brett landet, entscheidet die Aufsicht.'}
                </p>
                {typeof frei === 'number' && (
                  <p className="mm-kasten-hinweis">
                    {frei > 0
                      ? `Du kannst gerade noch ${frei === 1 ? 'ein Bild' : `${frei} Bilder`} einreichen.`
                      : 'Es warten schon fünf Bilder von dir. Sobald eines geprüft ist, geht wieder etwas.'}
                  </p>
                )}
                <label className="mm-kasten-waehlen">
                  <span>{istAufsicht ? 'Bilder auswählen' : 'Memes auswählen'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      void waehlen(e.target.files);
                      // Zuruecksetzen, sonst loest dieselbe Auswahl beim
                      // zweiten Mal kein `change` aus und der Knopf wirkt tot.
                      e.target.value = '';
                    }}
                  />
                </label>
              </>
            {meldung && <p className="mm-kasten-gut">{meldung}</p>}
              </div>
            )}

        {blatt === 'kasten' && (
          <div className="mm-kasten-inhalt">
            {laedt && <p className="mm-kasten-hinweis">Wird geladen…</p>}
            {!laedt && vorschlaege.length === 0 && (
              <p className="mm-kasten-hinweis">Der Kasten ist leer.</p>
            )}
            {vorschlaege.map((eintrag) => (
              <div className="mm-kasten-zeile" key={eintrag.kennung}>
                <img src={eintrag.bild} alt={eintrag.titel ?? 'Vorschlag'} />
                <div className="mm-kasten-zeile-text">
                  <strong>{eintrag.titel ?? 'ohne Namen'}</strong>
                  <span>{eintrag.einreicher ?? 'unbekannt'}</span>
                </div>
                <div className="mm-kasten-zeile-knoepfe">
                  <button
                    type="button"
                    className="mm-kasten-ja"
                    onClick={() => void entscheiden(eintrag.kennung, true)}
                    disabled={busy}
                    aria-label="Freigeben"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="mm-kasten-nein"
                    onClick={() => void entscheiden(eintrag.kennung, false)}
                    disabled={busy}
                    aria-label="Ablehnen"
                  >
                    <Kreuz />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/*
          * Der Bestand traegt seit dem 28. August die Aufmachung der
          * Sammlungsseite: dieselbe Ueberschrift mit Zahl daneben, dasselbe
          * Raster (`mm-sammelgitter`), dieselben Kacheln.
          *
          * Das ist keine Kosmetik, sondern dieselbe Sache zweimal: Hier wie
          * dort steht ein Raster aus Memes, und wer beides am selben Abend
          * benutzt, soll nicht zweimal lernen, wie ein Meme aussieht. Die
          * Aufsicht bekommt darueber hinaus drei Knoepfe je Kachel — der
          * Unterschied zwischen Ansehen und Verwalten.
          */}
        {blatt === 'bestand' && (
          <div className="mm-kasten-inhalt">
            <p className="mm-kasten-hinweis">
              Alles, was zusätzlich zu den 88 Grundmotiven im Spiel ist. ✎ ändert Name,
              Zuschnitt und Ton, ✕ nimmt heraus — beides wirkt sofort für neue Partien. Der
              Name steht im Spiel groß über dem Brett, sobald jemand das Paar findet.
            </p>
            {!laedt && bestand.length === 0 && (
              <p className="mm-kasten-hinweis">Noch nichts hochgeladen.</p>
            )}
            {bestand.length > 0 && (
              <section className="mm-gruppe">
                <h3>
                  Im Spiel
                  <em>
                    {bestand.filter((eintrag) => eintrag.hatTon).length}/{bestand.length} mit Ton
                  </em>
                </h3>
                <div className="mm-sammelgitter">
                  {bestand.map((eintrag) => (
                    <div className="mm-sammelkachel mm-bestandskachel" key={eintrag.kennung}>
                      {/* Die Zahl in der Adresse ist kein Schmuck: Beim Aendern
                          bleibt die Kennung gleich, und ohne sie zeigte die
                          Kachel danach noch den alten Zuschnitt. */}
                      <img
                        src={`${motivBildPfad(eintrag.kennung)}?v=${stand}`}
                        alt={eintrag.titel ?? eintrag.kennung}
                      />
                      <span className="mm-bestand-name">{eintrag.titel ?? '—'}</span>
                      <button
                        type="button"
                        className="mm-bestand-knopf mm-bestand-stift"
                        onClick={() => void bearbeiten(eintrag)}
                        disabled={busy}
                        aria-label={`${eintrag.titel ?? 'Motiv'} bearbeiten`}
                      >
                        ✎
                      </button>
                      {/*
                        * Die Note ist Anzeige UND Knopf: Sie sagt, dass hier
                        * ein Ton haengt, und spielt ihn auf einen Tipp. Ein
                        * stummes Motiv bekommt sie gar nicht erst — ein
                        * blasses Zeichen, das nichts tut, waere eine Frage
                        * ohne Antwort.
                        */}
                      {eintrag.hatTon && (
                        <button
                          type="button"
                          className="mm-bestand-knopf mm-bestand-ton"
                          onClick={() => {
                            const pfad = motivTonPfad(eintrag.kennung);
                            if (pfad) void spieleTonProbeVon(pfad).catch(() => undefined);
                          }}
                          aria-label={`Ton von ${eintrag.titel ?? 'Motiv'} anhören`}
                        >
                          <Note />
                        </button>
                      )}
                      <button
                        type="button"
                        className="mm-bestand-knopf mm-bestand-raus"
                        onClick={() => void entscheiden(eintrag.kennung, false)}
                        disabled={busy}
                        aria-label={`${eintrag.titel ?? 'Motiv'} herausnehmen`}
                      >
                        <Kreuz />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
          </>
        )}

        {fehler && <p className="mm-kasten-fehler">{fehler}</p>}
      </div>
    </div>
  );
}
