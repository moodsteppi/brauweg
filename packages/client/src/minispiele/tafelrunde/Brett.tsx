/**
 * Brett, Bank und die Einheit darauf — die drei Bauteile, aus denen die
 * Ruestkammer von Tafelrunde besteht.
 *
 * Sie standen bis zum 06.09.2026 in screens/Tafelrunde.tsx, mitten in 2.900
 * Zeilen und privat. Gezogen worden sind sie, damit die Probe
 * `/probe/ruestkammer` sie EINHAENGEN kann, statt ihre Klassen nachzubauen.
 * Genau das musste beim Umbau auf die 3D-Figuren einmal sein — eine
 * Wegwerf-Probe, die `.tr-wabe`, `.tr-einheit` und `.tr-bankplatz` von Hand
 * nachstellte —, und eine nachgestellte Wabe zeigt eben nicht, wie die Figur
 * auf der echten sitzt. Davor warnt schon der Kopf von `ProbeKampf.tsx`.
 *
 * Das AUSSEHEN steht weiterhin in styles.css (`.tr-brett`, `.tr-wabe`,
 * `.tr-einheit`, `.tr-bank`) und nicht in einem Modul-Stylesheet: Diese
 * Klassen sind alt, sie haengen am Tisch-Grundton, und sie umzuziehen waere
 * eine eigene Aufgabe.
 *
 * Es steht hier KEINE Regel. Wohin eine Einheit darf, entscheidet `istZiel`,
 * und das kommt vom Aufrufer aus Zahlen der Sicht (`zuege.ts`). Diese Datei
 * zeichnet nur, was sie bekommt.
 */

import { UNTERGRUND } from './figuren';
import { Markenzeichen } from './Synergien';
import { EinheitenFigur, ROLLE_NAME, kostenFarbe } from './Zeichen';
import type { Einheit } from './sicht';
import {
  type Kaempfer,
  type Ort,
  ortSchluessel,
  platzVon,
  rastermass,
  wabenLage,
} from './zuege';

// ---------------------------------------------------------------------------
// Eine Einheit
// ---------------------------------------------------------------------------

export function Einheitenmarke({
  kaempfer,
  katalog,
  maxStufe,
  fehlt,
  frisch,
  aktiv,
  versteckt,
  spiegeln,
  onZeigerStart,
  onZeigerBewegung,
  onZeigerEnde,
  onZeigerAbbruch,
  onWaehlen,
}: {
  kaempfer: Kaempfer;
  katalog: Record<string, Einheit>;
  maxStufe: number;
  /** Wie viele Kopien noch fehlen, bis diese Stufe verschmilzt. */
  fehlt: number;
  frisch?: boolean;
  aktiv: boolean;
  versteckt?: boolean;
  /**
   * Nach links schauen lassen. Alle Blaetter schauen nach rechts
   * (FIGUREN3D_BLICKT); gespiegelt wird das Brett des GEGNERS, das ohnehin
   * auf dem Kopf steht — so sehen die beiden Heere einander an, statt in
   * dieselbe Richtung zu blicken. Dieselbe Ueberlegung wie in der Arena.
   */
  spiegeln?: boolean;
  onZeigerStart?: (e: React.PointerEvent) => void;
  onZeigerBewegung?: (e: React.PointerEvent) => void;
  onZeigerEnde?: (e: React.PointerEvent) => void;
  onZeigerAbbruch?: () => void;
  /**
   * Ein Tipp auf diese Einheit ohne Zeiger — Tastatur oder Vorlesegeraet.
   *
   * Der Antipp-Weg lief bisher allein ueber `pointerup`, und genau das
   * erreicht ein Vorlesegeraet nicht: VoiceOver und TalkBack loesen beim
   * Doppeltippen einen KLICK aus, keine Zeigerfolge. Ohne diesen Weg war die
   * Zusage aus dem Kopf von screens/Tafelrunde.tsx — Antippen sei der Weg,
   * der mit einem Vorlesegeraet funktioniert — schlicht nicht eingeloest.
   *
   * WAS DER TIPP AUSLOEST, entscheidet der Aufrufer und nicht diese Datei:
   * Am Tisch schlaegt er seit dem 6.9.2026 das Blatt der Einheit auf, wenn
   * noch nichts gewaehlt ist, und setzt sonst die gewaehlte Einheit hierher
   * ab (`tippfolge` in zuege.ts). Die Wabe zeichnet nur.
   */
  onWaehlen?: () => void;
}): React.JSX.Element {
  const einheit = katalog[kaempfer.id];
  const farbe = kostenFarbe(einheit?.kosten);
  const greifbar = aktiv && onWaehlen !== undefined;
  return (
    <div
      className="tr-einheit"
      data-frisch={frisch ? '' : undefined}
      data-still={versteckt ? '' : undefined}
      data-fassbar={aktiv ? '' : undefined}
      style={{ '--tr-kosten': farbe } as React.CSSProperties}
      role={greifbar ? 'button' : undefined}
      tabIndex={greifbar ? 0 : undefined}
      aria-label={
        einheit
          ? `${einheit.name}, ${ROLLE_NAME[einheit.rolle]}, Stufe ${kaempfer.stufe}`
          : kaempfer.id
      }
      onPointerDown={aktiv ? onZeigerStart : undefined}
      onPointerMove={aktiv ? onZeigerBewegung : undefined}
      onPointerUp={aktiv ? onZeigerEnde : undefined}
      onPointerCancel={aktiv ? onZeigerAbbruch : undefined}
      /*
       * `detail === 0` trennt den erzeugten Klick vom echten: Tastatur und
       * Vorlesegeraet melden 0, Maus und Finger melden mindestens 1. Ohne
       * diese Pruefung liefe jeder Tipp doppelt — einmal ueber `pointerup`
       * und gleich darauf ueber den Klick, den der Browser hinterherschickt.
       * Das Ergebnis waere waehlen und im selben Moment wieder abwaehlen.
       */
      onClick={
        greifbar
          ? (e) => {
              if (e.detail === 0) onWaehlen?.();
            }
          : undefined
      }
      onKeyDown={
        greifbar
          ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              // Sonst rollt die Leertaste den Bildschirm unter dem Brett weg.
              e.preventDefault();
              onWaehlen?.();
            }
          : undefined
      }
      title={einheit ? `${einheit.name} · ${ROLLE_NAME[einheit.rolle]}` : kaempfer.id}
    >
      {einheit ? (
        <EinheitenFigur einheit={einheit} klasse="tr-figur3d" spiegeln={spiegeln} />
      ) : (
        /* Der Katalog kommt erst mit der ersten Sicht. Ein Fragezeichen ist
           hier ehrlicher als ein Bild, dessen Namen wir noch nicht kennen. */
        <span>?</span>
      )}
      {/* Was die Einheit gekostet hat. Bis zum 6.9.2026 war es der Innenrand
          der Platte, auf der sie sass — die ist weg, weil sie die Figur flach
          aussehen liess (Robin, 5.9.2026). Ein Punkt und kein neuer Ring:
          Derselbe Traeger wie in der Arena (`.kosten` dort). */}
      {einheit && <i className="tr-kosten" aria-hidden="true" />}
      {/* Die Marken als Zeichen in der Ecke — dieselben Zeichen und Farben wie
          in der Leiste, damit man eine Aufstellung im Vorbeisehen zaehlen
          kann. Kein Text: Auf einer Wabe ist dafuer kein Platz, und vorgelesen
          wird ohnehin das `aria-label` oben. */}
      {einheit && <Markenzeichen marken={einheit.marken} ort="einheit" />}
      <span className="tr-einheit-name">{einheit?.name ?? kaempfer.id}</span>
      {/* Der Name der Marke nennt die Stufe schon; hier waere sie doppelt. */}
      <span className="tr-sterne" aria-hidden="true">
        {'★'.repeat(kaempfer.stufe)}
      </span>
      {/*
        * "Noch eine" statt einer stillen Ueberraschung: Wer zwei von drei
        * haelt, soll es sehen, bevor er den Laden neu wuerfelt. Nur unterhalb
        * der Hoechststufe — dort verschmilzt nichts mehr.
        */}
      {fehlt === 1 && kaempfer.stufe < maxStufe && (
        <span className="tr-fehlt" aria-hidden="true">
          noch 1
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Das Hexbrett
// ---------------------------------------------------------------------------

/**
 * Ein versetztes Sechseckraster ("odd-r", siehe brett.ts).
 *
 * Die Lage jedes Feldes wird in PROZENT gerechnet und nicht in Pixeln: Das
 * Brett skaliert mit der Bildschirmbreite, und eine in Pixeln gesetzte Wabe
 * saesse auf einem schmalen Handy neben ihrem Platz — dieselbe Ueberlegung wie
 * bei den Mauern in Filler.tsx.
 *
 * Die Zahlen stehen hier und nicht im Stylesheet, weil Reihen und Spalten aus
 * der Sicht kommen: Ein festes Raster in CSS waere beim ersten groesseren
 * Brett falsch, und das kommt mit der Kampfarena (Phase 2).
 */
export function Hexbrett({
  reihen,
  spalten,
  felder,
  katalog,
  maxStufe,
  gespiegelt,
  eigen,
  gewaehlt,
  istZiel,
  onWaehlen,
  ziehtVon,
  unterZeiger,
  fehlendeKopien,
  frischVerschmolzen,
  aktiv,
  onZeigerStart,
  onZeigerBewegung,
  onZeigerEnde,
  onZeigerAbbruch,
  onLeeresZiel,
}: {
  reihen: number;
  spalten: number;
  felder: readonly (Kaempfer | null)[];
  katalog: Record<string, Einheit>;
  maxStufe: number;
  /** Das gegnerische Brett steht auf dem Kopf — so treffen die Heere sich. */
  gespiegelt?: boolean;
  eigen?: boolean;
  gewaehlt?: Ort | null;
  /** Darf die gerade gewaehlte Einheit hierhin? Ohne Auswahl nicht gesetzt. */
  istZiel?: (ort: Ort) => boolean;
  /** Auswahl ueber Tastatur oder Vorlesegeraet, siehe Einheitenmarke. */
  onWaehlen?: (ort: Ort) => void;
  ziehtVon?: Ort | null;
  /** Schluessel des Feldes unter dem Finger — es zeigt an, wo abgelegt wird. */
  unterZeiger?: string | null;
  fehlendeKopien?: (id: string, stufe?: number) => number;
  frischVerschmolzen?: { id: string; stufe: number } | null;
  aktiv?: boolean;
  onZeigerStart?: (ort: Ort, e: React.PointerEvent) => void;
  onZeigerBewegung?: (e: React.PointerEvent) => void;
  onZeigerEnde?: (ort: Ort, e: React.PointerEvent) => void;
  onZeigerAbbruch?: () => void;
  /** Ein leeres Feld ist angetippt worden (nicht gezogen). */
  onLeeresZiel?: (ort: Ort) => void;
}): React.JSX.Element {
  const mass = rastermass(reihen, spalten);

  return (
    /* Der Holz-Untergrund kommt als Pfad aus figuren.ts und nicht als zweite
       Abschrift im Stylesheet: Wer die Textur tauscht, aendert eine Zeile und
       nicht zwei. Wie er kachelt und wie dunkel der Schleier darueber liegt,
       steht in styles.css. */
    <div
      className="tr-brett"
      style={{
        aspectRatio: `${mass.seitenverhaeltnis}`,
        backgroundImage: `url(${UNTERGRUND})`,
      }}
    >
      {Array.from({ length: reihen * spalten }, (_, i) => {
        const platz = platzVon(i, reihen, spalten, gespiegelt === true);
        const reihe = Math.floor(i / spalten);
        const spalte = i % spalten;
        const lage = wabenLage(mass, reihe, spalte);
        const k = felder[platz] ?? null;
        const ort: Ort = { bereich: 'brett', platz };
        const schluessel = ortSchluessel(ort);
        const stil: React.CSSProperties = {
          left: `${lage.links}%`,
          top: `${lage.oben}%`,
          width: `${mass.wabenBreite}%`,
          height: `${mass.wabenHoehe}%`,
        };
        return (
          <div
            key={platz}
            className="tr-wabe"
            style={stil}
            data-ziel={eigen ? schluessel : undefined}
            data-leer={k ? undefined : ''}
            data-gewaehlt={
              gewaehlt?.bereich === 'brett' && gewaehlt.platz === platz ? '' : undefined
            }
            data-zielbar={istZiel?.(ort) ? '' : undefined}
            data-unterzeiger={unterZeiger === schluessel ? '' : undefined}
          >
            {k ? (
              <Einheitenmarke
                kaempfer={k}
                katalog={katalog}
                maxStufe={maxStufe}
                fehlt={fehlendeKopien?.(k.id, k.stufe) ?? 0}
                frisch={
                  frischVerschmolzen?.id === k.id && frischVerschmolzen.stufe === k.stufe
                }
                aktiv={eigen === true && aktiv === true}
                spiegeln={gespiegelt === true}
                versteckt={ziehtVon?.bereich === 'brett' && ziehtVon.platz === platz}
                onZeigerStart={eigen && onZeigerStart ? (e) => onZeigerStart(ort, e) : undefined}
                onZeigerBewegung={eigen ? onZeigerBewegung : undefined}
                onZeigerEnde={eigen && onZeigerEnde ? (e) => onZeigerEnde(ort, e) : undefined}
                onZeigerAbbruch={eigen ? onZeigerAbbruch : undefined}
                onWaehlen={eigen && onWaehlen ? () => onWaehlen(ort) : undefined}
              />
            ) : (
              eigen && (
                /* Ein leeres Feld ist ein Ziel und deshalb eine Schaltflaeche:
                   Wer eine Einheit gewaehlt hat, tippt hier hin. Ohne Knopf
                   waere der Antipp-Weg auf halbem Weg zu Ende. */
                <button
                  type="button"
                  className="tr-wabe-ziel"
                  disabled={!aktiv}
                  /* Der Name sagt beim Vorlesen mit, ob dieses Feld gerade
                     ein Ziel ist — sichtbar leuchtet es, hoerbar bisher
                     nicht. */
                  aria-label={`Feld ${platz + 1}${istZiel?.(ort) ? ' · Ziel' : ''}`}
                  /* Klick und nicht Zeiger-Loslassen: Ein abgelegtes Ziehen
                     endet dank Zeigererfassung IMMER an der gezogenen
                     Einheit, nie hier — und erzeugt deshalb auch keinen
                     Klick. Der Klick gehoert also allein dem Antipp-Weg. */
                  onClick={() => onLeeresZiel?.(ort)}
                />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Die Reservebank
// ---------------------------------------------------------------------------

/**
 * Die Reservebank — derselbe Platz fuer eine Einheit wie eine Wabe, nur in
 * einer Zeile.
 *
 * Sie liegt UNMITTELBAR an der Unterkante des Bretts und nicht als eigener
 * Kasten mit Luft davor: In einem fertigen Auto-Battler ist die Bank der Rand
 * des Spielfelds, und der kurze Weg von der Bank auf die erste Wabe ist genau
 * die Bewegung, die man hundertmal je Partie macht. Das entscheidet allein
 * styles.css (`.tr-bank`); der Aufrufer entscheidet nur, dass sie nach dem
 * Brett kommt.
 *
 * Die Spaltenzahl kommt als `plaetze` herein und nicht aus dem Stylesheet:
 * `bankPlaetze` steht im Regelsatz und ist damit je Tisch verstellbar.
 *
 * WAEHREND DES KAMPFES WIRD SIE GAR NICHT ERST EINGEHAENGT — das entscheidet
 * der Bildschirm, aus demselben Grund, aus dem der Laden dann zu ist: Es geht
 * nichts von ihr aufs Feld und nichts zurueck, sie ist in dieser Minute ein
 * Bild, und als Streifen unter dem Brett kostet sie auf einem 390-px-Schirm
 * 55 Pixel, die der Arena besser stehen.
 */
export function Bankreihe({
  plaetze,
  bank,
  katalog,
  maxStufe,
  gewaehlt,
  istZiel,
  onWaehlen,
  ziehtVon,
  unterZeiger,
  fehlendeKopien,
  frischVerschmolzen,
  aktiv,
  onZeigerStart,
  onZeigerBewegung,
  onZeigerEnde,
  onZeigerAbbruch,
}: {
  plaetze: number;
  bank: readonly (Kaempfer | null)[];
  katalog: Record<string, Einheit>;
  maxStufe: number;
  gewaehlt?: Ort | null;
  istZiel?: (ort: Ort) => boolean;
  onWaehlen?: (ort: Ort) => void;
  ziehtVon?: Ort | null;
  unterZeiger?: string | null;
  fehlendeKopien?: (id: string, stufe?: number) => number;
  frischVerschmolzen?: { id: string; stufe: number } | null;
  aktiv?: boolean;
  onZeigerStart?: (ort: Ort, e: React.PointerEvent) => void;
  onZeigerBewegung?: (e: React.PointerEvent) => void;
  onZeigerEnde?: (ort: Ort, e: React.PointerEvent) => void;
  onZeigerAbbruch?: () => void;
}): React.JSX.Element {
  /* `plaetze` und nicht `bank.length`: Die Zahl steht im Regelsatz, und eine
     Sicht, die weniger Plaetze mitschickt, als der Tisch hat, soll trotzdem
     die volle Reihe zeigen — sonst springt sie beim ersten Kauf breiter. */
  const leerAlle = Array.from({ length: plaetze }, (_, platz) => bank[platz] ?? null).every(
    (k) => k === null,
  );
  return (
    <>
      <div
        className="tr-bank"
        role="group"
        aria-label="Reservebank"
        style={{ gridTemplateColumns: `repeat(${plaetze}, 1fr)` }}
      >
        {Array.from({ length: plaetze }, (_, platz) => {
          const ort: Ort = { bereich: 'bank', platz };
          const schluessel = ortSchluessel(ort);
          const k = bank[platz] ?? null;
          return (
            <div
              key={platz}
              className="tr-bankplatz"
              data-ziel={schluessel}
              data-leer={k ? undefined : ''}
              data-gewaehlt={
                gewaehlt?.bereich === 'bank' && gewaehlt.platz === platz ? '' : undefined
              }
              data-zielbar={istZiel?.(ort) ? '' : undefined}
              data-unterzeiger={unterZeiger === schluessel ? '' : undefined}
            >
              {k ? (
                <Einheitenmarke
                  kaempfer={k}
                  katalog={katalog}
                  maxStufe={maxStufe}
                  fehlt={fehlendeKopien?.(k.id, k.stufe) ?? 0}
                  frisch={
                    frischVerschmolzen?.id === k.id && frischVerschmolzen.stufe === k.stufe
                  }
                  aktiv={aktiv === true}
                  versteckt={ziehtVon?.bereich === 'bank' && ziehtVon.platz === platz}
                  onZeigerStart={onZeigerStart ? (e) => onZeigerStart(ort, e) : undefined}
                  onZeigerBewegung={onZeigerBewegung}
                  onZeigerEnde={onZeigerEnde ? (e) => onZeigerEnde(ort, e) : undefined}
                  onZeigerAbbruch={onZeigerAbbruch}
                  onWaehlen={onWaehlen ? () => onWaehlen(ort) : undefined}
                />
              ) : (
                /* Dieselbe echte Schaltflaeche wie das leere Brettfeld, und
                   aus demselben Grund: Ein `onClick` am Kasten hat weder
                   Namen noch Tastaturweg — der Rueckweg auf die Bank waere
                   mit einem Vorlesegeraet gar nicht vorhanden. */
                <button
                  type="button"
                  className="tr-bankplatz-ziel"
                  disabled={aktiv !== true}
                  aria-label={`Bankplatz ${platz + 1}`}
                  onClick={() => onWaehlen?.(ort)}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Der Satz gehoert zur Bank und steht deshalb hier: Wer ihn im
          Bildschirm liesse, haette die eine Bedingung, unter der er faellt,
          an zwei Stellen. Er schickt in den Laden — und laeuft der Kampf, ist
          die Bank ohnehin nicht eingehaengt. */}
      {leerAlle && (
        <p className="tr-leer-satz">Deine Bank ist leer — kauf dir unten im Laden einen Recken.</p>
      )}
    </>
  );
}
