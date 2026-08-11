/* GameDesk — Medienlager („Depot")
 *
 * Bilder, Ton und Video sind Bytes, keine Zeichen. Sie standen trotzdem als
 * data:-URL mitten im Dokument — und landeten damit bei jedem Autospeichern
 * im localStorage, der pro Herkunft rund 5 MB fasst. Ein einziges Foto
 * sprengte ihn, und danach ließ sich gar nichts mehr sichern
 * („Autospeichern fehlgeschlagen (Speicher voll?)"). Schlimmer noch: der
 * Verlaufsstapel hält bis zu 60 Abzüge des Dokuments als Text im Speicher —
 * mit eingebetteten Medien sind das schnell Gigabyte.
 *
 * Hier liegen die Bytes stattdessen in einer eigenen IndexedDB (Platz:
 * Größenordnung Gigabyte statt Megabyte). Im Dokument steht nur noch ein
 * kurzer Verweis:
 *
 *     depot:<id>
 *
 * Die id ist der Inhalt selbst (SHA-256 der Bytes). Dasselbe Bild zweimal
 * eingefügt belegt darum nur einmal Platz, und eine Tafel, die schon einmal
 * gespeichert wurde, findet ihre Medien nach dem Neuladen wieder.
 *
 * Drei Übersetzungen halten das zusammen:
 *
 *   aufloesen(v)   depot:<id> -> blob:-URL     (zum Anzeigen, sofort)
 *   einlesen(doc)  data:…     -> depot:<id>    (beim Öffnen fremder Tafeln)
 *   aufblasen(doc) depot:<id> -> data:…        (beim Schreiben in die Datei)
 *
 * Die Dateien auf der Platte bleiben dadurch weiterhin in sich geschlossen:
 * eine .gamedesk.json trägt ihre Medien mit sich, man kann sie verschicken.
 * Nur der Browser-Zwischenstand ist schlank.
 */
(function () {
  'use strict';
  const GD = (window.GD = window.GD || {});

  const DB_NAME = 'gamedesk-medien';        // eigene Datenbank: library.js hält
  const DB_STORE = 'blobs';                 // 'gamedesk' auf Version 1 offen
  const PRAEFIX = 'depot:';
  /* Kurze data:-URLs bleiben, wo sie sind — ein 20 Zeilen langes SVG-Symbol
     im Depot zu führen kostet mehr, als es spart. */
  const MIN_LAENGE = 4096;
  /* Obergrenze pro Datei. Das Depot selbst könnte mehr, aber beim Sichern
     wird alles als data:-URL in die .gamedesk.json geschrieben — und ein
     Dokument, das der Server oder der Browser nicht mehr am Stück verarbeitet,
     hilft niemandem. 64 MB reichen für Musik und lange Videoausschnitte. */
  const MAX_BYTES = 64 * 1024 * 1024;

  const urls = new Map();                   // id -> blob:-URL (Sitzung)
  const infos = new Map();                  // id -> { name, typ, groesse }
  const laufend = new Map();                // id -> Promise (kein Doppelladen)
  const events = GD.util ? GD.util.emitter() : null;

  let dbP = null;

  function db() {
    if (dbP) return dbP;
    dbP = new Promise((ok, fehler) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fehler(req.error);
    }).catch((e) => { dbP = null; throw e; });
    return dbP;
  }

  function tx(modus, fn) {
    return db().then((d) => new Promise((ok, fehler) => {
      const t = d.transaction(DB_STORE, modus);
      let ergebnis;
      const r = fn(t.objectStore(DB_STORE));
      if (r && 'onsuccess' in r) r.onsuccess = () => { ergebnis = r.result; };
      t.oncomplete = () => ok(ergebnis);
      t.onerror = () => fehler(t.error);
      t.onabort = () => fehler(t.error || new Error('abgebrochen'));
    }));
  }

  /* --------------------------------------------------------- Kennung */

  /**
   * Inhaltskennung. Über http(s)://localhost gibt es crypto.subtle; unter
   * file:// nicht — dort tut es eine einfache Streuung. Sie muss nicht
   * kryptografisch sein, nur zwei verschiedene Dateien auseinanderhalten.
   */
  async function kennung(puffer) {
    try {
      if (crypto && crypto.subtle && crypto.subtle.digest) {
        const h = await crypto.subtle.digest('SHA-256', puffer);
        return Array.from(new Uint8Array(h, 0, 16)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* Notweg unten */ }
    const b = new Uint8Array(puffer);
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < b.length; i++) {
      h1 = ((h1 ^ b[i]) * 0x01000193) >>> 0;
      h2 = ((h2 + b[i]) * 0x85ebca6b + i) >>> 0;
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + b.length.toString(16);
  }

  /* ----------------------------------------------------------- Ablage */

  function istVerweis(v) { return typeof v === 'string' && v.startsWith(PRAEFIX); }
  function idVon(v) { return istVerweis(v) ? v.slice(PRAEFIX.length) : null; }

  function merke(id, blob, name) {
    if (!urls.has(id)) urls.set(id, URL.createObjectURL(blob));
    infos.set(id, { name: name || '', typ: blob.type || '', groesse: blob.size });
    return urls.get(id);
  }

  /** Bytes ins Depot legen; liefert den Verweis `depot:<id>`. */
  async function einlagern(blob, name) {
    const puffer = await blob.arrayBuffer();
    const id = await kennung(puffer);
    const rein = new Blob([puffer], { type: blob.type || 'application/octet-stream' });
    const vorhanden = await tx('readonly', (s) => s.count(id));
    if (!vorhanden) {
      await tx('readwrite', (s) => s.put({
        id: id, blob: rein, typ: rein.type, name: name || '', groesse: rein.size, angelegt: Date.now()
      }));
    }
    merke(id, rein, name);
    return PRAEFIX + id;
  }

  async function satz(id) {
    return await tx('readonly', (s) => s.get(id));
  }

  /** Blob nachladen und als blob:-URL bereitstellen. */
  function nachladen(id) {
    if (urls.has(id)) return Promise.resolve(urls.get(id));
    if (laufend.has(id)) return laufend.get(id);
    const p = satz(id).then((r) => {
      laufend.delete(id);
      if (!r || !r.blob) return null;
      const u = merke(id, r.blob, r.name);
      if (events) events.emit('bereit', id);
      return u;
    }).catch((e) => {
      laufend.delete(id);
      console.warn('[GD] Depot: ' + id + ' nicht lesbar:', e);
      return null;
    });
    laufend.set(id, p);
    return p;
  }

  /* -------------------------------------------------------- Wanderung */

  /** Alle Zeichenketten im Baum besuchen; Rückgabe ersetzt den Wert. */
  function wandern(wert, fn) {
    if (typeof wert === 'string') return fn(wert);
    if (Array.isArray(wert)) {
      for (let i = 0; i < wert.length; i++) wert[i] = wandern(wert[i], fn);
      return wert;
    }
    if (wert && typeof wert === 'object') {
      for (const k of Object.keys(wert)) wert[k] = wandern(wert[k], fn);
      return wert;
    }
    return wert;
  }

  function verweiseSammeln(doc) {
    const out = new Set();
    wandern(doc, (s) => { if (istVerweis(s)) out.add(idVon(s)); return s; });
    return out;
  }

  /* ------------------------------------------------------------- API */

  const depot = {
    events: events,
    PRAEFIX: PRAEFIX,
    MAX_BYTES: MAX_BYTES,
    istVerweis: istVerweis,
    aus: false,                             // true: kein IndexedDB, Notbetrieb

    /**
     * Beim Start: alles, was noch als data:-URL im Dokument steckt, ins Depot
     * holen, die Verweise des Dokuments bereitstellen und verwaiste Bytes
     * wegräumen. Erst danach baut app.js die Fenster — dann stehen die Bilder
     * sofort da statt kurz zu blinken.
     */
    async init(doc) {
      try {
        await db();
      } catch (e) {
        console.warn('[GD] Depot nicht verfügbar (Medien bleiben eingebettet):', e);
        depot.aus = true;
        return false;
      }
      try {
        const gewandert = await depot.einlesen(doc);
        await depot.vorladen(doc);
        await depot.aufraeumen(doc);
        return gewandert;
      } catch (e) {
        console.warn('[GD] Depot-Start:', e);
        return false;
      }
    },

    einlagern: einlagern,

    /**
     * Datei ins Depot; liefert den Wert, der ins Dokument gehört.
     *
     * Steht kein IndexedDB zur Verfügung (privater Modus, alte Einstellung),
     * bleibt es beim alten Weg: data:-URL im Dokument. Dann ist der
     * Browser-Speicher wieder eng — aber die Datei ist wenigstens da.
     */
    async ausDatei(file) {
      if (!depot.aus) {
        try { return await einlagern(file, file.name || ''); }
        catch (e) { console.warn('[GD] Depot: Ablage fehlgeschlagen, bette ein:', e); }
      }
      return await new Promise((ok, fehler) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.onerror = () => fehler(fr.error);
        fr.readAsDataURL(file);
      });
    },

    /**
     * Verweis zu einer anzeigbaren Adresse machen.
     *
     *   kein Verweis  -> unverändert zurück (http, data, blob …)
     *   Verweis, da   -> blob:-URL
     *   Verweis, noch nicht geladen -> null, und wenn er da ist, kommt
     *                    das Ereignis 'bereit'.
     */
    aufloesen(v) {
      const id = idVon(v);
      if (id === null) return v;
      const u = urls.get(id);
      if (u) return u;
      nachladen(id);
      return null;
    },

    /** Wie aufloesen, nur wartend. */
    async aufloesenAsync(v) {
      const id = idVon(v);
      if (id === null) return v;
      return await nachladen(id);
    },

    /** { name, typ, groesse } zu einem Verweis — oder null. */
    info(v) {
      const id = idVon(v);
      return id === null ? null : (infos.get(id) || null);
    },

    /** Blob zu einem Verweis (oder zu einer Adresse: dann geholt). */
    async blob(v) {
      const id = idVon(v);
      if (id !== null) {
        const r = await satz(id);
        return r ? r.blob : null;
      }
      if (typeof v !== 'string' || !v) return null;
      const res = await fetch(v);
      return res.ok ? await res.blob() : null;
    },

    async alsDataURL(v) {
      const b = await depot.blob(v);
      if (!b) return null;
      return await new Promise((ok, fehler) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.onerror = () => fehler(fr.error);
        fr.readAsDataURL(b);
      });
    },

    /**
     * data:-URLen im Dokument durch Depot-Verweise ersetzen (an Ort und
     * Stelle). Liefert true, wenn etwas gewandert ist.
     */
    async einlesen(doc) {
      if (depot.aus || !doc) return false;
      const treffer = [];
      wandern(doc, (s) => {
        if (s.startsWith('data:') && s.length >= MIN_LAENGE) treffer.push(s);
        return s;
      });
      if (!treffer.length) return false;

      const karte = new Map();
      for (const s of Array.from(new Set(treffer))) {
        try {
          const res = await fetch(s);
          const b = await res.blob();
          karte.set(s, await einlagern(b, ''));
        } catch (e) {
          console.warn('[GD] Depot: eingebettetes Medium nicht lesbar:', e);
        }
      }
      wandern(doc, (s) => karte.get(s) || s);
      return karte.size > 0;
    },

    /**
     * Abzug des Dokuments, in dem die Verweise wieder als data:-URL stehen —
     * für Datei, Export und Bibliothek. Das Original bleibt schlank.
     */
    async aufblasen(doc) {
      if (depot.aus || !doc) return doc;
      const ids = verweiseSammeln(doc);
      if (!ids.size) return doc;
      const karte = new Map();
      for (const id of ids) {
        const d = await depot.alsDataURL(PRAEFIX + id);
        if (d) karte.set(PRAEFIX + id, d);
      }
      if (!karte.size) return doc;
      /* Abzug, nicht das Original: Ein Aufruf mit GD.store.doc dürfte die
         laufende Tafel nicht wieder mit Bytes vollschreiben. */
      return wandern(JSON.parse(JSON.stringify(doc)), (s) => karte.get(s) || s);
    },

    /** Alle Verweise eines Dokuments als blob:-URL bereitlegen. */
    async vorladen(doc) {
      if (depot.aus || !doc) return;
      await Promise.all(Array.from(verweiseSammeln(doc)).map((id) => nachladen(id)));
    },

    /**
     * Bytes wegräumen, auf die das Dokument nicht mehr zeigt.
     *
     * Nur beim Start, nie zwischendurch: Rückgängig kann ein gelöschtes Bild
     * jederzeit zurückholen, und eine Tafel, die gerade nicht offen ist, hat
     * ihre Medien in ihrer eigenen Datei stehen (siehe aufblasen).
     */
    async aufraeumen(doc) {
      if (depot.aus) return 0;
      const behalten = verweiseSammeln(doc);
      let alle;
      try { alle = await tx('readonly', (s) => s.getAllKeys()); }
      catch (e) { return 0; }
      const weg = (alle || []).filter((id) => !behalten.has(id));
      if (!weg.length) return 0;
      try {
        await tx('readwrite', (s) => { for (const id of weg) s.delete(id); });
      } catch (e) { return 0; }
      for (const id of weg) {
        if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
        infos.delete(id);
      }
      return weg.length;
    },

    /** Belegter Platz im Depot (für die Einstellungen). */
    async bestand() {
      try {
        const alle = await tx('readonly', (s) => s.getAll());
        return {
          anzahl: alle.length,
          bytes: alle.reduce((n, r) => n + (r.groesse || 0), 0)
        };
      } catch (e) { return { anzahl: 0, bytes: 0 }; }
    }
  };

  GD.depot = depot;
})();
