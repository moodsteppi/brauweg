/**
 * Die Mitspielerleiste von Tafelrunde.
 *
 * Sie beantwortet die drei Fragen, die man während einer Partie ständig hat:
 * Wer ist noch dabei, wie viel Leben hat wer, und gegen wen spiele ich diese
 * Runde? Je Sitz eine Kachel: Bild, Lebensbalken mit Zahl, Name darunter.
 *
 * SIE STEHT GANZ OBEN UND IMMER. Bis zum 05.09.2026 war sie eine zuklappbare
 * Liste im Fluss über dem Brett (am Desktop an der rechten Kante) — acht
 * Zeilen hoch, also klappte man sie zu, und dann war die halbe Auskunft der
 * Partie weg. Ein fertiger Auto-Battler hält diesen Streifen dauerhaft am
 * oberen Rand, weil er das Einzige ist, was den eigenen Tisch mit dem Turnier
 * verbindet. Deshalb: keine Klappmechanik mehr, ein waagerechter Streifen,
 * der bei acht Sitzen seitlich rollt statt in die Höhe zu wachsen.
 *
 * HIER WIRD NICHTS ENTSCHIEDEN. Alle Zahlen kommen aus der Sicht (sicht.ts);
 * die einzigen Rechnungen stehen in platzierung.ts und sind dort begründet.
 * Insbesondere ist „ausgeschieden" `ausRunde !== null` und nicht `leben <= 0`:
 * Zwischen dem Kampf und dem Rundenwechsel fällt beides auseinander (siehe
 * `eigenesLebt` in sicht.ts).
 *
 * WO SIE STEHT, entscheidet weiterhin allein das Stylesheet: Der Streifen
 * füllt die Breite, die ihm die Kopfleiste des Tisches gibt (`.tr-oben` in
 * styles.css).
 */

import { useState } from 'react';

import { type Leistenplatz, leistenplaetze, nochDabei } from './platzierung';
import stil from './Mitspieler.module.css';

export type { Leistenplatz };

/**
 * Ein Sitz des Tisches, wie ihn die Plattform kennt (nicht das Spielmodul).
 *
 * Dieselbe Form wie `SitzZeile` in screens/Tafelrunde.tsx — abgeschrieben und
 * nicht importiert, weil der Bildschirm dieses Bauteil einbindet und nicht
 * umgekehrt.
 */
export interface Sitzzeile {
  seat: number;
  displayName: string | null;
  avatarUrl: string | null;
  isBot: boolean;
}

/**
 * Wie ein Sitz heißt.
 *
 * Wortgleich zu `spielername` im Bildschirm. Doppelt geführt und nicht
 * herausgereicht, damit dieses Bauteil ohne den 2700-Zeilen-Bildschirm
 * geprüft werden kann; der Rückfall ist derselbe, und ein Auseinanderlaufen
 * fiele sofort auf — der Name steht in Leiste und Bretttitel nebeneinander.
 */
export function sitzname(zeile: Sitzzeile | undefined, sitz: number): string {
  return zeile?.displayName ?? (zeile?.isBot ? 'KI' : `Sitz ${sitz + 1}`);
}

/**
 * Der Buchstabe, der einsteht, wenn es kein Bild gibt.
 *
 * Ein Buchstabe und kein leerer Kasten: `<img>` auf eine Datei, die es nicht
 * gibt, ist genau der weiße Fleck, vor dem CLAUDE.md warnt. Groß geschrieben,
 * damit „ich" und „Ich" nicht wie zwei verschiedene Sitze aussehen.
 */
function anfangsbuchstabe(name: string): string {
  const erstes = [...name.trim()][0];
  return erstes ? erstes.toUpperCase() : '?';
}

/**
 * Das Auge — das Zeichen fuers Zusehen.
 *
 * Es steht an genau zwei Stellen: an der Kachel, deren Brett gerade oben
 * liegt, und auf der Schaltflaeche, die von dort zurueckfuehrt. Deshalb wird
 * es hier EINMAL gezeichnet und vom Bildschirm importiert (Tafelrunde.tsx) —
 * zwei Augen mit leicht verschiedenen Pfaden waeren zwei Zeichen, und dann
 * gehoerte der Knopf nicht sichtbar zur Kachel.
 *
 * OHNE eigene Klasse: Wie gross und in welcher Farbe es steht, entscheidet der
 * Ort — in der Kachel `.auge svg` (Mitspieler.module.css), im Bretttitel und
 * auf dem Knopf `.tr-bretttitel svg` bzw. `.tr-zuschauen-zurueck svg`
 * (styles.css). Eine mitgebrachte Klasse aus DIESEM Modul haenge sonst am
 * Bildschirm, der das Zeichen nur einbindet.
 */
export function AugeZeichen(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6.2 5.8 12 5.8 21.5 12 21.5 12 17.8 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  );
}

/** Herz — dieselben Striche wie das Zeichen im Bildschirm. */
function Herz(): React.JSX.Element {
  return (
    <svg className={stil.zeichen} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7-.8c0 .3.0.4 0 .6C19 15.7 12 20 12 20Z" />
    </svg>
  );
}

/**
 * Der Balken hinter dem Leben.
 *
 * Er braucht ein Maximum, und das steht NICHT in der Sicht: Der Regelsatz
 * kennt `startLeben`, die Sicht gibt nur den laufenden Wert. Deshalb ist der
 * Bezugswert das höchste Leben, das gerade am Tisch steht — eine Anzeige
 * relativ zum Feld, keine erfundene 100. Sie ist damit auch bei einem Tisch
 * mit anderem Startleben richtig.
 */
function lebensanteil(leben: number, hoechstes: number): number {
  if (hoechstes <= 0) return 0;
  return Math.max(0, Math.min(1, leben / hoechstes));
}

export function Mitspielerleiste({
  eigenes,
  gegner,
  gegnerJetzt,
  sitze,
  gezeigt,
  onWahl,
}: {
  /** Der eigene Sitz, null als Zuschauer. */
  eigenes: {
    sitz: number;
    leben: number;
    level: number;
    ausRunde: number | null;
    bereit: boolean;
  } | null;
  gegner: readonly {
    sitz: number;
    leben: number;
    level: number;
    ausRunde: number | null;
    bereit: boolean;
    verlassen?: boolean;
  }[];
  /** Mein Gegner der laufenden Kampfrunde, oder null (siehe platzierung.ts). */
  gegnerJetzt: number | null;
  sitze: readonly Sitzzeile[];
  /** Wessen Brett gerade oben liegt. */
  gezeigt: number | null;
  /** Ein Tipp auf einen fremden Sitz legt sein Brett nach oben. */
  onWahl: (sitz: number) => void;
}): React.JSX.Element | null {
  const plaetze = leistenplaetze(eigenes, gegner, gegnerJetzt);
  if (plaetze.length === 0) return null;

  const lebend = nochDabei(plaetze);
  const hoechstes = plaetze.reduce((m, p) => Math.max(m, p.leben), 0);

  return (
    /* `role="group"` ausdrücklich: Ein `<section>` mit Beschriftung wäre eine
       `region` — ein Landmark, und acht Sitze sind keine Landschaft.

       Die Zahl der Überlebenden steht im Namen der Gruppe und nicht mehr als
       eigene Zeile: Sichtbar sagen es die ausgegrauten Kacheln, und eine
       zusätzliche Zeile in der festgehefteten Kopfleiste kostet Bretthöhe. */
    <section
      className={stil.leiste}
      role="group"
      aria-label={`Mitspieler — noch ${lebend} von ${plaetze.length}`}
    >
      <ul className={stil.liste}>
        {plaetze.map((p) => {
          const zeile = sitze.find((s) => s.seat === p.sitz);
          return (
            <Kachel
              key={p.sitz}
              platz={p}
              name={sitzname(zeile, p.sitz)}
              bild={zeile?.avatarUrl ?? null}
              anteil={lebensanteil(p.leben, hoechstes)}
              gezeigt={p.sitz === gezeigt}
              onWahl={onWahl}
            />
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Eine Kachel der Leiste.
 *
 * Der eigene Sitz ist KEINE Schaltfläche: Sein Brett liegt ohnehin unten, ein
 * Tipp hätte nichts zu tun — und ein Knopf, der nichts tut, ist schlimmer als
 * keiner. Deshalb `<div>` für mich und `<button>` für die anderen, in einem
 * Bauteil zusammengehalten, damit beide Fassungen nie auseinanderlaufen.
 */
function Kachel({
  platz,
  name,
  bild,
  anteil,
  gezeigt,
  onWahl,
}: {
  platz: Leistenplatz;
  name: string;
  /** Das Profilbild des Sitzes, oder null — dann steht dort ein Buchstabe. */
  bild: string | null;
  anteil: number;
  gezeigt: boolean;
  onWahl: (sitz: number) => void;
}): React.JSX.Element {
  const aus = platz.ausRunde !== null;
  const inhalt = (
    <>
      <Bild bild={bild} name={name} />

      {/* Balken und Zahl in einer Zeile: Der Balken zeigt das Verhältnis zum
          Feld, die Zahl den Wert. Der Balken selbst wird nicht vorgelesen —
          die Zahl daneben sagt dasselbe genauer. */}
      <span className={stil.lebenzeile}>
        <span className={stil.balken} aria-hidden="true">
          <i style={{ width: `${Math.round(anteil * 100)}%` }} />
        </span>
        <span className={stil.leben}>
          <Herz />
          {platz.leben}
        </span>
      </span>

      {/* Das Auge steht VOR dem Namen und nicht als Marke in einer Ecke.
          Zwei Gruende, beide gemessen: Der Streifen rollt seitlich
          (`overflow-x` an `.liste`), und alles, was ueber die Kachelkante
          hinausragt, wird dabei abgeschnitten — eine Eckmarke war oben zur
          Haelfte weg. Und so steht es genau wie ueber dem Brett darunter
          („👁 Tom", `.tr-bretttitel`): dasselbe Zeichen vor demselben Namen,
          also erkennbar dieselbe Aussage. Der Name kuerzt sich weiterhin
          selbst, das Auge laeuft in derselben Zeile mit. */}
      <span className={stil.name}>
        {gezeigt && <AugeZeichen />}
        {name}
      </span>

      {/* Die Zustandszeile. Sie steht immer da, auch leer: Sonst wären die
          Kacheln unterschiedlich hoch und der Streifen wackelte bei jedem
          „bereit". Zwei Marken tragen Wörter und nicht nur Farbe — eine Farbe
          allein unterscheidet sie nicht (DESIGN.md). */}
      <span className={stil.zustand}>
        {platz.gegnerJetzt ? (
          <span className={stil.gegnerMarke}>Gegner</span>
        ) : platz.ich ? (
          <span className={stil.marke}>Du</span>
        ) : aus ? (
          <span className={stil.raus}>raus</span>
        ) : platz.verlassen ? (
          <span className={stil.raus}>weg</span>
        ) : platz.bereit ? (
          /* „bereit" nur, solange der Sitz noch spielt: Ein ausgeschiedener
             Sitz steht dauerhaft auf bereit, und ein grüner Punkt an ihm sähe
             aus, als warte der Tisch auf ihn. */
          <span className={stil.bereit}>bereit</span>
        ) : (
          <span className={stil.rang}>Rang {platz.level}</span>
        )}
      </span>
    </>
  );

  return (
    <li className={stil.reihe}>
      {platz.ich ? (
        <div
          className={stil.kachel}
          data-ich=""
          data-aus={aus ? '' : undefined}
          data-gegner={platz.gegnerJetzt ? '' : undefined}
        >
          {inhalt}
        </div>
      ) : (
        <button
          type="button"
          className={stil.kachel}
          data-aus={aus ? '' : undefined}
          data-gegner={platz.gegnerJetzt ? '' : undefined}
          data-an={gezeigt ? '' : undefined}
          aria-pressed={gezeigt}
          /* Der Zustand gehört in den Namen, nicht nur in die Farbe: Wer
             vorlesen lässt, hört sonst acht gleich klingende Knöpfe. */
          aria-label={`${name}, ${platz.leben} Leben${aus ? ', ausgeschieden' : ''}${
            platz.gegnerJetzt ? ', dein Gegner diese Runde' : ''
          }${gezeigt ? ', Brett liegt oben' : ''}`}
          onClick={() => onWahl(platz.sitz)}
        >
          {inhalt}
        </button>
      )}
    </li>
  );
}

/**
 * Das Bild eines Sitzes.
 *
 * Der gescheiterte PFAD wird gemerkt und nicht bloß ein Ja/Nein — dieselbe
 * Bauart und derselbe Grund wie bei `Figurbild` in KampfAnzeige.tsx: Eine
 * Kachel behält ihre Komponente, wenn dort ein anderer Sitz landet, und mit
 * einem Ja/Nein bliebe der Buchstabe des ersten am zweiten kleben.
 */
function Bild({ bild, name }: { bild: string | null; name: string }): React.JSX.Element {
  const [kaputt, setKaputt] = useState<string | null>(null);
  const zeigen = bild !== null && bild !== kaputt;
  return (
    <span className={stil.bild} aria-hidden="true">
      {zeigen ? (
        /* `alt=""`: Der Name steht zwei Zeilen tiefer und im Namen der
           Schaltfläche. Ein zweites Mal vorgelesen wäre er nur Lärm. */
        <img src={bild} alt="" onError={() => setKaputt(bild)} />
      ) : (
        <span className={stil.buchstabe}>{anfangsbuchstabe(name)}</span>
      )}
    </span>
  );
}
