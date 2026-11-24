/**
 * Freund an den wartenden Tisch einladen (Server: tables/tischeinladung.ts).
 *
 * Neben „+ Bot" der zweite Weg, einen freien Platz zu fuellen: Der Freund
 * bekommt eine Mitteilung aufs Telefon, und wer sie antippt, sitzt mit am
 * Tisch (App.tsx, `horcheAufAntippen`). Unter jedem Namen steht danach, was
 * der Server gemeldet hat — „wurde benachrichtigt" oder „nicht erreichbar",
 * wenn der Freund die App nicht hat oder Mitteilungen aus sind.
 *
 * Wer schon am Tisch sitzt, fehlt in der Liste: Ihn einzuladen waere ein
 * Fehler, den der Server ohnehin abweist.
 */

import { useEffect, useState } from 'react';

import { ApiError, api, type PlayerRef } from '../api';
import { t } from '../i18n';

type Stand = 'laeuft' | 'benachrichtigt' | 'nichtErreichbar' | 'fehler';

export function EinladenBlatt({
  tableId,
  sitzende,
  onClose,
}: {
  tableId: string;
  /** Konten, die schon am Tisch sitzen. */
  sitzende: readonly string[];
  onClose: () => void;
}): React.JSX.Element {
  const [freunde, setFreunde] = useState<PlayerRef[] | null>(null);
  const [stand, setStand] = useState<Record<string, Stand>>({});
  const [fehlerText, setFehlerText] = useState<Record<string, string>>({});

  useEffect(() => {
    let lebt = true;
    api
      .friends()
      .then((listen) => {
        if (lebt) setFreunde(listen.friends);
      })
      .catch(() => {
        if (lebt) setFreunde([]);
      });
    return () => {
      lebt = false;
    };
  }, []);

  const einladen = async (freund: PlayerRef): Promise<void> => {
    setStand((s) => ({ ...s, [freund.id]: 'laeuft' }));
    try {
      const { status } = await api.tischEinladen(tableId, freund.id);
      setStand((s) => ({ ...s, [freund.id]: status }));
    } catch (err) {
      setStand((s) => ({ ...s, [freund.id]: 'fehler' }));
      if (err instanceof ApiError) setFehlerText((f) => ({ ...f, [freund.id]: t(err.messageKey) }));
    }
  };

  const liste = (freunde ?? []).filter((f) => !sitzende.includes(f.id));

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card doko-einladen" onClick={(event) => event.stopPropagation()}>
        <h2>{t('tisch.einladen.titel')}</h2>
        <p className="muted doko-botstufe-hint">{t('tisch.einladen.hinweis')}</p>
        {freunde === null ? null : liste.length === 0 ? (
          <p className="muted">{t('tisch.einladen.leer')}</p>
        ) : (
          <ul className="doko-einladen-liste">
            {liste.map((freund) => {
              const s = stand[freund.id];
              return (
                <li key={freund.id} className="doko-einladen-zeile">
                  <span className="doko-einladen-name">
                    <strong>{freund.displayName}</strong>
                    {s === 'benachrichtigt' && <span className="muted">{t('tisch.einladen.benachrichtigt')}</span>}
                    {s === 'nichtErreichbar' && (
                      <span className="muted">{t('tisch.einladen.nichtErreichbar')}</span>
                    )}
                    {s === 'fehler' && (
                      <span className="doko-error">{fehlerText[freund.id] ?? t('tisch.einladen.fehler')}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="doko-seat-btn"
                    disabled={s === 'laeuft' || s === 'benachrichtigt'}
                    onClick={() => void einladen(freund)}
                  >
                    {s === 'laeuft' ? t('tisch.einladen.laeuft') : t('tisch.einladen.einladen')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="doko-botstufe-wahl" onClick={onClose}>
          <strong>{t('tisch.einladen.schliessen')}</strong>
        </button>
      </div>
    </div>
  );
}
