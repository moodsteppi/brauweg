/**
 * Prüft den Austausch der Bahnwerkstatt: Was sie ausgibt, muss sie verlustfrei
 * wieder einlesen — für JEDE der 40 Katalogbahnen, in beiden Quelltextformen
 * und als JSON.
 *
 * Der Grund ist der ganze Arbeitsweg: Eine Bahn wird geladen, verändert,
 * ausgegeben, in den Katalog kopiert und später wieder geladen. Geht dabei ein
 * `ziel` am Strudel oder ein `dekor` verloren, rollt die Bahn im Spiel anders
 * als in der Werkstatt, und niemand sieht es dem Diff an.
 */
import { describe, expect, it } from 'vitest';

import { KARTEN } from '../../minispiele/golf/karten';
import {
  SPEICHER_SCHLUESSEL,
  alsBahn,
  alsJson,
  alsQuelltext,
  beschreibungAusQuelle,
  katalogZeile,
  ladeStand,
  leseLiteral,
  lies,
  speichere,
} from './austausch';
import type { Werkstattbahn } from './modell';

function gelesen(text: string): Werkstattbahn {
  const r = lies(text);
  if ('fehler' in r) throw new Error(r.fehler.join('; '));
  return r.bahn;
}

describe('Export → Import aller Katalogbahnen', () => {
  it('der Katalog hat die erwarteten 40 Bahnen', () => {
    expect(KARTEN).toHaveLength(40);
  });

  for (const karte of KARTEN) {
    describe(karte.id, () => {
      it('Katalogeintrag hin und zurück', () => {
        const text = alsQuelltext(karte, 'eintrag');
        expect(gelesen(text)).toEqual(karte);
        // Und derselbe Text beim zweiten Mal: Die Ausgabe hängt nur an der
        // Bahn, nicht an ihrem Weg in die Werkstatt.
        expect(alsQuelltext(gelesen(text), 'eintrag')).toBe(text);
      });

      it('eigene Datei hin und zurück', () => {
        expect(gelesen(alsQuelltext(karte, 'datei'))).toEqual(karte);
      });

      it('JSON hin und zurück', () => {
        expect(gelesen(alsJson(karte))).toEqual(karte);
        expect(JSON.parse(alsJson(karte))).toEqual(karte);
      });
    });
  }
});

describe('alsQuelltext', () => {
  const karte = KARTEN[0];

  it('schreibt den Katalogeintrag im Stil der Sammeldateien', () => {
    const text = alsQuelltext(karte, 'eintrag');
    expect(text.startsWith('  /**\n')).toBe(true);
    expect(text).toContain(`    id: '${karte.id}',\n`);
    expect(text).toContain('    abschlaege: [\n      [');
    expect(text.trimEnd().endsWith('},')).toBe(true);
    // Die freien Angaben kennt der heutige Typ nicht — sie dürfen im Eintrag
    // nicht als Feld stehen, sonst übersetzt die Sammeldatei nicht.
    const mitAngaben: Werkstattbahn = { ...karte, beschreibung: 'Ein Satz.', thema: 'Test', tags: ['a'] };
    const eintrag = alsQuelltext(mitAngaben, 'eintrag');
    expect(eintrag).not.toMatch(/^\s*(beschreibung|thema|tags):/m);
    expect(eintrag).toContain(' * Ein Satz.');
  });

  it('schreibt die eigene Datei mit export const bahn und den Angaben', () => {
    const b: Werkstattbahn = { ...karte, beschreibung: 'Zwei\n\nAbsätze.', autor: 'Robin', tags: ['kurz', 'eis'] };
    const text = alsQuelltext(b, 'datei');
    expect(text.startsWith("import type { Karte } from '../karte';\n")).toBe(true);
    expect(text).toContain('export const bahn: Karte = {');
    expect(text).toContain("  autor: 'Robin',");
    expect(text).toContain("  tags: ['kurz', 'eis'],");
    expect(gelesen(text)).toEqual(b);
  });

  it('holt die Beschreibung aus dem Kommentar über dem Eintrag zurück', () => {
    const b: Werkstattbahn = { ...karte, beschreibung: 'Erster Absatz mit einem etwas längeren Satz, der umbrochen werden muss, weil er so lang ist.\n\nZweiter.' };
    expect(gelesen(alsQuelltext(b, 'eintrag'))).toEqual(b);
  });

  it('entschärft Anführungszeichen und Kommentarenden im Text', () => {
    const b: Werkstattbahn = { ...karte, name: "Robin's \\ Bahn", beschreibung: 'Achtung */ Ende' };
    const zurueck = gelesen(alsQuelltext(b, 'datei'));
    expect(zurueck.name).toBe("Robin's \\ Bahn");
  });

  it('nennt die Zeile für den Modulkatalog', () => {
    expect(katalogZeile(karte)).toBe(`  { id: '${karte.id}', schwierigkeit: ${karte.schwierigkeit} },`);
  });
});

describe('lies', () => {
  it('liest einen von Hand kopierten Katalogeintrag mit Kommentaren und Komma', () => {
    const text = `
      /**
       * Eine Bahn.
       */
      {
        id: 'k99-probe', // Kennung
        name: "Probe",
        schwierigkeit: 2,
        breite: 14, hoehe: 22, par: 3, schlagLimit: 6, zeitLimitS: 60,
        abschlaege: [[4, 19], [10, 19],],
        loch: [7, 4],
        /* keine Wände */
        waende: [],
        zonen: [{ art: 'strudel', x: 7, y: 12, r: 1.5, staerke: 8, ziel: { x: 7, y: 8 } }],
      },
    `;
    const b = gelesen(text);
    expect(b.id).toBe('k99-probe');
    expect(b.beschreibung).toBe('Eine Bahn.');
    expect(b.zonen[0]).toEqual({ art: 'strudel', x: 7, y: 12, r: 1.5, staerke: 8, ziel: { x: 7, y: 8 } });
  });

  it('meldet, was fehlt, statt eine halbe Bahn zu laden', () => {
    const r = lies("{ id: 'x', name: 'y', schwierigkeit: 9, waende: [{ x: 1 }], zonen: [{ art: 'lava' }] }");
    expect('fehler' in r).toBe(true);
    if ('fehler' in r) {
      expect(r.fehler).toContain('schwierigkeit muss 1, 2, 3, 4 oder 5 sein');
      expect(r.fehler.some((f) => f.startsWith('Wand 0:'))).toBe(true);
      expect(r.fehler.some((f) => f.startsWith('Zone 0: unbekannte Art'))).toBe(true);
    }
  });

  it('lehnt gebrochene Grad am Drehkreuz ab (sonst NaN in der Physik)', () => {
    const karte = { ...KARTEN[0], zonen: [{ art: 'drehkreuz', x: 6, y: 9, laenge: 4, gradJeTakt: 1.5, phase: 0 }] };
    const r = alsBahn(karte);
    expect('fehler' in r).toBe(true);
  });

  it('führt nichts aus, was eingefügt wird', () => {
    expect(() => leseLiteral('{ id: alert(1) }')).toThrow();
    expect('fehler' in lies('{ id: (() => 1)() }')).toBe(true);
  });

  it('meldet Unsinn mit Zeile und Spalte', () => {
    const r = lies('{\n  id: ,\n}');
    expect('fehler' in r && r.fehler[0]).toMatch(/Zeile 2/);
  });
});

describe('beschreibungAusQuelle', () => {
  const quellen = Object.values(
    import.meta.glob<string>(['../../minispiele/golf/karten/k*.ts', '!../../minispiele/golf/karten/*.test.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  );

  it('findet zu jeder Katalogbahn ihren Kommentar', () => {
    expect(quellen.length).toBeGreaterThan(0);
    const ohne = KARTEN.filter((k) => beschreibungAusQuelle(quellen, k.id) === null).map((k) => k.id);
    expect(ohne).toEqual([]);
    expect(beschreibungAusQuelle(quellen, 'k01-der-erste-schlag')).toMatch(/^Keine einzige Zone/);
  });

  it('nimmt den Kommentar nur, wenn er direkt vor dem Objekt steht', () => {
    const text = "/** Dateikopf */\nexport const X = [\n  {\n    name: 'a',\n    id: 'k77-x',\n  },\n];";
    expect(beschreibungAusQuelle([text], 'k77-x')).toBeNull();
    const gut = "/**\n * Die Idee.\n */\nexport const bahn: Karte = {\n  id: 'k77-x',\n};";
    expect(beschreibungAusQuelle([gut], 'k77-x')).toBe('Die Idee.');
  });
});

describe('Zwischenstand', () => {
  it('legt ab und holt zurück', () => {
    localStorage.clear();
    const bahn: Werkstattbahn = { ...KARTEN[5], beschreibung: 'Merk dir das.' };
    expect(speichere({ bahn, herkunft: KARTEN[5].id, raster: 0.25 })).toBe(true);
    expect(ladeStand()).toEqual({ bahn, herkunft: KARTEN[5].id, raster: 0.25 });
  });

  it('nimmt Kaputtes als nichts', () => {
    localStorage.setItem(SPEICHER_SCHLUESSEL, '{"bahn": {"id": 3}}');
    expect(ladeStand()).toBeNull();
    localStorage.setItem(SPEICHER_SCHLUESSEL, 'kein json');
    expect(ladeStand()).toBeNull();
  });

  it('überlebt einen Speicher, der wirft', () => {
    const wirft = {
      getItem: () => {
        throw new Error('gesperrt');
      },
      setItem: () => {
        throw new Error('voll');
      },
    } as unknown as Storage;
    expect(ladeStand(wirft)).toBeNull();
    expect(speichere({ bahn: KARTEN[0], herkunft: null, raster: 0.5 }, wirft)).toBe(false);
  });
});
