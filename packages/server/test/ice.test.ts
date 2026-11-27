import { test } from "node:test";
import assert from "node:assert/strict";
import { EisPartie } from "../src/realtime/ice-kern.js";
function partie() {
  const p = new EisPartie();
  p.hinzufuegen("a", "A");
  p.hinzufuegen("b", "B");
  p.spieler.forEach((s) => (s.bereit = true));
  p.starten();
  for (let i = 0; i < 76; i++) p.schritt();
  return p;
}
test("Lobby verlangt zwei bereite Spieler und begrenzt Plätze", () => {
  const p = new EisPartie();
  p.hinzufuegen("a", "A");
  assert.equal(p.starten(), false);
  for (const id of ["b", "c", "d"]) assert.equal(p.hinzufuegen(id, id), true);
  assert.equal(p.hinzufuegen("e", "E"), false);
  assert.equal(p.starten(), false);
});
test("Überlebender erhält einen Sieg, nächste Runde bringt alle zurück", () => {
  const p = partie();
  p.spieler[1].x = 400;
  p.schritt();
  assert.equal(p.phase, "pause");
  assert.equal(p.spieler[0].siege, 1);
  for (let i = 0; i < 126; i++) p.schritt();
  assert.equal(p.phase, "countdown");
  assert.ok(p.spieler.every((s) => s.lebt));
});
test("Gleichzeitiger Sturz vergibt keine Krone", () => {
  const p = partie();
  p.spieler.forEach((s) => (s.x = 400));
  p.schritt();
  assert.equal(p.gewinner, "");
  assert.ok(p.spieler.every((s) => s.siege === 0));
});
test("Dritter Rundensieg beendet die Serie", () => {
  const p = partie();
  p.spieler[0].siege = 2;
  p.spieler[1].x = 400;
  p.schritt();
  for (let i = 0; i < 126; i++) p.schritt();
  assert.equal(p.phase, "ende");
});
test("Schubs wirkt nur auf lebende Gegner vor der Figur", () => {
  const p = partie();
  Object.assign(p.spieler[0], { x: 0, y: 0, winkel: 0 });
  Object.assign(p.spieler[1], { x: 45, y: 0 });
  p.eingabe("a", 1, 0, true, false);
  for (let i = 0; i < 12; i++) p.schritt();
  p.eingabe("a", 0, 0, false, false);
  p.schritt();
  assert.ok(p.spieler[1].vx > 30);
});
test("Ungültige Eingaben erzeugen keine ungültigen Koordinaten", () => {
  const p = partie();
  p.eingabe("a", NaN, Infinity, true, true);
  p.schritt();
  assert.ok(
    p.spieler.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y)),
  );
});
test("Eis kündigt Abbruch an und schrumpft anschließend", () => {
  const p = partie();
  p.spieler.forEach((s, i) => {
    s.x = i * 40;
    s.y = 0;
  });
  for (let i = 0; i < 175; i++) p.schritt();
  assert.equal(p.warnung, true);
  for (let i = 0; i < 60; i++) p.schritt();
  assert.ok(p.radius < 260);
});
test("Item wird genau einmal verbraucht", () => {
  const p = partie();
  p.spieler[0].item = "anker";
  p.eingabe("a", 0, 0, false, true);
  p.schritt();
  assert.equal(p.spieler[0].item, "");
  assert.ok(p.spieler[0].anker > 0);
});
test("Schneeball fliegt sichtbar und trifft erst nach seiner Flugzeit", () => {
  const p = partie();
  Object.assign(p.spieler[0], { x: 0, y: 0, winkel: 0, item: "schneeball" });
  Object.assign(p.spieler[1], { x: 140, y: 0 });
  p.eingabe("a", 0, 0, false, true);
  p.schritt();
  assert.equal(p.geschosse.length, 1);
  assert.equal(p.spieler[1].vx, 0);
  for (let i = 0; i < 10; i++) p.schritt();
  assert.equal(p.geschosse.length, 0);
  assert.ok(p.spieler[1].vx > 0);
});
test("Veraltete Bewegungsbefehle laufen aus, ein gehaltenes Item löst nicht erneut aus", () => {
  const p = partie();
  p.spieler[0].x = 0;
  p.eingabe("a", 1, 0, false, true);
  p.spieler[0].item = "anker";
  p.schritt();
  p.spieler[0].item = "wind";
  p.schritt();
  assert.equal(p.spieler[0].item, "wind");
  for (let i = 0; i < 15; i++) p.schritt();
  const v = p.spieler[0].vx;
  for (let i = 0; i < 10; i++) p.schritt();
  assert.ok(p.spieler[0].vx < v);
});
test("Bot-Partien enden für verschiedene Startwerte mit genau einem Champion", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const p = new EisPartie(seed);
    for (let i = 0; i < 4; i++) p.hinzufuegen(String(i), "Bot", true);
    p.starten();
    for (let i = 0; i < 20000 && p.phase !== "ende"; i++) p.schritt();
    assert.equal(p.phase, "ende");
    assert.equal(p.spieler.filter((s) => s.siege === 3).length, 1);
  }
});
