/* GameDesk — Modul „Code-Sandbox": HTML/CSS/JS testweise ausführen
 *
 * Der Code läuft in einem abgeschotteten <iframe> (sandbox="allow-scripts",
 * kein Zugriff auf dieses Dokument). Konsolenausgaben und Fehler werden per
 * postMessage zurückgemeldet.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const TEMPLATES = {
    leer: { html: '<div id="app">Hallo</div>', css: '#app { font: 16px sans-serif; padding: 16px; }', js: 'console.log("bereit");' },
    canvas: {
      html: '<canvas id="c" width="320" height="200"></canvas>',
      css: 'body{margin:0;background:#10131a}canvas{display:block;width:100%;height:100%}',
      js: [
        'const c = document.getElementById("c");',
        'const g = c.getContext("2d");',
        'let x = 20, y = 100, vx = 2.2, vy = 1.6;',
        'function frame() {',
        '  g.fillStyle = "#10131a"; g.fillRect(0, 0, c.width, c.height);',
        '  x += vx; y += vy;',
        '  if (x < 8 || x > c.width - 8) vx *= -1;',
        '  if (y < 8 || y > c.height - 8) vy *= -1;',
        '  g.fillStyle = "#6ea8fe";',
        '  g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();',
        '  requestAnimationFrame(frame);',
        '}',
        'frame();'
      ].join('\n')
    },
    ui: {
      html: '<button id="b">Angreifen</button>\n<p id="out">HP: 100</p>',
      css: 'body{font:14px sans-serif;padding:16px;background:#151922;color:#e6eaf2}\nbutton{padding:8px 14px;border-radius:8px;border:1px solid #6ea8fe;background:#1e2532;color:#e6eaf2;cursor:pointer}',
      js: [
        'let hp = 100;',
        'document.getElementById("b").addEventListener("click", () => {',
        '  hp = Math.max(0, hp - Math.ceil(Math.random() * 12));',
        '  document.getElementById("out").textContent = "HP: " + hp;',
        '  console.log("Treffer, HP =", hp);',
        '});'
      ].join('\n')
    },
    model: {
      html: '<canvas id="c" width="480" height="360"></canvas>',
      css: 'body{margin:0;background:#0f1218;color:#cfd6e4;font:12px sans-serif;overflow:hidden}\ncanvas{display:block;width:100%;height:100%}',
      js: [
        '// Gespeicherte 3D-Modelle stehen über GameDesk zur Verfügung.',
        'const c = document.getElementById("c"), g = c.getContext("2d");',
        'const first = GameDesk.models[0];',
        'console.log("Modelle:", GameDesk.models.map(m => m.name).join(", ") || "(keine)");',
        '',
        'if (!first) {',
        '  g.fillStyle = "#cfd6e4";',
        '  g.fillText("Erst im Modul \\u201e3D-Modell\\u201c etwas speichern.", 16, 28);',
        '} else GameDesk.geometry(first.name).then(m => {',
        '  console.log(m.name + ":", m.vertices + " Ecken,", m.triangles + " Dreiecke");',
        '  const P = m.position, I = m.index, N = m.normal;',
        '  let cx = 0, cy = 0, cz = 0, r = 0;',
        '  for (let i = 0; i < P.length; i += 3) { cx += P[i]; cy += P[i+1]; cz += P[i+2]; }',
        '  const n = P.length / 3; cx /= n; cy /= n; cz /= n;',
        '  for (let i = 0; i < P.length; i += 3) r = Math.max(r, Math.hypot(P[i]-cx, P[i+1]-cy, P[i+2]-cz));',
        '',
        '  const tris = [];',
        '  for (let i = 0; i < I.length; i += 3) tris.push(i);',
        '  const step = Math.max(1, Math.ceil(tris.length / 3500));   // Zeichenlast begrenzen',
        '',
        '  let a = 0;',
        '  function frame() {',
        '    a += 0.01;',
        '    const w = c.width, h = c.height, k = Math.min(w, h) * 0.38 / r;',
        '    g.fillStyle = "#0f1218"; g.fillRect(0, 0, w, h);',
        '    const ca = Math.cos(a), sa = Math.sin(a);',
        '    const list = [];',
        '    for (let t = 0; t < tris.length; t += step) {',
        '      const o = tris[t];',
        '      const pts = [], zs = [];',
        '      for (let v = 0; v < 3; v++) {',
        '        const j = I[o + v] * 3;',
        '        const x = P[j] - cx, y = P[j+1] - cy, z = P[j+2] - cz;',
        '        const rx = x * ca - z * sa, rz = x * sa + z * ca;',
        '        const ry = y * 0.86 - rz * 0.28;',
        '        pts.push([w/2 + rx*k, h/2 - ry*k]);',
        '        zs.push(rz);',
        '      }',
        '      const j0 = I[o] * 3;',
        '      const nx = N[j0], ny = N[j0+1], nz = N[j0+2];',
        '      const lz = nx*(ca*0.4 + sa*0.6) + ny*0.7 + nz*0.4;',
        '      list.push({ pts, z: (zs[0]+zs[1]+zs[2])/3, l: Math.max(0.12, lz) });',
        '    }',
        '    list.sort((p, q) => p.z - q.z);',
        '    for (const t of list) {',
        '      const c8 = Math.round(60 + t.l * 150);',
        '      g.fillStyle = "rgb(" + Math.round(c8*0.75) + "," + Math.round(c8*0.85) + "," + c8 + ")";',
        '      g.beginPath();',
        '      g.moveTo(t.pts[0][0], t.pts[0][1]);',
        '      g.lineTo(t.pts[1][0], t.pts[1][1]);',
        '      g.lineTo(t.pts[2][0], t.pts[2][1]);',
        '      g.closePath(); g.fill();',
        '    }',
        '    requestAnimationFrame(frame);',
        '  }',
        '  frame();',
        '}).catch(e => console.error(e));'
      ].join('\n')
    }
  };

  GD.modules.register({
    id: 'sandbox',
    label: 'Code-Sandbox',
    icon: '‹›',
    description: 'HTML / CSS / JS ausführen',
    accent: '#e8b45c',
    defaultSize: { w: 620, h: 400 },
    defaultTitle: 'Code-Sandbox',

    create(ctx) {
      const state = Object.assign({
        html: TEMPLATES.leer.html, css: TEMPLATES.leer.css, js: TEMPLATES.leer.js,
        tab: 'html', autorun: true, split: 0.5, showConsole: true
      }, ctx.state || {});

      const token = U.uid('sbx');

      /* --------------------------------------------------------- Aufbau */

      const tabs = U.el('div', { class: 'sb-tabs' });
      const area = U.el('textarea', { class: 'sb-code', spellcheck: false, wrap: 'off' });
      const left = U.el('div', { class: 'sb-left' }, [tabs, area]);

      const runBtn = U.el('button', { class: 'sb-btn sb-btn--run', text: '▶ Ausführen', title: 'Strg+Enter' });
      const autoChk = U.el('input', { type: 'checkbox', checked: state.autorun, id: 'auto_' + token });
      const conBtn = U.el('button', { class: 'sb-btn', text: 'Konsole', title: 'Konsole ein-/ausblenden' });
      const openBtn = U.el('button', { class: 'sb-btn', text: '↗', title: 'In neuem Tab öffnen' });
      const bar = U.el('div', { class: 'sb-bar' }, [
        runBtn,
        U.el('label', { class: 'sb-check' }, [autoChk, U.el('span', { text: 'automatisch' })]),
        U.el('span', { style: { flex: '1' } }),
        conBtn, openBtn
      ]);

      const frame = U.el('iframe', {
        class: 'sb-frame',
        sandbox: 'allow-scripts allow-modals allow-popups allow-forms allow-pointer-lock'
      });
      const consoleList = U.el('div', { class: 'sb-console', dataset: { gdScroll: '1' } });
      const consoleBox = U.el('div', { class: 'sb-console-box' }, [
        U.el('div', { class: 'sb-console-bar' }, [
          U.el('span', { text: 'Konsole' }),
          (() => {
            const b = U.el('button', { class: 'sb-btn sb-btn--tiny', text: 'leeren' });
            b.addEventListener('click', () => { consoleList.innerHTML = ''; });
            return b;
          })()
        ]),
        consoleList
      ]);
      const right = U.el('div', { class: 'sb-right' }, [bar, frame, consoleBox]);

      const divider = U.el('div', { class: 'sb-divider', title: 'Aufteilung ziehen' });
      const root = U.el('div', { class: 'sb-root' }, [left, divider, right]);

      applySplit();
      consoleBox.style.display = state.showConsole ? '' : 'none';

      /* ---------------------------------------------------------- Tabs */

      const TABS = [['html', 'HTML'], ['css', 'CSS'], ['js', 'JS']];
      const tabBtns = {};
      for (const [key, label] of TABS) {
        const b = U.el('button', { class: 'sb-tab', text: label });
        b.addEventListener('click', () => setTab(key));
        tabBtns[key] = b;
        tabs.appendChild(b);
      }

      function setTab(key) {
        state[state.tab] = area.value;
        state.tab = key;
        area.value = state[key] || '';
        for (const [k] of TABS) tabBtns[k].classList.toggle('is-on', k === key);
        ctx.changed();
      }
      setTab(state.tab || 'html');

      /* ------------------------------------------------------- Eingaben */

      area.addEventListener('input', () => {
        state[state.tab] = area.value;
        changed();
        if (autoChk.checked) scheduleRun();
      });
      area.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Tab') {
          ev.preventDefault();
          const s = area.selectionStart, e = area.selectionEnd;
          area.value = area.value.slice(0, s) + '  ' + area.value.slice(e);
          area.selectionStart = area.selectionEnd = s + 2;
          state[state.tab] = area.value;
          changed();
        }
        if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'Enter' || ev.key === 's' || ev.key === 'S')) {
          ev.preventDefault();
          run();
        }
      });

      runBtn.addEventListener('click', run);
      autoChk.addEventListener('change', () => { state.autorun = autoChk.checked; ctx.commit('Sandbox-Option'); });
      conBtn.addEventListener('click', () => {
        state.showConsole = !state.showConsole;
        consoleBox.style.display = state.showConsole ? '' : 'none';
        ctx.changed();
      });
      openBtn.addEventListener('click', () => {
        const w = window.open('', '_blank');
        if (!w) { ctx.toast('Pop-up wurde blockiert', 'err'); return; }
        w.document.open();
        w.document.write(buildDoc(false));
        w.document.close();
      });

      divider.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        const rect = root.getBoundingClientRect();
        U.drag(ev, {
          cursor: 'col-resize',
          onMove(dx, dy, e) {
            state.split = U.clamp((e.clientX - rect.left) / rect.width, 0.15, 0.85);
            applySplit();
          },
          onEnd(e, moved) { if (moved) ctx.commit('Aufteilung geändert'); }
        });
      });

      function applySplit() {
        root.style.gridTemplateColumns = (state.split * 100) + '% 6px 1fr';
      }

      const changed = U.debounce(() => ctx.changed(), 300);
      const commitLater = U.debounce(() => ctx.commit('Code bearbeitet'), 1600);
      const scheduleRun = U.debounce(() => run(), 700);

      /* ------------------------------------------------------ Ausführen */

      /** Modellbeschreibungen für das Skript im iframe (ohne Texturdaten) */
      function modelPayload() {
        return GD.models.all().map((m) => ({
          id: m.id, name: m.name, updated: m.updated,
          nodes: (m.scene.nodes || []).map((n) => {
            const o = {
              id: n.id, name: n.name, kind: n.kind,
              p: n.p, r: n.r, s: n.s, visible: n.visible !== false
            };
            if (n.kind === 'light') o.light = n.light;
            else if (n.kind === 'ref') o.modelId = n.modelId;
            else {
              o.params = n.params;
              o.material = {
                color: n.mat.color, rough: n.mat.rough, metal: n.mat.metal, opacity: n.mat.opacity,
                emissive: n.mat.emissive, emissiveStrength: n.mat.emissiveStrength,
                hasTexture: !!n.mat.texture
              };
            }
            return o;
          })
        }));
      }

      function buildDoc(withBridge) {
        const bridge = withBridge ? [
          '<script>(function(){',
          'var T=' + JSON.stringify(token) + ';',
          'var MODELS=' + JSON.stringify(modelPayload()).replace(/<\//g, '<\\/') + ';',
          'var pending={}, ctr=0;',
          'window.GameDesk={',
          ' models:MODELS,',
          ' getModel:function(x){return MODELS.filter(function(m){return m.id===x||m.name===x;})[0]||null;},',
          ' geometry:function(x){return new Promise(function(res,rej){',
          '  var id="g"+(++ctr); pending[id]={res:res,rej:rej};',
          '  parent.postMessage({__gdReq:"geometry",__gd:T,reqId:id,id:x},"*");',
          '  setTimeout(function(){if(pending[id]){delete pending[id];rej(new Error("Zeitüberschreitung"));}},6000);',
          ' });}',
          '};',
          'window.addEventListener("message",function(e){var d=e.data;',
          ' if(!d||d.__gdRes!==T)return; var p=pending[d.reqId]; if(!p)return; delete pending[d.reqId];',
          ' if(d.ok)p.res(d.data); else p.rej(new Error("Modell nicht gefunden"));});',
          'function send(level,args){try{parent.postMessage({__gd:T,level:level,args:args.map(function(a){',
          'try{if(a instanceof Error)return a.stack||String(a);return typeof a==="object"?JSON.stringify(a):String(a);}catch(e){return String(a);}',
          '})},"*");}catch(e){}}',
          'var C=window.console||{};["log","info","warn","error","debug"].forEach(function(m){',
          'var o=C[m]&&C[m].bind(C);C[m]=function(){send(m,[].slice.call(arguments));if(o)o.apply(null,arguments);};});',
          'window.console=C;',
          'window.addEventListener("error",function(e){send("error",[e.message+"  ("+(e.lineno||0)+":"+(e.colno||0)+")"]);});',
          'window.addEventListener("unhandledrejection",function(e){send("error",["Unbehandelte Zusage: "+e.reason]);});',
          '})();<\/script>'
        ].join('') : '';

        const js = String(state.js || '').replace(/<\/script/gi, '<\\/script');
        return [
          '<!doctype html><html lang="de"><head><meta charset="utf-8">',
          '<style>', String(state.css || ''), '</style></head><body>',
          String(state.html || ''),
          bridge,
          '<script>try{', js, '}catch(err){',
          'if(window.console&&console.error)console.error(err);',
          '}<\/script>',
          '</body></html>'
        ].join('');
      }

      function run() {
        state[state.tab] = area.value;
        consoleList.innerHTML = '';
        frame.srcdoc = buildDoc(true);
        commitLater();
      }

      function logLine(level, text) {
        const line = U.el('div', { class: 'sb-line sb-line--' + level }, [
          U.el('span', { class: 'sb-line__tag', text: level === 'error' ? '✕' : level === 'warn' ? '!' : '›' }),
          U.el('span', { text: text })
        ]);
        consoleList.appendChild(line);
        consoleList.scrollTop = consoleList.scrollHeight;
        while (consoleList.childNodes.length > 200) consoleList.removeChild(consoleList.firstChild);
      }

      function onMessage(ev) {
        if (!ev.data || ev.data.__gd !== token) return;
        if (ev.source !== frame.contentWindow) return;

        if (ev.data.__gdReq === 'geometry') {
          let baked = null;
          try { baked = GD.models.bake(ev.data.id); } catch (err) { console.warn('[GD] Backen:', err); }
          frame.contentWindow.postMessage({
            __gdRes: token, reqId: ev.data.reqId, ok: !!baked,
            data: baked ? {
              id: baked.id, name: baked.name,
              position: baked.position, normal: baked.normal, uv: baked.uv, index: baked.index,
              groups: baked.groups, lights: baked.lights,
              triangles: baked.triangles, vertices: baked.vertices
            } : null
          }, '*');
          return;
        }

        logLine(ev.data.level || 'log', (ev.data.args || []).join('  '));
      }
      window.addEventListener('message', onMessage);

      U.nextFrame(run);

      /* -------------------------------------------------- Schnittstelle */

      return {
        el: root,

        getState() { state[state.tab] = area.value; return U.clone(state); },

        setState(next) {
          if (!next) return;
          Object.assign(state, next);
          area.value = state[state.tab] || '';
          autoChk.checked = !!state.autorun;
          consoleBox.style.display = state.showConsole ? '' : 'none';
          applySplit();
          for (const [k] of TABS) tabBtns[k].classList.toggle('is-on', k === state.tab);
          run();
        },

        destroy() { window.removeEventListener('message', onMessage); frame.srcdoc = ''; },

        headerTools() {
          const b = U.el('button', { class: 'gd-win__btn', title: 'Ausführen (Strg+Enter)', text: '▶' });
          b.addEventListener('click', run);
          return [b];
        },

        inspector(host) {
          host.appendChild(U.el('div', { class: 'insp-title', text: 'Sandbox' }));

          const tpl = U.el('select', { class: 'fld' });
          tpl.appendChild(U.el('option', { value: '', text: 'Vorlage einsetzen…' }));
          for (const [v, t] of [['leer', 'Minimal'], ['canvas', 'Canvas-Animation'], ['ui', 'UI-Interaktion'], ['model', '3D-Modell verwenden']]) {
            tpl.appendChild(U.el('option', { value: v, text: t }));
          }
          tpl.addEventListener('change', async () => {
            const key = tpl.value;
            tpl.value = '';
            if (!key) return;
            const ok = await GD.ui.confirm('Vorlage einsetzen?', 'Der aktuelle Code in diesem Fenster wird ersetzt.', 'Ersetzen');
            if (!ok) return;
            Object.assign(state, U.clone(TEMPLATES[key]));
            area.value = state[state.tab] || '';
            run();
            ctx.commit('Vorlage eingesetzt');
          });
          host.appendChild(U.el('div', { class: 'insp-row insp-row--full' }, [tpl]));

          const auto = U.el('input', { type: 'checkbox', checked: state.autorun });
          auto.addEventListener('change', () => { state.autorun = auto.checked; autoChk.checked = auto.checked; ctx.commit('Sandbox-Option'); });
          host.appendChild(U.el('div', { class: 'insp-row' }, [U.el('label', { text: 'Auto-Start' }), auto]));

          const con = U.el('input', { type: 'checkbox', checked: state.showConsole });
          con.addEventListener('change', () => {
            state.showConsole = con.checked;
            consoleBox.style.display = con.checked ? '' : 'none';
            ctx.commit('Sandbox-Option');
          });
          host.appendChild(U.el('div', { class: 'insp-row' }, [U.el('label', { text: 'Konsole' }), con]));

          const exp = U.el('button', { class: 'btn', text: 'Als .html sichern' });
          exp.addEventListener('click', () => {
            U.download((ctx.win.get().title || 'sandbox') + '.html', buildDoc(false), 'text/html');
          });
          host.appendChild(U.el('div', { class: 'insp-row insp-row--full' }, [exp]));

          host.appendChild(U.el('div', { class: 'insp-note', text: 'Der Code läuft isoliert im iframe und kann das Board nicht verändern.' }));
        }
      };
    }
  });
})();
