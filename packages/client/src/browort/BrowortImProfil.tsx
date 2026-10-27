import { BrowortFlamme } from './Spielfeld';

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
  const schnittText = schnitt === null ? '-' : schnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return (
    <section className="hb-blk">
      <h2 className="hb-ab">
        Browort
        <span className="hb-ab-zusatz">{geloest} gelöst</span>
      </h2>
      <div className="hb-karte bw-profil">
        <BrowortFlamme schnitt={schnitt} an={serie > 0} groesse={3.2} />
        <span className="hb-sp-werte">
          <span>
            <b>{serie}</b>Serie
          </span>
          <span>
            <b>{schnittText}</b>Ø Versuche
          </span>
          <span>
            <b>{beste ?? geloest}</b>
            {beste !== undefined ? 'Beste Serie' : 'Gelöst'}
          </span>
        </span>
      </div>
      {du && geloest === 0 && (
        <p className="hb-klein hb-ohne-rand">Rate dein erstes Wort - dann steht hier dein Schnitt.</p>
      )}
    </section>
  );
}
