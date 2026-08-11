/* GameDesk — Modul „Notiz": Text mit Überschriften, Listen, Auszeichnungen */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const BLOCKS = [
    ['p', 'Text', 'Fließtext'],
    ['h1', 'H1', 'Überschrift 1'],
    ['h2', 'H2', 'Überschrift 2'],
    ['h3', 'H3', 'Überschrift 3'],
    ['blockquote', '❝', 'Zitat'],
    ['pre', '‹›', 'Code']
  ];

  const MARKS = [
    ['bold', 'B', 'Fett (Strg+B)', 'font-weight:800'],
    ['italic', 'I', 'Kursiv (Strg+I)', 'font-style:italic'],
    ['underline', 'U', 'Unterstrichen (Strg+U)', 'text-decoration:underline'],
    ['strikeThrough', 'S', 'Durchgestrichen', 'text-decoration:line-through']
  ];

  const TEXT_COLORS = ['#e6eaf2', '#9aa4b6', '#6ea8fe', '#57c98a', '#e8b45c', '#ef6b6b', '#b78cf7', '#1b2029'];
  const HIGHLIGHTS = ['transparent', '#fff4a3', '#c8f0d4', '#cfe3ff', '#ffd6d6', '#ecd9ff'];

  GD.modules.register({
    id: 'notes',
    label: 'Notiz',
    icon: '≡',
    description: 'Text, Überschriften, Listen',
    accent: '#57c98a',
    defaultSize: { w: 380, h: 300 },
    defaultTitle: 'Notiz',

    create(ctx) {
      const state = Object.assign({ html: '<p><br></p>', fontSize: 14 }, ctx.state || {});

      const editor = U.el('div', {
        class: 'nt-editor',
        contentEditable: 'true',
        spellcheck: true,
        dataset: { gdScroll: '1' }
      });
      editor.innerHTML = state.html || '<p><br></p>';
      editor.style.fontSize = state.fontSize + 'px';

      const bar = U.el('div', { class: 'nt-bar' });
      const root = U.el('div', { class: 'nt-root' }, [bar, editor]);

      /* ---------------------------------------------------- Werkzeuge */

      function cmd(name, value) {
        editor.focus();
        try { document.execCommand('styleWithCSS', false, name === 'foreColor' || name === 'hiliteColor'); } catch (e) { /* egal */ }
        document.execCommand(name, false, value === undefined ? null : value);
        markChanged();
        syncActive();
      }

      function btn(label, tipp, onClick, css) {
        const b = U.el('button', { class: 'nt-btn', title: tipp, text: label });
        if (css) b.setAttribute('style', css);
        b.addEventListener('mousedown', (ev) => ev.preventDefault());
        b.addEventListener('click', onClick);
        return b;
      }

      const blockSel = U.el('select', { class: 'nt-select', title: 'Absatzformat' });
      for (const [tag, short, name] of BLOCKS) blockSel.appendChild(U.el('option', { value: tag, text: name }));
      blockSel.addEventListener('mousedown', (ev) => ev.stopPropagation());
      blockSel.addEventListener('change', () => cmd('formatBlock', '<' + blockSel.value + '>'));
      bar.appendChild(blockSel);
      bar.appendChild(U.el('span', { class: 'nt-sep' }));

      const markBtns = {};
      for (const [c, label, tipp, css] of MARKS) {
        const b = btn(label, tipp, () => cmd(c), css);
        markBtns[c] = b;
        bar.appendChild(b);
      }
      bar.appendChild(U.el('span', { class: 'nt-sep' }));

      bar.appendChild(btn('•', 'Aufzählung', () => cmd('insertUnorderedList')));
      bar.appendChild(btn('1.', 'Nummerierte Liste', () => cmd('insertOrderedList')));
      bar.appendChild(btn('☐', 'Aufgabenliste', () => toggleTodo()));
      bar.appendChild(U.el('span', { class: 'nt-sep' }));

      bar.appendChild(btn('⇤', 'Linksbündig', () => cmd('justifyLeft')));
      bar.appendChild(btn('↔', 'Zentriert', () => cmd('justifyCenter')));
      bar.appendChild(btn('⇥', 'Rechtsbündig', () => cmd('justifyRight')));
      bar.appendChild(U.el('span', { class: 'nt-sep' }));

      bar.appendChild(makePopup('A', 'Textfarbe', TEXT_COLORS, (c) => cmd('foreColor', c)));
      bar.appendChild(makePopup('▨', 'Markierung', HIGHLIGHTS, (c) => cmd('hiliteColor', c)));
      bar.appendChild(btn('🔗', 'Link einfügen', () => {
        const url = prompt('Adresse (URL):', 'https://');
        if (url) cmd('createLink', url);
      }));
      bar.appendChild(btn('⌫', 'Formatierung entfernen', () => cmd('removeFormat')));

      function makePopup(label, tipp, colors, onPick) {
        const wrap = U.el('div', { class: 'nt-pop' });
        const b = btn(label, tipp, () => { wrap.classList.toggle('is-open'); });
        const panel = U.el('div', { class: 'nt-pop__panel' });
        for (const c of colors) {
          const s = U.el('button', { class: 'nt-color', style: { background: c === 'transparent' ? 'repeating-linear-gradient(45deg,#888 0 4px,#bbb 4px 8px)' : c }, title: c });
          s.addEventListener('mousedown', (ev) => ev.preventDefault());
          s.addEventListener('click', () => { onPick(c); wrap.classList.remove('is-open'); });
          panel.appendChild(s);
        }
        wrap.append(b, panel);
        return wrap;
      }

      /* ------------------------------------------------ Aufgabenlisten */

      function toggleTodo() {
        editor.focus();
        const sel = document.getSelection();
        if (!sel.rangeCount) return;
        let node = sel.getRangeAt(0).startContainer;
        if (node.nodeType === 3) node = node.parentNode;
        const li = node.closest && node.closest('li');
        if (li) {
          const ul = li.parentNode;
          ul.classList.toggle('nt-todo');
          for (const item of ul.children) {
            if (ul.classList.contains('nt-todo')) item.dataset.done = item.dataset.done || '0';
            else delete item.dataset.done;
          }
        } else {
          document.execCommand('insertUnorderedList');
          let n = document.getSelection().anchorNode;
          if (n && n.nodeType === 3) n = n.parentNode;
          const newLi = n && n.closest ? n.closest('li') : null;
          if (newLi) {
            newLi.parentNode.classList.add('nt-todo');
            newLi.dataset.done = '0';
          }
        }
        markChanged();
      }

      editor.addEventListener('click', (ev) => {
        const li = ev.target.closest('li');
        if (!li || !li.parentNode.classList.contains('nt-todo')) return;
        const r = li.getBoundingClientRect();
        const scale = GD.board.scale() || 1;
        if ((ev.clientX - r.left) / scale < 20) {
          li.dataset.done = li.dataset.done === '1' ? '0' : '1';
          markChanged();
          ctx.commit('Aufgabe abgehakt');
        }
      });

      /* -------------------------------------------------------- Bindung */

      const markChanged = U.debounce(() => {
        state.html = editor.innerHTML;
        ctx.changed();
      }, 250);
      const commitLater = U.debounce(() => { state.html = editor.innerHTML; ctx.commit('Notiz bearbeitet'); }, 1400);

      editor.addEventListener('input', () => { markChanged(); commitLater(); });
      editor.addEventListener('blur', () => { state.html = editor.innerHTML; });
      editor.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Tab') {
          ev.preventDefault();
          document.execCommand(ev.shiftKey ? 'outdent' : 'indent');
        }
      });
      editor.addEventListener('keyup', syncActive);
      editor.addEventListener('mouseup', syncActive);
      editor.addEventListener('paste', (ev) => {
        // Nur Text übernehmen, damit fremdes HTML das Layout nicht sprengt
        const text = ev.clipboardData && ev.clipboardData.getData('text/plain');
        if (text === null || text === undefined) return;
        ev.preventDefault();
        document.execCommand('insertText', false, text);
      });

      function syncActive() {
        for (const [c] of MARKS) {
          let on = false;
          try { on = document.queryCommandState(c); } catch (e) { /* egal */ }
          markBtns[c].classList.toggle('is-on', on);
        }
        let block = 'p';
        try {
          const v = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
          if (BLOCKS.some(([t]) => t === v)) block = v;
        } catch (e) { /* egal */ }
        blockSel.value = block;
      }

      /* ------------------------------------------------------ Schnittstelle */

      return {
        el: root,

        getState() { return { html: editor.innerHTML, fontSize: state.fontSize }; },

        setState(next) {
          if (!next) return;
          state.html = next.html || '<p><br></p>';
          state.fontSize = next.fontSize || 14;
          editor.innerHTML = state.html;
          editor.style.fontSize = state.fontSize + 'px';
        },

        onSelect(on) { root.classList.toggle('is-active', on); },

        /** Höhe, bei der der ganze Text im Fenster steht (für GD.layout) */
        inhaltsHoehe(breite) {
          return bar.offsetHeight + GD.layout.textHoehe(editor.innerHTML, breite, state.fontSize);
        },

        inspector(host) {
          host.appendChild(U.el('div', { class: 'insp-title', text: 'Notiz' }));
          const out = U.el('span', {
            text: state.fontSize + ' px',
            style: { color: 'var(--text-dim)', minWidth: '42px', textAlign: 'right' }
          });
          const slider = U.el('input', { type: 'range', min: 10, max: 32, step: 1, value: state.fontSize });
          slider.addEventListener('input', () => {
            state.fontSize = parseInt(slider.value, 10);
            editor.style.fontSize = state.fontSize + 'px';
            out.textContent = state.fontSize + ' px';
            ctx.changed();
          });
          slider.addEventListener('change', () => ctx.commit('Schriftgröße geändert'));
          host.appendChild(U.el('div', { class: 'insp-row' }, [
            U.el('label', { text: 'Grundgröße' }),
            U.el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [slider, out])
          ]));

          const exportBtn = U.el('button', { class: 'btn', text: 'Als Textdatei sichern' });
          exportBtn.addEventListener('click', () => {
            const tmp = document.createElement('div');
            tmp.innerHTML = editor.innerHTML;
            U.download((ctx.win.get().title || 'notiz') + '.txt', tmp.innerText, 'text/plain');
          });
          host.appendChild(U.el('div', { class: 'insp-row insp-row--full' }, [exportBtn]));
        }
      };
    }
  });
})();
