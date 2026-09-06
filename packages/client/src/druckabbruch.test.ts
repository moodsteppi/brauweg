import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SPIELRAUM_PX, ausserhalb, installiereDruckabbruch } from './druckabbruch';

describe('ausserhalb', () => {
  const rand = { left: 100, top: 100, right: 200, bottom: 150 };

  it('ist innerhalb des Knopfes und im Spielraum falsch', () => {
    expect(ausserhalb(rand, 150, 125)).toBe(false);
    expect(ausserhalb(rand, 100 - SPIELRAUM_PX, 125)).toBe(false);
    expect(ausserhalb(rand, 150, 150 + SPIELRAUM_PX)).toBe(false);
  });

  it('ist jenseits des Spielraums wahr, in jede Richtung', () => {
    expect(ausserhalb(rand, 100 - SPIELRAUM_PX - 1, 125)).toBe(true);
    expect(ausserhalb(rand, 200 + SPIELRAUM_PX + 1, 125)).toBe(true);
    expect(ausserhalb(rand, 150, 100 - SPIELRAUM_PX - 1)).toBe(true);
    expect(ausserhalb(rand, 150, 150 + SPIELRAUM_PX + 1)).toBe(true);
  });
});

/*
 * Der Aufbau ahmt React nach: Der Klick-Horcher haengt am Wurzelelement,
 * nicht am Knopf — genau dort lauscht React, und genau davor muss der
 * Waechter den Klick anhalten. jsdom liefert fuer getBoundingClientRect
 * lauter Nullen, der Knopf "liegt" also bei (0, 0); weit weg ist alles
 * jenseits des Spielraums.
 */
describe('installiereDruckabbruch', () => {
  let wurzel: HTMLDivElement;
  let knopf: HTMLButtonElement;
  let klicks: number;
  let abhaengen: () => void;

  const zeiger = (typ: string, ziel: Element, x: number, y: number, pointerId = 1): void => {
    const ev = new MouseEvent(typ, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(ev, 'pointerId', { value: pointerId });
    ziel.dispatchEvent(ev);
  };
  const klick = (ziel: Element): void => {
    ziel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    wurzel = document.createElement('div');
    knopf = document.createElement('button');
    knopf.textContent = 'Spielen';
    wurzel.appendChild(knopf);
    document.body.appendChild(wurzel);
    klicks = 0;
    wurzel.addEventListener('click', () => {
      klicks++;
    });
    abhaengen = installiereDruckabbruch(document);
  });

  afterEach(() => {
    abhaengen();
    wurzel.remove();
    vi.useRealTimers();
  });

  it('laesst einen gewoehnlichen Tipp durch', () => {
    zeiger('pointerdown', knopf, 0, 0);
    zeiger('pointerup', knopf, 4, 3);
    klick(knopf);
    expect(klicks).toBe(1);
  });

  it('schluckt den Klick, wenn der Finger weit weg losgelassen wurde', () => {
    zeiger('pointerdown', knopf, 0, 0);
    zeiger('pointerup', knopf, SPIELRAUM_PX + 40, 0);
    klick(knopf);
    expect(klicks).toBe(0);
  });

  it('laesst durch, wer weit weg war und zurueckgekommen ist', () => {
    zeiger('pointerdown', knopf, 0, 0);
    zeiger('pointermove', knopf, 300, 300);
    zeiger('pointerup', knopf, 2, 2);
    klick(knopf);
    expect(klicks).toBe(1);
  });

  it('laesst einen Tastaturklick durch, auch direkt nach einem Abbruch', () => {
    // Maus: weit weg losgelassen, der Browser schickt gar keinen Klick.
    zeiger('pointerdown', knopf, 0, 0);
    zeiger('pointerup', document.body, 500, 500);
    // Spaeter Enter auf demselben Knopf: kein pointerdown, nur click.
    vi.advanceTimersByTime(1000);
    klick(knopf);
    expect(klicks).toBe(1);
  });

  it('haelt einen anderen Zeiger auseinander', () => {
    zeiger('pointerdown', knopf, 0, 0, 1);
    // Ein zweiter Finger irgendwo weit weg geht hoch — nicht der auf dem Knopf.
    zeiger('pointerup', document.body, 500, 500, 2);
    zeiger('pointerup', knopf, 1, 1, 1);
    klick(knopf);
    expect(klicks).toBe(1);
  });

  it('nimmt einen ausgenommenen Bereich aus', () => {
    wurzel.setAttribute('data-druckabbruch', 'aus');
    zeiger('pointerdown', knopf, 0, 0);
    zeiger('pointerup', knopf, 500, 500);
    klick(knopf);
    expect(klicks).toBe(1);
  });

  it('vergisst den Druck nach einem pointercancel', () => {
    zeiger('pointerdown', knopf, 0, 0);
    document.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    zeiger('pointerup', knopf, 500, 500);
    klick(knopf);
    expect(klicks).toBe(1);
  });
});
