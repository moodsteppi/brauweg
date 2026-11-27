/**
 * Das Einheitenblatt: Figur gross, Werte, Faehigkeit mit Mana, Marken,
 * Verkaufen (bzw. Kaufen, wenn es aus dem Laden kommt).
 *
 * DIE WERTE SIND DIE DER STERNSTUFE und kommen fertig aus der Sicht
 * (`stufenwerte`), die Faehigkeit samt vollem Mana ebenso (`faehigkeiten`).
 * Nachgerechnet wird nichts — welcher Wert mit der Stufe waechst, ist eine
 * Regel des Moduls (sicht.ts, `Stufenwerte`).
 *
 * KNOEPFE NUR, WENN SIE ETWAS TUN: Fehlt ein Rueckruf, fehlt der Knopf.
 * Verkaufen haengt am Tisch an `legalActions`, Kaufen ebenso. Am fremden Brett
 * und nach „Bereit" kommt das Blatt ohne Knoepfe — Nachschlagen ist kein
 * Handeln.
 */

import type { Einheit, Faehigkeit, Stufenwerte } from '../sicht';
import { einheitName, faehigkeitName, faehigkeitText, markeName, rollenName, tz } from '../text';
import type { Kaempfer } from '../zuege';
import { Blatt } from './Blatt';
import { Figur, MarkeZeichen, Muenze, RolleZeichen, Sterne, kostenStufe } from './grafik';
import stil from './neu.module.css';

export function Einheitenblatt({
  einheit,
  kaempfer,
  werte,
  faehigkeit,
  markennamen,
  erloes,
  onVerkaufen,
  onAufstellen,
  aufstellenTitel,
  onKaufen,
  onMarke,
  onSchliessen,
  escapeAus,
}: {
  einheit: Einheit;
  kaempfer: Kaempfer;
  werte: Stufenwerte | undefined;
  /** undefined: Tisch aus der Zeit davor. null: Einheit ohne Faehigkeit. */
  faehigkeit: Faehigkeit | null | undefined;
  markennamen: Record<string, string>;
  erloes?: number;
  onVerkaufen?: () => void;
  onAufstellen?: () => void;
  aufstellenTitel?: string;
  onKaufen?: () => void;
  onMarke: (marke: string) => void;
  onSchliessen: () => void;
  escapeAus?: boolean;
}): React.JSX.Element {
  const name = einheitName(einheit);
  const knoepfe = onVerkaufen || onAufstellen || onKaufen;
  return (
    <Blatt
      titel={name}
      escapeAus={escapeAus}
      onSchliessen={onSchliessen}
      kopf={
        <div className={stil.blattFigur} data-rahmen={kostenStufe(einheit.kosten)}>
          <Figur einheit={einheit} klasse={stil.grossFigur} />
          <Sterne stufe={kaempfer.stufe} klasse={stil.blattSterne} />
        </div>
      }
      fuss={
        knoepfe ? (
          <>
            {onKaufen && (
              <button type="button" className={stil.hauptknopf} onClick={onKaufen}>
                {tz('knopf.kaufen')}
                <em>
                  <Muenze />
                  {einheit.kosten}
                </em>
              </button>
            )}
            {onAufstellen && (
              <button type="button" className={stil.zweitknopf} onClick={onAufstellen}>
                {aufstellenTitel ?? tz('knopf.verschieben')}
              </button>
            )}
            {onVerkaufen && (
              <button type="button" className={stil.verkaufknopf} onClick={onVerkaufen}>
                {tz('knopf.verkaufen')}
                {erloes !== undefined && (
                  <em>
                    +<Muenze />
                    {erloes}
                  </em>
                )}
              </button>
            )}
          </>
        ) : undefined
      }
    >
      <p className={stil.blattZeile}>
        <RolleZeichen rolle={einheit.rolle} />
        {rollenName(einheit.rolle)}
        {' · '}
        {tz('neu.stufe', { n: kaempfer.stufe })}
        {' · '}
        <Muenze />
        {einheit.kosten}
      </p>

      {werte && (
        <dl className={stil.werte}>
          <div>
            <dt>{tz('wert.leben')}</dt>
            <dd>{werte.leben}</dd>
          </div>
          <div>
            <dt>{tz('wert.schaden')}</dt>
            <dd>{werte.angriff}</dd>
          </div>
          <div>
            <dt>{tz('wert.tempo')}</dt>
            <dd>{werte.tempo}</dd>
          </div>
          <div>
            <dt>{tz('wert.reichweite')}</dt>
            <dd>{werte.reichweite}</dd>
          </div>
          <div>
            <dt>{tz('wert.ruestung')}</dt>
            <dd>{werte.ruestung}</dd>
          </div>
        </dl>
      )}

      <section className={stil.faehigkeit} data-art={faehigkeit?.art ?? 'keine'}>
        <h3>{tz('neu.faehigkeit.titel')}</h3>
        {faehigkeit ? (
          <>
            <p className={stil.faehigkeitKopf}>
              <strong>{faehigkeitName(faehigkeit)}</strong>
              <span>
                {faehigkeit.art === 'passiv' ? tz('neu.faehigkeit.passiv') : tz('neu.faehigkeit.mana', { n: faehigkeit.mana })}
              </span>
            </p>
            {faehigkeit.art === 'aktiv' && (
              /* Der Balken sagt, was „Mana" heisst: leer zu Kampfbeginn,
                 voll ist die Faehigkeit dran. */
              <i className={stil.manaLeiste} aria-hidden="true" />
            )}
            <p className={stil.text}>{faehigkeitText(faehigkeit)}</p>
          </>
        ) : (
          <p className={stil.klein}>{faehigkeit === null ? tz('neu.faehigkeit.keine') : tz('neu.faehigkeit.unbekannt')}</p>
        )}
      </section>

      <section className={stil.blattMarken}>
        <h3>{tz('neu.marken')}</h3>
        <div>
          {einheit.marken.map((m) => (
            <button key={m} type="button" className={stil.markenchip} onClick={() => onMarke(m)}>
              <MarkeZeichen marke={m} />
              <span>{markeName(m, markennamen[m] ?? m)}</span>
            </button>
          ))}
        </div>
      </section>
    </Blatt>
  );
}
