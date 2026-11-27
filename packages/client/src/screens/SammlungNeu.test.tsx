import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, type Shop } from "../api";
import { SammlungNeu } from "./SammlungNeu";
import { probeKonto } from "./probe-konto";
let shop: Shop;
beforeEach(() => {
  shop = {
    paesse: [],
    muenzpakete: [],
    edelsteinpakete: [],
    jetonpakete: [],
    truhen: [],
    kurs: 15,
    regale: [],
    tischware: [
      {
        id: "blatt-rubin",
        art: "blatt",
        wert: "rubin",
        nameKey: "blatt.rubin",
        seltenheit: "episch",
        preis: { coins: 1200, gems: 80 },
        besessen: false,
      },
      {
        id: "szene-stube",
        art: "szene",
        wert: "stube",
        nameKey: "szene.stube",
        seltenheit: "gewoehnlich",
        preis: { coins: 0, gems: 0 },
        besessen: true,
      },
      {
        id: "blatt-schach-pinguin",
        art: "blatt",
        wert: "schach-pinguin",
        nameKey: "blatt.schach-pinguin",
        seltenheit: "episch",
        preis: { coins: 1600, gems: 107 },
        besessen: false,
      },
    ],
  };
  vi.spyOn(api, "shop").mockResolvedValue(shop);
  vi.spyOn(api, "games").mockResolvedValue(
    ["doppelkopf", "skat", "brochess"].map((id) => ({
      id,
      nameKey: `game.${id}`,
      availability: "playable",
      seatCounts: [2],
      votes: 0,
    })),
  );
  vi.spyOn(api, "buyItem");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("öffnet Bereiche getrennt, wählt Besitz aus und führt für fremde Designs in den Shop", async () => {
  const thema = vi.fn(),
    zumShop = vi.fn();
  render(
    <SammlungNeu
      me={probeKonto()}
      onThemeChange={thema}
      onSchrank={vi.fn()}
      onShop={zumShop}
      spiel="doppelkopf"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /^Tisch/ }));
  expect(screen.getByRole("heading", { name: "Tisch" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Stube/ }));
  expect(thema).toHaveBeenCalledWith("doppelkopf", { tableScene: "stube" });
  fireEvent.click(screen.getByRole("button", { name: "Blätter" }));
  fireEvent.click(screen.getByRole("button", { name: /Rubin/ }));
  fireEvent.click(screen.getByRole("button", { name: "Zum Shop" }));
  expect(zumShop).toHaveBeenCalledWith("doppelkopf", "blatt-rubin");
  expect(api.buyItem).not.toHaveBeenCalled();
});
it("sperrt den BroChess-Pinguinsatz und zeigt den regulären Preis", async () => {
  const thema = vi.fn();
  render(
    <SammlungNeu
      me={probeKonto()}
      onThemeChange={thema}
      onSchrank={vi.fn()}
      onShop={vi.fn()}
      spiel="brochess"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /^Figuren/ }));
  const pinguin = screen.getByRole("button", { name: /Pinguin-Figuren/ });
  expect(pinguin).toHaveTextContent("1.600 Münzen");
  expect(
    screen.queryByRole("heading", { name: "Tisch" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Stube/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(pinguin);
  await waitFor(() =>
    expect(
      screen.getByRole("dialog", { name: "Pinguin-Figuren" }),
    ).toBeInTheDocument(),
  );
  expect(thema).not.toHaveBeenCalled();
});
it("zeigt nur drei Einstiegskacheln mit aktueller Ausstattung und aktualisiert sie nach der Auswahl", async () => {
  const props = {
    onThemeChange: vi.fn(),
    onSchrank: vi.fn(),
    spiel: "doppelkopf",
  };
  const me = probeKonto({
    themes: {
      doppelkopf: {
        cardDeck: "rubin",
        tableScene: "stube",
        cardBack: "standard",
      },
      skat: { cardDeck: "eiche", tableScene: "filz-blau", cardBack: "pinguin" },
    },
  });
  const { rerender } = render(<SammlungNeu {...props} me={me} />);
  const blatt = await screen.findByRole("button", { name: /^Blätter/ });
  expect(blatt).toHaveTextContent("Rubin");
  expect(blatt.querySelector("img")).toHaveAttribute(
    "src",
    "/karten/rubin/herz_d.webp",
  );
  const ruecken = screen.getByRole("button", { name: /^Rückseiten/ });
  expect(ruecken).toHaveTextContent("Zum Blatt passend");
  expect(ruecken.querySelector("img")).toHaveAttribute(
    "src",
    "/karten/rubin/ruecken.webp",
  );
  expect(document.querySelectorAll(".sam-bereichskachel")).toHaveLength(3);
  expect(document.querySelectorAll(".sam-design")).toHaveLength(0);
  fireEvent.click(blatt);
  expect(
    screen.queryByRole("button", { name: /Stube/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Zur Übersicht/ }));
  rerender(
    <SammlungNeu
      {...props}
      me={{
        ...me,
        themes: {
          ...me.themes,
          doppelkopf: { ...me.themes.doppelkopf, cardDeck: "eiche" },
        },
      }}
    />,
  );
  expect(screen.getByRole("button", { name: /^Blätter/ })).toHaveTextContent(
    "Eiche",
  );
  expect(
    screen.getByRole("button", { name: /^Rückseiten/ }).querySelector("img"),
  ).toHaveAttribute("src", "/karten/eiche/ruecken.webp");
  fireEvent.click(screen.getByRole("tab", { name: "Skat" }));
  expect(screen.getByRole("button", { name: /^Tisch/ })).toHaveTextContent(
    "Blauer Filz",
  );
  expect(
    screen.getByRole("button", { name: /^Rückseiten/ }).querySelector("img"),
  ).toHaveAttribute("src", "/karten/pinguin/ruecken.webp");
});
it("wechselt beim Spielwechsel aus der Detailansicht und übernimmt externe Spielwahl", async () => {
  const props = {
    me: probeKonto(),
    onThemeChange: vi.fn(),
    onSchrank: vi.fn(),
  };
  const { rerender } = render(<SammlungNeu {...props} spiel="doppelkopf" />);
  fireEvent.click(await screen.findByRole("button", { name: /^Tisch/ }));
  rerender(<SammlungNeu {...props} spiel="brochess" />);
  expect(
    await screen.findByRole("button", { name: /^Figuren/ }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Zur Übersicht/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /^Tisch/ }),
  ).not.toBeInTheDocument();
});
it("öffnet Rückseiten separat und speichert ausschließlich cardBack", async () => {
  shop.tischware.push({
    id: "ruecken-nachthimmel",
    art: "ruecken",
    wert: "nachthimmel",
    nameKey: "ruecken.nachthimmel",
    seltenheit: "selten",
    preis: { coins: 400, gems: 27 },
    besessen: true,
  });
  const thema = vi.fn();
  render(
    <SammlungNeu
      me={probeKonto()}
      onThemeChange={thema}
      onSchrank={vi.fn()}
      spiel="doppelkopf"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /^Rückseiten/ }));
  fireEvent.click(screen.getByRole("button", { name: /Nachthimmel/ }));
  expect(thema).toHaveBeenCalledWith("doppelkopf", { cardBack: "nachthimmel" });
  expect(
    screen.queryByRole("button", { name: /Rubin/ }),
  ).not.toBeInTheDocument();
});
it("verwendet im Zauberer eine vorhandene Zahlenkarte statt einer fehlenden Dame", async () => {
  vi.mocked(api.games).mockResolvedValue([
    {
      id: "wizard",
      nameKey: "game.wizard",
      availability: "playable",
      seatCounts: [3],
      votes: 0,
    },
  ]);
  const me = probeKonto({
    themes: {
      wizard: {
        cardDeck: "zauberwald",
        tableScene: "zauberturm",
        cardBack: "standard",
      },
    },
  });
  render(
    <SammlungNeu
      me={me}
      onThemeChange={vi.fn()}
      onSchrank={vi.fn()}
      spiel="wizard"
    />,
  );
  expect(
    (await screen.findByRole("button", { name: /^Blätter/ })).querySelector(
      "img",
    ),
  ).toHaveAttribute("src", "/karten/zauberwald/herz_13.webp");
});
