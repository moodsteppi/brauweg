/* Einmaliger Umbau der Tafel „Feldherr — Funktionsweise".
 *
 * Warum ein Umbauskript und keine Neuerzeugung: Die Tafel ist seit
 * `_erzeuger-feldherr.mjs` von Hand weitergewachsen (Bauten und Truppen,
 * Handy-Aufnahmen, Spielmechanik, 3D-Modelle). Der Erzeuger kennt davon
 * nichts mehr — die JSON-Datei ist die Quelle.
 *
 * Was dieser Umbau macht:
 *
 *   1. ZWEI ABSCHNITTE. Oben das Gamedesign — Ziel, Brett, Wirtschaft,
 *      Kampf, Bildschirme, Bauten. Unten, durch eine breite Lücke
 *      getrennt, die technische Umsetzung. Dazwischen führt genau EIN
 *      Pfeil. Wer am Spiel arbeitet, hat die Technik nicht im Bild.
 *   2. INHALTE AUF STAND (10.8.2026): kein geteiltes Gerät mehr, nur noch
 *      ein Brett (8 × 12), Charakter mit eigener Kartenhand, Haupthaus bis
 *      Stufe 4, Schützenstellungen am Hausausbau, Halten per Antippen.
 *   3. PFEILE rechtwinklig, einheitlich beschriftet.
 *
 * Die Feinhöhen setzt danach GD.layout im Browser — hier stehen nur
 * Startwerte.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DATEI = 'C:/Users/freyd/Desktop/SPIDERVISION/gamedesk/boards/feldherr-funktionsweise.gamedesk.json';
const doc = JSON.parse(readFileSync(DATEI, 'utf8'));

let n = 0;
const uid = (p) => p + '_u' + (++n).toString(36);

const nachTitel = new Map();
for (const w of doc.windows) if (w.type !== 'frame') nachTitel.set(w.title, w);

const W = (titel) => {
  const w = nachTitel.get(titel);
  if (!w) throw new Error('Fenster fehlt: ' + titel);
  return w;
};

/* ===================================================================== */
/* 1  Aufräumen: alte Rahmen weg, obsolete Kacheln weg                   */
/* ===================================================================== */

doc.windows = doc.windows.filter((w) => w.type !== 'frame');

/* Die vier Protokoll-Notizen hingen im Gamedesign-Teil und beschrieben
   Nachrichtenformate. Sie werden unten zu einer einzigen Technik-Kachel
   zusammengezogen. */
const WEG = ['Zug: muenze', 'Zug: karte / haus', 'Zug: halt / abriss / drehen', 'Aufgeben'];
doc.windows = doc.windows.filter((w) => !WEG.includes(w.title));
for (const t of WEG) nachTitel.delete(t);

/* Alle Pfeile neu — die alten hingen zur Hälfte an gelöschten Kacheln
   und kreuzten die Abschnittsgrenze an sieben Stellen. */
doc.connections = [];

/* ===================================================================== */
/* 2  Neue Kacheln                                                       */
/* ===================================================================== */

const notiz = (titel, html, opt = {}) => {
  const w = {
    id: uid('win'), type: 'notes', title: titel,
    x: 0, y: 0, w: opt.w || 380, h: opt.h || 300, z: 10 + doc.windows.length,
    accent: opt.accent || '#6ea8fe', collapsed: false,
    state: { html: html.replace(/^\n/, '').replace(/\s+$/, ''), fontSize: opt.fontSize || 13 }
  };
  doc.windows.push(w);
  nachTitel.set(titel, w);
  return w;
};

/* --- Gamedesign: der Einstieg ---------------------------------------- */

notiz('Online — zwei Feldherren, ein Tisch', `
<p>Der Weg, um den es geht. Oben stehen die <b>offenen Tische</b>; wer
zuerst da ist, erstellt einen und wartet. Zwei Sitze, mehr hat das Brett
nicht.</p>
<p>Beide bringen ihren eigenen Charakter mit, das Brett ist für beide
dasselbe. <b>Es gibt keine Absprache über Regeln</b> — kein Feld, keine
Stärke, keine Zeit. Alles, was zu wählen wäre, ist schon gewählt.</p>
<p style="color:#8a93a5">Der Münzwurf entscheidet als Erstes, wer sein
Haupthaus zuerst setzt.</p>`, { accent: '#57c98a' });

notiz('Charakter und Kartenhand', `
<p>Der Charakter bestimmt, <b>welche sechs Karten</b> du hast und
<b>was sie können</b>. Er wird vor der Partie gewählt und steht dann fest.</p>
<p><b>Engineer</b> — der Baumeister, bislang der einzige:</p>
<ul>
<li><b>Werkstatt</b> statt Werk: auf dem Fels legt sie alle 30 s (ab Stufe 2
alle 25 s) eine <b>geschenkte Mauer</b> auf die Hand — ohne Kosten, ohne
Kontingent</li>
<li><b>Ritter</b> billiger und zäher (20 statt 30, 32 HP), dafür schwächer im
Schlag — und mit <b>doppeltem Schaden an Bauten</b></li>
<li><b>Bogen</b> kürzere Sicht (Reichweite 2), dafür 7 HP</li>
<li><b>Kanone</b> teurer: 50</li>
</ul>
<p>Karte gedrückt halten öffnet die Werteseite. Die Zahlen darauf rechnet das
Spiel aus denselben Werten, mit denen es spielt — sie können nicht lügen.</p>
<p style="color:#8a93a5">Im Netzspiel muss der Charakter auf beiden Geräten
gleich gesetzt sein.</p>`, { accent: '#f78ca0', h: 460 });

notiz('Übungspartie gegen die KI', `
<p>Drei Stärken: <b>leicht · normal · schwer</b>. Sonst dieselbe Partie mit
denselben Regeln.</p>
<p><b>Sie bringt nichts ein</b> — keine Erfahrung, keine Münzen. Eine örtliche
Partie lässt sich beliebig oft herbeiführen; alles, was sie ausschüttete, wäre
geschenkt.</p>
<p style="color:#8a93a5">Das geteilte Gerät („zu zweit an einem Gerät") ist am
7. August 2026 gestrichen worden: Es war der einzige Modus, in dem zwei
Menschen dieselbe Kartenleiste bedienten — mit einem Charakter je Spieler
ergibt er keinen Sinn mehr.</p>`, { accent: '#9aa4b6' });

/* --- Gamedesign: was die Knöpfe im Gefecht bedeuten ------------------- */

notiz('Karte legen', `
<p>Antippen wählt die Karte, das zweite Antippen setzt sie. Bezahlt wird
sofort aus dem <b>Vorrat</b>; reicht er nicht, bleibt die Karte grau.</p>
<p>Truppen laufen von allein los und suchen sich Weg und Ziel selbst — gelegt
wird also nicht ein Befehl, sondern eine <b>Entscheidung, wo etwas
entsteht</b>.</p>
<p>Eine Karte auf ein eigenes Bauwerk derselben Sorte <b>baut es aus</b>,
statt ein zweites daneben zu setzen.</p>`, { accent: '#e8b45c' });

notiz('Haupthaus setzen', `
<p>Der erste Zug jeder Partie und der einzige, der nichts kostet: Nach dem
Münzwurf setzt jeder sein Haupthaus in die eigene Hälfte.</p>
<p>Es steht in <b>keinem Kartenkontingent</b> und lässt sich nicht abreißen.
Fällt es, ist die Partie vorbei.</p>
<p>Wo es steht, entscheidet den Rest: Es zieht seinen Ausbau aus den acht
Nachbarfeldern.</p>`, { accent: '#e8b45c' });

notiz('Halten — die Stellung', `
<p><b>Kein Knopf.</b> Ein kurzes Antippen einer eigenen Truppe hält sie an:
Sie marschiert nicht mehr, verteidigt ihre Umgebung und nimmt <b>12,5 %
weniger Schaden</b>.</p>
<p>Das ist die einzige Anweisung, die man einer Truppe überhaupt geben kann —
und sie ist knapp: Kämpfer dürfen zu dritt stehen, <b>Schützen nur so viele,
wie das Haupthaus Stufen hat</b>.</p>
<p style="color:#8a93a5">Türme zählen bei den Schützen mit.</p>`, { accent: '#4fd1c5' });

notiz('Abriss und Drehen', `
<p>Zwei Knöpfe in der eigenen Leiste, beide betreffen nur Bauwerke.</p>
<p><b>Abriss</b> schaltet scharf; das nächste Antippen reißt das eigene
Bauwerk ein und gibt <b>20 %</b> zurück. Die verbrauchte Karte kommt
<b>nicht</b> zurück — der Abriss ist ein Notausgang, kein Werkzeug.</p>
<p><b>Drehen</b> stellt das Werk hochkant oder quer. Es belegt 1 × 2 Felder,
und an einer Kante ist oft nur eine der beiden Lagen möglich.</p>`, { accent: '#e8b45c' });

notiz('Pause und Aufgeben', `
<p>Das <b>≡</b> auf der Bühne öffnet die Pause: weiterspielen, Regeln ansehen,
Partie beenden.</p>
<p><b>In der Netzpartie hält nichts an.</b> Die Uhr des Gegners läuft weiter,
und wer aufgibt oder den Tisch verlässt, verliert sofort — es gibt keinen Bot,
der übernimmt.</p>`, { accent: '#ef6b6b' });

/* --- Technik: das Protokoll ------------------------------------------ */

notiz('Die Züge im Protokoll', `
<p>Alles, was der Spieler tut, wird zu genau einer von <b>sechs</b>
Nachrichten — verankert an einem Takt:</p>
<p style="font-family:monospace;font-size:.92em">karte · haus · halt ·
abriss · drehen · muenze</p>
<p><code>{ art: 'karte', karte: 'schwert', r: 7, c: 3, takt: 412 }</code></p>
<p><code>art</code> bleibt bewusst grob. Der Server prüft <b>Form und
Reihenfolge</b>, nie die Spielregel: Ob das Gold reicht, weiß nur der
Spielkern — und der läuft dort nicht mit.</p>
<p><code>haus</code> ist ein eigener Zug und keine Karte; <code>muenze</code>
trägt nur <code>wahl: 'kopf' | 'zahl'</code>, sein Ausgang kommt aus dem
Saatkorn. <b>Aufgeben ist kein Zug</b>, sondern beendet den Tisch.</p>`,
  { accent: '#e8b45c', w: 460, h: 400 });

/* --- Überschriften der beiden Abschnitte ------------------------------ */

const kopfGamedesign = notiz('Gamedesign', `
<h1>Gamedesign</h1>
<p>Was Feldherr <b>ist</b>: Ziel, Brett, Wirtschaft, Kampf, und was der
Spieler zu sehen und zu entscheiden bekommt.</p>
<p>Hier steht kein Dateiname und kein Nachrichtenformat. <b>Nichts auf dieser
Fläche darf sich ändern, weil die Technik es verlangt</b> — und umgekehrt
folgt die Technik allem, was hier entschieden wird.</p>`,
  { accent: '#b78cf7', w: 620, h: 250, fontSize: 14 });

const kopfTechnik = notiz('Technische Umsetzung', `
<h1>Technische Umsetzung</h1>
<p>Wie dieselbe Partie auf zwei Geräten gleichzeitig läuft: Gleichschritt aus
Saatkorn und Zugliste, ein Server, der nur Schiedsrichter ist, und das, was
dabei schon schiefgegangen ist.</p>
<p><b>Ab hier wird nichts mehr erfunden.</b> Wer eine Spielregel ändern will,
tut das im Abschnitt darüber; hier steht nur, was daraus folgt.</p>`,
  { accent: '#8fa4c4', w: 620, h: 250, fontSize: 14 });

/* ===================================================================== */
/* 3  Inhalte auf Stand bringen                                          */
/* ===================================================================== */

const setzeText = (titel, html, opt = {}) => {
  const w = W(titel);
  w.state.html = html.replace(/^\n/, '').replace(/\s+$/, '');
  if (opt.titel) { nachTitel.delete(titel); w.title = opt.titel; nachTitel.set(opt.titel, w); }
  if (opt.accent) w.accent = opt.accent;
  return w;
};

setzeText('Feldherr', `
<h1>Feldherr</h1>
<p><b>Echtzeit-Taktikduell für genau zwei</b>, eingebaut in die
Kartenspiel-Plattform Brauweg. Ein Brett, mittig geteilt. Wer das gegnerische
Haupthaus einreißt, gewinnt.</p>
<p>Kein Zugwechsel, keine Runden: Beide handeln durchgehend gleichzeitig. Das
ist die erste Echtzeitgattung im Haus — und der Grund, warum die
Umsetzung einen eigenen Abschnitt braucht.</p>
<p style="color:#8a93a5;font-size:.9em">Stand 10. August 2026 · örtlich gibt
es nur noch die Übungspartie gegen die KI</p>`);

setzeText('Feldgrößen', `
<p><b>Ein einziges Brett: 8 Spalten × 12 Reihen</b>, mittig geteilt — sechs
Reihen je Seite.</p>
<p>Bis zum 7. August 2026 gab es drei Größen (klein, mittel, groß). Der
Geometrie-Entscheid hat sie zusammengelegt: Drei Bretter hießen drei
Balance-Stände, drei Reichweiten-Tabellen und drei Geländedichten — für einen
Unterschied, den beim Spielen niemand suchte.</p>
<p>Damit hat Feldherr <b>keine einzige Regeloption</b>. Nichts ist vor der
Partie zu verhandeln.</p>
<p style="color:#8a93a5">Die drei Schlüssel leben in alten Tischen weiter; der
Kern bildet sie alle auf dasselbe Brett ab.</p>`,
  { titel: 'Ein Brett — 8 × 12' });

setzeText('Gelände', `
<p>Das Gelände wird je Partie aus dem Saatkorn gewürfelt und ist
<b>punktgespiegelt</b>: Beide Hälften sind gleich schwer.</p>
<table style="width:100%;border-collapse:collapse">
<tbody><tr><td style="padding:3px 8px 3px 0;color:#6ea8fe;vertical-align:top"><b>See</b></td>
<td>unpassierbar</td></tr>
<tr><td style="padding:3px 8px 3px 0;color:#9aa4b6;vertical-align:top"><b>Gebirge<br>(Fels)</b></td>
<td>unpassierbar und sichtdicht — schluckt sogar den Kanonenschuss.
<b>Aber bebaubar:</b> Bogen, Kanone und Werk dürfen hinauf</td></tr>
<tr><td style="padding:3px 8px 3px 0;color:#57c98a;vertical-align:top"><b>Wald</b></td>
<td>Truppen +50 % HP, +25 % DMG<br>Fernkämpfer −1 Reichweite<br>Kanone −25 %,
Haupthaus −20 % erlittener Schaden</td></tr>
<tr><td style="padding:3px 8px 3px 0;color:#ef6b6b;vertical-align:top"><b>Vulkan</b></td>
<td>Ausbruch zerstört Krater und Rand, zwei Felder weiter −30 % HP.
2,5 % je 10 s, ab 2 min +5 Punkte</td></tr>
</tbody></table>
<p><b>Erdwärme:</b> Haupthaus oder Werk direkt am Vulkan geben dauerhaft
+1 Ressource, ein Werk auf Stufe 3 sogar +2.</p>`);

setzeText('Fels-Stellungen', `
<p>Auf dem <b>Fels</b> dürfen Bogenschütze, Kanone und Werk bauen. Der
Unterbau kostet jedes Mal <b>+5</b>.</p>
<p>Schütze und Kanone bekommen +1 Reichweite und +1 Schaden. Der Schütze wird
zum <b>Turm</b>: bewegt sich nie wieder, bleibt bei Stufe 2 und zählt gegen
die Schützenstellungen.</p>
<p>Ein <b>Werk im Fels</b> muss mit beiden Feldern darauf stehen: +50 % HP,
kein Kessel beim Fallen, dafür −1 Ertrag und höchstens Stufe 2.</p>
<p><b>Im Wald</b> wird der Schütze ebenfalls zum Turm (Gerüst +4): −1/3
erlittener Schaden, dazu die Waldwerte, aber −1 Reichweite.</p>
<p>Fällt eine Fels-Stellung, blockiert 15 s lang ein brennendes Wrack das
Feld.</p>`);

setzeText('Ressourcen & Vorrat', `
<p>Ressourcen fließen <b>je Sekunde</b>, nicht je Zug — Feldherr hat keine
Züge.</p>
<ul>
<li>Haupthaus: <b>+2</b> je s, mit Ausbau +3 / +4 / +5</li>
<li>Werk: <b>+1 / +2 / +5</b> je s, solange die Laufzeit läuft
(15 / 20 / 25 s)</li>
<li>Danach Sparflamme: +1 / +2 / +2. Jeder Treffer kostet 1 s Laufzeit</li>
<li><b>Panik-Faktor:</b> ein Werk in den zwei vordersten Reihen der eigenen
Hälfte gibt +1 — dort ist es aber kaum zu halten</li>
<li><b>Erdwärme:</b> am Vulkan +1, ein Werk auf Stufe 3 dort +2</li>
</ul>
<p><b>Vorrat höchstens 50</b>, mit ausgebautem Haupthaus 60 und auf Stufe 4
sogar 70 — alles darüber verfällt. <b>Wer hortet, verliert.</b></p>`);

setzeText('Ausbau & Verschmelzen', `
<p><b>Truppen</b> steigen bis Stufe 4 — Kupfer, Silber, Gold, Diamant —,
indem zwei gleiche derselben Stufe aufeinandertreffen. Eine frische Karte auf
eine Stufe-1-Truppe wirkt genauso. <b>Wer aufsteigt, schlägt sofort einmal
zu.</b></p>
<p><b>Mauer:</b> verbundene Mauern teilen sich eine Stufe — zwei ergeben
Stufe 2, drei Stufe 3. Das Leben der Stufe gehört der <b>Gruppe</b> und
verteilt sich nach eingesetzten Karten; fällt ein Stück, stuft sich der Rest
neu ein.</p>
<p><b>Werk:</b> eine zweite Karte hebt es auf Stufe 2; zwei Stufe-2-Werke
nebeneinander verschmelzen zu Stufe 3 und bleiben stehen, wo sie sind.</p>
<p><b>Haupthaus — vier Stufen</b> aus der Nachbarschaft, nicht aus Karten:</p>
<table style="width:100%;border-collapse:collapse;font-size:.94em">
<tbody>
<tr><td style="padding:2px 8px 2px 0"><b>2</b></td><td>ein Stützpunkt auf
Stufe 2 daneben (Mauer, Werk, Kanone, Turm)</td></tr>
<tr><td style="padding:2px 8px 2px 0"><b>3</b></td><td>zwei solche Stützpunkte
— oder eine Mauer bzw. ein Werk auf Stufe 3</td></tr>
<tr><td style="padding:2px 8px 2px 0"><b>4</b></td><td>Mauer auf Stufe 3
<b>und</b> Werk auf Stufe 3 am Haus</td></tr>
</tbody></table>
<p>Je Stufe: mehr Leben (36 → 43 → 54 → 68), mehr Ertrag, größerer Vorrat —
und <b>eine Schützenstellung mehr</b>. Fallen die Stützpunkte, verschwindet
der Ausbau wieder.</p>`);

setzeText('Kartenkontingent', `
<p>Werk <b>4</b> · Mauer <b>3</b> · Kanone <b>2</b> · Haupthaus <b>1</b></p>
<p>Einmal gesetzt zählt eine Karte <b>für immer</b> — auch wenn das Bauwerk
fällt oder du es abreißt. Der Abriss gibt nur <b>20 %</b> zurück.</p>
<p>Die Zahl in der Kartenecke zeigt den Rest. Damit ist jede Bauentscheidung
endgültig, und der Abriss ist ein Notausgang, kein Werkzeug.</p>
<p style="color:#8a93a5">Schwert, Bogen und Ritter haben kein Kontingent — sie
kosten nur Ressourcen. Die geschenkte Mauer der Engineer-Werkstatt zählt
ebenfalls nicht mit.</p>`);

setzeText('Stellungen', `
<p>Ein kurzes Antippen <b>hält eine Truppe an</b>: Sie marschiert nicht mehr,
verteidigt ihre Umgebung und nimmt <b>12,5 % weniger Schaden</b>.</p>
<p>Zwei Gruppen, zwei Grenzen:</p>
<ul>
<li><b>Kämpfer</b> (Schwert, Ritter): immer höchstens <b>drei</b></li>
<li><b>Schützen</b> (Bogen, Türme): so viele, wie das <b>Haupthaus Stufen
hat</b> — 1, 2, 3 oder 4</li>
</ul>
<p>Das hängt seit dem 7. August 2026 zusammen: Vorher stand die Grenze fest
bei drei und war in der ersten Minute erreicht. <b>Wer Stellungen will, muss
zuerst sein Haus ausbauen.</b></p>
<p>Das Schild an der Figur zeigt den Stand der ganzen Gruppe — man sieht ohne
Zählen, ob noch eine Stellung frei ist.</p>`);

setzeText('Wie geschlagen wird', `
<p>Gezogen wird nur <b>waagerecht und senkrecht</b>, geschlagen auch <b>über
Eck</b>. Niemand bekommt einen Marschbefehl: Truppen suchen sich Weg und Ziel
selbst und halten auf das gegnerische Haupthaus zu.</p>
<p><b>Bogen</b> braucht freie Sicht, trifft aber über eine Mauer <b>direkt vor
sich</b> hinweg — ab Stufe 2 ein Feld weiter. Gegen Mauern und aus dem Turm
nur <b>halber Schaden</b>.</p>
<p><b>Kanone</b>: doppelter Schaden an Bauwerken, unbeweglich. Stufe 1 zielt
erst auf Kanonen, dann Werke; eine Mauer in der Bahn fängt den Schuss ab, ein
Gebirge schluckt ihn ganz. Der <b>Mörser</b> (Stufe 2) schießt über alles
hinweg: erst Werke, dann Kanonen, dann Haupthaus, dazu 30 % Splitter.</p>
<p><b>Fällt ein Werk im Kampf</b>, explodiert der Kessel und reißt die vier
angrenzenden Felder mit.</p>`);

setzeText('Ablauf einer Partie', `
<p style="font-size:1.05em"><b>Einstieg → Münze → Aufstellen → Gefecht →
Ende</b></p>
<ol>
<li><b>Einstieg.</b> Tisch beitreten oder erstellen, Charakter wählen.</li>
<li><b>Münze.</b> Einer ruft Kopf oder Zahl, der andere bekommt die zweite
Seite. Wer richtig liegt, setzt sein Haupthaus zuerst.</li>
<li><b>Aufstellen.</b> Beide setzen ihr Haupthaus in die eigene Hälfte.</li>
<li><b>Gefecht.</b> Kein Zugwechsel — beide handeln durchgehend gleichzeitig,
zwanzigmal je Sekunde gerechnet.</li>
<li><b>Ende.</b> Wessen Haupthaus fällt, verliert. Aufgeben und den Tisch
verlassen zählen genauso.</li>
</ol>
<p style="color:#8a93a5">Im Code: <code>phase = 'menu' → 'coin' → 'place' →
'war' → 'over'</code></p>`);

setzeText('Örtlich — der Server sieht nichts', `
<p>Die Übungspartie gegen die KI läuft <b>allein im Kern</b>: kein Tisch,
keine WebSocket, kein Saatkorn vom Server. Die Partie zieht ihre Bildzeit aus
der Wanduhr des Geräts.</p>
<p>Sie bucht auch nichts: <b>keine Erfahrung, keine Münzen</b>. Ein Endpunkt,
den nur der Client füllt, wäre eine Münzquelle — er war schon einmal gebaut
und ist bewusst wieder entfernt worden.</p>
<p style="color:#8a93a5">Das geteilte Gerät (<code>zuZweit</code>) ist aus
dem Bildschirm verschwunden. Der Kern kennt den Modus weiter — er ist die
eigenständige Spieldatei mit.</p>`,
  { titel: 'Übungspartie — der Server sieht nichts' });

setzeText('Online — Tisch anlegen und beitreten', `
<p><code>POST /api/tables</code> mit <code>game: "feldherr"</code>, dann
<code>join</code> über die WebSocket. Genau <b>zwei</b> Sitze — das Brett hat
zwei Hälften.</p>
<p>Der Server würfelt das <b>Saatkorn</b> und schickt es in der Sicht. Ab da
rechnen beide Geräte dieselbe Partie.</p>
<p>Mit in der Sicht: Regeln, die Zugliste (beim <code>join</code>
vollständig, danach nur der Zuwachs) und am Ende die Meldung je Sitz.</p>`);

setzeText('Bitgenau gleich rechnen', `
<p>Alle <b>45</b> Aufrufe von <code>Math.random()</code> sind durch einen
Seed-Zufall (mulberry32) ersetzt; <code>saat(wert)</code> setzt den Anfang.</p>
<p>Nachgewiesen: zwei Läufe mit demselben Saatkorn ergeben nach 90 simulierten
Sekunden dasselbe Gelände, dieselbe KI-Taktik, denselben Sieger und Zeichen
für Zeichen dieselbe Objektliste.</p>
<p>Auch der <b>Charakter</b> gehört dazu: Er bestimmt Kartenwerte und
Kartenhand. Setzen ihn die Geräte verschieden, rechnen sie verschieden — und
die Partie wird strittig.</p>
<p><b>Wer daran etwas ändert, bricht jedes Netzspiel</b> — nicht sofort
sichtbar, sondern erst daran, dass beide einen anderen Sieger sehen.</p>`);

setzeText('Strittig — und dann?', `
<p>Weichen die Prüfsummen an derselben Taktgrenze ab, hält der Kern an und
meldet über <code>aufStrittig</code>. Der Ausgang bekommt
<code>sieger: null</code> und <code>strittig: true</code>.</p>
<p>Das ist kein Fehlerfall, den man wegdrücken kann: Er bedeutet, dass beide
Geräte verschiedene Partien gerechnet haben. Eine Wertung wäre geraten.</p>
<p style="color:#8a93a5">Gelöst am 7. August 2026 durch Absender-Deckel und
Selbstheilungs-Replay (2173bf9). Am 10. August kam ein zweiter Fund dazu: ein
fehlendes <code>worker-src</code> in der CSP fror jeden verdeckten Tab ein —
nur auf ausgelieferten Ausgaben.</p>`);

setzeText('2D und 3D — was ist was?', `
<p><b>Oben (2D)</b> ist der echte Spielstand: mit dem Zeichencode des Kerns
gerendert, Figur für Figur einzeln aufs Brett gesetzt und ausgeschnitten.</p>
<p><b>Unten (3D)</b> sind Modelle, die hier in GameDesk gebaut wurden — als
Vorlage für eine mögliche 3D-Fassung.</p>
<p>Im Spiel gibt es einen <b>2D/3D-Schalter</b> auf der Bühne; die 3D-Sicht
ist ein eigener Aufbau über derselben Partie. Die Modelle hier sind Entwurf,
nicht Auslieferung.</p>
<p style="color:#8a93a5">Ziehen dreht ein Modell, der Schalter oben rechts
hält die Kamerafahrt an.</p>`);

setzeText('Was an GameModule nicht passte', `
<table style="width:100%;border-collapse:collapse;font-size:.92em">
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6"><code>currentActor</code></td><td>beide handeln gleichzeitig, immer</td></tr>
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6"><code>legalActions</code></td><td>jede Karte auf jedes freie Feld — hunderte je Bild</td></tr>
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6">„uhrlos"</td><td>die Partie rechnet 20-mal je Sekunde weiter, auch wenn niemand etwas tut</td></tr>
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6">Runden</td><td>eine durchgehende Partie ohne Runden</td></tr>
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6"><code>xpBasis</code></td><td>gelegte Karten gibt es, aber sie sind keine Leistung</td></tr>
</table>
<p style="margin-top:8px">Wer das übergeht und Feldherr in die vorhandene Form
presst, baut <code>currentActor: () =&gt; null</code> und
<code>legalActions: () =&gt; []</code> — und hat ein Modul, das der Server
nicht mehr vorantreiben kann.</p>`);

/* ===================================================================== */
/* 4  Wireframes neu zeichnen                                            */
/* ===================================================================== */

const KNOPF = { type: 'rect', radius: 10, fill: '#16232c', strokeOn: true, stroke: '#2b3d48', strokeW: 1, fillOn: true, opacity: 1, pad: 8, rot: 0, font: { size: 13, weight: 650, color: '#dfd6c2', family: 'ui', align: 'center', valign: 'middle', lh: 1.3 } };
const TEXT = { type: 'text', radius: 0, fillOn: false, strokeOn: false, strokeW: 1, opacity: 1, pad: 0, rot: 0, font: { size: 12, weight: 400, color: '#7c8f9b', family: 'ui', align: 'left', valign: 'middle', lh: 1.35 } };
const FLAECHE = { type: 'rect', radius: 12, fillOn: true, fill: '#101a21', strokeOn: true, stroke: '#1e2c35', strokeW: 1, opacity: 1, pad: 8, rot: 0, font: { size: 12, weight: 400, color: '#7c8f9b', family: 'ui', align: 'center', valign: 'middle', lh: 1.35 } };

const form = (grund, o) => {
  const s = JSON.parse(JSON.stringify(grund));
  const f = Object.assign({}, s.font, o.font || {});
  Object.assign(s, o);
  s.font = f;
  s.text = o.text === undefined ? '' : o.text;
  return s;
};

/* --- Einstieg (Hub) --------------------------------------------------- */

const A = [];
A.push(form(FLAECHE, { id: 'a_bg', x: 0, y: 0, w: 420, h: 800, radius: 0, fill: '#05080b', strokeOn: false }));
A.push(form(KNOPF, { id: 'a_zurueck', x: 16, y: 16, w: 74, h: 34, radius: 10, text: '‹ Zurück', font: { size: 11, weight: 700, color: '#9fb3c0' } }));
A.push(form(TEXT, { id: 'a_eyebrow', x: 102, y: 14, w: 300, h: 16, text: 'ECHTZEIT · 2 SPIELER', font: { size: 10, weight: 700, color: '#5d7382' } }));
A.push(form(TEXT, { id: 'a_titel', x: 102, y: 30, w: 300, h: 30, text: 'FELDHERR', font: { size: 26, weight: 900, color: '#e7eef3' } }));
A.push(form(TEXT, { id: 'a_text', x: 16, y: 70, w: 388, h: 34, text: 'Zwei Feldherren, ein Brett, eine Mittellinie. Wer das gegnerische Haupthaus einreißt, gewinnt.', font: { size: 11, color: '#8ba0ad', valign: 'top' } }));

A.push(form(FLAECHE, { id: 'a_tafel_online', x: 16, y: 116, w: 388, h: 168, fill: '#122530', stroke: '#2f6fe4' }));
A.push(form(TEXT, { id: 'a_marke_online', x: 32, y: 128, w: 200, h: 16, text: 'ONLINE SPIELEN', font: { size: 10, weight: 800, color: '#8fb6ff' } }));
A.push(form(KNOPF, { id: 'a_tisch', x: 32, y: 152, w: 356, h: 46, fill: '#16232c', stroke: '#2b3d48', text: 'Kira                                  1/2        Beitreten', font: { size: 12, weight: 600, color: '#cfe0ea', align: 'left' }, pad: 14 }));
A.push(form(TEXT, { id: 'a_leer', x: 32, y: 204, w: 356, h: 16, text: 'Gerade wartet sonst niemand.', font: { size: 10, color: '#66798a' } }));
A.push(form(KNOPF, { id: 'a_erstellen', x: 32, y: 224, w: 356, h: 46, radius: 11, fill: '#2f6fe4', stroke: '#5b8ff0', text: 'Tisch erstellen', font: { size: 14, weight: 800, color: '#ffffff' } }));

A.push(form(FLAECHE, { id: 'a_tafel_held', x: 16, y: 300, w: 388, h: 250 }));
A.push(form(TEXT, { id: 'a_marke_held', x: 32, y: 312, w: 240, h: 16, text: 'WEN SPIELST DU?', font: { size: 10, weight: 800, color: '#7c8f9b' } }));
A.push(form(KNOPF, { id: 'a_held_engineer', x: 32, y: 336, w: 174, h: 86, fill: '#1d3346', stroke: '#4a86c8', text: 'Engineer\nBaumeister. Werkstatt\nim Fels, Ritter als\nRammbock.', font: { size: 11, weight: 700, color: '#dfe9f2', valign: 'top' }, pad: 10 }));
A.push(form(KNOPF, { id: 'a_held_bald', x: 214, y: 336, w: 174, h: 86, fill: '#111c23', stroke: '#22323c', text: 'Nächster Charakter\n\nBALD', font: { size: 11, weight: 700, color: '#5d7382' }, pad: 10 }));
['Schwert', 'Bogen', 'Mauer', 'Werk', 'Ritter', 'Kanone'].forEach((t, i) => {
  A.push(form(KNOPF, {
    id: 'a_karte_' + i, x: 32 + i * 60, y: 434, w: 52, h: 74, radius: 7,
    fill: '#1a2a34', stroke: '#33505f', text: t, font: { size: 9, weight: 700, color: '#cfe0ea' }, pad: 3
  }));
});
A.push(form(TEXT, { id: 'a_handhinweis', x: 32, y: 514, w: 356, h: 16, text: 'Karte gedrückt halten für alle Werte.', font: { size: 10, color: '#66798a' } }));

A.push(form(FLAECHE, { id: 'a_tafel_ki', x: 16, y: 566, w: 388, h: 132 }));
A.push(form(TEXT, { id: 'a_marke_ki', x: 32, y: 578, w: 240, h: 16, text: 'GEGEN DIE KI', font: { size: 10, weight: 800, color: '#7c8f9b' } }));
['Leicht', 'Normal', 'Schwer'].forEach((t, i) => {
  A.push(form(KNOPF, {
    id: 'a_stufe' + i, x: 32 + i * 120, y: 602, w: 112, h: 36, radius: 9,
    fill: i === 1 ? '#243a30' : '#131f27', stroke: i === 1 ? '#4d8a68' : '#243440',
    text: t, font: { size: 12, weight: 650, color: i === 1 ? '#bfe3cf' : '#93a6b3' }
  }));
});
A.push(form(KNOPF, { id: 'a_ki_start', x: 32, y: 648, w: 356, h: 42, radius: 11, fill: '#1d2b33', stroke: '#3d5361', text: 'Übungspartie starten', font: { size: 13, weight: 750, color: '#dfd6c2' } }));
A.push(form(TEXT, { id: 'a_fuss', x: 16, y: 712, w: 388, h: 34, text: 'Die Seite rollt — Heldenwahl, Kartenhand und Tischliste sind zusammen länger als ein Handy hoch ist.', font: { size: 10, color: '#4f6270', valign: 'top' } }));

const wfEinstieg = W('Vor dem Gefecht');
nachTitel.delete('Vor dem Gefecht');
wfEinstieg.title = 'Einstieg — die Auswahlseite';
nachTitel.set(wfEinstieg.title, wfEinstieg);
wfEinstieg.w = 440; wfEinstieg.h = 830;
wfEinstieg.state = { canvas: { w: 420, h: 800, bg: '#05080b' }, shapes: A, guides: { v: [], h: [] }, grid: { size: 10, show: false, snap: true } };

/* --- Im Gefecht (HUD, Hochformat wie am Handy) ------------------------ */

const B = [];
B.push(form(FLAECHE, { id: 'b_bg', x: 0, y: 0, w: 420, h: 800, radius: 0, fill: '#070d10', strokeOn: false }));

B.push(form(FLAECHE, { id: 'b_hud_oben', x: 0, y: 0, w: 420, h: 58, radius: 0, fill: '#0d1a22', strokeOn: false }));
B.push(form(TEXT, { id: 'b_gegner', x: 14, y: 18, w: 392, h: 22, text: 'KI · NORMAL              18/50        +4/s', font: { size: 12, weight: 700, color: '#8fa6b4' } }));

B.push(form(FLAECHE, { id: 'b_stage', x: 0, y: 58, w: 420, h: 546, radius: 0, fill: '#0e1a14', strokeOn: false }));
for (let r = 0; r < 12; r++) {
  for (let c = 0; c < 8; c++) {
    B.push(form(FLAECHE, {
      id: 'b_z' + r + '_' + c, x: 30 + c * 45, y: 72 + r * 42, w: 42, h: 39, radius: 4,
      fill: '#1c3a29', stroke: '#2a5340', strokeW: 0.5
    }));
  }
}
B.push({
  id: 'b_mitte', type: 'line', x: 26, y: 324, w: 368, h: 0, rot: 0, opacity: 1, pad: 0, radius: 0,
  fillOn: false, strokeOn: true, stroke: '#7fd8a8', strokeW: 1.4, dash: 'dashed', text: '',
  font: { size: 12, weight: 400, color: '#7c8f9b', family: 'ui', align: 'center', valign: 'middle', lh: 1.35 }
});
B.push(form(FLAECHE, { id: 'b_gegnerhaus', x: 165, y: 72, w: 42, h: 39, radius: 4, fill: '#4a2c2c', stroke: '#8a3d3d', text: '⌂', font: { size: 17, color: '#e8b0b0' } }));
B.push(form(FLAECHE, { id: 'b_haus', x: 210, y: 534, w: 42, h: 39, radius: 4, fill: '#5c4a2a', stroke: '#8a6f3d', text: '⌂', font: { size: 17, color: '#e8d9b0' } }));
B.push(form(TEXT, { id: 'b_uhr', x: 14, y: 64, w: 80, h: 20, text: '2:14', font: { size: 13, weight: 800, color: '#c9d8e2' } }));
B.push(form(KNOPF, { id: 'b_menu', x: 372, y: 66, w: 36, h: 30, radius: 8, text: '≡', font: { size: 14, color: '#9fb0ba' } }));

B.push(form(FLAECHE, { id: 'b_hud_unten', x: 0, y: 604, w: 420, h: 196, radius: 0, fill: '#0d1a22', strokeOn: false }));
B.push(form(TEXT, { id: 'b_leiste', x: 14, y: 616, w: 220, h: 24, text: 'DU        24/50      +5/s', font: { size: 12, weight: 700, color: '#cfe0ea' } }));
B.push(form(KNOPF, { id: 'b_drehen', x: 268, y: 614, w: 62, h: 30, radius: 8, text: 'Drehen', font: { size: 10, weight: 650, color: '#cfe0ea' } }));
B.push(form(KNOPF, { id: 'b_abriss', x: 338, y: 614, w: 62, h: 30, radius: 8, text: 'Abriss', font: { size: 10, weight: 650, color: '#cfe0ea' } }));
[['Schwert', '8'], ['Bogen', '12'], ['Mauer', '15'], ['Werk', '25'], ['Ritter', '20'], ['Kanone', '50']].forEach(([t, p], i) => {
  B.push(form(KNOPF, {
    id: 'b_karte_' + i, x: 14 + i * 66, y: 654, w: 58, h: 88, radius: 8,
    fill: '#22323b', stroke: '#46606f', text: '⛁' + p + '\n\n' + t,
    font: { size: 9, weight: 700, color: '#dfd6c2', valign: 'top' }, pad: 5
  }));
});
B.push(form(TEXT, { id: 'b_tipphinweis', x: 14, y: 752, w: 392, h: 32, text: 'Halten hat keinen Knopf: ein kurzes Antippen der eigenen Truppe stellt sie.', font: { size: 10, color: '#5d7382', valign: 'top' } }));

const wfHud = W('Im Gefecht — HUD');
wfHud.w = 440; wfHud.h = 830;
wfHud.state = { canvas: { w: 420, h: 800, bg: '#070d10' }, shapes: B, guides: { v: [], h: [] }, grid: { size: 10, show: false, snap: true } };

/* --- Das Feld: acht Spalten statt sechs ------------------------------- */

const F = [];
F.push(form(FLAECHE, { id: 'f_bg', x: 0, y: 0, w: 700, h: 800, radius: 0, fill: '#0c1512', strokeOn: false }));
F.push(form(TEXT, { id: 'f_titel', x: 20, y: 14, w: 660, h: 26, text: 'Ein Brett · 8 Spalten × 12 Reihen · mittig geteilt', font: { size: 15, weight: 700, color: '#cfe0d6' } }));
for (let r = 0; r < 12; r++) {
  for (let c = 0; c < 8; c++) {
    F.push(form(FLAECHE, {
      id: 'f_' + r + '_' + c, x: 34 + c * 79, y: 54 + r * 58, w: 74, h: 54, radius: 5,
      fill: '#1c3a29', stroke: '#2a5340', strokeW: 0.7
    }));
  }
}
F.push({
  id: 'f_mitte', type: 'line', x: 28, y: 400, w: 644, h: 0, rot: 0, opacity: 1, pad: 0, radius: 0,
  fillOn: false, strokeOn: true, stroke: '#7fd8a8', strokeW: 2, dash: 'dashed', text: '',
  font: { size: 12, weight: 400, color: '#7c8f9b', family: 'ui', align: 'center', valign: 'middle', lh: 1.35 }
});
F.push(form(TEXT, { id: 'f_mlabel', x: 28, y: 376, w: 200, h: 20, text: 'Mittellinie', font: { size: 11, color: '#7fd8a8' } }));
F.push(form(TEXT, { id: 'f_o', x: 470, y: 30, w: 202, h: 20, text: 'Sitz 0 — obere sechs Reihen', font: { size: 11, color: '#8ba0ad', align: 'right' } }));
F.push(form(TEXT, { id: 'f_u', x: 470, y: 758, w: 202, h: 20, text: 'Sitz 1 — untere sechs Reihen', font: { size: 11, color: '#8ba0ad', align: 'right' } }));
const feld = (id, r, c, text, fill, stroke, farbe) =>
  F.push(form(FLAECHE, { id: id, x: 34 + c * 79, y: 54 + r * 58, w: 74, h: 54, radius: 5, fill: fill, stroke: stroke, text: text, font: { size: 11, weight: 700, color: farbe } }));
feld('f_h1', 0, 2, '⌂', '#4a2c2c', '#8a3d3d', '#e8b0b0');
feld('f_h2', 11, 5, '⌂', '#5c4a2a', '#8a6f3d', '#e8d9b0');
feld('f_see', 5, 3, 'See', '#16344d', '#2b5f86', '#9ecbe8');
feld('f_berg', 4, 5, 'Fels', '#2f3540', '#565f6e', '#cbd3de');
feld('f_wald', 3, 1, 'Wald', '#1c4028', '#3f7a4e', '#a9dcb8');
feld('f_vulkan', 8, 6, 'Vulkan', '#40231c', '#8a4433', '#f0b39c');
F.push(form(FLAECHE, { id: 'f_werk', x: 34, y: 112, w: 74, h: 112, radius: 5, fill: '#3b3324', stroke: '#7a6a45', text: 'Werk\n1×2', font: { size: 11, weight: 700, color: '#e3d4ab' } }));

const wfFeld = W('Das Feld');
wfFeld.w = 720; wfFeld.h = 760;
wfFeld.state = { canvas: { w: 700, h: 800, bg: '#0c1512' }, shapes: F, guides: { v: [], h: [] }, grid: { size: 10, show: false, snap: true } };

/* ===================================================================== */
/* 5  Anordnung: zwei Abschnitte                                         */
/* ===================================================================== */

const LUFT = 28;            // zwischen Kacheln
const SPALTE = 34;          // zwischen Spalten ohne Pfeile
/* Wo Pfeile zwischen den Spalten laufen, braucht die Beschriftung Platz.
   Sie behält beim Zoomen ihre Pixelgröße; 460 Welteinheiten sind bei 32 %
   rund 147 Bildpunkte — genug für eine Zeile, ohne die Nachbarkachel zu
   berühren. */
const GASSE = 460;
const RAND = 46;            // Rahmenrand
const KOPF = 34;            // Titelzeile des Rahmens
const GRUPPE = 150;         // zwischen zwei Rahmen
const ABSCHNITT = 1400;     // die Lücke, die Gamedesign von Technik trennt

const rahmen = [];

/** Spalten nebeneinander, Kacheln darin untereinander. Liefert den Kasten. */
function gruppe(titel, unterzeile, tint, bereich, x0, y0, spalten, gasse) {
  const abstand = gasse === undefined ? GASSE : gasse;
  let x = x0, x2 = x0, y2 = y0;
  for (const spalte of spalten) {
    let y = y0, breite = 0;
    for (const titelKachel of spalte) {
      const w = W(titelKachel);
      w.x = Math.round(x);
      w.y = Math.round(y);
      y += w.h + LUFT;
      breite = Math.max(breite, w.w);
    }
    x += breite + abstand;
    x2 = Math.max(x2, x - abstand);
    y2 = Math.max(y2, y - LUFT);
  }
  const kasten = {
    x: Math.round(x0 - RAND), y: Math.round(y0 - RAND - KOPF),
    w: Math.round(x2 - x0 + RAND * 2), h: Math.round(y2 - y0 + RAND * 2 + KOPF)
  };
  rahmen.push({
    id: uid('win'), type: 'frame', title: titel,
    x: kasten.x, y: kasten.y, w: kasten.w, h: kasten.h, z: 2,
    accent: tint, collapsed: false,
    state: { tint: tint, strength: 0.085, dashed: false, note: unterzeile, bereich: bereich }
  });
  return kasten;
}

/* ---------------------------------------------------- Abschnitt Gamedesign */

const GX = 0;
let y = 0;

kopfGamedesign.x = GX; kopfGamedesign.y = y;
y += kopfGamedesign.h + GRUPPE;

const g1 = gruppe('Ziel und Brett', 'Worauf gespielt wird — ein Brett, vier Geländearten',
  '#b78cf7', 'gamedesign', GX, y, [
    ['Das Feld'],
    ['Ablauf einer Partie', 'Ein Brett — 8 × 12'],
    ['Gelände', 'Fels-Stellungen']
  ]);
y = g1.y + g1.h + GRUPPE;

const g2 = gruppe('Wirtschaft, Ausbau, Kampf', 'Die Regeln, die eine Partie entscheiden',
  '#4fd1c5', 'mechanik', GX, y, [
    ['Ressourcen & Vorrat', 'Wie geschlagen wird'],
    ['Kartenkontingent', 'Stellungen'],
    ['Ausbau & Verschmelzen']
  ]);
y = g2.y + g2.h + GRUPPE;

const g3 = gruppe('Der Einstieg — was der Spieler wählt', 'Jeder Pfeil hängt an genau dem Knopf, der ihn auslöst',
  '#6ea8fe', 'menues', GX, y, [
    ['Einstieg — die Auswahlseite'],
    ['Online — zwei Feldherren, ein Tisch', 'Charakter und Kartenhand', 'Übungspartie gegen die KI']
  ]);
y = g3.y + g3.h + GRUPPE;

const g4 = gruppe('Im Gefecht — was die Bedienung kann', 'Fünf Handlungen, mehr gibt es nicht',
  '#6ea8fe', 'menues', GX, y, [
    ['Im Gefecht — HUD'],
    ['Karte legen', 'Haupthaus setzen', 'Abriss und Drehen'],
    ['Halten — die Stellung', 'Pause und Aufgeben']
  ]);
y = g4.y + g4.h + GRUPPE;

const g5 = gruppe('Bauten und Truppen', '2D aus dem laufenden Spiel, 3D als Vorlage',
  '#f78ca0', 'charaktere', GX, y, [
    ['Haupthaus — 2D (Spiel)', 'Haupthaus — 3D', 'Haupthaus — Werte'],
    ['Mauer — 2D (Spiel)', 'Mauer — 3D', 'Mauer — Werte'],
    ['Werk — 2D (Spiel)', 'Werk — 3D', 'Werk — Werte'],
    ['Kanone — 2D (Spiel)', 'Kanone — 3D', 'Kanone — Werte'],
    ['Schwert — 2D (Spiel)', 'Schwert — 3D', 'Schwert — Werte'],
    ['Bogen — 2D (Spiel)', 'Bogen — 3D', 'Bogen — Werte'],
    ['Ritter — 2D (Spiel)', 'Ritter — 3D', 'Ritter — Werte'],
    ['2D und 3D — was ist was?', 'Schützenturm — 3D', 'Kontaktbogen — 2D über 3D']
  ], SPALTE);
y = g5.y + g5.h + GRUPPE;

const g6 = gruppe('Auf dem Handy — echte Aufnahmen', 'Leinwand des laufenden Spiels, 390 × 597',
  '#e0a0c8', 'medien', GX, y, [
    ['Münzwurf'], ['Aufstellen'], ['Gefecht'], ['Gefecht — später'], ['Woher diese Bilder stammen']
  ], SPALTE);

const gamedesignUnten = g6.y + g6.h;

/* ------------------------------------------------------ Abschnitt Technik */

y = gamedesignUnten + ABSCHNITT;

kopfTechnik.x = GX; kopfTechnik.y = y;
y += kopfTechnik.h + GRUPPE;

const t1 = gruppe('Der Kern — beide Geräte rechnen dieselbe Partie', 'Gleichschritt (Lockstep) · Weg B aus docs/FELDHERR-PLAN.md',
  '#b78cf7', 'technik', GX, y, [
    ['Der Spielkern', 'Bitgenau gleich rechnen'],
    ['kern.d.ts — der Draht nach draußen'],
    ['regeln.ts — Takt und Vorlauf']
  ]);
y = t1.y + t1.h + GRUPPE;

const t2 = gruppe('Über die Leitung', 'Zwei Nachrichtenarten, mehr braucht es nicht',
  '#ef6b6b', 'technik', GX, y, [
    ['Die Züge im Protokoll', 'Übungspartie — der Server sieht nichts'],
    ['Ein Zug geht als action über die Leitung', 'Warum überhaupt ein Herzschlag?', 'Online — Tisch anlegen und beitreten'],
    ['takt — Herzschlag, ausdrücklich keine Aktion', 'Was schon schiefging']
  ]);
y = t2.y + t2.h + GRUPPE;

const t3 = gruppe('Das Modul auf dem Server', 'packages/game-feldherr — reine Logik, kein Netz, keine Uhr',
  '#57c98a', 'technik', GX, y, [
    ['Der Partiezustand ist dünn'],
    ['verarbeite() — was der Server prüft'],
    ['Dieselbe Schnittstelle, andere Gattung']
  ]);
y = t3.y + t3.h + GRUPPE;

const t4 = gruppe('Ausgang und Wertung', 'Zwei Meldungen, eine Prüfsumme',
  '#4fd1c5', 'technik', GX, y, [
    ['Beide melden getrennt'],
    ['Strittig — und dann?'],
    ['Erfahrung nach Dauer, mit fallendem Ertrag']
  ]);
y = t4.y + t4.h + GRUPPE;

const t5 = gruppe('Warum es so gebaut ist', 'Feldherr ist die erste Echtzeitgattung im Haus',
  '#e8b45c', 'technik', GX, y, [
    ['Drei Wege — und warum es B wurde'],
    ['Was an GameModule nicht passte']
  ]);

const technikUnten = t5.y + t5.h;

/* ------------------------------------------------- Die zwei Abschnittsrahmen */

function abschnitt(titel, unterzeile, tint, bereich, oben, unten) {
  let x1 = Infinity, x2 = -Infinity;
  for (const r of rahmen) {
    if (r.y < oben || r.y > unten) continue;
    x1 = Math.min(x1, r.x); x2 = Math.max(x2, r.x + r.w);
  }
  const luft = 70;
  rahmen.push({
    id: uid('win'), type: 'frame', title: titel,
    x: Math.round(x1 - luft), y: Math.round(oben - luft - 44),
    w: Math.round(x2 - x1 + luft * 2), h: Math.round(unten - oben + luft * 2 + 44),
    z: 1, accent: tint, collapsed: false,
    state: { tint: tint, strength: 0.05, dashed: false, note: unterzeile, bereich: bereich }
  });
}

abschnitt('GAMEDESIGN', 'Prinzipien · hier und nur hier wird erfunden',
  '#b78cf7', 'gamedesign', kopfGamedesign.y, gamedesignUnten);
abschnitt('TECHNISCHE UMSETZUNG', 'Folgt dem Gamedesign — erfindet nichts',
  '#8fa4c4', 'technik', kopfTechnik.y, technikUnten);

doc.windows = rahmen.concat(doc.windows);

/* ===================================================================== */
/* 6  Pfeile — rechtwinklig, einheitlich beschriftet                     */
/* ===================================================================== */

const pfeil = (a, b, label, opt = {}) => {
  const teile = (s) => { const i = s.indexOf('#'); return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)]; };
  const [aw, as] = teile(a), [bw, bs] = teile(b);
  doc.connections.push({
    id: uid('con'),
    from: { win: W(aw).id, side: opt.from || 'auto', shape: as },
    to: { win: W(bw).id, side: opt.to || 'auto', shape: bs },
    label: label, labelSize: 12, t: null,
    color: opt.color || '#6ea8fe', width: opt.width || 2,
    dash: opt.dash || 'solid', curve: 'ortho', heads: 'end'
  });
};

/* --- Gamedesign: Brett --- */
pfeil('Das Feld#f_wald', 'Gelände', 'vier Geländearten', { from: 'r', to: 'l', color: '#57c98a' });
pfeil('Das Feld#f_berg', 'Fels-Stellungen', 'Fels: bebaubar', { from: 'b', to: 'l', color: '#9aa4b6' });
pfeil('Das Feld#f_h2', 'Ablauf einer Partie', 'Haupthaus zuerst', { from: 'r', to: 'l', color: '#e8b45c' });
pfeil('Das Feld#f_werk', 'Ressourcen & Vorrat', 'Werk 1×2 — der Ertrag', { from: 'b', to: 't', color: '#e8b45c' });

/* --- Gamedesign: Einstieg, Knopf für Knopf --- */
pfeil('Einstieg — die Auswahlseite#a_erstellen', 'Online — zwei Feldherren, ein Tisch', 'Tisch erstellen', { from: 'r', to: 'l', color: '#57c98a', width: 2.5 });
pfeil('Einstieg — die Auswahlseite#a_tisch', 'Online — zwei Feldherren, ein Tisch', 'beitreten', { from: 'r', to: 'l', color: '#57c98a' });
pfeil('Einstieg — die Auswahlseite#a_held_engineer', 'Charakter und Kartenhand', 'wählt die Kartenhand', { from: 'r', to: 'l', color: '#f78ca0', width: 2.5 });
pfeil('Einstieg — die Auswahlseite#a_karte_3', 'Charakter und Kartenhand', 'Werk wird Werkstatt', { from: 'r', to: 'l', color: '#f78ca0' });
pfeil('Einstieg — die Auswahlseite#a_ki_start', 'Übungspartie gegen die KI', 'startet ohne Tisch', { from: 'r', to: 'l', color: '#9aa4b6' });

/* --- Gamedesign: Gefecht, Knopf für Knopf --- */
pfeil('Im Gefecht — HUD#b_karte_0', 'Karte legen', 'Karte wählen und setzen', { from: 'r', to: 'l', color: '#e8b45c', width: 2.5 });
pfeil('Im Gefecht — HUD#b_haus', 'Haupthaus setzen', 'einmalig, kostenlos', { from: 'r', to: 'l', color: '#e8b45c' });
pfeil('Im Gefecht — HUD#b_abriss', 'Abriss und Drehen', 'Abriss — 20 % zurück', { from: 'r', to: 'l', color: '#e8b45c' });
pfeil('Im Gefecht — HUD#b_drehen', 'Abriss und Drehen', 'Werk quer oder hoch', { from: 'r', to: 'l', color: '#e8b45c' });
pfeil('Im Gefecht — HUD#b_menu', 'Pause und Aufgeben', 'Pausenmenü', { from: 'r', to: 'l', color: '#ef6b6b' });
pfeil('Im Gefecht — HUD#b_haus', 'Halten — die Stellung', 'Antippen statt Knopf', { from: 'r', to: 'l', color: '#4fd1c5', dash: 'dashed' });

/* --- Gamedesign: Mechanik untereinander --- */
pfeil('Kartenkontingent', 'Ausbau & Verschmelzen', 'jede Karte zählt für immer', { from: 'r', to: 'l', color: '#4fd1c5' });
pfeil('Ausbau & Verschmelzen', 'Stellungen', 'Hausstufe = Schützenstellungen', { from: 'b', to: 'r', color: '#4fd1c5', width: 2.5 });
pfeil('Ressourcen & Vorrat', 'Kartenkontingent', 'zwei Bremsen: Gold und Karten', { from: 'r', to: 'l', color: '#4fd1c5' });
pfeil('Charakter und Kartenhand', 'Kartenkontingent', 'welche sechs Karten', { from: 't', to: 'r', color: '#f78ca0', dash: 'dotted' });
pfeil('Münzwurf', 'Ablauf einer Partie', 'Schritt 2', { from: 't', to: 'b', color: '#e0a0c8', dash: 'dotted' });
pfeil('Gefecht', 'Das Feld', 'dasselbe Brett, von oben', { from: 't', to: 'b', color: '#e0a0c8', dash: 'dotted' });

/* --- Die EINE Brücke zwischen den Abschnitten --- */
pfeil('Im Gefecht — HUD', 'Die Züge im Protokoll',
  'Jede Handlung wird zu genau einem Zug — mehr weiß die Technik vom Spiel nicht',
  { from: 'b', to: 't', color: '#8fa4c4', width: 3 });

/* --- Technik untereinander --- */
pfeil('Online — Tisch anlegen und beitreten', 'Der Spielkern', 'Saatkorn aus der Sicht', { from: 'l', to: 'r', color: '#b78cf7' });
pfeil('Die Züge im Protokoll', 'kern.d.ts — der Draht nach draußen', 'melde(zug)', { from: 'l', to: 'r', color: '#b78cf7', width: 2.5 });
pfeil('kern.d.ts — der Draht nach draußen', 'Ein Zug geht als action über die Leitung', 'reicht unverändert weiter', { from: 'b', to: 't', width: 2.5 });
pfeil('kern.d.ts — der Draht nach draußen', 'takt — Herzschlag, ausdrücklich keine Aktion', 'puls alle 200 ms', { from: 'b', to: 't', color: '#ef6b6b', dash: 'dashed' });
pfeil('regeln.ts — Takt und Vorlauf', 'kern.d.ts — der Draht nach draußen', 'Takt 50 ms · Vorlauf 6', { from: 'l', to: 'r', color: '#8fa4c4' });
pfeil('takt — Herzschlag, ausdrücklich keine Aktion', 'Warum überhaupt ein Herzschlag?', 'weitergereicht wie ein Zuruf', { from: 'l', to: 'r', color: '#ef6b6b' });
pfeil('Was schon schiefging', 'Bitgenau gleich rechnen', 'brach den Gleichlauf', { from: 'l', to: 'r', color: '#ef6b6b', dash: 'dotted' });
pfeil('Ein Zug geht als action über die Leitung', 'verarbeite() — was der Server prüft', 'act(party, seat, action)', { from: 'b', to: 't', color: '#57c98a', width: 2.5 });
pfeil('verarbeite() — was der Server prüft', 'Der Partiezustand ist dünn', 'Zug an die Liste', { from: 'l', to: 'r', color: '#57c98a' });
pfeil('Der Partiezustand ist dünn', 'Beide melden getrennt', 'Meldungen · Ausgang', { from: 'b', to: 't', color: '#4fd1c5' });
pfeil('Beide melden getrennt', 'Strittig — und dann?', 'Prüfsummen weichen ab', { from: 'r', to: 'l', color: '#4fd1c5', dash: 'dashed' });
pfeil('Beide melden getrennt', 'Erfahrung nach Dauer, mit fallendem Ertrag', 'takte → Punkte', { from: 'b', to: 'b', color: '#4fd1c5' });
pfeil('Dieselbe Schnittstelle, andere Gattung', 'Was an GameModule nicht passte', 'was nicht passte', { from: 'b', to: 't', color: '#e8b45c', dash: 'dotted' });
pfeil('Drei Wege — und warum es B wurde', 'Der Spielkern', 'Weg B', { from: 'l', to: 'l', color: '#e8b45c', dash: 'dashed' });

/* ------------------------------------------------------------- Ausgabe */

let z = 10;
for (const w of doc.windows) if (w.type !== 'frame') w.z = z++;
doc.nextZ = z + 1;
doc.name = 'Feldherr — Gamedesign und Technik';
doc.view = { x: 220, y: 120, scale: 0.34 };

writeFileSync(DATEI, JSON.stringify(doc, null, 1), 'utf8');
console.log('Fenster:', doc.windows.length,
  '· Rahmen:', doc.windows.filter((w) => w.type === 'frame').length,
  '· Pfeile:', doc.connections.length);
console.log('Gamedesign endet bei y =', Math.round(gamedesignUnten),
  '· Technik beginnt bei y =', Math.round(kopfTechnik.y));
