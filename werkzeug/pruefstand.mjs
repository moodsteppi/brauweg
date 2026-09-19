#!/usr/bin/env node
/*
 * Zaehlt den Pruefstand aus der Ausgabe von `npm test` — statt ihn von Hand
 * fortzuschreiben.
 *
 * Bis zum 19.09.2026 stand die Zaehlung in zwei Dateien, die jede Aufgabe
 * anfasst (`CLAUDE.md` und `docs/STAND.md`), und die Regel lautete: messen und
 * eintragen. Bei einem Worker geht das. An diesem Tag liefen zehn gleichzeitig
 * los, und sechs Pull Requests kollidierten — alle in denselben drei Zeilen,
 * keiner im Code. Das war kein Unfall: Jede Zahl gilt nur fuer den Zweig, in
 * dem sie gemessen wurde, also widersprechen sich zehn ehrliche Messungen
 * zwangslaeufig.
 *
 * Gemessen wird deshalb weiter, eingetragen nicht mehr. Dieses Werkzeug liest
 * die Ausgabe des Laufs, der ohnehin passiert, und schreibt die Zahlen dorthin,
 * wo sie nicht kollidieren koennen: in die Zusammenfassung des CI-Laufs. Sie
 * gehoert zu genau einem Commit und ist damit richtiger als jede Zahl, die in
 * einer Datei auf den naechsten Merge wartet.
 *
 *   npm test | node werkzeug/pruefstand.mjs        # oertlich
 *   node werkzeug/pruefstand.mjs lauf.log          # aus einer Datei
 *
 * Gelesen werden zwei Ausgabeformate, weil das Repo zwei Testlaeufer hat:
 * `node --test` in den Paketen (TAP: „# pass 82") und vitest im Client
 * („Tests  797 passed"). Wer ein Paket hinzufuegt, muss hier nichts aendern —
 * unbekannte Pakete stehen am Ende der Zeile, statt zu verschwinden.
 */

import { readFileSync } from "node:fs";

/** Reihenfolge und Beschriftung wie bisher in docs/STAND.md. */
const BEKANNT = [
  ["game-doppelkopf", "Doppelkopf"],
  ["game-wizard", "Zauberer"],
  ["game-cambio", "Cambio"],
  ["game-skat", "Skat"],
  ["game-feldherr", "Feldherr"],
  ["game-mememory", "Mememory"],
  ["game-easypoker", "Easy-Poker"],
  ["game-filler", "Filler"],
  ["game-eiland", "Eiland"],
  ["game-tafelrunde", "Tafelrunde"],
  ["game-golf", "Golf"],
  ["game-partykiste", "Partykiste"],
];

// Farbcodes fallen weg — als echte Steuerzeichen (vitest an einem Terminal)
// und in der Karo-Schreibweise, in der `gh run view --log` sie ausliefert.
// Damit wertet dasselbe Werkzeug auch einen heruntergeladenen Lauf aus, ohne
// dass man den Lauf wiederholen muss.
const ANSI = /(?:|\^\[)\[[0-9;]*m/g;

function lies() {
  const datei = process.argv[2];
  if (datei) return readFileSync(datei, "utf8");
  return readFileSync(0, "utf8");
}

/**
 * Welches Paket gerade laeuft, verraet npm selbst: Vor jedem Workspace steht
 * „> @brauweg/<paket>@<version> test". Die Zaehlzeilen danach gehoeren dazu,
 * bis die naechste Ueberschrift kommt.
 */
export function auswerten(ausgabe) {
  const pakete = new Map();
  let aktuell = null;

  const nimm = (name) => {
    if (!pakete.has(name)) pakete.set(name, { tests: 0, fehler: 0, dateien: null });
    return pakete.get(name);
  };

  for (const rohe of ausgabe.split(/\r?\n/)) {
    const zeile = rohe.replace(ANSI, "");

    const kopf = zeile.match(/^\s*>\s+@brauweg\/([a-z0-9-]+)@\S+\s+test\s*$/);
    if (kopf) {
      aktuell = kopf[1];
      nimm(aktuell);
      continue;
    }
    if (!aktuell) continue;

    // node --test, TAP-Nachspann.
    const tapPass = zeile.match(/^#\s+pass\s+(\d+)\s*$/);
    if (tapPass) {
      nimm(aktuell).tests += Number(tapPass[1]);
      continue;
    }
    const tapFail = zeile.match(/^#\s+fail\s+(\d+)\s*$/);
    if (tapFail) {
      nimm(aktuell).fehler += Number(tapFail[1]);
      continue;
    }

    // vitest (Client). „1 failed | 796 passed (797)" kommt vor, deshalb beide
    // Zahlen einzeln suchen statt einer Gesamtzeile zu vertrauen.
    const vitestTests = zeile.match(/^\s*Tests\s+(.+?)\s*$/);
    if (vitestTests) {
      const bestanden = vitestTests[1].match(/(\d+)\s+passed/);
      const gescheitert = vitestTests[1].match(/(\d+)\s+failed/);
      if (bestanden) nimm(aktuell).tests += Number(bestanden[1]);
      if (gescheitert) nimm(aktuell).fehler += Number(gescheitert[1]);
      continue;
    }
    const vitestDateien = zeile.match(/^\s*Test Files\s+.*?(\d+)\s+passed/);
    if (vitestDateien) {
      nimm(aktuell).dateien = (nimm(aktuell).dateien ?? 0) + Number(vitestDateien[1]);
    }
  }

  return pakete;
}

export function bericht(pakete) {
  const teile = [];
  const gesehen = new Set(["client"]);

  for (const [paket, name] of BEKANNT) {
    const stand = pakete.get(paket);
    gesehen.add(paket);
    if (!stand) continue;
    teile.push(`${stand.tests} ${name}-Tests`);
  }

  // Ein neues Paket faellt hier auf, statt still zu fehlen.
  for (const [paket, stand] of pakete) {
    if (gesehen.has(paket) || paket === "server") continue;
    teile.push(`${stand.tests} ${paket}-Tests`);
  }

  const server = pakete.get("server");
  if (server) teile.push(`**${server.tests} Servertests**`);

  const client = pakete.get("client");
  const summe = [...pakete].reduce((n, [paket, s]) => (paket === "client" ? n : n + s.tests), 0);
  const fehler = [...pakete].filter(([, s]) => s.fehler > 0);

  const zeilen = ["## Prüfstand", ""];
  if (teile.length === 0) {
    zeilen.push("Keine Zählung in der Ausgabe gefunden — lief `npm test` überhaupt?");
    return zeilen.join("\n");
  }

  let satz = `${teile.join(", ")} — zusammen ${summe}`;
  if (client) {
    const dateien = client.dateien === null ? "?" : client.dateien;
    satz += `, dazu die Client-Tests (${dateien} Dateien, ${client.tests} Tests)`;
  }
  zeilen.push(`${satz}.`);

  if (fehler.length > 0) {
    zeilen.push("");
    zeilen.push(`🔴 Rot: ${fehler.map(([p, s]) => `${p} (${s.fehler})`).join(", ")}`);
  } else {
    zeilen.push("");
    zeilen.push("Alle grün.");
  }

  zeilen.push("");
  zeilen.push(
    "_Gemessen in diesem Lauf, gültig für genau diesen Commit._ Die Zahlen stehen " +
      "absichtlich in keiner Datei: Zehn Aufgabenzweige, die dieselbe Zeile " +
      "fortschreiben, kollidieren alle (19.09.2026, sechs Pull Requests).",
  );

  return zeilen.join("\n");
}

console.log(bericht(auswerten(lies())));
