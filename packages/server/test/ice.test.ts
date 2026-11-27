import { test } from "node:test";
import assert from "node:assert/strict";
import { EisPartie } from "../src/realtime/ice-kern.js";
function partie() {
  const p = new EisPartie();
  p.hinzufuegen("a", "A");
  p.hinzufuegen("b", "B");
  p.spieler.forEach((s) => (s.bereit = true));
  p.starten();
  return p;
}
function ausfuehren(p: EisPartie) {
  for (let i = 0; i < 376 && p.phase === "planung"; i++) p.schritt();
  assert.equal(p.phase, "gleiten");
}
test("Lobby verlangt zwei bereite Spieler und begrenzt Plätze", () => {
  const p = new EisPartie();
  p.hinzufuegen("a", "A");
  assert.equal(p.starten(), false);
  for (const id of ["b", "c", "d"]) assert.equal(p.hinzufuegen(id, id), true);
  assert.equal(p.hinzufuegen("e", "E"), false);
  assert.equal(p.starten(), false);
});
test("15 Sekunden Planung frieren alle Figuren ein, dann gleiten alle gleichzeitig", () => {
  const p = partie(),
    a = p.spieler[0],
    b = p.spieler[1],
    vorher = p.spieler.map((s) => [s.x, s.y]);
  p.planen("a", p.zug, 1, 0, true);
  p.planen("b", p.zug, -1, 0, true);
  for (let i = 0; i < 374; i++) p.schritt();
  assert.equal(p.phase, "planung");
  assert.deepEqual(
    p.spieler.map((s) => [s.x, s.y]),
    vorher,
  );
  ausfuehren(p);
  assert.equal(a.vx, 240);
  assert.equal(b.vx, -240);
});
test("Entwürfe bleiben geheim, Festlegen ist verbindlich und alte Züge werden abgewiesen", () => {
  const p = partie();
  assert.equal(p.planen("a", p.zug, 1, 1, false), true);
  assert.equal(p.sicht("b").plan, null);
  assert.equal(p.sicht().plan, null);
  assert.ok(Math.hypot(p.sicht("a").plan!.x, p.sicht("a").plan!.y) <= 1);
  assert.equal(p.planen("a", p.zug, 0, 1, true), true);
  assert.equal(p.planen("a", p.zug, 1, 0, true), false);
  assert.equal(p.planen("b", p.zug - 1, 1, 0, true), false);
  assert.equal(p.planen("b", p.zug, NaN, Infinity, true), false);
  assert.equal(p.sicht("a").plan!.y, 1);
  assert.equal("plaene" in p.sicht("b"), false);
});
test("Ohne Eingabe bleibt man stehen, letzter Entwurf wird bei Ablauf übernommen", () => {
  const p = partie();
  p.planen("a", p.zug, 0.4, 0, false);
  ausfuehren(p);
  assert.equal(p.spieler[0].vx, 96);
  assert.equal(p.spieler[1].vx, 0);
});
test("Kollision überträgt Impuls auf den Gegner", () => {
  const p = partie();
  Object.assign(p.spieler[0], { x: -50, y: 0 });
  Object.assign(p.spieler[1], { x: 0, y: 0 });
  p.planen("a", p.zug, 1, 0, true);
  ausfuehren(p);
  for (let i = 0; i < 5; i++) p.schritt();
  assert.ok(p.spieler[1].vx > 100);
});
test("Überlebender erhält Sieg, nächste Runde bringt alle zurück", () => {
  const p = partie();
  ausfuehren(p);
  p.spieler[1].x = 400;
  p.schritt();
  assert.equal(p.phase, "pause");
  assert.equal(p.spieler[0].siege, 1);
  for (let i = 0; i < 101; i++) p.schritt();
  assert.equal(p.phase, "planung");
  assert.ok(p.spieler.every((s) => s.lebt));
  assert.equal(p.zug, 2);
});
test("Gleichzeitiger Sturz vergibt keine Krone", () => {
  const p = partie();
  ausfuehren(p);
  p.spieler.forEach((s) => (s.x = 400));
  p.schritt();
  assert.equal(p.gewinner, "");
  assert.ok(p.spieler.every((s) => s.siege === 0));
});
test("Dritter Rundensieg beendet die Serie", () => {
  const p = partie();
  p.spieler[0].siege = 2;
  ausfuehren(p);
  p.spieler[1].x = 400;
  p.schritt();
  for (let i = 0; i < 101; i++) p.schritt();
  assert.equal(p.phase, "ende");
});
test("Rand bricht erst nach dem angekündigten gemeinsamen Zug", () => {
  const p = partie();
  Object.assign(p.spieler[0], { x: -30, y: 0 });
  Object.assign(p.spieler[1], { x: 30, y: 0 });
  ausfuehren(p);
  for (let i = 0; i < 100; i++) p.schritt();
  assert.equal(p.phase, "planung");
  assert.equal(p.warnung, true);
  assert.equal(p.radius, 260);
  ausfuehren(p);
  for (let i = 0; i < 100; i++) p.schritt();
  assert.equal(p.radius, 225);
});
test("Item wird erst bei Ausführung und genau einmal verbraucht", () => {
  const p = partie();
  p.spieler[0].item = "anker";
  p.planen("a", p.zug, 0, 0, true, true);
  assert.equal(p.spieler[0].item, "anker");
  ausfuehren(p);
  assert.equal(p.spieler[0].item, "");
  assert.equal(p.spieler[0].anker, 4);
  p.schritt();
  assert.ok(p.spieler[0].anker < 4);
});
test("Schneeball trifft nach seiner Flugzeit", () => {
  const p = partie();
  Object.assign(p.spieler[0], { x: 0, y: 0, winkel: 0, item: "schneeball" });
  Object.assign(p.spieler[1], { x: 140, y: 0 });
  p.planen("a", p.zug, 0, 0, true, true);
  ausfuehren(p);
  assert.equal(p.geschosse.length, 1);
  assert.equal(p.spieler[1].vx, 0);
  for (let i = 0; i < 10; i++) p.schritt();
  assert.equal(p.geschosse.length, 0);
  assert.ok(p.spieler[1].vx > 0);
});
test("Emotes sind begrenzt und laufen auch in der Lobby aus", () => {
  const p = new EisPartie();
  p.hinzufuegen("a", "A");
  assert.equal(p.emote("a", "fremd"), false);
  assert.equal(p.emote("a", "hallo"), true);
  assert.equal(p.emote("a", "haha"), false);
  for (let i = 0; i < 51; i++) p.schritt();
  assert.equal(p.emote("a", "jubel"), true);
  for (let i = 0; i < 76; i++) p.schritt();
  assert.equal(p.spieler[0].emote, "");
});
test("Bot-Partien erreichen einen Champion für verschiedene Startwerte", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const p = new EisPartie(seed);
    for (let i = 0; i < 4; i++) p.hinzufuegen(String(i), "Bot", true);
    p.starten();
    for (let i = 0; i < 100000 && p.phase !== "ende"; i++) p.schritt();
    assert.equal(p.phase, "ende", `Seed ${seed}`);
    assert.equal(p.spieler.filter((s) => s.siege === 3).length, 1);
  }
});
