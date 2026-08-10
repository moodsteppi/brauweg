/* GameDesk — Fensterverwaltung: erzeugen, bewegen, skalieren, einrasten, auswählen */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;
  const OFF = 50000;               // Versatz der Overlay-SVGs (s. app.css)
  const MIN_W = 180, MIN_H = 90;
  const BAR_H = 34;                // Titelleiste (32) + Rahmen oben/unten

  const live = new Map();          // id -> { data, el, body, inst, def }
  let selection = new Set();
  let activeId = null;

  const windows = {
    events: U.emitter(),
    layer: null,

    init() {
      windows.layer = document.getElementById('win-layer');
      windows.guides = document.getElementById('guide-layer');
      windows.frameLayer = document.getElementById('frame-layer');
      GD.board.events.on('background:click', () => windows.select([]));
      GD.board.events.on('marquee', (rect) => selectInRect(rect, rect.additive));
      GD.board.events.on('view', (v) => {
        for (const rec of live.values()) if (rec.inst && rec.inst.onZoom) rec.inst.onZoom(v.scale);
      });
    },

    /* --------------------------------------------------------- Anlegen */

    /** Neues Fenster eines Modultyps an Weltposition (zentriert) */
    add(type, wx, wy, opts) {
      const def = GD.modules.get(type) || GD.modules.fallback(type);
      const o = opts || {};
      const size = o.size || def.defaultSize;
      const data = {
        id: U.uid('win'),
        type: type,
        title: o.title || def.defaultTitle || def.label,
        x: Math.round((wx === undefined ? GD.board.viewCenter().x : wx) - (o.centered === false ? 0 : size.w / 2)),
        y: Math.round((wy === undefined ? GD.board.viewCenter().y : wy) - (o.centered === false ? 0 : size.h / 2)),
        w: size.w, h: size.h,
        z: 1,
        accent: o.accent || null,
        collapsed: false,
        state: o.state
      };
      GD.store.bumpZ(data);
      GD.store.doc.windows.push(data);
      windows.mount(data);
      windows.select([data.id]);
      GD.store.commit('Modul „' + def.label + '" hinzugefügt');
      windows.events.emit('changed');
      return data;
    },

    /** DOM + Modulinstanz für einen Datensatz erzeugen */
    mount(data) {
      const def = GD.modules.get(data.type) || GD.modules.fallback(data.type);
      const accent = data.accent || def.accent;

      const el = U.el('div', { class: 'gd-win', dataset: { id: data.id, type: data.type } });
      el.style.setProperty('--win-accent', accent);

      const title = U.el('div', {
        class: 'gd-win__title', contentEditable: 'false', spellcheck: false, text: data.title,
        title: 'Klick zum Umbenennen'
      });

      const tools = U.el('div', { class: 'gd-win__tools' });
      const bar = U.el('div', { class: 'gd-win__bar' }, [
        U.el('span', { class: 'gd-win__dot' }),
        U.el('span', { class: 'gd-win__icon', text: def.icon }),
        title, tools
      ]);

      const btnCollapse = U.el('button', { class: 'gd-win__btn', title: 'Ein-/Ausklappen', text: '▾' });
      const btnClose = U.el('button', { class: 'gd-win__btn gd-win__btn--close', title: 'Schließen', text: '✕' });
      tools.append(btnCollapse, btnClose);

      const body = U.el('div', { class: 'gd-win__body' });
      el.append(bar, body);

      for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
        el.appendChild(U.el('div', { class: 'gd-win__handle', dataset: { dir: dir } }));
      }
      for (const side of ['t', 'r', 'b', 'l']) {
        el.appendChild(U.el('div', { class: 'gd-port', dataset: { side: side, win: data.id } }));
      }

      windows.layer.appendChild(el);

      const rec = { data: data, el: el, body: body, def: def, inst: null, overlay: null };
      live.set(data.id, rec);
      applyGeometry(rec);

      /* Der Rahmen zeigt seinen Titel als Wasserzeichen — er muss beim Tippen
         mitlaufen, nicht erst nach dem nächsten Neuzeichnen. */
      function titelGemeldet(t) {
        if (rec.inst && rec.inst.onTitle) { try { rec.inst.onTitle(t); } catch (e) { console.warn(e); } }
      }
      // über rec.data, nicht über das hier eingefangene data: reconcile()
      // hängt nach Rückgängig einen frischen Datensatz ein
      rec.setTitle = (t) => { rec.data.title = t; title.textContent = t; titelGemeldet(t); };

      /* ---- Modul instanziieren ---- */
      const ctx = {
        id: data.id,
        state: data.state,
        win: {
          get: () => rec.data,
          setTitle(t) { rec.setTitle(t); },
          setSize(w, h) {
            data.w = Math.max(MIN_W, w); data.h = Math.max(MIN_H, h);
            applyGeometry(rec); notifyResize(rec);
          },
          select() { windows.select([data.id]); }
        },
        changed() { GD.store.save(); },
        commit(label) { GD.store.commit(label); },
        refreshInspector() { if (activeId === data.id) windows.events.emit('selection', windows.selection()); },
        toast(msg, kind) { GD.ui && GD.ui.toast(msg, kind); },
        board: GD.board
      };

      try {
        rec.inst = def.create(ctx) || {};
      } catch (err) {
        console.error('[GD] Modul „' + data.type + '" konnte nicht starten:', err);
        rec.inst = { el: U.el('div', { class: 'mod-missing' }, [U.el('strong', { text: 'Fehler beim Laden des Moduls' }), U.el('pre', { text: String(err && err.message || err) })]) };
      }
      if (rec.inst.el) body.appendChild(rec.inst.el);
      /* Über die Kacheln gelegtes Beiwerk (Rahmenüberschrift) */
      if (rec.inst.overlayEl) {
        const ov = rec.inst.overlayEl();
        if (ov) {
          rec.overlay = ov;
          ov.dataset.win = data.id;
          windows.frameLayer.appendChild(ov);
          applyGeometry(rec);
        }
      }
      if (rec.inst.headerTools) {
        const extra = rec.inst.headerTools() || [];
        for (const b of extra) tools.insertBefore(b, btnCollapse);
      }

      /* ---- Interaktion ---- */
      el.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0 && ev.button !== 2) return;
        bringToFront(rec);
        if (!selection.has(data.id)) windows.select([data.id], ev.shiftKey);
        else if (ev.shiftKey && ev.target.closest('.gd-win__bar')) windows.select([data.id], true);
        else activate(data.id);
      }, true);

      /**
       * Ziehen an der Leiste verschiebt, ein Klick auf den Text benennt um.
       * Was von beidem gemeint war, steht erst am Ende fest — also immer
       * startMove(), und beim Loslassen ohne Bewegung in die Eingabe gehen.
       */
      bar.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest('button') || title.isContentEditable) return;
        startMove(rec, ev, ev.target === title ? umbenennen : null);
      });
      bar.addEventListener('dblclick', (ev) => {
        if (ev.target === title || ev.target.closest('button')) return;
        windows.setCollapsed(data.id, !data.collapsed);
      });

      function umbenennen() {
        title.contentEditable = 'true';
        title.focus();
        const sel = document.getSelection();
        if (sel) sel.selectAllChildren(title);
      }

      title.addEventListener('input', () => titelGemeldet(title.textContent));
      title.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); title.blur(); }
        if (ev.key === 'Escape') { title.textContent = data.title; title.blur(); }
        ev.stopPropagation();
      });
      title.addEventListener('blur', () => {
        title.contentEditable = 'false';
        const next = title.textContent.trim() || def.label;
        const geaendert = next !== data.title;
        rec.setTitle(next);              // auch bei Abbruch: setzt das Wasserzeichen zurück
        if (geaendert) GD.store.commit('Fenster umbenannt');
      });

      btnCollapse.addEventListener('click', () => windows.setCollapsed(data.id, !data.collapsed));
      btnClose.addEventListener('click', () => windows.remove(data.id));

      el.addEventListener('pointerdown', (ev) => {
        const handle = ev.target.closest('.gd-win__handle');
        if (handle && ev.button === 0) startResize(rec, handle.dataset.dir, ev);
        const port = ev.target.closest('.gd-port');
        if (port && ev.button === 0) {
          ev.stopPropagation();
          GD.connections.beginLink(data.id, port.dataset.side, ev);
        }
      });

      if (data.collapsed) el.classList.add('is-collapsed');
      notifyResize(rec);
      return rec;
    },

    /* -------------------------------------------------------- Entfernen */

    remove(id) {
      const rec = live.get(id);
      if (!rec) return;
      GD.connections.removeForWindow(id);
      unmount(rec);
      const list = GD.store.doc.windows;
      const i = list.findIndex((w) => w.id === id);
      if (i >= 0) list.splice(i, 1);
      selection.delete(id);
      if (activeId === id) activeId = null;
      GD.store.commit('Fenster gelöscht');
      windows.events.emit('selection', windows.selection());
      windows.events.emit('changed');
    },

    removeSelected() {
      const ids = Array.from(selection);
      if (!ids.length) return;
      for (const id of ids) {
        const rec = live.get(id);
        if (!rec) continue;
        GD.connections.removeForWindow(id, true);
        unmount(rec);
        const list = GD.store.doc.windows;
        const i = list.findIndex((w) => w.id === id);
        if (i >= 0) list.splice(i, 1);
      }
      selection.clear();
      activeId = null;
      GD.connections.redraw();
      GD.store.commit(ids.length > 1 ? ids.length + ' Fenster gelöscht' : 'Fenster gelöscht');
      windows.events.emit('selection', windows.selection());
      windows.events.emit('changed');
    },

    duplicate(id) {
      const rec = live.get(id);
      if (!rec) return null;
      windows.syncStates();
      const copy = U.clone(rec.data);
      copy.id = U.uid('win');
      copy.x += 28; copy.y += 28;
      copy.title = rec.data.title + ' (Kopie)';
      GD.store.bumpZ(copy);
      GD.store.doc.windows.push(copy);
      windows.mount(copy);
      windows.select([copy.id]);
      GD.store.commit('Fenster dupliziert');
      windows.events.emit('changed');
      return copy;
    },

    /* ------------------------------------------------------ Eigenschaften */

    setCollapsed(id, on) {
      const rec = live.get(id);
      if (!rec) return;
      rec.data.collapsed = !!on;
      rec.el.classList.toggle('is-collapsed', !!on);
      applyGeometry(rec);
      GD.connections.redraw();
      GD.store.commit(on ? 'Fenster eingeklappt' : 'Fenster ausgeklappt');
    },

    setTitle(id, text) {
      const rec = live.get(id);
      if (rec) rec.setTitle(String(text));
    },

    setAccent(id, color) {
      const rec = live.get(id);
      if (!rec) return;
      rec.data.accent = color;
      rec.el.style.setProperty('--win-accent', color || rec.def.accent);
      GD.store.commit('Fensterfarbe geändert');
    },

    setGeometry(id, patch, commitLabel) {
      const rec = live.get(id);
      if (!rec) return;
      Object.assign(rec.data, patch);
      rec.data.w = Math.max(MIN_W, rec.data.w);
      rec.data.h = Math.max(MIN_H, rec.data.h);
      applyGeometry(rec);
      notifyResize(rec);
      GD.connections.redraw();
      if (commitLabel) GD.store.commit(commitLabel);
    },

    bringToFront(id) { const rec = live.get(id); if (rec) { bringToFront(rec); GD.store.commit('In den Vordergrund'); } },

    sendToBack(id) {
      const rec = live.get(id);
      if (!rec) return;
      const gruppe = [rec.data].concat(begleiter(rec));
      const mitgenommen = new Set(gruppe.map((d) => d.id));

      for (const band of [true, false]) {
        const mit = gruppe.filter((d) => (d.type === 'frame') === band).sort(nachZ);
        if (!mit.length) continue;
        const rest = GD.store.doc.windows.filter((w) => (w.type === 'frame') === band && !mitgenommen.has(w.id));
        const unterste = rest.length ? Math.min.apply(null, rest.map(zWert)) : 1;
        mit.forEach((d, i) => { d.z = unterste - mit.length + i; });
        neuNummerieren(band);
      }
      GD.store.commit('In den Hintergrund');
    },

    /* --------------------------------------------------------- Auswahl */

    select(ids, additive) {
      const next = additive ? new Set(selection) : new Set();
      for (const id of ids) {
        if (additive && next.has(id)) next.delete(id);
        else next.add(id);
      }
      selection = next;
      for (const rec of live.values()) rec.el.classList.toggle('is-selected', selection.has(rec.data.id));
      const arr = Array.from(selection);
      activeId = arr.length === 1 ? arr[0] : null;
      for (const rec of live.values()) {
        if (rec.inst && rec.inst.onSelect) rec.inst.onSelect(selection.has(rec.data.id));
      }
      if (ids.length) GD.connections.select(null);
      windows.events.emit('selection', windows.selection());
    },

    selectAll() { windows.select(GD.store.doc.windows.map((w) => w.id)); },

    selection() { return Array.from(selection).map((id) => live.get(id)).filter(Boolean).map((r) => r.data); },
    selectionIds() { return Array.from(selection); },
    activeId() { return activeId; },
    activeInstance() { const rec = activeId ? live.get(activeId) : null; return rec ? rec.inst : null; },

    get(id) { return live.get(id) || null; },
    all() { return Array.from(live.values()); },

    /* ------------------------------------------------------ Persistenz */

    /** Modulzustände in das Dokument zurückschreiben */
    syncStates() {
      for (const rec of live.values()) {
        if (rec.inst && typeof rec.inst.getState === 'function') {
          try { rec.data.state = rec.inst.getState(); }
          catch (err) { console.warn('[GD] getState() fehlgeschlagen für', rec.data.type, err); }
        }
      }
    },

    /** Alles neu aufbauen (Laden / Import / Neues Board) */
    rebuild() {
      for (const rec of Array.from(live.values())) unmount(rec);
      live.clear();
      selection.clear();
      activeId = null;
      for (const data of GD.store.doc.windows) windows.mount(data);
      windows.events.emit('selection', []);
      windows.events.emit('changed');
    },

    /**
     * Nach Undo/Redo: Struktur angleichen, laufende Module möglichst erhalten.
     * Fenster mit gleicher ID behalten ihre Instanz und bekommen den Zustand
     * aus dem Schnappschuss nur dann, wenn er sich unterscheidet.
     */
    reconcile() {
      const wanted = new Map(GD.store.doc.windows.map((w) => [w.id, w]));
      for (const rec of Array.from(live.values())) {
        if (!wanted.has(rec.data.id)) { unmount(rec); live.delete(rec.data.id); selection.delete(rec.data.id); }
      }
      for (const data of GD.store.doc.windows) {
        const rec = live.get(data.id);
        if (!rec) { windows.mount(data); continue; }
        rec.data = data;
        rec.el.style.setProperty('--win-accent', data.accent || rec.def.accent);
        rec.setTitle(data.title);
        rec.el.classList.toggle('is-collapsed', !!data.collapsed);
        applyGeometry(rec);
        if (rec.inst && rec.inst.setState) {
          const current = rec.inst.getState ? JSON.stringify(rec.inst.getState()) : null;
          const target = JSON.stringify(data.state === undefined ? null : data.state);
          if (current !== target) { try { rec.inst.setState(U.clone(data.state)); } catch (e) { console.warn(e); } }
        }
        notifyResize(rec);
      }
      activeId = selection.size === 1 ? Array.from(selection)[0] : null;
      for (const rec of live.values()) rec.el.classList.toggle('is-selected', selection.has(rec.data.id));
      windows.events.emit('selection', windows.selection());
      windows.events.emit('changed');
    }
  };

  /* ------------------------------------------------------------ intern */

  function unmount(rec) {
    if (rec.inst && rec.inst.destroy) { try { rec.inst.destroy(); } catch (e) { console.warn(e); } }
    if (rec.overlay) { rec.overlay.remove(); rec.overlay = null; }
    rec.el.remove();
    live.delete(rec.data.id);
  }

  /**
   * Stapelhöhe eines Fensters.
   *
   * Rahmen liegen in einem eigenen, tieferen Band: Ein Rahmen kann seinen
   * Inhalt damit gar nicht verdecken, egal was mit seinem z passiert. Ohne
   * diese Trennung schob ein Klick auf die Rahmenleiste den Rahmen über die
   * Kacheln, die darin liegen.
   */
  // z darf beim Nach-hinten-Schieben auf 0 oder darunter gehen — also nicht
  // mit || abfangen, das machte aus einer 0 eine 1 und riss die Ordnung ein
  const zWert = (d) => (Number.isFinite(d.z) ? d.z : 1);
  const nachZ = (a, b) => zWert(a) - zWert(b);

  function zVon(d) {
    return (d.type === 'frame' ? 0 : 100000) + Math.max(1, Math.min(99999, zWert(d)));
  }

  function applyGeometry(rec) {
    const d = rec.data;
    const s = rec.el.style;
    s.left = d.x + 'px';
    s.top = d.y + 'px';
    s.width = d.w + 'px';
    s.height = d.collapsed ? 'auto' : d.h + 'px';
    s.zIndex = String(zVon(d));

    /* Ein Modul darf ein Stück von sich über die Kacheln legen (der Rahmen
       tut das mit seiner Überschrift). Es hängt in einer eigenen Ebene und
       wird hier — der einzigen Stelle, an der Geometrie gesetzt wird — an
       das Fenster geführt. */
    if (rec.overlay) {
      const o = rec.overlay.style;
      o.left = d.x + 'px';
      o.top = d.y + 'px';
      o.width = d.w + 'px';
      o.height = (d.collapsed ? BAR_H : d.h) + 'px';
      rec.overlay.classList.toggle('is-eingeklappt', !!d.collapsed);
    }
  }

  function notifyResize(rec) {
    if (rec.inst && rec.inst.onResize) {
      U.nextFrame(() => {
        const r = rec.body.getBoundingClientRect();
        const sc = GD.board.scale() || 1;
        try { rec.inst.onResize(r.width / sc, r.height / sc); } catch (e) { console.warn(e); }
      });
    }
  }

  function applyZ(d) {
    const rec = live.get(d.id);
    if (rec) rec.el.style.zIndex = String(zVon(d));
  }

  /**
   * Fenster, die mit diesem zusammen die Stapelhöhe wechseln — bei einem
   * Rahmen sein Inhalt. Sonst holte man den Rahmen zwar über den Nachbarn,
   * seine Kacheln blieben aber unter dessen Kacheln liegen.
   */
  function begleiter(rec) {
    if (!rec.inst || !rec.inst.dragCompanions) return [];
    const out = [];
    for (const id of rec.inst.dragCompanions()) {
      const d = GD.store.getWindow(id);
      if (d) out.push(d);
    }
    return out.sort(nachZ);          // aufsteigend: Reihenfolge untereinander bleibt
  }

  /** Steht die Gruppe in ihrem Band schon ganz oben? Dann nichts anfassen. */
  function schonOben(gruppe) {
    const drin = new Set(gruppe.map((d) => d.id));
    for (const d of gruppe) {
      const band = d.type === 'frame';
      for (const w of GD.store.doc.windows) {
        if (drin.has(w.id) || (w.type === 'frame') !== band) continue;
        if (zWert(w) > zWert(d)) return false;
      }
    }
    return true;
  }

  /**
   * z eines Bandes lückenlos von 1 an neu vergeben. Nötig, weil „nach hinten"
   * sonst immer weiter unter 1 rutscht — und zVon() presst alles darunter auf
   * denselben Wert, womit die Reihenfolge verloren wäre.
   */
  function neuNummerieren(band) {
    const liste = GD.store.doc.windows.filter((w) => (w.type === 'frame') === band).sort(nachZ);
    liste.forEach((w, i) => { w.z = i + 1; applyZ(w); });
  }

  /** Nach vorn — aber nur innerhalb des eigenen Bandes (Rahmen bleiben hinten) */
  function bringToFront(rec) {
    const gruppe = [rec.data].concat(begleiter(rec));
    if (schonOben(gruppe)) return;
    // Rahmen zuerst, danach der Inhalt in seiner alten Reihenfolge
    for (const d of gruppe) { GD.store.bumpZ(d); applyZ(d); }
  }

  function activate(id) {
    if (activeId === id) return;
    activeId = id;
    windows.events.emit('selection', windows.selection());
  }

  /* ------------------------------------------------- Bewegen mit Snapping */

  function startMove(rec, ev, onClick) {
    if (!selection.has(rec.data.id)) windows.select([rec.data.id]);
    const moving = windows.selection();

    // Rahmen nehmen ihren Inhalt mit (s. modules/frame.js)
    const seen = new Set(moving.map((d) => d.id));
    for (const d of moving.slice()) {
      const r = live.get(d.id);
      if (!r || !r.inst || !r.inst.dragCompanions) continue;
      for (const id of r.inst.dragCompanions()) {
        if (seen.has(id)) continue;
        const extra = GD.store.getWindow(id);
        if (extra) { seen.add(id); moving.push(extra); }
      }
    }

    const starts = moving.map((d) => ({ d: d, x: d.x, y: d.y }));
    const scale = () => GD.board.scale();
    const recs = moving.map((d) => live.get(d.id)).filter(Boolean);
    for (const r of recs) r.el.classList.add('is-dragging');

    const others = GD.store.doc.windows.filter((w) => !moving.includes(w));
    const box0 = unionBox(moving);

    U.drag(ev, {
      cursor: 'grabbing',
      onMove(dx, dy, e) {
        let wx = dx / scale(), wy = dy / scale();
        const snapOn = GD.store.doc.grid.snap && !e.altKey;
        let guides = [];
        if (snapOn) {
          const res = computeSnap(
            { x: box0.x + wx, y: box0.y + wy, w: box0.w, h: box0.h }, others, 8 / scale());
          wx += res.dx; wy += res.dy;
          guides = res.guides;
        }
        for (const s of starts) {
          s.d.x = Math.round(s.x + wx);
          s.d.y = Math.round(s.y + wy);
          applyGeometry(live.get(s.d.id));
        }
        drawGuides(guides);
        GD.connections.redraw();
      },
      onEnd(e, moved) {
        drawGuides([]);
        for (const r of recs) r.el.classList.remove('is-dragging');
        if (moved) GD.store.commit('Fenster verschoben');
        else if (onClick) onClick();
      }
    });
  }

  function unionBox(list) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const d of list) {
      x1 = Math.min(x1, d.x); y1 = Math.min(y1, d.y);
      x2 = Math.max(x2, d.x + d.w); y2 = Math.max(y2, d.y + (d.collapsed ? BAR_H : d.h));
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /** Kanten- und Mittenausrichtung an anderen Fenstern + Raster */
  function computeSnap(box, others, threshold) {
    const guides = [];
    const myX = [box.x, box.x + box.w / 2, box.x + box.w];
    const myY = [box.y, box.y + box.h / 2, box.y + box.h];
    let bestX = null, bestY = null;

    for (const o of others) {
      const oh = o.collapsed ? BAR_H : o.h;
      const ox = [o.x, o.x + o.w / 2, o.x + o.w];
      const oy = [o.y, o.y + oh / 2, o.y + oh];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const dx = ox[j] - myX[i];
        if (Math.abs(dx) <= threshold && (!bestX || Math.abs(dx) < Math.abs(bestX.dx))) {
          bestX = { dx: dx, pos: ox[j], a: Math.min(box.y, o.y), b: Math.max(box.y + box.h, o.y + oh) };
        }
        const dy = oy[j] - myY[i];
        if (Math.abs(dy) <= threshold && (!bestY || Math.abs(dy) < Math.abs(bestY.dy))) {
          bestY = { dy: dy, pos: oy[j], a: Math.min(box.x, o.x), b: Math.max(box.x + box.w, o.x + o.w) };
        }
      }
    }

    const g = GD.store.doc.grid.size;
    let dx = bestX ? bestX.dx : (U.round(box.x, g) - box.x);
    let dy = bestY ? bestY.dy : (U.round(box.y, g) - box.y);
    if (!bestX && Math.abs(dx) > threshold) dx = 0;
    if (!bestY && Math.abs(dy) > threshold) dy = 0;

    if (bestX) guides.push({ type: 'v', pos: bestX.pos, a: bestX.a - 40, b: bestX.b + 40 });
    if (bestY) guides.push({ type: 'h', pos: bestY.pos, a: bestY.a - 40, b: bestY.b + 40 });
    return { dx: dx, dy: dy, guides: guides };
  }

  function drawGuides(list) {
    const layer = windows.guides;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (!list.length) return;
    const sw = 1 / GD.board.scale();
    for (const g of list) {
      const attrs = g.type === 'v'
        ? { x1: g.pos + OFF, y1: g.a + OFF, x2: g.pos + OFF, y2: g.b + OFF }
        : { x1: g.a + OFF, y1: g.pos + OFF, x2: g.b + OFF, y2: g.pos + OFF };
      attrs.class = 'snap-guide';
      attrs['stroke-width'] = sw;
      attrs['stroke-dasharray'] = (4 * sw) + ' ' + (4 * sw);
      layer.appendChild(U.svg('line', attrs));
    }
  }

  /* -------------------------------------------------------- Skalieren */

  function startResize(rec, dir, ev) {
    ev.stopPropagation();
    const d = rec.data;
    const s0 = { x: d.x, y: d.y, w: d.w, h: d.h };
    const scale = () => GD.board.scale();
    const others = GD.store.doc.windows.filter((w) => w !== d);

    U.drag(ev, {
      onMove(dxp, dyp, e) {
        let dx = dxp / scale(), dy = dyp / scale();
        let x = s0.x, y = s0.y, w = s0.w, h = s0.h;

        if (dir.includes('e')) w = s0.w + dx;
        if (dir.includes('s')) h = s0.h + dy;
        if (dir.includes('w')) { w = s0.w - dx; x = s0.x + dx; }
        if (dir.includes('n')) { h = s0.h - dy; y = s0.y + dy; }

        if (w < MIN_W) { if (dir.includes('w')) x -= (MIN_W - w); w = MIN_W; }
        if (h < MIN_H) { if (dir.includes('n')) y -= (MIN_H - h); h = MIN_H; }

        if (GD.store.doc.grid.snap && !e.altKey) {
          const t = 8 / scale();
          const edgesX = [], edgesY = [];
          for (const o of others) {
            const oh = o.collapsed ? BAR_H : o.h;
            edgesX.push(o.x, o.x + o.w); edgesY.push(o.y, o.y + oh);
          }
          const g = GD.store.doc.grid.size;
          const guides = [];
          if (dir.includes('e')) { const r = snapValue(x + w, edgesX, t, g); w = r.value - x; if (r.hit) guides.push({ type: 'v', pos: r.value, a: y - 30, b: y + h + 30 }); }
          if (dir.includes('w')) { const r = snapValue(x, edgesX, t, g); w += (x - r.value); x = r.value; if (r.hit) guides.push({ type: 'v', pos: r.value, a: y - 30, b: y + h + 30 }); }
          if (dir.includes('s')) { const r = snapValue(y + h, edgesY, t, g); h = r.value - y; if (r.hit) guides.push({ type: 'h', pos: r.value, a: x - 30, b: x + w + 30 }); }
          if (dir.includes('n')) { const r = snapValue(y, edgesY, t, g); h += (y - r.value); y = r.value; if (r.hit) guides.push({ type: 'h', pos: r.value, a: x - 30, b: x + w + 30 }); }
          drawGuides(guides);
        }

        d.x = Math.round(x); d.y = Math.round(y);
        d.w = Math.max(MIN_W, Math.round(w)); d.h = Math.max(MIN_H, Math.round(h));
        applyGeometry(rec);
        GD.connections.redraw();
      },
      onEnd(e, moved) {
        drawGuides([]);
        notifyResize(rec);
        if (moved) GD.store.commit('Fenstergröße geändert');
      }
    });
  }

  function snapValue(value, edges, threshold, grid) {
    let best = null;
    for (const e of edges) {
      const d = e - value;
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
    if (best !== null) return { value: value + best, hit: true };
    const g = U.round(value, grid);
    if (Math.abs(g - value) <= threshold) return { value: g, hit: false };
    return { value: value, hit: false };
  }

  function selectInRect(rect, additive) {
    const hits = GD.store.doc.windows.filter((w) => {
      const h = w.collapsed ? BAR_H : w.h;
      return w.x < rect.x + rect.w && w.x + w.w > rect.x && w.y < rect.y + rect.h && w.y + h > rect.y;
    }).map((w) => w.id);
    windows.select(hits, additive);
  }

  windows.BAR_H = BAR_H;
  GD.windows = windows;
})();
