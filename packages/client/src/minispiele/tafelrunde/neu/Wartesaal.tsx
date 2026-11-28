/**
 * Der Wartesaal des verabredeten Tisches: Plaetze, Code, Einladen, Link
 * teilen, Bot-Stufe, Start.
 *
 * EINLADEN ist das Blatt der Tischschicht (tisch/EinladenBlatt.tsx, #419) —
 * eingebunden, nicht nachgebaut. Es schickt eine Mitteilung an einen Freund;
 * der Knopf steht nur, solange ein Platz frei ist (wie im Doppelkopf-Saal).
 *
 * LINK TEILEN geht ueber das Teilen-Blatt des Geraets (`navigator.share`), am
 * Handy der natuerliche Weg in den Gruppenchat. Wo es das nicht gibt (die
 * meisten Desktop-Browser) oder der Nutzer es abbricht, wird der Link
 * kopiert, und der Knopf sagt es. Ein Abbruch des Teilen-Blatts ist kein
 * Fehler und bekommt deshalb auch keine Meldung.
 *
 * Wann gestartet werden darf, entscheidet der Server (`isReadyToStart`); hier
 * steht nur, wann der Knopf grau ist — dieselbe Zahl, die daneben steht.
 */

import { useState } from 'react';

import type { BotLevel } from '../../../protocol';
import { EinladenBlatt } from '../../../tisch/EinladenBlatt';
import { GastHinweis } from '../../../tisch/GastHinweis';
import { tz, tzAnzahl } from '../text';
import { beitrittsLink } from '../tischlink';
import stil from './neu.module.css';
import { Abschnitt, Seite, Wahl } from './Seite';
import { Gesicht } from './Suche';

export interface Saalplatz {
  seat: number;
  displayName: string | null;
  accountId: string | null;
  avatarUrl: string | null;
  isBot: boolean;
  gast?: boolean;
}

/**
 * Den Link teilen — Teilen-Blatt, sonst Zwischenablage. Gibt zurueck, was
 * passiert ist, damit der Knopf es sagen kann.
 *
 * Exportiert fuer den Test: Beide Wege haengen an Schnittstellen des
 * Browsers, die es nicht ueberall gibt.
 */
export async function teileLink(url: string, titel: string): Promise<'geteilt' | 'kopiert' | 'nichts'> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: titel, url });
      return 'geteilt';
    } catch (err) {
      // Abgebrochen heisst: Der Nutzer wollte nicht. Dann auch nicht kopieren.
      if (err instanceof DOMException && err.name === 'AbortError') return 'nichts';
    }
  }
  try {
    await navigator.clipboard?.writeText(url);
    return navigator.clipboard ? 'kopiert' : 'nichts';
  } catch {
    return 'nichts';
  }
}

export function WartesaalSeite({
  tischId,
  wartesaal,
  sitze,
  botStufe,
  botStufen,
  onBotStufe,
  onBotsFuellen,
  onStart,
  onAbbrechen,
}: {
  tischId: string;
  wartesaal: { code: string | null; gastgeber: boolean; botsFuellen: boolean };
  sitze: readonly Saalplatz[];
  botStufe: BotLevel;
  botStufen: readonly { id: BotLevel; name: string }[];
  onBotStufe: (stufe: BotLevel) => void;
  onBotsFuellen: (an: boolean) => void;
  onStart: () => void;
  onAbbrechen: () => void;
}): React.JSX.Element {
  const [einladenOffen, setEinladenOffen] = useState(false);
  const [geteilt, setGeteilt] = useState<'geteilt' | 'kopiert' | 'nichts' | null>(null);
  const [codeKopiert, setCodeKopiert] = useState(false);
  const menschen = sitze.filter((p) => p.accountId).length;
  const freierPlatz = sitze.some((p) => !p.accountId && !p.isBot);

  return (
    <Seite
      titel={tz('wartesaal.titel')}
      unter={tz('wartesaal.unter')}
      zurueckText={tz('wartesaal.verlassen')}
      onZurueck={onAbbrechen}
      fuss={
        wartesaal.gastgeber ? (
          <>
            <button
              type="button"
              className={stil.hauptknopf}
              onClick={onStart}
              disabled={!wartesaal.botsFuellen && menschen < 2}
            >
              {tz('wartesaal.starten')}
            </button>
            <p className={stil.klein}>
              {wartesaal.botsFuellen
                ? tz('wartesaal.hinweisBots')
                : menschen < 2
                  ? tz('wartesaal.hinweisZuWenige')
                  : tz('wartesaal.hinweisMenschen', { n: menschen })}
            </p>
          </>
        ) : (
          <p className={stil.klein}>{tzAnzahl('wartesaal.da', menschen)}</p>
        )
      }
    >
      {wartesaal.code && (
        <div className={stil.codekarte}>
          <button
            type="button"
            className={stil.code}
            aria-label={tz('wartesaal.codeLabel', { code: wartesaal.code })}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(wartesaal.code!)
                .then(() => setCodeKopiert(true))
                .catch(() => {});
            }}
          >
            {wartesaal.code}
          </button>
          <p className={stil.klein}>{tz(codeKopiert ? 'wartesaal.codeKopiert' : 'neu.wartesaal.codeAntippen')}</p>
          <div className={stil.knopfreihe}>
            <button
              type="button"
              className={stil.zweitknopf}
              onClick={() => {
                void teileLink(beitrittsLink(wartesaal.code!), 'Tafelrunde').then(setGeteilt);
              }}
            >
              {tz(geteilt === 'kopiert' ? 'wartesaal.linkKopiert' : 'neu.wartesaal.teilen')}
            </button>
            {freierPlatz && (
              <button type="button" className={stil.zweitknopf} onClick={() => setEinladenOffen(true)}>
                {tz('neu.wartesaal.einladen')}
              </button>
            )}
          </div>
        </div>
      )}
      {/* Ohne Code (Tisch aus der offenen Liste) bleibt das Einladen trotzdem:
          Es braucht nur den Tisch, keinen Code. */}
      {!wartesaal.code && freierPlatz && (
        <button type="button" className={stil.zweitknopf} onClick={() => setEinladenOffen(true)}>
          {tz('neu.wartesaal.einladen')}
        </button>
      )}

      <Abschnitt titel={tz('wartesaal.amTisch')} zusatz={sitze.length > 0 ? `${menschen}/${sitze.length}` : undefined}>
        {sitze.length === 0 ? (
          <p className={stil.leer}>{tz('verbindung')}</p>
        ) : (
          <ul className={stil.plaetze}>
            {sitze.map((p) => {
              const name = p.displayName ?? (p.isBot ? tz('wartesaal.bot') : tz('wartesaal.freierPlatz'));
              return (
                <li key={p.seat} className={stil.platz} data-frei={!p.accountId && !p.isBot ? '' : undefined}>
                  <Gesicht name={name} bildUrl={p.avatarUrl} />
                  <span className={stil.platzName}>{name}</span>
                  {p.seat === 0 && <em>{tz('wartesaal.gastgeber')}</em>}
                </li>
              );
            })}
          </ul>
        )}
      </Abschnitt>
      <GastHinweis sitze={sitze} className={stil.klein} />

      {wartesaal.gastgeber && (
        <>
          <Abschnitt titel={tz('wartesaal.freiePlaetze')}>
            <Wahl
              name={tz('wartesaal.freiePlaetze')}
              werte={[
                { wert: 'bots' as const, text: tz('erstellen.mitBotsFuellen') },
                { wert: 'weg' as const, text: tz('wartesaal.weglassen') },
              ]}
              wert={wartesaal.botsFuellen ? 'bots' : 'weg'}
              onWahl={(w) => onBotsFuellen(w === 'bots')}
            />
          </Abschnitt>
          {wartesaal.botsFuellen && (
            <Abschnitt titel={tz('erstellen.botStaerke')}>
              <Wahl
                name={tz('erstellen.botStaerke')}
                werte={botStufen.map((s) => ({ wert: s.id, text: s.name }))}
                wert={botStufe}
                onWahl={onBotStufe}
              />
            </Abschnitt>
          )}
        </>
      )}

      {einladenOffen && (
        <EinladenBlatt
          tableId={tischId}
          sitzende={sitze.map((p) => p.accountId).filter((id): id is string => !!id)}
          onClose={() => setEinladenOffen(false)}
        />
      )}
    </Seite>
  );
}
