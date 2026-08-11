/* GameDesk — Modell-Bibliothek
 *
 * Fertige 3D-Modelle liegen zentral im Dokument (doc.models) und sind damit
 * für jedes Modul erreichbar: für die Anzeige-Kachel, für andere 3D-Editoren
 * (dort als *eine* Form platzierbar) und für die Code-Sandbox.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;
  const M4 = GD.m4;
  const MAX_DEPTH = 6;

  function defaultEnv() {
    return {
      background: '#12151c',
      ambient: 0.34, ambientColor: '#8fa4c4',
      // sunPos ist maßgeblich; sunDir zeigt von dort zum Nullpunkt (s. applySunPos)
      sunPos: [4.4, 8, 3.2], sunDir: [-0.455, -0.827, -0.331], sunColor: '#ffffff', sunIntensity: 1.05,
      shadows: true, shadowStrength: 0.78,
      floor: true, floorY: -1.001, floorColor: '#1a1e27', gridColor: '#39435a', gridSize: 1
    };
  }

  function defaultScene() {
    return {
      nodes: [],
      env: defaultEnv(),
      camera: { yaw: 0.7, pitch: 0.5, dist: 7, target: [0, 0.4, 0] },
      snap: { on: true, step: 0.25, rot: 15, scale: 0.1 }
    };
  }

  function defaultMaterial() {
    return {
      color: '#9fb4d8', rough: 0.5, metal: 0.05, opacity: 1,
      emissive: '#000000', emissiveStrength: 0,
      texture: null, noShadow: false, unlit: false,
      texMode: 'uv',          // 'uv' = Netzkoordinaten, 'box' = dreiachsig, 'planar' = von oben
      uvScale: [1, 1],        // Wiederholungen im uv-Modus
      uvOffset: [0, 0],
      uvRot: 0,
      texSize: 1,             // Kachelgröße in Weltmaß (box/planar)
      texStrength: 1
    };
  }

  function defaultNode(kind) {
    const k = GD.geom3d.kind(kind);
    if (kind === 'light') {
      return {
        id: U.uid('n'), name: 'Licht', kind: 'light',
        p: [1.6, 2.2, 1.6], r: [0, 0, 0], s: [1, 1, 1],
        light: { color: '#ffd9a0', intensity: 3.2, range: 9 },
        visible: true, locked: false
      };
    }
    if (kind === 'ref') {
      return {
        id: U.uid('n'), name: 'Modell', kind: 'ref', modelId: null,
        p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1],
        visible: true, locked: false
      };
    }
    return {
      id: U.uid('n'), name: k.label, kind: kind,
      p: [0, kind === 'plane' ? 0 : 1, 0], r: [0, 0, 0],
      s: k.scale.slice(),
      params: GD.geom3d.defaults(kind),
      mat: defaultMaterial(),
      visible: true, locked: false
    };
  }

  /* ------------------------------------------------------ Normieren */

  function normNode(raw) {
    const kind = typeof raw.kind === 'string' ? raw.kind : 'cube';
    const base = defaultNode(kind);
    const n = Object.assign(base, raw);
    n.id = raw.id || U.uid('n');
    n.kind = kind;
    n.p = vec3(raw.p, base.p); n.r = vec3(raw.r, base.r); n.s = vec3(raw.s, base.s);
    if (kind === 'light') n.light = Object.assign({ color: '#ffd9a0', intensity: 3, range: 9 }, raw.light || {});
    else if (kind !== 'ref') {
      n.params = Object.assign(GD.geom3d.defaults(kind), raw.params || {});
      n.mat = Object.assign(defaultMaterial(), raw.mat || {});
      if (!Array.isArray(n.mat.uvScale) || n.mat.uvScale.length !== 2) n.mat.uvScale = [1, 1];
      if (!Array.isArray(n.mat.uvOffset) || n.mat.uvOffset.length !== 2) n.mat.uvOffset = [0, 0];
      if (['uv', 'box', 'planar'].indexOf(n.mat.texMode) < 0) n.mat.texMode = 'uv';
    }
    n.visible = raw.visible !== false;
    n.locked = !!raw.locked;
    return n;
  }

  function vec3(v, fb) {
    if (!Array.isArray(v) || v.length !== 3) return fb.slice();
    return v.map((x, i) => (Number.isFinite(Number(x)) ? Number(x) : fb[i]));
  }

  function normScene(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const out = defaultScene();
    out.nodes = (Array.isArray(s.nodes) ? s.nodes : []).filter((n) => n && typeof n === 'object').map(normNode);
    out.env = Object.assign(defaultEnv(), s.env || {});
    if (!Array.isArray(out.env.sunDir) || out.env.sunDir.length !== 3) out.env.sunDir = [-0.55, -1, -0.4];
    if (!Array.isArray(out.env.sunPos) || out.env.sunPos.length !== 3) {
      // ältere Boards kennen nur die Richtung: Position daraus ableiten
      const d = out.env.sunDir;
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      out.env.sunPos = [-d[0] / l * 9.6, -d[1] / l * 9.6, -d[2] / l * 9.6];
    }
    GD.models.applySunPos(out.env);
    out.camera = Object.assign({ yaw: 0.7, pitch: 0.5, dist: 7, target: [0, 0.4, 0] }, s.camera || {});
    if (!Array.isArray(out.camera.target) || out.camera.target.length !== 3) out.camera.target = [0, 0.4, 0];
    out.snap = Object.assign({ on: true, step: 0.25, rot: 15, scale: 0.1 }, s.snap || {});
    return out;
  }

  /* -------------------------------------------------------- Auflösen */

  /**
   * Szene in Zeichenaufträge übersetzen; „ref"-Knoten werden rekursiv
   * eingesetzt (mit Tiefenbegrenzung und Zyklusschutz).
   */
  function flatten(scene, opt) {
    const o = opt || {};
    const items = [], lights = [];
    walk(scene.nodes || [], o.matrix || M4.identity(), 0, new Set(o.stack || []), null);
    return { items: items, lights: lights };

    function walk(nodes, parent, depth, stack, ownerId) {
      if (depth > MAX_DEPTH) return;
      for (const n of nodes) {
        if (n.visible === false) continue;
        const local = M4.compose(n.p, n.r, n.kind === 'light' ? [1, 1, 1] : n.s);
        const world = M4.multiply(parent, local);

        if (n.kind === 'light') {
          lights.push({
            node: n, ownerId: ownerId,
            pos: [world[12], world[13], world[14]],
            color: n.light.color, intensity: n.light.intensity, range: n.light.range
          });
          continue;
        }

        if (n.kind === 'ref') {
          const model = get(n.modelId);
          if (!model || stack.has(n.modelId)) continue;
          const next = new Set(stack); next.add(n.modelId);
          walk(model.scene.nodes || [], world, depth + 1, next, ownerId || n.id);
          continue;
        }

        items.push({
          node: n,
          ownerId: ownerId || n.id,       // bei Referenzen zählt der Referenzknoten
          mesh: GD.geom3d.get(n.kind, n.params),
          matrix: world,
          material: n.mat,
          pickable: o.pickable !== false
        });
      }
    }
  }

  /** Hüllquader einer Szene in Weltkoordinaten */
  function bounds(items) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const p = [0, 0, 0];
    for (const it of items) {
      for (let i = 0; i < 8; i++) {
        const c = [i & 1 ? it.mesh.max[0] : it.mesh.min[0], i & 2 ? it.mesh.max[1] : it.mesh.min[1], i & 4 ? it.mesh.max[2] : it.mesh.min[2]];
        M4.point(it.matrix, c, p);
        for (let a = 0; a < 3; a++) { if (p[a] < min[a]) min[a] = p[a]; if (p[a] > max[a]) max[a] = p[a]; }
      }
    }
    if (!isFinite(min[0])) return { min: [-1, 0, -1], max: [1, 2, 1], center: [0, 1, 0], radius: 1.6 };
    const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const radius = Math.max(0.4, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    return { min: min, max: max, center: center, radius: radius };
  }

  /* ---------------------------------------------------------- Backen */

  /** Alle Formen eines Modells zu einem einzigen Netz zusammenfassen */
  function bake(idOrName) {
    const model = get(idOrName) || byName(idOrName);
    if (!model) return null;
    const flat = flatten(model.scene, { pickable: false, stack: [model.id] });
    let nv = 0, ni = 0;
    for (const it of flat.items) { nv += it.mesh.position.length / 3; ni += it.mesh.index.length; }

    const position = new Float32Array(nv * 3);
    const normal = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const index = new Uint32Array(ni);
    const groups = [];

    let vo = 0, io = 0;
    const p = [0, 0, 0], d = [0, 0, 0];
    for (const it of flat.items) {
      const m = it.mesh, nm = M4.normalMatrix(it.matrix);
      const count = m.position.length / 3;
      for (let i = 0; i < count; i++) {
        M4.point(it.matrix, [m.position[i * 3], m.position[i * 3 + 1], m.position[i * 3 + 2]], p);
        position[(vo + i) * 3] = p[0]; position[(vo + i) * 3 + 1] = p[1]; position[(vo + i) * 3 + 2] = p[2];
        const nx = m.normal[i * 3], ny = m.normal[i * 3 + 1], nz = m.normal[i * 3 + 2];
        d[0] = nm[0] * nx + nm[3] * ny + nm[6] * nz;
        d[1] = nm[1] * nx + nm[4] * ny + nm[7] * nz;
        d[2] = nm[2] * nx + nm[5] * ny + nm[8] * nz;
        const l = Math.hypot(d[0], d[1], d[2]) || 1;
        normal[(vo + i) * 3] = d[0] / l; normal[(vo + i) * 3 + 1] = d[1] / l; normal[(vo + i) * 3 + 2] = d[2] / l;
        uv[(vo + i) * 2] = m.uv[i * 2]; uv[(vo + i) * 2 + 1] = m.uv[i * 2 + 1];
      }
      for (let i = 0; i < m.index.length; i++) index[io + i] = m.index[i] + vo;
      groups.push({
        start: io, count: m.index.length,
        name: it.node.name, shape: it.node.kind,
        color: it.material.color, opacity: it.material.opacity,
        emissive: it.material.emissive, emissiveStrength: it.material.emissiveStrength
      });
      vo += count; io += m.index.length;
    }

    return {
      id: model.id, name: model.name,
      position: position, normal: normal, uv: uv, index: index,
      groups: groups,
      lights: flat.lights.map((L) => ({ pos: L.pos, color: L.color, intensity: L.intensity, range: L.range })),
      triangles: ni / 3,
      vertices: nv
    };
  }

  /* ------------------------------------------------------ Bibliothek */

  function all() {
    const doc = GD.store.doc;
    if (!Array.isArray(doc.models)) doc.models = [];
    return doc.models;
  }

  function get(id) { return id ? all().find((m) => m.id === id) || null : null; }
  function byName(name) {
    if (!name) return null;
    const n = String(name).toLowerCase();
    return all().find((m) => m.name.toLowerCase() === n) || null;
  }

  function save(name, scene, existingId) {
    const list = all();
    const clean = normScene(U.clone(scene));
    clean.nodes = clean.nodes.filter((n) => n.kind !== 'light' || true);   // Lichter gehören zum Modell
    let model = existingId ? get(existingId) : null;
    if (model) {
      model.name = name || model.name;
      model.scene = clean;
      model.updated = Date.now();
    } else {
      model = { id: U.uid('mdl'), name: uniqueName(name || 'Modell'), scene: clean, updated: Date.now() };
      list.push(model);
    }
    GD.models.events.emit('changed', model);
    return model;
  }

  function uniqueName(base) {
    const list = all();
    let name = base, i = 2;
    while (list.some((m) => m.name === name)) name = base + ' ' + (i++);
    return name;
  }

  function remove(id) {
    const list = all();
    const i = list.findIndex((m) => m.id === id);
    if (i < 0) return false;
    list.splice(i, 1);
    GD.models.events.emit('changed', null);
    return true;
  }

  function rename(id, name) {
    const m = get(id);
    if (!m) return;
    m.name = uniqueName(name || m.name);
    GD.models.events.emit('changed', m);
  }

  /** Referenzzähler: wie oft wird das Modell auf dem Board verwendet? */
  function usage(id) {
    let n = 0;
    for (const w of GD.store.doc.windows) {
      if (w.type === 'modelview' && w.state && w.state.modelId === id) n++;
      if (w.type === 'model3d' && w.state && Array.isArray(w.state.nodes)) {
        n += w.state.nodes.filter((k) => k.kind === 'ref' && k.modelId === id).length;
      }
    }
    for (const m of all()) {
      if (m.id === id) continue;
      n += (m.scene.nodes || []).filter((k) => k.kind === 'ref' && k.modelId === id).length;
    }
    return n;
  }

  GD.models = {
    events: U.emitter(),
    all: all, get: get, byName: byName,
    save: save, remove: remove, rename: rename, usage: usage,
    flatten: flatten, bounds: bounds, bake: bake,
    defaultScene: defaultScene, defaultNode: defaultNode, defaultEnv: defaultEnv,
    defaultMaterial: defaultMaterial,
    normScene: normScene, normNode: normNode,

    /** Sonnenrichtung aus ihrer Position ableiten (sie scheint zum Ursprung) */
    applySunPos(env) {
      const p = env.sunPos;
      const l = Math.hypot(p[0], p[1], p[2]);
      if (l < 0.01) { env.sunPos = [0, 9.6, 0]; env.sunDir = [0, -1, 0]; return env; }
      env.sunDir = [-p[0] / l, -p[1] / l, -p[2] / l];
      return env;
    },

    /** kompakte Beschreibung für die Code-Sandbox */
    describe() {
      return all().map((m) => ({
        id: m.id, name: m.name, updated: m.updated,
        shapes: (m.scene.nodes || []).filter((n) => n.kind !== 'light').length,
        lights: (m.scene.nodes || []).filter((n) => n.kind === 'light').length
      }));
    }
  };
})();
