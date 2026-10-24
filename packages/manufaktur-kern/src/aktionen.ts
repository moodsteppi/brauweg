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
  JUBILAEEN_MIT_MUENZEN,
  MUENZEN_JUBILAEUM,
  MAX_MANUFAKTUR,
  MAX_PRESSEN,
  MAX_STUFE,
  MUENZEN_MILLION,
  MUENZEN_UMZUG,
  type Ziel,
  ausbauKostenFuer,
  freischaltKosten,
  maxKaufbar,
} from './formeln.js';
import {
  VERKAUF_ANTEIL,
  abklingMs,
  besetze,
  einstellPreis,
  platzVon,
  rabatt,
  sichereUhren,
  slotVon,
  weiseZu,
  wirkMs,
  ziehe,
} from './meister.js';
import { type Eintrag, BUCH, SIEGEL_UMZUG, buchPreis, feilschenFaktor, poolGroesse } from './werkstattbuch.js';
import { type ManufakturStand, type Station, kopiere, neuePresse, neuerStand } from './stand.js';
import { kannStarten, starte, vorspulen } from './zeit.js';

export type Menge = 1 | 10 | 50 | 'max';

export type Aktion =
  /** Figur oder Maschine angetippt: ein Zyklus, wenn kein Meister da ist. */
  | { typ: 'arbeiten'; ziel: Ziel }
  | { typ: 'ausbauen'; ziel: Ziel; menge: Menge }
  /** Einen Meister einstellen (Zufall ab der vierten Einstellung). `meister` ist der alte Name. */
  | { typ: 'einstellen'; ziel: Ziel }
  | { typ: 'meister'; ziel: Ziel }
  /** Einen Meister aus dem Pool an die Station stellen — kostenlos, jederzeit. */
  | { typ: 'zuweisen'; ziel: Ziel; id: number }
  /** Einen Meister entlassen: die Haelfte seines Preises zurueck. */
  | { typ: 'verkaufen'; ziel: Ziel; id: number }
  /** Eine Stufe im Werkstattbuch, bezahlt mit Siegeln. */
  | { typ: 'buch'; eintrag: Eintrag }
  | { typ: 'faehigkeit'; ziel: Ziel }
  /** Alle bereiten Meister-Faehigkeiten auf einmal. */
  | { typ: 'boost' }
  | { typ: 'freischalten' }
  | { typ: 'umziehen' }
  /** Im Kartenpalast mit allen acht Pressen: neu anfangen, ein Gildensiegel mehr. */
  | { typ: 'jubilaeum' };

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

/** Anteil, der beim Ausbau gerade vom Preis abgeht — nur solange der Rabatt-Meister wirkt. */
export function ausbauRabatt(stand: ManufakturStand, ziel: Ziel): number {
  const s = stationVon(stand, ziel);
  return s ? rabatt(ziel.art, s, stand.zeit) : 0;
}

/** Was `anzahl` Stufen ab der jetzigen kosten — mit Rabatt, wenn er gerade wirkt. */
export function ausbauPreis(stand: ManufakturStand, ziel: Ziel, anzahl: number): number {
  const s = stationVon(stand, ziel);
  if (!s) return Infinity;
  return ausbauKostenFuer(ziel, s.stufe, anzahl, stand.manufaktur) * (1 - ausbauRabatt(stand, ziel)) * feilschenFaktor(stand);
}

/** Wie viele Stufen `menge` gerade bedeutet (0: geht nicht). Max rechnet mit dem Rabatt. */
export function stufenFuer(stand: ManufakturStand, ziel: Ziel, menge: Menge): number {
  const s = stationVon(stand, ziel);
  if (!s) return 0;
  if (menge === 'max') {
    // Der Rabatt senkt jeden Preis um denselben Anteil — also reicht das Geld so weit wie ohne Rabatt mehr Geld.
    const frei = (1 - ausbauRabatt(stand, ziel)) * feilschenFaktor(stand);
    return maxKaufbar(ziel, s.stufe, stand.taler / Math.max(1e-9, frei), stand.manufaktur);
  }
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

/**
 * Jubilaeum: Wer im Kartenpalast (der letzten Manufaktur) alle acht Pressen
 * gebaut hat, kann neu anfangen und bekommt ein Gildensiegel — dauerhaft +10 %
 * Kartenwert. So endet das Spiel nicht nach fuenf Manufakturen.
 */
export function kannJubilaeum(stand: ManufakturStand): boolean {
  return stand.manufaktur >= MAX_MANUFAKTUR && stand.pressen.length >= MAX_PRESSEN;
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

/** Die Pause beginnt, wenn die Wirkung endet — so steht es in der Rangtabelle (1 min, dann 5 min). */
function loeseAus(stand: ManufakturStand, s: Station, jetzt: number): void {
  const rang = s.rang ?? 'jung';
  s.faehigkeitBis = jetzt + wirkMs(stand, rang);
  s.abklingenBis = s.faehigkeitBis + abklingMs(stand, rang);
}

/** Neue Halle (Umzug, Jubilaeum): alles von vorn, nur Meister, Zufall und Meilensteine bleiben. */
function neueHalle(stand: ManufakturStand, t: number, manufaktur: number, kennung: string, jubilaeen: number): ManufakturStand {
  sichereUhren(stand);
  const neu = neuerStand(t, manufaktur, {
    meilensteine: [...stand.meilensteine, kennung],
    jubilaeen,
    belegschaft: stand.belegschaft,
    zufall: stand.zufall,
    naechsteMeisterId: stand.naechsteMeisterId,
    siegel: stand.siegel,
    werkstattbuch: stand.werkstattbuch,
  });
  besetze(neu);
  return neu;
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
      bezahle(stand, ausbauPreis(stand, aktion.ziel, anzahl));
      s.stufe += anzahl;
      break;
    }
    case 'meister':
    case 'einstellen': {
      const s = stationVon(stand, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      const platz = platzVon(stand, aktion.ziel);
      if (platz.pool.length >= poolGroesse(stand)) throw new AktionAbgelehnt('manufakturPoolVoll');
      const preis = einstellPreis(stand, aktion.ziel);
      bezahle(stand, preis);
      const { rang, art } = ziehe(stand, aktion.ziel);
      const id = stand.naechsteMeisterId;
      stand.naechsteMeisterId += 1;
      platz.pool.push({ id, rang, art, preis, faehigkeitBis: 0, abklingenBis: 0 });
      platz.eingestellt += 1;
      stand.belegschaft[slotVon(aktion.ziel)] = platz;
      // Der Erste arbeitet gleich; jeder weitere wartet im Pool, bis man ihn zuweist.
      if (platz.zugewiesen === null) weiseZu(stand, aktion.ziel, id, s, t);
      break;
    }
    case 'zuweisen': {
      const s = stationVon(stand, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      const platz = stand.belegschaft[slotVon(aktion.ziel)];
      if (!platz?.pool.some((m) => m.id === aktion.id)) throw new AktionAbgelehnt('manufakturKeinMeister');
      if (platz.zugewiesen !== aktion.id) weiseZu(stand, aktion.ziel, aktion.id, s, t);
      break;
    }
    case 'verkaufen': {
      const s = stationVon(stand, aktion.ziel);
      const platz = stand.belegschaft[slotVon(aktion.ziel)];
      const m = platz?.pool.find((k) => k.id === aktion.id);
      if (!platz || !m) throw new AktionAbgelehnt('manufakturKeinMeister');
      if (platz.zugewiesen === m.id) weiseZu(stand, aktion.ziel, null, s, t);
      platz.pool = platz.pool.filter((k) => k.id !== m.id);
      stand.taler += m.preis * VERKAUF_ANTEIL;
      break;
    }
    case 'faehigkeit': {
      const s = stationVon(stand, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      if (!s.meister) throw new AktionAbgelehnt('manufakturKeinMeister');
      if (!faehigkeitBereit(s, t)) throw new AktionAbgelehnt('manufakturAbklingen');
      loeseAus(stand, s, t);
      break;
    }
    case 'boost': {
      const bereit = alleZiele(stand)
        .map((z) => stationVon(stand, z)!)
        .filter((s) => faehigkeitBereit(s, t));
      if (bereit.length === 0) throw new AktionAbgelehnt('manufakturAbklingen');
      for (const s of bereit) loeseAus(stand, s, t);
      break;
    }
    case 'buch': {
      if (!(aktion.eintrag in BUCH)) throw new AktionAbgelehnt('manufakturUnbekannt');
      const preis = buchPreis(stand, aktion.eintrag);
      if (preis === null) throw new AktionAbgelehnt('manufakturHoechststufe');
      if (stand.siegel < preis) throw new AktionAbgelehnt('manufakturZuWenigSiegel');
      stand.siegel -= preis;
      stand.werkstattbuch[aktion.eintrag] = (stand.werkstattbuch[aktion.eintrag] ?? 0) + 1;
      break;
    }
    case 'freischalten': {
      if (stand.pressen.length >= MAX_PRESSEN) throw new AktionAbgelehnt('manufakturVoll');
      bezahle(stand, freischaltKosten(stand.pressen.length, stand.manufaktur));
      stand.pressen.push(neuePresse());
      // Hat diese Etage aus einer frueheren Halle schon einen Meister, steht er gleich da.
      besetze(stand);
      break;
    }
    case 'umziehen': {
      if (stand.manufaktur >= MAX_MANUFAKTUR) throw new AktionAbgelehnt('manufakturLetzte');
      if (!kannUmziehen(stand)) throw new AktionAbgelehnt('manufakturUmzugZuFrueh');
      const naechste = stand.manufaktur + 1;
      const kennung = `umzug-${naechste}`;
      meilensteine.push({ kennung, muenzen: MUENZEN_UMZUG });
      stand.siegel += SIEGEL_UMZUG;
      return { stand: neueHalle(stand, t, naechste, kennung, stand.jubilaeen), meilensteine };
    }
    case 'jubilaeum': {
      if (!kannJubilaeum(stand)) throw new AktionAbgelehnt('manufakturJubilaeumZuFrueh');
      const nummer = stand.jubilaeen + 1;
      const kennung = `jubilaeum-${nummer}`;
      meilensteine.push({ kennung, muenzen: nummer <= JUBILAEEN_MIT_MUENZEN ? MUENZEN_JUBILAEUM : 0 });
      return { stand: neueHalle(stand, t, stand.manufaktur, kennung, nummer), meilensteine };
    }
  }

  for (const m of neueMeilensteine(stand)) {
    stand.meilensteine.push(m.kennung);
    meilensteine.push(m);
  }
  return { stand, meilensteine };
}
