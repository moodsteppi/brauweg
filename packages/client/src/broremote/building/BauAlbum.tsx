import { useEffect, useState } from 'react';
import { api } from '../../api';
import { MODI } from '@brauweg/building-kern';
import { chronikLesen, chronikSchreiben, bauAbzeichen, type BauEintrag } from './chronik';
export function BauAlbum(): React.JSX.Element {
  const [runden, setRunden] = useState(chronikLesen), [text, setText] = useState('Letzte Runden auf diesem Gerät'), [konto, setKonto] = useState(''), [beschaeftigt, setBeschaeftigt] = useState(false);
  useEffect(() => {
    let aktiv = true;
    void api.bauVerlauf().then(a => { if (!aktiv) return; setKonto(a.konto); setText(`Dein Konto · Heute noch ${a.restMuenzen} von 60 Münzen möglich`);
      const online = a.runden.map(r => ({ ...r, name: 'Du', konto: a.konto }));
      setRunden([...chronikLesen().filter(r => r.konto === a.konto && !online.some(o => o.partie === r.partie)), ...online].slice(0, 30));
    }).catch(() => undefined); return () => { aktiv = false; };
  }, []);
  const abzeichen = [...new Set(runden.flatMap(r => bauAbzeichen(r.ergebnis)))];
  return <section className="br-panel bb-album"><span className="br-kicker">DEIN BAUALBUM</span><h2>Türme, Siege & Erinnerungen</h2><p className="br-leise">{text}</p>
    <p className="bb-abzeichen">{abzeichen.map(a => <span key={a}>✦ {a}</span>)}</p>
    {!runden.length && <p>Dein erster Turm wartet. Beendete Runden und Abzeichen findest du hier.</p>}
    <ol>{runden.map(r => <li key={r.partie}><div><strong>{r.ergebnis.gewonnen ? '♛ Sieg' : `Platz ${r.ergebnis.platz}`} · {MODI[r.ergebnis.modus].name}</strong><small>{new Date(r.am).toLocaleDateString('de-DE')} · {r.name} · {r.ergebnis.hoehe.toFixed(1)} m</small></div><span>{r.muenzen !== undefined ? `+${r.muenzen} Münzen` : 'Lokal'}</span>
      {r.konto === konto && r.muenzen === undefined && <button className="br-link" disabled={beschaeftigt} onClick={() => { setBeschaeftigt(true); void api.bauErgebnis(r.partie, r.ergebnis).then(a => { const neu: BauEintrag = { ...r, muenzen: a.muenzen }; chronikSchreiben(neu); setRunden(v => v.map(x => x.partie === r.partie ? neu : x)); setText(`Gespeichert. +${a.muenzen} Münzen.`); }).catch(() => setText('Noch nicht synchronisiert. Bitte prüfe deine Verbindung und dein Konto.')).finally(() => setBeschaeftigt(false)); }}>Erneut synchronisieren</button>}
    </li>)}</ol>
    <p className="br-leise">5 Münzen pro Runde + 10 für einen Sieg, maximal 60 pro Tag (deutsche Zeit). Ab 15 Sekunden und 3 verbauten Teilen, bei Aufgabe keine Münzen. Ohne Online-Start bleiben Ergebnisse lokal.</p>
  </section>;
}
