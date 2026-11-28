import { useEffect, useRef, useState } from 'react';

import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { bockApi, type BockSicht } from './api';
import './bock.css';

/** Abfragetakt am Tisch — die Rangfolge aendert sich nur zwischen Stationen. */
const TAKT_MS = 4000;
/**
 * So lange bleibt man nach dem Partie-Ende am Tisch, bevor der Zwischenstand
 * kommt: Der Endstand des Spiels soll zu sehen sein, nicht weggerissen werden.
 */
const NACHLAUF_MS = 4000;

/**
 * Das schmale Band „BroweG-Bock · Station 2/3 · du bist 1." ueber dem Tisch.
 *
 * Es liegt in App.tsx ueber dem jeweiligen Bildschirm, statt dass jeder
 * Tischbildschirm einen Bock kennen muesste — so bleibt das Dutzend Tische
 * unberuehrt. Antippen oeffnet den Bock. Ist die Station vorbei (der Server
 * nennt keinen laufenden Tisch mehr), oeffnet es ihn nach einem kurzen
 * Nachlauf von selbst: Dort laeuft der Zwischenstand, von dort geht es an
 * den naechsten Tisch.
 */
export function BockBand({
  bockId,
  onOeffnen,
  onVorbei,
  api = bockApi,
}: {
  bockId: string;
  /** Den Bock zeigen; mitgegeben wird der Tisch, von dem man kommt. */
  onOeffnen: (letzterTisch: string | null) => void;
  /** Den Bock gibt es fuer dieses Konto nicht mehr (verlassen, geloescht). */
  onVorbei: () => void;
  api?: typeof bockApi;
}): React.JSX.Element | null {
  const [sicht, setSicht] = useState<BockSicht | null>(null);
  const letzterTisch = useRef<string | null>(null);
  const nachlauf = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oeffnen = useRef(onOeffnen);
  oeffnen.current = onOeffnen;
  const vorbei = useRef(onVorbei);
  vorbei.current = onVorbei;

  useEffect(() => {
    let lebt = true;
    let erster = true;
    const holen = (): void => {
      api
        .stand(bockId)
        .then((neu) => {
          if (!lebt) return;
          setSicht(neu);
          const ich = neu.ich === null ? null : neu.sitze[neu.ich];
          if (!ich || ich.verlassen) {
            vorbei.current();
            return;
          }
          const warErster = erster;
          erster = false;
          if (neu.tisch) {
            /*
             * Eine NEUE Station, waehrend man im Hub steht (den Zwischenstand
             * verlassen): hin zum Bock, der fuehrt an den Tisch. Beim ersten
             * Abruf nicht — wer eben vom laufenden Tisch in den Hub ging,
             * wollte genau dorthin.
             */
            const neuerTisch = neu.tisch.tableId !== letzterTisch.current;
            letzterTisch.current = neu.tisch.tableId;
            if (neuerTisch && !warErster) oeffnen.current(null);
            return;
          }
          // Kein laufender Tisch mehr, aber eben noch einer: Station vorbei.
          if (letzterTisch.current && !nachlauf.current) {
            const tisch = letzterTisch.current;
            nachlauf.current = setTimeout(() => {
              nachlauf.current = null;
              letzterTisch.current = null;
              if (lebt) oeffnen.current(tisch);
            }, NACHLAUF_MS);
          }
        })
        .catch(() => undefined);
    };
    holen();
    const takt = setInterval(holen, TAKT_MS);
    return () => {
      lebt = false;
      clearInterval(takt);
      if (nachlauf.current) clearTimeout(nachlauf.current);
      nachlauf.current = null;
    };
  }, [bockId, api]);

  if (!sicht || sicht.zustand === 'wartet' || sicht.ich === null) return null;
  const ich = sicht.sitze[sicht.ich]!;
  const n = Math.max(1, sicht.station);
  const m = sicht.plan.length;
  const text = sicht.tisch
    ? tf('bock.band', { n, m, rang: ich.rang })
    : tf('bock.band.vorbei', { n, m });

  return (
    <button
      type="button"
      className="bock-band"
      aria-label={`${t('bock.band.oeffnen')}: ${text}`}
      onClick={() => onOeffnen(sicht.tisch?.tableId ?? letzterTisch.current)}
    >
      <img src="/hub/banner-mehrkampf.webp" alt="" />
      <span className="bock-band-text">
        <strong>{t('modus.mehrkampf')}</strong>
        <span>{text}</span>
      </span>
    </button>
  );
}
