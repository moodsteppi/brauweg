import { zellen, type BauForm } from '@brauweg/building-kern';

export function BauVorschau({ form }: { form: BauForm }): React.JSX.Element {
  return <svg viewBox="-2.6 -2.1 5.2 4.2" className="bb-mini" role="img" aria-label={`Nächstes Bauteil: ${form}`}>
    {zellen(form).map((p, i) => <g key={i}><rect x={p.x - .44} y={-p.y - .44} width=".88" height=".88" rx=".12" fill="currentColor" /><path d={`M${p.x - .28},${-p.y - .25}h.56`} stroke="white" strokeOpacity=".55" strokeWidth=".06" /></g>)}
  </svg>;
}
