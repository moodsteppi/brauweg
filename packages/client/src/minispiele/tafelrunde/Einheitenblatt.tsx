/**
 * Was ein angetippter Recke ueber sich erzaehlt: Werte, Marken, und was man
 * mit ihm tun kann.
 *
 * BIS ZUM 6.9.2026 STAND DAS NIRGENDS. Unter der Figur klebten Name und
 * Sterne, bei langen Namen abgeschnitten ("Steinschleu…"), und wer wissen
 * wollte, ob der Recke fuer drei Gold weit schiesst oder vorne haelt, konnte
 * nur raten. Ein Tipp auf eine Einheit waehlte sie bloss aus — er gab keine
 * Auskunft.
 *
 * JEDE ZAHL DARIN KOMMT AUS DER SICHT, und zwar fertig gerechnet. Der Katalog
 * nennt nur die Werte der ersten Stufe; was eine verschmolzene Einheit
 * mitbringt, steht in `stufenwerte` (sicht.ts im Modul). Hier wird nichts
 * multipliziert: WELCHER Wert mit der Sternstufe waechst — Leben und Angriff,
 * aber nicht Tempo, Reichweite und Ruestung — ist eine Regel des Moduls, und
 * eine Abschrift davon liefe beim ersten geaenderten Faktor auseinander
 * (CLAUDE.md, "was das Modul weiss, schreibt der Client nicht ab"). Dasselbe
 * gilt fuer den Verkaufserloes: `kosten * 3` waere die Erstattungsregel ein
 * zweites Mal.
 *
 * WAS ES NICHT GIBT, STEHT AUCH NICHT DRIN. Das Vorbild zeigt einen
 * Faehigkeitstext ("was sie zu Kampfbeginn tut") und einen Kritisch-Wert —
 * beides kennt der Katalog nicht, und Tafelrunde kennt es auch als Regel
 * nicht: Der Kampf rechnet mit Leben, Angriff, Tempo, Reichweite und
 * Ruestung, sonst nichts (kampf.ts). Erfunden wird davon keins. An die Stelle
 * des Faehigkeitstextes tritt, was diese Einheit WIRKLICH ueber ihre Werte
 * hinaus mitbringt: ihre Marken, jede mit dem Satz aus dem Modul.
 *
 * Es liegt als Ueberblender ueber dem Brett und nicht daneben — dieselbe
 * Bauart wie das Markenblatt in Synergien.tsx, und aus demselben Grund: Am
 * Handy ist neben dem Brett nichts.
 *
 * ES IST SEIT DEM 18.09.2026 DER WEG ZUR MARKE. Die Zeichen an einer Einheit
 * auf Bank und Brett bleiben stumm — sie stehen auf `pointer-events: none`,
 * damit sie den Finger nicht von der Wabe abfangen (die ganze Wabe ist Greif-
 * und Ablegeflaeche). Hier ist Platz, hier stehen die Marken ohnehin mit
 * Namen, und hier sind sie tippbar: Ein Tipp schlaegt das Markenblatt mit
 * Wirkung, Stufen und Traegern auf (`onMarke`).
 *
 * UND ES STEHT AUCH IM LADEN. Eine Ladenkarte ist selbst eine Schaltflaeche,
 * in die kein zweiter Knopf hineindarf; ihr Griff daneben schlaegt dieses
 * Blatt fuer die ANGEBOTENE Einheit auf — Werte, Marken und von dort die
 * Marke selbst. Erkennbar ist die Vorschau an dem, was sie anbietet: `onKaufen`
 * statt Verschieben, Ablegen und Verkaufen. Ein eigenes Bauteil dafuer waere
 * eine zweite Fassung derselben Auskunft gewesen; beim ersten neuen Kampfwert
 * haette der Laden etwas anderes gezeigt als das Brett.
 */

import { useEffect } from 'react';

import { Markenzeichen } from './Synergien';
import type { Synergie } from './Synergien';
import { EinheitenFigur, GoldZeichen, LebenZeichen, ROLLE_NAME, kostenFarbe } from './Zeichen';
import type { Einheit, Stufenwerte } from './sicht';
import type { Kaempfer } from './zuege';

import stil from './Einheitenblatt.module.css';

/**
 * Die vier Kampfwerte neben dem Leben — gezeichnet, nicht geladen.
 *
 * Dieselbe Bauart wie `RollenZeichen` in Zeichen.tsx und die Markenzeichen in
 * Synergien.tsx: Striche auf 24 x 24 in `currentColor`. Ein `<img>` auf eine
 * Datei, die es nicht gibt, waere ein weisser Kasten (CLAUDE.md).
 */
const WERT_ZEICHEN: Record<string, React.JSX.Element> = {
  // Schwert.
  schaden: <path d="M14 3h7v7M20.5 3.5 12 12M12 12l-2.5 2.5M12 12 9.5 9.5M9 12l3 3-5.5 5.5-3-3L9 12Z" />,
  // Stoppuhr.
  tempo: <path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5M9.5 3h5" />,
  // Bogenschuss.
  reichweite: <path d="M3 12h13M16 12l-4-4M16 12l-4 4M19 5v14" />,
  // Schild.
  ruestung: <path d="M12 3 5 6v6c0 4.6 3 7.7 7 8.8 4-1.1 7-4.2 7-8.8V6l-7-3Z" />,
};

function Wertzeichen({ art }: { art: string }): React.JSX.Element {
  return (
    <svg className={stil.wertglyphe} viewBox="0 0 24 24" aria-hidden="true">
      {WERT_ZEICHEN[art]}
    </svg>
  );
}

/**
 * Eine Zahl mit Zeichen und Beschriftung.
 *
 * Die EINHEIT steht dabei am Wert und nicht in der Ueberschrift ("2,1 /s",
 * "3 Felder"): Zwei Zahlen ohne Masseinheit nebeneinander liest man als
 * vergleichbar, und Tempo und Reichweite sind es nicht.
 */
function Wert({
  art,
  titel,
  zahl,
  einheit,
}: {
  art: string;
  titel: string;
  zahl: string;
  einheit?: string;
}): React.JSX.Element {
  return (
    <li className={stil.wert}>
      <Wertzeichen art={art} />
      <span className={stil.wertzahl}>
        {zahl}
        {einheit && <small className={stil.werteinheit}>{einheit}</small>}
      </span>
      <span className={stil.werttitel}>{titel}</span>
    </li>
  );
}

/**
 * Das Tempo als Text.
 *
 * `tempo` sind Angriffe je Sekunde und kommen als Bruchzahl (0,65). Mit
 * deutschem Komma und hoechstens zwei Stellen — die dritte gibt es im Katalog
 * nicht, und `toFixed(2)` machte aus 0,7 ein "0,70", was nach mehr Genauigkeit
 * aussieht, als dahintersteckt.
 */
export function tempoText(tempo: number): string {
  return String(Math.round(tempo * 100) / 100).replace('.', ',');
}

export function Einheitenblatt({
  einheit,
  kaempfer,
  werte,
  tabelle,
  maxStufe,
  erloes,
  onVerkaufen,
  onKaufen,
  onAblegen,
  onMarke,
  onVerschieben,
  verschiebenTitel,
  escapeAus,
  onSchliessen,
}: {
  einheit: Einheit;
  kaempfer: Kaempfer;
  /**
   * Die Werte auf DIESER Sternstufe, aus der Sicht. Fehlt, solange ein Tisch
   * aus der Zeit vor `stufenwerte` laeuft — dann bleibt der Wertekasten weg,
   * statt dass hier die Grundwerte als Kampfwerte ausgegeben werden.
   */
  werte: Stufenwerte | undefined;
  /** Die Synergie-Tabelle der Sicht, fuer den Satz je Marke. */
  tabelle: readonly Synergie[];
  maxStufe: number;
  /**
   * Was ein Verkauf einbringt — aus der Sicht, nie `kosten * 3`. Fehlt sie,
   * bleibt der Knopf ohne Zahl statt mit einer geratenen.
   */
  erloes: number | undefined;
  /** Fehlt, wenn der Server den Verkauf gerade nicht anbietet (`legalActions`). */
  onVerkaufen?: () => void;
  /**
   * Kaufen — es gibt ihn NUR in der Ladenvorschau (die Einheit steht noch
   * nirgends). Fehlt er dort, ist der Kauf gerade nicht erlaubt; ob er es ist,
   * sagt `legalActions` und nicht dieses Blatt.
   */
  onKaufen?: () => void;
  /** Zurueck auf die Bank. Fehlt, wenn dort kein Platz frei ist. */
  onAblegen?: () => void;
  /**
   * Eine Marke antippen — schlaegt ihr Blatt auf (Wirkung, Stufen, Traeger).
   *
   * Der Weg zu dieser Auskunft fuehrt bewusst HIER durch und nicht ueber die
   * Zeichen an der Wabe: Die stehen auf `pointer-events: none`, damit sie den
   * Finger nicht von der Wabe abfangen (die ganze Wabe ist Greif- und
   * Ablegeflaeche). Fehlt der Haken, bleiben die Marken Text — das Blatt ist
   * dann kein Knopf, der nichts tut.
   */
  onMarke?: (marke: string) => void;
  /**
   * Das Blatt schliessen und die Einheit ausgewaehlt lassen — danach leuchten
   * die Ziele, und der naechste Tipp setzt sie ab.
   *
   * DER GRUND, WARUM ES DIESEN KNOPF GIBT: Antippen — Ziel antippen ist der
   * einzige Bedienweg, der mit einem Vorlesegeraet funktioniert (siehe
   * `Einheitenmarke` in Brett.tsx). Seit ein Tipp das Blatt aufschlaegt, faengt
   * dieser Weg hier an; ohne den Knopf waere er zu Ende, bevor er beginnt.
   */
  onVerschieben?: () => void;
  /** „Aufstellen" von der Bank, „Verschieben" auf dem Brett. */
  verschiebenTitel?: string;
  /**
   * Liegt gerade ein Markenblatt DARUEBER? Dann gehoert Escape ihm.
   *
   * Beide Blaetter horchen am Fenster, und beide wuerden auf denselben
   * Tastendruck schliessen: Wer im Laden eine Marke nachschlaegt und Escape
   * drueckt, staende sonst mit einem Schlag wieder vor dem Brett, statt zur
   * Einheit zurueckzukommen. `stopPropagation` hilft dabei nicht — zwei
   * Horcher am selben Ziel sehen dasselbe Ereignis.
   */
  escapeAus?: boolean;
  onSchliessen: () => void;
}): React.JSX.Element {
  /*
   * Escape schliesst — wie beim Markenblatt. Am Handy tippt man daneben (der
   * Ueberblender nimmt den Tipp), an der Tastatur erwartet man diese Taste,
   * und ohne sie waere der einzige Weg hinaus der kleine Knopf oben rechts.
   */
  useEffect(() => {
    if (escapeAus) return;
    const beiTaste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen();
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [onSchliessen, escapeAus]);

  const farbe = kostenFarbe(einheit.kosten);
  /* Name und Wirkungssatz einer Marke stehen beide in derselben Zeile der
     Tabelle — einmal nachschlagen statt zweimal. Fehlt die Tabelle (sie kommt
     erst mit der ersten Sicht), fallen beide weg. */
  const markeZu = (marke: string): Synergie | undefined =>
    tabelle.find((s) => s.marke === marke);

  return (
    /* Der Ueberblender ist die Flaeche „daneben": ein Tipp darauf schliesst.
       Das Blatt selbst haelt den Tipp auf, sonst schluesse jeder Griff hinein
       es wieder. Wortgleich zum Markenblatt — die beiden sollen sich gleich
       anfuehlen. */
    <div className={stil.ueberblender} onClick={onSchliessen}>
      <div
        className={stil.blatt}
        role="dialog"
        aria-modal="true"
        aria-label={`${einheit.name}, Stufe ${kaempfer.stufe}`}
        style={{ '--tr-kosten': farbe } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={stil.kopf}>
          {/* Links das Bildnis, gross. Dieselbe Figur wie auf der Wabe und im
              Laden (`EinheitenFigur`) und nicht eine zweite Zeichnung: Wer
              hier hinsieht, soll den Recken wiedererkennen, den er antippt. */}
          <span className={stil.bildnis}>
            <span className={stil.preis} aria-hidden="true">
              <GoldZeichen />
              {einheit.kosten}
            </span>
            <EinheitenFigur einheit={einheit} klasse={stil.figur} />
            {/* Die Sternstufe unter der Figur — dieselbe Stelle wie auf der
                Wabe, damit der Blick sie dort sucht, wo er sie kennt. */}
            <span className={stil.sterne} aria-hidden="true">
              {'★'.repeat(kaempfer.stufe)}
              {kaempfer.stufe < maxStufe && (
                <span className={stil.sterneOffen}>
                  {'★'.repeat(maxStufe - kaempfer.stufe)}
                </span>
              )}
            </span>
          </span>

          <span className={stil.titel}>
            <h2 className={stil.name}>{einheit.name}</h2>
            <p className={stil.rolle}>
              {ROLLE_NAME[einheit.rolle]}
              <span className={stil.nurVorlesen}>, Stufe {kaempfer.stufe}</span>
            </p>
            {/* Die Marken mit Namen, nicht nur als Zeichen: Auf einer Wabe ist
                fuer ein Wort kein Platz, hier schon — und der Name ist die
                halbe Auskunft. */}
            {einheit.marken.length > 0 && (
              <ul className={stil.marken}>
                {einheit.marken.map((marke) => {
                  const name = markeZu(marke)?.name ?? marke;
                  return (
                    <li key={marke} className={stil.marke}>
                      {/* Mit Haken ein Knopf, ohne Haken Text. Die Marke traegt
                          dann das Zeichen nach aussen weiter: „Krieger
                          nachschlagen" ist die ganze Auskunft, die ein
                          Vorlesegeraet hier braucht. */}
                      {onMarke ? (
                        <button
                          type="button"
                          className={stil.markenknopf}
                          aria-haspopup="dialog"
                          aria-label={`${name} nachschlagen`}
                          onClick={() => onMarke(marke)}
                        >
                          <Markenzeichen marken={[marke]} />
                          <span className={stil.markenname}>{name}</span>
                        </button>
                      ) : (
                        <>
                          <Markenzeichen marken={[marke]} />
                          <span className={stil.markenname}>{name}</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </span>

          <button
            type="button"
            className={stil.zu}
            onClick={onSchliessen}
            aria-label="Blatt schließen"
          >
            ×
          </button>
        </header>

        {werte && (
          <>
            {/*
              * Die Lebensleiste ist in der Vorbereitung IMMER voll — dort
              * nimmt niemand Schaden. Sie ist deshalb kein Messgeraet,
              * sondern der Traeger fuer die Zahl: Ein Balken macht aus "2240"
              * auf einen Blick "viel", und genau darum tippt man eine Einheit
              * an. Wer nur die Ziffer will, liest sie daneben.
              */}
            <div className={stil.lebenzeile}>
              <span className={stil.lebenkopf}>
                <LebenZeichen />
                Leben
              </span>
              <span className={stil.lebenzahl}>{werte.leben}</span>
            </div>
            <div className={stil.lebenbalken} aria-hidden="true">
              <b />
            </div>

            <ul className={stil.werte} aria-label="Kampfwerte">
              <Wert art="schaden" titel="Schaden" zahl={String(werte.angriff)} />
              <Wert
                art="tempo"
                titel="Tempo"
                zahl={tempoText(werte.tempo)}
                einheit="/s"
              />
              <Wert
                art="reichweite"
                titel="Reichweite"
                zahl={String(werte.reichweite)}
                einheit={werte.reichweite === 1 ? 'Feld' : 'Felder'}
              />
              <Wert
                art="ruestung"
                titel="Rüstung"
                zahl={String(werte.ruestung)}
                einheit="%"
              />
            </ul>
          </>
        )}

        {/*
          * An der Stelle, an der das Vorbild einen Faehigkeitstext hat, steht
          * hier, was diese Einheit ueber ihre Werte hinaus wirklich mitbringt:
          * ihre Marken. Der Satz gehoert dem Modul (`wirkung` in synergien.ts)
          * — stuende er hier, verspraeche er ab dem naechsten Balancing etwas
          * anderes, als der Kampf rechnet.
          */}
        {einheit.marken.some((m) => markeZu(m) !== undefined) && (
          <section className={stil.wirkungen}>
            {einheit.marken.map((marke) => {
              const satz = markeZu(marke)?.wirkung;
              if (!satz) return null;
              return (
                <p key={marke} className={stil.wirkung}>
                  {satz}
                </p>
              );
            })}
          </section>
        )}

        <div className={stil.knoepfe}>
          {/* Kaufen steht VORN und nur in der Ladenvorschau: Wer die Karte
              aufgeschlagen hat, um sich zu entscheiden, soll die Entscheidung
              hier treffen koennen und nicht erst das Blatt zumachen muessen.
              Der Preis steht am Knopf wie der Erloes am Verkaufen. */}
          {onKaufen && (
            <button type="button" className={stil.knopf} onClick={onKaufen}>
              Kaufen
              <span className={stil.erloes}>
                <GoldZeichen />
                {einheit.kosten}
              </span>
            </button>
          )}
          {onVerschieben && (
            <button type="button" className={stil.knopf} onClick={onVerschieben}>
              {verschiebenTitel}
            </button>
          )}
          {onAblegen && (
            <button type="button" className={stil.knopf} onClick={onAblegen}>
              Ablegen
            </button>
          )}
          {onVerkaufen && (
            <button
              type="button"
              className={`${stil.knopf} ${stil.verkaufen}`}
              onClick={onVerkaufen}
            >
              Verkaufen
              {erloes !== undefined && (
                <span className={stil.erloes}>
                  <GoldZeichen />
                  {erloes}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
