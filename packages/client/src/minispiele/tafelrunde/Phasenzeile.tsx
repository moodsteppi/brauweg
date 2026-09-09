/**
 * Die Phasenzeile von Tafelrunde — Runde, Phase im Klartext, Restzeit.
 *
 * Sie steht unter der Mitspielerleiste und beantwortet die zwei Fragen, die
 * am Bildschirm bisher nirgends beantwortet wurden: In welcher Phase bin ich
 * gerade, und wie lange dauert sie noch. „Runde 3" stand zwar als Zahl in der
 * Werteleiste, aber ohne das Wort daneben — und wer zum ersten Mal spielt,
 * liest aus einer 3 nicht ab, dass er gerade aufstellen darf.
 *
 * HIER WIRD NICHTS GERECHNET, was nicht in der Sicht steht. Insbesondere
 * kommt die Frist FERTIG von der Plattform, in beiden Phasen:
 *
 * IN DER KAMPFPHASE aus `interludeDeadline` (runtime/party.ts) — dem Ende der
 * Schaupause, die so lang ist wie der längste Kampf der Runde.
 *
 * IN DER PLATZIERUNGSPHASE aus `phaseDeadline`, seit das Modul eine
 * Rundenfrist kennt (`vorbereitungMs` im Regelsatz von Tafelrunde, 45 s;
 * danach gelten offene Sitze als bereit). Beides sind ECHTE Fristen: Sie
 * stehen ab Beginn der Phase fest und verschieben sich nicht.
 *
 * WAS HIER NIE STEHEN DARF, ist die Zugzeit der Plattform. Sie wird bei JEDER
 * Aktion irgendeines Sitzes neu gestellt (`schedule` in party.ts) — alle
 * rüsten gleichzeitig — und steht auf null, sobald der genannte Sitz ein Bot
 * ist. Eine Zahl daraus wäre keine Restzeit, sondern eine, die beim Kauf einer
 * Einheit wieder hochspringt. Bis zum 06.09.2026 gab es deshalb gar keine
 * Uhr in der Platzierungsphase.
 *
 * OHNE FRIST bleibt es beim WAHREN Druck: wie viele Mitspieler schon bereit
 * sind. Diesen Fall gibt es weiterhin — ein Tisch, der vor dem 06.09.2026
 * aufgemacht wurde, und jede Phase, für die das Modul keine Frist nennt.
 */

import { useEffect, useState } from 'react';

import stil from './Phasenzeile.module.css';

/** Die Phasen des Moduls (partie.ts). */
export type Phase = 'vorbereitung' | 'kampf' | 'ende';

/**
 * Die Phase als Wort.
 *
 * „Platzierungsphase" und nicht „Vorbereitung": Das ist das Wort, das Robin
 * an der Vorlage benutzt hat, und es sagt auch genauer, was zu tun ist.
 */
export function phasenName(phase: Phase): string {
  switch (phase) {
    case 'vorbereitung':
      return 'Platzierungsphase';
    case 'kampf':
      return 'Kampfphase';
    default:
      return 'Partie vorbei';
  }
}

/**
 * Die Restzeit in ganzen Sekunden, oder null ohne Frist.
 *
 * Aufgerundet (`ceil`), damit die Anzeige nicht bei „0" hängt, während noch
 * eine halbe Sekunde läuft — und nie unter null: Eine überzogene Frist ist
 * nicht negativ, sie ist um.
 */
export function restsekunden(frist: number | null, jetzt: number): number | null {
  if (frist === null) return null;
  return Math.max(0, Math.ceil((frist - jetzt) / 1000));
}

/** „0:07" — Minuten nur, wenn es welche gibt; Sekunden immer zweistellig. */
export function uhrText(sekunden: number): string {
  const min = Math.floor(sekunden / 60);
  const sek = sekunden % 60;
  return `${min}:${String(sek).padStart(2, '0')}`;
}

/** Ab wann die Zeit drängt — reine Färbung, keine Regel. */
const KNAPP_S = 5;

/** Die Uhr tickt viermal je Sekunde, damit die Zahl nicht um bis zu 1 s hinkt. */
const TAKT_MS = 250;

function Uhrzeichen(): React.JSX.Element {
  return (
    <svg className={stil.uhr} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function Phasenzeile({
  runde,
  phase,
  frist,
  bereit,
  offen,
}: {
  runde: number;
  phase: Phase;
  /** Ende der laufenden Phase, null wenn dort keine Uhr läuft (siehe Kopf). */
  frist: number | null;
  /** Wie viele Sitze schon bereit sind — nur für die Platzierungsphase. */
  bereit: number;
  /** Wie viele Sitze überhaupt noch dabei sind. */
  offen: number;
}): React.JSX.Element {
  /*
   * Die Uhr hängt an der FRIST und nicht am Sicht-Objekt: Jeder Rundruf des
   * Servers bringt ein neues Objekt, und ein Effekt daran ließe den Takt bei
   * jedem Funk abräumen und neu anlaufen (CLAUDE.md: Effekte an einen
   * Schlüssel hängen). Ohne Frist läuft gar kein Timer — dann gibt es nichts
   * zu zählen.
   */
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (frist === null) return;
    setJetzt(Date.now());
    const takt = window.setInterval(() => setJetzt(Date.now()), TAKT_MS);
    return () => window.clearInterval(takt);
  }, [frist]);

  const rest = restsekunden(frist, jetzt);

  return (
    <div className={stil.zeile}>
      <p className={stil.lage}>
        <strong>Runde {runde}</strong>
        <span className={stil.trenner} aria-hidden="true">
          /
        </span>
        <span className={stil.phase} data-phase={phase}>
          {phasenName(phase)}
        </span>
      </p>

      {rest !== null ? (
        /* `role="timer"` gibt es, wird aber von kaum etwas ausgewertet — und
           eine Zahl, die viermal je Sekunde vorgelesen wird, ist Lärm.
           Deshalb steht die Auskunft im Label und die Ziffern sind stumm. */
        <p className={stil.rest} data-knapp={rest <= KNAPP_S ? '' : undefined}>
          <Uhrzeichen />
          <span aria-hidden="true">{uhrText(rest)}</span>
          <span className={stil.nurVorlesen}>
            Noch {rest} Sekunden in dieser Phase
          </span>
        </p>
      ) : phase === 'vorbereitung' && offen > 0 ? (
        /* Kein Uhrzeichen: Hier läuft keine Uhr, und ein Zifferblatt neben
           einer Zahl, die keine Zeit ist, verspricht genau das Falsche. */
        <p className={stil.bereit} data-voll={bereit >= offen ? '' : undefined}>
          {bereit} von {offen} bereit
        </p>
      ) : null}
    </div>
  );
}
