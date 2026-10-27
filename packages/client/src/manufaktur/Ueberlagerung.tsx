import {
  type Kettenglied,
  type ManufakturStand,
  type Station,
  type Ziel,
  faehigkeitBereit,
  freischaltKosten,
  einstellPreis,
  bauDauer,
  bauKosten,
  hatBaustelle,
  kannBauen,
  laufenderBau,
  naechsteBaustelle,
  MAX_RENOVIERUNG,
  renovierung,
  einstellenLeistbar,
  stufenFuer,
} from '@brauweg/manufaktur-kern';

import type { Getragen } from '../api';
import { Pinguin } from '../pinguin';
import { stapelBild } from './bilder';
import { useGeaendert } from './effekte';
import { KARTENARTEN } from './namen';
import { type Rechteck, BREITE, etage, gesamtHoehe, halle } from './szene/layout';
import { kurz } from './zahlen';

/**
 * Alles, worauf man tippt, als DOM-Knoepfe genau ueber der Szene — in
 * Welt-Einheiten (390 breit), skaliert wie die Szene. Die Regel fuers Tippen:
 * Figur oder Maschine → arbeiten, Schild → Upgrade, Meister → Faehigkeit
 * (oder, leer, einstellen).
 *
 * Zwei Zustaende, nie verwechselt (Rueckmeldung 23.10.2026):
 * - **schlaeft**: kein Meister, wartet auf einen Tipp → „Zzz" am Kopf des
 *   Pinguins dieser Station.
 * - **Engpass**: die Kette laeuft, diese Station ist die langsamste → das
 *   Schild pulsiert rot. Die Ware staut sich davor (Kisten, Packtisch).
 *
 * Gold heisst nur „bezahlbar": der Pfeil am Schild, ein leerer Meister-Platz,
 * das Schild an der Bretterwand.
 */
export function Ueberlagerung({
  stand,
  jetzt,
  engpass,
  getragen,
  direktor,
  onArbeiten,
  onSchild,
  onMeister,
  onFreischalten,
  onBauen,
}: {
  stand: ManufakturStand;
  jetzt: number;
  engpass: Kettenglied | null;
  getragen: Getragen | undefined;
  /** Was der Direktor gerade tut — er winkt bei Verkaeufen und jubelt bei Upgrades. */
  direktor: 'ruhig' | 'winkt' | 'jubelt';
  onArbeiten: (ziel: Ziel) => void;
  onSchild: (ziel: Ziel) => void;
  onMeister: (ziel: Ziel) => void;
  onFreischalten: () => void;
  onBauen: () => void;
}): React.JSX.Element {
  const h = halle();
  const anzahl = stand.pressen.length;
  const gesperrt = anzahl < KARTENARTEN.length ? anzahl : null;
  // Welche Baustellen ein Schild bekommen: die laufende, die startbare, und Schutt direkt vor der naechsten Etage.
  const laeuft = laufenderBau(stand)?.etage ?? null;
  const baustellen = [...new Set([laeuft, naechsteBaustelle(stand), gesperrt !== null && hatBaustelle(stand, gesperrt) ? gesperrt : null])].filter(
    (b): b is number => b !== null,
  );
  const paternosterSchlaeft = schlaeft(stand.paternoster, stand.pressen.some((p) => p.kiste > 0));
  const versandSchlaeft = schlaeft(stand.versand, stand.packtisch > 0);

  return (
    <div className="mf-ueber" style={{ width: BREITE, height: gesamtHoehe(anzahl) }}>
      {/* Versandhalle: Wagen und Packer, Kopfstueck und Kurbler zum Arbeiten */}
      <Flaeche
        r={{ x: h.traegerWeg.von - 20, y: h.wagen.y, b: h.wagen.x + h.wagen.b - h.traegerWeg.von + 20, h: h.wagen.h }}
        label="Lieferwagen beladen"
        onClick={() => onArbeiten({ art: 'versand' })}
      />
      <Flaeche
        r={{ x: h.kopf.x, y: h.kopf.y, b: h.kurbler.x + 20 - h.kopf.x, h: h.kopf.h }}
        label="Paternoster fahren"
        onClick={() => onArbeiten({ art: 'paternoster' })}
      />
      <Schild r={h.paternosterSchild} name="Paternoster" stand={stand} ziel={{ art: 'paternoster' }} engpass={engpass === 'paternoster'} onClick={onSchild} />
      <MeisterPlatz r={h.paternosterMeister} figur={h.paternosterMeisterFigur} name="Paternoster" stand={stand} ziel={{ art: 'paternoster' }} jetzt={jetzt} onClick={onMeister} />
      <Schild r={h.versandSchild} name="Versand" stand={stand} ziel={{ art: 'versand' }} engpass={engpass === 'versand'} onClick={onSchild} />
      <MeisterPlatz r={h.versandMeister} figur={h.versandMeisterFigur} name="Versand" stand={stand} ziel={{ art: 'versand' }} jetzt={jetzt} onClick={onMeister} />
      <Bestand x={h.packtisch.x + 8} y={h.packtisch.y - 22} wert={stand.packtisch} bild={stapelBild(0)} name="Packtisch" />
      {versandSchlaeft && <Zzz x={h.traegerWeg.von + 6} y={h.boden - 56} />}
      {paternosterSchlaeft && <Zzz x={h.kurbler.x + 6} y={h.boden - 56} />}
      {/* Messingschild mit 0–4 Sternen (renovierung.json: Sterne bei x 178/228/278/328, y 94 von 384 × 160). */}
      <span className="mf-sternschild" style={lage(h.sternSchild)} aria-label={`Renoviert: ${Math.min(renovierung(stand), MAX_RENOVIERUNG)} von ${MAX_RENOVIERUNG} Sternen`}>
        {[178, 228, 278, 328].map((x, i) => (
          <i key={x} className={i < renovierung(stand) ? 'is-voll' : undefined} style={{ left: `${(x / 384) * 100}%` }} />
        ))}
        {renovierung(stand) > MAX_RENOVIERUNG && <b>+{renovierung(stand) - MAX_RENOVIERUNG}</b>}
      </span>
      {/* Der Direktor: dein eigener Pinguin auf seinem Podest, mit allem, was du traegst. */}
      {getragen && (
        <span className={`mf-direktor is-${direktor}`} style={lage(h.direktor)} aria-hidden="true">
          <Pinguin getragen={getragen} groesse={3.1} />
        </span>
      )}

      {/* Etagen */}
      {stand.pressen.map((p, i) => {
        const e = etage(i);
        const ziel: Ziel = { art: 'presse', index: i };
        return (
          <div key={i} className="mf-etage-ueber">
            <span className="mf-nummer" style={{ left: e.nummer.x, top: e.nummer.y }} aria-hidden="true">
              {i + 1}
            </span>
            <Bestand x={e.bestand.x} y={e.bestand.y} wert={p.kiste} bild={stapelBild(i)} name={`Kiste ${i + 1}`} />
            <Flaeche r={e.arbeit} label={`Presse ${i + 1}, ${KARTENARTEN[i]}: arbeiten`} onClick={() => onArbeiten(ziel)} />
            {/* Ueber dem Kopf des vordersten Arbeiters: Rig-Figuren sind 40 hoch, nicht 54. */}
            {schlaeft(p, true) && <Zzz x={e.arbeit.x + 26} y={e.boden - 56} />}
            <MeisterPlatz r={e.meister} figur={e.meisterFigur} name={`Presse ${i + 1}`} stand={stand} ziel={ziel} jetzt={jetzt} onClick={onMeister} />
            <Schild r={e.schild} name={`Presse ${i + 1}`} stand={stand} ziel={ziel} engpass={engpass === 'pressen'} onClick={onSchild} />
          </div>
        );
      })}

      {/* Baustellen (Phase 4): Schutt vor Etage 5 und 8 — Bau starten oder Countdown. */}
      {baustellen.map((b) => (
        <BauSchild key={b} etage={b} stand={stand} jetzt={jetzt} onBauen={onBauen} />
      ))}
      {gesperrt !== null && !hatBaustelle(stand, gesperrt) && (
        <GesperrteEtage
          index={gesperrt}
          kosten={freischaltKosten(anzahl, stand.manufaktur)}
          leistbar={stand.taler + 1e-9 >= freischaltKosten(anzahl, stand.manufaktur)}
          onClick={onFreischalten}
        />
      )}
    </div>
  );
}

function lage(r: Rechteck): React.CSSProperties {
  return { left: r.x, top: r.y, width: r.b, height: r.h };
}

/** Schlaeft der Pinguin? Ohne Meister, ohne laufenden Zyklus — und nur, wenn er etwas zu tun haette. */
function schlaeft(s: Station, hatArbeit: boolean): boolean {
  return !s.meister && !s.laeuft && hatArbeit;
}

function Zzz({ x, y }: { x: number; y: number }): React.JSX.Element {
  return (
    <span className="mf-zzz" style={{ left: x, top: y }} aria-hidden="true">
      Zzz
    </span>
  );
}

function Bestand({ x, y, wert, bild, name }: { x: number; y: number; wert: number; bild: string; name: string }): React.JSX.Element {
  return (
    <span className="mf-bestand" style={{ left: x, top: y }} aria-label={`${name}: ${kurz(wert)}`}>
      <img src={bild} alt="" draggable={false} />
      {kurz(wert)}
    </span>
  );
}

function Flaeche({ r, label, onClick }: { r: Rechteck; label: string; onClick: () => void }): React.JSX.Element {
  return <button type="button" className="mf-tipp" style={lage(r)} aria-label={label} onClick={onClick} />;
}

/**
 * Das Stufen-Schild: der einzige Upgrade-Knopf einer Station. Nur Zahl und
 * Pfeil; der Pfeil wird gold, wenn ein Ausbau bezahlbar ist, und die kleine
 * Zahl daneben sagt, wie viele Stufen gerade gehen.
 */
function Schild({
  r,
  name,
  stand,
  ziel,
  engpass,
  onClick,
}: {
  r: Rechteck;
  name: string;
  stand: ManufakturStand;
  ziel: Ziel;
  engpass: boolean;
  onClick: (ziel: Ziel) => void;
}): React.JSX.Element {
  const s = ziel.art === 'presse' ? stand.pressen[ziel.index]! : ziel.art === 'paternoster' ? stand.paternoster : stand.versand;
  const bezahlbar = stufenFuer(stand, ziel, 'max');
  const glanz = useGeaendert(s.stufe);
  return (
    <button
      type="button"
      className={`mf-schild-stufe${bezahlbar > 0 ? ' is-leistbar' : ''}${engpass ? ' is-engpass' : ''}${glanz ? ' is-glanz' : ''}`}
      style={lage(r)}
      onClick={() => onClick(ziel)}
      aria-label={`${name}, Stufe ${s.stufe}${bezahlbar > 0 ? `, ${bezahlbar} Stufen bezahlbar` : ''}${engpass ? ', Engpass' : ''}`}
    >
      <i className="mf-pfeil" aria-hidden="true" />
      <b>{s.stufe}</b>
      {bezahlbar > 0 && <small className="mf-anzahl">+{bezahlbar > 99 ? '99' : bezahlbar}</small>}
    </button>
  );
}

/**
 * Fuer die Muenze ueber dem Meister: hoechstens drei Zeichen, sie ist nur
 * 26 pt breit — „1m 05s" lief ueber den Rand.
 */
function kurzeZeit(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.ceil(s / 60)}m` : `${s}s`;
}

/**
 * Meister nur einmal zeigen: Leer ist der Platz ein Rahmen mit „+" und Preis.
 * Eingestellt steht der Meister in der Szene (Arbeitergroesse); hier liegt
 * dann nur eine Tippflaeche ueber ihm, darueber das Zeichen seiner
 * Faehigkeit oder der Countdown bis sie wieder bereit ist.
 */
function MeisterPlatz({
  r,
  figur,
  name,
  stand,
  ziel,
  jetzt,
  onClick,
}: {
  r: Rechteck;
  figur: Rechteck;
  name: string;
  stand: ManufakturStand;
  ziel: Ziel;
  jetzt: number;
  onClick: (ziel: Ziel) => void;
}): React.JSX.Element {
  const s = ziel.art === 'presse' ? stand.pressen[ziel.index]! : ziel.art === 'paternoster' ? stand.paternoster : stand.versand;
  if (!s.meister) {
    const kosten = einstellPreis(stand, ziel);
    const leistbar = einstellenLeistbar(stand, ziel);
    return (
      <button
        type="button"
        className={`mf-meisterplatz${leistbar ? ' is-leistbar' : ''}`}
        style={lage(r)}
        onClick={() => onClick(ziel)}
        aria-label={`Meister für ${name} einstellen, ${kurz(kosten)} Taler`}
      >
        <span aria-hidden="true">+</span>
        <small>{kurz(kosten)}</small>
      </button>
    );
  }
  const wirkt = jetzt < s.faehigkeitBis;
  const bereit = faehigkeitBereit(s, jetzt);
  return (
    <>
      <span
        className={`mf-faehigkeit${wirkt ? ' is-wirkt' : bereit ? ' is-bereit' : ''}`}
        style={{ left: figur.x + figur.b / 2, top: figur.y - 18 }}
        aria-hidden="true"
      >
        {/* Bereit: das gemalte Blitz-Zeichen allein (CSS); sonst die Zeit auf der leeren Muenze. */}
        {wirkt ? kurzeZeit(s.faehigkeitBis - jetzt) : bereit ? '' : kurzeZeit(s.abklingenBis - jetzt)}
      </span>
      <button
        type="button"
        className="mf-tipp"
        style={lage(figur)}
        onClick={() => onClick(ziel)}
        aria-label={`Meister ${name}${wirkt ? ', Fähigkeit wirkt' : bereit ? ', Fähigkeit auslösen' : ''}`}
      />
    </>
  );
}

/**
 * Das Schild an einer Baustelle: Bau starten (Preis und Dauer), oder der
 * Countdown, solange gebaut wird. Sofort-Fertigstellen gibt es nicht.
 */
function BauSchild({
  etage: index,
  stand,
  jetzt,
  onBauen,
}: {
  etage: number;
  stand: ManufakturStand;
  jetzt: number;
  onBauen: () => void;
}): React.JSX.Element {
  const e = etage(index);
  const bau = laufenderBau(stand);
  if (bau && bau.etage === index) {
    const rest = Math.max(0, bau.bis - jetzt);
    return (
      <span className="mf-bauschild is-laeuft" style={lage(e.sperrSchild)} role="status" aria-label={`Bauarbeiten vor Etage ${index + 1}, noch ${uhrzeit(rest)}`}>
        <small>Bauarbeiten</small>
        <b>{uhrzeit(rest)}</b>
      </span>
    );
  }
  const kosten = bauKosten(index, stand.manufaktur);
  const startbar = kannBauen(stand) && naechsteBaustelle(stand) === index;
  const leistbar = startbar && stand.taler + 1e-9 >= kosten;
  return (
    <button
      type="button"
      className={`mf-bauschild${leistbar ? ' is-leistbar' : ''}`}
      style={lage(e.sperrSchild)}
      disabled={!startbar}
      onClick={onBauen}
      aria-label={startbar ? `Schutt räumen vor Etage ${index + 1}, ${kurz(kosten)} Taler, ${uhrzeit(bauDauer(stand, index))}` : 'Baustelle'}
    >
      <small>{startbar ? `Schutt räumen · ${uhrzeit(bauDauer(stand, index))}` : bau ? 'Bautrupp ist beschäftigt' : `Ab Etage ${index - 1}`}</small>
      {startbar && (
        <b>
          <i className="mf-taler" aria-hidden="true" />
          {kurz(kosten)}
        </b>
      )}
    </button>
  );
}

/** „7:42" bzw. „1:05:00" fuer Bauzeiten. */
function uhrzeit(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sek = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sek}` : `${m}:${sek}`;
}

function GesperrteEtage({
  index,
  kosten,
  leistbar,
  onClick,
}: {
  index: number;
  kosten: number;
  leistbar: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const e = etage(index);
  return (
    <button
      type="button"
      className={`mf-sperrschild${leistbar ? ' is-leistbar' : ''}`}
      style={lage(e.sperrSchild)}
      onClick={onClick}
      aria-label={`Etage ${index + 1} mit ${KARTENARTEN[index]} bauen, ${kurz(kosten)} Taler`}
    >
      <img src={stapelBild(index)} alt="" draggable={false} />
      <span>
        <strong>{KARTENARTEN[index]}</strong>
        <b>
          <i className="mf-taler" aria-hidden="true" />
          {kurz(kosten)}
        </b>
      </span>
    </button>
  );
}
