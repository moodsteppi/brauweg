/**
 * Was die Partykiste halten muss.
 *
 * Der Schwerpunkt liegt bewusst auf zwei Stellen, an denen ein Fehler nicht
 * auffaellt, sondern den Abend still kaputtmacht:
 *
 *   1. SICHTBARKEIT. Das Imposter-Wort und der eigene Name aus "Wer bin ich"
 *      duerfen in keiner fremden Sicht auftauchen — auch nicht als Feld, das
 *      der Client nur nicht anzeigt. Geprueft wird deshalb am JSON der Sicht,
 *      nicht an einzelnen Feldern.
 *   2. DER TISCH DARF NIE HAENGEN. Jede Runde, jeder Ausstieg, jede Reihenfolge
 *      muss zu Ende kommen. Das ist der Fehler, den im Betrieb niemand meldet:
 *      Die Leute gehen einfach.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_REGELN,
  MINISPIELE,
  RUNDEN_MIN,
  SITZE,
  amZug,
  ausstieg,
  baueRunde,
  erzeugePartie,
  istRot,
  minispielFuer,
  partykiste,
  platzierungen,
  sichtFuer,
  verarbeite,
  type MinispielId,
  type PartykisteAktion,
  type PartykistePartie,
} from '../src/index.js';

function neuePartie(
  sitze = 6,
  runden = 6,
  regeln = DEFAULT_REGELN,
  botSitze: number[] = [],
): PartykistePartie {
  return erzeugePartie({ regeln, saat: 4711, sitze, runden, botSitze });
}

/** Spielt mit Bots zu Ende und gibt zurueck, wie viele Zuege es gebraucht hat. */
function spieleDurch(partie: PartykistePartie, grenze = 5000): { partie: PartykistePartie; zuege: number } {
  let stand = partie;
  let zuege = 0;
  while (!stand.fertig) {
    assert.ok(++zuege <= grenze, `kommt nach ${grenze} Zuegen nicht zum Ende`);
    const sitz = amZug(stand);
    /* Seit dem 19.09.2026 gibt es keine Schaupause mehr: Solange die Partie
       laeuft, ist immer jemand am Zug — sonst haengt der Tisch. */
    assert.notEqual(sitz, null, 'niemand am Zug, aber nicht fertig — der Tisch haengt');
    if (sitz === null) break;
    stand = verarbeite(stand, sitz, partykiste.botAction(sichtFuer(stand, sitz), stand.botStufe));
  }
  return { partie: stand, zuege };
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------

test('jede Sitzzahl von 4 bis 12 spielt ein Turnier zu Ende', () => {
  for (const sitze of SITZE) {
    const { partie } = spieleDurch(neuePartie(sitze, MINISPIELE.length));
    assert.equal(partie.fertig, true, `${sitze} Sitze`);
    assert.equal(partie.protokoll.length, MINISPIELE.length, `${sitze} Sitze: Runden im Protokoll`);
  }
});

test('jedes einzelne Minispiel kommt fuer sich zu Ende', () => {
  for (const spiel of MINISPIELE) {
    const regeln = { ...DEFAULT_REGELN, minispiele: [spiel] };
    for (const sitze of [4, 7, 12]) {
      const { partie } = spieleDurch(neuePartie(sitze, 3, regeln));
      assert.equal(partie.fertig, true, `${spiel} zu ${sitze}`);
      assert.equal(partie.protokoll.every((p) => p.art === spiel), true, `${spiel}: Protokoll`);
    }
  }
});

test('die Reihenfolge der Minispiele folgt dem Regelsatz', () => {
  const regeln = { ...DEFAULT_REGELN, minispiele: ['quiz', 'imposter'] as MinispielId[] };
  assert.equal(minispielFuer(regeln, 0), 'quiz');
  assert.equal(minispielFuer(regeln, 1), 'imposter');
  assert.equal(minispielFuer(regeln, 2), 'quiz');
});

test('dieselbe Saat ergibt dieselbe Partie', () => {
  const a = spieleDurch(neuePartie(6, 6)).partie;
  const b = spieleDurch(neuePartie(6, 6)).partie;
  assert.deepEqual(a.punkte, b.punkte);
  assert.deepEqual(a.schlucke, b.schlucke);
});

test('eine Runde wiederholt ihren Inhalt nicht', () => {
  const regeln = { ...DEFAULT_REGELN, minispiele: ['quiz'] as MinispielId[] };
  const gesehen = new Set<string>();
  for (let nr = 0; nr < 12; nr++) {
    const runde = baueRunde(regeln, 'saat', 6, nr, []);
    assert.equal(runde.art, 'quiz');
    if (runde.art === 'quiz') {
      assert.equal(gesehen.has(runde.frageId), false, `Frage ${runde.frageId} kam zweimal`);
      gesehen.add(runde.frageId);
      assert.equal(runde.antworten.length, 4);
      assert.ok(runde.richtig >= 0 && runde.richtig < 4, 'die richtige Antwort ist verschwunden');
    }
  }
});

// ---------------------------------------------------------------------------
// Sichtbarkeit — der Kern des Spiels
// ---------------------------------------------------------------------------

test('das Imposter-Wort steht in keiner fremden Sicht', () => {
  const partie = neuePartie(6, 1, { ...DEFAULT_REGELN, minispiele: ['imposter'] });
  const runde = partie.runde;
  assert.equal(runde.art, 'imposter');
  if (runde.art !== 'imposter') return;

  for (let sitz = 0; sitz < partie.sitze; sitz++) {
    const sicht = sichtFuer(partie, sitz);
    assert.equal(sicht.daten.art, 'imposter');
    if (sicht.daten.art !== 'imposter') continue;

    const binImposter: boolean = sitz === runde.imposter;
    assert.equal(sicht.daten.binImposter, binImposter, `Sitz ${sitz}`);
    assert.equal(sicht.daten.meinWort, binImposter ? null : runde.wort, 'der Imposter hat kein Wort');
    assert.equal(sicht.daten.hinweis, binImposter ? runde.hinweis : null, 'den Hinweis hat nur der Imposter');
    assert.deepEqual([...sicht.daten.reihenfolge].sort(), [0, 1, 2, 3, 4, 5], 'die Reihenfolge nennt jeden einmal');
    /* Wer der Imposter ist, steht vor der Abrechnung nirgends in der Sicht. */
    assert.equal(sicht.daten.imposter, null);
    const roh = JSON.stringify(sicht);
    assert.equal(roh.includes(binImposter ? runde.wort : runde.hinweis), false, `Sitz ${sitz}: das fremde Geheimnis reist mit`);
  }

  /* Der Zuschauer bekommt gar kein Wort. */
  const zuschauer = sichtFuer(partie, -1);
  assert.equal(JSON.stringify(zuschauer).includes(runde.wort), false);
  assert.equal(JSON.stringify(zuschauer).includes(runde.hinweis), false);
});

test('bei "Wer bin ich" fehlt genau der eigene Name', () => {
  const partie = neuePartie(5, 1, { ...DEFAULT_REGELN, minispiele: ['werbinich'] });
  const runde = partie.runde;
  if (runde.art !== 'werbinich') return assert.fail('falsches Minispiel');

  for (let sitz = 0; sitz < partie.sitze; sitz++) {
    const sicht = sichtFuer(partie, sitz);
    if (sicht.daten.art !== 'werbinich') return assert.fail('falsche Sicht');
    assert.equal(sicht.daten.namen[sitz], null, `Sitz ${sitz} sieht seinen eigenen Namen`);
    assert.equal(
      JSON.stringify(sicht).includes(runde.namen[sitz]!),
      false,
      `Sitz ${sitz}: der eigene Name reist mit`,
    );
    for (let anderer = 0; anderer < partie.sitze; anderer++) {
      if (anderer === sitz) continue;
      assert.equal(sicht.daten.namen[anderer], runde.namen[anderer]);
    }
  }
});

test('die richtige Quizantwort kommt erst mit der Abrechnung', () => {
  let partie = neuePartie(4, 1, { ...DEFAULT_REGELN, minispiele: ['quiz'] });
  for (let sitz = 0; sitz < 4; sitz++) {
    const sicht = sichtFuer(partie, sitz);
    if (sicht.daten.art !== 'quiz') return assert.fail('falsche Sicht');
    assert.equal(sicht.daten.richtig, null, 'die Loesung steht schon in der Sicht');
    assert.equal(sicht.daten.wahl, null, 'fremde Antworten stehen schon in der Sicht');
  }
  for (let sitz = 0; sitz < 4; sitz++) partie = verarbeite(partie, sitz, { art: 'antwort', wahl: 0 });
  assert.equal(partie.runde.phase, 'ergebnis');
  const nachher = sichtFuer(partie, 0);
  if (nachher.daten.art !== 'quiz') return assert.fail('falsche Sicht');
  assert.notEqual(nachher.daten.richtig, null);
  assert.notEqual(nachher.daten.wahl, null);
});

// ---------------------------------------------------------------------------
// Regeln durchsetzen
// ---------------------------------------------------------------------------

test('unerlaubte Aktionen werden abgewiesen', () => {
  const quiz = neuePartie(4, 1, { ...DEFAULT_REGELN, minispiele: ['quiz'] });
  assert.throws(() => verarbeite(quiz, 0, { art: 'antwort', wahl: 9 }), /gibt es nicht/);
  assert.throws(() => verarbeite(quiz, 0, { art: 'stimme', ziel: 1 }), /geantwortet/);
  assert.throws(() => verarbeite(quiz, 99, { art: 'antwort', wahl: 0 }), /Sitz/);

  const imposter = neuePartie(4, 1, { ...DEFAULT_REGELN, minispiele: ['imposter'] });
  let stand = imposter;
  for (let sitz = 0; sitz < 4; sitz++) stand = verarbeite(stand, sitz, { art: 'bereit' });
  assert.equal(stand.runde.phase, 'spiel');
  assert.throws(() => verarbeite(stand, 0, { art: 'stimme', ziel: 0 }), /selbst/);

  const bus = neuePartie(4, 1, { ...DEFAULT_REGELN, minispiele: ['busfahrer'] });
  const dran = amZug(bus)!;
  assert.throws(() => verarbeite(bus, (dran + 1) % 4, { art: 'tipp', wahl: 0 }), /anderer Sitz/);
  assert.throws(() => verarbeite(bus, dran, { art: 'tipp', wahl: 5 }), /zwei Tipps/);
});

test('eine zweite Aktion desselben Sitzes bleibt wirkungslos — und zwar dasselbe Objekt', () => {
  const partie = neuePartie(4, 1, { ...DEFAULT_REGELN, minispiele: ['niemals'] });
  const einmal = verarbeite(partie, 0, { art: 'gestehen', ja: true });
  const nochmal = verarbeite(einmal, 0, { art: 'gestehen', ja: false });
  assert.equal(nochmal, einmal, 'die Laufzeit erkennt Wirkungslosigkeit an der Objektkennung');
});

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

test('der Imposter faellt nur bei eindeutiger Mehrheit auf', () => {
  const regeln = { ...DEFAULT_REGELN, minispiele: ['imposter'] as MinispielId[] };
  let partie = neuePartie(4, 1, regeln);
  const taeter = partie.runde.art === 'imposter' ? partie.runde.imposter : 0;
  for (let sitz = 0; sitz < 4; sitz++) partie = verarbeite(partie, sitz, { art: 'bereit' });

  /* Alle zeigen auf den Taeter (der Taeter selbst auf irgendwen). */
  for (let sitz = 0; sitz < 4; sitz++) {
    const ziel = sitz === taeter ? (taeter + 1) % 4 : taeter;
    partie = verarbeite(partie, sitz, { art: 'stimme', ziel });
  }
  assert.equal(partie.runde.art === 'imposter' && partie.runde.ertappt, true);
  assert.ok(partie.schlucke[taeter]! > 0, 'der enttarnte Imposter trinkt');
  assert.equal(partie.punkte[taeter], 0, 'und bekommt keine Punkte');
});

test('der ungeschorene Imposter holt Punkte, die Runde trinkt', () => {
  const regeln = { ...DEFAULT_REGELN, minispiele: ['imposter'] as MinispielId[] };
  let partie = neuePartie(4, 1, regeln);
  const taeter = partie.runde.art === 'imposter' ? partie.runde.imposter : 0;
  for (let sitz = 0; sitz < 4; sitz++) partie = verarbeite(partie, sitz, { art: 'bereit' });
  /* Jeder zeigt auf seinen linken Nachbarn — niemand bekommt eine Mehrheit. */
  for (let sitz = 0; sitz < 4; sitz++) {
    partie = verarbeite(partie, sitz, { art: 'stimme', ziel: (sitz + 1) % 4 });
  }
  assert.equal(partie.runde.art === 'imposter' && partie.runde.ertappt, false);
  assert.ok(partie.punkte[taeter]! > 0, 'der Imposter kommt durch');
  for (let sitz = 0; sitz < 4; sitz++) {
    if (sitz !== taeter) assert.ok(partie.schlucke[sitz]! > 0, `Sitz ${sitz} trinkt`);
  }
});

test('"Noch eine Runde reden" braucht die Mehrheit, wirft die Stimmen weg und rueckt die Reihenfolge', () => {
  const regeln = { ...DEFAULT_REGELN, minispiele: ['imposter'] as MinispielId[] };
  let partie = neuePartie(4, 1, regeln);
  for (let sitz = 0; sitz < 4; sitz++) partie = verarbeite(partie, sitz, { art: 'bereit' });
  if (partie.runde.art !== 'imposter') return assert.fail('falsches Minispiel');
  const reiheVorher = [...partie.runde.reihenfolge];

  partie = verarbeite(partie, 0, { art: 'stimme', ziel: 1 });
  partie = verarbeite(partie, 1, { art: 'nochmal' });
  if (partie.runde.art !== 'imposter') return assert.fail('falsches Minispiel');
  assert.equal(partie.runde.redeRunde, 1, 'einer von vier ist keine Mehrheit');
  assert.equal(partie.runde.stimmen[0], 1, 'die Stimme bleibt stehen');

  /* Zwei von vier sind nicht MEHR als die Haelfte — erst der dritte kippt es. */
  partie = verarbeite(partie, 2, { art: 'nochmal' });
  if (partie.runde.art !== 'imposter') return assert.fail('falsches Minispiel');
  assert.equal(partie.runde.redeRunde, 1);
  partie = verarbeite(partie, 3, { art: 'nochmal' });
  if (partie.runde.art !== 'imposter') return assert.fail('falsches Minispiel');
  assert.equal(partie.runde.redeRunde, 2, 'drei von vier: neue Rederunde');
  assert.equal(partie.runde.phase, 'spiel', 'und noch nicht abgerechnet');
  assert.deepEqual([...partie.runde.stimmen], [-1, -1, -1, -1], 'alle Stimmen fallen');
  assert.deepEqual(partie.runde.fertig, [], 'jeder darf neu');
  assert.deepEqual([...partie.runde.reihenfolge], [...reiheVorher.slice(1), reiheVorher[0]], 'die Reihenfolge rueckt');

  /* Ohne Mehrheit zaehlt "nochmal" als Enthaltung, und die Runde wird abgerechnet. */
  partie = verarbeite(partie, 0, { art: 'nochmal' });
  for (const sitz of [1, 2, 3]) partie = verarbeite(partie, sitz, { art: 'stimme', ziel: (sitz + 1) % 4 || 1 });
  assert.equal(partie.runde.phase, 'ergebnis');

  /* Nach der dritten Rederunde ist Schluss. */
  let dritte = neuePartie(4, 1, regeln);
  for (let sitz = 0; sitz < 4; sitz++) dritte = verarbeite(dritte, sitz, { art: 'bereit' });
  for (let runde = 0; runde < 2; runde++) for (const sitz of [0, 1, 2]) dritte = verarbeite(dritte, sitz, { art: 'nochmal' });
  if (dritte.runde.art !== 'imposter') return assert.fail('falsches Minispiel');
  assert.equal(dritte.runde.redeRunde, 3);
  assert.throws(() => verarbeite(dritte, 0, { art: 'nochmal' }), /genug geredet/);
  assert.equal(partykiste.legalActions(dritte, 0).some((a) => a.art === 'nochmal'), false);
});

test('der Haertegrad vervielfacht die Schluecke, nicht die Punkte', () => {
  const sanft = spieleDurch(neuePartie(6, 6, { ...DEFAULT_REGELN, schluckFaktor: 1 })).partie;
  const hart = spieleDurch(neuePartie(6, 6, { ...DEFAULT_REGELN, schluckFaktor: 3 })).partie;
  assert.deepEqual(hart.punkte, sanft.punkte, 'die Wertung haengt nicht am Trinken');
  const summe = (x: readonly number[]) => x.reduce((a, b) => a + b, 0);
  assert.equal(summe(hart.schlucke), 3 * summe(sanft.schlucke));
});

test('beim Bus fahren gilt Gleichstand gegen den Fahrer', () => {
  /* Die Farbregel ist die einzige, die sich ohne Stapelkenntnis pruefen laesst. */
  assert.equal(istRot({ rang: 7, farbe: 0 }), true);
  assert.equal(istRot({ rang: 7, farbe: 2 }), false);

  let partie = neuePartie(4, 1, { ...DEFAULT_REGELN, minispiele: ['busfahrer'] });
  const runde = partie.runde;
  if (runde.art !== 'busfahrer') return assert.fail('falsches Minispiel');
  const erste = runde.stapel[0]!;
  const richtigeFarbe = istRot(erste) ? 0 : 1;
  partie = verarbeite(partie, 0, { art: 'tipp', wahl: richtigeFarbe === 0 ? 1 : 0 });
  if (partie.runde.art !== 'busfahrer') return assert.fail('falsches Minispiel');
  assert.equal(partie.runde.letzter?.richtig, false, 'falsche Farbe muss falsch sein');
  assert.equal(partie.runde.treffer[0], 0, 'und beendet die Fahrt sofort');
});

test('die Tabelle stimmt mit den Punkten ueberein', () => {
  const { partie } = spieleDurch(neuePartie(8, 6));
  const tabelle = platzierungen(partie);
  assert.equal(tabelle.length, 8);
  assert.equal(Math.min(...tabelle.map((p) => p.platz)), 1, 'kein erster Platz');
  for (const a of tabelle) {
    for (const b of tabelle) {
      if (a.punkte > b.punkte) assert.ok(a.platz < b.platz, 'mehr Punkte, schlechterer Platz');
      if (a.punkte === b.punkte) assert.equal(a.platz, b.platz, 'Gleichstand, verschiedene Plaetze');
    }
  }
});

// ---------------------------------------------------------------------------
// Ausstieg
// ---------------------------------------------------------------------------

test('ein Ausstieg bringt das Turnier nicht zum Stehen', () => {
  for (const spiel of MINISPIELE) {
    for (const wann of [0, 1, 3]) {
      let partie = neuePartie(5, 3, { ...DEFAULT_REGELN, minispiele: [spiel] });
      let zuege = 0;
      while (!partie.fertig && zuege < 3000) {
        if (zuege === wann) partie = ausstieg(partie, zuege % 5);
        const sitz = amZug(partie);
        assert.notEqual(sitz, null, `${spiel}: niemand am Zug, aber nicht fertig`);
        if (sitz === null) break;
        partie = verarbeite(partie, sitz, partykiste.botAction(sichtFuer(partie, sitz)));
        zuege++;
      }
      assert.equal(partie.fertig, true, `${spiel}: Ausstieg bei Zug ${wann} haengt`);
    }
  }
});

test('steigen alle aus, ist das Turnier vorbei statt haengen', () => {
  let partie = neuePartie(4, 6);
  for (let sitz = 0; sitz < 4; sitz++) partie = ausstieg(partie, sitz);
  assert.equal(partie.fertig, true);
});

test('ein ausgestiegener Sitz handelt nicht mehr', () => {
  const partie = ausstieg(neuePartie(4, 3), 1);
  assert.equal(verarbeite(partie, 1, { art: 'bereit' }), partie);
  assert.notEqual(amZug(partie), 1);
});

// ---------------------------------------------------------------------------
// Schnittstelle zur Plattform
// ---------------------------------------------------------------------------

test('der eigene Standardregelsatz ist gueltig', () => {
  for (const sitze of SITZE) {
    assert.deepEqual(partykiste.validateConfig(DEFAULT_REGELN, sitze, RUNDEN_MIN), []);
  }
});

test('Unsinn im Regelsatz wird abgewiesen, nicht verschluckt', () => {
  const unsinn: unknown[] = [null, 42, 'kaputt', [], {}, { ...DEFAULT_REGELN, minispiele: [] }];
  for (const config of unsinn) {
    const probleme = partykiste.validateConfig(config, 6, 6);
    assert.ok(probleme.some((p) => p.severity === 'error'), `${JSON.stringify(config)} ging durch`);
  }
  assert.ok(
    partykiste
      .validateConfig({ ...DEFAULT_REGELN, minispiele: ['gibtsnicht'] }, 6, 6)
      .some((p) => p.path === 'minispiele'),
  );
  assert.ok(partykiste.validateConfig(DEFAULT_REGELN, 3, 6).some((p) => p.path === 'seats'));
  assert.ok(partykiste.validateConfig(DEFAULT_REGELN, 13, 6).some((p) => p.path === 'seats'));
  assert.ok(partykiste.validateConfig(DEFAULT_REGELN, 6, 99).some((p) => p.path === 'rounds'));
});

test('ein kaputter Regelsatz bringt trotzdem eine spielbare Partie', () => {
  /* Die Lobby prueft vorher — aber ein Tisch aus der Datenbank kann aelter
     sein als die Pruefung, und dann soll gespielt und nicht geworfen werden. */
  const partie = partykiste.createParty({
    config: { minispiele: ['gibtsnicht'], trinkmodus: 'ja', schluckFaktor: 99 } as never,
    seats: 6,
    rounds: 4,
    seed: 9,
  });
  assert.equal(partie.regeln.minispiele.length > 0, true);
  assert.equal(partie.regeln.schluckFaktor <= 3, true);
  assert.equal(spieleDurch(partie).partie.fertig, true);
});

test('der Snapshot ueberlebt den Rundlauf', () => {
  let partie = neuePartie(6, 6);
  for (let i = 0; i < 20 && !partie.fertig; i++) {
    const sitz = amZug(partie);
    assert.notEqual(sitz, null, 'niemand am Zug, aber nicht fertig');
    if (sitz === null) break;
    partie = verarbeite(partie, sitz, partykiste.botAction(sichtFuer(partie, sitz)));
    const wieder = partykiste.deserialize(partykiste.serialize(partie));
    assert.equal(JSON.stringify(partykiste.serialize(wieder)), JSON.stringify(partykiste.serialize(partie)));
  }
});

test('legalActions nennt nur Aktionen, die act auch annimmt', () => {
  let partie = neuePartie(6, MINISPIELE.length);
  let zuege = 0;
  while (!partie.fertig && zuege++ < 2000) {
    const sitz = amZug(partie);
    assert.notEqual(sitz, null, 'niemand am Zug, aber nicht fertig');
    if (sitz === null) break;
    const erlaubt = partykiste.legalActions(partie, sitz);
    if (erlaubt.length === 0) {
      /* Falle 1 der Invarianten: Schaetzen kann seine Aktion nicht aufzaehlen
         — der Bot muss trotzdem eine liefern, die `act` annimmt. */
      assert.equal(partie.runde.art, 'schaetzen', `Sitz ${sitz} ist am Zug, darf aber nichts`);
      partie = verarbeite(partie, sitz, partykiste.botAction(sichtFuer(partie, sitz)));
      continue;
    }
    for (const aktion of erlaubt) {
      assert.doesNotThrow(() => verarbeite(partie, sitz, aktion), `${JSON.stringify(aktion)}`);
    }
    /* Ein anderer Sitz darf dieselbe Aktion nicht ueberall auch machen. */
    partie = verarbeite(partie, sitz, erlaubt[0] as PartykisteAktion);
  }
  assert.equal(partie.fertig, true);
});

test('der Bot liefert immer eine Aktion, die in legalActions steht', () => {
  for (const spiel of MINISPIELE) {
    let partie = neuePartie(7, 2, { ...DEFAULT_REGELN, minispiele: [spiel] });
    let zuege = 0;
    while (!partie.fertig && zuege++ < 2000) {
      const sitz = amZug(partie);
      assert.notEqual(sitz, null, 'niemand am Zug, aber nicht fertig');
      if (sitz === null) break;
      const erlaubt = partykiste.legalActions(partie, sitz);
      const aktion = partykiste.botAction(sichtFuer(partie, sitz), 'genie');
      assert.ok(
        erlaubt.length === 0 || erlaubt.some((e) => JSON.stringify(e) === JSON.stringify(aktion)),
        `${spiel}: Bot spielt ${JSON.stringify(aktion)}, erlaubt sind ${JSON.stringify(erlaubt)}`,
      );
      partie = verarbeite(partie, sitz, aktion);
    }
  }
});

test('ein starker Bot weiss im Quiz mehr als ein schwacher', () => {
  const regeln = { ...DEFAULT_REGELN, minispiele: ['quiz'] as MinispielId[] };
  const treffer = (stufe: 'anfaenger' | 'genie'): number => {
    let richtig = 0;
    let gestellt = 0;
    for (let saat = 0; saat < 40; saat++) {
      const partie = erzeugePartie({ regeln, saat, sitze: 4, runden: 1 });
      if (partie.runde.art !== 'quiz') continue;
      for (let sitz = 0; sitz < 4; sitz++) {
        const aktion = partykiste.botAction(sichtFuer(partie, sitz), stufe);
        gestellt++;
        if (aktion.art === 'antwort' && aktion.wahl === partie.runde.richtig) richtig++;
      }
    }
    return richtig / Math.max(1, gestellt);
  };
  const schwach = treffer('anfaenger');
  const stark = treffer('genie');
  assert.ok(stark > schwach + 0.2, `Genie ${stark}, Anfaenger ${schwach} — die Stufe wirkt nicht`);
});

test('die Abrechnung wartet auf jeden Menschen und hat keine Uhr', () => {
  let partie = neuePartie(4, 2, { ...DEFAULT_REGELN, minispiele: ['niemals'] });
  for (let sitz = 0; sitz < 4; sitz++) partie = verarbeite(partie, sitz, { art: 'gestehen', ja: false });
  assert.equal(partie.runde.phase, 'ergebnis');
  assert.equal(partykiste.interludeMs, undefined, 'eine Schaupause ginge von selbst weiter — genau das soll nicht sein');
  assert.equal(amZug(partie), 0, 'der erste Mensch, der noch nicht Weiter getippt hat, ist am Zug');
  for (const sitz of [0, 1, 2]) partie = verarbeite(partie, sitz, { art: 'bereit' });
  assert.equal(partie.rundeNr, 0, 'drei von vier reichen nicht');
  assert.equal(amZug(partie), 3);
  partie = verarbeite(partie, 3, { art: 'bereit' });
  assert.equal(partie.rundeNr, 1, 'der letzte Tipp schaltet weiter');
});

test('tippen alle Anwesenden Weiter, endet die Pause sofort', () => {
  let partie = neuePartie(4, 2, { ...DEFAULT_REGELN, minispiele: ['niemals'] }, [3]);
  for (let sitz = 0; sitz < 4; sitz++) partie = verarbeite(partie, sitz, { art: 'gestehen', ja: false });
  assert.equal(partie.rundeNr, 0);
  /* Sitz 3 ist ein Bot und tippt nie — auf ihn wird nicht gewartet. */
  for (const sitz of [0, 1, 2]) partie = verarbeite(partie, sitz, { art: 'bereit' });
  assert.equal(partie.rundeNr, 1, 'die Runde wartet auf einen Bot, der nie tippt');
});
