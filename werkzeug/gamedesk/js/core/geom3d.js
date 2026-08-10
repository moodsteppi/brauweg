/* GameDesk — Geometrie für das 3D-Modul
 *
 * Alle Grundkörper entstehen aus zwei 2D-Kurven:
 *   Querschnitt  – geschlossene Kurve in der XZ-Ebene (Kreis, Quadrat, Dreieck …)
 *   Profil       – offene Kurve in (Radius, Y) vom unteren zum oberen Pol
 * Beide können verrundete Ecken haben; dadurch bekommt ein Quader alle zwölf
 * Kanten rund, ein Zylinder die beiden Ränder, ein Kegel Spitze und Fuß.
 *
 * Die fertigen Netze werden nach Form + Parametern zwischengespeichert, damit
 * hundert gleiche Würfel nur ein einziges Netz belegen.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------- Katalog */

  const KINDS = [
    { id: 'cube',     label: 'Würfel',        icon: '⬛', scale: [1, 1, 1],     round: true },
    { id: 'box',      label: 'Quader',        icon: '▬', scale: [1.6, 0.8, 1], round: true },
    { id: 'plane',    label: 'Ebene',         icon: '▭', scale: [1, 1, 1],     round: true },
    { id: 'prism',    label: 'Dreieck',       icon: '△', scale: [1, 1, 1],     round: true },
    { id: 'pyramid',  label: 'Pyramide',      icon: '◭', scale: [1, 1, 1],     round: true },
    { id: 'cylinder', label: 'Zylinder',      icon: '⬭', scale: [1, 1, 1],     round: true },
    { id: 'cone',     label: 'Kegel',         icon: '▲', scale: [1, 1, 1],     round: true },
    { id: 'sphere',   label: 'Kugel',         icon: '⬤', scale: [1, 1, 1],     round: false },
    { id: 'torus',    label: 'Torus',         icon: '◎', scale: [1, 1, 1],     round: false }
  ];

  /* Standardparameter je Form */
  function defaults(kind) {
    switch (kind) {
      case 'cube':
      case 'box':      return { round: 0.06, sides: 4, seg: 4 };
      case 'plane':    return { round: 0.04, sides: 4, seg: 3, thin: 0.02 };
      case 'prism':    return { round: 0.05, sides: 3, seg: 4 };
      case 'pyramid':  return { round: 0.05, sides: 4, seg: 4 };
      case 'cylinder': return { round: 0.08, sides: 32, seg: 4 };
      case 'cone':     return { round: 0.06, sides: 32, seg: 4 };
      case 'sphere':   return { sides: 32, rings: 20 };
      case 'torus':    return { sides: 32, rings: 16, tube: 0.34 };
      default:         return { round: 0.06, sides: 4, seg: 4 };
    }
  }

  /* -------------------------------------------------- 2D-Bausteine --- */

  /** Verrundete Ecke aus drei Punkten: liefert Bogenpunkte samt Normalen */
  function fillet(A, B, C, rr, seg, out) {
    const ax = A[0] - B[0], ay = A[1] - B[1];
    const cx = C[0] - B[0], cy = C[1] - B[1];
    const la = Math.hypot(ax, ay) || 1, lc = Math.hypot(cx, cy) || 1;
    const a = [ax / la, ay / la], c = [cx / lc, cy / lc];
    const dot = Math.max(-1, Math.min(1, a[0] * c[0] + a[1] * c[1]));
    const alpha = Math.acos(dot);

    // Außennormalen der beiden Kanten (zeigen von der Ecke weg nach außen)
    const nA = outward([-a[0], -a[1]], B);
    const nC = outward(c, B);

    if (alpha < 1e-4 || Math.PI - alpha < 1e-4 || rr < 1e-5) {
      out.push({ x: B[0], y: B[1], nx: nA[0], ny: nA[1] });
      out.push({ x: B[0], y: B[1], nx: nC[0], ny: nC[1] });
      return;
    }

    const half = alpha / 2;
    const tan = rr / Math.tan(half);
    const maxTan = Math.min(la, lc) * 0.5;
    const k = tan > maxTan ? maxTan / tan : 1;
    const R = rr * k;
    const t = R / Math.tan(half);
    const dist = R / Math.sin(half);

    let bx = a[0] + c[0], by = a[1] + c[1];
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl; by /= bl;
    const ce = [B[0] + bx * dist, B[1] + by * dist];

    const p1 = [B[0] + a[0] * t, B[1] + a[1] * t];
    const p2 = [B[0] + c[0] * t, B[1] + c[1] * t];
    let a1 = Math.atan2(p1[1] - ce[1], p1[0] - ce[0]);
    let a2 = Math.atan2(p2[1] - ce[1], p2[0] - ce[0]);
    let d = a2 - a1;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;

    const n = Math.max(1, seg);
    for (let i = 0; i <= n; i++) {
      const ang = a1 + d * (i / n);
      const nx = Math.cos(ang), ny = Math.sin(ang);
      out.push({ x: ce[0] + nx * R, y: ce[1] + ny * R, nx: nx, ny: ny });
    }

    function outward(dir, at) {
      const c1 = [dir[1], -dir[0]], c2 = [-dir[1], dir[0]];
      return (c1[0] * at[0] + c1[1] * at[1]) >= (c2[0] * at[0] + c2[1] * at[1]) ? c1 : c2;
    }
  }

  /** Geschlossener Querschnitt: Kreis oder verrundetes n-Eck, auf [-1,1] normiert */
  function crossSection(sides, round, seg) {
    const pts = [];
    if (sides >= 24) {
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * TAU;
        pts.push({ x: Math.cos(a), y: Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) });
      }
      return pts;
    }

    const offset = sides === 4 ? Math.PI / 4 : sides === 3 ? -Math.PI / 2 : Math.PI / 2;
    const v = [];
    for (let i = 0; i < sides; i++) {
      const a = offset + (i / sides) * TAU;
      v.push([Math.cos(a), Math.sin(a)]);
    }
    let m = 0;
    for (const p of v) m = Math.max(m, Math.abs(p[0]), Math.abs(p[1]));
    for (const p of v) { p[0] /= m; p[1] /= m; }

    const raw = [];
    for (let i = 0; i < sides; i++) {
      fillet(v[(i - 1 + sides) % sides], v[i], v[(i + 1) % sides], round, seg, raw);
    }
    raw.push({ x: raw[0].x, y: raw[0].y, nx: raw[0].nx, ny: raw[0].ny });
    return raw;
  }

  /** Profil eines Zylinders/Quaders: senkrechte Wand mit verrundeten Rändern */
  function profileRect(round, seg) {
    const rr = Math.min(Math.max(round, 0), 0.98);
    const n = rr < 1e-4 ? 1 : Math.max(1, seg);
    const pts = [{ r: 0, y: -1, nr: 0, ny: -1 }, { r: 1 - rr, y: -1, nr: 0, ny: -1 }];
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / n);
      pts.push({ r: 1 - rr + rr * Math.cos(a), y: -1 + rr + rr * Math.sin(a), nr: Math.cos(a), ny: Math.sin(a) });
    }
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI / 2) * (i / n);
      pts.push({ r: 1 - rr + rr * Math.cos(a), y: 1 - rr + rr * Math.sin(a), nr: Math.cos(a), ny: Math.sin(a) });
    }
    pts.push({ r: 1 - rr, y: 1, nr: 0, ny: 1 }, { r: 0, y: 1, nr: 0, ny: 1 });
    return pts;
  }

  /** Profil eines Kegels/einer Pyramide: Fuß und Spitze verrundbar */
  function profileCone(round, seg) {
    const rr = Math.min(Math.max(round, 0), 0.33);
    const n = rr < 1e-4 ? 1 : Math.max(1, seg);
    const S = Math.sqrt(5);                       // Schräge durch (1,-1) und (0,1)
    const slant = Math.atan2(1, 2);               // Winkel der Außennormalen (2,1)/√5
    const pts = [];

    const bcY = -1 + rr;
    const bcR = 1 - rr * (1 + S) / 2;
    pts.push({ r: 0, y: -1, nr: 0, ny: -1 });
    pts.push({ r: bcR, y: -1, nr: 0, ny: -1 });
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + (slant + Math.PI / 2) * (i / n);
      pts.push({ r: bcR + rr * Math.cos(a), y: bcY + rr * Math.sin(a), nr: Math.cos(a), ny: Math.sin(a) });
    }

    const tcY = 1 - rr * S;
    for (let i = 0; i <= n; i++) {
      const a = slant + (Math.PI / 2 - slant) * (i / n);
      pts.push({ r: rr * Math.cos(a), y: tcY + rr * Math.sin(a), nr: Math.cos(a), ny: Math.sin(a) });
    }
    pts.push({ r: 0, y: tcY + rr, nr: 0, ny: 1 });
    return pts;
  }

  function profileSphere(rings) {
    const pts = [];
    for (let i = 0; i <= rings; i++) {
      const a = -Math.PI / 2 + Math.PI * (i / rings);
      pts.push({ r: Math.cos(a), y: Math.sin(a), nr: Math.cos(a), ny: Math.sin(a) });
    }
    return pts;
  }

  /* ------------------------------------------------------ Vernetzung */

  function revolve(cross, profile, scaleY, squash) {
    const nu = cross.length, nv = profile.length;
    const count = nu * nv;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);

    // Bogenlängen für gleichmäßige Texturkoordinaten
    const su = arcLengths(cross, (p) => [p.x, p.y]);
    const sv = arcLengths(profile, (p) => [p.r, p.y]);
    const sy = scaleY === undefined ? 1 : scaleY;

    let k = 0, t = 0;
    for (let j = 0; j < nv; j++) {
      const pr = profile[j];
      for (let i = 0; i < nu; i++, k++) {
        const c = cross[i];
        position[k * 3] = c.x * pr.r;
        position[k * 3 + 1] = pr.y * sy;
        position[k * 3 + 2] = c.y * pr.r;

        let nx = c.nx * pr.nr, ny = pr.ny / sy, nz = c.ny * pr.nr;
        if (squash) { nx *= squash[0]; ny *= squash[1]; nz *= squash[2]; }
        const l = Math.hypot(nx, ny, nz) || 1;
        normal[k * 3] = nx / l; normal[k * 3 + 1] = ny / l; normal[k * 3 + 2] = nz / l;

        uv[k * 2] = su[i];
        uv[k * 2 + 1] = sv[j];
      }
      t++;
    }

    const index = [];
    for (let j = 0; j < nv - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    return finish(position, normal, uv, index);
  }

  function arcLengths(list, get) {
    const out = [0];
    let total = 0;
    for (let i = 1; i < list.length; i++) {
      const a = get(list[i - 1]), b = get(list[i]);
      total += Math.hypot(b[0] - a[0], b[1] - a[1]);
      out.push(total);
    }
    if (total > 0) for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
  }

  function finish(position, normal, uv, index) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < position.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        if (position[i + a] < min[a]) min[a] = position[i + a];
        if (position[i + a] > max[a]) max[a] = position[i + a];
      }
    }
    return {
      position: position, normal: normal, uv: uv,
      index: new Uint32Array(index),
      min: min, max: max,
      triangles: index.length / 3
    };
  }

  function torus(sides, rings, tube) {
    const nu = sides + 1, nv = rings + 1;
    const position = new Float32Array(nu * nv * 3);
    const normal = new Float32Array(nu * nv * 3);
    const uv = new Float32Array(nu * nv * 2);
    const R = 1 - tube;
    let k = 0;
    for (let j = 0; j < nv; j++) {
      const v = (j / rings) * TAU, cv = Math.cos(v), sv2 = Math.sin(v);
      for (let i = 0; i < nu; i++, k++) {
        const u = (i / sides) * TAU, cu = Math.cos(u), su = Math.sin(u);
        position[k * 3] = (R + tube * cv) * cu;
        position[k * 3 + 1] = tube * sv2;
        position[k * 3 + 2] = (R + tube * cv) * su;
        normal[k * 3] = cv * cu; normal[k * 3 + 1] = sv2; normal[k * 3 + 2] = cv * su;
        uv[k * 2] = i / sides; uv[k * 2 + 1] = j / rings;
      }
    }
    const index = [];
    for (let j = 0; j < nv - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    return finish(position, normal, uv, index);
  }

  /* ------------------------------------------------------------- API */

  function build(kind, p) {
    const o = Object.assign(defaults(kind), p || {});
    const seg = Math.max(1, Math.min(10, o.seg | 0 || 4));
    switch (kind) {
      case 'cube':
      case 'box':
        return revolve(crossSection(4, o.round, seg), profileRect(o.round, seg));
      case 'plane':
        return revolve(crossSection(4, o.round, seg), profileRect(Math.min(o.round, 0.9), seg), o.thin || 0.02);
      case 'prism':
        return revolve(crossSection(3, o.round, seg), profileRect(o.round, seg));
      case 'pyramid':
        return revolve(crossSection(4, o.round, seg), profileCone(o.round, seg));
      case 'cylinder':
        return revolve(crossSection(Math.max(8, o.sides | 0), 0, seg), profileRect(o.round, seg));
      case 'cone':
        return revolve(crossSection(Math.max(8, o.sides | 0), 0, seg), profileCone(o.round, seg));
      case 'sphere':
        return revolve(crossSection(Math.max(8, o.sides | 0), 0, seg), profileSphere(Math.max(4, o.rings | 0)));
      case 'torus':
        return torus(Math.max(8, o.sides | 0), Math.max(4, o.rings | 0), Math.min(0.9, Math.max(0.02, o.tube)));
      default:
        return revolve(crossSection(4, 0.06, seg), profileRect(0.06, seg));
    }
  }

  const cache = new Map();

  GD.geom3d = {
    KINDS: KINDS,
    defaults: defaults,

    kind(id) { return KINDS.find((k) => k.id === id) || KINDS[0]; },

    key(kind, params) {
      const o = Object.assign(defaults(kind), params || {});
      return kind + '|' + [o.round, o.sides, o.seg, o.rings, o.tube, o.thin]
        .map((v) => (v === undefined ? '' : Math.round(v * 1000) / 1000)).join(',');
    },

    /** Netz aus dem Zwischenspeicher (baut es beim ersten Mal) */
    get(kind, params) {
      const k = GD.geom3d.key(kind, params);
      let mesh = cache.get(k);
      if (!mesh) {
        mesh = build(kind, params);
        mesh.key = k;
        cache.set(k, mesh);
        if (cache.size > 160) {                    // ältesten Eintrag verwerfen
          const first = cache.keys().next().value;
          if (first !== k) cache.delete(first);
        }
      }
      return mesh;
    },

    stats() {
      let tris = 0;
      for (const m of cache.values()) tris += m.triangles;
      return { meshes: cache.size, triangles: tris };
    }
  };
})();
