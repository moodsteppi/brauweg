import { useState } from 'react';

import { ApiError, api } from '../api';
import { t, zahl } from '../i18n';
import { tf } from '../i18n/einsetzen';

/**
 * Muenz-Code einloesen — nur auf der Webseite.
 *
 * Die Codes erzeugt das Team im brotool (Tab „Spielen" → Codes). In der App
 * gibt es den Abschnitt nicht: Apple verbietet dort eigene Freischalt-Codes
 * (App-Store-Regel 3.1.1), und der Server lehnt Einloesungen aus der App
 * ebenfalls ab (server/src/muenzcodes.ts). Die Muenzen gelten danach auf
 * jedem Geraet — es ist dasselbe Konto.
 */
/**
 * Aktionscodes (Adventskalender) koennen statt oder neben Muenzen Kosmetik
 * schenken. Ein reiner Skin-Code meldet keine „0 Münzen".
 */
function meldungFuer(muenzen: number, items: readonly string[]): string {
  const teile: string[] = [];
  if (muenzen > 0) teile.push(tf('anmeldung.code.gutgeschrieben', { muenzen: zahl(muenzen) }));
  for (const id of items) teile.push(tf('anmeldung.code.freigeschaltet', { name: t(`kosmetik.${id}`) }));
  return teile.join(' ');
}

export function CodeEinloesen({ onEingeloest }: { onEingeloest?: () => void }): React.JSX.Element {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const einloesen = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setFehler(null);
    setMeldung(null);
    try {
      const antwort = await api.codeEinloesen(code.trim());
      setMeldung(meldungFuer(antwort.muenzen, antwort.items ?? []));
      setCode('');
      onEingeloest?.();
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : t('anmeldung.verbindungFehlgeschlagen'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hb-blk">
      <h2 className="hb-ab">{t('anmeldung.code.titel')}</h2>
      <form className="hb-formular" onSubmit={(e) => void einloesen(e)}>
        <label>
          <span>{t('anmeldung.code.feld')}</span>
          <input
            className="hb-feld"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BW-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
          />
        </label>
        {fehler && <span className="hb-fehler">{fehler}</span>}
        {meldung && <p className="hb-klein hb-ohne-rand">{meldung}</p>}
        <button type="submit" className="hb-kn is-gold is-haupt is-breit" disabled={busy || !code.trim()}>
          {busy ? t('anmeldung.code.laeuft') : t('anmeldung.code.einloesen')}
        </button>
      </form>
    </section>
  );
}
