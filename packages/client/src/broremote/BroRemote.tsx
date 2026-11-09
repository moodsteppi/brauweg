import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { FORMEN, MODI, type BauModus } from '@brauweg/building-kern';
import { einladungLesen, einladungsLink, type Aktion, type Privat, type RaumSicht, type ServerNachricht, type Taste } from '@brauweg/broremote-kern';
import { apiBase } from '../laufzeit';
import { qrMatrix } from '../minispiele/partykiste/qr';
import { Controller } from './Controller';
import { Verbindung, hatLan, lanGastgeber, nativ, nativLauschen, type Kanal, type Status, type Zugang, type SitzungsEreignisse } from './transport';
import './broremote.css';
import { BauAlbum } from './building/BauAlbum';
import { BauWertung } from './building/BauWertung';
import { BauVorschau } from './building/BauVorschau';
import type { EingabeEmpfang } from './building/BauArena';
import './building/building.css';

const BauArena = lazy(() => import('./building/BauArena'));
const TRAININGSSPIELER = [{ id: 'training', name: 'Du', farbe: '#70dfc4', verbunden: true, bereit: true }];

const SPEICHER = 'brauweg.broremote.sitzung.v1';
type TestStand = { x: number; y: number; winkel: number; gefallen: number; tasten: Taste[]; wahl?: number; zahl?: number; bestaetigt?: boolean };
const leer = (): TestStand => ({ x: 0, y: 0, winkel: 0, gefallen: 0, tasten: [] });

export function BroRemote(): React.JSX.Element {
  const [spiel, setSpiel] = useState(!!window.location.hash);
  const [eintrag, setEintrag] = useState(window.location.hash ? `${apiBase || window.location.origin}/broremote${window.location.hash}` : '');
  const [nurBeitritt, setNurBeitritt] = useState(!!window.location.hash);
  const [name, setName] = useState('');
  const [fehler, setFehler] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [status, setStatus] = useState<Status>('beendet');
  const [sicht, setSicht] = useState<RaumSicht | null>(null);
  const [rolle, setRolle] = useState<'gastgeber' | 'spieler' | null>(null);
  const [spieler, setSpieler] = useState('');
  const [einladung, setEinladung] = useState('');
  const [privat, setPrivat] = useState<Privat | null>(null);
  const [art, setArt] = useState<'relay' | 'lan'>(hatLan() ? 'lan' : 'relay');
  const [adresse, setAdresse] = useState('');
  const [adressen, setAdressen] = useState<string[]>([]);
  const [zeit, setZeit] = useState(Date.now());
  const [training, setTraining] = useState<{ seed: number; modus: BauModus } | null>(null);
  const [trainingsmodus, setTrainingsmodus] = useState<BauModus>('rennen');
  const bauEingaben = useRef<EingabeEmpfang | null>(null);
  const [test, setTest] = useState<Record<string, TestStand>>({});
  const [gespeichert, setGespeichert] = useState<Zugang | null>(() => {
    try { const d = JSON.parse(sessionStorage.getItem(SPEICHER) ?? 'null'); return d?.schluessel && d?.raum ? d as Zugang : null; } catch { return null; }
  });
  const kanal = useRef<Kanal | null>(null), sichtRef = useRef<RaumSicht | null>(null), folge = useRef(0), lauf = useRef(0);
  const seite = useRef<HTMLElement>(null);
  useEffect(() => { seite.current?.scrollTo({ top: 0 }); }, [sicht?.phase, spiel]);
  const aktiv = status !== 'beendet';
  const senden = (n: Record<string, unknown>): void => {
    if (!kanal.current?.senden(n)) setFehler('Noch keine Verbindung. Bitte warte kurz.');
  };
  const vergessen = (): void => { try { sessionStorage.removeItem(SPEICHER); } catch { /* Privater Modus. */ } setGespeichert(null); };
  const schliessen = (): void => {
    kanal.current?.senden({ art: 'verlassen' }); lauf.current++; kanal.current?.schliessen(); kanal.current = null;
    setStatus('beendet'); setSicht(null); sichtRef.current = null; setPrivat(null); setRolle(null); setFehler(''); vergessen();
  };
  useEffect(() => {
    // Einladungsgeheimnisse gehören weder in Verlauf noch in spätere geteilte Adressen.
    const einladungUebernehmen = (): void => {
      if (!window.location.hash) return;
      const link = `${apiBase || window.location.origin}/broremote${window.location.hash}`;
      history.replaceState(null, '', '/broremote');
      if (kanal.current) {
        if (!window.confirm('Für diese Einladung die aktuelle Lobby verlassen?')) return;
        schliessen();
      }
      setSpiel(true); setNurBeitritt(true); setEintrag(link);
    };
    einladungUebernehmen();
    window.addEventListener('hashchange', einladungUebernehmen);
    const t = setInterval(() => setZeit(Date.now()), 1000);
    const aus = nativLauschen(e => { if (e.art === 'scan' && e.text) { setSpiel(true); setNurBeitritt(true); setEintrag(e.text); setFehler(''); } });
    return () => { lauf.current++; clearInterval(t); aus(); window.removeEventListener('hashchange', einladungUebernehmen); kanal.current?.schliessen(); };
  }, []);

  const starten = (z: Zugang, lokalHost = false): void => {
    kanal.current?.schliessen(); const generation = ++lauf.current;
    setFehler(''); setHinweis(''); setSicht(null); sichtRef.current = null; setPrivat(null); setTest({}); setSpiel(true);
    setRolle(z.rolle); setArt(z.transport); setAdresse(z.adresse); setAdressen([]); folge.current = 0;
    let ersterRaum = true;
    const e: SitzungsEreignisse = {
      status(s) { if (lauf.current === generation) { setStatus(s); if (s === 'verbunden') { setFehler(''); folge.current = 0; } } },
      fehler(t) { if (lauf.current === generation) setFehler(t); },
      merken(d) { if (lauf.current !== generation) return; try { sessionStorage.setItem(SPEICHER, JSON.stringify(d)); } catch { /* Sitzung funktioniert auch ohne Speicher. */ } setGespeichert(d); },
      nachricht(n: ServerNachricht) {
        if (lauf.current !== generation) return;
        if (n.art === 'willkommen') { setRolle(n.rolle); setSpieler(n.spieler ?? ''); if (n.einladung) setEinladung(n.einladung); }
        if (n.art === 'raum') {
          // Ein neu geladenes Gastgeberfenster besitzt die alte Physikwelt nicht.
          // Eine Netzunterbrechung im selben Fenster lässt sie dagegen bestehen.
          if (ersterRaum && z.rolle === 'gastgeber' && z.schluessel && n.sicht.phase === 'spiel') {
            ersterRaum = false; kanal.current?.senden({ art: 'lobby' });
            setHinweis('Die Gastgeberseite wurde neu geöffnet. Bitte startet gemeinsam eine neue Runde.'); return;
          }
          ersterRaum = false;
          if (sichtRef.current?.abschnitt !== n.sicht.abschnitt) { setPrivat(null); setTest({}); }
          sichtRef.current = n.sicht; setSicht(n.sicht);
        }
        if (n.art === 'einladung') setEinladung(n.einladung);
        if (n.art === 'privat' && n.abschnitt === sichtRef.current?.abschnitt) setPrivat(n.daten);
        if (n.art === 'fehler') setFehler(n.text);
        if (n.art === 'beendet') { setFehler(n.text); setStatus('beendet'); vergessen(); }
        if (n.art === 'eingabe' && sichtRef.current?.phase === 'spiel') {
          if (n.abschnitt === sichtRef.current.abschnitt) bauEingaben.current?.(n.spieler, n.aktion);
          return;
        }
        if (n.art === 'eingabe') setTest(alt => {
          const p = { ...(alt[n.spieler] ?? leer()) }, a = n.aktion;
          if (a.art === 'reset') { p.x = 0; p.y = 0; p.tasten = []; }
          if (a.art === 'steuerung') {
            p.x = a.x; p.y = a.y;
            if (a.tasten.includes('drehen') && !p.tasten.includes('drehen')) p.winkel += 90;
            if (a.tasten.includes('fallen') && !p.tasten.includes('fallen')) p.gefallen++;
            if (a.tasten.includes('bestaetigen') && !p.tasten.includes('bestaetigen')) p.bestaetigt = true;
            p.tasten = a.tasten;
          }
          if (a.art === 'wahl') { p.wahl = a.wert; p.bestaetigt = false; }
          if (a.art === 'zahl') p.zahl = a.wert;
          return { ...alt, [n.spieler]: p };
        });
      },
    };
    if (lokalHost) { vergessen(); kanal.current = lanGastgeber(e, a => { setAdresse(a[0]); setAdressen(a); }); }
    else kanal.current = new Verbindung(z, e);
  };
  const gastgeber = (): void => {
    const basis = apiBase || window.location.origin;
    starten({ transport: art, adresse: `${basis.replace(/^http/, 'ws')}/ws/broremote`, rolle: 'gastgeber' }, art === 'lan');
  };
  const beitreten = (): void => {
    const e = einladungLesen(eintrag);
    if (!e) { setFehler('Dieser Einladungslink ist ungültig oder abgelaufen. Bitte scanne den aktuellen QR-Code.'); return; }
    if (e.transport === 'lan' && !hatLan()) { setFehler('Eine lokale Lobby erreichst du über den QR-Scanner in der iOS-App.'); return; }
    if (!name.trim()) { setFehler('Trage zuerst deinen Spielernamen ein.'); return; }
    starten({ transport: e.transport, adresse: e.adresse, rolle: 'spieler', raum: e.raum, einladung: e.schluessel, name: name.trim() });
  };
  const eingabeSenden = (aktion: Aktion): void => {
    const s = sichtRef.current;
    if (s && status === 'verbunden' && s.gastgeberDa) kanal.current?.senden({ art: 'eingabe', abschnitt: s.abschnitt, folge: ++folge.current, aktion });
  };
  const link = sicht && rolle === 'gastgeber' && adresse && einladung ? einladungsLink({ transport: art, adresse, raum: sicht.raum, schluessel: einladung, bis: sicht.einladungBis }) : '';
  const verbunden = status === 'verbunden';
  const meiner = sicht?.spieler.find(s => s.id === spieler);
  const bereit = !!sicht?.spieler.length && sicht.spieler.every(s => s.bereit && s.verbunden);
  const abgelaufen = !!sicht && zeit >= sicht.einladungBis;

  return <main className={`br-seite${sicht?.phase === 'spiel' || training ? ' br-spielt' : ''}`} ref={seite}>
    <div className="br-inhalt">
      <header className="br-kopf"><a href="/" className="br-zurueck" aria-label="Zurück zur App" onClick={e => { if (aktiv && !window.confirm('BroRemote verlassen? Als Gastgeber beendest du damit die Lobby.')) e.preventDefault(); else if (aktiv) schliessen(); }}>‹</a>
        <a href="/broremote" onClick={e => { e.preventDefault(); if (!aktiv && !training) setSpiel(false); }} className="br-marke">Bro<span>Remote</span><small>Dein Handy. Euer Controller.</small></a>
        <span className="br-plakette">VORSCHAU</span>
      </header>
      {fehler && <div className="br-meldung" role="alert">{fehler}</div>}
      {hinweis && <p className="br-meldung" role="status">{hinweis}</p>}

      {!aktiv && !sicht && !spiel && !training && <>
        <section className="br-hero"><div><p className="br-kicker">ZUSAMMEN VOR EINEM BILDSCHIRM</p><h1>Großes Bild.<br /><em>Kleine Controller.</em></h1><p>Öffne eine Lobby, scanne den QR-Code und macht eure Handys zu Controllern.</p><div className="br-tags"><span>1 bis 4 Controller</span><span>Browser & iOS</span></div></div><Turm /></section>
        <h2>Wählt euer Spiel</h2>
        <button type="button" className="br-spielkarte" onClick={() => setSpiel(true)}><div className="br-spielmotiv"><Turm klein /></div><div><span className="br-kicker">BAUT HOCH. BLEIBT STANDFEST.</span><h2>Bro Building Battle</h2><p>Schwebende Inseln, wackelige Türme und eure Handys als Controller. Wer baut bis zu den Sternen?</p><strong>Jetzt spielen <span aria-hidden="true">↗</span></strong></div></button>
        <p className="br-leise">Zwei Spielmodi · 1 bis 4 Spieler · Gleiche Bauteile für alle</p><BauAlbum />
      </>}

      {!aktiv && !sicht && spiel && !training && <>
        <div className="br-spieltitel"><p className="br-kicker">BROREMOTE</p><h1>Bro Building Battle</h1><p>Ein Gastgeber-Bildschirm. Bis zu vier Handys. Eine gemeinsame Lobby.</p></div>
        <div className={nurBeitritt ? 'br-beitrittsformular' : 'br-zwei'}>
          {!nurBeitritt && <section className="br-panel"><span className="br-schritt">01</span><h2>Lobby eröffnen</h2><p>Dieses Gerät zeigt die Lobby und später das Spiel.</p>
            <div className="br-modus"><button type="button" aria-pressed={art === 'relay'} onClick={() => setArt('relay')}>Online</button><button type="button" aria-pressed={art === 'lan'} disabled={!hatLan()} onClick={() => setArt('lan')}>WLAN / Hotspot</button></div>
            <p className="br-leise">{art === 'lan' ? 'Alle Geräte im selben WLAN oder persönlichen Hotspot. Internet ist nicht nötig. Lass die Gastgeber-App geöffnet.' : 'Browser oder App als Gastgeber. Alle Geräte brauchen Internet. Die Verbindung ist verschlüsselt.'}</p>
            {!hatLan() && <p className="br-leise">Lokale Lobbys öffnest du in der iOS-App.</p>}
            <button type="button" className="br-knopf" onClick={gastgeber}>Lobby eröffnen <span>↗</span></button>
            <details className="bb-moduswahl"><summary>Erst allein ausprobieren</summary><p className="br-leise">Trainiere direkt auf diesem Gerät. Mit Tasten oder Touch, ohne Lobby.</p><div className="br-modus">{(['rennen', 'standfest'] as const).map(m => <button key={m} aria-pressed={trainingsmodus === m} onClick={() => setTrainingsmodus(m)}>{MODI[m].name}</button>)}</div><button className="br-knopf br-sekundaer" onClick={() => setTraining({ seed: crypto.getRandomValues(new Uint32Array(1))[0], modus: trainingsmodus })}>Solotraining starten</button></details>
          </section>}
          <section className="br-panel"><span className="br-schritt">DEIN HANDY ALS CONTROLLER</span><h2>{nurBeitritt ? 'Fast dabei.' : 'Als Controller beitreten'}</h2><p>{nurBeitritt ? 'Wähle deinen Spielernamen und verbinde dich mit der Lobby.' : 'Scanne den Code auf dem Gastgeber-Bildschirm.'}</p>
            {hatLan() && <button type="button" className="br-knopf br-sekundaer" onClick={() => nativ({ art: 'scannen' })}>QR-Code scannen</button>}
            <label className="br-feld">Dein Spielername<input autoComplete="nickname" maxLength={24} value={name} placeholder="Zum Beispiel Emil" onChange={e => setName(e.target.value)} /></label>
            <label className="br-feld">Einladungslink<input type="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={eintrag} placeholder="Link einfügen oder QR-Code scannen" onChange={e => setEintrag(e.target.value)} /></label>
            <button type="button" className="br-knopf br-sekundaer" disabled={!eintrag || !name.trim()} onClick={beitreten}>Verbinden</button>
            {nurBeitritt && <button type="button" className="br-link" onClick={() => setNurBeitritt(false)}>Zurück zur Auswahl</button>}
          </section>
        </div>
      </>}
      {!aktiv && !sicht && spiel && !training && <BauAlbum />}
      {!aktiv && !sicht && !training && gespeichert && <button type="button" className="br-knopf br-sekundaer br-fortsetzen" onClick={() => starten(gespeichert)}>Zur letzten Lobby zurück</button>}
      {training && <Suspense fallback={<p>Die Bauwelt wird geladen.</p>}><BauArena id={`training-${training.seed}`} seed={training.seed} modus={training.modus} spieler={TRAININGSSPIELER} verbunden eingaben={bauEingaben} privat={() => undefined} zurLobby={() => setTraining(null)} training /></Suspense>}

      {aktiv && !sicht && <section className="br-panel br-zentriert"><div className="br-signal" /><h1>Verbindung wird aufgebaut</h1><p>{art === 'lan' ? 'Erlaube den Zugriff auf dein lokales Netzwerk, wenn iOS danach fragt.' : 'Deine Lobby wird vorbereitet.'}</p><button type="button" className="br-link" onClick={schliessen}>Abbrechen</button></section>}

      {sicht && <>
        <div className="br-spieltitel"><p className="br-kicker">BRO BUILDING BATTLE</p><h1>{sicht.phase === 'lobby' ? 'Die Crew sammelt sich.' : sicht.phase === 'spiel' ? rolle === 'gastgeber' ? 'Auf die Türme. Fertig. Los.' : 'Dein Turm. Deine Kontrolle.' : 'Controller ausprobieren.'}</h1>
          <div className="br-tags"><span className={verbunden && sicht.gastgeberDa ? 'br-online' : ''}>{!sicht.gastgeberDa ? 'Warte auf Gastgeber' : status === 'wiederverbinden' ? 'Verbindung wird wiederhergestellt' : verbunden ? 'Verbunden' : 'Verbindung beendet'}</span><span>{art === 'lan' ? 'Lokales Netzwerk' : 'Online'} · {sicht.raum}</span></div>
        </div>
        {!verbunden && <p className="br-meldung">Die Steuerung pausiert, bis die Verbindung wieder steht.</p>}
        <div className={rolle === 'gastgeber' && sicht.phase === 'lobby' ? 'br-lobby' : ''}>
          {rolle === 'gastgeber' && sicht.phase === 'lobby' && <section className="br-panel br-einladung"><p className="br-kicker">HANDY VERBINDEN</p><h2>Scannen. Bereit. Los.</h2>
            {!sicht.gesperrt && !abgelaufen && verbunden ? <Qr text={link} /> : <div className="br-qr-pause">{abgelaufen ? 'Einladung abgelaufen' : 'Neue Beitritte gesperrt'}</div>}
            <p className="br-leise">{art === 'lan' ? 'In der iOS-App: BroRemote → Bro Building Battle → QR-Code scannen. Alle Geräte müssen im selben Netzwerk sein.' : 'Mit der Handykamera oder dem QR-Scanner in der iOS-App scannen.'}</p>
            {!abgelaufen && <p className="br-leise">Gültig für {Math.min(10, Math.max(0, Math.ceil((sicht.einladungBis - zeit) / 60_000)))} Minuten</p>}
            {adressen.length > 1 && <label className="br-feld">Netzwerkadresse<select value={adresse} onChange={e => setAdresse(e.target.value)}>{adressen.map(a => <option value={a} key={a}>{a.replace('ws://', '').replace('/broremote', '')}</option>)}</select></label>}
            <div className="br-aktionen"><button type="button" className="br-link" disabled={!verbunden || abgelaufen || sicht.gesperrt} onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => setHinweis('Einladungslink kopiert.')).catch(() => setHinweis('Markiere und kopiere den Link darunter.'));
            }}>Link kopieren</button><button type="button" className="br-link" disabled={!verbunden} onClick={() => senden({ art: 'einladen' })}>Neuer QR-Code</button></div>
            <details><summary>Einladungslink anzeigen</summary><input aria-label="Einladungslink zum Kopieren" readOnly value={link} onFocus={e => e.target.select()} /></details>
          </section>}
          {sicht.phase === 'lobby' && <section className="br-panel br-crew"><div className="br-zeile"><h2>{rolle === 'gastgeber' ? 'Deine Crew' : 'Eure Lobby'}</h2><span>{sicht.spieler.length}/4</span></div>
            <div className="br-plaetze">{Array.from({ length: 4 }, (_, i) => { const s = sicht.spieler[i]; return <div className={`br-platz${s ? ' belegt' : ''}`} key={s?.id ?? i} style={s ? { borderColor: `${s.farbe}66` } : undefined}>
              <div className="br-avatar" style={s ? { background: `${s.farbe}26` } : undefined}>{s ? <img src="/hub/pinguin/pinguin-basis.webp" alt="" /> : <span>+</span>}</div>
              <div><strong>{s ? `${s.name}${s.id === spieler ? ' (du)' : ''}` : `Platz ${i + 1}`}</strong><small>{s ? !s.verbunden ? 'Verbindung unterbrochen' : sicht.phase === 'test' ? 'Controller verbunden' : s.bereit ? 'Bereit ✓' : 'Noch nicht bereit' : 'Wartet auf einen Controller'}</small></div>
              {s && rolle === 'gastgeber' && <button type="button" className="br-entfernen" aria-label={`${s.name} entfernen`} disabled={!verbunden} onClick={() => { if (window.confirm(`${s.name} aus der Lobby entfernen?`)) senden({ art: 'entfernen', spieler: s.id }); }}>×</button>}
            </div>; })}</div>
            {rolle === 'gastgeber' && sicht.phase === 'lobby' && <>
              <div className="bb-moduswahl"><span className="br-kicker">EUER SPIELMODUS</span><div className="br-modus">{(['rennen', 'standfest'] as const).map(m => <button key={m} disabled={!verbunden} aria-pressed={(sicht.baumodus ?? 'rennen') === m} onClick={() => senden({ art: 'baumodus', modus: m })}>{MODI[m].name}</button>)}</div><p className="br-leise">{MODI[sicht.baumodus ?? 'rennen'].regel}</p></div>
              <label className="br-sperre"><input type="checkbox" checked={sicht.gesperrt} disabled={!verbunden} onChange={e => senden({ art: 'sperren', gesperrt: e.target.checked })} />Lobby für neue Spieler sperren</label>
              <button type="button" className="br-knopf" disabled={!bereit || !verbunden} onClick={() => senden({ art: 'spielen' })}>Battle starten</button>
              <p className="br-leise">{bereit ? 'Eure Crew ist bereit. Nach dem Countdown geht es los!' : 'Sobald mindestens ein Handy verbunden ist und alle bereit sind, kann es losgehen.'}</p>
              <button className="br-link" disabled={!bereit || !verbunden} onClick={() => senden({ art: 'starten' })}>Nur Verbindung prüfen</button>
            </>}
            {rolle === 'spieler' && sicht.phase === 'lobby' && <><p><strong>{MODI[sicht.baumodus ?? 'rennen'].name}</strong></p><p className="br-leise">{MODI[sicht.baumodus ?? 'rennen'].regel}</p><button type="button" className="br-knopf" disabled={!verbunden || !sicht.gastgeberDa} onClick={() => senden({ art: 'bereit', bereit: !meiner?.bereit })}>{meiner?.bereit ? 'Bereit ✓' : 'Ich bin bereit'}</button><p className="br-leise">Der Gastgeber startet, wenn alle bereit sind.</p></>}
          </section>}
        </div>
        {sicht.phase === 'spiel' && sicht.partie && rolle === 'gastgeber' && <Suspense fallback={<p>Die Bauwelt wird geladen.</p>}><BauArena key={sicht.partie.id} id={sicht.partie.id} seed={sicht.partie.seed} modus={sicht.partie.modus} spieler={sicht.spieler} verbunden={verbunden} eingaben={bauEingaben} privat={(id, daten) => { if (sichtRef.current?.phase === 'spiel') kanal.current?.senden({ art: 'privat', spieler: id, abschnitt: sichtRef.current.abschnitt, daten }); }} zurLobby={() => senden({ art: 'lobby' })} /></Suspense>}
        {sicht.phase === 'spiel' && rolle === 'spieler' && <section className="br-panel br-eigener-controller">
          <div className="br-zeile"><h2>{meiner?.name}</h2><span style={{ color: meiner?.farbe }}>{MODI[sicht.partie?.modus ?? 'rennen'].name}</span></div>
          {privat?.bau && <div className="bb-controllerstand"><div><small>{privat.bau.phase === 'ende' ? 'ERGEBNIS' : `PLATZ ${privat.bau.platz}`}</small><h3>{privat.bau.phase === 'ende' ? privat.bau.gewonnen ? 'Gewonnen!' : 'Gut gebaut.' : `${privat.bau.hoehe.toFixed(1).replace('.', ',')} Meter`}</h3><p>{privat.leben !== undefined ? `${'♥'.repeat(Math.min(3, privat.leben))}${'♡'.repeat(Math.max(0, 3 - privat.leben))} · ` : ''}{privat.bau.verbraucht} / 30 Teile</p></div><div><small>DANACH</small><BauVorschau form={FORMEN[privat.bau.form] ?? 'quadrat'} /></div></div>}
          {privat?.bau?.zielCountdown && privat.bau.phase !== 'ende' ? <div className="bb-controllerziel" role="status">Turm halten <strong>{privat.bau.zielCountdown}</strong><small>Bis zum Sieg gibt es keine neuen Teile.</small></div> : null}
          {sicht.partie && <BauWertung key={sicht.partie.id} partie={sicht.partie.id} modus={sicht.partie.modus} name={meiner?.name ?? 'Du'} ergebnis={privat?.bau?.phase === 'ende' ? { modus: sicht.partie.modus, hoehe: privat.bau.hoehe, gebaut: privat.bau.gebaut ?? 0, verloren: privat.bau.verloren ?? 0, leben: privat.leben ?? 3, platz: privat.bau.platz, gewonnen: privat.bau.gewonnen, aufgegeben: privat.bau.aufgegeben ?? false, dauer: privat.bau.dauer ?? 0, spielerzahl: Math.max(1, sicht.spieler.length) } : null} />}
          <p className="br-leise">{privat?.hinweis ?? 'Deine Bauwelt wird vorbereitet.'}</p>
          {verbunden && sicht.gastgeberDa && privat?.bau?.phase === 'spiel' && !privat.bau.fertig ? <Controller key={`bau-${sicht.abschnitt}`} layout="bauen" bau={privat.bau} gegner={sicht.spieler.filter(s => s.id !== spieler && s.verbunden && privat.bau?.ziele?.includes(s.id))} senden={eingabeSenden} /> : <p className="bb-controllerpause" role="status">{!verbunden || !sicht.gastgeberDa ? 'Verbindung wird wiederhergestellt …' : privat?.bau?.phase === 'countdown' ? `Bereit? ${privat.bau.countdown}` : privat?.bau?.phase === 'ende' ? 'Der Gastgeber kann eine Revanche vorbereiten.' : privat?.bau?.phase === 'pause' ? 'Das Spiel pausiert.' : privat?.bau?.fertig ? 'Schau den anderen beim Bauen zu.' : 'Gleich geht es los.'}</p>}
        </section>}
        {sicht.phase === 'test' && rolle === 'gastgeber' && <section className="br-panel">
          <div className="br-zeile"><h2>Verbindungstest</h2><span className="br-plakette">KEINE SPIELWERTUNG</span></div>
          <div className="br-modus"><button type="button" disabled={!verbunden} aria-pressed={sicht.layout === 'bauen'} onClick={() => senden({ art: 'layout', layout: 'bauen' })}>Bautasten</button><button type="button" disabled={!verbunden} aria-pressed={sicht.layout === 'auswahl'} onClick={() => senden({ art: 'layout', layout: 'auswahl' })}>Auswahl & Zahlen</button></div>
          <div className="br-testfelder">{sicht.spieler.map(s => { const p = test[s.id] ?? leer(); return <div className="br-testfeld" key={s.id} style={{ borderColor: s.farbe }}><strong>{s.name}</strong>
            {sicht.layout === 'bauen' ? <><div className="br-testflaeche"><div className="br-teststein" style={{ background: s.farbe, transform: `translate(${p.x * 45}px, ${p.y * 25}px) rotate(${p.winkel}deg)` }}>✦</div></div><span>Drehen: {p.winkel / 90} · Fallen: {p.gefallen}</span></> : <p>Auswahl: {p.wahl === undefined ? 'offen' : ['Stern', 'Blitz', 'Mond', 'Herz'][p.wahl]}<br />Zahl: {p.zahl ?? 'offen'}<br />{p.bestaetigt ? 'Bestätigt ✓' : 'Wartet auf Bestätigung'}</p>}
            <button type="button" className="br-link" disabled={!verbunden} onClick={() => senden({ art: 'privat', abschnitt: sicht.abschnitt, spieler: s.id, daten: { leben: 3, punkte: 42, hinweis: `Hallo ${s.name}! Diese Nachricht sieht nur dein Controller.`, inventar: ['Stern'], amZug: true } })}>Private Nachricht testen</button>
          </div>; })}</div>
          <button type="button" className="br-knopf br-sekundaer" disabled={!verbunden} onClick={() => senden({ art: 'lobby' })}>Zurück in die Lobby</button>
        </section>}
        {sicht.phase === 'test' && rolle === 'spieler' && <section className="br-panel br-eigener-controller"><div className="br-zeile"><h2>Dein Controller</h2><span style={{ color: meiner?.farbe }}>{meiner?.name}</span></div>
          {privat && <div className="br-privat"><small>NUR FÜR DICH</small><p>{privat.hinweis}</p><span>♥ {privat.leben ?? 0} · Punkte {privat.punkte ?? 0}{privat.amZug ? ' · Du bist dran' : ''}</span>{privat.inventar?.length ? <p>{privat.inventar.join(' · ')}</p> : null}</div>}
          {verbunden && sicht.gastgeberDa ? <Controller key={`${sicht.abschnitt}-${sicht.layout}`} layout={sicht.layout} senden={eingabeSenden} /> : <p>Warte auf die Verbindung zum Gastgeber.</p>}
        </section>}
        <button type="button" className="br-link br-verlassen" onClick={() => { if (!aktiv || window.confirm(rolle === 'gastgeber' ? 'Lobby für alle beenden?' : 'Lobby verlassen?')) schliessen(); }}>{rolle === 'gastgeber' ? 'Lobby beenden' : 'Lobby verlassen'}</button>
      </>}
      <footer className="br-fuss">BroRemote · Gemeinsam spielen, einfach verbinden.</footer>
    </div>
  </main>;
}

function Qr({ text }: { text: string }): React.JSX.Element | null {
  const matrix = useMemo(() => { try { return qrMatrix(text); } catch { return null; } }, [text]);
  if (!matrix) return <p>Bitte verwende den Einladungslink.</p>;
  const n = matrix.length;
  return <svg className="br-qr" viewBox={`0 0 ${n + 8} ${n + 8}`} role="img" aria-label="QR-Code zum Beitreten" shapeRendering="crispEdges"><rect width={n + 8} height={n + 8} fill="white" /><path fill="#101d38" d={matrix.flatMap((zeile, y) => zeile.flatMap((an, x) => an ? [`M${x + 4} ${y + 4}h1v1h-1z`] : [])).join('')} /></svg>;
}

function Turm({ klein = false }: { klein?: boolean }): React.JSX.Element {
  return <div className={`br-turm${klein ? ' klein' : ''}`} aria-hidden="true"><div className="br-orbit" /><div className="br-stern">✦</div><div className="br-bau b1" /><div className="br-bau b2" /><div className="br-bau b3" /><div className="br-bau b4" /><div className="br-bau b5" /><div className="br-insel" /><img src="/hub/pinguin/pinguin-basis.webp" alt="" /><div className="br-telefon">✣<span>● ●</span></div></div>;
}
