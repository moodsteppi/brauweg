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
 * Gelesen werden die Ausgaben beider Testlaeufer des Repos: `node --test` in
 * den Paketen und vitest im Client („Tests  797 passed"). `node --test`
 * schreibt seinen Nachspann in ZWEI Formen — TAP („# pass 82") und Spec
 * („ℹ pass 82"). Welche kommt, haengt an der Node-Fassung und daran, ob ein
 * Terminal dranhaengt: Node 22 schreibt in eine Pipe TAP, Node 24 auch dorthin
 * Spec. Bis zum 23.09.2026 kannte dieses Werkzeug nur TAP; unter Node 24 aus
 * einer Datei gelesen zaehlte es jedes Paket als 0 und meldete trotzdem
 * „Alle gruen". Im Nachtlauf 22./23.09. hat das praktisch jeder Agent
 * getroffen und mit `sed 's/^ℹ /# /'` umschifft.
 *
 * Deshalb scheitert das Werkzeug jetzt laut, wenn es nichts zaehlt: Ein Paket,
 * dessen `test` lief und von dem keine Zahl kam, macht den Bericht rot und
 * den Exit-Code 1. Eine Zaehlung, die „gruen" sagt, ohne gezaehlt zu haben,
 * ist gefaehrlicher als gar keine. Geprueft wird das mit einer echten
 * Node-24-Ausgabe in `werkzeug/pruefstand.test.mjs` (`npm run test:werkzeug`).
 *
 * Wer ein Paket hinzufuegt, muss hier nichts aendern — unbekannte Pakete
 * stehen am Ende der Zeile, statt zu verschwinden.
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

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
  ["game-brocooked", "BroCooked"],
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
    if (!pakete.has(name)) pakete.set(name, { tests: 0, fehler: 0, dateien: null, gezaehlt: false });
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

    // node --test, Nachspann als TAP („# pass 82") oder Spec („ℹ pass 82").
    // Nur am Zeilenanfang: Eingerueckt waere es die Ausgabe eines Tests.
    const nodePass = zeile.match(/^(?:#|ℹ)\s+pass\s+(\d+)\s*$/u);
    if (nodePass) {
      const stand = nimm(aktuell);
      stand.tests += Number(nodePass[1]);
      stand.gezaehlt = true;
      continue;
    }
    const nodeFail = zeile.match(/^(?:#|ℹ)\s+fail\s+(\d+)\s*$/u);
    if (nodeFail) {
      const stand = nimm(aktuell);
      stand.fehler += Number(nodeFail[1]);
      stand.gezaehlt = true;
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
      if (bestanden || gescheitert) nimm(aktuell).gezaehlt = true;
      continue;
    }
    const vitestDateien = zeile.match(/^\s*Test Files\s+.*?(\d+)\s+passed/);
    if (vitestDateien) {
      nimm(aktuell).dateien = (nimm(aktuell).dateien ?? 0) + Number(vitestDateien[1]);
    }
  }

  return pakete;
}

/**
 * Pakete, deren `test` lief, ohne dass eine Zahl kam — oder die 0 Tests
 * gemeldet haben. Beides heisst: Hier wurde nichts geprueft, und „gruen"
 * waere gelogen. Genau so sah der Fehler vom 23.09.2026 aus.
 */
export function ungezaehlt(pakete) {
  return [...pakete]
    .filter(([, s]) => !s.gezaehlt || s.tests + s.fehler === 0)
    .map(([paket]) => paket);
}

/** Taugt die Zaehlung als Ergebnis? Sonst endet das Programm mit 1. */
export function gueltig(pakete) {
  return pakete.size > 0 && ungezaehlt(pakete).length === 0;
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
  if (pakete.size === 0) {
    zeilen.push("🔴 Keine Zählung in der Ausgabe gefunden — lief `npm test` überhaupt?");
    return zeilen.join("\n");
  }

  let satz = `${teile.join(", ")} — zusammen ${summe}`;
  if (client) {
    const dateien = client.dateien === null ? "?" : client.dateien;
    satz += `, dazu die Client-Tests (${dateien} Dateien, ${client.tests} Tests)`;
  }
  zeilen.push(`${satz}.`);

  const leer = ungezaehlt(pakete);
  if (leer.length > 0) {
    zeilen.push("");
    zeilen.push(
      `🔴 Nichts gezählt: ${leer.join(", ")} — der Test lief, aber aus der Ausgabe kam ` +
        "keine Zahl über 0. Entweder hat das Paket keinen einzigen Test, oder der " +
        "Testläufer schreibt ein Format, das dieses Werkzeug nicht kennt. Grün ist das nicht.",
    );
  }
  if (fehler.length > 0) {
    zeilen.push("");
    zeilen.push(`🔴 Rot: ${fehler.map(([p, s]) => `${p} (${s.fehler})`).join(", ")}`);
  } else if (leer.length === 0) {
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

// Nur als Programm lesen und melden — der Test importiert die Funktionen und
// soll dabei nicht auf die Standardeingabe warten. Rote Tests setzen den
// Exit-Code bewusst NICHT: Das meldet der Testlauf selbst, und in der CI
// steht dieser Schritt hinter `always()`. Eine leere Zaehlung dagegen meldet
// sonst niemand.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pakete = auswerten(lies());
  console.log(bericht(pakete));
  if (!gueltig(pakete)) process.exitCode = 1;
}
