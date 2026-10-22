import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { spiele } from '../../klang';
import {
  anzeigePosition,
  anzeigeReihenfolge,
  beweglicheFelder,
  feldAnPunkt,
  feldName,
  vorabZug,
  zielfelder,
  zuegeNach,
} from './auswahl';
import stil from './BroChess.module.css';
import { type Figurensatz, pinguinBild } from './figurensatz';
import type { BroChessSicht, BroChessZug, Farbe, Umwandlung } from './sicht';

/**
 * Das Schachbrett: zeigt die Stellung aus der Sicht und laesst einen Zug
 * aus `zuege` auswaehlen — tippen ODER mit dem Finger ziehen.
 *
 * Es prueft NICHTS selbst. Anklickbar ist eine Figur nur, wenn der Server
 * fuer sie einen Zug anbietet, hervorgehoben sind genau dessen Zielfelder,
 * und abgeschickt wird der Eintrag aus der Liste, nicht ein selbst gebauter.
 *
 * Seit dem 22.10.2026 (Emile: „flüssiger"):
 *
 * - **Ziehen.** Die Figur folgt dem Finger und landet, wo er loslaesst.
 *   Tippen geht weiterhin; was von beidem gemeint war, entscheidet die
 *   Strecke (unter 6 px ist es ein Tipp).
 * - **Gleiten.** Jeder Zug — auch der des Gegners — gleitet vom Ausgangs-
 *   aufs Zielfeld, statt zu springen. Wer selbst gezogen hat, sieht die
 *   Figur schon dort liegen; fuer ihn gleitet nichts mehr.
 * - **Vorab-Zug.** Solange der Gegner ueberlegt, laesst sich der eigene
 *   naechste Zug vormerken. Die Ziele dafuer kommen aus der Sicht (`vorab`,
 *   die Gangart rechnet das Modul); ob der Zug dann geht, entscheidet im
 *   Moment des eigenen Zuges `legalActions` — sonst verfaellt er still.
 */

/** Figur in FEN-Schreibweise → Schriftzeichen. Die gefuellte Form fuer beide
 *  Farben: Die hohle ist auf dunklen Feldern kaum zu erkennen, die Farbe
 *  kommt aus dem Stil. Das angehaengte U+FE0E verlangt die Textform — der
 *  Bauer (U+265F) hat eine Emoji-Form, und die liesse sich nicht einfaerben. */
export const ZEICHEN: Record<string, string> = {
  k: '♚︎',
  q: '♛︎',
  r: '♜︎',
  b: '♝︎',
  n: '♞︎',
  p: '♟︎',
};

const FIGURNAME: Record<string, string> = {
  k: 'König',
  q: 'Dame',
  r: 'Turm',
  b: 'Läufer',
  n: 'Springer',
  p: 'Bauer',
};

/** Ab dieser Strecke ist ein Druck ein Ziehen und kein Tipp. */
const ZIEH_SCHWELLE = 6;
const GLEIT_MS = 170;

function farbeDer(figur: string): Farbe {
  return figur === figur.toUpperCase() ? 'w' : 'b';
}

interface Ziehen {
  readonly von: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  /** War die Figur beim Druck schon gewaehlt? Dann hebt ein Tipp die Wahl auf. */
  readonly warGewaehlt: boolean;
  x: number;
  y: number;
  aktiv: boolean;
}

export function Brett({
  sicht,
  zuege,
  onZug,
  figurensatz = 'klassisch',
}: {
  sicht: BroChessSicht;
  /** `legalActions` des Servers; leer, wenn man nicht am Zug ist. */
  zuege: readonly BroChessZug[];
  onZug: (zug: BroChessZug) => void;
  /** Aussehen der Figuren (figurensatz.ts); die Regeln kennen es nicht. */
  figurensatz?: Figurensatz;
}): React.JSX.Element {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  /** Offene Umwandlung: die vier (oder weniger) angebotenen Zuege. */
  const [umwandlung, setUmwandlung] = useState<BroChessZug[] | null>(null);
  /** Vorgemerkter Zug, solange der Gegner am Zug ist. */
  const [vorab, setVorab] = useState<{ von: string; nach: string } | null>(null);
  /** Figur, die gerade unter dem Finger haengt (fuer die Darstellung). */
  const [schwebt, setSchwebt] = useState<{ von: string; x: number; y: number } | null>(null);
  /** Gleitender Zug: Zielfeld und Abstand zum Ausgangsfeld in Feldern. */
  const [gleiten, setGleiten] = useState<{ nach: string; dx: number; dy: number; laeuft: boolean } | null>(
    null,
  );

  /*
   * Der eigene Zug, bis der Server ihn bestaetigt: Die Figur steht sofort
   * auf dem Zielfeld. Sonst spraenge sie nach dem Loslassen fuer die Dauer
   * einer Leitung zurueck aufs Ausgangsfeld und tauchte dann ohne Bewegung
   * am Ziel auf — genau das „ruckelig", das weg sollte. Rochadeturm und
   * En-passant-Bauer zieht erst die Antwort nach; das sind Augenblicke.
   */
  const [unterwegs, setUnterwegs] = useState<{ von: string; nach: string; figur: string } | null>(null);

  const brettRef = useRef<HTMLDivElement>(null);
  const ziehen = useRef<Ziehen | null>(null);
  /** Zielfeld des eigenen gezogenen Zuges: Dort liegt die Figur schon. */
  const abgelegtAuf = useRef<string | null>(null);
  const ersteStellung = useRef(true);

  const amZug = zuege.length > 0;
  const unten = sicht.meineFarbe ?? 'w';
  const beweglich = amZug ? beweglicheFelder(zuege) : new Set(Object.keys(sicht.vorab ?? {}));
  const zieleVon = (von: string | null): Set<string> =>
    amZug ? zielfelder(zuege, von) : new Set(von ? (sicht.vorab?.[von] ?? []) : []);
  const ziele = zieleVon(gewaehlt);

  /*
   * Jede neue Stellung: Auswahl verwerfen, den Zug gleiten lassen, klingen
   * — und einen vorgemerkten Zug ausfuehren, wenn man jetzt dran ist. Am
   * Schluessel `fen` und nicht an der Sicht: Die kommt bei jedem Serverfunk
   * als neues Objekt (CLAUDE.md, „React-Effekte an einen Schluessel haengen").
   */
  useLayoutEffect(() => {
    setGewaehlt(null);
    setUmwandlung(null);
    setUnterwegs(null);
    if (ersteStellung.current) {
      ersteStellung.current = false;
      return;
    }
    const zug = sicht.letzterZug;
    if (!zug) return;
    const letzter = sicht.verlauf?.at(-1) ?? '';
    spiele(letzter.includes('x') ? 'stich-ein' : 'karte-legen');
    if (abgelegtAuf.current === zug.nach) {
      abgelegtAuf.current = null;
      return;
    }
    abgelegtAuf.current = null;
    const a = anzeigePosition(zug.von, unten);
    const b = anzeigePosition(zug.nach, unten);
    setGleiten({ nach: zug.nach, dx: a.spalte - b.spalte, dy: a.zeile - b.zeile, laeuft: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sicht.fen]);

  // Zwei Frames: erst die Figur aufs Ausgangsfeld setzen, dann losgleiten.
  useEffect(() => {
    if (!gleiten || gleiten.laeuft) return;
    let zweiter = 0;
    const erster = requestAnimationFrame(() => {
      zweiter = requestAnimationFrame(() => setGleiten((g) => (g ? { ...g, laeuft: true } : g)));
    });
    const ende = setTimeout(() => setGleiten(null), GLEIT_MS + 60);
    return () => {
      cancelAnimationFrame(erster);
      cancelAnimationFrame(zweiter);
      clearTimeout(ende);
    };
  }, [gleiten]);

  // Der vorgemerkte Zug, sobald man dran ist — oder er verfaellt.
  useEffect(() => {
    if (!vorab || !amZug) return;
    const zug = vorabZug(zuege, vorab.von, vorab.nach);
    setVorab(null);
    if (zug) schicke(zug, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sicht.fen, amZug]);

  // Kommt keine Antwort (abgewiesen, Leitung weg), steht die Figur nach
  // vier Sekunden wieder, wo der Server sie sieht.
  useEffect(() => {
    if (!unterwegs) return;
    const id = setTimeout(() => setUnterwegs(null), 4000);
    return () => clearTimeout(id);
  }, [unterwegs]);

  // Partie vorbei: Vorgemerktes hat keinen Sinn mehr.
  useEffect(() => {
    if (sicht.ende) setVorab(null);
  }, [sicht.ende]);

  /**
   * Einen Zug aus der Liste abschicken und sofort zeigen. Gezogen liegt die
   * Figur schon am Ziel; getippt gleitet sie jetzt hin — und wenn die
   * Bestaetigung kommt, gleitet nichts ein zweites Mal (`abgelegtAuf`).
   */
  const schicke = (zug: BroChessZug, gezogen: boolean): void => {
    const vonIndex = feldIndexVon(zug.von);
    const figur = sicht.brett[vonIndex] ?? '';
    const neu = zug.umwandlung ? (farbeDer(figur) === 'w' ? zug.umwandlung.toUpperCase() : zug.umwandlung) : figur;
    setUnterwegs({ von: zug.von, nach: zug.nach, figur: neu });
    abgelegtAuf.current = zug.nach;
    if (!gezogen) {
      const a = anzeigePosition(zug.von, unten);
      const b = anzeigePosition(zug.nach, unten);
      setGleiten({ nach: zug.nach, dx: a.spalte - b.spalte, dy: a.zeile - b.zeile, laeuft: false });
    }
    onZug(zug);
  };

  const ausfuehren = (von: string, nach: string, gezogen: boolean): void => {
    setGewaehlt(null);
    if (!amZug) {
      setVorab({ von, nach });
      spiele('tipp');
      return;
    }
    const passend = zuegeNach(zuege, von, nach);
    if (passend.length > 1) {
      setUmwandlung(passend);
      return;
    }
    const [zug] = passend;
    if (zug) schicke(zug, gezogen);
  };

  /** Der Tipp-Weg (auch Tastatur): wie bisher, nur mit Vorab-Zug. */
  const tippe = (name: string): void => {
    if (gewaehlt && ziele.has(name)) {
      ausfuehren(gewaehlt, name, false);
      return;
    }
    if (vorab && !beweglich.has(name)) setVorab(null);
    setGewaehlt(beweglich.has(name) && gewaehlt !== name ? name : null);
  };

  const punkt = (e: React.PointerEvent): { x: number; y: number; seite: number } => {
    const rahmen = brettRef.current!.getBoundingClientRect();
    return { x: e.clientX - rahmen.left, y: e.clientY - rahmen.top, seite: rahmen.width };
  };

  const druck = (e: React.PointerEvent): void => {
    if (e.button !== 0 || umwandlung || !brettRef.current) return;
    const { x, y, seite } = punkt(e);
    const name = feldAnPunkt(x, y, seite, unten);
    if (!name) return;
    if (gewaehlt && ziele.has(name)) {
      ausfuehren(gewaehlt, name, false);
      return;
    }
    if (!beweglich.has(name)) {
      setGewaehlt(null);
      if (vorab) setVorab(null);
      return;
    }
    brettRef.current.setPointerCapture?.(e.pointerId);
    ziehen.current = {
      von: name,
      pointerId: e.pointerId,
      startX: x,
      startY: y,
      warGewaehlt: gewaehlt === name,
      x,
      y,
      aktiv: false,
    };
    setGewaehlt(name);
  };

  const bewegung = (e: React.PointerEvent): void => {
    const z = ziehen.current;
    if (!z || z.pointerId !== e.pointerId) return;
    const { x, y } = punkt(e);
    z.x = x;
    z.y = y;
    if (!z.aktiv && Math.hypot(x - z.startX, y - z.startY) >= ZIEH_SCHWELLE) z.aktiv = true;
    if (z.aktiv) setSchwebt({ von: z.von, x, y });
  };

  const loslassen = (e: React.PointerEvent): void => {
    const z = ziehen.current;
    if (!z || z.pointerId !== e.pointerId) return;
    ziehen.current = null;
    setSchwebt(null);
    if (!z.aktiv) {
      if (z.warGewaehlt) setGewaehlt(null);
      return;
    }
    const { seite } = punkt(e);
    const ziel = feldAnPunkt(z.x, z.y, seite, unten);
    if (ziel && zieleVon(z.von).has(ziel)) ausfuehren(z.von, ziel, true);
  };

  const abbrechen = (): void => {
    ziehen.current = null;
    setSchwebt(null);
  };

  const koenigImSchach = sicht.schach
    ? sicht.brett.findIndex((f) => f === (sicht.amZug === 'w' ? 'K' : 'k'))
    : -1;

  const figurInhalt = (figur: string): React.JSX.Element =>
    figurensatz === 'pinguin' ? (
      <img className={stil.figurBild} src={pinguinBild(figur)} alt="" draggable={false} />
    ) : (
      <span className={`${stil.figur} ${farbeDer(figur) === 'w' ? stil.figurWeiss : stil.figurSchwarz}`}>
        {ZEICHEN[figur.toLowerCase()]}
      </span>
    );

  const angezeigt = [...sicht.brett];
  if (unterwegs) {
    angezeigt[feldIndexVon(unterwegs.von)] = '';
    angezeigt[feldIndexVon(unterwegs.nach)] = unterwegs.figur;
  }

  const seite = brettRef.current?.getBoundingClientRect().width ?? 0;
  const schwebendeFigur = schwebt ? angezeigt[feldIndexVon(schwebt.von)] ?? '' : '';

  return (
    <div
      ref={brettRef}
      className={stil.brett}
      role="group"
      aria-label="Schachbrett"
      onPointerDown={druck}
      onPointerMove={bewegung}
      onPointerUp={loslassen}
      onPointerCancel={abbrechen}
    >
      {anzeigeReihenfolge(unten).map((index, position) => {
        const name = feldName(index);
        const figur = angezeigt[index] ?? '';
        const hell = (Math.floor(index / 8) + (index % 8)) % 2 === 1;
        const klassen = [
          stil.feld,
          hell ? stil.hell : stil.dunkel,
          beweglich.has(name) || ziele.has(name) ? stil.klickbar : '',
          gewaehlt === name ? stil.gewaehlt : '',
          sicht.letzterZug && (sicht.letzterZug.von === name || sicht.letzterZug.nach === name)
            ? stil.zuletzt
            : '',
          vorab && (vorab.von === name || vorab.nach === name) ? stil.vorab : '',
          index === koenigImSchach ? stil.koenigImSchach : '',
          ziele.has(name) ? (figur ? stil.zielSchlag : stil.ziel) : '',
          ziele.has(name) && !amZug ? stil.zielVorab : '',
        ].filter(Boolean);
        const beschriftung = figur
          ? `${name}, ${farbeDer(figur) === 'w' ? 'weißer' : 'schwarzer'} ${FIGURNAME[figur.toLowerCase()]}`
          : name;
        const gleitet = gleiten?.nach === name;
        return (
          <button
            key={name}
            type="button"
            className={klassen.join(' ')}
            data-feld={name}
            aria-label={beschriftung}
            // Maus und Finger gehen ueber die Zeigerereignisse am Brett; ein
            // Klick ohne Zeiger (Tastatur, Vorlesehilfe, Test) hat detail 0.
            onClick={(e) => {
              if (e.detail === 0) tippe(name);
            }}
          >
            {figur && (
              <span
                className={`${stil.figurHalter}${schwebt?.von === name ? ` ${stil.figurAngehoben}` : ''}${
                  gleitet ? ` ${stil.figurGleitet}` : ''
                }`}
                style={
                  gleitet
                    ? {
                        transform: gleiten.laeuft
                          ? 'translate(0, 0)'
                          : `translate(${gleiten.dx * 100}%, ${gleiten.dy * 100}%)`,
                        transition: gleiten.laeuft ? `transform ${GLEIT_MS}ms cubic-bezier(.2,.7,.3,1)` : 'none',
                      }
                    : undefined
                }
              >
                {figurInhalt(figur)}
              </span>
            )}
            {/* Koordinaten am linken und unteren Rand, von der eigenen Seite aus. */}
            {position % 8 === 0 && (
              <span className={`${stil.koordinate} ${stil.koordinateZeile}`}>{name[1]}</span>
            )}
            {position >= 56 && (
              <span className={`${stil.koordinate} ${stil.koordinateLinie}`}>{name[0]}</span>
            )}
          </button>
        );
      })}

      {schwebt && schwebendeFigur && seite > 0 && (
        <span
          className={stil.schwebend}
          style={{ left: schwebt.x, top: schwebt.y, width: seite / 8, height: seite / 8 }}
          aria-hidden="true"
        >
          {figurInhalt(schwebendeFigur)}
        </span>
      )}

      {umwandlung && (
        <div
          className={stil.umwandlung}
          role="dialog"
          aria-label="Umwandlung wählen"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <strong>Umwandeln in …</strong>
          <div className={stil.umwandlungWahl}>
            {umwandlung.map((zug) => {
              const art: Umwandlung = zug.umwandlung ?? 'q';
              return (
                <button
                  key={art}
                  type="button"
                  aria-label={FIGURNAME[art]}
                  className={sicht.amZug === 'w' ? stil.figurWeiss : stil.figurSchwarz}
                  onClick={() => {
                    setUmwandlung(null);
                    setGewaehlt(null);
                    schicke(zug, false);
                  }}
                >
                  {figurensatz === 'pinguin' ? (
                    <img
                      className={stil.figurBild}
                      src={pinguinBild(sicht.amZug === 'w' ? art.toUpperCase() : art)}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    ZEICHEN[art]
                  )}
                </button>
              );
            })}
          </div>
          <button type="button" className="hb-leise-knopf" onClick={() => setUmwandlung(null)}>
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}

function feldIndexVon(name: string): number {
  return (Number(name[1]) - 1) * 8 + 'abcdefgh'.indexOf(name[0]!);
}

const REMIS: Record<string, string> = {
  patt: 'Patt',
  fuenfzigZuege: '50-Züge-Regel',
  wiederholung: 'dreifache Stellungswiederholung',
  material: 'zu wenig Material zum Mattsetzen',
  zeit: 'Zeit abgelaufen, aber kein Matt mehr möglich',
};

/** Warum jemand gewonnen hat, als kurzer Nachsatz. */
const GRUND: Record<string, string> = {
  matt: 'durch Schachmatt',
  zeit: 'auf Zeit',
  aufgabe: 'durch Aufgabe',
};

/**
 * Das Ergebnis in zwei Zeilen: wer gewonnen hat und warum. Liest nur, was
 * die Sicht sagt — ob Matt, Patt oder Zeit, entscheidet der Server.
 */
export function ergebnis(
  sicht: BroChessSicht,
  nameVon: (farbe: Farbe) => string,
): { titel: string; grund: string; art: 'sieg' | 'niederlage' | 'remis' } | null {
  if (!sicht.ende) return null;
  if (sicht.ende.sieger === null) {
    return { titel: 'Remis', grund: REMIS[sicht.ende.ausgang] ?? '', art: 'remis' };
  }
  const siegerFarbe: Farbe = sicht.ende.sieger === sicht.weissSitz ? 'w' : 'b';
  const grund = GRUND[sicht.ende.ausgang] ?? '';
  if (sicht.meineFarbe === null) return { titel: `${nameVon(siegerFarbe)} gewinnt`, grund, art: 'sieg' };
  return sicht.meineFarbe === siegerFarbe
    ? { titel: 'Du gewinnst!', grund, art: 'sieg' }
    : { titel: `${nameVon(siegerFarbe)} gewinnt`, grund, art: 'niederlage' };
}

/**
 * Die Statuszeile: wer am Zug ist, Schach, und wie die Partie endete.
 * Liest nur, was die Sicht sagt — ob Matt oder Patt ist, entscheidet der
 * Server, nicht diese Zeile.
 */
export function statusText(
  sicht: BroChessSicht,
  nameVon: (farbe: Farbe) => string,
): { text: string; art: 'normal' | 'schach' | 'ende' } {
  const aus = ergebnis(sicht, nameVon);
  if (aus) return { text: aus.grund ? `${aus.titel} — ${aus.grund}` : aus.titel, art: 'ende' };
  const du = sicht.meineFarbe === sicht.amZug;
  const wer = du ? 'Du bist am Zug' : `${nameVon(sicht.amZug)} ist am Zug`;
  return sicht.schach ? { text: `Schach! ${wer}.`, art: 'schach' } : { text: wer, art: 'normal' };
}
