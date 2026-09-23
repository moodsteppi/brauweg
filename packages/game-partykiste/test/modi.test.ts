/**
 * Die Spielmodi: Eskalation, Themenabend, Team-Abend (22.09.2026).
 *
 * Vier Dinge verlangt die Karte ausdruecklich, und jedes hat hier seinen
 * Abschnitt: die Haertekurve, dass ein Gast die Eskalation kappt (auch in der
 * letzten Runde), dass ein Themenpaket filtert, und die Team-Wertung samt
 * `place`. Dazu, was jeder Modus sonst halten muss — der Tisch haengt nie,
 * nichts wiederholt sich, Bot und legalActions passen zusammen.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_REGELN,
  MINISPIELE,
  NIEMALS_SPRUECHE,
  PAKETE,
  SCHLUECKE,
  SITZE,
  THEMEN_MINISPIELE,
  amZug,
  ausstieg,
  belegeStufenweise,
  erzeugePartie,
  eskalationsStufe,
  haerteVon,
  lagerPlaetze,
  lagerWertung,
  partykiste,
  regelnDerRunde,
  reihumFolge,
  sichtFuer,
  stufenStapel,
  themenMinispiele,
  waehlbareInhalte,
  verarbeite,
  wechselbareSitze,
  type Haerte,
  type Inhalt,
  type MinispielId,
  type PartykisteAktion,
  type PartykistePartie,
  type PartykisteRegeln,
  type Runde,
  type Spruch,
} from '../src/index.js';

const ESKALATION: PartykisteRegeln = { ...DEFAULT_REGELN, modus: 'eskalation' };
const TEAM: PartykisteRegeln = { ...DEFAULT_REGELN, modus: 'team' };

/** Ein Zug fuer den Sitz am Zug — der Bot, wie ihn die Plattform fragt. */
function zug(stand: PartykistePartie): PartykistePartie {
  const sitz = amZug(stand);
  assert.notEqual(sitz, null, 'niemand am Zug, aber nicht fertig — der Tisch haengt');
  return verarbeite(stand, sitz!, partykiste.botAction(sichtFuer(stand, sitz!), stand.botStufe));
}

function spieleDurch(partie: PartykistePartie, grenze = 20_000): PartykistePartie {
  let stand = partie;
  for (let i = 0; i < grenze && !stand.fertig; i++) stand = zug(stand);
  assert.equal(stand.fertig, true, 'die Partie kommt nicht zu Ende');
  return stand;
}

/** Spielt durch und haelt jede Runde im Moment ihrer Abrechnung fest. */
function abgerechnet(partie: PartykistePartie): Map<number, { runde: Runde; stand: PartykistePartie }> {
  const runden = new Map<number, { runde: Runde; stand: PartykistePartie }>();
  let stand = partie;
  for (let i = 0; i < 20_000 && !stand.fertig; i++) {
    if (stand.runde.phase === 'ergebnis' && !runden.has(stand.rundeNr)) {
      runden.set(stand.rundeNr, { runde: stand.runde, stand });
    }
    stand = zug(stand);
  }
  assert.equal(stand.fertig, true, 'die Partie kommt nicht zu Ende');
  return runden;
}

// ---------------------------------------------------------------------------
// Eskalation: die Kurve
// ---------------------------------------------------------------------------

test('Haertekurve: erstes Drittel 1, zweites 2, letztes 3 — bei jeder Rundenzahl', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((nr) => eskalationsStufe(nr, 6)), [1, 1, 2, 2, 3, 3]);
  assert.deepEqual([0, 1, 2].map((nr) => eskalationsStufe(nr, 3)), [1, 2, 3]);
  assert.deepEqual(
    Array.from({ length: 9 }, (_, nr) => eskalationsStufe(nr, 9)),
    [1, 1, 1, 2, 2, 2, 3, 3, 3],
  );
  for (let runden = 3; runden <= 15; runden++) {
    const kurve = Array.from({ length: runden }, (_, nr) => eskalationsStufe(nr, runden));
    assert.equal(kurve[0], 1, `${runden} Runden: der Abend faengt nicht harmlos an`);
    assert.equal(kurve[runden - 1], 3, `${runden} Runden: die letzte Runde ist nicht Stufe 3`);
    assert.ok(
      kurve.every((stufe, i) => i === 0 || stufe >= kurve[i - 1]!),
      `${runden} Runden: die Kurve faellt (${kurve.join(',')})`,
    );
    for (const stufe of [1, 2, 3]) {
      assert.ok(kurve.includes(stufe as Haerte), `${runden} Runden: Stufe ${stufe} fehlt`);
    }
  }
  /* Unsinn wirft nicht, sondern ist harmlos. */
  assert.equal(eskalationsStufe(Number.NaN, 6), 1);
  assert.equal(eskalationsStufe(3, 0), 1);
});

test('Eskalation: die Haerte der Schluecke steigt mit der Runde, die Punkte nicht', () => {
  const regeln = { ...ESKALATION, minispiele: ['quiz'] as MinispielId[] };
  const partie = erzeugePartie({ regeln, saat: 21, sitze: 6, runden: 6, gastSitze: [] });
  const runden = abgerechnet(partie);
  assert.equal(runden.size, 6);
  for (const [nr, { runde }] of runden) {
    const stufe = eskalationsStufe(nr, 6);
    for (const schlucke of runde.schlucke) {
      assert.ok(schlucke === 0 || schlucke === SCHLUECKE.quizFalsch * stufe, `Runde ${nr}: ${schlucke} Schluecke`);
    }
    for (const punkte of runde.punkte) assert.ok(punkte === 0 || punkte === 2, `Runde ${nr}: ${punkte} Punkte`);
  }
});

test('Eskalation: die Texte werden schaerfer — und kein harmloser Abend faengt pikant an', () => {
  const regeln = { ...ESKALATION, minispiele: ['niemals'] as MinispielId[] };
  for (const saat of [1, 2, 3, 4]) {
    const runden = abgerechnet(erzeugePartie({ regeln, saat, sitze: 6, runden: 6, gastSitze: [] }));
    for (const [nr, { runde }] of runden) {
      if (runde.art !== 'niemals') return assert.fail('falsches Minispiel');
      const haerte = haerteVon(NIEMALS_SPRUECHE.find((s) => s.id === runde.spruchId)!);
      const stufe = eskalationsStufe(nr, 6);
      assert.ok(haerte <= stufe, `Saat ${saat}, Runde ${nr}: Haerte ${haerte} in Stufe ${stufe}`);
      /* Die Stufe wird ausgeschoepft: Gibt es Sprueche dieser Stufe, kommt
         einer — sonst stuende die Kurve nur im Regelsatz. Bis #214 hatte
         „Ich hab noch nie" nichts Derbes, und hier stand fest „2"; seit dem
         Katalog als JSON (23.09.2026) gibt es Derbes, und Stufe 3 nimmt es. */
      const hoechste = Math.max(...NIEMALS_SPRUECHE.map((s) => haerteVon(s)));
      if (stufe >= 2) assert.equal(haerte, Math.min(stufe, hoechste), `Saat ${saat}, Runde ${nr}: Stufe ${stufe}, Haerte ${haerte}`);
    }
  }
});

test('Eskalation: ueber den ganzen Abend kommt keine Kennung zweimal', () => {
  const varianten: MinispielId[][] = [
    [...MINISPIELE],
    ['niemals', 'wereher'],
    ['werbinich', 'wahrheitpflicht', 'quiz'],
    ['bombe', 'zehnsekunden', 'koenigsbecher'],
  ];
  for (const minispiele of varianten) {
    for (const saat of [1, 2, 3]) {
      const runden = abgerechnet(
        erzeugePartie({ regeln: { ...ESKALATION, minispiele }, saat, sitze: 12, runden: 15, gastSitze: [] }),
      );
      const gesehen = new Map<string, string[]>();
      for (const { runde } of runden.values()) {
        for (const [katalog, id] of kennungen(runde)) gesehen.set(katalog, [...(gesehen.get(katalog) ?? []), id]);
      }
      for (const [katalog, ids] of gesehen) {
        const doppelt = ids.filter((id, i) => ids.indexOf(id) !== i);
        assert.deepEqual(doppelt, [], `${minispiele.join('+')}, Saat ${saat}: ${katalog} zeigt ${doppelt.join(', ')}`);
      }
    }
  }
});

test('Eskalation: dieselbe Saat zieht dieselben Inhalte', () => {
  const a = abgerechnet(erzeugePartie({ regeln: ESKALATION, saat: 77, sitze: 8, runden: 12, gastSitze: [] }));
  const b = abgerechnet(erzeugePartie({ regeln: ESKALATION, saat: 77, sitze: 8, runden: 12, gastSitze: [] }));
  assert.deepEqual(
    [...a.values()].map(({ runde }) => kennungen(runde)),
    [...b.values()].map(({ runde }) => kennungen(runde)),
  );
});

test('das Turnier bleibt, wie es war: ohne Modus zieht der Abend dieselben Inhalte wie mit "turnier"', () => {
  const ohne: PartykisteRegeln = { ...DEFAULT_REGELN };
  delete (ohne as { modus?: unknown }).modus;
  const a = abgerechnet(erzeugePartie({ regeln: ohne, saat: 5, sitze: 7, runden: 9, gastSitze: [] }));
  const b = abgerechnet(erzeugePartie({ regeln: DEFAULT_REGELN, saat: 5, sitze: 7, runden: 9, gastSitze: [] }));
  assert.deepEqual(
    [...a.values()].map(({ runde }) => kennungen(runde)),
    [...b.values()].map(({ runde }) => kennungen(runde)),
  );
  /* Und das Turnier kennt weder Kurve noch Lager. */
  const sicht = sichtFuer(erzeugePartie({ regeln: ohne, saat: 5, sitze: 7, runden: 9 }), 0);
  assert.equal(sicht.modus, 'turnier');
  assert.equal(sicht.eskalation, null);
  assert.equal(sicht.lager, null);
  assert.equal(sicht.aufstellung, null);
});

// ---------------------------------------------------------------------------
// Eskalation: der Gast kappt — auch in der letzten Runde
// ---------------------------------------------------------------------------

test('Gast kappt Eskalation: "derb" gibt es mit Gast in KEINER Runde, auch nicht in der letzten', () => {
  const mitGast = partykiste.createParty({
    config: { ...ESKALATION, inhaltsHaerte: 1 },
    seats: 6,
    rounds: 6,
    seed: 8,
    gastSeats: [3],
  });
  assert.equal(mitGast.regeln.modus, 'eskalation');
  assert.equal(mitGast.regeln.inhaltsHaerte, 2, 'die Decke steht nicht auf pikant');
  assert.equal(mitGast.inhaltsHaerteGewollt, 3, 'die Kappung steht nicht in der Partie');
  for (let nr = 0; nr < 6; nr++) {
    assert.ok(regelnDerRunde(mitGast.regeln, nr, 6).inhaltsHaerte <= 2, `Runde ${nr} ist derb trotz Gast`);
  }
  assert.equal(regelnDerRunde(mitGast.regeln, 5, 6).inhaltsHaerte, 2, 'letzte Runde');
  /* Die Haerte der Glaeser steigt trotzdem — die Kappung gilt den Texten. */
  assert.equal(regelnDerRunde(mitGast.regeln, 5, 6).schluckFaktor, 3);

  /* Die Sicht der letzten Runde sagt es, statt still weniger zu zeigen. */
  let stand = mitGast;
  while (!stand.fertig && stand.rundeNr < 5) stand = zug(stand);
  assert.deepEqual(sichtFuer(stand, 0).eskalation, { stufe: 3, inhaltsHaerte: 2, schluckFaktor: 3, gekappt: true });

  /* Sagt die Laufzeit nicht, wer Gast ist: strenge Seite wie ueberall. */
  const unbekannt = partykiste.createParty({ config: ESKALATION, seats: 6, rounds: 6, seed: 8 });
  assert.equal(regelnDerRunde(unbekannt.regeln, 5, 6).inhaltsHaerte, 2);

  /* Ohne Gast wird es derb. */
  const ohneGast = partykiste.createParty({ config: ESKALATION, seats: 6, rounds: 6, seed: 8, gastSeats: [] });
  assert.equal(regelnDerRunde(ohneGast.regeln, 5, 6).inhaltsHaerte, 3);
  assert.equal(ohneGast.inhaltsHaerteGewollt, null);
});

test('Gast kappt Eskalation: mit derben Inhalten im Katalog zieht die letzte Runde trotzdem keinen', () => {
  /*
   * Die Kataloge tragen am 22.09.2026 keinen einzigen derben Eintrag — eine
   * Probe nur am echten Katalog bewiese also nichts. Deshalb ein Katalog mit
   * derben Spruechen, durch genau den Weg, den `baueRunde` nimmt.
   */
  const katalog: Spruch[] = Array.from({ length: 30 }, (_, i) => ({
    id: `x${i}`,
    text: `Spruch ${i}`,
    haerte: ((i % 3) + 1) as Haerte,
  }));
  const artDerRunde = (): MinispielId => 'niemals';
  const zieh = (gastSeats: number[] | undefined): Inhalt[] => {
    const partie = partykiste.createParty({
      config: { ...ESKALATION, minispiele: ['niemals'] },
      seats: 6,
      rounds: 6,
      seed: 4,
      ...(gastSeats ? { gastSeats } : {}),
    });
    const letzte = regelnDerRunde(partie.regeln, 5, 6);
    const ergebnis = stufenStapel(katalog, letzte, 'saat', 6, 'niemals', 10, artDerRunde);
    assert.ok(ergebnis, 'die Eskalation nimmt nicht den Stufenweg');
    return [...ergebnis.stapel];
  };
  const mitGast = zieh([1]);
  assert.equal(mitGast.length, 6, 'ein Platz je Runde');
  assert.equal(mitGast.some((i) => haerteVon(i) === 3), false, 'derb trotz Gast');
  assert.equal(haerteVon(mitGast[5]!), 2, 'die letzte Runde schoepft "pikant" nicht aus');
  assert.equal(zieh(undefined).some((i) => haerteVon(i) === 3), false, 'derb trotz unbekanntem Gast');
  /* Gegenprobe: Ohne Gast ist die letzte Runde derb — sonst prueft der Test nichts. */
  const ohneGast = zieh([]);
  assert.equal(haerteVon(ohneGast[5]!), 3);
  assert.deepEqual(ohneGast.slice(0, 2).map(haerteVon), [1, 1], 'das erste Drittel ist nicht harmlos');
});

test('die Belegung haelt jede Grenze und wiederholt nichts, solange der Stapel reicht', () => {
  const stapel: Inhalt[] = [
    { id: 'a', haerte: 2 },
    { id: 'b' },
    { id: 'c', haerte: 3 },
    { id: 'd' },
    { id: 'e', haerte: 2 },
  ];
  const belegt = belegeStufenweise(stapel, [1, 1, 2, 3, 2]);
  assert.deepEqual(
    belegt.map((i) => i.id),
    ['b', 'd', 'a', 'c', 'e'],
  );
  /* Aufgebraucht: von vorn, aber nie ueber die Grenze. */
  const lang = belegeStufenweise(stapel, [1, 1, 1, 1]);
  assert.equal(lang.every((i) => haerteVon(i) === 1), true);
  assert.deepEqual(belegeStufenweise([], [1, 2]), []);
});

// ---------------------------------------------------------------------------
// Themenabend
// ---------------------------------------------------------------------------

test('Themenpaket filtert: Das Paket bestimmt die Minispiele und die Inhalte', () => {
  for (const paket of PAKETE) {
    const partie = partykiste.createParty({
      config: { ...DEFAULT_REGELN, modus: 'themenabend', paket },
      seats: 6,
      rounds: 8,
      seed: 12,
      gastSeats: [],
    });
    assert.deepEqual(partie.regeln.minispiele, THEMEN_MINISPIELE[paket], `${paket}: Minispiele`);
    assert.equal(partie.regeln.paket, paket);
    const runden = abgerechnet(partie);
    for (const [nr, { runde }] of runden) {
      assert.ok(THEMEN_MINISPIELE[paket].includes(runde.art), `${paket}, Runde ${nr}: ${runde.art} gehoert nicht dazu`);
      /* Gewollt ist immer die Paketstufe. Am 22.09.2026 traegt noch kein
         Inhalt ein Paket: Dann greift der weiche Rueckfall, und die Runde
         haelt ihn fest, statt still Allgemeingut zu spielen. */
      assert.ok(
        runde.inhaltsRueckfall === null || runde.inhaltsRueckfall?.gewollt === 'paket',
        `${paket}, Runde ${nr}: gewollt war ${runde.inhaltsRueckfall?.gewollt}`,
      );
    }
    /* Und das Paket kommt im Filter an: Gibt es genug Inhalte dafuer, spielen nur sie. */
    const katalog: Spruch[] = Array.from({ length: 40 }, (_, i) => ({
      id: `p${i}`,
      text: `Spruch ${i}`,
      ...(i % 2 === 0 ? { paket: [paket] } : {}),
    }));
    const auswahl = waehlbareInhalte(katalog, partie.regeln, 6);
    assert.equal(auswahl.rueckfall, null, `${paket}: Rueckfall trotz genug Paketinhalten`);
    assert.equal(auswahl.inhalte.every((i) => i.paket?.includes(paket)), true, `${paket}: Allgemeingut im Paket`);
  }
  /* Beim Arbeitsabend kein Gestaendnis und keine Pflicht. */
  assert.equal(THEMEN_MINISPIELE.arbeit.includes('niemals'), false);
  assert.equal(THEMEN_MINISPIELE.arbeit.includes('wahrheitpflicht'), false);
});

test('Themenabend: abgewaehlte Minispiele bleiben draussen, ein leerer Schnitt nimmt das Paket', () => {
  assert.deepEqual(themenMinispiele('arbeit', ['quiz', 'niemals', 'imposter']), ['quiz', 'imposter']);
  assert.deepEqual(themenMinispiele('arbeit', ['niemals']), THEMEN_MINISPIELE.arbeit);
  const sicht = sichtFuer(
    erzeugePartie({ regeln: { ...DEFAULT_REGELN, modus: 'themenabend', paket: 'jga' }, saat: 1, sitze: 6, runden: 4 }),
    0,
  );
  assert.equal(sicht.modus, 'themenabend');
  assert.equal(sicht.paket, 'jga');
  assert.deepEqual(sicht.minispiele, THEMEN_MINISPIELE.jga);
});

test('Themenabend ohne Paket: gemeldet — und falls doch gestartet, ein Turnier', () => {
  const probleme = partykiste.validateConfig({ ...DEFAULT_REGELN, modus: 'themenabend' }, 6, 6);
  assert.ok(probleme.some((p) => p.path === 'paket' && p.messageKey === 'ruleset.partykiste.themenOhnePaket'));
  assert.deepEqual(partykiste.validateConfig({ ...DEFAULT_REGELN, modus: 'themenabend', paket: 'jga' }, 6, 6), []);
  const partie = partykiste.createParty({
    config: { ...DEFAULT_REGELN, modus: 'themenabend' },
    seats: 6,
    rounds: 3,
    seed: 2,
  });
  assert.equal(partie.regeln.modus, 'turnier');
  assert.deepEqual(partie.regeln.minispiele, MINISPIELE);
});

// ---------------------------------------------------------------------------
// Regelsatz
// ---------------------------------------------------------------------------

test('modus darf fehlen, jeder bekannte geht durch, Unsinn wird gemeldet und nie geworfen', () => {
  assert.deepEqual(partykiste.validateConfig({ minispiele: [...MINISPIELE], trinkmodus: true, schluckFaktor: 1 }, 6, 6), []);
  for (const modus of ['turnier', 'eskalation', 'team']) {
    assert.deepEqual(partykiste.validateConfig({ ...DEFAULT_REGELN, modus }, 6, 6), [], modus);
  }
  for (const modus of ['schnellrunde', 'marathon', '', 42, null, true, [], {}, Number.NaN]) {
    let probleme: ReturnType<typeof partykiste.validateConfig> = [];
    assert.doesNotThrow(() => {
      probleme = partykiste.validateConfig({ ...DEFAULT_REGELN, modus }, 6, 6);
    });
    assert.ok(
      probleme.some((p) => p.path === 'modus' && p.messageKey === 'ruleset.partykiste.modus'),
      `modus ${JSON.stringify(modus)} ging durch`,
    );
  }
  /* Ein kaputter Modus aus der Datenbank spielt ein Turnier. */
  const partie = partykiste.createParty({ config: { ...DEFAULT_REGELN, modus: 'marathon' } as never, seats: 5, rounds: 3, seed: 1 });
  assert.equal(partie.regeln.modus, 'turnier');
  assert.equal(spieleDurch(partie).fertig, true);
});

// ---------------------------------------------------------------------------
// Team-Abend: Aufstellung
// ---------------------------------------------------------------------------

test('Team-Abend: abwechselnd nach Sitz, und erst stellt der Tischoeffner auf', () => {
  const partie = erzeugePartie({ regeln: TEAM, saat: 3, sitze: 6, runden: 3 });
  assert.deepEqual(partie.lager, [0, 1, 0, 1, 0, 1]);
  assert.equal(partie.aufstellung, true);
  assert.equal(amZug(partie), 0, 'der Oeffner ist nicht dran');
  assert.deepEqual(sichtFuer(partie, 0).aufstellung, { aufsteller: 0, wechselbar: [0, 1, 2, 3, 4, 5] });
  assert.deepEqual(sichtFuer(partie, 2).aufstellung?.wechselbar, [], 'ein anderer darf tauschen');

  /* Nur der Oeffner, und nur Aufstellen. */
  assert.throws(() => verarbeite(partie, 2, { art: 'lagerwechsel', sitz: 1 }));
  assert.throws(() => verarbeite(partie, 0, { art: 'antwort', wahl: 0 }));
  assert.throws(() => verarbeite(partie, 0, { art: 'lagerwechsel', sitz: 9 }));

  const getauscht = verarbeite(partie, 0, { art: 'lagerwechsel', sitz: 1 });
  assert.deepEqual(getauscht.lager, [0, 0, 0, 1, 0, 1]);
  assert.equal(getauscht.aufstellung, true, 'ein Tausch beendet die Aufstellung');

  const los = verarbeite(getauscht, 0, { art: 'bereit' });
  assert.equal(los.aufstellung, false);
  assert.deepEqual(los.lager, [0, 0, 0, 1, 0, 1]);
  assert.equal(sichtFuer(los, 0).aufstellung, null);
});

test('Team-Abend: kein Lager ohne einen Anwesenden', () => {
  let partie = erzeugePartie({ regeln: TEAM, saat: 3, sitze: 4, runden: 3 });
  partie = verarbeite(partie, 0, { art: 'lagerwechsel', sitz: 1 });
  assert.deepEqual(partie.lager, [0, 0, 0, 1]);
  assert.equal(wechselbareSitze(partie.lager!, partie.ausgestiegen).includes(3), false);
  assert.throws(() => verarbeite(partie, 0, { art: 'lagerwechsel', sitz: 3 }), /Lager/);
  assert.equal(
    partykiste.legalActions(partie, 0).some((a) => a.art === 'lagerwechsel' && a.sitz === 3),
    false,
    'legalActions bietet an, was act verbietet',
  );
});

test('Team-Abend: ohne Oeffner (Bot oder gegangen) wartet niemand auf die Aufstellung', () => {
  const botOeffner = erzeugePartie({ regeln: TEAM, saat: 3, sitze: 6, runden: 3, botSitze: [0, 1, 2, 3, 4, 5] });
  assert.equal(botOeffner.aufstellung, false);
  const partie = erzeugePartie({ regeln: TEAM, saat: 3, sitze: 6, runden: 3 });
  const weg = ausstieg(partie, 0);
  assert.equal(weg.aufstellung, false);
  assert.notEqual(amZug(weg), 0);
  assert.equal(spieleDurch(weg).fertig, true);
});

test('Team-Abend: in reihum-Spielen wechseln die Lager, und welches anfaengt, wechselt je Runde', () => {
  assert.deepEqual(reihumFolge([0, 0, 0, 1, 0, 1], 0), [0, 3, 1, 5, 2, 4]);
  assert.deepEqual(reihumFolge([0, 0, 0, 1, 0, 1], 1), [3, 0, 5, 1, 2, 4]);
  assert.equal(reihumFolge(null, 0), undefined);

  const regeln = { ...TEAM, minispiele: ['werbinich'] as MinispielId[] };
  let stand = verarbeite(erzeugePartie({ regeln, saat: 9, sitze: 6, runden: 2 }), 0, { art: 'lagerwechsel', sitz: 1 });
  stand = verarbeite(stand, 0, { art: 'bereit' });
  const folgen: number[][] = [[], []];
  while (!stand.fertig) {
    if (stand.runde.phase === 'spiel') folgen[stand.rundeNr]!.push(amZug(stand)!);
    stand = zug(stand);
  }
  assert.deepEqual(folgen[0], [0, 3, 1, 5, 2, 4]);
  assert.deepEqual(folgen[1], [3, 0, 5, 1, 2, 4]);
});

// ---------------------------------------------------------------------------
// Team-Abend: Wertung und place
// ---------------------------------------------------------------------------

test('Team-Wertung: Punkte und Schluecke zaehlen fuers Lager, der Schnitt entscheidet', () => {
  const wertung = lagerWertung([0, 1, 0, 1], [3, 1, 2, 4], [1, 0, 2, 5]);
  assert.deepEqual(wertung, [
    { lager: 0, sitze: [0, 2], punkte: 5, schlucke: 3, platz: 1 },
    { lager: 1, sitze: [1, 3], punkte: 5, schlucke: 5, platz: 1 },
  ]);
  /* Drei gegen zwei: 6 Punkte zu dritt (Schnitt 2) verlieren gegen 5 zu zweit (2,5). */
  const ungleich = lagerWertung([0, 0, 0, 1, 1], [2, 2, 2, 2, 3], [0, 0, 0, 0, 0]);
  assert.deepEqual(ungleich.map((z) => [z.punkte, z.platz]), [[6, 2], [5, 1]]);
});

test('Team-Wertung und place: je Person, der Platz aus dem Lager, gezaehlt wie die Plattform zaehlt', () => {
  /* Drei Sieger auf 1, drei Verlierer auf 4 — nicht auf 2 (siehe lagerPlaetze). */
  assert.deepEqual(lagerPlaetze([0, 1, 0, 1, 0, 1], [5, 1, 5, 1, 5, 1]), [1, 4, 1, 4, 1, 4]);
  /* Wer im Siegerlager die wenigsten Punkte hat, steht trotzdem vorn. */
  assert.deepEqual(lagerPlaetze([0, 1, 0, 1], [0, 9, 20, 0]), [1, 3, 1, 3]);
  assert.deepEqual(lagerPlaetze([0, 0, 0, 1, 1], [2, 2, 2, 4, 4]), [3, 3, 3, 1, 1]);
  assert.deepEqual(lagerPlaetze([0, 1, 0, 1], [1, 1, 1, 1]), [1, 1, 1, 1]);
  assert.equal(lagerPlaetze(null, [1, 2]), null);

  for (const sitze of SITZE) {
    const ende = spieleDurch(erzeugePartie({ regeln: TEAM, saat: sitze, sitze, runden: 6 }));
    const standings = partykiste.standings(ende);
    const tabelle = lagerWertung(ende.lager!, ende.punkte, ende.schlucke);
    assert.equal(standings.length, sitze, 'eine Zeile je Person');
    for (const zeile of tabelle) {
      assert.equal(zeile.punkte, zeile.sitze.reduce((n, s) => n + ende.punkte[s]!, 0), `${sitze}: Lagerpunkte`);
      assert.equal(zeile.schlucke, zeile.sitze.reduce((n, s) => n + ende.schlucke[s]!, 0), `${sitze}: Lagerschluecke`);
      for (const s of zeile.sitze) {
        const eigene = standings.find((st) => st.seat === s)!;
        assert.equal(eigene.points, ende.punkte[s], `${sitze}: Sitz ${s} hat nicht seine eigenen Punkte`);
        assert.equal(eigene.place === 1, zeile.platz === 1, `${sitze}: Sitz ${s} steht nicht mit seinem Lager`);
      }
    }
    /* Die Zaehlweise der Plattform: Vor jedem Platz p stehen genau p-1 Sitze. */
    for (const zeile of standings) {
      assert.equal(standings.filter((o) => o.place < zeile.place).length, zeile.place - 1, `${sitze}: Platz ${zeile.place}`);
    }
    /* Die Sicht zeigt dieselbe Tabelle. */
    assert.deepEqual(sichtFuer(ende, 0).lagerTabelle, tabelle);
  }
});

test('Team-Abend: der Snapshot haelt Lager und Aufstellung', () => {
  const partie = verarbeite(erzeugePartie({ regeln: TEAM, saat: 3, sitze: 6, runden: 3 }), 0, {
    art: 'lagerwechsel',
    sitz: 2,
  });
  const wieder = partykiste.deserialize(partykiste.serialize(partie));
  assert.deepEqual(wieder.lager, [0, 1, 1, 1, 0, 1]);
  assert.equal(wieder.aufstellung, true);
  const los = verarbeite(wieder, 0, { art: 'bereit' });
  assert.equal(JSON.stringify(los.runde), JSON.stringify(verarbeite(partie, 0, { art: 'bereit' }).runde));
});

// ---------------------------------------------------------------------------
// Alle Modi: Bots, legalActions, der Tisch haengt nie
// ---------------------------------------------------------------------------

const MODI: PartykisteRegeln[] = [
  ESKALATION,
  TEAM,
  { ...DEFAULT_REGELN, modus: 'themenabend', paket: 'wg-abend' },
  { ...DEFAULT_REGELN, modus: 'themenabend', paket: 'arbeit' },
];

test('jeder Modus spielt bei jeder Sitzzahl zu Ende', () => {
  for (const regeln of MODI) {
    for (const sitze of SITZE) {
      const ende = spieleDurch(erzeugePartie({ regeln, saat: sitze * 7, sitze, runden: 9 }));
      assert.equal(ende.protokoll.length, 9, `${regeln.modus} zu ${sitze}`);
    }
  }
});

test('in jedem Modus: legalActions nennt nur, was act annimmt, und der Bot spielt nur daraus', () => {
  for (const regeln of MODI) {
    let partie = erzeugePartie({ regeln, saat: 31, sitze: 7, runden: 9 });
    let zuege = 0;
    while (!partie.fertig && zuege++ < 5000) {
      const sitz = amZug(partie);
      assert.notEqual(sitz, null, `${regeln.modus}: niemand am Zug`);
      const erlaubt = partykiste.legalActions(partie, sitz!);
      for (const aktion of erlaubt) {
        assert.doesNotThrow(() => verarbeite(partie, sitz!, aktion), `${regeln.modus}: ${JSON.stringify(aktion)}`);
      }
      const bot = partykiste.botAction(sichtFuer(partie, sitz!), 'genie');
      assert.ok(
        erlaubt.length === 0 || erlaubt.some((e) => JSON.stringify(e) === JSON.stringify(bot)),
        `${regeln.modus}: Bot spielt ${JSON.stringify(bot)}, erlaubt ist ${JSON.stringify(erlaubt)}`,
      );
      partie = verarbeite(partie, sitz!, bot as PartykisteAktion);
    }
    assert.equal(partie.fertig, true, `${regeln.modus}`);
  }
});

test('Team-Abend: der Bot stimmt bei "Wer wuerde eher" fuer den Gegner', () => {
  const regeln = { ...TEAM, minispiele: ['wereher'] as MinispielId[] };
  const runden = abgerechnet(erzeugePartie({ regeln, saat: 17, sitze: 8, runden: 3 }));
  for (const { runde, stand } of runden.values()) {
    if (runde.art !== 'wereher') return assert.fail('falsches Minispiel');
    runde.stimmen.forEach((ziel, sitz) => {
      assert.notEqual(stand.lager![ziel], stand.lager![sitz], `Sitz ${sitz} stimmt fuers eigene Lager`);
    });
  }
});

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
    /* Die drei mit Uhr (23.09.2026) — die Bombe mit eigenem Kategorien-Stapel. */
    case 'bombe':
      return [['bombe', runde.kategorieId]];
    case 'zehnsekunden':
      return [['zehnsekunden', runde.aufgabeId]];
    case 'koenigsbecher':
      return runde.regelVorrat.map((r) => ['koenigsbecher-regeln', r.karteId]);
    default:
      return [];
  }
}
