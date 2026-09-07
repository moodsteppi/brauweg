import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eiland } from '../src/adapter.js';
import { DEFAULT_REGELN } from '../src/regeln.js';
import { waehlbare } from '../src/partie.js';

function partie() {
  return eiland.createParty({
    config: DEFAULT_REGELN,
    seats: 2,
    rounds: 1,
    seed: 42,
    seedHex: 'deadbeefcafebabe0123456789abcdef',
  });
}

describe('Adapter', () => {
  it('meldet sich als spielbares Zweierspiel', () => {
    assert.equal(eiland.meta.id, 'eiland');
    assert.equal(eiland.meta.availability, 'playable');
    assert.deepEqual(eiland.meta.seatCounts, [2]);
    assert.equal(eiland.meta.xpBasisZaehltKarten, false);
  });

  it('nimmt den Vorgabe-Regelsatz an', () => {
    assert.deepEqual(eiland.validateConfig(DEFAULT_REGELN, 2, 1), []);
  });

  it('weist Unsinn im Regelsatz ab', () => {
    assert.ok(eiland.validateConfig(null, 2, 1).length > 0);
    assert.ok(eiland.validateConfig({ spalten: 10 }, 2, 1).length > 0);
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, spalten: 99 }, 2, 1).length > 0);
    // Ungerade Feldzahl: Die Punktsymmetrie haette ein Feld, das sein eigener
    // Spiegel ist (siehe pruefeRegeln).
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, spalten: 7, zeilen: 7 }, 2, 1).length > 0);
    // Sichtweite ueber die halbe Karte hinaus waere ein offenes Brett.
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, sichtweite: 40 }, 2, 1).length > 0);
    // Mehr Hindernisse als Land.
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, seen: 6, berge: 12 }, 2, 1).length > 0);
    // Drei Sitze: nicht vorgesehen, die Karte kennt zwei Ecken.
    assert.ok(eiland.validateConfig(DEFAULT_REGELN, 3, 1).length > 0);
  });

  it('nennt einen Sitz am Zug und ueberlaesst dem Bildschirm die Aktion', () => {
    const p = partie();
    assert.equal(eiland.currentActor(p), 0);
    /*
     * Leer, und das ist die Aussage: Eine Aktion ist hier eine MENGE von
     * Feldern, die sich nicht aufzaehlen laesst. Was anwaehlbar ist, steht
     * stattdessen in der Sicht — derselbe Weg wie bei Skat und Doppelkopf.
     */
    assert.deepEqual(eiland.legalActions(p, 0), []);
    assert.ok(eiland.viewFor(p, 0).waehlbar.length > 0);
    assert.deepEqual(eiland.viewFor(p, 0).waehlbar, waehlbare(p, 0));
  });

  it('haelt einen Snapshot ueber Serialisieren hinweg', () => {
    const p = partie();
    const roh = JSON.parse(JSON.stringify(eiland.serialize(p)));
    assert.deepEqual(eiland.deserialize(roh), p);
  });

  it('nimmt einen Snapshot der zweiten Fassung ohne Bauwerke an', () => {
    // Vor dem 2. September verschwand ein eingesammeltes Ornament von der
    // Karte; solche Partien tragen keine Bauwerk-Liste und bekommen eine leere.
    const roh = JSON.parse(JSON.stringify(eiland.serialize(partie()))) as Record<
      string,
      unknown
    >;
    delete roh['bauwerk'];
    const alt = eiland.deserialize({ ...roh, v: 2 });
    assert.equal(alt.bauwerk.length, alt.gelaende.length);
    assert.ok(alt.bauwerk.every((b) => b === null));
  });

  it('traegt einem Snapshot der dritten Fassung leere Einsaetze nach', () => {
    // Bis Version 3 kannte ein Kampf keinen Einsatz; die Rundenmeldung einer
    // laufenden Partie bekommt ihn leer nachgetragen.
    const roh = JSON.parse(JSON.stringify(eiland.serialize(partie()))) as Record<
      string,
      unknown
    >;
    const alt = eiland.deserialize({
      ...roh,
      v: 3,
      letzte: { runde: 1, kaempfe: [{ platz: 5, sieger: 0 }], genommen: {}, verfallen: {}, ornamente: {} },
    });
    assert.deepEqual(alt.letzte?.kaempfe[0], { platz: 5, sieger: 0, einsatz: [] });
    assert.deepEqual(alt.letzte?.reserve, {});
  });

  it('weist einen Snapshot aus einer fremden Fassung ab', () => {
    const roh = eiland.serialize(partie()) as Record<string, unknown>;
    assert.throws(() => eiland.deserialize({ ...roh, v: 99 }), /Snapshot-Version/);
  });

  it('laesst den Bot nicht auf die Zuschauersicht', () => {
    // Sonst haette er kein Gebiet und wuesste nicht, wofuer er spielt.
    const p = partie();
    assert.throws(() => eiland.botAction(eiland.spectatorView(p)), /Zuschauersicht/);
  });

  it('spielt eine Partie ueber die Modulschnittstelle zu Ende', () => {
    let p = partie();
    let runden = 0;
    while (!eiland.isFinished(p) && runden < 1000) {
      // Genau die Schleife der Plattform: Wer am Zug ist, wird gefragt — hier
      // gibt der Bot je Aufruf einen ganzen Zettel ab (siehe bot.ts).
      const sitz = eiland.currentActor(p);
      assert.notEqual(sitz, null, 'niemand am Zug, obwohl die Partie laeuft');
      p = eiland.act(p, sitz!, eiland.botAction(eiland.viewFor(p, sitz!)));
      runden++;
    }
    assert.ok(eiland.isFinished(p));
    const tafel = eiland.standings(p);
    assert.equal(tafel.length, 2);
    assert.equal(tafel[0]!.place, 1);
    const xp = eiland.xpBasis!(p);
    assert.equal(xp[0], tafel.find((t) => t.seat === 0)!.points);
  });

  it('nennt eine Rundenfrist und die Runde als ihr Merkmal', () => {
    const p = partie();
    assert.equal(eiland.phaseMs!(p), DEFAULT_REGELN.rundenMs);
    /*
     * Das Merkmal ist der ganze Grund, warum es hier eine Frist geben kann:
     * `phaseMs` liefert zwischen zwei Runden NIE null (bis auf das Partieende),
     * an dem die Plattform sonst eine neue Phase erkennt. Sie vergleicht
     * stattdessen `phaseKey` (siehe schedulePhase in runtime/party.ts).
     */
    assert.equal(eiland.phaseKey!(p), p.runde);
    const weiter = eiland.advancePhase!(p);
    assert.equal(weiter.runde, p.runde + 1);
    assert.notEqual(eiland.phaseKey!(weiter), eiland.phaseKey!(p));
  });

  it('verbucht eine abgelaufene Runde als leeren Zettel', () => {
    // Wer nicht abgegeben hat, nimmt nichts: Eine halbe Auswahl gibt es nicht,
    // sie entsteht erst mit der Abgabe (siehe fristAbgelaufen in partie.ts).
    const p = partie();
    const weiter = eiland.advancePhase!(p);
    assert.deepEqual(weiter.punkte, p.punkte);
    assert.deepEqual(weiter.letzte?.genommen, { 0: [], 1: [] });
    // Und eine Runde ohne Feldwechsel ist eine Leerrunde — zwei davon beenden
    // die Partie, ein toter Tisch laeuft also nicht endlos weiter.
    assert.equal(weiter.leerrunden, p.leerrunden + 1);
  });

  it('liefert am Partieende keine Frist mehr', () => {
    let p = partie();
    let schritte = 0;
    while (!eiland.isFinished(p) && schritte < 1000) {
      p = eiland.advancePhase!(p);
      schritte++;
    }
    assert.ok(eiland.isFinished(p), 'die Partie endete nicht durch Leerrunden');
    assert.equal(eiland.phaseMs!(p), null);
    // Und ein zweiter Ablauf an einer fertigen Partie ruehrt nichts mehr an.
    assert.equal(eiland.advancePhase!(p), p);
  });

  it('traegt einem Snapshot ohne Rundenfrist die Vorgabe nach', () => {
    // Tische von VOR dem 07.09.2026 haben `rundenMs` nicht im Regelsatz. Ohne
    // Nachtrag stuende die Partie bis zum Ende ohne Deckel da.
    const roh = JSON.parse(JSON.stringify(eiland.serialize(partie()))) as Record<string, unknown>;
    const regeln = { ...(roh['regeln'] as Record<string, unknown>) };
    delete regeln['rundenMs'];
    const alt = eiland.deserialize({ ...roh, regeln });
    assert.equal(alt.regeln.rundenMs, DEFAULT_REGELN.rundenMs);
    assert.equal(eiland.phaseMs!(alt), DEFAULT_REGELN.rundenMs);
  });

  it('nimmt einen Regelsatz ohne Rundenfrist an und weist eine unsinnige ab', () => {
    const { rundenMs: _weg, ...ohne } = DEFAULT_REGELN;
    assert.deepEqual(eiland.validateConfig(ohne, 2, 1), []);
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, rundenMs: 500 }, 2, 1).length > 0);
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, rundenMs: 999_999 }, 2, 1).length > 0);
  });

  it('merkt sich einen ausgestiegenen Sitz', () => {
    const p = eiland.markLeft(partie(), 1);
    assert.ok(eiland.standings(p).find((s) => s.seat === 1)!.left);
  });
});
