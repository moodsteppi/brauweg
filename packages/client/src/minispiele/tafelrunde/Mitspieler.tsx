/**
 * Die Mitspielerleiste von Tafelrunde.
 *
 * Sie beantwortet die drei Fragen, die man während einer Partie ständig hat
 * und bisher nirgends beantwortet bekam: Wer ist noch dabei, wie viel Leben
 * hat wer, und gegen wen spiele ich diese Runde? Vorher stand hier nur ein
 * Streifen mit Name und Leben der GEGNER — der eigene Sitz fehlte, damit auch
 * jeder Vergleich, und die Paarung der Runde stand gar nicht am Bildschirm.
 *
 * HIER WIRD NICHTS ENTSCHIEDEN. Alle Zahlen kommen aus der Sicht (sicht.ts);
 * die einzigen Rechnungen stehen in platzierung.ts und sind dort begründet.
 * Insbesondere ist „ausgeschieden" `ausRunde !== null` und nicht `leben <= 0`:
 * Zwischen dem Kampf und dem Rundenwechsel fällt beides auseinander (siehe
 * `eigenesLebt` in sicht.ts).
 *
 * WO SIE STEHT, entscheidet allein Mitspieler.module.css — am Handy im Fluss
 * über dem Brett und zuklappbar, ab 64rem fest an der rechten Kante. Rechts
 * und nicht links, weil dort schon die Synergieleiste hängt.
 *
 * Wie bei der Synergieleiste wird die Liste beim Zuklappen NICHT aus dem Baum
 * genommen, sondern nur `data-offen` gesetzt: Ein `{offen && …}` ließe die
 * Leiste am Desktop, wo es keinen Klappknopf gibt, für immer verschwinden,
 * sobald jemand sie einmal am Handy zugeklappt hat.
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
 * herausgereicht, damit dieses Bauteil ohne den 1900-Zeilen-Bildschirm
 * geprüft werden kann; der Rückfall ist derselbe, und ein Auseinanderlaufen
 * fiele sofort auf — der Name steht in Leiste und Bretttitel nebeneinander.
 */
export function sitzname(zeile: Sitzzeile | undefined, sitz: number): string {
  return zeile?.displayName ?? (zeile?.isBot ? 'KI' : `Sitz ${sitz + 1}`);
}

/** Herz und Ring — dieselben Striche wie die Zeichen im Bildschirm. */
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
  const [offen, setOffen] = useState(true);
  const plaetze = leistenplaetze(eigenes, gegner, gegnerJetzt);
  if (plaetze.length === 0) return null;

  const lebend = nochDabei(plaetze);
  const hoechstes = plaetze.reduce((m, p) => Math.max(m, p.leben), 0);

  return (
    /* `role="group"` ausdruecklich: Ein `<section>` mit Beschriftung waere
       eine `region` — ein Landmark, und acht Sitze sind keine Landschaft. */
    <section
      className={stil.leiste}
      role="group"
      data-offen={offen ? '' : undefined}
      aria-label="Mitspieler"
    >
      <button
        type="button"
        className={stil.kopf}
        aria-expanded={offen}
        onClick={() => setOffen((a) => !a)}
      >
        <span>Mitspieler</span>
        {/* Die Zahl steht auch zugeklappt da — „noch 3 von 8" ist die halbe
            Auskunft der ganzen Leiste und soll nicht erst nach einem Tipp
            erscheinen. */}
        <span className={stil.kopfzahl}>
          noch {lebend} von {plaetze.length}
        </span>
        <span className={stil.pfeil} aria-hidden="true" />
      </button>

      <ul className={stil.liste}>
        {plaetze.map((p) => (
          <Zeile
            key={p.sitz}
            platz={p}
            name={sitzname(
              sitze.find((s) => s.seat === p.sitz),
              p.sitz,
            )}
            anteil={lebensanteil(p.leben, hoechstes)}
            gezeigt={p.sitz === gezeigt}
            onWahl={onWahl}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * Eine Zeile der Leiste.
 *
 * Der eigene Sitz ist KEINE Schaltfläche: Sein Brett liegt ohnehin unten, ein
 * Tipp hätte nichts zu tun — und ein Knopf, der nichts tut, ist schlimmer als
 * keiner. Deshalb `<div>` für mich und `<button>` für die anderen, in einem
 * Bauteil zusammengehalten, damit beide Fassungen nie auseinanderlaufen.
 */
function Zeile({
  platz,
  name,
  anteil,
  gezeigt,
  onWahl,
}: {
  platz: Leistenplatz;
  name: string;
  anteil: number;
  gezeigt: boolean;
  onWahl: (sitz: number) => void;
}): React.JSX.Element {
  const aus = platz.ausRunde !== null;
  const inhalt = (
    <>
      <span className={stil.zeile}>
        <span className={stil.name}>{name}</span>
        {/* Zwei Marken, beide auch als Wort — eine Farbe allein unterscheidet
            sie nicht (DESIGN.md, und auf einem 10-px-Punkt schon gar nicht). */}
        {platz.ich && <span className={stil.marke}>Du</span>}
        {platz.gegnerJetzt && <span className={`${stil.marke} ${stil.gegnerMarke}`}>Gegner</span>}
      </span>
      <span className={stil.werte}>
        <span className={stil.leben}>
          <Herz />
          {platz.leben}
        </span>
        <span className={stil.rang}>Rang {platz.level}</span>
        {/* „bereit" nur, solange der Sitz noch spielt: Ein ausgeschiedener
            Sitz steht dauerhaft auf bereit, und ein grüner Punkt an ihm sähe
            aus, als warte der Tisch auf ihn. */}
        {platz.bereit && !aus && <span className={stil.bereit}>bereit</span>}
        {platz.verlassen && <span className={stil.weg}>weg</span>}
      </span>
      {/* Der Balken ist Beiwerk zur Zahl daneben und wird nicht vorgelesen. */}
      <span className={stil.balken} aria-hidden="true">
        <i style={{ width: `${Math.round(anteil * 100)}%` }} />
      </span>
    </>
  );

  return (
    <li className={stil.reihe}>
      {platz.ich ? (
        <div
          className={stil.eintrag}
          data-ich=""
          data-aus={aus ? '' : undefined}
          data-gegner={platz.gegnerJetzt ? '' : undefined}
        >
          {inhalt}
        </div>
      ) : (
        <button
          type="button"
          className={stil.eintrag}
          data-aus={aus ? '' : undefined}
          data-gegner={platz.gegnerJetzt ? '' : undefined}
          data-an={gezeigt ? '' : undefined}
          aria-pressed={gezeigt}
          /* Der Zustand gehört in den Namen, nicht nur in die Farbe: Wer
             vorlesen lässt, hört sonst acht gleich klingende Knöpfe. */
          aria-label={`${name}, ${platz.leben} Leben${aus ? ', ausgeschieden' : ''}${
            platz.gegnerJetzt ? ', dein Gegner diese Runde' : ''
          }`}
          onClick={() => onWahl(platz.sitz)}
        >
          {inhalt}
        </button>
      )}
    </li>
  );
}
