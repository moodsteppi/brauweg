import { useEffect, useState } from 'react';

import stil from './BroChess.module.css';
import { uhrText } from './zeit';

/**
 * Eine Seite der Schachuhr.
 *
 * Die laufende Seite zählt von `laeuftBis` herunter (die `turnDeadline` des
 * Servers, siehe `schachuhr` in game-api), die stehende zeigt ihre Restzeit
 * aus der Sicht. Der Bildschirm rechnet dabei nichts nach: Wann die Zeit um
 * ist, entscheidet der Server, und bis dessen Nachricht kommt, steht hier
 * eben 0:00.0.
 *
 * Unter 20 Sekunden zehnmal je Sekunde, sonst viermal — öfter ändert sich
 * die Anzeige dort nicht, und jeder Takt kostet am Handy Akku.
 */
export function Uhr({
  restMs,
  laeuftBis,
  name,
}: {
  restMs: number;
  /** Ende des Kontos, wenn diese Seite gerade läuft; sonst null. */
  laeuftBis: number | null;
  /** Für die Vorleseausgabe: wessen Uhr. */
  name: string;
}): React.JSX.Element {
  const [, setTakt] = useState(0);
  const ms = laeuftBis !== null ? laeuftBis - Date.now() : restMs;
  const knapp = ms < 20_000;

  useEffect(() => {
    if (laeuftBis === null) return;
    const id = setInterval(() => setTakt((t) => t + 1), knapp ? 100 : 250);
    return () => clearInterval(id);
  }, [laeuftBis, knapp]);

  const klassen = [stil.uhr, laeuftBis !== null ? stil.uhrLaeuft : '', knapp ? stil.uhrKnapp : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={klassen} role="timer" aria-label={`Uhr ${name}: ${uhrText(ms)}`}>
      {uhrText(ms)}
    </span>
  );
}
