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

import { Suspense, lazy, useEffect, useState } from 'react';
import { Ladekreis } from '../Ladekreis';

/**
 * Die 3D-Truhe wird nachgeladen: `three` und `drei` wiegen rund 900 kB.
 * Steht hier und nicht im Bauteil, damit alle Truhen auf einem Bildschirm
 * dasselbe Stueck teilen.
 */
const Truhe3D = lazy(() => import('../Truhe3D'));

/** Die Öffnungs-Choreografie — ebenfalls nachgeladen, sie zieht `three` mit. */
const TruhenOeffnung = lazy(() =>
  import('../TruhenOeffnung').then((m) => ({ default: m.TruhenOeffnung })),
);

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
  /**
   * Die Truhe in drei Dimensionen.
   *
   * Ersetzt das gezeichnete SVG, das hier stand. Aufrufer merken nichts davon
   * — dieselben zwei Eigenschaften, dieselbe Stelle.
   *
   * `sofort`: In Shop und Aufgabenliste steht die Truhe still, dort soll
   * nichts aufklappen. Die Bewegung gehoert in die Oeffnung
   * (`TruhenOeffnung.tsx`), und nur dort.
   *
   * Der Rueckfall ist ein Kasten in der Farbe des Grades und kein Platzhalter-
   * bild: In einer Liste mit fuenf Truhen laedt `three` einmal, und bis dahin
   * soll die Zeile ihre Hoehe behalten, ohne zu zappeln.
   */
  return (
    <span className={`truhe-bild truhe-bild--3d truhe-bild--${grad}`}>
      <Suspense fallback={null}>
        <Truhe3D grad={grad} offen={offen} sofort />
      </Suspense>
    </span>
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
  /**
   * Der Fund IST die Öffnung.
   *
   * **Die Choreografie war gebaut und nirgends angeschlossen.** Wer eine Truhe
   * kaufte oder einsammelte, bekam sofort „+787 Münzen" zu sehen — die Truhe
   * ging nie auf. Hier ist der Ort dafür: Beide Wege, Kauf im Shop und Abholen
   * bei den Aufgaben, kommen durch dieses Blatt.
   *
   * Und es ist EIN Bildschirm, nicht zwei. Vorher stand hier ein Blatt mit
   * Truhe, Betrag und „Einsammeln" — die Öffnung zeigt den Betrag aber selbst,
   * am Ende der Bewegung. Ein zweites Blatt danach wäre dieselbe Auskunft ein
   * zweites Mal und ein Tipp mehr.
   *
   * Wer die Bewegung nicht sehen will, tippt sofort — `onFertig` hängt am
   * ganzen Bildschirm. Und wer `prefers-reduced-motion` gesetzt hat, sieht das
   * Ergebnis ohne Umweg: Die Regeln dafür stehen in `styles.css`.
   */
  return (
    <Suspense fallback={null}>
      <TruhenOeffnung grad={fund.grad} muenzen={fund.coins} onFertig={onClose} />
    </Suspense>
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
