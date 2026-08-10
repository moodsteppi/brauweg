/* GameDesk — Pfeilverbindungen zwischen Fenstern
 *
 * Die Pfade liegen im Weltraum (skalieren mit dem Zoom), die Beschriftungen
 * in einer Bildschirm-Ebene darüber: dadurch bleibt die Schriftgröße beim
 * Zoomen konstant und ist pro Pfeil frei einstellbar.
 *
 * Gezeichnet wird im rechten Winkel (`curve: 'ortho'`, die Vorgabe). Ein
 * Pfeil verlässt seine Kante senkrecht, biegt höchstens zweimal ab und
 * trifft die Gegenkante wieder senkrecht — man sieht auf einen Blick, an
 * welchem Knopf er hängt und wo er ankommt. Bezier und Gerade bleiben für
 * ältere Tafeln erhalten.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;
  const OFF = 50000;
  const BAR_H = 34;                // s. windows.js
  const STUMMEL = 26;              // Weltmaß, das ein Pfeil senkrecht abrückt

  let layer = null, defs = null, labelLayer = null;
  let selectedId = null;
  let hoverId = null;
  let selBundle = null;
  let hoverBundle = null;
  const labelEls = new Map();
  const pathEls = new Map();
  const chipEls = new Map();
  const anim = new Map();          // Bündel-Id -> laufendes Auf-/Zuklappen

  const connections = {
    events: U.emitter(),

    init() {
      layer = document.getElementById('conn-layer');
      labelLayer = document.getElementById('label-layer');
      defs = U.svg('defs');
      layer.appendChild(defs);
      GD.board.events.on('view', connections.redraw);
      GD.board.events.on('background:click', () => {
        connections.select(null);
        if (selBundle) { selBundle = null; applySelectionClasses(); connections.events.emit('bundle', null); }
      });
    },

    /* ------------------------------------------------------------ Daten */

    add(fromWin, fromSide, toWin, toSide, fromShape, toShape) {
      if (fromWin === toWin && !(fromShape && toShape && fromShape !== toShape)) return null;
      const conn = {
        id: U.uid('con'),
        from: { win: fromWin, side: fromSide || 'auto', shape: fromShape || null },
        to: { win: toWin, side: toSide || 'auto', shape: toShape || null },
        label: '',
        labelSize: 12,
        t: null,                   // null = automatisch auf das längste Stück
        color: '#6ea8fe',
        width: 2,
        dash: 'solid',
        curve: 'ortho',
        heads: 'end'
      };
      GD.store.doc.connections.push(conn);
      connections.redraw();
      connections.select(conn.id);
      GD.store.commit('Verbindung erstellt');
      return conn;
    },

    remove(id) {
      const list = GD.store.doc.connections;
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) return;
      list.splice(i, 1);
      if (selectedId === id) selectedId = null;
      connections.redraw();
      GD.store.commit('Verbindung gelöscht');
      connections.events.emit('selection', null);
    },

    removeForWindow(winId, defer) {
      const list = GD.store.doc.connections;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].from.win === winId || list[i].to.win === winId) {
          if (list[i].id === selectedId) selectedId = null;
          list.splice(i, 1);
        }
      }
      if (!defer) connections.redraw();
    },

    update(id, patch, commitLabel) {
      const c = GD.store.doc.connections.find((x) => x.id === id);
      if (!c) return;
      Object.assign(c, patch);
      connections.redraw();
      if (commitLabel) GD.store.commit(commitLabel);
      else GD.store.touch();
    },

    select(id) {
      selectedId = id;
      if (id) { GD.windows.select([]); selBundle = null; }
      applySelectionClasses();
      connections.events.emit('selection', id ? GD.store.doc.connections.find((c) => c.id === id) : null);
    },

    /* ------------------------------------------------------------ Bündel */

    bundles() { return GD.store.doc.bundles || (GD.store.doc.bundles = []); },
    bundle(id) { return connections.bundles().find((b) => b.id === id) || null; },

    /** Neues Bündel aus diesen Verbindungen */
    addBundle(ids, name) {
      const liste = (ids || []).filter(Boolean);
      if (!liste.length) return null;
      const erste = GD.store.doc.connections.find((c) => c.id === liste[0]);
      const b = {
        id: U.uid('bnd'),
        name: name || 'Bündel',
        collapsed: true,
        color: (erste && erste.color) || '#8fa4c4',
        width: 2.5, spreizung: 11, laenge: 260, mitte: null
      };
      connections.bundles().push(b);
      for (const c of GD.store.doc.connections) if (liste.indexOf(c.id) >= 0) c.bundle = b.id;
      connections.redrawNow();
      GD.store.commit('Bündel angelegt');
      connections.selectBundle(b.id);
      return b;
    },

    updateBundle(id, patch, label) {
      const b = connections.bundle(id);
      if (!b) return;
      Object.assign(b, patch);
      connections.redrawNow();
      if (label) GD.store.commit(label); else GD.store.touch();
    },

    /** Auf- oder zuziehen — mit Weg, nicht als Sprung */
    toggleBundle(id) {
      const b = connections.bundle(id);
      if (!b) return;
      b.collapsed = !b.collapsed;
      tweene(b, b.collapsed ? 0 : 1);
      GD.store.commit(b.collapsed ? 'Bündel zugezogen' : 'Bündel aufgezogen');
      connections.events.emit('selection', null);
      connections.selectBundle(id);
    },

    /** Bündel auflösen; die Pfeile bleiben, sie laufen nur wieder einzeln */
    removeBundle(id) {
      const liste = connections.bundles();
      const i = liste.findIndex((b) => b.id === id);
      if (i < 0) return;
      liste.splice(i, 1);
      for (const c of GD.store.doc.connections) if (c.bundle === id) c.bundle = null;
      if (selBundle === id) selBundle = null;
      connections.redrawNow();
      GD.store.commit('Bündel aufgelöst');
      connections.events.emit('selection', null);
    },

    selectBundle(id) {
      selBundle = id;
      selectedId = null;
      if (id) GD.windows.select([]);
      applySelectionClasses();
      connections.events.emit('bundle', id ? connections.bundle(id) : null);
    },

    selectedBundle() { return selBundle ? connections.bundle(selBundle) : null; },

    /** Eine Ader von außen hervorheben (Liste im Inspector) */
    hoverConnection(id, an) {
      hoverId = an ? id : (hoverId === id ? null : hoverId);
      applySelectionClasses();
    },
    mitglieder(id) { return mitgliederVon(id); },

    selected() { return selectedId ? GD.store.doc.connections.find((c) => c.id === selectedId) || null : null; },
    selectedId() { return selectedId; },

    removeSelected() { if (selectedId) connections.remove(selectedId); },

    /* --------------------------------------------------------- Zeichnen */

    redraw: U.raf(function () { render(); }),
    redrawNow() { render(); }
  };

  /* ------------------------------------------------------------ Rendern */

  function render() {
    if (!layer) return;
    const doc = GD.store.doc;
    const scale = GD.board.scale();

    // Alles außer <defs> neu aufbauen (überschaubare Anzahl Verbindungen)
    while (layer.childNodes.length > 1) layer.removeChild(layer.lastChild);
    while (defs.firstChild) defs.removeChild(defs.firstChild);
    pathEls.clear();

    const seenLabels = new Set();
    const seenChips = new Set();

    /* Erst die Bündel: Sie legen den Weg ihrer Mitglieder fest, einzeln
       geroutet wird nur, was in keinem Bündel liegt. */
    const wege = new Map();          // conn.id -> geo
    for (const b of (doc.bundles || [])) {
      const mit = mitgliederVon(b.id);
      if (!mit.length) continue;
      const strang = buendelWege(b, mit);
      if (!strang) continue;
      for (const [id, geo] of strang.wege) wege.set(id, geo);
      zeichneStrang(b, strang, mit, scale);
      chip(b, strang, mit);
      seenChips.add(b.id);
    }

    for (const c of doc.connections) {
      const geo = wege.get(c.id) || (() => {
        const a = endpointRect(c.from), b = endpointRect(c.to);
        return a && b ? routeGeometry(a, b, c) : null;
      })();
      if (!geo) continue;

      const g = U.svg('g', {
        class: 'conn' + (c.id === selectedId ? ' is-selected' : '') + (c.bundle ? ' is-bundled' : ''),
        dataset: { id: c.id, bundle: c.bundle || '' }
      });
      g.setAttribute('data-id', c.id);
      if (c.bundle) g.setAttribute('data-bundle', c.bundle);

      const strokeW = Math.max(c.width, 1.1 / scale);
      const dash = dashArray(c.dash, strokeW);

      const markerEnd = c.heads === 'end' || c.heads === 'both' ? makeMarker(c, 'end') : null;
      const markerStart = c.heads === 'start' || c.heads === 'both' ? makeMarker(c, 'start') : null;

      const hit = U.svg('path', { class: 'conn-hit', d: geo.d, 'stroke-width': Math.max(14 / scale, strokeW * 3) });
      const path = U.svg('path', {
        class: 'conn-path', d: geo.d,
        stroke: c.color, 'stroke-width': strokeW,
        'stroke-dasharray': dash || null,
        'marker-end': markerEnd ? 'url(#' + markerEnd + ')' : null,
        'marker-start': markerStart ? 'url(#' + markerStart + ')' : null
      });

      g.append(hit, path);

      /* Hängt der Pfeil an einem einzelnen Element — einem Knopf im
         Wireframe —, bekommt sein Anfang einen Punkt. Ohne ihn ist bei
         mehreren Pfeilen aus derselben Kante nicht zu sehen, welcher zu
         welchem Knopf gehört. */
      if (c.from.shape) {
        g.appendChild(U.svg('circle', {
          class: 'conn-dot', cx: geo.start.x + OFF, cy: geo.start.y + OFF,
          r: Math.max(strokeW * 1.9, 3 / scale), fill: c.color
        }));
      }

      layer.appendChild(g);
      pathEls.set(c.id, path);

      hit.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        connections.select(c.id);
      });
      hit.addEventListener('dblclick', (ev) => { ev.stopPropagation(); startLabelEdit(c.id); });
      hit.addEventListener('pointerenter', () => { hoverId = c.id; applySelectionClasses(); });
      hit.addEventListener('pointerleave', () => { if (hoverId === c.id) { hoverId = null; applySelectionClasses(); } });

      updateLabel(c, path, geo);
      seenLabels.add(c.id);
    }

    for (const [id, el] of Array.from(labelEls)) {
      if (!seenLabels.has(id)) { el.remove(); labelEls.delete(id); }
    }
    for (const [id, el] of Array.from(chipEls)) {
      if (!seenChips.has(id)) { el.remove(); chipEls.delete(id); }
    }
    applySelectionClasses();
  }

  /* ======================================================== Bündel ===== */
  /*
   * Ein Bündel ist ein Stück gemeinsamer Weg.
   *
   * Seine Mitglieder behalten ihre eigenen Enden — sie laufen nur in der
   * Mitte nebeneinander durch denselben Kanal, wie Kabel in einem Strang.
   * Quer darüber liegen in Abständen Wickel; sie sind auch die Griffe, mit
   * denen sich der Strang auf- und zuziehen lässt.
   *
   * Zugeklappt rücken alle Adern auf die Achse zusammen und bekommen einen
   * Mantel — aus fünf Pfeilen wird eine Leitung mit einer Zahl daran.
   */

  function mitgliederVon(bundleId) {
    return GD.store.doc.connections.filter((c) => c.bundle === bundleId);
  }

  /** Wie weit die Adern gerade auseinanderstehen: 0 zugeklappt, 1 offen. */
  function oeffnung(b) {
    if (anim.has(b.id)) return anim.get(b.id).wert;
    return b.collapsed ? 0 : 1;
  }

  function tweene(b, ziel) {
    const start = oeffnung(b);
    if (Math.abs(ziel - start) < 0.001) return;
    const dauer = 220, t0 = performance.now();
    const eintrag = { wert: start, timer: null };
    anim.set(b.id, eintrag);
    const schritt = () => {
      const p = U.clamp((performance.now() - t0) / dauer, 0, 1);
      // ease-out, dieselbe Kurve wie im Blatt
      const e = 1 - Math.pow(1 - p, 3);
      eintrag.wert = start + (ziel - start) * e;
      if (p < 1) { eintrag.raf = requestAnimationFrame(schritt); connections.redrawNow(); }
      else { anim.delete(b.id); connections.redrawNow(); }
    };
    // Notausgang: Läuft kein rAF (verdeckter Tab), steht am Ende trotzdem das Ziel
    eintrag.timer = setTimeout(() => { anim.delete(b.id); connections.redrawNow(); }, dauer + 260);
    eintrag.raf = requestAnimationFrame(schritt);
  }

  /**
   * Kanal und Adern eines Bündels.
   * Der Kanal ist ein gerades Stück; seine Lage ergibt sich aus den Enden
   * der Mitglieder und lässt sich über `mitte` von Hand verschieben.
   */
  function buendelWege(b, mit) {
    const enden = [];
    for (const c of mit) {
      const ra = endpointRect(c.from), rb = endpointRect(c.to);
      if (!ra || !rb) continue;
      const sa = c.from.side === 'auto' ? autoSide(ra, rb) : c.from.side;
      const sb = c.to.side === 'auto' ? autoSide(rb, ra) : c.to.side;
      enden.push({ c, p1: anchor(ra, sa), p2: anchor(rb, sb), sa, sb });
    }
    if (!enden.length) return null;

    const mittel = (liste, feld) => liste.reduce((s, e) => s + e[feld], 0) / liste.length;
    const s = { x: mittel(enden.map((e) => e.p1), 'x'), y: mittel(enden.map((e) => e.p1), 'y') };
    const e2 = { x: mittel(enden.map((e) => e.p2), 'x'), y: mittel(enden.map((e) => e.p2), 'y') };
    const waag = Math.abs(e2.x - s.x) >= Math.abs(e2.y - s.y);
    const mitte = b.mitte || { x: (s.x + e2.x) / 2, y: (s.y + e2.y) / 2 };
    const halb = Math.max(30, b.laenge / 2);
    const vor = waag ? (e2.x >= s.x ? 1 : -1) : (e2.y >= s.y ? 1 : -1);
    const richtung = waag ? { x: vor, y: 0 } : { x: 0, y: vor };
    const senk = waag ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const A = { x: mitte.x - richtung.x * halb, y: mitte.y - richtung.y * halb };
    const B = { x: mitte.x + richtung.x * halb, y: mitte.y + richtung.y * halb };

    const auf = oeffnung(b);
    const n = enden.length;
    const spreiz = b.spreizung * auf;
    const seiteA = seiteVonNormale(-richtung.x, -richtung.y);
    const seiteB = seiteVonNormale(richtung.x, richtung.y);

    const wege = new Map();
    let spanne = 0;
    enden.forEach((e, i) => {
      const off = (i - (n - 1) / 2) * spreiz;
      spanne = Math.max(spanne, Math.abs(off));
      const ein = { x: A.x + senk.x * off, y: A.y + senk.y * off, nx: -richtung.x, ny: -richtung.y };
      const aus = { x: B.x + senk.x * off, y: B.y + senk.y * off, nx: richtung.x, ny: richtung.y };
      const teil1 = orthoPoints(e.p1, ein, e.sa, seiteA, stummel(e.c.from, e.p1, e.sa), 0);
      const teil2 = orthoPoints(aus, e.p2, seiteB, e.sb, 0, stummel(e.c.to, e.p2, e.sb));
      const pts = entdopple(teil1.concat(teil2));
      wege.set(e.c.id, {
        d: 'M' + pts.map((p) => (p.x + OFF) + ',' + (p.y + OFF)).join(' L'),
        start: e.p1, pts: pts
      });
    });

    return { A, B, richtung, senk, waag, mitte, spanne, auf, wege, anzahl: n };
  }

  function seiteVonNormale(nx, ny) {
    if (nx < -0.5) return 'l';
    if (nx > 0.5) return 'r';
    return ny < 0 ? 't' : 'b';
  }

  /** Mantel und Wickel — das Sichtbare am Strang */
  function zeichneStrang(b, st, mit, scale) {
    const g = U.svg('g', {
      class: 'bnd' + (b.id === selBundle ? ' is-selected' : '') + (st.auf < 0.5 ? ' is-zu' : ' is-auf'),
      dataset: { bundle: b.id }
    });
    g.setAttribute('data-bundle', b.id);

    const halbe = st.spanne + Math.max(3, b.width * 1.3);
    const px = (v) => v / scale;                     // Bildpunkte in Weltmaß

    /* Mantel: liegt HINTER den Adern und macht aus vielen Strichen eine
       Leitung. Zugeklappt ist er kräftig, offen nur noch ein Hauch. */
    const mantelBreite = st.auf < 1
      ? (halbe * 2 + Math.max(6, b.width * 2.2)) * (1 - st.auf) + halbe * 2 * st.auf
      : halbe * 2;
    g.appendChild(U.svg('path', {
      class: 'bnd-mantel',
      d: 'M' + (st.A.x + OFF) + ',' + (st.A.y + OFF) + ' L' + (st.B.x + OFF) + ',' + (st.B.y + OFF),
      stroke: b.color, 'stroke-width': Math.max(mantelBreite, px(6)),
      'stroke-linecap': 'round',
      opacity: 0.10 + 0.26 * (1 - st.auf)
    }));

    /* Wickel quer über den Strang. Sie sind zugleich der Griff: darauf
       tippen klappt auf und zu. */
    const laenge = Math.abs(st.B.x - st.A.x) + Math.abs(st.B.y - st.A.y);
    const anzahl = U.clamp(Math.round(laenge / 90), 2, 7);
    const dicke = Math.max(px(5), b.width * 1.6);
    for (let i = 1; i <= anzahl; i++) {
      const t = i / (anzahl + 1);
      const cx = st.A.x + (st.B.x - st.A.x) * t;
      const cy = st.A.y + (st.B.y - st.A.y) * t;
      const q1 = { x: cx - st.senk.x * (halbe + px(2)), y: cy - st.senk.y * (halbe + px(2)) };
      const q2 = { x: cx + st.senk.x * (halbe + px(2)), y: cy + st.senk.y * (halbe + px(2)) };
      g.appendChild(U.svg('path', {
        class: 'bnd-wickel',
        d: 'M' + (q1.x + OFF) + ',' + (q1.y + OFF) + ' L' + (q2.x + OFF) + ',' + (q2.y + OFF),
        stroke: b.color, 'stroke-width': dicke, 'stroke-linecap': 'round'
      }));
      const griff = U.svg('path', {
        class: 'bnd-griff',
        d: 'M' + (q1.x + OFF) + ',' + (q1.y + OFF) + ' L' + (q2.x + OFF) + ',' + (q2.y + OFF),
        'stroke-width': Math.max(dicke * 2.4, px(16))
      });
      griff.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        connections.selectBundle(b.id);
      });
      griff.addEventListener('dblclick', (ev) => { ev.stopPropagation(); connections.toggleBundle(b.id); });
      griff.addEventListener('pointerenter', () => { hoverBundle = b.id; applySelectionClasses(); });
      griff.addEventListener('pointerleave', () => { if (hoverBundle === b.id) { hoverBundle = null; applySelectionClasses(); } });
      g.appendChild(griff);
    }

    layer.appendChild(g);
  }

  /** Die Sprechblase am Strang: Name, Zahl, Auf-/Zuklappen, Verschieben */
  function chip(b, st, mit) {
    let el = chipEls.get(b.id);
    if (!el) {
      el = U.el('div', { class: 'bnd-chip', dataset: { bundle: b.id } });
      el.innerHTML = '<span class="bnd-chip__pfeil"></span>' +
        '<span class="bnd-chip__name"></span><span class="bnd-chip__zahl"></span>';
      labelLayer.appendChild(el);
      chipEls.set(b.id, el);

      el.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        connections.selectBundle(b.id);
        ziehStrang(b, ev);
      });
      el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); connections.toggleBundle(b.id); });
      el.addEventListener('pointerenter', () => { hoverBundle = b.id; applySelectionClasses(); });
      el.addEventListener('pointerleave', () => { if (hoverBundle === b.id) { hoverBundle = null; applySelectionClasses(); } });
    }
    el.querySelector('.bnd-chip__name').textContent = b.name;
    el.querySelector('.bnd-chip__zahl').textContent = st.anzahl;
    el.classList.toggle('is-zu', st.auf < 0.5);
    el.style.setProperty('--bnd-farbe', b.color);

    const s = GD.board.worldToScreen(st.mitte.x, st.mitte.y - (st.waag ? st.spanne + 22 : 0));
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';

    const sc = GD.board.scale();
    const sicht = b.id === selBundle || b.id === hoverBundle ? 1 : U.clamp((sc - 0.05) / 0.08, 0, 1);
    el.style.opacity = sicht;
    el.style.pointerEvents = sicht < 0.4 ? 'none' : 'auto';
  }

  /** Den Strang mit der Maus an eine andere Stelle legen */
  function ziehStrang(b, ev) {
    const start = b.mitte ? { x: b.mitte.x, y: b.mitte.y } : null;
    const p0 = GD.board.screenToWorld(ev.clientX, ev.clientY);
    U.drag(ev, {
      cursor: 'grabbing',
      onMove(dx, dy, e) {
        const p = GD.board.screenToWorld(e.clientX, e.clientY);
        if (!start) {
          const st = buendelWege(b, mitgliederVon(b.id));
          b.mitte = st ? { x: st.mitte.x, y: st.mitte.y } : { x: p.x, y: p.y };
        }
        b.mitte = { x: Math.round((start || b.mitte).x + (p.x - p0.x)), y: Math.round((start || b.mitte).y + (p.y - p0.y)) };
        connections.redrawNow();
      },
      onEnd(e, moved) { if (moved) GD.store.commit('Bündel verschoben'); }
    });
  }

  function makeMarker(c, which) {
    const id = 'ah_' + which + '_' + c.id;
    const marker = U.svg('marker', {
      id: id, viewBox: '0 0 8 8', refX: which === 'end' ? 7.2 : 0.8, refY: 4,
      markerWidth: 5, markerHeight: 5, orient: which === 'end' ? 'auto' : 'auto-start-reverse',
      markerUnits: 'strokeWidth'
    }, [U.svg('path', { d: 'M0.5,0.6 L7.5,4 L0.5,7.4 L2.1,4 Z', fill: c.color })]);
    defs.appendChild(marker);
    return id;
  }

  function dashArray(kind, w) {
    if (kind === 'dashed') return (w * 3.4) + ' ' + (w * 2.4);
    if (kind === 'dotted') return (w * 0.1) + ' ' + (w * 2.2);
    return null;
  }

  /* ------------------------------------------------------- Wegberechnung */

  /**
   * Rechteck eines Pfeilendes in Weltkoordinaten.
   *
   * Zeigt das Ende auf eine Form innerhalb eines Wireframes, liefert das
   * Modul deren Lage; sonst gilt der Fensterrahmen. Fehlt die Form (gelöscht,
   * Fenster eingeklappt), fällt der Pfeil sauber auf das Fenster zurück.
   */
  function endpointRect(ep) {
    const win = GD.store.getWindow(ep.win);
    if (!win) return null;
    if (ep.shape && !win.collapsed) {
      const rec = GD.windows.get(ep.win);
      if (rec && rec.inst && rec.inst.shapeAnchor) {
        const r = rec.inst.shapeAnchor(ep.shape);
        if (r && r.w >= 0 && r.h >= 0) return r;
      }
    }
    return { x: win.x, y: win.y, w: win.w, h: win.collapsed ? BAR_H : win.h };
  }

  function anchor(r, side) {
    switch (side) {
      case 't': return { x: r.x + r.w / 2, y: r.y, nx: 0, ny: -1 };
      case 'b': return { x: r.x + r.w / 2, y: r.y + r.h, nx: 0, ny: 1 };
      case 'l': return { x: r.x, y: r.y + r.h / 2, nx: -1, ny: 0 };
      case 'r': return { x: r.x + r.w, y: r.y + r.h / 2, nx: 1, ny: 0 };
      default: return null;
    }
  }

  /** Beste Seite, wenn 'auto': die zum Gegenüber zeigende */
  function autoSide(a, b) {
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
    const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    // Überlappungsfreie Achse bevorzugen
    const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
    const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
    if (gapX > -20 && gapX >= gapY) return dx > 0 ? 'r' : 'l';
    if (gapY > -20) return dy > 0 ? 'b' : 't';
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't');
  }

  /**
   * Rechtwinkliger Weg von p1 nach p2.
   *
   * Beide Enden rücken erst einen Stummel senkrecht von ihrer Kante ab —
   * sonst klebte der Pfeil an der Fensterwand und man sähe nicht, wo er
   * ansetzt. Dazwischen liegt je nach Kantenpaar ein L (eine Ecke) oder
   * ein Z (zwei Ecken); mehr braucht es nie. Gekrümmt wird nichts.
   */
  function orthoPoints(p1, p2, sa, sb, stubA, stubB) {
    const s = { x: p1.x + p1.nx * stubA, y: p1.y + p1.ny * stubA };
    const e = { x: p2.x + p2.nx * stubB, y: p2.y + p2.ny * stubB };
    const waag = (side) => side === 'l' || side === 'r';
    const mitte = [];

    if (waag(sa) && waag(sb)) {
      // Zeigen die Stummel aufeinander zu, teilt die Senkrechte in der Mitte
      // den Weg. Läuft der Pfeil zurück, würde diese Senkrechte durch beide
      // Fenster schneiden — dann wird waagerecht auf halber Höhe verbunden.
      const zu = (sa === 'r' && e.x >= s.x) || (sa === 'l' && e.x <= s.x);
      if (zu) { const mx = (s.x + e.x) / 2; mitte.push({ x: mx, y: s.y }, { x: mx, y: e.y }); }
      else { const my = (s.y + e.y) / 2; mitte.push({ x: s.x, y: my }, { x: e.x, y: my }); }
    } else if (!waag(sa) && !waag(sb)) {
      const zu = (sa === 'b' && e.y >= s.y) || (sa === 't' && e.y <= s.y);
      if (zu) { const my = (s.y + e.y) / 2; mitte.push({ x: s.x, y: my }, { x: e.x, y: my }); }
      else { const mx = (s.x + e.x) / 2; mitte.push({ x: mx, y: s.y }, { x: mx, y: e.y }); }
    } else if (waag(sa)) {
      mitte.push({ x: e.x, y: s.y });
    } else {
      mitte.push({ x: s.x, y: e.y });
    }

    return entdopple([p1, s].concat(mitte, [e, p2]));
  }

  /** Punkte auf einer Linie und Dubletten wegwerfen — sonst zappelt das Etikett */
  function entdopple(pts) {
    const out = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
      out.push({ x: p.x, y: p.y });
    }
    for (let i = out.length - 2; i > 0; i--) {
      const a = out[i - 1], b = out[i], c = out[i + 1];
      const gerade = (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) ||
                     (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5);
      if (gerade) out.splice(i, 1);
    }
    return out;
  }

  /**
   * Wie weit ein Ende senkrecht abrückt, bevor der Pfeil abbiegt.
   *
   * Hängt es an einer Form im Wireframe, reicht der übliche Stummel nicht:
   * Der Knick läge dann mitten im Fenster, und mit ihm das lange gerade
   * Stück, auf dem die Beschriftung steht. Ein Pfeil vom Knopf verlässt
   * deshalb erst sein Fenster und biegt dann ab.
   */
  function stummel(ep, p, side) {
    if (!ep.shape) return STUMMEL;
    const win = GD.store.getWindow(ep.win);
    if (!win || win.collapsed) return STUMMEL;
    const h = win.h;
    const raus = side === 'r' ? (win.x + win.w) - p.x
      : side === 'l' ? p.x - win.x
        : side === 'b' ? (win.y + h) - p.y
          : p.y - win.y;
    return Math.max(STUMMEL, raus + STUMMEL);
  }

  function routeGeometry(a, b, c) {
    const sa = c.from.side === 'auto' ? autoSide(a, b) : c.from.side;
    const sb = c.to.side === 'auto' ? autoSide(b, a) : c.to.side;
    const p1 = anchor(a, sa), p2 = anchor(b, sb);
    const x1 = p1.x + OFF, y1 = p1.y + OFF, x2 = p2.x + OFF, y2 = p2.y + OFF;

    if (c.curve === 'straight') {
      return { d: 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2, start: p1, pts: [p1, p2] };
    }

    if (c.curve === 'bezier') {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const pull = U.clamp(dist * 0.42, 40, 260);
      const c1x = x1 + p1.nx * pull, c1y = y1 + p1.ny * pull;
      const c2x = x2 + p2.nx * pull, c2y = y2 + p2.ny * pull;
      return {
        d: 'M' + x1 + ',' + y1 + ' C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + x2 + ',' + y2,
        start: p1, pts: null
      };
    }

    const pts = orthoPoints(p1, p2, sa, sb, stummel(c.from, p1, sa), stummel(c.to, p2, sb));
    const d = 'M' + pts.map((p) => (p.x + OFF) + ',' + (p.y + OFF)).join(' L');
    return { d: d, start: p1, pts: pts };
  }

  /** Liegt dieser Punkt über keiner Kachel? Rahmen zählen nicht mit. */
  function freiePlatte(p) {
    for (const w of GD.store.doc.windows) {
      if (w.type === 'frame') continue;
      const h = w.collapsed ? BAR_H : w.h;
      if (p.x > w.x && p.x < w.x + w.w && p.y > w.y && p.y < w.y + h) return false;
    }
    return true;
  }

  /**
   * Wo die Beschriftung steht: auf dem längsten geraden Stück, das
   * NEBEN den Kacheln verläuft.
   *
   * Die Beschriftung behält beim Zoomen ihre Pixelgröße — weit
   * herausgezoomt ist sie also größer als die Kachel, die sie erklärt.
   * Deshalb reicht „längstes Stück" nicht: Läge das mitten zwischen zwei
   * gestapelten Kacheln, deckte die Beschriftung deren Text zu. Erst wenn
   * gar kein Stück im Freien liegt, gilt wieder das längste.
   */
  function langstesStueck(pts, breite) {
    let best = null, bestLen = -1;
    let frei = null, freiLen = -1;
    let passt = null, passtLen = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
      const mitte = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
      if (len > bestLen) { bestLen = len; best = mitte; }
      if (!freiePlatte(mitte)) continue;
      if (len > freiLen) { freiLen = len; frei = mitte; }
      // Nur waagerechte Stücke tragen die Beschriftung in voller Breite;
      // auf einem senkrechten steht sie quer und ragt links und rechts aus.
      const traegt = Math.abs(pts[i + 1].y - pts[i].y) < 0.5 ? len : len * 0.35;
      if (traegt >= breite && len > passtLen) { passtLen = len; passt = mitte; }
    }
    return passt || frei || best;
  }

  /* ------------------------------------------------------ Beschriftungen */

  function updateLabel(c, pathEl, geo) {
    let el = labelEls.get(c.id);
    if (!el) {
      el = U.el('div', { class: 'conn-label', dataset: { id: c.id }, spellcheck: false });
      el.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0 || el.isContentEditable) return;
        ev.stopPropagation();
        connections.select(c.id);
        dragLabel(c, ev);
      });
      el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); startLabelEdit(c.id); });
      labelLayer.appendChild(el);
      labelEls.set(c.id, el);
    }
    if (!el.isContentEditable) {
      el.textContent = c.label || '＋';
      el.classList.toggle('is-empty', !c.label);
    }
    el.style.fontSize = (c.labelSize || 12) + 'px';
    el.style.borderColor = c.id === selectedId ? c.color : '';

    /* Weit herausgezoomt liegen die Beschriftungen sonst übereinander: Sie
       behalten ihre Pixelgröße, der Abstand zwischen den Pfeilen aber nicht.
       Ausgeblendet wird nur die Anzeige — Größe und Text bleiben unberührt. */
    const sc = GD.board.scale();
    const fade = c.id === selectedId || c.id === hoverId
      ? 1 : U.clamp((sc - 0.16) / 0.16, 0, 1);
    el.style.opacity = fade;
    el.style.pointerEvents = fade < 0.4 ? 'none' : 'auto';

    /* Ohne eigenes t sitzt die Beschriftung in der Mitte des längsten
       geraden Stücks. Bei einem Pfeil vom Knopf zur Wirkung ist das die
       lange Strecke zwischen den beiden Fenstern — die Beschriftung deckt
       damit weder den Knopf noch die Notiz zu. Erst wer sie anfasst, legt
       mit t eine eigene Stelle fest. */
    const t = c.t;
    let pt = null;
    if ((t === undefined || t === null) && geo && geo.pts) {
      const m = langstesStueck(geo.pts, (el.offsetWidth + 10) / Math.max(sc, 0.01));
      if (m) pt = { x: m.x + OFF, y: m.y + OFF };
    }
    if (!pt) {
      try {
        const len = pathEl.getTotalLength();
        pt = pathEl.getPointAtLength(len * U.clamp(t === undefined || t === null ? 0.5 : t, 0, 1));
      } catch (e) { pt = { x: OFF, y: OFF }; }
    }
    const s = GD.board.worldToScreen(pt.x - OFF, pt.y - OFF);
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';
  }

  function startLabelEdit(id) {
    const c = GD.store.doc.connections.find((x) => x.id === id);
    const el = labelEls.get(id);
    if (!c || !el) return;
    connections.select(id);
    el.textContent = c.label;
    el.contentEditable = 'true';
    el.classList.remove('is-empty');
    el.focus();
    document.getSelection().selectAllChildren(el);

    const finish = (save) => {
      el.contentEditable = 'false';
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('keydown', onKey);
      if (save) {
        const next = el.textContent.replace(/\s+$/, '');
        if (next !== c.label) { c.label = next; GD.store.commit('Beschriftung geändert'); }
      }
      connections.redraw();
    };
    const onBlur = () => finish(true);
    const onKey = (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); el.blur(); }
      if (ev.key === 'Escape') { el.textContent = c.label; finish(false); }
    };
    el.addEventListener('blur', onBlur);
    el.addEventListener('keydown', onKey);
  }

  /** Beschriftung entlang des Pfades verschieben */
  function dragLabel(c, ev) {
    const pathEl = pathEls.get(c.id);
    if (!pathEl) return;
    const len = pathEl.getTotalLength();
    U.drag(ev, {
      cursor: 'grabbing',
      onMove(dx, dy, e) {
        const p = GD.board.screenToWorld(e.clientX, e.clientY);
        let best = 0.5, bestD = Infinity;
        for (let i = 0; i <= 60; i++) {
          const pt = pathEl.getPointAtLength(len * (i / 60));
          const d = Math.hypot(pt.x - OFF - p.x, pt.y - OFF - p.y);
          if (d < bestD) { bestD = d; best = i / 60; }
        }
        c.t = best;
        connections.redraw();
      },
      onEnd(e, moved) { if (moved) GD.store.commit('Beschriftung verschoben'); }
    });
  }

  function applySelectionClasses() {
    for (const [id, el] of labelEls) {
      const active = id === selectedId || id === hoverId;
      el.classList.toggle('is-selected', id === selectedId);
      el.style.display = (el.classList.contains('is-empty') && !active) ? 'none' : '';
    }
    for (const g of layer.querySelectorAll('.conn')) {
      const eigen = g.dataset.id === selectedId;
      const imBund = g.dataset.bundle && (g.dataset.bundle === selBundle || g.dataset.bundle === hoverBundle);
      g.classList.toggle('is-selected', eigen);
      /* Das ganze Bündel hebt sich mit: Wer den Strang anfasst, soll sehen,
         welche Adern darin liegen. */
      g.classList.toggle('is-hervor', !!imBund);
    }
    for (const g of layer.querySelectorAll('.bnd')) {
      const id = g.dataset.bundle;
      g.classList.toggle('is-selected', id === selBundle);
      g.classList.toggle('is-hover', id === hoverBundle);
    }
    for (const [id, el] of chipEls) {
      el.classList.toggle('is-selected', id === selBundle);
      el.classList.toggle('is-hover', id === hoverBundle);
    }
  }

  /* --------------------------------------------------- Pfeil aufziehen */

  connections.beginLink = function (winId, side, ev, shapeId) {
    const boardEl = GD.board.elBoard;
    boardEl.classList.add('is-linking');
    const fromRect = endpointRect({ win: winId, side: side, shape: shapeId || null });
    if (!fromRect) return;
    const a = anchor(fromRect, side === 'auto' ? (shapeId ? 'r' : 'r') : side);

    const temp = U.svg('path', {
      class: 'conn-path',
      stroke: 'var(--accent)', 'stroke-width': Math.max(2, 2 / GD.board.scale()),
      'stroke-dasharray': (6 / GD.board.scale()) + ' ' + (5 / GD.board.scale()), fill: 'none'
    });
    layer.appendChild(temp);
    let dropRec = null, dropShapeEl = null;

    U.drag(ev, {
      cursor: 'crosshair',
      onMove(dx, dy, e) {
        const p = GD.board.screenToWorld(e.clientX, e.clientY);
        // Vorschau im selben rechten Winkel, in dem der Pfeil danach liegt
        const s = { x: a.x + a.nx * STUMMEL, y: a.y + a.ny * STUMMEL };
        const ecke = (a.nx !== 0) ? { x: p.x, y: s.y } : { x: s.x, y: p.y };
        const pts = entdopple([a, s, ecke, p]);
        temp.setAttribute('d', 'M' + pts.map((q) => (q.x + OFF) + ',' + (q.y + OFF)).join(' L'));

        const under = document.elementFromPoint(e.clientX, e.clientY);
        const winEl = under && under.closest ? under.closest('.gd-win') : null;
        // Eine Form im eigenen Fenster ist ein gültiges Ziel, das Fenster selbst nicht
        const shapeEl = under && under.closest ? under.closest('.wf-shape') : null;
        const rec = winEl && (winEl.dataset.id !== winId || shapeEl) ? GD.windows.get(winEl.dataset.id) : null;
        if (dropRec !== rec) {
          if (dropRec) dropRec.el.classList.remove('is-drop-target');
          dropRec = rec;
          if (dropRec) dropRec.el.classList.add('is-drop-target');
        }
        if (dropShapeEl !== shapeEl) {
          if (dropShapeEl) dropShapeEl.classList.remove('is-drop-shape');
          dropShapeEl = shapeEl;
          if (dropShapeEl) dropShapeEl.classList.add('is-drop-shape');
        }
      },
      onEnd(e) {
        temp.remove();
        boardEl.classList.remove('is-linking');
        if (dropShapeEl) dropShapeEl.classList.remove('is-drop-shape');
        if (dropRec) {
          dropRec.el.classList.remove('is-drop-target');
          const under = document.elementFromPoint(e.clientX, e.clientY);
          const portSide = under && under.closest && under.closest('.gd-port');
          const targetShape = dropShapeEl ? dropShapeEl.dataset.id : null;
          connections.add(winId, side, dropRec.data.id,
            portSide ? portSide.dataset.side : 'auto', shapeId || null, targetShape);
        }
      }
    });
  };

  connections.editLabel = startLabelEdit;
  GD.connections = connections;
})();
