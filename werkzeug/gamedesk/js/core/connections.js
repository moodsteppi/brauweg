/* GameDesk — Pfeilverbindungen zwischen Fenstern
 *
 * Die Pfade liegen im Weltraum (skalieren mit dem Zoom), die Beschriftungen
 * in einer Bildschirm-Ebene darüber: dadurch bleibt die Schriftgröße beim
 * Zoomen konstant und ist pro Pfeil frei einstellbar.
 *
 * Gezeichnet wird im rechten Winkel (`curve: 'ortho'`, die Vorgabe). Ein
 * Pfeil verlässt seine Kante senkrecht, biegt höchstens zweimal ab und
 * trifft die Gegenkante wieder senkrecht — man sieht auf einen Blick, an
 * welchem Knopf er hängt und wo er ankommt. Bezier und Gerade bleiben für
 * ältere Tafeln erhalten.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;
  const OFF = 50000;
  const BAR_H = 34;                // s. windows.js
  const STUMMEL = 26;              // Weltmaß, das ein Pfeil senkrecht abrückt

  let layer = null, defs = null, labelLayer = null;
  let selectedId = null;
  let hoverId = null;
  let selBundle = null;
  let hoverBundle = null;
  const labelEls = new Map();
  const pathEls = new Map();
  const chipEls = new Map();
  const chipPunkte = new Map();    // Bündel-Id -> Weltpunkt der Sprechblase
  const anim = new Map();          // Bündel-Id -> laufendes Auf-/Zuklappen

  /* --------------------------------------------------- Was schon dasteht
   *
   * Je Pfeil merkt sich `adern` seine Knoten im DOM und die zuletzt
   * geschriebenen Werte. Vorher wurde die ganze Ebene bei JEDEM Bild
   * abgerissen und neu gebaut — mit Markern, Zuhörern und allem. Auf einer
   * Tafel mit 52 Pfeilen kostete ein Neubau 120 ms; da er an jedem Schwenk,
   * jedem Zoomschritt und jedem Zug hängt, lief das Brett mit acht Bildern
   * in der Sekunde. Jetzt bleiben die Knoten stehen, und geschrieben wird
   * nur, was sich wirklich geändert hat.
   */
  const adern = new Map();         // conn.id -> { g, hit, path, dot, letzt, weltPunkt }
  const strangEls = new Map();     // Bündel-Id -> { g, mantel, paare }
  const markerEls = new Map();     // Farbe|Seite -> <marker> in <defs>
  let letzterMassstab = null;      // um reines Schwenken zu erkennen

  const connections = {
    events: U.emitter(),

    init() {
      layer = document.getElementById('conn-layer');
      labelLayer = document.getElementById('label-layer');
      defs = U.svg('defs');
      layer.appendChild(defs);
      /* Beim reinen SCHWENKEN ändert sich an den Pfeilen nichts: Sie liegen
         im Weltraum und werden vom Board mitgeschoben. Nur Beschriftungen
         und Sprechblasen hängen im Bildschirmraum. Dafür die ganze Ebene neu
         zu bauen, war der teuerste Handgriff auf jeder größeren Tafel. */
      GD.board.events.on('view', (v) => {
        if (letzterMassstab !== null && v.scale === letzterMassstab) schirmNachfuehren();
        else connections.redraw();
      });
      GD.board.events.on('background:click', () => {
        connections.select(null);
        if (selBundle) { selBundle = null; applySelectionClasses(); connections.events.emit('bundle', null); }
      });
    },

    /* ------------------------------------------------------------ Daten */

    add(fromWin, fromSide, toWin, toSide, fromShape, toShape) {
      if (fromWin === toWin && !(fromShape && toShape && fromShape !== toShape)) return null;
      const conn = {
        id: U.uid('con'),
        from: { win: fromWin, side: fromSide || 'auto', shape: fromShape || null },
        to: { win: toWin, side: toSide || 'auto', shape: toShape || null },
        label: '',
        labelSize: 12,
        t: null,                   // null = automatisch auf das längste Stück
        color: '#6ea8fe',
        width: 2,
        dash: 'solid',
        curve: 'ortho',
        heads: 'end'
      };
      GD.store.doc.connections.push(conn);
      connections.redraw();
      connections.select(conn.id);
      GD.store.commit('Verbindung erstellt');
      return conn;
    },

    remove(id) {
      const list = GD.store.doc.connections;
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) return;
      list.splice(i, 1);
      if (selectedId === id) selectedId = null;
      connections.redraw();
      GD.store.commit('Verbindung gelöscht');
      connections.events.emit('selection', null);
    },

    removeForWindow(winId, defer) {
      const list = GD.store.doc.connections;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].from.win === winId || list[i].to.win === winId) {
          if (list[i].id === selectedId) selectedId = null;
          list.splice(i, 1);
        }
      }
      if (!defer) connections.redraw();
    },

    update(id, patch, commitLabel) {
      const c = GD.store.doc.connections.find((x) => x.id === id);
      if (!c) return;
      Object.assign(c, patch);
      connections.redraw();
      if (commitLabel) GD.store.commit(commitLabel);
      else GD.store.touch();
    },

    select(id) {
      selectedId = id;
      if (id) { GD.windows.select([]); selBundle = null; }
      applySelectionClasses();
      connections.events.emit('selection', id ? GD.store.doc.connections.find((c) => c.id === id) : null);
    },

    /* ------------------------------------------------------------ Bündel */

    bundles() { return GD.store.doc.bundles || (GD.store.doc.bundles = []); },
    bundle(id) { return connections.bundles().find((b) => b.id === id) || null; },

    /** Neues Bündel aus diesen Verbindungen */
    addBundle(ids, name) {
      const liste = (ids || []).filter(Boolean);
      if (!liste.length) return null;
      const erste = GD.store.doc.connections.find((c) => c.id === liste[0]);
      const b = {
        id: U.uid('bnd'),
        name: name || 'Bündel',
        collapsed: true,
        color: (erste && erste.color) || '#8fa4c4',
        width: 2.5, spreizung: 11, laenge: 260, mitte: null
      };
      connections.bundles().push(b);
      for (const c of GD.store.doc.connections) if (liste.indexOf(c.id) >= 0) c.bundle = b.id;
      connections.redrawNow();
      GD.store.commit('Bündel angelegt');
      connections.selectBundle(b.id);
      return b;
    },

    updateBundle(id, patch, label) {
      const b = connections.bundle(id);
      if (!b) return;
      Object.assign(b, patch);
      connections.redrawNow();
      if (label) GD.store.commit(label); else GD.store.touch();
    },

    /** Auf- oder zuziehen — mit Weg, nicht als Sprung */
    toggleBundle(id) {
      const b = connections.bundle(id);
      if (!b) return;
      b.collapsed = !b.collapsed;
      tweene(b, b.collapsed ? 0 : 1);
      GD.store.commit(b.collapsed ? 'Bündel zugezogen' : 'Bündel aufgezogen');
      connections.events.emit('selection', null);
      connections.selectBundle(id);
    },

    /** Bündel auflösen; die Pfeile bleiben, sie laufen nur wieder einzeln */
    removeBundle(id) {
      const liste = connections.bundles();
      const i = liste.findIndex((b) => b.id === id);
      if (i < 0) return;
      liste.splice(i, 1);
      for (const c of GD.store.doc.connections) if (c.bundle === id) c.bundle = null;
      if (selBundle === id) selBundle = null;
      connections.redrawNow();
      GD.store.commit('Bündel aufgelöst');
      connections.events.emit('selection', null);
    },

    selectBundle(id) {
      selBundle = id;
      selectedId = null;
      if (id) GD.windows.select([]);
      applySelectionClasses();
      connections.events.emit('bundle', id ? connections.bundle(id) : null);
    },

    selectedBundle() { return selBundle ? connections.bundle(selBundle) : null; },

    /** Eine Ader von außen hervorheben (Liste im Inspector) */
    hoverConnection(id, an) {
      hoverId = an ? id : (hoverId === id ? null : hoverId);
      applySelectionClasses();
    },
    mitglieder(id) { return mitgliederVon(id); },

    selected() { return selectedId ? GD.store.doc.connections.find((c) => c.id === selectedId) || null : null; },
    selectedId() { return selectedId; },

    removeSelected() { if (selectedId) connections.remove(selectedId); },

    /* --------------------------------------------------------- Zeichnen */

    redraw: U.raf(function () { render(); }),
    redrawNow() { render(); }
  };

  /* ------------------------------------------------------------ Rendern */

  function render() {
    if (!layer) return;
    const doc = GD.store.doc;
    const scale = GD.board.scale();
    letzterMassstab = scale;

    const seenChips = new Set();
    const seenAdern = new Set();

    /* ============ ERST RECHNEN ============================================
     *
     * Kein Schreibzugriff in diesem Abschnitt. Der Grund steht in einer
     * einzigen Zeile in wireframe.js: Hängt ein Pfeil an einer Form, fragt
     * `endpointRect()` das Modul nach deren Lage, und das MISST sie
     * (getScreenCTM). Eine Messung nach einem Schreibvorgang zwingt den
     * Browser, das Layout der ganzen Seite neu zu rechnen — auf der
     * Feldherr-Tafel 4,3 ms für einen einzigen Griff. Vermischt kostete das
     * Zeichnen dadurch 8 ms; getrennt bleibt einer dieser Läufe übrig, und
     * der fällt beim ersten Messen ohnehin an.
     */
    const wege = new Map();          // conn.id -> geo
    const straenge = [];
    for (const b of (doc.bundles || [])) {
      const mit = mitgliederVon(b.id);
      if (!mit.length) continue;
      const strang = buendelWege(b, mit);
      if (!strang) continue;
      for (const [id, geo] of strang.wege) wege.set(id, geo);
      straenge.push({ b: b, strang: strang, mit: mit });
    }

    const gerechnet = [];
    for (const c of doc.connections) {
      const geo = wege.get(c.id) || (() => {
        const a = endpointRect(c.from), b = endpointRect(c.to);
        return a && b ? routeGeometry(a, b, c) : null;
      })();
      if (!geo) continue;
      gerechnet.push({ c: c, geo: geo });
    }

    /* ============ DANN SCHREIBEN ========================================= */
    for (const s of straenge) {
      zeichneStrang(s.b, s.strang, s.mit, scale);
      chip(s.b, s.strang, s.mit);
      seenChips.add(s.b.id);
    }

    const beschriften = [];
    const reihe = [];
    for (const e of gerechnet) {
      const rec = aderFuer(e.c);
      seenAdern.add(e.c.id);
      reihe.push(e.c.id);
      aderSetzen(rec, e.c, e.geo, scale);
      beschriften.push({ c: e.c, rec: rec, geo: e.geo });
    }

    /* Weggefallene Pfeile wegräumen */
    for (const [id, rec] of Array.from(adern)) {
      if (seenAdern.has(id)) continue;
      rec.g.remove();
      adern.delete(id);
      pathEls.delete(id);
      const el = labelEls.get(id);
      if (el) { el.remove(); labelEls.delete(id); }
    }
    for (const [id, el] of Array.from(chipEls)) {
      if (!seenChips.has(id)) { el.remove(); chipEls.delete(id); chipPunkte.delete(id); }
    }
    for (const [id, s] of Array.from(strangEls)) {
      if (!seenChips.has(id)) { s.g.remove(); strangEls.delete(id); }
    }

    /* Reihenfolge im DOM = Reihenfolge im Dokument. Nur nötig, wenn Pfeile
       dazugekommen, verschwunden oder umsortiert sind — sonst stehen sie
       schon richtig, und ein appendChild je Pfeil wäre reine Arbeit. */
    if (reihe.length !== ordnung.length || reihe.some((id, i) => ordnung[i] !== id)) {
      for (const id of reihe) layer.appendChild(adern.get(id).g);
      ordnung = reihe;
    }

    beschriftungen(beschriften, scale);
    applySelectionClasses();
  }

  let ordnung = [];

  /* ---------------------------------------------------------- Eine Ader */

  /** Knoten eines Pfeils holen oder einmalig anlegen (samt Zuhörern) */
  function aderFuer(c) {
    let rec = adern.get(c.id);
    if (rec) return rec;

    const g = U.svg('g', { class: 'conn' });
    g.setAttribute('data-id', c.id);
    const hit = U.svg('path', { class: 'conn-hit' });
    const path = U.svg('path', { class: 'conn-path' });
    g.append(hit, path);
    layer.appendChild(g);

    /* Die Zuhörer hängen EINMAL am Knoten, nicht bei jedem Bild neu. Sie
       greifen über c.id auf den jeweils gültigen Datensatz zu — nach
       Rückgängig hängt im Dokument ein frischer, die Kennung bleibt. */
    hit.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.stopPropagation();
      connections.select(c.id);
    });
    hit.addEventListener('dblclick', (ev) => { ev.stopPropagation(); startLabelEdit(c.id); });
    hit.addEventListener('pointerenter', () => { hoverId = c.id; applySelectionClasses(); });
    hit.addEventListener('pointerleave', () => { if (hoverId === c.id) { hoverId = null; applySelectionClasses(); } });

    rec = { g: g, hit: hit, path: path, dot: null, letzt: {}, weltPunkt: null, breite: 0, breiteKenn: null };
    adern.set(c.id, rec);
    pathEls.set(c.id, path);
    return rec;
  }

  /** Nur schreiben, was sich geändert hat — jeder Schreibzugriff kostet */
  function setzeAttr(el, name, wert, letzt, schluessel) {
    if (letzt[schluessel] === wert) return;
    letzt[schluessel] = wert;
    if (wert === null || wert === undefined) el.removeAttribute(name);
    else el.setAttribute(name, wert);
  }

  function aderSetzen(rec, c, geo, scale) {
    const L = rec.letzt;
    const strokeW = Math.max(c.width, 1.1 / scale);
    const dash = dashArray(c.dash, strokeW);
    const markerEnd = c.heads === 'end' || c.heads === 'both' ? holeMarker(c.color, 'end') : null;
    const markerStart = c.heads === 'start' || c.heads === 'both' ? holeMarker(c.color, 'start') : null;

    const klasse = 'conn' + (c.bundle ? ' is-bundled' : '');
    if (L.klasse !== klasse) { L.klasse = klasse; rec.g.setAttribute('class', klasse); }
    setzeAttr(rec.g, 'data-bundle', c.bundle || null, L, 'bundle');

    setzeAttr(rec.hit, 'd', geo.d, L, 'd');
    setzeAttr(rec.hit, 'stroke-width', Math.max(14 / scale, strokeW * 3), L, 'hitW');

    setzeAttr(rec.path, 'd', geo.d, L, 'd2');
    setzeAttr(rec.path, 'stroke', c.color, L, 'farbe');
    setzeAttr(rec.path, 'stroke-width', strokeW, L, 'w');
    setzeAttr(rec.path, 'stroke-dasharray', dash || null, L, 'dash');
    setzeAttr(rec.path, 'marker-end', markerEnd ? 'url(#' + markerEnd + ')' : null, L, 'mEnd');
    setzeAttr(rec.path, 'marker-start', markerStart ? 'url(#' + markerStart + ')' : null, L, 'mStart');

    /* Hängt der Pfeil an einem einzelnen Element — einem Knopf im
       Wireframe —, bekommt sein Anfang einen Punkt. Ohne ihn ist bei
       mehreren Pfeilen aus derselben Kante nicht zu sehen, welcher zu
       welchem Knopf gehört. */
    if (c.from.shape) {
      if (!rec.dot) { rec.dot = U.svg('circle', { class: 'conn-dot' }); rec.g.appendChild(rec.dot); }
      setzeAttr(rec.dot, 'cx', geo.start.x + OFF, L, 'cx');
      setzeAttr(rec.dot, 'cy', geo.start.y + OFF, L, 'cy');
      setzeAttr(rec.dot, 'r', Math.max(strokeW * 1.9, 3 / scale), L, 'r');
      setzeAttr(rec.dot, 'fill', c.color, L, 'dotFarbe');
    } else if (rec.dot) {
      rec.dot.remove(); rec.dot = null; L.cx = L.cy = L.r = L.dotFarbe = undefined;
    }
  }

  /* ======================================================== Bündel ===== */
  /*
   * Ein Bündel ist ein Stück gemeinsamer Weg.
   *
   * Seine Mitglieder behalten ihre eigenen Enden — sie laufen nur in der
   * Mitte nebeneinander durch denselben Kanal, wie Kabel in einem Strang.
   * Quer darüber liegen in Abständen Wickel; sie sind auch die Griffe, mit
   * denen sich der Strang auf- und zuziehen lässt.
   *
   * Zugeklappt rücken alle Adern auf die Achse zusammen und bekommen einen
   * Mantel — aus fünf Pfeilen wird eine Leitung mit einer Zahl daran.
   */

  function mitgliederVon(bundleId) {
    return GD.store.doc.connections.filter((c) => c.bundle === bundleId);
  }

  /** Wie weit die Adern gerade auseinanderstehen: 0 zugeklappt, 1 offen. */
  function oeffnung(b) {
    if (anim.has(b.id)) return anim.get(b.id).wert;
    return b.collapsed ? 0 : 1;
  }

  function tweene(b, ziel) {
    const start = oeffnung(b);
    if (Math.abs(ziel - start) < 0.001) return;
    const dauer = 220, t0 = performance.now();
    const eintrag = { wert: start, timer: null };
    anim.set(b.id, eintrag);
    const schritt = () => {
      const p = U.clamp((performance.now() - t0) / dauer, 0, 1);
      // ease-out, dieselbe Kurve wie im Blatt
      const e = 1 - Math.pow(1 - p, 3);
      eintrag.wert = start + (ziel - start) * e;
      if (p < 1) { eintrag.raf = requestAnimationFrame(schritt); connections.redrawNow(); }
      else { anim.delete(b.id); connections.redrawNow(); }
    };
    // Notausgang: Läuft kein rAF (verdeckter Tab), steht am Ende trotzdem das Ziel
    eintrag.timer = setTimeout(() => { anim.delete(b.id); connections.redrawNow(); }, dauer + 260);
    eintrag.raf = requestAnimationFrame(schritt);
  }

  /**
   * Kanal und Adern eines Bündels.
   * Der Kanal ist ein gerades Stück; seine Lage ergibt sich aus den Enden
   * der Mitglieder und lässt sich über `mitte` von Hand verschieben.
   */
  function buendelWege(b, mit) {
    const enden = [];
    for (const c of mit) {
      const ra = endpointRect(c.from), rb = endpointRect(c.to);
      if (!ra || !rb) continue;
      const sa = c.from.side === 'auto' ? autoSide(ra, rb) : c.from.side;
      const sb = c.to.side === 'auto' ? autoSide(rb, ra) : c.to.side;
      enden.push({ c, p1: anchor(ra, sa), p2: anchor(rb, sb), sa, sb });
    }
    if (!enden.length) return null;

    const mittel = (liste, feld) => liste.reduce((s, e) => s + e[feld], 0) / liste.length;
    const s = { x: mittel(enden.map((e) => e.p1), 'x'), y: mittel(enden.map((e) => e.p1), 'y') };
    const e2 = { x: mittel(enden.map((e) => e.p2), 'x'), y: mittel(enden.map((e) => e.p2), 'y') };
    const waag = Math.abs(e2.x - s.x) >= Math.abs(e2.y - s.y);
    const mitte = b.mitte || { x: (s.x + e2.x) / 2, y: (s.y + e2.y) / 2 };
    const halb = Math.max(30, b.laenge / 2);
    const vor = waag ? (e2.x >= s.x ? 1 : -1) : (e2.y >= s.y ? 1 : -1);
    const richtung = waag ? { x: vor, y: 0 } : { x: 0, y: vor };
    const senk = waag ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const A = { x: mitte.x - richtung.x * halb, y: mitte.y - richtung.y * halb };
    const B = { x: mitte.x + richtung.x * halb, y: mitte.y + richtung.y * halb };

    const auf = oeffnung(b);
    const n = enden.length;
    const spreiz = b.spreizung * auf;
    const seiteA = seiteVonNormale(-richtung.x, -richtung.y);
    const seiteB = seiteVonNormale(richtung.x, richtung.y);

    const wege = new Map();
    let spanne = 0;
    enden.forEach((e, i) => {
      const off = (i - (n - 1) / 2) * spreiz;
      spanne = Math.max(spanne, Math.abs(off));
      const ein = { x: A.x + senk.x * off, y: A.y + senk.y * off, nx: -richtung.x, ny: -richtung.y };
      const aus = { x: B.x + senk.x * off, y: B.y + senk.y * off, nx: richtung.x, ny: richtung.y };
      const teil1 = orthoPoints(e.p1, ein, e.sa, seiteA, stummel(e.c.from, e.p1, e.sa), 0);
      const teil2 = orthoPoints(aus, e.p2, seiteB, e.sb, 0, stummel(e.c.to, e.p2, e.sb));
      const pts = entdopple(teil1.concat(teil2));
      wege.set(e.c.id, {
        d: 'M' + pts.map((p) => (p.x + OFF) + ',' + (p.y + OFF)).join(' L'),
        start: e.p1, pts: pts
      });
    });

    return { A, B, richtung, senk, waag, mitte, spanne, auf, wege, anzahl: n };
  }

  function seiteVonNormale(nx, ny) {
    if (nx < -0.5) return 'l';
    if (nx > 0.5) return 'r';
    return ny < 0 ? 't' : 'b';
  }

  /**
   * Mantel und Wickel — das Sichtbare am Strang.
   *
   * Wie bei den Adern bleiben die Knoten stehen. Drei Bündel kosteten im
   * Neubau 7,7 ms je Bild (gemessen auf der Feldherr-Tafel): 27 Pfade und
   * ebenso viele Zuhörer, abgerissen und wieder aufgebaut, damit sich zwei
   * Zahlen ändern. Neu angelegt wird nur, wenn die ANZAHL der Wickel
   * wechselt — und die hängt an der Länge des Strangs, nicht am Zoom.
   */
  function zeichneStrang(b, st, mit, scale) {
    let s = strangEls.get(b.id);
    if (!s) {
      const g = U.svg('g', { class: 'bnd' });
      g.setAttribute('data-bundle', b.id);
      const mantel = U.svg('path', { class: 'bnd-mantel', 'stroke-linecap': 'round' });
      g.appendChild(mantel);
      /* Gleich hinter <defs>, also ganz unten im Stapel: Der Strang gehört
         HINTER seine Adern. Angehängt landete ein später erzeugtes Bündel
         über den Pfeilen und legte seinen Mantel darüber. */
      layer.insertBefore(g, defs.nextSibling);
      s = { g: g, mantel: mantel, paare: [], letzt: {} };
      strangEls.set(b.id, s);
    }
    const L = s.letzt;

    const halbe = st.spanne + Math.max(3, b.width * 1.3);
    const px = (v) => v / scale;                     // Bildpunkte in Weltmaß

    s.g.classList.toggle('is-zu', st.auf < 0.5);
    s.g.classList.toggle('is-auf', st.auf >= 0.5);

    /* Mantel: liegt HINTER den Adern und macht aus vielen Strichen eine
       Leitung. Zugeklappt ist er kräftig, offen nur noch ein Hauch. */
    const mantelBreite = st.auf < 1
      ? (halbe * 2 + Math.max(6, b.width * 2.2)) * (1 - st.auf) + halbe * 2 * st.auf
      : halbe * 2;
    setzeAttr(s.mantel, 'd', 'M' + (st.A.x + OFF) + ',' + (st.A.y + OFF) + ' L' + (st.B.x + OFF) + ',' + (st.B.y + OFF), L, 'md');
    setzeAttr(s.mantel, 'stroke', b.color, L, 'mfarbe');
    setzeAttr(s.mantel, 'stroke-width', Math.max(mantelBreite, px(6)), L, 'mw');
    setzeAttr(s.mantel, 'opacity', 0.10 + 0.26 * (1 - st.auf), L, 'mo');

    /* Wickel quer über den Strang. Sie sind zugleich der Griff: darauf
       tippen klappt auf und zu. */
    const laenge = Math.abs(st.B.x - st.A.x) + Math.abs(st.B.y - st.A.y);
    const anzahl = U.clamp(Math.round(laenge / 90), 2, 7);
    const dicke = Math.max(px(5), b.width * 1.6);

    while (s.paare.length > anzahl) {
      const p = s.paare.pop();
      p.wickel.remove(); p.griff.remove();
    }
    while (s.paare.length < anzahl) s.paare.push(neuesWickelpaar(s, b));

    for (let i = 1; i <= anzahl; i++) {
      const p = s.paare[i - 1];
      const t = i / (anzahl + 1);
      const cx = st.A.x + (st.B.x - st.A.x) * t;
      const cy = st.A.y + (st.B.y - st.A.y) * t;
      const q1 = { x: cx - st.senk.x * (halbe + px(2)), y: cy - st.senk.y * (halbe + px(2)) };
      const q2 = { x: cx + st.senk.x * (halbe + px(2)), y: cy + st.senk.y * (halbe + px(2)) };
      const d = 'M' + (q1.x + OFF) + ',' + (q1.y + OFF) + ' L' + (q2.x + OFF) + ',' + (q2.y + OFF);
      setzeAttr(p.wickel, 'd', d, p.letzt, 'd');
      setzeAttr(p.wickel, 'stroke', b.color, p.letzt, 'farbe');
      setzeAttr(p.wickel, 'stroke-width', dicke, p.letzt, 'w');
      setzeAttr(p.griff, 'd', d, p.letzt, 'gd');
      setzeAttr(p.griff, 'stroke-width', Math.max(dicke * 2.4, px(16)), p.letzt, 'gw');
    }
  }

  /** Ein Wickel samt Griff — Zuhörer hängen einmal daran, nicht je Bild */
  function neuesWickelpaar(s, b) {
    const wickel = U.svg('path', { class: 'bnd-wickel', 'stroke-linecap': 'round' });
    const griff = U.svg('path', { class: 'bnd-griff' });
    griff.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.stopPropagation();
      connections.selectBundle(b.id);
    });
    griff.addEventListener('dblclick', (ev) => { ev.stopPropagation(); connections.toggleBundle(b.id); });
    griff.addEventListener('pointerenter', () => { hoverBundle = b.id; applySelectionClasses(); });
    griff.addEventListener('pointerleave', () => { if (hoverBundle === b.id) { hoverBundle = null; applySelectionClasses(); } });
    s.g.append(wickel, griff);
    return { wickel: wickel, griff: griff, letzt: {} };
  }

  /** Die Sprechblase am Strang: Name, Zahl, Auf-/Zuklappen, Verschieben */
  function chip(b, st, mit) {
    let el = chipEls.get(b.id);
    if (!el) {
      el = U.el('div', { class: 'bnd-chip', dataset: { bundle: b.id } });
      el.innerHTML = '<span class="bnd-chip__pfeil"></span>' +
        '<span class="bnd-chip__name"></span><span class="bnd-chip__zahl"></span>';
      labelLayer.appendChild(el);
      chipEls.set(b.id, el);

      el.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        connections.selectBundle(b.id);
        ziehStrang(b, ev);
      });
      el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); connections.toggleBundle(b.id); });
      el.addEventListener('pointerenter', () => { hoverBundle = b.id; applySelectionClasses(); });
      el.addEventListener('pointerleave', () => { if (hoverBundle === b.id) { hoverBundle = null; applySelectionClasses(); } });
    }
    el.querySelector('.bnd-chip__name').textContent = b.name;
    el.querySelector('.bnd-chip__zahl').textContent = st.anzahl;
    el.classList.toggle('is-zu', st.auf < 0.5);
    el.style.setProperty('--bnd-farbe', b.color);

    const wx = st.mitte.x, wy = st.mitte.y - (st.waag ? st.spanne + 22 : 0);
    chipPunkte.set(b.id, { x: wx, y: wy });     // fürs Nachführen beim Schwenken
    const s = GD.board.worldToScreen(wx, wy);
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';

    const sc = GD.board.scale();
    const sicht = b.id === selBundle || b.id === hoverBundle ? 1 : U.clamp((sc - 0.05) / 0.08, 0, 1);
    el.style.opacity = sicht;
    el.style.pointerEvents = sicht < 0.4 ? 'none' : 'auto';
  }

  /** Den Strang mit der Maus an eine andere Stelle legen */
  function ziehStrang(b, ev) {
    const start = b.mitte ? { x: b.mitte.x, y: b.mitte.y } : null;
    const p0 = GD.board.screenToWorld(ev.clientX, ev.clientY);
    U.drag(ev, {
      cursor: 'grabbing',
      onMove(dx, dy, e) {
        const p = GD.board.screenToWorld(e.clientX, e.clientY);
        if (!start) {
          const st = buendelWege(b, mitgliederVon(b.id));
          b.mitte = st ? { x: st.mitte.x, y: st.mitte.y } : { x: p.x, y: p.y };
        }
        b.mitte = { x: Math.round((start || b.mitte).x + (p.x - p0.x)), y: Math.round((start || b.mitte).y + (p.y - p0.y)) };
        connections.redrawNow();
      },
      onEnd(e, moved) { if (moved) GD.store.commit('Bündel verschoben'); }
    });
  }

  /**
   * Pfeilspitze — je FARBE und Richtung eine, nicht je Pfeil eine.
   *
   * Vorher bekam jeder Pfeil seinen eigenen Marker, und bei jedem Bild
   * wurden alle weggeworfen und neu gebaut. Eine Spitze hängt aber nur an
   * ihrer Farbe: Zwanzig blaue Pfeile teilen sich einen Marker, und der
   * bleibt stehen, bis die Seite neu lädt (ein paar Dutzend leere Knoten
   * im <defs> kosten nichts, ihr ständiger Neubau schon).
   */
  function holeMarker(farbe, which) {
    const kenn = which + '_' + String(farbe).replace(/[^a-z0-9]/gi, '');
    if (markerEls.has(kenn)) return kenn;
    const marker = U.svg('marker', {
      id: kenn, viewBox: '0 0 8 8', refX: which === 'end' ? 7.2 : 0.8, refY: 4,
      markerWidth: 5, markerHeight: 5, orient: which === 'end' ? 'auto' : 'auto-start-reverse',
      markerUnits: 'strokeWidth'
    }, [U.svg('path', { d: 'M0.5,0.6 L7.5,4 L0.5,7.4 L2.1,4 Z', fill: farbe })]);
    defs.appendChild(marker);
    markerEls.set(kenn, marker);
    return kenn;
  }

  function dashArray(kind, w) {
    if (kind === 'dashed') return (w * 3.4) + ' ' + (w * 2.4);
    if (kind === 'dotted') return (w * 0.1) + ' ' + (w * 2.2);
    return null;
  }

  /* ------------------------------------------------------- Wegberechnung */

  /**
   * Rechteck eines Pfeilendes in Weltkoordinaten.
   *
   * Zeigt das Ende auf eine Form innerhalb eines Wireframes, liefert das
   * Modul deren Lage; sonst gilt der Fensterrahmen. Fehlt die Form (gelöscht,
   * Fenster eingeklappt), fällt der Pfeil sauber auf das Fenster zurück.
   */
  function endpointRect(ep) {
    const win = GD.store.getWindow(ep.win);
    if (!win) return null;
    if (ep.shape && !win.collapsed) {
      const rec = GD.windows.get(ep.win);
      if (rec && rec.inst && rec.inst.shapeAnchor) {
        const r = rec.inst.shapeAnchor(ep.shape);
        if (r && r.w >= 0 && r.h >= 0) return r;
      }
    }
    return { x: win.x, y: win.y, w: win.w, h: win.collapsed ? BAR_H : win.h };
  }

  function anchor(r, side) {
    switch (side) {
      case 't': return { x: r.x + r.w / 2, y: r.y, nx: 0, ny: -1 };
      case 'b': return { x: r.x + r.w / 2, y: r.y + r.h, nx: 0, ny: 1 };
      case 'l': return { x: r.x, y: r.y + r.h / 2, nx: -1, ny: 0 };
      case 'r': return { x: r.x + r.w, y: r.y + r.h / 2, nx: 1, ny: 0 };
      default: return null;
    }
  }

  /** Beste Seite, wenn 'auto': die zum Gegenüber zeigende */
  function autoSide(a, b) {
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
    const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    // Überlappungsfreie Achse bevorzugen
    const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
    const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
    if (gapX > -20 && gapX >= gapY) return dx > 0 ? 'r' : 'l';
    if (gapY > -20) return dy > 0 ? 'b' : 't';
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't');
  }

  /**
   * Rechtwinkliger Weg von p1 nach p2.
   *
   * Beide Enden rücken erst einen Stummel senkrecht von ihrer Kante ab —
   * sonst klebte der Pfeil an der Fensterwand und man sähe nicht, wo er
   * ansetzt. Dazwischen liegt je nach Kantenpaar ein L (eine Ecke) oder
   * ein Z (zwei Ecken); mehr braucht es nie. Gekrümmt wird nichts.
   */
  function orthoPoints(p1, p2, sa, sb, stubA, stubB) {
    const s = { x: p1.x + p1.nx * stubA, y: p1.y + p1.ny * stubA };
    const e = { x: p2.x + p2.nx * stubB, y: p2.y + p2.ny * stubB };
    const waag = (side) => side === 'l' || side === 'r';
    const mitte = [];

    if (waag(sa) && waag(sb)) {
      // Zeigen die Stummel aufeinander zu, teilt die Senkrechte in der Mitte
      // den Weg. Läuft der Pfeil zurück, würde diese Senkrechte durch beide
      // Fenster schneiden — dann wird waagerecht auf halber Höhe verbunden.
      const zu = (sa === 'r' && e.x >= s.x) || (sa === 'l' && e.x <= s.x);
      if (zu) { const mx = (s.x + e.x) / 2; mitte.push({ x: mx, y: s.y }, { x: mx, y: e.y }); }
      else { const my = (s.y + e.y) / 2; mitte.push({ x: s.x, y: my }, { x: e.x, y: my }); }
    } else if (!waag(sa) && !waag(sb)) {
      const zu = (sa === 'b' && e.y >= s.y) || (sa === 't' && e.y <= s.y);
      if (zu) { const my = (s.y + e.y) / 2; mitte.push({ x: s.x, y: my }, { x: e.x, y: my }); }
      else { const mx = (s.x + e.x) / 2; mitte.push({ x: mx, y: s.y }, { x: mx, y: e.y }); }
    } else if (waag(sa)) {
      mitte.push({ x: e.x, y: s.y });
    } else {
      mitte.push({ x: s.x, y: e.y });
    }

    return entdopple([p1, s].concat(mitte, [e, p2]));
  }

  /** Punkte auf einer Linie und Dubletten wegwerfen — sonst zappelt das Etikett */
  function entdopple(pts) {
    const out = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
      out.push({ x: p.x, y: p.y });
    }
    for (let i = out.length - 2; i > 0; i--) {
      const a = out[i - 1], b = out[i], c = out[i + 1];
      const gerade = (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) ||
                     (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5);
      if (gerade) out.splice(i, 1);
    }
    return out;
  }

  /**
   * Wie weit ein Ende senkrecht abrückt, bevor der Pfeil abbiegt.
   *
   * Hängt es an einer Form im Wireframe, reicht der übliche Stummel nicht:
   * Der Knick läge dann mitten im Fenster, und mit ihm das lange gerade
   * Stück, auf dem die Beschriftung steht. Ein Pfeil vom Knopf verlässt
   * deshalb erst sein Fenster und biegt dann ab.
   */
  function stummel(ep, p, side) {
    if (!ep.shape) return STUMMEL;
    const win = GD.store.getWindow(ep.win);
    if (!win || win.collapsed) return STUMMEL;
    const h = win.h;
    const raus = side === 'r' ? (win.x + win.w) - p.x
      : side === 'l' ? p.x - win.x
        : side === 'b' ? (win.y + h) - p.y
          : p.y - win.y;
    return Math.max(STUMMEL, raus + STUMMEL);
  }

  function routeGeometry(a, b, c) {
    const sa = c.from.side === 'auto' ? autoSide(a, b) : c.from.side;
    const sb = c.to.side === 'auto' ? autoSide(b, a) : c.to.side;
    const p1 = anchor(a, sa), p2 = anchor(b, sb);
    const x1 = p1.x + OFF, y1 = p1.y + OFF, x2 = p2.x + OFF, y2 = p2.y + OFF;

    if (c.curve === 'straight') {
      return { d: 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2, start: p1, pts: [p1, p2] };
    }

    if (c.curve === 'bezier') {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const pull = U.clamp(dist * 0.42, 40, 260);
      const c1x = x1 + p1.nx * pull, c1y = y1 + p1.ny * pull;
      const c2x = x2 + p2.nx * pull, c2y = y2 + p2.ny * pull;
      return {
        d: 'M' + x1 + ',' + y1 + ' C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + x2 + ',' + y2,
        start: p1, pts: null
      };
    }

    const pts = orthoPoints(p1, p2, sa, sb, stummel(c.from, p1, sa), stummel(c.to, p2, sb));
    const d = 'M' + pts.map((p) => (p.x + OFF) + ',' + (p.y + OFF)).join(' L');
    return { d: d, start: p1, pts: pts };
  }

  /** Liegt dieser Punkt über keiner Kachel? Rahmen zählen nicht mit. */
  function freiePlatte(p) {
    for (const w of GD.store.doc.windows) {
      if (w.type === 'frame') continue;
      const h = w.collapsed ? BAR_H : w.h;
      if (p.x > w.x && p.x < w.x + w.w && p.y > w.y && p.y < w.y + h) return false;
    }
    return true;
  }

  /**
   * Wo die Beschriftung steht: auf dem längsten geraden Stück, das
   * NEBEN den Kacheln verläuft.
   *
   * Die Beschriftung behält beim Zoomen ihre Pixelgröße — weit
   * herausgezoomt ist sie also größer als die Kachel, die sie erklärt.
   * Deshalb reicht „längstes Stück" nicht: Läge das mitten zwischen zwei
   * gestapelten Kacheln, deckte die Beschriftung deren Text zu. Erst wenn
   * gar kein Stück im Freien liegt, gilt wieder das längste.
   */
  function langstesStueck(pts, breite) {
    let best = null, bestLen = -1;
    let frei = null, freiLen = -1;
    let passt = null, passtLen = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
      const mitte = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
      if (len > bestLen) { bestLen = len; best = mitte; }
      if (!freiePlatte(mitte)) continue;
      if (len > freiLen) { freiLen = len; frei = mitte; }
      // Nur waagerechte Stücke tragen die Beschriftung in voller Breite;
      // auf einem senkrechten steht sie quer und ragt links und rechts aus.
      const traegt = Math.abs(pts[i + 1].y - pts[i].y) < 0.5 ? len : len * 0.35;
      if (traegt >= breite && len > passtLen) { passtLen = len; passt = mitte; }
    }
    return passt || frei || best;
  }

  /* ------------------------------------------------------ Beschriftungen */

  /**
   * Alle Beschriftungen in DREI Durchgängen.
   *
   * Die Breite einer Beschriftung lässt sich nur erfragen, indem man den
   * Browser das Layout ausrechnen lässt (`offsetWidth`). Wer zwischen zwei
   * Schreibvorgängen misst, löst diese Rechnung jedes Mal neu aus — bei 52
   * Pfeilen also 52-mal je Bild. Deshalb: erst ALLES schreiben, dann ALLES
   * messen, dann alle Lagen setzen. Gemessen wird ohnehin nur, was seinen
   * Text oder seine Schriftgröße geändert hat.
   */
  function beschriftungen(liste, scale) {
    for (const e of liste) e.el = labelKnoten(e.c);

    for (const e of liste) {
      const kenn = (e.c.label || '') + '¦' + (e.c.labelSize || 12);
      if (e.rec.breiteKenn !== kenn) {
        e.rec.breite = e.el.offsetWidth;
        e.rec.breiteKenn = kenn;
      }
    }

    for (const e of liste) labelLegen(e.c, e.rec, e.geo, e.el, scale);
  }

  /** Knoten der Beschriftung holen oder anlegen, Text und Schrift setzen */
  function labelKnoten(c) {
    let el = labelEls.get(c.id);
    if (!el) {
      el = U.el('div', { class: 'conn-label', dataset: { id: c.id }, spellcheck: false });
      el.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0 || el.isContentEditable) return;
        ev.stopPropagation();
        connections.select(c.id);
        dragLabel(c, ev);
      });
      el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); startLabelEdit(c.id); });
      labelLayer.appendChild(el);
      labelEls.set(c.id, el);
    }
    if (!el.isContentEditable) {
      const text = c.label || '＋';
      if (el.textContent !== text) el.textContent = text;
      el.classList.toggle('is-empty', !c.label);
    }
    const gr = (c.labelSize || 12) + 'px';
    if (el.style.fontSize !== gr) el.style.fontSize = gr;
    const rand = c.id === selectedId ? c.color : '';
    if (el.style.borderColor !== rand) el.style.borderColor = rand;
    return el;
  }

  function labelLegen(c, rec, geo, el, sc) {
    /* Weit herausgezoomt liegen die Beschriftungen sonst übereinander: Sie
       behalten ihre Pixelgröße, der Abstand zwischen den Pfeilen aber nicht.
       Ausgeblendet wird nur die Anzeige — Größe und Text bleiben unberührt. */
    const fade = c.id === selectedId || c.id === hoverId
      ? 1 : U.clamp((sc - 0.16) / 0.16, 0, 1);
    el.style.opacity = fade;
    el.style.pointerEvents = fade < 0.4 ? 'none' : 'auto';

    /* Ohne eigenes t sitzt die Beschriftung in der Mitte des längsten
       geraden Stücks. Bei einem Pfeil vom Knopf zur Wirkung ist das die
       lange Strecke zwischen den beiden Fenstern — die Beschriftung deckt
       damit weder den Knopf noch die Notiz zu. Erst wer sie anfasst, legt
       mit t eine eigene Stelle fest. */
    const t = c.t;
    let pt = null;
    if ((t === undefined || t === null) && geo && geo.pts) {
      const m = langstesStueck(geo.pts, (rec.breite + 10) / Math.max(sc, 0.01));
      if (m) pt = { x: m.x, y: m.y };
    }
    if (!pt) pt = punktAuf(geo, rec, t);

    rec.weltPunkt = pt;                 // fürs Nachführen beim Schwenken
    const s = GD.board.worldToScreen(pt.x, pt.y);
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';
  }

  /**
   * Punkt bei Anteil t auf dem Weg — selbst gerechnet.
   *
   * `getPointAtLength()` ist ein Lesezugriff auf das Layout und damit genauso
   * teuer wie `offsetWidth`. Für einen Streckenzug ist die Rechnung ein
   * Zehnzeiler; nur die geschwungene Form (bezier, ohne Punktliste) muss
   * weiter den Browser fragen.
   */
  function punktAuf(geo, rec, t) {
    const anteil = U.clamp(t === undefined || t === null ? 0.5 : t, 0, 1);
    const pts = geo && geo.pts;
    if (pts && pts.length > 1) {
      let ges = 0;
      for (let i = 0; i < pts.length - 1; i++) ges += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      let rest = ges * anteil;
      for (let i = 0; i < pts.length - 1; i++) {
        const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        if (rest <= l || i === pts.length - 2) {
          const f = l > 0 ? U.clamp(rest / l, 0, 1) : 0;
          return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
        }
        rest -= l;
      }
    }
    if (pts && pts.length === 1) return { x: pts[0].x, y: pts[0].y };
    try {
      const len = rec.path.getTotalLength();
      const p = rec.path.getPointAtLength(len * anteil);
      return { x: p.x - OFF, y: p.y - OFF };
    } catch (e) { return { x: 0, y: 0 }; }
  }

  /**
   * Beim reinen Schwenken: nur die Bildschirm-Ebene nachziehen.
   *
   * Pfade, Stränge und Wickel liegen im Weltraum — das Board schiebt sie
   * mit seiner eigenen Transformation. Beschriftungen und Sprechblasen
   * hängen im Bildschirmraum und brauchen zwei Zahlen. Mehr ist beim
   * Schwenken nicht zu tun.
   */
  const schirmNachfuehren = U.raf(function () {
    for (const [id, el] of labelEls) {
      const rec = adern.get(id);
      if (!rec || !rec.weltPunkt) continue;
      const s = GD.board.worldToScreen(rec.weltPunkt.x, rec.weltPunkt.y);
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
    }
    for (const [id, el] of chipEls) {
      const p = chipPunkte.get(id);
      if (!p) continue;
      const s = GD.board.worldToScreen(p.x, p.y);
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
    }
  });

  function startLabelEdit(id) {
    const c = GD.store.doc.connections.find((x) => x.id === id);
    const el = labelEls.get(id);
    if (!c || !el) return;
    connections.select(id);
    el.textContent = c.label;
    el.contentEditable = 'true';
    el.classList.remove('is-empty');
    el.focus();
    document.getSelection().selectAllChildren(el);

    const finish = (save) => {
      el.contentEditable = 'false';
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('keydown', onKey);
      if (save) {
        const next = el.textContent.replace(/\s+$/, '');
        if (next !== c.label) { c.label = next; GD.store.commit('Beschriftung geändert'); }
      }
      connections.redraw();
    };
    const onBlur = () => finish(true);
    const onKey = (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); el.blur(); }
      if (ev.key === 'Escape') { el.textContent = c.label; finish(false); }
    };
    el.addEventListener('blur', onBlur);
    el.addEventListener('keydown', onKey);
  }

  /** Beschriftung entlang des Pfades verschieben */
  function dragLabel(c, ev) {
    const pathEl = pathEls.get(c.id);
    if (!pathEl) return;
    const len = pathEl.getTotalLength();
    U.drag(ev, {
      cursor: 'grabbing',
      onMove(dx, dy, e) {
        const p = GD.board.screenToWorld(e.clientX, e.clientY);
        let best = 0.5, bestD = Infinity;
        for (let i = 0; i <= 60; i++) {
          const pt = pathEl.getPointAtLength(len * (i / 60));
          const d = Math.hypot(pt.x - OFF - p.x, pt.y - OFF - p.y);
          if (d < bestD) { bestD = d; best = i / 60; }
        }
        c.t = best;
        connections.redraw();
      },
      onEnd(e, moved) { if (moved) GD.store.commit('Beschriftung verschoben'); }
    });
  }

  function applySelectionClasses() {
    for (const [id, el] of labelEls) {
      const active = id === selectedId || id === hoverId;
      el.classList.toggle('is-selected', id === selectedId);
      el.style.display = (el.classList.contains('is-empty') && !active) ? 'none' : '';
    }
    /* Über die gemerkten Knoten statt über querySelectorAll: Das hier läuft
       bei jedem Überfahren eines Pfeils, und die Ebene neu zu durchsuchen
       kostet mehr als der Klassenwechsel selbst. */
    for (const [id, rec] of adern) {
      const g = rec.g;
      const bnd = g.getAttribute('data-bundle');
      g.classList.toggle('is-selected', id === selectedId);
      /* Das ganze Bündel hebt sich mit: Wer den Strang anfasst, soll sehen,
         welche Adern darin liegen. */
      g.classList.toggle('is-hervor', !!(bnd && (bnd === selBundle || bnd === hoverBundle)));
    }
    for (const [id, s] of strangEls) {
      s.g.classList.toggle('is-selected', id === selBundle);
      s.g.classList.toggle('is-hover', id === hoverBundle);
    }
    for (const [id, el] of chipEls) {
      el.classList.toggle('is-selected', id === selBundle);
      el.classList.toggle('is-hover', id === hoverBundle);
    }
  }

  /* --------------------------------------------------- Pfeil aufziehen */

  /**
   * Einen Pfeil aufziehen — auf zwei Wegen.
   *
   * ZIEHEN: Knopf drücken, zum Ziel ziehen, loslassen. Schnell, aber es
   * verlangt eine gehaltene Taste über womöglich den halben Bildschirm, und
   * herausgezoomt liegen Start und Ziel weit auseinander.
   *
   * KLICKEN: Knopf antippen, loslassen, Ziel anklicken. Der Pfeil hängt
   * dazwischen am Zeiger, Esc bricht ab. Für lange Wege, für Trackpads und
   * für alle, denen Ziehen über weite Strecken schwerfällt. Welcher der
   * beiden Wege gemeint war, entscheidet sich am Ende von selbst: ohne
   * Bewegung war es ein Klick.
   */
  connections.beginLink = function (winId, side, ev, shapeId) {
    const boardEl = GD.board.elBoard;
    const fromRect = endpointRect({ win: winId, side: side, shape: shapeId || null });
    if (!fromRect) return;
    boardEl.classList.add('is-linking');
    const a = anchor(fromRect, side === 'auto' ? 'r' : side);

    const temp = U.svg('path', { class: 'conn-path conn-path--vorschau', fill: 'none' });
    layer.appendChild(temp);
    let dropRec = null, dropShapeEl = null;
    let loesen = null;                 // Zuhörer des Klickmodus

    /** Vorschauweg und Zielhervorhebung an die Zeigerposition führen */
    function vorschau(clientX, clientY) {
      const sc = GD.board.scale() || 1;
      temp.setAttribute('stroke-width', String(Math.max(1.5, 2 / sc)));
      temp.setAttribute('stroke-dasharray', (6 / sc) + ' ' + (5 / sc));

      const p = GD.board.screenToWorld(clientX, clientY);
      // Vorschau im selben rechten Winkel, in dem der Pfeil danach liegt
      const s = { x: a.x + a.nx * STUMMEL, y: a.y + a.ny * STUMMEL };
      const ecke = (a.nx !== 0) ? { x: p.x, y: s.y } : { x: s.x, y: p.y };
      const pts = entdopple([a, s, ecke, p]);
      temp.setAttribute('d', 'M' + pts.map((q) => (q.x + OFF) + ',' + (q.y + OFF)).join(' L'));

      const under = document.elementFromPoint(clientX, clientY);
      const winEl = under && under.closest ? under.closest('.gd-win') : null;
      // Eine Form im eigenen Fenster ist ein gültiges Ziel, das Fenster selbst nicht
      const shapeEl = under && under.closest ? under.closest('.wf-shape') : null;
      const rec = winEl && (winEl.dataset.id !== winId || shapeEl) ? GD.windows.get(winEl.dataset.id) : null;
      if (dropRec !== rec) {
        if (dropRec) dropRec.el.classList.remove('is-drop-target');
        dropRec = rec;
        if (dropRec) dropRec.el.classList.add('is-drop-target');
      }
      if (dropShapeEl !== shapeEl) {
        if (dropShapeEl) dropShapeEl.classList.remove('is-drop-shape');
        dropShapeEl = shapeEl;
        if (dropShapeEl) dropShapeEl.classList.add('is-drop-shape');
      }
    }

    function aufraeumen() {
      temp.remove();
      boardEl.classList.remove('is-linking');
      if (dropRec) dropRec.el.classList.remove('is-drop-target');
      if (dropShapeEl) dropShapeEl.classList.remove('is-drop-shape');
      if (loesen) { loesen(); loesen = null; }
    }

    /** Am Zeigerpunkt abschließen; true, wenn ein Pfeil entstanden ist */
    function abschliessen(clientX, clientY) {
      const ziel = dropRec;
      const zielForm = dropShapeEl ? dropShapeEl.dataset.id : null;
      const under = document.elementFromPoint(clientX, clientY);
      const portSide = under && under.closest && under.closest('.gd-port');
      aufraeumen();
      if (!ziel) return false;
      connections.add(winId, side, ziel.data.id,
        portSide ? portSide.dataset.side : 'auto', shapeId || null, zielForm);
      return true;
    }

    function klickModus() {
      const ab = [];
      loesen = () => { for (const f of ab) f(); ab.length = 0; };
      ab.push(U.on(window, 'pointermove', (e) => vorschau(e.clientX, e.clientY), true));
      ab.push(U.on(window, 'pointerdown', (e) => {
        if (e.button !== 0) { aufraeumen(); return; }
        e.preventDefault();
        e.stopPropagation();
        vorschau(e.clientX, e.clientY);   // auch ohne vorheriges Bewegen (Touch)
        abschliessen(e.clientX, e.clientY);
      }, true));
      ab.push(U.on(window, 'keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        aufraeumen();
      }, true));
      // Ein Modus ohne Ausgang ist eine Falle — der Ausgang steht dabei
      if (GD.ui) GD.ui.toast('Pfeil: Ziel anklicken · Esc bricht ab');
    }

    U.drag(ev, {
      cursor: 'crosshair',
      onMove(dx, dy, e) { vorschau(e.clientX, e.clientY); },
      onEnd(e, moved) {
        if (moved) abschliessen(e.clientX, e.clientY);
        else klickModus();
      }
    });
  };

  connections.editLabel = startLabelEdit;
  GD.connections = connections;
})();
