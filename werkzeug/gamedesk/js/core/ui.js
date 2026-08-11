/* GameDesk — Oberfläche: Palette, Werkzeugleiste, Inspector, Kontextmenü, Tasten */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const SWATCHES = ['#6ea8fe', '#57c98a', '#e8b45c', '#ef6b6b', '#b78cf7', '#4fd1c5', '#f78ca0', '#94a3b8'];
  const SIDES = [['auto', 'auto'], ['t', 'oben'], ['r', 'rechts'], ['b', 'unten'], ['l', 'links']];

  let inspHost = null;

  const ui = {
    init() {
      inspHost = document.getElementById('insp-body');
      buildPalette();
      bindTopbar();
      bindContextMenu();
      bindKeys();

      GD.windows.events.on('selection', renderInspector);
      GD.connections.events.on('selection', renderInspector);
      GD.connections.events.on('bundle', renderInspector);
      GD.windows.events.on('changed', updateEmptyHint);
      GD.store.events.on('history', updateHistoryButtons);
      /* Nur einmal melden, nicht bei jedem Tastendruck erneut: Ist der
         Browser-Speicher voll, bleibt er es, bis die Tafel kleiner wird. */
      let vollGemeldet = false;
      GD.store.events.on('save:failed', (info) => {
        if (vollGemeldet) return;
        vollGemeldet = true;
        const gross = info && info.bytes ? ' — die Tafel ist ' + U.fmtBytes(info.bytes) + ' groß, der Browser-Speicher fasst rund 5 MB' : '';
        ui.toast('Autospeichern fehlgeschlagen' + gross + '. Über „Speichern" landet sie trotzdem vollständig auf der Platte.', 'err');
      });
      GD.store.events.on('saved', () => { vollGemeldet = false; });
      GD.board.events.on('view', updateZoomLabel);
      GD.aenderungen.events.on('stand', updateAenderungen);
      GD.aenderungen.events.on('sicht', updateAenderungen);

      renderInspector();
      updateEmptyHint();
      updateZoomLabel();
      updateHistoryButtons(GD.store);
      updateAenderungen();
    },

    /* ---------------------------------------------------------- Meldungen */

    toast(msg, kind) {
      const host = document.getElementById('toasts');
      const t = U.el('div', { class: 'toast' + (kind ? ' toast--' + kind : ''), text: msg });
      host.appendChild(t);
      setTimeout(() => {
        t.style.transition = 'opacity .3s, transform .3s';
        t.style.opacity = '0';
        t.style.transform = 'translateY(6px)';
        setTimeout(() => t.remove(), 320);
      }, kind === 'err' ? 5200 : 2600);
    },

    modal(contentNode, opts) {
      const o = opts || {};
      const back = U.el('div', { class: 'modal-back' });
      const box = U.el('div', { class: 'modal' }, [contentNode]);
      back.appendChild(box);
      const close = () => { back.remove(); document.removeEventListener('keydown', onEsc, true); };
      const onEsc = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
      back.addEventListener('pointerdown', (ev) => { if (ev.target === back && o.dismissable !== false) close(); });
      document.addEventListener('keydown', onEsc, true);
      document.getElementById('modal-root').appendChild(back);
      return { close: close, box: box };
    },

    confirm(title, text, okLabel) {
      return new Promise((resolve) => {
        const body = U.el('div', {}, [
          U.el('h2', { text: title }),
          U.el('p', { text: text, style: { color: 'var(--text-dim)', lineHeight: '1.6', margin: '0' } })
        ]);
        const actions = U.el('div', { class: 'modal-actions' });
        const cancel = U.el('button', { class: 'btn', text: 'Abbrechen' });
        const ok = U.el('button', { class: 'btn btn--danger', text: okLabel || 'Ja, weiter' });
        actions.append(cancel, ok);
        body.appendChild(actions);
        const m = ui.modal(body);
        cancel.addEventListener('click', () => { m.close(); resolve(false); });
        ok.addEventListener('click', () => { m.close(); resolve(true); });
        ok.focus();
      });
    },

    refreshInspector: () => renderInspector(),

    /** Wiederverwendbare Bausteine für Modul-Inspectoren */
    fields: {
      title: (t) => U.el('div', { class: 'insp-title', text: t }),
      note: (t) => U.el('div', { class: 'insp-note', text: t }),
      row: (label, node) => U.el('div', { class: 'insp-row' }, [U.el('label', { text: label }), node]),
      full: (node) => U.el('div', { class: 'insp-row insp-row--full' }, [node]),
      grid: (n, kids) => U.el('div', { class: 'insp-grid' + n }, kids),

      btn(label, onClick, cls) {
        const b = U.el('button', { class: 'btn btn--sm ' + (cls || ''), text: label });
        b.addEventListener('click', onClick);
        return b;
      },

      num(value, onInput, opts) {
        const o = opts || {};
        const i = U.el('input', { type: 'number', class: 'fld', value: round(value, 4), step: o.step || 1 });
        if (o.min !== undefined) i.min = o.min;
        if (o.max !== undefined) i.max = o.max;
        i.addEventListener('input', () => { const v = parseFloat(i.value); if (Number.isFinite(v)) onInput(v); });
        i.addEventListener('change', () => o.onCommit && o.onCommit());
        i.addEventListener('keydown', (ev) => ev.stopPropagation());
        return i;
      },

      text(value, onInput, opts) {
        const o = opts || {};
        const i = U.el('input', { type: 'text', class: 'fld', value: value == null ? '' : value, placeholder: o.placeholder || '' });
        i.addEventListener('input', () => onInput(i.value));
        i.addEventListener('change', () => o.onCommit && o.onCommit());
        i.addEventListener('keydown', (ev) => ev.stopPropagation());
        return i;
      },

      color(value, onInput, onCommit) {
        const i = U.el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#ffffff' });
        i.addEventListener('input', () => onInput(i.value));
        i.addEventListener('change', () => onCommit && onCommit());
        return i;
      },

      chk(value, onChange) {
        const i = U.el('input', { type: 'checkbox', checked: !!value });
        i.addEventListener('change', () => onChange(i.checked));
        return i;
      },

      sel(value, options, onChange) {
        const s = U.el('select', { class: 'fld' });
        for (const [v, t] of options) {
          const o = U.el('option', { value: v, text: t });
          if (String(v) === String(value)) o.selected = true;
          s.appendChild(o);
        }
        s.addEventListener('change', () => onChange(s.value));
        return s;
      },

      range(value, min, max, step, onInput, onCommit, fmt) {
        const show = fmt || ((v) => String(round(v, 3)));
        const out = U.el('span', {
          text: show(value),
          style: { color: 'var(--text-dim)', minWidth: '38px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
        });
        const r = U.el('input', { type: 'range', min: min, max: max, step: step, value: value });
        r.addEventListener('input', () => { const v = parseFloat(r.value); out.textContent = show(v); onInput(v); });
        r.addEventListener('change', () => onCommit && onCommit(parseFloat(r.value)));
        return U.el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [r, out]);
      },

      vec3(values, onInput, opts) {
        const o = opts || {};
        return U.el('div', { class: 'insp-grid3' }, [0, 1, 2].map((i) =>
          ui.fields.num(values[i], (v) => onInput(i, v), o)));
      }
    },

    contextMenu(x, y, items) {
      const menu = document.getElementById('ctxmenu');
      menu.innerHTML = '';
      for (const item of items) {
        if (item === '-') { menu.appendChild(U.el('div', { class: 'ctx-sep' })); continue; }
        if (item.head) { menu.appendChild(U.el('div', { class: 'ctx-head', text: item.head })); continue; }
        const row = U.el('div', { class: 'ctx-item' + (item.danger ? ' is-danger' : '') }, [
          U.el('span', { text: (item.icon ? item.icon + '  ' : '') + item.label }),
          item.key ? U.el('span', { class: 'ctx-key', text: item.key }) : null
        ]);
        row.addEventListener('click', () => { hideMenu(); item.run(); });
        menu.appendChild(row);
      }
      menu.hidden = false;
      menu.style.left = '0px'; menu.style.top = '0px';
      const r = menu.getBoundingClientRect();
      menu.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
      menu.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    }
  };

  function hideMenu() { document.getElementById('ctxmenu').hidden = true; }

  function round(v, digits) {
    const f = Math.pow(10, digits);
    return Math.round(Number(v) * f) / f;
  }

  /* ------------------------------------------------------------ Palette */

  function buildPalette() {
    const host = document.getElementById('pal-list');
    host.innerHTML = '';
    for (const def of GD.modules.list()) {
      const item = U.el('button', { class: 'pal-item', title: def.description || def.label }, [
        U.el('span', { class: 'pal-item__icon', text: def.icon }),
        U.el('span', {}, [
          U.el('span', { class: 'pal-item__label', text: def.label }),
          def.description ? U.el('span', { class: 'pal-item__desc', text: def.description }) : null
        ])
      ]);
      item.style.setProperty('--accent', def.accent);
      item.addEventListener('click', () => {
        GD.windows.add(def.id);
        ui.toast(def.label + ' hinzugefügt');
      });
      item.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        let ghost = null;
        U.drag(ev, {
          onMove(dx, dy, e, moved) {
            if (!moved) return;
            if (!ghost) {
              ghost = U.el('div', {
                text: def.icon + '  ' + def.label,
                style: {
                  position: 'fixed', zIndex: '500', pointerEvents: 'none',
                  padding: '7px 11px', borderRadius: '8px',
                  background: 'var(--panel)', border: '1px solid ' + def.accent,
                  boxShadow: 'var(--shadow-2)', color: 'var(--text)'
                }
              });
              document.body.appendChild(ghost);
            }
            ghost.style.left = (e.clientX + 12) + 'px';
            ghost.style.top = (e.clientY + 12) + 'px';
          },
          onEnd(e, moved) {
            if (ghost) ghost.remove();
            if (!moved) return;
            const boardRect = GD.board.elBoard.getBoundingClientRect();
            if (e.clientX < boardRect.left || e.clientX > boardRect.right ||
                e.clientY < boardRect.top || e.clientY > boardRect.bottom) return;
            const p = GD.board.screenToWorld(e.clientX, e.clientY);
            GD.windows.add(def.id, p.x, p.y);
          }
        });
      });
      host.appendChild(item);
    }
  }

  /* --------------------------------------------------------- Werkzeugleiste */

  function bindTopbar() {
    const bar = document.getElementById('topbar');
    bar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      runAction(btn.dataset.act, btn);
    });

    const nameInput = document.getElementById('board-name');
    nameInput.value = GD.store.doc.name;
    nameInput.addEventListener('change', () => {
      GD.store.doc.name = nameInput.value.trim() || 'Unbenanntes Board';
      nameInput.value = GD.store.doc.name;
      GD.store.commit('Board umbenannt');
    });
    nameInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') nameInput.blur(); });

    // Grundzustand der Umschalter
    setToggle('toggle-grid', GD.store.doc.grid.show);
    setToggle('toggle-snap', GD.store.doc.grid.snap);
    setToggle('toggle-minimap', GD.store.prefs.minimap !== false);
  }

  function setToggle(act, on) {
    const btn = document.querySelector('[data-act="' + act + '"]');
    if (btn) btn.classList.toggle('is-on', !!on);
  }

  function runAction(act, btn) {
    switch (act) {
      case 'undo': GD.app.undo(); break;
      case 'redo': GD.app.redo(); break;
      case 'zoom-in': GD.board.zoomBy(1.25); break;
      case 'zoom-out': GD.board.zoomBy(0.8); break;
      case 'zoom-reset': GD.board.resetZoom(); break;
      case 'zoom-fit': GD.board.zoomToFit(); break;
      case 'toggle-grid': {
        const on = !GD.store.doc.grid.show;
        GD.board.setGridVisible(on); setToggle('toggle-grid', on);
        break;
      }
      case 'toggle-snap': {
        GD.store.doc.grid.snap = !GD.store.doc.grid.snap;
        setToggle('toggle-snap', GD.store.doc.grid.snap);
        GD.store.touch(); renderInspector();
        break;
      }
      case 'toggle-minimap': {
        const on = !(GD.store.prefs.minimap !== false);
        GD.store.prefs.minimap = on; GD.store.savePrefs();
        GD.minimap.setVisible(on); setToggle('toggle-minimap', on);
        break;
      }
      case 'layout': {
        const ids = GD.windows.selectionIds();
        const bericht = GD.layout.aufraeumen(ids.length > 1 ? ids : null);
        const teile = [];
        if (bericht.hoehen) teile.push(bericht.hoehen + '× Höhe');
        if (bericht.bewegt) teile.push(bericht.bewegt + '× verschoben');
        if (bericht.rahmen) teile.push(bericht.rahmen + '× Rahmen');
        ui.toast(teile.length ? 'Angeordnet: ' + teile.join(' · ') : 'Alles saß schon richtig', 'ok');
        renderInspector();
        break;
      }
      case 'toggle-diff': {
        const on = GD.aenderungen.sichtUmschalten();
        GD.store.prefs.diffsicht = on;
        GD.store.savePrefs();
        const z = GD.aenderungen.stand().zahlen.gesamt;
        ui.toast(on
          ? (GD.aenderungen.hatBasis()
            ? 'Änderungssicht an — ' + z + (z === 1 ? ' Änderung' : ' Änderungen') + ' seit dem letzten Commit'
            : 'Änderungssicht an — diese Tafel hat noch keinen Commit')
          : 'Änderungssicht aus');
        break;
      }
      case 'suche': GD.suche.oeffnen(); break;
      case 'aenderungen': showAenderungen(); break;
      case 'toggle-theme': GD.app.toggleTheme(); break;
      case 'new': GD.app.newBoard(); break;
      case 'import': GD.app.importBoard(); break;
      case 'export': GD.app.saveBoard(); break;
      case 'library': showLibrary(); break;
      case 'zurueck': GD.library.zurueck()
        .then((ziel) => { if (ziel) ui.toast('Zurück in „' + GD.store.doc.name + '"', 'ok'); })
        .catch((err) => ui.toast('Zurück fehlgeschlagen: ' + err.message, 'err'));
        break;
      case 'settings': showSettings(); break;
      case 'help': showHelp(); break;
    }
    if (btn) btn.blur();
  }

  function updateZoomLabel() {
    const el = document.getElementById('zoom-label');
    if (el) el.textContent = Math.round(GD.board.scale() * 100) + ' %';
  }

  function updateHistoryButtons() {
    const u = document.querySelector('[data-act="undo"]');
    const r = document.querySelector('[data-act="redo"]');
    if (u) u.disabled = !GD.store.canUndo();
    if (r) r.disabled = !GD.store.canRedo();
  }

  function updateEmptyHint() {
    const el = document.getElementById('board-empty');
    if (el) el.classList.toggle('is-hidden', GD.store.doc.windows.length > 0);
  }

  /** Zähler an der Werkzeugleiste und Zustand des Sicht-Schalters */
  function updateAenderungen() {
    const zahl = document.getElementById('aend-zahl');
    const knopf = document.getElementById('btn-diff');
    const stand = GD.aenderungen.stand();
    if (zahl) {
      zahl.textContent = String(stand.zahlen.gesamt);
      zahl.hidden = !stand.zahlen.gesamt;
    }
    if (knopf) {
      knopf.classList.toggle('is-on', GD.aenderungen.sicht());
      knopf.classList.toggle('has-offen', stand.zahlen.gesamt > 0);
    }
  }

  /* ---------------------------------------------------------- Inspector */

  function row(label, node) {
    return U.el('div', { class: 'insp-row' }, [U.el('label', { text: label }), node]);
  }
  function fullRow(node) { return U.el('div', { class: 'insp-row insp-row--full' }, [node]); }
  function title(text) { return U.el('div', { class: 'insp-title', text: text }); }
  function section(children) { return U.el('div', { class: 'insp-sec' }, children); }

  function numField(value, onInput, opts) {
    const o = opts || {};
    const inp = U.el('input', { type: 'number', class: 'fld', value: value });
    if (o.min !== undefined) inp.min = o.min;
    if (o.max !== undefined) inp.max = o.max;
    if (o.step !== undefined) inp.step = o.step;
    inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) onInput(v); });
    inp.addEventListener('change', () => { if (o.onCommit) o.onCommit(); });
    inp.addEventListener('keydown', (ev) => ev.stopPropagation());
    return inp;
  }

  function sliderRow(label, value, min, max, step, onInput, onCommit) {
    const out = U.el('span', { text: String(value), style: { color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', minWidth: '34px', textAlign: 'right' } });
    const s = U.el('input', { type: 'range', min: min, max: max, step: step, value: value });
    s.addEventListener('input', () => { out.textContent = s.value; onInput(parseFloat(s.value)); });
    s.addEventListener('change', () => onCommit && onCommit(parseFloat(s.value)));
    return row(label, U.el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [s, out]));
  }

  function selectRow(label, value, options, onChange) {
    const sel = U.el('select', { class: 'fld' });
    for (const [v, t] of options) {
      const o = U.el('option', { value: v, text: t });
      if (v === value) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    return row(label, sel);
  }

  function swatchRow(current, onPick) {
    const host = U.el('div', { class: 'swatches' });
    for (const c of SWATCHES) {
      const s = U.el('button', { class: 'swatch' + (c.toLowerCase() === String(current).toLowerCase() ? ' is-on' : ''), style: { background: c }, title: c });
      s.addEventListener('click', () => onPick(c));
      host.appendChild(s);
    }
    return host;
  }

  function renderInspector() {
    if (!inspHost) return;
    inspHost.innerHTML = '';
    const bund = GD.connections.selectedBundle();
    if (bund) { renderBundleInspector(bund); return; }
    const conn = GD.connections.selected();
    if (conn) { renderConnectionInspector(conn); return; }
    const sel = GD.windows.selection();
    if (sel.length === 1) { renderWindowInspector(sel[0]); return; }
    if (sel.length > 1) { renderMultiInspector(sel); return; }
    renderBoardInspector();
  }

  /* ------------------------------------------------ Inspector: Fenster */

  function renderWindowInspector(d) {
    const def = GD.modules.get(d.type) || GD.modules.fallback(d.type);
    inspHost.appendChild(title('Fenster'));

    const nameInp = U.el('input', { type: 'text', class: 'fld', value: d.title });
    nameInp.addEventListener('input', () => GD.windows.setTitle(d.id, nameInp.value));
    nameInp.addEventListener('change', () => GD.store.commit('Fenster umbenannt'));
    nameInp.addEventListener('keydown', (ev) => ev.stopPropagation());

    const geo = (key, label) => numField(Math.round(d[key]), (v) => {
      GD.windows.setGeometry(d.id, { [key]: Math.round(v) });
    }, { onCommit: () => GD.store.commit('Geometrie geändert') });

    inspHost.appendChild(section([
      row('Titel', nameInp),
      row('Modul', U.el('div', { text: def.icon + '  ' + def.label, style: { color: 'var(--text-dim)' } })),
      row('Position', U.el('div', { class: 'insp-grid2' }, [geo('x'), geo('y')])),
      row('Größe', U.el('div', { class: 'insp-grid2' }, [geo('w'), geo('h')]))
    ]));

    const colorSec = section([
      U.el('div', { class: 'insp-row' }, [U.el('label', { text: 'Farbe' }), U.el('span', {})]),
      swatchRow(d.accent || def.accent, (c) => { GD.windows.setAccent(d.id, c); renderInspector(); })
    ]);
    inspHost.appendChild(colorSec);

    const btns = U.el('div', { class: 'insp-grid2', style: { padding: '8px 12px 0' } }, [
      mkBtn('Duplizieren', () => GD.windows.duplicate(d.id)),
      mkBtn(d.collapsed ? 'Ausklappen' : 'Einklappen', () => { GD.windows.setCollapsed(d.id, !d.collapsed); renderInspector(); }),
      mkBtn('Nach vorn', () => GD.windows.bringToFront(d.id)),
      mkBtn('Nach hinten', () => GD.windows.sendToBack(d.id)),
      mkBtn('Einpassen', () => GD.board.zoomToFit({ x: d.x, y: d.y, w: d.w, h: d.h })),
      mkBtn('Löschen', () => GD.windows.remove(d.id), 'btn--danger')
    ]);
    inspHost.appendChild(section([btns]));

    // Modul-eigener Inspector
    const rec = GD.windows.get(d.id);
    if (rec && rec.inst && rec.inst.inspector) {
      const host = U.el('div');
      inspHost.appendChild(host);
      try { rec.inst.inspector(host); } catch (e) { console.warn('[GD] Modul-Inspector:', e); }
    }
  }

  function mkBtn(label, onClick, cls) {
    const b = U.el('button', { class: 'btn ' + (cls || ''), text: label });
    b.addEventListener('click', onClick);
    return b;
  }

  /* ------------------------------------------ Inspector: Mehrfachauswahl */

  function renderMultiInspector(sel) {
    inspHost.appendChild(title(sel.length + ' Fenster ausgewählt'));

    const align = (fn, label) => mkBtn(label, () => {
      const box = bounds(sel);
      for (const d of sel) fn(d, box);
      for (const d of sel) GD.windows.setGeometry(d.id, {});
      GD.connections.redraw();
      GD.store.commit('Ausgerichtet');
    }, 'btn--sm');

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-title', text: 'Ausrichten' }),
      U.el('div', { class: 'insp-grid3', style: { padding: '0 12px' } }, [
        align((d, b) => { d.x = b.x; }, 'Links'),
        align((d, b) => { d.x = b.x + (b.w - d.w) / 2; }, 'Mitte'),
        align((d, b) => { d.x = b.x + b.w - d.w; }, 'Rechts'),
        align((d, b) => { d.y = b.y; }, 'Oben'),
        align((d, b) => { d.y = b.y + (b.h - d.h) / 2; }, 'Zentriert'),
        align((d, b) => { d.y = b.y + b.h - d.h; }, 'Unten')
      ])
    ]));

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-title', text: 'Verteilen' }),
      U.el('div', { class: 'insp-grid2', style: { padding: '0 12px' } }, [
        mkBtn('Horizontal', () => distribute(sel, 'x'), 'btn--sm'),
        mkBtn('Vertikal', () => distribute(sel, 'y'), 'btn--sm')
      ])
    ]));

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-row insp-row--full' }, [
        mkBtn(sel.length + ' Fenster löschen', () => GD.windows.removeSelected(), 'btn--danger')
      ])
    ]));
  }

  function bounds(list) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const d of list) {
      x1 = Math.min(x1, d.x); y1 = Math.min(y1, d.y);
      x2 = Math.max(x2, d.x + d.w); y2 = Math.max(y2, d.y + d.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  function distribute(sel, axis) {
    const size = axis === 'x' ? 'w' : 'h';
    const list = sel.slice().sort((a, b) => a[axis] - b[axis]);
    if (list.length < 3) { ui.toast('Mindestens 3 Fenster nötig'); return; }
    const first = list[0], last = list[list.length - 1];
    const total = (last[axis] + last[size]) - first[axis];
    const used = list.reduce((s, d) => s + d[size], 0);
    const gap = (total - used) / (list.length - 1);
    let cursor = first[axis];
    for (const d of list) { d[axis] = Math.round(cursor); cursor += d[size] + gap; }
    for (const d of list) GD.windows.setGeometry(d.id, {});
    GD.connections.redraw();
    GD.store.commit('Verteilt');
  }

  /* -------------------------------------------- Inspector: Verbindung */

  function renderConnectionInspector(c) {
    inspHost.appendChild(title('Verbindung'));

    const labelInp = U.el('input', { type: 'text', class: 'fld', value: c.label, placeholder: 'Beschriftung…' });
    labelInp.addEventListener('input', () => GD.connections.update(c.id, { label: labelInp.value }));
    labelInp.addEventListener('change', () => GD.store.commit('Beschriftung geändert'));
    labelInp.addEventListener('keydown', (ev) => ev.stopPropagation());

    inspHost.appendChild(section([
      row('Text', labelInp),
      sliderRow('Schriftgröße', c.labelSize, 6, 42, 1,
        (v) => GD.connections.update(c.id, { labelSize: v }),
        () => GD.store.commit('Schriftgröße geändert')),
      U.el('div', { class: 'insp-note', text: 'Die Beschriftung behält beim Zoomen immer diese Pixelgröße.' }),
      U.el('div', { class: 'insp-row insp-row--full' }, [
        mkBtn(c.t === null || c.t === undefined ? 'Steht frei auf dem längsten Stück' : 'Wieder frei stellen',
          () => { GD.connections.update(c.id, { t: null }, 'Beschriftung frei gestellt'); renderInspector(); })
      ])
    ]));

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-row' }, [U.el('label', { text: 'Farbe' }), U.el('span', {})]),
      swatchRow(c.color, (col) => { GD.connections.update(c.id, { color: col }, 'Pfeilfarbe geändert'); renderInspector(); }),
      sliderRow('Stärke', c.width, 0.5, 12, 0.5,
        (v) => GD.connections.update(c.id, { width: v }),
        () => GD.store.commit('Stärke geändert')),
      selectRow('Linie', c.dash, [['solid', 'durchgezogen'], ['dashed', 'gestrichelt'], ['dotted', 'gepunktet']],
        (v) => GD.connections.update(c.id, { dash: v }, 'Linienstil geändert')),
      selectRow('Verlauf', c.curve, [['ortho', 'rechtwinklig'], ['straight', 'gerade'], ['bezier', 'geschwungen']],
        (v) => GD.connections.update(c.id, { curve: v }, 'Verlauf geändert')),
      selectRow('Spitzen', c.heads, [['end', 'am Ziel'], ['start', 'am Start'], ['both', 'beidseitig'], ['none', 'keine']],
        (v) => GD.connections.update(c.id, { heads: v }, 'Pfeilspitzen geändert'))
    ]));

    const fromWin = GD.store.getWindow(c.from.win), toWin = GD.store.getWindow(c.to.win);
    inspHost.appendChild(section([
      U.el('div', { class: 'insp-title', text: 'Ankerpunkte' }),
      selectRow('Von: ' + (fromWin ? shorten(fromWin.title) : '?'), c.from.side, SIDES,
        (v) => GD.connections.update(c.id, { from: { win: c.from.win, side: v, shape: c.from.shape || null } }, 'Anker geändert')),
      selectRow('Zu: ' + (toWin ? shorten(toWin.title) : '?'), c.to.side, SIDES,
        (v) => GD.connections.update(c.id, { to: { win: c.to.win, side: v, shape: c.to.shape || null } }, 'Anker geändert')),
      elementAnchorRow('Von', c, 'from'),
      elementAnchorRow('Zu', c, 'to'),
      U.el('div', { class: 'insp-row insp-row--full' }, [
        mkBtn('Richtung umkehren', () => {
          GD.connections.update(c.id, { from: c.to, to: c.from }, 'Richtung umgekehrt');
          renderInspector();
        })
      ])
    ]));

    /* ------------------------------------------------------------ Bündel */
    const buendel = GD.connections.bundles();
    const wahl = [['', '— keins —']].concat(buendel.map((b) => [b.id, b.name + ' (' + GD.connections.mitglieder(b.id).length + ')']));
    inspHost.appendChild(section([
      U.el('div', { class: 'insp-title', text: 'Bündel' }),
      row('Läuft in', F_sel(c.bundle || '', wahl, (v) => {
        GD.connections.update(c.id, { bundle: v || null }, v ? 'Zu Bündel gelegt' : 'Aus Bündel gelöst');
        renderInspector();
      })),
      U.el('div', { class: 'insp-row insp-row--full' }, [
        mkBtn(c.bundle ? 'Bündel zeigen' : 'Neues Bündel aus diesem Pfeil', () => {
          if (c.bundle) GD.connections.selectBundle(c.bundle);
          else GD.connections.addBundle([c.id], 'Bündel');
        })
      ]),
      U.el('div', { class: 'insp-note', text: 'Mehrere Pfeile im selben Bündel laufen in der Mitte nebeneinander durch einen Strang. Doppelklick auf den Strang zieht ihn auf und zu.' })
    ]));

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-row insp-row--full' }, [
        mkBtn('Verbindung löschen', () => GD.connections.remove(c.id), 'btn--danger')
      ])
    ]));
  }

  /* ---------------------------------------------- Inspector: Bündel */

  function renderBundleInspector(b) {
    const mit = GD.connections.mitglieder(b.id);
    inspHost.appendChild(title('Bündel'));

    const nameInp = U.el('input', { type: 'text', class: 'fld', value: b.name, placeholder: 'Name…' });
    nameInp.addEventListener('input', () => GD.connections.updateBundle(b.id, { name: nameInp.value }));
    nameInp.addEventListener('change', () => GD.store.commit('Bündel benannt'));
    nameInp.addEventListener('keydown', (ev) => ev.stopPropagation());

    inspHost.appendChild(section([
      row('Name', nameInp),
      row('Adern', U.el('div', { text: String(mit.length), style: { color: 'var(--text-dim)' } })),
      U.el('div', { class: 'insp-row insp-row--full' }, [
        mkBtn(b.collapsed ? 'Strang aufziehen' : 'Strang zuziehen',
          () => { GD.connections.toggleBundle(b.id); renderInspector(); })
      ])
    ]));

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-row' }, [U.el('label', { text: 'Farbe' }), U.el('span', {})]),
      swatchRow(b.color, (col) => { GD.connections.updateBundle(b.id, { color: col }, 'Bündelfarbe'); renderInspector(); }),
      sliderRow('Dicke', b.width, 0.5, 14, 0.5,
        (v) => GD.connections.updateBundle(b.id, { width: v }),
        () => GD.store.commit('Bündeldicke')),
      sliderRow('Abstand der Adern', b.spreizung, 3, 40, 1,
        (v) => GD.connections.updateBundle(b.id, { spreizung: v }),
        () => GD.store.commit('Aderabstand')),
      sliderRow('Länge des Strangs', b.laenge, 60, 1400, 10,
        (v) => GD.connections.updateBundle(b.id, { laenge: v }),
        () => GD.store.commit('Stranglänge'))
    ]));

    const liste = U.el('div', { class: 'insp-liste' });
    for (const c of mit) {
      const zeile = U.el('div', { class: 'insp-liste__zeile' }, [
        U.el('span', { class: 'insp-liste__punkt', style: { background: c.color } }),
        U.el('span', { class: 'insp-liste__text', text: c.label || 'ohne Beschriftung' }),
        mkBtn('lösen', () => {
          GD.connections.update(c.id, { bundle: null }, 'Aus Bündel gelöst');
          renderInspector();
        }, 'btn--sm')
      ]);
      zeile.addEventListener('pointerenter', () => GD.connections.hoverConnection(c.id, true));
      zeile.addEventListener('pointerleave', () => GD.connections.hoverConnection(c.id, false));
      liste.appendChild(zeile);
    }
    inspHost.appendChild(section([U.el('div', { class: 'insp-title', text: 'Adern' }), liste]));

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-row insp-row--full' }, [
        mkBtn('Bündel auflösen', () => GD.connections.removeBundle(b.id), 'btn--danger')
      ]),
      U.el('div', { class: 'insp-note', text: 'Die Pfeile bleiben — sie laufen danach wieder einzeln.' })
    ]));
  }

  /** kleiner Helfer: Auswahlfeld wie in F.sel, aber hier im ui-Modul */
  function F_sel(value, options, onChange) {
    const el = U.el('select', { class: 'fld' });
    for (const [v, t] of options) el.appendChild(U.el('option', { value: v, text: t }));
    el.value = value;
    el.addEventListener('change', () => onChange(el.value));
    return el;
  }

  function shorten(s) { return s.length > 14 ? s.slice(0, 13) + '…' : s; }

  /** Hängt dieses Pfeilende an einem einzelnen Wireframe-Element? */
  function elementAnchorRow(label, c, end) {
    const ep = c[end];
    if (!ep.shape) return null;
    const rec = GD.windows.get(ep.win);
    const name = rec && rec.inst && rec.inst.shapeLabel ? rec.inst.shapeLabel(ep.shape) : null;
    const box = U.el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [
      U.el('span', { text: name || 'Element (fehlt)', style: { flex: '1', color: name ? 'var(--accent)' : 'var(--warn)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
      mkBtn('lösen', () => {
        const patch = {};
        patch[end] = { win: ep.win, side: ep.side, shape: null };
        GD.connections.update(c.id, patch, 'Vom Element gelöst');
        renderInspector();
      }, 'btn--sm')
    ]);
    return row(label + ': Element', box);
  }

  /* ------------------------------------------------- Inspector: Board */

  function renderBoardInspector() {
    const doc = GD.store.doc;
    inspHost.appendChild(title('Board'));

    inspHost.appendChild(section([
      row('Fenster', U.el('div', { text: String(doc.windows.length), style: { color: 'var(--text-dim)' } })),
      row('Pfeile', U.el('div', { text: String(doc.connections.length), style: { color: 'var(--text-dim)' } })),
      row('Zoom', U.el('div', { text: Math.round(GD.board.scale() * 100) + ' %', style: { color: 'var(--text-dim)' } }))
    ]));

    const gridSize = numField(doc.grid.size, (v) => {
      doc.grid.size = U.clamp(Math.round(v), 4, 200);
      GD.board.apply();
    }, { min: 4, max: 200, step: 1, onCommit: () => GD.store.commit('Raster geändert') });

    const showChk = U.el('input', { type: 'checkbox', checked: doc.grid.show });
    showChk.addEventListener('change', () => { GD.board.setGridVisible(showChk.checked); setToggle('toggle-grid', showChk.checked); });

    const snapChk = U.el('input', { type: 'checkbox', checked: doc.grid.snap });
    snapChk.addEventListener('change', () => {
      doc.grid.snap = snapChk.checked; setToggle('toggle-snap', snapChk.checked); GD.store.touch();
    });

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-title', text: 'Raster' }),
      row('Rastermaß', gridSize),
      row('Anzeigen', showChk),
      row('Einrasten', snapChk),
      U.el('div', { class: 'insp-note', text: 'Alt gedrückt halten schaltet das Einrasten kurzzeitig aus.' })
    ]));

    inspHost.appendChild(section([
      U.el('div', { class: 'insp-title', text: 'Datei' }),
      U.el('div', { class: 'insp-grid2', style: { padding: '0 12px' } }, [
        mkBtn('Speichern', async () => { await GD.store.exportFile(); ui.toast('Board gespeichert', 'ok'); }),
        mkBtn('Öffnen…', () => GD.app.importBoard()),
        mkBtn('Neues Board', () => GD.app.newBoard()),
        mkBtn('Tastenkürzel', () => showHelp())
      ]),
      U.el('div', { class: 'insp-note', text: 'Das Board wird laufend automatisch im Browser gespeichert. „Speichern" legt zusätzlich eine .json-Datei ab.' })
    ]));

    inspHost.appendChild(U.el('div', { class: 'insp-empty' }, [
      U.el('div', { text: 'Fenster oder Pfeil anklicken, um Eigenschaften zu bearbeiten.' })
    ]));
  }

  /* ------------------------------------------------------- Kontextmenü */

  function bindContextMenu() {
    document.addEventListener('pointerdown', (ev) => {
      const menu = document.getElementById('ctxmenu');
      if (!menu.hidden && !ev.target.closest('#ctxmenu')) hideMenu();
    }, true);
    window.addEventListener('blur', hideMenu);
    GD.board.events.on('view', hideMenu);

    document.getElementById('board').addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const winEl = ev.target.closest('.gd-win');
      const connEl = ev.target.closest('.conn-hit, .conn-label');

      if (connEl) {
        const id = connEl.dataset.id || (connEl.parentNode && connEl.parentNode.dataset.id);
        GD.connections.select(id);
        ui.contextMenu(ev.clientX, ev.clientY, [
          { head: 'Verbindung' },
          { label: 'Beschriften', icon: '✎', run: () => GD.connections.editLabel(id) },
          { label: 'Richtung umkehren', icon: '⇄', run: () => {
            const c = GD.store.getConnection(id);
            if (c) { GD.connections.update(id, { from: c.to, to: c.from }, 'Richtung umgekehrt'); renderInspector(); }
          } },
          '-',
          { label: 'Löschen', icon: '🗑', key: 'Entf', danger: true, run: () => GD.connections.remove(id) }
        ]);
        return;
      }

      if (winEl) {
        const id = winEl.dataset.id;
        const d = GD.store.getWindow(id);
        if (!GD.windows.selectionIds().includes(id)) GD.windows.select([id]);
        ui.contextMenu(ev.clientX, ev.clientY, [
          { head: d ? d.title : 'Fenster' },
          { label: 'Duplizieren', icon: '⧉', key: 'Strg+D', run: () => GD.windows.duplicate(id) },
          { label: d && d.collapsed ? 'Ausklappen' : 'Einklappen', icon: '▾', run: () => GD.windows.setCollapsed(id, !(d && d.collapsed)) },
          { label: 'Nach vorn', icon: '⬆', run: () => GD.windows.bringToFront(id) },
          { label: 'Nach hinten', icon: '⬇', run: () => GD.windows.sendToBack(id) },
          { label: 'Einpassen', icon: '⤢', run: () => d && GD.board.zoomToFit({ x: d.x, y: d.y, w: d.w, h: d.h }) },
          '-',
          { label: 'Löschen', icon: '🗑', key: 'Entf', danger: true, run: () => GD.windows.removeSelected() }
        ]);
        return;
      }

      const p = GD.board.screenToWorld(ev.clientX, ev.clientY);
      const items = [{ head: 'Modul hinzufügen' }];
      for (const def of GD.modules.list()) {
        items.push({ label: def.label, icon: def.icon, run: () => GD.windows.add(def.id, p.x, p.y) });
      }
      items.push('-',
        { label: 'Springen zu …', icon: '⌕', key: 'Strg+F', run: () => GD.suche.oeffnen() },
        { label: 'Alles auswählen', icon: '▣', key: 'Strg+A', run: () => GD.windows.selectAll() },
        { label: 'Alles einpassen', icon: '⤢', key: 'Strg+1', run: () => GD.board.zoomToFit() },
        { label: 'Zoom 100 %', icon: '◎', key: 'Strg+0', run: () => GD.board.resetZoom() });
      ui.contextMenu(ev.clientX, ev.clientY, items);
    });
  }

  /* ------------------------------------------------------------ Tasten */

  function bindKeys() {
    window.addEventListener('keydown', (ev) => {
      if (U.isTyping(ev.target)) return;

      // Zuerst das aktive Modul fragen
      const inst = GD.windows.activeInstance();
      if (inst && inst.onKey && inst.onKey(ev) === true) { ev.preventDefault(); return; }

      const ctrl = ev.ctrlKey || ev.metaKey;
      const k = ev.key;

      if (ctrl && (k === 'z' || k === 'Z')) { ev.preventDefault(); ev.shiftKey ? GD.app.redo() : GD.app.undo(); return; }
      if (ctrl && (k === 'y' || k === 'Y')) { ev.preventDefault(); GD.app.redo(); return; }
      // vor Strg+A und Strg+D prüfen — die fragen nicht nach der Umschalttaste
      if (ctrl && ev.shiftKey && (k === 'a' || k === 'A')) { ev.preventDefault(); showAenderungen(); return; }
      if (ctrl && ev.shiftKey && (k === 'd' || k === 'D')) { ev.preventDefault(); runAction('toggle-diff'); return; }
      if (ctrl && (k === 'd' || k === 'D')) {
        ev.preventDefault();
        const ids = GD.windows.selectionIds();
        if (ids.length === 1) GD.windows.duplicate(ids[0]);
        return;
      }
      if (ctrl && (k === 'a' || k === 'A')) { ev.preventDefault(); GD.windows.selectAll(); return; }
      /* Strg+F nimmt dem Browser seine eigene Suche weg — und das ist auch
         gemeint: Dessen Suche findet nur, was gerade gezeichnet ist, also
         das, was ohnehin vor einem liegt. */
      if (ctrl && (k === 'f' || k === 'F')) { ev.preventDefault(); GD.suche.oeffnen(); return; }
      if (ctrl && (k === 's' || k === 'S')) { ev.preventDefault(); GD.app.saveBoard(); return; }
      if (ctrl && (k === 'o' || k === 'O')) { ev.preventDefault(); GD.app.importBoard(); return; }
      if (ctrl && (k === 'p' || k === 'P')) { ev.preventDefault(); showLibrary(); return; }
      if (ctrl && (k === '0')) { ev.preventDefault(); GD.board.resetZoom(); return; }
      if (ctrl && (k === '1')) { ev.preventDefault(); GD.board.zoomToFit(); return; }
      if (ctrl && (k === '+' || k === '=')) { ev.preventDefault(); GD.board.zoomBy(1.25); return; }
      if (ctrl && (k === '-' || k === '_')) { ev.preventDefault(); GD.board.zoomBy(0.8); return; }

      if (k === 'Delete' || k === 'Backspace') {
        if (GD.connections.selectedId()) { ev.preventDefault(); GD.connections.removeSelected(); return; }
        if (GD.windows.selectionIds().length) { ev.preventDefault(); GD.windows.removeSelected(); return; }
      }
      if (k === 'Escape') { GD.windows.select([]); GD.connections.select(null); hideMenu(); return; }
      if (k === '?' || (k === '/' && ev.shiftKey)) { ev.preventDefault(); showHelp(); return; }

      /* Pfeiltasten verschieben die Auswahl, mit Strg ändern sie die Größe.
         Das ist nicht nur bequem: Es ist der einzige Weg, der bei JEDEM
         Zoom auf den Pixel genau arbeitet. Ein Griff ist herausgezoomt
         immer ein Kompromiss — eine Taste nie. */
      if (k.startsWith('Arrow') && GD.windows.selectionIds().length) {
        ev.preventDefault();
        const step = ev.shiftKey ? GD.store.doc.grid.size : 1;
        const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
        const dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
        if (ctrl) {
          for (const d of GD.windows.selection()) GD.windows.setGeometry(d.id, { w: d.w + dx, h: d.h + dy });
          commitGroesse();
        } else {
          for (const d of GD.windows.selection()) GD.windows.setGeometry(d.id, { x: d.x + dx, y: d.y + dy });
          commitNudge();
        }
        GD.connections.redraw();
      }
    });
  }

  const commitNudge = U.debounce(() => GD.store.commit('Verschoben'), 450);
  const commitGroesse = U.debounce(() => GD.store.commit('Größe geändert'), 450);

  /* --------------------------------------------------- Projekt-Bibliothek */

  const fmtDatum = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    const heute = new Date();
    const gleich = d.toDateString() === heute.toDateString();
    const zeit = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return gleich ? 'heute ' + zeit
      : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + zeit;
  };

  function modulKuerzel(module) {
    const namen = { frame: 'Rahmen', wireframe: 'Wireframe', notes: 'Notiz', code: 'Quelltext', media: 'Medien', model3d: '3D', modelview: '3D-Ansicht', sandbox: 'Sandbox', project: 'Projekt', worker: 'Worker' };
    return Object.keys(module || {})
      .sort((a, b) => module[b] - module[a])
      .map((k) => (namen[k] || k) + ' ' + module[k])
      .join(' · ');
  }

  function showLibrary() {
    const body = U.el('div', { class: 'lib' });
    const kopf = U.el('div', { class: 'lib-kopf' });
    const liste = U.el('div', { class: 'lib-liste' });
    const fuss = U.el('div', { class: 'modal-actions' });
    body.append(U.el('h2', { text: 'Projekte' }), kopf, liste, fuss);
    const m = ui.modal(body);

    async function zeichne(neu) {
      const s = GD.library.status();
      kopf.innerHTML = '';
      liste.innerHTML = '';

      const pfad = U.el('div', { class: 'lib-pfad' }, [
        U.el('span', { class: 'lib-pfad__icon', text: '🗀' }),
        U.el('span', {
          class: 'lib-pfad__text',
          text: s.bereit ? s.ordner : 'Noch kein Ordner festgelegt',
          title: s.ordner || ''
        }),
        mkBtn('Ordner ändern…', () => { m.close(); showSettings('bibliothek'); }, 'btn--sm'),
        mkBtn('↻', () => zeichne(true), 'btn--sm')
      ]);
      kopf.appendChild(pfad);

      if (!s.bereit) {
        liste.appendChild(U.el('div', { class: 'lib-leer' }, [
          U.el('p', { text: s.verfuegbar.server || s.verfuegbar.ordner
            ? 'Lege in den Einstellungen einen Ordner fest — dann erscheinen hier alle Tafeln daraus.'
            : 'Ordnerzugriff geht nur, wenn GameDesk über den mitgelieferten Server läuft (GameDesk starten.bat) oder in Chrome/Edge geöffnet ist.' }),
          mkBtn('Zu den Einstellungen', () => { m.close(); showSettings('bibliothek'); })
        ]));
        return;
      }

      liste.appendChild(U.el('div', { class: 'lib-laedt', text: 'lese Ordner…' }));
      let projekte;
      try {
        projekte = await GD.library.liste(neu !== false);
      } catch (err) {
        liste.innerHTML = '';
        if (err && err.code === 'erlaubnis') {
          liste.appendChild(U.el('div', { class: 'lib-leer' }, [
            U.el('p', { text: 'Der Browser fragt nach der Erlaubnis für diesen Ordner — das geht nur auf Klick.' }),
            mkBtn('Ordner freigeben', async () => {
              try { await GD.library.ordnerFreigeben(); zeichne(true); }
              catch (e) { ui.toast(e.message, 'err'); }
            })
          ]));
        } else {
          liste.appendChild(U.el('div', { class: 'lib-leer' }, [U.el('p', { text: 'Fehler: ' + (err.message || err) })]));
        }
        return;
      }

      liste.innerHTML = '';
      const link = GD.library.link();
      if (!projekte.length) {
        liste.appendChild(U.el('div', { class: 'lib-leer' }, [
          U.el('p', { text: 'In diesem Ordner liegt noch keine GameDesk-Tafel.' })
        ]));
      }

      for (const p of projekte) {
        const aktiv = link && link.datei === p.datei;
        const row = U.el('div', { class: 'lib-zeile' + (aktiv ? ' is-on' : '') });
        row.append(
          U.el('div', { class: 'lib-zeile__haupt' }, [
            U.el('div', { class: 'lib-zeile__name', text: p.name }),
            U.el('div', { class: 'lib-zeile__meta', text: p.datei + '  ·  ' + p.fenster + ' Fenster · ' + p.pfeile + ' Pfeile' + (p.modelle ? ' · ' + p.modelle + ' Modelle' : '') }),
            U.el('div', { class: 'lib-zeile__module', text: modulKuerzel(p.module) })
          ]),
          U.el('div', { class: 'lib-zeile__datum', text: fmtDatum(p.geaendert) + '\n' + U.fmtBytes(p.groesse) })
        );

        const tools = U.el('div', { class: 'lib-zeile__tools' });
        tools.append(
          mkBtn('Öffnen', async () => {
            try { await GD.library.oeffnen(p.datei); m.close(); ui.toast('„' + p.name + '" geöffnet', 'ok'); }
            catch (e) { ui.toast('Öffnen fehlgeschlagen: ' + e.message, 'err'); }
          }, 'btn--sm'),
          mkBtn('Umbenennen', async () => {
            const neuName = prompt('Neuer Name:', p.name);
            if (!neuName || neuName === p.name) return;
            try { await GD.library.umbenennen(p.datei, neuName); zeichne(true); }
            catch (e) { ui.toast('Umbenennen fehlgeschlagen: ' + e.message, 'err'); }
          }, 'btn--sm'),
          mkBtn('Kopie', async () => {
            try {
              const doc = await GD.library.lesen(p.datei);
              doc.name = p.name + ' (Kopie)';
              await GD.library.schreiben(GD.library.dateiName(doc.name, p.datei), doc);
              zeichne(true);
            } catch (e) { ui.toast('Kopieren fehlgeschlagen: ' + e.message, 'err'); }
          }, 'btn--sm'),
          mkBtn('Löschen', async () => {
            const ok = await ui.confirm('Projekt löschen?', '„' + p.name + '" wird aus dem Ordner entfernt. Das lässt sich nicht rückgängig machen.', 'Löschen');
            if (!ok) return;
            try { await GD.library.loeschen(p.datei); zeichne(true); ui.toast('Gelöscht', 'ok'); }
            catch (e) { ui.toast('Löschen fehlgeschlagen: ' + e.message, 'err'); }
          }, 'btn--sm btn--danger')
        );
        row.appendChild(tools);
        row.addEventListener('dblclick', () => tools.firstChild.click());
        liste.appendChild(row);
      }
    }

    fuss.append(
      mkBtn('Neues Projekt…', async () => {
        const name = prompt('Name des neuen Projekts:', 'Neues Board');
        if (!name) return;
        try { await GD.library.neu(name); m.close(); ui.toast('„' + name + '" angelegt', 'ok'); }
        catch (e) { ui.toast('Anlegen fehlgeschlagen: ' + e.message, 'err'); }
      }),
      mkBtn('Aktuelles Board hier ablegen', async () => {
        const name = prompt('Unter welchem Namen ablegen?', GD.store.doc.name);
        if (!name) return;
        try {
          GD.store.doc.name = name;
          document.getElementById('board-name').value = name;
          await GD.library.sichern(GD.library.dateiName(name));
          m.close();
          ui.toast('In der Bibliothek gespeichert', 'ok');
        } catch (e) { ui.toast('Speichern fehlgeschlagen: ' + e.message, 'err'); }
      }),
      mkBtn('Schließen', () => m.close())
    );

    zeichne(true);
  }

  /* -------------------------------------------------------- Änderungen
   *
   * Das Änderungsfenster ist die Gegenstelle zur Änderungssicht auf dem
   * Brett: Es zählt auf, was seit dem letzten Commit anders ist, fasst es in
   * einem Satz zusammen und ist die einzige Stelle, an der ein neuer Commit
   * entsteht — von Hand oder mit „KI" als Urheber, wenn ein Skript die Arbeit
   * gemacht hat und der Mensch sie nur festhält.
   */

  const WER = { mensch: 'Mensch', ki: 'KI' };
  const ZIEL = { fenster: 'Kachel', pfeil: 'Pfeil', buendel: 'Bündel', modell: '3D-Modell', tafel: 'Tafel' };

  function klasseChip(art, zahl) {
    const k = GD.vergleich.KLASSEN[art];
    if (!k) return null;
    const el = U.el('span', { class: 'aend-chip' }, [
      U.el('b', { text: k.label }),
      zahl === undefined ? null : U.el('span', { text: String(zahl) })
    ]);
    el.style.setProperty('--diff-farbe', k.farbe);
    return el;
  }

  function showAenderungen() {
    const F = ui.fields;
    const body = U.el('div', { class: 'lib aend' });
    const kopf = U.el('div', { class: 'aend-kopf' });
    const liste = U.el('div', { class: 'aend-liste' });
    const formular = U.el('div', { class: 'aend-form' });
    const verlauf = U.el('div', { class: 'aend-verlauf' });

    body.append(
      U.el('h2', { text: 'Änderungen' }), kopf, liste,
      U.el('h3', { text: 'Stand festschreiben' }), formular,
      U.el('h3', { text: 'Commit-Verlauf' }), verlauf);

    const m = ui.modal(body);

    /* Mitlaufen, solange das Fenster offen ist. Geschlossen wird es über den
       Knopf, über Esc und über den Hintergrund — nur der Knopf käme hier
       vorbei. Deshalb hängt der Ausstieg am Zuhörer selbst: Ist der Kasten
       nicht mehr im Dokument, meldet er sich ab.
       Und: NICHT neu rechnen. Der Stand kommt mit der Meldung; wer hier
       rechnen ließe, stieße dieselbe Meldung wieder an. */
    const ab = GD.aenderungen.events.on('stand', (s) => {
      if (!document.contains(m.box)) { ab(); abSicht(); return; }
      zeichne(s);
    });
    const abSicht = GD.aenderungen.events.on('sicht', () => {
      if (!document.contains(m.box)) { ab(); abSicht(); return; }
      zeichne();
    });
    const schliessen = m.close;
    m.close = () => { ab(); abSicht(); schliessen(); };

    /* Entwurf des Commits — bleibt beim Neuzeichnen erhalten */
    const entwurf = { titel: '', text: '', wer: 'mensch' };

    function zeichneKopf(stand) {
      kopf.innerHTML = '';
      const b = GD.aenderungen.basis();
      kopf.appendChild(U.el('div', {
        class: 'aend-satz' + (stand.zahlen.gesamt ? '' : ' is-ruhig'),
        text: b ? stand.satz : 'Diese Tafel hat noch keinen Commit — bis zum ersten gilt alles als unverändert.'
      }));

      const chips = U.el('div', { class: 'aend-chips' });
      for (const art of Object.keys(stand.zahlen.jeKlasse)) {
        chips.appendChild(klasseChip(art, stand.zahlen.jeKlasse[art]));
      }
      if (chips.children.length) kopf.appendChild(chips);

      kopf.appendChild(U.el('div', { class: 'aend-basis' }, [
        U.el('span', {
          text: b
            ? 'Letzter Commit: „' + b.titel + '" · ' + fmtDatum(b.zeit) + ' · ' + (WER[b.wer] || b.wer)
            : 'Noch nichts festgeschrieben'
        }),
        mkBtn(GD.aenderungen.sicht() ? 'Änderungssicht aus' : 'Änderungssicht an', () => {
          const on = GD.aenderungen.sichtUmschalten();
          GD.store.prefs.diffsicht = on;
          GD.store.savePrefs();
        }, 'btn--sm')
      ]));
    }

    function zeichneListe(stand) {
      liste.innerHTML = '';
      if (!stand.punkte.length) {
        liste.appendChild(U.el('div', { class: 'lib-leer' }, [
          U.el('p', { text: GD.aenderungen.hatBasis()
            ? 'Nichts offen — der Stand auf dem Brett ist der des letzten Commits.'
            : 'Sobald ein Ausgangsstand festgeschrieben ist, steht hier jede Abweichung davon.' })
        ]));
        return;
      }
      for (const p of stand.punkte) {
        const def = p.ziel === 'fenster' ? (GD.modules.get(p.typ) || GD.modules.fallback(p.typ)) : null;
        const zeile = U.el('div', { class: 'aend-zeile' + (p.fehlt ? ' is-weg' : '') }, [
          klasseChip(p.art),
          U.el('div', { class: 'aend-zeile__haupt' }, [
            U.el('div', { class: 'aend-zeile__name' }, [
              U.el('span', { text: p.titel }),
              U.el('em', { text: def ? def.label : (ZIEL[p.ziel] || p.ziel) })
            ]),
            U.el('div', { class: 'aend-zeile__text', text: p.text })
          ]),
          (p.ziel === 'fenster' || p.ziel === 'pfeil')
            ? mkBtn('zeigen', () => { GD.aenderungen.zeige(p); }, 'btn--sm')
            : null
        ]);
        liste.appendChild(zeile);
      }
    }

    function zeichneFormular(stand) {
      formular.innerHTML = '';
      const erster = !GD.aenderungen.hatBasis();
      const nichts = !erster && !stand.zahlen.gesamt;

      const titel = U.el('input', { type: 'text', class: 'fld', value: entwurf.titel, placeholder: erster ? 'Ausgangsstand' : 'Was wurde gemacht?' });
      titel.addEventListener('input', () => { entwurf.titel = titel.value; });
      titel.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') schreibe(); });

      const text = U.el('textarea', { class: 'fld aend-text', rows: 3, value: entwurf.text, placeholder: 'Beschreibung (freiwillig)' });
      text.addEventListener('input', () => { entwurf.text = text.value; });
      text.addEventListener('keydown', (ev) => ev.stopPropagation());

      const wer = F.sel(entwurf.wer, [['mensch', 'Mensch — ich selbst'], ['ki', 'KI — von einem Agenten gemacht']], (v) => { entwurf.wer = v; });

      const knopf = mkBtn(erster ? 'Ausgangsstand festschreiben' : 'Festschreiben', () => schreibe());
      knopf.classList.add('aend-schreib');
      if (nichts) knopf.disabled = true;

      formular.append(
        F.row('Titel', titel),
        F.row('Beschreibung', text),
        F.row('Urheber', wer),
        F.full(knopf),
        F.note(erster
          ? 'Der erste Commit hält den heutigen Stand fest. Ab da zeigt die Änderungssicht jede Abweichung davon.'
          : 'Der Commit merkt sich den Abzug der Tafel und die obige Liste. Aus einem Skript heraus geht dasselbe über GD.aenderungen.festschreiben({ titel, wer: "ki" }).'));

      function schreibe() {
        const erg = GD.aenderungen.festschreiben({ titel: entwurf.titel, text: entwurf.text, wer: entwurf.wer });
        if (!erg.ok) { ui.toast(erg.grund, 'err'); return; }
        entwurf.titel = ''; entwurf.text = '';
        ui.toast('Festgeschrieben: ' + erg.commit.titel, 'ok');
        zeichne();
      }
    }

    function zeichneVerlauf() {
      verlauf.innerHTML = '';
      const commits = GD.aenderungen.commits();
      const basis = GD.aenderungen.basis();
      if (!commits.length) {
        verlauf.appendChild(U.el('div', { class: 'lib-leer' }, [U.el('p', { text: 'Noch kein Commit.' })]));
        return;
      }
      for (const c of commits) {
        const aktuell = basis && basis.id === c.id;
        const zeile = U.el('div', { class: 'aend-commit' + (aktuell ? ' is-basis' : '') });
        const kopfZeile = U.el('div', { class: 'aend-commit__kopf' }, [
          U.el('span', { class: 'aend-commit__wer aend-commit__wer--' + c.wer, text: WER[c.wer] || c.wer }),
          U.el('div', {}, [
            U.el('div', { class: 'aend-commit__titel', text: c.titel || '(ohne Titel)' }),
            U.el('div', { class: 'aend-commit__meta', text: fmtDatum(c.zeit) + '  ·  ' + (c.zahlen.gesamt || 0) + ' Änderungen' + (c.gekuerzt ? ' (' + c.gekuerzt + " nicht mitgeschrieben)" : '') })
          ]),
          U.el('span', { style: { flex: '1' } }),
          (c.punkte || []).length ? mkBtn('▾', () => {
            inhalt.hidden = !inhalt.hidden;
          }, 'btn--sm') : null,
          aktuell ? U.el('span', { class: 'aend-commit__basis', text: 'Basis' })
            : mkBtn('Löschen', async () => {
              const ok = await ui.confirm('Commit löschen?', '„' + c.titel + '" verschwindet aus dem Verlauf. Die Basis für den Vergleich bleibt, wo sie ist.', 'Löschen');
              if (!ok) return;
              if (GD.aenderungen.commitLoeschen(c.id)) { zeichne(); ui.toast('Commit gelöscht', 'ok'); }
            }, 'btn--sm btn--danger')
        ]);
        const inhalt = U.el('div', { class: 'aend-commit__inhalt', hidden: true });
        if (c.text) inhalt.appendChild(U.el('p', { class: 'aend-commit__text', text: c.text }));
        for (const p of c.punkte || []) {
          inhalt.appendChild(U.el('div', { class: 'aend-commit__punkt' }, [
            klasseChip(p.art),
            U.el('span', { text: p.titel + ' — ' + p.text })
          ]));
        }
        zeile.append(kopfZeile, inhalt);
        verlauf.appendChild(zeile);
      }
    }

    function zeichne(vorhanden) {
      const stand = vorhanden || GD.aenderungen.stand(true);
      zeichneKopf(stand);
      zeichneListe(stand);
      zeichneFormular(stand);
      zeichneVerlauf();
    }

    body.appendChild(U.el('div', { class: 'modal-actions' }, [mkBtn('Schließen', () => m.close())]));
    zeichne();
  }

  /* ----------------------------------------------------- Einstellungen */

  function showSettings(fokus) {
    const F = ui.fields;
    const body = U.el('div', { class: 'lib' });
    body.appendChild(U.el('h2', { text: 'Einstellungen' }));
    const bib = U.el('div');
    body.appendChild(bib);
    const m = ui.modal(body);

    function zeichneBib() {
      const s = GD.library.status();
      bib.innerHTML = '';
      bib.appendChild(U.el('h3', { text: 'Projektordner' }));

      const wahl = [];
      if (s.verfuegbar.server) wahl.push(['server', 'GameDesk-Server (Pfad frei eingeben)']);
      if (s.verfuegbar.ordner) wahl.push(['ordner', 'Ordnerdialog des Browsers']);
      if (!wahl.length) {
        bib.appendChild(U.el('p', { class: 'set-hinweis', text: 'Weder Server noch Ordnerdialog stehen zur Verfügung. Starte GameDesk über „GameDesk starten.bat" oder öffne es in Chrome bzw. Edge — dann lässt sich hier ein Ordner festlegen.' }));
        return;
      }

      bib.appendChild(F.row('Zugriff über', F.sel(s.modus, wahl, async (v) => {
        try { await GD.library.setModus(v); zeichneBib(); }
        catch (e) { ui.toast(e.message, 'err'); zeichneBib(); }
      })));

      if (s.modus === 'server') {
        const feld = U.el('input', { type: 'text', class: 'fld', value: s.ordner || '', spellcheck: false, placeholder: 'C:\\Users\\…\\Meine Projekte' });
        feld.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') uebernehmen(); });
        const anlegen = U.el('input', { type: 'checkbox' });
        async function uebernehmen() {
          try {
            await GD.library.serverOrdnerSetzen(feld.value.trim(), anlegen.checked);
            ui.toast('Ordner übernommen', 'ok');
            zeichneBib();
          } catch (e) { ui.toast(e.message, 'err'); }
        }
        bib.appendChild(F.row('Ordner', feld));
        bib.appendChild(F.row('Anlegen, falls er fehlt', anlegen));
        bib.appendChild(F.full(F.grid(2, [
          F.btn('Übernehmen', uebernehmen),
          F.btn('Auf boards/ zurücksetzen', async () => {
            try { await GD.library.serverOrdnerSetzen('boards', true); zeichneBib(); } catch (e) { ui.toast(e.message, 'err'); }
          })
        ])));
        bib.appendChild(F.note('Der Pfad wird im Server gemerkt (tools/bibliothek.json) und gilt beim nächsten Start wieder. Gelesen und geschrieben wird ausschließlich innerhalb dieses Ordners.'));
      } else {
        bib.appendChild(F.row('Ordner', U.el('div', { text: s.ordner || '— keiner —', style: { color: s.ordner ? 'var(--accent)' : 'var(--text-faint)' } })));
        bib.appendChild(F.full(F.grid(2, [
          F.btn('Ordner wählen…', async () => {
            try { await GD.library.ordnerWaehlen(); ui.toast('Ordner übernommen', 'ok'); zeichneBib(); }
            catch (e) { if (e.name !== 'AbortError') ui.toast(e.message, 'err'); }
          }),
          F.btn('Zugriff erneuern', async () => {
            try { await GD.library.ordnerFreigeben(); ui.toast('Zugriff erteilt', 'ok'); zeichneBib(); }
            catch (e) { ui.toast(e.message, 'err'); }
          })
        ])));
        bib.appendChild(F.note('Der Ordner wird gemerkt. Nach einem Neustart des Browsers fragt er einmal nach der Erlaubnis — das ist eine Sicherheitsvorgabe des Browsers, kein Fehler.'));
      }

      const link = GD.library.link();
      bib.appendChild(F.row('Dieses Board', U.el('div', {
        text: link ? link.datei : 'noch keiner Datei zugeordnet',
        style: { color: link ? 'var(--ok)' : 'var(--text-faint)', fontSize: '11.5px' }
      })));
      if (link) {
        bib.appendChild(F.full(F.btn('Verknüpfung lösen', () => { GD.library.entkoppeln(); zeichneBib(); updateSaveButton(); })));
      }

      const auto = GD.store.prefs.autoDatei === true;
      bib.appendChild(F.row('Automatisch in die Datei', F.chk(auto, (v) => {
        GD.store.prefs.autoDatei = v; GD.store.savePrefs();
        ui.toast(v ? 'Änderungen werden laufend in die Projektdatei geschrieben' : 'Automatisches Schreiben aus');
      })));
      bib.appendChild(F.note('Aus: Das Board liegt weiter im Browser-Speicher, in die Datei geht es erst über „Speichern". Ein: Jede Änderung landet wenige Sekunden später auch in der Datei.'));
    }

    zeichneBib();

    body.appendChild(U.el('h3', { text: 'Darstellung' }));
    body.appendChild(F.row('Erscheinungsbild', F.sel(document.documentElement.dataset.theme, [['dark', 'dunkel'], ['light', 'hell']], (v) => {
      if (v !== document.documentElement.dataset.theme) GD.app.toggleTheme();
    })));
    body.appendChild(F.row('Übersichtskarte', F.chk(GD.store.prefs.minimap !== false, (v) => {
      GD.store.prefs.minimap = v; GD.store.savePrefs(); GD.minimap.setVisible(v); setToggle('toggle-minimap', v);
    })));
    body.appendChild(F.row('Raster anzeigen', F.chk(GD.store.doc.grid.show, (v) => {
      GD.board.setGridVisible(v); setToggle('toggle-grid', v);
    })));
    body.appendChild(F.row('Einrasten', F.chk(GD.store.doc.grid.snap, (v) => {
      GD.store.doc.grid.snap = v; setToggle('toggle-snap', v); GD.store.touch();
    })));
    body.appendChild(F.row('Rastermaß', F.num(GD.store.doc.grid.size, (v) => {
      GD.store.doc.grid.size = U.clamp(Math.round(v), 4, 200); GD.board.apply();
    }, { min: 4, max: 200, onCommit: () => GD.store.commit('Raster geändert') })));

    body.appendChild(U.el('h3', { text: 'Anordnung' }));
    const befund = U.el('div');
    body.appendChild(befund);

    function zeichneBefund() {
      const b = GD.layout.pruefe();
      befund.innerHTML = '';
      befund.appendChild(U.el('div', {
        class: 'set-befund' + (b.ok ? ' is-ok' : b.sauber ? '' : ' is-warn'),
        text: (b.ok ? '✓  ' : '·  ') + b.text
      }));
      for (const p of b.punkte) {
        const zeile = U.el('div', { class: 'set-punkt' + (p.schwere === 'warn' ? ' is-warn' : '') }, [
          U.el('span', { class: 'set-punkt__regel', text: 'Regel ' + p.regel }),
          U.el('span', { class: 'set-punkt__text', text: p.text })
        ]);
        if (p.ids && p.ids.length) {
          zeile.appendChild(F.btn('zeigen', () => {
            GD.windows.select(p.ids);
            const erste = GD.store.getWindow(p.ids[0]);
            if (erste) GD.board.zoomToFit({ x: erste.x, y: erste.y, w: erste.w, h: erste.h });
          }, 'btn--sm'));
        }
        befund.appendChild(zeile);
      }
      befund.appendChild(F.full(F.grid(2, [
        F.btn('Jetzt anordnen', () => { runAction('layout'); zeichneBefund(); }),
        F.btn('Erneut prüfen', zeichneBefund)
      ])));
      befund.appendChild(F.note('Geprüft wird: Text vollständig sichtbar · keine Überlappungen · Rahmen sitzen am Inhalt · Bereiche benannt und in ihrer Reihenfolge.'));
    }
    zeichneBefund();

    body.appendChild(U.el('h3', { text: 'Speicher' }));
    let belegt = 0;
    try { belegt = (localStorage.getItem('gamedesk.doc.v1') || '').length; } catch (e) { /* egal */ }
    body.appendChild(F.note('Browser-Speicher dieses Boards: ' + U.fmtBytes(belegt) +
      ' · Module: ' + GD.modules.list().length + ' · Fenster: ' + GD.store.doc.windows.length));
    body.appendChild(F.full(F.btn('Als Datei exportieren', async () => { await GD.store.exportFile(); ui.toast('Datei abgelegt', 'ok'); })));

    body.appendChild(U.el('div', { class: 'modal-actions' }, [mkBtn('Schließen', () => m.close())]));

    if (fokus === 'bibliothek') bib.scrollIntoView({ block: 'start' });
  }

  /** Der Zurück-Knopf steht nur da, wenn man auch irgendwo hergekommen ist */
  function updateBackButton() {
    const btn = document.getElementById('btn-zurueck');
    if (!btn || !GD.library || !GD.library.verlauf) return;
    const weg = GD.library.verlauf();
    btn.hidden = !weg.length;
    if (weg.length) {
      const her = weg[weg.length - 1];
      btn.title = 'Zurück zu ' + her + (weg.length > 1 ? '  (' + weg.length + ' Ebenen tief)' : '');
    }
  }

  /** Beschriftung des Speichern-Knopfes an die Verknüpfung anpassen */
  function updateSaveButton() {
    const btn = document.getElementById('btn-save');
    if (!btn || !GD.library) return;
    const link = GD.library.link();
    btn.textContent = 'Speichern';
    btn.title = link
      ? 'Schreibt in ' + link.datei + '  (Strg+S)'
      : 'Legt eine .json-Datei ab. Über „Projekte" lässt sich ein Ordner festlegen.  (Strg+S)';
    btn.classList.toggle('tb-btn--linked', !!link);
  }

  ui.showLibrary = showLibrary;
  ui.showSettings = showSettings;
  ui.showAenderungen = showAenderungen;
  ui.updateSaveButton = updateSaveButton;
  ui.updateBackButton = updateBackButton;

  /* -------------------------------------------------------------- Hilfe */

  function showHelp() {
    const kb = (keys, what) => [U.el('kbd', { text: keys }), U.el('span', { text: what })];
    const body = U.el('div', {}, [
      U.el('h2', { text: 'GameDesk — Bedienung' }),
      U.el('h3', { text: 'Board' }),
      U.el('div', { class: 'kbd-list' }, [].concat(
        kb('Ziehen', 'Board verschieben (leere Fläche oder mittlere Maustaste)'),
        kb('Leertaste + Ziehen', 'Board überall verschieben'),
        kb('Mausrad', 'Zoomen an der Mausposition'),
        kb('Umschalt + Ziehen', 'Auswahlrechteck'),
        kb('Strg + 0 / 1', 'Zoom 100 % / alles einpassen'),
        kb('Rechtsklick', 'Kontextmenü')
      )),
      U.el('h3', { text: 'Springen zu …' }),
      U.el('div', { class: 'kbd-list' }, [].concat(
        kb('Strg + F', 'Kachel oder Pfeil suchen — in Titeln, Notizen, Quelltexten, Beschriftungen'),
        kb('Hoch / Runter', 'Durch die Treffer blättern; die Kamera fährt mit'),
        kb('Eingabe', 'Dort bleiben'),
        kb('Esc', 'Zurück dorthin, wo man vor dem Suchen war')
      )),
      U.el('h3', { text: 'Fenster' }),
      U.el('div', { class: 'kbd-list' }, [].concat(
        kb('Ziehen an der Leiste', 'Verschieben (rastet an Kanten und Mitten ein)'),
        kb('Alt halten', 'Einrasten vorübergehend aus'),
        kb('Ränder ziehen', 'Größe ändern — die Kante leuchtet auf, wenn die Maus nah ist'),
        kb('Klick auf den Titel', 'Umbenennen (Ziehen verschiebt weiter)'),
        kb('Doppelklick Leiste', 'Ein-/Ausklappen'),
        kb('Strg + D', 'Duplizieren'),
        kb('Entf', 'Löschen'),
        kb('Pfeiltasten', 'Verschieben (Umschalt = Rastermaß)'),
        kb('Strg + Pfeiltasten', 'Größe ändern — auf den Pixel, bei jedem Zoom')
      )),
      U.el('h3', { text: 'Weit herausgezoomt' }),
      U.el('div', { class: 'kbd-list' }, [].concat(
        kb('Viertelkreis oben rechts', 'Erscheint unter 55 % Zoom: Ziehen verschiebt die Kachel samt Inhalt'),
        kb('Maus in seine Nähe', 'Der Griff tritt aus der Durchsichtigkeit hervor'),
        kb('Maus an einen Rand', 'Die nächste Kante leuchtet auf — dort ändert man die Größe'),
        kb('Griffe und Knöpfe', 'Behalten ihre Bildschirmgröße; sie schrumpfen nicht mit')
      )),
      U.el('h3', { text: 'Pfeile' }),
      U.el('div', { class: 'kbd-list' }, [].concat(
        kb('⊕ am Rand ziehen', 'Pfeil zu einem anderen Fenster ziehen'),
        kb('⊕ nur anklicken', 'Pfeil hängt am Zeiger — dann das Ziel anklicken (Esc bricht ab)'),
        kb('Doppelklick auf Pfeil', 'Beschriften'),
        kb('Beschriftung ziehen', 'Position am Pfeil verschieben'),
        kb('Inspector', 'Farbe, Stärke, Stil, Schriftgröße, Ankerpunkte')
      )),
      U.el('h3', { text: '3D-Modell' }),
      U.el('div', { class: 'kbd-list' }, [].concat(
        kb('Ziehen (leer)', 'Kamera drehen · mittlere Taste schwenkt · Mausrad = Abstand'),
        kb('Objekt ziehen', 'Bewegen in der Bodenebene'),
        kb('Sonne ziehen', 'Stern im Bild anfassen — sie läuft auf einer Kugelbahn'),
        kb('L', 'Sonne aus- bzw. abwählen'),
        kb('Strg', 'nur Y-Achse (hoch/runter)'),
        kb('Alt', 'nur X-Achse'),
        kb('Strg + Alt', 'nur Z-Achse'),
        kb('Umschalt', 'Einrasten aus (Abstand im Inspector einstellbar)'),
        kb('G / R / S', 'Bewegen / Drehen / Skalieren'),
        kb('F', 'Alles einpassen')
      )),
      U.el('h3', { text: 'Änderungen' }),
      U.el('div', { class: 'kbd-list' }, [].concat(
        kb('Strg + Umschalt + A', 'Änderungsfenster: Liste, Zusammenfassung, Commit'),
        kb('Strg + Umschalt + D', 'Änderungssicht ein/aus (roter Kasten je Änderung)'),
        kb('⬚ in der Leiste', 'Derselbe Schalter; die Zahl daneben zählt das Offene'),
        kb('Klick auf einen Reiter', 'Zur geänderten Kachel springen')
      )),
      U.el('h3', { text: 'Allgemein' }),
      U.el('div', { class: 'kbd-list' }, [].concat(
        kb('Strg + Z / Y', 'Rückgängig / Wiederherstellen'),
        kb('Strg + P', 'Projekte im Bibliotheksordner'),
        kb('⤡ Anordnen', 'Höhen messen, Überlappungen auflösen, Rahmen nachziehen'),
        kb('← Zurück', 'Aus einer Projekt-Kachel wieder heraus'),
        kb('Strg + S', 'In die Projektdatei schreiben (sonst als Datei ablegen)'),
        kb('Strg + O', 'Datei von außen öffnen'),
        kb('Strg + A', 'Alles auswählen'),
        kb('Esc', 'Auswahl aufheben'),
        kb('?', 'Diese Hilfe')
      ))
    ]);
    const actions = U.el('div', { class: 'modal-actions' }, [mkBtn('Schließen', () => m.close())]);
    body.appendChild(actions);
    const m = ui.modal(body);
  }

  GD.ui = ui;
})();
