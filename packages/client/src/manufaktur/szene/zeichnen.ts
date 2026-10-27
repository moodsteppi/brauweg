/**
 * Gezeichnete Teile der Manufaktur — alles, wofuer es noch kein Bild gibt:
 * Ablage-Kiste, Bodenbalken, Kopf- und Fussstueck des Schachts mit Antriebsrad,
 * Bretterwand der gesperrten Etage, Kartons auf dem Packtisch.
 *
 * Bewusst gezeichnet statt leer gelassen: Ein fehlendes Bild sieht nach
 * Fehler aus, eine Zeichnung nach Absicht (CLAUDE.md). Kommt ein Bild, ersetzt
 * es die Funktion hier, an derselben Stelle.
 *
 * Farben: Holz, Messing, Ziegel — die Kulissenfarben, nicht die Hub-Farben.
 */

import { Container, Graphics } from 'pixi.js';

export const FARBE = {
  holz: 0x7a4a26,
  holzHell: 0xa86f3c,
  holzDunkel: 0x4a2b14,
  messing: 0xc9a24a,
  messingHell: 0xf0d27a,
  eisen: 0x3a3f4f,
  schatten: 0x0a0d1c,
  karton: 0xc79a5c,
  kartonDunkel: 0x9a7240,
  rot: 0xe64646,
} as const;

/** Ablage-Kiste am Schacht: offene Holzkiste, Breite b, Hoehe h, Unterkante bei 0. */
export function kiste(b: number, h: number): Graphics {
  const g = new Graphics();
  g.roundRect(0, -h, b, h, 4).fill(FARBE.holz);
  // Bretter quer, damit es nach Kiste aussieht und nicht nach Block.
  for (let i = 1; i < 3; i += 1) g.rect(2, -h + (h / 3) * i - 1, b - 4, 2).fill(FARBE.holzDunkel);
  g.rect(0, -h, 5, h).fill(FARBE.holzHell);
  g.rect(b - 5, -h, 5, h).fill(FARBE.holzHell);
  g.roundRect(-2, -h - 4, b + 4, 6, 2).fill(FARBE.holzDunkel);
  return g;
}

/** Bodenbalken zwischen zwei Etagen, ueber die ganze Breite. */
export function balken(b: number, h: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, b, h).fill(FARBE.holz);
  g.rect(0, 0, b, 3).fill(FARBE.holzHell);
  g.rect(0, h - 3, b, 3).fill(FARBE.holzDunkel);
  // Messingbeschlaege in festen Abstaenden.
  for (let x = 30; x < b; x += 90) g.roundRect(x, 3, 10, h - 6, 2).fill(FARBE.messing);
  return g;
}

/** Der Schacht selbst: dunkle Roehre mit Fuehrungsschienen. */
export function schachtRoehre(b: number, h: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, b, h).fill({ color: FARBE.schatten, alpha: 0.82 });
  g.rect(3, 0, 3, h).fill(FARBE.eisen);
  g.rect(b - 6, 0, 3, h).fill(FARBE.eisen);
  return g;
}

/** Antriebsrad mit Speichen — dreht sich in seinem eigenen Container. */
export function rad(r: number): Container {
  const c = new Container();
  const g = new Graphics();
  g.circle(0, 0, r).fill(FARBE.messing);
  g.circle(0, 0, r - 4).fill(FARBE.eisen);
  for (let i = 0; i < 6; i += 1) {
    const w = (i / 6) * Math.PI * 2;
    g.moveTo(0, 0)
      .lineTo(Math.cos(w) * (r - 4), Math.sin(w) * (r - 4))
      .stroke({ width: 3, color: FARBE.messing });
  }
  g.circle(0, 0, 4).fill(FARBE.messingHell);
  c.addChild(g);
  return c;
}

/** Kopfstueck oben am Schacht: Holzrahmen, an dem das Rad haengt. */
export function kopfstueck(b: number, h: number): Graphics {
  const g = new Graphics();
  g.rect(0, 10, 7, h - 10).fill(FARBE.holzDunkel);
  g.rect(b - 7, 10, 7, h - 10).fill(FARBE.holzDunkel);
  g.roundRect(-4, 0, b + 8, 14, 3).fill(FARBE.holz);
  g.rect(-4, 0, b + 8, 3).fill(FARBE.holzHell);
  return g;
}

/** Fussstueck unten: Umlenkung mit kleinem Rad. */
export function fussstueck(b: number, h: number): Graphics {
  const g = new Graphics();
  g.roundRect(-4, 0, b + 8, h, 6).fill(FARBE.holzDunkel);
  g.rect(-4, 0, b + 8, 3).fill(FARBE.holzHell);
  g.circle(b / 2, h / 2, 10).fill(FARBE.messing);
  g.circle(b / 2, h / 2, 4).fill(FARBE.eisen);
  return g;
}

/** Die gesperrte Etage: Bretterwand mit Schloss. */
export function bretterwand(b: number, h: number): Graphics {
  const g = new Graphics();
  const brett = 26;
  for (let x = 0, i = 0; x < b; x += brett, i += 1) {
    g.rect(x, 0, brett - 2, h).fill(i % 2 ? FARBE.holz : FARBE.holzDunkel);
    g.rect(x, 0, 2, h).fill({ color: 0x000000, alpha: 0.25 });
  }
  // Zwei Querlatten, damit es nach Verschlag aussieht.
  g.rect(0, h * 0.22, b, 10).fill(FARBE.holzHell);
  g.rect(0, h * 0.7, b, 10).fill(FARBE.holzHell);
  return g;
}

/** Ein Vorhaengeschloss, Mitte unten bei (0, 0). */
export function schloss(groesse: number): Graphics {
  const g = new Graphics();
  const b = groesse;
  g.roundRect(-b / 2, -b * 0.7, b, b * 0.7, 4).fill(FARBE.messing);
  g.arc(0, -b * 0.7, b * 0.3, Math.PI, 0).stroke({ width: 4, color: FARBE.eisen });
  g.circle(0, -b * 0.4, 3).fill(FARBE.eisen);
  return g;
}

/** Ein Karton fuer den Packtisch, Unterkante bei 0. */
export function karton(b: number, h: number): Graphics {
  const g = new Graphics();
  g.rect(0, -h, b, h).fill(FARBE.karton);
  g.rect(0, -h, b, 3).fill(FARBE.kartonDunkel);
  g.rect(b / 2 - 1, -h, 2, h).fill(FARBE.kartonDunkel);
  return g;
}
