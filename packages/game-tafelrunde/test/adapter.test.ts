import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BOT_TAKT_MS, KAMPF_NACHLAUF_MS, tafelrunde } from '../src/adapter.js';
import { DEFAULT_REGELN, SEAT_COUNTS } from '../src/regeln.js';
import { type TafelrundePartie, vollerVorrat } from '../src/partie.js';
import { kartenZahl } from '../src/katalog.js';

/** Wie viele Karten es insgesamt gibt. Diese Zahl darf sich nie aendern. */
const KARTEN_INSGESAMT = Object.values(vollerVorrat()).reduce((a, b) => a + b, 0);

/** Vorrat plus alles, was gerade in Laeden, Baenken und auf Brettern liegt. */
function alleKarten(partie: TafelrundePartie): number {
  let zahl = Object.values(partie.vorrat).reduce((a, b) => a + b, 0);
  for (const heer of Object.values(partie.heere)) {
    zahl += heer.laden.filter((k) => k !== null).length;
    for (const k of [...heer.bank, ...heer.brett]) if (k) zahl += kartenZahl(k.stufe);
  }
  return zahl;
}

function partie(seats = 2): TafelrundePartie {
  return tafelrunde.createParty({
    config: DEFAULT_REGELN,
    seats,
    rounds: 1,
    seed: 42,
    seedHex: 'deadbeefcafebabe0123456789abcdef',
  });
}

describe('Adapter', () => {
  it('meldet sich als spielbar fuer zwei bis acht Sitze', () => {
    assert.equal(tafelrunde.meta.id, 'tafelrunde');
    // Spielbar, seit der Bildschirm steht — und seit der Kampfsimulation
    // laeuft eine Runde auch vollstaendig durch.
    assert.equal(tafelrunde.meta.availability, 'playable');
    assert.deepEqual(tafelrunde.meta.seatCounts, SEAT_COUNTS);
    assert.equal(tafelrunde.meta.xpBasisZaehltKarten, false);
  });

  it('nimmt den Vorgabe-Regelsatz an', () => {
    assert.deepEqual(tafelrunde.validateConfig(DEFAULT_REGELN, 4, 1), []);
  });

  it('weist Unsinn im Regelsatz ab', () => {
    assert.ok(tafelrunde.validateConfig(null, 2, 1).length > 0);
    assert.ok(tafelrunde.validateConfig({ startLeben: 100 }, 2, 1).length > 0);
    assert.ok(
      tafelrunde.validateConfig({ ...DEFAULT_REGELN, startLeben: 9999 }, 2, 1).length > 0,
    );
    assert.ok(
      tafelrunde.validateConfig({ ...DEFAULT_REGELN, ladenPlaetze: 1.5 }, 2, 1).length > 0,
    );
    // Neun Sitze passen an keinen Tisch dieser Plattform.
    assert.ok(tafelrunde.validateConfig(DEFAULT_REGELN, 9, 1).length > 0);
  });

  it('weist eine Bank ab, die kleiner als das Brett des hoechsten Levels ist', () => {
    // Sonst liesse sich ein volles Brett nicht einmal mehr umbauen.
    assert.ok(
      tafelrunde.validateConfig({ ...DEFAULT_REGELN, bankPlaetze: 3 }, 2, 1).length > 0,
    );
  });

  it('kennt einen Sitz am Zug und seine Zuege', () => {
    const p = partie();
    assert.equal(tafelrunde.currentActor(p), 0);
    assert.ok(tafelrunde.legalActions(p, 0).length > 0);
    // Anders als bei einem Kartenspiel darf hier JEDER handeln.
    assert.ok(tafelrunde.legalActions(p, 1).length > 0);
    assert.equal(tafelrunde.isFinished(p), false);
  });

  it('haelt in der Kampfphase eine Schaupause und geht danach weiter', () => {
    let p = partie();
    p = tafelrunde.act(p, 0, { typ: 'bereit' });
    assert.equal(tafelrunde.interludeMs!(p), null, 'Noch ist nicht alles bereit');
    p = tafelrunde.act(p, 1, { typ: 'bereit' });
    assert.ok(tafelrunde.interludeMs!(p)! > 0);
    assert.equal(tafelrunde.currentActor(p), null);

    const weiter = tafelrunde.advanceInterlude!(p);
    assert.equal(weiter.runde, 2);
    assert.equal(tafelrunde.interludeMs!(weiter), null);
  });

  /**
   * Der Nachlauf hat einen BODEN, und der steht nicht in diesem Paket: Nach
   * dem letzten Ereignis laeuft die Todesfolge noch 500 ms (NACHSPIEL_MS in
   * KampfAnzeige.tsx minus einem Takt), und das Ergebnisschild braucht 420 ms
   * zum Auffahren (ka-auftritt im Stylesheet). Wer darunter geht, kuerzt nicht
   * das Zusehen, sondern schneidet die Anzeige mitten in der Bewegung ab.
   *
   * Die Zahlen stehen hier als Konstanten und nicht als Import: Der Client
   * darf aus einem Spielpaket importieren, umgekehrt nicht. Dass die Probe
   * dann zwei Abschriften prueft, ist genau ihr Zweck — sie schlaegt an, wenn
   * jemand den Nachlauf senkt, ohne im Client nachzusehen.
   */
  it('laesst nach dem letzten Ereignis Zeit fuer Todesfolge und Ergebnisschild', () => {
    const nachspielUeberstandMs = 500;
    const schildAuftrittMs = 420;
    assert.ok(
      KAMPF_NACHLAUF_MS >= nachspielUeberstandMs + schildAuftrittMs,
      'Der Nachlauf schneidet in die laufende Anzeige',
    );
    // Und danach muss noch etwas STEHEN bleiben, sonst hat man es nicht
    // gelesen, sondern nur aufblitzen sehen.
    assert.ok(KAMPF_NACHLAUF_MS - nachspielUeberstandMs >= 800);
  });

  /**
   * Der Takt der Plattform (0,8 s) ist auf ein Kartenspiel gemuenzt. Hier
   * macht ein Bot je Runde ein Dutzend Handgriffe, und weil `amZug` immer nur
   * den kleinsten offenen Sitz nennt, arbeitet die Plattform sie NACHEINANDER
   * ab — wer schon bereit ist, sieht zu. Gemessen: 16 fremde Handgriffe je
   * Runde im Median, mit 0,8 s also 12,8 s reines Warten.
   */
  it('kuerzt der Plattform den Takt zwischen zwei Botzuegen', () => {
    assert.equal(tafelrunde.meta.botTaktHoechstMs, BOT_TAKT_MS);
    assert.ok(BOT_TAKT_MS < 800, 'sonst waere die Angabe wirkungslos');
    // Nicht null: Die Bretter der Gegner sind oeffentlich, ein Bot soll sich
    // aufbauen und nicht erscheinen.
    assert.ok(BOT_TAKT_MS > 0);
  });

  it('ueberlebt Speichern und Laden', () => {
    const p = tafelrunde.act(partie(), 0, { typ: 'kaufen', platz: 0 });
    const roh = JSON.parse(JSON.stringify(tafelrunde.serialize(p)));
    assert.deepEqual(tafelrunde.deserialize(roh), p);
  });

  it('weist einen Snapshot aus einer unbekannten Fassung ab', () => {
    // Lieber ein Fehler als eine falsch gedeutete Partie.
    assert.throws(() => tafelrunde.deserialize({ v: 99 }), /Snapshot-Version/);
  });

  /**
   * Ein Tisch, der beim Deploy der Kampfsimulation gerade lief, muss
   * weiterlaufen. Version 1 kennt das Feld `kaempfe` nicht; ohne die
   * Nachsicht beim Laden waere die Partie verloren.
   */
  it('laedt einen Snapshot aus der Zeit vor der Kampfsimulation', () => {
    const roh = JSON.parse(JSON.stringify(tafelrunde.serialize(partie()))) as Record<
      string,
      unknown
    >;
    delete roh['kaempfe'];
    roh['v'] = 1;

    const geladen = tafelrunde.deserialize(roh);
    assert.deepEqual(geladen.kaempfe, []);
    // Und die Kampfphase loest sich auf, statt an einem fehlenden Feld zu
    // haengen.
    let p = tafelrunde.act(geladen, 0, { typ: 'bereit' });
    p = tafelrunde.act(p, 1, { typ: 'bereit' });
    assert.equal(tafelrunde.advanceInterlude!(p).runde, 2);
  });

  it('liefert Platzierungen und Erfahrungsgrundlage fuer jeden Sitz', () => {
    const p = partie(4);
    assert.equal(tafelrunde.standings(p).length, 4);
    assert.deepEqual(Object.keys(tafelrunde.xpBasis!(p)), ['0', '1', '2', '3']);
  });

  it('laesst den Bot nicht auf der Zuschauersicht laufen', () => {
    assert.throws(
      () => tafelrunde.botAction(tafelrunde.spectatorView(partie())),
      /Zuschauersicht/,
    );
  });

  /**
   * Die Bot-Stufe des Tisches kommt seit dem 05.09.2026 im Modul an.
   *
   * Der sanfte Bot sitzt auf seinem Gold, der harte gibt es aus — ueber viele
   * Zuege ist das der Unterschied, den man am Tisch merkt. Geprueft wird
   * deshalb, dass ueberhaupt UNTERSCHIEDLICH gespielt wird: Waere die Stufe
   * wie vorher weggeworfen, kaeme dreimal dieselbe Zugfolge heraus, und der
   * Regler am Tisch waere eine Beschriftung ohne Wirkung.
   */
  it('waehlt die Gangart nach der Bot-Stufe des Tisches', () => {
    const zugfolge = (stufe: 'anfaenger' | 'standard' | 'genie'): string => {
      let p = partie(2);
      const zuege: string[] = [];
      for (let i = 0; i < 60 && !tafelrunde.isFinished(p); i += 1) {
        if (tafelrunde.interludeMs!(p) !== null) {
          p = tafelrunde.advanceInterlude!(p);
          continue;
        }
        const sitz = tafelrunde.currentActor(p);
        if (sitz === null) break;
        const aktion = tafelrunde.botAction(tafelrunde.viewFor(p, sitz), stufe);
        if (sitz === 0) zuege.push(JSON.stringify(aktion));
        p = tafelrunde.act(p, sitz, aktion);
      }
      return zuege.join('|');
    };

    assert.notEqual(
      zugfolge('anfaenger'),
      zugfolge('genie'),
      'sanft und hart spielen dieselbe Partie gleich — die Stufe kommt nicht an',
    );
    // `standard` ist die Vorgabe und damit die Gangart `normal`.
    assert.equal(zugfolge('standard'), zugfolge('standard'));
  });
});

describe('Bot', () => {
  it('spielt eine ganze Partie zu acht zu Ende, ohne zu werfen', () => {
    // Der schaerfste Dauertest, den dieser Kern hat: Jede Aktion, die der Bot
    // waehlt, muss `act` auch annehmen — und der Vorrat muss ueber dreissig
    // Runden mit acht Laeden durchhalten.
    let p = partie(8);
    let schritte = 0;

    while (!tafelrunde.isFinished(p) && schritte < 20000) {
      schritte++;
      if (tafelrunde.interludeMs!(p) !== null) {
        p = tafelrunde.advanceInterlude!(p);
        continue;
      }
      const sitz = tafelrunde.currentActor(p);
      assert.notEqual(sitz, null, 'Niemand am Zug und keine Schaupause: Der Tisch haengt');
      p = tafelrunde.act(p, sitz!, tafelrunde.botAction(tafelrunde.viewFor(p, sitz!)));
    }

    assert.ok(tafelrunde.isFinished(p), `nach ${schritte} Schritten nicht fertig`);
    assert.equal(tafelrunde.standings(p).length, 8);
    // Kein Vorrat darf dabei ins Minus gelaufen sein.
    for (const [id, zahl] of Object.entries(p.vorrat)) {
      assert.ok(zahl >= 0, `${id} steht bei ${zahl}`);
    }
    /*
     * Und keine Karte darf verschwunden oder dazugekommen sein. Das ist die
     * schaerfste Aussage ueber den Vorrat, die sich treffen laesst: Sie faellt
     * bei jedem vergessenen Rueckweg um — Neu-Wuerfeln, Verkaufen,
     * Rundenanfang, Ausscheiden.
     */
    assert.equal(alleKarten(p), KARTEN_INSGESAMT);
  });

  it('stellt gekaufte Einheiten auch auf das Brett', () => {
    // Ein Bot, der nur hamstert, sieht beim Zusehen aus wie ein Fehler.
    let p = partie(2);
    for (let i = 0; i < 200; i++) {
      if (tafelrunde.interludeMs!(p) !== null) {
        p = tafelrunde.advanceInterlude!(p);
        continue;
      }
      const sitz = tafelrunde.currentActor(p);
      if (sitz === null) break;
      p = tafelrunde.act(p, sitz, tafelrunde.botAction(tafelrunde.viewFor(p, sitz)));
      if (p.heere[0]!.brett.some((k) => k !== null)) return;
    }
    assert.fail('Der Bot hat in 200 Schritten keine Einheit aufgestellt');
  });
});
