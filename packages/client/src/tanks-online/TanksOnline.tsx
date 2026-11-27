import { useState } from 'react';
import { apiBase } from '../laufzeit';
import { WELTEN } from '../broremote/brotanks/welten';
import { useBroWache } from '../broremote/useBroWache';
import { useTanksNetz } from './useTanksNetz';
import { TanksBuehne } from './TanksBuehne';
import { TanksSteuerung } from './TanksSteuerung';
import './tanks-online.css';
export default function TanksOnline() {
  const netz = useTanksNetz(), s = netz.stand;
  const [name, setName] = useState(''), [code, setCode] = useState(new URLSearchParams(location.search).get('raum') ?? ''), [teilen, setTeilen] = useState(''), [ausstieg, setAusstieg] = useState(false);
  useBroWache(netz.aktiv);
  const linkTeilen = async (): Promise<void> => {
    if (!s) return;
    const url = `${apiBase || location.origin}/brotanks?raum=${s.code}`;
    try { if (navigator.share) await navigator.share({ title: 'BroTanks', text: 'Komm in meine BroTanks-Lobby!', url }); else { await navigator.clipboard.writeText(url); setTeilen('Einladungslink kopiert.'); } } catch { setTeilen(`Raumcode: ${s.code}`); }
  };
  const vollerBildschirm = (): void => { void document.documentElement.requestFullscreen?.().catch(() => {}); };
  const spiel = s?.sicht;
  if (s && spiel) return <main className="to-partie">
    <header className="to-status"><button aria-label="Spiel verlassen" onClick={() => setAusstieg(true)}>‹</button><strong>BroTanks</strong><span>{spiel.phase === 'ende' ? 'Runde beendet' : spiel.phase === 'countdown' ? `Start in ${Math.ceil(spiel.rest)}` : `${spiel.bros.find(b => b.id === spiel.amZug)?.name ?? ''} ${spiel.phase === 'zielen' ? 'zielt' : 'schießt'}`}</span><b>{spiel.phase === 'zielen' ? `${Math.ceil(spiel.rest)} s` : ''}</b><span className="to-netz">{netz.verbunden ? `${netz.ping ?? '…'} ms` : 'Verbinde …'}</span><button onClick={vollerBildschirm} aria-label="Vollbild öffnen">⛶</button></header>
    <TanksBuehne key={s.partie} sicht={spiel}/>
    {s.privat && <TanksSteuerung key={`${s.partie}-${s.ich}`} arti={s.privat} verbunden={netz.verbunden} senden={aktion => netz.senden({ art: 'eingabe', partie: s.partie, zug: s.privat?.zug, aktion })}/>}
    {!netz.verbunden && <div className="to-meldung" role="status">Verbindung wird wiederhergestellt. Deine Runde bleibt erhalten.</div>}
    {netz.fehler && <p className="to-fehler" role="alert">{netz.fehler}</p>}
    {spiel.phase === 'ende' && <div className="to-dialog"><section><h1>{spiel.gewinner.length ? `${spiel.bros.filter(b => spiel.gewinner.includes(b.id)).map(b => b.name).join(' & ')} gewinnt!` : 'Unentschieden'}</h1>{[...spiel.bros].sort((a,b) => a.platz-b.platz).map(b => <p key={b.id}>{b.platz}. {b.name} · {b.lp} ♥ · {b.schaden} Schaden</p>)}{s.host === s.ich ? <button onClick={() => netz.senden({ art: 'lobby' })}>Revanche vorbereiten</button> : <p>Warte auf die nächste Runde.</p>}<button onClick={netz.verlassen}>Lobby verlassen</button></section></div>}
    {ausstieg && <div className="to-dialog" role="dialog" aria-modal="true" aria-label="Partie verlassen"><section><h2>Partie wirklich verlassen?</h2><p>Dein Panzer scheidet aus.</p><button onClick={() => { setAusstieg(false); netz.verlassen(); }}>Verlassen</button><button autoFocus onClick={() => setAusstieg(false)}>Weiterspielen</button></section></div>}
    <div className="to-drehen" role="status"><span>↻</span><h2>Halte dein iPhone quer</h2><p>So siehst du die ganze Arena und hast Platz zum Zielen.</p><button onClick={() => setAusstieg(true)}>Zurück</button></div>
  </main>;
  return <main className="to-lobby"><header><a href="/?tab=spiele">‹ Spiele</a><h1>BroTanks</h1><p>Mit Freunden online · Jeder spielt auf seinem Gerät</p></header>
    <img className="to-titelbild" src="/broremote/ausbau/tanks.webp" alt="BroTanks Panzer"/>
    {netz.fehler && <p role="alert">{netz.fehler}</p>}
    {!s ? <section className="to-panel"><h2>Gemeinsam auf die Insel</h2><p>2–4 Spieler. Lobby öffnen, Link teilen und losspielen. Im Querformat mit Zoom und eigener Steuerung.</p><label>Dein Name<input maxLength={24} value={name} onChange={e => setName(e.target.value)} autoComplete="nickname"/></label><button disabled={netz.aktiv || !name.trim()} onClick={() => netz.starten({ art: 'oeffnen', name: name.trim() })}>Lobby öffnen</button><label>Raumcode<input value={code} maxLength={8} onChange={e => setCode(e.target.value.toUpperCase())} autoCapitalize="characters"/></label><button disabled={netz.aktiv || !name.trim() || !/^[A-F0-9]{8}$/.test(code)} onClick={() => netz.starten({ art: 'beitreten', code, name: name.trim() })}>Freunden beitreten</button>{netz.fortsetzen && !netz.aktiv && <button onClick={() => netz.starten({}, netz.fortsetzen)}>Zur laufenden Lobby zurück</button>}{netz.aktiv && <><p role="status">Verbindung wird aufgebaut …</p><button onClick={netz.verlassen}>Abbrechen</button></>}<a href="/broremote?spiel=brotanks">Mit BroRemote oder gegen Bots spielen ›</a></section> : <section className="to-panel"><h2>Deine Lobby · {s.code}</h2><button onClick={() => void linkTeilen()}>Freunde einladen</button><p role="status">{teilen}</p><ul>{s.spieler.map(b => <li key={b.id}><i style={{background:b.farbe}}/>{b.name}{b.id === s.ich ? ' (Du)' : ''}<span>{!b.verbunden ? 'Verbindung fehlt' : b.bereit ? 'Bereit ✓' : 'Wartet'}</span></li>)}</ul><div className="to-karten" aria-label="Karte wählen">{WELTEN.map((w,i) => <button key={w.name} disabled={s.host !== s.ich || !netz.verbunden} aria-pressed={s.optionen.karte === i} onClick={() => netz.senden({art:'karte',karte:i})}><img src={w.bild} alt=""/><strong>{w.name}</strong></button>)}</div><button disabled={!netz.verbunden} aria-pressed={s.spieler.find(b => b.id === s.ich)?.bereit} onClick={() => netz.senden({ art:'bereit', wert: !s.spieler.find(b => b.id === s.ich)?.bereit })}>{s.spieler.find(b => b.id === s.ich)?.bereit ? 'Noch nicht bereit' : 'Ich bin bereit'}</button>{s.host === s.ich && <button disabled={!netz.verbunden || s.spieler.length < 2 || !s.spieler.every(b => b.bereit && b.verbunden)} onClick={() => { vollerBildschirm(); netz.senden({art:'start'}); }}>Runde starten</button>}<button onClick={netz.verlassen}>Lobby verlassen</button></section>}
  </main>;
}
