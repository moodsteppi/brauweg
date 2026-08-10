/* GameDesk — Modul „3D-Ansicht": fertiges Modell als Kachel auf dem Board
 *
 * Ziehen dreht das Modell, Mausrad ändert den Abstand, der Schalter oben
 * schaltet eine langsame Kamerafahrt um das Objekt ein.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  GD.modules.register({
    id: 'modelview',
    label: '3D-Ansicht',
    icon: '◈',
    description: 'Gespeichertes Modell zeigen',
    accent: '#4fd1c5',
    defaultSize: { w: 340, h: 280 },
    defaultTitle: '3D-Ansicht',

    create(ctx) {
      const raw = ctx.state || {};
      const state = {
        modelId: typeof raw.modelId === 'string' ? raw.modelId : null,
        spin: raw.spin !== false,
        speed: Number.isFinite(raw.speed) ? raw.speed : 0.28,
        yaw: Number.isFinite(raw.yaw) ? raw.yaw : 0.7,
        pitch: Number.isFinite(raw.pitch) ? raw.pitch : 0.35,
        zoom: Number.isFinite(raw.zoom) ? raw.zoom : 1,
        background: typeof raw.background === 'string' ? raw.background : null,
        floor: raw.floor !== false,
        quality: raw.quality === 'high' ? 'high' : 'normal'
      };

      const canvas = U.el('canvas', { class: 'mv-view' });
      const c2d = canvas.getContext('2d');
      const empty = U.el('div', { class: 'mv-empty' });
      const spinBtn = U.el('button', { class: 'mv-spin', title: 'Kamerafahrt ein/aus' });
      const root = U.el('div', { class: 'mv-root' }, [canvas, spinBtn, empty]);

      spinBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        state.spin = !state.spin;
        syncSpin();
        ctx.commit('Kamerafahrt');
        ctx.refreshInspector();
      });

      function syncSpin() {
        spinBtn.textContent = state.spin ? '⟳' : '⏸';
        spinBtn.classList.toggle('is-on', state.spin);
        updateAnimator();
      }

      /* ------------------------------------------------------- Rendern */

      let flat = null, bounds = null, cacheKey = '';
      let dirty = true, visible = true, pending = false;
      let stopAnim = null, lastFrame = 0;

      function model() { return GD.models.get(state.modelId); }

      function rebuild() {
        const m = model();
        empty.style.display = m ? 'none' : '';
        if (!m) {
          empty.innerHTML = '';
          const list = GD.models.all();
          empty.append(
            U.el('div', { class: 'mv-empty__icon', text: '◈' }),
            U.el('div', { text: list.length ? 'Modell auswählen' : 'Noch kein Modell gespeichert' })
          );
          if (list.length) {
            const sel = U.el('select', { class: 'fld', style: { maxWidth: '190px' } });
            sel.appendChild(U.el('option', { value: '', text: 'Modell wählen…' }));
            for (const x of list) sel.appendChild(U.el('option', { value: x.id, text: x.name }));
            sel.addEventListener('change', () => {
              if (!sel.value) return;
              state.modelId = sel.value;
              const mm = GD.models.get(sel.value);
              if (mm) ctx.win.setTitle(mm.name);
              rebuild(); invalidate(); ctx.commit('Modell gewählt'); ctx.refreshInspector();
            });
            empty.appendChild(sel);
          } else {
            empty.appendChild(U.el('div', { class: 'mv-empty__hint', text: 'Im Modul „3D-Modell" bauen und speichern.' }));
          }
          flat = null;
          return;
        }
        const key = m.id + '|' + m.updated;
        if (key !== cacheKey) {
          cacheKey = key;
          flat = GD.models.flatten(m.scene, { pickable: false, stack: [m.id] });
          bounds = GD.models.bounds(flat.items);
        }
      }

      function invalidate() { dirty = true; schedule(); }

      function schedule() {
        if (pending || !dirty || !visible) return;
        pending = true;
        U.nextFrame(() => { pending = false; paint(); });
      }

      function paint() {
        if (!GD.gl3d.available || !flat) return;
        const r = canvas.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        dirty = false;

        const m = model();
        const env = Object.assign({}, m.scene.env, {
          floor: state.floor && m.scene.env.floor,
          background: state.background || m.scene.env.background
        });

        const dist = Math.max(1.2, bounds.radius * 3.1 / Math.max(0.2, state.zoom));
        const cam = {
          pos: GD.gl3d.orbitPos({ yaw: state.yaw, pitch: state.pitch, dist: dist, target: bounds.center }),
          target: bounds.center, fov: 40, near: 0.05, far: 400
        };

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cap = state.quality === 'high' ? 1400 : 900;
        let w = r.width * dpr, h = r.height * dpr;
        const k = Math.min(1, cap / Math.max(w, h));
        w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));

        GD.gl3d.render({
          target: c2d, width: w, height: h,
          items: flat.items, lights: flat.lights,
          env: env, camera: cam
        });
      }

      /* ------------------------------------------------ Kamerafahrt */

      function updateAnimator() {
        const want = state.spin && visible && !!flat;
        if (want && !stopAnim) {
          lastFrame = performance.now();
          stopAnim = GD.gl3d.addAnimator(() => {
            const now = performance.now();
            const dt = Math.min(0.1, (now - lastFrame) / 1000);
            if (now - lastFrame < 33) return;          // ~30 Bilder/s reichen für die Kachel
            lastFrame = now;
            state.yaw += state.speed * dt;
            if (state.yaw > Math.PI * 2) state.yaw -= Math.PI * 2;
            dirty = true;
            paint();
          });
        } else if (!want && stopAnim) {
          stopAnim(); stopAnim = null;
          saveSoon();
        }
      }
      const saveSoon = U.debounce(() => ctx.changed(), 900);

      /* ---------------------------------------------------- Interaktion */

      canvas.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        ctx.win.select();
        if (ev.button !== 0 || !flat) return;
        const y0 = state.yaw, p0 = state.pitch;
        const wasSpinning = state.spin;
        if (wasSpinning) { state.spin = false; syncSpin(); }
        U.drag(ev, {
          cursor: 'grabbing',
          onMove(dx, dy) {
            state.yaw = y0 - dx * 0.01;
            state.pitch = Math.max(-1.45, Math.min(1.45, p0 + dy * 0.01));
            invalidate();
          },
          onEnd(e, moved) {
            if (!moved && wasSpinning) { state.spin = true; syncSpin(); }
            else ctx.changed();
          }
        });
      });

      canvas.addEventListener('wheel', (ev) => {
        if (!GD.windows.selectionIds().includes(ctx.id)) return;
        ev.preventDefault(); ev.stopPropagation();
        state.zoom = Math.max(0.15, Math.min(6, state.zoom * Math.pow(0.999, ev.deltaY)));
        invalidate(); saveSoon();
      }, { passive: false });

      canvas.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        const m = model();
        if (!m) return;
        const w = ctx.win.get();
        GD.windows.add('model3d', w.x + w.w + 440, w.y + 260, {
          title: m.name, state: Object.assign(U.clone(m.scene), { modelId: m.id })
        });
        ctx.toast('„' + m.name + '" zum Bearbeiten geöffnet');
      });

      /* ---------------------------------------------------------- Leben */

      const io = new IntersectionObserver((e) => {
        const vis = e[e.length - 1].isIntersecting;
        if (vis === visible) return;
        visible = vis;
        updateAnimator();
        if (vis) invalidate();
      }, { threshold: 0 });
      io.observe(canvas);

      const ro = new ResizeObserver(() => invalidate());
      ro.observe(root);
      const offTex = GD.gl3d.events.on('texture', () => invalidate());
      const offModels = GD.models.events.on('changed', () => { rebuild(); invalidate(); ctx.refreshInspector(); });
      const offView = GD.board.events.on('view', U.debounce(() => invalidate(), 160));

      rebuild();
      syncSpin();
      invalidate();

      /* -------------------------------------------------- Schnittstelle */

      return {
        el: root,

        getState() { return U.clone(state); },

        setState(next) {
          if (!next) return;
          Object.assign(state, next);
          cacheKey = '';
          rebuild(); syncSpin(); invalidate();
        },

        onResize() { invalidate(); },
        onZoom() { invalidate(); },

        destroy() {
          io.disconnect(); ro.disconnect(); offTex(); offModels(); offView();
          if (stopAnim) stopAnim();
        },

        headerTools() {
          const b = U.el('button', { class: 'gd-win__btn', title: 'Modell bearbeiten', text: '✎' });
          b.addEventListener('click', () => canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: false })));
          return [b];
        },

        inspector(host) {
          const F = GD.ui.fields;
          host.appendChild(F.title('3D-Ansicht'));
          const list = GD.models.all();
          host.appendChild(F.row('Modell', F.sel(state.modelId || '', [['', '— keins —']].concat(list.map((m) => [m.id, m.name])), (v) => {
            state.modelId = v || null;
            const m = GD.models.get(v);
            if (m) ctx.win.setTitle(m.name);
            cacheKey = ''; rebuild(); invalidate(); ctx.commit('Modell gewählt'); ctx.refreshInspector();
          })));

          host.appendChild(F.row('Kamerafahrt', F.chk(state.spin, (v) => { state.spin = v; syncSpin(); ctx.commit('Kamerafahrt'); })));
          host.appendChild(F.row('Tempo', F.range(state.speed, 0.02, 1.5, 0.02, (v) => { state.speed = v; }, () => ctx.commit('Tempo'))));
          host.appendChild(F.row('Abstand', F.range(state.zoom, 0.15, 4, 0.05, (v) => { state.zoom = v; invalidate(); }, () => ctx.commit('Abstand'))));
          host.appendChild(F.row('Neigung', F.range(state.pitch, -1.4, 1.4, 0.02, (v) => { state.pitch = v; invalidate(); }, () => ctx.commit('Neigung'))));
          host.appendChild(F.row('Boden', F.chk(state.floor, (v) => { state.floor = v; invalidate(); ctx.commit('Boden'); })));
          host.appendChild(F.row('Hintergrund', F.color(state.background || (model() ? model().scene.env.background : '#12151c'), (v) => {
            state.background = v; invalidate();
          }, () => ctx.commit('Hintergrund'))));
          host.appendChild(F.row('Auflösung', F.sel(state.quality, [['normal', 'normal (schnell)'], ['high', 'hoch']], (v) => {
            state.quality = v; invalidate(); ctx.commit('Auflösung');
          })));

          if (state.background) {
            host.appendChild(F.full(F.btn('Hintergrund vom Modell', () => {
              state.background = null; invalidate(); ctx.commit('Hintergrund'); ctx.refreshInspector();
            })));
          }

          const m = model();
          if (m && flat) {
            let tris = 0;
            for (const it of flat.items) tris += it.mesh.triangles;
            host.appendChild(F.note(m.name + ' · ' + flat.items.length + ' Formen · ' + tris.toLocaleString('de-DE') + ' Dreiecke'));
            host.appendChild(F.full(F.btn('Zum Bearbeiten öffnen', () => canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: false })))));
          }
        }
      };
    }
  });
})();
