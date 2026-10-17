import { Flamme } from './Flamme';
import type { LernserieKurz } from './sicht';
import './lernen.css';

/**
 * Die Lernserie auf dem Start (nur in der App): Flamme, Tageszahl und die
 * sieben Striche bis zum Doko-Meister. Ein Tipp oeffnet den Lernpfad.
 *
 * Ohne `serie` (ein Server, der das Feld noch nicht kennt) steht die Karte
 * trotzdem da — als Einladung, nicht als Zahl.
 */
export function LernKarte({ serie, onOeffnen }: { serie: LernserieKurz | undefined; onOeffnen: () => void }): React.JSX.Element {
  const tage = serie?.serie ?? 0;
  const ziel = serie?.ziel ?? 7;
  const heute = serie?.heuteGespielt ?? false;
  const unter = serie?.belohnt
    ? heute
      ? 'Heute geschafft. Doko-Meister bist du schon.'
      : 'Halte deine Flamme am Brennen.'
    : heute
      ? `Heute geschafft — noch ${Math.max(0, ziel - tage)} bis zum Doko-Meister.`
      : tage > 0
        ? 'Heute noch eine Lektion, sonst erlischt die Flamme.'
        : `${ziel} Tage am Stück, dann gibt es ein Pinguin-Outfit.`;

  return (
    <button
      type="button"
      className="ln-startkarte"
      onClick={onOeffnen}
      aria-label={`Doppelkopf lernen. Serie: ${tage} ${tage === 1 ? 'Tag' : 'Tage'}. ${unter}`}
    >
      <Flamme aus={!heute} groesse={2.6} />
      <span className="ln-startkarte-text">
        <span className="hb-label">Doppelkopf lernen</span>
        <strong>{tage > 0 ? `${tage} ${tage === 1 ? 'Tag' : 'Tage'} Serie` : 'Starte deine Serie'}</strong>
        <span className="ln-startkarte-punkte" aria-hidden="true">
          {Array.from({ length: ziel }, (_, i) => (
            <i key={i} className={i < Math.min(tage, ziel) ? 'is-voll' : undefined} />
          ))}
        </span>
        <span className="hb-klein">{unter}</span>
      </span>
      <span className="hb-pf" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
