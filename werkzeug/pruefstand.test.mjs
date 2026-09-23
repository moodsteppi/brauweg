/*
 * Prueft die Zaehlung in pruefstand.mjs so, wie sie am 23.09.2026 gebrochen
 * ist: mit einer Testausgabe AUS EINER DATEI. Node 24 schreibt ohne Terminal
 * das Spec-Format („ℹ pass 73"), das Werkzeug kannte nur TAP („# pass 73"),
 * zaehlte jedes Paket als 0 und meldete „Alle gruen".
 *
 * `testdaten/node24-spec.txt` ist eine unveraenderte Aufnahme von
 * `npm test --workspace @brauweg/game-mememory --workspace @brauweg/game-filler
 * > datei 2>&1` unter Node 24.16. Sie steht im Repo, weil die CI auf Node 22
 * laeuft und dort in eine Pipe TAP geschrieben wird — ohne die Aufnahme
 * waere der Spec-Weg in der CI nie geprueft. Die Laeufe unten erzeugen die
 * Ausgabe dagegen frisch mit der Node-Fassung, die gerade laeuft, und legen
 * sie ebenfalls erst in eine Datei.
 *
 *   npm run test:werkzeug
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { auswerten, bericht, gueltig, ungezaehlt } from "./pruefstand.mjs";

const hier = dirname(fileURLToPath(import.meta.url));
const werkzeug = join(hier, "pruefstand.mjs");
const aufnahme = join(hier, "testdaten", "node24-spec.txt");

/** Das Werkzeug als Programm, so wie die CI es aufruft: mit einem Dateinamen. */
function ausDatei(datei) {
  const lauf = spawnSync(process.execPath, [werkzeug, datei], { encoding: "utf8" });
  return { status: lauf.status, text: lauf.stdout };
}

/**
 * Laesst `node --test` mit dem gewuenschten Format echte Tests laufen, legt
 * die Ausgabe hinter eine npm-Ueberschrift in eine Datei und gibt den Pfad
 * zurueck. Die Ueberschrift ist noetig, weil das Werkzeug Zaehlzeilen nur
 * einem Paket zuordnet, dessen `test` npm angekuendigt hat.
 */
function echterLauf(ordner, format, { rot = false } = {}) {
  const datei = join(ordner, `probe-${format}${rot ? "-rot" : ""}.test.mjs`);
  writeFileSync(
    datei,
    [
      'import { test } from "node:test";',
      'test("eins", () => {});',
      'test("zwei", () => {});',
      'test("drei", () => {});',
      rot ? 'test("kaputt", () => { throw new Error("absichtlich"); });' : "",
    ].join("\n"),
  );
  // NODE_TEST_CONTEXT muss weg: Mit ihm meint der innere Lauf, er sei Kind
  // DIESES Testlaufs, und meldet seine Ergebnisse als Binaerstrom nach oben
  // statt als Text — die Datei enthielte dann gar keinen Nachspann.
  const { NODE_TEST_CONTEXT, ...umgebung } = process.env;
  const lauf = spawnSync(process.execPath, ["--test", `--test-reporter=${format}`, datei], {
    encoding: "utf8",
    env: umgebung,
  });
  const log = join(ordner, `lauf-${format}${rot ? "-rot" : ""}.log`);
  writeFileSync(log, `\n> @brauweg/game-probe@1.0.0 test\n> node --test\n\n${lauf.stdout}${lauf.stderr}`);
  return log;
}

test("die Node-24-Aufnahme aus der Datei wird gezaehlt, nicht als 0 gemeldet", () => {
  const { status, text } = ausDatei(aufnahme);
  assert.equal(status, 0);
  assert.match(text, /71 Mememory-Tests, 73 Filler-Tests — zusammen 144\./);
  assert.match(text, /Alle grün\./);
  assert.doesNotMatch(text, /\b0 \w+-Tests/);
});

test("die Aufnahme enthaelt wirklich das Spec-Format und kein TAP", () => {
  // Sonst prueft der Test oben nichts: Eine spaeter neu aufgenommene Datei im
  // TAP-Format liesse ihn auch mit dem alten Fehler gruen.
  const inhalt = readFileSync(aufnahme, "utf8");
  assert.match(inhalt, /^ℹ pass 73\r?$/mu);
  assert.doesNotMatch(inhalt, /^# pass /m);
});

test("Spec und TAP ergeben aus derselben Aufnahme dieselbe Zaehlung", () => {
  const spec = readFileSync(aufnahme, "utf8");
  const tap = spec.replace(/^ℹ /gmu, "# ");
  const a = auswerten(spec);
  const b = auswerten(tap);
  assert.deepEqual([...a], [...b]);
  assert.equal(a.get("game-mememory").tests, 71);
  assert.equal(a.get("game-filler").tests, 73);
});

for (const format of ["spec", "tap"]) {
  test(`ein frischer node --test-Lauf im Format ${format} wird aus der Datei gezaehlt`, () => {
    const ordner = mkdtempSync(join(tmpdir(), "pruefstand-"));
    try {
      const gruen = ausDatei(echterLauf(ordner, format));
      assert.equal(gruen.status, 0, gruen.text);
      assert.match(gruen.text, /3 game-probe-Tests — zusammen 3\./);
      assert.match(gruen.text, /Alle grün\./);

      const rot = ausDatei(echterLauf(ordner, format, { rot: true }));
      assert.match(rot.text, /🔴 Rot: game-probe \(1\)/);
      assert.doesNotMatch(rot.text, /Alle grün/);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });
}

test("ein Format, das das Werkzeug nicht kennt, scheitert laut statt gruen zu melden", () => {
  // Genau der Fehler vom 23.09.2026, nur mit einem erfundenen Zeichen, damit
  // der Test auch dann noch greift, wenn Node sein Format das naechste Mal
  // aendert.
  const ordner = mkdtempSync(join(tmpdir(), "pruefstand-"));
  try {
    const log = join(ordner, "fremd.log");
    const fremd = readFileSync(aufnahme, "utf8").replace(/^ℹ /gmu, "* ");
    writeFileSync(log, fremd);
    const { status, text } = ausDatei(log);
    assert.equal(status, 1);
    assert.match(text, /🔴 Nichts gezählt: game-mememory, game-filler/);
    assert.doesNotMatch(text, /Alle grün/);
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});

test("eine leere Ausgabe scheitert ebenfalls", () => {
  const pakete = auswerten("");
  assert.equal(gueltig(pakete), false);
  assert.match(bericht(pakete), /🔴 Keine Zählung/);
});

test("ein Paket mit 0 gemeldeten Tests gilt als nicht gezaehlt", () => {
  const pakete = auswerten("> @brauweg/game-leer@1.0.0 test\nℹ pass 0\nℹ fail 0\n");
  assert.deepEqual(ungezaehlt(pakete), ["game-leer"]);
  assert.equal(gueltig(pakete), false);
});

test("vitest zaehlt weiter, auch neben Spec-Paketen", () => {
  const pakete = auswerten(
    [
      "> @brauweg/game-skat@1.0.0 test",
      "ℹ pass 12",
      "ℹ fail 0",
      "> @brauweg/client@0.0.0 test",
      " Test Files  40 passed (40)",
      "      Tests  797 passed (797)",
    ].join("\n"),
  );
  assert.equal(gueltig(pakete), true);
  assert.match(bericht(pakete), /12 Skat-Tests — zusammen 12, dazu die Client-Tests \(40 Dateien, 797 Tests\)\./);
});
