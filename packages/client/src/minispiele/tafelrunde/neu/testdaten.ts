/**
 * Gemeinsame Testdaten der Bausteintests von TafelrundeNeu.
 *
 * Von Hand geschrieben und klein gehalten, aber in der Form, die das Modul
 * liefert (sicht.ts, synergien.ts, faehigkeiten.ts) — mit den neuen Namen
 * und Kennungen. Nur fuer Tests; der Bildschirm importiert hieraus nichts.
 */

import type { Einheit, Faehigkeit, Stufenwerte, TafelrundeSicht } from '../sicht';
import type { Synergie } from '../Synergien';

export const KATALOG: Record<string, Einheit> = {
  dorfwache: { id: 'dorfwache', name: 'Pinguinwache', kosten: 1, rolle: 'wache', marken: ['krieger', 'waechter'], leben: 600, angriff: 40, tempo: 1, reichweite: 1, ruestung: 20 },
  astschuetze: { id: 'astschuetze', name: 'Eichhornschütze', kosten: 1, rolle: 'schuetze', marken: ['naturwesen'], leben: 400, angriff: 50, tempo: 1, reichweite: 3, ruestung: 5 },
  gassendieb: { id: 'gassendieb', name: 'Pinguindieb', kosten: 1, rolle: 'meuchler', marken: ['meuchler'], leben: 450, angriff: 55, tempo: 1.2, reichweite: 1, ruestung: 5 },
  grimmbart: { id: 'grimmbart', name: 'Kaiserkrieger', kosten: 2, rolle: 'wache', marken: ['krieger'], leben: 750, angriff: 60, tempo: 0.9, reichweite: 1, ruestung: 25 },
  sturmrufer: { id: 'sturmrufer', name: 'Sturmalbatros', kosten: 3, rolle: 'magier', marken: ['elementar'], leben: 500, angriff: 70, tempo: 0.8, reichweite: 3, ruestung: 5 },
};

export const FAEHIGKEITEN: Record<string, Faehigkeit | null> = {
  dorfwache: { id: 'schildwall', name: 'Schildwall', text: 'Hebt den Schild: kurz deutlich mehr Rüstung.', art: 'aktiv', mana: 60 },
  astschuetze: { id: 'jederVierte', name: 'Volltreffer', text: 'Jeder vierte Schuss trifft doppelt.', art: 'passiv', mana: 0 },
  gassendieb: null,
  grimmbart: { id: 'axtwirbel', name: 'Axtwirbel', text: 'Wirbelt die Axt und trifft alle Gegner ringsum.', art: 'aktiv', mana: 70 },
  sturmrufer: { id: 'kettenblitz', name: 'Kettenblitz', text: 'Ein Blitz springt nacheinander auf drei Gegner.', art: 'aktiv', mana: 80 },
};

const OHNE = { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 0 };

export const TABELLE: Synergie[] = [
  {
    marke: 'krieger',
    name: 'Krieger',
    wirkung: 'Krieger auf dem Brett tragen etwas mehr Rüstung und schlagen unter halbem Leben härter zu.',
    stufen: [
      { schwelle: 2, bonus: { ...OHNE, ruestung: 5 }, effekt: { art: 'kampfgeist' }, text: '+5 Rüstung, unter halbem Leben +20 % Angriff.' },
      { schwelle: 3, bonus: { ...OHNE, ruestung: 8 }, effekt: { art: 'kampfgeist' }, text: '+8 Rüstung, unter halbem Leben +30 % Angriff.' },
      { schwelle: 5, bonus: { ...OHNE, ruestung: 12 }, effekt: { art: 'kampfgeist' }, text: '+12 Rüstung, unter halbem Leben +50 % Angriff.' },
    ],
  },
  {
    marke: 'naturwesen',
    name: 'Naturwesen',
    wirkung: 'Naturwesen bekommen etwas mehr Leben und heilen sich im Kampf laufend selbst.',
    stufen: [
      { schwelle: 2, bonus: { ...OHNE, lebenProzent: 5 }, effekt: { art: 'wachstum' }, text: '+5 % Leben, heilen 0,4 % je Sekunde.' },
      { schwelle: 3, bonus: { ...OHNE, lebenProzent: 8 }, effekt: { art: 'wachstum' }, text: '+8 % Leben, heilen 0,6 % je Sekunde.' },
      { schwelle: 5, bonus: { ...OHNE, lebenProzent: 12 }, effekt: { art: 'wachstum' }, text: '+12 % Leben, heilen 1 % je Sekunde.' },
    ],
  },
];

export const STUFENWERTE: Record<string, Stufenwerte[]> = {
  dorfwache: [
    { stufe: 1, leben: 600, angriff: 40, tempo: 1, reichweite: 1, ruestung: 20, erloes: 1 },
    { stufe: 2, leben: 1080, angriff: 72, tempo: 1, reichweite: 1, ruestung: 20, erloes: 3 },
  ],
  grimmbart: [{ stufe: 1, leben: 750, angriff: 60, tempo: 0.9, reichweite: 1, ruestung: 25, erloes: 2 }],
};

/** Eine Sicht der Ruestphase: vier Sitze, ich bin Sitz 0. */
export function ruestsicht(teil: Partial<TafelrundeSicht> = {}): TafelrundeSicht {
  return {
    ich: 0,
    runde: 3,
    rundenGrenze: 30,
    phase: 'vorbereitung',
    fertig: false,
    sieger: null,
    platzierung: [
      { sitz: 0, platz: 1, runden: 3 },
      { sitz: 1, platz: 2, runden: 3 },
    ],
    zuschauer: false,
    ladenPlaetze: 5,
    bankPlaetze: 9,
    brettFelder: 20,
    brettReihen: 4,
    brettSpalten: 5,
    arenaReihen: 10,
    verschmelzZahl: 3,
    maxStufe: 3,
    vorrat: {},
    eigenes: {
      sitz: 0,
      leben: 12,
      gold: 5,
      level: 3,
      laden: ['dorfwache', 'astschuetze', 'grimmbart', null, 'sturmrufer'],
      bank: [{ id: 'dorfwache', stufe: 1 }, null, null, null, null, null, null, null, null],
      brett: Array.from({ length: 20 }, (_, i) =>
        i === 16 ? { id: 'dorfwache', stufe: 2 } : i === 17 ? { id: 'grimmbart', stufe: 1 } : null,
      ),
      serie: { art: null, laenge: 0 },
      bereit: false,
      ausRunde: null,
      feldplaetze: 3,
      belegt: 2,
      einkommen: 6,
      neuwuerfelnKosten: 0,
      aufstiegKosten: 4,
      darfHandeln: true,
      synergien: [
        { marke: 'krieger', name: 'Krieger', anzahl: 2, schwelle: 2, naechsteSchwelle: 3, bonus: { ...OHNE, ruestung: 5 }, effekt: { art: 'kampfgeist' }, text: '+5 Rüstung, unter halbem Leben +20 % Angriff.' },
      ],
    },
    gegner: [
      {
        sitz: 1,
        leben: 9,
        level: 3,
        serie: { art: null, laenge: 0 },
        brett: Array.from({ length: 20 }, (_, i) => (i === 17 ? { id: 'gassendieb', stufe: 1 } : null)),
        bereit: true,
        ausRunde: null,
        verlassen: false,
        synergien: [],
      },
    ],
    leftSeats: [],
    zeitraffer: 2,
    schrittMs: 300,
    ...teil,
  };
}
