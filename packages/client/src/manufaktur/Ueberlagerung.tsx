import {
  type Kettenglied,
  type ManufakturStand,
  type Station,
  type Ziel,
  ausbauLeistbar,
  faehigkeitBereit,
  freischaltKosten,
  meisterKosten,
} from '@brauweg/manufaktur-kern';

import type { Getragen } from '../api';
import { Pinguin } from '../pinguin';
import { BILD } from './bilder';
import { useGeaendert } from './effekte';
import { KARTENARTEN } from './namen';
import { type Rechteck, BREITE, etage, gesamtHoehe, halle } from './szene/layout';
import { kurz } from './zahlen';

/**
 * Alles, worauf man tippt, als DOM-Knoepfe genau ueber der Szene — in
 * Welt-Einheiten (390 breit), skaliert wie die Szene. Die Regel fuers Tippen:
 * Figur oder Maschine → arbeiten, Schild → Upgrade, Meister-Platz → Meister.
 * Kein Dauertext: Ein schlafender Pinguin mit „Zzz" ist Hinweis genug.
 *
 * Gold heisst nur „Geld" oder „kannst du dir leisten". Ein Schild leuchtet
 * gold, wenn der Ausbau bezahlbar ist; der Engpass pulsiert rot.
 */
export function Ueberlagerung({
  stand,
  jetzt,
  engpass,
  getragen,
  onArbeiten,
  onSchild,
  onMeister,
  onFreischalten,
}: {
  stand: ManufakturStand;
  jetzt: number;
  engpass: Kettenglied | null;
  getragen: Getragen | undefined;
  onArbeiten: (ziel: Ziel) => void;
  onSchild: (ziel: Ziel) => void;
  onMeister: (ziel: Ziel) => void;
  onFreischalten: () => void;
}): React.JSX.Element {
  const h = halle();
  const anzahl = stand.pressen.length;
  const gesperrt = anzahl < KARTENARTEN.length ? anzahl : null;

  return (
    <div className="mf-ueber" style={{ width: BREITE, height: gesamtHoehe(anzahl) }}>
      {/* Versandhalle */}
      <Flaeche
        r={h.wagen}
        klasse="mf-tipp"
        label="Lieferwagen beladen"
        onClick={() => onArbeiten({ art: 'versand' })}
      />
      <Flaeche r={h.kopf} klasse="mf-tipp" label="Paternoster fahren" onClick={() => onArbeiten({ art: 'paternoster' })} />
      <Schild
        r={h.paternosterSchild}
        name="Paternoster"
        station={stand.paternoster}
        leistbar={ausbauLeistbar(stand, { art: 'paternoster' })}
        engpass={engpass === 'paternoster'}
        onClick={() => onSchild({ art: 'paternoster' })}
      />
      <MeisterPlatz
        r={h.paternosterMeister}
        name="Paternoster"
        station={stand.paternoster}
        kosten={meisterKosten({ art: 'paternoster' }, stand.manufaktur)}
        taler={stand.taler}
        jetzt={jetzt}
        onClick={() => onMeister({ art: 'paternoster' })}
      />
      <Schild
        r={h.versandSchild}
        name="Versand"
        station={stand.versand}
        leistbar={ausbauLeistbar(stand, { art: 'versand' })}
        engpass={engpass === 'versand'}
        onClick={() => onSchild({ art: 'versand' })}
      />
      <MeisterPlatz
        r={h.versandMeister}
        name="Versand"
        station={stand.versand}
        kosten={meisterKosten({ art: 'versand' }, stand.manufaktur)}
        taler={stand.taler}
        jetzt={jetzt}
        onClick={() => onMeister({ art: 'versand' })}
      />
      <span className="mf-bestand" style={{ left: h.packtisch.x + 8, top: h.packtisch.y - 6 }} aria-label={`Packtisch ${kurz(stand.packtisch)}`}>
        {kurz(stand.packtisch)}
      </span>
      {schlaeft(stand.versand, stand.packtisch > 0) && <Zzz x={h.traegerWeg.von + 10} y={h.boden - 70} />}
      {schlaeft(stand.paternoster, stand.pressen.some((p) => p.kiste > 0)) && <Zzz x={h.kopf.x + 6} y={h.kopf.y - 22} />}
      {/* Der Direktor: dein eigener Pinguin, mit allem, was du traegst. */}
      {getragen && (
        <span className="mf-direktor" style={lage(h.direktor)} aria-hidden="true">
          <Pinguin getragen={getragen} groesse={3.2} />
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
            <span className="mf-bestand" style={{ left: e.kiste.x + e.kiste.b / 2, top: e.boden - 24 }} aria-label={`Kiste ${kurz(p.kiste)}`}>
              {kurz(p.kiste)}
            </span>
            <Flaeche
              r={e.arbeit}
              klasse="mf-tipp"
              label={`Presse ${i + 1}, ${KARTENARTEN[i]}: arbeiten`}
              onClick={() => onArbeiten(ziel)}
            />
            {schlaeft(p, true) && <Zzz x={e.kiste.x + e.kiste.b + 18} y={e.boden - 66} />}
            <MeisterPlatz
              r={e.meister}
              name={`Presse ${i + 1}`}
              station={p}
              kosten={meisterKosten(ziel, stand.manufaktur)}
              taler={stand.taler}
              jetzt={jetzt}
              onClick={() => onMeister(ziel)}
            />
            <Schild
              r={e.schild}
              name={`Presse ${i + 1}`}
              station={p}
              leistbar={ausbauLeistbar(stand, ziel)}
              engpass={engpass === 'pressen'}
              onClick={() => onSchild(ziel)}
            />
          </div>
        );
      })}

      {gesperrt !== null && (
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

function Flaeche({
  r,
  klasse,
  label,
  onClick,
}: {
  r: Rechteck;
  klasse: string;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return <button type="button" className={klasse} style={lage(r)} aria-label={label} onClick={onClick} />;
}

/** Das Stufen-Schild: der einzige Upgrade-Knopf einer Station. */
function Schild({
  r,
  name,
  station,
  leistbar,
  engpass,
  onClick,
}: {
  r: Rechteck;
  name: string;
  station: Station;
  leistbar: boolean;
  engpass: boolean;
  onClick: () => void;
}): React.JSX.Element {
  // Aufgestiegen: kurz glaenzen (die Arbeiter jubeln in der Szene dazu).
  const glanz = useGeaendert(station.stufe);
  return (
    <button
      type="button"
      className={`mf-schild-stufe${leistbar ? ' is-leistbar' : ''}${engpass ? ' is-engpass' : ''}${glanz ? ' is-glanz' : ''}`}
      style={lage(r)}
      onClick={onClick}
      aria-label={`${name}, Stufe ${station.stufe}${leistbar ? ', Ausbau bezahlbar' : ''}${engpass ? ', Engpass' : ''}`}
    >
      {engpass && (
        <i className="mf-warnung" aria-hidden="true">
          !
        </i>
      )}
      <small>Stufe</small>
      <b>{station.stufe}</b>
    </button>
  );
}

/** Porträtrahmen: leer mit „+", besetzt mit dem Meister. */
function MeisterPlatz({
  r,
  name,
  station,
  kosten,
  taler,
  jetzt,
  onClick,
}: {
  r: Rechteck;
  name: string;
  station: Station;
  kosten: number;
  taler: number;
  jetzt: number;
  onClick: () => void;
}): React.JSX.Element {
  if (!station.meister) {
    const leistbar = taler + 1e-9 >= kosten;
    return (
      <button
        type="button"
        className={`mf-meisterplatz is-leer${leistbar ? ' is-leistbar' : ''}`}
        style={lage(r)}
        onClick={onClick}
        aria-label={`Meister für ${name} einstellen, ${kurz(kosten)} Taler`}
      >
        <span aria-hidden="true">+</span>
        <small>{kurz(kosten)}</small>
      </button>
    );
  }
  const wirkt = jetzt < station.faehigkeitBis;
  const bereit = faehigkeitBereit(station, jetzt);
  return (
    <button
      type="button"
      className={`mf-meisterplatz${wirkt ? ' is-wirkt' : bereit ? ' is-bereit' : ''}`}
      style={lage(r)}
      onClick={onClick}
      aria-label={`Meister ${name}${wirkt ? ', Fähigkeit wirkt' : bereit ? ', Fähigkeit bereit' : ''}`}
    >
      <img src={BILD.meister} alt="" draggable={false} />
    </button>
  );
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
      className={`mf-gesperrt${leistbar ? ' is-leistbar' : ''}`}
      style={{ left: e.kiste.x, top: e.reihe.y + 60, width: BREITE - e.kiste.x - 8, height: 56 }}
      onClick={onClick}
      aria-label={`Etage ${index + 1} mit ${KARTENARTEN[index]} bauen, ${kurz(kosten)} Taler`}
    >
      <span>
        Etage {index + 1} · {KARTENARTEN[index]}
      </span>
      <b>
        <i className="mf-taler" aria-hidden="true" />
        {kurz(kosten)}
      </b>
    </button>
  );
}
