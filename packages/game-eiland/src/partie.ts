/**
 * Spielzustand und Regeln von Eiland.
 *
 * Reine Logik: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser dem
 * uebergebenen Seed (game-api, Grundsatz 1).
 *
 * Das Spiel: Zwei Spieler, eine Karte aus Gras, Seen und Bergen. Jeder startet
 * auf einer Ecke und nimmt je Runde ein Feld ein, das an sein Gebiet grenzt —
 * und ein Feld mehr fuer jedes Ornament, das er eingesammelt hat. Wasser und
 * Berge gehoeren niemandem, gegnerisches Gebiet ist unantastbar. Zu Ende ist
 * es, wenn keiner mehr irgendwo hin kann; es gewinnt, wer mehr Felder haelt.
 *
 * Zwei Dinge unterscheiden es von allem anderen im Haus:
 *
 *   1. GLEICHZEITIG. Beide waehlen ihre Felder, ohne die Wahl des anderen zu
 *      sehen; erst wenn beide bereit sind, wird aufgeloest. Wollen beide
 *      dasselbe Feld, entscheidet ein Muenzwurf — es wird gekaempft, und ein
 *      Kampf hat keinen Favoriten.
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
  type Saat,
  WASSER,
  abstand,
  baueKarte,
  baueZufall,
  mischeplaetze,
  nachbarn,
  spiegel,
  startEcke,
} from './karte.js';
import type { EilandRegeln } from './regeln.js';

export { BERG, GRAS, WASSER, nachbarn, startEcke };

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

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/** Was in einer Runde geschehen ist. Der Client zeichnet es nach. */
export interface EilandAusgang {
  readonly runde: number;
  /** Felder, die beide wollten, samt Gewinner des Muenzwurfs. */
  readonly kaempfe: readonly { readonly platz: number; readonly sieger: number }[];
  /** Was jeder Sitz tatsaechlich bekommen hat. */
  readonly genommen: Readonly<Record<number, readonly number[]>>;
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
  /** Ausgang der letzten Runde, fuer die Anzeige. */
  readonly letzte: EilandAusgang | null;
  readonly leftSeats: readonly number[];
  readonly fertig: boolean;
}

export type EilandAktion =
  /** Ein Feld zur eigenen Auswahl legen. */
  | { readonly typ: 'waehlen'; readonly platz: number }
  /** Das zuletzt gewaehlte Feld wieder herausnehmen. */
  | { readonly typ: 'zuruecknehmen' }
  /** Zettel abgeben, auch mit weniger Feldern als erlaubt. */
  | { readonly typ: 'bereit' };

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
    regeln,
    gelaende,
    grau,
    besitzer,
    ornament,
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
    letzte: null,
    leftSeats: [],
    fertig: false,
  };
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
 * Hat dieser Sitz seinen Zettel abgegeben?
 *
 * Drei Wege fuehren dahin: Er hat "bereit" getippt, seine Auswahl ist voll,
 * oder es gibt nichts mehr zu waehlen. Der dritte ist der wichtige — ohne ihn
 * bliebe ein eingekesselter Spieler ewig "am Zug", und die Partie stuende
 * still, obwohl der andere noch Land vor sich hat.
 */
export function istBereit(partie: EilandPartie, sitz: number): boolean {
  if (partie.bereit[sitz]) return true;
  const gewaehlt = partie.wahl[sitz] ?? [];
  if (gewaehlt.length >= kontingent(partie, sitz)) return true;
  return waehlbare(partie, sitz).length === 0;
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

export function erlaubteZuege(partie: EilandPartie, sitz: number): EilandAktion[] {
  if (partie.fertig) return [];
  if (istBereit(partie, sitz)) return [];
  const zuege: EilandAktion[] = waehlbare(partie, sitz).map((platz) => ({
    typ: 'waehlen' as const,
    platz,
  }));
  if ((partie.wahl[sitz] ?? []).length > 0) zuege.push({ typ: 'zuruecknehmen' });
  zuege.push({ typ: 'bereit' });
  /*
   * Diese Liste ist vollstaendig — es gibt keine Aktion, die ein Sitz
   * ausfuehren darf und die hier fehlt. Eine Aktion "ganze Auswahl auf einmal"
   * gab es beim Bau, sie ist wieder herausgeflogen: Die Plattform prueft, dass
   * jede Bot-Aktion in `legalActions` steht (plattform-invarianten.test.ts),
   * und aufzaehlen liesse sich so eine Aktion nur als Liste aller
   * Feldkombinationen.
   */
  return zuege;
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
  const gesehen = new Set<number>();
  for (const platz of felder) {
    if (!Number.isInteger(platz) || platz < 0 || platz >= partie.gelaende.length) {
      throw new Error('Feld gibt es nicht');
    }
    if (gesehen.has(platz)) throw new Error('Feld doppelt gewaehlt');
    gesehen.add(platz);
    if (partie.gelaende[platz] !== GRAS) throw new Error('Kein Grasland');
    if (partie.besitzer[platz] !== null) throw new Error('Feld gehoert schon jemandem');
  }

  /*
   * Zusammenhang: Jedes gewaehlte Feld muss vom eigenen Gebiet aus ueber
   * gewaehlte Felder erreichbar sein. Geprueft wird als Ganzes und nicht in
   * der Tippreihenfolge — sonst waere eine Auswahl je nach Reihenfolge der
   * Tipps mal gueltig und mal nicht, obwohl am Ende dasselbe dasteht.
   */
  const { spalten, zeilen } = partie.regeln;
  const offen = new Set<number>(felder);
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
   * Ein zweites "bereit" ist keine Regelverletzung, sondern ein doppelter
   * Tipp oder eine Nachricht, die sich mit der Aufloesung ueberholt hat.
   * Denselben Zustand zurueckzugeben ist genau richtig: Die Plattform
   * verbucht eine wirkungslose Aktion nicht (siehe act in runtime/party.ts)
   * und schickt keinen Rundruf, der bei allen wie eine Aenderung aussaehe.
   */
  if (istBereit(partie, sitz) && aktion.typ !== 'zuruecknehmen') return partie;

  const gewaehlt = partie.wahl[sitz] ?? [];
  let neueWahl: readonly number[];
  let abgeben = false;

  switch (aktion.typ) {
    case 'waehlen': {
      if (!waehlbare(partie, sitz).includes(aktion.platz)) {
        throw new Error('Feld ist nicht waehlbar');
      }
      neueWahl = [...gewaehlt, aktion.platz];
      pruefeWahl(partie, sitz, neueWahl);
      break;
    }
    case 'zuruecknehmen': {
      /*
       * Zurueck geht es nur, solange der Zettel offen ist. Wer sein
       * Kontingent ausgeschoepft hat, hat abgegeben — auch ohne "bereit" zu
       * tippen. Das ist die Gegenleistung dafuer, dass eine volle Auswahl
       * ohne zusaetzlichen Tipp gilt: Sonst waere jede Runde ein Tipp
       * laenger, und bei einem Kontingent von eins waeren es doppelt so
       * viele.
       */
      if (istBereit(partie, sitz)) throw new Error('Zettel ist schon abgegeben');
      if (gewaehlt.length === 0) throw new Error('Nichts zurueckzunehmen');
      neueWahl = gewaehlt.slice(0, -1);
      break;
    }
    case 'bereit': {
      neueWahl = gewaehlt;
      abgeben = true;
      break;
    }
    default:
      throw new Error('Unbekannte Aktion');
  }

  const naechste: EilandPartie = {
    ...partie,
    wahl: { ...partie.wahl, [sitz]: neueWahl },
    bereit: { ...partie.bereit, [sitz]: abgeben || partie.bereit[sitz] === true },
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
  const kaempfe: { platz: number; sieger: number }[] = [];
  let kampfZeiger = partie.kampfZeiger;

  for (const platz of [...anspruch.keys()].sort((a, b) => a - b)) {
    const bewerber = anspruch.get(platz)!.slice().sort((a, b) => a - b);
    let sieger = bewerber[0]!;
    if (bewerber.length > 1) {
      // Der Muenzwurf. Fuenfzig zu fuenfzig, ohne Ruecksicht auf Gebietsgroesse
      // oder Anmarschweg: Es wird gekaempft, und ein Kampf hat keinen Favoriten.
      const wurf = partie.kaempfe[kampfZeiger % partie.kaempfe.length] ?? 0;
      kampfZeiger++;
      sieger = bewerber[wurf % bewerber.length]!;
      kaempfe.push({ platz, sieger });
    }
    zuteilung.get(sieger)!.push(platz);
  }

  const besitzer = [...partie.besitzer];
  const ornament = [...partie.ornament];
  const punkte = { ...partie.punkte };
  const gesammelt = { ...partie.gesammelt };
  const genommen: Record<number, number[]> = {};
  const verfallen: Record<number, number[]> = {};
  const ornamenteRunde: Record<number, number> = {};
  let wechsel = 0;

  for (const sitz of sitze) {
    const zugesprochen = zuteilung.get(sitz) ?? [];
    const erreichbar = erreichbareFelder(partie.besitzer, zugesprochen, sitz, spalten, zeilen);
    genommen[sitz] = erreichbar;
    verfallen[sitz] = zugesprochen.filter((p) => !erreichbar.includes(p));
    ornamenteRunde[sitz] = 0;
    for (const platz of erreichbar) {
      besitzer[platz] = sitz;
      punkte[sitz] = (punkte[sitz] ?? 0) + 1;
      wechsel++;
      if (ornament[platz] !== null) {
        ornament[platz] = null;
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

  const naechste: EilandPartie = {
    ...partie,
    besitzer,
    ornament,
    punkte,
    gesammelt,
    nachschubZeiger: zeiger,
    kampfZeiger,
    wahl,
    bereit,
    runde: partie.runde + 1,
    leerrunden,
    letzte: {
      runde: partie.runde,
      kaempfe,
      genommen,
      verfallen,
      ornamente: ornamenteRunde,
    },
  };

  /*
   * Zu Ende ist es, wenn niemand mehr irgendwo hin kann. Das ist der
   * Normalfall und die einzige Bedingung, die man am Brett auch sieht: Was
   * frei geblieben ist, ist von keinem Gebiet aus zu erreichen.
   */
  const keinerKann = sitze.every((sitz) => waehlbare(naechste, sitz).length === 0);
  return { ...naechste, fertig: keinerKann || leerrunden >= LEERRUNDEN_MAX };
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
      rand.push(n);
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
 * Gleichstand ergibt zweimal Platz 1. Anders als bei einem Kartenspiel ist das
 * hier ein realistischer Ausgang: Auf einer punktsymmetrischen Karte koennen
 * zwei gleich gute Spieler tatsaechlich gleich viel Land halten.
 */
export function platzierungen(
  partie: EilandPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const reihe = sitzeVon(partie)
    .map((seat) => ({
      seat,
      points: partie.punkte[seat] ?? 0,
      left: partie.leftSeats.includes(seat),
    }))
    .sort((a, b) => b.points - a.points);

  let platz = 0;
  let letztePunkte: number | null = null;
  return reihe.map((eintrag, index) => {
    if (letztePunkte === null || eintrag.points !== letztePunkte) {
      platz = index + 1;
      letztePunkte = eintrag.points;
    }
    return { ...eintrag, place: platz };
  });
}

/** Sieger, oder null bei Gleichstand bzw. laufender Partie. */
export function sieger(partie: EilandPartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster || !zweiter) return null;
  return erster.points === zweiter.points ? null : erster.seat;
}
