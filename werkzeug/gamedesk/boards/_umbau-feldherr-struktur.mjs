/* Feldherr in die Struktur der neuen Tafel bringen.
 *
 * Vorlage ist `Unbenanntes Board.gamedesk.json` — dort hat der Auftraggeber
 * das Gerüst gebaut: acht Themenflächen, zweidimensional angeordnet, alle
 * laufen unten in „Technische Umsetzung". Verschachtelte Rahmen sind neutral
 * grau, nur die oberste Ebene ist farbig. Innerhalb einer Fläche wiederholt
 * sich ein Muster — bei den Karten etwa 2D-Aufnahme, 3D-Modell, Werte.
 *
 * Dieses Skript ordnet den vorhandenen Feldherr-Inhalt genau so an. Es legt
 * nichts weg: Alle 3D-Modelle, Aufnahmen, Wireframes, Notizen und
 * Quelltextausschnitte bekommen einen Platz. Neu geschrieben wird nur, was
 * die Struktur verlangt und bisher fehlte (Ziel, Geländearten einzeln,
 * Core Mechanics, Generierung).
 *
 * Die Feinhöhen setzt danach GD.layout im Browser.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* Pfad aus dem eigenen Ort ableiten — das Skript läuft in jedem Checkout. */
const HIER = dirname(fileURLToPath(import.meta.url));

const DATEI = join(HIER, 'feldherr-funktionsweise.gamedesk.json');
const doc = JSON.parse(readFileSync(DATEI, 'utf8'));

let n = 0;
const uid = (p) => p + '_s' + (++n).toString(36);

const nachTitel = new Map();
for (const w of doc.windows) if (w.type !== 'frame') nachTitel.set(w.title, w);
const W = (t) => {
  const w = nachTitel.get(t);
  if (!w) throw new Error('Fenster fehlt: ' + t);
  return w;
};
const gibt = (t) => nachTitel.has(t);

/* Alte Rahmen und alte Pfeile weg — die Gliederung ist eine andere. */
doc.windows = doc.windows.filter((w) => w.type !== 'frame');
doc.connections = [];

/* Die beiden Abschnittsüberschriften der alten Gliederung sind überflüssig:
   Ihre Titel stehen jetzt an den Flächen selbst. */
for (const t of ['Gamedesign', 'Technische Umsetzung']) {
  doc.windows = doc.windows.filter((w) => w.title !== t);
  nachTitel.delete(t);
}

/* ===================================================================== */
/* Werkzeug                                                              */
/* ===================================================================== */

const RAND = 44;            // Luft zwischen Rahmenkante und Inhalt
const KOPF = 114;           // Kopfband mit Untertitel (gemessen)
const KOPF_OHNE = 93;       // Kopfband ohne Untertitel — der Rahmen ist flacher
const LUFT = 28;            // zwischen zwei Kacheln
const SPALTE = 34;          // zwischen Spalten ohne Pfeile
const GASSE = 460;          // zwischen Spalten, zwischen denen Pfeile laufen
const NEUTRAL = '#94a3b8';  // Farbe jedes verschachtelten Rahmens

/* Welcher Bereich gilt gerade? Ein verschachtelter Rahmen erbt ihn von seiner
   Fläche — die Taxonomie soll lückenlos bleiben, ohne ihn überall zu wieder-
   holen. */
let BEREICH = null;

const rahmen = [];

/*
 * Buchhaltung statt Geometrie.
 *
 * Jede Fläche wird zuerst im Ursprung gebaut und danach an ihren Platz
 * gestellt. Wer dabei mitwandert, darf NICHT über die Lage bestimmt werden —
 * beim Bauen liegen alle Flächen übereinander, und eine Lageprüfung griffe
 * quer durch fremde Flächen. Stattdessen merkt sich jede Fläche, was in ihr
 * angelegt oder gesetzt wurde.
 */
let AKT = null;
const MITGLIEDER = new Map();      // Flächenname -> Set

function merk(w) {
  if (AKT && w) MITGLIEDER.get(AKT).add(w);
}

function flaeche(name, bereich, bau) {
  AKT = name; BEREICH = bereich;
  MITGLIEDER.set(name, new Set());
  const f = bau();
  AKT = null; BEREICH = null;
  return f;
}

/* Legt die Kachel an — oder schreibt die vorhandene fort. So laesst sich das
   Skript zweimal laufen (einmal fuer die Anordnung, einmal nachdem der Browser
   die Texthoehen gemessen hat), ohne Dubletten zu erzeugen. */
function notiz(titel, html, opt = {}) {
  const text = html.replace(/^\n/, '').replace(/\s+$/, '');
  const da = nachTitel.get(titel);
  if (da) {
    da.state.html = text;
    if (opt.fontSize) da.state.fontSize = opt.fontSize;
    if (opt.w) da.w = opt.w;
    if (opt.accent) da.accent = opt.accent;
    return da;
  }
  const w = {
    id: uid('win'), type: 'notes', title: titel,
    x: 0, y: 0, w: opt.w || 380, h: opt.h || 300, z: 0,
    accent: opt.accent || '#6ea8fe', collapsed: false,
    state: { html: text, fontSize: opt.fontSize || 13 }
  };
  doc.windows.push(w);
  nachTitel.set(titel, w);
  return w;
}

function umbenennen(alt, neu) {
  if (!nachTitel.has(alt)) return nachTitel.get(neu) || null;   // schon umbenannt
  const w = W(alt);
  nachTitel.delete(alt);
  w.title = neu;
  nachTitel.set(neu, w);
  return w;
}

/** Spalten nebeneinander, Kacheln darin untereinander. Liefert den Kasten. */
function setze(x0, y0, spalten, gasse) {
  const abstand = gasse === undefined ? SPALTE : gasse;
  let x = x0, x2 = x0, y2 = y0;
  for (const spalte of spalten) {
    let y = y0, breite = 0;
    for (const eintrag of spalte) {
      const k = typeof eintrag === 'string' ? W(eintrag) : eintrag;
      k.x = Math.round(x);
      k.y = Math.round(y);
      merk(k);
      y += (k.h || 0) + LUFT;
      breite = Math.max(breite, k.w);
    }
    x += breite + abstand;
    x2 = Math.max(x2, x - abstand);
    y2 = Math.max(y2, y - LUFT);
  }
  return { x: x0, y: y0, w: x2 - x0, h: y2 - y0 };
}

/** Rahmen um einen Kasten — mit Kopfband oben. */
function lege(titel, kasten, opt = {}) {
  const kopf = opt.note ? KOPF : KOPF_OHNE;
  const f = {
    id: uid('win'), type: 'frame', title: titel,
    x: Math.round(kasten.x - RAND),
    y: Math.round(kasten.y - RAND - kopf),
    w: Math.round(kasten.w + RAND * 2),
    h: Math.round(kasten.h + RAND * 2 + kopf),
    z: opt.z || 4, accent: opt.tint || NEUTRAL, collapsed: false,
    state: {
      tint: opt.tint || NEUTRAL, strength: opt.strength || 0.075,
      dashed: false, note: opt.note || '', bereich: opt.bereich || BEREICH || null
    }
  };
  rahmen.push(f);
  merk(f);
  return f;
}

/** Kasten um mehrere Kästen/Rahmen */
function huelle(teile) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const t of teile) {
    x1 = Math.min(x1, t.x); y1 = Math.min(y1, t.y);
    x2 = Math.max(x2, t.x + t.w); y2 = Math.max(y2, t.y + t.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/* ===================================================================== */
/* Neue Inhalte, die die Struktur verlangt                               */
/* ===================================================================== */

/* Bestehende Kacheln, deren Name in der neuen Gliederung anders heißen muss */
umbenennen('2D und 3D — was ist was?', '2D und 3D — was ist was');
umbenennen('Gelände', 'Gelände — Überblick');
/* Die Beschreibung heißt jetzt nach ihrer Wirkung — der Rahmen daneben trägt
   den Namen des Blocks, und zwei Dinge dürfen nicht gleich heißen. */
umbenennen('See', 'See — Wirkung');
umbenennen('Gebirge (Fels)', 'Gebirge — Wirkung');
umbenennen('Wald', 'Wald — Wirkung');
umbenennen('Vulkan', 'Vulkan — Wirkung');

notiz('Ziel und Sieg', `
<h2>Ein Brett, zwei Hälften, ein Ziel</h2>
<p><b>Wer das gegnerische Haupthaus einreißt, gewinnt.</b> Das ist die ganze
Siegbedingung — es gibt keine Punkte, keine Zeitwertung, kein Unentschieden
durch Ablauf.</p>
<p>Gespielt wird in <b>Echtzeit</b>: kein Zugwechsel, keine Runden. Beide
handeln durchgehend gleichzeitig, das Brett rechnet zwanzigmal je Sekunde
weiter — auch wenn niemand etwas tut.</p>
<p>Aufgeben und den Tisch verlassen zählen wie ein gefallenes Haupthaus.
<b>Wer geht, verliert.</b></p>`, { accent: '#b78cf7', w: 420, h: 360, fontSize: 13.5 });

notiz('Generierung', `
<p>Das Gelände wird <b>je Partie neu gewürfelt</b> — aus dem Saatkorn, das
beide Geräte teilen. Vier Sorten werden nacheinander gestreut: See, Gebirge,
Wald, Vulkan.</p>
<p><b>Punktgespiegelt.</b> Was auf der einen Hälfte liegt, liegt auf der
anderen an der gespiegelten Stelle. Keine Seite bekommt das bessere Brett —
und niemand kann sich über die Karte beschweren.</p>
<p>Zwei Prüfungen laufen mit: Höchstens <b>45 %</b> der eigenen Hälfte darf
zugebaut sein, und das Brett muss <b>durchgehend begehbar</b> bleiben. Fällt
eine Verteilung durch, wird sie verworfen und neu gewürfelt.</p>
<p style="color:#8a93a5">Jede Änderung an der Streuung ändert jede Partie mit
demselben Saatkorn. Im Netzspiel heißt das: beide Geräte müssen dieselbe
Fassung fahren.</p>`, { accent: NEUTRAL, w: 400, h: 380 });

notiz('See — Wirkung', `
<h3>See</h3>
<p><b>Unpassierbar.</b> Truppen gehen außen herum, gebaut wird nicht darauf.</p>
<p>Schüsse fliegen darüber hinweg — der See versperrt den Weg, nicht die
Sicht. Er teilt das Brett in Gassen und entscheidet damit, wo überhaupt
gekämpft wird.</p>`, { accent: '#6ea8fe', w: 340, h: 260 });

notiz('Gebirge — Wirkung', `
<h3>Gebirge · Fels</h3>
<p><b>Unpassierbar und sichtdicht.</b> Es schluckt sogar den Kanonenschuss —
das einzige Gelände, das eine Schussbahn ganz beendet.</p>
<p><b>Aber bebaubar:</b> Bogen, Kanone und Werk dürfen hinauf. Der Unterbau
kostet jedes Mal <b>+5</b>.</p>
<p>Damit ist der Fels das einzige Feld, das gleichzeitig Hindernis und
Stellung ist — siehe „Fels-Stellungen".</p>`, { accent: NEUTRAL, w: 340, h: 300 });

notiz('Wald — Wirkung', `
<h3>Wald</h3>
<p>Deckung statt Sperre — begehbar, aber er verändert jeden, der darin steht:</p>
<ul>
<li>Truppen <b>+50 % Leben</b>, <b>+25 % Schaden</b></li>
<li>Fernkämpfer <b>−1 Reichweite</b> — im Dickicht fehlt die Sicht</li>
<li>Kanone <b>−25 %</b>, Haupthaus <b>−20 %</b> erlittener Schaden</li>
<li>Der Bogen wird zum <b>Turm</b> (Gerüst +4): −1/3 Schaden, unbeweglich</li>
</ul>
<p>Der Wald ist die Antwort auf Übermacht: Wenige, die darin stehen, halten
gegen viele im Offenen.</p>`, { accent: '#57c98a', w: 340, h: 340 });

notiz('Vulkan — Wirkung', `
<h3>Vulkan</h3>
<p>Das einzige Gelände, das sich <b>von selbst ändert</b>. Alle 10 s bricht er
mit <b>2,5 %</b> Wahrscheinlichkeit aus, ab der zweiten Minute +5 Punkte.</p>
<p>Der Ausbruch <b>zerstört Krater und Rand</b>, zwei Felder weiter kostet er
<b>30 % Leben</b>. Danach bleibt ein Krater.</p>
<p><b>Erdwärme:</b> Haupthaus oder Werk direkt am Vulkan geben dauerhaft
+1 Ressource, ein Werk auf Stufe 3 sogar +2.</p>
<p>Er ist damit ein Angebot mit Rechnung: der beste Bauplatz auf dem Brett,
und der einzige, der von allein hochgeht.</p>`, { accent: '#ef6b6b', w: 340, h: 340 });

notiz('Core Mechanics', `
<h2>Engineer — der Baumeister</h2>
<p>Bislang der einzige Charakter. Er bestimmt, <b>welche sechs Karten</b> man
hat und <b>was sie können</b>; gewählt wird vor der Partie, danach steht es
fest.</p>
<ul>
<li><b>Werkstatt statt Werk.</b> Auf dem Fels legt sie alle 30 s (ab Stufe 2
alle 25 s) eine <b>geschenkte Mauer</b> auf die Hand — ohne Kosten, ohne
Kartenkontingent. Sie mauert weiter, auch wenn die Laufzeit erschöpft ist.</li>
<li><b>Ritter als Rammbock.</b> Billiger und zäher (20 statt 30, 32 HP),
schwächer im Schlag — dafür <b>doppelter Schaden an allem Gebauten</b>.</li>
<li><b>Bogen kurzsichtig.</b> Reichweite 2 statt 3, dafür 7 statt 5 Leben.</li>
<li><b>Kanone teuer:</b> 50 statt 35.</li>
</ul>
<p>Sein Spiel ist Fläche: bauen, halten, und mit dem Ritter das Gebaute des
Gegners einreißen.</p>
<p style="color:#8a93a5">Im Netzspiel muss der Charakter auf beiden Geräten
gleich gesetzt sein — sonst rechnen sie mit verschiedenen Werten und die
Partie wird strittig.</p>`, { accent: '#4fd1c5', w: 460, h: 480 });

notiz('Schützenturm — wie er entsteht', `
<p>Kein eigenes Kartenblatt: Ein <b>Bogenschütze</b> wird zum Turm, wenn er
auf <b>Fels</b> oder in den <b>Wald</b> gesetzt wird.</p>
<p><b>Auf dem Fels</b> (Unterbau +5): +1 Reichweite, +1 Schaden — er sieht und
trifft weiter.<br>
<b>Im Wald</b> (Gerüst +4): −1/3 erlittener Schaden, dazu die Waldwerte, aber
−1 Reichweite.</p>
<p>Ein Turm <b>bewegt sich nie wieder</b>, bleibt bei Stufe 2 und zählt gegen
die Schützenstellungen.</p>`, { accent: NEUTRAL, w: 340, h: 300 });

notiz('Nächster Charakter', `
<h3>Hier ist Platz</h3>
<p>Die Fläche ist auf mehrere Charaktere angelegt. Im Spiel steht neben dem
Engineer schon die Kachel „Nächster Charakter — BALD".</p>
<p>Ein neuer Charakter bringt eine eigene Kartenhand und eigene Werte mit; das
Muster daneben — Core Mechanics, dann je Karte 2D, 3D und Werte — gilt für
ihn genauso.</p>
<p style="color:#8a93a5">Zu klären, bevor der zweite kommt: Der Netzspielpfad
setzt den Charakter bisher fest auf den Engineer. Mehrere Charaktere brauchen
die Wahl <b>je Sitz</b> in den Partie-Regeln, sonst wird jede gemischte Partie
strittig.</p>`, { accent: NEUTRAL, w: 400, h: 380 });

notiz('Was hier noch fehlt', `
<h3>Im Kontext, nicht freigestellt</h3>
<p>Oben in „Charaktere" und „Map & Umwelt" stehen die Modelle einzeln. Hier
gehören sie <b>zusammen aufs Brett</b>: ein Render, der zeigt, wie eine
Stellung im Spiel wirklich aussieht — Gelände, Bauten und Truppen in einem
Bild.</p>
<p>Vorhanden ist bisher nur der Kontaktbogen daneben: dieselbe Figur einmal
als 2D-Spielgrafik und einmal als 3D-Modell, direkt übereinander.</p>
<p style="color:#8a93a5">Offen: Szene mit Haupthaus, Mauerzug, Werk und zwei
Truppen auf gemischtem Gelände.</p>`, { accent: '#6ea8fe', w: 400, h: 360 });

/* ===================================================================== */
/* Die Flächen                                                           */
/* ===================================================================== */

/* --------------------------------------------- 1 · Ziel des Spieles --- */

const fZiel = flaeche('Ziel des Spieles', 'gamedesign', () =>
  lege('Ziel des Spieles', setze(0, 0, [['Ziel und Sieg'], ['Ablauf einer Partie']]), {
    tint: '#b78cf7', bereich: 'gamedesign', z: 1,
    note: 'Worum es geht — und wann es vorbei ist'
  }));

/* ------------------------ 2 · Visual Inspiration and Vision Board --- */

const fVision = flaeche('Visual Inspiration and Vision Board', 'medien', () =>
  lege('Visual Inspiration and Vision Board', setze(0, 0, [
    ['Münzwurf'], ['Aufstellen'], ['Gefecht'], ['Gefecht — später'], ['Woher diese Bilder stammen']
  ]), {
    tint: NEUTRAL, bereich: 'medien', z: 1,
    note: 'Wie das Spiel heute aussieht — Aufnahmen der laufenden Leinwand, 390 × 597'
  }));

/* ------------------------------------------- 3 · Map & Umwelt Design --- */

const fMap = flaeche('Map & Umwelt Design', 'gamedesign', () => {
  const brettKasten = setze(0, 0, [['Das Feld'], ['Ein Brett — 8 × 12']]);
  const fBrett = lege('Das Brett', brettKasten, { z: 3, note: 'Ein Feld, keine Regeloption' });

  const genKasten = setze(0, 0, [['Generierung']]);
  const fGen = lege('Generierung', genKasten, { z: 3, note: 'Aus dem Saatkorn, punktgespiegelt' });

  /* Je Block dasselbe Muster wie bei den Karten: 3D-Ansicht und Beschreibung
     in einem eigenen kleinen Rahmen. Der Fels trägt seine Stellungen mit. */
  const BLOCK = [
    ['See', ['See — 3D', 'See — Wirkung']],
    ['Gebirge (Fels)', ['Gebirge — 3D', 'Gebirge — Wirkung', 'Fels-Stellungen']],
    ['Wald', ['Wald — 3D', 'Wald — Wirkung']],
    ['Vulkan', ['Vulkan — 3D', 'Vulkan — Wirkung']]
  ];
  const blockRahmen = BLOCK.map(([nm, teile]) => ({
    nm, f: lege(nm, setze(0, 0, [teile]), { z: 4 }), teile: teile.map(W)
  }));

  /* Überblick links, die vier Blöcke rechts daneben in einer Reihe */
  (function ordneBloecke() {
    const ueb = W('Gelände — Überblick');
    ueb.x = 0; ueb.y = 0; merk(ueb);
    let x = ueb.w + SPALTE * 2;
    for (const b of blockRahmen) {
      const dx = Math.round(x - b.f.x), dy = Math.round(0 - b.f.y);
      b.f.x += dx; b.f.y += dy;
      for (const t of b.teile) { t.x += dx; t.y += dy; }
      x = b.f.x + b.f.w + LUFT;
    }
  })();

  const fArten = lege('Arten von Umweltblöcken + Beschreibung',
    huelle([{ x: W('Gelände — Überblick').x, y: W('Gelände — Überblick').y,
      w: W('Gelände — Überblick').w, h: W('Gelände — Überblick').h }]
      .concat(blockRahmen.map((b) => b.f))), {
    z: 3, note: 'Vier Sorten — jede ändert, wer darauf steht'
  });

  /* Generierung und Arten untereinander, das Brett darüber */
  (function ordneMap() {
    const spalteX = 0;
    let y = 0;
    const setzeRahmen = (f, kinder, x, yy) => {
      const dx = Math.round(x - f.x), dy = Math.round(yy - f.y);
      f.x += dx; f.y += dy;
      for (const k of kinder) { k.x += dx; k.y += dy; }
    };
    const brettInhalt = ['Das Feld', 'Ein Brett — 8 × 12'].map(W);
    const genInhalt = ['Generierung'].map(W);
    const artenInhalt = ['Gelände — Überblick', 'See — 3D', 'See — Wirkung',
      'Gebirge — 3D', 'Gebirge — Wirkung', 'Fels-Stellungen',
      'Wald — 3D', 'Wald — Wirkung', 'Vulkan — 3D', 'Vulkan — Wirkung'].map(W)
      .concat(blockRahmen.map((b) => b.f));
    setzeRahmen(fBrett, brettInhalt, spalteX, y); y = fBrett.y + fBrett.h + RAND + KOPF + LUFT;
    setzeRahmen(fGen, genInhalt, spalteX, y); y = fGen.y + fGen.h + LUFT * 3;
    setzeRahmen(fArten, artenInhalt, spalteX, y);
  })();

  const fUmwelt = lege('Umweltblöcke', huelle([fGen, fArten]), {
    z: 2, note: 'Woraus das Brett besteht'
  });
  const fMap0 = lege('Map & Umwelt Design', huelle([fBrett, fUmwelt]), {
    tint: '#b78cf7', bereich: 'gamedesign', z: 1,
    note: 'Das Brett und alles, was darauf schon liegt, bevor jemand baut'
  });
  return fMap0;
});

/* --------------------------- 4 · Charaktere Fähigkeiten und Karten --- */

const fChar = flaeche('Charaktere Fähigkeiten und Karten', 'charaktere', () => {
  /* Eine Karte = 2D aus dem Spiel, 3D-Modell, Werte — untereinander. */
  function karte(name, teile) {
    const kasten = setze(0, 0, [teile]);
    return lege(name, kasten, { z: 4 });
  }

  const KARTEN = [
    ['Schwert', ['Schwert — 2D (Spiel)', 'Schwert — 3D', 'Schwert — Werte']],
    ['Bogen', ['Bogen — 2D (Spiel)', 'Bogen — 3D', 'Bogen — Werte']],
    ['Ritter', ['Ritter — 2D (Spiel)', 'Ritter — 3D', 'Ritter — Werte']],
    ['Mauer', ['Mauer — 2D (Spiel)', 'Mauer — 3D', 'Mauer — Werte']],
    ['Werk (Werkstatt)', ['Werk — 2D (Spiel)', 'Werk — 3D', 'Werk — Werte']],
    ['Kanone', ['Kanone — 2D (Spiel)', 'Kanone — 3D', 'Kanone — Werte']],
    ['Haupthaus', ['Haupthaus — 2D (Spiel)', 'Haupthaus — 3D', 'Haupthaus — Werte']],
    ['Schützenturm', ['Schützenturm — 3D', 'Schützenturm — wie er entsteht']]
  ];

  const kartenRahmen = KARTEN.map(([nm, teile]) => ({ nm, f: karte(nm, teile), teile: teile.map(W) }));

  /* Das Schwert steht als ausgeführtes Beispiel für sich, der Rest daneben. */
  const schwert = kartenRahmen[0];
  const andere = kartenRahmen.slice(1);

  (function ordneKarten() {
    const verschiebe = (f, kinder, x, y) => {
      const dx = Math.round(x - f.x), dy = Math.round(y - f.y);
      f.x += dx; f.y += dy;
      for (const k of kinder) { k.x += dx; k.y += dy; }
    };
    verschiebe(schwert.f, schwert.teile, 0, 0);
    let x = schwert.f.x + schwert.f.w + LUFT * 3;
    const oben = schwert.f.y;
    for (const k of andere) {
      verschiebe(k.f, k.teile, x, oben);
      x = k.f.x + k.f.w + LUFT;
    }
  })();

  const fAndere = lege('Alle anderen Karten', huelle(andere.map((k) => k.f)), {
    z: 3, note: 'Dasselbe Muster je Karte: 2D aus dem Spiel, 3D-Modell, Werte'
  });

  /* Core Mechanics über die Kartenreihe */
  (function ordneEngineer() {
    const core = W('Core Mechanics');
    core.x = schwert.f.x;
    core.y = schwert.f.y - core.h - (RAND + KOPF + LUFT);
    merk(core);
  })();

  const fEngineer = lege('Engineer', huelle([{ x: W('Core Mechanics').x, y: W('Core Mechanics').y, w: W('Core Mechanics').w, h: W('Core Mechanics').h }, schwert.f, fAndere]), {
    z: 2, note: 'Kartenhand, Werte und Sonderregeln eines Charakters'
  });

  /* Platzhalter für den zweiten Charakter rechts daneben */
  (function ordneNaechsten() {
    const p = W('Nächster Charakter');
    p.x = fEngineer.x + fEngineer.w + LUFT * 4;
    p.y = fEngineer.y + KOPF + RAND;
    merk(p);
  })();
  const fNaechster = lege('Nächster Charakter', {
    x: W('Nächster Charakter').x, y: W('Nächster Charakter').y,
    w: W('Nächster Charakter').w, h: W('Nächster Charakter').h
  }, { z: 2, note: 'Platz für die zweite Kartenhand' });

  const fChar0 = lege('Charaktere Fähigkeiten und Karten', huelle([fEngineer, fNaechster]), {
    tint: '#4fd1c5', bereich: 'charaktere', z: 1,
    note: 'Ein Charakter bringt seine eigenen Karten und Werte mit'
  });
  return fChar0;
});

/* ------------------------------------- 5 · Menüstruktur & Design --- */

const fMenue = flaeche('Menüstruktur & Design', 'menues', () => {
  const einstiegKasten = setze(0, 0, [
    ['Einstieg — die Auswahlseite'],
    ['Online — zwei Feldherren, ein Tisch', 'Charakter und Kartenhand', 'Übungspartie gegen die KI']
  ], GASSE);
  const fEinstieg = lege('Einstieg', einstiegKasten, { z: 3, note: 'Was der Spieler vor der Partie wählt' });

  const gefechtKasten = setze(0, 0, [
    ['Im Gefecht — HUD'],
    ['Karte legen', 'Haupthaus setzen', 'Abriss und Drehen'],
    ['Halten — die Stellung', 'Pause und Aufgeben']
  ], GASSE);
  const fGefecht = lege('Im Gefecht', gefechtKasten, { z: 3, note: 'Jeder Pfeil hängt an genau dem Knopf, der ihn auslöst' });

  (function ordneMenue() {
    const verschiebe = (f, kinder, x, y) => {
      const dx = Math.round(x - f.x), dy = Math.round(y - f.y);
      f.x += dx; f.y += dy;
      for (const k of kinder) { k.x += dx; k.y += dy; }
    };
    const a = ['Einstieg — die Auswahlseite', 'Online — zwei Feldherren, ein Tisch',
      'Charakter und Kartenhand', 'Übungspartie gegen die KI'].map(W);
    const b = ['Im Gefecht — HUD', 'Karte legen', 'Haupthaus setzen', 'Abriss und Drehen',
      'Halten — die Stellung', 'Pause und Aufgeben'].map(W);
    verschiebe(fEinstieg, a, 0, 0);
    verschiebe(fGefecht, b, 0, fEinstieg.y + fEinstieg.h + LUFT * 3);
  })();

  const fMenue0 = lege('Menüstruktur & Design', huelle([fEinstieg, fGefecht]), {
    tint: '#57c98a', bereich: 'menues', z: 1,
    note: 'Zwei Bildschirme, fünf Handlungen — mehr gibt es nicht'
  });
  return fMenue0;
});

/* ----------------------------------------- 6 · Visual Design Game --- */

const fVisual = flaeche('Visual Design Game', 'medien', () => {
  const visualKasten = setze(0, 0, [
    ['Was hier noch fehlt', '2D und 3D — was ist was'],
    ['Kontaktbogen — 2D über 3D']
  ]);
  const fVisual0 = lege('Visual Design Game', visualKasten, {
    tint: '#6ea8fe', bereich: 'medien', z: 1,
    note: 'Die Modelle im Zusammenhang — wie es im Spiel aussehen soll'
  });
  return fVisual0;
});

/* ------------------------ 7 · Funcional Deep Dive Card Mechanics --- */

const fDeep = flaeche('Funcional Deep Dive Card Mechanics', 'mechanik', () => {
  const deepKasten = setze(0, 0, [
    ['Ressourcen & Vorrat', 'Kartenkontingent'],
    ['Ausbau & Verschmelzen'],
    ['Wie geschlagen wird', 'Stellungen']
  ], GASSE);
  const fDeep0 = lege('Funcional Deep Dive Card Mechanics', deepKasten, {
    tint: NEUTRAL, bereich: 'mechanik', z: 1,
    note: 'Wie die Karten miteinander rechnen — Wirtschaft, Ausbau, Kampf'
  });
  return fDeep0;
});

/* ---------------------------------------- 8 · Technische Umsetzung --- */

const fTechnik = flaeche('Technische Umsetzung', 'technik', () => {
  const tKern = lege('Der Kern', setze(0, 0, [
    ['Der Spielkern', 'Bitgenau gleich rechnen'],
    ['kern.d.ts — der Draht nach draußen'],
    ['regeln.ts — Takt und Vorlauf']
  ], GASSE), { z: 3, note: 'Gleichschritt · beide Geräte rechnen dieselbe Partie' });

  const tLeitung = lege('Über die Leitung', setze(0, 0, [
    ['Die Züge im Protokoll', 'Übungspartie — der Server sieht nichts'],
    ['Ein Zug geht als action über die Leitung', 'Warum überhaupt ein Herzschlag?', 'Online — Tisch anlegen und beitreten'],
    ['takt — Herzschlag, ausdrücklich keine Aktion', 'Was schon schiefging']
  ], GASSE), { z: 3, note: 'Zwei Nachrichtenarten, mehr braucht es nicht' });

  const tModul = lege('Das Modul auf dem Server', setze(0, 0, [
    ['Der Partiezustand ist dünn'],
    ['verarbeite() — was der Server prüft'],
    ['Dieselbe Schnittstelle, andere Gattung']
  ], GASSE), { z: 3, note: 'packages/game-feldherr — reine Logik, kein Netz, keine Uhr' });

  const tAusgang = lege('Ausgang und Wertung', setze(0, 0, [
    ['Beide melden getrennt'], ['Strittig — und dann?'], ['Erfahrung nach Dauer, mit fallendem Ertrag']
  ], GASSE), { z: 3, note: 'Zwei Meldungen, eine Prüfsumme' });

  const tWarum = lege('Warum es so gebaut ist', setze(0, 0, [
    ['Drei Wege — und warum es B wurde'], ['Was an GameModule nicht passte']
  ], GASSE), { z: 3, note: 'Feldherr ist die erste Echtzeitgattung im Haus' });

  (function ordneTechnik() {
    const inhalt = {
      [tKern.id]: ['Der Spielkern', 'Bitgenau gleich rechnen', 'kern.d.ts — der Draht nach draußen', 'regeln.ts — Takt und Vorlauf'],
      [tLeitung.id]: ['Die Züge im Protokoll', 'Übungspartie — der Server sieht nichts', 'Ein Zug geht als action über die Leitung',
        'Warum überhaupt ein Herzschlag?', 'Online — Tisch anlegen und beitreten',
        'takt — Herzschlag, ausdrücklich keine Aktion', 'Was schon schiefging'],
      [tModul.id]: ['Der Partiezustand ist dünn', 'verarbeite() — was der Server prüft', 'Dieselbe Schnittstelle, andere Gattung'],
      [tAusgang.id]: ['Beide melden getrennt', 'Strittig — und dann?', 'Erfahrung nach Dauer, mit fallendem Ertrag'],
      [tWarum.id]: ['Drei Wege — und warum es B wurde', 'Was an GameModule nicht passte']
    };
    let x = 0;
    for (const f of [tKern, tLeitung, tModul, tAusgang, tWarum]) {
      const kinder = inhalt[f.id].map(W);
      const dx = Math.round(x - f.x), dy = Math.round(0 - f.y);
      f.x += dx; f.y += dy;
      for (const k of kinder) { k.x += dx; k.y += dy; }
      x = f.x + f.w + LUFT * 3;
    }
  })();

  const fTechnik0 = lege('Technische Umsetzung', huelle([tKern, tLeitung, tModul, tAusgang, tWarum]), {
    tint: NEUTRAL, bereich: 'technik', z: 1,
    note: 'Folgt dem Gamedesign — erfindet nichts'
  });
  return fTechnik0;
});

/* ===================================================================== */
/* Die Flächen zweidimensional anordnen (wie in der Vorlage)             */
/* ===================================================================== */

/** Eine Fläche samt allem, was zu ihr gehört, an eine Stelle setzen. */
function stelle(name, x, y) {
  const f = rahmen.find((r) => r.title === name);
  if (!f) throw new Error('Fläche fehlt: ' + name);
  const dx = Math.round(x - f.x), dy = Math.round(y - f.y);
  for (const w of MITGLIEDER.get(name)) { if (w === f) continue; w.x += dx; w.y += dy; }
  f.x += dx; f.y += dy;
  return f;
}

const LUECKE = 420;          // zwischen zwei Flächen

/* Obere Reihe: Ziel · Map · Charaktere */
stelle('Ziel des Spieles', 0, 0);
stelle('Map & Umwelt Design', fZiel.x + fZiel.w + LUECKE, 0);
stelle('Charaktere Fähigkeiten und Karten', fMap.x + fMap.w + LUECKE, 0);

/* Links außen, wie in der Vorlage: das Vision Board */
stelle('Visual Inspiration and Vision Board', fZiel.x - fVision.w - LUECKE, 0);

/* Mittlere Reihe: Menü · Visual Design · Deep Dive */
const reiheZwei = Math.max(fVision.y + fVision.h, fMap.y + fMap.h, fChar.y + fChar.h) + LUECKE;
stelle('Menüstruktur & Design', fVision.x, reiheZwei);
stelle('Visual Design Game', fMenue.x + fMenue.w + LUECKE, reiheZwei);
stelle('Funcional Deep Dive Card Mechanics', fVisual.x + fVisual.w + LUECKE, reiheZwei);

/* Ganz unten, quer über alles: die Technik */
const untenY = Math.max(fMenue.y + fMenue.h, fVisual.y + fVisual.h, fDeep.y + fDeep.h) + LUECKE * 2;
stelle('Technische Umsetzung', fVision.x, untenY);

/* Überschrift der Tafel über allem */
const titel = W('Feldherr');
titel.x = fVision.x;
titel.y = fZiel.y - titel.h - LUECKE / 2;
titel.w = 900;

/* ===================================================================== */
/* Pfeile                                                                */
/* ===================================================================== */

const pfeil = (a, b, label, opt = {}) => {
  const teile = (s) => { const i = s.indexOf('#'); return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)]; };
  const [aw, as] = teile(a), [bw, bs] = teile(b);
  const kennung = (t) => (nachTitel.has(t) ? nachTitel.get(t).id : (rahmen.find((f) => f.title === t) || {}).id);
  const von = kennung(aw), zu = kennung(bw);
  if (!von || !zu) throw new Error('Pfeilende fehlt: ' + a + ' → ' + b);
  doc.connections.push({
    id: uid('con'),
    from: { win: von, side: opt.from || 'auto', shape: as },
    to: { win: zu, side: opt.to || 'auto', shape: bs },
    label: label, labelSize: 12, t: null,
    color: opt.color || '#8fa4c4', width: opt.width || 2,
    dash: opt.dash || 'solid', curve: 'ortho', heads: 'end'
  });
};

/* --- Der Fluss der Vorlage: alles läuft unten in die Technik --- */
pfeil('Ziel des Spieles', 'Menüstruktur & Design', 'daraus folgt die Bedienung', { from: 'b', to: 't', color: '#b78cf7' });
pfeil('Map & Umwelt Design', 'Visual Design Game', 'Gelände im Bild', { from: 'b', to: 't', color: '#b78cf7' });
pfeil('Charaktere Fähigkeiten und Karten', 'Visual Design Game', 'Figuren im Bild', { from: 'b', to: 't', color: '#4fd1c5' });
pfeil('Charaktere Fähigkeiten und Karten', 'Funcional Deep Dive Card Mechanics', 'wie sie zusammenwirken', { from: 'b', to: 't', color: '#4fd1c5', width: 2.5 });
pfeil('Visual Inspiration and Vision Board', 'Menüstruktur & Design', 'so sieht es heute aus', { from: 'b', to: 't', color: '#e0a0c8', dash: 'dotted' });
pfeil('Menüstruktur & Design', 'Technische Umsetzung', 'jede Handlung wird zu genau einem Zug', { from: 'b', to: 't', width: 3 });
pfeil('Funcional Deep Dive Card Mechanics', 'Technische Umsetzung', 'muss auf beiden Geräten gleich rechnen', { from: 'b', to: 't', width: 2.5 });
pfeil('Visual Design Game', 'Technische Umsetzung', '2D-Leinwand, 3D als Aufsatz', { from: 'b', to: 't' });

/* --- Innerhalb der Flächen --- */
pfeil('Das Feld#f_wald', 'Wald — Wirkung', 'vier Sorten', { from: 'r', to: 'l', color: '#57c98a' });
pfeil('Das Feld#f_berg', 'Gebirge — Wirkung', 'bebaubar', { from: 'b', to: 'l', color: '#9aa4b6' });
pfeil('Das Feld#f_vulkan', 'Vulkan — Wirkung', 'ändert sich von allein', { from: 'r', to: 'l', color: '#ef6b6b' });
pfeil('Das Feld#f_see', 'See — Wirkung', 'versperrt den Weg', { from: 'l', to: 'l', color: '#6ea8fe' });
pfeil('Generierung', 'Arten von Umweltblöcken + Beschreibung', 'streut diese vier', { from: 'b', to: 't', color: '#9aa4b6' });

pfeil('Einstieg — die Auswahlseite#a_erstellen', 'Online — zwei Feldherren, ein Tisch', 'Tisch erstellen', { from: 'r', to: 'l', color: '#57c98a', width: 2.5 });
pfeil('Einstieg — die Auswahlseite#a_tisch', 'Online — zwei Feldherren, ein Tisch', 'beitreten', { from: 'r', to: 'l', color: '#57c98a' });
pfeil('Einstieg — die Auswahlseite#a_held_engineer', 'Charakter und Kartenhand', 'wählt die Kartenhand', { from: 'r', to: 'l', color: '#f78ca0', width: 2.5 });
pfeil('Einstieg — die Auswahlseite#a_karte_3', 'Charakter und Kartenhand', 'Werk wird Werkstatt', { from: 'r', to: 'l', color: '#f78ca0' });
pfeil('Einstieg — die Auswahlseite#a_ki_start', 'Übungspartie gegen die KI', 'startet ohne Tisch', { from: 'r', to: 'l', color: '#9aa4b6' });

pfeil('Im Gefecht — HUD#b_karte_0', 'Karte legen', 'Karte wählen und setzen', { from: 'r', to: 'l', color: '#e8b45c', width: 2.5 });
pfeil('Im Gefecht — HUD#b_haus', 'Haupthaus setzen', 'einmalig, kostenlos', { from: 'r', to: 'l', color: '#e8b45c' });
pfeil('Im Gefecht — HUD#b_abriss', 'Abriss und Drehen', 'Abriss — 20 % zurück', { from: 'r', to: 'l', color: '#e8b45c' });
pfeil('Im Gefecht — HUD#b_drehen', 'Abriss und Drehen', 'Werk quer oder hoch', { from: 'r', to: 'l', color: '#e8b45c' });
pfeil('Im Gefecht — HUD#b_menu', 'Pause und Aufgeben', 'Pausenmenü', { from: 'r', to: 'l', color: '#ef6b6b' });
pfeil('Im Gefecht — HUD#b_haus', 'Halten — die Stellung', 'Antippen statt Knopf', { from: 'r', to: 'l', color: '#4fd1c5', dash: 'dashed' });

pfeil('Core Mechanics', 'Schwert', 'sechs Karten', { from: 'b', to: 't', color: '#4fd1c5' });
pfeil('Ressourcen & Vorrat', 'Kartenkontingent', 'zwei Bremsen: Gold und Karten', { from: 'r', to: 'l', color: '#4fd1c5' });
pfeil('Kartenkontingent', 'Ausbau & Verschmelzen', 'jede Karte zählt für immer', { from: 'r', to: 'l', color: '#4fd1c5' });
pfeil('Ausbau & Verschmelzen', 'Stellungen', 'Hausstufe = Schützenstellungen', { from: 'b', to: 'r', color: '#4fd1c5', width: 2.5 });

pfeil('Die Züge im Protokoll', 'kern.d.ts — der Draht nach draußen', 'melde(zug)', { from: 'l', to: 'r', color: '#b78cf7', width: 2.5 });
pfeil('kern.d.ts — der Draht nach draußen', 'Ein Zug geht als action über die Leitung', 'reicht unverändert weiter', { from: 'b', to: 't', width: 2.5 });
pfeil('kern.d.ts — der Draht nach draußen', 'takt — Herzschlag, ausdrücklich keine Aktion', 'puls alle 200 ms', { from: 'b', to: 't', color: '#ef6b6b', dash: 'dashed' });
pfeil('regeln.ts — Takt und Vorlauf', 'kern.d.ts — der Draht nach draußen', 'Takt 50 ms · Vorlauf 6', { from: 'l', to: 'r', color: '#8fa4c4' });
pfeil('takt — Herzschlag, ausdrücklich keine Aktion', 'Warum überhaupt ein Herzschlag?', 'weitergereicht wie ein Zuruf', { from: 'l', to: 'r', color: '#ef6b6b' });
pfeil('Was schon schiefging', 'Bitgenau gleich rechnen', 'brach den Gleichlauf', { from: 'l', to: 'r', color: '#ef6b6b', dash: 'dotted' });
pfeil('Ein Zug geht als action über die Leitung', 'verarbeite() — was der Server prüft', 'act(party, seat, action)', { from: 'r', to: 'l', color: '#57c98a', width: 2.5 });
pfeil('verarbeite() — was der Server prüft', 'Der Partiezustand ist dünn', 'Zug an die Liste', { from: 'l', to: 'r', color: '#57c98a' });
pfeil('Der Partiezustand ist dünn', 'Beide melden getrennt', 'Meldungen · Ausgang', { from: 'r', to: 'l', color: '#4fd1c5' });
pfeil('Beide melden getrennt', 'Strittig — und dann?', 'Prüfsummen weichen ab', { from: 'r', to: 'l', color: '#4fd1c5', dash: 'dashed' });
pfeil('Beide melden getrennt', 'Erfahrung nach Dauer, mit fallendem Ertrag', 'takte → Punkte', { from: 'b', to: 'b', color: '#4fd1c5' });
pfeil('Dieselbe Schnittstelle, andere Gattung', 'Was an GameModule nicht passte', 'was nicht passte', { from: 'r', to: 'l', color: '#e8b45c', dash: 'dotted' });

/* ===================================================================== */
/* Bündel — was denselben Weg nimmt, läuft als Strang                    */
/* ===================================================================== */

doc.bundles = [];

/**
 * Pfeile mit diesen Beschriftungen zu einem Strang zusammenfassen.
 * `zu` = zugezogen (eine Leitung mit Zahl), sonst aufgezogen (Adern
 * nebeneinander, quer darüber die Wickel).
 */
function buendel(name, farbe, labels, opt = {}) {
  const ids = doc.connections.filter((c) => labels.indexOf(c.label) >= 0).map((c) => c.id);
  if (ids.length < 2) throw new Error('Bündel „' + name + '": nur ' + ids.length + ' Pfeil(e) gefunden');
  const b = {
    id: uid('bnd'), name: name, collapsed: opt.zu !== false,
    color: farbe, width: opt.width || 3, spreizung: opt.spreizung || 13,
    laenge: opt.laenge || 320, mitte: opt.mitte || null
  };
  doc.bundles.push(b);
  for (const c of doc.connections) if (ids.indexOf(c.id) >= 0) c.bundle = b.id;
  return b;
}

/* Drei Flächen laufen unten in die Technik — als eine Leitung, sonst
   kreuzen drei lange Pfeile das halbe Board. */
buendel('In die Technik', '#8fa4c4', [
  'jede Handlung wird zu genau einem Zug',
  'muss auf beiden Geräten gleich rechnen',
  '2D-Leinwand, 3D als Aufsatz'
], { zu: true, width: 3.5, laenge: 520 });

/* Die Knöpfe des Gefechts: aufgezogen, damit man jede Ader einzeln
   verfolgen kann — der Strang hält sie trotzdem zusammen. */
buendel('Was die Knöpfe tun', '#e8b45c', [
  'Karte wählen und setzen', 'einmalig, kostenlos', 'Abriss — 20 % zurück',
  'Werk quer oder hoch', 'Pausenmenü', 'Antippen statt Knopf'
], { zu: false, spreizung: 15, laenge: 300 });

/* Die vier Geländearten */
buendel('Vier Geländearten', '#57c98a', [
  'vier Sorten', 'bebaubar', 'ändert sich von allein', 'versperrt den Weg'
], { zu: false, spreizung: 14, laenge: 260 });

/* ------------------------------------------------------------- Ausgabe */

doc.windows = rahmen.concat(doc.windows);
let z = 10;
for (const w of doc.windows) if (w.type !== 'frame') w.z = z++;
doc.nextZ = z + 1;
doc.name = 'Feldherr';
doc.view = { x: 120, y: 90, scale: 0.22 };

writeFileSync(DATEI, JSON.stringify(doc, null, 1), 'utf8');
const f = doc.windows.filter((w) => w.type === 'frame');
console.log('Fenster:', doc.windows.length, '· Rahmen:', f.length, '· Pfeile:', doc.connections.length);
console.log('Flächen:', f.filter((x) => x.z === 1).map((x) => x.title).join(' · '));
