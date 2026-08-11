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
      /* Weit draußen tritt der Inhalt hinter Milchglas zurück und unten sagt
         ein Band, was im Rahmen steckt — s. „Fernsicht" weiter unten. */
      const glas = U.el('div', { class: 'fr-glas' });
      const modulband = U.el('div', { class: 'fr-modulband' });
      /* Der Träger bekommt von windows.js die Maße des Rahmens; die
         Überschrift darin behält ihre eigene Höhe — genau die meldet
         kopfHoehe() an GD.layout. Reihenfolge = Malreihenfolge: Glas hinten,
         darüber die Überschrift, das Band zuoberst. */
      const schild = U.el('div', { class: 'fr-schild' }, [glas, kopf, modulband]);
      const root = U.el('div', { class: 'fr-root' });

      // Eigene Kopie des Titels: beim Tippen in der Leiste steht in den Daten
      // noch der alte, gemeldet wird aber schon der neue Text
      let titel = ctx.win.get().title || '';

      /* Grundgrößen aus dem Blatt — sie bestimmen auch das Kopfband, das
         GD.layout freihält. Der Zoom ändert nur die Anzeige, nie das Band. */
      /* Über U.blatt, nicht über getComputedStyle: Der Wert kommt aus einem
         Speicher, der nur beim Themenwechsel geleert wird. Direkt gelesen
         erzwang jeder dieser Aufrufe mitten im Zoomen einen Layoutlauf über
         die ganze Tafel — die teuerste Zeile im Programm (s. util.js). */
      const blatt = U.blatt;

      /**
       * Überschrift gegen den Zoom mitwachsen lassen.
       *
       * Weit herausgezoomt wird die Beschriftung sonst unlesbar, und man
       * weiß nicht mehr, welcher Bereich unter einem liegt. Sie behält
       * deshalb ihre Bildschirmgröße — begrenzt durch MAX_WUCHS und durch
       * den Rahmen selbst (kopfDeckel). Beim Hineinzoomen wächst sie nie
       * über die Grundgröße.
       *
       * WO DER DECKEL GREIFT, HÖRT SIE AUF ZU WACHSEN — SIE VERSCHWINDET
       * NICHT. Hier stand einmal das Gegenteil: Rahmen unter 130 Pixeln
       * Bildschirmbreite nahmen ihre Überschrift ganz weg, damit aus vielen
       * kleinen Schildern kein Brei wird. Beim Herauszoomen wuchs die
       * Schrift dann erst, blieb stehen — und war plötzlich weg. Der Grund
       * für die Regel ist inzwischen weggefallen: Seit der Deckel die
       * Überschrift IM Rahmen hält, kann sie keinem Nachbarn mehr ins Bild
       * laufen, und mit ihm schrumpft sie mit dem Rahmen einfach mit.
       */
      const ZIEL_PX = 20;          // angestrebte Bildschirmgröße der Überschrift
      const MAX_WUCHS = 14;        // weiter aufblasen hilft niemandem
      const MIN_ZEILE = 170;       // schmalste Zeile, die noch etwas hergibt
      const GLAS_AB = 0.28;        // ab so viel überdecktem Rahmen: Fernsicht
      const LESBAR_AB = 0.34;      // darunter ist auch der Inhalt selbst Grieß
      const GLAS_UNSCHAERFE = 11;  // Unschärfe in Bildschirmpixeln
      const CHIP_MAX = 24;         // Plättchen wachsen höchstens so weit mit
      const BAND_H = 66;           // Höhe des Modulbands, s. .fr-chip im Blatt
      let wuchs = 1;
      let fern = false;            // Fernsicht an? (Milchglas + Modulband)
      /* Das Band wird nur neu gebaut, wenn sich die Zusammensetzung wirklich
         geändert hat — sonst risse jeder Wechsel in die Fernsicht die
         Einblendanimation von vorn los. Die Deklaration muss hier oben
         stehen: Ein Rahmen, der schon beim Laden in der Fernsicht liegt,
         baut sein Band noch aus dem ersten skaliereKopf() heraus. */
      let bandSchluessel = null;

      function skaliereKopf(sc) {
        const s = Number.isFinite(sc) && sc > 0 ? sc : (GD.board ? GD.board.scale() : 1);
        const basis = blatt('--fr-mark-size', 28);
        /* Nie kleiner als die Grundgröße (dann sitzt sie sauber im Kopfband
           und überlappt nichts), nach außen hin so weit größer, dass auf dem
           Bildschirm rund ZIEL_PX übrig bleiben. */
        const f = ctx.win.get();
        /* … aber nie höher als der Rahmen selbst. Ohne diesen Deckel wächst
           die Überschrift eines kleinen Rahmens unten aus ihm heraus und
           steht in der Nachbarschaft; der Faktor 1.6 lässt Platz für die
           zweite Zeile, in die sie dabei umbrechen darf. */
        const kopfDeckel = (f.h || 1) / ((blatt('--fr-bar', 34) + kopfRoh()) * 1.6);
        /* … und nicht breiter. Ein schmaler Rahmen bekommt eine kleinere
           Überschrift statt einer, die seitlich hinausläuft: MIN_ZEILE ist
           die schmalste Zeile, die noch etwas hergibt (abzüglich Polster
           bleiben davon rund 140 px Text — zwei Zeilen zu je acht, neun
           Zeichen). Wer schmaler ist, wächst eben weniger. */
        const platz = Math.max(1, f.w - (state.kopfX || 0));
        const breitDeckel = platz / MIN_ZEILE;
        wuchs = U.clamp(Math.min(ZIEL_PX / (basis * s), kopfDeckel, breitDeckel), 1, MAX_WUCHS);
        const gross = wuchs > 1.15;
        kopf.classList.toggle('is-gross', gross);

        /* Die vergrößerte Überschrift bleibt im Rahmen und darf dafür in
           zwei Zeilen umbrechen. Der Deckel gilt im Maßstab des Kastens —
           der ist skaliert, also durch den Wuchs teilen. Bei Wuchs 1 kein
           Deckel: Dann gilt wieder eine Zeile mit Auslassungspunkten, und
           das Kopfband, das GD.layout freihält, bleibt wie gemessen. */
        kopf.style.maxWidth = gross ? (platz / wuchs) + 'px' : '';

        fernsicht(f, s);
        stelleKopf();
      }

      /* ------------------------------------------------------------ Fernsicht
       *
       * Herausgezoomt ist die Überschrift auf dem Bildschirm immer gleich
       * groß (das ist der Sinn von ZIEL_PX) — der Rahmen darunter aber wird
       * kleiner und kleiner. Ab einem Punkt verdeckt die Schrift mehr Inhalt,
       * als sie erklärt. Dann tritt der Inhalt hinter Milchglas zurück, und
       * unten sagt ein Band, was drinsteckt: je Modulart ein Plättchen mit
       * Anzahl und Zeichen.
       *
       * ZWEI Auslöser, und es genügt einer:
       *
       *  1. Die Überschrift verdeckt zu viel. Gerechnet, nicht geraten: Ihre
       *     Bildschirmhöhe ist `kopfHöhe · Wuchs · s`, die des Rahmens
       *     `f.h · s`; überschreitet das Verhältnis GLAS_AB, kippt es. So
       *     kippt ein kleiner Rahmen früh und ein großer spät — beide genau
       *     dann, wenn die Schrift denselben Anteil frisst.
       *
       *  2. Unter LESBAR_AB ist der Inhalt ohnehin niemandem mehr zu lesen
       *     (13-px-Text ist dort vier Pixel hoch). Ohne diesen zweiten
       *     Auslöser blieben genau die Rahmen in der Nahsicht stehen, die
       *     ihn am nötigsten hätten: sehr hohe, deren Überschrift nie auf
       *     ihren Anteil kommt, und sehr schmale. Auf dem Brett standen die
       *     dann als scharfe Flecken zwischen lauter Milchglas.
       */
      function fernsicht(f, s) {
        const kopfAufSchirm = (blatt('--fr-bar', 34) + kopfRoh()) * wuchs * s;
        const rahmenAufSchirm = f.h * s;
        const verdeckt = wuchs > 1.15 && rahmenAufSchirm > 0
          && kopfAufSchirm / rahmenAufSchirm >= GLAS_AB;
        const soll = s < LESBAR_AB || verdeckt;

        if (soll !== fern) {
          fern = soll;
          if (soll) bandBauen();
          schild.classList.toggle('is-fern', soll);
        }
        /* Liegt dieser Rahmen in einem anderen, der ebenfalls Glas zeigt,
           bleibt seins weg: Zwei Scheiben übereinander geben einen dunklen
           Fleck statt einer ruhigen Fläche — und genau so sah das Brett
           aus, weil verschachtelte Abschnitte reihenweise mitkippten. Das
           Modulband darf bleiben, es zählt ja anderes als das des Elters. */
        schild.classList.toggle('is-fremdglas', soll && unterFremdemGlas(f, s));
        if (!soll) return;

        /* Unschärfe und Plättchen sollen auf dem Bildschirm gleich groß
           bleiben — beide liegen im skalierten Weltraum, also gegen den
           Maßstab rechnen. Nach oben gedeckelt: Eine Unschärfe von tausend
           Pixeln kostet nur Rechenzeit und sieht aus wie hundert. */
        const unschaerfe = Math.round(U.clamp(GLAS_UNSCHAERFE / s, 8, 120));
        glas.style.backdropFilter = 'blur(' + unschaerfe + 'px)';
        glas.style.webkitBackdropFilter = 'blur(' + unschaerfe + 'px)';

        /* Dasselbe für das Band: Bildschirmgröße halten, aber höchstens so
           groß, dass es knapp die Hälfte des Rahmens einnimmt — sonst
           stünden die Plättchen bei einem flachen Rahmen in der Überschrift.
           Wo selbst das zu klein wird, bleibt das Band weg: Zeichen von acht
           Pixeln sind Grieß, das Glas allein sagt dort schon genug. */
        const k = U.clamp(Math.min(1 / s, (f.h * 0.45) / BAND_H), 0.05, CHIP_MAX);
        modulband.style.transform = 'translateX(-50%) scale(' + k.toFixed(3) + ')';
        modulband.style.maxWidth = (f.w / k) + 'px';
        schild.classList.toggle('is-eng', k * s < 0.42);
      }

      /* Vergrößert wird über transform, nicht über die Schriftgröße: Ein
         wachsender Schriftgrad rechnet das Layout neu (und die Messung des
         Kopfbands liefe mitten in die Übergangsanimation), scale() nicht. */
      function stelleKopf() {
        kopf.style.transform =
          'translate(' + (state.kopfX || 0) + 'px,' + (state.kopfY || 0) + 'px) scale(' + wuchs.toFixed(3) + ')';
      }

      /**
       * Höhe des Kopfes in Weltmaß — ohne Zoomfassung, ohne Breitendeckel.
       *
       * Beides hängt am Zoom; würde man mitmessen, bekäme GD.layout sein
       * Kopfband bei jedem Zoomschritt anders. Die Zoomfassung blendet
       * zusätzlich den Untertitel aus, deshalb wird sie kurz abgeschaltet.
       */
      let rohSchluessel = '', rohHoehe = 0;

      function messeKopf() {
        const gross = kopf.classList.contains('is-gross');
        const deckel = kopf.style.maxWidth;
        if (gross) kopf.classList.remove('is-gross');
        kopf.style.maxWidth = '';
        const h = kopf.offsetHeight;
        if (gross) kopf.classList.add('is-gross');
        kopf.style.maxWidth = deckel;
        if (h > 0) { rohSchluessel = titel + '¦' + (state.note || ''); rohHoehe = h; }
        return h;
      }

      /* Dieselbe Höhe, aber gemerkt: fernsicht() fragt sie bei jedem
         Zoomschritt und jedem Verschieben: Messen hieße dort, mitten im
         Schreiben das Layout zu erzwingen — einmal je Rahmen und Bild. */
      function kopfRoh() {
        if (rohSchluessel !== titel + '¦' + (state.note || '')) messeKopf();
        return rohHoehe || Math.max(0,
          blatt(state.note ? '--fr-kopf-note' : '--fr-kopf', 92) - blatt('--fr-bar', 34));
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
            /* Nullpunkt ist die Unterkante der Titelleiste (s. .fr-kopf im
               Blatt), nicht der obere Fensterrand — nach oben ist deshalb bei
               0 Schluss, und nach unten bleibt die Leiste vom Weg abgezogen. */
            const bar = blatt('--fr-bar', 34);
            state.kopfX = Math.round(U.clamp(x0 + dx / sc, 0, Math.max(0, f.w - 120)));
            state.kopfY = Math.round(U.clamp(y0 + dy / sc, 0, Math.max(0, f.h - bar - 60)));
            paint();
          },
          onEnd(e, moved) { if (moved) ctx.commit('Überschrift verschoben'); }
        });
      });

      /**
       * Steckt dieser Rahmen in einem anderen, der auch schon Glas zeigt?
       *
       * Gerechnet statt erfragt: Unterhalb von LESBAR_AB ist JEDER Rahmen in
       * der Fernsicht — ein umschließender also auch. Damit hängt die
       * Antwort nicht davon ab, in welcher Reihenfolge die Rahmen ihren Zoom
       * gemeldet bekommen. Darüber ist Fernsicht die Ausnahme, dort deckt
       * kein Elter zuverlässig ab und jeder zeigt sein eigenes Glas.
       */
      function unterFremdemGlas(f, s) {
        if (s >= LESBAR_AB) return false;
        for (const w of GD.store.doc.windows) {
          if (w.type === 'frame' && w.id !== f.id && umschliesst(w, f)) return true;
        }
        return false;
      }

      /** Liegt b vollständig in a? */
      function umschliesst(a, b) {
        const h = b.collapsed ? GD.windows.BAR_H : b.h;
        return b.x >= a.x - 2 && b.y >= a.y - 2 &&
               b.x + b.w <= a.x + a.w + 2 && b.y + h <= a.y + a.h + 2;
      }

      /** Welche Fenster liegen vollständig in diesem Rahmen? */
      function inside() {
        const f = ctx.win.get();
        const out = [];
        for (const w of GD.store.doc.windows) {
          if (w.id !== f.id && umschliesst(f, w)) out.push(w.id);
        }
        return out;
      }

      /**
       * Was steckt drin — nach Modulart gezählt.
       *
       * Nur die eigenen Kacheln: Was in einem eingebetteten Rahmen liegt,
       * zählt dort. Sonst stünde an einem Abschnitt die Summe aller seiner
       * Gruppen noch einmal, und je tiefer die Schachtelung, desto öfter.
       * Die Reihenfolge kommt aus der Registry, damit die Plättchen an jedem
       * Rahmen gleich stehen.
       */
      function modulZaehlung() {
        const f = ctx.win.get();
        const drin = [];
        for (const w of GD.store.doc.windows) {
          if (w.id !== f.id && umschliesst(f, w)) drin.push(w);
        }
        const rahmen = drin.filter((w) => w.type === 'frame');
        const zahl = new Map();
        for (const w of drin) {
          if (rahmen.some((r) => r.id !== w.id && umschliesst(r, w))) continue;
          zahl.set(w.type, (zahl.get(w.type) || 0) + 1);
        }
        const out = [];
        for (const def of GD.modules.list()) {
          const n = zahl.get(def.id);
          if (n) out.push({ id: def.id, n: n, icon: def.icon, label: def.label, ton: def.accent });
        }
        // Ein Board mit einem noch nicht geladenen Modul soll trotzdem zählen
        for (const [id, n] of zahl) {
          if (!GD.modules.get(id)) out.push({ id: id, n: n, icon: '?', label: id, ton: '#e8b45c' });
        }
        return out;
      }

      function bandBauen() {
        const teile = modulZaehlung();
        const schluessel = teile.map((t) => t.id + ':' + t.n).join('·');
        if (schluessel === bandSchluessel) return;
        bandSchluessel = schluessel;
        modulband.textContent = '';
        teile.forEach((t, i) => {
          const chip = U.el('div', { class: 'fr-chip', title: t.label + ': ' + t.n }, [
            U.el('div', { class: 'fr-chip__zahl', text: String(t.n) }),
            U.el('div', { class: 'fr-chip__logo', text: t.icon })
          ]);
          // Eigenwerte über setProperty: Object.assign an style kann das nicht
          chip.style.setProperty('--i', String(i));
          chip.style.setProperty('--ton', t.ton);
          modulband.appendChild(chip);
        });
        // Ein leerer Rahmen hat nichts zu verdecken — dann auch kein Glas
        schild.classList.toggle('is-leer', teile.length === 0);
      }

      return {
        el: root,
        getState() { return U.clone(state); },
        setState(next) { if (next) { Object.assign(state, next); paint(); skaliereKopf(); } },

        /** Die Überschrift lebt über den Kacheln, s. windows.js */
        overlayEl() { return schild; },

        /* Ein größer gezogener Rahmen kann Kacheln aufgenommen oder verloren
           haben — das Band muss dann neu gezählt werden. */
        onResize() { bandSchluessel = null; paint(); skaliereKopf(); if (fern) bandBauen(); },
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
          /* Zoomunabhängig messen — GD.layout darf sein Band nicht bei jedem
             Zoomschritt anders bekommen; messeKopf() nimmt dafür Zoomfassung
             und Breitendeckel heraus. Hier wird frisch gemessen statt die
             gemerkte Höhe zu nehmen: Der Aufruf kommt selten, und nach einem
             späten Schriftwechsel wäre der Merkwert veraltet. */
          const h = messeKopf();
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
