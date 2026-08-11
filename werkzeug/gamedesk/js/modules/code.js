/* GameDesk — Modul „Quelltext": Codeausschnitt mit Herkunft anzeigen
 *
 * Zum Dokumentieren, nicht zum Ausführen — dafür gibt es die Sandbox. Zeigt
 * Pfad, Zeilennummern und hebt einzelne Zeilen hervor.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const KEYWORDS = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
    'class', 'interface', 'type', 'enum', 'export', 'import', 'from', 'as', 'new', 'await', 'async',
    'readonly', 'extends', 'implements', 'null', 'undefined', 'true', 'false', 'this', 'throw', 'try',
    'catch', 'finally', 'switch', 'case', 'default', 'break', 'continue', 'typeof', 'instanceof',
    'number', 'string', 'boolean', 'void', 'unknown', 'never', 'any', 'public', 'private', 'static',
    'def', 'elif', 'lambda', 'None', 'True', 'False', 'self'];

  const TOKEN = new RegExp(
    '(//[^\\n]*|#[^\\n]*|/\\*[\\s\\S]*?\\*/)' +                    // 1 Kommentar
    "|('(?:[^'\\\\\\n]|\\\\.)*'|\"(?:[^\"\\\\\\n]|\\\\.)*\"|`(?:[^`\\\\]|\\\\.)*`)" +  // 2 Zeichenkette
    '|\\b(' + KEYWORDS.join('|') + ')\\b' +                        // 3 Schlüsselwort
    '|\\b(\\d+(?:\\.\\d+)?)\\b', 'g');                             // 4 Zahl

  function highlight(code) {
    let out = '', last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(code))) {
      out += U.escapeHtml(code.slice(last, m.index));
      const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
      out += '<span class="cd-' + cls + '">' + U.escapeHtml(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + U.escapeHtml(code.slice(last));
  }

  GD.modules.register({
    id: 'code',
    label: 'Quelltext',
    icon: '⌗',
    description: 'Codeausschnitt mit Pfad',
    accent: '#8fa4c4',
    defaultSize: { w: 520, h: 300 },
    defaultTitle: 'Quelltext',

    create(ctx) {
      const state = Object.assign({
        path: '', code: '', firstLine: 1, size: 11.5, wrap: false, marks: [], caption: ''
      }, ctx.state || {});

      const pathEl = U.el('span', { class: 'cd-path' });
      const copyBtn = U.el('button', { class: 'cd-btn', text: '⧉', title: 'Code kopieren' });
      const editBtn = U.el('button', { class: 'cd-btn', text: '✎', title: 'Bearbeiten' });
      const head = U.el('div', { class: 'cd-head' }, [pathEl, U.el('span', { style: { flex: '1' } }), copyBtn, editBtn]);

      const gutter = U.el('div', { class: 'cd-gutter' });
      const codeEl = U.el('pre', { class: 'cd-code' });
      const marks = U.el('div', { class: 'cd-marks' });
      const scroll = U.el('div', { class: 'cd-scroll', dataset: { gdScroll: '1' } }, [marks, gutter, codeEl]);
      const editor = U.el('textarea', { class: 'cd-editor', spellcheck: false });
      const caption = U.el('div', { class: 'cd-caption' });
      const root = U.el('div', { class: 'cd-root' }, [head, scroll, editor, caption]);
      editor.style.display = 'none';

      function paint() {
        pathEl.textContent = state.path || '(ohne Pfad)';
        pathEl.title = state.path || '';
        codeEl.style.fontSize = state.size + 'px';
        gutter.style.fontSize = state.size + 'px';
        codeEl.style.whiteSpace = state.wrap ? 'pre-wrap' : 'pre';
        codeEl.innerHTML = highlight(state.code || '');

        const lines = (state.code || '').split('\n').length;
        let g = '';
        for (let i = 0; i < lines; i++) g += (state.firstLine + i) + '\n';
        gutter.textContent = g;

        marks.innerHTML = '';
        const lh = state.size * 1.55;
        for (const n of state.marks || []) {
          const idx = n - state.firstLine;
          if (idx < 0 || idx >= lines) continue;
          marks.appendChild(U.el('div', { class: 'cd-mark', style: { top: (idx * lh) + 'px', height: lh + 'px' } }));
        }
        caption.textContent = state.caption || '';
        caption.style.display = state.caption ? '' : 'none';
      }
      paint();

      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(state.code || '');
          ctx.toast('Code kopiert', 'ok');
        } catch (e) {
          const ta = U.el('textarea', { value: state.code || '', style: { position: 'fixed', opacity: '0' } });
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); ctx.toast('Code kopiert', 'ok'); } catch (e2) { ctx.toast('Kopieren nicht möglich', 'err'); }
          ta.remove();
        }
      });

      editBtn.addEventListener('click', () => {
        const editing = editor.style.display !== 'none';
        if (editing) {
          state.code = editor.value;
          editor.style.display = 'none';
          scroll.style.display = '';
          paint();
          ctx.commit('Quelltext geändert');
        } else {
          editor.value = state.code || '';
          editor.style.display = '';
          scroll.style.display = 'none';
          editor.focus();
        }
        editBtn.classList.toggle('is-on', !editing);
      });
      editor.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Tab') {
          ev.preventDefault();
          const s = editor.selectionStart;
          editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(editor.selectionEnd);
          editor.selectionStart = editor.selectionEnd = s + 2;
        }
      });

      return {
        el: root,
        getState() { return U.clone(state); },
        setState(next) { if (next) { Object.assign(state, next); paint(); } },

        /**
         * Höhe, bei der der ganze Ausschnitt sichtbar ist (für GD.layout).
         * Ohne Umbruch reicht Zeilenzahl × Zeilenhöhe; mit Umbruch hilft nur
         * messen, weil eine Quellzeile dann mehrere Bildschirmzeilen füllt.
         */
        inhaltsHoehe(breite) {
          const zeilen = (state.code || '').split('\n').length;
          const codeHoehe = state.wrap
            ? GD.layout.textHoehe(codeEl.innerHTML, breite - gutter.offsetWidth - 30, state.size,
                { klasse: 'cd-code', stil: { whiteSpace: 'pre-wrap', lineHeight: '1.55' } })
            : zeilen * state.size * 1.55;
          return head.offsetHeight + Math.ceil(codeHoehe) + 20 +     // 8 oben, 12 unten
                 (state.caption ? caption.offsetHeight : 0);
        },

        headerTools() {
          const b = U.el('button', { class: 'gd-win__btn', title: 'Pfad kopieren', text: '⎘' });
          b.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(state.path || ''); ctx.toast('Pfad kopiert', 'ok'); }
            catch (e) { ctx.toast('Kopieren nicht möglich', 'err'); }
          });
          return [b];
        },

        inspector(host) {
          const F = GD.ui.fields;
          host.appendChild(F.title('Quelltext'));
          host.appendChild(F.row('Pfad', F.text(state.path, (v) => { state.path = v; paint(); }, { onCommit: () => ctx.commit('Pfad') })));
          host.appendChild(F.row('Untertitel', F.text(state.caption, (v) => { state.caption = v; paint(); }, { onCommit: () => ctx.commit('Untertitel') })));
          host.appendChild(F.row('Erste Zeile', F.num(state.firstLine, (v) => { state.firstLine = Math.max(1, Math.round(v)); paint(); }, { min: 1, onCommit: () => ctx.commit('Zeilennummer') })));
          host.appendChild(F.row('Schriftgröße', F.range(state.size, 8, 20, 0.5, (v) => { state.size = v; paint(); }, () => ctx.commit('Schriftgröße'))));
          host.appendChild(F.row('Umbrechen', F.chk(state.wrap, (v) => { state.wrap = v; paint(); ctx.commit('Umbruch'); })));
          host.appendChild(F.row('Hervorheben', F.text((state.marks || []).join(', '), (v) => {
            state.marks = v.split(/[,\s]+/).map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
            paint();
          }, { onCommit: () => ctx.commit('Hervorhebung') })));
          host.appendChild(F.note('Zeilennummern zum Hervorheben, durch Komma getrennt. Das Stift-Symbol oben schaltet die Bearbeitung ein.'));
        }
      };
    }
  });
})();
