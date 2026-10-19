#!/usr/bin/env node
/**
 * Kurze Bildschirmaufnahmen (Clips) als Rohmaterial fuer Werbevideos, gegen staging.
 *
 *   cd werkzeug/store
 *   npm ci
 *   npx playwright install chromium ffmpeg   # einmal je Rechner
 *   node clips.mjs --ziel <ordner>           # alle Szenen
 *
 * Weitere Schalter:
 *   --szene <name>   nur eine Szene (Teilwort genuegt: doppelkopf, skat, partykiste, auswahl)
 *   --basis <url>    Server, gegen den gespielt wird (Vorgabe: staging)
 *   --sichtbar       Browserfenster zeigen
 *
 * Technik wie in screenshots.mjs (App-Modus, App-Herkunft, frische Gastkonten
 * mit Vogelnamen, alle Mitspieler Bots, Umleitung Produktion → staging) —
 * das Warum steht dort im Kopf. Die Bausteine sind hierher ABGESCHRIEBEN,
 * nicht importiert: screenshots.mjs liest beim Laden seine Schalter und
 * startet sofort `main()`, ein Import wuerde also einen Screenshot-Lauf
 * ausloesen. Wer die Umleitung oder die App-Herkunft dort aendert, aendert
 * sie hier mit.
 *
 * Aufgenommen wird mit `page.screencast` (Playwright ≥ 1.59), nicht mit dem
 * `recordVideo` des Kontexts: Der Kontext nimmt alles von der Anmeldung bis
 * zum Schliessen in EINE Datei auf. Mit dem Screencast laesst sich dieselbe
 * laufende Partie in mehrere 5–10-Sekunden-Stuecke schneiden, und das
 * Anlegen des Tisches, das Bots-Hinzufuegen und das Warten bleiben draussen.
 * Der Kodierer ist derselbe (Playwrights ffmpeg, VP8 in WebM).
 *
 * Format: 9:16 hochkant. Breite wie das iPhone-Motiv in screenshots.mjs
 * (440 CSS-Pixel), Hoehe auf 9:16 gekuerzt (782 statt 956 — sonst wuerde das
 * Video seitlich mit Grau aufgefuellt), Faktor 3, Video 1080 × 1920.
 *
 * Die Aufnahmen gehoeren NICHT ins Repository (*.webm/*.mp4 in .gitignore).
 * Neben die Clips schreibt das Skript `liste.md` (Datei, Spiel, Szene, Laenge,
 * Eignung). Steht ein vollstaendiges ffmpeg mit H.264 im PATH, legt es zu
 * jedem Clip eine MP4 daneben — Playwrights eigenes ffmpeg kann nur VP8.
 *
 * Zauberer/Wizard kommt bewusst nicht vor (fremde Marke, in der App „Bald").
 */

import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright';

const { values: arg } = parseArgs({
  options: {
    ziel: { type: 'string', default: 'clips' },
    szene: { type: 'string' },
    basis: { type: 'string', default: 'https://staging.brauweg-spielen.de' },
    sichtbar: { type: 'boolean', default: false },
  },
});

const BASIS = arg.basis.replace(/\/+$/, '');
if (/^https:\/\/(www\.)?brauweg-spielen\.de$/.test(BASIS)) {
  throw new Error('--basis zeigt auf die Produktion — Clips entstehen nur gegen staging.');
}
/** Was der Client fuer seinen Server haelt (QR-Codes zeigen so auf die echte Adresse). */
const SCHEIN = 'https://www.brauweg-spielen.de';
const APP_HERKUNFT = 'https://appassets.androidplatform.net';
const ZIEL = resolve(arg.ziel);

const VIEWPORT = { width: 440, height: 782 };
const FAKTOR = 3;
const VIDEO = { width: 1080, height: 1920 };

const NAMEN = ['Kiebitz', 'Pirol', 'Zilpzalp', 'Gimpel', 'Stieglitz', 'Wiedehopf', 'Eisvogel', 'Kleiber', 'Neuntöter', 'Rotschwanz'];
let namenZaehler = Math.floor(Math.random() * NAMEN.length);
const naechsterName = () => NAMEN[namenZaehler++ % NAMEN.length];

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Sitzung als App (abgeschrieben aus screenshots.mjs, siehe Kopf)
// ---------------------------------------------------------------------------

async function appSeite(browser, lokal = {}) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: FAKTOR,
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'dark',
    bypassCSP: true,
  });

  const antwort = await ctx.request.post(`${BASIS}/api/auth/gast`, {
    data: { name: naechsterName() },
    headers: { origin: APP_HERKUNFT },
  });
  if (!antwort.ok()) throw new Error(`Gastkonto: ${antwort.status()} ${await antwort.text()}`);
  const { token } = await antwort.json();
  if (!token) throw new Error('Gastkonto ohne Token — erkennt der Server die App-Herkunft nicht mehr?');

  const weiter = async (route) => {
    const anfrage = route.request();
    const url = anfrage.url().replace(SCHEIN, BASIS);
    const echt = await route.fetch({ url, headers: { ...anfrage.headers(), origin: APP_HERKUNFT } });
    const kopf = { ...echt.headers(), 'access-control-allow-origin': BASIS };
    await route.fulfill({ response: echt, headers: kopf });
  };
  await ctx.route(`${BASIS}/api/**`, weiter);
  await ctx.route(`${SCHEIN}/api/**`, weiter);
  // Nichts von hier darf die Produktion beruehren.
  await ctx.route(`${SCHEIN}/**`, (route) =>
    route.request().url().startsWith(`${SCHEIN}/api/`) ? route.fallback() : route.abort(),
  );
  await ctx.routeWebSocket(`${SCHEIN.replace(/^http/, 'ws')}/ws`, (ws) => bruecke(ws, token));

  await ctx.addInitScript(
    ([apiBase, sitzung, eintraege]) => {
      window.BRAUWEG_APP = { apiBase };
      localStorage.setItem('brauweg.sitzung', sitzung);
      for (const [k, v] of Object.entries(eintraege)) localStorage.setItem(k, v);
    },
    [SCHEIN, token, lokal],
  );

  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.warn(`  Seitenfehler: ${String(e).slice(0, 160)}`));
  await page.goto(`${BASIS}/`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await ruhig(page);
  return { ctx, page };
}

function bruecke(seite, token) {
  const server = new WebSocket(`${BASIS.replace(/^http/, 'ws')}/ws`, ['brauweg-token', token]);
  const puffer = [];
  seite.onMessage((nachricht) => {
    if (server.readyState === WebSocket.OPEN) server.send(nachricht);
    else puffer.push(nachricht);
  });
  seite.onClose(() => server.close());
  server.addEventListener('open', () => {
    for (const n of puffer.splice(0)) server.send(n);
  });
  server.addEventListener('message', (e) => {
    seite.send(typeof e.data === 'string' ? e.data : Buffer.from(e.data));
  });
  server.addEventListener('close', () => seite.close().catch(() => {}));
  server.addEventListener('error', () => console.warn('  WebSocket-Bruecke: Fehler'));
}

/** Der Feedback-Knopf steht nur auf staging und gehoert nicht ins Video. */
async function ruhig(page) {
  await page.addStyleTag({
    content: `
      button[aria-label="Feedback geben"] { display: none !important; }
      *, *::before, *::after { caret-color: transparent !important; }
    `,
  });
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function klick(page, text, { warte: ms = 1500, timeout = 10_000 } = {}) {
  await page.getByText(new RegExp(`^\\s*${esc(text)}\\s*$`, 'i')).last().click({ timeout });
  await page.waitForTimeout(ms);
}

async function klickSel(page, selektor, { warte: ms = 1500, timeout = 10_000 } = {}) {
  await page.locator(selektor).first().click({ timeout });
  await page.waitForTimeout(ms);
}

/**
 * Seit der Leiste unten (Profil · Spiele · Start · Sammlung · Clan) gibt es
 * den Knopf „Spielauswahl" aus screenshots.mjs nicht mehr; der Reiter heisst
 * „Spiele". Der alte Weg bleibt als Rueckfall fuer aeltere Staende.
 */
async function zurSpielauswahl(page) {
  // aria-label, nicht Text: Der Reiter heisst mit Punkt z. B. „Spiele, 2 bereit" (HubRahmen.tsx).
  const reiter = page.locator('nav.hb-tabs button[aria-label^="Spiele"]').first();
  const da = await reiter
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (da) {
    await reiter.click({ timeout: 5000 });
    await page.waitForTimeout(2500);
    return;
  }
  await klick(page, 'Spielauswahl', { warte: 2500 });
}

/** Die Kachel fuehrt seit dem neuen Hub erst auf eine Spielseite (Trophaeen, Rangliste); weiter geht es mit „Zum Spiel". */
async function zumSpiel(page) {
  const knopf = page.getByRole('button', { name: /^\s*zum spiel\s*$/i }).first();
  const da = await knopf
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (da) {
    await knopf.click({ timeout: 5000 });
    await page.waitForTimeout(2500);
  }
}

/** Zeigt, wo eine Szene stand, als sie scheiterte — vor dem Schliessen der Seite. */
async function fehlerbild(page, name) {
  await page.screenshot({ path: join(ZIEL, `${name}.FEHLER.png`) }).catch(() => {});
}

/** Wie botTisch in screenshots.mjs — nur ohne den letzten Bot: der setzt die Partie in Gang und gehoert in den ersten Clip. */
async function botTischBisAufEinen(page, spiel, spieler) {
  await zurSpielauswahl(page);
  await klick(page, spiel, { warte: 2500 });
  await zumSpiel(page);
  await klick(page, 'Tisch erstellen', { warte: 2000 });
  await klick(page, `${spieler} Spieler`, { warte: 800 });
  await klick(page, 'Tisch erstellen', { warte: 3000 });
  for (let i = 1; i < spieler - 1; i++) await klick(page, '+ Bot', { warte: 1500 });
}

function partyAuswahl(minispiele) {
  return {
    'partykiste.trinkmodus': '0',
    'partykiste.minispiele': JSON.stringify(minispiele),
    'partykiste.runden': '3',
    'partykiste.bots': '5',
    'partykiste.inhaltsHaerte': '1',
  };
}

async function tischVerlassen(page) {
  await page
    .evaluate(async (basis) => {
      const token = localStorage.getItem('brauweg.sitzung');
      const ich = await fetch(`${basis}/api/me`, { headers: { authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .catch(() => null);
      const id = ich?.activeTable?.tableId;
      if (!id) return;
      await fetch(`${basis}/api/tables/${id}/leave`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: '{}',
      }).catch(() => {});
    }, SCHEIN)
    .catch(() => {});
}

/**
 * Wie in screenshots.mjs, ergaenzt: Marken und Figuren Dritter haben in
 * Werbung nichts verloren. „Game Boy" kam am 19.10.2026 als Schaetzfrage;
 * Zauberer/Wizard steht hier, weil die Marke im Material gar nicht vorkommen soll.
 */
const FREMDE_MARKEN =
  /simpson|disney|pixar|marvel|star wars|harry potter|pok[eé]mon|nintendo|mario|zelda|coca|pepsi|mcdonald|apple|iphone|google|netflix|lego|barbie|batman|superman|spider|friends|game of thrones|south park|family guy|playstation|xbox|fifa|bundesliga|tatort|beatles|elvis|taylor swift|shrek|minion|asterix|schlumpf|game ?boy|sega|tetris|ikea|playmobil|monopoly|rubik|zauberer|wizard/i;

// ---------------------------------------------------------------------------
// Aufnahme
// ---------------------------------------------------------------------------

/** Alle fertigen Clips des Laufs — daraus entsteht liste.md. */
const clips = [];

/**
 * Nimmt auf, waehrend `tun` laeuft. Die Laenge haelt sich in 5–10 s: was
 * frueher fertig ist, laeuft bis 5 s weiter, was laenger braucht, wird bei
 * 10 s geschnitten (das Video endet, die Partie laeuft weiter).
 */
async function clip(page, eintrag, tun) {
  const datei = join(ZIEL, `${eintrag.datei}.webm`);
  process.stdout.write(`  ${eintrag.datei} … `);
  const beginn = Date.now();
  await page.screencast.start({ path: datei, size: VIDEO });
  let fehler = null;
  try {
    await Promise.race([tun(), warte(10_000)]);
  } catch (e) {
    fehler = e;
  }
  const rest = 5000 - (Date.now() - beginn);
  if (rest > 0) await warte(rest);
  await page.screencast.stop();
  const sekunden = (Date.now() - beginn) / 1000;
  if (fehler) {
    console.log(`verworfen: ${String(fehler).split('\n')[0]}`);
    await rm(datei, { force: true });
    return false;
  }
  const kb = Math.round((await stat(datei)).size / 1024);
  console.log(`${sekunden.toFixed(1)} s, ${kb} kB`);
  clips.push({ ...eintrag, sekunden });
  return true;
}

/**
 * Spielt im Hintergrund mit, was nicht Teil der Szene ist: Vorbehalte,
 * Reizen, Ansage, „Weiter" — und Karten, solange `karten` an ist. Die Clips
 * schalten das Kartenlegen ab und legen selbst, damit der Tipp mitten im
 * Bild und nicht zufaellig vor dem Schnitt passiert.
 */
function autopilot(page, schritt) {
  const zustand = { an: true, karten: true, reizen: true };
  const lauf = (async () => {
    while (zustand.an) {
      await schritt(page, zustand).catch(() => {});
      await warte(700);
    }
  })();
  return {
    zustand,
    async stop() {
      zustand.an = false;
      await lauf;
    },
  };
}

const SPIELBAR = '.doko-hand .doko-handcard[aria-disabled="false"]';

async function sichtbarSel(page, selektor) {
  return page.locator(selektor).first().isVisible().catch(() => false);
}

/** Erste spielbare Karte legen — nach einer kurzen „Denkpause", damit man im Video sieht, wer legt. */
async function karteLegen(page, denken = 1400) {
  await page.waitForTimeout(denken);
  const karten = page.locator(SPIELBAR);
  const n = await karten.count();
  if (n === 0) return false;
  await karten.nth(Math.floor(Math.random() * n)).click({ timeout: 3000 });
  return true;
}

/** Wartet, bis man am Zug ist; mit `stichVoll` bevorzugt den Moment, in dem man den Stich schliesst. */
async function aufZugWarten(page, { stichVoll = 0, timeout = 90_000 } = {}) {
  const ende = Date.now() + timeout;
  while (Date.now() < ende) {
    if (await sichtbarSel(page, SPIELBAR)) {
      if (!stichVoll) return;
      const liegen = await page.locator('.doko-trick .doko-trick-card').count();
      if (liegen >= stichVoll) return;
      // Nicht der gewuenschte Moment: diese Karte legt der Autopilot-Ersatz hier.
      await karteLegen(page, 600);
      await page.waitForTimeout(1500);
      continue;
    }
    await page.waitForTimeout(400);
  }
  throw new Error('nie am Zug');
}

/** Ein Clip „ich lege, die Bots antworten, der Stich geht weg". */
async function stichClip(page, auto, eintrag, stichVoll = 0) {
  auto.zustand.karten = false;
  try {
    await aufZugWarten(page, { stichVoll });
    return await clip(page, eintrag, async () => {
      await karteLegen(page);
      await page.waitForTimeout(5500);
    });
  } finally {
    auto.zustand.karten = true;
  }
}

// ---------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------

async function weiterKnopf(page) {
  const knopf = page.getByRole('button', { name: /^(weiter|nächste runde)$/i }).first();
  if (await knopf.isVisible().catch(() => false)) await knopf.click({ timeout: 2000 });
}

async function dokoSchritt(page, zustand) {
  const gesund = page.getByText('Ja, gesund').first();
  if (await gesund.isVisible().catch(() => false)) {
    await page.waitForTimeout(900);
    await gesund.click({ timeout: 2000 });
    await page.waitForTimeout(600);
    const ok = page.getByText(/^\s*Bestätigen\s*$/i).last();
    if (await ok.isVisible().catch(() => false)) await ok.click({ timeout: 2000 });
    return;
  }
  if (zustand.karten && (await sichtbarSel(page, SPIELBAR))) {
    await karteLegen(page, 800);
    return;
  }
  await weiterKnopf(page);
}

const REIZEN = '.skat-reiz button.primary';

/**
 * Reizen bis 33 mit, dann weg — hoch genug, dass man das Reizen oft gewinnt
 * und der Ansage-Clip zustande kommt. Ob man sich dabei ueberreizt, ist
 * fuer das Video egal.
 */
async function skatSchritt(page, zustand) {
  const reiz = page.locator(REIZEN).first();
  if (zustand.reizen && (await reiz.isVisible().catch(() => false))) {
    const wert = Number((await reiz.innerText()).match(/\d+/)?.[0] ?? 18);
    await page.waitForTimeout(1200);
    if (wert <= 33) await reiz.click({ timeout: 2000 });
    else await page.getByRole('button', { name: /^weg$/i }).first().click({ timeout: 2000 });
    return;
  }
  const aufnehmen = page.getByRole('button', { name: /skat aufnehmen/i }).first();
  if (await aufnehmen.isVisible().catch(() => false)) {
    await page.waitForTimeout(1000);
    await aufnehmen.click({ timeout: 2000 });
    return;
  }
  const druecken = page.getByRole('button', { name: /^drücken$/i }).first();
  if (await druecken.isVisible().catch(() => false)) {
    const karten = page.locator('.doko-hand .doko-handcard');
    if ((await page.locator('.doko-hand .doko-handcard[aria-pressed="true"]').count()) < 2) {
      // Am Element ausloesen, nicht per Mausklick: Die Handkarten liegen
      // ueberlappend, ein Klick auf die Mitte traf die Nachbarin und schaltete
      // sie zweimal um (am 19.10.2026 blieb „Noch 2 Karten waehlen" stehen).
      const n = await karten.count();
      await karten.nth(n - 1).evaluate((el) => el.click());
      await page.waitForTimeout(600);
      await karten.nth(n - 2).evaluate((el) => el.click());
      await page.waitForTimeout(800);
    }
    await druecken.click({ timeout: 2000 });
    return;
  }
  const art = page.locator('.skat-ansage .skat-art').first();
  if (await art.isVisible().catch(() => false)) {
    await page.waitForTimeout(800);
    // Grand: passt zu jedem Blatt und liest sich im Video sofort.
    await page.locator('.skat-ansage .skat-art', { hasText: 'Grand' }).first().click({ timeout: 2000 });
    await page.waitForTimeout(700);
    await page.locator('.skat-ansage > button.primary').first().click({ timeout: 2000 });
    return;
  }
  if (zustand.karten && (await sichtbarSel(page, SPIELBAR))) {
    await karteLegen(page, 800);
    return;
  }
  await weiterKnopf(page);
}

const SZENEN = [
  {
    name: 'spielauswahl',
    async machen(browser) {
      const { ctx, page } = await appSeite(browser);
      try {
        await clip(
          page,
          { datei: '01-spielauswahl', spiel: 'alle', szene: 'Startseite → Reiter „Spiele": Doppelkopf und Skat oben, darunter Partykiste', eignung: 'Hook, Endkarte' },
          async () => {
            await page.waitForTimeout(1500);
            // Die Kacheln stehen ohne Scrollen im Bild: Kartenspiele zuoberst,
            // Partykiste als grosse Kachel der Trinkspiele darunter.
            await zurSpielauswahl(page);
            await page.waitForTimeout(4000);
          },
        );
      } catch (e) {
        await fehlerbild(page, 'spielauswahl');
        throw e;
      } finally {
        await ctx.close();
      }
    },
  },
  {
    name: 'doppelkopf',
    async machen(browser) {
      const { ctx, page } = await appSeite(browser);
      let auto;
      try {
        await botTischBisAufEinen(page, 'Doppelkopf', 4);
        await clip(
          page,
          { datei: '02-doppelkopf-austeilen', spiel: 'Doppelkopf', szene: 'Letzter Bot setzt sich, Karten werden ausgeteilt, „gesund"', eignung: 'Hook, Spielszene' },
          async () => {
            await klick(page, '+ Bot', { warte: 500 });
            auto = autopilot(page, dokoSchritt);
            auto.zustand.karten = false;
            await page.waitForTimeout(9500);
          },
        );
        auto ??= autopilot(page, dokoSchritt);
        auto.zustand.karten = true;
        await stichClip(page, auto, { datei: '03-doppelkopf-ausspielen', spiel: 'Doppelkopf', szene: 'Eigene Karte ausspielen, Bots legen nach', eignung: 'Spielszene' });
        await stichClip(page, auto, { datei: '04-doppelkopf-stich', spiel: 'Doppelkopf', szene: 'Vierte Karte schliesst den Stich, Stich wird eingezogen', eignung: 'Spielszene' }, 3);
        await stichClip(page, auto, { datei: '05-doppelkopf-stich-2', spiel: 'Doppelkopf', szene: 'Weiterer Stich, Hand wird kleiner', eignung: 'Spielszene' });
      } catch (e) {
        await fehlerbild(page, 'doppelkopf');
        throw e;
      } finally {
        await auto?.stop();
        await tischVerlassen(page);
        await ctx.close();
      }
    },
  },
  {
    name: 'skat',
    async machen(browser) {
      const { ctx, page } = await appSeite(browser);
      let auto;
      try {
        await botTischBisAufEinen(page, 'Skat', 3);
        await klick(page, '+ Bot', { warte: 500 });
        // Das Reizen haelt der Clip selbst an: Er wartet, bis man dran ist,
        // zeigt kurz den Reizrechner und sagt dann.
        auto = autopilot(page, skatSchritt);
        auto.zustand.reizen = false;
        await page.locator(REIZEN).first().waitFor({ state: 'visible', timeout: 60_000 });
        await clip(
          page,
          { datei: '06-skat-reizen', spiel: 'Skat', szene: 'Reizen: Rechner auf (tragbare Werte je Spielart), zu, dann „18 sagen"', eignung: 'Hook, Spielszene' },
          async () => {
            await page.waitForTimeout(1500);
            await klick(page, 'Rechner', { warte: 3000 });
            await klick(page, 'Zurück', { warte: 1000 });
            await page.locator(REIZEN).first().click({ timeout: 3000 });
            await page.waitForTimeout(3000);
          },
        );
        auto.zustand.reizen = true;
        // Gewinnt man das Reizen, kommt Skat aufnehmen/Druecken/Ansage — das
        // ist der zweite Clip. Sonst sagt ein Bot an, und es geht gleich an
        // die Stiche.
        const ansage = page.getByRole('button', { name: /skat aufnehmen|hand spielen/i }).first();
        const wirdAnsage = await ansage
          .waitFor({ state: 'visible', timeout: 30_000 })
          .then(() => true)
          .catch(() => false);
        if (wirdAnsage) {
          await clip(
            page,
            { datei: '07-skat-ansage', spiel: 'Skat', szene: 'Skat aufnehmen, zwei Karten drücken, Grand ansagen', eignung: 'Spielszene' },
            async () => {
              await page.locator('.skat-ansage').first().waitFor({ state: 'visible', timeout: 15_000 });
              await page.waitForTimeout(3500);
            },
          );
        }
        auto.zustand.karten = true;
        await stichClip(page, auto, { datei: '08-skat-stich', spiel: 'Skat', szene: 'Eigene Karte, die Bots legen, Stich geht weg', eignung: 'Spielszene' });
        await stichClip(page, auto, { datei: '09-skat-stich-2', spiel: 'Skat', szene: 'Dritte Karte schliesst den Stich', eignung: 'Spielszene' }, 2);
        if (!wirdAnsage) {
          await stichClip(page, auto, { datei: '07-skat-stich-3', spiel: 'Skat', szene: 'Weiterer Stich (Ansage hatte ein Bot)', eignung: 'Spielszene' });
        }
      } catch (e) {
        await fehlerbild(page, 'skat');
        throw e;
      } finally {
        await auto?.stop();
        await tischVerlassen(page);
        await ctx.close();
      }
    },
  },
  {
    name: 'partykiste',
    async machen(browser) {
      // Das Menue nimmt mindestens drei Minispiele (MINDESTENS_MINISPIELE in
      // wahl.ts) — mit nur ['quiz'] verwirft es die Wahl und spielt alle 15.
      // Die Reihenfolge mischt das Modul; ist die erste Runde kein Quiz, geht
      // es an einen neuen Tisch. Dasselbe bei einer Frage mit fremder Marke.
      for (let versuch = 1; versuch <= 8; versuch++) {
        const vorher = clips.length;
        const { ctx, page } = await appSeite(browser, partyAuswahl(['quiz', 'schaetzen', 'entweder']));
        let grund = null;
        try {
          await zurSpielauswahl(page);
          await klick(page, 'Partykiste', { warte: 2000 });
          await zumSpiel(page);
          await page.locator('button[data-pk-bots]').first().waitFor({ state: 'visible', timeout: 15_000 });
          const quiz = await clip(
            page,
            { datei: '10-partykiste-start', spiel: 'Partykiste', szene: 'Menü (alkoholfrei), Bots dazu, Los — die erste Quizfrage erscheint', eignung: 'Hook' },
            async () => {
              await page.waitForTimeout(1500);
              await klickSel(page, 'button[data-pk-bots]', { warte: 900 });
              await klickSel(page, 'button[data-pk-los]', { warte: 500 });
              await page.locator('.pk-knopf.is-antwort').first().waitFor({ state: 'visible', timeout: 8000 });
              await page.waitForTimeout(1500);
            },
          );
          // Nach dem Clip nachsehen, nicht auf sein Ergebnis bauen: Schneidet die
          // 10-s-Grenze ab, gilt der Clip als gelungen, auch wenn nie eine
          // Quizfrage kam (am 19.10.2026 lief so eine Schaetzrunde durch).
          const istQuiz = quiz && (await page.locator('.pk-knopf.is-antwort').count()) === 4;
          // Nur Frage und Antworten pruefen — die Seite drumherum traegt Menue-Text.
          const text = istQuiz ? (await page.locator('.pk-frage, .pk-knopf.is-antwort').allInnerTexts()).join(' ') : '';
          if (!istQuiz) grund = 'erste Runde ist kein Quiz';
          else if (FREMDE_MARKEN.test(text)) grund = 'Frage mit fremder Marke';
          if (!grund) {
            await clip(
              page,
              { datei: '11-partykiste-frage', spiel: 'Partykiste', szene: 'Allgemeinwissen: Frage mit vier Antworten, eine wird angetippt', eignung: 'Hook, Spielszene' },
              async () => {
                await page.waitForTimeout(3000);
                const antworten = page.locator('.pk-knopf.is-antwort');
                await antworten.nth(Math.floor(Math.random() * 4)).click({ timeout: 3000 });
                await page.waitForTimeout(2500);
              },
            );
            await clip(
              page,
              { datei: '12-partykiste-aufloesung', spiel: 'Partykiste', szene: 'Auflösung: richtige Antwort grün, darunter wer was getippt hat', eignung: 'Spielszene' },
              async () => {
                await page.locator('.pk-knopf.is-antwort[data-richtig]').first().waitFor({ state: 'visible', timeout: 9000 });
                await page.waitForTimeout(4500);
              },
            );
            await clip(
              page,
              { datei: '13-partykiste-weiter', spiel: 'Partykiste', szene: '„Weiter" — Zwischenstand bzw. nächste Runde', eignung: 'Spielszene, Endkarte' },
              async () => {
                await page.waitForTimeout(1200);
                await weiterKnopf(page);
                await page.waitForTimeout(6000);
              },
            );
            // Hinter „Weiter" steht die naechste Runde mit eigener Frage — auch die pruefen.
            const danach = (await page.locator('.pk-frage, .pk-knopf, .pk-wort').allInnerTexts().catch(() => [])).join(' ');
            if (FREMDE_MARKEN.test(danach) && clips.at(-1)?.datei === '13-partykiste-weiter') {
              console.log('  13 verworfen: nächste Frage nennt eine fremde Marke');
              await rm(join(ZIEL, `${clips.pop().datei}.webm`), { force: true });
            }
            return;
          }
        } catch (e) {
          await fehlerbild(page, 'partykiste');
          throw e;
        } finally {
          await tischVerlassen(page);
          await ctx.close();
        }
        console.log(`  ${grund}, neuer Tisch (${versuch}) …`);
        for (const c of clips.splice(vorher)) await rm(join(ZIEL, `${c.datei}.webm`), { force: true });
      }
      throw new Error('in acht Versuchen keine brauchbare Quizrunde');
    },
  },
];

// ---------------------------------------------------------------------------
// Nachbereitung
// ---------------------------------------------------------------------------

/** Ein ffmpeg mit H.264 im PATH? Playwrights eigenes kann nur VP8 und liegt nicht im PATH. */
function ffmpegMitH264() {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  return r.status === 0 && /libx264|h264_/.test(r.stdout);
}

function nachMp4(webm) {
  const mp4 = webm.replace(/\.webm$/, '.mp4');
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4],
    { encoding: 'utf8' },
  );
  return r.status === 0 ? mp4 : null;
}

/**
 * Ein Lauf mit --szene ersetzt nur die Zeilen seiner Szenen; was andere Szenen
 * frueher aufgenommen haben, bleibt in der Liste stehen.
 */
async function listeSchreiben(format, szenen) {
  const alt = await readFile(join(ZIEL, 'liste.md'), 'utf8').catch(() => '');
  const behalten = alt
    .split('\n')
    .filter((z) => /^\| \d\d-/.test(z) && !szenen.some((s) => z.includes(`-${s.name}`)));
  const neu = clips.map((c) => `| ${c.datei}.${format} | ${c.spiel} | ${c.szene} | ${c.sekunden.toFixed(1)} s | ${c.eignung} |`);
  const zeilen = [
    '# Bildschirmaufnahmen brauweg-spielen.de',
    '',
    `Erzeugt von \`werkzeug/store/clips.mjs\` am ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} gegen ${BASIS}.`,
    `App-Modus, Gastkonten mit Vogelnamen, alle Mitspieler Bots, Partykiste alkoholfrei. ${VIDEO.width} × ${VIDEO.height} (9:16), ${format}.`,
    '',
    '| Datei | Spiel | Szene | Länge | Eignung |',
    '| --- | --- | --- | --- | --- |',
    ...[...behalten, ...neu].sort(),
    '',
  ];
  await writeFile(join(ZIEL, 'liste.md'), zeilen.join('\n'), 'utf8');
}

async function main() {
  const szenen = arg.szene ? SZENEN.filter((s) => s.name.includes(arg.szene)) : SZENEN;
  if (szenen.length === 0) throw new Error(`--szene: keine passt auf „${arg.szene}"`);
  await mkdir(ZIEL, { recursive: true });
  console.log(`Server ${BASIS} (Client glaubt ${SCHEIN}) → ${ZIEL}`);

  const browser = await chromium.launch({ headless: !arg.sichtbar });
  let fehlerZahl = 0;
  try {
    for (const szene of szenen) {
      console.log(szene.name);
      // Alte Clips dieser Szene weg — sonst laege ein 07-skat-stich-3 neben einem neuen 07-skat-ansage.
      for (const f of await readdir(ZIEL)) {
        if (/^\d\d-/.test(f) && f.includes(`-${szene.name}`)) await rm(join(ZIEL, f), { force: true });
      }
      try {
        await szene.machen(browser);
      } catch (e) {
        fehlerZahl++;
        console.log(`  FEHLER: ${String(e).split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }

  let format = 'webm';
  if (ffmpegMitH264()) {
    const alle = clips.map((c) => nachMp4(join(ZIEL, `${c.datei}.webm`)));
    if (alle.every(Boolean)) format = 'mp4';
    else console.log('MP4-Wandlung teilweise gescheitert — liste.md nennt die WebM.');
  } else {
    console.log('Kein ffmpeg mit H.264 im PATH — Clips bleiben WebM (VP8).');
  }
  await listeSchreiben(format, szenen);
  console.log(`${clips.length} Clips, liste.md geschrieben.`);
  if (fehlerZahl > 0) process.exitCode = 1;
}

await main();
