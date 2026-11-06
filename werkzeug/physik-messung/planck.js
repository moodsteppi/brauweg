/*
 * Adapter planck (Box2D-Abkömmling in reinem JavaScript) für buehne.js.
 * Standardwerte der Bibliothek: 8 Geschwindigkeits-, 3 Lageiterationen,
 * Schlafen an. Das Geschoss ist ein `bullet` (durchgehende Kollision), weil
 * ein schneller Bro sonst durch eine dünne Glasscheibe tunneln kann.
 */
import { World, Vec2, Box, Circle } from 'planck';
import { SCHRITT } from './buehne.js';

export default {
  name: 'planck',
  baue(teile) {
    const welt = new World({ gravity: Vec2(0, -10) });
    const beweglich = [];
    for (const t of teile) {
      const koerper = welt.createBody({ type: t.statisch ? 'static' : 'dynamic', position: Vec2(t.x, t.y) });
      koerper.createFixture(Box(t.b / 2, t.h / 2), { density: t.dichte, friction: t.reibung, restitution: t.abprall });
      if (!t.statisch) beweglich.push(koerper);
    }
    return {
      schritt: () => welt.step(SCHRITT, 8, 3),
      lage: () => beweglich.map((k) => {
        const p = k.getPosition();
        return { x: p.x, y: p.y, a: k.getAngle() };
      }),
      alleSchlafen: (n) => beweglich.slice(0, n).every((k) => !k.isAwake()),
      schuss(s) {
        const k = welt.createBody({ type: 'dynamic', position: Vec2(s.x, s.y), bullet: true });
        k.createFixture(Circle(s.r), { density: s.dichte, friction: s.reibung, restitution: s.abprall });
        k.setLinearVelocity(Vec2(s.vx, s.vy));
        beweglich.push(k);
      },
    };
  },
};
