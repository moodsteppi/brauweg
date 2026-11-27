import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TanksPartie } from '../broremote/brotanks/partie';
import { TanksSteuerung } from './TanksSteuerung';
afterEach(() => { cleanup(); vi.useRealTimers(); });
function bereit() { const k = new TanksPartie([{id:'a',name:'Anna',farbe:'#fff'},{id:'b',name:'Bert',farbe:'#aaa'}], 17); for(let i=0;i<181;i++)k.schritt(); return k.privatFuer(k.sicht().amZug)!; }
it('feuert genau einmal je Zug und übergibt die aktuell gewählten Werte', () => {
 const arti=bereit(), senden=vi.fn(); render(<TanksSteuerung arti={arti} verbunden senden={senden}/>);
 fireEvent.change(screen.getByLabelText('Winkel'),{target:{value:'80'}});
 fireEvent.change(screen.getByLabelText('Stärke'),{target:{value:'73'}});
 fireEvent.click(screen.getByText('Feuer')); fireEvent.click(screen.getByText('Feuer'));
 expect(senden.mock.calls.filter(([a])=>a.art==='feuer')).toEqual([[{art:'feuer',zug:arti.zug,winkel:80,staerke:73,waffe:arti.waffe}]]);
});
it('sendet nach einem Verbindungsabbruch keine verzögerten Zielwerte', () => {
 vi.useFakeTimers(); const arti=bereit(), senden=vi.fn(); const r=render(<TanksSteuerung arti={arti} verbunden senden={senden}/>);
 fireEvent.change(screen.getByLabelText('Winkel'),{target:{value:'80'}});
 r.rerender(<TanksSteuerung arti={arti} verbunden={false} senden={senden}/>); vi.advanceTimersByTime(300);
 expect(senden).not.toHaveBeenCalled(); expect(screen.getByText('Feuer')).toBeDisabled();
});
it('beendet die Fahrt beim Loslassen und bei Verbindungsverlust', () => {
 vi.useFakeTimers(); const arti=bereit(), senden=vi.fn(); const r=render(<TanksSteuerung arti={arti} verbunden senden={senden}/>);
 const rechts=screen.getByLabelText('Nach rechts fahren'); rechts.setPointerCapture=vi.fn();
 fireEvent.pointerDown(rechts,{pointerId:1}); fireEvent.pointerUp(rechts,{pointerId:1});
 expect(senden).toHaveBeenLastCalledWith({art:'reset'});
 fireEvent.pointerDown(rechts,{pointerId:2}); r.rerender(<TanksSteuerung arti={arti} verbunden={false} senden={senden}/>);
 expect(senden).toHaveBeenLastCalledWith({art:'reset'});
});
