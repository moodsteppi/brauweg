/**
 * Die sechs Minispiel-Ansichten der Partykiste.
 *
 * Alle sechs sehen absichtlich gleich aus: eine Buehne in der Mitte, darunter
 * die Schaltflaechen. Was auf der Buehne steht, ist das ganze Spiel — beim
 * Imposter EIN Wort, beim Quiz eine Frage, beim Bus drei Karten. Es gibt hier
 * keine Spielbretter, keine Animation und keine zweite Ebene: Der Abend findet
 * am Tisch statt, der Bildschirm nimmt nur die Entscheidung entgegen.
 *
 * Diese Datei bildet KEINE Regel nach. Ob eine Schaltflaeche erlaubt ist, sagt
 * die Sicht (`phase`, `amZug`, `gehandelt`); was eine Runde ergeben hat, sagt
 * die Sicht (`rundenPunkte`, `stimmen`, `richtig`). Eine zweite Fassung
 * derselben Regel laeuft beim ersten geaenderten Zaehler auseinander — siehe
 * CLAUDE.md, Tafelrunde.
 */

import { useState } from 'react';

import type { SeatInfo } from '../../protocol';
import {
  FARBZEICHEN,
  istRoteKarte,
  rangName,
  zaehlerWort,
  type BusSicht,
  type EntwederSicht,
  type ImposterSicht,
  type NiemalsSicht,
  type PartyAktion,
  type PartyKarte,
  type PartykisteSicht,
  type QuizSicht,
  type SchaetzSicht,
  type WahrheitPflichtSicht,
  type WerBinIchSicht,
  type WerEherSicht,
} from './sicht';

export interface RundenProps {
  sicht: PartykisteSicht;
  sitze: SeatInfo[];
  sende: (aktion: PartyAktion) => void;
}

/* --------------------------------------------------------------------------
 * Gemeinsame Bausteine
 * ----------------------------------------------------------------------- */

export function namenFuer(sitze: SeatInfo[], sitz: number): string {
  const eintrag = sitze.find((s) => s.seat === sitz);
  if (!eintrag) return `Platz ${sitz + 1}`;
  if (eintrag.isBot) return eintrag.displayName ?? `Bot ${sitz + 1}`;
  return eintrag.displayName ?? `Platz ${sitz + 1}`;
}

/** Die Buehne: eine Karte, auf der das Wesentliche steht. */
function Buehne({
  oben,
  gross,
  unten,
  ton,
}: {
  oben?: string;
  gross: React.ReactNode;
  unten?: React.ReactNode;
  ton?: 'gut' | 'schlecht' | 'geheim';
}): React.JSX.Element {
  return (
    <div className="pk-buehne" data-ton={ton ?? undefined}>
      {oben ? <p className="pk-buehne-oben">{oben}</p> : null}
      <div className="pk-buehne-gross">{gross}</div>
      {unten ? <div className="pk-buehne-unten">{unten}</div> : null}
    </div>
  );
}

/** Eine Reihe grosser Schaltflaechen — die einzige Eingabe, die es hier gibt. */
function Wahl({
  weit,
  children,
}: {
  weit?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="pk-wahl" data-weit={weit ? '' : undefined}>
      {children}
    </div>
  );
}

/** Warten auf die anderen — mit Zahl, damit man weiss, ob es hakt. */
export function Wartet({ sicht }: { sicht: PartykisteSicht }): React.JSX.Element {
  /* In der Abrechnung tippen Bots kein "Weiter" — sie zaehlen als fertig,
     sonst stuende hier "Noch 3 Leute", die es nie gibt. */
  const bots = sicht.phase === 'ergebnis' ? sicht.botSitze.filter((b) => !sicht.gehandelt.includes(b)).length : 0;
  const offen = sicht.sitze - sicht.ausgestiegen.length - sicht.gehandelt.length - bots;
  return (
    <p className="pk-wartet">
      {offen > 0 ? `Noch ${offen} ${offen === 1 ? 'Person' : 'Leute'} …` : 'Gleich geht es weiter …'}
    </p>
  );
}

/** Eine Spielkarte. Gezeichnet und nicht geladen — vier Zeichen reichen. */
export function Karte({ karte, zu }: { karte?: PartyKarte; zu?: boolean }): React.JSX.Element {
  if (zu || !karte) return <div className="pk-karte is-zu" aria-label="verdeckte Karte" />;
  const rot = istRoteKarte(karte);
  return (
    <div className="pk-karte" data-rot={rot ? '' : undefined}>
      <span className="pk-karte-rang">{rangName(karte.rang)}</span>
      <span className="pk-karte-farbe">{FARBZEICHEN[karte.farbe] ?? '♠'}</span>
    </div>
  );
}

/** Schaltflaechen mit den Namen der Mitspieler — zum Zeigen und Verdaechtigen. */
function Leute({
  sicht,
  sitze,
  gewaehlt,
  gesperrt,
  beiWahl,
}: {
  sicht: PartykisteSicht;
  sitze: SeatInfo[];
  gewaehlt: number;
  gesperrt: boolean;
  beiWahl: (ziel: number) => void;
}): React.JSX.Element {
  const ziele: number[] = [];
  for (let s = 0; s < sicht.sitze; s++) {
    if (s !== sicht.sitz && !sicht.ausgestiegen.includes(s)) ziele.push(s);
  }
  return (
    <div className="pk-leute">
      {ziele.map((ziel) => (
        <button
          key={ziel}
          type="button"
          className="pk-person"
          data-gewaehlt={gewaehlt === ziel ? '' : undefined}
          disabled={gesperrt}
          onClick={() => beiWahl(ziel)}
        >
          {namenFuer(sitze, ziel)}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Imposter
 * ----------------------------------------------------------------------- */

function ImposterRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as ImposterSicht;

  /*
   * Der Imposter sieht, dass er es ist, und bekommt statt des Wortes nur den
   * Hinweis. Bis zum 19.09.2026 bekam er ein Nachbarwort und merkte es erst
   * spaet — das war fuer die Ehrlichen lustig und fuer ihn nur verwirrend.
   */
  const karte = daten.binImposter ? (
    <>
      <span className="pk-wort">IMPOSTER</span>
      <span className="pk-hinweis">Hinweis: {daten.hinweis ?? '—'}</span>
    </>
  ) : (
    <span className="pk-wort">{daten.meinWort ?? '—'}</span>
  );
  const reihe = (
    <ol className="pk-reihe" aria-label="Redereihenfolge">
      {daten.reihenfolge.map((s) => (
        <li key={s} data-ich={s === sicht.sitz ? '' : undefined}>
          {namenFuer(sitze, s)}
        </li>
      ))}
    </ol>
  );

  if (sicht.phase === 'sehen') {
    const gesehen = sicht.gehandelt.includes(sicht.sitz);
    return (
      <>
        <Buehne
          oben={daten.binImposter ? 'Du bist es — zeig es niemandem' : 'Dein Wort — zeig es niemandem'}
          gross={<span className="pk-karte-inhalt">{karte}</span>}
          ton={daten.binImposter ? 'schlecht' : 'geheim'}
        />
        <p className="pk-ansage">Redereihenfolge — jeder sagt einen Satz zum Wort:</p>
        {reihe}
        {gesehen ? (
          <Wartet sicht={sicht} />
        ) : (
          <Wahl>
            <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'bereit' })}>
              Gesehen
            </button>
          </Wahl>
        )}
      </>
    );
  }

  if (sicht.phase === 'spiel') {
    const abgestimmt = sicht.gehandelt.includes(sicht.sitz);
    return (
      <>
        <Buehne
          oben={daten.binImposter ? 'Du bist der Imposter' : 'Dein Wort'}
          gross={
            <span className="pk-wort is-klein">
              {daten.binImposter ? `Hinweis: ${daten.hinweis ?? '—'}` : (daten.meinWort ?? '—')}
            </span>
          }
          unten={
            <span>
              {daten.redeRunde > 1 ? `${daten.redeRunde}. Rederunde — ` : ''}
              Reihum ein Satz, in dieser Reihenfolge. Dann: Wer passt nicht?
            </span>
          }
        />
        {reihe}
        <Leute
          sicht={sicht}
          sitze={sitze}
          gewaehlt={-1}
          gesperrt={abgestimmt}
          beiWahl={(ziel) => sende({ art: 'stimme', ziel })}
        />
        {/*
          Statt zu stimmen: noch eine Rederunde verlangen. Mehr als die Haelfte
          der Anwesenden muss das wollen, dann faellt jede bisherige Stimme und
          die Reihenfolge rueckt um einen Platz. Der Zaehler zeigt, wie nah es
          ist — sonst tippt einer und wundert sich, dass nichts passiert.
        */}
        {daten.nochmalMoeglich ? (
          <button
            type="button"
            className="pk-knopf is-neben"
            disabled={abgestimmt}
            data-gewaehlt={daten.nochmal.includes(sicht.sitz) ? '' : undefined}
            onClick={() => sende({ art: 'nochmal' })}
          >
            Noch eine Runde reden
            <small className="pk-zaehler">
              {daten.nochmal.length} von {Math.floor((sicht.sitze - sicht.ausgestiegen.length) / 2) + 1} nötig
            </small>
          </button>
        ) : null}
        {abgestimmt ? <Wartet sicht={sicht} /> : null}
      </>
    );
  }

  const taeter = daten.imposter ?? -1;
  const ertappt = daten.ertappt === true;
  return (
    <>
      <Buehne
        oben={ertappt ? 'Ertappt!' : 'Durchgekommen'}
        gross={
          <span className="pk-wort is-klein">
            {taeter === sicht.sitz ? 'Du warst es' : `${namenFuer(sitze, taeter)} war es`}
          </span>
        }
        unten={
          <span>
            Wort der Runde: <strong>{daten.echtesWort}</strong>
          </span>
        }
        ton={ertappt ? 'gut' : 'schlecht'}
      />
      <ul className="pk-liste">
        {(daten.stimmen ?? []).map((ziel, sitz) =>
          ziel < 0 ? null : (
            <li key={sitz}>
              <span>{namenFuer(sitze, sitz)}</span>
              <span className="muted">zeigte auf {namenFuer(sitze, ziel)}</span>
            </li>
          ),
        )}
      </ul>
    </>
  );
}

/* --------------------------------------------------------------------------
 * Allgemeinwissen
 * ----------------------------------------------------------------------- */

function QuizRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as QuizSicht;
  const auf = daten.richtig !== null;
  const gewaehlt = daten.meineWahl;

  return (
    <>
      <Buehne gross={<span className="pk-frage">{daten.frage}</span>} />
      <Wahl weit>
        {daten.antworten.map((antwort, i) => (
          <button
            key={i}
            type="button"
            className="pk-knopf is-antwort"
            data-richtig={auf && daten.richtig === i ? '' : undefined}
            data-daneben={auf && gewaehlt === i && daten.richtig !== i ? '' : undefined}
            data-gewaehlt={!auf && gewaehlt === i ? '' : undefined}
            disabled={auf || gewaehlt >= 0}
            onClick={() => sende({ art: 'antwort', wahl: i })}
          >
            {antwort}
          </button>
        ))}
      </Wahl>
      {!auf && gewaehlt >= 0 ? <Wartet sicht={sicht} /> : null}
      {auf ? (
        <ul className="pk-liste">
          {(daten.wahl ?? []).map((wahl, sitz) =>
            sicht.ausgestiegen.includes(sitz) ? null : (
              <li key={sitz} data-gut={wahl === daten.richtig ? '' : undefined}>
                <span>{namenFuer(sitze, sitz)}</span>
                <span className="muted">
                  {wahl < 0 ? 'keine Antwort' : (daten.antworten[wahl] ?? '—')}
                </span>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Wer bin ich
 * ----------------------------------------------------------------------- */

function WerBinIchRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as WerBinIchSicht;
  const binDran = sicht.amZug === sicht.sitz;
  const auf = sicht.phase === 'ergebnis';

  return (
    <>
      <Buehne
        oben={binDran ? 'Du bist dran' : `${namenFuer(sitze, daten.amZug)} ist dran`}
        gross={
          <span className="pk-wort is-klein">
            {binDran ? 'Frag die Runde aus' : (daten.namen[daten.amZug] ?? '?')}
          </span>
        }
        unten={
          binDran ? (
            <span>Nur Ja-Nein-Fragen. Die Runde antwortet laut.</span>
          ) : (
            <span>Antwortet nur mit Ja oder Nein.</span>
          )
        }
        ton={binDran ? 'geheim' : undefined}
      />
      <div className="pk-stirnen">
        {daten.namen.map((name, sitz) =>
          sicht.ausgestiegen.includes(sitz) ? null : (
            <div
              key={sitz}
              className="pk-stirn"
              data-ich={sitz === sicht.sitz ? '' : undefined}
              data-dran={sitz === daten.amZug ? '' : undefined}
              data-fertig={daten.erfolg[sitz] === 1 ? 'gut' : daten.erfolg[sitz] === 0 ? 'weg' : undefined}
            >
              <span className="pk-stirn-name">{name ?? '? ? ?'}</span>
              <span className="pk-stirn-wer">{namenFuer(sitze, sitz)}</span>
            </div>
          ),
        )}
      </div>
      {binDran && !auf ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gut" onClick={() => sende({ art: 'geraten', erfolg: true })}>
            Erraten!
          </button>
          <button type="button" className="pk-knopf is-weg" onClick={() => sende({ art: 'geraten', erfolg: false })}>
            Aufgeben
          </button>
        </Wahl>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Ich hab noch nie
 * ----------------------------------------------------------------------- */

function NiemalsRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as NiemalsSicht;
  const auf = daten.gestanden !== null;

  return (
    <>
      <Buehne gross={<span className="pk-frage">{daten.text}</span>} />
      {auf ? (
        <ul className="pk-liste">
          {(daten.gestanden ?? []).map((wert, sitz) =>
            sicht.ausgestiegen.includes(sitz) ? null : (
              <li key={sitz} data-gut={wert !== 1 ? '' : undefined}>
                <span>{namenFuer(sitze, sitz)}</span>
                <span className="muted">{wert === 1 ? 'hat es getan' : 'noch nie'}</span>
              </li>
            ),
          )}
        </ul>
      ) : (
        <>
          <Wahl>
            <button
              type="button"
              className="pk-knopf is-weg"
              data-gewaehlt={daten.meine === 1 ? '' : undefined}
              disabled={daten.meine >= 0}
              onClick={() => sende({ art: 'gestehen', ja: true })}
            >
              Hab ich
            </button>
            <button
              type="button"
              className="pk-knopf is-gut"
              data-gewaehlt={daten.meine === 0 ? '' : undefined}
              disabled={daten.meine >= 0}
              onClick={() => sende({ art: 'gestehen', ja: false })}
            >
              Noch nie
            </button>
          </Wahl>
          {daten.meine >= 0 ? <Wartet sicht={sicht} /> : null}
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Wer wuerde eher
 * ----------------------------------------------------------------------- */

function WerEherRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as WerEherSicht;
  const auf = daten.stimmen !== null;

  if (auf) {
    const zaehler = new Array<number>(sicht.sitze).fill(0);
    for (const ziel of daten.stimmen ?? []) if (ziel >= 0) zaehler[ziel] = (zaehler[ziel] ?? 0) + 1;
    const meiste = Math.max(1, ...zaehler);
    return (
      <>
        <Buehne gross={<span className="pk-frage">{daten.text}</span>} />
        <div className="pk-balken">
          {zaehler.map((zahl, sitz) =>
            sicht.ausgestiegen.includes(sitz) ? null : (
              <div key={sitz} className="pk-balken-zeile">
                <span className="pk-balken-name">{namenFuer(sitze, sitz)}</span>
                <span className="pk-balken-spur">
                  <span className="pk-balken-fuellung" style={{ width: `${(zahl / meiste) * 100}%` }} />
                </span>
                <span className="pk-balken-zahl">{zahl}</span>
              </div>
            ),
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Buehne gross={<span className="pk-frage">{daten.text}</span>} />
      <Leute
        sicht={sicht}
        sitze={sitze}
        gewaehlt={daten.meineStimme}
        gesperrt={daten.meineStimme >= 0}
        beiWahl={(ziel) => sende({ art: 'stimme', ziel })}
      />
      {daten.meineStimme >= 0 ? <Wartet sicht={sicht} /> : null}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Bus fahren
 * ----------------------------------------------------------------------- */

const BUS_FRAGE = ['Rot oder Schwarz?', 'Höher oder tiefer?', 'Innen oder außen?'] as const;
const BUS_WAHL: readonly (readonly [string, string])[] = [
  ['Rot', 'Schwarz'],
  ['Höher', 'Tiefer'],
  ['Innen', 'Außen'],
];

function BusRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as BusSicht;
  const binDran = sicht.amZug === sicht.sitz;
  const auf = sicht.phase === 'ergebnis';
  const stufe = Math.min(2, Math.max(0, daten.stufe));

  return (
    <>
      <Buehne
        oben={auf ? 'Ausgefahren' : binDran ? 'Du fährst' : `${namenFuer(sitze, daten.amZug)} fährt`}
        gross={
          <div className="pk-kartenreihe">
            <Karte karte={daten.offen[0]} zu={daten.offen.length < 1} />
            <Karte karte={daten.offen[1]} zu={daten.offen.length < 2} />
            <Karte karte={daten.offen[2]} zu={daten.offen.length < 3} />
          </div>
        }
        unten={
          daten.letzter ? (
            <span data-gut={daten.letzter.richtig ? '' : undefined}>
              {namenFuer(sitze, daten.letzter.sitz)}:{' '}
              {BUS_WAHL[daten.letzter.stufe]?.[daten.letzter.wahl] ?? '?'} —{' '}
              {daten.letzter.richtig ? 'richtig' : `daneben, ein ${zaehlerWort(sicht.trinkmodus, 1)}`}
            </span>
          ) : (
            <span>Drei richtige Tipps, dann ist der Nächste dran.</span>
          )
        }
      />
      {binDran && !auf ? (
        <>
          <p className="pk-busfrage">{BUS_FRAGE[stufe]}</p>
          <Wahl>
            <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'tipp', wahl: 0 })}>
              {BUS_WAHL[stufe]?.[0]}
            </button>
            <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'tipp', wahl: 1 })}>
              {BUS_WAHL[stufe]?.[1]}
            </button>
          </Wahl>
        </>
      ) : null}
      <ul className="pk-liste">
        {daten.treffer.map((treffer, sitz) =>
          sicht.ausgestiegen.includes(sitz) || treffer < 0 ? null : (
            <li key={sitz} data-gut={treffer === 3 ? '' : undefined}>
              <span>{namenFuer(sitze, sitz)}</span>
              <span className="muted">{treffer} von 3</span>
            </li>
          ),
        )}
      </ul>
    </>
  );
}

/* --------------------------------------------------------------------------
 * Schaetzen
 * ----------------------------------------------------------------------- */

function SchaetzRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as SchaetzSicht;
  const auf = daten.antwort !== null;
  const [eingabe, setEingabe] = useState('');
  const abgegeben = daten.meine !== null;
  const wert = Number(eingabe.replace(',', '.'));
  const gueltig = eingabe.trim() !== '' && Number.isFinite(wert);

  if (auf) {
    const antwort = daten.antwort ?? 0;
    const reihen = (daten.schaetzung ?? [])
      .map((s, sitz) => ({ sitz, s }))
      .filter(({ sitz }) => !sicht.ausgestiegen.includes(sitz))
      .sort((x, y) => {
        const dx = x.s === null ? Infinity : Math.abs(x.s - antwort);
        const dy = y.s === null ? Infinity : Math.abs(y.s - antwort);
        return dx - dy;
      });
    return (
      <>
        <Buehne
          oben="Die Antwort"
          gross={
            <span className="pk-wort is-klein">
              {antwort.toLocaleString('de-DE')} {daten.einheit}
            </span>
          }
          unten={<span>{daten.frage}</span>}
          ton="gut"
        />
        <ul className="pk-liste">
          {reihen.map(({ sitz, s }, i) => (
            <li key={sitz} data-gut={i === 0 && s !== null ? '' : undefined}>
              <span>{namenFuer(sitze, sitz)}</span>
              <span className="muted">{s === null ? 'keine Schätzung' : `${s.toLocaleString('de-DE')} ${daten.einheit}`}</span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <Buehne gross={<span className="pk-frage">{daten.frage}</span>} unten={<span>Antwort in {daten.einheit}</span>} />
      {abgegeben ? (
        <>
          <p className="pk-busfrage">
            Deine Schätzung: {daten.meine?.toLocaleString('de-DE')} {daten.einheit}
          </p>
          <Wartet sicht={sicht} />
        </>
      ) : (
        <form
          className="pk-wahl"
          onSubmit={(e) => {
            e.preventDefault();
            if (gueltig) sende({ art: 'schaetzung', wert });
          }}
        >
          <input
            className="pk-zahl"
            type="text"
            inputMode="decimal"
            placeholder="Zahl"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            aria-label={`Schätzung in ${daten.einheit}`}
          />
          <button type="submit" className="pk-knopf is-haupt" disabled={!gueltig}>
            Tippen
          </button>
        </form>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Entweder – oder
 * ----------------------------------------------------------------------- */

function EntwederRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as EntwederSicht;
  const auf = daten.seite !== null;
  const zaehlA = (daten.seite ?? []).filter((s, i) => s === 0 && !sicht.ausgestiegen.includes(i)).length;
  const zaehlB = (daten.seite ?? []).filter((s, i) => s === 1 && !sicht.ausgestiegen.includes(i)).length;

  return (
    <>
      <Buehne
        gross={
          <span className="pk-frage">
            {daten.a} <span className="muted">oder</span> {daten.b}?
          </span>
        }
        unten={auf ? <span>{zaehlA === zaehlB ? 'Gleichstand — alle trinken.' : 'Die Minderheit trinkt.'}</span> : undefined}
      />
      <Wahl>
        <button
          type="button"
          className="pk-knopf is-gross"
          data-gewaehlt={daten.meine === 0 ? '' : undefined}
          data-richtig={auf && zaehlA > zaehlB ? '' : undefined}
          disabled={auf || daten.meine >= 0}
          onClick={() => sende({ art: 'seite', wahl: 0 })}
        >
          {daten.a}
          {auf ? <small className="pk-zaehler">{zaehlA}</small> : null}
        </button>
        <button
          type="button"
          className="pk-knopf is-gross"
          data-gewaehlt={daten.meine === 1 ? '' : undefined}
          data-richtig={auf && zaehlB > zaehlA ? '' : undefined}
          disabled={auf || daten.meine >= 0}
          onClick={() => sende({ art: 'seite', wahl: 1 })}
        >
          {daten.b}
          {auf ? <small className="pk-zaehler">{zaehlB}</small> : null}
        </button>
      </Wahl>
      {!auf && daten.meine >= 0 ? <Wartet sicht={sicht} /> : null}
      {auf ? (
        <ul className="pk-liste">
          {(daten.seite ?? []).map((s, sitz) =>
            sicht.ausgestiegen.includes(sitz) ? null : (
              <li key={sitz}>
                <span>{namenFuer(sitze, sitz)}</span>
                <span className="muted">{s === 0 ? daten.a : s === 1 ? daten.b : 'keine Wahl'}</span>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Wahrheit oder Pflicht
 * ----------------------------------------------------------------------- */

function WahrheitPflichtRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as WahrheitPflichtSicht;
  const binDran = sicht.amZug === sicht.sitz;
  const auf = sicht.phase === 'ergebnis';
  const wahl = daten.gewaehlt[daten.amZug] ?? -1;
  const text = daten.text[daten.amZug] ?? '';
  const wer = binDran ? 'Du bist dran' : `${namenFuer(sitze, daten.amZug)} ist dran`;

  return (
    <>
      {wahl < 0 ? (
        <Buehne
          oben={auf ? 'Vorbei' : wer}
          gross={<span className="pk-wort is-klein">{auf ? 'Alle durch' : 'Wahrheit oder Pflicht?'}</span>}
          ton={binDran && !auf ? 'geheim' : undefined}
        />
      ) : (
        <Buehne
          oben={`${wer} · ${wahl === 1 ? 'Pflicht' : 'Wahrheit'}`}
          gross={<span className="pk-frage">{text}</span>}
          unten={binDran ? <span>Mach es vor der Runde. Dann ehrlich tippen.</span> : <span>Zuschauen — und dann entscheiden, ob das zählt.</span>}
          ton={binDran ? 'geheim' : undefined}
        />
      )}
      {binDran && !auf ? (
        wahl < 0 ? (
          <Wahl>
            <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'wahl', pflicht: false })}>
              Wahrheit
            </button>
            <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'wahl', pflicht: true })}>
              Pflicht
            </button>
          </Wahl>
        ) : (
          <Wahl>
            <button type="button" className="pk-knopf is-gut" onClick={() => sende({ art: 'erledigt', ja: true })}>
              Gemacht
            </button>
            <button type="button" className="pk-knopf is-weg" onClick={() => sende({ art: 'erledigt', ja: false })}>
              Gekniffen
            </button>
          </Wahl>
        )
      ) : null}
      <ul className="pk-liste">
        {daten.erfolg.map((e, sitz) =>
          sicht.ausgestiegen.includes(sitz) || e < 0 ? null : (
            <li key={sitz} data-gut={e === 1 ? '' : undefined}>
              <span>
                {namenFuer(sitze, sitz)} <span className="muted">· {daten.gewaehlt[sitz] === 1 ? 'Pflicht' : 'Wahrheit'}</span>
              </span>
              <span className="muted">{e === 1 ? 'gemacht' : 'gekniffen'}</span>
            </li>
          ),
        )}
      </ul>
    </>
  );
}

/* --------------------------------------------------------------------------
 * Die Weiche
 * ----------------------------------------------------------------------- */

export function Runde(props: RundenProps): React.JSX.Element {
  switch (props.sicht.daten.art) {
    case 'imposter':
      return <ImposterRunde {...props} />;
    case 'quiz':
      return <QuizRunde {...props} />;
    case 'werbinich':
      return <WerBinIchRunde {...props} />;
    case 'niemals':
      return <NiemalsRunde {...props} />;
    case 'wereher':
      return <WerEherRunde {...props} />;
    case 'busfahrer':
      return <BusRunde {...props} />;
    case 'schaetzen':
      return <SchaetzRunde {...props} />;
    case 'entweder':
      return <EntwederRunde {...props} />;
    case 'wahrheitpflicht':
      return <WahrheitPflichtRunde {...props} />;
  }
}
