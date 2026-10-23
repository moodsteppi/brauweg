/**
 * Welches Bild der Kartenmanufaktur wohin gehoert (Bilder aus
 * docs/ASSETS-KARTENMANUFAKTUR.md, ausgeliefert unter public/manufaktur/).
 *
 * Reine Anzeige, keine Spielregel: Die Stufe kommt vom Server, hier wird
 * nur entschieden, welches der drei Pressenbilder dazu passt.
 */

const ORDNER = '/manufaktur';

/**
 * Die Presse sieht nach Ausbau aus: Holzpresse, ab Stufe 25 Gusseisen, ab
 * Stufe 100 Dampf. 25 ist der erste Leistungssprung (×2 alle 25 Stufen,
 * regeln.ts) — das Bild wechselt also genau dann, wenn die Zahl sich
 * verdoppelt, und nicht irgendwann dazwischen.
 */
export function presseBild(stufe: number): string {
  const fassung = stufe >= 100 ? 3 : stufe >= 25 ? 2 : 1;
  return `${ORDNER}/presse-${fassung}.webp`;
}

/** Je Presse ein eigener Kartenstapel; es gibt acht Pressen und acht Stapel. */
export function stapelBild(index: number): string {
  return `${ORDNER}/stapel-${Math.min(8, Math.max(1, index + 1))}.webp`;
}

/** Kopfbild je Manufaktur (1 … 5), Prestige-Stufe wie vom Server gezaehlt. */
export function manufakturBild(nummer: number): string {
  return `${ORDNER}/manufaktur-${Math.min(5, Math.max(1, nummer))}.webp`;
}

/**
 * Bedienelemente (Lieferung 24.10.2026, docs/ASSETS-KARTENMANUFAKTUR-UI.md).
 * Was in der Welt liegt, setzt manufaktur.css als Hintergrund; hier stehen
 * nur die Bilder, die als <img> im Bildschirm stehen.
 */
export const UI_ORDNER = '/manufaktur/ui';

/** Medaillon der Station (Upgrade-Blatt, leerer Meister-Platz in der Uebersicht). */
export function medaillonBild(art: 'presse' | 'paternoster' | 'versand'): string {
  return `${UI_ORDNER}/medaillon-${art}.webp`;
}

/** Der Meister der Station als Brustbild im selben Rahmen wie das Medaillon. */
export function meisterBild(art: 'presse' | 'paternoster' | 'versand'): string {
  return `${UI_ORDNER}/meister-${art}.webp`;
}

/**
 * Die Zeigehand der Anleitung. Die Fingerspitze liegt laut ui.json bei
 * (45, 20) von 256 — nicht beim bestellten (84, 28); gemessen, nicht geraten.
 */
export const FINGER = { bild: `${UI_ORDNER}/ui-finger.webp`, spitze: [45 / 256, 20 / 256] as const };
export const TIPP_RING = `${UI_ORDNER}/ui-tipp-ring.webp`;

export const BILD = {
  lager: `${ORDNER}/lager.webp`,
  versand: `${ORDNER}/versand.webp`,
  drucker: `${ORDNER}/pinguin-drucker.webp`,
  meister: `${ORDNER}/pinguin-meister.webp`,
} as const;
