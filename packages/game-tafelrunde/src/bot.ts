/**
 * Der Bot.
 *
 * Er bekommt ausschliesslich die gefilterte Sicht (game-api, `botAction`) und
 * kann deshalb bauartbedingt nicht schummeln — den Laden des Gegners sieht er
 * so wenig wie ein Mensch.
 *
 * Den KATALOG holt er sich dagegen direkt aus dem Modul und nicht aus der
 * Sicht. Das ist kein Umweg um die Filterung: Der Katalog ist oeffentlich, er
 * steht in jeder Sicht beim ersten Ausliefern. Aber er steht dort eben nur
 * beim ERSTEN, und ein Bot, der von der Belieferungsmarke abhinge, spielte je
 * nach Rundruf verschieden.
 *
 * Die Spielstaerke wertet er nicht aus. Ein Auto-Battler ohne Kampf hat noch
 * keine Stellschraube, an der sich "schwach" von "stark" unterscheiden liesse
 * — das kommt mit Phase 2. Bis dahin spielt er fuer jede Stufe dasselbe:
 * kaufen, aufstellen, aufsteigen, fertig melden.
 */

import { einheit } from './katalog.js';
import type { TafelrundeAktion } from './partie.js';
import type { TafelrundeSicht } from './sicht.js';

/**
 * Wie viel Gold der Bot nach einem Aufstieg uebrig behalten will.
 *
 * Ohne diese Reserve stiege er auf, sobald er es sich gerade eben leisten kann,
 * und stuende danach mit einem groesseren Brett und nichts darauf da. Fuenf ist
 * ungefaehr eine Einheit der mittleren Stufe plus ein Neu-Wuerfeln.
 */
const AUFSTIEGS_RESERVE = 5;

export function botZug(sicht: TafelrundeSicht): TafelrundeAktion {
  const eigen = sicht.eigenes;
  // Ohne eigenes Heer gibt es nichts zu entscheiden. Bereit zu melden ist die
  // einzige Aktion, die in jeder Lage etwas bewirkt oder wenigstens nicht
  // wirft — und der Adapter faengt den Zuschauerfall ohnehin vorher ab.
  if (!eigen) return { typ: 'bereit' };

  /*
   * Reihenfolge ist Absicht: erst aufstellen, dann kaufen.
   *
   * Andersherum kaufte der Bot die Bank voll und stellte erst danach auf —
   * und weil jede Aktion einzeln ueber die Plattform laeuft, staende sein
   * Brett bis kurz vor dem Kampf leer. Sieht man ihm zu, soll er wie jemand
   * wirken, der sein Heer aufbaut, und nicht wie jemand, der hamstert.
   */
  const freiesFeld = eigen.brett.indexOf(null);
  const vonBank = eigen.bank.findIndex((k) => k !== null);
  if (eigen.belegt < eigen.feldplaetze && freiesFeld >= 0 && vonBank >= 0) {
    return {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: vonBank },
      nach: { bereich: 'brett', platz: freiesFeld },
    };
  }

  /*
   * Kaufen: das Teuerste, was er sich leisten kann. Bei gleichem Preis das
   * am weitesten links — eine feste Wahl, damit derselbe Laden immer denselben
   * Kauf ergibt (Grundsatz 1).
   *
   * Ein freier Bankplatz ist Bedingung. Die Ausnahme "bei voller Bank darf
   * man kaufen, was sofort verschmilzt" laesst er aus: Sie nachzurechnen
   * hiesse, das Verschmelzen im Bot ein zweites Mal zu bauen, und zwei
   * Fassungen derselben Regel laufen frueher oder spaeter auseinander.
   */
  if (eigen.bank.includes(null)) {
    let bester = -1;
    let besterPreis = 0;
    eigen.laden.forEach((id, platz) => {
      if (id === null) return;
      const preis = einheit(id).kosten;
      if (preis > eigen.gold) return;
      if (preis > besterPreis) {
        bester = platz;
        besterPreis = preis;
      }
    });
    if (bester >= 0) return { typ: 'kaufen', platz: bester };
  }

  if (
    eigen.aufstiegKosten !== null &&
    eigen.gold >= eigen.aufstiegKosten + AUFSTIEGS_RESERVE
  ) {
    return { typ: 'levelAuf' };
  }

  return { typ: 'bereit' };
}
