import { useState } from 'react';

import type { TableRow, TischVorschau } from '../../api';
import type { BotLevel } from '../../protocol';
import { HbBlatt } from '../../screens/HbBlatt';
import { GastHinweis } from '../../tisch/GastHinweis';
import { SpielAbschnitt, SpielRahmen, SpielWahl } from '../../screens/SpielEinstieg';
import { beitrittsLink } from './tischlink';
import { tz, tzAnzahl } from './text';
import { KOSTEN_FARBE, RollenZeichen } from './Zeichen';

/**
 * Der Einstieg von Tafelrunde im neuen Hub („Nachtblau & Gold", 26.09.2026).
 *
 * Nur das Aussehen: Zustände, Aufrufe und Regeln bleiben in
 * `screens/Tafelrunde.tsx`, und jede Ansicht hier bekommt sie fertig herein.
 *
 * Grün ist die Farbe des Spiels (die Rollenzeichen im Laden); der Hauptknopf
 * bleibt gold, wie überall im neuen Hub.
 */
export const TAFELRUNDE_AKZENT = '#5aa86a';

const ROLLEN = ['wache', 'schuetze', 'magier', 'meuchler', 'beistand'] as const;

function mitspielerzahl(aktiv: number | null): string {
  return tz('einstieg.mitspielerzahl', { n: aktiv ?? '…' });
}

/** Drei hüpfende Punkte: Es wird gewartet, aber es tut sich etwas. */
function Lauf(): React.JSX.Element {
  return (
    <div className="spe-lauf" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menü
// ---------------------------------------------------------------------------

export function MenueNeu({
  aktiv,
  startet,
  fehler,
  regeln,
  onBack,
  onSuche,
  onErstellen,
  onBeitreten,
  onBots,
}: {
  aktiv: number | null;
  startet: boolean;
  fehler: string | null;
  /** Der Regeltext, derselbe wie im Regelblatt der Rüstkammer. */
  regeln: React.ReactNode;
  onBack: () => void;
  onSuche: () => void;
  onErstellen: () => void;
  onBeitreten: () => void;
  onBots: () => void;
}): React.JSX.Element {
  const [regelnOffen, setRegelnOffen] = useState(false);
  return (
    <SpielRahmen
      gameId="tafelrunde"
      titel="Tafelrunde"
      unter={tz('einstieg.unter')}
      akzent={TAFELRUNDE_AKZENT}
      onBack={onBack}
      zurueckText={tz('zurueck')}
      fuss={
        <>
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onSuche} disabled={startet}>
            {tz('einstieg.suchen')}
          </button>
          <p className="hb-klein">{mitspielerzahl(aktiv)}</p>
        </>
      }
    >
      <div className="spe-karte">
        <p className="spe-text">
          {tz('einstieg.text')}
        </p>
        <div className="spe-zeichen" aria-hidden="true">
          {ROLLEN.map((r) => (
            <span key={r} style={{ color: KOSTEN_FARBE[2] }}>
              <RollenZeichen rolle={r} />
            </span>
          ))}
        </div>
      </div>
      {fehler && <p className="hb-fehler">{fehler}</p>}
      {/* Aufmachen und Beitreten sind zwei Rollen: Wer den Code bekommen hat,
          sucht keinen Erstellen-Knopf. Deshalb zwei gleich große Knöpfe. */}
      <SpielAbschnitt titel={tz('einstieg.mitFreunden')}>
        <div className="hb-knopfreihe">
          <button type="button" className="hb-kn is-blau" onClick={onErstellen} disabled={startet}>
            {tz('einstieg.erstellen')}
          </button>
          <button type="button" className="hb-kn is-blau" onClick={onBeitreten} disabled={startet}>
            {tz('einstieg.beitreten')}
          </button>
        </div>
      </SpielAbschnitt>
      <SpielAbschnitt titel={tz('einstieg.allein')}>
        <button type="button" className="hb-kn is-blau is-breit" onClick={onBots} disabled={startet}>
          {tz('einstieg.gegenBots')}
        </button>
      </SpielAbschnitt>
      <SpielAbschnitt titel={tz('einstieg.anleitung')}>
        <div className="hb-liste">
          <button type="button" className="spe-zeile" onClick={() => setRegelnOffen(true)}>
            <span>
              <strong>{tz('regeln.titel')}</strong>
              <small>{tz('einstieg.anleitungUnter')}</small>
            </span>
            <span className="hb-pf" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </SpielAbschnitt>
      {regelnOffen && (
        <HbBlatt titel={tz('regeln.titel')} onClose={() => setRegelnOffen(false)}>
          <div className="spe-regeltext">{regeln}</div>
        </HbBlatt>
      )}
    </SpielRahmen>
  );
}

// ---------------------------------------------------------------------------
// Mitspieler suchen
// ---------------------------------------------------------------------------

export function SucheNeu({
  sekunden,
  gefunden,
  aktiv,
  onAbbrechen,
}: {
  sekunden: number;
  gefunden: number;
  aktiv: number | null;
  onAbbrechen: () => void;
}): React.JSX.Element {
  return (
    <SpielRahmen
      gameId="tafelrunde"
      titel={tz('einstieg.suchen')}
      unter={mitspielerzahl(aktiv)}
      akzent={TAFELRUNDE_AKZENT}
      onBack={onAbbrechen}
      zurueckText={tz('suche.abbrechen')}
      fuss={
        <button type="button" className="hb-kn is-blau is-breit" onClick={onAbbrechen}>
          {tz('abbrechen')}
        </button>
      }
    >
      <div className="spe-warten">
        {/* Die Zahl groß und ohne Einheit: Sie zählt sichtbar herunter und
            beantwortet damit die einzige Frage, die man hier hat. */}
        <p className="spe-countdown" aria-live="polite">
          {sekunden}
        </p>
        <p className="spe-text">
          {gefunden === 1
            ? tz('suche.niemand')
            : tz('suche.gefunden', { n: gefunden })}
        </p>
        <Lauf />
      </div>
    </SpielRahmen>
  );
}

// ---------------------------------------------------------------------------
// Tisch erstellen
// ---------------------------------------------------------------------------

export function ErstellenNeu({
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
    <SpielRahmen
      gameId="tafelrunde"
      titel={tz('einstieg.erstellen')}
      unter={tz('erstellen.unter')}
      akzent={TAFELRUNDE_AKZENT}
      onBack={onZurueck}
      zurueckText={tz('zurueckZumMenue')}
      fuss={
        <>
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onErstellen} disabled={startet}>
            {tz('erstellen.aufmachen')}
          </button>
          <p className="hb-klein">
            {oeffentlich
              ? tz('erstellen.hinweisOffen')
              : tz('erstellen.hinweisCode')}
          </p>
        </>
      }
    >
      {fehler && <p className="hb-fehler">{fehler}</p>}
      <SpielAbschnitt titel={tz('erstellen.plaetze')}>
        <SpielWahl name={tz('erstellen.plaetze')} werte={sitzWahl.map((n) => ({ wert: n, text: String(n) }))} wert={sitze} onWahl={onSitze} />
      </SpielAbschnitt>
      <SpielAbschnitt titel={tz('erstellen.fuerWen')}>
        <SpielWahl
          name={tz('erstellen.fuerWen')}
          werte={[
            { wert: 'code' as const, text: tz('erstellen.nurMitCode') },
            { wert: 'offen' as const, text: tz('erstellen.offenFuerAlle') },
          ]}
          wert={oeffentlich ? 'offen' : 'code'}
          onWahl={(w) => onOeffentlich(w === 'offen')}
        />
      </SpielAbschnitt>
      <SpielAbschnitt titel={tz('erstellen.freiePlaetze')}>
        <SpielWahl
          name={tz('erstellen.freiePlaetze')}
          werte={[
            { wert: 'bots' as const, text: tz('erstellen.mitBotsFuellen') },
            { wert: 'frei' as const, text: tz('erstellen.freiLassen') },
          ]}
          wert={botsFuellen ? 'bots' : 'frei'}
          onWahl={(w) => onBotsFuellen(w === 'bots')}
        />
      </SpielAbschnitt>
      {/* Die Stufe zeigt nur, wer Bots will — sonst stellt man etwas ein,
          das an diesem Tisch nie zum Zug kommt. */}
      {botsFuellen && (
        <SpielAbschnitt titel={tz('erstellen.botStaerke')}>
          <SpielWahl
            name={tz('erstellen.botStaerke')}
            werte={botStufen.map((s) => ({ wert: s.id, text: s.name }))}
            wert={botStufe}
            onWahl={onBotStufe}
          />
        </SpielAbschnitt>
      )}
    </SpielRahmen>
  );
}

// ---------------------------------------------------------------------------
// Tisch beitreten
// ---------------------------------------------------------------------------

export function BeitretenNeu({
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
    <SpielRahmen
      gameId="tafelrunde"
      titel={tz('einstieg.beitreten')}
      unter={tz('beitreten.unter')}
      akzent={TAFELRUNDE_AKZENT}
      onBack={onZurueck}
      zurueckText={tz('zurueckZumMenue')}
      fuss={
        <button
          type="button"
          className="hb-kn is-gold is-haupt is-breit"
          onClick={onPerCode}
          disabled={startet || !codeFertig}
        >
          {tz('beitreten.knopf')}
        </button>
      }
    >
      <p className="spe-text">{tz('beitreten.text')}</p>
      <SpielAbschnitt titel={tz('code')}>
        <input
          className="spe-feld spe-codefeld"
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
          <p className="hb-klein">
            {tz('beitreten.vorschau', {
              tisch: vorschau.host ? tz('tischVon', { name: vorschau.host }) : tz('offenerTisch'),
              belegt: vorschau.occupied,
              plaetze: vorschau.seats,
            })}
          </p>
        )}
      </SpielAbschnitt>
      {fehler && <p className="hb-fehler">{fehler}</p>}
      <SpielAbschnitt titel={tz('beitreten.offeneTische')} zusatz={offeneTische.length > 0 ? offeneTische.length : undefined}>
        <div className="hb-liste">
          {offeneTische.length === 0 ? (
            <p className="spe-leer">{tz('beitreten.keinTisch')}</p>
          ) : (
            offeneTische.map((zeile) => (
              <button
                key={zeile.id}
                type="button"
                className="spe-zeile spe-tisch"
                onClick={() => onTisch(zeile.id)}
                disabled={startet}
              >
                <span>
                  <strong>{zeile.host ? tz('tischVon', { name: zeile.host }) : tz('offenerTisch')}</strong>
                </span>
                <span className="spe-punkte" aria-hidden="true">
                  {Array.from({ length: zeile.seats }, (_, i) => (
                    <i key={i} className={i < zeile.occupied ? '' : 'is-frei'} />
                  ))}
                </span>
                <span className="spe-zahl" aria-label={tz('plaetzeBesetzt', { belegt: zeile.occupied, plaetze: zeile.seats })}>
                  {zeile.occupied}/{zeile.seats}
                </span>
              </button>
            ))
          )}
        </div>
      </SpielAbschnitt>
    </SpielRahmen>
  );
}

// ---------------------------------------------------------------------------
// Der Wartesaal des verabredeten Tisches
// ---------------------------------------------------------------------------

interface Platz {
  seat: number;
  displayName: string | null;
  accountId: string | null;
  isBot: boolean;
  gast?: boolean;
}

/**
 * Was zwischen „Tisch aufgemacht" und „Partie läuft" auf dem Schirm steht.
 *
 * Der Gastgeber sieht seinen Code, die Beigetretenen und den Startknopf; die
 * Gäste sehen dasselbe ohne Knöpfe. Die Sitzliste kommt aus dem Rundruf des
 * Tisches und nicht aus einer eigenen Abfrage, deshalb füllt sie sich ohne
 * Zutun, sobald jemand beitritt.
 *
 * Der Wartesaal bildet keine Regel nach: WANN gestartet werden darf,
 * entscheidet der Server (`isReadyToStart`, `schrumpfeAufBesetzte`). Hier
 * steht nur, wann der Knopf grau ist — und das ist dieselbe Zahl, die
 * daneben steht.
 */
export function WartesaalNeu({
  wartesaal,
  sitze,
  botStufe,
  botStufen,
  onBotStufe,
  onBotsFuellen,
  onStart,
  onAbbrechen,
}: {
  wartesaal: { code: string | null; gastgeber: boolean; botsFuellen: boolean };
  sitze: Platz[];
  botStufe: BotLevel;
  botStufen: readonly { id: BotLevel; name: string }[];
  onBotStufe: (stufe: BotLevel) => void;
  onBotsFuellen: (an: boolean) => void;
  onStart: () => void;
  onAbbrechen: () => void;
}): React.JSX.Element {
  const [kopiert, setKopiert] = useState<'code' | 'link' | null>(null);
  const menschen = sitze.filter((platz) => platz.accountId).length;

  const kopiere = (was: 'code' | 'link', text: string): void => {
    // Ohne Zwischenablage passiert nichts Schlimmes: Der Code steht groß da.
    void navigator.clipboard
      ?.writeText(text)
      .then(() => setKopiert(was))
      .catch(() => {});
  };

  return (
    <SpielRahmen
      gameId="tafelrunde"
      titel={tz('wartesaal.titel')}
      unter={tz('wartesaal.unter')}
      akzent={TAFELRUNDE_AKZENT}
      onBack={onAbbrechen}
      zurueckText={tz('wartesaal.verlassen')}
      fuss={
        wartesaal.gastgeber ? (
          <>
            <button
              type="button"
              className="hb-kn is-gold is-haupt is-breit"
              onClick={onStart}
              disabled={!wartesaal.botsFuellen && menschen < 2}
            >
              {tz('wartesaal.starten')}
            </button>
            <p className="hb-klein">
              {wartesaal.botsFuellen
                ? tz('wartesaal.hinweisBots')
                : menschen < 2
                  ? tz('wartesaal.hinweisZuWenige')
                  : tz('wartesaal.hinweisMenschen', { n: menschen })}
            </p>
          </>
        ) : undefined
      }
    >
      {wartesaal.code && (
        <SpielAbschnitt titel={tz('code')}>
          <div className="spe-karte">
            <p className="spe-code" aria-label={tz('wartesaal.codeLabel', { code: wartesaal.code })}>
              {wartesaal.code}
            </p>
            <div className="hb-knopfreihe">
              <button type="button" className="hb-kn is-blau" onClick={() => kopiere('code', wartesaal.code!)}>
                {tz(kopiert === 'code' ? 'wartesaal.codeKopiert' : 'wartesaal.codeKopieren')}
              </button>
              <button
                type="button"
                className="hb-kn is-blau"
                onClick={() => kopiere('link', beitrittsLink(wartesaal.code!))}
              >
                {tz(kopiert === 'link' ? 'wartesaal.linkKopiert' : 'wartesaal.linkKopieren')}
              </button>
            </div>
          </div>
        </SpielAbschnitt>
      )}

      <SpielAbschnitt titel={tz('wartesaal.amTisch')} zusatz={sitze.length > 0 ? `${menschen}/${sitze.length}` : undefined}>
        <div className="hb-liste">
          {sitze.length === 0 ? (
            <p className="spe-leer">{tz('verbindung')}</p>
          ) : (
            sitze.map((platz) => (
              <div key={platz.seat} className={`spe-zeile spe-sitz${platz.accountId || platz.isBot ? ' is-besetzt' : ''}`}>
                <span>
                  <strong>{platz.displayName ?? (platz.isBot ? tz('wartesaal.bot') : tz('wartesaal.freierPlatz'))}</strong>
                </span>
                {platz.seat === 0 && <span className="spe-marke">{tz('wartesaal.gastgeber')}</span>}
              </div>
            ))
          )}
        </div>
      </SpielAbschnitt>
      <GastHinweis sitze={sitze} className="spe-text" />

      {wartesaal.gastgeber ? (
        <>
          <SpielAbschnitt titel={tz('wartesaal.freiePlaetze')}>
            <SpielWahl
              name={tz('wartesaal.freiePlaetze')}
              werte={[
                { wert: 'bots' as const, text: tz('erstellen.mitBotsFuellen') },
                { wert: 'weg' as const, text: tz('wartesaal.weglassen') },
              ]}
              wert={wartesaal.botsFuellen ? 'bots' : 'weg'}
              onWahl={(w) => onBotsFuellen(w === 'bots')}
            />
          </SpielAbschnitt>
          {wartesaal.botsFuellen && (
            <SpielAbschnitt titel={tz('erstellen.botStaerke')}>
              <SpielWahl
                name={tz('erstellen.botStaerke')}
                werte={botStufen.map((s) => ({ wert: s.id, text: s.name }))}
                wert={botStufe}
                onWahl={onBotStufe}
              />
            </SpielAbschnitt>
          )}
        </>
      ) : (
        <p className="spe-text">
          {tzAnzahl('wartesaal.da', menschen)}
        </p>
      )}
    </SpielRahmen>
  );
}

// ---------------------------------------------------------------------------
// Der Tisch steht, die Partie läuft an
// ---------------------------------------------------------------------------

export function AufbauNeu({
  text,
  aktiv,
  onAbbrechen,
}: {
  text: string;
  aktiv: number | null;
  onAbbrechen: () => void;
}): React.JSX.Element {
  return (
    <SpielRahmen
      gameId="tafelrunde"
      titel={tz('aufbau.titel')}
      unter={mitspielerzahl(aktiv)}
      akzent={TAFELRUNDE_AKZENT}
      onBack={onAbbrechen}
      zurueckText={tz('abbrechen')}
    >
      <div className="spe-warten">
        <p className="spe-text">{text}</p>
        <Lauf />
      </div>
    </SpielRahmen>
  );
}
