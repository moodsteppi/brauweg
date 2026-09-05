import '@testing-library/jest-dom/vitest';

/*
 * jsdom kennt keinen ResizeObserver. Der Trophaeenpfad legt beim Aufbau einen
 * an (Pfad.tsx, Zeile 132), um die Kamera nachzurichten — ohne Ersatz stirbt
 * jeder Test, der den Startbildschirm rendert, an einer Stelle, die mit dem
 * Geprueften nichts zu tun hat.
 *
 * Der Ersatz misst nichts, er schweigt nur: In jsdom hat jedes Element die
 * Groesse null, ein echter Beobachter haette also ohnehin nichts zu melden.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

/*
 * Dieselbe Sorte Luecke: jsdom hat `play()` zwar, gibt aber `undefined`
 * zurueck statt eines Versprechens ("Not implemented: HTMLMediaElement's
 * play() method"). `klang.ts` haengt korrekterweise ein `.catch` daran — ein
 * fehlendes Musikstueck soll den Client nicht anhalten — und stirbt in jsdom
 * genau dort. Betroffen ist jeder Test, der `<App/>` aufbaut: Die Musik geht
 * an, sobald jemand angemeldet ist.
 *
 * Der Ersatz spielt nichts, er verspricht nur.
 */
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = function spieleNicht(): Promise<void> {
    return Promise.resolve();
  };
}
