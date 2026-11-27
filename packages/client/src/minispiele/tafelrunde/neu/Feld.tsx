/**
 * Das Feld der Ruestphase: der gemalte Schauplatz, darueber das Hex-Raster
 * als leichte Markierung — oben das Brett des Gegners (gespiegelt), unten das
 * eigene. Und das Bild einer Einheit (`Einheitsbild`, `zellRufe`), das auch die
 * Bank benutzt.
 *
 * DAS RASTER IST NICHT EINGEMALT (Umsetzungsplan, Abschnitt 4): Der
 * Schauplatz ist ein Bild ohne Felder, die Waben legt der Code darueber, aus
 * `rastermass` und `wabenLage` (zuege.ts) — derselben Geometrie wie im alten
 * Tafelrunde und in der Arena. Ein Raster im Bild stuende beim naechsten
 * geaenderten Regelsatz (andere Spaltenzahl) neben den Figuren.
 *
 * BEDIENUNG wie im alten Brett und mit denselben Haken (ziehen.ts): Ziehen
 * ist die Hauptgeste, ein Tipp ohne Bewegung waehlt bzw. setzt ab. Jede Wabe
 * traegt `data-ziel`, daran findet das Ziehen sein Ziel unter dem Finger. Die
 * Wabe ist als Sechseck ausgeschnitten (`clip-path`), damit sich die
 * Kaesten der versetzten Reihen nicht gegenseitig den Finger wegnehmen.
 */

import { feldBild, type Schauplatz } from '../../../figuren3d/grafik-neu';
import type { Einheit } from '../sicht';
import { einheitName, rollenName, tz } from '../text';
import { type Kaempfer, type Ort, gleicherOrt, ortSchluessel, platzVon, rastermass, wabenLage } from '../zuege';
import type { Zeigerrufe } from '../ziehen';
import { Figur, RolleZeichen, Sterne } from './grafik';
import stil from './neu.module.css';
import { markenFarbe } from '../Synergien';

/** Der Grund des Feldes: das gemalte Bild oder die Farbflaeche des Schauplatzes. */
export function Schauplatzgrund({ schauplatz }: { schauplatz: Schauplatz }): React.JSX.Element {
  const bild = feldBild(schauplatz);
  return (
    <div
      className={stil.schauplatz}
      data-schauplatz={schauplatz}
      style={bild ? { backgroundImage: `url(${bild})` } : undefined}
      aria-hidden="true"
    />
  );
}

/**
 * Was eine Zelle mit Einheit zum Antippen und Ziehen braucht — als Eigenschaften
 * fuer das Element, das den Finger faengt (die Wabe bzw. der Bankplatz).
 *
 * Zwei Wege wie im alten Brett (Brett.tsx, `Einheitenmarke`): `aktiv` — die
 * Zeigerereignisse des Ziehens, ein Tipp landet ueber `onZeigerEnde` bei
 * `tippe`; sonst der Lesepfad `onNachsehen`, der das Blatt ohne Knoepfe
 * aufschlaegt. `detail === 0` ist der Klick von Tastatur und Vorlesegeraet;
 * der vom Finger kam schon ueber `pointerup` und darf nicht doppelt zaehlen.
 */
export function zellRufe({
  ort,
  aktiv,
  zeiger,
  onTippe,
  onNachsehen,
  name,
}: {
  ort: Ort;
  aktiv: boolean;
  zeiger?: Zeigerrufe;
  onTippe?: (ort: Ort) => void;
  onNachsehen?: () => void;
  name: string;
}): React.HTMLAttributes<HTMLElement> {
  const greifbar = aktiv && zeiger !== undefined;
  const lesbar = !aktiv && onNachsehen !== undefined;
  if (!greifbar && !lesbar) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': name,
    onPointerDown: greifbar ? (e) => zeiger!.onZeigerStart(ort, e) : undefined,
    onPointerMove: greifbar ? zeiger!.onZeigerBewegung : undefined,
    onPointerUp: greifbar ? (e) => zeiger!.onZeigerEnde(ort, e) : undefined,
    onPointerCancel: greifbar ? zeiger!.onZeigerAbbruch : undefined,
    onClick: greifbar
      ? (e) => {
          if (e.detail === 0) onTippe?.(ort);
        }
      : () => onNachsehen?.(),
    onKeyDown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (greifbar) onTippe?.(ort);
      else onNachsehen?.();
    },
  };
}

/** Der Vorlesename einer Einheit auf einem Platz. */
export function einheitsBeschriftung(kaempfer: Kaempfer, einheit: Einheit | undefined): string {
  if (!einheit) return kaempfer.id;
  return tz('wabe.titel', { name: einheitName(einheit), rolle: rollenName(einheit.rolle), stufe: kaempfer.stufe });
}

/**
 * Das Bild einer Einheit auf einem Platz — Figur, Sterne, Rollenzeichen am
 * Sockel und (wenn eine Marke angetippt ist) ihr Farbring. Nimmt keine
 * Zeiger an: Den Finger faengt die Zelle darunter, und die Figur ragt nach
 * oben ueber ihre Wabe hinaus — finge SIE den Finger, gehoerte ein Tipp auf
 * die Wabe darueber der falschen Einheit.
 */
export function Einheitsbild({
  kaempfer,
  einheit,
  ring,
  gewaehlt,
  versteckt,
  spiegeln,
  klasse,
}: {
  kaempfer: Kaempfer;
  einheit: Einheit | undefined;
  /** Farbe des Markenrings, wenn die angetippte Marke auf dieser Einheit liegt. */
  ring: string | null;
  gewaehlt: boolean;
  /** Haengt gerade am Finger — der Platz zeigt sie nur noch blass. */
  versteckt: boolean;
  spiegeln?: boolean;
  klasse?: string;
}): React.JSX.Element {
  return (
    <div
      className={`${stil.einheit} ${klasse ?? ''}`.trim()}
      data-gewaehlt={gewaehlt ? '' : undefined}
      data-versteckt={versteckt ? '' : undefined}
      data-ring={ring ? '' : undefined}
      style={ring ? ({ '--ring': ring } as React.CSSProperties) : undefined}
      aria-hidden="true"
    >
      {ring && <i className={stil.ring} />}
      {einheit && <Figur einheit={einheit} klasse={stil.feldFigur} spiegeln={spiegeln} />}
      <Sterne stufe={kaempfer.stufe} klasse={stil.einheitSterne} />
      {einheit && <RolleZeichen rolle={einheit.rolle} klasse={stil.sockel} />}
    </div>
  );
}

/**
 * Das Hex-Raster als eine Zeichnung — Linien mit fester Strichstaerke, egal
 * wie das Brett gestreckt ist (`non-scaling-stroke`). Dieselbe Geometrie wie
 * die Waben darueber (`rastermass`, `wabenLage`), damit Linie und Figur
 * zusammenstehen; auch die Arena zeichnet es.
 */
export function Raster({ reihen, spalten, klasse }: { reihen: number; spalten: number; klasse?: string }): React.JSX.Element {
  const mass = rastermass(reihen, spalten);
  return (
    <svg className={`${stil.raster} ${klasse ?? ''}`.trim()} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: reihen * spalten }, (_, i) => {
        const lage = wabenLage(mass, Math.floor(i / spalten), i % spalten);
        const b = mass.wabenBreite;
        const h = mass.wabenHoehe;
        const x = lage.links;
        const y = lage.oben;
        const punkte = [
          [x + b / 2, y],
          [x + b, y + h / 4],
          [x + b, y + (3 * h) / 4],
          [x + b / 2, y + h],
          [x, y + (3 * h) / 4],
          [x, y + h / 4],
        ]
          .map(([px, py]) => `${px!.toFixed(2)},${py!.toFixed(2)}`)
          .join(' ');
        return <polygon key={i} points={punkte} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}

/** Ein Brett (eigenes oder fremdes) als Hex-Raster mit Einheiten. */
export function Hexbrett({
  reihen,
  spalten,
  felder,
  katalog,
  gespiegelt,
  eigen,
  aktiv,
  gewaehlt,
  istZiel,
  ablegeZiel,
  ziehtVon,
  zeiger,
  onTippe,
  onNachsehen,
  marke,
  beschriftung,
}: {
  reihen: number;
  spalten: number;
  felder: readonly (Kaempfer | null)[];
  katalog: Record<string, Einheit>;
  gespiegelt?: boolean;
  /** Das eigene Brett: Ziele, Ziehen, Antippen. Sonst nur ansehen. */
  eigen?: boolean;
  aktiv: boolean;
  gewaehlt: Ort | null;
  istZiel?: (ort: Ort) => boolean;
  ablegeZiel: string | null;
  ziehtVon: Ort | null;
  zeiger?: Zeigerrufe;
  onTippe?: (ort: Ort) => void;
  onNachsehen?: (ort: Ort) => void;
  /** Die angetippte Marke — ihre Traeger bekommen den Farbring. */
  marke: string | null;
  beschriftung: string;
}): React.JSX.Element {
  const mass = rastermass(reihen, spalten);
  const anzahl = reihen * spalten;
  return (
    <div
      className={stil.hexbrett}
      data-eigen={eigen ? '' : undefined}
      style={{ aspectRatio: `${mass.seitenverhaeltnis}` }}
      role="group"
      aria-label={beschriftung}
    >
      <Raster reihen={reihen} spalten={spalten} />
      {Array.from({ length: anzahl }, (_, i) => {
        const platz = platzVon(i, reihen, spalten, gespiegelt === true);
        const lage = wabenLage(mass, Math.floor(i / spalten), i % spalten);
        const ort: Ort = { bereich: 'brett', platz };
        const k = felder[platz] ?? null;
        const einheit = k ? katalog[k.id] : undefined;
        const schluessel = ortSchluessel(ort);
        const ziel = eigen && istZiel ? istZiel(ort) : false;
        const lageStil = {
          left: `${lage.links}%`,
          top: `${lage.oben}%`,
          width: `${mass.wabenBreite}%`,
          height: `${mass.wabenHoehe}%`,
        };
        /* Die Wabe faengt den Finger (als Sechseck ausgeschnitten), ein
           leeres Ziel nimmt den Tipp des Antipp-Wegs an. */
        const rufe = k
          ? zellRufe({
              ort,
              aktiv: eigen === true && aktiv,
              zeiger: eigen ? zeiger : undefined,
              onTippe,
              onNachsehen: onNachsehen ? () => onNachsehen(ort) : undefined,
              name: einheitsBeschriftung(k, einheit),
            })
          : ziel
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': tz('brett.feld', { n: platz + 1 }) + tz('brett.ziel'),
                onClick: () => onTippe?.(ort),
              }
            : {};
        return (
          <div
            key={i}
            className={stil.wabe}
            data-ziel={eigen ? schluessel : undefined}
            data-zielbar={ziel ? '' : undefined}
            data-unter={ablegeZiel === schluessel ? '' : undefined}
            style={lageStil}
            {...rufe}
          />
        );
      })}
      {/* Die Figuren als eigene Lage UEBER den Waben, ohne Zeiger — siehe
          `Einheitsbild`. Nach Reihen gestapelt: Wer weiter vorn steht,
          verdeckt den dahinter. */}
      {Array.from({ length: anzahl }, (_, i) => {
        const platz = platzVon(i, reihen, spalten, gespiegelt === true);
        const k = felder[platz] ?? null;
        if (!k) return null;
        const lage = wabenLage(mass, Math.floor(i / spalten), i % spalten);
        const ort: Ort = { bereich: 'brett', platz };
        const einheit = katalog[k.id];
        const ring = marke && einheit?.marken.includes(marke) ? markenFarbe(marke) : null;
        return (
          <div
            key={`f${i}`}
            className={stil.figurLage}
            style={{
              left: `${lage.links}%`,
              top: `${lage.oben}%`,
              width: `${mass.wabenBreite}%`,
              height: `${mass.wabenHoehe}%`,
              zIndex: 20 + Math.floor(i / spalten),
            }}
          >
            <Einheitsbild
              kaempfer={k}
              einheit={einheit}
              ring={ring}
              gewaehlt={gleicherOrt(gewaehlt, ort)}
              versteckt={gleicherOrt(ziehtVon, ort)}
              spiegeln={gespiegelt}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Wer gerade auf dem Brett steht, als Kennungen — fuer das Markenpopup. */
export function aufBrett(felder: readonly (Kaempfer | null)[]): Set<string> {
  return new Set(felder.filter((k): k is Kaempfer => k !== null).map((k) => k.id));
}

/**
 * Das Feld: Schauplatz und die beiden Bretter. Das gegnerische nur zum
 * Ansehen, das eigene zum Bedienen.
 */
export function Feld({
  verhaeltnis,
  gegner,
  children,
}: {
  /** Breite durch Hoehe eines Bretts (`rastermass`) — daran misst das Stylesheet die Bretter. */
  verhaeltnis: number;
  /** Das Brett des gezeigten Gegners, fertig gebaut — oder nichts. */
  gegner: React.ReactNode;
  /** Das eigene Brett. */
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className={stil.feld} style={{ '--verhaeltnis': verhaeltnis } as React.CSSProperties}>
      {/* Kein eigener Grund: Der Schauplatz liegt unter dem ganzen Tisch
          (Spieltisch.tsx), das Feld ist nur die Flaeche, auf der die Bretter
          stehen. */}
      <div className={stil.feldInnen}>
        <div className={stil.feldGegner}>{gegner}</div>
        <div className={stil.feldEigen}>{children}</div>
      </div>
    </section>
  );
}
