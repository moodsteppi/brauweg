import { t } from '../i18n';
import { tn } from '../i18n/einsetzen';
import type { BrowortKurz } from './sicht';
import { BrowortFlamme, schnittText } from './Spielfeld';

/**
 * Browort auf dem Start (App und Webseite): Flamme mit dem Schnitt der
 * Versuche, darunter die Serie. Ein Tipp oeffnet das Wort des Tages.
 *
 * Ohne `stand` (ein Server, der das Feld noch nicht kennt) steht die Karte
 * trotzdem da — als Einladung.
 *
 * `schnittText` gehoert zum Spiel selbst (Spielfeld) und bleibt bis zur
 * Uebersetzung der Spiele deutsch; die Karte setzt ihn nur ein.
 */
export function BrowortKarte({ stand, onOeffnen }: { stand: BrowortKurz | undefined; onOeffnen: () => void }): React.JSX.Element {
  const serie = stand?.serie ?? 0;
  const heute = stand?.heuteGespielt ?? false;
  const unter = heute
    ? t('startkarte.browort.erledigt')
    : serie > 0
      ? t('startkarte.browort.wartet')
      : t('startkarte.browort.einladung');
  return (
    <button
      type="button"
      className="ln-startkarte bw-startkarte"
      onClick={onOeffnen}
      aria-label={tn('startkarte.browort.aria', serie, { schnitt: schnittText(stand?.schnitt ?? null), unter })}
    >
      <BrowortFlamme schnitt={stand?.schnitt ?? null} an={heute} groesse={2.8} />
      <span className="ln-startkarte-text">
        <span className="hb-label">{t('startkarte.browort.label')}</span>
        <strong>
          {serie > 0
            ? tn('startkarte.serie', serie)
            : heute
              ? t('startkarte.browort.gespielt')
              : t('startkarte.browort.raten')}
        </strong>
        <span className="hb-klein">{unter}</span>
      </span>
      <span className="hb-pf" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
