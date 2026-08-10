/* GameDesk — Übersichtskarte */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  let el = null, canvas = null, ctx = null, layout = null;

  const minimap = {
    init() {
      el = document.getElementById('minimap');
      canvas = document.getElementById('minimap-canvas');
      ctx = canvas.getContext('2d');

      GD.board.events.on('view', minimap.draw);
      GD.windows.events.on('changed', minimap.draw);
      GD.windows.events.on('selection', minimap.draw);

      canvas.addEventListener('pointerdown', (ev) => {
        if (!layout) return;
        const jump = (e) => {
          const r = canvas.getBoundingClientRect();
          const wx = (e.clientX - r.left - layout.ox) / layout.k;
          const wy = (e.clientY - r.top - layout.oy) / layout.k;
          GD.board.centerOn(wx, wy);
        };
        jump(ev);
        U.drag(ev, { onMove(dx, dy, e) { jump(e); } });
      });

      new ResizeObserver(minimap.draw).observe(el);
      minimap.draw();
    },

    setVisible(on) {
      el.classList.toggle('is-hidden', !on);
      if (on) minimap.draw();
    },

    draw: U.raf(function () {
      if (!ctx || el.classList.contains('is-hidden')) return;
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height));
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr; canvas.height = H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const css = getComputedStyle(document.documentElement);
      const cLine = css.getPropertyValue('--line').trim() || '#333';
      const cAccent = css.getPropertyValue('--accent').trim() || '#6ea8fe';
      const cDim = css.getPropertyValue('--text-faint').trim() || '#777';

      const wins = GD.store.doc.windows;
      const view = GD.board.viewRect();
      let b = GD.board.contentBounds();
      if (!b) b = { x: view.x, y: view.y, w: view.w, h: view.h };
      // Sichtbereich mit einschließen, damit man sich nicht "verläuft"
      const x1 = Math.min(b.x, view.x), y1 = Math.min(b.y, view.y);
      const x2 = Math.max(b.x + b.w, view.x + view.w), y2 = Math.max(b.y + b.h, view.y + view.h);
      const pad = 24;
      const k = Math.min((W - pad) / Math.max(x2 - x1, 1), (H - pad) / Math.max(y2 - y1, 1));
      const ox = (W - (x2 - x1) * k) / 2 - x1 * k;
      const oy = (H - (y2 - y1) * k) / 2 - y1 * k;
      layout = { k: k, ox: ox, oy: oy };

      const sel = new Set(GD.windows.selectionIds());

      ctx.lineWidth = 1;
      ctx.strokeStyle = cDim;
      ctx.globalAlpha = 0.55;
      for (const c of GD.store.doc.connections) {
        const a = GD.store.getWindow(c.from.win), z = GD.store.getWindow(c.to.win);
        if (!a || !z) continue;
        ctx.beginPath();
        ctx.moveTo(ox + (a.x + a.w / 2) * k, oy + (a.y + a.h / 2) * k);
        ctx.lineTo(ox + (z.x + z.w / 2) * k, oy + (z.y + z.h / 2) * k);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const w of wins) {
        const h = w.collapsed ? GD.windows.BAR_H : w.h;
        const x = ox + w.x * k, y = oy + w.y * k;
        const ww = Math.max(2, w.w * k), hh = Math.max(2, h * k);
        ctx.fillStyle = sel.has(w.id) ? cAccent : cLine;
        ctx.globalAlpha = sel.has(w.id) ? 0.9 : 0.75;
        ctx.fillRect(x, y, ww, hh);
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = cAccent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + view.x * k, oy + view.y * k, view.w * k, view.h * k);
    })
  };

  GD.minimap = minimap;
})();
