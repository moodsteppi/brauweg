/* GameDesk — Automatisches Layout
 *
 * Fünf Regeln, die bei jeder Erzeugung und auf Knopfdruck gelten sollen:
 *
 *   1. Text ist vollständig sichtbar. Die Höhe wird gemessen, nicht geraten.
 *   2. Kacheln überlappen sich nicht. Rahmen zählen dabei nicht mit — die
 *      liegen ohnehin in einem eigenen, tieferen Stapelband.
 *   3. Rahmen werden nach ihrem Inhalt gezogen.
 *   4. Bereiche sind benannt, eingefärbt und haben eine feste Reihenfolge.
 *   5. Keine Überschrift wird verdeckt. Das Kopfband eines Rahmens —
 *      Titelleiste, Wasserzeichen, Untertitel — bleibt frei.
 *
 * Gemessen wird an einem versteckten Knoten außerhalb des Boards: der ist
 * nicht von der Zoom-Transformation betroffen, sein scrollHeight ist also
 * eine echte Pixelzahl und nicht die des gerade eingestellten Maßstabs.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const ABSTAND = 24;              // Mindestluft zwischen zwei Kacheln
  const RAND = 44;                 // Luft zwischen Rahmenkante und Inhalt
  const MAX_SPALTEN = 4;
  const MAX_RUNDEN = 250;          // Notbremse beim Entwirren

  /**
   * Höhe des Kopfbands eines Rahmens.
   *
   * Früher stand hier eine feste 24 — geraten, und um mehr als das
   * Vierfache daneben: Titelleiste (34) und Wasserzeichen allein brauchen
   * über 70 Pixel, mit Untertitel über 100. Jede Rahmenüberschrift lag
   * deshalb unter der ersten Kachel. Jetzt sagt der Rahmen selbst, wie viel
   * Platz seine Überschrift braucht (modules/frame.js: kopfHoehe); nur wenn
   * er gerade nicht gezeichnet ist, gilt der Vorgabewert aus dem Blatt.
   */
  function kopfVon(rahmenId) {
    const rec = rahmenId ? GD.windows.get(rahmenId) : null;
    if (rec && rec.inst && typeof rec.inst.kopfHoehe === 'function') {
      const h = rec.inst.kopfHoehe();
      if (Number.isFinite(h) && h > 0) return Math.ceil(h);
    }
    const d = rahmenId ? GD.store.getWindow(rahmenId) : null;
    const mitNote = !!(d && d.state && d.state.note);
    return kopfVorgabe(mitNote);
  }

  function kopfVorgabe(mitNote) {
    const css = getComputedStyle(document.documentElement);
    const v = parseFloat(css.getPropertyValue(mitNote ? '--fr-kopf-note' : '--fr-kopf'));
    return Number.isFinite(v) && v > 0 ? Math.ceil(v) : (mitNote ? 112 : 92);
  }

  /**
   * Bereichs-Taxonomie. Die Reihenfolge bestimmt, in welcher Folge bereich()
   * neue Bereiche untereinander legt. Erweitern über layout.merkeBereich().
   */
  const BEREICHE = [
    { id: 'gamedesign', label: 'Gamedesign', tint: '#b78cf7', ordnung: 10 },
    { id: 'menues',     label: 'Menüs',      tint: '#6ea8fe', ordnung: 20 },
    { id: 'game',       label: 'Game',       tint: '#57c98a', ordnung: 30 },
    { id: 'charaktere', label: 'Charaktere', tint: '#f78ca0', ordnung: 40 },
    { id: 'mechanik',   label: 'Mechanik',   tint: '#4fd1c5', ordnung: 50 },
    { id: 'technik',    label: 'Technik',    tint: '#8fa4c4', ordnung: 60 },
    { id: 'daten',      label: 'Daten',      tint: '#e8b45c', ordnung: 70 },
    { id: 'betrieb',    label: 'Betrieb',    tint: '#ef6b6b', ordnung: 80 },
    { id: 'medien',     label: 'Medien',     tint: '#e0a0c8', ordnung: 90 },
    { id: 'sonstiges',  label: 'Sonstiges',  tint: '#94a3b8', ordnung: 100 }
  ];

  /* ------------------------------------------------------------- Messen */

  let messRaum = null;
  function messKnoten() {
    if (!messRaum) {
      messRaum = U.el('div', { class: 'gd-messung' });
      document.body.appendChild(messRaum);
    }
    return messRaum;
  }

  /**
   * Höhe, die dieser Text bei dieser Breite braucht.
   * opt.klasse wählt das Regelwerk (Vorgabe: die Notiz), opt.stil setzt
   * einzelne Eigenschaften nach — etwa den Umbruchmodus des Quelltextes.
   */
  function textHoehe(html, breite, size, opt) {
    const o = opt || {};
    const box = messKnoten();
    box.className = 'gd-messung ' + (o.klasse || 'nt-editor');
    box.removeAttribute('style');
    box.style.width = Math.max(40, Math.round(breite)) + 'px';
    if (size) box.style.fontSize = size + 'px';
    if (o.stil) Object.assign(box.style, o.stil);
    box.innerHTML = html || '';
    const h = box.scrollHeight;
    box.innerHTML = '';
    return h;
  }

  /* ------------------------------------------------------------- Zugriff */

  const istRahmen = (d) => d.type === 'frame';
  const hoehe = (d) => (d.collapsed ? GD.windows.BAR_H : d.h);

  function alleIds() { return GD.store.doc.windows.map((w) => w.id); }

  function fensterVon(ids) {
    const liste = (ids && ids.length ? ids : alleIds());
    const out = [];
    for (const id of liste) {
      const d = typeof id === 'string' ? GD.store.getWindow(id) : id;
      if (d) out.push(d);
    }
    return out;
  }

  function ueberlappt(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + hoehe(b) && a.y + hoehe(a) > b.y;
  }

  /** Was ein Fenster an Höhe bräuchte — null, wenn das Modul nichts dazu sagt */
  function noetigeHoehe(d) {
    const rec = GD.windows.get(d.id);
    if (!rec || !rec.inst || d.collapsed) return null;
    const koerper = rec.body;
    const breite = koerper.clientWidth;
    if (!breite) return null;
    const rahmenwerk = d.h - koerper.clientHeight;      // Titelleiste und Ränder

    if (typeof rec.inst.inhaltsHoehe === 'function') {
      let inhalt = null;
      try { inhalt = rec.inst.inhaltsHoehe(breite); } catch (e) { console.warn('[GD] inhaltsHoehe():', e); }
      if (Number.isFinite(inhalt) && inhalt > 0) return Math.ceil(rahmenwerk + inhalt);
    }

    // Ohne eigene Auskunft bleibt nur der Überlauf des Scrollbereichs —
    // das kann wachsen, aber nichts über die tatsächliche Resthöhe sagen
    const scroller = koerper.querySelector('[data-gd-scroll]');
    if (!scroller) return null;
    const ueber = scroller.scrollHeight - scroller.clientHeight;
    return ueber > 1 ? Math.ceil(d.h + ueber) : null;
  }

  /* ------------------------------------------------------------ Regel 1 */

  function passeHoehenAn(ids) {
    let geaendert = 0;
    for (const d of fensterVon(ids)) {
      if (istRahmen(d)) continue;
      const soll = noetigeHoehe(d);
      if (soll === null || Math.abs(soll - d.h) < 2) continue;
      GD.windows.setGeometry(d.id, { h: soll });
      geaendert++;
    }
    return geaendert;
  }

  /* ------------------------------------------------------------ Regel 2 */

  /**
   * Überlappungen auflösen, indem das jeweils tiefer stehende Fenster nach
   * unten ausweicht. Nur nach unten: so bleibt die Leserichtung erhalten und
   * das Verfahren endet garantiert.
   */
  function entwirre(ids) {
    const liste = fensterVon(ids).filter((d) => !istRahmen(d))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const gesetzt = [];
    let bewegt = 0;

    for (const d of liste) {
      const y0 = d.y;
      let runden = 0, nochmal = true;
      while (nochmal && runden++ < MAX_RUNDEN) {
        nochmal = false;
        for (const o of gesetzt) {
          if (!ueberlappt(d, o)) continue;
          d.y = Math.round(o.y + hoehe(o) + ABSTAND);
          nochmal = true;
        }
      }
      if (d.y !== y0) { GD.windows.setGeometry(d.id, {}); bewegt++; }
      gesetzt.push(d);
    }
    return bewegt;
  }

  /* ------------------------------------------------------------ Regel 3 */

  /** Kastenmaß, das ein Rahmen um diese Fenster haben müsste */
  function rahmenMass(inhalt, rahmenId) {
    if (!inhalt.length) return null;
    const kopf = rahmenId === undefined ? kopfVorgabe(true) : kopfVon(rahmenId);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const w of inhalt) {
      x1 = Math.min(x1, w.x); y1 = Math.min(y1, w.y);
      x2 = Math.max(x2, w.x + w.w); y2 = Math.max(y2, w.y + hoehe(w));
    }
    return {
      x: Math.round(x1 - RAND), y: Math.round(y1 - RAND - kopf),
      w: Math.round(x2 - x1 + RAND * 2), h: Math.round(y2 - y1 + RAND * 2 + kopf)
    };
  }

  /** Was liegt gerade vollständig in diesem Rahmen? */
  function mitglieder(rahmenId) {
    const rec = GD.windows.get(rahmenId);
    if (!rec || !rec.inst || !rec.inst.dragCompanions) return [];
    return rec.inst.dragCompanions();
  }

  function inhaltVon(rahmenId, ids) {
    return fensterVon(ids || mitglieder(rahmenId));
  }

  /** ids optional: sonst gilt, was gerade im Rahmen liegt */
  function rahmenAnpassen(rahmenId, ids) {
    const d = GD.store.getWindow(rahmenId);
    if (!d) return false;
    const mass = rahmenMass(inhaltVon(rahmenId, ids), rahmenId);
    if (!mass) return false;
    if (mass.x === d.x && mass.y === d.y && mass.w === d.w && mass.h === d.h) return false;
    GD.windows.setGeometry(rahmenId, mass);
    return true;
  }

  /**
   * Alle Rahmen an ihren Inhalt legen.
   *
   * Maßgeblich ist die Vereinigung aus dem, was vor dem Umräumen drin lag,
   * und dem, was jetzt drin liegt: Weggerutschtes bleibt im Rahmen, und was
   * beim Entwirren hineingeschoben wurde, hängt nicht über der Kante. Weil
   * ein größerer Rahmen wieder mehr fassen kann, wird bis zum Stillstand
   * wiederholt — in der Praxis nach zwei Durchgängen.
   */
  function rahmenNachziehen(gemerkt) {
    const merk = Object.assign({}, gemerkt || {});
    const geaendert = new Set();
    for (let runde = 0; runde < 4; runde++) {
      let inDieserRunde = 0;
      for (const d of GD.store.doc.windows.filter(istRahmen)) {
        const menge = Array.from(new Set((merk[d.id] || []).concat(mitglieder(d.id))));
        merk[d.id] = menge;
        if (rahmenAnpassen(d.id, menge)) { geaendert.add(d.id); inDieserRunde++; }
      }
      if (!inDieserRunde) break;
    }
    return geaendert.size;
  }

  /** Wer liegt jetzt in welchem Rahmen? Vor dem Umräumen festhalten. */
  function zuordnungMerken() {
    const karte = {};
    for (const d of GD.store.doc.windows.filter(istRahmen)) karte[d.id] = mitglieder(d.id);
    return karte;
  }

  /* ------------------------------------------------------------ Regel 4 */

  function bereichVon(id) {
    return BEREICHE.find((b) => b.id === id) || null;
  }

  function merkeBereich(def) {
    if (!def || !def.id) return null;
    const alt = bereichVon(def.id);
    if (alt) { Object.assign(alt, def); return alt; }
    const neu = Object.assign({ label: def.id, tint: '#94a3b8', ordnung: 999 }, def);
    BEREICHE.push(neu);
    BEREICHE.sort((a, b) => a.ordnung - b.ordnung);
    return neu;
  }

  /** In welchem Bereich steckt dieser Rahmen? */
  function bereichDesRahmens(d) {
    return (d.state && d.state.bereich) ? bereichVon(d.state.bereich) : null;
  }

  /**
   * Kacheln als Raster anordnen und einen Bereichsrahmen darumlegen.
   * Der Block landet unter allem, was schon auf dem Board steht — wer die
   * Bereiche in ihrer Reihenfolge anlegt, bekommt sie auch so gestapelt.
   */
  function bereich(bereichId, titel, kacheln) {
    const def = bereichVon(bereichId) || merkeBereich({ id: bereichId, label: titel || bereichId });
    const inhalt = fensterVon((kacheln || []).map((k) => (typeof k === 'string' ? k : k && k.id)))
      .filter((d) => !istRahmen(d));
    if (!inhalt.length) return null;

    passeHoehenAn(inhalt.map((d) => d.id));

    const spalten = Math.max(1, Math.min(MAX_SPALTEN, Math.round(Math.sqrt(inhalt.length))));
    const spaltenBreite = Math.max.apply(null, inhalt.map((d) => d.w));

    // Startpunkt: linksbündig zum vorhandenen Inhalt, darunter
    const andere = GD.store.doc.windows.filter((w) => !inhalt.includes(w));
    const x0 = andere.length ? Math.min.apply(null, andere.map((w) => w.x)) : 0;
    const y0 = andere.length
      ? Math.max.apply(null, andere.map((w) => w.y + hoehe(w))) + RAND * 2 + KOPF
      : 0;

    let y = y0;
    for (let i = 0; i < inhalt.length; i += spalten) {
      const reihe = inhalt.slice(i, i + spalten);
      reihe.forEach((d, s) => {
        GD.windows.setGeometry(d.id, {
          x: Math.round(x0 + s * (spaltenBreite + ABSTAND)),
          y: Math.round(y)
        });
      });
      y += Math.max.apply(null, reihe.map(hoehe)) + ABSTAND;
    }

    const mass = rahmenMass(inhalt, undefined);
    const rahmen = GD.windows.add('frame', mass.x, mass.y, {
      centered: false,
      title: titel || def.label,
      size: { w: mass.w, h: mass.h },
      accent: def.tint,
      state: { bereich: def.id, tint: def.tint, strength: 0.1, dashed: false, note: '' }
    });
    GD.windows.setGeometry(rahmen.id, mass);
    GD.store.commit('Bereich „' + (titel || def.label) + '" angelegt');
    return rahmen;
  }

  /* -------------------------------------------------------------- Prüfen */

  function pruefe() {
    const punkte = [];
    const kacheln = GD.store.doc.windows.filter((d) => !istRahmen(d));
    const rahmen = GD.store.doc.windows.filter(istRahmen);

    // Regel 1
    const zuKlein = [];
    for (const d of kacheln) {
      const soll = noetigeHoehe(d);
      if (soll !== null && soll > d.h + 2) zuKlein.push({ d: d, fehlt: soll - d.h });
    }
    if (zuKlein.length) {
      punkte.push({
        regel: 1, schwere: 'warn',
        text: zuKlein.length + ' Fenster schneiden Text ab (fehlend bis ' +
              Math.round(Math.max.apply(null, zuKlein.map((z) => z.fehlt))) + ' px)',
        ids: zuKlein.map((z) => z.d.id)
      });
    }

    // Regel 2
    const paare = [];
    for (let i = 0; i < kacheln.length; i++) {
      for (let j = i + 1; j < kacheln.length; j++) {
        if (ueberlappt(kacheln[i], kacheln[j])) paare.push([kacheln[i], kacheln[j]]);
      }
    }
    if (paare.length) {
      punkte.push({
        regel: 2, schwere: 'warn',
        text: paare.length + ' Überlappung' + (paare.length === 1 ? '' : 'en') + ', z. B. „' +
              paare[0][0].title + '" über „' + paare[0][1].title + '"',
        ids: paare.map((p) => p[0].id)
      });
    }

    // Regel 3
    const schief = rahmen.filter((d) => {
      const mass = rahmenMass(inhaltVon(d.id), d.id);
      return mass && (mass.x !== d.x || mass.y !== d.y || mass.w !== d.w || mass.h !== d.h);
    });
    if (schief.length) {
      punkte.push({
        regel: 3, schwere: 'info',
        text: schief.length + ' Rahmen sitzen nicht am Inhalt: ' + schief.map((d) => '„' + d.title + '"').join(', '),
        ids: schief.map((d) => d.id)
      });
    }
    const leer = rahmen.filter((d) => !inhaltVon(d.id).length);
    if (leer.length) {
      punkte.push({
        regel: 3, schwere: 'info',
        text: leer.length + ' Rahmen sind leer: ' + leer.map((d) => '„' + d.title + '"').join(', '),
        ids: leer.map((d) => d.id)
      });
    }

    /* Regel 5 — das Kopfband bleibt frei.
       Ein Rahmen, der DIESEN Rahmen umschließt, zählt nicht: Er liegt im
       unteren Stapelband und kann nichts verdecken — ein Abschnitt enthält
       seine Gruppen, er legt sich nicht über sie. */
    const verdeckt = [];
    for (const d of rahmen) {
      const band = { x: d.x, y: d.y, w: d.w, h: kopfVon(d.id) };
      const drueber = GD.store.doc.windows.filter((w) =>
        w.id !== d.id && !umschliesst(w, d) &&
        w.x < band.x + band.w && w.x + w.w > band.x &&
        w.y < band.y + band.h && w.y + hoehe(w) > band.y);
      if (drueber.length) verdeckt.push({ d: d, wer: drueber });
    }
    if (verdeckt.length) {
      punkte.push({
        regel: 5, schwere: 'warn',
        text: verdeckt.length + ' Überschrift' + (verdeckt.length === 1 ? '' : 'en') +
              ' verdeckt: ' + verdeckt.map((v) => '„' + v.d.title + '"').join(', '),
        ids: verdeckt.map((v) => v.d.id)
      });
    }

    // Regel 4
    const ohne = rahmen.filter((d) => !bereichDesRahmens(d));
    if (ohne.length) {
      punkte.push({
        regel: 4, schwere: 'info',
        text: ohne.length + ' Rahmen haben keinen Bereich: ' + ohne.map((d) => '„' + d.title + '"').join(', '),
        ids: ohne.map((d) => d.id)
      });
    }
    // Absichtlich ungeprüft: ob die Bereiche auch räumlich in der Reihenfolge
    // der Taxonomie liegen. Eine Tafel ordnet zweidimensional — 2D neben 3D —,
    // eine Spaltenreihenfolge zu verlangen wäre nur Lärm im Bericht.

    const schlimm = punkte.filter((p) => p.schwere === 'warn').length;
    return {
      ok: punkte.length === 0,
      sauber: schlimm === 0,
      punkte: punkte,
      text: punkte.length
        ? punkte.length + ' Hinweis' + (punkte.length === 1 ? '' : 'e')
        : 'Alle fünf Regeln erfüllt'
    };
  }

  /* ------------------------------------------------------------ Regel 5 */

  /**
   * Inhalt aus dem Kopfband schieben.
   *
   * Verdeckt etwas die Überschrift eines Rahmens, wandert es nach unten —
   * nur so weit, dass es unter dem Band steht, und samt allem, was in
   * derselben Zeile liegt. Ein Rahmen im Band (ein Abschnitt in einem
   * Abschnitt) nimmt seinen eigenen Inhalt mit.
   */
  function kopfFreiRaeumen() {
    let bewegt = 0;
    const alle = GD.store.doc.windows;
    const rahmen = alle.filter(istRahmen);

    /* Zugehörigkeit VOR dem ersten Schub festhalten: Sobald etwas verrutscht,
       ragt es aus dem Kasten und inside() findet es nicht mehr. */
    const mitgliedschaft = new Map(rahmen.map((d) => [d.id, fensterVon(mitglieder(d.id))]));

    /* Von innen nach außen: erst die kleine Gruppe, dann der Abschnitt um
       sie herum. Andersherum stünde die Gruppe nach dem zweiten Schub
       wieder im Band des Abschnitts. */
    for (const d of rahmen.slice().sort((a, b) => (a.w * a.h) - (b.w * b.h))) {
      const inhalt = mitgliedschaft.get(d.id) || [];
      if (!inhalt.length) continue;
      const schub = Math.round((d.y + kopfVon(d.id)) - Math.min.apply(null, inhalt.map((w) => w.y)));
      if (schub <= 0) continue;
      /* Die ganze Gruppe rückt zusammen — einzelne Kacheln zu verschieben
         risse den Satz auseinander. Der Rahmen wächst um denselben Betrag,
         damit sein unterer Rand bleibt, wo er war. */
      for (const w of inhalt) {
        w.y = Math.round(w.y + schub);
        GD.windows.setGeometry(w.id, {});
        bewegt++;
      }
      d.h = Math.round(d.h + schub);
      GD.windows.setGeometry(d.id, {});
    }

    /*
     * Zweiter Durchgang: Was von OBEN in ein Kopfband ragt.
     *
     * Der erste schiebt nur den eigenen Inhalt tiefer. Wächst aber die
     * Nachbargruppe darüber — weil ihre Texte gemessen wurden —, reicht ihr
     * unterer Rand in das Band der nächsten. Dann wandert nicht der Inhalt,
     * sondern der ganze Rahmen nach unten. Wiederholt, weil ein Schub die
     * nächste Gruppe erwischen kann.
     */
    for (let runde = 0; runde < 8; runde++) {
      let inDieserRunde = 0;
      for (const d of rahmen.slice().sort((a, b) => a.y - b.y)) {
        const kopf = kopfVon(d.id);
        const eigene = new Set([d.id].concat((mitgliedschaft.get(d.id) || []).map((w) => w.id)));
        let schub = 0;
        for (const w of alle) {
          if (eigene.has(w.id) || umschliesst(w, d)) continue;
          if (!(w.x < d.x + d.w && w.x + w.w > d.x)) continue;
          if (!(w.y < d.y + kopf && w.y + hoehe(w) > d.y)) continue;
          schub = Math.max(schub, (w.y + hoehe(w) + ABSTAND) - d.y);
        }
        if (schub <= 0) continue;
        d.y = Math.round(d.y + schub);
        GD.windows.setGeometry(d.id, {});
        for (const w of (mitgliedschaft.get(d.id) || [])) {
          w.y = Math.round(w.y + schub);
          GD.windows.setGeometry(w.id, {});
        }
        bewegt++; inDieserRunde++;
      }
      if (!inDieserRunde) break;
    }
    return bewegt;
  }

  /** Umschließt w den Rahmen d ganz? Dann liegt es dahinter, nicht darüber. */
  function umschliesst(w, d) {
    return w.x <= d.x && w.y <= d.y &&
           w.x + w.w >= d.x + d.w && w.y + hoehe(w) >= d.y + hoehe(d);
  }

  /**
   * Rahmen, die sich überlappen, untereinanderlegen — als Block.
   *
   * `entwirre()` sieht nur einzelne Kacheln und würde eine Gruppe, die von
   * oben gedrückt wird, Kachel für Kachel auseinanderziehen. Hier wandert
   * die Gruppe als Ganzes: Ihr innerer Satz bleibt, wie er ist.
   * Verschachtelte Rahmen bleiben unberührt — sie sollen sich überlappen.
   */
  function bloeckeFliessen(luecke) {
    const abstand = luecke === undefined ? ABSTAND * 6 : luecke;
    const alle = GD.store.doc.windows;
    const rahmen = alle.filter(istRahmen);
    const mitgliedschaft = new Map(rahmen.map((d) => [d.id, fensterVon(mitglieder(d.id))]));

    // Nur Rahmen betrachten, die in keinem anderen Rahmen liegen
    const inEinemAnderen = new Set();
    for (const d of rahmen) {
      for (const w of mitgliedschaft.get(d.id)) if (istRahmen(w)) inEinemAnderen.add(w.id);
    }
    const bloecke = rahmen.filter((d) => !inEinemAnderen.has(d.id)).sort((a, b) => (a.y - b.y) || (a.x - b.x));

    /* Nur ausweichen, wo sich wirklich etwas überschneidet. Eine Tafel ordnet
       zweidimensional — zwei Gruppen NEBENEINANDER sind gewollt und werden
       nicht in eine Spalte gezwungen. */
    function schiebe(d, schub) {
      d.y = Math.round(d.y + schub);
      GD.windows.setGeometry(d.id, {});
      for (const w of mitgliedschaft.get(d.id)) {
        w.y = Math.round(w.y + schub);
        GD.windows.setGeometry(w.id, {});
      }
    }

    let bewegt = 0;
    const gesetzt = [];
    for (const d of bloecke) {
      const y0 = d.y;
      let runden = 0, nochmal = true;
      while (nochmal && runden++ < MAX_RUNDEN) {
        nochmal = false;
        for (const o of gesetzt) {
          if (!ueberlappt(d, o)) continue;
          schiebe(d, (o.y + hoehe(o) + abstand) - d.y);
          nochmal = true;
        }
      }
      if (d.y !== y0) bewegt++;
      gesetzt.push(d);
    }
    return bewegt;
  }

  /* ------------------------------------------------------------ Alles */

  /*
   * Reihenfolge ist hier alles:
   *   Höhen → Köpfe freiräumen → entwirren → Rahmen nachziehen.
   * Das Freiräumen schiebt ganze Gruppen nach unten und erzeugt dabei
   * absichtlich Überlappungen; entwirre() löst sie danach auf, und erst
   * ganz zum Schluss legen sich die Rahmen um das Ergebnis.
   */
  function aufraeumen(ids) {
    const gemerkt = zuordnungMerken();
    const hoehen = passeHoehenAn(ids);
    const koepfe = kopfFreiRaeumen();
    const bewegt = entwirre(ids);
    rahmenNachziehen(gemerkt);
    const bloecke = bloeckeFliessen();
    const rahmen = rahmenNachziehen(gemerkt);
    GD.connections.redraw();
    if (hoehen || bewegt || rahmen || koepfe || bloecke) GD.store.commit('Angeordnet');
    return { hoehen: hoehen, bewegt: bewegt, rahmen: rahmen, koepfe: koepfe, bloecke: bloecke };
  }

  GD.layout = {
    BEREICHE: BEREICHE,
    ABSTAND: ABSTAND,

    textHoehe: textHoehe,
    passeHoehenAn: passeHoehenAn,
    entwirre: entwirre,
    rahmenNachziehen: rahmenNachziehen,
    rahmenAnpassen: rahmenAnpassen,
    pruefe: pruefe,
    aufraeumen: aufraeumen,
    kopfFreiRaeumen: kopfFreiRaeumen,
    bloeckeFliessen: bloeckeFliessen,
    kopfVon: kopfVon,
    bereich: bereich,

    bereichVon: bereichVon,
    merkeBereich: merkeBereich,
    bereichDesRahmens: bereichDesRahmens
  };
})();
