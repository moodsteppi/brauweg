/**
 * Der Kartenkatalog des Clients: jede Bahn eine Datei in diesem Ordner.
 *
 * Bis zum 22.09.2026 lagen die 40 Bahnen in vier Sammeldateien, und ihre
 * Reihenfolge war Teil des Determinismus: `waehleKarten` zog INDIZES aus der
 * Saat, jede neue Bahn musste hinten angehängt werden, und zwei Aufträge, die
 * je eine Bahn ergänzten, stritten sich um dieselben Zeilen. Robin hat an dem
 * Tag entschieden, dass Bahnen jederzeit dazukommen können sollen — ein
 * Map-Editor und eine Bahnauswahl bauen darauf auf.
 *
 * Deshalb hat dieser Katalog KEINE bindende Reihenfolge mehr. Welche Bahnen
 * eine Partie in welcher Folge spielt, entscheidet das Modul `game-golf`
 * einmal beim Start (`waehleBahnen`, Kennung + Schwierigkeit) und liefert die
 * Kennungen in der Sicht mit; dieser Ordner liefert nur die Geometrie zur
 * Kennung. Neue Bahn = neue Datei `kNN-name.ts` mit `export const bahn`
 * PLUS eine Zeile im Katalog des Moduls (`packages/game-golf/src/bahnen.ts`)
 * — der Vertrag unter `src/vertrag/golf-bahnen.test.ts` merkt, wenn eine
 * Seite fehlt.
 *
 * Die Dateien werden per `import.meta.glob` eingesammelt, damit eine neue
 * Bahn diese Datei nicht anfassen muss. Die Testdateien (`*.test.ts`) sind
 * ausgenommen — sie exportieren kein `bahn`. Sortiert wird nach Dateiname
 * (= Kennung, weil die Nummer vorn steht), damit `KARTEN` auf jedem Gerät
 * und in jedem Test dieselbe Liste ist.
 */
import type { Karte } from '../karte';

const module = import.meta.glob<{ bahn?: Karte }>(['./k[0-9][0-9]-*.ts', '!./*.test.ts'], {
  eager: true,
});

/**
 * Dateien im Muster, die kein `bahn` exportieren — im Betrieb übersprungen
 * statt Absturz beim Laden, aber `index.test.ts` verlangt, dass die Liste
 * leer ist: Eine Bahn, die stumm fehlt, fiele sonst erst am Tisch auf.
 */
export const DATEIEN_OHNE_BAHN: readonly string[] = Object.keys(module)
  .filter((datei) => module[datei].bahn === undefined)
  .sort();

/** Dateiname (relativ, `./k01-….ts`) und Bahn — für die Katalogprüfung. */
export const BAHN_DATEIEN: readonly { datei: string; karte: Karte }[] = Object.keys(module)
  .filter((datei) => module[datei].bahn !== undefined)
  .sort()
  .map((datei) => ({ datei, karte: module[datei].bahn as Karte }));

/** Alle Bahnen, nach Kennung sortiert. */
export const KARTEN: readonly Karte[] = BAHN_DATEIEN.map((eintrag) => eintrag.karte);

const nachId = new Map<string, Karte>(KARTEN.map((karte) => [karte.id, karte]));

/** Die laufende Nummer aus der Kennung (`k07-…` → 7); NaN, wenn keine vorn steht. */
export function bahnNummer(id: string): number {
  const treffer = /^k(\d+)-/.exec(id);
  return treffer === null ? Number.NaN : Number(treffer[1]);
}

/** Die Bahnen mit Nummer `von` bis `bis` (einschließlich), nach Kennung sortiert. */
export function bahnenImBereich(von: number, bis: number): Karte[] {
  return KARTEN.filter((karte) => {
    const nr = bahnNummer(karte.id);
    return nr >= von && nr <= bis;
  });
}

/** Bahn zu einer Kennung; `undefined` heißt: Dieser Stand kennt sie nicht. */
export function karteMitId(id: string): Karte | undefined {
  return nachId.get(id);
}
