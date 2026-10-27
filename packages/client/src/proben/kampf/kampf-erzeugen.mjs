/**
 * Erzeugt `kampf-szene.json` — den Kampfbericht, den die Probe `/probe/kampf`
 * durch die ECHTE Kampfanzeige des Spiels laufen laesst.
 *
 * Aufruf aus dem Wurzelverzeichnis, nachdem `npm run build` gelaufen ist:
 *
 *     node packages/client/src/proben/kampf/kampf-erzeugen.mjs
 *
 * WAS HIER PASSIERT: Es wird eine ganze Partie zu viert mit Bots gespielt —
 * mit dem Spielpaket, nicht mit einer Nachbildung — und aus der zehnten Runde
 * der Kampf zweier Sitze herausgeschrieben. Deshalb steht am Ende genau das
 * im Bericht, was am Tisch auch dort stuende: Bretter mit Stufe 2 und 3 und
 * Marken, die zusammenpassen.
 *
 * WARUM NICHT ZWEI VON HAND BESETZTE BRETTER: Genau daran ist die Probe in
 * `test/kampf.test.ts` vorbeigegangen — sie besetzt gleichverteilt aus dem
 * Katalog, fast alles Stufe 1, keine passenden Marken, und misst damit einen
 * Kampf, den es im Spiel nicht gibt (17 s statt 35 s, siehe
 * docs/TAFELRUNDE-SPIELZEIT.md, "Der Kampf dauert doppelt so lange, wie im
 * Code steht"). Wer die Anzeige nach so einem Kampf beurteilt, beurteilt die
 * falsche Sache.
 *
 * WARUM EINE DATEI UND KEIN LAUF ZUR ANZEIGEZEIT: dieselbe Ueberlegung wie
 * bei `../szene-erzeugen.mjs` — der Client importiert aus keinem Spielpaket
 * (CLAUDE.md, "Der Client bildet keine Regel nach"), und `@brauweg/game-
 * tafelrunde` in einem Buendel des Browsers waere genau das. Die Datei ist
 * mitgeliefert und wird nicht beim Bauen erzeugt; dieses Skript ist die
 * Quittung, wie sie entstand.
 *
 * WER AN kampf.ts DREHT, LAESST DAS SKRIPT NOCH EINMAL LAUFEN. Sonst spielt
 * die Probe weiter den alten Ablauf ab — und die Zeiten, nach denen das
 * Tempo beurteilt wird, sind die aus dem Bericht.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { botZug } from '../../../../game-tafelrunde/dist/src/bot.js';
import {
  ARENA_REIHEN,
  BRETT_REIHEN,
  BRETT_SPALTEN,
  DEFAULT_REGELN,
  KATALOG,
  MARKEN,
  STANDARD_REGLER,
  aktiveSchwelle,
  darfHandeln,
  erstellePartie,
  fuehreAus,
  lebendeSitze,
  loeseKampfAuf,
  schrittdauer,
  sichtFuer,
  zaehleMarken,
} from '../../../../game-tafelrunde/dist/src/index.js';

/**
 * Die Saat der PARTIE, nicht die des Kampfes — und zwar GESUCHT, nicht gesetzt.
 *
 * Sie steht am Anfang der Kette: Aus ihr entstehen Laden, Paarungen und
 * Bot-Entscheidungen, und daraus wiederum die beiden Bretter. Der Kampf holt
 * sich seine eigene Saat aus der Partie (`kampfSaat`) — von Hand gesetzt
 * waere sie eine zweite Wahrheit.
 *
 * WARUM GESUCHT: Bis zum 24.09.2026 standen hier eine feste Saat UND eine
 * feste Paarung, und sie sind dreimal gefallen, jedes Mal aus demselben
 * Grund: Eine Aenderung an Regel, Katalog oder Bot laesst die Partie anders
 * laufen, und dann gibt es die aufgezeichnete Paarung nicht mehr. Erst
 * `probe-kampf-16` (Arena mit vier Reihen je Seite und Luecke), dann
 * `probe-kampf-420` (erreichte Runde 10 nicht mehr, seit ein Beistand heilt),
 * zuletzt `probe-kampf-2127` mit 3:2 — erst war die Paarung weg („3:1"), dann
 * erreichte auch diese Partie Runde 10 nicht mehr. Das Skript liess sich
 * damit nicht mehr ausfuehren, obwohl sein eigener Kopf das verlangt, und am
 * 18.09.2026 wurde ein neues Feld von Hand in die Szene geschrieben.
 *
 * Jetzt geht es die Saaten `probe-kampf-0, -1, -2 …` der Reihe nach durch und
 * nimmt den ERSTEN Kampf, der `taugt`. Nach einer Regelaenderung findet
 * derselbe Aufruf einfach den naechsten — und das Ergebnis bleibt trotzdem
 * bestimmt: gleiche Regeln, gleiche Szene.
 */
const SAAT_PRAEFIX = 'probe-kampf-';

/**
 * Wie weit gesucht wird, bevor das Skript aufgibt. Am 24.09.2026 erfuellten
 * zwei von 3.000 Partien alle Kriterien; eine Partie bis Runde 10 kostet rund
 * 25 ms, die ganze Grenze also etwa vier Minuten.
 */
const SUCHGRENZE = 10_000;

/** Runde 10: das erste ausgebaute Brett. Vorher steht fast alles auf Stufe 1. */
const RUNDE = 10;

/**
 * Unter x2 liegt der Median eines Kampfes bei 14,8 s (5.000 Partien zu
 * viert, neunte Messung in docs/spiele/auto-battler-konzept.md). Die Spanne
 * ist enger als die Schranke der Probe (8 bis 30 s), damit eine kleine
 * Verschiebung den gewaehlten Kampf nicht gleich ueber die Schranke traegt.
 */
const DAUER_MS = { von: 10_000, bis: 22_000 };

/**
 * WORAUF BEI DER SUCHE GEACHTET WIRD: der Kampf, der am meisten zeigt und
 * dabei typisch bleibt. Die ersten vier Bedingungen sind die Schranken aus
 * `ProbeKampf.test.tsx` — eine Szene, die dieses Skript waehlt, besteht die
 * Probe also bauartbedingt:
 *
 *   - kein Kaempfer unter Stufe 2 und einer auf Stufe 3;
 *   - ein Ende durch Ausloeschung und ein Sieg fuer Seite 0. Seite 0 ist
 *     `kampf.a` und damit `ich`, aus dessen Blick die Anzeige laeuft: Das
 *     Siegbild ist einer der vier Punkte, um die es Robin geht, und ein
 *     verlorener Kampf zeigt es nicht;
 *   - alle fuenf Vorgaenge (Bewegung, Treffer, Heilung, Tod, Ende). Die
 *     Heilung ist seit dem 06.09.2026 das Neueste an der Anzeige (gruenes
 *     Aufleuchten an der Figur, gruene Zahl am Kartenrand); eine Szene ohne
 *     Beistand zeigte davon nichts;
 *   - Tode auf BEIDEN Seiten — sonst sieht man das Sterben nur drueben.
 *
 * Dazu, strenger als die Probe: vier gegen vier und eine Dauer nahe am
 * Median (`DAUER_MS`). Die kurzen Kaempfe zeigen kaum Bewegung, die langen
 * enden in `entscheideNachZeit` und damit ohne Schlussbild. Die frueheren
 * Wunschpunkte „zwei Markenschwellen je Seite" und „Tode abwechselnd" sind
 * KEINE Bedingung mehr: Mit ihnen blieb unter 3.000 Partien genau ein Kampf
 * uebrig, und die naechste Regelaenderung haette die Suche leer laufen lassen.
 */
function taugt(kampf) {
  if (kampf.geist) return false;
  const b = kampf.bericht;
  const stufen = b.start.map((s) => s.stufe);
  if (Math.max(...stufen) !== 3 || stufen.includes(1)) return false;
  if ([0, 1].some((seite) => b.start.filter((s) => s.seite === seite).length !== 4)) return false;
  if (b.grund !== 'ausgeloescht' || b.sieger !== 0) return false;
  if (b.dauerMs < DAUER_MS.von || b.dauerMs > DAUER_MS.bis) return false;
  const arten = [...new Set(b.ereignisse.map((e) => e.art))].sort().join();
  if (arten !== 'bewegung,ende,heilung,tod,treffer') return false;
  const gefallen = new Set(
    b.ereignisse
      .filter((e) => e.art === 'tod')
      .map((e) => b.start.find((s) => s.id === e.wer).seite),
  );
  return gefallen.size === 2;
}

/** Vier Sitze, alle mit derselben Gangart — so misst auch der Messstand. */
const SITZE = [0, 1, 2, 3];
const GANGART = 'normal';

/**
 * Zeitraffer x2, wie er seit dem 05.09.2026 gespielt wird.
 *
 * Der gebaute Standard steht seit dem 05.09.2026 selbst auf 2
 * (`STANDARD_REGLER`), diese Zeile setzt also nur noch fest, was ohnehin
 * gilt. Sie bleibt trotzdem stehen: Die Szene ist eine AUFZEICHNUNG, und wenn
 * jemand den Standard aendert, soll die aufgezeichnete Zeit nicht stillschwei-
 * gend eine andere Bedeutung bekommen. Der Wert steht mit in der Datei.
 */
const ZEITRAFFER = 2;
const REGLER = { ...STANDARD_REGLER, zeitraffer: ZEITRAFFER };

/** Reissleine gegen eine Endlosschleife, wie im Messstand (test/messen.ts). */
const MAX_ZUEGE_JE_SITZ = 200;

/**
 * Spielt bis zum Beginn der Kampfphase der gewuenschten Runde — oder liefert
 * `null`, wenn die Partie vorher endet. Das ist kein Fehler, sondern der
 * Normalfall der Suche: Etwa die Haelfte der Partien kommt nicht so weit.
 */
function spieleBisRunde(saat, runde) {
  let p = erstellePartie(DEFAULT_REGELN, SITZE, saat, REGLER);
  for (let schleife = 0; schleife < 60 && !p.fertig; schleife++) {
    for (const sitz of lebendeSitze(p)) {
      for (let i = 0; i < MAX_ZUEGE_JE_SITZ && darfHandeln(p, sitz); i++) {
        p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz), GANGART));
      }
      if (darfHandeln(p, sitz)) throw new Error(`Sitz ${sitz} meldet sich nicht bereit`);
    }
    if (p.phase !== 'kampf') break;
    // HIER stehen die Bretter der Runde vollstaendig da: Der Kampf ist
    // gerechnet, aber noch nicht abgerechnet (nach `loeseKampfAuf` sind die
    // Bretter der Ausgeschiedenen leer).
    if (p.runde >= runde) return p;
    p = loeseKampfAuf(p);
  }
  return null;
}

/** Die erreichten Markenschwellen eines Bretts, wie die Sicht sie liefert. */
function markenVon(brett) {
  const zaehlung = zaehleMarken(brett);
  return MARKEN.filter((marke) => aktiveSchwelle(zaehlung[marke]) !== null).map((marke) => ({
    marke,
    anzahl: zaehlung[marke],
    schwelle: aktiveSchwelle(zaehlung[marke]),
  }));
}

/** Die erste Saat, deren Partie in Runde `RUNDE` einen Kampf hat, der taugt. */
function sucheKampf() {
  for (let n = 0; n < SUCHGRENZE; n++) {
    const saat = `${SAAT_PRAEFIX}${n}`;
    const partie = spieleBisRunde(saat, RUNDE);
    const kampf = partie?.kaempfe.find(taugt);
    if (kampf) return { saat, partie, kampf };
  }
  throw new Error(
    `Unter ${SUCHGRENZE} Saaten taugt kein Kampf in Runde ${RUNDE} — ` +
      'die Bedingungen in taugt() gegen die aktuelle Regel pruefen',
  );
}

const { saat: SAAT, partie, kampf } = sucheKampf();

/*
 * Nur die Einheiten der beiden Bretter, nicht der ganze Katalog: Die Anzeige
 * schlaegt je Kaempfer genau eine Kennung nach, und 22 Eintraege in einer
 * Datei, von denen acht gebraucht werden, sind 22 Stellen, die auseinander
 * laufen koennen.
 */
const gebraucht = new Set(kampf.bericht.start.map((s) => s.einheitId));
const katalog = KATALOG.filter((e) => gebraucht.has(e.id)).map((e) => ({
  id: e.id,
  name: e.name,
  kosten: e.kosten,
  rolle: e.rolle,
}));

const szene = {
  saat: SAAT,
  gangart: GANGART,
  sitze: SITZE,
  runde: partie.runde,
  rundenGrenze: DEFAULT_REGELN.rundenGrenze,
  zeitraffer: ZEITRAFFER,
  /*
   * Die Schrittdauer dieses Reglers — am Tisch steht sie in der Sicht
   * (`schrittMs`), und die Anzeige laesst die Figur genau so lange gleiten.
   * Abgeleitet und nicht geschrieben: Das Modul rundet auf ganze Takte auf,
   * `SCHRITT_MS / ZEITRAFFER` waere 250 statt 300.
   */
  schrittMs: schrittdauer(REGLER),
  ich: kampf.a,
  brettReihen: BRETT_REIHEN,
  arenaReihen: ARENA_REIHEN,
  brettSpalten: BRETT_SPALTEN,
  kampf,
  katalog,
  seiten: [
    { seite: 0, sitz: kampf.a, marken: markenVon(partie.heere[kampf.a].brett) },
    { seite: 1, sitz: kampf.b, marken: markenVon(partie.heere[kampf.b].brett) },
  ],
};

const ziel = fileURLToPath(new URL('./kampf-szene.json', import.meta.url));
writeFileSync(ziel, `${JSON.stringify(szene, null, 2)}\n`);

const b = kampf.bericht;
const zaehle = (art) => b.ereignisse.filter((e) => e.art === art).length;
console.log(
  `${ziel}\n  Saat ${SAAT}, Runde ${partie.runde}, Sitz ${kampf.a} gegen ${kampf.b}, ` +
    `${(b.dauerMs / 1000).toFixed(1)} s bei Zeitraffer x${ZEITRAFFER}\n` +
    `  ${b.start.length} Einheiten, ${b.ereignisse.length} Ereignisse ` +
    `(${zaehle('bewegung')} Bewegungen, ${zaehle('treffer')} Treffer, ` +
    `${zaehle('heilung')} Heilungen, ${zaehle('tod')} Tode), ` +
    `Sieger Seite ${b.sieger}, Ende durch ${b.grund}`,
);
