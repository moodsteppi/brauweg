/**
 * Erzeugt den Spielkern des Clients aus der eigenstaendigen Spieldatei.
 *
 *     node packages/game-feldherr/werkzeug/kern-erzeugen.mjs <feldherr.html>
 *
 * Warum maschinell und nicht von Hand gepflegt: Der Kern muss auf beiden
 * Geraeten Zeichen fuer Zeichen gleich rechnen. Zwei getrennt gepflegte
 * Fassungen laufen unweigerlich auseinander, und zwar unbemerkt — man sieht es
 * erst daran, dass beide einen anderen Sieger haben.
 *
 * Was hier dazukommt, ist ausschliesslich die Netzanbindung:
 *
 *   1. **Feste Takte.** Oertlich rechnet der Kern mit der Bildzeit. Im
 *      Netzspiel geht das nicht: Zwei Geraete haben nie dieselbe Bildfolge,
 *      und schon der dritte Nachkommastelle bringt beide Laeufe auseinander.
 *      Gerechnet wird deshalb in festen Schritten von 50 ms.
 *   2. **Eingaben werden gemeldet, nicht ausgefuehrt.** Wer eine Karte legt,
 *      schickt sie als Zug fuer einen kuenftigen Takt. Ausgefuehrt wird sie
 *      auf beiden Geraeten im selben Takt — auch beim Absender.
 *   3. **Pruefsumme.** Alle 40 Takte laesst sich der Zustand vergleichen.
 *      Ohne diese Probe faellt ein Auseinanderlaufen erst am Ende auf.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const quelle = process.argv[2];
const ziel =
  process.argv[3] ?? new URL('../../client/src/minispiele/feldherr/kern.js', import.meta.url).pathname;

if (!quelle) {
  console.error('Aufruf: node kern-erzeugen.mjs <feldherr.html> [ziel.js]');
  process.exit(1);
}

const roh = readFileSync(quelle, 'utf8');

// Der Kopfkommentar der Spieldatei enthaelt selbst die Woerter <style> und
// <body>. Er muss vor jeder Extraktion weg, sonst schneidet man mitten in der
// Dokumentation — genau das ist beim ersten Versuch passiert.
const ohne = roh.replace(/<!--[\s\S]*?-->/, '');

const stil = /<style>([\s\S]*?)<\/style>/.exec(ohne)?.[1];
const huelle = /<body>([\s\S]*?)<script>/.exec(ohne)?.[1];
const skripte = [...ohne.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!stil || !huelle || skripte.length === 0) throw new Error('Aufbau der Quelle unerwartet');

let skript = skripte[skripte.length - 1];

// Der Eigenstart muss weg: Die Schleife darf erst laufen, wenn die Huelle im
// Baum haengt und der Modus feststeht.
if (!skript.includes('requestAnimationFrame(loop);')) {
  throw new Error('Eigenstart nicht gefunden — Quelle geaendert?');
}
skript = skript.replace('requestAnimationFrame(loop);\n', '');

// Haken fuer den Haltebefehl: oertlich sofort, im Netzspiel als Zug.
const haltStelle = `    const g = gruppeVon(e);`;
if (!skript.includes(haltStelle)) throw new Error('Haltebefehl nicht gefunden');
skript = skript.replace(
  haltStelle,
  `    if (NETZ && e.owner === MEIN_SITZ) { NETZ.melde({ art: 'halt', r: e.r, c: e.c }); return; }
${haltStelle}`,
);

const kopf = `/**
 * Feldherr — Spielkern des Clients.
 *
 * MASCHINELL ERZEUGT aus feldherr.html durch
 * packages/game-feldherr/werkzeug/kern-erzeugen.mjs.
 * Nicht von Hand aendern — die Quelle anpassen und neu erzeugen.
 *
 * Der Kern zeichnet auf eine Leinwand und findet seine Teile ueber
 * getElementById. Er kennt kein React und soll es nicht kennen: Er muss auf
 * beiden Geraeten Zeichen fuer Zeichen gleich rechnen. Sein Zufall kommt
 * ausschliesslich aus saat().
 */

export const STIL = ${JSON.stringify(stil)};

export const HUELLE = ${JSON.stringify(huelle)};

/**
 * Startet eine Partie in der bereits eingehaengten Huelle.
 *
 * Oertlich (\`netz\` fehlt) rechnet der Kern wie bisher mit der Bildzeit.
 * Im Netzspiel uebernimmt der Gleichschritt: feste Takte, Eingaben als Zuege.
 */
export function starteFeldherr(optionen = {}) {
  const {
    modus = 'ki',
    stufe = 'normal',
    feld = 'mittel',
    saat: korn,
    aufEnde,
    netz = null,
    sitz = 1,
  } = optionen;

  let laeuft = true;
  const NETZ = netz;
  const MEIN_SITZ = sitz;

  /** Warteschlange: Takt -> Zuege, die in diesem Takt auszufuehren sind. */
  const geplant = new Map();
  let taktZaehler = 0;
  let restMs = 0;
  /** Muss mit TAKT_MS aus @brauweg/game-feldherr uebereinstimmen. */
  const TAKT_MS = 50;

`;

const fuss = `

  // ---- Anbindung ----------------------------------------------------------

  if (typeof korn === 'number') saat(korn);
  feldKey = feld;
  aiLevel = stufe;
  ovMenu.hidden = true;                 // der Bildschirm hat schon gefragt

  /**
   * Im Netzspiel wird nicht sofort gelegt, sondern gemeldet.
   *
   * Auch der Absender wartet: Nur wenn beide Geraete dieselbe Karte im
   * selben Takt legen, bleiben die Laeufe gleich.
   */
  const legeSofort = playCard;
  playCard = function (own, k, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      NETZ.melde({ art: 'karte', karte: k, r, c });
      return;
    }
    legeSofort(own, k, r, c);
  };

  function fuehreAus(zug, wer) {
    if (zug.art === 'karte') legeSofort(wer, zug.karte, zug.r, zug.c);
    else if (zug.art === 'halt') {
      const e = entAt(zug.r, zug.c);
      if (e && canMove(e)) { e.halt = !e.halt; e.nudge = 0.8; }
    } else if (zug.art === 'muenze') {
      coinWahl(zug.wahl);
    }
  }

  startRound(modus === 'ki');

  /**
   * Zustandsprobe.
   *
   * Absichtlich grob und billig: Ressourcen, Objektzahl und die Kernwerte
   * jedes Objekts. Feiner waere teurer, ohne mehr zu finden — was
   * auseinanderlaeuft, laeuft in diesen Zahlen auseinander.
   */
  function pruefsumme() {
    if (!G) return '0';
    let h = 2166136261;
    const misch = (s) => {
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
    };
    misch(Math.round(G.res[0]) + ':' + Math.round(G.res[1]) + ':' + G.ents.length);
    for (const e of G.ents) {
      misch(e.type + e.owner + e.r + ',' + e.c + ':' + e.lvl + ':' + Math.round(e.hp));
    }
    return (h >>> 0).toString(36);
  }

  const alterSchluss = showWin;
  showWin = function () {
    alterSchluss();
    if (aufEnde) {
      aufEnde({
        sieger: G && G.winner,
        gewonnen: modus === 'ki' ? G && G.winner === 1 : null,
        gegenKI: modus === 'ki',
        stufe: modus === 'ki' ? stufe : null,
        dauer: G ? G.t : 0,
        feld,
        takt: taktZaehler,
        pruef: pruefsumme(),
      });
    }
  };

  /**
   * Bildschleife.
   *
   * Oertlich wie gehabt. Im Netzspiel wird die verstrichene Zeit in feste
   * Takte zerlegt; gerechnet wird nur bis zum sicheren Takt, also so weit,
   * wie die Zuege beider Seiten bekannt sind. Wer zurueckfaellt, holt in
   * derselben Schleife auf — bis zu zehn Takte je Bild, damit ein kurzer
   * Aussetzer nicht in Zeitlupe endet.
   */
  let letzte = 0;
  const schleife = (t) => {
    if (!laeuft) return;
    if (!NETZ) { loop(t); requestAnimationFrame(schleife); return; }

    const dt = letzte ? Math.min(500, t - letzte) : 0;
    letzte = t;
    restMs += dt;
    let schritte = 0;
    while (restMs >= TAKT_MS && schritte < 10 && taktZaehler < NETZ.sichererTakt()) {
      restMs -= TAKT_MS;
      taktZaehler += 1;
      schritte += 1;
      const faellig = geplant.get(taktZaehler);
      if (faellig) {
        for (const { zug, sitz: wer } of faellig) fuehreAus(zug, wer);
        geplant.delete(taktZaehler);
      }
      update(TAKT_MS / 1000);
      animate(TAKT_MS / 1000);
    }
    render();
    requestAnimationFrame(schleife);
  };
  requestAnimationFrame(schleife);

  return {
    beenden() {
      laeuft = false;
      paused = true;
    },
    /** Ein Zug vom Server — eigener wie fremder. */
    zugAnnehmen(zug, wer) {
      const takt = Math.max(zug.takt, taktZaehler + 1);
      if (!geplant.has(takt)) geplant.set(takt, []);
      geplant.get(takt).push({ zug, sitz: wer });
    },
    takt: () => taktZaehler,
    pruefsumme,
  };
}
`;

writeFileSync(ziel, kopf + skript + fuss, 'utf8');
console.log('Kern erzeugt:', ziel, Math.round((kopf + skript + fuss).length / 1024), 'KB');
