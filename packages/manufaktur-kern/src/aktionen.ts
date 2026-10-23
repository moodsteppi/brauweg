/**
 * Was ein Spieler tun kann. Jede Aktion rechnet erst bis `jetzt` nach und
 * gilt dann — wer ausbaut, bezahlt mit dem, was bis zu diesem Augenblick
 * verkauft ist.
 *
 * Der Client ruft dieselbe Funktion auf, um sofort zu zeigen, was der Server
 * gleich bestaetigen wird. Massgeblich bleibt der Server: Meilensteine
 * zahlen echte Muenzen fuers Hub.
 */

import {
  ABKLINGEN_MS,
  FAEHIGKEIT_MS,
  MAX_MANUFAKTUR,
  MAX_PRESSEN,
  MAX_STUFE,
  MUENZEN_MILLION,
  MUENZEN_UMZUG,
  type Ziel,
  ausbauKostenFuer,
  freischaltKosten,
  maxKaufbar,
  meisterKosten,
} from './formeln.js';
import { type ManufakturStand, type Station, kopiere, neuePresse, neuerStand } from './stand.js';
import { kannStarten, starte, vorspulen } from './zeit.js';

export type Menge = 1 | 10 | 50 | 'max';

export type Aktion =
  /** Figur oder Maschine angetippt: ein Zyklus, wenn kein Meister da ist. */
  | { typ: 'arbeiten'; ziel: Ziel }
  | { typ: 'ausbauen'; ziel: Ziel; menge: Menge }
  | { typ: 'meister'; ziel: Ziel }
  | { typ: 'faehigkeit'; ziel: Ziel }
  /** Alle bereiten Meister-Faehigkeiten auf einmal. */
  | { typ: 'boost' }
  | { typ: 'freischalten' }
  | { typ: 'umziehen' };

export interface Meilenstein {
  kennung: string;
  muenzen: number;
}

export class AktionAbgelehnt extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function stationVon(stand: ManufakturStand, ziel: Ziel): Station | undefined {
  if (ziel.art === 'presse') return stand.pressen[ziel.index];
  return ziel.art === 'paternoster' ? stand.paternoster : stand.versand;
}

function bezahle(stand: ManufakturStand, kosten: number): void {
  if (stand.taler + 1e-9 < kosten) throw new AktionAbgelehnt('manufakturZuTeuer');
  stand.taler = Math.max(0, stand.taler - kosten);
}

/** Wie viele Stufen `menge` gerade bedeutet (0: geht nicht). */
export function stufenFuer(stand: ManufakturStand, ziel: Ziel, menge: Menge): number {
  const s = stationVon(stand, ziel);
  if (!s) return 0;
  if (menge === 'max') return maxKaufbar(ziel, s.stufe, stand.taler, stand.manufaktur);
  return Math.min(menge, MAX_STUFE - s.stufe);
}

/** Bereit heisst: Meister da, Faehigkeit nicht in der Pause. */
export function faehigkeitBereit(s: Station, jetzt: number): boolean {
  return s.meister && jetzt >= s.abklingenBis;
}

/** Umziehen darf, wer alle acht Pressen gebaut hat. */
export function kannUmziehen(stand: ManufakturStand): boolean {
  return stand.pressen.length >= MAX_PRESSEN && stand.manufaktur < MAX_MANUFAKTUR;
}

/** Neue Meilensteine in diesem Stand — der Aufrufer zahlt die Muenzen. */
export function neueMeilensteine(stand: ManufakturStand): Meilenstein[] {
  const neu: Meilenstein[] = [];
  const million = `million-${stand.manufaktur}`;
  if (stand.verdient >= 1e6 && !stand.meilensteine.includes(million)) {
    neu.push({ kennung: million, muenzen: MUENZEN_MILLION });
  }
  return neu;
}

function alleZiele(stand: ManufakturStand): Ziel[] {
  return [
    ...stand.pressen.map((_, index) => ({ art: 'presse' as const, index })),
    { art: 'paternoster' as const },
    { art: 'versand' as const },
  ];
}

function loeseAus(s: Station, jetzt: number): void {
  s.faehigkeitBis = jetzt + FAEHIGKEIT_MS;
  s.abklingenBis = jetzt + ABKLINGEN_MS;
}

export function handle(
  alt: ManufakturStand,
  aktion: Aktion,
  jetzt: number,
): { stand: ManufakturStand; meilensteine: Meilenstein[] } {
  const stand = kopiere(vorspulen(alt, jetzt));
  // Aktionen gelten am Takt, bis zu dem gerechnet ist — Server und Client
  // landen so auf derselben Zeit, auch wenn `jetzt` mitten im Takt liegt.
  const t = stand.zeit;
  const meilensteine: Meilenstein[] = [];

  switch (aktion.typ) {
    case 'arbeiten': {
      const s = stationVon(stand, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      // Mit Meister arbeitet die Station ohnehin; ein laufender Zyklus wird
      // nicht verlaengert. Beides ist kein Fehler, nur nichts zu tun.
      if (!s.meister && !s.laeuft && kannStarten(stand, aktion.ziel.art)) starte(stand, aktion.ziel);
      break;
    }
    case 'ausbauen': {
      const s = stationVon(stand, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      if (s.stufe >= MAX_STUFE) throw new AktionAbgelehnt('manufakturHoechststufe');
      const anzahl = stufenFuer(stand, aktion.ziel, aktion.menge);
      if (anzahl <= 0) throw new AktionAbgelehnt('manufakturZuTeuer');
      bezahle(stand, ausbauKostenFuer(aktion.ziel, s.stufe, anzahl, stand.manufaktur));
      s.stufe += anzahl;
      break;
    }
    case 'meister': {
      const s = stationVon(stand, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      if (s.meister) throw new AktionAbgelehnt('manufakturHatMeister');
      bezahle(stand, meisterKosten(aktion.ziel, stand.manufaktur));
      s.meister = true;
      break;
    }
    case 'faehigkeit': {
      const s = stationVon(stand, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      if (!s.meister) throw new AktionAbgelehnt('manufakturKeinMeister');
      if (!faehigkeitBereit(s, t)) throw new AktionAbgelehnt('manufakturAbklingen');
      loeseAus(s, t);
      break;
    }
    case 'boost': {
      const bereit = alleZiele(stand)
        .map((z) => stationVon(stand, z)!)
        .filter((s) => faehigkeitBereit(s, t));
      if (bereit.length === 0) throw new AktionAbgelehnt('manufakturAbklingen');
      for (const s of bereit) loeseAus(s, t);
      break;
    }
    case 'freischalten': {
      if (stand.pressen.length >= MAX_PRESSEN) throw new AktionAbgelehnt('manufakturVoll');
      bezahle(stand, freischaltKosten(stand.pressen.length, stand.manufaktur));
      stand.pressen.push(neuePresse());
      break;
    }
    case 'umziehen': {
      if (stand.manufaktur >= MAX_MANUFAKTUR) throw new AktionAbgelehnt('manufakturLetzte');
      if (!kannUmziehen(stand)) throw new AktionAbgelehnt('manufakturUmzugZuFrueh');
      const naechste = stand.manufaktur + 1;
      const kennung = `umzug-${naechste}`;
      meilensteine.push({ kennung, muenzen: MUENZEN_UMZUG });
      return { stand: neuerStand(t, naechste, [...stand.meilensteine, kennung]), meilensteine };
    }
  }

  for (const m of neueMeilensteine(stand)) {
    stand.meilensteine.push(m.kennung);
    meilensteine.push(m);
  }
  return { stand, meilensteine };
}
