import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';
import { inApp } from '../laufzeit';
import { AnbieterKnoepfe, type AnbieterErgebnis } from './AnbieterKnoepfe';
import { ladeAnbieterConfig, type Anbieter } from './anbieter';

type Stand = Awaited<ReturnType<typeof api.anmeldearten>>;

const NAME: Record<Anbieter, string> = { apple: 'Apple', google: 'Google' };

/**
 * Einstellungen, Abschnitt "Anmeldung": womit man in dieses Konto kommt.
 *
 * Verknuepfen und Trennen je Anbieter. Die letzte Anmeldeart laesst sich nicht
 * trennen — der Knopf ist dann gar nicht erst da, und der Server lehnt es
 * ohnehin ab (auth/anbieter.ts). Fuer einen Gast ist das Verknuepfen zugleich
 * das Sichern: Danach kommt er nach dem Abmelden wieder hinein.
 *
 * Nachgeladen (Einstellungen.tsx): Die Einstellungen haengen am Startbildschirm
 * und damit im Sofort-Paket, dieser Abschnitt braucht dort niemand.
 *
 * Bietet die Ausgabe keinen Anbieter an und ist keiner verknuepft, erscheint
 * gar nichts — ein Abschnitt, in dem nur "Passwort: ja" stuende, waere keine
 * Einstellung.
 */
export function Anmeldearten(): React.JSX.Element | null {
  const [stand, setStand] = useState<Stand | null>(null);
  const [angeboten, setAngeboten] = useState<Anbieter[]>([]);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    const [arten, config] = await Promise.all([api.anmeldearten(), ladeAnbieterConfig()]);
    setStand(arten);
    setAngeboten(
      (['apple', 'google'] as const).filter((a) => (a === 'apple' ? config.apple : config.google)),
    );
  }, []);

  useEffect(() => {
    if (inApp) return;
    laden().catch(() => setStand(null));
  }, [laden]);

  const zeigeFehler = (err: unknown): void => {
    setMeldung(null);
    setFehler(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
  };

  const verknuepft = (ergebnis: AnbieterErgebnis): void => {
    setFehler(null);
    setMeldung(
      ergebnis.gesichert
        ? `Dein Konto ist gesichert. Ab jetzt meldest du dich mit ${NAME[ergebnis.anbieter]} an.`
        : `${NAME[ergebnis.anbieter]} ist verknüpft.`,
    );
    void laden();
  };

  const trennen = async (anbieter: Anbieter): Promise<void> => {
    setBusy(true);
    setFehler(null);
    setMeldung(null);
    try {
      await api.trenneAnbieter(anbieter);
      setMeldung(`${NAME[anbieter]} ist getrennt.`);
      await laden();
    } catch (err) {
      zeigeFehler(err);
    } finally {
      setBusy(false);
    }
  };

  if (!stand) return null;
  const verbunden = new Set(stand.anbieter.map((a) => a.anbieter));
  const offen = angeboten.filter((a) => !verbunden.has(a));
  if (stand.anbieter.length === 0 && offen.length === 0) return null;

  // Wie viele Wege hinein es gibt — einer allein darf nicht gehen.
  const wege = stand.anbieter.length + (stand.passwort ? 1 : 0);

  return (
    <section className="anbieter-arten" aria-label="Anmeldung">
      <h3>Anmeldung</h3>

      {stand.gast ? (
        <p className="muted">
          Du spielst als Gast. Verknüpfe Apple oder Google, dann kommst du auch nach dem
          Abmelden wieder an dieses Konto.
        </p>
      ) : (
        <div className="anbieter-arten-zeile">
          <div>
            <strong>E-Mail und Passwort</strong>
            <span className="muted">
              {stand.passwort
                ? stand.email
                : 'Kein Passwort gesetzt — über „Passwort vergessen“ legst du eins an.'}
            </span>
          </div>
        </div>
      )}

      {stand.anbieter.map((bindung) => (
        <div className="anbieter-arten-zeile" key={bindung.anbieter}>
          <div>
            <strong>{NAME[bindung.anbieter]}</strong>
            {bindung.email && <span className="muted">{bindung.email}</span>}
          </div>
          {wege > 1 && (
            <button
              type="button"
              className="hub-knopf"
              disabled={busy}
              onClick={() => void trennen(bindung.anbieter)}
            >
              Trennen
            </button>
          )}
        </div>
      ))}

      {offen.length > 0 && (
        <AnbieterKnoepfe
          zweck="verknuepfen"
          nur={offen}
          gesperrt={busy}
          onErfolg={verknuepft}
          onFehler={zeigeFehler}
        />
      )}

      {meldung && <p className="muted">{meldung}</p>}
      {fehler && <p className="error">{fehler}</p>}
    </section>
  );
}
