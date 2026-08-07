/**
 * Feldherr — Spielkern des Clients.
 *
 * MASCHINELL ERZEUGT aus den Modulen unter packages/game-feldherr/quelle/
 * teile/ durch packages/game-feldherr/werkzeug/bauen.mjs.
 * Nicht von Hand aendern — die Teile anpassen und neu bauen.
 *
 * Der Kern zeichnet auf eine Leinwand und findet seine Teile ueber
 * getElementById. Er kennt kein React und soll es nicht kennen: Er muss auf
 * beiden Geraeten Zeichen fuer Zeichen gleich rechnen. Sein Spielzufall kommt
 * ausschliesslich aus saat(); alles Sichtbare ohne Spielwirkung zieht aus
 * deko().
 */

export const STIL = "<<STIL>>";

export const HUELLE = "<<HUELLE>>";

/**
 * Startet eine Partie in der bereits eingehaengten Huelle.
 *
 * Oertlich (`netz` fehlt) rechnet der Kern wie bisher mit der Bildzeit.
 * Im Netzspiel uebernimmt der Gleichschritt: feste Takte, Befehle als Zuege.
 */
export function starteFeldherr(optionen = {}) {
  const {
    modus = 'ki',
    stufe = 'normal',
    feld = 'mittel',
    saat: korn,
    aufEnde,
    aufStrittig,
    netz = null,
    sitz = 1,
  } = optionen;

  let laeuft = true;
  const NETZ = netz;
  const MEIN_SITZ = sitz;

  /** Warteschlange: Takt -> Zuege, die in diesem Takt auszufuehren sind. */
  const geplant = new Map();
  let taktZaehler = 0;
  let restMs = 0;
  /** Muessen mit TAKT_MS und VORLAUF_TAKTE aus @brauweg/game-feldherr uebereinstimmen. */
  const TAKT_MS = 50;
  const VORLAUF = 6;
  /**
   * Sicherheitsabstand beim Einplanen eigener Zuege, zusaetzlich zum Vorlauf.
   *
   * Der gemeldete Gegnerstand hinkt dem echten um bis zu einen Pulsabstand
   * plus Leitungszeit hinterher. Wer nur den Vorlauf draufschlaegt, plant
   * seinen Zug damit gelegentlich fuer einen Takt, den die Gegenseite beim
   * Eintreffen schon gerechnet hat — deren Notnagel verschiebt ihn dann
   * still, und die Partie laeuft unbemerkt auseinander, bis die
   * Zustandsprobe sie fuer strittig erklaert. Genau so ist ein Haus-Zug
   * nach einem Tabwechsel zerbrochen.
   *
   * Die Sicherheit haengt an zwei Zusagen, beide vom ABSENDER und damit
   * unabhaengig von der Leitungszeit: Geplant wird bei mindestens
   * Stand+VORLAUF+PUFFER, und solange ein eigener Zug schwebt, meldet der
   * Herzschlag hoechstens den Stand seiner Planung (siehe melden). Die
   * Gegenseite (Grenze: gemeldeter Stand+VORLAUF+PUFFER-1) wartet dadurch
   * exakt VOR jedem schwebenden Zug. Vier Takte Puffer bedeuten eine halbe
   * Sekunde Reaktionszeit aufs eigene Legen.
   */
  const MELDE_PUFFER = 4;
  /** Herzschlag-Abstand nach Wanduhr. Deutlich unter VORLAUF * TAKT_MS, sonst
   *  stockt die Gegenseite zwischen zwei Pulsen. 100 ms statt 200: Je
   *  frischer der gemeldete Stand, desto enger folgt die Gegenseite — und
   *  desto kuerzer darf der Meldepuffer sein. Das Gateway nimmt die Pulse
   *  dafuer aus seinem Nachrichtenfenster aus. */
  const PULS_MS = 100;
  /** Abstand der Zustandsproben in Takten. */
  const PROBE_TAKTE = 40;

  /**
   * Letzter gemeldeter Takt je Gegensitz. Daraus entsteht die Wissensgrenze:
   * Die Gegenseite plant Zuege fruehestens fuer ihren Takt plus Vorlauf ein —
   * bis dorthin (ausschliesslich) ist die eigene Rechnung sicher.
   */
  const gegnerStand = { 0: 0, 1: 0 };
  /** Eigene Pruefsummen an den 40er-Grenzen, fuer den Abgleich. */
  const proben = new Map();
  /** Gemeldete Summen der Gegenseite, bis die eigene Grenze erreicht ist. */
  const fremdeProben = new Map();
  let strittigGemeldet = false;

  /**
   * Takt fuer den naechsten eigenen Zug. Streng aufsteigend, denn der Server
   * lehnt zwei Zuege desselben Sitzes im selben Takt ab; und nie hinter dem
   * Gegnerstand, sonst laege der Zug beim Aufholen in dessen Vergangenheit.
   */
  let letzterMeldeTakt = 0;
  function planTakt() {
    let basis = taktZaehler;
    for (const s of [0, 1]) if (s !== MEIN_SITZ) basis = Math.max(basis, gegnerStand[s]);
    const t = Math.max(basis + VORLAUF + MELDE_PUFFER, letzterMeldeTakt + 1);
    letzterMeldeTakt = t;
    return t;
  }

  /**
   * Eigene Zuege schweben, bis der Server sie zurueckgespielt hat. Solange
   * einer schwebt, meldet der Herzschlag hoechstens den Stand seiner
   * Planung. Ohne den Deckel ueberholt der Puls den Zug im Server — der
   * Zug wartet dort auf die Datenbank, der Puls nicht —, die Gegenseite
   * laeuft ueber den Zugtakt hinaus, und der Zug kommt zu spaet an: genau
   * der Notnagel-Fall, der Partien strittig machte. Mit dem Deckel wartet
   * die Gegenseite exakt VOR dem schwebenden Zug, bis die Sicht ihn
   * bringt; da jede Leitung ihre Reihenfolge wahrt, kommt kein spaeter
   * gemeldeter Stand vor dem Zug an.
   *
   * Der Verfall deckt den Fall, dass der Server einen Zug ablehnt: Ein
   * Geisterzug froere den gemeldeten Stand sonst fuer immer ein.
   */
  const schwebend = [];
  const SCHWEBE_VERFALL_MS = 4000;
  /**
   * Sofortige Lege-Vorschau: Zwischen Fingertipp und Ausfuehrung liegt eine
   * halbe Sekunde Gleichschritt — ohne sichtbare Reaktion fuehlt sich das
   * wie Eingabe-Lag an, obwohl alles planmaessig laeuft. Der pulsierende
   * Rahmen auf dem Zielfeld erscheint im selben Bild wie der Tipp und
   * verschwindet, sobald der Takt den Zug ausfuehrt. Reine Zeichnung,
   * beruehrt den Zustand nicht.
   */
  let vorschau = [];
  function melden(zug) {
    const takt = planTakt();
    schwebend.push({ takt, seit: performance.now() });
    if (zug.r !== undefined && zug.c !== undefined) {
      vorschau.push({ takt, r: zug.r, c: zug.c });
    }
    NETZ.melde({ ...zug, takt });
  }

