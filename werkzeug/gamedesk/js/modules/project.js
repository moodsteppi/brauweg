/* GameDesk — Modul „Projekt": eine andere Tafel als Kachel
 *
 * Zeigt, DASS es ein zweites Projekt gibt, ohne dessen Innenleben auf dieser
 * Tafel auszubreiten: Name, Umfang, Modul-Aufteilung, Datum und eine kleine
 * Vorschau der Fensteranordnung. „Öffnen" geht hinein, der Zurück-Knopf in
 * der Werkzeugleiste wieder heraus.
 *
 * Alles Angezeigte liegt im Zustand der Kachel. Damit steht auch dann etwas
 * da, wenn gerade kein Bibliotheksordner erreichbar ist — beim Aufruf über
 * file:// etwa, oder wenn die Tafel jemand anderem geschickt wurde.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const MAX_BOXEN = 400;          // mehr braucht eine daumennagelgroße Vorschau nicht

  const fmtDatum = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  /** Aus einer fremden Tafel das herausziehen, was die Kachel zeigt */
  function ausTafel(doc, datei) {
    const fenster = Array.isArray(doc.windows) ? doc.windows : [];
    const module = {};
    for (const w of fenster) module[w.type] = (module[w.type] || 0) + 1;

    // Rahmen zuerst, damit die Kacheln in der Vorschau darüber liegen
    const sortiert = fenster.slice().sort((a, b) => (a.type === 'frame' ? 0 : 1) - (b.type === 'frame' ? 0 : 1));
    const boxen = sortiert.slice(0, MAX_BOXEN).map((w) => ({
      x: Math.round(w.x), y: Math.round(w.y),
      w: Math.round(w.w), h: Math.round(w.collapsed ? 34 : w.h),
      t: w.type
    }));

    return {
      datei: datei,
      name: typeof doc.name === 'string' ? doc.name : datei,
      fenster: fenster.length,
      pfeile: (doc.connections || []).length,
      modelle: (doc.models || []).length,
      module: module,
      boxen: boxen,
      geholt: Date.now()
    };
  }

  GD.modules.register({
    id: 'project',
    label: 'Projekt',
    icon: '🗂',
    description: 'Andere Tafel als Kachel',
    accent: '#e8b45c',
    defaultSize: { w: 360, h: 300 },
    defaultTitle: 'Projekt',

    create(ctx) {
      const state = Object.assign({
        datei: '', name: '', fenster: 0, pfeile: 0, modelle: 0,
        module: {}, boxen: [], geaendert: 0, groesse: 0, geholt: 0
      }, ctx.state || {});

      const name = U.el('div', { class: 'pj-name' });
      const pfad = U.el('div', { class: 'pj-pfad' });
      const kopf = U.el('div', { class: 'pj-kopf' }, [name, pfad]);

      const leinwand = U.el('canvas', { class: 'pj-leinwand' });
      const buehne = U.el('div', { class: 'pj-buehne' }, [leinwand]);

      const zahlen = U.el('div', { class: 'pj-zahlen' });
      const module = U.el('div', { class: 'pj-module' });
      const datum = U.el('div', { class: 'pj-datum' });

      const oeffnen = U.el('button', { class: 'btn btn--sm pj-oeffnen', text: 'Öffnen' });
      const fuss = U.el('div', { class: 'pj-fuss' }, [datum, oeffnen]);

      const root = U.el('div', { class: 'pj-root' }, [kopf, buehne, zahlen, module, fuss]);

      /* ------------------------------------------------------ Zeichnen */

      function zahl(wert, was) {
        return U.el('div', { class: 'pj-zahl' }, [
          U.el('strong', { text: String(wert) }),
          U.el('span', { text: was })
        ]);
      }

      function paint() {
        name.textContent = state.name || '— keine Tafel gewählt —';
        name.classList.toggle('is-leer', !state.datei);
        pfad.textContent = state.datei || 'im Inspector rechts eine Datei wählen';

        zahlen.innerHTML = '';
        if (state.datei) {
          zahlen.append(zahl(state.fenster, 'Fenster'), zahl(state.pfeile, 'Pfeile'));
          if (state.modelle) zahlen.appendChild(zahl(state.modelle, 'Modelle'));
        }

        const teile = Object.keys(state.module || {})
          .sort((a, b) => state.module[b] - state.module[a])
          .map((k) => {
            const def = GD.modules.get(k);
            return (def ? def.label : k) + ' ' + state.module[k];
          });
        module.textContent = teile.join('  ·  ');
        module.style.display = teile.length ? '' : 'none';

        datum.textContent = state.geaendert ? 'geändert ' + fmtDatum(state.geaendert) : '';
        oeffnen.disabled = !state.datei;
        zeichneVorschau();
      }

      /** Fenster als Rechtecke — dieselbe Idee wie in js/core/minimap.js */
      const zeichneVorschau = U.raf(function () {
        const ctx2 = leinwand.getContext('2d');
        const rect = buehne.getBoundingClientRect();
        const skala = GD.board.scale() || 1;
        // getBoundingClientRect liefert die gezoomte Größe — zurückrechnen,
        // sonst wächst die Auflösung mit dem Board-Zoom ins Unermessliche
        const B = Math.max(1, Math.round(rect.width / skala));
        const H = Math.max(1, Math.round(rect.height / skala));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (leinwand.width !== B * dpr || leinwand.height !== H * dpr) {
          leinwand.width = B * dpr; leinwand.height = H * dpr;
        }
        ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx2.clearRect(0, 0, B, H);

        const boxen = state.boxen || [];
        if (!boxen.length) {
          ctx2.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-faint').trim() || '#888';
          ctx2.font = '11px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
          ctx2.textAlign = 'center';
          ctx2.fillText('keine Vorschau', B / 2, H / 2);
          return;
        }

        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (const b of boxen) {
          x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
          x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
        }
        const luft = 8;
        const k = Math.min((B - luft * 2) / Math.max(x2 - x1, 1), (H - luft * 2) / Math.max(y2 - y1, 1));
        const ox = (B - (x2 - x1) * k) / 2 - x1 * k;
        const oy = (H - (y2 - y1) * k) / 2 - y1 * k;

        for (const b of boxen) {
          const def = GD.modules.get(b.t);
          const farbe = (def && def.accent) || '#94a3b8';
          const rahmen = b.t === 'frame';
          ctx2.fillStyle = farbe;
          ctx2.globalAlpha = rahmen ? 0.12 : 0.8;
          ctx2.fillRect(ox + b.x * k, oy + b.y * k, Math.max(1, b.w * k), Math.max(1, b.h * k));
          if (rahmen) {
            ctx2.globalAlpha = 0.35;
            ctx2.strokeStyle = farbe;
            ctx2.lineWidth = 1;
            ctx2.strokeRect(ox + b.x * k, oy + b.y * k, Math.max(1, b.w * k), Math.max(1, b.h * k));
          }
        }
        ctx2.globalAlpha = 1;
      });

      /* -------------------------------------------------------- Laden */

      async function holen(datei, still) {
        if (!datei) return;
        try {
          const doc = await GD.library.lesen(datei);
          Object.assign(state, ausTafel(doc, datei));
          const eintrag = (await GD.library.liste()).find((p) => p.datei === datei);
          if (eintrag) { state.geaendert = eintrag.geaendert; state.groesse = eintrag.groesse; }
          if (!ctx.win.get().title || ctx.win.get().title === 'Projekt') ctx.win.setTitle(state.name);
          paint();
          ctx.commit('Projekt-Kachel aktualisiert');
          if (!still) ctx.toast('„' + state.name + '" eingelesen', 'ok');
        } catch (err) {
          if (!still) ctx.toast('Tafel nicht lesbar: ' + (err.message || err), 'err');
        }
      }

      oeffnen.addEventListener('click', async () => {
        if (!state.datei) return;
        try { await GD.library.hinein(state.datei); ctx.toast('„' + state.name + '" geöffnet', 'ok'); }
        catch (err) { ctx.toast('Öffnen fehlgeschlagen: ' + (err.message || err), 'err'); }
      });
      buehne.addEventListener('dblclick', () => oeffnen.click());

      paint();

      return {
        el: root,
        getState() { return U.clone(state); },
        setState(next) { if (next) { Object.assign(state, next); paint(); } },
        onResize() { zeichneVorschau(); },
        onZoom() { zeichneVorschau(); },

        inspector(host) {
          const F = GD.ui.fields;
          host.appendChild(F.title('Projekt'));

          const s = GD.library.status();
          if (!s.bereit) {
            host.appendChild(F.note('Kein Projektordner eingerichtet. Über ⚙ Einstellungen → Projektordner einen festlegen, dann steht hier die Auswahl.'));
            return;
          }

          const wahl = U.el('select', { class: 'fld' });
          wahl.appendChild(U.el('option', { value: '', text: 'lese Ordner…' }));
          host.appendChild(F.row('Tafel', wahl));

          GD.library.liste().then((projekte) => {
            wahl.innerHTML = '';
            wahl.appendChild(U.el('option', { value: '', text: '— keine —' }));
            const eigene = GD.library.link();
            for (const p of projekte) {
              // die eigene Tafel wäre eine Kachel, die auf sich selbst zeigt
              if (eigene && eigene.datei === p.datei) continue;
              const o = U.el('option', { value: p.datei, text: p.name + '  (' + p.fenster + ' Fenster)' });
              if (p.datei === state.datei) o.selected = true;
              wahl.appendChild(o);
            }
          }).catch(() => {
            wahl.innerHTML = '';
            wahl.appendChild(U.el('option', { value: '', text: 'Ordner nicht lesbar' }));
          });

          wahl.addEventListener('change', () => {
            state.datei = wahl.value;
            if (!state.datei) { Object.assign(state, { name: '', fenster: 0, pfeile: 0, modelle: 0, module: {}, boxen: [], geaendert: 0 }); paint(); ctx.commit('Projekt gelöst'); return; }
            holen(state.datei);
          });

          host.appendChild(F.full(F.grid(2, [
            F.btn('Auffrischen', () => holen(state.datei)),
            F.btn('Öffnen', () => oeffnen.click())
          ])));
          host.appendChild(F.note('Die Kachel merkt sich Umfang und Vorschau, damit sie auch ohne Ordnerzugriff etwas zeigt. „Auffrischen" liest die Tafel neu ein.'));
        }
      };
    }
  });
})();
