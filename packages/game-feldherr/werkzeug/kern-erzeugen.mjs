/**
 * Erzeugt den Spielkern des Clients aus der eigenstaendigen Spieldatei.
 *
 *     node packages/game-feldherr/werkzeug/kern-erzeugen.mjs [feldherr.html] [ziel.js]
 *
 * Ohne Argumente nimmt es die Quelle neben diesem Paket
 * (packages/game-feldherr/quelle/feldherr.html) und schreibt nach
 * packages/client/src/minispiele/feldherr/kern.js.
 *
 * Warum maschinell und nicht von Hand gepflegt: Der Kern muss auf beiden
 * Geraeten Zeichen fuer Zeichen gleich rechnen. Zwei getrennt gepflegte
 * Fassungen laufen unweigerlich auseinander, und zwar unbemerkt — man sieht es
 * erst daran, dass beide einen anderen Sieger haben.
 *
 * Was hier dazukommt, ist ausschliesslich die Netzanbindung (Gleichschritt):
 *
 *   1. **Feste Takte.** Oertlich rechnet der Kern mit der Bildzeit. Im
 *      Netzspiel geht das nicht: Zwei Geraete haben nie dieselbe Bildfolge,
 *      und schon die dritte Nachkommastelle bringt beide Laeufe auseinander.
 *      Gerechnet wird deshalb in festen Schritten von 50 ms.
 *   2. **Befehle werden gemeldet, nicht ausgefuehrt.** Die Spieldatei buendelt
 *      jede Spielerhandlung in einer Befehlsfunktion (playCard, setzeHaus,
 *      haltBefehl, abrissBefehl, drehBefehl, coinWahl). Genau diese Funktionen
 *      lenkt die Anbindung um: Der eigene Befehl geht als Zug fuer einen
 *      kuenftigen Takt an den Server; ausgefuehrt wird er auf beiden Geraeten
 *      im selben Takt — auch beim Absender.
 *   3. **Wissensgrenze.** Gerechnet wird hoechstens bis zum letzten gemeldeten
 *      Takt der Gegenseite plus Vorlauf. Das ist die einzige Grenze, die ein
 *      Auseinanderlaufen wirklich ausschliesst: Weiter vorn koennte noch ein
 *      Zug eintreffen, der in der eigenen Vergangenheit laege — und
 *      zurueckrechnen kann der Kern nicht. Damit die Grenze auch ohne
 *      Spielerhandlungen wandert, schickt jedes Geraet alle PULS_MS einen
 *      Herzschlag mit seinem Takt.
 *   4. **Zustandsprobe.** Beim Ueberqueren jeder 40er-Taktgrenze merkt sich
 *      der Kern seine Pruefsumme; der Herzschlag traegt die juengste davon.
 *      Weichen die Summen derselben Grenze ab, sind die Laeufe auseinander —
 *      die Partie gilt als strittig und endet, statt minutenlang eine Luege
 *      weiterzuspielen.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// .pathname einer file-URL beginnt unter Windows mit /C:/ und fuehrt in einen
// Lesefehler — fileURLToPath liefert auf jeder Plattform einen echten Pfad.
const quelle =
  process.argv[2] ?? fileURLToPath(new URL('../quelle/feldherr.html', import.meta.url));
const ziel =
  process.argv[3] ??
  fileURLToPath(new URL('../../client/src/minispiele/feldherr/kern.js', import.meta.url));

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

// Der Eigenstart muss weg — und die Selbst-Fortpflanzung in loop() ebenso:
// Eingebettet treibt die Anbindung loop je Bild; eine sich selbst
// fortpflanzende loop liefe doppelt und kennte kein Sitzungsende. Es sind
// GENAU zwei Fundstellen (in loop und am Skriptende). Ein einzelnes
// replace() traf frueher nur die erste — der Eigenstart blieb drin und
// feuerte je Sitzung EIN zusaetzliches Bildzeit-update mit geraetseigenem
// dt: eine winzige, je Geraet verschiedene Zustandsverschiebung, die
// Partien "manchmal" strittig machte. Der Headless-Pruefstand fand sie
// nicht, denn dort war der Zusatzschritt deterministisch gleich.
const loopStarts = skript.split('requestAnimationFrame(loop);').length - 1;
if (loopStarts !== 2) {
  throw new Error(`Erwarte genau 2 loop-Anstoesse, gefunden: ${loopStarts} — Quelle geaendert?`);
}
skript = skript.split('requestAnimationFrame(loop);').join('');

// Die Anbindung haengt sich an die Befehlsfunktionen der Quelle. Fehlt eine,
// lieber sofort abbrechen als einen halben Kern liefern, der im Netz stumm
// auseinanderlaeuft.
for (const anker of [
  'function drehBefehl(',
  'function setzeHaus(',
  'function abrissBefehl(',
  'function haltBefehl(',
  'function playCard(',
  'function coinWahl(',
  'let darfBedienen',
  'let ueberKopf',
  'let SPIEGEL',
  'function coinTick(',
  'function horcherAbhaengen(',
]) {
  if (!skript.includes(anker)) throw new Error(`Befehlsfunktion fehlt in der Quelle: ${anker}`);
}

const kopf = `/**
 * Feldherr — Spielkern des Clients.
 *
 * MASCHINELL ERZEUGT aus packages/game-feldherr/quelle/feldherr.html durch
 * packages/game-feldherr/werkzeug/kern-erzeugen.mjs.
 * Nicht von Hand aendern — die Quelle anpassen und neu erzeugen.
 *
 * Der Kern zeichnet auf eine Leinwand und findet seine Teile ueber
 * getElementById. Er kennt kein React und soll es nicht kennen: Er muss auf
 * beiden Geraeten Zeichen fuer Zeichen gleich rechnen. Sein Spielzufall kommt
 * ausschliesslich aus saat(); alles Sichtbare ohne Spielwirkung zieht aus
 * deko().
 */

export const STIL = ${JSON.stringify(stil)};

export const HUELLE = ${JSON.stringify(huelle)};

/**
 * Startet eine Partie in der bereits eingehaengten Huelle.
 *
 * Oertlich (\`netz\` fehlt) rechnet der Kern wie bisher mit der Bildzeit.
 * Im Netzspiel uebernimmt der Gleichschritt: feste Takte, Befehle als Zuege.
 */
export function starteFeldherr(optionen = {}) {
  const {
    modus = 'ki',
    stufe = 'normal',
    feld = 'mittel',
    saat: korn,
    aufEnde,
    aufStrittig,
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
  /** Muessen mit TAKT_MS und VORLAUF_TAKTE aus @brauweg/game-feldherr uebereinstimmen. */
  const TAKT_MS = 50;
  const VORLAUF = 6;
  /**
   * Sicherheitsabstand beim Einplanen eigener Zuege, zusaetzlich zum Vorlauf.
   *
   * Der gemeldete Gegnerstand hinkt dem echten um bis zu einen Pulsabstand
   * plus Leitungszeit hinterher. Wer nur den Vorlauf draufschlaegt, plant
   * seinen Zug damit gelegentlich fuer einen Takt, den die Gegenseite beim
   * Eintreffen schon gerechnet hat — deren Notnagel verschiebt ihn dann
   * still, und die Partie laeuft unbemerkt auseinander, bis die
   * Zustandsprobe sie fuer strittig erklaert. Genau so ist ein Haus-Zug
   * nach einem Tabwechsel zerbrochen. Zwoelf Takte statt sechs kosten eine
   * knappe Drittelsekunde Reaktionszeit und kaufen dafuer Gleichlauf.
   */
  const MELDE_PUFFER = 6;
  /** Herzschlag-Abstand nach Wanduhr. Deutlich unter VORLAUF * TAKT_MS, sonst
   *  stockt die Gegenseite zwischen zwei Pulsen. */
  const PULS_MS = 200;
  /** Abstand der Zustandsproben in Takten. */
  const PROBE_TAKTE = 40;

  /**
   * Letzter gemeldeter Takt je Gegensitz. Daraus entsteht die Wissensgrenze:
   * Die Gegenseite plant Zuege fruehestens fuer ihren Takt plus Vorlauf ein —
   * bis dorthin (ausschliesslich) ist die eigene Rechnung sicher.
   */
  const gegnerStand = { 0: 0, 1: 0 };
  /** Eigene Pruefsummen an den 40er-Grenzen, fuer den Abgleich. */
  const proben = new Map();
  /** Gemeldete Summen der Gegenseite, bis die eigene Grenze erreicht ist. */
  const fremdeProben = new Map();
  let strittigGemeldet = false;

  /**
   * Takt fuer den naechsten eigenen Zug. Streng aufsteigend, denn der Server
   * lehnt zwei Zuege desselben Sitzes im selben Takt ab; und nie hinter dem
   * Gegnerstand, sonst laege der Zug beim Aufholen in dessen Vergangenheit.
   */
  let letzterMeldeTakt = 0;
  function planTakt() {
    let basis = taktZaehler;
    for (const s of [0, 1]) if (s !== MEIN_SITZ) basis = Math.max(basis, gegnerStand[s]);
    const t = Math.max(basis + VORLAUF + MELDE_PUFFER, letzterMeldeTakt + 1);
    letzterMeldeTakt = t;
    return t;
  }

`;

const fuss = `

  // ---- Anbindung ----------------------------------------------------------

  if (typeof korn === 'number') saat(korn);
  feldKey = feld;
  aiLevel = stufe;
  ovMenu.hidden = true;                 // der Bildschirm hat schon gefragt

  /**
   * Im Netzspiel wird nicht ausgefuehrt, sondern gemeldet — auch beim
   * Absender. Nur wenn beide Geraete denselben Befehl im selben Takt
   * ausfuehren, bleiben die Laeufe gleich. Die *Sofort-Fassungen fuehren aus;
   * sie gehoeren fuehreAus und niemandem sonst.
   */
  const legeSofort = playCard;
  playCard = function (own, k, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      NETZ.melde({ art: 'karte', karte: k, r, c, takt: planTakt() });
      return;
    }
    legeSofort(own, k, r, c);
  };

  const hausSofort = setzeHaus;
  setzeHaus = function (own, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      NETZ.melde({ art: 'haus', r, c, takt: planTakt() });
      return;
    }
    hausSofort(own, r, c);
  };

  const haltSofort = haltBefehl;
  haltBefehl = function (own, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      NETZ.melde({ art: 'halt', r, c, takt: planTakt() });
      return;
    }
    haltSofort(own, r, c);
  };

  const abrissSofort = abrissBefehl;
  abrissBefehl = function (own, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      NETZ.melde({ art: 'abriss', r, c, takt: planTakt() });
      return;
    }
    abrissSofort(own, r, c);
  };

  const drehSofort = drehBefehl;
  drehBefehl = function (own) {
    if (NETZ && own === MEIN_SITZ) {
      NETZ.melde({ art: 'drehen', takt: planTakt() });
      return;
    }
    drehSofort(own);
  };

  /**
   * Muenzwurf: Die Wahl verbraucht Spielzufall (Ergebniswurf) und MUSS deshalb
   * auf beiden Geraeten im selben Takt fallen. Das Overlay schliesst sofort —
   * die Wahl gilt, sobald der Takt sie erreicht.
   */
  const wahlSofort = coinWahl;
  coinWahl = function (w) {
    if (NETZ && G && G.coin && G.coin.stufe === 'wahl' && G.coin.waehler === MEIN_SITZ) {
      NETZ.melde({ art: 'muenze', wahl: w, takt: planTakt() });
      coinAus();
      return;
    }
    wahlSofort(w);
  };

  function fuehreAus(zug, wer) {
    if (zug.art === 'karte') legeSofort(wer, zug.karte, zug.r, zug.c);
    else if (zug.art === 'haus') hausSofort(wer, zug.r, zug.c);
    else if (zug.art === 'halt') haltSofort(wer, zug.r, zug.c);
    else if (zug.art === 'abriss') abrissSofort(wer, zug.r, zug.c);
    else if (zug.art === 'drehen') { drehSofort(wer); }
    else if (zug.art === 'muenze') wahlSofort(zug.wahl);
  }

  if (NETZ) {
    /**
     * Im Netz darf nur der eigene Sitz bedient werden. Ohne diese Sperre
     * liesse sich die Karte des Gegners ziehen — oertlich ausgefuehrt, dem
     * anderen Geraet nie gemeldet, und beide rechneten verschiedene Partien.
     */
    darfBedienen = (own) => own === MEIN_SITZ;
    /** Niemand sitzt gegenueber — kopfstehende Hinweise gibt es nur am geteilten Geraet. */
    ueberKopf = () => false;

    /**
     * Sitz 0 bekommt das Brett gespiegelt: Jeder verteidigt unten. Muss vor
     * startRound stehen, denn resize und bakeStatic backen die Buehne mit
     * der Spiegelung; die Klasse tauscht zusaetzlich die Kartenleisten.
     */
    if (MEIN_SITZ === 0) {
      SPIEGEL = true;
      const app = document.getElementById('app');
      if (app) app.classList.add('gespiegelt');
    }

    /**
     * Pause gibt es im Netz nicht: update() stuende still, waehrend der Takt
     * weiterlaeuft, und das Geraet ueberspraenge Rechenschritte, die die
     * Gegenseite ausfuehrt. Das Menue oeffnet nur noch das Overlay.
     */
    on('menuBtn', () => { if (phase !== 'menu' && phase !== 'over') ovPause.hidden = false; });
    on('bResume', () => { ovPause.hidden = true; });
    on('bQuit', () => { ovPause.hidden = true; if (NETZ.aufgabe) NETZ.aufgabe(); });
    /**
     * Der Tisch ist nach der Partie zu — eine neue Runde gibt es hier nicht.
     * display statt hidden: Die Regel .btn{display:block} des Spielstils
     * schlaegt das UA-Stylesheet fuer [hidden], der Knopf bliebe sichtbar.
     */
    const nochmal = document.getElementById('bAgain');
    if (nochmal) nochmal.style.display = 'none';
    on('bMenu2', () => { if (NETZ.verlassen) NETZ.verlassen(); });
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

  /**
   * Probenvergleich an einer 40er-Grenze. Beide Seiten melden ihre Summe mit
   * dem Herzschlag; stimmen sie an derselben Grenze nicht ueberein, sind die
   * Laeufe auseinander. Dann ist jede weitere Minute gespielte Luege —
   * die Partie endet sofort als strittig, auf beiden Geraeten.
   */
  function pruefeProbe(grenze) {
    if (strittigGemeldet) return;
    const eigene = proben.get(grenze);
    const fremde = fremdeProben.get(grenze);
    if (eigene === undefined || fremde === undefined || eigene === fremde) return;
    strittigGemeldet = true;
    laeuft = false;
    if (aufStrittig) aufStrittig({ takt: grenze, pruef: eigene });
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

  proben.set(0, pruefsumme());

  /**
   * Bildschleife.
   *
   * Oertlich wie gehabt. Im Netzspiel wird die verstrichene Zeit in feste
   * Takte zerlegt, gerechnet aber hoechstens bis zur Wissensgrenze: dem
   * letzten gemeldeten Takt der Gegenseite plus Vorlauf. Ein Rueckstand
   * (Neuladen, Tab im Hintergrund) wird ohne Uhr aufgeholt, bis zu zehn
   * Takte je Bild — die Uhr kaeme nie hinterher, denn ihr Guthaben ist auf
   * zwei Takte gedeckelt, damit ein Aussetzer die Partie nicht beschleunigt.
   */
  let letzte = 0;
  let letzterPuls = 0;
  /**
   * Nie mehr als eine Bildanforderung offen halten: Im verdeckten Tab feuert
   * requestAnimationFrame nicht, sammelt Anforderungen aber — beim
   * Sichtbarwerden kaeme sonst eine ganze Salve auf einmal.
   */
  let bildOffen = false;
  const naechstesBild = () => {
    if (bildOffen) return;
    bildOffen = true;
    requestAnimationFrame((t) => {
      bildOffen = false;
      schleife(t);
    });
  };
  const schleife = (t) => {
    if (!laeuft) return;
    if (!NETZ) { loop(t); naechstesBild(); return; }

    const dt = letzte ? Math.min(500, t - letzte) : 0;
    letzte = t;
    restMs = Math.min(restMs + dt, TAKT_MS * 2);

    // Herzschlag nach Wanduhr, nicht nach Takt: Auch ein Geraet, das an der
    // Wissensgrenze wartet, muss sich melden — sonst warten am Ende beide.
    if (t - letzterPuls >= PULS_MS) {
      letzterPuls = t;
      let grenze = Math.floor(taktZaehler / PROBE_TAKTE) * PROBE_TAKTE;
      while (grenze > 0 && !proben.has(grenze)) grenze -= PROBE_TAKTE;
      NETZ.puls({ takt: taktZaehler, grenzTakt: grenze, pruef: proben.get(grenze) ?? '0' });
    }

    let wissen = Infinity;
    let ziel = Infinity;
    for (const s of [0, 1]) {
      if (s === MEIN_SITZ) continue;
      wissen = Math.min(wissen, gegnerStand[s] + VORLAUF - 1);
      ziel = Math.min(ziel, gegnerStand[s]);
    }

    let schritte = 0;
    while (schritte < 10 && taktZaehler < wissen && laeuft) {
      if (taktZaehler < ziel) {
        // Rueckstand: aufholen, ohne die Uhr zu fragen.
      } else if (restMs >= TAKT_MS) {
        restMs -= TAKT_MS;
      } else break;
      taktZaehler += 1;
      schritte += 1;
      const faellig = geplant.get(taktZaehler);
      if (faellig) {
        for (const { zug, sitz: wer } of faellig) fuehreAus(zug, wer);
        geplant.delete(taktZaehler);
      }
      if (phase === 'coin') coinTick(TAKT_MS / 1000);
      update(TAKT_MS / 1000);
      animate(TAKT_MS / 1000);
      if (taktZaehler % PROBE_TAKTE === 0) {
        proben.set(taktZaehler, pruefsumme());
        proben.delete(taktZaehler - PROBE_TAKTE * 12);
        pruefeProbe(taktZaehler);
      }
    }
    if (!document.hidden) render();
    naechstesBild();
  };
  naechstesBild();

  /**
   * Antrieb fuer den verdeckten Tab.
   *
   * Dort feuert requestAnimationFrame gar nicht und setInterval nur einmal
   * je Sekunde — der Kern staende still, wuerde nicht mehr pulsen, und die
   * Partie froere auf BEIDEN Geraeten ein. Am Handy passiert genau das bei
   * jedem kurzen Blick woandershin. Timer in einem Web Worker drosselt der
   * Browser nicht; seine Nachrichten treiben die Schleife weiter, solange
   * der Tab verdeckt ist. Gezeichnet wird dabei nichts.
   */
  let werker = null;
  if (NETZ && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const quelle = new Blob(['setInterval(() => postMessage(0), ' + TAKT_MS + ');'], {
        type: 'text/javascript',
      });
      werker = new Worker(URL.createObjectURL(quelle));
      werker.onmessage = () => {
        if (laeuft && document.hidden) schleife(performance.now());
      };
    } catch {
      werker = null;   // strenge CSP: dann friert der verdeckte Tab wie zuvor
    }
  }

  return {
    beenden() {
      laeuft = false;
      paused = true;
      if (werker) werker.terminate();
      // Die Fenster-Horcher der Spieldatei muessen mit der Sitzung sterben:
      // Ein zurueckgebliebenes resize griff nach dem Verlassen auf die
      // abgeraeumte Buehne, und die Fehlerbox der Spieldatei stand im Hub.
      horcherAbhaengen();
      const box = document.getElementById('errbox');
      if (box) box.remove();
    },
    /** Ein Zug vom Server — eigener wie fremder. */
    zugAnnehmen(zug, wer) {
      // Aus einem fremden Zug wird BEWUSST kein Gegnerstand abgeleitet.
      // Geplant wird er bei max(eigener Takt, Gegnerstand) plus Vorlauf —
      // zug.takt minus Vorlauf ist also KEINE Untergrenze der Gegnerposition,
      // sondern oft eine Ueberschaetzung. Die hat auf Produktion einen
      // Teufelskreis gedreht: Beide Geraete "holten" auf den jeweils
      // ueberschaetzten Stand des anderen auf, die Partie rannte der
      // Echtzeit davon (Ressourcen schneller als die angezeigte Rate), der
      // Dauersprint mit zehn Takten je Bild ruckelte, und am Ende kamen
      // Zuege zu spaet an und die Partie wurde strittig. Den Gegnerstand
      // kennen allein die Herzschlaege — die melden den echten Taktzaehler.
      //
      // Notnagel: Ein Zug fuer einen schon gerechneten Takt duerfte dank
      // Wissensgrenze und Meldepuffer nie eintreffen. Faellt er doch, wird er
      // verspaetet ausgefuehrt und die Zustandsprobe deckt die Abweichung in
      // Sekunden auf — aber laut, nicht still: Die Warnung nennt die Ursache,
      // die im Strittig-Banner sonst unsichtbar bliebe.
      const takt = Math.max(zug.takt, taktZaehler + 1);
      if (takt !== zug.takt) {
        console.warn(
          'feldherr: Zug fuer Takt ' + zug.takt + ' kam erst bei ' + taktZaehler +
            ' an — verschoben ausgefuehrt, die Laeufe gehen auseinander.',
        );
      }
      if (!geplant.has(takt)) geplant.set(takt, []);
      geplant.get(takt).push({ zug, sitz: wer });
    },
    /** Herzschlag der Gegenseite: Takt und juengste Zustandsprobe. */
    pulsAnnehmen(wer, daten) {
      if (wer === MEIN_SITZ || (wer !== 0 && wer !== 1)) return;
      gegnerStand[wer] = Math.max(gegnerStand[wer], daten.takt);
      // Auch die Probe an Grenze 0 vergleichen: Sie entsteht direkt nach dem
      // Rundenstart und entlarvt ein falsches Saatkorn schon nach 200 ms
      // statt erst am Ende der Partie.
      if (daten.pruef) {
        fremdeProben.set(daten.grenzTakt, daten.pruef);
        pruefeProbe(daten.grenzTakt);
      }
    },
    takt: () => taktZaehler,
    pruefsumme,
  };
}
`;

writeFileSync(ziel, kopf + skript + fuss, 'utf8');
console.log('Kern erzeugt:', ziel, Math.round((kopf + skript + fuss).length / 1024), 'KB');
