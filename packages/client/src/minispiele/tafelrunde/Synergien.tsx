/**
 * Die Synergien von Tafelrunde am Bildschirm.
 *
 * Marken-Boni entstehen im Spielmodul (packages/game-tafelrunde/src/
 * synergien.ts) und stehen fertig gerechnet in der Sicht: je Sitz die Liste
 * `synergien` (Marke, Anzahl auf dem BRETT, erreichte und naechste Schwelle,
 * geltender Bonus) und einmalig beim Beitritt die Tabelle `synergieTabelle`
 * mit allen Stufen.
 *
 * HIER WIRD NICHTS GERECHNET. Diese Datei zaehlt keine Marken ab, kennt
 * keine Schwellen und kein einziges Bonus-Zahlenpaar — sie zeichnet, was in
 * der Sicht steht. Das ist nicht Bequemlichkeit, sondern dieselbe Regel wie
 * bei `verschmelzZahl` und `feldplaetze` im Bildschirm daneben: Wer die
 * Schwellen im Modul auf 3/5/7 stellte, bekaeme sonst eine Leiste, die bei
 * zwei Kriegern einen Bonus verspricht, den es nicht gibt. Die einzigen
 * Rechnungen sind Subtraktionen zweier Zahlen AUS DER SICHT ("noch 1 bis 4"
 * aus `naechsteSchwelle - anzahl`, "dieser Kauf trifft" aus `anzahl + 1 >=
 * naechsteSchwelle`).
 *
 * Vier Orte zeigen dieselbe Sache, deshalb stehen sie in einer Datei:
 *   - die LEISTE mit einem Eintrag je Marke (Anzahl, Schwellen als Punkte,
 *     Bonus als Satz),
 *   - dieselben Eintraege, nur kleiner, als ZEILE UNTER DEM BRETTTITEL DES
 *     GEGNERS — sein Brett ist oeffentlich, also sind es seine Marken,
 *   - die MARKEN AN EINER EINHEIT auf Bank und Brett (nur Zeichen, kein
 *     Text — dort ist kein Platz),
 *   - dieselben Zeichen auf der LADENKARTE, wo eins hervortritt, wenn der
 *     Kauf eine Schwelle erreicht.
 * Zeichen und Farbe kommen fuer alle vier aus `MARKEN_ZEICHEN` und
 * `MARKEN_FARBE` — sonst haette die Leiste einen gruenen Punkt fuer eine
 * Marke, die an der Einheit blau ist, und niemand brauchte lange, um beides
 * fuer zwei verschiedene Dinge zu halten.
 */

import { createContext, useContext, useMemo } from 'react';

import stil from './Synergien.module.css';

// ---------------------------------------------------------------------------
// Was das Modul liefert — Abschrift von synergien.ts
// ---------------------------------------------------------------------------

/*
 * Der Client kennt die Spielmodule nicht (siehe Kopf von
 * screens/Tafelrunde.tsx), deshalb stehen die Formen hier noch einmal. Die
 * Marke ist bewusst `string` und kein Vereinigungstyp: Eine achte Marke im
 * Katalog soll eine unbekannte Farbe bekommen und keinen Uebersetzungsfehler
 * an einer Stelle, die das Spiel gar nicht kennt — die Namen kommen ohnehin
 * aus der Sicht.
 */

export interface Wertebonus {
  lebenProzent: number;
  angriffProzent: number;
  tempoProzent: number;
  ruestung: number;
}

export interface Synergiestufe {
  schwelle: number;
  bonus: Wertebonus;
}

/** Eine ganze Marke mit allen Stufen — kommt einmalig als `synergieTabelle`. */
export interface Synergie {
  marke: string;
  name: string;
  stufen: Synergiestufe[];
}

/** Der Stand einer Marke auf einem Brett — kommt in jeder Sicht. */
export interface Synergiestand {
  marke: string;
  name: string;
  anzahl: number;
  /** Die erreichte Schwelle, null unterhalb der ersten. */
  schwelle: number | null;
  /** Die naechste Schwelle, null ab der hoechsten. */
  naechsteSchwelle: number | null;
  /** Der geltende Bonus, null unterhalb der ersten Schwelle. */
  bonus: Wertebonus | null;
}

// ---------------------------------------------------------------------------
// Farbe und Zeichen je Marke
// ---------------------------------------------------------------------------

/**
 * Die Farbe einer Marke. Reine Zeichnung und kein Bedeutungstraeger der
 * Plattform — deshalb hier und nicht als CSS-Variable in styles.css, genau
 * wie `KOSTEN_FARBE` in Zeichen.tsx (DESIGN.md: die Variablen sind fuer
 * Gruen/Gold/Lila/Rot reserviert, und eine Klassen-Marke ist keins davon).
 *
 * Die Farbe steht NIE allein: Jede Marke hat zusaetzlich ihr eigenes
 * Zeichen. Sieben Farben, die sich auf einem 8-mm-Punkt unterscheiden
 * lassen, gibt es nicht — und schon gar nicht fuer jemanden mit einer
 * Farbsehschwaeche.
 */
export const MARKEN_FARBE: Record<string, string> = {
  krieger: '#d8724f',
  elementar: '#57b0f2',
  meuchler: '#b085ee',
  waechter: '#63c2b4',
  naturwesen: '#6cc06a',
  untot: '#9fb0bd',
  drache: '#f0a03c',
};

/** Fuer eine Marke, die dieser Client noch nicht kennt. */
const ERSATZFARBE = '#8fa3ad';

/**
 * Das Zeichen einer Marke — gezeichnet, nicht geladen.
 *
 * Dieselbe Bauart wie `RollenZeichen` in Zeichen.tsx: Striche auf 24 x 24,
 * `currentColor`. Ein `<img>` auf eine Datei, die es nicht gibt, waere ein
 * weisser Kasten (CLAUDE.md), und sieben winzige Bilder je Einheit auf
 * neunzehn Feldern waeren ausserdem neunzehn Ladevorgaenge fuer nichts.
 */
const MARKEN_ZEICHEN: Record<string, React.JSX.Element> = {
  // Gekreuzte Klingen.
  krieger: <path d="M4 20 20 4M16 4h4v4M20 20 4 4M8 4H4v4" />,
  // Flamme.
  elementar: <path d="M12 21c3.1 0 5.5-2.2 5.5-5.2 0-3.8-4-5.4-4-9.8-2.6 1.4-4 3.7-4 5.8 0 1.6-1.2 1.9-1.7 1-1 1.4-1.3 2.4-1.3 3.5C6.5 18.8 8.9 21 12 21Z" />,
  // Dolch.
  meuchler: <path d="M12 3 14 9v2h-4V9l2-6ZM8.5 11h7M12 11v10" />,
  // Schild mit Band.
  waechter: <path d="M12 3 5 6v6c0 4.6 3 7.7 7 8.8 4-1.1 7-4.2 7-8.8V6l-7-3ZM8.5 12h7" />,
  // Blatt.
  naturwesen: <path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14ZM8 16c2-4 4.5-6.5 8.5-8.5" />,
  // Schaedel.
  untot: <path d="M12 3a7 7 0 0 0-7 7v3l2 2v3h10v-3l2-2v-3a7 7 0 0 0-7-7ZM9.3 10.5h.01M14.7 10.5h.01" />,
  // Krallenspur.
  drache: <path d="M6 4c1 6 3 10.5 6 14M11.5 3c0 6 .8 11.5 2.5 15M17 4c-1 6-1 11.5 0 15" />,
};

/**
 * Die Anzeigenamen aus der Tabelle der Sicht, als Nachschlagewerk.
 *
 * Der Name gehoert dem Modul und nicht dem Client (siehe `Synergie.name` in
 * synergien.ts) — hier wird er nur umsortiert, damit ein Zeichen an einer
 * Einheit ihn ohne die ganze Tabelle findet.
 */
export function markennamen(tabelle: readonly Synergie[]): Record<string, string> {
  return Object.fromEntries(tabelle.map((s) => [s.marke, s.name]));
}

/**
 * Die Namen fuer die Zeichen tief im Baum.
 *
 * Als Kontext und nicht als Eigenschaft: Ein Zeichen sitzt an jeder Einheit,
 * also unter `Hexbrett` (18 Eigenschaften) und unter der Bank und unter dem
 * Zugschatten. Der Name waere die neunzehnte durchgereichte Eigenschaft fuer
 * eine Zeichenkette, die sich waehrend einer Partie nie aendert.
 */
export const Markennamen = createContext<Record<string, string>>({});

// ---------------------------------------------------------------------------
// Die Rechnungen — beides Vergleiche zweier Zahlen aus der Sicht
// ---------------------------------------------------------------------------

/**
 * Der Bonus als Satz: "+15 % Leben · +10 Rüstung".
 *
 * Die Zahlen kommen aus der Sicht, die Reihenfolge ist fest (Leben, Angriff,
 * Tempo, Rüstung), und was null ist, faellt weg — sonst stuende an jeder
 * Marke dreimal "+0 %". Prozent bei den ersten dreien und feste Punkte bei
 * der Rüstung, weil das Modul es so meint (Wertebonus in katalog.ts).
 */
export function bonusSatz(bonus: Wertebonus | null): string {
  if (!bonus) return '';
  const teile: string[] = [];
  if (bonus.lebenProzent > 0) teile.push(`+${bonus.lebenProzent} % Leben`);
  if (bonus.angriffProzent > 0) teile.push(`+${bonus.angriffProzent} % Angriff`);
  if (bonus.tempoProzent > 0) teile.push(`+${bonus.tempoProzent} % Tempo`);
  if (bonus.ruestung > 0) teile.push(`+${bonus.ruestung} Rüstung`);
  return teile.join(' · ');
}

/**
 * Wuerde EIN weiterer Traeger dieser Marke eine Schwelle erreichen?
 *
 * Genau die Rechnung aus der Aufgabe: `anzahl + 1 >= naechsteSchwelle`.
 * Beide Zahlen stehen in der Sicht. Steht die Marke noch gar nicht auf dem
 * Brett, fehlt sie in `synergien` (das Modul schickt nur Marken mit
 * mindestens einem Traeger) — dann liefert die Tabelle die erste Stufe. Auch
 * sie ist Sicht und keine 2 im Client: Wer die Schwellen im Modul
 * verschoebe, bekaeme sonst hier ein Leuchten fuer einen Bonus, den es nicht
 * gibt.
 */
export function trifftSchwelle(
  marke: string,
  staende: readonly Synergiestand[],
  tabelle: readonly Synergie[],
): boolean {
  const stand = staende.find((s) => s.marke === marke);
  const naechste = stand
    ? stand.naechsteSchwelle
    : (tabelle.find((s) => s.marke === marke)?.stufen[0]?.schwelle ?? null);
  if (naechste === null) return false;
  return (stand?.anzahl ?? 0) + 1 >= naechste;
}

/**
 * Ein Pruefer fuer alle Marken einer Einheit — dieselbe Frage, einmal
 * gebunden. Der Laden stellt sie zweimal je Karte (einmal fuer den Rahmen,
 * einmal je Zeichen), und beide Antworten muessen dieselben sein.
 */
export function schwellenPruefer(
  staende: readonly Synergiestand[],
  tabelle: readonly Synergie[],
): (marke: string) => boolean {
  return (marke) => trifftSchwelle(marke, staende, tabelle);
}

/**
 * Was unter einer Marke steht — der aktive Bonus und was als Naechstes kommt.
 *
 * Ohne Tabelle (sie kommt erst mit der ersten Sicht) bleibt der Satz beim
 * Aktiven: Eine erfundene Zahl waere schlimmer als eine fehlende Zeile.
 */
export function standSatz(stand: Synergiestand, synergie: Synergie | undefined): string {
  const teile: string[] = [];
  if (stand.schwelle !== null && stand.bonus) {
    teile.push(`ab ${stand.schwelle}: ${bonusSatz(stand.bonus)}`);
  }
  const naechste = stand.naechsteSchwelle;
  if (naechste !== null) {
    const stufe = synergie?.stufen.find((s) => s.schwelle === naechste);
    const fehlt = naechste - stand.anzahl;
    teile.push(
      stufe
        ? `noch ${fehlt} bis ${naechste}: ${bonusSatz(stufe.bonus)}`
        : `noch ${fehlt} bis ${naechste}`,
    );
  }
  return teile.join(' · ');
}

// ---------------------------------------------------------------------------
// Die Zeichen an einer Einheit
// ---------------------------------------------------------------------------

/**
 * Die Marken einer Einheit als kleine Zeichen — kein Text.
 *
 * Auf einer Wabe und erst recht auf einem 44-px-Bankplatz ist fuer ein Wort
 * kein Platz; auf der Ladenkarte waere es die vierte Zeile. Deshalb Zeichen
 * und Farbe, beide dieselben wie in der Leiste.
 *
 * `beschriftet` gibt es fuer den LADEN: Dort ist die Karte eine
 * Schaltflaeche, ihr Name entsteht aus ihrem Inhalt, und "Dorfwache, Wache,
 * Krieger" ist genau die Auskunft, die ein Vorlesegeraet fuer die
 * Kaufentscheidung braucht. Auf Bank und Brett bleibt es aus: Dort traegt
 * die Einheit ein eigenes `aria-label`, und neunzehn Felder mit je zwei
 * zusaetzlich vorgelesenen Woertern waeren Laerm.
 */
export function Markenzeichen({
  marken,
  trifft,
  beschriftet,
  ort,
}: {
  marken: readonly string[];
  /** Erreicht ein weiterer Traeger dieser Marke eine Schwelle? Dann leuchtet sie. */
  trifft?: (marke: string) => boolean;
  beschriftet?: boolean;
  /**
   * Wo die Zeichen sitzen. Die Wahl trifft der AUFRUFER, die Masse stehen
   * hier: An der Einheit haengen sie absolut in der Ecke und sind winzig, im
   * Laden stehen sie mittig unter dem Namen. Ein Klassenname von aussen
   * hiesse, das Stylesheet dieses Bauteils anderswo zu kennen.
   */
  ort?: 'einheit' | 'laden';
}): React.JSX.Element | null {
  const namen = useContext(Markennamen);
  if (marken.length === 0) return null;
  const ortKlasse = ort === 'einheit' ? stil.anEinheit : ort === 'laden' ? stil.imLaden : '';
  return (
    <span
      className={`${stil.reihe} ${ortKlasse}`.trim()}
      aria-hidden={beschriftet ? undefined : true}
    >
      {marken.map((marke) => {
        const name = namen[marke] ?? marke;
        return (
          <span
            key={marke}
            className={stil.zeichen}
            style={{ color: MARKEN_FARBE[marke] ?? ERSATZFARBE }}
            data-trifft={trifft?.(marke) ? '' : undefined}
            title={name}
          >
            <svg className={stil.glyphe} viewBox="0 0 24 24" aria-hidden="true">
              {MARKEN_ZEICHEN[marke] ?? <circle cx="12" cy="12" r="7" />}
            </svg>
            {beschriftet && <span className={stil.nurVorlesen}>{name}</span>}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Der Klassenname fuer eine Ladenkarte, deren Kauf eine Schwelle trifft.
 *
 * Als Konstante hinaus und nicht als eigenes Bauteil: Die Karte selbst steht
 * nebenan (Ladenkarte.tsx) und traegt ihre eigenen Klassen; hier kommt nur
 * die eine dazu, deren Aussehen in dieses Modul gehoert.
 */
export const KARTE_TRIFFT: string = stil.karteTrifft;

// ---------------------------------------------------------------------------
// Ein Zaehler — einmal, fuer beide Orte
// ---------------------------------------------------------------------------

/**
 * Der Chip einer Marke: Zeichen, Zaehler, und die ganze Auskunft am Zeiger
 * und fuer das Vorlesegeraet.
 *
 * Er steht in der eigenen Leiste UND unter dem Bretttitel des gezeigten
 * Gegners. Zwei Abschriften waeren zwei Wahrheiten: Beim ersten Mal, dass
 * jemand den Zaehler von "3/4" auf "3 von 4" umstellt, saehe der Gegner
 * anders aus als man selbst, obwohl beides dieselbe Zahl aus derselben Sicht
 * ist. Unterschiedlich ist allein die GROESSE, und die entscheidet `klasse`.
 */
function Markenchip({
  stand,
  synergie,
  klasse,
}: {
  stand: Synergiestand;
  synergie: Synergie | undefined;
  klasse: string;
}): React.JSX.Element {
  const farbe = MARKEN_FARBE[stand.marke] ?? ERSATZFARBE;
  const satz = standSatz(stand, synergie);
  /*
   * „2/4“, solange es eine naechste Schwelle gibt, sonst nur die Zahl:
   * Auf der hoechsten Stufe waere jeder Nenner erfunden.
   */
  const zaehler =
    stand.naechsteSchwelle !== null
      ? `${stand.anzahl}/${stand.naechsteSchwelle}`
      : `${stand.anzahl}`;
  return (
    <li
      className={klasse}
      /* Aktiv heisst: Die Sicht nennt eine erreichte Schwelle. Nicht
         "anzahl >= 2" — die 2 stuende dann im Client. */
      data-aktiv={stand.schwelle !== null ? '' : undefined}
      style={{ '--marke': farbe } as React.CSSProperties}
      /* Am Zeiger die ganze Auskunft. Am Handy gibt es keinen Zeiger;
         dort ist der Vorlese-Text unten dieselbe Auskunft. */
      title={satz ? `${stand.name} · ${satz}` : stand.name}
    >
      <span className={stil.zeichen} style={{ color: farbe }}>
        <svg className={stil.glyphe} viewBox="0 0 24 24" aria-hidden="true">
          {MARKEN_ZEICHEN[stand.marke] ?? <circle cx="12" cy="12" r="7" />}
        </svg>
      </span>
      <span className={stil.zahl} aria-hidden="true">
        {zaehler}
      </span>
      {/* Der ganze Satz fuer das Vorlesegeraet. Sichtbar waere er
          genau die Textliste, die diese Leiste losgeworden ist. */}
      <span className={stil.nurVorlesen}>
        {stand.name}: {stand.anzahl}
        {stand.naechsteSchwelle !== null ? ` von ${stand.naechsteSchwelle}` : ''}
        {satz ? ` · ${satz}` : ''}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Die Leiste
// ---------------------------------------------------------------------------

/**
 * Die Synergie-Leiste — kleine Zähler, keine Textliste.
 *
 * Je Marke ein Chip: das Zeichen, dann die Anzahl gegen die nächste Schwelle
 * („2/4"). Bis zum 05.09.2026 stand hier eine Liste mit Name, Punktreihe und
 * ganzem Bonussatz je Marke — bei sieben Marken über 200 px Höhe, und die
 * gingen dem Brett ab. Der Satz ist nicht verloren: Er steht als Vorlese-Text
 * im Chip und als `title` am Zeiger.
 *
 * WO SIE STEHT, entscheidet weiterhin allein das Stylesheet
 * (Synergien.module.css): am Handy als Reihe über dem Brett, ab 75rem als
 * Spalte an der linken Kante. Zugeklappt wird nichts mehr — eine Reihe aus
 * 22 px hohen Chips ist nichts, was man wegräumen müsste, und der Klappknopf
 * war selbst so hoch wie sie.
 *
 * `staende` kommt aus der Sicht und ist die einzige Wahrheit über Anzahl und
 * Schwelle. Die Tabelle steuert nur den Bonus-Satz bei; fehlt sie noch,
 * bleibt der Satz kürzer und der Zähler steht trotzdem da.
 */
export function Synergieleiste({
  staende,
  tabelle,
}: {
  staende: readonly Synergiestand[];
  tabelle: readonly Synergie[];
}): React.JSX.Element {
  const nachMarke = useMemo(() => new Map(tabelle.map((s) => [s.marke, s])), [tabelle]);

  return (
    <section className={stil.leiste} aria-label="Synergien">
      <ul className={stil.liste}>
        {staende.length === 0 && (
          <li className={stil.leer}>
            Noch keine Marken auf dem Feld — jeder Recke bringt ein bis zwei mit.
          </li>
        )}
        {staende.map((stand) => (
          <Markenchip
            key={stand.marke}
            stand={stand}
            synergie={nachMarke.get(stand.marke)}
            klasse={stil.chip}
          />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Die Marken eines fremden Bretts
// ---------------------------------------------------------------------------

/**
 * Die schmale Markenzeile unter dem Bretttitel des gezeigten Gegners.
 *
 * Warum es sie gibt: Das gegnerische Brett ist oeffentlich, und `sicht.ts`
 * legt an JEDEN Gegner dasselbe Feld `synergien`, das auch der eigene Sitz
 * bekommt. Am Bildschirm kam davon bis zum 05.09.2026 nichts an — wer wissen
 * wollte, ob der Gegner auf sechs Waechter zugeht, musste dessen Figuren
 * einzeln abzaehlen. Genau diese Frage beantwortet die Zeile in einem Blick.
 *
 * Dieselben Chips wie in der eigenen Leiste, nur kleiner: Das Brett darueber
 * ist schmal, und die Zeile soll ihm keine Hoehe nehmen. Ein zweites Aussehen
 * fuer dieselbe Sache waere zudem eine zweite Zeichensprache — die Farben und
 * Zeichen sind ja bereits die von den Figuren auf dem Brett darunter.
 *
 * Steht keine Marke auf dem fremden Brett (erste Runde, oder ein Tisch aus
 * der Zeit vor den Synergien — dort fehlt das Feld ganz), kommt gar nichts:
 * Ein „Noch keine Marken" ist eine Aufforderung, und aufzustellen hat man auf
 * dem Brett des Gegners nichts.
 */
export function Fremdmarken({
  staende,
  tabelle,
  beschriftung,
}: {
  staende: readonly Synergiestand[];
  tabelle: readonly Synergie[];
  /**
   * Wessen Marken das sind, fuer das Vorlesegeraet — z. B. „Marken von Ada".
   * Sichtbar steht der Name schon im Bretttitel direkt darueber; ein Vorleser
   * springt aber in Listen hinein, ohne die Ueberschrift davor gehoert zu
   * haben.
   */
  beschriftung: string;
}): React.JSX.Element | null {
  const nachMarke = useMemo(() => new Map(tabelle.map((s) => [s.marke, s])), [tabelle]);

  if (staende.length === 0) return null;

  return (
    <ul className={stil.fremdzeile} aria-label={beschriftung}>
      {staende.map((stand) => (
        <Markenchip
          key={stand.marke}
          stand={stand}
          synergie={nachMarke.get(stand.marke)}
          klasse={`${stil.chip} ${stil.fremd}`}
        />
      ))}
    </ul>
  );
}
