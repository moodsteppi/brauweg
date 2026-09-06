import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import rohszene from './ruestkammer-szene.json?raw';
import { ProbeRuestkammer } from './ProbeRuestkammer';

/*
 * Die Probenseite `/probe/ruestkammer`.
 *
 * Geprueft wird dreierlei, und das erste ist das wichtigste:
 *
 *   1. DIE SZENE TAUGT NOCH. Sie ist erzeugt und nicht geschrieben
 *      (`ruestkammer-erzeugen.mjs`), und wer sie neu erzeugt, bekommt einen
 *      anderen Stand. Faellt dabei die letzte gesperrte Ladenkarte weg oder
 *      steht ploetzlich alles auf Stufe 1, zeigt die Probe still etwas
 *      anderes als das, wofuer sie gebaut wurde — und niemand merkt es, weil
 *      sie ja weiter „geht". Dieselbe Bauart wie die Szenenpruefung in
 *      `../kampf/ProbeKampf.test.tsx` und aus demselben Grund.
 *   2. ES SIND DIE ECHTEN BAUTEILE. Nicht ihr Aussehen — das steht in
 *      styles.css und gehoert dem Auge —, sondern dass wirklich `Hexbrett`,
 *      `Bankreihe` und `Ladenkarte` laufen. Genau das war der Anlass der
 *      Seite: Die Wegwerf-Probe vom 6.9.2026 hatte diese Klassen von Hand
 *      nachgestellt.
 *   3. DIE SEITE BEDIENT SICH. Antippen schlaegt das Blatt der Einheit auf,
 *      „Aufstellen" darin waehlt sie, der Tipp aufs Ziel verschiebt sie,
 *      „am Zug" aus sperrt alles, „zuruecksetzen" stellt her.
 *
 * Was Brett, Bank und Karte selbst tun, steht in den Proben des Bildschirms
 * (`screens/Tafelrunde.test.tsx`) und wird hier nicht noch einmal geprueft.
 */

interface Kaempfer {
  id: string;
  stufe: number;
}

interface Szene {
  saat: string;
  runde: number;
  ich: number;
  brettReihen: number;
  brettSpalten: number;
  ladenPlaetze: number;
  bankPlaetze: number;
  verschmelzZahl: number;
  eigenes: {
    gold: number;
    leben: number;
    level: number;
    feldplaetze: number;
    laden: (string | null)[];
    bank: (Kaempfer | null)[];
    brett: (Kaempfer | null)[];
    synergien: { marke: string; name: string; anzahl: number; schwelle: number | null }[];
  };
  gegner: { sitz: number; brett: (Kaempfer | null)[] };
  kaufbar: number[];
  katalog: { id: string; name: string; kosten: number; rolle: string; marken: string[] }[];
}

const SZENE = JSON.parse(rohszene) as Szene;
const E = SZENE.eigenes;
const KATALOG = new Map(SZENE.katalog.map((e) => [e.id, e]));
const belegt = (reihe: (Kaempfer | null)[]): Kaempfer[] => reihe.filter((k): k is Kaempfer => !!k);

describe('die Szene aus ruestkammer-erzeugen.mjs', () => {
  it('zeigt ein ausgebautes Brett — Stufe 2 und mehr, nicht lauter Stufe 1', () => {
    const stufen = belegt(E.brett).map((k) => k.stufe);
    expect(stufen.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...stufen)).toBeGreaterThanOrEqual(3);
    expect(stufen.some((s) => s === 2)).toBe(true);
  });

  it('laesst auf Brett und Bank beide Zustaende sehen: besetzt und leer', () => {
    // Sonst fehlt der Probe die leere Wabe (`.tr-wabe-ziel`) oder der leere
    // Bankplatz — und wer die Masse aendert, sieht die Haelfte nicht.
    expect(belegt(E.brett).length).toBeLessThan(E.brett.length);
    expect(belegt(E.bank).length).toBeGreaterThan(0);
    expect(belegt(E.bank).length).toBeLessThan(SZENE.bankPlaetze);
  });

  it('bringt einen vollen Laden mit einer gesperrten und einer kaufbaren Karte', () => {
    expect(E.laden.filter((id) => id !== null)).toHaveLength(SZENE.ladenPlaetze);
    expect(SZENE.kaufbar.length).toBeGreaterThan(0);
    // Eine gesperrte Karte traegt die Beschriftung („Zu wenig Gold" bzw.
    // „Bank voll") — ohne sie ist dieser Kartenzustand ungesehen.
    expect(SZENE.kaufbar.length).toBeLessThan(SZENE.ladenPlaetze);
  });

  it('haelt eine Karte bereit, deren Kauf verschmelzen wuerde', () => {
    const bestand = new Map<string, number>();
    for (const k of [...belegt(E.bank), ...belegt(E.brett)]) {
      if (k.stufe === 1) bestand.set(k.id, (bestand.get(k.id) ?? 0) + 1);
    }
    const verschmilzt = E.laden.some(
      (id) => id !== null && SZENE.verschmelzZahl - (bestand.get(id) ?? 0) === 1,
    );
    expect(verschmilzt).toBe(true);
  });

  it('stellt einen Gegner mit besetztem Brett gegenueber', () => {
    // Er steht gespiegelt ueber dem eigenen Brett — ohne ihn zeigt die Probe
    // gerade das nicht, wofuer man zwei Bretter braucht.
    expect(belegt(SZENE.gegner.brett).length).toBeGreaterThan(0);
  });

  it('bringt zu jeder Kennung ihren Katalogeintrag mit', () => {
    const gebraucht = [
      ...belegt(E.brett).map((k) => k.id),
      ...belegt(E.bank).map((k) => k.id),
      ...belegt(SZENE.gegner.brett).map((k) => k.id),
      ...E.laden.filter((id): id is string => id !== null),
    ];
    for (const id of gebraucht) expect(KATALOG.has(id)).toBe(true);
  });

  it('hat mindestens eine erreichte Markenschwelle', () => {
    expect(E.synergien.some((s) => s.schwelle !== null)).toBe(true);
  });
});

describe('ProbeRuestkammer', () => {
  it('haengt die ECHTEN Bauteile ein statt sie nachzubauen', () => {
    const { container } = render(<ProbeRuestkammer />);

    // Zwei Bretter: das eigene und das gespiegelte des Gegners. Beide mit
    // allen Waben, nicht nur den besetzten.
    const bretter = container.querySelectorAll('.tr-brett');
    expect(bretter).toHaveLength(2);
    for (const brett of bretter) {
      expect(brett.querySelectorAll('.tr-wabe')).toHaveLength(
        SZENE.brettReihen * SZENE.brettSpalten,
      );
    }

    // Die Bank — als benannte Gruppe, wie am Tisch (`Bankreihe`).
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    expect(bank.querySelectorAll('.tr-bankplatz')).toHaveLength(SZENE.bankPlaetze);

    // Der Laden mit einer echten Ladenkarte je Platz.
    const laden = screen.getByRole('group', { name: 'Laden' });
    expect(laden.querySelectorAll('.tr-karte')).toHaveLength(SZENE.ladenPlaetze);

    // Und jede Einheit der Szene mit ihrem Namen — die Marke zeichnet ihn,
    // nicht diese Probe.
    for (const k of belegt(E.brett)) {
      expect(screen.getAllByText(KATALOG.get(k.id)!.name).length).toBeGreaterThan(0);
    }
  });

  it('stellt das Brett des Gegners auf den Kopf', () => {
    const { container } = render(<ProbeRuestkammer />);
    const [fremd] = container.querySelectorAll('.tr-brett');
    /*
     * Gespiegelt heisst: Die erste gezeichnete Wabe traegt den LETZTEN Platz
     * des Moduls (`platzVon`). Geprueft wird an der Einheit, die dort steht —
     * die Drehung ist der halbe Grund, warum die Probe beide Bretter zeigt.
     */
    const letzter = SZENE.gegner.brett[SZENE.gegner.brett.length - 1];
    const ersteWabe = fremd!.querySelector('.tr-wabe')!;
    if (letzter) {
      expect(ersteWabe.querySelector('.tr-einheit-name')?.textContent).toBe(
        KATALOG.get(letzter.id)!.name,
      );
    } else {
      expect(ersteWabe.querySelector('.tr-einheit')).toBeNull();
    }
  });

  it('schlaegt beim Antippen das Blatt der Einheit auf', () => {
    // Der Anlass der ganzen Aenderung: Ein Tipp waehlte bis zum 6.9.2026 nur
    // aus und sagte nichts ueber die Einheit.
    const { container } = render(<ProbeRuestkammer />);
    const erste = belegt(E.bank)[0]!;
    const platz = E.bank.findIndex((k) => k === erste);
    fireEvent.click(
      container.querySelector<HTMLElement>(`.tr-bankplatz:nth-child(${platz + 1}) .tr-einheit`)!,
      { detail: 0 },
    );

    const blatt = screen.getByRole('dialog');
    expect(blatt).toHaveTextContent(KATALOG.get(erste.id)!.name);
    // Und die Auswahl steht NICHT schon: Erst „Aufstellen" schaltet sie ein.
    expect(container.querySelectorAll('[data-gewaehlt]')).toHaveLength(0);
  });

  it('waehlt ueber das Blatt aus und verschiebt beim Tipp auf das Ziel', () => {
    const { container } = render(<ProbeRuestkammer />);
    const erste = belegt(E.bank)[0]!;
    const platz = E.bank.findIndex((k) => k === erste);
    const marke = container.querySelector<HTMLElement>(
      `.tr-bankplatz:nth-child(${platz + 1}) .tr-einheit`,
    )!;

    fireEvent.click(marke, { detail: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Aufstellen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      container.querySelector(`.tr-bankplatz:nth-child(${platz + 1})`),
    ).toHaveAttribute('data-gewaehlt');
    // Erst mit einer Auswahl leuchten Ziele — vorher waere das ganze Brett hell.
    expect(container.querySelectorAll('[data-zielbar]').length).toBeGreaterThan(0);

    // Ein anderer Bankplatz ist immer ein erlaubtes Ziel (Tausch bzw. Umzug),
    // auch wenn das Feld voll ist — siehe `darfSchieben`.
    const frei = E.bank.findIndex((k) => k === null);
    const ziel = container.querySelector<HTMLElement>(
      `.tr-bankplatz:nth-child(${frei + 1}) .tr-bankplatz-ziel`,
    )!;
    fireEvent.click(ziel);
    expect(
      container.querySelector(`.tr-bankplatz:nth-child(${frei + 1}) .tr-einheit-name`)
        ?.textContent,
    ).toBe(KATALOG.get(erste.id)!.name);
    expect(container.querySelectorAll('[data-gewaehlt]')).toHaveLength(0);
  });

  it('stellt mit "zuruecksetzen" den Stand der Szene wieder her', () => {
    const { container } = render(<ProbeRuestkammer />);
    const platz = E.bank.findIndex((k) => k !== null);
    const frei = E.bank.findIndex((k) => k === null);
    fireEvent.click(
      container.querySelector<HTMLElement>(`.tr-bankplatz:nth-child(${platz + 1}) .tr-einheit`)!,
      { detail: 0 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aufstellen' }));
    fireEvent.click(
      container.querySelector<HTMLElement>(
        `.tr-bankplatz:nth-child(${frei + 1}) .tr-bankplatz-ziel`,
      )!,
    );
    expect(
      container.querySelector(`.tr-bankplatz:nth-child(${platz + 1}) .tr-einheit`),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'zurücksetzen' }));
    expect(
      container.querySelector(`.tr-bankplatz:nth-child(${platz + 1}) .tr-einheit-name`)
        ?.textContent,
    ).toBe(KATALOG.get(E.bank[platz]!.id)!.name);
  });

  it('raeumt beim Klick auf eine Karte den Ladenplatz ab — und legt ihn zurueck', () => {
    const { container } = render(<ProbeRuestkammer />);
    const platz = SZENE.kaufbar[0]!;
    const laden = screen.getByRole('group', { name: 'Laden' });
    const karte = laden.querySelectorAll('.tr-karte')[platz]!;
    expect(karte.classList.contains('tr-karte-leer')).toBe(false);

    fireEvent.click(karte);
    // Der leere Rahmen ist der einzige Kartenzustand, den man sonst nie sieht.
    expect(
      laden.querySelectorAll('.tr-karte')[platz]!.classList.contains('tr-karte-leer'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'zurücksetzen' }));
    expect(
      laden.querySelectorAll('.tr-karte')[platz]!.classList.contains('tr-karte-leer'),
    ).toBe(false);
    expect(container.querySelectorAll('.tr-karte')).toHaveLength(SZENE.ladenPlaetze);
  });

  it('sperrt mit "am Zug" aus alles, was man anfassen kann', () => {
    const { container } = render(<ProbeRuestkammer />);
    expect(container.querySelectorAll('[data-fassbar]').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('checkbox', { name: /am Zug/ }));
    expect(container.querySelectorAll('[data-fassbar]')).toHaveLength(0);
    for (const knopf of container.querySelectorAll<HTMLButtonElement>('.tr-wabe-ziel')) {
      expect(knopf.disabled).toBe(true);
    }
    for (const karte of container.querySelectorAll<HTMLButtonElement>('.tr-karte')) {
      expect(karte.disabled).toBe(true);
    }
  });

  it('nennt Saat, Runde und den Haltepunkt unter dem Bildschirm', () => {
    render(<ProbeRuestkammer />);
    const fuss = screen.getByText(/Saat/);
    expect(fuss).toHaveTextContent(SZENE.saat);
    expect(fuss).toHaveTextContent(`Runde ${SZENE.runde}`);
    expect(fuss).toHaveTextContent(`Sitz ${SZENE.ich + 1}`);
  });
});
