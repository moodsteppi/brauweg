/**
 * Synergien — die Marken-Boni von Tafelrunde (Phase 3 des Konzepts).
 *
 * Jede Einheit traegt ein bis zwei Marken (katalog.ts). Je mehr Einheiten
 * einer Marke auf dem eigenen BRETT stehen, desto staerker der Bonus, mit
 * Schwellen bei 2, 3 und 5. Die Bank zaehlt nicht: Was dort liegt, kaempft
 * nicht, und ein Bonus fuer Einheiten, die zusehen, waere ein Anreiz, die
 * Bank vollzustopfen statt aufzustellen.
 *
 * Was jede Marke bekommt, steht als DATEN in `SYNERGIEN` und nicht in
 * Bedingungen: Wer balanciert, aendert eine Zahl in der Tabelle und keine
 * Verzweigung. Der Bildschirm bekommt dieselbe Tabelle einmal mit der Sicht
 * (sicht.ts), damit er "bei 3: +25 % Angriff" anzeigen kann, ohne die Zahlen
 * selbst zu kennen — sonst gaebe es zwei Wahrheiten ueber jeden Bonus.
 *
 * Der Bonus gilt nur fuer die TRAEGER der Marke, nicht fuer das ganze Brett:
 * Vier Krieger machen die Krieger haerter, nicht den Magier daneben. Eine
 * Einheit mit zwei Marken zaehlt fuer beide und bekommt auch beide Boni —
 * das ist ihr Vorzug gegenueber einer Einheit mit nur einer Marke bei sonst
 * gleichen Werten.
 *
 * Gezaehlt werden EINHEITEN, nicht verschiedene Einheiten: Zwei Dorfwachen
 * sind zwei Krieger. Andere Spiele zaehlen nur Verschiedene; hier ginge das
 * nicht auf, weil der Katalog fuer Drache nur zwei und fuer Untot nur vier
 * Einheiten kennt — die oberen Schwellen waeren dort unerreichbar, die Marke
 * tot. Kopien zaehlen zu lassen hat ausserdem einen Preis, den der Spieler
 * abwaegen muss: Drei Kopien verschmelzen zu einer, und die zaehlt einfach.
 *
 * Reine Funktionen, kein Zustand, nichts wird veraendert.
 */

import {
  type EinheitId,
  type Marke,
  type Wertebonus,
  KEIN_BONUS,
  MARKEN,
  einheit,
} from './katalog.js';

/**
 * Die drei Schwellen.
 *
 * ZWEI, DREI UND FUENF SEIT DEM 05.09.2026 — das Konzept nannte 2/4/6, und
 * die beiden oberen Zahlen waren praktisch unerreichbar. Der Grund ist
 * arithmetisch und nicht eine Frage des Spielstils: Ein Brett fasst so viele
 * Einheiten, wie der Sitz Level hat (`LEVEL_TABELLE` in regeln.ts), und ueber
 * 400 gemessene Partien zu viert steht ein Bot in 21 % der Antritte auf Level
 * 4, in 2,5 % auf Level 5 und in 0,04 % auf Level 6. Sechs Traeger einer Marke
 * verlangen mindestens Level 6 — die Schwelle 6 war damit in 5.000 Partien
 * KEIN EINZIGES MAL zu halten, und die Schwelle 4 in 1,2 % der Antritte.
 *
 * ZUERST WURDE DER BOT GEPRUEFT und nicht die Tabelle geaendert, denn eine
 * Schwelle, auf die niemand hinspielt, sagt ueber ihre Hoehe nichts. Mit einem
 * echten Markengewicht (bot.ts, `heerStaerke`) stieg die Schwelle 4 von 1,2 %
 * auf 11,2 % — die Sechs blieb bei 6 von 75.096 Antritten. Erst DANACH war
 * entscheidbar, dass die Zahlen selbst zu hoch stehen.
 *
 * Heute: 80,0 % / 42,4 % / 0,9 % (5.000 Partien zu viert), auf der zweiten
 * Saatbasis 79,9 % / 42,1 % / 1,0 %. Die hoechste Schwelle bleibt selten, und
 * das soll sie auch sein — aber sie kommt vor, und die Probe in
 * test/ausgewogenheit.test.ts prueft sie wieder.
 *
 * WER SIE WIEDER VERSCHIEBT, misst vorher die Levelverteilung: Solange ein
 * Brett drei bis fuenf Felder hat, ist jede Schwelle darueber Zierde.
 */
export type Schwelle = number;

/**
 * Die VORGABE der Schwellen. Seit dem 27.11.2026 hat jede Marke ihre eigenen
 * (in `stufen` der Tabelle), weil eine Einheit nur noch EINMAL zaehlt (siehe
 * `zaehleMarken`): Eine Marke mit vier verschiedenen Traegern kann die Fuenf
 * nie erreichen. Robins Entscheidung: Schwellen je Marke so, wie ihre
 * Traegerzahl sie hergibt.
 */
export const SCHWELLEN: readonly Schwelle[] = [2, 3, 5];

/** Die Schwellen einer Marke, aufsteigend. */
export function schwellenVon(marke: Marke): readonly Schwelle[] {
  return synergie(marke).stufen.map((s) => s.schwelle);
}

/**
 * Der sichtbare Effekt einer Marke im Kampf (seit dem 27.11.2026, Robins
 * Entscheidung: "je Marke ein Effekt" statt reiner Zahlen). Was er genau
 * tut, rechnet kampf.ts; hier steht nur, WIE STARK er auf dieser Stufe ist.
 *
 * Zeiten in Spielsekunden, wie bei den Faehigkeiten (faehigkeiten.ts).
 */
export type Markeneffekt =
  /** Unter halbem Leben schlagen die Traeger haerter zu. */
  | { readonly art: 'kampfgeist'; readonly angriffProzent: number }
  /** Zu Kampfbeginn ein Schild ueber einen Teil des Lebens. */
  | { readonly art: 'schutzschild'; readonly lebenProzent: number }
  /** Laufend etwas Leben zurueck, je Spielsekunde. */
  | { readonly art: 'wachstum'; readonly lebenProzentJeSek: number }
  /** Kampfbeginn mit so viel Prozent des vollen Manas. */
  | { readonly art: 'aufgeladen'; readonly manaProzent: number }
  /** Der erste fallende Traeger der Seite steht mit so viel Leben wieder auf. */
  | { readonly art: 'wiederkehr'; readonly lebenProzent: number }
  /** Treffer setzen Brand: je Spielsekunde ein Teil des Angriffs, so lange. */
  | { readonly art: 'glut'; readonly angriffProzentJeSek: number; readonly sek: number }
  /** Zu Kampfbeginn hinter die gegnerischen Linien springen. */
  | { readonly art: 'hinterhalt' };

/** Eine Stufe einer Synergie: ab wie vielen Traegern was gilt. */
export interface Synergiestufe {
  readonly schwelle: Schwelle;
  /**
   * Der Zahlenanteil, der im Kampf WIRKLICH auf die Werte kommt. Seit dem
   * 27.11.2026 klein: Die Hauptsache ist der Effekt.
   */
  readonly bonus: Wertebonus;
  readonly effekt: Markeneffekt;
  /** Was diese Stufe tut, als ein Satz fuer das Pop-up der Marke. */
  readonly text: string;
  /**
   * WIE VIEL DIE STUFE DEM BOT WERT IST, ausgedrueckt als Wertebonus.
   *
   * Das sind die Zahlen, die bis zum 27.11.2026 im Kampf wirkten, und sie
   * bleiben mit Absicht: Der Bot (bot.ts) rechnet nur mit Werten und kennt
   * keine Effekte. Diese Zahlen sind in ueber zehn Messreihen auf ihn
   * abgestimmt (siehe die Kommentare an den Marken); ein Bot, der den neuen
   * Effekt gar nicht saehe, kaufte die Marken nicht mehr, und die Probe
   * test/ausgewogenheit.test.ts saehe nur noch Zufallsbretter.
   */
  readonly schaetzung: Wertebonus;
}

export interface Synergie {
  readonly marke: Marke;
  /**
   * Deutscher Anzeigename. Wie die Einheitennamen Inhalt des Spiels und
   * deshalb hier und nicht in der i18n des Clients (siehe katalog.ts).
   */
  readonly name: string;
  /**
   * Ein Satz, was die Marke bewirkt — fuer das Blatt, das der Bildschirm
   * beim Antippen eines Markenzeichens aufschlaegt.
   *
   * Er steht HIER und nicht im Client, aus demselben Grund wie der Name:
   * Was eine Marke tut, ist Inhalt des Spiels. Wer die Boni in der Tabelle
   * darunter umstellt, aendert den Satz im selben Zug mit — stuende er im
   * Bildschirm, verspraeche er ab da etwas anderes, als das Modul rechnet.
   *
   * Er nennt ausdruecklich die TRAEGER und nicht "alle Verbuendeten": Der
   * Bonus gilt nur fuer die Einheiten mit dieser Marke (siehe Kopf), und
   * genau das ist die Verwechslung, die eine Aufstellung kostet.
   */
  readonly wirkung: string;
  /** Aufsteigend nach Schwelle, genau eine je Schwelle aus `SCHWELLEN`. */
  readonly stufen: readonly Synergiestufe[];
}

function bonus(teil: Partial<Wertebonus>): Wertebonus {
  return { ...KEIN_BONUS, ...teil };
}

/**
 * Die Tabelle. Jede Marke hat ihre eigene Art von Bonus, damit sich zwei
 * Aufstellungen verschieden ANFUEHLEN und nicht nur verschieden rechnen:
 *
 *   Krieger    — Ruestung: die Linie haelt.
 *   Elementar  — Angriff: Magie trifft haerter.
 *   Meuchler   — Tempo: schneller als der Gegner reagieren kann.
 *   Waechter   — Leben und etwas Ruestung: die Mauer.
 *   Naturwesen — Leben: der Wald waechst nach (Traeger sind Astschuetze,
 *                Moosheiler, Hainwaechterin, Wurzelriese und seit dem
 *                18.09.2026 die Bogenmeisterin — sie kam dazu, WEIL an diesen
 *                Zahlen zu drehen gemessen nichts brachte, siehe dort).
 *   Untot      — Angriff und Leben, beides massvoll: zaeh und unerbittlich
 *                (Traeger sind Knochenspaeher, Grabfuerstin und seit dem
 *                05.09.2026 der Schildknappe — mit ihm ist die Marke zum
 *                ersten Mal ohne zwei Kopien derselben Einheit zu haben).
 *   Drache     — Angriff und Tempo, massvoll: selten und deshalb teuer erkauft
 *                (Traeger sind Drachenkind und Funkenlehrling; zwei Einheiten
 *                sind schon die erste Schwelle).
 *
 * Die Zahlen sind ein erster Wurf und zum Nachjustieren gedacht, wie die
 * Grundwerte im Katalog. Prozent bei Leben, Angriff und Tempo, feste Punkte
 * bei Ruestung — warum, steht bei `Wertebonus` in katalog.ts.
 *
 * AM 05.09.2026 MIT DEN SCHWELLEN MITGEZOGEN, und zwar so, dass der Bonus JE
 * TRAEGER ungefaehr gleich bleibt: Wo vier Krieger +20 Ruestung gaben, geben
 * jetzt drei +15, und wo sechs +30 gaben, geben fuenf +25. Haette man die
 * alten Zahlen auf die neuen Schwellen gesetzt, waere jede Synergie um ein
 * Drittel billiger geworden — gemessen stieg damit die Spielzeit von 8:24 auf
 * 8:55 im Median, und jeder sechste Kampf lief in die Hoechstdauer statt jeder
 * elfte (16,5 % gegen 9,6 %). Die Ruestungsboni sind daran schuld: Sie
 * verlaengern jeden Kampf doppelt, weil beide Seiten laenger stehen.
 */
export const SYNERGIEN: readonly Synergie[] = [
  {
    marke: 'krieger',
    name: 'Krieger',
    wirkung:
      'Krieger auf dem Brett tragen etwas mehr Rüstung und schlagen unter halbem Leben härter zu.',
    stufen: [
      {
        schwelle: 2,
        bonus: bonus({ ruestung: 8 }),
        effekt: { art: 'kampfgeist', angriffProzent: 25 },
        text: '+8 Rüstung, unter halbem Leben +25 % Angriff.',
        schaetzung: bonus({ ruestung: 10 }),
      },
      {
        schwelle: 3,
        bonus: bonus({ ruestung: 12 }),
        effekt: { art: 'kampfgeist', angriffProzent: 35 },
        text: '+12 Rüstung, unter halbem Leben +35 % Angriff.',
        schaetzung: bonus({ ruestung: 15 }),
      },
      {
        schwelle: 5,
        bonus: bonus({ ruestung: 18 }),
        effekt: { art: 'kampfgeist', angriffProzent: 55 },
        text: '+18 Rüstung, unter halbem Leben +55 % Angriff.',
        schaetzung: bonus({ ruestung: 25 }),
      },
    ],
  },
  {
    marke: 'elementar',
    name: 'Elementar',
    wirkung:
      'Elementarwesen schlagen etwas härter zu und starten mit Mana, ihre Fähigkeit kommt früher.',
    /*
     * DIESE ZAHLEN WAREN NICHT SCHULD, als Elementar am 05.09.2026 bei x0,25
     * stand — wer das nachsehen will, misst es nach: Mit Bonus NULL blieb die
     * Siegquote bei 6,1 % statt 6,0 %. Ein Angriffsbonus traegt nur, wenn
     * seine Traeger lange genug stehen, um ihn auszuspielen, und genau das
     * konnten sie nicht. Repariert wurde deshalb der Katalog (Irrlicht,
     * Funkenlehrling, Frostweberin, Sturmrufer), nicht diese Tabelle.
     *
     * HEUTE GILT DER SATZ DARUEBER NICHT MEHR, und zwar wegen der Reparatur,
     * die er beschreibt (Nachtrag 21.09.2026, zwoelfte Messung). Seit das
     * Irrlicht in der Vorderreihe steht, stehen die Traeger lange genug — und
     * der Bonus traegt: Auf null gesetzt faellt Elementar von x0,80 auf x0,49
     * (zweite Saatbasis x0,72 auf x0,37), auf 25/40/65 gehoben steigt es auf
     * x1,13. Je 1.500 Partien zu viert, beide Saatbasen gleich.
     *
     * WER HIER ETWAS AENDERN WILL, SCHEITERT TROTZDEM WOANDERS: Die Indizes
     * sind Verhaeltnisse zum Schnitt, und jede Anhebung nimmt es der
     * untersten Zeile ab. Meuchler faellt dabei von x0,64 auf x0,59 (auf der
     * Saatbasis der Probe sogar auf x0,45, wo test/ausgewogenheit.test.ts nur
     * noch der zugestandene Standardfehler gruen haelt). Elementar reisst mit
     * x0,77 keine Schranke; geaendert wurde deshalb nichts. Die vollstaendige
     * Rechnung steht in docs/spiele/auto-battler-konzept.md.
     */
    stufen: [
      {
        schwelle: 2,
        bonus: bonus({ angriffProzent: 5 }),
        effekt: { art: 'aufgeladen', manaProzent: 30 },
        text: '+5 % Angriff, Kampfbeginn mit 30 % Mana.',
        schaetzung: bonus({ angriffProzent: 15 }),
      },
      {
        schwelle: 3,
        bonus: bonus({ angriffProzent: 10 }),
        effekt: { art: 'aufgeladen', manaProzent: 50 },
        text: '+10 % Angriff, Kampfbeginn mit 50 % Mana.',
        schaetzung: bonus({ angriffProzent: 25 }),
      },
      {
        schwelle: 5,
        bonus: bonus({ angriffProzent: 15 }),
        effekt: { art: 'aufgeladen', manaProzent: 80 },
        text: '+15 % Angriff, Kampfbeginn mit 80 % Mana.',
        schaetzung: bonus({ angriffProzent: 40 }),
      },
    ],
  },
  {
    marke: 'meuchler',
    name: 'Meuchler',
    wirkung:
      'Meuchler sind schneller, härter und zäher, und wer im Nahkampf kämpft, springt zu Kampfbeginn hinter die gegnerischen Linien.',
    stufen: [
      {
        schwelle: 2,
        bonus: bonus({ tempoProzent: 15, angriffProzent: 10, lebenProzent: 15 }),
        effekt: { art: 'hinterhalt' },
        text: '+15 % Tempo, +10 % Angriff, +15 % Leben, Nahkämpfer springen nach hinten.',
        schaetzung: bonus({ tempoProzent: 15 }),
      },
      {
        schwelle: 3,
        bonus: bonus({ tempoProzent: 25, angriffProzent: 15, lebenProzent: 20 }),
        effekt: { art: 'hinterhalt' },
        text: '+25 % Tempo, +15 % Angriff, +20 % Leben, Nahkämpfer springen nach hinten.',
        schaetzung: bonus({ tempoProzent: 25 }),
      },
      {
        schwelle: 4,
        bonus: bonus({ tempoProzent: 40, angriffProzent: 25, lebenProzent: 30 }),
        effekt: { art: 'hinterhalt' },
        text: '+40 % Tempo, +25 % Angriff, +30 % Leben, Nahkämpfer springen nach hinten.',
        schaetzung: bonus({ tempoProzent: 40 }),
      },
    ],
  },
  {
    marke: 'waechter',
    name: 'Wächter',
    wirkung:
      'Wächter bekommen etwas mehr Leben und zu Kampfbeginn einen Schutzschild.',
    stufen: [
      {
        schwelle: 2,
        bonus: bonus({ lebenProzent: 5 }),
        effekt: { art: 'schutzschild', lebenProzent: 8 },
        text: '+5 % Leben, Schild über 8 % des Lebens.',
        schaetzung: bonus({ lebenProzent: 10, ruestung: 5 }),
      },
      {
        schwelle: 4,
        bonus: bonus({ lebenProzent: 8 }),
        effekt: { art: 'schutzschild', lebenProzent: 13 },
        text: '+8 % Leben, Schild über 13 % des Lebens.',
        schaetzung: bonus({ lebenProzent: 15, ruestung: 8 }),
      },
      {
        schwelle: 6,
        bonus: bonus({ lebenProzent: 12 }),
        effekt: { art: 'schutzschild', lebenProzent: 20 },
        text: '+12 % Leben, Schild über 20 % des Lebens.',
        schaetzung: bonus({ lebenProzent: 25, ruestung: 15 }),
      },
    ],
  },
  {
    marke: 'naturwesen',
    name: 'Naturwesen',
    wirkung:
      'Naturwesen bekommen etwas mehr Leben und heilen sich im Kampf laufend selbst.',
    /*
     * AUCH DIESE ZAHLEN WAREN NICHT SCHULD, als Naturwesen am 18.09.2026 mit
     * x0,52 die unterste Zeile des Katalogs war — dieselbe Geschichte wie bei
     * Elementar darueber, und wieder nachgemessen: Auf 25/40/65 gehoben kam die
     * Marke auf x0,62, auf 45/70/110 auf x0,87 — um den Preis, dass sich die an
     * der Hoechstdauer abgebrochenen Kaempfe verdoppelten (1,7 auf 3,4 %) und
     * Untot unter die Zaehlschwelle der Probe rutschte. Ein Lebensbonus macht
     * die Marke haeufiger, nicht besser. Repariert wurde deshalb der Katalog
     * (Bogenmeisterin als fuenfte Traegerin), nicht diese Tabelle.
     *
     * DAS GILT FUER EINEN LEBENSBONUS UND NICHT FUER JEDEN (Nachtrag
     * 21.09.2026): Bei Elementar und Drache geht der Bonus auf Angriff und
     * Tempo, und dort traegt er — dieselbe Anhebung hebt die Marke UND kuerzt
     * die Uhr, statt sie zu verlaengern (siehe oben bei 'elementar'). Mehr
     * Leben laesst beide Seiten laenger stehen, mehr Angriff beendet den
     * Kampf frueher. Wer die naechste Marke ansieht, fragt zuerst, WORAUF
     * ihr Bonus geht, und uebernimmt nicht die Antwort dieser Zeile.
     */
    stufen: [
      {
        schwelle: 2,
        bonus: bonus({ lebenProzent: 5 }),
        effekt: { art: 'wachstum', lebenProzentJeSek: 0.6 },
        text: '+5 % Leben, heilen 0,6 % je Sekunde.',
        schaetzung: bonus({ lebenProzent: 15 }),
      },
      {
        schwelle: 3,
        bonus: bonus({ lebenProzent: 8 }),
        effekt: { art: 'wachstum', lebenProzentJeSek: 0.9 },
        text: '+8 % Leben, heilen 0,9 % je Sekunde.',
        schaetzung: bonus({ lebenProzent: 25 }),
      },
      {
        schwelle: 5,
        bonus: bonus({ lebenProzent: 12 }),
        effekt: { art: 'wachstum', lebenProzentJeSek: 1.4 },
        text: '+12 % Leben, heilen 1,4 % je Sekunde.',
        schaetzung: bonus({ lebenProzent: 40 }),
      },
    ],
  },
  {
    marke: 'untot',
    name: 'Untot',
    wirkung:
      'Untote sind zäher und schlagen härter zu, und der erste, der fällt, steht wieder auf.',
    stufen: [
      {
        schwelle: 2,
        bonus: bonus({ angriffProzent: 12, lebenProzent: 8 }),
        effekt: { art: 'wiederkehr', lebenProzent: 70 },
        text: '+12 % Angriff, +8 % Leben, der erste Gefallene kehrt mit 70 % Leben zurück.',
        schaetzung: bonus({ angriffProzent: 10, lebenProzent: 10 }),
      },
      {
        schwelle: 3,
        bonus: bonus({ angriffProzent: 18, lebenProzent: 12 }),
        effekt: { art: 'wiederkehr', lebenProzent: 85 },
        text: '+18 % Angriff, +12 % Leben, der erste Gefallene kehrt mit 85 % Leben zurück.',
        schaetzung: bonus({ angriffProzent: 15, lebenProzent: 15 }),
      },
      {
        schwelle: 4,
        bonus: bonus({ angriffProzent: 28, lebenProzent: 18 }),
        effekt: { art: 'wiederkehr', lebenProzent: 100 },
        text: '+28 % Angriff, +18 % Leben, der erste Gefallene kehrt mit vollem Leben zurück.',
        schaetzung: bonus({ angriffProzent: 30, lebenProzent: 30 }),
      },
    ],
  },
  {
    marke: 'drache',
    name: 'Drache',
    wirkung:
      'Drachen schlagen etwas härter zu, und ihre Treffer setzen das Ziel in Brand.',
    /*
     * Am 05.09.2026 halbiert (vorher 25/10, 50/20 und 80/30) und mit der
     * Schwellenverschiebung noch einmal um den Traegeranteil gekuerzt.
     *
     * Drache war mit 34,1 % Siegquote der Ausreisser des Katalogs (x1,86 des
     * Schnitts). Der Bonus allein erklaerte das nicht — mit Bonus null stand
     * die Marke immer noch bei x1,37, weil sie bis dahin nur ueber zwei Kopien
     * derselben Drei-Gold-Einheit zu haben war. Gegen den Rest half deshalb
     * erst der zweite Traeger (Funkenlehrling, siehe katalog.ts). Die kleineren
     * Zahlen hier bleiben trotzdem: Zusammen ergeben sie x1,15.
     *
     * AUCH HIER TRAEGT DER BONUS HEUTE (Nachtrag 21.09.2026, zwoelfte
     * Messung): auf null gesetzt faellt Drache von x0,77 auf x0,42 (zweite
     * Saatbasis x0,69 auf x0,31). Der Satz oben gilt fuer den Stand VOR dem
     * Funkenlehrling und ist keine Aussage ueber heute.
     *
     * VON DEN DREI STUFEN WIRKT PRAKTISCH NUR DIE ERSTE, und das ist der
     * eigentliche Befund dieser Marke: Bei zwei Traegern verlangt die
     * Schwelle 3 eine dritte Kopie — gehalten wurde sie in 759 von 168.385
     * Antritten, die Schwelle 5 in keinem einzigen (5.000 Partien zu viert).
     * Die erste Stufe allein anzuheben bringt entsprechend wenig (auf 15/8:
     * x0,77 auf x0,80); was die Marke bewegt, ist ein dritter Traeger. Vier
     * Kandidaten sind gemessen und stehen im Konzeptdokument — gebaut ist
     * keiner, weil Drache mit x0,75 keine Schranke reisst und jede Anhebung
     * der untersten Zeile (Meuchler) abgeht.
     *
     * UND WER HIER DREHT, DREHT AN ELEMENTAR MIT: Funkenlehrling und
     * Drachenkind tragen beide Marken. Elementar auf 25/40/65 hebt Drache
     * von x0,77 auf x1,17, ohne dass an diesen Zahlen etwas geaendert wurde.
     */
    stufen: [
      // NUR EINE STUFE (27.11.2026): Drache hat genau zwei verschiedene Traeger
      // (Funkensalamander, Drachenkind), und jede Einheit zaehlt nur einmal.
      // Gemessen war sie mit den Werten der alten dritten Stufe zu stark (x1,30); sie liegt jetzt etwa bei der alten zweiten.
      {
        schwelle: 2,
        bonus: bonus({ angriffProzent: 8 }),
        effekt: { art: 'glut', angriffProzentJeSek: 14, sek: 3 },
        text: '+8 % Angriff, Treffer brennen 3 Sekunden nach.',
        schaetzung: bonus({ angriffProzent: 35, tempoProzent: 15 }),
      },
    ],
  },
];

const NACH_MARKE = new Map<Marke, Synergie>(SYNERGIEN.map((s) => [s.marke, s]));

/** Wirft bei unbekannter Marke — das waere ein Loch in der Tabelle, kein Spielfall. */
export function synergie(marke: Marke): Synergie {
  const gefunden = NACH_MARKE.get(marke);
  if (!gefunden) throw new Error(`Fuer die Marke ${marke} gibt es keine Synergie`);
  return gefunden;
}

/**
 * Eine Bretthaelfte, so weit diese Datei sie braucht: je Platz eine Kennung
 * oder nichts. Strukturell, damit sowohl `Kaempfer` (partie.ts) als auch
 * `Aufgestellt` (kampf.ts) hineinpassen, ohne dass diese Datei eine von
 * beiden kennen muss — kampf.ts importiert hierher, nicht umgekehrt.
 */
export type Aufgestellte = readonly ({ readonly id: EinheitId } | null)[];

export type Markenzaehlung = Readonly<Record<Marke, number>>;

/** Wie viele Traeger jeder Marke auf dieser Bretthaelfte stehen. */
export function zaehleMarken(brett: Aufgestellte): Markenzaehlung {
  const zaehlung: Record<Marke, number> = Object.fromEntries(
    MARKEN.map((m) => [m, 0]),
  ) as Record<Marke, number>;
  /*
   * JEDE EINHEIT ZAEHLT NUR EINMAL (Robin, 27.11.2026): Zwei Pinguinwachen —
   * gleich ob Stufe 1 und 1 oder Stufe 2 und 1 — sind EIN Krieger und EIN
   * Waechter. Sonst baute man Marken aus lauter Kopien derselben Einheit.
   */
  const gezaehlt = new Set<EinheitId>();
  for (const platz of brett) {
    if (!platz || gezaehlt.has(platz.id)) continue;
    gezaehlt.add(platz.id);
    for (const marke of einheit(platz.id).marken) zaehlung[marke] += 1;
  }
  return zaehlung;
}

/** Die verschiedenen Einheiten einer Marke auf diesem Brett (fuer die Sicht). */
export function traegerVon(brett: Aufgestellte, marke: Marke): readonly EinheitId[] {
  const ids: EinheitId[] = [];
  for (const platz of brett) {
    if (!platz || ids.includes(platz.id)) continue;
    if (einheit(platz.id).marken.includes(marke)) ids.push(platz.id);
  }
  return ids;
}

/** Die hoechste erreichte Schwelle, oder null unter der ersten. */
export function aktiveSchwelle(anzahl: number, schwellen: readonly Schwelle[] = SCHWELLEN): Schwelle | null {
  let aktiv: Schwelle | null = null;
  for (const s of schwellen) if (anzahl >= s) aktiv = s;
  return aktiv;
}

/** Die naechste noch nicht erreichte Schwelle, oder null ab der hoechsten. */
export function naechsteSchwelle(anzahl: number, schwellen: readonly Schwelle[] = SCHWELLEN): Schwelle | null {
  return schwellen.find((s) => anzahl < s) ?? null;
}

/** Der Bonus, den eine Marke bei so vielen Traegern gibt — null unter der ersten Schwelle. */
export function bonusDerMarke(marke: Marke, anzahl: number): Wertebonus | null {
  const schwelle = aktiveSchwelle(anzahl, schwellenVon(marke));
  if (schwelle === null) return null;
  const stufe = synergie(marke).stufen.find((s) => s.schwelle === schwelle);
  if (!stufe) throw new Error(`Synergie ${marke} hat keine Stufe fuer Schwelle ${schwelle}`);
  return stufe.bonus;
}

/**
 * Der gesamte Bonus einer Einheit aus allen ihren Marken, bei dieser Zaehlung.
 *
 * Die Boni der Marken werden ADDIERT, nicht multipliziert: +10 % und +15 %
 * Leben sind +25 %. Multiplizieren gaebe 26,5 % und eine Zahl, die sich in
 * der Anzeige nicht mehr aus den zwei Zeilen der Tabelle erklaeren liesse.
 */
export function bonusFuerEinheit(id: EinheitId, zaehlung: Markenzaehlung): Wertebonus {
  let summe = KEIN_BONUS;
  for (const marke of einheit(id).marken) {
    const b = bonusDerMarke(marke, zaehlung[marke]);
    if (!b) continue;
    summe = {
      lebenProzent: summe.lebenProzent + b.lebenProzent,
      angriffProzent: summe.angriffProzent + b.angriffProzent,
      tempoProzent: summe.tempoProzent + b.tempoProzent,
      ruestung: summe.ruestung + b.ruestung,
    };
  }
  return summe;
}

/**
 * Was der Bildschirm ueber eine Marke wissen muss: wie viele stehen, welche
 * Schwelle gilt, welche kommt als naechste — und was der Bonus gerade ist.
 */
export interface Synergiestand {
  readonly marke: Marke;
  readonly name: string;
  readonly anzahl: number;
  /** Die erreichte Schwelle, null unter der ersten. */
  readonly schwelle: Schwelle | null;
  /** Die naechste Schwelle, null ab der hoechsten. */
  readonly naechsteSchwelle: Schwelle | null;
  /** Der geltende Bonus, null unter der ersten Schwelle. */
  readonly bonus: Wertebonus | null;
  /** Der geltende Effekt, null unter der ersten Schwelle. */
  readonly effekt: Markeneffekt | null;
  /** Was die geltende Stufe tut, als Satz; null unter der ersten Schwelle. */
  readonly text: string | null;
  /**
   * Die VERSCHIEDENEN Einheiten, die hier zaehlen (seit dem 27.11.2026).
   * Der Bildschirm sieht daran, ob ein Kauf die Marke voranbringt: Eine
   * Einheit, die schon in der Liste steht, zaehlt nicht noch einmal.
   */
  readonly traeger: readonly EinheitId[];
}

/**
 * Die Synergien einer Bretthaelfte fuer die Sicht — nur Marken mit
 * mindestens einem Traeger, in Katalogreihenfolge der Marken.
 *
 * Die Marken ohne Traeger fehlen mit Absicht: Sieben Zeilen je Sitz mal acht
 * Sitze in jedem Rundruf, davon die meisten "0 von 2", waeren Ballast fuer
 * eine Anzeige, die sie ohnehin ausblenden wuerde.
 */
export function synergienVon(brett: Aufgestellte): readonly Synergiestand[] {
  const zaehlung = zaehleMarken(brett);
  return MARKEN.filter((marke) => zaehlung[marke] > 0).map((marke) => {
    const anzahl = zaehlung[marke];
    return {
      marke,
      name: synergie(marke).name,
      anzahl,
      schwelle: aktiveSchwelle(anzahl, schwellenVon(marke)),
      naechsteSchwelle: naechsteSchwelle(anzahl, schwellenVon(marke)),
      bonus: bonusDerMarke(marke, anzahl),
      effekt: stufeDerMarke(marke, anzahl)?.effekt ?? null,
      text: stufeDerMarke(marke, anzahl)?.text ?? null,
      traeger: traegerVon(brett, marke),
    };
  });
}

/** Die Stufe einer Marke bei so vielen Traegern — null unter der ersten Schwelle. */
export function stufeDerMarke(marke: Marke, anzahl: number): Synergiestufe | null {
  const schwelle = aktiveSchwelle(anzahl, schwellenVon(marke));
  if (schwelle === null) return null;
  return synergie(marke).stufen.find((s) => s.schwelle === schwelle) ?? null;
}

/**
 * Was der Bot einer Einheit an Markenwert zurechnet (siehe `schaetzung`).
 * Gleiche Rechnung wie `bonusFuerEinheit`, nur mit der Schaetzspalte.
 */
export function schaetzungFuerEinheit(id: EinheitId, zaehlung: Markenzaehlung): Wertebonus {
  let summe = KEIN_BONUS;
  for (const marke of einheit(id).marken) {
    const b = stufeDerMarke(marke, zaehlung[marke])?.schaetzung;
    if (!b) continue;
    summe = {
      lebenProzent: summe.lebenProzent + b.lebenProzent,
      angriffProzent: summe.angriffProzent + b.angriffProzent,
      tempoProzent: summe.tempoProzent + b.tempoProzent,
      ruestung: summe.ruestung + b.ruestung,
    };
  }
  return summe;
}

/** Alle Markeneffekte, die fuer diese Einheit bei dieser Zaehlung gelten. */
export function effekteFuerEinheit(id: EinheitId, zaehlung: Markenzaehlung): readonly Markeneffekt[] {
  const effekte: Markeneffekt[] = [];
  for (const marke of einheit(id).marken) {
    const stufe = stufeDerMarke(marke, zaehlung[marke]);
    if (stufe) effekte.push(stufe.effekt);
  }
  return effekte;
}
