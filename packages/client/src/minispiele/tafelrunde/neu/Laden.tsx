/**
 * Der Laden: fuenf Porträtkarten mit EINEM Rahmen in Bronze, Silber oder Gold
 * je Kostenstufe, darueber Gold, Feldplaetze und rechts der kleine runde
 * Bereit-Haken.
 *
 * DER BEREIT-KNOPF IST SEIT DEM 28.11.2026 KLEIN (Robin am iPhone): Der grosse
 * Knopf ueber die ganze Breite kostete eine Kartenhoehe, die jetzt die Karten
 * bekommen. Ob man bereit ist, sagt die Fuellung (gruen = bereit) und das
 * `aria-label`, nicht mehr eine Beschriftung.
 *
 * IM KAMPF gibt es den Laden zweimal (Robin: „schmale Leiste, aufklappbar"):
 * zugeklappt als `Shopleiste` — die fuenf Karten klein, ein Tipp klappt auf —
 * und aufgeklappt als dieser Laden ohne Bereit-Haken, mit Zuklappen-Griff.
 *
 * SEIT DEM 27.11.2026 ABENDS (Robin nach dem Spiel am iPhone) gibt es weder
 * „Neu wuerfeln" noch „Rang steigern": Die Feldplaetze wachsen mit der Runde
 * (das Modul zaehlt, die Sicht nennt `feldplaetze` und
 * `feldplaetzeNaechsteRunde`), der Laden ist, was er ist.
 *
 * KAUFEN darf, was `legalActions` anbietet (`kaufbar`), nicht was eine
 * Goldrechnung hier ergaebe (CLAUDE.md, „Der Client bildet keine Regel
 * nach"). Warum eine Karte gesperrt ist, sagt `kaufhindernis` (unten) — das
 * beschriftet nur eine Absage, die der Server schon ausgesprochen hat.
 *
 * PREIS UND STUFE SIND ZWEIERLEI: `kosten` ist die Kostenstufe (1–3, Farbe des
 * Rahmens), `preis` das, was der Kauf kostet. Angezeigt und verglichen wird
 * der Preis aus dem Katalog, nie eine Umrechnung aus der Stufe.
 *
 * DIE KARTE IST EINE SCHALTFLAECHE (Tipp kauft), und in eine Schaltflaeche
 * darf kein zweiter Knopf. Der Griff zum
 * Einheitenblatt liegt deshalb DANEBEN, oben rechts ueber der Karte.
 */

import { useState } from 'react';

import { kartenBild, kartenRahmen } from '../../../figuren3d/grafik-neu';
import type { EigeneSicht, Einheit } from '../sicht';
import { einheitName, rollenName, tz } from '../text';
import { Figur, Kartenrahmen, Kurzname, MarkeZeichen, Muenze, RolleZeichen, kostenStufe, preisVon } from './grafik';
import stil from './neu.module.css';

/**
 * Warum ein Kauf gerade nicht geht — die AUSKUNFT, nicht die Entscheidung.
 *
 * Ob gekauft werden darf, sagt allein `legalActions`. Dieser Wert wird erst
 * gebildet, wenn dort nichts steht, und beschriftet nur die schon gefallene
 * Absage (aus der alten Ladenkarte uebernommen, die am 28.11.2026 mit dem
 * alten Tafelrunde ging). Gibt `null` zurueck, wenn Gold und Bank die Sperre
 * NICHT erklaeren — dann steht der Grund woanders, und eine geratene
 * Beschriftung waere schlimmer als keine.
 */
export type Kaufhindernis = 'gold' | 'bank' | null;

export function kaufhindernis(gold: number, bankVoll: boolean, angeboten: Einheit | undefined): Kaufhindernis {
  if (!angeboten) return null;
  // Der PREIS, nicht die Kostenstufe (`preisVon`).
  if (gold < preisVon(angeboten)) return 'gold';
  if (bankVoll) return 'bank';
  return null;
}

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
  /**
   * Erreicht eine Marke mit diesem Kauf eine Schwelle? Mit der Kennung: Eine
   * Einheit, die fuer die Marke schon zaehlt, bringt sie nicht voran.
   */
  trifft: (marke: string, einheitId?: string) => boolean;
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
            <span key={m} data-trifft={trifft(m, einheit.id) ? '' : undefined}>
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

/** Ein Haken, gezeichnet — kein Bild, das fehlen koennte (CLAUDE.md). */
function Haken(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={stil.haken} aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
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
  onZuklappen,
}: {
  eigenes: EigeneSicht;
  plaetze: number;
  katalog: Record<string, Einheit>;
  kaufbar: ReadonlySet<number>;
  darfHandeln: boolean;
  /** Wie viele Kopien zum Verschmelzen fehlen (`fehlendeKopien`, zuege.ts). */
  fehlen: (id: string) => number;
  trifft: (marke: string, einheitId?: string) => boolean;
  onKauf: (platz: number) => void;
  onBlatt: (platz: number) => void;
  /** Fehlt im Kampf: Dort meldet niemand bereit. */
  onBereit?: () => void;
  /** Nur im Kampf, aufgeklappt: zurueck zur schmalen Leiste. */
  onZuklappen?: () => void;
}): React.JSX.Element {
  const bankVoll = !eigenes.bank.includes(null);
  /* Waechst das Feld zur naechsten Runde? Das sagt die Sicht, nicht die Runde
     hier: Gleich heisst „am Ende", dann steht nichts da. */
  const naechste = eigenes.feldplaetzeNaechsteRunde;
  const waechst = naechste !== undefined && naechste > eigenes.feldplaetze;
  return (
    <section className={stil.laden} aria-label={tz('laden.titel')} data-aufgeklappt={onZuklappen ? '' : undefined}>
      {onZuklappen && (
        <button type="button" className={stil.ladenGriff} onClick={onZuklappen} aria-label={tz('neu.ladenZu')}>
          <i aria-hidden="true" />
        </button>
      )}
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
        {onBereit && (
          <button
            type="button"
            className={stil.bereitknopf}
            data-bereit={eigenes.bereit ? '' : undefined}
            aria-pressed={eigenes.bereit}
            aria-label={tz(eigenes.bereit ? 'laden.bereitGemeldet' : 'laden.bereit')}
            disabled={eigenes.bereit || !darfHandeln}
            onClick={onBereit}
          >
            <Haken />
          </button>
        )}
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
    </section>
  );
}

/**
 * Der zugeklappte Laden im Kampf: die fuenf Karten klein, Gold daneben, das
 * Ganze EIN Knopf, der aufklappt. Gekauft wird hier nicht — eine 40 px
 * schmale Karte ist zu klein, um sie sicher zu treffen, und ein Fehlkauf
 * kostet Gold. Die Arena darueber bleibt dabei moeglichst gross.
 */
export function Shopleiste({
  eigenes,
  plaetze,
  katalog,
  onOeffnen,
}: {
  eigenes: EigeneSicht;
  plaetze: number;
  katalog: Record<string, Einheit>;
  onOeffnen: () => void;
}): React.JSX.Element {
  return (
    <button type="button" className={stil.shopleiste} onClick={onOeffnen} aria-label={tz('neu.ladenOeffnen')}>
      <span className={stil.shopleisteGold} aria-hidden="true">
        <Muenze />
        <strong>{eigenes.gold}</strong>
      </span>
      <span className={stil.shopleisteKarten} aria-hidden="true">
        {Array.from({ length: plaetze }, (_, platz) => {
          const id = eigenes.laden[platz] ?? null;
          const einheit = id ? katalog[id] : undefined;
          return (
            <span key={platz} className={stil.miniKarte} data-rahmen={einheit ? kostenStufe(einheit.kosten) : undefined} data-leer={einheit ? undefined : ''}>
              {einheit && (
                <>
                  <Figur einheit={einheit} klasse={stil.miniFigur} />
                  <em>{preisVon(einheit)}</em>
                </>
              )}
            </span>
          );
        })}
      </span>
      <span className={stil.shopleistePfeil} aria-hidden="true">
        ▴
      </span>
    </button>
  );
}
