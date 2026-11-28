/**
 * Die Bildbausteine von TafelrundeNeu — jeder mit seinem Ersatz.
 *
 * Die Grafik der neuen Oberflaeche kommt Stueck fuer Stueck aus ihrer eigenen
 * Strecke (docs/ASSETS-TAFELRUNDE-NEU.md). Welche Datei es schon gibt, sagt
 * allein `figuren3d/grafik-neu.ts`; jede Funktion dort liefert null, solange
 * die Datei fehlt. Hier steht deshalb an JEDER Stelle zweierlei: das Bild,
 * wenn es eins gibt, und sonst ein Ersatz, der nach Absicht aussieht — die
 * alte Figur aus dem Rollenblatt, ein gezeichnetes Zeichen, eine Farbflaeche.
 * Nie ein `<img>` auf eine Datei, die es nicht gibt (CLAUDE.md).
 *
 * Traegt die Grafikstrecke eine Datei ein, erscheint sie hier ohne
 * Codeaenderung: Gefragt wird bei jedem Zeichnen, nicht einmal beim Laden.
 */

import { useState } from 'react';

import { aktiveSprache } from '../../../i18n';

import {
  effektBild,
  figurNeuBlatt,
  kartenRahmen,
  uiBild,
  zeichenBild,
} from '../../../figuren3d/grafik-neu';
import { Figur3D } from '../Figur3D';
import type { Rolle } from '../sicht';
import { markenFarbe, markenGlyphe } from '../marken';
import { einheitName, rollenName } from '../text';
import type { Effektname } from './abspielen';
import stil from './neu.module.css';

/**
 * Ein gemaltes UI-Teil (Holz und Messing, `uiBild`) als Hintergrund: die
 * Variable mit dem Bild und `data-bild` als Schalter fuers Stylesheet. Ohne
 * Bild kommt beides nicht, dann bleibt der gezeichnete Look von vorher.
 *
 * Hintergrund und kein `<img>`: Die Teile werden per `border-image` in
 * Kappen und Mitte zerlegt (Schild, Wimpel, Plakette), damit runde Enden bei
 * anderer Breite nicht verzerren — das kann nur CSS.
 */
export function uiHintergrund(
  name: string,
  variable: string,
): { 'data-bild'?: ''; style?: React.CSSProperties } {
  const bild = uiBild(name);
  return bild ? { 'data-bild': '', style: { [variable]: `url(${bild})` } as React.CSSProperties } : {};
}

/** Was ein Bild von einer Einheit wissen muss. */
export interface Bildeinheit {
  id: string;
  name: string;
  rolle: string;
  kosten: number;
}

/** Die fuenf Rollen in der Reihenfolge, in der das Regelblatt sie nennt. */
export const ROLLEN: readonly Rolle[] = ['wache', 'schuetze', 'magier', 'meuchler', 'beistand'];

function istRolle(rolle: string): rolle is Rolle {
  return (ROLLEN as readonly string[]).includes(rolle);
}

/**
 * Das Blatt einer Figur — je Einheit, aus grafik-neu.ts.
 *
 * Bis zum 28.11.2026 trat hier das alte Rollenblatt (KayKit, je Rolle eins)
 * ein, solange es das neue nicht gab. Seit alle 22 Blaetter da sind und das
 * alte Tafelrunde entfernt ist, gibt es diesen Rueckfall nicht mehr: Fehlt ein
 * Blatt, steht das Rollenzeichen (`Figur`).
 */
export function figurBlatt(einheit: Bildeinheit): string | null {
  return figurNeuBlatt(einheit.id);
}

/**
 * Das Zeichen einer Rolle — gezeichnet, nicht geladen. Der Rueckfall, wenn es
 * weder ein gemaltes Zeichen (`RolleZeichen`) noch ein Figurenblatt gibt.
 * Die Striche stehen in styles.css (`.tr-rolle`: ohne Fuellung, Strich in
 * der Schriftfarbe).
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
 * Eine Figur, stehend oder (mit `gib`) vom Takt der Arena bewegt.
 *
 * `klasse` sagt, wo und wie gross: Feld, Bank, Karte und Arena haben eigene
 * Masse. Der Ersatz ohne Blatt ist das Rollenzeichen auf einem Sockel — man
 * erkennt daran wenigstens, was die Einheit tut.
 */
export function Figur({
  einheit,
  klasse,
  spiegeln,
  gib,
}: {
  einheit: Bildeinheit;
  klasse?: string;
  spiegeln?: boolean;
  gib?: (el: HTMLImageElement | null) => void;
}): React.JSX.Element {
  return (
    <Figur3D
      name={einheitName(einheit)}
      blatt={figurBlatt(einheit)}
      spiegeln={spiegeln}
      klasse={klasse ? `${stil.figur} ${klasse}` : stil.figur}
      gib={gib}
      ersatz={
        <span className={`${stil.figurErsatz} ${klasse ?? ''}`.trim()} role="img" aria-label={einheitName(einheit)}>
          {istRolle(einheit.rolle) && <RollenZeichen rolle={einheit.rolle} />}
        </span>
      }
    />
  );
}

/**
 * Ein gemaltes Zeichen mit gezeichnetem Rueckfall. Faellt das Bild beim Laden
 * aus, tritt der Rueckfall ein — der gescheiterte PFAD wird gemerkt (siehe
 * Figur3D.tsx, warum kein Ja/Nein).
 */
function Gemalt({
  name,
  klasse,
  ersatz,
  titel,
}: {
  name: string;
  klasse?: string;
  ersatz: React.ReactNode;
  titel?: string;
}): React.JSX.Element {
  const pfad = zeichenBild(name);
  const [kaputt, setKaputt] = useState<string | null>(null);
  if (pfad === null || pfad === kaputt) {
    return (
      <span className={`${stil.zeichen} ${klasse ?? ''}`.trim()} title={titel} aria-hidden={titel ? undefined : true}>
        {ersatz}
      </span>
    );
  }
  return (
    <img
      className={`${stil.zeichen} ${klasse ?? ''}`.trim()}
      src={pfad}
      alt={titel ?? ''}
      onError={() => setKaputt(pfad)}
    />
  );
}

/** Das Zeichen einer Rolle — am Sockel jeder Figur (Robins Lesehilfe). */
export function RolleZeichen({ rolle, klasse }: { rolle: string; klasse?: string }): React.JSX.Element {
  return (
    <Gemalt
      name={`rolle-${rolle}`}
      klasse={klasse}
      titel={istRolle(rolle) ? rollenName(rolle) : undefined}
      ersatz={istRolle(rolle) ? <RollenZeichen rolle={rolle} /> : null}
    />
  );
}

/** Das Zeichen einer Marke, in ihrer Farbe. */
export function MarkeZeichen({ marke, klasse }: { marke: string; klasse?: string }): React.JSX.Element {
  return (
    <span className={stil.markeHuelle} style={{ color: markenFarbe(marke) }}>
      <Gemalt
        name={`marke-${marke}`}
        klasse={klasse}
        ersatz={
          <svg viewBox="0 0 24 24" aria-hidden="true" className={stil.glyphe}>
            {markenGlyphe(marke)}
          </svg>
        }
      />
    </span>
  );
}

/** Sterne fuer die Stufe — ueber dem Lebensbalken (Robins Lesehilfe). */
export function Sterne({ stufe, klasse }: { stufe: number; klasse?: string }): React.JSX.Element {
  return (
    <span className={`${stil.sterne} ${klasse ?? ''}`.trim()} data-stufe={stufe} aria-hidden="true">
      {Array.from({ length: stufe }, (_, i) => (
        <Gemalt key={i} name="stern" klasse={stil.stern} ersatz="★" />
      ))}
    </span>
  );
}

export function Muenze({ klasse }: { klasse?: string }): React.JSX.Element {
  return <Gemalt name="gold" klasse={`${stil.muenze} ${klasse ?? ''}`} ersatz={<i className={stil.muenzeErsatz} />} />;
}

export function Herz({ klasse }: { klasse?: string }): React.JSX.Element {
  return (
    <Gemalt
      name="leben"
      klasse={`${stil.herz} ${klasse ?? ''}`}
      ersatz={
        <svg viewBox="0 0 24 24" aria-hidden="true" className={stil.glyphe}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
        </svg>
      }
    />
  );
}

/**
 * Die Kostenstufe als Wort fuer das Stylesheet: Bronze, Silber, Gold
 * (Robins Wahl fuer die Porträtkarten). Mehr als drei Stufen kennt der
 * Katalog nicht; eine vierte bekaeme den Goldrahmen statt keinen.
 */
export function kostenStufe(kosten: number): 'bronze' | 'silber' | 'gold' {
  if (kosten <= 1) return 'bronze';
  if (kosten === 2) return 'silber';
  return 'gold';
}

/**
 * Der Rahmen einer Porträtkarte: das gemalte Bild, wenn es da ist, sonst der
 * CSS-Rahmen in Bronze, Silber oder Gold (`data-rahmen` im Stylesheet).
 */
export function Kartenrahmen({ kosten }: { kosten: number }): React.JSX.Element | null {
  const pfad = kartenRahmen(Math.min(3, Math.max(1, kosten)));
  const [kaputt, setKaputt] = useState<string | null>(null);
  if (pfad === null || pfad === kaputt) return null;
  return <img className={stil.rahmenBild} src={pfad} alt="" aria-hidden="true" onError={() => setKaputt(pfad)} />;
}

/**
 * Ein Effekt im Kampf: das gemalte Einzelbild, im Code animiert (Groesse,
 * Drehung, Ausblenden), oder ein Lichtschein in seiner Farbe.
 */
export function Effektbild({
  name,
  wirker,
}: {
  name: Effektname;
  wirker?: boolean;
}): React.JSX.Element {
  const pfad = effektBild(name);
  const [kaputt, setKaputt] = useState<string | null>(null);
  return (
    <span className={stil.effekt} data-effekt={name} data-wirker={wirker ? '' : undefined} aria-hidden="true">
      {pfad && pfad !== kaputt ? (
        <img src={pfad} alt="" onError={() => setKaputt(pfad)} />
      ) : (
        <i className={stil.effektErsatz} />
      )}
    </span>
  );
}

/**
 * Ein Einheitenname auf engem Raum (Porträtkarte, Traeger im Markenpopup).
 *
 * Die neuen Namen sind lange Einzelwoerter ("Geisterschildkröte",
 * "Pinguinschleuder"), und auf einer 68 px breiten Karte schnitt die Zeile
 * sie mitten im Buchstaben ab (Sichtprobe vom 27.11.2026). Drei Mittel, in
 * dieser Reihenfolge: Die Schrift wird mit der Karte kleiner (Container-
 * Einheiten im Stylesheet), lange Namen eine Stufe kleiner (`data-lang`), und
 * umbrochen wird zweizeilig mit Silbentrennung — `lang` sagt dem Browser,
 * nach welchen Regeln. Wo er keine Trennregeln hat, bricht `overflow-wrap`
 * notfalls im Wort; abgeschnitten wird nichts mehr.
 */
export function Kurzname({ name, klasse }: { name: string; klasse?: string }): React.JSX.Element {
  return (
    <span className={klasse} lang={aktiveSprache()} data-lang={name.length > 12 ? '' : undefined}>
      {name}
    </span>
  );
}

/**
 * Was eine Einheit im Laden kostet — `preis` aus dem Katalog (seit dem
 * 27.11.2026 abends getrennt von der Kostenstufe `kosten`, die nur noch Farbe
 * und Chancen bestimmt). Ein Tisch aus der Zeit davor hat kein `preis`; dort
 * WAR die Stufe der Preis, also gilt sie. Umgerechnet wird nichts.
 */
export function preisVon(einheit: { kosten: number; preis?: number }): number {
  return einheit.preis ?? einheit.kosten;
}
