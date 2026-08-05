/**
 * Tagesaufgaben und Truhen.
 *
 * **Beides auf einem Bildschirm, und bewusst kein sechster Tab.** Die
 * Tab-Leiste hat laut DESIGN.md fuenf Plaetze mit „Spielen" mittig und
 * groesser — ein sechster nimmt die Mitte weg, und damit die einzige Stelle,
 * die man ohne Hinsehen trifft. Aufgaben und Truhen gehoeren ausserdem
 * zusammen: Es ist eine Schleife, nicht zwei. Man spielt, die Aufgaben fuellen
 * sich, die Muenzen landen im Kleiderschrank.
 *
 * Der Weg hierher ist die Truhe am rechten Rand des Startbildschirms — dort
 * stand vorher „Der Tagesbonus, bald".
 *
 * **Die Aufgaben sind jeden Tag dieselben sechs.** Das ist der bewusste
 * Anfang, siehe `packages/server/src/quests.ts`.
 */

import { useEffect, useState } from 'react';
import { Ladekreis } from '../Ladekreis';

import {
  ApiError,
  api,
  type Aufgabe,
  type Aufgaben as AufgabenDaten,
  type Fund,
  type Truhe,
  type Truhen,
} from '../api';
import { Tafel } from '../hub';
import { t } from '../i18n';

/**
 * Truhenbild.
 *
 * Gezeichnet und nicht geladen: Von den fuenf Graden liegt nur ein einziges
 * Truhenbild im Ordner (`truhe.png`), und vier weisse Kaesten waeren der
 * Fehler, der laut STAND.md schon zweimal live gegangen ist. Die Farbe traegt
 * den Grad, der Deckel steht offen, sobald sie geholt ist.
 *
 * **Wird auch im Shop-Regal benutzt** (`TruheKachel` in `GameSelect.tsx`).
 * Deshalb exportiert: Eine zweite gezeichnete Truhe waere zwei Truhen, die sich
 * ab der ersten Bildlieferung unterscheiden.
 */
export function TruhenBild({
  grad,
  offen,
}: {
  grad: Truhe['grad'];
  offen: boolean;
}): React.JSX.Element {
  const farben: Record<Truhe['grad'], [string, string, string]> = {
    holz: ['#8a6a3c', '#6f5230', '#c89a5c'],
    bronze: ['#b5763c', '#8c5628', '#e0a060'],
    silber: ['#aebcc4', '#8494a0', '#dce6ec'],
    gold: ['#e2b64f', '#b78c2c', '#f6e0a0'],
    diamant: ['#7ec8e0', '#4a9cbc', '#d0f0fa'],
  };
  const [koerper, dunkel, hell] = farben[grad];

  return (
    <svg className="truhe-bild" viewBox="0 0 64 56" aria-hidden="true">
      {/* Deckel: geschlossen liegt er auf, geholt steht er nach hinten offen. */}
      <g transform={offen ? 'translate(0 -8) rotate(-14 8 20)' : ''}>
        <path d="M8 24 A24 14 0 0 1 56 24 L56 28 L8 28 Z" fill={koerper} />
        <path d="M8 24 A24 14 0 0 1 56 24 L56 26 L8 26 Z" fill={hell} opacity="0.5" />
      </g>
      <rect x="8" y="28" width="48" height="24" rx="3" fill={koerper} />
      <rect x="8" y="34" width="48" height="5" fill={dunkel} />
      <rect x="28" y="30" width="8" height="12" rx="2" fill={hell} />
      <circle cx="32" cy="36" r="2" fill={dunkel} />
    </svg>
  );
}

/** Eine Truhenzeile: Bild, Name, Zustand, Knopf. */
function TruhenZeile({
  truhe,
  busy,
  onOeffnen,
}: {
  truhe: Truhe;
  busy: boolean;
  onOeffnen: () => void;
}): React.JSX.Element {
  const zustand = (): React.JSX.Element => {
    if (truhe.geholt) {
      return (
        <span className="muted">
          Geholt: {truhe.coins} {truhe.coins === 1 ? 'Münze' : 'Münzen'}
        </span>
      );
    }
    if (truhe.offen) {
      return (
        <span className="muted">
          {truhe.von} bis {truhe.bis} Münzen
        </span>
      );
    }
    return (
      <span className="muted">
        Ab Stufe {truhe.abStufe} · noch {truhe.fehltStufen}{' '}
        {truhe.fehltStufen === 1 ? 'Stufe' : 'Stufen'}
      </span>
    );
  };

  return (
    <div
      className={`truhe-zeile${truhe.offen ? ' is-offen' : ''}${truhe.geholt ? ' is-geholt' : ''}`}
    >
      <TruhenBild grad={truhe.grad} offen={truhe.geholt} />
      <span className="truhe-text">
        <strong>{t(`truhe.${truhe.grad}`)}</strong>
        {zustand()}
      </span>
      {truhe.offen ? (
        <button className="hub-knopf hub-knopf--a-gold" disabled={busy} onClick={onOeffnen}>
          {busy ? 'Öffnet…' : 'Öffnen'}
        </button>
      ) : truhe.geholt ? (
        <span className="truhe-haken" aria-label="schon geholt">
          ✓
        </span>
      ) : (
        <span className="truhe-schloss" aria-hidden="true">
          🔒
        </span>
      )}
    </div>
  );
}

/** Eine Aufgabenzeile mit Fortschrittsbalken und Abholknopf. */
function AufgabenZeile({
  aufgabe,
  busy,
  onAbholen,
}: {
  aufgabe: Aufgabe;
  busy: boolean;
  onAbholen: () => void;
}): React.JSX.Element {
  const anteil = Math.min(100, Math.round((aufgabe.fortschritt / aufgabe.ziel) * 100));

  return (
    <div
      className={`quest-zeile${aufgabe.fertig ? ' is-fertig' : ''}${aufgabe.abgeholt ? ' is-geholt' : ''}`}
    >
      <span className="quest-text">
        <strong>{t(aufgabe.nameKey)}</strong>
        <span className="muted">{t(aufgabe.hinweisKey)}</span>
        {/* Der Balken zeigt den Fortschritt, die Zahl darunter die Wahrheit:
            "2 / 3" beantwortet, was ein halb gefuellter Balken offenlaesst. */}
        <span className="quest-balken" aria-hidden="true">
          <span style={{ width: `${anteil}%` }} />
        </span>
        <span className="quest-zahl muted">
          {aufgabe.fortschritt} / {aufgabe.ziel}
        </span>
      </span>
      <span className="quest-lohn">
        <span className="quest-lohn-wert">
          +{aufgabe.belohnung.betrag}
          <span className="muted"> {t(`waehrung.${aufgabe.belohnung.waehrung}`)}</span>
        </span>
        {aufgabe.abgeholt ? (
          <span className="truhe-haken" aria-label="schon geholt">
            ✓
          </span>
        ) : (
          <button
            className="hub-knopf hub-knopf--a-gold"
            disabled={!aufgabe.fertig || busy}
            onClick={onAbholen}
          >
            {aufgabe.fertig ? (busy ? 'Holt…' : 'Holen') : 'Läuft'}
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * Der Fund einer Truhe, gross in der Mitte.
 *
 * Ohne diesen Moment ist eine Truhe ein Knopf, der eine Zahl oben rechts um
 * zwei erhoeht — und das sieht niemand. Tipp auf den Hintergrund schliesst.
 *
 * **Nimmt nur Grad und Betrag**, nicht den ganzen `Fund`: Damit passt auch der
 * Kauffund aus dem Shop-Regal hier durch, und der Moment sieht in beiden Faellen
 * gleich aus. Exportiert aus demselben Grund.
 */
export function FundBlatt({
  fund,
  onClose,
}: {
  fund: { grad: Truhe['grad']; coins: number };
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet" onClick={onClose} role="presentation">
      <div
        className="doko-sheet-card truhe-fund"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`${fund.coins} Münzen aus der Truhe`}
      >
        <TruhenBild grad={fund.grad} offen />
        <strong className="truhe-fund-zahl">
          +{fund.coins} {fund.coins === 1 ? 'Münze' : 'Münzen'}
        </strong>
        <p className="muted">{t(`truhe.${fund.grad}`)} geöffnet.</p>
        <button className="primary" onClick={onClose}>
          Einsammeln
        </button>
      </div>
    </div>
  );
}

/**
 * Die Zeile oben rechts.
 *
 * Drei Zustaende, nicht zwei: „nichts bereit" und „alles geholt" sind
 * verschiedene Auskuenfte. Wer noch keine Partie gespielt hat, bekam sonst
 * „Alles abgeholt" zu lesen — was nach einem erledigten Tag klingt, obwohl noch
 * nichts angefangen ist.
 */
function kopfstand(daten: AufgabenDaten): string {
  if (daten.offeneBelohnung > 0) return `${daten.offeneBelohnung} Münzen liegen bereit`;
  if (daten.aufgaben.every((a) => a.abgeholt)) return 'Heute alles geholt';
  const summe = daten.aufgaben
    .filter((a) => !a.abgeholt)
    .reduce((s, a) => s + a.belohnung.betrag, 0);
  return `${summe} Münzen zu holen`;
}

/**
 * Der ganze Bildschirm.
 *
 * `onGuthaben` meldet dem Hub, dass sich das Guthaben geaendert hat — die
 * Kopfzeile steht ausserhalb und wuerde sonst weiter die alte Zahl zeigen.
 */
export function Aufgabenblatt({
  onClose,
  onGuthaben,
}: {
  onClose: () => void;
  onGuthaben: () => void;
}): React.JSX.Element {
  const [truhen, setTruhen] = useState<Truhen | null>(null);
  const [aufgaben, setAufgaben] = useState<AufgabenDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Kennung dessen, was gerade laeuft — sperrt genau diesen Knopf. */
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);

  const laden = (): void => {
    void Promise.all([api.chests(), api.quests()])
      .then(([t1, q]) => {
        setTruhen(t1);
        setAufgaben(q);
      })
      .catch(() => setFehler('Aufgaben und Truhen ließen sich nicht laden.'));
  };
  useEffect(laden, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  const meldung = (err: unknown, ersatz: string): void => {
    setFehler(err instanceof ApiError ? t(err.messageKey) : ersatz);
  };

  const oeffnen = (truhe: Truhe): void => {
    if (laeuft) return;
    setLaeuft(truhe.id);
    setFehler(null);
    void api
      .openChest(truhe.id)
      .then((ergebnis) => {
        setFund(ergebnis);
        // Neu laden statt von Hand nachziehen: Der Server ist die Wahrheit,
        // und er weiss auch, was das Oeffnen sonst noch bewegt hat.
        laden();
        onGuthaben();
      })
      .catch((err: unknown) => meldung(err, 'Die Truhe ließ sich nicht öffnen.'))
      .finally(() => setLaeuft(null));
  };

  const abholen = (aufgabe: Aufgabe): void => {
    if (laeuft) return;
    setLaeuft(aufgabe.id);
    setFehler(null);
    void api
      .claimQuest(aufgabe.id)
      .then(() => {
        laden();
        onGuthaben();
      })
      .catch((err: unknown) => meldung(err, 'Die Belohnung ließ sich nicht holen.'))
      .finally(() => setLaeuft(null));
  };

  const offeneTruhen =
    (truhen?.tag.offen ? 1 : 0) + (truhen?.stufen.filter((s) => s.offen).length ?? 0);

  return (
    <div className="pfad-voll">
      <header className="pfad-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          ← Zurück
        </button>
        {aufgaben && <span className="pfad-voll-stand">{kopfstand(aufgaben)}</span>}
      </header>

      <div className="pfad-voll-rolle aufgaben-rolle">
        {fehler && <p className="error">{fehler}</p>}
        {!truhen && !aufgaben && !fehler && <Ladekreis />}

        {aufgaben && (
          <Tafel
            titel="Tagesaufgaben"
            zusatz={
              aufgaben.aufgaben.every((a) => a.abgeholt)
                ? 'Heute erledigt'
                : 'Setzt sich morgen zurück'
            }
          >
            {aufgaben.aufgaben.map((aufgabe) => (
              <AufgabenZeile
                key={aufgabe.id}
                aufgabe={aufgabe}
                busy={laeuft === aufgabe.id}
                onAbholen={() => abholen(aufgabe)}
              />
            ))}
            <p className="quest-hinweis muted">
              Gezählt wird am Ende einer Partie — auch an Tischen mit Bots. Abgebrochene Partien
              zählen nicht.
            </p>
          </Tafel>
        )}

        {truhen && (
          <Tafel
            titel="Truhen"
            zusatz={offeneTruhen > 0 ? `${offeneTruhen} offen` : 'Keine offen'}
          >
            <TruhenZeile
              truhe={truhen.tag}
              busy={laeuft === truhen.tag.id}
              onOeffnen={() => oeffnen(truhen.tag)}
            />
            <p className="quest-hinweis muted">
              Die Tagestruhe steht jeden Tag einmal bereit. Die anderen kommen mit den Stufen —
              erreicht ist erreicht, sie gehen nie wieder zu.
            </p>
            {truhen.stufen.map((truhe) => (
              <TruhenZeile
                key={truhe.id}
                truhe={truhe}
                busy={laeuft === truhe.id}
                onOeffnen={() => oeffnen(truhe)}
              />
            ))}
          </Tafel>
        )}
      </div>

      {fund && <FundBlatt fund={fund} onClose={() => setFund(null)} />}
    </div>
  );
}
