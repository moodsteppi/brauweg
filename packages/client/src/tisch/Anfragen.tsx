import { useEffect, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';
import { SpielAbschnitt, SpielRahmen } from '../screens/SpielEinstieg';

/**
 * Beitritt mit Zusage (Emile, 13.10.2026) — die beiden Seiten am Bildschirm.
 *
 * Die Regel steht im Server (tables/anfragen.ts): An einem nicht-öffentlichen
 * Tisch der Kartenlobby setzt sich niemand von selbst hin, der Gastgeber
 * sagt zu. Der Client fragt nur nach und zeigt an; ob eine Zusage nötig ist,
 * erfährt er aus der Antwort (`angefragt`), nicht aus einer eigenen Regel.
 *
 * Abgefragt wird in Abständen statt über die Tischleitung: Der Anfragende hat
 * noch keine (er sitzt ja nicht), und für den Gastgeber reicht ein Blick alle
 * paar Sekunden — eine Anfrage ist kein Spielzug.
 */

const ABSTAND_MS = 2500;

/**
 * Für den Gastgeber im Wartebereich: wer mitspielen möchte, mit Zusage und
 * Absage. Wer nicht Gastgeber ist, bekommt vom Server 403 — dann steht hier
 * nichts, und es wird auch nicht weiter gefragt.
 */
export function AnfragenLeiste({ tableId }: { tableId: string }): React.JSX.Element | null {
  const [anfragen, setAnfragen] = useState<{ accountId: string; displayName: string }[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);

  useEffect(() => {
    let lebt = true;
    let zeitgeber: ReturnType<typeof setTimeout> | undefined;
    const hole = (): void => {
      api
        .anfragen(tableId)
        .then((antwort) => {
          if (!lebt) return;
          setAnfragen(antwort.anfragen);
          zeitgeber = setTimeout(hole, ABSTAND_MS);
        })
        .catch((err: unknown) => {
          if (!lebt) return;
          // Nicht Gastgeber oder Tisch weg: still aufhören.
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return;
          zeitgeber = setTimeout(hole, ABSTAND_MS * 2);
        });
    };
    hole();
    return () => {
      lebt = false;
      if (zeitgeber) clearTimeout(zeitgeber);
    };
    // `runde` holt nach einer Entscheidung sofort neu, statt auf den Takt zu warten.
  }, [tableId, runde]);

  if (anfragen.length === 0) return null;

  const entscheide = async (accountId: string, annehmen: boolean): Promise<void> => {
    setLaeuft(accountId);
    setFehler(null);
    try {
      await api.entscheideAnfrage(tableId, accountId, annehmen);
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : 'Das hat nicht geklappt.');
    } finally {
      setLaeuft(null);
      setRunde((r) => r + 1);
    }
  };

  return (
    <section className="tisch-anfragen" aria-label="Beitrittsanfragen">
      <strong>Möchten mitspielen</strong>
      {anfragen.map((a) => (
        <div className="tisch-anfrage" key={a.accountId}>
          <span>{a.displayName}</span>
          <button
            type="button"
            className="doko-seat-btn is-ja"
            disabled={laeuft === a.accountId}
            onClick={() => void entscheide(a.accountId, true)}
          >
            Zusagen
          </button>
          <button
            type="button"
            className="doko-seat-btn"
            disabled={laeuft === a.accountId}
            onClick={() => void entscheide(a.accountId, false)}
          >
            Ablehnen
          </button>
        </div>
      ))}
      {fehler && <p className="doko-error">{fehler}</p>}
    </section>
  );
}

/**
 * Für den Anfragenden: warten, bis der Gastgeber zusagt. Bei Zusage geht es
 * an den Tisch (`onAngenommen`), bei Absage steht es da, und „Zurück" zieht
 * die Anfrage zurück, damit sie beim Gastgeber nicht stehen bleibt.
 */
export function AnfrageWarten({
  gameId,
  tableId,
  gastgeber,
  onAngenommen,
  onZurueck,
}: {
  gameId: string;
  tableId: string;
  /** Anzeigename des Gastgebers, wenn bekannt. */
  gastgeber?: string | null;
  onAngenommen: () => void;
  onZurueck: () => void;
}): React.JSX.Element {
  const [stand, setStand] = useState<'offen' | 'angenommen' | 'abgelehnt'>('offen');

  useEffect(() => {
    let lebt = true;
    let zeitgeber: ReturnType<typeof setTimeout> | undefined;
    const hole = (): void => {
      api
        .anfrageStand(tableId)
        .then(({ stand: neu }) => {
          if (!lebt) return;
          setStand(neu);
          if (neu === 'angenommen') onAngenommen();
          else if (neu === 'offen') zeitgeber = setTimeout(hole, ABSTAND_MS);
        })
        .catch(() => {
          if (lebt) zeitgeber = setTimeout(hole, ABSTAND_MS * 2);
        });
    };
    hole();
    return () => {
      lebt = false;
      if (zeitgeber) clearTimeout(zeitgeber);
    };
    // Nur am Tisch hängen: `onAngenommen` ist bei jedem Rendern eine neue
    // Funktion und würde die Abfrage sonst ständig neu starten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const zurueck = (): void => {
    if (stand === 'offen') void api.zieheAnfrageZurueck(tableId).catch(() => undefined);
    onZurueck();
  };

  const wer = gastgeber ? gastgeber : 'Der Gastgeber';
  return (
    <SpielRahmen
      gameId={gameId}
      titel={stand === 'abgelehnt' ? 'Leider nicht' : 'Anfrage gesendet'}
      unter={`${t(`game.${gameId}`)} · privater Tisch`}
      onBack={zurueck}
      zurueckText="Zurück"
      fuss={
        <button type="button" className="hb-kn is-breit" onClick={zurueck}>
          {stand === 'abgelehnt' ? 'Zurück' : 'Anfrage zurückziehen'}
        </button>
      }
    >
      <SpielAbschnitt titel={stand === 'abgelehnt' ? 'Abgelehnt' : 'Warte auf Zusage'}>
        <p className="hb-klein">
          {stand === 'abgelehnt'
            ? `${wer} hat abgelehnt - oder der Tisch ist inzwischen voll.`
            : `${wer} muss dich hereinlassen. Sobald die Zusage kommt, geht es an den Tisch.`}
        </p>
      </SpielAbschnitt>
    </SpielRahmen>
  );
}
