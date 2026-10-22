/**
 * Kartenmanufaktur: die Regeln als reine Funktionen (Emile, 23.10.2026).
 * Spielentwurf: docs/SPEZIFIKATION-KARTENMANUFAKTUR.md.
 *
 * Hier steht ALLES, was rechnet — Raten, Kosten, der Ablauf der Zeit, die
 * Aktionen. Keine Datenbank, keine Uhr: Die Zeit kommt als Zahl herein. So
 * rechnet der Server online und offline dieselbe Manufaktur, und der Test
 * spult Stunden vor, ohne zu warten.
 *
 * Der Bildschirm rechnet nichts davon nach: Er bekommt Raten und Kosten aus
 * `ansicht` und zaehlt zwischen zwei Antworten nur mit diesen Raten hoch.
 */

export const MAX_PRESSEN = 8;
export const MAX_STUFE = 200;
export const MAX_MANUFAKTUR = 5;
/** So lange arbeitet eine Station ohne Meister nach einem Tipp. */
export const SCHICHT_MS = 10_000;
/** So lange laeuft die Manufaktur hoechstens weiter, waehrend die App zu ist. */
export const OFFLINE_MS = 8 * 60 * 60 * 1000;
/** Ab diesem Gesamtverdienst kann man in die naechste Manufaktur umziehen. */
export const UMZUG_AB = 1e10;
/** Meilensteine fuers Hub: Muenzen, nicht Taler. */
export const MUENZEN_MILLION = 50;
export const MUENZEN_UMZUG = 300;

export interface Station {
  stufe: number;
  meister: boolean;
  /** Ende der laufenden Schicht (ms), 0 = keine. Mit Meister ohne Bedeutung. */
  aktivBis: number;
}

export interface Presse extends Station {
  /** Gedruckter Wert, der auf das Laufband wartet. */
  ablage: number;
}

export interface ManufakturStand {
  /** Welche Manufaktur (1 … 5) — steigt beim Umzug. */
  manufaktur: number;
  taler: number;
  /** Verdienst in DIESER Manufaktur — fuer Umzug und Meilensteine. */
  verdient: number;
  pressen: Presse[];
  laufband: Station;
  versand: Station;
  /** Oben angekommener Wert, der auf den Versand wartet. */
  lager: number;
  /** Erreichte Meilensteine, etwa `million-2`. Bleiben ueber den Umzug. */
  meilensteine: string[];
  /** Bis hierhin (ms) ist gerechnet. */
  zeit: number;
}

export type Ziel = { art: 'presse'; index: number } | { art: 'laufband' } | { art: 'versand' };

export type Aktion =
  | { typ: 'ausbauen'; ziel: Ziel }
  | { typ: 'meister'; ziel: Ziel }
  | { typ: 'schicht'; ziel: Ziel }
  | { typ: 'freischalten' }
  | { typ: 'umziehen' };

// ---------------------------------------------------------------------------
// Zahlen
// ---------------------------------------------------------------------------

/** Jede weitere Manufaktur druckt doppelt so viel — fuer alle Stationen. */
export function faktor(manufaktur: number): number {
  return 2 ** (manufaktur - 1);
}

/** Alle 25 Stufen verdoppelt sich die Leistung (wie im Vorbild). */
function sprung(stufe: number): number {
  return 2 ** Math.floor(stufe / 25);
}

export function presseRate(index: number, stufe: number, manufaktur: number): number {
  return 9 ** index * stufe * sprung(stufe) * faktor(manufaktur);
}

export function transportRate(stufe: number, manufaktur: number): number {
  return 4 * stufe * sprung(stufe) * faktor(manufaktur);
}

export function rate(stand: ManufakturStand, ziel: Ziel): number {
  if (ziel.art === 'presse') {
    const presse = stand.pressen[ziel.index];
    return presse ? presseRate(ziel.index, presse.stufe, stand.manufaktur) : 0;
  }
  const station = ziel.art === 'laufband' ? stand.laufband : stand.versand;
  return transportRate(station.stufe, stand.manufaktur);
}

export function ausbauKosten(ziel: Ziel, stufe: number): number {
  if (ziel.art === 'presse') return 10 * 11 ** ziel.index * 1.13 ** (stufe - 1);
  return 25 * 1.14 ** (stufe - 1);
}

export function freischaltKosten(anzahlPressen: number): number {
  // Die zweite Presse kostet 60, jede weitere dreizehnmal so viel.
  return 60 * 13 ** (anzahlPressen - 1);
}

export function meisterKosten(ziel: Ziel): number {
  return ziel.art === 'presse' ? 100 * 12 ** ziel.index : 150;
}

// ---------------------------------------------------------------------------
// Stand
// ---------------------------------------------------------------------------

function station(): Station {
  return { stufe: 1, meister: false, aktivBis: 0 };
}

export function neuerStand(jetzt: number, manufaktur = 1, meilensteine: string[] = []): ManufakturStand {
  return {
    manufaktur,
    taler: 0,
    verdient: 0,
    pressen: [{ ...station(), ablage: 0 }],
    laufband: station(),
    versand: station(),
    lager: 0,
    meilensteine,
    zeit: jetzt,
  };
}

function aktiv(s: Station, t: number): boolean {
  return s.meister || t < s.aktivBis;
}

function stationVon(stand: ManufakturStand, ziel: Ziel): Station | undefined {
  if (ziel.art === 'presse') return stand.pressen[ziel.index];
  return ziel.art === 'laufband' ? stand.laufband : stand.versand;
}

/**
 * Laesst die Zeit bis `bis` laufen, in Sekundenschritten (der letzte
 * Schritt anteilig). Liegt die letzte Rechnung laenger als `OFFLINE_MS`
 * zurueck, laeuft nur so viel — die Uhr springt trotzdem auf `bis`.
 *
 * In jedem Schritt in dieser Reihenfolge: Pressen drucken in ihre Ablage,
 * das Laufband holt von oben nach unten, bis seine Ladung voll ist, der
 * Versand verkauft aus dem Lager. Arbeitet niemand mehr (keine Meister,
 * alle Schichten vorbei), springt die Rechnung ans Ende.
 */
export function vorspulen(alt: ManufakturStand, bis: number): ManufakturStand {
  if (bis <= alt.zeit) return alt;
  const stand: ManufakturStand = {
    ...alt,
    pressen: alt.pressen.map((p) => ({ ...p })),
    laufband: { ...alt.laufband },
    versand: { ...alt.versand },
  };
  const ende = Math.min(bis, alt.zeit + OFFLINE_MS);
  let t = alt.zeit;
  while (t < ende) {
    const irgendwer =
      stand.pressen.some((p) => aktiv(p, t)) || aktiv(stand.laufband, t) || aktiv(stand.versand, t);
    if (!irgendwer) break;
    const dt = Math.min(1000, ende - t) / 1000;

    stand.pressen.forEach((p, i) => {
      if (aktiv(p, t)) p.ablage += presseRate(i, p.stufe, stand.manufaktur) * dt;
    });
    if (aktiv(stand.laufband, t)) {
      let ladung = transportRate(stand.laufband.stufe, stand.manufaktur) * dt;
      for (const p of stand.pressen) {
        if (ladung <= 0) break;
        const nimm = Math.min(ladung, p.ablage);
        p.ablage -= nimm;
        ladung -= nimm;
        stand.lager += nimm;
      }
    }
    if (aktiv(stand.versand, t)) {
      const verkauft = Math.min(stand.lager, transportRate(stand.versand.stufe, stand.manufaktur) * dt);
      stand.lager -= verkauft;
      stand.taler += verkauft;
      stand.verdient += verkauft;
    }
    t += dt * 1000;
  }
  stand.zeit = bis;
  return stand;
}

/** Neue Meilensteine in diesem Stand — der Aufrufer zahlt die Muenzen. */
export function neueMeilensteine(stand: ManufakturStand): { kennung: string; muenzen: number }[] {
  const neu: { kennung: string; muenzen: number }[] = [];
  const million = `million-${stand.manufaktur}`;
  if (stand.verdient >= 1e6 && !stand.meilensteine.includes(million)) {
    neu.push({ kennung: million, muenzen: MUENZEN_MILLION });
  }
  return neu;
}

export class AktionAbgelehnt extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function bezahle(stand: ManufakturStand, kosten: number): void {
  if (stand.taler + 1e-9 < kosten) throw new AktionAbgelehnt('manufakturZuTeuer');
  stand.taler = Math.max(0, stand.taler - kosten);
}

/**
 * Eine Aktion zum Zeitpunkt `jetzt`. Rechnet erst bis `jetzt` nach, dann
 * gilt die Aktion — wer ausbaut, bezahlt mit dem Geld, das bis zu diesem
 * Augenblick verdient ist. Liefert ausserdem die Muenzen fuer erreichte
 * Meilensteine (Umzug, erste Million).
 */
export function handle(
  alt: ManufakturStand,
  aktion: Aktion,
  jetzt: number,
): { stand: ManufakturStand; meilensteine: { kennung: string; muenzen: number }[] } {
  const stand = vorspulen(alt, jetzt);
  const kopie: ManufakturStand = {
    ...stand,
    pressen: stand.pressen.map((p) => ({ ...p })),
    laufband: { ...stand.laufband },
    versand: { ...stand.versand },
    meilensteine: [...stand.meilensteine],
  };
  const meilensteine: { kennung: string; muenzen: number }[] = [];

  switch (aktion.typ) {
    case 'ausbauen': {
      const s = stationVon(kopie, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      if (s.stufe >= MAX_STUFE) throw new AktionAbgelehnt('manufakturHoechststufe');
      bezahle(kopie, ausbauKosten(aktion.ziel, s.stufe));
      s.stufe += 1;
      break;
    }
    case 'meister': {
      const s = stationVon(kopie, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      if (s.meister) throw new AktionAbgelehnt('manufakturHatMeister');
      bezahle(kopie, meisterKosten(aktion.ziel));
      s.meister = true;
      break;
    }
    case 'schicht': {
      const s = stationVon(kopie, aktion.ziel);
      if (!s) throw new AktionAbgelehnt('manufakturUnbekannt');
      // Eine laufende Schicht wird nicht verlaengert — Tippen im Akkord
      // ersetzt keinen Meister.
      if (!s.meister && jetzt >= s.aktivBis) s.aktivBis = jetzt + SCHICHT_MS;
      break;
    }
    case 'freischalten': {
      if (kopie.pressen.length >= MAX_PRESSEN) throw new AktionAbgelehnt('manufakturVoll');
      bezahle(kopie, freischaltKosten(kopie.pressen.length));
      kopie.pressen.push({ stufe: 1, meister: false, aktivBis: 0, ablage: 0 });
      break;
    }
    case 'umziehen': {
      if (kopie.verdient < UMZUG_AB) throw new AktionAbgelehnt('manufakturUmzugZuFrueh');
      if (kopie.manufaktur >= MAX_MANUFAKTUR) throw new AktionAbgelehnt('manufakturLetzte');
      const naechste = kopie.manufaktur + 1;
      const kennung = `umzug-${naechste}`;
      const neu = neuerStand(jetzt, naechste, [...kopie.meilensteine, kennung]);
      meilensteine.push({ kennung, muenzen: MUENZEN_UMZUG });
      return { stand: neu, meilensteine };
    }
  }

  for (const m of neueMeilensteine(kopie)) {
    kopie.meilensteine.push(m.kennung);
    meilensteine.push(m);
  }
  return { stand: kopie, meilensteine };
}

// ---------------------------------------------------------------------------
// Ansicht fuer den Bildschirm
// ---------------------------------------------------------------------------

export interface StationAnsicht {
  stufe: number;
  maxStufe: number;
  meister: boolean;
  /** Arbeitet gerade (Meister oder laufende Schicht). */
  aktiv: boolean;
  /** Ende der Schicht (ms) ohne Meister, sonst null. */
  schichtBis: number | null;
  /** Leistung in Taler je Sekunde auf der jetzigen Stufe. */
  rate: number;
  /** Leistung nach dem naechsten Ausbau. */
  rateNaechste: number;
  ausbauKosten: number | null;
  meisterKosten: number | null;
}

export interface ManufakturAnsicht {
  manufaktur: number;
  maxManufaktur: number;
  taler: number;
  verdient: number;
  lager: number;
  pressen: (StationAnsicht & { ablage: number })[];
  laufband: StationAnsicht;
  versand: StationAnsicht;
  freischaltKosten: number | null;
  umzugAb: number;
  kannUmziehen: boolean;
  /** Was im Augenblick je Sekunde passiert — der Bildschirm zaehlt damit hoch. */
  proSekunde: { taler: number; lager: number; ablagen: number[] };
  /** Der langsamste Teil der Kette, dort lohnt der Ausbau. */
  engpass: 'pressen' | 'laufband' | 'versand' | null;
  zeit: number;
}

function stationAnsicht(stand: ManufakturStand, ziel: Ziel, jetzt: number): StationAnsicht {
  const s = stationVon(stand, ziel)!;
  const naechste: ManufakturStand =
    ziel.art === 'presse'
      ? { ...stand, pressen: stand.pressen.map((p, i) => (i === ziel.index ? { ...p, stufe: p.stufe + 1 } : p)) }
      : ziel.art === 'laufband'
        ? { ...stand, laufband: { ...stand.laufband, stufe: stand.laufband.stufe + 1 } }
        : { ...stand, versand: { ...stand.versand, stufe: stand.versand.stufe + 1 } };
  return {
    stufe: s.stufe,
    maxStufe: MAX_STUFE,
    meister: s.meister,
    aktiv: aktiv(s, jetzt),
    schichtBis: !s.meister && s.aktivBis > jetzt ? s.aktivBis : null,
    rate: rate(stand, ziel),
    rateNaechste: s.stufe >= MAX_STUFE ? rate(stand, ziel) : rate(naechste, ziel),
    ausbauKosten: s.stufe >= MAX_STUFE ? null : ausbauKosten(ziel, s.stufe),
    meisterKosten: s.meister ? null : meisterKosten(ziel),
  };
}

/**
 * Die Ansicht zum Zeitpunkt `jetzt` (der Stand muss bis dorthin gerechnet
 * sein). `proSekunde` ist der Augenblick: Was Pressen, Laufband und Versand
 * GERADE schaffen, mit den Ablagen und dem Lager, die gerade da sind. Der
 * Bildschirm zaehlt damit hoch und holt sich spaetestens beim Ende einer
 * Schicht einen neuen Stand.
 */
export function ansicht(stand: ManufakturStand, jetzt: number): ManufakturAnsicht {
  const druck = stand.pressen.map((p, i) => (aktiv(p, jetzt) ? presseRate(i, p.stufe, stand.manufaktur) : 0));
  const band = aktiv(stand.laufband, jetzt) ? transportRate(stand.laufband.stufe, stand.manufaktur) : 0;
  const versand = aktiv(stand.versand, jetzt) ? transportRate(stand.versand.stufe, stand.manufaktur) : 0;

  // Was das Laufband je Sekunde aus jeder Ablage holt: von oben nach unten,
  // aus dem Vorrat oder, wo keiner liegt, so viel wie gerade gedruckt wird.
  let rest = band;
  const abholen = stand.pressen.map((p, i) => {
    const verfuegbar = p.ablage > 0 ? Infinity : druck[i]!;
    const nimm = Math.min(rest, verfuegbar);
    rest -= nimm;
    return nimm;
  });
  const zufluss = abholen.reduce((a, b) => a + b, 0);
  const verkauf = stand.lager > 0 ? versand : Math.min(versand, zufluss);

  const gesamtDruck = stand.pressen.reduce((summe, p, i) => summe + presseRate(i, p.stufe, stand.manufaktur), 0);
  const bandVoll = transportRate(stand.laufband.stufe, stand.manufaktur);
  const versandVoll = transportRate(stand.versand.stufe, stand.manufaktur);
  const kleinste = Math.min(gesamtDruck, bandVoll, versandVoll);
  const engpass = kleinste === gesamtDruck ? 'pressen' : kleinste === bandVoll ? 'laufband' : 'versand';

  return {
    manufaktur: stand.manufaktur,
    maxManufaktur: MAX_MANUFAKTUR,
    taler: stand.taler,
    verdient: stand.verdient,
    lager: stand.lager,
    pressen: stand.pressen.map((p, index) => ({
      ...stationAnsicht(stand, { art: 'presse', index }, jetzt),
      ablage: p.ablage,
    })),
    laufband: stationAnsicht(stand, { art: 'laufband' }, jetzt),
    versand: stationAnsicht(stand, { art: 'versand' }, jetzt),
    freischaltKosten: stand.pressen.length >= MAX_PRESSEN ? null : freischaltKosten(stand.pressen.length),
    umzugAb: UMZUG_AB,
    kannUmziehen: stand.verdient >= UMZUG_AB && stand.manufaktur < MAX_MANUFAKTUR,
    proSekunde: {
      taler: verkauf,
      lager: zufluss - verkauf,
      ablagen: druck.map((d, i) => d - abholen[i]!),
    },
    engpass,
    zeit: jetzt,
  };
}
