/**
 * Trophäenpfad.
 *
 * Sechs gemalte Biome, senkrecht gestapelt: unten die Heimat, oben der
 * Sternenhafen. Der Pinguin steht dort, wohin ihn sein Trophäenstand
 * trägt. Angetippt öffnet sich der Pfad im Vollbild und lässt sich
 * abrollen.
 *
 * Vorher war das eine einzige Karte mit zwanzig von Hand am Bild
 * ausgemessenen Stützpunkten — mit dem Hinweis im Kopf, dass beim
 * Kartenwechsel alles neu vermessen werden muss. Genau das ist jetzt
 * überflüssig: Die Kacheln sind so bestellt, dass der Weg senkrecht durch
 * die Mitte läuft und höchstens 8 % der Breite davon abweicht.
 * Nachgemessen bleiben die Kacheln im Mittel unter 2 %, das sind auf einem
 * Handy wenige Pixel — schmaler als die Figur.
 *
 * Der Weg IST also die Mittellinie. Ein siebtes Biom ist damit ein Bild
 * plus eine Zeile in BIOME, und nichts muss vermessen werden.
 */

import { Suspense, lazy, useEffect, useRef, useState } from 'react';

import type { Getragen } from '../api';
import { Pinguin } from '../pinguin';
import { LEERE_BEMALUNG, type Bemalung } from '../bemalung';

/**
 * Die 3D-Figur auf dem Pfad — nachgeladen wie überall.
 *
 * Der gemalte Pinguin bleibt als Rückfall, solange `three` unterwegs ist: Der
 * Pfad ist das Erste, was man im Tab „Spielen" sieht, und ein leerer Fleck an
 * der Stelle „du bist hier" wäre schlimmer als ein Bild, das eine Sekunde
 * später ein anderes wird.
 */
const Avatar3D = lazy(() => import('../Avatar3D'));

export interface Biom {
  /** Dateiname ohne Endung unter /hub/. */
  readonly datei: string;
  readonly name: string;
  /** Trophäen, mit denen man am unteren Rand dieser Kachel ankommt. */
  readonly cp: number;
  readonly farbe: 'gruen' | 'mint' | 'blau' | 'rot' | 'lila' | 'gold';
}

/** Von unten nach oben. Die Reihenfolge ist der Weg. */
export const BIOME: readonly Biom[] = [
  { datei: 'biom-1-heimat', name: 'Heimat', cp: 0, farbe: 'gruen' },
  { datei: 'biom-2-wiesen', name: 'Wiesen', cp: 100, farbe: 'mint' },
  { datei: 'biom-3-strand', name: 'Strand', cp: 250, farbe: 'blau' },
  { datei: 'biom-4-feuerberg', name: 'Feuerberg', cp: 500, farbe: 'rot' },
  { datei: 'biom-5-schneefeld', name: 'Schneefeld', cp: 750, farbe: 'lila' },
  { datei: 'biom-6-sternenhafen', name: 'Sternenhafen', cp: 1000, farbe: 'gold' },
];

/**
 * Stelle des Pinguins, gemessen in Kacheln vom unteren Rand des Stapels.
 *
 * 0 heißt "ganz unten in der Heimat", 5 heißt "am Fuß des Sternenhafens".
 * Über 1000 Trophäen läuft er in den Sternenhafen hinein, aber nie ganz
 * hinaus: Oben ist Schluss, und eine Figur, die halb aus dem Bild ragt,
 * sähe nach Fehler aus.
 */
export function stelleFuer(trophies: number): number {
  const letzte = BIOME.length - 1;
  const oben = BIOME[letzte]!;
  if (trophies >= oben.cp) {
    return Math.min(letzte + (trophies - oben.cp) / 1000, letzte + 0.85);
  }
  for (let i = BIOME.length - 2; i >= 0; i--) {
    const hier = BIOME[i]!;
    if (trophies < hier.cp) continue;
    const naechste = BIOME[i + 1]!;
    const spanne = naechste.cp - hier.cp;
    return i + (spanne === 0 ? 0 : (trophies - hier.cp) / spanne);
  }
  return 0;
}

/**
 * Stelle der Figur als Anteil von unten, 0 bis 1, über den ganzen Stapel.
 *
 * Nach unten begrenzt: Bei null Trophäen stünde die Figur sonst exakt auf
 * der Unterkante des Stapels und ragte zur Hälfte heraus — und der
 * unterste Streifen der Heimat ist ohnehin Wasser. Zwei Prozent des
 * Stapels sind gut ein Achtel Kachel: der erste Trittstein.
 */
function anteilFuer(stelle: number): number {
  return Math.max(stelle / BIOME.length, 0.02);
}

/** Das zuletzt erreichte Biom — für die Beschriftung „du bist hier". */
function aktuellesBiom(trophies: number): Biom {
  return [...BIOME].reverse().find((b) => trophies >= b.cp) ?? BIOME[0]!;
}

/**
 * Die Ansicht auf die Figur ausrichten.
 *
 * Bewusst über `scrollTop` und nicht über eine eigene Rechnung mit
 * `transform`: Der Browser begrenzt `scrollTop` von selbst auf den
 * gültigen Bereich. Vorher wurde der Stapel verschoben, und bei null
 * Trophäen stand die Figur zwar mittig im Fenster — dafür lag unter ihr
 * nichts mehr als die Füllfarbe, weil die Kamera über den unteren Rand
 * des Bildes hinausgefahren war. Dieselbe Falle gäbe es oben.
 *
 * Kleines Fenster und Vollbild teilen sich diesen Weg, damit sie nicht
 * auseinanderlaufen können.
 */
/**
 * Wo die Figur im Fenster sitzt, gemessen von oben. 2/3 heisst: unteres
 * Drittel. Bewusst NICHT die Mitte - der Pinguin soll unten stehen und
 * hoechstens bis an die Grenze des unteren Drittels steigen, nie in die
 * Mitte. Am Anfang (wenig Troph.) begrenzt der Browser den Rollstand ohnehin
 * so, dass er ganz unten steht.
 */
const FIGUR_VON_OBEN = 2 / 3;

function useAufFigurRichten(
  ziel: React.RefObject<HTMLDivElement | null>,
  anteilVonUnten: number,
): void {
  useEffect(() => {
    const el = ziel.current;
    if (!el) return;
    const richten = (): void => {
      el.scrollTop = el.scrollHeight * (1 - anteilVonUnten) - el.clientHeight * FIGUR_VON_OBEN;
    };
    richten();
    // Nach dem Laden der Kacheln nochmal: Vorher steht die Höhe des
    // Stapels noch nicht fest, und die Ausrichtung ginge ins Leere.
    const beobachter = new ResizeObserver(richten);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [ziel, anteilVonUnten]);
}

export function Trophaeenpfad({
  trophies,
  getragen = {},
  bemalung,
}: {
  trophies: number;
  /** Was der Pinguin traegt — derselbe Satz wie im Kleiderschrank. */
  getragen?: Getragen;
  /** Bemalung der 3D-Figur. `null`/fehlend heisst: Standardoptik. */
  bemalung?: Bemalung | null;
}): React.JSX.Element {
  const [voll, setVoll] = useState(false);
  const stelle = stelleFuer(trophies);
  const hier = aktuellesBiom(trophies);
  const fenster = useRef<HTMLDivElement>(null);
  useAufFigurRichten(fenster, anteilFuer(stelle));

  return (
    <>
      <button
        type="button"
        className="hub-karte hub-karte--klein"
        onClick={() => setVoll(true)}
        aria-label={`Trophäenpfad öffnen. Du bist in ${hier.name} mit ${trophies} Trophäen.`}
      >
        {/* Eigener Rollbereich, auch wenn man ihn nicht mit dem Finger
            bewegen kann: Nur so begrenzt der Browser die Ansicht auf das
            Bild und laesst keine leere Flaeche stehen. */}
        <div className="pfad-fenster" ref={fenster}>
          <Stapel trophies={trophies} stelle={stelle} getragen={getragen} bemalung={bemalung} />
        </div>
        <span className="pfad-lupe" aria-hidden="true">
          {hier.name} · Pfad ansehen
        </span>
      </button>

      {voll && (
        <PfadVollbild
          trophies={trophies}
          stelle={stelle}
          getragen={getragen}
          bemalung={bemalung}
          onClose={() => setVoll(false)}
        />
      )}
    </>
  );
}

/**
 * Der Stapel selbst.
 *
 * Genau derselbe im kleinen Fenster wie im Vollbild — den Ausschnitt
 * bestimmt allein der umgebende Rollbereich. Eine zweite, kleinere
 * Darstellung zu bauen hieße, zwei Sachen gleich halten zu müssen.
 */
function Stapel({
  trophies,
  stelle,
  getragen,
  bemalung,
}: {
  trophies: number;
  stelle: number;
  getragen: Getragen;
  bemalung?: Bemalung | null;
}): React.JSX.Element {
  const anzahl = BIOME.length;
  const anteil = anteilFuer(stelle);

  return (
    <div className="pfad-stapel">
      {[...BIOME].reverse().map((biom) => (
        <img
          className="pfad-kachel"
          key={biom.datei}
          src={`/hub/${biom.datei}.webp`}
          alt=""
          draggable={false}
          /* Sechs Kacheln sind zusammen 1,1 MB. Wer den Pfad nur streift,
             soll nicht alle sechs bezahlen. */
          loading="lazy"
          decoding="async"
        />
      ))}

      {/* Checkpoints sitzen am unteren Rand ihrer Kachel — dort kommt man an. */}
      {BIOME.map((biom, i) => {
        const erreicht = trophies >= biom.cp;
        // Steht die Figur genau auf diesem Knoten, verdeckt sie ihn: Beide
        // liegen mittig auf derselben Hoehe (bei 500 etwa Pinguin und
        // Feuerberg-Marke), und die Zahl der Marke schaut unter der Figur
        // hervor. Dann tritt die Marke zurueck — der Pinguin traegt seinen
        // Stand ohnehin selbst, und wo er steht, ist "du bist hier".
        const verdeckt = Math.abs(stelle - i) < 0.34;
        return (
          <div
            className={`pfad-knoten hub-knoten--${biom.farbe}${erreicht ? ' is-an' : ' is-zu'}${
              verdeckt ? ' is-verdeckt' : ''
            }`}
            key={biom.cp}
            style={{ bottom: `${(i / anzahl) * 100}%` }}
          >
            <span className="pfad-knoten-name">{biom.name}</span>
            <span className="pfad-knoten-cp">{biom.cp}</span>
          </div>
        );
      })}

      <div className="pfad-figur" style={{ bottom: `${anteil * 100}%` }}>
        {/*
          Die Figur in drei Dimensionen, mit Eigenbewegung: Sie steht lange
          still im Bild, und ohne das leise Wippen sieht sie dort aus wie ein
          Aufkleber.

          Deutlich größer als der gemalte Daumennagel vorher (2,8 rem) — auf
          dem Pfad ist sie das „du bist hier", und das war kaum zu erkennen.
        */}
        <div className="pfad-figur-buehne">
          <Suspense fallback={<Pinguin getragen={getragen} groesse={5} />}>
            <Avatar3D
              muetze={false}
              bemalung={bemalung ?? LEERE_BEMALUNG}
              drehbar={false}
              lebendig
            />
          </Suspense>
        </div>
        <span className="pfad-figur-stand">
          <img src="/hub/pokal.png" alt="" aria-hidden="true" />
          {trophies}
        </span>
      </div>
    </div>
  );
}

/**
 * Vollbild.
 *
 * Beim Öffnen wird an die Stelle des Pinguins gesprungen, nicht an den
 * Anfang: Wer 600 Trophäen hat, will nicht erst durch drei Biome rollen.
 * Ohne Animation — eine Rollbewegung über sechs Bildschirmhöhen wäre
 * Selbstzweck und kostet nur Zeit.
 */
function PfadVollbild({
  trophies,
  stelle,
  getragen,
  bemalung,
  onClose,
}: {
  trophies: number;
  stelle: number;
  getragen: Getragen;
  bemalung?: Bemalung | null;
  onClose: () => void;
}): React.JSX.Element {
  const rolle = useRef<HTMLDivElement>(null);
  useAufFigurRichten(rolle, anteilFuer(stelle));

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  return (
    <div className="pfad-voll">
      <header className="pfad-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          ← Zurück
        </button>
        <span className="pfad-voll-stand">
          <img src="/hub/pokal.png" alt="" aria-hidden="true" />
          {trophies}
        </span>
      </header>
      <div className="pfad-voll-rolle" ref={rolle}>
        <Stapel trophies={trophies} stelle={stelle} getragen={getragen} bemalung={bemalung} />
      </div>
    </div>
  );
}
