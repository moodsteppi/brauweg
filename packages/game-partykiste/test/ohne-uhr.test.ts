/**
 * Die drei Minispiele ohne Uhr (22.09.2026): Kategorien-Battle,
 * Mehrheitsraten, Regel-Karte.
 *
 * Eigene Datei statt Zeilen in partykiste.test.ts und inhalte.test.ts, weil
 * beide gleichzeitig von anderen Aenderungen angefasst werden. Was hier
 * haengen muss:
 *
 *   1. INHALTE: genug davon, jeder mit Haerte und Paket, kein Trinkbefehl.
 *   2. KATEGORIEN laeuft im Kreis und endet immer — durch Stocken, durch die
 *      Mehrheit oder weil die Kategorie leergespielt ist.
 *   3. MEHRHEIT verraet vor der Abrechnung niemandem, wohin sie kippt.
 *   4. REGEL-KARTE lebt ueber die Runde hinaus, rechnet trotzdem nur in
 *      \`werteAus\` ab — Rundenprotokoll und Turnierstand bleiben deckungsgleich.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_REGELN,
  KATEGORIEN,
  MEHRHEITSFRAGEN,
  MINDESTMENGE,
  PAKETE,
  PUNKTE,
  REGELKARTEN,
  SCHLUECKE,
  amZug,
  ausstieg,
  erzeugePartie,
  partykiste,
  sichtFuer,
  verarbeite,
  type Inhalt,
  type MinispielId,
  type PartykistePartie,
} from '../src/index.js';

function regeln(...minispiele: MinispielId[]) {
  return { ...DEFAULT_REGELN, minispiele };
}

function partie(minispiele: MinispielId[], sitze = 4, runden = 6, botSitze: number[] = [], saat = 11): PartykistePartie {
  return erzeugePartie({ regeln: regeln(...minispiele), saat, sitze, runden, botSitze, gastSitze: [] });
}

/** Alle Anwesenden tippen "Weiter" durch die Abrechnung. */
function weiterTippen(stand: PartykistePartie): PartykistePartie {
  let p = stand;
  for (let sitz = 0; sitz < p.sitze && p.runde.phase === 'ergebnis'; sitz++) {
    if (!p.ausgestiegen.includes(sitz) && !p.botSitze.includes(sitz)) p = verarbeite(p, sitz, { art: 'bereit' });
  }
  return p;
}

function spieleMitBots(stand: PartykistePartie, grenze = 20_000): PartykistePartie {
  let p = stand;
  for (let zug = 0; zug < grenze && !p.fertig; zug++) {
    const sitz = amZug(p);
    assert.notEqual(sitz, null, 'niemand am Zug, aber nicht fertig — der Tisch haengt');
    if (sitz === null) break;
    p = verarbeite(p, sitz, partykiste.botAction(sichtFuer(p, sitz), p.botStufe));
  }
  assert.equal(p.fertig, true, 'die Partie kommt nicht zu Ende');
  return p;
}

// ---------------------------------------------------------------------------
// 1. Inhalte
// ---------------------------------------------------------------------------

/** Dieselben zwei Stufen wie in inhalte.test.ts. */
const TRINKWORT = /trink|schluck|bier|shot|🍺|🍻|🥂|🥃|🍷|🍸/i;
const TRINKBEFEHL = /\b(trink|trinkt|trinke|trinkst|schluck|schlucke|schlückchen|shot|shots|prost)\b|🍺|🍻|🥂|🥃|🍷|🍸/i;

const NEUE: { name: string; katalog: readonly Inhalt[]; mindestens: number; praefix: string }[] = [
  { name: 'kategorien', katalog: KATEGORIEN, mindestens: 60, praefix: 'k' },
  { name: 'mehrheit', katalog: MEHRHEITSFRAGEN, mindestens: 60, praefix: 'm' },
  { name: 'regelkarten', katalog: REGELKARTEN, mindestens: 40, praefix: 'r' },
];

test('die neuen Kataloge sind gross genug und lueckenlos nummeriert', () => {
  for (const { name, katalog, mindestens, praefix } of NEUE) {
    assert.ok(katalog.length >= mindestens, `${name}: ${katalog.length} statt mindestens ${mindestens}`);
    assert.deepEqual(
      katalog.map((i) => i.id),
      Array.from({ length: katalog.length }, (_, i) => `${praefix}${String(i + 1).padStart(3, '0')}`),
      `${name}: Kennungen nicht lueckenlos`,
    );
  }
});

test('jeder neue Inhalt traegt ausdruecklich Haerte und mindestens ein Paket', () => {
  for (const { name, katalog } of NEUE) {
    for (const i of katalog) {
      assert.ok(i.haerte === 1 || i.haerte === 2 || i.haerte === 3, `${name} ${i.id}: Haerte fehlt`);
      assert.ok(i.paket && i.paket.length > 0, `${name} ${i.id}: kein Paket`);
      for (const p of i.paket ?? []) assert.ok((PAKETE as readonly string[]).includes(p), `${i.id}: Paket ${p}`);
    }
    /* Alle drei Stufen kommen vor — sonst ist der Regler "derb" fuer dieses Spiel eine Attrappe. */
    for (const h of [1, 2, 3]) assert.ok(katalog.some((i) => i.haerte === h), `${name}: keine Haerte ${h}`);
  }
});

test('harmlos und je Paket reicht jeder neue Katalog fuer einen vollen Tisch ohne Rueckfall', () => {
  /* Weil JEDER Eintrag ein Paket traegt, gibt es hier kein Allgemeingut —
     ein Paket-Tisch lebt allein von seinen eigenen Eintraegen. */
  for (const { name, katalog } of NEUE) {
    const harmlos = katalog.filter((i) => i.haerte === 1);
    assert.ok(harmlos.length >= Math.max(MINDESTMENGE, 12), `${name}: nur ${harmlos.length} harmlose`);
    for (const paket of PAKETE) {
      const zahl = harmlos.filter((i) => i.paket?.includes(paket)).length;
      assert.ok(zahl >= MINDESTMENGE, `${name}: nur ${zahl} harmlose im Paket ${paket}`);
    }
  }
});

test('keine Regel-Karte enthaelt ein Trinkwort, kein neuer Text fordert zum Trinken auf', () => {
  /* Regeln sind Befehle an alle — dieselbe strenge Stufe wie Wahrheit oder Pflicht. */
  assert.deepEqual(
    REGELKARTEN.filter((r) => TRINKWORT.test(r.text)).map((r) => r.id),
    [],
  );
  const texte = [
    ...KATEGORIEN.map((k) => ({ id: k.id, text: k.text })),
    ...MEHRHEITSFRAGEN.flatMap((m) => [m.frage, m.a, m.b].map((text) => ({ id: m.id, text }))),
    ...REGELKARTEN.map((r) => ({ id: r.id, text: r.text })),
  ];
  assert.deepEqual(texte.filter((t) => TRINKBEFEHL.test(t.text)).map((t) => `${t.id}: ${t.text}`), []);
});

test('jede Mehrheitsfrage hat zwei verschiedene Seiten', () => {
  for (const m of MEHRHEITSFRAGEN) {
    assert.notEqual(m.a.trim(), '', m.id);
    assert.notEqual(m.b.trim(), '', m.id);
    assert.notEqual(m.a, m.b, m.id);
  }
});

test('eine harmlose Partie zieht in keinem der drei Spiele Pikantes', () => {
  const pikant = new Set([...KATEGORIEN, ...MEHRHEITSFRAGEN, ...REGELKARTEN].filter((i) => (i.haerte ?? 1) > 1).map((i) => i.id));
  for (let saat = 0; saat < 25; saat++) {
    const p = erzeugePartie({ regeln: regeln('kategorien', 'mehrheit', 'regelkarte'), saat, sitze: 6, runden: 15, gastSitze: [] });
    let stand = p;
    for (let zug = 0; zug < 20_000 && !stand.fertig; zug++) {
      const r = stand.runde;
      const id = r.art === 'kategorien' ? r.kategorieId : r.art === 'mehrheit' ? r.frageId : r.art === 'regelkarte' ? r.karteId : '';
      assert.equal(pikant.has(id), false, `Saat ${saat}: ${id} an einem harmlosen Tisch`);
      const sitz = amZug(stand);
      if (sitz === null) break;
      stand = verarbeite(stand, sitz, partykiste.botAction(sichtFuer(stand, sitz)));
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Kategorien-Battle
// ---------------------------------------------------------------------------

test('Kategorien laeuft im Kreis — nicht jeder einmal, sondern bis einer stockt', () => {
  let p = partie(['kategorien'], 4, 3);
  const runde0 = p.runde;
  if (runde0.art !== 'kategorien') return assert.fail('falsches Minispiel');
  const start = runde0.amZug;
  /* Sechs Nennungen bei vier Sitzen: einmal ganz herum und weiter. */
  for (let i = 0; i < 6; i++) {
    const dran = amZug(p)!;
    assert.equal(dran, (start + i) % 4, `Nennung ${i}: der Falsche ist dran`);
    assert.throws(() => verarbeite(p, (dran + 1) % 4, { art: 'genannt' }), /anderer Sitz/);
    p = verarbeite(p, dran, { art: 'genannt' });
  }
  assert.equal(p.runde.phase, 'spiel', 'nach einer Runde um den Tisch ist noch nicht Schluss');
  const verlierer = amZug(p)!;
  p = verarbeite(p, verlierer, { art: 'gestockt' });
  assert.equal(p.runde.phase, 'ergebnis');
  for (let s = 0; s < 4; s++) {
    if (s === verlierer) {
      assert.equal(p.runde.schlucke[s], SCHLUECKE.kategorienVerloren);
      assert.equal(p.runde.punkte[s], 0);
    } else {
      assert.equal(p.runde.punkte[s], PUNKTE.kategorienDurch);
      assert.equal(p.runde.schlucke[s], 0);
    }
  }
});

test('Kategorien: die Mehrheit der Menschen benennt, wer gedoppelt hat', () => {
  let p = partie(['kategorien'], 5, 3);
  const dran = amZug(p)!;
  p = verarbeite(p, dran, { art: 'genannt' });
  /* `dran` hat eben genannt (und gedoppelt): Einspruch gegen den Letzten. */
  const andere = [0, 1, 2, 3, 4].filter((s) => s !== dran);
  assert.throws(() => verarbeite(p, dran, { art: 'einspruch', ziel: dran }), /Gestockt/);
  /* Vier Stimmberechtigte, also braucht es drei. */
  assert.equal(sichtFuer(p, andere[0]!).daten.art, 'kategorien');
  const daten = sichtFuer(p, andere[0]!).daten;
  if (daten.art !== 'kategorien') return assert.fail();
  assert.equal(daten.noetig[dran], 3);
  p = verarbeite(p, andere[0]!, { art: 'einspruch', ziel: dran });
  const doppelt = verarbeite(p, andere[0]!, { art: 'einspruch', ziel: dran });
  assert.equal(doppelt, p, 'derselbe Einspruch zweimal bleibt wirkungslos');
  p = verarbeite(p, andere[1]!, { art: 'einspruch', ziel: dran });
  assert.equal(p.runde.phase, 'spiel', 'zwei von vier reichen nicht');
  p = verarbeite(p, andere[2]!, { art: 'einspruch', ziel: dran });
  assert.equal(p.runde.phase, 'ergebnis');
  if (p.runde.art !== 'kategorien') return assert.fail();
  assert.equal(p.runde.verlierer, dran);
  assert.equal(p.runde.wie, 'mehrheit');
});

test('Kategorien: Einspruch gegen jemanden, dessen Zug vorbei ist, kommt zu spaet', () => {
  let p = partie(['kategorien'], 4, 3);
  const erster = amZug(p)!;
  p = verarbeite(p, erster, { art: 'genannt' });
  const zweiter = amZug(p)!;
  p = verarbeite(p, zweiter, { art: 'genannt' });
  const spaet = verarbeite(p, zweiter === 0 ? 1 : 0, { art: 'einspruch', ziel: erster });
  assert.equal(spaet, p, 'der Erste ist durch — Einspruch wirkungslos, kein Fehler');
});

test('Kategorien: Bots stimmen nicht mit — ein Mensch unter Bots entscheidet allein', () => {
  let p = partie(['kategorien'], 4, 3, [1, 2, 3]);
  /* Ist der Mensch (Sitz 0) dran, nennt er — danach ist ein Bot dran. */
  if (amZug(p) === 0) p = verarbeite(p, 0, { art: 'genannt' });
  if (p.runde.art !== 'kategorien') return assert.fail();
  const ziel = p.runde.amZug;
  assert.notEqual(ziel, 0);
  const daten = sichtFuer(p, 0).daten;
  if (daten.art !== 'kategorien') return assert.fail();
  assert.equal(daten.noetig[ziel], 1, 'nur Sitz 0 ist ein Mensch');
  p = verarbeite(p, 0, { art: 'einspruch', ziel });
  if (p.runde.art !== 'kategorien') return assert.fail();
  assert.equal(p.runde.verlierer, ziel);
});

test('Kategorien: eine leergespielte Kategorie endet ohne Verlierer', () => {
  let p = partie(['kategorien'], 4, 3);
  let zuege = 0;
  while (p.runde.phase === 'spiel') {
    assert.ok(++zuege <= 100, 'die Grenze greift nicht');
    p = verarbeite(p, amZug(p)!, { art: 'genannt' });
  }
  if (p.runde.art !== 'kategorien') return assert.fail();
  assert.equal(p.runde.nennungen, 16, 'vier Runden um den Tisch zu viert');
  assert.equal(p.runde.verlierer, -1);
  assert.deepEqual(p.runde.punkte, [1, 1, 1, 1]);
  assert.deepEqual(p.runde.schlucke, [0, 0, 0, 0]);
});

test('Kategorien: wer dran ist und aussteigt, wird im Kreis uebergangen', () => {
  let p = partie(['kategorien'], 5, 3);
  const dran = amZug(p)!;
  p = ausstieg(p, dran);
  const neu = amZug(p)!;
  assert.notEqual(neu, dran);
  assert.equal(neu, (dran + 1) % 5);
  /* Und bleibt nur einer uebrig, endet die Runde, statt auf einen Kreis zu warten. */
  for (const s of [0, 1, 2, 3, 4].filter((s) => s !== dran && s !== neu)) p = ausstieg(p, s);
  assert.notEqual(p.runde.phase, 'spiel');
});

test('Kategorien mit Bots endet, und Bots stocken — ein Anfaenger oefter als ein Genie', () => {
  const verloren = (stufe: 'anfaenger' | 'genie'): number => {
    let zahl = 0;
    for (let saat = 0; saat < 20; saat++) {
      const p = erzeugePartie({ regeln: regeln('kategorien'), saat, sitze: 6, runden: 3, botSitze: [0, 1, 2, 3, 4, 5], botStufe: stufe });
      const fertig = spieleMitBots(p);
      /* Eine Runde mit Schluck hatte einen Verlierer; leergespielt heisst: niemand trinkt. */
      zahl += fertig.protokoll.filter((r) => r.schlucke.some((n) => n > 0)).length;
    }
    return zahl;
  };
  const anfaenger = verloren('anfaenger');
  const genie = verloren('genie');
  assert.ok(anfaenger > 30, `von 60 Runden nur ${anfaenger} mit Verlierer — der Bot spielt nicht mit`);
  assert.ok(anfaenger > genie, `Anfaenger ${anfaenger}, Genie ${genie} — die Stufe wirkt nicht`);
});

// ---------------------------------------------------------------------------
// 3. Mehrheitsraten
// ---------------------------------------------------------------------------

test('Mehrheitsraten: gewertet wird der Tipp, die eigenen Antworten ergeben die Mehrheit', () => {
  let p = partie(['mehrheit'], 5, 3);
  /* Drei antworten A, zwei B. Sitz 0 und 3 tippen A (richtig), der Rest B. */
  const eingaben: [number, number][] = [[0, 0], [0, 1], [0, 1], [1, 0], [1, 1]];
  eingaben.forEach(([eigene, tipp], sitz) => {
    p = verarbeite(p, sitz, { art: 'mehrheitstipp', eigene, tipp });
  });
  assert.equal(p.runde.phase, 'ergebnis');
  if (p.runde.art !== 'mehrheit') return assert.fail();
  assert.equal(p.runde.mehrheit, 0);
  assert.deepEqual(p.runde.punkte, [2, 0, 0, 2, 0]);
  assert.deepEqual(p.runde.schlucke, [0, 1, 1, 0, 1]);
});

test('Mehrheitsraten: Gleichstand heisst keine Mehrheit — alle lagen daneben', () => {
  let p = partie(['mehrheit'], 4, 3);
  const eingaben: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]];
  eingaben.forEach(([eigene, tipp], sitz) => {
    p = verarbeite(p, sitz, { art: 'mehrheitstipp', eigene, tipp });
  });
  if (p.runde.art !== 'mehrheit') return assert.fail();
  assert.equal(p.runde.mehrheit, -1);
  assert.deepEqual(p.runde.schlucke, [1, 1, 1, 1]);
});

test('Mehrheitsraten: vor der Abrechnung steht keine fremde Antwort in der Sicht', () => {
  let p = partie(['mehrheit'], 4, 3);
  p = verarbeite(p, 0, { art: 'mehrheitstipp', eigene: 1, tipp: 0 });
  for (const sitz of [1, 2, 3, -1]) {
    const daten = sichtFuer(p, sitz).daten;
    if (daten.art !== 'mehrheit') return assert.fail();
    assert.equal(daten.eigene, null);
    assert.equal(daten.tipp, null);
    assert.equal(daten.mehrheit, null);
    assert.deepEqual(daten.gewaehlt, [0], 'dass Sitz 0 abgegeben hat, ist kein Geheimnis');
  }
  const meine = sichtFuer(p, 0).daten;
  if (meine.art !== 'mehrheit') return assert.fail();
  assert.equal(meine.meine, 1);
  assert.equal(meine.meinTipp, 0);
  assert.throws(() => verarbeite(p, 1, { art: 'mehrheitstipp', eigene: 2, tipp: 0 }), /A oder B/);
  assert.equal(verarbeite(p, 0, { art: 'mehrheitstipp', eigene: 0, tipp: 0 }), p, 'zweiter Tipp wirkungslos');
});

test('Mehrheitsraten: Bots tippen auf die haeufigere Antwort der Bots', () => {
  /* Ein Tisch voller Bots, ungerade Zahl: Jeder Bot rechnet die Antworten der
     anderen aus und liegt damit immer richtig. */
  for (let saat = 0; saat < 15; saat++) {
    const p = erzeugePartie({ regeln: regeln('mehrheit'), saat, sitze: 5, runden: 3, botSitze: [0, 1, 2, 3, 4] });
    let stand = p;
    for (let s = 0; s < 5; s++) stand = verarbeite(stand, s, partykiste.botAction(sichtFuer(stand, s)));
    /* Nur Bots am Tisch: Auf ihr "Weiter" wartet niemand, die Runde steht schon im Protokoll. */
    assert.equal(stand.protokoll.length, 1);
    assert.deepEqual(stand.protokoll[0]!.punkte, [2, 2, 2, 2, 2], `Saat ${saat}: ein Bot hat die Mehrheit verfehlt`);
  }
});

// ---------------------------------------------------------------------------
// 4. Regel-Karte
// ---------------------------------------------------------------------------

/** Regel-Karte, dann Ich hab noch nie, dann Quiz — die Karte gilt bis Runde 2. */
function mitKarte(sitze = 4): PartykistePartie {
  let p = partie(['regelkarte', 'niemals', 'quiz'], sitze, 6);
  for (let s = 0; s < sitze; s++) p = verarbeite(p, s, { art: 'bereit' });
  return p;
}

test('die Regel-Karte gilt ab dem Lesen bis zum Ende der uebernaechsten Runde', () => {
  let p = partie(['regelkarte', 'niemals', 'quiz'], 4, 6);
  assert.equal(p.regelKarte, null);
  assert.throws(() => verarbeite(p, 0, { art: 'genannt' }), /Regel lesen/);
  for (let s = 0; s < 4; s++) p = verarbeite(p, s, { art: 'bereit' });
  assert.equal(p.runde.phase, 'ergebnis');
  assert.ok(p.regelKarte, 'nach dem Lesen gilt die Regel');
  assert.equal(p.regelKarte!.ab, 0);
  assert.equal(p.regelKarte!.bis, 2);
  /* In jeder Sicht, auch beim Zuschauer — die Regel ist laut vorgelesen. */
  for (const sitz of [0, 3, -1]) assert.equal(sichtFuer(p, sitz).regelKarte?.text, p.regelKarte!.text);
  p = weiterTippen(p);
  assert.equal(p.runde.art, 'niemals');
  assert.ok(p.regelKarte, 'die Regel ueberlebt das Rundenende');
});

test('Verstoesse zaehlen selbst gemeldet sofort, angeklagt erst mit Mehrheit — und landen in der laufenden Runde', () => {
  let p = weiterTippen(mitKarte(4));
  assert.equal(p.runde.art, 'niemals');
  p = verarbeite(p, 1, { art: 'verstoss', ziel: 1 });
  assert.equal(p.regelKarte!.verstoesse[1], 1);
  /* Anklage gegen Sitz 3: drei Stimmberechtigte, also zwei noetig. */
  assert.equal(sichtFuer(p, 0).regelKarte!.noetig[3], 2);
  p = verarbeite(p, 0, { art: 'verstoss', ziel: 3 });
  assert.equal(p.regelKarte!.verstoesse[3], 0, 'eine Anklage allein zaehlt nicht');
  assert.equal(verarbeite(p, 0, { art: 'verstoss', ziel: 3 }), p, 'dieselbe Anklage zweimal bleibt wirkungslos');
  p = verarbeite(p, 2, { art: 'verstoss', ziel: 3 });
  assert.equal(p.regelKarte!.verstoesse[3], 1);
  assert.deepEqual(p.regelKarte!.anklage, [-1, -1, -1, -1], 'nach dem Verstoss fallen die Anklagen gegen ihn');

  for (let s = 0; s < 4; s++) p = verarbeite(p, s, { art: 'gestehen', ja: false });
  assert.equal(p.runde.phase, 'ergebnis');
  assert.deepEqual(p.runde.punkte, [1, 1, 1, 1], 'die Punkte von "Ich hab noch nie" bleiben');
  assert.deepEqual(p.runde.schlucke, [0, 1, 0, 1], 'die Verstoesse stehen in DIESER Abrechnung');
  assert.deepEqual(p.regelKarte!.offen, [0, 0, 0, 0], 'abgerechnet ist abgerechnet');
});

test('in der letzten Runde der Regel gibt es den Punkt fuer eine weisse Weste, danach ist sie weg', () => {
  let p = weiterTippen(mitKarte(4));
  p = verarbeite(p, 2, { art: 'verstoss', ziel: 2 });
  for (let s = 0; s < 4; s++) p = verarbeite(p, s, { art: 'gestehen', ja: false });
  p = weiterTippen(p);
  assert.equal(p.runde.art, 'quiz');
  if (p.runde.art !== 'quiz') return assert.fail();
  const richtig = p.runde.richtig;
  for (let s = 0; s < 4; s++) p = verarbeite(p, s, { art: 'antwort', wahl: richtig });
  assert.equal(p.runde.phase, 'ergebnis');
  assert.deepEqual(
    p.runde.punkte,
    [0, 1, 2, 3].map((s) => PUNKTE.quizRichtig + (s === 2 ? 0 : PUNKTE.regelSauber)),
  );
  assert.equal(p.regelKarte, null, 'nach Runde X+2 gilt die Regel nicht mehr');
  assert.equal(sichtFuer(p, 0).regelKarte, null);
});

test('in einer Abrechnung, nach der keine mehr kommt, ist Melden gesperrt statt verschluckt', () => {
  let p = weiterTippen(mitKarte(4));
  for (let s = 0; s < 4; s++) p = verarbeite(p, s, { art: 'gestehen', ja: false });
  /* Abrechnung von Runde 1: Runde 2 kommt noch, Melden geht. */
  assert.equal(sichtFuer(p, 0).regelKarte!.meldenMoeglich, true);
  const gemeldet = verarbeite(p, 0, { art: 'verstoss', ziel: 0 });
  assert.equal(gemeldet.regelKarte!.offen[0], 1, 'der Verstoss wartet auf die naechste Abrechnung');

  /* Eine Karte in der vorletzten Runde gilt nur bis zum Turnierende. */
  let kurz = erzeugePartie({ regeln: regeln('niemals', 'regelkarte'), saat: 5, sitze: 4, runden: 2, gastSitze: [] });
  for (let s = 0; s < 4; s++) kurz = verarbeite(kurz, s, { art: 'gestehen', ja: false });
  kurz = weiterTippen(kurz);
  for (let s = 0; s < 4; s++) kurz = verarbeite(kurz, s, { art: 'bereit' });
  assert.equal(kurz.runde.phase, 'ergebnis');
  assert.equal(kurz.regelKarte!.bis, 1, 'gekappt aufs Turnierende');
  assert.equal(sichtFuer(kurz, 0).regelKarte!.meldenMoeglich, false);
  assert.equal(verarbeite(kurz, 0, { art: 'verstoss', ziel: 0 }), kurz);
});

test('ohne geltende Regel bleibt eine Meldung wirkungslos, ein Unsinnssitz wird abgewiesen', () => {
  const p = partie(['niemals'], 4, 3);
  assert.equal(verarbeite(p, 0, { art: 'verstoss', ziel: 1 }), p);
  assert.throws(() => verarbeite(p, 0, { art: 'verstoss', ziel: 9 }), /Sitz/);
});

test('Rundenprotokoll und Turnierstand stimmen auch mit Verstoessen ueberein', () => {
  let p = erzeugePartie({ regeln: regeln('regelkarte', 'kategorien', 'mehrheit', 'quiz'), saat: 3, sitze: 6, runden: 12, gastSitze: [] });
  let zuege = 0;
  while (!p.fertig) {
    assert.ok(++zuege < 20_000);
    /* Jede siebte Gelegenheit meldet Sitz (zuege % 6) einen Verstoss bei sich selbst. */
    if (zuege % 7 === 0 && p.regelKarte && sichtFuer(p, 0).regelKarte?.meldenMoeglich) {
      p = verarbeite(p, zuege % 6, { art: 'verstoss', ziel: zuege % 6 });
      continue;
    }
    const sitz = amZug(p)!;
    p = verarbeite(p, sitz, partykiste.botAction(sichtFuer(p, sitz)));
  }
  const summe = (feld: 'punkte' | 'schlucke') =>
    Array.from({ length: 6 }, (_, s) => p.protokoll.reduce((n, r) => n + (r[feld][s] ?? 0), 0));
  assert.deepEqual(summe('punkte'), [...p.punkte]);
  assert.deepEqual(summe('schlucke'), [...p.schlucke]);
  assert.ok(p.schlucke.some((n) => n > 0));
});

test('ein Snapshot mit geltender Regel ueberlebt den Rundlauf, einer von davor spielt weiter', () => {
  const p = mitKarte(4);
  const wieder = partykiste.deserialize(partykiste.serialize(p));
  assert.deepEqual(wieder.regelKarte, p.regelKarte);

  /* Ein Snapshot von vor dem 22.09.2026 kennt das Feld nicht. */
  const alt = { ...partie(['niemals', 'quiz'], 4, 3) } as Record<string, unknown>;
  delete alt['regelKarte'];
  const altePartie = alt as unknown as PartykistePartie;
  assert.equal(sichtFuer(altePartie, 0).regelKarte, null);
  assert.equal(verarbeite(altePartie, 0, { art: 'verstoss', ziel: 0 }), altePartie);
  spieleMitBots(altePartie);
});

// ---------------------------------------------------------------------------
// Alle drei zusammen, mit allen Stufen
// ---------------------------------------------------------------------------

test('die drei ohne Uhr spielen zu jeder Sitzzahl und Inhaltsstufe mit Bots zu Ende', () => {
  for (const sitze of [4, 7, 12]) {
    for (const inhaltsHaerte of [1, 2, 3] as const) {
      for (const paket of [null, 'jga', 'arbeit'] as const) {
        const p = erzeugePartie({
          regeln: { ...regeln('kategorien', 'mehrheit', 'regelkarte'), inhaltsHaerte, paket },
          saat: sitze * 10 + inhaltsHaerte,
          sitze,
          runden: 9,
          gastSitze: [],
        });
        const fertig = spieleMitBots(p);
        assert.equal(fertig.protokoll.length, 9);
      }
    }
  }
});
