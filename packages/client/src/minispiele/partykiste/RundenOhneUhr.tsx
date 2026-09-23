/**
 * Die Ansichten der drei Minispiele ohne Uhr — Kategorien-Battle,
 * Mehrheitsraten, Regel-Karte — und die Leiste der geltenden Regel.
 *
 * Seit dem 22.09.2026. Eigene Datei neben `Runden.tsx`, weil dort
 * gleichzeitig andere Aenderungen laufen; die Weiche in `Runden.tsx` haengt
 * nur ein. Es gelten dieselben Grundsaetze: eine Buehne, darunter Knoepfe,
 * und KEINE nachgebildete Regel. Wie viele Stimmen ein Einspruch braucht,
 * steht in der Sicht (`noetig`), ob gemeldet werden darf auch
 * (`meldenMoeglich`) — der Bildschirm zaehlt nur ab, was dort steht.
 */

import { useState } from 'react';

import { Buehne, Leute, Wahl, Wartet, namenFuer, type RundenProps } from './Runden';
import { zaehlerWort, type KategorienSicht, type MehrheitSicht, type RegelkartenSicht } from './sicht';

/** Wie viele Sitze gegen `ziel` stimmen — nur abgezaehlt, entschieden hat der Server. */
function stimmenGegen(liste: readonly number[], ziel: number): number {
  return liste.filter((z) => z === ziel).length;
}

/* --------------------------------------------------------------------------
 * Kategorien-Battle
 * ----------------------------------------------------------------------- */

export function KategorienRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as KategorienSicht;
  const auf = sicht.phase === 'ergebnis';
  const binDran = !auf && daten.amZug === sicht.sitz;
  const anwesend = Math.max(1, sicht.sitze - sicht.ausgestiegen.length);
  /* Aufgerundet: Steigt jemand aus, geht die Grenze nicht mehr glatt auf. */
  const rundenGesamt = Math.ceil(daten.grenze / anwesend);
  const umDenTisch = Math.min(rundenGesamt, Math.floor(daten.nennungen / anwesend) + 1);

  if (auf) {
    const verloren = daten.verlierer >= 0;
    return (
      <Buehne
        oben={verloren ? (daten.wie === 'mehrheit' ? 'Von der Runde benannt' : 'Gestockt') : 'Leergespielt'}
        gross={
          <span className="pk-wort is-klein">
            {verloren
              ? daten.verlierer === sicht.sitz
                ? 'Du hast verloren'
                : `${namenFuer(sitze, daten.verlierer)} hat verloren`
              : 'Niemand ist gestockt'}
          </span>
        }
        unten={
          <span>
            {daten.nennungen} Nennungen zu „{daten.kategorie}"
          </span>
        }
        ton={verloren ? 'schlecht' : 'gut'}
      />
    );
  }

  /*
   * Einspruch geht gegen zwei: den, der dran ist (er ueberlegt zu lange),
   * und den, der eben genannt hat (er hat gedoppelt). Der Server nimmt nur
   * diese beiden an; alles andere waere ein Knopf, der nichts tut.
   */
  const ziele = [daten.amZug, daten.letzter].filter(
    (z, i, alle) => z >= 0 && z !== sicht.sitz && alle.indexOf(z) === i && !sicht.ausgestiegen.includes(z),
  );
  const meinEinspruch = sicht.sitz >= 0 ? (daten.einspruch[sicht.sitz] ?? -1) : -1;

  return (
    <>
      <Buehne
        oben={binDran ? 'Du bist dran — nenn etwas' : `${namenFuer(sitze, daten.amZug)} ist dran`}
        gross={<span className="pk-frage">{daten.kategorie}</span>}
        unten={
          <span>
            {daten.nennungen} genannt · Runde {umDenTisch} von {rundenGesamt} um den Tisch
          </span>
        }
        ton={binDran ? 'geheim' : undefined}
      />
      {binDran ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gut" onClick={() => sende({ art: 'genannt' })}>
            Genannt
          </button>
          <button type="button" className="pk-knopf is-weg" onClick={() => sende({ art: 'gestockt' })}>
            Gestockt
          </button>
        </Wahl>
      ) : null}
      {sicht.sitz >= 0 && ziele.length > 0 ? (
        <div className="pk-ou-einspruch" aria-label="Einspruch">
          {ziele.map((ziel) => {
            const noetig = daten.noetig[ziel] ?? 0;
            return (
              <button
                key={ziel}
                type="button"
                className="pk-knopf is-neben"
                data-gewaehlt={meinEinspruch === ziel ? '' : undefined}
                disabled={noetig === 0}
                onClick={() => sende({ art: 'einspruch', ziel })}
              >
                {ziel === daten.amZug ? 'Stockt!' : 'Doppelt!'} — {namenFuer(sitze, ziel)}
                <small className="pk-zaehler">
                  {stimmenGegen(daten.einspruch, ziel)} von {noetig} nötig
                </small>
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Mehrheitsraten
 * ----------------------------------------------------------------------- */

export function MehrheitRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as MehrheitSicht;
  const auf = daten.mehrheit !== null;
  /* Zwei Schritte, ein Zug: erst die eigene Antwort merken, mit dem Tipp geht beides raus. */
  const [eigene, setEigene] = useState(-1);
  const abgegeben = daten.meine >= 0;
  const seiten = [daten.a, daten.b] as const;

  if (auf) {
    const zaehl = (seite: number): number =>
      (daten.eigene ?? []).filter((e, s) => e === seite && !sicht.ausgestiegen.includes(s)).length;
    const mehrheit = daten.mehrheit ?? -1;
    return (
      <>
        <Buehne
          gross={<span className="pk-frage">{daten.frage}</span>}
          unten={<span>{mehrheit < 0 ? 'Gleichstand — keine Mehrheit, alle lagen daneben.' : `Die Mehrheit: ${seiten[mehrheit]}`}</span>}
          ton={mehrheit < 0 ? 'schlecht' : 'gut'}
        />
        <Wahl>
          {seiten.map((text, seite) => (
            <button key={seite} type="button" className="pk-knopf is-gross" data-richtig={mehrheit === seite ? '' : undefined} disabled>
              {text}
              <small className="pk-zaehler">{zaehl(seite)}</small>
            </button>
          ))}
        </Wahl>
        <ul className="pk-liste">
          {(daten.tipp ?? []).map((tipp, sitz) =>
            sicht.ausgestiegen.includes(sitz) ? null : (
              <li key={sitz} data-gut={mehrheit >= 0 && tipp === mehrheit ? '' : undefined}>
                <span>{namenFuer(sitze, sitz)}</span>
                <span className="muted">
                  {tipp < 0 ? 'kein Tipp' : `sagt ${seiten[daten.eigene?.[sitz] ?? -1] ?? '—'}, tippt ${seiten[tipp]}`}
                </span>
              </li>
            ),
          )}
        </ul>
      </>
    );
  }

  if (abgegeben || sicht.sitz < 0) {
    return (
      <>
        <Buehne gross={<span className="pk-frage">{daten.frage}</span>} />
        {abgegeben ? (
          <p className="pk-busfrage">
            Du: {seiten[daten.meine]} · Dein Tipp: {seiten[daten.meinTipp] ?? '—'}
          </p>
        ) : null}
        <Wartet sicht={sicht} />
      </>
    );
  }

  return (
    <>
      <Buehne
        oben={eigene < 0 ? 'Schritt 1 — was sagst du?' : 'Schritt 2 — was sagt die Mehrheit?'}
        gross={<span className="pk-frage">{daten.frage}</span>}
        unten={eigene < 0 ? undefined : <span>Du: {seiten[eigene]}</span>}
      />
      {eigene < 0 ? (
        <Wahl>
          {seiten.map((text, seite) => (
            <button key={seite} type="button" className="pk-knopf is-gross" onClick={() => setEigene(seite)}>
              {text}
            </button>
          ))}
        </Wahl>
      ) : (
        <>
          <p className="pk-busfrage">Die Mehrheit sagt …</p>
          <Wahl>
            {seiten.map((text, seite) => (
              <button
                key={seite}
                type="button"
                className="pk-knopf is-gross"
                onClick={() => sende({ art: 'mehrheitstipp', eigene, tipp: seite })}
              >
                {text}
              </button>
            ))}
          </Wahl>
          <button type="button" className="pk-textknopf" onClick={() => setEigene(-1)}>
            Eigene Antwort ändern
          </button>
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Regel-Karte
 * ----------------------------------------------------------------------- */

export function RegelkartenRunde({ sicht, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as RegelkartenSicht;
  const auf = sicht.phase === 'ergebnis';
  const gelesen = sicht.gehandelt.includes(sicht.sitz);
  const bis = daten.bis + 1;

  return (
    <>
      <Buehne
        oben={auf ? 'Ab jetzt gilt' : 'Neue Regel'}
        gross={<span className="pk-frage">{daten.text}</span>}
        unten={
          <span>
            {bis <= sicht.rundeNr + 1 ? 'Gilt bis zum Schluss.' : `Gilt bis zum Ende von Runde ${bis}.`} Wer
            verstößt, meldet sich selbst — oder die Runde meldet ihn.
          </span>
        }
        ton="geheim"
      />
      {auf ? null : gelesen || sicht.sitz < 0 ? (
        <Wartet sicht={sicht} />
      ) : (
        <Wahl>
          <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'bereit' })}>
            Verstanden
          </button>
        </Wahl>
      )}
    </>
  );
}

/**
 * Die Leiste der geltenden Regel — ueber JEDER Runde, solange sie gilt.
 *
 * Sie steht im Spielkopf und nicht in einer Runde, weil die Regel waehrend
 * ganz anderer Minispiele gebrochen wird. Melden ist zweistufig, damit
 * niemand im Vorbeiwischen einen Mitspieler anklagt: "Melden" klappt die
 * Namen erst auf.
 */
export function AktiveRegel({ sicht, sitze, sende }: RundenProps): React.JSX.Element | null {
  const [offen, setOffen] = useState(false);
  const regel = sicht.regelKarte;
  if (!regel) return null;
  /* Waehrend die neue Karte gelesen wird, steht die alte noch — sonst verschwaende sie kommentarlos. */
  const darf = regel.meldenMoeglich && sicht.sitz >= 0;
  const ertappt = regel.verstoesse
    .map((zahl, sitz) => ({ zahl, sitz }))
    .filter(({ zahl, sitz }) => zahl > 0 && !sicht.ausgestiegen.includes(sitz));
  const meineAnklage = sicht.sitz >= 0 ? (regel.anklage[sicht.sitz] ?? -1) : -1;

  return (
    <section className="pk-ou-regel" aria-label="Geltende Regel" data-pk-regel="">
      <p className="pk-ou-regel-kopf">
        <span className="pk-ou-regel-marke">Regel</span>
        <span className="muted">bis Runde {regel.bis + 1}</span>
      </p>
      <p className="pk-ou-regel-text">{regel.text}</p>
      {ertappt.length > 0 ? (
        <p className="pk-ou-regel-ertappt">
          Verstöße:{' '}
          {ertappt.map(({ zahl, sitz }) => `${namenFuer(sitze, sitz)} ${zahl}×`).join(', ')}
        </p>
      ) : null}
      {darf ? (
        <>
          <div className="pk-wahl">
            <button type="button" className="pk-knopf is-weg" onClick={() => sende({ art: 'verstoss', ziel: sicht.sitz })}>
              Ich hab verstoßen
            </button>
            <button type="button" className="pk-knopf is-neben" aria-expanded={offen} onClick={() => setOffen((an) => !an)}>
              {offen ? 'Doch nicht' : 'Jemanden melden'}
            </button>
          </div>
          {offen ? (
            <>
              <Leute
                sicht={sicht}
                sitze={sitze}
                gewaehlt={meineAnklage}
                gesperrt={false}
                beiWahl={(ziel) => sende({ art: 'verstoss', ziel })}
              />
              <p className="pk-ou-regel-hinweis muted">
                {meineAnklage >= 0
                  ? `${namenFuer(sitze, meineAnklage)}: ${stimmenGegen(regel.anklage, meineAnklage)} von ${regel.noetig[meineAnklage] ?? 0} Stimmen — dann ist es ein ${zaehlerWort(sicht.trinkmodus, 1)}.`
                  : 'Es zählt, wenn die Mehrheit denselben meldet.'}
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
