import { useEffect, useState } from 'react';

import { anzeigeReihenfolge, beweglicheFelder, feldName, zielfelder, zuegeNach } from './auswahl';
import stil from './BroChess.module.css';
import type { BroChessSicht, BroChessZug, Farbe, Umwandlung } from './sicht';

/**
 * Das Schachbrett: zeigt die Stellung aus der Sicht und laesst einen Zug
 * aus `zuege` auswaehlen.
 *
 * Es prueft NICHTS selbst. Anklickbar ist eine Figur nur, wenn der Server
 * fuer sie einen Zug anbietet, hervorgehoben sind genau dessen Zielfelder,
 * und abgeschickt wird der Eintrag aus der Liste, nicht ein selbst gebauter.
 * Ist man nicht am Zug, ist die Liste leer — und das Brett nur ein Bild.
 */

/** Figur in FEN-Schreibweise → Schriftzeichen. Die gefuellte Form fuer beide
 *  Farben: Die hohle ist auf dunklen Feldern kaum zu erkennen, die Farbe
 *  kommt aus dem Stil. */
const ZEICHEN: Record<string, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

const FIGURNAME: Record<string, string> = {
  k: 'König',
  q: 'Dame',
  r: 'Turm',
  b: 'Läufer',
  n: 'Springer',
  p: 'Bauer',
};

function farbeDer(figur: string): Farbe {
  return figur === figur.toUpperCase() ? 'w' : 'b';
}

export function Brett({
  sicht,
  zuege,
  onZug,
}: {
  sicht: BroChessSicht;
  /** `legalActions` des Servers; leer, wenn man nicht am Zug ist. */
  zuege: readonly BroChessZug[];
  onZug: (zug: BroChessZug) => void;
}): React.JSX.Element {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  /** Offene Umwandlung: die vier (oder weniger) angebotenen Zuege. */
  const [umwandlung, setUmwandlung] = useState<BroChessZug[] | null>(null);

  /*
   * Mit jeder neuen Stellung ist die Auswahl hinfaellig. Am Schluessel `fen`
   * und nicht an der Sicht: Die kommt bei jedem Serverfunk als neues Objekt
   * (CLAUDE.md, „React-Effekte an einen Schluessel haengen").
   */
  useEffect(() => {
    setGewaehlt(null);
    setUmwandlung(null);
  }, [sicht.fen]);

  const beweglich = beweglicheFelder(zuege);
  const ziele = zielfelder(zuege, gewaehlt);
  const unten = sicht.meineFarbe ?? 'w';

  const koenigImSchach = sicht.schach
    ? sicht.brett.findIndex((f) => f === (sicht.amZug === 'w' ? 'K' : 'k'))
    : -1;

  const tippe = (name: string): void => {
    if (gewaehlt && ziele.has(name)) {
      const passend = zuegeNach(zuege, gewaehlt, name);
      if (passend.length > 1) {
        setUmwandlung(passend);
        return;
      }
      const [zug] = passend;
      if (zug) onZug(zug);
      setGewaehlt(null);
      return;
    }
    setGewaehlt(beweglich.has(name) && gewaehlt !== name ? name : null);
  };

  return (
    <div className={stil.brett} role="group" aria-label="Schachbrett">
      {anzeigeReihenfolge(unten).map((index, position) => {
        const name = feldName(index);
        const figur = sicht.brett[index] ?? '';
        const hell = (Math.floor(index / 8) + (index % 8)) % 2 === 1;
        const klassen = [
          stil.feld,
          hell ? stil.hell : stil.dunkel,
          beweglich.has(name) || ziele.has(name) ? stil.klickbar : '',
          gewaehlt === name ? stil.gewaehlt : '',
          sicht.letzterZug && (sicht.letzterZug.von === name || sicht.letzterZug.nach === name)
            ? stil.zuletzt
            : '',
          index === koenigImSchach ? stil.koenigImSchach : '',
          ziele.has(name) ? (figur ? stil.zielSchlag : stil.ziel) : '',
        ].filter(Boolean);
        const beschriftung = figur
          ? `${name}, ${farbeDer(figur) === 'w' ? 'weißer' : 'schwarzer'} ${FIGURNAME[figur.toLowerCase()]}`
          : name;
        return (
          <button
            key={name}
            type="button"
            className={klassen.join(' ')}
            data-feld={name}
            aria-label={beschriftung}
            onClick={() => tippe(name)}
          >
            {figur && (
              <span
                className={`${stil.figur} ${farbeDer(figur) === 'w' ? stil.figurWeiss : stil.figurSchwarz}`}
              >
                {ZEICHEN[figur.toLowerCase()]}
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

      {umwandlung && (
        <div className={stil.umwandlung} role="dialog" aria-label="Umwandlung wählen">
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
                    onZug(zug);
                    setUmwandlung(null);
                    setGewaehlt(null);
                  }}
                >
                  {ZEICHEN[art]}
                </button>
              );
            })}
          </div>
          <button type="button" className={stil.umwandlungAbbruch} onClick={() => setUmwandlung(null)}>
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}

const REMIS: Record<string, string> = {
  patt: 'Patt — Remis',
  fuenfzigZuege: 'Remis nach der 50-Züge-Regel',
  wiederholung: 'Remis durch dreifache Stellungswiederholung',
  material: 'Remis — zu wenig Material zum Mattsetzen',
};

/**
 * Die Statuszeile: wer am Zug ist, Schach, und wie die Partie endete.
 * Liest nur, was die Sicht sagt — ob Matt oder Patt ist, entscheidet der
 * Server, nicht diese Zeile.
 */
export function statusText(
  sicht: BroChessSicht,
  nameVon: (farbe: Farbe) => string,
): { text: string; art: 'normal' | 'schach' | 'ende' } {
  if (sicht.ende) {
    if (sicht.ende.ausgang === 'matt') {
      const siegerFarbe: Farbe = sicht.ende.sieger === sicht.weissSitz ? 'w' : 'b';
      const du = sicht.meineFarbe === siegerFarbe;
      return {
        text: du ? 'Schachmatt — du gewinnst!' : `Schachmatt — ${nameVon(siegerFarbe)} gewinnt`,
        art: 'ende',
      };
    }
    return { text: REMIS[sicht.ende.ausgang] ?? 'Remis', art: 'ende' };
  }
  const du = sicht.meineFarbe === sicht.amZug;
  const wer = du ? 'Du bist am Zug' : `${nameVon(sicht.amZug)} ist am Zug`;
  return sicht.schach ? { text: `Schach! ${wer}.`, art: 'schach' } : { text: wer, art: 'normal' };
}
