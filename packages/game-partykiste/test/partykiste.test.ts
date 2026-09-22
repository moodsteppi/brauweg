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
  AUFGABEN,
  ENTWEDER_ODER,
  IDENTITAETEN,
  IMPOSTER_WOERTER,
  MINDESTMENGE,
  NIEMALS_SPRUECHE,
  PAKETE,
  QUIZ_FRAGEN,
  SCHAETZ_FRAGEN,
  WER_EHER_SPRUECHE,
  waehlbareInhalte,
  wirksameInhaltsHaerte,
  type Inhalt,
  type PartykisteRegeln,
  type Runde,
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

// ---------------------------------------------------------------------------
// Inhalte: Metadaten, Filter, Haerte (seit dem 22.09.2026)
// ---------------------------------------------------------------------------

const KATALOGE: Readonly<Record<string, readonly Inhalt[]>> = {
  quiz: QUIZ_FRAGEN,
  imposter: IMPOSTER_WOERTER,
  identitaeten: IDENTITAETEN,
  niemals: NIEMALS_SPRUECHE,
  wereher: WER_EHER_SPRUECHE,
  schaetzen: SCHAETZ_FRAGEN,
  entweder: ENTWEDER_ODER,
  wahrheit: AUFGABEN.filter((a) => a.art === 'wahrheit'),
  pflicht: AUFGABEN.filter((a) => a.art === 'pflicht'),
};

/** Kiffen ist "pikant" — die einzigen Eintraege mit Haerte am 22.09.2026. */
const KIFFEN = new Set([
  ...Array.from({ length: 10 }, (_, i) => `n${101 + i}`),
  ...Array.from({ length: 8 }, (_, i) => `w${101 + i}`),
]);

test('jeder Katalog traegt die strengste Einstellung — genug harmlose Eintraege, keine doppelte Kennung', () => {
  /* Der Filter lockert die Haerte nie. Haette ein Katalog weniger als
     MINDESTMENGE harmlose Eintraege, spielte ein harmloser Tisch dort mit
     einem Stummel und wiederholte sich. */
  for (const [name, katalog] of Object.entries(KATALOGE)) {
    const harmlos = katalog.filter((i) => (i.haerte ?? 1) === 1);
    assert.ok(harmlos.length >= Math.max(MINDESTMENGE, 12), `${name}: nur ${harmlos.length} harmlose Eintraege`);
    assert.equal(new Set(katalog.map((i) => i.id)).size, katalog.length, `${name}: doppelte Kennung`);
    for (const i of katalog) {
      if (i.paket) for (const p of i.paket) assert.ok((PAKETE as readonly string[]).includes(p), `${i.id}: Paket ${p}`);
    }
  }
});

test('die Kiffer-Sprueche und nur sie sind pikant', () => {
  for (const katalog of Object.values(KATALOGE)) {
    for (const i of katalog) {
      assert.equal(i.haerte ?? 1, KIFFEN.has(i.id) ? 2 : 1, `${i.id} hat die falsche Haerte`);
    }
  }
});

test('der Filter haelt die Haerte als Obergrenze', () => {
  const harmlos = waehlbareInhalte(NIEMALS_SPRUECHE, { inhaltsHaerte: 1, paket: null }, 6);
  assert.equal(harmlos.inhalte.some((i) => KIFFEN.has(i.id)), false, 'harmlos bringt Kiffer-Sprueche');
  assert.equal(harmlos.inhalte.length, NIEMALS_SPRUECHE.length - 10);
  assert.equal(harmlos.rueckfall, null);

  const pikant = waehlbareInhalte(NIEMALS_SPRUECHE, { inhaltsHaerte: 2, paket: null }, 6);
  assert.equal(pikant.inhalte.length, NIEMALS_SPRUECHE.length, 'pikant schliesst harmlos ein');
  const derb = waehlbareInhalte(NIEMALS_SPRUECHE, { inhaltsHaerte: 3, paket: null }, 6);
  assert.equal(derb.inhalte.length, NIEMALS_SPRUECHE.length);
});

test('der Filter behaelt die Katalogreihenfolge', () => {
  const auswahl = waehlbareInhalte(NIEMALS_SPRUECHE, { inhaltsHaerte: 1, paket: null }, 6);
  const stellen = auswahl.inhalte.map((i) => NIEMALS_SPRUECHE.indexOf(i));
  assert.deepEqual(stellen, [...stellen].sort((a, b) => a - b), 'die Auswahl ist umsortiert');
});

/** Ein Spielzeugkatalog, an dem sich Paket und Sitzgrenze messen lassen. */
function spielzeug(): Inhalt[] {
  const liste: Inhalt[] = [];
  for (let i = 0; i < 12; i++) liste.push({ id: `jga${i}`, paket: ['jga'] });
  for (let i = 0; i < 4; i++) liste.push({ id: `weih${i}`, paket: ['weihnachten'] });
  for (let i = 0; i < 12; i++) liste.push({ id: `allg${i}` });
  for (let i = 0; i < 12; i++) liste.push({ id: `gross${i}`, minSitze: 8 });
  for (let i = 0; i < 12; i++) liste.push({ id: `derb${i}`, haerte: 3, paket: ['jga'] });
  return liste;
}

test('ein Paket nimmt seine eigenen Inhalte und faellt erst bei Mangel zurueck', () => {
  const katalog = spielzeug();
  const jga = waehlbareInhalte(katalog, { inhaltsHaerte: 1, paket: 'jga' }, 6);
  assert.deepEqual(jga.inhalte.map((i) => i.id), Array.from({ length: 12 }, (_, i) => `jga${i}`));
  assert.equal(jga.rueckfall, null, 'zwoelf passende reichen');

  /* Vier Weihnachtseintraege sind zu wenig: dazu kommt Allgemeingut — aber
     nichts, was fuer den JGA gedacht war. */
  const weih = waehlbareInhalte(katalog, { inhaltsHaerte: 1, paket: 'weihnachten' }, 6);
  assert.deepEqual(weih.rueckfall, { gewollt: 'paket', genutzt: 'paketUndAllgemein', passend: 4 });
  assert.equal(weih.inhalte.some((i) => i.id.startsWith('jga')), false, 'fremdes Paket rutscht durch');
  assert.ok(weih.inhalte.some((i) => i.id === 'weih0') && weih.inhalte.some((i) => i.id === 'allg0'));

  /* Mit einem hoeheren Ziel reicht auch das nicht: dann faellt das Paket ganz. */
  const viel = waehlbareInhalte(katalog, { inhaltsHaerte: 1, paket: 'weihnachten' }, 6, 20);
  assert.equal(viel.rueckfall?.genutzt, 'ohnePaket');
  assert.ok(viel.inhalte.some((i) => i.id.startsWith('jga')));
});

test('minSitze blendet aus, was fuer den Tisch zu gross ist', () => {
  const katalog = spielzeug();
  const klein = waehlbareInhalte(katalog, { inhaltsHaerte: 1, paket: null }, 6);
  assert.equal(klein.inhalte.some((i) => i.id.startsWith('gross')), false);
  const gross = waehlbareInhalte(katalog, { inhaltsHaerte: 1, paket: null }, 8);
  assert.ok(gross.inhalte.some((i) => i.id.startsWith('gross')));

  /* Nur Eintraege ab acht Sitzen: an einem Sechsertisch faellt die Grenze
     lieber, als dass die Runde leer bleibt. */
  const nurGross = katalog.filter((i) => i.id.startsWith('gross'));
  const rueck = waehlbareInhalte(nurGross, { inhaltsHaerte: 1, paket: null }, 6);
  assert.equal(rueck.inhalte.length, 12);
  assert.deepEqual(rueck.rueckfall, { gewollt: 'ohnePaket', genutzt: 'ohneMinSitze', passend: 0 });
});

test('der Rueckfall lockert nie die Haerte, solange Harmloses da ist', () => {
  /* JGA-Paket auf harmlos: die zwoelf derben JGA-Eintraege bleiben draussen,
     obwohl sie genau zum Paket passen. */
  const katalog = spielzeug();
  const auswahl = waehlbareInhalte(katalog, { inhaltsHaerte: 1, paket: 'jga' }, 6, 30);
  assert.equal(auswahl.inhalte.some((i) => i.id.startsWith('derb')), false);
  assert.ok(auswahl.inhalte.length > 0);
});

test('der Filter wirft nie, auch nicht bei Unsinn im Regelsatz', () => {
  const unsinn: unknown[] = [{}, { inhaltsHaerte: 99 }, { inhaltsHaerte: '3' }, { paket: 42 }, { paket: 'gibtsnicht' }];
  for (const regeln of unsinn) {
    for (const sitze of [Number.NaN, -1, 0, 6, 99]) {
      const auswahl = waehlbareInhalte(NIEMALS_SPRUECHE, regeln as never, sitze, Number.NaN);
      assert.ok(auswahl.inhalte.length > 0, `${JSON.stringify(regeln)} bei ${sitze} Sitzen ist leer`);
      assert.equal(auswahl.inhalte.some((i) => KIFFEN.has(i.id)), false, 'Unsinn wird derber statt harmlos');
    }
  }
  assert.deepEqual(waehlbareInhalte([], { inhaltsHaerte: 1, paket: null }, 6).inhalte, []);
});

test('mit Paket haelt die Runde fest, dass die Auswahl nachgeben musste', () => {
  /* Am 22.09.2026 traegt noch kein Eintrag ein Paket — ein Paket-Tisch spielt
     also Allgemeingut, und die Runde sagt das, statt es zu verschweigen. */
  const regeln: PartykisteRegeln = { ...DEFAULT_REGELN, minispiele: ['quiz'], paket: 'jga' };
  const runde = baueRunde(regeln, 'saat', 6, 0, []);
  assert.deepEqual(runde.inhaltsRueckfall, { gewollt: 'paket', genutzt: 'paketUndAllgemein', passend: 0 });
  assert.equal(baueRunde(DEFAULT_REGELN, 'saat', 6, 0, []).inhaltsRueckfall, null);
});

test('eine harmlose Partie bringt nie einen pikanten Spruch', () => {
  for (const spiel of ['niemals', 'wereher'] as MinispielId[]) {
    for (let saat = 0; saat < 12; saat++) {
      const regeln = { ...DEFAULT_REGELN, minispiele: [spiel] };
      for (let nr = 0; nr < 15; nr++) {
        const runde = baueRunde(regeln, `s${saat}`, 6, nr, []);
        const id = runde.art === 'niemals' || runde.art === 'wereher' ? runde.spruchId : '';
        assert.equal(KIFFEN.has(id), false, `${spiel}, Saat ${saat}, Runde ${nr}: ${id}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Regelsatz: inhaltsHaerte und paket
// ---------------------------------------------------------------------------

test('inhaltsHaerte und paket duerfen fehlen — alte Tische und der heutige Bildschirm schicken sie nicht', () => {
  const alt = { minispiele: [...MINISPIELE], trinkmodus: true, schluckFaktor: 2 };
  assert.deepEqual(partykiste.validateConfig(alt, 6, 6), []);
  for (const inhaltsHaerte of [1, 2, 3]) {
    for (const paket of [null, ...PAKETE]) {
      assert.deepEqual(partykiste.validateConfig({ ...DEFAULT_REGELN, inhaltsHaerte, paket }, 6, 6), []);
    }
  }
  const partie = partykiste.createParty({ config: alt as never, seats: 6, rounds: 3, seed: 1, gastSeats: [] });
  assert.equal(partie.regeln.inhaltsHaerte, 1);
  assert.equal(partie.regeln.paket, null);
});

test('Unsinn in inhaltsHaerte und paket wird gemeldet, nie geworfen', () => {
  const haerteUnsinn: unknown[] = [0, 4, -1, 1.5, '2', null, true, [], {}, Number.NaN, 999_999];
  for (const inhaltsHaerte of haerteUnsinn) {
    let probleme: ReturnType<typeof partykiste.validateConfig> = [];
    assert.doesNotThrow(() => {
      probleme = partykiste.validateConfig({ ...DEFAULT_REGELN, inhaltsHaerte }, 6, 6);
    });
    assert.ok(
      probleme.some((p) => p.path === 'inhaltsHaerte' && p.messageKey === 'ruleset.partykiste.inhaltsHaerte'),
      `inhaltsHaerte ${JSON.stringify(inhaltsHaerte)} ging durch`,
    );
  }
  const paketUnsinn: unknown[] = ['gibtsnicht', '', 42, true, [], ['jga'], {}];
  for (const paket of paketUnsinn) {
    let probleme: ReturnType<typeof partykiste.validateConfig> = [];
    assert.doesNotThrow(() => {
      probleme = partykiste.validateConfig({ ...DEFAULT_REGELN, paket }, 6, 6);
    });
    assert.ok(
      probleme.some((p) => p.path === 'paket' && p.messageKey === 'ruleset.partykiste.paket'),
      `paket ${JSON.stringify(paket)} ging durch`,
    );
  }
  /* Ein kaputter Wert aus der Datenbank spielt trotzdem — harmlos, alles. */
  const partie = partykiste.createParty({
    config: { ...DEFAULT_REGELN, inhaltsHaerte: 'derb', paket: 42 } as never,
    seats: 6,
    rounds: 3,
    seed: 3,
    gastSeats: [],
  });
  assert.equal(partie.regeln.inhaltsHaerte, 1);
  assert.equal(partie.regeln.paket, null);
  assert.equal(spieleDurch(partie).partie.fertig, true);
});

// ---------------------------------------------------------------------------
// Derb nur ohne Gast
// ---------------------------------------------------------------------------

test('sitzt ein Gast am Tisch, kappt die Partie "derb" auf "pikant"', () => {
  const derb = { ...DEFAULT_REGELN, inhaltsHaerte: 3 as const };
  const mitGast = partykiste.createParty({ config: derb, seats: 6, rounds: 3, seed: 5, gastSeats: [2] });
  assert.equal(mitGast.regeln.inhaltsHaerte, 2, 'derb trotz Gast');
  assert.equal(mitGast.inhaltsHaerteGewollt, 3, 'die Kappung steht nicht in der Partie');

  const ohneGast = partykiste.createParty({ config: derb, seats: 6, rounds: 3, seed: 5, gastSeats: [] });
  assert.equal(ohneGast.regeln.inhaltsHaerte, 3);
  assert.equal(ohneGast.inhaltsHaerteGewollt, null);

  /* Sagt die Laufzeit nicht, wer Gast ist, gilt die strenge Seite. */
  const unbekannt = partykiste.createParty({ config: derb, seats: 6, rounds: 3, seed: 5 });
  assert.equal(unbekannt.regeln.inhaltsHaerte, 2);

  /* Pikant und harmlos bleiben, wie sie sind — gekappt wird nur nach unten. */
  const pikant = partykiste.createParty({
    config: { ...DEFAULT_REGELN, inhaltsHaerte: 2 },
    seats: 6,
    rounds: 3,
    seed: 5,
    gastSeats: [0, 1],
  });
  assert.equal(pikant.regeln.inhaltsHaerte, 2);
  assert.equal(pikant.inhaltsHaerteGewollt, null);
  assert.equal(wirksameInhaltsHaerte(1, [0]), 1);
  assert.equal(wirksameInhaltsHaerte(3, [0]), 2);
  assert.equal(wirksameInhaltsHaerte(3, []), 3);
});

test('die Kappung ueberlebt den Snapshot — ein neu geladener Tisch wird nicht derber', () => {
  const partie = partykiste.createParty({
    config: { ...DEFAULT_REGELN, inhaltsHaerte: 3 },
    seats: 6,
    rounds: 3,
    seed: 5,
    gastSeats: [4],
  });
  const wieder = partykiste.deserialize(partykiste.serialize(partie));
  assert.equal(wieder.regeln.inhaltsHaerte, 2);
  assert.equal(wieder.inhaltsHaerteGewollt, 3);
});

// ---------------------------------------------------------------------------
// Wiederholungsschutz
// ---------------------------------------------------------------------------

/** Alle Kennungen, die eine Runde zeigt — je Katalog. */
function kennungen(runde: Runde): Array<[string, string]> {
  switch (runde.art) {
    case 'imposter':
      return [['imposter', runde.wortId]];
    case 'quiz':
      return [['quiz', runde.frageId]];
    case 'werbinich':
      return runde.identitaeten.map((id) => ['identitaeten', id]);
    case 'niemals':
      return [['niemals', runde.spruchId]];
    case 'wereher':
      return [['wereher', runde.spruchId]];
    case 'schaetzen':
      return [['schaetzen', runde.frageId]];
    case 'entweder':
      return [['entweder', runde.paarId]];
    case 'wahrheitpflicht':
      return runde.aufgabeId.filter((id) => id !== '').map((id) => ['aufgaben', id]);
    case 'busfahrer':
      return [];
  }
}

/** Spielt eine Partie mit Bots durch und sammelt jede gezeigte Kennung einmal je Runde. */
function gezeigteKennungen(partie: PartykistePartie): Map<string, string[]> {
  const gesehen = new Map<string, string[]>();
  const abgerechnet = new Set<number>();
  let stand = partie;
  for (let zug = 0; zug < 20_000 && !stand.fertig; zug++) {
    if (stand.runde.phase === 'ergebnis' && !abgerechnet.has(stand.rundeNr)) {
      abgerechnet.add(stand.rundeNr);
      for (const [katalog, id] of kennungen(stand.runde)) {
        gesehen.set(katalog, [...(gesehen.get(katalog) ?? []), id]);
      }
    }
    const sitz = amZug(stand);
    if (sitz === null) break;
    stand = verarbeite(stand, sitz, partykiste.botAction(sichtFuer(stand, sitz), stand.botStufe));
  }
  assert.equal(stand.fertig, true, 'die Partie kommt nicht zu Ende');
  assert.equal(abgerechnet.size, stand.runden, 'nicht jede Runde wurde abgerechnet');
  return gesehen;
}

function keineDoppelten(gesehen: Map<string, string[]>, wo: string): void {
  for (const [katalog, ids] of gesehen) {
    const doppelt = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(doppelt, [], `${wo}: ${katalog} zeigt ${doppelt.join(', ')} mehrmals`);
  }
}

test('ueber eine ganze Partie kommt keine Kennung zweimal — auch zu zwoelft in fuenfzehn Runden', () => {
  for (const saat of [1, 2, 3, 4711]) {
    const partie = erzeugePartie({ regeln: DEFAULT_REGELN, saat, sitze: 12, runden: 15, gastSitze: [] });
    const gesehen = gezeigteKennungen(partie);
    /* Neun Minispiele reihum in fuenfzehn Runden: Wer bin ich (Stelle 3)
       kommt zweimal, Wahrheit oder Pflicht (Stelle 9) einmal. */
    assert.equal(gesehen.get('identitaeten')?.length, 24, 'zweimal Wer bin ich zu zwoelft');
    assert.equal(gesehen.get('aufgaben')?.length, 12, 'einmal Wahrheit oder Pflicht zu zwoelft');
    keineDoppelten(gesehen, `Saat ${saat}`);
  }
  /* Und eine Reihe, in der beide Wiederholungsfehler mehrfach drankaemen. */
  const gemischt = { ...DEFAULT_REGELN, minispiele: ['werbinich', 'wahrheitpflicht', 'quiz'] as MinispielId[] };
  const gesehen = gezeigteKennungen(erzeugePartie({ regeln: gemischt, saat: 5, sitze: 12, runden: 15, gastSitze: [] }));
  assert.equal(gesehen.get('identitaeten')?.length, 60);
  assert.equal(gesehen.get('aufgaben')?.length, 60);
  keineDoppelten(gesehen, 'gemischte Reihe');
});

test('"Wer bin ich" allein: fuenfzehn Runden ohne doppelten Namen', () => {
  /* 9 Sitze x 15 Runden = 135 Namen aus 140 — knapp, und genau deshalb die Probe. */
  const regeln = { ...DEFAULT_REGELN, minispiele: ['werbinich'] as MinispielId[] };
  const gesehen = gezeigteKennungen(erzeugePartie({ regeln, saat: 7, sitze: 9, runden: 15, gastSitze: [] }));
  assert.equal(gesehen.get('identitaeten')?.length, 135);
  keineDoppelten(gesehen, 'Wer bin ich');
});

test('"Wahrheit oder Pflicht" allein: zwei Sitze bekommen nie dieselbe Aufgabe', () => {
  /* 12 Sitze x 5 Runden = 60 Plaetze je Art — so viele Aufgaben hat jede Art. */
  const regeln = { ...DEFAULT_REGELN, minispiele: ['wahrheitpflicht'] as MinispielId[] };
  for (const saat of [1, 2, 3]) {
    const gesehen = gezeigteKennungen(erzeugePartie({ regeln, saat, sitze: 12, runden: 5, gastSitze: [] }));
    assert.equal(gesehen.get('aufgaben')?.length, 60);
    keineDoppelten(gesehen, `W/P, Saat ${saat}`);
  }
});

test('in einer einzelnen Runde "Wer bin ich" traegt jeder Sitz einen anderen Namen', () => {
  const regeln = { ...DEFAULT_REGELN, minispiele: ['werbinich'] as MinispielId[] };
  for (let nr = 0; nr < 30; nr++) {
    const runde = baueRunde(regeln, 'saat', 12, nr, []);
    if (runde.art !== 'werbinich') return assert.fail('falsches Minispiel');
    assert.equal(new Set(runde.identitaeten).size, 12, `Runde ${nr}: zwei Sitze, ein Name`);
  }
});

// ---------------------------------------------------------------------------
// Determinismus mit Filter
// ---------------------------------------------------------------------------

test('gleiche Saat, gleiche Regeln — dieselbe Ziehung, auch mit Filter', () => {
  const varianten: PartykisteRegeln[] = [
    DEFAULT_REGELN,
    { ...DEFAULT_REGELN, inhaltsHaerte: 2 },
    { ...DEFAULT_REGELN, inhaltsHaerte: 3, paket: 'jga' },
  ];
  for (const regeln of varianten) {
    const a = gezeigteKennungen(erzeugePartie({ regeln, saat: 99, sitze: 8, runden: 15, gastSitze: [] }));
    const b = gezeigteKennungen(erzeugePartie({ regeln, saat: 99, sitze: 8, runden: 15, gastSitze: [] }));
    assert.deepEqual([...a.entries()], [...b.entries()], `${JSON.stringify(regeln)}: zweite Ziehung weicht ab`);
  }
  /* Und eine andere Saat zieht wirklich anders — sonst prueft der Test nichts. */
  const x = gezeigteKennungen(erzeugePartie({ regeln: DEFAULT_REGELN, saat: 1, sitze: 8, runden: 15, gastSitze: [] }));
  const y = gezeigteKennungen(erzeugePartie({ regeln: DEFAULT_REGELN, saat: 2, sitze: 8, runden: 15, gastSitze: [] }));
  assert.notDeepEqual([...x.entries()], [...y.entries()]);
});

test('ein Snapshot mitten in Wahrheit oder Pflicht zieht dieselbe Aufgabe wie der Server', () => {
  const regeln = { ...DEFAULT_REGELN, minispiele: ['wahrheitpflicht'] as MinispielId[] };
  const partie = erzeugePartie({ regeln, saat: 13, sitze: 6, runden: 3, gastSitze: [] });
  const kopie = partykiste.deserialize(partykiste.serialize(partie));
  const sitz = amZug(partie)!;
  const a = verarbeite(partie, sitz, { art: 'wahl', pflicht: true });
  const b = verarbeite(kopie, sitz, { art: 'wahl', pflicht: true });
  if (a.runde.art !== 'wahrheitpflicht' || b.runde.art !== 'wahrheitpflicht') return assert.fail('falsches Minispiel');
  assert.notEqual(a.runde.aufgabeId[sitz], '');
  assert.equal(a.runde.aufgabeId[sitz], b.runde.aufgabeId[sitz]);
});
