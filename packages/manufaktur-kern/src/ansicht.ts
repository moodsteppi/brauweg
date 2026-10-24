/**
 * Was der Bildschirm aus dem Stand ableitet — Durchsatz, Engpass,
 * Leerlauf-Ertrag, die Kennzahlen im Upgrade-Blatt. Hier, nicht im Client:
 * Wer eine Formel aendert, aendert sie fuer beide.
 */

import {
  OFFLINE_TEMPO,
  type Ziel,
  arbeiter,
  ausbauKostenFuer,
  meilensteinBalken,
  paternosterFahrt,
  paternosterKapazitaet,
  presseErtrag,
  presseLeistung,
  presseZyklus,
  versandKapazitaet,
  versandZyklus,
} from './formeln.js';
import { type Menge, ausbauRabatt, stationVon, stufenFuer } from './aktionen.js';
import { einstellPreis, platzVon } from './meister.js';
import { feilschenFaktor, kartenwertBonus, poolGroesse } from './werkstattbuch.js';
import type { ManufakturStand } from './stand.js';

export type Kettenglied = 'pressen' | 'paternoster' | 'versand';

/** Was die Kettenglieder je Sekunde schaffen, wenn alle arbeiten. */
export function durchsatz(stand: ManufakturStand, nurMeister = false): Record<Kettenglied, number> {
  const pressen = stand.pressen.reduce(
    (summe, p, i) => summe + (nurMeister && !p.meister ? 0 : presseLeistung(i, p.stufe, stand.manufaktur, kartenwertBonus(stand))),
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
  // Offline laeuft alles zum halben Tempo (zeit.ts) — das zeigt die Anzeige auch.
  return Math.min(d.pressen, d.paternoster, d.versand) * OFFLINE_TEMPO;
}

/**
 * Arbeitet ein Kettenglied gerade (Meister oder laufender Zyklus)? Eine
 * Station, die schlaeft, ist kein Engpass — sie wartet auf einen Tipp.
 */
export function arbeitet(stand: ManufakturStand, glied: Kettenglied): boolean {
  if (glied === 'pressen') return stand.pressen.some((p) => p.meister || p.laeuft);
  const s = glied === 'paternoster' ? stand.paternoster : stand.versand;
  return s.meister || s.laeuft;
}

/**
 * Der Engpass, wie ihn der Bildschirm zeigt: nur, wenn die ganze Kette
 * arbeitet. Schlaeft eine Station, ist DAS das Problem (Zzz am Pinguin), und
 * ein roter Puls an einer anderen Stelle wuerde in die Irre fuehren. Die Ware
 * staut sich dann sichtbar VOR dem Engpass: in den Kisten, wenn es der
 * Paternoster ist, auf dem Packtisch, wenn es der Versand ist.
 */
export function engpassSichtbar(stand: ManufakturStand): Kettenglied | null {
  const glied = engpass(stand);
  if (!glied) return null;
  const alle: Kettenglied[] = ['pressen', 'paternoster', 'versand'];
  return alle.every((g) => arbeitet(stand, g)) ? glied : null;
}

/** Leistung einer Station je Sekunde auf Stufe `stufe` — die Hauptzeile im Upgrade-Blatt. */
export function leistungJeSekunde(stand: ManufakturStand, ziel: Ziel, stufe: number): number {
  const m = stand.manufaktur;
  if (ziel.art === 'presse') return presseLeistung(ziel.index, stufe, m, kartenwertBonus(stand));
  if (ziel.art === 'paternoster') return paternosterKapazitaet(stufe, m) / (paternosterFahrt(stand.pressen.length, stufe) / 1000);
  return versandKapazitaet(stufe, m) / (versandZyklus(stufe) / 1000);
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
      // Namen, wie sie im Upgrade-Blatt stehen — „Zyklus" und „Kapazität"
      // verstand beim ersten Spielen niemand (Rueckmeldung 23.10.2026).
      { name: 'Wert pro Druckgang', vorher: presseErtrag(ziel.index, stufe, m, kartenwertBonus(stand)), einheit: 'wert' },
      { name: 'Dauer pro Druckgang', vorher: presseZyklus(stufe) / 1000, einheit: 'sekunden' },
      { name: 'Arbeiter', vorher: arbeiter(stufe), einheit: 'anzahl' },
    ];
  }
  if (ziel.art === 'paternoster') {
    return [
      { name: 'Ladung pro Fahrt', vorher: paternosterKapazitaet(stufe, m), einheit: 'wert' },
      { name: 'Dauer pro Fahrt', vorher: paternosterFahrt(stand.pressen.length, stufe) / 1000, einheit: 'sekunden' },
    ];
  }
  return [
    { name: 'Ladung pro Lieferung', vorher: versandKapazitaet(stufe, m), einheit: 'wert' },
    { name: 'Dauer pro Lieferung', vorher: versandZyklus(stufe) / 1000, einheit: 'sekunden' },
  ];
}

export interface AusbauVorschau {
  stufe: number;
  /** Warenwert je Sekunde vorher → nachher. */
  leistung: { vorher: number; nachher: number };
  /** So viele Stufen sind gerade bezahlbar (kleine Zahl am Schild). */
  bezahlbar: number;
  /** Stufe nach dem Kauf; gleich `stufe`, wenn `menge` gerade nichts kauft. */
  neueStufe: number;
  /** Was es kostet — mit Rabatt, wenn er gerade wirkt. */
  kosten: number;
  /** Der Preis ohne Rabatt (im Blatt durchgestrichen); gleich `kosten`, wenn keiner wirkt. */
  kostenOhneRabatt: number;
  /** Anteil Rabatt (0 … 1) und bis wann er wirkt (ms) — 0, wenn keiner. */
  rabatt: number;
  rabattBis: number;
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
  // „Ohne Rabatt" heisst ohne Meister-Rabatt; Feilschen aus dem Buch gilt immer.
  const kostenOhneRabatt = ausbauKostenFuer(ziel, s.stufe, zeigen, stand.manufaktur) * feilschenFaktor(stand);
  const rabatt = ausbauRabatt(stand, ziel);
  const kosten = kostenOhneRabatt * (1 - rabatt);
  const vorher = kennzahlenBei(stand, ziel, s.stufe);
  const nachher = kennzahlenBei(stand, ziel, neueStufe);
  return {
    stufe: s.stufe,
    leistung: { vorher: leistungJeSekunde(stand, ziel, s.stufe), nachher: leistungJeSekunde(stand, ziel, neueStufe) },
    bezahlbar: stufenFuer(stand, ziel, 'max'),
    neueStufe,
    kosten,
    kostenOhneRabatt,
    rabatt,
    rabattBis: rabatt > 0 ? s.faehigkeitBis : 0,
    leistbar: zeigen > 0 && stand.taler + 1e-9 >= kosten,
    kennzahlen: vorher.map((k, i) => ({ ...k, nachher: nachher[i]!.vorher })),
    meilenstein: meilensteinBalken(s.stufe),
  };
}

/** Ist irgendein Ausbau dieser Station gerade bezahlbar? (Schild leuchtet gold.) */
export function ausbauLeistbar(stand: ManufakturStand, ziel: Ziel): boolean {
  return stufenFuer(stand, ziel, 'max') > 0;
}

/** Kann man an dieser Station gerade einen Meister einstellen (Platz im Pool, genug Taler)? */
export function einstellenLeistbar(stand: ManufakturStand, ziel: Ziel): boolean {
  const s = stationVon(stand, ziel);
  return !!s && platzVon(stand, ziel).pool.length < poolGroesse(stand) && stand.taler + 1e-9 >= einstellPreis(stand, ziel);
}

/** Fuer den leeren Platz in der Welt: noch kein Meister, und der erste ist bezahlbar. */
export function meisterLeistbar(stand: ManufakturStand, ziel: Ziel): boolean {
  const s = stationVon(stand, ziel);
  return !!s && !s.meister && einstellenLeistbar(stand, ziel);
}
