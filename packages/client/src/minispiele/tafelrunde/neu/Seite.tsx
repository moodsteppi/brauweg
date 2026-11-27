/**
 * Der Rahmen der Seiten vor dem Tisch: Kopf mit Zurueck, Inhalt, unten fest
 * der Hauptknopf in Daumenreichweite (DESIGN.md: „Eine Hand, ein Daumen").
 *
 * Hochkant und auf die volle Hoehe (`100dvh`), mit den Safe Areas der
 * iOS-Huelle ueber `env()` — die Kerbe oben und der Wischbalken unten duerfen
 * weder Zurueck-Knopf noch Hauptknopf verdecken.
 */

import type { ReactNode } from 'react';

import stil from './neu.module.css';

export function Seite({
  titel,
  unter,
  zurueckText,
  onZurueck,
  kopfbild,
  children,
  fuss,
}: {
  titel: string;
  unter?: string;
  zurueckText: string;
  onZurueck: () => void;
  /** Titelbild oder Ersatz ueber dem Titel (nur der Einstieg hat eins). */
  kopfbild?: ReactNode;
  children: ReactNode;
  fuss?: ReactNode;
}): React.JSX.Element {
  return (
    <main className={stil.seite}>
      <header className={stil.seitenKopf}>
        <button type="button" className={stil.zurueck} onClick={onZurueck} aria-label={zurueckText}>
          ‹
        </button>
        {kopfbild}
        <div className={stil.seitenTitel}>
          <h1>{titel}</h1>
          {unter && <p>{unter}</p>}
        </div>
      </header>
      <div className={stil.seitenInhalt}>{children}</div>
      {fuss && <footer className={stil.seitenFuss}>{fuss}</footer>}
    </main>
  );
}

/** Eine Auswahl aus wenigen Werten als Chips (Plaetze, Bot-Stufe, …). */
export function Wahl<W extends string | number>({
  name,
  werte,
  wert,
  onWahl,
}: {
  name: string;
  werte: readonly { wert: W; text: string }[];
  wert: W;
  onWahl: (w: W) => void;
}): React.JSX.Element {
  return (
    <div className={stil.wahl} role="radiogroup" aria-label={name}>
      {werte.map((w) => (
        <button
          key={String(w.wert)}
          type="button"
          role="radio"
          aria-checked={w.wert === wert}
          className={stil.chip}
          data-an={w.wert === wert ? '' : undefined}
          onClick={() => onWahl(w.wert)}
        >
          {w.text}
        </button>
      ))}
    </div>
  );
}

/** Ein Abschnitt mit Ueberschrift. */
export function Abschnitt({ titel, zusatz, children }: { titel: string; zusatz?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <section className={stil.abschnitt}>
      <h2>
        {titel}
        {zusatz !== undefined && <span>{zusatz}</span>}
      </h2>
      {children}
    </section>
  );
}
