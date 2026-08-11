/* GameDesk — Modul „3D-Modell": Formen bauen, verformen, beleuchten, speichern
 *
 * Maus:   ziehen auf leerer Fläche = Kamera drehen, Mausrad = Abstand,
 *         mittlere/rechte Taste = schwenken, Objekt ziehen = bewegen.
 * Tasten: Umschalt = Einrasten aus · Strg = nur Y-Achse · Alt = nur X-Achse
 *         (Strg+Alt = nur Z-Achse) · G/R/S = Bewegen/Drehen/Skalieren · F = einpassen
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;
  const M4 = GD.m4;

  const PRESET_COLORS = ['#9fb4d8', '#6ea8fe', '#57c98a', '#e8b45c', '#ef6b6b', '#b78cf7', '#4fd1c5', '#cfd6e4', '#5a6479', '#1b2029'];

  GD.modules.register({
    id: 'model3d',
    label: '3D-Modell',
    icon: '⬢',
    description: 'Formen bauen und beleuchten',
    accent: '#4fd1c5',
    defaultSize: { w: 760, h: 520 },
    defaultTitle: '3D-Modell',

    create(ctx) {
      const raw = ctx.state || {};
      const state = GD.models.normScene(raw);
      state.modelId = typeof raw.modelId === 'string' ? raw.modelId : null;
      let mode = raw.mode === 'rotate' || raw.mode === 'scale' ? raw.mode : 'move';
      let selId = null;
      let hoverHint = '';
      let flat = { items: [], lights: [] };

      /* Die Sonne ist kein Szenenknoten, verhält sich aber wie einer:
         auswählbar, ziehbar, mit denselben Achsentasten. Ihre Position legt
         die Einstrahlrichtung fest (sie scheint immer zum Ursprung). */
      const sunNode = {
        id: '__sun', name: 'Sonne', kind: 'sun',
        p: state.env.sunPos.slice(), r: [0, 0, 0], s: [1, 1, 1],
        visible: true, locked: false
      };
      function applySun() {
        state.env.sunPos = sunNode.p.slice();
        GD.models.applySunPos(state.env);
      }

      /* ------------------------------------------------------------ DOM */

      const bar = U.el('div', { class: 'm3-bar' });
      const canvas = U.el('canvas', { class: 'm3-view' });
      const hint = U.el('div', { class: 'm3-hint' });
      const stage = U.el('div', { class: 'm3-stage' }, [canvas, hint]);
      const root = U.el('div', { class: 'm3-root' }, [bar, stage]);
      const c2d = canvas.getContext('2d');

      if (!GD.gl3d.available) {
        stage.innerHTML = '';
        stage.appendChild(U.el('div', { class: 'm3-nogl' }, [
          U.el('strong', { text: 'WebGL2 steht nicht zur Verfügung' }),
          U.el('p', { text: 'Das 3D-Modul braucht WebGL2. In den Browser-Einstellungen die Hardwarebeschleunigung aktivieren.' })
        ]));
      }

      /* ------------------------------------------------------ Werkzeuge */

      const addSel = U.el('select', { class: 'm3-select', title: 'Form hinzufügen' });
      addSel.appendChild(U.el('option', { value: '', text: '+ Form…' }));
      for (const k of GD.geom3d.KINDS) addSel.appendChild(U.el('option', { value: k.id, text: k.icon + '  ' + k.label }));
      addSel.appendChild(U.el('option', { value: 'light', text: '☀  Licht' }));
      addSel.appendChild(U.el('option', { value: 'ref', text: '⬢  Gespeichertes Modell' }));
      addSel.addEventListener('change', () => { const v = addSel.value; addSel.value = ''; if (v) addNode(v); });
      bar.appendChild(addSel);
      bar.appendChild(U.el('span', { class: 'm3-sep' }));

      const modeBtns = {};
      for (const [id, icon, tip] of [['move', '✥', 'Bewegen (G)'], ['rotate', '⟳', 'Drehen (R)'], ['scale', '⤢', 'Skalieren (S)']]) {
        const b = U.el('button', { class: 'm3-btn', text: icon, title: tip });
        b.addEventListener('click', () => setMode(id));
        modeBtns[id] = b;
        bar.appendChild(b);
      }
      bar.appendChild(U.el('span', { class: 'm3-sep' }));

      const snapBtn = U.el('button', { class: 'm3-btn', text: '⊹', title: 'Einrasten (Umschalt hält es kurz an)' });
      snapBtn.addEventListener('click', () => { state.snap.on = !state.snap.on; syncBar(); ctx.commit('Einrasten'); ctx.refreshInspector(); });
      const snapNum = U.el('input', { type: 'number', class: 'm3-num', value: state.snap.step, step: 0.05, min: 0.01, max: 10, title: 'Rastermaß' });
      snapNum.addEventListener('input', () => { const v = parseFloat(snapNum.value); if (v > 0) { state.snap.step = v; ctx.changed(); } });
      snapNum.addEventListener('change', () => ctx.commit('Rastermaß'));
      snapNum.addEventListener('keydown', (ev) => ev.stopPropagation());
      bar.append(snapBtn, snapNum);
      bar.appendChild(U.el('span', { class: 'm3-sep' }));

      bar.appendChild(mkBtn('⛶', 'Alles einpassen (F)', () => { frame(); }));
      bar.appendChild(mkBtn('⧉', 'Duplizieren (Strg+D)', duplicate));
      bar.appendChild(mkBtn('🗑', 'Löschen (Entf)', removeSelected));
      bar.appendChild(U.el('span', { style: { flex: '1' } }));
      const saveBtn = U.el('button', { class: 'm3-btn m3-btn--go', text: 'Als Modell speichern' });
      saveBtn.addEventListener('click', saveModel);
      bar.appendChild(saveBtn);

      function mkBtn(icon, tip, fn) {
        const b = U.el('button', { class: 'm3-btn', text: icon, title: tip });
        b.addEventListener('click', fn);
        return b;
      }

      function setMode(m) {
        mode = m;
        syncBar();
        ctx.changed();
      }

      function syncBar() {
        for (const k in modeBtns) modeBtns[k].classList.toggle('is-on', k === mode);
        snapBtn.classList.toggle('is-on', state.snap.on);
        snapNum.value = state.snap.step;
        saveBtn.textContent = state.modelId ? 'Modell aktualisieren' : 'Als Modell speichern';
        const sel = selected();
        hint.textContent = sel
          ? sel.name + '  ·  ' + ({ move: 'Bewegen', rotate: 'Drehen', scale: 'Skalieren' }[mode]) +
            '  ·  Strg = Y   Alt = X   Strg+Alt = Z   Umschalt = ohne Einrasten' + (hoverHint ? '  ·  ' + hoverHint : '')
          : (state.nodes.length ? 'Objekt anklicken · ziehen dreht die Kamera' : 'Oben links eine Form hinzufügen');
      }
      syncBar();

      /* --------------------------------------------------------- Knoten */

      function selected() {
        if (selId === '__sun') { sunNode.p = state.env.sunPos.slice(); return sunNode; }
        return selId ? state.nodes.find((n) => n.id === selId) || null : null;
      }

      function addNode(kind) {
        const n = GD.models.defaultNode(kind);
        if (kind === 'ref') {
          const list = GD.models.all().filter((m) => m.id !== state.modelId);
          if (!list.length) { ctx.toast('Noch kein Modell gespeichert', 'err'); return; }
          n.modelId = list[0].id;
          n.name = list[0].name;
        }
        // neben dem letzten Objekt ablegen, damit nichts übereinander liegt
        const others = state.nodes.filter((k) => k.kind !== 'light');
        if (others.length && kind !== 'light') n.p[0] = others[others.length - 1].p[0] + 2.4;
        state.nodes.push(n);
        selId = n.id;
        invalidate(); ctx.commit('Objekt hinzugefügt'); ctx.refreshInspector(); syncBar();
      }

      function duplicate() {
        const n = selected();
        if (!n || n.kind === 'sun') return;
        const c = U.clone(n);
        c.id = U.uid('n');
        c.name = n.name + ' Kopie';
        c.p = [n.p[0] + (state.snap.on ? state.snap.step * 4 : 1), n.p[1], n.p[2]];
        state.nodes.push(c);
        selId = c.id;
        invalidate(); ctx.commit('Objekt dupliziert'); ctx.refreshInspector();
      }

      function removeSelected() {
        const n = selected();
        if (!n || n.kind === 'sun') return;
        state.nodes = state.nodes.filter((k) => k.id !== n.id);
        selId = null;
        invalidate(); ctx.commit('Objekt gelöscht'); ctx.refreshInspector(); syncBar();
      }

      /* -------------------------------------------------------- Rendern */

      let dirty = true, visible = true, pending = false;

      function invalidate() { dirty = true; schedule(); }

      function schedule() {
        if (pending || !dirty || !visible) return;
        pending = true;
        U.nextFrame(() => { pending = false; paint(); });
      }

      function viewSize() {
        const r = canvas.getBoundingClientRect();
        return { css: r, ok: r.width > 4 && r.height > 4 };
      }

      function camera() {
        return {
          pos: GD.gl3d.orbitPos(state.camera),
          target: state.camera.target,
          fov: 42, near: 0.05, far: 400
        };
      }

      function paint() {
        if (!GD.gl3d.available) return;
        const v = viewSize();
        if (!v.ok) return;
        dirty = false;

        flat = GD.models.flatten(state);
        const cam = camera();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let w = v.css.width * dpr, h = v.css.height * dpr;
        const k = Math.min(1, 1400 / Math.max(w, h));
        w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));

        const lines = [];
        const sel = selected();

        /* Sonnenzeichen: Stern an ihrer Position plus Strahl zum Ursprung */
        const sp = state.env.sunPos;
        const sunDist = Math.hypot(sp[0] - cam.pos[0], sp[1] - cam.pos[1], sp[2] - cam.pos[2]);
        const sunR = Math.max(0.22, sunDist * 0.045);
        const sunSel = selId === '__sun';
        lines.push({ points: starLines(sp, sunSel ? sunR * 1.25 : sunR), color: sunSel ? '#4fd1c5' : state.env.sunColor, alpha: sunSel ? 1 : 0.8, noDepth: true });
        lines.push({ points: new Float32Array([sp[0], sp[1], sp[2], 0, 0, 0]), color: state.env.sunColor, alpha: sunSel ? 0.5 : 0.22 });

        if (sel) {
          const item = flat.items.find((i) => i.ownerId === sel.id);
          if (item) lines.push({ points: boxLines(item.mesh.min, item.mesh.max, item.matrix), color: '#4fd1c5', alpha: 0.95 });
          else if (sel.kind === 'light') lines.push({ points: crossLines(sel.p, 0.4), color: '#ffd9a0', alpha: 1, noDepth: true });
          if (dragAxis) lines.push({ points: axisLine(sel.p, dragAxis), color: dragAxis === 'x' ? '#ef6b6b' : dragAxis === 'y' ? '#57c98a' : '#6ea8fe', alpha: 0.9, noDepth: true });
        }
        for (const L of flat.lights) {
          if (!sel || sel.id !== L.node.id) lines.push({ points: crossLines(L.pos, 0.22), color: L.color, alpha: 0.7, noDepth: true });
        }

        GD.gl3d.render({
          target: c2d, width: w, height: h,
          items: flat.items, lights: flat.lights,
          env: state.env, camera: cam, lines: lines
        });
      }

      function boxLines(min, max, m) {
        const c = [];
        for (let i = 0; i < 8; i++) {
          c.push(M4.point(m, [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]));
        }
        const e = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
        const out = new Float32Array(e.length * 6);
        e.forEach(([a, b], i) => { out.set(c[a], i * 6); out.set(c[b], i * 6 + 3); });
        return out;
      }

      function crossLines(p, r) {
        return new Float32Array([
          p[0] - r, p[1], p[2], p[0] + r, p[1], p[2],
          p[0], p[1] - r, p[2], p[0], p[1] + r, p[2],
          p[0], p[1], p[2] - r, p[0], p[1], p[2] + r
        ]);
      }

      function starLines(p, r) {
        const d = r * 0.68;
        const segs = [
          [-r, 0, 0, r, 0, 0], [0, -r, 0, 0, r, 0], [0, 0, -r, 0, 0, r],
          [-d, -d, 0, d, d, 0], [-d, d, 0, d, -d, 0],
          [0, -d, -d, 0, d, d], [0, -d, d, 0, d, -d]
        ];
        const out = new Float32Array(segs.length * 6);
        segs.forEach((s, i) => { for (let k = 0; k < 6; k++) out[i * 6 + k] = s[k] + p[k % 3]; });
        return out;
      }

      function axisLine(p, axis) {
        const L = 60;
        const d = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
        return new Float32Array([
          p[0] - d[0] * L, p[1] - d[1] * L, p[2] - d[2] * L,
          p[0] + d[0] * L, p[1] + d[1] * L, p[2] + d[2] * L
        ]);
      }

      /* ---------------------------------------------------- Interaktion */

      let dragAxis = null;

      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); });

      function pointerRay(ev) {
        const r = canvas.getBoundingClientRect();
        return GD.gl3d.ray(camera(), r.width, r.height, ev.clientX - r.left, ev.clientY - r.top);
      }

      function onDown(ev) {
        ev.stopPropagation();
        ctx.win.select();
        if (!GD.gl3d.available) return;

        if (ev.button === 1 || ev.button === 2) { startPan(ev); return; }
        if (ev.button !== 0) return;

        const ray = pointerRay(ev);
        const helper = pickHelper(ray);          // Sonne und Lichter haben Vorrang
        const hit = helper ? null : GD.gl3d.pick(flat.items, ray.origin, ray.dir);
        const node = helper || (hit ? state.nodes.find((n) => n.id === hit.item.ownerId) : null);

        if (node && !node.locked) {
          if (selId !== node.id) { selId = node.id; ctx.refreshInspector(); }
          syncBar(); invalidate();
          startTransform(ev, node);
          return;
        }
        if (selId) { selId = null; ctx.refreshInspector(); syncBar(); invalidate(); }
        startOrbit(ev);
      }

      /** Sonne und Lichter haben keine Geometrie – Trefferkugel um die Position */
      function pickHelper(ray) {
        let best = null;
        sunNode.p = state.env.sunPos.slice();
        for (const n of state.nodes.concat([sunNode])) {
          if (n.kind !== 'light' && n.kind !== 'sun') continue;
          if (n.visible === false) continue;
          const d = [n.p[0] - ray.origin[0], n.p[1] - ray.origin[1], n.p[2] - ray.origin[2]];
          const t = d[0] * ray.dir[0] + d[1] * ray.dir[1] + d[2] * ray.dir[2];
          if (t <= 0) continue;
          const c = [ray.origin[0] + ray.dir[0] * t, ray.origin[1] + ray.dir[1] * t, ray.origin[2] + ray.dir[2] * t];
          const dist = Math.hypot(c[0] - n.p[0], c[1] - n.p[1], c[2] - n.p[2]);
          const r = Math.max(0.25, t * (n.kind === 'sun' ? 0.05 : 0.035));
          if (dist < r && (!best || t < best.t)) best = { n: n, t: t };
        }
        return best ? best.n : null;
      }

      function startOrbit(ev) {
        const y0 = state.camera.yaw, p0 = state.camera.pitch;
        U.drag(ev, {
          cursor: 'grabbing',
          onMove(dx, dy) {
            state.camera.yaw = y0 - dx * 0.008;
            state.camera.pitch = Math.max(-1.5, Math.min(1.5, p0 + dy * 0.008));
            invalidate();
          },
          onEnd(e, moved) { if (moved) ctx.changed(); }
        });
      }

      function startPan(ev) {
        const t0 = state.camera.target.slice();
        const cam = camera();
        const fwd = norm([cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[1], cam.target[2] - cam.pos[2]]);
        const right = norm(cross(fwd, [0, 1, 0]));
        const up = cross(right, fwd);
        const r = canvas.getBoundingClientRect();
        const k = state.camera.dist * 2 * Math.tan(21 * Math.PI / 180) / Math.max(r.height, 1);
        U.drag(ev, {
          cursor: 'move',
          onMove(dx, dy) {
            state.camera.target = [
              t0[0] - right[0] * dx * k + up[0] * dy * k,
              t0[1] - right[1] * dx * k + up[1] * dy * k,
              t0[2] - right[2] * dx * k + up[2] * dy * k
            ];
            invalidate();
          },
          onEnd(e, moved) { if (moved) ctx.changed(); }
        });
      }

      function onWheel(ev) {
        if (!GD.windows.selectionIds().includes(ctx.id)) return;   // sonst zoomt das Board
        ev.preventDefault();
        ev.stopPropagation();
        state.camera.dist = Math.max(0.6, Math.min(160, state.camera.dist * Math.pow(1.0015, ev.deltaY)));
        invalidate();
        wheelCommit();
      }
      const wheelCommit = U.debounce(() => ctx.changed(), 400);

      /** Achsenwahl aus den Zusatztasten: Strg = Y, Alt = X, beide = Z */
      function axisOf(e) {
        const c = e.ctrlKey || e.metaKey, a = e.altKey;
        if (c && a) return 'z';
        if (c) return 'y';
        if (a) return 'x';
        return null;
      }

      function startTransform(ev, node) {
        const startP = node.p.slice(), startR = node.r.slice(), startS = node.s.slice();
        let baseAxis = 'init', baseP = startP.slice(), baseHit = null, baseDx = 0, baseDy = 0;
        // Sonne und Lichter lassen sich nur bewegen
        const effMode = (node.kind === 'sun' || node.kind === 'light') ? 'move' : mode;

        U.drag(ev, {
          onMove(dx, dy, e) {
            const axis = axisOf(e);
            const snap = state.snap.on && !e.shiftKey;

            if (effMode === 'move') {
              // Ohne Achsentaste läuft die Sonne auf einer Kugelbahn um den
              // Nullpunkt – eine waagerechte Ebene liegt in Sonnenhöhe fast
              // parallel zum Blick und wäre nicht greifbar.
              const kind = (node.kind === 'sun' && !axis) ? 'orbit' : (axis || 'plane');
              if (kind !== baseAxis) {                       // Modus gewechselt: neu ansetzen
                baseAxis = kind;
                baseP = node.p.slice();
                baseHit = kind === 'orbit' ? null : project(e, node.p, axis);
                baseDx = dx; baseDy = dy;
                dragAxis = axis;
              }

              if (kind === 'orbit') {
                const d = Math.hypot(baseP[0], baseP[1], baseP[2]) || 9.6;
                let az = Math.atan2(baseP[0], baseP[2]) + (dx - baseDx) * 0.007;
                let el = Math.asin(U.clamp(baseP[1] / d, -1, 1)) - (dy - baseDy) * 0.007;
                el = U.clamp(el, -0.35, 1.5);
                if (snap) {
                  const step = (state.snap.rot || 15) * Math.PI / 180;
                  az = Math.round(az / step) * step;
                  el = Math.round(el / step) * step;
                }
                const r3 = (v) => Math.round(v * 1000) / 1000;
                node.p = [r3(d * Math.cos(el) * Math.sin(az)), r3(d * Math.sin(el)), r3(d * Math.cos(el) * Math.cos(az))];
                applySun();
                hoverHint = 'Sonne  ' + Math.round(az * 180 / Math.PI) + '° / ' + Math.round(el * 180 / Math.PI) + '° Höhe';
                syncBar(); invalidate();
                return;
              }

              const now = project(e, baseP, axis);
              if (!now || !baseHit) return;
              const next = [
                baseP[0] + (now[0] - baseHit[0]),
                baseP[1] + (now[1] - baseHit[1]),
                baseP[2] + (now[2] - baseHit[2])
              ];
              const out = snap
                ? next.map((v) => Math.round(v / state.snap.step) * state.snap.step)
                : next.map((v) => Math.round(v * 1000) / 1000);
              // gesperrte Achsen bleiben exakt stehen (auch beim Einrasten)
              if (axis === 'x') { out[1] = baseP[1]; out[2] = baseP[2]; }
              else if (axis === 'y') { out[0] = baseP[0]; out[2] = baseP[2]; }
              else if (axis === 'z') { out[0] = baseP[0]; out[1] = baseP[1]; }
              else out[1] = baseP[1];
              node.p = out;
              if (node === sunNode) applySun();
            } else if (effMode === 'rotate') {
              dragAxis = axis || 'y';
              const idx = dragAxis === 'x' ? 0 : dragAxis === 'y' ? 1 : 2;
              let deg = startR[idx] + (dx - dy) * 0.5;
              if (snap) deg = Math.round(deg / state.snap.rot) * state.snap.rot;
              const r = startR.slice();
              r[idx] = Math.round(deg * 10) / 10;
              node.r = r;
            } else {
              dragAxis = axis;
              const f = Math.max(0.02, 1 + (dx - dy) * 0.006);
              const s = startS.slice();
              const apply = (i) => {
                let v = startS[i] * f;
                if (snap) v = Math.max(state.snap.scale, Math.round(v / state.snap.scale) * state.snap.scale);
                s[i] = Math.round(v * 1000) / 1000;
              };
              if (!axis) { apply(0); apply(1); apply(2); }
              else apply(axis === 'x' ? 0 : axis === 'y' ? 1 : 2);
              node.s = s;
            }
            hoverHint = fmtNode(node, effMode);
            syncBar();
            invalidate();
          },
          onEnd(e, moved) {
            dragAxis = null;
            hoverHint = '';
            invalidate(); syncBar();
            if (moved) { ctx.commit('Objekt bearbeitet'); ctx.refreshInspector(); }
          }
        });
      }

      function fmtNode(n, m) {
        const f = (v) => (Math.round(v * 100) / 100).toFixed(2);
        if (m === 'rotate') return 'Drehung ' + n.r.map(f).join(' / ');
        if (m === 'scale') return 'Größe ' + n.s.map(f).join(' / ');
        return 'Position ' + n.p.map(f).join(' / ');
      }

      /** Zeigerposition auf Ebene (kein Achszwang) bzw. auf die Achsengerade */
      function project(e, ref, axis) {
        const r = canvas.getBoundingClientRect();
        const ray = GD.gl3d.ray(camera(), r.width, r.height, e.clientX - r.left, e.clientY - r.top);
        if (!axis) {
          // Blickt die Kamera fast waagerecht, ist die Bodenebene nicht greifbar
          if (Math.abs(ray.dir[1]) < 0.09) {
            const f = norm([ray.dir[0], 0, ray.dir[2]]);
            return rayPlane(ray.origin, ray.dir, ref, [-f[0], 0, -f[2]]);
          }
          return rayPlane(ray.origin, ray.dir, ref, [0, 1, 0]);
        }
        const dir = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
        return rayAxis(ray.origin, ray.dir, ref, dir);
      }

      function rayPlane(ro, rd, p0, n) {
        const den = n[0] * rd[0] + n[1] * rd[1] + n[2] * rd[2];
        if (Math.abs(den) < 1e-6) return null;
        const t = ((p0[0] - ro[0]) * n[0] + (p0[1] - ro[1]) * n[1] + (p0[2] - ro[2]) * n[2]) / den;
        if (t < 0) return null;
        return [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
      }

      function rayAxis(ro, rd, p0, v) {
        const w = [ro[0] - p0[0], ro[1] - p0[1], ro[2] - p0[2]];
        const a = dot(rd, rd), b = dot(rd, v), c = dot(v, v), d = dot(rd, w), e2 = dot(v, w);
        const den = a * c - b * b;
        if (Math.abs(den) < 1e-8) return null;
        const s = (a * e2 - b * d) / den;
        return [p0[0] + v[0] * s, p0[1] + v[1] * s, p0[2] + v[2] * s];
      }

      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

      function frame() {
        const f = GD.models.flatten(state);
        const b = GD.models.bounds(f.items);
        state.camera.target = b.center.slice();
        state.camera.dist = Math.max(1.5, b.radius * 2.9);
        invalidate(); ctx.changed();
      }

      /* ---------------------------------------------------- Bibliothek */

      async function saveModel() {
        let name = state.modelId ? null : prompt('Name des Modells:', suggestName());
        if (!state.modelId && !name) return;
        const model = GD.models.save(name, state, state.modelId);
        state.modelId = model.id;
        syncBar();
        ctx.commit('Modell gespeichert');
        ctx.refreshInspector();
        ctx.toast('„' + model.name + '" in der Bibliothek', 'ok');
      }

      function suggestName() {
        const t = ctx.win.get().title;
        return t && t !== '3D-Modell' ? t : 'Modell';
      }

      /* ------------------------------------------------------ Sichtbar */

      const io = new IntersectionObserver((entries) => {
        const vis = entries[entries.length - 1].isIntersecting;
        if (vis !== visible) { visible = vis; if (vis) invalidate(); }
      }, { threshold: 0 });
      io.observe(canvas);

      const ro = new ResizeObserver(() => invalidate());
      ro.observe(stage);

      const offTex = GD.gl3d.events.on('texture', () => invalidate());
      const offModels = GD.models.events.on('changed', () => { invalidate(); ctx.refreshInspector(); });
      const offView = GD.board.events.on('view', U.debounce(() => invalidate(), 140));

      invalidate();

      /* --------------------------------------------------- Schnittstelle */

      return {
        el: root,

        getState() {
          return {
            nodes: state.nodes, env: state.env, camera: state.camera,
            snap: state.snap, modelId: state.modelId, mode: mode
          };
        },

        setState(next) {
          const s = GD.models.normScene(next);
          state.nodes = s.nodes; state.env = s.env; state.camera = s.camera; state.snap = s.snap;
          state.modelId = next && typeof next.modelId === 'string' ? next.modelId : null;
          if (selId && selId !== '__sun' && !state.nodes.some((n) => n.id === selId)) selId = null;
          sunNode.p = state.env.sunPos.slice();
          syncBar(); invalidate();
        },

        onResize() { invalidate(); },
        onZoom() { invalidate(); },
        onSelect() { invalidate(); },

        destroy() { io.disconnect(); ro.disconnect(); offTex(); offModels(); offView(); },

        headerTools() {
          const b = U.el('button', { class: 'gd-win__btn', title: 'Alles einpassen (F)', text: '⛶' });
          b.addEventListener('click', frame);
          return [b];
        },

        onKey(ev) {
          const k = ev.key.toLowerCase();
          if ((ev.ctrlKey || ev.metaKey) && k === 'd') { if (selected()) { duplicate(); return true; } return false; }
          if (ev.key === 'Delete' || ev.key === 'Backspace') { if (selected()) { removeSelected(); return true; } return false; }
          if (ev.key === 'Escape') { if (selId) { selId = null; ctx.refreshInspector(); syncBar(); invalidate(); return true; } return false; }
          if (!ev.ctrlKey && !ev.altKey && !ev.metaKey && k === 'l') {
            selId = selId === '__sun' ? null : '__sun';
            ctx.refreshInspector(); syncBar(); invalidate();
            return true;
          }
          if (!ev.ctrlKey && !ev.altKey && !ev.metaKey) {
            if (k === 'g') { setMode('move'); return true; }
            if (k === 'r') { setMode('rotate'); return true; }
            if (k === 's') { setMode('scale'); return true; }
            if (k === 'f') { frame(); return true; }
          }
          return false;
        },

        inspector(host) { buildInspector(host); }
      };

      /* ------------------------------------------------------ Inspector */

      function buildInspector(host) {
        const F = GD.ui.fields;
        const n = selected();

        /* --- Objektliste --- */
        host.appendChild(F.title('Objekte (' + state.nodes.length + ')'));
        if (!state.nodes.length) host.appendChild(F.note('Noch leer — oben links eine Form hinzufügen.'));
        const list = U.el('div', { class: 'm3-list' });

        const sunRow = U.el('div', { class: 'm3-item' + (selId === '__sun' ? ' is-on' : '') }, [
          U.el('span', { class: 'm3-item__dot', style: { background: state.env.sunColor, borderRadius: '50%' } }),
          U.el('span', { class: 'm3-item__name', text: '☀  Sonne' })
        ]);
        sunRow.addEventListener('click', () => { selId = '__sun'; invalidate(); syncBar(); ctx.refreshInspector(); });
        list.appendChild(sunRow);

        for (const node of state.nodes) {
          const row = U.el('div', { class: 'm3-item' + (node.id === selId ? ' is-on' : '') });
          const icon = node.kind === 'light' ? '☀' : node.kind === 'ref' ? '⬢' : GD.geom3d.kind(node.kind).icon;
          const dot = U.el('span', {
            class: 'm3-item__dot',
            style: { background: node.kind === 'light' ? node.light.color : node.kind === 'ref' ? '#4fd1c5' : node.mat.color }
          });
          const name = U.el('span', { class: 'm3-item__name', text: icon + '  ' + node.name });
          const eye = U.el('button', { class: 'm3-item__btn', text: node.visible ? '👁' : '◌', title: 'Sichtbar' });
          eye.addEventListener('click', (e) => { e.stopPropagation(); node.visible = !node.visible; invalidate(); ctx.commit('Sichtbarkeit'); ctx.refreshInspector(); });
          const lock = U.el('button', { class: 'm3-item__btn', text: node.locked ? '🔒' : '🔓', title: 'Sperren' });
          lock.addEventListener('click', (e) => { e.stopPropagation(); node.locked = !node.locked; ctx.commit('Sperre'); ctx.refreshInspector(); });
          row.append(dot, name, eye, lock);
          row.addEventListener('click', () => { selId = node.id; invalidate(); syncBar(); ctx.refreshInspector(); });
          list.appendChild(row);
        }
        host.appendChild(list);

        /* --- Sonne --- */
        if (selId === '__sun') {
          const env = state.env;
          host.appendChild(F.title('Sonne'));
          host.appendChild(F.row('Position', F.vec3(env.sunPos, (i, v) => {
            env.sunPos[i] = v; GD.models.applySunPos(env); sunNode.p = env.sunPos.slice(); invalidate();
          }, { step: 0.5, onCommit: commitEdit })));

          const dist = Math.hypot(env.sunPos[0], env.sunPos[1], env.sunPos[2]) || 1;
          const azim = Math.atan2(env.sunPos[0], env.sunPos[2]) * 180 / Math.PI;
          const elev = Math.asin(Math.max(-1, Math.min(1, env.sunPos[1] / dist))) * 180 / Math.PI;
          const place = (a, e, d) => {
            const ar = a * Math.PI / 180, er = e * Math.PI / 180;
            env.sunPos = [
              Math.round(d * Math.cos(er) * Math.sin(ar) * 100) / 100,
              Math.round(d * Math.sin(er) * 100) / 100,
              Math.round(d * Math.cos(er) * Math.cos(ar) * 100) / 100
            ];
            GD.models.applySunPos(env);
            sunNode.p = env.sunPos.slice();
            invalidate();
          };
          host.appendChild(F.row('Richtung', F.range(Math.round(azim), -180, 180, 1,
            (v) => place(v, elev, dist), commitEdit, (v) => Math.round(v) + '°')));
          host.appendChild(F.row('Höhe', F.range(Math.round(elev), -20, 89, 1,
            (v) => place(azim, v, dist), commitEdit, (v) => Math.round(v) + '°')));
          host.appendChild(F.row('Abstand', F.range(Math.round(dist * 10) / 10, 2, 40, 0.5,
            (v) => place(azim, elev, v), commitEdit)));

          host.appendChild(F.row('Farbe', F.color(env.sunColor, (v) => { env.sunColor = v; invalidate(); }, commitEdit)));
          host.appendChild(F.row('Stärke', F.range(env.sunIntensity, 0, 3, 0.05, (v) => { env.sunIntensity = v; invalidate(); }, commitEdit)));
          host.appendChild(F.row('Schatten', F.chk(env.shadows, (v) => { env.shadows = v; invalidate(); commitEdit(); ctx.refreshInspector(); })));
          if (env.shadows) host.appendChild(F.row('Härte', F.range(env.shadowStrength, 0, 1, 0.05, (v) => { env.shadowStrength = v; invalidate(); }, commitEdit)));
          host.appendChild(F.note('Die Sonne lässt sich auch direkt im Bild ziehen — sie leuchtet immer zum Nullpunkt. Strg/Alt sperren die Achsen wie bei allen Objekten.'));
        }

        /* --- Ausgewähltes Objekt --- */
        if (n && selId !== '__sun') {
          host.appendChild(F.title(n.kind === 'light' ? 'Licht' : n.kind === 'ref' ? 'Modellverweis' : GD.geom3d.kind(n.kind).label));
          host.appendChild(F.row('Name', F.text(n.name, (v) => { n.name = v; },
            { onCommit: () => { ctx.commit('Umbenannt'); ctx.refreshInspector(); } })));

          host.appendChild(F.row('Position', F.vec3(n.p, (i, v) => { n.p[i] = v; invalidate(); }, { step: 0.1, onCommit: commitEdit })));
          if (n.kind !== 'light') {
            host.appendChild(F.row('Drehung', F.vec3(n.r, (i, v) => { n.r[i] = v; invalidate(); }, { step: 5, onCommit: commitEdit })));
            host.appendChild(F.row('Größe', F.vec3(n.s, (i, v) => { n.s[i] = Math.max(0.01, v); invalidate(); }, { step: 0.1, min: 0.01, onCommit: commitEdit })));
            host.appendChild(F.full(F.btn('Größe angleichen (Würfel)', () => {
              const m = (n.s[0] + n.s[1] + n.s[2]) / 3;
              n.s = [m, m, m]; invalidate(); commitEdit(); ctx.refreshInspector();
            })));
          }

          if (n.kind === 'light') {
            host.appendChild(F.row('Farbe', F.color(n.light.color, (v) => { n.light.color = v; invalidate(); }, commitEdit)));
            host.appendChild(F.row('Stärke', F.range(n.light.intensity, 0, 12, 0.1, (v) => { n.light.intensity = v; invalidate(); }, commitEdit)));
            host.appendChild(F.row('Reichweite', F.range(n.light.range, 0.5, 40, 0.5, (v) => { n.light.range = v; invalidate(); }, commitEdit)));
            host.appendChild(F.note('Punktlichter beleuchten ohne Schatten (schnell). Der Schattenwurf kommt von der Sonne weiter unten.'));
          } else if (n.kind === 'ref') {
            const models = GD.models.all().filter((m) => m.id !== state.modelId);
            host.appendChild(F.row('Modell', F.sel(n.modelId, models.map((m) => [m.id, m.name]), (v) => {
              n.modelId = v;
              const m = GD.models.get(v);
              if (m) n.name = m.name;
              invalidate(); ctx.commit('Modell gewechselt'); ctx.refreshInspector();
            })));
            host.appendChild(F.note('Der Verweis verhält sich wie eine einzige Form: bewegen, drehen, skalieren wirkt auf das ganze Modell. Änderungen am Original schlagen überall durch.'));
          } else {
            shapeSection(host, n, F);
            materialSection(host, n, F);
          }

          host.appendChild(F.full(F.grid(2, [
            F.btn('Duplizieren', duplicate),
            F.btn('Löschen', removeSelected, 'btn--danger')
          ])));
        }

        /* --- Umgebung --- */
        host.appendChild(F.title('Licht & Umgebung'));
        const env = state.env;
        host.appendChild(F.row('Hintergrund', F.color(env.background === 'transparent' ? '#12151c' : env.background, (v) => { env.background = v; invalidate(); }, commitEdit)));
        host.appendChild(F.row('Umgebung', F.range(env.ambient, 0, 1.5, 0.02, (v) => { env.ambient = v; invalidate(); }, commitEdit)));
        host.appendChild(F.row('Umgeb.farbe', F.color(env.ambientColor, (v) => { env.ambientColor = v; invalidate(); }, commitEdit)));
        if (selId !== '__sun') {
          host.appendChild(F.full(F.btn('☀  Sonne auswählen und bewegen', () => {
            selId = '__sun'; invalidate(); syncBar(); ctx.refreshInspector();
          })));
        }
        host.appendChild(F.row('Boden', F.chk(env.floor, (v) => { env.floor = v; invalidate(); commitEdit(); ctx.refreshInspector(); })));
        if (env.floor) {
          host.appendChild(F.row('Bodenfarbe', F.color(env.floorColor, (v) => { env.floorColor = v; invalidate(); }, commitEdit)));
          host.appendChild(F.row('Rasterweite', F.range(env.gridSize, 0.1, 5, 0.1, (v) => { env.gridSize = v; invalidate(); }, commitEdit)));
        }

        /* --- Einrasten --- */
        host.appendChild(F.title('Einrasten'));
        host.appendChild(F.row('Aktiv', F.chk(state.snap.on, (v) => { state.snap.on = v; syncBar(); commitEdit(); })));
        host.appendChild(F.row('Abstand', F.num(state.snap.step, (v) => { state.snap.step = Math.max(0.01, v); syncBar(); }, { step: 0.05, min: 0.01, onCommit: commitEdit })));
        host.appendChild(F.row('Winkel', F.num(state.snap.rot, (v) => { state.snap.rot = Math.max(1, v); }, { step: 5, min: 1, onCommit: commitEdit })));
        host.appendChild(F.row('Größe', F.num(state.snap.scale, (v) => { state.snap.scale = Math.max(0.01, v); }, { step: 0.05, min: 0.01, onCommit: commitEdit })));
        host.appendChild(F.note('Umschalt beim Ziehen schaltet das Einrasten kurzzeitig aus.'));

        /* --- Bibliothek --- */
        librarySection(host, F);

        const st = GD.geom3d.stats();
        let tris = 0;
        for (const it of flat.items) tris += it.mesh.triangles;
        host.appendChild(F.note('Szene: ' + flat.items.length + ' Formen · ' + tris.toLocaleString('de-DE') + ' Dreiecke · Netz-Cache: ' + st.meshes));
      }

      function commitEdit() { ctx.commit('3D bearbeitet'); }

      function shapeSection(host, n, F) {
        host.appendChild(F.title('Form'));
        const kind = GD.geom3d.kind(n.kind);
        host.appendChild(F.row('Typ', F.sel(n.kind, GD.geom3d.KINDS.map((k) => [k.id, k.label]), (v) => {
          n.kind = v;
          n.params = Object.assign(GD.geom3d.defaults(v), { round: n.params ? n.params.round : 0.06 });
          invalidate(); ctx.commit('Form gewechselt'); ctx.refreshInspector();
        })));

        if (kind.round) {
          host.appendChild(F.row('Kanten rund', F.range(n.params.round || 0, 0, n.kind === 'pyramid' || n.kind === 'cone' ? 0.33 : 0.5, 0.01,
            (v) => { n.params.round = v; invalidate(); }, commitEdit)));
          host.appendChild(F.row('Feinheit', F.range(n.params.seg || 4, 1, 10, 1, (v) => { n.params.seg = Math.round(v); invalidate(); }, commitEdit)));
        }
        if (n.kind === 'cylinder' || n.kind === 'cone' || n.kind === 'sphere' || n.kind === 'torus') {
          host.appendChild(F.row('Segmente', F.range(n.params.sides || 32, 3, 64, 1, (v) => { n.params.sides = Math.round(v); invalidate(); }, commitEdit)));
        }
        if (n.kind === 'sphere' || n.kind === 'torus') {
          host.appendChild(F.row('Ringe', F.range(n.params.rings || 16, 3, 48, 1, (v) => { n.params.rings = Math.round(v); invalidate(); }, commitEdit)));
        }
        if (n.kind === 'torus') {
          host.appendChild(F.row('Dicke', F.range(n.params.tube || 0.34, 0.03, 0.9, 0.01, (v) => { n.params.tube = v; invalidate(); }, commitEdit)));
        }
        if (n.kind === 'plane') {
          host.appendChild(F.row('Stärke', F.range(n.params.thin || 0.02, 0.002, 0.4, 0.002, (v) => { n.params.thin = v; invalidate(); }, commitEdit)));
        }
      }

      function materialSection(host, n, F) {
        const m = n.mat;
        host.appendChild(F.title('Material'));

        const sw = U.el('div', { class: 'swatches' });
        for (const c of PRESET_COLORS) {
          const b = U.el('button', { class: 'swatch' + (c.toLowerCase() === String(m.color).toLowerCase() ? ' is-on' : ''), style: { background: c } });
          b.addEventListener('click', () => { m.color = c; invalidate(); commitEdit(); ctx.refreshInspector(); });
          sw.appendChild(b);
        }
        host.appendChild(sw);
        host.appendChild(F.row('Farbe', F.color(m.color, (v) => { m.color = v; invalidate(); }, commitEdit)));
        host.appendChild(F.row('Rauheit', F.range(m.rough, 0, 1, 0.02, (v) => { m.rough = v; invalidate(); }, commitEdit)));
        host.appendChild(F.row('Metallisch', F.range(m.metal, 0, 1, 0.02, (v) => { m.metal = v; invalidate(); }, commitEdit)));
        host.appendChild(F.row('Deckkraft', F.range(m.opacity, 0.05, 1, 0.01, (v) => { m.opacity = v; invalidate(); }, commitEdit)));

        host.appendChild(F.title('Leuchten'));
        host.appendChild(F.row('Farbe', F.color(m.emissive, (v) => { m.emissive = v; invalidate(); }, commitEdit)));
        host.appendChild(F.row('Stärke', F.range(m.emissiveStrength, 0, 3, 0.05, (v) => { m.emissiveStrength = v; invalidate(); }, commitEdit)));
        host.appendChild(F.note('Ein leuchtendes Material strahlt selbst. Für echten Lichtwurf zusätzlich ein Licht-Objekt daneben setzen.'));

        host.appendChild(F.title('Textur'));
        if (m.texture) {
          const url = JSON.stringify(GD.depot.aufloesen(m.texture) || '').slice(1, -1);
          const tile = m.texMode === 'uv'
            ? Math.max(8, 64 / Math.max(0.2, m.uvScale[0]))
            : Math.max(8, 46 / Math.max(0.05, m.texSize));
          host.appendChild(F.full(U.el('div', {
            class: 'm3-texprev',
            title: 'Vorschau der Kachelung',
            style: { backgroundImage: 'url(' + url + ')', backgroundSize: tile + 'px ' + tile + 'px' }
          })));

          host.appendChild(F.row('Projektion', F.sel(m.texMode, [
            ['uv', 'Netz-UV (folgt der Form)'],
            ['box', 'Box – dreiachsig'],
            ['planar', 'Ebene von oben']
          ], (v) => { m.texMode = v; invalidate(); commitEdit(); ctx.refreshInspector(); })));

          if (m.texMode === 'uv') {
            host.appendChild(F.row('Wiederholung', F.grid(2, [
              F.num(m.uvScale[0], (v) => { m.uvScale[0] = Math.max(0.05, v); invalidate(); }, { step: 0.5, min: 0.05, onCommit: () => { commitEdit(); ctx.refreshInspector(); } }),
              F.num(m.uvScale[1], (v) => { m.uvScale[1] = Math.max(0.05, v); invalidate(); }, { step: 0.5, min: 0.05, onCommit: () => { commitEdit(); ctx.refreshInspector(); } })
            ])));
            host.appendChild(F.full(F.grid(4, [1, 2, 4, 8].map((k) =>
              F.btn(k + '×', () => {
                m.uvScale = [k, k]; invalidate(); commitEdit(); ctx.refreshInspector();
              }, m.uvScale[0] === k && m.uvScale[1] === k ? 'is-on' : '')))));
            host.appendChild(F.row('Drehung', F.range(m.uvRot || 0, 0, 360, 5,
              (v) => { m.uvRot = v; invalidate(); }, commitEdit, (v) => Math.round(v) + '°')));
          } else {
            host.appendChild(F.row('Kachelgröße', F.range(m.texSize, 0.05, 8, 0.05,
              (v) => { m.texSize = v; invalidate(); }, () => { commitEdit(); ctx.refreshInspector(); })));
            host.appendChild(F.note(m.texMode === 'box'
              ? 'Die Kachel ist ' + (Math.round(m.texSize * 100) / 100) + ' Einheiten groß und bleibt es auch beim Strecken des Objekts — ideal für sich wiederholende Muster.'
              : 'Von oben projiziert: gut für Böden und Landschaften.'));
          }

          host.appendChild(F.row('Versatz', F.grid(2, [
            F.num(m.uvOffset[0], (v) => { m.uvOffset[0] = v; invalidate(); }, { step: 0.05, onCommit: commitEdit }),
            F.num(m.uvOffset[1], (v) => { m.uvOffset[1] = v; invalidate(); }, { step: 0.05, onCommit: commitEdit })
          ])));
          host.appendChild(F.row('Deckkraft', F.range(m.texStrength === undefined ? 1 : m.texStrength, 0, 1, 0.02,
            (v) => { m.texStrength = v; invalidate(); }, commitEdit)));

          host.appendChild(F.full(F.grid(2, [
            F.btn('Bild ersetzen…', async () => {
              const files = await U.pickFile('image/*');
              if (!files.length) return;
              if (files[0].size > 8 * 1024 * 1024) { ctx.toast('Textur größer als 8 MB', 'err'); return; }
              m.texture = await GD.depot.ausDatei(files[0]);
              invalidate(); commitEdit(); ctx.refreshInspector();
            }),
            F.btn('Entfernen', () => { m.texture = null; invalidate(); commitEdit(); ctx.refreshInspector(); }, 'btn--danger')
          ])));
        } else {
          host.appendChild(F.full(F.btn('Bild wählen…', async () => {
            const files = await U.pickFile('image/*');
            if (!files.length) return;
            if (files[0].size > 8 * 1024 * 1024) { ctx.toast('Textur größer als 8 MB', 'err'); return; }
            m.texture = await GD.depot.ausDatei(files[0]);
            invalidate(); commitEdit(); ctx.refreshInspector();
          })));
          host.appendChild(F.full(F.grid(3, PATTERNS.map((p) =>
            F.btn(p.label, () => {
              m.texture = pattern(p.id, m.color);
              // Muster sind zum Kacheln gedacht: gleich dreiachsig projizieren
              m.texMode = 'box';
              m.texSize = 0.5;
              m.uvOffset = [0, 0];
              invalidate(); commitEdit(); ctx.refreshInspector();
            })))));
          host.appendChild(F.note('Eigene Bilder liegen zunächst auf den Netzkoordinaten; für sich wiederholende Muster danach auf „Box" umstellen.'));
        }

        host.appendChild(F.row('Wirft Schatten', F.chk(!m.noShadow, (v) => { m.noShadow = !v; invalidate(); commitEdit(); })));
      }

      function librarySection(host, F) {
        host.appendChild(F.title('Modell-Bibliothek'));
        host.appendChild(F.full(F.grid(state.modelId ? 2 : 1, [
          F.btn(state.modelId ? 'Aktualisieren' : 'Als Modell speichern', saveModel),
          state.modelId ? F.btn('Verknüpfung lösen', () => {
            state.modelId = null; syncBar(); ctx.commit('Verknüpfung gelöst'); ctx.refreshInspector();
          }) : null
        ].filter(Boolean))));

        const models = GD.models.all();
        if (!models.length) { host.appendChild(F.note('Noch keine Modelle gespeichert.')); return; }

        for (const m of models) {
          const row = U.el('div', { class: 'm3-model' + (m.id === state.modelId ? ' is-on' : '') });
          row.appendChild(U.el('div', { class: 'm3-model__name', text: m.name }));
          const btns = U.el('div', { class: 'm3-model__btns' });
          btns.appendChild(mini('＋', 'Als Form einfügen', () => {
            if (m.id === state.modelId) { ctx.toast('Ein Modell kann sich nicht selbst enthalten', 'err'); return; }
            const n = GD.models.defaultNode('ref');
            n.modelId = m.id; n.name = m.name;
            state.nodes.push(n); selId = n.id;
            invalidate(); ctx.commit('Modell eingefügt'); ctx.refreshInspector();
          }));
          btns.appendChild(mini('▣', 'Als Kachel aufs Board', () => {
            const w = ctx.win.get();
            GD.windows.add('modelview', w.x + w.w + 60 + 170, w.y + 130, { title: m.name, state: { modelId: m.id, spin: true } });
          }));
          btns.appendChild(mini('✎', 'Hier öffnen', async () => {
            const ok = await GD.ui.confirm('Modell öffnen?', 'Der Inhalt dieses Fensters wird durch „' + m.name + '" ersetzt.', 'Öffnen');
            if (!ok) return;
            const s = GD.models.normScene(U.clone(m.scene));
            state.nodes = s.nodes; state.env = s.env; state.snap = s.snap;
            state.modelId = m.id;
            selId = null;
            ctx.win.setTitle(m.name);
            frame(); syncBar(); ctx.commit('Modell geöffnet'); ctx.refreshInspector();
          }));
          btns.appendChild(mini('🗑', 'Löschen', async () => {
            const used = GD.models.usage(m.id);
            const ok = await GD.ui.confirm('Modell löschen?',
              used ? '„' + m.name + '" wird ' + used + '× verwendet. Diese Stellen bleiben dann leer.' : '„' + m.name + '" wird aus der Bibliothek entfernt.',
              'Löschen');
            if (!ok) return;
            if (state.modelId === m.id) state.modelId = null;
            GD.models.remove(m.id);
            ctx.commit('Modell gelöscht'); ctx.refreshInspector();
          }));
          row.appendChild(btns);
          host.appendChild(row);
        }

        function mini(icon, tip, fn) {
          const b = U.el('button', { class: 'm3-model__btn', text: icon, title: tip });
          b.addEventListener('click', fn);
          return b;
        }
      }
    }
  });

  /* ------------------------------------------------ Prozedurtexturen */

  const PATTERNS = [
    { id: 'checker', label: 'Kachel' },
    { id: 'grid', label: 'Raster' },
    { id: 'stripes', label: 'Streifen' },
    { id: 'noise', label: 'Rauschen' },
    { id: 'bricks', label: 'Ziegel' },
    { id: 'dots', label: 'Punkte' }
  ];

  const patternCache = new Map();

  function pattern(id, tint) {
    const key = id + '|' + tint;
    if (patternCache.has(key)) return patternCache.get(key);
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const light = GD.util.shade(tint || '#ffffff', 0.45);
    const dark = GD.util.shade(tint || '#ffffff', -0.3);

    g.fillStyle = light; g.fillRect(0, 0, S, S);
    g.fillStyle = dark;
    if (id === 'checker') {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * S / 8, y * S / 8, S / 8, S / 8);
    } else if (id === 'grid') {
      g.strokeStyle = dark; g.lineWidth = 4;
      for (let i = 0; i <= 8; i++) {
        g.beginPath(); g.moveTo(i * S / 8, 0); g.lineTo(i * S / 8, S); g.stroke();
        g.beginPath(); g.moveTo(0, i * S / 8); g.lineTo(S, i * S / 8); g.stroke();
      }
    } else if (id === 'stripes') {
      for (let i = 0; i < 8; i++) g.fillRect(0, i * S / 8, S, S / 16);
    } else if (id === 'noise') {
      const img = g.getImageData(0, 0, S, S);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 60;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
      }
      g.putImageData(img, 0, 0);
    } else if (id === 'bricks') {
      const bh = S / 8, bw = S / 4;
      g.fillStyle = dark;
      for (let y = 0; y < 8; y++) {
        const off = (y % 2) * bw / 2;
        for (let x = -1; x < 5; x++) g.fillRect(x * bw + off + 3, y * bh + 3, bw - 6, bh - 6);
      }
    } else if (id === 'dots') {
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
        g.beginPath(); g.arc((x + 0.5) * S / 6, (y + 0.5) * S / 6, S / 22, 0, Math.PI * 2); g.fill();
      }
    }
    const url = cv.toDataURL('image/png');
    patternCache.set(key, url);
    return url;
  }
})();
