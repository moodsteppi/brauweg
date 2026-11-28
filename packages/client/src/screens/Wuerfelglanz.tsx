import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Aktion, Kategorie, Sicht } from '@brauweg/game-wuerfelglanz';
import { api, ApiError, type GameDefaults } from '../api';
import { SuchWarten } from '../spielarten/SpielartKarten';
import { useSchnellsuche } from '../spielarten/useSchnellsuche';
import { t } from '../i18n';
import { spiele } from '../klang';
import { useTable } from '../useTable';
import { useRueckfrage } from './HbBlatt';
import { EinstiegEcke } from './EinstiegEcke';
import './hub-neu.css';
import './spiel-einstieg.css';
import './wuerfelglanz.css';

const AUGEN = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const DREHUNG: Record<number, [number, number]> = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
export function Wuerfel({ wert, gehalten = false, rollt = false, disabled = false, index, onHalten }: {
  wert: number; gehalten?: boolean; rollt?: boolean; disabled?: boolean; index: number; onHalten?: () => void;
}) {
  const [x, y] = DREHUNG[wert || 1]!;
  return <button className={`wg-wuerfel${gehalten ? ' ist-gehalten' : ''}${rollt && !gehalten ? ' rollt' : ''}`} aria-label={`Würfel ${index + 1}: ${wert || 'noch nicht gewürfelt'}`} aria-pressed={gehalten} disabled={disabled} onClick={onHalten}>
    <span className="wg-perspektive"><span className="wg-wuerfelkoerper" style={{ transform: `rotateX(${x}deg) rotateY(${y}deg)` }}>
      {[1, 2, 3, 4, 5, 6].map(seite => <span key={seite} className={`wg-seite s-${seite}`} aria-hidden="true">{Array.from({ length: 9 }, (_, punkt) => <i key={punkt} className={AUGEN[seite]!.includes(punkt) ? 'punkt' : ''} />)}</span>)}
    </span></span><span className="wg-halten">{gehalten ? 'Gehalten ✓' : wert ? 'Halten' : 'Bereit'}</span>
  </button>;
}
/** Vor jedem ersten Wurf bleiben die Würfel vollständig unter dem Becher. */
function Wuerfelbecher() {
  const id = useId();
  return <div className="wg-becher" role="img" aria-label="Würfelbecher mit fünf verdeckten Würfeln">
    <svg viewBox="0 0 180 132" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-leder`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#361b21" /><stop offset=".3" stopColor="#995340" /><stop offset=".55" stopColor="#754035" /><stop offset="1" stopColor="#2d1922" /></linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff0ad" /><stop offset=".45" stopColor="#d5a44c" /><stop offset="1" stopColor="#80501f" /></linearGradient>
      </defs>
      <ellipse cx="90" cy="119" rx="70" ry="10" fill="#031b18" opacity=".6" />
      <path d="M53 25 Q90 12 127 25 L148 110 Q90 132 32 110 Z" fill={`url(#${id}-leder)`} stroke="#b38248" strokeWidth="2" />
      <path d="M58 35 L43 104 M122 35 L137 104" fill="none" stroke="#e1b875" strokeWidth="1.5" strokeDasharray="3 4" opacity=".65" />
      <ellipse cx="90" cy="25" rx="37" ry="11" fill={`url(#${id}-gold)`} />
      <ellipse cx="90" cy="23" rx="31" ry="6" fill="#754337" stroke="#e6c17b" />
      <path d="M33 102 Q90 122 147 102 L149 112 Q90 135 31 112 Z" fill={`url(#${id}-gold)`} stroke="#a16e2f" />
      <path d="m90 48 5 17 17 5-17 5-5 17-5-17-17-5 17-5Z" fill={`url(#${id}-gold)`} stroke="#f9d78a" strokeWidth=".7" />
      <path d="M90 53 V87 M75 70 H105" stroke="#fff2b1" opacity=".5" />
    </svg>
    <span>5 Würfel im Becher</span>
  </div>;
}
/** Im Menü stehen statt des Sterns Herz und Übersicht (EinstiegEcke.tsx), am Tisch bleibt der Stern. */
function Kopf({ onBack, unter = 'FÜNF WÜRFEL. DEIN MOMENT.', ecke = false }: { onBack: () => void; unter?: string; ecke?: boolean }) {
  return <header className="wg-kopf"><button className="wg-zurueck" onClick={onBack} aria-label="Zurück"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg></button><div><small>{unter}</small><h1>Würfelglanz</h1></div>{ecke ? <span className="wg-ecke"><EinstiegEcke spiel="wuerfelglanz" /></span> : <span className="wg-stern" aria-hidden="true">✦</span>}</header>;
}
export function Wuerfelglanz({ startTisch = null, onBack, kontoId }: { startTisch?: string | null; onBack: () => void; kontoId?: string }) {
  const [tischId, setTischId] = useState(startTisch);
  useEffect(() => { if (startTisch) setTischId(startTisch); }, [startTisch]);
  if (tischId) return <NetzPartie tableId={tischId} kontoId={kontoId} onBack={() => { setTischId(null); }} />;
  return <WuerfelglanzMenue onBack={onBack} onTisch={setTischId} />;
}
export function WuerfelglanzMenue({ onBack, onTisch }: { onBack: () => void; onTisch: (id: string) => void }) {
  const [sitze, setSitze] = useState(0), [busy, setBusy] = useState(false);
  const [vorgabe, setVorgabe] = useState<GameDefaults | null>(null);
  const [fehler, setFehler] = useState<string | null>(null), [code, setCode] = useState('');
  const [rekord, setRekord] = useState<number | null>(null);
  const sperre = useRef(false);
  /* Seit dem 28.11.2026 Quick-Play ueber die Schlange statt der Liste offener
     Tische (Robin: Tischlisten verwirren). Freie Plaetze fuellen Bots. */
  const suche = useSchnellsuche('wuerfelglanz', onTisch);
  const holeVorgabe = useCallback(() => { void api.defaults('wuerfelglanz').then(d => { setVorgabe(d); setSitze(d.seatCounts.find(n => n > 1) ?? 0); setFehler(null); }).catch(() => setFehler('Würfelglanz ist gerade nicht erreichbar. Bitte versuche es erneut.')); }, []);
  useEffect(() => { holeVorgabe(); void api.eigeneBestleistungen('wuerfelglanz').then(l => setRekord(l.find(e => e.inhaltId === 'klassisch')?.wert ?? null)).catch(() => {}); }, [holeVorgabe]);
  const aktion = async (f: () => Promise<string>) => {
    if (sperre.current) return; sperre.current = true; setBusy(true); setFehler(null);
    try { onTisch(await f()); } catch (e) { setFehler(e instanceof ApiError ? t(e.messageKey) : 'Der Tisch ließ sich nicht öffnen. Bitte versuche es erneut.'); }
    finally { sperre.current = false; setBusy(false); }
  };
  const erstellen = (anzahl: number) => void aktion(async () => {
    const runden = vorgabe?.rounds[anzahl]?.[0];
    if (runden === undefined || !vorgabe?.seatCounts.includes(anzahl)) throw new Error('Spielvorgabe fehlt');
    return (await api.createTable({ gameId: 'wuerfelglanz', seats: anzahl, rounds: runden, visibility: anzahl === 1 ? 'on_request' : 'public' })).id;
  });
  if (suche.suchstand) return <SuchWarten gameId="wuerfelglanz" stand={suche.suchstand} unter="Würfelglanz" onAbbrechen={suche.brichAb} />;
  /*
   * Kompakt seit dem 28.11.2026 abends (Robin: „möglichst wenig Klicks ins
   * Spiel", der Einstieg soll ohne Rollen passen): Quick-Play zuerst und in
   * Gold, „Allein spielen" direkt darunter, die Freundesrunde als eine Karte
   * mit Sitzwahl. Der Code und die Regeln sind zugeklappt — beides braucht
   * man selten, und offen schoben sie das Menü über den Bildschirm hinaus.
   */
  return <main className="spe wg wg-menue"><Kopf onBack={onBack} ecke /><div className="wg-rolle">
    <section className="wg-held wg-held-kompakt"><img src="/hub/banner-wuerfelglanz.webp" alt="Zwei Pinguine würfeln an einem gemütlichen Spieltisch" /><div><span className="wg-etikett">5 WÜRFEL · 3 WÜRFE JE ZUG · 13 WERTUNGEN</span></div></section>
    {fehler && <p className="wg-fehler" role="alert">{fehler} {!vorgabe && <button onClick={holeVorgabe}>Erneut laden</button>}</p>}
    {suche.fehler && <p className="wg-fehler" role="alert">{t(suche.fehler)}</p>}
    <div className="wg-schnell">
      <button className="wg-gold" data-einstieg="quickplay" disabled={busy || suche.startet} onClick={() => void suche.starte(undefined)}>{t('einstieg.quickplay')}</button>
      <button className="wg-zweit" disabled={busy || !vorgabe?.seatCounts.includes(1)} onClick={() => erstellen(1)}>{busy ? 'Tisch wird vorbereitet…' : 'Allein spielen'}</button>
      <small>{rekord === null ? 'Allein spielst du um deine Bestleistung.' : `Deine Bestleistung: ${rekord} Punkte`}</small>
    </div>
    <section className="wg-modus wg-freunde"><h2>Mit Freunden</h2><div className="wg-sitzwahl" role="group" aria-label="Spielerzahl">{(vorgabe?.seatCounts.filter(n => n > 1) ?? []).map(n => <button key={n} aria-pressed={sitze === n} onClick={() => setSitze(n)}>{n}</button>)}</div><button className="wg-gold" disabled={busy || !vorgabe || sitze === 0} onClick={() => erstellen(sitze)}>Offenen Tisch für {sitze} erstellen</button><small>Teile danach den Tischcode mit deinen Freunden.</small></section>
    <details className="wg-regeln wg-code-klappe"><summary>Du hast einen Tischcode?</summary><form className="wg-code" onSubmit={e => { e.preventDefault(); void aktion(async () => { const v = await api.tischPerCode(code.trim().toUpperCase()); if (v.gameId !== 'wuerfelglanz') throw new Error('Anderes Spiel'); const res = await api.beitretenPerCode(code.trim().toUpperCase()); if (res.angefragt) throw new Error('Tisch wartet auf Zusage'); return res.tableId; }); }}><label htmlFor="wg-code" className="wg-unsichtbar">Tischcode</label><div><input id="wg-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" placeholder="Tischcode" maxLength={10} /><button disabled={busy || code.trim().length < 4}>Beitreten</button></div></form></details>
    <details className="wg-regeln"><summary>So spielst du Würfelglanz</summary><p>Du hast pro Zug höchstens drei Würfe. Tippe auf Würfel, die du behalten möchtest. Mit einem weiteren Tipp gibst du sie wieder frei.</p><p>Trage danach genau ein freies Feld ein. Auch null Punkte sind erlaubt, ein belegtes Feld bleibt fest. Nach 13 Einträgen ist dein Bogen fertig.</p><p>Ab 63 Punkten bei Einsern bis Sechsern erhältst du 35 Bonuspunkte. Die meisten Gesamtpunkte gewinnen. Ein Fünferglanz bringt 50 Punkte; zusätzliche Joker- oder Wiederholungsboni gibt es in dieser Spielart nicht.</p><p>Solo spielst du um deine Bestleistung. Online würfelt ihr reihum; gleiche Punktzahlen teilen sich den Platz.</p></details>
  </div></main>;
}
function NetzPartie({ tableId, onBack, kontoId }: { tableId: string; onBack: () => void; kontoId?: string }) {
  const netz = useTable<Sicht>(tableId, 'wuerfelglanz');
  const [code, setCode] = useState<string | null>(null), [kopiert, setKopiert] = useState(false), [busy, setBusy] = useState(false);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);
  const teilen = async () => {
    if (!code) return; setAktionFehler(null);
    if (navigator.share) { try { await navigator.share({ title: 'Würfelglanz', text: `Komm an meinen Würfelglanz-Tisch in der Brauweg-App. Tischcode: ${code}` }); return; } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; } }
    try { if (!navigator.clipboard) throw new Error('Zwischenablage fehlt'); await navigator.clipboard.writeText(code); setKopiert(true); }
    catch { setAktionFehler('Teile deinen Freunden den angezeigten Tischcode mit. Sie geben ihn im Würfelglanz-Menü ein.'); }
  };
  const gehe = () => { void api.leaveTable(tableId).then(onBack).catch(() => setAktionFehler('Die Runde ließ sich nicht verlassen. Prüfe die Verbindung und versuche es erneut.')); };
  const [fragen, rueckfrage] = useRueckfrage();
  useEffect(() => { void api.tischMitCode(tableId).then(t => setCode(t.table.joinCode)).catch(() => {}); }, [tableId]);
  useEffect(() => { setBusy(false); }, [netz.view?.revision, netz.error, netz.connected]);
  const verlassen = () => {
    if (netz.view?.finished || netz.table?.status === 'waiting') { gehe(); return; }
    fragen({ titel: 'Die Runde verlassen?', text: 'Dein Platz wird als verlassen gewertet. Du kannst die laufende Runde auch geöffnet lassen und später zurückkehren.', ja: 'Runde verlassen' }, gehe);
  };
  const senden = (a: Aktion) => { if (busy || !netz.connected) return; setBusy(true); netz.send(a); };
  if (!netz.view) return <main className="spe wg"><Kopf onBack={verlassen} unter="DEIN WÜRFELTISCH" /><div className="wg-rolle">
    <img className="wg-wartebild" src="/hub/banner-wuerfelglanz.webp" alt="Pinguine am Würfeltisch" />
    {netz.table?.status === 'waiting' ? <section className="wg-warten"><h2>Die Runde sammelt sich</h2><p>Der Tisch startet, wenn alle Plätze belegt sind.</p>{code && <button className="wg-einladung" onClick={() => void teilen()}><small>TISCHCODE {kopiert ? 'KOPIERT ✓' : 'TEILEN ODER KOPIEREN'}</small><strong>{code}</strong></button>}
      {netz.table.seats.map(s => <div key={s.seat} className="wg-warteplatz"><span className={s.accountId || s.isBot ? 'ist-da' : ''} /> <strong>{s.displayName ?? (s.isBot ? 'Würfel-Bot' : 'Freier Platz')}</strong>{netz.table?.seats[0]?.accountId === kontoId && !s.accountId && <button onClick={() => s.isBot ? netz.removeBot(s.seat) : netz.addBot(s.seat)}>{s.isBot ? 'Entfernen' : 'Mit Bot füllen'}</button>}</div>)}
      {netz.table.seats[0]?.accountId === kontoId && <button className="wg-gold" disabled={!netz.connected} onClick={() => netz.startNow()}>Mit den Anwesenden starten</button>}
    </section> : <p role="status">{netz.error ?? 'Dein Würfeltisch wird verbunden…'}</p>}{(netz.error || aktionFehler) && <p role="alert" className="wg-fehler">{aktionFehler ?? netz.error}</p>}<button className="wg-link" onClick={netz.reconnect}>Neu verbinden</button>
  </div>{rueckfrage}</main>;
  return <><WuerfelglanzPartie sicht={netz.view.view} namen={netz.table?.seats.map(s => s.displayName ?? (s.isBot ? 'Würfel-Bot' : `Spieler ${s.seat + 1}`)) ?? []} aktionen={netz.view.legalActions as unknown as Aktion[]} verbunden={netz.connected} busy={busy} fehler={aktionFehler ?? netz.error} onAktion={senden} onBack={verlassen} onNeuVerbinden={netz.reconnect} />{rueckfrage}</>;
}
export function WuerfelglanzPartie({ sicht: s, namen, aktionen, verbunden = true, busy = false, fehler = null, onAktion, onBack, onNeuVerbinden }: {
  sicht: Sicht; namen: string[]; aktionen: Aktion[]; verbunden?: boolean; busy?: boolean; fehler?: string | null;
  onAktion: (a: Aktion) => void; onBack: () => void; onNeuVerbinden?: () => void;
}) {
  const [bogen, setBogen] = useState(s.ich ?? s.amZug), [wahl, setWahl] = useState<Kategorie | null>(null), [rollt, setRollt] = useState(false);
  const [fragen, rueckfrage] = useRueckfrage();
  const vorher = useRef(`${s.zug}:${s.wurf}`);
  useEffect(() => { setWahl(null); }, [s.zug, s.wurf, bogen]);
  useEffect(() => {
    const key = `${s.zug}:${s.wurf}`; if (vorher.current === key) return; vorher.current = key;
    if (s.wurf === 0) { setRollt(false); return; }
    setRollt(true); spiele('mischen', .4); const timer = setTimeout(() => setRollt(false), 660); return () => clearTimeout(timer);
  }, [s.zug, s.wurf]);
  useEffect(() => { if (s.fertig) spiele('runde-ende'); }, [s.fertig]);
  const name = (i: number) => i === s.ich ? 'Du' : namen[i] ?? `Spieler ${i + 1}`;
  const dran = !s.fertig && s.ich !== null && s.ich === s.amZug;
  const gesperrt = busy || rollt || !verbunden;
  const darfWurf = aktionen.some(a => a.art === 'wuerfeln');
  const darfEintragen = (k: Kategorie) => aktionen.some(a => a.art === 'eintragen' && a.kategorie === k);
  const bestaetigen = () => {
    if (!wahl || !darfEintragen(wahl) || gesperrt) return;
    const a: Aktion = { art: 'eintragen', kategorie: wahl };
    if (s.moeglich[wahl] === 0) fragen({ titel: 'Dieses Feld streichen?', text: `${s.kategorien.find(k => k.id === wahl)?.name} wird mit 0 Punkten eingetragen. Das kannst du nicht rückgängig machen.`, ja: 'Mit 0 Punkten eintragen' }, () => onAktion(a));
    else { spiele('stich-ein', .55); onAktion(a); }
  };
  const eigenerStand = s.staende[s.ich ?? bogen]!;
  const platz = 1 + s.staende.filter((v, i) => !s.verlassen.includes(i) && v.gesamt > eigenerStand.gesamt).length;
  return <main className="spe wg wg-spiel"><Kopf onBack={onBack} unter={s.sitze === 1 ? 'DEIN SOLO-MOMENT' : `${s.sitze} SPIELER · RUNDE ${Math.min(13, Math.floor(s.zug / s.sitze) + 1)} VON 13`} /><div className="wg-rolle">
    {!verbunden && <p role="status" className="wg-fehler">Verbindung wird wiederhergestellt. Dein Bogen bleibt gespeichert. <button onClick={onNeuVerbinden}>Neu verbinden</button></p>}{fehler && <p role="alert" className="wg-fehler">{fehler}</p>}
    {s.fertig && <section className="wg-ergebnis"><span>✦</span><small>PARTIE BEENDET</small><h2>{s.ich === null ? 'Die Würfel sind gefallen' : s.sitze === 1 ? 'Dein Bogen glänzt' : s.verlassen.includes(s.ich) ? 'Runde verlassen' : platz === 1 ? 'Ganz vorne mit dabei!' : `Platz ${platz} für dich`}</h2><strong>{eigenerStand.gesamt}<small>Punkte{eigenerStand.bonus ? ' · inklusive 35 Bonuspunkten' : ''}</small></strong><button className="wg-gold" onClick={onBack}>Zurück zu Würfelglanz</button></section>}
    {!s.fertig && <><div className="wg-zugstatus" role="status"><span className={dran ? 'wg-leuchtet' : ''} />{dran ? 'Du bist am Zug' : `${name(s.amZug)} würfelt`}<b>Wurf {s.wurf}/3</b></div>
      <section className="wg-wuerfeltablett" aria-label="Deine fünf Würfel">{s.wurf === 0 ? <Wuerfelbecher /> : <div className="wg-wuerfelreihe">{s.wuerfel.map((wert, index) => <Wuerfel key={index} wert={wert} index={index} gehalten={s.gehalten[index]} rollt={rollt} disabled={!dran || gesperrt || !aktionen.some(a => a.art === 'halten' && a.index === index)} onHalten={() => { spiele('tipp'); onAktion({ art: 'halten', index }); }} />)}</div>}
        <p>{!dran ? `${name(s.amZug)} ist am Zug. Du kannst die Bögen ansehen.` : s.wurf === 0 ? 'Dein erster Wurf wartet auf dich.' : s.wuerfel.every(w => w === s.wuerfel[0]) ? '✦ Fünferglanz! Fünf gleiche Würfel.' : s.wurf < 3 ? 'Tippe auf die Würfel, die du behalten möchtest.' : 'Drei Würfe geschafft. Wähle dein Wertungsfeld.'}</p>
        <button className="wg-gold wg-wurfknopf" disabled={!dran || gesperrt || !darfWurf} onClick={() => onAktion({ art: 'wuerfeln' })}>{busy ? 'Wird bestätigt…' : rollt ? 'Die Würfel rollen…' : !dran ? 'Mitspieler am Zug' : s.wurf === 0 ? 'Würfeln' : s.wurf >= 3 ? 'Jetzt Punkte eintragen' : s.gehalten.every(Boolean) ? 'Alle Würfel gehalten' : `Noch einmal würfeln · ${3 - s.wurf} übrig`}</button>
      </section></>}
    <div className="wg-boegen" role="tablist" aria-label="Wertungsbögen">{s.staende.map((stand, i) => <button role="tab" aria-selected={bogen === i} key={i} onClick={() => setBogen(i)} className={`${bogen === i ? 'ist-gewaehlt' : ''}${s.amZug === i && !s.fertig ? ' ist-am-zug' : ''}`}><span>{name(i)}{s.verlassen.includes(i) ? ' · verlassen' : ''}</span><b>{stand.gesamt}</b></button>)}</div>
    <section className="wg-wertungsbogen"><header><h2>{bogen === s.ich ? 'Dein Wertungsbogen' : `Wertungsbogen · ${name(bogen)}`}</h2><small>{s.staende[bogen]!.felder}/13 Felder</small></header>
      {s.kategorien.map((k, i) => <div key={k.id}>{i === 6 && <div className="wg-bonus"><span>Zahlenbonus <b>{s.staende[bogen]!.oben}/63</b></span><strong>{s.staende[bogen]!.bonus ? '+35 ✓' : '+35 Punkte'}</strong><i style={{ width: `${Math.min(100, s.staende[bogen]!.oben / 63 * 100)}%` }} /></div>}<button className={`wg-wertungszeile${wahl === k.id ? ' ist-vorgemerkt' : ''}${s.boegen[bogen]![k.id] !== undefined ? ' ist-fest' : ''}`} disabled={bogen !== s.ich || !dran || gesperrt || !darfEintragen(k.id)} aria-pressed={wahl === k.id} aria-label={`${k.name}: ${k.hinweis}`} onClick={() => setWahl(k.id)}><span><strong>{k.name}</strong><small>{k.hinweis}</small></span><b>{s.boegen[bogen]![k.id] ?? (bogen === s.ich && dran && s.wurf > 0 ? `+${s.moeglich[k.id] ?? 0}` : '·')}</b></button></div>)}
      <footer>Gesamt <strong>{s.staende[bogen]!.gesamt}<small>Punkte</small></strong></footer>
    </section>

    {s.fertig && <p className="wg-abschluss">{s.sitze === 1 ? 'Vollständige Bögen zählen für deine persönliche Bestleistung.' : 'Gleiche Punktzahlen teilen sich den Platz.'}</p>}
  </div>
    {dran && !s.fertig && bogen === s.ich && <div className="wg-eintragen"><span>{wahl ? s.kategorien.find(k => k.id === wahl)?.name : 'Wähle ein freies Feld im Bogen'}</span><button className="wg-gold" disabled={!wahl || gesperrt || !darfEintragen(wahl)} onClick={bestaetigen}>{wahl ? `${s.moeglich[wahl] ?? 0} Punkte eintragen` : 'Feld auswählen'}</button></div>}
  {rueckfrage}</main>;
}
