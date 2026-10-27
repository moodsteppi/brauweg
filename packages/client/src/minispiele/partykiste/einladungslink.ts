/**
 * Der Einladungslink `/beitritt/<CODE>` — getrennt von den Bildschirmen, weil
 * App.tsx ihn beim Start braucht.
 *
 * Seit dem 22.09.2026 (Robins Entscheidung: Einladungslink, Teilen und QR am
 * Partykiste-Tisch). Dieselbe Trennung wie `tafelrunde/tischlink.ts`: App.tsx
 * liest die Adresse vor dem ersten Bild, und stuende das hier in
 * `Einladung.tsx` oder `screens/Partykiste.tsx`, zoege eine Zeichenkette den
 * ganzen Schirm ins Hauptpaket. Deshalb hier nichts, was React oder den
 * QR-Kodierer braucht.
 *
 * Ein Pfad statt `/?tisch=` wie bei Tafelrunde: Der Link steht als QR-Code auf
 * dem Tisch und wird am Handy vorgelesen — „brauweg.de/beitritt/K7X9MQ" sagt,
 * was er tut, und ist kuerzer (kleinere QR-Version, groebere Felder, die sich
 * im Halbdunkel besser scannen). Der Server liefert fuer jeden Pfad ohne
 * Dateiendung die index.html aus (`setNotFoundHandler` in app.ts), und alle
 * Verweise in index.html sind absolut — der Pfad braucht dort nichts Neues.
 */

import { apiBase, inApp } from '../../laufzeit';

/** Wo der Code zwischen Anmeldung und Beitritt liegt. */
const SCHLUESSEL = 'brauweg.einladung';

const PFAD = /^\/beitritt\/([A-Za-z0-9-]{4,24})\/?$/;

/**
 * Wie der Server normalisiert (`codeNormalisieren` in tables/service.ts):
 * Grossbuchstaben, nur Buchstaben und Ziffern. Ein Bindestrich, den jemand
 * beim Abtippen setzt, kostet so keinen Beitritt.
 */
export function codeNormalisieren(eingabe: string): string {
  return eingabe.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Der Link, den der Gastgeber weitergibt. */
export function einladungsLink(code: string): string {
  /*
   * In der iOS-Huelle ist `location.origin` `brauweg://app` — ein Link, den
   * kein anderes Handy oeffnen kann. Dort steht der Server unter `apiBase`,
   * und der liefert auch den Web-Client aus.
   */
  const basis = inApp && apiBase ? apiBase : window.location.origin;
  return `${basis}/beitritt/${codeNormalisieren(code)}`;
}

/**
 * Der vorgemerkte Code: aus der Adresse, sonst aus dem Tab-Speicher.
 *
 * Aus der Adresse wird er sofort in den Speicher gelegt und die Adresse auf
 * `/` zurueckgesetzt. Zwei Gruende: Wer noch nicht angemeldet ist, meldet
 * sich erst an (oder spielt als Gast) — laedt er dabei die Seite neu, soll
 * der Code nicht verloren sein. Und wer nach der Partie neu laedt, soll nicht
 * ein zweites Mal an einen Tisch gesetzt werden, der laengst vorbei ist.
 *
 * `sessionStorage` und nicht `localStorage`: Die Einladung gilt fuer diesen
 * Tab und diesen Abend. Ein Code, der morgen noch im Browser liegt, setzte
 * einen bei der naechsten Anmeldung an einen fremden Tisch.
 */
export function vorgemerkterCode(): string | null {
  const treffer = PFAD.exec(window.location.pathname);
  if (treffer) {
    const code = codeNormalisieren(treffer[1]!);
    try {
      sessionStorage.setItem(SCHLUESSEL, code);
    } catch {
      /* Gesperrte Seitendaten: Dann gilt der Code nur bis zum Neuladen. */
    }
    window.history.replaceState(null, '', `/${window.location.search}${window.location.hash}`);
    return code || null;
  }
  try {
    return sessionStorage.getItem(SCHLUESSEL);
  } catch {
    return null;
  }
}

/** Den vorgemerkten Code verbrauchen — nach dem Beitritt oder seinem Scheitern. */
export function vormerkungLoeschen(): void {
  try {
    sessionStorage.removeItem(SCHLUESSEL);
  } catch {
    /* Nichts zu loeschen. */
  }
}

/**
 * Warum der Beitritt per Link scheiterte — fuer die Code-Eingabe danach.
 *
 * Im Arbeitsspeicher, nicht im Tab-Speicher: Die Nachricht gilt genau fuer den
 * Schirm, der gleich aufgeht, und nicht fuer den naechsten Besuch.
 */
let fehlschlag: { code: string; messageKey: string } | null = null;

export function fehlschlagMerken(code: string, messageKey: string): void {
  fehlschlag = { code, messageKey };
}

/**
 * Lesen und Vergessen getrennt, nicht als ein „abholen": Unter `StrictMode`
 * (main.tsx) ruft React einen `useState`-Initialisierer zweimal auf, und ein
 * verbrauchendes Lesen lieferte dann beim zweiten Mal nichts mehr — die
 * Eingabe stuende im Entwicklungsbetrieb leer da, im Betrieb nicht.
 * Gelesen wird im Initialisierer, vergessen im Effekt.
 */
export function fehlschlagLesen(): { code: string; messageKey: string } | null {
  return fehlschlag;
}

export function fehlschlagVergessen(): void {
  fehlschlag = null;
}
