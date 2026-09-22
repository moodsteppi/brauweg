/**
 * Der Bahnkatalog des Moduls und die Bahnwahl einer Partie.
 *
 * Der Server kennt keine Geometrie — die liegt im Client unter
 * `packages/client/src/minispiele/golf/karten/`, eine Datei je Bahn. Was er
 * braucht, um EINMAL beim Start festzulegen, welche Bahnen eine Partie in
 * welcher Folge spielt, ist nur Kennung und Schwierigkeit. Genau das steht
 * hier.
 *
 * Bis zum 22.09.2026 rechnete jedes Geraet die Folge selbst: `waehleKarten`
 * im Client zog INDIZES aus der Saat gegen SEINEN Katalog. Damit war die
 * Reihenfolge des Client-Katalogs Teil des Determinismus — jede neue Bahn
 * musste hinten angehaengt werden, und zwei Geraete mit verschieden langen
 * Katalogen spielten aus derselben Saat verschiedene Bahnen. Robin hat an dem
 * Tag entschieden, dass Bahnen jederzeit ohne Protokollbruch dazukommen
 * sollen (Map-Editor, Bahnauswahl). Seitdem zieht das Modul die Folge hier,
 * ein einziges Mal in `erzeugePartie`, und liefert sie als Kennungen in der
 * Sicht mit (`GolfView.bahnen`). Ein Client, der eine Kennung nicht kennt,
 * ist zu alt und sagt das — er rechnet nicht mit einer anderen Bahn weiter.
 *
 * Der Vertrag `packages/client/src/vertrag/golf-bahnen.test.ts` haelt diesen
 * Katalog gegen die Geometrien des Clients: jede Kennung hier hat dort eine
 * Bahn, und umgekehrt. Eine neue Bahn ist also eine Datei im Client PLUS eine
 * Zeile hier — an ihrer Nummer einsortiert, die Liste bleibt nach Kennung
 * geordnet (`bahnen.test.ts` verlangt das).
 */

import { BAHN_THEMEN, kursMitKennung, type GolfThema } from './kurse.js';
import type { GolfFilter, GolfRegeln } from './regeln.js';

export interface Bahneintrag {
  /** Kennung, z. B. `k01-der-erste-schlag` — dieselbe wie `Karte.id` im Client. */
  readonly id: string;
  readonly schwierigkeit: 1 | 2 | 3 | 4 | 5;
}

/**
 * Alle Bahnen, nach Kennung geordnet. Die Schwierigkeit steht doppelt (hier
 * und an der Geometrie im Client); der Vertrag prueft, dass beide gleich sind.
 */
export const BAHNEN_KATALOG: readonly Bahneintrag[] = [
  { id: 'k01-der-erste-schlag', schwierigkeit: 1 },
  { id: 'k02-der-sandkasten', schwierigkeit: 1 },
  { id: 'k03-die-eisrutsche', schwierigkeit: 1 },
  { id: 'k04-der-kickstart', schwierigkeit: 1 },
  { id: 'k05-der-pilzwald', schwierigkeit: 1 },
  { id: 'k06-zwillingstore', schwierigkeit: 1 },
  { id: 'k07-die-sprungschanze', schwierigkeit: 1 },
  { id: 'k08-der-strudelgarten', schwierigkeit: 1 },
  { id: 'k09-der-uferweg', schwierigkeit: 2 },
  { id: 'k10-das-langsame-drehkreuz', schwierigkeit: 2 },
  { id: 'k11-sandkurve', schwierigkeit: 2 },
  { id: 'k12-turbozange', schwierigkeit: 2 },
  { id: 'k13-wasserinsel', schwierigkeit: 2 },
  { id: 'k14-eistrichter', schwierigkeit: 2 },
  { id: 'k15-langer-schlauch', schwierigkeit: 2 },
  { id: 'k16-bumperkammer', schwierigkeit: 2 },
  { id: 'k17-portalzange', schwierigkeit: 2 },
  { id: 'k18-strudelgarten', schwierigkeit: 2 },
  { id: 'k19-sprungtrichter', schwierigkeit: 3 },
  { id: 'k20-eisstrudel', schwierigkeit: 3 },
  { id: 'k21-eisrutsche-zum-bumpergarten', schwierigkeit: 3 },
  { id: 'k22-turbo-ueberm-teich', schwierigkeit: 3 },
  { id: 'k23-portal-in-die-sandkammer', schwierigkeit: 3 },
  { id: 'k24-drehkreuz-vorm-loch', schwierigkeit: 3 },
  { id: 'k25-strudelfalle-an-der-abkuerzung', schwierigkeit: 3 },
  { id: 'k26-sprung-ueber-die-wasserzunge', schwierigkeit: 3 },
  { id: 'k27-doppelpilz-im-eis', schwierigkeit: 3 },
  { id: 'k28-kreiselkammer', schwierigkeit: 3 },
  { id: 'k29-schmales-sprungtor', schwierigkeit: 4 },
  { id: 'k30-nadeloehr-der-portale', schwierigkeit: 4 },
  { id: 'k31-zwillingsstrom', schwierigkeit: 4 },
  { id: 'k32-eisrutsche', schwierigkeit: 4 },
  { id: 'k33-seeplatte', schwierigkeit: 4 },
  { id: 'k34-katapultkorridor', schwierigkeit: 4 },
  { id: 'k35-sandsprint', schwierigkeit: 4 },
  { id: 'k36-nadeloehr', schwierigkeit: 4 },
  { id: 'k37-portalkarussell', schwierigkeit: 5 },
  { id: 'k38-sprungfeldkaskade', schwierigkeit: 5 },
  { id: 'k39-drehkreuzgasse', schwierigkeit: 5 },
  { id: 'k40-meisterzirkel', schwierigkeit: 5 },
];

// ---------------------------------------------------------------------------
// mulberry32 — dieselbe Rechnung wie in `zufall.ts` des Clients
// ---------------------------------------------------------------------------

/*
 * Bewusst eine Abschrift von `mulberry32`/`naechste`/`ganzzahl` aus
 * `packages/client/src/minispiele/golf/zufall.ts` und kein Import: Das Modul
 * darf nichts aus dem Client ziehen, und der Client nichts aus dem Modul
 * (nur die Vertraege tun das). Gleich bleiben muss die Rechnung trotzdem —
 * nicht mehr fuer den Gleichschritt (die Folge wird ja nur noch hier
 * gezogen), aber damit ein Schnappschuss von vor dem 22.09.2026 beim Laden
 * dieselben Bahnen bekommt, die seine Geraete damals selbst gezogen haben
 * (siehe `deserialize` in adapter.ts). `bahnen.test.ts` haelt die Rechnung
 * mit festen Zahlen fest.
 */

function mulberry32(saat: number): number {
  return saat | 0;
}

function naechste(zustand: number): { wert: number; zustand: number } {
  const a = (zustand + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { wert: ((t ^ (t >>> 14)) >>> 0) / 4294967296, zustand: a };
}

function ganzzahl(zustand: number, von: number, bis: number): { wert: number; zustand: number } {
  const z = naechste(zustand);
  const spanne = bis - von + 1;
  let wert = von + Math.floor(z.wert * spanne);
  if (wert > bis) wert = bis;
  return { wert, zustand: z.zustand };
}

// ---------------------------------------------------------------------------
// Bahnwahl
// ---------------------------------------------------------------------------

/**
 * Sollstufe des `i`-ten Lochs bei `loecher` Loechern: eine Rampe von leicht
 * nach schwer. Zwei Loecher spielen Stufe 1 und 2, fuenf Loecher alle fuenf
 * Stufen, neun Loecher je zwei davon (und einmal die 5), fuenfzehn je drei.
 *
 * Warum eine Rampe und nicht nur "sortiert": Ein Zwei-Loch-Match zog vorher
 * zwei beliebige der 40 Bahnen — auch zwei Meisterbahnen. Der Einstieg soll
 * aber immer leicht sein, und die Spitze soll erst kommen, wenn das Match
 * lang genug ist, sie zu verdienen.
 */
export function sollStufe(i: number, loecher: number, von = 1, bis = 5): number {
  // Mit den Vorgaben 1..5 ist das Wort fuer Wort die Rechnung von vor dem
  // 22.09.2026 — alte Schnappschuesse ziehen damit dieselbe Folge. `von`/`bis`
  // schieben die Rampe nur in die Stufen, die ein Filter uebrig laesst.
  const spanne = bis - von + 1;
  const hoechste = loecher < spanne ? loecher : spanne;
  return von + Math.floor((i * hoechste) / loecher);
}

/**
 * Zieht `loecher` VERSCHIEDENE Bahnen aus der Saat: fuer jedes Loch eine Bahn
 * seiner Sollstufe (siehe `sollStufe`), aus einem gemischten Topf; ist die
 * Stufe erschoepft, die naechstliegende (lieber leichter als schwerer). Die
 * Reihenfolge ist damit aufsteigend nach Schwierigkeit. Zurueck kommen die
 * Kennungen, nicht Indizes — der Katalog des Empfaengers darf anders sortiert
 * sein oder mehr Bahnen kennen.
 *
 * Eigener Zufallsstrom (Saat verodert mit einer Konstanten): Die Bahnwahl darf
 * den Strom der Partie im Client nicht verschieben, sonst hinge der Versatz
 * am Abschlag an der Anzahl der Loecher. Die Konstante ist dieselbe wie im
 * alten `waehleKarten` — siehe den Kasten ueber mulberry32.
 *
 * Mehr Loecher als Bahnen kann nur ein Testaufbau erzeugen; dann wird der
 * Topf von vorn wiederholt, statt abzubrechen.
 *
 * **Bahnauswahl (seit dem 22.09.2026).** `regeln` ist der Regelsatz des
 * Tisches (siehe `GolfRegeln`):
 *
 *   - `kurs` oder `bahnen`: genau diese Folge. Kennungen, die der Katalog
 *     nicht kennt, fallen heraus; bleibt keine uebrig, wird gezogen wie ohne
 *     Wahl. Passt die Lochzahl nicht zur Liste (die Lobby stellt sie gleich,
 *     ein fremder Client vielleicht nicht), siehe `strecke`.
 *   - `filter`: dieselbe Ziehung, aber Bahnen ausserhalb des Filters kommen
 *     nur zum Zug, wenn die passenden aufgebraucht sind (Aufschlag im
 *     Abstand), und die Rampe laeuft ueber die Stufen der passenden. Passt
 *     gar keine, wird gezogen wie ohne Filter — eine leere Folge gibt es nie.
 *
 * Ohne Wahl ist die Rechnung unveraendert; `bahnen.test.ts` haelt das mit
 * den festen Folgen von vor der Umstellung fest.
 */
export function waehleBahnen(
  saat: number,
  loecher: number,
  katalog: readonly Bahneintrag[] = BAHNEN_KATALOG,
  regeln?: GolfRegeln,
): string[] {
  const liste = festeFolge(regeln, katalog);
  if (liste.length > 0) return strecke(liste, loecher);
  const passt = filterAus(regeln, katalog);

  const topf: number[] = [];
  for (let i = 0; i < katalog.length; i += 1) topf.push(i);
  let z = mulberry32(saat ^ 0x5f356495);
  for (let i = topf.length - 1; i > 0; i -= 1) {
    const g = ganzzahl(z, 0, i);
    z = g.zustand;
    const merk = topf[i]!;
    topf[i] = topf[g.wert]!;
    topf[g.wert] = merk;
  }

  const gewaehlt: number[] = [];
  const benutzt = new Set<number>();
  for (let i = 0; i < loecher; i += 1) {
    const soll = sollStufe(i, loecher, passt?.von, passt?.bis);
    let beste = -1;
    let besterAbstand = Number.POSITIVE_INFINITY;
    for (const index of topf) {
      if (benutzt.has(index)) continue;
      const stufe = katalog[index]!.schwierigkeit;
      // Leichter ist bei gleichem Abstand besser als schwerer: +0,5 Strafe nach oben.
      // Ausserhalb des Filters +100: nur, wenn keine passende mehr frei ist.
      const abstand =
        (stufe <= soll ? soll - stufe : stufe - soll + 0.5) +
        (passt === null || passt.indizes.has(index) ? 0 : AUFSCHLAG_AUSSERHALB);
      if (abstand < besterAbstand) {
        besterAbstand = abstand;
        beste = index;
        if (abstand === 0) break;
      }
    }
    if (beste === -1) {
      if (topf.length === 0) break;
      beste = topf[i % topf.length]!;
    }
    benutzt.add(beste);
    gewaehlt.push(beste);
  }
  gewaehlt.sort((a, b) => {
    const sa = katalog[a]!.schwierigkeit;
    const sb = katalog[b]!.schwierigkeit;
    // Gleichstand ueber den Index brechen: Ein unvollstaendiger Vergleich macht
    // `sort` von der Ausgangsreihenfolge abhaengig und damit unzuverlaessig.
    return sa !== sb ? sa - sb : a - b;
  });
  return gewaehlt.map((index) => katalog[index]!.id);
}

// ---------------------------------------------------------------------------
// Bahnauswahl des Tisches
// ---------------------------------------------------------------------------

/** Abstandsaufschlag fuer Bahnen ausserhalb des Filters — groesser als jeder Stufenabstand. */
const AUFSCHLAG_AUSSERHALB = 100;

/** Die feste Folge aus Kurs oder Einzelauswahl, bereinigt um Unbekannte; leer = keine. */
function festeFolge(regeln: GolfRegeln | undefined, katalog: readonly Bahneintrag[]): string[] {
  if (typeof regeln !== 'object' || regeln === null) return [];
  let roh: readonly unknown[] = [];
  if (regeln.kurs !== undefined) roh = kursMitKennung(regeln.kurs)?.bahnen ?? [];
  else if (Array.isArray(regeln.bahnen)) roh = regeln.bahnen;
  const bekannt = new Set(katalog.map((b) => b.id));
  return roh.filter((id): id is string => typeof id === 'string' && bekannt.has(id));
}

/**
 * Eine feste Liste auf `loecher` Loecher bringen.
 *
 * Gleich lang: unveraendert. Kuerzer gewuenscht: gleichmaessig ausgeduennt,
 * erste und letzte Bahn bleiben — ein gekuerzter Kurs behaelt Einstieg und
 * Finale, statt nach der Haelfte aufzuhoeren. Laenger gewuenscht: die Liste
 * von vorn wiederholt (nur ueber einen Client erreichbar, der die Lochzahl
 * nicht angleicht). Nur `+ - * /` und `Math.floor`: Das Ergebnis steht im
 * Zustand, aber auch der Server soll nicht anders runden als ein Test.
 */
function strecke(liste: readonly string[], loecher: number): string[] {
  const n = liste.length;
  if (loecher <= 0) return [];
  if (loecher >= n) return Array.from({ length: loecher }, (_, i) => liste[i % n]!);
  if (loecher === 1) return [liste[0]!];
  return Array.from({ length: loecher }, (_, i) => liste[Math.floor((i * (n - 1)) / (loecher - 1) + 0.5)]!);
}

interface Filtertreffer {
  readonly indizes: ReadonlySet<number>;
  /** Leichteste und schwerste passende Stufe — Grenzen der Rampe. */
  readonly von: number;
  readonly bis: number;
}

/** Welche Katalogplaetze der Filter zulaesst; null = kein Filter oder keiner passt. */
function filterAus(regeln: GolfRegeln | undefined, katalog: readonly Bahneintrag[]): Filtertreffer | null {
  if (typeof regeln !== 'object' || regeln === null) return null;
  const filter = regeln.filter;
  if (typeof filter !== 'object' || filter === null) return null;
  const stufen = Array.isArray(filter.schwierigkeit) ? filter.schwierigkeit : [];
  const thema = typeof filter.thema === 'string' ? filter.thema : null;
  if (stufen.length === 0 && thema === null) return null;
  const indizes = new Set<number>();
  let von = 6;
  let bis = 0;
  for (let i = 0; i < katalog.length; i += 1) {
    const b = katalog[i]!;
    if (stufen.length > 0 && !stufen.includes(b.schwierigkeit)) continue;
    if (thema !== null && !(BAHN_THEMEN[b.id] ?? []).includes(thema as GolfThema)) continue;
    indizes.add(i);
    if (b.schwierigkeit < von) von = b.schwierigkeit;
    if (b.schwierigkeit > bis) bis = b.schwierigkeit;
  }
  return indizes.size === 0 ? null : { indizes, von, bis };
}

/**
 * Wie viele Bahnen ein Filter zulaesst — fuer die Warnung in `validateConfig`
 * (ein Filter ohne Treffer ist erlaubt, zieht aber aus allen Bahnen).
 */
export function passendeBahnen(filter: GolfFilter, katalog: readonly Bahneintrag[] = BAHNEN_KATALOG): string[] {
  const treffer = filterAus({ filter }, katalog);
  return treffer === null ? [] : [...treffer.indizes].sort((a, b) => a - b).map((i) => katalog[i]!.id);
}
