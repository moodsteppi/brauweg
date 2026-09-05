/**
 * Feedback-Knopf fuers interne Testen auf Staging.
 *
 * Als eigene Wurzel neben <App/> gemountet (siehe main.tsx), nicht als Teil
 * von dessen Bildschirmen: App.tsx hat pro Bildschirm einen fruehen `return`,
 * ein Einhaengen dort haette an zehn Stellen wiederholt werden muessen. Holt
 * sich `me` deshalb selbst und zeigt sich nur bei `stage === 'staging'` —
 * auf Produktion gibt es diesen Knopf nie, damit ihn kein echter Spieler zu
 * sehen bekommt. Position ist ziehbar und bleibt ueber `localStorage`
 * erhalten, damit er sich dauerhaft aus dem Weg schieben laesst.
 */

import { useEffect, useRef, useState } from 'react';
import { api } from './api';

const POSITION_SCHLUESSEL = 'front-feedback-pos';
const STANDARD_POSITION = { top: 72, right: 12 };
/** Ab wann ein Pointer-Down eher ein Ziehen als ein Klick war. */
const ZIEH_SCHWELLE_PX = 6;

type Position = { top: number; right: number };

function gespeichertePosition(): Position {
  try {
    const roh = localStorage.getItem(POSITION_SCHLUESSEL);
    if (!roh) return STANDARD_POSITION;
    const wert = JSON.parse(roh) as Partial<Position>;
    if (typeof wert.top === 'number' && typeof wert.right === 'number') return wert as Position;
  } catch {
    // Kaputter Eintrag ist kein Grund, den Knopf verschwinden zu lassen.
  }
  return STANDARD_POSITION;
}

/**
 * Screenshot als komprimiertes JPEG-DataURL, damit er unter
 * FEEDBACK_BILD_MAX_ZEICHEN bleibt.
 *
 * `html2canvas` wird HIER geholt und nicht oben importiert: Die Bibliothek
 * wiegt gebaut rund 200 kB und lag als gewoehnlicher Import im Hauptbuendel —
 * also bei jedem Spieler, obwohl dieser Knopf nur auf Staging ueberhaupt
 * erscheint und auch dort erst beim Melden eines Fehlers etwas zu tun hat.
 * Der Import steht in der Funktion und nicht in einem `lazy`, weil hier
 * nichts zu zeichnen ist: Gewartet wird erst, wenn der Knopf gedrueckt wurde.
 */
async function screenshotMachen(): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');
  const leinwand = await html2canvas(document.body, { logging: false, useCORS: true });
  return leinwand.toDataURL('image/jpeg', 0.6);
}

export function FeedbackWidget(): React.JSX.Element | null {
  const [stage, setStage] = useState<'production' | 'staging' | 'development' | null>(null);
  const [position, setPosition] = useState<Position>(gespeichertePosition);
  const [offen, setOffen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [beschreibung, setBeschreibung] = useState('');
  const [sendeStatus, setSendeStatus] = useState<'bereit' | 'sendet' | 'fehler' | 'fertig'>('bereit');

  const ziehStart = useRef<{ x: number; y: number; top: number; right: number } | null>(null);
  const hatGezogen = useRef(false);

  useEffect(() => {
    api
      .me()
      .then((m) => setStage(m.stage))
      .catch(() => setStage(null));
  }, []);

  useEffect(() => {
    if (!offen) return;
    const aufEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOffen(false);
    };
    document.addEventListener('keydown', aufEscape);
    return () => document.removeEventListener('keydown', aufEscape);
  }, [offen]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    hatGezogen.current = false;
    ziehStart.current = { x: e.clientX, y: e.clientY, top: position.top, right: position.right };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const start = ziehStart.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > ZIEH_SCHWELLE_PX || Math.abs(dy) > ZIEH_SCHWELLE_PX) hatGezogen.current = true;
    if (!hatGezogen.current) return;
    setPosition({ top: start.top + dy, right: start.right - dx });
  };

  const onPointerUp = async (): Promise<void> => {
    const wurdeGezogen = hatGezogen.current;
    ziehStart.current = null;
    if (wurdeGezogen) {
      localStorage.setItem(POSITION_SCHLUESSEL, JSON.stringify(position));
      return;
    }
    setOffen(true);
    setSendeStatus('bereit');
    setScreenshot(null);
    setBeschreibung('');
    try {
      setScreenshot(await screenshotMachen());
    } catch {
      setScreenshot(null);
    }
  };

  const absenden = async (): Promise<void> => {
    if (!beschreibung.trim()) return;
    setSendeStatus('sendet');
    try {
      await api.feedbackSenden({
        beschreibung: beschreibung.trim(),
        screenshot: screenshot ?? undefined,
        seite: location.pathname,
      });
      setSendeStatus('fertig');
    } catch {
      setSendeStatus('fehler');
    }
  };

  if (stage !== 'staging') return null;

  return (
    <>
      <button
        type="button"
        aria-label="Feedback geben"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => void onPointerUp()}
        style={{
          position: 'fixed',
          top: position.top,
          right: position.right,
          zIndex: 9999,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          background: '#2d2d2d',
          color: '#fff',
          fontSize: 20,
          cursor: 'grab',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        🐞
      </button>

      {offen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setOffen(false)}
        >
          <div
            style={{
              background: '#1e1e1e',
              color: '#fff',
              borderRadius: 12,
              padding: 20,
              width: 'min(480px, 90vw)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Feedback</h2>
            {screenshot && (
              <img
                src={screenshot}
                alt="Screenshot"
                style={{ width: '100%', borderRadius: 8, marginBottom: 12, border: '1px solid #444' }}
              />
            )}
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Was ist das Problem?"
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12 }}
            />
            {sendeStatus === 'fehler' && <p style={{ color: '#f66' }}>Konnte nicht gesendet werden.</p>}
            {sendeStatus === 'fertig' ? (
              <p>Danke, angekommen!</p>
            ) : (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setOffen(false)}>
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={!beschreibung.trim() || sendeStatus === 'sendet'}
                  onClick={() => void absenden()}
                >
                  {sendeStatus === 'sendet' ? 'Sende…' : 'Absenden'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
