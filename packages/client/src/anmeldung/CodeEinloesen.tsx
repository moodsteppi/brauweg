import { useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';

/**
 * Muenz-Code einloesen — nur auf der Webseite.
 *
 * Die Codes erzeugt das Team im brotool (Tab „Spielen" → Codes). In der App
 * gibt es den Abschnitt nicht: Apple verbietet dort eigene Freischalt-Codes
 * (App-Store-Regel 3.1.1), und der Server lehnt Einloesungen aus der App
 * ebenfalls ab (server/src/muenzcodes.ts). Die Muenzen gelten danach auf
 * jedem Geraet — es ist dasselbe Konto.
 */
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
      setMeldung(`${antwort.muenzen.toLocaleString('de-DE')} Münzen gutgeschrieben.`);
      setCode('');
      onEingeloest?.();
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hb-blk">
      <h2 className="hb-ab">Code einlösen</h2>
      <form className="hb-formular" onSubmit={(e) => void einloesen(e)}>
        <label>
          <span>Code</span>
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
          {busy ? 'Wird eingelöst…' : 'Einlösen'}
        </button>
      </form>
    </section>
  );
}
