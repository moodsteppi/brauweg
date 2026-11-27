import { describe, it, expect } from "vitest";
import { EisPartie } from "../../../server/src/realtime/ice-kern";
import type { Stand } from "./sicht";
type Kernsicht = Omit<Stand, "code" | "ich" | "host" | "offen" | "warte">;
const pruefeSicht = (sicht: ReturnType<EisPartie["sicht"]>): Kernsicht => sicht;
describe("Ice-Clash-Sichtvertrag", () => {
  it("liefert auch im laufenden Spiel jede von der Oberfläche gelesene Eigenschaft", () => {
    const p = new EisPartie(42);
    for (let i = 0; i < 4; i++) p.hinzufuegen(String(i), "Pinguin", true);
    p.starten();
    for (let i = 0; i < 100; i++) p.schritt();
    const s = pruefeSicht(p.sicht());
    expect(s.phase).toBe("spiel");
    expect(s.spieler).toHaveLength(4);
    expect(s.geschosse).toEqual([]);
    expect(s.radius).toBe(260);
  });
});
