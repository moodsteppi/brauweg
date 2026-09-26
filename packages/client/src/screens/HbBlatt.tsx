import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Blätter und Vollbilder des neuen Hubs („Nachtblau & Gold").
 *
 * Eine Bauform für alle, damit Kaufrückfrage, Rangliste, „Kommt bald" und die
 * Clan-Blätter sich gleich bedienen (DESIGN.md, „Das neue Hub"): Griff oben,
 * Wisch nach unten, Tipp auf den Hintergrund, Schließen-Knopf und Escape.
 * „Heute" (HeuteNeu.tsx) war das erste Blatt dieser Art und trägt dieselben
 * Klassen.
 */

/**
 * Hängt den Inhalt an die Wurzel des neuen Hubs statt an die Stelle im Baum.
 *
 * Der Grund ist der Zieh-Pager: Die Seitenschiene trägt immer ein
 * `transform` (auch `translateX(0%)`), und ein transformierter Vorfahr wird
 * zum Bezugsrahmen für `position: fixed`. Ein Blatt aus dem Shop oder dem
 * Profil deckte deshalb nur die Seite ab — die Reiterleiste blieb darunter
 * sichtbar und antippbar. An der Wurzel `.hb` liegt es über allem.
 *
 * Ohne Hub-Wurzel (Tests einzelner Teile) bleibt es, wo es steht.
 */
export function ImHub({ children }: { children: React.ReactNode }): React.JSX.Element {
  const wurzel = typeof document === 'undefined' ? null : document.querySelector('.hb');
  return wurzel ? createPortal(children, wurzel) : <>{children}</>;
}

/**
 * Offene Blätter und Vollbilder, oberstes zuletzt.
 *
 * Escape schließt nur das oberste: Über dem Kleiderschrank liegt die
 * Kaufrückfrage, und ein Druck auf Escape soll die Frage schließen, nicht
 * beide auf einmal.
 */
const stapel: number[] = [];
let naechsteKennung = 1;

/** Escape schließt — aber nur, wenn dieses Blatt obenauf liegt. */
export function useEscape(onClose: () => void): void {
  // Über eine Referenz, damit ein neuer Rückruf (jede Darstellung eine neue
  // Pfeilfunktion) nicht die Reihenfolge im Stapel verschiebt.
  const schliessen = useRef(onClose);
  schliessen.current = onClose;
  useEffect(() => {
    const kennung = naechsteKennung++;
    stapel.push(kennung);
    const taste = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || stapel[stapel.length - 1] !== kennung) return;
      // In der Einfangphase und angehalten: Ältere Blätter mit eigenem
      // Escape-Horcher (Kleiderschrank, Stufenleiter) schließen sonst mit.
      e.stopPropagation();
      schliessen.current();
    };
    window.addEventListener('keydown', taste, true);
    return () => {
      window.removeEventListener('keydown', taste, true);
      const stelle = stapel.indexOf(kennung);
      if (stelle >= 0) stapel.splice(stelle, 1);
    };
  }, []);
}

export function HbSymbol({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** Runder Schließen-Knopf (44 pt), wie in „Heute" und am Trophäenweg. */
export function Schliessen({ onClick, label = 'Schließen' }: { onClick: () => void; label?: string }): React.JSX.Element {
  return (
    <button type="button" className="hb-rund" onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

/** Runder Zurück-Knopf für Unterseiten, die im Reiter bleiben. */
export function Zurueck({ onClick, label = 'Zurück' }: { onClick: () => void; label?: string }): React.JSX.Element {
  return (
    <button type="button" className="hb-rund" onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/**
 * Blatt von unten.
 *
 * `titel` steht groß im Kopf; `label` ersetzt ihn nur für den Vorlesenamen,
 * wenn der sichtbare Titel allein nicht sagt, worum es geht.
 */
export function HbBlatt({
  titel,
  label,
  onClose,
  klasse,
  children,
}: {
  titel: string;
  label?: string;
  onClose: () => void;
  /** Zusatzklasse am Blatt, z. B. für die schmale Kaufrückfrage. */
  klasse?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  useEscape(onClose);
  const blatt = useRef<HTMLDivElement>(null);
  const zug = useRef<{ y: number; dy: number } | null>(null);

  // Wisch nach unten am Griff schließt — dieselbe Schwelle wie in „Heute".
  const ziehStart = (e: React.TouchEvent): void => {
    zug.current = { y: e.touches[0]!.clientY, dy: 0 };
  };
  const ziehen = (e: React.TouchEvent): void => {
    if (!zug.current || !blatt.current) return;
    zug.current.dy = Math.max(0, e.touches[0]!.clientY - zug.current.y);
    blatt.current.style.transform = `translateY(${zug.current.dy}px)`;
  };
  const ziehEnde = (): void => {
    const dy = zug.current?.dy ?? 0;
    zug.current = null;
    if (dy > 90) onClose();
    else if (blatt.current) blatt.current.style.transform = '';
  };

  return (
    <ImHub>
      <div className="hb-blatt-grund" onClick={onClose} role="presentation">
        <div
          className={`hb-blatt${klasse ? ` ${klasse}` : ''}`}
          ref={blatt}
          role="dialog"
          aria-modal="true"
          aria-label={label ?? titel}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hb-blatt-griff" onTouchStart={ziehStart} onTouchMove={ziehen} onTouchEnd={ziehEnde}>
            <span aria-hidden="true" />
          </div>
          <header className="hb-blatt-kopf">
            <h2 className="hb-titel hb-blatt-titel">{titel}</h2>
            <Schliessen onClick={onClose} />
          </header>
          <div className="hb-blatt-rolle">{children}</div>
        </div>
      </div>
    </ImHub>
  );
}
