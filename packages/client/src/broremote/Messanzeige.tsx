import { useEffect, useState } from 'react';
import { quantil, type Messung } from './messen';

const ms = (n: number): string => Number.isNaN(n) ? '–' : `${Math.round(n)}`;

/** Nur mit `?messen=1` sichtbar. Zeigt Median und 95 % je Abschnitt, live. */
export function Messanzeige({ messung, rolle }: { messung: Messung; rolle: 'gastgeber' | 'spieler' | null }): React.JSX.Element {
  const [, setStand] = useState(0);
  const [hinweis, setHinweis] = useState('');
  // Ein ruhiger Takt statt eines Renders je Eingabe: Die Anzeige soll die Messung nicht verfälschen.
  useEffect(() => { const t = setInterval(() => setStand(s => s + 1), 500); return () => clearInterval(t); }, []);
  const kopieren = (): void => {
    const text = messung.tabelle();
    console.log(text);
    void navigator.clipboard?.writeText(text).then(() => setHinweis('Tabelle kopiert.')).catch(() => setHinweis('In der Konsole ausgegeben.'));
  };
  return <aside className="br-messung" aria-label="Messung der Eingabeverzögerung">
    <strong>MESSUNG</strong>
    <span>Ping {ms(messung.uhr.rttMedian())} ms · {messung.uhr.abgeglichen() ? 'Uhr abgeglichen' : 'Uhrabgleich läuft'}</span>
    {rolle === 'spieler' && <span>{messung.gesendet.length} Eingaben gesendet</span>}
    {rolle === 'gastgeber' && <table><thead><tr><th>Abschnitt</th><th>n</th><th>Median</th><th>95 %</th></tr></thead>
      <tbody>{messung.abschnitte().map(a => <tr key={a.name}><td>{a.name}</td><td>{a.werte.length}</td><td>{ms(quantil(a.werte, .5))}</td><td>{ms(quantil(a.werte, .95))}</td></tr>)}</tbody></table>}
    {rolle === 'gastgeber' && <button type="button" className="br-link" onClick={kopieren}>Tabelle kopieren</button>}
    {hinweis && <small role="status">{hinweis}</small>}
  </aside>;
}
