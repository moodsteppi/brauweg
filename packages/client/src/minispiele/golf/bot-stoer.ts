/**
 * Die Störschläge der Bots (Fun-Modus) — die Bot-Seite von stoerschlag.ts.
 *
 * Seit dem 23.09.2026 (Version 10) in einer eigenen Datei. Anlass war die
 * Messung aus #222 (golf-stoerprobe.ts): Bots lösten etwa in jedem 15. bis
 * 30. Loch einen Störschlag aus, und der Abstand zwischen Erstem und Letztem
 * bewegte sich nur im Rauschen. Die Gründe und was jetzt dagegen steht:
 *
 *   - **Sie sammelten kaum.** Ein Bot nahm nur Felder genau auf seiner Linie
 *     mit. Jetzt holt, wer zurückliegt, ein Störfeld auch mit einem kleinen
 *     Umweg (`umwegZuStoerfeld` in bot.ts).
 *   - **Das Ziel war zu nah.** Die Bombe flog nur genau auf den Ball des
 *     Führenden, und lag der eigene im Umkreis, fiel sie aus. Jetzt sucht der
 *     Bot eine Stelle zwischen dem Führenden und dem Loch — von dort stößt
 *     die Bombe ihn VOM Loch weg — oder das Loch selbst, und nimmt die, die
 *     ihn am weitesten zurückwirft, ohne den eigenen Ball zu treffen
 *     (`besteBombe`).
 *   - **Das Ziel rollte noch.** Dann schlug der Bot einfach und sah den
 *     Störschlag erst beim nächsten Mal wieder an, wenn der Führende oft
 *     schon eingelocht hatte. Jetzt wartet er bis zu `WARTE_TAKTE`, bis der
 *     Führende liegt (`botWartetAufStoer`).
 *   - **Der Tausch wurde falsch gemessen:** Der Abstand zum Loch galt in
 *     Luftlinie, auch über eine Wand hinweg. Jetzt zählt der Weg im Wegfeld
 *     (`wegZumLoch`).
 *   - **Das Klebefeld lag auf dem Ball** — und damit oft über dem Loch, wenn
 *     der Führende davor lag. Dann bremste es acht Sekunden lang jeden Putt,
 *     auch den eigenen. Jetzt liegt es auf der Linie, die der Führende als
 *     Nächstes spielt, das Loch bleibt frei, und die Linien der anderen auch
 *     (`besteKlebe`).
 *
 * **Nur gegen Führende.** Eine erste Fassung ließ Bombe und Klebefeld auch
 * auf andere los, die vorn lagen, sobald der Führende eingelocht hatte. Das
 * löste mehr Störschläge aus, aber der Abstand zwischen Erstem und Letztem lag
 * damit in allen vier Stufen etwas höher (golf-stoerprobe.ts, 500 Saaten, je
 * im Rauschen): Wer einen Zweiten trifft, holt den Ersten nicht ein, er
 * würfelt nur das Mittelfeld durch. Das Gummiband ist der Führende.
 *
 * **Die Fairness-Grenzen gelten unverändert** (stoerschlag.ts): Ob ein Sitz
 * überhaupt auslösen darf, beantwortet `ausloesenErlaubt` bzw. `sperrgrund` —
 * wer führt, wer seinen schon hatte, wessen Ball nicht liegt, löst nicht aus.
 * Getroffen wird nur, wer `stoerbar` ist. Auf ein Schild feuern Bots nicht.
 *
 * **Ohne Zufall und ohne Probe:** ein paar Abstände, ein Blick ins Wegfeld,
 * keine Physik — die Kosten stehen im Pull Request (golf-stoerprobe.ts).
 * Nur `+ - * /` und `Math.sqrt` wie überall in Golf (docs/GOLF-PLAN.md).
 */

import { fuehrerImSpiel, planRadius, sichtFrei, wegVoraus, wegZumLoch, weiteBeiTempo } from './bot';
import { type Karte, abstandQuadrat, segment } from './karte';
import { type Ball, KRAFT_MIN, type Partiezustand, TAKT_MS, physikwerte } from './physik';
import {
  BOMBE_R,
  BOMBE_RAND_ANTEIL,
  BOMBE_V,
  KLEBE_R,
  STOER_REICHWEITE,
  type Stoerart,
  ausloesenErlaubt,
  fuehrt,
  istStoerart,
  sperrgrund,
  stoerbar,
  tauschZiel,
} from './stoerschlag';
import { betrag, normiere } from './zufall';

/* --------------------------------------------------------------------------
 * Zahlen
 * ----------------------------------------------------------------------- */

/** Ein Tausch lohnt erst, wenn der Führende auf dem WEG so viel näher am Loch liegt, in E. */
const TAUSCH_VORSPRUNG = 2;

/** So weit hält der Bot den eigenen Ball aus Bombe und Klebefleck heraus, in E. */
const EIGEN_ABSTAND = 0.5;

/**
 * Wie weit eine Bombe die getroffenen Führenden mindestens vom Loch
 * wegstoßen muss, zusammen, in E. Drei Einheiten sind etwa ein Drittel
 * Schlag — weniger ist ein Wurf ins Blaue.
 */
const BOMBE_SCHWELLE = 3;

/**
 * Liegt der eigene Ball so nah am Loch (in E), ist der nächste Schlag
 * vermutlich der letzte — danach verfällt der Störschlag. Dann reicht der
 * Bombe `BOMBE_LETZTE` und dem Tausch `TAUSCH_LETZTE`.
 */
const LETZTE_CHANCE = 4;
const BOMBE_LETZTE = 1;
const TAUSCH_LETZTE = 0.5;

/**
 * So viele Takte (5 s) wartet ein Bot über seine Denkzeit hinaus, wenn der
 * Führende noch rollt — statt zu schlagen und den Störschlag erst beim
 * nächsten Mal wieder anzusehen.
 */
export const WARTE_TAKTE = 100;

/** Kein Warten mehr, wenn vom Zeitlimit des Lochs weniger übrig ist (15 s). */
const WARTE_RESERVE = 300;

/**
 * Wie weit das Klebefeld vor dem Ball des Führenden liegt, als Anteil von
 * `KLEBE_R`, in dieser Reihenfolge versucht: Mit 0,7 liegt der Ball im Fleck
 * und rollt durch fast den ganzen Durchmesser; näher am Ball, wenn weiter
 * vorn das Loch oder eine fremde Linie läge.
 */
const KLEBE_VOR = [0.7, 0.35, 0];

/** So viel Rand bleibt zwischen Klebefleck und Loch, in E. */
const LOCH_FREI = 0.6;

/** So weit (Rasterschritte) sieht der Bot den Weg eines Balls voraus, um dessen Linie zu finden. */
const LINIE_SCHRITTE = 10;

/** Die Stellen zwischen Führendem und Loch, an denen eine Bombe geprüft wird, in E vor ihm. */
const BOMBE_VORHALT = [0.6, 1.5, 2.4];

/* --------------------------------------------------------------------------
 * Hilfen
 * ----------------------------------------------------------------------- */

/** Ein Führender, auf den der Bot zielt: störbar, liegt, kein Schild. */
function zielbar(z: Partiezustand, s: number): boolean {
  const t = z.baelle[s];
  return fuehrt(z, s) && stoerbar(t) && t.ruht && t.halt !== 'schild';
}

function wegfeldArt(z: Partiezustand, karte: Karte): { kundig: boolean; ballR: number } {
  return { kundig: z.botStufe !== 'anfaenger', ballR: planRadius(physikwerte(z.aktuell.mod, karte)) };
}

/**
 * Wohin ein Ball von (x,y) als Nächstes rollt: aufs Loch, wenn es nah und
 * frei in Sicht liegt (dieselbe Grenze wie in `botEntscheidung`), sonst ein
 * Stück den Weg entlang.
 */
function naechstesZiel(
  karte: Karte,
  art: { kundig: boolean; ballR: number },
  x: number,
  y: number,
): { x: number; y: number } {
  const lochX = karte.loch[0];
  const lochY = karte.loch[1];
  if (betrag(lochX - x, lochY - y) < 12 && sichtFrei(karte, x, y, lochX, lochY, null, art.ballR)) {
    return { x: lochX, y: lochY };
  }
  return wegVoraus(karte, art.kundig, art.ballR, x, y, LINIE_SCHRITTE) ?? { x: lochX, y: lochY };
}

/** Kann der Bot vom Ball `b` aus diese Stelle treffen — in Reichweite und auf der Bahn? */
function erreichbar(karte: Karte, b: Ball, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx > karte.breite || cy > karte.hoehe) return false;
  const d = betrag(cx - b.x, cy - b.y);
  return d <= STOER_REICHWEITE && d >= KRAFT_MIN * STOER_REICHWEITE;
}

/** Der Zug, dessen Zielstelle (`zielstelle` in stoerschlag.ts) auf (cx,cy) liegt. */
function zugAuf(b: Ball, cx: number, cy: number): { rx: number; ry: number; kraft: number } {
  const dx = cx - b.x;
  const dy = cy - b.y;
  const r = normiere(dx, dy);
  let kraft = betrag(dx, dy) / STOER_REICHWEITE;
  if (kraft < KRAFT_MIN) kraft = KRAFT_MIN;
  else if (kraft > 1) kraft = 1;
  return { rx: r.x, ry: r.y, kraft };
}

/* --------------------------------------------------------------------------
 * Bombe
 * ----------------------------------------------------------------------- */

/**
 * Was eine Bombe bei (cx,cy) bringt: um wie viel weiter die getroffenen
 * Führenden danach vom Loch liegen (Luftlinie), zusammen. Wie weit ein Ball
 * rollt, kommt aus der Rasentabelle für das Stoßtempo; Wände bleiben außen
 * vor, wie beim Zielen. Ein Stoß zum Loch hin zählt negativ.
 */
function bombenWert(z: Partiezustand, sitz: number, karte: Karte, cx: number, cy: number): number {
  const lochX = karte.loch[0];
  const lochY = karte.loch[1];
  const grenze = BOMBE_R * BOMBE_R;
  let wert = 0;
  for (let s = 0; s < z.baelle.length; s += 1) {
    if (s === sitz || !zielbar(z, s)) continue;
    const t = z.baelle[s];
    const dx = t.x - cx;
    const dy = t.y - cy;
    const dq = dx * dx + dy * dy;
    if (dq >= grenze) continue;
    const d = Math.sqrt(dq);
    // Dieselbe Richtung wie in `zuendeBombe`: genau auf der Bombe nach oben.
    const nx = d < 1e-9 ? 0 : dx / d;
    const ny = d < 1e-9 ? -1 : dy / d;
    const v = BOMBE_V * (1 - (1 - BOMBE_RAND_ANTEIL) * (d / BOMBE_R));
    const weite = weiteBeiTempo(v);
    let ex = t.x + nx * weite;
    let ey = t.y + ny * weite;
    if (ex < 0) ex = 0;
    else if (ex > karte.breite) ex = karte.breite;
    if (ey < 0) ey = 0;
    else if (ey > karte.hoehe) ey = karte.hoehe;
    wert += betrag(lochX - ex, lochY - ey) - betrag(lochX - t.x, lochY - t.y);
  }
  return wert;
}

/**
 * Die beste Stelle für eine Bombe — oder `null`, wenn keine `schwelle`
 * erreicht. Geprüft werden das Loch (liegt dort eine Gruppe, stößt die Bombe
 * sie auseinander) und je Führendem ein paar Stellen zwischen ihm und dem
 * Loch. Das löst nebenbei „das Ziel ist zu nah": Liegt der Führende neben
 * dem eigenen Ball, liegt eine der Stellen meist weit genug von ihm weg.
 */
function besteBombe(z: Partiezustand, sitz: number, karte: Karte, schwelle: number): { x: number; y: number } | null {
  const b = z.baelle[sitz];
  const lochX = karte.loch[0];
  const lochY = karte.loch[1];
  const eigenGrenze = BOMBE_R + EIGEN_ABSTAND;
  const stellen: number[] = [lochX, lochY];
  for (let s = 0; s < z.baelle.length; s += 1) {
    if (s === sitz || !zielbar(z, s)) continue;
    const t = z.baelle[s];
    const hx = lochX - t.x;
    const hy = lochY - t.y;
    const h = betrag(hx, hy);
    if (h < 0.3) {
      stellen.push(t.x, t.y);
      continue;
    }
    for (const vor of BOMBE_VORHALT) {
      const weit = vor < h ? vor : h;
      stellen.push(t.x + (hx / h) * weit, t.y + (hy / h) * weit);
    }
  }
  let besterWert = schwelle;
  let beste: { x: number; y: number } | null = null;
  for (let i = 0; i < stellen.length; i += 2) {
    const cx = stellen[i];
    const cy = stellen[i + 1];
    if (!erreichbar(karte, b, cx, cy) || betrag(cx - b.x, cy - b.y) < eigenGrenze) continue;
    const wert = bombenWert(z, sitz, karte, cx, cy);
    // Die erste Stelle, die die Schwelle erreicht, dann nur noch echt bessere.
    if (beste === null ? wert >= besterWert : wert > besterWert) {
      besterWert = wert;
      beste = { x: cx, y: cy };
    }
  }
  return beste;
}

/* --------------------------------------------------------------------------
 * Klebefeld
 * ----------------------------------------------------------------------- */

/**
 * Die Stelle für ein Klebefeld — oder `null`.
 *
 * Auf die Linie des Führenden: ein Stück vor seinem liegenden Ball in der
 * Richtung, in die er als Nächstes spielt (`naechstesZiel`). Der Ball liegt
 * dann im Fleck und rollt durch fast den ganzen Durchmesser — auf einem Putt
 * bleibt er darin stecken, auf einem langen Schlag fehlen ihm einige
 * Einheiten. Frei bleiben das Loch und die Linien aller anderen, die noch
 * spielen, auch die eigene: Deren nächste Schläge kommen vor Ablauf der acht
 * Sekunden, und Bots rechnen dort mit Rasen. Gemessen in einer Gegenprobe je
 * Störschlag (dieselbe Lage mit und ohne): Ein Fleck über dem Loch kostete
 * die anderen im Schnitt mehr Schläge als den Führenden.
 */
function besteKlebe(z: Partiezustand, sitz: number, karte: Karte): { x: number; y: number } | null {
  const b = z.baelle[sitz];
  const art = wegfeldArt(z, karte);
  const lochX = karte.loch[0];
  const lochY = karte.loch[1];
  const linienGrenze = (KLEBE_R + art.ballR) * (KLEBE_R + art.ballR);
  const lochGrenze = KLEBE_R + LOCH_FREI;
  // Nächstes Ziel und Linie jedes Balls, der noch spielt, und die eigene.
  const ziele: ({ x: number; y: number; linie: ReturnType<typeof segment> } | null)[] = [];
  for (let s = 0; s < z.baelle.length; s += 1) {
    const o = z.baelle[s];
    if (s !== sitz && (!o.dabei || o.eingelocht || o.fertigTakt !== -1)) {
      ziele.push(null);
      continue;
    }
    const ziel = naechstesZiel(karte, art, o.x, o.y);
    ziele.push({ x: ziel.x, y: ziel.y, linie: segment(o.x, o.y, ziel.x, ziel.y) });
  }
  for (let s = 0; s < z.baelle.length; s += 1) {
    const ziel = ziele[s];
    if (s === sitz || ziel === null || !zielbar(z, s)) continue;
    const t = z.baelle[s];
    const ax = ziel.x - t.x;
    const ay = ziel.y - t.y;
    const a = betrag(ax, ay);
    if (a < 0.2) continue;
    for (const anteil of KLEBE_VOR) {
      // Nie über die halbe Strecke hinaus: Dahinter träfe der Schlag den
      // Fleck womöglich gar nicht mehr.
      const vor = KLEBE_R * anteil < a / 2 ? KLEBE_R * anteil : a / 2;
      const cx = t.x + (ax / a) * vor;
      const cy = t.y + (ay / a) * vor;
      if (!erreichbar(karte, b, cx, cy)) continue;
      if (betrag(cx - b.x, cy - b.y) < KLEBE_R + EIGEN_ABSTAND) continue;
      if (betrag(cx - lochX, cy - lochY) < lochGrenze) continue;
      let frei = true;
      for (let o = 0; o < ziele.length && frei; o += 1) {
        const l = ziele[o];
        if (o !== s && l !== null && abstandQuadrat(l.linie, cx, cy) < linienGrenze) frei = false;
      }
      if (frei) return { x: cx, y: cy };
    }
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Entscheidung
 * ----------------------------------------------------------------------- */

/**
 * Der Störschlag eines Bots — oder `null`, dann schlägt er wie sonst (oder
 * wartet, siehe `botWartetAufStoer`).
 *
 *   - **Tausch**, wenn der Führende auf dem Weg mindestens
 *     `TAUSCH_VORSPRUNG` näher am Loch liegt.
 *   - **Bombe** auf die Stelle, die die Führenden am weitesten vom Loch
 *     wegstößt, ohne den eigenen Ball zu treffen (`besteBombe`).
 *   - **Klebefeld** auf die Linie des liegenden Führenden (`besteKlebe`).
 *
 * Liegt der eigene Ball nah am Loch (`LETZTE_CHANCE`), senkt der Bot die
 * Ansprüche: Nach dem Einlochen wäre der Störschlag verloren.
 */
export function botStoerschlag(
  z: Partiezustand,
  sitz: number,
  karte: Karte,
): { rx: number; ry: number; kraft: number } | null {
  if (!ausloesenErlaubt(z, sitz) || !fuehrerImSpiel(z, sitz)) return null;
  const b = z.baelle[sitz];
  const art = b.halt as Stoerart;
  const lochX = karte.loch[0];
  const lochY = karte.loch[1];
  const letzte = betrag(lochX - b.x, lochY - b.y) < LETZTE_CHANCE;
  if (art === 'tausch') {
    const ziel = tauschZiel(z, sitz);
    if (ziel < 0) return null;
    const t = z.baelle[ziel];
    if (t.halt === 'schild') return null;
    const w = wegfeldArt(z, karte);
    let eigen = wegZumLoch(karte, w.kundig, w.ballR, b.x, b.y);
    let fremd = wegZumLoch(karte, w.kundig, w.ballR, t.x, t.y);
    if (eigen < 0 || fremd < 0) {
      eigen = betrag(lochX - b.x, lochY - b.y);
      fremd = betrag(lochX - t.x, lochY - t.y);
    }
    if (eigen - fremd < (letzte ? TAUSCH_LETZTE : TAUSCH_VORSPRUNG)) return null;
    // Richtung und Kraft sind beim Tausch ohne Bedeutung, aber ein Zug braucht sie.
    return { rx: 0, ry: -1, kraft: 1 };
  }
  const stelle = art === 'bombe' ? besteBombe(z, sitz, karte, letzte ? BOMBE_LETZTE : BOMBE_SCHWELLE) : besteKlebe(z, sitz, karte);
  return stelle === null ? null : zugAuf(b, stelle.x, stelle.y);
}

/**
 * Soll der Bot noch einen Augenblick warten, statt zu schlagen? Ja, wenn er
 * einen Störschlag hält, den er auslösen dürfte (auch ein Tausch, der nur
 * mangels liegendem Ziel gesperrt ist), ein Führender gerade noch rollt oder
 * fliegt, und er nicht schon `WARTE_TAKTE` über seine Denkzeit hinaus
 * gewartet hat. Gefragt aus `botsEntscheiden`, nachdem `botStoerschlag`
 * nichts fand; wartet er, fragt er im nächsten Takt wieder.
 *
 * Die Wartezeit hängt allein an `botWartet` und `botDenkzeit`, die mit dem
 * Zustand reisen — jedes Gerät und jedes Rückspulen wartet gleich lang.
 */
export function botWartetAufStoer(z: Partiezustand, sitz: number, karte: Karte): boolean {
  if (sitz < 0 || sitz >= z.baelle.length || !istStoerart(z.baelle[sitz].halt)) return false;
  const grund = sperrgrund(z, sitz);
  if (grund !== null && grund !== 'keinZiel') return false;
  if (z.takt - z.botWartet[sitz] >= z.botDenkzeit[sitz] + WARTE_TAKTE) return false;
  const limit = karte.zeitLimitS * (1000 / TAKT_MS) * physikwerte(z.aktuell.mod, karte).zeitlimit;
  if (z.takt - z.aktuell.startTakt > limit - WARTE_RESERVE) return false;
  for (let s = 0; s < z.baelle.length; s += 1) {
    if (s === sitz || !fuehrt(z, s)) continue;
    const t = z.baelle[s];
    if (!t.dabei || t.eingelocht || t.fertigTakt !== -1) continue;
    if (!t.ruht || t.flugTakte > 0) return true;
  }
  return false;
}
