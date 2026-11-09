import { useEffect, useRef, useState } from 'react';
import type { BauErgebnis, BauModus } from '@brauweg/building-kern';
import { BauBuch, bauAbzeichen } from './chronik';
export function BauWertung({ partie, modus, name, ergebnis }: { partie: string; modus: BauModus; name: string; ergebnis: BauErgebnis | null }): React.JSX.Element | null {
  const buch = useRef<BauBuch | null>(null), gemeldet = useRef(false);
  const [text, setText] = useState('Ergebnis wird gespeichert …');
  useEffect(() => { buch.current = new BauBuch(partie, modus); }, [partie, modus]);
  useEffect(() => {
    if (!ergebnis || !buch.current || gemeldet.current) return;
    gemeldet.current = true; void buch.current.speichern(ergebnis, name).then(setText);
  }, [ergebnis, name]);
  if (!ergebnis) return null;
  return <div className="bb-belohnung" role="status"><p className="bb-abzeichen">{bauAbzeichen(ergebnis).map(a => <span key={a}>✦ {a}</span>)}</p><p>{text}</p></div>;
}
