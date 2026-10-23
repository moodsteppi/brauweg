/**
 * Was der Bildschirm aus dem Stand ableitet — Durchsatz, Engpass,
 * Leerlauf-Ertrag, die Kennzahlen im Upgrade-Blatt. Hier, nicht im Client:
 * Wer eine Formel aendert, aendert sie fuer beide.
 */

import {
  type Ziel,
  arbeiter,
  ausbauKostenFuer,
  meilensteinBalken,
  meisterKosten,
  paternosterFahrt,
  paternosterKapazitaet,
  presseErtrag,
  presseLeistung,
  presseZyklus,
  versandKapazitaet,
  versandZyklus,
} from './formeln.js';
import { type Menge, stationVon, stufenFuer } from './aktionen.js';
import type { ManufakturStand } from './stand.js';

export type Kettenglied = 'pressen' | 'paternoster' | 'versand';

/** Was die Kettenglieder je Sekunde schaffen, wenn alle arbeiten. */
export function durchsatz(stand: ManufakturStand, nurMeister = false): Record<Kettenglied, number> {
  const pressen = stand.pressen.reduce(
    (summe, p, i) => summe + (nurMeister && !p.meister ? 0 : presseLeistung(i, p.stufe, stand.manufaktur)),
    0,
  );
  const f = stand.paternoster;
  const v = stand.versand;
  const paternoster =
    nurMeister && !f.meister
      ? 0
      : paternosterKapazitaet(f.stufe, stand.manufaktur) / (paternosterFahrt(stand.pressen.length, f.stufe) / 1000);
  const versand =
    nurMeister && !v.meister ? 0 : versandKapazitaet(v.stufe, stand.manufaktur) / (versandZyklus(v.stufe) / 1000);
  return { pressen, paternoster, versand };
}

/** Einkommen je Sekunde = das langsamste Glied der Kette. */
export function ertragProSekunde(stand: ManufakturStand): number {
  const d = durchsatz(stand);
  return Math.min(d.pressen, d.paternoster, d.versand);
}

/**
 * Leerlauf-Ertrag: nur die Kette, die von selbst laeuft. Ohne Versand-Meister
 * kommt nichts an — dann 0. null, solange gar kein Meister da ist (dann
 * zeigt das HUD nichts).
 */
export function leerlaufErtrag(stand: ManufakturStand): number | null {
  const irgendeiner =
    stand.pressen.some((p) => p.meister) || stand.paternoster.meister || stand.versand.meister;
  if (!irgendeiner) return null;
  const d = durchsatz(stand, true);
  return Math.min(d.pressen, d.paternoster, d.versand);
}

/** Das langsamste Glied — dort lohnt der Ausbau. null, wenn es noch keine Kette gibt. */
export function engpass(stand: ManufakturStand): Kettenglied | null {
  const d = durchsatz(stand);
  const kleinste = Math.min(d.pressen, d.paternoster, d.versand);
  if (kleinste <= 0) return null;
  // Gleichstand: vorn in der Kette zuerst, dort staut es sich zuerst.
  if (d.pressen === kleinste) return 'pressen';
  if (d.paternoster === kleinste) return 'paternoster';
  return 'versand';
}

export interface Kennzahl {
  name: string;
  vorher: number;
  nachher: number;
  /** 'wert' Warenwert, 'sekunden' Dauer, 'anzahl' Stueck. */
  einheit: 'wert' | 'sekunden' | 'anzahl';
}

function kennzahlenBei(stand: ManufakturStand, ziel: Ziel, stufe: number): Omit<Kennzahl, 'nachher'>[] {
  const m = stand.manufaktur;
  if (ziel.art === 'presse') {
    return [
      { name: 'Ertrag je Zyklus', vorher: presseErtrag(ziel.index, stufe, m), einheit: 'wert' },
      { name: 'Zyklus', vorher: presseZyklus(stufe) / 1000, einheit: 'sekunden' },
      { name: 'Arbeiter', vorher: arbeiter(stufe), einheit: 'anzahl' },
    ];
  }
  if (ziel.art === 'paternoster') {
    return [
      { name: 'Kapazität', vorher: paternosterKapazitaet(stufe, m), einheit: 'wert' },
      { name: 'Fahrt', vorher: paternosterFahrt(stand.pressen.length, stufe) / 1000, einheit: 'sekunden' },
    ];
  }
  return [
    { name: 'Kapazität', vorher: versandKapazitaet(stufe, m), einheit: 'wert' },
    { name: 'Fahrt', vorher: versandZyklus(stufe) / 1000, einheit: 'sekunden' },
  ];
}

export interface AusbauVorschau {
  stufe: number;
  /** Stufe nach dem Kauf; gleich `stufe`, wenn `menge` gerade nichts kauft. */
  neueStufe: number;
  kosten: number;
  leistbar: boolean;
  kennzahlen: Kennzahl[];
  meilenstein: { von: number; bis: number } | null;
}

/** Was ein Ausbau um `menge` bringt — fuer das Upgrade-Blatt. */
export function ausbauVorschau(stand: ManufakturStand, ziel: Ziel, menge: Menge): AusbauVorschau {
  const s = stationVon(stand, ziel)!;
  const anzahl = stufenFuer(stand, ziel, menge);
  // Max ohne Geld zeigt trotzdem die naechste Stufe — sonst sieht man nicht,
  // worauf man spart.
  const zeigen = Math.max(anzahl, menge === 'max' ? 1 : 0);
  const neueStufe = s.stufe + zeigen;
  const kosten = ausbauKostenFuer(ziel, s.stufe, zeigen, stand.manufaktur);
  const vorher = kennzahlenBei(stand, ziel, s.stufe);
  const nachher = kennzahlenBei(stand, ziel, neueStufe);
  return {
    stufe: s.stufe,
    neueStufe,
    kosten,
    leistbar: zeigen > 0 && stand.taler + 1e-9 >= kosten,
    kennzahlen: vorher.map((k, i) => ({ ...k, nachher: nachher[i]!.vorher })),
    meilenstein: meilensteinBalken(s.stufe),
  };
}

/** Ist irgendein Ausbau dieser Station gerade bezahlbar? (Schild leuchtet gold.) */
export function ausbauLeistbar(stand: ManufakturStand, ziel: Ziel): boolean {
  return stufenFuer(stand, ziel, 'max') > 0;
}

export function meisterLeistbar(stand: ManufakturStand, ziel: Ziel): boolean {
  const s = stationVon(stand, ziel);
  return !!s && !s.meister && stand.taler + 1e-9 >= meisterKosten(ziel, stand.manufaktur);
}
