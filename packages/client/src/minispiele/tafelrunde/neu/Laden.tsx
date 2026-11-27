/**
 * Der Laden: fuenf Porträtkarten mit EINEM Rahmen in Bronze, Silber oder Gold
 * je Kostenstufe, darueber Gold und Feldplaetze, darunter der eine Knopf
 * „Bereit" — ganz unten, in Daumenreichweite.
 *
 * SEIT DEM 27.11.2026 ABENDS (Robin nach dem Spiel am iPhone) gibt es weder
 * „Neu wuerfeln" noch „Rang steigern": Die Feldplaetze wachsen mit der Runde
 * (das Modul zaehlt, die Sicht nennt `feldplaetze` und
 * `feldplaetzeNaechsteRunde`), der Laden ist, was er ist.
 *
 * KAUFEN darf, was `legalActions` anbietet (`kaufbar`), nicht was eine
 * Goldrechnung hier ergaebe (CLAUDE.md, „Der Client bildet keine Regel
 * nach"). Warum eine Karte gesperrt ist, sagt `kaufhindernis` (Ladenkarte.tsx)
 * — das beschriftet nur eine Absage, die der Server schon ausgesprochen hat.
 *
 * PREIS UND STUFE SIND ZWEIERLEI: `kosten` ist die Kostenstufe (1–3, Farbe des
 * Rahmens), `preis` das, was der Kauf kostet. Angezeigt und verglichen wird
 * der Preis aus dem Katalog, nie eine Umrechnung aus der Stufe.
 *
 * DIE KARTE IST EINE SCHALTFLAECHE (Tipp kauft), und in eine Schaltflaeche
 * darf kein zweiter Knopf (Ladenkarte.tsx, gleicher Grund). Der Griff zum
 * Einheitenblatt liegt deshalb DANEBEN, oben rechts ueber der Karte.
 */

import { useState } from 'react';

import { kartenBild, kartenRahmen } from '../../../figuren3d/grafik-neu';
import { type Kaufhindernis, kaufhindernis } from '../Ladenkarte';
import type { EigeneSicht, Einheit } from '../sicht';
import { einheitName, rollenName, tz } from '../text';
import { Figur, Kartenrahmen, Kurzname, MarkeZeichen, Muenze, RolleZeichen, kostenStufe, preisVon } from './grafik';
import stil from './neu.module.css';

/**
 * Das Bild der Karte: die Splash-Art der Einheit (`kartenBild`, freigestellte
 * Figur im Hochformat), sonst der Ausschnitt aus dem Figurenblatt. Hinter
 * beidem liegt ein Verlauf in der Kostenfarbe (Stylesheet, `.portraet`).
 */
function Kartenbild({ einheit }: { einheit: Einheit }): React.JSX.Element {
  const pfad = kartenBild(einheit.id);
  const [kaputt, setKaputt] = useState<string | null>(null);
  if (pfad && pfad !== kaputt) {
    return <img className={stil.splash} src={pfad} alt="" onError={() => setKaputt(pfad)} />;
  }
  return <Figur einheit={einheit} klasse={stil.portraetFigur} />;
}

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
  const preis = preisVon(einheit);
  return (
    <li
      className={stil.karte}
      data-rahmen={kostenStufe(einheit.kosten)}
      /* Gibt es das Rahmenbild, traegt der Knopf keinen eigenen Rand — sonst
         saehe man zwei (Stylesheet, `.karteKnopf`). */
      data-rahmenbild={kartenRahmen(Math.min(3, Math.max(1, einheit.kosten))) ? '' : undefined}
      data-gesperrt={kaufbar ? undefined : ''}
    >
      <button
        type="button"
        className={stil.karteKnopf}
        disabled={!kaufbar}
        onClick={onKauf}
        aria-label={`${name}, ${rollenName(einheit.rolle)}, ${preis} ${tz('neu.gold')}`}
      >
        <span className={stil.portraet}>
          <Kartenbild einheit={einheit} />
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
          {preis}
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
  fehlen,
  trifft,
  onKauf,
  onBlatt,
  onBereit,
}: {
  eigenes: EigeneSicht;
  plaetze: number;
  katalog: Record<string, Einheit>;
  kaufbar: ReadonlySet<number>;
  darfHandeln: boolean;
  /** Wie viele Kopien zum Verschmelzen fehlen (`fehlendeKopien`, zuege.ts). */
  fehlen: (id: string) => number;
  trifft: (marke: string) => boolean;
  onKauf: (platz: number) => void;
  onBlatt: (platz: number) => void;
  onBereit: () => void;
}): React.JSX.Element {
  const bankVoll = !eigenes.bank.includes(null);
  /* Waechst das Feld zur naechsten Runde? Das sagt die Sicht, nicht die Runde
     hier: Gleich heisst „am Ende", dann steht nichts da. */
  const naechste = eigenes.feldplaetzeNaechsteRunde;
  const waechst = naechste !== undefined && naechste > eigenes.feldplaetze;
  return (
    <section className={stil.laden} aria-label={tz('laden.titel')}>
      <div className={stil.ladenKopf}>
        <span className={stil.goldstand} aria-label={tz('neu.goldstand', { n: eigenes.gold, plus: eigenes.einkommen })}>
          <Muenze />
          <strong>{eigenes.gold}</strong>
          {/* Was die naechste Runde bringt — Zins und Serie wirken sonst wie Zufall. */}
          <em>+{eigenes.einkommen}</em>
        </span>
        <span className={stil.feldstand}>
          {tz('neu.feld', { belegt: eigenes.belegt, plaetze: eigenes.feldplaetze })}
          {waechst && <small>{tz('neu.feldNaechste', { n: naechste })}</small>}
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
      <button
        type="button"
        className={stil.bereitknopf}
        data-bereit={eigenes.bereit ? '' : undefined}
        disabled={eigenes.bereit || !darfHandeln}
        onClick={onBereit}
      >
        {tz(eigenes.bereit ? 'laden.wartet' : 'laden.bereit')}
      </button>
    </section>
  );
}
