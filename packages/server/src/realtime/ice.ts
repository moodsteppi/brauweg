import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { EisPartie } from "./ice-kern.js";
type Raum = {
  code: string;
  spiel: EisPartie;
  host: string;
  offen: boolean;
  seit: number;
  leerSeit: number;
  abmeldungen: Map<string, number>;
  leitungen: Map<string, WebSocket>;
  schluessel: Map<string, string>;
};
export class IceGateway {
  private wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  private raeume = new Map<string, Raum>();
  private takt: ReturnType<typeof setInterval>;
  private anschluesse = new Set<WebSocket>();
  private schritt = 0;
  constructor(
    private server: Server,
    private origins: readonly string[] = [],
  ) {
    server.on("upgrade", this.upgrade);
    this.takt = setInterval(() => {
      for (const [code, r] of this.raeume) {
        if (r.leitungen.size) r.leerSeit = Date.now();
        for (const [sitz, seit] of r.abmeldungen) {
          if (r.spiel.phase === "lobby" && Date.now() - seit > 15000)
            this.entfernen(r, sitz);
        }
        if (
          Date.now() - r.seit > 3600000 ||
          (!r.leitungen.size && Date.now() - r.leerSeit > 120000)
        ) {
          for (const ws of r.leitungen.values()) ws.close();
          this.raeume.delete(code);
          continue;
        }
        if (
          r.offen &&
          r.spiel.phase === "lobby" &&
          (r.spiel.spieler.length === 4 || Date.now() - r.seit > 30000)
        ) {
          this.auffuellen(r);
          r.spiel.spieler.forEach((p) => (p.bereit = true));
          r.spiel.starten();
        }
        r.spiel.schritt();
        if (this.schritt % 2 === 0) this.verteilen(r);
      }
      this.schritt++;
    }, 40);
    this.takt.unref();
  }
  private upgrade = (
    req: import("node:http").IncomingMessage,
    socket: import("node:stream").Duplex,
    head: Buffer,
  ) => {
    if (req.url?.split("?")[0] !== "/ws/ice") return;
    if (
      this.origins.length &&
      !this.origins.includes(req.headers.origin ?? "")
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    if (this.anschluesse.size >= 400) {
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.verbinden(ws));
  };
  private senden(ws: WebSocket, n: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 65536) ws.close(1013);
      else ws.send(JSON.stringify(n));
    }
  }
  private verteilen(r: Raum) {
    for (const [id, ws] of r.leitungen)
      this.senden(ws, {
        art: "stand",
        code: r.code,
        ich: id,
        host: r.host,
        offen: r.offen,
        warte: Math.max(0, 30 - Math.floor((Date.now() - r.seit) / 1000)),
        ...r.spiel.sicht(id),
      });
  }
  private auffuellen(r: Raum) {
    while (r.spiel.spieler.length < 4)
      r.spiel.hinzufuegen(
        randomBytes(8).toString("hex"),
        "Bot " + ["Pip", "Flocke", "Fiete", "Nora"][r.spiel.spieler.length],
        true,
      );
  }
  private verbinden(ws: WebSocket) {
    this.anschluesse.add(ws);
    let raum: Raum | undefined,
      id = "",
      fenster = Date.now(),
      anzahl = 0,
      zuletzt = Date.now();
    const frist = setInterval(() => {
      if (Date.now() - zuletzt > 15000) ws.close();
    }, 5000);
    ws.on("error", () => ws.terminate());
    ws.on("message", (raw) => {
      zuletzt = Date.now();
      if (zuletzt - fenster > 1000) {
        fenster = zuletzt;
        anzahl = 0;
      }
      if (++anzahl > 65) {
        ws.close(1008);
        return;
      }
      try {
        const n = JSON.parse(raw.toString());
        if (n.art === "ping") {
          this.senden(ws, { art: "pong", zeit: n.zeit });
          return;
        }
        if (!raum) {
          if (n.version !== 2)
            throw Error(
              "Bitte lade Ice Clash neu. Die neue Version verwendet Planungszüge.",
            );
          if (n.art === "weiter") {
            const r = this.raeume.get(String(n.code));
            const sitz = r?.schluessel.get(String(n.token));
            if (!r || !sitz)
              throw Error("Die Partie ist nicht mehr verfügbar.");
            raum = r;
            id = sitz;
            raum.leitungen.get(id)?.close();
          } else {
            if (!["online", "privat", "beitreten", "ueben"].includes(n.art))
              return;
            raum =
              n.art === "beitreten"
                ? this.raeume.get(String(n.code).toUpperCase())
                : n.art === "online"
                  ? [...this.raeume.values()].find(
                      (r) =>
                        r.offen &&
                        r.spiel.phase === "lobby" &&
                        r.spiel.spieler.length < 4,
                    )
                  : undefined;
            if (n.art === "beitreten" && !raum)
              throw Error("Diesen Raum gibt es nicht.");
            if (!raum) {
              if (this.raeume.size >= 100)
                throw Error("Gerade sind alle Arenen belegt.");
              const code = randomBytes(4).toString("hex").toUpperCase();
              raum = {
                code,
                spiel: new EisPartie(randomBytes(4).readUInt32LE()),
                host: "",
                offen: n.art === "online",
                seit: Date.now(),
                leerSeit: Date.now(),
                abmeldungen: new Map(),
                leitungen: new Map(),
                schluessel: new Map(),
              };
              this.raeume.set(code, raum);
            }
            id = randomBytes(8).toString("hex");
            if (
              !raum.spiel.hinzufuegen(
                id,
                String(n.name ?? "Pinguin")
                  .replace(/[\x00-\x1f]/g, "")
                  .trim()
                  .slice(0, 20) || "Pinguin",
              )
            ) {
              raum = undefined;
              throw Error("Diese Runde ist bereits voll oder gestartet.");
            }
            if (!raum.host) raum.host = id;
            const token = randomBytes(24).toString("hex");
            raum.schluessel.set(token, id);
            this.senden(ws, { art: "zugang", code: raum.code, token });
            if (n.art === "ueben") {
              this.auffuellen(raum);
              raum.spiel.spieler.forEach((p) => (p.bereit = true));
              raum.spiel.starten();
            }
          }
          raum.abmeldungen.delete(id);
          raum.leitungen.set(id, ws);

          raum.spiel.spieler.find((p) => p.id === id)!.verbunden = true;
          this.verteilen(raum);
          return;
        }
        if (raum.leitungen.get(id) !== ws) return;
        const p = raum.spiel.spieler.find((p) => p.id === id)!;
        if (n.art === "plan")
          raum.spiel.planen(
            id,
            Number(n.zug),
            Number(n.x),
            Number(n.y),
            n.fest === true,
            n.item === true,
          );
        if (n.art === "emote") raum.spiel.emote(id, String(n.emote));
        if (n.art === "bereit" && raum.spiel.phase === "lobby")
          p.bereit = n.bereit === true;
        if (
          n.art === "bots" &&
          id === raum.host &&
          raum.spiel.phase === "lobby"
        )
          this.auffuellen(raum);
        if (n.art === "start" && id === raum.host) raum.spiel.starten();
        if (n.art === "verlassen") {
          for (const [t, s] of raum.schluessel)
            if (s === id) raum.schluessel.delete(t);
          if (raum.spiel.phase === "lobby") this.entfernen(raum, id);
          ws.close();
        }
      } catch (e) {
        this.senden(ws, {
          art: "fehler",
          text: e instanceof Error ? e.message : "Ungültige Nachricht",
          fatal: !raum,
        });
      }
    });
    ws.on("close", () => {
      clearInterval(frist);
      this.anschluesse.delete(ws);
      if (!raum || raum.leitungen.get(id) !== ws) return;
      raum.leitungen.delete(id);
      const p = raum.spiel.spieler.find((p) => p.id === id);
      if (p) p.verbunden = false;
      if (raum.spiel.phase === "lobby") {
        if (p) p.bereit = false;
        raum.abmeldungen.set(id, Date.now());
      }
    });
  }
  private entfernen(r: Raum, id: string) {
    r.spiel.spieler = r.spiel.spieler.filter((p) => p.id !== id);
    r.abmeldungen.delete(id);
    for (const [t, s] of r.schluessel) if (s === id) r.schluessel.delete(t);
    if (r.host === id) r.host = r.spiel.spieler.find((p) => !p.bot)?.id ?? "";
  }
  /**
   * Wie viele Menschen gerade in einer offenen Online-Lobby warten — fuer
   * Quick-Play (seit dem 28.11.2026). Dieselbe Bedingung wie die Raumwahl bei
   * `online` oben; gezaehlt werden verbundene Menschen, keine Bots.
   */
  wartendeOnline(): number {
    let zahl = 0;
    for (const r of this.raeume.values()) {
      if (!r.offen || r.spiel.phase !== "lobby" || r.spiel.spieler.length >= 4) continue;
      zahl += r.spiel.spieler.filter((p) => !p.bot && r.leitungen.has(p.id)).length;
    }
    return zahl;
  }
  async close() {
    clearInterval(this.takt);
    this.server.off("upgrade", this.upgrade);
    for (const ws of this.anschluesse) ws.terminate();
    await new Promise<void>((r) => this.wss.close(() => r()));
  }
}
