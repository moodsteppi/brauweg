/*
 * Adapter rapier2d (Rust, als WebAssembly) für buehne.js — die „compat"-
 * Ausgabe, die das WASM als Base64 im JavaScript trägt. Das ist die Form,
 * die ohne Bundler-Einstellung in Vite und in der App (Capacitor) läuft;
 * der Preis ist ein Drittel mehr Bytes als die getrennte .wasm-Datei.
 * Standardwerte: 4 Löseriterationen, Schlafen an. Geschoss mit CCD.
 */
import RAPIER from '@dimforge/rapier2d-compat';
import { SCHRITT } from './buehne.js';

export default {
  name: 'rapier2d-compat',
  async init() {
    await RAPIER.init();
  },
  baue(teile) {
    const welt = new RAPIER.World({ x: 0, y: -10 });
    welt.timestep = SCHRITT;
    const beweglich = [];
    for (const t of teile) {
      const desc = (t.statisch ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic()).setTranslation(t.x, t.y);
      const k = welt.createRigidBody(desc);
      welt.createCollider(
        RAPIER.ColliderDesc.cuboid(t.b / 2, t.h / 2).setDensity(t.dichte).setFriction(t.reibung).setRestitution(t.abprall),
        k,
      );
      if (!t.statisch) beweglich.push(k);
    }
    return {
      schritt: () => welt.step(),
      lage: () => beweglich.map((k) => {
        const p = k.translation();
        return { x: p.x, y: p.y, a: k.rotation() };
      }),
      alleSchlafen: (n) => beweglich.slice(0, n).every((k) => k.isSleeping()),
      schuss(s) {
        const k = welt.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic().setTranslation(s.x, s.y).setCcdEnabled(true).setLinvel(s.vx, s.vy),
        );
        welt.createCollider(
          RAPIER.ColliderDesc.ball(s.r).setDensity(s.dichte).setFriction(s.reibung).setRestitution(s.abprall),
          k,
        );
        beweglich.push(k);
      },
      zerstoere: () => welt.free(),
    };
  },
};
