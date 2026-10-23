import { useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import { t } from '../i18n';
import { spiele } from '../klang';
import type { ManufakturAntwort } from './sicht';
import { type Leitung, NACHFRAGEN_MS, Steuerung } from './steuerung';

/**
 * Die Steuerung fuer einen Bildschirm: eine je geoeffneter Manufaktur, mit
 * Nachfragen alle 30 s und beim Zurueckkommen in die App. Meldungen (Muenzen,
 * Fehler, Offline, Umzug) landen als React-Zustand beim Bildschirm.
 */
export function useManufaktur(
  onGeaendert: () => void,
  /** Nur fuer Proben (proben/manufaktur): ein nachgestellter Server statt der echten API. */
  leitung?: Leitung,
): {
  steuerung: Steuerung;
  bereit: boolean;
  ladefehler: string | null;
  nochmal: () => void;
  meldung: string | null;
  melde: (text: string) => void;
  offline: ManufakturAntwort['offline'];
  schliesseOffline: () => void;
  umgezogen: number | null;
  schliesseUmzug: () => void;
  gefeiert: number | null;
  schliesseFeier: () => void;
} {
  const [meldung, setMeldung] = useState<string | null>(null);
  const [offline, setOffline] = useState<ManufakturAntwort['offline']>(null);
  const [umgezogen, setUmgezogen] = useState<number | null>(null);
  const [gefeiert, setGefeiert] = useState<number | null>(null);
  const [bereit, setBereit] = useState(false);
  const [ladefehler, setLadefehler] = useState<string | null>(null);

  const melde = useMemo(() => {
    let zuletzt: number | undefined;
    return (text: string) => {
      setMeldung(text);
      window.clearTimeout(zuletzt);
      zuletzt = window.setTimeout(() => setMeldung(null), 2200);
    };
  }, []);

  const steuerung = useMemo(
    () =>
      new Steuerung(
        leitung ?? { laden: () => api.manufaktur(), senden: (aktion, bei) => api.manufakturAktion(aktion, bei) },
        {
          muenzen: (anzahl) => {
            spiele('kauf');
            melde(`Meilenstein! +${anzahl} Münzen fürs Hub`);
            onGeaendert();
          },
          offline: setOffline,
          umzug: setUmgezogen,
          jubilaeum: setGefeiert,
          fehler: (schluessel) => {
            spiele('fehler');
            melde(schluessel ? t(schluessel) : 'Keine Verbindung.');
          },
        },
      ),
    // Eine Steuerung je Bildschirm; onGeaendert darf sich aendern, ohne den Stand zu verlieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [versuch, setVersuch] = useState(0);

  useEffect(() => {
    let aus = false;
    const erst = (): void => {
      setLadefehler(null);
      // Fehler meldet die Steuerung selbst; hier zaehlt nur, ob ein Stand da ist.
      void steuerung.laden().then(() => {
        if (aus) return;
        if (steuerung.bereit()) setBereit(true);
        else setLadefehler('Keine Verbindung.');
      });
    };
    erst();
    const nachfragen = window.setInterval(() => void steuerung.laden(), NACHFRAGEN_MS);
    // Zurueck in der App: Der Stand ist alt, die Uhr lief weiter.
    const sichtbar = (): void => {
      if (document.visibilityState === 'visible') void steuerung.laden();
    };
    document.addEventListener('visibilitychange', sichtbar);
    return () => {
      aus = true;
      window.clearInterval(nachfragen);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, [steuerung, versuch]);

  return {
    steuerung,
    bereit,
    ladefehler,
    nochmal: () => setVersuch((v) => v + 1),
    meldung,
    melde,
    offline,
    schliesseOffline: () => setOffline(null),
    umgezogen,
    schliesseUmzug: () => setUmgezogen(null),
    gefeiert,
    schliesseFeier: () => setGefeiert(null),
  };
}
