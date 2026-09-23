/**
 * Störschläge im Fun-Modus von Golf (Teil 3/3, Robins Entscheidung vom
 * 22.09.2026: „Störschläge gegen Gegner").
 *
 * Drei Power-up-Arten, die gegen ANDERE wirken. Sie liegen wie die aus
 * Teil 2 als Felder auf der Bahn (`POWERUPS` in powerup.ts, hinten
 * angehängt), werden wie sie eingesammelt und gehalten — aber nicht mit dem
 * nächsten Schlag verbraucht, sondern STATT eines Schlags ausgelöst
 * (`EINSATZ` `'ausloesen'`):
 *
 *   - **Bombe** — an der Zielstelle abgelegt, stößt sie im nächsten Takt
 *     alle Bälle im Umkreis `BOMBE_R` weg, innen stärker als am Rand.
 *   - **Klebefeld** — ein Sandfleck (Reibung × `KLEBE_FAKTOR`) mit Radius
 *     `KLEBE_R` an der Zielstelle, `KLEBE_TAKTE` lang (8 s).
 *   - **Tausch** — der eigene Ball und der des Führenden tauschen die Plätze.
 *
 * **Auslösen ist ein Zug.** Es steht in der Zugliste wie ein Schlag
 * (`Zug.art === 'ausloesen'` im Modul, Ereignis `'ausloesen'` im Kern), mit
 * Takt, Laufnummer, Richtung und Kraft: Gezielt wird wie beim Schlag, die
 * Zielstelle liegt `kraft · STOER_REICHWEITE` vor dem Ball. So rechnet jedes
 * Gerät dieselbe Störung zum selben Takt, das Rückspulen nimmt sie mit, und
 * das Replay rechnet sie nach — nichts davon braucht einen Server, der die
 * Bälle kennt.
 *
 * **Die Fairness-Grenzen** (Karte, mit Begründung):
 *
 *   1. *Kein Störschlag auf einen Ball, der schon eingelocht hat* — und auch
 *      nicht auf einen, der sonst fertig ist (Schlaglimit, Zeitlimit,
 *      Ausstieg). Sein Ergebnis steht; ihn zu verschieben hieße, ein fertiges
 *      Loch wieder aufzumachen. Ebenso wenig auf einen Geist (noch nicht
 *      geschlagen in diesem Loch oder frisch zurückgesetzt): Am Abschlag
 *      liegen alle Geister auf EINEM Punkt, und eine Bombe dort träfe jeden,
 *      der noch gar nicht gespielt hat. `stoerbar` sagt, wer getroffen werden
 *      darf.
 *   2. *Höchstens ein Störschlag je Spieler und Loch* (`Lochstand.stoerGenutzt`,
 *      eine Bitmaske). Jede Art liegt je Loch höchstens einmal auf der Bahn;
 *      ohne die Grenze könnte trotzdem EINER alle drei nacheinander
 *      einsammeln und abfeuern, und das Loch wäre ein Beschuss statt Golf.
 *      Wer seinen schon hatte, rollt über ein weiteres Feld hinweg, ohne es
 *      aufzunehmen — es bleibt für die anderen liegen.
 *   3. *Der Führende bekommt keine* (Gummiband, `Lochstand.fuehrend`): Wer
 *      vorn liegt, kann kein Störfeld aufnehmen und keines auslösen. Sonst
 *      gewinnt der Führende immer weiter — er hätte dieselben Waffen wie die
 *      Verfolger, aber als Einziger kein Ziel vor sich, das ihm gefährlich
 *      wird. Die Störschläge sind das Werkzeug der Zurückliegenden.
 *
 * **Wer führt**, steht für das ganze Loch fest: die Sitze mit den wenigsten
 * Schlägen über die ABGESCHLOSSENEN Löcher, festgestellt in `starteLoch`. Mit
 * dem laufenden Loch mitzuzählen hieße, dass die Führung mit jedem Schlag
 * wechselt — ein gerade eingesammeltes Feld wäre einen Schlag später nicht
 * mehr auslösbar, ohne dass der Spieler etwas getan hätte. Gleichstand vorn
 * heißt: alle Gleichen führen. Im ersten Loch führen deshalb alle, und
 * niemand stört — es gibt noch keinen Rückstand, den ein Gummiband aufholen
 * müsste.
 *
 * **Schild** (Teil 2) wehrt jeden Störschlag einmal ab: den Stoß der Bombe,
 * den Klebefleck (der Träger rollt für dessen ganze Dauer darüber hinweg) und
 * den Tausch. Gefragt wird `verbraucheSchild`. Der Störschlag ist trotzdem
 * verbraucht — abgewehrt heißt nicht zurückgegeben.
 *
 * **Determinismus** wie überall in Golf (docs/GOLF-PLAN.md): nur `+ - * /` und
 * `Math.sqrt`, kein Zufall. Bots entscheiden hier ohne Zufallsstrom.
 */

import type { Karte } from './karte';
import type { Ball, Botstufe, Effektereignis, Partiezustand } from './physik';
import { KRAFT_MIN, meldeEffekt, schlagErlaubt } from './physik';
import { type Powerupart, EINSATZ, verbraucheSchild } from './powerup';
import { betrag, normiere } from './zufall';

/** Die drei Störschläge — dieselben Namen, die in `POWERUPS` hinten stehen. */
export type Stoerart = 'bombe' | 'klebefeld' | 'tausch';

export const STOERARTEN: readonly Stoerart[] = ['bombe', 'klebefeld', 'tausch'];

/** Hält dieser Ball einen Störschlag? */
export function istStoerart(art: Powerupart | null): art is Stoerart {
  return art !== null && EINSATZ[art] === 'ausloesen';
}

/* --------------------------------------------------------------------------
 * Zahlen
 * ----------------------------------------------------------------------- */

/**
 * So weit vor dem Ball liegt die Zielstelle bei voller Kraft, in E. Mit dem
 * Zielen wie beim Schlag (höchstens `MAX_ZUG` Zug) reicht das über eine
 * halbe Bahn; weiter weg liegt ohnehin selten ein Gegner, den man sieht.
 */
export const STOER_REICHWEITE = 16;

/** Bombe: Umkreis in E. Gut vier Bälle breit — ein gezielter Wurf, kein Flächenbrand. */
export const BOMBE_R = 3;

/**
 * Bombe: Stoß in E/s genau in der Mitte; zum Rand fällt er auf 40 %. Mit
 * 14 E/s rollt ein Ball auf Rasen rund 10 E weit — weit genug, dass es wehtut,
 * nicht so weit, dass jeder Ball an der Rückwand landet.
 */
export const BOMBE_V = 14;
const BOMBE_RAND_ANTEIL = 0.4;

/** Klebefeld: Radius in E. */
export const KLEBE_R = 1.6;

/** Klebefeld: Reibung × 4 — so zäh wie Sand (`SAND_FAKTOR` in physik.ts). */
export const KLEBE_FAKTOR = 4;

/** Klebefeld: 8 Sekunden, in Takten zu 50 ms — Wanduhr, auch in der Zeitlupe. */
export const KLEBE_TAKTE = 160;

/* --------------------------------------------------------------------------
 * Zustand im Loch
 *
 * Beide Objekte sind UNVERÄNDERLICH: `kopiere` nimmt `aktuell` nur flach mit,
 * zwei Schnappschüsse teilen sich also dasselbe Objekt. Wer etwas ändert,
 * legt ein neues hin (`befreit` im Klebefeld).
 * ----------------------------------------------------------------------- */

/** Eine abgelegte Bombe, die im Takt `takt` zündet. */
export interface Bombe {
  readonly sitz: number;
  readonly x: number;
  readonly y: number;
  readonly takt: number;
}

/** Ein Klebefleck, der bis vor den Takt `bis` klebt. */
export interface Klebefeld {
  readonly sitz: number;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly bis: number;
  /** Sitze (Bitmaske), deren Schild den Fleck abgewehrt hat — sie rollen darüber hinweg. */
  readonly befreit: number;
}

/* --------------------------------------------------------------------------
 * Die Grenzen
 * ----------------------------------------------------------------------- */

/**
 * Die Führenden als Bitmaske: wer über die abgeschlossenen Löcher die
 * wenigsten Schläge hat, unter den Sitzen, die in diesem Loch dabei sind.
 * Gerufen von `starteLoch`, nachdem die Bälle stehen (siehe Dateikopf).
 */
export function fuehrendeSitze(z: Partiezustand): number {
  let min = -1;
  let maske = 0;
  for (let s = 0; s < z.sitze && s < z.baelle.length; s += 1) {
    if (!z.baelle[s].dabei) continue;
    let summe = 0;
    for (let i = 0; i < z.aktuell.loch && i < z.ergebnis.length; i += 1) {
      summe += z.ergebnis[i]?.[s] ?? 0;
    }
    if (min === -1 || summe < min) {
      min = summe;
      maske = 1 << s;
    } else if (summe === min) {
      maske |= 1 << s;
    }
  }
  return maske;
}

/** Führt dieser Sitz im laufenden Loch? */
export function fuehrt(z: Partiezustand, sitz: number): boolean {
  return ((z.aktuell.fuehrend ?? 0) & (1 << sitz)) !== 0;
}

/** Hat dieser Sitz seinen Störschlag in diesem Loch schon gehabt? */
export function stoerGenutzt(z: Partiezustand, sitz: number): boolean {
  return ((z.aktuell.stoerGenutzt ?? 0) & (1 << sitz)) !== 0;
}

/**
 * Darf dieser Sitz ein Störfeld aufnehmen? Nicht, wer führt, und nicht, wer
 * seinen schon hatte (Grenzen 2 und 3) — das Feld bleibt dann liegen.
 */
export function darfStoerAufnehmen(z: Partiezustand, sitz: number): boolean {
  return !fuehrt(z, sitz) && !stoerGenutzt(z, sitz);
}

/**
 * Darf ein Störschlag diesen Ball treffen? Nicht, wenn er fertig ist
 * (eingelocht, Limit, ausgestiegen), nicht als Geist, nicht im Flug.
 */
export function stoerbar(b: Ball): boolean {
  return b.dabei && !b.eingelocht && b.fertigTakt === -1 && b.geschlagen && b.flugTakte === 0;
}

/**
 * Wen ein Tausch trifft: den Führenden, dessen Ball `stoerbar` ist und
 * LIEGT — bei mehreren Führenden den mit der kleinsten Sitznummer, damit
 * jedes Gerät denselben nimmt. `-1`, wenn es keinen gibt.
 *
 * Nur ein liegender Ball: Ein rollender trägt Tempo, Flug, Wirkung (ein
 * Geisterball kann gerade in einer Wand stecken) und Strudeltakte. Ihn
 * mitten im Lauf anzuhalten und an einen fremden Platz zu legen, wäre eine
 * Fallunterscheidung je Zustand; zwei Ruhelagen zu tauschen ist dagegen
 * immer sauber — beide Plätze waren gerade eben frei für einen Ball.
 */
export function tauschZiel(z: Partiezustand, sitz: number): number {
  const maske = z.aktuell.fuehrend ?? 0;
  for (let s = 0; s < z.baelle.length; s += 1) {
    if (s === sitz || (maske & (1 << s)) === 0) continue;
    const b = z.baelle[s];
    if (stoerbar(b) && b.ruht) return s;
  }
  return -1;
}

/**
 * Warum dieser Sitz JETZT nicht auslösen darf — oder `null`, wenn er darf.
 * Für den Knopf im HUD; `ausloesenErlaubt` ist dieselbe Frage als Ja/Nein.
 */
export type Sperrgrund = 'keiner' | 'fuehrt' | 'genutzt' | 'keinZiel' | 'nichtJetzt';

export function sperrgrund(z: Partiezustand, sitz: number): Sperrgrund | null {
  if (z.modus !== 'fun' || sitz < 0 || sitz >= z.baelle.length) return 'keiner';
  const b = z.baelle[sitz];
  if (!istStoerart(b.halt)) return 'keiner';
  if (fuehrt(z, sitz)) return 'fuehrt';
  if (stoerGenutzt(z, sitz)) return 'genutzt';
  if (!schlagErlaubt(z, sitz)) return 'nichtJetzt';
  if (b.halt === 'tausch' && tauschZiel(z, sitz) < 0) return 'keinZiel';
  return null;
}

/**
 * Darf dieser Sitz JETZT auslösen? Wie `schlagErlaubt` auf allen Geräten
 * gleich beantwortet — ein abgelehntes Auslösen wird überall abgelehnt, und
 * der Störschlag bleibt dann im Halt.
 */
export function ausloesenErlaubt(z: Partiezustand, sitz: number): boolean {
  return sperrgrund(z, sitz) === null;
}

/* --------------------------------------------------------------------------
 * Auslösen — gerufen aus `schritt` für jedes Ereignis `'ausloesen'`
 * ----------------------------------------------------------------------- */

/** Die Zielstelle: `kraft · STOER_REICHWEITE` vor dem Ball, im Rahmen der Bahn. */
export function zielstelle(
  b: Pick<Ball, 'x' | 'y'>,
  karte: Pick<Karte, 'breite' | 'hoehe'>,
  rx: number,
  ry: number,
  kraft: number,
): { x: number; y: number } {
  let k = kraft;
  if (k < KRAFT_MIN) k = KRAFT_MIN;
  else if (k > 1) k = 1;
  const r = normiere(rx, ry);
  let x = b.x + r.x * k * STOER_REICHWEITE;
  let y = b.y + r.y * k * STOER_REICHWEITE;
  if (x < 0) x = 0;
  else if (x > karte.breite) x = karte.breite;
  if (y < 0) y = 0;
  else if (y > karte.hoehe) y = karte.hoehe;
  return { x, y };
}

function melde(z: Partiezustand, e: Effektereignis): void {
  meldeEffekt(z, e);
}

/**
 * Löst den gehaltenen Störschlag dieses Sitzes aus. Ist es nicht erlaubt
 * (`ausloesenErlaubt`), passiert nichts, und er bleibt im Halt.
 */
export function wendeAusloesenAn(
  z: Partiezustand,
  sitz: number,
  rx: number,
  ry: number,
  kraft: number,
  karte: Karte,
): void {
  if (!ausloesenErlaubt(z, sitz)) return;
  const b = z.baelle[sitz];
  const art = b.halt as Stoerart;
  b.halt = null;
  z.aktuell.stoerGenutzt = (z.aktuell.stoerGenutzt ?? 0) | (1 << sitz);
  // Der Bot denkt danach von vorn, wie nach einem Schlag.
  z.botWartet[sitz] = -1;

  if (art === 'tausch') {
    tausche(z, sitz, tauschZiel(z, sitz));
    return;
  }
  const ort = zielstelle(b, karte, rx, ry, kraft);
  melde(z, { art: 'stoerschlag', sitz, stoer: art, x: ort.x, y: ort.y });
  if (art === 'bombe') {
    // Sie zündet im NÄCHSTEN Takt (Karte) — sichtbar für einen Augenblick.
    z.aktuell.bombe = Object.freeze({ sitz, x: ort.x, y: ort.y, takt: z.takt + 1 });
  } else {
    z.aktuell.klebe = Object.freeze({
      sitz,
      x: ort.x,
      y: ort.y,
      r: KLEBE_R,
      bis: z.takt + KLEBE_TAKTE,
      befreit: 0,
    });
  }
}

/** Der Tausch: zwei Ruhelagen wechseln den Besitzer. */
function tausche(z: Partiezustand, sitz: number, ziel: number): void {
  const a = z.baelle[sitz];
  if (ziel < 0) return;
  const b = z.baelle[ziel];
  if (verbraucheSchild(b)) {
    melde(z, { art: 'schild', sitz: ziel, x: b.x, y: b.y });
    return;
  }
  melde(z, { art: 'tausch', sitz, anderer: ziel, x: a.x, y: a.y, zielX: b.x, zielY: b.y });
  const ax = a.x;
  const ay = a.y;
  a.x = b.x;
  a.y = b.y;
  b.x = ax;
  b.y = ay;
  // Die neue Lage ist die Stelle, an die das Wasser zurückwirft — nicht der
  // alte Platz, auf dem jetzt der andere liegt.
  for (const ball of [a, b]) {
    ball.vx = 0;
    ball.vy = 0;
    ball.ruht = true;
    ball.letzteRuheX = ball.x;
    ball.letzteRuheY = ball.y;
    ball.strudelTakte = 0;
  }
}

/**
 * Zündet eine fällige Bombe — gerufen am Anfang jedes Takts, VOR den
 * Ereignissen: Ein Schlag im selben Takt kommt zu spät, der Ball rollt dann
 * schon (und wer rollt, schlägt nicht).
 */
export function zuendeBombe(z: Partiezustand): void {
  const bombe = z.aktuell.bombe;
  if (bombe == null || z.takt < bombe.takt) return;
  z.aktuell.bombe = null;
  melde(z, { art: 'bombe', sitz: bombe.sitz, x: bombe.x, y: bombe.y });
  const grenze = BOMBE_R * BOMBE_R;
  for (let s = 0; s < z.baelle.length; s += 1) {
    const b = z.baelle[s];
    if (!stoerbar(b)) continue;
    const dx = b.x - bombe.x;
    const dy = b.y - bombe.y;
    const dq = dx * dx + dy * dy;
    if (dq >= grenze) continue;
    if (verbraucheSchild(b)) {
      melde(z, { art: 'schild', sitz: s, x: b.x, y: b.y });
      continue;
    }
    const d = Math.sqrt(dq);
    // Genau auf der Bombe: nach oben weg — irgendeine, aber auf jedem Gerät dieselbe.
    const nx = d < 1e-9 ? 0 : dx / d;
    const ny = d < 1e-9 ? -1 : dy / d;
    const v = BOMBE_V * (1 - (1 - BOMBE_RAND_ANTEIL) * (d / BOMBE_R));
    // Ein liegender Ball geht nach dem Wasser dorthin zurück, wo die Bombe
    // ihn fand — nicht an die Stelle vor seinem letzten Schlag.
    if (b.ruht) {
      b.letzteRuheX = b.x;
      b.letzteRuheY = b.y;
    }
    b.vx += nx * v;
    b.vy += ny * v;
    b.ruht = false;
  }
}

/**
 * Reibungsfaktor im Klebefleck für diesen Ball in diesem Unterschritt —
 * oder `reib` unverändert, wenn der Fleck ihn nicht betrifft. Gerufen aus
 * `bewege`, nur wenn ein Fleck liegt.
 */
export function klebeReibung(
  z: Partiezustand,
  sitz: number,
  b: Ball,
  reib: number,
  pReibung: number,
): number {
  const klebe = z.aktuell.klebe;
  if (klebe == null || z.takt >= klebe.bis || b.ruht) return reib;
  if ((klebe.befreit & (1 << sitz)) !== 0) return reib;
  const dx = b.x - klebe.x;
  const dy = b.y - klebe.y;
  if (dx * dx + dy * dy >= klebe.r * klebe.r) return reib;
  if (verbraucheSchild(b)) {
    z.aktuell.klebe = Object.freeze({ ...klebe, befreit: klebe.befreit | (1 << sitz) });
    melde(z, { art: 'schild', sitz, x: b.x, y: b.y });
    return reib;
  }
  const kleb = KLEBE_FAKTOR * pReibung;
  return kleb > reib ? kleb : reib;
}

/** Räumt einen abgelaufenen Klebefleck weg — am Ende des Takts. */
export function raeumeStoerungen(z: Partiezustand): void {
  const klebe = z.aktuell.klebe;
  if (klebe != null && z.takt + 1 >= klebe.bis) z.aktuell.klebe = null;
}

/* --------------------------------------------------------------------------
 * Bots
 * ----------------------------------------------------------------------- */

/** Ein Tausch lohnt erst, wenn der Führende so viel näher am Loch liegt, in E. */
const TAUSCH_VORSPRUNG = 2;
/** So weit hält der Bot den eigenen Ball aus Bombe und Klebefleck heraus, in E. */
const EIGEN_ABSTAND = 0.5;

/**
 * Der Störschlag eines Bots — oder `null`, dann schlägt er wie sonst.
 *
 * Bots lösen gegen den Führenden aus, wenn sie zurückliegen (Karte); dass sie
 * zurückliegen, prüft schon `ausloesenErlaubt` (wer führt, darf nicht). Ziel
 * ist der Führende, dessen Ball `stoerbar` ist und kein Schild trägt — auf
 * ein Schild zu feuern, hieße, den Störschlag für nichts herzugeben.
 *
 *   - Tausch, wenn der Führende mindestens `TAUSCH_VORSPRUNG` näher am Loch liegt.
 *   - Bombe auf seinen Ball, wenn er in Reichweite ist und der eigene nicht
 *     mit im Umkreis liegt.
 *   - Klebefleck auf seinen LIEGENDEN Ball: Der nächste Schlag von dort
 *     rollt durch Sand. Auch hier bleibt der eigene Ball draußen.
 *
 * Ohne Zufall und ohne Probe: ein paar Abstände, keine Physik — die Kosten
 * je Entscheidung stehen im Pull Request (golf-stoerprobe.ts).
 */
export function botStoerschlag(
  z: Partiezustand,
  sitz: number,
  karte: Karte,
): { rx: number; ry: number; kraft: number } | null {
  if (!ausloesenErlaubt(z, sitz)) return null;
  const b = z.baelle[sitz];
  const art = b.halt as Stoerart;
  const lochX = karte.loch[0];
  const lochY = karte.loch[1];
  if (art === 'tausch') {
    const ziel = tauschZiel(z, sitz);
    if (ziel < 0) return null;
    const t = z.baelle[ziel];
    if (t.halt === 'schild') return null;
    const eigen = betrag(lochX - b.x, lochY - b.y);
    const fremd = betrag(lochX - t.x, lochY - t.y);
    if (eigen - fremd < TAUSCH_VORSPRUNG) return null;
    // Richtung und Kraft sind beim Tausch ohne Bedeutung, aber ein Zug braucht sie.
    return { rx: 0, ry: -1, kraft: 1 };
  }
  const radius = art === 'bombe' ? BOMBE_R : KLEBE_R;
  const maske = z.aktuell.fuehrend ?? 0;
  for (let s = 0; s < z.baelle.length; s += 1) {
    if (s === sitz || (maske & (1 << s)) === 0) continue;
    const t = z.baelle[s];
    if (!stoerbar(t) || t.halt === 'schild') continue;
    if (art === 'klebefeld' && !t.ruht) continue;
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    const d = betrag(dx, dy);
    if (d > STOER_REICHWEITE || d < radius + EIGEN_ABSTAND) continue;
    const r = normiere(dx, dy);
    let kraft = d / STOER_REICHWEITE;
    if (kraft < KRAFT_MIN) kraft = KRAFT_MIN;
    else if (kraft > 1) kraft = 1;
    return { rx: r.x, ry: r.y, kraft };
  }
  return null;
}

/** Nur für die Probe: welche Bot-Stufen Störschläge auslösen (alle). */
export const STOER_STUFEN: readonly Botstufe[] = ['anfaenger', 'standard', 'experte', 'genie'];
