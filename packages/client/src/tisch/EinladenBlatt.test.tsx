import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/*
 * Freund an den Tisch einladen (Server: tables/tischeinladung.ts). Unter dem
 * Namen muss stehen, was der Server gemeldet hat — „wurde benachrichtigt"
 * nur, wenn die Mitteilung wirklich rausging.
 */
const { friends, tischEinladen } = vi.hoisted(() => ({
  friends: vi.fn(async () => ({
    friends: [
      { id: "ben", displayName: "Ben" },
      { id: "cara", displayName: "Cara" },
      { id: "dora", displayName: "Dora" },
    ],
    incoming: [],
    outgoing: [],
  })),
  tischEinladen: vi.fn(async (_tisch: string, gast: string) => ({
    status:
      gast === "ben"
        ? ("benachrichtigt" as const)
        : ("nichtErreichbar" as const),
  })),
}));
vi.mock("../api", async () => {
  const echt = await vi.importActual<typeof import("../api")>("../api");
  return { ...echt, api: { ...echt.api, friends, tischEinladen } };
});

import { EinladenBlatt } from "./EinladenBlatt";

describe("EinladenBlatt", () => {
  it("listet Freunde ohne die Sitzenden und zeigt den Stand je Einladung", async () => {
    render(
      <EinladenBlatt
        tableId="t1"
        sitzende={["dora"]}
        onClose={() => undefined}
      />,
    );
    expect(await screen.findByText("Ben")).toBeTruthy();
    expect(screen.queryByText("Dora")).toBeNull();

    const knoepfe = screen.getAllByRole("button", { name: "Einladen" });
    fireEvent.click(knoepfe[0]!);
    expect(await screen.findByText("wurde benachrichtigt")).toBeTruthy();
    expect(tischEinladen).toHaveBeenCalledWith("t1", "ben");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Einladen" }).at(-1)!,
    );
    expect(
      await screen.findByText("nicht erreichbar (keine App)"),
    ).toBeTruthy();
  });
});
