/**
 * Inhaltsstufen genau statt Obergrenze, dazu „gemischt" (Robin, 27.09.2026).
 *
 * Bis dahin war `inhaltsHaerte` eine Obergrenze: Ein derber Tisch bekam
 * alles bis derb, und weil die Kataloge zu 60 % harmlos sind, praktisch vor
 * allem Harmloses. Jetzt liefert eine Stufe NUR sich selbst, „gemischt" zieht
 * je Stufe gleich oft — und ein alter Regelsatz ohne das neue Feld liest wie
 * am Tag davor. Geprueft wird hier:
 *
 *   - genau: nur die Stufe, solange sie reicht; danach mildere, nie derbere,
 *     und ohne Wiederholung, solange der Stapel reicht;
 *   - gemischt: jede erlaubte Stufe etwa gleich oft;
 *   - Gaeste: hoechstens pikant, auch bei „gemischt";
 *   - Eskalation: jedes Drittel genau seine Stufe, egal was eingestellt ist;
 *   - alte Regelsaetze und Snapshots: dieselbe Lesart wie vorher;
 *   - die Sicht: Stufe, Lesart und was ein Sitz gerade sieht (fuer „Passt nicht").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUFGABEN,
  DEFAULT_REGELN,
  ENTWEDER_ODER,
  IDENTITAETEN,
  IMPOSTER_WOERTER,
  INHALTS_KATALOGE,
  KATEGORIEN,
  MEHRHEITSFRAGEN,
  NIEMALS_SPRUECHE,
  QUIZ_FRAGEN,
  REGELKARTEN,
  SCHAETZ_FRAGEN,
  WER_EHER_SPRUECHE,
  ZEHN_SEKUNDEN,
  amZug,
  erzeugePartie,
  haerteVon,
  inhaltsStapel,
  partykiste,
  sichtFuer,
  verarbeite,
  waehlbareInhalte,
  type Haerte,
  type Inhalt,
  type InhaltsKatalog,
  type MinispielId,
  type PartykistePartie,
  type PartykisteRegeln,
} from '../src/index.js';

/** Katalogname → Eintraege, fuer die Haerte eines gezeigten Eintrags. `koenigsbecher` hat keine Stufe. */
const KATALOG: Partial<Record<InhaltsKatalog, readonly Inhalt[]>> = {
  imposter: IMPOSTER_WOERTER,
  quiz: QUIZ_FRAGEN,
  identitaeten: IDENTITAETEN,
  niemals: NIEMALS_SPRUECHE,
  wereher: WER_EHER_SPRUECHE,
  schaetzen: SCHAETZ_FRAGEN,
  entweder: ENTWEDER_ODER,
  wahrheitpflicht: AUFGABEN,
  kategorien: KATEGORIEN,
  mehrheit: MEHRHEITSFRAGEN,
  regelkarten: REGELKARTEN,
  zehnsekunden: ZEHN_SEKUNDEN,
};

function haerteDer(katalog: InhaltsKatalog, kennung: string): Haerte {
  const eintrag = KATALOG[katalog]?.find((e) => e.id === kennung);
  assert.ok(eintrag, `${katalog}/${kennung} steht in keinem Katalog`);
  return haerteVon(eintrag);
}

interface Gezogen {
  readonly nr: number;
  readonly katalog: InhaltsKatalog;
  readonly kennung: string;
  readonly haerte: Haerte;
}

/**
 * Spielt mit Bots zu Ende und sammelt je Runde, was Sitz 0 in der Abrechnung
 * vor sich hat — ueber `gezeigt`, also genau das, was „Passt nicht" meldet.
 * Die geltende Regel-Karte zaehlt nur in der Runde, in der sie gezogen wurde.
 */
function gezogeneInhalte(partie: PartykistePartie): Gezogen[] {
  const liste: Gezogen[] = [];
  const abgerechnet = new Set<number>();
  let stand = partie;
  for (let zug = 0; zug < 20_000 && !stand.fertig; zug++) {
    if (stand.runde.phase === 'ergebnis' && !abgerechnet.has(stand.rundeNr)) {
      abgerechnet.add(stand.rundeNr);
      const aktiv = stand.regelKarte?.karteId;
      for (const e of sichtFuer(stand, 0).gezeigt) {
        if (e.katalog === 'koenigsbecher') continue;
        if (e.katalog === 'regelkarten' && e.kennung === aktiv && stand.runde.art !== 'regelkarte') continue;
        liste.push({ nr: stand.rundeNr, katalog: e.katalog, kennung: e.kennung, haerte: haerteDer(e.katalog, e.kennung) });
      }
    }
    const sitz = amZug(stand);
    if (sitz === null) break;
    stand = verarbeite(stand, sitz, partykiste.botAction(sichtFuer(stand, sitz), stand.botStufe));
  }
  assert.equal(stand.fertig, true, 'die Partie kommt nicht zu Ende');
  return liste;
}

function regeln(
  inhaltsHaerte: Haerte,
  inhaltsMischung: PartykisteRegeln['inhaltsMischung'],
  minispiele: MinispielId[],
  extra: Partial<PartykisteRegeln> = {},
): PartykisteRegeln {
  const r: PartykisteRegeln = { ...DEFAULT_REGELN, minispiele, inhaltsHaerte, ...extra };
  if (inhaltsMischung === undefined) {
    const { inhaltsMischung: _weg, ...alt } = r;
    return alt;
  }
  return { ...r, inhaltsMischung };
}

function keineDoppelten(liste: readonly Gezogen[], wo: string): void {
  const schluessel = liste.map((e) => `${e.katalog}/${e.kennung}`);
  const doppelt = schluessel.filter((k, i) => schluessel.indexOf(k) !== i);
  assert.deepEqual(doppelt, [], `${wo}: mehrmals gezogen`);
}

/** Ein kuenstlicher Katalog: so viele derbe, pikante und harmlose Eintraege. */
function katalog(derb: number, pikant: number, harmlos: number): Inhalt[] {
  const liste: Inhalt[] = [];
  const dazu = (n: number, haerte: Haerte): void => {
    for (let i = 0; i < n; i++) liste.push({ id: `x${String(liste.length + 1).padStart(3, '0')}`, haerte });
  };
  /* Gemischt angelegt, nicht nach Stufen sortiert — der Stapel darf nicht an der Katalogreihenfolge haengen. */
  dazu(harmlos, 1);
  dazu(derb, 3);
  dazu(pikant, 2);
  return liste;
}

// ---------------------------------------------------------------------------
// genau
// ---------------------------------------------------------------------------

test('genau: ein derber Tisch zieht nur Derbes, solange der Katalog Derbes hat', () => {
  for (const saat of [1, 2, 3]) {
    const partie = erzeugePartie({ regeln: regeln(3, 'genau', ['niemals']), saat, sitze: 6, runden: 15, gastSitze: [] });
    const gezogen = gezogeneInhalte(partie);
    assert.equal(gezogen.length, 15);
    assert.deepEqual(
      gezogen.filter((e) => e.haerte !== 3).map((e) => e.kennung),
      [],
      `Saat ${saat}: nicht derb, obwohl der Katalog genug Derbes hat`,
    );
    keineDoppelten(gezogen, `Saat ${saat}`);
  }
});

test('genau: ein pikanter Abend mit allen Minispielen bringt weder Harmloses noch Derbes', () => {
  for (const saat of [1, 2, 4711]) {
    const partie = erzeugePartie({ regeln: regeln(2, 'genau', [...DEFAULT_REGELN.minispiele]), saat, sitze: 8, runden: 15, gastSitze: [] });
    const falsch = gezogeneInhalte(partie).filter((e) => e.haerte !== 2);
    assert.deepEqual(falsch, [], `Saat ${saat}`);
  }
});

test('genau: ist die Stufe erschoepft, kommt die naechst mildere — nie eine derbere, und nichts zweimal', () => {
  const k = katalog(2, 4, 12);
  const derb = inhaltsStapel(k, { inhaltsHaerte: 3, inhaltsMischung: 'genau', paket: null }, 's', 6, 'niemals');
  assert.deepEqual(
    derb.stapel.map(haerteVon),
    [3, 3, 2, 2, 2, 2, ...Array.from({ length: 12 }, () => 1)],
    'erst derb, dann pikant, dann harmlos',
  );
  assert.equal(new Set(derb.stapel.map((e) => e.id)).size, 18, 'jeder Eintrag genau einmal');
  assert.deepEqual(derb.rueckfall?.stufeDuenn, { stufe: 3, passend: 2 }, 'die duenne Stufe steht in der Runde');

  const pikant = inhaltsStapel(k, { inhaltsHaerte: 2, inhaltsMischung: 'genau', paket: null }, 's', 6, 'niemals');
  assert.deepEqual(pikant.stapel.map(haerteVon), [2, 2, 2, 2, ...Array.from({ length: 12 }, () => 1)]);

  /* Ganz ohne Derbes: beginnt bei pikant, haengt nicht, wird nicht leer. */
  const ohne = inhaltsStapel(katalog(0, 3, 12), { inhaltsHaerte: 3, inhaltsMischung: 'genau', paket: null }, 's', 6, 'x');
  assert.equal(ohne.stapel.length, 15);
  assert.equal(haerteVon(ohne.stapel[0]!), 2);
  assert.deepEqual(ohne.rueckfall?.stufeDuenn, { stufe: 3, passend: 0 });

  /* Reicht die Stufe, steht kein Rueckfall in der Runde. */
  assert.equal(inhaltsStapel(katalog(20, 0, 20), { inhaltsHaerte: 3, inhaltsMischung: 'genau', paket: null }, 's', 6, 'x').rueckfall, null);
});

test('genau: mit echtem Katalog und zu wenig Derbem (Schaetzen) weicht die Partie aus, ohne Wiederholung', () => {
  const derbe = SCHAETZ_FRAGEN.filter((f) => haerteVon(f) === 3).length;
  assert.ok(derbe < 15, 'Die Probe braucht einen Katalog mit weniger als fuenfzehn derben Fragen');
  const partie = erzeugePartie({ regeln: regeln(3, 'genau', ['schaetzen']), saat: 9, sitze: 6, runden: 15, gastSitze: [] });
  const gezogen = gezogeneInhalte(partie);
  assert.equal(gezogen.length, 15);
  assert.deepEqual(gezogen.slice(0, derbe).map((e) => e.haerte), Array.from({ length: derbe }, () => 3), 'erst alle derben');
  assert.ok(gezogen.slice(derbe).every((e) => e.haerte === 2), 'danach pikant — nicht harmlos, solange es Pikantes gibt');
  keineDoppelten(gezogen, 'Schaetzen derb');
});

// ---------------------------------------------------------------------------
// gemischt
// ---------------------------------------------------------------------------

test('gemischt: jede erlaubte Stufe kommt etwa gleich oft — nicht fast nur harmlos', () => {
  const zaehler = [0, 0, 0];
  for (let saat = 1; saat <= 30; saat++) {
    const { stapel } = inhaltsStapel(NIEMALS_SPRUECHE, { inhaltsHaerte: 3, inhaltsMischung: 'gemischt', paket: null }, String(saat), 6, 'niemals');
    assert.equal(new Set(stapel.map((e) => e.id)).size, stapel.length, 'nichts zweimal im Stapel');
    assert.equal(stapel.length, waehlbareInhalte(NIEMALS_SPRUECHE, { inhaltsHaerte: 3, paket: null }, 6).inhalte.length, 'alles Erlaubte liegt im Stapel');
    for (const e of stapel.slice(0, 12)) zaehler[haerteVon(e) - 1]! += 1;
  }
  const gesamt = zaehler.reduce((a, b) => a + b, 0);
  for (const [i, n] of zaehler.entries()) {
    assert.ok(n / gesamt > 0.25 && n / gesamt < 0.42, `Stufe ${i + 1}: ${n} von ${gesamt}`);
  }
});

test('gemischt mit Gast: harmlos und pikant, nie derb — und die Sicht sagt, was gewollt war', () => {
  const partie = erzeugePartie({
    regeln: regeln(3, 'gemischt', ['niemals', 'wereher', 'quiz', 'entweder']),
    saat: 3,
    sitze: 6,
    runden: 15,
    gastSitze: [2],
  });
  assert.equal(partie.regeln.inhaltsHaerte, 2);
  assert.equal(partie.inhaltsHaerteGewollt, 3);
  const sicht = sichtFuer(partie, 0);
  assert.equal(sicht.inhaltsMischung, 'gemischt');
  assert.equal(sicht.inhaltsHaerte, 2);
  assert.equal(sicht.inhaltsHaerteGewollt, 3);
  const stufen = new Set(gezogeneInhalte(partie).map((e) => e.haerte));
  assert.equal(stufen.has(3), false, 'derb trotz Gast');
  assert.ok(stufen.has(1) && stufen.has(2), 'gemischt heisst beide Stufen');
});

test('genau derb mit Gast wird genau pikant', () => {
  const partie = erzeugePartie({ regeln: regeln(3, 'genau', ['niemals']), saat: 5, sitze: 6, runden: 15, gastSitze: [0] });
  assert.equal(partie.regeln.inhaltsHaerte, 2);
  assert.ok(gezogeneInhalte(partie).every((e) => e.haerte === 2));
  /* Unbekannt, wer sitzt (Aufrufer ohne gastSitze): dieselbe strenge Seite. */
  const unbekannt = erzeugePartie({ regeln: regeln(3, 'gemischt', ['niemals']), saat: 5, sitze: 6, runden: 6 });
  assert.equal(unbekannt.regeln.inhaltsHaerte, 2);
});

// ---------------------------------------------------------------------------
// Alte Regelsaetze, Vorgabe, harmlos
// ---------------------------------------------------------------------------

test('harmlos: alle drei Lesarten ziehen Stelle fuer Stelle dasselbe', () => {
  const alt = inhaltsStapel(QUIZ_FRAGEN, { inhaltsHaerte: 1, paket: 'jga' }, 'a', 6, 'quiz');
  for (const inhaltsMischung of ['genau', 'gemischt'] as const) {
    const neu = inhaltsStapel(QUIZ_FRAGEN, { inhaltsHaerte: 1, paket: 'jga', inhaltsMischung }, 'a', 6, 'quiz');
    assert.deepEqual(neu.stapel.map((e) => e.id), alt.stapel.map((e) => e.id), inhaltsMischung);
  }
});

test('ein Regelsatz ohne inhaltsMischung liest wie bis zum 27.09.2026: Obergrenze', () => {
  /* Ueber createParty, wie ein wartender Tisch aus der Datenbank. */
  const { inhaltsMischung: _weg, ...altRegeln } = { ...DEFAULT_REGELN, minispiele: ['niemals'] as MinispielId[], inhaltsHaerte: 3 as const };
  assert.deepEqual(partykiste.validateConfig(altRegeln, 6, 15), []);
  const partie = partykiste.createParty({ config: altRegeln as PartykisteRegeln, seats: 6, rounds: 15, seed: 11, gastSeats: [] });
  assert.equal('inhaltsMischung' in partie.regeln, false, 'createParty erfindet das Feld nicht');
  assert.equal(sichtFuer(partie, 0).inhaltsMischung, 'bis');
  const stufen = new Set(gezogeneInhalte(partie).map((e) => e.haerte));
  assert.ok(stufen.has(1), 'bis derb heisst: auch Harmloses — wie vorher');

  /* Der Stapel ist Stelle fuer Stelle der von davor (Filter bis zur Stufe). */
  const bis = inhaltsStapel(NIEMALS_SPRUECHE, { inhaltsHaerte: 3, paket: null }, 'z', 6, 'niemals');
  const menge = new Set(waehlbareInhalte(NIEMALS_SPRUECHE, { inhaltsHaerte: 3, paket: null }, 6).inhalte.map((e) => e.id));
  assert.equal(bis.stapel.length, menge.size);
  assert.ok(bis.stapel.every((e) => menge.has(e.id)));
});

test('ein Snapshot einer alten Partie bleibt bei der alten Lesart — die naechste Runde zieht dasselbe', () => {
  const { inhaltsMischung: _weg, ...altRegeln } = { ...DEFAULT_REGELN, minispiele: ['niemals', 'quiz'] as MinispielId[], inhaltsHaerte: 3 as const };
  const partie = erzeugePartie({ regeln: altRegeln, saat: 21, sitze: 6, runden: 10, gastSitze: [] });
  const wieder = partykiste.deserialize(JSON.parse(JSON.stringify(partykiste.serialize(partie))));
  assert.equal(sichtFuer(wieder, 0).inhaltsMischung, 'bis');
  assert.deepEqual(gezogeneInhalte(wieder), gezogeneInhalte(partie));
});

test('inhaltsMischung: fehlt oder bekannt geht durch, Unsinn wird gemeldet und nie geworfen', () => {
  for (const inhaltsMischung of [undefined, 'genau', 'gemischt']) {
    assert.deepEqual(partykiste.validateConfig({ ...DEFAULT_REGELN, inhaltsMischung }, 6, 6), [], String(inhaltsMischung));
  }
  for (const unsinn of ['bunt', 3, null, true]) {
    const probleme = partykiste.validateConfig({ ...DEFAULT_REGELN, inhaltsMischung: unsinn }, 6, 6);
    assert.ok(
      probleme.some((p) => p.path === 'inhaltsMischung' && p.messageKey === 'ruleset.partykiste.inhaltsMischung'),
      `${JSON.stringify(unsinn)} ging durch`,
    );
    const partie = partykiste.createParty({
      config: { ...DEFAULT_REGELN, inhaltsHaerte: 3, inhaltsMischung: unsinn } as never,
      seats: 6,
      rounds: 6,
      seed: 1,
      gastSeats: [],
    });
    assert.equal('inhaltsMischung' in partie.regeln, false, 'Unsinn wird die alte Lesart, nicht „gemischt"');
  }
});

test('die Vorgabe des Moduls liest genau — neue Tische bekommen die neue Lesart', () => {
  assert.equal((partykiste.defaultConfig() as PartykisteRegeln).inhaltsMischung, 'genau');
  const partie = partykiste.createParty({ config: partykiste.defaultConfig(), seats: 6, rounds: 6, seed: 1, gastSeats: [] });
  assert.equal(partie.regeln.inhaltsMischung, 'genau');
});

// ---------------------------------------------------------------------------
// Eskalation
// ---------------------------------------------------------------------------

test('Eskalation: jedes Drittel zieht genau seine Stufe — auch an einem „gemischt"-Tisch', () => {
  for (const inhaltsMischung of ['genau', 'gemischt', undefined] as const) {
    const partie = erzeugePartie({
      regeln: regeln(1, inhaltsMischung, ['niemals'], { modus: 'eskalation' }),
      saat: 8,
      sitze: 6,
      runden: 6,
      gastSitze: [],
    });
    assert.deepEqual(gezogeneInhalte(partie).map((e) => e.haerte), [1, 1, 2, 2, 3, 3], String(inhaltsMischung));
  }
  /* Mit Gast steigt die Kurve nie ueber pikant. */
  const mitGast = erzeugePartie({ regeln: regeln(3, 'gemischt', ['niemals'], { modus: 'eskalation' }), saat: 8, sitze: 6, runden: 6, gastSitze: [1] });
  assert.deepEqual(gezogeneInhalte(mitGast).map((e) => e.haerte), [1, 1, 2, 2, 2, 2]);
});

// ---------------------------------------------------------------------------
// Die Sicht: was ein Sitz gerade sieht
// ---------------------------------------------------------------------------

function bisPhase(partie: PartykistePartie, phase: 'ergebnis'): PartykistePartie {
  let stand = partie;
  for (let zug = 0; zug < 500 && stand.runde.phase !== phase; zug++) {
    const sitz = amZug(stand);
    if (sitz === null) break;
    stand = verarbeite(stand, sitz, partykiste.botAction(sichtFuer(stand, sitz), stand.botStufe));
  }
  assert.equal(stand.runde.phase, phase);
  return stand;
}

test('gezeigt: der Imposter bekommt die Kennung seines Wortes erst im Ergebnis, der Zuschauer auch', () => {
  const partie = erzeugePartie({ regeln: regeln(1, 'genau', ['imposter']), saat: 4, sitze: 6, runden: 3, gastSitze: [] });
  const runde = partie.runde;
  if (runde.art !== 'imposter') return assert.fail('kein Imposter');
  for (let sitz = -1; sitz < 6; sitz++) {
    const gezeigt = sichtFuer(partie, sitz).gezeigt;
    const soll: { katalog: string; kennung: string; text: string }[] = sitz >= 0 && sitz !== runde.imposter ? [{ katalog: 'imposter', kennung: runde.wortId, text: runde.wort }] : [];
    assert.deepEqual(gezeigt, soll, `Sitz ${sitz}`);
    /* Und nichts davon verraet dem Imposter-Sitz etwas: kein Wort, keine Kennung. */
    if (sitz === runde.imposter) assert.equal(JSON.stringify(sichtFuer(partie, sitz)).includes(runde.wortId), false);
  }
  const auf = bisPhase(partie, 'ergebnis');
  assert.deepEqual(sichtFuer(auf, runde.imposter).gezeigt.map((e) => e.kennung), [runde.wortId]);
});

test('gezeigt: bei „Wer bin ich" fehlt die Kennung des eigenen Namens', () => {
  const partie = erzeugePartie({ regeln: regeln(1, 'genau', ['werbinich']), saat: 4, sitze: 5, runden: 3, gastSitze: [] });
  const runde = partie.runde;
  if (runde.art !== 'werbinich') return assert.fail('kein Wer bin ich');
  for (let sitz = 0; sitz < 5; sitz++) {
    const kennungen = sichtFuer(partie, sitz).gezeigt.map((e) => e.kennung);
    assert.deepEqual(kennungen, runde.identitaeten.filter((_, s) => s !== sitz), `Sitz ${sitz}`);
  }
  assert.deepEqual(sichtFuer(partie, -1).gezeigt, [], 'der Zuschauer sieht keine Namen');
});

test('gezeigt: bei „10 Sekunden" steht die Aufgabe erst nach dem „Los" drin', () => {
  const partie = erzeugePartie({ regeln: regeln(1, 'genau', ['zehnsekunden']), saat: 4, sitze: 5, runden: 3, gastSitze: [] });
  const runde = partie.runde;
  if (runde.art !== 'zehnsekunden') return assert.fail('kein 10 Sekunden');
  for (let sitz = 0; sitz < 5; sitz++) assert.deepEqual(sichtFuer(partie, sitz).gezeigt, [], `Sitz ${sitz} vor dem Los`);
  const los = verarbeite(partie, runde.sprecher, { art: 'bereit' });
  assert.deepEqual(sichtFuer(los, 0).gezeigt.map((e) => e.kennung), [runde.aufgabeId]);
});

test('gezeigt: jeder Eintrag nennt einen bekannten Katalog und eine Kennung, die es dort gibt', () => {
  const partie = erzeugePartie({ regeln: regeln(2, 'gemischt', [...DEFAULT_REGELN.minispiele]), saat: 17, sitze: 7, runden: 15, gastSitze: [] });
  const gezogen = gezogeneInhalte(partie);
  assert.ok(gezogen.length >= 15);
  for (const e of gezogen) assert.ok((INHALTS_KATALOGE as readonly string[]).includes(e.katalog), e.katalog);
});
