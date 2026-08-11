/* GameDesk — Modul-Registry
 *
 * Ein Modul ist der Inhalt eines Fensters. Neues Modul = eine Datei in
 * js/modules/ + ein <script>-Tag in index.html. Mehr ist nicht nötig.
 *
 *   GD.modules.register({
 *     id: 'meinmodul',
 *     label: 'Mein Modul',
 *     icon: '★',
 *     description: 'Kurztext für die Palette',
 *     accent: '#6ea8fe',              // Fensterfarbe (optional)
 *     defaultSize: { w: 420, h: 300 },
 *     defaultTitle: 'Mein Modul',
 *     create(ctx) { ... return instance; }
 *   });
 *
 * ctx (vom Fenster bereitgestellt):
 *   ctx.id            – Fenster-ID
 *   ctx.state         – gespeicherter Zustand (oder undefined)
 *   ctx.win           – { get(), setTitle(t), setSize(w,h), select() }
 *   ctx.changed()     – Zustand hat sich geändert (löst Autosave aus)
 *   ctx.commit(label) – Änderung in die Board-Historie schreiben
 *   ctx.refreshInspector() – Inspector neu zeichnen (falls Fenster aktiv)
 *   ctx.toast(msg, kind)
 *
 * instance (Rückgabe von create):
 *   el              – Wurzelelement (Pflicht)
 *   getState()      – serialisierbarer Zustand
 *   destroy()       – aufräumen (optional)
 *   onResize(w,h)   – Fenstergröße geändert (optional)
 *   onSelect(bool)  – Fenster (de)selektiert (optional)
 *   onZoom(scale)   – Board-Zoom geändert (optional)
 *   headerTools()   – Array von Buttons für die Titelleiste (optional)
 *   inspector(host) – füllt den Inspector, wenn das Fenster aktiv ist (optional)
 *   onKey(ev)       – Tastatur, wenn das Fenster aktiv ist; true = verbraucht (optional)
 */
(function () {
  'use strict';
  const GD = window.GD;
  const defs = new Map();
  const order = [];

  GD.modules = {
    register(def) {
      if (!def || !def.id) throw new Error('[GD] Modul braucht eine id');
      if (typeof def.create !== 'function') throw new Error('[GD] Modul ' + def.id + ' braucht create()');
      if (defs.has(def.id)) console.warn('[GD] Modul überschrieben:', def.id);
      else order.push(def.id);
      defs.set(def.id, Object.assign({
        label: def.id,
        icon: '▪',
        description: '',
        accent: '#6ea8fe',
        defaultSize: { w: 420, h: 300 },
        defaultTitle: def.label || def.id
      }, def));
    },

    get(id) { return defs.get(id) || null; },

    list() { return order.map((id) => defs.get(id)); },

    /** Platzhalter für unbekannte Modultypen, damit Boards nie Daten verlieren */
    fallback(id) {
      return {
        id: id,
        label: 'Unbekannt (' + id + ')',
        icon: '?',
        accent: '#e8b45c',
        defaultSize: { w: 320, h: 180 },
        defaultTitle: 'Unbekanntes Modul',
        create(ctx) {
          const el = GD.util.el('div', { class: 'mod-missing' }, [
            GD.util.el('strong', { text: 'Modul „' + id + '" nicht geladen' }),
            GD.util.el('p', { text: 'Der Inhalt bleibt gespeichert und erscheint wieder, sobald das Modul verfügbar ist.' })
          ]);
          const kept = ctx.state;
          return { el: el, getState: () => kept };
        }
      };
    }
  };
})();
