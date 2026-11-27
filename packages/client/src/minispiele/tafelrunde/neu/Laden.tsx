/**
 * Der Laden: fuenf Porträtkarten mit Kostenrahmen (Bronze, Silber, Gold),
 * Gold, Rang, und die drei Knoepfe Neu wuerfeln, Rang steigern, Bereit —
 * ganz unten, in Daumenreichweite.
 *
 * KAUFEN darf, was `legalActions` anbietet (`kaufbar`), nicht was eine
 * Goldrechnung hier ergaebe (CLAUDE.md, „Der Client bildet keine Regel
 * nach"). Warum eine Karte gesperrt ist, sagt `kaufhindernis` (Ladenkarte.tsx)
 * — das beschriftet nur eine Absage, die der Server schon ausgesprochen hat.
 *
 * DIE KARTE IST EINE SCHALTFLAECHE (Tipp kauft), und in eine Schaltflaeche
 * darf kein zweiter Knopf (Ladenkarte.tsx, gleicher Grund). Der Griff zum
 * Einheitenblatt liegt deshalb DANEBEN, oben rechts ueber der Karte.
 */

import { type Kaufhindernis, kaufhindernis } from '../Ladenkarte';
import type { EigeneSicht, Einheit } from '../sicht';
import { einheitName, rollenName, tz } from '../text';
import { Figur, Kartenrahmen, Kurzname, MarkeZeichen, Muenze, RolleZeichen, kostenStufe } from './grafik';
import stil from './neu.module.css';

/** Eine Porträtkarte im Laden. */
export function Portraetkarte({
  einheit,
  kaufbar,
  verschmilzt,
  trifft,
  grund,
  onKauf,
  onBlatt,
}: {
  einheit: Einheit | undefined;
  kaufbar: boolean;
  /** Mit diesem Kauf ist die letzte fehlende Kopie da. */
  verschmilzt: boolean;
  /** Erreicht eine Marke mit diesem Kauf eine Schwelle? */
  trifft: (marke: string) => boolean;
  grund: Kaufhindernis;
  onKauf: () => void;
  onBlatt?: () => void;
}): React.JSX.Element {
  if (!einheit) {
    return <li className={stil.karte} data-leer="" aria-hidden="true" />;
  }
  const name = einheitName(einheit);
  return (
    <li className={stil.karte} data-rahmen={kostenStufe(einheit.kosten)} data-gesperrt={kaufbar ? undefined : ''}>
      <button
        type="button"
        className={stil.karteKnopf}
        disabled={!kaufbar}
        onClick={onKauf}
        aria-label={`${name}, ${rollenName(einheit.rolle)}, ${einheit.kosten} ${tz('neu.gold')}`}
      >
        <span className={stil.portraet}>
          <Figur einheit={einheit} klasse={stil.portraetFigur} />
        </span>
        <Kartenrahmen kosten={einheit.kosten} />
        <span className={stil.karteRolle}>
          <RolleZeichen rolle={einheit.rolle} />
        </span>
        <span className={stil.karteMarken}>
          {einheit.marken.map((m) => (
            <span key={m} data-trifft={trifft(m) ? '' : undefined}>
              <MarkeZeichen marke={m} />
            </span>
          ))}
        </span>
        <Kurzname name={name} klasse={stil.karteName} />
        <span className={stil.kartePreis}>
          <Muenze />
          {einheit.kosten}
        </span>
        {verschmilzt && <span className={stil.karteBand}>{tz('laden.verschmilzt')}</span>}
        {!verschmilzt && grund && (
          <span className={stil.karteBand} data-grund={grund}>
            {tz(grund === 'gold' ? 'laden.zuWenigGold' : 'laden.bankVoll')}
          </span>
        )}
      </button>
      {onBlatt && (
        <button type="button" className={stil.karteInfo} onClick={onBlatt} aria-label={tz('laden.ansehen', { name })}>
          i
        </button>
      )}
    </li>
  );
}

export function Laden({
  eigenes,
  plaetze,
  katalog,
  kaufbar,
  darfHandeln,
  darfWuerfeln,
  darfLevel,
  fehlen,
  trifft,
  onKauf,
  onBlatt,
  onWuerfeln,
  onLevel,
  onBereit,
}: {
  eigenes: EigeneSicht;
  plaetze: number;
  katalog: Record<string, Einheit>;
  kaufbar: ReadonlySet<number>;
  darfHandeln: boolean;
  darfWuerfeln: boolean;
  darfLevel: boolean;
  /** Wie viele Kopien zum Verschmelzen fehlen (`fehlendeKopien`, zuege.ts). */
  fehlen: (id: string) => number;
  trifft: (marke: string) => boolean;
  onKauf: (platz: number) => void;
  onBlatt: (platz: number) => void;
  onWuerfeln: () => void;
  onLevel: () => void;
  onBereit: () => void;
}): React.JSX.Element {
  const bankVoll = !eigenes.bank.includes(null);
  return (
    <section className={stil.laden} aria-label={tz('laden.titel')}>
      <div className={stil.ladenKopf}>
        <span className={stil.goldstand} aria-label={tz('neu.goldstand', { n: eigenes.gold, plus: eigenes.einkommen })}>
          <Muenze />
          <strong>{eigenes.gold}</strong>
          {/* Was die naechste Runde bringt — Zins und Serie wirken sonst wie Zufall. */}
          <em>+{eigenes.einkommen}</em>
        </span>
        <span className={stil.rang}>
          {tz('neu.rang', { n: eigenes.level })}
          <small>{tz('kopf.feld', { belegt: eigenes.belegt, plaetze: eigenes.feldplaetze })}</small>
        </span>
      </div>
      <ol className={stil.karten} style={{ '--ladenplaetze': plaetze } as React.CSSProperties}>
        {Array.from({ length: plaetze }, (_, platz) => {
          const id = eigenes.laden[platz] ?? null;
          const einheit = id ? katalog[id] : undefined;
          const darf = kaufbar.has(platz) && darfHandeln;
          return (
            <Portraetkarte
              key={platz}
              einheit={einheit}
              kaufbar={darf}
              verschmilzt={id ? fehlen(id) === 1 : false}
              trifft={trifft}
              grund={darfHandeln && !darf ? kaufhindernis(eigenes.gold, bankVoll, einheit) : null}
              onKauf={() => onKauf(platz)}
              onBlatt={einheit ? () => onBlatt(platz) : undefined}
            />
          );
        })}
      </ol>
      <div className={stil.ladenKnoepfe}>
        <button type="button" className={stil.ladenknopf} disabled={!darfWuerfeln || !darfHandeln} onClick={onWuerfeln}>
          {tz('laden.neuWuerfeln')}
          {/* Kostenlos heisst: keine Zahl (siehe Kopf im alten Laden — „0 Gold"
              liest sich wie ein Preis). */}
          {eigenes.neuwuerfelnKosten > 0 && (
            <em>
              <Muenze />
              {eigenes.neuwuerfelnKosten}
            </em>
          )}
        </button>
        <button type="button" className={stil.ladenknopf} disabled={!darfLevel || !darfHandeln} onClick={onLevel}>
          {tz(eigenes.aufstiegKosten === null ? 'laden.hoechsterRang' : 'laden.rangSteigern')}
          {eigenes.aufstiegKosten !== null && (
            <em>
              <Muenze />
              {eigenes.aufstiegKosten}
            </em>
          )}
        </button>
        <button
          type="button"
          className={stil.bereitknopf}
          data-bereit={eigenes.bereit ? '' : undefined}
          disabled={eigenes.bereit || !darfHandeln}
          onClick={onBereit}
        >
          {tz(eigenes.bereit ? 'laden.wartet' : 'laden.bereit')}
        </button>
      </div>
    </section>
  );
}
