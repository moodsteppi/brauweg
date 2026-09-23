#!/usr/bin/env node
/**
 * Store-Screenshots fuer App Store und Google Play, automatisch gegen staging.
 *
 *   cd werkzeug/store
 *   npm ci                                # Playwright, nur hier — nicht im Client-Paket
 *   npx playwright install chromium       # einmal je Rechner, falls der Browser fehlt
 *   node screenshots.mjs --ziel <ordner>  # alle Motive, beide Geraete
 *
 * Weitere Schalter:
 *   --geraet ios|play     nur ein Geraet (Vorgabe: beide)
 *   --motiv <name>        nur ein Motiv (Name wie in MOTIVE unten, Teilwort genuegt)
 *   --basis <url>         Server, gegen den gespielt wird (Vorgabe: staging)
 *   --ohne-umleitung      der Client spricht offen mit --basis (siehe unten)
 *   --sichtbar            Browserfenster zeigen (zum Nachsehen, wenn ein Motiv hakt)
 *
 * Warum so und nicht von Hand:
 *
 * - Die App ist dieselbe Web-Oberflaeche wie die Seite, nur mit
 *   `window.BRAUWEG_APP` und der Herkunft der Huelle. Beides setzt das Skript:
 *   `BRAUWEG_APP` vor der ersten Zeile des Clients, und jede API-Anfrage geht
 *   mit `Origin: https://appassets.androidplatform.net` hinaus. Der Server
 *   gibt dann die App-Auswahl (Doppelkopf, Skat, Partykiste spielbar, der
 *   Rest „Bald", kein Shop) und das Sitzungstoken heraus
 *   (`plattformVon`/`istAppHerkunft` in packages/server/src/http/app.ts).
 *   `route.continue` mit geaenderter Herkunft kommt in Chromium NICHT an
 *   (am 23.09.2026 ausprobiert: der Server sah weiter die Webseite) — deshalb
 *   holt das Skript jede Anfrage selbst (`route.fetch`) und reicht die
 *   Antwort durch.
 *
 * - Der Client glaubt, er spreche mit der Produktion
 *   (`apiBase = https://www.brauweg-spielen.de`), und das Skript leitet alles
 *   nach staging um — HTTP ueber `route.fetch`, den WebSocket ueber eine
 *   Bruecke. Grund: Der QR-Code der Einladung traegt `apiBase`
 *   (`einladungslink.ts`). Mit staging als `apiBase` stuende im Store-Bild ein
 *   Code, der auf die Testumgebung fuehrt. Was nicht umgeleitet werden kann,
 *   bricht das Skript ab, statt es zur Produktion durchzulassen.
 *   `--ohne-umleitung` schaltet das ab (dann zeigt der QR auf --basis).
 *
 * - Ohne echte Personendaten: Jedes Motiv spielt als frisch angelegtes
 *   Gastkonto mit einem Vogelnamen, alle Mitspieler sind Bots. Gastkonten
 *   kosten keine Mail; der Server kappt 30 je Viertelstunde und Adresse
 *   (`/api/auth/gast`), ein voller Lauf braucht zwoelf.
 *
 * - Die Bilder gehoeren NICHT ins Repository (mehrere MB je Stueck). Die Liste
 *   der Motive steht in docs/store/SCREENSHOTS.md.
 *
 * Groessen (Stand 23.09.2026, siehe docs/store/SCREENSHOTS.md):
 *   ios   440 x 956 CSS-Pixel, Faktor 3 → 1320 x 2868 (iPhone 6,9", Pflichtgroesse)
 *   play  360 x 640 CSS-Pixel, Faktor 3 → 1080 x 1920 (9:16, Mindestmass fuer
 *         die grossen Spiele-Empfehlungen bei Google Play)
 * Chromium schreibt PNG ohne Alphakanal (Farbtyp 2) — Apple lehnt Bilder mit
 * Alphakanal ab, das prueft `pruefePng` nach jedem Bild.
 */

import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright';

const { values: arg } = parseArgs({
  options: {
    ziel: { type: 'string', default: 'ausgabe' },
    geraet: { type: 'string' },
    motiv: { type: 'string' },
    basis: { type: 'string', default: 'https://staging.brauweg-spielen.de' },
    'ohne-umleitung': { type: 'boolean', default: false },
    sichtbar: { type: 'boolean', default: false },
  },
});

const BASIS = arg.basis.replace(/\/+$/, '');
/** Was der Client fuer seinen Server haelt (siehe Kopf). */
const SCHEIN = arg['ohne-umleitung'] ? BASIS : 'https://www.brauweg-spielen.de';
/** Herkunft der Android-Huelle — der Server behandelt sie wie die iOS-Huelle. */
const APP_HERKUNFT = 'https://appassets.androidplatform.net';
const ZIEL = resolve(arg.ziel);

const GERAETE = {
  ios: { name: 'ios-6.9', viewport: { width: 440, height: 956 }, faktor: 3 },
  play: { name: 'play-phone', viewport: { width: 360, height: 640 }, faktor: 3 },
};

/** Vogelnamen: erkennbar erfunden, keine Person. Der Server haengt bei Bedarf eine Zahl an. */
const NAMEN = ['Kiebitz', 'Pirol', 'Zilpzalp', 'Gimpel', 'Stieglitz', 'Wiedehopf', 'Eisvogel', 'Kleiber', 'Neuntöter', 'Rotschwanz'];
let namenZaehler = Math.floor(Math.random() * NAMEN.length);
const naechsterName = () => NAMEN[namenZaehler++ % NAMEN.length];

// ---------------------------------------------------------------------------
// Sitzung als App
// ---------------------------------------------------------------------------

/** Die zuletzt geoeffnete Seite — damit ein gescheitertes Motiv trotzdem ein Fehlerbild hinterlaesst. */
let letzteSitzung = null;

async function appSeite(browser, geraet, lokal = {}) {
  const ctx = await browser.newContext({
    viewport: geraet.viewport,
    deviceScaleFactor: geraet.faktor,
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'dark',
    // Die CSP der Seite erlaubt connect-src nur 'self'. In der Huelle ist der
    // Server ohnehin eine fremde Herkunft (dort gilt die CSP des Pakets); hier
    // muss die Seite den Schein-Server erreichen duerfen. Aendert nichts am Bild.
    bypassCSP: !arg['ohne-umleitung'],
  });

  const antwort = await ctx.request.post(`${BASIS}/api/auth/gast`, {
    data: { name: naechsterName() },
    headers: { origin: APP_HERKUNFT },
  });
  if (!antwort.ok()) throw new Error(`Gastkonto: ${antwort.status()} ${await antwort.text()}`);
  const { token } = await antwort.json();
  if (!token) throw new Error('Gastkonto ohne Token — erkennt der Server die App-Herkunft nicht mehr?');

  // Jede API-Anfrage mit der Herkunft der Huelle, und — ausser mit
  // --ohne-umleitung — vom Schein-Server nach BASIS.
  const weiter = async (route) => {
    const anfrage = route.request();
    const url = anfrage.url().replace(SCHEIN, BASIS);
    const echt = await route.fetch({ url, headers: { ...anfrage.headers(), origin: APP_HERKUNFT } });
    // Die Seite liegt unter BASIS, der Schein-Server ist fuer sie eine fremde
    // Herkunft: Der Browser prueft die CORS-Freigabe, und die lautet auf die
    // Herkunft der Huelle. Also auf die Herkunft der Seite umschreiben — sonst
    // verwirft der Browser jede Antwort, und die Seite steht an der Anmeldung.
    const kopf = { ...echt.headers(), 'access-control-allow-origin': BASIS };
    await route.fulfill({ response: echt, headers: kopf });
  };
  await ctx.route(`${BASIS}/api/**`, weiter);
  if (SCHEIN !== BASIS) {
    await ctx.route(`${SCHEIN}/api/**`, weiter);
    // Alles andere zum Schein-Server wird nicht durchgelassen: Kein Bild
    // dieses Skripts soll je die Produktion beruehren.
    await ctx.route(`${SCHEIN}/**`, (route) =>
      route.request().url().startsWith(`${SCHEIN}/api/`) ? route.fallback() : route.abort(),
    );
    await ctx.routeWebSocket(`${SCHEIN.replace(/^http/, 'ws')}/ws`, (ws) => bruecke(ws, token));
  }

  await ctx.addInitScript(
    ([apiBase, sitzung, eintraege]) => {
      window.BRAUWEG_APP = { apiBase };
      localStorage.setItem('brauweg.sitzung', sitzung);
      for (const [k, v] of Object.entries(eintraege)) localStorage.setItem(k, v);
    },
    [SCHEIN, token, lokal],
  );

  const page = await ctx.newPage();
  letzteSitzung = { ctx, page };
  page.on('pageerror', (e) => console.warn(`  Seitenfehler: ${String(e).slice(0, 160)}`));
  await page.goto(`${BASIS}/`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await ruhig(page);
  return { ctx, page, token };
}

/**
 * WebSocket-Bruecke: Die Seite spricht mit dem Schein-Server, das Skript
 * reicht jede Nachricht an BASIS weiter. Das Token geht wie in der App als
 * Unterprotokoll hinter `brauweg-token` mit (TOKEN_PROTOKOLL im Gateway).
 */
function bruecke(seite, token) {
  const ziel = `${BASIS.replace(/^http/, 'ws')}/ws`;
  const server = new WebSocket(ziel, ['brauweg-token', token]);
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

/** Was nur auf staging steht (der Feedback-Knopf), gehoert nicht ins Store-Bild. */
async function ruhig(page) {
  await page.addStyleTag({
    content: `
      button[aria-label="Feedback geben"] { display: none !important; }
      *, *::before, *::after { caret-color: transparent !important; }
    `,
  });
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Klick auf den sichtbaren Text (Gross-/Kleinschreibung egal — viele Knoepfe setzen CSS-Versalien). */
async function klick(page, text, { warte = 1500, timeout = 10_000 } = {}) {
  const ort = page.getByText(new RegExp(`^\\s*${esc(text)}\\s*$`, 'i')).last();
  await ort.click({ timeout });
  await page.waitForTimeout(warte);
}

async function klickSel(page, selektor, { warte = 1500, timeout = 10_000 } = {}) {
  await page.locator(selektor).first().click({ timeout });
  await page.waitForTimeout(warte);
}

/** Wartet, bis ein Text sichtbar ist; false statt Fehler, das Motiv entscheidet selbst. */
async function sichtbar(page, text, timeout) {
  try {
    await page.getByText(text).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function zurSpielauswahl(page) {
  await klick(page, 'Spielauswahl', { warte: 2500 });
}

/** Doppelkopf/Skat: Tisch in der Lobby anlegen und alle freien Plaetze mit Bots fuellen. */
async function botTisch(page, spiel, spieler) {
  await zurSpielauswahl(page);
  await klick(page, spiel, { warte: 2500 });
  await klick(page, 'Tisch erstellen', { warte: 2000 });
  // Die Spielerzahl ausdruecklich waehlen: Ohne gemerkte Einstellung schickt
  // die Lobby sonst 4 Sitze, auch bei Skat — dort gibt es nur 3
  // („Diese Spielerzahl gibt es bei diesem Spiel nicht", CHECKLISTE.md).
  await klick(page, `${spieler} Spieler`, { warte: 800 });
  await klick(page, 'Tisch erstellen', { warte: 3000 });
  for (let i = 1; i < spieler; i++) await klick(page, '+ Bot', { warte: 1500 });
}

/** Partykiste-Menue mit vorbelegter Auswahl (localStorage wie `wahl.ts`/`Partykiste.tsx`). */
function partyAuswahl({ trinkmodus, minispiele }) {
  return {
    'partykiste.trinkmodus': trinkmodus ? '1' : '0',
    'partykiste.minispiele': JSON.stringify(minispiele),
    'partykiste.runden': '3',
    'partykiste.bots': '5',
    'partykiste.inhaltsHaerte': '1',
  };
}

async function tischVerlassen(page) {
  // Aufraeumen, damit staging keine verwaisten Tische sammelt. Scheitern ist egal.
  await page
    .evaluate(async (basis) => {
      const token = localStorage.getItem('brauweg.sitzung');
      const ich = await fetch(`${basis}/api/me`, { headers: { authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .catch(() => null);
      // `activeTable` in /api/me (activeTableFor in tables/service.ts).
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

// ---------------------------------------------------------------------------
// Motive — Reihenfolge = Reihenfolge im Store
// ---------------------------------------------------------------------------

const MOTIVE = [
  {
    datei: '01-spielauswahl',
    titel: 'Spielauswahl: Doppelkopf, Skat, Partykiste — der Rest „Bald"',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      await zurSpielauswahl(page);
      // „Jetzt spielbar" an den oberen Rand, damit die drei Spiele und der
      // Anfang von „Kommt bald" im Bild stehen.
      await page
        .getByText(/jetzt spielbar/i)
        .first()
        .evaluate((el) => el.closest('section, div')?.scrollIntoView({ block: 'start' }))
        .catch(() => {});
      await page.waitForTimeout(1200);
      return { ctx, page };
    },
  },
  {
    datei: '02-doppelkopf-tisch',
    titel: 'Doppelkopf zu viert mit Bots',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      await botTisch(page, 'Doppelkopf', 4);
      // Der Knopf heisst „✓ Ja, gesund“ — also nicht wortgenau suchen.
      if (await sichtbar(page, 'Ja, gesund', 20_000)) {
        await page.getByText('Ja, gesund').first().click().catch(() => {});
        // Danach fragt der Tisch noch einmal nach („Gesund ansagen?“).
        if (await sichtbar(page, 'Bestätigen', 5000)) await klick(page, 'Bestätigen', { warte: 500 });
      }
      // Bis die Bots vor einem ausgespielt haben: dann liegt ein Stich in der Mitte.
      await page.waitForTimeout(9000);
      return { ctx, page, aufraeumen: true };
    },
  },
  {
    datei: '03-skat-reizen',
    titel: 'Skat: Reizen',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      await botTisch(page, 'Skat', 3);
      await sichtbar(page, 'Du bist am Reizen', 45_000);
      await page.waitForTimeout(800);
      return { ctx, page, aufraeumen: true };
    },
  },
  {
    datei: '04-partykiste-runde',
    titel: 'Partykiste: Allgemeinwissen, alkoholfrei',
    async machen(browser, geraet) {
      return partyRunde(browser, geraet, false);
    },
  },
  {
    datei: '05-einladung-qr',
    titel: 'Partykiste: Einladung per Code und QR',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(
        browser,
        geraet,
        partyAuswahl({ trinkmodus: false, minispiele: ['quiz', 'schaetzen', 'entweder'] }),
      );
      await zurSpielauswahl(page);
      await klick(page, 'Partykiste', { warte: 2500 });
      await klickSel(page, 'button[data-pk-online]', { warte: 3000 });
      // Steht schon eine offene Runde da, zeigt der Client sie erst an — wir
      // wollen die eigene (Knopf „Eigene aufmachen", Einstellungen.tsx).
      if (await sichtbar(page, 'Eigene aufmachen', 1500)) await klick(page, 'Eigene aufmachen', { warte: 3000 });
      await page.locator('.einladung').first().waitFor({ state: 'visible', timeout: 15_000 });
      await page.locator('.einladung').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      return { ctx, page, aufraeumen: true };
    },
  },
  {
    datei: '06-partykiste-einstellungen',
    titel: 'Partykiste: Trinkspiel oder alkoholfrei, Inhalte harmlos/pikant/derb',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(
        browser,
        geraet,
        partyAuswahl({ trinkmodus: false, minispiele: ['quiz', 'schaetzen', 'entweder'] }),
      );
      await zurSpielauswahl(page);
      await klick(page, 'Partykiste', { warte: 2500 });
      return { ctx, page };
    },
  },
  {
    datei: '07-partykiste-trinkspiel',
    titel: 'Partykiste: dieselbe Runde im Trinkspiel-Modus (Ersatz fuer 04, Robin entscheidet)',
    async machen(browser, geraet) {
      return partyRunde(browser, geraet, true);
    },
  },
];

async function partyRunde(browser, geraet, trinkmodus) {
  const { ctx, page } = await appSeite(
    browser,
    geraet,
    // Quiz zuerst: eine Frage mit vier Antworten erklaert sich im Standbild
    // selbst — anders als der Imposter, dessen Wort zufaellig „Gluehwein" sein kann.
    partyAuswahl({ trinkmodus, minispiele: ['quiz', 'schaetzen', 'entweder'] }),
  );
  for (let versuch = 1; ; versuch++) {
    await zurSpielauswahl(page);
    await klick(page, 'Partykiste', { warte: 2500 });
    await klickSel(page, 'button[data-pk-bots]', { warte: 800 });
    await klickSel(page, 'button[data-pk-los]', { warte: 2000 });
    await sichtbar(page, 'Allgemeinwissen', 30_000);
    await page.waitForTimeout(2500);
    // Die Frage zieht die Saat. Handelt sie von einer fremden Marke (am
    // 23.09.2026 kam „die Simpsons"), gehoert sie nicht ins Store-Bild
    // (Apple 5.2.1, fremdes geistiges Eigentum) — neuer Tisch, neue Saat.
    const text = await page.locator('main').first().innerText().catch(() => '');
    if (!FREMDE_MARKEN.test(text) || versuch >= 5) return { ctx, page, aufraeumen: true };
    console.log(`\n  Frage mit fremder Marke, neuer Tisch (${versuch}) …`);
    await tischVerlassen(page);
    await page.goto(`${BASIS}/`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await ruhig(page);
  }
}

/** Marken und Figuren Dritter, die in einem Store-Bild nichts verloren haben. */
const FREMDE_MARKEN =
  /simpson|disney|pixar|marvel|star wars|harry potter|pok[eé]mon|nintendo|mario|zelda|coca|pepsi|mcdonald|apple|iphone|google|netflix|lego|barbie|batman|superman|spider|friends|game of thrones|south park|family guy|playstation|xbox|fifa|bundesliga|tatort|beatles|elvis|taylor swift|shrek|minion|asterix|schlumpf/i;

// ---------------------------------------------------------------------------
// Lauf
// ---------------------------------------------------------------------------

/** PNG-Kopf lesen: Groesse und Farbtyp (2 = RGB ohne Alpha, 6 = mit Alpha). */
async function pruefePng(datei, soll) {
  const b = await readFile(datei);
  const breite = b.readUInt32BE(16);
  const hoehe = b.readUInt32BE(20);
  const farbtyp = b[25];
  const fehler = [];
  if (breite !== soll.width || hoehe !== soll.height) fehler.push(`${breite}x${hoehe} statt ${soll.width}x${soll.height}`);
  if (farbtyp !== 2) fehler.push(`Farbtyp ${farbtyp} (Alphakanal?)`);
  return { breite, hoehe, kb: Math.round(b.length / 1024), fehler };
}

async function main() {
  const geraete = arg.geraet ? [GERAETE[arg.geraet]] : Object.values(GERAETE);
  if (geraete.some((g) => !g)) throw new Error(`--geraet: ${Object.keys(GERAETE).join(' oder ')}`);
  const motive = arg.motiv ? MOTIVE.filter((m) => m.datei.includes(arg.motiv)) : MOTIVE;
  if (motive.length === 0) throw new Error(`--motiv: keins passt auf „${arg.motiv}"`);

  console.log(`Server ${BASIS}${SCHEIN !== BASIS ? ` (Client glaubt ${SCHEIN})` : ''} → ${ZIEL}`);
  const browser = await chromium.launch({ headless: !arg.sichtbar });
  let fehlerZahl = 0;
  try {
    for (const geraet of geraete) {
      const ordner = join(ZIEL, geraet.name);
      await mkdir(ordner, { recursive: true });
      const soll = { width: geraet.viewport.width * geraet.faktor, height: geraet.viewport.height * geraet.faktor };
      for (const motiv of motive) {
        const datei = join(ordner, `${motiv.datei}.png`);
        process.stdout.write(`${geraet.name} ${motiv.datei} … `);
        let sitzung;
        letzteSitzung = null;
        try {
          sitzung = await motiv.machen(browser, geraet);
          await sitzung.page.screenshot({ path: datei, animations: 'disabled' });
          const p = await pruefePng(datei, soll);
          console.log(`${p.breite}x${p.hoehe}, ${p.kb} kB${p.fehler.length ? ` — FEHLER: ${p.fehler.join(', ')}` : ''}`);
          if (p.fehler.length) fehlerZahl++;
        } catch (e) {
          fehlerZahl++;
          console.log(`FEHLER: ${String(e).split('\n')[0]}`);
          sitzung = { ...letzteSitzung, aufraeumen: true };
          if (sitzung.page) await sitzung.page.screenshot({ path: join(ordner, `${motiv.datei}.FEHLER.png`) }).catch(() => {});
        } finally {
          if (sitzung?.aufraeumen && sitzung.page) await tischVerlassen(sitzung.page);
          await sitzung?.ctx?.close().catch(() => {});
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (fehlerZahl > 0) {
    console.log(`${fehlerZahl} Motiv(e) mit Fehler — Bild *.FEHLER.png ansehen, mit --sichtbar nachfahren.`);
    process.exitCode = 1;
  }
}

await main();
