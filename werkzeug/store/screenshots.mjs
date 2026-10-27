#!/usr/bin/env node
/**
 * Store-Screenshots fuer App Store und Google Play, automatisch gegen staging.
 *
 *   cd werkzeug/store
 *   npm ci                                # Playwright, nur hier — nicht im Client-Paket
 *   npx playwright install chromium       # einmal je Rechner, falls der Browser fehlt
 *   node screenshots.mjs --geraet ios --ziel ~/Broweg/release-brauweg/screenshots-1-0
 *
 * Weitere Schalter:
 *   --geraet ios|play     nur ein Geraet (Vorgabe: beide)
 *   --motiv <name>        nur ein Motiv (Name wie in MOTIVE unten, Teilwort genuegt)
 *   --basis <url>         Server, gegen den gespielt wird (Vorgabe: staging)
 *   --umfang <liste>      welchen Umfang der Client sehen soll (Vorgabe: der von 1.0,
 *                         siehe UMFANG_1_0; `alles` = was staging wirklich liefert)
 *   --ohne-umleitung      der Client spricht offen mit --basis (siehe unten)
 *   --sichtbar            Browserfenster zeigen (zum Nachsehen, wenn ein Motiv hakt)
 *
 * Warum so und nicht von Hand:
 *
 * - Die App ist dieselbe Web-Oberflaeche wie die Seite, nur mit
 *   `window.BRAUWEG_APP` und der Herkunft der Huelle. Beides setzt das Skript:
 *   `BRAUWEG_APP` vor der ersten Zeile des Clients, und jede API-Anfrage geht
 *   mit der Herkunft der Huelle hinaus (iOS `brauweg://app`, Android
 *   `https://appassets.androidplatform.net`). Der Server gibt dann die
 *   App-Auswahl und das Sitzungstoken heraus (`plattformVon`/`istAppHerkunft`
 *   in packages/server/src/http/app.ts). `route.continue` mit geaenderter
 *   Herkunft kommt in Chromium NICHT an (am 23.09.2026 ausprobiert: der
 *   Server sah weiter die Webseite) — deshalb holt das Skript jede Anfrage
 *   selbst (`route.fetch`) und reicht die Antwort durch.
 *
 * - Staging laeuft ohne `UMFANG` (packages/server/src/umfang.ts), zeigt also
 *   ALLES — auch die Partykiste und die Abstimmung unter „Kommt bald". Die
 *   Produktion fuer 1.0 laeuft mit einer Liste (docs/APP-RELEASE.md). Damit
 *   das Store-Bild zeigt, was die Pruefer bei Apple sehen (Richtlinie 2.3.3:
 *   kein Bild von etwas, das es in der App nicht gibt), schreibt das Skript
 *   die beiden Antworten um, an denen der Umfang haengt, genau so, wie der
 *   Server es mit gesetztem `UMFANG` taete: `/api/games` nur noch mit den
 *   Spielen der Liste und ohne Abstimm-Modi (`spieleFuer`/`abstimmModiFuer`
 *   in games/registry.ts), `/api/me` mit `umfang: [Liste]`. Die Oberflaeche
 *   bleibt die echte.
 *
 * - Der Client glaubt, er spreche mit der Produktion
 *   (`apiBase = https://www.brauweg-spielen.de`), und das Skript leitet alles
 *   nach staging um — HTTP ueber `route.fetch`, den WebSocket ueber eine
 *   Bruecke. Grund: Der QR-Code einer Einladung traegt `apiBase`
 *   (`einladungslink.ts`). Mit staging als `apiBase` stuende im Store-Bild ein
 *   Code, der auf die Testumgebung fuehrt. Was nicht umgeleitet werden kann,
 *   bricht das Skript ab, statt es zur Produktion durchzulassen.
 *   `--ohne-umleitung` schaltet das ab (dann zeigt der QR auf --basis).
 *
 * - `bypassCSP` und WebGL ueber SwiftShader: Die Kartenmanufaktur zeichnet mit
 *   PixiJS (manufaktur/szene/Szene.ts), und Pixi braucht `eval`. Die CSP der
 *   Webseite verbietet das — in der App gilt sie nicht (der Client kommt dort
 *   aus dem Paket, ohne CSP-Kopf). Ohne beides stuende die Werkstatt schwarz
 *   im Bild (am 27.10.2026 so gesehen: „keine Leinwand (WebGL)").
 *
 * - Ohne echte Personendaten: Jedes Motiv spielt als frisch angelegtes
 *   Gastkonto mit einem Vogelnamen, alle Mitspieler sind Bots. Gastkonten
 *   kosten keine Mail; der Server kappt 30 je Viertelstunde und Adresse
 *   (`/api/auth/gast`), ein voller Lauf fuer ein Geraet braucht sieben.
 *
 * - Keine Statusleiste: Chromium hat keine, und eine nachgemalte waere ein
 *   erfundenes Stueck Oberflaeche. Apple nimmt Bilder ohne Statusleiste.
 *
 * - Die Bilder gehoeren NICHT ins Repository (mehrere MB je Stueck). Die Liste
 *   der Motive steht in docs/store/SCREENSHOTS.md.
 *
 * Groessen (siehe docs/store/SCREENSHOTS.md):
 *   ios   440 x 956 CSS-Pixel, Faktor 3 → 1320 x 2868 (iPhone 6,9", Pflichtgroesse)
 *   play  360 x 640 CSS-Pixel, Faktor 3 → 1080 x 1920 (9:16, Mindestmass fuer
 *         die grossen Spiele-Empfehlungen bei Google Play)
 * Chromium schreibt PNG ohne Alphakanal (Farbtyp 2) — Apple lehnt Bilder mit
 * Alphakanal ab, das prueft `pruefePng` nach jedem Bild.
 *
 * Die Motive bis zum 23.09.2026 (Partykiste, „Spielauswahl") stehen in der
 * Geschichte dieser Datei; die Partykiste gibt es in der App nicht mehr, und
 * den Knopf „Spielauswahl" seit dem neuen Hub auch nicht.
 */

import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright';

/** Was die Produktion fuer 1.0 anbietet (`UMFANG`, docs/APP-RELEASE.md). */
const UMFANG_1_0 = 'doppelkopf,skat,filler,brochess,kartenmanufaktur,browort,clanwort,lernpfad';

const { values: arg } = parseArgs({
  options: {
    ziel: { type: 'string', default: 'ausgabe' },
    geraet: { type: 'string' },
    motiv: { type: 'string' },
    basis: { type: 'string', default: 'https://staging.brauweg-spielen.de' },
    umfang: { type: 'string', default: UMFANG_1_0 },
    'ohne-umleitung': { type: 'boolean', default: false },
    sichtbar: { type: 'boolean', default: false },
  },
});

const BASIS = arg.basis.replace(/\/+$/, '');
if (/\/\/(www\.)?brauweg-spielen\.de$/.test(BASIS)) {
  throw new Error('--basis zeigt auf die Produktion. Store-Bilder entstehen nur gegen staging (Testdaten).');
}
/** Was der Client fuer seinen Server haelt (siehe Kopf). */
const SCHEIN = arg['ohne-umleitung'] ? BASIS : 'https://www.brauweg-spielen.de';
/** `null` = nichts umschreiben (staging zeigt dann alles). */
const UMFANG =
  arg.umfang === 'alles'
    ? null
    : arg.umfang
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .sort();
const ZIEL = resolve(arg.ziel.replace(/^~(?=\/|$)/, homedir()));

const GERAETE = {
  ios: {
    name: 'ios-6.9',
    viewport: { width: 440, height: 956 },
    faktor: 3,
    herkunft: 'brauweg://app',
    plattform: 'ios',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  },
  play: {
    name: 'play-phone',
    viewport: { width: 360, height: 640 },
    faktor: 3,
    herkunft: 'https://appassets.androidplatform.net',
    plattform: 'android',
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  },
};

/**
 * Vogelnamen: erkennbar erfunden, keine Person. Der Server haengt eine Zahl
 * an, wenn der Name schon vergeben ist („Kiebitz 802") — die selteneren
 * Voegel vorn, damit das seltener passiert.
 */
const NAMEN = ['Rohrdommel', 'Wendehals', 'Bartmeise', 'Ziegenmelker', 'Brachvogel', 'Steinkauz', 'Beutelmeise', 'Kiebitz', 'Pirol', 'Zilpzalp', 'Gimpel', 'Stieglitz', 'Wiedehopf', 'Eisvogel', 'Kleiber'];
let namenZaehler = Math.floor(Math.random() * NAMEN.length);
const naechsterName = () => NAMEN[namenZaehler++ % NAMEN.length];

// ---------------------------------------------------------------------------
// Sitzung als App
// ---------------------------------------------------------------------------

/** Die zuletzt geoeffnete Seite — damit ein gescheitertes Motiv trotzdem ein Fehlerbild hinterlaesst. */
let letzteSitzung = null;

/**
 * Umfang wie mit gesetztem `UMFANG` (siehe Kopf). Nur GET-Antworten, und nur
 * die beiden, an denen der Client den Umfang abliest.
 */
function umfangAnwenden(pfad, methode, text) {
  if (!UMFANG || methode !== 'GET') return null;
  if (pfad === '/api/games') {
    const liste = JSON.parse(text);
    if (!Array.isArray(liste)) return null;
    return JSON.stringify(liste.filter((spiel) => UMFANG.includes(spiel.id)));
  }
  if (pfad === '/api/me') {
    const ich = JSON.parse(text);
    if (!ich || typeof ich !== 'object' || Array.isArray(ich)) return null;
    return JSON.stringify({ ...ich, umfang: UMFANG });
  }
  return null;
}

/**
 * staging fragt nach einem Passwort (STAGING_ZUGANG, packages/server/src/http/zugangsschutz.ts).
 * Dieselbe Variable hier gesetzt, schickt der Browser die Angabe mit.
 */
function stagingZugang() {
  const roh = process.env.STAGING_ZUGANG?.trim();
  if (!roh || !roh.includes(':')) return {};
  const i = roh.indexOf(':');
  return { httpCredentials: { username: roh.slice(0, i), password: roh.slice(i + 1) } };
}

async function appSeite(browser, geraet, { pfad = '/', lokal = {} } = {}) {
  const ctx = await browser.newContext({
    ...stagingZugang(),
    viewport: geraet.viewport,
    deviceScaleFactor: geraet.faktor,
    isMobile: true,
    hasTouch: true,
    userAgent: geraet.userAgent,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'dark',
    // Zwei Gruende, beide im Kopf: Die Seite muss den Schein-Server erreichen
    // (connect-src 'self'), und Pixi braucht eval — in der App gibt es keine
    // CSP. Aendert nichts am Bild, ausser dass die Werkstatt nicht schwarz bleibt.
    bypassCSP: true,
  });

  const antwort = await ctx.request.post(`${BASIS}/api/auth/gast`, {
    data: { name: naechsterName() },
    headers: { origin: geraet.herkunft },
  });
  if (!antwort.ok()) throw new Error(`Gastkonto: ${antwort.status()} ${await antwort.text()}`);
  const { token } = await antwort.json();
  if (!token) throw new Error('Gastkonto ohne Token — erkennt der Server die App-Herkunft nicht mehr?');

  // Jede API-Anfrage mit der Herkunft der Huelle, und — ausser mit
  // --ohne-umleitung — vom Schein-Server nach BASIS.
  const weiter = async (route) => {
    const anfrage = route.request();
    const url = anfrage.url().replace(SCHEIN, BASIS);
    let echt;
    try {
      echt = await route.fetch({ url, headers: { ...anfrage.headers(), origin: geraet.herkunft } });
    } catch {
      // Kontext schon zu (Motiv fertig) — dann will die Antwort niemand mehr.
      return;
    }
    // Die Seite liegt unter BASIS, der Schein-Server ist fuer sie eine fremde
    // Herkunft: Der Browser prueft die CORS-Freigabe, und die lautet auf die
    // Herkunft der Huelle. Also auf die Herkunft der Seite umschreiben — sonst
    // verwirft der Browser jede Antwort, und die Seite steht an der Anmeldung.
    const kopf = { ...echt.headers(), 'access-control-allow-origin': BASIS };
    let body;
    try {
      const neu = echt.ok() ? umfangAnwenden(new URL(url).pathname, anfrage.method(), await echt.text()) : null;
      if (neu !== null) {
        body = neu;
        delete kopf['content-length'];
        delete kopf['content-encoding'];
      }
    } catch {
      // Keine JSON-Antwort — unveraendert durchreichen.
    }
    await route.fulfill(body === undefined ? { response: echt, headers: kopf } : { status: echt.status(), headers: kopf, body }).catch(() => {});
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
    ([apiBase, plattform, sitzung, eintraege]) => {
      window.BRAUWEG_APP = { apiBase, plattform };
      localStorage.setItem('brauweg.sitzung', sitzung);
      for (const [k, v] of Object.entries(eintraege)) localStorage.setItem(k, v);
    },
    [SCHEIN, geraet.plattform, token, lokal],
  );

  const page = await ctx.newPage();
  letzteSitzung = { ctx, page };
  page.on('pageerror', (e) => console.warn(`  Seitenfehler: ${String(e).slice(0, 160)}`));
  await page.goto(`${BASIS}${pfad}`);
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

/** Knopf nach seinem zugaenglichen Namen (enthaelt der Knopf ein Pfeilzeichen o. ae., greift `klick` nicht). */
async function knopf(page, name, { warte = 1500, timeout = 10_000 } = {}) {
  await page.getByRole('button', { name }).first().click({ timeout });
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

async function sichtbarSel(page, selektor) {
  return page.locator(selektor).first().isVisible().catch(() => false);
}

/**
 * Reiter „Spiele" in der Leiste unten (Profil · Spiele · Start · Sammlung ·
 * Clan). aria-label statt Text: Der Reiter heisst mit Punkt z. B.
 * „Spiele, 2 bereit" (HubRahmen.tsx).
 */
async function zurSpielauswahl(page) {
  await klickSel(page, 'nav.hb-tabs button[aria-label^="Spiele"]', { warte: 2500, timeout: 15_000 });
}

/** Kachel antippen → Spielseite (Trophaeen, Rangliste) → „Zum Spiel". */
async function zumSpiel(page, spiel) {
  await zurSpielauswahl(page);
  await klick(page, spiel, { warte: 2500 });
  await knopf(page, /^\s*zum spiel\s*$/i, { warte: 2500 });
}

/**
 * Doppelkopf/Skat: privaten Tisch anlegen und alle freien Plaetze mit Bots
 * fuellen. Privat, damit auf staging niemand Fremdes dazukommt — der Tisch
 * nimmt dann nur, wen der Gastgeber hereinlaesst.
 */
async function botTisch(page, spiel, spieler) {
  await zumSpiel(page, spiel);
  await klick(page, 'Tisch erstellen', { warte: 2000 });
  // Die Spielerzahl ausdruecklich waehlen: Ohne gemerkte Einstellung schickt
  // die Lobby sonst 4 Sitze, auch bei Skat — dort gibt es nur 3
  // („Diese Spielerzahl gibt es bei diesem Spiel nicht", CHECKLISTE.md).
  // Skat hat nur eine Spielerzahl, dort steht der Knopf womoeglich gar nicht.
  await klick(page, `${spieler} Spieler`, { warte: 800, timeout: 3000 }).catch(() => {});
  await klick(page, 'Privat', { warte: 800, timeout: 3000 }).catch(() => {});
  await knopf(page, /^\s*tisch erstellen\s*$/i, { warte: 3000 });
  for (let i = 1; i < spieler; i++) await klick(page, '+ Bot', { warte: 1500 });
}

/** Ein API-Aufruf im Namen der Seite — ueber SCHEIN, damit ihn dieselbe Umleitung mit App-Herkunft nimmt. */
async function api(page, methode, pfad, body) {
  return page.evaluate(
    async ([basis, methode, pfad, body]) => {
      const token = localStorage.getItem('brauweg.sitzung');
      const r = await fetch(`${basis}/api${pfad}`, {
        method: methode,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: r.status, daten: await r.json().catch(() => null) };
    },
    [SCHEIN, methode, pfad, body],
  );
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

// --- Doppelkopf ------------------------------------------------------------

/** Handkarten, die man gerade legen darf (dieselbe Hand nutzt auch Skat). */
const SPIELBAR = '.doko-hand .doko-handcard[aria-disabled="false"]';
const IM_STICH = '.doko-trick .doko-trick-card';

/** Vorbehalt „gesund" ansagen, falls gefragt; der Tisch fragt danach noch einmal nach. */
async function gesundAnsagen(page) {
  const gesund = page.getByText('Ja, gesund').first();
  if (!(await gesund.isVisible().catch(() => false))) return false;
  await gesund.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(600);
  const ok = page.getByText(/^\s*Bestätigen\s*$/i).last();
  if (await ok.isVisible().catch(() => false)) await ok.click({ timeout: 2000 }).catch(() => {});
  return true;
}

/**
 * Wartet, bis man am Zug ist UND schon `liegen` Karten im Stich sind — so
 * zeigt das Bild einen Stich in Arbeit und nicht den leeren Tisch. Kommt man
 * vorher dran (man spielt aus), legt das Skript eine Karte und wartet auf den
 * naechsten Zug. Nach `hoechstens` eigenen Karten nimmt es, was da ist.
 */
async function dokoAmZug(page, { liegen = 2, hoechstens = 4, timeout = 120_000 } = {}) {
  const ende = Date.now() + timeout;
  let gelegt = 0;
  while (Date.now() < ende) {
    if (await gesundAnsagen(page)) continue;
    if (await sichtbarSel(page, SPIELBAR)) {
      // Kurz warten: Die Karten der Bots fliegen noch ein.
      await page.waitForTimeout(1200);
      const imStich = await page.locator(IM_STICH).count();
      if (imStich >= liegen || gelegt >= hoechstens) return;
      const karten = page.locator(SPIELBAR);
      const n = await karten.count();
      if (n > 0) {
        await karten.nth(Math.floor(Math.random() * n)).click({ timeout: 3000 }).catch(() => {});
        gelegt++;
      }
      await page.waitForTimeout(2500);
      continue;
    }
    const weiterKnopf = page.getByRole('button', { name: /^(weiter|nächste runde)$/i }).first();
    if (await weiterKnopf.isVisible().catch(() => false)) await weiterKnopf.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  throw new Error('Doppelkopf: nie am Zug');
}

// --- BroChess --------------------------------------------------------------

/**
 * Felder des Bretts tragen `data-feld="e2"`, die Zustaende sind CSS-Module
 * (BroChess.module.css) mit gehashtem Namen — daher `class*=`.
 */
const FELD = (f) => `[data-feld="${f}"]`;
const KLICKBAR = '[data-feld][class*="_klickbar_"]';
const ZIELFELD = '[data-feld][class*="_ziel"]';

/**
 * Bevorzugte Eroeffnungszuege je Farbe: Figur → Wunschfelder. Steht ein
 * Wunsch nicht als Ziel da, nimmt das Skript das erste angebotene Ziel; hat
 * die Figur keins, die naechste. So entsteht immer eine ruhige, glaubhafte
 * Stellung, egal was der Bot zieht.
 */
const ZUEGE = {
  weiss: [['e2', ['e4']], ['g1', ['f3']], ['b1', ['c3']], ['d2', ['d3', 'd4']], ['c1', ['e3', 'g5']]],
  schwarz: [['e7', ['e5']], ['g8', ['f6']], ['b8', ['c6']], ['d7', ['d6', 'd5']], ['c8', ['e6', 'g4']]],
};

async function schachZiehen(page, farbe, nr) {
  for (const [von, wunsch] of ZUEGE[farbe].slice(nr).concat(ZUEGE[farbe].slice(0, nr))) {
    const feld = page.locator(`${FELD(von)}[class*="_klickbar_"]`).first();
    if (!(await feld.isVisible().catch(() => false))) continue;
    await feld.click({ timeout: 3000 });
    await page.waitForTimeout(500);
    const ziele = await page.locator(ZIELFELD).evaluateAll((els) => els.map((el) => el.dataset.feld));
    if (ziele.length === 0) {
      await feld.click({ timeout: 3000 }).catch(() => {}); // abwaehlen
      continue;
    }
    const nach = wunsch.find((f) => ziele.includes(f)) ?? ziele[0];
    await page.locator(FELD(nach)).first().click({ timeout: 3000 });
    return true;
  }
  return false;
}

// --- Skat ------------------------------------------------------------------

const REIZEN = '.skat-reiz button.primary';

// ---------------------------------------------------------------------------
// Motive — Reihenfolge = Reihenfolge im Store (Satz 1.0, 27.10.2026)
// ---------------------------------------------------------------------------

const MOTIVE = [
  {
    datei: '01-spiele',
    titel: 'Reiter „Spiele": Doppelkopf, Skat, BroChess, Farbduell, darunter Kartenmanufaktur',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      await zurSpielauswahl(page);
      // Die Kacheln laden ihre Banner nach — warten, bis alle Bilder da sind.
      await page
        .waitForFunction(() => [...document.images].every((b) => b.complete), null, { timeout: 15_000 })
        .catch(() => {});
      await page.waitForTimeout(1500);
      return { ctx, page };
    },
  },
  {
    datei: '02-doppelkopf',
    titel: 'Doppelkopf zu viert gegen drei Bots, Stich in Arbeit, du bist dran',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      await botTisch(page, 'Doppelkopf', 4);
      await dokoAmZug(page, { liegen: 2 });
      await page.waitForTimeout(800);
      return { ctx, page, aufraeumen: true };
    },
  },
  {
    datei: '03-doppelkopf-lernen',
    titel: 'Doppelkopf lernen: Lektion „Bedienen & Stiche", erlaubte Karten markiert und geprueft',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      // Lektion 2 ist erst nach Lektion 1 frei. Lektion 1 schliesst das
      // Skript ueber dieselbe Route ab wie die App am Ende der Lektion
      // (`/api/lernpfad/lektion/:id/fertig`), statt durch acht Fragen zu klicken.
      const fertig = await api(page, 'POST', '/lernpfad/lektion/karten/fertig', {});
      if (fertig.status !== 200) throw new Error(`Lektion 1 abschliessen: ${fertig.status}`);
      await page.reload();
      await page.waitForLoadState('networkidle').catch(() => {});
      await ruhig(page);
      await klick(page, 'Doppelkopf lernen', { warte: 2500 });
      await klickSel(page, 'button[aria-label^="Lektion 2"]', { warte: 2500 });
      // Erster Schritt ist eine Erklaerung, der zweite „Was darfst du legen?".
      for (let i = 0; i < 3 && !(await sichtbarSel(page, '.ln-hand')); i++) {
        await klickSel(page, '.ln-fuss button', { warte: 1500 });
      }
      await page.locator('.ln-hand').first().waitFor({ state: 'visible', timeout: 10_000 });
      // Ole spielt Pik-Ass aus: erlaubt sind die beiden Pik-Karten.
      const pik = page.locator('.ln-hand .ln-handkarte', { hasText: '♠' });
      const n = await pik.count();
      if (n === 0) throw new Error('Lektion 2: keine Pik-Karte in der Hand — Lektion geaendert?');
      for (let i = 0; i < n; i++) {
        await pik.nth(i).click({ timeout: 3000 });
        await page.waitForTimeout(500);
      }
      await knopf(page, /^\s*prüfen\s*$/i, { warte: 1500 });
      return { ctx, page };
    },
  },
  {
    datei: '04-skat-reizen',
    titel: 'Skat gegen zwei Bots: „Du bist am Reizen"',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      for (let versuch = 1; ; versuch++) {
        await botTisch(page, 'Skat', 3);
        // Wer zuerst reizt, haengt am Geber — kommt man in dieser Runde nicht
        // dran (beide Bots passen vorher), neuer Tisch.
        const ort = page.locator(REIZEN).first();
        const dran = await ort
          .waitFor({ state: 'visible', timeout: 45_000 })
          .then(() => true)
          .catch(() => false);
        if (dran) break;
        if (versuch >= 3) throw new Error('Skat: dreimal nicht zum Reizen gekommen');
        await tischVerlassen(page);
        await page.goto(`${BASIS}/`);
        await page.waitForLoadState('networkidle').catch(() => {});
        await ruhig(page);
      }
      await page.waitForTimeout(1200);
      return { ctx, page, aufraeumen: true };
    },
  },
  {
    datei: '05-browort',
    titel: 'Browort: Wort des Tages, drei Versuche im Raster',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      await klick(page, 'Rate das Wort', { warte: 2500 });
      // Drei gaengige Woerter aus der Liste (packages/server/src/browort/woerter.ts).
      // Das Tageswort wechselt, also auch die Farben — ist eins davon zufaellig
      // die Loesung, zeigt das Bild eben den Sieg.
      for (const wort of ['karte', 'stern', 'laune']) {
        await page.keyboard.type(wort, { delay: 90 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2600);
      }
      await page.waitForTimeout(1000);
      return { ctx, page };
    },
  },
  {
    datei: '06-kartenmanufaktur',
    titel: 'Kartenmanufaktur: Werkstatt mit vier Etagen, Meistern, Paternoster und Lieferwagen',
    async machen(browser, geraet) {
      // Ein frisches Gastkonto hat eine leere Werkstatt mit einer Presse. Die
      // Probe `/probe/manufaktur?fall=mitte` ist die ECHTE Kartenmanufaktur
      // (manufaktur/Kartenmanufaktur.tsx) mit einem festen Stand nach einigen
      // Stunden Spiel, gerechnet mit demselben Kern wie der Server — nichts an
      // der Oberflaeche ist nachgestellt, nur der Stand (main.tsx, ProbeManufaktur.tsx).
      const { ctx, page } = await appSeite(browser, geraet, { pfad: '/probe/manufaktur?fall=mitte' });
      await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15_000 });
      // Pixi laedt die Bildteile nach; ohne Pause fehlen Paternoster und Wagen.
      await page.waitForTimeout(6000);
      return { ctx, page };
    },
  },
  {
    datei: '07-brochess',
    titel: 'BroChess gegen den Bot: Eroeffnung, eigene Figur angewaehlt mit Zielfeldern',
    async machen(browser, geraet) {
      const { ctx, page } = await appSeite(browser, geraet);
      await zumSpiel(page, 'BroChess');
      await knopf(page, /gegen bot spielen/i, { warte: 2000 });
      await knopf(page, /partie starten/i, { warte: 4000 });
      // Welche Farbe man hat, entscheidet das Los — am eigenen Koenig ablesen.
      await page.locator(KLICKBAR).first().waitFor({ state: 'visible', timeout: 30_000 });
      const eigenes = await page.locator(KLICKBAR).first().getAttribute('aria-label');
      const farbe = /weiß/i.test(eigenes ?? '') ? 'weiss' : 'schwarz';
      for (let zug = 0; zug < 3; zug++) {
        await page.locator(KLICKBAR).first().waitFor({ state: 'visible', timeout: 30_000 });
        await page.waitForTimeout(600);
        if (!(await schachZiehen(page, farbe, zug))) break;
        await page.waitForTimeout(2500);
      }
      // Fuer das Bild eine Figur mit mehreren Zielen anwaehlen, nicht ziehen.
      await page.locator(KLICKBAR).first().waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(1500);
      const laeufer = farbe === 'weiss' ? ['f1', 'c1', 'd1'] : ['f8', 'c8', 'd8'];
      for (const f of laeufer) {
        const feld = page.locator(`${FELD(f)}[class*="_klickbar_"]`).first();
        if (!(await feld.isVisible().catch(() => false))) continue;
        await feld.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        if ((await page.locator(ZIELFELD).count()) >= 2) break;
        await feld.click({ timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(600);
      return { ctx, page, aufraeumen: true };
    },
  },
];

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
  console.log(`Umfang: ${UMFANG ? UMFANG.join(', ') : 'alles (wie staging)'}`);
  const browser = await chromium.launch({
    headless: !arg.sichtbar,
    // WebGL ohne Grafikkarte, fuer die Pixi-Szene der Kartenmanufaktur (siehe Kopf).
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
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
