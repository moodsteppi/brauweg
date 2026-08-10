/**
 * Feldherr-Mitschnitte vom Produktivsystem holen und auswerten.
 *
 *   node packages/game-feldherr/werkzeug/diagnose-holen.mjs --email=… --passwort=…
 *
 * Es meldet sich an, laedt die Mitschnitte beider Geraete, legt sie als
 * .jsonl auf die Platte und schreibt daneben einen Bericht (.md), der die
 * eine Frage beantwortet, um die es geht: WO sind die beiden Laeufe
 * auseinandergegangen?
 *
 * Der Bericht vergleicht die Sitze gegeneinander — Saatkorn, ausgeliefertes
 * Buendel, Pruefsummen je Taktgrenze, Zugliste Stelle fuer Stelle — und
 * nennt die erste Abweichung. Alles Weitere (Spur, Fehlercodes, abgerissene
 * Verbindungen) steht darunter als Zeitleiste.
 *
 * Anmeldung, in dieser Reihenfolge:
 *   1. --schluessel=… oder DIAGNOSE_SCHLUESSEL (Kopfzeile, ohne Konto)
 *   2. --email=… (oder BRAUWEG_EMAIL); das Passwort fragt es selbst ab, mit
 *      verdeckter Eingabe. Nur wer es ausdruecklich als BRAUWEG_PASSWORT
 *      oder --passwort=… mitgibt, umgeht die Abfrage.
 * Das Konto muss ein Testkonto sein (STAFF_EMAILS am Dienst).
 *
 * Weitere Schalter:
 *   --ziel=https://www.brauweg-spielen.de   (Standard; staging.… fuer Staging)
 *   --stunden=48        Zeitfenster
 *   --tisch=<uuid>      nur eine Partie
 *   --ordner=diagnose   wohin die Dateien gehen
 *   --nur-strittig      nur Tische mit gemeldetem Gleichlaufverlust
 *
 * ACHTUNG Zugangsdaten: Ein Passwort auf der Kommandozeile steht in der
 * Prozessliste und in der Historie der Sitzung. Deshalb die Abfrage — dort
 * geht es durch keine der beiden.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

const args = new Map();
for (const roh of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(roh);
  if (m) args.set(m[1], m[2] ?? 'ja');
}
const opt = (name, fallback) => args.get(name) ?? fallback;

const ZIEL = String(opt('ziel', 'https://www.brauweg-spielen.de')).replace(/\/+$/, '');
const STUNDEN = Number(opt('stunden', 48));
const TISCH = opt('tisch', null);
const ORDNER = resolve(process.cwd(), String(opt('ordner', 'diagnose')));
const NUR_STRITTIG = args.has('nur-strittig');
/**
 * Diagnoseschluessel, in dieser Reihenfolge: Schalter, Umgebung, Datei
 * `.env.diagnose` im Wurzelverzeichnis des Repos.
 *
 * Die Datei ist der gedachte Weg. Ein Schluessel auf der Kommandozeile steht
 * in der Prozessliste und in der Historie; in der Umgebung vergisst man ihn.
 * `.env*` ist ohnehin schon aus Git ausgeschlossen.
 */
function schluesselAusDatei() {
  const wurzel = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
  const pfad = resolve(wurzel, '.env.diagnose');
  if (!existsSync(pfad)) return null;
  const treffer = /^\s*DIAGNOSE_SCHLUESSEL\s*=\s*(.+?)\s*$/m.exec(readFileSync(pfad, 'utf8'));
  return treffer ? treffer[1].replace(/^["']|["']$/g, '') : null;
}

const SCHLUESSEL =
  opt('schluessel', process.env.DIAGNOSE_SCHLUESSEL ?? null) ?? schluesselAusDatei();
const EMAIL = opt('email', process.env.BRAUWEG_EMAIL ?? null);
const PASSWORT = opt('passwort', process.env.BRAUWEG_PASSWORT ?? null);

// ---------------------------------------------------------------------------
// Anmeldung
// ---------------------------------------------------------------------------

/**
 * Passwort verdeckt abfragen.
 *
 * Weder in die Prozessliste noch in die Historie der Sitzung — und schon gar
 * nicht in ein Protokoll. Die Zeichen werden dabei gar nicht ausgegeben:
 * Sternchen verraten die Laenge, und das ist die einzige Angabe, die ein
 * Blick ueber die Schulter sonst mitnimmt.
 *
 * Ohne Terminal (Skript, Dienst) wird nicht gefragt, sondern klar
 * abgebrochen — eine Abfrage ins Leere haengt sonst ewig.
 */
function fragePasswort(text) {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Kein Terminal fuer die Passwortabfrage. Setze BRAUWEG_PASSWORT in der ' +
        'Umgebung oder nimm --schluessel=… .',
    );
  }
  return new Promise((fertig) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(text);
    let verdeckt = true;
    rl._writeToOutput = (s) => {
      if (!verdeckt) rl.output.write(s);
    };
    rl.question('', (wert) => {
      verdeckt = false;
      rl.close();
      process.stdout.write('\n');
      fertig(wert);
    });
  });
}

/**
 * Kopfzeilen fuer alle Abrufe.
 *
 * Das Sitzungs-Cookie kommt aus `set-cookie` der Anmeldung. Node schickt
 * Cookies nicht von selbst mit — es gibt keinen Cookie-Speicher in `fetch`,
 * und genau daran scheitert so ein Werkzeug beim ersten Versuch immer.
 */
async function anmelden() {
  if (SCHLUESSEL) {
    return { 'x-diagnose-schluessel': SCHLUESSEL };
  }
  if (!EMAIL) {
    throw new Error(
      'Kein Zugang. Entweder --schluessel=… (bzw. DIAGNOSE_SCHLUESSEL) oder ' +
        '--email=… (bzw. BRAUWEG_EMAIL) — nach dem Passwort wird dann gefragt.',
    );
  }
  const passwort = PASSWORT ?? (await fragePasswort(`Passwort fuer ${EMAIL}: `));
  const antwort = await fetch(ZIEL + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: passwort }),
  });
  if (!antwort.ok) {
    const text = await antwort.text().catch(() => '');
    throw new Error(`Anmeldung fehlgeschlagen (${antwort.status}): ${text.slice(0, 200)}`);
  }
  const rohe = antwort.headers.getSetCookie?.() ?? [];
  const cookie = rohe.map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Anmeldung ohne Sitzungs-Cookie — Server unerwartet.');
  return { cookie };
}

async function hole(pfad, kopf) {
  const antwort = await fetch(ZIEL + pfad, { headers: kopf });
  if (antwort.status === 403) {
    throw new Error(
      'Kein Zugriff auf die Diagnose. Das Konto ist kein Testkonto — die Adresse ' +
        'gehoert in STAFF_EMAILS am Dienst (wirkt beim naechsten Start).',
    );
  }
  if (!antwort.ok) {
    throw new Error(`${pfad} antwortete ${antwort.status}`);
  }
  return antwort.json();
}

// ---------------------------------------------------------------------------
// Zusammensetzen
// ---------------------------------------------------------------------------

/**
 * Aus den Portionen eines Sitzes wird ein durchgehender Mitschnitt.
 *
 * Jede Portion traegt den Index ihres ersten Ereignisses. Passt er nicht auf
 * das, was schon da ist, fehlt etwas — und das wird ausgewiesen statt
 * ueberspielt. Ein verschwiegenes Loch sieht aus wie ein ruhiger Abschnitt,
 * und genau in so einem Loch steckt der Fehler.
 */
function baueSitz(zeilen) {
  const ereignisse = [];
  const luecken = [];
  let erwartet = 0;
  let kopf = null;
  let verworfen = 0;
  const staende = [];

  for (const z of zeilen) {
    const r = z.rumpf ?? {};
    if (r.kopf && !kopf) kopf = r.kopf;
    if (typeof r.verworfen === 'number') verworfen = Math.max(verworfen, r.verworfen);
    if (r.stand) staende.push({ zeit: z.createdAt, grund: z.grund, ...r.stand });

    const ab = typeof r.ab === 'number' ? r.ab : erwartet;
    if (ab > erwartet) luecken.push({ von: erwartet, bis: ab, zeit: z.createdAt });
    const liste = Array.isArray(r.ereignisse) ? r.ereignisse : [];
    /* Doppelte Portionen (Wiederholung nach Zeitueberlauf) ueberlappen; nur
     * das Neue anhaengen. */
    const ueberlappung = Math.max(0, erwartet - ab);
    for (const e of liste.slice(ueberlappung)) ereignisse.push(e);
    erwartet = Math.max(erwartet, ab + liste.length);
  }

  return { kopf, ereignisse, luecken, verworfen, staende, portionen: zeilen.length };
}

/** Alle Ereignisse einer Art. */
const nur = (ereignisse, art) => ereignisse.filter((e) => e && e.art === art);

/**
 * Die erste Taktgrenze, an der die Pruefsummen der beiden Sitze
 * auseinandergehen. Das ist der Tatort: Bis dorthin rechneten beide Geraete
 * gleich, danach nicht mehr.
 */
function ersteAbweichung(a, b) {
  const summen = (ereignisse) => {
    const karte = new Map();
    for (const e of nur(ereignisse, 'probe')) {
      if (typeof e.g === 'number' && e.eigen) karte.set(e.g, e.eigen);
    }
    return karte;
  };
  const sa = summen(a);
  const sb = summen(b);
  const grenzen = [...new Set([...sa.keys(), ...sb.keys()])].sort((x, y) => x - y);
  let letzteGleich = null;
  for (const g of grenzen) {
    const x = sa.get(g);
    const y = sb.get(g);
    if (x === undefined || y === undefined) continue;
    if (x === y) {
      letzteGleich = g;
      continue;
    }
    return { grenze: g, a: x, b: y, letzteGleich };
  }
  return { grenze: null, letzteGleich };
}

/**
 * Zugliste eines Sitzes, so wie sie DORT ankam. Verglichen wird Stelle fuer
 * Stelle: Eine andere Reihenfolge, ein anderer Takt oder ein fehlender Zug
 * ist die haeufigste Ursache dafuer, dass zwei Geraete verschieden rechnen.
 */
function zugliste(ereignisse) {
  const liste = [];
  for (const e of nur(ereignisse, 'zug')) {
    if (typeof e.i !== 'number') continue;
    liste[e.i] = `${e.sitz}:${e.zt}:${e.zart}:${e.r ?? '-'},${e.c ?? '-'}${e.k ? ':' + e.k : ''}`;
  }
  return liste;
}

function ersterZugUnterschied(a, b) {
  const la = zugliste(a);
  const lb = zugliste(b);
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i += 1) {
    if (la[i] === undefined || lb[i] === undefined) continue;
    if (la[i] !== lb[i]) return { i, a: la[i], b: lb[i] };
  }
  return { i: null, laengeA: la.length, laengeB: lb.length };
}

/**
 * Loecher in der Spur: Sekunden ohne Lebenszeichen.
 *
 * Die Spur laeuft einmal je Sekunde. Fehlt sie ueber Sekunden, hat der
 * Browser den Tab eingefroren — der haeufigste Verdacht am Handy, und ohne
 * diese Auswertung nicht von "es war nichts los" zu unterscheiden.
 */
function spurLoecher(ereignisse, schwelle = 3000) {
  const spur = nur(ereignisse, 'spur');
  const loecher = [];
  for (let i = 1; i < spur.length; i += 1) {
    const abstand = spur[i].t - spur[i - 1].t;
    if (abstand >= schwelle) {
      loecher.push({ von: spur[i - 1].t, bis: spur[i].t, dauer: abstand, takt: spur[i - 1].k });
    }
  }
  return loecher;
}

const zeit = (ms) => `${(ms / 1000).toFixed(1)} s`;
const kurz = (wert, n = 90) => {
  const text = typeof wert === 'string' ? wert : JSON.stringify(wert);
  return text.length > n ? text.slice(0, n) + '…' : text;
};

/** Die Ereignisse, die im Bericht namentlich auftauchen. */
const AUFFAELLIG = new Set([
  'start', 'gleichlauf-verloren', 'fehler', 'warnung', 'ausgang', 'meldeErgebnis',
  'ws-zu', 'ws-offen', 'ws-abgelehnt', 'ws-verwahrt', 'ws-nachgereicht',
  'wachhund', 'stockt', 'tab', 'aufgabe', 'verlassen',
]);

function berichtFuerTisch(tisch, sitze) {
  const zeilen = [];
  const nummern = [...sitze.keys()].sort();
  zeilen.push(`## Tisch ${tisch ?? '(ohne Zuordnung)'}`);
  zeilen.push('');

  // --- Kopfdaten beider Geraete, nebeneinander ---
  zeilen.push('| | ' + nummern.map((n) => `Sitz ${n}`).join(' | '));
  zeilen.push('|---|' + nummern.map(() => '---').join('|'));
  const zelle = (fn) => nummern.map((n) => kurz(fn(sitze.get(n)) ?? '—', 60)).join(' | ');
  zeilen.push(`| Saatkorn | ${zelle((s) => s.kopf?.saat)} |`);
  zeilen.push(`| Buendel | ${zelle((s) => s.kopf?.buendel)} |`);
  zeilen.push(`| Protokoll | ${zelle((s) => s.kopf?.protokoll)} |`);
  zeilen.push(`| Held | ${zelle((s) => s.kopf?.held)} |`);
  zeilen.push(`| Geraet | ${zelle((s) => s.kopf?.geraet?.ua)} |`);
  zeilen.push(`| Bildschirm | ${zelle((s) => s.kopf?.geraet?.bildschirm)} |`);
  zeilen.push(`| Zeitzone | ${zelle((s) => s.kopf?.geraet?.zone)} |`);
  zeilen.push(`| Ereignisse | ${zelle((s) => s.ereignisse.length)} |`);
  zeilen.push(`| Portionen | ${zelle((s) => s.portionen)} |`);
  zeilen.push(`| verworfen | ${zelle((s) => s.verworfen)} |`);
  zeilen.push('');

  // --- Der Befund ---
  zeilen.push('### Befund');
  zeilen.push('');
  if (nummern.length < 2) {
    zeilen.push(
      '> Nur EIN Sitz hat gemeldet. Ein Vergleich ist damit nicht moeglich — ' +
        'entweder hat das andere Geraet nichts geschickt (Tab sofort zu, kein ' +
        'Netz) oder es spielte mit einer aelteren Fassung ohne Aufzeichnung.',
    );
    zeilen.push('');
  } else {
    const [a, b] = nummern.map((n) => sitze.get(n));
    const saatA = a.kopf?.saat;
    const saatB = b.kopf?.saat;
    if (saatA !== undefined && saatB !== undefined && saatA !== saatB) {
      zeilen.push(`- **Saatkoerner verschieden** (${saatA} gegen ${saatB}).`);
      zeilen.push('  Dann spielen die Geraete zwei verschiedene Partien; alles Weitere folgt daraus.');
    }
    if (a.kopf?.buendel && b.kopf?.buendel && a.kopf.buendel !== b.kopf.buendel) {
      zeilen.push(
        `- **Verschiedene Fassungen ausgeliefert** (${a.kopf.buendel} gegen ${b.kopf.buendel}).`,
      );
      zeilen.push(
        '  Ein Geraet haelt eine alte Seite offen. Nach einem Deploy verbinden alle ' +
          'offenen Geraete neu — mit dem ALTEN Buendel im Speicher.',
      );
    }
    const zug = ersterZugUnterschied(a.ereignisse, b.ereignisse);
    if (zug.i !== null) {
      zeilen.push(`- **Zuglisten weichen ab Stelle ${zug.i} ab.**`);
      zeilen.push(`  - Sitz ${nummern[0]}: \`${zug.a}\``);
      zeilen.push(`  - Sitz ${nummern[1]}: \`${zug.b}\``);
      zeilen.push('  Beide Geraete rechnen dieselbe Liste nach — hier tun sie es nicht.');
    }
    const ab = ersteAbweichung(a.ereignisse, b.ereignisse);
    if (ab.grenze !== null) {
      zeilen.push(`- **Erste ungleiche Pruefsumme an Taktgrenze ${ab.grenze}**`);
      zeilen.push(`  (Sitz ${nummern[0]}: \`${ab.a}\`, Sitz ${nummern[1]}: \`${ab.b}\`).`);
      zeilen.push(
        `  Letzte gemeinsame Grenze: ${ab.letzteGleich ?? '—'}. Der Fehler liegt also ` +
          `zwischen Takt ${ab.letzteGleich ?? 0} und ${ab.grenze} — bei 50 ms je Takt ` +
          `sind das ${zeit(((ab.grenze - (ab.letzteGleich ?? 0)) * 50))} Spielzeit.`,
      );
    } else if (zug.i === null && saatA === saatB) {
      zeilen.push(
        '- Keine ungleiche Pruefsumme und keine Zugabweichung gefunden. Wenn die ' +
          'Partie trotzdem strittig wurde, standen die Geraete verschieden WEIT ' +
          '(Ergebnismeldung bei verschiedenem Takt) — siehe `meldeErgebnis` unten.',
      );
    }
  }

  // --- Je Sitz: Loecher, Fehler, Zeitleiste ---
  for (const n of nummern) {
    const s = sitze.get(n);
    zeilen.push('');
    zeilen.push(`### Sitz ${n}`);
    zeilen.push('');
    if (s.luecken.length > 0) {
      zeilen.push(
        `**${s.luecken.length} Loch/Loecher im Mitschnitt** (Sendung verloren): ` +
          s.luecken.map((l) => `${l.von}–${l.bis}`).join(', '),
      );
      zeilen.push('');
    }
    const loecher = spurLoecher(s.ereignisse);
    if (loecher.length > 0) {
      zeilen.push('**Spur setzt aus** (Tab eingefroren oder Geraet ausgelastet):');
      for (const l of loecher.slice(0, 12)) {
        zeilen.push(`- bei ${zeit(l.von)} fuer ${zeit(l.dauer)} (Takt stand bei ${l.takt})`);
      }
      zeilen.push('');
    }
    const fehler = nur(s.ereignisse, 'fehler');
    if (fehler.length > 0) {
      const zaehler = new Map();
      for (const f of fehler) zaehler.set(f.code, (zaehler.get(f.code) ?? 0) + 1);
      zeilen.push('**Fehlercodes:** ' +
        [...zaehler].map(([c, k]) => `${c} (${k}×)`).join(', '));
      zeilen.push('');
    }

    zeilen.push('<details><summary>Zeitleiste</summary>');
    zeilen.push('');
    zeilen.push('```');
    for (const e of s.ereignisse) {
      if (!e || !AUFFAELLIG.has(e.art)) continue;
      const { t, art, ...rest } = e;
      zeilen.push(`${String(zeit(t)).padStart(9)}  ${art.padEnd(20)} ${kurz(rest, 150)}`);
    }
    zeilen.push('```');
    zeilen.push('');
    zeilen.push('</details>');

    if (s.staende.length > 0) {
      const letzte = s.staende[s.staende.length - 1];
      zeilen.push('');
      zeilen.push(`Letzter gemeldeter Gleichschritt-Stand (${letzte.grund}): ` +
        `Takt ${letzte.takt}, Gegner ${letzte.gegnerStand}, Wissensgrenze ${letzte.wissen}, ` +
        `schwebend ${JSON.stringify(letzte.schwebend ?? [])}, Zuege ${letzte.zuege}.`);
    }
  }

  zeilen.push('');
  return zeilen.join('\n');
}

// ---------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------

async function main() {
  const kopf = await anmelden();
  console.log(`Angemeldet an ${ZIEL} (${SCHLUESSEL ? 'Schluessel' : EMAIL}).`);

  const uebersicht = await hole(
    `/api/diagnose/feldherr/tische?stunden=${STUNDEN}`,
    kopf,
  );
  const tische = uebersicht.tische.filter(
    (t) => (!TISCH || t.tableId === TISCH) && (!NUR_STRITTIG || t.strittig),
  );
  console.log(`${tische.length} Tisch(e) mit Mitschnitt in den letzten ${STUNDEN} Stunden.`);
  for (const t of tische) {
    console.log(
      `  ${t.tableId ?? '(ohne)'}  ${t.zeilen} Zeilen, ${t.sitze} Sitz(e), ` +
        `${new Date(t.von).toISOString()} bis ${new Date(t.bis).toISOString()}` +
        (t.strittig ? '  [strittig gemeldet]' : ''),
    );
  }

  const seit = new Date(Date.now() - STUNDEN * 3600_000).toISOString();
  const abfrage = TISCH
    ? `/api/diagnose/feldherr?tisch=${encodeURIComponent(TISCH)}&grenze=5000`
    : `/api/diagnose/feldherr?seit=${encodeURIComponent(seit)}&grenze=5000`;
  const daten = await hole(abfrage, kopf);
  const zeilen = daten.zeilen ?? [];
  console.log(`${zeilen.length} Portion(en) geladen.`);

  mkdirSync(ORDNER, { recursive: true });
  const marke = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rohPfad = resolve(ORDNER, `feldherr-${marke}.jsonl`);
  writeFileSync(rohPfad, zeilen.map((z) => JSON.stringify(z)).join('\n') + '\n', 'utf8');

  // Nach Tisch und Sitz ordnen.
  const nachTisch = new Map();
  for (const z of zeilen) {
    if (TISCH && z.tableId !== TISCH) continue;
    if (!nachTisch.has(z.tableId)) nachTisch.set(z.tableId, new Map());
    const sitze = nachTisch.get(z.tableId);
    if (!sitze.has(z.seat)) sitze.set(z.seat, []);
    sitze.get(z.seat).push(z);
  }

  const teile = [
    `# Feldherr-Diagnose ${new Date().toISOString()}`,
    '',
    `Quelle: ${ZIEL} · Fenster: ${STUNDEN} h · ${zeilen.length} Portionen · ` +
      `${nachTisch.size} Tisch(e)`,
    '',
    'Rohdaten: `' + rohPfad + '`',
    '',
  ];
  for (const [tisch, sitzZeilen] of nachTisch) {
    if (NUR_STRITTIG) {
      const auffaellig = [...sitzZeilen.values()].some((zs) =>
        zs.some((z) => z.grund === 'strittig'),
      );
      if (!auffaellig) continue;
    }
    const sitze = new Map();
    for (const [sitz, zs] of sitzZeilen) {
      zs.sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt));
      sitze.set(sitz, baueSitz(zs));
    }
    teile.push(berichtFuerTisch(tisch, sitze));
  }

  const berichtPfad = resolve(ORDNER, `feldherr-${marke}.md`);
  writeFileSync(berichtPfad, teile.join('\n'), 'utf8');
  console.log(`\nBericht:   ${berichtPfad}\nRohdaten:  ${rohPfad}`);
}

main().catch((err) => {
  console.error(String(err.message ?? err));
  process.exit(1);
});
