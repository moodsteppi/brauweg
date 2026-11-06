import {
  type BroChessAufgabe as ModulAufgabe,
  type BroChessSicht as ModulSicht,
  type BroChessWahl as ModulWahl,
  type BroChessZug as ModulZug,
  brochess,
  pruefeRegeln,
} from '@brauweg/game-brochess';
import { describe, expect, it } from 'vitest';

import { type Spielart, spielartRegeln, trenneAktionen } from '../minispiele/brochess/geheim';
import type {
  BroChessAufgabe,
  BroChessSicht,
  BroChessWahl,
  BroChessZug,
  GeheimeDameSicht,
  SecretDameSicht,
} from '../minispiele/brochess/sicht';
import { ZEITKONTROLLEN, regelnFuer } from '../minispiele/brochess/zeit';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von BroChess und dem Modul.
 *
 * Das Brett liest `brett` Feld fuer Feld und die Zuege aus `legalActions`.
 * Beides muss hier stimmen: Ein umbenanntes Feld machte das Brett leer, ein
 * umbenanntes Aktionsfeld machte jeden Klick wirkungslos — beides still.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<BroChessSicht, EchteSicht>;

/** Und kein Feld darf nur noch im Client stehen. */
type _keinFeldNurImClient = Leer<Exclude<keyof BroChessSicht, keyof EchteSicht>>;

/**
 * Die Aktion ebenso: Der Bildschirm schickt einen Eintrag aus
 * `legalActions` zurueck, liest aber `von`, `nach` und `umwandlung` daraus.
 */
type _zugPasst = PasstAuf<BroChessZug, Beweglich<ModulZug>>;
type _keinZugfeldNurImClient = Leer<Exclude<keyof BroChessZug, keyof ModulZug>>;
/** Aufgeben baut der Bildschirm selbst — es steht nicht in `legalActions`. */
type _aufgabePasst = PasstAuf<BroChessAufgabe, Beweglich<ModulAufgabe>>;
/** Die Wahl der geheimen Dame steht in `legalActions`; der Bildschirm liest `feld`. */
type _wahlPasst = PasstAuf<BroChessWahl, Beweglich<ModulWahl>>;
type _keinWahlfeldNurImClient = Leer<Exclude<keyof BroChessWahl, keyof ModulWahl>>;
type ModulSecretDame = NonNullable<EchteSicht['secretDame']>;
type _keinSecretDameFeldNurImClient = Leer<Exclude<keyof SecretDameSicht, keyof ModulSecretDame>>;
type _keinDamenfeldNurImClient = Leer<
  Exclude<keyof GeheimeDameSicht, keyof NonNullable<ModulSecretDame['meine']>>
>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

const FELDER = [
  'zuschauer',
  'fen',
  'brett',
  'amZug',
  'meineFarbe',
  'weissSitz',
  'schach',
  'letzterZug',
  'ende',
  'verlauf',
  'uhr',
  'geschlagen',
  'vorsprung',
  'vorab',
  'secretDame',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof BroChessSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof BroChessSicht>>;

describe('Vertrag BroChess', () => {
  const gesehen = felderEinerPartie(brochess as unknown as Spielmodul, { sitze: 2, runden: 1 });

  it('liefert jedes Feld, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('spielt eine Partie tatsaechlich, statt nur die Grundstellung zu zeigen', () => {
    expect(gesehen.schritte).toBeGreaterThan(0);
  });

  it('zaehlt die Zuege mit genau den Feldern auf, die das Brett liest', () => {
    const partie = brochess.createParty({ config: {}, seats: 2, rounds: 1, seed: 0 });
    const zuege = brochess.legalActions(partie, brochess.currentActor(partie) ?? 0);
    expect(zuege).toHaveLength(20);
    expect(zuege).toContainEqual({ type: 'zug', von: 'e2', nach: 'e4' });
  });
});

describe('Vertrag BroChess: Zeitauswahl', () => {
  // Die Auswahl im Bildschirm (zeit.ts) darf nichts anbieten, was das Modul
  // ablehnt — sonst scheitert genau dieser Tisch erst beim Erstellen.
  it('jede angebotene Zeit nimmt das Modul auch an', () => {
    for (const z of ZEITKONTROLLEN) {
      expect(pruefeRegeln({ tableSize: 2, rounds: 1, ...regelnFuer(z) }, 2, 1), z.id).toEqual([]);
    }
  });
});

describe('Vertrag BroChess: Secret Dame', () => {
  /*
   * Der Bot kann Secret Dame noch nicht (`botAction` wirft), darum spielt
   * hier kein `felderEinerPartie`, sondern eine Handvoll Aktionen von Hand —
   * jede aus `legalActions`, wie der Bildschirm sie auch nimmt.
   */
  const SECRET_DAME = ['regel', 'wahlLaeuft', 'gewaehlt', 'meine', 'bekannt', 'ereignisse'] as const;
  type _secretListe = Leer<Exclude<keyof SecretDameSicht, (typeof SECRET_DAME)[number]>>;

  it('jede angebotene Spielart nimmt das Modul auch an', () => {
    const arten: Spielart[] = [
      { modus: 'normal', regel: 'A' },
      { modus: 'secretDame', regel: 'A' },
      { modus: 'secretDame', regel: 'B' },
    ];
    for (const art of arten) {
      expect(pruefeRegeln({ tableSize: 2, rounds: 1, ...spielartRegeln(art) }, 2, 1), JSON.stringify(art)).toEqual(
        [],
      );
    }
    // Normal schickt nichts mit: derselbe Tisch wie vor dem Modus.
    expect(spielartRegeln({ modus: 'normal', regel: 'B' })).toEqual({});
  });

  it('liefert Wahl, Sicht und Aufdecken mit genau den Feldern, die der Bildschirm liest', () => {
    let partie = brochess.createParty({
      config: { modus: 'secretDame', schachDurchVerdeckte: 'A' },
      seats: 2,
      rounds: 1,
      seed: 0,
    });
    const sicht = (sitz: number): BroChessSicht => brochess.viewFor(partie, sitz) as unknown as BroChessSicht;
    const weiss = sicht(0).weissSitz;
    const schwarz = 1 - weiss;

    // Waehrend der Wahl: nur Wahl-Aktionen, beide Sitze gleichzeitig.
    for (const sitz of [weiss, schwarz]) {
      const { zuege, wahl } = trenneAktionen(brochess.legalActions(partie, sitz));
      expect(zuege).toEqual([]);
      expect(wahl).toHaveLength(15);
      expect(Object.keys(sicht(sitz).secretDame ?? {}).sort()).toEqual([...SECRET_DAME].sort());
    }
    partie = brochess.act(partie, weiss, { type: 'wahl', feld: 'g1' });
    partie = brochess.act(partie, schwarz, { type: 'wahl', feld: 'b8' });
    expect(sicht(weiss).secretDame?.meine).toEqual({ zustand: 'verdeckt', feld: 'g1', grundfigur: 'n' });
    // Der Gegner sieht nicht, was gewaehlt wurde — nur, dass.
    expect(sicht(schwarz).secretDame?.bekannt.w).toBeNull();

    // 1.e4 e5 2.Nf3 Nc6 3.Nf3xf7 — der Springer zieht wie eine Dame.
    const zug = (sitz: number, von: string, nach: string): void => {
      const angebot = trenneAktionen(brochess.legalActions(partie, sitz)).zuege;
      const passt = angebot.find((z) => z.von === von && z.nach === nach);
      expect(passt, `${von}-${nach}`).toBeDefined();
      partie = brochess.act(partie, sitz, passt!);
    };
    zug(weiss, 'e2', 'e4');
    zug(schwarz, 'e7', 'e5');
    zug(weiss, 'g1', 'f3');
    zug(schwarz, 'b8', 'c6');
    zug(weiss, 'f3', 'f7');

    const gegner = sicht(schwarz).secretDame!;
    expect(gegner.bekannt.w).toEqual({ zustand: 'aufgedeckt', feld: 'f7', grundfigur: 'n' });
    expect(gegner.ereignisse).toEqual([{ art: 'aufgedeckt', farbe: 'w', feld: 'f7', grundfigur: 'n', halbzug: 5 }]);
    expect(Object.keys(gegner.bekannt.w!).sort()).toEqual(['feld', 'grundfigur', 'zustand']);
  });
});
