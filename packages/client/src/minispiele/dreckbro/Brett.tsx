/**
 * Das Spielfeld von DreckBro: Gegner oben, Stapel in der Mitte, die eigenen
 * Pinguine und die Hand unten.
 *
 * Ohne Server-Anbindung, damit die Probeseite (/probe/dreckbro) es mit
 * festen Staenden zeigen kann. Was spielbar ist, kommt allein aus `zuege`
 * (= `legalActions`); hier wird nur angetippt und zurueckgeschickt.
 */

import { useEffect, useState } from 'react';

import { angebotFuer, spielbar, zugFuer } from './auswahl';
import { KartenMotiv, PinguinBild } from './Bilder';
import stil from './DreckBro.module.css';
import type { DreckBroSicht, DreckBroZug, KartenArt, LetzterZug, Ziel } from './sicht';

export const KARTE: Record<KartenArt, { name: string; text: string; sorte: 'dreck' | 'angriff' | 'schutz' }> = {
  pfuetze: { name: 'Pfütze', text: 'Ein eigener Pinguin wird eine Stufe dreckiger.', sorte: 'dreck' },
  schlammrutsche: { name: 'Schlammrutsche', text: 'Alle deine blitzblanken Pinguine werden fleckig.', sorte: 'dreck' },
  schneeball: { name: 'Schneeball', text: 'Ein fremder Pinguin wird eine Stufe sauberer.', sorte: 'angriff' },
  eisregen: { name: 'Eisregen', text: 'Alle fremden Pinguine ohne Iglu: eine Stufe sauberer.', sorte: 'angriff' },
  iglu: { name: 'Iglu', text: 'Schützt einen eigenen Pinguin vor Schnee, Regen und Robbe.', sorte: 'schutz' },
  tauwetter: { name: 'Tauwetter', text: 'Schmilzt einen fremden Iglu weg.', sorte: 'angriff' },
  robbenklau: { name: 'Robbenklau', text: 'Tausche einen eigenen Pinguin gegen einen dreckigeren.', sorte: 'angriff' },
};

export const STUFE = ['blitzblank', 'fleckig', 'DreckBro'] as const;

/** Ein Satz zum letzten Zug, fuer die Mitte des Tisches. */
export function zugText(zug: LetzterZug | null, name: (sitz: number) => string): string {
  if (!zug) return 'Noch kein Zug. Wer zuerst drei Pinguine voll eingesaut hat, gewinnt.';
  const wer = name(zug.sitz);
  if (zug.art === 'abwerfen') return `${wer} hat ${zug.abgeworfen ? KARTE[zug.abgeworfen].name : 'eine Karte'} abgeworfen.`;
  const karte = KARTE[zug.art].name;
  if (zug.art === 'robbenklau' && zug.ziel) return `${wer} klaut mit der Robbe einen Pinguin von ${name(zug.ziel.sitz)}.`;
  if (zug.ziel) return `${wer} spielt ${karte} auf einen Pinguin von ${name(zug.ziel.sitz)}.`;
  return `${wer} spielt ${karte}.`;
}

export function KarteAnsicht({
  art,
  klein = false,
}: {
  art: KartenArt;
  klein?: boolean;
}): React.JSX.Element {
  const k = KARTE[art];
  return (
    <span className={`${stil.karte} ${stil[`sorte_${k.sorte}`] ?? ''}${klein ? ` ${stil.karteKlein}` : ''}`}>
      <span className={stil.karteName}>{k.name}</span>
      <span className={stil.karteMotiv}>
        <KartenMotiv art={art} />
      </span>
      {!klein && <span className={stil.karteText}>{k.text}</span>}
    </span>
  );
}

const gleich = (a: Ziel | null, sitz: number, pinguin: number): boolean =>
  a !== null && a.sitz === sitz && a.pinguin === pinguin;

export function Brett({
  sicht,
  zuege,
  name,
  onZug,
}: {
  sicht: DreckBroSicht;
  zuege: readonly DreckBroZug[];
  /** Anzeigename eines Sitzes. */
  name: (sitz: number) => string;
  onZug: (zug: DreckBroZug) => void;
}): React.JSX.Element {
  const [karte, setKarte] = useState<number | null>(null);
  const [eigen, setEigen] = useState<number | null>(null);

  // Nach jedem Zug neu waehlen — am Schluessel, nicht an der Sicht (CLAUDE.md).
  useEffect(() => {
    setKarte(null);
    setEigen(null);
  }, [sicht.zuege]);

  const ich = sicht.meinSitz;
  const dran = ich !== null && sicht.amZug === ich && !sicht.ende;
  const angebot = karte !== null ? angebotFuer(zuege, karte, eigen) : null;

  const andere: number[] = [];
  for (let i = 1; i < sicht.sitze; i++) andere.push(((ich ?? -1) + i + sicht.sitze) % sicht.sitze);
  if (ich === null) andere.unshift(sicht.sitze - 1);

  const tippeEigen = (index: number): void => {
    if (karte === null || !angebot || !angebot.eigen.includes(index)) return;
    if (angebot.zweiZiele) {
      setEigen(index);
      return;
    }
    const zug = zugFuer(zuege, karte, index, null);
    if (zug) onZug(zug);
  };

  const tippeFremd = (ziel: Ziel): void => {
    if (karte === null || !angebot || !angebot.fremd.some((f) => gleich(f, ziel.sitz, ziel.pinguin))) return;
    const zug = zugFuer(zuege, karte, angebot.zweiZiele ? eigen : null, ziel);
    if (zug) onZug(zug);
  };

  const reihe = (sitz: number, gross: boolean): React.JSX.Element => {
    const pinguine = sicht.pinguine[sitz] ?? [];
    return (
      <div className={`${stil.pinguine}${gross ? ` ${stil.pinguineGross}` : ''}`}>
        {pinguine.map((p, i) => {
          const istEigen = sitz === ich;
          const waehlbar =
            !!angebot && (istEigen ? angebot.eigen.includes(i) && (!angebot.zweiZiele || eigen === null) : angebot.fremd.some((f) => gleich(f, sitz, i)));
          const gewaehlt = istEigen && eigen === i;
          return (
            <button
              key={i}
              type="button"
              className={`${stil.pinguin}${waehlbar ? ` ${stil.waehlbar}` : ''}${gewaehlt ? ` ${stil.gewaehlt}` : ''}${p.dreck >= 2 ? ` ${stil.voll}` : ''}`}
              disabled={!waehlbar}
              onClick={() => (istEigen ? tippeEigen(i) : tippeFremd({ sitz, pinguin: i }))}
              aria-label={`Pinguin ${i + 1} von ${name(sitz)}: ${STUFE[p.dreck] ?? p.dreck}${p.iglu ? ', im Iglu' : ''}`}
            >
              <PinguinBild dreck={p.dreck} iglu={p.iglu} />
              <span className={stil.stufe}>{STUFE[p.dreck]}</span>
            </button>
          );
        })}
      </div>
    );
  };

  let hinweis: string;
  if (sicht.ende) hinweis = '';
  else if (!dran) hinweis = sicht.amZug !== null ? `${name(sicht.amZug)} ist am Zug …` : '';
  else if (karte === null) hinweis = 'Du bist dran: Wähle eine Karte.';
  else if (angebot?.ohneZiel) hinweis = 'Ausspielen oder abwerfen?';
  else if (angebot?.zweiZiele && eigen === null && angebot.eigen.length > 0) hinweis = 'Welchen deiner Pinguine gibst du her?';
  else if (angebot?.zweiZiele && eigen !== null) hinweis = 'Und welchen Pinguin klaut die Robbe?';
  else if (angebot && angebot.eigen.length > 0) hinweis = 'Tippe einen deiner Pinguine an.';
  else if (angebot && angebot.fremd.length > 0) hinweis = 'Tippe einen fremden Pinguin an.';
  else hinweis = 'Diese Karte passt gerade nirgends – wirf sie ab.';

  return (
    <div className={stil.brett}>
      <div className={stil.gegner}>
        {andere.map((sitz) => (
          <div key={sitz} className={`${stil.gegnerZeile}${sicht.amZug === sitz && !sicht.ende ? ` ${stil.dran}` : ''}`}>
            <div className={stil.gegnerKopf}>
              <strong>{name(sitz)}</strong>
              <span>{sicht.handAnzahl[sitz] ?? 0} Karten</span>
            </div>
            {reihe(sitz, false)}
          </div>
        ))}
      </div>

      <div className={stil.mitteFeld}>
        <span className={stil.stapel} aria-label={`${sicht.stapel} Karten im Stapel`}>
          <span className={stil.ruecken}>
            <PinguinBild dreck={1} iglu={false} />
          </span>
          <b>{sicht.stapel}</b>
        </span>
        {sicht.ablage ? <KarteAnsicht art={sicht.ablage} klein /> : <span className={stil.ablageLeer}>Ablage</span>}
        <p className={stil.letzter} role="status">
          {zugText(sicht.letzterZug, name)}
        </p>
      </div>

      {ich !== null && (
        <div className={`${stil.meine}${dran ? ` ${stil.dran}` : ''}`}>
          {reihe(ich, true)}
        </div>
      )}

      {ich !== null && (
        <>
          <p className={stil.hinweis}>{hinweis}</p>
          <div className={stil.hand}>
            {sicht.hand.map((k) => {
              const geht = spielbar(zuege, k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  className={`${stil.handKarte}${karte === k.id ? ` ${stil.handGewaehlt}` : ''}${dran && !geht ? ` ${stil.handMatt}` : ''}`}
                  disabled={!dran}
                  onClick={() => {
                    setKarte(karte === k.id ? null : k.id);
                    setEigen(null);
                  }}
                >
                  <KarteAnsicht art={k.art} />
                </button>
              );
            })}
          </div>
          <div className={stil.knoepfe}>
            {angebot?.ohneZiel && (
              <button type="button" className="hb-kn is-gold" onClick={() => onZug(angebot.ohneZiel!)}>
                Ausspielen
              </button>
            )}
            {angebot?.abwerfen && (
              <button type="button" className="hb-kn" onClick={() => onZug(angebot.abwerfen!)}>
                Abwerfen
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
