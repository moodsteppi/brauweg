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
 */

import { FIGUREN, UNTERGRUND } from './figuren';
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
    it('enthaelt jede Figur und den Untergrund', () => {
      const pfade = VORZULADEN.map((p) => p.pfad);
      for (const figur of Object.values(FIGUREN)) expect(pfade).toContain(figur);
      expect(pfade).toContain(UNTERGRUND);
      expect(pfade).toHaveLength(Object.keys(FIGUREN).length + 1);
    });

    it('nennt keinen Pfad doppelt', () => {
      const pfade = VORZULADEN.map((p) => p.pfad);
      expect(new Set(pfade).size).toBe(pfade.length);
    });

    it('gewichtet den Untergrund schwerer als eine Figur', () => {
      const untergrund = VORZULADEN.find((p) => p.pfad === UNTERGRUND);
      const figur = VORZULADEN.find((p) => p.pfad !== UNTERGRUND);
      // Die Textur wiegt 35 kB, eine Figur unter einem. Waere beides gleich
      // schwer, sagte der Balken das Gegenteil dessen, was passiert.
      expect(untergrund?.kb).toBeGreaterThan((figur?.kb ?? 0) * 10);
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
