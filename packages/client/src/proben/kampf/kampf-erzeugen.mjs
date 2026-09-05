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
  sichtFuer,
  zaehleMarken,
} from '../../../../game-tafelrunde/dist/src/index.js';

/**
 * Die Saat der PARTIE, nicht die des Kampfes.
 *
 * Sie steht am Anfang der Kette: Aus ihr entstehen Laden, Paarungen und
 * Bot-Entscheidungen, und daraus wiederum die beiden Bretter. Der Kampf holt
 * sich seine eigene Saat aus der Partie (`kampfSaat`) — von Hand gesetzt
 * waere sie eine zweite Wahrheit.
 *
 * WARUM AUSGERECHNET DIESE: Von 500 durchgerechneten Partien liefert sie in
 * Runde 10 den Kampf, der am meisten zeigt und dabei typisch bleibt —
 * 18,2 s (Median unter Zeitraffer x2 sind 18,3 s), vier gegen vier, kein
 * Kaempfer unter Stufe 2 und einer auf Stufe 3, auf beiden Seiten zwei
 * erreichte Markenschwellen, fuenf Tode ABWECHSELND auf beiden Seiten und
 * ein Ende durch Ausloeschung. Die kurzen Kaempfe zeigen kaum Bewegung, die
 * langen enden in `entscheideNachZeit` und damit ohne Schlussbild, und in
 * vielen faellt keine einzige eigene Einheit.
 *
 * AM 06.09.2026 NEU GESUCHT: Vorher stand hier `probe-kampf-16` mit der
 * Paarung 2:3. Mit vier Reihen je Seite und der Luecke in der Arena spielt
 * der Bot andere Runden, und in Runde 10 jener Partie gibt es die Paarung
 * gar nicht mehr. Der neue Kampf zeigt nebenbei genau das, worum es bei der
 * Aenderung ging: 26 Bewegungen statt 6, bei fast gleich vielen Ereignissen
 * (171 statt 168).
 */
const SAAT = 'probe-kampf-420';

/** Runde 10: das erste ausgebaute Brett. Vorher steht fast alles auf Stufe 1. */
const RUNDE = 10;

/**
 * Die beiden Sitze, deren Kampf gezeigt wird — und `ICH` ist der, aus dessen
 * Blick die Anzeige laeuft. Er gewinnt: Das Siegbild ist einer der vier
 * Punkte, um die es Robin geht, und ein verlorener Kampf zeigt es nicht.
 */
const PAARUNG = { a: 3, b: 1 };

/** Vier Sitze, alle mit derselben Gangart — so misst auch der Messstand. */
const SITZE = [0, 1, 2, 3];
const GANGART = 'normal';

/**
 * Zeitraffer x2, wie er seit dem 05.09.2026 gespielt wird.
 *
 * Ausdruecklich gesetzt und nicht `STANDARD_REGLER` uebernommen, solange der
 * gebaute Standard noch auf 1 steht (der Zweig dazu ist noch nicht
 * zusammengefuehrt). Steht `STANDARD_REGLER.zeitraffer` erst selbst auf 2,
 * ist diese Zeile wirkungslos und kann weg.
 */
const ZEITRAFFER = 2;
const REGLER = { ...STANDARD_REGLER, zeitraffer: ZEITRAFFER };

/** Reissleine gegen eine Endlosschleife, wie im Messstand (test/messen.ts). */
const MAX_ZUEGE_JE_SITZ = 200;

/** Spielt bis zum Beginn der Kampfphase der gewuenschten Runde. */
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
  throw new Error(`Partie ${saat} erreicht Runde ${runde} nicht`);
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

const partie = spieleBisRunde(SAAT, RUNDE);
const kampf = partie.kaempfe.find((k) => k.a === PAARUNG.a && k.b === PAARUNG.b);
if (!kampf) {
  const gab = partie.kaempfe.map((k) => `${k.a}:${k.b}`).join(', ');
  throw new Error(`Kampf ${PAARUNG.a}:${PAARUNG.b} gibt es in Runde ${RUNDE} nicht (${gab})`);
}

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
  ich: PAARUNG.a,
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
  `${ziel}\n  Runde ${partie.runde}, Sitz ${kampf.a} gegen ${kampf.b}, ` +
    `${(b.dauerMs / 1000).toFixed(1)} s bei Zeitraffer x${ZEITRAFFER}\n` +
    `  ${b.start.length} Einheiten, ${b.ereignisse.length} Ereignisse ` +
    `(${zaehle('bewegung')} Bewegungen, ${zaehle('treffer')} Treffer, ${zaehle('tod')} Tode), ` +
    `Sieger Seite ${b.sieger}, Ende durch ${b.grund}`,
);
