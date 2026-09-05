import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Das Vorladen von Tafelrunde.
 *
 * Geprueft wird genau das, woran es im Betrieb scheitern kann, und jeder Punkt
 * steht so in der Aufgabe:
 *
 *   1. Die Liste ist VOLLSTAENDIG und leitet sich aus `FIGUREN` ab. Eine
 *      abgeschriebene zweite Liste waere beim naechsten neuen Recken luecken-
 *      haft — und zwar genau dort, wo es auffaellt.
 *   2. Eine fehlende Datei haelt das Spiel NICHT an.
 *   3. Auch ein Posten, der gar nicht antwortet, haelt es nicht an: nach der
 *      Frist geht es weiter, und im Protokoll steht, was fehlt.
 *   4. Der zweite Aufruf laedt nichts nach. Wer eine zweite Partie startet,
 *      soll den Ladebildschirm nicht wiedersehen.
 *   5. Der Fortschritt zaehlt Gewicht, nicht Dateien — sonst stuende der
 *      Balken bei 96 %, waehrend die dickste Datei noch unterwegs ist.
 *   6. Das Spielpaket haengt im SELBEN Lauf wie die Bilder und bringt seinen
 *      eigenen Weg mit. Ohne das zerfiele die eine Wartezeit wieder in zwei.
 */

import { FIGUREN, UNTERGRUND } from './figuren';
import { PAKET_KB, PAKET_KENNUNG } from './paket';
import {
  type Ladestand,
  type Posten,
  VORZULADEN,
  vorratLaden,
  vorratStand,
  vorratZuruecksetzen,
} from './vorladen';

/** Ein Holer, dessen Ausgang der Test von Hand entscheidet. */
function handbetrieb(): {
  holen: (pfad: string) => Promise<void>;
  fertig: (pfad: string) => void;
  fehlschlag: (pfad: string) => void;
  angefragt: string[];
} {
  const offen = new Map<string, { gut: () => void; schlecht: () => void }>();
  const angefragt: string[] = [];
  return {
    angefragt,
    holen: (pfad) =>
      new Promise<void>((gut, schlecht) => {
        angefragt.push(pfad);
        offen.set(pfad, { gut: () => gut(), schlecht: () => schlecht(new Error(pfad)) });
      }),
    fertig: (pfad) => offen.get(pfad)?.gut(),
    fehlschlag: (pfad) => offen.get(pfad)?.schlecht(),
  };
}

const POSTEN: readonly Posten[] = [
  { pfad: '/dick.webp', kb: 30 },
  { pfad: '/duenn-a.webp', kb: 1 },
  { pfad: '/duenn-b.webp', kb: 1 },
];

/** Ein Umlauf der Mikroaufgaben — Versprechen liefern nicht synchron. */
const durchatmen = (): Promise<void> => new Promise((f) => setTimeout(f, 0));

describe('vorladen', () => {
  beforeEach(() => {
    vorratZuruecksetzen();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('die Liste', () => {
    it('enthaelt jede Figur, den Untergrund und das Spielpaket', () => {
      const pfade = VORZULADEN.map((p) => p.pfad);
      for (const figur of Object.values(FIGUREN)) expect(pfade).toContain(figur);
      expect(pfade).toContain(UNTERGRUND);
      expect(pfade).toContain(PAKET_KENNUNG);
      expect(pfade).toHaveLength(Object.keys(FIGUREN).length + 2);
    });

    it('nennt keinen Pfad doppelt', () => {
      const pfade = VORZULADEN.map((p) => p.pfad);
      expect(new Set(pfade).size).toBe(pfade.length);
    });

    it('gewichtet den Untergrund schwerer als eine Figur', () => {
      const untergrund = VORZULADEN.find((p) => p.pfad === UNTERGRUND);
      const figur = VORZULADEN.find((p) => p.pfad === FIGUREN.moosheiler);
      // Die Textur wiegt 35 kB, eine Figur unter einem. Waere beides gleich
      // schwer, sagte der Balken das Gegenteil dessen, was passiert.
      expect(untergrund?.kb).toBeGreaterThan((figur?.kb ?? 0) * 10);
    });

    /*
     * Das Spielpaket steht VORN, und das ist keine Kosmetik: Der Lauf stoesst
     * alle Posten in Listenreihenfolge an, und ohne den Schirm gibt es nichts
     * zu zeigen. Rutschte es hinter die 23 Bilder, ginge es auf einer
     * schmalen Leitung als letztes raus — und genau darauf wartet der
     * Ladebildschirm.
     */
    it('stellt das Spielpaket vor die Bilder', () => {
      expect(VORZULADEN[0]?.pfad).toBe(PAKET_KENNUNG);
    });

    /*
     * Es bringt seinen eigenen Weg mit; ein Bildholer kaeme an ein Paket
     * nicht heran. Faellt `holen` weg, versuchte der Lauf still ein `<img>`
     * auf die Kennung — der Posten schluege fehl, der Balken bliebe bei einem
     * Drittel stehen und das Spiel liefe trotzdem weiter. Also unsichtbar.
     */
    it('holt das Spielpaket auf eigenem Weg', () => {
      expect(typeof VORZULADEN[0]?.holen).toBe('function');
    });

    /*
     * Das Gewicht ist eine Schaetzung (siehe paket.ts) — geprueft wird
     * deshalb nur die Groessenordnung, nicht der Wert. Steht das Paket eines
     * Tages bei 1 oder bei 500, sagt der Balken etwas Falsches ueber die
     * laengste Wartezeit des Spiels.
     */
    it('gibt dem Spielpaket ein Gewicht in der Groessenordnung der Bilder', () => {
      const bilder = VORZULADEN.filter((p) => p.pfad !== PAKET_KENNUNG).reduce(
        (summe, p) => summe + p.kb,
        0,
      );
      expect(PAKET_KB).toBeGreaterThan(bilder / 10);
      expect(PAKET_KB).toBeLessThan(bilder * 3);
    });
  });

  describe('der Lauf', () => {
    it('fragt jeden Posten genau einmal an', async () => {
      const hand = handbetrieb();
      void vorratLaden({ posten: POSTEN, holen: hand.holen });
      await durchatmen();
      expect(hand.angefragt).toEqual(['/dick.webp', '/duenn-a.webp', '/duenn-b.webp']);
    });

    it('ist erst fertig, wenn alle durch sind', async () => {
      const hand = handbetrieb();
      let fertig: Ladestand | null = null;
      void vorratLaden({ posten: POSTEN, holen: hand.holen }).then((s) => (fertig = s));

      hand.fertig('/dick.webp');
      hand.fertig('/duenn-a.webp');
      await durchatmen();
      expect(fertig).toBeNull();
      expect(vorratStand().fertig).toBe(false);

      hand.fertig('/duenn-b.webp');
      await durchatmen();
      expect(fertig).not.toBeNull();
      expect(vorratStand().fertig).toBe(true);
      expect(vorratStand().fehlend).toEqual([]);
    });

    it('rechnet den Fortschritt nach Gewicht und nicht nach Dateien', async () => {
      const hand = handbetrieb();
      void vorratLaden({ posten: POSTEN, holen: hand.holen });

      hand.fertig('/duenn-a.webp');
      hand.fertig('/duenn-b.webp');
      await durchatmen();
      // Zwei von drei Dateien — aber erst 2 von 32 kB. Nach Dateien gezaehlt
      // stuende der Balken hier bei 67 %.
      expect(vorratStand().erledigt).toBe(2);
      expect(vorratStand().gesamt).toBe(3);
      expect(vorratStand().anteil).toBeCloseTo(2 / 32, 3);

      hand.fertig('/dick.webp');
      await durchatmen();
      expect(vorratStand().anteil).toBe(1);
    });

    /*
     * Der Weg des Spielpakets, ohne das echte Paket: Ein Posten mit eigenem
     * `holen` darf gar nicht erst beim Bildholer landen — der wuerde ein
     * `<img>` auf eine Kennung setzen, die keine Adresse ist.
     */
    it('nimmt den eigenen Weg eines Postens statt des Bildholers', async () => {
      const hand = handbetrieb();
      let paketAngefragt = 0;
      let paketDa = (): void => {};
      const paket: Posten = {
        pfad: 'paket:probe',
        kb: 20,
        holen: () => {
          paketAngefragt += 1;
          return new Promise<void>((gut) => (paketDa = () => gut()));
        },
      };
      void vorratLaden({ posten: [paket, POSTEN[1]!], holen: hand.holen });
      await durchatmen();

      expect(paketAngefragt).toBe(1);
      expect(hand.angefragt).toEqual(['/duenn-a.webp']);

      hand.fertig('/duenn-a.webp');
      await durchatmen();
      // 1 von 21 kB: Das Paket wiegt schwerer als das Bild, und der Balken
      // sagt das auch.
      expect(vorratStand().anteil).toBeCloseTo(1 / 21, 3);
      expect(vorratStand().fertig).toBe(false);

      paketDa();
      await durchatmen();
      expect(vorratStand().fertig).toBe(true);
      expect(vorratStand().fehlend).toEqual([]);
    });
  });

  describe('wenn etwas fehlt', () => {
    it('spielt weiter und nennt die ausgefallene Datei', async () => {
      const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hand = handbetrieb();
      const versprechen = vorratLaden({ posten: POSTEN, holen: hand.holen });

      hand.fehlschlag('/dick.webp');
      hand.fertig('/duenn-a.webp');
      hand.fertig('/duenn-b.webp');
      const stand = await versprechen;

      expect(stand.fertig).toBe(true);
      expect(stand.fehlend).toEqual(['/dick.webp']);
      // Der Fehlschlag zaehlt als erledigt: Sonst haenge der Balken bei zwei
      // Dritteln, obwohl nichts mehr kommt.
      expect(stand.erledigt).toBe(3);
      expect(warnung).toHaveBeenCalled();
      expect(String(warnung.mock.calls[0]?.[1])).toContain('/dick.webp');
    });

    it('macht nach der Frist weiter, auch wenn niemand antwortet', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hand = handbetrieb();
      let stand: Ladestand | null = null;
      void vorratLaden({ posten: POSTEN, holen: hand.holen, fristMs: 500 }).then(
        (s) => (stand = s),
      );

      await vi.advanceTimersByTimeAsync(499);
      expect(stand).toBeNull();
      await vi.advanceTimersByTimeAsync(2);

      expect(stand).not.toBeNull();
      expect(vorratStand().fertig).toBe(true);
      expect(vorratStand().fehlend).toHaveLength(3);
      expect(String(warnung.mock.calls[0]?.[0])).toContain('500 ms');
    });

    it('wartet weiter, solange etwas ankommt — die Frist zaehlt Stillstand', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const hand = handbetrieb();
      let stand: Ladestand | null = null;
      void vorratLaden({ posten: POSTEN, holen: hand.holen, fristMs: 500 }).then(
        (s) => (stand = s),
      );

      /* Drei Dateien im 400-ms-Takt: Eine GESAMTfrist von 500 ms haette hier
         nach der ersten zugeschlagen. Auf gedrosseltem 3G ist genau das der
         Normalfall — der Satz braucht dort ueber neun Sekunden, ohne dass
         irgendetwas kaputt waere. */
      await vi.advanceTimersByTimeAsync(400);
      hand.fertig('/dick.webp');
      await vi.advanceTimersByTimeAsync(400);
      expect(stand).toBeNull();
      hand.fertig('/duenn-a.webp');
      await vi.advanceTimersByTimeAsync(400);
      expect(stand).toBeNull();

      hand.fertig('/duenn-b.webp');
      await vi.advanceTimersByTimeAsync(1);
      expect(vorratStand().fehlend).toEqual([]);
      expect(vorratStand().fertig).toBe(true);
    });

    it('meldet nach der Frist nicht noch einmal, wenn ein Nachzuegler eintrifft', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hand = handbetrieb();
      const gesehen: Ladestand[] = [];
      void vorratLaden({ posten: POSTEN, holen: hand.holen, fristMs: 500 }).then((s) =>
        gesehen.push(s),
      );
      await vi.advanceTimersByTimeAsync(501);
      const nachDerFrist = vorratStand();

      // Der Nachzuegler darf den Stand nicht mehr anfassen — sonst spraenge
      // der Balken zurueck, waehrend die Partie laengst laeuft.
      hand.fertig('/dick.webp');
      await vi.advanceTimersByTimeAsync(1);
      expect(vorratStand()).toBe(nachDerFrist);
    });
  });

  describe('nur einmal', () => {
    it('holt beim zweiten Aufruf nichts nach', async () => {
      const hand = handbetrieb();
      const erstes = vorratLaden({ posten: POSTEN, holen: hand.holen });
      hand.fertig('/dick.webp');
      hand.fertig('/duenn-a.webp');
      hand.fertig('/duenn-b.webp');
      await erstes;

      const zweite = handbetrieb();
      const zweites = vorratLaden({ posten: POSTEN, holen: zweite.holen });
      await durchatmen();
      expect(zweite.angefragt).toEqual([]);
      expect(zweites).toBe(erstes);
      expect((await zweites).fertig).toBe(true);
    });

    it('haengt sich beim zweiten Aufruf an den laufenden Vorgang', async () => {
      const hand = handbetrieb();
      const erstes = vorratLaden({ posten: POSTEN, holen: hand.holen });
      const zweitesHand = handbetrieb();
      expect(vorratLaden({ posten: POSTEN, holen: zweitesHand.holen })).toBe(erstes);
      await durchatmen();
      expect(zweitesHand.angefragt).toEqual([]);
    });
  });

  it('kommt mit einer leeren Liste zurecht', async () => {
    const stand = await vorratLaden({ posten: [], holen: () => Promise.resolve() });
    expect(stand.fertig).toBe(true);
    expect(stand.anteil).toBe(1);
  });
});
