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
  const HISTORY_MIN = 12;                    // so viele Schritte bleiben immer
  const VERLAUF_BUDGET = 24 * 1024 * 1024;   // Zeichen, s. kuerzeVerlauf()

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
      /* Änderungsverfolgung: Abzug des letzten Commits + Commit-Verlauf.
         Aufbau und Beweggründe in js/core/aenderungen.js. */
      aenderungen: { basis: null, commits: [] },
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

    /**
     * Fenster nach Kennung — über ein Verzeichnis, nicht über die Liste.
     *
     * Der Griff sitzt in den heißesten Schleifen des Programms: Jeder Pfeil
     * fragt bei jedem Neuzeichnen zweimal nach seinen Enden, die
     * Übersichtskarte ebenso. Auf einer Tafel mit 117 Kacheln und 40 Pfeilen
     * sind das rund zehntausend Vergleiche je Bild, nur um Kennungen zu
     * suchen, die sich nicht bewegt haben.
     *
     * Das Verzeichnis gilt, solange dieselbe Liste in derselben Länge
     * vorliegt — Anlegen und Löschen ändern beides, ein Dokumentwechsel
     * tauscht die Liste aus. Geht ein Griff trotzdem daneben, wird einmal
     * frisch aufgebaut; falsch antworten kann er dadurch nicht.
     */
    getWindow(id) {
      const liste = store.doc.windows;
      if (verzeichnis.liste !== liste || verzeichnis.laenge !== liste.length) baueVerzeichnis(liste);
      const w = verzeichnis.map.get(id);
      if (w) return w;
      // Nachzügler: gleiche Länge, aber getauschter Inhalt
      const gesucht = liste.find((x) => x.id === id) || null;
      if (gesucht) baueVerzeichnis(liste);
      return gesucht;
    },
    getConnection(id) { return store.doc.connections.find((c) => c.id === id) || null; },

    bumpZ(win) {
      store.doc.nextZ = (store.doc.nextZ || 1) + 1;
      win.z = store.doc.nextZ;
      return win.z;
    },

    /** Modulzustände einsammeln und Klon des Dokuments zurückgeben */
    serialize() {
      return JSON.parse(store.text());
    },

    /**
     * Dasselbe, aber gleich als Text.
     *
     * Verlauf und Autospeichern brauchen beide eine ZEICHENKETTE. Über
     * serialize() lief das bisher als stringify → parse → stringify: Das
     * Dokument wurde dreimal durch die Wandlung geschickt, um am Ende genau
     * das zu bekommen, was schon nach dem ersten Schritt dastand. Auf einer
     * Tafel mit 500 KB ist das kein Rundungsfehler.
     */
    text() {
      if (GD.windows && GD.windows.syncStates) GD.windows.syncStates();
      return JSON.stringify(store.doc);
    },

    /* -------------------------------------------------------- Historie */

    /** Zustand nach einer abgeschlossenen Änderung sichern */
    commit(label) {
      const snap = store.text();
      if (history.stack[history.index] === snap) { store.save(); return; }
      history.stack.length = history.index + 1;
      history.stack.push(snap);
      history.labels.length = history.index + 1;
      history.labels.push(label || '');
      kuerzeVerlauf();
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

    /** Verlauf auf den jetzigen Stand zurücksetzen (nach der Medienwanderung:
        der erste Abzug trüge sonst weiter die eingebetteten Bytes). */
    neueBasis() { resetHistory(); },

    /* ------------------------------------------------------ Persistenz */

    save: U.debounce(function () { writeLocal(); }, 600),
    saveNow() { store.save.cancel(); writeLocal(); },

    savePrefs() {
      try { localStorage.setItem(LS_PREFS, JSON.stringify(store.prefs)); } catch (e) { /* egal */ }
    },

    /**
     * Für Datei und Bibliothek: dasselbe Dokument, aber mit ausgeschriebenen
     * Medien. Auf der Platte soll eine Tafel in sich geschlossen sein — man
     * verschickt sie, öffnet sie anderswo, und die Bilder sind dabei.
     */
    async serializeVoll() {
      const doc = store.serialize();
      return GD.depot ? await GD.depot.aufblasen(doc) : doc;
    },

    async exportFile() {
      const doc = await store.serializeVoll();
      const name = (doc.name || 'board').replace(/[^\w\-. äöüÄÖÜß]/g, '_').trim() || 'board';
      U.download(name + '.gamedesk.json', JSON.stringify(doc, null, 2), 'application/json');
    }
  };

  /* --------------------------------------------------------- intern */

  /* Kennung -> Fenster, s. store.getWindow */
  const verzeichnis = { liste: null, laenge: -1, map: new Map() };

  function baueVerzeichnis(liste) {
    verzeichnis.map.clear();
    for (const w of liste) verzeichnis.map.set(w.id, w);
    verzeichnis.liste = liste;
    verzeichnis.laenge = liste.length;
  }

  const history = { stack: [], labels: [], index: -1 };

  /**
   * Verlauf kürzen — nach Anzahl UND nach Umfang.
   *
   * Sechzig Abzüge klingen harmlos, solange eine Tafel ein paar Kilobyte
   * groß ist. Die Feldherr-Tafel wiegt 545 KB; sechzig Abzüge davon sind
   * dreißig Megabyte Zeichenketten, die nur darauf warten, dass jemand
   * einmal Rückgängig drückt. Deshalb greift zusätzlich ein Budget: Wird es
   * überschritten, fallen die ÄLTESTEN Schritte weg — die jüngsten sind die,
   * die man zurücknehmen will.
   */
  function kuerzeVerlauf() {
    while (history.stack.length > HISTORY_MAX) { history.stack.shift(); history.labels.shift(); }
    let umfang = 0;
    for (const s of history.stack) umfang += s.length;
    while (history.stack.length > HISTORY_MIN && umfang > VERLAUF_BUDGET) {
      umfang -= history.stack[0].length;
      history.stack.shift();
      history.labels.shift();
    }
  }

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

  /*
   * Autospeichern geht in den localStorage, und der fasst pro Herkunft rund
   * 5 MB. Medien liegen deshalb im Depot und stehen hier nur als kurzer
   * Verweis (js/core/depot.js). Läuft er trotzdem über, sagt die Meldung, wie
   * groß die Tafel geworden ist — „Speicher voll" allein hilft niemandem.
   */
  function writeLocal() {
    let text = '';
    try {
      text = store.text();
      localStorage.setItem(LS_DOC, text);
      events.emit('saved', Date.now());
    } catch (err) {
      events.emit('save:failed', { fehler: err, bytes: text.length });
      console.warn('[GD] Autospeichern fehlgeschlagen (' + text.length + ' Zeichen):', err);
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

    /* Änderungsverfolgung. Sie gehört zur Tafel, nicht zur Sitzung: Wer eine
       .gamedesk.json weitergibt, gibt den Commit-Verlauf mit. Fremde Dateien
       ohne Block bekommen einen leeren — dann steht die Tafel auf „noch nichts
       festgeschrieben", und alles gilt als unverändert. */
    const spur = raw.aenderungen && typeof raw.aenderungen === 'object' ? raw.aenderungen : {};
    doc.aenderungen = {
      basis: (spur.basis && spur.basis.abzug && typeof spur.basis.abzug === 'object') ? {
        id: String(spur.basis.id || U.uid('cmt')),
        zeit: num(spur.basis.zeit, Date.now()),
        titel: typeof spur.basis.titel === 'string' ? spur.basis.titel : '',
        wer: spur.basis.wer === 'ki' ? 'ki' : 'mensch',
        abzug: spur.basis.abzug
      } : null,
      commits: (Array.isArray(spur.commits) ? spur.commits : [])
        .filter((c) => c && typeof c === 'object')
        .map((c) => ({
          id: typeof c.id === 'string' ? c.id : U.uid('cmt'),
          zeit: num(c.zeit, 0),
          titel: typeof c.titel === 'string' ? c.titel : '',
          text: typeof c.text === 'string' ? c.text : '',
          wer: c.wer === 'ki' ? 'ki' : 'mensch',
          zahlen: c.zahlen && typeof c.zahlen === 'object' ? c.zahlen : { gesamt: 0, jeKlasse: {} },
          punkte: Array.isArray(c.punkte) ? c.punkte : [],
          gekuerzt: num(c.gekuerzt, 0)
        }))
    };

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
