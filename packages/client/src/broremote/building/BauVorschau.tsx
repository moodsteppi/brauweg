import { useId } from 'react';
import { FORM_NAMEN, zellen, type BauForm } from '@brauweg/building-kern';
import { BAUFARBEN } from './material';

export function BauVorschau({ form }: { form: BauForm }): React.JSX.Element {
  const id = useId(), [hell, dunkel, glanz] = BAUFARBEN[form];
  return <svg viewBox="-2.6 -2.1 5.2 4.2" className="bb-mini" role="img" aria-label={`Nächstes Bauteil: ${FORM_NAMEN[form]}`}>
    <defs><linearGradient id={id} x2=".3" y2="1"><stop stopColor={hell} /><stop offset="1" stopColor={dunkel} /></linearGradient></defs>
    {zellen(form).map((p, i) => <g key={i}><rect x={p.x - .46} y={-p.y - .46} width=".92" height=".92" rx=".09" fill={`url(#${id})`} stroke="#132136" strokeWidth=".04" /><path d={`M${p.x - .31},${-p.y - .31}h.62`} stroke={glanz} strokeWidth=".06" /><path d={`M${p.x},${-p.y - .15}l.12,.15 -.12,.15 -.12,-.15Z`} fill="none" stroke={glanz} strokeOpacity=".6" strokeWidth=".035" /></g>)}
  </svg>;
}
