/**
 * Die Bahnauswahl der Golf-Lobby: Zufall, Kurs, Filter oder Einzelauswahl
 * (Robins Entscheidung vom 22.09.2026: alles davon).
 *
 * Ein reines Bauteil — gesteuert, ohne eigenen Server: Die Wahl kommt herein
 * und geht über `onWahl` hinaus. Wer sie wohin schickt, entscheidet der
 * Bildschirm (Bot-Tisch: in den Regelsatz beim Anlegen; Gruppe: `setRules`,
 * siehe `useBahnwahl.ts`). Welche Bahnen daraus werden, entscheidet das Modul
 * beim Start; hier wird nichts gezogen.
 *
 * Die Miniaturen zeichnet der echte Zeichner der Partie (`zeichnen.ts`) —
 * dieselbe Bahn, dieselben Farben, nur ohne Bälle. Kein `<img>`: Für vierzig
 * Bahnen gibt es keine Bilder, und eines auf eine Datei, die es nicht gibt,
 * ist der Fehler aus der CLAUDE.md.
 */

import { useEffect, useRef, useState } from 'react';

import { AuswahlFilter, AuswahlRaster, type AuswahlEintrag, passtZurSuche } from '../../hub';
import { t } from '../../i18n';
import { useBestmarken } from './Bahnrekord';
import {
  EIGENE_MAX,
  type Bahnwahl,
  type Lobbydaten,
  ZUFALL,
  beschreibeWahl,
  wahlUnfertig,
} from './bahnwahl';
import { weltMasse } from './kamera';
import type { Karte } from './karte';
import { neuePartie } from './physik';
import { Zeichner } from './zeichnen';

/* --------------------------------------------------------------------------
 * Miniatur
 * ----------------------------------------------------------------------- */

/*
 * Immer nur EINE Miniatur auf einmal malen. Der Zeichner baut je Bahn eine
 * Nebenleinwand von bis zu 2048 px Kante (gut 10 MB); vierzig davon auf
 * einmal kosteten ein schwaches Handy den Grafikspeicher. Nacheinander ist
 * jede nach dem Malen wieder frei — gezeichnet steht nur das kleine Bild.
 */
let malkette: Promise<void> = Promise.resolve();

function naechstesBild(): Promise<void> {
  return new Promise((fertig) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fertig());
    else setTimeout(fertig, 0);
  });
}

function male(leinwand: HTMLCanvasElement, karte: Karte): void {
  const zeichner = new Zeichner(leinwand);
  if (!zeichner.bereit) return;
  zeichner.messe();
  const welt = weltMasse(karte);
  const verhaeltnis = zeichner.seitenverhaeltnis;
  // Die ganze Bahn samt Rahmen, je nachdem, ob Breite oder Höhe drückt.
  const breite = Math.max(welt.breite, verhaeltnis > 0 ? welt.hoehe / verhaeltnis : welt.breite);
  // Null Sitze: eine Bahn ohne Bälle, nur Zonen, Wände, Loch und Fahne.
  const zustand = neuePartie({ saat: 1, sitze: 0, botSitze: [], loecher: 1, karten: [karte] });
  zeichner.zeichne({
    karte,
    zustand,
    vorher: zustand,
    anteil: 0,
    blick: { mx: welt.mx, my: welt.my, breite },
    eigenerSitz: -1,
    ziel: null,
    uhrMs: 0,
    uebersicht: true,
  });
}

/** Eine Bahn als Standbild, gemalt, sobald sie ins Bild kommt. */
export function Bahnminiatur({ karte }: { karte: Karte }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const leinwand = ref.current;
    if (leinwand === null) return;
    let lebt = true;
    const auftrag = (): void => {
      malkette = malkette
        .then(naechstesBild)
        .then(() => {
          if (lebt && leinwand.isConnected) male(leinwand, karte);
        })
        .catch(() => {
          /* Ein Bild weniger — die Kachel hat ihren Namen trotzdem. */
        });
    };
    // Erst malen, wenn sie zu sehen ist: Vierzig Bahnen in einer Liste, von
    // denen am Handy vier im Bild sind.
    if (typeof IntersectionObserver !== 'function') {
      auftrag();
      return () => {
        lebt = false;
      };
    }
    const wache = new IntersectionObserver((eintraege) => {
      if (eintraege.some((e) => e.isIntersecting)) {
        wache.disconnect();
        auftrag();
      }
    });
    wache.observe(leinwand);
    return () => {
      lebt = false;
      wache.disconnect();
    };
  }, [karte]);

  return <canvas ref={ref} className="gf-bw-miniatur" data-golf-miniatur={karte.id} />;
}

/* --------------------------------------------------------------------------
 * Bahnauswahl
 * ----------------------------------------------------------------------- */

type Modus = Bahnwahl['art'];

const MODI: readonly { art: Modus; text: string }[] = [
  { art: 'zufall', text: 'Zufall' },
  { art: 'kurs', text: 'Kurs' },
  { art: 'filter', text: 'Filter' },
  { art: 'eigene', text: 'Einzeln' },
];

const STUFEN = [1, 2, 3, 4, 5] as const;

/** Die Themen einer Bahn als Wörter, z. B. „Sand, Eis". */
/** „… · dein Bestes: 3" hinter den Untertitel, wenn es eine eigene Bestmarke gibt. */
function mitBestmarke(text: string, marke: number | undefined): string {
  return marke === undefined ? text : `${text} · ${t('golf.rekord.eigenes')}: ${marke}`;
}

function themenText(id: string, daten: Lobbydaten): string {
  const namen = (daten.bahnThemen[id] ?? [])
    .map((k) => daten.themen.find((t) => t.kennung === k)?.name)
    .filter((n): n is string => typeof n === 'string');
  return namen.length > 0 ? namen.join(', ') : 'ohne Zonen';
}

/** Der Wechsel in einen Modus: mit einer sinnvollen ersten Wahl statt leer. */
function ersteWahl(art: Modus, daten: Lobbydaten): Bahnwahl {
  switch (art) {
    case 'zufall':
      return ZUFALL;
    case 'kurs':
      return { art: 'kurs', kurs: daten.kurse[0]?.kennung ?? '' };
    case 'filter':
      return { art: 'filter', schwierigkeit: [], thema: null };
    case 'eigene':
      return { art: 'eigene', bahnen: [] };
  }
}

export function Bahnauswahl({
  daten,
  wahl,
  onWahl,
  karten,
}: {
  /** `null`: Der Server liefert keine Lobbydaten — dann steht hier nichts, und es gilt Zufall. */
  daten: Lobbydaten | null;
  wahl: Bahnwahl;
  onWahl: (wahl: Bahnwahl) => void;
  karten: readonly Karte[];
}): React.JSX.Element | null {
  const [suche, setSuche] = useState('');
  const [themaChip, setThemaChip] = useState<string | null>(null);
  // Eigene Bestmarke je Bahn auf der Kachel (Bahnrekord.tsx), nur in der Einzelauswahl.
  const bestmarken = useBestmarken(wahl.art === 'eigene');
  if (daten === null) return null;

  const nachId = new Map(karten.map((k) => [k.id, k]));

  return (
    <section className="gf-bw" aria-label="Bahnen" data-golf-bahnauswahl="">
      <h2 className="gf-bw-titel">Bahnen</h2>
      <div className="gf-stufen gf-bw-modus" role="group" aria-label="Bahnauswahl">
        {MODI.map((m) => (
          <button
            key={m.art}
            type="button"
            data-an={wahl.art === m.art ? '' : undefined}
            aria-pressed={wahl.art === m.art}
            onClick={() => {
              if (wahl.art !== m.art) onWahl(ersteWahl(m.art, daten));
            }}
          >
            {m.text}
          </button>
        ))}
      </div>

      {wahl.art === 'zufall' && (
        <p className="gf-bw-hinweis">Das Spiel zieht die Bahnen aus allen {karten.length}, von leicht bis schwer.</p>
      )}

      {wahl.art === 'kurs' && (
        <>
          <AuswahlRaster
            label="Kurs"
            className="gf-bw-raster"
            spalten={2}
            eintraege={daten.kurse.map((kurs): AuswahlEintrag => {
              const bahnen = kurs.bahnen.map((id) => nachId.get(id));
              const fehlt = bahnen.some((b) => b === undefined);
              const finale = bahnen[bahnen.length - 1];
              return {
                kennung: kurs.kennung,
                titel: kurs.name,
                untertitel: `${kurs.bahnen.length} Löcher · ${kurs.beschreibung}`,
                badge: Math.max(0, ...bahnen.map((b) => b?.schwierigkeit ?? 0)),
                vorschau: finale ? <Bahnminiatur karte={finale} /> : undefined,
                deaktiviert: fehlt ? 'Neue Bahnen — bitte neu laden' : undefined,
              };
            })}
            gewaehlt={wahl.kurs}
            onWahl={(kennung) => onWahl({ art: 'kurs', kurs: kennung })}
          />
          <Folge ids={daten.kurse.find((k) => k.kennung === wahl.kurs)?.bahnen ?? []} karten={nachId} />
        </>
      )}

      {wahl.art === 'filter' && (
        <FilterWahl wahl={wahl} daten={daten} karten={karten} onWahl={onWahl} />
      )}

      {wahl.art === 'eigene' && (
        <>
          <AuswahlFilter
            suchtext={suche}
            onSuchtext={setSuche}
            platzhalter="Bahn suchen…"
            label="Bahnen durchsuchen"
            chips={daten.themen.map((t) => ({ kennung: t.kennung, text: t.name }))}
            chip={themaChip}
            onChip={(k) => setThemaChip((alt) => (alt === k ? null : k))}
          />
          <div className="gf-bw-folgekopf">
            <span>
              Deine Folge: {wahl.bahnen.length}/{EIGENE_MAX}
            </span>
            {wahl.bahnen.length > 0 && (
              <button type="button" className="gf-bw-leeren" onClick={() => onWahl({ art: 'eigene', bahnen: [] })}>
                Leeren
              </button>
            )}
          </div>
          <Folge ids={wahl.bahnen} karten={nachId} />
          {wahlUnfertig(wahl) !== null && <p className="gf-bw-hinweis">{wahlUnfertig(wahl)}</p>}
          <AuswahlRaster
            label="Bahnen"
            className="gf-bw-raster"
            spalten={2}
            mehrfach
            eintraege={karten
              .map((karte): AuswahlEintrag => {
                const platz = wahl.bahnen.indexOf(karte.id);
                return {
                  kennung: karte.id,
                  titel: karte.name,
                  untertitel: mitBestmarke(
                    platz >= 0 ? `Loch ${platz + 1}` : themenText(karte.id, daten),
                    bestmarken.get(karte.id),
                  ),
                  badge: karte.schwierigkeit,
                  vorschau: <Bahnminiatur karte={karte} />,
                  deaktiviert:
                    platz < 0 && wahl.bahnen.length >= EIGENE_MAX ? `Höchstens ${EIGENE_MAX} Löcher` : undefined,
                };
              })
              .filter((e) => passtZurSuche(e, suche))
              .filter((e) => themaChip === null || (daten.bahnThemen[e.kennung] ?? []).includes(themaChip))}
            gewaehlt={wahl.bahnen}
            onWahl={(_kennung, auswahl) => onWahl({ art: 'eigene', bahnen: auswahl })}
            leer="Keine Bahn passt zur Suche."
          />
        </>
      )}
    </section>
  );
}

function FilterWahl({
  wahl,
  daten,
  karten,
  onWahl,
}: {
  wahl: Extract<Bahnwahl, { art: 'filter' }>;
  daten: Lobbydaten;
  karten: readonly Karte[];
  onWahl: (wahl: Bahnwahl) => void;
}): React.JSX.Element {
  /*
   * Nur eine Zählung für den Hinweis — gezogen wird im Modul. Ein Filter ohne
   * Treffer ist dort erlaubt und zieht aus allen; das sagt der Satz darunter.
   */
  const treffer = karten.filter(
    (k) =>
      (wahl.schwierigkeit.length === 0 || wahl.schwierigkeit.includes(k.schwierigkeit)) &&
      (wahl.thema === null || (daten.bahnThemen[k.id] ?? []).includes(wahl.thema)),
  ).length;
  const leer = wahl.schwierigkeit.length === 0 && wahl.thema === null;
  return (
    <div className="gf-bw-filter">
      <span className="gf-bw-zeilentitel">Schwierigkeit</span>
      <div className="aw-chips" role="group" aria-label="Schwierigkeit">
        {STUFEN.map((s) => {
          const an = wahl.schwierigkeit.includes(s);
          return (
            <button
              key={s}
              type="button"
              className="aw-chip"
              aria-pressed={an}
              onClick={() =>
                onWahl({
                  ...wahl,
                  schwierigkeit: an ? wahl.schwierigkeit.filter((x) => x !== s) : [...wahl.schwierigkeit, s],
                })
              }
            >
              Stufe {s}
            </button>
          );
        })}
      </div>
      <span className="gf-bw-zeilentitel">Thema</span>
      <div className="aw-chips" role="group" aria-label="Thema">
        {daten.themen.map((t) => (
          <button
            key={t.kennung}
            type="button"
            className="aw-chip"
            aria-pressed={wahl.thema === t.kennung}
            onClick={() => onWahl({ ...wahl, thema: wahl.thema === t.kennung ? null : t.kennung })}
          >
            {t.name}
          </button>
        ))}
      </div>
      <p className="gf-bw-hinweis" data-golf-treffer={treffer}>
        {leer
          ? 'Ohne Filter zieht das Spiel aus allen Bahnen.'
          : treffer === 0
            ? 'Keine Bahn passt — gezogen wird dann aus allen.'
            : `${treffer} ${treffer === 1 ? 'Bahn passt' : 'Bahnen passen'}. Reichen sie nicht für alle Löcher, füllt das Spiel mit ähnlich schweren auf.`}
      </p>
    </div>
  );
}

/** Eine Bahnfolge als nummerierte Namen. */
function Folge({ ids, karten }: { ids: readonly string[]; karten: ReadonlyMap<string, Karte> }): React.JSX.Element | null {
  if (ids.length === 0) return null;
  return (
    <ol className="gf-bw-folge">
      {ids.map((id) => (
        <li key={id}>{karten.get(id)?.name ?? 'Neue Bahn'}</li>
      ))}
    </ol>
  );
}

/**
 * Was alle anderen in der Gruppe sehen: die Wahl in einem Satz, bei Kurs und
 * Einzelauswahl dazu die Folge.
 */
export function BahnauswahlAnzeige({
  daten,
  wahl,
  karten,
}: {
  daten: Lobbydaten | null;
  wahl: Bahnwahl;
  karten: readonly Karte[];
}): React.JSX.Element {
  const nachId = new Map(karten.map((k) => [k.id, k]));
  const ids =
    wahl.art === 'eigene'
      ? wahl.bahnen
      : wahl.art === 'kurs'
        ? (daten?.kurse.find((k) => k.kennung === wahl.kurs)?.bahnen ?? [])
        : [];
  return (
    <div className="gf-bw gf-bw-anzeige" data-golf-bahnanzeige="">
      <p className="gf-bw-hinweis">
        <strong>Bahnen:</strong> {beschreibeWahl(wahl, daten)}
      </p>
      <Folge ids={ids} karten={nachId} />
    </div>
  );
}
