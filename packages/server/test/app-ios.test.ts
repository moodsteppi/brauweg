/**
 * Die iOS-Huelle (apps/ios) — geprueft auf jedem Rechner, nicht erst am Mac.
 *
 * Das Xcode-Projekt entsteht erst auf Toms MacBook (`xcodegen generate`), und
 * die XCTests laufen nur dort. Was Apple beim Hochladen oder in der Pruefung
 * ablehnt und was die Huelle mit dem Server verabreden muss, steht aber in
 * Textdateien — und die liest dieser Test: Bundle-ID, nur iPhone, nur
 * hochkant, Associated Domains, Privacy Manifest, keine Berechtigungstexte,
 * App-Symbol ohne Alphakanal. Dazu die Naht zum Server (`APP_ORIGIN`,
 * `APP_LINK_PFADE`) und zum Client (der Einladungspfad aus einladungslink.ts),
 * damit eine Umbenennung auf einer Seite nicht erst am Handy auffaellt.
 *
 * Bewusst ohne YAML-Bibliothek: project.yml ist flach genug fuer
 * Zeilenmuster, und eine neue Abhaengigkeit nur fuer diesen Test lohnt nicht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_ORIGIN } from '../src/http/app.js';
import { APP_LINK_PFADE } from '../src/http/app-verknuepfung.js';

// Aus packages/server/dist/test in die Wurzel des Repos.
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const IOS = join(WURZEL, 'apps', 'ios');

/**
 * Eine Datei der Huelle, Zeilenenden vereinheitlicht: Auf den Windows-Rechnern
 * steht sie mit CRLF auf der Platte (core.autocrlf), in der CI mit LF.
 */
function lies(...teile: string[]): string {
  return roh(join(IOS, ...teile)).replace(/\r\n/g, '\n');
}

/** Wie auf der Platte — fuer die Shell-Skripte, die LF haben MUESSEN (.gitattributes). */
function roh(pfad: string): string {
  return readFileSync(pfad, 'utf8');
}

/** Alle Werte eines Schluessels in project.yml (`SCHLUESSEL: wert`), ohne Anfuehrungszeichen. */
function werte(yml: string, schluessel: string): string[] {
  const muster = new RegExp(`^\\s*${schluessel}:\\s*(.+?)\\s*$`, 'gm');
  return [...yml.matchAll(muster)].map((m) => m[1]!.replace(/^"(.*)"$/, '$1'));
}

/** Die Strings eines Plist-Arrays hinter `<key>schluessel</key>`. */
function plistListe(plist: string, schluessel: string): string[] | null {
  const m = new RegExp(`<key>${schluessel}</key>\\s*<array>([\\s\\S]*?)</array>`).exec(plist);
  if (!m) return null;
  return [...m[1]!.matchAll(/<string>([^<]*)<\/string>/g)].map((s) => s[1]!);
}

/** Der Wert hinter `<key>schluessel</key>`: `true`, `false` oder der Text eines `<string>`. */
function plistWert(plist: string, schluessel: string): string | null {
  const m = new RegExp(`<key>${schluessel}</key>\\s*(<true\\s*/>|<false\\s*/>|<string>([^<]*)</string>)`).exec(plist);
  if (!m) return null;
  if (m[1]!.startsWith('<true')) return 'true';
  if (m[1]!.startsWith('<false')) return 'false';
  return m[2]!;
}

/** Die Plist ohne ihre Kommentare — dort darf von allem die Rede sein. */
function ohneKommentare(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, '');
}

test('project.yml: Bundle-ID, iOS 16, nur iPhone, keine Team-ID im Repo', () => {
  const yml = lies('project.yml');
  assert.deepEqual(werte(yml, 'PRODUCT_BUNDLE_IDENTIFIER'), ['de.brauweg.app', 'de.brauweg.app.tests']);
  const ziele = werte(yml, 'deploymentTarget');
  assert.ok(ziele.length >= 1 && ziele.every((z) => z === '16.0'), `deploymentTarget: ${ziele.join(', ')}`);
  const familien = werte(yml, 'TARGETED_DEVICE_FAMILY');
  assert.ok(familien.length >= 1 && familien.every((f) => f === '1'), `TARGETED_DEVICE_FAMILY: ${familien.join(', ')}`);
  // Die Team-ID haengt an Toms Konto: Lokal.xcconfig bzw. das Bauskript.
  assert.deepEqual(werte(yml, 'DEVELOPMENT_TEAM'), []);
  assert.deepEqual(werte(yml, 'INFOPLIST_FILE'), ['Konfiguration/Info.plist']);
  assert.deepEqual(werte(yml, 'GENERATE_INFOPLIST_FILE'), ['NO', 'YES']);
  // Push: vorbereitet, Vorgabe aus, und der Schalter waehlt die Berechtigungen.
  assert.deepEqual(werte(yml, 'BRAUWEG_PUSH'), ['NO']);
  assert.deepEqual(werte(yml, 'CODE_SIGN_ENTITLEMENTS'), ['Konfiguration/Push-$(BRAUWEG_PUSH).entitlements']);
  // Debug spricht mit Staging, Release mit der Produktion.
  assert.deepEqual(werte(yml, 'BRAUWEG_API_BASE'), [
    'https://staging.brauweg-spielen.de',
    'https://www.brauweg-spielen.de',
  ]);
});

test('project.yml: Ressourcen samt Privacy Manifest, Client per Build-Phase', () => {
  const yml = lies('project.yml');
  // Der Ordner Ressourcen ausdruecklich als Ressourcen — und darin das Manifest.
  assert.match(yml, /- path: Ressourcen\n(\s+#.*\n)*\s+buildPhase: resources/);
  assert.ok(existsSync(join(IOS, 'Ressourcen', 'PrivacyInfo.xcprivacy')));
  assert.ok(existsSync(join(IOS, 'Ressourcen', 'Assets.xcassets', 'AppIcon.appiconset', 'Contents.json')));
  // Die Build-Phase ruft das Skript, und das Skript holt den gebauten Client.
  assert.match(yml, /script: \/bin\/sh "\$SRCROOT\/werkzeug\/web-einbauen\.sh"/);
  const skript = roh(join(IOS, 'werkzeug', 'web-einbauen.sh'));
  assert.match(skript, /packages\/client\/dist/);
  assert.match(skript, /UNLOCALIZED_RESOURCES_FOLDER_PATH\/web/);
  assert.ok(!skript.includes('\r'), 'web-einbauen.sh mit CRLF bricht auf dem Mac ab');
  assert.ok(!roh(join(IOS, 'werkzeug', 'pruefen.sh')).includes('\r'), 'pruefen.sh mit CRLF');
  // Das erzeugte Projekt gehoert nicht ins Repo.
  const ignoriert = lies('.gitignore');
  assert.match(ignoriert, /^\*\.xcodeproj\/$/m);
  assert.match(ignoriert, /^Konfiguration\/Lokal\.xcconfig$/m);
});

test('Info.plist: hochkant, Ausfuhrangabe, keine Berechtigungstexte, kein offenes ATS', () => {
  const plist = ohneKommentare(lies('Konfiguration', 'Info.plist'));
  assert.deepEqual(plistListe(plist, 'UISupportedInterfaceOrientations'), ['UIInterfaceOrientationPortrait']);
  assert.ok(!plist.includes('UISupportedInterfaceOrientations~ipad'));
  assert.equal(plistWert(plist, 'ITSAppUsesNonExemptEncryption'), 'false');
  assert.deepEqual([...plist.matchAll(/<key>(NS\w*UsageDescription)<\/key>/g)].map((m) => m[1]), []);
  assert.ok(!plist.includes('NSAllowsArbitraryLoads'), 'nur HTTPS');
  assert.match(plist, /<key>UILaunchScreen<\/key>/);
  assert.equal(plistWert(plist, 'UISceneDelegateClassName'), '$(PRODUCT_MODULE_NAME).SzenenDelegat');
  assert.equal(plistWert(plist, 'BrauwegApiBasis'), '$(BRAUWEG_API_BASE)');
  assert.equal(plistWert(plist, 'BrauwegPush'), '$(BRAUWEG_PUSH)');
  // Die Farbe des Startbildschirms gibt es im Katalog.
  assert.equal(plistWert(plist, 'UIColorName'), 'Startfarbe');
  assert.ok(existsSync(join(IOS, 'Ressourcen', 'Assets.xcassets', 'Startfarbe.colorset', 'Contents.json')));
});

test('Berechtigungen: Associated Domains fuer beide Hosts, Push nur mit Schalter', () => {
  const hosts = new Set<string>();
  for (const [datei, mitPush] of [['Push-NO.entitlements', false], ['Push-YES.entitlements', true]] as const) {
    const plist = ohneKommentare(lies('Konfiguration', datei));
    const domains = plistListe(plist, 'com.apple.developer.associated-domains');
    assert.deepEqual(domains, ['applinks:www.brauweg-spielen.de', 'applinks:staging.brauweg-spielen.de'], datei);
    for (const d of domains!) hosts.add(d.replace(/^applinks:/, ''));
    assert.equal(plist.includes('<key>aps-environment</key>'), mitPush, datei);
  }
  // Dieselben Hosts oeffnet die Huelle (Huelle.linkHosts).
  const huelle = lies('Brauweg', 'Huelle.swift');
  const m = /static let linkHosts: Set<String> = \[([^\]]*)\]/.exec(huelle);
  assert.ok(m, 'linkHosts in Huelle.swift');
  const imCode = [...m[1]!.matchAll(/"([^"]+)"/g)].map((s) => s[1]!);
  assert.deepEqual(new Set(imCode), hosts);
});

test('Privacy Manifest: kein Tracking, Required-Reason-APIs nur mit Grund', () => {
  const manifest = ohneKommentare(lies('Ressourcen', 'PrivacyInfo.xcprivacy'));
  assert.equal(plistWert(manifest, 'NSPrivacyTracking'), 'false');
  assert.deepEqual(plistListe(manifest, 'NSPrivacyTrackingDomains') ?? [], []);
  assert.match(manifest, /<key>NSPrivacyTrackingDomains<\/key>\s*<array\s*\/>/);
  // Keine erhobene Datenart dient dem Tracking.
  assert.ok(!/<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<true/.test(manifest));

  /*
   * Die Required-Reason-APIs, die in Swift-Quellen am ehesten vorkommen. Wer
   * eine davon benutzt, muss die Kategorie mit Grund ins Manifest schreiben —
   * sonst lehnt App Store Connect den Upload ab (ITMS-91053).
   */
  const kategorien: Record<string, RegExp> = {
    NSPrivacyAccessedAPICategoryUserDefaults: /\bUserDefaults\b|@AppStorage/,
    NSPrivacyAccessedAPICategoryFileTimestamp:
      /\b(creationDate|modificationDate|contentModificationDateKey|creationDateKey|attributesOfItem)\b/,
    NSPrivacyAccessedAPICategorySystemBootTime: /\b(systemUptime|mach_absolute_time)\b/,
    NSPrivacyAccessedAPICategoryDiskSpace: /\b(volumeAvailableCapacity\w*|systemFreeSize|systemSize)\b/,
    NSPrivacyAccessedAPICategoryActiveKeyboards: /\bactiveInputModes\b/,
  };
  const quellen = readdirSync(join(IOS, 'Brauweg'))
    .filter((d) => d.endsWith('.swift'))
    .map((d) => lies('Brauweg', d).replace(/\/\/.*$/gm, ''))
    .join('\n');
  for (const [kategorie, muster] of Object.entries(kategorien)) {
    assert.equal(manifest.includes(kategorie), muster.test(quellen), kategorie);
  }
});

test('App-Symbol: 1024 x 1024 ohne Alphakanal (sonst lehnt Apple den Upload ab)', () => {
  const katalog = JSON.parse(lies('Ressourcen', 'Assets.xcassets', 'AppIcon.appiconset', 'Contents.json')) as {
    images: { filename?: string; size: string; idiom: string }[];
  };
  const datei = katalog.images.find((b) => b.size === '1024x1024')?.filename;
  assert.ok(datei, 'Symbol 1024x1024 im Katalog');
  const png = readFileSync(join(IOS, 'Ressourcen', 'Assets.xcassets', 'AppIcon.appiconset', datei));
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
  // Farbtyp 2 = RGB, 6 = RGBA. App Store Connect nimmt kein Symbol mit Alpha.
  assert.equal(png[25], 2, 'Farbtyp des PNG');
});

test('die Huelle spricht dieselbe Sprache wie Server und Client', () => {
  const huelle = lies('Brauweg', 'Huelle.swift');
  // Die Herkunft, an die der Server das Token herausgibt.
  assert.ok(huelle.includes(`static let herkunft = "${APP_ORIGIN}"`), `APP_ORIGIN ${APP_ORIGIN}`);
  assert.ok(huelle.includes('static let schema = "brauweg"') && huelle.includes('static let host = "app"'));

  // Der Einladungspfad: derselbe Ausdruck wie im Client.
  const swiftMuster = /static let beitrittMuster = "([^"]+)"/.exec(huelle)?.[1];
  const client = roh(join(WURZEL, 'packages', 'client', 'src', 'minispiele', 'partykiste', 'einladungslink.ts'));
  const clientMuster = /const PFAD = \/(.+)\/;/.exec(client)?.[1]?.replace(/\\\//g, '/');
  assert.ok(swiftMuster, 'beitrittMuster in Huelle.swift');
  assert.ok(clientMuster, 'PFAD in einladungslink.ts');
  assert.equal(swiftMuster, clientMuster);
  // Und der Server leitet genau diese Pfade an die App (apple-app-site-association).
  for (const pfad of APP_LINK_PFADE) {
    assert.ok(swiftMuster.startsWith('^' + pfad.replace(/\*$/, '')), pfad);
  }

  // Die Absprache mit dem Client (laufzeit.ts, zuruecktaste.ts) und Android (Huelle.kt).
  for (const name of ["plattform: 'ios'", 'push: ', 'pushErlauben:', 'teilen:', 'wachHalten:']) {
    assert.ok(huelle.includes(name), name);
  }
  assert.ok(huelle.includes('window.BRAUWEG_APP.pushToken = d'));
  assert.ok(huelle.includes('static let pushEreignis = "brauweg:push-token"'));
  assert.ok(huelle.includes('static let zurueckEreignis = "brauweg:zurueck"'));
});

test('ios-testflight.sh: erzeugt das Projekt vor dem Bauen und sagt, was fehlt', () => {
  const skript = roh(join(WURZEL, 'werkzeug', 'app', 'ios-testflight.sh'));
  assert.match(skript, /command -v xcodegen >\/dev\/null \|\| stirb "xcodegen fehlt — brew install xcodegen"/);
  const erzeugen = skript.indexOf('xcodegen generate');
  const bauen = skript.indexOf('xcodebuild archive');
  assert.ok(erzeugen > 0 && bauen > erzeugen, 'xcodegen generate vor xcodebuild archive');
  assert.match(skript, /-project "\$IOS\/Brauweg\.xcodeproj"/);
  assert.ok(!skript.includes('Brauweg-spiel-ios"'), 'kein Verweis mehr auf das nie angelegte Repo');
  assert.ok(!skript.includes('\r'));
});

test('XCTests fuer die reinen Swift-Teile liegen bereit', () => {
  const tests = readdirSync(join(IOS, 'BrauwegTests')).filter((d) => d.endsWith('.swift'));
  const alle = tests.map((d) => lies('BrauwegTests', d)).join('\n');
  for (const geprueft of ['PaketSchema.ziel', 'PaketSchema.antwort', 'Huelle.pfadFuerLink', 'Wegweiser.ziel', 'Haptik.pulse']) {
    assert.ok(alle.includes(geprueft), geprueft);
  }
  assert.match(lies('project.yml'), /testTargets:\n\s+- BrauwegTests/);
});
