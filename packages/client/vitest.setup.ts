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
 * Ab Node 25 bringt die Laufzeit ein EIGENES `localStorage` mit, und dessen
 * Eigenschaft auf `globalThis` verdeckt die von jsdom — auch `window.
 * localStorage` zeigt danach darauf. Ohne `--localstorage-file <pfad>` gibt
 * Nodes Fassung schlicht `undefined` heraus (dazu die Warnung „localStorage is
 * not available because --localstorage-file was not provided"), und jeder
 * Zugriff stirbt mit „localStorage.clear is not a function" bzw. „Cannot read
 * properties of undefined". Auf Node 24 faellt der Zweig hier durch, weil
 * jsdoms Speicher schon alles kann.
 *
 * Ein Datei-Speicher waere hier falsch: Tests sollen zwischen Laeufen nichts
 * behalten. Deshalb ein Speicher im Arbeitsspeicher, je Testdatei einer —
 * vitest baut die Umgebung pro Datei neu auf.
 */
if (typeof (globalThis as { localStorage?: Storage }).localStorage?.clear !== 'function') {
  const speicherBauen = (): Storage => {
    const inhalt = new Map<string, string>();
    return {
      get length() {
        return inhalt.size;
      },
      key: (i: number) => [...inhalt.keys()][i] ?? null,
      getItem: (k: string) => inhalt.get(String(k)) ?? null,
      setItem: (k: string, v: string) => void inhalt.set(String(k), String(v)),
      removeItem: (k: string) => void inhalt.delete(String(k)),
      clear: () => inhalt.clear(),
    } as Storage;
  };
  // `defineProperty`, nicht Zuweisung: Nodes Eigenschaft hat einen Getter, der
  // die schlichte Zuweisung ins Leere laufen liesse.
  for (const schluessel of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, schluessel, {
      value: speicherBauen(),
      configurable: true,
      writable: true,
    });
  }
}
