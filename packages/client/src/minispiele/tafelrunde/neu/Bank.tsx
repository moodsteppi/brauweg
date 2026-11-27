/**
 * Die Bank (9 Plaetze) — unten in Daumenreichweite, direkt ueber dem Laden.
 *
 * Wie viele Plaetze es sind, kommt aus der Sicht (`bankPlaetze`, steht im
 * Regelsatz), nicht aus einer 9 hier. Jeder Platz ist ein Ziel fuers Ziehen
 * (`data-ziel`) und fuer den Antipp-Weg; ein leerer Platz nimmt den Tipp nur
 * an, wenn gerade eine Einheit gewaehlt ist und dorthin darf.
 */

import type { Einheit } from '../sicht';
import { markenFarbe } from '../marken';
import { tz } from '../text';
import { type Kaempfer, type Ort, gleicherOrt, ortSchluessel } from '../zuege';
import type { Zeigerrufe } from '../ziehen';
import { Einheitsbild, einheitsBeschriftung, zellRufe } from './Feld';
import stil from './neu.module.css';

export function Bank({
  plaetze,
  bank,
  katalog,
  aktiv,
  gewaehlt,
  istZiel,
  ablegeZiel,
  ziehtVon,
  zeiger,
  onTippe,
  onNachsehen,
  marke,
}: {
  plaetze: number;
  bank: readonly (Kaempfer | null)[];
  katalog: Record<string, Einheit>;
  aktiv: boolean;
  gewaehlt: Ort | null;
  istZiel?: (ort: Ort) => boolean;
  ablegeZiel: string | null;
  ziehtVon: Ort | null;
  zeiger?: Zeigerrufe;
  onTippe: (ort: Ort) => void;
  onNachsehen: (ort: Ort) => void;
  marke: string | null;
}): React.JSX.Element {
  return (
    <ol className={stil.bank} aria-label={tz('bank.titel')} style={{ '--bankplaetze': plaetze } as React.CSSProperties}>
      {Array.from({ length: plaetze }, (_, platz) => {
        const ort: Ort = { bereich: 'bank', platz };
        const k = bank[platz] ?? null;
        const einheit = k ? katalog[k.id] : undefined;
        const schluessel = ortSchluessel(ort);
        const ziel = istZiel ? istZiel(ort) : false;
        const rufe = k
          ? zellRufe({
              ort,
              aktiv,
              zeiger,
              onTippe,
              onNachsehen: () => onNachsehen(ort),
              name: einheitsBeschriftung(k, einheit),
            })
          : ziel
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': tz('bank.platz', { n: platz + 1 }) + tz('brett.ziel'),
                onClick: () => onTippe(ort),
              }
            : { 'aria-label': tz('bank.platz', { n: platz + 1 }) };
        return (
          <li
            key={platz}
            className={stil.bankplatz}
            data-ziel={schluessel}
            data-zielbar={ziel ? '' : undefined}
            data-unter={ablegeZiel === schluessel ? '' : undefined}
            data-leer={k ? undefined : ''}
            {...rufe}
          >
            {k && (
              <Einheitsbild
                kaempfer={k}
                einheit={einheit}
                ring={marke && einheit?.marken.includes(marke) ? markenFarbe(marke) : null}
                gewaehlt={gleicherOrt(gewaehlt, ort)}
                versteckt={gleicherOrt(ziehtVon, ort)}
                klasse={stil.bankEinheit}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
