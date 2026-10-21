import { useState } from 'react';

import type { TableRow, TischVorschau } from '../../api';
import type { BotLevel } from '../../protocol';
import { HbBlatt } from '../../screens/HbBlatt';
import { GastHinweis } from '../../tisch/GastHinweis';
import { SpielAbschnitt, SpielRahmen, SpielWahl } from '../../screens/SpielEinstieg';
import { beitrittsLink } from './tischlink';
import { KOSTEN_FARBE, RollenZeichen } from './Zeichen';

/**
 * Der Einstieg von Tafelrunde im neuen Hub („Nachtblau & Gold", 26.09.2026).
 *
 * Nur das Aussehen: Zustände, Aufrufe und Regeln bleiben in
 * `screens/Tafelrunde.tsx`, und jede Ansicht hier bekommt sie fertig herein.
 * Deshalb verzweigt der Bildschirm je Ansicht an genau einer Stelle
 * (`if (hubNeu)`), und `?hub=alt` zeigt weiter das alte Menü.
 *
 * Grün ist die Farbe des Spiels (die Rollenzeichen im Laden); der Hauptknopf
 * bleibt gold, wie überall im neuen Hub.
 */
export const TAFELRUNDE_AKZENT = '#5aa86a';

const ROLLEN = ['wache', 'schuetze', 'magier', 'meuchler', 'beistand'] as const;

function mitspielerzahl(aktiv: number | null): string {
  return `${aktiv ?? '…'} Spieler gerade in Tafelrunde`;
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
  /** Der Regeltext, derselbe wie im alten Regelblatt. */
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
      unter="Auto-Battler · bis zu 8 Spieler"
      akzent={TAFELRUNDE_AKZENT}
      onBack={onBack}
      zurueckText="Zurück"
      fuss={
        <>
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onSuche} disabled={startet}>
            Mitspieler suchen
          </button>
          <p className="hb-klein">{mitspielerzahl(aktiv)}</p>
        </>
      }
    >
      <div className="spe-karte">
        <p className="spe-text">
          Kaufe Recken, stelle sie aufs Feld und lege drei gleiche zusammen — aus dreien wird eine stärkere. Wer am
          längsten steht, gewinnt.
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
      <SpielAbschnitt titel="Mit Freunden">
        <div className="hb-knopfreihe">
          <button type="button" className="hb-kn is-blau" onClick={onErstellen} disabled={startet}>
            Tisch erstellen
          </button>
          <button type="button" className="hb-kn is-blau" onClick={onBeitreten} disabled={startet}>
            Tisch beitreten
          </button>
        </div>
      </SpielAbschnitt>
      <SpielAbschnitt titel="Allein">
        <button type="button" className="hb-kn is-blau is-breit" onClick={onBots} disabled={startet}>
          Gegen Bots spielen
        </button>
      </SpielAbschnitt>
      <SpielAbschnitt titel="Anleitung">
        <div className="hb-liste">
          <button type="button" className="spe-zeile" onClick={() => setRegelnOffen(true)}>
            <span>
              <strong>So spielt man Tafelrunde</strong>
              <small>Laden, Verschmelzen, Klassen, Kampf</small>
            </span>
            <span className="hb-pf" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </SpielAbschnitt>
      {regelnOffen && (
        <HbBlatt titel="So spielt man Tafelrunde" onClose={() => setRegelnOffen(false)}>
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
      titel="Mitspieler suchen"
      unter={mitspielerzahl(aktiv)}
      akzent={TAFELRUNDE_AKZENT}
      onBack={onAbbrechen}
      zurueckText="Suche abbrechen"
      fuss={
        <button type="button" className="hb-kn is-blau is-breit" onClick={onAbbrechen}>
          Abbrechen
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
            ? 'Noch niemand sonst — bleibt es dabei, wird mit Bots aufgefüllt.'
            : `${gefunden} Spieler gefunden`}
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
      titel="Tisch erstellen"
      unter="Tafelrunde · Tisch mit Code"
      akzent={TAFELRUNDE_AKZENT}
      onBack={onZurueck}
      zurueckText="Zurück zum Menü"
      fuss={
        <>
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onErstellen} disabled={startet}>
            Tisch aufmachen
          </button>
          <p className="hb-klein">
            {oeffentlich
              ? 'Der Tisch steht in der Liste und ist zusätzlich über seinen Code erreichbar.'
              : 'Nur wer den Code hat, kommt an diesen Tisch. Du startest, wann du willst.'}
          </p>
        </>
      }
    >
      {fehler && <p className="hb-fehler">{fehler}</p>}
      <SpielAbschnitt titel="Plätze">
        <SpielWahl name="Plätze" werte={sitzWahl.map((n) => ({ wert: n, text: String(n) }))} wert={sitze} onWahl={onSitze} />
      </SpielAbschnitt>
      <SpielAbschnitt titel="Für wen">
        <SpielWahl
          name="Für wen"
          werte={[
            { wert: 'code' as const, text: 'Nur mit Code' },
            { wert: 'offen' as const, text: 'Offen für alle' },
          ]}
          wert={oeffentlich ? 'offen' : 'code'}
          onWahl={(w) => onOeffentlich(w === 'offen')}
        />
      </SpielAbschnitt>
      <SpielAbschnitt titel="Freie Plätze">
        <SpielWahl
          name="Freie Plätze"
          werte={[
            { wert: 'bots' as const, text: 'Mit Bots füllen' },
            { wert: 'frei' as const, text: 'Frei lassen' },
          ]}
          wert={botsFuellen ? 'bots' : 'frei'}
          onWahl={(w) => onBotsFuellen(w === 'bots')}
        />
      </SpielAbschnitt>
      {/* Die Stufe zeigt nur, wer Bots will — sonst stellt man etwas ein,
          das an diesem Tisch nie zum Zug kommt. */}
      {botsFuellen && (
        <SpielAbschnitt titel="Wie hart spielen die Bots">
          <SpielWahl
            name="Wie hart spielen die Bots"
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
      titel="Tisch beitreten"
      unter="Mit Code oder an einen offenen Tisch"
      akzent={TAFELRUNDE_AKZENT}
      onBack={onZurueck}
      zurueckText="Zurück zum Menü"
      fuss={
        <button
          type="button"
          className="hb-kn is-gold is-haupt is-breit"
          onClick={onPerCode}
          disabled={startet || !codeFertig}
        >
          Beitreten
        </button>
      }
    >
      <p className="spe-text">Tippe den Code ein, den du bekommen hast — oder nimm einen offenen Tisch.</p>
      <SpielAbschnitt titel="Code">
        <input
          className="spe-feld spe-codefeld"
          value={code}
          onChange={(e) => onCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          aria-label="Beitrittscode"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
        />
        {vorschau && (
          <p className="hb-klein">
            {vorschau.host ? `Tisch von ${vorschau.host}` : 'Offener Tisch'} · {vorschau.occupied}/{vorschau.seats} Plätzen
            besetzt
          </p>
        )}
      </SpielAbschnitt>
      {fehler && <p className="hb-fehler">{fehler}</p>}
      <SpielAbschnitt titel="Offene Tische" zusatz={offeneTische.length > 0 ? offeneTische.length : undefined}>
        <div className="hb-liste">
          {offeneTische.length === 0 ? (
            <p className="spe-leer">Gerade steht kein offener Tisch. Mach selbst einen auf.</p>
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
                  <strong>{zeile.host ? `Tisch von ${zeile.host}` : 'Offener Tisch'}</strong>
                </span>
                <span className="spe-punkte" aria-hidden="true">
                  {Array.from({ length: zeile.seats }, (_, i) => (
                    <i key={i} className={i < zeile.occupied ? '' : 'is-frei'} />
                  ))}
                </span>
                <span className="spe-zahl" aria-label={`${zeile.occupied} von ${zeile.seats} Plätzen besetzt`}>
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
 * Wartesaal im neuen Look. Wann gestartet werden darf, entscheidet weiter
 * der Server; der Knopf ist grau bei derselben Zahl wie im alten Wartesaal.
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
      titel="Dein Tisch"
      unter="Tafelrunde · Warten auf Mitspieler"
      akzent={TAFELRUNDE_AKZENT}
      onBack={onAbbrechen}
      zurueckText="Tisch verlassen"
      fuss={
        wartesaal.gastgeber ? (
          <>
            <button
              type="button"
              className="hb-kn is-gold is-haupt is-breit"
              onClick={onStart}
              disabled={!wartesaal.botsFuellen && menschen < 2}
            >
              Partie starten
            </button>
            <p className="hb-klein">
              {wartesaal.botsFuellen
                ? 'Freie Plätze übernehmen Bots — du kannst sofort losspielen.'
                : menschen < 2
                  ? 'Ohne Bots braucht es mindestens einen Mitspieler.'
                  : `Es spielen ${menschen} Menschen, die leeren Plätze fallen weg.`}
            </p>
          </>
        ) : undefined
      }
    >
      {wartesaal.code && (
        <SpielAbschnitt titel="Code">
          <div className="spe-karte">
            <p className="spe-code" aria-label={`Beitrittscode ${wartesaal.code}`}>
              {wartesaal.code}
            </p>
            <div className="hb-knopfreihe">
              <button type="button" className="hb-kn is-blau" onClick={() => kopiere('code', wartesaal.code!)}>
                {kopiert === 'code' ? 'Code kopiert' : 'Code kopieren'}
              </button>
              <button
                type="button"
                className="hb-kn is-blau"
                onClick={() => kopiere('link', beitrittsLink(wartesaal.code!))}
              >
                {kopiert === 'link' ? 'Link kopiert' : 'Link kopieren'}
              </button>
            </div>
          </div>
        </SpielAbschnitt>
      )}

      <SpielAbschnitt titel="Am Tisch" zusatz={sitze.length > 0 ? `${menschen}/${sitze.length}` : undefined}>
        <div className="hb-liste">
          {sitze.length === 0 ? (
            <p className="spe-leer">Verbindung wird aufgebaut…</p>
          ) : (
            sitze.map((platz) => (
              <div key={platz.seat} className={`spe-zeile spe-sitz${platz.accountId || platz.isBot ? ' is-besetzt' : ''}`}>
                <span>
                  <strong>{platz.displayName ?? (platz.isBot ? 'Bot' : 'Freier Platz')}</strong>
                </span>
                {platz.seat === 0 && <span className="spe-marke">Gastgeber</span>}
              </div>
            ))
          )}
        </div>
      </SpielAbschnitt>
      <GastHinweis sitze={sitze} className="spe-text" />

      {wartesaal.gastgeber ? (
        <>
          <SpielAbschnitt titel="Freie Plätze beim Start">
            <SpielWahl
              name="Freie Plätze beim Start"
              werte={[
                { wert: 'bots' as const, text: 'Mit Bots füllen' },
                { wert: 'weg' as const, text: 'Weglassen' },
              ]}
              wert={wartesaal.botsFuellen ? 'bots' : 'weg'}
              onWahl={(w) => onBotsFuellen(w === 'bots')}
            />
          </SpielAbschnitt>
          {wartesaal.botsFuellen && (
            <SpielAbschnitt titel="Wie hart spielen die Bots">
              <SpielWahl
                name="Wie hart spielen die Bots"
                werte={botStufen.map((s) => ({ wert: s.id, text: s.name }))}
                wert={botStufe}
                onWahl={onBotStufe}
              />
            </SpielAbschnitt>
          )}
        </>
      ) : (
        <p className="spe-text">
          {menschen} {menschen === 1 ? 'Spieler ist' : 'Spieler sind'} da. Der Gastgeber startet die Partie.
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
      titel="Tisch wird aufgebaut"
      unter={mitspielerzahl(aktiv)}
      akzent={TAFELRUNDE_AKZENT}
      onBack={onAbbrechen}
      zurueckText="Abbrechen"
    >
      <div className="spe-warten">
        <p className="spe-text">{text}</p>
        <Lauf />
      </div>
    </SpielRahmen>
  );
}
