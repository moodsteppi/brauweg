import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { IceGateway } from "../src/realtime/ice.js";
import { Gateway } from "../src/realtime/gateway.js";
import type { Db } from "../src/db/types.js";
import type { PartyRuntime } from "../src/runtime/party.js";
const ursprung = "https://staging.brauweg-spielen.de";
async function verbinden(url: string) {
  const ws = new WebSocket(url, { origin: ursprung });
  const post: any[] = [];
  ws.on("message", (d) => post.push(JSON.parse(d.toString())));
  await new Promise<void>((ok, nein) => {
    ws.once("open", ok);
    ws.once("error", nein);
  });
  return {
    ws,
    senden(n: unknown) {
      ws.send(JSON.stringify({ ...(n as object), version: 2 }));
    },
    async warten(art: string, pruefen: (n: any) => boolean = () => true) {
      const bis = Date.now() + 4000;
      while (Date.now() < bis) {
        const i = post.findIndex((n) => n.art === art && pruefen(n));
        if (i >= 0) return post.splice(i, 1)[0];
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.fail(`Nachricht fehlt: ${art}`);
    },
  };
}
test("Ice Clash: gemeinsame Lobby, Hostrechte, Wiederaufnahme und geheime Sitzberechtigung", async (t) => {
  const server = createServer();
  const alt = new Gateway(
    server,
    {} as Db,
    { onUpdate() {} } as unknown as PartyRuntime,
    { lookupSession: async () => null },
  );
  const g = new IceGateway(server, [ursprung]);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `ws://127.0.0.1:${(server.address() as { port: number }).port}/ws/ice`;
  const leitungen: WebSocket[] = [];
  t.after(async () => {
    leitungen.forEach((w) => w.terminate());
    await g.close();
    await alt.close();
    await new Promise<void>((r) => server.close(() => r()));
  });
  const a = await verbinden(url);
  leitungen.push(a.ws);
  a.senden({ art: "privat", name: "Anna" });
  const z = await a.warten("zugang");
  const zuerst = await a.warten("stand");
  const b = await verbinden(url);
  leitungen.push(b.ws);
  b.senden({ art: "beitreten", code: z.code, name: "Bert" });
  await b.warten("zugang");
  await a.warten("stand", (s) => s.spieler.length === 2);
  b.senden({ art: "bots" });
  b.senden({ art: "start" });
  b.senden({ art: "ping", zeit: 1 });
  await b.warten("pong");
  const lobby = await a.warten("stand", (s) => s.spieler.length === 2);
  assert.equal(lobby.phase, "lobby");
  assert.equal(
    lobby.spieler.some((p: any) => p.token || p.schluessel),
    false,
  );
  a.ws.close();
  await b.warten("stand", (s) =>
    s.spieler.some((p: any) => p.id === zuerst.ich && !p.verbunden),
  );
  const neu = await verbinden(url);
  leitungen.push(neu.ws);
  neu.senden({ art: "weiter", code: z.code, token: z.token });
  const weiter = await neu.warten("stand");
  assert.equal(weiter.ich, zuerst.ich);
  assert.equal(weiter.spieler.length, 2);
  const falsch = await verbinden(url);
  leitungen.push(falsch.ws);
  falsch.senden({ art: "weiter", code: z.code, token: "falsch" });
  assert.equal((await falsch.warten("fehler")).fatal, true);
  neu.senden({ art: "bereit", bereit: true });
  b.senden({ art: "bereit", bereit: true });
  await neu.warten("stand", (s) => s.spieler.every((p: any) => p.bereit));
  neu.senden({ art: "start" });
  await b.warten("stand", (s) => s.phase === "planung");
  const planung = await neu.warten("stand", (s) => s.phase === "planung");
  neu.senden({ art: "plan", zug: planung.zug, x: 0.6, y: 0.3, fest: true });
  await neu.warten("stand", (s) => s.plan?.fest);
  const geheim = await b.warten("stand", (s) =>
    s.spieler.some((p: any) => p.id === zuerst.ich && p.geplant),
  );
  assert.equal(geheim.plan, null);
  assert.equal("plaene" in geheim, false);
  neu.senden({ art: "emote", emote: "hallo" });
  await b.warten("stand", (s) =>
    s.spieler.some((p: any) => p.emote === "hallo"),
  );
  neu.ws.close();
  await b.warten(
    "stand",
    (s) => s.phase === "planung" && s.spieler.some((p: any) => !p.verbunden),
  );
  const spiel = await verbinden(url);
  leitungen.push(spiel.ws);
  spiel.senden({ art: "weiter", code: z.code, token: z.token });
  const wieder = await spiel.warten("stand");
  assert.equal(wieder.ich, zuerst.ich);
  assert.deepEqual(wieder.plan, { x: 0.6, y: 0.3, fest: true, item: false });
  spiel.senden({ art: "plan", zug: wieder.zug, x: -1, y: 0, fest: true });
  spiel.senden({ art: "ping", zeit: 2 });
  await spiel.warten("pong");
  assert.equal((await spiel.warten("stand")).plan.x, 0.6);
});
test("Ice Clash: fremde Ursprünge werden abgewiesen", async (t) => {
  const server = createServer(),
    g = new IceGateway(server, [ursprung]);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await g.close();
    await new Promise<void>((r) => server.close(() => r()));
  });
  const ws = new WebSocket(
    `ws://127.0.0.1:${(server.address() as { port: number }).port}/ws/ice`,
    { origin: "https://fremd.invalid" },
  );
  assert.match(
    (await new Promise<Error>((r) => ws.once("error", r))).message,
    /403/,
  );
});
test("Ice Clash: öffentliche Suche vereint vier Geräte und startet automatisch", async (t) => {
  const server = createServer(),
    g = new IceGateway(server, [ursprung]);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const leitungen: WebSocket[] = [];
  t.after(async () => {
    leitungen.forEach((w) => w.terminate());
    await g.close();
    await new Promise<void>((r) => server.close(() => r()));
  });
  const url = `ws://127.0.0.1:${(server.address() as { port: number }).port}/ws/ice`;
  const leute = [];
  for (let i = 0; i < 4; i++) {
    const c = await verbinden(url);
    leute.push(c);
    leitungen.push(c.ws);
    c.senden({ art: "online", name: `Gast ${i}` });
    await c.warten("zugang");
  }
  const s = await leute[0].warten("stand", (s) => s.phase === "planung");
  assert.equal(s.spieler.length, 4);
  assert.ok(s.spieler.every((p: any) => !p.bot));
  for (const c of leute.slice(1))
    assert.equal(
      (await c.warten("stand", (n) => n.phase === "planung")).code,
      s.code,
    );
});
