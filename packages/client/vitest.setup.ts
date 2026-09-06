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
