import { t } from '../i18n';
import { BrowortFlamme } from './Spielfeld';
import { schnittZahl, tz } from './text';

/**
 * Browort im Profil (Emile: „steht dann im Profil des jeweiligen
 * Spielers"): Flamme mit dem Schnitt der Versuche, daneben Serie und wie
 * viele Woerter geloest sind. Fuer das eigene und fuer fremde Profile.
 */
export function BrowortImProfil({
  serie,
  schnitt,
  geloest,
  beste,
  du,
}: {
  serie: number;
  schnitt: number | null;
  geloest: number;
  beste?: number;
  /** Eigenes Profil: anders formuliert, wenn noch nichts gespielt ist. */
  du: boolean;
}): React.JSX.Element {
  // Im Format der Sprache (3,8 gegen 3.8) — bis zur Übersetzung stand hier fest 'de-DE'.
  const schnittText = schnitt === null ? '-' : schnittZahl(schnitt);
  return (
    <section className="hb-blk">
      <h2 className="hb-ab">
        Browort
        <span className="hb-ab-zusatz">{tz('browort.ui.geloestZahl', { n: geloest })}</span>
      </h2>
      <div className="hb-karte bw-profil">
        <BrowortFlamme schnitt={schnitt} an={serie > 0} groesse={3.2} />
        <span className="hb-sp-werte">
          <span>
            <b>{serie}</b>{t('browort.ui.serie')}
          </span>
          <span>
            <b>{schnittText}</b>{t('browort.ui.profil.schnitt')}
          </span>
          <span>
            <b>{beste ?? geloest}</b>
            {beste !== undefined ? t('browort.ui.profil.besteSerie') : t('browort.ui.geloest')}
          </span>
        </span>
      </div>
      {du && geloest === 0 && (
        <p className="hb-klein hb-ohne-rand">{t('browort.ui.profil.erstesWort')}</p>
      )}
    </section>
  );
}
