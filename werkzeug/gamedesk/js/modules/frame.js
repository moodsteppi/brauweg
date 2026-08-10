/* GameDesk — Modul „Rahmen": Fenster zu Bereichen bündeln
 *
 * Ein Rahmen liegt hinter allen anderen Fenstern und fängt keine Mausklicks —
 * über seiner Fläche lässt sich das Board weiter verschieben und aufziehen.
 * Angefasst wird er an seiner Titelleiste; dabei wandern alle Fenster mit,
 * die vollständig in ihm liegen.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const TINTS = ['#6ea8fe', '#57c98a', '#e8b45c', '#ef6b6b', '#b78cf7', '#4fd1c5', '#94a3b8'];

  GD.modules.register({
    id: 'frame',
    label: 'Rahmen',
    icon: '▢',
    description: 'Bereiche gruppieren',
    accent: '#94a3b8',
    defaultSize: { w: 680, h: 440 },
    defaultTitle: 'Bereich',

    create(ctx) {
      const state = Object.assign({
        tint: '#94a3b8', strength: 0.1, dashed: false, note: '',
        kopfX: 0, kopfY: 0              // von Hand verschobene Überschrift
      }, ctx.state || {});

      const mark = U.el('div', { class: 'fr-mark' });
      const note = U.el('div', { class: 'fr-note' });
      const griff = U.el('div', { class: 'fr-griff', title: 'Überschrift verschieben' });
      /* Der Kopf hängt NICHT im Rahmen, sondern in der Ebene über den
         Kacheln (windows.js: overlayEl). Ein Rahmen gehört ins untere
         Stapelband und darf seinen Inhalt nie verdecken — seine Überschrift
         muss aber genau das dürfen, sonst ist sie auf Distanz weg. */
      const kopf = U.el('div', { class: 'fr-kopf' }, [griff, mark, note]);
      /* Der Träger bekommt von windows.js die Maße des Rahmens; die
         Überschrift darin behält ihre eigene Höhe — genau die meldet
         kopfHoehe() an GD.layout. */
      const schild = U.el('div', { class: 'fr-schild' }, [kopf]);
      const root = U.el('div', { class: 'fr-root' });

      // Eigene Kopie des Titels: beim Tippen in der Leiste steht in den Daten
      // noch der alte, gemeldet wird aber schon der neue Text
      let titel = ctx.win.get().title || '';

      /* Grundgrößen aus dem Blatt — sie bestimmen auch das Kopfband, das
         GD.layout freihält. Der Zoom ändert nur die Anzeige, nie das Band. */
      function blatt(name, fallback) {
        const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
        return Number.isFinite(v) && v > 0 ? v : fallback;
      }

      /**
       * Überschrift gegen den Zoom mitwachsen lassen.
       *
       * Weit herausgezoomt wird die Beschriftung sonst unlesbar, und man
       * weiß nicht mehr, welcher Bereich unter einem liegt. Sie behält
       * deshalb ihre Bildschirmgröße, bis sie das Vierfache ihrer Weltgröße
       * erreicht hat — darüber hinaus wüchse sie über den Rahmen hinaus.
       * Beim Hineinzoomen wächst sie nie über die Grundgröße.
       */
      const ZIEL_PX = 20;          // angestrebte Bildschirmgröße der Überschrift
      const MAX_WUCHS = 14;        // weiter aufblasen hilft niemandem
      const MIN_BREITE = 130;      // schmaler als das: Überschrift weglassen
      let wuchs = 1;

      function skaliereKopf(sc) {
        const s = Number.isFinite(sc) && sc > 0 ? sc : (GD.board ? GD.board.scale() : 1);
        const basis = blatt('--fr-mark-size', 28);
        /* Nie kleiner als die Grundgröße (dann sitzt sie sauber im Kopfband
           und überlappt nichts), nach außen hin so weit größer, dass auf dem
           Bildschirm rund ZIEL_PX übrig bleiben. */
        wuchs = U.clamp(ZIEL_PX / (basis * s), 1, MAX_WUCHS);
        kopf.classList.toggle('is-gross', wuchs > 1.15);

        /* Zu kleine Rahmen bekommen gar keine Überschrift: Zwanzig Schilder
           übereinander sind unlesbarer als keines. */
        const f = ctx.win.get();
        const breite = f.w * s;
        kopf.classList.toggle('is-weg', wuchs > 1.15 && breite < MIN_BREITE);
        stelleKopf();
      }

      /* Vergrößert wird über transform, nicht über die Schriftgröße: Ein
         wachsender Schriftgrad rechnet das Layout neu (und die Messung des
         Kopfbands liefe mitten in die Übergangsanimation), scale() nicht. */
      function stelleKopf() {
        kopf.style.transform =
          'translate(' + (state.kopfX || 0) + 'px,' + (state.kopfY || 0) + 'px) scale(' + wuchs.toFixed(3) + ')';
      }

      function paint() {
        root.style.background = U.withAlpha(state.tint, state.strength);
        root.style.outline = '1px ' + (state.dashed ? 'dashed' : 'solid') + ' ' + U.withAlpha(state.tint, 0.5);
        root.style.outlineOffset = '-1px';
        mark.style.color = U.withAlpha(state.tint, 0.85);
        mark.textContent = titel;
        note.textContent = state.note || '';
        note.style.display = state.note ? '' : 'none';
        stelleKopf();
        kopf.classList.toggle('is-verschoben', !!(state.kopfX || state.kopfY));
      }
      paint();
      skaliereKopf();

      /* Die Überschrift lässt sich anfassen und woanders hinlegen — bei
         breiten Bereichen steht sie sonst weit weg vom Inhalt. Sie bleibt
         dabei im Rahmen; das Kopfband, das GD.layout freihält, wandert nicht
         mit, deshalb wird nach dem Ziehen nur die Anzeige verschoben. */
      kopf.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        ctx.win.select();
        const x0 = state.kopfX || 0, y0 = state.kopfY || 0;
        const f = ctx.win.get();
        U.drag(ev, {
          cursor: 'grabbing',
          onMove(dx, dy) {
            const sc = GD.board.scale() || 1;
            state.kopfX = Math.round(U.clamp(x0 + dx / sc, 0, Math.max(0, f.w - 120)));
            state.kopfY = Math.round(U.clamp(y0 + dy / sc, 0, Math.max(0, f.h - 60)));
            paint();
          },
          onEnd(e, moved) { if (moved) ctx.commit('Überschrift verschoben'); }
        });
      });

      /** Welche Fenster liegen vollständig in diesem Rahmen? */
      function inside() {
        const f = ctx.win.get();
        const out = [];
        for (const w of GD.store.doc.windows) {
          if (w.id === f.id) continue;
          const h = w.collapsed ? GD.windows.BAR_H : w.h;
          if (w.x >= f.x - 2 && w.y >= f.y - 2 && w.x + w.w <= f.x + f.w + 2 && w.y + h <= f.y + f.h + 2) {
            out.push(w.id);
          }
        }
        return out;
      }

      return {
        el: root,
        getState() { return U.clone(state); },
        setState(next) { if (next) { Object.assign(state, next); paint(); skaliereKopf(); } },

        /** Die Überschrift lebt über den Kacheln, s. windows.js */
        overlayEl() { return schild; },

        onResize() { paint(); skaliereKopf(); },
        onZoom(sc) { skaliereKopf(sc); },
        onSelect() { paint(); },
        onTitle(t) { titel = t || ''; paint(); },   // Wasserzeichen zieht beim Tippen mit

        /** windows.js zieht diese Fenster beim Verschieben mit */
        dragCompanions: inside,

        /**
         * Höhe des Kopfbands, vom oberen Fensterrand an — Titelleiste,
         * Wasserzeichen und Untertitel zusammen.
         *
         * GD.layout hält allen Inhalt darunter. Gemessen statt geraten: Die
         * Schriftgrößen stehen im Blatt, und ein Untertitel darf umbrechen.
         * Ist der Rahmen gerade nicht gezeichnet, gelten die Vorgaben aus
         * :root (--fr-kopf / --fr-kopf-note).
         */
        kopfHoehe() {
          const vorgabe = blatt(state.note ? '--fr-kopf-note' : '--fr-kopf', 92);
          const bar = blatt('--fr-bar', 34);
          /* Zoomunabhängig messen — GD.layout darf sein Band nicht bei
             jedem Zoomschritt anders bekommen:
               · scale() steht im transform, das rechnet kein Layout neu;
               · die Zoomfassung (is-gross) blendet den Untertitel aus und
                 setzt eigene Polster — dafür kurz abschalten. */
          const gross = kopf.classList.contains('is-gross');
          if (gross) kopf.classList.remove('is-gross');
          const h = kopf.offsetHeight;
          if (gross) kopf.classList.add('is-gross');
          return h > 0 ? Math.ceil(bar + h) : vorgabe;
        },

        inspector(host) {
          const F = GD.ui.fields;
          host.appendChild(F.title('Rahmen'));

          // Bereich aus der Taxonomie: legt Farbe und Reihenfolge fest
          const bereiche = [['', '— keiner —']].concat(GD.layout.BEREICHE.map((b) => [b.id, b.label]));
          host.appendChild(F.row('Bereich', F.sel(state.bereich || '', bereiche, (v) => {
            state.bereich = v || null;
            const def = GD.layout.bereichVon(v);
            if (def) { state.tint = def.tint; GD.windows.setAccent(ctx.id, def.tint); }
            paint();
            ctx.commit('Bereich gesetzt');
            ctx.refreshInspector();
          })));

          const sw = U.el('div', { class: 'swatches' });
          for (const c of TINTS) {
            const b = U.el('button', { class: 'swatch' + (c === state.tint ? ' is-on' : ''), style: { background: c } });
            b.addEventListener('click', () => {
              state.tint = c; paint();
              GD.windows.setAccent(ctx.id, c);
              ctx.refreshInspector();
            });
            sw.appendChild(b);
          }
          host.appendChild(sw);

          host.appendChild(F.row('Deckkraft', F.range(state.strength, 0, 0.35, 0.01,
            (v) => { state.strength = v; paint(); }, () => ctx.commit('Rahmen'))));
          host.appendChild(F.row('Gestrichelt', F.chk(state.dashed, (v) => { state.dashed = v; paint(); ctx.commit('Rahmen'); })));
          host.appendChild(F.row('Untertitel', F.text(state.note, (v) => { state.note = v; paint(); },
            { onCommit: () => ctx.commit('Rahmen') })));

          const n = inside().length;
          host.appendChild(F.full(F.btn('Inhalt auswählen (' + n + ')', () => {
            const ids = inside();
            if (ids.length) GD.windows.select(ids);
          })));
          host.appendChild(F.full(F.btn('Um den Inhalt legen', () => {
            if (!inside().length) { ctx.toast('Der Rahmen ist leer'); return; }
            GD.layout.rahmenAnpassen(ctx.id);
            ctx.commit('Rahmen angepasst');
          })));
          host.appendChild(F.note('Der Rahmen fängt keine Klicks: über seiner Fläche bleibt das Board bedienbar. Ziehen an der Titelleiste nimmt den Inhalt mit.'));
        }
      };
    }
  });
})();
