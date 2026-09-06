/**
 * Die gefilterte Sicht — und damit der halbe Reiz dieses Spiels.
 *
 * Sichtbar ist das eigene Gebiet und alles, was hoechstens `sichtweite`
 * Schritte davon entfernt liegt. Alles andere geht als `null` ueber die
 * Leitung (game-api, Grundsatz 2): Der Client kennt das Gelaende dahinter gar
 * nicht, und wer die Entwicklerkonsole aufmacht, findet dort nichts. Sonst
 * waere der Nebel an dem Tag erledigt, an dem der Erste nachsieht.
 *
 * Was ABSICHTLICH mitgeht:
 *
 *   - `grau`: der Farbton, in dem ein verdecktes Feld gezeichnet wird.
 *     Unabhaengig aus der Saat gezogen (siehe partie.ts) und deshalb harmlos.
 *     Ohne ihn waere der Nebel eine Flaeche statt eines Rasters.
 *   - `punkte` und `gesammelt` je Sitz: WIE VIEL der Gegner haelt und wie
 *     viele Ornamente er hat, nicht WO. Beides steht bei jedem Flaechenspiel
 *     ueber dem Brett, und ohne die Ornamentzahl liesse sich nicht abschaetzen,
 *     wie schnell er gerade waechst.
 *   - `bereit` je Sitz: dass der andere seinen Zettel abgegeben hat, sieht man
 *     bei einem gleichzeitigen Zug auch am Tisch. Was auf dem Zettel steht,
 *     steht nicht darin.
 */

import {
  type EilandAusgang,
  type EilandPartie,
  istBereit,
  kontingent,
  sieger,
  sitzeVon,
  waehlbare,
} from './partie.js';
import type { EilandVariante } from './regeln.js';

export interface EilandSicht {
  /**
   * Der eigene Sitz, oder null fuer Zuschauer.
   *
   * Steht in der Sicht und nicht nur in der Nachrichtenhuelle, weil der BOT
   * nichts als die Sicht bekommt (`botAction` in game-api). Ohne diese Zahl
   * wuesste er nicht, welche Felder seine sind. Ein Leck ist es nicht: Die
   * eigene Sitznummer kennt man ohnehin.
   */
  readonly ich: number | null;
  readonly spalten: number;
  readonly zeilen: number;
  readonly sichtweite: number;
  /**
   * Spielart dieses Tisches.
   *
   * Der Client zeichnet in beiden Faellen dasselbe — was er nicht weiss, malt
   * er grau —, aber er soll es BENENNEN koennen ("Nebel" am Kopf der Karte).
   * Und ohne dieses Feld liesse sich nach einem Neuladen nicht mehr sagen, an
   * welchem Tisch man eigentlich sitzt.
   */
  readonly variante: EilandVariante;
  /** Gelaende je Platz (0 Gras, 1 Wasser, 2 Berg), null im Nebel. */
  readonly gelaende: readonly (number | null)[];
  /** Ornamentart je Platz, null wenn keins da ist ODER das Feld im Nebel liegt. */
  readonly ornament: readonly (number | null)[];
  /**
   * Eingesammelte Ornamente, die als Bauwerk auf dem Feld stehen geblieben
   * sind — gefiltert wie `ornament`. Ein Bauwerk steht immer auf besetztem
   * Land und verraet deshalb nichts, was der Besitzer nicht ohnehin zeigt.
   */
  readonly bauwerk: readonly (number | null)[];
  /** Wem ein Platz gehoert — nur fuer sichtbare Plaetze, sonst null. */
  readonly besitzer: readonly (number | null)[];
  /** Grauton je Platz, fuer die Zeichnung verdeckter Felder. */
  readonly grau: readonly number[];
  readonly punkte: Readonly<Record<number, number>>;
  readonly gesammelt: Readonly<Record<number, number>>;
  /** Felder je Runde, je Sitz. Oeffentlich, siehe oben. */
  readonly kontingent: Readonly<Record<number, number>>;
  readonly bereit: Readonly<Record<number, boolean>>;
  /** Die eigene, noch geheime Auswahl. Bei Zuschauern leer. */
  readonly wahl: readonly number[];
  /** Was jetzt anwaehlbar waere. Der Client rechnet das nicht selbst aus. */
  readonly waehlbar: readonly number[];
  readonly runde: number;
  /** Ausgang der letzten Runde, auf das Sichtbare beschnitten. */
  readonly letzte: EilandAusgang | null;
  readonly fertig: boolean;
  readonly sieger: number | null;
  readonly leftSeats: readonly number[];
  /** true = neutrale Zuschauersicht. */
  readonly zuschauer: boolean;
}

/**
 * Sichtbar ist ein Platz, wenn er hoechstens `sichtweite` Schritte von einem
 * eigenen Feld entfernt liegt.
 *
 * Gemessen wird ueber das Raster, nicht entlang begehbarer Wege: Ein Berg
 * verdeckt nichts, ein See auch nicht. Das ist die Regel, die der Spieler im
 * Kopf haben soll ("drei Felder weit"), und jede Verfeinerung — Sichtlinien,
 * Hoehen — waere eine zweite Regel fuer denselben Zweck.
 *
 * Ein Breitensuchlauf von allen eigenen Feldern aus gleichzeitig, nicht ein
 * Abstandsvergleich je Feldpaar: Bei einem gewachsenen Gebiet ist das der
 * Unterschied zwischen einem Durchlauf und mehreren tausend.
 */
function sichtbarePlaetze(partie: EilandPartie, sitz: number): boolean[] {
  const { spalten, zeilen, sichtweite } = partie.regeln;
  /*
   * Offene Spielart: alles sichtbar. Das ist der EINZIGE Unterschied zwischen
   * den beiden Modi — Regeln, Zuege, Bot und Kartenaufbau sind identisch. Wer
   * hier einen zweiten Unterschied einbaut, hat zwei Spiele statt einem.
   */
  if (partie.regeln.variante === 'klar') return partie.besitzer.map(() => true);
  const sichtbar = partie.besitzer.map((b) => b === sitz);
  let rand: number[] = [];
  for (let platz = 0; platz < partie.besitzer.length; platz++) {
    if (partie.besitzer[platz] === sitz) rand.push(platz);
  }
  for (let schritt = 0; schritt < sichtweite; schritt++) {
    const naechster: number[] = [];
    for (const platz of rand) {
      const x = platz % spalten;
      const y = Math.floor(platz / spalten);
      if (x > 0) naechster.push(platz - 1);
      if (x < spalten - 1) naechster.push(platz + 1);
      if (y > 0) naechster.push(platz - spalten);
      if (y < zeilen - 1) naechster.push(platz + spalten);
    }
    rand = [];
    for (const platz of naechster) {
      if (sichtbar[platz]) continue;
      sichtbar[platz] = true;
      rand.push(platz);
    }
  }
  return sichtbar;
}

/**
 * Den Ausgang der letzten Runde auf das Sichtbare beschneiden.
 *
 * Die eigenen Kaempfe und die eigenen verfallenen Felder liegen immer im
 * Blick — man hat sie ja selbst gewaehlt. Was der Gegner am anderen Ende der
 * Karte genommen hat, geht niemanden etwas an: Sonst waere die
 * Rundenmeldung ein Fernrohr, das der Nebel gerade verhindern soll.
 */
function beschneide(ausgang: EilandAusgang, sichtbar: readonly boolean[]): EilandAusgang {
  const filterKarte = (
    karte: Readonly<Record<number, readonly number[]>>,
  ): Record<number, readonly number[]> => {
    const raus: Record<number, readonly number[]> = {};
    for (const [sitz, plaetze] of Object.entries(karte)) {
      raus[Number(sitz)] = plaetze.filter((p) => sichtbar[p]);
    }
    return raus;
  };
  return {
    runde: ausgang.runde,
    kaempfe: ausgang.kaempfe.filter((k) => sichtbar[k.platz]),
    // Die Einsaetze bleiben vollstaendig: dass der Gegner Felder
    // zurueckgehalten hat, sieht man an seinem Kontingent ohnehin.
    reserve: ausgang.reserve,
    genommen: filterKarte(ausgang.genommen),
    verfallen: filterKarte(ausgang.verfallen),
    /*
     * Die Ornamentzahl bleibt vollstaendig: Sie sagt nur, DASS der Gegner
     * eines gefunden hat — und dieselbe Auskunft steht als `gesammelt` ohnehin
     * ueber dem Brett. Sie zu beschneiden hiesse, zwei Zahlen zu haben, die
     * sich widersprechen.
     */
    ornamente: ausgang.ornamente,
  };
}

function grundsicht(
  partie: EilandPartie,
  ich: number | null,
): Omit<
  EilandSicht,
  'gelaende' | 'ornament' | 'bauwerk' | 'besitzer' | 'wahl' | 'waehlbar' | 'letzte'
> {
  const kontingente: Record<number, number> = {};
  const bereit: Record<number, boolean> = {};
  for (const sitz of sitzeVon(partie)) {
    kontingente[sitz] = kontingent(partie, sitz);
    bereit[sitz] = istBereit(partie, sitz);
  }
  return {
    ich,
    spalten: partie.regeln.spalten,
    zeilen: partie.regeln.zeilen,
    sichtweite: partie.regeln.sichtweite,
    variante: partie.regeln.variante,
    grau: partie.grau,
    punkte: partie.punkte,
    gesammelt: partie.gesammelt,
    kontingent: kontingente,
    bereit,
    runde: partie.runde,
    fertig: partie.fertig,
    sieger: sieger(partie),
    leftSeats: partie.leftSeats,
    zuschauer: ich === null,
  };
}

/**
 * Sicht eines Sitzes.
 *
 * Am Ende der Partie faellt der Nebel NICHT von selbst: Es bleibt liegen, was
 * niemand erreicht hat, und das ist richtig so — wer verloren hat, soll sehen,
 * wo er nicht hingekommen ist, und nicht, was er verpasst hat.
 */
export function sichtFuer(partie: EilandPartie, sitz: number): EilandSicht {
  const sichtbar = sichtbarePlaetze(partie, sitz);
  return {
    ...grundsicht(partie, sitz),
    gelaende: partie.gelaende.map((g, platz) => (sichtbar[platz] ? g : null)),
    ornament: partie.ornament.map((o, platz) => (sichtbar[platz] ? o : null)),
    bauwerk: partie.bauwerk.map((b, platz) => (sichtbar[platz] ? b : null)),
    besitzer: partie.besitzer.map((b, platz) => (sichtbar[platz] ? b : null)),
    wahl: partie.wahl[sitz] ?? [],
    waehlbar: waehlbare(partie, sitz),
    letzte: partie.letzte ? beschneide(partie.letzte, sichtbar) : null,
  };
}

/**
 * Zuschauersicht.
 *
 * Sie zeigt die BESITZVERHAELTNISSE vollstaendig — man soll den Gebieten beim
 * Wachsen zusehen koennen —, vom freien Land aber weder Gelaende noch
 * Ornamente. Genau die sind das Geheimnis der Partie, und ein Zuschauer mit
 * Fernblick waere ein perfekter Komplize: Er muesste einem Spieler nur sagen,
 * wo hinter seinem Rand das naechste Ornament liegt.
 */
export function zuschauerSicht(partie: EilandPartie): EilandSicht {
  // In der offenen Spielart gibt es nichts zu verbergen: Dort liegt die Karte
  // fuer beide Spieler ohnehin offen, ein Zuschauer erfaehrt also nichts, was
  // nicht schon beide wissen.
  const offen = partie.regeln.variante === 'klar';
  const besetzt = partie.besitzer.map((b) => offen || b !== null);
  return {
    ...grundsicht(partie, null),
    gelaende: partie.gelaende.map((g, platz) => (besetzt[platz] ? g : null)),
    ornament: partie.ornament.map((o, platz) => (besetzt[platz] ? o : null)),
    bauwerk: partie.bauwerk.map((b, platz) => (besetzt[platz] ? b : null)),
    besitzer: partie.besitzer,
    wahl: [],
    waehlbar: [],
    letzte: partie.letzte ? beschneide(partie.letzte, besetzt) : null,
  };
}
