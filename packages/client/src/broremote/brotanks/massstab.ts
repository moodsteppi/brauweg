/** Feste Zeichenwelt; die bestehende Physik in Metern wird gleichmäßig umgerechnet. */
export const SCHLACHTFELD = Object.freeze({ breite: 1200, hoehe: 650, panzerBreite: 40, panzerHoehe: 34, rohr: 23 });
export function bildEinpassen(breite: number, hoehe: number) {
  const faktor = Math.min(breite / SCHLACHTFELD.breite, hoehe / SCHLACHTFELD.hoehe);
  return { faktor, x: (breite - SCHLACHTFELD.breite * faktor) / 2, y: (hoehe - SCHLACHTFELD.hoehe * faktor) / 2 };
}
