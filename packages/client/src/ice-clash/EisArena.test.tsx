import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EisArena } from "./EisArena";
import { EisPartie } from "../../../server/src/realtime/ice-kern";
import type { Stand } from "./sicht";
function sicht(): Stand {
  const p = new EisPartie();
  p.hinzufuegen("a", "A");
  p.hinzufuegen("b", "B");
  p.spieler.forEach((s) => (s.bereit = true));
  p.starten();
  return {
    ...p.sicht("a"),
    ich: "a",
    code: "12345678",
    host: "a",
    offen: false,
    warte: 0,
  };
}
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId: number;
      constructor(t: string, o: PointerEventInit) {
        super(t, o);
        this.pointerId = o.pointerId ?? 1;
      }
    },
  );
  Object.defineProperty(SVGElement.prototype, "setPointerCapture", {
    value: vi.fn(),
    configurable: true,
  });
  Object.defineProperty(SVGElement.prototype, "getScreenCTM", {
    value: () => null,
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Planen mit Fingern", () => {
  it("übermittelt Wischrichtung erst beim Loslassen und bestätigt per Button", () => {
    const senden = vi.fn();
    render(<EisArena stand={sicht()} verbunden senden={senden} />);
    const feld = screen.getByLabelText(/Eisarena:/);
    fireEvent.pointerDown(feld, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(feld, { pointerId: 1, clientX: 160, clientY: 10 });
    expect(senden).not.toHaveBeenCalled();
    fireEvent.pointerUp(feld, { pointerId: 1 });
    expect(senden).toHaveBeenLastCalledWith({
      art: "plan",
      zug: 1,
      x: 1,
      y: 0,
      item: false,
      fest: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Richtung festlegen" }));
    expect(senden).toHaveBeenLastCalledWith({
      art: "plan",
      zug: 1,
      x: 1,
      y: 0,
      item: false,
      fest: true,
    });
  });
  it("Zweifingerzoom verwirft angefangenen Wisch und sendet keinen Zug", () => {
    const senden = vi.fn();
    render(<EisArena stand={sicht()} verbunden senden={senden} />);
    const feld = screen.getByLabelText(/Eisarena:/),
      vorher = feld.getAttribute("viewBox");
    fireEvent.pointerDown(feld, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(feld, { pointerId: 1, clientX: 60, clientY: 10 });
    fireEvent.pointerDown(feld, { pointerId: 2, clientX: 100, clientY: 10 });
    fireEvent.pointerMove(feld, { pointerId: 2, clientX: 150, clientY: 10 });
    fireEvent.pointerUp(feld, { pointerId: 2 });
    fireEvent.pointerMove(feld, { pointerId: 1, clientX: 80, clientY: 20 });
    fireEvent.pointerUp(feld, { pointerId: 1 });
    expect(senden).not.toHaveBeenCalled();
    expect(feld.getAttribute("viewBox")).not.toBe(vorher);
    fireEvent.click(
      screen.getByRole("button", { name: "Stehen bleiben & festlegen" }),
    );
    expect(senden).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 0, y: 0, fest: true }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ganze Arena anzeigen" }),
    );
    expect(feld.getAttribute("viewBox")).toBe(vorher);
  });
  it("bestätigte Pläne bleiben gesperrt; neuer Zug entfernt alte Richtung", () => {
    const senden = vi.fn(),
      s = sicht();
    s.plan = { x: 1, y: 0, item: false, fest: true };
    const { rerender } = render(
      <EisArena stand={s} verbunden senden={senden} />,
    );
    expect(screen.getByRole("button", { name: "Festgelegt ✓" })).toBeDisabled();
    rerender(
      <EisArena
        stand={{ ...s, zug: 2, plan: null }}
        verbunden
        senden={senden}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Stehen bleiben & festlegen" }),
    );
    expect(senden).toHaveBeenLastCalledWith(
      expect.objectContaining({ zug: 2, x: 0, y: 0 }),
    );
  });
  it("zeigt vier Emotes und sendet nur die gewählte Kennung", () => {
    const senden = vi.fn();
    render(<EisArena stand={sicht()} verbunden senden={senden} />);
    fireEvent.click(screen.getByRole("button", { name: "Emotes" }));
    expect(screen.getAllByRole("button", { name: /^Emote / })).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Emote Jubel" }));
    expect(senden).toHaveBeenCalledWith({ art: "emote", emote: "jubel" });
  });
});
