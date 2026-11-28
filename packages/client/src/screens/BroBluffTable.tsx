import { useEffect } from 'react';
import type { Sicht, Aktion } from '@brauweg/game-brobluff';
import { useTable } from '../useTable';
import { TurnClock, Wartebereich } from '../tisch';
import { Ladekreis } from '../Ladekreis';
import { spiele } from '../klang';
import { Brett } from '../minispiele/brobluff/Brett';
import './hub-neu.css';
import './spiel-einstieg.css';

export function BroBluffTable({ tableId, onLeave, onNeu }: { tableId: string; onLeave: () => void; onNeu?: () => void }) {
  const { view, table, error, connected, send, addBot, removeBot, setBotLevel } = useTable<Sicht>(tableId, 'brobluff');
  const nummer = view?.view.aufdeckung?.nummer;
  const sieger = view?.view.sieger;
  useEffect(() => { if (nummer) spiele('karte-legen'); }, [nummer]);
  useEffect(() => { if (sieger !== null && sieger !== undefined) spiele(sieger === view?.view.meinSitz ? 'sieg' : 'niederlage'); }, [sieger]);
  if (!view && table?.status === 'waiting') return <Wartebereich tableId={tableId} table={table} error={error} spielerName={text=><span>{text}</span>} addBot={addBot} removeBot={removeBot} setBotLevel={setBotLevel} onLeave={onLeave}/>;
  const name = (sitz: number) => sitz === view?.view.meinSitz ? 'Du' : table?.seats.find(s=>s.seat===sitz)?.displayName ?? `Pinguin ${sitz+1}`;
  return <main className="bf-app"><header className="bf-kopf"><button onClick={onLeave} aria-label="Zur Spielauswahl">‹</button><div><h1>Bro Bluff</h1><small>Verdeckte Karten. Offene Zweifel.</small></div>{view && <TurnClock deadline={view.turnDeadline}/>}</header>{view ? <Brett sicht={view.view} legal={view.legalActions as unknown as Aktion[]} name={name} onZug={send} verbunden={connected} fehler={error} onNeu={onNeu}/> : <Ladekreis text={error??'Verbinde mit dem Tisch…'}/>}</main>;
}
