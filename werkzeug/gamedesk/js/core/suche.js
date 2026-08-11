/* GameDesk — Springen: eine Zeile, die jede Kachel wiederfindet
 *
 * Auf einer Tafel mit hundertzwanzig Kacheln ist nicht das Anlegen die
 * Arbeit, sondern das Wiederfinden. Bisher gab es dafür nur zwei Wege:
 * herauszoomen, bis alles Grieß ist, und suchen — oder wissen, wo es liegt.
 * Beides kostet jedes Mal Zeit, und beides wird schlechter, je größer die
 * Tafel wird.
 *
 * Strg+F öffnet ein Feld über dem Brett. Getippt wird, was man sucht;
 * gesucht wird in Titeln, Modulnamen, Rahmenuntertiteln, Notiztexten,
 * Quelltexten und Pfeilbeschriftungen. Hoch/Runter geht durch die Treffer,
 * die Kamera fährt dabei MIT — man sieht also schon beim Durchgehen, wohin
 * man käme. Eingabe bleibt dort, Esc bringt einen zurück, wo man war.
 *
 * Zurückbringen ist der Punkt: Wer sucht, will nachsehen, nicht umziehen.
 * Ohne den Rückweg traut man sich nicht, mitten in der Arbeit zu suchen.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const MAX_TREFFER = 40;          // mehr liest ohnehin niemand durch
  const AUSZUG = 90;               // so viel Fundstelle steht in der Zeile

  let box = null, feld = null, liste = null, zahl = null;
  let treffer = [];
  let wahl = -1;
  let rueckweg = null;             // Ansicht und Auswahl vor dem Suchen

  const suche = {
    offen() { return !!box; },

    oeffnen(vorgabe) {
      if (box) { feld.focus(); feld.select(); return; }
      const v = GD.store.doc.view;
      rueckweg = { x: v.x, y: v.y, scale: v.scale, auswahl: GD.windows.selectionIds() };
      baueStoff();

      box = U.el('div', { class: 'suche' });
      feld = U.el('input', {
        class: 'suche__feld', type: 'text', spellcheck: false,
        placeholder: 'Springen zu … (Titel, Text, Pfeilbeschriftung)'
      });
      zahl = U.el('div', { class: 'suche__zahl' });
      liste = U.el('div', { class: 'suche__liste' });
      box.append(U.el('div', { class: 'suche__kopf' }, [feld, zahl]), liste);
      document.body.appendChild(box);

      feld.addEventListener('input', () => rechne(feld.value));
      feld.addEventListener('keydown', onTaste);
      /* Ein Klick daneben schließt — aber ohne zurückzuspringen: Wer
         danebentippt, hat sich meist schon für den Ort entschieden, den er
         gerade sieht. */
      abbruch = U.on(document, 'pointerdown', (ev) => {
        if (box && !ev.target.closest('.suche')) suche.schliessen(false);
      }, true);

      rechne(vorgabe || '');
      feld.value = vorgabe || '';
      feld.focus();
    },

    /** @param zurueck true = Ansicht wiederherstellen (Esc), false = bleiben */
    schliessen(zurueck) {
      if (!box) return;
      /* Eingabe direkt nach dem letzten Buchstaben: Der Flug steht dann noch
         aus — er muss vorher zu Ende gebracht werden, sonst schließt sich
         das Feld und man steht da, wo man vorher war. */
      if (zurueck) flug.cancel(); else flug.flush();
      if (abbruch) { abbruch(); abbruch = null; }
      box.remove();
      box = feld = liste = zahl = null;
      treffer = []; wahl = -1; stoff = [];
      if (zurueck && rueckweg) {
        GD.board.setView(rueckweg.x, rueckweg.y, rueckweg.scale);
        GD.windows.select(rueckweg.auswahl);
      }
      rueckweg = null;
      GD.board.elBoard.focus();
    }
  };

  let abbruch = null;

  /* ------------------------------------------------------------- Suchen */

  function onTaste(ev) {
    ev.stopPropagation();          // die Tastenkürzel des Bretts gehen hier nicht
    if (ev.key === 'Escape') { ev.preventDefault(); suche.schliessen(true); return; }
    if (ev.key === 'Enter') { ev.preventDefault(); suche.schliessen(false); return; }
    if (ev.key === 'ArrowDown' || (ev.key === 'Tab' && !ev.shiftKey)) { ev.preventDefault(); gehe(1); return; }
    if (ev.key === 'ArrowUp' || (ev.key === 'Tab' && ev.shiftKey)) { ev.preventDefault(); gehe(-1); return; }
  }

  function gehe(schritt) {
    if (!treffer.length) return;
    wahl = (wahl + schritt + treffer.length) % treffer.length;
    zeigeWahl(true);               // beim Blättern sofort — das IST die Absicht
  }

  function rechne(text) {
    const worte = String(text).toLowerCase().split(/\s+/).filter(Boolean);
    treffer = worte.length ? finde(worte) : [];
    wahl = treffer.length ? 0 : -1;
    zeichneListe();
    if (treffer.length) zeigeWahl(false);
  }

  /**
   * Alle Wörter müssen vorkommen, aber nicht am Stück und nicht der Reihe
   * nach — „regel karte" findet „Kartenregeln". Bewertet wird danach, WO
   * ein Wort steckt: Ein Treffer im Titel ist mehr wert als einer im
   * Fließtext, sonst schwemmen lange Notizen das Gesuchte weg.
   */
  function finde(worte) {
    const aus = [];
    for (const q of stoff) {
      const w = q.d;
      let punkte = 0, fehlt = false;
      for (const wort of worte) {
        const imTitel = q.titel.indexOf(wort) >= 0;
        const imText = q.text.indexOf(wort) >= 0;
        if (!imTitel && !imText) { fehlt = true; break; }
        punkte += imTitel ? 10 : 1;
        if (imTitel && q.titel.startsWith(wort)) punkte += 5;
      }
      if (fehlt) continue;
      aus.push({ art: 'fenster', id: w.id, d: w, punkte: punkte, stelle: fundstelle(q.roh, worte[0]) });
    }

    for (const c of GD.store.doc.connections) {
      const label = String(c.label || '').toLowerCase();
      if (!label) continue;
      if (!worte.every((wort) => label.indexOf(wort) >= 0)) continue;
      aus.push({ art: 'pfeil', id: c.id, c: c, punkte: 8, stelle: c.label });
    }

    aus.sort((a, b) => b.punkte - a.punkte);
    return aus.slice(0, MAX_TREFFER);
  }

  /**
   * Der Suchstoff — EINMAL beim Öffnen gebaut, nicht bei jedem Zeichen.
   *
   * Hier stand zuerst ein Cache je Kachel, dessen Schlüssel den laufenden
   * Modulzustand befragte. Das kostete 8,6 ms je Tastendruck: `getState()`
   * liest bei einer Notiz das `innerHTML` aus dem Blatt und klont bei einem
   * Quelltextfenster den ganzen Text — hundertsiebzehnmal, für jeden
   * Buchstaben.
   *
   * Solange das Feld offen steht, kann sich an der Tafel ohnehin nichts
   * ändern: Getippt wird ins Suchfeld. Also einmal `syncStates()`, einmal
   * den Text einsammeln — und danach ist Suchen reines Vergleichen von
   * Zeichenketten.
   */
  let stoff = [];

  function baueStoff() {
    /* Nur die Kachel einholen, an der gerade gearbeitet wird — alle anderen
       hat das Autospeichern längst ins Dokument geschrieben. `syncStates()`
       über die ganze Tafel zu schicken kostete beim Öffnen 175 ms (gemessen
       auf der Feldherr-Tafel): `getState()` liest bei jeder Notiz das
       innerHTML aus dem Blatt und klont jeden Quelltext. Ein sichtbares
       Stocken, nur damit ein Suchfeld erscheint. */
    const aktiv = GD.windows.activeId();
    const rec = aktiv ? GD.windows.get(aktiv) : null;
    if (rec && rec.inst && rec.inst.getState) {
      try { rec.data.state = rec.inst.getState(); } catch (e) { /* dann eben der gespeicherte */ }
    }
    stoff = GD.store.doc.windows.map((w) => {
      const roh = textVon(w, w.state);
      return { d: w, titel: String(w.title || '').toLowerCase(), roh: roh, text: roh.toLowerCase() };
    });
  }

  /** Modulübergreifend: was an einer Kachel Text ist */
  function textVon(w, z) {
    const teile = [w.title || ''];
    const def = GD.modules.get(w.type);
    if (def) teile.push(def.label);
    if (z && typeof z === 'object') {
      if (typeof z.html === 'string') teile.push(ohneHtml(z.html));      // Notiz
      if (typeof z.text === 'string') teile.push(z.text);                // Quelltext
      if (typeof z.note === 'string') teile.push(z.note);                // Rahmen-Untertitel
      if (typeof z.js === 'string') teile.push(z.js);                    // Sandkasten
      if (typeof z.html2 === 'string') teile.push(z.html2);
      if (Array.isArray(z.items)) {                                      // Medien
        for (const it of z.items) teile.push((it && it.name) || '', (it && it.caption) || '');
      }
      if (Array.isArray(z.shapes)) {                                     // Wireframe
        for (const s of z.shapes) if (s && s.text) teile.push(s.text);
      }
    }
    return teile.join(' · ').replace(/\s+/g, ' ').trim();
  }

  function ohneHtml(s) {
    return String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ');
  }

  /** Ein Stück Text um die erste Fundstelle — damit man sieht, WARUM es traf */
  function fundstelle(roh, wort) {
    const i = roh.toLowerCase().indexOf(wort);
    if (i < 0) return roh.slice(0, AUSZUG);
    const von = Math.max(0, i - 24);
    return (von > 0 ? '…' : '') + roh.slice(von, von + AUSZUG) + (von + AUSZUG < roh.length ? '…' : '');
  }

  /* ------------------------------------------------------------ Anzeige */

  function zeichneListe() {
    liste.innerHTML = '';
    zahl.textContent = treffer.length ? treffer.length + (treffer.length === MAX_TREFFER ? '+' : '') : '';
    if (!treffer.length) {
      liste.appendChild(U.el('div', { class: 'suche__leer', text: feld.value.trim() ? 'nichts gefunden' : 'Hoch/Runter blättert · Eingabe bleibt dort · Esc bringt zurück' }));
      return;
    }
    treffer.forEach((t, i) => {
      const def = t.art === 'fenster' ? (GD.modules.get(t.d.type) || GD.modules.fallback(t.d.type)) : null;
      const zeile = U.el('div', { class: 'suche__zeile' + (i === wahl ? ' is-an' : '') }, [
        U.el('span', { class: 'suche__icon', text: def ? def.icon : '↗' }),
        U.el('span', { class: 'suche__haupt' }, [
          U.el('span', { class: 'suche__titel', text: t.art === 'fenster' ? (t.d.title || def.label) : ('Pfeil: ' + t.c.label) }),
          U.el('span', { class: 'suche__stelle', text: t.stelle || '' })
        ]),
        U.el('span', { class: 'suche__art', text: def ? def.label : 'Verbindung' })
      ]);
      if (def) zeile.style.setProperty('--ton', t.d.accent || def.accent);
      zeile.addEventListener('pointerdown', (ev) => { ev.preventDefault(); wahl = i; zeigeWahl(true); });
      zeile.addEventListener('dblclick', () => suche.schliessen(false));
      liste.appendChild(zeile);
    });
  }

  /**
   * Kamera auf den Treffer fahren und ihn auswählen.
   *
   * Beim BLÄTTERN sofort — wer die Pfeiltaste drückt, will genau das sehen.
   * Beim TIPPEN erst nach kurzem Innehalten: Sonst fliegt die Kamera bei
   * „k", „ka", „kar" dreimal quer über die Tafel, und man sieht am Ende
   * schwindlig, wovon man ohnehin nur den letzten Sprung wollte. Die Liste
   * steht dabei sofort — nur der Flug wartet.
   */
  function zeigeWahl(sofort) {
    if (!treffer[wahl]) return;
    for (const [i, zeile] of Array.from(liste.children).entries()) zeile.classList.toggle('is-an', i === wahl);
    /* Nur beim Blättern in Sicht rollen. `scrollIntoView` misst — es ist ein
       Lesezugriff auf das Layout und kostete auf einer großen Tafel den
       Löwenanteil der Zeit je Tastendruck. Nach dem Tippen steht die Wahl
       ohnehin auf der ERSTEN Zeile, und die ist immer zu sehen. */
    const an = liste.children[wahl];
    if (sofort && an && an.scrollIntoView) an.scrollIntoView({ block: 'nearest' });
    if (sofort) { flug.cancel(); hinfahren(); }
    else flug();
  }

  const flug = U.debounce(() => hinfahren(), 190);

  function hinfahren() {
    const t = treffer[wahl];
    if (!t || !box) return;
    if (t.art === 'fenster') {
      const d = t.d;
      /* Nicht bis an den Rand heranfahren: Ein Stück Umgebung sagt, WO auf
         der Tafel man gelandet ist — sonst steht man vor einer Kachel ohne
         zu wissen, wozu sie gehört. Und nie über 100 % hinaus: Eine kleine
         Kachel formatfüllend aufzublasen verwirrt mehr, als es zeigt. */
      const rand = Math.max(d.w, d.h) * 0.35 + 120;
      GD.board.zoomToFit({ x: d.x - rand, y: d.y - rand, w: d.w + rand * 2, h: d.h + rand * 2 }, 20);
      if (GD.board.scale() > 1) GD.board.centerOn(d.x + d.w / 2, d.y + d.h / 2, 1);
      GD.windows.select([d.id]);
      GD.connections.select(null);
    } else {
      const von = GD.store.getWindow(t.c.from.win), nach = GD.store.getWindow(t.c.to.win);
      if (von && nach) {
        const x1 = Math.min(von.x, nach.x), y1 = Math.min(von.y, nach.y);
        const x2 = Math.max(von.x + von.w, nach.x + nach.w), y2 = Math.max(von.y + von.h, nach.y + nach.h);
        GD.board.zoomToFit({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, 80);
      }
      GD.connections.select(t.c.id);
    }
  }

  GD.suche = suche;
})();
