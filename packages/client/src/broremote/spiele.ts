import type { Spiel } from "@brauweg/broremote-kern";

/** Dieselben Einstiege im Games-Tab und beim direkten Aufruf von BroRemote. */
export const BRO_SPIELE: readonly {
  id: Spiel;
  name: string;
  bild: string;
  spieler: string;
}[] = [
  {
    id: "building",
    name: "Bro Building Battle",
    bild: "/broremote/baumeister.webp",
    spieler: "1–4 Spieler",
  },
  {
    id: "brotanks",
    name: "BroTanks",
    bild: "/broremote/ausbau/tanks.webp",
    spieler: "2–4 Spieler · Solo mit Bots",
  },
];

export function spielAusAdresse(): Spiel | null {
  const spiel = new URLSearchParams(window.location.search).get("spiel");
  return spiel === "building" || spiel === "brotanks" ? spiel : null;
}
