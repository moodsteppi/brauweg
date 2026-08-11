/* GameDesk — Änderungsverfolgung und Änderungssicht
 *
 * Die Tafel führt einen eigenen, kleinen Verlauf neben der Rückgängig-Historie:
 *
 *   Commit      Ein festgeschriebener Stand. Er hält den Abzug (s.
 *               js/core/vergleich.js) der Tafel zu diesem Zeitpunkt, wer ihn
 *               festgeschrieben hat (Mensch oder KI), Titel und Text — und die
 *               Liste der Änderungen, die zu ihm geführt haben.
 *   Basis       Der Abzug des JÜNGSTEN Commits. Alles, was danach passiert,
 *               ist „offen".
 *
 * Warum nicht einfach jeden Commit mit vollem Abzug behalten und beliebig
 * weit zurückvergleichen? Weil ein Abzug bei den großen Tafeln rund 12 KB
 * wiegt; vierzig davon lägen dauerhaft in jeder .gamedesk.json. Vollständig
 * gehalten wird deshalb nur die Basis, ältere Commits behalten ihre fertige
 * Änderungsliste. Das reicht für die Frage „was ist seither passiert" und für
 * „was steckte in Commit X" — nur nicht für „zeig mir alles seit vorletzter
 * Woche".
 *
 * Die Änderungssicht (Schalter in der Werkzeugleiste) legt über jede geänderte
 * Kachel einen roten Kasten mit beschriftetem Reiter — Klasse und Titel, wie
 * bei einer Objekterkennung. Die Kästen liegen in #diff-layer und wandern also
 * mit Zoom und Verschieben mit; die Reiter hängen in #label-layer und behalten
 * ihre Pixelgröße, damit sie auch weit herausgezoomt lesbar bleiben.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;
  const V = GD.vergleich;

  const OFF = 50000;               // Versatz der Overlay-SVGs (s. app.css)
  const LUFT = 7;                  // Abstand des Kastens zur Kachel (Welt)
  const BAR_H = 34;                // eingeklappte Kachel
  const MAX_COMMITS = 60;          // ältere fallen hinten heraus
  const MAX_PUNKTE = 300;          // je Commit mitgeschriebene Einzelbefunde

  let ebene = null;                // <svg id="diff-layer">
  let reiterEbene = null;          // #label-layer (geteilt mit Pfeilen)
  let reiter = [];                 // erzeugte Reiter-Elemente
  let sichtbar = false;
  let stand = { punkte: [], zahlen: V.zahlen([]), satz: '', zeit: 0 };

  const events = U.emitter();

  /* --------------------------------------------------------------- Daten */

  /** Der Verfolgungsblock im Dokument; wird bei Bedarf angelegt. */
  function daten() {
    const doc = GD.store.doc;
    if (!doc.aenderungen || typeof doc.aenderungen !== 'object') doc.aenderungen = { basis: null, commits: [] };
    if (!Array.isArray(doc.aenderungen.commits)) doc.aenderungen.commits = [];
    return doc.aenderungen;
  }

  function basis() {
    const d = daten();
    return d.basis && d.basis.abzug ? d.basis : null;
  }

  /** Frischer Abzug des laufenden Standes — Modulzustände vorher einsammeln. */
  function jetztAbzug() {
    if (GD.windows && GD.windows.syncStates) GD.windows.syncStates();
    return V.abzug(GD.store.doc);
  }

  /**
   * Neu rechnen und melden.
   *
   * Der Riegel ist kein Zierrat: Ein Zuhörer von „stand" darf frei fragen, was
   * gerade offen ist — auch mit `stand(true)`. Ohne Riegel riefe er damit
   * wieder rechne(), das wieder meldet, und die Meldung stünde sich selbst im
   * Weg, bis der Aufrufstapel voll ist. Während des Meldens gilt deshalb: Wer
   * fragt, bekommt das eben Gerechnete.
   */
  let rechnend = false;

  function rechne() {
    if (rechnend) return stand;
    rechnend = true;
    try {
      const b = basis();
      const liste = b ? V.punkte(b.abzug, jetztAbzug()) : [];
      stand = { punkte: liste, zahlen: V.zahlen(liste), satz: V.satz(liste), zeit: Date.now() };
      events.emit('stand', stand);
      if (sichtbar) zeichne();
    } finally {
      rechnend = false;
    }
    return stand;
  }

  const rechneSpaeter = U.debounce(rechne, 400);

  /* ------------------------------------------------------------- Zeichnen */

  function leeren() {
    if (ebene) while (ebene.firstChild) ebene.removeChild(ebene.firstChild);
    for (const el of reiter) el.remove();
    reiter = [];
  }

  /** Weltrechteck einer Kachel — gelöschte kommen aus der Basis. */
  function kasten(p) {
    if (p.box) return p.box;
    const d = GD.store.getWindow(p.id);
    if (!d) return null;
    return { x: d.x, y: d.y, w: d.w, h: d.collapsed ? BAR_H : d.h };
  }

  /** Mitte einer Kachel — für die Pfeilmarke; notfalls aus der Basis */
  function mitteVon(id) {
    const d = GD.store.getWindow(id);
    if (d) return { x: d.x + d.w / 2, y: d.y + (d.collapsed ? BAR_H : d.h) / 2 };
    const b = basis();
    const f = b && b.abzug.fenster[id];
    return f ? { x: f.x + f.b / 2, y: f.y + (f.e ? BAR_H : f.h) / 2 } : null;
  }

  const zeichne = U.raf(function () {
    if (!ebene) return;
    leeren();
    markiereFenster();
    if (!sichtbar) return;

    const s = GD.board.scale() || 1;
    const px = (n) => n / s;

    for (const p of stand.punkte) {
      const k = V.KLASSEN[p.art];
      const box = p.ziel === 'fenster' ? kasten(p) : null;

      if (box) {
        ebene.appendChild(U.svg('rect', {
          class: 'diff-box' + (p.fehlt ? ' is-weg' : ''),
          x: box.x - LUFT + OFF, y: box.y - LUFT + OFF,
          width: Math.max(1, box.w + LUFT * 2), height: Math.max(1, box.h + LUFT * 2),
          rx: px(4),
          stroke: k.farbe,
          'stroke-width': px(2.2),
          'stroke-dasharray': p.fehlt ? px(9) + ' ' + px(6) : null
        }));
        setzeReiter(p, k, box.x - LUFT, box.y - LUFT);
        continue;
      }

      if (p.ziel === 'pfeil' && p.von && p.nach) {
        const a = mitteVon(p.von), b = mitteVon(p.nach);
        if (!a || !b) continue;
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ebene.appendChild(U.svg('circle', {
          class: 'diff-marke', cx: m.x + OFF, cy: m.y + OFF,
          r: px(9), stroke: k.farbe, 'stroke-width': px(2.2)
        }));
        setzeReiter(p, k, m.x, m.y - px(9));
        continue;
      }

      /* Tafel, Bündel, Modelle haben keinen Ort auf dem Brett — sie stehen
         nur im Änderungsfenster. */
    }
  });

  /** Der beschriftete Reiter über dem Kasten, in Bildschirmgröße */
  function setzeReiter(p, k, wx, wy) {
    const el = U.el('div', { class: 'diff-reiter', dataset: { id: p.id, ziel: p.ziel } }, [
      U.el('b', { text: k.label }),
      U.el('span', { text: p.titel }),
      p.arten.length > 1 ? U.el('i', { text: '+' + (p.arten.length - 1) }) : null
    ]);
    el.style.setProperty('--diff-farbe', k.farbe);
    el.title = p.text;
    el.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); });
    el.addEventListener('click', () => aenderungen.zeige(p));
    const s = GD.board.worldToScreen(wx, wy);
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';
    reiterEbene.appendChild(el);
    reiter.push(el);
  }

  /** Geänderte Kacheln bekommen eine Klasse, alle anderen treten zurück. */
  function markiereFenster() {
    const nachId = new Map();
    for (const p of stand.punkte) if (p.ziel === 'fenster') nachId.set(p.id, p);
    for (const rec of GD.windows.all()) {
      const p = sichtbar ? nachId.get(rec.data.id) : null;
      rec.el.classList.toggle('is-geaendert', !!p);
      if (p) rec.el.style.setProperty('--diff-farbe', V.KLASSEN[p.art].farbe);
      else rec.el.style.removeProperty('--diff-farbe');
    }
    GD.board.elBoard.classList.toggle('is-diffsicht', sichtbar);
  }

  /* ----------------------------------------------------------------- API */

  const aenderungen = {
    events: events,

    init() {
      ebene = document.getElementById('diff-layer');
      reiterEbene = document.getElementById('label-layer');

      GD.store.events.on('saved', rechneSpaeter);
      GD.store.events.on('doc:replaced', () => { sichtbar = false; rechne(); });
      GD.store.events.on('doc:restored', () => rechne());
      GD.board.events.on('view', () => { if (sichtbar) zeichne(); });
      GD.windows.events.on('changed', () => { if (sichtbar) zeichne(); });

      rechne();
    },

    /** Aktueller Stand: { punkte, zahlen, satz, zeit } */
    stand(frisch) { return frisch ? rechne() : stand; },
    aktualisiere() { return rechne(); },

    hatBasis() { return !!basis(); },
    basis() { const b = basis(); return b ? { id: b.id, zeit: b.zeit, titel: b.titel, wer: b.wer } : null; },
    commits() { return daten().commits.slice().reverse(); },      // jüngster zuerst

    /**
     * Stand festschreiben. Von Hand über das Änderungsfenster — oder aus einem
     * Skript heraus, dann mit wer: 'ki':
     *
     *   GD.aenderungen.festschreiben({ titel: 'Abschnitte umgebaut', wer: 'ki' })
     */
    festschreiben(opt) {
      const o = opt || {};
      const d = daten();
      const abzugJetzt = jetztAbzug();
      const liste = d.basis && d.basis.abzug ? V.punkte(d.basis.abzug, abzugJetzt) : [];
      const wer = o.wer === 'ki' ? 'ki' : 'mensch';
      const erster = !d.basis;

      if (!erster && !liste.length && !o.erzwingen) {
        return { ok: false, grund: 'Seit dem letzten Commit hat sich nichts geändert.' };
      }

      const commit = {
        id: U.uid('cmt'),
        zeit: Date.now(),
        titel: String(o.titel || (erster ? 'Ausgangsstand' : 'Ohne Titel')).trim().slice(0, 120),
        text: String(o.text || '').trim().slice(0, 4000),
        wer: wer,
        zahlen: V.zahlen(liste),
        punkte: liste.slice(0, MAX_PUNKTE).map((p) => ({
          art: p.art, ziel: p.ziel, id: p.id, typ: p.typ, titel: p.titel, text: p.text
        })),
        gekuerzt: Math.max(0, liste.length - MAX_PUNKTE)
      };

      d.commits.push(commit);
      while (d.commits.length > MAX_COMMITS) d.commits.shift();
      d.basis = { id: commit.id, zeit: commit.zeit, titel: commit.titel, wer: wer, abzug: abzugJetzt };

      GD.store.commit('Stand festgeschrieben: ' + commit.titel);
      rechne();
      events.emit('commit', commit);
      return { ok: true, commit: commit };
    },

    /** Einen Commit löschen (die Basis bleibt, wo sie ist) */
    commitLoeschen(id) {
      const d = daten();
      const i = d.commits.findIndex((c) => c.id === id);
      if (i < 0) return false;
      if (d.basis && d.basis.id === id) return false;      // die Basis fliegt nicht raus
      d.commits.splice(i, 1);
      GD.store.commit('Commit gelöscht');
      events.emit('stand', stand);
      return true;
    },

    /* --------------------------------------------------------- Sicht */

    sicht() { return sichtbar; },
    sichtSetzen(on) {
      const naechster = !!on;
      if (naechster === sichtbar) return sichtbar;
      sichtbar = naechster;
      if (sichtbar) rechne(); else { leeren(); markiereFenster(); }
      events.emit('sicht', sichtbar);
      return sichtbar;
    },
    sichtUmschalten() { return aenderungen.sichtSetzen(!sichtbar); },

    /** Einen Befund auf dem Brett zeigen */
    zeige(p) {
      const punkt = typeof p === 'string' ? stand.punkte.find((q) => q.id === p) : p;
      if (!punkt) return;
      if (punkt.ziel === 'pfeil' && !punkt.fehlt) {
        GD.connections.select(punkt.id);
        const a = mitteVon(punkt.von), b = mitteVon(punkt.nach);
        if (a && b) GD.board.centerOn((a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      const box = punkt.ziel === 'fenster' ? kasten(punkt) : null;
      if (!box) return;
      if (!punkt.fehlt) GD.windows.select([punkt.id]);
      GD.board.zoomToFit({ x: box.x, y: box.y, w: box.w, h: box.h }, 160);
    }
  };

  GD.aenderungen = aenderungen;
})();
