/**
 * Wo der Bot seine Einheiten hinstellt — und was eine andere Tabelle bringt.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/aufstellung.mjs
 *
 * WOZU ES DA IST. Am 06.09.2026 bekam jede Bretthaelfte vier Reihen statt
 * zwei, mit Robins Begruendung "dann bewegen sie sich auch mehr und man kann
 * taktischer aufstellen". Gemessen hat der Bot davon nichts gehabt: Er stand
 * zu 100 % in Reihe 0 und zu 100 % in Reihe 3, die beiden mittleren Reihen
 * bekamen 0,0 %. `platzStrafe` in bot.ts kannte nur vorn und hinten.
 *
 * Ob er ueberhaupt STAFFELN soll, war damit noch nicht beantwortet — eine
 * volle Reihe 2 ist kein Selbstzweck. Die Antwort ist am Ende auch keine
 * Staffelung geworden, sondern ein GESCHLOSSENER BLOCK (siehe
 * STANDARD_TIEFEN in bot.ts); herausgekommen ist sie mit diesem Werkzeug, und
 * zwar ohne dass jemand bot.ts anfasst und neu baut:
 *
 *     --tiefe beistand=2     Eine Rolle umstellen, mehrfach erlaubt.
 *     --tiefe schuetze=2     Die Zahl zaehlt Reihen VON VORN (0 = Mittellinie).
 *
 * Rollen: wache, meuchler, beistand, schuetze, magier. Eine Tiefe groesser
 * als das Brett klemmt auf die hinterste Reihe ab — genau wie im Bot.
 *
 * ZWEI LAEUFE, UND DER KONTROLLLAUF GEHOERT DAZU. Sitz 0 gewinnt in diesem
 * Messstand nachweislich zu oft (Board-Karte vom 05.09.2026: 13 % ueber dem
 * Erwartungswert, weil der gemeinsame Vorrat knapp wird). Wer nur den
 * Versuchslauf zaehlt, haelt diesen Vorsprung fuer seine Aenderung. Deshalb
 * laeuft immer beides ueber DIESELBEN Saaten: einmal alle Sitze wie gebaut,
 * einmal Sitz 0 mit der vorgeschlagenen Tabelle. Verglichen wird die
 * DIFFERENZ der Siege von Sitz 0, nicht seine nackte Zahl.
 *
 * WEITERE SCHALTER (alle mit Vorgabe):
 *
 *     --partien 400        Wie viele Partien je Lauf.
 *     --sitze 4            Sitze am Tisch, 2 bis 8.
 *     --saat aufstellung-v1  Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --gangart normal     Gangart aller Sitze.
 *     --verteilung         Statt des Duells nur die Reihenverteilung, und
 *                          zwar mit der Tabelle auf ALLEN Sitzen.
 *
 * DER STANDARDFEHLER LIEGT BEI 3.000 PARTIEN UM 24 SIEGE. Eine Differenz von
 * zehn ist keine Aussage; jede Aussage gehoert ueber mehrere Saatbasen
 * belegt. Genau so ist die Tabelle entstanden, die heute in bot.ts steht:
 *
 *     for s in a b c; do node …/aufstellung.mjs --partien 3000 --saat $s \
 *       --tiefe wache=1 --tiefe meuchler=2 --tiefe beistand=2 \
 *       --tiefe schuetze=2 --tiefe magier=2; done
 *
 * GEMESSEN AM 06.09.2026 gegen den damaligen Stand (w0 m0 b3 s3 g3), je
 * 3.000 Partien zu viert, Differenz der Siege von Sitz 0 gegen den
 * Kontrolllauf:
 *
 *     Vorschlag                            Saat a   Saat b   Saat c
 *     w1 m2 b2 s2 g2 (heutiger Stand)        +108     +111      +74
 *     w0 m1 b1 s1 g1                          +73      +54       +8
 *     schuetze=2 magier=2                     +88      +30      +12
 *     beistand=2                               +2       +5       -9
 *     beistand=1                               +8      +11       -9
 *     meuchler=1                               +7       -1       +8
 *
 * DIE LETZTEN DREI ZEILEN SIND DER GRUND FUER DEN DUELL-MODUS: Eine einzelne
 * Rolle umzustellen bewegt am Tisch nichts Messbares — ein Beistand steht nur
 * auf jedem achten Brett. Getragen hat die Tiefe der FERNKAEMPFER, und die
 * ganze Tabelle traegt mehr als jede Einzelmassnahme.
 *
 * WARUM ES GEBAUT SEIN MUSS: Es holt `spieleParte` aus `dist/test/messen.js` —
 * dieselbe Partieschleife, die auch die Proben benutzen (siehe messen.ts).
 * Eine zweite Fassung des Messverfahrens im Werkzeug waere der sichere Weg zu
 * zwei Zahlen fuer dieselbe Frage.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const MESSSTAND = resolve(HIER, '../dist/test/messen.js');

if (!existsSync(MESSSTAND)) {
  console.error('Der Messstand fehlt: ' + MESSSTAND);
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

// Ueber `pathToFileURL`: Unter Windows haelt der ESM-Lader das "C:" eines
// absoluten Pfades sonst fuer ein Protokoll (ERR_UNSUPPORTED_ESM_URL_SCHEME).
const laden = (pfad) => import(pathToFileURL(pfad).href);

const { ACHT_SITZE, spieleParte } = await laden(MESSSTAND);
const {
  BRETT_REIHEN,
  BRETT_SPALTEN,
  DEFAULT_REGELN,
  KATALOG,
  STANDARD_REGLER,
  baueZufall,
  einheit,
  simuliereKampf,
} = await laden(resolve(HIER, '../dist/src/index.js'));
// Nicht ueber index.js: Die Gangarten sind kein Teil der Modulschnittstelle,
// sondern der Stand, gegen den hier gemessen wird.
const { GANGARTEN } = await laden(resolve(HIER, '../dist/src/bot.js'));

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

/** Alle Vorkommen eines mehrfach erlaubten Schalters — `indexOf` nimmt nur das erste. */
function alleSchalter(name) {
  const gefunden = [];
  process.argv.forEach((teil, stelle) => {
    if (teil !== `--${name}`) return;
    const wert = process.argv[stelle + 1];
    if (wert !== undefined) gefunden.push(wert);
  });
  return gefunden;
}

const NAMEN = ['sanft', 'normal', 'hart'];
const GANGART = schalter('gangart', 'normal');
const PARTIEN = Number(schalter('partien', '400'));
const SITZZAHL = Number(schalter('sitze', '4'));
const SAAT_BASIS = schalter('saat', 'aufstellung-v1');
const NUR_VERTEILUNG = process.argv.includes('--verteilung');
const NUR_DUELL = process.argv.includes('--duell');

if (!NAMEN.includes(GANGART)) {
  console.error(`--gangart kennt nur ${NAMEN.join(', ')}`);
  process.exit(1);
}
if (!Number.isInteger(PARTIEN) || PARTIEN < 1) {
  console.error('--partien braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}

const GEBAUTE_TIEFEN = GANGARTEN[GANGART].tiefen;
const TIEFEN = { ...GEBAUTE_TIEFEN };

for (const angabe of alleSchalter('tiefe')) {
  const trenner = angabe.indexOf('=');
  if (trenner < 1) {
    console.error(`--tiefe braucht die Form rolle=zahl, nicht "${angabe}"`);
    process.exit(1);
  }
  const rolle = angabe.slice(0, trenner);
  // `Object.hasOwn` und nicht `!== undefined`: Sonst liesse sich ueber
  // `--tiefe toString=1` ein Feld setzen, das keine Rolle ist.
  if (!Object.hasOwn(GEBAUTE_TIEFEN, rolle)) {
    console.error(
      `--tiefe kennt "${rolle}" nicht. Es gibt: ${Object.keys(GEBAUTE_TIEFEN).join(', ')}`,
    );
    process.exit(1);
  }
  const wert = Number(angabe.slice(trenner + 1));
  if (!Number.isInteger(wert) || wert < 0) {
    console.error(`--tiefe ${rolle} braucht eine ganze Zahl ab null`);
    process.exit(1);
  }
  TIEFEN[rolle] = wert;
}

const VERSTELLT = Object.keys(TIEFEN).filter((r) => TIEFEN[r] !== GEBAUTE_TIEFEN[r]);
const VORSCHLAG = { ...GANGARTEN[GANGART], tiefen: TIEFEN };

const SITZE = ACHT_SITZE.slice(0, SITZZAHL);

// ---------------------------------------------------------------------------
// Das Stellungsduell
// ---------------------------------------------------------------------------

/*
 * DASSELBE HEER GEGEN SICH SELBST, nur anders aufgestellt.
 *
 * Der Duell-Modus (`--duell`) beantwortet dieselbe Frage wie der Partielauf
 * darunter, aber am KAMPF statt am Spiel — und das ist keine Doppelung,
 * sondern eine Frage der Empfindlichkeit. Ein Beistand steht nur auf jedem
 * achten Brett; ueber eine ganze Partie hinweg verschwindet seine Stellung
 * hinter Laden, Gold und Verschmelzungen, und 1.500 Partien haben einen
 * Standardfehler von rund 17 Siegen. Hier tragen beide Seiten dasselbe Heer
 * in derselben Sternstufe, es gibt keinen Laden und kein Gold: Jede Abweichung
 * von der Haelfte ist die Aufstellung und sonst nichts.
 *
 * DIE AUFSTELLUNG WIRD HIER NACHGEBILDET und nicht aus bot.ts geholt — aus
 * demselben Grund, aus dem `stelleAuf` in test/turnier.ts es tut: Der Bot
 * stellt SCHRITTWEISE auf, Feld fuer Feld und je nach Bank, und was dabei
 * herauskommt, haengt an seiner Kaufreihenfolge. Gemessen werden soll aber die
 * TABELLE, nicht der Weg dorthin. Die Regel hier ist deshalb die kurze
 * Fassung derselben Vorliebe: Wunschreihe aus der Tabelle, Meuchler an den
 * Rand, alle uebrigen zur Mitte.
 *
 * WER AUF WELCHER SEITE STEHT, ist gleichgueltig: Die Arena ist punktgespiegelt
 * und abstandstreu (arena.ts), und den Erstzieher verteilt die Saat. Jede
 * Paarung laeuft trotzdem ZWEIMAL mit getauschten Seiten — dann steht auch
 * bei einer ungluecklichen Saatfolge kein Rest von Seitenvorteil in der Zahl.
 */

const RAND_ZUERST = (spalten) =>
  [...Array(spalten).keys()].sort(
    (a, b) => Math.min(a, spalten - 1 - a) - Math.min(b, spalten - 1 - b) || a - b,
  );
const MITTE_ZUERST = (spalten) =>
  [...Array(spalten).keys()].sort(
    (a, b) =>
      Math.abs(a - (spalten - 1) / 2) - Math.abs(b - (spalten - 1) / 2) || a - b,
  );

/**
 * Ein Heer nach dieser Tabelle auf eine Bretthaelfte legen — oder null, wenn
 * eine Reihe ueberlaufen wuerde.
 *
 * Ein Ueberlauf wird verworfen und nicht auf die Nachbarreihe verteilt: Sonst
 * unterschieden sich die beiden Seiten nicht nur in der Wunschreihe, sondern
 * auch darin, wie sie mit vollen Reihen umgehen — und gemessen waere dann
 * beides zusammen.
 */
function legeAus(heer, tiefen, reihen, spalten) {
  const brett = new Array(reihen * spalten).fill(null);
  const jeReihe = new Map();
  for (const stueck of heer) {
    const rolle = einheit(stueck.id).rolle;
    const reihe = Math.min(tiefen[rolle], reihen - 1);
    if (!jeReihe.has(reihe)) jeReihe.set(reihe, []);
    jeReihe.get(reihe).push(stueck);
  }
  for (const [reihe, stuecke] of jeReihe) {
    if (stuecke.length > spalten) return null;
    const frei = new Set([...Array(spalten).keys()]);
    // Erst die Meuchler an den Rand, dann der Rest zur Mitte: Andersherum
    // haetten die Meuchler nur noch, was uebrig ist, und stuenden mittig.
    const sortiert = [
      ...stuecke.filter((s) => einheit(s.id).rolle === 'meuchler'),
      ...stuecke.filter((s) => einheit(s.id).rolle !== 'meuchler'),
    ];
    for (const stueck of sortiert) {
      const ordnung =
        einheit(stueck.id).rolle === 'meuchler' ? RAND_ZUERST(spalten) : MITTE_ZUERST(spalten);
      const spalte = ordnung.find((s) => frei.has(s));
      frei.delete(spalte);
      brett[reihe * spalten + spalte] = stueck;
    }
  }
  return brett;
}

/** Ein Heer aus dem Katalog: drei bis sechs Einheiten, so gross wie die echten. */
function ziehHeer(zufall) {
  const groesse = 3 + Math.floor(zufall() * 4);
  const heer = [];
  for (let i = 0; i < groesse; i++) {
    const art = KATALOG[Math.floor(zufall() * KATALOG.length)];
    // Sternstufe 1 bis 3 wie im Spiel; die Stufe ist auf beiden Seiten
    // dieselbe und faellt damit aus dem Vergleich heraus.
    heer.push({ id: art.id, stufe: 1 + Math.floor(zufall() * 3) });
  }
  return heer;
}

function duell() {
  const zufall = baueZufall(`${SAAT_BASIS}-duell`);
  let vorschlag = 0;
  let gebaut = 0;
  let unentschieden = 0;
  let wirksam = 0;
  let verworfen = 0;

  for (let i = 0; i < PARTIEN; i++) {
    const heer = ziehHeer(zufall);
    const alt = legeAus(heer, GEBAUTE_TIEFEN, BRETT_REIHEN, BRETT_SPALTEN);
    const neu = legeAus(heer, TIEFEN, BRETT_REIHEN, BRETT_SPALTEN);
    if (alt === null || neu === null) {
      verworfen += 1;
      continue;
    }
    // Gleich ausgelegte Heere sind Spiegelkaempfe: Sie sagen ueber die Tabelle
    // nichts und wuerden die Quote nur in Richtung 50 % verduennen.
    if (alt.every((f, i) => (f?.id ?? null) === (neu[i]?.id ?? null))) continue;
    wirksam += 1;

    for (const getauscht of [false, true]) {
      const bretter = getauscht ? [alt, neu] : [neu, alt];
      const bericht = simuliereKampf(bretter, `${SAAT_BASIS}-duell-${i}-${getauscht}`);
      const seiteDesVorschlags = getauscht ? 1 : 0;
      if (bericht.sieger === null) unentschieden += 1;
      else if (bericht.sieger === seiteDesVorschlags) vorschlag += 1;
      else gebaut += 1;
    }
  }
  return { vorschlag, gebaut, unentschieden, wirksam, verworfen };
}

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

/**
 * Eine Reihe Partien mit dieser Besetzung. Die Saat haengt allein an Basis und
 * laufender Nummer — deshalb sehen Kontroll- und Versuchslauf dieselben Laeden
 * und dieselben Gegner, und verglichen wird die Entscheidung statt der
 * Stichprobe.
 */
function lauf(besetzung) {
  const siege = SITZE.map(() => 0);
  const reihen = new Map();
  let mitSieger = 0;

  for (let i = 0; i < PARTIEN; i++) {
    const befund = spieleParte(
      `${SAAT_BASIS}-${i}`,
      SITZE,
      besetzung,
      DEFAULT_REGELN,
      STANDARD_REGLER,
    );
    if (befund.sieger !== null) {
      siege[befund.sieger] += 1;
      mitSieger += 1;
    }
    for (const brett of Object.values(befund.letzteBretter)) {
      brett.forEach((k, platz) => {
        if (k === null) return;
        const rolle = einheit(k.id).rolle;
        if (!reihen.has(rolle)) reihen.set(rolle, []);
        const zeile = reihen.get(rolle);
        const reihe = Math.floor(platz / BRETT_SPALTEN);
        zeile[reihe] = (zeile[reihe] ?? 0) + 1;
      });
    }
  }
  return { siege, mitSieger, reihen };
}

function tabelle(reihen) {
  // Immer ALLE Reihen des Bretts, auch die leeren: Genau die leeren sind hier
  // die Auskunft. Eine Tabelle, die nur die belegten zeigt, verschweigt sie.
  const tief = BRETT_REIHEN;
  const kopf = ['Rolle'.padEnd(10)];
  for (let r = 0; r < tief; r++) kopf.push(`Reihe ${r}`.padStart(9));
  kopf.push('Einheiten'.padStart(11));
  console.log('  ' + kopf.join(''));
  for (const rolle of [...reihen.keys()].sort()) {
    const zeile = reihen.get(rolle);
    const summe = zeile.reduce((s, n) => s + (n ?? 0), 0);
    const felder = [rolle.padEnd(10)];
    for (let r = 0; r < tief; r++) {
      felder.push(`${((100 * (zeile[r] ?? 0)) / summe).toFixed(1)} %`.padStart(9));
    }
    felder.push(String(summe).padStart(11));
    console.log('  ' + felder.join(''));
  }
}

const beginn = Date.now();

console.log('');
console.log('Tafelrunde — Aufstellung des Bots');
console.log(
  `${PARTIEN} Partien zu ${SITZE.length}, Gangart ${GANGART}, Saatbasis "${SAAT_BASIS}"`,
);
console.log(
  `Tabelle: ${Object.entries(TIEFEN)
    .map(([r, t]) => `${r}=${t}`)
    .join(' ')}` + (VERSTELLT.length === 0 ? '  (wie gebaut)' : `  — verstellt: ${VERSTELLT.join(', ')}`),
);
console.log('');

if (NUR_VERTEILUNG) {
  const alle = lauf(SITZE.map(() => VORSCHLAG));
  console.log('  Reihenverteilung (alle Sitze mit dieser Tabelle)');
  console.log('');
  tabelle(alle.reihen);
  console.log('');
  console.log(`  ${((Date.now() - beginn) / 1000).toFixed(1)} s`);
  console.log('');
  process.exit(0);
}

if (VERSTELLT.length === 0) {
  console.error('Ohne --tiefe gibt es nichts zu vergleichen. Fuer die reine Tabelle:');
  console.error('  node werkzeug/aufstellung.mjs --verteilung');
  process.exit(1);
}

if (NUR_DUELL) {
  const d = duell();
  const entschieden = d.vorschlag + d.gebaut;
  console.log(`  Stellungsduell: ${d.wirksam} Heere, je zweimal mit getauschten Seiten`);
  console.log('');
  console.log(
    `  Vorschlag : gebaut   ${d.vorschlag} : ${d.gebaut}` +
      (entschieden === 0 ? '' : `   (${((100 * d.vorschlag) / entschieden).toFixed(1)} %)`),
  );
  console.log('');
  console.log(`  Unentschieden: ${d.unentschieden}`);
  console.log(`  Verworfen (Reihe zu voll): ${d.verworfen} von ${PARTIEN} gezogenen Heeren`);
  console.log('');
  console.log(`  ${((Date.now() - beginn) / 1000).toFixed(1)} s`);
  console.log('');
  process.exit(0);
}

const kontrolle = lauf(GANGART);
const versuch = lauf(SITZE.map((_, sitz) => (sitz === 0 ? VORSCHLAG : GANGART)));
const dauer = Date.now() - beginn;

console.log(`  Kontrolllauf (alle wie gebaut)   Sitz 0: ${kontrolle.siege[0]} Siege`);
console.log(`  Versuchslauf (Sitz 0 verstellt)  Sitz 0: ${versuch.siege[0]} Siege`);
const diff = versuch.siege[0] - kontrolle.siege[0];
console.log('');
console.log(`  DIFFERENZ: ${diff > 0 ? '+' : ''}${diff} Siege je ${PARTIEN} Partien`);
console.log('');
console.log(`  Siege je Sitz, Kontrolle: ${kontrolle.siege.join(', ')}`);
console.log(`  Siege je Sitz, Versuch:   ${versuch.siege.join(', ')}`);
console.log(
  `  Partien mit eindeutigem Sieger: ${kontrolle.mitSieger} / ${versuch.mitSieger} von ${PARTIEN}`,
);
console.log('');
console.log('  Reihenverteilung im Versuchslauf (Sitz 0 und die drei Gegner zusammen)');
console.log('');
tabelle(versuch.reihen);
console.log('');
console.log(`  ${(dauer / 1000).toFixed(1)} s`);
console.log('');
