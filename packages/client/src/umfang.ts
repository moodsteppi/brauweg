/**
 * Was diese Ausgabe anbietet — der Umfang aus dem Server (`UMFANG`,
 * packages/server/src/umfang.ts), mitgeliefert in `/api/me`.
 *
 * Der Client entscheidet hier nichts: Er merkt sich die Liste und blendet
 * die Einstiege aus, die nicht darin stehen. Gesperrt ist ein Teil trotzdem
 * im Server; ohne diese Stelle stuende nur ein Knopf da, der „gibt es hier
 * nicht" meldet.
 *
 * Die Spiele der Registry brauchen das nicht — die liefert der Server
 * gleich gefiltert (`/api/games`). Gefragt wird hier nach den Funktionen
 * daneben: kartenmanufaktur, browort, clanwort, lernpfad, prosubway,
 * clankrieg, clanchat, shop, abstimmung, profilbild, figur, geburtstag —
 * und nach zwei Spielen, deren Einstieg nicht aus `/api/games` kommt:
 * `doppelkopf` (die Übungsrunde im Lernpfad) und `brocooked` (läuft allein
 * ohne Tisch, also ohne Route, die der Server sperren könnte). Der Umfang ist eine Obergrenze: Die bestehenden
 * Weichen (`inApp` …) gelten weiter, er nimmt nur weg.
 *
 * Ein Modulwert und kein React-Zustand, weil jeder Bildschirm, der fragt,
 * erst nach `/api/me` erscheint — und `/api/me` setzt ihn (api.ts).
 */

let frei: ReadonlySet<string> | null = null;

/**
 * Den Umfang aus `/api/me` uebernehmen. `null` oder fehlend heisst alles an:
 * so meldet es der Server ohne `UMFANG` — und ein aelterer Server, der das
 * Feld noch gar nicht kennt, an den die App mit ihrem Client geraten kann.
 */
export function setzeUmfang(liste: readonly string[] | null | undefined): void {
  frei = Array.isArray(liste) ? new Set(liste) : null;
}

/** Steht dieses Spiel bzw. diese Funktion im Umfang? */
export function imUmfang(kennung: string): boolean {
  return frei === null || frei.has(kennung);
}
