/*
 * Werkzeug für die Verträge zwischen Client und Spielmodulen.
 *
 * Warum es das gibt: `packages/client` importiert nichts aus den
 * Spielpaketen. Jede Sicht steht in `protocol.ts` ein zweites Mal
 * beschrieben — `RoundView` neben `PlayerView` des Doppelkopfs,
 * `WizardRoundView` neben der Sicht des Zauberers, und so weiter. Benennt ein
 * Modul ein Feld um oder lässt es weg, fällt das beim Bauen NICHT auf: Der
 * Client übersetzt weiter gegen seine eigene Beschreibung. Auffallen tut es
 * im Betrieb, als leere Anzeige an einem Tisch.
 *
 * Ein Vertrag schließt diese Lücke von zwei Seiten:
 *
 *   1. Beim Übersetzen (`tsc`, also `npm run build`): Die echte Modulsicht
 *      muss auf den Client-Typ passen. Fehlt ein Feld oder hat es einen
 *      anderen Typ, bricht der Bau.
 *   2. Beim Prüfen (`vitest`): Eine echte, mit Bots gespielte Partie muss
 *      jedes Feld auch WIRKLICH liefern. Das fängt den Fall, den die
 *      Übersetzung nicht sieht — ein Feld, das der Client als optional führt
 *      und das kein Modul mehr schickt.
 *
 * Die Module dürfen mehr liefern, als der Client kennt; das ist der normale
 * Weg, auf dem ein Modul vorangeht. Weniger dürfen sie nicht.
 */

// ---------------------------------------------------------------------------
// Typseite
// ---------------------------------------------------------------------------

/**
 * Dieselbe Form ohne `readonly`, in jeder Tiefe.
 *
 * Die Module beschreiben ihre Sichten unveränderlich, der Client nicht — und
 * ein `readonly Card[]` ist einem `Card[]` nicht zuweisbar. Das ist aber kein
 * Vertragsbruch, sondern eine Frage der Schreibrechte: Über die Leitung geht
 * JSON, und was am anderen Ende ankommt, ist ohnehin eine frische Kopie.
 * Ohne diese Umschrift bestünde der ganze Vertrag aus `readonly`-Meldungen
 * und niemand sähe die echten Abweichungen darin.
 *
 * Tupel behalten ihre Stellenzahl. Das ist keine Feinheit: Fillers Barrieren
 * sind `readonly (readonly [number, number])[]`, und ein pauschal zu
 * `number[][]` verflachtes Tupel passt auf keinen Client-Typ, der `[number,
 * number]` schreibt. Der Vertrag wäre dann rot, obwohl Modul und Client
 * dasselbe meinen — und die einzige Abhilfe wäre, den Client-Typ zu
 * verwässern.
 */
export type Beweglich<T> = T extends readonly (infer E)[]
  ? number extends T['length']
    ? Beweglich<E>[]
    : { -readonly [K in keyof T]: Beweglich<T[K]> }
  : T extends object
    ? { -readonly [K in keyof T]: Beweglich<T[K]> }
    : T;

/**
 * Bricht die Übersetzung, sobald `Felder` nicht leer ist.
 *
 * Gedacht für `Leer<Exclude<keyof ClientSicht, keyof Modulsicht>>`: Die
 * Fehlermeldung nennt dann genau das Feld, das der Client kennt und das Modul
 * nicht mehr — „Type 'trickCounts' does not satisfy the constraint 'never'".
 *
 * Nötig neben der reinen Zuweisung, weil ein OPTIONALES Feld des Clients
 * lautlos durchgeht: Ein `trickCounts?: …`, das kein Modul mehr schickt, ist
 * zuweisbar und trotzdem tot.
 */
export type Leer<Felder extends never> = Felder;

/**
 * Bricht die Übersetzung, wenn die Modulsicht nicht auf die Clientsicht passt.
 *
 * Die Richtung ist Absicht: Das Modul muss alles liefern, was der Client
 * beschreibt. Was es darüber hinaus liefert, geht den Client nichts an — so
 * kann ein Modul ein Feld ergänzen, ohne den Client mitzuziehen.
 */
export type PasstAuf<Clientsicht, Modulsicht extends Clientsicht> = Modulsicht;

// ---------------------------------------------------------------------------
// Laufzeitseite
// ---------------------------------------------------------------------------

/**
 * So viel von `GameModule`, wie ein Vertrag braucht.
 *
 * Bewusst hier nachgezeichnet statt aus `@brauweg/game-api` importiert: Der
 * Client kennt die Schnittstelle der Plattform nicht und soll sie auch nicht
 * kennenlernen. Er braucht nur einen Weg, eine echte Partie anzuwerfen.
 */
export interface Spielmodul {
  defaultConfig(): unknown;
  createParty(options: {
    config: unknown;
    seats: number;
    rounds: number;
    seed: number;
    botSeats?: readonly number[];
  }): unknown;
  act(party: unknown, seat: number, action: unknown): unknown;
  currentActor(party: unknown): number | null;
  botAction(view: unknown): unknown;
  viewFor(party: unknown, seat: number): unknown;
  isFinished(party: unknown): boolean;
}

/** Was eine gespielte Partie an Feldern hergegeben hat. */
export interface GeseheneFelder {
  /** Felder der Partiesicht (`roundIndex`, `scores`, …). */
  oben: Set<string>;
  /** Felder der Rundensicht. Leer, wenn `round` nie gefüllt war. */
  runde: Set<string>;
  /**
   * Felder der angeforderten Unterobjekte, je Feldname (siehe die Option
   * `unterobjekte`). Ein nicht angefordertes Feld steht nicht drin.
   */
  unter: Record<string, Set<string>>;
  /** Wie viele Aktionen die Bots ausgeführt haben. */
  schritte: number;
}

/**
 * Eine Partie mit Bots durchspielen und dabei sammeln, welche Felder in den
 * Sichten vorkommen — über ALLE Sitze und jeden Zwischenstand.
 *
 * Über alle Sitze, weil ein Zuschauer und ein Mitspieler verschiedene Felder
 * gefüllt bekommen; über jeden Zwischenstand, weil manches nur in einer
 * einzigen Phase auftaucht (die Solo-Vorschau etwa nur in der
 * Vorbehaltsabfrage).
 *
 * Endet die Partie nicht, ist das kein Fehler: `currentActor` gibt null
 * zurück, sobald die Plattform eine Schaupause einlegen müsste (Abrechnung,
 * gleichzeitige Abfragen). Diese Uhr hat ein Spielmodul nicht — und der
 * Vertrag braucht sie auch nicht, er braucht nur genug Sichten.
 */
export function felderEinerPartie(
  modul: Spielmodul,
  {
    sitze,
    runden,
    seed = 4711,
    config,
    unterobjekte = [],
  }: {
    sitze: number;
    runden: number;
    seed?: number;
    config?: unknown;
    /**
     * Felder, in die zusätzlich hineingesehen wird — ein Objekt oder eine
     * Liste von Objekten. Die Kartenspiele brauchen das nicht, ihre einzige
     * zweite Ebene ist `round`. Bei Tafelrunde hängt aber die halbe
     * Rüstkammer an `eigenes` und die Mitspielerleiste an `gegner`; ohne
     * diesen Durchgriff bliebe ungeprüft, was der Bildschirm am meisten
     * liest.
     */
    unterobjekte?: readonly string[];
  },
): GeseheneFelder {
  const oben = new Set<string>();
  const runde = new Set<string>();
  const unter: Record<string, Set<string>> = {};
  for (const name of unterobjekte) unter[name] = new Set<string>();
  let party = modul.createParty({
    /*
     * `config` ueberschreibt den Vorgabe-Regelsatz. Gebraucht wird das nur
     * dort, wo ein Feld der Sicht an einer SPIELART haengt: Filler liefert
     * `barrierenMoeglich` ausschliesslich in der Spielart `build`. Ohne diesen
     * Weg muesste der Vertrag das Feld ungeprueft lassen — und genau die
     * ungeprueften Felder sind der Grund, aus dem es diese Dateien gibt.
     */
    config: config ?? modul.defaultConfig(),
    seats: sitze,
    rounds: runden,
    seed,
    botSeats: Array.from({ length: sitze }, (_, i) => i),
  });

  const sammle = (): void => {
    for (let seat = 0; seat < sitze; seat++) {
      const sicht = modul.viewFor(party, seat) as Record<string, unknown>;
      for (const feld of Object.keys(sicht)) oben.add(feld);
      const r = sicht.round as Record<string, unknown> | null | undefined;
      if (r) for (const feld of Object.keys(r)) runde.add(feld);
      for (const name of unterobjekte) {
        const wert = sicht[name];
        // Liste oder Einzelobjekt, beides kommt vor: `gegner` ist eine Liste,
        // `eigenes` ist eines oder null (bei einem Zuschauer).
        for (const stueck of Array.isArray(wert) ? wert : [wert]) {
          if (stueck === null || typeof stueck !== 'object') continue;
          for (const feld of Object.keys(stueck)) unter[name]?.add(feld);
        }
      }
    }
  };

  sammle();
  let schritte = 0;
  // Harte Obergrenze: Ein Vertrag darf nie der Grund sein, warum eine
  // Prüfstrecke hängt. Erreicht wird sie nicht — die längste Partie hier
  // braucht knapp sechzig Züge.
  while (!modul.isFinished(party) && schritte < 2000) {
    const seat = modul.currentActor(party);
    if (seat === null) break;
    const aktion = modul.botAction(modul.viewFor(party, seat));
    if (!aktion) break;
    party = modul.act(party, seat, aktion);
    schritte++;
    sammle();
  }

  return { oben, runde, unter, schritte };
}

/**
 * Welche der erwarteten Felder in keiner einzigen Sicht vorkamen.
 *
 * Getrennt von der Zusicherung selbst, damit die Fehlermeldung eines
 * Vertragstests die Namen nennt und nicht nur „false ist nicht true".
 */
export function fehlendeFelder(erwartet: readonly string[], gesehen: Set<string>): string[] {
  return erwartet.filter((feld) => !gesehen.has(feld));
}
