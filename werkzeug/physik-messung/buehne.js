/*
 * Die Bühne des Physik-Vergleichs für Flying Bro — läuft IM BROWSER.
 *
 * Gebündelt wird sie von `messen.mjs`, je Bibliothek einmal, zusammen mit
 * einem Adapter (planck.js, matter.js, rapier.js). Alle drei bekommen
 * dieselbe Szene in Metern, y nach oben, und dieselben drei Proben:
 *
 *   A Ruhe   — 5 s ohne Störung. Ein Stapel, der von selbst wandert oder
 *              umkippt, ist für ein Einsturzspiel unbrauchbar: Der Spieler
 *              sähe Türme fallen, bevor er geschossen hat.
 *   B Schuss — Geschoss in den Turm, 8 s weiter. Zählt, was sich bewegt hat
 *              und wann wieder alles schläft (das Levelende wartet darauf).
 *   C Bild   — dieselbe Szene in Echtzeit mit Zeichnen auf eine 390-px-
 *              Leinwand bei Pixeldichte 3, 6 s lang: Bildrate und Ausreißer.
 *
 * Feste Schrittweite 1/60 s überall — so baut man es später auch, und nur so
 * sind die Zahlen der drei Bibliotheken vergleichbar.
 */

export const SCHRITT = 1 / 60;

/** Holz: dieselben Stoffwerte für alle Blöcke, damit nur die Bibliothek variiert. */
const HOLZ = { dichte: 0.7, reibung: 0.6, abprall: 0.1 };

/**
 * 29 bewegliche Körper plus ein Geschoss = 30. Drei Bauformen, weil sie
 * verschieden schwer zu halten sind: der schlanke Turm (acht Würfel exakt
 * übereinander — die härteste Probe für einen Löser), die Pyramide (viele
 * Kontakte je Körper) und das Gerüst (lange Planke auf schmalen Pfosten —
 * so sehen die Level später aus).
 */
export function szene() {
  const k = [];
  // Boden: 200 m breit, Oberkante bei y = 0. So breit, damit das Geschoss
  // nach dem Treffer nicht über den Rand rollt und ins Leere fällt — das
  // zählte im ersten Lauf als „durchgefallen".
  k.push({ art: 'box', x: 11, y: -0.5, b: 200, h: 1, statisch: true, ...HOLZ });

  // Turm bei x = 9: acht Würfel 0,6 m, ohne Lücke aufeinander.
  for (let i = 0; i < 8; i++) {
    k.push({ art: 'box', x: 9, y: 0.3 + i * 0.6, b: 0.6, h: 0.6, ...HOLZ });
  }

  // Pyramide um x = 13: Reihen 5-4-3-2-1, 2 cm Luft zwischen Nachbarn.
  for (let reihe = 0; reihe < 5; reihe++) {
    const n = 5 - reihe;
    for (let i = 0; i < n; i++) {
      k.push({
        art: 'box',
        x: 13 + (i - (n - 1) / 2) * 0.62,
        y: 0.3 + reihe * 0.6,
        b: 0.6,
        h: 0.6,
        ...HOLZ,
      });
    }
  }

  // Gerüst um x = 17: zwei Geschosse aus je zwei Pfosten und einer Planke.
  for (let stock = 0; stock < 2; stock++) {
    const unten = stock * 1.4;
    k.push({ art: 'box', x: 16.4, y: unten + 0.6, b: 0.2, h: 1.2, ...HOLZ });
    k.push({ art: 'box', x: 17.6, y: unten + 0.6, b: 0.2, h: 1.2, ...HOLZ });
    k.push({ art: 'box', x: 17, y: unten + 1.3, b: 1.6, h: 0.2, ...HOLZ });
  }
  return k;
}

/**
 * Das Geschoss: ein Bro mit 0,3 m Radius, dreimal so dicht wie Holz, aus
 * (1 | 2) mit 20 m/s nach rechts und 5 m/s nach oben — trifft den Turm bei
 * rund 3 m Höhe, also im oberen Drittel, wo er am leichtesten kippt.
 */
export const SCHUSS = { x: 1, y: 2, r: 0.3, dichte: 2.1, reibung: 0.5, abprall: 0.2, vx: 20, vy: 5 };

/** Ab so viel Versatz gilt ein Block als „bewegt" (halbe Kantenlänge). */
const BEWEGT_AB = 0.3;

/** Lage der Bauformen in der Körperliste (ohne Boden), siehe `szene`. */
const BAUFORMEN = { turm: [0, 8], pyramide: [8, 23], geruest: [23, 29] };
/**
 * Blöcke ohne Geschoss. Schlafen und Durchfallen zählen nur die Blöcke: Ein
 * Ball rollt in allen drei Bibliotheken ohne Rolldämpfung ewig weiter und
 * hielte „alles schläft" sonst für immer offen. Im Spiel bekommt der Bro
 * dafür eine Dämpfung (siehe Spezifikation, Levelende).
 */
const BLOECKE = 29;

function quantile(werte, q) {
  if (werte.length === 0) return null;
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function runde(x, stellen = 3) {
  return x == null ? null : Math.round(x * 10 ** stellen) / 10 ** stellen;
}

/** Versatz jedes beweglichen Körpers gegen seine Startlage. */
function versaetze(start, jetzt) {
  return start.map((s, i) => {
    const j = jetzt[i];
    return { weg: Math.hypot(j.x - s.x, j.y - s.y), dreh: Math.abs(j.a - s.a) };
  });
}

async function probeAB(adapter) {
  const teile = szene();
  const welt = adapter.baue(teile);
  const start = welt.lage();
  const zeiten = [];

  // A — Ruhe, 5 s.
  let ruheSchlaf = null;
  for (let i = 0; i < 300; i++) {
    const t0 = performance.now();
    welt.schritt();
    zeiten.push(performance.now() - t0);
    if (ruheSchlaf === null && welt.alleSchlafen(BLOECKE)) ruheSchlaf = (i + 1) * SCHRITT;
  }
  const nachRuhe = versaetze(start, welt.lage());
  const jeBauform = {};
  for (const [name, [von, bis]] of Object.entries(BAUFORMEN)) {
    jeBauform[name] = runde(Math.max(...nachRuhe.slice(von, bis).map((v) => v.weg)), 4);
  }
  const ruhe = {
    maxVersatzM: runde(Math.max(...nachRuhe.map((v) => v.weg)), 4),
    versatzJeBauformM: jeBauform,
    maxDrehungRad: runde(Math.max(...nachRuhe.map((v) => v.dreh)), 4),
    gekippt: nachRuhe.filter((v) => v.weg > BEWEGT_AB).length,
    schlaeftNachS: runde(ruheSchlaf, 2),
  };

  // B — Schuss, 8 s.
  const vorSchuss = welt.lage();
  welt.schuss(SCHUSS);
  let schussSchlaf = null;
  for (let i = 0; i < 480; i++) {
    const t0 = performance.now();
    welt.schritt();
    zeiten.push(performance.now() - t0);
    if (schussSchlaf === null && i > 30 && welt.alleSchlafen(BLOECKE)) schussSchlaf = (i + 1) * SCHRITT;
  }
  const nachSchuss = versaetze(vorSchuss, welt.lage());
  const lageEnde = welt.lage();
  const schuss = {
    bewegt: nachSchuss.filter((v) => v.weg > BEWEGT_AB).length,
    turmBewegt: nachSchuss.slice(0, 8).filter((v) => v.weg > BEWEGT_AB).length,
    schlaeftNachS: runde(schussSchlaf, 2),
    // Liegt ein Block unter dem Boden, ist er durchgefallen (Tunneln).
    durchgefallen: lageEnde.slice(0, BLOECKE).filter((l) => l.y < -0.05).length,
    geschossX: runde(lageEnde[BLOECKE].x, 1),
  };
  welt.zerstoere?.();

  return {
    ruhe,
    schuss,
    schritt: {
      mittelMs: runde(zeiten.reduce((a, b) => a + b, 0) / zeiten.length, 4),
      p95Ms: runde(quantile(zeiten, 0.95), 3),
      maxMs: runde(Math.max(...zeiten), 3),
    },
  };
}

/** Probe C: Echtzeit mit Zeichnen — so sieht es der Spieler. */
function probeC(adapter, sekunden) {
  const leinwand = document.getElementById('leinwand');
  const dpr = window.devicePixelRatio || 1;
  const breite = window.innerWidth;
  const hoehe = window.innerHeight;
  leinwand.width = Math.round(breite * dpr);
  leinwand.height = Math.round(hoehe * dpr);
  leinwand.style.width = `${breite}px`;
  leinwand.style.height = `${hoehe}px`;
  const ctx = leinwand.getContext('2d');
  const massstab = (breite / 22) * dpr; // 22 m Welt über die volle Breite
  const bodenY = hoehe * 0.7 * dpr;

  const teile = szene();
  const welt = adapter.baue(teile);
  const formen = teile.filter((t) => !t.statisch);

  return new Promise((fertig) => {
    const abstaende = [];
    const physikMs = [];
    const arbeitMs = [];
    let zuletzt = null;
    let beginn = null;
    let rest = 0;
    let geschossen = false;

    function bild(jetzt) {
      if (beginn === null) {
        beginn = jetzt;
        zuletzt = jetzt;
      }
      const dt = Math.min(0.1, (jetzt - zuletzt) / 1000);
      if (jetzt !== zuletzt) abstaende.push(jetzt - zuletzt);
      zuletzt = jetzt;

      if (!geschossen && jetzt - beginn > 500) {
        welt.schuss(SCHUSS);
        formen.push({ art: 'kreis', r: SCHUSS.r });
        geschossen = true;
      }
      rest += dt;
      const t0 = performance.now();
      let schritte = 0;
      while (rest >= SCHRITT && schritte < 4) {
        welt.schritt();
        rest -= SCHRITT;
        schritte++;
      }
      physikMs.push(performance.now() - t0);

      ctx.fillStyle = '#9fd3f0';
      ctx.fillRect(0, 0, leinwand.width, leinwand.height);
      ctx.fillStyle = '#6b8e3a';
      ctx.fillRect(0, bodenY, leinwand.width, leinwand.height - bodenY);
      const lage = welt.lage();
      for (let i = 0; i < lage.length; i++) {
        const f = formen[i];
        const l = lage[i];
        ctx.save();
        ctx.translate(l.x * massstab, bodenY - l.y * massstab);
        ctx.rotate(-l.a);
        if (f.art === 'kreis') {
          ctx.fillStyle = '#d9472b';
          ctx.beginPath();
          ctx.arc(0, 0, f.r * massstab, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#b07a3c';
          ctx.strokeStyle = '#5a3a14';
          ctx.lineWidth = dpr;
          ctx.fillRect((-f.b / 2) * massstab, (-f.h / 2) * massstab, f.b * massstab, f.h * massstab);
          ctx.strokeRect((-f.b / 2) * massstab, (-f.h / 2) * massstab, f.b * massstab, f.h * massstab);
        }
        ctx.restore();
      }

      arbeitMs.push(performance.now() - t0);

      if (jetzt - beginn < sekunden * 1000) {
        requestAnimationFrame(bild);
      } else {
        welt.zerstoere?.();
        const dauer = (jetzt - beginn) / 1000;
        fertig({
          bilderJeS: runde(abstaende.length / dauer, 1),
          abstandP95Ms: runde(quantile(abstaende, 0.95), 1),
          abstandMaxMs: runde(Math.max(...abstaende), 1),
          // Über 20 ms heißt: unter 50 Bildern je Sekunde, sichtbares Ruckeln.
          ruckelAnteil: runde(abstaende.filter((a) => a > 20).length / abstaende.length, 3),
          physikJeBildP95Ms: runde(quantile(physikMs, 0.95), 3),
          // Physik plus Zeichnen. Kopfloses rAF ist nicht an 60 Hz gebunden
          // (im ersten Lauf ~143 Bilder/s) — aussagekräftig ist daher, wie viel
          // vom 16,7-ms-Budget eines 60-Hz-Bildschirms die Arbeit verbraucht.
          arbeitJeBildP95Ms: runde(quantile(arbeitMs, 0.95), 3),
          arbeitJeBildMaxMs: runde(Math.max(...arbeitMs), 3),
          leinwandPx: `${leinwand.width}x${leinwand.height}`,
        });
      }
    }
    requestAnimationFrame(bild);
  });
}

export function bereitstellen(adapter) {
  window.messen = async ({ sekunden = 6 } = {}) => {
    // Start: bei rapier das Übersetzen des WASM — die Zeit bis zum ersten Level.
    const t0 = performance.now();
    await adapter.init?.();
    const initMs = runde(performance.now() - t0, 1);
    const ab = await probeAB(adapter);
    const c = await probeC(adapter, sekunden);
    return {
      bibliothek: adapter.name,
      fenster: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
      initMs,
      ...ab,
      bild: c,
    };
  };
  window.bereit = true;
}
