/**
 * Das Levelformat und seine Prüfung.
 *
 * Ein Level ist eine JSON-Datei unter `levels/` (Spezifikation,
 * „Levelformat"). Server und Client lesen DIESELBE Datei: der Client zum
 * Spielen, der Server für Freischaltung, Höchstpunkte und Sternschwellen.
 * Weil eine JSON-Datei keinen Typ hat, geht jede Datei durch `pruefeLevel` —
 * auch die mitgelieferten, damit ein vertipptes `"stoff": "hloz"` im Test
 * auffällt und nicht erst als unsichtbares Teil am Bildschirm.
 *
 * Die Prüfung hier ist rein geometrisch: Jedes Teil steht auf etwas, nichts
 * überlappt mehr als 1 cm, der Schwerpunkt liegt über seiner Auflage. Die
 * Ruheprobe der Spezifikation (5 s ohne Schuss bewegt sich nichts über 5 cm)
 * braucht die Physik und gehört deshalb nicht hierher — siehe offene Punkte
 * in der Fertigmeldung des Pakets.
 */

import {
  BRO_WERTE,
  BROS,
  type Bro,
  broFreigeschaltet,
  GIRAFFEN_GROESSEN,
  GIRAFFEN_WERTE,
  type GiraffenGroesse,
  SPIELABLAUF,
  STOFF_WERTE,
  STOFFE,
  type Stoff,
  TREFFERPUNKTE_MAX_JE_ZIEL,
} from './regeln.js';

export const LEVEL_FASSUNG = 1;

/** So viel Überlappung (und so viel Luft unter einer Auflage) lässt die Prüfung durch, in Metern. */
export const LEVEL_TOLERANZ = 0.01;

export type Form = 'quader' | 'dreieck' | 'kreis';

export type Teil =
  | { stoff: Stoff; form: 'quader'; x: number; y: number; b: number; h: number; winkel?: number }
  | { stoff: Stoff; form: 'dreieck'; x: number; y: number; b: number; h: number; winkel?: number }
  | { stoff: Stoff; form: 'kreis'; x: number; y: number; r: number; winkel?: number };

export interface Giraffe {
  groesse: GiraffenGroesse;
  /** Fußpunkt, nicht Mittelpunkt. */
  x: number;
  y: number;
  blick: 'links' | 'rechts';
}

export interface Deko {
  bild: string;
  x: number;
  y: number;
  ebene: 'hinten' | 'vorne';
}

export interface Level {
  fassung: typeof LEVEL_FASSUNG;
  /** `w<welt>-<nr zweistellig>`, z. B. `w1-07`. */
  id: string;
  welt: number;
  nr: number;
  titel: string;
  breite: number;
  boden: number;
  schleuder: { x: number; y: number };
  bros: Bro[];
  /** `[0, zwei Sterne, drei Sterne]`. */
  sterne: [number, number, number];
  teile: Teil[];
  giraffen: Giraffe[];
  deko: Deko[];
}

export class LevelFehler extends Error {
  constructor(
    readonly levelId: string,
    readonly fehler: string[],
  ) {
    super(`Level ${levelId}: ${fehler.join('; ')}`);
    this.name = 'LevelFehler';
  }
}

export function levelId(welt: number, nr: number): string {
  return `w${welt}-${String(nr).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Höchstpunkte
// ---------------------------------------------------------------------------

/**
 * Die exakte Obergrenze der Punkte eines Versuchs (Spezifikation,
 * „Levelformat"). Jeder Summand ist eine harte Grenze: Ein Teil bricht
 * höchstens einmal, eine Giraffe fällt höchstens einmal, Treffer sind je Ziel
 * gedeckelt, und mindestens ein Bro muss fliegen. **Wer eine neue
 * Punktquelle einführt, ergänzt sie hier** — sonst lehnt der Server ehrliche
 * Läufe ab.
 *
 * Mit Ersatz-Pelle zählt ein Bro mehr; der Server liest das aus dem Feld
 * `hilfsmittel` der Meldung.
 */
export function hoechstpunkte(level: Level, opt: { ersatzPelle?: boolean } = {}): number {
  const bruch = level.teile.reduce((s, t) => s + STOFF_WERTE[t.stoff].bruchpunkte, 0);
  const giraffen = level.giraffen.reduce((s, g) => s + GIRAFFEN_WERTE[g.groesse].punkte, 0);
  const treffer = (level.teile.length + level.giraffen.length) * TREFFERPUNKTE_MAX_JE_ZIEL;
  const bros = level.bros.length + (opt.ersatzPelle ? 1 : 0);
  return bruch + giraffen + treffer + (bros - 1) * SPIELABLAUF.bonusJeUebrigemBro;
}

// ---------------------------------------------------------------------------
// Geometrie
// ---------------------------------------------------------------------------

/** Achsenparalleler Kasten plus die Strecken, mit denen etwas unten aufliegt bzw. oben etwas trägt. */
interface Umriss {
  name: string;
  links: number;
  rechts: number;
  unten: number;
  oben: number;
  /** Schwerpunkt in x — liegt er nicht über der Auflage, kippt das Teil. */
  schwerpunktX: number;
  /** Strecke, mit der es aufliegt (bei Kreis und Dreiecksspitze ein Punkt). */
  auflage: [number, number];
  /** Strecke, auf der es etwas tragen kann; `null`, wenn oben nichts halten kann (Giraffe). */
  traegt: [number, number] | null;
}

function normWinkel(w: number): number {
  return ((w % 360) + 360) % 360;
}

function umrissTeil(t: Teil, i: number): Umriss {
  const name = `Teil ${i + 1} (${t.stoff} ${t.form})`;
  if (t.form === 'kreis') {
    return {
      name,
      links: t.x - t.r,
      rechts: t.x + t.r,
      unten: t.y - t.r,
      oben: t.y + t.r,
      schwerpunktX: t.x,
      auflage: [t.x, t.x],
      traegt: [t.x, t.x],
    };
  }
  // Quader um 90° gedreht: Breite und Höhe tauschen. Andere Winkel lässt
  // `pruefeLevel` gar nicht erst durch.
  const quer = t.form === 'quader' && normWinkel(t.winkel ?? 0) % 180 === 90;
  const b = quer ? t.h : t.b;
  const h = quer ? t.b : t.h;
  const links = t.x - b / 2;
  const rechts = t.x + b / 2;
  return {
    name,
    links,
    rechts,
    unten: t.y - h / 2,
    oben: t.y + h / 2,
    schwerpunktX: t.x,
    auflage: [links, rechts],
    // Auf einer Dreiecksspitze hält nichts.
    traegt: t.form === 'dreieck' ? [t.x, t.x] : [links, rechts],
  };
}

function umrissGiraffe(g: Giraffe, i: number): Umriss {
  const w = GIRAFFEN_WERTE[g.groesse];
  // Rumpfbreite über die ganze Höhe: Wo der Hals genau sitzt, legt das Bild
  // fest, nicht das Level — also hält das Bauwerk über der ganzen Breite Abstand.
  return {
    name: `Giraffe ${i + 1} (${g.groesse})`,
    links: g.x - w.rumpfBreite / 2,
    rechts: g.x + w.rumpfBreite / 2,
    unten: g.y,
    oben: g.y + w.hoehe,
    schwerpunktX: g.x,
    auflage: [g.x - w.rumpfBreite / 2, g.x + w.rumpfBreite / 2],
    traegt: null,
  };
}

function ueberlappung(a: Umriss, b: Umriss): number {
  const dx = Math.min(a.rechts, b.rechts) - Math.max(a.links, b.links);
  const dy = Math.min(a.oben, b.oben) - Math.max(a.unten, b.unten);
  return Math.min(dx, dy);
}

/** Geometriefehler: Überlappungen, fehlende Auflage, Schwerpunkt neben der Auflage. */
function pruefeGeometrie(level: Level): string[] {
  const fehler: string[] = [];
  const teile = level.teile.map(umrissTeil);
  const giraffen = level.giraffen.map(umrissGiraffe);
  const alle = [...teile, ...giraffen];

  for (const u of alle) {
    if (u.links < 0 || u.rechts > level.breite) fehler.push(`${u.name} ragt aus dem Level (0 bis ${level.breite} m)`);
    if (u.unten < level.boden - LEVEL_TOLERANZ) fehler.push(`${u.name} steckt im Boden`);
  }

  for (let i = 0; i < alle.length; i++) {
    for (let j = i + 1; j < alle.length; j++) {
      const ue = ueberlappung(alle[i], alle[j]);
      if (ue > LEVEL_TOLERANZ) fehler.push(`${alle[i].name} und ${alle[j].name} überlappen ${(ue * 100).toFixed(0)} cm`);
    }
  }

  for (const u of alle) {
    if (Math.abs(u.unten - level.boden) <= LEVEL_TOLERANZ) continue;
    // Getragen wird nur von Teilen, deren Oberkante auf Höhe der eigenen
    // Unterkante liegt und deren Tragstrecke die Auflage berührt. Giraffen
    // tragen nichts.
    let tragLinks = Infinity;
    let tragRechts = -Infinity;
    for (const s of teile) {
      if (s === u || !s.traegt) continue;
      if (Math.abs(s.oben - u.unten) > LEVEL_TOLERANZ) continue;
      const l = Math.max(s.traegt[0], u.auflage[0]);
      const r = Math.min(s.traegt[1], u.auflage[1]);
      if (r < l - 1e-9) continue;
      tragLinks = Math.min(tragLinks, l);
      tragRechts = Math.max(tragRechts, r);
    }
    if (tragLinks === Infinity) {
      fehler.push(`${u.name} schwebt (Unterkante ${u.unten.toFixed(2)} m, nichts darunter)`);
    } else if (u.schwerpunktX < tragLinks - 1e-9 || u.schwerpunktX > tragRechts + 1e-9) {
      fehler.push(`${u.name} kippt: Schwerpunkt bei x=${u.schwerpunktX} liegt nicht über der Auflage ${tragLinks.toFixed(2)}–${tragRechts.toFixed(2)}`);
    }
  }
  return fehler;
}

// ---------------------------------------------------------------------------
// Bauplan: die tragenden Teile
// ---------------------------------------------------------------------------

/**
 * Die Teile, die am meisten tragen — was das Hilfsmittel „Bauplan" zeigt
 * (Spezifikation, „Shop im Spiel": „zeigt für ein Level die drei tragenden
 * Teile"). Gerechnet aus der Startlage der Leveldatei mit derselben
 * Auflageregel wie die Levelprüfung, also ohne Physik: Server, Client und
 * Test sehen dieselben drei.
 *
 * Gewicht eines Teils ist, was über ihm ruht — mittelbar mitgezählt, wer auf
 * einem Teil steht, das auf ihm steht. Giraffen gehen vor: Ein Teil unter
 * einer Giraffe ist wertvoller als eins unter drei Planken, denn umgeworfen
 * werden muss die Giraffe, nicht die Planke. Bei Gleichstand das tiefere,
 * dann das mit der kleineren Nummer — damit die Wahl nicht von der
 * Sortierung der Laufzeit abhängt.
 *
 * Teile, die nichts tragen, kommen nie in die Liste; ein Level mit weniger
 * als `anzahl` tragenden Teilen bekommt entsprechend weniger.
 */
export function tragendeTeile(level: Level, anzahl = 3): number[] {
  const teile = level.teile.map(umrissTeil);
  const giraffen = level.giraffen.map(umrissGiraffe);
  const alle = [...teile, ...giraffen];
  // traeger[j] = Teile, auf denen Element j aufliegt.
  const traeger: number[][] = alle.map((u) => {
    if (Math.abs(u.unten - level.boden) <= LEVEL_TOLERANZ) return [];
    const unter: number[] = [];
    teile.forEach((s, i) => {
      if (s === u || !s.traegt) return;
      if (Math.abs(s.oben - u.unten) > LEVEL_TOLERANZ) return;
      if (Math.min(s.traegt[1], u.auflage[1]) < Math.max(s.traegt[0], u.auflage[0]) - 1e-9) return;
      unter.push(i);
    });
    return unter;
  });
  // ueber[i] = alles, was mittelbar auf Teil i ruht.
  const ueber: Set<number>[] = teile.map(() => new Set());
  alle.forEach((_, j) => {
    const offen = [...traeger[j]];
    const gesehen = new Set<number>();
    while (offen.length > 0) {
      const i = offen.pop()!;
      if (gesehen.has(i)) continue;
      gesehen.add(i);
      ueber[i].add(j);
      offen.push(...traeger[i]);
    }
  });
  const anzahlTeile = teile.length;
  return teile
    .map((u, i) => ({
      i,
      giraffen: [...ueber[i]].filter((j) => j >= anzahlTeile).length,
      last: ueber[i].size,
      unten: u.unten,
    }))
    .filter((t) => t.last > 0)
    .sort((a, b) => b.giraffen - a.giraffen || b.last - a.last || a.unten - b.unten || a.i - b.i)
    .slice(0, anzahl)
    .map((t) => t.i);
}

// ---------------------------------------------------------------------------
// Prüfung einer Datei
// ---------------------------------------------------------------------------

function istZahl(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function istObjekt(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Prüft eine geladene Leveldatei und gibt sie typisiert zurück; wirft
 * `LevelFehler` mit ALLEN gefundenen Fehlern, nicht nur dem ersten — wer ein
 * Level baut, will nicht zehnmal neu laden.
 */
export function pruefeLevel(roh: unknown): Level {
  const f: string[] = [];
  if (!istObjekt(roh)) throw new LevelFehler('?', ['keine JSON-Objekt-Datei']);
  const id = typeof roh.id === 'string' ? roh.id : '?';

  if (roh.fassung !== LEVEL_FASSUNG) f.push(`fassung muss ${LEVEL_FASSUNG} sein`);
  const welt = roh.welt;
  const nr = roh.nr;
  if (!istZahl(welt) || !Number.isInteger(welt) || welt < 1) f.push('welt muss eine ganze Zahl ab 1 sein');
  if (!istZahl(nr) || !Number.isInteger(nr) || nr < 1) f.push('nr muss eine ganze Zahl ab 1 sein');
  if (istZahl(welt) && istZahl(nr) && id !== levelId(welt, nr)) f.push(`id muss ${levelId(welt, nr)} heißen`);
  if (typeof roh.titel !== 'string' || roh.titel.trim() === '') f.push('titel fehlt');
  if (!istZahl(roh.breite) || roh.breite <= 0) f.push('breite muss positiv sein');
  if (!istZahl(roh.boden)) f.push('boden fehlt');

  const schl = roh.schleuder;
  if (!istObjekt(schl) || !istZahl(schl.x) || !istZahl(schl.y)) f.push('schleuder braucht x und y');

  if (!Array.isArray(roh.bros) || roh.bros.length === 0) {
    f.push('bros: mindestens einer');
  } else {
    for (const b of roh.bros) {
      if (!(BROS as readonly unknown[]).includes(b)) f.push(`bros: unbekannter Bro „${String(b)}"`);
      else if (istZahl(welt) && istZahl(nr) && !broFreigeschaltet(b as Bro, welt, nr)) {
        const w = BRO_WERTE[b as Bro];
        f.push(`bros: ${w.name} kommt erst ab ${levelId(w.abWelt, w.abNr)}`);
      }
    }
    // Pelle ist der Grund-Bro und kommt in jedem Level (Spezifikation, „Die drei Bros").
    if (!roh.bros.includes('pelle')) f.push('bros: Pelle fehlt');
  }

  if (!Array.isArray(roh.teile)) f.push('teile fehlt');
  else roh.teile.forEach((t, i) => f.push(...pruefeTeil(t, i)));

  if (!Array.isArray(roh.giraffen) || roh.giraffen.length === 0) f.push('giraffen: mindestens eine');
  else
    roh.giraffen.forEach((g, i) => {
      const n = `Giraffe ${i + 1}`;
      if (!istObjekt(g)) return void f.push(`${n}: kein Objekt`);
      if (!(GIRAFFEN_GROESSEN as readonly unknown[]).includes(g.groesse)) f.push(`${n}: unbekannte Größe „${String(g.groesse)}"`);
      if (!istZahl(g.x) || !istZahl(g.y)) f.push(`${n}: x und y fehlen`);
      if (g.blick !== 'links' && g.blick !== 'rechts') f.push(`${n}: blick ist links oder rechts`);
    });

  const deko = roh.deko ?? [];
  if (!Array.isArray(deko)) f.push('deko muss eine Liste sein');
  else
    deko.forEach((d, i) => {
      if (!istObjekt(d) || typeof d.bild !== 'string' || !istZahl(d.x) || !istZahl(d.y) || (d.ebene !== 'hinten' && d.ebene !== 'vorne'))
        f.push(`Deko ${i + 1}: braucht bild, x, y und ebene (hinten/vorne)`);
    });

  const st = roh.sterne;
  if (!Array.isArray(st) || st.length !== 3 || !st.every(istZahl)) f.push('sterne: genau drei Zahlen');
  else if (st[0] !== 0) f.push('sterne[0] muss 0 sein (geschafft genügt)');
  else if (!(st[1] > 0 && st[2] > st[1])) f.push('sterne: 0 < sterne[1] < sterne[2]');

  if (f.length > 0) throw new LevelFehler(id, f);

  const level: Level = {
    fassung: LEVEL_FASSUNG,
    id,
    welt: welt as number,
    nr: nr as number,
    titel: roh.titel as string,
    breite: roh.breite as number,
    boden: roh.boden as number,
    schleuder: { x: (schl as { x: number }).x, y: (schl as { y: number }).y },
    bros: [...(roh.bros as Bro[])],
    sterne: [...(st as number[])] as [number, number, number],
    teile: (roh.teile as Teil[]).map((t) => ({ ...t })),
    giraffen: (roh.giraffen as Giraffe[]).map((g) => ({ ...g })),
    deko: (deko as Deko[]).map((d) => ({ ...d })),
  };

  // Ab hier sind die Typen sicher — jetzt die Regeln, die Zahlen verbinden.
  const g: string[] = [];
  const h = hoechstpunkte(level);
  // Ohne Hilfsmittel muss der dritte Stern erreichbar sein, …
  if (level.sterne[2] > h) g.push(`sterne[2] = ${level.sterne[2]} liegt über den Höchstpunkten ${h}`);
  // … und der zweite schon, wenn man erst mit dem vorletzten Bro fertig wird.
  const zweiterMax = h - Math.max(0, level.bros.length - 2) * SPIELABLAUF.bonusJeUebrigemBro;
  if (level.sterne[1] > zweiterMax) g.push(`sterne[1] = ${level.sterne[1]} ist mit dem vorletzten Bro nicht erreichbar (höchstens ${zweiterMax})`);

  const vorn = Math.min(...[...level.teile.map(umrissTeil), ...level.giraffen.map(umrissGiraffe)].map((u) => u.links));
  if (level.schleuder.x < 0 || level.schleuder.x >= vorn) g.push('schleuder muss links vor dem Bauwerk stehen');
  if (level.schleuder.y <= level.boden) g.push('schleuder muss über dem Boden stehen');

  g.push(...pruefeGeometrie(level));
  if (g.length > 0) throw new LevelFehler(id, g);
  return level;
}

function pruefeTeil(t: unknown, i: number): string[] {
  const n = `Teil ${i + 1}`;
  if (!istObjekt(t)) return [`${n}: kein Objekt`];
  const f: string[] = [];
  if (!(STOFFE as readonly unknown[]).includes(t.stoff)) f.push(`${n}: unbekannter Stoff „${String(t.stoff)}"`);
  if (!istZahl(t.x) || !istZahl(t.y)) f.push(`${n}: x und y fehlen`);
  if (t.winkel !== undefined && !istZahl(t.winkel)) f.push(`${n}: winkel ist eine Zahl in Grad`);
  const w = normWinkel(istZahl(t.winkel) ? t.winkel : 0);
  switch (t.form) {
    case 'quader':
    case 'dreieck':
      if (!istZahl(t.b) || !istZahl(t.h) || t.b <= 0 || t.h <= 0) f.push(`${n}: b und h müssen positiv sein`);
      // Schräg gestellte Teile kann die geometrische Prüfung nicht beurteilen;
      // bis die Ruheprobe mit Physik läuft, gibt es sie nicht.
      if (t.form === 'quader' && w % 90 !== 0) f.push(`${n}: Quader nur in 90°-Schritten`);
      if (t.form === 'dreieck' && w !== 0) f.push(`${n}: Dreieck nur mit der Spitze nach oben (winkel 0)`);
      break;
    case 'kreis':
      if (!istZahl(t.r) || t.r <= 0) f.push(`${n}: r muss positiv sein`);
      break;
    default:
      f.push(`${n}: unbekannte Form „${String(t.form)}"`);
  }
  return f;
}
