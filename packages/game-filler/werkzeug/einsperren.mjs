/**
 * Filler: Ist das Einsperren unfair — oder nur "nicht in die Pfanne laufen"?
 *
 *     npm run build --workspace @brauweg/game-api
 *     npm run build --workspace @brauweg/game-filler
 *     node packages/game-filler/werkzeug/einsperren.mjs [--build 200] [--extreme 200] [--teil 1,2,3] [--start 0] [--faeden 15]
 *
 * Anlass (Niklas, 06.11.2026): Der Bot mit Wegterm sperrt den Gegner in
 * 66,5 % (Extreme) bzw. 54 % (Build) der Partien ein — Mauern verengen den
 * Weg, ein Farbzug schliesst ihn (MESSUNG-2026-11-06-bot-mauert.md). Die
 * Frage dahinter: Liegt das am Sitz, oder laeuft der Eingesperrte nur
 * sehenden Auges hinein? Drei Teile, alle auf den Saaten von simulation.mjs
 * (`saatHex`, Index i ist dort dieselbe Partie):
 *
 *   1  Bot gegen sich selbst: WER wird eingesperrt (Sitz 0 / Sitz 1), und
 *      wie oft gewinnt jeder Sitz in Partien mit und ohne Einsperren.
 *   2  Ein VORSICHTIGER Spieler (nur hier im Skript) gegen den Bot, jede Saat
 *      auf beiden Sitzen. Wie oft wird er trotzdem eingesperrt, und was
 *      kostet ihn die Vorsicht an Punkten?
 *   3  Gegenprobe: vorsichtig gegen vorsichtig.
 *
 * DER VORSICHTIGE spielt den Zug des Bots (Mauern und Farbe, wie `botZug`
 * sie nacheinander waehlt) — es sei denn, der Gegner koennte ihn danach mit
 * dem, was er im NAECHSTEN Zug darf, einsperren: hoechstens eine Mauer
 * (sofern Vorrat, Pause, Eroeffnung und `moeglicheBarrieren` sie zulassen)
 * plus ein Farbzug. Dann probiert er der Reihe nach: dieselben Mauern mit
 * einer anderen Farbe (beste zuerst), danach ganz ohne Mauer jede Farbe
 * (beste zuerst), und nimmt den ersten sicheren Zug. Gibt es keinen, spielt
 * er doch den Zug des Bots ("ausweglos").
 *
 * Bewusst nur EINE gegnerische Mauer, obwohl Extreme zwei je Zug erlaubt:
 * Mit zweien waeren es je Pruefung rund 150 x 150 x 6 Stellungen, und der
 * Lauf dauerte Tage. Der Vorsichtige sieht die Zweimauer-Falle also nicht —
 * wird er in Extreme trotzdem eingesperrt, steht das in der Zeile
 * "eingesperrt" und ist eine obere Schranke dessen, was Aufpassen nicht
 * verhindert.
 *
 * "EINGESPERRT" heisst wie in simulation.mjs (Abschnitt 2): Das erste Mal,
 * dass kein freies Feld mehr fuer beide erreichbar ist, liegen mindestens
 * zehn freie Felder auf dem Brett, und einer der beiden erreicht davon
 * hoechstens ein Viertel. Dieselbe Schwelle prueft der Vorsichtige — und
 * seit dem 06.11.2026 auch der Bot vor jeder Mauer (`istEingesperrt` in
 * bot.ts, von dort liest sie dieses Skript).
 *
 * Der Vorsichtige entscheidet auf dem WAHREN Zustand. In Build und Extreme
 * liegt das Brett offen, die Sicht enthaelt dasselbe — er sieht also nicht
 * mehr als ein Mensch, der genau hinschaut. Fuer den Bot-Anteil seines Zugs
 * ruft er `botZug` auf der Sicht, wie am Tisch.
 *
 * Aendert weder Regeln noch Bot noch die beiden anderen Skripte.
 *
 * Fuer einen Stand VOR der Daempfung (bot.js ohne `istEingesperrt`) das
 * Skript aus jenem Stand nehmen.
 */

import { existsSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const hier = dirname(fileURLToPath(import.meta.url));
const dist = resolve(hier, '..', 'dist', 'src');
const argv = process.argv.slice(2);
const schalter = (name, vorgabe) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return vorgabe;
  return typeof vorgabe === 'number' ? Number(argv[i + 1]) : argv[i + 1];
};

/** Dieselbe Saatfolge wie simulation.mjs und bot-duell.mjs. */
function saatHex(i) {
  let a = (0x9e3779b9 ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0;
  const wort = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0).toString(16).padStart(8, '0');
  };
  return wort() + wort() + wort() + wort();
}

if (isMainThread) {
  if (!existsSync(resolve(dist, 'partie.js'))) {
    console.error('dist fehlt. Erst bauen:\n  npm run build --workspace @brauweg/game-api\n  npm run build --workspace @brauweg/game-filler');
    process.exit(2);
  }
  const anzahl = { build: schalter('build', 200), extreme: schalter('extreme', 200) };
  const teile = String(schalter('teil', '1,2,3')).split(',').map(Number);
  const start = schalter('start', 0);
  const faeden = schalter('faeden', Math.max(1, os.cpus().length - 1));

  // Ein Auftrag = eine Saat in einem Teil. Teil 2 spielt darin beide Sitze.
  const auftraege = [];
  for (const teil of teile) {
    for (const [variante, n] of Object.entries(anzahl)) {
      for (let i = start; i < start + n; i++) auftraege.push({ teil, variante, i });
    }
  }
  // Die teuren zuerst (Extreme, Teil 2/3), damit am Ende kein Faden allein laeuft.
  auftraege.sort((x, y) => (y.variante === 'extreme') - (x.variante === 'extreme') || (y.teil > 1) - (x.teil > 1));

  const beginn = Date.now();
  const ergebnisse = [];
  let naechster = 0;
  let fertig = 0;
  await Promise.all(
    Array.from({ length: faeden }, () =>
      new Promise((ok, fehler) => {
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { dist } });
        const gib = () => {
          if (naechster >= auftraege.length) return void w.postMessage(null);
          w.postMessage(auftraege[naechster++]);
        };
        w.on('message', (m) => {
          if (m !== 'bereit') {
            ergebnisse.push(m);
            if (++fertig % 50 === 0) {
              process.stderr.write(`  ${fertig}/${auftraege.length} nach ${((Date.now() - beginn) / 1000).toFixed(0)} s\n`);
            }
          }
          gib();
        });
        w.on('error', fehler);
        w.on('exit', ok);
      }),
    ),
  );
  const wand = (Date.now() - beginn) / 1000;

  const pct = (z, n) => (n === 0 ? '–' : `${((100 * z) / n).toFixed(1)} %`);
  const anteil = (z, n) => `${z}/${n} (${pct(z, n)})`;
  const sek = (ms) => `${(ms / 1000).toFixed(0)} s`;
  /** Mittelwert ± Standardfehler (Stichprobenvarianz, n − 1). */
  const mittelSe = (xs) => {
    const n = xs.length;
    const m = xs.reduce((a, x) => a + x, 0) / n;
    const v = n > 1 ? xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1) : 0;
    return `${m.toFixed(2)} ± ${Math.sqrt(v / n).toFixed(2)}`;
  };

  console.log(`# Einsperren — Saaten ${start} bis ${start + Math.max(...Object.values(anzahl)) - 1}, ${faeden} Faeden, Wanduhr ${wand.toFixed(0)} s\n`);

  // Bot-Punkte je Sitz aus Teil 1 — die Vergleichsgroesse fuer "was kostet die Vorsicht".
  const grund = {};

  if (teile.includes(1)) {
    console.log('## 1. Bot gegen Bot: wer wird eingesperrt\n');
    console.log('| Spielart | Partien | eingesperrt | davon Sitz 0 / Sitz 1 | Sieg S0 / S1 / remis (alle) | mit Einsperren: Sieg S0 / S1 | ohne Einsperren: Sieg S0 / S1 / remis | Punkte S0 / S1 | Mauern je Partie (± SE) | Rechenzeit |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const variante of Object.keys(anzahl)) {
      const ps = ergebnisse.filter((r) => r.teil === 1 && r.variante === variante).flatMap((r) => r.partien);
      if (ps.length === 0) continue;
      const n = ps.length;
      const mit = ps.filter((p) => p.eingesperrt !== null);
      const ohne = ps.filter((p) => p.eingesperrt === null);
      const sieg = (xs, s) => xs.filter((p) => p.sieger === s).length;
      const pkt = (s) => ps.reduce((a, p) => a + p.punkte[s], 0) / n;
      grund[variante] = { p0: pkt(0), p1: pkt(1), s0: sieg(ps, 0) / n, s1: sieg(ps, 1) / n };
      console.log(
        `| ${variante} | ${n} | ${pct(mit.length, n)} | ${mit.filter((p) => p.eingesperrt === 0).length} / ${mit.filter((p) => p.eingesperrt === 1).length}` +
          ` | ${pct(sieg(ps, 0), n)} / ${pct(sieg(ps, 1), n)} / ${pct(sieg(ps, null), n)}` +
          ` | ${pct(sieg(mit, 0), mit.length)} / ${pct(sieg(mit, 1), mit.length)}` +
          ` | ${pct(sieg(ohne, 0), ohne.length)} / ${pct(sieg(ohne, 1), ohne.length)} / ${pct(sieg(ohne, null), ohne.length)}` +
          ` | ${pkt(0).toFixed(1)} / ${pkt(1).toFixed(1)} | ${mittelSe(ps.map((p) => p.mauern))} | ${sek(ps.reduce((a, p) => a + p.ms, 0))} |`,
      );
      const eingesperrteGewinnen = mit.filter((p) => p.sieger === p.eingesperrt).length;
      console.log(`|  | davon gewinnt der Eingesperrte | ${eingesperrteGewinnen} von ${mit.length} |  |  |  |  |  |  |  |`);
    }
    console.log('');
  }

  /** "direkt / ohne Warnung / spaeter | Warnzuege" fuer die Partien, in denen ein Vorsichtiger eingesperrt wurde. */
  const fallen = (xs) => {
    const z = (art) => xs.filter((p) => p.falle?.art === art).length;
    const serie = xs.length ? xs.reduce((a, p) => a + (p.falle?.serie ?? 0), 0) / xs.length : 0;
    return `${z('direkt')} / ${z('ohneWarnung')} / ${z('spaeter')} | ${serie.toFixed(2)}`;
  };

  if (teile.includes(2)) {
    console.log('## 2. Vorsichtig gegen Bot (jede Saat auf beiden Sitzen)\n');
    console.log('| Spielart | Partien | V eingesperrt | davon direkt nach ausweglosem Zug / ohne Warnung / spaeter | Warnzuege davor (Mittel) | Bot eingesperrt | V Sieg als S0 | V Sieg als S1 | V Sieg gesamt / remis | Punkte V / Bot | Punkte V als S0 / S1 (Bot dort in Teil 1) | V weicht ab je Partie | ausweglos je Partie | Rechenzeit |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const variante of Object.keys(anzahl)) {
      const ps = ergebnisse.filter((r) => r.teil === 2 && r.variante === variante).flatMap((r) => r.partien);
      if (ps.length === 0) continue;
      const n = ps.length;
      const als = (s) => ps.filter((p) => p.vSitz === s);
      const vSieg = (xs) => xs.filter((p) => p.sieger === p.vSitz).length;
      const remis = ps.filter((p) => p.sieger === null).length;
      const vPkt = (xs) => xs.reduce((a, p) => a + p.punkte[p.vSitz], 0) / Math.max(1, xs.length);
      const bPkt = ps.reduce((a, p) => a + p.punkte[1 - p.vSitz], 0) / n;
      const g = grund[variante];
      const vergleich = g
        ? `${vPkt(als(0)).toFixed(1)} (${g.p0.toFixed(1)}) / ${vPkt(als(1)).toFixed(1)} (${g.p1.toFixed(1)})`
        : `${vPkt(als(0)).toFixed(1)} / ${vPkt(als(1)).toFixed(1)}`;
      console.log(
        `| ${variante} | ${n} | ${anteil(ps.filter((p) => p.eingesperrt === p.vSitz).length, n)} | ${fallen(ps.filter((p) => p.eingesperrt === p.vSitz))} | ${anteil(ps.filter((p) => p.eingesperrt === 1 - p.vSitz).length, n)}` +
          ` | ${pct(vSieg(als(0)), als(0).length)} | ${pct(vSieg(als(1)), als(1).length)} | ${pct(vSieg(ps), n)} / ${pct(remis, n)}` +
          ` | ${vPkt(ps).toFixed(1)} / ${bPkt.toFixed(1)} | ${vergleich}` +
          ` | ${(ps.reduce((a, p) => a + p.abweichungen, 0) / n).toFixed(2)} | ${(ps.reduce((a, p) => a + p.ausweglos, 0) / n).toFixed(2)} | ${sek(ps.reduce((a, p) => a + p.ms, 0))} |`,
      );
    }
    console.log('');
  }

  if (teile.includes(3)) {
    console.log('## 3. Vorsichtig gegen vorsichtig\n');
    console.log('| Spielart | Partien | eingesperrt | davon Sitz 0 / Sitz 1 | davon direkt nach ausweglosem Zug / ohne Warnung / spaeter | Warnzuege davor (Mittel) | Sieg S0 / S1 / remis | Punkte S0 / S1 | weicht ab je Partie | ausweglos je Partie | Rechenzeit |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const variante of Object.keys(anzahl)) {
      const ps = ergebnisse.filter((r) => r.teil === 3 && r.variante === variante).flatMap((r) => r.partien);
      if (ps.length === 0) continue;
      const n = ps.length;
      const mit = ps.filter((p) => p.eingesperrt !== null);
      const sieg = (s) => ps.filter((p) => p.sieger === s).length;
      const pkt = (s) => ps.reduce((a, p) => a + p.punkte[s], 0) / n;
      console.log(
        `| ${variante} | ${n} | ${pct(mit.length, n)} | ${mit.filter((p) => p.eingesperrt === 0).length} / ${mit.filter((p) => p.eingesperrt === 1).length}` +
          ` | ${fallen(mit)} | ${pct(sieg(0), n)} / ${pct(sieg(1), n)} / ${pct(sieg(null), n)} | ${pkt(0).toFixed(1)} / ${pkt(1).toFixed(1)}` +
          ` | ${(ps.reduce((a, p) => a + p.abweichungen, 0) / n).toFixed(2)} | ${(ps.reduce((a, p) => a + p.ausweglos, 0) / n).toFixed(2)} | ${sek(ps.reduce((a, p) => a + p.ms, 0))} |`,
      );
    }
    console.log('');
  }
} else {
  const laden = (datei) => import(pathToFileURL(resolve(workerData.dist, datei)).href);
  const P = await laden('partie.js');
  const R = await laden('regeln.js');
  const S = await laden('sicht.js');
  // Die Einsperr-Schwelle kommt aus dem Bot, der sie seit dem 06.11.2026 auch
  // selbst meidet: Messung und Bot sollen dieselbe Falle meinen.
  const { botZug, istEingesperrt: eingesperrtBei, EINSPERR_TEIL } = await laden('bot.js');
  const { erstellePartie, fuehreAus, gesperrteFarben, moeglicheBarrieren, offeneNachbarn, kante, sieger } = P;

  const freieZahl = (p) => p.besitzer.reduce((a, b) => a + (b === null), 0);

  /** Freie Felder, die s ueber freie Felder und durch keine Mauer erreicht (wie simulation.mjs). */
  function freieMenge(p, s) {
    const { spalten, zeilen } = p.regeln;
    const sperren = new Set(p.barrieren);
    const gesehen = new Set();
    const rand = [];
    for (let platz = 0; platz < p.besitzer.length; platz++) if (p.besitzer[platz] === s) rand.push(platz);
    while (rand.length > 0) {
      const platz = rand.pop();
      for (const n of offeneNachbarn(platz, spalten, zeilen, sperren)) {
        if (p.besitzer[n] !== null || gesehen.has(n)) continue;
        gesehen.add(n);
        rand.push(n);
      }
    }
    return gesehen;
  }

  /** [nur 0, nur 1], sobald kein freies Feld mehr beiden erreichbar ist — sonst null. */
  function getrennt(p) {
    const a = freieMenge(p, 0);
    const b = freieMenge(p, 1);
    for (const x of a) if (b.has(x)) return null;
    return [a.size, b.size];
  }

  /** Dieselbe Schwelle wie "EINGESPERRT" in simulation.mjs: >= 10 frei, einer hat <= 1/4. */
  const istEingesperrt = (g) => g !== null && eingesperrtBei(Math.min(g[0], g[1]), Math.max(g[0], g[1]));

  /**
   * Ist s auf dem Brett r eingesperrt? Mit Abkuerzung: Erreicht s mehr als
   * ein Viertel ALLER freien Felder, kann er es nicht sein — das spart die
   * zweite Flut in fast jeder Stellung.
   */
  function sEingesperrt(r, s) {
    const frei = freieZahl(r);
    if (frei < 10) return false;
    const a = freieMenge(r, s);
    if (a.size * EINSPERR_TEIL > frei) return false;
    const b = freieMenge(r, 1 - s);
    for (const x of a) if (b.has(x)) return false;
    return eingesperrtBei(a.size, b.size);
  }

  const erlaubteFarben = (p) => {
    const gesperrt = new Set(gesperrteFarben(p));
    const raus = [];
    for (let f = 0; f < p.regeln.farben; f++) if (!gesperrt.has(f)) raus.push(f);
    return raus;
  };

  /**
   * Kann der Gegner (in q am Zug) s mit hoechstens einer Mauer plus einem
   * Farbzug einsperren? Die Mauer wird direkt eingetragen statt ueber
   * `fuehreAus`: Das prueft jede Mauer noch einmal gegen alle Kanten, und
   * ob sie erlaubt ist, hat `moeglicheBarrieren` ja schon gesagt.
   */
  function gefaehrdet(q, s) {
    if (q.fertig) return false;
    if (sEingesperrt(q, s)) return true;
    const o = q.dran;
    const farben = erlaubteFarben(q);
    const varianten = [q];
    for (const [a, b] of moeglicheBarrieren(q, o)) {
      varianten.push({ ...q, barrieren: [...q.barrieren, kante(a, b)], mauernDiesenZug: q.mauernDiesenZug + 1 });
    }
    for (const v of varianten) {
      for (const g of farben) {
        const r = fuehreAus(v, o, { typ: 'faerben', farbe: g });
        if (sEingesperrt(r, s)) return true;
      }
    }
    return false;
  }

  /** Wendet eine Folge von Aktionen (Mauern, dann Farbe) fuer s an. */
  const spieleFolge = (p, s, folge) => folge.reduce((t, z) => fuehreAus(t, s, z), p);

  /** Der ganze Zug des Bots: Mauern, wie botZug sie nacheinander will, dann die Farbe. */
  function botFolge(p, s) {
    const folge = [];
    let t = p;
    for (;;) {
      const z = botZug(S.sichtFuer(t, s));
      folge.push(z);
      if (z.typ !== 'barriere') return folge;
      t = fuehreAus(t, s, z);
    }
  }

  /** Farben, beste zuerst (Punkte, die sie jetzt einbringen; Gleichstand: kleinere Nummer). */
  function farbenNachGewinn(t, s) {
    return erlaubteFarben(t)
      .map((f) => ({ f, g: fuehreAus(t, s, { typ: 'faerben', farbe: f }).punkte[s] - t.punkte[s] }))
      .sort((x, y) => y.g - x.g || x.f - y.f)
      .map((x) => ({ typ: 'faerben', farbe: x.f }));
  }

  /** Der vorsichtige Zug: der des Bots, ausser er laesst eine Ein-Mauer-Falle offen. */
  function vorsichtigeFolge(p, s, zaehler) {
    const bot = botFolge(p, s);
    // Schon getrennt: Es gibt nichts mehr zu vermeiden.
    if (getrennt(p) !== null) return bot;
    const mauern = bot.slice(0, -1);
    const kandidaten = [bot];
    const nachMauern = spieleFolge(p, s, mauern);
    for (const z of farbenNachGewinn(nachMauern, s)) kandidaten.push([...mauern, z]);
    if (mauern.length > 0) for (const z of farbenNachGewinn(p, s)) kandidaten.push([z]);
    const gesehen = new Set();
    for (const k of kandidaten) {
      const schluessel = JSON.stringify(k);
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      if (!gefaehrdet(spieleFolge(p, s, k), s)) {
        if (k !== bot) zaehler.abweichungen++;
        zaehler.protokoll.push({ sitz: s, zug: p.zug, art: k === bot ? 'ruhig' : 'ausgewichen' });
        return k;
      }
    }
    zaehler.ausweglos++;
    zaehler.protokoll.push({ sitz: s, zug: p.zug, art: 'ausweglos' });
    return bot;
  }

  /**
   * Wie kam der vorsichtige Sitz t in die Falle, die bei Zugnummer trennZug
   * zuschnappte? Massgeblich ist seine LETZTE Entscheidung davor (Zugnummer
   * z, vor seinem Zug):
   *
   *   direkt       sie war ausweglos, und die Falle schnappte in seinem
   *                eigenen Zug (trennZug = z + 1) oder im Zug des Gegners
   *                gleich danach (z + 2). Genau diese Falle hat seine
   *                Pruefung vorhergesagt — der Gegner hat sie auch gestellt.
   *   ohneWarnung  sie hielt den Zug fuer sicher, und die Falle kam trotzdem
   *                gleich danach: eine Falle, die die Ein-Mauer-Pruefung
   *                nicht sieht (etwa zwei Mauern in Extreme).
   *   spaeter      alles andere (die Trennung kam nicht im naechsten Zug).
   *
   * `serie`: wie viele seiner Entscheidungen unmittelbar davor schon gewarnt
   * hatten (ausgewichen oder ausweglos, die letzte mitgezaehlt) — wie lange er
   * der Falle schon ausgewichen war, bevor sie zuging.
   */
  function falleNach(protokoll, t, trennZug) {
    const meine = protokoll.filter((e) => e.sitz === t && e.zug < trennZug);
    const letzte = meine.at(-1);
    if (!letzte) return { art: 'spaeter', serie: 0 };
    let serie = 0;
    for (let k = meine.length - 1; k >= 0 && meine[k].art !== 'ruhig'; k--) serie++;
    const gleichDanach = trennZug - letzte.zug <= 2;
    if (gleichDanach && letzte.art === 'ausweglos') return { art: 'direkt', serie };
    if (gleichDanach && letzte.art === 'ruhig') return { art: 'ohneWarnung', serie };
    return { art: 'spaeter', serie };
  }

  /** Eine Partie; `vorsichtig[s]` sagt, ob Sitz s vorsichtig spielt. */
  function spiele(variante, i, vorsichtig) {
    const beginn = performance.now();
    let p = erstellePartie({ ...R.DEFAULT_REGELN, variante }, [0, 1], saatHex(i));
    // `protokoll`: jede Entscheidung eines vorsichtigen Sitzes mit Zugnummer
    // VOR seinem Zug — daraus liest `falleNach`, ob die Falle zeitlich auf
    // einen ausweglosen Zug folgte (Zweitleser 07.11.2026: "ausweglos
    // irgendwann in der Partie" belegt keinen Zusammenhang).
    const zaehler = { abweichungen: 0, ausweglos: 0, protokoll: [] };
    let trennZug = null;
    let trennung = null;
    let eingesperrt = null;
    let durchMauer = false;
    let mauern = 0;
    let zuege = 0;
    while (!p.fertig) {
      if (++zuege > 400) throw new Error(`${variante}:${i} endet nicht`);
      const s = p.dran;
      const folge = vorsichtig[s] ? vorsichtigeFolge(p, s, zaehler) : botFolge(p, s);
      for (const z of folge) {
        p = fuehreAus(p, s, z);
        if (z.typ === 'barriere') mauern++;
        // Wie simulation.mjs: nach jeder Aktion, das erste Mal zaehlt.
        if (trennung === null && p.besitzer.some((b) => b === null)) {
          const g = getrennt(p);
          if (g !== null) {
            trennung = g;
            trennZug = p.zug;
            durchMauer = z.typ === 'barriere';
            if (istEingesperrt(g)) eingesperrt = g[0] < g[1] ? 0 : 1;
          }
        }
        if (p.fertig) break;
      }
    }
    const { protokoll, ...zahlen } = zaehler;
    return {
      sieger: sieger(p),
      punkte: [p.punkte[0], p.punkte[1]],
      eingesperrt,
      durchMauer,
      mauern,
      falle: eingesperrt !== null && vorsichtig[eingesperrt] ? falleNach(protokoll, eingesperrt, trennZug) : null,
      ...zahlen,
      ms: performance.now() - beginn,
    };
  }

  parentPort.on('message', (a) => {
    if (a === null) return void process.exit(0);
    let partien;
    if (a.teil === 1) partien = [spiele(a.variante, a.i, [false, false])];
    else if (a.teil === 2) {
      partien = [
        { ...spiele(a.variante, a.i, [true, false]), vSitz: 0 },
        { ...spiele(a.variante, a.i, [false, true]), vSitz: 1 },
      ];
    } else partien = [spiele(a.variante, a.i, [true, true])];
    parentPort.postMessage({ teil: a.teil, variante: a.variante, i: a.i, partien });
  });
  parentPort.postMessage('bereit');
}
