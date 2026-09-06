/**
 * Spielzustand und Regeln von Eiland.
 *
 * Reine Logik: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser dem
 * uebergebenen Seed (game-api, Grundsatz 1).
 *
 * Das Spiel: Zwei Spieler, eine Karte aus Gras, Seen und Bergen. Jeder startet
 * auf einer Ecke und nimmt je Runde ein Feld ein, das an sein Gebiet grenzt —
 * und ein Feld mehr fuer jedes Ornament, das er eingesammelt hat. Wasser und
 * Berge gehoeren niemandem. Gegnerisches Gebiet ist seit dem 5. September
 * nicht mehr unantastbar: Ein fremdes Feld am eigenen Rand laesst sich
 * ANGREIFEN, wenn seine Stufe niedriger ist als die des eigenen Feldes
 * daneben (siehe stufe und angreifbare). Die Startecke ist die HEIMAT — wer
 * sie verliert, hat verloren. Sonst ist zu Ende, wenn keiner mehr irgendwo
 * hin kann; dann gewinnt, wer mehr Felder haelt.
 *
 * Zwei Dinge unterscheiden es von allem anderen im Haus:
 *
 *   1. GLEICHZEITIG. Beide waehlen ihre Felder, ohne die Wahl des anderen zu
 *      sehen; erst wenn beide bereit sind, wird aufgeloest. Wollen beide
 *      dasselbe Feld, wird gekaempft — und seit dem 2. September ist der
 *      Kampf eine Wette: Was ein Sitz in der Runde NICHT gesetzt hat, ist
 *      sein Einsatz. Wer allein einen Einsatz hat, gewinnt das Feld sicher;
 *      haben beide einen oder keiner, entscheidet der Muenzwurf. Jeder
 *      Einsatz gilt fuer ein Streitfeld, die Streitfelder kommen in
 *      zufaelliger Reihenfolge dran (siehe loeseAuf).
 *   2. NEBEL. Sichtbar ist das eigene Gebiet und drei Schritte darueber
 *      hinaus. Das steht nicht hier, sondern in `sicht.ts` — Grundsatz 2:
 *      Sichtbarkeit entsteht ausschliesslich in viewFor.
 *
 * Warum `currentActor` trotz Gleichzeitigkeit einen Sitz nennt (siehe amZug):
 * Die Plattform haengt Zugzeit, Bot-Uebernahme und die Verlassen-Regel daran.
 * Ein Modul, das dauerhaft `null` meldet, bekommt von ihr keinen einzigen
 * Timer — es waere ein Echtzeitspiel wie Feldherr und muesste seine Uhr selbst
 * mitbringen. Der Server prueft `currentActor` beim Handeln NICHT; wer an der
 * Reihe ist, entscheidet allein dieses Modul, und hier darf jeder handeln,
 * solange sein Zettel noch nicht abgegeben ist.
 */

import {
  BERG,
  GRAS,
  ORNAMENTARTEN,
  STUFEN_MAX,
  type Saat,
  WASSER,
  abstand,
  baueKarte,
  baueZufall,
  mischeplaetze,
  nachbarn,
  spiegel,
  startEcke,
  umfeld,
} from './karte.js';
import { type EilandRegeln, istVariante } from './regeln.js';

export { BERG, GRAS, STUFEN_MAX, WASSER, nachbarn, startEcke, umfeld };

/**
 * So viele Graustufen gibt es fuer verdeckte Felder.
 *
 * Sie sind reine Zeichnung: Ohne sie waere der Nebel eine einzige graue
 * Flaeche, und man saehe nicht mehr, dass darunter EINZELNE Felder liegen.
 * Die Zahl ist bewusst nicht die Zahl der Gelaendearten — sonst laege der
 * Verdacht nahe, Grauton n stehe fuer Gelaende n, und wer das an ein paar
 * aufgedeckten Feldern nachprueft, haette die ganze Karte.
 */
export const GRAUTOENE = 5;

/**
 * Notbremse gegen eine Partie, die sich nicht selbst beendet.
 *
 * Der Normalfall ist sie nicht: Jede Runde, in der ueberhaupt jemand ziehen
 * kann, nimmt der Karte ein freies Feld weg, und wenn keiner mehr kann, ist
 * ohnehin Schluss. Bleibt der Fall, dass beide dauerhaft passen, ohne dass
 * die Karte voll ist. Ohne diesen Deckel liefe so ein Tisch bis zum Verfall
 * weiter, und niemand koennte etwas dagegen tun.
 */
export const LEERRUNDEN_MAX = 4;

/**
 * Zweite Notbremse, seit es Angriffe gibt: so viele Runden in Folge ohne ein
 * einziges neu genommenes FREIES Feld.
 *
 * Solange Land verteilt wird, endet jede Partie von selbst (siehe oben).
 * Angriffe aber nehmen der Karte nichts weg — ein Feld wechselt nur die
 * Farbe, und mit ihm wechseln die Stufen rundherum. Zwei Gegner, die sich
 * dasselbe Feld immer wieder abnehmen, kaemen so nie zum Ende; mit zwei Bots
 * am Tisch ist das kein Gedankenspiel, sondern eine Endlosschleife. Vierzig
 * Runden reinen Kampfes sind mehr, als eine echte Partie je braucht — die
 * Fronten sind lange vorher glatt, und glatte Fronten kann keiner angreifen.
 */
export const KAMPFRUNDEN_MAX = 40;

/**
 * Stellungswiederholung: Steht dieselbe Besitzverteilung zum dritten Mal auf
 * dem Brett, ist die Partie aus — wie im Schach, und aus demselben Grund.
 *
 * Das ist der eigentliche Schluss fuer den Fall, den KAMPFRUNDEN_MAX nur
 * deckelt: A nimmt B ein Feld, B nimmt es zurueck, A nimmt es wieder. Jeder
 * Zug lohnt sich fuer den, der ihn macht (ein Feld hin, ein Feld her), also
 * hoert keiner von selbst auf. Nach zwei vollen Umlaeufen steht fest, dass
 * sich nichts mehr bewegt, und das Land entscheidet — statt dass zwei
 * Menschen vierzig Runden lang Abgeben druecken. Gezaehlt wird nur, seit
 * zuletzt freies Land genommen wurde: Danach kann sich keine Stellung
 * wiederholen, ein Feld mehr ist ein Feld mehr.
 */
export const WIEDERHOLUNGEN_MAX = 3;

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/** Was in einer Runde geschehen ist. Der Client zeichnet es nach. */
export interface EilandAusgang {
  readonly runde: number;
  /**
   * Felder, die beide wollten — in der Reihenfolge, in der sie entschieden
   * wurden (zufaellig, siehe loeseAuf), samt Gewinner und den Sitzen, die
   * einen Einsatz darauf gesetzt haben. Die Reihenfolge ist keine Zierde:
   * Der Client laesst die Einsaetze in genau dieser Folge aufs Feld fliegen.
   */
  readonly kaempfe: readonly {
    readonly platz: number;
    readonly sieger: number;
    /** Sitze, die ein zurueckgehaltenes Feld auf diesen Kampf gesetzt haben. */
    readonly einsatz: readonly number[];
  }[];
  /** Zurueckgehaltene Felder je Sitz zu Beginn der Aufloesung — der Einsatz. */
  readonly reserve: Readonly<Record<number, number>>;
  /** Was jeder Sitz an FREIEM Land tatsaechlich bekommen hat. */
  readonly genommen: Readonly<Record<number, readonly number[]>>;
  /**
   * Was jeder Sitz dem Gegner abgenommen hat (seit dem 5. September). Getrennt
   * von `genommen`, weil der Client beides verschieden zeichnet — und weil
   * die Gegenseite daraus abliest, was sie verloren hat.
   */
  readonly erobert: Readonly<Record<number, readonly number[]>>;
  /**
   * Felder, die jemand gewaehlt hatte und doch nicht bekam, weil der Weg
   * dorthin an einem verlorenen Kampf haengt (siehe erreichbare()).
   */
  readonly verfallen: Readonly<Record<number, readonly number[]>>;
  /** In dieser Runde eingesammelte Ornamente je Sitz. */
  readonly ornamente: Readonly<Record<number, number>>;
}

export interface EilandPartie {
  readonly regeln: EilandRegeln;
  /**
   * Gelaende je Platz: GRAS, WASSER oder BERG.
   *
   * Verlaesst diese Datei NIE ungefiltert — das ist zusammen mit den
   * Ornamenten das ganze Geheimnis der Karte (siehe sicht.ts).
   */
  readonly gelaende: readonly number[];
  /**
   * Grauton je Platz, 0 bis GRAUTOENE-1. Reine Zeichnung fuer verdeckte
   * Felder, unabhaengig aus der Saat gezogen und deshalb ungefaehrlich: Er
   * darf in jeder Sicht stehen.
   */
  readonly grau: readonly number[];
  /** Wem ein Platz gehoert, sonst null. */
  readonly besitzer: readonly (number | null)[];
  /** Ornamentart je Platz (0 Stadt, 1 Brunnen), sonst null. */
  readonly ornament: readonly (number | null)[];
  /**
   * Bauwerk je Platz: die Art des Ornaments, das hier eingesammelt wurde,
   * sonst null.
   *
   * Ein eingesammeltes Ornament verschwindet seit dem 2. September nicht mehr
   * von der Karte, es wechselt nur die Liste: aus `ornament` (liegt aus,
   * zaehlt fuers Nachlegen, lockt den Bot) hierher (steht auf eigenem Land,
   * ist reine Zeichnung). Zwei Listen statt einer Markierung, damit keine
   * Regel je fragen muss, ob ein Ornament "noch zaehlt" — was in `ornament`
   * steht, zaehlt immer, was hier steht, nie. Der Sinn ist der Blick aufs
   * Brett: Man sieht am Land, wie viele man schon hat, ohne die Zahl am Kopf
   * zu lesen.
   */
  readonly bauwerk: readonly (number | null)[];
  /**
   * Gemischte Plaetze, aus denen nachrueckende Ornamente gezogen werden, und
   * der Zeiger darauf. Beides bleibt im Zustand und geht nie in eine Sicht —
   * wer die Liste haette, wuesste, wo das naechste Ornament erscheint.
   */
  readonly nachschub: readonly number[];
  readonly nachschubZeiger: number;
  /**
   * Vorrat an Muenzwuerfen fuer die Kaempfe, und der Zeiger darauf.
   *
   * Vorab gezogen statt aus einem laufenden Generator: Der Zustand bleibt
   * damit eine Datenstruktur, die man ansehen und in einem Test nachrechnen
   * kann, statt eines Generators mit innerem Stand. Der Vorrat reicht immer —
   * jeder Kampf vergibt ein Feld, und Felder gibt es nur endlich viele.
   */
  readonly kaempfe: readonly number[];
  readonly kampfZeiger: number;
  /** Die laufende, noch geheime Auswahl je Sitz. */
  readonly wahl: Readonly<Record<number, readonly number[]>>;
  /** Wer seinen Zettel abgegeben hat. */
  readonly bereit: Readonly<Record<number, boolean>>;
  /** Eingesammelte Ornamente je Sitz. Jedes ist ein Feld mehr je Runde. */
  readonly gesammelt: Readonly<Record<number, number>>;
  /** Gehaltene Felder je Sitz. Zugleich die Punktzahl. */
  readonly punkte: Readonly<Record<number, number>>;
  readonly runde: number;
  /** Runden in Folge, in denen kein einziges Feld den Besitzer wechselte. */
  readonly leerrunden: number;
  /** Runden in Folge ohne ein neu genommenes freies Feld (siehe KAMPFRUNDEN_MAX). */
  readonly kampfrunden: number;
  /**
   * Die Besitzverteilungen seit dem letzten neu genommenen freien Feld, die
   * aktuelle zuletzt (siehe WIEDERHOLUNGEN_MAX). Als lesbare Zeichenkette je
   * Platz (`.`, `0`, `1`) und nicht als Pruefsumme: Man soll im Snapshot
   * sehen koennen, welche Stellung sich wiederholt hat. Hoechstens
   * KAMPFRUNDEN_MAX Eintraege, danach ist ohnehin Schluss.
   */
  readonly stellungen: readonly string[];
  /** Ausgang der letzten Runde, fuer die Anzeige. */
  readonly letzte: EilandAusgang | null;
  readonly leftSeats: readonly number[];
  readonly fertig: boolean;
}

/**
 * Die einzige Aktion: der ausgefuellte Zettel.
 *
 * Frueher gab es drei — Feld waehlen, zuruecknehmen, abgeben —, jede mit
 * einem eigenen Gang zum Server. Das kostete bei einem Kontingent von sechs
 * sechs Umlaeufe, und der Bot brauchte sechsmal seine Bedenkzeit, waehrend
 * der Mensch zusah. Jetzt waehlt jeder seine Felder bei sich und schickt
 * einmal: ein Umlauf je Runde, egal wie gross das Kontingent ist.
 *
 * Eine leere Liste ist das Passen.
 */
export type EilandAktion = { readonly typ: 'plan'; readonly felder: readonly number[] };

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

export function erstellePartie(
  regeln: EilandRegeln,
  sitze: readonly number[],
  saat: Saat,
): EilandPartie {
  const zufall = baueZufall(saat);
  const { spalten, zeilen } = regeln;
  const felder = spalten * zeilen;

  const gelaende = baueKarte(regeln, zufall);
  /*
   * Die Grautoene NACH der Karte und aus demselben Generator, aber als eigene
   * Zuege: Es sind unabhaengige Ziehungen, aus einem Grauton laesst sich also
   * kein Gelaende herleiten. Wer sie stattdessen aus dem Gelaende ableitete,
   * haette den ganzen Nebel in einer Zeile verschenkt.
   */
  const grau = gelaende.map(() => Math.floor(zufall() * GRAUTOENE));
  const nachschub = mischeplaetze(felder, zufall);
  /*
   * Zwei Wuerfe je Feld sind mehr, als je gebraucht werden koennen: Jeder
   * Kampf vergibt ein Feld, es kann also hoechstens so viele Kaempfe geben wie
   * Felder. Der Rest ist Luft fuer den Fall, dass jemand die Kartengroesse
   * aendert, ohne diese Zeile zu lesen.
   */
  const kaempfe = Array.from({ length: felder * 2 }, () => Math.floor(zufall() * 2));

  const besitzer: (number | null)[] = new Array(felder).fill(null);
  const ornament: (number | null)[] = new Array(felder).fill(null);
  const bauwerk: (number | null)[] = new Array(felder).fill(null);
  const punkte: Record<number, number> = {};
  const gesammelt: Record<number, number> = {};
  const wahl: Record<number, readonly number[]> = {};
  const bereit: Record<number, boolean> = {};

  for (const sitz of sitze) {
    const ecke = startEcke(sitz, spalten, zeilen);
    besitzer[ecke] = sitz;
    punkte[sitz] = 1;
    gesammelt[sitz] = 0;
    wahl[sitz] = [];
    bereit[sitz] = false;
  }

  /*
   * Die ersten Ornamente liegen PAARWEISE punktsymmetrisch, so wie das
   * Gelaende. Damit hat zu Beginn keiner den kuerzeren Weg zum ersten
   * Ornament — und weil das erste Ornament das Kontingent verdoppelt, waere
   * genau das der groesste Vorsprung, den dieses Spiel zu vergeben hat.
   * Nachruecken werden sie spaeter einzeln (siehe legeNach): Dann stehen die
   * Gebiete ohnehin verschieden, eine Spiegelung waere nur noch Zierde.
   */
  const paare = Math.floor(regeln.ornamente / 2);
  let zeiger = 0;
  for (let i = 0; i < paare; i++) {
    zeiger = setzePaar(gelaende, ornament, besitzer, nachschub, zeiger, regeln);
  }
  if (regeln.ornamente % 2 === 1) {
    zeiger = legeEines(gelaende, ornament, besitzer, nachschub, zeiger, regeln);
  }

  return {
    /*
     * Die Spielart wird HIER festgeschrieben und nicht erst beim Lesen der
     * Sicht ergaenzt. Ein Tisch aus der ersten Fassung hat sie nicht in der
     * `config`; ohne diese Zeile stuende im Snapshot ein `undefined`, und jede
     * spaetere Stelle muesste raten, was es bedeutet.
     */
    regeln: istVariante(regeln.variante) ? regeln : { ...regeln, variante: 'nebel' },
    gelaende,
    grau,
    besitzer,
    ornament,
    bauwerk,
    nachschub,
    nachschubZeiger: zeiger,
    kaempfe,
    kampfZeiger: 0,
    wahl,
    bereit,
    gesammelt,
    punkte,
    runde: 1,
    leerrunden: 0,
    kampfrunden: 0,
    stellungen: [stellung(besitzer)],
    letzte: null,
    leftSeats: [],
    fertig: false,
  };
}

/** Die Besitzverteilung als Zeichenkette, fuer die Stellungswiederholung. */
function stellung(besitzer: readonly (number | null)[]): string {
  return besitzer.map((b) => (b === null ? '.' : String(b))).join('');
}

/**
 * Darf hier ein Ornament liegen?
 *
 * Nicht auf Wasser oder Berg, nicht auf besetztem Land, nicht auf einem Feld,
 * das schon eines traegt — und nicht direkt neben einem Gebiet. Der Abstand
 * ist die einzige Bedingung, die nicht offensichtlich ist: Ein Ornament, das
 * unmittelbar neben mir auftaucht, ist ein Geschenk und keine Entscheidung.
 * Mit einem Feld Abstand muss wenigstens jemand hinlaufen.
 */
function taugtFuerOrnament(
  gelaende: readonly number[],
  ornament: readonly (number | null)[],
  besitzer: readonly (number | null)[],
  platz: number,
  regeln: EilandRegeln,
): boolean {
  if (gelaende[platz] !== GRAS) return false;
  if (besitzer[platz] !== null) return false;
  if (ornament[platz] !== null) return false;
  const { spalten, zeilen } = regeln;
  if (nachbarn(platz, spalten, zeilen).some((n) => besitzer[n] !== null)) return false;
  /*
   * Zu Beginn gibt es noch fast keinen Besitz, wohl aber zwei Startecken. Ein
   * Ornament in Reichweite des ersten Zuges waere dasselbe Geschenk wie oben,
   * nur eine Runde frueher — deshalb zaehlt hier zusaetzlich der blanke
   * Abstand zu den Ecken.
   */
  for (const sitz of [0, 1]) {
    if (abstand(platz, startEcke(sitz, spalten, zeilen), spalten) < 2) return false;
  }
  return true;
}

/** Ein Ornament aus dem Vorrat legen. Gibt den neuen Zeigerstand zurueck. */
function legeEines(
  gelaende: readonly number[],
  ornament: (number | null)[],
  besitzer: readonly (number | null)[],
  nachschub: readonly number[],
  zeiger: number,
  regeln: EilandRegeln,
): number {
  for (let i = 0; i < nachschub.length; i++) {
    const stelle = (zeiger + i) % nachschub.length;
    const platz = nachschub[stelle]!;
    if (!taugtFuerOrnament(gelaende, ornament, besitzer, platz, regeln)) continue;
    // Die Art ist reine Zeichnung — Stadt oder Brunnen aendern nichts an der
    // Wirkung. Aus dem Platz abgeleitet und nicht gewuerfelt, damit das
    // Nachlegen ohne einen zweiten Zufallsstrom auskommt.
    ornament[platz] = platz % ORNAMENTARTEN;
    return (stelle + 1) % nachschub.length;
  }
  // Kein Platz mehr frei genug: Dann liegen eben weniger Ornamente auf der
  // Karte. Gegen Ende ist das der Normalfall und kein Fehler.
  return zeiger;
}

/** Zwei Ornamente, punktsymmetrisch zueinander. Nur beim Aufbau. */
function setzePaar(
  gelaende: readonly number[],
  ornament: (number | null)[],
  besitzer: readonly (number | null)[],
  nachschub: readonly number[],
  zeiger: number,
  regeln: EilandRegeln,
): number {
  const felder = gelaende.length;
  for (let i = 0; i < nachschub.length; i++) {
    const stelle = (zeiger + i) % nachschub.length;
    const platz = nachschub[stelle]!;
    const gegen = spiegel(platz, felder);
    if (platz === gegen) continue;
    if (!taugtFuerOrnament(gelaende, ornament, besitzer, platz, regeln)) continue;
    if (!taugtFuerOrnament(gelaende, ornament, besitzer, gegen, regeln)) continue;
    ornament[platz] = platz % ORNAMENTARTEN;
    // Beide Ornamente eines Paares tragen dieselbe Art: Das Spiegelbild soll
    // als Spiegelbild erkennbar sein.
    ornament[gegen] = platz % ORNAMENTARTEN;
    return (stelle + 1) % nachschub.length;
  }
  return zeiger;
}

// ---------------------------------------------------------------------------
// Auskunft
// ---------------------------------------------------------------------------

/** Die Sitze dieser Partie, aufsteigend. */
export function sitzeVon(partie: EilandPartie): number[] {
  return Object.keys(partie.punkte)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Wie viele Felder dieser Sitz in dieser Runde nehmen darf. */
export function kontingent(partie: EilandPartie, sitz: number): number {
  const ornamente = partie.gesammelt[sitz] ?? 0;
  return Math.min(1 + ornamente, partie.regeln.kontingentMax);
}

/**
 * Felder, die dieser Sitz JETZT noch waehlen kann.
 *
 * "Grenzt an" heisst: an das eigene Gebiet oder an ein Feld, das in dieser
 * Runde schon gewaehlt wurde. Damit lassen sich mehrere Felder zu einem
 * Vorstoss aneinanderreihen, statt nur den eigenen Rand zu verbreitern — und
 * die Reihenfolge der Tipps ist egal, weil am Ende nur zaehlt, dass die
 * Auswahl mit dem Gebiet zusammenhaengt.
 *
 * Was die Wahl des GEGNERS angeht, ist diese Liste absichtlich blind: Sie
 * kennt sie nicht und darf sie nicht kennen. Genau daraus entstehen die
 * Kaempfe.
 */
export function waehlbare(partie: EilandPartie, sitz: number): number[] {
  if (partie.fertig) return [];
  if (partie.bereit[sitz]) return [];
  const gewaehlt = partie.wahl[sitz] ?? [];
  if (gewaehlt.length >= kontingent(partie, sitz)) return [];

  const { spalten, zeilen } = partie.regeln;
  const eigen = new Set<number>(gewaehlt);
  for (let platz = 0; platz < partie.besitzer.length; platz++) {
    if (partie.besitzer[platz] === sitz) eigen.add(platz);
  }

  const raus = new Set<number>();
  for (const platz of eigen) {
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (eigen.has(n)) continue;
      if (partie.gelaende[n] !== GRAS) continue;
      if (partie.besitzer[n] !== null) continue;
      raus.add(n);
    }
  }
  return [...raus].sort((a, b) => a - b);
}

/**
 * Die Stufe eines Feldes: wie viele der acht Felder in seinem Umfeld
 * demselben Sitz gehoeren, 0 bis STUFEN_MAX. Freies Land hat keine Stufe.
 *
 * Sie sagt, wie fest ein Feld im eigenen Land sitzt — und damit, ob es sich
 * angreifen laesst (siehe angreifbare). Nur der Besitz zaehlt, nicht das
 * Gelaende: Ein See neben dem Feld ist kein Schutz, sondern ein Nachbar, der
 * fehlt. Das ist Absicht — wer sein Land an Wasser und Berge lehnt, hat
 * weniger Umfeld und muss das wissen.
 */
export function stufe(
  besitzer: readonly (number | null)[],
  platz: number,
  spalten: number,
  zeilen: number,
): number | null {
  const wem = besitzer[platz];
  if (wem === null || wem === undefined) return null;
  let zahl = 0;
  for (const n of umfeld(platz, spalten, zeilen)) {
    if (besitzer[n] === wem) zahl++;
  }
  return zahl;
}

/**
 * Gegnerische Felder, die dieser Sitz JETZT angreifen kann.
 *
 * Angreifbar ist ein fremdes Feld, das an ein eigenes grenzt — derselbe Radius
 * wie beim Ausbreiten — und dessen Stufe NIEDRIGER ist als die des eigenen
 * Feldes daneben. Gleiche Stufe reicht nicht: Sonst koennten sich zwei
 * glatte Fronten gegenseitig abtragen, und nichts stuende je fest. So
 * traegt die Zahl die ganze Regel: Wer sein Land breit macht, hat hohe
 * Stufen und greift an; wer einen schmalen Vorstoss treibt, hat an dessen
 * Spitze eine niedrige und wird angegriffen.
 *
 * Gerechnet nach dem Stand der Karte, nicht nach dem laufenden Zettel: Ein
 * in dieser Runde gewaehltes freies Feld hat noch keine Stufe und dient
 * deshalb weder als Angriffsbasis noch als Weg dahinter (siehe pruefeWahl).
 * Und die Wahl des Gegners kennt diese Liste so wenig wie `waehlbare` — er
 * kann in derselben Runde das Feld angreifen, von dem aus man ihn angreift.
 */
export function angreifbare(partie: EilandPartie, sitz: number): number[] {
  if (partie.fertig) return [];
  if (partie.bereit[sitz]) return [];
  const gewaehlt = partie.wahl[sitz] ?? [];
  if (gewaehlt.length >= kontingent(partie, sitz)) return [];
  return angriffsziele(partie, sitz).filter((platz) => !gewaehlt.includes(platz));
}

/** Alle Angriffsziele nach Stand der Karte — ohne Ruecksicht auf Zettel und Kontingent. */
function angriffsziele(partie: EilandPartie, sitz: number): number[] {
  const { spalten, zeilen } = partie.regeln;
  const raus = new Set<number>();
  for (let platz = 0; platz < partie.besitzer.length; platz++) {
    if (partie.besitzer[platz] !== sitz) continue;
    const eigene = stufe(partie.besitzer, platz, spalten, zeilen) ?? 0;
    for (const n of nachbarn(platz, spalten, zeilen)) {
      const wem = partie.besitzer[n];
      if (wem === null || wem === sitz) continue;
      const fremde = stufe(partie.besitzer, n, spalten, zeilen) ?? 0;
      if (fremde < eigene) raus.add(n);
    }
  }
  return [...raus].sort((a, b) => a - b);
}

/** Die Heimat jedes Sitzes: seine Startecke. Faellt sie, ist die Partie aus. */
export function heimat(partie: EilandPartie): Record<number, number> {
  const { spalten, zeilen } = partie.regeln;
  const raus: Record<number, number> = {};
  for (const sitz of sitzeVon(partie)) raus[sitz] = startEcke(sitz, spalten, zeilen);
  return raus;
}

/** Sitze, deren Heimat nicht mehr ihnen gehoert. */
export function gefallene(partie: EilandPartie): number[] {
  const ecken = heimat(partie);
  return sitzeVon(partie).filter((sitz) => partie.besitzer[ecken[sitz]!] !== sitz);
}

/**
 * Hat dieser Sitz seinen Zettel abgegeben?
 *
 * Zwei Wege fuehren dahin: Er hat abgegeben, oder es gibt fuer ihn nichts
 * mehr zu waehlen — kein freies Feld und kein Angriff. Der zweite ist der
 * wichtige: Ohne ihn bliebe ein eingekesselter Spieler ewig "am Zug", und die
 * Partie stuende still, obwohl der andere noch Land vor sich hat.
 */
export function istBereit(partie: EilandPartie, sitz: number): boolean {
  if (partie.bereit[sitz]) return true;
  return waehlbare(partie, sitz).length === 0 && angreifbare(partie, sitz).length === 0;
}

/**
 * Wer noch handeln muss.
 *
 * Trotz Gleichzeitigkeit ein einzelner Sitz, und zwar der kleinste, der noch
 * nicht abgegeben hat: Daran haengen bei der Plattform die Zugzeit, die
 * Bot-Uebernahme nach einem Zeitablauf und die Verlassen-Regel (siehe
 * runtime/party.ts). Dass der andere in derselben Zeit ebenfalls handeln darf,
 * stoert sie nicht — sie prueft beim Handeln nur, dass jemand fuer den eigenen
 * Sitz zieht, und den Rest ueberlaesst sie diesem Modul.
 */
export function amZug(partie: EilandPartie): number | null {
  if (partie.fertig) return null;
  for (const sitz of sitzeVon(partie)) {
    if (!istBereit(partie, sitz)) return sitz;
  }
  return null;
}

/**
 * Immer leer — und das ist eine Aussage, kein Versehen.
 *
 * Eine Aktion ist hier eine MENGE von Feldern; sie aufzuzaehlen hiesse, alle
 * Kombinationen aus bis zu sechs der freien Felder aufzuzaehlen. Der
 * Bildschirm baut die Aktion deshalb selbst aus der Sicht — derselbe Weg,
 * den Skat (Druecken, Ansage) und der Doppelkopf (Armut) schon gehen, und
 * derselbe Grund. Was anwaehlbar ist, muss er trotzdem nicht raten: Es steht
 * als `waehlbar` in der Sicht, und `fuehreAus` prueft die fertige Auswahl
 * ohnehin noch einmal.
 *
 * Die Plattform kennt diesen Fall (`clientBautAktion` in
 * plattform-invarianten.test.ts): Bei leerer Liste darf auch der Bot eine
 * Aktion liefern, die nicht darin steht — und genau das braucht er, um seine
 * ganze Runde in EINEM Zug abzugeben statt in sechs.
 */
export function erlaubteZuege(_partie: EilandPartie, _sitz: number): EilandAktion[] {
  return [];
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------

/**
 * Prueft eine vollstaendige Auswahl — als Ganzes, nicht als letzten Schritt.
 *
 * Nach `waehlbare` ist das eine Doppelpruefung, und sie soll eine bleiben: Die
 * eine Stelle sagt, was man ANTIPPEN kann, diese hier, was am Ende auf dem
 * Zettel stehen DARF. Faellt eine der beiden je auseinander — etwa weil jemand
 * eine zweite Art zu waehlen einbaut —, faellt es hier auf und nicht erst in
 * der Aufloesung.
 */
function pruefeWahl(partie: EilandPartie, sitz: number, felder: readonly number[]): void {
  if (felder.length > kontingent(partie, sitz)) throw new Error('Zu viele Felder');
  const ziele = new Set<number>(angriffsziele(partie, sitz));
  const gesehen = new Set<number>();
  const frei: number[] = [];
  for (const platz of felder) {
    if (!Number.isInteger(platz) || platz < 0 || platz >= partie.gelaende.length) {
      throw new Error('Feld gibt es nicht');
    }
    if (gesehen.has(platz)) throw new Error('Feld doppelt gewaehlt');
    gesehen.add(platz);
    if (partie.gelaende[platz] !== GRAS) throw new Error('Kein Grasland');
    const wem = partie.besitzer[platz];
    if (wem === sitz) throw new Error('Feld gehoert schon dir');
    if (wem !== null) {
      // Fremdes Land geht nur als Angriff — und nur mit der hoeheren Stufe.
      if (!ziele.has(platz)) throw new Error('Feld laesst sich nicht angreifen');
      continue;
    }
    frei.push(platz);
  }

  /*
   * Zusammenhang: Jedes gewaehlte FREIE Feld muss vom eigenen Gebiet aus ueber
   * gewaehlte freie Felder erreichbar sein. Geprueft wird als Ganzes und nicht
   * in der Tippreihenfolge — sonst waere eine Auswahl je nach Reihenfolge der
   * Tipps mal gueltig und mal nicht, obwohl am Ende dasselbe dasteht.
   *
   * Angegriffene Felder zaehlen dabei nicht als Weg: Ein Angriff ist ein Ziel
   * und kein Sprungbrett. Sonst liesse sich in einer Runde ein fremdes Feld
   * nehmen UND das freie Land dahinter, und der Angriff waere ein Durchbruch
   * statt eines Feldes.
   */
  const { spalten, zeilen } = partie.regeln;
  const offen = new Set<number>(frei);
  const rand: number[] = [];
  for (let platz = 0; platz < partie.besitzer.length; platz++) {
    if (partie.besitzer[platz] === sitz) rand.push(platz);
  }
  while (rand.length > 0) {
    const platz = rand.pop()!;
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (!offen.has(n)) continue;
      offen.delete(n);
      rand.push(n);
    }
  }
  if (offen.size > 0) throw new Error('Feld grenzt nicht an das eigene Gebiet');
}

export function fuehreAus(
  partie: EilandPartie,
  sitz: number,
  aktion: EilandAktion,
): EilandPartie {
  if (partie.fertig) throw new Error('Partie ist zu Ende');
  if (partie.punkte[sitz] === undefined) throw new Error('Sitz gibt es nicht');
  /*
   * Ein zweiter Zettel ist keine Regelverletzung, sondern ein doppelter Tipp
   * oder eine Nachricht, die sich mit der Aufloesung ueberholt hat. Denselben
   * Zustand zurueckzugeben ist genau richtig: Die Plattform verbucht eine
   * wirkungslose Aktion nicht (siehe act in runtime/party.ts) und schickt
   * keinen Rundruf, der bei allen wie eine Aenderung aussaehe.
   */
  if (istBereit(partie, sitz)) return partie;

  if (aktion.typ !== 'plan') throw new Error('Unbekannte Aktion');
  if (!Array.isArray(aktion.felder)) throw new Error('Zettel ohne Felder');
  const neueWahl = [...aktion.felder];
  pruefeWahl(partie, sitz, neueWahl);

  const naechste: EilandPartie = {
    ...partie,
    wahl: { ...partie.wahl, [sitz]: neueWahl },
    bereit: { ...partie.bereit, [sitz]: true },
  };

  const alleFertig = sitzeVon(naechste).every((s) => istBereit(naechste, s));
  return alleFertig ? loeseAuf(naechste) : naechste;
}

/**
 * Die Runde aufloesen: verteilen, kaempfen, einsammeln, nachlegen.
 *
 * Die Reihenfolge ist nicht beliebig. Erst wird jedes umstrittene Feld
 * entschieden, danach erst geprueft, was davon ueberhaupt erreichbar bleibt —
 * andersherum haenge das Ergebnis eines Kampfes davon ab, welcher Kampf zuerst
 * gerechnet wurde.
 */
function loeseAuf(partie: EilandPartie): EilandPartie {
  const sitze = sitzeVon(partie);
  const { spalten, zeilen } = partie.regeln;

  /*
   * Ansprueche sammeln, sortiert nach PLATZ und nicht nach Eingang. Ein
   * Muenzwurf, der davon abhinge, wer zuerst getippt hat, waere ein
   * versteckter Vorteil fuer den Schnelleren — und genau der soll hier keine
   * Rolle spielen, sonst haetten wir kein gleichzeitiges Spiel, sondern ein
   * Wettrennen mit Zufallsanstrich.
   */
  const anspruch = new Map<number, number[]>();
  for (const sitz of sitze) {
    for (const platz of partie.wahl[sitz] ?? []) {
      const liste = anspruch.get(platz);
      if (liste) liste.push(sitz);
      else anspruch.set(platz, [sitz]);
    }
  }

  const zuteilung = new Map<number, number[]>(sitze.map((s) => [s, []]));
  const kaempfe: { platz: number; sieger: number; einsatz: number[] }[] = [];
  let kampfZeiger = partie.kampfZeiger;

  /**
   * Zufall aus dem Vorrat: `kaempfe` ist eine Liste von Muenzwuerfen (0/1),
   * und daraus kommen hier auch die Zahlen fuer die Reihenfolge — Bit fuer
   * Bit, mit Verwerfen statt Rest, damit kein Platz bevorzugt wird. Ein
   * zweiter Vorrat im Zustand haette eine Snapshot-Wanderung gekostet; die
   * Bits sind da, und der Zeiger wandert ohnehin.
   */
  const bit = (): number => {
    const wurf = partie.kaempfe[kampfZeiger % partie.kaempfe.length] ?? 0;
    kampfZeiger++;
    return wurf & 1;
  };
  const zahlUnter = (n: number): number => {
    if (n <= 1) return 0;
    const bits = Math.ceil(Math.log2(n));
    let wert = 0;
    for (let versuch = 0; versuch < 8; versuch++) {
      wert = 0;
      for (let i = 0; i < bits; i++) wert = (wert << 1) | bit();
      if (wert < n) return wert;
    }
    // Achtmal verworfen: praktisch nie. Dann eben der Rest, statt endlos zu ziehen.
    return wert % n;
  };

  /*
   * Der Einsatz. Was ein Sitz in dieser Runde nicht gesetzt hat, setzt er auf
   * die Streitfelder: je Streitfeld einen, solange der Vorrat reicht. Wer
   * allein einen Einsatz hat, gewinnt das Feld sicher; haben beide einen oder
   * keiner, entscheidet der Muenzwurf wie bisher. Gerechnet mit dem
   * Kontingent VON DIESER Runde — was das eingesammelte Ornament dazugibt,
   * zaehlt erst ab der naechsten. Der Einsatz verfaellt mit der Runde; ein
   * Vorrat ueber Runden hinweg waere eine zweite Waehrung, und die will das
   * Spiel nicht.
   */
  const reserve: Record<number, number> = {};
  for (const sitz of sitze) {
    reserve[sitz] = Math.max(0, kontingent(partie, sitz) - (partie.wahl[sitz] ?? []).length);
  }
  const reserveVorher = { ...reserve };

  const umstritten: number[] = [];
  for (const platz of [...anspruch.keys()].sort((a, b) => a - b)) {
    const bewerber = anspruch.get(platz)!;
    if (bewerber.length > 1) umstritten.push(platz);
    else zuteilung.get(bewerber[0]!)!.push(platz);
  }
  /*
   * Die Streitfelder in ZUFAELLIGER Reihenfolge, nicht nach Platznummer: Mit
   * einem Einsatz und zwei Streitfeldern entscheidet die Reihenfolge, welches
   * Feld der Einsatz gewinnt — nach Platznummer waere oben links immer das
   * sichere und unten rechts immer das unsichere Feld, und wer das weiss,
   * plant danach. Gemischt aus der Saat (Fisher-Yates ueber die Bits des
   * Vorrats), also fuer beide Sitze dieselbe Reihenfolge — und unabhaengig
   * davon, wer zuerst getippt hat.
   */
  for (let i = umstritten.length - 1; i > 0; i--) {
    const j = zahlUnter(i + 1);
    const merke = umstritten[i]!;
    umstritten[i] = umstritten[j]!;
    umstritten[j] = merke;
  }
  for (const platz of umstritten) {
    const bewerber = anspruch.get(platz)!.slice().sort((a, b) => a - b);
    const einsatz = bewerber.filter((s) => (reserve[s] ?? 0) > 0);
    for (const s of einsatz) reserve[s] = (reserve[s] ?? 0) - 1;
    let sieger: number;
    if (einsatz.length === 1) {
      sieger = einsatz[0]!;
    } else {
      // Der Muenzwurf. Fuenfzig zu fuenfzig, ohne Ruecksicht auf Gebietsgroesse
      // oder Anmarschweg: Es wird gekaempft, und ein Kampf hat keinen Favoriten.
      sieger = bewerber[bit() % bewerber.length]!;
    }
    kaempfe.push({ platz, sieger, einsatz });
    zuteilung.get(sieger)!.push(platz);
  }

  const besitzer = [...partie.besitzer];
  const ornament = [...partie.ornament];
  const bauwerk = [...partie.bauwerk];
  const punkte = { ...partie.punkte };
  const gesammelt = { ...partie.gesammelt };
  const genommen: Record<number, number[]> = {};
  const erobert: Record<number, number[]> = {};
  const verfallen: Record<number, number[]> = {};
  const ornamenteRunde: Record<number, number> = {};
  let wechsel = 0;
  let landGenommen = false;

  for (const sitz of sitze) {
    const zugesprochen = zuteilung.get(sitz) ?? [];
    /*
     * Erreichbar nach dem Stand VOR der Runde — fuer beide Sitze derselbe.
     * Nimmt Sitz 0 ein Feld von Sitz 1 und Sitz 1 zugleich das Feld, von dem
     * aus Sitz 0 angriff, gelingt beides: Angriffe sind gleichzeitig wie alles
     * andere hier, und wer zuerst gerechnet wird, darf keinen Unterschied
     * machen.
     */
    const erreichbar = erreichbareFelder(partie.besitzer, zugesprochen, sitz, spalten, zeilen);
    genommen[sitz] = erreichbar.filter((p) => partie.besitzer[p] === null);
    erobert[sitz] = erreichbar.filter((p) => partie.besitzer[p] !== null);
    verfallen[sitz] = zugesprochen.filter((p) => !erreichbar.includes(p));
    ornamenteRunde[sitz] = 0;
    for (const platz of erreichbar) {
      const vorher = partie.besitzer[platz];
      besitzer[platz] = sitz;
      punkte[sitz] = (punkte[sitz] ?? 0) + 1;
      wechsel++;
      if (vorher !== null && vorher !== undefined) {
        punkte[vorher] = (punkte[vorher] ?? 1) - 1;
        /*
         * Ein Bauwerk wechselt mit dem Feld den Besitzer — samt dem Feld mehr
         * je Runde, das es bringt. So bleibt wahr, was man am Brett abzaehlt:
         * Die Bauwerke auf meinem Land SIND mein Kontingent. Und ein Angriff
         * hat damit ein lohnendes Ziel, nicht nur ein Feld.
         */
        const bau = bauwerk[platz];
        if (bau !== null && bau !== undefined) {
          gesammelt[vorher] = Math.max(0, (gesammelt[vorher] ?? 0) - 1);
          gesammelt[sitz] = (gesammelt[sitz] ?? 0) + 1;
        }
        continue;
      }
      landGenommen = true;
      const zier = ornament[platz];
      if (zier !== null && zier !== undefined) {
        // Von der einen Liste in die andere: Das Ornament ist eingesammelt
        // und bleibt als Bauwerk auf dem Feld stehen (siehe EilandPartie).
        ornament[platz] = null;
        bauwerk[platz] = zier;
        gesammelt[sitz] = (gesammelt[sitz] ?? 0) + 1;
        ornamenteRunde[sitz]++;
      }
    }
  }

  // Nachlegen, bis das Soll wieder steht. Was eingesammelt wurde, ist damit
  // ersetzt — die Karte traegt in jeder Runde gleich viele Ziele.
  let zeiger = partie.nachschubZeiger;
  let liegen = ornament.filter((o) => o !== null).length;
  while (liegen < partie.regeln.ornamente) {
    const vorher = zeiger;
    zeiger = legeEines(
      partie.gelaende,
      ornament,
      besitzer,
      partie.nachschub,
      zeiger,
      partie.regeln,
    );
    // Der Zeiger bewegt sich nur, wenn tatsaechlich etwas gelegt wurde. Steht
    // er still, ist kein Platz mehr frei genug, und ein weiterer Durchlauf
    // liefe endlos.
    if (zeiger === vorher) break;
    liegen++;
  }

  const wahl: Record<number, readonly number[]> = {};
  const bereit: Record<number, boolean> = {};
  for (const sitz of sitze) {
    wahl[sitz] = [];
    bereit[sitz] = false;
  }

  const leerrunden = wechsel > 0 ? 0 : partie.leerrunden + 1;
  const kampfrunden = landGenommen ? 0 : partie.kampfrunden + 1;
  const jetzt = stellung(besitzer);
  const stellungen = landGenommen ? [jetzt] : [...partie.stellungen, jetzt];
  const wiederholt = stellungen.filter((s) => s === jetzt).length >= WIEDERHOLUNGEN_MAX;

  const naechste: EilandPartie = {
    ...partie,
    besitzer,
    ornament,
    bauwerk,
    punkte,
    gesammelt,
    nachschubZeiger: zeiger,
    kampfZeiger,
    wahl,
    bereit,
    runde: partie.runde + 1,
    leerrunden,
    kampfrunden,
    stellungen,
    letzte: {
      runde: partie.runde,
      kaempfe,
      reserve: reserveVorher,
      genommen,
      erobert,
      verfallen,
      ornamente: ornamenteRunde,
    },
  };

  /*
   * Zu Ende ist es auf vier Wegen. Der erste ist der Sieg: Eine Heimat ist
   * gefallen (siehe platzierungen — wer sie noch hat, steht vorn, egal wie
   * viel Land der andere haelt). Der zweite ist der Normalfall: Niemand kann
   * mehr irgendwo hin, weder auf freies Land noch auf fremdes. Der dritte
   * ist die Stellungswiederholung, der vierte sind die beiden Notbremsen.
   */
  const heimatGefallen = gefallene(naechste).length > 0;
  const keinerKann = sitze.every(
    (sitz) => waehlbare(naechste, sitz).length === 0 && angreifbare(naechste, sitz).length === 0,
  );
  return {
    ...naechste,
    fertig:
      heimatGefallen ||
      keinerKann ||
      wiederholt ||
      leerrunden >= LEERRUNDEN_MAX ||
      kampfrunden >= KAMPFRUNDEN_MAX,
  };
}

/**
 * Welche der zugesprochenen Felder tatsaechlich besetzt werden.
 *
 * Ein Vorstoss ueber mehrere Felder haengt an seinem ersten: Wer den Kampf um
 * das Feld direkt vor sich verliert, kommt an den dahinter nicht mehr heran —
 * die fallen zurueck ins Freie. Ohne diese Regel stuende nach einem verlorenen
 * Kampf eine abgetrennte Insel mitten im gegnerischen Land, und die
 * Zusammenhangsregel des Zuges waere nur noch eine Empfehlung.
 */
function erreichbareFelder(
  besitzer: readonly (number | null)[],
  zugesprochen: readonly number[],
  sitz: number,
  spalten: number,
  zeilen: number,
): number[] {
  const offen = new Set<number>(zugesprochen);
  const erreicht: number[] = [];
  const rand: number[] = [];
  for (let platz = 0; platz < besitzer.length; platz++) {
    if (besitzer[platz] === sitz) rand.push(platz);
  }
  while (rand.length > 0) {
    const platz = rand.pop()!;
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (!offen.has(n)) continue;
      offen.delete(n);
      erreicht.push(n);
      // Ein erobertes Feld ist ein Ziel, kein Weg (siehe pruefeWahl): Was
      // dahinter liegt, muss ueber freie Felder erreichbar sein.
      if (besitzer[n] === null) rand.push(n);
    }
  }
  return erreicht.sort((a, b) => a - b);
}

export function markiereVerlassen(partie: EilandPartie, sitz: number): EilandPartie {
  if (partie.leftSeats.includes(sitz)) return partie;
  return { ...partie, leftSeats: [...partie.leftSeats, sitz] };
}

// ---------------------------------------------------------------------------
// Wertung
// ---------------------------------------------------------------------------

/**
 * Platzierungen.
 *
 * Zuerst zaehlt die Heimat: Wer seine Startecke noch hat, steht vor jedem,
 * der sie verloren hat — auch mit weniger Land. Das ist die Siegbedingung
 * seit dem 5. September, und sie steht HIER und nicht als eigener Merker im
 * Zustand, damit `points` (das Land) unveraendert die Erfahrungspunkte
 * tragen kann. Erst danach entscheidet das Land.
 *
 * Gleichstand ergibt zweimal Platz 1. Anders als bei einem Kartenspiel ist das
 * hier ein realistischer Ausgang: Auf einer punktsymmetrischen Karte koennen
 * zwei gleich gute Spieler tatsaechlich gleich viel Land halten — und wenn
 * beide in derselben Runde die Heimat des anderen nehmen, sind beide gefallen.
 */
export function platzierungen(
  partie: EilandPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const gefallen = new Set(gefallene(partie));
  const reihe = sitzeVon(partie)
    .map((seat) => ({
      seat,
      points: partie.punkte[seat] ?? 0,
      left: partie.leftSeats.includes(seat),
      steht: !gefallen.has(seat),
    }))
    .sort((a, b) => Number(b.steht) - Number(a.steht) || b.points - a.points);

  let platz = 0;
  let vorher: { steht: boolean; points: number } | null = null;
  return reihe.map((eintrag, index) => {
    if (vorher === null || eintrag.steht !== vorher.steht || eintrag.points !== vorher.points) {
      platz = index + 1;
      vorher = eintrag;
    }
    return { seat: eintrag.seat, points: eintrag.points, left: eintrag.left, place: platz };
  });
}

/** Sieger, oder null bei Gleichstand bzw. laufender Partie. */
export function sieger(partie: EilandPartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster || !zweiter) return null;
  return erster.place === zweiter.place ? null : erster.seat;
}
