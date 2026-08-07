/**
 * Gleichlauf-Probe: Live-Lauf gegen Wiedereinstieg (Replay), ohne Browser.
 *
 *     node packages/game-feldherr/werkzeug/gleichlauf-probe.mjs
 *
 * Zwei Sitzungen rechnen dieselbe Partie aus demselben Saatkorn und derselben
 * Zugliste — die eine bekommt die Zuege erst, wenn ihre Zeit gekommen ist
 * (wie ein Geraet, das live dabei war), die andere alle sofort (wie ein
 * Geraet, das neu laedt und nachspielt). Nach jedem 40er-Grenzuebertritt
 * muessen die Pruefsummen uebereinstimmen; die erste Abweichung wird samt
 * Grenze gemeldet.
 *
 * Genau dieses Paar ist im Browser auseinandergelaufen (Partie strittig nach
 * dem Neuladen eines Geraets), waehrend zwei Live-Laeufe und zwei
 * Replay-Laeufe jeweils zusammenblieben. Das Werkzeug macht den Fall
 * reproduzierbar, ohne dass jemand zwei Browser klickt.
 *
 * Der Kern findet seine Teile ueber getElementById und zeichnet auf eine
 * Leinwand — hier bekommt er Attrappen: Elemente, die alles schlucken, und
 * einen Zeichenkontext, der jede Methode ins Leere laufen laesst. Gerechnet
 * wird trotzdem echt: requestAnimationFrame treibt der Treiber von Hand, je
 * Aufruf 50 ms weiter.
 */

import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Browser-Attrappen
// ---------------------------------------------------------------------------

function zeichenKontext() {
  const nichts = () => {};
  const farbverlauf = { addColorStop: nichts };
  return new Proxy(
    {},
    {
      get(ziel, name) {
        if (name === 'createLinearGradient' || name === 'createRadialGradient') {
          return () => farbverlauf;
        }
        if (name === 'measureText') return () => ({ width: 10 });
        if (name === 'canvas') return { width: 800, height: 600 };
        if (typeof name === 'string') return nichts;
        return undefined;
      },
      set() {
        return true;
      },
    },
  );
}

function element(id) {
  const el = {
    id,
    hidden: false,
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    getContext: () => zeichenKontext(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    onclick: null,
  };
  return el;
}

const elemente = new Map();
const holeElement = (id) => {
  if (!elemente.has(id)) elemente.set(id, element(id));
  return elemente.get(id);
};

let rafKette = [];
globalThis.requestAnimationFrame = (fn) => {
  rafKette.push(fn);
  return rafKette.length;
};
globalThis.document = {
  hidden: true, // render() wird uebersprungen — gerechnet wird trotzdem
  getElementById: holeElement,
  createElement: (tag) => element(`neu-${tag}`),
  addEventListener() {},
  removeEventListener() {},
  body: element('body'),
  head: element('head'),
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
// Kein Worker: Der Treiber uebernimmt den Antrieb selbst.
globalThis.Worker = undefined;

// ---------------------------------------------------------------------------
// Treiber
// ---------------------------------------------------------------------------

const kernUrl = pathToFileURL(
  new URL('../../client/src/minispiele/feldherr/kern.js', import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    '$1',
  ),
);
const { starteFeldherr } = await import(kernUrl.href);

const SAAT = 133933090; // das Saatkorn der Partie, die im Browser strittig wurde
const TAKT_MS = 50;

/**
 * Die Zugliste der strittigen Partie, wie sie der Server verwahrt hat —
 * ERWEITERT um Kartenzuege (Uebergabe FELDHERR-BUG-STRITTIG, Abschnitt 4):
 * Die alte Liste (Muenze + zwei Haeuser) fuehrte playCard, mauerNetz,
 * hausStufe-Wechsel, razeEnt und haltBefehl NIE aus — genau dort liegen die
 * Aenderungen vom 7. August. Jetzt deckt sie ab: Mauern nebeneinander UND
 * gestapelt (Verbund-Stufen 1→2→3, Stuetzpunkt am Haupthaus rauf und wieder
 * runter), einen Abriss mitten aus der Gruppe, Halt-Befehle (Stellung),
 * ein Werk an der Front (Kesselexplosion neben Mauern und Truppen), eine
 * Kanone (Belagerung gegen Mauern) und marschierende Truppen beider Seiten.
 * Takte und Felder sind gegen das Gelaende der Saat geprueft (Brett-Dump);
 * jeder Zug ist beim Eintreffen bezahlbar und der Platz frei.
 */
const ZUEGE = [
  { sitz: 0, zug: { takt: 801, art: 'muenze', wahl: 'kopf' } },
  { sitz: 0, zug: { takt: 1526, art: 'haus', r: 3, c: 4 } },
  { sitz: 1, zug: { takt: 2252, art: 'haus', r: 8, c: 3 } },
  { sitz: 0, zug: { takt: 2410, art: 'karte', karte: 'mauer', r: 4, c: 4 } },
  { sitz: 1, zug: { takt: 2415, art: 'karte', karte: 'mauer', r: 7, c: 3 } },
  { sitz: 0, zug: { takt: 2565, art: 'karte', karte: 'mauer', r: 4, c: 5 } },
  { sitz: 1, zug: { takt: 2570, art: 'karte', karte: 'mauer', r: 7, c: 2 } },
  // Stapel auf (4,4): Gewicht 2, Gruppe damit Stufe 3 — Haupthaus-Stuetzpunkt.
  { sitz: 0, zug: { takt: 2715, art: 'karte', karte: 'mauer', r: 4, c: 4 } },
  { sitz: 1, zug: { takt: 2718, art: 'karte', karte: 'schwert', r: 6, c: 4 } },
  { sitz: 1, zug: { takt: 2738, art: 'halt', r: 6, c: 4 } },
  { sitz: 0, zug: { takt: 2835, art: 'karte', karte: 'bogen', r: 2, c: 5 } },
  { sitz: 0, zug: { takt: 2855, art: 'halt', r: 2, c: 5 } },
  // Werk an der Front (Panikzone): faellt im Gefecht und sprengt den Kessel
  // neben Mauern, Truppen und dem eigenen Haus.
  { sitz: 1, zug: { takt: 2905, art: 'karte', karte: 'werk', r: 6, c: 5 } },
  { sitz: 0, zug: { takt: 2960, art: 'karte', karte: 'werk', r: 1, c: 4 } },
  { sitz: 1, zug: { takt: 3060, art: 'karte', karte: 'bogen', r: 10, c: 4 } },
  // Abriss mitten aus der Dreiergruppe: der Rest stuft sich neu ein, das
  // Haupthaus faellt von Stufe 3 zurueck auf 2.
  { sitz: 0, zug: { takt: 3105, art: 'abriss', r: 4, c: 5 } },
  { sitz: 0, zug: { takt: 3210, art: 'karte', karte: 'schwert', r: 5, c: 3 } },
  { sitz: 1, zug: { takt: 3260, art: 'karte', karte: 'kanone', r: 8, c: 5 } },
  { sitz: 0, zug: { takt: 3360, art: 'karte', karte: 'schwert', r: 5, c: 2 } },
  { sitz: 1, zug: { takt: 3460, art: 'karte', karte: 'schwert', r: 6, c: 3 } },
];
const ZIEL_TAKT = 4400;

/**
 * Faehrt eine Sitzung bis zielTakt und sammelt die Pruefsummen aller
 * 40er-Grenzen (aus den eigenen Puls-Meldungen des Kerns).
 *
 * `zustellung(takt)` liefert die Zuege, die bei diesem Takt "ankommen" —
 * live tröpfeln sie herein, beim Replay kommen alle bei 0.
 */
function fahre(name, sitz, zustellung) {
  rafKette = [];
  elemente.clear();
  const proben = new Map();
  let sitzung = null;

  const netz = {
    melde() {},
    puls(daten) {
      if (daten.grenzTakt > 0 && !proben.has(daten.grenzTakt)) {
        proben.set(daten.grenzTakt, daten.pruef);
      }
    },
    aufgabe() {},
    verlassen() {},
  };

  sitzung = starteFeldherr({
    modus: 'netz',
    feld: 'mittel',
    saat: SAAT,
    sitz,
    netz,
    aufEnde() {},
    aufStrittig() {},
  });

  let uhr = 0;
  let letzterPulsTakt = -1;
  // Der Puls des Kerns kommt nach Wanduhr (alle 200 ms) — fuer die Proben
  // jeder Grenze reicht das nicht immer. Deshalb fragen wir die Summen an
  // den Grenzen selbst ab, ueber denselben pruefsumme()-Weg.
  const grenzProben = new Map();

  while (sitzung.takt() < ZIEL_TAKT) {
    // Nicht "genau jetzt faellig", sondern "faellig und noch nicht
    // zugestellt": Im Aufholmodus macht die Schleife mehrere Takte je Bild,
    // und eine punktgenaue Bedingung uebersprraenge Zuege — dann prueft man
    // einen Treiberfehler statt des Kerns.
    for (const eintrag of zustellung(sitzung.takt())) {
      sitzung.zugAnnehmen(eintrag.zug, eintrag.sitz);
    }
    // Die Gegenseite laeuft fluessig mit: knapp voraus, wie ein Geraet mit
    // niedriger Latenz — ohne die Wissensgrenze zu ueberdehnen.
    sitzung.pulsAnnehmen(1 - sitz, { takt: sitzung.takt() + 2, grenzTakt: 0, pruef: '' });

    const kette = rafKette;
    rafKette = [];
    uhr += TAKT_MS;
    for (const fn of kette) fn(uhr);

    const t = sitzung.takt();
    if (t % 40 === 0 && t > 0 && t !== letzterPulsTakt) {
      letzterPulsTakt = t;
      if (!grenzProben.has(t)) grenzProben.set(t, sitzung.pruefsumme());
    }
    if (kette.length === 0) {
      console.error(`${name}: Schleife steht bei Takt ${t} — Abbruch`);
      break;
    }
  }

  sitzung.beenden();
  // Die Puls-Meldungen des Kerns tragen jede Grenze mehrfach — zusammen mit
  // den selbst abgefragten Summen entsteht die vollstaendige Reihe.
  for (const [grenze, summe] of proben) {
    if (!grenzProben.has(grenze)) grenzProben.set(grenze, summe);
  }
  return new Map([...grenzProben.entries()].sort((a, b) => a[0] - b[0]));
}

function tropfZustellung() {
  const offen = [...ZUEGE];
  return (takt) => {
    const jetzt = [];
    for (let i = offen.length - 1; i >= 0; i -= 1) {
      // Zustellung knapp vor dem Ausfuehrungstakt — wie eine Leitung mit
      // niedriger Latenz (Vorlauf + Meldepuffer betragen zwoelf Takte).
      if (offen[i].zug.takt <= takt + 13) jetzt.unshift(offen.splice(i, 1)[0]);
    }
    return jetzt;
  };
}

/**
 * Drei Paarungen: live gegen replay (gleicher Sitz), und Sitz 0 gegen Sitz 1
 * — Sitz 0 rechnet mit gespiegelter Darstellung, und die darf am Zustand
 * NICHTS aendern. Genau diese Paarung ist im Browser strittig geworden.
 */
const live = fahre('live sitz0', 0, tropfZustellung());
const replay = fahre('replay sitz0', 0, (takt) => (takt === 0 ? ZUEGE.slice() : []));
const replaySitz1 = fahre('replay sitz1', 1, (takt) => (takt === 0 ? ZUEGE.slice() : []));

let fehler = false;
function vergleiche(nameA, a, nameB, b) {
  for (const [grenze, summe] of a) {
    const andere = b.get(grenze);
    if (andere !== undefined && andere !== summe) {
      fehler = true;
      console.log(`AUSEINANDER (${nameA} gegen ${nameB}) ab Grenze ${grenze}: ${summe} gegen ${andere}`);
      return;
    }
  }
  console.log(`GLEICH: ${nameA} gegen ${nameB} (${a.size} Grenzproben).`);
}

vergleiche('live sitz0', live, 'replay sitz0', replay);
vergleiche('replay sitz0', replay, 'replay sitz1', replaySitz1);

for (const [grenze, summe] of live) {
  if ((grenze >= 2200 && grenze <= 2360) || grenze >= ZIEL_TAKT - 200) {
    console.log(`  Referenz Grenze ${grenze}: ${summe}`);
  }
}

/**
 * Versatz-Suche: Meldet eine strittige Browser-Sitzung an einer Grenze eine
 * fremde Summe, traegt man sie hier samt Grenze ein (aus der Server-Zugliste
 * bzw. den meldungen). Wurde der letzte Zug einige Takte verschoben
 * ausgefuehrt (Notnagel), reproduziert der passende Versatz die Summe —
 * dann war es ein Protokollproblem, kein Regelfehler. Ohne beobachtete
 * Summe bleibt die Suche aus: Gegen eine Grenze VOR dem letzten Zug liefe
 * jeder Versatz auf die Referenzsumme und meldete lauter Scheintreffer.
 * (Der historische Fall: Grenze 2280, Summe x01aye — mit der alten
 * Drei-Zuege-Liste.)
 */
const VERSATZ_GRENZE = 0;
const VERSATZ_SUMME = '';
if (VERSATZ_SUMME) {
  for (let versatz = -8; versatz <= 12; versatz += 1) {
    if (versatz === 0) continue;
    const verschoben = ZUEGE.map((z, i) =>
      i === ZUEGE.length - 1 ? { ...z, zug: { ...z.zug, takt: z.zug.takt + versatz } } : z,
    );
    const lauf = fahre(`versatz ${versatz}`, 0, (takt) => (takt === 0 ? verschoben : []));
    if (lauf.get(VERSATZ_GRENZE) === VERSATZ_SUMME) {
      console.log(`  TREFFER: Versatz ${versatz} ergibt an ${VERSATZ_GRENZE} genau ${VERSATZ_SUMME}`);
    }
  }
}
process.exit(fehler ? 1 : 0);
