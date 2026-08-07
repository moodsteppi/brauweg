

  // ---- Anbindung ----------------------------------------------------------

  if (typeof korn === 'number') saat(korn);
  feldKey = feld;
  aiLevel = stufe;
  ovMenu.hidden = true;                 // der Bildschirm hat schon gefragt

  /**
   * Im Netzspiel wird nicht ausgefuehrt, sondern gemeldet — auch beim
   * Absender. Nur wenn beide Geraete denselben Befehl im selben Takt
   * ausfuehren, bleiben die Laeufe gleich. Die *Sofort-Fassungen fuehren aus;
   * sie gehoeren fuehreAus und niemandem sonst.
   */
  const legeSofort = playCard;
  playCard = function (own, k, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      melden({ art: 'karte', karte: k, r, c });
      return;
    }
    legeSofort(own, k, r, c);
  };

  const hausSofort = setzeHaus;
  setzeHaus = function (own, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      melden({ art: 'haus', r, c });
      return;
    }
    hausSofort(own, r, c);
  };

  const haltSofort = haltBefehl;
  haltBefehl = function (own, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      melden({ art: 'halt', r, c });
      return;
    }
    haltSofort(own, r, c);
  };

  const abrissSofort = abrissBefehl;
  abrissBefehl = function (own, r, c) {
    if (NETZ && own === MEIN_SITZ) {
      melden({ art: 'abriss', r, c });
      return;
    }
    abrissSofort(own, r, c);
  };

  const drehSofort = drehBefehl;
  drehBefehl = function (own) {
    if (NETZ && own === MEIN_SITZ) {
      melden({ art: 'drehen' });
      return;
    }
    drehSofort(own);
  };

  /**
   * Muenzwurf: Die Wahl verbraucht Spielzufall (Ergebniswurf) und MUSS deshalb
   * auf beiden Geraeten im selben Takt fallen. Das Overlay schliesst sofort —
   * die Wahl gilt, sobald der Takt sie erreicht.
   */
  const wahlSofort = coinWahl;
  coinWahl = function (w) {
    if (NETZ && G && G.coin && G.coin.stufe === 'wahl' && G.coin.waehler === MEIN_SITZ) {
      melden({ art: 'muenze', wahl: w });
      coinAus();
      return;
    }
    wahlSofort(w);
  };

  function fuehreAus(zug, wer) {
    if (zug.art === 'karte') legeSofort(wer, zug.karte, zug.r, zug.c);
    else if (zug.art === 'haus') hausSofort(wer, zug.r, zug.c);
    else if (zug.art === 'halt') haltSofort(wer, zug.r, zug.c);
    else if (zug.art === 'abriss') abrissSofort(wer, zug.r, zug.c);
    else if (zug.art === 'drehen') { drehSofort(wer); }
    else if (zug.art === 'muenze') wahlSofort(zug.wahl);
  }

  if (NETZ) {
    /**
     * Im Netz darf nur der eigene Sitz bedient werden. Ohne diese Sperre
     * liesse sich die Karte des Gegners ziehen — oertlich ausgefuehrt, dem
     * anderen Geraet nie gemeldet, und beide rechneten verschiedene Partien.
     */
    darfBedienen = (own) => own === MEIN_SITZ;
    /** Niemand sitzt gegenueber — kopfstehende Hinweise gibt es nur am geteilten Geraet. */
    ueberKopf = () => false;

    /**
     * Sitz 0 bekommt das Brett gespiegelt: Jeder verteidigt unten. Muss vor
     * startRound stehen, denn resize und bakeStatic backen die Buehne mit
     * der Spiegelung; die Klasse tauscht zusaetzlich die Kartenleisten.
     */
    if (MEIN_SITZ === 0) {
      SPIEGEL = true;
      const app = document.getElementById('app');
      if (app) app.classList.add('gespiegelt');
    }

    /**
     * Pause gibt es im Netz nicht: update() stuende still, waehrend der Takt
     * weiterlaeuft, und das Geraet ueberspraenge Rechenschritte, die die
     * Gegenseite ausfuehrt. Das Menue oeffnet nur noch das Overlay.
     */
    on('menuBtn', () => { if (phase !== 'menu' && phase !== 'over') ovPause.hidden = false; });
    on('bResume', () => { ovPause.hidden = true; });
    on('bQuit', () => { ovPause.hidden = true; if (NETZ.aufgabe) NETZ.aufgabe(); });
    /**
     * Der Tisch ist nach der Partie zu — eine neue Runde gibt es hier nicht.
     * display statt hidden: Die Regel .btn{display:block} des Spielstils
     * schlaegt das UA-Stylesheet fuer [hidden], der Knopf bliebe sichtbar.
     */
    const nochmal = document.getElementById('bAgain');
    if (nochmal) nochmal.style.display = 'none';
    on('bMenu2', () => { if (NETZ.verlassen) NETZ.verlassen(); });
  }

  startRound(modus === 'ki');

  /**
   * Zustandsprobe.
   *
   * Absichtlich grob und billig: Ressourcen, Objektzahl und die Kernwerte
   * jedes Objekts. Feiner waere teurer, ohne mehr zu finden — was
   * auseinanderlaeuft, laeuft in diesen Zahlen auseinander.
   */
  function pruefsumme() {
    if (!G) return '0';
    let h = 2166136261;
    const misch = (s) => {
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
    };
    misch(Math.round(G.res[0]) + ':' + Math.round(G.res[1]) + ':' + G.ents.length);
    for (const e of G.ents) {
      misch(e.type + e.owner + e.r + ',' + e.c + ':' + e.lvl + ':' + Math.round(e.hp));
    }
    return (h >>> 0).toString(36);
  }

  /**
   * Probenvergleich an einer 40er-Grenze. Beide Seiten melden ihre Summe mit
   * dem Herzschlag; stimmen sie an derselben Grenze nicht ueberein, sind die
   * Laeufe auseinander. Dann ist jede weitere Minute gespielte Luege —
   * die Partie endet sofort als strittig, auf beiden Geraeten.
   */
  function pruefeProbe(grenze) {
    if (strittigGemeldet) return;
    const eigene = proben.get(grenze);
    const fremde = fremdeProben.get(grenze);
    if (eigene === undefined || fremde === undefined || eigene === fremde) return;
    strittigGemeldet = true;
    laeuft = false;
    if (aufStrittig) aufStrittig({ takt: grenze, pruef: eigene });
  }

  const alterSchluss = showWin;
  showWin = function () {
    alterSchluss();
    if (aufEnde) {
      aufEnde({
        sieger: G && G.winner,
        gewonnen: modus === 'ki' ? G && G.winner === 1 : null,
        gegenKI: modus === 'ki',
        stufe: modus === 'ki' ? stufe : null,
        dauer: G ? G.t : 0,
        feld,
        takt: taktZaehler,
        pruef: pruefsumme(),
      });
    }
  };

  proben.set(0, pruefsumme());

  /**
   * Bildschleife.
   *
   * Oertlich wie gehabt. Im Netzspiel wird die verstrichene Zeit in feste
   * Takte zerlegt, gerechnet aber hoechstens bis zur Wissensgrenze: dem
   * letzten gemeldeten Takt der Gegenseite plus Vorlauf. Ein Rueckstand
   * (Neuladen, Tab im Hintergrund) wird ohne Uhr aufgeholt, bis zu zehn
   * Takte je Bild — die Uhr kaeme nie hinterher, denn ihr Guthaben ist auf
   * zwei Takte gedeckelt, damit ein Aussetzer die Partie nicht beschleunigt.
   */
  let letzte = 0;
  let letzterPuls = 0;
  /**
   * Nie mehr als eine Bildanforderung offen halten: Im verdeckten Tab feuert
   * requestAnimationFrame nicht, sammelt Anforderungen aber — beim
   * Sichtbarwerden kaeme sonst eine ganze Salve auf einmal.
   */
  let bildOffen = false;
  const naechstesBild = () => {
    if (bildOffen) return;
    bildOffen = true;
    requestAnimationFrame((t) => {
      bildOffen = false;
      schleife(t);
    });
  };
  const schleife = (t) => {
    if (!laeuft) return;
    if (!NETZ) { loop(t); naechstesBild(); return; }

    const dt = letzte ? Math.min(500, t - letzte) : 0;
    letzte = t;
    restMs = Math.min(restMs + dt, TAKT_MS * 2);

    // Herzschlag nach Wanduhr, nicht nach Takt: Auch ein Geraet, das an der
    // Wissensgrenze wartet, muss sich melden — sonst warten am Ende beide.
    if (t - letzterPuls >= PULS_MS) {
      letzterPuls = t;
      // Vom Server abgelehnte Zuege kommen nie zurueck — nach dem Verfall
      // geben sie den Stand wieder frei, statt ihn fuer immer einzufrieren.
      while (schwebend.length && t - schwebend[0].seit > SCHWEBE_VERFALL_MS) {
        schwebend.shift();
      }
      let stand = taktZaehler;
      if (schwebend.length) {
        stand = Math.max(0, Math.min(stand, schwebend[0].takt - VORLAUF - MELDE_PUFFER));
      }
      let grenze = Math.floor(taktZaehler / PROBE_TAKTE) * PROBE_TAKTE;
      while (grenze > 0 && !proben.has(grenze)) grenze -= PROBE_TAKTE;
      NETZ.puls({ takt: stand, grenzTakt: grenze, pruef: proben.get(grenze) ?? '0' });
    }

    // Die Grenze nutzt Vorlauf UND Meldepuffer: Die Gegenseite plant ihre
    // Zuege bei mindestens Stand+VORLAUF+MELDE_PUFFER, und der Puls-Deckel
    // oben garantiert, dass kein gemeldeter Stand einen noch schwebenden
    // Zug ueberholt. Eine engere Grenze verschenkte vier Takte und liess
    // die Simulation im Netz spuerbar stottern.
    let wissen = Infinity;
    let ziel = Infinity;
    for (const s of [0, 1]) {
      if (s === MEIN_SITZ) continue;
      wissen = Math.min(wissen, gegnerStand[s] + VORLAUF + MELDE_PUFFER - 1);
      ziel = Math.min(ziel, gegnerStand[s]);
    }

    let schritte = 0;
    // Drei Takte Vorrat hinter der Wissensgrenze: Kommt ein Puls einen
    // Wimpernschlag zu spaet (Funkjitter), zehrt die Schleife vom Polster,
    // statt sichtbar stehenzubleiben. Ohne Polster stotterte die Partie im
    // Rhythmus des Netzes — als Eingabe-Lag gefuehlt, obwohl es die
    // Simulation war, die klemmte.
    const POLSTER = 3;
    while (schritte < 10 && taktZaehler < wissen - POLSTER && laeuft) {
      if (taktZaehler < ziel) {
        // Rueckstand: aufholen, ohne die Uhr zu fragen.
      } else if (restMs >= TAKT_MS) {
        restMs -= TAKT_MS;
      } else break;
      taktZaehler += 1;
      schritte += 1;
      const faellig = geplant.get(taktZaehler);
      if (faellig) {
        for (const { zug, sitz: wer } of faellig) fuehreAus(zug, wer);
        geplant.delete(taktZaehler);
      }
      if (phase === 'coin') coinTick(TAKT_MS / 1000);
      update(TAKT_MS / 1000);
      animate(TAKT_MS / 1000);
      if (taktZaehler % PROBE_TAKTE === 0) {
        proben.set(taktZaehler, pruefsumme());
        proben.delete(taktZaehler - PROBE_TAKTE * 12);
        pruefeProbe(taktZaehler);
      }
    }
    if (vorschau.length) vorschau = vorschau.filter((v) => v.takt > taktZaehler);
    if (!document.hidden) {
      render();
      for (const v of vorschau) tileMark(v.r, v.c, sh(COL.p[MEIN_SITZ], 1), 0.3, true);
    }
    naechstesBild();
  };
  naechstesBild();

  /**
   * Antrieb fuer den verdeckten Tab.
   *
   * Dort feuert requestAnimationFrame gar nicht und setInterval nur einmal
   * je Sekunde — der Kern staende still, wuerde nicht mehr pulsen, und die
   * Partie froere auf BEIDEN Geraeten ein. Am Handy passiert genau das bei
   * jedem kurzen Blick woandershin. Timer in einem Web Worker drosselt der
   * Browser nicht; seine Nachrichten treiben die Schleife weiter, solange
   * der Tab verdeckt ist. Gezeichnet wird dabei nichts.
   */
  let werker = null;
  if (NETZ && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const quelle = new Blob(['setInterval(() => postMessage(0), ' + TAKT_MS + ');'], {
        type: 'text/javascript',
      });
      werker = new Worker(URL.createObjectURL(quelle));
      werker.onmessage = () => {
        if (laeuft && document.hidden) schleife(performance.now());
      };
    } catch {
      werker = null;   // strenge CSP: dann friert der verdeckte Tab wie zuvor
    }
  }

  return {
    beenden() {
      laeuft = false;
      paused = true;
      if (werker) werker.terminate();
      // Die Fenster-Horcher der Spieldatei muessen mit der Sitzung sterben:
      // Ein zurueckgebliebenes resize griff nach dem Verlassen auf die
      // abgeraeumte Buehne, und die Fehlerbox der Spieldatei stand im Hub.
      horcherAbhaengen();
      const box = document.getElementById('errbox');
      if (box) box.remove();
    },
    /** Ein Zug vom Server — eigener wie fremder. */
    zugAnnehmen(zug, wer) {
      // Der eigene Zug ist zurueck: Er schwebt nicht mehr, der Herzschlag
      // darf wieder den vollen Stand melden.
      if (wer === MEIN_SITZ) {
        const i = schwebend.findIndex((s) => s.takt === zug.takt);
        if (i >= 0) schwebend.splice(i, 1);
      }
      // Aus einem fremden Zug wird BEWUSST kein Gegnerstand abgeleitet.
      // Geplant wird er bei max(eigener Takt, Gegnerstand) plus Vorlauf —
      // zug.takt minus Vorlauf ist also KEINE Untergrenze der Gegnerposition,
      // sondern oft eine Ueberschaetzung. Die hat auf Produktion einen
      // Teufelskreis gedreht: Beide Geraete "holten" auf den jeweils
      // ueberschaetzten Stand des anderen auf, die Partie rannte der
      // Echtzeit davon (Ressourcen schneller als die angezeigte Rate), der
      // Dauersprint mit zehn Takten je Bild ruckelte, und am Ende kamen
      // Zuege zu spaet an und die Partie wurde strittig. Den Gegnerstand
      // kennen allein die Herzschlaege — die melden den echten Taktzaehler.
      //
      // Notnagel: Ein Zug fuer einen schon gerechneten Takt duerfte dank
      // Wissensgrenze und Meldepuffer nie eintreffen. Faellt er doch, wird er
      // verspaetet ausgefuehrt und die Zustandsprobe deckt die Abweichung in
      // Sekunden auf — aber laut, nicht still: Die Warnung nennt die Ursache,
      // die im Strittig-Banner sonst unsichtbar bliebe.
      const takt = Math.max(zug.takt, taktZaehler + 1);
      if (takt !== zug.takt) {
        console.warn(
          'feldherr: Zug fuer Takt ' + zug.takt + ' kam erst bei ' + taktZaehler +
            ' an — verschoben ausgefuehrt, die Laeufe gehen auseinander.',
        );
      }
      if (!geplant.has(takt)) geplant.set(takt, []);
      geplant.get(takt).push({ zug, sitz: wer });
    },
    /** Herzschlag der Gegenseite: Takt und juengste Zustandsprobe. */
    pulsAnnehmen(wer, daten) {
      if (wer === MEIN_SITZ || (wer !== 0 && wer !== 1)) return;
      gegnerStand[wer] = Math.max(gegnerStand[wer], daten.takt);
      // Auch die Probe an Grenze 0 vergleichen: Sie entsteht direkt nach dem
      // Rundenstart und entlarvt ein falsches Saatkorn schon nach 200 ms
      // statt erst am Ende der Partie.
      if (daten.pruef) {
        fremdeProben.set(daten.grenzTakt, daten.pruef);
        pruefeProbe(daten.grenzTakt);
      }
    },
    takt: () => taktZaehler,
    pruefsumme,
  };
}
