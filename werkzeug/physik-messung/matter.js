/*
 * Adapter matter-js für buehne.js.
 *
 * matter rechnet in Bildschirmeinheiten mit y nach unten und Geschwindigkeit
 * je Grundschritt (1000/60 ms) — umgerechnet wird nur hier, die Bühne sieht
 * Meter wie bei den anderen. 50 Einheiten je Meter, weil matter bei kleinen
 * Körpern (unter ~10 Einheiten) erst recht nicht stapelt; das wäre ein
 * unfairer Vergleich. Iterationen bleiben bei den Standardwerten (6 / 4).
 * Durchgehende Kollision gibt es in matter nicht.
 */
import Matter from 'matter-js';
import { SCHRITT } from './buehne.js';

const M = 50;

export default {
  name: 'matter-js',
  baue(teile) {
    const engine = Matter.Engine.create({ enableSleeping: true });
    // gewünscht 10 m/s² = 500 Einheiten/s² = 0,0005 Einheiten/ms²
    engine.gravity.y = 1;
    engine.gravity.scale = 0.0005;
    const beweglich = [];
    const alle = [];
    for (const t of teile) {
      const k = Matter.Bodies.rectangle(t.x * M, -t.y * M, t.b * M, t.h * M, {
        isStatic: !!t.statisch,
        density: t.dichte / 1000,
        friction: t.reibung,
        restitution: t.abprall,
      });
      alle.push(k);
      if (!t.statisch) beweglich.push(k);
    }
    Matter.Composite.add(engine.world, alle);
    return {
      schritt: () => Matter.Engine.update(engine, SCHRITT * 1000),
      lage: () => beweglich.map((k) => ({ x: k.position.x / M, y: -k.position.y / M, a: -k.angle })),
      alleSchlafen: (n) => beweglich.slice(0, n).every((k) => k.isSleeping),
      schuss(s) {
        const k = Matter.Bodies.circle(s.x * M, -s.y * M, s.r * M, {
          density: s.dichte / 1000,
          friction: s.reibung,
          restitution: s.abprall,
        });
        Matter.Composite.add(engine.world, k);
        Matter.Body.setVelocity(k, { x: (s.vx * M) / 60, y: (-s.vy * M) / 60 });
        beweglich.push(k);
      },
      zerstoere: () => Matter.Engine.clear(engine),
    };
  },
};
