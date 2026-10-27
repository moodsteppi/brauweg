/**
 * Der Einheiten-Katalog von Tafelrunde.
 *
 * Reine Daten, keine Regel. Wer balanciert, aendert nur diese Datei — deshalb
 * stehen die Werte ausgeschrieben da und werden nicht aus der Kostenstufe
 * gerechnet. Eine Formel waere kuerzer und genau deshalb falsch: Ein Magier
 * fuer 1 Gold und eine Wache fuer 1 Gold sollen sich UNTERSCHEIDEN, sonst ist
 * die Wahl im Laden keine.
 *
 * Die Grundwerte je Kostenstufe kommen aus docs/spiele/auto-battler-konzept.md
 * (Abschnitt Balancing) und sind dort ausdruecklich zum Nachjustieren erklaert:
 * 1 Gold rund 550 Leben / 40 Angriff, 2 Gold rund 700 / 55, 3 Gold rund
 * 900 / 70. Die einzelnen Einheiten streuen um diese Mitte — eine Wache liegt
 * darueber im Leben und darunter im Angriff, ein Magier umgekehrt.
 *
 * Die Namen sind eigene Erfindungen im Fantasy-Ton der Plattform. Nichts
 * daran stammt aus einem fremden Spiel; das ist keine Stilfrage, sondern eine
 * Auflage aus dem Konzept.
 */

/**
 * Kampfrolle einer Einheit. Sie beschreibt, WIE sie kaempft (vorne, hinten,
 * heilend).
 *
 * GENAU EINE VON FUENF WIRKT IM KAMPF, seit dem 06.09.2026: Ein `beistand`
 * heilt Verbuendete, statt zu schlagen (`HEILUNG_FAKTOR` und `sucheWunde` in
 * kampf.ts). Die anderen vier unterscheiden sich weiterhin allein ueber ihre
 * WERTE — vor allem ueber `reichweite`, die einzige Zahl, die der Kampf ausser
 * den Grundwerten liest. Fuer sie ist die Rolle Auskunft: Der Laden zeigt sie
 * an, und der Bot stellt nach ihr auf (`wunschreihe` in bot.ts).
 *
 * WARUM AUSGERECHNET DER BEISTAND EINE WIRKUNG BEKAM: Bei den anderen vier
 * ergibt sich aus den Werten eine Spielweise — eine Wache haelt aus, ein
 * Schuetze steht weit weg, ein Meuchler schlaegt schnell. Ein Beistand hatte
 * dagegen den niedrigsten Angriff seiner Stufe UND keinen Ausgleich dafuer:
 * Gemessen gewannen die drei Traeger zusammen null von 114 Kaempfen
 * (werkzeug/turnier.mjs). Die Rolle war nicht schwach, sie war leer.
 */
export type Rolle = 'wache' | 'schuetze' | 'magier' | 'meuchler' | 'beistand';

/**
 * Klassen-Marken. Aus ihnen entstehen die Synergie-Boni (Schwellen bei 2, 4
 * und 6 gleichen Marken auf dem Brett) — die Tabelle dazu steht in
 * synergien.ts, nicht hier.
 *
 * Die Marken sind eine Eigenschaft der EINHEIT, nicht des Bonus: Der Katalog
 * sagt, wer Krieger ist; synergien.ts sagt, was vier Krieger bekommen.
 */
export type Marke =
  | 'krieger'
  | 'elementar'
  | 'meuchler'
  | 'waechter'
  | 'naturwesen'
  | 'untot'
  | 'drache';

export const MARKEN: readonly Marke[] = [
  'krieger',
  'elementar',
  'meuchler',
  'waechter',
  'naturwesen',
  'untot',
  'drache',
];

/** Kostenstufen dieses Ausbaus. Das Konzept sieht spaeter 4 und 5 Gold vor. */
export type Kosten = 1 | 2 | 3;

export const KOSTENSTUFEN: readonly Kosten[] = [1, 2, 3];

/** Sternstufe. Drei gleiche einer Stufe ergeben eine der naechsten. */
export type Stufe = 1 | 2 | 3;

export const MAX_STUFE: Stufe = 3;

/** Wie viele gleiche Einheiten verschmelzen. */
export const VERSCHMELZ_ZAHL = 3;

export interface Grundwerte {
  readonly leben: number;
  readonly angriff: number;
  /** Angriffe je Sekunde. Der Kampf rechnet sie in ganze Takte um (kampf.ts). */
  readonly tempo: number;
  /** Reichweite in Feldern. 1 = Nahkampf. */
  readonly reichweite: number;
  /** Ruestung mindert eingehenden Schaden in Prozent (schadenNach in kampf.ts). */
  readonly ruestung: number;
}

/**
 * Ein Aufschlag auf die Grundwerte, wie ihn die Synergien geben (synergien.ts).
 *
 * Leben, Angriff und Tempo in PROZENT, Ruestung als feste Zahl. Der Grund ist
 * die Spreizung der Werte: Leben reicht von 430 bis 1150 und wird auf Stufe 3
 * noch verdreifacht — ein fester Aufschlag waere fuer den Funkenlehrling ein
 * Geschenk und fuer den Wurzelriesen unsichtbar. Ruestung dagegen ist selbst
 * schon ein Prozentwert (10 bis 50), da ist ein fester Zuschlag genau das,
 * was man meint, wenn man "zehn Ruestung mehr" sagt.
 *
 * Reichweite bekommt keinen Bonus, aus demselben Grund wie bei der Stufe: Eine
 * Wache, die auf einmal weit schiesst, ist eine andere Einheit.
 */
export interface Wertebonus {
  readonly lebenProzent: number;
  readonly angriffProzent: number;
  readonly tempoProzent: number;
  readonly ruestung: number;
}

export const KEIN_BONUS: Wertebonus = {
  lebenProzent: 0,
  angriffProzent: 0,
  tempoProzent: 0,
  ruestung: 0,
};

/**
 * Mehr Ruestung gibt es nicht, egal wie viele Boni zusammenkommen.
 *
 * Bei 100 naehme eine Einheit nur noch den Mindestschaden von 1 je Treffer
 * (schadenNach), und ein Kampf liefe bis zur Hoechstdauer. Eine Dorfwache
 * (40) mit Krieger UND Waechter auf der hoechsten Schwelle kaeme auf 90 und
 * stoesst hier an — mit Absicht: Sechs Krieger und sechs Waechter auf einem
 * Brett sind ein Aufwand, der sich lohnen soll, aber nicht unverwundbar
 * machen darf.
 */
export const RUESTUNG_HOECHSTWERT = 75;

export interface Einheit extends Grundwerte {
  readonly id: EinheitId;
  /**
   * Deutscher Anzeigename. Steht im Modul und nicht in der i18n des Clients:
   * Ein Einheitenname ist Inhalt des Spiels, kein Oberflaechentext — und wer
   * balanciert, will Name und Werte am selben Ort lesen.
   */
  readonly name: string;
  readonly kosten: Kosten;
  readonly rolle: Rolle;
  /** Ein bis zwei Marken, wie im Konzept vorgegeben. */
  readonly marken: readonly Marke[];
}

/**
 * Kennungen aller Einheiten.
 *
 * Ausgeschrieben als Vereinigungstyp und nicht als `string`: Ein Tippfehler in
 * einem Vorrat, einem Laden oder einem Snapshot soll beim Uebersetzen
 * auffallen und nicht erst als Einheit, die es nicht gibt.
 */
export type EinheitId =
  // 1 Gold
  | 'dorfwache'
  | 'schildknappe'
  | 'astschuetze'
  | 'steinschleuderer'
  | 'funkenlehrling'
  | 'irrlicht'
  | 'gassendieb'
  | 'moosheiler'
  // 2 Gold
  | 'hainwaechterin'
  | 'grimmbart'
  | 'bogenmeisterin'
  | 'nachtpfeil'
  | 'frostweberin'
  | 'schattenklinge'
  | 'knochenspaeher'
  | 'runenpriester'
  // 3 Gold
  | 'wurzelriese'
  | 'drachenkind'
  | 'sturmrufer'
  | 'grabfuerstin'
  | 'klingentaenzerin'
  | 'lichtwahrerin';

/**
 * Der Katalog. 22 Einheiten ueber drei Kostenstufen (8 / 8 / 6) — genau die
 * Verteilung aus der Balancing-Tabelle des Konzepts.
 */
export const KATALOG: readonly Einheit[] = [
  // --- 1 Gold: Grundwerte rund 550 Leben / 40 Angriff ---------------------
  /**
   * LEBEN AM 25.09.2026 GESENKT (vorher 650). In der Tauschprobe stand sie
   * bei x1,38, der groesste Abstand nach oben im ganzen Katalog, und mit ihr
   * standen ihre beiden Marken an der Spitze (Waechter x1,28, Krieger x1,27,
   * alle anderen unter x1,0). Mit 550 steht sie bei x1,12, immer noch in der
   * oberen Haelfte ihrer Stufe, und die rohe Markenspanne schrumpft von
   * x1,28–0,80 auf x1,11–0,77. Alle Zahlen: docs/TAFELRUNDE-WACHEN-WERTE.md.
   *
   * KEIN MESSFEHLER DER PROBE. Der Tauschplatz ist oft der vorderste, und dort
   * verliert jeder Schuetze gegen jede Wache. Aufgeschluesselt nach der Rolle,
   * die vorher auf dem Platz stand, liegt sie aber ueberall vorn, auch auf
   * Meuchlerplaetzen und auf Brettern, die schon eine zweite Wache haben
   * (x1,35 bis x1,52). Das Irrlicht ist ebenfalls eine Wache und steht auf
   * denselben Brettern mit zweiter Wache bei x0,60, auf Meuchlerplaetzen bei
   * x0,92. Es liegt an den Werten und nicht an der Rolle.
   *
   * WARUM NICHT AUCH DER SCHILDKNAPPE (x1,33). Solange er der einzige billige
   * Untot-Traeger war, liess jede Schwaechung die Marke in der Probe unter
   * hundert Antritte fallen. Das Irrlicht traegt sie seitdem mit, und daran
   * scheitert es nicht mehr; was ihn noch haelt, steht beim Knappen.
   */
  {
    id: 'dorfwache',
    name: 'Dorfwache',
    kosten: 1,
    rolle: 'wache',
    marken: ['krieger', 'waechter'],
    leben: 550,
    angriff: 30,
    tempo: 0.65,
    reichweite: 1,
    ruestung: 40,
  },
  /**
   * STEHT ALLEIN OBEN IN SEINER STUFE (25.09.2026): Tauschprobe x1,39 /
   * x1,37, die naechste Zeile x1,08. Lange ging es nicht anders, weil er der
   * einzige billige Untot-Traeger war: Jede Schwaechung (630 oder 665 Leben,
   * Ruestung, Angriff) liess den Bot ihn so viel seltener kaufen, dass Untot
   * in test/ausgewogenheit.test.ts unter hundert Antritte fiel (51 bis 99).
   * Seit das Irrlicht die Marke mittraegt (siehe dort), haelt sie auch mit
   * einem schwaecheren Knappen rund 350 Antritte. Gemessen waere 570 Leben die
   * Zahl (x1,12 / x1,13, gleichauf mit Dorfwache und Irrlicht).
   *
   * WARUM ER TROTZDEM NOCH 700 HAT: Jede Schwaechung, die ihn bewegt, kuerzt
   * die Kaempfe so weit, dass in test/spielzeit.test.ts die Vorbereitung den
   * Kampf ueberholt ("steckt seine Zeit vor allem in die Kaempfe"). Die Probe
   * stand nach der Dorfwache ohnehin auf der Kante (Kampf 149 s gegen 148 s
   * Vorbereitung), mit 570 sind es 139 gegen 146 s. Die Probe verlangt fuer
   * diesen Fall ausdruecklich eine Neumessung von
   * docs/TAFELRUNDE-SPIELZEIT.md, Abschnitt 4 — das entscheidet ein Mensch,
   * nicht eine Katalogzeile. Alle Zahlen: docs/TAFELRUNDE-WACHEN-WERTE.md.
   *
   * DRITTER TRAEGER DER MARKE UNTOT, dafuer Ruestung 42 statt 45
   * (beides am 05.09.2026).
   *
   * Vorher trugen die Marke nur Knochenspaeher (2 Gold) und Grabfuerstin
   * (3 Gold), und weil die Grabfuerstin ueber 5.000 Partien zu viert nur
   * 19-mal auf einem Schlussbrett stand, hiess "Untot zu zweit" praktisch
   * immer "zwei Knochenspaeher". Gemessen trat die Marke damit noch 35-mal an
   * — unter jeder Mindestzahl, mit der sich etwas aussagen laesst. AM BONUS ZU
   * DREHEN HAETTE NICHTS GEMESSEN: Solange eine Marke nur ueber zwei Kopien
   * derselben Einheit zu haben ist, misst man die Einheit und nicht die Marke
   * — genau das war schon bei Drache der Befund (siehe Funkenlehrling unten).
   *
   * Der Knappe ist der Traeger, weil er als einziger Kandidat beides
   * mitbringt: Er steht oft genug auf einem Brett, dass die Marke ueberhaupt
   * zustande kommt, und er zieht sie nicht aus der Mitte. Fuenf weitere
   * Kandidaten wurden ueber je 1.500 Partien gegengemessen: Steinschleuderer
   * x1,57 und Gassendieb x1,36 zogen die Marke nach oben, bei Nachtpfeil,
   * Runenpriester und Moosheiler blieb sie unter hundert Antritten und damit
   * unmessbar. Dazu passt die Rolle: Knochenspaeher und Grabfuerstin teilen
   * aus, keiner von beiden haelt etwas aus — mit einer Wache bekommt "zaeh und
   * unerbittlich" (der Untot-Bonus auf Leben und Angriff, synergien.ts)
   * endlich eine Front. Beide alten Traeger stehen seitdem oefter, weil der
   * Bot ueberhaupt auf Untot hinspielen kann: Knochenspaeher 535 -> 1.315
   * Antritte, Grabfuerstin 19 -> 40.
   *
   * Zusammen mit der Elementar-Arbeit desselben Tages (Irrlicht in die
   * Vorderreihe, siehe unten) steht Untot ueber 5.000 Partien zu viert bei
   * 3.422 Antritten und x0,90 des Schnitts. Beide Aenderungen sind getrennt
   * gefunden und getrennt gemessen worden; die gemeinsame Tabelle steht in
   * docs/spiele/auto-battler-konzept.md.
   *
   * DIE DREI PUNKTE RUESTUNG GEHOEREN ZU DERSELBEN AENDERUNG. Mit der zweiten
   * Marke wird der Knappe oefter gekauft und lebt laenger, und beides
   * verlaengert die Kaempfe. Gemessen auf dem Stand vor der Elementar-Arbeit
   * stiegen die an der Hoechstdauer abgeschnittenen Kaempfe allein durch die
   * Marke von 9,5 auf 12,9 % und die Spielzeit von 7:24 auf 7:43 — die Probe
   * in test/spielzeit.test.ts faengt genau das ab (Schranke 10 %), und sie hat
   * es getan. DER EFFEKT IST NACH DEM ZUSAMMENFUEHREN NICHT KLEINER GEWORDEN,
   * sondern groesser: Setzt man den Knappen auf dem heutigen Stand wieder auf
   * 45, stehen 10,6 % und 7:32 statt 5,6 % und 6:50 (je 1.500 Partien). Die
   * drei Punkte tragen also weiter.
   *
   * WARUM RUESTUNG UND NICHT DER BONUS: Ruestung wirkt auf JEDEN eingehenden
   * Treffer und verlaengert einen Kampf doppelt, weil beide Seiten laenger
   * stehen (ausfuehrlich in synergien.ts). Am Untot-Bonus zu drehen half
   * dagegen kaum — rein auf Angriff gelegt (15/25/40) blieb er bei 10,6 % und
   * haette der Marke ihren eigenen Charakter genommen: Sie waere ein zweites
   * Elementar geworden. Die Laenge haengt am Knappen, also nimmt der Knappe
   * sie zurueck.
   *
   * Zur Figur: Sie zeigt weiter den lebenden Knappen — seit dem 06.09.2026
   * das Ritterblatt der ROLLE Wache (figuren3d.ts im Client, fuenf Blaetter
   * fuer 22 Einheiten), und daran aendert kein Bild je Einheit etwas. Der
   * Name traegt es — ein Knappe, der seinen Posten auch dann nicht verlassen
   * hat, als er gefallen war. Ein Blatt je Rolle UND Gestalt (lebend/untot)
   * ist als Bestellung beschrieben: docs/ASSETS-TAFELRUNDE-UNTOT.md.
   */
  {
    id: 'schildknappe',
    name: 'Schildknappe',
    kosten: 1,
    rolle: 'wache',
    marken: ['waechter', 'untot'],
    leben: 700,
    angriff: 28,
    tempo: 0.6,
    reichweite: 1,
    ruestung: 42,
  },
  {
    id: 'astschuetze',
    name: 'Astschütze',
    kosten: 1,
    rolle: 'schuetze',
    marken: ['naturwesen'],
    leben: 480,
    angriff: 45,
    tempo: 0.8,
    reichweite: 3,
    ruestung: 15,
  },
  {
    id: 'steinschleuderer',
    name: 'Steinschleuderer',
    kosten: 1,
    rolle: 'schuetze',
    marken: ['krieger'],
    leben: 500,
    angriff: 42,
    tempo: 0.75,
    reichweite: 3,
    ruestung: 20,
  },
  /**
   * ZWEITER TRAEGER DER MARKE DRACHE (seit dem 05.09.2026).
   *
   * Vorher trug nur das Drachenkind sie, und damit hiess "Drache zu zweit"
   * immer "zweimal dieselbe Drei-Gold-Einheit". Gemessen war das die staerkste
   * Marke im Katalog (34,1 % Siegquote, x1,86 des Schnitts) — nur lag das kaum
   * am Bonus: Mit auf null gesetztem Drachen-Bonus stand sie immer noch bei
   * x1,37. Gemessen wurde also gar nicht die Marke, sondern "ein Brett, auf dem
   * zwei teure Einheiten stehen". Ein Lehrling, der Drachenfeuer ruft, macht
   * daraus wieder eine ENTSCHEIDUNG: billig, schwach, aber der zweite Traeger.
   * Danach steht Drache bei x1,15 — und hat genug Antritte, um ueberhaupt
   * messbar zu sein (394 statt 60 in 5.000 Partien).
   */
  /**
   * Werte am 05.09.2026 angehoben (vorher 450 / 50 / 0,6 / Ruestung 10).
   *
   * Er war zusammen mit dem Irrlicht die schwaechste Einheit seiner
   * Kostenstufe ausserhalb des Beistands — rund ein Viertel unter der Mitte,
   * gemessen mit demselben Mass, das der Bot benutzt (`staerke` in bot.ts:
   * Leben mal Ruestungsfaktor mal Angriff mal Tempo — seit dem 05.09.2026
   * zusaetzlich mal einem Reichweitenfaktor, der aber nur greift, wenn das
   * Heer eine Vorderreihe hat). Die Ursache war ein
   * unbezahlter Tausch: Ein Magier bekommt laut Konzept mehr Angriff und
   * weniger Leben als seine Stufe — er hatte zusaetzlich das NIEDRIGSTE Tempo
   * und die NIEDRIGSTE Ruestung des ganzen Katalogs. Mit Tempo 0,6 blieben von
   * 50 Angriff dreissig Schaden je Sekunde, weniger als der Astschuetze mit
   * seinen 45 bei Tempo 0,8 — der Angriffsvorteil war nur auf dem Papier da.
   *
   * Jetzt liegt er auf der Mitte seiner Stufe. Am Tausch selbst aendert das
   * nichts: Er hat weiterhin das wenigste Leben und die geringste Ruestung
   * unter den Ein-Gold-Kaempfern und dafuer den haertesten einzelnen Treffer.
   */
  {
    id: 'funkenlehrling',
    name: 'Funkenlehrling',
    kosten: 1,
    rolle: 'magier',
    marken: ['elementar', 'drache'],
    leben: 470,
    angriff: 56,
    tempo: 0.65,
    reichweite: 3,
    ruestung: 15,
  },
  /**
   * DIE VORDERREIHE DER MARKE ELEMENTAR (seit dem 05.09.2026). Vorher ein
   * Magier: 430 / 52 / 0,6, Reichweite 3, Ruestung 10, Marken Elementar und
   * Naturwesen.
   *
   * Elementar gewann 6,0 % seiner Antritte gegen einen Schnitt von 24,2 %
   * (x0,25, 1.500 Partien zu viert) und war damit die einzige Marke weit
   * ausserhalb der Schranke. Der Grund stand nicht in der Synergietabelle,
   * sondern hier: Alle fuenf Traeger waren Fernkaempfer mit Reichweite 3 oder
   * 4 — kein einziger stand vorn. Ein Brett, das auf Elementar setzt, hatte
   * niemanden, der die Linie haelt; die Magier wurden erreicht und
   * niedergemacht, bevor ihr Angriffsbonus etwas eintrug. Zum Vergleich:
   * Naturwesen hat zwei Wachen unter fuenf Traegern und stand bei x1,04,
   * Waechter vier unter sechs und bei x1,23.
   *
   * BELEGT, BEVOR HIER ETWAS GEAENDERT WURDE. Drei Verdaechtige, einzeln
   * gemessen (Werkzeuge in werkzeug/, Wegwerf-Laeufe):
   *   - Bonus zu klein? Mit Elementar-Bonus NULL blieb die Siegquote bei
   *     6,1 %. Der Bonus bewegte damals nur, wie oft der Bot die Marke
   *     waehlte, nicht ob sie trug. DAS GALT FUER DEN STAND VOR DIESER
   *     ZEILE — mit dem Irrlicht in der Vorderreihe traegt er sehr wohl:
   *     auf null gesetzt faellt Elementar heute von x0,80 auf x0,49
   *     (21.09.2026, zwoelfte Messung, siehe synergien.ts). Der Satz ist
   *     Geschichte und keine Regel.
   *   - Traeger zu schwach? Hebt man alle vier auf die Mitte ihrer Stufe,
   *     kommt Elementar auf x0,54 bis x0,60 — besser, aber weiter draussen.
   *   - Zusammensetzung? Gibt man der Marke EINEN zaehen Traeger fuer die
   *     Vorderreihe, ohne einen einzigen Wert zu aendern, springt sie auf
   *     x0,78. Das war die Ursache.
   *
   * Warum ausgerechnet das Irrlicht: Es ist der billigste Elementar-Traeger,
   * und billig muss die Vorderreihe sein — sonst haelt sie erst ab Level 4.
   * Und es ist die einzige Figur der Reihe, die kein Werkzeug in der Hand
   * haelt (public/tafelrunde/irrlicht.webp ist eine Kugel), also die einzige,
   * die vorn nicht falsch aussieht. Neue Grafik kaeme hier nicht in Frage: Ein
   * neuer Traeger braucht eine bestellte Datei, und bis die da ist, zeigt der
   * Bildschirm einen weissen Kasten.
   *
   * Die Ruestung 35 ist die Zaehigkeit eines Irrlichts und keine Ruestung: Es
   * ist ein Licht, das schwer zu treffen ist. Naturwesen ist weggefallen —
   * ein Flammengeist gehoert nicht in den Wald, und Naturwesen hat mit
   * Hainwaechterin und Wurzelriese seine Vorderreihe laengst.
   *
   * VIERTER TRAEGER DER MARKE UNTOT (seit dem 25.09.2026), Werte
   * unveraendert. Anlass war der Schildknappe: Er stand in der Tauschprobe
   * allein oben in seiner Stufe, liess sich aber nicht schwaechen, weil
   * Untot als billigen Traeger nur ihn hatte (siehe dort). Zwoelf Einheiten
   * mit nur einer Marke wurden als vierter Traeger gegengemessen, je in der
   * 400er-Probe mit dem Knappen auf 630, die aussichtsreichen dazu ueber
   * 5.000 Partien. Das Irrlicht kann als einziges beides: Untot haelt die
   * Zaehlschwelle mit Abstand (Probe 372 statt 70 Antritte), und die Marke
   * bleibt nahe der Mitte (x1,09). Gassendieb und Steinschleuderer tragen sie
   * auch, reissen aber Meuchler bzw. Waechter nach oben (x1,26 und x1,46);
   * die Zwei- und Drei-Gold-Kandidaten ziehen Untot selbst auf x1,16 bis
   * x1,38, und mit Grimmbart steht die Marke in der Probe auf der Kante
   * (100 Antritte).
   *
   * Es ist zugleich der Traeger nach dem Muster des Knappen: eine billige
   * Wache, die "zaeh und unerbittlich" eine Front gibt. Und es passt: Ein
   * Irrlicht ist in der Sage die Seele eines Toten, die Wanderer ins Moor
   * lockt. Die Figur bleibt die Kugel (Rueckfall) bzw. das Ritterblatt der
   * Rolle Wache; wer das Blatt je Gestalt baut, bekommt es hier mit
   * (docs/ASSETS-TAFELRUNDE-UNTOT.md).
   *
   * Gebaut, mit dem Knappen auf 700: Untot x0,94 -> x1,08 ueber 5.000
   * Partien, in der Probe 175 -> 451 Antritte; die rohe Markenspanne wird
   * enger (x1,11–0,77 -> x1,09–0,74). Sein eigener Index steigt von x0,98 auf
   * x1,07 (Tauschprobe v1), Elementar bleibt in der Mitte (x1,07 -> x1,03).
   * Der Knappe steigt dabei mit (x1,34 -> x1,39), weil er oefter neben einem
   * zweiten Untoten steht.
   */
  {
    id: 'irrlicht',
    name: 'Irrlicht',
    kosten: 1,
    rolle: 'wache',
    marken: ['elementar', 'untot'],
    leben: 560,
    angriff: 34,
    tempo: 0.7,
    reichweite: 1,
    ruestung: 35,
  },
  /**
   * LEBEN AM 25.09.2026 ANGEHOBEN (vorher 520), ebenso Schattenklinge und
   * Knochenspaeher. Die drei standen in der Tauschprobe jeweils in der letzten
   * Zeile ihrer Kostenstufe (x0,74 / x0,81 / x0,68), die Marke Meuchler bei
   * x0,63.
   *
   * WARUM LEBEN UND NICHT TEMPO ODER MARKENBONUS. Meuchler teilen schon am
   * meisten Schaden je Sekunde aus, fallen aber nach 6 bis 8 s, weil sie mit
   * Schuetzenleben in der Front stehen (docs/TAFELRUNDE-MEUCHLER-KAMPFBILD.md).
   * Alle drei Wege sind gemessen, je mit Tauschprobe und Ausgewogenheit auf
   * zwei Saatbasen (docs/TAFELRUNDE-MEUCHLER-WERTE.md):
   *
   *   - Schnelleres Ankommen (halbe Schrittpause) drueckt die Marke auf
   *     x0,55. Wer frueher ankommt, steht frueher allein vorn.
   *   - Doppeltes Markentempo oder ein Lebensbonus auf der Marke heben vor
   *     allem den Nachtpfeil (Tauschprobe x1,03 auf x1,30 bzw. x1,35), einen
   *     Schuetzen. Der Knochenspaeher traegt die Marke Untot und faellt dabei
   *     auf x0,63 bzw. x0,59.
   *   - Mehr Leben auf genau diesen drei Einheiten holt jede aus der letzten
   *     Zeile ihrer Stufe.
   *
   * WARUM GESTAFFELT. +25 % fuer alle drei setzt die Schattenklinge mit x1,15
   * an die Spitze ihrer Stufe; +12,5 % fuer alle drei laesst den
   * Knochenspaeher bei x0,73 unten. Gebaut ist deshalb +12,5 % fuer
   * Gassendieb und Schattenklinge und +36 % fuer den Knochenspaeher, der keinen
   * Meuchlerbonus bekommt. Tauschprobe danach x0,92 / x0,92 / x0,89, Marke
   * Meuchler x0,86. Die Klingentaenzerin bleibt, sie steht mit x0,95 in der
   * Mitte ihrer Stufe.
   */
  {
    id: 'gassendieb',
    name: 'Gassendieb',
    kosten: 1,
    rolle: 'meuchler',
    marken: ['meuchler'],
    leben: 585,
    angriff: 48,
    tempo: 0.95,
    reichweite: 1,
    ruestung: 15,
  },
  {
    id: 'moosheiler',
    name: 'Moosheiler',
    kosten: 1,
    rolle: 'beistand',
    marken: ['naturwesen'],
    leben: 560,
    angriff: 26,
    tempo: 0.7,
    reichweite: 2,
    ruestung: 20,
  },

  // --- 2 Gold: Grundwerte rund 700 Leben / 55 Angriff ---------------------
  {
    id: 'hainwaechterin',
    name: 'Hainwächterin',
    kosten: 2,
    rolle: 'wache',
    marken: ['waechter', 'naturwesen'],
    leben: 850,
    angriff: 42,
    tempo: 0.65,
    reichweite: 1,
    ruestung: 45,
  },
  {
    id: 'grimmbart',
    name: 'Grimmbart',
    kosten: 2,
    rolle: 'wache',
    marken: ['krieger'],
    leben: 900,
    angriff: 45,
    tempo: 0.6,
    reichweite: 1,
    ruestung: 40,
  },
  /**
   * FUENFTE TRAEGERIN DER MARKE NATURWESEN (seit dem 18.09.2026), Werte
   * unveraendert.
   *
   * Naturwesen war nach der Beistand-Wirkung die schwaechste Zeile des
   * Katalogs (x0,57 ueber 1.500 Partien zu viert, x0,52 ueber 5.000) und
   * stand damit an der unteren Schranke der Probe in
   * test/ausgewogenheit.test.ts. Der Grund stand nicht in der Synergietabelle,
   * sondern hier: Von vier Traegern waren ZWEI die beiden letzten Zeilen des
   * ganzen Katalogs — Astschuetze (x0,22) und Moosheiler (x0,25), beide fuer
   * ein Gold. Wer Naturwesen zu zweit haben wollte, kam praktisch immer ueber
   * sie, und eine Ein-Gold-Einheit steht auf dem letzten Brett vor allem dann,
   * wenn ihr Besitzer nicht aufgestiegen ist (der Preisgraben, siehe die
   * neunte Messung im Konzept). Die Marke mass also nicht ihren Bonus, sondern
   * die Armut ihrer Bretter.
   *
   * DER BONUS WAR ES NICHT, und das ist gemessen und nicht vermutet — derselbe
   * Befund wie bei Elementar am 05.09.2026 (siehe Irrlicht): Hebt man die
   * Naturwesen-Stufen von 15/25/40 auf 25/40/65, kommt die Marke gerade auf
   * x0,62; auf dem Dreifachen (45/70/110) auf x0,87, aber dann steigen die an
   * der Hoechstdauer abgebrochenen Kaempfe von 1,7 auf 3,4 %, die Spielzeit auf
   * 6:15 — und Untot faellt auf 295 Antritte und damit unter die Zaehlschwelle
   * der Probe. Ein Lebensbonus kauft der Marke vor allem Bretter, nicht Siege.
   *
   * WARUM DIE BOGENMEISTERIN. Vier Kandidaten wurden ueber je 1.500 Partien
   * gegengemessen (Naturwesen vorher x0,57, hoechste Zeile x1,56):
   *
   *   Bogenmeisterin (2 Gold)   x0,84   Hoechstdauer 1,5 %   oberste x1,53
   *   Runenpriester  (2 Gold)   x0,81   Hoechstdauer 2,1 %   oberste x1,55
   *   Steinschleuderer (1 Gold) x0,90   Hoechstdauer 1,2 %   oberste x1,70
   *   Grimmbart      (2 Gold)   x0,68   Hoechstdauer 1,8 %   oberste x1,50
   *
   * Der Steinschleuderer hebt die Marke am weitesten — und reisst dabei die
   * Spanne oben auf (Waechter x1,70), weil er als dritte billige Einheit
   * genau das verstaerkt, was hier das Problem war. Der Runenpriester ist ein
   * zweiter Heiler, und Heilung verlaengert jeden Kampf doppelt (neunte
   * Messung); Grimmbart laesst Naturwesen die unterste Zeile bleiben. Die
   * Bogenmeisterin hebt die Marke aus der Wackelzone, ohne die Uhr oder die
   * obere Kante zu bewegen.
   *
   * Sie passt auch ins Bild: Die Figur ist eine Elfe in Gruen
   * (public/tafelrunde/bogenmeisterin.webp), und Naturwesen bekommt mit ihr
   * einen Schuetzen, der etwas aushaelt — neben Astschuetze (Zentaur),
   * Moosheiler, Hainwaechterin und Wurzelriese. Die Marke Krieger behaelt
   * sie; ihre Zahl bewegt sich dadurch nicht (x1,47 auf x1,45).
   */
  {
    id: 'bogenmeisterin',
    name: 'Bogenmeisterin',
    kosten: 2,
    rolle: 'schuetze',
    marken: ['krieger', 'naturwesen'],
    leben: 620,
    angriff: 62,
    tempo: 0.85,
    reichweite: 3,
    ruestung: 20,
  },
  {
    id: 'nachtpfeil',
    name: 'Nachtpfeil',
    kosten: 2,
    rolle: 'schuetze',
    marken: ['meuchler'],
    leben: 600,
    angriff: 65,
    tempo: 0.8,
    reichweite: 3,
    ruestung: 15,
  },
  /**
   * Werte am 05.09.2026 angehoben (vorher 580 / 70 / 0,6 / Ruestung 10).
   *
   * Dieselbe unbezahlte Rechnung wie beim Funkenlehrling, nur noch deutlicher:
   * Sie war mit x0,66 die schwaechste Zwei-Gold-Einheit ausserhalb des
   * Beistands und stand in 1.500 gemessenen Partien auf ganzen 15 Brettern —
   * der Bot kaufte sie schlicht nie. Eine Einheit, die niemand aufstellt, ist
   * fuer das Balancing dasselbe wie eine, die es nicht gibt.
   *
   * Sie bleibt Magier: Elementar hat seine Vorderreihe seit demselben Tag im
   * Irrlicht (siehe dort), und eine Marke aus lauter Wachen waere der Fehler
   * von vorhin mit umgekehrtem Vorzeichen.
   */
  {
    id: 'frostweberin',
    name: 'Frostweberin',
    kosten: 2,
    rolle: 'magier',
    marken: ['elementar'],
    leben: 600,
    angriff: 80,
    tempo: 0.65,
    reichweite: 3,
    ruestung: 20,
  },
  /** Leben am 25.09.2026 angehoben (vorher 660) — warum: siehe Gassendieb. */
  {
    id: 'schattenklinge',
    name: 'Schattenklinge',
    kosten: 2,
    rolle: 'meuchler',
    marken: ['meuchler'],
    leben: 745,
    angriff: 68,
    tempo: 1,
    reichweite: 1,
    ruestung: 15,
  },
  /**
   * Leben am 25.09.2026 angehoben (vorher 700) — warum: siehe Gassendieb.
   * Staerker als die beiden anderen, weil der Meuchlerbonus ihn nicht
   * erreicht: Mit 875 (+25 %) blieb er in der Tauschprobe bei x0,81 die
   * letzte Zeile seiner Stufe, mit 950 steht er bei x0,89 vor Grimmbart.
   */
  {
    id: 'knochenspaeher',
    name: 'Knochenspäher',
    kosten: 2,
    rolle: 'meuchler',
    marken: ['untot'],
    leben: 950,
    angriff: 60,
    tempo: 0.9,
    reichweite: 1,
    ruestung: 20,
  },
  {
    id: 'runenpriester',
    name: 'Runenpriester',
    kosten: 2,
    rolle: 'beistand',
    marken: ['waechter'],
    leben: 720,
    angriff: 38,
    tempo: 0.7,
    reichweite: 2,
    ruestung: 25,
  },

  // --- 3 Gold: Grundwerte rund 900 Leben / 70 Angriff ---------------------
  {
    id: 'wurzelriese',
    name: 'Wurzelriese',
    kosten: 3,
    rolle: 'wache',
    marken: ['naturwesen', 'waechter'],
    leben: 1150,
    angriff: 58,
    tempo: 0.6,
    reichweite: 1,
    ruestung: 50,
  },
  /**
   * Tempo 0,75 und Ruestung 25 (vorher 0,85 und 25, geaendert am 05.09.2026).
   *
   * Das Drachenkind war unter den Drei-Gold-Fernkaempfern in jeder Zahl vorn:
   * 82 x 0,85 = 70 Schaden je Sekunde gegen 55 beim Sturmrufer, dazu mehr Leben
   * und mehr Ruestung als beide Magier. Mit 0,75 sind es 62 — noch der beste
   * Wert der Reihe, aber kein Selbstlaeufer mehr. Tempo 0,65 war ausprobiert
   * und zu viel: Der Bot stellte die Einheit dann fast nicht mehr auf (Antritte
   * von 249 auf 27), und die Marke Elementar fiel mit ihr auf x0,66.
   */
  {
    id: 'drachenkind',
    name: 'Drachenkind',
    kosten: 3,
    rolle: 'schuetze',
    marken: ['drache', 'elementar'],
    leben: 820,
    angriff: 82,
    tempo: 0.75,
    reichweite: 3,
    ruestung: 25,
  },
  /**
   * Werte am 05.09.2026 angehoben (vorher 760 / 92 / 0,6 / Ruestung 15).
   *
   * Dritter Fall derselben Sache (siehe Funkenlehrling): x0,77 seiner Stufe,
   * und in 1.500 Partien stand er auf DREI Brettern. Seine Reichweite 4 —
   * als einzige im Katalog, sie reicht bis in die hintere Reihe des Gegners —
   * war den Aufschlag nicht wert, den er dafuer an Tempo und Ruestung zahlte.
   */
  {
    id: 'sturmrufer',
    name: 'Sturmrufer',
    kosten: 3,
    rolle: 'magier',
    marken: ['elementar'],
    leben: 800,
    angriff: 104,
    tempo: 0.65,
    reichweite: 4,
    ruestung: 20,
  },
  {
    id: 'grabfuerstin',
    name: 'Grabfürstin',
    kosten: 3,
    rolle: 'magier',
    marken: ['untot'],
    leben: 780,
    angriff: 88,
    tempo: 0.6,
    reichweite: 3,
    ruestung: 15,
  },
  {
    id: 'klingentaenzerin',
    name: 'Klingentänzerin',
    kosten: 3,
    rolle: 'meuchler',
    marken: ['krieger', 'meuchler'],
    leben: 860,
    angriff: 86,
    tempo: 1.05,
    reichweite: 1,
    ruestung: 20,
  },
  {
    id: 'lichtwahrerin',
    name: 'Lichtwahrerin',
    kosten: 3,
    rolle: 'beistand',
    marken: ['waechter'],
    leben: 900,
    angriff: 50,
    tempo: 0.7,
    reichweite: 2,
    ruestung: 30,
  },
];

const NACH_ID = new Map<EinheitId, Einheit>(KATALOG.map((e) => [e.id, e]));

/**
 * Wirft, statt undefined zu liefern: Eine unbekannte Kennung ist ein Fehler im
 * Aufrufer und kein Fall, den ein Spielzug sinnvoll behandeln koennte.
 */
export function einheit(id: EinheitId): Einheit {
  const gefunden = NACH_ID.get(id);
  if (!gefunden) throw new Error(`Einheit ${id} gibt es nicht`);
  return gefunden;
}

export function istEinheitId(wert: unknown): wert is EinheitId {
  return typeof wert === 'string' && NACH_ID.has(wert as EinheitId);
}

/** Alle Einheiten einer Kostenstufe, in Katalogreihenfolge. */
export function einheitenMitKosten(kosten: Kosten): readonly Einheit[] {
  return KATALOG.filter((e) => e.kosten === kosten);
}

/**
 * Wie viele Kopien einer Einheit im Vorrat liegen — je Kostenstufe, aus der
 * Tabelle des Konzepts: 30 / 25 / 18.
 *
 * Die billigen sind haeufiger, weil sie schneller verschmolzen werden: Fuer
 * eine Stufe-3-Einheit braucht man NEUN Kopien (dreimal drei), und bei acht
 * Spielern am Tisch waere ein knapper Vorrat der Ein-Gold-Einheiten die
 * eigentliche Bremse des Spiels.
 */
export const VORRAT_JE_KOSTEN: Readonly<Record<Kosten, number>> = {
  1: 30,
  2: 25,
  3: 18,
};

/**
 * Wertesteigerung je Sternstufe.
 *
 * Ausdruecklich NICHT linear (Konzept): Stufe 2 das 1,8-fache, Stufe 3 das
 * 3,2-fache. Wuerde verdoppelt und verdreifacht, waere Verschmelzen ein
 * schlechtes Geschaeft — drei Karten fuer den doppelten Wert einer einzigen —
 * und niemand spielte auf Stufe 3 hin.
 *
 * Skaliert werden nur Leben und Angriff. Tempo, Reichweite und Ruestung
 * bleiben: Eine Wache, die auf Stufe 3 ploetzlich weit schoesse, waere eine
 * andere Einheit und keine staerkere.
 */
export const STUFEN_FAKTOR: Readonly<Record<Stufe, number>> = {
  1: 1,
  2: 1.8,
  3: 3.2,
};

/**
 * Die Werte einer Einheit auf einer Sternstufe, wahlweise mit Bonus.
 *
 * Das ist DIE Stelle, an der aus Katalogwerten Kampfwerte werden: erst die
 * Stufe, dann der Bonus, beides hier und nirgends im Kampf. Wer nachrechnen
 * will, warum eine Dorfwache im Kampf 780 Leben hatte, liest nur diese
 * Funktion und die Tabelle in synergien.ts.
 *
 * Gerundet, weil Leben und Angriff als ganze Zahlen angezeigt werden und ein
 * Kampf, der mit 989.9999999 rechnet, bei gleichem Seed auf zwei Rechnern
 * verschieden enden koennte (Grundsatz 1). Das Tempo wird auf Tausendstel
 * gerundet — der Kampf macht daraus ohnehin ganze Takte, aber ein Wert wie
 * 0.7475000000000001 in der Sicht saehe nach einem Fehler aus.
 */
export function werteFuer(id: EinheitId, stufe: Stufe, bonus: Wertebonus = KEIN_BONUS): Grundwerte {
  const e = einheit(id);
  const faktor = STUFEN_FAKTOR[stufe];
  return {
    leben: Math.round((e.leben * faktor * (100 + bonus.lebenProzent)) / 100),
    angriff: Math.round((e.angriff * faktor * (100 + bonus.angriffProzent)) / 100),
    tempo: Math.round(e.tempo * (100 + bonus.tempoProzent) * 10) / 1000,
    reichweite: e.reichweite,
    ruestung: Math.min(RUESTUNG_HOECHSTWERT, e.ruestung + bonus.ruestung),
  };
}

/**
 * Was eine Einheit auf dieser Stufe im Laden gekostet HAETTE.
 *
 * Braucht man beim Verkaufen: Eine Stufe-2-Einheit steckt voller drei Karten,
 * gibt also das Dreifache zurueck. Ohne diese Rechnung waere Verschmelzen ein
 * Weg, Gold zu vernichten — und niemand wuerde je eine verschmolzene Einheit
 * wieder hergeben.
 */
export function gesamtkosten(id: EinheitId, stufe: Stufe): number {
  return einheit(id).kosten * VERSCHMELZ_ZAHL ** (stufe - 1);
}

/**
 * Wie viele Karten aus dem Vorrat in einer Einheit dieser Stufe stecken.
 *
 * Beim Verkaufen wandern GENAU so viele zurueck. Vergaesse man das, waere der
 * Vorrat nach ein paar Runden leer und der Laden bliebe leer — der haesslichste
 * denkbare Fehler, weil er erst spaet in der Partie auffaellt.
 */
export function kartenZahl(stufe: Stufe): number {
  return VERSCHMELZ_ZAHL ** (stufe - 1);
}
