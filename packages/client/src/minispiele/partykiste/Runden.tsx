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

import type { SeatInfo } from '../../protocol';
import {
  FARBZEICHEN,
  istRoteKarte,
  rangName,
  type BusSicht,
  type ImposterSicht,
  type NiemalsSicht,
  type PartyAktion,
  type PartyKarte,
  type PartykisteSicht,
  type QuizSicht,
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
function Wartet({ sicht }: { sicht: PartykisteSicht }): React.JSX.Element {
  const offen = sicht.sitze - sicht.ausgestiegen.length - sicht.gehandelt.length;
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

  if (sicht.phase === 'sehen') {
    const gesehen = sicht.gehandelt.includes(sicht.sitz);
    return (
      <>
        <Buehne
          oben="Dein Wort — zeig es niemandem"
          gross={<span className="pk-wort">{daten.meinWort ?? '—'}</span>}
          ton="geheim"
        />
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
          oben="Dein Wort"
          gross={<span className="pk-wort is-klein">{daten.meinWort ?? '—'}</span>}
          unten={<span>Reihum ein Satz dazu. Dann: Wer passt nicht?</span>}
        />
        <Leute
          sicht={sicht}
          sitze={sitze}
          gewaehlt={-1}
          gesperrt={abgestimmt}
          beiWahl={(ziel) => sende({ art: 'stimme', ziel })}
        />
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
              {daten.letzter.richtig ? 'richtig' : 'daneben, ein Schluck'}
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
  }
}
