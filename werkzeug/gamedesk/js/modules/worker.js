/* GameDesk — Modul „Worker": Schnittstelle zum Worker-Modul im Broweg
 *
 * Der bro-server aus dem Broweg-Projekt verteilt Aufgaben an Worker-PCs: Jeder
 * Worker hängt per WebSocket am Gateway (/worker), meldet Herzschläge und
 * nimmt Aufträge entgegen; Ergebnis, Verbrauch und Commit-Hash laufen zurück
 * (bro-server/src/lib/worker-gateway.ts).
 *
 * Diese Kachel ist die Gegenstelle auf der Tafel: Sie zeigt, wer online ist,
 * woran gerade gearbeitet wird und was zuletzt herauskam — und sie kann eine
 * Aufgabe hineingeben.
 *
 * Der Weg dorthin läuft über den GameDesk-Server (tools/serve.mjs, Abschnitt
 * „Brücke nach Broweg"): gleiche Herkunft, kein CORS, und das Sitzungs-Cookie
 * liegt dort im Speicher statt im Browser. Ohne diesen Server — also bei
 * file:// — bleibt die Kachel bei dem stehen, was sie zuletzt gesehen hat.
 */
(function () {
  'use strict';
  const GD = window.GD;
  const U = GD.util;

  const ZUSTAND = {
    ONLINE:    { text: 'online',    farbe: '#57c98a' },
    BUSY:      { text: 'arbeitet',  farbe: '#6ea8fe' },
    EXHAUSTED: { text: 'Kontingent aufgebraucht', farbe: '#e8b45c' },
    OFFLINE:   { text: 'offline',   farbe: '#6b7488' }
  };

  const AUFGABE = {
    QUEUED:    { text: 'wartet',     farbe: '#9aa4b6' },
    ASSIGNED:  { text: 'zugeteilt',  farbe: '#6ea8fe' },
    RUNNING:   { text: 'läuft',      farbe: '#6ea8fe' },
    DONE:      { text: 'fertig',     farbe: '#57c98a' },
    FAILED:    { text: 'gescheitert', farbe: '#ef6b6b' },
    CANCELLED: { text: 'abgebrochen', farbe: '#6b7488' }
  };

  const seit = (ms) => {
    if (!ms) return 'nie';
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return 'vor ' + s + ' s';
    if (s < 3600) return 'vor ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'vor ' + Math.round(s / 3600) + ' h';
    return 'vor ' + Math.round(s / 86400) + ' Tagen';
  };

  const zahl = (n) => Number(n || 0).toLocaleString('de-DE');

  /* ------------------------------------------------------------- Zugriff */

  /** Läuft GameDesk hinter dem eigenen Server? Nur dann gibt es die Brücke. */
  const ueberServer = () => /^https?:$/.test(location.protocol);

  async function frage(pfad, opt) {
    if (!ueberServer()) throw new Error('Kein GameDesk-Server — starte über „GameDesk starten.bat".');
    const res = await fetch(pfad, opt);
    const text = await res.text();
    let daten = null;
    try { daten = text ? JSON.parse(text) : null; } catch (e) { /* Rohtext */ }
    if (!res.ok) {
      const err = new Error((daten && (daten.fehler || daten.message)) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return daten;
  }

  const bruecke = {
    status: () => frage('api/broweg'),
    basisSetzen: (basis) => frage('api/broweg', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ basis: basis })
    }),
    anmelden: (email, passwort) => frage('api/broweg/anmelden', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, passwort: passwort })
    }),
    abmelden: () => frage('api/broweg/abmelden', { method: 'POST' }),
    ruf: (pfad, opt) => {
      const o = opt || {};
      return frage('api/broweg/ruf?pfad=' + encodeURIComponent(pfad), {
        method: o.method || 'GET',
        headers: o.body ? { 'Content-Type': 'application/json' } : undefined,
        body: o.body ? JSON.stringify(o.body) : undefined
      });
    }
  };

  GD.broweg = bruecke;      // damit auch ein Skript die Brücke benutzen kann

  GD.modules.register({
    id: 'worker',
    label: 'Worker',
    icon: '⚗',
    description: 'Worker-Modul im Broweg',
    accent: '#4fd1c5',
    defaultSize: { w: 400, h: 380 },
    defaultTitle: 'Worker (Broweg)',

    create(ctx) {
      const state = Object.assign({
        takt: 15,                 // Sekunden zwischen zwei Abfragen; 0 = aus
        zeigeAufgaben: true,
        maxAufgaben: 6,
        letzte: null              // zuletzt Gesehenes, damit ohne Server etwas dasteht
      }, ctx.state || {});

      let brueckeStatus = { basis: '', angemeldet: false, benutzer: '' };
      let fehler = '';
      let laeuft = false;
      let uhr = 0;

      const punkt = U.el('span', { class: 'wk-punkt' });
      const adresse = U.el('span', { class: 'wk-adresse' });
      const wer = U.el('span', { class: 'wk-wer' });
      const frisch = U.el('button', { class: 'wk-btn', text: '↻', title: 'Jetzt abfragen' });
      const kopf = U.el('div', { class: 'wk-kopf' }, [punkt, adresse, wer, frisch]);

      const meldung = U.el('div', { class: 'wk-meldung' });
      const workerListe = U.el('div', { class: 'wk-liste' });
      const aufgabenTitel = U.el('div', { class: 'wk-abschnitt', text: 'Letzte Aufgaben' });
      const aufgabenListe = U.el('div', { class: 'wk-liste wk-liste--aufgaben' });

      const geben = U.el('button', { class: 'btn btn--sm', text: 'Aufgabe geben…' });
      const stand = U.el('span', { class: 'wk-stand' });
      const fuss = U.el('div', { class: 'wk-fuss' }, [stand, geben]);

      const rumpf = U.el('div', { class: 'wk-rumpf', dataset: { gdScroll: '1' } }, [
        meldung, workerListe, aufgabenTitel, aufgabenListe
      ]);
      const root = U.el('div', { class: 'wk-root' }, [kopf, rumpf, fuss]);

      /* ------------------------------------------------------ Zeichnen */

      function pille(karte, schluessel) {
        const e = karte[schluessel] || { text: schluessel, farbe: '#6b7488' };
        const el = U.el('span', { class: 'wk-pille', text: e.text });
        el.style.setProperty('--wk-farbe', e.farbe);
        return el;
      }

      function paint() {
        const daten = state.letzte;
        const online = daten ? daten.workers.filter((w) => w.status === 'ONLINE' || w.status === 'BUSY').length : 0;

        punkt.style.setProperty('--wk-farbe',
          !brueckeStatus.angemeldet ? '#6b7488' : (fehler ? '#ef6b6b' : (online ? '#57c98a' : '#e8b45c')));
        adresse.textContent = brueckeStatus.basis || 'kein Server eingetragen';
        adresse.title = brueckeStatus.basis || '';
        wer.textContent = brueckeStatus.angemeldet ? (brueckeStatus.benutzer || 'angemeldet') : 'nicht angemeldet';
        wer.classList.toggle('is-aus', !brueckeStatus.angemeldet);

        meldung.textContent = fehler || '';
        meldung.style.display = fehler ? '' : 'none';

        workerListe.innerHTML = '';
        if (!daten) {
          workerListe.appendChild(U.el('div', { class: 'wk-leer', text: ueberServer()
            ? 'Noch nichts abgefragt — im Inspector rechts anmelden.'
            : 'Ohne GameDesk-Server (file://) bleibt die Kachel leer. Über „GameDesk starten.bat" öffnen.' }));
        } else if (!daten.workers.length) {
          workerListe.appendChild(U.el('div', { class: 'wk-leer', text: 'Kein Worker angelegt. Im Inspector rechts einen anlegen — der Token erscheint dann genau einmal.' }));
        } else {
          for (const w of daten.workers) {
            const heartbeat = w.lastHeartbeat ? Date.parse(w.lastHeartbeat) : 0;
            workerListe.appendChild(U.el('div', { class: 'wk-zeile' }, [
              U.el('div', { class: 'wk-zeile__haupt' }, [
                U.el('div', { class: 'wk-zeile__name' }, [
                  U.el('span', { text: w.displayName }),
                  pille(ZUSTAND, w.status)
                ]),
                U.el('div', { class: 'wk-zeile__meta', text:
                  (w.skillTags && w.skillTags.length ? w.skillTags.join(' · ') + '  ·  ' : '') +
                  zahl(w.tasksDone) + ' Aufgaben  ·  ' + zahl(w.tokensUsed) + ' Token  ·  ' + seit(heartbeat) })
              ])
            ]));
          }
        }

        aufgabenTitel.style.display = state.zeigeAufgaben ? '' : 'none';
        aufgabenListe.style.display = state.zeigeAufgaben ? '' : 'none';
        aufgabenListe.innerHTML = '';
        if (state.zeigeAufgaben && daten) {
          const namen = new Map(daten.workers.map((w) => [w.id, w.displayName]));
          const liste = daten.tasks.slice(0, state.maxAufgaben);
          if (!liste.length) aufgabenListe.appendChild(U.el('div', { class: 'wk-leer', text: 'Noch keine Aufgabe.' }));
          for (const t of liste) {
            aufgabenListe.appendChild(U.el('div', { class: 'wk-zeile' }, [
              U.el('div', { class: 'wk-zeile__haupt' }, [
                U.el('div', { class: 'wk-zeile__name' }, [
                  U.el('span', { text: t.title }),
                  pille(AUFGABE, t.status)
                ]),
                U.el('div', { class: 'wk-zeile__meta', text: [
                  namen.get(t.workerId) || 'ohne Worker',
                  t.repo || null,
                  t.commitHash ? t.commitHash.slice(0, 7) : null,
                  seit(Date.parse(t.createdAt))
                ].filter(Boolean).join('  ·  ') })
              ])
            ]));
          }
        }

        stand.textContent = daten ? 'Stand ' + seit(daten.zeit) : '';
        geben.disabled = !brueckeStatus.angemeldet;
        frisch.classList.toggle('is-laeuft', laeuft);
      }

      /* -------------------------------------------------------- Holen */

      async function statusHolen() {
        try {
          brueckeStatus = await bruecke.status();
          fehler = '';
        } catch (e) {
          brueckeStatus = { basis: '', angemeldet: false, benutzer: '' };
          fehler = e.message;
        }
      }

      async function holen(still) {
        if (laeuft) return;
        laeuft = true;
        paint();
        try {
          await statusHolen();
          if (!brueckeStatus.angemeldet) {
            if (!fehler) fehler = 'Nicht angemeldet — im Inspector rechts anmelden.';
            return;
          }
          const w = await bruecke.ruf('/workers');
          const t = await bruecke.ruf('/tasks');
          state.letzte = {
            workers: (w && w.workers) || [],
            tasks: (t && t.tasks) || [],
            zeit: Date.now()
          };
          fehler = '';
          ctx.changed();
          if (!still) ctx.toast(state.letzte.workers.length + ' Worker gelesen', 'ok');
        } catch (e) {
          fehler = e.message;
          if (!still) ctx.toast('Broweg: ' + e.message, 'err');
        } finally {
          laeuft = false;
          paint();
        }
      }

      function taktSetzen() {
        if (uhr) { clearInterval(uhr); uhr = 0; }
        if (state.takt > 0) uhr = setInterval(() => { if (!document.hidden) holen(true); }, state.takt * 1000);
      }

      frisch.addEventListener('click', () => holen());

      /* ------------------------------------------------ Aufgabe geben */

      function aufgabeGeben() {
        const F = GD.ui.fields;
        const eingabe = { title: '', prompt: '', repo: '' };
        const body = U.el('div', {}, [U.el('h2', { text: 'Aufgabe an einen Worker geben' })]);

        const titel = U.el('input', { type: 'text', class: 'fld', placeholder: 'Kurzer Titel' });
        const auftrag = U.el('textarea', { class: 'fld', rows: 6, placeholder: 'Was soll gemacht werden? (geht als Prompt an Claude auf dem Worker-PC)' });
        const repo = U.el('input', { type: 'text', class: 'fld', placeholder: 'Repo (freiwillig)' });
        for (const f of [titel, auftrag, repo]) f.addEventListener('keydown', (ev) => ev.stopPropagation());
        auftrag.style.width = '100%';
        auftrag.style.fontFamily = 'inherit';

        body.append(F.row('Titel', titel), F.row('Auftrag', auftrag), F.row('Repo', repo),
          F.note('Der Server sucht einen freien Worker. Ist keiner online, wartet die Aufgabe in der Queue.'));

        const senden = U.el('button', { class: 'btn', text: 'Absenden' });
        const abbrechen = U.el('button', { class: 'btn', text: 'Abbrechen' });
        body.appendChild(U.el('div', { class: 'modal-actions' }, [abbrechen, senden]));
        const m = GD.ui.modal(body);
        abbrechen.addEventListener('click', () => m.close());

        senden.addEventListener('click', async () => {
          eingabe.title = titel.value.trim();
          eingabe.prompt = auftrag.value.trim();
          eingabe.repo = repo.value.trim();
          if (!eingabe.title || !eingabe.prompt) { ctx.toast('Titel und Auftrag sind Pflicht', 'err'); return; }
          senden.disabled = true;
          try {
            const erg = await bruecke.ruf('/tasks', { method: 'POST', body: eingabe });
            m.close();
            ctx.toast(erg && erg.message ? erg.message : 'Aufgabe angelegt', 'ok');
            holen(true);
          } catch (e) {
            senden.disabled = false;
            ctx.toast('Nicht angelegt: ' + e.message, 'err');
          }
        });
        titel.focus();
      }

      geben.addEventListener('click', aufgabeGeben);

      /* ---------------------------------------------------- Anmelden */

      function anmeldeFenster(fertig) {
        const F = GD.ui.fields;
        const body = U.el('div', {}, [U.el('h2', { text: 'Am Broweg-Server anmelden' })]);
        const email = U.el('input', { type: 'email', class: 'fld', autocomplete: 'username' });
        const pass = U.el('input', { type: 'password', class: 'fld', autocomplete: 'current-password' });
        for (const f of [email, pass]) f.addEventListener('keydown', (ev) => ev.stopPropagation());
        body.append(F.row('E-Mail', email), F.row('Passwort', pass),
          F.note('Die Anmeldung geht an ' + (brueckeStatus.basis || 'den eingetragenen Server') +
            '. Das Sitzungs-Cookie bleibt im GameDesk-Server und nur im Arbeitsspeicher — Passwort und Cookie landen nie auf der Platte.'));

        const senden = U.el('button', { class: 'btn', text: 'Anmelden' });
        const abbrechen = U.el('button', { class: 'btn', text: 'Abbrechen' });
        body.appendChild(U.el('div', { class: 'modal-actions' }, [abbrechen, senden]));
        const m = GD.ui.modal(body);
        abbrechen.addEventListener('click', () => m.close());

        async function los() {
          senden.disabled = true;
          try {
            await bruecke.anmelden(email.value.trim(), pass.value);
            m.close();
            ctx.toast('Angemeldet', 'ok');
            await holen(true);
            if (fertig) fertig();
          } catch (e) {
            senden.disabled = false;
            ctx.toast('Anmeldung fehlgeschlagen: ' + e.message, 'err');
          }
        }
        senden.addEventListener('click', los);
        pass.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') los(); });
        email.focus();
      }

      /** Neuer Worker — der Klartext-Token kommt genau einmal zurück */
      function workerAnlegen(fertig) {
        const F = GD.ui.fields;
        const body = U.el('div', {}, [U.el('h2', { text: 'Neuen Worker anlegen' })]);
        const name = U.el('input', { type: 'text', class: 'fld', placeholder: 'z. B. Laptop Niklas' });
        const tags = U.el('input', { type: 'text', class: 'fld', placeholder: 'Fähigkeiten, durch Komma getrennt' });
        for (const f of [name, tags]) f.addEventListener('keydown', (ev) => ev.stopPropagation());
        body.append(F.row('Name', name), F.row('Fähigkeiten', tags));
        const senden = U.el('button', { class: 'btn', text: 'Anlegen' });
        const abbrechen = U.el('button', { class: 'btn', text: 'Abbrechen' });
        body.appendChild(U.el('div', { class: 'modal-actions' }, [abbrechen, senden]));
        const m = GD.ui.modal(body);
        abbrechen.addEventListener('click', () => m.close());

        senden.addEventListener('click', async () => {
          if (!name.value.trim()) { ctx.toast('Name fehlt', 'err'); return; }
          senden.disabled = true;
          try {
            const erg = await bruecke.ruf('/workers', {
              method: 'POST',
              body: { displayName: name.value.trim(), skillTags: tags.value.split(',').map((s) => s.trim()).filter(Boolean) }
            });
            m.close();
            zeigeToken(erg && erg.token);
            await holen(true);
            if (fertig) fertig();
          } catch (e) {
            senden.disabled = false;
            ctx.toast('Anlegen fehlgeschlagen: ' + e.message, 'err');
          }
        });
        name.focus();
      }

      function zeigeToken(token) {
        const body = U.el('div', {}, [
          U.el('h2', { text: 'Worker-Token' }),
          U.el('p', { style: { color: 'var(--text-dim)', lineHeight: '1.6', margin: '0 0 10px' },
            text: 'Dieser Token steht genau einmal hier — der Server kennt danach nur noch seinen Hash. Jetzt in den Worker-PC eintragen.' }),
          U.el('code', { class: 'wk-token', text: token || '(kein Token zurückgekommen)' })
        ]);
        const kopieren = U.el('button', { class: 'btn', text: 'Kopieren' });
        const zu = U.el('button', { class: 'btn', text: 'Schließen' });
        body.appendChild(U.el('div', { class: 'modal-actions' }, [kopieren, zu]));
        const m = GD.ui.modal(body, { dismissable: false });
        zu.addEventListener('click', () => m.close());
        kopieren.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(token || ''); ctx.toast('Token kopiert', 'ok'); }
          catch (e) { ctx.toast('Kopieren nicht möglich — von Hand markieren', 'err'); }
        });
      }

      /* --------------------------------------------------------- Start */

      paint();
      if (ueberServer()) holen(true);
      taktSetzen();

      return {
        el: root,
        getState() { return U.clone(state); },
        setState(next) { if (next) { Object.assign(state, next); paint(); } },
        destroy() { if (uhr) clearInterval(uhr); },

        inspector(host) {
          const F = GD.ui.fields;
          host.appendChild(F.title('Worker (Broweg)'));

          if (!ueberServer()) {
            host.appendChild(F.note('Die Kachel spricht über den GameDesk-Server mit dem bro-server. Aufgerufen über file:// gibt es diesen Weg nicht — GameDesk über „GameDesk starten.bat" öffnen.'));
            return;
          }

          const feld = F.text(brueckeStatus.basis, () => {}, { placeholder: 'http://localhost:4000' });
          host.appendChild(F.row('Server', feld));
          host.appendChild(F.full(F.grid(2, [
            F.btn('Übernehmen', async () => {
              try {
                brueckeStatus = await bruecke.basisSetzen(feld.value.trim());
                ctx.toast('Server übernommen', 'ok');
                await holen(true);
                ctx.refreshInspector();
              } catch (e) { ctx.toast(e.message, 'err'); }
            }),
            F.btn('Jetzt abfragen', () => holen())
          ])));

          host.appendChild(F.row('Anmeldung', U.el('div', {
            text: brueckeStatus.angemeldet ? (brueckeStatus.benutzer || 'angemeldet') : 'nicht angemeldet',
            style: { color: brueckeStatus.angemeldet ? 'var(--ok)' : 'var(--text-faint)' }
          })));
          host.appendChild(F.full(brueckeStatus.angemeldet
            ? F.btn('Abmelden', async () => {
              try { await bruecke.abmelden(); await statusHolen(); paint(); ctx.refreshInspector(); }
              catch (e) { ctx.toast(e.message, 'err'); }
            })
            : F.btn('Anmelden…', () => anmeldeFenster(() => ctx.refreshInspector()))));

          host.appendChild(F.title('Anzeige'));
          host.appendChild(F.row('Abfragetakt', F.num(state.takt, (v) => {
            state.takt = U.clamp(Math.round(v), 0, 600);
            taktSetzen();
          }, { min: 0, max: 600, onCommit: () => ctx.commit('Abfragetakt') })));
          host.appendChild(F.note('Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab; im unsichtbaren Tab wird ohnehin nicht gefragt.'));
          host.appendChild(F.row('Aufgaben zeigen', F.chk(state.zeigeAufgaben, (v) => {
            state.zeigeAufgaben = v; paint(); ctx.commit('Aufgabenliste');
          })));
          host.appendChild(F.row('davon höchstens', F.num(state.maxAufgaben, (v) => {
            state.maxAufgaben = U.clamp(Math.round(v), 1, 50); paint();
          }, { min: 1, max: 50, onCommit: () => ctx.commit('Aufgabenzahl') })));

          host.appendChild(F.title('Worker'));
          host.appendChild(F.full(F.btn('Neuen Worker anlegen…', () => workerAnlegen(() => ctx.refreshInspector()))));
          const daten = state.letzte;
          if (daten && daten.workers.length) {
            const liste = U.el('div', { class: 'insp-liste' });
            for (const w of daten.workers) {
              const z = ZUSTAND[w.status] || ZUSTAND.OFFLINE;
              liste.appendChild(U.el('div', { class: 'insp-liste__zeile' }, [
                U.el('span', { class: 'insp-liste__punkt', style: { background: z.farbe } }),
                U.el('span', { class: 'insp-liste__text', text: w.displayName + ' — ' + z.text }),
                F.btn('widerrufen', async () => {
                  const ok = await GD.ui.confirm('Worker widerrufen?', '„' + w.displayName + '" verliert seinen Token und kann sich nicht mehr verbinden.', 'Widerrufen');
                  if (!ok) return;
                  try { await bruecke.ruf('/workers/' + w.id, { method: 'DELETE' }); await holen(true); ctx.refreshInspector(); }
                  catch (e) { ctx.toast(e.message, 'err'); }
                }, 'btn--sm')
              ]));
            }
            host.appendChild(liste);
          }
          host.appendChild(F.note('Gelesen werden /workers und /tasks des bro-servers. Der GameDesk-Server reicht nur diese Pfade weiter (tools/serve.mjs, ERLAUBT).'));
        }
      };
    }
  });
})();
