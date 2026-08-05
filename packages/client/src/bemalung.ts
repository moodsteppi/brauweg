/**
 * Die Bemalung der 3D-Figur — als Striche, nicht als Bild.
 *
 * **Warum Striche und kein fertiges Bild.** Eine bemalte Textur wäre auch als
 * PNG zu speichern, aber selbst in 512 × 512 sind das hundert Kilobyte je
 * Konto, die bei jedem Laden des Profils mitkommen. Ein Strichzug ist eine
 * Handvoll Zahlen. Zweitausend Punkte wiegen rund 20 kB als JSON, und daraus
 * entsteht das Bild jedes Mal neu — auch wenn die Figur später ein feineres
 * Netz oder eine größere Textur bekommt.
 *
 * Gespeichert wird in Texturkoordinaten (0…1), nicht in Bildpunkten. Damit
 * bleibt die Bemalung gültig, wenn die Leinwand einmal von 1024 auf 2048
 * wächst.
 */

/** Ein Zug mit dem Finger: eine Farbe, eine Breite, ein Weg über die Figur. */
export interface Strich {
  /** Farbe als `#rrggbb`. */
  readonly f: string;
  /** Breite in Texturkoordinaten — 0,04 ist etwa eine Fingerkuppe. */
  readonly b: number;
  /** Der Weg als Paare `[u, v]`, jeweils 0…1. */
  readonly p: readonly (readonly [number, number])[];
}

export type Design = 'standard' | 'bemalt';

export interface Bemalung {
  readonly design: Design;
  readonly striche: readonly Strich[];
}

export const LEERE_BEMALUNG: Bemalung = { design: 'standard', striche: [] };

/**
 * Obergrenzen.
 *
 * Ohne sie malt ein Kind zehn Minuten lang und schickt ein Megabyte an den
 * Server — bei jedem Speichern. Die Zahlen sind großzügig: 300 Züge sind
 * mehr, als ein Mensch freiwillig malt, und 60 Punkte je Zug reichen für
 * einen Bogen über die ganze Figur.
 *
 * Wird es mehr, fällt der **älteste** Zug weg und nicht der neueste: Was man
 * gerade malt, soll erscheinen; dass ganz am Anfang etwas verschwindet, merkt
 * man kaum.
 */
export const MAX_STRICHE = 300;
export const MAX_PUNKTE_JE_STRICH = 60;

/** Einen Zug anhängen und dabei die Obergrenze wahren. */
export function mitStrich(bemalung: Bemalung, strich: Strich): Bemalung {
  const striche = [...bemalung.striche, strich];
  return {
    ...bemalung,
    striche: striche.length > MAX_STRICHE ? striche.slice(striche.length - MAX_STRICHE) : striche,
  };
}

/** Den letzten Zug zurücknehmen. */
export function ohneLetzten(bemalung: Bemalung): Bemalung {
  return { ...bemalung, striche: bemalung.striche.slice(0, -1) };
}

/**
 * Die Farben, die zur Auswahl stehen.
 *
 * Eine feste Auswahl statt eines freien Farbrads: Auf einem Handy trifft man
 * mit dem Daumen keinen Farbton, und zwölf kräftige Farben sehen auf der
 * Figur besser aus als jedes selbst gemischte Graubraun. Die Reihe folgt dem
 * Farbkreis, damit man findet, was man sucht.
 */
export const FARBEN: readonly { readonly wert: string; readonly name: string }[] = [
  { wert: '#e8433a', name: 'Rot' },
  { wert: '#f07d1e', name: 'Orange' },
  { wert: '#f5c518', name: 'Gelb' },
  { wert: '#7cc142', name: 'Grün' },
  { wert: '#2aa876', name: 'Tanne' },
  { wert: '#37b7d4', name: 'Türkis' },
  { wert: '#3f7fe0', name: 'Blau' },
  { wert: '#8b5cf0', name: 'Lila' },
  { wert: '#e05ba8', name: 'Pink' },
  { wert: '#8a5a2b', name: 'Braun' },
  { wert: '#2b2b30', name: 'Schwarz' },
  { wert: '#f6f4ef', name: 'Weiß' },
];

/** Breiten für den Pinsel, in Texturkoordinaten. */
export const BREITEN: readonly { readonly wert: number; readonly name: string }[] = [
  { wert: 0.02, name: 'Fein' },
  { wert: 0.045, name: 'Mittel' },
  { wert: 0.09, name: 'Dick' },
];

/**
 * Der Grundton der bemalbaren Figur.
 *
 * Gebrochenes Weiß und nicht reines: Auf reinem Weiß verschwindet jede helle
 * Farbe, und die Rundungen der Figur sind nicht mehr zu sehen, weil das Licht
 * oben ausbrennt.
 */
export const GRUNDTON = '#efece5';

/**
 * Ab welchem Sprung zwei aufeinanderfolgende Punkte NICHT mehr verbunden
 * werden.
 *
 * **Das ist die wichtigste Zahl in dieser Datei.** Die Oberfläche der Figur
 * ist in der Textur nicht am Stück, sondern in Inseln zerschnitten — Kopf,
 * Bauch, Flügel liegen als getrennte Flecken nebeneinander. Wer mit dem
 * Finger über eine Nahtstelle fährt, springt dabei von einer Insel zur
 * anderen, und eine gerade Linie zwischen den beiden Punkten zieht quer über
 * alles, was dazwischenliegt. Auf der Figur sieht das aus, als hätte jemand
 * gleichzeitig über Kopf, Bauch und Flanke gewischt.
 *
 * Genau das ist beim Bauen passiert und war im ersten Moment nicht als
 * Fehler zu erkennen: Der Zug landete ja auf der Figur, nur eben an drei
 * Stellen gleichzeitig.
 *
 * 0,06 ist gemessen: Ein zügiger Wisch bewegt sich je Bild um weniger als
 * das, ein Insel-Sprung um deutlich mehr.
 */
const SPRUNG = 0.06;

/**
 * Die Bemalung auf eine Leinwand zeichnen.
 *
 * Zeichnet immer alles neu. Das klingt verschwenderisch, ist aber bei ein
 * paar hundert Zügen in unter einer Millisekunde erledigt — und es erspart
 * die Buchführung darüber, was schon auf der Leinwand steht und was nicht.
 * Genau diese Buchführung geht bei „Zurücknehmen" sonst schief.
 */
export function zeichne(
  leinwand: HTMLCanvasElement,
  striche: readonly Strich[],
): void {
  const stift = leinwand.getContext('2d');
  if (!stift) return;
  const { width: b, height: h } = leinwand;

  stift.fillStyle = GRUNDTON;
  stift.fillRect(0, 0, b, h);

  stift.lineCap = 'round';
  stift.lineJoin = 'round';
  for (const strich of striche) {
    stift.strokeStyle = strich.f;
    stift.fillStyle = strich.f;
    stift.lineWidth = strich.b * b;
    const halb = (strich.b * b) / 2;

    let vorher: readonly [number, number] | null = null;
    for (const punkt of strich.p) {
      const [u, v] = punkt;
      const x = u * b;
      const y = v * h;

      // Jeder Punkt bekommt seinen Tupfer. Damit bleibt ein einzelner Tipp
      // sichtbar, und abgebrochene Wege haben runde Enden statt Stummel.
      stift.beginPath();
      stift.arc(x, y, halb, 0, Math.PI * 2);
      stift.fill();

      // Verbunden wird nur, was auch auf der Figur nebeneinanderliegt.
      if (vorher) {
        const du = u - vorher[0];
        const dv = v - vorher[1];
        if (Math.hypot(du, dv) < SPRUNG) {
          stift.beginPath();
          stift.moveTo(vorher[0] * b, vorher[1] * h);
          stift.lineTo(x, y);
          stift.stroke();
        }
      }
      vorher = punkt;
    }
  }
}
