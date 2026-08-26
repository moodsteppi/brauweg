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
 * **Vorschau und Ergebnis sind dieselbe Funktion.** `malen()` zeichnet in die
 * Vorschau-Leinwand und in die Ausgabe-Leinwand; nur die Seitenlaenge ist
 * anders, alle Masse sind Bruchteile davon. Eine zweite Rechenstrecke fuer
 * die Vorschau waere die sichere Art, ein Bild anders zu speichern, als es
 * angezeigt wurde.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../api';
import { motivBildPfad } from './bildpfad';

/** Kantenlaenge des gespeicherten Bildes. Die Grundmotive haben 224 px; hier
    sind es mehr, weil auf einem Meme oft Text steht. */
const AUSGABE_PX = 320;

/** Muss zu BILD_MAX_ZEICHEN in packages/server/src/memes.ts passen. */
const MAX_ZEICHEN = 60_000;

/** Muss zu TITEL_MAX im Server passen. */
const TITEL_MAX = 40;

/** Wie weit sich hineinzoomen laesst. 1 heisst: das ganze Bild ist zu sehen. */
const ZOOM_MAX = 4;

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
}

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
  const [zoom, setZoom] = useState(1);
  const [versatz, setVersatz] = useState<Versatz>({ x: 0, y: 0 });
  const [grund, setGrund] = useState('#ffffff');
  const [titel, setTitel] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [bestand, setBestand] = useState<Bestandsmotiv[]>([]);
  const [laedt, setLaedt] = useState(false);

  const leinwand = useRef<HTMLCanvasElement | null>(null);
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
    const flaeche = leinwand.current;
    if (!flaeche || !bild) return;
    const ctx = flaeche.getContext('2d');
    if (!ctx) return;
    // Die Leinwand ist doppelt so gross wie ihre Anzeige. Auf einem
    // Telefonschirm ist eine 1:1-Leinwand sichtbar weich, und ein weiches
    // Vorschaubild laesst einen genauer zuschneiden, als noetig waere.
    malen(ctx, flaeche.width, bild, zoom, versatz, grund);
  }, [bild, zoom, versatz, grund]);

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

  // --- Bild waehlen --------------------------------------------------------

  const waehlen = async (datei: File | undefined): Promise<void> => {
    if (!datei) return;
    setFehler(null);
    setMeldung(null);
    try {
      // `from-image` ist die Vorgabe der Norm, steht hier aber ausdruecklich:
      // Ein Handyfoto traegt seine Drehung als EXIF-Merkmal, und ohne diese
      // Auswertung liegt jedes Hochformat quer im Rahmen.
      const neu = await createImageBitmap(datei, { imageOrientation: 'from-image' });
      bild?.close?.();
      zoomRef.current = 1;
      versatzRef.current = { x: 0, y: 0 };
      setBild(neu);
      setGrund(randfarbe(neu));
      setZoom(1);
      setVersatz({ x: 0, y: 0 });
    } catch {
      setFehler('Dieses Bild ließ sich nicht öffnen.');
    }
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
    if (!bild) return;
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
      bild.close?.();
      setBild(null);
      setTitel('');
      setMeldung(
        antwort.status === 'frei'
          ? 'Aufgenommen. Ab der nächsten Partie kann es auf dem Brett liegen.'
          : 'Danke! Dein Meme liegt jetzt im Kasten und wartet auf Freigabe.',
      );
      if (istAufsicht) void listenHolen();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setFehler(
        code === 'zuVieleVorschlaege'
          ? 'Es warten schon fünf Bilder von dir. Warte, bis sie geprüft sind.'
          : code === 'bildUngueltig' || code === 'bildZuGross'
            ? 'Dieses Bild hat der Server nicht angenommen.'
            : 'Das Einreichen ist fehlgeschlagen.',
      );
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
            ✕
          </button>
        </div>

        {blaetter.length > 1 && (
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

        {blatt === 'einreichen' && (
          <div className="mm-kasten-inhalt">
            {!bild ? (
              <>
                <p className="mm-kasten-hinweis">
                  {istAufsicht
                    ? 'Bild aussuchen, Ausschnitt wählen, aufnehmen. Es ist sofort im Spiel.'
                    : 'Such dir ein Meme aus deiner Galerie aus. Du schneidest es selbst zurecht — was auf dem Brett landet, entscheidet die Aufsicht.'}
                </p>
                <label className="mm-kasten-waehlen">
                  <span>Bild auswählen</span>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => void waehlen(e.target.files?.[0])}
                  />
                </label>
              </>
            ) : (
              <>
                <p className="mm-kasten-hinweis">
                  Schieben zum Verrücken, zwei Finger oder der Regler zum Zoomen. Was im Rahmen
                  steht, kommt auf die Karte.
                </p>
                <canvas
                  ref={leinwand}
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
                  placeholder="Name (freiwillig)"
                  maxLength={TITEL_MAX}
                  value={titel}
                  onChange={(e) => setTitel(e.target.value)}
                />
                <div className="mm-kasten-knoepfe">
                  <button
                    type="button"
                    className="mm-kasten-weg"
                    onClick={() => {
                      bild.close?.();
                      setBild(null);
                    }}
                    disabled={busy}
                  >
                    Anderes Bild
                  </button>
                  <button
                    type="button"
                    className="mm-kasten-los"
                    onClick={() => void einreichen(istAufsicht)}
                    disabled={busy}
                  >
                    {istAufsicht ? 'Aufnehmen' : 'Einreichen'}
                  </button>
                </div>
              </>
            )}
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
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {blatt === 'bestand' && (
          <div className="mm-kasten-inhalt">
            <p className="mm-kasten-hinweis">
              Alles, was zusätzlich zu den 88 Grundmotiven im Spiel ist. Herausnehmen wirkt sofort
              für neue Partien.
            </p>
            {!laedt && bestand.length === 0 && (
              <p className="mm-kasten-hinweis">Noch nichts hochgeladen.</p>
            )}
            <div className="mm-kasten-gitter">
              {bestand.map((eintrag) => (
                <div className="mm-kasten-kachel" key={eintrag.kennung}>
                  <img src={motivBildPfad(eintrag.kennung)} alt={eintrag.titel ?? eintrag.kennung} />
                  <button
                    type="button"
                    onClick={() => void entscheiden(eintrag.kennung, false)}
                    disabled={busy}
                    aria-label="Herausnehmen"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {fehler && <p className="mm-kasten-fehler">{fehler}</p>}
      </div>
    </div>
  );
}
