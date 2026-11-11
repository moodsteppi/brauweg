/** Kurze synthetisierte Klänge: kein Download, kein Decoder, ein gemeinsamer Audiokontext. */
export const KLANGFARBEN = ['#dcf8ff','#6ee5cf','#ffc36a','#8feaff','#c4cce5','#f5fcff','#ffa78b','#ffe570','#9fafff','#99e8ff','#c2a4ff'] as const;
const PROFILE = [
  [360,90,.23,'sine'],[510,190,.2,'triangle'],[130,38,.45,'triangle'],[700,240,.27,'sine'],
  [230,55,.19,'sawtooth'],[460,140,.3,'sine'],[200,45,.34,'square'],[880,440,.38,'sine'],
  [100,28,.6,'triangle'],[630,70,.4,'sawtooth'],[410,130,.5,'sine'],
] as const;
export function tanksKlang(a: AudioContext, waffe: number, art: 'feuer' | 'einschlag'): void {
  if (a.state !== 'running') return;
  const [hoch,tief,dauer,form] = PROFILE[waffe] ?? PROFILE[0];
  const t = a.currentTime, faktor = art === 'feuer' ? 1.6 : 1;
  const o = a.createOscillator(), g = a.createGain();
  o.type = form; o.frequency.setValueAtTime(hoch*faktor,t); o.frequency.exponentialRampToValueAtTime(tief*faktor,t+dauer);
  g.gain.setValueAtTime(.001,t); g.gain.exponentialRampToValueAtTime(form==='square'?.025:.06,t+.008); g.gain.exponentialRampToValueAtTime(.001,t+dauer);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+dauer+.03); o.onended=()=>{o.disconnect();g.disconnect();};
  if (art === 'einschlag') {
    const l = Math.ceil(a.sampleRate*.14), daten = a.createBuffer(1,l,a.sampleRate), kanal = daten.getChannelData(0);
    let wert = 17+waffe;
    for(let i=0;i<l;i++){wert=(wert*16807)%2147483647;kanal[i]=(wert/2147483647*2-1)*(1-i/l);}
    const quelle = a.createBufferSource(), filter = a.createBiquadFilter(), pegel = a.createGain();
    quelle.buffer=daten;filter.type='lowpass';filter.frequency.value=waffe===8?600:1800+waffe*160;pegel.gain.value=.07;
    quelle.connect(filter);filter.connect(pegel);pegel.connect(a.destination);quelle.start(t);quelle.onended=()=>{quelle.disconnect();filter.disconnect();pegel.disconnect();};
  }
}
