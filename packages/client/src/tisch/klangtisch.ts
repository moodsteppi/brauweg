import { useEffect, useRef } from 'react';

import { spiele, vibriere } from '../klang';

/**
 * Was am Spieltisch klingt — einmal für beide Spiele.
 *
 * Doppelkopf und Zauberer sehen verschieden aus, aber sie tun dasselbe: Es
 * wird gegeben, Karten fallen, ein Stich wird eingezogen, am Ende steht eine
 * Abrechnung. Deshalb nimmt dieser Haken keine Spielsicht entgegen, sondern
 * nur die paar Zahlen und Wahrheitswerte, die beide Tische ohnehin schon
 * ausgerechnet haben. So kann er nichts über ein Spiel wissen — und muss es
 * auch nicht, wenn ein drittes dazukommt.
 *
 * Der Haken klingt nur bei **Änderungen**, nie beim ersten Blick. Wer mitten
 * in einer laufenden Runde beitritt, bekommt sonst auf einen Schlag Geben,
 * Karte und Stich zu hören, obwohl gerade gar nichts passiert ist. Deshalb
 * steht jeder Merker anfangs auf `undefined` und wird beim ersten Durchlauf
 * nur gefüllt.
 */
export function useTischklang(zustand: {
  /** Karten im laufenden Stich. */
  stichKarten: number;
  /** Schlüssel des zuletzt abgeschlossenen Stichs, oder null. */
  letzterStich: string | null;
  /** Bin ich am Zug? */
  binDran: boolean;
  /** Läuft gerade die Austeilzeremonie? */
  gibtGerade: boolean;
  /** Schlüssel der fertigen Rundenabrechnung, oder null. */
  abschluss: string | null;
  /** Ist die ganze Partie vorbei? */
  partieFertig: boolean;
  /** Bei fertiger Partie: habe ich gewonnen? */
  gewonnen: boolean | null;
  /** Eine abgelehnte Aktion, roh vom Server. */
  fehler: string | null;
}): void {
  const {
    stichKarten,
    letzterStich,
    binDran,
    gibtGerade,
    abschluss,
    partieFertig,
    gewonnen,
    fehler,
  } = zustand;

  // Eine Karte fällt. Nur beim Wachsen: Der Wechsel auf 0 ist das Abräumen
  // des vollen Stichs, und das hat seinen eigenen Klang.
  const vorigeKarten = useRef<number | undefined>(undefined);
  useEffect(() => {
    const vorher = vorigeKarten.current;
    vorigeKarten.current = stichKarten;
    if (vorher === undefined) return;
    if (stichKarten > vorher) spiele('karte-legen');
  }, [stichKarten]);

  // Stich eingezogen.
  const vorigerStich = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const vorher = vorigerStich.current;
    vorigerStich.current = letzterStich;
    if (vorher === undefined) return;
    if (letzterStich && letzterStich !== vorher) spiele('stich-ein');
  }, [letzterStich]);

  /**
   * Man ist am Zug.
   *
   * Der einzige Klang mit einem Stups dazu: Wer nebenbei etwas anderes macht,
   * merkt sonst nicht, dass drei Leute auf ihn warten. Genau dafür ist
   * Vibration da, und für sonst fast nichts.
   */
  const warDran = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const vorher = warDran.current;
    warDran.current = binDran;
    if (vorher === undefined) return;
    if (binDran && !vorher) {
      spiele('dran');
      vibriere(14);
    }
  }, [binDran]);

  // Geben.
  const gabVorher = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const vorher = gabVorher.current;
    gabVorher.current = gibtGerade;
    if (vorher === undefined) return;
    if (gibtGerade && !vorher) spiele('mischen');
  }, [gibtGerade]);

  // Rundenabrechnung erscheint.
  const vorigerAbschluss = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const vorher = vorigerAbschluss.current;
    vorigerAbschluss.current = abschluss;
    if (vorher === undefined) return;
    if (abschluss && abschluss !== vorher) spiele('runde-ende');
  }, [abschluss]);

  // Partieende. `gewonnen` steht erst fest, wenn `partieFertig` gilt —
  // deshalb hängt der Effekt an beidem.
  const warFertig = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const vorher = warFertig.current;
    warFertig.current = partieFertig;
    if (vorher === undefined) return;
    if (partieFertig && !vorher) spiele(gewonnen === false ? 'niederlage' : 'sieg');
  }, [partieFertig, gewonnen]);

  // Abgelehnte Aktion. Klang und Stups, weil die Meldung schnell wieder weg
  // ist und man sie am Handy leicht übersieht.
  const vorigerFehler = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const vorher = vorigerFehler.current;
    vorigerFehler.current = fehler;
    if (vorher === undefined) return;
    if (fehler && fehler !== vorher) {
      spiele('fehler');
      vibriere([18, 40, 18]);
    }
  }, [fehler]);
}
