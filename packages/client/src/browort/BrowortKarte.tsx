import type { BrowortKurz } from './sicht';
import { BrowortFlamme, schnittText } from './Spielfeld';

/**
 * Browort auf dem Start (nur in der App): Flamme mit dem Schnitt der
 * Versuche, darunter die Serie. Ein Tipp oeffnet das Wort des Tages.
 *
 * Ohne `stand` (ein Server, der das Feld noch nicht kennt) steht die Karte
 * trotzdem da — als Einladung.
 */
export function BrowortKarte({ stand, onOeffnen }: { stand: BrowortKurz | undefined; onOeffnen: () => void }): React.JSX.Element {
  const serie = stand?.serie ?? 0;
  const heute = stand?.heuteGespielt ?? false;
  const unter = heute
    ? 'Für heute erledigt — morgen kommt ein neues Wort.'
    : serie > 0
      ? 'Das Wort von heute wartet, sonst erlischt die Flamme.'
      : 'Fünf Buchstaben, sechs Versuche, jeden Tag ein neues Wort.';
  return (
    <button
      type="button"
      className="ln-startkarte bw-startkarte"
      onClick={onOeffnen}
      aria-label={`Browort. Serie: ${serie} ${serie === 1 ? 'Tag' : 'Tage'}, ${schnittText(stand?.schnitt ?? null)}. ${unter}`}
    >
      <BrowortFlamme schnitt={stand?.schnitt ?? null} an={heute} groesse={2.8} />
      <span className="ln-startkarte-text">
        <span className="hb-label">Browort · Wort des Tages</span>
        <strong>{serie > 0 ? `${serie} ${serie === 1 ? 'Tag' : 'Tage'} Serie` : heute ? 'Heute gespielt' : 'Rate das Wort'}</strong>
        <span className="hb-klein">{unter}</span>
      </span>
      <span className="hb-pf" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
