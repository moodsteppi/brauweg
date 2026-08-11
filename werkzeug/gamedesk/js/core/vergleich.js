/* GameDesk — Vergleich zweier Tafelstände (Kern, ohne DOM)
 *
 * Zwei Aufgaben, beide rein rechnend:
 *
 *   abzug(doc)          Ein schlanker Fingerabdruck der Tafel. Statt eine
 *                       zweite Kopie des ganzen Dokuments zu sichern (bei den
 *                       großen Tafeln mehrere MB), merkt sich der Abzug je
 *                       Fenster nur Lage, Größe, Titel und eine Prüfsumme
 *                       seines Inhalts — rund 90 Byte pro Kachel.
 *   punkte(alt, neu)    Was sich zwischen zwei Abzügen geändert hat, als
 *                       Liste einzelner Befunde mit Klasse und Kasten.
 *
 * Absichtlich NICHT verfolgt:
 *   view      die Kamera ist keine Änderung an der Tafel
 *   z         jeder Klick hebt ein Fenster nach vorn; das wäre nur Rauschen
 *   grid.show/snap   Anzeigeschalter, keine Entwurfsentscheidung
 *
 * Die Datei läuft in beiden Welten: als klassisches <script> im Browser
 * (GD.vergleich) und als require() in Node (tools/festschreiben.mjs). Deshalb
 * der Doppelkopf unten und kein einziger Zugriff auf window oder document.
 */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (global.GD = global.GD || {}).vergleich = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;

  /* Die Klassen der Änderungssicht. `rang` entscheidet, welche davon eine
     Kachel beschriftet, wenn mehrere zutreffen (kleiner = wichtiger) — ein
     Kasten trägt genau eine Klasse, wie bei einer Objekterkennung.
     Alle Farben liegen im roten Feld; unterschieden wird über den Ton. */
  const KLASSEN = {
    neu:     { label: 'Neu',         farbe: '#ff6a3d', rang: 1 },
    weg:     { label: 'Entfernt',    farbe: '#ff2d55', rang: 2 },
    inhalt:  { label: 'Inhalt',      farbe: '#ff3b30', rang: 3 },
    titel:   { label: 'Titel',       farbe: '#ff7a45', rang: 4 },
    groesse: { label: 'Größe',       farbe: '#f4795b', rang: 5 },
    bewegt:  { label: 'Verschoben',  farbe: '#ff5c8a', rang: 6 },
    stil:    { label: 'Darstellung', farbe: '#e8836b', rang: 7 },
    pfeil:   { label: 'Pfeil',       farbe: '#ff4d6d', rang: 8 },
    modell:  { label: '3D-Modell',   farbe: '#ff7043', rang: 9 },
    tafel:   { label: 'Tafel',       farbe: '#ff8f6b', rang: 10 }
  };

  /* ------------------------------------------------------------- Werkzeug */

  /** JSON mit sortierten Schlüsseln — sonst hinge die Prüfsumme daran, in
      welcher Reihenfolge ein Modul seinen Zustand zusammensetzt. */
  function stabil(wert) {
    if (wert === undefined) return 'u';
    if (wert === null || typeof wert !== 'object') return JSON.stringify(wert);
    if (Array.isArray(wert)) return '[' + wert.map(stabil).join(',') + ']';
    const schluessel = Object.keys(wert).sort();
    let out = '{';
    for (let i = 0; i < schluessel.length; i++) {
      if (i) out += ',';
      out += JSON.stringify(schluessel[i]) + ':' + stabil(wert[schluessel[i]]);
    }
    return out + '}';
  }

  /** FNV-1a, 32 Bit. Reicht völlig: Wir wollen „gleich oder nicht", keine
      Fälschungssicherheit — und der Wert soll kurz in der Datei stehen. */
  function summe(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  const ganz = (v, ersatz) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : (ersatz || 0));
  const kurz = (s, n) => {
    const t = String(s == null ? '' : s);
    return t.length > (n || 26) ? t.slice(0, (n || 26) - 1) + '…' : t;
  };

  /* --------------------------------------------------------------- Abzug */

  function abzug(doc) {
    const d = doc || {};
    const a = {
      v: VERSION,
      name: typeof d.name === 'string' ? d.name : '',
      raster: d.grid ? ganz(d.grid.size, 20) : 20,
      fenster: {},
      pfeile: {},
      buendel: {},
      modelle: {}
    };

    for (const w of Array.isArray(d.windows) ? d.windows : []) {
      if (!w || !w.id) continue;
      const roh = stabil(w.state);
      a.fenster[w.id] = {
        t: String(w.type || ''),
        ti: typeof w.title === 'string' ? w.title : '',
        x: ganz(w.x), y: ganz(w.y),
        b: ganz(w.w), h: ganz(w.h),
        e: w.collapsed ? 1 : 0,
        f: typeof w.accent === 'string' ? w.accent : '',
        z: summe(roh),
        l: roh.length
      };
    }

    for (const c of Array.isArray(d.connections) ? d.connections : []) {
      if (!c || !c.id) continue;
      a.pfeile[c.id] = {
        v: (c.from && c.from.win) || '',
        n: (c.to && c.to.win) || '',
        l: typeof c.label === 'string' ? c.label : '',
        z: summe(stabil({
          vs: c.from && c.from.side, vf: c.from && c.from.shape,
          ns: c.to && c.to.side, nf: c.to && c.to.shape,
          farbe: c.color, staerke: c.width, strich: c.dash,
          lauf: c.curve, spitzen: c.heads, buendel: c.bundle
        }))
      };
    }

    for (const b of Array.isArray(d.bundles) ? d.bundles : []) {
      if (!b || !b.id) continue;
      a.buendel[b.id] = { n: typeof b.name === 'string' ? b.name : '', z: summe(stabil(b)) };
    }

    for (const m of Array.isArray(d.models) ? d.models : []) {
      if (!m || !m.id) continue;
      a.modelle[m.id] = { n: typeof m.name === 'string' ? m.name : '', z: summe(stabil(m.scene)) };
    }

    return a;
  }

  /* ------------------------------------------------------------- Befunde */

  function fuehrend(arten) {
    let best = arten[0];
    for (const a of arten) if ((KLASSEN[a] ? KLASSEN[a].rang : 99) < (KLASSEN[best] ? KLASSEN[best].rang : 99)) best = a;
    return best;
  }

  function fensterPunkt(id, f, arten, zeilen, box, fehlt) {
    return {
      art: fuehrend(arten),
      arten: arten,
      ziel: 'fenster',
      id: id,
      typ: f.t,
      titel: f.ti || '(ohne Titel)',
      zeilen: zeilen,
      text: zeilen.join('  ·  '),
      box: box,
      fehlt: !!fehlt
    };
  }

  /**
   * Unterschiede zwischen zwei Abzügen. Je Fenster entsteht HÖCHSTENS EIN
   * Befund — auch wenn eine Kachel gleichzeitig verschoben und umgeschrieben
   * wurde. Sonst lägen in der Änderungssicht mehrere Kästen aufeinander.
   */
  function punkte(alt, neu) {
    const out = [];
    if (!alt || !neu) return out;

    const aF = alt.fenster || {}, nF = neu.fenster || {};
    const aP = alt.pfeile || {}, nP = neu.pfeile || {};
    const aB = alt.buendel || {}, nB = neu.buendel || {};
    const aM = alt.modelle || {}, nM = neu.modelle || {};

    /* ---- Tafel ---- */
    if (alt.name !== neu.name) {
      out.push({
        art: 'tafel', arten: ['tafel'], ziel: 'tafel', id: 'tafel', typ: '', titel: neu.name,
        zeilen: ['Tafel umbenannt: „' + alt.name + '" → „' + neu.name + '"'],
        text: 'Tafel umbenannt: „' + alt.name + '" → „' + neu.name + '"', box: null
      });
    }
    if (alt.raster !== neu.raster) {
      const t = 'Rastermaß ' + alt.raster + ' → ' + neu.raster;
      out.push({ art: 'tafel', arten: ['tafel'], ziel: 'tafel', id: 'raster', typ: '', titel: 'Raster', zeilen: [t], text: t, box: null });
    }

    /* ---- Fenster ---- */
    for (const id in nF) {
      const n = nF[id], a = aF[id];
      const box = { x: n.x, y: n.y, w: n.b, h: n.e ? 34 : n.h };

      if (!a) {
        out.push(fensterPunkt(id, n, ['neu'], ['Neu angelegt'], box));
        continue;
      }

      const arten = [], zeilen = [];
      if (a.z !== n.z) {
        arten.push('inhalt');
        const d = n.l - a.l;
        zeilen.push('Inhalt geändert' + (d === 0 ? '' : ' (' + (d > 0 ? '+' : '−') + Math.abs(d) + ' Zeichen)'));
      }
      if (a.ti !== n.ti) {
        arten.push('titel');
        zeilen.push('Titel: „' + kurz(a.ti) + '" → „' + kurz(n.ti) + '"');
      }
      if (a.b !== n.b || a.h !== n.h) {
        arten.push('groesse');
        zeilen.push('Größe: ' + a.b + ' × ' + a.h + ' → ' + n.b + ' × ' + n.h);
      }
      if (a.x !== n.x || a.y !== n.y) {
        arten.push('bewegt');
        zeilen.push('Verschoben um ' + (n.x - a.x) + ' × ' + (n.y - a.y));
      }
      if (a.e !== n.e) { arten.push('stil'); zeilen.push(n.e ? 'Eingeklappt' : 'Ausgeklappt'); }
      if (a.f !== n.f) { arten.push('stil'); zeilen.push('Farbe geändert'); }

      if (arten.length) out.push(fensterPunkt(id, n, arten, zeilen, box));
    }

    for (const id in aF) {
      if (nF[id]) continue;
      const a = aF[id];
      out.push(fensterPunkt(id, a, ['weg'], ['Gelöscht'],
        { x: a.x, y: a.y, w: a.b, h: a.e ? 34 : a.h }, true));
    }

    /* ---- Pfeile ----
       Ein Pfeil hat keinen eigenen Kasten; er bekommt in der Änderungssicht
       nur eine Marke in der Mitte zwischen seinen beiden Enden. Dafür stehen
       hier die Fenster-IDs mit im Befund. */
    const pfeilName = (p, quelle) => {
      const v = (quelle.fenster[p.v] && quelle.fenster[p.v].ti) || '?';
      const n = (quelle.fenster[p.n] && quelle.fenster[p.n].ti) || '?';
      return kurz(v, 18) + ' → ' + kurz(n, 18);
    };
    const pfeilPunkt = (id, p, zeile, quelle, fehlt) => ({
      art: 'pfeil', arten: ['pfeil'], ziel: 'pfeil', id: id, typ: 'pfeil',
      titel: p.l || pfeilName(p, quelle),
      zeilen: [zeile], text: zeile, box: null, von: p.v, nach: p.n, fehlt: !!fehlt
    });

    for (const id in nP) {
      const n = nP[id], a = aP[id];
      if (!a) { out.push(pfeilPunkt(id, n, 'Neuer Pfeil: ' + pfeilName(n, neu), neu)); continue; }
      if (a.l !== n.l) {
        out.push(pfeilPunkt(id, n, 'Beschriftung: „' + kurz(a.l) + '" → „' + kurz(n.l) + '"', neu));
      } else if (a.z !== n.z || a.v !== n.v || a.n !== n.n) {
        out.push(pfeilPunkt(id, n, 'Verlauf oder Aussehen geändert', neu));
      }
    }
    for (const id in aP) {
      if (nP[id]) continue;
      out.push(pfeilPunkt(id, aP[id], 'Pfeil entfernt: ' + pfeilName(aP[id], alt), alt, true));
    }

    /* ---- Bündel ---- */
    for (const id in nB) {
      const n = nB[id], a = aB[id];
      const zeile = !a ? 'Neues Bündel „' + n.n + '"' : (a.z !== n.z ? 'Bündel „' + n.n + '" geändert' : null);
      if (zeile) out.push({ art: 'pfeil', arten: ['pfeil'], ziel: 'buendel', id: id, typ: 'buendel', titel: n.n, zeilen: [zeile], text: zeile, box: null });
    }
    for (const id in aB) {
      if (nB[id]) continue;
      const zeile = 'Bündel „' + aB[id].n + '" aufgelöst';
      out.push({ art: 'pfeil', arten: ['pfeil'], ziel: 'buendel', id: id, typ: 'buendel', titel: aB[id].n, zeilen: [zeile], text: zeile, box: null, fehlt: true });
    }

    /* ---- 3D-Modelle ---- */
    for (const id in nM) {
      const n = nM[id], a = aM[id];
      const zeile = !a ? 'Neues Modell „' + n.n + '"'
        : (a.z !== n.z ? 'Modell geändert' : (a.n !== n.n ? 'Modell umbenannt: „' + a.n + '" → „' + n.n + '"' : null));
      if (zeile) out.push({ art: 'modell', arten: ['modell'], ziel: 'modell', id: id, typ: 'modell', titel: n.n, zeilen: [zeile], text: zeile, box: null });
    }
    for (const id in aM) {
      if (nM[id]) continue;
      const zeile = 'Modell „' + aM[id].n + '" gelöscht';
      out.push({ art: 'modell', arten: ['modell'], ziel: 'modell', id: id, typ: 'modell', titel: aM[id].n, zeilen: [zeile], text: zeile, box: null, fehlt: true });
    }

    out.sort((p, q) => (KLASSEN[p.art].rang - KLASSEN[q.art].rang) || String(p.titel).localeCompare(String(q.titel), 'de'));
    return out;
  }

  /** Zahlen für die Kopfzeile: gesamt und je Klasse */
  function zahlen(liste) {
    const z = { gesamt: (liste || []).length, jeKlasse: {}, fenster: 0, pfeile: 0, sonst: 0 };
    for (const p of liste || []) {
      z.jeKlasse[p.art] = (z.jeKlasse[p.art] || 0) + 1;
      if (p.ziel === 'fenster') z.fenster += 1;
      else if (p.ziel === 'pfeil' || p.ziel === 'buendel') z.pfeile += 1;
      else z.sonst += 1;
    }
    return z;
  }

  /** Ein Satz, der den Stand zusammenfasst */
  function satz(liste) {
    const z = zahlen(liste);
    if (!z.gesamt) return 'Keine Änderung seit dem letzten Commit.';
    const teile = Object.keys(z.jeKlasse)
      .sort((a, b) => KLASSEN[a].rang - KLASSEN[b].rang)
      .map((k) => z.jeKlasse[k] + '× ' + KLASSEN[k].label);
    return z.gesamt + (z.gesamt === 1 ? ' Änderung' : ' Änderungen') + ' seit dem letzten Commit — ' + teile.join(' · ');
  }

  return {
    VERSION: VERSION,
    KLASSEN: KLASSEN,
    abzug: abzug,
    punkte: punkte,
    zahlen: zahlen,
    satz: satz,
    stabil: stabil,
    summe: summe
  };
});
