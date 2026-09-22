/**
 * Der Hilfskoch — ein Bot, der einen freien Sitz besetzt.
 *
 * Er ist ausdrücklich kein Meister: Er arbeitet die nächstliegende sinnvolle
 * Aufgabe ab, läuft stur in Achsen und drängelt niemanden weg. Das reicht,
 * damit man allein oder zu zweit an einem Vier-Sitze-Tisch nicht verhungert.
 *
 * **Er muss auf jedem Gerät dasselbe tun.** Deshalb entscheidet er
 * ausschließlich aus dem Küchenzustand (der überall gleich ist), zieht keinen
 * Zufall und bevorzugt bei Gleichstand immer den kleineren Listenindex. Eine
 * Entscheidung „nach Bauchgefühl" wäre hier zwei Partien in einer.
 *
 * Aufgerufen wird er von `schritt` in `kueche.ts` — hineingereicht, nicht
 * importiert: Sonst kennen sich Küche und Bot gegenseitig, und das erste
 * Werkzeug, das darüber stolpert, ist der Bündler.
 */

import {
  davor,
  findeTicket,
  type Koch,
  type KochEingabe,
  type Kueche,
  type Station,
} from './kueche';
import { rezept, sollZustand, type TellerStueck, type Zutat } from './rezepte';

/** So viele Takte wartet der Bot nach einem Griff, bevor er wieder greift. */
const GRIFF_PAUSE = 6;

interface Absicht {
  readonly station: Station;
  readonly tun: 'greifen' | 'werken';
}

export function botEingabe(k: Kueche, sitz: number): KochEingabe[] {
  const koch = k.koeche[sitz];
  if (!koch || !koch.aktiv) return [];
  const absicht = waehleAbsicht(k, koch);
  if (absicht === null) {
    return steheStill(koch, sitz);
  }
  const eingaben: KochEingabe[] = [];
  if (davor(k, koch) === absicht.station) {
    // Angekommen und im Blick: arbeiten. Die Laufrichtung darf stehen
    // bleiben — sie drückt den Koch nur gegen die Theke, und genau daran
    // hält er seine Blickrichtung.
    if (absicht.tun === 'werken') {
      if (!koch.werkt) eingaben.push({ sitz, art: 'werken', an: true });
    } else {
      if (koch.werkt) eingaben.push({ sitz, art: 'werken', an: false });
      if (k.takt - koch.letzterGriff >= GRIFF_PAUSE) eingaben.push({ sitz, art: 'greifen' });
    }
    return eingaben;
  }

  if (koch.werkt) eingaben.push({ sitz, art: 'werken', an: false });
  const richtung = naechsterSchritt(k, koch, absicht.station);
  if (richtung.dx !== koch.dx || richtung.dy !== koch.dy) {
    eingaben.push({ sitz, art: 'richtung', dx: richtung.dx, dy: richtung.dy });
  }
  return eingaben;
}

function steheStill(koch: Koch, sitz: number): KochEingabe[] {
  const eingaben: KochEingabe[] = [];
  if (koch.werkt) eingaben.push({ sitz, art: 'werken', an: false });
  if (koch.dx !== 0 || koch.dy !== 0) eingaben.push({ sitz, art: 'richtung', dx: 0, dy: 0 });
  return eingaben;
}

// ---------------------------------------------------------------------------
// Was ist zu tun?
// ---------------------------------------------------------------------------

function waehleAbsicht(k: Kueche, koch: Koch): Absicht | null {
  // 1. Feuer schlägt alles. Wer jetzt kocht, kocht gleich gar nicht mehr.
  const brennt = naechste(k, koch, (s) => s.brennt > 0);
  if (brennt) return { station: brennt, tun: 'werken' };

  const ding = koch.traegt;

  if (ding !== null && ding.art === 'teller') {
    // 2. Fertiger Teller: raus damit.
    if (ding.inhalt.length > 0 && findeTicket(k, ding.inhalt) !== null) {
      const luke = naechste(k, koch, (s) => s.art === 'durchreiche');
      if (luke) return { station: luke, tun: 'greifen' };
    }
    if (!ding.sauber) {
      const spuele = naechste(k, koch, (s) => s.art === 'spuele');
      if (spuele) return { station: spuele, tun: 'greifen' };
    }
    /*
     * 3. Ein Teller, aus dem nichts mehr werden kann, gehört in die Tonne.
     *    Ohne diese Zeile legt der Hilfskoch ihn ab, nimmt ihn wieder auf,
     *    legt ihn ab … — in der ersten Fassung bis zum Abpfiff, im Protokoll
     *    alle sechs Takte einmal.
     */
    if (ding.inhalt.length > 0 && zielTicket(k, ding.inhalt) === null) {
      const tonne = naechste(k, koch, (s) => s.art === 'tonne');
      if (tonne) return { station: tonne, tun: 'greifen' };
    }
    // 4. Etwas Fertiges einsammeln, das auf DIESEN Teller gehört.
    const fehlt = fehlendeStuecke(k, ding.inhalt);
    const quelle = naechste(k, koch, (s) => bietetAn(s, fehlt));
    if (quelle) return { station: quelle, tun: 'greifen' };
    /*
      * Nichts zu holen: Teller abstellen. Auch einen halb vollen — mit
      * besetzten Händen kann er weder schneiden noch die fehlende Zutat
      * holen, und genau so stand der Hilfskoch in der ersten Fassung bis zum
      * Abpfiff da (Probe „kocht allein etwas zusammen").
      */
    const ablage = naechste(k, koch, (s) => s.art === 'ablage' && s.inhalt === null);
    if (ablage) return { station: ablage, tun: 'greifen' };
    return null;
  }

  if (ding !== null && ding.art === 'zutat') {
    // 4. Verkohltes in die Tonne.
    if (ding.zustand === 'verkohlt') {
      const tonne = naechste(k, koch, (s) => s.art === 'tonne');
      if (tonne) return { station: tonne, tun: 'greifen' };
      return null;
    }
    // 5. Rohes auf ein freies Brett.
    if (ding.zustand === 'roh') {
      const brett = naechste(k, koch, (s) => s.art === 'brett' && s.inhalt === null);
      if (brett) return { station: brett, tun: 'greifen' };
      return null;
    }
    // 6. Geschnittenes: in die richtige Garstation, sonst auf eine Ablage.
    const garart = garstationFuer(k, ding.zutat);
    if (garart !== null) {
      const topf = naechste(k, koch, (s) => s.art === garart && s.inhalt === null);
      if (topf) return { station: topf, tun: 'greifen' };
    }
    const teller = naechste(
      k,
      koch,
      (s) => s.inhalt !== null && s.inhalt.art === 'teller' && s.inhalt.sauber,
    );
    if (teller) return { station: teller, tun: 'greifen' };
    const ablage = naechste(k, koch, (s) => s.art === 'ablage' && s.inhalt === null);
    if (ablage) return { station: ablage, tun: 'greifen' };
    return null;
  }

  // 7. Leere Hände.
  const schneiden = naechste(
    k,
    koch,
    (s) => s.art === 'brett' && s.inhalt !== null && s.inhalt.art === 'zutat' && s.inhalt.zustand === 'roh',
  );
  if (schneiden) return { station: schneiden, tun: 'werken' };

  const stapel = naechste(k, koch, (s) => s.art === 'tellerstapel');
  const keineTeller = stapel === null || stapel.stapel === 0;
  const spuelen = naechste(k, koch, (s) => s.art === 'spuele' && s.stapel > 0);
  if (spuelen && keineTeller) return { station: spuelen, tun: 'werken' };

  /*
   * Einen Teller holt der Hilfskoch nur, wenn für GENAU DIESEN Teller etwas
   * bereitliegt. Die erste Fassung fragte bloß „liegt irgendetwas Fertiges
   * herum?" — dann nahm er den Teller mit dem Salat wieder auf, weil auf dem
   * Brett noch ein zweiter Salat lag, den er gar nicht brauchte, legte ihn
   * ab, nahm ihn auf … alle sechs Takte einmal, bis zum Abpfiff.
   */
  const angefangen = naechste(k, koch, (s) => {
    const i = s.inhalt;
    if (i === null || i.art !== 'teller' || !i.sauber) return false;
    const fehltDem = fehlendeStuecke(k, i.inhalt);
    return fehltDem.length > 0 && k.stationen.some((q) => q !== s && bietetAn(q, fehltDem));
  });
  if (angefangen) return { station: angefangen, tun: 'greifen' };

  const offen = fehlendeStuecke(k, []);
  const etwasFertig = k.stationen.some((s) => bietetAn(s, offen));
  if (etwasFertig && stapel && stapel.stapel > 0) return { station: stapel, tun: 'greifen' };

  /*
   * Geschnittenes, das noch gegart werden muss, in die Hand nehmen — dann
   * trägt es der nächste Takt in den Topf (Regel 6 oben).
   *
   * Ohne diese Regel stand der Hilfskoch in jeder Küche mit Topf still: Der
   * geschnittene Reis lag auf dem Brett, der Topf war leer, und weil Reis
   * damit „im Umlauf" war, holte er auch keinen neuen. Gemessen: null
   * Gerichte in Kantine, Insel und Brandwache, während die Gartenküche (ohne
   * Garstation) lief.
   */
  const zumGaren = naechste(k, koch, (s) => {
    const i = s.inhalt;
    if (i === null || i.art !== 'zutat' || i.zustand !== 'geschnitten') return false;
    const art = garstationFuer(k, i.zutat);
    return art !== null && k.stationen.some((q) => q.art === art && q.inhalt === null);
  });
  if (zumGaren) return { station: zumGaren, tun: 'greifen' };

  // Sonst die nächste fehlende Zutat besorgen.
  const gebraucht = neueZutat(k, offen);
  if (gebraucht !== null) {
    const kiste = naechste(k, koch, (s) => s.art === 'kiste' && s.zutat === gebraucht);
    if (kiste) return { station: kiste, tun: 'greifen' };
  }
  if (spuelen) return { station: spuelen, tun: 'werken' };
  return null;
}

/** Bietet diese Station eines der gesuchten Stücke an? */
function bietetAn(s: Station, gesucht: readonly TellerStueck[]): boolean {
  const inhalt = s.inhalt;
  if (inhalt === null || inhalt.art !== 'zutat') return false;
  if (inhalt.zustand !== 'geschnitten' && inhalt.zustand !== 'gar') return false;
  // Auf dem Brett liegendes Geschnittenes zählt genauso wie Gares im Topf.
  return gesucht.some((g) => g.zutat === inhalt.zutat && g.zustand === inhalt.zustand);
}

/** Die Tickets, älteste zuerst — das älteste ist das knappste. */
function nachAlter(k: Kueche) {
  return [...k.tickets].sort((a, b) => a.seitTakt - b.seitTakt || a.id - b.id);
}

function stueckeVon(rezeptId: string): TellerStueck[] {
  const r = rezept(rezeptId);
  return r.braucht.map((zutat) => ({ zutat, zustand: sollZustand(r, zutat) }));
}

/**
 * Das Ticket, auf das dieser Teller hinausläuft: das älteste, dessen Rezept
 * alles enthält, was schon darauf liegt. `null` heißt, der Teller passt zu
 * keiner Bestellung mehr.
 *
 * DAS IST DER GRUND, WARUM ES DIESE FUNKTION GIBT: Ohne sie sammelt der
 * Hilfskoch die fehlenden Stücke ALLER Tickets ein und legt zwei Salate auf
 * einen Teller, der einen Salat und eine Tomate haben will.
 */
function zielTicket(k: Kueche, inhalt: readonly TellerStueck[]): string | null {
  for (const t of nachAlter(k)) {
    const rest = stueckeVon(t.rezept);
    let passt = inhalt.length <= rest.length;
    for (const stueck of inhalt) {
      const i = rest.findIndex((x) => x.zutat === stueck.zutat && x.zustand === stueck.zustand);
      if (i < 0) {
        passt = false;
        break;
      }
      rest.splice(i, 1);
    }
    if (passt) return t.rezept;
  }
  return null;
}

/**
 * Was diesem Teller noch fehlt. Ohne Teller in der Hand (`schonDrauf` leer):
 * was das älteste Ticket braucht.
 */
function fehlendeStuecke(k: Kueche, schonDrauf: readonly TellerStueck[]): TellerStueck[] {
  const ziel = zielTicket(k, schonDrauf);
  if (ziel === null) return [];
  const rest = stueckeVon(ziel);
  for (const stueck of schonDrauf) {
    const i = rest.findIndex((x) => x.zutat === stueck.zutat && x.zustand === stueck.zustand);
    if (i >= 0) rest.splice(i, 1);
  }
  return rest;
}

/** Welche Garstation eine Zutat braucht — oder `null`, wenn sie roh geschnitten reicht. */
function garstationFuer(k: Kueche, zutat: Zutat): Station['art'] | null {
  for (const t of [...k.tickets].sort((a, b) => a.seitTakt - b.seitTakt || a.id - b.id)) {
    const r = rezept(t.rezept);
    if (r.garen.includes(zutat) && r.station !== null) return r.station;
  }
  return null;
}

/**
 * Die erste Zutat, die noch nirgends in Arbeit ist.
 *
 * GEZÄHLT WIRD ALLES, was schon im Umlauf ist: in Kisten unterwegs, auf
 * Brettern, in Töpfen, in Händen — UND auf Tellern. Die erste Fassung sah in
 * Teller nicht hinein, holte deshalb Salat, legte ihn auf den Teller, hielt
 * Salat danach wieder für fehlend und holte den nächsten. Tomate und Zwiebel
 * kamen nie an die Reihe, und fertig wurde in zwanzig Minuten nichts.
 */
function neueZutat(k: Kueche, fehlt: readonly TellerStueck[]): Zutat | null {
  const umlauf = imUmlauf(k);
  for (const stueck of fehlt) {
    const da = umlauf.get(stueck.zutat) ?? 0;
    if (da > 0) {
      umlauf.set(stueck.zutat, da - 1);
      continue;
    }
    return stueck.zutat;
  }
  return null;
}

function imUmlauf(k: Kueche): Map<Zutat, number> {
  const zaehler = new Map<Zutat, number>();
  const zaehle = (z: Zutat) => zaehler.set(z, (zaehler.get(z) ?? 0) + 1);
  const nimmAuf = (ding: { art: 'zutat'; zutat: Zutat } | { art: 'teller'; inhalt: readonly TellerStueck[] } | null) => {
    if (ding === null) return;
    if (ding.art === 'zutat') zaehle(ding.zutat);
    else for (const stueck of ding.inhalt) zaehle(stueck.zutat);
  };
  for (const s of k.stationen) nimmAuf(s.inhalt);
  for (const c of k.koeche) nimmAuf(c.traegt);
  return zaehler;
}

// ---------------------------------------------------------------------------
// Laufen
// ---------------------------------------------------------------------------

function entfernung(koch: Koch, s: Station): number {
  const dx = s.x + 0.5 - koch.x;
  const dy = s.y + 0.5 - koch.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function naechste(k: Kueche, koch: Koch, passt: (s: Station) => boolean): Station | null {
  let beste: Station | null = null;
  let besteEntfernung = 0;
  for (const s of k.stationen) {
    if (!passt(s)) continue;
    const e = entfernung(koch, s);
    if (beste === null || e < besteEntfernung) {
      beste = s;
      besteEntfernung = e;
    }
  }
  return beste;
}

/** Die vier Nachbarfelder, immer in derselben Reihenfolge — sonst wählen zwei Geräte verschieden. */
const NACHBARN: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

function begehbar(k: Kueche, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= k.breite || y >= k.hoehe) return false;
  return k.fest[y * k.breite + x] === 0;
}

/**
 * Das Feld, von dem aus man die Station bedient — das nächstgelegene freie
 * Nachbarfeld. **Nicht die Station selbst**: In der ersten Fassung lief der
 * Hilfskoch auf die Kiste zu, stieß an die Theke und tanzte davor hin und
 * her, ohne je zu greifen.
 */
export function bedienfeld(k: Kueche, koch: Koch, s: Station): { x: number; y: number } | null {
  let bestes: { x: number; y: number } | null = null;
  let besteEntfernung = 0;
  for (const [nx, ny] of NACHBARN) {
    const x = s.x + nx;
    const y = s.y + ny;
    if (!begehbar(k, x, y)) continue;
    const dx = x + 0.5 - koch.x;
    const dy = y + 0.5 - koch.y;
    const e = dx * dx + dy * dy;
    if (bestes === null || e < besteEntfernung) {
      bestes = { x, y };
      besteEntfernung = e;
    }
  }
  return bestes;
}

/**
 * Ein Schritt: zum Bedienfeld laufen, dort zur Station drehen.
 *
 * Gelaufen wird nach einer ECHTEN Wegsuche über das Kachelraster (Breitensuche
 * vom Ziel aus), nicht gierig in Richtung Ziel. Die erste Fassung tat Letzteres
 * — und der Hilfskoch pendelte in der Inselküche vor der Theke hin und her,
 * weil „nach unten" versperrt war und „nach oben" frei: Null Gerichte in drei
 * von vier Küchen, während die offene Gartenküche lief.
 *
 * Die Suche ist klein genug für jeden Takt (ein Raster hat gut hundert
 * Felder) und deterministisch: feste Nachbarreihenfolge, keine Zufallszüge.
 * Genau das ist die Bedingung dafür, dass zwei Geräte denselben Bot sehen.
 */
function naechsterSchritt(k: Kueche, koch: Koch, s: Station): { dx: number; dy: number } {
  const feld = bedienfeld(k, koch, s);
  if (feld === null) return { dx: 0, dy: 0 };

  const hier = { x: Math.floor(koch.x), y: Math.floor(koch.y) };
  if (hier.x === feld.x && hier.y === feld.y) {
    // Angekommen: zur Station schauen. Die Richtung drückt ihn gegen die
    // Theke, weiter kommt er nicht — aber er sieht sie an, und das zählt.
    return { dx: s.x - feld.x, dy: s.y - feld.y };
  }

  const entfernung = wegkarte(k, feld);
  const hierWeit = entfernung[hier.y * k.breite + hier.x];
  if (hierWeit < 0) return { dx: 0, dy: 0 };
  for (const [nx, ny] of NACHBARN) {
    const x = hier.x + nx;
    const y = hier.y + ny;
    if (!begehbar(k, x, y)) continue;
    if (entfernung[y * k.breite + x] === hierWeit - 1) return mittig(koch, hier, { dx: nx, dy: ny });
  }
  return { dx: 0, dy: 0 };
}

/** Ab dieser Abweichung von der Kachelmitte wird erst gemittelt, dann abgebogen. */
const MITTE_SPIEL = 0.12;

/**
 * Vor dem Abbiegen in die Kachelmitte rücken.
 *
 * Die Wegsuche denkt in Kacheln, der Koch ist aber breiter als ein Punkt
 * (`KOCH_RADIUS`). Steht er am oberen Rand seiner Kachel und will nach
 * rechts, stößt seine Schulter an die Theke der Kachel darüber — er steht
 * fest, obwohl der Weg frei ist. Genau daran hing der Hilfskoch in der
 * Inselküche: bei x = 4,66 gegen die Insel gedrückt, bis zum Abpfiff.
 */
function mittig(koch: Koch, hier: { x: number; y: number }, schritt: { dx: number; dy: number }): { dx: number; dy: number } {
  if (schritt.dx !== 0) {
    const mitte = hier.y + 0.5;
    if (koch.y - mitte > MITTE_SPIEL) return { dx: 0, dy: -1 };
    if (mitte - koch.y > MITTE_SPIEL) return { dx: 0, dy: 1 };
  } else if (schritt.dy !== 0) {
    const mitte = hier.x + 0.5;
    if (koch.x - mitte > MITTE_SPIEL) return { dx: -1, dy: 0 };
    if (mitte - koch.x > MITTE_SPIEL) return { dx: 1, dy: 0 };
  }
  return schritt;
}

/**
 * Entfernung jedes Feldes zum Ziel, in Schritten. -1 heißt unerreichbar.
 *
 * Gerechnet wird VOM ZIEL AUS: Dann steht in jedem Feld, wie weit es noch
 * ist, und der Schritt ist der Nachbar mit einer Stufe weniger. Ein Koch, der
 * mitten in einer Theke steht (kommt nach einem Rücksprung vor), bekommt -1
 * und bleibt stehen, statt in die Wand zu laufen.
 */
function wegkarte(k: Kueche, ziel: { x: number; y: number }): Int16Array {
  const entfernung = new Int16Array(k.breite * k.hoehe).fill(-1);
  const schlange: number[] = [ziel.y * k.breite + ziel.x];
  entfernung[schlange[0]] = 0;
  for (let i = 0; i < schlange.length; i += 1) {
    const feld = schlange[i];
    const fx = feld % k.breite;
    const fy = (feld - fx) / k.breite;
    for (const [nx, ny] of NACHBARN) {
      const x = fx + nx;
      const y = fy + ny;
      if (!begehbar(k, x, y)) continue;
      const nachbar = y * k.breite + x;
      if (entfernung[nachbar] >= 0) continue;
      entfernung[nachbar] = entfernung[feld] + 1;
      schlange.push(nachbar);
    }
  }
  return entfernung;
}
