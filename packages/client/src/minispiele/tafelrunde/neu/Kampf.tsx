/**
 * Der Kampf in TafelrundeNeu — die Arena hochkant aus `arenaReihen`, mit
 * Lebensbalken samt Schildanteil, Manabalken, Sternen und den Effekten von
 * Faehigkeiten und Marken.
 *
 * ES WIRD NICHTS GERECHNET. Die Uhr nimmt die faelligen Ereignisse vom
 * Protokoll (`spieleBisNeu` in abspielen.ts, darunter `wendeAn` der alten
 * Anzeige) und zeichnet, was dasteht. Volles Mana kommt aus der Sicht
 * (`faehigkeiten`), das aktuelle aus jedem Treffer (`manaWer`/`manaZiel`),
 * und beim `faehigkeit`-Ereignis faellt der Balken auf null.
 *
 * DIE UHR: `requestAnimationFrame` treibt sie, neu gezeichnet wird aber nur,
 * wenn ein Ereignis faellig war oder eine Viertelsekunde um ist (Effekte und
 * Zustaende laufen ab). Die Bildfolgen der Figuren schiebt der Takt direkt am
 * Element — dieselbe Ueberlegung wie in der alten Kampfanzeige: Ein Bildwechsel ist
 * keine Aenderung des Kampfes.
 *
 * DER NULLPUNKT gilt fuer die ganze Runde (`nullpunkt`), nicht fuer den
 * gezeigten Kampf: Wer oben einen Mitspieler antippt, sieht dessen Kampf an
 * der Stelle, an der er gerade ist, und nicht von vorn. Wer mitten im Kampf
 * verbindet, springt per `startVersatz` an die richtige Stelle.
 */

import { type ReactNode, useEffect, useRef, useState } from 'react';

import { type Bildstand, type Kampftakt, bildstand, blattVersatz, gleitenMs, zellWeite } from '../bildfolge';
import {
  type Kampfpaarung,
  type Seite,
  gezeichneterPlatz,
  meineSeite,
  startVersatz,
} from '../kampfbericht';
import type { Einheit, Faehigkeit } from '../sicht';
import { einheitName, tz } from '../text';
import { rastermass, wabenLage } from '../zuege';
import {
  type AbspielstandNeu,
  type FigurNeu,
  anfangsstandNeu,
  manaAnteil,
  spieleBisNeu,
  zustandAktiv,
} from './abspielen';
import type { Schauplatz } from '../../../figuren3d/grafik-neu';
import { Arenabild, Raster } from './Feld';
import { Effektbild, Figur, RolleZeichen, Sterne } from './grafik';
import stil from './neu.module.css';

/** Wie lange nach dem letzten Ereignis die Uhr noch laeuft (Ausblenden, Effekte). */
const NACHLAUF_MS = 1500;

/** Wie oft hoechstens neu gezeichnet wird, wenn kein Ereignis faellig war. */
const ZEICHENTAKT_MS = 250;

function naechstesBild(tick: () => void): () => void {
  if (typeof window.requestAnimationFrame === 'function') {
    const h = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(h);
  }
  const h = window.setTimeout(tick, 16);
  return () => window.clearTimeout(h);
}

/** Das Blatt einer Figur auf ihr Bild schieben — nur `transform`, kein Umbruch. */
function bildSchieben(el: HTMLImageElement, stand: Bildstand): void {
  const versatz = blattVersatz(stand);
  if (el.style.transform !== versatz) el.style.transform = versatz;
  const weite = String(zellWeite(stand));
  const kasten = el.parentElement;
  if (kasten && kasten.style.getPropertyValue('--tr-zellweite') !== weite) {
    kasten.style.setProperty('--tr-zellweite', weite);
  }
}

/** Lebensbalken mit Schildanteil — beides als Anteil am hoechsten Leben. */
export function Lebensbalken({
  leben,
  hoechstes,
  schild,
  seite,
}: {
  leben: number;
  hoechstes: number;
  schild: number;
  seite: 'unten' | 'oben';
}): React.JSX.Element {
  const anteil = hoechstes > 0 ? Math.max(0, Math.min(1, leben / hoechstes)) : 0;
  // Der Schild steht RECHTS neben dem Leben und wird am Balkenende gekappt —
  // ein Schild ueber das volle Leben hinaus ist trotzdem sichtbar, nur voll.
  const schildAnteil = hoechstes > 0 ? Math.max(0, Math.min(1 - anteil, schild / hoechstes)) : 0;
  return (
    <span className={stil.lebensbalken} data-seite={seite} aria-hidden="true">
      <i className={stil.leben} style={{ width: `${anteil * 100}%` }} />
      {schildAnteil > 0 && (
        <i className={stil.schildanteil} style={{ left: `${anteil * 100}%`, width: `${schildAnteil * 100}%` }} />
      )}
    </span>
  );
}

/** Manabalken — nur fuer Einheiten mit aktiver Faehigkeit. */
export function Manabalken({ anteil, voll }: { anteil: number; voll: boolean }): React.JSX.Element {
  return (
    <span className={stil.manabalken} data-voll={voll ? '' : undefined} aria-hidden="true">
      <i style={{ width: `${anteil * 100}%` }} />
    </span>
  );
}

interface Anzeige {
  readonly stand: AbspielstandNeu;
  readonly zeitMs: number;
  readonly fuer: string;
}

export function Kampf({
  kampf,
  ich,
  zeigt,
  arenaReihen,
  brettSpalten,
  zeitraffer,
  schrittMs,
  katalog,
  faehigkeiten,
  frist,
  nameVon,
  verblasst,
  rundeBisMs = 0,
  schauplatz,
  nachEnde,
}: {
  /** Der abzuspielende Kampf (der eigene oder der eines angetippten Sitzes). */
  kampf: Kampfpaarung | null;
  ich: number | null;
  /** Aus wessen Sicht gezeichnet wird — seine Seite steht unten. */
  zeigt: number | null;
  arenaReihen: number;
  brettSpalten: number;
  zeitraffer: number;
  schrittMs: number;
  katalog: Record<string, Einheit>;
  faehigkeiten: Record<string, Faehigkeit | null>;
  frist: number | null;
  nameVon: (sitz: number) => string;
  verblasst?: boolean;
  /**
   * Wie lange der laengste Kampf der Runde dauert. Bis dahin laeuft die Uhr
   * weiter, auch wenn der gezeigte Kampf schon vorbei ist — sonst wuesste das
   * Rundenende nicht, welche Paare noch kaempfen (Robin, 27.11.2026: „wirkt
   * wie ein ewig langer Ladebildschirm").
   */
  rundeBisMs?: number;
  /** Fuer die gemalte Arena hinter dem Feld (`Arenabild`); ohne Angabe keine. */
  schauplatz?: Schauplatz;
  /** Was nach dem Ende ueber der Arena steht (das Rundenende), mit dem Stand der Uhr. */
  nachEnde?: (ende: { sieger: Seite | null; seite: Seite | null; schaden: number; zeitMs: number }) => ReactNode;
}): React.JSX.Element | null {
  const bericht = kampf?.bericht ?? null;
  const schluessel = kampf && bericht ? `${kampf.a}:${kampf.b}:${bericht.saat}` : null;
  const takt: Kampftakt = { zeitraffer, schrittMs };
  const [ruhig] = useState<boolean>(
    () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const blaetter = useRef(new Map<number, HTMLImageElement>());
  const quelle = useRef(bericht);
  quelle.current = bericht;
  const nullpunkt = useRef<number | null>(null);
  const [gemeldet, setAnzeige] = useState<Anzeige | null>(null);
  const anzeige: Anzeige | null =
    gemeldet && gemeldet.fuer === schluessel
      ? gemeldet
      : bericht && schluessel
        ? { stand: anfangsstandNeu(bericht), zeitMs: 0, fuer: schluessel }
        : null;

  useEffect(() => {
    if (schluessel === null) return;
    const b = quelle.current;
    if (!b) return;
    const jetzt = Date.now();
    if (nullpunkt.current === null) nullpunkt.current = jetzt - startVersatz(b.dauerMs, frist, jetzt);
    let stand = anfangsstandNeu(b);
    let letzterTakt = -1;
    let lebt = true;
    let anhalten = (): void => {};
    // Die Uhr laeuft bis zum Ende der RUNDE, nicht nur des gezeigten Kampfes.
    const schluss = Math.max(b.dauerMs, rundeBisMs) + NACHLAUF_MS;
    const tick = (): void => {
      if (!lebt) return;
      const zeitMs = Math.max(0, Math.min(Date.now() - nullpunkt.current!, schluss));
      const neu = spieleBisNeu(stand, b, zeitMs);
      const zeichentakt = Math.floor(zeitMs / ZEICHENTAKT_MS);
      if (neu !== stand || zeichentakt !== letzterTakt) {
        stand = neu;
        letzterTakt = zeichentakt;
        setAnzeige({ stand: neu, zeitMs, fuer: schluessel });
      }
      for (const f of stand.figuren) {
        const el = blaetter.current.get(f.id);
        if (el) bildSchieben(el, bildstand(f, zeitMs, takt, ruhig));
      }
      if (zeitMs >= schluss) return;
      anhalten = naechstesBild(tick);
    };
    anhalten = naechstesBild(tick);
    return () => {
      lebt = false;
      anhalten();
    };
    // Am Schluessel des Kampfes, nicht am Bericht-Objekt (CLAUDE.md).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  if (!kampf || !bericht || !anzeige) return null;

  const seite = meineSeite(kampf, zeigt);
  const ichSeite = meineSeite(kampf, ich);
  const gedreht = seite === 1;
  const unten: Seite = seite ?? 0;
  const felder = arenaReihen * brettSpalten;
  const mass = rastermass(arenaReihen, brettSpalten);
  const sitzVon = (s: Seite): number => (s === 0 ? kampf.a : kampf.b);
  const beschriftung = (s: Seite): string => {
    const name = s === ichSeite ? tz('leiste.du') : nameVon(sitzVon(s));
    return s === 1 && kampf.geist ? tz('kampf.abbildVon', { name }) : name;
  };
  const stehende = (s: Seite): number => anzeige.stand.figuren.filter((f) => f.seite === s && !f.tot).length;
  const gesamt = (s: Seite): number => bericht.start.filter((f) => f.seite === s).length;
  const oben: Seite = unten === 0 ? 1 : 0;

  return (
    <section
      className={stil.kampf}
      data-verblasst={verblasst ? '' : undefined}
      role="group"
      aria-label={tz('kampf.titel')}
    >
      <p className={stil.kampfSeite} data-lage="oben">
        <strong>{beschriftung(oben)}</strong>
        <span>{tz('kampf.stehen', { stehen: stehende(oben), gesamt: gesamt(oben) })}</span>
      </p>
      <div className={stil.arenaRahmen}>
        <div className={stil.arena} style={{ '--verhaeltnis': mass.seitenverhaeltnis } as React.CSSProperties}>
          {schauplatz && <Arenabild schauplatz={schauplatz} art="ganz" />}
          {/* Das Raster nur als Hauch: Im Kampf ist es Orientierung, nicht Bedienung. */}
          <Raster reihen={arenaReihen} spalten={brettSpalten} klasse={stil.arenaRaster} />
          {anzeige.stand.figuren.map((f) => (
            <Kampffigur
              blicktLinks={blicktLinks(f.blick, (platz) => {
                const p = gezeichneterPlatz(platz, felder, gedreht);
                return wabenLage(mass, Math.floor(p / brettSpalten), p % brettSpalten).links;
              })}
              key={f.id}
              f={f}
              einheit={katalog[f.einheitId]}
              voll={faehigkeiten[f.einheitId]?.art === 'aktiv' ? faehigkeiten[f.einheitId]!.mana : null}
              zeitMs={anzeige.zeitMs}
              lage={wabenLage(mass, Math.floor(gezeichneterPlatz(f.platz, felder, gedreht) / brettSpalten), gezeichneterPlatz(f.platz, felder, gedreht) % brettSpalten)}
              breite={mass.wabenBreite}
              hoehe={mass.wabenHoehe}
              reihe={Math.floor(gezeichneterPlatz(f.platz, felder, gedreht) / brettSpalten)}
              seite={f.seite === unten ? 'unten' : 'oben'}
              gleitenMs={gleitenMs(takt)}
              effekte={anzeige.stand.effekte.filter((x) => x.figur === f.id)}
              gib={(el) => {
                if (el) blaetter.current.set(f.id, el);
                else blaetter.current.delete(f.id);
              }}
            />
          ))}
        </div>
      </div>
      <p className={stil.kampfSeite} data-lage="unten">
        <strong>{beschriftung(unten)}</strong>
        <span>{tz('kampf.stehen', { stehen: stehende(unten), gesamt: gesamt(unten) })}</span>
      </p>
      {anzeige.stand.ende &&
        nachEnde?.({
          sieger: anzeige.stand.ende.sieger,
          seite: ichSeite,
          schaden: anzeige.stand.ende.sieger === null ? 0 : bericht.schaden,
          zeitMs: anzeige.zeitMs,
        })}
    </section>
  );
}

/**
 * Schaut die Figur nach links? Aus ihrem letzten Blick (`FigurNeu.blick`),
 * gemessen an der GEZEICHNETEN Lage — bei gedrehter Arena ist links und rechts
 * vertauscht. null: kein Blick bisher oder senkrecht (gleiche Spalte), dann
 * bleibt die Grundrichtung der Seite.
 */
function blicktLinks(
  blick: FigurNeu['blick'],
  links: (platz: number) => number,
): boolean | null {
  if (!blick) return null;
  const dx = links(blick.nach) - links(blick.von);
  if (Math.abs(dx) < 0.01) return null;
  return dx < 0;
}

function Kampffigur({
  blicktLinks: links,
  f,
  einheit,
  voll,
  zeitMs,
  lage,
  breite,
  hoehe,
  reihe,
  seite,
  gleitenMs: gleiten,
  effekte,
  gib,
}: {
  /** Siehe `blicktLinks`; null heisst Grundrichtung (unten rechts, oben links). */
  blicktLinks: boolean | null;
  f: FigurNeu;
  einheit: Einheit | undefined;
  voll: number | null;
  zeitMs: number;
  lage: { links: number; oben: number };
  breite: number;
  hoehe: number;
  reihe: number;
  seite: 'unten' | 'oben';
  gleitenMs: number;
  effekte: AbspielstandNeu['effekte'];
  gib: (el: HTMLImageElement | null) => void;
}): React.JSX.Element {
  const mana = manaAnteil(f.mana, voll);
  const name = einheit ? einheitName(einheit) : f.einheitId;
  return (
    <div
      className={stil.kampfFigur}
      data-seite={seite}
      data-tot={f.tot ? '' : undefined}
      data-betaeubt={zustandAktiv(f, 'betaeubt', zeitMs) ? '' : undefined}
      data-langsam={zustandAktiv(f, 'langsam', zeitMs) ? '' : undefined}
      data-brand={zustandAktiv(f, 'brand', zeitMs) ? '' : undefined}
      data-kampfgeist={zustandAktiv(f, 'kampfgeist', zeitMs) ? '' : undefined}
      data-panzer={zustandAktiv(f, 'panzer', zeitMs) || zustandAktiv(f, 'schildwall', zeitMs) ? '' : undefined}
      data-wirkt={f.faehigkeitAb !== null && zeitMs - f.faehigkeitAb < 500 ? '' : undefined}
      style={
        {
          left: `${lage.links}%`,
          top: `${lage.oben}%`,
          width: `${breite}%`,
          height: `${hoehe}%`,
          zIndex: 10 + reihe,
          '--gleiten': `${gleiten}ms`,
        } as React.CSSProperties
      }
      aria-label={tz('kampf.figur', {
        name,
        stufe: f.stufe,
        zustand: f.tot ? tz('kampf.gefallen') : tz('kampf.leben', { leben: f.leben, hoechstes: f.hoechstesLeben }),
      })}
    >
      {!f.tot && (
        <span className={stil.kampfKopf}>
          <Sterne stufe={f.stufe} klasse={stil.kampfSterne} />
          <Lebensbalken leben={f.leben} hoechstes={f.hoechstesLeben} schild={f.schild} seite={seite} />
          {mana !== null && <Manabalken anteil={mana} voll={mana >= 1} />}
        </span>
      )}
      {einheit && <Figur einheit={einheit} klasse={stil.arenaFigur} spiegeln={links ?? seite === 'oben'} gib={gib} />}
      {einheit && !f.tot && <RolleZeichen rolle={einheit.rolle} klasse={stil.sockel} />}
      {effekte.map((x) => (
        <Effektbild key={x.schluessel} name={x.name} wirker={x.wirker} />
      ))}
      {f.treffer > 0 && f.letzterSchaden > 0 && (
        <span key={`t${f.treffer}`} className={stil.zahl} data-art="schaden" aria-hidden="true">
          −{f.letzterSchaden}
        </span>
      )}
      {f.heilungen > 0 && (
        <span key={`h${f.heilungen}`} className={stil.zahl} data-art="heilung" aria-hidden="true">
          +{f.letzteHeilung}
        </span>
      )}
    </div>
  );
}
