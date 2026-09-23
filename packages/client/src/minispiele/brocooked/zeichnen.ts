/**
 * Der Zeichner von BroCooked: aus einer Küche wird ein Bild.
 *
 * Ohne React, ohne Netz, ohne Regeln — er liest den Zustand und malt. Genau
 * deshalb kann ihn später auch das Banner der Spielauswahl benutzen, das
 * dieselbe Küche mit lauter Bots laufen lässt.
 *
 * **Er verändert nichts.** Kein Feld der Küche wird geschrieben, keine Liste
 * an Ort und Stelle sortiert (die Köche werden über eine Kopie nach Tiefe
 * sortiert, nicht `k.koeche` selbst). Die Küche ist im Gleichschritt-Spiel
 * derselbe Gegenstand, den der Rückspuler kopiert und weiterrechnet — ein
 * Zeichner, der auch nur ein `fortschritt` anfasst, ließe zwei Geräte
 * auseinanderlaufen, und zwar erst Minuten später und nur bei einem von
 * beiden.
 *
 * **Kein `Math.random`, kein Bild.** Die Flackerwerte der Flammen kommen aus
 * dem Takt (`flimmern`), damit zwei Geräte dasselbe Feuer sehen; Würfeln
 * würde hier zwar nichts kaputtmachen, aber im Screenshot-Vergleich zweier
 * Geräte sieht ein flackernder Unterschied aus wie ein Auseinanderlaufen, und
 * dann sucht jemand einen Fehler, den es nicht gibt. Bilder gibt es gar
 * keine: Die Lieferung ist bestellt (docs/ASSETS-BROCOOKED.md) und noch nicht
 * da, und ein `<img>` auf eine fehlende Datei ist ein weißer Kasten, der nach
 * Fehler aussieht (CLAUDE.md, „Was regelmäßig Zeit kostet").
 */

import {
  FEUER,
  FEUER_KERN,
  FEUER_SCHEIN,
  FORTSCHRITT,
  FORTSCHRITT_GRUND,
  FORTSCHRITT_LOESCHEN,
  TELLER,
  TELLER_RAND,
  TELLER_SCHMUTZIG,
  dunkler,
  heller,
  raumfarben,
  sitzfarbe,
  stationFarbe,
  zustandFarbe,
  zutatFarbe,
  type Raumfarben,
} from './farben';
import {
  GAREN_TAKTE,
  GREIFWEITE,
  KOCH_RADIUS,
  LOESCHEN_TAKTE,
  SCHNEIDEN_TAKTE,
  SPUELEN_TAKTE,
  davor,
  type Koch,
  type Kueche,
  type Station,
  type StationsArt,
  type Tragbar,
} from './kueche';

/** Luft um die Küche, in Kacheln. Ohne sie klebt die Randwand am Bildrand. */
export const RAND_KACHELN = 0.4;

/**
 * Die Abbildung Küche → Leinwand: ein Maßstab und ein Versatz.
 *
 * Bewusst nur fünf Zahlen und kein Kameraobjekt wie bei Golf: Die Küche steht
 * still und passt immer ganz ins Bild. Es gibt nichts zu verfolgen und nichts
 * zu klemmen — und was es nicht gibt, kann auch nicht zittern.
 */
export interface Sicht {
  /** Maße der Leinwand in CSS-Pixeln. */
  breite: number;
  hoehe: number;
  /** Kantenlänge einer Kachel in Pixeln. */
  mass: number;
  /** Bildpunkt der Kachelecke (0, 0). */
  versatzX: number;
  versatzY: number;
}

/**
 * Den Maßstab so wählen, dass die ganze Küche hineinpasst, und sie zentrieren.
 *
 * Die Leinwandmaße werden auf mindestens 1 gezogen: Ein frisch eingehängtes
 * `<canvas>` meldet im ersten Bild 0 × 0, und ein Maßstab von 0 (oder gar
 * ein negativer) macht aus jeder folgenden Rechnung `NaN` — sichtbar wird das
 * als leeres Bild, gesucht wird es im Zeichner.
 */
export function kameraFuer(k: Kueche, leinwandBreite: number, leinwandHoehe: number): Sicht {
  const breite = Math.max(1, leinwandBreite);
  const hoehe = Math.max(1, leinwandHoehe);
  const spalten = Math.max(1, k.breite) + 2 * RAND_KACHELN;
  const zeilen = Math.max(1, k.hoehe) + 2 * RAND_KACHELN;
  const mass = Math.min(breite / spalten, hoehe / zeilen);
  return {
    breite,
    hoehe,
    mass,
    versatzX: (breite - k.breite * mass) / 2,
    versatzY: (hoehe - k.hoehe * mass) / 2,
  };
}

/** Kachelkoordinate → Bildpunkt. Die Formel steht nur hier. */
export function bildX(sicht: Sicht, x: number): number {
  return sicht.versatzX + x * sicht.mass;
}

export function bildY(sicht: Sicht, y: number): number {
  return sicht.versatzY + y * sicht.mass;
}

/**
 * Deko-Zufall aus dem Takt: derselbe Takt gibt denselben Wert, auf jedem Gerät.
 *
 * Ganzzahlige Mischung statt `Math.sin`: Winkelfunktionen weichen zwischen
 * Safari und V8 in der letzten Stelle ab (Kopf von `kueche.ts`), und auch
 * wenn das hier nur Flammen betrifft — ein Wert, der überall gleich ist,
 * kostet nichts extra.
 */
function flimmern(takt: number, nr: number): number {
  const h = Math.imul((takt | 0) * 31 + nr * 2654435761, 0x9e3779b1);
  return ((h >>> 16) & 1023) / 1023;
}

/* --------------------------------------------------------------------------
 * Kürzel der Stationen
 * ----------------------------------------------------------------------- */

/**
 * Was auf einer Station steht.
 *
 * Das sind absichtlich GENAU die Zeichen des Küchengitters (`kuechen.ts`):
 * Wer eine Küche als Text liest und dann auf dem Bildschirm sucht, findet
 * dieselben Buchstaben wieder. Kiste und Ablage bleiben leer — die Kiste
 * zeigt ihre Zutat als Farbfleck, und ein „=" auf jeder zweiten Kachel wäre
 * nur Unruhe.
 */
const KUERZEL: Readonly<Record<StationsArt, string>> = {
  ablage: '',
  kiste: '',
  brett: 'B',
  topf: 'P',
  pfanne: 'F',
  fritteuse: 'G',
  tellerstapel: 'T',
  spuele: 'S',
  durchreiche: 'D',
  tonne: 'X',
};

/**
 * Wie lange die laufende Arbeit an dieser Station dauert — 0 heißt: keine.
 *
 * Die Dauer steht nicht an der Station, sondern hängt davon ab, was gerade
 * passiert; `fortschritt` allein sagt nur „so viele Takte", nicht „von wie
 * vielen". Ohne diese Zuordnung wäre jeder Balken eine Lüge.
 */
function arbeitsDauer(s: Station): number {
  if (s.brennt > 0) return LOESCHEN_TAKTE;
  if (s.art === 'brett' && s.inhalt?.art === 'zutat' && s.inhalt.zustand === 'roh') {
    return SCHNEIDEN_TAKTE;
  }
  if (s.art === 'spuele' && s.stapel > 0) return SPUELEN_TAKTE;
  if (s.inhalt?.art === 'zutat' && s.inhalt.zustand === 'gart') return GAREN_TAKTE;
  return 0;
}

/* --------------------------------------------------------------------------
 * Das Bild
 * ----------------------------------------------------------------------- */

/**
 * Ein Bild malen. Reihenfolge von unten nach oben: Boden, Wände und Theken,
 * Stationen, was darauf liegt, Feuer, Köche.
 *
 * `eigenerSitz` ist der Sitz des Zuschauers; -1 heißt „niemand" (Banner,
 * Zuschauer) und lässt den hellen Ring weg. Ohne ihn verliert man in einer
 * Küche mit vier gleich großen Köchen binnen Sekunden sich selbst — das ist
 * der häufigste Grund, warum jemand ins Leere greift.
 */
export function zeichne(
  ctx: CanvasRenderingContext2D,
  k: Kueche,
  sicht: Sicht,
  eigenerSitz: number,
  dunkel: boolean,
): void {
  const p = raumfarben(dunkel);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.fillStyle = p.hintergrund;
  ctx.fillRect(0, 0, sicht.breite, sicht.hoehe);

  zeichneBoden(ctx, k, sicht, p);
  zeichneWaende(ctx, k, sicht, p);
  zeichneStationen(ctx, k, sicht, p);
  zeichneInhalte(ctx, k, sicht, p);
  zeichneFeuer(ctx, k, sicht);
  zeichneKoeche(ctx, k, sicht, p, eigenerSitz);

  ctx.restore();
}

function zeichneBoden(ctx: CanvasRenderingContext2D, k: Kueche, sicht: Sicht, p: Raumfarben): void {
  const m = sicht.mass;
  for (let y = 0; y < k.hoehe; y += 1) {
    for (let x = 0; x < k.breite; x += 1) {
      if (k.fest[y * k.breite + x] === 1) continue;
      // Schachbrett: Zwei Töne geben dem Laufen ein Tempo, das eine einzelne
      // Fläche nicht hat — man sieht, wie schnell man ist.
      ctx.fillStyle = (x + y) % 2 === 0 ? p.boden : p.bodenHell;
      ctx.fillRect(bildX(sicht, x), bildY(sicht, y), m + 0.5, m + 0.5);
    }
  }
  // Fugen in einem Zug, nicht je Kachel: ein Pfad statt einiger hundert.
  ctx.strokeStyle = p.bodenFuge;
  ctx.lineWidth = Math.max(0.5, m * 0.02);
  ctx.beginPath();
  for (let x = 1; x < k.breite; x += 1) {
    ctx.moveTo(bildX(sicht, x), bildY(sicht, 0));
    ctx.lineTo(bildX(sicht, x), bildY(sicht, k.hoehe));
  }
  for (let y = 1; y < k.hoehe; y += 1) {
    ctx.moveTo(bildX(sicht, 0), bildY(sicht, y));
    ctx.lineTo(bildX(sicht, k.breite), bildY(sicht, y));
  }
  ctx.stroke();
}

/** Wände sind alle festen Kacheln ohne Station — im Gitter das `#`. */
function zeichneWaende(ctx: CanvasRenderingContext2D, k: Kueche, sicht: Sicht, p: Raumfarben): void {
  const m = sicht.mass;
  for (let y = 0; y < k.hoehe; y += 1) {
    for (let x = 0; x < k.breite; x += 1) {
      const i = y * k.breite + x;
      if (k.fest[i] !== 1 || k.stationAuf[i] >= 0) continue;
      const px = bildX(sicht, x);
      const py = bildY(sicht, y);
      ctx.fillStyle = p.wand;
      ctx.fillRect(px, py, m + 0.5, m + 0.5);
      // Oberkante hell: Die Wand bekommt Höhe, ohne dass jemand einen
      // Schattenwurf rechnen muss.
      ctx.fillStyle = p.wandKante;
      ctx.fillRect(px, py, m + 0.5, m * 0.16);
    }
  }
}

function zeichneStationen(
  ctx: CanvasRenderingContext2D,
  k: Kueche,
  sicht: Sicht,
  p: Raumfarben,
): void {
  const m = sicht.mass;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(7, Math.round(m * 0.4))}px system-ui, -apple-system, sans-serif`;

  for (const s of k.stationen) {
    const px = bildX(sicht, s.x);
    const py = bildY(sicht, s.y);
    const grund = s.art === 'ablage' ? p.theke : stationFarbe(s.art);

    ctx.fillStyle = grund;
    ctx.fillRect(px, py, m + 0.5, m + 0.5);
    ctx.fillStyle = s.art === 'ablage' ? p.thekeKante : heller(grund, 0.22);
    ctx.fillRect(px, py, m + 0.5, m * 0.16);
    ctx.strokeStyle = p.umriss;
    ctx.lineWidth = Math.max(1, m * 0.03);
    ctx.strokeRect(px + 0.5, py + 0.5, m - 1, m - 1);

    const kuerzel = KUERZEL[s.art];
    if (kuerzel !== '') {
      // Das Kürzel steht unten in der Kachel: Die obersten Viertel gehören
      // dem Fortschrittsbalken und der Flamme (docs/ASSETS-BROCOOKED.md,
      // Freihalte-Zonen) — sonst schreibt die Flamme über den Buchstaben.
      ctx.fillStyle = p.schrift;
      ctx.fillText(kuerzel, px + m / 2, py + m * 0.74);
    }
    if (s.art === 'kiste' && s.zutat !== null) {
      // Die Kiste zeigt, was sie ausgibt — ohne das sind fünf Kisten fünfmal
      // dasselbe braune Rechteck.
      ctx.fillStyle = zutatFarbe(s.zutat);
      ctx.beginPath();
      ctx.arc(px + m / 2, py + m * 0.46, m * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.umriss;
      ctx.lineWidth = Math.max(1, m * 0.025);
      ctx.stroke();
    }
    if ((s.art === 'tellerstapel' || s.art === 'spuele') && s.stapel > 0) {
      zeichneStapel(ctx, sicht, s, px, py);
    }
  }
}

/** Der Tellerstapel und das schmutzige Geschirr in der Spüle: Scheibe je Teller. */
function zeichneStapel(
  ctx: CanvasRenderingContext2D,
  sicht: Sicht,
  s: Station,
  px: number,
  py: number,
): void {
  const m = sicht.mass;
  // Mehr als vier Scheiben sind nicht mehr zu zählen; darüber sagt die Zahl
  // mehr als der Stapel.
  const scheiben = Math.min(4, s.stapel);
  const farbe = s.art === 'spuele' ? TELLER_SCHMUTZIG : TELLER;
  for (let i = 0; i < scheiben; i += 1) {
    const y = py + m * 0.66 - i * m * 0.09;
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.ellipse(px + m / 2, y, m * 0.26, m * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = TELLER_RAND;
    ctx.lineWidth = Math.max(1, m * 0.02);
    ctx.stroke();
  }
  if (s.stapel > 4) {
    ctx.fillStyle = '#2b2118';
    ctx.font = `${Math.max(7, Math.round(m * 0.28))}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(String(s.stapel), px + m * 0.78, py + m * 0.8);
    ctx.font = `${Math.max(7, Math.round(m * 0.4))}px system-ui, -apple-system, sans-serif`;
  }
}

/** Was auf den Stationen liegt, plus der Balken der laufenden Arbeit. */
function zeichneInhalte(
  ctx: CanvasRenderingContext2D,
  k: Kueche,
  sicht: Sicht,
  p: Raumfarben,
): void {
  const m = sicht.mass;
  for (const s of k.stationen) {
    const px = bildX(sicht, s.x);
    const py = bildY(sicht, s.y);
    if (s.inhalt !== null) {
      zeichneDing(ctx, s.inhalt, px + m / 2, py + m * 0.46, m * 0.3, p);
    }
    const dauer = arbeitsDauer(s);
    if (dauer > 0 && s.fortschritt > 0) {
      const anteil = Math.min(1, s.fortschritt / dauer);
      const rand = m * 0.12;
      ctx.fillStyle = FORTSCHRITT_GRUND;
      ctx.fillRect(px + rand, py + m * 0.06, m - 2 * rand, m * 0.1);
      ctx.fillStyle = s.brennt > 0 ? FORTSCHRITT_LOESCHEN : FORTSCHRITT;
      ctx.fillRect(px + rand, py + m * 0.06, (m - 2 * rand) * anteil, m * 0.1);
    }
  }
}

/**
 * Ein tragbares Ding: Zutat oder Teller.
 *
 * Klein und wiedererkennbar, und die Form sagt den Zustand: ein ganzer Kreis
 * ist ungeschnitten, zwei Hälften sind geschnitten, ein Ring darum heißt „im
 * Topf". Nur über die Farbe ginge das nicht — auf einem Handy sind das
 * fünfzehn Pixel, und fünfzehn blasse Pixel gegen fünfzehn satte
 * unterscheidet niemand, während zwei Hälften sofort auffallen.
 */
export function zeichneDing(
  ctx: CanvasRenderingContext2D,
  ding: Tragbar,
  px: number,
  py: number,
  r: number,
  p: Raumfarben,
): void {
  if (ding.art === 'teller') {
    ctx.fillStyle = ding.sauber ? TELLER : TELLER_SCHMUTZIG;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = TELLER_RAND;
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.stroke();
    // Der Inhalt liegt als Ring kleiner Kleckse auf dem Teller — drei passen
    // darauf (TELLER_PLATZ), und drei Kleckse sind auch die Auskunft, die man
    // braucht: „fehlt noch etwas?"
    ding.inhalt.forEach((stueck, i) => {
      const winkel = (i / Math.max(1, ding.inhalt.length)) * Math.PI * 2;
      const ax = px + Math.cos(winkel) * r * 0.42;
      const ay = py + Math.sin(winkel) * r * 0.42;
      ctx.fillStyle = zustandFarbe(stueck.zutat, stueck.zustand);
      ctx.beginPath();
      ctx.arc(ax, ay, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }

  const farbe = zustandFarbe(ding.zutat, ding.zustand);
  ctx.fillStyle = farbe;
  ctx.strokeStyle = p.umriss;
  ctx.lineWidth = Math.max(1, r * 0.12);

  if (ding.zustand === 'roh') {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }

  if (ding.zustand === 'verkohlt') {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    // Ein heller Riss darüber: Verkohltes ist sonst nur ein dunkler Fleck und
    // sieht aus wie ein Loch im Bild.
    ctx.strokeStyle = dunkler(FEUER_KERN, 0.45);
    ctx.beginPath();
    ctx.moveTo(px - r * 0.5, py - r * 0.35);
    ctx.lineTo(px + r * 0.1, py + r * 0.1);
    ctx.lineTo(px + r * 0.5, py - r * 0.45);
    ctx.stroke();
    return;
  }

  // Geschnitten, garend, gar: zwei Hälften mit einer Fuge dazwischen.
  const spalt = r * 0.16;
  for (const seite of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(px + seite * spalt, py, r * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (ding.zustand === 'gart') {
    // Der Ring sagt „steht gerade im Topf" — sonst sieht Garendes genauso aus
    // wie Geschnittenes auf der Ablage.
    ctx.strokeStyle = FEUER;
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.beginPath();
    ctx.arc(px, py, r * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function zeichneFeuer(ctx: CanvasRenderingContext2D, k: Kueche, sicht: Sicht): void {
  const m = sicht.mass;
  k.stationen.forEach((s, nr) => {
    if (s.brennt === 0) return;
    const px = bildX(sicht, s.x) + m / 2;
    const py = bildY(sicht, s.y) + m * 0.5;

    ctx.fillStyle = FEUER_SCHEIN;
    ctx.beginPath();
    ctx.arc(px, py, m * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Drei Zungen, jede mit eigenem Flackern — der Takt treibt sie, nicht die
    // Wanduhr, damit zwei Geräte dasselbe Feuer zeigen.
    for (let i = 0; i < 3; i += 1) {
      const z = flimmern(k.takt, nr * 7 + i);
      const breit = m * (0.16 + 0.07 * z);
      const hoch = m * (0.5 + 0.35 * z);
      const ab = (i - 1) * m * 0.22;
      ctx.fillStyle = FEUER;
      ctx.beginPath();
      ctx.moveTo(px + ab - breit, py + m * 0.35);
      ctx.lineTo(px + ab, py + m * 0.35 - hoch);
      ctx.lineTo(px + ab + breit, py + m * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = FEUER_KERN;
      ctx.beginPath();
      ctx.moveTo(px + ab - breit * 0.4, py + m * 0.35);
      ctx.lineTo(px + ab, py + m * 0.35 - hoch * 0.55);
      ctx.lineTo(px + ab + breit * 0.4, py + m * 0.35);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function zeichneKoeche(
  ctx: CanvasRenderingContext2D,
  k: Kueche,
  sicht: Sicht,
  p: Raumfarben,
  eigenerSitz: number,
): void {
  /*
   * Nach Tiefe sortiert, damit ein vorne stehender Koch den hinteren
   * überdeckt und nicht umgekehrt — und auf einer KOPIE, weil die
   * Sitzreihenfolge von `k.koeche` die Eingabereihenfolge des Gleichschritts
   * ist: Sie hier umzustellen wäre eine andere Partie.
   */
  const reihe = k.koeche.map((koch, sitz) => ({ koch, sitz })).sort((a, b) => a.koch.y - b.koch.y);
  for (const { koch, sitz } of reihe) {
    zeichneKoch(ctx, k, sicht, p, koch, sitz, sitz === eigenerSitz);
  }
}

function zeichneKoch(
  ctx: CanvasRenderingContext2D,
  k: Kueche,
  sicht: Sicht,
  p: Raumfarben,
  koch: Koch,
  sitz: number,
  eigener: boolean,
): void {
  const m = sicht.mass;
  const px = bildX(sicht, koch.x);
  const py = bildY(sicht, koch.y);
  const r = KOCH_RADIUS * m;
  const farbe = sitzfarbe(sitz);

  // Wer ausgestiegen ist, bleibt sichtbar, aber blass: Er steht weiter im Weg,
  // und ein unsichtbares Hindernis ist das Ärgerlichste, was eine Küche hat.
  ctx.globalAlpha = koch.aktiv ? 1 : 0.4;

  ctx.fillStyle = p.schatten;
  ctx.beginPath();
  ctx.ellipse(px, py + r * 0.5, r * 1.05, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Der Farbring am Boden — die einzige Stelle, an der steht, wer das ist.
  ctx.strokeStyle = farbe;
  ctx.lineWidth = Math.max(2, m * 0.07);
  ctx.beginPath();
  ctx.ellipse(px, py + r * 0.55, r * 1.1, r * 0.52, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (eigener) {
    // Ein zweiter, heller Ring außen: In einer Küche mit vier gleich großen
    // Köchen verliert man sich sonst binnen Sekunden selbst.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(1, m * 0.035);
    ctx.beginPath();
    ctx.ellipse(px, py + r * 0.55, r * 1.35, r * 0.66, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rumpf in der Sitzfarbe, Kochmütze weiß darüber.
  ctx.fillStyle = farbe;
  ctx.beginPath();
  ctx.arc(px, py - r * 0.05, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dunkler(farbe, 0.4);
  ctx.lineWidth = Math.max(1, m * 0.03);
  ctx.stroke();

  ctx.fillStyle = '#f7f4ec';
  ctx.beginPath();
  ctx.arc(px, py - r * 0.95, r * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Die Blickrichtung als Nase: Wer sieht, wohin ein Koch schaut, sieht auch,
  // welche Station sein Griff trifft (`davor`).
  ctx.fillStyle = dunkler(farbe, 0.55);
  ctx.beginPath();
  ctx.arc(px + koch.rx * r * 0.6, py + koch.ry * r * 0.6 - r * 0.05, r * 0.26, 0, Math.PI * 2);
  ctx.fill();

  if (koch.traegt !== null) {
    // Das getragene Ding über dem Kopf, nicht in der Hand: In der Hand deckt
    // es bei vier Richtungen mal die Figur, mal sich selbst zu.
    zeichneDing(ctx, koch.traegt, px, py - r * 1.9, r * 0.62, p);
  }

  if (koch.werkt && koch.aktiv) {
    const station = davor(k, koch);
    const dauer = station === null ? 0 : arbeitsDauer(station);
    if (station !== null && dauer > 0) {
      const anteil = Math.min(1, station.fortschritt / dauer);
      ctx.strokeStyle = FORTSCHRITT_GRUND;
      ctx.lineWidth = Math.max(2, m * 0.08);
      ctx.beginPath();
      ctx.arc(px, py, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = station.brennt > 0 ? FORTSCHRITT_LOESCHEN : FORTSCHRITT;
      ctx.beginPath();
      // Bei -90° beginnen: Ein Ring, der oben anfängt, wird als Uhr gelesen.
      ctx.arc(px, py, r * 1.5, -Math.PI / 2, -Math.PI / 2 + anteil * Math.PI * 2);
      ctx.stroke();
    }
  }

  // Der Punkt, den ein Griff treffen würde — nur beim eigenen Koch, sonst ist
  // das Bild ein Punktefeld.
  if (eigener && koch.aktiv) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(
      bildX(sicht, koch.x + koch.rx * GREIFWEITE),
      bildY(sicht, koch.y + koch.ry * GREIFWEITE),
      Math.max(1, m * 0.06),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
