/**
 * Rechnet die Fingerabdruecke aus test/eroeffnung-aufgeben.test.ts
 * ("Wertung ohne Aufgabe unveraendert") und test/extreme-gross.test.ts
 * (Build-Endstaende) fuer einen BELIEBIGEN gebauten Stand nach — in allen
 * drei Schichten: echter Bot, ohne Mauern (Bot faerbt nur), Baumeister
 * (jede angebotene Mauer).
 *
 * Warum es das gibt: Die Tests vergleichen nur gegen festgeschriebene Werte.
 * Dass die Schicht "ohne Mauern" auf `staging` dieselben Werte liefert wie
 * auf dem Zweig — die Aussage, auf der die Trennung von Regelfix und
 * Bot-Umbau ruht —, laesst sich aus dem Diff allein nicht sehen
 * (Zweitleser, 06.11.2026). Mit diesem Skript kann sie jeder nachrechnen:
 *
 *   git worktree add --detach ../pruef-staging origin/staging
 *   (dort npm ci, dann npm run build im Wurzelverzeichnis)
 *   node werkzeug/abdruck-schichten.mjs ../pruef-staging/packages/game-filler/dist
 *   node werkzeug/abdruck-schichten.mjs ./dist
 *
 * Die Zeilen "ohne-mauern" muessen in beiden Ausgaben gleich sein.
 *
 * Aufruf: node werkzeug/abdruck-schichten.mjs <dist-ordner von game-filler>
 */
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = process.argv[2];
if (!dist) {
  console.error('Aufruf: node werkzeug/abdruck-schichten.mjs <dist-ordner von game-filler>');
  process.exit(2);
}
const lade = (datei) => import(pathToFileURL(resolve(dist, 'src', datei)).href);
const { botZug } = await lade('bot.js');
const P = await lade('partie.js');
const { DEFAULT_REGELN } = await lade('regeln.js');
const { sichtFuer } = await lade('sicht.js');

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const SAATEN = ['c0ffee1234567890abcdef0123456789', 1, 2, 42];

const nurFarbe = (p) => {
  const { barrierenMoeglich: _weg, ...sicht } = sichtFuer(p, p.dran);
  return botZug(sicht);
};
const WAHL = {
  'echter-bot': (p) => botZug(sichtFuer(p, p.dran)),
  'ohne-mauern': nurFarbe,
  baumeister: (p) => {
    const angebot = P.moeglicheBarrieren(p, p.dran);
    return angebot.length > 0 ? { typ: 'barriere', von: angebot[0][0], nach: angebot[0][1] } : nurFarbe(p);
  },
};

const wertung = (q) => ({ platz: P.platzierungen(q), sieger: P.sieger(q) });

for (const [schicht, wahl] of Object.entries(WAHL)) {
  // eroeffnung-aufgeben.test.ts: Extreme ohne Aufbau-Tabelle, wie dort.
  for (const variante of ['build', 'extreme']) {
    for (const saat of SAATEN) {
      const { aufbauJeSpielart: _weg, ...regeln } = { ...DEFAULT_REGELN, variante };
      let p = P.erstellePartie(regeln, [0, 1], saat);
      let mitte = null;
      let n = 0;
      while (!p.fertig && n++ < 600) {
        if (p.zug === 8 && !mitte) mitte = p;
        p = P.fuehreAus(p, p.dran, wahl(p));
      }
      const gestellt = [{ 0: 9, 1: 9 }, { 0: 20, 1: 3 }, { 0: 3, 1: 20 }].map((punkte) =>
        wertung({ ...mitte, punkte, fertig: true }),
      );
      const abdruck = hash({ ende: wertung(p), gestellt, laufend: wertung(mitte), verlassen: wertung({ ...p, leftSeats: [1] }) });
      console.log(`${schicht.padEnd(11)} eroeffnung   ${variante}/${saat} ${abdruck}`);
    }
  }
  // extreme-gross.test.ts: Build-Endstand, mit Aufbau-Tabelle.
  for (const saat of SAATEN) {
    let p = P.erstellePartie({ ...DEFAULT_REGELN, variante: 'build' }, [0, 1], saat);
    let n = 0;
    while (!p.fertig && n++ < 400) p = P.fuehreAus(p, p.dran, wahl(p));
    const kern = {
      regeln: p.regeln, feld: p.feld, grau: p.grau, besitzer: p.besitzer, farbe: p.farbe,
      punkte: p.punkte, dran: p.dran, zug: p.zug, fertig: p.fertig, barrieren: p.barrieren,
      barrierenUebrig: p.barrierenUebrig, sterne: p.sterne,
    };
    console.log(`${schicht.padEnd(11)} gross-ende   build/${saat} ${hash(kern)}`);
  }
}
