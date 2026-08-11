/* GameDesk — Modul „Medien": Bilder, Videos und Audio (Moodboard, Referenzen) */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;
  const MAX_BYTES = GD.depot.MAX_BYTES;
  const peakCache = new Map();          // nur im Arbeitsspeicher, nicht im Board

  /*
   * Die Bytes einer Datei liegen nicht im Board, sondern im Depot
   * (js/core/depot.js); `it.src` ist dann nur `depot:<id>`. Zum Anzeigen
   * braucht es die laufende blob:-Adresse — fremde Adressen (http, kurze
   * data:) reicht `aufloesen` unverändert durch. Kommt null zurück, wird der
   * Blob gerade aus der Datenbank geholt; das Ereignis 'bereit' meldet sich.
   */
  function quelle(it) { return it ? GD.depot.aufloesen(it.src) : null; }

  /* Platzhalter-Wellenform, solange die echte gelesen wird. Ruhig und
     symmetrisch — sie soll die Form des Bauteils zeigen, nicht Daten
     vortäuschen; gezeichnet wird sie mit knapp einem Fünftel Deckkraft. */
  const ruhePeaks = (() => {
    const n = 220, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      out[i] = 0.30 + 0.26 * Math.sin(t * Math.PI * 7) * Math.sin(t * Math.PI);
    }
    return out;
  })();

  function kindOf(type, name) {
    if (/^video\//.test(type)) return 'video';
    if (/^audio\//.test(type)) return 'audio';
    if (/^image\//.test(type)) return 'image';
    if (/\.(mp4|webm|ogv|mov|m4v)(\?|$)/i.test(name || '')) return 'video';
    if (/\.(mp3|wav|ogg|m4a|flac|aac|opus)(\?|$)/i.test(name || '')) return 'audio';
    return 'image';
  }

  GD.modules.register({
    id: 'media',
    label: 'Bild / Video / Ton',
    icon: '▣',
    description: 'Referenzen, Moodboard, Audio',
    accent: '#b78cf7',
    defaultSize: { w: 420, h: 320 },
    defaultTitle: 'Medien',

    create(ctx) {
      const state = Object.assign({
        items: [], index: 0, fit: 'contain', bg: '#0b0d12',
        loop: true, muted: true, autoplay: false, controls: true, volume: 1
      }, ctx.state || {});

      const stage = U.el('div', { class: 'md-stage' });
      const strip = U.el('div', { class: 'md-strip' });
      const caption = U.el('div', { class: 'md-caption', contentEditable: 'true', spellcheck: false });
      const root = U.el('div', { class: 'md-root' }, [stage, caption, strip]);
      let activeMedia = null;
      let welleNeu = null;        // Neuzeichner der gerade sichtbaren Wellenform
      let wartet = false;         // Bühne zeigt den Platzhalter, das Depot lädt noch

      /* Kommt ein Blob aus der Datenbank an, steht das Bild sofort da. Nur
         neu bauen, wenn die Bühne wirklich wartet — sonst risse jedes
         eintreffende Vorschaubild die laufende Wiedergabe ab. */
      const offBereit = GD.depot.events.on('bereit', () => {
        if (wartet) render(); else renderStrip();
      });

      caption.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') { ev.preventDefault(); caption.blur(); }
      });
      caption.addEventListener('blur', () => {
        const it = current();
        if (!it) return;
        const next = caption.textContent.trim();
        if (next !== it.caption) { it.caption = next; ctx.commit('Bildunterschrift geändert'); }
      });

      stage.addEventListener('dragover', (ev) => { ev.preventDefault(); stage.classList.add('is-drop'); });
      stage.addEventListener('dragleave', () => stage.classList.remove('is-drop'));
      stage.addEventListener('drop', async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        stage.classList.remove('is-drop');
        await addFiles(Array.from(ev.dataTransfer.files || []));
      });

      function current() { return state.items[state.index] || null; }

      async function addFiles(files) {
        const usable = files.filter((f) => /^(image|video|audio)\//.test(f.type));
        if (!usable.length) { ctx.toast('Nur Bilder, Videos oder Audio', 'err'); return; }
        for (const f of usable) {
          if (f.size > MAX_BYTES) {
            ctx.toast(f.name + ' ist ' + U.fmtBytes(f.size) + ' groß — bitte kleiner als ' + U.fmtBytes(MAX_BYTES) + '.', 'err');
            continue;
          }
          try {
            const src = await GD.depot.ausDatei(f);
            state.items.push({ id: U.uid('m'), kind: kindOf(f.type, f.name), src: src, name: f.name, caption: '' });
          } catch (e) {
            ctx.toast(f.name + ' ließ sich nicht ablegen: ' + (e.message || e), 'err');
          }
        }
        state.index = state.items.length - 1;
        render();
        ctx.commit('Medien hinzugefügt');
        ctx.refreshInspector();
      }

      function addUrl() {
        const url = prompt('Adresse zu Bild, Video oder Audio:', 'https://');
        if (!url) return;
        state.items.push({ id: U.uid('m'), kind: kindOf('', url), src: url, name: url.split('/').pop() || url, caption: '' });
        state.index = state.items.length - 1;
        render();
        ctx.commit('Medium hinzugefügt');
        ctx.refreshInspector();
      }

      function removeCurrent() {
        if (!state.items.length) return;
        state.items.splice(state.index, 1);
        state.index = Math.max(0, Math.min(state.index, state.items.length - 1));
        render();
        ctx.commit('Medium entfernt');
        ctx.refreshInspector();
      }

      /* ------------------------------------------------------- Anzeige */

      function render() {
        if (activeMedia && activeMedia.pause) { try { activeMedia.pause(); } catch (e) { /* egal */ } }
        activeMedia = null;
        welleNeu = null;
        wartet = false;
        stage.innerHTML = '';
        stage.style.background = state.bg;
        const it = current();

        if (!it) {
          stage.appendChild(U.el('div', { class: 'md-empty' }, [
            U.el('div', { class: 'md-empty__icon', text: '▣' }),
            U.el('div', { text: 'Bild, Video oder Tondatei hierher ziehen' }),
            U.el('div', { class: 'md-empty__row' }, [
              mkBtn('Datei wählen…', async () => addFiles(await U.pickFile('image/*,video/*,audio/*', true))),
              mkBtn('Aus Adresse…', addUrl)
            ])
          ]));
          caption.textContent = '';
          caption.dataset.empty = '1';
          renderStrip();
          return;
        }

        /* Noch im Depot unterwegs: Platzhalter statt eines kaputten Bildes.
           'bereit' zeichnet gleich neu. */
        const adr = quelle(it);
        if (adr === null) {
          wartet = true;
          stage.appendChild(U.el('div', { class: 'md-empty' }, [
            U.el('div', { class: 'md-empty__icon', text: '▣' }),
            U.el('div', { text: 'Medium wird geladen …' })
          ]));
          caption.textContent = it.caption || '';
          caption.dataset.empty = it.caption ? '0' : '1';
          renderStrip();
          return;
        }

        if (it.kind === 'audio') stage.appendChild(audioPlayer(it, adr));
        else if (it.kind === 'video') {
          const v = U.el('video', {
            src: adr, class: 'md-media',
            controls: state.controls, loop: state.loop, muted: state.muted, autoplay: state.autoplay,
            playsInline: true
          });
          v.volume = state.volume;
          v.style.objectFit = state.fit;
          activeMedia = v;
          stage.appendChild(v);
        } else {
          const img = U.el('img', { src: adr, class: 'md-media', alt: it.name || '' });
          img.style.objectFit = state.fit;
          img.addEventListener('error', () => stage.appendChild(U.el('div', { class: 'md-error', text: 'Bild konnte nicht geladen werden' })));
          stage.appendChild(img);
        }

        if (state.items.length > 1) {
          const prev = U.el('button', { class: 'md-nav md-nav--prev', text: '‹', title: 'Zurück' });
          const next = U.el('button', { class: 'md-nav md-nav--next', text: '›', title: 'Weiter' });
          prev.addEventListener('click', () => step(-1));
          next.addEventListener('click', () => step(1));
          stage.append(prev, next);
          stage.appendChild(U.el('div', { class: 'md-counter', text: (state.index + 1) + ' / ' + state.items.length }));
        }

        caption.textContent = it.caption || '';
        caption.dataset.empty = it.caption ? '0' : '1';
        renderStrip();
      }

      /* --------------------------------------------------- Tonwiedergabe */

      function audioPlayer(it, adr) {
        const audio = U.el('audio', { src: adr, loop: state.loop, autoplay: state.autoplay, preload: 'metadata' });
        audio.volume = state.volume;
        activeMedia = audio;

        const wave = U.el('canvas', { class: 'md-wave' });
        const hinweis = U.el('div', { class: 'md-wave__hinweis' });
        const playBtn = U.el('button', { class: 'md-play', text: '▶', title: 'Abspielen / Pause' });
        const time = U.el('span', { class: 'md-time', text: '0:00 / –:––' });
        const vol = U.el('input', { type: 'range', class: 'md-vol', min: 0, max: 1, step: 0.02, value: state.volume, title: 'Lautstärke' });
        const loopBtn = U.el('button', { class: 'md-mini' + (state.loop ? ' is-on' : ''), text: '↻', title: 'Schleife' });

        /*
         * Die Wellenform ist der Hauptinhalt der Kachel, nicht eine Zeile
         * darin: Sie nimmt allen Platz, den Name und Bedienleiste übriglassen.
         *
         * Die eingebaute Bedienleiste des Browsers steht bewusst NICHT mehr
         * daneben — zwei Abspielleisten übereinander haben die Wellenform
         * zusammengedrückt, bis von ihr nichts mehr zu sehen war. Das
         * <audio> hängt jetzt immer versteckt im Kasten; die Wahl „Bedienung"
         * blendet nur unsere eigene Leiste ein oder aus.
         */
        audio.controls = false;
        const box = U.el('div', { class: 'md-audio' }, [
          U.el('div', { class: 'md-audio__name', text: it.name || 'Tondatei' }),
          U.el('div', { class: 'md-wavebox' }, [wave, hinweis]),
          state.controls
            ? U.el('div', { class: 'md-transport' }, [playBtn, time, U.el('span', { class: 'md-transport__luecke' }), loopBtn, vol])
            : U.el('div', { class: 'md-transport md-transport--knapp' }, [playBtn, time]),
          audio
        ]);

        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (audio.paused) audio.play().catch(() => ctx.toast('Wiedergabe blockiert — einmal ins Fenster klicken', 'err'));
          else audio.pause();
        });
        loopBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.loop = !state.loop;
          audio.loop = state.loop;
          loopBtn.classList.toggle('is-on', state.loop);
          ctx.commit('Schleife');
        });
        vol.addEventListener('input', (e) => { e.stopPropagation(); state.volume = parseFloat(vol.value); audio.volume = state.volume; });
        vol.addEventListener('change', () => ctx.commit('Lautstärke'));
        vol.addEventListener('pointerdown', (e) => e.stopPropagation());

        audio.addEventListener('play', () => { playBtn.textContent = '⏸'; drawWave(); });
        audio.addEventListener('pause', () => { playBtn.textContent = '▶'; drawWave(); });
        audio.addEventListener('timeupdate', () => { updateTime(); drawWave(); });
        audio.addEventListener('loadedmetadata', updateTime);
        audio.addEventListener('error', () => { time.textContent = 'nicht abspielbar'; });

        wave.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          const r = wave.getBoundingClientRect();
          if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
        });

        function updateTime() {
          time.textContent = fmt(audio.currentTime) + ' / ' + (isFinite(audio.duration) ? fmt(audio.duration) : '–:––');
        }
        function fmt(s) {
          if (!isFinite(s)) return '–:––';
          const m = Math.floor(s / 60), r = Math.floor(s % 60);
          return m + ':' + String(r).padStart(2, '0');
        }

        let peaks = peakCache.get(it.id) || null;
        let stand = peaks ? 'fertig' : 'lade';

        function zeigeStand() {
          hinweis.textContent = stand === 'lade' ? 'Wellenform wird gelesen …'
            : stand === 'geht-nicht' ? 'Wellenform nicht lesbar'
              : '';
          hinweis.dataset.stand = stand;
          hinweis.style.display = stand === 'fertig' ? 'none' : '';
        }
        zeigeStand();

        const drawWave = U.raf(() => {
          const r = wave.getBoundingClientRect();
          if (r.width < 4 || r.height < 2) return;
          const sc = GD.board.scale() || 1;
          const dpr = Math.min((window.devicePixelRatio || 1) * sc, 3);
          const w = Math.round(r.width * dpr / sc), h = Math.round(r.height * dpr / sc);
          if (wave.width !== w || wave.height !== h) { wave.width = w; wave.height = h; }
          const g = wave.getContext('2d');
          g.clearRect(0, 0, w, h);
          // gemerkt statt gemessen — das hier läuft je Bild, solange Ton läuft
          const dim = U.blattText('--text-faint', '#777');
          const acc = U.blattText('--accent', '#6ea8fe');
          const prog = audio.duration ? audio.currentTime / audio.duration : 0;

          /* Balken statt Linie, auch ohne Daten: Die Kachel zeigt sofort, dass
             hier eine Wellenform steht — nur eben noch eine leere. Ein
             blanker Strich sieht dagegen aus wie ein Fehler. */
          const platte = peaks || ruhePeaks;
          const n = platte.length;
          const bw = w / n;
          const balken = Math.max(1, Math.round(bw * 0.62));
          const grund = peaks ? 1 : 0.22;

          for (let i = 0; i < n; i++) {
            const v = Math.max(0.03, platte[i]);
            const bh = Math.max(dpr, v * h * 0.88);
            const gespielt = (i / n) <= prog;
            g.fillStyle = gespielt ? acc : dim;
            g.globalAlpha = (gespielt ? 0.95 : 0.42) * grund;
            g.fillRect(Math.round(i * bw), Math.round((h - bh) / 2), balken, Math.round(bh));
          }
          g.globalAlpha = 1;

          if (peaks || audio.duration) {
            g.fillStyle = acc;
            g.fillRect(Math.max(0, Math.round(prog * w - dpr)), 0, Math.max(1, Math.round(dpr * 1.5)), h);
          }
        });

        if (!peaks) {
          holePeaks(it).then((p) => {
            peaks = p;
            stand = p ? 'fertig' : 'geht-nicht';
            zeigeStand();
            drawWave();
            renderStrip();                 // die Vorschau unten zeigt sie mit
          });
        }
        U.nextFrame(drawWave);
        welleNeu = drawWave;
        return box;
      }

      /**
       * Spitzenwerte einer Tondatei — 220 Stützstellen, auf 1 normiert.
       *
       * Fällt das Lesen aus (fremde Adresse ohne CORS, unbekanntes Format,
       * kein AudioContext), liefert die Funktion null. Das ist ein Zustand,
       * kein Zufall: Die Kachel schreibt ihn hin, statt eine leere Linie zu
       * zeigen und den Nutzer raten zu lassen.
       */
      async function holePeaks(it) {
        if (peakCache.has(it.id)) return peakCache.get(it.id);
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          // Die Bytes kommen aus dem Depot; bei einer fremden Adresse holt
          // GD.depot.blob sie über das Netz (und liefert null ohne CORS).
          const blob = await GD.depot.blob(it.src);
          if (!blob) return null;
          const buf = await blob.arrayBuffer();
          const actx = new AC();
          let decoded;
          try { decoded = await actx.decodeAudioData(buf); } finally { actx.close(); }
          const out = peaksAus(decoded, 220);
          peakCache.set(it.id, out);
          if (peakCache.size > 24) peakCache.delete(peakCache.keys().next().value);
          return out;
        } catch (e) {
          peakCache.set(it.id, null);      // nicht bei jedem Zeichnen neu versuchen
          return null;
        }
      }

      function peaksAus(decoded, N) {
        const ch = decoded.getChannelData(0);
        const block = Math.floor(ch.length / N) || 1;
        const out = new Float32Array(N);
        let peak = 0.0001;
        for (let i = 0; i < N; i++) {
          let m = 0;
          const s = i * block, e = Math.min(ch.length, s + block);
          for (let j = s; j < e; j += 4) { const v = Math.abs(ch[j]); if (v > m) m = v; }
          out[i] = m;
          if (m > peak) peak = m;
        }
        for (let i = 0; i < N; i++) out[i] /= peak;
        return out;
      }

      /* ---------------------------------------------------------- Rest */

      function renderStrip() {
        strip.innerHTML = '';
        strip.style.display = state.items.length > 1 ? '' : 'none';
        state.items.forEach((it, i) => {
          const t = U.el('button', { class: 'md-thumb' + (i === state.index ? ' is-on' : ''), title: it.name || '' });
          if (it.kind === 'video') t.appendChild(U.el('span', { class: 'md-thumb__vid', text: '▶' }));
          else if (it.kind === 'audio') t.appendChild(miniWelle(it));
          else {
            const a = quelle(it);
            if (a) t.style.backgroundImage = 'url(' + JSON.stringify(a).slice(1, -1) + ')';
          }
          t.addEventListener('click', () => { state.index = i; render(); ctx.changed(); });
          strip.appendChild(t);
        });
      }

      /**
       * Kleine Wellenform für die Vorschauleiste.
       *
       * Ein Bild zeigt dort sein Bild, ein Video seine Sprechblase — eine
       * Tondatei zeigte bisher nur eine Note, und mehrere Tondateien
       * nebeneinander waren nicht auseinanderzuhalten. Sind die Spitzenwerte
       * schon gelesen, steht hier dieselbe Form wie oben in groß; sonst
       * bleibt die Note.
       */
      function miniWelle(it) {
        const p = peakCache.get(it.id);
        if (!p) return U.el('span', { class: 'md-thumb__vid', text: '♪' });
        const c = U.el('canvas', { class: 'md-thumb__welle' });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(40 * dpr), h = Math.round(24 * dpr);
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = U.blattText('--text-dim', '#9aa4b6');
        const n = 20, schritt = Math.floor(p.length / n) || 1;
        for (let i = 0; i < n; i++) {
          let m = 0;
          for (let j = i * schritt; j < (i + 1) * schritt && j < p.length; j++) m = Math.max(m, p[j]);
          const bh = Math.max(dpr, m * h * 0.86);
          g.fillRect(Math.round(i * (w / n)), Math.round((h - bh) / 2), Math.max(1, Math.round(w / n * 0.6)), Math.round(bh));
        }
        return c;
      }

      function step(dir) {
        if (!state.items.length) return;
        state.index = (state.index + dir + state.items.length) % state.items.length;
        render();
        ctx.changed();
      }

      function mkBtn(label, fn, cls) {
        const b = U.el('button', { class: 'btn ' + (cls || ''), text: label });
        b.addEventListener('click', fn);
        return b;
      }

      render();

      /* -------------------------------------------------- Schnittstelle */

      return {
        el: root,

        getState() { return U.clone(state); },

        setState(next) {
          if (!next) return;
          Object.assign(state, next);
          state.items = next.items || [];
          state.index = Math.max(0, Math.min(next.index || 0, state.items.length - 1));
          render();
        },

        destroy() {
          offBereit();
          if (activeMedia && activeMedia.pause) { try { activeMedia.pause(); } catch (e) { /* egal */ } }
        },

        /* Nur neu ZEICHNEN, nicht neu bauen: Ein Neuaufbau der Bühne setzte
           die laufende Wiedergabe zurück. Die Wellenform hängt an der
           Pixelgröße der Leinwand und am Zoom, also beides abfangen. */
        onResize() { if (welleNeu) welleNeu(); },
        onZoom() { if (welleNeu) welleNeu(); },

        headerTools() {
          const add = U.el('button', { class: 'gd-win__btn', title: 'Medien hinzufügen', text: '＋' });
          add.addEventListener('click', async () => addFiles(await U.pickFile('image/*,video/*,audio/*', true)));
          return [add];
        },

        onKey(ev) {
          if (ev.key === 'ArrowLeft') { step(-1); return true; }
          if (ev.key === 'ArrowRight') { step(1); return true; }
          if (ev.key === ' ' && activeMedia && activeMedia.play) {
            if (activeMedia.paused) activeMedia.play().catch(() => { }); else activeMedia.pause();
            return true;
          }
          return false;
        },

        inspector(host) {
          const F = GD.ui.fields;
          host.appendChild(F.title('Medien'));
          host.appendChild(F.full(F.grid(2, [
            F.btn('Datei…', async () => addFiles(await U.pickFile('image/*,video/*,audio/*', true))),
            F.btn('Adresse…', addUrl)
          ])));

          const it = current();

          if (!it || it.kind !== 'audio') {
            host.appendChild(F.row('Darstellung', F.sel(state.fit,
              [['contain', 'einpassen'], ['cover', 'füllend'], ['fill', 'verzerrt'], ['none', 'Originalgröße']],
              (v) => { state.fit = v; render(); ctx.commit('Darstellung geändert'); })));
          }
          host.appendChild(F.row('Hintergrund', F.color(state.bg, (v) => { state.bg = v; stage.style.background = v; },
            () => ctx.commit('Hintergrund geändert'))));

          if (it && (it.kind === 'video' || it.kind === 'audio')) {
            host.appendChild(F.title(it.kind === 'audio' ? 'Ton' : 'Video'));
            const opts = it.kind === 'audio'
              ? [['controls', 'Volle Leiste'], ['loop', 'Schleife'], ['autoplay', 'Automatisch starten']]
              : [['controls', 'Bedienelemente'], ['loop', 'Schleife'], ['muted', 'Stumm'], ['autoplay', 'Automatisch starten']];
            for (const [key, label] of opts) {
              host.appendChild(F.row(label, F.chk(state[key], (v) => { state[key] = v; render(); ctx.commit('Option geändert'); })));
            }
            host.appendChild(F.row('Lautstärke', F.range(state.volume, 0, 1, 0.02, (v) => {
              state.volume = v; if (activeMedia) activeMedia.volume = v;
            }, () => ctx.commit('Lautstärke'))));
            if (it.kind === 'audio') {
              host.appendChild(F.note('Die Wellenform steht immer da. „Volle Leiste" ergänzt Schleife und Lautstärke; ohne sie bleiben Knopf und Zeit.'));
            }
          }

          if (it) {
            const info = GD.depot.info(it.src);
            const groesse = info ? U.fmtBytes(info.groesse)
              : it.src.startsWith('data:') ? U.fmtBytes(Math.round(it.src.length * 0.75))
                : 'extern';
            host.appendChild(F.note(it.name + ' · ' + groesse));
            host.appendChild(F.full(F.btn('Aktuelles Medium entfernen', removeCurrent, 'btn--danger')));
          }
        }
      };
    }
  });
})();
