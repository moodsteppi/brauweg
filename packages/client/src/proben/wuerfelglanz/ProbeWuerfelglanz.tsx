/** Nur Entwicklungsansicht: bedienbare echte Spieloberfläche mit demselben Regelkern, ohne Konto. */
import { useState } from 'react';
import { wuerfelglanz, erstelle, handeln, sicht, erlaubt, bot, type Partie } from '@brauweg/game-wuerfelglanz';
import { WuerfelglanzMenue, WuerfelglanzPartie } from '../../screens/Wuerfelglanz';
import { api } from '../../api';
let sitze = 1;
api.tables = async () => [];
api.defaults = async () => ({ config: {}, protocolVersion: 1, seatCounts: [...wuerfelglanz.meta.seatCounts], rounds: Object.fromEntries(wuerfelglanz.meta.seatCounts.map(s => [s, wuerfelglanz.meta.suggestedRounds(s)])) });
api.eigeneBestleistungen = async () => [{ inhaltId: 'klassisch', wert: 246, richtung: 'hoch', partyId: null, erzieltAm: new Date().toISOString() }];
api.createTable = async body => { sitze = body.seats; return { id: 'wuerfelglanz-probe', joinCode: 'GLANZ5' }; };
function start(anzahl: number, ende = false): Partie {
  let p = erstelle(anzahl, 88);
  if (ende) while (!p.fertig) p = handeln(p, p.amZug, bot(sicht(p, p.amZug)));
  return p;
}
export function ProbeWuerfelglanz() {
  const q = new URLSearchParams(location.search), modus = q.get('ansicht');
  const [p, setP] = useState<Partie | null>(() => modus && modus !== 'menue' ? start(modus === 'mehrspieler' ? 3 : 1, modus === 'ende') : null);
  const [ich, setIch] = useState(0);
  return <>{q.has('iphone') && <style>{`.wg{right:auto!important;left:0!important;width:390px!important;max-width:390px!important;margin:0!important}.wg-kopf{padding-top:52px!important}`}</style>}{p ? <><WuerfelglanzPartie sicht={sicht(p, ich)} namen={['Eisvogel', 'Robin', 'Pinguinritter']} aktionen={erlaubt(p, ich)} onAktion={a => setP(handeln(p, ich, a))} onBack={() => setP(null)} />{p.sitze > 1 && !p.fertig && <button style={{ position: 'fixed', zIndex: 50, right: 10, top: 10 }} onClick={() => setIch(p.amZug)}>Demo: aktiven Spieler übernehmen</button>}</> : <WuerfelglanzMenue onBack={() => location.href = '/?dev=hub&markt&iphone'} onTisch={() => { setP(start(sitze)); setIch(0); }} />}</>;
}
