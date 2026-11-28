/**
 * Der Rahmen der Seiten vor dem Tisch: Kopf mit Zurueck, Inhalt, unten fest
 * der Hauptknopf in Daumenreichweite (DESIGN.md: „Eine Hand, ein Daumen").
 *
 * VOLLFLAECHIG (Robin, 27.11.2026: „Full screen … voll integriert, sonst wirkt
 * es wie ein Browser Game"): Ein Grund — Titelbild oder Schauplatz — liegt
 * hinter der ganzen Seite, von Rand zu Rand und unter die Safe Areas. Kopf,
 * Inhalt und Fuss liegen darueber, mit leichtem Verlauf ins Dunkle, damit die
 * Schrift lesbar bleibt; nur der Inhalt ist auf Handybreite begrenzt, nie der
 * Grund. Die Safe Areas der iOS-Huelle kommen ueber `env()`.
 */

import type { ReactNode } from 'react';

import { Schauplatzgrund } from './Feld';
import stil from './neu.module.css';

export function Seite({
  titel,
  unter,
  zurueckText,
  onZurueck,
  kopfbild,
  grund,
  children,
  fuss,
}: {
  titel: string;
  unter?: string;
  zurueckText: string;
  onZurueck: () => void;
  /** Was ueber dem Titel Platz braucht (der Einstieg laesst so seine Figuren frei). */
  kopfbild?: ReactNode;
  /** Der vollflaechige Grund. Ohne Angabe der Burghof — ein Schauplatz des Spiels. */
  grund?: ReactNode;
  children: ReactNode;
  fuss?: ReactNode;
}): React.JSX.Element {
  return (
    <main className={stil.seite}>
      {grund ?? <Schauplatzgrund schauplatz="burghof" />}
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
