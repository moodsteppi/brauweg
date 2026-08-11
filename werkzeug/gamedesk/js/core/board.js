/* GameDesk — Board-Viewport: Verschieben, Zoomen, Raster, Auswahlrechteck */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const MIN_SCALE = 0.08;
  const MAX_SCALE = 4;

  let letztesRaster = null;        // zuletzt geschriebenes Rasterbild (s. apply)
  let brettRect = null;            // gemerktes Rechteck des Bretts (s. board.rect)

  const board = {
    events: U.emitter(),
    elBoard: null,
    elWorld: null,
    spaceDown: false,

    init() {
      board.elBoard = document.getElementById('board');
      board.elWorld = document.getElementById('world');
      board.elMarquee = document.getElementById('marquee');

      board.elBoard.addEventListener('pointerdown', onPointerDown);
      board.elBoard.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', () => setSpace(false));
      window.addEventListener('resize', U.raf(() => { brettRect = null; board.events.emit('view', board.view()); }));
      /* Das Rechteck merken heißt: wissen, wann es ungültig wird. Es hängt
         an der Größe des Bretts (der Beobachter meldet jede) und daran, wo
         es steht — das Fenster rollt zwar nicht, aber ein verrutschtes
         Rechteck legte jeden Klick daneben, und das Zuhören kostet nichts. */
      new ResizeObserver(() => { brettRect = null; }).observe(board.elBoard);
      window.addEventListener('scroll', () => { brettRect = null; }, true);

      board.apply();
    },

    /**
     * Das Rechteck des Bretts — gemerkt.
     *
     * Jede Umrechnung zwischen Bildschirm und Welt braucht es, und
     * `getBoundingClientRect()` ist ein LESEZUGRIFF auf das Layout: Steht
     * davor irgendwo ein Schreibzugriff, rechnet der Browser erst die ganze
     * Seite neu, bevor er antwortet. Auf einer Tafel mit 117 Kacheln kostet
     * ein solcher Lauf 4,3 ms — und beim Zeichnen der Pfeile wechselten sich
     * Messen und Schreiben munter ab. Das Rechteck ändert sich aber nur,
     * wenn sich das Brett ändert, und das meldet der ResizeObserver.
     */
    rect() {
      if (!brettRect) brettRect = board.elBoard.getBoundingClientRect();
      return brettRect;
    },

    /* ------------------------------------------------- Kamera / Ansicht */

    view() { return GD.store.doc.view; },
    scale() { return GD.store.doc.view.scale; },

    /**
     * Board-Transform + Raster neu setzen (rAF-gedrosselt).
     *
     * Das Rasterbild ist eine Zeichenkette mit zwei Verläufen darin. Sie bei
     * jedem Schwenkbild neu zuzuweisen heißt: Der Browser liest sie jedes
     * Mal neu ein, obwohl sich nur die VERSCHIEBUNG geändert hat — und die
     * steht in backgroundPosition. Das Bild selbst hängt allein am Maßstab.
     */
    apply: U.raf(function () {
      const v = GD.store.doc.view;
      board.elWorld.style.transform =
        'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.scale + ')';

      const g = GD.store.doc.grid;
      const minor = g.size * v.scale;
      const major = minor * 5;
      const st = board.elBoard.style;
      const grob = minor < 5;
      const raster = board.elBoard.classList.contains('show-grid');
      const kenn = minor.toFixed(3) + '|' + (grob ? (raster ? 'g' : 'a') : 'f');
      if (kenn !== letztesRaster) {
        letztesRaster = kenn;
        if (grob) {
          st.backgroundSize = major + 'px ' + major + 'px, ' + major + 'px ' + major + 'px';
          st.backgroundImage = raster
            ? 'linear-gradient(to right, var(--grid-strong) 1px, transparent 1px),' +
              'linear-gradient(to bottom, var(--grid-strong) 1px, transparent 1px)'
            : 'none';
        } else {
          st.backgroundImage = '';
          st.backgroundSize =
            minor + 'px ' + minor + 'px, ' + minor + 'px ' + minor + 'px, ' +
            major + 'px ' + major + 'px, ' + major + 'px ' + major + 'px';
        }
      }
      st.backgroundPosition = v.x + 'px ' + v.y + 'px';

      board.events.emit('view', v);
    }),

    /**
     * Kamera setzen — drei Zahlen, nicht ein Objekt.
     *
     * Der häufigste Fehlgriff von außen (Konsole, Skript, Automat) ist
     * `setView({x, y, scale})`. Bisher wurde daraus still `v.x = undefined`
     * → NaN, die Ansicht war fort, und der NaN landete beim nächsten
     * Autospeichern in der Datei — der Fehler tauchte erst Stunden später
     * und an ganz anderer Stelle auf. Deshalb: die Objektform annehmen,
     * alles andere laut zurückweisen.
     */
    setView(x, y, scale) {
      if (x !== null && typeof x === 'object') {
        const o = x;
        y = o.y; scale = (o.scale === undefined ? o.s : o.scale); x = o.x;
      }
      const nx = Number(x), ny = Number(y), ns = Number(scale);
      if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(ns)) {
        throw new TypeError('GD.board.setView(x, y, scale) braucht drei endliche Zahlen — bekommen: ' +
          JSON.stringify([x, y, scale]));
      }
      const v = GD.store.doc.view;
      v.x = nx; v.y = ny;
      v.scale = U.clamp(ns, MIN_SCALE, MAX_SCALE);
      board.apply();
      GD.store.touch();
    },

    panBy(dx, dy) {
      const v = GD.store.doc.view;
      board.setView(v.x + dx, v.y + dy, v.scale);
    },

    /** Zoomt so, dass der Punkt unter (clientX, clientY) stehen bleibt */
    zoomAt(clientX, clientY, factor) {
      const v = GD.store.doc.view;
      const target = U.clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      if (target === v.scale) return;
      const r = board.rect();
      const px = clientX - r.left, py = clientY - r.top;
      const wx = (px - v.x) / v.scale, wy = (py - v.y) / v.scale;
      board.setView(px - wx * target, py - wy * target, target);
    },

    zoomBy(factor) {
      const r = board.rect();
      board.zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
    },

    resetZoom() {
      const r = board.rect();
      const v = GD.store.doc.view;
      const cx = (r.width / 2 - v.x) / v.scale, cy = (r.height / 2 - v.y) / v.scale;
      board.setView(r.width / 2 - cx, r.height / 2 - cy, 1);
    },

    /** Alle Fenster (oder ein übergebenes Weltrechteck) einpassen */
    zoomToFit(rect, padding) {
      const r = board.rect();
      const b = rect || board.contentBounds();
      if (!b) { board.setView(r.width / 2, r.height / 2, 1); return; }
      const pad = padding === undefined ? 70 : padding;
      const scale = U.clamp(
        Math.min((r.width - pad * 2) / Math.max(b.w, 1), (r.height - pad * 2) / Math.max(b.h, 1)),
        MIN_SCALE, 1.6);
      board.setView(
        r.width / 2 - (b.x + b.w / 2) * scale,
        r.height / 2 - (b.y + b.h / 2) * scale,
        scale);
    },

    centerOn(wx, wy, scale) {
      const r = board.rect();
      const s = scale || GD.store.doc.view.scale;
      board.setView(r.width / 2 - wx * s, r.height / 2 - wy * s, s);
    },

    contentBounds() {
      const wins = GD.store.doc.windows;
      if (!wins.length) return null;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const w of wins) {
        x1 = Math.min(x1, w.x); y1 = Math.min(y1, w.y);
        x2 = Math.max(x2, w.x + w.w); y2 = Math.max(y2, w.y + (w.collapsed ? 32 : w.h));
      }
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    },

    /* ------------------------------------------------- Koordinatenwechsel */

    screenToWorld(clientX, clientY) {
      const r = board.rect();
      const v = GD.store.doc.view;
      return { x: (clientX - r.left - v.x) / v.scale, y: (clientY - r.top - v.y) / v.scale };
    },

    worldToScreen(wx, wy) {
      const v = GD.store.doc.view;
      return { x: wx * v.scale + v.x, y: wy * v.scale + v.y };
    },

    /** Mitte des sichtbaren Bereichs in Weltkoordinaten */
    viewCenter() {
      const r = board.rect();
      return board.screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
    },

    /** Sichtbares Weltrechteck */
    viewRect() {
      const r = board.rect();
      const a = board.screenToWorld(r.left, r.top);
      const b = board.screenToWorld(r.right, r.bottom);
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    },

    setGridVisible(on) {
      board.elBoard.classList.toggle('show-grid', !!on);
      GD.store.doc.grid.show = !!on;
      board.apply();
      GD.store.touch();
    }
  };

  /* --------------------------------------------------------- Eingaben */

  function isBackground(target) {
    return !target.closest('.gd-win, .conn-label, .conn-hit');
  }

  function onPointerDown(ev) {
    const middle = ev.button === 1;
    const left = ev.button === 0;
    if (!middle && !left) return;

    const background = isBackground(ev.target);
    const wantPan = middle || (left && board.spaceDown) || (left && background && !ev.shiftKey);
    const wantMarquee = left && background && ev.shiftKey && !board.spaceDown;

    if (wantPan) {
      const v = GD.store.doc.view;
      const x0 = v.x, y0 = v.y;
      board.elBoard.classList.add('is-panning');
      U.drag(ev, {
        onMove(dx, dy) { board.setView(x0 + dx, y0 + dy, v.scale); },
        onEnd(e, moved) {
          board.elBoard.classList.remove('is-panning');
          if (!moved && background && !middle) board.events.emit('background:click', e);
        }
      });
      return;
    }

    if (wantMarquee) {
      startMarquee(ev);
      return;
    }
  }

  function startMarquee(ev) {
    const r = board.rect();
    const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
    const box = board.elMarquee;
    box.style.display = 'block';
    U.drag(ev, {
      onMove(dx, dy) {
        const x = Math.min(sx, sx + dx), y = Math.min(sy, sy + dy);
        box.style.left = x + 'px';
        box.style.top = y + 'px';
        box.style.width = Math.abs(dx) + 'px';
        box.style.height = Math.abs(dy) + 'px';
      },
      onEnd(e, moved) {
        box.style.display = 'none';
        if (!moved) return;
        const a = board.screenToWorld(Math.min(ev.clientX, e.clientX), Math.min(ev.clientY, e.clientY));
        const b = board.screenToWorld(Math.max(ev.clientX, e.clientX), Math.max(ev.clientY, e.clientY));
        board.events.emit('marquee', { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, additive: e.shiftKey });
      }
    });
  }

  function onWheel(ev) {
    // Ein Modul darf Scrollen für sich beanspruchen (aktives Fenster, s. windows.js)
    const scroller = ev.target.closest && ev.target.closest('[data-gd-scroll]');
    if (scroller && !ev.ctrlKey && scroller.closest('.gd-win.is-selected')) {
      const canScroll = scroller.scrollHeight > scroller.clientHeight + 1;
      if (canScroll) {
        const atTop = scroller.scrollTop <= 0 && ev.deltaY < 0;
        const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1 && ev.deltaY > 0;
        if (!atTop && !atEnd) {
          scroller.scrollTop += ev.deltaY / GD.store.doc.view.scale;
          ev.preventDefault();
          return;
        }
      }
    }
    ev.preventDefault();
    const step = ev.deltaMode === 1 ? ev.deltaY * 18 : ev.deltaY;
    board.zoomAt(ev.clientX, ev.clientY, Math.pow(0.999, step));
  }

  function setSpace(on) {
    if (board.spaceDown === on) return;
    board.spaceDown = on;
    board.elBoard.classList.toggle('is-space', on);
  }

  function onKeyDown(ev) {
    if (ev.code === 'Space' && !U.isTyping(ev.target)) { setSpace(true); ev.preventDefault(); }
  }
  function onKeyUp(ev) {
    if (ev.code === 'Space') setSpace(false);
  }

  board.MIN_SCALE = MIN_SCALE;
  board.MAX_SCALE = MAX_SCALE;
  GD.board = board;
})();
