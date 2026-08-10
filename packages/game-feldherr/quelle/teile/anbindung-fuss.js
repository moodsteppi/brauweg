

  // ---- Anbindung ----------------------------------------------------------

  if (typeof korn === 'number') saat(korn);
  // Vor allem anderen: Die Kartenhand steht, bevor die Runde startet —
  // buildHUD und jede Regelpruefung lesen DEFS und CARD_ORDER.
  setzeCharakter(charakter);
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
     * Im Netz sieht jeder nur die eigene Kartenleiste; die des Gegners ist
     * ausgeblendet und das Brett bekommt ihre Höhe (Entscheid vom 7. August
     * 2026). buildHUD fuellt nur das Innere der Leisten neu — display am
     * Container ueberlebt den Rundenstart. display statt hidden, weil
     * Autorenregeln des Spielstils das UA-Stylesheet fuer [hidden] schlagen
     * koennen (gleiche Falle wie beim "Neue Runde"-Knopf).
     */
    const gegnerLeiste = document.getElementById('hud' + (1 - MEIN_SITZ));
    if (gegnerLeiste) gegnerLeiste.style.display = 'none';

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
    // `fremd` und `stand` gehen an die Aufzeichnung: Ohne die Summe der
    // Gegenseite und den Takt, an dem der eigene Lauf stand, ist im Nachhinein
    // nicht zu unterscheiden, ob die Geraete verschieden RECHNEN oder nur
    // verschieden WEIT sind.
    if (aufStrittig) {
      aufStrittig({
        takt: grenze,
        pruef: eigene,
        fremd: fremde,
        stand: taktZaehler,
        grund: 'probe',
      });
    }
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
   * Wissensgrenze und Zielstand des letzten Bildes — nur fuer die
   * Aufzeichnung (netzStand). Sie stehen hier und nicht in der Schleife,
   * weil ein Diagnosewerkzeug sonst genau die Zahl nicht sehen kann, die
   * erklaert, WARUM ein Geraet stehenblieb oder vorlief.
   */
  let letztesWissen = 0;
  let letztesZiel = 0;

  /**
   * Raeumt erledigte Schwebe-Eintraege weg. Ein Eintrag ist erledigt, wenn
   * die GEGENSEITE den Zug hat — nicht schon, wenn der Server ihn hat.
   *
   * Drei Faelle, und jeder hat einen Grund:
   *
   *   1. Kein Echo vom Server: Der Zug ist unterwegs oder wurde abgelehnt.
   *      Nur der Verfall raeumt ihn weg, sonst froere ein abgelehnter Zug
   *      den gemeldeten Stand fuer immer ein.
   *   2. Echo da, Gegenseite zaehlt mit: Sie hat den Zug, sobald ihr
   *      Zugzaehler die Stelle erreicht, an der er in der Liste steht.
   *   3. Echo da, die Gegenseite hat aber schon einmal OHNE Zugzaehler
   *      gepulst (aelterer Client): Rueckfall auf die alte Regel — Echo
   *      genuegt. Sonst wartete dieses Geraet auf eine Meldung, die nie
   *      kommt, und die Partie stuende still.
   *
   * Die Liste ist nach Takt aufsteigend, und `bestaetigt` waechst mit ihr —
   * deshalb genuegt es, vorne abzuraeumen.
   */
  function schwebeAufraeumen(t) {
    while (schwebend.length) {
      const s = schwebend[0];
      if (s.bestaetigt === null) {
        if (t - s.seit > SCHWEBE_VERFALL_MS) {
          schwebend.shift();
          continue;
        }
        break;
      }
      if (gegnerOhneQuittung || gegnerZuege >= s.bestaetigt) {
        schwebend.shift();
        continue;
      }
      break;
    }
  }
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

    /* Vor allem anderen: Was ist erledigt? Beide Deckel unten lesen
     * schwebend[0], und zwischen zwei Pulsen liegen 100 ms — die duerfen
     * sie nicht auf einem veralteten Eintrag stehen. */
    schwebeAufraeumen(t);

    // Herzschlag nach Wanduhr, nicht nach Takt: Auch ein Geraet, das an der
    // Wissensgrenze wartet, muss sich melden — sonst warten am Ende beide.
    if (t - letzterPuls >= PULS_MS) {
      letzterPuls = t;
      let stand = taktZaehler;
      if (schwebend.length) {
        stand = Math.max(0, Math.min(stand, schwebend[0].takt - VORLAUF - MELDE_PUFFER));
      }
      let grenze = Math.floor(taktZaehler / PROBE_TAKTE) * PROBE_TAKTE;
      while (grenze > 0 && !proben.has(grenze)) grenze -= PROBE_TAKTE;
      /* `zuege` ist die Quittung fuer die Gegenseite: So viele Zuege habe
       * ich aus der Liste. Daran erkennt sie, dass ihr Zug hier angekommen
       * ist — und erst dann loest sie ihren Deckel. */
      NETZ.puls({
        takt: stand,
        grenzTakt: grenze,
        pruef: proben.get(grenze) ?? '0',
        zuege: empfangen,
      });
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
    /**
     * Der Absender wartet vor dem EIGENEN schwebenden Zug — die Luecke, die
     * Partien am 7. August 2026 strittig machte: Der Puls-Deckel oben
     * schuetzt nur die GEGENSEITE (sie wartet bei T-4 exakt vor dem Zug),
     * aber deren weiterlaufende Meldungen liessen den Absender selbst bis
     * T+2 rechnen. Kam das Server-Echo des eigenen Zuges spaeter als die
     * ~500 ms zurueck, die der Absender bis T braucht (Funkloch, langsamer
     * Datenbank-Schreiber), fuehrte er ihn verschoben aus, waehrend die
     * Gegenseite ihn puenktlich bei T rechnete — stille Divergenz, Partie
     * strittig, und die Notnagel-Warnung stand nur in der am Handy
     * unsichtbaren Konsole. Deckel: hoechstens bis T-1 rechnen (die
     * Schleife laeuft bis wissen-POLSTER, daher T-1+POLSTER). Normal kehrt
     * das Echo in 100-300 ms zurueck und der Deckel greift nie; bei einer
     * Stoerung stottert die Partie, statt auseinanderzulaufen.
     */
    if (schwebend.length) {
      wissen = Math.min(wissen, schwebend[0].takt - 1 + POLSTER);
    }
    letztesWissen = wissen;
    letztesZiel = ziel;
    if (!document.hidden) antrieb = 'bild';
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
      if (taktZaehler % PROBE_TAKTE === 0) {
        proben.set(taktZaehler, pruefsumme());
        proben.delete(taktZaehler - PROBE_TAKTE * 12);
        pruefeProbe(taktZaehler);
      }
    }
    /**
     * Die Anzeige laeuft in Bildzeit, nicht in Takten.
     *
     * Die Simulation MUSS in festen 50-ms-Schritten rechnen — daran haengt
     * der Gleichschritt. animate() hat damit nichts zu tun: Es bewegt nur
     * Sichtbares (Schrittweg mt, Ausfallschritt atk, Rohrschwenk aim,
     * Aufblitzen, Teilchen, fx-Uhren). Der Kern SCHREIBT diese Werte, liest
     * sie aber nie zurueck, und die Zufallszahlen dafuer kommen aus deko(),
     * nie aus dem Saatkorn — die beiden Geraete duerfen sie also
     * unterschiedlich oft rechnen.
     *
     * Vorher lief animate() im Takt mit: 20-mal je Sekunde, waehrend
     * gezeichnet 60-mal wurde. Jede Bewegung stand also dreimal still und
     * sprang dann — oertlich (dort laeuft animate je Bild) sah dasselbe
     * Spiel fluessig aus, im Netz ruckelte es. Genau das war zu sehen.
     *
     * Beim AUFHOLEN (mehrere Takte in einem Bild, etwa nach einer
     * Selbstheilung) bekommt die Anzeige die Simulationszeit statt der
     * Bildzeit: Sonst blieben die Effekte des Replays liegen und spielten
     * sich danach alle auf einmal ab.
     */
    const bildSek = Math.min(0.05, dt / 1000);
    animate(schritte > 1 ? schritte * (TAKT_MS / 1000) : bildSek);
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
  /**
   * Woran der Kern haengt: 'bild' (requestAnimationFrame), 'worker' oder
   * 'keiner'. Steht hier 'keiner', friert der verdeckte Tab vollstaendig
   * ein — und das steht dann auch im Mitschnitt (netzStand), statt dass
   * man es aus einer Luecke in der Spur erraten muss.
   *
   * Der Fall ist NICHT theoretisch: Ein per Inhaltsrichtlinie verbotener
   * Worker wirft NICHT beim Erzeugen. `new Worker` liefert ein Objekt
   * zurueck, das nie eine Nachricht schickt; der Fehler kommt asynchron
   * ueber onerror. Der Versuch unten faengt deshalb beides ab.
   */
  let antrieb = 'keiner';
  if (NETZ && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const quelle = new Blob(['setInterval(() => postMessage(0), ' + TAKT_MS + ');'], {
        type: 'text/javascript',
      });
      werker = new Worker(URL.createObjectURL(quelle));
      werker.onerror = () => {
        antrieb = 'keiner';
      };
      werker.onmessage = () => {
        /* Nur wenn der Worker wirklich antreibt. Vorher stand die Marke
         * hier oben und wurde alle 50 ms auf 'worker' gesetzt, auch im
         * sichtbaren Tab — als Beleg fuer einen eingefrorenen Tab war sie
         * damit wertlos. */
        if (!laeuft || !document.hidden) return;
        antrieb = 'worker';
        schleife(performance.now());
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
      empfangen += 1;
      /**
       * Der eigene Zug ist vom Server zurueck. Er schwebt trotzdem WEITER —
       * das Echo beweist nur, dass der Server ihn hat, nicht die
       * Gegenseite. Festgehalten wird die Stelle in der Liste: Sobald die
       * Gegenseite meldet, so viele Zuege zu haben, hat sie auch diesen.
       * Dann erst faellt der Deckel (siehe `offeneSchwebe`).
       */
      if (wer === MEIN_SITZ) {
        const eintrag = schwebend.find((s) => s.takt === zug.takt);
        if (eintrag) eintrag.bestaetigt = empfangen;
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
            ' an — die Laeufe gehen auseinander.',
        );
        /**
         * Frueher wurde der Zug verschoben ausgefuehrt und die Divergenz
         * blieb still, bis die Zustandsprobe sie bis zu zwei Sekunden
         * spaeter fand. Jetzt gilt der Gleichlauf sofort als verloren:
         * Der Tisch drueberliegend heilt das per Neustart aus Saatkorn und
         * Server-Zugliste — das Replay fuehrt diesen Zug an seinem echten
         * Takt aus und landet wieder auf dem Stand der Gegenseite.
         */
        if (!strittigGemeldet) {
          strittigGemeldet = true;
          laeuft = false;
          if (aufStrittig) {
            aufStrittig({
              takt: taktZaehler,
              pruef: pruefsumme(),
              grund: 'zugVersatz',
              stand: taktZaehler,
              // Welcher Zug zu spaet kam, von wem, und wie weit die
              // Wissensgrenze stand: Ohne diese vier Zahlen ist im Nachhinein
              // nicht zu sehen, ob der Absender zu frueh geplant oder die
              // Leitung zu lange gebraucht hat.
              zug: { art: zug.art, takt: zug.takt, sitz: wer, r: zug.r, c: zug.c },
              wissen: letztesWissen,
              gegnerStand: gegnerStand[1 - MEIN_SITZ],
            });
          }
        }
        return;
      }
      if (!geplant.has(takt)) geplant.set(takt, []);
      geplant.get(takt).push({ zug, sitz: wer });
    },
    /** Herzschlag der Gegenseite: Takt und juengste Zustandsprobe. */
    pulsAnnehmen(wer, daten) {
      if (wer === MEIN_SITZ || (wer !== 0 && wer !== 1)) return;
      gegnerStand[wer] = Math.max(gegnerStand[wer], daten.takt);
      /**
       * Die Quittung der Gegenseite. Nur nach oben: Pulse koennen sich
       * ueberholen, und ein aelterer duerfte einen schon geloesten Deckel
       * nicht wieder zuziehen.
       *
       * `gegnerZaehlt` merkt sich, dass drueben ueberhaupt gezaehlt wird.
       * Bleibt es falsch, spricht ein aelterer Client, und der Deckel faellt
       * wie frueher schon beim eigenen Echo — lieber die alte Schwaeche als
       * eine Partie, die stillsteht.
       */
      if (typeof daten.zuege === 'number') {
        if (daten.zuege > gegnerZuege) gegnerZuege = daten.zuege;
      } else {
        gegnerOhneQuittung = true;
      }
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
    /**
     * Der Server hat eine Aktion abgewiesen (etwa `partyNotRunning`, waehrend
     * er neu anlaeuft). Der Zug kommt dann nie zurueck.
     *
     * Ohne diesen Weg blieb er vier Sekunden in der Schwebe, deckelte den
     * gemeldeten Stand und liess die Gegenseite warten — fuer einen Zug, den
     * es nicht mehr gibt. Am 10.8.2026 im Mitschnitt gesehen: zwei
     * Kartenlegungen waehrend eines Neustarts, beide still verloren.
     *
     * Weggeraeumt wird NUR, was noch kein Echo hat. Ein bestaetigter Zug ist
     * in der Serverliste; seinen Deckel hier zu loesen, hiesse der
     * Gegenseite zu erlauben, ueber ihn hinwegzurechnen.
     */
    zugVerworfen() {
      let weg = 0;
      for (let i = schwebend.length - 1; i >= 0; i -= 1) {
        if (schwebend[i].bestaetigt === null) {
          schwebend.splice(i, 1);
          weg += 1;
        }
      }
      vorschau = [];
      return weg;
    },
    /**
     * Lesefenster fuer die Aufzeichnung (docs/FELDHERR-DIAGNOSE.md).
     *
     * NUR LESEN, und ausschliesslich Zahlen des Gleichschritts — keine
     * Spielinhalte. Ohne dieses Fenster steht im Fehlerbericht nur "strittig":
     * Die Frage, ob ein Geraet vorlief, an der Wissensgrenze klemmte oder
     * einen eigenen Zug ewig schweben liess, beantworten genau diese Werte,
     * und sie sind sonst im Funktionsscope des Kerns eingeschlossen.
     *
     * `proben` traegt je Taktgrenze die eigene Summe und die der Gegenseite —
     * die erste Grenze, an der sie sich unterscheiden, ist der Tatort.
     */
    netzStand: () => ({
      takt: taktZaehler,
      restMs: Math.round(restMs),
      wissen: letztesWissen === Infinity ? null : letztesWissen,
      ziel: letztesZiel === Infinity ? null : letztesZiel,
      gegnerStand: gegnerStand[1 - MEIN_SITZ],
      /* Nur die Takte: Ein schwebender Zug ist so lange die Bremse des
       * eigenen Geraets, wie er nicht zurueckkommt. */
      schwebend: schwebend.map((s) => s.takt),
      /* Fuer den Mitschnitt: Wie viele Zuege hier angekommen sind, was die
       * Gegenseite quittiert hat, und ob sie ueberhaupt quittiert. Ohne
       * diese drei Zahlen ist ein haengender Deckel nicht von einer
       * stillen Leitung zu unterscheiden. */
      empfangen,
      gegnerZuege,
      gegnerZaehlt: !gegnerOhneQuittung,
      letzterMeldeTakt,
      strittigGemeldet,
      laeuft,
      phase,
      /* 'bild', 'worker' oder 'keiner' — siehe oben. 'keiner' im verdeckten
       * Tab heisst: Dieses Geraet rechnet gerade ueberhaupt nicht. */
      antrieb,
      verdeckt: document.hidden,
      proben: [...proben.keys()]
        .sort((a, b) => a - b)
        .map((g) => [g, proben.get(g), fremdeProben.get(g) ?? null]),
    }),
    /**
     * Lesefenster fuer den 3D-Renderer (Stufe 2, docs/FELDHERR-3D-UMBAU.md):
     * Er liest je Bild den Simulationszustand und interpoliert zwischen den
     * Takten — die Simulation bleibt bei ihren festen Schritten, nur das
     * Bild laeuft weicher. NUR LESEN: Wer ueber dieses Fenster schreibt,
     * faehrt am Gleichschritt vorbei, und die Partie wird strittig.
     * `restAnteil` ist der Anteil des schon verstrichenen naechsten Takts
     * (0..1) — der Interpolationsfaktor zwischen zwei Simulationsstaenden.
     */
    lesen: () => ({
      zustand: G,
      phase,
      spiegel: SPIEGEL,
      takt: taktZaehler,
      restAnteil: Math.max(0, Math.min(1, restMs / TAKT_MS)),
      /* Abgeleitete Werte fuer Lebensbalken und Bereitschaftsring — die
       * Formeln (Fels, Hausausbau, Stufen) bleiben im Kern, der Renderer
       * rechnet nichts nach. */
      maxLeben: maxHp,
      marschDauer: mcdOf,
      beweglich: canMove,
      schlagDauer: cdOf,
      kannSchlagen: canAtt,
      /* Laufzeit des Werks in Sekunden (0 bei allem anderen) — mit e.leben
       * ergibt das den Laufzeitbalken. */
      laufzeitVon: (e) => statsOf(e.type, e.lvl).laufzeit || 0,
      /* Dauer eines Schrittes: Damit interpoliert die 3D-Buehne den Marsch
       * zwischen zwei Feldern genauso wie entXY in 2D. */
      marschZeit: MOVE_T,
      /* Erschuetterung (Einschlaege, Explosionen). Staerke in Pixeln des
       * 2D-Renderers, Rest in Sekunden. */
      erschuetterung: () => ({ staerke: shakeA, rest: shakeT }),
      /* Bodenmarkierungen als Liste — welche Felder hervorgehoben gehoeren,
       * ist eine Regelfrage. 2D und 3D lesen dieselbe Quelle (markenListe). */
      feldMarken: markenListe,
      /* Hinweisschilder (Reichweitengewinn, Erdwaerme, Walddeckung, Preis,
       * Sprengradius) — dieselbe Liste zeichnet der 2D-Renderer. */
      schilder: schildListe,
      /* Bauvorschau: was gerade gezogen wird und wohin es faellt. Daraus
       * stellt die 3D-Buehne ein durchscheinendes Modell aufs Zielfeld.
       * `ok` heisst: Platz frei UND bezahlbar. */
      bauVorschau: () => {
        const liste = [];
        for (const d of drags.values()) {
          if (!d.prev || !d.prev.cells || !d.prev.cells.length) continue;
          liste.push({
            art: d.k,
            own: d.own,
            ok: !!d.prev.ok,
            merge: !!d.prev.merge,
            stufe: d.prev.merge ? Math.min(maxLvlOf(d.k), (d.k === 'mauer'
                     ? mauerGewicht(d.prev.merge) + 1 : d.prev.merge.lvl + 1)) : 1,
            cells: d.prev.cells.map((p) => ({ r: p.r, c: p.c })),
          });
        }
        return liste;
      },
      /* Partikel (Rauch, Funken, Staub, Splitter, Glut). Sie leben in PT,
       * nicht in G — reine Deko, nie Spielzufall. Ihre Physik treibt
       * updatePT() aus animate(), also im RECHENpfad: Die 3D-Buehne
       * bekommt sie auch dann, wenn der 2D-Renderer gar nicht zeichnet. */
      partikel: PT,
      /* Das Raster des 2D-Renderers. Partikel tragen Bildschirmkoordinaten
       * (burst wird mit midX/midY gerufen); damit rechnet die 3D-Buehne
       * sie in Brettkoordinaten zurueck. Wird je Bild frisch gelesen, weil
       * resize() die Werte aendert. */
      raster: () => ({ ox: OX, oy: OY, tw: TW, th: TH }),
      /* Taktzeiten des Muenzwurfs (Flug, Aufschlag, Anzeige) — damit die
       * 3D-Buehne dieselbe Uhr benutzt wie coinTick und nicht daneben laeuft. */
      muenze: MUENZE,
      /* Eigener Sitz, soweit es einen gibt: im Netz der zugewiesene, gegen
       * die KI der menschliche. Zu zweit am Geraet gehoert das Brett beiden —
       * dann null, und die Anzeige spricht von Spieler 1 und 2 statt von "du". */
      eigenerSitz: NETZ ? MEIN_SITZ : (AI ? 1 - AI.owner : null),
      /* Stellungen der Gruppe, zu der dieses Objekt gehoert: n von max.
       * Truppen ohne Gruppe (Bauten) liefern null. */
      stellungsStand: (e) => {
        const gruppe = gruppeVon(e);
        return gruppe
          ? { n: stellungen(e.owner, gruppe), max: stellungsGrenze(e.owner, gruppe), gruppe }
          : null;
      },
    }),
    /**
     * Zeiger-Abbildung der 3D-Ansicht setzen (oder mit null loesen): Sie
     * uebersetzt Bildschirmkoordinaten per Strahl auf die Brettebene in
     * Brettzellen. Solange sie gesetzt ist, laeuft JEDE Zeigereingabe der
     * Spieldatei darueber — die Befehle selbst bleiben unveraendert, es
     * aendert sich nur, welche Zelle unter dem Finger liegt.
     */
    zeigerAbbildung(fn) {
      zeigerZuZelle = fn;
    },
  };
}
