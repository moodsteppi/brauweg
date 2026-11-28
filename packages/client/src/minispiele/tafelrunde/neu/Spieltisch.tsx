/**
 * Der Spieltisch von TafelrundeNeu: Ruestphase und Kampf, mit allen Blaettern
 * darueber. Bekommt alles als Eigenschaft herein und zeichnet deshalb auch
 * ohne Server — die Probe `/probe/tafelrunde-neu` haengt ihn mit einer
 * aufgezeichneten Sicht ein.
 *
 * DIE LOGIK IST DIE DER ALTEN RUESTKAMMER (screens/Tafelrunde.tsx, am
 * 28.11.2026 entfernt), uebernommen und
 * nicht neu erfunden: dieselbe Sperre bis zur naechsten Revision
 * (`gesendet`), dieselben Pruefungen beim Ziehen (`darfSchieben`, zwei Zahlen
 * der Sicht), dieselbe Ableitung von Kaufen, Wuerfeln, Rang und Verkaufen aus
 * `legalActions`. Die Begruendungen stehen dort ausfuehrlich; hier steht der
 * Kern, damit niemand beim Lesen hinueberspringen muss.
 *
 * AUFBAU HOCHKANT, von oben nach unten: Kopfband (Mitspieler, Runde, Zeit),
 * Markenleiste, das gemalte Feld mit beiden Brettern, die Bank, der Laden.
 * Laden und Bank unten, in Daumenreichweite. Im Kampf nimmt die Arena die
 * ganze Flaeche unter dem Kopfband.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { schauplatzFuerPartie } from '../../../figuren3d/grafik-neu';
import { type Kampfpaarung, type Paarungsergebnis, abzuspielen } from '../kampfbericht';
import { eigenerPlatz, gegnerDieseRunde } from '../platzierung';
import type { Einheit, Faehigkeit, Stufenwerte, TafelrundeSicht } from '../sicht';
import { type Synergie, type Synergiestand, markennamen, schwellenPruefer } from '../marken';
import { einheitName, tz } from '../text';
import {
  type Ort,
  bestandVon,
  darfSchieben,
  fehlendeKopien,
  neuVerschmolzen,
  ortSchluessel,
  rastermass,
  tippfolge,
} from '../zuege';
import { useZiehen } from '../ziehen';
import { Abschluss } from './Abschluss';
import { Bank } from './Bank';
import { Einheitenblatt } from './Einheitenblatt';
import { Feld, Hexbrett, Schauplatzgrund, aufBrett } from './Feld';
import { Figur, Sterne } from './grafik';
import { Kampf } from './Kampf';
import { Kopfband, type Sitzzeile, sitzName } from './Kopfband';
import { Laden } from './Laden';
import { Markenleiste, Markenpopup } from './Markenleiste';
import stil from './neu.module.css';
import { Regelblatt } from './Regelblatt';
import { Rundenende, Zuschauen } from './Rundenende';

/**
 * Die Aktionen des Moduls (partie.ts). `neuwuerfeln` und `levelAuf` gibt es
 * seit dem 27.11.2026 abends nicht mehr (Robin) — die Feldplaetze wachsen mit
 * der Runde, und der Laden ist, was er ist. Kommen sie in einer alten Liste
 * noch vor, bietet dieser Bildschirm sie nicht an.
 */
export type Aktion =
  | { typ: 'kaufen'; platz: number }
  | { typ: 'neuwuerfeln' }
  | { typ: 'levelAuf' }
  | { typ: 'verschieben'; von: Ort; nach: Ort }
  | { typ: 'verkaufen'; ort: Ort }
  | { typ: 'bereit' };

/**
 * Was nur in der ERSTEN Sicht kommt und festgehalten werden muss (sicht.ts,
 * `seit === 0`): Katalog, Synergietabelle, Stufenwerte, Faehigkeiten.
 */
export interface Tischwissen {
  katalog: Record<string, Einheit>;
  synergieTabelle: Synergie[];
  stufenwerte: Record<string, Stufenwerte[]>;
  faehigkeiten: Record<string, Faehigkeit | null>;
}

/** Leere Liste als Konstante — ein `?? []` je Bild waere je Rundruf eine neue Abhaengigkeit. */
const OHNE_SYNERGIEN: Synergiestand[] = [];

/** Wie lange die Arena nach dem Phasenwechsel noch verblasst. */
const AUSKLANG_MS = 400;

/**
 * Welche Kaempfe die Arena zeigt — und ob sie gerade verblasst. An der PHASE
 * gehaengt, nicht am Sichtobjekt (CLAUDE.md); Abschrift von `useKampfbild`
 * im alten Bildschirm.
 */
function useKampfbild(sicht: TafelrundeSicht): { kaempfe: Kampfpaarung[]; verblasst: boolean } | null {
  const kaempfe = sicht.phase === 'kampf' ? (sicht.kaempfe ?? []) : [];
  const laeuft = kaempfe.length > 0;
  const zuletzt = useRef<Kampfpaarung[] | null>(null);
  const [ausklang, setAusklang] = useState<Kampfpaarung[] | null>(null);
  if (laeuft) zuletzt.current = kaempfe;

  useEffect(() => {
    if (sicht.phase === 'kampf') {
      setAusklang(null);
      return;
    }
    const alte = zuletzt.current;
    if (!alte) return;
    zuletzt.current = null;
    setAusklang(alte);
    const uhr = window.setTimeout(() => setAusklang(null), AUSKLANG_MS);
    return () => window.clearTimeout(uhr);
  }, [sicht.phase]);

  if (laeuft) return { kaempfe, verblasst: false };
  if (ausklang) return { kaempfe: ausklang, verblasst: true };
  return null;
}

/** Schluessel der Runde: die Saaten aller Kaempfe (siehe `kampfSchluessel` im alten Bildschirm). */
function kampfSchluessel(kaempfe: readonly Kampfpaarung[]): string {
  return kaempfe.length === 0 ? 'keiner' : kaempfe.map((k) => k.bericht.saat).join('|');
}

export function Spieltisch({
  tischKennung,
  sicht,
  wissen,
  legaleZuege,
  revision,
  frist,
  rundenfrist,
  sitze,
  trophaeen,
  onAktion,
  onZurueck,
  onNochmal,
}: {
  /** Kennung des Tisches — aus ihr kommt der Schauplatz der Partie. */
  tischKennung: string;
  sicht: TafelrundeSicht;
  wissen: Tischwissen;
  legaleZuege: readonly Aktion[];
  revision: number;
  /** Frist der Schaupause (`interludeDeadline`), waehrend des Kampfes. */
  frist: number | null;
  /** Frist der Ruestphase (`phaseDeadline`). */
  rundenfrist: number | null;
  sitze: readonly Sitzzeile[];
  /** Gebuchte Trophaeen je Sitz (`party.trophies`), erst nach dem Ende. */
  trophaeen?: readonly { seat: number; delta: number }[];
  onAktion: (aktion: Aktion) => void;
  onZurueck: () => void;
  onNochmal: () => void;
}): React.JSX.Element {
  const { katalog, synergieTabelle, stufenwerte, faehigkeiten } = wissen;
  const eigenes = sicht.eigenes;
  const kampfbild = useKampfbild(sicht);
  /* EIN Schauplatz fuer die ganze Partie (Robin, 27.11.2026: "Map ist fuer
     das Spiel festgelegt"), aus der Tischkennung — in Ruestphase und Kampf
     derselbe, auf jedem Geraet am Tisch derselbe. */
  const schauplatz = schauplatzFuerPartie(tischKennung);

  const [gezeigterGegner, setGezeigterGegner] = useState<number | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);
  const [endbildWeg, setEndbildWeg] = useState<'aus' | 'ende' | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Ort | null>(null);
  const [blatt, setBlatt] = useState<{ sitz: number | null; ort: Ort } | null>(null);
  const [ladenBlatt, setLadenBlatt] = useState<number | null>(null);
  /** Die angetippte Marke: Farbring an allen Traegern, bis sie abgewaehlt wird. */
  const [marke, setMarke] = useState<string | null>(null);
  /** Ob das Pop-up dazu offen ist — es kann zu sein, waehrend der Ring bleibt. */
  const [markePopup, setMarkePopup] = useState<string | null>(null);

  /* Die Wahl des gezeigten Mitspielers gilt bis zum Phasenwechsel — ein
     Blick aufs Nachbarbrett darf einen nicht den eigenen Kampf kosten. */
  useEffect(() => {
    setGezeigterGegner(null);
  }, [sicht.phase]);

  // --- Senden mit Sperre ---------------------------------------------------

  /* Eine abgesetzte Aktion sperrt bis zur naechsten Revision; nach 2,5 s geht
     die Sperre von selbst auf, falls der Server ablehnt (Revision bleibt). */
  const [gesendet, setGesendet] = useState<number | null>(null);
  useEffect(() => {
    setGesendet((alt) => (alt !== null && revision > alt ? null : alt));
  }, [revision]);
  useEffect(() => {
    if (gesendet === null) return;
    const uhr = window.setTimeout(() => setGesendet(null), 2500);
    return () => window.clearTimeout(uhr);
  }, [gesendet]);
  const wartet = gesendet !== null;

  const schicke = useCallback(
    (aktion: Aktion): void => {
      if (wartet) return;
      setGesendet(revision);
      setGewaehlt(null);
      setBlatt(null);
      setLadenBlatt(null);
      onAktion(aktion);
    },
    [wartet, revision, onAktion],
  );

  // --- Verschmelzen sichtbar machen ----------------------------------------

  const letzterBestand = useRef<Map<string, number> | null>(null);
  const [verschmolzen, setVerschmolzen] = useState<{ id: string; stufe: number; marke: number } | null>(null);
  useEffect(() => {
    if (!eigenes) return;
    const jetzt = bestandVon(eigenes);
    const vorher = letzterBestand.current;
    letzterBestand.current = jetzt;
    if (!vorher) return;
    const frisch = neuVerschmolzen(vorher, jetzt);
    if (frisch) setVerschmolzen({ ...frisch, marke: Date.now() });
  }, [eigenes]);
  // Am Zeitstempel, nicht am Objekt — sonst raeumt jeder Rundruf den Timer ab.
  useEffect(() => {
    if (!verschmolzen) return;
    const uhr = window.setTimeout(() => setVerschmolzen(null), 2200);
    return () => window.clearTimeout(uhr);
  }, [verschmolzen?.marke]);

  // --- Ziehen und Antippen -------------------------------------------------

  const darfHandeln = eigenes?.darfHandeln === true && !wartet;
  const zielbar = useCallback(
    (von: Ort, nach: Ort): boolean => (eigenes ? darfSchieben(eigenes, von, nach) : false),
    [eigenes],
  );
  const schiebe = useCallback(
    (von: Ort, nach: Ort): void => {
      if (!darfHandeln || !zielbar(von, nach)) return;
      schicke({ typ: 'verschieben', von, nach });
    },
    [darfHandeln, zielbar, schicke],
  );
  /* Antippen: waehlen heisst seit dem alten Bildschirm „Blatt aufschlagen";
     das Blatt setzt die Auswahl dann ueber seinen Aufstellen-Knopf. */
  const tippeOrt = useCallback(
    (ort: Ort): void => {
      if (!darfHandeln || !eigenes) return;
      const folge = tippfolge(eigenes, gewaehlt, ort);
      if (folge.art === 'waehlen') setBlatt({ sitz: null, ort: folge.ort });
      else if (folge.art === 'abwaehlen') setGewaehlt(null);
      else if (folge.art === 'schieben') schiebe(folge.von, folge.nach);
    },
    [darfHandeln, eigenes, gewaehlt, schiebe],
  );
  const sieheNach = useCallback((sitz: number | null, ort: Ort): void => {
    setBlatt({ sitz, ort });
  }, []);
  const { zug, ziehtVon, ablegeZiel, zeiger } = useZiehen({
    darf: darfHandeln,
    zielbar,
    tippe: tippeOrt,
    schiebe,
  });

  // --- Ableitungen aus legalActions ----------------------------------------

  const kaufbar = useMemo(() => {
    const raus = new Set<number>();
    for (const z of legaleZuege) if (z.typ === 'kaufen') raus.add(z.platz);
    return raus;
  }, [legaleZuege]);
  const verkaufbar = useMemo(() => {
    const raus = new Set<string>();
    for (const z of legaleZuege) if (z.typ === 'verkaufen') raus.add(ortSchluessel(z.ort));
    return raus;
  }, [legaleZuege]);
  /* Der erste freie Bankplatz — dieselbe Wahl wie das Modul beim Kauf. */
  const freierBankplatz = useMemo<number | null>(() => {
    if (!eigenes) return null;
    for (let platz = 0; platz < sicht.bankPlaetze; platz += 1) {
      if (!(eigenes.bank[platz] ?? null)) return platz;
    }
    return null;
  }, [eigenes, sicht.bankPlaetze]);
  const bestand = useMemo(() => (eigenes ? bestandVon(eigenes) : new Map<string, number>()), [eigenes]);
  const fehlen = useCallback(
    (id: string): number => fehlendeKopien(bestand, sicht.verschmelzZahl, id, 1),
    [bestand, sicht.verschmelzZahl],
  );
  const eigeneSynergien = eigenes?.synergien ?? OHNE_SYNERGIEN;
  const trifft = useMemo(() => schwellenPruefer(eigeneSynergien, synergieTabelle), [eigeneSynergien, synergieTabelle]);
  const namen = useMemo(() => markennamen(synergieTabelle), [synergieTabelle]);

  // --- Wer gezeigt wird -----------------------------------------------------

  const zeile = (sitz: number): Sitzzeile | undefined => sitze.find((s) => s.seat === sitz);
  /* In der Ruestphase kennt die Sicht den naechsten Gegner schon
     (`naechsterGegner`, Robin 28.11.2026) — er ist dort der Vorschlag fuer das
     obere Brett und in der Leiste rot umrandet wie im Kampf. */
  const naechster = eigenes?.naechsterGegner ?? null;
  const gegnerJetzt = gegnerDieseRunde(sicht.kaempfe, sicht.ich) ?? naechster?.sitz ?? null;
  const lebendeGegner = sicht.gegner.filter((g) => g.ausRunde === null);
  const gegner =
    sicht.gegner.find((g) => g.sitz === gezeigterGegner) ??
    sicht.gegner.find((g) => g.sitz === naechster?.sitz) ??
    lebendeGegner[0] ??
    sicht.gegner[0];
  const gegnerTitel = (sitz: number): string => {
    const name = sitzName(zeile(sitz), sitz, sitze);
    if (naechster?.sitz !== sitz) return tz('neu.feldVon', { name });
    return tz(naechster.geist ? 'neu.naechsterGeist' : 'neu.naechsterGegner', { name });
  };

  /* Wessen Kampf: der Angetippte (wenn er antritt), sonst meiner, sonst irgendeiner. */
  const schauKaempfe = kampfbild?.kaempfe ?? [];
  const eigenerKampf = eigenes !== null && eigenes.ausRunde === null;
  const kampfSitz =
    gezeigterGegner !== null && abzuspielen(schauKaempfe, gezeigterGegner) !== null
      ? gezeigterGegner
      : eigenerKampf
        ? sicht.ich
        : (schauKaempfe[0]?.a ?? null);
  const kampf = kampfbild ? abzuspielen(kampfbild.kaempfe, kampfSitz) : null;
  /* Alle Paare der Runde als Ergebnis (`paarungen` aus der Sicht, sonst aus
     den Kaempfen) und wie lange der laengste dauert — bis dahin laeuft die
     Uhr der Arena weiter, auch nach dem eigenen Ende. */
  const paarungen: Paarungsergebnis[] =
    sicht.paarungen ??
    (kampfbild?.kaempfe ?? []).map((k) => ({
      a: k.a,
      b: k.b,
      geist: k.geist,
      sieger: k.bericht.sieger,
      schaden: k.bericht.schaden,
      dauerMs: k.bericht.dauerMs,
    }));
  const rundeBisMs = Math.max(0, ...paarungen.map((p) => p.dauerMs));

  // --- Blaetter --------------------------------------------------------------

  /* Frisch aus der Sicht gelesen, nicht beim Antippen festgehalten: Unter dem
     Blatt kann sich der Platz aendern (Kauf verschmilzt, Runde endet). */
  const blattKaempfer = (() => {
    if (!blatt) return null;
    if (blatt.sitz === null) {
      if (!eigenes) return null;
      const reihe = blatt.ort.bereich === 'bank' ? eigenes.bank : eigenes.brett;
      return reihe[blatt.ort.platz] ?? null;
    }
    if (!gegner || gegner.sitz !== blatt.sitz || blatt.ort.bereich !== 'brett') return null;
    return gegner.brett[blatt.ort.platz] ?? null;
  })();
  const blattEinheit = blattKaempfer ? katalog[blattKaempfer.id] : undefined;
  const blattWerte = blattKaempfer && blattEinheit ? stufenwerte[blattEinheit.id]?.[blattKaempfer.stufe - 1] : undefined;
  const blattNurLesen = blatt !== null && (blatt.sitz !== null || !darfHandeln);
  const ladenEinheit = ladenBlatt !== null && eigenes ? katalog[eigenes.laden[ladenBlatt] ?? ''] : undefined;

  const waehleMarke = (m: string): void => {
    // Dieselbe Marke noch einmal: Ring weg, kein Pop-up — abgewaehlt.
    if (marke === m && markePopup === null) {
      setMarke(null);
      return;
    }
    setMarke(m);
    setMarkePopup(m);
  };

  const endanlass: 'aus' | 'ende' | null = sicht.fertig
    ? 'ende'
    : eigenes && eigenes.ausRunde !== null
      ? 'aus'
      : null;

  const kampfLaeuft = kampfbild !== null;
  const brettSitz = eigenes ? null : (gegner?.sitz ?? null);
  const staende = eigenes ? eigeneSynergien : (gegner?.synergien ?? OHNE_SYNERGIEN);
  const eigenesBrett = eigenes?.brett ?? [];

  const zwischenstand = [
    ...(eigenes ? [{ sitz: eigenes.sitz, leben: eigenes.leben, aus: eigenes.ausRunde !== null, ich: true }] : []),
    ...sicht.gegner.map((g) => ({ sitz: g.sitz, leben: g.leben, aus: g.ausRunde !== null, ich: false })),
  ].map((z) => ({ ...z, name: sitzName(zeile(z.sitz), z.sitz, sitze) }));

  const gezogen =
    zug && eigenes ? ((zug.von.bereich === 'bank' ? eigenes.bank : eigenes.brett)[zug.von.platz] ?? null) : null;

  return (
    <main className={stil.tisch} data-phase={kampfLaeuft ? 'kampf' : 'ruesten'}>
      {/* Der Schauplatz als Grund des GANZEN Bildschirms, von Rand zu Rand und
          unter die Safe Areas (Robin, 27.11.2026: "Full screen ... voll
          integriert"). Kopfband, Bank und Laden liegen als halbdurchsichtige
          Ebenen darueber — nicht als eigene Bloecke mit eigenem Grund. */}
      <Schauplatzgrund schauplatz={schauplatz} />
      <Kopfband
        sicht={sicht}
        sitze={sitze}
        gegnerJetzt={gegnerJetzt}
        gezeigt={kampfLaeuft ? kampfSitz : (gegner?.sitz ?? null)}
        frist={frist ?? rundenfrist}
        onWahl={(sitz) => setGezeigterGegner(sitz === sicht.ich ? null : sitz)}
        onZurueck={onZurueck}
        onRegeln={() => setRegelnOffen(true)}
      />

      {kampfLaeuft ? (
        <div className={stil.kampfFlaeche}>
          {kampf ? (
            <Kampf
              key={kampfSchluessel(kampfbild.kaempfe)}
              kampf={kampf}
              ich={sicht.ich}
              zeigt={kampfSitz}
              arenaReihen={sicht.arenaReihen}
              brettSpalten={sicht.brettSpalten}
              zeitraffer={sicht.zeitraffer}
              schrittMs={sicht.schrittMs}
              katalog={katalog}
              faehigkeiten={faehigkeiten}
              frist={frist}
              nameVon={(sitz) => sitzName(zeile(sitz), sitz, sitze)}
              verblasst={kampfbild.verblasst}
              rundeBisMs={rundeBisMs}
              nachEnde={(ende) => (
                <Rundenende
                  sieger={ende.sieger}
                  seite={ende.seite}
                  schaden={ende.schaden}
                  geist={kampf.geist}
                  stand={zwischenstand}
                >
                  <Zuschauen
                    paarungen={paarungen}
                    gezeigt={kampf}
                    ich={sicht.ich}
                    zeitMs={ende.zeitMs}
                    nameVon={(sitz) => sitzName(zeile(sitz), sitz, sitze)}
                    onWahl={(sitz) => setGezeigterGegner(sitz)}
                    onEigener={eigenerKampf && kampfSitz !== sicht.ich ? () => setGezeigterGegner(null) : undefined}
                  />
                </Rundenende>
              )}
            />
          ) : (
            <p className={stil.hinweis}>{tz('kampf.heereTretenAn')}</p>
          )}
          {eigenerKampf && kampfSitz !== sicht.ich && (
            <button type="button" className={stil.zweitknopf} onClick={() => setGezeigterGegner(null)}>
              {tz('kampf.zurueckZuDeinem')}
            </button>
          )}
        </div>
      ) : (
        <>
          <Markenleiste staende={staende} tabelle={synergieTabelle} gewaehlt={marke} onWahl={waehleMarke} />
          <Feld
            verhaeltnis={rastermass(sicht.brettReihen, sicht.brettSpalten).seitenverhaeltnis}
            gegner={
              eigenes && gegner ? (
                <>
                <p className={stil.feldName} data-naechster={naechster?.sitz === gegner.sitz ? '' : undefined}>
                  {gegnerTitel(gegner.sitz)}
                </p>
                <Hexbrett
                  reihen={sicht.brettReihen}
                  spalten={sicht.brettSpalten}
                  felder={gegner.brett}
                  katalog={katalog}
                  gespiegelt
                  aktiv={false}
                  gewaehlt={null}
                  ablegeZiel={null}
                  ziehtVon={null}
                  marke={null}
                  onNachsehen={(ort) => sieheNach(gegner.sitz, ort)}
                  beschriftung={tz('neu.feldVon', { name: sitzName(zeile(gegner.sitz), gegner.sitz, sitze) })}
                />
                </>
              ) : null
            }
          >
            {eigenes && eigenes.belegt === 0 && <p className={stil.leerSatz}>{tz('brett.leer')}</p>}
            <Hexbrett
              reihen={sicht.brettReihen}
              spalten={sicht.brettSpalten}
              felder={eigenes ? eigenesBrett : (gegner?.brett ?? [])}
              katalog={katalog}
              eigen={eigenes !== null}
              aktiv={darfHandeln}
              gewaehlt={gewaehlt}
              istZiel={gewaehlt ? (ort) => zielbar(gewaehlt, ort) : undefined}
              ablegeZiel={ablegeZiel}
              ziehtVon={ziehtVon}
              zeiger={zeiger}
              onTippe={tippeOrt}
              onNachsehen={(ort) => sieheNach(brettSitz, ort)}
              marke={marke}
              beschriftung={tz('neu.deinFeld')}
            />
          </Feld>

          {eigenes && eigenes.ausRunde === null && !sicht.fertig && (
            <>
              <Bank
                plaetze={sicht.bankPlaetze}
                bank={eigenes.bank}
                katalog={katalog}
                aktiv={darfHandeln}
                gewaehlt={gewaehlt}
                istZiel={gewaehlt ? (ort) => zielbar(gewaehlt, ort) : undefined}
                ablegeZiel={ablegeZiel}
                ziehtVon={ziehtVon}
                zeiger={zeiger}
                onTippe={tippeOrt}
                onNachsehen={(ort) => sieheNach(null, ort)}
                marke={marke}
              />
              {gewaehlt && darfHandeln ? (
                <div className={stil.auswahlband} role="status">
                  <span>{tz('hinweis.ziel')}</span>
                  <button type="button" className={stil.zweitknopf} onClick={() => setGewaehlt(null)}>
                    {tz('abbrechen')}
                  </button>
                </div>
              ) : (
                <Laden
                  eigenes={eigenes}
                  plaetze={sicht.ladenPlaetze}
                  katalog={katalog}
                  kaufbar={kaufbar}
                  darfHandeln={darfHandeln}
                  fehlen={fehlen}
                  trifft={trifft}
                  onKauf={(platz) => schicke({ typ: 'kaufen', platz })}
                  onBlatt={setLadenBlatt}
                  onBereit={() => schicke({ typ: 'bereit' })}
                />
              )}
            </>
          )}
          {!eigenes && <p className={stil.hinweis}>{tz('zuschauer.hinweis')}</p>}
          {eigenes && eigenes.ausRunde !== null && !sicht.fertig && (
            <p className={stil.hinweis}>{tz('ausgeschieden.hinweis', { n: eigenes.ausRunde })}</p>
          )}
        </>
      )}

      {/* ---- Blaetter -------------------------------------------------- */}
      {blatt && blattKaempfer && blattEinheit && (
        <Einheitenblatt
          einheit={blattEinheit}
          kaempfer={blattKaempfer}
          werte={blattWerte}
          faehigkeit={faehigkeiten[blattEinheit.id]}
          markennamen={namen}
          erloes={blattWerte?.erloes}
          onVerkaufen={
            !blattNurLesen && verkaufbar.has(ortSchluessel(blatt.ort))
              ? () => schicke({ typ: 'verkaufen', ort: blatt.ort })
              : undefined
          }
          onAufstellen={
            blattNurLesen
              ? undefined
              : () => {
                  setGewaehlt(blatt.ort);
                  setBlatt(null);
                }
          }
          aufstellenTitel={tz(blatt.ort.bereich === 'bank' ? 'knopf.aufstellen' : 'knopf.verschieben')}
          onMarke={(m) => setMarkePopup(m)}
          escapeAus={markePopup !== null}
          onSchliessen={() => setBlatt(null)}
        />
      )}
      {ladenBlatt !== null && ladenEinheit && (
        <Einheitenblatt
          einheit={ladenEinheit}
          kaempfer={{ id: ladenEinheit.id, stufe: 1 }}
          werte={stufenwerte[ladenEinheit.id]?.[0]}
          faehigkeit={faehigkeiten[ladenEinheit.id]}
          markennamen={namen}
          onKaufen={kaufbar.has(ladenBlatt) && darfHandeln ? () => schicke({ typ: 'kaufen', platz: ladenBlatt }) : undefined}
          onMarke={(m) => setMarkePopup(m)}
          escapeAus={markePopup !== null}
          onSchliessen={() => setLadenBlatt(null)}
        />
      )}
      {markePopup && (
        <Markenpopup
          marke={markePopup}
          stand={staende.find((s) => s.marke === markePopup)}
          synergie={synergieTabelle.find((s) => s.marke === markePopup)}
          katalog={katalog}
          aufBrett={aufBrett(eigenes ? eigenesBrett : (gegner?.brett ?? []))}
          aufBank={aufBrett(eigenes?.bank ?? [])}
          ebene={blatt || ladenBlatt !== null ? 2 : 1}
          onSchliessen={() => setMarkePopup(null)}
        />
      )}
      {regelnOffen && (
        <Regelblatt wissen={{ katalog, faehigkeiten, synergieTabelle }} onSchliessen={() => setRegelnOffen(false)} />
      )}

      {verschmolzen && (
        <div className={stil.meldung} role="status">
          <Sterne stufe={verschmolzen.stufe} />
          {tz('verschmolzen', {
            n: sicht.verschmelzZahl,
            name: katalog[verschmolzen.id] ? einheitName(katalog[verschmolzen.id]!) : tz('einheit'),
          })}
        </div>
      )}

      {zug && gezogen && katalog[gezogen.id] && (
        <div className={stil.zugschatten} style={{ left: zug.x, top: zug.y }} aria-hidden="true">
          <Figur einheit={katalog[gezogen.id]!} klasse={stil.feldFigur} />
        </div>
      )}

      {endanlass && endanlass !== endbildWeg && eigenes && (
        <Abschluss
          platz={eigenerPlatz(sicht.platzierung, sicht.ich)?.platz ?? null}
          sitzzahl={sicht.platzierung.length}
          fertig={sicht.fertig}
          ausRunde={eigenes.ausRunde}
          trophaeen={trophaeen?.find((t) => t.seat === eigenes.sitz)?.delta ?? null}
          sieger={sicht.sieger !== null ? sitzName(zeile(sicht.sieger), sicht.sieger, sitze) : null}
          onNochmal={onNochmal}
          onZurueck={onZurueck}
          onZusehen={endanlass === 'aus' ? () => setEndbildWeg('aus') : undefined}
        />
      )}
    </main>
  );
}
