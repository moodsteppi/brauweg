import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import IceClash from "./IceClash";
vi.mock("../api", () => ({
  api: { me: () => Promise.reject(new Error("Gast")) },
}));
vi.mock("../pinguin", () => ({ Pinguin: () => <span>Pinguin</span> }));
vi.mock("../klang", () => ({ spiele: vi.fn() }));
vi.mock("../laufzeit", () => ({
  apiBase: "https://staging.brauweg-spielen.de",
  wsUrl: () => "wss://staging.brauweg-spielen.de/ws",
}));
class Leitung {
  static OPEN = 1;
  static alle: Leitung[] = [];
  readyState = 1;
  post: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    Leitung.alle.push(this);
  }
  send(n: string) {
    this.post.push(JSON.parse(n));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  nachricht(n: unknown) {
    this.onmessage?.({ data: JSON.stringify(n) });
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  Leitung.alle = [];
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal("WebSocket", Leitung);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("Ice-Clash-Verbindung", () => {
  it("nimmt nach Leitungsabbruch mit dem geheimen Sitzschlüssel statt einer neuen Anmeldung wieder auf", () => {
    render(<IceClash />);
    fireEvent.click(screen.getByText("Mit Freunden · Raum erstellen"));
    const a = Leitung.alle[0];
    act(() => a.onopen?.());
    expect(a.url).toMatch(/\/ws\/ice$/);
    expect(a.post[0].art).toBe("privat");
    act(() =>
      a.nachricht({ art: "zugang", code: "AB12CD34", token: "sitzschluessel" }),
    );
    act(() => {
      a.close();
      vi.advanceTimersByTime(1500);
    });
    const b = Leitung.alle[1];
    act(() => b.onopen?.());
    expect(b.post[0]).toEqual({
      version: 2,
      art: "weiter",
      code: "AB12CD34",
      token: "sitzschluessel",
    });
  });
  it("bietet eine Partie nach Neuladen an und löscht abgelaufene Berechtigungen", () => {
    sessionStorage.setItem(
      "ice-zugang",
      JSON.stringify({ code: "AB12CD34", token: "alt" }),
    );
    render(<IceClash />);
    fireEvent.click(screen.getByText("Zur laufenden Partie zurück"));
    const a = Leitung.alle[0];
    act(() => a.onopen?.());
    expect(a.post[0].art).toBe("weiter");
    act(() =>
      a.nachricht({
        art: "fehler",
        fatal: true,
        text: "Die Partie ist nicht mehr verfügbar.",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("nicht mehr verfügbar");
    expect(sessionStorage.getItem("ice-zugang")).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(Leitung.alle).toHaveLength(1);
  });
});
