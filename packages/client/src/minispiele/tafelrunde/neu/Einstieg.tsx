/**
 * Der Einstieg von TafelrundeNeu: Titel, Schnellsuche, Tisch erstellen oder
 * beitreten, gegen Bots, Regeln — und die beiden Formulare dahinter.
 *
 * Nur das Aussehen. Zustaende und Aufrufe kommen fertig aus `useLobby`; was
 * ein Knopf tut, steht dort.
 */

import { useState } from 'react';

import type { TableRow, TischVorschau } from '../../../api';
import { titelBild } from '../../../figuren3d/grafik-neu';
import type { BotLevel } from '../../../protocol';
import { rollenName, tz } from '../text';
import { Figur } from './grafik';
import stil from './neu.module.css';
import { Regelblatt, type Regelwissen } from './Regelblatt';
import { Schauplatzgrund } from './Feld';
import { Abschnitt, Seite, Wahl } from './Seite';

/**
 * Wer im Ersatz des Titelbilds steht — fuenf Figuren, je eine Rolle.
 *
 * Eine BILDAUSWAHL und keine Regel: Die Kennung waehlt das neue Figurenblatt
 * (grafik-neu.ts), die Rolle nur den Rueckfall auf das alte Rollenblatt,
 * solange es das neue nicht gibt. Steht hier eine falsche Rolle, sieht man
 * im Rueckfall eine andere Figur — am Spiel aendert sich nichts.
 */
const TITELFIGUREN = [
  { id: 'dorfwache', rolle: 'wache' },
  { id: 'bogenmeisterin', rolle: 'schuetze' },
  { id: 'drachenkind', rolle: 'magier' },
  { id: 'schattenklinge', rolle: 'meuchler' },
  { id: 'lichtwahrerin', rolle: 'beistand' },
] as const;

/**
 * Das Titelbild — oder sein Ersatz: fuenf eigene Figuren als Gruppe auf
 * gruenem Grund. Der Ersatz ist aus den eigenen Figuren gebaut, wie es der
 * Umsetzungsplan auch fuer das gemalte Titelbild vorsieht; er sieht also nach
 * dem Spiel aus und nicht nach einem fehlenden Bild.
 */
export function Titel(): React.JSX.Element {
  const pfad = titelBild();
  const [kaputt, setKaputt] = useState(false);
  if (pfad && !kaputt) {
    return (
      <div className={stil.titelGrund}>
        <img src={pfad} alt="" onError={() => setKaputt(true)} />
      </div>
    );
  }
  return (
    <div className={stil.titelGrund} data-ersatz="" aria-hidden="true">
      <Schauplatzgrund schauplatz="dorfplatz" />
      <div className={stil.titelReihe}>
        {TITELFIGUREN.map(({ id, rolle }, i) => (
          <span key={id} className={stil.titelPlatz} style={{ '--i': i } as React.CSSProperties}>
            <Figur einheit={{ id, name: rollenName(rolle), rolle, kosten: 1 }} klasse={stil.titelFigur} spiegeln={i > 2} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function EinstiegSeite({
  aktiv,
  startet,
  fehler,
  regelwissen,
  onBack,
  onSuche,
  onErstellen,
  onBeitreten,
  onBots,
}: {
  aktiv: number | null;
  startet: boolean;
  fehler: string | null;
  /** Faehigkeiten und Marken — erst am Tisch bekannt, vorher leer. */
  regelwissen: Regelwissen;
  onBack: () => void;
  onSuche: () => void;
  onErstellen: () => void;
  onBeitreten: () => void;
  onBots: () => void;
}): React.JSX.Element {
  const [regelnOffen, setRegelnOffen] = useState(false);
  return (
    <Seite
      titel="Tafelrunde"
      unter={tz('einstieg.unter')}
      zurueckText={tz('zurueck')}
      onZurueck={onBack}
      grund={<Titel />}
      /* Die Luecke ueber dem Titel, in der die Figuren des Grundes stehen. */
      kopfbild={<div className={stil.titelLuecke} />}
      fuss={
        <>
          <button type="button" className={stil.hauptknopf} onClick={onSuche} disabled={startet}>
            {tz('neu.schnellsuche')}
          </button>
          <p className={stil.klein}>{tz('einstieg.mitspielerzahl', { n: aktiv ?? '…' })}</p>
        </>
      }
    >
      {fehler && (
        <p className={stil.fehler} role="alert">
          {fehler}
        </p>
      )}
      <p className={stil.text}>{tz('einstieg.text')}</p>
      <div className={stil.knopfgitter}>
        <button type="button" className={stil.kachel} onClick={onErstellen} disabled={startet}>
          <strong>{tz('einstieg.erstellen')}</strong>
          <span>{tz('neu.erstellenUnter')}</span>
        </button>
        <button type="button" className={stil.kachel} onClick={onBeitreten} disabled={startet}>
          <strong>{tz('einstieg.beitreten')}</strong>
          <span>{tz('neu.beitretenUnter')}</span>
        </button>
        <button type="button" className={stil.kachel} onClick={onBots} disabled={startet}>
          <strong>{tz('einstieg.gegenBots')}</strong>
          <span>{tz('neu.botsUnter')}</span>
        </button>
        <button type="button" className={stil.kachel} onClick={() => setRegelnOffen(true)}>
          <strong>{tz('einstieg.anleitung')}</strong>
          <span>{tz('neu.regelnUnter')}</span>
        </button>
      </div>
      {regelnOffen && <Regelblatt wissen={regelwissen} onSchliessen={() => setRegelnOffen(false)} />}
    </Seite>
  );
}

export function ErstellenSeite({
  sitzWahl,
  sitze,
  oeffentlich,
  botsFuellen,
  botStufe,
  botStufen,
  startet,
  fehler,
  onSitze,
  onOeffentlich,
  onBotsFuellen,
  onBotStufe,
  onErstellen,
  onZurueck,
}: {
  sitzWahl: readonly number[];
  sitze: number;
  oeffentlich: boolean;
  botsFuellen: boolean;
  botStufe: BotLevel;
  botStufen: readonly { id: BotLevel; name: string }[];
  startet: boolean;
  fehler: string | null;
  onSitze: (n: number) => void;
  onOeffentlich: (an: boolean) => void;
  onBotsFuellen: (an: boolean) => void;
  onBotStufe: (stufe: BotLevel) => void;
  onErstellen: () => void;
  onZurueck: () => void;
}): React.JSX.Element {
  return (
    <Seite
      titel={tz('einstieg.erstellen')}
      unter={tz('erstellen.unter')}
      zurueckText={tz('zurueckZumMenue')}
      onZurueck={onZurueck}
      fuss={
        <>
          <button type="button" className={stil.hauptknopf} onClick={onErstellen} disabled={startet}>
            {tz('erstellen.aufmachen')}
          </button>
          <p className={stil.klein}>{tz(oeffentlich ? 'erstellen.hinweisOffen' : 'erstellen.hinweisCode')}</p>
        </>
      }
    >
      {fehler && (
        <p className={stil.fehler} role="alert">
          {fehler}
        </p>
      )}
      <Abschnitt titel={tz('erstellen.plaetze')}>
        <Wahl
          name={tz('erstellen.plaetze')}
          werte={sitzWahl.map((n) => ({ wert: n, text: String(n) }))}
          wert={sitze}
          onWahl={onSitze}
        />
      </Abschnitt>
      <Abschnitt titel={tz('erstellen.fuerWen')}>
        <Wahl
          name={tz('erstellen.fuerWen')}
          werte={[
            { wert: 'code' as const, text: tz('erstellen.nurMitCode') },
            { wert: 'offen' as const, text: tz('erstellen.offenFuerAlle') },
          ]}
          wert={oeffentlich ? 'offen' : 'code'}
          onWahl={(w) => onOeffentlich(w === 'offen')}
        />
      </Abschnitt>
      <Abschnitt titel={tz('erstellen.freiePlaetze')}>
        <Wahl
          name={tz('erstellen.freiePlaetze')}
          werte={[
            { wert: 'bots' as const, text: tz('erstellen.mitBotsFuellen') },
            { wert: 'frei' as const, text: tz('erstellen.freiLassen') },
          ]}
          wert={botsFuellen ? 'bots' : 'frei'}
          onWahl={(w) => onBotsFuellen(w === 'bots')}
        />
      </Abschnitt>
      {/* Die Stufe nur fuer den, der Bots will — sonst stellt man etwas ein,
          das an diesem Tisch nie zum Zug kommt. */}
      {botsFuellen && (
        <Abschnitt titel={tz('erstellen.botStaerke')}>
          <Wahl
            name={tz('erstellen.botStaerke')}
            werte={botStufen.map((s) => ({ wert: s.id, text: s.name }))}
            wert={botStufe}
            onWahl={onBotStufe}
          />
        </Abschnitt>
      )}
    </Seite>
  );
}

export function BeitretenSeite({
  code,
  codeFertig,
  vorschau,
  offeneTische,
  startet,
  fehler,
  onCode,
  onPerCode,
  onTisch,
  onZurueck,
}: {
  code: string;
  codeFertig: boolean;
  vorschau: TischVorschau | null;
  offeneTische: TableRow[];
  startet: boolean;
  fehler: string | null;
  onCode: (code: string) => void;
  onPerCode: () => void;
  onTisch: (id: string) => void;
  onZurueck: () => void;
}): React.JSX.Element {
  return (
    <Seite
      titel={tz('einstieg.beitreten')}
      unter={tz('beitreten.unter')}
      zurueckText={tz('zurueckZumMenue')}
      onZurueck={onZurueck}
      fuss={
        <button type="button" className={stil.hauptknopf} onClick={onPerCode} disabled={startet || !codeFertig}>
          {tz('beitreten.knopf')}
        </button>
      }
    >
      <p className={stil.text}>{tz('beitreten.text')}</p>
      <Abschnitt titel={tz('code')}>
        <input
          className={stil.codefeld}
          value={code}
          onChange={(e) => onCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          aria-label={tz('beitreten.code')}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
        />
        {vorschau && (
          <p className={stil.klein}>
            {tz('beitreten.vorschau', {
              tisch: vorschau.host ? tz('tischVon', { name: vorschau.host }) : tz('offenerTisch'),
              belegt: vorschau.occupied,
              plaetze: vorschau.seats,
            })}
          </p>
        )}
      </Abschnitt>
      {fehler && (
        <p className={stil.fehler} role="alert">
          {fehler}
        </p>
      )}
      <Abschnitt titel={tz('beitreten.offeneTische')} zusatz={offeneTische.length > 0 ? offeneTische.length : undefined}>
        {offeneTische.length === 0 ? (
          <p className={stil.leer}>{tz('beitreten.keinTisch')}</p>
        ) : (
          <div className={stil.liste}>
            {offeneTische.map((zeile) => (
              <button
                key={zeile.id}
                type="button"
                className={stil.zeile}
                onClick={() => onTisch(zeile.id)}
                disabled={startet}
              >
                <strong>{zeile.host ? tz('tischVon', { name: zeile.host }) : tz('offenerTisch')}</strong>
                <span aria-label={tz('plaetzeBesetzt', { belegt: zeile.occupied, plaetze: zeile.seats })}>
                  {zeile.occupied}/{zeile.seats}
                </span>
              </button>
            ))}
          </div>
        )}
      </Abschnitt>
    </Seite>
  );
}
