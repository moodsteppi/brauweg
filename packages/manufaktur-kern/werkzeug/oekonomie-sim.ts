/**
 * Oekonomie-Simulation der Kartenmanufaktur.
 *
 *   npm run sim --workspace @brauweg/manufaktur-kern [-- --stunden 3]
 *
 * Ein vernuenftiger Spieler, drei Stunden lang, mit genau dem Kern, den
 * Server und Client benutzen:
 *  - Er tippt etwa dreimal je Sekunde auf eine Station, die schlaeft und
 *    keinen Meister hat (ein Finger, reihum).
 *  - Er kauft, was den besten Ertrag je Taler bringt — unter dem, was er
 *    sich in rund einer Minute leisten koennte. Ist das Beste noch zu teuer,
 *    spart er darauf.
 *  - Sobald er kann, zieht er um.
 *
 * Ausgabe: eine Zeittabelle, die Abweichung von den Zielzeiten und die
 * laengste Strecke ohne Kauf (Ziel: unter drei Minuten).
 */

import {
  type Aktion,
  AktionAbgelehnt,
  type ManufakturStand,
  type Ziel,
  ausbauKosten,
  ertragProSekunde,
  freischaltKosten,
  handle,
  kannStarten,
  kannUmziehen,
  meisterKosten,
  neuerStand,
  vorspulen,
  presseLeistung,
  MAX_PRESSEN,
  MAX_STUFE,
  STELLSCHRAUBEN,
} from '../src/index.js';

const SCHRITT_MS = 1000 / 3;
const stundenArg = process.argv.indexOf('--stunden');
const DAUER = (stundenArg > 0 ? Number(process.argv[stundenArg + 1]) : 3) * 3600_000;

interface Ereignis {
  zeit: number;
  was: string;
}

interface Kandidat {
  aktion: Aktion;
  kosten: number;
  wert: number;
  name: string;
}

function ziele(stand: ManufakturStand): Ziel[] {
  return [
    { art: 'versand' },
    { art: 'paternoster' },
    ...stand.pressen.map((_, index) => ({ art: 'presse' as const, index })),
  ];
}

function name(ziel: Ziel): string {
  return ziel.art === 'presse' ? `Presse ${ziel.index + 1}` : ziel.art === 'paternoster' ? 'Paternoster' : 'Versand';
}

function station(stand: ManufakturStand, ziel: Ziel) {
  return ziel.art === 'presse' ? stand.pressen[ziel.index]! : ziel.art === 'paternoster' ? stand.paternoster : stand.versand;
}

/** Was der Spieler kaufen koennte, mit dem Zuwachs, den er sich davon verspricht. */
function kandidaten(stand: ManufakturStand): Kandidat[] {
  const jetzt = ertragProSekunde(stand);
  const liste: Kandidat[] = [];
  for (const ziel of ziele(stand)) {
    const s = station(stand, ziel);
    if (s.stufe < MAX_STUFE) {
      const probe: ManufakturStand = JSON.parse(JSON.stringify(stand));
      station(probe, ziel).stufe += 1;
      liste.push({
        aktion: { typ: 'ausbauen', ziel, menge: 1 },
        kosten: ausbauKosten(ziel, s.stufe, stand.manufaktur),
        wert: ertragProSekunde(probe) - jetzt,
        name: `${name(ziel)} Stufe ${s.stufe + 1}`,
      });
    }
    if (!s.meister) {
      // Ein Meister macht den Finger frei: Er ist so viel wert wie ein guter
      // Teil des Ertrags, den die Station sonst nur durch Tippen bringt.
      liste.push({
        aktion: { typ: 'meister', ziel },
        kosten: meisterKosten(ziel, stand.manufaktur),
        wert: Math.max(jetzt, 0.5) * 0.5,
        name: `Meister ${name(ziel)}`,
      });
    }
  }
  if (stand.pressen.length < MAX_PRESSEN) {
    const neu = stand.pressen.length;
    const probe: ManufakturStand = JSON.parse(JSON.stringify(stand));
    probe.pressen.push({ ...probe.pressen[0]!, stufe: 1, meister: false, kiste: 0, laeuft: false, fortschritt: 0 });
    // Eine neue Etage ist auch dann etwas wert, wenn der Transport gerade bremst:
    // Ohne sie gibt es spaeter nichts auszubauen.
    const zuwachs = ertragProSekunde(probe) - jetzt;
    liste.push({
      aktion: { typ: 'freischalten' },
      kosten: freischaltKosten(neu, stand.manufaktur),
      wert: Math.max(zuwachs, presseLeistung(neu, 1, stand.manufaktur) * 0.5),
      name: `Presse ${neu + 1} gebaut`,
    });
  }
  return liste;
}

function versuche(stand: ManufakturStand, aktion: Aktion, t: number): { stand: ManufakturStand } | null {
  try {
    return handle(stand, aktion, t);
  } catch (err) {
    if (err instanceof AktionAbgelehnt) return null;
    throw err;
  }
}

function mmss(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(3, ' ')}:${String(s % 60).padStart(2, '0')}`;
}

/** Wann gespielt wird: immer (Profil „aktiv") oder in Sitzungen (Profil „Gelegenheit"). */
interface Plan {
  /** Spielt jemand zur Zeit `t`? */
  aktiv: (t: number) => boolean;
  /** Der Beginn der naechsten Sitzung nach `t`. */
  naechste: (t: number) => number;
}

const IMMER: Plan = { aktiv: () => true, naechste: (t) => t };

const TAG = 24 * 3600_000;
/** Vier Sitzungen a drei Minuten: morgens, mittags, abends, spaet. */
const SITZUNGEN_H = [8, 12, 18, 22];
const SITZUNG_MS = 3 * 60_000;
const GELEGENHEIT: Plan = {
  aktiv: (t) => SITZUNGEN_H.some((h) => {
    const start = Math.floor(t / TAG) * TAG + h * 3600_000;
    return t >= start && t < start + SITZUNG_MS;
  }),
  naechste: (t) => {
    const tag = Math.floor(t / TAG) * TAG;
    for (let d = 0; d < 2; d += 1) {
      for (const h of SITZUNGEN_H) {
        const start = tag + d * TAG + h * 3600_000;
        if (start > t) return start;
      }
    }
    return tag + 2 * TAG;
  },
};

function simuliere(DAUER_MS: number, bisManufaktur = Infinity, plan: Plan = IMMER): { ereignisse: Ereignis[]; laengsteLuecke: { ab: number; dauer: number }; stand: ManufakturStand } {
  let stand = neuerStand(0);
  const ereignisse: Ereignis[] = [];
  const merke = (zeit: number, was: string): void => {
    ereignisse.push({ zeit, was });
  };
  let letzterKauf = 0;
  let laengsteLuecke = { ab: 0, dauer: 0 };
  let tippReihum = 0;
  let ersterVerkauf = false;
  let ersterAusbau = false;
  let ersterMeister = false;

  for (let t = plan.aktiv(0) ? 0 : plan.naechste(0); t <= DAUER_MS; t += SCHRITT_MS) {
    if (!plan.aktiv(t)) {
      // Offline bis zur naechsten Sitzung — der Kern deckelt selbst auf OFFLINE_MS.
      t = plan.naechste(t);
      stand = vorspulen(stand, t);
      letzterKauf = t;
      continue;
    }
    stand = vorspulen(stand, t);
    // Ein Tipp: die naechste schlafende Station ohne Meister, die anfangen kann.
    const liste = ziele(stand);
    for (let k = 0; k < liste.length; k += 1) {
      const ziel = liste[(tippReihum + k) % liste.length]!;
      const s = station(stand, ziel);
      if (!s.meister && !s.laeuft && kannStarten(stand, ziel.art)) {
        stand = handle(stand, { typ: 'arbeiten', ziel }, t).stand;
        tippReihum = (tippReihum + k + 1) % liste.length;
        break;
      }
    }

    if (!ersterVerkauf && stand.verdient > 0) {
      ersterVerkauf = true;
      merke(t, 'erste Karte verkauft');
    }

    if (kannUmziehen(stand)) {
      merke(t, `Umzug in Manufaktur ${stand.manufaktur + 1}`);
      if (stand.manufaktur + 1 > bisManufaktur) break;
      stand = handle(stand, { typ: 'umziehen' }, t).stand;
      letzterKauf = t;
      continue;
    }

    // Kaufen: das Beste unter dem, was in etwa einer Minute erreichbar ist.
    const erreichbar = Math.max(stand.taler, ertragProSekunde(stand) * 60);
    const beste = kandidaten(stand)
      .filter((k) => k.kosten <= erreichbar && k.wert > 0)
      .sort((a, b) => b.wert / b.kosten - a.wert / a.kosten)[0];
    if (beste && beste.kosten <= stand.taler) {
      const neu = versuche(stand, beste.aktion, t);
      if (neu) {
        stand = neu.stand;
        const luecke = t - letzterKauf;
        if (luecke > laengsteLuecke.dauer) laengsteLuecke = { ab: letzterKauf, dauer: luecke };
        letzterKauf = t;
        if (beste.aktion.typ === 'ausbauen' && !ersterAusbau) {
          ersterAusbau = true;
          merke(t, `erstes Upgrade (${beste.name})`);
        }
        if (beste.aktion.typ === 'meister') {
          merke(t, ersterMeister ? beste.name : `erster Meister (${beste.name})`);
          ersterMeister = true;
        }
        if (beste.aktion.typ === 'freischalten') merke(t, beste.name);
      }
    }
  }
  return { ereignisse, laengsteLuecke, stand };
}

/** Zielzeiten in Minuten (von, bis) — docs/SPEZIFIKATION-KARTENMANUFAKTUR.md. */
const ZIELE: { was: RegExp; text: string; von: number; bis: number }[] = [
  { was: /^erste Karte verkauft/, text: 'erste Karte verkauft', von: 0, bis: 0.25 },
  { was: /^erstes Upgrade/, text: 'erstes Upgrade', von: 0, bis: 20 / 60 },
  { was: /^erster Meister/, text: 'erster Meister', von: 1, bis: 2 },
  { was: /^Presse 2 gebaut/, text: 'Presse 2', von: 2, bis: 3 },
  { was: /^Presse 3 gebaut/, text: 'Presse 3', von: 6, bis: 8 },
  { was: /^Presse 5 gebaut/, text: 'Presse 5', von: 25, bis: 35 },
  { was: /^Presse 8 gebaut/, text: 'alle 8 Pressen', von: 60, bis: 90 },
  { was: /^Umzug in Manufaktur 2/, text: 'erster Umzug', von: 60, bis: 90 },
];

/** Wie weit ein Lauf von den Zielen weg ist (Minuten ausserhalb der Fenster). */
function abstand(ereignisse: Ereignis[], luecke: number, mitZweiter = true): number {
  let summe = 0;
  for (const z of ZIELE) {
    const e = ereignisse.find((x) => z.was.test(x.was));
    if (!e) {
      summe += 60;
      continue;
    }
    const min = e.zeit / 60_000;
    summe += min < z.von ? z.von - min : min > z.bis ? min - z.bis : 0;
  }
  // Die zweite Manufaktur soll nicht kuerzer sein als 60 % der ersten (eigene
  // Vorgabe: Sonst ist der Umzug eine Abkuerzung) und nicht laenger als die erste.
  const u2 = ereignisse.find((x) => /^Umzug in Manufaktur 2/.test(x.was));
  const u3 = ereignisse.find((x) => /^Umzug in Manufaktur 3/.test(x.was));
  if (u2 && mitZweiter) {
    const erste = u2.zeit / 60_000;
    const zweite = u3 ? (u3.zeit - u2.zeit) / 60_000 : Infinity;
    if (zweite < 0.6 * erste) summe += 0.6 * erste - zweite;
    if (zweite > erste) summe += Math.min(60, zweite - erste);
  }
  if (luecke > 3) summe += (luecke - 3) * 5;
  return summe;
}

function suche(): void {
  const raster = {
    KARTENWERT_STEIGUNG: [4, 5, 6],
    FREISCHALT_GRUND: [150, 300, 600, 1200],
    FREISCHALT_STEIGUNG: [10, 12, 14],
    PRESSE_K0_STEIGUNG: [8, 10, 13],
  };
  let bestes = { wert: Infinity, werte: {} as Record<string, number> };
  for (const k of raster.KARTENWERT_STEIGUNG)
    for (const u of raster.FREISCHALT_GRUND)
      for (const st of raster.FREISCHALT_STEIGUNG)
        for (const k0 of raster.PRESSE_K0_STEIGUNG) {
          Object.assign(STELLSCHRAUBEN, { KARTENWERT_STEIGUNG: k, FREISCHALT_GRUND: u, FREISCHALT_STEIGUNG: st, PRESSE_K0_STEIGUNG: k0 });
          const lauf = simuliere(2 * 3600_000, 1);
          const wert = abstand(lauf.ereignisse, lauf.laengsteLuecke.dauer / 60_000, false);
          if (wert < bestes.wert) {
            bestes = { wert, werte: { KARTENWERT_STEIGUNG: k, FREISCHALT_GRUND: u, FREISCHALT_STEIGUNG: st, PRESSE_K0_STEIGUNG: k0 } };
            console.log(`  ${wert.toFixed(1)}  ${JSON.stringify(bestes.werte)}`);
          }
        }
  Object.assign(STELLSCHRAUBEN, bestes.werte);
  for (const p of [2, 3, 4, 6, 8, 12, 16]) {
    STELLSCHRAUBEN.PREIS_JE_MANUFAKTUR = p;
    const lauf = simuliere(4 * 3600_000, 2);
    console.log(`  PREIS_JE_MANUFAKTUR ${p}: ${abstand(lauf.ereignisse, lauf.laengsteLuecke.dauer / 60_000).toFixed(1)}`);
  }
}

function tageUndStunde(ms: number): string {
  const tag = Math.floor(ms / TAG) + 1;
  const h = Math.floor((ms % TAG) / 3600_000);
  return `Tag ${tag}, ${String(h).padStart(2, '0')} Uhr`;
}

/** Profil „Gelegenheitsspieler": vier Sitzungen a drei Minuten am Tag, dazwischen offline. */
function gelegenheit(): void {
  const lauf = simuliere(60 * TAG, 2, GELEGENHEIT);
  console.log('\nProfil Gelegenheitsspieler (4 × 3 min am Tag, dazwischen offline: hoechstens 1 h zum halben Tempo)\n');
  for (const e of lauf.ereignisse) {
    if (/gebaut|Umzug|erster Meister|Meister Versand|Meister Paternoster/.test(e.was)) console.log(`  ${tageUndStunde(e.zeit).padEnd(16)} ${e.was}`);
  }
  const p5 = lauf.ereignisse.find((e) => /^Presse 5 gebaut/.test(e.was));
  const umzug = lauf.ereignisse.find((e) => /^Umzug in Manufaktur 2/.test(e.was));
  const tage = (e?: Ereignis) => (e ? `${(e.zeit / TAG).toFixed(1)} Tage (${tageUndStunde(e.zeit)})` : 'nicht in 60 Tagen');
  console.log(`\n  Bis Presse 5:        ${tage(p5)}`);
  console.log(`  Bis zum ersten Umzug: ${tage(umzug)}\n`);
}

if (process.argv.includes('--gelegenheit')) {
  gelegenheit();
  process.exit(0);
}

if (process.argv.includes('--suche')) {
  suche();
  process.exit(0);
}

const { ereignisse, laengsteLuecke, stand } = simuliere(DAUER);

console.log('\nKartenmanufaktur — Oekonomie-Simulation\n');
console.log(' Zeit    Ereignis');
console.log(' ------  ------------------------------');
for (const e of ereignisse) console.log(` ${mmss(e.zeit)}  ${e.was}`);

console.log('\n Ziel                    erreicht   Soll          Abweichung');
console.log(' ----------------------  ---------  ------------  ----------');
let abweichungen = 0;
for (const z of ZIELE) {
  const e = ereignisse.find((x) => z.was.test(x.was));
  const soll = `${z.von}–${z.bis < 1 ? `${Math.round(z.bis * 60)} s` : `${z.bis} min`}`;
  if (!e) {
    abweichungen += 1;
    console.log(` ${z.text.padEnd(22)}  ${'—'.padStart(9)}  ${soll.padEnd(12)}  nicht erreicht`);
    continue;
  }
  const min = e.zeit / 60_000;
  const urteil = min < z.von ? `${(z.von - min).toFixed(1)} min zu frueh` : min > z.bis ? `${(min - z.bis).toFixed(1)} min zu spaet` : 'im Ziel';
  if (urteil !== 'im Ziel') abweichungen += 1;
  console.log(` ${z.text.padEnd(22)}  ${mmss(e.zeit).padStart(9)}  ${soll.padEnd(12)}  ${urteil}`);
}
const lueckeMin = laengsteLuecke.dauer / 60_000;
console.log(
  `\n Laengste Strecke ohne Kauf: ${lueckeMin.toFixed(1)} min (ab ${mmss(laengsteLuecke.ab).trim()}) — Ziel unter 3 min${lueckeMin > 3 ? ' — VERFEHLT' : ''}`,
);
console.log(
  ` Ende: Manufaktur ${stand.manufaktur}, ${stand.pressen.length} Pressen, Stufen ${stand.pressen.map((p) => p.stufe).join('/')}, Paternoster ${stand.paternoster.stufe}, Versand ${stand.versand.stufe}`,
);
console.log(` ${abweichungen} Ziel(e) verfehlt.\n`);
