/* GameDesk — Hilfsfunktionen (globaler Namensraum GD) */
(function () {
  'use strict';
  const GD = (window.GD = window.GD || {});

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let idCounter = 0;

  const util = {
    SVG_NS,

    uid(prefix) {
      idCounter += 1;
      return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + idCounter.toString(36);
    },

    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },

    round(v, step) { return Math.round(v / step) * step; },

    /** DOM-Element bauen: el('div', {class:'x', dataset:{a:1}}, [child|'text']) */
    el(tag, attrs, children) {
      const node = document.createElement(tag);
      applyAttrs(node, attrs);
      appendAll(node, children);
      return node;
    },

    /** SVG-Element bauen */
    svg(tag, attrs, children) {
      const node = document.createElementNS(SVG_NS, tag);
      if (attrs) {
        for (const k in attrs) {
          const v = attrs[k];
          if (v === null || v === undefined || v === false) continue;
          if (k === 'text') node.textContent = v;
          else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
          else if (k === 'dataset') { for (const dk in v) node.setAttribute('data-' + dk, v[dk]); }
          else node.setAttribute(k, v);
        }
      }
      appendAll(node, children);
      return node;
    },

    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      return () => target.removeEventListener(type, fn, opts);
    },

    debounce(fn, ms) {
      let t = 0;
      const wrapped = function () {
        const args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(self, args), ms);
      };
      wrapped.cancel = () => clearTimeout(t);
      wrapped.flush = function () { clearTimeout(t); fn.apply(this, arguments); };
      return wrapped;
    },

    /** Nächster Frame — im unsichtbaren Tab liefert rAF nichts, daher Timer */
    nextFrame(fn) {
      if (document.hidden) setTimeout(fn, 16);
      else requestAnimationFrame(fn);
    },

    /** rAF-gedrosselt: mehrere Aufrufe pro Frame werden zu einem */
    raf(fn) {
      let pending = false, lastArgs = null;
      return function () {
        lastArgs = arguments;
        if (pending) return;
        pending = true;
        util.nextFrame(() => { pending = false; fn.apply(null, lastArgs); });
      };
    },

    clone(obj) { return obj === undefined ? obj : JSON.parse(JSON.stringify(obj)); },

    /**
     * Werte aus dem Stilblatt (:root) — einmal lesen, dann gemerkt.
     *
     * `getComputedStyle()` ist ein LESEZUGRIFF auf das Layout: Steht davor
     * irgendwo ein Schreibzugriff, rechnet der Browser erst alles nach, bevor
     * er antwortet. Genau das war der teuerste Griff im ganzen Programm.
     * Beim Zoomen schreibt windows.js je Kachel neue Griffgrößen und ruft
     * dazwischen `onZoom()` jedes Rahmens auf — und der las fünfmal aus
     * :root. Aus zwölf Rahmen wurden so sechzig erzwungene Layoutläufe über
     * die ganze Tafel. Gemessen auf einer Tafel mit 93 Kacheln: 110-145 ms
     * FÜR EIN EINZIGES BILD, also sieben Bilder in der Sekunde.
     *
     * Die Werte in :root ändern sich nur beim Themenwechsel. Der Beobachter
     * unten wirft den Speicher dann weg; sonst wird nie wieder gelesen.
     */
    blatt(name, fallback) {
      const v = parseFloat(util.blattText(name, ''));
      return Number.isFinite(v) && v > 0 ? v : fallback;
    },

    /** Wie blatt(), aber als Text — für Farben */
    blattText(name, fallback) {
      if (name in blattWerte) return blattWerte[name] || fallback;
      if (!blattStil) blattStil = getComputedStyle(document.documentElement);
      const v = blattStil.getPropertyValue(name).trim();
      blattWerte[name] = v;
      return v || fallback;
    },

    /** Gemerkte Blattwerte wegwerfen (Themenwechsel, Schriftnachladung) */
    blattFrisch() { blattWerte = Object.create(null); blattStil = null; },

    /** Text/Blob als Datei herunterladen */
    download(filename, data, mime) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },

    /** Dateidialog öffnen -> Promise<File[]> (leer bei Abbruch/Schließen) */
    pickFile(accept, multiple) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        if (accept) input.accept = accept;
        if (multiple) input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
          const files = Array.from(input.files || []);
          input.remove();
          resolve(files);
        });
        input.click();
      });
    },

    readAsDataURL(file) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
      });
    },

    readAsText(file) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsText(file);
      });
    },

    fmtBytes(n) {
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
      return (n / 1048576).toFixed(1) + ' MB';
    },

    escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    /** true, wenn gerade in ein Eingabefeld getippt wird */
    isTyping(target) {
      const t = target || document.activeElement;
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
    },

    /** Punkt um ein Zentrum rotieren (Grad) */
    rotate(px, py, cx, cy, deg) {
      const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const dx = px - cx, dy = py - cy;
      return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
    },

    /** Achsenparalleles Hüllrechteck einer rotierten Box */
    boundsOf(x, y, w, h, rot) {
      if (!rot) return { x, y, w, h };
      const cx = x + w / 2, cy = y + h / 2;
      const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
        .map((p) => util.rotate(p[0], p[1], cx, cy, rot));
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    },

    /** Textbreite messen (gecachter 2D-Kontext) */
    measureText(text, font) {
      const ctx = measureCtx();
      ctx.font = font;
      return ctx.measureText(text).width;
    },

    /** Text auf maxWidth umbrechen; respektiert vorhandene Zeilenumbrüche */
    wrapText(text, font, maxWidth) {
      const ctx = measureCtx();
      ctx.font = font;
      const out = [];
      const paragraphs = String(text == null ? '' : text).split('\n');
      for (const para of paragraphs) {
        if (para === '') { out.push(''); continue; }
        if (maxWidth <= 0 || ctx.measureText(para).width <= maxWidth) { out.push(para); continue; }
        let line = '';
        for (const word of para.split(/(\s+)/)) {
          if (word === '') continue;
          const test = line + word;
          if (line && ctx.measureText(test).width > maxWidth) {
            out.push(line.replace(/\s+$/, ''));
            line = word.replace(/^\s+/, '');
          } else {
            line = test;
          }
        }
        out.push(line.replace(/\s+$/, ''));
      }
      return out;
    },

    /** Farbe aufhellen/abdunkeln, amount in [-1,1] */
    shade(hex, amount) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
      if (!m) return hex;
      const ch = [1, 2, 3].map((i) => {
        let v = parseInt(m[i], 16);
        v = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
        return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
      });
      return '#' + ch.join('');
    },

    /** #rrggbb + Alpha -> rgba() */
    withAlpha(hex, alpha) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
      if (!m) return hex;
      return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + alpha + ')';
    },

    /**
     * Zeiger-Drag mit Pointer-Capture.
     * start(ev, {onMove(dx,dy,ev), onEnd(ev,moved), cursor})
     */
    drag(ev, handlers) {
      ev.preventDefault();
      const startX = ev.clientX, startY = ev.clientY;
      let moved = false;
      const prevCursor = document.body.style.cursor;
      if (handlers.cursor) document.body.style.cursor = handlers.cursor;
      document.body.style.userSelect = 'none';

      function onMove(e) {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) moved = true;
        if (handlers.onMove) handlers.onMove(dx, dy, e, moved);
      }
      function onUp(e) {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onUp, true);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = '';
        if (handlers.onEnd) handlers.onEnd(e, moved);
      }
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    },

    /** kleiner Ereignis-Emitter */
    emitter() {
      const map = new Map();
      return {
        on(type, fn) {
          if (!map.has(type)) map.set(type, new Set());
          map.get(type).add(fn);
          return () => map.get(type).delete(fn);
        },
        off(type, fn) { if (map.has(type)) map.get(type).delete(fn); },
        emit(type, payload) {
          const set = map.get(type);
          if (!set) return;
          for (const fn of Array.from(set)) {
            try { fn(payload); } catch (err) { console.error('[GD] Listener-Fehler:', err); }
          }
        }
      };
    }
  };

  function applyAttrs(node, attrs) {
    if (!attrs) return;
    for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k in node && k !== 'list' && typeof v !== 'object') node[k] = v;
      else node.setAttribute(k, v);
    }
  }

  function appendAll(node, children) {
    if (children === null || children === undefined) return;
    const list = Array.isArray(children) ? children : [children];
    for (const c of list) {
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'string' || typeof c === 'number'
        ? document.createTextNode(String(c)) : c);
    }
  }

  let _mctx = null;
  function measureCtx() {
    if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
    return _mctx;
  }

  /* Gemerkte Werte aus :root (s. util.blatt). Der Beobachter hängt am
     Themenwechsel — GD.app schreibt dafür data-theme an <html>. Die
     Schriften kommen später nach; ein einmaliges Wegwerfen danach schadet
     nichts und fängt Maße ab, die vor dem Nachladen gemessen wurden. */
  let blattWerte = Object.create(null);
  let blattStil = null;

  new MutationObserver(() => util.blattFrisch())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => util.blattFrisch()).catch(() => {});
  }

  GD.util = util;
})();
