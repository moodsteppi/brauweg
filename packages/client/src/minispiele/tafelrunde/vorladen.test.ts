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
 *   7. Ein Posten darf sich UNTERWEGS melden. Das fuellt den Balken feiner —
 *      vor allem aber stoesst es die Ruhefrist an, sonst schriebe die Uhr eine
 *      Datei ab, die gerade laedt (siehe FRIST_MS).
 */

import { BLATT_PFADE } from './bildfolge';
import { FIGUREN, UNTERGRUND } from './figuren';
import { PAKET_KB, PAKET_KENNUNG } from './paket';
import {
  type Fortschritt,
  type Holer,
  type Ladestand,
  type Posten,
  VORZULADEN,
  stromHolen,
  stromPosten,
  vorratLaden,
  vorratStand,
  vorratZuruecksetzen,
} from './vorladen';

/** Ein Holer, dessen Ausgang und Zwischenberichte der Test von Hand setzt. */
function handbetrieb(): {
  holen: Holer;
  fertig: (pfad: string) => void;
  fehlschlag: (pfad: string) => void;
  /** Ein Zwischenbericht, wie ihn `stromHolen` je gelesenem Stueck schickt. */
  bericht: (pfad: string, gelesen: number, gesamt?: number | null) => void;
  angefragt: string[];
} {
  const offen = new Map<
    string,
    { gut: () => void; schlecht: () => void; melden: Fortschritt }
  >();
  const angefragt: string[] = [];
  return {
    angefragt,
    holen: (pfad, melden) =>
      new Promise<void>((gut, schlecht) => {
        angefragt.push(pfad);
        offen.set(pfad, { gut: () => gut(), schlecht: () => schlecht(new Error(pfad)), melden });
      }),
    fertig: (pfad) => offen.get(pfad)?.gut(),
    fehlschlag: (pfad) => offen.get(pfad)?.schlecht(),
    bericht: (pfad, gelesen, gesamt = null) => offen.get(pfad)?.melden(gelesen, gesamt),
  };
}

/** Das Gewicht des dicken Postens in Bytes — 30 kB, siehe `POSTEN`. */
const DICK_BYTES = 30 * 1024;

/**
 * Eine Antwort von Hand, wie `stromHolen` sie von `fetch` bekommt.
 *
 * Von Hand und nicht als echte `Response`: Der Test soll die Stuecke selbst
 * schneiden und auch die Faelle bauen koennen, die eine echte Antwort nicht
 * hergibt — keine `Content-Length`, kein mitlesbarer Koerper.
 */
function fetchProbe(opt: {
  status?: number;
  laenge?: string | null;
  /** Die Groessen der Stuecke; `null` heisst: gar kein lesbarer Koerper. */
  stuecke?: readonly number[] | null;
}): { holer: ReturnType<typeof vi.fn>; amStueck: () => number } {
  const stuecke = opt.stuecke ?? [];
  let naechstes = 0;
  let amStueck = 0;
  const antwort = {
    ok: (opt.status ?? 200) < 400,
    status: opt.status ?? 200,
    headers: { get: (name: string) => (name === 'content-length' ? (opt.laenge ?? null) : null) },
    body:
      opt.stuecke === null
        ? null
        : {
            getReader: () => ({
              read: () =>
                Promise.resolve(
                  naechstes < stuecke.length
                    ? { done: false, value: new Uint8Array(stuecke[naechstes++]!) }
                    : { done: true, value: undefined },
                ),
            }),
          },
    arrayBuffer: () => {
      amStueck += 1;
      return Promise.resolve(new ArrayBuffer(0));
    },
  };
  return {
    holer: vi.fn(() => Promise.resolve(antwort as unknown as Response)),
    amStueck: () => amStueck,
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
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('die Liste', () => {
    it('enthaelt jede Figur, jedes Blatt, den Untergrund und das Spielpaket', () => {
      const pfade = VORZULADEN.map((p) => p.pfad);
      for (const figur of Object.values(FIGUREN)) expect(pfade).toContain(figur);
      /* Die fuenf Blaetter der Bildfolgen: Sie kommen erst in der Kampfphase
         zum Einsatz, wiegen aber mehr als alles andere an Bildern zusammen —
         wer sie erst dann holt, sieht seinen ersten Kampf ohne Figuren. */
      for (const blatt of BLATT_PFADE) expect(pfade).toContain(blatt);
      expect(pfade).toContain(UNTERGRUND);
      expect(pfade).toContain(PAKET_KENNUNG);
      expect(pfade).toHaveLength(Object.keys(FIGUREN).length + BLATT_PFADE.length + 2);
    });

    it('gewichtet ein Blatt schwerer als den Untergrund', () => {
      const blatt = VORZULADEN.find((p) => p.pfad === BLATT_PFADE[0]);
      const untergrund = VORZULADEN.find((p) => p.pfad === UNTERGRUND);
      // Ein Blatt liegt bei rund 43 kB, die Textur bei 35. Fuenf Blaetter sind
      // damit gut zwei Drittel des Gewichts — der Balken muss das abbilden.
      expect(blatt?.kb).toBeGreaterThan(untergrund?.kb ?? 0);
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
     *
     * DIE UNTERE SCHRANKE WAR EINMAL EIN ZEHNTEL. Seit die fuenf Blaetter der
     * Bildfolgen mit in der Liste stehen (6.9.2026), wiegen die Bilder rund
     * 272 statt 57 kB — das Paket liegt damit knapp unter einem Zehntel, ohne
     * dass sich an ihm etwas geaendert haette. Ein Zwanzigstel ist immer noch
     * eng genug, um eine 1 oder eine 500 zu fangen.
     */
    it('gibt dem Spielpaket ein Gewicht in der Groessenordnung der Bilder', () => {
      const bilder = VORZULADEN.filter((p) => p.pfad !== PAKET_KENNUNG).reduce(
        (summe, p) => summe + p.kb,
        0,
      );
      expect(PAKET_KB).toBeGreaterThan(bilder / 20);
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

  /*
   * Der Zwischenbericht (`Fortschritt`). Er ist fuer die grossen Dateien
   * gebaut, die mit der 3D-Arena kommen: Ein Posten, der sich nur einmal
   * meldet, laesst den Balken waehrend seines ganzen Downloads stehen — und
   * schlimmer, die Ruhefrist laeuft ihm davon.
   */
  describe('der Zwischenbericht', () => {
    it('fuellt den Balken schon waehrend einer Datei', async () => {
      const hand = handbetrieb();
      void vorratLaden({ posten: POSTEN, holen: hand.holen });
      await durchatmen();

      hand.bericht('/dick.webp', DICK_BYTES / 2, DICK_BYTES);
      await durchatmen();
      // 15 von 32 kB, obwohl noch keine einzige Datei fertig ist. Ohne den
      // Bericht stuende der Balken hier auf null.
      expect(vorratStand().anteil).toBeCloseTo(15 / 32, 3);
      expect(vorratStand().erledigt).toBe(0);
    });

    it('zaehlt das Gewicht nicht doppelt, wenn der Posten fertig wird', async () => {
      const hand = handbetrieb();
      void vorratLaden({ posten: POSTEN, holen: hand.holen });
      await durchatmen();

      hand.bericht('/dick.webp', DICK_BYTES, DICK_BYTES);
      await durchatmen();
      expect(vorratStand().anteil).toBeCloseTo(30 / 32, 3);

      hand.fertig('/dick.webp');
      await durchatmen();
      // Dieselben 30 kB, jetzt als erledigt gebucht. Bliebe der Teilstand
      // stehen, staende der Balken bei 60 von 32 — also am Deckel, waehrend
      // zwei Dateien noch unterwegs sind.
      expect(vorratStand().anteil).toBeCloseTo(30 / 32, 3);
      expect(vorratStand().erledigt).toBe(1);
    });

    it('rechnet ohne Content-Length gegen das geschaetzte Gewicht', async () => {
      const hand = handbetrieb();
      void vorratLaden({ posten: POSTEN, holen: hand.holen });
      await durchatmen();

      // Kein Gesamtwert (chunked, gzip): Massstab ist dann `Posten.kb`.
      hand.bericht('/dick.webp', DICK_BYTES / 2, null);
      await durchatmen();
      expect(vorratStand().anteil).toBeCloseTo(15 / 32, 3);
    });

    it('laesst den Balken nicht ueberlaufen, wenn die Schaetzung zu klein war', async () => {
      const hand = handbetrieb();
      void vorratLaden({ posten: POSTEN, holen: hand.holen });
      await durchatmen();

      // Doppelt so viele Bytes wie geschaetzt. Ohne Deckel waere der Posten
      // allein schon 60 von 32 kB schwer.
      hand.bericht('/dick.webp', DICK_BYTES * 2, null);
      await durchatmen();
      expect(vorratStand().anteil).toBeCloseTo(30 / 32, 3);
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

    /*
     * DER EIGENTLICHE GRUND fuer den Zwischenbericht. Eine Datei im
     * Megabyte-Bereich laedt laenger am Stueck, als die Ruhefrist lang ist —
     * ohne Bericht schriebe die Uhr sie mitten im Herunterladen ab, obwohl
     * jede Sekunde Bytes ankommen.
     */
    it('stoesst die Ruhefrist mit jedem Zwischenbericht an', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hand = handbetrieb();
      let stand: Ladestand | null = null;
      void vorratLaden({ posten: POSTEN, holen: hand.holen, fristMs: 500 }).then(
        (s) => (stand = s),
      );

      // Eine einzige Datei, die im 400-ms-Takt Stuecke liefert und nach 1,2 s
      // immer noch laedt. Ohne die Anstoesse waere die Frist bei 500 gefallen.
      await vi.advanceTimersByTimeAsync(400);
      hand.bericht('/dick.webp', DICK_BYTES / 3, DICK_BYTES);
      await vi.advanceTimersByTimeAsync(400);
      hand.bericht('/dick.webp', (DICK_BYTES * 2) / 3, DICK_BYTES);
      await vi.advanceTimersByTimeAsync(400);
      expect(stand).toBeNull();
      expect(vorratStand().fertig).toBe(false);

      // Und sie faellt weiterhin, wenn wirklich nichts mehr kommt.
      await vi.advanceTimersByTimeAsync(501);
      expect(vorratStand().fertig).toBe(true);
      expect(vorratStand().fehlend).toHaveLength(3);
    });

    it('nimmt nach der Frist keinen Zwischenbericht mehr an', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hand = handbetrieb();
      void vorratLaden({ posten: POSTEN, holen: hand.holen, fristMs: 500 });
      await vi.advanceTimersByTimeAsync(501);
      const nachDerFrist = vorratStand();

      hand.bericht('/dick.webp', DICK_BYTES / 2, DICK_BYTES);
      await vi.advanceTimersByTimeAsync(1);
      // Der Balken steht auf voll und muss dort bleiben: Die Partie laeuft.
      expect(vorratStand()).toBe(nachDerFrist);
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

  /*
   * `stromHolen` — der zweite Holer neben `bildHolen`. Er ist der Weg fuer
   * alles, was gross ist und kein Bild (GLB-Modelle der 3D-Arena) und
   * unterscheidet sich in genau einem Punkt: Er meldet unterwegs.
   */
  describe('stromHolen', () => {
    it('meldet die gelesenen Bytes gegen die Content-Length', async () => {
      const probe = fetchProbe({ laenge: '60', stuecke: [10, 20, 30] });
      vi.stubGlobal('fetch', probe.holer);
      const berichte: [number, number | null][] = [];

      await stromHolen('/modell.glb', (gelesen, gesamt) => berichte.push([gelesen, gesamt]));

      expect(probe.holer).toHaveBeenCalledWith('/modell.glb');
      // Gemeldet wird der STAND, nicht der Zuwachs: 10, 30, 60 — nicht
      // 10, 20, 30. Sonst muesste der Lauf selbst mitzaehlen, und ein
      // verlorener Bericht verschoebe den Balken dauerhaft.
      expect(berichte).toEqual([
        [10, 60],
        [30, 60],
        [60, 60],
      ]);
    });

    it('meldet ohne Content-Length einen unbekannten Gesamtwert', async () => {
      const probe = fetchProbe({ laenge: null, stuecke: [10, 20] });
      vi.stubGlobal('fetch', probe.holer);
      const berichte: [number, number | null][] = [];

      await stromHolen('/modell.glb', (gelesen, gesamt) => berichte.push([gelesen, gesamt]));

      // `null` und nicht etwa null Bytes: Der Lauf soll die Schaetzung aus
      // `Posten.kb` nehmen und nicht durch null teilen.
      expect(berichte).toEqual([
        [10, null],
        [30, null],
      ]);
    });

    it('lehnt eine Antwort mit Fehlerstatus ab', async () => {
      const probe = fetchProbe({ status: 404, laenge: '0', stuecke: [] });
      vi.stubGlobal('fetch', probe.holer);

      // Ein 404 kommt bei `fetch` als gewoehnliche Antwort an. Ginge er als
      // Erfolg durch, haekelte der Lauf eine Datei ab, die es nicht gibt —
      // und der Ladebildschirm meldete Vollzug.
      await expect(stromHolen('/fehlt.glb')).rejects.toThrow('404');
    });

    it('kommt auch ohne mitlesbaren Koerper durch', async () => {
      const probe = fetchProbe({ laenge: '60', stuecke: null });
      vi.stubGlobal('fetch', probe.holer);
      const berichte: number[] = [];

      // Kein `body` (jsdom, aeltere Browser): Dann eben in einem Stueck. Die
      // Datei ist da, nur ohne Zwischenbericht — ein Rueckfall, der still
      // weiterlaeuft, statt den Posten zu verlieren.
      await expect(stromHolen('/modell.glb', (g) => berichte.push(g))).resolves.toBeUndefined();
      expect(probe.amStueck()).toBe(1);
      expect(berichte).toEqual([]);
    });

    it('laesst sich ohne Zuhoerer aufrufen', async () => {
      const probe = fetchProbe({ laenge: '10', stuecke: [10] });
      vi.stubGlobal('fetch', probe.holer);
      await expect(stromHolen('/modell.glb')).resolves.toBeUndefined();
    });
  });

  /*
   * `stromPosten` ist der Bauplan fuer den kuenftigen GLB-Posten. Geprueft
   * wird die eine Eigenschaft, die man ihm sonst nicht ansieht: Der Pfad steht
   * genau EINMAL da und ist derselbe, den der Holer anfordert.
   */
  describe('stromPosten', () => {
    it('holt genau den Pfad, unter dem der Posten abgehakt wird', async () => {
      const probe = fetchProbe({ laenge: '2048', stuecke: [1024, 1024] });
      vi.stubGlobal('fetch', probe.holer);
      const berichte: number[] = [];

      const posten = stromPosten('/tafelrunde/modelle/wache.glb', 2400);
      expect(posten.pfad).toBe('/tafelrunde/modelle/wache.glb');
      expect(posten.kb).toBe(2400);

      await posten.holen?.((gelesen) => berichte.push(gelesen));
      expect(probe.holer).toHaveBeenCalledWith(posten.pfad);
      expect(berichte).toEqual([1024, 2048]);
    });

    it('laeuft im Lauf wie jeder andere Posten', async () => {
      const probe = fetchProbe({ laenge: '2048', stuecke: [1024, 1024] });
      vi.stubGlobal('fetch', probe.holer);
      const modell = stromPosten('/wache.glb', 2);

      // Zwei kB Modell neben einem kB Bild: Der Lauf sieht keinen
      // Unterschied — er sieht ein Versprechen, das haelt.
      const stand = await vorratLaden({
        posten: [modell, POSTEN[1]!],
        holen: () => Promise.resolve(),
      });
      expect(stand.fertig).toBe(true);
      expect(stand.fehlend).toEqual([]);
      expect(stand.erledigt).toBe(2);
    });
  });

  it('kommt mit einer leeren Liste zurecht', async () => {
    const stand = await vorratLaden({ posten: [], holen: () => Promise.resolve() });
    expect(stand.fertig).toBe(true);
    expect(stand.anteil).toBe(1);
  });
});
