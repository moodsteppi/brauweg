/* GameDesk — Start und Verdrahtung */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const app = {
    init() {
      const had = GD.store.init();

      applyTheme(GD.store.prefs.theme);

      GD.board.init();
      GD.windows.init();
      GD.connections.init();
      GD.minimap.init();
      GD.ui.init();

      GD.board.elBoard.classList.toggle('show-grid', GD.store.doc.grid.show !== false);
      GD.minimap.setVisible(GD.store.prefs.minimap !== false);
      GD.board.apply();

      GD.store.events.on('doc:restored', () => {
        GD.windows.reconcile();
        GD.connections.redraw();
        GD.board.apply();
        document.getElementById('board-name').value = GD.store.doc.name;
        GD.ui.refreshInspector();
      });
      GD.store.events.on('doc:replaced', () => {
        GD.windows.rebuild();
        GD.connections.redraw();
        GD.board.apply();
        document.getElementById('board-name').value = GD.store.doc.name;
        GD.ui.refreshInspector();
      });

      GD.windows.rebuild();
      GD.connections.redraw();

      if (!had && !GD.store.doc.windows.length) seedStarterBoard();
      if (GD.store.doc.windows.length) GD.board.zoomToFit();

      /* Projekt-Bibliothek: Ordner auf der Platte, aus dem geöffnet und in
         den gespeichert wird. Schlägt die Einrichtung fehl, bleibt alles
         beim Herunterladen und Hochladen von Dateien. */
      GD.library.init().then(() => {
        GD.ui.updateSaveButton();
        GD.ui.updateBackButton();
        GD.library.events.on('verknuepft', GD.ui.updateSaveButton);
        GD.library.events.on('changed', GD.ui.updateSaveButton);
        GD.library.events.on('verlauf', GD.ui.updateBackButton);
      }).catch((err) => console.warn('[GD] Bibliothek:', err));

      GD.store.events.on('saved', autoInDatei);

      bindFileDrop();
      bindPaste();
      window.addEventListener('beforeunload', () => GD.store.saveNow());
      document.addEventListener('dblclick', (ev) => {
        // Doppelklick auf leere Fläche: Notiz anlegen
        if (ev.target.id !== 'board' && ev.target.id !== 'world' && ev.target.id !== 'win-layer') return;
        const p = GD.board.screenToWorld(ev.clientX, ev.clientY);
        GD.windows.add('notes', p.x, p.y);
      });
    },

    /* ------------------------------------------------------- Historie */

    undo() { if (GD.store.undo()) GD.ui.toast('Rückgängig'); },
    redo() { if (GD.store.redo()) GD.ui.toast('Wiederhergestellt'); },

    /* ---------------------------------------------------------- Datei */

    async newBoard() {
      const link = GD.library.link();
      const ok = await GD.ui.confirm(
        'Neues Board anlegen?',
        link
          ? 'Das Board wird geleert. „' + link.datei + '" bleibt auf der Platte, die Verknüpfung wird aber gelöst.'
          : 'Das aktuelle Board wird aus dem Browser-Speicher entfernt. Wenn du es behalten willst, sichere es vorher über „Speichern".',
        'Neues Board');
      if (!ok) return;
      GD.library.entkoppeln();
      GD.store.newDoc();
      GD.ui.toast('Neues Board', 'ok');
    },

    /** Strg+S: in die verknüpfte Projektdatei, sonst in die Bibliothek, sonst als Download */
    async saveBoard() {
      const link = GD.library.link();
      if (link) {
        try {
          await GD.library.sichern();
          GD.ui.toast('Gespeichert: ' + link.datei, 'ok');
        } catch (err) {
          GD.ui.toast('Speichern fehlgeschlagen: ' + err.message, 'err');
        }
        return;
      }
      if (GD.library.status().bereit) {
        const datei = GD.library.dateiName(GD.store.doc.name);
        try {
          await GD.library.sichern(datei);
          GD.ui.toast('In der Bibliothek abgelegt: ' + datei, 'ok');
          GD.ui.updateSaveButton();
          return;
        } catch (err) {
          GD.ui.toast('Bibliothek nicht beschreibbar (' + err.message + ') — lege stattdessen eine Datei ab.', 'err');
        }
      }
      GD.store.exportFile();
      GD.ui.toast('Board als Datei gespeichert', 'ok');
    },

    async importBoard() {
      const files = await U.pickFile('.json,application/json');
      if (!files.length) return;
      try {
        const text = await U.readAsText(files[0]);
        GD.library.entkoppeln();          // eine hochgeladene Datei ist keine Bibliotheksdatei
        GD.store.load(JSON.parse(text));
        GD.board.zoomToFit();
        GD.ui.toast('Board geladen: ' + GD.store.doc.name, 'ok');
      } catch (err) {
        GD.ui.toast('Datei konnte nicht gelesen werden: ' + (err.message || err), 'err');
      }
    },

    /* ---------------------------------------------------------- Thema */

    toggleTheme() {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      GD.store.prefs.theme = next;
      GD.store.savePrefs();
      GD.minimap.draw();
    }
  };

  /**
   * „Automatisch in die Datei": Jede gespeicherte Änderung landet wenige
   * Sekunden später auch in der verknüpften Projektdatei. Bewusst entkoppelt
   * vom Autospeichern im Browser — Schreiben auf die Platte ist teurer und
   * soll nicht bei jedem Mausziehen passieren.
   */
  const schreibeDatei = U.debounce(async () => {
    if (GD.store.prefs.autoDatei !== true) return;
    const link = GD.library.link();
    if (!link) return;
    try { await GD.library.sichern(); }
    catch (err) {
      GD.store.prefs.autoDatei = false;
      GD.store.savePrefs();
      GD.ui.toast('Automatisches Schreiben abgeschaltet: ' + err.message, 'err');
    }
  }, 2500);

  function autoInDatei() {
    if (GD.store.prefs.autoDatei === true) schreibeDatei();
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  }

  /* ---------------------------------------------------- Dateien ablegen */

  function bindFileDrop() {
    const boardEl = GD.board.elBoard;
    boardEl.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
    boardEl.addEventListener('drop', async (ev) => {
      const files = Array.from(ev.dataTransfer.files || []);
      if (!files.length) return;
      ev.preventDefault();
      const p = GD.board.screenToWorld(ev.clientX, ev.clientY);

      for (const f of files) {
        if (/\.json$/i.test(f.name)) {
          try { GD.store.load(JSON.parse(await U.readAsText(f))); GD.board.zoomToFit(); GD.ui.toast('Board geladen', 'ok'); }
          catch (e) { GD.ui.toast('Keine gültige Board-Datei', 'err'); }
          return;
        }
        if (/^(image|video|audio)\//.test(f.type)) {
          await addMediaWindow(f, p.x, p.y);
          p.x += 40; p.y += 40;
        }
      }
    });
  }

  function bindPaste() {
    window.addEventListener('paste', async (ev) => {
      if (U.isTyping(ev.target)) return;
      const items = Array.from((ev.clipboardData && ev.clipboardData.items) || []);
      const fileItem = items.find((i) => i.kind === 'file' && /^image\//.test(i.type));
      if (!fileItem) return;
      const file = fileItem.getAsFile();
      if (!file) return;
      ev.preventDefault();
      const c = GD.board.viewCenter();
      await addMediaWindow(file, c.x, c.y);
    });
  }

  async function addMediaWindow(file, x, y) {
    if (file.size > 24 * 1024 * 1024) {
      GD.ui.toast('Datei ist ' + U.fmtBytes(file.size) + ' groß — das sprengt den Browser-Speicher.', 'err');
      return;
    }
    const src = await U.readAsDataURL(file);
    const kind = /^video\//.test(file.type) ? 'video' : /^audio\//.test(file.type) ? 'audio' : 'image';
    GD.windows.add('media', x, y, {
      title: file.name,
      state: { items: [{ id: U.uid('m'), kind: kind, src: src, name: file.name, caption: '' }], index: 0, fit: 'contain' }
    });
  }

  /* ---------------------------------------------------- Beispiel-Board */

  function seedStarterBoard() {
    const notes = GD.windows.add('notes', -520, -180, {
      title: 'Spielidee',
      size: { w: 380, h: 320 },
      state: {
        html: '<h1>Neues Spiel</h1>' +
          '<p>Kurzbeschreibung in einem Satz.</p>' +
          '<h2>Kernschleife</h2>' +
          '<ul><li>Erkunden</li><li>Sammeln</li><li>Ausbauen</li></ul>' +
          '<p><em>Doppelklick auf freie Fläche legt eine neue Notiz an.</em></p>'
      }
    });
    const wire = GD.windows.add('wireframe', 120, -180, { title: 'Hauptmenü (Wireframe)', size: { w: 720, h: 480 } });
    const code = GD.windows.add('sandbox', -520, 240, { title: 'Feature-Test', size: { w: 560, h: 380 } });

    GD.connections.add(notes.id, 'r', wire.id, 'l');
    const c = GD.store.doc.connections[GD.store.doc.connections.length - 1];
    if (c) c.label = 'führt zu';
    GD.connections.add(notes.id, 'b', code.id, 't');
    const c2 = GD.store.doc.connections[GD.store.doc.connections.length - 1];
    if (c2) { c2.label = 'Prototyp'; c2.dash = 'dashed'; }

    GD.windows.select([]);
    GD.connections.select(null);
    GD.connections.redraw();
    GD.store.commit('Startboard');
  }

  GD.app = app;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', app.init);
  else app.init();
})();
