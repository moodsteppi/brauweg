/* GameDesk — Schnittstelle: der Einstieg für alles, was von außen bedient
 *
 * Menschen bedienen GameDesk mit der Maus. Automaten und Sitzungen mit einem
 * Sprachmodell bedienen es über die Konsole — und stehen dabei vor fünfzehn
 * Dateien, aus denen sie sich zusammensuchen müssen, wie eine Kachel
 * entsteht, wie man prüft, ob sie da ist, und wie man sichert.
 *
 * Diese Datei ist die Antwort darauf. Sie erfindet nichts Neues, sondern
 * legt drei Dinge über das Vorhandene:
 *
 *   GD.hilfe()    — was es gibt, in Kurzform ins Protokoll
 *   GD.zustand()  — ein kompakter, JSON-fähiger Abzug der Tafel
 *   GD.pruefe()   — Layoutregeln und die häufigen Selbstverletzungen
 *
 * Der Unterschied zu einer Dokumentation: Diese drei antworten über den
 * ECHTEN Stand. Eine Datei kann veralten, `GD.zustand()` nicht.
 */
(function () {
  'use strict';
  const GD = window.GD;

  /* Jede Zeile: Aufruf, was er tut. Bewusst kurz — wer mehr braucht, findet
     es in README.md; wer nur wissen will, wie die Kachel heißt, ist hier
     nach zwei Sekunden fertig. */
  const ZEILEN = [
    ['— Tafel ansehen —'],
    ['GD.zustand()', 'Kompakter Abzug: Ansicht, Zahlen, Kacheln, Pfeile'],
    ['GD.zustand({kacheln:true})', 'zusätzlich jede Kachel mit Lage und Titel'],
    ['GD.hilfe("notes")', 'Was ein Modul kann und wie sein state aussieht'],
    ['GD.pruefe()', 'Layoutregeln prüfen (Überlappung, Rahmenkopf, NaN)'],
    ['GD.store.doc', 'Das Dokument selbst — Lesen jederzeit, Schreiben mit Bedacht'],

    ['— Kacheln —'],
    ['GD.windows.add(typ, x, y, opts)', 'Neu; typ aus GD.modules.list(); opts: {title,size,state}'],
    ['GD.windows.setGeometry(id, {x,y,w,h})', 'Lage/Größe setzen'],
    ['GD.windows.setTitle(id, text)', 'Umbenennen'],
    ['GD.windows.select([ids])', 'Auswählen ([] hebt auf)'],
    ['GD.windows.remove(id)', 'Löschen (nimmt die Pfeile mit)'],
    ['GD.store.getWindow(id)', 'Datensatz einer Kachel'],

    ['— Pfeile —'],
    ['GD.connections.add(vonId, seite, zuId, seite)', 'Seite: t r b l oder auto'],
    ['GD.connections.update(id, {label,color,...})', 'Ändern'],
    ['GD.connections.remove(id)', 'Löschen'],

    ['— Anordnen —'],
    ['GD.layout.aufraeumen()', 'Der ganze Durchlauf — nie von Hand nachbauen'],
    ['GD.layout.passeHoehenAn()', 'Höhen an den Text (nur notes/code)'],
    ['GD.layout.rahmenNachziehen()', 'Rahmen um ihren Inhalt legen'],
    ['GD.board.setView(x, y, scale)', 'Kamera — DREI ZAHLEN, kein Objekt'],
    ['GD.board.zoomToFit()', 'Alles einpassen'],

    ['— Sichern und Verlauf —'],
    ['GD.store.commit(text)', 'Schritt in die Rückgängig-Kette legen'],
    ['GD.store.undo() / redo()', 'Zurück / vor'],
    ['GD.library.sichern("x.gamedesk.json")', 'In den Bibliotheksordner schreiben'],
    ['GD.aenderungen.festschreiben({titel})', 'Commit in der Änderungsverfolgung']
  ];

  /**
   * Kompakter Abzug der Tafel.
   *
   * Absichtlich klein: Wer von außen etwas verändert hat, will danach in
   * einem Blick sehen, ob es angekommen ist — nicht drei Megabyte JSON
   * lesen. Kacheln kommen deshalb nur auf Wunsch, und dann ohne ihren
   * Zustand (der ist bei einem 3D-Modell größer als der Rest zusammen).
   */
  function zustand(opt) {
    const o = opt || {};
    const doc = GD.store.doc;
    const v = doc.view;
    const nachTyp = {};
    let kaputt = 0;
    for (const w of doc.windows) {
      nachTyp[w.type] = (nachTyp[w.type] || 0) + 1;
      if (![w.x, w.y, w.w, w.h].every((n) => Number.isFinite(n))) kaputt++;
    }
    const b = GD.board.contentBounds();
    const out = {
      name: doc.name,
      datei: (GD.library && GD.library.link()) ? GD.library.link().datei : null,
      ansicht: { x: Math.round(v.x), y: Math.round(v.y), zoom: +v.scale.toFixed(3) },
      inhalt: b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) } : null,
      kacheln: doc.windows.length,
      nachTyp: nachTyp,
      pfeile: doc.connections.length,
      buendel: (doc.bundles || []).length,
      auswahl: GD.windows.selectionIds(),
      raster: { mass: doc.grid.size, einrasten: doc.grid.snap !== false },
      offeneAenderungen: GD.aenderungen ? GD.aenderungen.stand().punkte.length : null
    };
    if (kaputt) out.WARNUNG = kaputt + ' Kachel(n) mit ungültiger Geometrie — GD.pruefe() zeigt welche';
    if (o.kacheln) {
      out.liste = doc.windows.map((w) => ({
        id: w.id, typ: w.type, titel: w.title,
        x: w.x, y: w.y, w: w.w, h: w.h,
        eingeklappt: !!w.collapsed
      }));
    }
    if (o.pfeile) {
      out.pfeilListe = doc.connections.map((c) => ({
        id: c.id, von: c.from.win, nach: c.to.win, label: c.label || '', buendel: c.bundle || null
      }));
    }
    return out;
  }

  /**
   * Prüfen — die Layoutregeln plus das, was nur von außen kaputtgeht.
   *
   * GD.layout.pruefe() kennt Überlappungen und Rahmenköpfe. Was es nicht
   * kennt, sind Schäden aus fehlerhaften Skriptläufen: NaN in der Geometrie,
   * Pfeile ins Leere, doppelte Kennungen. Genau die findet man von Hand
   * erst, wenn die Tafel schon gespeichert ist.
   */
  function pruefe() {
    const doc = GD.store.doc;
    const funde = [];
    const ids = new Set();
    for (const w of doc.windows) {
      if (ids.has(w.id)) funde.push({ art: 'doppelte-kennung', id: w.id, titel: w.title });
      ids.add(w.id);
      for (const k of ['x', 'y', 'w', 'h']) {
        if (!Number.isFinite(w[k])) funde.push({ art: 'geometrie', id: w.id, titel: w.title, feld: k, wert: w[k] });
      }
    }
    for (const c of doc.connections) {
      if (!ids.has(c.from.win)) funde.push({ art: 'pfeil-ins-leere', id: c.id, fehlt: c.from.win });
      if (!ids.has(c.to.win)) funde.push({ art: 'pfeil-ins-leere', id: c.id, fehlt: c.to.win });
    }
    for (const k of ['x', 'y', 'scale']) {
      if (!Number.isFinite(doc.view[k])) funde.push({ art: 'ansicht', feld: k, wert: doc.view[k] });
    }
    /* GD.layout.pruefe() liefert { ok, sauber, punkte, text } — das wird
       nicht umgeformt, sondern durchgereicht: Wer beides vergleicht, soll
       dieselben Felder sehen wie im Änderungsfenster. */
    const layout = GD.layout && GD.layout.pruefe ? GD.layout.pruefe() : null;
    return {
      sauber: funde.length === 0 && (!layout || layout.sauber),
      funde: funde,
      layout: layout ? { sauber: layout.sauber, text: layout.text, punkte: layout.punkte } : null
    };
  }

  /**
   * Auskunft über ein Modul — inklusive der Form seines `state`.
   *
   * Das war die größte Lücke: `GD.windows.add('notes', 0, 0, {state: …})`
   * steht überall, aber was in `state` gehört, weiß nur die Moduldatei. Eine
   * abgeschriebene Liste hier veraltete beim ersten Umbau. Deshalb wird die
   * Form nicht behauptet, sondern von einer echten Kachel dieses Typs auf
   * der Tafel abgelesen — und wenn keine da ist, von einer, die kurz
   * angelegt und sofort wieder zurückgenommen wird.
   */
  function modul(typ) {
    const def = GD.modules.get(typ);
    if (!def) {
      return { fehler: 'Unbekanntes Modul: ' + typ, bekannt: GD.modules.list().map((d) => d.id) };
    }
    const out = {
      id: def.id, label: def.label, zeichen: def.icon,
      beschreibung: def.description || '',
      standardGroesse: def.defaultSize,
      standardTitel: def.defaultTitle || def.label,
      farbe: def.accent
    };
    const vorhanden = GD.store.doc.windows.find((w) => w.type === typ && w.state);
    if (vorhanden) {
      out.stateVon = vorhanden.title;
      out.state = kuerze(vorhanden.state);
    } else {
      /* Keine Kachel dieses Typs auf der Tafel: eine anlegen, den frischen
         Zustand ablesen, sie wieder entfernen — und den Verlauf so
         zurückdrehen, dass davon nichts stehen bleibt. */
      try {
        const d = GD.windows.add(typ, 0, 0);
        const rec = GD.windows.get(d.id);
        out.state = kuerze(rec && rec.inst && rec.inst.getState ? rec.inst.getState() : null);
        out.stateVon = '(frisch angelegt und wieder entfernt)';
        GD.windows.remove(d.id);
        GD.store.undo(); GD.store.undo();
      } catch (err) {
        out.state = null;
        out.hinweis = 'Zustand nicht ermittelbar: ' + err.message;
      }
    }
    return out;
  }

  /**
   * Große Zweige eindampfen. Ein 3D-Modell oder ein Wireframe bringt
   * hunderte Einträge mit; wer die Form sucht, will den ersten sehen und
   * wissen, dass es mehr sind — nicht alle.
   */
  function kuerze(v, tiefe) {
    const t = tiefe || 0;
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) {
      if (!v.length) return [];
      return v.length > 2 ? [kuerze(v[0], t + 1), '… ' + (v.length - 1) + ' weitere'] : v.map((x) => kuerze(x, t + 1));
    }
    if (t >= 3) return '{…}';
    const out = {};
    for (const k of Object.keys(v)) {
      const s = typeof v[k] === 'string';
      out[k] = s && v[k].length > 120 ? v[k].slice(0, 117) + '…' : kuerze(v[k], t + 1);
    }
    return out;
  }

  function hilfe(typ) {
    if (typ) {
      const m = modul(typ);
      console.log(JSON.stringify(m, null, 2));
      return m;
    }
    const zeilen = [];
    for (const z of ZEILEN) {
      if (z.length === 1) { zeilen.push('', z[0]); continue; }
      zeilen.push('  ' + z[0].padEnd(42) + z[1]);
    }
    const text = 'GameDesk — Schnittstelle' + zeilen.join('\n') +
      '\n\nModule: ' + GD.modules.list().map((d) => d.id).join(', ') +
      '\n        GD.hilfe("notes") zeigt Größe, Farbe und die Form von state' +
      '\nStand:  ' + GD.store.doc.windows.length + ' Kacheln, ' +
      GD.store.doc.connections.length + ' Pfeile';
    console.log(text);
    return text;
  }

  GD.hilfe = hilfe;
  GD.zustand = zustand;
  GD.pruefe = pruefe;
  GD.modul = modul;
})();
