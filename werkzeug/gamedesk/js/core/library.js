/* GameDesk — Projekt-Bibliothek
 *
 * Bildet einen Ordner auf der Platte als Projektliste ab: welche Tafeln es
 * gibt, wann sie zuletzt geändert wurden, was darin steckt — und öffnet,
 * speichert, benennt um und löscht sie.
 *
 * Zwei Wege dorthin, je nachdem wie GameDesk läuft:
 *
 *   server  Der mitgelieferte Node-Server (tools/serve.mjs) verwaltet den
 *           Ordner. Der Pfad wird einmal gesetzt und bleibt über Sitzungen
 *           hinweg stehen — ohne jede Nachfrage.
 *   ordner  File System Access API des Browsers. Ein echter Ordnerdialog,
 *           der Ordner darf überall liegen. Der Griff wird in IndexedDB
 *           gemerkt; nach einem Neustart des Browsers fragt Chrome einmal
 *           nach der Erlaubnis.
 *
 * Beim Aufruf über file:// steht keiner von beiden zur Verfügung — dann
 * bleibt der Weg über „Öffnen…" und „Als Datei sichern".
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const DB_NAME = 'gamedesk';
  const DB_STORE = 'griffe';
  const MAX_TIEFE = 2;

  let modus = 'keiner';           // 'server' | 'ordner' | 'keiner'
  let verfuegbar = { server: false, ordner: false };
  let griff = null;               // FileSystemDirectoryHandle
  let griffName = '';
  let serverOrdner = '';
  let serverSchreibbar = false;
  let zwischenspeicher = null;    // letzte Liste
  let laufendeListe = null;
  const stapel = [];              // Weg durch ineinanderliegende Projekte

  /* ------------------------------------------------------- IndexedDB */

  function db() {
    return new Promise((ok, fehler) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fehler(req.error);
    });
  }

  async function griffSpeichern(h) {
    try {
      const d = await db();
      await new Promise((ok, fehler) => {
        const t = d.transaction(DB_STORE, 'readwrite');
        t.objectStore(DB_STORE).put(h, 'bibliothek');
        t.oncomplete = ok; t.onerror = () => fehler(t.error);
      });
      d.close();
    } catch (e) { console.warn('[GD] Ordnergriff nicht gemerkt:', e); }
  }

  async function griffHolen() {
    try {
      const d = await db();
      const h = await new Promise((ok, fehler) => {
        const t = d.transaction(DB_STORE, 'readonly');
        const r = t.objectStore(DB_STORE).get('bibliothek');
        r.onsuccess = () => ok(r.result || null);
        r.onerror = () => fehler(r.error);
      });
      d.close();
      return h;
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------------- Server */

  async function serverFrage(pfad, opt) {
    const res = await fetch(pfad, opt);
    const text = await res.text();
    let daten = null;
    try { daten = text ? JSON.parse(text) : null; } catch (e) { /* Rohtext */ }
    if (!res.ok) throw new Error((daten && daten.fehler) || ('HTTP ' + res.status));
    return daten === null ? text : daten;
  }

  async function serverPruefen() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const s = await serverFrage('api/bibliothek');
      serverOrdner = s.ordner || '';
      serverSchreibbar = !!s.schreibbar;
      return true;
    } catch (e) { return false; }
  }

  /* -------------------------------------------------- Ordner (Browser) */

  async function ordnerErlaubnis(frage) {
    if (!griff) return 'keiner';
    const opt = { mode: 'readwrite' };
    let z = await griff.queryPermission(opt);
    if (z !== 'granted' && frage) z = await griff.requestPermission(opt);
    return z;
  }

  async function ordnerListe() {
    const out = [];
    async function lauf(dir, rel, tiefe) {
      for await (const [name, h] of dir.entries()) {
        if (name.startsWith('.') || name === 'node_modules') continue;
        const r = rel ? rel + '/' + name : name;
        if (h.kind === 'directory') {
          if (tiefe < MAX_TIEFE) await lauf(h, r, tiefe + 1);
          continue;
        }
        if (!/\.json$/i.test(name)) continue;
        try {
          const f = await h.getFile();
          if (f.size > 64 * 1024 * 1024) continue;
          const doc = JSON.parse(await f.text());
          if (!doc || doc.format !== 'gamedesk-board') continue;
          const module = {};
          for (const w of doc.windows || []) module[w.type] = (module[w.type] || 0) + 1;
          out.push({
            datei: r,
            name: typeof doc.name === 'string' ? doc.name : name.replace(/\.gamedesk\.json$|\.json$/i, ''),
            groesse: f.size, geaendert: f.lastModified,
            fenster: (doc.windows || []).length,
            pfeile: (doc.connections || []).length,
            modelle: (doc.models || []).length,
            module: module
          });
        } catch (e) { /* keine Tafel */ }
      }
    }
    await lauf(griff, '', 0);
    out.sort((a, b) => b.geaendert - a.geaendert);
    return out;
  }

  /** Verzeichnisgriff für einen Namen mit Unterordnern auflösen */
  async function ordnerZiel(datei, anlegen) {
    const teile = datei.split('/');
    const name = teile.pop();
    let dir = griff;
    for (const t of teile) dir = await dir.getDirectoryHandle(t, { create: !!anlegen });
    return { dir: dir, name: name };
  }

  /* ------------------------------------------------------------- API */

  const library = {
    events: U.emitter(),

    async init() {
      verfuegbar.ordner = typeof window.showDirectoryPicker === 'function' && window.isSecureContext;
      verfuegbar.server = await serverPruefen();

      const gewuenscht = GD.store.prefs.bibliothek;
      if (verfuegbar.ordner) {
        const h = await griffHolen();
        if (h) {
          griff = h;
          griffName = h.name;
          if ((await ordnerErlaubnis(false)) !== 'granted') griff = h;   // erst auf Klick nachfragen
        }
      }

      if (gewuenscht === 'ordner' && verfuegbar.ordner && griff) modus = 'ordner';
      else if (verfuegbar.server) modus = 'server';
      else if (verfuegbar.ordner && griff) modus = 'ordner';
      else modus = 'keiner';

      library.events.emit('changed');
      return library.status();
    },

    status() {
      return {
        modus: modus,
        verfuegbar: Object.assign({}, verfuegbar),
        ordner: modus === 'server' ? serverOrdner : griffName,
        schreibbar: modus === 'server' ? serverSchreibbar : !!griff,
        bereit: modus !== 'keiner' && (modus === 'server' ? !!serverOrdner : !!griff),
        verknuepft: library.link()
      };
    },

    async setModus(m) {
      if (m === modus) return library.status();
      if (m === 'server' && !verfuegbar.server) throw new Error('Kein GameDesk-Server erreichbar. Starte GameDesk über „GameDesk starten.bat".');
      if (m === 'ordner' && !verfuegbar.ordner) throw new Error('Dieser Browser bietet keinen Ordnerzugriff (nötig: Chrome oder Edge über http/https).');
      modus = m;
      GD.store.prefs.bibliothek = m;
      GD.store.savePrefs();
      zwischenspeicher = null;
      library.events.emit('changed');
      return library.status();
    },

    /** Ordnerdialog des Browsers — braucht einen Klick als Auslöser */
    async ordnerWaehlen() {
      if (!verfuegbar.ordner) throw new Error('Dieser Browser bietet keinen Ordnerdialog.');
      const h = await window.showDirectoryPicker({ id: 'gamedesk-bibliothek', mode: 'readwrite' });
      griff = h;
      griffName = h.name;
      await griffSpeichern(h);
      modus = 'ordner';
      GD.store.prefs.bibliothek = 'ordner';
      GD.store.savePrefs();
      zwischenspeicher = null;
      library.events.emit('changed');
      return library.status();
    },

    /** Erlaubnis für den gemerkten Ordner erneut einholen */
    async ordnerFreigeben() {
      const z = await ordnerErlaubnis(true);
      if (z !== 'granted') throw new Error('Zugriff auf den Ordner wurde nicht erlaubt.');
      zwischenspeicher = null;
      library.events.emit('changed');
      return library.status();
    },

    async serverOrdnerSetzen(pfad, anlegen) {
      if (!verfuegbar.server) throw new Error('Kein GameDesk-Server erreichbar.');
      const s = await serverFrage('api/bibliothek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordner: pfad, anlegen: !!anlegen })
      });
      serverOrdner = s.ordner;
      serverSchreibbar = !!s.schreibbar;
      modus = 'server';
      GD.store.prefs.bibliothek = 'server';
      GD.store.savePrefs();
      zwischenspeicher = null;
      library.events.emit('changed');
      return library.status();
    },

    /* ------------------------------------------------------ Projekte */

    async liste(neu) {
      if (!neu && zwischenspeicher) return zwischenspeicher;
      if (laufendeListe) return laufendeListe;
      laufendeListe = (async () => {
        try {
          if (modus === 'server') {
            const s = await serverFrage('api/bibliothek/liste');
            serverOrdner = s.ordner; serverSchreibbar = !!s.schreibbar;
            zwischenspeicher = s.projekte || [];
          } else if (modus === 'ordner' && griff) {
            if ((await ordnerErlaubnis(false)) !== 'granted') {
              const fehler = new Error('erlaubnis');
              fehler.code = 'erlaubnis';
              throw fehler;
            }
            zwischenspeicher = await ordnerListe();
          } else {
            zwischenspeicher = [];
          }
          return zwischenspeicher;
        } finally { laufendeListe = null; }
      })();
      return laufendeListe;
    },

    /* Gelesen wird eine in sich geschlossene Datei: Medien stehen darin als
       data:-URL. Sie wandern gleich beim Lesen ins Depot, damit sie nicht in
       den Browser-Speicher gelangen (js/core/depot.js). */
    async lesen(datei) {
      let doc;
      if (modus === 'server') doc = await serverFrage('api/bibliothek/datei?name=' + encodeURIComponent(datei));
      else if (modus === 'ordner' && griff) {
        const z = await ordnerZiel(datei, false);
        const f = await (await z.dir.getFileHandle(z.name)).getFile();
        doc = JSON.parse(await f.text());
      } else throw new Error('Keine Bibliothek eingerichtet.');
      if (GD.depot) { await GD.depot.einlesen(doc); await GD.depot.vorladen(doc); }
      return doc;
    },

    async schreiben(datei, doc) {
      const voll = GD.depot ? await GD.depot.aufblasen(doc) : doc;
      const text = JSON.stringify(voll, null, 1);
      if (modus === 'server') {
        await serverFrage('api/bibliothek/datei?name=' + encodeURIComponent(datei), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: text
        });
      } else if (modus === 'ordner' && griff) {
        if ((await ordnerErlaubnis(true)) !== 'granted') throw new Error('Kein Schreibrecht für den Ordner.');
        const z = await ordnerZiel(datei, true);
        const fh = await z.dir.getFileHandle(z.name, { create: true });
        const w = await fh.createWritable();
        await w.write(text);
        await w.close();
      } else {
        throw new Error('Keine Bibliothek eingerichtet.');
      }
      zwischenspeicher = null;
      library.events.emit('changed');
    },

    async loeschen(datei) {
      if (modus === 'server') {
        await serverFrage('api/bibliothek/datei?name=' + encodeURIComponent(datei), { method: 'DELETE' });
      } else if (modus === 'ordner' && griff) {
        if ((await ordnerErlaubnis(true)) !== 'granted') throw new Error('Kein Schreibrecht für den Ordner.');
        const z = await ordnerZiel(datei, false);
        await z.dir.removeEntry(z.name);
      } else throw new Error('Keine Bibliothek eingerichtet.');
      if (library.link() && library.link().datei === datei) library.entkoppeln();
      zwischenspeicher = null;
      library.events.emit('changed');
    },

    /** Benennt Datei UND den Namen in der Tafel um — sonst laufen sie auseinander */
    async umbenennen(datei, neuerName) {
      const ziel = library.dateiName(neuerName, datei);
      const doc = await library.lesen(datei);
      doc.name = neuerName;
      await library.schreiben(ziel, doc);
      if (ziel !== datei) await library.loeschen(datei);
      const l = library.link();
      if (l && (l.datei === datei || l.datei === ziel)) {
        library.verknuepfen(ziel);
        if (GD.store.doc.name !== neuerName) {
          GD.store.doc.name = neuerName;
          const feld = document.getElementById('board-name');
          if (feld) feld.value = neuerName;
          GD.store.touch();
        }
      }
      zwischenspeicher = null;
      library.events.emit('changed');
      return ziel;
    },

    /* -------------------------------------------------- Öffnen/Sichern */

    /** imWeg: Teil einer Projekt-Kachel-Reise, der Verlauf bleibt dann stehen */
    async oeffnen(datei, imWeg) {
      const doc = await library.lesen(datei);
      GD.store.load(doc);
      library.verknuepfen(datei);
      GD.board.zoomToFit();
      if (!imWeg) { stapel.length = 0; library.events.emit('verlauf', []); }
      return doc;
    },

    /* ------------------------------------------ Weg durch die Projekte
     *
     * Eine Projekt-Kachel führt in eine andere Tafel hinein; „Zurück" bringt
     * einen wieder heraus. Vor jedem Wechsel wird die aktuelle Tafel in ihre
     * eigene Datei geschrieben — sonst stünde beim Zurückkommen der Stand von
     * zuletzt gespeichert da und die Arbeit von eben wäre weg. */

    async hinein(datei) {
      const vorher = library.link();
      if (vorher && vorher.datei && vorher.datei !== datei) {
        try { await library.sichern(vorher.datei); }
        catch (e) { console.warn('[GD] Vor dem Wechsel nicht gesichert:', e); }
        stapel.push(vorher.datei);
      }
      await library.oeffnen(datei, true);
      library.events.emit('verlauf', library.verlauf());
      return datei;
    },

    async zurueck() {
      if (!stapel.length) return null;
      const jetzt = library.link();
      if (jetzt && jetzt.datei) {
        try { await library.sichern(jetzt.datei); }
        catch (e) { console.warn('[GD] Vor dem Zurückgehen nicht gesichert:', e); }
      }
      const ziel = stapel.pop();
      await library.oeffnen(ziel, true);
      library.events.emit('verlauf', library.verlauf());
      return ziel;
    },

    verlauf() { return stapel.slice(); },

    async sichern(datei) {
      const ziel = datei || (library.link() && library.link().datei);
      if (!ziel) throw new Error('Kein Ziel — bitte „Speichern unter" benutzen.');
      await library.schreiben(ziel, GD.store.serialize());
      library.verknuepfen(ziel);
      library.events.emit('gesichert', ziel);
      return ziel;
    },

    async neu(name) {
      const doc = GD.store.emptyDoc();
      doc.name = name || 'Neues Board';
      const datei = library.dateiName(doc.name);
      await library.schreiben(datei, doc);
      GD.store.load(doc);
      library.verknuepfen(datei);
      return datei;
    },

    /** Aus einem Anzeigenamen einen Dateinamen machen (Unterordner bleibt) */
    dateiName(name, vorlage) {
      const ordnerTeil = vorlage && vorlage.includes('/') ? vorlage.slice(0, vorlage.lastIndexOf('/') + 1) : '';
      let rein = String(name || 'board')
        .replace(/\.gamedesk\.json$|\.json$/i, '')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
      if (!rein) rein = 'board';
      return ordnerTeil + rein + '.gamedesk.json';
    },

    /* ------------------------------------------------------ Verknüpfung */

    link() {
      const l = GD.store.prefs.link;
      return l && l.datei && l.modus === modus ? l : null;
    },
    verknuepfen(datei) {
      GD.store.prefs.link = { modus: modus, datei: datei };
      GD.store.savePrefs();
      library.events.emit('verknuepft', datei);
    },
    entkoppeln() {
      GD.store.prefs.link = null;
      GD.store.savePrefs();
      library.events.emit('verknuepft', null);
    }
  };

  GD.library = library;
})();
