/**
 * Deckel-Probe: Darf die Gegenseite ueber einen Zug hinwegrechnen, den sie
 * noch nicht hat?
 *
 *     node packages/game-feldherr/werkzeug/deckel-probe.mjs
 *
 * Der Fall stammt aus einem echten Mitschnitt vom 10. August 2026
 * (docs/FELDHERR-DIAGNOSE.md): Der Absender bekam sein Server-Echo 400 ms
 * vor dem Gegner, loeste daraufhin seinen Melde-Deckel, meldete den vollen
 * Takt — und der Gegner rechnete ueber den Takt eines Zuges hinaus, den er
 * noch gar nicht hatte. `zugVersatz`, Partie nur durch die Selbstheilung
 * gerettet.
 *
 * Hier wird genau das nachgestellt: Der Zug braucht zum Gegner LAENGER als
 * der Herzschlag, der ihm folgt. Zwei Laeufe:
 *
 *   1. Gegenseite quittiert die Zugzahl (heutiger Kern) — es darf NICHTS
 *      passieren.
 *   2. Gegenseite quittiert nicht (aelterer Kern, Rueckfall auf die alte
 *      Regel) — der Fehler MUSS auftreten.
 *
 * Der zweite Lauf ist der wichtige: Eine Probe, die den Fehler nicht mehr
 * fangen kann, beweist nichts. Faellt er dort aus, ist entweder die
 * Nachstellung kaputt oder die Ursache eine andere.
 */

import { pathToFileURL } from 'node:url';

/** Mit `--spur` schreibt jeder Lauf seinen Gleichschritt Bild fuer Bild mit. */
const SPUR = process.argv.includes('--spur');

const TAKT_MS = 50;
/** Zustellzeiten in Millisekunden — der Zug ist langsam, der Puls schnell. */
const ECHO_MS = 100;   // eigenes Server-Echo an den Absender
const ZUG_MS = 600;    // derselbe Zug an die Gegenseite (Funkstrecke, Handy)
const PULS_MS = 100;   // Herzschlaege in beide Richtungen

// ---------------------------------------------------------------------------
// Browser-Attrappen. Je Sitzung ein eigenes Dokument: Die Kn0epfe der
// Oberflaeche haengen als `onclick` am Element, und zwei Sitzungen im selben
// Dokument wuerden einander die Handler ueberschreiben.
// ---------------------------------------------------------------------------

function zeichenKontext() {
  const nichts = () => {};
  const verlauf = { addColorStop: nichts };
  return new Proxy(
    {},
    {
      get(_ziel, name) {
        if (name === 'createLinearGradient' || name === 'createRadialGradient') {
          return () => verlauf;
        }
        if (name === 'measureText') return () => ({ width: 10 });
        if (name === 'canvas') return { width: 800, height: 600 };
        if (typeof name === 'string') return nichts;
        return undefined;
      },
      set: () => true,
    },
  );
}

function element(id) {
  return {
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
}

function macheDokument() {
  const elemente = new Map();
  const hole = (id) => {
    if (!elemente.has(id)) {
      const el = element(id);
      /* Die Muenzwahl haengt an den KINDERN von #segCoin; ohne sie gibt es
       * keinen Weg, den Kern von aussen einen Zug melden zu lassen. */
      if (id === 'segCoin') {
        for (const w of ['kopf', 'zahl']) {
          const kind = element('coin-' + w);
          kind.dataset.w = w;
          el.children.push(kind);
        }
      }
      elemente.set(id, el);
    }
    return elemente.get(id);
  };
  return {
    elemente,
    dom: {
      hidden: true, // render() faellt aus, gerechnet wird trotzdem
      getElementById: hole,
      createElement: (tag) => element('neu-' + tag),
      addEventListener() {},
      removeEventListener() {},
      body: element('body'),
      head: element('head'),
    },
  };
}

let rafKette = [];
globalThis.requestAnimationFrame = (fn) => rafKette.push(fn);
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.Worker = undefined;

const kernUrl = pathToFileURL(
  new URL('../../client/src/minispiele/feldherr/kern.js', import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    '$1',
  ),
);
const { starteFeldherr } = await import(kernUrl.href);

// ---------------------------------------------------------------------------
// Ein Durchlauf
// ---------------------------------------------------------------------------

/**
 * @param quittung true = die Gegenseite meldet ihre Zugzahl mit (heutiger
 *   Kern), false = sie meldet sie nicht (aelterer Kern; der Absender faellt
 *   auf die alte Regel zurueck und loest seinen Deckel schon beim eigenen Echo).
 */
function lauf(quittung) {
  rafKette = [];
  const SAAT = 138199100; // Saatkorn der Partie aus dem Mitschnitt
  const sitzungen = [];
  const doks = [macheDokument(), macheDokument()];
  const verspaetet = [];
  const befunde = [];
  let uhr = 0;

  const plane = (wann, fn) => verspaetet.push({ wann, fn });

  const netzFuer = (sitz) => ({
    melde(zug) {
      const gegner = 1 - sitz;
      /* Das eigene Echo ist schnell, der Weg zur Gegenseite langsam — genau
       * die Asymmetrie aus dem Mitschnitt (Desktop gegen Handy). */
      plane(uhr + ECHO_MS, () => sitzungen[sitz]?.zugAnnehmen(zug, sitz));
      plane(uhr + ZUG_MS, () => sitzungen[gegner]?.zugAnnehmen(zug, sitz));
    },
    puls(daten) {
      const gegner = 1 - sitz;
      const gesendet = quittung ? daten : { ...daten, zuege: undefined };
      plane(uhr + PULS_MS, () => sitzungen[gegner]?.pulsAnnehmen(sitz, gesendet));
    },
    aufgabe() {},
    verlassen() {},
  });

  for (const sitz of [0, 1]) {
    globalThis.document = doks[sitz].dom;
    sitzungen[sitz] = starteFeldherr({
      modus: 'netz',
      feld: 'mittel',
      saat: SAAT,
      sitz,
      netz: netzFuer(sitz),
      aufEnde() {},
      aufStrittig(probe) {
        befunde.push({ sitz, ...probe });
      },
    });
  }

  let gewaehlt = false;
  for (let bild = 0; bild < 400 && befunde.length === 0; bild += 1) {
    uhr += TAKT_MS;
    for (let i = verspaetet.length - 1; i >= 0; i -= 1) {
      if (verspaetet[i].wann <= uhr) {
        const { fn } = verspaetet.splice(i, 1)[0];
        fn();
      }
    }

    const kette = rafKette;
    rafKette = [];
    for (const fn of kette) fn(uhr);

    if (SPUR) {
      const s = sitzungen.map((x) => x.netzStand());
      console.log(
        `  ${String(uhr).padStart(5)}ms  ` +
          s
            .map(
              (x, i) =>
                `S${i}: takt=${String(x.takt).padStart(3)} gegner=${String(x.gegnerStand).padStart(3)} ` +
                `wissen=${String(x.wissen).padStart(4)} schwebend=[${x.schwebend}] ` +
                `empf=${x.empfangen} quitt=${x.gegnerZuege}/${x.gegnerZaehlt ? 'ja' : 'nein'}`,
            )
            .join('   |   '),
      );
    }

    /* Sobald die Muenze zur Wahl steht, waehlt der zustaendige Sitz — das
     * ist der einzige Befehl, den man dem Kern von aussen entlocken kann,
     * und er laeuft durch denselben melden()-Weg wie jede Karte. */
    if (!gewaehlt) {
      for (const sitz of [0, 1]) {
        const coin = sitzungen[sitz].lesen().zustand?.coin;
        if (coin && coin.stufe === 'wahl' && coin.waehler === sitz) {
          doks[sitz].elemente.get('segCoin')?.children[0].onclick?.();
          gewaehlt = true;
          break;
        }
      }
    }
  }

  const stand = sitzungen.map((s) => s.netzStand());
  for (const s of sitzungen) s.beenden();
  return { befunde, stand, gewaehlt };
}

// ---------------------------------------------------------------------------
// Beide Laeufe
// ---------------------------------------------------------------------------

const mit = lauf(true);
const ohne = lauf(false);

const zeile = (name, e) =>
  `${name}: ${e.gewaehlt ? 'Zug gemeldet' : 'KEIN Zug gemeldet'}, ` +
  `Takte ${e.stand.map((s) => s.takt).join('/')}, ` +
  (e.befunde.length === 0
    ? 'kein Gleichlaufverlust'
    : e.befunde
        .map((b) => `Sitz ${b.sitz}: ${b.grund} bei Takt ${b.takt} (Zug ${b.zug?.takt})`)
        .join('; '));

console.log(zeile('mit Quittung  ', mit));
console.log(zeile('ohne Quittung ', ohne));

let fehler = 0;
if (!mit.gewaehlt || !ohne.gewaehlt) {
  console.error('FEHLER: Es wurde gar kein Zug gemeldet — die Nachstellung greift nicht.');
  fehler += 1;
}
if (ohne.befunde.length === 0) {
  console.error(
    'FEHLER: Ohne Quittung MUSS der Versatz auftreten. Tut er es nicht, faengt ' +
      'diese Probe den Fehler nicht mehr — sie beweist dann nichts.',
  );
  fehler += 1;
}
if (mit.befunde.length > 0) {
  console.error('FEHLER: Mit Quittung darf der Gleichlauf nicht verloren gehen.');
  fehler += 1;
}
console.log(fehler === 0 ? '\nProbe bestanden.' : `\n${fehler} Probe(n) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
