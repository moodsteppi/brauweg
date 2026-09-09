import type { Posten } from './vorladen';

/**
 * Das Spielpaket von Tafelrunde als Posten des Vorladens.
 *
 * Der Anlass ist Robins Satz vom 5.9.2026: „Wenn man Tafelrunde anklickt, muss
 * im Ladescreen alles Wichtige runtergeladen werden." Seit die Schirme einzeln
 * nachkommen (Teil 1, #61) wartete man beim Antippen ZWEIMAL: erst auf das
 * Paket hinter `lazy()`, dann auf die Bilder. Zwei Wartezeiten hintereinander
 * fuehlen sich laenger an als eine, auch wenn sie zusammen kuerzer sind.
 *
 * Deshalb steht das Paket hier als ganz gewoehnlicher Posten neben den
 * Bildern: EIN Lauf, EIN Balken, eine Wartezeit. Der Bildschirm muss davon
 * nichts wissen.
 *
 * Zwei Dinge, die man dem Code sonst nicht ansieht:
 *
 *  1. **Geholt wird mit demselben `import()`, den auch `lazy()` in App.tsx
 *     benutzt.** Ein Modul wird je Adresse genau einmal geholt — die beiden
 *     Aufrufe teilen sich also die Anfrage, egal welcher zuerst kommt. Ein
 *     eigener `fetch` auf die Paketdatei waere ein zweiter Download, denn
 *     deren Namen kennt nur der Bauvorgang.
 *  2. **Ein Posten, obwohl es fuenf Dateien sind.** Was beim Antippen
 *     tatsaechlich ueber die Leitung geht, sind Tafelrunde.js, seine CSS,
 *     KampfAnzeige (js und CSS) und useTable.js — alle mit einer Pruefsumme im
 *     Namen, die erst beim Bauen entsteht. Von hier aus ist das eine
 *     Wartezeit mit einem Ende, und genau so zaehlt der BALKEN sie. Die ZAHL
 *     daneben zaehlt Dateien und bekommt deshalb `stueck: 5` (siehe
 *     `PAKET_STUECK`) — bis zum 6.9.2026 sagte sie „29 Dateien", waehrend 33
 *     unterwegs waren.
 */

/**
 * Das Gewicht des Pakets ueber die Leitung, in Kilobyte.
 *
 * **Das ist eine SCHAETZUNG und keine gemessene Laufzeitgroesse.** Zur
 * Laufzeit ist die Zahl nicht zu haben: Der Browser kennt die Groesse erst,
 * wenn die Datei da ist — dann braucht sie niemand mehr. Bekannt ist sie nur
 * dem Bauvorgang, und ihn dafuer zu verdrahten hiesse, den Wert in das schon
 * erzeugte Hauptpaket zurueckzuschreiben. Die Datei nebenan haelt es bei den
 * Bildern seit jeher genauso (siehe `Posten.kb` in vorladen.ts): Ein Wert in
 * der richtigen Groessenordnung genuegt, damit der Balken nicht luegt.
 *
 * Gemessen am 6.9.2026 aus `npm run build --workspace @brauweg/client`, und
 * zwar gzip — so viel geht wirklich ueber die Leitung. Die Bilder daneben
 * stehen mit ihrer Dateigroesse drin, was dasselbe Mass ist: WebP komprimiert
 * sich kein zweites Mal.
 *
 * Es sind die fuenf Dateien, die Vite beim `import()` gemeinsam anfordert
 * (nachgesehen in der Vorladeliste des Hauptpakets, `__vite__mapDeps`):
 *
 *   Tafelrunde.js    14,13 kB
 *   Tafelrunde.css    2,62 kB
 *   KampfAnzeige.js   3,49 kB
 *   KampfAnzeige.css  3,17 kB
 *   useTable.js       3,54 kB
 *   -------------------------
 *                    26,95 kB   -> 27
 *
 * Zum Vergleich: Die 23 Bilder wiegen zusammen 46 kB, in der Liste mit 57
 * angesetzt. Das Paket ist damit knapp ein Drittel des Laufs — genug, dass
 * sein Fehlen im Balken auffiele, und wenig genug, dass ein Griff daneben ihn
 * nicht umwirft.
 *
 * WANN NACHZUTRAGEN: Wenn der Bau die Zahl um mehr als etwa die Haelfte
 * verfehlt, steht der Balken sichtbar schief. Neu messen mit dem Bau oben;
 * `vorladen.test.ts` haelt nur die Groessenordnung fest, nicht den Wert — ein
 * Test kann hier nichts Genaueres wissen, denn er baut nicht.
 */
export const PAKET_KB = 27;

/** Die Kennung des Postens. Kein Pfad — es gibt keinen, siehe oben. */
export const PAKET_KENNUNG = 'paket:tafelrunde';

/**
 * Wie viele Dateien das Paket ist — die Zahl neben dem Balken zaehlt Dateien
 * und nicht Posten (`Posten.stueck` in vorladen.ts).
 *
 * Es sind dieselben fuenf, die oben unter `PAKET_KB` einzeln aufgelistet
 * stehen: Tafelrunde.js/css, KampfAnzeige.js/css, useTable.js. Aufzaehlen
 * lassen sie sich hier nicht — ihre Namen tragen eine Pruefsumme, die erst der
 * Bauvorgang kennt —, gezaehlt werden schon.
 *
 * WANN NACHZUTRAGEN: zusammen mit `PAKET_KB`. Wer den Schirm aufteilt oder
 * etwas hineinzieht, aendert beides; die Liste im `__vite__mapDeps` des
 * Hauptpakets sagt, wie viele es geworden sind. Ein Griff daneben kostet hier
 * nichts als eine schiefe Zahl — der Balken haengt an `kb`, nicht hieran.
 */
export const PAKET_STUECK = 5;

export const PAKET: Posten = {
  pfad: PAKET_KENNUNG,
  kb: PAKET_KB,
  stueck: PAKET_STUECK,
  /*
   * `.then(() => undefined)` und nicht das Modul durchreichen: Der Lauf will
   * nur wissen, DASS es da ist. Gaebe er das Modul weiter, haenge an ihm eine
   * zweite Stelle, an der jemand den Schirm bekommt — und damit die
   * Versuchung, ihn hier statt in App.tsx einzusetzen.
   */
  holen: () => import('../../screens/Tafelrunde').then(() => undefined),
};
