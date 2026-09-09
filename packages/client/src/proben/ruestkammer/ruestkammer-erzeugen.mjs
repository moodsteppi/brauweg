/**
 * Erzeugt `ruestkammer-szene.json` — den Vorbereitungsstand, den die Probe
 * `/probe/ruestkammer` durch die ECHTEN Bauteile des Spiels laufen laesst.
 *
 * Aufruf aus dem Wurzelverzeichnis, nachdem `npm run build` gelaufen ist:
 *
 *     node packages/client/src/proben/ruestkammer/ruestkammer-erzeugen.mjs
 *
 * WAS HIER PASSIERT: Es wird eine Partie zu viert mit Bots gespielt — mit dem
 * Spielpaket, nicht mit einer Nachbildung — und MITTEN in der Vorbereitung
 * einer spaeten Runde angehalten. Genau dort steht das, was die Probe zeigen
 * soll: ein ausgebautes Brett, eine besetzte Bank, ein voller Laden und ein
 * Gegner gegenueber. Dieselbe Ueberlegung wie bei `../kampf/kampf-erzeugen.mjs`
 * — zwei von Hand besetzte Bretter zeigen einen Stand, den es im Spiel nicht
 * gibt, und wer die Anzeige daran beurteilt, beurteilt die falsche Sache.
 *
 * ANGEHALTEN WIRD MITTEN IM ZUG DES SITZES, nicht danach: Ein Bot spielt
 * seine Runde bis zu `bereit` durch, und dann ist das Gold weg, der Laden
 * abgegrast und nichts mehr zu entscheiden. Wie viele seiner Zuege gelaufen
 * sind, sucht die Bewertung unten selbst (`ZUEGE_HOECHSTENS`).
 *
 * WAS DIE SZENE ENTHAELT, ist genau die Sicht des Moduls plus die zwei
 * Ableitungen, die am Tisch der Server liefert: welche Ladenplaetze
 * `erlaubteZuege` freigibt und ob Wuerfeln und Aufsteigen erlaubt sind. Die
 * Probe rechnet keine davon nach — sie soll die Anzeige zeigen und nicht eine
 * zweite Regelfassung.
 *
 * WARUM EINE DATEI UND KEIN LAUF ZUR ANZEIGEZEIT: dieselbe Ueberlegung wie
 * dort — der Client importiert aus keinem Spielpaket (CLAUDE.md, "Der Client
 * bildet keine Regel nach"), und `@brauweg/game-tafelrunde` in einem Buendel
 * des Browsers waere genau das. Die Datei ist mitgeliefert und wird nicht beim
 * Bauen erzeugt; dieses Skript ist die Quittung, wie sie entstand.
 *
 * WER AM KATALOG, AN DEN SYNERGIEN ODER AM BOT DREHT, LAESST DAS SKRIPT NOCH
 * EINMAL LAUFEN. Sonst zeigt die Probe weiter einen Stand, den das heutige
 * Spiel gar nicht mehr hervorbringt.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { botZug } from '../../../../game-tafelrunde/dist/src/bot.js';
import {
  BRETT_REIHEN,
  BRETT_SPALTEN,
  DEFAULT_REGELN,
  KATALOG,
  MAX_STUFE,
  SYNERGIEN,
  VERSCHMELZ_ZAHL,
  darfHandeln,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  lebendeSitze,
  loeseKampfAuf,
  sichtFuer,
} from '../../../../game-tafelrunde/dist/src/index.js';

/** Vier Sitze, alle mit derselben Gangart — so misst auch der Messstand. */
const SITZE = [0, 1, 2, 3];
const GANGART = 'normal';

/**
 * Die Runden, in denen gesucht wird.
 *
 * Nicht eine feste: Der Rang waechst mit der Runde und mit ihm die
 * Feldplaetze (LEVEL_TABELLE), gleichzeitig scheiden Sitze aus. Wo dazwischen
 * das vollste Brett MIT Gegenueber steht, haengt an der Saat — deshalb wird
 * es gesucht und nicht geraten.
 */
const RUNDEN = [9, 11, 13, 15, 17];

/** Der Sitz, aus dessen Blick die Ruestkammer gezeigt wird. */
const ICH = 0;

/**
 * Wie weit in den Zug des Sitzes hinein angehalten wird — 0 heisst „direkt
 * nach dem Rundenbeginn, noch kein Kauf". Jeder Halt wird bewertet, der beste
 * gewinnt.
 */
const ZUEGE_HOECHSTENS = 8;

/**
 * Wie viele Saaten durchgesehen werden, bevor die beste genommen wird.
 *
 * 1.200 SEIT DEM 6.9.2026 (vorher 400). Beim ersten Neuerzeugen nach den vier
 * Brettreihen fiel unter 400 Saaten keine Karte mehr an, deren Kauf sofort
 * verschmelzen wuerde — die Bewertung will diesen Stand (12 Punkte, siehe
 * `punkte`), aber wollen genuegt nicht, wenn er in keiner der durchgesehenen
 * Partien vorkommt. Die Probe in ProbeRuestkammer.test.tsx faengt genau das
 * ab, und sie hat es getan. Der Lauf kostet damit rund eine halbe Minute
 * statt zehn Sekunden; er laeuft von Hand und nicht im Bau.
 */
const SAATEN = 1200;

/** Reissleine gegen eine Endlosschleife, wie im Messstand (test/messen.ts). */
const MAX_ZUEGE_JE_SITZ = 200;

/** Spielt eine Partie bis zum Beginn der Vorbereitung der gewuenschten Runde. */
function spieleBisVorbereitung(saat, runde) {
  let p = erstellePartie(DEFAULT_REGELN, SITZE, saat);
  for (let schleife = 0; schleife < 60 && !p.fertig; schleife++) {
    if (p.runde >= runde && p.phase === 'vorbereitung') return p;
    for (const sitz of lebendeSitze(p)) {
      for (let i = 0; i < MAX_ZUEGE_JE_SITZ && darfHandeln(p, sitz); i++) {
        p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz), GANGART));
      }
      if (darfHandeln(p, sitz)) throw new Error(`Sitz ${sitz} meldet sich nicht bereit`);
    }
    if (p.phase !== 'kampf') break;
    p = loeseKampfAuf(p);
  }
  return null;
}

/** Laesst genau `zuege` Bot-Entscheidungen des Sitzes laufen. */
function halteNach(partie, sitz, zuege) {
  let p = partie;
  for (let i = 0; i < zuege; i++) {
    if (!darfHandeln(p, sitz)) return null;
    const zug = botZug(sichtFuer(p, sitz), GANGART);
    // „bereit" beendet die Runde des Sitzes — danach ist nichts mehr zu
    // zeigen, und ein Halt dahinter waere kein Halt mehr.
    if (zug.typ === 'bereit') return null;
    p = fuehreAus(p, sitz, zug);
  }
  return darfHandeln(p, sitz) ? p : null;
}

/**
 * Wie viel ein Stand zeigt.
 *
 * Die Probe soll nicht irgendeinen, sondern einen VOLLSTAENDIGEN Bildschirm
 * zeigen: jede Sorte Wabe, jede Sorte Karte. Was hier nicht gezaehlt wird,
 * sieht spaeter niemand nach — und faellt beim naechsten Umbau als „geht bei
 * uns" durch.
 */
function bewerte(sicht, kaufbar) {
  const e = sicht.eigenes;
  if (!e) return -1;
  const brett = e.brett.filter(Boolean);
  const bank = e.bank.filter(Boolean);
  const laden = e.laden.filter((id) => id !== null);
  const gegner = sicht.gegner.filter((g) => g.ausRunde === null && g.brett.some(Boolean));
  if (brett.length < 4 || laden.length < sicht.ladenPlaetze) return -1;
  if (gegner.length === 0) return -1;
  /*
   * Bank UND Brett muessen beide besetzt UND beide luecken haben. Sonst fehlt
   * der Probe ein Zustand, den es am Tisch dauernd gibt: der leere Bankplatz
   * (`.tr-bankplatz[data-leer]`) und die leere Wabe mit ihrer Ziel-Schaltflaeche
   * (`.tr-wabe-ziel`). Eine volle Bank sieht man in einer Partie selten, und
   * eine Probe, die nur sie zeigt, prueft die Haelfte der Klassen nicht.
   */
  if (bank.length === 0 || bank.length >= sicht.bankPlaetze) return -1;
  if (brett.length >= e.brett.length) return -1;

  const stufen = new Set(brett.map((k) => k.stufe));
  const rollen = new Set(brett.map((k) => einheitVon(k.id).rolle));
  const gesperrt = e.laden.some((id, platz) => id !== null && !kaufbar.includes(platz));
  const zuTeuer = e.laden.some((id) => id !== null && einheitVon(id).kosten > e.gold);
  // Eine Karte, deren Kauf sofort verschmilzt: der auffaelligste Zustand der
  // Karte und der einzige, der sonst nur zufaellig einmal zu sehen ist.
  const bestand = new Map();
  for (const k of [...e.bank, ...e.brett]) {
    if (k && k.stufe === 1) bestand.set(k.id, (bestand.get(k.id) ?? 0) + 1);
  }
  const verschmilzt = e.laden.some(
    (id) => id !== null && VERSCHMELZ_ZAHL - (bestand.get(id) ?? 0) === 1,
  );
  const schwellenTreffer = e.laden.some((id) => {
    if (id === null) return false;
    return einheitVon(id).marken.some((marke) =>
      e.synergien.some((s) => s.marke === marke && s.naechsteSchwelle === s.anzahl + 1),
    );
  });
  const aktiveMarken = e.synergien.filter((s) => s.schwelle !== null).length;

  return (
    brett.length * 2 +
    bank.length +
    rollen.size * 3 +
    (stufen.has(2) ? 6 : 0) +
    (stufen.has(3) ? 10 : 0) +
    // Eine gesperrte Karte ist der Zustand, den man am haeufigsten sieht und
    // am seltensten absichtlich herstellt — sie traegt die Beschriftung
    // „Zu wenig Gold" bzw. „Bank voll" (`Kaufhindernis`).
    (gesperrt ? 10 : 0) +
    (zuTeuer ? 8 : 0) +
    (verschmilzt ? 12 : 0) +
    (schwellenTreffer ? 8 : 0) +
    aktiveMarken * 4 +
    // Ein hoeherer Rang heisst mehr Feldplaetze und damit ein volleres Brett —
    // der Bildschirm, den man in der zweiten Haelfte einer Partie sieht.
    e.level * 2 +
    Math.max(...gegner.map((g) => g.brett.filter(Boolean).length))
  );
}

const NACH_ID = new Map(KATALOG.map((e) => [e.id, e]));
function einheitVon(id) {
  const e = NACH_ID.get(id);
  if (!e) throw new Error(`Einheit ${id} steht nicht im Katalog`);
  return e;
}

/** Der Katalogeintrag, wie die Sicht ihn schickt (sicht.ts im Client). */
function katalogeintrag(id) {
  const e = einheitVon(id);
  return {
    id: e.id,
    name: e.name,
    kosten: e.kosten,
    rolle: e.rolle,
    marken: [...e.marken],
    leben: e.leben,
    angriff: e.angriff,
    tempo: e.tempo,
    reichweite: e.reichweite,
    ruestung: e.ruestung,
  };
}

let beste = null;
for (let n = 0; n < SAATEN; n++) {
  const saat = `probe-ruestkammer-${n}`;
  for (const runde of RUNDEN) {
    const start = spieleBisVorbereitung(saat, runde);
    // Ist die Partie vorher zu Ende, sind auch alle spaeteren Runden weg.
    if (!start) break;
    for (let zuege = 0; zuege <= ZUEGE_HOECHSTENS; zuege++) {
      const p = halteNach(start, ICH, zuege);
      if (!p) break;
      const sicht = sichtFuer(p, ICH);
      const kaufbar = erlaubteZuege(p, ICH)
        .filter((z) => z.typ === 'kaufen')
        .map((z) => z.platz);
      const punkte = bewerte(sicht, kaufbar);
      if (punkte > (beste?.punkte ?? -1)) {
        beste = { punkte, saat, zuege, partie: p, sicht, kaufbar };
      }
    }
  }
}

if (!beste) throw new Error(`Keine der ${SAATEN} Saaten liefert einen brauchbaren Stand`);

const { sicht, kaufbar, partie } = beste;
const eigenes = sicht.eigenes;
/*
 * Der Gegner, den der Bildschirm zeigt: der erste noch lebende. Er wird
 * GESPIEGELT ueber das eigene Brett gestellt (siehe Hexbrett) — das ist der
 * halbe Grund fuer diese Probe, denn nur dort sieht man, ob die Figuren
 * einander wirklich ansehen.
 */
const gegner = sicht.gegner.find((g) => g.ausRunde === null && g.brett.some(Boolean));

const zuege = erlaubteZuege(partie, ICH);
const gebraucht = new Set(
  [
    ...eigenes.brett.filter(Boolean).map((k) => k.id),
    ...eigenes.bank.filter(Boolean).map((k) => k.id),
    ...eigenes.laden.filter((id) => id !== null),
    ...gegner.brett.filter(Boolean).map((k) => k.id),
  ],
);

const szene = {
  saat: beste.saat,
  gangart: GANGART,
  sitze: SITZE,
  /** Wie viele Bot-Zuege des Sitzes gelaufen sind, bevor angehalten wurde. */
  zuegeGespielt: beste.zuege,
  runde: sicht.runde,
  rundenGrenze: sicht.rundenGrenze,
  ich: ICH,
  brettReihen: BRETT_REIHEN,
  brettSpalten: BRETT_SPALTEN,
  ladenPlaetze: sicht.ladenPlaetze,
  bankPlaetze: sicht.bankPlaetze,
  verschmelzZahl: VERSCHMELZ_ZAHL,
  maxStufe: MAX_STUFE,
  eigenes: {
    sitz: eigenes.sitz,
    leben: eigenes.leben,
    gold: eigenes.gold,
    level: eigenes.level,
    einkommen: eigenes.einkommen,
    belegt: eigenes.belegt,
    feldplaetze: eigenes.feldplaetze,
    neuwuerfelnKosten: eigenes.neuwuerfelnKosten,
    aufstiegKosten: eigenes.aufstiegKosten,
    laden: [...eigenes.laden],
    bank: eigenes.bank.map((k) => (k ? { id: k.id, stufe: k.stufe } : null)),
    brett: eigenes.brett.map((k) => (k ? { id: k.id, stufe: k.stufe } : null)),
    synergien: eigenes.synergien.map((s) => ({ ...s })),
  },
  gegner: {
    sitz: gegner.sitz,
    leben: gegner.leben,
    level: gegner.level,
    ausRunde: gegner.ausRunde,
    brett: gegner.brett.map((k) => (k ? { id: k.id, stufe: k.stufe } : null)),
    synergien: gegner.synergien.map((s) => ({ ...s })),
  },
  /* Die drei Ableitungen aus `erlaubteZuege` — am Tisch kommen sie als
     `legalActions` vom Server, und die Probe rechnet sie deshalb ebenso
     wenig nach wie der Bildschirm. */
  kaufbar,
  darfWuerfeln: zuege.some((z) => z.typ === 'neuwuerfeln'),
  darfLevel: zuege.some((z) => z.typ === 'levelAuf'),
  katalog: [...gebraucht].sort().map(katalogeintrag),
  /* Die Werte je Sternstufe, wie die Sicht sie schickt (sicht.ts im Modul) —
     nur fuer die Einheiten, die in dieser Szene vorkommen, wie beim Katalog
     daneben. Die Probe rechnet sie so wenig nach wie der Bildschirm. */
  stufenwerte: Object.fromEntries(
    [...gebraucht].sort().map((id) => [id, sicht.stufenwerte[id].map((w) => ({ ...w }))]),
  ),
  synergieTabelle: SYNERGIEN.map((s) => ({
    marke: s.marke,
    name: s.name,
    /* `wirkung` hat hier bis zum 6.9.2026 gefehlt, und niemandem ist es
       aufgefallen: Das Markenblatt liess den Satz dann still weg. Seit ein
       angetippter Recke sein Blatt aufschlaegt, steht der Satz an zwei
       Stellen — und eine Szene ohne ihn zeigt beide leer. */
    wirkung: s.wirkung,
    stufen: s.stufen.map((st) => ({ schwelle: st.schwelle, bonus: { ...st.bonus } })),
  })),
};

const ziel = fileURLToPath(new URL('./ruestkammer-szene.json', import.meta.url));
writeFileSync(ziel, `${JSON.stringify(szene, null, 2)}\n`);

const stufen = szene.eigenes.brett.filter(Boolean).map((k) => k.stufe);
console.log(
  `${ziel}\n  Saat „${szene.saat}", Runde ${szene.runde}, Sitz ${ICH} nach ` +
    `${szene.zuegeGespielt} Bot-Zuegen (${beste.punkte} Punkte)\n` +
    `  Brett ${stufen.length}/${szene.eigenes.feldplaetze} (Stufen ${[...new Set(stufen)].sort().join('/')}), ` +
    `Bank ${szene.eigenes.bank.filter(Boolean).length}/${szene.bankPlaetze}, ` +
    `Laden ${szene.eigenes.laden.filter(Boolean).length}/${szene.ladenPlaetze} ` +
    `(davon ${szene.kaufbar.length} kaufbar), ${szene.eigenes.gold} Gold\n` +
    `  Marken: ${szene.eigenes.synergien.map((s) => `${s.name} ${s.anzahl}`).join(', ') || 'keine'}\n` +
    `  Gegner Sitz ${szene.gegner.sitz} mit ${szene.gegner.brett.filter(Boolean).length} Einheiten`,
);
