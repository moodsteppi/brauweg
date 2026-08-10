/* GameDesk — Modul „Wireframe": Seitenlayouts skizzieren
 *
 * Rechtecke, Kreise, Linien, Text, Bilder; Füllung/Verlauf, Kontur, Radius,
 * Schatten, Weichzeichner, Textausrichtung, Führungslinien mit Einrasten,
 * Ausrichten/Verteilen, Ebenen, SVG-/PNG-Export.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const FONTS = [
    ['ui', 'Sans', 'Inter, "Segoe UI", system-ui, sans-serif'],
    ['serif', 'Serif', 'Georgia, "Times New Roman", serif'],
    ['mono', 'Mono', 'Consolas, "Cascadia Mono", monospace']
  ];
  const fontStack = (key) => (FONTS.find((f) => f[0] === key) || FONTS[0])[2];

  const PRESETS = {
    'A4 quer': { w: 1123, h: 794 },
    'Desktop 1280': { w: 1280, h: 800 },
    'Full HD': { w: 1920, h: 1080 },
    'Tablet': { w: 834, h: 1112 },
    'Handy': { w: 390, h: 844 },
    'Quadrat': { w: 1000, h: 1000 }
  };

  const BLOCKS = {
    'Button': (x, y) => [mk('rect', { x: x, y: y, w: 160, h: 44, radius: 10, fill: '#2f6fe4', strokeOn: false, text: 'Weiter', font: { color: '#ffffff', size: 15, weight: 600 } })],
    'Eingabefeld': (x, y) => [mk('rect', { x: x, y: y, w: 260, h: 42, radius: 8, fill: '#ffffff', stroke: '#b9c2d0', text: 'Eingabe…', font: { color: '#8a93a5', size: 14, align: 'left' }, pad: 12 })],
    'Karte': (x, y) => [
      mk('rect', { x: x, y: y, w: 260, h: 190, radius: 12, fill: '#ffffff', stroke: '#e2e6ee', shadow: { on: true, x: 0, y: 6, blur: 18, color: '#0f172a26' } }),
      mk('rect', { x: x + 14, y: y + 14, w: 232, h: 104, radius: 8, fill: '#dfe5ee', strokeOn: false }),
      mk('text', { x: x + 14, y: y + 128, w: 232, h: 24, text: 'Titel der Karte', font: { size: 16, weight: 650, align: 'left', valign: 'top' }, pad: 0 }),
      mk('text', { x: x + 14, y: y + 152, w: 232, h: 26, text: 'Kurzer Beschreibungstext.', font: { size: 12, color: '#6b7488', align: 'left', valign: 'top' }, pad: 0 })
    ],
    'Kopfzeile': (x, y) => [
      mk('rect', { x: x, y: y, w: 720, h: 64, radius: 0, fill: '#ffffff', stroke: '#e2e6ee' }),
      mk('rect', { x: x + 20, y: y + 20, w: 24, h: 24, radius: 6, fill: '#2f6fe4', strokeOn: false }),
      mk('text', { x: x + 54, y: y + 20, w: 200, h: 24, text: 'Spieltitel', font: { size: 16, weight: 700, align: 'left' }, pad: 0 }),
      mk('text', { x: x + 470, y: y + 20, w: 230, h: 24, text: 'Start   Optionen   Beenden', font: { size: 13, color: '#5a6479', align: 'right' }, pad: 0 })
    ],
    'Bildplatzhalter': (x, y) => [mk('rect', { x: x, y: y, w: 260, h: 170, radius: 8, fill: '#e9edf5', stroke: '#c4ccda', dash: 'dashed', text: '🖼  Bild', font: { color: '#8a93a5', size: 14 } })],
    'Überschrift': (x, y) => [mk('text', { x: x, y: y, w: 420, h: 44, text: 'Überschrift', font: { size: 32, weight: 700, align: 'left' }, pad: 0 })],
    'Textblock': (x, y) => [mk('text', { x: x, y: y, w: 420, h: 96, text: 'Beschreibender Fließtext, der über mehrere Zeilen läuft und automatisch umbricht.', font: { size: 14, align: 'left', valign: 'top', color: '#5a6479' }, pad: 0 })],
    'Listenzeile': (x, y) => [
      mk('rect', { x: x, y: y, w: 360, h: 52, radius: 8, fill: '#ffffff', stroke: '#e2e6ee' }),
      mk('ellipse', { x: x + 12, y: y + 12, w: 28, h: 28, fill: '#dfe5ee', strokeOn: false }),
      mk('text', { x: x + 52, y: y + 14, w: 240, h: 24, text: 'Eintrag', font: { size: 14, align: 'left' }, pad: 0 })
    ]
  };

  function mk(type, over) {
    const base = {
      id: U.uid('sh'), type: type,
      x: 0, y: 0, w: 160, h: 100, rot: 0,
      fill: '#e9edf5', fillOn: true, grad: null,
      stroke: '#94a3b8', strokeW: 1, strokeOn: true, dash: 'solid',
      radius: type === 'rect' ? 8 : 0,
      opacity: 1, blur: 0,
      shadow: { on: false, x: 0, y: 4, blur: 12, color: '#0f172a40' },
      text: '', pad: 8, src: null, locked: false,
      font: { size: 14, family: 'ui', weight: 500, italic: false, underline: false, color: '#1b2029', align: 'center', valign: 'middle', lh: 1.35 }
    };
    if (type === 'text') { base.fillOn = false; base.strokeOn = false; base.font.align = 'left'; }
    if (type === 'line') { base.fillOn = false; base.strokeW = 2; base.h = 0; }
    const s = Object.assign(base, over || {});
    if (over && over.font) s.font = Object.assign({}, base.font, over.font);
    if (over && over.shadow) s.shadow = Object.assign({}, base.shadow, over.shadow);
    s.id = U.uid('sh');
    return s;
  }

  GD.modules.register({
    id: 'wireframe',
    label: 'Wireframe',
    icon: '▧',
    description: 'Seiten grob layouten',
    accent: '#6ea8fe',
    defaultSize: { w: 760, h: 520 },
    defaultTitle: 'Wireframe',

    create(ctx) {
      const state = normalize(ctx.state);
      let tool = 'select';
      let sel = new Set();
      let editing = null;

      /* ----------------------------------------------------------- DOM */

      const toolbar = U.el('div', { class: 'wf-bar' });
      const rulerH = U.svg('svg', { class: 'wf-ruler wf-ruler--h' });
      const rulerV = U.svg('svg', { class: 'wf-ruler wf-ruler--v' });
      const corner = U.el('div', { class: 'wf-corner', title: 'Führungslinien: aus dem Lineal ziehen' });
      const svg = U.svg('svg', { class: 'wf-svg', preserveAspectRatio: 'xMidYMid meet' });
      const stage = U.el('div', { class: 'wf-stage' }, [svg]);
      const grid = U.el('div', { class: 'wf-grid' }, [corner, rulerH, rulerV, stage]);
      const root = U.el('div', { class: 'wf-root' }, [toolbar, grid]);

      const defs = U.svg('defs');
      const gBg = U.svg('g');
      const gShapes = U.svg('g');
      const gGuides = U.svg('g', { class: 'wf-guides' });
      const gSmart = U.svg('g', { class: 'wf-smart' });
      const gOverlay = U.svg('g', { class: 'wf-overlay' });
      svg.append(defs, gBg, gShapes, gGuides, gSmart, gOverlay);

      /* ------------------------------------------------------ Werkzeuge */

      const TOOLS = [
        ['select', '➤', 'Auswählen (V)'],
        ['rect', '▭', 'Rechteck (R)'],
        ['ellipse', '◯', 'Ellipse (O)'],
        ['line', '╱', 'Linie (L)'],
        ['text', 'T', 'Text (T)'],
        ['image', '▣', 'Bild (I)']
      ];
      const toolBtns = {};
      for (const [id, icon, tip] of TOOLS) {
        const b = U.el('button', { class: 'wf-tool', text: icon, title: tip });
        b.addEventListener('click', () => setTool(id));
        toolBtns[id] = b;
        toolbar.appendChild(b);
      }
      toolbar.appendChild(U.el('span', { class: 'wf-sep' }));

      const blockSel = U.el('select', { class: 'wf-select', title: 'Fertige Bausteine einfügen' });
      blockSel.appendChild(U.el('option', { value: '', text: 'Baustein…' }));
      for (const name of Object.keys(BLOCKS)) blockSel.appendChild(U.el('option', { value: name, text: name }));
      blockSel.addEventListener('change', () => {
        const key = blockSel.value;
        blockSel.value = '';
        if (!key) return;
        const c = { x: state.canvas.w / 2 - 130, y: state.canvas.h / 2 - 60 };
        const made = BLOCKS[key](Math.round(c.x), Math.round(c.y));
        state.shapes.push.apply(state.shapes, made);
        sel = new Set(made.map((s) => s.id));
        render(); commit('Baustein „' + key + '" eingefügt');
      });
      toolbar.appendChild(blockSel);
      toolbar.appendChild(U.el('span', { class: 'wf-sep' }));

      toolbar.appendChild(tbBtn('⧉', 'Duplizieren (Strg+D)', duplicateSel));
      toolbar.appendChild(tbBtn('⬆', 'Eine Ebene nach vorn (])', () => reorder(1)));
      toolbar.appendChild(tbBtn('⬇', 'Eine Ebene nach hinten ([)', () => reorder(-1)));
      toolbar.appendChild(tbBtn('🗑', 'Löschen (Entf)', deleteSel));
      toolbar.appendChild(U.el('span', { class: 'wf-sep' }));
      const snapBtn = tbBtn('⊹', 'Einrasten an Führungslinien und Objekten', () => {
        state.grid.snap = !state.grid.snap;
        snapBtn.classList.toggle('is-on', state.grid.snap);
        ctx.changed();
      });
      snapBtn.classList.toggle('is-on', state.grid.snap);
      toolbar.appendChild(snapBtn);
      const gridBtn = tbBtn('▦', 'Raster anzeigen', () => {
        state.grid.show = !state.grid.show;
        gridBtn.classList.toggle('is-on', state.grid.show);
        render(); ctx.changed();
      });
      gridBtn.classList.toggle('is-on', state.grid.show);
      toolbar.appendChild(gridBtn);

      function tbBtn(icon, tip, fn) {
        const b = U.el('button', { class: 'wf-tool', text: icon, title: tip });
        b.addEventListener('click', fn);
        return b;
      }

      function setTool(id) {
        tool = id;
        for (const [k] of TOOLS) toolBtns[k].classList.toggle('is-on', k === id);
        stage.classList.toggle('is-draw', id !== 'select');
        if (id === 'image') { insertImage(); setTool('select'); }
      }
      setTool('select');

      /* -------------------------------------------------- Koordinaten */

      function toUser(clientX, clientY) {
        const m = svg.getScreenCTM();
        if (!m) return { x: 0, y: 0 };
        const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
      }
      function pxToUser() {
        const m = svg.getScreenCTM();
        return m && m.a ? 1 / m.a : 1;
      }

      /* ------------------------------------------------------- Rendern */

      function render() {
        svg.setAttribute('viewBox', '0 0 ' + state.canvas.w + ' ' + state.canvas.h);
        while (defs.firstChild) defs.removeChild(defs.firstChild);
        gBg.innerHTML = ''; gShapes.innerHTML = ''; gGuides.innerHTML = '';

        gBg.appendChild(U.svg('rect', {
          x: 0, y: 0, width: state.canvas.w, height: state.canvas.h,
          fill: state.canvas.bg, class: 'wf-artboard'
        }));

        if (state.grid.show) {
          const p = U.svg('pattern', {
            id: 'wfgrid', width: state.grid.size, height: state.grid.size, patternUnits: 'userSpaceOnUse'
          }, [U.svg('path', {
            d: 'M ' + state.grid.size + ' 0 L 0 0 0 ' + state.grid.size,
            fill: 'none', stroke: 'rgba(120,130,150,.22)', 'stroke-width': 1
          })]);
          defs.appendChild(p);
          gBg.appendChild(U.svg('rect', { x: 0, y: 0, width: state.canvas.w, height: state.canvas.h, fill: 'url(#wfgrid)' }));
        }

        for (const s of state.shapes) gShapes.appendChild(renderShape(s));

        const px = pxToUser();
        for (const gx of state.guides.v) {
          gGuides.appendChild(U.svg('line', {
            x1: gx, y1: 0, x2: gx, y2: state.canvas.h, class: 'wf-guide', dataset: { axis: 'v', pos: gx },
            'stroke-width': px * 1.2
          }));
          gGuides.appendChild(U.svg('line', {
            x1: gx, y1: 0, x2: gx, y2: state.canvas.h, class: 'wf-guide-hit', dataset: { axis: 'v', pos: gx },
            'stroke-width': px * 7
          }));
        }
        for (const gy of state.guides.h) {
          gGuides.appendChild(U.svg('line', {
            x1: 0, y1: gy, x2: state.canvas.w, y2: gy, class: 'wf-guide', dataset: { axis: 'h', pos: gy },
            'stroke-width': px * 1.2
          }));
          gGuides.appendChild(U.svg('line', {
            x1: 0, y1: gy, x2: state.canvas.w, y2: gy, class: 'wf-guide-hit', dataset: { axis: 'h', pos: gy },
            'stroke-width': px * 7
          }));
        }

        drawOverlay();
        drawRulers();
        // Pfeile, die an einzelnen Elementen hängen, wandern mit
        if (GD.connections) GD.connections.redraw();
      }

      function renderShape(s) {
        const g = U.svg('g', { class: 'wf-shape', dataset: { id: s.id } });
        if (s.rot) g.setAttribute('transform', 'rotate(' + s.rot + ' ' + (s.x + s.w / 2) + ' ' + (s.y + s.h / 2) + ')');
        if (s.opacity !== 1) g.setAttribute('opacity', s.opacity);

        const filters = [];
        if (s.shadow && s.shadow.on) {
          filters.push('drop-shadow(' + s.shadow.x + 'px ' + s.shadow.y + 'px ' + s.shadow.blur + 'px ' + s.shadow.color + ')');
        }
        if (s.blur) filters.push('blur(' + s.blur + 'px)');
        if (filters.length) g.style.filter = filters.join(' ');

        let fill = 'none';
        if (s.fillOn) {
          if (s.grad) {
            const id = 'grad_' + s.id;
            const a = (s.grad.angle || 90) * Math.PI / 180;
            defs.appendChild(U.svg('linearGradient', {
              id: id, x1: 0.5 - Math.cos(a) / 2, y1: 0.5 - Math.sin(a) / 2,
              x2: 0.5 + Math.cos(a) / 2, y2: 0.5 + Math.sin(a) / 2
            }, [
              U.svg('stop', { offset: '0%', 'stop-color': s.fill }),
              U.svg('stop', { offset: '100%', 'stop-color': s.grad.to })
            ]));
            fill = 'url(#' + id + ')';
          } else fill = s.fill;
        }

        const strokeAttrs = s.strokeOn ? {
          stroke: s.stroke, 'stroke-width': s.strokeW,
          'stroke-dasharray': s.dash === 'dashed' ? (s.strokeW * 4) + ' ' + (s.strokeW * 3)
            : s.dash === 'dotted' ? (s.strokeW * 0.1) + ' ' + (s.strokeW * 2.6) : null,
          'stroke-linecap': s.dash === 'dotted' ? 'round' : null
        } : { stroke: 'none' };

        if (s.type === 'rect' || s.type === 'text') {
          g.appendChild(U.svg('rect', Object.assign({
            x: s.x, y: s.y, width: Math.max(0, s.w), height: Math.max(0, s.h),
            rx: Math.min(s.radius, Math.min(s.w, s.h) / 2), ry: Math.min(s.radius, Math.min(s.w, s.h) / 2),
            fill: s.type === 'text' && !s.fillOn ? 'transparent' : fill
          }, strokeAttrs)));
        } else if (s.type === 'ellipse') {
          g.appendChild(U.svg('ellipse', Object.assign({
            cx: s.x + s.w / 2, cy: s.y + s.h / 2, rx: Math.max(0, s.w / 2), ry: Math.max(0, s.h / 2), fill: fill
          }, strokeAttrs)));
        } else if (s.type === 'line') {
          g.appendChild(U.svg('line', Object.assign({
            x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y + s.h, fill: 'none'
          }, strokeAttrs)));
          g.appendChild(U.svg('line', {
            x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y + s.h,
            stroke: 'transparent', 'stroke-width': Math.max(s.strokeW, pxToUser() * 10)
          }));
        } else if (s.type === 'image') {
          if (s.radius > 0) {
            const cid = 'clip_' + s.id;
            defs.appendChild(U.svg('clipPath', { id: cid }, [
              U.svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: s.radius, ry: s.radius })
            ]));
            g.setAttribute('clip-path', 'url(#' + cid + ')');
          }
          g.appendChild(U.svg('image', {
            href: s.src || '', x: s.x, y: s.y, width: Math.max(0, s.w), height: Math.max(0, s.h),
            preserveAspectRatio: s.fit === 'cover' ? 'xMidYMid slice' : s.fit === 'fill' ? 'none' : 'xMidYMid meet'
          }));
          if (s.strokeOn) {
            g.appendChild(U.svg('rect', Object.assign({
              x: s.x, y: s.y, width: Math.max(0, s.w), height: Math.max(0, s.h),
              rx: s.radius, ry: s.radius, fill: 'none'
            }, strokeAttrs)));
          }
        }

        if (s.text && s.type !== 'line') g.appendChild(renderText(s));
        return g;
      }

      function fontCss(s) {
        const f = s.font;
        return (f.italic ? 'italic ' : '') + (f.weight || 400) + ' ' + f.size + 'px ' + fontStack(f.family);
      }

      function renderText(s) {
        const f = s.font;
        const maxW = Math.max(4, s.w - 2 * s.pad);
        const lines = U.wrapText(s.text, fontCss(s), maxW);
        const lineH = f.size * (f.lh || 1.35);
        const total = lines.length * lineH;

        let top;
        if (f.valign === 'top') top = s.y + s.pad;
        else if (f.valign === 'bottom') top = s.y + s.h - s.pad - total;
        else top = s.y + (s.h - total) / 2;

        const anchor = f.align === 'left' ? 'start' : f.align === 'right' ? 'end' : 'middle';
        const tx = f.align === 'left' ? s.x + s.pad : f.align === 'right' ? s.x + s.w - s.pad : s.x + s.w / 2;

        const t = U.svg('text', {
          'text-anchor': anchor,
          fill: f.color,
          'font-family': fontStack(f.family),
          'font-size': f.size,
          'font-weight': f.weight || 400,
          'font-style': f.italic ? 'italic' : null,
          'text-decoration': f.underline ? 'underline' : null,
          'pointer-events': 'none'
        });
        lines.forEach((ln, i) => {
          t.appendChild(U.svg('tspan', {
            x: tx, y: top + i * lineH + (lineH - f.size) / 2 + f.size * 0.8, text: ln || ' '
          }));
        });
        return t;
      }

      /* -------------------------------------------------- Auswahlrahmen */

      function drawOverlay() {
        gOverlay.innerHTML = '';
        if (!sel.size) return;
        const px = pxToUser();
        const list = selected();

        for (const s of list) {
          const box = U.svg('rect', {
            x: s.x, y: s.y, width: s.w, height: s.h, class: 'wf-selbox',
            'stroke-width': px * 1.2, fill: 'none'
          });
          if (s.rot) box.setAttribute('transform', 'rotate(' + s.rot + ' ' + (s.x + s.w / 2) + ' ' + (s.y + s.h / 2) + ')');
          gOverlay.appendChild(box);
        }

        if (list.length !== 1) {
          if (list.length > 1) {
            const b = boundsOf(list);
            gOverlay.appendChild(U.svg('rect', {
              x: b.x, y: b.y, width: b.w, height: b.h, class: 'wf-selbox wf-selbox--multi',
              'stroke-width': px * 1.4, fill: 'none'
            }));
          }
          return;
        }

        const s = list[0];
        if (s.locked) return;
        const hs = px * 4.5;
        const dirs = [['nw', 0, 0], ['n', .5, 0], ['ne', 1, 0], ['e', 1, .5], ['se', 1, 1], ['s', .5, 1], ['sw', 0, 1], ['w', 0, .5]];
        const grp = U.svg('g');
        if (s.rot) grp.setAttribute('transform', 'rotate(' + s.rot + ' ' + (s.x + s.w / 2) + ' ' + (s.y + s.h / 2) + ')');

        for (const [dir, ax, ay] of dirs) {
          if (s.type === 'line' && dir.length === 1) continue;
          const h = U.svg('rect', {
            x: s.x + s.w * ax - hs, y: s.y + s.h * ay - hs, width: hs * 2, height: hs * 2,
            class: 'wf-handle', dataset: { dir: dir }, 'stroke-width': px
          });
          h.style.cursor = cursorFor(dir);
          grp.appendChild(h);
        }
        const rot = U.svg('circle', {
          cx: s.x + s.w / 2, cy: s.y - px * 18, r: hs, class: 'wf-handle wf-handle--rot', dataset: { dir: 'rot' },
          'stroke-width': px
        });
        rot.style.cursor = 'grab';
        grp.appendChild(rot);
        grp.appendChild(U.svg('line', {
          x1: s.x + s.w / 2, y1: s.y, x2: s.x + s.w / 2, y2: s.y - px * 18,
          class: 'wf-selbox', 'stroke-width': px
        }));
        gOverlay.appendChild(grp);

        // Verbindungsgriff: von hier lässt sich ein Board-Pfeil an genau
        // dieses Element ziehen (z. B. Knopf → Bildschirm, den er öffnet)
        const bb = U.boundsOf(s.x, s.y, s.w, s.h, s.rot);
        const lx = bb.x + bb.w + px * 15, ly = bb.y + bb.h / 2;
        gOverlay.appendChild(U.svg('circle', {
          cx: lx, cy: ly, r: hs * 1.25, class: 'wf-link', dataset: { id: s.id },
          'stroke-width': px * 1.4
        }, [U.svg('title', { text: 'Pfeil von diesem Element ziehen' })]));
        gOverlay.appendChild(U.svg('line', {
          x1: bb.x + bb.w, y1: ly, x2: lx - hs * 1.25, y2: ly,
          class: 'wf-selbox', 'stroke-width': px
        }));
      }

      function cursorFor(dir) {
        return { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }[dir] || 'move';
      }

      /* --------------------------------------------------------- Lineale */

      function drawRulers() {
        const px = pxToUser();
        if (!px || !isFinite(px)) return;
        const rectS = svg.getBoundingClientRect();
        if (!rectS.width) return;

        // Sichtbarer Artboard-Bereich in Bildschirmkoordinaten
        const a = toUser(rectS.left, rectS.top);
        const b = toUser(rectS.right, rectS.bottom);
        const step = niceStep(60 * px);

        rulerH.setAttribute('viewBox', a.x + ' 0 ' + (b.x - a.x) + ' 18');
        rulerH.setAttribute('preserveAspectRatio', 'none');
        rulerH.innerHTML = '';
        rulerV.setAttribute('viewBox', '0 ' + a.y + ' 18 ' + (b.y - a.y));
        rulerV.setAttribute('preserveAspectRatio', 'none');
        rulerV.innerHTML = '';

        const sy = (b.y - a.y) / Math.max(rulerV.getBoundingClientRect().height || 1, 1);
        const sx = (b.x - a.x) / Math.max(rulerH.getBoundingClientRect().width || 1, 1);

        for (let v = Math.ceil(a.x / step) * step; v < b.x; v += step) {
          rulerH.appendChild(U.svg('line', { x1: v, y1: 11, x2: v, y2: 18, class: 'wf-tick', 'stroke-width': sx }));
        }
        for (let v = Math.ceil(a.y / step) * step; v < b.y; v += step) {
          rulerV.appendChild(U.svg('line', { x1: 11, y1: v, x2: 18, y2: v, class: 'wf-tick', 'stroke-width': sy }));
        }
        // Text in nicht-uniform skalierten viewBoxen wird verzerrt -> Beschriftung als HTML-Ebene
        renderRulerLabels(a, b, step);
      }

      const rulerLabels = U.el('div', { class: 'wf-ruler-labels' });
      grid.appendChild(rulerLabels);

      function renderRulerLabels(a, b, step) {
        rulerLabels.innerHTML = '';
        const rectS = svg.getBoundingClientRect();
        const rectG = grid.getBoundingClientRect();
        const scale = GD.board.scale() || 1;
        if (!rectS.width) return;
        const k = rectS.width / (b.x - a.x);
        for (let v = Math.ceil(a.x / step) * step; v < b.x; v += step) {
          const left = (rectS.left - rectG.left) / scale + (v - a.x) * k / scale;
          rulerLabels.appendChild(U.el('span', {
            class: 'wf-rl wf-rl--h', text: Math.round(v), style: { left: left + 'px' }
          }));
        }
        const ky = rectS.height / (b.y - a.y);
        for (let v = Math.ceil(a.y / step) * step; v < b.y; v += step) {
          const top = (rectS.top - rectG.top) / scale + (v - a.y) * ky / scale;
          rulerLabels.appendChild(U.el('span', {
            class: 'wf-rl wf-rl--v', text: Math.round(v), style: { top: top + 'px' }
          }));
        }
      }

      function niceStep(min) {
        const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
        for (const s of steps) if (s >= min) return s;
        return 5000;
      }

      /* --------------------------------------------------- Interaktion */

      svg.addEventListener('pointerdown', onDown);
      svg.addEventListener('dblclick', onDblClick);
      rulerH.addEventListener('pointerdown', (ev) => startNewGuide(ev, 'v'));
      rulerV.addEventListener('pointerdown', (ev) => startNewGuide(ev, 'h'));

      function onDown(ev) {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        ctx.win.select();

        const linkEl = ev.target.closest('.wf-link');
        if (linkEl) { GD.connections.beginLink(ctx.id, 'auto', ev, linkEl.dataset.id); return; }

        const handleEl = ev.target.closest('.wf-handle');
        if (handleEl) { startResize(ev, handleEl.dataset.dir); return; }

        const guideEl = ev.target.closest('.wf-guide-hit');
        if (guideEl && tool === 'select') { startMoveGuide(ev, guideEl.dataset.axis, parseFloat(guideEl.dataset.pos)); return; }

        if (tool !== 'select') { startCreate(ev); return; }

        const shapeEl = ev.target.closest('.wf-shape');
        if (!shapeEl) {
          if (!ev.shiftKey) { sel.clear(); drawOverlay(); refresh(); }
          startMarquee(ev);
          return;
        }

        const id = shapeEl.dataset.id;
        const s = byId(id);
        if (!s) return;
        if (ev.shiftKey) {
          if (sel.has(id)) sel.delete(id); else sel.add(id);
          drawOverlay(); refresh();
          return;
        }
        if (!sel.has(id)) { sel = new Set([id]); drawOverlay(); refresh(); }
        if (!s.locked) startMove(ev);
      }

      function onDblClick(ev) {
        ev.stopPropagation();
        const shapeEl = ev.target.closest('.wf-shape');
        if (!shapeEl) return;
        const s = byId(shapeEl.dataset.id);
        if (s && s.type !== 'image' && s.type !== 'line') startTextEdit(s);
      }

      /* ------------------------------------------------------ Erzeugen */

      function startCreate(ev) {
        const p0 = toUser(ev.clientX, ev.clientY);
        const s = mk(tool === 'text' ? 'text' : tool, { x: p0.x, y: p0.y, w: 0, h: 0 });
        if (tool === 'text') { s.text = 'Text'; s.font.align = 'left'; s.pad = 0; }
        state.shapes.push(s);
        sel = new Set([s.id]);

        U.drag(ev, {
          onMove(dx, dy, e) {
            const p = snapPoint(toUser(e.clientX, e.clientY), e.altKey);
            if (tool === 'line') { s.x = p0.x; s.y = p0.y; s.w = p.x - p0.x; s.h = p.y - p0.y; }
            else {
              s.x = Math.min(p0.x, p.x); s.y = Math.min(p0.y, p.y);
              s.w = Math.abs(p.x - p0.x); s.h = Math.abs(p.y - p0.y);
              if (e.shiftKey) { const m = Math.max(s.w, s.h); s.w = m; s.h = m; }
            }
            roundShape(s);
            render();
          },
          onEnd(e, moved) {
            if (!moved) {
              if (tool === 'text') { s.x = Math.round(p0.x); s.y = Math.round(p0.y); s.w = 200; s.h = Math.round(s.font.size * 1.6); }
              else if (tool === 'line') { s.w = 160; s.h = 0; }
              else { s.w = 160; s.h = 100; s.x = Math.round(p0.x - 80); s.y = Math.round(p0.y - 50); }
            }
            if (Math.abs(s.w) < 2 && Math.abs(s.h) < 2 && tool !== 'text') {
              state.shapes.pop(); sel.clear();
            }
            roundShape(s);
            setTool('select');
            render(); refresh();
            commit('Objekt erstellt');
            if (s.type === 'text' && !moved) startTextEdit(s);
          }
        });
      }

      async function insertImage() {
        const files = await U.pickFile('image/*');
        if (!files.length) return;
        const f = files[0];
        if (f.size > 16 * 1024 * 1024) { ctx.toast('Bild ist zu groß (max. 16 MB)', 'err'); return; }
        const src = await U.readAsDataURL(f);
        const img = new Image();
        img.onload = () => {
          const maxW = state.canvas.w * 0.5;
          const k = Math.min(1, maxW / img.naturalWidth);
          const s = mk('image', {
            src: src, fit: 'contain', strokeOn: false, fillOn: false, radius: 0,
            w: Math.round(img.naturalWidth * k), h: Math.round(img.naturalHeight * k)
          });
          s.x = Math.round(state.canvas.w / 2 - s.w / 2);
          s.y = Math.round(state.canvas.h / 2 - s.h / 2);
          state.shapes.push(s);
          sel = new Set([s.id]);
          render(); refresh(); commit('Bild eingefügt');
        };
        img.onerror = () => ctx.toast('Bild konnte nicht gelesen werden', 'err');
        img.src = src;
      }

      /* ------------------------------------------------------ Verschieben */

      function startMove(ev) {
        const list = selected().filter((s) => !s.locked);
        if (!list.length) return;
        const starts = list.map((s) => ({ s: s, x: s.x, y: s.y }));
        const box0 = boundsOf(list);
        const others = state.shapes.filter((s) => !sel.has(s.id));

        U.drag(ev, {
          onMove(dxp, dyp, e) {
            const k = pxToUser();
            let dx = dxp * k, dy = dyp * k;
            if (e.shiftKey) { if (Math.abs(dxp) > Math.abs(dyp)) dy = 0; else dx = 0; }
            let guides = [];
            if (state.grid.snap && !e.altKey) {
              const res = snapBox({ x: box0.x + dx, y: box0.y + dy, w: box0.w, h: box0.h }, others, 6 * k);
              dx += res.dx; dy += res.dy;
              guides = res.guides;
            }
            for (const st of starts) { st.s.x = Math.round(st.x + dx); st.s.y = Math.round(st.y + dy); }
            render();
            drawSmart(guides);
          },
          onEnd(e, moved) {
            drawSmart([]);
            if (moved) { render(); refresh(); commit('Objekt verschoben'); }
          }
        });
      }

      /* -------------------------------------------------------- Skalieren */

      function startResize(ev, dir) {
        const s = selected()[0];
        if (!s || s.locked) return;

        if (dir === 'rot') {
          const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
          const start = s.rot;
          const p0 = toUser(ev.clientX, ev.clientY);
          const a0 = Math.atan2(p0.y - cy, p0.x - cx);
          U.drag(ev, {
            onMove(dx, dy, e) {
              const p = toUser(e.clientX, e.clientY);
              let deg = start + (Math.atan2(p.y - cy, p.x - cx) - a0) * 180 / Math.PI;
              if (e.shiftKey) deg = Math.round(deg / 15) * 15;
              s.rot = Math.round(deg * 10) / 10;
              render();
            },
            onEnd(e, moved) { if (moved) { refresh(); commit('Objekt gedreht'); } }
          });
          return;
        }

        const s0 = { x: s.x, y: s.y, w: s.w, h: s.h };
        const ax = dir.includes('w') ? 1 : dir.includes('e') ? 0 : 0.5;
        const ay = dir.includes('n') ? 1 : dir.includes('s') ? 0 : 0.5;   // fester Gegenpunkt
        const cx0 = s0.x + s0.w / 2, cy0 = s0.y + s0.h / 2;
        const anchorWorld = U.rotate(s0.x + s0.w * ax, s0.y + s0.h * ay, cx0, cy0, s.rot);
        const others = state.shapes.filter((x) => x.id !== s.id);
        const ratio = s0.h ? s0.w / s0.h : 1;

        U.drag(ev, {
          onMove(dxp, dyp, e) {
            const k = pxToUser();
            const p = toUser(e.clientX, e.clientY);
            // Zeiger in das unrotierte System des Objekts holen
            const lp = U.rotate(p.x, p.y, cx0, cy0, -s.rot);
            let x = s0.x, y = s0.y, w = s0.w, h = s0.h;

            if (dir.includes('e')) w = lp.x - s0.x;
            if (dir.includes('w')) { w = s0.x + s0.w - lp.x; x = lp.x; }
            if (dir.includes('s')) h = lp.y - s0.y;
            if (dir.includes('n')) { h = s0.y + s0.h - lp.y; y = lp.y; }

            if (e.shiftKey && dir.length === 2) {
              if (w / Math.max(h, 1) > ratio) h = w / ratio; else w = h * ratio;
              if (dir.includes('w')) x = s0.x + s0.w - w;
              if (dir.includes('n')) y = s0.y + s0.h - h;
            }

            if (s.type !== 'line') { w = Math.max(1, w); h = Math.max(1, h); }

            if (!s.rot && state.grid.snap && !e.altKey) {
              const guides = [];
              const lines = collectLines(others);
              if (dir.includes('e')) { const r = snapVal(x + w, lines.v, 6 * k); w = r.v - x; if (r.hit) guides.push({ axis: 'v', pos: r.v }); }
              if (dir.includes('w')) { const r = snapVal(x, lines.v, 6 * k); w += x - r.v; x = r.v; if (r.hit) guides.push({ axis: 'v', pos: r.v }); }
              if (dir.includes('s')) { const r = snapVal(y + h, lines.h, 6 * k); h = r.v - y; if (r.hit) guides.push({ axis: 'h', pos: r.v }); }
              if (dir.includes('n')) { const r = snapVal(y, lines.h, 6 * k); h += y - r.v; y = r.v; if (r.hit) guides.push({ axis: 'h', pos: r.v }); }
              drawSmart(guides);
            }

            if (s.rot) {
              // Gegenpunkt festhalten
              const nc = {
                x: anchorWorld.x + (0.5 - ax) * w * Math.cos(s.rot * Math.PI / 180) - (0.5 - ay) * h * Math.sin(s.rot * Math.PI / 180),
                y: anchorWorld.y + (0.5 - ax) * w * Math.sin(s.rot * Math.PI / 180) + (0.5 - ay) * h * Math.cos(s.rot * Math.PI / 180)
              };
              s.x = Math.round(nc.x - w / 2); s.y = Math.round(nc.y - h / 2);
            } else { s.x = Math.round(x); s.y = Math.round(y); }
            s.w = Math.round(w); s.h = Math.round(h);
            render();
          },
          onEnd(e, moved) { drawSmart([]); if (moved) { refresh(); commit('Größe geändert'); } }
        });
      }

      /* ------------------------------------------------------- Marquee */

      function startMarquee(ev) {
        const p0 = toUser(ev.clientX, ev.clientY);
        const box = U.svg('rect', { class: 'wf-marquee', 'stroke-width': pxToUser() });
        gOverlay.appendChild(box);
        const base = new Set(sel);
        U.drag(ev, {
          onMove(dx, dy, e) {
            const p = toUser(e.clientX, e.clientY);
            const r = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
            box.setAttribute('x', r.x); box.setAttribute('y', r.y);
            box.setAttribute('width', r.w); box.setAttribute('height', r.h);
            sel = new Set(base);
            for (const s of state.shapes) {
              const b = U.boundsOf(s.x, s.y, s.w, s.h, s.rot);
              if (b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y) sel.add(s.id);
            }
          },
          onEnd(e, moved) { box.remove(); render(); refresh(); }
        });
      }

      /* -------------------------------------------------- Führungslinien */

      function startNewGuide(ev, axis) {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        ctx.win.select();
        const arr = axis === 'v' ? state.guides.v : state.guides.h;
        const p = toUser(ev.clientX, ev.clientY);
        arr.push(Math.round(axis === 'v' ? p.x : p.y));
        const idx = arr.length - 1;
        render();
        U.drag(ev, {
          onMove(dx, dy, e) {
            const q = toUser(e.clientX, e.clientY);
            arr[idx] = Math.round(axis === 'v' ? q.x : q.y);
            render();
          },
          onEnd() {
            const v = arr[idx];
            const lim = axis === 'v' ? state.canvas.w : state.canvas.h;
            if (v < -20 || v > lim + 20) arr.splice(idx, 1);
            render(); commit('Führungslinie'); refresh();
          }
        });
      }

      function startMoveGuide(ev, axis, pos) {
        ev.stopPropagation();
        const arr = axis === 'v' ? state.guides.v : state.guides.h;
        const idx = arr.indexOf(pos);
        if (idx < 0) return;
        U.drag(ev, {
          onMove(dx, dy, e) {
            const q = toUser(e.clientX, e.clientY);
            arr[idx] = Math.round(axis === 'v' ? q.x : q.y);
            render();
          },
          onEnd(e, moved) {
            const v = arr[idx];
            const lim = axis === 'v' ? state.canvas.w : state.canvas.h;
            if (v < -20 || v > lim + 20) { arr.splice(idx, 1); ctx.toast('Führungslinie entfernt'); }
            render(); if (moved) commit('Führungslinie verschoben'); refresh();
          }
        });
      }

      /* ----------------------------------------------------- Einrasten */

      function collectLines(others) {
        const v = [0, state.canvas.w / 2, state.canvas.w].concat(state.guides.v);
        const h = [0, state.canvas.h / 2, state.canvas.h].concat(state.guides.h);
        for (const o of others) {
          v.push(o.x, o.x + o.w / 2, o.x + o.w);
          h.push(o.y, o.y + o.h / 2, o.y + o.h);
        }
        return { v: v, h: h };
      }

      function snapVal(value, lines, threshold) {
        let best = null;
        for (const l of lines) {
          const d = l - value;
          if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
        }
        if (best !== null) return { v: value + best, hit: true };
        if (state.grid.size > 0) {
          const g = U.round(value, state.grid.size);
          if (Math.abs(g - value) <= threshold) return { v: g, hit: false };
        }
        return { v: value, hit: false };
      }

      function snapBox(box, others, threshold) {
        const lines = collectLines(others);
        const guides = [];
        let dx = 0, dy = 0, bx = null, by = null;
        const cand = [
          [box.x, 0], [box.x + box.w / 2, 0], [box.x + box.w, 0]
        ];
        for (const [value] of cand) {
          for (const l of lines.v) {
            const d = l - value;
            if (Math.abs(d) <= threshold && (bx === null || Math.abs(d) < Math.abs(bx.d))) bx = { d: d, pos: l };
          }
        }
        for (const value of [box.y, box.y + box.h / 2, box.y + box.h]) {
          for (const l of lines.h) {
            const d = l - value;
            if (Math.abs(d) <= threshold && (by === null || Math.abs(d) < Math.abs(by.d))) by = { d: d, pos: l };
          }
        }
        if (bx) { dx = bx.d; guides.push({ axis: 'v', pos: bx.pos }); }
        else if (state.grid.size) { const g = U.round(box.x, state.grid.size) - box.x; if (Math.abs(g) <= threshold) dx = g; }
        if (by) { dy = by.d; guides.push({ axis: 'h', pos: by.pos }); }
        else if (state.grid.size) { const g = U.round(box.y, state.grid.size) - box.y; if (Math.abs(g) <= threshold) dy = g; }
        return { dx: dx, dy: dy, guides: guides };
      }

      function snapPoint(p, alt) {
        if (!state.grid.snap || alt || !state.grid.size) return p;
        return { x: U.round(p.x, state.grid.size), y: U.round(p.y, state.grid.size) };
      }

      function drawSmart(list) {
        gSmart.innerHTML = '';
        const px = pxToUser();
        for (const g of list) {
          gSmart.appendChild(U.svg('line', {
            class: 'wf-smartline', 'stroke-width': px * 1.2,
            'stroke-dasharray': (px * 4) + ' ' + (px * 4),
            x1: g.axis === 'v' ? g.pos : 0, y1: g.axis === 'v' ? 0 : g.pos,
            x2: g.axis === 'v' ? g.pos : state.canvas.w, y2: g.axis === 'v' ? state.canvas.h : g.pos
          }));
        }
      }

      /* ---------------------------------------------------- Textbearbeitung */

      function startTextEdit(s) {
        if (editing) editing.done(true);
        const m = svg.getScreenCTM();
        if (!m) return;
        const p1 = new DOMPoint(s.x, s.y).matrixTransform(m);
        const p2 = new DOMPoint(s.x + s.w, s.y + s.h).matrixTransform(m);
        const f = s.font;

        const ta = U.el('textarea', {
          class: 'wf-textedit', spellcheck: false, value: s.text || '',
          style: {
            left: p1.x + 'px', top: p1.y + 'px',
            width: Math.max(40, p2.x - p1.x) + 'px', height: Math.max(24, p2.y - p1.y) + 'px',
            fontSize: (f.size * m.a) + 'px',
            fontFamily: fontStack(f.family),
            fontWeight: f.weight, fontStyle: f.italic ? 'italic' : 'normal',
            color: f.color, textAlign: f.align,
            lineHeight: String(f.lh || 1.35),
            padding: (s.pad * m.a) + 'px'
          }
        });
        document.body.appendChild(ta);
        ta.focus();
        ta.select();

        const done = (save) => {
          if (!editing) return;
          editing = null;
          const next = ta.value;
          ta.remove();
          if (save && next !== s.text) { s.text = next; render(); refresh(); commit('Text geändert'); }
        };
        editing = { done: done };

        ta.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Escape') { ev.preventDefault(); done(false); }
          if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); done(true); }
        });
        ta.addEventListener('blur', () => done(true));
      }

      /* ------------------------------------------------- Objektoperationen */

      function byId(id) { return state.shapes.find((s) => s.id === id) || null; }
      function selected() { return state.shapes.filter((s) => sel.has(s.id)); }

      function boundsOf(list) {
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (const s of list) {
          const b = U.boundsOf(s.x, s.y, s.w, s.h, s.rot);
          x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
          x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
        }
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }

      function roundShape(s) {
        s.x = Math.round(s.x); s.y = Math.round(s.y);
        s.w = Math.round(s.w); s.h = Math.round(s.h);
      }

      function duplicateSel() {
        const list = selected();
        if (!list.length) return;
        const copies = list.map((s) => {
          const c = U.clone(s);
          c.id = U.uid('sh'); c.x += 16; c.y += 16;
          return c;
        });
        state.shapes.push.apply(state.shapes, copies);
        sel = new Set(copies.map((c) => c.id));
        render(); refresh(); commit('Objekt dupliziert');
      }

      function deleteSel() {
        if (!sel.size) return;
        state.shapes = state.shapes.filter((s) => !sel.has(s.id));
        sel.clear();
        render(); refresh(); commit('Objekt gelöscht');
      }

      function reorder(dir) {
        const list = selected();
        if (!list.length) return;
        const idx = list.map((s) => state.shapes.indexOf(s)).sort((a, b) => dir > 0 ? b - a : a - b);
        for (const i of idx) {
          const j = i + dir;
          if (j < 0 || j >= state.shapes.length) continue;
          const t = state.shapes[i]; state.shapes[i] = state.shapes[j]; state.shapes[j] = t;
        }
        render(); commit('Ebene geändert');
      }

      function toFront(front) {
        const list = selected();
        if (!list.length) return;
        state.shapes = state.shapes.filter((s) => !sel.has(s.id));
        if (front) state.shapes.push.apply(state.shapes, list);
        else state.shapes.unshift.apply(state.shapes, list);
        render(); commit('Ebene geändert');
      }

      function alignSel(fn) {
        const list = selected();
        if (list.length < 2) return;
        const b = boundsOf(list);
        for (const s of list) fn(s, b);
        for (const s of list) roundShape(s);
        render(); refresh(); commit('Ausgerichtet');
      }

      function distributeSel(axis) {
        const list = selected();
        if (list.length < 3) { ctx.toast('Mindestens 3 Objekte nötig'); return; }
        const size = axis === 'x' ? 'w' : 'h';
        const sorted = list.slice().sort((a, b) => a[axis] - b[axis]);
        const first = sorted[0], last = sorted[sorted.length - 1];
        const total = (last[axis] + last[size]) - first[axis];
        const used = sorted.reduce((acc, s) => acc + s[size], 0);
        const gap = (total - used) / (sorted.length - 1);
        let cur = first[axis];
        for (const s of sorted) { s[axis] = Math.round(cur); cur += s[size] + gap; }
        render(); refresh(); commit('Verteilt');
      }

      /* ---------------------------------------------------------- Export */

      function exportSvg() {
        const clone = svg.cloneNode(true);
        for (const cls of ['.wf-overlay', '.wf-smart', '.wf-guides']) {
          const n = clone.querySelector(cls);
          if (n) n.remove();
        }
        clone.setAttribute('xmlns', U.SVG_NS);
        clone.setAttribute('width', state.canvas.w);
        clone.setAttribute('height', state.canvas.h);
        const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
        U.download((ctx.win.get().title || 'wireframe') + '.svg', text, 'image/svg+xml');
      }

      function exportPng(factor) {
        const clone = svg.cloneNode(true);
        for (const cls of ['.wf-overlay', '.wf-smart', '.wf-guides']) {
          const n = clone.querySelector(cls);
          if (n) n.remove();
        }
        clone.setAttribute('xmlns', U.SVG_NS);
        clone.setAttribute('width', state.canvas.w);
        clone.setAttribute('height', state.canvas.h);
        const svgText = new XMLSerializer().serializeToString(clone);
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        const img = new Image();
        img.onload = () => {
          const k = factor || 2;
          const cv = document.createElement('canvas');
          cv.width = state.canvas.w * k; cv.height = state.canvas.h * k;
          const g = cv.getContext('2d');
          g.fillStyle = state.canvas.bg;
          g.fillRect(0, 0, cv.width, cv.height);
          g.drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob((blob) => {
            if (!blob) { ctx.toast('PNG-Export fehlgeschlagen', 'err'); return; }
            U.download((ctx.win.get().title || 'wireframe') + '.png', blob, 'image/png');
          }, 'image/png');
        };
        img.onerror = () => ctx.toast('PNG-Export fehlgeschlagen — nutze den SVG-Export.', 'err');
        img.src = url;
      }

      /* -------------------------------------------------------- Bindung */

      function commit(label) { ctx.commit(label); }
      function refresh() { ctx.refreshInspector(); }

      const rerender = U.raf(() => { render(); });
      const nudgeCommit = U.debounce(() => commit('Objekt verschoben'), 400);
      const ro = new ResizeObserver(rerender);
      ro.observe(stage);

      render();

      /* -------------------------------------------------- Schnittstelle */

      return {
        el: root,

        getState() { return { canvas: state.canvas, shapes: state.shapes, guides: state.guides, grid: state.grid }; },

        setState(next) {
          const n = normalize(next);
          state.canvas = n.canvas; state.shapes = n.shapes; state.guides = n.guides; state.grid = n.grid;
          const ids = new Set(state.shapes.map((s) => s.id));
          sel = new Set(Array.from(sel).filter((id) => ids.has(id)));
          render();
        },

        onResize() { rerender(); },
        onZoom() { rerender(); },

        /** Lage einer Form in Weltkoordinaten — für Pfeile am Element */
        shapeAnchor(id) {
          const s = state.shapes.find((x) => x.id === id);
          if (!s) return null;
          const m = svg.getScreenCTM();
          if (!m) return null;
          const b = U.boundsOf(s.x, s.y, s.w, s.h, s.rot);
          const p1 = new DOMPoint(b.x, b.y).matrixTransform(m);
          const p2 = new DOMPoint(b.x + b.w, b.y + b.h).matrixTransform(m);
          const a = GD.board.screenToWorld(p1.x, p1.y);
          const c = GD.board.screenToWorld(p2.x, p2.y);
          return { x: a.x, y: a.y, w: Math.max(1, c.x - a.x), h: Math.max(1, c.y - a.y) };
        },

        /** Name der Form für den Inspector */
        shapeLabel(id) {
          const s = state.shapes.find((x) => x.id === id);
          if (!s) return null;
          const art = { rect: 'Rechteck', ellipse: 'Ellipse', line: 'Linie', text: 'Text', image: 'Bild' }[s.type] || 'Form';
          return s.text ? art + ' „' + s.text.split('\n')[0].slice(0, 22) + '"' : art;
        },
        destroy() { ro.disconnect(); if (editing) editing.done(false); },

        headerTools() {
          const b = U.el('button', { class: 'gd-win__btn', title: 'Als SVG exportieren', text: '⤓' });
          b.addEventListener('click', exportSvg);
          return [b];
        },

        onKey(ev) {
          const ctrl = ev.ctrlKey || ev.metaKey;
          if (ctrl && (ev.key === 'd' || ev.key === 'D')) { if (sel.size) { duplicateSel(); return true; } return false; }
          if (ctrl && (ev.key === 'a' || ev.key === 'A')) { sel = new Set(state.shapes.map((s) => s.id)); render(); refresh(); return true; }
          if (ev.key === 'Delete' || ev.key === 'Backspace') { if (sel.size) { deleteSel(); return true; } return false; }
          if (ev.key === 'Escape') { if (sel.size) { sel.clear(); render(); refresh(); return true; } return false; }
          if (ev.key === ']') { reorder(1); return true; }
          if (ev.key === '[') { reorder(-1); return true; }
          if (!ctrl && ev.key.length === 1) {
            const map = { v: 'select', r: 'rect', o: 'ellipse', l: 'line', t: 'text', i: 'image' };
            const t = map[ev.key.toLowerCase()];
            if (t) { setTool(t); return true; }
          }
          if (ev.key.startsWith('Arrow') && sel.size) {
            const step = ev.shiftKey ? (state.grid.size || 8) : 1;
            const dx = ev.key === 'ArrowLeft' ? -step : ev.key === 'ArrowRight' ? step : 0;
            const dy = ev.key === 'ArrowUp' ? -step : ev.key === 'ArrowDown' ? step : 0;
            for (const s of selected()) { s.x += dx; s.y += dy; }
            render();
            nudgeCommit();
            return true;
          }
          return false;
        },

        inspector(host) { buildInspector(host); }
      };

      /* ------------------------------------------------------ Inspector */

      function buildInspector(host) {
        const list = selected();
        if (!list.length) { canvasInspector(host); return; }
        shapeInspector(host, list);
      }

      function irow(label, node) {
        return U.el('div', { class: 'insp-row' }, [U.el('label', { text: label }), node]);
      }
      function ifull(node) { return U.el('div', { class: 'insp-row insp-row--full' }, [node]); }
      function ititle(t) { return U.el('div', { class: 'insp-title', text: t }); }
      function ibtn(label, fn, cls) {
        const b = U.el('button', { class: 'btn btn--sm ' + (cls || ''), text: label });
        b.addEventListener('click', fn);
        return b;
      }
      function inum(value, onChange, opts) {
        const o = opts || {};
        const i = U.el('input', { type: 'number', class: 'fld', value: value, step: o.step || 1 });
        if (o.min !== undefined) i.min = o.min;
        if (o.max !== undefined) i.max = o.max;
        i.addEventListener('input', () => { const v = parseFloat(i.value); if (Number.isFinite(v)) { onChange(v); render(); } });
        i.addEventListener('change', () => commit('Eigenschaft geändert'));
        i.addEventListener('keydown', (ev) => ev.stopPropagation());
        return i;
      }
      function icolor(value, onChange) {
        const i = U.el('input', { type: 'color', value: toHex(value) });
        i.addEventListener('input', () => { onChange(i.value); render(); });
        i.addEventListener('change', () => commit('Farbe geändert'));
        return i;
      }
      function ichk(value, onChange) {
        const i = U.el('input', { type: 'checkbox', checked: !!value });
        i.addEventListener('change', () => { onChange(i.checked); render(); refresh(); commit('Eigenschaft geändert'); });
        return i;
      }
      function isel(value, options, onChange) {
        const s = U.el('select', { class: 'fld' });
        for (const [v, t] of options) {
          const o = U.el('option', { value: v, text: t });
          if (String(v) === String(value)) o.selected = true;
          s.appendChild(o);
        }
        s.addEventListener('change', () => { onChange(s.value); render(); refresh(); commit('Eigenschaft geändert'); });
        return s;
      }
      function irange(value, min, max, step, onInput) {
        const out = U.el('span', { text: String(value), style: { color: 'var(--text-dim)', minWidth: '34px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' } });
        const r = U.el('input', { type: 'range', min: min, max: max, step: step, value: value });
        r.addEventListener('input', () => { out.textContent = r.value; onInput(parseFloat(r.value)); render(); });
        r.addEventListener('change', () => commit('Eigenschaft geändert'));
        return U.el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [r, out]);
      }

      function each(list, fn) { return (v) => { for (const s of list) fn(s, v); }; }

      function canvasInspector(host) {
        host.appendChild(ititle('Zeichenfläche'));
        const preset = isel('', [['', 'Format wählen…']].concat(Object.keys(PRESETS).map((k) => [k, k])), (v) => {
          if (!v || !PRESETS[v]) return;
          state.canvas.w = PRESETS[v].w; state.canvas.h = PRESETS[v].h;
          render(); commit('Format geändert');
        });
        host.appendChild(ifull(preset));
        host.appendChild(irow('Größe', U.el('div', { class: 'insp-grid2' }, [
          inum(state.canvas.w, (v) => { state.canvas.w = Math.max(50, v); }, { min: 50 }),
          inum(state.canvas.h, (v) => { state.canvas.h = Math.max(50, v); }, { min: 50 })
        ])));
        host.appendChild(irow('Hintergrund', icolor(state.canvas.bg, (v) => { state.canvas.bg = v; })));

        host.appendChild(ititle('Raster & Hilfslinien'));
        host.appendChild(irow('Rastermaß', inum(state.grid.size, (v) => { state.grid.size = Math.max(1, v); }, { min: 1, max: 200 })));
        host.appendChild(irow('Anzeigen', ichk(state.grid.show, (v) => { state.grid.show = v; gridBtn.classList.toggle('is-on', v); })));
        host.appendChild(irow('Einrasten', ichk(state.grid.snap, (v) => { state.grid.snap = v; snapBtn.classList.toggle('is-on', v); })));
        host.appendChild(ifull(ibtn('Führungslinien löschen', () => {
          state.guides = { v: [], h: [] };
          render(); commit('Führungslinien gelöscht');
        })));
        host.appendChild(U.el('div', { class: 'insp-note', text: 'Führungslinien aus dem Lineal oben/links herausziehen. Zum Löschen zurück auf das Lineal ziehen.' }));

        host.appendChild(ititle('Export'));
        host.appendChild(ifull(U.el('div', { class: 'insp-grid2' }, [
          ibtn('SVG', exportSvg), ibtn('PNG @2x', () => exportPng(2))
        ])));
        host.appendChild(U.el('div', { class: 'insp-note', text: state.shapes.length + ' Objekte · ' + (state.guides.v.length + state.guides.h.length) + ' Führungslinien' }));
      }

      function shapeInspector(host, list) {
        const s = list[0];
        const multi = list.length > 1;
        host.appendChild(ititle(multi ? list.length + ' Objekte' : ({ rect: 'Rechteck', ellipse: 'Ellipse', line: 'Linie', text: 'Text', image: 'Bild' }[s.type] || 'Objekt')));

        if (!multi) {
          host.appendChild(irow('Position', U.el('div', { class: 'insp-grid2' }, [
            inum(Math.round(s.x), (v) => { s.x = v; }), inum(Math.round(s.y), (v) => { s.y = v; })
          ])));
          host.appendChild(irow('Größe', U.el('div', { class: 'insp-grid2' }, [
            inum(Math.round(s.w), (v) => { s.w = v; }), inum(Math.round(s.h), (v) => { s.h = v; })
          ])));
          host.appendChild(irow('Drehung', inum(s.rot, (v) => { s.rot = v; }, { step: 1, min: -360, max: 360 })));
        } else {
          host.appendChild(ititle('Ausrichten'));
          host.appendChild(ifull(U.el('div', { class: 'insp-grid3' }, [
            ibtn('Links', () => alignSel((o, b) => { o.x = b.x; })),
            ibtn('Mitte', () => alignSel((o, b) => { o.x = b.x + (b.w - o.w) / 2; })),
            ibtn('Rechts', () => alignSel((o, b) => { o.x = b.x + b.w - o.w; })),
            ibtn('Oben', () => alignSel((o, b) => { o.y = b.y; })),
            ibtn('Zentr.', () => alignSel((o, b) => { o.y = b.y + (b.h - o.h) / 2; })),
            ibtn('Unten', () => alignSel((o, b) => { o.y = b.y + b.h - o.h; }))
          ])));
          host.appendChild(ifull(U.el('div', { class: 'insp-grid2' }, [
            ibtn('Horiz. verteilen', () => distributeSel('x')),
            ibtn('Vert. verteilen', () => distributeSel('y'))
          ])));
        }

        /* Füllung */
        if (s.type !== 'line') {
          host.appendChild(ititle('Füllung'));
          host.appendChild(irow('Aktiv', ichk(s.fillOn, each(list, (o, v) => { o.fillOn = v; }))));
          if (s.fillOn) {
            host.appendChild(irow('Farbe', icolor(s.fill, each(list, (o, v) => { o.fill = v; }))));
            host.appendChild(irow('Verlauf', ichk(!!s.grad, each(list, (o, v) => {
              o.grad = v ? { to: U.shade(o.fill, -0.35), angle: 90 } : null;
            }))));
            if (s.grad) {
              host.appendChild(irow('Zielfarbe', icolor(s.grad.to, each(list, (o, v) => { if (o.grad) o.grad.to = v; }))));
              host.appendChild(irow('Winkel', irange(s.grad.angle, 0, 360, 5, each(list, (o, v) => { if (o.grad) o.grad.angle = v; }))));
            }
          }
        }

        /* Kontur */
        host.appendChild(ititle('Kontur'));
        host.appendChild(irow('Aktiv', ichk(s.strokeOn, each(list, (o, v) => { o.strokeOn = v; }))));
        if (s.strokeOn) {
          host.appendChild(irow('Farbe', icolor(s.stroke, each(list, (o, v) => { o.stroke = v; }))));
          host.appendChild(irow('Stärke', irange(s.strokeW, 0.5, 20, 0.5, each(list, (o, v) => { o.strokeW = v; }))));
          host.appendChild(irow('Stil', isel(s.dash, [['solid', 'durchgezogen'], ['dashed', 'gestrichelt'], ['dotted', 'gepunktet']], each(list, (o, v) => { o.dash = v; }))));
        }

        /* Form */
        if (s.type === 'rect' || s.type === 'image' || s.type === 'text') {
          host.appendChild(ititle('Form'));
          host.appendChild(irow('Ecken', irange(s.radius, 0, 120, 1, each(list, (o, v) => { o.radius = v; }))));
        }
        if (s.type === 'image') {
          host.appendChild(irow('Zuschnitt', isel(s.fit || 'contain', [['contain', 'einpassen'], ['cover', 'füllend'], ['fill', 'verzerrt']], each(list, (o, v) => { o.fit = v; }))));
          host.appendChild(ifull(ibtn('Bild ersetzen…', async () => {
            const files = await U.pickFile('image/*');
            if (!files.length) return;
            const src = await U.readAsDataURL(files[0]);
            for (const o of list) if (o.type === 'image') o.src = src;
            render(); commit('Bild ersetzt');
          })));
        }

        /* Effekte */
        host.appendChild(ititle('Effekte'));
        host.appendChild(irow('Deckkraft', irange(Math.round(s.opacity * 100), 0, 100, 1, each(list, (o, v) => { o.opacity = v / 100; }))));
        host.appendChild(irow('Schatten', ichk(s.shadow && s.shadow.on, each(list, (o, v) => { o.shadow = Object.assign({ x: 0, y: 4, blur: 12, color: '#0f172a40' }, o.shadow, { on: v }); }))));
        if (s.shadow && s.shadow.on) {
          host.appendChild(irow('Versatz', U.el('div', { class: 'insp-grid2' }, [
            inum(s.shadow.x, each(list, (o, v) => { o.shadow.x = v; })),
            inum(s.shadow.y, each(list, (o, v) => { o.shadow.y = v; }))
          ])));
          host.appendChild(irow('Weichheit', irange(s.shadow.blur, 0, 80, 1, each(list, (o, v) => { o.shadow.blur = v; }))));
          host.appendChild(irow('Farbe', icolor(s.shadow.color.slice(0, 7), each(list, (o, v) => { o.shadow.color = v + (o.shadow.color.length > 7 ? o.shadow.color.slice(7) : '40'); }))));
          host.appendChild(irow('Deckkraft', irange(parseInt((s.shadow.color.slice(7) || '40'), 16), 0, 255, 5, each(list, (o, v) => {
            o.shadow.color = o.shadow.color.slice(0, 7) + Math.round(v).toString(16).padStart(2, '0');
          }))));
        }
        host.appendChild(irow('Weichzeichnen', irange(s.blur || 0, 0, 30, 0.5, each(list, (o, v) => { o.blur = v; }))));

        /* Text */
        if (s.type !== 'line' && s.type !== 'image') {
          host.appendChild(ititle('Text'));
          const ta = U.el('textarea', { class: 'fld', rows: 2, value: s.text || '', placeholder: 'Beschriftung…' });
          ta.addEventListener('input', () => { for (const o of list) o.text = ta.value; render(); });
          ta.addEventListener('change', () => commit('Text geändert'));
          ta.addEventListener('keydown', (ev) => ev.stopPropagation());
          host.appendChild(ifull(ta));

          host.appendChild(irow('Größe', irange(s.font.size, 6, 96, 1, each(list, (o, v) => { o.font.size = v; }))));
          host.appendChild(irow('Schrift', isel(s.font.family, FONTS.map((f) => [f[0], f[1]]), each(list, (o, v) => { o.font.family = v; }))));
          host.appendChild(irow('Stärke', isel(s.font.weight, [[300, 'leicht'], [400, 'normal'], [500, 'mittel'], [600, 'halbfett'], [700, 'fett'], [800, 'schwer']], each(list, (o, v) => { o.font.weight = parseInt(v, 10); }))));
          host.appendChild(irow('Stil', U.el('div', { class: 'insp-grid2' }, [
            (() => { const b = ibtn('Kursiv', () => { for (const o of list) o.font.italic = !o.font.italic; render(); refresh(); commit('Textstil'); }, s.font.italic ? 'is-on' : ''); return b; })(),
            (() => { const b = ibtn('Unterstr.', () => { for (const o of list) o.font.underline = !o.font.underline; render(); refresh(); commit('Textstil'); }, s.font.underline ? 'is-on' : ''); return b; })()
          ])));
          host.appendChild(irow('Farbe', icolor(s.font.color, each(list, (o, v) => { o.font.color = v; }))));
          host.appendChild(irow('Horizontal', isel(s.font.align, [['left', 'links'], ['center', 'zentriert'], ['right', 'rechts']], each(list, (o, v) => { o.font.align = v; }))));
          host.appendChild(irow('Vertikal', isel(s.font.valign, [['top', 'oben'], ['middle', 'mittig'], ['bottom', 'unten']], each(list, (o, v) => { o.font.valign = v; }))));
          host.appendChild(irow('Zeilenhöhe', irange(s.font.lh || 1.35, 0.9, 2.4, 0.05, each(list, (o, v) => { o.font.lh = v; }))));
          host.appendChild(irow('Innenabstand', irange(s.pad, 0, 60, 1, each(list, (o, v) => { o.pad = v; }))));
          host.appendChild(ifull(ibtn('Höhe an Text anpassen', () => {
            for (const o of list) {
              const lines = U.wrapText(o.text || '', fontCss(o), Math.max(4, o.w - 2 * o.pad));
              o.h = Math.round(lines.length * o.font.size * (o.font.lh || 1.35) + 2 * o.pad);
            }
            render(); refresh(); commit('Höhe angepasst');
          })));
        }

        /* Ebene / Aktionen */
        host.appendChild(ititle('Ebene'));
        host.appendChild(ifull(U.el('div', { class: 'insp-grid4' }, [
          ibtn('⤒', () => toFront(true)), ibtn('↑', () => reorder(1)),
          ibtn('↓', () => reorder(-1)), ibtn('⤓', () => toFront(false))
        ])));
        host.appendChild(irow('Gesperrt', ichk(s.locked, each(list, (o, v) => { o.locked = v; }))));
        host.appendChild(ifull(U.el('div', { class: 'insp-grid2' }, [
          ibtn('Duplizieren', duplicateSel),
          ibtn('Löschen', deleteSel, 'btn--danger')
        ])));
      }
    }
  });

  /* ------------------------------------------------------------- Helfer */

  function toHex(c) {
    if (typeof c !== 'string') return '#000000';
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{8}$/i.test(c)) return c.slice(0, 7);
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return '#000000';
  }

  function normalize(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const canvas = Object.assign({ w: 1280, h: 800, bg: '#ffffff' }, s.canvas || {});
    const grid = Object.assign({ size: 8, show: true, snap: true }, s.grid || {});
    const guides = { v: Array.isArray(s.guides && s.guides.v) ? s.guides.v.slice() : [], h: Array.isArray(s.guides && s.guides.h) ? s.guides.h.slice() : [] };
    const shapes = (Array.isArray(s.shapes) ? s.shapes : []).map((raw) => {
      const base = mk(raw.type || 'rect', {});
      const out = Object.assign(base, raw);
      out.font = Object.assign({}, base.font, raw.font || {});
      out.shadow = Object.assign({}, base.shadow, raw.shadow || {});
      out.id = raw.id || U.uid('sh');
      return out;
    });
    return { canvas: canvas, grid: grid, guides: guides, shapes: shapes };
  }
})();
