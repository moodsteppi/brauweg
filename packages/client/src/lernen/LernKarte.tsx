import { t } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import { Flamme } from './Flamme';
import type { LernserieKurz } from './sicht';
import './lernen.css';

/**
 * Die Lernserie auf dem Start (App und Webseite): Flamme, Tageszahl und die
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
      ? t('startkarte.lernen.meisterHeute')
      : t('startkarte.lernen.brennen')
    : heute
      ? tf('startkarte.lernen.heuteNoch', { rest: Math.max(0, ziel - tage) })
      : tage > 0
        ? t('startkarte.lernen.lektion')
        : tf('startkarte.lernen.einladung', { ziel });

  return (
    <button
      type="button"
      className="ln-startkarte"
      onClick={onOeffnen}
      aria-label={tn('startkarte.lernen.aria', tage, { unter })}
    >
      <Flamme aus={!heute} groesse={2.6} />
      <span className="ln-startkarte-text">
        <span className="hb-label">{t('startkarte.lernen.label')}</span>
        <strong>{tage > 0 ? tn('startkarte.serie', tage) : t('startkarte.lernen.starten')}</strong>
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
