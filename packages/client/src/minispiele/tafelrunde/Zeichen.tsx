/**
 * Die Kleinteile der Ruestkammer: Rollenname, Kostenfarbe und die vier
 * gezeichneten Zeichen (Rolle, Figur, Gold, Leben).
 *
 * Sie standen bis zum 06.09.2026 in screens/Tafelrunde.tsx. Gezogen worden
 * sind sie mit Brett, Bank und Ladenkarte zusammen, und aus demselben Grund:
 * Die Probe `/probe/ruestkammer` haengt die ECHTEN Bauteile ein, statt sie
 * nachzubauen — und ein Import aus dem Bildschirm zoege den ganzen Tisch samt
 * Tischverbindung in ein Buendel, das nur eine Wabe zeigen will (ein Buendel
 * packt Module ein, nicht einzelne Funktionen).
 *
 * Was hier NICHT steht, sind Regeln. Ein Rollenname ist eine Uebersetzung,
 * eine Kostenfarbe ist Zeichnung — beides sagt nichts darueber, was erlaubt
 * ist.
 */

import { blattPfad } from './bildfolge';
import { Figur3D } from './Figur3D';
import { Figurbild } from './KampfAnzeige';
import type { Einheit, Rolle } from './sicht';

/**
 * Farbe je Kostenstufe. Reine Zeichnung, kein Bedeutungstraeger der
 * Plattform — deshalb steht sie hier und nicht als CSS-Variable in
 * styles.css (DESIGN.md: Variablen sind fuer Gruen/Gold/Lila/Rot reserviert,
 * und eine Kostenstufe ist keins davon).
 */
export const KOSTEN_FARBE: Record<number, string> = {
  1: '#8fa3ad',
  2: '#5aa86a',
  3: '#5ea0f0',
};

/** Die Kostenfarbe einer Einheit, mit dem Rueckfall auf die erste Stufe. */
export function kostenFarbe(kosten: number | undefined): string {
  return KOSTEN_FARBE[kosten ?? 1] ?? KOSTEN_FARBE[1]!;
}

export const ROLLE_NAME: Record<Rolle, string> = {
  wache: 'Wache',
  schuetze: 'Schütze',
  magier: 'Magier',
  meuchler: 'Meuchler',
  beistand: 'Beistand',
};

/**
 * Das Zeichen einer Rolle — gezeichnet, nicht geladen.
 *
 * Seit es Figuren gibt (figuren.ts), ist das hier der RUECKFALL: Jede Einheit
 * zeigt ihr Bild, und nur wenn dazu keins vorliegt oder es nicht laedt, tritt
 * diese Strichzeichnung an seine Stelle (`Figurbild`). Fuer die fuenf Rollen
 * selbst gibt es weiterhin keine Bilder, und ein `<img>` auf eine Datei, die
 * es nicht gibt, ist ein weisser Kasten (CLAUDE.md und DESIGN.md) — deshalb
 * bleiben es fuenf schlichte Pfade.
 */
export function RollenZeichen({ rolle }: { rolle: Rolle }): React.JSX.Element {
  const pfade: Record<Rolle, React.JSX.Element> = {
    wache: <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />,
    schuetze: <path d="M5 19 19 5M19 5h-6M19 5v6M5 19c4-1 7-4 8-8" />,
    magier: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" />,
    meuchler: <path d="M6 18 18 6l1 4-9 9-4-1ZM6 18l-2 2" />,
    beistand: <path d="M12 4v16M4 12h16" />,
  };
  return (
    <svg className="tr-rolle" viewBox="0 0 24 24" aria-hidden="true">
      {pfade[rolle]}
    </svg>
  );
}

/**
 * Die Figur einer Einheit — dieselbe wie in der Arena, nur stehend.
 *
 * DREI STUFEN, in dieser Reihenfolge: das vorgerenderte 3D-Blatt ihrer ROLLE
 * (`Figur3D`), sonst die Pixelfigur der EINHEIT (`Figurbild`), sonst die
 * gezeichnete Strichfigur (`RollenZeichen`). Genau die Reihenfolge, die auch
 * die Arena nimmt — ein Rueckfall, der sich je Ort unterscheidet, waere beim
 * ersten fehlenden Bild ein Bildschirm mit zwei Sorten Platzhalter.
 *
 * WARUM DAS BLATT DER ROLLE UND NICHT DAS BILD DER EINHEIT: Bis zum 6.9.2026
 * standen die 3D-Figuren nur in der Arena, und in der Vorbereitung — dort, wo
 * man die meiste Zeit verbringt — sah man Pixelbilder. Der Bruch war genau
 * das, was Robin meinte. Der Preis ist, dass sich acht Einheiten eine Figur
 * teilen; ihr NAME steht daneben, ihre Marken darueber, ihre Kosten am Punkt.
 *
 * Kein Bildwechsel: Es ist immer Bild 0 der Ruhefolge. Wer aufstellt, soll
 * nicht von zappelnden Figuren abgelenkt werden — bewegt wird nur im Kampf.
 */
export function EinheitenFigur({
  einheit,
  klasse,
  spiegeln,
}: {
  einheit: Einheit;
  /** Wo die Figur steht: `tr-figur3d` auf Wabe und Bank, `…-karte` im Laden. */
  klasse: string;
  spiegeln?: boolean;
}): React.JSX.Element {
  return (
    <Figur3D
      name={einheit.name}
      blatt={blattPfad(einheit.rolle)}
      klasse={klasse}
      spiegeln={spiegeln}
      ersatz={
        <Figurbild
          einheit={einheit}
          klasse="tr-figur"
          ersatz={<RollenZeichen rolle={einheit.rolle} />}
        />
      }
    />
  );
}

/** Muenze und Herz stehen als Zeichen daneben, damit die Zahl nicht nackt ist. */
export function GoldZeichen(): React.JSX.Element {
  return (
    <svg className="tr-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 9.8h4a1.9 1.9 0 0 1 0 3.8h-3a1.9 1.9 0 0 0 0 3.8h4" />
    </svg>
  );
}

export function LebenZeichen(): React.JSX.Element {
  return (
    <svg className="tr-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7-.8c0 .3.0.4 0 .6C19 15.7 12 20 12 20Z" />
    </svg>
  );
}
