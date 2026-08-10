/* GameDesk — Dokumentmodell, Historie, Persistenz */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const FORMAT = 'gamedesk-board';
  const VERSION = 1;
  const LS_DOC = 'gamedesk.doc.v1';
  const LS_PREFS = 'gamedesk.prefs.v1';
  const HISTORY_MAX = 60;

  function emptyDoc() {
    return {
      format: FORMAT,
      version: VERSION,
      name: 'Unbenanntes Board',
      view: { x: 0, y: 0, scale: 1 },
      grid: { size: 20, show: true, snap: true },
      windows: [],
      connections: [],
      bundles: [],
      models: [],
      nextZ: 1
    };
  }

  const events = U.emitter();

  const store = {
    doc: emptyDoc(),
    events: events,
    prefs: { theme: 'dark', minimap: true },

    /* ------------------------------------------------------------ Laden */

    init() {
      try {
        const rawPrefs = localStorage.getItem(LS_PREFS);
        if (rawPrefs) Object.assign(store.prefs, JSON.parse(rawPrefs));
      } catch (e) { /* egal */ }

      let loaded = null;
      try {
        const raw = localStorage.getItem(LS_DOC);
        if (raw) loaded = normalize(JSON.parse(raw));
      } catch (e) {
        console.warn('[GD] Gespeichertes Board konnte nicht gelesen werden:', e);
      }
      store.doc = loaded || emptyDoc();
      resetHistory();
      return !!loaded;
    },

    newDoc() {
      store.doc = emptyDoc();
      resetHistory();
      events.emit('doc:replaced', store.doc);
      store.save();
    },

    /** Fremdes Dokument übernehmen (Import) */
    load(raw) {
      const doc = normalize(raw);
      if (!doc) throw new Error('Kein gültiges GameDesk-Board.');
      store.doc = doc;
      resetHistory();
      events.emit('doc:replaced', store.doc);
      store.save();
    },

    /* ------------------------------------------- Zugriff / Manipulation */

    getWindow(id) { return store.doc.windows.find((w) => w.id === id) || null; },
    getConnection(id) { return store.doc.connections.find((c) => c.id === id) || null; },

    bumpZ(win) {
      store.doc.nextZ = (store.doc.nextZ || 1) + 1;
      win.z = store.doc.nextZ;
      return win.z;
    },

    /** Modulzustände einsammeln und Klon des Dokuments zurückgeben */
    serialize() {
      if (GD.windows && GD.windows.syncStates) GD.windows.syncStates();
      return U.clone(store.doc);
    },

    /* -------------------------------------------------------- Historie */

    /** Zustand nach einer abgeschlossenen Änderung sichern */
    commit(label) {
      const snap = JSON.stringify(store.serialize());
      if (history.stack[history.index] === snap) { store.save(); return; }
      history.stack.length = history.index + 1;
      history.stack.push(snap);
      history.labels.length = history.index + 1;
      history.labels.push(label || '');
      if (history.stack.length > HISTORY_MAX) {
        history.stack.shift();
        history.labels.shift();
      }
      history.index = history.stack.length - 1;
      events.emit('history', historyInfo());
      store.save();
    },

    /** Änderung ohne Historieneintrag (z. B. Kameraposition) */
    touch() { store.save(); },

    undo() {
      if (history.index <= 0) return false;
      history.index -= 1;
      applyHistory();
      return true;
    },

    redo() {
      if (history.index >= history.stack.length - 1) return false;
      history.index += 1;
      applyHistory();
      return true;
    },

    canUndo() { return history.index > 0; },
    canRedo() { return history.index < history.stack.length - 1; },

    /* ------------------------------------------------------ Persistenz */

    save: U.debounce(function () { writeLocal(); }, 600),
    saveNow() { store.save.cancel(); writeLocal(); },

    savePrefs() {
      try { localStorage.setItem(LS_PREFS, JSON.stringify(store.prefs)); } catch (e) { /* egal */ }
    },

    exportFile() {
      const doc = store.serialize();
      const name = (doc.name || 'board').replace(/[^\w\-. äöüÄÖÜß]/g, '_').trim() || 'board';
      U.download(name + '.gamedesk.json', JSON.stringify(doc, null, 2), 'application/json');
    }
  };

  /* --------------------------------------------------------- intern */

  const history = { stack: [], labels: [], index: -1 };

  function resetHistory() {
    history.stack = [JSON.stringify(store.doc)];
    history.labels = ['Start'];
    history.index = 0;
    events.emit('history', historyInfo());
  }

  function historyInfo() {
    return { canUndo: store.canUndo(), canRedo: store.canRedo(), index: history.index, size: history.stack.length };
  }

  function applyHistory() {
    const doc = JSON.parse(history.stack[history.index]);
    store.doc = doc;
    events.emit('doc:restored', doc);
    events.emit('history', historyInfo());
    store.save();
  }

  function writeLocal() {
    try {
      localStorage.setItem(LS_DOC, JSON.stringify(store.serialize()));
      events.emit('saved', Date.now());
    } catch (err) {
      events.emit('save:failed', err);
      console.warn('[GD] Autospeichern fehlgeschlagen:', err);
    }
  }

  /** Fremddaten auf das erwartete Schema bringen; null wenn unbrauchbar */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.format && raw.format !== FORMAT) return null;
    if (!Array.isArray(raw.windows)) return null;

    const doc = emptyDoc();
    doc.name = typeof raw.name === 'string' ? raw.name : doc.name;
    if (raw.view) {
      doc.view = {
        x: num(raw.view.x, 0),
        y: num(raw.view.y, 0),
        scale: U.clamp(num(raw.view.scale, 1), 0.05, 6)
      };
    }
    if (raw.grid) {
      doc.grid = {
        size: U.clamp(num(raw.grid.size, 20), 4, 200),
        show: raw.grid.show !== false,
        snap: raw.grid.snap !== false
      };
    }

    const seen = new Set();
    doc.windows = raw.windows.filter((w) => w && typeof w === 'object').map((w) => {
      let id = typeof w.id === 'string' ? w.id : U.uid('win');
      while (seen.has(id)) id = U.uid('win');
      seen.add(id);
      return {
        id: id,
        type: String(w.type || 'notes'),
        title: typeof w.title === 'string' ? w.title : 'Fenster',
        x: num(w.x, 0), y: num(w.y, 0),
        w: Math.max(140, num(w.w, 420)), h: Math.max(80, num(w.h, 300)),
        z: num(w.z, 1),
        accent: typeof w.accent === 'string' ? w.accent : null,
        collapsed: !!w.collapsed,
        state: w.state
      };
    });

    doc.nextZ = Math.max(1, num(raw.nextZ, 1), ...doc.windows.map((w) => w.z || 1));

    doc.models = (Array.isArray(raw.models) ? raw.models : [])
      .filter((m) => m && typeof m === 'object' && m.scene)
      .map((m) => ({
        id: typeof m.id === 'string' ? m.id : U.uid('mdl'),
        name: typeof m.name === 'string' ? m.name : 'Modell',
        updated: num(m.updated, Date.now()),
        scene: GD.models ? GD.models.normScene(m.scene) : m.scene
      }));

    /* Bündel — mehrere Pfeile, die dieselbe Strecke teilen, laufen dort als
       Strang. Ein Bündel ist reine Wegführung: Es trägt keine Enden, sondern
       nur die Stelle, durch die seine Mitglieder gemeinsam laufen. */
    doc.bundles = (Array.isArray(raw.bundles) ? raw.bundles : [])
      .filter((b) => b && typeof b === 'object')
      .map((b) => ({
        id: typeof b.id === 'string' ? b.id : U.uid('bnd'),
        name: typeof b.name === 'string' ? b.name : 'Bündel',
        collapsed: b.collapsed !== false,           // Vorgabe: gebündelt
        color: typeof b.color === 'string' ? b.color : '#8fa4c4',
        width: U.clamp(num(b.width, 2.5), 0.5, 20),
        spreizung: U.clamp(num(b.spreizung, 11), 3, 60),
        laenge: U.clamp(num(b.laenge, 260), 40, 4000),
        mitte: (b.mitte && Number.isFinite(Number(b.mitte.x)))
          ? { x: num(b.mitte.x, 0), y: num(b.mitte.y, 0) } : null
      }));
    const bIds = new Set(doc.bundles.map((b) => b.id));

    const ids = new Set(doc.windows.map((w) => w.id));
    doc.connections = (Array.isArray(raw.connections) ? raw.connections : [])
      .filter((c) => c && c.from && c.to && ids.has(c.from.win) && ids.has(c.to.win))
      .map((c) => ({
        id: typeof c.id === 'string' ? c.id : U.uid('con'),
        from: { win: c.from.win, side: side(c.from.side), shape: typeof c.from.shape === 'string' ? c.from.shape : null },
        to: { win: c.to.win, side: side(c.to.side), shape: typeof c.to.shape === 'string' ? c.to.shape : null },
        label: typeof c.label === 'string' ? c.label : '',
        labelSize: U.clamp(num(c.labelSize, 12), 6, 48),
        // null heißt „steht frei": connections.js setzt die Beschriftung dann
        // auf die Mitte des längsten geraden Stücks. Eine Zahl ist eine von
        // Hand verschobene Stelle und bleibt, wo sie ist.
        t: (c.t === null || c.t === undefined) ? null : U.clamp(num(c.t, 0.5), 0, 1),
        color: typeof c.color === 'string' ? c.color : '#6ea8fe',
        width: U.clamp(num(c.width, 2), 0.5, 20),
        dash: typeof c.dash === 'string' ? c.dash : 'solid',
        curve: typeof c.curve === 'string' ? c.curve : 'ortho',
        heads: typeof c.heads === 'string' ? c.heads : 'end',
        bundle: (typeof c.bundle === 'string' && bIds.has(c.bundle)) ? c.bundle : null
      }));

    return doc;
  }

  function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function side(s) { return s === 't' || s === 'b' || s === 'l' || s === 'r' ? s : 'auto'; }

  store.emptyDoc = emptyDoc;
  GD.store = store;
})();
